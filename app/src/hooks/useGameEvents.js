import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublicClient, useWatchContractEvent } from './useContractEvents';
import { EventsABI, GAME_EVENTS_ADDRESS } from '../config/contracts';
import { parseUintId } from '../lib/ids';
import { useQueryClient } from '@tanstack/react-query';

const EVENT_NAMES = ['ActionSubmit', 'EndGameStarted', 'GameOver', 'GamePhaseChange', 'GameRegistration', 'GameStart', 'LandingSiteSet', 'PlayerIdleKick', 'ProcessingPhaseChange', 'TurnProcessingFail', 'TurnProcessingStart'];
const MAX_EVENTS = 250;
const BLOCK_BATCH = 40_000n;
const CONFIRMATIONS = 3n;

const cacheKey = (gameId) => `xenovoya:game-events:v2:${gameId}`;
const cursorKey = (gameId) => `xenovoya:game-events-cursor:v2:${gameId}`;

function getEventKey(name, log) {
  return `${log.transactionHash || 'unknown'}-${log.logIndex !== undefined ? log.logIndex.toString() : '0'}-${name}`;
}

function mapLog(log, fallbackName) {
  const name = log.eventName || fallbackName;
  return {
    key: getEventKey(name, log), name, args: log.args,
    blockNumber: Number(log.blockNumber ?? 0n), logIndex: Number(log.logIndex ?? 0),
    transactionHash: log.transactionHash, timestamp: Date.now(),
  };
}

function readCache(gameId) {
  try { return JSON.parse(window.localStorage.getItem(cacheKey(gameId)) || '[]'); }
  catch { return []; }
}

function sortByChainOrder(a, b) { return a.blockNumber - b.blockNumber || a.logIndex - b.logIndex; }

export function useGameEvents(gameId) {
  const gid = parseUintId(gameId);
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [events, setEvents] = useState([]);
  const [isLoadingFullHistory, setIsLoadingFullHistory] = useState(false);
  const [eventSyncStatus, setEventSyncStatus] = useState('live');
  const eventDefs = useMemo(() => EventsABI.filter((entry) => entry.type === 'event' && EVENT_NAMES.includes(entry.name)), []);

  const appendEvents = useCallback((incoming) => {
    if (!incoming.length) return;
    setEvents((previous) => {
      const byKey = new Map(previous.map((event) => [event.key, event]));
      incoming.forEach((event) => byKey.set(event.key, event));
      return [...byKey.values()].sort(sortByChainOrder).slice(-MAX_EVENTS);
    });
  }, []);

  const addLiveLogs = useCallback((logs) => {
    if (gid === null) return;
    appendEvents(logs.filter((log) => log.args?.gameID === undefined || log.args.gameID === gid).map((log) => mapLog(log)));
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
    if (gid === null) { setEvents([]); return; }
    setEvents(readCache(gid));
  }, [gid]);

  useEffect(() => {
    if (gid === null || !events.length) return;
    try { window.localStorage.setItem(cacheKey(gid), JSON.stringify(events.slice(-MAX_EVENTS))); } catch { /* cache is optional */ }
  }, [events, gid]);

  const loadFullHistory = useCallback(async () => {
    if (!publicClient || gid === null) return;
    setIsLoadingFullHistory(true);
    setEventSyncStatus('backfilling');
    try {
      const latest = await publicClient.getBlockNumber();
      const confirmed = latest > CONFIRMATIONS ? latest - CONFIRMATIONS : 0n;
      const configuredStart = BigInt(import.meta.env.VITE_GAME_EVENTS_START_BLOCK || 0);
      const boundedStart = configuredStart || (confirmed > 250_000n ? confirmed - 250_000n : 0n);
      const storedCursor = BigInt(window.localStorage.getItem(cursorKey(gid)) || 0);
      let fromBlock = storedCursor >= boundedStart ? storedCursor + 1n : boundedStart;
      while (fromBlock <= confirmed) {
        const toBlock = fromBlock + BLOCK_BATCH - 1n > confirmed ? confirmed : fromBlock + BLOCK_BATCH - 1n;
        const logs = await publicClient.getLogs({ address: GAME_EVENTS_ADDRESS, events: eventDefs, fromBlock, toBlock });
        appendEvents(logs.filter((log) => log.args?.gameID === gid).map((log) => mapLog(log)));
        window.localStorage.setItem(cursorKey(gid), toBlock.toString());
        fromBlock = toBlock + 1n;
      }
      setEventSyncStatus('live');
    } catch {
      setEventSyncStatus('degraded');
    } finally {
      setIsLoadingFullHistory(false);
    }
  }, [appendEvents, eventDefs, gid, publicClient]);

  return { events, clearEvents: () => setEvents([]), loadFullHistory, isLoadingFullHistory, eventSyncStatus };
}
