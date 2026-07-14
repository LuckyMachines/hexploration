import assert from 'node:assert/strict';
import {
  RETURN_API_CONTRACT_VERSION,
  RETURN_API_OPERATIONS,
  assertReturnApiContract,
} from '../app/src/lib/returnService.js';

const origin = String(process.env.RETURN_API_URL || 'https://return-api.xenovoya.com').replace(/\/$/, '');
if (!origin.startsWith('https://')) throw new Error('RETURN_API_URL must use HTTPS.');

const response = await fetch(`${origin}/openapi.json`, { signal: AbortSignal.timeout(10_000) });
assert.equal(response.status, 200, 'Return API contract endpoint must return 200.');
const result = assertReturnApiContract(await response.json());
assert.equal(result.version, RETURN_API_CONTRACT_VERSION);
assert.equal(result.operations, Object.keys(RETURN_API_OPERATIONS).length);

process.stdout.write(`${JSON.stringify({ ok: true, service: 'xenovoya-return-service', contractVersion: result.version, operations: result.operations })}\n`);
