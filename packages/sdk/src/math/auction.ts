import {
  AUCTION_DURATION_SECONDS,
  AUCTION_FLOOR_RATE_BPS,
  AUCTION_START_RATE_BPS,
  BPS_DENOMINATOR,
  MANAGER_REWARD_BPS,
  WAD,
} from './constants.js';
import { assertWadCompatibleTokenDecimals, rawTokenUnit } from './decimals.js';
import { assertNonNegative, assertPositive, mulDiv, mulDivUp } from './integer.js';

export interface AcquisitionSplit {
  actualTargetReceived: bigint;
  vaultAmount: bigint;
  managerAmount: bigint;
}

/** Linear reverse-Dutch rate in human target-token units per human USDG, represented as WAD. */
export function auctionRateAt(
  referenceRate: bigint,
  elapsedSeconds: bigint,
  durationSeconds = AUCTION_DURATION_SECONDS,
): bigint {
  assertPositive(referenceRate, 'referenceRate');
  assertNonNegative(elapsedSeconds, 'elapsedSeconds');
  assertPositive(durationSeconds, 'durationSeconds');

  const startRate = mulDiv(referenceRate, AUCTION_START_RATE_BPS, BPS_DENOMINATOR);
  const floorRate = mulDiv(referenceRate, AUCTION_FLOOR_RATE_BPS, BPS_DENOMINATOR);
  if (elapsedSeconds >= durationSeconds) {
    return floorRate;
  }

  const decay = mulDiv(startRate - floorRate, elapsedSeconds, durationSeconds);
  return startRate - decay;
}

/**
 * Returns the denominator that converts a human-normalized WAD rate into raw token units:
 * `targetRaw = ceil(usdGRaw * rateWad / rateScaleWad)`.
 */
export function auctionRateScaleWad(usdGDecimals: number, targetDecimals: number): bigint {
  assertWadCompatibleTokenDecimals(usdGDecimals, 'usdGDecimals');
  assertWadCompatibleTokenDecimals(targetDecimals, 'targetDecimals');
  const usdGUnit = rawTokenUnit(usdGDecimals);
  const targetUnit = rawTokenUnit(targetDecimals);
  return targetUnit >= usdGUnit ? WAD / (targetUnit / usdGUnit) : WAD * (usdGUnit / targetUnit);
}

/** Required raw target payment, rounded upward so a taker cannot underpay by atomic-unit dust. */
export function quoteAuctionTargetAmount(
  usdGAmountRaw: bigint,
  targetPerUSDGRateWad: bigint,
  usdGDecimals: number,
  targetDecimals: number,
): bigint {
  assertNonNegative(usdGAmountRaw, 'usdGAmountRaw');
  assertPositive(targetPerUSDGRateWad, 'targetPerUSDGRateWad');
  return mulDivUp(usdGAmountRaw, targetPerUSDGRateWad, auctionRateScaleWad(usdGDecimals, targetDecimals));
}

/** Endogenous human-normalized WAD clearing rate, rounded down to mirror Solidity Math.mulDiv. */
export function clearingAuctionRateWad(
  targetAmountRaw: bigint,
  usdGAmountRaw: bigint,
  usdGDecimals: number,
  targetDecimals: number,
): bigint {
  assertPositive(targetAmountRaw, 'targetAmountRaw');
  assertPositive(usdGAmountRaw, 'usdGAmountRaw');
  return mulDiv(targetAmountRaw, auctionRateScaleWad(usdGDecimals, targetDecimals), usdGAmountRaw);
}

export function splitAcquiredAsset(
  actualTargetReceived: bigint,
  hasLiveManagerWeight: boolean,
  managerRewardBps = MANAGER_REWARD_BPS,
): AcquisitionSplit {
  assertNonNegative(actualTargetReceived, 'actualTargetReceived');
  assertNonNegative(managerRewardBps, 'managerRewardBps');
  if (managerRewardBps > BPS_DENOMINATOR) {
    throw new RangeError('managerRewardBps must not exceed BPS_DENOMINATOR');
  }

  const managerAmount = hasLiveManagerWeight ? mulDiv(actualTargetReceived, managerRewardBps, BPS_DENOMINATOR) : 0n;

  return {
    actualTargetReceived,
    vaultAmount: actualTargetReceived - managerAmount,
    managerAmount,
  };
}
