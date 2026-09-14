import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(repoRoot, 'app', 'node_modules', 'playwright'));
const args = process.argv.slice(2);
const valueArg = (name, fallback) => {
  const match = args.find((value) => value.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
};
const baseUrl = valueArg('base-url', 'http://127.0.0.1:11134').replace(/\/$/, '');
const write = args.includes('--write');
const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'app', 'src', 'art-pipeline', 'runtime-image-delivery.json'), 'utf8'));
const deliveryByUrl = new Map(manifest.assets.map((asset) => [
  `/${asset.output.replace(/^app\/public\//, '')}`,
  asset,
]));

const browser = await chromium.launch({ headless: true });
const routes = [];
try {
  for (const route of ['/', '/guest']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => ({
      path: new URL(entry.name).pathname,
      transferBytes: entry.transferSize,
    })));
    const observedBytes = resources.reduce((sum, resource) => sum + resource.transferBytes, 0);
    const delivered = resources.map((resource) => ({ ...resource, asset: deliveryByUrl.get(resource.path) })).filter((resource) => resource.asset);
    const projectedPngBytes = observedBytes + delivered.reduce((sum, resource) => sum + resource.asset.sourceBytes - resource.asset.outputBytes, 0);
    routes.push({
      route,
      observedBytes,
      projectedCanonicalPngBytes: projectedPngBytes,
      savedBytes: projectedPngBytes - observedBytes,
      reductionRatio: projectedPngBytes ? (projectedPngBytes - observedBytes) / projectedPngBytes : 0,
      optimizedAssetsLoaded: delivered.map((resource) => resource.asset.id),
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  baseUrl,
  environment: 'verified local production build served without compression',
  encoding: manifest.encoding,
  routes,
};
const outputPath = path.join(repoRoot, 'reports', 'performance', 'runtime-image-delivery.json');
if (write) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ outputPath: write ? outputPath : null, ...report }, null, 2));
