import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const chainQueryClient = new QueryClient();

export default function ChainQueryProvider({ children }) {
  return <QueryClientProvider client={chainQueryClient}>{children}</QueryClientProvider>;
}
