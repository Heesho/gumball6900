import type { Abi, Address, Hex, PublicClient } from 'viem';
import { z } from 'zod';

import {
  acquisitionStrategyAbi,
  allocationVoterAbi,
  assetRegistryAbi,
  buybackStrategyAbi,
  gbxAbi,
  genesisBootstrapAbi,
  genesisClaimsAbi,
  gumBallLensAbi,
  managerRewardsAbi,
  miningClaimsAbi,
  miningPoolAbi,
} from './abis.js';
import { pinBlockSnapshot, revalidateBlockSnapshot, type BlockSnapshot } from './block-snapshot.js';
import { quoteAuctionTargetAmount } from './math/auction.js';
import { addressSchema, bytes32Schema, tokenDecimalsSchema, unsignedBigIntSchema } from './validation.js';

async function read(
  client: PublicClient,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<unknown> {
  return client.readContract({ address: addressSchema.parse(address), abi, blockNumber, functionName, args } as never);
}

export interface ReadOptions {
  /** Pins every RPC call in a composed view to one block. Defaults to a freshly read latest block. */
  readonly atBlock?: bigint;
  /** Optional expected hash for binding multiple SDK reads to the same canonical block. */
  readonly expectedBlockHash?: Hex;
}

async function snapshotBlock(client: PublicClient, options: ReadOptions): Promise<BlockSnapshot> {
  return pinBlockSnapshot(client, options.atBlock, options.expectedBlockHash);
}

export const supplyViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  cumulativeBurned: unsignedBigIntSchema,
  cumulativeMinted: unsignedBigIntSchema,
  remainingMintCapacity: unsignedBigIntSchema,
  totalSupply: unsignedBigIntSchema,
});
export type SupplyView = z.infer<typeof supplyViewSchema>;

export async function readSupplyView(
  client: PublicClient,
  gumBallLens: Address,
  options: ReadOptions = {},
): Promise<SupplyView> {
  const snapshot = await snapshotBlock(client, options);
  const { blockNumber } = snapshot;
  const supply = z
    .object({
      cumulativeBurned: unsignedBigIntSchema,
      cumulativeMinted: unsignedBigIntSchema,
      remainingMintCapacity: unsignedBigIntSchema,
      totalSupply: unsignedBigIntSchema,
    })
    .parse(await read(client, blockNumber, gumBallLens, gumBallLensAbi, 'supplyView'));
  const result = supplyViewSchema.parse({ blockNumber, ...supply });
  await revalidateBlockSnapshot(client, snapshot);
  return result;
}

const miningEpochSchema = z.object({
  actualEmission: unsignedBigIntSchema,
  clearingPrice: unsignedBigIntSchema,
  endTime: unsignedBigIntSchema,
  extensionUsed: unsignedBigIntSchema,
  invalidated: z.boolean(),
  minimumMiningPrice: unsignedBigIntSchema,
  scheduledEmission: unsignedBigIntSchema,
  settled: z.boolean(),
  settledAt: unsignedBigIntSchema,
  startTime: unsignedBigIntSchema,
  totalContributed: unsignedBigIntSchema,
});

export const miningEpochViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  beneficiaryContribution: unsignedBigIntSchema,
  beneficiaryPreviewClaim: unsignedBigIntSchema,
  contributionsPaused: z.boolean(),
  currentEpochId: unsignedBigIntSchema,
  epoch: miningEpochSchema,
  epochId: unsignedBigIntSchema,
  referenceMiningPriceWad: unsignedBigIntSchema,
  usdGDecimals: tokenDecimalsSchema,
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
  const user = addressSchema.parse(beneficiary);
  const snapshot = await snapshotBlock(client, options);
  const { blockNumber } = snapshot;
  const [epoch, currentEpochId, referenceMiningPriceWad, contributionsPaused, usdGDecimals, contribution, claim] =
    await Promise.all([
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'getEpoch', [epochId]),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'currentEpochId'),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'referenceMiningPrice'),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'contributionsPaused'),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'USDG_DECIMALS'),
      read(client, blockNumber, contracts.miningPool, miningPoolAbi, 'contributionOf', [epochId, user]),
      read(client, blockNumber, contracts.miningClaims, miningClaimsAbi, 'previewClaim', [user, epochId]),
    ]);
  const result = miningEpochViewSchema.parse({
    beneficiaryContribution: contribution,
    beneficiaryPreviewClaim: claim,
    blockNumber,
    contributionsPaused,
    currentEpochId,
    epoch,
    epochId,
    referenceMiningPriceWad,
    usdGDecimals,
  });
  await revalidateBlockSnapshot(client, snapshot);
  return result;
}

