import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production security headers', () => {
  it('allows only the managed game service and analytics beacons', () => {
    const headers = readFileSync(resolve(process.cwd(), 'public', '_headers'), 'utf8');

    expect(headers).toContain('https://return-api.xenovoya.com');
    expect(headers).not.toContain('ethereum-sepolia-rpc');
    expect(headers).toContain('https://static.cloudflareinsights.com');
    expect(headers).toContain('https://cloudflareinsights.com');
  });

  it('keeps production scripts free of eval permissions', () => {
    const headers = readFileSync(resolve(process.cwd(), 'public', '_headers'), 'utf8');

    expect(headers).not.toContain("'wasm-unsafe-eval'");
    expect(headers).not.toContain("'unsafe-eval'");
  });
});
