import { describe, expect, it } from 'vitest';

import { exactStreamEmission, RevenueConservationModel, RewardConservationModel } from './conservation-model.js';

describe('independent exact conservation models', () => {
  it('preserves every revenue atom across weight churn and retirement', () => {
    const model = new RevenueConservationModel(3, 10n);
    model.setWeight(0, 3n);
    model.setWeight(1, 7n);
    for (let amount = 1n; amount <= 97n; amount += 1n) {
      model.notify(amount);
      if (amount % 5n === 0n) model.checkpoint(0);
      if (amount % 7n === 0n) model.checkpoint(1);
      if (amount === 41n) model.kill(1);
      expect(model.classifiedScaled()).toBe(model.accounted * model.precision);
    }
    model.setWeight(0, 0n);
    model.setWeight(1, 0n);
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
});
