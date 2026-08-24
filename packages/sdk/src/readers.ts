import { erc20Abi, getAddress, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { z } from 'zod';

import { bribeAbi, bribeRouterAbi, gbxAbi, mineAbi, signalGbxAbi, strategyAbi, resonanceAbi } from './abis.js';
import { pinBlockSnapshot, revalidateBlockSnapshot, type BlockSnapshot } from './block-snapshot.js';
import { addressSchema, unsignedBigIntSchema } from './validation.js';

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
  lifetimeBurned: unsignedBigIntSchema,
  lifetimeMinted: unsignedBigIntSchema,
  minter: addressSchema,
  minterLocked: z.boolean(),
  totalSupply: unsignedBigIntSchema,
});
export type SupplyView = z.infer<typeof supplyViewSchema>;

/** Reads cumulative GBX issuance, burns, supply, and permanent mining authority from one canonical block. */
export async function readSupplyView(
  client: PublicClient,
  gbx: Address,
  options: ReadOptions = {},
): Promise<SupplyView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [lifetimeBurned, lifetimeMinted, minter, minterLocked, totalSupply] = await Promise.all([
    read(client, blockNumber, gbx, gbxAbi, 'lifetimeBurned'),
    read(client, blockNumber, gbx, gbxAbi, 'lifetimeMinted'),
    read(client, blockNumber, gbx, gbxAbi, 'minter'),
    read(client, blockNumber, gbx, gbxAbi, 'minterLocked'),
    read(client, blockNumber, gbx, gbxAbi, 'totalSupply'),
  ]);
  const result = supplyViewSchema.parse({
    blockNumber,
    lifetimeBurned,
    lifetimeMinted,
    minter,
    minterLocked,
    totalSupply,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const mineSlotViewSchema = z.object({
  aggregateTps: unsignedBigIntSchema,
  auctionStartedAt: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  blockTimestamp: unsignedBigIntSchema,
  claimableMinerPayment: unsignedBigIntSchema,
  currentHalvingEra: unsignedBigIntSchema,
  currentPrice: unsignedBigIntSchema,
  effectiveTotalSupply: unsignedBigIntSchema,
  epochId: unsignedBigIntSchema,
  halvingPeriod: unsignedBigIntSchema,
  index: unsignedBigIntSchema,
  initialPrice: unsignedBigIntSchema,
  lastAccruedAt: unsignedBigIntSchema,
  mine: addressSchema,
  nextHalvingBoundary: unsignedBigIntSchema.nullable(),
  nextGlobalTps: unsignedBigIntSchema,
  pendingSlotEmission: unsignedBigIntSchema,
  prospectiveSlotTps: unsignedBigIntSchema,
  slotCount: unsignedBigIntSchema,
  slotMiner: addressSchema,
  startTime: unsignedBigIntSchema,
  tailTps: unsignedBigIntSchema,
  totalPendingEmission: unsignedBigIntSchema,
  totalClaimableMinerPayments: unsignedBigIntSchema,
  totalMined: unsignedBigIntSchema,
  tps: unsignedBigIntSchema,
});
export type MineSlotView = z.infer<typeof mineSlotViewSchema>;

/** Reads one slot, Mine accounting, and the time-based prospective-rate boundary at one canonical block. */
export async function readMineSlotView(
  client: PublicClient,
  mine: Address,
  index: bigint,
  account: Address,
  options: ReadOptions = {},
): Promise<MineSlotView> {
  unsignedBigIntSchema.parse(index);
  const claimant = getAddress(account);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const blockTimestamp = unsignedBigIntSchema.parse(pinned.blockTimestamp);
  const [
    aggregateTps,
    claimableMinerPayment,
    currentPrice,
    effectiveTotalSupply,
    halvingPeriodRaw,
    slot,
    nextGlobalTps,
    pendingSlotEmission,
    slotCount,
    startTimeRaw,
    tailTps,
    totalClaimableMinerPayments,
    totalMined,
    totalPendingEmission,
  ] = await Promise.all([
    read(client, blockNumber, mine, mineAbi, 'aggregateTps'),
    read(client, blockNumber, mine, mineAbi, 'claimableMinerPayment', [claimant]),
    read(client, blockNumber, mine, mineAbi, 'currentPrice', [index]),
    read(client, blockNumber, mine, mineAbi, 'effectiveTotalSupply'),
    read(client, blockNumber, mine, mineAbi, 'HALVING_PERIOD'),
    read(client, blockNumber, mine, mineAbi, 'slot', [index]),
    read(client, blockNumber, mine, mineAbi, 'nextGlobalTps'),
    read(client, blockNumber, mine, mineAbi, 'pendingSlotEmission', [index]),
    read(client, blockNumber, mine, mineAbi, 'SLOT_COUNT'),
    read(client, blockNumber, mine, mineAbi, 'startTime'),
    read(client, blockNumber, mine, mineAbi, 'TAIL_TPS'),
    read(client, blockNumber, mine, mineAbi, 'totalClaimableMinerPayments'),
    read(client, blockNumber, mine, mineAbi, 'totalMined'),
    read(client, blockNumber, mine, mineAbi, 'pendingEmission'),
  ]);
  const slotRecord = slot as Readonly<Record<string, unknown>>;
  const values = Array.isArray(slot)
    ? slot
    : [
        slotRecord.epochId,
        slotRecord.initialPrice,
        slotRecord.auctionStartedAt,
        slotRecord.lastAccruedAt,
        slotRecord.tps,
        slotRecord.miner,
      ];
  const halvingPeriod = unsignedBigIntSchema.parse(halvingPeriodRaw);
  const startTime = unsignedBigIntSchema.parse(startTimeRaw);
  const parsedNextGlobalTps = unsignedBigIntSchema.parse(nextGlobalTps);
  const parsedSlotCount = unsignedBigIntSchema.parse(slotCount);
  const parsedTailTps = unsignedBigIntSchema.parse(tailTps);
  if (blockTimestamp < startTime) throw new RangeError('Mine startTime cannot exceed the pinned block timestamp');
  if (halvingPeriod === 0n) throw new RangeError('Mine HALVING_PERIOD must be positive');
  if (parsedSlotCount === 0n) throw new RangeError('Mine SLOT_COUNT must be positive');
  const currentHalvingEra = (blockTimestamp - startTime) / halvingPeriod;
  const nextHalvingBoundary =
    parsedNextGlobalTps <= parsedTailTps ? null : startTime + (currentHalvingEra + 1n) * halvingPeriod;
  const result = mineSlotViewSchema.parse({
    aggregateTps,
    auctionStartedAt: values[2],
    blockNumber,
    blockTimestamp,
    claimableMinerPayment,
    currentHalvingEra,
    currentPrice,
    effectiveTotalSupply,
    epochId: values[0],
    halvingPeriod,
    index,
    initialPrice: values[1],
    lastAccruedAt: values[3],
    mine,
    nextHalvingBoundary,
    nextGlobalTps,
    pendingSlotEmission,
    prospectiveSlotTps: parsedNextGlobalTps / parsedSlotCount,
    slotCount,
    slotMiner: values[5],
    startTime,
    tailTps,
    totalClaimableMinerPayments,
    totalMined,
    totalPendingEmission,
    tps: values[4],
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const signalViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  currentVotes: unsignedBigIntSchema,
  delegate: addressSchema,
  signalBalance: unsignedBigIntSchema,
});
export type SignalView = z.infer<typeof signalViewSchema>;

/** Reads an account's fully allocated SignalGBX aggregate, delegation, and current votes. */
export async function readSignalView(
  client: PublicClient,
  signalGBX: Address,
  account: Address,
  options: ReadOptions = {},
): Promise<SignalView> {
  const signalerAccount = getAddress(account);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [signalBalance, delegate, currentVotes] = await Promise.all([
    read(client, blockNumber, signalGBX, signalGbxAbi, 'balanceOf', [signalerAccount]),
    read(client, blockNumber, signalGBX, signalGbxAbi, 'delegates', [signalerAccount]),
    read(client, blockNumber, signalGBX, signalGbxAbi, 'getVotes', [signalerAccount]),
  ]);
  const result = signalViewSchema.parse({
    blockNumber,
    currentVotes,
    delegate,
    signalBalance,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const resonanceViewSchema = z.object({
  basisPoints: unsignedBigIntSchema.positive(),
  blockNumber: unsignedBigIntSchema,
  bribeBasisPoints: unsignedBigIntSchema,
  defaultBribeBasisPoints: unsignedBigIntSchema,
  rewardDuration: unsignedBigIntSchema,
  fundBasisPoints: unsignedBigIntSchema,
  lastUpdateTime: unsignedBigIntSchema,
  remainingRevenue: unsignedBigIntSchema,
  maximumBribeBasisPoints: unsignedBigIntSchema,
  periodFinish: unsignedBigIntSchema,
  resonanceRouter: addressSchema,
  revenuePerSignalStored: unsignedBigIntSchema,
  rewardPrecision: unsignedBigIntSchema,
  revenueRate: unsignedBigIntSchema,
  totalSignalWeight: unsignedBigIntSchema,
  usdg: addressSchema,
  usdgBalance: unsignedBigIntSchema,
});
export type ResonanceView = z.infer<typeof resonanceViewSchema>;

/** Reads Resonance's global allocation and revenue state. */
export async function readResonanceView(
  client: PublicClient,
  resonance: Address,
  options: ReadOptions = {},
): Promise<ResonanceView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const normalizedResonance = getAddress(resonance);
  const [
    basisPoints,
    bribeBasisPoints,
    defaultBribeBasisPoints,
    rewardDuration,
    maximumBribeBasisPoints,
    resonanceRouter,
    rewardPrecision,
    totalSignalWeight,
    usdgRaw,
  ] = await Promise.all([
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'BPS'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'bribeBps'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'DEFAULT_BRIBE_BPS'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'REWARD_DURATION'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'MAX_BRIBE_BPS'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'resonanceRouter'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'REWARD_PRECISION'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'totalSignalWeight'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'usdg'),
  ]);
  const usdg = addressSchema.parse(usdgRaw);
  const [revenueData, remainingRevenue, usdgBalance] = await Promise.all([
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'revenueData'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'remainingRevenue'),
    read(client, blockNumber, usdg, erc20Abi, 'balanceOf', [normalizedResonance]),
  ]);
  const revenueDataRecord = revenueData as Readonly<Record<string, unknown>>;
  const revenueDataValues = Array.isArray(revenueData)
    ? revenueData
    : [
        revenueDataRecord.periodFinish,
        revenueDataRecord.revenueRate,
        revenueDataRecord.lastUpdateTime,
        revenueDataRecord.revenuePerSignalStored,
      ];
  const result = resonanceViewSchema.parse({
    basisPoints,
    blockNumber,
    bribeBasisPoints,
    defaultBribeBasisPoints,
    rewardDuration,
    fundBasisPoints: (basisPoints as bigint) - (bribeBasisPoints as bigint),
    lastUpdateTime: revenueDataValues[2],
    remainingRevenue,
    maximumBribeBasisPoints,
    periodFinish: revenueDataValues[0],
    resonanceRouter,
    revenuePerSignalStored: revenueDataValues[3],
    rewardPrecision,
    revenueRate: revenueDataValues[1],
    totalSignalWeight,
    usdg,
    usdgBalance,
  });
  if (
    result.defaultBribeBasisPoints > result.maximumBribeBasisPoints ||
    result.bribeBasisPoints > result.maximumBribeBasisPoints ||
    result.maximumBribeBasisPoints > result.basisPoints
  ) {
    throw new RangeError('Resonance Bribe basis-point configuration is incoherent');
  }
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const strategyViewSchema = z.object({
  availableRevenue: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  currentPrice: unsignedBigIntSchema,
  epochDuration: unsignedBigIntSchema,
  epochId: unsignedBigIntSchema,
  epochStartedAt: unsignedBigIntSchema,
  fund: addressSchema,
  initialPrice: unsignedBigIntSchema,
  minimumPrice: unsignedBigIntSchema,
  paymentToken: addressSchema,
  priceMultiplier: unsignedBigIntSchema,
  usdg: addressSchema,
  strategy: addressSchema,
});
export type StrategyView = z.infer<typeof strategyViewSchema>;

/** Reads the active state and immutable configuration of one Strategy. */
export async function readStrategyView(
  client: PublicClient,
  strategyAddress: Address,
  options: ReadOptions = {},
): Promise<StrategyView> {
  const strategy = getAddress(strategyAddress);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [
    currentPrice,
    epochDuration,
    epochId,
    epochStartedAt,
    fund,
    initialPrice,
    minimumPrice,
    paymentToken,
    priceMultiplier,
    usdgRaw,
  ] = await Promise.all([
    read(client, blockNumber, strategy, strategyAbi, 'currentPrice'),
    read(client, blockNumber, strategy, strategyAbi, 'epochDuration'),
    read(client, blockNumber, strategy, strategyAbi, 'epochId'),
    read(client, blockNumber, strategy, strategyAbi, 'epochStartedAt'),
    read(client, blockNumber, strategy, strategyAbi, 'fund'),
    read(client, blockNumber, strategy, strategyAbi, 'initialPrice'),
    read(client, blockNumber, strategy, strategyAbi, 'minimumPrice'),
    read(client, blockNumber, strategy, strategyAbi, 'paymentToken'),
    read(client, blockNumber, strategy, strategyAbi, 'priceMultiplier'),
    read(client, blockNumber, strategy, strategyAbi, 'usdg'),
  ]);
  const usdg = addressSchema.parse(usdgRaw);
  const availableRevenue = await read(client, blockNumber, usdg, erc20Abi, 'balanceOf', [strategy]);
  const result = strategyViewSchema.parse({
    availableRevenue,
    blockNumber,
    currentPrice,
    epochDuration,
    epochId,
    epochStartedAt,
    fund,
    initialPrice,
    minimumPrice,
    paymentToken,
    priceMultiplier,
    strategy,
    usdg,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const bribeRewardViewSchema = z.object({
  accountSignalWeight: unsignedBigIntSchema,
  account: addressSchema,
  blockNumber: unsignedBigIntSchema,
  earned: z.array(unsignedBigIntSchema),
  remainingRewards: z.array(unsignedBigIntSchema),
  rewardTokens: z.array(addressSchema),
  totalSignalWeight: unsignedBigIntSchema,
});
export type BribeRewardView = z.infer<typeof bribeRewardViewSchema>;

/** Reads all rewards currently accrued by one account in a Bribe. */
export async function readBribeRewardView(
  client: PublicClient,
  bribe: Address,
  account: Address,
  options: ReadOptions = {},
): Promise<BribeRewardView> {
  const rewardAccount = getAddress(account);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [rewardTokensRaw, totalSignalWeight, accountSignalWeight] = await Promise.all([
    read(client, blockNumber, bribe, bribeAbi, 'rewardTokens'),
    read(client, blockNumber, bribe, bribeAbi, 'totalSignalWeight'),
    read(client, blockNumber, bribe, bribeAbi, 'signalWeightOf', [rewardAccount]),
  ]);
  const rewardTokens = z.array(addressSchema).parse(rewardTokensRaw);
  const [earned, remainingRewards] = await Promise.all([
    Promise.all(
      rewardTokens.map((rewardToken) =>
        read(client, blockNumber, bribe, bribeAbi, 'earned', [rewardAccount, rewardToken]),
      ),
    ),
    Promise.all(
      rewardTokens.map((rewardToken) => read(client, blockNumber, bribe, bribeAbi, 'remainingReward', [rewardToken])),
    ),
  ]);
  const result = bribeRewardViewSchema.parse({
    account: rewardAccount,
    blockNumber,
    earned,
    remainingRewards,
    rewardTokens,
    totalSignalWeight,
    accountSignalWeight,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const bribeRouterViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  bribe: addressSchema,
  bufferedReward: unsignedBigIntSchema,
  remainingReward: unsignedBigIntSchema,
  minimumRewardAmount: unsignedBigIntSchema.positive(),
  paymentToken: addressSchema,
});
export type BribeRouterView = z.infer<typeof bribeRouterViewSchema>;

/** Reads one Strategy's minimal Bribe buffer and current notification thresholds. */
export async function readBribeRouterView(
  client: PublicClient,
  bribeRouter: Address,
  options: ReadOptions = {},
): Promise<BribeRouterView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [bribe, paymentToken] = await Promise.all([
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'bribe'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'paymentToken'),
  ]);
  const normalizedBribe = addressSchema.parse(bribe);
  const normalizedPaymentToken = addressSchema.parse(paymentToken);
  const [bufferedReward, remainingReward, minimumRewardAmount] = await Promise.all([
    read(client, blockNumber, normalizedPaymentToken, erc20Abi, 'balanceOf', [getAddress(bribeRouter)]),
    read(client, blockNumber, normalizedBribe, bribeAbi, 'remainingReward', [normalizedPaymentToken]),
    read(client, blockNumber, normalizedBribe, bribeAbi, 'REWARD_DURATION'),
  ]);
  const result = bribeRouterViewSchema.parse({
    blockNumber,
    bribe,
    bufferedReward,
    remainingReward,
    minimumRewardAmount,
    paymentToken,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const redemptionPreviewSchema = z.object({
  amounts: z.array(unsignedBigIntSchema),
  blockNumber: unsignedBigIntSchema,
  gbxAmount: unsignedBigIntSchema.positive(),
  effectiveSupplyBefore: unsignedBigIntSchema.positive(),
  tokens: z.array(addressSchema),
});
export type RedemptionPreview = z.infer<typeof redemptionPreviewSchema>;

/** Computes a registry-free Fund redemption preview for exactly the tokens selected by the caller. */
export async function readRedemptionPreview(
  client: PublicClient,
  contracts: Readonly<{ fund: Address; mine: Address }>,
  gbxAmount: bigint,
  tokens: readonly Address[],
  options: ReadOptions = {},
): Promise<RedemptionPreview> {
  unsignedBigIntSchema.positive().parse(gbxAmount);
  const selectedTokens = z.array(addressSchema).nonempty().parse(tokens);
  if (new Set(selectedTokens).size !== selectedTokens.length) throw new RangeError('tokens cannot contain duplicates');
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const effectiveSupplyBefore = unsignedBigIntSchema
    .positive()
    .parse(await read(client, blockNumber, contracts.mine, mineAbi, 'effectiveTotalSupply'));
  if (gbxAmount > effectiveSupplyBefore) throw new RangeError('gbxAmount exceeds effective supply');
  const balances = z
    .array(unsignedBigIntSchema)
    .parse(
      await Promise.all(
        selectedTokens.map((token) => read(client, blockNumber, token, erc20Abi, 'balanceOf', [contracts.fund])),
      ),
    );
  const result = redemptionPreviewSchema.parse({
    amounts: balances.map((balance) => (balance * gbxAmount) / effectiveSupplyBefore),
    blockNumber,
    gbxAmount,
    effectiveSupplyBefore,
    tokens: selectedTokens,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}
