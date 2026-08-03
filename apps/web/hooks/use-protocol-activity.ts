'use client';

import { useQuery } from '@tanstack/react-query';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import {
  fetchProtocolActivityPage,
  type ProtocolActivityCursor,
  type ProtocolActivityFilter,
  type ProtocolActivityPage,
} from '../lib/subgraph-activity';

export type ProtocolActivitySource = 'demo' | 'loading' | 'live' | 'stale' | 'unavailable';

export function useProtocolActivity(
  filter: ProtocolActivityFilter,
  cursor: ProtocolActivityCursor | null = null,
  pageSize = 12,
): Readonly<{
  data: ProtocolActivityPage | undefined;
  error: Error | null;
  isFetching: boolean;
  source: ProtocolActivitySource;
  refetch: () => Promise<unknown>;
}> {
  const runtime = useRuntimeDeployment();
  const endpoint = runtime.mode === 'live' ? runtime.subgraphUrl : null;
  const cursorKey =
    cursor === null
      ? null
      : [
          cursor.indexedBlock.toString(),
          cursor.indexedBlockHash,
          cursor.before?.blockNumber.toString() ?? null,
          cursor.before?.logIndex.toString() ?? null,
          cursor.before?.eventId ?? null,
        ];
  const query = useQuery({
    queryKey: ['protocol-activity', endpoint, filter, cursorKey, pageSize],
    queryFn: ({ signal }) =>
      fetchProtocolActivityPage(endpoint ?? '', {
        cursor,
        filter,
        pageSize,
        signal,
      }),
    enabled: endpoint !== null,
    retry: 1,
    staleTime: 12_000,
  });

  const source: ProtocolActivitySource =
    runtime.mode === 'demo'
      ? 'demo'
      : query.data !== undefined
        ? query.isError
          ? 'stale'
          : 'live'
        : query.isPending
          ? 'loading'
          : 'unavailable';

  return {
    data: query.data,
    error: query.error,
    isFetching: query.isFetching,
    source,
    refetch: query.refetch,
  };
}
