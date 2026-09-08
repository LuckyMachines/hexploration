const playUrl = process.env.XENOVOYA_PLAY_URL || 'https://play.xenovoya.com';
const rpcUrl = process.env.XENOVOYA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const expectedChainId = 11155111;
const failures = [];

async function check(label, task) {
  try {
    await task();
    process.stdout.write(`PASS ${label}\n`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    process.stdout.write(`FAIL ${label}: ${error.message}\n`);
  }
}

let homepageResponse;
let homepageHtml = '';

await check('player homepage', async () => {
  const response = await fetch(playUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  homepageResponse = response;
  homepageHtml = await response.text();
});

await check('live lobby CTA', async () => {
  if (!homepageHtml.includes('Enter live lobby')) throw new Error('new lobby CTA is not deployed');
});

await check('player CSP allows RPC', async () => {
  const csp = homepageResponse?.headers.get('content-security-policy') || '';
  const rpcOrigin = new URL(rpcUrl).origin;
  if (!csp.includes(rpcOrigin) && !csp.includes('https://*.publicnode.com')) {
    throw new Error(`CSP does not allow ${rpcOrigin}`);
  }
});

await check('release metadata', async () => {
  const response = await fetch(new URL('/release.json', playUrl));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const release = await response.json();
  if (release.environment !== 'production') throw new Error(`environment is ${release.environment || 'missing'}`);
  if (!/^[a-f0-9]{40}$/.test(release.release || '')) throw new Error('release SHA is missing or invalid');
});

await check('Sepolia RPC', async () => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const chainId = Number.parseInt(payload.result, 16);
  if (chainId !== expectedChainId) throw new Error(`expected ${expectedChainId}, received ${chainId}`);
});

if (failures.length) {
  process.stderr.write(`\nProduction verification failed (${failures.length}):\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('\nProduction verification passed.\n');
}
