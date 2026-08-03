import { createHash } from 'node:crypto';

import {
  auctionRateAt,
  currentTotalSupply,
  earnedManagerReward,
  estimateGenesisClaim,
  netSupplyChange,
  previewRedemption,
  projectTotalSupply,
  quoteAuctionTargetAmount,
  quoteGenesis,
  quoteMiningEpoch,
  redemptionPercentageWad,
  simulateFullyFundedEmissions,
  splitAcquiredAsset,
  updateRewardAccumulator,
} from '@gumball-6900/sdk';

const WAD = 10n ** 18n;
const INITIAL_DAILY_SCHEDULED_EMISSION = 427_181_096_645_855_643_000_000n;
const DAILY_DECAY_WAD = 999_525_354_337_060_160n;
const DAILY_DIFFERENTIAL_DAYS = 36_500;

function uint256Bytes(value: bigint): Buffer {
  return Buffer.from(value.toString(16).padStart(64, '0'), 'hex');
}

function emissionDailyDigest(days: number): string {
  let digest: Buffer = Buffer.alloc(32);
  let emission = INITIAL_DAILY_SCHEDULED_EMISSION;
  for (let day = 0; day <= days; day += 1) {
    digest = createHash('sha256')
      .update(Buffer.concat([digest, uint256Bytes(emission)]))
      .digest();
    emission = (emission * DAILY_DECAY_WAD) / WAD;
  }
  return `0x${digest.toString('hex')}`;
}

interface MiningCase {
  id: string;
  scheduledEmission: string;
  cumulativeMinted: string;
  totalUSDGRaw: string;
  referenceMiningPrice: string;
}

interface GenesisCase {
  id: string;
  communityUSDGRaw: string;
  participantUSDGRaw: string;
}

interface AuctionCase {
  id: string;
  referenceRate: string;
  elapsedSeconds: string;
  usdGLotRaw: string;
  actualTargetReceived: string;
  hasLiveManagerWeight: boolean;
}

interface RewardCase {
  id: string;
  rewardAmount: string;
  totalActiveWeight: string;
  priorRemainder: string;
  precision: string;
  userActiveWeight: string;
  userRewardPerWeightPaid: string;
  userAccrued: string;
}

interface RedemptionCase {
  id: string;
  shares: string;
  supplyBefore: string;
  assets: Array<{ asset: string; balance: string }>;
}

interface SupplyCase {
  id: string;
  cumulativeMinted: string;
  cumulativeBurned: string;
  newEmission: string;
  gbxBurned: string;
}

export interface ReferenceScenarios {
  schemaVersion: string;
  usdGDecimals: string;
  targetDecimals: string;
  emissionHorizonsDays: string[];
  miningCases: MiningCase[];
  genesisCases: GenesisCase[];
  auctionCases: AuctionCase[];
  rewardCases: RewardCase[];
  redemptionCases: RedemptionCase[];
  supplyCases: SupplyCase[];
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    throw new TypeError(`${label} must be a decimal integer string`);
  }
  return value;
}

function asIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
  return value;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return value;
}

function parseObjects<T>(
  root: Record<string, unknown>,
  key: string,
  parser: (record: Record<string, unknown>, label: string) => T,
): T[] {
  return asArray(root[key], key).map((value, index) => parser(asRecord(value, `${key}[${index}]`), `${key}[${index}]`));
}

