import catalog from '../characters/character-catalog.json';
import runtimeImageDelivery from '../art-pipeline/runtime-image-delivery.json';
import { Action } from './constants';

export const CHARACTER_CATALOG_VERSION = catalog.version;
export const CHARACTER_STATES = Object.freeze([...catalog.requiredStates]);
export const CHARACTER_ROSTER = Object.freeze(catalog.characters.map((character) => Object.freeze(character)));
export const ROLE_ROSTER = Object.freeze(catalog.roles.map((role) => Object.freeze(role)));

const characterById = new Map(CHARACTER_ROSTER.map((character) => [character.id, character]));
const roleById = new Map(ROLE_ROSTER.map((role) => [role.id, role]));
const roleAliases = new Map(Object.entries(catalog.roleAliases || {}));
const runtimeImageBySource = new Map(runtimeImageDelivery.assets.map((asset) => [
  `/${asset.source.replace(/^app\/public\//, '')}`,
  `/${asset.output.replace(/^app\/public\//, '')}`,
]));

export function runtimeImagePath(sourcePath = '') {
  return runtimeImageBySource.get(sourcePath) || sourcePath;
}

export const CHARACTER_NEUTRAL_TEXTURE_PATHS = Object.freeze(CHARACTER_ROSTER.map((character) => runtimeImagePath(character.assets.neutral)));
export const CHARACTER_TEXTURE_PATHS = Object.freeze([...new Set(CHARACTER_ROSTER.flatMap((character) => [
  runtimeImagePath(character.assets.neutral),
  ...Object.values(character.assets.states || {}).map(runtimeImagePath),
]))]);

export function normalizeRoleId(value = '') {
  const id = String(value || '').trim().toLowerCase();
  return roleAliases.get(id) || id;
}

export function getRole(roleId) {
  return roleById.get(normalizeRoleId(roleId)) || null;
}

export function getCharacter(characterId) {
  return characterById.get(String(characterId || '').trim().toLowerCase()) || null;
}

export function characterForRole(roleId) {
  const role = getRole(roleId);
  return role ? getCharacter(role.characterId) : null;
}

export function characterForSeat(index = 0) {
  return characterForRole(ROLE_ROSTER[Math.abs(Number(index) || 0) % ROLE_ROSTER.length].id);
}

export function resolvePlayerCharacter(player = {}, index = 0) {
  return getCharacter(player.characterId)
    || characterForRole(player.roleId || player.role)
    || characterForSeat(index);
}

export function assignCrewCharacters(players = [], { currentAddress = '', preferredRoleId = '' } = {}) {
  const normalizedAddress = String(currentAddress || '').toLowerCase();
  const preferredRole = getRole(preferredRoleId);
  const assignedRoleIds = new Set();
  const assignments = new Array(players.length);
  const currentIndex = normalizedAddress
    ? players.findIndex((player) => String(player.playerAddress || '').toLowerCase() === normalizedAddress)
    : -1;
  const claimRole = (index, role) => {
    if (index < 0 || !role || assignedRoleIds.has(role.id)) return false;
    assignments[index] = role;
    assignedRoleIds.add(role.id);
    return true;
  };

  // Reserve the local player's chosen fantasy before seat-order defaults consume it.
  if (preferredRole) claimRole(currentIndex, preferredRole);

  players.forEach((player, index) => {
    if (assignments[index]) return;
    const explicitCharacter = getCharacter(player.characterId);
    const explicitRole = getRole(player.roleId || player.role);
    claimRole(index, explicitCharacter ? getRole(explicitCharacter.roleId) : explicitRole);
  });

  return players.map((player, index) => {
    const role = assignments[index]
      || ROLE_ROSTER.find((candidate) => !assignedRoleIds.has(candidate.id))
      || ROLE_ROSTER[index % ROLE_ROSTER.length];
    assignedRoleIds.add(role.id);
    const character = characterForRole(role.id);
    return {
      ...player,
      roleId: role.id,
      characterId: character.id,
    };
  });
}

export function deriveCharacterState({
  player = {},
  isCurrent = false,
  activeAction = Action.IDLE,
  lowStats = false,
  isResolving = false,
  hasArtifact = false,
  isSelected = false,
} = {}) {
  const actionValue = typeof activeAction === 'string' ? activeAction.trim().toLowerCase() : activeAction;
  const isAction = (index, label) => actionValue === index || actionValue === label;
  if (player.isActive === false) return 'downed';
  if (isCurrent && lowStats) return 'strained';
  if (isCurrent && isResolving) return 'triumph';
  if (isCurrent && isAction(Action.HELP, 'help')) return 'helping';
  if (isCurrent && isAction(Action.REST, 'rest')) return 'recovering';
  if (isCurrent && isAction(Action.DIG, 'dig')) return 'digging';
  if (isCurrent && isAction(Action.MOVE, 'move')) return 'moving';
  if (isCurrent && (isAction(Action.FLEE, 'flee') || actionValue === 'depart')) return 'escaping';
  if (hasArtifact) return 'carrying';
  if (isSelected || isCurrent) return 'selected';
  return 'neutral';
}

export function resolveCharacterVisual({ characterId, state = 'neutral' } = {}) {
  const character = getCharacter(characterId) || CHARACTER_ROSTER[0];
  return {
    character,
    state,
    resolvedState: character.assets.states?.[state] ? state : 'neutral',
    path: runtimeImagePath(character.assets.states?.[state] || character.assets.neutral),
    isFallback: state !== 'neutral' && !character.assets.states?.[state],
  };
}

export function rolePresentation(roleId) {
  const role = getRole(roleId) || ROLE_ROSTER[0];
  const character = characterForRole(role.id);
  return { ...role, character };
}
