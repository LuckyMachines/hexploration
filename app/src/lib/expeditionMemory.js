export const EXPEDITION_MEMORY_STORAGE_KEY = 'xenovoya:expedition-memory:v1';
export const EXPEDITION_MEMORY_SCHEMA_VERSION = 1;
export const MAX_EXPEDITION_MEMORIES = 40;

export const EMPTY_EXPEDITION_MEMORY = {
  schemaVersion: EXPEDITION_MEMORY_SCHEMA_VERSION,
  entries: [],
  badges: [],
  updatedAt: null,
};

function nowIso() {
  return new Date().toISOString();
}

function hash(value) {
  let h = 2166136261;
  for (const char of String(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function clamp(value, min = 0, max = 9999) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function unique(values = []) {
  return [...new Set(safeArray(values))];
}

function canonicalFingerprint(fingerprint = null) {
  if (!fingerprint) return null;
  return {
    id: String(fingerprint.id || '').slice(0, 80),
    title: String(fingerprint.title || 'Run Fingerprint').slice(0, 80),
    subtitle: String(fingerprint.subtitle || '').slice(0, 160),
    trigger: String(fingerprint.trigger || '').slice(0, 48),
    routeShape: String(fingerprint.routeShape || '').slice(0, 64),
    temptation: String(fingerprint.temptation || '').slice(0, 80),
    danger: String(fingerprint.danger || '').slice(0, 80),
    replayHook: String(fingerprint.replayHook || '').slice(0, 180),
    beatTarget: String(fingerprint.beatTarget || '').slice(0, 160),
    tone: String(fingerprint.tone || 'compass').slice(0, 32),
    createdTurn: clamp(fingerprint.createdTurn, 0, 99),
  };
}

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window !== 'undefined') return window.localStorage;
  return null;
}

function outcomeLabel(outcome = '') {
  if (outcome === 'escaped') return 'Escaped';
  if (outcome === 'collapsed') return 'Crew Collapsed';
  if (outcome === 'lost') return 'Lost';
  if (outcome === 'stranded-with-artifact') return 'Stranded With Value';
  if (String(outcome).includes('route-collapsed')) return 'Route Collapsed';
  return outcome || 'Complete';
}

export function canonicalEntry(entry = {}) {
  const badges = unique(entry.badges);
  const score = clamp(entry.score);
  const timestamp = entry.timestamp || nowIso();
  const title = String(entry.title || 'Expedition Memory').slice(0, 80);
  const outcome = String(entry.outcome || 'complete');
  const id = entry.id || `mem-${hash([
    entry.source || 'unknown',
    entry.sourceId || '',
    entry.scenarioId || '',
    entry.seed || '',
    outcome,
    entry.turns || '',
    timestamp.slice(0, 10),
  ].join('|'))}`;
  return {
    id,
    schemaVersion: EXPEDITION_MEMORY_SCHEMA_VERSION,
    source: entry.source || 'public-run',
    sourceId: String(entry.sourceId || entry.scenarioId || entry.gameId || 'unknown'),
    title,
    scenarioId: entry.scenarioId || null,
    scenarioName: entry.scenarioName || 'Xenovoya Expedition',
    seed: entry.seed || null,
    outcome,
    outcomeLabel: entry.outcomeLabel || outcomeLabel(outcome),
    score,
    arcScore: clamp(entry.arcScore, 0, 100),
    challengeScore: clamp(entry.challengeScore),
    arcLabel: entry.arcLabel || entry.arcShape || 'Run Arc',
    arcShape: entry.arcShape || null,
    finalPressure: clamp(entry.finalPressure, 0, 100),
    escapeCostLevel: entry.escapeCostLevel || 'unknown',
    escapeCostLabel: entry.escapeCostLabel || 'Unknown',
    artifacts: clamp(entry.artifacts, 0, 99),
    artifactNames: unique(entry.artifactNames),
    turns: clamp(entry.turns, 0, 99),
    survivors: clamp(entry.survivors, 0, 12),
    crew: clamp(entry.crew, 0, 12),
    bestMoment: entry.bestMoment || null,
    bestMomentLabel: entry.bestMomentLabel || entry.bestMoment?.title || entry.bestMoment?.momentTitle || null,
    fingerprint: canonicalFingerprint(entry.fingerprint),
    replayPath: entry.replayPath || null,
    reportPath: entry.reportPath || null,
    proofCount: clamp(entry.proofCount, 0, 99),
    badges,
    insight: entry.insight || deriveMemoryInsight(entry),
    timestamp,
  };
}

export function scoreExpeditionMemory(entry = {}) {
  const escaped = entry.outcome === 'escaped' ? 520 : 0;
  const clean = entry.escapeCostLevel === 'clean' ? 95 : 0;
  const costlyPenalty = ['artifact-risk', 'crew-risk', 'route-collapse'].includes(entry.escapeCostLevel) ? 60 : 0;
  const crewRate = entry.crew ? entry.survivors / entry.crew : entry.survivors > 0 ? 1 : 0;
  const routeControl = Math.max(0, 100 - (entry.finalPressure || 0));
  const moment = entry.bestMoment || {};
  return clamp(
    escaped
    + (entry.artifacts || 0) * 115
    + crewRate * 130
    + (entry.arcScore || 0) * 2.2
    + routeControl * 1.15
    + (entry.proofCount || 0) * 10
    + (moment.score || moment.lifePulse || 0) * 0.7
    + clean
    - costlyPenalty,
  );
}

export function badgesForMemory(entry = {}) {
  const badges = [...safeArray(entry.badges)];
  if (entry.outcome === 'escaped') badges.push('Escaped');
  if (entry.escapeCostLevel === 'clean') badges.push('Clean Departure');
  if (entry.escapeCostLevel === 'close') badges.push('Close Departure');
  if (entry.escapeCostLevel === 'artifact-risk') badges.push('Value At Risk');
  if (entry.escapeCostLevel === 'crew-risk') badges.push('Crew At Risk');
  if (entry.escapeCostLevel === 'route-collapse' || String(entry.outcome).includes('route-collapsed')) badges.push('Stayed Too Long');
  if ((entry.finalPressure || 0) >= 75 && entry.outcome === 'escaped') badges.push('Redline Survivor');
  if (entry.arcLabel === 'Final Call' || entry.arcShape === 'final-call') badges.push('Final Call');
  if ((entry.artifacts || 0) > 0) badges.push('Artifact Lift');
  if (entry.crew > 1 && entry.survivors >= entry.crew) badges.push('Everybody Out');
  if (entry.crew > 0 && entry.survivors === 0) badges.push('No One Returned');
  if (safeArray(entry.badges).some((badge) => /cost|route save|route stabilized/i.test(badge))) badges.push('Cost Counterplay');
  return unique(badges).slice(0, 8);
}

export function deriveMemoryInsight(entry = {}) {
  if (!entry) return 'Finish an expedition to create a benchmark.';
  if (entry.fingerprint?.title && entry.fingerprint?.replayHook) return `${entry.fingerprint.title}: ${entry.fingerprint.replayHook}`;
  if (entry.outcome !== 'escaped') {
    if (entry.artifacts > 0) return 'The last run found value, but the memory asks you to bring it home.';
    return 'The last run ended as a warning; the next one starts with a clearer escape target.';
  }
  if (entry.escapeCostLevel === 'clean') return 'The last run proved a clean departure is possible. Now the benchmark is value or speed.';
  if ((entry.finalPressure || 0) >= 75) return 'The last run escaped at redline. The next benchmark is lowering the cost before lift-off.';
  if (entry.artifacts <= 0) return 'The crew got out, but the record is asking for something worth carrying.';
  return 'This memory is a real benchmark: beat the score, improve the cost, or bring more value home.';
}

export function memoryFromGameOver({
  gameId = '',
  players = [],
  finalPressure = {},
  finalEscapeCost = {},
  finalArc = {},
  replayProof = [],
  reportPath = '',
  events = [],
} = {}) {
  const crew = players.length;
  const survivors = players.filter((player) => player?.isActive).length;
  const recoveredValue = clamp(finalPressure.recoveredValue, 0, 99);
  const outcome = survivors > 0 ? 'escaped' : recoveredValue > 0 ? 'route-collapsed-with-value' : 'collapsed';
  const base = {
    source: 'live-expedition',
    sourceId: `game-${gameId}`,
    scenarioId: `live-${gameId || 'expedition'}`,
    scenarioName: `Live Expedition #${gameId || 'unknown'}`,
    title: finalArc?.id === 'final-call'
      ? 'The Final Call Record'
      : survivors > 0
        ? 'Live Departure Record'
        : 'Live Expedition Warning',
    outcome,
    arcScore: finalArc?.score || finalArc?.priority || 0,
    challengeScore: 0,
    arcLabel: finalArc?.label || 'Run Arc',
    arcShape: finalArc?.id || null,
    finalPressure: finalPressure?.pressure || 0,
    escapeCostLevel: finalEscapeCost?.level || finalEscapeCost?.costType || 'unknown',
    escapeCostLabel: finalEscapeCost?.label || finalEscapeCost?.reportLabel || 'Unknown',
    artifacts: recoveredValue,
    artifactNames: recoveredValue > 0 ? [`Recovered value ${recoveredValue}`] : [],
    turns: events.length,
    survivors,
    crew,
    bestMoment: finalArc?.directive ? { title: finalArc.label, score: finalArc.priority || 0, text: finalArc.directive } : null,
    bestMomentLabel: finalArc?.label || null,
    reportPath,
    proofCount: replayProof.length,
    badges: finalArc?.id ? [finalArc.label] : [],
    timestamp: nowIso(),
  };
  const score = scoreExpeditionMemory(base);
  const entry = canonicalEntry({ ...base, score, badges: badgesForMemory({ ...base, score }) });
  return { ...entry, insight: deriveMemoryInsight(entry) };
}

export function normalizeExpeditionMemory(memory = {}) {
  const entries = safeArray(memory.entries).map(canonicalEntry);
  const badges = unique([...safeArray(memory.badges), ...entries.flatMap((entry) => entry.badges)]).sort();
  return {
    schemaVersion: EXPEDITION_MEMORY_SCHEMA_VERSION,
    entries: rankMemories(entries).slice(0, MAX_EXPEDITION_MEMORIES),
    badges,
    updatedAt: memory.updatedAt || entries[0]?.timestamp || null,
  };
}

export function loadExpeditionMemory(storage) {
  const target = getStorage(storage);
  if (!target) return { ...EMPTY_EXPEDITION_MEMORY };
  try {
    const raw = target.getItem(EXPEDITION_MEMORY_STORAGE_KEY);
    if (!raw) return { ...EMPTY_EXPEDITION_MEMORY };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== EXPEDITION_MEMORY_SCHEMA_VERSION) return { ...EMPTY_EXPEDITION_MEMORY };
    return normalizeExpeditionMemory(parsed);
  } catch {
    return { ...EMPTY_EXPEDITION_MEMORY };
  }
}

