'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import { fetchSubgraphMeta } from '../lib/subgraph-health';

export type SubgraphHealthSource = 'demo' | 'loading' | 'live' | 'lagging' | 'stale' | 'fallback';

const REFRESH_INTERVAL_MS = 15_000;
const LAG_WARNING_BLOCKS = 20n;

export function useSubgraphHealth() {
  const runtime = useRuntimeDeployment();
  const publicClient = usePublicClient();
  const live = runtime.mode === 'live';
  const endpoint = live ? runtime.subgraphUrl : null;

  const indexer = useQuery({
    queryKey: ['subgraph-health', endpoint],
    queryFn: ({ signal }) => fetchSubgraphMeta(endpoint ?? '', signal),
    enabled: live && endpoint !== null,
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: 1,
    staleTime: 12_000,
  });
  const head = useQuery({
    queryKey: ['rpc-head', runtime.chain.id, runtime.chain.rpcUrl],
    queryFn: () => {
      if (publicClient === undefined) throw new Error('The configured RPC client is unavailable.');
      return publicClient.getBlockNumber({ cacheTime: 0 });
    },
    enabled: live && publicClient !== undefined,
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: 1,
    staleTime: 12_000,
  });

  const indexedBlock = indexer.data?.indexedBlock ?? null;
  const headBlock = head.data ?? null;
  const lag = indexedBlock === null || headBlock === null || indexedBlock >= headBlock ? 0n : headBlock - indexedBlock;
  const hasCompleteData = indexedBlock !== null && headBlock !== null;
  const loading = live && !hasCompleteData && (indexer.isPending || head.isPending);
  const refreshFailed = indexer.isError || head.isError;
  const source: SubgraphHealthSource = !live
    ? 'demo'
    : loading
      ? 'loading'
      : !hasCompleteData
        ? 'fallback'
        : refreshFailed || indexer.data?.hasIndexingErrors === true
          ? 'stale'
          : lag > LAG_WARNING_BLOCKS
            ? 'lagging'
            : 'live';

  return {
    source,
    indexedBlock,
    headBlock,
    lag,
    hasIndexingErrors: indexer.data?.hasIndexingErrors ?? false,
    isRefreshing: indexer.isFetching || head.isFetching,
    lastUpdatedAt: Math.max(indexer.dataUpdatedAt, head.dataUpdatedAt) || null,
    refetch: async () => {
      await Promise.all([indexer.refetch(), head.refetch()]);
    },
  };
}
