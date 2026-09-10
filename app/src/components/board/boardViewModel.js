import boardSystem from '../../board-system/board-system.json';
import { Action, Tile } from '../../lib/constants';

export const BOARD_VIEW_MODEL_VERSION = boardSystem.stateContract.version;

const PHASES = new Set(boardSystem.stateContract.phases);

function unique(values = []) {
  return [...new Set((values || [])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(String))];
}

function normalizeCells(cells = []) {
  return (cells || []).filter((cell) => cell?.alias).map((cell) => ({
    alias: String(cell.alias),
    tileType: Number.isFinite(Number(cell.tileType)) ? Number(cell.tileType) : Tile.NONE,
    revealed: Boolean(cell.revealed),
    hasCampsite: Boolean(cell.hasCampsite),
  }));
}

function normalizeLocationMap(playerLocationMap = {}, crew = []) {
  const normalized = {};
  for (const [alias, playerIndices] of Object.entries(playerLocationMap || {})) {
    const indices = unique((playerIndices || []).map(Number)).map(Number).filter(Number.isInteger);
    if (indices.length) normalized[String(alias)] = indices;
  }
  if (Object.keys(normalized).length) return normalized;
  (crew || []).forEach((player, index) => {
    const alias = player?.currentZone || player?.location;
    if (!alias) return;
    if (!normalized[alias]) normalized[alias] = [];
    normalized[alias].push(index);
  });
  return normalized;
}

export function deriveBoardPhase(input = {}) {
  if (input.phase && PHASES.has(input.phase)) return input.phase;
  if (input.isComplete) return 'complete';
  if (input.isResolving) return 'resolving';
  if (input.isDanger) return 'danger';
  if (input.lowStats || input.activeAction === Action.REST || input.activeAction === Action.HELP) return 'recovery';
  if (input.hasSubmitted) return 'committed';
  return 'planning';
}

export function deriveBoardViewModel(input = {}) {
  const cells = normalizeCells(input.cells);
  const aliases = new Set(cells.map((cell) => cell.alias));
  const selectedPath = unique(input.selectedPath).filter((alias) => aliases.has(alias));
  const previewPath = unique(input.previewPath?.length ? input.previewPath : selectedPath).filter((alias) => aliases.has(alias));
  const reachableAliases = unique(input.reachableAliases).filter((alias) => aliases.has(alias));
  const currentLocation = aliases.has(String(input.currentLocation || '')) ? String(input.currentLocation) : '';
  const landingSite = aliases.has(String(input.landingSite || '')) ? String(input.landingSite) : '';
  const fallbackIntent = previewPath.at(-1) || selectedPath.at(-1) || currentLocation || landingSite || cells[0]?.alias || '';
  const intentAlias = aliases.has(String(input.intentAlias || '')) ? String(input.intentAlias) : fallbackIntent;
  const crew = Array.isArray(input.crew) ? input.crew : [];
  const phase = deriveBoardPhase(input);
  const playerLocationMap = normalizeLocationMap(input.playerLocationMap, crew);
  const invalidAlias = aliases.has(String(input.invalidAlias || '')) ? String(input.invalidAlias) : '';

  return Object.freeze({
    schemaVersion: BOARD_VIEW_MODEL_VERSION,
    source: Object.freeze({
      kind: input.source?.kind || 'live',
      scenarioId: input.source?.scenarioId || null,
      traceHash: input.source?.traceHash || null,
      turn: Number(input.source?.turn || 0),
    }),
    cells,
    currentLocation,
    intentAlias,
    selectedPath,
    previewPath,
    reachableAliases,
    invalidAlias,
    landingSite,
    playerLocationMap,
    crew,
    currentPlayerIndex: Math.max(0, Number(input.currentPlayerIndex || 0)),
    activeAction: Number.isFinite(Number(input.activeAction)) ? Number(input.activeAction) : Action.IDLE,
    phase,
    hasSubmitted: phase === 'committed' || phase === 'resolving' || phase === 'complete' || Boolean(input.hasSubmitted),
    isResolving: phase === 'resolving',
    isDanger: phase === 'danger' || Boolean(input.isDanger),
    isComplete: phase === 'complete',
    lowStats: phase === 'recovery' || Boolean(input.lowStats),
    signals: Object.freeze({
      hasRoute: selectedPath.length > 0 || previewPath.length > 0,
      isPreviewing: previewPath.length > selectedPath.length,
      hasInvalidIntent: Boolean(invalidAlias),
      occupiedAliases: Object.keys(playerLocationMap),
    }),
  });
}

export function boardViewModelKey(viewModel = {}) {
  return JSON.stringify({
    version: viewModel.schemaVersion,
    cells: (viewModel.cells || []).map((cell) => [cell.alias, cell.tileType, cell.revealed, cell.hasCampsite]),
    currentLocation: viewModel.currentLocation,
    intentAlias: viewModel.intentAlias,
    selectedPath: viewModel.selectedPath,
    previewPath: viewModel.previewPath,
    reachableAliases: viewModel.reachableAliases,
    invalidAlias: viewModel.invalidAlias,
    playerLocationMap: viewModel.playerLocationMap,
    currentPlayerIndex: viewModel.currentPlayerIndex,
    activeAction: viewModel.activeAction,
    phase: viewModel.phase,
  });
}

export default deriveBoardViewModel;
