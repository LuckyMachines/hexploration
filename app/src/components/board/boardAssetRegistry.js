function normalizedUrl(url = '') {
  try {
    return new URL(String(url), window.location.href).pathname;
  } catch {
    return String(url).split('?')[0];
  }
}

export function createBoardAssetRegistry() {
  const entries = new Map();

  const ensure = (url) => {
    const key = normalizedUrl(url);
    if (!entries.has(key)) entries.set(key, { url: key, status: 'expected', bytes: 0 });
    return entries.get(key);
  };

  const transferredBytes = (url) => {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') return 0;
    const absolute = new URL(url, window.location.href).href;
    const matches = [...performance.getEntriesByName(absolute), ...performance.getEntriesByName(url)];
    return Math.max(0, ...matches.map((entry) => Number(entry.transferSize || entry.encodedBodySize || 0)));
  };

  return {
    expect(url) {
      ensure(url);
    },
    start(url) {
      ensure(url).status = 'loading';
    },
    complete(url) {
      const entry = ensure(url);
      if (entry.status === 'failed') return;
      entry.status = 'loaded';
      entry.bytes = transferredBytes(url);
    },
    fail(url) {
      ensure(url).status = 'failed';
    },
    snapshot() {
      const assets = [...entries.values()];
      return Object.freeze({
        expected: assets.length,
        loaded: assets.filter((entry) => entry.status === 'loaded').length,
        failed: assets.filter((entry) => entry.status === 'failed').length,
        loading: assets.filter((entry) => entry.status === 'loading').length,
        transferredBytes: assets.reduce((sum, entry) => sum + entry.bytes, 0),
        failures: assets.filter((entry) => entry.status === 'failed').map((entry) => entry.url),
      });
    },
  };
}

export function attachBoardAssetRegistry(loadingManager, registry) {
  loadingManager.onStart = (url) => registry.start(url);
  loadingManager.onProgress = (url) => registry.complete(url);
  loadingManager.onError = (url) => registry.fail(url);
  return registry;
}