export const genesisViewSchema = z.object({
  beneficiaryContribution: unsignedBigIntSchema,
  beneficiaryPreviewClaim: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  bootstrapContributionCap: unsignedBigIntSchema,
  communityUSDG: unsignedBigIntSchema,
  contributionEnd: unsignedBigIntSchema,
  contributionStart: unsignedBigIntSchema,
  genesisPriceWad: unsignedBigIntSchema,
  minimumBootstrapUSDG: unsignedBigIntSchema,
  requiredSponsorUSDG: unsignedBigIntSchema,
  settledAt: unsignedBigIntSchema,
  settlementDeadline: unsignedBigIntSchema,
  sponsorEscrow: unsignedBigIntSchema,
  state: z.number().int().min(0).max(5),
  usdGDecimals: tokenDecimalsSchema,
});
export type GenesisView = z.infer<typeof genesisViewSchema>;

export async function readGenesisView(
  client: PublicClient,
  contracts: Readonly<{ genesisBootstrap: Address; genesisClaims: Address }>,
  beneficiary: Address,
  options: ReadOptions = {},
): Promise<GenesisView> {
  const user = addressSchema.parse(beneficiary);
  const snapshot = await snapshotBlock(client, options);
  const { blockNumber } = snapshot;
  const names = [
    'state',
    'contributionStart',
    'contributionEnd',
    'settlementDeadline',
    'settledAt',
    'sponsorEscrow',
    'communityUSDG',
    'requiredSponsorUSDG',
    'genesisPriceWad',
    'minimumBootstrapUSDG',
    'bootstrapContributionCap',
    'USDG_DECIMALS',
  ] as const;
  const values = await Promise.all(
    names.map((name) => read(client, blockNumber, contracts.genesisBootstrap, genesisBootstrapAbi, name)),
  );
  const [beneficiaryContribution, beneficiaryPreviewClaim] = await Promise.all([
    read(client, blockNumber, contracts.genesisBootstrap, genesisBootstrapAbi, 'communityContribution', [user]),
    read(client, blockNumber, contracts.genesisClaims, genesisClaimsAbi, 'previewClaim', [user]),
  ]);
  const result = genesisViewSchema.parse({
    beneficiaryContribution,
    beneficiaryPreviewClaim,
    blockNumber,
    bootstrapContributionCap: values[10],
    communityUSDG: values[6],
    contributionEnd: values[2],
    contributionStart: values[1],
    genesisPriceWad: values[8],
    minimumBootstrapUSDG: values[9],
    requiredSponsorUSDG: values[7],
    settledAt: values[4],
    settlementDeadline: values[3],
    sponsorEscrow: values[5],
    state: values[0],
    usdGDecimals: values[11],
  });
  await revalidateBlockSnapshot(client, snapshot);
  return result;
}

const userSignalSchema = z.object({
  activeWeight: unsignedBigIntSchema,
  pendingIncrease: unsignedBigIntSchema,
  strategy: addressSchema,
});
export const pendingActivationViewSchema = z.object({
  activationTime: unsignedBigIntSchema,
  activationsPaused: z.boolean(),
  blockNumber: unsignedBigIntSchema,
  isMature: z.boolean(),
  signals: z.array(userSignalSchema).max(16),
  stakedBalance: unsignedBigIntSchema,
  user: addressSchema,
});
export type PendingActivationView = z.infer<typeof pendingActivationViewSchema>;

