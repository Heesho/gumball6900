import { describe, expect, it } from 'vitest';

import {
  loadCommittedEconomicFixture,
  loadPythonEconomicSuite,
  loadTypeScriptEconomicSuite,
} from './economic-fixture-harness.js';

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  expect(value).toBeTypeOf('object');
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);
  return value as RecordValue;
}

function list(value: unknown): unknown[] {
  expect(Array.isArray(value)).toBe(true);
  return value as unknown[];
}

function integer(value: unknown): bigint {
  expect(value).toMatch(/^\d+$/);
  return BigInt(value as string);
}

function namedEntry(entries: RecordValue[], id: string): RecordValue {
  const entry = entries.find((candidate) => candidate.id === id);
  expect(entry).toBeDefined();
  return entry as RecordValue;
}

describe('minimal-protocol economic suite', () => {
  it('matches the independent Python model and generated fixture', () => {
    const typeScript = loadTypeScriptEconomicSuite();
    expect(loadPythonEconomicSuite()).toEqual(typeScript);
    expect(loadCommittedEconomicFixture()).toEqual(typeScript);
  });

  it('pins 20M genesis, 980M mining, and the exact sequential floor schedule', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const assumptions = record(root.assumptions);
    expect(assumptions.genesisSupply).toBe('20000000000000000000000000');
    expect(assumptions.miningEmissionAllocation).toBe('980000000000000000000000000');
    expect(assumptions.initialDailyScheduledEmission).toBe('465152749681042811702004');
    expect(assumptions.dailyDecayWad).toBe('999525354337060160');

    const emissions = record(root.emissions);
    expect(record(emissions.scheduleLifetime)).toEqual({
      positiveEpochs: '99884',
      sequentialScheduledTotal: '979999999999999181815005172',
      nominalAllocationResidual: '818184994828',
    });
  });

  it('mints the full schedule for every non-empty epoch and forfeits empty epochs', () => {
    const emissions = record(record(loadTypeScriptEconomicSuite()).emissions);
    const scenarios = list(emissions.participationScenarios).map(record);
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'all-nonempty-large',
      'all-nonempty-one-atom',
      'sporadic-nonempty',
      'long-empty-period',
    ]);

    for (const scenario of scenarios) {
      expect(list(scenario.checkpoints).map((checkpoint) => record(checkpoint).days)).toEqual([
        '365',
        '1460',
        '2920',
        '5840',
        '11680',
      ]);
      for (const checkpoint of list(scenario.checkpoints).map(record)) {
        expect(integer(checkpoint.totalCumulativeMinted)).toBeLessThanOrEqual(1_000_000_000n * 10n ** 18n);
      }
    }

    const large = list(scenarios[0]?.checkpoints).map(record);
    const oneAtom = list(scenarios[1]?.checkpoints).map(record);
    expect(oneAtom.map((checkpoint) => checkpoint.recurringMinted)).toEqual(
      large.map((checkpoint) => checkpoint.recurringMinted),
    );
    expect(integer(oneAtom.at(-1)?.totalUSDGAcceptedRaw)).toBeLessThan(integer(large.at(-1)?.totalUSDGAcceptedRaw));

    const sporadic = list(scenarios[2]?.checkpoints).map(record).at(-1)!;
    expect(integer(sporadic.emptyEpochs)).toBeGreaterThan(0n);
    expect(integer(sporadic.forfeitedScheduled)).toBeGreaterThan(0n);
    expect(integer(sporadic.recurringMinted)).toBeLessThan(integer(large.at(-1)?.recurringMinted));
  });

  it('keeps burns independent from cumulative lifetime mint capacity', () => {
    const emissions = record(record(loadTypeScriptEconomicSuite()).emissions);
    const rows = list(emissions.burnSweep).map(record);
    for (const day of new Set(rows.map((row) => row.days as string))) {
      const group = rows.filter((row) => row.days === day);
      const recurring = group[0]?.recurringMinted;
      expect(group.every((row) => row.recurringMinted === recurring)).toBe(true);
      for (const row of group) {
        expect(integer(row.currentSupply) + integer(row.actualBurn)).toBe(
          20_000_000n * 10n ** 18n + integer(row.recurringMinted),
        );
      }
    }
  });

  it('contains no public bootstrap or 80M miner allocation', () => {
    const genesis = record(record(loadTypeScriptEconomicSuite()).genesisLiquidity);
    expect(genesis.publicBootstrap).toBe(false);
    expect(genesis.constructorMintGBXRaw).toBe('20000000000000000000000000');
    expect(genesis.oneSidedPositionBudgetGBXRaw).toBe(genesis.constructorMintGBXRaw);
    expect(genesis.unusedResidualPolicy).toBe('burn');
    const regression = record(genesis.sixDecimalRegression);
    expect(regression.normalizedOneUSDG).toBe('1000000000000000000');
  });

  it('matches AuctionEngine endpoint, last-second, and next-price clamp behavior', () => {
    const auctions = record(record(loadTypeScriptEconomicSuite()).auctions);
    const curve = list(auctions.curve).map(record);
    expect(curve[0]?.paymentAmount).toBe('100000000000000000000000');
    expect(integer(curve[4]?.paymentAmount)).toBeGreaterThan(0n);
    expect(curve[5]?.paymentAmount).toBe('0');
    expect(curve[6]?.paymentAmount).toBe('0');

    const transitions = list(auctions.transitions).map(record);
    expect(transitions[0]?.nextInitPrice).toBe('200000000000000000000000');
    expect(transitions[2]?.nextInitPrice).toBe('1000000');
    expect(transitions[3]?.nextInitPrice).toBe('1000000');
    const bounds = record(auctions.bounds);
    expect(bounds.minEpochPeriod).toBe('3600');
    expect(bounds.maxEpochPeriod).toBe('31536000');
  });

  it('uses immediate floor-index rewards with uncarried residue and 98/2 routing', () => {
    const rewards = record(record(loadTypeScriptEconomicSuite()).managerRewards);
    const examples = list(rewards.rewardIndexExamples).map(record);
    const dust = namedEntry(examples, 'independent-floor-residue');
    expect(dust.rewardPerWeightIncrement).toBe('33');
    expect(dust.indexedReward).toBe('9');
    expect(dust.residue).toBe('1');

    const yields = list(rewards.rewardYieldByStrategy).map(record);
    const active = yields[0]!;
    const inactive = yields[2]!;
    expect(integer(active.managerReward) * 50n).toBe(integer(active.acquired));
    expect(integer(active.managerReward) + integer(active.vaultGrowth)).toBe(integer(active.acquired));
    expect(inactive.managerReward).toBe('0');
    expect(inactive.vaultGrowth).toBe(inactive.acquired);
  });

  it('conserves strategy budgets, raw redemptions, and buyback supply accounting', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const budget = list(record(root.auctions).budgetAccumulation).map(record);
    let opening = 0n;
    for (const row of budget) {
      expect(opening + integer(row.allocatedUSDGRaw)).toBe(
        integer(row.closingBudgetUSDGRaw) + integer(row.lotSpentUSDGRaw),
      );
      opening = integer(row.closingBudgetUSDGRaw);
    }

    const section = record(root.redemptionAndBuyback);
    for (const source of list(section.revenueSourceComparison).map(record)) {
      expect(integer(source.supplyAfter)).toBe(
        integer(source.startingSupply) + integer(source.emission) - integer(source.gbxBurned),
      );
    }
    const redemptions = list(section.sequentialLargeRedemptions).map(record);
    expect(redemptions.at(-1)?.supplyAfter).toBe('25000000000000000000000000');
  });
});
