import { getAddress, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { z } from 'zod';

import {
  bribeAbi,
  bribeRouterAbi,
  gbxAbi,
  liquidityPositionAbi,
  mineAbi,
  protocolGovernorAbi,
  signalGbxAbi,
  strategyAbi,
  resonanceAbi,
  timelockControllerAbi,
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
  genesisLiquidityAllocation: unsignedBigIntSchema,
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
  const [genesisLiquidityAllocation, lifetimeBurned, lifetimeMinted, minter, minterLocked, totalSupply] =
    await Promise.all([
      read(client, blockNumber, gbx, gbxAbi, 'GENESIS_LIQUIDITY_ALLOCATION'),
      read(client, blockNumber, gbx, gbxAbi, 'lifetimeBurned'),
      read(client, blockNumber, gbx, gbxAbi, 'lifetimeMinted'),
      read(client, blockNumber, gbx, gbxAbi, 'minter'),
      read(client, blockNumber, gbx, gbxAbi, 'minterLocked'),
      read(client, blockNumber, gbx, gbxAbi, 'totalSupply'),
    ]);
  const result = supplyViewSchema.parse({
    blockNumber,
    genesisLiquidityAllocation,
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
  auctionStartedAt: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  capacity: unsignedBigIntSchema,
  claimablePayment: unsignedBigIntSchema,
  currentPrice: unsignedBigIntSchema,
  effectiveTotalSupply: unsignedBigIntSchema,
  epochId: unsignedBigIntSchema,
  index: unsignedBigIntSchema,
  initialPrice: unsignedBigIntSchema,
  lastAccruedAt: unsignedBigIntSchema,
  mine: addressSchema,
  nextGlobalUps: unsignedBigIntSchema,
  pendingEmission: unsignedBigIntSchema,
  slotMiner: addressSchema,
  totalClaimable: unsignedBigIntSchema,
  totalMined: unsignedBigIntSchema,
  ups: unsignedBigIntSchema,
});
export type MineSlotView = z.infer<typeof mineSlotViewSchema>;

/** Reads one slot's tenure-locked rate, auction state, pending GBX, and account USDG claim at one block. */
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
  const [
    capacity,
    claimablePayment,
    currentPrice,
    effectiveTotalSupply,
    slot,
    nextGlobalUps,
    pendingEmission,
    totalClaimable,
    totalMined,
  ] = await Promise.all([
    read(client, blockNumber, mine, mineAbi, 'capacity'),
    read(client, blockNumber, mine, mineAbi, 'claimable', [claimant]),
    read(client, blockNumber, mine, mineAbi, 'price', [index]),
    read(client, blockNumber, mine, mineAbi, 'effectiveTotalSupply'),
    read(client, blockNumber, mine, mineAbi, 'getSlot', [index]),
    read(client, blockNumber, mine, mineAbi, 'nextGlobalUps'),
    read(client, blockNumber, mine, mineAbi, 'pendingEmission', [index]),
    read(client, blockNumber, mine, mineAbi, 'totalClaimable'),
    read(client, blockNumber, mine, mineAbi, 'totalMined'),
  ]);
  const slotRecord = slot as Readonly<Record<string, unknown>>;
  const values = Array.isArray(slot)
    ? slot
    : [
        slotRecord.epochId,
        slotRecord.initialPrice,
        slotRecord.auctionStartedAt,
        slotRecord.lastAccruedAt,
        slotRecord.ups,
        slotRecord.miner,
      ];
  const result = mineSlotViewSchema.parse({
    auctionStartedAt: values[2],
    blockNumber,
    capacity,
    claimablePayment,
    currentPrice,
    effectiveTotalSupply,
    epochId: values[0],
    index,
    initialPrice: values[1],
    lastAccruedAt: values[3],
    mine,
    nextGlobalUps,
    pendingEmission,
    slotMiner: values[5],
    totalClaimable,
    totalMined,
    ups: values[4],
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

export const protocolGovernorViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  mine: addressSchema,
  name: z.string().min(1),
  proposalThreshold: unsignedBigIntSchema,
  quorumDenominator: unsignedBigIntSchema.positive(),
  quorumNumerator: unsignedBigIntSchema.positive(),
  resonance: addressSchema,
  signalGBX: addressSchema,
  timelock: addressSchema,
  timelockMinDelay: unsignedBigIntSchema,
  votingDelay: unsignedBigIntSchema,
  votingPeriod: unsignedBigIntSchema.positive(),
});
export type ProtocolGovernorView = z.infer<typeof protocolGovernorViewSchema>;

/** Reads ProtocolGovernor's immutable targets, voting parameters, vote token, and Timelock delay. */
export async function readProtocolGovernorView(
  client: PublicClient,
  protocolGovernor: Address,
  options: ReadOptions = {},
): Promise<ProtocolGovernorView> {
  const governor = getAddress(protocolGovernor);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [
    mine,
    name,
    proposalThreshold,
    quorumDenominator,
    quorumNumerator,
    resonance,
    signalGBX,
    timelockRaw,
    votingDelay,
    votingPeriod,
  ] = await Promise.all([
    read(client, blockNumber, governor, protocolGovernorAbi, 'mine'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'name'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'proposalThreshold'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'quorumDenominator'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'quorumNumerator'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'resonance'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'token'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'timelock'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'votingDelay'),
    read(client, blockNumber, governor, protocolGovernorAbi, 'votingPeriod'),
  ]);
  const timelock = addressSchema.parse(timelockRaw);
  const timelockMinDelay = await read(client, blockNumber, timelock, timelockControllerAbi, 'getMinDelay');
  const result = protocolGovernorViewSchema.parse({
    blockNumber,
    mine,
    name,
    proposalThreshold,
    quorumDenominator,
    quorumNumerator,
    resonance,
    signalGBX,
    timelock,
    timelockMinDelay,
    votingDelay,
    votingPeriod,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const protocolProposalStateSchema = z.number().int().min(0).max(7);
export type ProtocolProposalState = z.infer<typeof protocolProposalStateSchema>;

export interface ProtocolProposalReadOptions extends ReadOptions {
  /** Optional voter whose participation status should be included. */
  readonly voter?: Address;
}

export const protocolProposalViewSchema = z.object({
  abstainVotes: unsignedBigIntSchema,
  againstVotes: unsignedBigIntSchema,
  blockNumber: unsignedBigIntSchema,
  clock: unsignedBigIntSchema,
  deadline: unsignedBigIntSchema,
  eta: unsignedBigIntSchema,
  forVotes: unsignedBigIntSchema,
  hasVoted: z.boolean().nullable(),
  needsQueuing: z.boolean(),
  proposalId: unsignedBigIntSchema,
  proposer: addressSchema,
  quorum: unsignedBigIntSchema.nullable(),
  snapshot: unsignedBigIntSchema,
  state: protocolProposalStateSchema,
});
export type ProtocolProposalView = z.infer<typeof protocolProposalViewSchema>;

/** Reads proposal lifecycle, vote totals, snapshot quorum, and optional account participation at one block. */
export async function readProtocolProposalView(
  client: PublicClient,
  protocolGovernor: Address,
  proposalId: bigint,
  options: ProtocolProposalReadOptions = {},
): Promise<ProtocolProposalView> {
  unsignedBigIntSchema.parse(proposalId);
  const governor = getAddress(protocolGovernor);
  const voter = options.voter === undefined ? undefined : getAddress(options.voter);
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [clockRaw, deadline, eta, hasVoted, needsQueuing, proposer, snapshotTimepoint, state, proposalVotes] =
    await Promise.all([
      read(client, blockNumber, governor, protocolGovernorAbi, 'clock'),
      read(client, blockNumber, governor, protocolGovernorAbi, 'proposalDeadline', [proposalId]),
      read(client, blockNumber, governor, protocolGovernorAbi, 'proposalEta', [proposalId]),
      voter === undefined
        ? Promise.resolve(null)
        : read(client, blockNumber, governor, protocolGovernorAbi, 'hasVoted', [proposalId, voter]),
      read(client, blockNumber, governor, protocolGovernorAbi, 'proposalNeedsQueuing', [proposalId]),
      read(client, blockNumber, governor, protocolGovernorAbi, 'proposalProposer', [proposalId]),
      read(client, blockNumber, governor, protocolGovernorAbi, 'proposalSnapshot', [proposalId]),
      read(client, blockNumber, governor, protocolGovernorAbi, 'state', [proposalId]),
      read(client, blockNumber, governor, protocolGovernorAbi, 'proposalVotes', [proposalId]),
    ]);
  const clock = typeof clockRaw === 'bigint' ? clockRaw : BigInt(clockRaw as number);
  const snapshotValue = unsignedBigIntSchema.parse(snapshotTimepoint);
  const quorum =
    snapshotValue < clock
      ? await read(client, blockNumber, governor, protocolGovernorAbi, 'quorum', [snapshotValue])
      : null;
  const proposalVotesRecord = proposalVotes as Readonly<Record<string, unknown>>;
  const proposalVoteValues = Array.isArray(proposalVotes)
    ? proposalVotes
    : [proposalVotesRecord.againstVotes, proposalVotesRecord.forVotes, proposalVotesRecord.abstainVotes];
  const result = protocolProposalViewSchema.parse({
    abstainVotes: proposalVoteValues[2],
    againstVotes: proposalVoteValues[0],
    blockNumber,
    clock,
    deadline,
    eta,
    forVotes: proposalVoteValues[1],
    hasVoted,
    needsQueuing,
    proposalId,
    proposer,
    quorum,
    snapshot: snapshotValue,
    state,
  });
  await revalidateBlockSnapshot(client, pinned);
  return result;
}

export const resonanceViewSchema = z.object({
  blockNumber: unsignedBigIntSchema,
  duration: unsignedBigIntSchema,
  lastUpdateTime: unsignedBigIntSchema,
  left: unsignedBigIntSchema,
  periodFinish: unsignedBigIntSchema,
  remainderFinish: unsignedBigIntSchema,
  resonanceRouter: addressSchema,
  rewardPerTokenStored: unsignedBigIntSchema,
  rewardPrecision: unsignedBigIntSchema,
  rewardRate: unsignedBigIntSchema,
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
  const [duration, resonanceRouter, rewardPrecision, totalSignalWeight, usdgRaw] = await Promise.all([
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'DURATION'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'resonanceRouter'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'REWARD_PRECISION'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'totalSignalWeight'),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'usdg'),
  ]);
  const usdg = addressSchema.parse(usdgRaw);
  const [rewardData, rewardLeft, usdgBalance] = await Promise.all([
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'token_RewardData', [usdg]),
    read(client, blockNumber, normalizedResonance, resonanceAbi, 'left', [usdg]),
    read(client, blockNumber, usdg, gbxAbi, 'balanceOf', [normalizedResonance]),
  ]);
  const rewardDataRecord = rewardData as Readonly<Record<string, unknown>>;
  const rewardDataValues = Array.isArray(rewardData)
    ? rewardData
    : [
        rewardDataRecord.periodFinish,
        rewardDataRecord.remainderFinish,
        rewardDataRecord.rewardRate,
        rewardDataRecord.lastUpdateTime,
        rewardDataRecord.rewardPerTokenStored,
      ];
  const result = resonanceViewSchema.parse({
    blockNumber,
    duration,
    lastUpdateTime: rewardDataValues[3],
    left: rewardLeft,
    periodFinish: rewardDataValues[0],
    remainderFinish: rewardDataValues[1],
    resonanceRouter,
    rewardPerTokenStored: rewardDataValues[4],
    rewardPrecision,
    rewardRate: rewardDataValues[2],
    totalSignalWeight,
    usdg,
    usdgBalance,
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
  basisPoints: unsignedBigIntSchema.positive(),
  blockNumber: unsignedBigIntSchema,
  bribe: addressSchema,
  bribeBasisPoints: unsignedBigIntSchema,
  bribePaymentLiability: unsignedBigIntSchema,
  fund: addressSchema,
  fundBasisPoints: unsignedBigIntSchema,
  fundPaymentLiability: unsignedBigIntSchema,
  paymentToken: addressSchema,
  paymentSurplus: unsignedBigIntSchema,
  splitRemainder: unsignedBigIntSchema,
  strategy: addressSchema,
});
export type BribeRouterView = z.infer<typeof bribeRouterViewSchema>;

/** Reads a Strategy router's immutable 90/10 terms, liabilities, split carry, and direct-donation surplus. */
export async function readBribeRouterView(
  client: PublicClient,
  bribeRouter: Address,
  options: ReadOptions = {},
): Promise<BribeRouterView> {
  const pinned = await snapshot(client, options);
  const { blockNumber } = pinned;
  const [
    accountedPaymentBalance,
    basisPoints,
    bribe,
    bribeBasisPoints,
    bribePaymentLiability,
    fund,
    fundBasisPoints,
    fundPaymentLiability,
    paymentToken,
    paymentSurplus,
    splitRemainder,
    strategy,
  ] = await Promise.all([
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'accountedPaymentBalance'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'BPS'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'bribe'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'BRIBE_BPS'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'bribePaymentLiability'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'fund'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'FUND_BPS'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'fundPaymentLiability'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'paymentToken'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'paymentSurplus'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'splitRemainder'),
    read(client, blockNumber, bribeRouter, bribeRouterAbi, 'strategy'),
  ]);
  const result = bribeRouterViewSchema.parse({
    accountedPaymentBalance,
    basisPoints,
    blockNumber,
    bribe,
    bribeBasisPoints,
    bribePaymentLiability,
    fund,
    fundBasisPoints,
    fundPaymentLiability,
    paymentToken,
    paymentSurplus,
    splitRemainder,
    strategy,
  });
  if (result.fundBasisPoints + result.bribeBasisPoints !== result.basisPoints) {
    throw new RangeError('BribeRouter basis-point split is incoherent');
  }
  if (result.fundPaymentLiability + result.bribePaymentLiability !== result.accountedPaymentBalance) {
    throw new RangeError('BribeRouter liabilities do not reconcile to its accounted balance');
  }
  if (result.splitRemainder >= result.basisPoints) {
    throw new RangeError('BribeRouter split remainder exceeds its fixed denominator');
  }
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
