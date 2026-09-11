import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production security headers', () => {
  it('allow the configured Sepolia data path and analytics beacon', () => {
    const headers = readFileSync(resolve(process.cwd(), 'public', '_headers'), 'utf8');

    expect(headers).toContain('https://ethereum-sepolia-rpc.publicnode.com');
    expect(headers).toContain('https://static.cloudflareinsights.com');
    expect(headers).toContain('https://cloudflareinsights.com');
  });

  it('allows same-origin blob workers required by the production 3D texture decoder', () => {
    const headers = readFileSync(resolve(process.cwd(), 'public', '_headers'), 'utf8');

    expect(headers).toContain("worker-src 'self' blob:");
    expect(headers).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(headers).not.toContain("script-src 'self' 'unsafe-eval'");
  });
});
