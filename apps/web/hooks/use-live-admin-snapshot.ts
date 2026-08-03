'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import { readLiveAdminSnapshot } from '../lib/live-admin-snapshot';

export type LiveAdminSnapshotSource = 'demo' | 'live-loading' | 'live' | 'live-stale' | 'rpc-fallback';

export function useLiveAdminSnapshot() {
  const runtime = useRuntimeDeployment();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && client !== undefined;
  const query = useQuery({
    enabled,
    queryKey: [
      'live-admin-snapshot',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      runtime.admin?.protocolTimelock,
      runtime.admin?.emergencyGuardian,
    ],
    queryFn: async () => {
      if (runtime.mode !== 'live' || client === undefined) {
        throw new Error('Validated admin contracts and an RPC client are required.');
      }
      return readLiveAdminSnapshot(client, runtime);
    },
    refetchInterval: 8_000,
    refetchOnMount: 'always',
    retry: false,
    staleTime: 6_000,
  });
  const source: LiveAdminSnapshotSource =
    runtime.mode === 'demo'
      ? 'demo'
      : query.data !== undefined && query.error !== null
        ? 'live-stale'
        : query.data !== undefined
          ? 'live'
          : query.isPending
            ? 'live-loading'
            : 'rpc-fallback';
  return { data: query.data, error: query.error, isFetching: query.isFetching, refetch: query.refetch, source };
}
