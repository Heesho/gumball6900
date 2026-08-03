import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { useGenesisBootstrapView } from '../hooks/use-protocol-reads';
import { liveRuntimeFixture } from './live-runtime-fixture';

const beneficiary = '0x9999999999999999999999999999999999999999' as const;
const mocked = vi.hoisted(() => {
  const blockHash = `0x${'ab'.repeat(32)}` as const;
  return {
    blockHash,
    getBlock: vi.fn(async () => ({ hash: blockHash, number: 777n, timestamp: 1_234n })),
    readGenesisView: vi.fn(),
  };
});

vi.mock('@gumball-6900/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gumball-6900/sdk')>()),
  readGenesisView: mocked.readGenesisView,
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: beneficiary, isConnected: true }),
  usePublicClient: () => ({ getBlock: mocked.getBlock }),
  useReadContract: () => ({ data: undefined }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>{children}</RuntimeDeploymentProvider>
    </QueryClientProvider>
  );
}

const genesisView = {
  beneficiaryContribution: 10_000n * 10n ** 6n,
  beneficiaryPreviewClaim: 0n,
  blockNumber: 777n,
  bootstrapContributionCap: 200_000n * 10n ** 6n,
  communityUSDG: 10_000n * 10n ** 6n,
  contributionEnd: 90_000n,
  contributionStart: 1_000n,
  genesisPriceWad: 0n,
  minimumBootstrapUSDG: 100_000n * 10n ** 6n,
  requiredSponsorUSDG: 0n,
  settledAt: 0n,
  settlementDeadline: 0n,
  sponsorEscrow: 50_000n * 10n ** 6n,
  state: 2,
  usdGDecimals: 6,
} as const;

describe('hash-bound genesis reads', () => {
  it('binds the SDK lifecycle and beneficiary view to one block number and hash', async () => {
    mocked.getBlock.mockClear();
    mocked.readGenesisView.mockReset().mockResolvedValue(genesisView);
    const { result } = renderHook(() => useGenesisBootstrapView(), { wrapper });

    await waitFor(() => expect(result.current.data?.blockTimestamp).toBe(1_234n));
    expect(mocked.readGenesisView).toHaveBeenCalledWith(
      expect.anything(),
      {
        genesisBootstrap: liveRuntimeFixture.addresses.genesisBootstrap,
        genesisClaims: liveRuntimeFixture.addresses.genesisClaims,
      },
      beneficiary,
      { atBlock: 777n, expectedBlockHash: mocked.blockHash },
    );
    expect(mocked.getBlock).toHaveBeenCalledTimes(3);
  });

  it('exposes no stale fallback when the pinned SDK read fails', async () => {
    mocked.getBlock.mockClear();
    mocked.readGenesisView.mockReset().mockRejectedValue(new Error('block changed'));
    const { result } = renderHook(() => useGenesisBootstrapView(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
