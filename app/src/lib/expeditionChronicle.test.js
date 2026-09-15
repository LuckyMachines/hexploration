import { describe, expect, it } from 'vitest';
import { buildExpeditionChronicle, buildExpeditionPassport } from './expeditionChronicle';

describe('expedition chronicle', () => {
  it('turns technical action logs into player-readable history', () => {
    const [entry] = buildExpeditionChronicle([{
      key: 'action-1', name: 'ActionSubmit', args: { playerID: '2', actionID: '1' }, blockNumber: 10, transactionHash: '0xabc',
    }], { confirmedBlock: 12 });
    expect(entry.title).toContain('P2 committed');
    expect(entry.proofUrl).toBeUndefined();
    expect(entry.finality).toBe('recorded');
  });

  it('exports a portable, client-independent expedition pointer', () => {
    expect(buildExpeditionPassport({ gameId: 4, url: 'https://play.test/game/4' })).toMatchObject({
      gameId: '4', resumeUrl: 'https://play.test/game/4', recordedEvents: 0,
    });
  });
});
