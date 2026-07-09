export const EXPEDITION_ARC_IDS = {
  SURVEY: 'survey',
  GREED_WINDOW: 'greed-window',
  DEPARTURE_WINDOW: 'departure-window',
  REDLINE: 'redline',
  FINAL_CALL: 'final-call',
};

export const ARC_ORDER = [
  EXPEDITION_ARC_IDS.SURVEY,
  EXPEDITION_ARC_IDS.GREED_WINDOW,
  EXPEDITION_ARC_IDS.DEPARTURE_WINDOW,
  EXPEDITION_ARC_IDS.REDLINE,
  EXPEDITION_ARC_IDS.FINAL_CALL,
];

export const ARC_DEFINITIONS = {
  [EXPEDITION_ARC_IDS.SURVEY]: {
    id: EXPEDITION_ARC_IDS.SURVEY,
    label: 'Survey',
    shortLabel: 'Survey',
    tone: 'blue',
    priority: 1,
    summary: 'Reveal enough to choose a route.',
    playerQuestion: 'What is out there?',
    directive: 'Chart useful ground before the route gets expensive.',
    nextThreshold: 'Reveal 4 tiles or find value.',
  },
  [EXPEDITION_ARC_IDS.GREED_WINDOW]: {
    id: EXPEDITION_ARC_IDS.GREED_WINDOW,
    label: 'Greed Window',
    shortLabel: 'Greed',
    tone: 'gold',
    priority: 2,
    summary: 'One more payoff is tempting.',
    playerQuestion: 'Can we afford one more payoff?',
    directive: 'Take value only if the route home stays readable.',
    nextThreshold: 'Recover value or keep pressure below 55.',
  },
  [EXPEDITION_ARC_IDS.DEPARTURE_WINDOW]: {
    id: EXPEDITION_ARC_IDS.DEPARTURE_WINDOW,
    label: 'Departure Window',
    shortLabel: 'Depart',
    tone: 'green',
    priority: 3,
    summary: 'You have something worth leaving with.',
    playerQuestion: 'Is this enough to leave with?',
    directive: 'Compare one more chart against the current escape forecast.',
    nextThreshold: 'Reach landing or depart before pressure hits 70.',
  },
  [EXPEDITION_ARC_IDS.REDLINE]: {
    id: EXPEDITION_ARC_IDS.REDLINE,
    label: 'Redline',
    shortLabel: 'Redline',
    tone: 'red',
    priority: 4,
    summary: 'Delay now has a named cost.',
    playerQuestion: 'What cost do we prevent right now?',
    directive: 'Pick a reduction action before the next delay gets worse.',
    nextThreshold: 'Reduce cost or reach Final Call.',
  },
  [EXPEDITION_ARC_IDS.FINAL_CALL]: {
    id: EXPEDITION_ARC_IDS.FINAL_CALL,
    label: 'Final Call',
    shortLabel: 'Final',
    tone: 'orange',
    priority: 5,
    summary: 'Leave, save someone, or pay the price.',
    playerQuestion: 'Do we depart, save someone, or lose something?',
    directive: 'Make the run-defining choice now.',
    nextThreshold: 'Depart, save crew, or accept the loss.',
  },
};

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function crewCriticalCount(crew = []) {
  return crew.filter((player) => {
    if (!player || player.isActive === false) return false;
    return [player.movement, player.agility, player.dexterity].some((stat) => toNumber(stat, 3) <= 1);
  }).length;
}

function concreteLossWarning(warning = '') {
  return /(lose|lost|at risk|route collapse|crew|artifact|relic|value|pay the price|cost)/i.test(String(warning || ''));
}

function normalizeContext({
  departPressure = null,
  escapeCostPreview = null,
  traitPreview = null,
  revealedCount = 0,
  crew = [],
  visibleOpportunity = false,
  recoveredValue = null,
  currentDistanceToLanding = null,
  routeStability = null,
} = {}) {
  const pressure = toNumber(departPressure?.pressure ?? escapeCostPreview?.pressure, 0);
  const stability = toNumber(routeStability ?? departPressure?.routeStability, clamp(100 - pressure));
  const value = toNumber(recoveredValue ?? departPressure?.recoveredValue, 0);
  const distance = currentDistanceToLanding ?? departPressure?.currentDistanceToLanding;
  const safeDistance = distance === null || distance === undefined ? null : toNumber(distance, null);
  const canFlee = Boolean(departPressure?.readiness?.canFlee || escapeCostPreview?.canEscape);
  const costType = escapeCostPreview?.costType || escapeCostPreview?.level || 'unknown';
  const trait = traitPreview?.trait || null;
  const traitCategory = trait?.category || '';
  const traitOpportunity = ['value', 'reveal'].includes(traitCategory);
  const crewCritical = crewCriticalCount(crew);
  const opportunity = Boolean(visibleOpportunity || traitOpportunity || (!value && ['cache', 'relic-vein', 'high-ground'].includes(trait?.id)));

  return {
    pressure,
    routeStability: stability,
    recoveredValue: value,
    currentDistanceToLanding: safeDistance,
    canFlee,
    costType,
    trait,
    traitCategory,
    crewCriticalCount: crewCritical,
    revealedCount: toNumber(revealedCount, 0),
    visibleOpportunity: opportunity,
    nextDelayWarning: escapeCostPreview?.nextDelayWarning || '',
  };
}

function progressFor(ctx) {
  const chartTarget = 8;
  return {
    pressureProgress: clamp(ctx.pressure),
    valueProgress: clamp(ctx.recoveredValue > 0 ? 100 : ctx.visibleOpportunity ? 55 : 15),
    routeProgress: clamp(ctx.currentDistanceToLanding === null ? ctx.routeStability * 0.5 : 100 - Math.min(6, ctx.currentDistanceToLanding) * 14),
    crewProgress: clamp(100 - ctx.crewCriticalCount * 25),
    chartProgress: clamp((ctx.revealedCount / chartTarget) * 100),
  };
}

