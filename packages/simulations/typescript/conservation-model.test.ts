import { describe, expect, it } from 'vitest';

import {
  RevenueDistributionModel,
  RewardDistributionModel,
  StrategyPaymentModel,
  synthetixStreamEmission,
} from './conservation-model.js';

describe('simplicity-first Strategy payment model', () => {
  it('pays Fund inline and accepts per-purchase floor dust', () => {
    const partitioned = new StrategyPaymentModel();
    for (let i = 0; i < 10; i += 1) partitioned.buy(1n);
    expect(partitioned.fundReceived).toBe(10n);
    expect(partitioned.routerBalance).toBe(0n);

    const combined = new StrategyPaymentModel();
    expect(combined.buy(10n)).toEqual({ bribeAmount: 1n, fundAmount: 9n });
  });

  it('buffers automatic rewards and folds direct donations into distribution', () => {
    const model = new StrategyPaymentModel();
    model.buy(10_000_000n);
    model.donateToRouter(7n);
    expect(model.fundReceived).toBe(9_000_000n);
    expect(model.distribute(1_000_008n, 0n)).toBe(0n);
    expect(model.distribute(604_800n, 0n)).toBe(1_000_007n);
    expect(model.routerBalance).toBe(0n);
  });

  it('applies bounded rate changes prospectively without carry', () => {
    const model = new StrategyPaymentModel();
    const payments = [7n, 13n, 19n, 23n];
    const rates = [1_000n, 0n, 500n, 2_000n];
    payments.forEach((payment, index) => {
      model.setBribeBps(rates[index]!);
      model.buy(payment);
    });
    expect(model.routerBalance).toBe(4n);
    expect(model.fundReceived).toBe(58n);
    expect(() => model.setBribeBps(2_001n)).toThrow('outside protocol bounds');
  });
});

describe('scalar Synthetix-shaped Resonance model', () => {
  it('rolls ordinary leftover into a fresh seven-day rate', () => {
    const model = new RevenueDistributionModel(1);
    model.setWeight(0, 1n);
    model.notify(1_209_600n);
    model.advance(86_400n);
    expect(model.left()).toBe(1_036_800n);
    model.notify(1_036_800n);
    expect(model.earned(0)).toBe(172_800n);
    expect(model.left()).toBe(1_814_400n);
  });

  it('buffers below max(left,duration) and accepts rate-division surplus', () => {
    const model = new RevenueDistributionModel(1);
    expect(model.route(604_799n)).toBe(0n);
    expect(model.route(2n)).toBe(604_801n);
    expect(model.streamRate).toBe(1n);
    expect(model.surplus()).toBe(1n);
    expect(synthetixStreamEmission(604_801n, 604_800n, 604_800n)).toBe(604_800n);
  });

  it('classifies zero-supply elapsed rewards and direct donations as surplus', () => {
    const model = new RevenueDistributionModel(1);
    model.notify(1_209_600n);
    model.advance(3n);
    model.checkpointRevenue();
    expect(model.surplus()).toBe(6n);
    model.setWeight(0, 1n);
    model.advance(1n);
    expect(model.earned(0)).toBe(2n);
    model.donate(5n);
    expect(model.surplus()).toBe(11n);
  });

  it('checkpoints a killed Strategy and excludes it from later earnings', () => {
    const model = new RevenueDistributionModel(1);
    model.setWeight(0, 5n);
    model.notify(604_800n);
    model.advance(10n);
    model.kill(0);
    expect(model.claimable[0]).toBe(10n);
    model.advance(10n);
    expect(model.earned(0)).toBe(10n);
    expect(model.claim(0)).toBe(10n);
    model.setWeight(0, 0n);
    expect(() => model.setWeight(0, 1n)).toThrow('strategy is dead');
  });
});

describe('ordinary Bribe index model', () => {
  it('uses 1e36 precision for six-decimal rewards over 18-decimal signal', () => {
    const wad = 10n ** 18n;
    const model = new RewardDistributionModel([3_000_000n * wad, 2_000_000n * wad]);
    model.emit(1_000_000n);
    expect(model.earned(0)).toBe(600_000n);
    expect(model.earned(1)).toBe(400_000n);
    expect(model.surplus()).toBe(0n);
  });

  it('leaves global and account floors as surplus without carry or Fund liabilities', () => {
    const model = new RewardDistributionModel([3n, 7n], 10n);
    model.emit(1n);
    expect(model.earned(0)).toBe(0n);
    expect(model.earned(1)).toBe(0n);
    expect(model.surplus()).toBe(1n);
    model.setWeight(0, 0n);
    model.emit(10n);
    expect(model.earned(1)).toBe(10n);
    expect(model.surplus()).toBe(1n);
  });
});
