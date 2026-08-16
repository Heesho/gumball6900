import { describe, expect, it } from 'vitest';

import {
  ACCUMULATOR_PRECISION,
  ABS_MAX_AUCTION_INIT_PRICE,
  ABS_MIN_AUCTION_INIT_PRICE,
  GENESIS_LIQUIDITY_ALLOCATION,
  MAX_MINE_CAPACITY,
  MAX_AUCTION_EPOCH_PERIOD,
  MAX_AUCTION_PRICE_MULTIPLIER,
  MINE_PRICE_DECAY_PERIOD,
  MIN_AUCTION_EPOCH_PERIOD,
  MIN_AUCTION_PRICE_MULTIPLIER,
  WAD,
  auctionPriceAt,
  currentTotalSupply,
  earnedStrategyReward,
  miningRateAt,
  mulDiv,
  mulDivUp,
  netSupplyChange,
  nextMiningInitialPrice,
  nextAuctionInitPrice,
  previewRedemption,
  projectTotalSupply,
  quoteMiningAccrual,
  quoteMiningPayment,
  quoteMiningPrice,
  redemptionPercentageWad,
  settleStrategyPayment,
  updateRewardIndex,
  validateAuctionConfig,
} from '../src/index.js';

const token = (wholeTokens: bigint): bigint => wholeTokens * WAD;

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

describe('multislot mining economics', () => {
  it('pins genesis, hourly decay, and capacity constants', () => {
    expect(GENESIS_LIQUIDITY_ALLOCATION).toBe(token(20_000_000n));
    expect(MINE_PRICE_DECAY_PERIOD).toBe(3_600n);
    expect(MAX_MINE_CAPACITY).toBe(16n);
  });

  it('quotes the exact linear replacement price', () => {
    expect(quoteMiningPrice(2_000_000n, 0n)).toBe(2_000_000n);
    expect(quoteMiningPrice(2_000_000n, 1_800n)).toBe(1_000_000n);
    expect(quoteMiningPrice(2_000_000n, 3_600n)).toBe(0n);
  });

  it('routes 80% to a displaced miner and 20% to Resonance', () => {
    expect(quoteMiningPayment(1_000_000n, true)).toEqual({
      payment: 1_000_000n,
      previousMinerAmount: 800_000n,
      resonanceAmount: 200_000n,
    });
    expect(quoteMiningPayment(1_000_000n, false).resonanceAmount).toBe(1_000_000n);
  });

  it('keeps tenure rates fixed when capacity grows', () => {
    const quote = quoteMiningAccrual({ elapsedSeconds: 100n, slotUps: [4n, 2n] });
    expect(quote).toEqual({ slotEmissions: [400n, 200n], totalEmission: 600n });
  });

  it('applies halvings only when a slot is next assigned', () => {
    const curve = { halvingAmount: 1_000n, initialUps: 10n, tailUps: 1n };
    expect(miningRateAt(999n, curve)).toBe(10n);
    expect(miningRateAt(1_000n, curve)).toBe(5n);
    expect(miningRateAt(1_500n, curve)).toBe(2n);
    expect(miningRateAt(10_000n, curve)).toBe(1n);
  });

  it('clamps the next mining initial price', () => {
    expect(nextMiningInitialPrice(1_000_000n, 2n * WAD, 1_000_000n, 10_000_000n)).toBe(2_000_000n);
    expect(nextMiningInitialPrice(0n, 2n * WAD, 1_000_000n, 10_000_000n)).toBe(1_000_000n);
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

  it('classifies a Strategy payment into the fixed cumulative 90/10 split', () => {
    expect(settleStrategyPayment(token(42n))).toEqual({
      paymentAmount: token(42n),
      fundAmount: token(37n) + token(8n) / 10n,
      bribeAmount: token(4n) + token(2n) / 10n,
      splitRemainder: 0n,
    });
  });

  it('classifies any payment partition identically to one cumulative payment', () => {
    const parts = [1n, 2n, 7n, 9n, 11n, 70n, 101n];
    let fundAmount = 0n;
    let bribeAmount = 0n;
    let splitRemainder = 0n;

    for (const part of parts) {
      const settlement = settleStrategyPayment(part, splitRemainder);
      fundAmount += settlement.fundAmount;
      bribeAmount += settlement.bribeAmount;
      splitRemainder = settlement.splitRemainder;
    }

    const combined = settleStrategyPayment(parts.reduce((sum, part) => sum + part, 0n));
    expect({ fundAmount, bribeAmount, splitRemainder }).toEqual({
      fundAmount: combined.fundAmount,
      bribeAmount: combined.bribeAmount,
      splitRemainder: combined.splitRemainder,
    });
    expect(fundAmount + bribeAmount).toBe(combined.paymentAmount);
  });

  it('rejects an invalid prior split remainder', () => {
    expect(() => settleStrategyPayment(1n, 10_000n)).toThrow('priorSplitRemainder');
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

  it('tracks continuous mining and burns', () => {
    expect(currentTotalSupply(token(25_000_000n), token(5_000_000n))).toBe(token(20_000_000n));
    expect(netSupplyChange(token(3_000_000n), token(2_000_000n))).toBe(token(1_000_000n));
    expect(projectTotalSupply(token(20_000_000n), token(3_000_000n), token(2_000_000n))).toBe(token(21_000_000n));
  });
});
