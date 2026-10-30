import { QueryCache, QueryClient } from '@tanstack/react-query';
import { handleQueryError, shouldRetry } from './query-policy';

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => handleQueryError(queryClient, error, query.queryKey),
  }),
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
});