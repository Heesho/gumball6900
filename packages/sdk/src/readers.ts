import { getAddress, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { z } from 'zod';

import {
  bribeAbi,
  bribeRouterAbi,
  fundraiserAbi,
  gbxAbi,
  liquidityPositionAbi,
  signalGbxAbi,
  strategyAbi,
  resonanceAbi,
} from './abis.js';
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
  remainingMintableSupply: unsignedBigIntSchema,
  totalSupply: unsignedBigIntSchema,
});
export type SupplyView = z.infer<typeof supplyViewSchema>;

/** Reads the complete GBX lifetime-supply state from one canonical block. */
export async function readSupplyView(
  client: PublicClient,
  gbx: Address,
  options: ReadOptions = {},
): Promise<SupplyView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [lifetimeBurned, lifetimeMinted, minter, minterLocked, remainingMintableSupply, totalSupply] =
    await Promise.all([
      read(client, blockNumber, gbx, gbxAbi, 'lifetimeBurned'),
      read(client, blockNumber, gbx, gbxAbi, 'lifetimeMinted'),
      read(client, blockNumber, gbx, gbxAbi, 'minter'),
      read(client, blockNumber, gbx, gbxAbi, 'minterLocked'),
      read(client, blockNumber, gbx, gbxAbi, 'remainingMintableSupply'),
      read(client, blockNumber, gbx, gbxAbi, 'totalSupply'),
    ]);
  const result = supplyViewSchema.parse({
    blockNumber,
    lifetimeBurned,
    lifetimeMinted,
    minter,
    minterLocked,
    remainingMintableSupply,
    totalSupply,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const fundraiserEpochViewSchema = z.object({
  accountContribution: unsignedBigIntSchema,
  accountHasClaimed: z.boolean(),
  blockNumber: unsignedBigIntSchema,
  currentEpoch: unsignedBigIntSchema,
  emission: unsignedBigIntSchema,
  epoch: unsignedBigIntSchema,
  epochSettled: z.boolean(),
  nextEpochToSettle: unsignedBigIntSchema,
  nextScheduledEmission: unsignedBigIntSchema,
  pendingReward: unsignedBigIntSchema,
  totalContributions: unsignedBigIntSchema,
});
export type FundraiserEpochView = z.infer<typeof fundraiserEpochViewSchema>;

/** Reads one account's contribution and claim state for a Fundraiser epoch. */
export async function readFundraiserEpochView(
  client: PublicClient,
  fundraiser: Address,
  epoch: bigint,
  account: Address,
  options: ReadOptions = {},
): Promise<FundraiserEpochView> {
  unsignedBigIntSchema.parse(epoch);
  const contributor = getAddress(account);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [
    currentEpoch,
    emission,
    epochSettled,
    nextEpochToSettle,
    nextScheduledEmission,
    totalContributions,
    accountContribution,
    accountHasClaimed,
    pendingReward,
  ] = await Promise.all([
    read(client, blockNumber, fundraiser, fundraiserAbi, 'currentEpoch'),
    read(client, blockNumber, fundraiser, fundraiserAbi, 'epochEmission', [epoch]),
    read(client, blockNumber, fundraiser, fundraiserAbi, 'epochSettled', [epoch]),
    read(client, blockNumber, fundraiser, fundraiserAbi, 'nextEpochToSettle'),
    read(client, blockNumber, fundraiser, fundraiserAbi, 'currentScheduledEmission'),
    read(client, blockNumber, fundraiser, fundraiserAbi, 'epochContributions', [epoch]),
    read(client, blockNumber, fundraiser, fundraiserAbi, 'accountContributions', [epoch, contributor]),
    read(client, blockNumber, fundraiser, fundraiserAbi, 'accountHasClaimed', [epoch, contributor]),
    read(client, blockNumber, fundraiser, fundraiserAbi, 'pendingReward', [epoch, contributor]),
  ]);
  const result = fundraiserEpochViewSchema.parse({
    accountContribution,
    accountHasClaimed,
    blockNumber,
    currentEpoch,
    emission,
    epoch,
    epochSettled,
    nextEpochToSettle,
    nextScheduledEmission,
    pendingReward,
    totalContributions,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const liquidityPositionViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  expectedPositionTokenId: unsignedBigIntSchema,
  expectedTickLower: z.number().int(),
  expectedTickUpper: z.number().int(),
  fund: addressSchema,
  poolKeyHash: z.string().regex(/^0x[\da-f]{64}$/iu),
  positionInCustody: z.boolean(),
  positionRecorded: z.boolean(),
  positionTokenId: unsignedBigIntSchema,
  resonanceRouter: addressSchema,
});
export type LiquidityPositionView = z.infer<typeof liquidityPositionViewSchema>;

/** Reads custody and range state for the canonical Uniswap v4 position. */
export async function readLiquidityPositionView(
  client: PublicClient,
  liquidityPosition: Address,
  options: ReadOptions = {},
): Promise<LiquidityPositionView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [
    expectedPositionTokenId,
    expectedTickLower,
    expectedTickUpper,
    fund,
    poolKeyHash,
    positionInCustody,
    positionRecorded,
    positionTokenId,
    resonanceRouter,
  ] = await Promise.all([
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'expectedPositionTokenId'),
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'expectedTickLower'),
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'expectedTickUpper'),
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'fund'),
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'poolKeyHash'),
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'positionInCustody'),
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'positionRecorded'),
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'positionTokenId'),
    read(client, blockNumber, liquidityPosition, liquidityPositionAbi, 'resonanceRouter'),
  ]);
  const result = liquidityPositionViewSchema.parse({
    blockNumber,
    expectedPositionTokenId,
    expectedTickLower,
    expectedTickUpper,
    fund,
    poolKeyHash,
    positionInCustody,
    positionRecorded,
    positionTokenId,
    resonanceRouter,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const signalViewSchema = z.object({
  accountSignalWeight: unsignedBigIntSchema,
  accountStrategies: z.array(addressSchema),
  blockNumber: unsignedBigIntSchema,
  signalBalance: unsignedBigIntSchema,
  unallocatedSignalBalance: unsignedBigIntSchema,
});
export type SignalView = z.infer<typeof signalViewSchema>;

/** Reads an account's SignalGBX balance, absolute allocation, and immediately withdrawable remainder. */
export async function readSignalView(
  client: PublicClient,
  contracts: Readonly<{ signalGBX: Address; resonance: Address }>,
  account: Address,
  options: ReadOptions = {},
): Promise<SignalView> {
  const signalerAccount = getAddress(account);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [signalBalance, accountSignalWeight, accountStrategies] = await Promise.all([
    read(client, blockNumber, contracts.signalGBX, signalGbxAbi, 'balanceOf', [signalerAccount]),
    read(client, blockNumber, contracts.resonance, resonanceAbi, 'accountSignalWeight', [signalerAccount]),
    read(client, blockNumber, contracts.resonance, resonanceAbi, 'accountStrategies', [signalerAccount]),
  ]);
  const parsedSignalBalance = unsignedBigIntSchema.parse(signalBalance);
  const parsedAccountSignalWeight = unsignedBigIntSchema.parse(accountSignalWeight);
  const result = signalViewSchema.parse({
    accountSignalWeight: parsedAccountSignalWeight,
    accountStrategies,
    blockNumber,
    signalBalance: parsedSignalBalance,
    unallocatedSignalBalance: parsedSignalBalance - parsedAccountSignalWeight,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const resonanceViewSchema = z.object({
  accountedRevenueBalance: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  fundRevenueLiability: unsignedBigIntSchema,
  indexedRevenueScaled: unsignedBigIntSchema,
  pendingRevenueScaled: unsignedBigIntSchema,
  revenueIndex: unsignedBigIntSchema,
  strategies: z.array(addressSchema),
  totalClaimableRevenue: unsignedBigIntSchema,
  totalSignalWeight: unsignedBigIntSchema,
  unaccountedRevenue: unsignedBigIntSchema,
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
  const [
    accountedRevenueBalance,
    fundRevenueLiability,
    indexedRevenueScaled,
    pendingRevenueScaled,
    revenueIndex,
    strategies,
    totalClaimableRevenue,
    totalSignalWeight,
    unaccountedRevenue,
  ] = await Promise.all([
    read(client, blockNumber, resonance, resonanceAbi, 'accountedRevenueBalance'),
    read(client, blockNumber, resonance, resonanceAbi, 'fundRevenueLiability'),
    read(client, blockNumber, resonance, resonanceAbi, 'indexedRevenueScaled'),
    read(client, blockNumber, resonance, resonanceAbi, 'pendingRevenueScaled'),
    read(client, blockNumber, resonance, resonanceAbi, 'revenueIndex'),
    read(client, blockNumber, resonance, resonanceAbi, 'strategies'),
    read(client, blockNumber, resonance, resonanceAbi, 'totalClaimableRevenue'),
    read(client, blockNumber, resonance, resonanceAbi, 'totalSignalWeight'),
    read(client, blockNumber, resonance, resonanceAbi, 'unaccountedRevenue'),
  ]);
  const result = resonanceViewSchema.parse({
    accountedRevenueBalance,
    blockNumber,
    fundRevenueLiability,
    indexedRevenueScaled,
    pendingRevenueScaled,
    revenueIndex,
    strategies,
    totalClaimableRevenue,
    totalSignalWeight,
    unaccountedRevenue,
  });
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
  revenueToken: addressSchema,
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
    availableRevenue,
    currentPrice,
    epochDuration,
    epochId,
    epochStartedAt,
    fund,
    initialPrice,
    minimumPrice,
    paymentToken,
    priceMultiplier,
    revenueToken,
  ] = await Promise.all([
    read(client, blockNumber, strategy, strategyAbi, 'availableRevenue'),
    read(client, blockNumber, strategy, strategyAbi, 'currentPrice'),
    read(client, blockNumber, strategy, strategyAbi, 'epochDuration'),
    read(client, blockNumber, strategy, strategyAbi, 'epochId'),
    read(client, blockNumber, strategy, strategyAbi, 'epochStartedAt'),
    read(client, blockNumber, strategy, strategyAbi, 'fund'),
    read(client, blockNumber, strategy, strategyAbi, 'initialPrice'),
    read(client, blockNumber, strategy, strategyAbi, 'minimumPrice'),
    read(client, blockNumber, strategy, strategyAbi, 'paymentToken'),
    read(client, blockNumber, strategy, strategyAbi, 'priceMultiplier'),
    read(client, blockNumber, strategy, strategyAbi, 'revenueToken'),
  ]);
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
    revenueToken,
    strategy,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const bribeRewardViewSchema = z.object({
  accountedRewardBalances: z.array(unsignedBigIntSchema),
  accountSignalWeight: unsignedBigIntSchema,
  account: addressSchema,
  blockNumber: unsignedBigIntSchema,
  earned: z.array(unsignedBigIntSchema),
  fundRewardLiabilities: z.array(unsignedBigIntSchema),
  queuedRewards: z.array(unsignedBigIntSchema),
  rewardTokens: z.array(addressSchema),
  rewardSurpluses: z.array(unsignedBigIntSchema),
  scheduledRewards: z.array(unsignedBigIntSchema),
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
    read(client, blockNumber, bribe, bribeAbi, 'totalSupply'),
    read(client, blockNumber, bribe, bribeAbi, 'balanceOf', [rewardAccount]),
  ]);
  const rewardTokens = z.array(addressSchema).parse(rewardTokensRaw);
  const earned = await Promise.all(
    rewardTokens.map((rewardToken) =>
      read(client, blockNumber, bribe, bribeAbi, 'earned', [rewardAccount, rewardToken]),
    ),
  );
  const [accountedRewardBalances, fundRewardLiabilities, queuedRewards, rewardSurpluses, scheduledRewards] =
    await Promise.all([
      Promise.all(
        rewardTokens.map((rewardToken) =>
          read(client, blockNumber, bribe, bribeAbi, 'accountedRewardBalance', [rewardToken]),
        ),
      ),
      Promise.all(
        rewardTokens.map((rewardToken) =>
          read(client, blockNumber, bribe, bribeAbi, 'fundRewardLiability', [rewardToken]),
        ),
      ),
      Promise.all(
        rewardTokens.map((rewardToken) => read(client, blockNumber, bribe, bribeAbi, 'queuedRewards', [rewardToken])),
      ),
      Promise.all(
        rewardTokens.map((rewardToken) => read(client, blockNumber, bribe, bribeAbi, 'rewardSurplus', [rewardToken])),
      ),
      Promise.all(
        rewardTokens.map((rewardToken) =>
          read(client, blockNumber, bribe, bribeAbi, 'scheduledRewards', [rewardToken]),
        ),
      ),
    ]);
  const result = bribeRewardViewSchema.parse({
    accountedRewardBalances,
    account: rewardAccount,
    blockNumber,
    earned,
    fundRewardLiabilities,
    queuedRewards,
    rewardTokens,
    rewardSurpluses,
    scheduledRewards,
    totalSignalWeight,
    accountSignalWeight,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const bribeRouterViewSchema = z.object({
  accountedPaymentBalance: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  fundPaymentLiability: unsignedBigIntSchema,
  paymentSurplus: unsignedBigIntSchema,
});
export type BribeRouterView = z.infer<typeof bribeRouterViewSchema>;

/** Reads a Strategy router's fixed Fund payment liability and direct-donation surplus. */
export async function readBribeRouterView(
  client: PublicClient,
  bribeRouter: Address,
  options: ReadOptions = {},
): Promise<BribeRouterView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [accountedPaymentBalance, fundPaymentLiability, paymentSurplus] = await Promise.all([
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'accountedPaymentBalance'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'fundPaymentLiability'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'paymentSurplus'),
  ]);
  const result = bribeRouterViewSchema.parse({
    accountedPaymentBalance,
    blockNumber,
    fundPaymentLiability,
    paymentSurplus,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const redemptionPreviewSchema = z.object({
  amounts: z.array(unsignedBigIntSchema),
  blockNumber: unsignedBigIntSchema,
  gbxAmount: unsignedBigIntSchema.positive(),
  supplyBefore: unsignedBigIntSchema.positive(),
  tokens: z.array(addressSchema),
});
export type RedemptionPreview = z.infer<typeof redemptionPreviewSchema>;

/** Computes a registry-free Fund redemption preview for exactly the tokens selected by the caller. */
export async function readRedemptionPreview(
  client: PublicClient,
  contracts: Readonly<{ fund: Address; gbx: Address }>,
  gbxAmount: bigint,
  tokens: readonly Address[],
  options: ReadOptions = {},
): Promise<RedemptionPreview> {
  unsignedBigIntSchema.positive().parse(gbxAmount);
  const selectedTokens = z.array(addressSchema).nonempty().parse(tokens);
  if (new Set(selectedTokens).size !== selectedTokens.length) throw new RangeError('tokens cannot contain duplicates');
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const supplyBefore = unsignedBigIntSchema
    .positive()
    .parse(await read(client, blockNumber, contracts.gbx, gbxAbi, 'totalSupply'));
  if (gbxAmount > supplyBefore) throw new RangeError('gbxAmount exceeds total supply');
  const balances = z
    .array(unsignedBigIntSchema)
    .parse(
      await Promise.all(
        selectedTokens.map((token) => read(client, blockNumber, token, gbxAbi, 'balanceOf', [contracts.fund])),
      ),
    );
  const result = redemptionPreviewSchema.parse({
    amounts: balances.map((balance) => (balance * gbxAmount) / supplyBefore),
    blockNumber,
    gbxAmount,
    supplyBefore,
    tokens: selectedTokens,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}
