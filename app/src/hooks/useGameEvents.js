import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublicClient, useWatchContractEvent } from './useContractEvents';
import { EventsABI, GAME_EVENTS_ADDRESS } from '../config/contracts';
import { parseUintId } from '../lib/ids';

const EVENT_NAMES = [
  'ActionSubmit',
  'EndGameStarted',
  'GameOver',
  'GamePhaseChange',
  'GameRegistration',
  'GameStart',
  'LandingSiteSet',
  'PlayerIdleKick',
  'ProcessingPhaseChange',
  'TurnProcessingFail',
  'TurnProcessingStart',
];

const MAX_EVENTS = 250;

function getEventKey(name, log) {
  const tx = log.transactionHash || 'unknown';
  const index = log.logIndex !== undefined ? log.logIndex.toString() : '0';
  return `${tx}-${index}-${name}`;
}

function sortByChainOrder(a, b) {
  const aBlock = Number(a.blockNumber ?? 0n);
  const bBlock = Number(b.blockNumber ?? 0n);
  if (aBlock !== bBlock) return aBlock - bBlock;
  const aIndex = Number(a.logIndex ?? 0n);
  const bIndex = Number(b.logIndex ?? 0n);
  return aIndex - bIndex;
}

export function useGameEvents(gameId) {
  const gid = parseUintId(gameId);
  const publicClient = usePublicClient();
  const [events, setEvents] = useState([]);
  const [isLoadingFullHistory, setIsLoadingFullHistory] = useState(false);

  const eventDefs = useMemo(
    () => EventsABI.filter((entry) => entry.type === 'event' && EVENT_NAMES.includes(entry.name)),
    [],
  );

  const appendEvents = useCallback((incoming) => {
    if (incoming.length === 0) return;
    setEvents((prev) => {
      const seen = new Set(prev.map((event) => event.key));
      const appended = [];
      incoming.forEach((event) => {
        if (seen.has(event.key)) return;
        seen.add(event.key);
        appended.push(event);
      });
      if (appended.length === 0) return prev;
      const next = [...prev, ...appended].sort(sortByChainOrder);
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
    });
  }, []);

  const addLiveLogs = useCallback((name, logs) => {
    if (gid === null) return;
    const mapped = logs
      .filter((log) => {
        const gameIDFromLog = log.args?.gameID;
        return gameIDFromLog === undefined || gameIDFromLog === gid;
      })
      .map((log) => ({
        key: getEventKey(name, log),
        name,
        args: log.args,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
      }));
    appendEvents(mapped);
  }, [appendEvents, gid]);

  EVENT_NAMES.forEach((eventName) => {
    useWatchContractEvent({
      address: GAME_EVENTS_ADDRESS,
      abi: EventsABI,
      eventName,
      enabled: gid !== null,
      onLogs: (logs) => addLiveLogs(eventName, logs),
    });
  });

  useEffect(() => {
    setEvents([]);
  }, [gid]);

  const loadFullHistory = useCallback(async () => {
    if (!publicClient || gid === null) return;
    setIsLoadingFullHistory(true);
    try {
      const allLogs = await Promise.all(
        eventDefs.map(async (eventDef) => {
          const logs = await publicClient.getLogs({
            address: GAME_EVENTS_ADDRESS,
            event: eventDef,
            fromBlock: 0n,
            toBlock: 'latest',
          }).catch(() => []);
          return logs
            .filter((log) => {
              const gameIDFromLog = log.args?.gameID;
              return gameIDFromLog === undefined || gameIDFromLog === gid;
            })
            .map((log) => ({
              key: getEventKey(eventDef.name, log),
              name: eventDef.name,
              args: log.args,
              blockNumber: log.blockNumber,
              logIndex: log.logIndex,
              transactionHash: log.transactionHash,
              timestamp: Date.now(),
            }));
        }),
      );
      appendEvents(allLogs.flat());
    } finally {
      setIsLoadingFullHistory(false);
    }
  }, [appendEvents, eventDefs, gid, publicClient]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    clearEvents,
    loadFullHistory,
    isLoadingFullHistory,
  };
}
