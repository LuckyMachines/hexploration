import { describe, expect, it } from 'vitest';
import {
  getHelpTargetState,
  rankHelpTargets,
  recommendedHelpStat,
} from './helpRescue';

const helper = {
  playerID: 1,
  currentZone: '0,0',
  movement: 3,
  agility: 2,
  dexterity: 1,
};

describe('help rescue rules', () => {
  it('turns one helper stat into two teammate recovery', () => {
    const preview = getHelpTargetState({
      helper,
      target: { playerID: 2, currentZone: '0,0', movement: 1, agility: 1, dexterity: 1 },
      stat: 'Movement',
    });

    expect(preview).toMatchObject({
      valid: true,
      helperBefore: 3,
      helperAfter: 2,
      targetBefore: 1,
      targetAfter: 3,
      targetGain: 4,
      crewGain: 3,
      isRescue: true,
    });
    expect(preview.targetStatsAfter).toEqual({ movement: 3, agility: 2, dexterity: 2 });
  });

  it('blocks self-help, remote help, exhausted donors, and full stats', () => {
    expect(getHelpTargetState({ helper, target: helper, stat: 'Movement' }).reason).toMatch(/yourself/i);
    expect(getHelpTargetState({
      helper,
      target: { playerID: 2, currentZone: '1,0', movement: 0 },
      stat: 'Movement',
    }).reason).toMatch(/same tile/i);
    expect(getHelpTargetState({
      helper,
      target: { playerID: 2, currentZone: '0,0', dexterity: 0 },
      stat: 'Dexterity',
    }).reason).toMatch(/at least 2/i);
    expect(getHelpTargetState({
      helper,
      target: { playerID: 2, currentZone: '0,0', movement: 4 },
      stat: 'Movement',
    }).reason).toMatch(/already full/i);
  });

  it('ranks reachable critical teammates first and recommends their weakest valid stat', () => {
    const remote = { playerID: 2, currentZone: '2,0', movement: 0, agility: 0, dexterity: 0 };
    const stable = { playerID: 3, currentZone: '0,0', movement: 3, agility: 3, dexterity: 3 };
    const critical = { playerID: 4, currentZone: '0,0', movement: 1, agility: 2, dexterity: 3 };
    const ranked = rankHelpTargets({ helper, crew: [remote, stable, critical], currentLocation: '0,0' });

    expect(ranked.map((player) => player.playerID)).toEqual([4, 3, 2]);
    expect(recommendedHelpStat({ helper, target: critical })).toBe('movement');
  });
});
