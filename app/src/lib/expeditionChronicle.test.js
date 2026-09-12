import { describe, expect, it } from 'vitest';
import { buildExpeditionChronicle, buildExpeditionPassport } from './expeditionChronicle';

describe('expedition chronicle', () => {
  it('turns technical action logs into player-readable history', () => {
    const [entry] = buildExpeditionChronicle([{
      key: 'action-1', name: 'ActionSubmit', args: { playerID: '2', actionID: '1' }, blockNumber: 10, transactionHash: '0xabc',
    }], { chain: { blockExplorers: { default: { url: 'https://scan.test' } } }, confirmedBlock: 12 });
    expect(entry.title).toContain('P2 committed');
    expect(entry.proofUrl).toBe('https://scan.test/tx/0xabc');
    expect(entry.finality).toBe('anchored');
  });

  it('exports a portable, client-independent expedition pointer', () => {
    expect(buildExpeditionPassport({ gameId: 4, chainId: 11155111, url: 'https://play.test/game/4' })).toMatchObject({
      gameId: '4', chainId: 11155111, resumeUrl: 'https://play.test/game/4', latestProof: null,
    });
  });
});
