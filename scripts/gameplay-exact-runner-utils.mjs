import { createHash } from 'crypto';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function canonicalScenarioSignature({ scenario, batch, sourceHashes = {} }) {
  const payload = JSON.stringify({
    scenario,
    batch: Number(batch),
    sourceHashes: Object.fromEntries(Object.entries(sourceHashes).sort(([a], [b]) => a.localeCompare(b))),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function buildExactRunPlan(store = {}, {
  scenarioId = null,
  batch = 10,
  sourceHashes = {},
  checkpoint = {},
  includeRegressions = false,
  regressionsOnly = false,
} = {}) {
  return asArray(store.scenarios)
    .filter((scenario) => !scenario.archived)
    .filter((scenario) => regressionsOnly
      ? scenario.testFixture === true
      : (includeRegressions || (scenario.productionEligible !== false && scenario.testFixture !== true)))
    .filter((scenario) => !scenarioId || scenario.id === scenarioId)
    .map((scenario) => {
      const signature = canonicalScenarioSignature({ scenario, batch, sourceHashes });
      const prior = checkpoint.scenarios?.[scenario.id];
      return {
        scenario,
        signature,
        cached: prior?.status === 'passed' && prior.signature === signature,
      };
    });
}

export function classifyExactRunFailure({ status, stderr = '', stdout = '' } = {}) {
  const message = `${stderr}\n${stdout}`.toLowerCase();
  const infrastructure = status === null
    || /econnrefused|rpc is not reachable|http request failed|fetch failed|connection reset|timed out|port .* in use|spawn|deployment|memory allocation|exited unexpectedly|anvil/.test(message);
  return {
    category: infrastructure ? 'infrastructure' : 'gameplay-or-contract',
    retryable: infrastructure,
  };
}

export function candidatePorts(preferred = null, count = 20) {
  const parsed = Number(preferred);
  const first = Number.isInteger(parsed) && parsed > 1024 && parsed < 65535
    ? parsed
    : 11_000 + Math.floor(Math.random() * 8_000);
  return Array.from({ length: count }, (_, index) => first + index).filter((port) => port < 65535);
}
