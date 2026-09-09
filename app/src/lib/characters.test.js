import { describe, expect, it } from 'vitest';
import { Action } from './constants';
import {
  CHARACTER_ROSTER,
  ROLE_ROSTER,
  assignCrewCharacters,
  deriveCharacterState,
  normalizeRoleId,
  resolveCharacterVisual,
} from './characters';

describe('character system', () => {
  it('defines one unique character for every supported crew role', () => {
    expect(ROLE_ROSTER).toHaveLength(4);
    expect(new Set(ROLE_ROSTER.map((role) => role.characterId)).size).toBe(4);
    expect(new Set(CHARACTER_ROSTER.map((character) => character.roleId)).size).toBe(4);
  });

  it('migrates legacy role ids to the canonical vocabulary', () => {
    expect(normalizeRoleId('warden')).toBe('guard');
    expect(normalizeRoleId('salvager')).toBe('carrier');
  });

  it('assigns four distinct identities and honors the current player preference', () => {
    const players = Array.from({ length: 4 }, (_, index) => ({
      playerID: index + 1,
      playerAddress: `0x${index + 1}`,
    }));
    const assigned = assignCrewCharacters(players, { currentAddress: '0x3', preferredRoleId: 'guard' });
    expect(new Set(assigned.map((player) => player.characterId)).size).toBe(4);
    expect(assigned[2]).toMatchObject({ roleId: 'guard', characterId: 'routekeeper' });
  });

  it('reserves a preferred role even when an earlier seat would otherwise consume it', () => {
    const players = Array.from({ length: 4 }, (_, index) => ({
      playerID: index + 1,
      playerAddress: `0x${index + 1}`,
    }));
    const assigned = assignCrewCharacters(players, { currentAddress: '0x3', preferredRoleId: 'scout' });
    expect(new Set(assigned.map((player) => player.roleId)).size).toBe(4);
    expect(assigned[2]).toMatchObject({ roleId: 'scout', characterId: 'signal-cartographer' });
  });

  it('resolves state priority and falls back without losing identity', () => {
    expect(deriveCharacterState({ isCurrent: true, lowStats: true, activeAction: Action.HELP })).toBe('strained');
    expect(deriveCharacterState({ isCurrent: true, activeAction: Action.HELP })).toBe('helping');
    const available = resolveCharacterVisual({ characterId: 'signal-cartographer', state: 'helping' });
    expect(available.path).toContain('signal-cartographer-helping.png');
    expect(available.isFallback).toBe(false);
    const fallback = resolveCharacterVisual({ characterId: 'signal-cartographer', state: 'downed' });
    expect(fallback.path).toContain('signal-cartographer.png');
    expect(fallback.isFallback).toBe(true);
  });
});
