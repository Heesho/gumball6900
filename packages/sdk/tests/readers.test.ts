import { type Address, type Hex, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { readLiquidityPositionView, readMineSlotView, readResonanceView, readStrategyView } from '../src/index.js';

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

describe('Mine and liquidity reads', () => {
  it('reads a tenure-locked Mine slot and global accounting at one block', async () => {
    const values: Readonly<Record<string, unknown>> = {
      capacity: 2n,
      claimable: 80n,
      effectiveTotalSupply: 1_020n,
      getSlot: [7n, 100n, 1_000n, 1_500n, 4n, address(2)],
      nextGlobalUps: 2n,
      pendingEmission: 20n,
      price: 50n,
      totalClaimable: 80n,
      totalMined: 1_000n,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readMineSlotView(client, address(1), 0n, address(2))).resolves.toEqual({
      auctionStartedAt: 1_000n,
      blockNumber: BLOCK_NUMBER,
      capacity: 2n,
      claimablePayment: 80n,
      currentPrice: 50n,
      effectiveTotalSupply: 1_020n,
      epochId: 7n,
      index: 0n,
      initialPrice: 100n,
      lastAccruedAt: 1_500n,
      mine: address(1),
      nextGlobalUps: 2n,
      pendingEmission: 20n,
      slotMiner: address(2),
      totalClaimable: 80n,
      totalMined: 1_000n,
      ups: 4n,
    });
  });

  it('reads the canonical v4 position custody and range state', async () => {
    const poolKeyHash = `0x${'cd'.repeat(32)}`;
    const values: Readonly<Record<string, unknown>> = {
      expectedPositionTokenId: 11n,
      expectedTickLower: -120,
      expectedTickUpper: -60,
      fund: address(2),
      poolKeyHash,
      positionInCustody: true,
      positionRecorded: true,
      positionTokenId: 11n,
      resonanceRouter: address(3),
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

describe('Resonance reads', () => {
  it('returns the complete scheduled and released revenue state at one block', async () => {
    const values: Readonly<Record<string, unknown>> = {
      accountedRevenueBalance: 700n,
      fundRevenueRemainderScaled: 3n,
      fundRevenueLiability: 0n,
      INDEX_PRECISION: 10n ** 36n,
      indexedRevenueScaled: 20n,
      pendingRevenueScaled: 30n,
      queuedRevenue: 100n,
      releasableRevenueScaled: 40n,
      revenueIndex: 5n,
      REVENUE_STREAM_DURATION: 604_800n,
      revenueStreamFinish: 2_600n,
      revenueStreamLastUpdate: 2_000n,
      revenueStreamRateScaled: 7n,
      revenueStreamRemainderFinish: 2_100n,
      revenueStreamRemainingScaled: 600n,
      strategies: [address(2)],
      totalClaimableRevenue: 10n,
      totalSignalWeight: 100n,
      unaccountedRevenue: 0n,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;
    const { INDEX_PRECISION: indexPrecision, REVENUE_STREAM_DURATION: revenueStreamDuration, ...expected } = values;

    await expect(readResonanceView(client, address(1))).resolves.toEqual({
      ...expected,
      blockNumber: BLOCK_NUMBER,
      indexPrecision,
      revenueStreamDuration,
    });
    expect(getBlock).toHaveBeenCalledTimes(2);
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
  });
});
