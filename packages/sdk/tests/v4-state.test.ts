import { type Address, type Hex, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import {
  canonicalPoolId,
  canonicalPoolKey,
  canonicalV4GBXPriceInUSDG,
  canonicalV4PositionPrincipal,
  canonicalV4UncollectedFees,
  MAX_CANONICAL_V4_ACTIVE_POSITIONS,
  readCanonicalV4Snapshot,
  sqrtPriceX96AtTick,
} from '../src/index.js';

const address = (seed: number): Address => `0x${seed.toString(16).padStart(40, '0')}`;
const GBX = address(1);
const USDG = address(2);
const HOOK = address(3);
const LIQUIDITY_MANAGER = address(4);
const POOL_MANAGER = address(5);
const POSITION_MANAGER = address(6);
const PERMIT2 = address(7);
const STATE_VIEW = address(8);
const BLOCK = 777n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hex;
const Q96 = 1n << 96n;
const MASK_256 = (1n << 256n) - 1n;
const POSITION_POOL_MASK = MASK_256 ^ ((1n << 56n) - 1n);
const positionIds = [101n, 102n, 103n, 104n] as const;
const allocations = [5_000, 3_000, 1_500, 500] as const;
const ranges = [
  [-4_080, -60],
  [-10_980, -60],
  [-17_940, -60],
  [-24_900, -60],
] as const;
const liquidities = [50_000n, 30_000n, 15_000n, 5_000n] as const;
const REPLACEMENT_POSITION_ID = 201n;
const REPLACEMENT_RANGE = [-120, 120] as const;
const REPLACEMENT_LIQUIDITY = 25_000n;

const expected = {
  chainId: 4663,
  gbx: GBX,
  gbxDecimals: 18,
  launchGuardHook: HOOK,
  liquidityManager: LIQUIDITY_MANAGER,
  permit2: PERMIT2,
  poolManager: POOL_MANAGER,
  positionManager: POSITION_MANAGER,
  stateView: STATE_VIEW,
  usdG: USDG,
  usdGDecimals: 6,
} as const;

const activeIndex = (
  overrides: Partial<{
    activePositionCount: number;
    indexedBlock: bigint;
    indexedBlockHash: Hex;
    migrationCount: bigint;
    positionIds: readonly bigint[];
  }> = {},
) => ({
  activePositionCount: 4,
  indexedBlock: BLOCK,
  indexedBlockHash: BLOCK_HASH,
  migrationCount: 1n,
  positionIds: [102n, 103n, 104n, REPLACEMENT_POSITION_ID],
  ...overrides,
});

function encodedInt24(value: number): bigint {
  return BigInt(value < 0 ? 0x1_00_0000 + value : value);
}

function packedInfoForRange(
  range: readonly [number, number],
  poolId = canonicalPoolId(GBX, USDG, HOOK, expected),
): bigint {
  return (BigInt(poolId) & POSITION_POOL_MASK) | (encodedInt24(range[0]) << 8n) | (encodedInt24(range[1]) << 32n);
}

function packedInfo(index: number, poolId = canonicalPoolId(GBX, USDG, HOOK, expected)): bigint {
  return packedInfoForRange(ranges[index]!, poolId);
}

function snapshotClient(
  options: Readonly<{
    confirmationBlock?: bigint;
    confirmationHash?: Hex;
    currentFeeGrowth?: readonly [bigint, bigint];
    allGenesisInactive?: boolean;
    inactiveGenesisIndex?: number;
    lastFeeGrowth?: readonly [bigint, bigint];
    maxActivePositions?: bigint;
    migrationCount?: bigint;
    activePositionCount?: bigint;
    owner?: Address;
    packedPositionInfo?: bigint;
    replacementExists?: boolean;
    stateViewPoolManager?: Address;
  }> = {},
) {
  const key = canonicalPoolKey(GBX, USDG, HOOK, expected);
  const recordFor = (tokenId: bigint): readonly [number, number, bigint, bigint, boolean] => {
    const genesisIndex = positionIds.indexOf(tokenId as (typeof positionIds)[number]);
    if (genesisIndex !== -1) {
      const range = ranges[genesisIndex]!;
      return [
        range[0],
        range[1],
        liquidities[genesisIndex]!,
        BigInt(allocations[genesisIndex]!) * 2_000n * 10n ** 18n,
        options.allGenesisInactive !== true && genesisIndex !== options.inactiveGenesisIndex,
      ];
    }
    if (tokenId === REPLACEMENT_POSITION_ID) {
      return [REPLACEMENT_RANGE[0], REPLACEMENT_RANGE[1], REPLACEMENT_LIQUIDITY, 0n, options.replacementExists ?? true];
    }
    return [0, 0, 0n, 0n, false];
  };
  const readContract = vi.fn(
    async ({
      address: contract,
      args,
      functionName,
    }: {
      address: Address;
      args?: readonly unknown[];
      blockNumber: bigint;
      functionName: string;
    }) => {
      if (contract.toLowerCase() === LIQUIDITY_MANAGER.toLowerCase()) {
        const values: Record<string, unknown> = {
          GBX,
          LAUNCH_GUARD_HOOK: HOOK,
          MAX_ACTIVE_POSITIONS: options.maxActivePositions ?? BigInt(MAX_CANONICAL_V4_ACTIVE_POSITIONS),
          PERMIT2,
          POOL_FEE: 3_000,
          POOL_MANAGER,
          POSITION_MANAGER,
          TICK_SPACING: 60,
          USDG,
          activePositionCount: options.activePositionCount ?? (options.allGenesisInactive === true ? 0n : 4n),
          genesisLiquidityPrincipal: 20_000_000n * 10n ** 18n,
          genesisLiquidityResidual: 0n,
          genesisSeeded: true,
          migrationCount: options.migrationCount ?? 0n,
          migrationsPaused: false,
          poolKey: key,
        };
        if (functionName === 'positionIds') return positionIds[Number(args?.[0])];
        if (functionName === 'allocationBps') return allocations[Number(args?.[0])];
        if (functionName === 'positionRecord') {
          return recordFor(args?.[0] as bigint);
        }
        if (functionName in values) return values[functionName];
      }
      if (contract.toLowerCase() === STATE_VIEW.toLowerCase()) {
        if (functionName === 'poolManager') return options.stateViewPoolManager ?? POOL_MANAGER;
        if (functionName === 'getSlot0') return [Q96, 0, 0, 3_000];
        if (functionName === 'getLiquidity') return 99_999n;
        if (functionName === 'getPositionInfo') {
          const tokenId = BigInt(args?.[4] as Hex);
          const record = recordFor(tokenId);
          return [record[2], ...(options.lastFeeGrowth ?? [0n, 0n])];
        }
        if (functionName === 'getFeeGrowthInside') return options.currentFeeGrowth ?? [0n, 0n];
      }
      if (contract.toLowerCase() === POSITION_MANAGER.toLowerCase()) {
        if (functionName === 'poolManager') return POOL_MANAGER;
        if (functionName === 'permit2') return PERMIT2;
        const tokenId = args?.[0] as bigint;
        const index = positionIds.indexOf(tokenId as (typeof positionIds)[number]);
        const record = recordFor(tokenId);
        if (functionName === 'ownerOf') return options.owner ?? LIQUIDITY_MANAGER;
        if (functionName === 'getPositionLiquidity') return record[2];
        if (functionName === 'getPoolAndPositionInfo') {
          return [
            key,
            index === 0 && options.packedPositionInfo !== undefined
              ? options.packedPositionInfo
              : packedInfoForRange([record[0], record[1]]),
          ];
        }
      }
      if (functionName === 'balanceOf' && contract.toLowerCase() === GBX.toLowerCase()) return 7n;
      if (functionName === 'balanceOf' && contract.toLowerCase() === USDG.toLowerCase()) return 11n;
      throw new Error(`Unexpected ${functionName} read at ${contract}`);
    },
  );
  let blockReadCount = 0;
  const getBlock = vi.fn(async (request?: { blockNumber?: bigint; blockTag?: string }) => {
    void request;
    blockReadCount += 1;
    return {
      hash: blockReadCount === 2 ? (options.confirmationHash ?? BLOCK_HASH) : BLOCK_HASH,
      number: blockReadCount === 2 ? (options.confirmationBlock ?? BLOCK) : BLOCK,
    };
  });
  return { client: { getBlock, readContract } as unknown as PublicClient, getBlock, readContract };
}

describe('canonical Uniswap v4 snapshot', () => {
  it('pins and revalidates the full identity, pool, exact residual, and four-NFT custody graph', async () => {
    const { client, getBlock, readContract } = snapshotClient();
    const snapshot = await readCanonicalV4Snapshot(client, { expected });

    expect(snapshot).toMatchObject({
      blockHash: BLOCK_HASH,
      blockNumber: BLOCK,
      managerInventory: { gbxRaw: 7n, usdGRaw: 11n },
      migration: { count: 0n, paused: false },
      positionIndex: { indexedBlock: BLOCK, indexedBlockHash: BLOCK_HASH, source: 'genesis-fallback' },
      pool: {
        activeLiquidity: 99_999n,
        currentTick: 0,
        gbxPriceUSDG: { denominator: 1n, numerator: 1_000_000_000_000n },
        lpFee: 3_000,
        sqrtPriceX96: Q96,
        uncollectedFees: { gbxRaw: 0n, usdGRaw: 0n },
      },
    });
    expect(snapshot.positions).toHaveLength(4);
    expect(snapshot.positions.map(({ custodyOwner }) => custodyOwner)).toEqual(Array(4).fill(LIQUIDITY_MANAGER));
    expect(snapshot.positions.map(({ positionManagerLiquidity }) => positionManagerLiquidity)).toEqual(liquidities);
    expect(snapshot.positions.every(({ principalComposition }) => principalComposition !== null)).toBe(true);
    expect(snapshot.positions.every(({ principalComposition }) => principalComposition?.gbxRaw === 0n)).toBe(true);
    expect(snapshot.pool.positionPrincipalComposition).toEqual(
      snapshot.positions.reduce(
        (total, position) => ({
          gbxRaw: total.gbxRaw + (position.principalComposition?.gbxRaw ?? 0n),
          usdGRaw: total.usdGRaw + (position.principalComposition?.usdGRaw ?? 0n),
        }),
        { gbxRaw: 0n, usdGRaw: 0n },
      ),
    );
    expect(snapshot.pool.poolId).toBe(canonicalPoolId(GBX, USDG, HOOK, expected));
    expect(getBlock).toHaveBeenCalledTimes(2);
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK);
  });

  it('rejects signed dependency drift, NFT custody loss, and packed position substitution', async () => {
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ stateViewPoolManager: address(99) }).client, { expected }),
    ).rejects.toThrow('StateView.poolManager');
    await expect(readCanonicalV4Snapshot(snapshotClient({ owner: address(98) }).client, { expected })).rejects.toThrow(
      'PositionManager owner',
    );
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ packedPositionInfo: packedInfo(0) ^ (1n << 8n) }).client, { expected }),
    ).rejects.toThrow('packed ticks');
  });

  it('rejects a block-number or hash change before exposing a mixed or reorged snapshot', async () => {
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ confirmationHash: `0x${'cd'.repeat(32)}` }).client, { expected }),
    ).rejects.toThrow('Chain state changed');
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ confirmationBlock: BLOCK + 1n }).client, { expected }),
    ).rejects.toThrow('Chain state changed');
  });

  it('uses official v4 Position math and maps both currency orderings to GBX and USDG', () => {
    const common = {
      activeLiquidity: 1_000_000n,
      launchGuardHook: HOOK,
      liquidity: 500_000n,
      tickLower: -120,
      tickUpper: 120,
    } as const;
    const gbxToken0 = canonicalV4PositionPrincipal({
      ...common,
      currentTick: -180,
      gbx: { address: GBX, chainId: 4663, decimals: 18 },
      sqrtPriceX96: sqrtPriceX96AtTick(-180),
      usdG: { address: USDG, chainId: 4663, decimals: 6 },
    });
    expect(gbxToken0.gbxRaw).toBeGreaterThan(0n);
    expect(gbxToken0.usdGRaw).toBe(0n);

    const gbxToken1 = canonicalV4PositionPrincipal({
      ...common,
      currentTick: -180,
      gbx: { address: USDG, chainId: 4663, decimals: 18 },
      sqrtPriceX96: sqrtPriceX96AtTick(-180),
      usdG: { address: GBX, chainId: 4663, decimals: 6 },
    });
    expect(gbxToken1.gbxRaw).toBe(0n);
    expect(gbxToken1.usdGRaw).toBeGreaterThan(0n);

    const inRange = canonicalV4PositionPrincipal({
      ...common,
      currentTick: 0,
      gbx: { address: GBX, chainId: 4663, decimals: 18 },
      sqrtPriceX96: Q96,
      usdG: { address: USDG, chainId: 4663, decimals: 6 },
    });
    expect(inRange.gbxRaw).toBeGreaterThan(0n);
    expect(inRange.usdGRaw).toBeGreaterThan(0n);
  });

  it('derives an exact decimal-aware USDG-per-GBX price in either currency ordering', () => {
    const common = {
      activeLiquidity: 1_000_000n,
      currentTick: 60,
      launchGuardHook: HOOK,
      sqrtPriceX96: sqrtPriceX96AtTick(60),
    } as const;
    const gbxToken0 = canonicalV4GBXPriceInUSDG({
      ...common,
      gbx: { address: GBX, chainId: 4663, decimals: 18 },
      usdG: { address: USDG, chainId: 4663, decimals: 6 },
    });
    const gbxToken1 = canonicalV4GBXPriceInUSDG({
      ...common,
      gbx: { address: USDG, chainId: 4663, decimals: 18 },
      usdG: { address: GBX, chainId: 4663, decimals: 6 },
    });
    const oneToOneRawHumanPrice = 1_000_000_000_000n;
    expect(gbxToken0.numerator).toBeGreaterThan(gbxToken0.denominator * oneToOneRawHumanPrice);
    expect(gbxToken1.numerator).toBeLessThan(gbxToken1.denominator * oneToOneRawHumanPrice);
  });

  it('requires and validates a block-pinned complete active-ID index after migration', async () => {
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ inactiveGenesisIndex: 0, migrationCount: 1n }).client, { expected }),
    ).rejects.toThrow('active-position index is required');

    const migratedClient = snapshotClient({ inactiveGenesisIndex: 0, migrationCount: 1n });
    const snapshot = await readCanonicalV4Snapshot(migratedClient.client, {
      activePositions: activeIndex(),
      expected,
    });
    expect(snapshot.positions.map((position) => position.tokenId)).toEqual([102n, 103n, 104n, 201n]);
    expect(snapshot.positions.at(-1)?.allocationBps).toBeNull();
    expect(snapshot.pool.positionPrincipalComposition).toEqual(
      snapshot.positions.reduce(
        (total, position) => ({
          gbxRaw: total.gbxRaw + (position.principalComposition?.gbxRaw ?? 0n),
          usdGRaw: total.usdGRaw + (position.principalComposition?.usdGRaw ?? 0n),
        }),
        { gbxRaw: 0n, usdGRaw: 0n },
      ),
    );
    expect(snapshot.positionIndex).toEqual({
      indexedBlock: BLOCK,
      indexedBlockHash: BLOCK_HASH,
      source: 'subgraph',
    });
    expect(migratedClient.getBlock.mock.calls[0]?.[0]).toEqual({ blockNumber: BLOCK });
    for (const [request] of migratedClient.readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK);
    expect(migratedClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'MAX_ACTIVE_POSITIONS' }),
    );
    expect(migratedClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'activePositionCount' }),
    );
  });

  it('accepts an exact zero/empty index only after every genesis record is inactive', async () => {
    const snapshot = await readCanonicalV4Snapshot(
      snapshotClient({ allGenesisInactive: true, migrationCount: 1n, replacementExists: false }).client,
      {
        activePositions: activeIndex({ activePositionCount: 0, positionIds: [] }),
        expected,
      },
    );
    expect(snapshot.positions).toEqual([]);
    expect(snapshot.pool.positionPrincipalComposition).toEqual({ gbxRaw: 0n, usdGRaw: 0n });
    expect(snapshot.pool.uncollectedFees).toEqual({ gbxRaw: 0n, usdGRaw: 0n });
    expect(snapshot.positionIndex.source).toBe('subgraph');

    await expect(
      readCanonicalV4Snapshot(
        snapshotClient({ activePositionCount: 0n, inactiveGenesisIndex: 0, migrationCount: 1n }).client,
        {
          activePositions: activeIndex({ activePositionCount: 0, positionIds: [] }),
          expected,
        },
      ),
    ).rejects.toThrow('omits active genesis NFT #102');
  });

  it('rejects duplicate, mismatched, excess, omitted, stale, and migration-inconsistent candidate indexes', async () => {
    const migrated = { inactiveGenesisIndex: 0, migrationCount: 1n } as const;
    await expect(
      readCanonicalV4Snapshot(snapshotClient(migrated).client, {
        activePositions: activeIndex({ positionIds: [102n, 102n, 104n, 201n] }),
        expected,
      }),
    ).rejects.toThrow('duplicate');
    await expect(
      readCanonicalV4Snapshot(snapshotClient(migrated).client, {
        activePositions: activeIndex({ activePositionCount: 1, positionIds: [] }),
        expected,
      }),
    ).rejects.toThrow('count does not match');
    const excessIds = Array.from({ length: MAX_CANONICAL_V4_ACTIVE_POSITIONS + 1 }, (_, index) => BigInt(index + 1));
    await expect(
      readCanonicalV4Snapshot(snapshotClient(migrated).client, {
        activePositions: activeIndex({ activePositionCount: excessIds.length, positionIds: excessIds }),
        expected,
      }),
    ).rejects.toThrow();
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ ...migrated, activePositionCount: 3n }).client, {
        activePositions: activeIndex({ activePositionCount: 3, positionIds: [103n, 104n, 201n] }),
        expected,
      }),
    ).rejects.toThrow('omits active genesis NFT #102');
    await expect(
      readCanonicalV4Snapshot(snapshotClient(migrated).client, {
        activePositions: activeIndex({ indexedBlockHash: `0x${'ef'.repeat(32)}` }),
        expected,
      }),
    ).rejects.toThrow('stale or was reorged');
    await expect(
      readCanonicalV4Snapshot(snapshotClient(migrated).client, {
        activePositions: activeIndex({ migrationCount: 2n }),
        expected,
      }),
    ).rejects.toThrow('migration count is stale or inconsistent');
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ ...migrated, activePositionCount: 3n }).client, {
        activePositions: activeIndex(),
        expected,
      }),
    ).rejects.toThrow('count is stale or inconsistent');
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ maxActivePositions: 17n }).client, { expected }),
    ).rejects.toThrow('cap does not match');
    await expect(
      readCanonicalV4Snapshot(snapshotClient({ activePositionCount: 3n }).client, { expected }),
    ).rejects.toThrow('Genesis position records do not match');
  });

  it('uses PositionManager address plus bytes32(tokenId) and exact wrapping Q128 fee-growth math', async () => {
    const currentFeeGrowth = [3n << 128n, 5n << 128n] as const;
    const { client, readContract } = snapshotClient({ currentFeeGrowth });
    const snapshot = await readCanonicalV4Snapshot(client, { expected });
    expect(snapshot.positions[0]?.uncollectedFees).toEqual({ gbxRaw: 150_000n, usdGRaw: 250_000n });
    expect(snapshot.pool.uncollectedFees).toEqual({ gbxRaw: 300_000n, usdGRaw: 500_000n });
    const statePositionCall = readContract.mock.calls.find(([request]) => request.functionName === 'getPositionInfo');
    expect(statePositionCall?.[0].args).toEqual([
      canonicalPoolId(GBX, USDG, HOOK, expected),
      POSITION_MANAGER,
      ranges[0]![0],
      ranges[0]![1],
      `0x${positionIds[0].toString(16).padStart(64, '0')}`,
    ]);

    const wrappedToken0 = canonicalV4UncollectedFees({
      currentFeeGrowth0X128: 1n << 127n,
      currentFeeGrowth1X128: 9n << 128n,
      gbxIsCurrency0: true,
      lastFeeGrowth0X128: (1n << 256n) - (1n << 127n),
      lastFeeGrowth1X128: 8n << 128n,
      liquidity: 7n,
    });
    expect(wrappedToken0).toEqual({ gbxRaw: 7n, usdGRaw: 7n });
    expect(
      canonicalV4UncollectedFees({
        currentFeeGrowth0X128: 2n << 128n,
        currentFeeGrowth1X128: 4n << 128n,
        gbxIsCurrency0: false,
        lastFeeGrowth0X128: 1n << 128n,
        lastFeeGrowth1X128: 1n << 128n,
        liquidity: 3n,
      }),
    ).toEqual({ gbxRaw: 9n, usdGRaw: 3n });
    expect(
      canonicalV4UncollectedFees({
        currentFeeGrowth0X128: 1n << 127n,
        currentFeeGrowth1X128: 0n,
        gbxIsCurrency0: true,
        lastFeeGrowth0X128: 0n,
        lastFeeGrowth1X128: 0n,
        liquidity: 3n,
      }),
    ).toEqual({ gbxRaw: 1n, usdGRaw: 0n });
  });
});
