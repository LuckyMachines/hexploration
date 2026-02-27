/**
 * ECVRF-SECP256K1-SHA256-TAI prover for off-chain VRF proof generation.
 * Matches VRFVerifier.sol's on-chain verification exactly.
 *
 * Usage:
 *   import { prove, computeFastVerifyParams, encodeVRFEnvelope } from './ecvrf-prover.mjs';
 *   const proof = prove(privateKey, seed);
 *   const params = computeFastVerifyParams(publicKey, proof, seed);
 *   const envelope = encodeVRFEnvelope(proof, params, gameData);
 */
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from 'viem';

// secp256k1 constants (must match VRFVerifier.sol)
const CURVE = secp256k1.CURVE;
const Fp = CURVE.Fp;
const Fn = CURVE.n;

const PP = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const NN = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;

// Generator point
const G = secp256k1.ProjectivePoint.BASE;

/**
 * Hash-to-curve: TAI method matching VRFVerifier.sol exactly.
 * suite = 0xFE, flag = 0x01
 */
function hashToCurve(publicKey, message) {
  const pkX = BigInt(publicKey[0]);
  const pkY = BigInt(publicKey[1]);

  for (let ctr = 0; ctr < 256; ctr++) {
    const hash = keccak256(
      encodePacked(
        ['uint8', 'uint8', 'uint256', 'uint256', 'bytes', 'uint8'],
        [0xfe, 0x01, pkX, pkY, message, ctr]
      )
    );

    const x = BigInt(hash);
    if (x >= PP) continue;

    // Compute y^2 = x^3 + 7 (mod p)
    const y2 = Fp.add(Fp.mul(Fp.mul(x, x), x), 7n);

    // Compute square root: y = y2^((p+1)/4) mod p
    const y = Fp.pow(y2, (PP + 1n) / 4n);

    if (Fp.mul(y, y) === y2) {
      // Use even y (parity bit 0) — matches Solidity
      const yFinal = y % 2n !== 0n ? PP - y : y;
      return secp256k1.ProjectivePoint.fromAffine({ x, y: yFinal });
    }
  }
  throw new Error('hashToCurve failed');
}

/**
 * Compute the Fiat-Shamir challenge c = hash(suite || 0x02 || H || PK || Gamma || U || V) mod n
 * Must match VRFVerifier._hashPoints exactly.
 */
function hashPoints(H, publicKey, gamma, U, V) {
  const hash = keccak256(
    encodePacked(
      ['uint8', 'uint8',
       'uint256', 'uint256',
       'uint256', 'uint256',
       'uint256', 'uint256',
       'uint256', 'uint256',
       'uint256', 'uint256'],
      [0xfe, 0x02,
       H.x, H.y,
       BigInt(publicKey[0]), BigInt(publicKey[1]),
       gamma.x, gamma.y,
       U.x, U.y,
       V.x, V.y]
    )
  );
  return BigInt(hash) % NN;
}

/**
 * Modular inverse in the curve order field.
 */