export function parseReferenceScenarios(value: unknown): ReferenceScenarios {
  const root = asRecord(value, 'scenarios');

  const miningCases = parseObjects(root, 'miningCases', (record, label) => ({
    id: asIdentifier(record.id, `${label}.id`),
    scheduledEmission: asString(record.scheduledEmission, `${label}.scheduledEmission`),
    cumulativeMinted: asString(record.cumulativeMinted, `${label}.cumulativeMinted`),
    totalUSDGRaw: asString(record.totalUSDGRaw, `${label}.totalUSDGRaw`),
    referenceMiningPrice: asString(record.referenceMiningPrice, `${label}.referenceMiningPrice`),
  }));

  const genesisCases = parseObjects(root, 'genesisCases', (record, label) => ({
    id: asIdentifier(record.id, `${label}.id`),
    communityUSDGRaw: asString(record.communityUSDGRaw, `${label}.communityUSDGRaw`),
    participantUSDGRaw: asString(record.participantUSDGRaw, `${label}.participantUSDGRaw`),
  }));

  const auctionCases = parseObjects(root, 'auctionCases', (record, label) => ({
    id: asIdentifier(record.id, `${label}.id`),
    referenceRate: asString(record.referenceRate, `${label}.referenceRate`),
    elapsedSeconds: asString(record.elapsedSeconds, `${label}.elapsedSeconds`),
    usdGLotRaw: asString(record.usdGLotRaw, `${label}.usdGLotRaw`),
    actualTargetReceived: asString(record.actualTargetReceived, `${label}.actualTargetReceived`),
    hasLiveManagerWeight: asBoolean(record.hasLiveManagerWeight, `${label}.hasLiveManagerWeight`),
  }));

  const rewardCases = parseObjects(root, 'rewardCases', (record, label) => ({
    id: asIdentifier(record.id, `${label}.id`),
    rewardAmount: asString(record.rewardAmount, `${label}.rewardAmount`),
    totalActiveWeight: asString(record.totalActiveWeight, `${label}.totalActiveWeight`),
    priorRemainder: asString(record.priorRemainder, `${label}.priorRemainder`),
    precision: asString(record.precision, `${label}.precision`),
    userActiveWeight: asString(record.userActiveWeight, `${label}.userActiveWeight`),
    userRewardPerWeightPaid: asString(record.userRewardPerWeightPaid, `${label}.userRewardPerWeightPaid`),
    userAccrued: asString(record.userAccrued, `${label}.userAccrued`),
  }));

  const redemptionCases = parseObjects(root, 'redemptionCases', (record, label) => ({
    id: asIdentifier(record.id, `${label}.id`),
    shares: asString(record.shares, `${label}.shares`),
    supplyBefore: asString(record.supplyBefore, `${label}.supplyBefore`),
    assets: asArray(record.assets, `${label}.assets`).map((asset, index) => {
      const parsed = asRecord(asset, `${label}.assets[${index}]`);
      return {
        asset: asIdentifier(parsed.asset, `${label}.assets[${index}].asset`),
        balance: asString(parsed.balance, `${label}.assets[${index}].balance`),
      };
    }),
  }));

  const supplyCases = parseObjects(root, 'supplyCases', (record, label) => ({
    id: asIdentifier(record.id, `${label}.id`),
    cumulativeMinted: asString(record.cumulativeMinted, `${label}.cumulativeMinted`),
    cumulativeBurned: asString(record.cumulativeBurned, `${label}.cumulativeBurned`),
    newEmission: asString(record.newEmission, `${label}.newEmission`),
    gbxBurned: asString(record.gbxBurned, `${label}.gbxBurned`),
  }));

  return {
    schemaVersion: asString(root.schemaVersion, 'schemaVersion'),
    usdGDecimals: asString(root.usdGDecimals, 'usdGDecimals'),
    targetDecimals: asString(root.targetDecimals, 'targetDecimals'),
    emissionHorizonsDays: asArray(root.emissionHorizonsDays, 'emissionHorizonsDays').map((item, index) =>
      asString(item, `emissionHorizonsDays[${index}]`),
    ),
    miningCases,
    genesisCases,
    auctionCases,
    rewardCases,
    redemptionCases,
    supplyCases,
  };
}

function safeCount(value: string, label: string): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`${label} must fit in a non-negative safe integer`);
  }
  return count;
}

