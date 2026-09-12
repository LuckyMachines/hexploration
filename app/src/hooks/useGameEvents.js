import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePublicClient, useWatchContractEvent } from './useContractEvents';
import { EventsABI, GAME_EVENTS_ADDRESS } from '../config/contracts';
import { parseUintId } from '../lib/ids';
import {
  mapChainLog,
  parseEventCache,
  reconcileChainEvents,
  serializeEventCache,
} from '../lib/chainEventStore';

const EVENT_NAMES = ['ActionSubmit', 'EndGameStarted', 'GameOver', 'GamePhaseChange', 'GameRegistration', 'GameStart', 'LandingSiteSet', 'PlayerIdleKick', 'ProcessingPhaseChange', 'TurnProcessingFail', 'TurnProcessingStart'];
const MAX_EVENTS = 250;
const BLOCK_BATCH = 40_000n;
const CONFIRMATIONS = 3n;
const REORG_RECHECK_BLOCKS = 12n;
const FAST_HISTORY_BLOCKS = 5_000n;

const eventScope = (gameId, chainId) => `${chainId || 'unknown'}:${String(GAME_EVENTS_ADDRESS || '').toLowerCase()}:${gameId}`;
const cacheKey = (gameId, chainId) => `xenovoya:game-events:v3:${eventScope(gameId, chainId)}`;
const cursorKey = (gameId, chainId) => `xenovoya:game-events-cursor:v3:${eventScope(gameId, chainId)}`;

function belongsToGame(log, gameId) {
  return log.args?.gameID === undefined || String(log.args.gameID) === String(gameId);
}

function readCache(gameId, chainId) {
  if (typeof window === 'undefined') return { events: [], confirmedBlock: 0 };
  return parseEventCache(window.localStorage.getItem(cacheKey(gameId, chainId)) || '');
}

export function useGameEvents(gameId) {
  const gid = parseUintId(gameId);
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  const queryClient = useQueryClient();
  const [events, setEvents] = useState([]);
  const [isLoadingFullHistory, setIsLoadingFullHistory] = useState(false);
  const [eventSyncStatus, setEventSyncStatus] = useState('restoring');
  const [confirmedBlock, setConfirmedBlock] = useState(0);
  const syncInFlight = useRef(false);
  const eventDefs = useMemo(() => EventsABI.filter((entry) => entry.type === 'event' && EVENT_NAMES.includes(entry.name)), []);

  const appendEvents = useCallback((incoming, options = {}) => {
    if (!incoming.length && options.canonicalFromBlock === undefined) return;
    setEvents((previous) => reconcileChainEvents(previous, incoming, { max: MAX_EVENTS, ...options }));
  }, []);

  const addLiveLogs = useCallback((logs) => {
    if (gid === null) return;
    appendEvents(logs.filter((log) => belongsToGame(log, gid)).map((log) => mapChainLog(log)));
    queryClient.invalidateQueries({ predicate: (query) => JSON.stringify(query.queryKey).includes(gid.toString()) });
    setEventSyncStatus('live');
  }, [appendEvents, gid, queryClient]);

  useWatchContractEvent({
    address: GAME_EVENTS_ADDRESS,
    abi: EventsABI,
    events: eventDefs,
    enabled: gid !== null,
    onLogs: addLiveLogs,
    onError: () => setEventSyncStatus('polling'),
  });

  useEffect(() => {
    if (gid === null) {
      setEvents([]);
      setConfirmedBlock(0);
      return;
    }
    const cached = readCache(gid, chainId);
    setEvents(cached.events || []);
    setConfirmedBlock(Number(cached.confirmedBlock || 0));
  }, [chainId, gid]);

  useEffect(() => {
    if (gid === null || typeof window === 'undefined') return;
    try { window.localStorage.setItem(cacheKey(gid, chainId), serializeEventCache(events.slice(-MAX_EVENTS), confirmedBlock)); }
    catch { /* cache is an acceleration layer, never the source of truth */ }
  }, [chainId, confirmedBlock, events, gid]);

  const synchronizeHistory = useCallback(async ({ full = false } = {}) => {
    if (!publicClient || gid === null || syncInFlight.current) return;
    syncInFlight.current = true;
    if (full) setIsLoadingFullHistory(true);
    setEventSyncStatus(full ? 'backfilling' : 'syncing');
    try {
      const latest = await publicClient.getBlockNumber();
      const confirmed = latest > CONFIRMATIONS ? latest - CONFIRMATIONS : 0n;
      const configuredStart = BigInt(import.meta.env.VITE_GAME_EVENTS_START_BLOCK || 0);
      const boundedStart = configuredStart || (confirmed > 250_000n ? confirmed - 250_000n : 0n);
      const storedCursor = BigInt(window.localStorage.getItem(cursorKey(gid, chainId)) || 0);
      const recentFloor = confirmed > FAST_HISTORY_BLOCKS ? confirmed - FAST_HISTORY_BLOCKS : 0n;
      const recheckFrom = storedCursor > REORG_RECHECK_BLOCKS ? storedCursor - REORG_RECHECK_BLOCKS : 0n;
      let fromBlock = full
        ? boundedStart
        : [boundedStart, storedCursor ? recheckFrom : recentFloor].reduce((highest, value) => value > highest ? value : highest, 0n);
      const canonicalFromBlock = Number(fromBlock);
      const canonical = [];

      while (fromBlock <= confirmed) {
        const toBlock = fromBlock + BLOCK_BATCH - 1n > confirmed ? confirmed : fromBlock + BLOCK_BATCH - 1n;
        const logs = await publicClient.getLogs({ address: GAME_EVENTS_ADDRESS, events: eventDefs, fromBlock, toBlock });
        canonical.push(...logs.filter((log) => belongsToGame(log, gid)).map((log) => mapChainLog(log)));
        fromBlock = toBlock + 1n;
      }

      appendEvents(canonical, { canonicalFromBlock, canonicalToBlock: Number(confirmed) });
      window.localStorage.setItem(cursorKey(gid, chainId), confirmed.toString());
      setConfirmedBlock(Number(confirmed));
      setEventSyncStatus('live');
    } catch {
      setEventSyncStatus('degraded');
    } finally {
      syncInFlight.current = false;
      if (full) setIsLoadingFullHistory(false);
    }
  }, [appendEvents, chainId, eventDefs, gid, publicClient]);

  useEffect(() => {
    if (gid === null) return undefined;
    void synchronizeHistory();
    const interval = window.setInterval(() => {
      if (!document.hidden && navigator.onLine) void synchronizeHistory();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [gid, synchronizeHistory]);

  const loadFullHistory = useCallback(() => synchronizeHistory({ full: true }), [synchronizeHistory]);

  return {
    events,
    clearEvents: () => setEvents([]),
    loadFullHistory,
    isLoadingFullHistory,
    eventSyncStatus,
    confirmedBlock,
  };
}
