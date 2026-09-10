import { describe, expect, it } from 'vitest';
import { attachBoardAssetRegistry, createBoardAssetRegistry } from './boardAssetRegistry';

describe('board asset registry', () => {
  it('records every terminal load state without erasing failures', () => {
    const manager = {};
    const registry = attachBoardAssetRegistry(manager, createBoardAssetRegistry());

    manager.onStart('/terrain.webp');
    manager.onProgress('/terrain.webp');
    manager.onStart('/missing.webp');
    manager.onError('/missing.webp');
    manager.onProgress('/missing.webp');

    expect(registry.snapshot()).toMatchObject({
      expected: 2,
      loaded: 1,
      failed: 1,
      loading: 0,
      failures: ['/missing.webp'],
    });
  });
});
