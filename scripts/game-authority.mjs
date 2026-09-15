import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { RelayError } from './sponsor-relay-core.mjs';

const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const TOKEN_VERSION = 'g1';
const OPERATION_VERSION = 1;

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromB64url(value) {
  try { return Buffer.from(value, 'base64url'); } catch { throw new RelayError(401, 'invalid_session', 'Your play session is invalid'); }
}

function mac(secret, purpose, value) {
  return createHmac('sha256', secret).update(`${purpose}\0`).update(value).digest();
}

function safeEqual(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueAuthoritySession(config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({
    sid: randomBytes(24).toString('hex'),
    iat: nowSeconds,
    exp: nowSeconds + config.authoritySessionSeconds,
  }));
  const encoded = b64url(payload);
  const signature = b64url(mac(config.authoritySecret, 'session', encoded));
  return { token: `${TOKEN_VERSION}.${encoded}.${signature}`, expiresAt: new Date((nowSeconds + config.authoritySessionSeconds) * 1000).toISOString() };
}

export function verifyAuthoritySession(token, config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const [version, encoded, signature, extra] = String(token || '').split('.');
  if (version !== TOKEN_VERSION || !encoded || !signature || extra) throw new RelayError(401, 'invalid_session', 'Your play session is invalid');
  const expected = mac(config.authoritySecret, 'session', encoded);
  const actual = fromB64url(signature);
  if (!safeEqual(actual, expected)) throw new RelayError(401, 'invalid_session', 'Your play session is invalid');
  let payload;
  try { payload = JSON.parse(fromB64url(encoded).toString('utf8')); } catch { throw new RelayError(401, 'invalid_session', 'Your play session is invalid'); }
  if (!/^[0-9a-f]{48}$/.test(payload.sid || '') || !Number.isSafeInteger(payload.exp) || payload.exp < nowSeconds) {
    throw new RelayError(401, 'session_expired', 'Your play session has expired');
  }
  return payload;
}

export function authorityAccount(session, config) {
  const seed = mac(config.authoritySecret, 'player', session.sid);
  const scalar = (BigInt(`0x${seed.toString('hex')}`) % (CURVE_ORDER - 1n)) + 1n;
  return privateKeyToAccount(`0x${scalar.toString(16).padStart(64, '0')}`);
}

function operationKey(config) {
  return mac(config.authoritySecret, 'operation-key', 'xenovoya').subarray(0, 32);
}

export function sealOperation(hash, config) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', operationKey(config), iv);
  const encrypted = Buffer.concat([cipher.update(String(hash), 'utf8'), cipher.final()]);
  return `${TOKEN_VERSION}_${b64url(Buffer.concat([iv, cipher.getAuthTag(), encrypted]))}`;
}

export function openOperation(operationId, config) {
  if (!String(operationId || '').startsWith(`${TOKEN_VERSION}_`)) throw new RelayError(400, 'invalid_operation', 'Operation reference is invalid');
  const packed = fromB64url(String(operationId).slice(3));
  if (packed.length < 29) throw new RelayError(400, 'invalid_operation', 'Operation reference is invalid');
  try {
    const decipher = createDecipheriv('aes-256-gcm', operationKey(config), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    throw new RelayError(400, 'invalid_operation', 'Operation reference is invalid');
  }
}

export function bearerSession(req, config) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new RelayError(401, 'session_required', 'Start or restore a play session first');
  return verifyAuthoritySession(token, config);
}
