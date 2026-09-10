import { Action, Tile } from '../lib/constants';

export const BOARD_LAB_CELLS = Object.freeze([
  ['0,0', Tile.LANDING], ['0,1', Tile.JUNGLE], ['0,2', Tile.NONE], ['0,3', Tile.MOUNTAIN],
  ['1,0', Tile.JUNGLE], ['1,1', Tile.PLAINS], ['1,2', Tile.DESERT], ['1,3', Tile.NONE],
  ['2,0', Tile.PLAINS], ['2,1', Tile.RELIC], ['2,2', Tile.JUNGLE], ['2,3', Tile.MOUNTAIN],
  ['3,0', Tile.NONE], ['3,1', Tile.DESERT], ['3,2', Tile.PLAINS], ['3,3', Tile.NONE],
].map(([alias, tileType]) => ({
  alias,
  tileType,
  revealed: tileType !== Tile.NONE,
  hasCampsite: alias === '1,0',
})));

const STRESS_TILE_TYPES = [Tile.JUNGLE, Tile.PLAINS, Tile.DESERT, Tile.MOUNTAIN, Tile.RELIC];
export const BOARD_LAB_STRESS_CELLS = Object.freeze(Array.from({ length: 100 }, (_, index) => ({
  alias: `${Math.floor(index / 10)},${index % 10}`,
  tileType: index === 0 ? Tile.LANDING : STRESS_TILE_TYPES[index % STRESS_TILE_TYPES.length],
  revealed: true,
  hasCampsite: index > 0 && index % 23 === 0,
})));

const crew = Object.freeze([
  { name: 'Mara Vey', characterId: 'mara-vey', currentZone: '1,0', stats: { movement: 3, agility: 2, dexterity: 2 } },
  { name: 'Tovin Kade', characterId: 'tovin-kade', currentZone: '2,0', stats: { movement: 4, agility: 3, dexterity: 2 } },
  { name: 'Nia Sol', characterId: 'nia-sol', currentZone: '1,1', stats: { movement: 2, agility: 4, dexterity: 3 } },
  { name: 'Orin Vale', characterId: 'orin-vale', currentZone: '2,2', stats: { movement: 3, agility: 3, dexterity: 4 } },
]);

const base = {
  cells: BOARD_LAB_CELLS,
  currentLocation: '1,0',
  landingSite: '0,0',
  intentAlias: '1,1',
  selectedPath: [],
  previewPath: [],
  reachableAliases: ['0,0', '0,1', '1,1', '2,0'],
  playerLocationMap: { '1,0': [0], '2,0': [1], '1,1': [2], '2,2': [3] },
  crew,
  currentPlayerIndex: 0,
  activeAction: Action.MOVE,
  source: { kind: 'contract-fixture', scenarioId: 'board-state-matrix', turn: 0 },
};

export const BOARD_LAB_STATES = Object.freeze([
  { id: 'ready', label: 'Ready', description: 'A quiet planning state with reachable choices.', input: { ...base, phase: 'planning' } },
  { id: 'hover', label: 'Hover', description: 'Transient intent without terrain movement.', input: { ...base, intentAlias: '0,1', previewPath: ['0,1'], phase: 'planning' } },
  { id: 'selected', label: 'Selected', description: 'A stable committed route segment.', input: { ...base, intentAlias: '1,1', selectedPath: ['1,1'], previewPath: ['1,1'], phase: 'planning' } },
  { id: 'invalid', label: 'Invalid', description: 'An invalid destination with a recoverable next step.', input: { ...base, intentAlias: '3,3', invalidAlias: '3,3', selectedPath: ['1,1'], previewPath: ['1,1'], phase: 'planning' } },
  { id: 'danger', label: 'Danger', description: 'A redline escape choice with explicit pressure.', input: { ...base, intentAlias: '3,1', selectedPath: ['1,1', '2,1', '3,1'], previewPath: ['1,1', '2,1', '3,1'], activeAction: Action.FLEE, isDanger: true, lowStats: true, phase: 'danger' } },
  { id: 'committed', label: 'Committed', description: 'The route is locked while the crew finishes choosing.', input: { ...base, intentAlias: '2,1', selectedPath: ['1,1', '2,1'], previewPath: ['1,1', '2,1'], hasSubmitted: true, phase: 'committed' } },
  { id: 'resolving', label: 'Resolving', description: 'The world answers the submitted route.', input: { ...base, intentAlias: '2,1', selectedPath: ['1,1', '2,1'], previewPath: ['1,1', '2,1'], hasSubmitted: true, isResolving: true, phase: 'resolving' } },
  { id: 'rescue', label: 'Rescue', description: 'A helper and endangered explorer share one tile.', input: { ...base, currentLocation: '1,0', intentAlias: '1,0', activeAction: Action.HELP, playerLocationMap: { '1,0': [0, 1], '1,1': [2], '2,2': [3] }, lowStats: true, phase: 'recovery' } },
  { id: 'recovery', label: 'Recovery', description: 'Low-stat pressure gives way to a clear recovery window.', input: { ...base, intentAlias: '1,0', activeAction: Action.REST, lowStats: true, phase: 'recovery' } },
  { id: 'complete', label: 'Complete', description: 'The expedition closes with the recovered relic visible.', input: { ...base, currentLocation: '0,0', intentAlias: '0,0', selectedPath: ['2,1', '1,1', '0,0'], previewPath: ['2,1', '1,1', '0,0'], playerLocationMap: { '0,0': [0, 1, 2, 3] }, hasSubmitted: true, isComplete: true, phase: 'complete' } },
]);

export function boardLabState(id = 'ready') {
  return BOARD_LAB_STATES.find((state) => state.id === id) || BOARD_LAB_STATES[0];
}
