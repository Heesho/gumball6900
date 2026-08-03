import { getAddress, isAddressEqual, toHex, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { z } from 'zod';

import { liquidityManagerAbi } from './abis.js';
import {
  BlockSnapshotChangedError,
  pinBlockSnapshot,
  revalidateBlockSnapshot,
  type BlockSnapshot,
} from './block-snapshot.js';
import {
  CANONICAL_V4_FEE,
  CANONICAL_V4_TICK_SPACING,
  canonicalPoolId,
  canonicalPoolKey,
  canonicalV4GBXPriceInUSDG,
  canonicalV4PositionPrincipal,
  type CanonicalV4GBXPrice,
  type CanonicalV4PoolStateParameters,
  type CanonicalV4PositionPrincipal,
  sqrtPriceX96AtTick,
  type CanonicalPoolKey,
} from './v4.js';
import { addressSchema, assertUint, bytes32Schema, tokenDecimalsSchema, unsignedBigIntSchema } from './validation.js';

/** Reviewed read-only subset of Uniswap v4-periphery `IStateView` v1.0.3. */
export const v4StateViewReadAbi = [
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IPoolManager' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSlot0',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160', internalType: 'uint160' },
      { name: 'tick', type: 'int24', internalType: 'int24' },
      { name: 'protocolFee', type: 'uint24', internalType: 'uint24' },
      { name: 'lpFee', type: 'uint24', internalType: 'uint24' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLiquidity',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [{ name: 'liquidity', type: 'uint128', internalType: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionInfo',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
      { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [
      { name: 'liquidity', type: 'uint128', internalType: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256', internalType: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeeGrowthInside',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
    ],
    outputs: [
      { name: 'feeGrowthInside0X128', type: 'uint256', internalType: 'uint256' },
      { name: 'feeGrowthInside1X128', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

/** Reviewed read-only subset of Uniswap v4-periphery `IPositionManager` v1.0.3 plus its immutable getters. */
export const v4PositionManagerReadAbi = [
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IPoolManager' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permit2',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IAllowanceTransfer' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionLiquidity',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'liquidity', type: 'uint128', internalType: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPoolAndPositionInfo',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      { name: '', type: 'uint256', internalType: 'PositionInfo' },
    ],
    stateMutability: 'view',
  },
] as const;

/** Minimal ERC-20 custody read used for exact LiquidityManager residual inventory. */
export const erc20BalanceReadAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const int24Schema = z.number().int().min(-8_388_608).max(8_388_607);
const uint24Schema = z.number().int().min(0).max(16_777_215);
const uint16Schema = z.number().int().min(0).max(65_535);
const poolKeySchema = z.object({
  currency0: addressSchema,
  currency1: addressSchema,
  fee: uint24Schema,
  hooks: addressSchema,
  tickSpacing: int24Schema,
});
const positionRecordSchema = z.tuple([
  int24Schema,
  int24Schema,
  unsignedBigIntSchema,
  unsignedBigIntSchema,
  z.boolean(),
]);
const slot0Schema = z.tuple([unsignedBigIntSchema, int24Schema, uint24Schema, uint24Schema]);
const managerPositionSchema = z.tuple([poolKeySchema, unsignedBigIntSchema]);
const statePositionSchema = z.tuple([unsignedBigIntSchema, unsignedBigIntSchema, unsignedBigIntSchema]);
const feeGrowthInsideSchema = z.tuple([unsignedBigIntSchema, unsignedBigIntSchema]);

const MIN_TICK = -887_272;
const MAX_TICK = 887_272;
const POSITION_COUNT = 4;
/** Contract-enforced lifetime bound on simultaneously active canonical v4 positions. */
export const MAX_CANONICAL_V4_ACTIVE_POSITIONS = 16;
const LOW_POSITION_INFO_BITS = 56n;
const UINT256_MASK = (1n << 256n) - 1n;
const POSITION_POOL_MASK = UINT256_MASK ^ ((1n << LOW_POSITION_INFO_BITS) - 1n);
const Q128 = 1n << 128n;

export interface CanonicalV4ActivePositionIndex {
  /** Subgraph `_meta.block.number` used to pin every corresponding RPC read. */
  readonly indexedBlock: bigint;
  /** Subgraph `_meta.block.hash`; the RPC block must match before and after all reads. */
  readonly indexedBlockHash: Hex;
  /** Pinned LiquidityPool counter, cross-checked against the onchain manager counter. */
  readonly migrationCount: bigint;
  /** Pinned LiquidityPool count, which must equal the complete bounded ID list. */
  readonly activePositionCount: number;
  readonly positionIds: readonly bigint[];
}

export interface CanonicalV4SnapshotParameters {
  /** Complete bounded active-ID index. Required after the first migration. */
  readonly activePositions?: CanonicalV4ActivePositionIndex;
  /** Values below must come from one validated signed runtime manifest. */
  readonly expected: Readonly<{
    chainId: number;
    gbx: Address;
    gbxDecimals: number;
    launchGuardHook: Address;
    liquidityManager: Address;
    permit2: Address;
    poolManager: Address;
    positionManager: Address;
    stateView: Address;
    usdG: Address;
    usdGDecimals: number;
  }>;
}

export interface CanonicalV4PositionSnapshot {
  /** Genesis ladder allocation; null for replacement NFTs. */
  readonly allocationBps: number | null;
  readonly custodyOwner: Address | null;
  readonly exists: boolean;
  readonly gbxPrincipalRaw: bigint;
  readonly hasSubscriber: boolean | null;
  readonly index: number;
  readonly liquidity: bigint;
  readonly positionManagerLiquidity: bigint | null;
  /** Exact current principal composition from official v4 position math; null when the NFT is inactive. */
  readonly principalComposition: CanonicalV4PositionPrincipal | null;
  readonly tickLower: number;
  readonly tickUpper: number;
  readonly tokenId: bigint;
  /** Exact current fees not yet collected from this active core position. */
  readonly uncollectedFees: CanonicalV4PositionPrincipal | null;
}

export interface CanonicalV4Snapshot {
  readonly blockHash: Hex;
  readonly blockNumber: bigint;
  readonly genesis: Readonly<{
    liquidityPrincipalRaw: bigint;
    liquidityResidualRaw: bigint;
    seeded: boolean;
  }>;
  /** Exact ERC-20 balances held directly by LiquidityManager; these do not estimate position composition. */
  readonly managerInventory: Readonly<{ gbxRaw: bigint; usdGRaw: bigint }>;
  readonly migration: Readonly<{ count: bigint; paused: boolean }>;
  readonly positionIndex: Readonly<{
    indexedBlock: bigint;
    indexedBlockHash: Hex;
    source: 'genesis-fallback' | 'subgraph';
  }>;
  readonly pool: Readonly<{
    activeLiquidity: bigint;
    currentTick: number;
    /** Exact human-unit USDG price for one GBX at the pinned slot0 price. */
    gbxPriceUSDG: CanonicalV4GBXPrice;
    lpFee: number;
    poolId: Hex;
    poolKey: CanonicalPoolKey;
    /** Complete exact current principal across every validated active protocol position. */
    positionPrincipalComposition: CanonicalV4PositionPrincipal;
    protocolFee: number;
    sqrtPriceX96: bigint;
    /** Complete exact current fees across every validated active protocol position. */
    uncollectedFees: CanonicalV4PositionPrincipal;
  }>;
  readonly positions: readonly CanonicalV4PositionSnapshot[];
}

async function readAtBlock(
  client: PublicClient,
  blockNumber: bigint,
  contract: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<unknown> {
  return client.readContract({
    abi,
    address: getAddress(contract),
    args,
    blockNumber,
    functionName,
  } as never);
}

function sameAddress(actual: unknown, expected: Address, label: string): Address {
  const parsed = addressSchema.parse(actual);
  if (!isAddressEqual(parsed, expected)) throw new Error(`${label} does not match the signed runtime manifest.`);
  return parsed;
}

function samePoolKey(actual: unknown, expected: CanonicalPoolKey, label: string): CanonicalPoolKey {
  const parsed = poolKeySchema.parse(actual);
  if (
    !isAddressEqual(parsed.currency0, expected.currency0) ||
    !isAddressEqual(parsed.currency1, expected.currency1) ||
    parsed.fee !== expected.fee ||
    parsed.tickSpacing !== expected.tickSpacing ||
    !isAddressEqual(parsed.hooks, expected.hooks)
  ) {
    throw new Error(`${label} does not match the canonical signed GBX/USDG PoolKey.`);
  }
  return parsed;
}

function decodeInt24(value: bigint): number {
  const unsigned = Number(value & 0xff_ffffn);
  return unsigned >= 0x80_0000 ? unsigned - 0x1_00_0000 : unsigned;
}

function validatePackedPositionInfo(info: bigint, poolId: Hex, tickLower: number, tickUpper: number) {
  assertUint(info, 256, 'PositionInfo');
  const subscriber = info & 0xffn;
  if (subscriber > 1n) throw new Error('PositionManager returned an invalid subscriber flag.');
  if (decodeInt24(info >> 8n) !== tickLower || decodeInt24(info >> 32n) !== tickUpper) {
    throw new Error('PositionManager packed ticks do not match the LiquidityManager position record.');
  }
  if ((info & POSITION_POOL_MASK) !== (BigInt(poolId) & POSITION_POOL_MASK)) {
    throw new Error('PositionManager packed PoolId does not match the canonical pool.');
  }
  return subscriber === 1n;
}

function validateInitializedSlot0(sqrtPriceX96: bigint, tick: number): void {
  if (sqrtPriceX96 === 0n) throw new Error('The canonical pool is not initialized.');
  assertUint(sqrtPriceX96, 160, 'sqrtPriceX96');
  if (tick < MIN_TICK || tick > MAX_TICK) throw new Error('StateView returned an out-of-range current tick.');
  const lowerBound = sqrtPriceX96AtTick(tick);
  if (sqrtPriceX96 < lowerBound) throw new Error('StateView sqrtPriceX96 is below its reported tick.');
  if (tick < MAX_TICK && sqrtPriceX96 >= sqrtPriceX96AtTick(tick + 1)) {
    throw new Error('StateView sqrtPriceX96 is above its reported tick.');
  }
}

function validateActivePositionIndex(value: CanonicalV4ActivePositionIndex): CanonicalV4ActivePositionIndex {
  const parsed = z
    .object({
      activePositionCount: z.number().int().nonnegative().max(MAX_CANONICAL_V4_ACTIVE_POSITIONS),
      indexedBlock: unsignedBigIntSchema.positive(),
      indexedBlockHash: bytes32Schema,
      migrationCount: unsignedBigIntSchema,
      positionIds: z.array(unsignedBigIntSchema.positive()).max(MAX_CANONICAL_V4_ACTIVE_POSITIONS),
    })
    .strict()
    .parse(value);
  if (parsed.activePositionCount !== parsed.positionIds.length) {
    throw new Error('Active-position index count does not match its bounded ID list.');
  }
  if (new Set(parsed.positionIds).size !== parsed.positionIds.length) {
    throw new Error('Active-position index contains duplicate position IDs.');
  }
  return { ...parsed, indexedBlockHash: parsed.indexedBlockHash as Hex };
}

/**
 * Applies Uniswap v4 Position fee accounting exactly: uint256-wrapped growth deltas followed by Q128 floor math,
 * then maps currency0/currency1 into GBX/USDG identity.
 */
export function canonicalV4UncollectedFees(
  parameters: Readonly<{
    currentFeeGrowth0X128: bigint;
    currentFeeGrowth1X128: bigint;
    gbxIsCurrency0: boolean;
    lastFeeGrowth0X128: bigint;
    lastFeeGrowth1X128: bigint;
    liquidity: bigint;
  }>,
): CanonicalV4PositionPrincipal {
  assertUint(parameters.currentFeeGrowth0X128, 256, 'current feeGrowthInside0X128');
  assertUint(parameters.currentFeeGrowth1X128, 256, 'current feeGrowthInside1X128');
  assertUint(parameters.lastFeeGrowth0X128, 256, 'last feeGrowthInside0X128');
  assertUint(parameters.lastFeeGrowth1X128, 256, 'last feeGrowthInside1X128');
  assertUint(parameters.liquidity, 128, 'position fee liquidity');
  const currency0Raw =
    (((parameters.currentFeeGrowth0X128 - parameters.lastFeeGrowth0X128) & UINT256_MASK) * parameters.liquidity) / Q128;
  const currency1Raw =
    (((parameters.currentFeeGrowth1X128 - parameters.lastFeeGrowth1X128) & UINT256_MASK) * parameters.liquidity) / Q128;
  return parameters.gbxIsCurrency0
    ? { gbxRaw: currency0Raw, usdGRaw: currency1Raw }
    : { gbxRaw: currency1Raw, usdGRaw: currency0Raw };
}

/**
 * Reads and validates canonical v4 pool, custody, exact manager-residual state, principal, and uncollected fees at one
 * revalidated block. The onchain lifetime cap and active counter must agree with the complete bounded subgraph ID
 * index. That index is mandatory after migration; genesis alone may fall back to the manager's four immutable
 * position-ID getters.
 */
export async function readCanonicalV4Snapshot(
  client: PublicClient,
  parameters: CanonicalV4SnapshotParameters,
): Promise<CanonicalV4Snapshot> {
  const expected = z
    .object({
      chainId: z.number().int().positive().safe(),
      gbx: addressSchema,
      gbxDecimals: tokenDecimalsSchema,
      launchGuardHook: addressSchema,
      liquidityManager: addressSchema,
      permit2: addressSchema,
      poolManager: addressSchema,
      positionManager: addressSchema,
      stateView: addressSchema,
      usdG: addressSchema,
      usdGDecimals: tokenDecimalsSchema,
    })
    .parse(parameters.expected);
  const expectedAddresses = [
    expected.gbx,
    expected.launchGuardHook,
    expected.liquidityManager,
    expected.permit2,
    expected.poolManager,
    expected.positionManager,
    expected.stateView,
    expected.usdG,
  ];
  if (new Set(expectedAddresses.map((value) => value.toLowerCase())).size !== expectedAddresses.length) {
    throw new Error('Canonical v4 snapshot dependencies must be distinct signed addresses.');
  }

  const activePositionIndex =
    parameters.activePositions === undefined ? undefined : validateActivePositionIndex(parameters.activePositions);
  let pinnedBlock: BlockSnapshot;
  try {
    pinnedBlock = await pinBlockSnapshot(
      client,
      activePositionIndex?.indexedBlock,
      activePositionIndex?.indexedBlockHash,
    );
  } catch (error) {
    if (activePositionIndex !== undefined && error instanceof BlockSnapshotChangedError) {
      throw new Error('Active-position index block is stale or was reorged.', { cause: error });
    }
    throw error;
  }
  const { blockHash, blockNumber } = pinnedBlock;
  const poolKey = canonicalPoolKey(expected.gbx, expected.usdG, expected.launchGuardHook, {
    chainId: expected.chainId,
    gbxDecimals: expected.gbxDecimals,
    usdGDecimals: expected.usdGDecimals,
  });
  const poolId = canonicalPoolId(expected.gbx, expected.usdG, expected.launchGuardHook, {
    chainId: expected.chainId,
    gbxDecimals: expected.gbxDecimals,
    usdGDecimals: expected.usdGDecimals,
  });

  const manager = expected.liquidityManager;
  const [
    managerGBX,
    managerUSDG,
    managerPoolManager,
    managerPositionManager,
    managerPermit2,
    managerHook,
    managerFee,
    managerTickSpacing,
    managerPoolKey,
    managerMaxActivePositions,
    managerActivePositionCount,
    seeded,
    liquidityPrincipalRaw,
    liquidityResidualRaw,
    migrationCount,
    migrationsPaused,
    stateViewPoolManager,
    positionManagerPoolManager,
    positionManagerPermit2,
    managerGBXBalance,
    managerUSDGBalance,
  ] = await Promise.all([
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'GBX'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'USDG'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'POOL_MANAGER'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'POSITION_MANAGER'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'PERMIT2'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'LAUNCH_GUARD_HOOK'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'POOL_FEE'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'TICK_SPACING'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'poolKey'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'MAX_ACTIVE_POSITIONS'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'activePositionCount'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'genesisSeeded'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'genesisLiquidityPrincipal'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'genesisLiquidityResidual'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'migrationCount'),
    readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'migrationsPaused'),
    readAtBlock(client, blockNumber, expected.stateView, v4StateViewReadAbi, 'poolManager'),
    readAtBlock(client, blockNumber, expected.positionManager, v4PositionManagerReadAbi, 'poolManager'),
    readAtBlock(client, blockNumber, expected.positionManager, v4PositionManagerReadAbi, 'permit2'),
    readAtBlock(client, blockNumber, expected.gbx, erc20BalanceReadAbi, 'balanceOf', [manager]),
    readAtBlock(client, blockNumber, expected.usdG, erc20BalanceReadAbi, 'balanceOf', [manager]),
  ]);

  sameAddress(managerGBX, expected.gbx, 'LiquidityManager.GBX');
  sameAddress(managerUSDG, expected.usdG, 'LiquidityManager.USDG');
  sameAddress(managerPoolManager, expected.poolManager, 'LiquidityManager.POOL_MANAGER');
  sameAddress(managerPositionManager, expected.positionManager, 'LiquidityManager.POSITION_MANAGER');
  sameAddress(managerPermit2, expected.permit2, 'LiquidityManager.PERMIT2');
  sameAddress(managerHook, expected.launchGuardHook, 'LiquidityManager.LAUNCH_GUARD_HOOK');
  sameAddress(stateViewPoolManager, expected.poolManager, 'StateView.poolManager');
  sameAddress(positionManagerPoolManager, expected.poolManager, 'PositionManager.poolManager');
  sameAddress(positionManagerPermit2, expected.permit2, 'PositionManager.permit2');
  if (uint24Schema.parse(managerFee) !== CANONICAL_V4_FEE) {
    throw new Error('LiquidityManager fee does not match the canonical 0.30% fee.');
  }
  if (int24Schema.parse(managerTickSpacing) !== CANONICAL_V4_TICK_SPACING) {
    throw new Error('LiquidityManager tick spacing does not match the canonical spacing.');
  }
  samePoolKey(managerPoolKey, poolKey, 'LiquidityManager.poolKey');
  const parsedMaximumActivePositions = unsignedBigIntSchema.parse(managerMaxActivePositions);
  if (parsedMaximumActivePositions !== BigInt(MAX_CANONICAL_V4_ACTIVE_POSITIONS)) {
    throw new Error('LiquidityManager active-position cap does not match the reviewed client bound.');
  }
  const parsedManagerActivePositionCount = unsignedBigIntSchema.parse(managerActivePositionCount);
  if (parsedManagerActivePositionCount > parsedMaximumActivePositions) {
    throw new Error('LiquidityManager active-position count exceeds its contract-enforced cap.');
  }
  if (z.boolean().parse(seeded) !== true) throw new Error('The canonical pool has not been genesis-seeded.');

  const genesisPositionIds = await Promise.all(
    Array.from({ length: POSITION_COUNT }, (_, index) =>
      readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'positionIds', [BigInt(index)]),
    ),
  ).then((values) => values.map((value) => unsignedBigIntSchema.positive().parse(value)));
  if (new Set(genesisPositionIds).size !== POSITION_COUNT)
    throw new Error('LiquidityManager returned duplicate position IDs.');
  const genesisPositionRecords = await Promise.all(
    genesisPositionIds.map((positionId) =>
      readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'positionRecord', [positionId]),
    ),
  ).then((values) => values.map((value) => positionRecordSchema.parse(value)));
  const allocationBps = await Promise.all(
    Array.from({ length: POSITION_COUNT }, (_, index) =>
      readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'allocationBps', [BigInt(index)]),
    ),
  ).then((values) => values.map((value) => uint16Schema.parse(value)));
  if (allocationBps.reduce((total, value) => total + value, 0) !== 10_000) {
    throw new Error('LiquidityManager position allocation does not sum to 10,000 bps.');
  }
  if (allocationBps.some((value) => value === 0)) {
    throw new Error('LiquidityManager returned a zero genesis position allocation.');
  }
  const parsedGenesisPrincipal = unsignedBigIntSchema.parse(liquidityPrincipalRaw);
  const recordedGenesisPrincipal = genesisPositionRecords.reduce((total, record) => total + record[3], 0n);
  if (recordedGenesisPrincipal !== parsedGenesisPrincipal) {
    throw new Error('LiquidityManager position principal does not match its genesis principal total.');
  }
  const parsedMigrationCount = unsignedBigIntSchema.parse(migrationCount);
  if (activePositionIndex === undefined && parsedMigrationCount !== 0n) {
    throw new Error('A complete active-position index is required after liquidity migration.');
  }
  if (activePositionIndex !== undefined && activePositionIndex.migrationCount !== parsedMigrationCount) {
    throw new Error('Active-position index migration count is stale or inconsistent with LiquidityManager.');
  }
  if (
    activePositionIndex !== undefined &&
    BigInt(activePositionIndex.activePositionCount) !== parsedManagerActivePositionCount
  ) {
    throw new Error('Active-position index count is stale or inconsistent with LiquidityManager.');
  }
  if (activePositionIndex === undefined) {
    const activeGenesisPositionCount = genesisPositionRecords.filter((record) => record[4]).length;
    if (BigInt(activeGenesisPositionCount) !== parsedManagerActivePositionCount) {
      throw new Error('Genesis position records do not match LiquidityManager active-position count.');
    }
  }

  const positionIds = activePositionIndex?.positionIds ?? genesisPositionIds;
  const positionRecords =
    activePositionIndex === undefined
      ? genesisPositionRecords
      : await Promise.all(
          positionIds.map((positionId) =>
            readAtBlock(client, blockNumber, manager, liquidityManagerAbi, 'positionRecord', [positionId]),
          ),
        ).then((values) => values.map((value) => positionRecordSchema.parse(value)));
  if (activePositionIndex !== undefined) {
    for (const [index, record] of positionRecords.entries()) {
      if (!record[4]) {
        throw new Error(`Active-position index includes inactive or unknown NFT #${positionIds[index]!.toString()}.`);
      }
    }
    const indexedIds = new Set(positionIds);
    for (const [index, record] of genesisPositionRecords.entries()) {
      if (record[4] && !indexedIds.has(genesisPositionIds[index]!)) {
        throw new Error(`Active-position index omits active genesis NFT #${genesisPositionIds[index]!.toString()}.`);
      }
    }
  }

  const [slot0Raw, activeLiquidityRaw] = await Promise.all([
    readAtBlock(client, blockNumber, expected.stateView, v4StateViewReadAbi, 'getSlot0', [poolId]),
    readAtBlock(client, blockNumber, expected.stateView, v4StateViewReadAbi, 'getLiquidity', [poolId]),
  ]);
  const [sqrtPriceX96, currentTick, protocolFee, lpFee] = slot0Schema.parse(slot0Raw);
  validateInitializedSlot0(sqrtPriceX96, currentTick);
  if (lpFee !== CANONICAL_V4_FEE) throw new Error('StateView LP fee does not match the fixed canonical PoolKey fee.');
  const activeLiquidity = unsignedBigIntSchema.parse(activeLiquidityRaw);
  assertUint(activeLiquidity, 128, 'activeLiquidity');
  const canonicalPoolState = {
    activeLiquidity,
    currentTick,
    gbx: {
      address: expected.gbx,
      chainId: expected.chainId,
      decimals: expected.gbxDecimals,
      symbol: 'GBX',
    },
    launchGuardHook: expected.launchGuardHook,
    sqrtPriceX96,
    usdG: {
      address: expected.usdG,
      chainId: expected.chainId,
      decimals: expected.usdGDecimals,
      symbol: 'USDG',
    },
  } as const satisfies CanonicalV4PoolStateParameters;
  const gbxPriceUSDG = canonicalV4GBXPriceInUSDG(canonicalPoolState);

  const positions = await Promise.all(
    positionRecords.map(async ([tickLower, tickUpper, recordedLiquidity, gbxPrincipalRaw, exists], index) => {
      const tokenId = positionIds[index]!;
      const genesisIndex = genesisPositionIds.indexOf(tokenId);
      const allocationBpsForPosition = genesisIndex === -1 ? null : allocationBps[genesisIndex]!;
      assertUint(recordedLiquidity, 128, `position #${tokenId.toString()} liquidity`);
      if (exists && recordedLiquidity === 0n) {
        throw new Error(`LiquidityManager active position #${tokenId.toString()} has zero liquidity.`);
      }
      if (
        tickLower < MIN_TICK ||
        tickUpper > MAX_TICK ||
        tickLower >= tickUpper ||
        tickLower % CANONICAL_V4_TICK_SPACING !== 0 ||
        tickUpper % CANONICAL_V4_TICK_SPACING !== 0
      ) {
        throw new Error(`LiquidityManager position #${tokenId.toString()} has an invalid tick range.`);
      }
      if (!exists) {
        return {
          allocationBps: allocationBpsForPosition,
          custodyOwner: null,
          exists,
          gbxPrincipalRaw,
          hasSubscriber: null,
          index,
          liquidity: recordedLiquidity,
          positionManagerLiquidity: null,
          principalComposition: null,
          tickLower,
          tickUpper,
          tokenId,
          uncollectedFees: null,
        } satisfies CanonicalV4PositionSnapshot;
      }

      const salt = toHex(tokenId, { size: 32 });
      const [ownerRaw, actualLiquidityRaw, managerPositionRaw, statePositionRaw, currentFeeGrowthRaw] =
        await Promise.all([
          readAtBlock(client, blockNumber, expected.positionManager, v4PositionManagerReadAbi, 'ownerOf', [tokenId]),
          readAtBlock(client, blockNumber, expected.positionManager, v4PositionManagerReadAbi, 'getPositionLiquidity', [
            tokenId,
          ]),
          readAtBlock(
            client,
            blockNumber,
            expected.positionManager,
            v4PositionManagerReadAbi,
            'getPoolAndPositionInfo',
            [tokenId],
          ),
          readAtBlock(client, blockNumber, expected.stateView, v4StateViewReadAbi, 'getPositionInfo', [
            poolId,
            expected.positionManager,
            tickLower,
            tickUpper,
            salt,
          ]),
          readAtBlock(client, blockNumber, expected.stateView, v4StateViewReadAbi, 'getFeeGrowthInside', [
            poolId,
            tickLower,
            tickUpper,
          ]),
        ]);
      const owner = sameAddress(ownerRaw, manager, `PositionManager owner of #${tokenId.toString()}`);
      const actualLiquidity = unsignedBigIntSchema.parse(actualLiquidityRaw);
      assertUint(actualLiquidity, 128, `PositionManager liquidity for #${tokenId.toString()}`);
      if (actualLiquidity !== recordedLiquidity) {
        throw new Error(`PositionManager liquidity for #${tokenId.toString()} does not match LiquidityManager.`);
      }
      const [positionPoolKey, packedInfo] = managerPositionSchema.parse(managerPositionRaw);
      samePoolKey(positionPoolKey, poolKey, `PositionManager PoolKey for #${tokenId.toString()}`);
      const hasSubscriber = validatePackedPositionInfo(packedInfo, poolId, tickLower, tickUpper);
      const [stateLiquidity, lastFeeGrowth0X128, lastFeeGrowth1X128] = statePositionSchema.parse(statePositionRaw);
      assertUint(stateLiquidity, 128, `StateView liquidity for #${tokenId.toString()}`);
      if (stateLiquidity !== actualLiquidity) {
        throw new Error(`StateView liquidity for #${tokenId.toString()} does not match PositionManager.`);
      }
      const [currentFeeGrowth0X128, currentFeeGrowth1X128] = feeGrowthInsideSchema.parse(currentFeeGrowthRaw);
      const uncollectedFees = canonicalV4UncollectedFees({
        currentFeeGrowth0X128,
        currentFeeGrowth1X128,
        gbxIsCurrency0: isAddressEqual(poolKey.currency0, expected.gbx),
        lastFeeGrowth0X128,
        lastFeeGrowth1X128,
        liquidity: actualLiquidity,
      });
      const principalComposition = canonicalV4PositionPrincipal({
        ...canonicalPoolState,
        liquidity: actualLiquidity,
        tickLower,
        tickUpper,
      });
      return {
        allocationBps: allocationBpsForPosition,
        custodyOwner: owner,
        exists,
        gbxPrincipalRaw,
        hasSubscriber,
        index,
        liquidity: recordedLiquidity,
        positionManagerLiquidity: actualLiquidity,
        principalComposition,
        tickLower,
        tickUpper,
        tokenId,
        uncollectedFees,
      } satisfies CanonicalV4PositionSnapshot;
    }),
  );

  const positionPrincipalComposition = positions.reduce<CanonicalV4PositionPrincipal>(
    (total, position) => ({
      gbxRaw: total.gbxRaw + (position.principalComposition?.gbxRaw ?? 0n),
      usdGRaw: total.usdGRaw + (position.principalComposition?.usdGRaw ?? 0n),
    }),
    { gbxRaw: 0n, usdGRaw: 0n },
  );
  const uncollectedFees = positions.reduce<CanonicalV4PositionPrincipal>(
    (total, position) => ({
      gbxRaw: total.gbxRaw + (position.uncollectedFees?.gbxRaw ?? 0n),
      usdGRaw: total.usdGRaw + (position.uncollectedFees?.usdGRaw ?? 0n),
    }),
    { gbxRaw: 0n, usdGRaw: 0n },
  );

  await revalidateBlockSnapshot(client, pinnedBlock);

  return {
    blockHash,
    blockNumber,
    genesis: {
      liquidityPrincipalRaw: parsedGenesisPrincipal,
      liquidityResidualRaw: unsignedBigIntSchema.parse(liquidityResidualRaw),
      seeded: true,
    },
    managerInventory: {
      gbxRaw: unsignedBigIntSchema.parse(managerGBXBalance),
      usdGRaw: unsignedBigIntSchema.parse(managerUSDGBalance),
    },
    migration: {
      count: parsedMigrationCount,
      paused: z.boolean().parse(migrationsPaused),
    },
    positionIndex: {
      indexedBlock: blockNumber,
      indexedBlockHash: blockHash,
      source: activePositionIndex === undefined ? 'genesis-fallback' : 'subgraph',
    },
    pool: {
      activeLiquidity,
      currentTick,
      gbxPriceUSDG,
      lpFee,
      poolId,
      poolKey,
      positionPrincipalComposition,
      protocolFee,
      sqrtPriceX96,
      uncollectedFees,
    },
    positions,
  };
}
