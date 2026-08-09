import { describe, expect, it } from 'vitest';

import {
  ACCUMULATOR_PRECISION,
  ABS_MAX_AUCTION_INIT_PRICE,
  ABS_MIN_AUCTION_INIT_PRICE,
  DAILY_DECAY_WAD,
  GENESIS_TOTAL_SUPPLY,
  HALF_LIFE_DECAY_COMPLEMENT_X54,
  HALF_LIFE_DERIVATION_PRECISION,
  INITIAL_DAILY_SCHEDULED_EMISSION,
  MAX_AUCTION_EPOCH_PERIOD,
  MAX_AUCTION_PRICE_MULTIPLIER,
  MAX_CUMULATIVE_MINT,
  FUNDRAISER_DISTRIBUTION_ALLOCATION,
  MIN_AUCTION_EPOCH_PERIOD,
  MIN_AUCTION_PRICE_MULTIPLIER,
  WAD,
  advanceScheduledEmission,
  auctionPriceAt,
  currentTotalSupply,
  earnedStrategyReward,
  estimateFundraiserClaim,
  mulDiv,
  mulDivUp,
  netSupplyChange,
  nextAuctionInitPrice,
  previewRedemption,
  projectTotalSupply,
  quoteFundraiserEpoch,
  redemptionPercentageWad,
  simulateAllNonEmptyEmissions,
  settleStrategyPayment,
  updateRewardIndex,
  validateAuctionConfig,
} from '../src/index.js';

const token = (wholeTokens: bigint): bigint => wholeTokens * WAD;
const usdg = (wholeTokens: bigint): bigint => wholeTokens * 10n ** 6n;

describe('integer helpers', () => {
  it('matches Solidity-style floor rounding and explicit ceiling rounding', () => {
    expect(mulDiv(10n, 10n, 6n)).toBe(16n);
    expect(mulDivUp(10n, 10n, 6n)).toBe(17n);
    expect(mulDivUp(0n, 10n, 6n)).toBe(0n);
  });

  it('rejects invalid signed inputs and zero denominators', () => {
    expect(() => mulDiv(-1n, 1n, 1n)).toThrow(RangeError);
    expect(() => mulDiv(1n, 1n, 0n)).toThrow(RangeError);
  });
});

describe('Fundraiser distribution schedule and epoch quotes', () => {
  it('uses the fixed constants from the master specification', () => {
    expect(DAILY_DECAY_WAD).toBe(999_525_354_337_060_160n);
    expect(GENESIS_TOTAL_SUPPLY).toBe(token(20_000_000n));
    expect(FUNDRAISER_DISTRIBUTION_ALLOCATION).toBe(token(980_000_000n));
    expect(INITIAL_DAILY_SCHEDULED_EMISSION).toBe(465_152_749_681_042_811_702_004n);
    expect(INITIAL_DAILY_SCHEDULED_EMISSION).toBe(
      mulDiv(FUNDRAISER_DISTRIBUTION_ALLOCATION, HALF_LIFE_DECAY_COMPLEMENT_X54, HALF_LIFE_DERIVATION_PRECISION),
    );
  });

  it('advances empty epochs instead of carrying their emissions forward', () => {
    const afterOne = advanceScheduledEmission(INITIAL_DAILY_SCHEDULED_EMISSION);
    const afterTwo = advanceScheduledEmission(INITIAL_DAILY_SCHEDULED_EMISSION, 2);

    expect(afterOne).toBeLessThan(INITIAL_DAILY_SCHEDULED_EMISSION);
    expect(afterTwo).toBeLessThan(afterOne);
    expect(afterOne).toBe(mulDiv(INITIAL_DAILY_SCHEDULED_EMISSION, DAILY_DECAY_WAD, WAD));
  });

  it('tracks the four-year half-life with integer-rounding tolerance', () => {
    const fourYears = simulateAllNonEmptyEmissions(1_460);
    const expected = token(490_000_000n);
    const tolerance = token(1n);

    expect(fourYears.recurringMinted).toBeGreaterThanOrEqual(expected - tolerance);
    expect(fourYears.recurringMinted).toBeLessThanOrEqual(expected + tolerance);
  });

  it('never exceeds the cumulative mint cap over 100 years', () => {
    const result = simulateAllNonEmptyEmissions(36_500);

    expect(result.totalCumulativeMinted).toBeLessThanOrEqual(MAX_CUMULATIVE_MINT);
    expect(result.recurringMinted).toBeLessThanOrEqual(FUNDRAISER_DISTRIBUTION_ALLOCATION);
  });

  it('quotes complete non-empty emissions without demand scaling and forfeits empty epochs', () => {
    const common = {
      scheduledEmission: token(100n),
      cumulativeMinted: GENESIS_TOTAL_SUPPLY,
    };

    const large = quoteFundraiserEpoch({ ...common, totalContributedRaw: usdg(250n) });
    const oneAtom = quoteFundraiserEpoch({ ...common, totalContributedRaw: 1n });
    expect(large.nonEmpty).toBe(true);
    expect(large.actualEmission).toBe(token(100n));
    expect(oneAtom.actualEmission).toBe(large.actualEmission);

    const empty = quoteFundraiserEpoch({ ...common, totalContributedRaw: 0n });
    expect(empty.nonEmpty).toBe(false);
    expect(empty.actualEmission).toBe(0n);
    expect(empty.forfeitedEmission).toBe(token(100n));
  });

  it('uses pro-rata claim accounting', () => {
    expect(estimateFundraiserClaim(token(25n), token(100n), token(80n))).toBe(token(20n));
  });
});

