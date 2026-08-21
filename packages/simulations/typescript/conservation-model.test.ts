import { describe, expect, it } from 'vitest';

import {
  exactStreamEmission,
  RevenueConservationModel,
  RewardConservationModel,
  StrategyPaymentConservationModel,
} from './conservation-model.js';

describe('independent Resonance reward model', () => {
  it('conserves 10,000 one-unit Strategy payments and isolates donations from settlement', () => {
    const model = new StrategyPaymentConservationModel();
    for (let i = 0; i < 10_000; i += 1) model.route(1n);
    model.donate(7n);

    expect(model.fundLiability).toBe(9_000n);
    expect(model.bribeLiability).toBe(1_000n);
    expect(model.splitRemainder).toBe(0n);
    expect(model.accountedBalance).toBe(model.fundLiability + model.bribeLiability);
    expect(model.surplus()).toBe(7n);
    expect(model.notifyBribe()).toBe(1_000n);
    expect(model.payFund()).toBe(9_000n);
    expect(model.balance).toBe(7n);
    expect(model.accountedBalance).toBe(0n);
  });

  it('preserves one exact weighted carry through 10%, 0%, 5%, and 20%', () => {
    const model = new StrategyPaymentConservationModel();
    const payments = [7n, 13n, 19n, 23n];
    const rates = [1_000n, 0n, 500n, 2_000n];

    payments.forEach((payment, index) => {
      model.setBribeBps(rates[index]!);
      model.route(payment);
    });

    const weightedNumerator = payments.reduce((sum, payment, index) => sum + payment * rates[index]!, 0n);
    expect(model.bribeLiability).toBe(weightedNumerator / 10_000n);
    expect(model.bribeLiability).toBe(6n);
    expect(model.splitRemainder).toBe(weightedNumerator % 10_000n);
    expect(model.splitRemainder).toBe(2_500n);
    expect(model.fundLiability).toBe(56n);
    expect(model.accountedBalance).toBe(62n);
  });

  it('adds no Bribe liability at 0% and enforces the 20% ceiling', () => {
    const model = new StrategyPaymentConservationModel();
    model.route(20n);
    expect(model.bribeLiability).toBe(2n);

    model.setBribeBps(0n);
    model.route(1_000_000n);
    expect(model.bribeLiability).toBe(2n);
    expect(model.notifyBribe()).toBe(2n);
    expect(model.payFund()).toBe(1_000_018n);

    model.setBribeBps(2_000n);
    expect(() => model.setBribeBps(2_001n)).toThrow('outside protocol bounds');
    expect(() => model.setBribeBps(-1n)).toThrow('outside protocol bounds');
  });
  it('checkpoints and restarts a qualifying live top-up with reward plus exact left', () => {
    const model = new RevenueConservationModel(1);
    model.setWeight(0, 1n);
    model.notify(1_209_600n);
    const firstFinish = model.streamFinish;

    model.advance(86_400n);
    expect(model.left()).toBe(1_036_800n);
    model.notify(1_036_800n);

    expect(model.earned(0)).toBe(172_800n);
    expect(model.left()).toBe(2_073_600n);
    expect(model.streamFinish).toBe(86_400n + 604_800n);
    expect(model.streamFinish).toBeGreaterThan(firstFinish);
    expect(model.surplus()).toBe(0n);
  });

  it('rejects a sub-threshold notification and lets the modeled Router hold until qualifying', () => {
    const model = new RevenueConservationModel(1);
    model.setWeight(0, 1n);
    expect(model.route(1_209_600n)).toBe(1_209_600n);
    const firstFinish = model.streamFinish;

    model.advance(86_400n);
    const minimum = model.left();
    expect(() => model.notify(minimum - 1n)).toThrow('reward smaller than left');
    expect(model.streamFinish).toBe(firstFinish);

    expect(model.route(700_000n)).toBe(0n);
    expect(model.routerBalance).toBe(700_000n);
    expect(model.streamFinish).toBe(firstFinish);

    expect(model.route(minimum - 700_000n)).toBe(minimum);
    expect(model.routerBalance).toBe(0n);
    expect(model.left()).toBe(2n * minimum);
  });

  it('front-loads a one-raw-unit stream into its first second', () => {
    const model = new RevenueConservationModel(1);
    model.setWeight(0, 1n);
    model.notify(1n);

    expect(model.left()).toBe(1n);
    model.advance(1n);
    expect(model.left()).toBe(0n);
    expect(model.claim(0)).toBe(1n);
    expect(model.balance).toBe(0n);

    expect(exactStreamEmission(1n, 604_800n, 0n)).toBe(0n);
    expect(exactStreamEmission(1n, 604_800n, 1n)).toBe(1n);
  });

  it('classifies zero-supply emission and direct donations as surplus', () => {
    const model = new RevenueConservationModel(1);
    model.notify(7n);
    model.advance(3n);
    model.checkpointRevenue();
    expect(model.left()).toBe(4n);
    expect(model.surplus()).toBe(3n);

    model.setWeight(0, 1n);
    model.advance(1n);
    expect(model.earned(0)).toBe(1n);
    expect(model.surplus()).toBe(3n);

    model.donate(5n);
    expect(model.donations).toBe(5n);
    expect(model.surplus()).toBe(8n);
  });

  it('leaves per-Strategy flooring in surplus instead of carrying fractions', () => {
    const model = new RevenueConservationModel(2);
    model.setWeight(0, 1n);
    model.setWeight(1, 1n);
    model.notify(2n);

    model.advance(1n);
    model.checkpoint(0);
    model.checkpoint(1);
    expect(model.claimable).toEqual([0n, 0n]);
    expect(model.surplus()).toBe(1n);

    model.advance(1n);
    model.checkpoint(0);
    model.checkpoint(1);
    expect(model.claimable).toEqual([0n, 0n]);
    expect(model.surplus()).toBe(2n);
  });

  it('kills against the old denominator, preserves stored reward, and excludes future earnings', () => {
    const model = new RevenueConservationModel(1);
    model.setWeight(0, 5n);
    model.notify(604_800n);
    model.advance(10n);

    model.kill(0);
    expect(model.claimable[0]).toBe(10n);
    expect(model.totalWeight).toBe(0n);
    expect(model.weights[0]).toBe(5n);

    model.advance(10n);
    model.checkpointRevenue();
    expect(model.earned(0)).toBe(10n);
    expect(model.surplus()).toBe(10n);
    expect(model.claim(0)).toBe(10n);

    model.setWeight(0, 0n);
    expect(model.totalWeight).toBe(0n);
    expect(() => model.setWeight(0, 1n)).toThrow('strategy is dead');
  });
});

describe('independent Bribe carry model', () => {
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