function modInv(a, m = NN) {
  a = ((a % m) + m) % m;
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

/**
 * Generate an ECVRF proof for a given seed.
 * @param {string} privateKeyHex - 32-byte hex private key (with or without 0x prefix)
 * @param {string} seedHex - The seed bytes as hex (output of computeSeed on-chain)
 * @returns {{ gamma: Point, c: bigint, s: bigint, publicKey: [string, string] }}
 */
export function prove(privateKeyHex, seedHex) {
  // Normalize private key
  const privKey = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const sk = BigInt('0x' + privKey);

  // Derive public key
  const PK = G.multiply(sk);
  const pkAffine = PK.toAffine();
  const publicKey = ['0x' + pkAffine.x.toString(16).padStart(64, '0'),
                     '0x' + pkAffine.y.toString(16).padStart(64, '0')];

  // Hash to curve
  const seedBytes = seedHex.startsWith('0x') ? seedHex : '0x' + seedHex;
  const H = hashToCurve(publicKey, seedBytes);

  // Gamma = sk * H
  const gamma = H.multiply(sk);
  const gammaAffine = gamma.toAffine();

  // Choose a deterministic nonce k (RFC 6979-style using keccak256)
  const kHash = keccak256(
    encodePacked(
      ['uint256', 'bytes'],
      [sk, seedBytes]
    )
  );
  const k = (BigInt(kHash) % (NN - 1n)) + 1n;

  // U = k * G
  const U = G.multiply(k);
  const uAffine = U.toAffine();

  // V = k * H
  const V = H.multiply(k);
  const vAffine = V.toAffine();

  // c = hashPoints(H, PK, Gamma, U, V)
  const c = hashPoints(
    H.toAffine(),
    publicKey,
    gammaAffine,
    uAffine,
    vAffine
  );

  // s = (k - c * sk) mod n
  const s = ((k - ((c * sk) % NN) % NN) + NN) % NN;

  return {
    gamma: gammaAffine,
    c,
    s,
    publicKey,
  };
}

/**
 * Compute fast-verify parameters for on-chain verification.
 * The on-chain verifier needs precomputed U and V component points.
 * @param {[string, string]} publicKey - [pkX, pkY] as hex strings
 * @param {{ gamma: {x: bigint, y: bigint}, c: bigint, s: bigint }} proof
 * @param {string} seedHex - The seed bytes as hex
 * @returns {{ uPoint: [string, string], vComponents: [string, string, string, string] }}
 */
export function computeFastVerifyParams(publicKey, proof, seedHex) {
  const { gamma, c, s } = proof;

  // Reconstruct public key point
  const PK = secp256k1.ProjectivePoint.fromAffine({
    x: BigInt(publicKey[0]),
    y: BigInt(publicKey[1]),
  });

  // U = s*G - c*PK
  const sG = G.multiply(s);
  const cPK = PK.multiply(c);
  const U = sG.add(cPK.negate());
  const uAffine = U.toAffine();

  // H = hashToCurve(publicKey, seed)
  const seedBytes = seedHex.startsWith('0x') ? seedHex : '0x' + seedHex;
  const H = hashToCurve(publicKey, seedBytes);

  // Gamma as point
  const gammaPoint = secp256k1.ProjectivePoint.fromAffine(gamma);

  // sH = s * H
  const sH = H.multiply(s);
  const sHAffine = sH.toAffine();

  // cGamma = c * Gamma
  const cGamma = gammaPoint.multiply(c);
  const cGammaAffine = cGamma.toAffine();

  return {
    uPoint: [
      '0x' + uAffine.x.toString(16).padStart(64, '0'),
      '0x' + uAffine.y.toString(16).padStart(64, '0'),
    ],
    vComponents: [
      '0x' + sHAffine.x.toString(16).padStart(64, '0'),
      '0x' + sHAffine.y.toString(16).padStart(64, '0'),
      '0x' + cGammaAffine.x.toString(16).padStart(64, '0'),
      '0x' + cGammaAffine.y.toString(16).padStart(64, '0'),
    ],
  };
}

/**
 * Encode the VRF envelope for progressLoop().
 * @param {{ gamma: {x: bigint, y: bigint}, c: bigint, s: bigint }} proof
 * @param {{ uPoint: [string, string], vComponents: [string, string, string, string] }} params
 * @param {string} gameDataHex - The original performData from shouldProgressLoop
 * @returns {string} ABI-encoded VRF envelope (hex)
 */
export function encodeVRFEnvelope(proof, params, gameDataHex) {
  const { gamma, c, s } = proof;

  const vrfVersion = 1;
  const proofArr = [gamma.x, gamma.y, c, s];
  const uPointArr = [BigInt(params.uPoint[0]), BigInt(params.uPoint[1])];
  const vComponentsArr = [
    BigInt(params.vComponents[0]),
    BigInt(params.vComponents[1]),
    BigInt(params.vComponents[2]),
    BigInt(params.vComponents[3]),
  ];

  return encodeAbiParameters(
    parseAbiParameters('uint8, uint256[4], uint256[2], uint256[4], bytes'),
    [vrfVersion, proofArr, uPointArr, vComponentsArr, gameDataHex]
  );
}

/**
 * Compute the deterministic seed matching AutoLoopVRFCompatible.computeSeed().
 * seed = abi.encodePacked(keccak256(abi.encodePacked(contractAddress, loopID)))
 * @param {string} contractAddress - The Gameplay contract address
 * @param {bigint|number} loopID - The current loop ID
 * @returns {string} The seed as hex bytes
 */
export function computeSeed(contractAddress, loopID) {
  const innerHash = keccak256(
    encodePacked(
      ['address', 'uint256'],
      [contractAddress, BigInt(loopID)]
    )
  );
  // computeSeed returns abi.encodePacked(keccak256(...)) which is just the 32 bytes
  return innerHash;
}

/**
 * Derive the public key from a private key.
 * @param {string} privateKeyHex - The private key as hex
 * @returns {{ x: string, y: string, address: string }}
 */
export function derivePublicKey(privateKeyHex) {
  const privKey = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const sk = BigInt('0x' + privKey);
  const PK = G.multiply(sk);
  const affine = PK.toAffine();
  return {
    x: '0x' + affine.x.toString(16).padStart(64, '0'),
    y: '0x' + affine.y.toString(16).padStart(64, '0'),
  };
}
