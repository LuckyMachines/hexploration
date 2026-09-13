const playUrl = process.env.XENOVOYA_PLAY_URL || 'https://play.xenovoya.com';
const rpcUrl = process.env.XENOVOYA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const returnApiUrl = process.env.XENOVOYA_RETURN_API_URL || 'https://return-api.xenovoya.com';
const sponsorRelayUrl = process.env.XENOVOYA_SPONSOR_RELAY_URL || '';
const expectedRelease = process.env.XENOVOYA_EXPECTED_RELEASE_SHA || '';
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
let playerBundle = '';

await check('player homepage', async () => {
  const response = await fetch(playUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  homepageResponse = response;
  homepageHtml = await response.text();
});

await check('player-facing bundle', async () => {
  const sources = [...homepageHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
  if (!sources.length) throw new Error('no JavaScript entry bundle found');
  const responses = await Promise.all(sources.map(async (source) => {
    const response = await fetch(new URL(source, playUrl));
    if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
    return response.text();
  }));
  playerBundle = responses.join('\n');
  if (!playerBundle.includes('Choose your expedition')) throw new Error('current play selector is not deployed');
  if (!playerBundle.includes('Play solo')) throw new Error('wallet-free solo path is not deployed');
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
  if (expectedRelease && release.release !== expectedRelease) throw new Error(`expected ${expectedRelease}, received ${release.release}`);
  process.stdout.write(`INFO deployed release ${release.release}\n`);
});

await check('return API readiness', async () => {
  const response = await fetch(new URL('/ready', returnApiUrl));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.text();
  if (!body.trim()) throw new Error('empty readiness response');
});

if (sponsorRelayUrl) {
  await check('sponsor relay scope', async () => {
    const response = await fetch(new URL('/v1/sponsor/config', sponsorRelayUrl));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.chainId || !payload.forwarderAddress || !payload.boardAddress) throw new Error('relay scope is incomplete');
    if (payload.paused) throw new Error('relay is paused');
  });
} else {
  process.stdout.write('SKIP sponsor relay scope: set XENOVOYA_SPONSOR_RELAY_URL to verify\n');
}

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
