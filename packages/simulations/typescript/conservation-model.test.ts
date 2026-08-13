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

  it('holds an insufficient top-up, then rolls it into a fresh seven-day period once eligible', () => {
    const model = new RevenueConservationModel(2);
    model.setWeight(0, 1n * model.precision);
    model.notify(1_209_600n);
    expect(model.streamRateScaled).toBe(2n * model.precision);
    const firstFinish = model.streamFinish;

    model.advance(86_400n);
    expect(model.leftRevenue()).toBe(1_036_800n);
    expect(model.canNotify(700_000n)).toBe(false);
    expect(() => model.notify(700_000n)).toThrow(/active stream remainder/);
    expect(model.streamFinish).toBe(firstFinish);

    model.advance(172_800n);
    expect(model.leftRevenue()).toBe(691_200n);
    expect(model.canNotify(700_000n)).toBe(true);
    model.notify(700_000n);
    expect(model.streamRemainingScaled).toBe(1_391_200n * model.precision);
    expect(model.streamFinish).toBe(model.now + 604_800n);

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

  it('retains amounts below the raw seven-day anti-grief minimum regardless of elapsed time', () => {
    const model = new RevenueConservationModel(1);
    expect(model.canNotify(604_799n)).toBe(false);
    expect(() => model.notify(604_799n)).toThrow(/stream-duration minimum/);
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
});
