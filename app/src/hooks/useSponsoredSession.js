import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAddress } from 'viem';
import { useWallet } from '../contexts/WalletContext';
import { usePlayerSession } from '../contexts/PlayerSessionContext';
import { BOARD_ADDRESS, SESSION_FORWARDER_ADDRESS } from '../config/contracts';
import { SessionForwarderABI } from '../config/sessionForwarder';
import { getPublicClient } from '../config/clients';
import { useContractWrite } from './useContractWrite';
import {
  clearSponsorSession,
  createSponsorSession,
  getSponsorRelayConfig,
  loadSponsorSession,
  relaySponsoredAction,
  signSponsoredAction,
  sponsorRelayConfigured,
} from '../lib/sponsorRelay';
import { normalizeTransactionError, TRANSACTION_PHASES } from '../lib/transactionExperience';

const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const SESSION_ACTION_LIMIT = 30;

function relayScopeMatches(relay, scope) {
  if (!relay) return undefined;
  try {
    return Number(relay.chainId) === Number(scope.chainId)
      && getAddress(relay.forwarderAddress) === getAddress(scope.forwarderAddress)
      && getAddress(relay.boardAddress) === getAddress(scope.boardAddress);
  } catch { return false; }
}

export function useSponsoredSession({ gameId, playerID }) {
  const { address, chainId, isConnected } = useWallet();
  const playerSession = usePlayerSession();
  const queryClient = useQueryClient();
  const authorizationTx = useContractWrite();
  const [session, setSession] = useState(null);
  const [submission, setSubmission] = useState({
    lifecycle: { phase: TRANSACTION_PHASES.IDLE }, hash: null, isPending: false, isConfirming: false, isSuccess: false, error: null,
  });
  const protocolEnabled = import.meta.env.VITE_CONTROLLER_SUPPORTS_DELEGATION === 'true';
  const scope = useMemo(() => ({
    chainId,
    player: address,
    gameId: gameId ? String(gameId) : null,
    boardAddress: BOARD_ADDRESS,
    forwarderAddress: SESSION_FORWARDER_ADDRESS,
  }), [address, chainId, gameId]);
  const configured = protocolEnabled && sponsorRelayConfigured() && Boolean(
    chainId && address && gameId && playerID && BOARD_ADDRESS && SESSION_FORWARDER_ADDRESS,
  );

  useEffect(() => {
    setSession(configured ? loadSponsorSession(scope) : null);
  }, [configured, scope]);

  const relay = useQuery({
    queryKey: ['sponsorRelayConfig', chainId, SESSION_FORWARDER_ADDRESS],
    queryFn: getSponsorRelayConfig,
    enabled: configured,
    staleTime: 30_000,
    retry: 1,
  });

  const authorization = useQuery({
    queryKey: ['sponsorAuthorization', chainId, address, session?.sessionAddress, gameId],
    queryFn: async () => {
      const result = await getPublicClient(chainId).readContract({
        address: SESSION_FORWARDER_ADDRESS,
        abi: SessionForwarderABI,
        functionName: 'sessionAuthorizations',
        args: [address, session.sessionAddress, BOARD_ADDRESS, BigInt(gameId)],
      });
      return { expiresAt: Number(result[0]), remainingActions: Number(result[1]) };
    },
    enabled: configured && Boolean(session?.sessionAddress),
    refetchInterval: 15_000,
  });

  const relayMatches = relayScopeMatches(relay.data, scope);
  const isReady = Boolean(
    configured
    && relayMatches
    && !relay.data?.paused
    && authorization.data?.remainingActions > 0
    && authorization.data?.expiresAt > Math.floor(Date.now() / 1000),
  );

  const authorize = useCallback(async () => {
    if (!configured || !isConnected) throw new Error('Connect the registered wallet before enabling sponsored turns.');
    const nextSession = session || createSponsorSession(scope);
    setSession(nextSession);
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS);
    await authorizationTx.writeContractAsync({
      address: SESSION_FORWARDER_ADDRESS,
      abi: SessionForwarderABI,
      functionName: 'authorizeSessionKey',
      args: [nextSession.sessionAddress, BigInt(gameId), BOARD_ADDRESS, expiresAt, SESSION_ACTION_LIMIT],
    }, { gameId: String(gameId), actionLabel: 'Enable sponsored turns', authorizationMode: 'session-key' });
    await authorization.refetch();
    return nextSession;
  }, [authorization, authorizationTx, configured, gameId, isConnected, scope, session]);

  const revoke = useCallback(async () => {
    if (!session) return;
    const sessionAddress = session.sessionAddress;
    // Remove signing authority from this tab immediately. If the wallet rejects
    // the on-chain revoke, the old key still cannot be recovered by the client.
    clearSponsorSession(scope);
    setSession(null);
    await authorizationTx.writeContractAsync({
      address: SESSION_FORWARDER_ADDRESS,
      abi: SessionForwarderABI,
      functionName: 'revokeSessionKey',
      args: [sessionAddress, BigInt(gameId), BOARD_ADDRESS],
    }, { gameId: String(gameId), actionLabel: 'Revoke sponsored turns', authorizationMode: 'session-key' });
    await authorization.refetch();
  }, [authorization, authorizationTx, gameId, scope, session]);

  const submitAction = useCallback(async (actionIndex, options = [], leftHand = '', rightHand = '') => {
    if (!isReady || !session) throw new Error('Sponsored turns are not active for this expedition.');
    setSubmission({ lifecycle: { phase: TRANSACTION_PHASES.SIMULATING, updatedAt: Date.now() }, hash: null, isPending: true, isConfirming: false, isSuccess: false, error: null });
    let hash;
    try {
      const client = getPublicClient(chainId);
      const nonce = await client.readContract({
        address: SESSION_FORWARDER_ADDRESS,
        abi: SessionForwarderABI,
        functionName: 'actionNonces',
        args: [session.sessionAddress],
      });
      const signed = await signSponsoredAction(session, {
        player: address,
        playerID: BigInt(playerID),
        actionIndex,
        options,
        leftHand,
        rightHand,
        gameID: BigInt(gameId),
        boardAddress: BOARD_ADDRESS,
        nonce,
        deadline: BigInt(Math.floor(Date.now() / 1000) + Math.min(Number(relay.data.maxDeadlineSeconds || 600), 600)),
      });
      setSubmission((current) => ({ ...current, lifecycle: { phase: TRANSACTION_PHASES.SUBMITTED, updatedAt: Date.now() } }));
      const result = await relaySponsoredAction(signed);
      hash = result.hash;
      if (!hash) throw new Error('Sponsor relay accepted the request without returning a transaction hash.');
      playerSession.recordPendingTransaction({
        hash,
        chainId,
        account: address.toLowerCase(),
        action: 'submitAction',
        actionLabel: `Sponsored action ${actionIndex}`,
        gameId: String(gameId),
        playerID: String(playerID),
        actionIndex,
        status: TRANSACTION_PHASES.CONFIRMING,
        submittedAt: new Date().toISOString(),
        authorizationMode: 'sponsored-session',
      });
      setSubmission({ lifecycle: { phase: TRANSACTION_PHASES.CONFIRMING, hash, chainId, sponsored: true, updatedAt: Date.now() }, hash, isPending: false, isConfirming: true, isSuccess: false, error: null });
      const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 180_000 });
      if (receipt.status !== 'success') throw new Error('Sponsored transaction reverted before confirmation.');
      playerSession.settleTransaction(hash, TRANSACTION_PHASES.CONFIRMED, { blockNumber: receipt.blockNumber?.toString?.(), sponsored: true });
      setSubmission({ lifecycle: { phase: TRANSACTION_PHASES.CONFIRMED, hash, chainId, sponsored: true, blockNumber: receipt.blockNumber, updatedAt: Date.now() }, hash, isPending: false, isConfirming: false, isSuccess: true, error: null });
      await Promise.all([
        authorization.refetch(),
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'readContract' || query.queryKey[0] === 'readContracts' }),
      ]);
      return hash;
    } catch (error) {
      const normalized = normalizeTransactionError(error);
      const phase = hash && ['timeout', 'network'].includes(normalized?.code) ? TRANSACTION_PHASES.UNRESOLVED : TRANSACTION_PHASES.FAILED;
      if (hash) playerSession.settleTransaction(hash, phase, { error: normalized, sponsored: true });
      setSubmission({ lifecycle: { phase, hash, chainId, sponsored: true, error: normalized, updatedAt: Date.now() }, hash, isPending: false, isConfirming: false, isSuccess: false, error });
      throw error;
    }
  }, [address, authorization, chainId, gameId, isReady, playerID, playerSession, queryClient, relay.data, session]);

  return {
    configured,
    relayStatus: relay.status,
    relayError: relay.error,
    relay: relay.data,
    relayMatches,
    session,
    authorization: authorization.data,
    authorizationStatus: authorization.status,
    isReady,
    authorize,
    revoke,
    authorizationTx,
    submitAction,
    submission,
  };
}