export async function readPendingActivationView(
  client: PublicClient,
  gumBallLens: Address,
  user: Address,
  atTimestamp: bigint,
  options: ReadOptions = {},
): Promise<PendingActivationView> {
  unsignedBigIntSchema.parse(atTimestamp);
  const normalizedUser = addressSchema.parse(user);
  const snapshot = await snapshotBlock(client, options);
  const { blockNumber } = snapshot;
  const raw = z
    .tuple([unsignedBigIntSchema, unsignedBigIntSchema, z.boolean(), z.array(userSignalSchema).max(16)])
    .parse(await read(client, blockNumber, gumBallLens, gumBallLensAbi, 'userSignalViews', [normalizedUser]));
  const [stakedBalance, activationTime, activationsPaused, signals] = raw;
  const result = pendingActivationViewSchema.parse({
    activationTime,
    activationsPaused,
    blockNumber,
    isMature: activationTime !== 0n && atTimestamp >= activationTime,
    signals,
    stakedBalance,
    user: normalizedUser,
  });
  await revalidateBlockSnapshot(client, snapshot);
  return result;
}

export const managerRewardViewSchema = z.object({
  accountedRewards: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  currentGeneration: unsignedBigIntSchema,
  currentRemainderCycle: unsignedBigIntSchema,
  earnedRaw: unsignedBigIntSchema,
  receiver: addressSchema,
  rewardPerWeightStored: unsignedBigIntSchema,
  rewardRemainder: unsignedBigIntSchema,
  rewardToken: addressSchema,
  rewardTokenDecimals: tokenDecimalsSchema,
  strategy: addressSchema,
  totalAccruedRewards: unsignedBigIntSchema,
  totalPendingTerminalDust: unsignedBigIntSchema,
  user: addressSchema,
});
export type ManagerRewardView = z.infer<typeof managerRewardViewSchema>;

export async function readManagerRewardView(
  client: PublicClient,
  managerRewards: Address,
  user: Address,
  options: ReadOptions = {},
): Promise<ManagerRewardView> {
  const normalizedUser = addressSchema.parse(user);
  const snapshot = await snapshotBlock(client, options);
  const { blockNumber } = snapshot;
  const [
    earnedRaw,
    receiver,
    rewardToken,
    strategy,
    rewardPerWeightStored,
    rewardRemainder,
    accountedRewards,
    totalAccruedRewards,
    totalPendingTerminalDust,
    currentGeneration,
    currentRemainderCycle,
  ] = await Promise.all([
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'earned', [normalizedUser]),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'rewardReceiver', [normalizedUser]),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'REWARD_TOKEN'),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'STRATEGY'),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'rewardPerWeightStored'),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'rewardRemainder'),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'accountedRewards'),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'totalAccruedRewards'),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'totalPendingTerminalDust'),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'currentGeneration'),
    read(client, blockNumber, managerRewards, managerRewardsAbi, 'currentRemainderCycle'),
  ]);
  const normalizedRewardToken = addressSchema.parse(rewardToken);
  const rewardTokenDecimals = await read(client, blockNumber, normalizedRewardToken, gbxAbi, 'decimals');
  const result = managerRewardViewSchema.parse({
    accountedRewards,
    blockNumber,
    currentGeneration,
    currentRemainderCycle,
    earnedRaw,
    receiver,
    rewardPerWeightStored,
    rewardRemainder,
    rewardToken: normalizedRewardToken,
    rewardTokenDecimals,
    strategy,
    totalAccruedRewards,
    totalPendingTerminalDust,
    user: normalizedUser,
  });
  await revalidateBlockSnapshot(client, snapshot);
  return result;
}

export const registryAssetSchema = z.object({
  acquisitionEnabled: z.boolean(),
  assetId: bytes32Schema,
  decimals: tokenDecimalsSchema,
  isStockToken: z.boolean(),
  redemptionEnabled: z.boolean(),
  rewards: addressSchema,
  strategy: addressSchema,
  symbolHash: bytes32Schema,
  token: addressSchema,
});
export type RegistryAsset = z.infer<typeof registryAssetSchema>;

