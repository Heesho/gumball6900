import { describe, expect, it } from 'vitest';

import {
  BURN_SHARES,
  burn,
  createFlow,
  createFund,
  createMine,
  globalTps,
  slotPrice,
  slotRemaining,
  stepMine,
  totalWeight,
  type MineModel,
} from '../../components/home/live-sim';
import { AUCTION, MINE, SIGNAL } from '../../lib/protocol';

/**
 * The three live boards claim, in writing, that the rules they run are exact even though every
 * quantity is invented. These are those rules: the straight fall to zero, the 80/20 split, the next
 * ask at twice the payment with its floor, the rate a tenure locks, and the pro-rata burn.
 */

/** Silences every slot but one, so a single replacement can be measured on its own. */
function isolate(mine: MineModel, index: number): void {
  mine.slots.forEach((slot, at) => {
    if (at !== index) slot.reserve = -1;
  });
}

describe('the mine simulation', () => {
  it('runs exactly the permanent number of slots', () => {
    expect(createMine().slots).toHaveLength(MINE.slotCount);
  });

  it('falls in a straight line to zero across the decay period, and stays there', () => {
    const mine = createMine();
    const slot = mine.slots[0]!;
    slot.initialPrice = 100;
    slot.startedAt = mine.t;

    expect(slotPrice(mine, slot)).toBeCloseTo(100, 6);
    slot.startedAt = mine.t - MINE.decayPeriodSeconds / 4;
    expect(slotPrice(mine, slot)).toBeCloseTo(75, 6);
    slot.startedAt = mine.t - MINE.decayPeriodSeconds / 2;
    expect(slotPrice(mine, slot)).toBeCloseTo(50, 6);
    expect(slotRemaining(mine, slot)).toBeCloseTo(0.5, 6);
    slot.startedAt = mine.t - MINE.decayPeriodSeconds;
    expect(slotPrice(mine, slot)).toBe(0);
    slot.startedAt = mine.t - MINE.decayPeriodSeconds * 3;
    expect(slotPrice(mine, slot)).toBe(0);
    expect(slotRemaining(mine, slot)).toBe(0);
  });

  it('splits a replacement 80/20 and opens the next auction at twice the payment', () => {
    const mine = createMine();
    isolate(mine, 0);
    const slot = mine.slots[0]!;
    slot.initialPrice = 100;
    slot.startedAt = mine.t - MINE.decayPeriodSeconds / 2;
    slot.accrued = 1_000;
    slot.reserve = 60;

    const before = { minted: mine.minted, miners: mine.toMiners, onward: mine.toResonance };
    stepMine(mine, 0);

    // Paid 50: 80% becomes the outgoing miner's claim, the remainder goes onward.
    expect(mine.toMiners - before.miners).toBeCloseTo(40, 6);
    expect(mine.toResonance - before.onward).toBeCloseTo(10, 6);
    expect(mine.minted - before.minted).toBeCloseTo(1_000, 6);
    expect(slot.initialPrice).toBeCloseTo(50 * MINE.priceMultiplier, 6);
    expect(slot.accrued).toBe(0);
    expect(slotRemaining(mine, slot)).toBe(1);
  });

  it('never opens an auction below the minimum initial price', () => {
    const mine = createMine();
    isolate(mine, 1);
    const slot = mine.slots[1]!;
    slot.initialPrice = 0.2;
    slot.startedAt = mine.t - MINE.decayPeriodSeconds / 2;
    slot.reserve = 1;

    stepMine(mine, 0);
    expect(slot.initialPrice).toBe(MINE.minInitialPriceValue);
  });

  it('locks a sixteenth of the prospective rate to the tenure that opened', () => {
    const mine = createMine();
    const perSlot = MINE.initialRateValue / MINE.slotCount;
    for (const slot of mine.slots) expect(slot.tps).toBeCloseTo(perSlot, 9);

    // Accrual is that rate times elapsed time, and no elapsed time reprices a live tenure.
    const slot = mine.slots[0]!;
    const accrued = slot.accrued;
    const rate = slot.tps;
    isolate(mine, 15);
    mine.slots[15]!.reserve = -1;
    stepMine(mine, 1);
    expect(slot.tps).toBe(rate);
    expect(slot.accrued - accrued).toBeCloseTo(rate * 60, 6);
  });

  it('halves the prospective rate on every completed period, down to the tail', () => {
    expect(globalTps(0)).toBe(MINE.initialRateValue);
    MINE.halvingLadder.forEach((rate, index) => {
      expect(globalTps(MINE.halvingPeriodSeconds * index)).toBe(rate);
    });
    expect(globalTps(MINE.halvingPeriodSeconds * 40)).toBe(MINE.tailRateValue);
  });
});

describe('the resonance simulation', () => {
  it('opens with a live stream and something waiting in every auction', () => {
    const flow = createFlow();
    expect(flow.strategies).toHaveLength(4);
    for (const strategy of flow.strategies) {
      expect(strategy.pot).toBeGreaterThan(0);
      // Every epoch is inside Strategy's own immutable bound.
      expect(strategy.epochDuration).toBeGreaterThanOrEqual(AUCTION.minEpochDurationSeconds);
      expect(strategy.epochDuration).toBeLessThanOrEqual(AUCTION.maxEpochDurationSeconds);
    }
    expect(flow.finish - flow.t).toBeLessThanOrEqual(SIGNAL.rewardDurationSeconds);
    expect(totalWeight(flow)).toBeGreaterThan(0);
  });
});

describe('the redemption simulation', () => {
  it('takes exactly the burned share of every holding, and nothing more', () => {
    const fund = createFund();
    const share = BURN_SHARES[2]!;
    const before = fund.holdings.map((holding) => holding.amount);

    burn(fund, share, false);

    fund.holdings.forEach((holding, index) => {
      expect(holding.amount).toBeCloseTo(before[index]! * (1 - share), 9);
      expect(fund.receipt?.taken[index]).toBeCloseTo(before[index]! * share, 9);
    });
    // One ratio, applied to each balance: every payout is the same fraction of its own holding.
    const ratios = fund.holdings.map((holding, index) => (fund.receipt?.taken[index] ?? 0) / before[index]!);
    for (const ratio of ratios) expect(ratio).toBeCloseTo(share, 12);
  });
});
