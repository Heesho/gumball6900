import { describe, expect, it } from 'vitest';

import {
  ACCUMULATOR_PRECISION,
  AUCTION_DURATION_SECONDS,
  DAILY_DECAY_WAD,
  GENESIS_MINER_ALLOCATION,
  GENESIS_TOTAL_SUPPLY,
  INITIAL_DAILY_SCHEDULED_EMISSION,
  MAX_CUMULATIVE_MINT,
  WAD,
  advanceScheduledEmission,
  auctionRateAt,
  auctionRateScaleWad,
  clearingAuctionRateWad,
  currentTotalSupply,
  earnedManagerReward,
  estimateGenesisClaim,
  estimateMiningClaim,
  mulDiv,
  mulDivUp,
  netSupplyChange,
  previewRedemption,
  projectTotalSupply,
  quoteAuctionTargetAmount,
  quoteGenesis,
  quoteMiningEpoch,
  redemptionPercentageWad,
  requiredSponsorUSDGRaw,
  simulateFullyFundedEmissions,
  splitAcquiredAsset,
  updateReferenceMiningPrice,
  updateRewardAccumulator,
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

describe('emission schedule and mining quotes', () => {
  it('uses the fixed constants from the master specification', () => {
    expect(DAILY_DECAY_WAD).toBe(999_525_354_337_060_160n);
    expect(INITIAL_DAILY_SCHEDULED_EMISSION).toBe(427_181_096_645_855_643_000_000n);
  });

  it('advances empty epochs instead of carrying their emissions forward', () => {
    const afterOne = advanceScheduledEmission(INITIAL_DAILY_SCHEDULED_EMISSION);
    const afterTwo = advanceScheduledEmission(INITIAL_DAILY_SCHEDULED_EMISSION, 2);

    expect(afterOne).toBeLessThan(INITIAL_DAILY_SCHEDULED_EMISSION);
    expect(afterTwo).toBeLessThan(afterOne);
    expect(afterOne).toBe(mulDiv(INITIAL_DAILY_SCHEDULED_EMISSION, DAILY_DECAY_WAD, WAD));
  });

  it('tracks the four-year half-life with integer-rounding tolerance', () => {
    const fourYears = simulateFullyFundedEmissions(1_460);
    const expected = token(450_000_000n);
    const tolerance = token(1n);

    expect(fourYears.recurringMinted).toBeGreaterThanOrEqual(expected - tolerance);
    expect(fourYears.recurringMinted).toBeLessThanOrEqual(expected + tolerance);
  });

  it('never exceeds the cumulative mint cap over 100 years', () => {
    const result = simulateFullyFundedEmissions(36_500);

    expect(result.totalCumulativeMinted).toBeLessThanOrEqual(MAX_CUMULATIVE_MINT);
    expect(result.recurringMinted).toBeLessThanOrEqual(token(900_000_000n));
  });

  it('quotes fully funded, underfunded, and empty epochs', () => {
    const common = {
      scheduledEmission: token(100n),
      cumulativeMinted: GENESIS_TOTAL_SUPPLY,
      referenceMiningPrice: 2n * WAD,
    };

    const full = quoteMiningEpoch({ ...common, totalUSDGRaw: usdg(250n), usdGDecimals: 6 });
    expect(full.fullyFunded).toBe(true);
    expect(full.actualEmission).toBe(token(100n));
    expect(full.clearingPrice).toBe((5n * WAD) / 2n);
    expect(full.nextReferenceMiningPrice).toBe((21n * WAD) / 10n);

    const partial = quoteMiningEpoch({ ...common, totalUSDGRaw: usdg(95n), usdGDecimals: 6 });
    expect(partial.fullyFunded).toBe(false);
    expect(partial.minimumMiningPrice).toBe((19n * WAD) / 10n);
    expect(partial.actualEmission).toBe(token(50n));
    expect(partial.clearingPrice).toBe((19n * WAD) / 10n);
    expect(partial.nextReferenceMiningPrice).toBe((198n * WAD) / 100n);

    const empty = quoteMiningEpoch({ ...common, totalUSDGRaw: 0n, usdGDecimals: 6 });
    expect(empty.actualEmission).toBe(0n);
    expect(empty.clearingPrice).toBe(0n);
    expect(empty.nextReferenceMiningPrice).toBe((19n * WAD) / 10n);
  });

  it('clamps reference updates to their daily bounds', () => {
    expect(updateReferenceMiningPrice(WAD, WAD / 10n, true)).toBe((95n * WAD) / 100n);
    expect(updateReferenceMiningPrice(WAD, 10n * WAD, true)).toBe((15n * WAD) / 10n);
  });

  it('keeps a nonzero atomic reserve after a long empty-epoch tail', () => {
    let reference = WAD;
    for (let epoch = 0; epoch < 2_000; epoch += 1) {
      reference = updateReferenceMiningPrice(reference, 0n, false);
    }
    expect(reference).toBe(1n);
  });

  it('matches Solidity by flooring the two EMA terms independently', () => {
    expect(updateReferenceMiningPrice(101n, 104n, true)).toBe(100n);
  });

  it('uses pro-rata claim accounting', () => {
    expect(estimateMiningClaim(token(25n), token(100n), token(80n))).toBe(token(20n));
  });
});

describe('genesis backing', () => {
  it('requires one sponsor USDG for every four community USDG', () => {
    const community = usdg(80_000_000n);
    const quote = quoteGenesis(community, 6);

    expect(quote.requiredSponsorUSDGRaw).toBe(usdg(20_000_000n));
    expect(quote.totalGenesisAssetsUSDGRaw).toBe(usdg(100_000_000n));
    expect(quote.totalGenesisSupplyGBXRaw).toBe(token(100_000_000n));
    expect(quote.genesisPriceWad).toBe(WAD);
    expect(quote.backingPerGBXWad).toBe(WAD);
    expect(quote.usdGDecimals).toBe(6);
  });

  it('rounds sponsor requirements upward to prevent atomic-unit underbacking', () => {
    expect(requiredSponsorUSDGRaw(1n)).toBe(1n);
    expect(requiredSponsorUSDGRaw(5n)).toBe(2n);
  });

  it('calculates claims against the complete miner allocation', () => {
    expect(estimateGenesisClaim(token(10n), token(80n))).toBe(token(10_000_000n));
    expect(estimateGenesisClaim(token(80n), token(80n))).toBe(GENESIS_MINER_ALLOCATION);
  });
});

describe('auctions and manager rewards', () => {
  it('uses the 125%-to-80% linear reverse-Dutch curve', () => {
    expect(auctionRateAt(WAD, 0n)).toBe((125n * WAD) / 100n);
    expect(auctionRateAt(WAD, AUCTION_DURATION_SECONDS / 2n)).toBe((1025n * WAD) / 1_000n);
    expect(auctionRateAt(WAD, AUCTION_DURATION_SECONDS)).toBe((80n * WAD) / 100n);
    expect(auctionRateAt(WAD, AUCTION_DURATION_SECONDS * 10n)).toBe((80n * WAD) / 100n);
  });

  it('rounds required taker payment upward', () => {
    expect(auctionRateScaleWad(6, 18)).toBe(1_000_000n);
    expect(quoteAuctionTargetAmount(usdg(10_000n), 4_200_000_000_000_000n, 6, 18)).toBe(token(42n));
    expect(clearingAuctionRateWad(token(42n), usdg(10_000n), 6, 18)).toBe(4_200_000_000_000_000n);
    expect(quoteAuctionTargetAmount(1n, WAD, 6, 18)).toBe(1_000_000_000_000n);
  });

  it('requires explicit WAD-compatible token decimals for auction and mining math', () => {
    expect(() => quoteAuctionTargetAmount(1n, WAD, 6, 19)).toThrow('must not exceed 18');
    expect(() =>
      quoteMiningEpoch({
        scheduledEmission: token(1n),
        cumulativeMinted: GENESIS_TOTAL_SUPPLY,
        totalUSDGRaw: 1n,
        usdGDecimals: 19,
        referenceMiningPrice: WAD,
      }),
    ).toThrow('must not exceed 18');
  });

  it('sends 98% to the vault and 2% to active managers', () => {
    const live = splitAcquiredAsset(token(42n), true);
    expect(live.vaultAmount).toBe(41_160_000_000_000_000_000n);
    expect(live.managerAmount).toBe(840_000_000_000_000_000n);
    expect(live.vaultAmount + live.managerAmount).toBe(live.actualTargetReceived);

    const zeroWeight = splitAcquiredAsset(token(42n), false);
    expect(zeroWeight.vaultAmount).toBe(token(42n));
    expect(zeroWeight.managerAmount).toBe(0n);
  });

  it('carries unrepresented reward dust into the next notification', () => {
    const update = updateRewardAccumulator(10n, 3n, 0n, 10n);
    expect(update.rewardPerWeightIncrement).toBe(33n);
    expect(update.representedReward).toBe(9n);
    expect(update.nextRemainder).toBe(1n);

    expect(earnedManagerReward(2n, 33n, 0n, 1n, 10n)).toBe(7n);
  });

  it('does not double count scaled carry across tiny notifications', () => {
    let rewardPerWeightStored = 0n;
    let remainder = 0n;

    for (let notification = 0; notification < 3; notification += 1) {
      const update = updateRewardAccumulator(1n, 3n, remainder, 10n);
      rewardPerWeightStored += update.rewardPerWeightIncrement;
      remainder = update.nextRemainder;
    }

    expect(rewardPerWeightStored).toBe(10n);
    expect(remainder).toBe(0n);
  });

  it('handles production-scale accumulator precision', () => {
    const update = updateRewardAccumulator(840_000_000_000_000_000n, token(200n));
    expect(update.rewardPerWeightIncrement).toBe(4_200_000_000_000_000_000_000_000n);
    expect(update.nextRemainder).toBe(0n);
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
