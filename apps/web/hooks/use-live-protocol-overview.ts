'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import { readLiveProtocolOverview } from '../lib/live-protocol-overview';

export type LiveProtocolOverviewSource = 'demo' | 'live-loading' | 'live' | 'live-stale' | 'rpc-fallback';

export function useLiveProtocolOverview() {
  const runtime = useRuntimeDeployment();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && client !== undefined;
  const query = useQuery({
    enabled,
    queryKey: ['live-protocol-overview', runtime.chain.id, runtime.manifest?.gitCommit, runtime.addresses?.gumBallLens],
    queryFn: async () => {
      if (runtime.mode !== 'live' || client === undefined) {
        throw new Error('Validated Lens contracts and an RPC client are required.');
      }
      return readLiveProtocolOverview(client, runtime);
    },
    refetchInterval: 15_000,
    refetchOnMount: 'always',
    retry: false,
    staleTime: 12_000,
  });

  const source: LiveProtocolOverviewSource =
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
