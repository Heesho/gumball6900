import { type Address, type Hex, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { readFundraiserEpochView, readLiquidityPositionView, readStrategyView } from '../src/index.js';

const address = (value: number): Address => `0x${value.toString(16).padStart(40, '0')}`;
const BLOCK_NUMBER = 777n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hex;

describe('Strategy reads', () => {
  it('pins the complete Strategy view to one revalidated block', async () => {
    const values: Readonly<Record<string, unknown>> = {
      availableRevenue: 50n,
      currentPrice: 9n,
      epochDuration: 86_400n,
      epochId: 3n,
      epochStartedAt: 1_900n,
      fund: address(2),
      initialPrice: 10n,
      kind: 0,
      minimumPrice: 1n,
      paymentToken: address(3),
      priceMultiplier: 1_100_000_000_000_000_000n,
      revenueToken: address(4),
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readStrategyView(client, address(1))).resolves.toEqual({
      ...values,
      blockNumber: BLOCK_NUMBER,
      strategy: address(1),
    });
    expect(getBlock).toHaveBeenCalledTimes(2);
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
  });
});

describe('Fundraiser and liquidity reads', () => {
  it('reads settled Fundraiser state instead of recomputing sequential emissions', async () => {
    const values: Readonly<Record<string, unknown>> = {
      accountContributions: 25n,
      accountHasClaimed: false,
      currentEpoch: 8n,
      currentScheduledEmission: 90n,
      epochContributions: 100n,
      epochEmission: 80n,
      epochSettled: true,
      nextEpochToSettle: 8n,
      pendingReward: 20n,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readFundraiserEpochView(client, address(1), 7n, address(2))).resolves.toEqual({
      accountContribution: 25n,
      accountHasClaimed: false,
      blockNumber: BLOCK_NUMBER,
      currentEpoch: 8n,
      emission: 80n,
      epoch: 7n,
      epochSettled: true,
      nextEpochToSettle: 8n,
      nextScheduledEmission: 90n,
      pendingReward: 20n,
      totalContributions: 100n,
    });
  });

  it('reads the canonical v4 position custody and range state', async () => {
    const poolKeyHash = `0x${'cd'.repeat(32)}`;
    const values: Readonly<Record<string, unknown>> = {
      expectedPositionTokenId: 11n,
      expectedTickLower: -120,
      expectedTickUpper: -60,
      poolKeyHash,
      positionInCustody: true,
      positionRecorded: true,
      positionTokenId: 11n,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readLiquidityPositionView(client, address(1))).resolves.toEqual({
      ...values,
      blockNumber: BLOCK_NUMBER,
    });
  });
});
