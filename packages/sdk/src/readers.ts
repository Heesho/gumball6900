import { getAddress, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { z } from 'zod';

import {
  acquisitionStrategyAbi,
  allocationVoterAbi,
  assetRegistryAbi,
  buybackStrategyAbi,
  emissionControllerAbi,
  gbxAbi,
  liquidityCustodianAbi,
  miningClaimsAbi,
  miningPoolAbi,
  stakedGbxAbi,
  strategyRewardsAbi,
} from './abis.js';
import { pinBlockSnapshot, revalidateBlockSnapshot, type BlockSnapshot } from './block-snapshot.js';
import { addressSchema, bytes32Schema, positiveBigIntSchema, unsignedBigIntSchema } from './validation.js';

export interface ReadOptions {
  /** Pins every RPC call in the composed view to this block; defaults to a freshly read latest block. */
  readonly atBlock?: bigint;
  /** Optionally binds the read to a previously observed canonical block hash. */
  readonly expectedBlockHash?: Hex;
}

async function snapshot(client: PublicClient, options: ReadOptions): Promise<BlockSnapshot> {
  return pinBlockSnapshot(client, options.atBlock, options.expectedBlockHash);
}

async function read(
  client: PublicClient,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<unknown> {
  return client.readContract({ address: getAddress(address), abi, blockNumber, functionName, args } as never);
}

export const supplyViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  cumulativeBurned: unsignedBigIntSchema,
  cumulativeMinted: unsignedBigIntSchema,
  emissionController: addressSchema,
  remainingMintCapacity: unsignedBigIntSchema,
  totalSupply: unsignedBigIntSchema,
});
export type SupplyView = z.infer<typeof supplyViewSchema>;

export async function readSupplyView(
  client: PublicClient,
  gbx: Address,
  options: ReadOptions = {},
): Promise<SupplyView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [cumulativeBurned, cumulativeMinted, emissionController, remainingMintCapacity, totalSupply] =
    await Promise.all([
      read(client, blockNumber, gbx, gbxAbi, 'cumulativeBurned'),
      read(client, blockNumber, gbx, gbxAbi, 'cumulativeMinted'),
      read(client, blockNumber, gbx, gbxAbi, 'emissionController'),
      read(client, blockNumber, gbx, gbxAbi, 'remainingMintCapacity'),
      read(client, blockNumber, gbx, gbxAbi, 'totalSupply'),
    ]);
  const result = supplyViewSchema.parse({
    blockNumber,
    cumulativeBurned,
    cumulativeMinted,
    emissionController,
    remainingMintCapacity,
    totalSupply,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

const epochSchema = z.tuple([
  unsignedBigIntSchema,
  unsignedBigIntSchema,
  unsignedBigIntSchema,
  unsignedBigIntSchema,
  unsignedBigIntSchema,
  unsignedBigIntSchema,
  unsignedBigIntSchema,
  z.boolean(),
]);

export const miningEpochViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  beneficiaryContribution: unsignedBigIntSchema,
  beneficiaryHasClaimed: z.boolean(),
  beneficiaryPreviewClaim: unsignedBigIntSchema,
  contributionsPaused: z.boolean(),
  currentEpochId: unsignedBigIntSchema,
  emission: unsignedBigIntSchema,
  endTime: unsignedBigIntSchema,
  epochId: unsignedBigIntSchema,
  settled: z.boolean(),
  settledAt: unsignedBigIntSchema,
  startTime: unsignedBigIntSchema,
  started: z.boolean(),
  teamFee: unsignedBigIntSchema,
  totalContributed: unsignedBigIntSchema,
  vaultRevenue: unsignedBigIntSchema,
});
export type MiningEpochView = z.infer<typeof miningEpochViewSchema>;

