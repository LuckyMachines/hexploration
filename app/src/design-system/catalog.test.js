import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coverageRegistry } from './catalog';
import { tokenContract } from './tokens';

describe('design-system evidence contract', () => {
  it('keeps every pattern unique, owned, sourced, and reviewed', () => {
    const names = coverageRegistry.map(([, pattern]) => pattern);
    expect(new Set(names).size).toBe(names.length);

    for (const [family, pattern, states, maturity, evidence] of coverageRegistry) {
      expect(family).toBeTruthy();
      expect(pattern).toBeTruthy();
      expect(states.length).toBeGreaterThanOrEqual(12);
      expect(['Proven', 'Verified', 'Audit', 'Prototype']).toContain(maturity);
      expect(evidence.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(existsSync(resolve(process.cwd(), evidence.source))).toBe(true);
      for (const proof of evidence.evidence) expect(existsSync(resolve(process.cwd(), proof))).toBe(true);
    }
  });

  it('only calls patterns proven when component and browser evidence both exist', () => {
    for (const [, , , maturity, evidence] of coverageRegistry) {
      if (maturity !== 'Proven') continue;
      expect(evidence.evidence.some((path) => path.includes('.test.'))).toBe(true);
      expect(evidence.evidence.some((path) => path.startsWith('e2e/'))).toBe(true);
    }
  });

  it('keeps every documented runtime token in the stylesheet contract', () => {
    const stylesheet = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    for (const token of Object.values(tokenContract).flat()) expect(stylesheet).toContain(token);
  });
});
