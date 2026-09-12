import { describe, expect, it } from 'vitest';
import { recoverTypedDataAddress } from 'viem';
import {
  createSponsorSession,
  loadSponsorSession,
  signSponsoredAction,
  sponsoredActionTypedData,
} from './sponsorRelay';

const player = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const boardAddress = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const forwarderAddress = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

describe('sponsor relay client', () => {
  it('stores an ephemeral session only under its exact chain, player, board, and game scope', () => {
    const scope = { chainId: 11155111, player, gameId: '42', boardAddress, forwarderAddress };
    const session = createSponsorSession(scope, sessionStorage);
    expect(loadSponsorSession(scope, sessionStorage)?.sessionAddress).toBe(session.sessionAddress);
    expect(loadSponsorSession({ ...scope, gameId: '43' }, sessionStorage)).toBeNull();
  });

  it('signs the forwarder EIP-712 action with the ephemeral session key', async () => {
    const session = createSponsorSession({ chainId: 11155111, player, gameId: '42', boardAddress, forwarderAddress }, sessionStorage);
    const action = await signSponsoredAction(session, {
      player, playerID: 7n, actionIndex: 1, options: ['2,3'], leftHand: '', rightHand: '', gameID: 42n, boardAddress, nonce: 0n, deadline: 9999999999n,
    });
    await expect(recoverTypedDataAddress({ ...sponsoredActionTypedData(action, session), signature: action.signature })).resolves.toBe(session.sessionAddress);
  });
});
