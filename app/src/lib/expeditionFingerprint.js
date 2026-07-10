const TITLE_BANKS = {
  artifact: ['Glass Trail', 'Relic Weather', 'Bright Hazard', 'Amber Lift'],
  pressure: ['Closing Path', 'Signal Scar', 'Redline Spur', 'False Safe Route'],
  reveal: ['First Light Corridor', 'Blue Fog Gate', 'Hidden Return', 'Survey Scar'],
  route: ['Long Return', 'Low Fuel Map', 'Stable Loop', 'Risky Spur'],
};

const SUBTITLES = {
  artifact: [
    'A relic-rich opening with an expensive way home.',
    'A fast payoff that asks whether value is worth the route cost.',
  ],
  pressure: [
    'A promising route already starting to close behind the crew.',
    'A tense opening where delay becomes the real hazard.',
  ],
  reveal: [
    'A first reveal that gives this seed a route problem to solve.',
    'A new map shape with enough danger to remember.',
  ],
  route: [
    'A safe-looking start that still needs a clean departure.',
    'A route shape that becomes a benchmark once the crew turns back.',
  ],
};

function hash(value) {
  let h = 2166136261;
  for (const char of String(value || '')) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list = [], key = '') {
  if (!list.length) return '';
  return list[hash(key) % list.length];
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function artifactCount(state = {}) {
  return Array.isArray(state.artifacts) ? state.artifacts.length : Number(state.artifacts || 0);
}

function fingerprintType({ run = {}, event = {} } = {}) {
  const delta = event.delta || {};
  const after = event.after || run.state || {};
  if (event.discoveredArtifact || artifactCount(after) > artifactCount(event.before || {})) return 'artifact';
  if ((after.departPressure || 0) >= 58 || (delta.departPressure || 0) >= 12 || (after.danger || 0) >= 68) return 'pressure';
  if ((delta.revealed || 0) > 0 || event.tileTrait?.category === 'reveal') return 'reveal';
  if ((event.turn || run.turn || 0) >= 2) return 'route';
  return null;
}

function triggerFor(type, event = {}) {
  if (type === 'artifact') return event.discoveredArtifact ? 'artifact-pickup' : 'early-value';
  if (type === 'pressure') return 'pressure-spike';
  if (type === 'reveal') return 'first-reveal';
  return 'turn-two-route';
}

function routeShapeFor({ after = {}, event = {} } = {}) {
  const distance = Number(after.distance || 0);
  const pressure = Number(after.departPressure || after.danger || 0);
  const stability = Number(after.routeStability ?? 100 - pressure);
  if (pressure >= 68) return 'Closing Corridor';
  if (distance >= 4) return 'Long Return';
  if (distance <= 1 && artifactCount(after) > 0) return 'Short Return';
  if (stability >= 70) return 'Stable Loop';
  if (event.action === 'move' && (event.delta?.revealed || 0) > 0) return 'Risky Spur';
  return 'Split Route';
}

function temptationFor({ after = {}, event = {} } = {}) {
  if (event.discoveredArtifact) return 'Fast artifact pickup';
  if (artifactCount(after) > 0 && Number(after.distance || 0) > 1) return 'One more safe-looking step';
  if (event.tileTrait?.category === 'value') return 'Early relic signal';
  if (event.action === 'dig') return 'One more dig';
  if (event.action === 'rest' || event.action === 'help') return 'Crew recovery window';
  if (Number(after.distance || 0) <= 1) return 'Clean exit chance';
  return 'Safe extra reveal';
}

function dangerFor({ after = {}, event = {} } = {}) {
  const pressure = Number(after.departPressure || after.danger || 0);
  if (pressure >= 75) return 'Collapse warning';
  if (pressure >= 55) return 'Pressure climbing';
  if ((after.routeStability || 100) <= 45) return 'Route weakening';
  if (event.tileTrait?.warning) return 'Hazard near route';
  if ((after.morale || 100) <= 40) return 'Crew fatigue';
  return 'False calm';
}

function replayHookFor({ type, after = {} } = {}) {
  const pressure = clamp(after.departPressure || after.danger || 0);
  if (type === 'artifact') return 'Replay this seed and escape with the value under lower pressure.';
  if (type === 'pressure') return `Beat this opening by leaving before pressure reaches ${Math.max(35, pressure - 8)}.`;
  if (type === 'reveal') return 'Try a rival route through the same first reveal.';
  return 'Replay for a cleaner exit and fewer wasted turns.';
}

function beatTargetFor({ type, after = {}, event = {} } = {}) {
  const pressure = clamp(after.departPressure || after.danger || 0);
  if (type === 'artifact') return `Escape with ${artifactCount(after)} value and pressure below ${Math.max(25, pressure - 10)}.`;
  if (type === 'pressure') return `Reach departure before pressure crosses ${Math.max(35, pressure - 8)}.`;
  if (event.turn <= 2) return `Beat this seed in fewer than ${Math.max(3, (event.turn || 1) + 3)} turns.`;
  return 'Finish with a cleaner departure record.';
}

function toneFor(type) {
  return {
    artifact: 'compass',
    pressure: 'signal',
    reveal: 'blueprint',
    route: 'oxide',
  }[type] || 'compass';
}

export function buildExpeditionFingerprint({ run = {}, event = {} } = {}) {
  if (run.fingerprint) return run.fingerprint;
  const type = fingerprintType({ run, event });
  if (!type) return null;
  const after = event.after || run.state || {};
  const key = `${run.seed}|${run.scenario?.id}|${event.turn}|${type}|${after.departPressure}|${after.distance}|${artifactCount(after)}`;
  const title = pick(TITLE_BANKS[type], key);
  return {
    schemaVersion: 1,
    id: `fingerprint-${hash(key).toString(36)}`,
    title,
    subtitle: pick(SUBTITLES[type], `${key}|subtitle`),
    trigger: triggerFor(type, event),
    routeShape: routeShapeFor({ after, event }),
    temptation: temptationFor({ after, event }),
    danger: dangerFor({ after, event }),
    replayHook: replayHookFor({ type, after, event }),
    beatTarget: beatTargetFor({ type, after, event }),
    tone: toneFor(type),
    createdTurn: event.turn || run.turn || 0,
  };
}

export function shouldCreateExpeditionFingerprint({ run = {}, event = {} } = {}) {
  return !run.fingerprint && Boolean(buildExpeditionFingerprint({ run, event }));
}
