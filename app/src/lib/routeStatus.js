export function buildRouteStatus({
  currentLocation = '',
  path = [],
  movement = 0,
  validation,
  activeInventory = {},
  companionLocations = [],
} = {}) {
  const budget = Math.max(0, Number(movement || 0));
  const used = path.length;
  const remaining = Math.max(0, budget - used);
  const isValid = validation?.ok !== false;
  const invalidReason = isValid ? '' : validation?.reason || 'Route is not valid.';
  const hasShield = Boolean(activeInventory.shield);
  const heldItems = [
    activeInventory.leftHandItem,
    activeInventory.rightHandItem,
    activeInventory.artifact,
    activeInventory.relic,
  ].filter(Boolean);
  const adjacentCompanions = companionLocations.filter((companion) => companion.isNearIntent).length;

  return {
    origin: currentLocation,
    destination: path[path.length - 1] || currentLocation,
    used,
    remaining,
    budget,
    isEmpty: used === 0,
    isFull: budget > 0 && used >= budget,
    isValid,
    invalidReason,
    label: isValid
      ? `${used}/${budget} steps planned, ${remaining} left`
      : invalidReason,
    inventoryNote: hasShield
      ? 'Shield steadies danger previews.'
      : heldItems.length > 0
        ? `${heldItems.slice(0, 2).join(' + ')} ready.`
        : 'No route item equipped.',
    companionNote: adjacentCompanions > 0
      ? `${adjacentCompanions} crew signal near intent.`
      : 'No crew signal near intent.',
  };
}