describe('auctions and Strategy settlement', () => {
  it('matches the give.fun linear-decay endpoints and Solidity floor order', () => {
    expect(auctionPriceAt(100n, 0n, 6n)).toBe(100n);
    expect(auctionPriceAt(100n, 1n, 6n)).toBe(84n);
    expect(auctionPriceAt(100n, 5n, 6n)).toBe(17n);
    expect(auctionPriceAt(100n, 6n, 6n)).toBe(0n);
    expect(auctionPriceAt(100n, 7n, 6n)).toBe(0n);
  });

  it('clamps the floor-multiplied quoted payment when advancing', () => {
    expect(nextAuctionInitPrice(101n, 1_100_000_000_000_000_000n, 1n)).toBe(111n);
    expect(nextAuctionInitPrice(0n, MIN_AUCTION_PRICE_MULTIPLIER, ABS_MIN_AUCTION_INIT_PRICE)).toBe(
      ABS_MIN_AUCTION_INIT_PRICE,
    );
    expect(nextAuctionInitPrice(ABS_MAX_AUCTION_INIT_PRICE, 3n * WAD, 1n)).toBe(ABS_MAX_AUCTION_INIT_PRICE);
  });

  it('validates the exact constructor bounds', () => {
    const minimum = {
      initPrice: ABS_MIN_AUCTION_INIT_PRICE,
      epochPeriod: MIN_AUCTION_EPOCH_PERIOD,
      priceMultiplier: MIN_AUCTION_PRICE_MULTIPLIER,
      minInitPrice: ABS_MIN_AUCTION_INIT_PRICE,
    };
    const maximum = {
      initPrice: ABS_MAX_AUCTION_INIT_PRICE,
      epochPeriod: MAX_AUCTION_EPOCH_PERIOD,
      priceMultiplier: MAX_AUCTION_PRICE_MULTIPLIER,
      minInitPrice: ABS_MAX_AUCTION_INIT_PRICE,
    };
    expect(validateAuctionConfig(minimum)).toBe(minimum);
    expect(validateAuctionConfig(maximum)).toBe(maximum);
    expect(() => validateAuctionConfig({ ...minimum, initPrice: ABS_MIN_AUCTION_INIT_PRICE - 1n })).toThrow(
      'initPrice',
    );
    expect(() => validateAuctionConfig({ ...maximum, initPrice: ABS_MAX_AUCTION_INIT_PRICE + 1n })).toThrow(
      'initPrice',
    );
    expect(() => validateAuctionConfig({ ...minimum, epochPeriod: MIN_AUCTION_EPOCH_PERIOD - 1n })).toThrow(
      'epochPeriod',
    );
    expect(() => validateAuctionConfig({ ...maximum, epochPeriod: MAX_AUCTION_EPOCH_PERIOD + 1n })).toThrow(
      'epochPeriod',
    );
    expect(() => validateAuctionConfig({ ...minimum, priceMultiplier: MIN_AUCTION_PRICE_MULTIPLIER - 1n })).toThrow(
      'priceMultiplier',
    );
    expect(() => validateAuctionConfig({ ...maximum, priceMultiplier: MAX_AUCTION_PRICE_MULTIPLIER + 1n })).toThrow(
      'priceMultiplier',
    );
    expect(() => validateAuctionConfig({ ...minimum, minInitPrice: ABS_MIN_AUCTION_INIT_PRICE - 1n })).toThrow(
      'minInitPrice',
    );
  });

  it('settles the complete payment to Fund without a signal-dependent split', () => {
    expect(settleStrategyPayment(token(42n))).toEqual({
      paymentAmount: token(42n),
      fundAmount: token(42n),
    });
  });

  it('leaves independently floored reward residue in the contract', () => {
    const update = updateRewardIndex(10n, 3n, 10n);
    expect(update.rewardPerWeightIncrement).toBe(33n);
    expect(update.indexedReward).toBe(9n);
    expect(update.residue).toBe(1n);

    expect(earnedStrategyReward(2n, 33n, 0n, 1n, 10n)).toBe(7n);
  });

  it('does not carry scaled numerator dust across tiny notifications', () => {
    let rewardPerWeightStored = 0n;

    for (let notification = 0; notification < 3; notification += 1) {
      const update = updateRewardIndex(1n, 3n, 10n);
      rewardPerWeightStored += update.rewardPerWeightIncrement;
      expect(update.residue).toBe(1n);
    }

    expect(rewardPerWeightStored).toBe(9n);
  });

  it('handles production-scale accumulator precision', () => {
    const update = updateRewardIndex(840_000_000_000_000_000n, token(200n));
    expect(update.rewardPerWeightIncrement).toBe(4_200_000_000_000_000_000_000_000n);
    expect(update.residue).toBe(0n);
    expect(ACCUMULATOR_PRECISION).toBe(10n ** 27n);
  });
});

describe('redemption and supply', () => {
  it('previews the same pro-rata fraction for every asset', () => {
    const preview = previewRedemption(token(100n), token(1_000n), [
      { asset: 'USDG', balance: token(5_000n) },
      { asset: 'NVDA', balance: token(42n) },
    ]);

    expect(redemptionPercentageWad(token(100n), token(1_000n))).toBe(WAD / 10n);
    expect(preview).toEqual([
      { asset: 'USDG', amount: token(500n) },
      { asset: 'NVDA', amount: 4_200_000_000_000_000_000n },
    ]);
  });

  it('tracks real burns without reopening mint capacity', () => {
    expect(currentTotalSupply(token(150_000_000n), token(5_000_000n))).toBe(token(145_000_000n));
    expect(netSupplyChange(token(1_000_000n), token(2_000_000n))).toBe(-token(1_000_000n));
    expect(projectTotalSupply(token(145_000_000n), token(1_000_000n), token(2_000_000n))).toBe(token(144_000_000n));
  });
});
