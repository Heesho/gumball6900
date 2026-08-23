import { type Address, type Hex, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import {
  readBribeRouterView,
  readLiquidityPositionView,
  readMineSlotView,
  readResonanceView,
  readSignalView,
  readStrategyView,
} from '../src/index.js';

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
      aggregateTps: 8n,
      HALVING_PERIOD: 1_000n,
      SLOT_COUNT: 16n,
      TAIL_TPS: 1n,
      claimable: 80n,
      effectiveTotalSupply: 1_020n,
      getSlot: [7n, 100n, 1_000n, 1_500n, 4n, address(2)],
      nextGlobalTps: 2n,
      pendingEmission: 20n,
      price: 50n,
      startTime: 1_000n,
      totalClaimable: 80n,
      totalMined: 1_000n,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readMineSlotView(client, address(1), 0n, address(2))).resolves.toEqual({
      aggregateTps: 8n,
      auctionStartedAt: 1_000n,
      blockNumber: BLOCK_NUMBER,
      blockTimestamp: 2_000n,
      claimablePayment: 80n,
      currentHalvingEra: 1n,
      currentPrice: 50n,
      effectiveTotalSupply: 1_020n,
      epochId: 7n,
      halvingPeriod: 1_000n,
      index: 0n,
      initialPrice: 100n,
      lastAccruedAt: 1_500n,
      mine: address(1),
      nextHalvingBoundary: 3_000n,
      nextGlobalTps: 2n,
      pendingEmission: 20n,
      prospectiveSlotTps: 0n,
      slotCount: 16n,
      slotMiner: address(2),
      startTime: 1_000n,
      tailTps: 1n,
      totalClaimable: 80n,
      totalMined: 1_000n,
      totalPendingEmission: 20n,
      tps: 4n,
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
  it('returns the Bribe-style schedule and live allocation state at one block', async () => {
    const values: Readonly<Record<string, unknown>> = {
      balanceOf: 700n,
      BPS: 10_000n,
      bribeBps: 500n,
      DEFAULT_BRIBE_BPS: 1_000n,
      DURATION: 604_800n,
      left: 600n,
      MAX_BRIBE_BPS: 2_000n,
      REWARD_PRECISION: 10n ** 36n,
      resonanceRouter: address(2),
      rewardData: [2_600n, 7n, 2_000n, 5n],
      totalSignalWeight: 100n,
      usdg: address(3),
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readResonanceView(client, address(1))).resolves.toEqual({
      basisPoints: 10_000n,
      blockNumber: BLOCK_NUMBER,
      bribeBasisPoints: 500n,
      defaultBribeBasisPoints: 1_000n,
      duration: 604_800n,
      fundBasisPoints: 9_500n,
      lastUpdateTime: 2_000n,
      left: 600n,
      maximumBribeBasisPoints: 2_000n,
      periodFinish: 2_600n,
      resonanceRouter: address(2),
      rewardPerTokenStored: 5n,
      rewardPrecision: 10n ** 36n,
      rewardRate: 7n,
      totalSignalWeight: 100n,
      usdg: address(3),
      usdgBalance: 700n,
    });
    expect(getBlock).toHaveBeenCalledTimes(2);
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
  });
});

describe('BribeRouter reads', () => {
  it('returns the minimal buffer and Bribe notification thresholds', async () => {
    const values: Readonly<Record<string, unknown>> = {
      balanceOf: 100n,
      bribe: address(2),
      left: 80n,
      paymentToken: address(4),
      REWARD_DURATION: 604_800n,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readBribeRouterView(client, address(1))).resolves.toEqual({
      blockNumber: BLOCK_NUMBER,
      bribe: address(2),
      bufferedReward: 100n,
      currentRewardLeft: 80n,
      minimumRewardAmount: 604_800n,
      paymentToken: address(4),
    });
  });
});

describe('SignalGBX reads', () => {
  it('reads the canonical fully allocated SignalGBX aggregate and voting state', async () => {
    const values: Readonly<Record<string, unknown>> = {
      balanceOf: 100n,
      delegates: address(2),
      getVotes: 100n,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readSignalView(client, address(1), address(2))).resolves.toEqual({
      blockNumber: BLOCK_NUMBER,
      currentVotes: 100n,
      delegate: address(2),
      signalBalance: 100n,
    });
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
  });
});
