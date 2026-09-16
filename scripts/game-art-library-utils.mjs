export function matchesSelector(asset, selector) {
  if (selector.ids?.includes(asset.id)) return true;
  if (selector.ids?.length) return false;
  if (selector.families?.length && !selector.families.includes(asset.family)) return false;
  if (selector.assetTypes?.length && !selector.assetTypes.includes(asset.assetType)) return false;
  if (selector.statuses?.length && !selector.statuses.includes(asset.status)) return false;
  return Boolean(selector.families?.length || selector.assetTypes?.length || selector.statuses?.length);
}

export function selectGroupAssets(manifest, group) {
  const selected = new Map();
  for (const asset of manifest.assets) {
    if (group.selectors.some((selector) => matchesSelector(asset, selector))) selected.set(asset.id, asset);
  }
  return [...selected.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function validateLibraryContract(contract, manifest, { fileExists = () => true } = {}) {
  const errors = [];
  const warnings = [];
  const groupIds = new Set();
  const assignments = new Map();

  if (contract.artDirectionVersion !== manifest.artDirectionVersion) {
    errors.push(`Library artDirectionVersion ${contract.artDirectionVersion} does not match manifest ${manifest.artDirectionVersion}`);
  }

  for (const group of contract.groups || []) {
    if (groupIds.has(group.id)) errors.push(`Duplicate library group id: ${group.id}`);
    groupIds.add(group.id);
    const assets = selectGroupAssets(manifest, group);
    if (assets.length < group.target) warnings.push(`${group.id} has ${assets.length}/${group.target} target assets`);
    const pending = assets.filter((asset) => !['approved', 'reference'].includes(asset.status));
    if (pending.length) warnings.push(`${group.id} has ${pending.length} asset(s) awaiting approval: ${pending.map((asset) => asset.id).join(', ')}`);
    for (const asset of assets) {
      const groups = assignments.get(asset.id) || [];
      groups.push(group.id);
      assignments.set(asset.id, groups);
      if (group.requiredAlpha && !asset.output?.alpha) errors.push(`${asset.id} must use an alpha-capable output in ${group.id}`);
      if (!fileExists(asset.output?.path)) warnings.push(`${asset.id} output is missing: ${asset.output?.path}`);
    }
  }

  const reviewable = manifest.assets.filter((asset) => asset.output?.path?.includes('/images/art/') && !['retired'].includes(asset.status));
  for (const asset of reviewable) {
    const groups = assignments.get(asset.id) || [];
    if (groups.length === 0) warnings.push(`${asset.id} is not assigned to a library review group`);
    if (groups.length > 1) errors.push(`${asset.id} is assigned to multiple library groups: ${groups.join(', ')}`);
  }

  return { errors, warnings, assignments };
}

export function buildLibraryReport(contract, manifest, { fileExists = () => true } = {}) {
  const validation = validateLibraryContract(contract, manifest, { fileExists });
  const groups = contract.groups.map((group) => {
    const assets = selectGroupAssets(manifest, group);
    const missing = assets.filter((asset) => !fileExists(asset.output?.path)).map((asset) => asset.id);
    const approved = assets.filter((asset) => asset.status === 'approved').length;
    const ready = assets.filter((asset) => ['approved', 'reference'].includes(asset.status)).length;
    return {
      id: group.id,
      title: group.title,
      description: group.description,
      target: group.target,
      count: assets.length,
      approved,
      ready,
      missing,
      targetMet: assets.length >= group.target,
      coverageRatio: Math.min(1, assets.length / group.target),
      assets: assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        family: asset.family,
        assetType: asset.assetType,
        status: asset.status,
        output: asset.output.path,
      })),
    };
  });
  const missingFiles = groups.reduce((total, group) => total + group.missing.length, 0);
  const targetGroups = groups.filter((group) => group.targetMet).length;
  const assetCount = groups.reduce((total, group) => total + group.count, 0);
  const readyAssets = groups.reduce((total, group) => total + group.ready, 0);
  const coverageScore = groups.reduce((total, group) => total + group.coverageRatio, 0) / groups.length;
  const outputScore = 1 - (missingFiles / Math.max(1, assetCount));
  const readinessScore = readyAssets / Math.max(1, assetCount);
  const score = Math.round((coverageScore * 50) + (outputScore * 25) + (readinessScore * 25));
  const grade = validation.errors.length ? 'F' : score >= 95 ? 'A' : score >= 85 ? 'B' : score >= 70 ? 'C' : 'D';
  return {
    version: contract.version,
    artDirectionVersion: contract.artDirectionVersion,
    generatedAt: new Date().toISOString(),
    grade,
    score,
    totals: {
      groups: groups.length,
      targetGroups,
      assets: assetCount,
      approved: groups.reduce((total, group) => total + group.approved, 0),
      ready: readyAssets,
      missingFiles,
    },
    groups,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

export function humanizeAssetId(value) {
  return String(value)
    .replace(/\.(?:runtime\.)?(?:png|webp|jpe?g)$/i, '')
    .replace(/^(?:character|encounter|environment|prop|relic|terrain|tile-reference|fx|memory)-/, '')
    .replace(/-focal$/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
