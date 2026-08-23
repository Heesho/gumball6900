import {
  ABS_MAX_AUCTION_INIT_PRICE,
  ABS_MIN_AUCTION_INIT_PRICE,
  BPS_DENOMINATOR,
  DEFAULT_STRATEGY_BRIBE_BPS,
  MAX_AUCTION_EPOCH_PERIOD,
  MAX_AUCTION_PRICE_MULTIPLIER,
  MAX_STRATEGY_BRIBE_BPS,
  MIN_AUCTION_EPOCH_PERIOD,
  MIN_AUCTION_PRICE_MULTIPLIER,
  WAD,
} from './constants.js';
import { assertNonNegative, assertPositive, clampBigInt, mulDiv } from './integer.js';

export interface StrategyPaymentSettlement {
  paymentAmount: bigint;
  bribeBasisPoints: bigint;
  fundBasisPoints: bigint;
  fundAmount: bigint;
  bribeAmount: bigint;
}

export interface AuctionConfig {
  initPrice: bigint;
  epochPeriod: bigint;
  priceMultiplier: bigint;
  minInitPrice: bigint;
}

/** Validates the same constructor bounds and ordering as AuctionEngine. */
export function validateAuctionConfig(config: AuctionConfig): AuctionConfig {
  if (config.initPrice < config.minInitPrice || config.initPrice > ABS_MAX_AUCTION_INIT_PRICE) {
    throw new RangeError('initPrice is outside the configured bounds');
  }
  if (config.epochPeriod < MIN_AUCTION_EPOCH_PERIOD || config.epochPeriod > MAX_AUCTION_EPOCH_PERIOD) {
    throw new RangeError('epochPeriod is outside the protocol bounds');
  }
  if (config.priceMultiplier < MIN_AUCTION_PRICE_MULTIPLIER || config.priceMultiplier > MAX_AUCTION_PRICE_MULTIPLIER) {
    throw new RangeError('priceMultiplier is outside the protocol bounds');
  }
  if (config.minInitPrice < ABS_MIN_AUCTION_INIT_PRICE || config.minInitPrice > ABS_MAX_AUCTION_INIT_PRICE) {
    throw new RangeError('minInitPrice is outside the protocol bounds');
  }
  return config;
}

/** Exact AuctionEngine.getPrice arithmetic, including E => 0 and t > E => 0. */
export function auctionPriceAt(initPrice: bigint, elapsedSeconds: bigint, epochPeriod: bigint): bigint {
  assertPositive(initPrice, 'initPrice');
  assertNonNegative(elapsedSeconds, 'elapsedSeconds');
  assertPositive(epochPeriod, 'epochPeriod');
  if (elapsedSeconds > epochPeriod) return 0n;
  return initPrice - mulDiv(initPrice, elapsedSeconds, epochPeriod);
}

/** Exact quoted-payment transition, with floor multiplication and min/max clamps. */
export function nextAuctionInitPrice(
  quotedPaymentAmount: bigint,
  priceMultiplier: bigint,
  minInitPrice: bigint,
): bigint {
  assertNonNegative(quotedPaymentAmount, 'quotedPaymentAmount');
  assertPositive(priceMultiplier, 'priceMultiplier');
  assertPositive(minInitPrice, 'minInitPrice');
  return clampBigInt(mulDiv(quotedPaymentAmount, priceMultiplier, WAD), minInitPrice, ABS_MAX_AUCTION_INIT_PRICE);
}

/** Models Strategy's per-purchase acquired-asset classification at the supplied global rate. */
export function settleStrategyPayment(
  paymentAmount: bigint,
  bribeBasisPoints = DEFAULT_STRATEGY_BRIBE_BPS,
): StrategyPaymentSettlement {
  assertNonNegative(paymentAmount, 'paymentAmount');
  assertNonNegative(bribeBasisPoints, 'bribeBasisPoints');
  if (bribeBasisPoints > MAX_STRATEGY_BRIBE_BPS) {
    throw new RangeError('bribeBasisPoints exceeds MAX_STRATEGY_BRIBE_BPS');
  }

  const bribeAmount = mulDiv(paymentAmount, bribeBasisPoints, BPS_DENOMINATOR);
  return {
    paymentAmount,
    bribeBasisPoints,
    fundBasisPoints: BPS_DENOMINATOR - bribeBasisPoints,
    fundAmount: paymentAmount - bribeAmount,
    bribeAmount,
  };
}