export async function readMiningEpochView(
  client: PublicClient,
  contracts: Readonly<{ miningPool: Address; miningClaims: Address }>,
  epochId: bigint,
  beneficiary: Address,
  options: ReadOptions = {},
): Promise<MiningEpochView> {
  unsignedBigIntSchema.parse(epochId);
  const user = getAddress(beneficiary);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [epochRaw, currentEpochId, contributionsPaused, started, contribution, preview, hasClaimed] = await Promise.all(
    [
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'epochs', [epochId]),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'currentEpochId'),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'contributionsPaused'),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'started'),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'contributionOf', [epochId, user]),
      read(client, blockNumber, contracts.miningClaims, miningClaimsAbi, 'previewClaim', [user, epochId]),
      read(client, blockNumber, contracts.miningClaims, miningClaimsAbi, 'hasClaimed', [epochId, user]),
    ],
  );
  const [startTime, endTime, settledAt, totalContributed, teamFee, vaultRevenue, emission, settled] =
    epochSchema.parse(epochRaw);
  const result = miningEpochViewSchema.parse({
    beneficiaryContribution: contribution,
    beneficiaryHasClaimed: hasClaimed,
    beneficiaryPreviewClaim: preview,
    blockNumber,
    contributionsPaused,
    currentEpochId,
    emission,
    endTime,
    epochId,
    settled,
    settledAt,
    startTime,
    started,
    teamFee,
    totalContributed,
    vaultRevenue,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const emissionScheduleViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  currentScheduledEmission: unsignedBigIntSchema,
  nextMiningEpochId: unsignedBigIntSchema,
  remainingMintCapacity: unsignedBigIntSchema,
});
export type EmissionScheduleView = z.infer<typeof emissionScheduleViewSchema>;

