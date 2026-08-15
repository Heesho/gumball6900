import { type Address, type Hex, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import {
  readLiquidityPositionView,
  readMineSlotView,
  readProtocolGovernorView,
  readProtocolProposalView,
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
  it('returns the Bribe-style schedule and live allocation state at one block', async () => {
    const values: Readonly<Record<string, unknown>> = {
      balanceOf: 700n,
      DURATION: 604_800n,
      left: 600n,
      REWARD_PRECISION: 10n ** 36n,
      resonanceRouter: address(2),
      token_RewardData: [2_600n, 2_100n, 7n, 2_000n, 5n],
      totalSignalWeight: 100n,
      usdg: address(3),
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readResonanceView(client, address(1))).resolves.toEqual({
      blockNumber: BLOCK_NUMBER,
      duration: 604_800n,
      lastUpdateTime: 2_000n,
      left: 600n,
      periodFinish: 2_600n,
      remainderFinish: 2_100n,
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

describe('SignalGBX and protocol governance reads', () => {
  it('reads canonical SignalGBX allocation and voting state', async () => {
    const values: Readonly<Record<string, unknown>> = {
      allocatedBalance: 60n,
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
      allocatedSignalBalance: 60n,
      blockNumber: BLOCK_NUMBER,
      currentVotes: 100n,
      delegate: address(2),
      signalBalance: 100n,
      unallocatedSignalBalance: 40n,
    });
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
  });

  it('reads the fixed Governor graph, parameters, and Timelock delay', async () => {
    const values: Readonly<Record<string, unknown>> = {
      getMinDelay: 86_400n,
      mine: address(2),
      name: 'GumBall6900 Protocol Governor',
      proposalThreshold: 10n,
      quorumDenominator: 100n,
      quorumNumerator: 4n,
      resonance: address(3),
      timelock: address(5),
      token: address(4),
      votingDelay: 7_200n,
      votingPeriod: 50_400n,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readProtocolGovernorView(client, address(1))).resolves.toEqual({
      blockNumber: BLOCK_NUMBER,
      mine: address(2),
      name: 'GumBall6900 Protocol Governor',
      proposalThreshold: 10n,
      quorumDenominator: 100n,
      quorumNumerator: 4n,
      resonance: address(3),
      signalGBX: address(4),
      timelock: address(5),
      timelockMinDelay: 86_400n,
      votingDelay: 7_200n,
      votingPeriod: 50_400n,
    });
  });

  it('reads one proposal lifecycle and snapshot-based vote totals', async () => {
    const values: Readonly<Record<string, unknown>> = {
      clock: 778,
      hasVoted: true,
      proposalDeadline: 900n,
      proposalEta: 1_000n,
      proposalNeedsQueuing: true,
      proposalProposer: address(2),
      proposalSnapshot: 700n,
      proposalVotes: [3n, 20n, 2n],
      quorum: 15n,
      state: 1,
    };
    const readContract = vi.fn(
      async ({ functionName }: { blockNumber: bigint; functionName: string }) => values[functionName],
    );
    const getBlock = vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 2_000n }));
    const client = { getBlock, readContract } as unknown as PublicClient;

    await expect(readProtocolProposalView(client, address(1), 9n, { voter: address(3) })).resolves.toEqual({
      abstainVotes: 2n,
      againstVotes: 3n,
      blockNumber: BLOCK_NUMBER,
      clock: 778n,
      deadline: 900n,
      eta: 1_000n,
      forVotes: 20n,
      hasVoted: true,
      needsQueuing: true,
      proposalId: 9n,
      proposer: address(2),
      quorum: 15n,
      snapshot: 700n,
      state: 1,
    });
  });
});
