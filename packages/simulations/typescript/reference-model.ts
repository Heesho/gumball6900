import { createHash } from 'node:crypto';

import {
  DAILY_DECAY_WAD,
  GENESIS_TOTAL_SUPPLY,
  INITIAL_DAILY_SCHEDULED_EMISSION,
  FUNDRAISER_DISTRIBUTION_ALLOCATION,
  auctionPriceAt,
  currentTotalSupply,
  earnedStrategyReward,
  netSupplyChange,
  previewRedemption,
  projectTotalSupply,
  nextAuctionInitPrice,
  quoteFundraiserEpoch,
  redemptionPercentageWad,
  simulateAllNonEmptyEmissions,
  settleStrategyPayment,
  updateRewardIndex,
} from '@gumball-6900/sdk';

const WAD = 10n ** 18n;
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

function emissionScheduleLifetime() {
  let emission = INITIAL_DAILY_SCHEDULED_EMISSION;
  let scheduledTotal = 0n;
  let positiveEpochs = 0;
  while (emission !== 0n) {
    scheduledTotal += emission;
    emission = (emission * DAILY_DECAY_WAD) / WAD;
    positiveEpochs += 1;
  }
  return {
    positiveEpochs: positiveEpochs.toString(),
    sequentialScheduledTotal: scheduledTotal.toString(),
    nominalAllocationResidual: (FUNDRAISER_DISTRIBUTION_ALLOCATION - scheduledTotal).toString(),
  };
}

interface MiningCase {
  id: string;
  scheduledEmission: string;
  cumulativeMinted: string;
  totalContributedRaw: string;
}

interface AuctionCase {
  id: string;
  initPrice: string;
  elapsedSeconds: string;
  epochPeriod: string;
  priceMultiplier: string;
  minInitPrice: string;
  actualTargetReceived: string;
}

interface RewardCase {
  id: string;
  rewardAmount: string;
  totalActiveWeight: string;
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
    totalContributedRaw: asString(record.totalContributedRaw, `${label}.totalContributedRaw`),
  }));

  const auctionCases = parseObjects(root, 'auctionCases', (record, label) => ({
    id: asIdentifier(record.id, `${label}.id`),
    initPrice: asString(record.initPrice, `${label}.initPrice`),
    elapsedSeconds: asString(record.elapsedSeconds, `${label}.elapsedSeconds`),
    epochPeriod: asString(record.epochPeriod, `${label}.epochPeriod`),
    priceMultiplier: asString(record.priceMultiplier, `${label}.priceMultiplier`),
    minInitPrice: asString(record.minInitPrice, `${label}.minInitPrice`),
    actualTargetReceived: asString(record.actualTargetReceived, `${label}.actualTargetReceived`),
  }));

  const rewardCases = parseObjects(root, 'rewardCases', (record, label) => ({
    id: asIdentifier(record.id, `${label}.id`),
    rewardAmount: asString(record.rewardAmount, `${label}.rewardAmount`),
    totalActiveWeight: asString(record.totalActiveWeight, `${label}.totalActiveWeight`),
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
  safeCount(scenarios.usdGDecimals, 'usdGDecimals');
  safeCount(scenarios.targetDecimals, 'targetDecimals');
  return {
    schemaVersion: scenarios.schemaVersion,
    usdGDecimals: scenarios.usdGDecimals,
    targetDecimals: scenarios.targetDecimals,
    genesisSupply: GENESIS_TOTAL_SUPPLY.toString(),
    miningEmissionAllocation: FUNDRAISER_DISTRIBUTION_ALLOCATION.toString(),
    initialDailyScheduledEmission: INITIAL_DAILY_SCHEDULED_EMISSION.toString(),
    emissionDaily100YearDigest: emissionDailyDigest(DAILY_DIFFERENTIAL_DAYS),
    emissionScheduleLifetime: emissionScheduleLifetime(),
    emissionHorizons: scenarios.emissionHorizonsDays.map((days) => {
      const result = simulateAllNonEmptyEmissions(safeCount(days, 'emission horizon'));
      return {
        days,
        recurringMinted: result.recurringMinted.toString(),
        totalCumulativeMinted: result.totalCumulativeMinted.toString(),
        nextScheduledEmission: result.nextScheduledEmission.toString(),
      };
    }),
    miningQuotes: scenarios.miningCases.map((scenario) => {
      const quote = quoteFundraiserEpoch({
        scheduledEmission: BigInt(scenario.scheduledEmission),
        cumulativeMinted: BigInt(scenario.cumulativeMinted),
        totalContributedRaw: BigInt(scenario.totalContributedRaw),
      });
      return {
        id: scenario.id,
        scheduledEmission: quote.scheduledEmission.toString(),
        availableEmission: quote.availableEmission.toString(),
        actualEmission: quote.actualEmission.toString(),
        forfeitedEmission: quote.forfeitedEmission.toString(),
        nonEmpty: quote.nonEmpty,
      };
    }),
    auctionQuotes: scenarios.auctionCases.map((scenario) => {
      const paymentAmount = auctionPriceAt(
        BigInt(scenario.initPrice),
        BigInt(scenario.elapsedSeconds),
        BigInt(scenario.epochPeriod),
      );
      const settlement = settleStrategyPayment(BigInt(scenario.actualTargetReceived));
      return {
        id: scenario.id,
        paymentAmount: paymentAmount.toString(),
        nextInitPrice: nextAuctionInitPrice(
          paymentAmount,
          BigInt(scenario.priceMultiplier),
          BigInt(scenario.minInitPrice),
        ).toString(),
        fundAmount: settlement.fundAmount.toString(),
      };
    }),
    rewardQuotes: scenarios.rewardCases.map((scenario) => {
      const precision = BigInt(scenario.precision);
      const update = updateRewardIndex(BigInt(scenario.rewardAmount), BigInt(scenario.totalActiveWeight), precision);
      return {
        id: scenario.id,
        notifiedReward: update.notifiedReward.toString(),
        rewardPerWeightIncrement: update.rewardPerWeightIncrement.toString(),
        indexedReward: update.indexedReward.toString(),
        residue: update.residue.toString(),
        userEarned: earnedStrategyReward(
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
