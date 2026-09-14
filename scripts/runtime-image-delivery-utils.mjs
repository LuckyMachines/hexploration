import path from 'node:path';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function validateRuntimeImageManifest(manifest) {
  const failures = [];
  if (manifest?.schemaVersion !== 1) failures.push('schemaVersion must be 1');
  if (!Array.isArray(manifest?.assets) || manifest.assets.length === 0) failures.push('assets must be a non-empty array');
  const ids = new Set();
  const outputs = new Set();
  for (const [index, asset] of (manifest?.assets || []).entries()) {
    const prefix = asset?.id || `asset[${index}]`;
    if (!asset?.id || ids.has(asset.id)) failures.push(`${prefix}: id must be unique`);
    ids.add(asset?.id);
    const source = String(asset?.source || '').replaceAll('\\', '/');
    const output = String(asset?.output || '').replaceAll('\\', '/');
    if (!source.startsWith('app/public/images/art/') || !source.endsWith('.png') || source.includes('../')) {
      failures.push(`${prefix}: source must be a repository art PNG`);
    }
    if (!output.startsWith('app/public/images/art/') || !output.endsWith('.runtime.webp') || output.includes('../')) {
      failures.push(`${prefix}: output must be a repository runtime WebP`);
    }
    if (path.posix.dirname(source) !== path.posix.dirname(output)) failures.push(`${prefix}: source and output must share a directory`);
    if (outputs.has(output)) failures.push(`${prefix}: output must be unique`);
    outputs.add(output);
    if (!(asset?.maxByteRatio > 0 && asset.maxByteRatio < 1)) failures.push(`${prefix}: maxByteRatio must be between 0 and 1`);
    if (asset?.sourceSha256 != null && !SHA256_PATTERN.test(asset.sourceSha256)) failures.push(`${prefix}: sourceSha256 is invalid`);
    if (asset?.outputSha256 != null && !SHA256_PATTERN.test(asset.outputSha256)) failures.push(`${prefix}: outputSha256 is invalid`);
  }
  return failures;
}

export function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('invalid PNG signature');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('invalid WebP signature');
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && data + 10 <= buffer.length) {
      return { width: 1 + buffer.readUIntLE(data + 4, 3), height: 1 + buffer.readUIntLE(data + 7, 3) };
    }
    if (type === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    if (type === 'VP8 ' && data + 10 <= buffer.length && buffer.toString('hex', data + 3, data + 6) === '9d012a') {
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff };
    }
    offset = data + size + (size % 2);
  }
  throw new Error('WebP dimensions are unavailable');
}

export function assessRuntimeImage({ asset, sourceBuffer, outputBuffer, sourceSha256, outputSha256 }) {
  const failures = [];
  const sourceSize = pngDimensions(sourceBuffer);
  const outputSize = webpDimensions(outputBuffer);
  const byteRatio = outputBuffer.length / sourceBuffer.length;
  if (sourceSize.width !== outputSize.width || sourceSize.height !== outputSize.height) failures.push('dimensions changed');
  if (byteRatio > asset.maxByteRatio) failures.push(`byte ratio ${byteRatio.toFixed(3)} exceeds ${asset.maxByteRatio}`);
  if (asset.sourceSha256 && asset.sourceSha256 !== sourceSha256) failures.push('source fingerprint drifted');
  if (asset.outputSha256 && asset.outputSha256 !== outputSha256) failures.push('output fingerprint drifted');
  return { failures, sourceSize, outputSize, byteRatio, sourceBytes: sourceBuffer.length, outputBytes: outputBuffer.length };
}
