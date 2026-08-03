import {
  BPS_DENOMINATOR,
  DAILY_DECAY_WAD,
  GENESIS_TOTAL_SUPPLY,
  INITIAL_DAILY_SCHEDULED_EMISSION,
  MAX_CUMULATIVE_MINT,
  MINING_REFERENCE_FLOOR_BPS,
  REFERENCE_EMA_NEW_BPS,
  REFERENCE_EMA_OLD_BPS,
  REFERENCE_MAX_INCREASE_BPS,
  WAD,
} from './constants.js';
import { normalizeRawTokenAmountToWad } from './decimals.js';
import { assertEpochCount, assertNonNegative, assertPositive, clampBigInt, minBigInt, mulDiv } from './integer.js';

export interface FullyFundedEmissionResult {
  epochCount: number;
  recurringMinted: bigint;
  totalCumulativeMinted: bigint;
  nextScheduledEmission: bigint;
}

export interface MiningEpochQuoteInput {
  scheduledEmission: bigint;
  cumulativeMinted: bigint;
  /** Raw USDG units, not an 18-decimal normalized amount. */
  totalUSDGRaw: bigint;
  /** The verified decimals() value for the USDG deployment. */
  usdGDecimals: number;
  referenceMiningPrice: bigint;
}

export interface MiningEpochQuote {
  scheduledEmission: bigint;
  minimumMiningPrice: bigint;
  affordableEmission: bigint;
  actualEmission: bigint;
  clearingPrice: bigint;
  nextReferenceMiningPrice: bigint;
  fullyFunded: boolean;
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
  for (let epoch = 0; epoch < elapsedEpochs; epoch += 1) {
    emission = mulDiv(emission, DAILY_DECAY_WAD, WAD);
  }
  return emission;
}

export function scheduledEmissionForEpoch(epochId: number): bigint {
  assertEpochCount(epochId, 'epochId');
  return advanceScheduledEmission(INITIAL_DAILY_SCHEDULED_EMISSION, epochId);
}

/** Fully funded reference path, including the cumulative one-billion mint ceiling. */
export function simulateFullyFundedEmissions(epochCount: number): FullyFundedEmissionResult {
  assertEpochCount(epochCount);

  let currentEmission = INITIAL_DAILY_SCHEDULED_EMISSION;
  let cumulativeMinted = GENESIS_TOTAL_SUPPLY;

  for (let epoch = 0; epoch < epochCount; epoch += 1) {
    const actualEmission = minBigInt(currentEmission, remainingMintCapacity(cumulativeMinted));
    cumulativeMinted += actualEmission;
    currentEmission = advanceScheduledEmission(currentEmission);
  }

  return {
    epochCount,
    recurringMinted: cumulativeMinted - GENESIS_TOTAL_SUPPLY,
    totalCumulativeMinted: cumulativeMinted,
    nextScheduledEmission: currentEmission,
  };
}

export function minimumMiningPrice(referenceMiningPrice: bigint): bigint {
  assertPositive(referenceMiningPrice, 'referenceMiningPrice');
  const price = mulDiv(referenceMiningPrice, MINING_REFERENCE_FLOOR_BPS, BPS_DENOMINATOR);
  return price > 0n ? price : 1n;
}

export function updateReferenceMiningPrice(
  previousReference: bigint,
  clearingPrice: bigint,
  hadContributions: boolean,
): bigint {
  assertPositive(previousReference, 'previousReference');
  assertNonNegative(clearingPrice, 'clearingPrice');

  const lowerBound = minimumMiningPrice(previousReference);
  if (!hadContributions) {
    return lowerBound;
  }

  assertPositive(clearingPrice, 'clearingPrice');
  // MiningMath.nextReferencePrice floors each weighted term independently. Keep the
  // offchain quote byte-for-byte equivalent instead of algebraically combining the
  // numerator, which can differ by one atomic unit after integer division.
  const weightedReference =
    mulDiv(previousReference, REFERENCE_EMA_OLD_BPS, BPS_DENOMINATOR) +
    mulDiv(clearingPrice, REFERENCE_EMA_NEW_BPS, BPS_DENOMINATOR);
  const upperBound = mulDiv(previousReference, REFERENCE_MAX_INCREASE_BPS, BPS_DENOMINATOR);
  return clampBigInt(weightedReference, lowerBound, upperBound);
}

/**
 * Quotes a settled mining epoch from raw USDG units. Prices and GBX amounts remain 18-decimal values.
 */
export function quoteMiningEpoch(input: MiningEpochQuoteInput): MiningEpochQuote {
  assertNonNegative(input.scheduledEmission, 'scheduledEmission');
  assertNonNegative(input.cumulativeMinted, 'cumulativeMinted');
  const totalUSDGWad = normalizeRawTokenAmountToWad(input.totalUSDGRaw, input.usdGDecimals, 'totalUSDGRaw');
  assertPositive(input.referenceMiningPrice, 'referenceMiningPrice');

  const scheduledEmission = minBigInt(input.scheduledEmission, remainingMintCapacity(input.cumulativeMinted));
  const reservePrice = minimumMiningPrice(input.referenceMiningPrice);

  if (input.totalUSDGRaw === 0n) {
    return {
      scheduledEmission,
      minimumMiningPrice: reservePrice,
      affordableEmission: 0n,
      actualEmission: 0n,
      clearingPrice: 0n,
      nextReferenceMiningPrice: updateReferenceMiningPrice(input.referenceMiningPrice, 0n, false),
      fullyFunded: false,
    };
  }

  const affordableEmission = mulDiv(totalUSDGWad, WAD, reservePrice);
  const actualEmission = minBigInt(scheduledEmission, affordableEmission);
  const fullyFunded = scheduledEmission > 0n && affordableEmission >= scheduledEmission;
  const clearingPrice = fullyFunded ? mulDiv(totalUSDGWad, WAD, scheduledEmission) : reservePrice;

  return {
    scheduledEmission,
    minimumMiningPrice: reservePrice,
    affordableEmission,
    actualEmission,
    clearingPrice,
    nextReferenceMiningPrice: updateReferenceMiningPrice(input.referenceMiningPrice, clearingPrice, true),
    fullyFunded,
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
