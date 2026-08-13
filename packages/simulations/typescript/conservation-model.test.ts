import { describe, expect, it } from 'vitest';

import { exactStreamEmission, RevenueConservationModel, RewardConservationModel } from './conservation-model.js';

describe('independent exact conservation models', () => {
  it('preserves every revenue atom across weight churn and retirement', () => {
    const model = new RevenueConservationModel(3, 10n);
    model.setWeight(0, 3n);
    model.setWeight(1, 7n);
    for (let amount = 1n; amount <= 97n; amount += 1n) {
      model.notify(604_800n + amount);
      model.advance(604_800n);
      if (amount % 5n === 0n) model.checkpoint(0);
      if (amount % 7n === 0n) model.checkpoint(1);
      if (amount === 41n) model.kill(1);
      expect(model.classifiedScaled()).toBe(model.accounted * model.precision);
    }
    model.advance(604_800n);
    model.checkpoint(0);
    model.checkpoint(1);
    model.setWeight(0, 0n);
    model.setWeight(1, 0n);
    expect(model.classifiedScaled()).toBe(model.accounted * model.precision);
  });

  it('queues a live top-up without changing the active stream', () => {
    const model = new RevenueConservationModel(2);
    model.setWeight(0, 1n * model.precision);
    model.notify(1_209_600n);
    expect(model.streamRateScaled).toBe(2n * model.precision);
    const firstFinish = model.streamFinish;

    model.advance(86_400n);
    model.notify(700_000n);
    expect(model.queuedRevenue).toBe(700_000n);
    expect(model.streamFinish).toBe(firstFinish);
    expect(model.streamRateScaled).toBe(2n * model.precision);

    model.advance(518_400n);
    model.checkpointRevenue();
    expect(model.queuedRevenue).toBe(0n);
    expect(model.streamRemainingScaled).toBe(700_000n * model.precision);
    expect(model.streamFinish).toBe(firstFinish + 604_800n);

    model.advance(604_800n);
    model.checkpoint(0);
    expect(model.claimable[0]).toBe(1_909_600n);
    expect([model.streamRateScaled, model.streamRemainingScaled, model.streamLastUpdate, model.streamFinish]).toEqual([
      0n,
      0n,
      0n,
      0n,
    ]);
    expect(model.classifiedScaled()).toBe(model.accounted * model.precision);
  });

  it('streams a single raw revenue unit and leaves no terminal router dust', () => {
    const model = new RevenueConservationModel(1);
    model.setWeight(0, 1n);
    model.notify(1n);
    model.advance(604_800n);
    model.checkpoint(0);
    expect(model.claimable[0]).toBe(1n);
    expect(model.classifiedScaled()).toBe(model.precision);
  });

  it('catches up one queued successor in bounded work', () => {
    const model = new RevenueConservationModel(1);
    model.setWeight(0, 1n);
    model.notify(100_000_000n);
    model.advance(86_400n);
    model.notify(10_000_000n);
    model.advance(13n * 86_400n);
    model.checkpoint(0);
    expect(model.claimable[0]).toBe(110_000_000n);
    expect(model.streamRemainingScaled).toBe(0n);
    expect(model.queuedRevenue).toBe(0n);
  });

  it('attributes only post-entry stream time to a new signal', () => {
    const model = new RevenueConservationModel(2);
    model.setWeight(0, 1n);
    model.notify(604_800n);
    model.advance(86_400n);
    model.setWeight(1, 1n);
    model.advance(518_400n);
    model.checkpoint(0);
    model.checkpoint(1);

    expect(model.claimable).toEqual([345_600n, 259_200n]);
  });

  it('moves unindexable old-weight carry to Fund before the denominator changes', () => {
    const model = new RevenueConservationModel(2, 10n);
    model.setWeight(0, 20n);
    model.notify(1n);
    model.advance(604_800n);
    model.checkpointRevenue();
    expect(model.pendingScaled).toBe(10n);

    model.setWeight(1, 1n);
    expect(model.pendingScaled).toBe(0n);
    expect(model.fundLiability).toBe(1n);
    expect(model.claimable).toEqual([0n, 0n]);
    expect(model.classifiedScaled()).toBe(model.accounted * model.precision);
  });

  it('emits low-decimal and sub-duration streams exactly and ignores paused wall time', () => {
    const duration = 604_800n;
    expect(exactStreamEmission(1n, duration, 0n)).toBe(0n);
    expect(exactStreamEmission(1n, duration, 1n)).toBe(1n);
    expect(exactStreamEmission(7n, duration, 3n)).toBe(3n);
    expect(exactStreamEmission(7n, duration, duration)).toBe(7n);
    // A week paused at zero supply contributes no active seconds.
    expect(exactStreamEmission(11n, duration, 9n)).toBe(exactStreamEmission(11n, duration, 9n));
  });

  it('carries repeated tiny rewards until every atom becomes attributable', () => {
    const model = new RewardConservationModel([3n, 7n], 10n);
    for (let i = 0; i < 100; i += 1) {
      model.emit(1n);
      model.checkpoint(i % 2);
      expect(model.classifiedScaled()).toBe(model.accounted * model.precision);
    }
    model.checkpoint(0);
    model.checkpoint(1);
    expect(model.liabilities[0]! + model.liabilities[1]!).toBe(100n);
    expect(model.classifiedScaled()).toBe(1_000n);
  });

  it('moves reward carry to Fund before a new signaler enters', () => {
    const model = new RewardConservationModel([50n, 50n, 0n], 10n);
    model.emit(9n);
    expect(model.pendingScaled).toBe(90n);

    model.setWeight(2, 100n);
    expect(model.pendingScaled).toBe(0n);
    expect(model.fundLiability).toBe(9n);

    model.emit(20n);
    model.checkpoint(2);
    expect(model.liabilities[2]).toBe(10n);
    expect(model.classifiedScaled()).toBe(model.accounted * model.precision);
  });
});
