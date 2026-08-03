import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { useAuctionRead } from '../hooks/use-protocol-reads';
import { liveRuntimeFixture } from './live-runtime-fixture';

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  usePublicClient: () => undefined,
  useReadContract: () => ({ data: undefined, isError: true, isFetching: false, isPending: false }),
}));

describe('contract-enabled read failures', () => {
  it('does not substitute a deterministic auction ID or rate when RPC reads fail', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useAuctionRead({ kind: 'acquisition', strategy: liveRuntimeFixture.strategies.NVDA }),
      {
        wrapper: ({ children }) => (
          <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </RuntimeDeploymentProvider>
        ),
      },
    );

    expect(result.current.source).toBe('rpc-fallback');
    expect(result.current.auctionId).toBeNull();
    expect(result.current.currentRate).toBeNull();
  });
});