export function saveExpeditionMemory(memory, storage) {
  const target = getStorage(storage);
  const normalized = normalizeExpeditionMemory({ ...memory, updatedAt: nowIso() });
  if (target) target.setItem(EXPEDITION_MEMORY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function rankMemories(entries = []) {
  return [...safeArray(entries)].sort((a, b) => {
    const scoreDelta = (b.score || 0) - (a.score || 0);
    if (scoreDelta) return scoreDelta;
    return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
  });
}

export function latestMemory(entries = []) {
  return [...safeArray(entries)].sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))[0] || null;
}

export function bestMemoryForCategory(memory = {}, category = 'overall') {
  const entries = safeArray(memory.entries);
  if (category === 'clean') return rankMemories(entries.filter((entry) => entry.escapeCostLevel === 'clean'))[0] || null;
  if (category === 'redline') return rankMemories(entries.filter((entry) => entry.finalPressure >= 75 && entry.outcome === 'escaped'))[0] || null;
  if (category === 'value') return [...entries].sort((a, b) => (b.artifacts || 0) - (a.artifacts || 0) || (b.score || 0) - (a.score || 0))[0] || null;
  if (category === 'latest') return latestMemory(entries);
  return rankMemories(entries)[0] || null;
}

export function recordExpeditionMemory(entry, storage) {
  const memory = loadExpeditionMemory(storage);
  const canonical = canonicalEntry({ ...entry, badges: badgesForMemory(entry), insight: entry.insight || deriveMemoryInsight(entry) });
  const nextEntries = [canonical, ...memory.entries.filter((item) => item.id !== canonical.id)];
  return saveExpeditionMemory({
    ...memory,
    entries: nextEntries,
    badges: unique([...memory.badges, ...canonical.badges]).sort(),
  }, storage);
}