export async function readEmissionScheduleView(
  client: PublicClient,
  controller: Address,
  options: ReadOptions = {},
): Promise<EmissionScheduleView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [currentScheduledEmission, nextMiningEpochId, remainingMintCapacity] = await Promise.all([
    read(client, blockNumber, controller, emissionControllerAbi, 'currentScheduledEmission'),
    read(client, blockNumber, controller, emissionControllerAbi, 'nextMiningEpochId'),
    read(client, blockNumber, controller, emissionControllerAbi, 'remainingMintCapacity'),
  ]);
  const result = emissionScheduleViewSchema.parse({
    blockNumber,
    currentScheduledEmission,
    nextMiningEpochId,
    remainingMintCapacity,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const signalViewSchema = z.object({
  activeStrategies: z.array(addressSchema).max(16),
  blockNumber: unsignedBigIntSchema,
  signalIncreasesPaused: z.boolean(),
  stakedBalance: unsignedBigIntSchema,
  usedWeight: unsignedBigIntSchema,
});
export type SignalView = z.infer<typeof signalViewSchema>;

export async function readSignalView(
  client: PublicClient,
  contracts: Readonly<{ stakedGBX: Address; allocationVoter: Address }>,
  user: Address,
  options: ReadOptions = {},
): Promise<SignalView> {
  const account = getAddress(user);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [stakedBalance, usedWeight, activeStrategies, signalIncreasesPaused] = await Promise.all([
    read(client, blockNumber, contracts.stakedGBX, stakedGbxAbi, 'balanceOf', [account]),
    read(client, blockNumber, contracts.allocationVoter, allocationVoterAbi, 'usedWeight', [account]),
    read(client, blockNumber, contracts.allocationVoter, allocationVoterAbi, 'activeStrategies', [account]),
    read(client, blockNumber, contracts.allocationVoter, allocationVoterAbi, 'signalIncreasesPaused'),
  ]);
  const result = signalViewSchema.parse({
    activeStrategies,
    blockNumber,
    signalIncreasesPaused,
    stakedBalance,
    usedWeight,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

const auctionViewBaseSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  epochId: unsignedBigIntSchema,
  epochPeriod: unsignedBigIntSchema,
  fillsPaused: z.boolean(),
  initPrice: unsignedBigIntSchema,
  kind: z.enum(['acquisition', 'buyback']),
  minInitPrice: unsignedBigIntSchema,
  priceMultiplier: unsignedBigIntSchema,
  rewards: addressSchema.nullable(),
  strategy: addressSchema,
  targetToken: addressSchema,
  usdGLot: unsignedBigIntSchema,
});

export const auctionViewSchema = z.discriminatedUnion('status', [
  auctionViewBaseSchema.extend({
    price: z.null(),
    startTime: z.literal(0n),
    status: z.literal('inactive'),
  }),
  auctionViewBaseSchema.extend({
    price: unsignedBigIntSchema,
    startTime: positiveBigIntSchema,
    status: z.literal('active'),
  }),
]);
export type AuctionView = z.infer<typeof auctionViewSchema>;

export async function readAuctionView(
  client: PublicClient,
  strategyAddress: Address,
  kind: 'acquisition' | 'buyback',
  options: ReadOptions = {},
): Promise<AuctionView> {
  const strategy = getAddress(strategyAddress);
  const abi = kind === 'acquisition' ? acquisitionStrategyAbi : buybackStrategyAbi;
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [epochId, epochPeriod, fillsPaused, initPrice, minInitPrice, priceMultiplier, startTimeRaw, usdGLot] =
    await Promise.all([
      read(client, blockNumber, strategy, abi, 'epochId'),
      read(client, blockNumber, strategy, abi, 'epochPeriod'),
      read(client, blockNumber, strategy, abi, 'fillsPaused'),
      read(client, blockNumber, strategy, abi, 'initPrice'),
      read(client, blockNumber, strategy, abi, 'minInitPrice'),
      read(client, blockNumber, strategy, abi, 'priceMultiplier'),
      read(client, blockNumber, strategy, abi, 'startTime'),
      read(client, blockNumber, strategy, abi, 'USDG_LOT'),
    ]);
  const startTime = unsignedBigIntSchema.parse(startTimeRaw);
  const [targetToken, rewards] =
    kind === 'acquisition'
      ? await Promise.all([
          read(client, blockNumber, strategy, acquisitionStrategyAbi, 'TARGET_TOKEN'),
          read(client, blockNumber, strategy, acquisitionStrategyAbi, 'STRATEGY_REWARDS'),
        ])
      : [await read(client, blockNumber, strategy, buybackStrategyAbi, 'GBX'), null];
  const status = startTime === 0n ? 'inactive' : 'active';
  const price = status === 'inactive' ? null : await read(client, blockNumber, strategy, abi, 'getPrice');
  const result = auctionViewSchema.parse({
    blockNumber,
    epochId,
    epochPeriod,
    fillsPaused,
    initPrice,
    kind,
    minInitPrice,
    price,
    priceMultiplier,
    rewards,
    startTime,
    status,
    strategy,
    targetToken,
    usdGLot,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const strategyRewardViewSchema = z.object({
  accountedRewards: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  earned: unsignedBigIntSchema,
  rewardPerWeightStored: unsignedBigIntSchema,
  rewardToken: addressSchema,
  strategy: addressSchema,
  totalWeight: unsignedBigIntSchema,
  userWeight: unsignedBigIntSchema,
});
export type StrategyRewardView = z.infer<typeof strategyRewardViewSchema>;

export async function readStrategyRewardView(
  client: PublicClient,
  rewards: Address,
  user: Address,
  options: ReadOptions = {},
): Promise<StrategyRewardView> {
  const account = getAddress(user);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [accountedRewards, earned, rewardPerWeightStored, rewardToken, strategy, totalWeight, userWeight] =
    await Promise.all([
      read(client, blockNumber, rewards, strategyRewardsAbi, 'accountedRewards'),
      read(client, blockNumber, rewards, strategyRewardsAbi, 'earned', [account]),
      read(client, blockNumber, rewards, strategyRewardsAbi, 'rewardPerWeightStored'),
      read(client, blockNumber, rewards, strategyRewardsAbi, 'REWARD_TOKEN'),
      read(client, blockNumber, rewards, strategyRewardsAbi, 'STRATEGY'),
      read(client, blockNumber, rewards, strategyRewardsAbi, 'totalWeight'),
      read(client, blockNumber, rewards, strategyRewardsAbi, 'weightOf', [account]),
    ]);
  const result = strategyRewardViewSchema.parse({
    accountedRewards,
    blockNumber,
    earned,
    rewardPerWeightStored,
    rewardToken,
    strategy,
    totalWeight,
    userWeight,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

const assetConfigSchema = z.object({
  live: z.boolean(),
  rewards: addressSchema,
  strategy: addressSchema,
  token: addressSchema,
});
export const registryViewSchema = z.object({
  assets: z.array(assetConfigSchema).max(16),
  blockNumber: unsignedBigIntSchema,
  strategies: z.array(addressSchema).max(16),
});
export type RegistryView = z.infer<typeof registryViewSchema>;

export async function readRegistryView(
  client: PublicClient,
  registry: Address,
  options: ReadOptions = {},
): Promise<RegistryView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [assetCountRaw, strategyCountRaw] = await Promise.all([
    read(client, blockNumber, registry, assetRegistryAbi, 'assetCount'),
    read(client, blockNumber, registry, assetRegistryAbi, 'strategyCount'),
  ]);
  const assetCount = unsignedBigIntSchema.max(16n).parse(assetCountRaw);
  const strategyCount = unsignedBigIntSchema.max(16n).parse(strategyCountRaw);
  const tokens = await Promise.all(
    Array.from({ length: Number(assetCount) }, (_, index) =>
      read(client, blockNumber, registry, assetRegistryAbi, 'assetAt', [BigInt(index)]),
    ),
  );
  const [assets, strategies] = await Promise.all([
    Promise.all(
      tokens.map((token) =>
        read(client, blockNumber, registry, assetRegistryAbi, 'configFor', [addressSchema.parse(token)]),
      ),
    ),
    Promise.all(
      Array.from({ length: Number(strategyCount) }, (_, index) =>
        read(client, blockNumber, registry, assetRegistryAbi, 'strategyAt', [BigInt(index)]),
      ),
    ),
  ]);
  const result = registryViewSchema.parse({ assets, blockNumber, strategies });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

const poolKeySchema = z.object({
  currency0: addressSchema,
  currency1: addressSchema,
  fee: z.number().int().min(0).max(16_777_215),
  hooks: addressSchema,
  tickSpacing: z.number().int().min(-8_388_608).max(8_388_607),
});
export const liquidityCustodyViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  expectedPositionTokenId: unsignedBigIntSchema,
  poolKey: poolKeySchema,
  poolKeyHash: bytes32Schema,
  positionInCustody: z.boolean(),
  positionRecorded: z.boolean(),
  positionTokenId: unsignedBigIntSchema,
});
export type LiquidityCustodyView = z.infer<typeof liquidityCustodyViewSchema>;

export async function readLiquidityCustodyView(
  client: PublicClient,
  custodian: Address,
  options: ReadOptions = {},
): Promise<LiquidityCustodyView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [expectedPositionTokenId, poolKey, poolKeyHash, positionInCustody, positionRecorded, positionTokenId] =
    await Promise.all([
      read(client, blockNumber, custodian, liquidityCustodianAbi, 'EXPECTED_POSITION_TOKEN_ID'),
      read(client, blockNumber, custodian, liquidityCustodianAbi, 'poolKey'),
      read(client, blockNumber, custodian, liquidityCustodianAbi, 'POOL_KEY_HASH'),
      read(client, blockNumber, custodian, liquidityCustodianAbi, 'positionInCustody'),
      read(client, blockNumber, custodian, liquidityCustodianAbi, 'positionRecorded'),
      read(client, blockNumber, custodian, liquidityCustodianAbi, 'positionTokenId'),
    ]);
  const result = liquidityCustodyViewSchema.parse({
    blockNumber,
    expectedPositionTokenId,
    poolKey,
    poolKeyHash,
    positionInCustody,
    positionRecorded,
    positionTokenId,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const redemptionPreviewSchema = z.object({
  amounts: z.array(unsignedBigIntSchema).max(16),
  assets: z.array(addressSchema).max(16),
  blockNumber: unsignedBigIntSchema,
  shares: unsignedBigIntSchema.positive(),
  supplyBefore: unsignedBigIntSchema.positive(),
});
export type RedemptionPreview = z.infer<typeof redemptionPreviewSchema>;

/** Computes the exact raw-basket preview from the same pre-burn balance and supply inputs used by the vault. */
export async function readRedemptionPreview(
  client: PublicClient,
  contracts: Readonly<{ assetRegistry: Address; gbx: Address; vault: Address }>,
  shares: bigint,
  options: ReadOptions = {},
): Promise<RedemptionPreview> {
  positiveBigIntSchema.parse(shares);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [supplyRaw, countRaw] = await Promise.all([
    read(client, blockNumber, contracts.gbx, gbxAbi, 'totalSupply'),
    read(client, blockNumber, contracts.assetRegistry, assetRegistryAbi, 'assetCount'),
  ]);
  const supplyBefore = unsignedBigIntSchema.positive().parse(supplyRaw);
  if (shares > supplyBefore) throw new RangeError('shares exceed total supply');
  const count = unsignedBigIntSchema.max(16n).parse(countRaw);
  const assets = z
    .array(addressSchema)
    .max(16)
    .parse(
      await Promise.all(
        Array.from({ length: Number(count) }, (_, index) =>
          read(client, blockNumber, contracts.assetRegistry, assetRegistryAbi, 'assetAt', [BigInt(index)]),
        ),
      ),
    );
  const balances = z
    .array(unsignedBigIntSchema)
    .parse(
      await Promise.all(
        assets.map((asset) => read(client, blockNumber, asset, gbxAbi, 'balanceOf', [getAddress(contracts.vault)])),
      ),
    );
  const result = redemptionPreviewSchema.parse({
    amounts: balances.map((balance) => (balance * shares) / supplyBefore),
    assets,
    blockNumber,
    shares,
    supplyBefore,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}