export function computeReferenceResults(scenarios: ReferenceScenarios) {
  const usdGDecimals = safeCount(scenarios.usdGDecimals, 'usdGDecimals');
  const targetDecimals = safeCount(scenarios.targetDecimals, 'targetDecimals');
  return {
    schemaVersion: scenarios.schemaVersion,
    usdGDecimals: scenarios.usdGDecimals,
    targetDecimals: scenarios.targetDecimals,
    emissionDaily100YearDigest: emissionDailyDigest(DAILY_DIFFERENTIAL_DAYS),
    emissionHorizons: scenarios.emissionHorizonsDays.map((days) => {
      const result = simulateFullyFundedEmissions(safeCount(days, 'emission horizon'));
      return {
        days,
        recurringMinted: result.recurringMinted.toString(),
        totalCumulativeMinted: result.totalCumulativeMinted.toString(),
        nextScheduledEmission: result.nextScheduledEmission.toString(),
      };
    }),
    miningQuotes: scenarios.miningCases.map((scenario) => {
      const quote = quoteMiningEpoch({
        scheduledEmission: BigInt(scenario.scheduledEmission),
        cumulativeMinted: BigInt(scenario.cumulativeMinted),
        totalUSDGRaw: BigInt(scenario.totalUSDGRaw),
        usdGDecimals,
        referenceMiningPrice: BigInt(scenario.referenceMiningPrice),
      });
      return {
        id: scenario.id,
        scheduledEmission: quote.scheduledEmission.toString(),
        minimumMiningPrice: quote.minimumMiningPrice.toString(),
        affordableEmission: quote.affordableEmission.toString(),
        actualEmission: quote.actualEmission.toString(),
        clearingPrice: quote.clearingPrice.toString(),
        nextReferenceMiningPrice: quote.nextReferenceMiningPrice.toString(),
        fullyFunded: quote.fullyFunded,
      };
    }),
    genesisQuotes: scenarios.genesisCases.map((scenario) => {
      const communityUSDGRaw = BigInt(scenario.communityUSDGRaw);
      const quote = quoteGenesis(communityUSDGRaw, usdGDecimals);
      return {
        id: scenario.id,
        communityUSDGRaw: quote.communityUSDGRaw.toString(),
        requiredSponsorUSDGRaw: quote.requiredSponsorUSDGRaw.toString(),
        totalGenesisAssetsUSDGRaw: quote.totalGenesisAssetsUSDGRaw.toString(),
        totalGenesisSupplyGBXRaw: quote.totalGenesisSupplyGBXRaw.toString(),
        genesisPriceWad: quote.genesisPriceWad.toString(),
        backingPerGBXWad: quote.backingPerGBXWad.toString(),
        participantClaim: estimateGenesisClaim(BigInt(scenario.participantUSDGRaw), communityUSDGRaw).toString(),
      };
    }),
    auctionQuotes: scenarios.auctionCases.map((scenario) => {
      const rate = auctionRateAt(BigInt(scenario.referenceRate), BigInt(scenario.elapsedSeconds));
      const split = splitAcquiredAsset(BigInt(scenario.actualTargetReceived), scenario.hasLiveManagerWeight);
      return {
        id: scenario.id,
        rate: rate.toString(),
        requiredTargetAmount: quoteAuctionTargetAmount(
          BigInt(scenario.usdGLotRaw),
          rate,
          usdGDecimals,
          targetDecimals,
        ).toString(),
        vaultAmount: split.vaultAmount.toString(),
        managerAmount: split.managerAmount.toString(),
      };
    }),
    rewardQuotes: scenarios.rewardCases.map((scenario) => {
      const precision = BigInt(scenario.precision);
      const update = updateRewardAccumulator(
        BigInt(scenario.rewardAmount),
        BigInt(scenario.totalActiveWeight),
        BigInt(scenario.priorRemainder),
        precision,
      );
      return {
        id: scenario.id,
        distributableReward: update.distributableReward.toString(),
        rewardPerWeightIncrement: update.rewardPerWeightIncrement.toString(),
        representedReward: update.representedReward.toString(),
        nextRemainder: update.nextRemainder.toString(),
        userEarned: earnedManagerReward(
          BigInt(scenario.userActiveWeight),
          update.rewardPerWeightIncrement,
          BigInt(scenario.userRewardPerWeightPaid),
          BigInt(scenario.userAccrued),
          precision,
        ).toString(),
      };
    }),
    redemptionQuotes: scenarios.redemptionCases.map((scenario) => {
      const shares = BigInt(scenario.shares);
      const supplyBefore = BigInt(scenario.supplyBefore);
      return {
        id: scenario.id,
        percentageWad: redemptionPercentageWad(shares, supplyBefore).toString(),
        assets: previewRedemption(
          shares,
          supplyBefore,
          scenario.assets.map(({ asset, balance }) => ({ asset, balance: BigInt(balance) })),
        ).map(({ asset, amount }) => ({ asset, amount: amount.toString() })),
      };
    }),
    supplyProjections: scenarios.supplyCases.map((scenario) => {
      const minted = BigInt(scenario.cumulativeMinted);
      const burned = BigInt(scenario.cumulativeBurned);
      const emission = BigInt(scenario.newEmission);
      const transactionBurn = BigInt(scenario.gbxBurned);
      const currentSupply = currentTotalSupply(minted, burned);
      return {
        id: scenario.id,
        currentSupply: currentSupply.toString(),
        netSupplyChange: netSupplyChange(emission, transactionBurn).toString(),
        projectedSupply: projectTotalSupply(currentSupply, emission, transactionBurn).toString(),
      };
    }),
  };
}
