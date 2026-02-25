import { useState, useCallback, useRef } from 'react';
import { useWatchContractEvent } from 'wagmi';
import { EventsABI, GAME_EVENTS_ADDRESS } from '../config/contracts';

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

export function useGameEvents(gameId) {
  const [events, setEvents] = useState([]);
  const eventsRef = useRef([]);

  const addEvent = useCallback((name, log) => {
    const gameIDFromLog = log.args?.gameID;
    if (gameId && gameIDFromLog !== undefined && BigInt(gameId) !== gameIDFromLog) return;

    const entry = {
      name,
      args: log.args,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      timestamp: Date.now(),
    };

    setEvents((prev) => {
      const next = [...prev, entry];
      eventsRef.current = next;
      return next;
    });
  }, [gameId]);

  // Watch all game events
  EVENT_NAMES.forEach((eventName) => {
    useWatchContractEvent({
      address: GAME_EVENTS_ADDRESS,
      abi: EventsABI,
      eventName,
      onLogs: (logs) => logs.forEach((l) => addEvent(eventName, l)),
      enabled: !!gameId,
    });
  });

  const clearEvents = useCallback(() => {
    setEvents([]);
    eventsRef.current = [];
  }, []);

  return { events, clearEvents };
}
