'use client';

import { useQuery } from '@tanstack/react-query';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import { fetchPublicRhjSnapshot } from '../lib/rhj-client';

export function useRhjMetadata() {
  const runtime = useRuntimeDeployment();
  const supported = runtime.mode === 'live' && runtime.chain.id === 4663;
  const query = useQuery({
    queryKey: [
      'rhj-public-metadata',
      runtime.chain.id,
      runtime.mode === 'live' ? runtime.manifest.gitCommit : 'unconfigured',
      runtime.mode === 'live' ? runtime.addresses.assetRegistry : 'unconfigured',
      runtime.mode === 'live' ? runtime.addresses.gumBallLens : 'unconfigured',
    ],
    queryFn: async ({ signal }) => {
      const snapshot = await fetchPublicRhjSnapshot(signal);
      if (runtime.mode !== 'live') throw new Error('A live runtime is required for RHJ metadata.');
      for (const asset of snapshot.assets) {
        if (
          asset.identitySource === 'signed-genesis' &&
          (asset.genesisSymbol === null ||
            runtime.assets[asset.genesisSymbol].toLowerCase() !== asset.address.toLowerCase())
        ) {
          throw new Error(`${asset.symbol} RHJ address does not match the active signed manifest.`);
        }
      }
      return snapshot;
    },
    enabled: supported,
    retry: 1,
    staleTime: 15_000,
  });
  const source =
    runtime.mode === 'demo'
      ? ('demo' as const)
      : !supported
        ? ('unsupported' as const)
        : query.data !== undefined
          ? query.isError
            ? ('stale' as const)
            : ('live' as const)
          : query.isPending
            ? ('loading' as const)
            : ('unavailable' as const);
  return { data: query.data, error: query.error, isFetching: query.isFetching, refetch: query.refetch, source };
}
