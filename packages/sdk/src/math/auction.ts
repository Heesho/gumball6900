import {
  ABS_MAX_AUCTION_INIT_PRICE,
  ABS_MIN_AUCTION_INIT_PRICE,
  MAX_AUCTION_EPOCH_PERIOD,
  MAX_AUCTION_PRICE_MULTIPLIER,
  MIN_AUCTION_EPOCH_PERIOD,
  MIN_AUCTION_PRICE_MULTIPLIER,
  WAD,
} from './constants.js';
import { assertNonNegative, assertPositive, clampBigInt, mulDiv } from './integer.js';

export interface StrategyPaymentSettlement {
  paymentAmount: bigint;
  fundAmount: bigint;
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

/** Models the uniform Strategy rule: every completed payment is owed entirely to Fund. */
export function settleStrategyPayment(paymentAmount: bigint): StrategyPaymentSettlement {
  assertNonNegative(paymentAmount, 'paymentAmount');
  return { paymentAmount, fundAmount: paymentAmount };
}