function withDefinition(id, ctx, reasons, thresholds = []) {
  const definition = ARC_DEFINITIONS[id];
  return {
    ...definition,
    thresholds,
    progress: progressFor(ctx),
    reasons,
    context: ctx,
  };
}

export function deriveExpeditionArc(context = {}) {
  const ctx = normalizeContext(context);
  const costRisk = ['artifact-risk', 'crew-risk', 'route-collapse'].includes(ctx.costType);
  const severeCost = ['crew-risk', 'route-collapse'].includes(ctx.costType);
  const atLandingWithValue = ctx.currentDistanceToLanding === 0 && ctx.recoveredValue > 0;
  const nearLanding = ctx.currentDistanceToLanding !== null && ctx.currentDistanceToLanding <= 2;
  const stableRoute = ctx.routeStability >= 50;
  const pressureCritical = ctx.pressure >= 85;
  const pressureHigh = ctx.pressure >= 70;
  const warningNamesLoss = concreteLossWarning(ctx.nextDelayWarning);

  const candidates = [];

  const finalReasons = [];
  if (ctx.canFlee && costRisk) finalReasons.push('cost-risk');
  if (pressureCritical) finalReasons.push('pressure-critical');
  if (atLandingWithValue) finalReasons.push('at-landing', 'value-recovered');
  if (warningNamesLoss) finalReasons.push('cost-risk');
  if (finalReasons.length > 0) {
    candidates.push(withDefinition(EXPEDITION_ARC_IDS.FINAL_CALL, ctx, [...new Set(finalReasons)], [
      'can-flee-with-risk',
      'pressure-85',
      'landing-with-value',
      'named-delay-loss',
    ]));
  }

  const redlineReasons = [];
  if (pressureHigh) redlineReasons.push('pressure-high');
  if (ctx.routeStability < 35) redlineReasons.push('route-fragile');
  if (severeCost) redlineReasons.push('cost-risk');
  if (ctx.crewCriticalCount > 0) redlineReasons.push('crew-critical');
  if (redlineReasons.length > 0) {
    candidates.push(withDefinition(EXPEDITION_ARC_IDS.REDLINE, ctx, redlineReasons, [
      'pressure-70',
      'route-stability-below-35',
      'crew-risk-or-collapse',
      'critical-crew',
    ]));
  }

  const departureReasons = [];
  if (ctx.recoveredValue > 0) departureReasons.push('value-recovered');
  if (nearLanding) departureReasons.push(ctx.currentDistanceToLanding === 0 ? 'at-landing' : 'near-landing');
  if (stableRoute) departureReasons.push('route-stable');
  if (['clean', 'close', 'artifact-risk', 'not-ready'].includes(ctx.costType)) departureReasons.push(ctx.costType === 'artifact-risk' ? 'cost-risk' : 'cost-clean');
  if (ctx.recoveredValue > 0 && (nearLanding || stableRoute) && ctx.pressure < 70 && ['clean', 'close', 'artifact-risk', 'not-ready', 'unknown'].includes(ctx.costType)) {
    candidates.push(withDefinition(EXPEDITION_ARC_IDS.DEPARTURE_WINDOW, ctx, departureReasons, [
      'value-recovered',
      'near-landing-or-stable-route',
      'pressure-below-70',
    ]));
  }

  const greedReasons = [];
  if (ctx.pressure >= 35 && ctx.pressure < 55) greedReasons.push('pressure-mid');
  if (ctx.visibleOpportunity) greedReasons.push('visible-opportunity');
  if (['value', 'reveal'].includes(ctx.traitCategory)) greedReasons.push('trait-opportunity');
  if ((greedReasons.length > 0 && (!ctx.canFlee || ctx.recoveredValue <= 0))) {
    candidates.push(withDefinition(EXPEDITION_ARC_IDS.GREED_WINDOW, ctx, greedReasons, [
      'pressure-35-to-54',
      'visible-opportunity',
      'value-or-reveal-trait',
    ]));
  }

  const surveyReasons = [];
  if (ctx.revealedCount < 4) surveyReasons.push('survey-needed');
  if (ctx.recoveredValue <= 0) surveyReasons.push('value-missing');
  if (ctx.pressure < 35) surveyReasons.push('pressure-low');
  if (!ctx.canFlee) surveyReasons.push('escape-not-ready');
  candidates.push(withDefinition(EXPEDITION_ARC_IDS.SURVEY, ctx, surveyReasons, [
    'low-reveal-or-no-value',
    'pressure-below-35',
    'escape-not-ready',
  ]));

  return candidates.sort((a, b) => b.priority - a.priority)[0];
}

export function arcToneClass(arc = {}) {
  return {
    blue: 'border-blueprint/40 bg-blueprint/10 text-blueprint',
    gold: 'border-compass/40 bg-compass/10 text-compass-bright',
    green: 'border-oxide-green/40 bg-oxide-green/10 text-oxide-green',
    red: 'border-signal-red/45 bg-signal-red/10 text-signal-red',
    orange: 'border-desert/45 bg-desert/10 text-desert',
    neutral: 'border-exp-border bg-exp-dark/35 text-exp-text-dim',
  }[arc.tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';
}

export function arcTransitionSummary(events = []) {
  const arcs = events.map((event) => event.expeditionArc?.label).filter(Boolean);
  const unique = arcs.filter((label, index) => index === 0 || label !== arcs[index - 1]);
  return unique.slice(-5).join(' -> ');
}
