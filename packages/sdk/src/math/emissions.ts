import {
  DAILY_DECAY_WAD,
  GENESIS_TOTAL_SUPPLY,
  INITIAL_DAILY_SCHEDULED_EMISSION,
  MAX_CUMULATIVE_MINT,
  WAD,
} from './constants.js';
import { assertEpochCount, assertNonNegative, assertPositive, minBigInt, mulDiv } from './integer.js';

export interface AllNonEmptyEmissionResult {
  epochCount: number;
  recurringMinted: bigint;
  totalCumulativeMinted: bigint;
  nextScheduledEmission: bigint;
}

export interface MiningEpochQuoteInput {
  scheduledEmission: bigint;
  cumulativeMinted: bigint;
  /** Observed raw USDG receipt. Its magnitude does not scale the emission. */
  totalContributedRaw: bigint;
}

export interface MiningEpochQuote {
  scheduledEmission: bigint;
  availableEmission: bigint;
  actualEmission: bigint;
  forfeitedEmission: bigint;
  nonEmpty: boolean;
}

export function remainingMintCapacity(cumulativeMinted: bigint): bigint {
  assertNonNegative(cumulativeMinted, 'cumulativeMinted');
  return cumulativeMinted >= MAX_CUMULATIVE_MINT ? 0n : MAX_CUMULATIVE_MINT - cumulativeMinted;
}

/** Advances one epoch at a time so fixed-point rounding exactly mirrors contract state transitions. */
export function advanceScheduledEmission(currentEmission: bigint, elapsedEpochs = 1): bigint {
  assertNonNegative(currentEmission, 'currentEmission');
  assertEpochCount(elapsedEpochs, 'elapsedEpochs');

  let emission = currentEmission;
  for (let epoch = 0; epoch < elapsedEpochs && emission !== 0n; epoch += 1) {
    emission = mulDiv(emission, DAILY_DECAY_WAD, WAD);
  }
  return emission;
}

export function scheduledEmissionForEpoch(epochId: number): bigint {
  assertEpochCount(epochId, 'epochId');
  return advanceScheduledEmission(INITIAL_DAILY_SCHEDULED_EMISSION, epochId);
}

/** Canonical path in which every epoch is non-empty, including the cumulative one-billion mint ceiling. */
export function simulateAllNonEmptyEmissions(epochCount: number): AllNonEmptyEmissionResult {
  assertEpochCount(epochCount);

  let currentEmission = INITIAL_DAILY_SCHEDULED_EMISSION;
  let cumulativeMinted = GENESIS_TOTAL_SUPPLY;

  for (let epoch = 0; epoch < epochCount && currentEmission !== 0n; epoch += 1) {
    cumulativeMinted += minBigInt(currentEmission, remainingMintCapacity(cumulativeMinted));
    currentEmission = advanceScheduledEmission(currentEmission);
  }

  return {
    epochCount,
    recurringMinted: cumulativeMinted - GENESIS_TOTAL_SUPPLY,
    totalCumulativeMinted: cumulativeMinted,
    nextScheduledEmission: currentEmission,
  };
}

/**
 * Mirrors EmissionController.settleMiningEpoch: every non-empty epoch receives
 * the complete cap-bounded schedule, while an empty epoch receives zero and
 * permanently forfeits that day's schedule. Contribution size is intentionally irrelevant.
 */
export function quoteMiningEpoch(input: MiningEpochQuoteInput): MiningEpochQuote {
  assertNonNegative(input.scheduledEmission, 'scheduledEmission');
  assertNonNegative(input.cumulativeMinted, 'cumulativeMinted');
  assertNonNegative(input.totalContributedRaw, 'totalContributedRaw');

  const availableEmission = minBigInt(input.scheduledEmission, remainingMintCapacity(input.cumulativeMinted));
  const nonEmpty = input.totalContributedRaw !== 0n;
  return {
    scheduledEmission: input.scheduledEmission,
    availableEmission,
    actualEmission: nonEmpty ? availableEmission : 0n,
    forfeitedEmission: nonEmpty ? 0n : input.scheduledEmission,
    nonEmpty,
  };
}

export function estimateMiningClaim(
  beneficiaryContribution: bigint,
  totalEpochUSDG: bigint,
  actualEmission: bigint,
): bigint {
  assertNonNegative(beneficiaryContribution, 'beneficiaryContribution');
  assertPositive(totalEpochUSDG, 'totalEpochUSDG');
  assertNonNegative(actualEmission, 'actualEmission');
  if (beneficiaryContribution > totalEpochUSDG) {
    throw new RangeError('beneficiaryContribution must not exceed totalEpochUSDG');
  }
  return mulDiv(beneficiaryContribution, actualEmission, totalEpochUSDG);
}