export function memoryStats(memory = {}) {
  const entries = safeArray(memory.entries);
  const latest = latestMemory(entries);
  const best = bestMemoryForCategory({ entries }, 'overall');
  const cleanBest = bestMemoryForCategory({ entries }, 'clean');
  const valueBest = bestMemoryForCategory({ entries }, 'value');
  const redlineBest = bestMemoryForCategory({ entries }, 'redline');
  const escapes = entries.filter((entry) => entry.outcome === 'escaped').length;
  return {
    total: entries.length,
    escapes,
    escapeRate: entries.length ? Math.round((escapes / entries.length) * 100) : 0,
    bestScore: best?.score || 0,
    best,
    latest,
    cleanBest,
    valueBest,
    redlineBest,
    badges: unique(memory.badges || entries.flatMap((entry) => entry.badges)).sort(),
    artifactTotal: entries.reduce((sum, entry) => sum + (entry.artifacts || 0), 0),
  };
}

export function summarizeExpeditionMemory(memory = {}) {
  const stats = memoryStats(memory);
  if (!stats.total) {
    return {
      headline: 'No expedition memory yet',
      body: 'Finish a run to create a benchmark, badges, and the next challenge.',
      stats,
    };
  }
  return {
    headline: `${stats.total} memor${stats.total === 1 ? 'y' : 'ies'} recorded`,
    body: `Best score ${stats.bestScore}. ${stats.escapes} escape${stats.escapes === 1 ? '' : 's'} logged. ${stats.badges.length} badge${stats.badges.length === 1 ? '' : 's'} unlocked.`,
    stats,
  };
}
