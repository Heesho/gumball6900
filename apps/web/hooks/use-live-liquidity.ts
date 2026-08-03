'use client';

import { useQuery } from '@tanstack/react-query';
import type { CanonicalV4ActivePositionIndex } from '@gumball-6900/sdk';
import { usePublicClient } from 'wagmi';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import { readLiveLiquidity } from '../lib/live-liquidity';
import { fetchLiquidityPositionIndex } from '../lib/subgraph-liquidity';

export type LiveLiquiditySource = 'demo' | 'live-loading' | 'live' | 'live-stale' | 'rpc-fallback';

export function useLiveLiquidity() {
  const runtime = useRuntimeDeployment();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && client !== undefined;
  const query = useQuery({
    enabled,
    queryKey: [
      'live-liquidity',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      runtime.addresses?.liquidityManager,
      runtime.externalContracts?.stateView.address,
      runtime.externalContracts?.positionManager.address,
      runtime.subgraphUrl,
    ],
    queryFn: async ({ signal }) => {
      if (runtime.mode !== 'live' || client === undefined) {
        throw new Error('A validated canonical v4 runtime and RPC client are required.');
      }
      let activePositions: CanonicalV4ActivePositionIndex;
      try {
        activePositions = await fetchLiquidityPositionIndex(runtime.subgraphUrl, {
          chainId: runtime.chain.id,
          liquidityManager: runtime.addresses.liquidityManager,
          signal,
        });
      } catch (positionIndexError) {
        try {
          // The SDK permits this fallback only while the onchain migration counter is still zero.
          return await readLiveLiquidity(client, runtime);
        } catch (fallbackError) {
          throw new AggregateError(
            [positionIndexError, fallbackError],
            'Canonical liquidity state and its active-position index could not be validated.',
          );
        }
      }
      return readLiveLiquidity(client, runtime, activePositions);
    },
    refetchInterval: 15_000,
    refetchOnMount: 'always',
    retry: false,
    staleTime: 12_000,
  });

  const source: LiveLiquiditySource =
    runtime.mode === 'demo'
      ? 'demo'
      : query.data !== undefined && query.error !== null
        ? 'live-stale'
        : query.data !== undefined
          ? 'live'
          : query.isPending
            ? 'live-loading'
            : 'rpc-fallback';

  return {
    data: query.data,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
    source,
  };
}
