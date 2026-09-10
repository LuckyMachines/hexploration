import { useEffect } from 'react';
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query';
import { readSessionSnapshot, saveSessionDocument } from '../../lib/sessionPersistence';

const chainQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 4_000,
      gcTime: 15 * 60_000,
      retry: 3,
      retryDelay: (attempt) => Math.min(750 * (2 ** attempt), 8_000) + Math.round(Math.random() * 250),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      placeholderData: (previous) => previous,
    },
    mutations: { retry: 0, networkMode: 'online' },
  },
});

export default function ChainQueryProvider({ children }) {
  useEffect(() => {
    let timer;
    let active = true;
    readSessionSnapshot('query-cache').then((snapshot) => {
      if (active && snapshot) hydrate(chainQueryClient, snapshot);
    }).catch(() => {});
    const unsubscribe = chainQueryClient.getQueryCache().subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveSessionDocument('query-cache', dehydrate(chainQueryClient, {
          shouldDehydrateQuery: (query) => query.state.status === 'success' && query.queryKey[0] !== 'private',
        })).catch(() => {});
      }, 750);
    });
    return () => { active = false; window.clearTimeout(timer); unsubscribe(); };
  }, []);
  return <QueryClientProvider client={chainQueryClient}>{children}</QueryClientProvider>;
}
