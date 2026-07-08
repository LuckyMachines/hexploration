import { parseAlias } from './hexmath.js';

export const PRESSURE_BANDS = [
  {
    id: 'stable',
    label: 'Stable Route',
    min: 0,
    max: 24,
    tone: 'green',
    copy: 'The route home is readable enough to keep charting.',
  },
  {
    id: 'stretching',
    label: 'Stretching Route',
    min: 25,
    max: 49,
    tone: 'gold',
    copy: 'The run can still push, but every action should justify its cost.',
  },
  {
    id: 'closing',
    label: 'Closing Route',
    min: 50,
    max: 74,
    tone: 'orange',
    copy: 'The way home is becoming the main problem.',
  },
  {
    id: 'collapse',
    label: 'Collapse Risk',
    min: 75,
    max: 100,
    tone: 'red',
    copy: 'Leaving late may cost the crew or the recovered value.',
  },
];

export function clampPressure(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function pressureBandFor(value) {
  const pressure = clampPressure(value);
  return PRESSURE_BANDS.find((band) => pressure >= band.min && pressure <= band.max) || PRESSURE_BANDS[0];
}

export function routeDistance(a, b) {
  const start = parseAlias(a);
  const end = parseAlias(b);
  if (!start || !end) return null;
  return Math.max(Math.abs(start.col - end.col), Math.abs(start.row - end.row));
}

export function recoveredValueForInventory(activeInventory = {}, inactiveInventory = {}) {
  const activeItems = [
    activeInventory.artifact,
    activeInventory.relic,
    activeInventory.leftHandItem,
    activeInventory.rightHandItem,
  ].filter(Boolean);
  const inactiveBalances = Array.isArray(inactiveInventory.itemBalances) ? inactiveInventory.itemBalances : [];
  const inactiveValue = inactiveBalances.reduce((sum, balance) => sum + (Number(balance) || 0), 0);
  return activeItems.length + inactiveValue;
}

function statValue(stats = {}, keys = []) {
  for (const key of keys) {
    const value = Number(stats[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export function escapeReadinessFor({
  pressure = 0,
  atLanding = false,
  recoveredValue = 0,
  distanceToLanding = null,
} = {}) {
  const hasRecoveredValue = recoveredValue > 0;
  const band = pressureBandFor(pressure);
  if (!atLanding) {
    const distance = distanceToLanding === null ? 'unknown distance' : `${distanceToLanding} away`;
    return {
      id: 'return',
      label: 'Return to landing',
      canFlee: false,
      body: `Landing is ${distance}; depart is not ready yet.`,
      missing: ['landing'],
    };
  }
  if (!hasRecoveredValue) {
    return {
      id: 'recover',
      label: 'Recover value first',
      canFlee: false,
      body: 'The crew is at landing, but the run needs recovered value.',
      missing: ['value'],
    };
  }
  if (band.id === 'collapse') {
    return {
      id: 'redline',
      label: 'High-risk escape',
      canFlee: true,
      body: 'Flee now or accept a real chance of losing crew or value.',
      missing: [],
    };
  }
  return {
    id: band.id === 'stable' ? 'clean' : 'ready',
    label: band.id === 'stable' ? 'Clean escape ready' : 'Escape ready',
    canFlee: true,
    body: band.id === 'stable'
      ? 'Recovered value is aboard and the landing route is calm.'
      : 'Recovered value is aboard; leaving now protects the run.',
    missing: [],
  };
}

export function deriveDepartPressure({
  phase = '',
  stats = {},
  location = '',
  landingSite = '',
  activeInventory = {},
  inactiveInventory = {},
  routeStatus = {},
  movePath = [],
  turnState = {},
  events = [],
  crew = [],
  tileTraitEffects = null,
} = {}) {
  const intentLocation = movePath.length > 0 ? movePath[movePath.length - 1] : location;
  const distanceToLanding = routeDistance(intentLocation, landingSite);
  const currentDistanceToLanding = routeDistance(location, landingSite);
  const recoveredValue = recoveredValueForInventory(activeInventory, inactiveInventory);
  const atLanding = Boolean(location && landingSite && location === landingSite);
  const intentAtLanding = Boolean(intentLocation && landingSite && intentLocation === landingSite);
  const movement = statValue(stats, ['movement', 'Movement', 'move']);
  const agility = statValue(stats, ['agility', 'Agility']);
  const dexterity = statValue(stats, ['dexterity', 'Dexterity']);
  const weakStatCount = [movement, agility, dexterity].filter((value) => value > 0 && value <= 1).length;
  const downCrew = crew.filter((player) => player && player.isActive === false).length;
  const eventPressure = Math.min(18, (events?.length || 0) * 2);
  const distancePressure = distanceToLanding === null ? 12 : distanceToLanding * 9;
  const valuePressure = recoveredValue > 0 ? Math.min(16, recoveredValue * 8) : 0;
  const weakCrewPressure = weakStatCount * 7 + downCrew * 8;
  const plannedPressure = routeStatus?.isValid === false
    ? 18
    : routeStatus?.isFull
      ? 9
      : movePath.length > 0
        ? Math.max(0, movePath.length - Math.max(1, Number(routeStatus?.remaining || 0))) * 3
        : 0;
  const phasePressure = String(phase).toLowerCase() === 'night' ? 8 : 0;
  const resolvingPressure = turnState?.state === 'resolving' || turnState?.state === 'RESOLVING' ? 4 : 0;
  const currentDrift = currentDistanceToLanding !== null && distanceToLanding !== null
    ? Math.max(0, distanceToLanding - currentDistanceToLanding) * 5
    : 0;
  const pressure = clampPressure(
    distancePressure
    + valuePressure
    + weakCrewPressure
    + plannedPressure
    + phasePressure
    + resolvingPressure
    + eventPressure
    + currentDrift,
  );
  const traitPressure = tileTraitEffects ? Number(tileTraitEffects.pressureDelta || 0) : 0;
  const traitRoute = tileTraitEffects ? Number(tileTraitEffects.routeDelta || 0) : 0;
  const adjustedPressure = clampPressure(pressure + traitPressure - Math.max(0, traitRoute) * 0.4);
  const band = pressureBandFor(adjustedPressure);
  const readiness = escapeReadinessFor({
    pressure: adjustedPressure,
    atLanding,
    recoveredValue,
    distanceToLanding: currentDistanceToLanding,
  });

  return {
    pressure: adjustedPressure,
    routeStability: clampPressure(100 - adjustedPressure),
    band,
    distanceToLanding,
    currentDistanceToLanding,
    atLanding,
    intentAtLanding,
    recoveredValue,
    hasRecoveredValue: recoveredValue > 0,
    readiness,
    escapeQuality: readiness.canFlee
      ? readiness.id === 'clean'
        ? 'clean'
        : band.id === 'collapse'
          ? 'desperate'
          : 'close'
      : 'not-ready',
    pressureReasons: {
      distancePressure,
      valuePressure,
      weakCrewPressure,
      plannedPressure,
      phasePressure,
      eventPressure,
      traitPressure,
      traitRoute,
    },
  };
}

export function departPressureDeltaForAction(action, {
  movingTowardLanding = false,
  digStreak = 0,
  pressure = 0,
  hasRecoveredValue = false,
} = {}) {
  const base = {
    move: movingTowardLanding ? -5 : 6,
    dig: 10 + Math.max(0, Number(digStreak) || 0) * 3,
    rest: -8,
    help: -5,
    flee: hasRecoveredValue ? -14 : 5,
    inspect: -2,
  }[action] ?? 2;
  const redlineTax = pressure >= 75 && !['rest', 'help', 'flee'].includes(action) ? 5 : 0;
  return Math.round(base + redlineTax);
}

export function pressureToneClass(band = {}) {
  return {
    green: 'border-oxide-green/35 bg-oxide-green/5 text-oxide-green',
    gold: 'border-compass/35 bg-compass/5 text-compass-bright',
    orange: 'border-desert/40 bg-desert/10 text-desert',
    red: 'border-signal-red/40 bg-signal-red/10 text-signal-red',
  }[band.tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';
}
