import { useReadContract } from './useContractRead';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';
import { useMemo } from 'react';
import { useWatchContractEvent } from './useContractEvents';
import { EventsABI, GAME_EVENTS_ADDRESS } from '../config/contracts';

export function useAllPlayers(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('allPlayers', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
      refetchInterval: 5000,
    },
  });
  const events = useMemo(() => EventsABI.filter((entry) => entry.type === 'event' && entry.name === 'GameRegistration'), []);
  const args = useMemo(() => gid === null ? undefined : ({ gameID: gid }), [gid]);
  useWatchContractEvent({ address: GAME_EVENTS_ADDRESS, abi: EventsABI, events, args, enabled: gid !== null, onLogs: refetch });

  return {
    players: Array.isArray(data) ? data : [],
    isLoading,
    error,
    refetch,
  };
}