export async function resolveAssetRegistry(
  client: PublicClient,
  assetRegistry: Address,
  options: ReadOptions = {},
): Promise<readonly RegistryAsset[]> {
  const snapshot = await snapshotBlock(client, options);
  const { blockNumber } = snapshot;
  const count = unsignedBigIntSchema.parse(
    await read(client, blockNumber, assetRegistry, assetRegistryAbi, 'assetCount'),
  );
  if (count > 16n) throw new RangeError(`registry asset count ${count} exceeds protocol maximum`);
  const tokens = await Promise.all(
    Array.from({ length: Number(count) }, (_, index) =>
      read(client, blockNumber, assetRegistry, assetRegistryAbi, 'assetAt', [BigInt(index)]),
    ),
  );
  const configs = await Promise.all(
    tokens.map((token) =>
      read(client, blockNumber, assetRegistry, assetRegistryAbi, 'configFor', [addressSchema.parse(token)]),
    ),
  );
  const result = configs.map((config, index) => {
    const parsed = registryAssetSchema.parse(config);
    if (parsed.token.toLowerCase() !== addressSchema.parse(tokens[index]).toLowerCase()) {
      throw new TypeError(`registry config token mismatch at index ${index}`);
    }
    return parsed;
  });
  await revalidateBlockSnapshot(client, snapshot);
  return result;
}

export const auctionQuoteSchema = z.object({
  auctionDuration: unsignedBigIntSchema.positive(),
  auctionExpiresAt: unsignedBigIntSchema,
  auctionId: unsignedBigIntSchema,
  auctionStartTime: unsignedBigIntSchema,
  availableBudgetRaw: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  blockTimestamp: unsignedBigIntSchema,
  currentRateWad: unsignedBigIntSchema.positive(),
  fillsPaused: z.boolean(),
  floorRateWad: unsignedBigIntSchema.positive(),
  isExpired: z.boolean(),
  isLiveStrategy: z.boolean(),
  kind: z.enum(['acquisition', 'buyback']),
  maximumLotUSDGRaw: unsignedBigIntSchema.positive(),
  minimumLotUSDGRaw: unsignedBigIntSchema.positive(),
  referenceRateWad: unsignedBigIntSchema.positive(),
  requiredTargetRaw: unsignedBigIntSchema,
  startRateWad: unsignedBigIntSchema.positive(),
  strategy: addressSchema,
  targetDecimals: tokenDecimalsSchema,
  usdGAmountRaw: unsignedBigIntSchema,
  usdGDecimals: tokenDecimalsSchema,
});
export type AuctionQuote = z.infer<typeof auctionQuoteSchema>;

