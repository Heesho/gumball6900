'use client';

import { useQuery } from '@tanstack/react-query';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import { fetchProtocolSummary } from '../lib/subgraph-summary';

export type ProtocolSummarySource = 'demo' | 'loading' | 'live' | 'stale' | 'unavailable';

export function useProtocolSummary() {
  const runtime = useRuntimeDeployment();
  const endpoint = runtime.mode === 'live' ? runtime.subgraphUrl : null;
  const query = useQuery({
    enabled: endpoint !== null,
    queryKey: ['protocol-summary', endpoint, runtime.chain.id],
    queryFn: ({ signal }) => fetchProtocolSummary(endpoint ?? '', runtime.chain.id, signal),
    refetchInterval: 20_000,
    retry: 1,
    staleTime: 12_000,
  });
  const source: ProtocolSummarySource =
    runtime.mode === 'demo'
      ? 'demo'
      : query.data !== undefined && query.error !== null
        ? 'stale'
        : query.data !== undefined
          ? 'live'
          : query.isPending
            ? 'loading'
            : 'unavailable';
  return {
    data: query.data,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
    source,
  };
}
