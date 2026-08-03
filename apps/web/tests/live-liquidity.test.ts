import { describe, expect, it, vi } from 'vitest';

import { readLiveLiquidity } from '../lib/live-liquidity';
import { liveRuntimeFixture } from './live-runtime-fixture';

const mocked = vi.hoisted(() => ({ read: vi.fn(async () => ({ blockNumber: 1n })) }));

vi.mock('@gumball-6900/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gumball-6900/sdk')>()),
  readCanonicalV4Snapshot: mocked.read,
}));

describe('live liquidity runtime binding', () => {
  it('passes only signed runtime identities and token metadata to the SDK validator', async () => {
    const client = {} as never;
    await readLiveLiquidity(client, liveRuntimeFixture);
    expect(mocked.read).toHaveBeenCalledWith(client, {
      expected: {
        chainId: liveRuntimeFixture.chain.id,
        gbx: liveRuntimeFixture.assets.GBX,
        gbxDecimals: 18,
        launchGuardHook: liveRuntimeFixture.addresses.launchGuardHook,
        liquidityManager: liveRuntimeFixture.addresses.liquidityManager,
        permit2: liveRuntimeFixture.externalContracts.permit2.address,
        poolManager: liveRuntimeFixture.externalContracts.poolManager.address,
        positionManager: liveRuntimeFixture.externalContracts.positionManager.address,
        stateView: liveRuntimeFixture.externalContracts.stateView.address,
        usdG: liveRuntimeFixture.assets.USDG,
        usdGDecimals: 6,
      },
    });
  });

  it('forwards the pinned subgraph active-position index without changing signed identities', async () => {
    const activePositions = {
      activePositionCount: 2,
      indexedBlock: 55n,
      indexedBlockHash: `0x${'ab'.repeat(32)}` as const,
      migrationCount: 1n,
      positionIds: [101n, 202n],
    };
    const client = {} as never;
    await readLiveLiquidity(client, liveRuntimeFixture, activePositions);
    expect(mocked.read).toHaveBeenLastCalledWith(client, expect.objectContaining({ activePositions }));
  });
});