export async function readStrategyAuctionQuote(
  client: PublicClient,
  parameters: Readonly<{
    kind: 'acquisition' | 'buyback';
    strategy: Address;
    usdGAmountRaw: bigint;
  }>,
  options: ReadOptions = {},
): Promise<AuctionQuote> {
  z.object({
    kind: z.enum(['acquisition', 'buyback']),
    strategy: addressSchema,
    usdGAmountRaw: unsignedBigIntSchema.positive(),
  }).parse(parameters);
  if (parameters.usdGAmountRaw >= 1n << 256n) throw new RangeError('usdGAmountRaw must fit uint256');
  const snapshot = await snapshotBlock(client, options);
  const { blockNumber } = snapshot;
  if (snapshot.blockTimestamp === undefined) {
    throw new TypeError('RPC omitted the pinned auction block timestamp');
  }
  const abi = parameters.kind === 'acquisition' ? acquisitionStrategyAbi : buybackStrategyAbi;
  const strategy = addressSchema.parse(parameters.strategy);
  const [
    auctionDuration,
    auctionId,
    auctionStartTime,
    currentRateWad,
    referenceRateWad,
    startRateWad,
    floorRateWad,
    minimumLotUSDGRaw,
    maximumLotUSDGRaw,
    fillsPaused,
    allocationVoter,
    assetRegistry,
    usdGDecimals,
    targetDecimals,
  ] = await Promise.all([
    read(client, blockNumber, strategy, abi, 'AUCTION_DURATION'),
    read(client, blockNumber, strategy, abi, 'auctionId'),
    read(client, blockNumber, strategy, abi, 'auctionStartTime'),
    read(client, blockNumber, strategy, abi, 'currentRate'),
    read(client, blockNumber, strategy, abi, 'referenceRate'),
    read(client, blockNumber, strategy, abi, 'startRate'),
    read(client, blockNumber, strategy, abi, 'floorRate'),
    read(client, blockNumber, strategy, abi, 'MINIMUM_LOT_USDG'),
    read(client, blockNumber, strategy, abi, 'MAXIMUM_LOT_USDG'),
    read(client, blockNumber, strategy, abi, 'fillsPaused'),
    read(client, blockNumber, strategy, abi, 'ALLOCATION_VOTER'),
    read(client, blockNumber, strategy, abi, 'ASSET_REGISTRY'),
    read(client, blockNumber, strategy, abi, 'USDG_DECIMALS'),
    read(client, blockNumber, strategy, abi, parameters.kind === 'acquisition' ? 'TARGET_DECIMALS' : 'GBX_DECIMALS'),
  ]);
  const normalizedVoter = addressSchema.parse(allocationVoter);
  const normalizedRegistry = addressSchema.parse(assetRegistry);
  const [availableBudgetRaw, isLiveStrategy] = await Promise.all([
    read(client, blockNumber, normalizedVoter, allocationVoterAbi, 'previewStrategyBudget', [strategy]),
    read(client, blockNumber, normalizedRegistry, assetRegistryAbi, 'isLiveStrategy', [strategy]),
  ]);
  const rate = unsignedBigIntSchema.parse(currentRateWad);
  const parsedAuctionDuration = unsignedBigIntSchema.positive().parse(auctionDuration);
  const parsedAuctionStartTime = unsignedBigIntSchema.parse(auctionStartTime);
  const auctionExpiresAt = parsedAuctionStartTime + parsedAuctionDuration;
  const blockTimestamp = unsignedBigIntSchema.parse(snapshot.blockTimestamp);
  if (parsedAuctionStartTime > blockTimestamp) {
    throw new TypeError('auction start time is later than the pinned block timestamp');
  }
  const result = auctionQuoteSchema.parse({
    auctionDuration: parsedAuctionDuration,
    auctionExpiresAt,
    auctionId,
    auctionStartTime: parsedAuctionStartTime,
    availableBudgetRaw,
    blockNumber,
    blockTimestamp,
    currentRateWad: rate,
    fillsPaused,
    floorRateWad,
    isExpired: blockTimestamp >= auctionExpiresAt,
    isLiveStrategy,
    kind: parameters.kind,
    maximumLotUSDGRaw,
    minimumLotUSDGRaw,
    referenceRateWad,
    requiredTargetRaw: quoteAuctionTargetAmount(
      parameters.usdGAmountRaw,
      rate,
      tokenDecimalsSchema.parse(usdGDecimals),
      tokenDecimalsSchema.parse(targetDecimals),
    ),
    startRateWad,
    strategy,
    targetDecimals,
    usdGAmountRaw: parameters.usdGAmountRaw,
    usdGDecimals,
  });
  await revalidateBlockSnapshot(client, snapshot);
  return result;
}

export const redemptionPreviewSchema = z.object({
  amountsOutRaw: z.array(unsignedBigIntSchema).max(16),
  blockNumber: unsignedBigIntSchema,
  shares: unsignedBigIntSchema.positive(),
  tokens: z.array(addressSchema).max(16),
});
export type RedemptionPreview = z.infer<typeof redemptionPreviewSchema>;

export async function readRedemptionPreview(
  client: PublicClient,
  gumBallLens: Address,
  shares: bigint,
  options: ReadOptions = {},
): Promise<RedemptionPreview> {
  unsignedBigIntSchema.positive().parse(shares);
  const snapshot = await snapshotBlock(client, options);
  const { blockNumber } = snapshot;
  const raw = z
    .tuple([z.array(addressSchema).max(16), z.array(unsignedBigIntSchema).max(16)])
    .parse(await read(client, blockNumber, gumBallLens, gumBallLensAbi, 'previewRedemption', [shares]));
  if (raw[0].length !== raw[1].length) throw new TypeError('redemption preview token/amount length mismatch');
  const result = redemptionPreviewSchema.parse({ amountsOutRaw: raw[1], blockNumber, shares, tokens: raw[0] });
  await revalidateBlockSnapshot(client, snapshot);
  return result;
}
