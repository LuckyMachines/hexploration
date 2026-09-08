export const HELP_STAT_KEYS = ['movement', 'agility', 'dexterity'];
export const HELP_COST = 1;
export const HELP_RECOVERY = 2;
export const HELP_STABILIZE = 1;
export const HELP_STAT_MAX = 4;

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function playerNumber(player) {
  return Number(player?.playerID ?? player?.playerId ?? 0);
}

export function playerLocation(player) {
  return String(player?.currentZone ?? player?.currentLocation ?? player?.location ?? '');
}

export function statKeyFor(option) {
  const key = String(option || '').toLowerCase();
  return HELP_STAT_KEYS.includes(key) ? key : '';
}

export function statLabelFor(option) {
  const key = statKeyFor(option);
  return key ? `${key[0].toUpperCase()}${key.slice(1)}` : '';
}

export function getHelpTargetState({ helper, target, stat, currentLocation } = {}) {
  const key = statKeyFor(stat);
  const helperID = playerNumber(helper);
  const targetID = playerNumber(target);
  const helperLocation = String(currentLocation || playerLocation(helper));
  const targetLocation = playerLocation(target);
  const helperBefore = key ? numberOrZero(helper?.[key]) : 0;
  const targetBefore = key ? numberOrZero(target?.[key]) : 0;
  const helperAfter = Math.max(0, helperBefore - HELP_COST);
  const targetAfter = Math.min(HELP_STAT_MAX, targetBefore + HELP_RECOVERY);
  const targetStatsBefore = Object.fromEntries(
    HELP_STAT_KEYS.map((statKey) => [statKey, numberOrZero(target?.[statKey])]),
  );
  const targetStatsAfter = Object.fromEntries(
    HELP_STAT_KEYS.map((statKey) => [
      statKey,
      Math.min(HELP_STAT_MAX, targetStatsBefore[statKey] + (statKey === key ? HELP_RECOVERY : HELP_STABILIZE)),
    ]),
  );
  const targetGain = HELP_STAT_KEYS.reduce(
    (sum, statKey) => sum + targetStatsAfter[statKey] - targetStatsBefore[statKey],
    0,
  );

  let reason = '';
  if (!targetID) reason = 'Choose a teammate.';
  else if (targetID === helperID) reason = 'You cannot rescue yourself.';
  else if (!helperLocation || !targetLocation || helperLocation !== targetLocation) reason = 'Move onto the same tile first.';
  else if (!key) reason = 'Choose Movement, Agility, or Dexterity.';
  else if (helperBefore <= HELP_COST) reason = `You need at least ${HELP_COST + 1} ${statLabelFor(key)} to share it.`;
  else if (targetBefore >= HELP_STAT_MAX) reason = `${statLabelFor(key)} is already full.`;

  return {
    valid: !reason,
    reason,
    stat: key,
    statLabel: statLabelFor(key),
    helperID,
    targetID,
    helperBefore,
    helperAfter,
    targetBefore,
    targetAfter,
    targetGain,
    crewGain: targetGain - HELP_COST,
    targetStatsBefore,
    targetStatsAfter,
    isRescue: Math.min(...Object.values(targetStatsBefore)) <= 1
      && Math.min(...Object.values(targetStatsAfter)) >= 2,
  };
}

function conditionScore(player) {
  const values = HELP_STAT_KEYS.map((key) => numberOrZero(player?.[key]));
  return {
    minimum: Math.min(...values),
    total: values.reduce((sum, value) => sum + value, 0),
  };
}

export function rankHelpTargets({ helper, crew = [], currentLocation } = {}) {
  const helperID = playerNumber(helper);
  const location = String(currentLocation || playerLocation(helper));

  return crew
    .filter((candidate) => (
      playerNumber(candidate) > 0
      && playerNumber(candidate) !== helperID
      && candidate?.isActive !== false
    ))
    .map((candidate) => ({ candidate, ...conditionScore(candidate) }))
    .sort((left, right) => {
      const leftReachable = playerLocation(left.candidate) === location ? 0 : 1;
      const rightReachable = playerLocation(right.candidate) === location ? 0 : 1;
      return leftReachable - rightReachable
        || left.minimum - right.minimum
        || left.total - right.total
        || playerNumber(left.candidate) - playerNumber(right.candidate);
    })
    .map(({ candidate }) => candidate);
}

export function recommendedHelpStat({ helper, target, currentLocation } = {}) {
  return HELP_STAT_KEYS
    .map((stat) => getHelpTargetState({ helper, target, stat, currentLocation }))
    .filter((preview) => preview.valid)
    .sort((left, right) => (
      Number(right.isRescue) - Number(left.isRescue)
      || left.targetBefore - right.targetBefore
      || right.crewGain - left.crewGain
    ))[0]?.stat || '';
}
