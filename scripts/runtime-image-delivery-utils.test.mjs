import assert from 'node:assert/strict';
import test from 'node:test';
import { assessRuntimeImage, pngDimensions, validateRuntimeImageManifest, webpDimensions } from './runtime-image-delivery-utils.mjs';

function png(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function losslessWebp(width, height, bytes = 64) {
  const buffer = Buffer.alloc(bytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(bytes - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8L', 12, 'ascii');
  buffer.writeUInt32LE(bytes - 20, 16);
  buffer[20] = 0x2f;
  buffer.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return buffer;
}

test('validates safe one-to-one PNG to runtime WebP contracts', () => {
  assert.deepEqual(validateRuntimeImageManifest({
    schemaVersion: 1,
    assets: [{ id: 'hero', source: 'app/public/images/art/characters/hero.png', output: 'app/public/images/art/characters/hero.runtime.webp', maxByteRatio: 0.7 }],
  }), []);
});

test('rejects traversal, duplicate output, and non-compressing contracts', () => {
  const failures = validateRuntimeImageManifest({
    schemaVersion: 1,
    assets: [
      { id: 'a', source: '../a.png', output: 'app/public/images/art/a.runtime.webp', maxByteRatio: 1 },
      { id: 'b', source: 'app/public/images/art/b.png', output: 'app/public/images/art/a.runtime.webp', maxByteRatio: 0.7 },
    ],
  });
  assert.ok(failures.length >= 3);
});

test('reads PNG and lossless WebP dimensions', () => {
  assert.deepEqual(pngDimensions(png(512, 768)), { width: 512, height: 768 });
  assert.deepEqual(webpDimensions(losslessWebp(512, 768)), { width: 512, height: 768 });
});

test('rejects dimension drift, weak compression, and fingerprint drift', () => {
  const source = png(64, 64);
  const output = losslessWebp(32, 64, 48);
  const result = assessRuntimeImage({
    asset: { maxByteRatio: 0.5, sourceSha256: 'a'.repeat(64), outputSha256: 'b'.repeat(64) },
    sourceBuffer: source,
    outputBuffer: output,
    sourceSha256: 'c'.repeat(64),
    outputSha256: 'd'.repeat(64),
  });
  assert.deepEqual(result.failures, ['dimensions changed', 'byte ratio 2.000 exceeds 0.5', 'source fingerprint drifted', 'output fingerprint drifted']);
});
