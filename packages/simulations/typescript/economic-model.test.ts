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

function signedInteger(value: unknown): bigint {
  expect(value).toMatch(/^-?\d+$/);
  return BigInt(value as string);
}

function namedEntry(entries: RecordValue[], id: string): RecordValue {
  const entry = entries.find((candidate) => candidate.id === id);
  expect(entry).toBeDefined();
  return entry as RecordValue;
}

describe('master-spec section 33 economic suite', () => {
  it('matches both the independent Python model and committed fixture', () => {
    const typeScript = loadTypeScriptEconomicSuite();
    expect(loadPythonEconomicSuite()).toEqual(typeScript);
    expect(loadCommittedEconomicFixture()).toEqual(typeScript);
  });

  it('covers every required horizon under four distinct demand paths', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const emissions = record(root.emissions);
    const scenarios = list(emissions.demandScenarios).map(record);
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'fully-funded',
      'fifty-percent-funded',
      'sporadic-demand',
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

    const fullAt32Years = integer(list(scenarios[0]?.checkpoints).map(record).at(-1)?.recurringMinted);
    const halfAt32Years = integer(list(scenarios[1]?.checkpoints).map(record).at(-1)?.recurringMinted);
    expect(halfAt32Years).toBeLessThan(fullAt32Years);
  });

  it('bounds shock responses and conserves supply across the burn sweep', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const emissions = record(root.emissions);
    const traces = list(emissions.priceShockTraces).map(record);

    for (const trace of traces) {
      const points = list(trace.points).map(record);
      for (const [index, point] of points.entries()) {
        const previous = integer(point.previousReferencePrice);
        const clearing = integer(point.effectiveClearingPrice);
        const next = integer(point.nextReferencePrice);
        expect(clearing).toBeGreaterThanOrEqual(integer(point.reservePrice));
        expect(clearing).toBeGreaterThanOrEqual(integer(point.requestedMarketPrice));
        expect(next).toBeGreaterThanOrEqual(previous < clearing ? previous : clearing);
        expect(next).toBeLessThanOrEqual(previous > clearing ? previous : clearing);
        if (index > 0) expect(point.previousReferencePrice).toBe(points[index - 1]?.nextReferencePrice);
      }
    }

    const increase = list(namedEntry(traces, 'large-price-increase').points).map(record);
    expect(
      increase.every(
        (point) =>
          integer(point.nextReferencePrice) > integer(point.previousReferencePrice) &&
          integer(point.nextReferencePrice) < integer(point.requestedMarketPrice),
      ),
    ).toBe(true);

    const decrease = list(namedEntry(traces, 'large-price-decrease').points).map(record);
    expect(
      decrease.every(
        (point) =>
          integer(point.nextReferencePrice) < integer(point.previousReferencePrice) &&
          integer(point.nextReferencePrice) > integer(point.requestedMarketPrice),
      ),
    ).toBe(true);

    const lag = list(namedEntry(traces, 'reference-price-lag').points).map(record);
    expect(integer(lag[5]?.nextReferencePrice)).toBeGreaterThan(integer(lag[5]?.previousReferencePrice));
    expect(integer(lag[6]?.nextReferencePrice)).toBeLessThan(integer(lag[6]?.previousReferencePrice));
    expect(integer(lag[6]?.nextReferencePrice)).toBeGreaterThan(integer(lag[6]?.requestedMarketPrice));

    const burnsByDay = new Map<string, RecordValue[]>();
    for (const row of list(emissions.burnSweep).map(record)) {
      const day = row.days as string;
      burnsByDay.set(day, [...(burnsByDay.get(day) ?? []), row]);
    }

    let genesisSupply: bigint | undefined;
    for (const rows of burnsByDay.values()) {
      expect(rows.map((row) => row.burnRateBps)).toEqual(['0', '5000', '10000', '12500', '15000']);
      const totalMinted = integer(rows[0]?.currentSupply) + integer(rows[0]?.actualBurn);
      for (const [index, row] of rows.entries()) {
        const requested = integer(row.requestedBurn);
        const actual = integer(row.actualBurn);
        const current = integer(row.currentSupply);
        expect(current + actual).toBe(totalMinted);
        expect(actual).toBeLessThanOrEqual(requested);
        expect(actual).toBeLessThanOrEqual(totalMinted);
        if (index > 0) {
          expect(requested).toBeGreaterThanOrEqual(integer(rows[index - 1]?.requestedBurn));
          expect(actual).toBeGreaterThanOrEqual(integer(rows[index - 1]?.actualBurn));
          expect(current).toBeLessThanOrEqual(integer(rows[index - 1]?.currentSupply));
        }
        if (requested >= totalMinted) {
          expect(actual).toBe(totalMinted);
          expect(current).toBe(0n);
        }
      }

      const fullRecurringBurn = rows[2];
      expect(integer(fullRecurringBurn?.actualBurn)).toBe(integer(fullRecurringBurn?.recurringMinted));
      const remainingGenesis = integer(fullRecurringBurn?.currentSupply);
      genesisSupply ??= remainingGenesis;
      expect(remainingGenesis).toBe(genesisSupply);
    }
  });

  it('locks six-decimal USDG normalization and human-WAD auction quote semantics', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const assumptions = record(root.assumptions);
    expect(assumptions.usdGDecimals).toBe('6');
    expect(assumptions.usdGAtomicUnit).toBe('1000000');

    const bootstrap = record(root.bootstrap);
    const regression = record(bootstrap.sixDecimalRegression);
    expect(regression.normalizedOneUSDG).toBe('1000000000000000000');
    expect(regression.oneTargetPerUSDGRate).toBe('1000000000000000000');
    expect(regression.targetRequiredForOneUSDG).toBe('1000000000000000000');

    const emissions = record(root.emissions);
    const rounding = record(emissions.roundingRegressions);
    expect(rounding.solidityTermByTermEma).toBe('100');
    expect(rounding.referenceAfterTwoThousandEmptyEpochs).toBe('1');
    expect(rounding.affordableGBXWeiFromOneRawUSDGAtOneDollar).toBe('1000000000000');
  });

  it('keeps genesis backing and the 20M one-sided ladder internally consistent', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const bootstrap = record(root.bootstrap);
    const eightyMillionRaise = record(list(bootstrap.raises)[2]);
    expect(eightyMillionRaise.communityRaiseUSDGRaw).toBe('80000000000000');
    expect(eightyMillionRaise.sponsorRequirementUSDGRaw).toBe('20000000000000');
    expect(eightyMillionRaise.initialGBXPrice).toBe('1000000000000000000');
    expect(eightyMillionRaise.backingPerGBX).toBe('1000000000000000000');
    expect(eightyMillionRaise.genesisRedemptionUSDGRaw).toBe(eightyMillionRaise.participantContributionUSDGRaw);

    const inventory = list(bootstrap.lpInventory).map(record);
    expect(inventory[0]?.gbxRemaining).toBe('20000000000000000000000000');
    expect(inventory[0]?.usdGRaisedRaw).toBe('0');
    expect(inventory.at(-1)?.gbxRemaining).toBe('0');
    expect(integer(inventory.at(-1)?.usdGRaisedRaw)).toBeGreaterThan(20_000_000n * 10n ** 6n);
  });

  it('models auction expiry, missing liquidity, halts, lots, and retained budgets', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const auctions = record(root.auctions);
    const bounds = record(auctions.bounds);
    expect(bounds.startRate).toBe('1250000000000000000');
    expect(bounds.floorRate).toBe('800000000000000000');

    const availability = list(auctions.driftAndAvailability).map(record);
    expect(availability.find((entry) => entry.id === 'stable-market')?.fillSecond).toBe('48000');
    expect(availability.find((entry) => entry.id === 'missing-market-maker')?.fillSecond).toBeNull();
    expect(availability.find((entry) => entry.id === 'trading-halt-at-crossing')?.budgetRetainedUSDGRaw).toBe(
      '10000000000',
    );

    const midpointLots = list(auctions.lotSizesAtMidpoint).map(record);
    expect(midpointLots[1]?.usdGLotRaw).toBe('10000000000');
    expect(midpointLots[1]?.requiredTarget).toBe('10250000000000000000000');
  });

  it('accumulates and spends strategy budgets without leakage during missing-market and halt days', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const rows = list(record(root.auctions).budgetAccumulation).map(record);
    let openingBudget = 0n;
    let totalAllocated = 0n;
    let totalSpent = 0n;

    for (const [index, row] of rows.entries()) {
      const allocated = integer(row.allocatedUSDGRaw);
      const spent = integer(row.lotSpentUSDGRaw);
      const closing = integer(row.closingBudgetUSDGRaw);
      expect(integer(row.day)).toBe(BigInt(index + 1));
      expect(openingBudget + allocated).toBe(closing + spent);
      expect(spent).toBeLessThanOrEqual(openingBudget + allocated);

      if (row.filled === true) {
        expect(row.makerAvailable).toBe(true);
        expect(row.tradingHalted).toBe(false);
        expect(spent).toBeGreaterThan(0n);
      } else {
        expect(spent).toBe(0n);
      }
      if (row.makerAvailable === false || row.tradingHalted === true) expect(row.filled).toBe(false);

      totalAllocated += allocated;
      totalSpent += spent;
      openingBudget = closing;
    }

    expect(totalAllocated).toBe(totalSpent + openingBudget);
    expect(rows.slice(0, 3).every((row) => row.makerAvailable === false && row.filled === false)).toBe(true);
    const halt = rows.find((row) => row.tradingHalted === true);
    expect(halt?.filled).toBe(false);
  });

  it('makes the 2% manager destination and zero-weight vault redirect explicit', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const rewards = record(root.managerRewards);
    const yields = list(rewards.rewardYieldByStrategy).map(record);
    const active = yields[0];
    const inactive = yields[2];
    expect(integer(active?.managerReward) * 50n).toBe(integer(active?.acquired));
    expect(integer(active?.managerReward) + integer(active?.vaultGrowth)).toBe(integer(active?.acquired));
    expect(inactive?.managerReward).toBe('0');
    expect(inactive?.vaultGrowth).toBe(inactive?.acquired);
    expect(integer(inactive?.redirectedToVault)).toBe(integer(inactive?.acquired) / 50n);

    const activation = list(rewards.activationDelay).map(record);
    expect(activation[1]?.effectiveWeight).toBe('0');
    expect(integer(activation[2]?.effectiveWeight)).toBeGreaterThan(0n);
  });

  it('keeps concentrated rewards, rapid switching, no-lock exits, and vault growth semantically bounded', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const rewards = record(root.managerRewards);

    const concentration = record(rewards.voteConcentration);
    const managers = list(concentration.managers).map(record);
    const totalReward = integer(concentration.totalReward);
    expect(managers.reduce((sum, manager) => sum + integer(manager.weightBps), 0n)).toBe(10_000n);
    expect(managers.reduce((sum, manager) => sum + integer(manager.reward), 0n)).toBe(totalReward);
    for (const manager of managers) {
      expect(integer(manager.reward) * 10_000n).toBe(totalReward * integer(manager.weightBps));
    }
    expect(integer(concentration.hhiBps)).toBeGreaterThan(10_000n / BigInt(managers.length));
    expect(integer(concentration.hhiBps)).toBeLessThan(10_000n);

    const switching = list(rewards.frequentSwitching).map(record);
    for (let index = 1; index < switching.length; index += 1) {
      expect(integer(switching[index]?.hour)).toBeGreaterThan(integer(switching[index - 1]?.hour));
    }
    const delayedFills = switching.filter(
      (row) => String(row.event).includes('before-activation') || String(row.event).includes('during-delay'),
    );
    expect(delayedFills.every((row) => row.activeStrategy === 'none' && integer(row.reward) === 0n)).toBe(true);
    const rewardedFills = switching.filter((row) => integer(row.reward) > 0n);
    expect(rewardedFills.map((row) => row.activeStrategy)).toEqual(['strategy-b', 'strategy-a']);
    expect(integer(rewardedFills[0]?.hour) - integer(switching[0]?.hour)).toBeGreaterThanOrEqual(24n);
    expect(integer(rewardedFills[1]?.hour) - integer(switching[3]?.hour)).toBeGreaterThanOrEqual(24n);

    const churn = record(rewards.noLockStakeChurn);
    const early = record(churn.earlyExit);
    const postActivation = record(churn.postActivationExit);
    expect(integer(early.unstakedAtSecond)).toBeGreaterThan(integer(early.stakedAtSecond));
    expect(integer(early.unstakedAtSecond)).toBeLessThan(integer(postActivation.activatedAtSecond));
    expect(early.activeWeightAtExit).toBe('0');
    expect(early.rewardCaptured).toBe('0');
    expect(integer(early.cancelledPendingWeight)).toBe(integer(postActivation.activeWeightAtFill));
    expect(postActivation.unstakedAtSecond).toBe(postActivation.filledAtSecond);
    expect(postActivation.unstakedAtSecond).toBe(postActivation.activatedAtSecond);
    expect(integer(postActivation.accruedRewardAfterUnstake)).toBeGreaterThan(0n);

    const leakage = list(rewards.rewardLeakageVsVaultGrowth).map(record);
    const perFillAcquisitions = leakage.map((row) => integer(row.acquired) / integer(row.fillCount));
    expect(perFillAcquisitions.every((amount) => amount === perFillAcquisitions[0])).toBe(true);
    for (const row of leakage) {
      const acquired = integer(row.acquired);
      const managerReward = integer(row.managerReward);
      const vaultGrowth = integer(row.vaultGrowth);
      expect(managerReward + vaultGrowth).toBe(acquired);
      if (managerReward > 0n) {
        expect(managerReward * 50n).toBe(acquired);
        expect(vaultGrowth * 50n).toBe(acquired * 49n);
        expect(row.redirectedToVault).toBe('0');
      } else {
        expect(vaultGrowth).toBe(acquired);
        expect(integer(row.redirectedToVault) * 50n).toBe(acquired);
      }
    }
  });

  it('distinguishes accretive and dilutive buybacks and preserves pro-rata redemptions', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const section = record(root.redemptionAndBuyback);
    const buybacks = list(section.marketRelativeToBacking).map(record);
    expect(integer(buybacks[0]?.backingPerGBXAfter)).toBeGreaterThan(integer(buybacks[0]?.backingPerGBXBefore));
    expect(integer(buybacks[1]?.backingPerGBXAfter)).toBeLessThan(integer(buybacks[1]?.backingPerGBXBefore));

    const redemptions = list(section.sequentialLargeRedemptions).map(record);
    expect(redemptions.map((entry) => entry.supplyAfter)).toEqual([
      '80000000000000000000000000',
      '50000000000000000000000000',
      '25000000000000000000000000',
    ]);
    const finalBalances = record(redemptions.at(-1)?.balancesAfter);
    expect(finalBalances.USDG).toBe('25000000000000');
  });

  it('accounts independently for revenue-funded burns and simultaneous emission and burn', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const section = record(root.redemptionAndBuyback);
    const sources = list(section.revenueSourceComparison).map(record);

    for (const source of sources) {
      expect(integer(source.supplyAfter)).toBe(
        integer(source.startingSupply) + integer(source.emission) - integer(source.gbxBurned),
      );
      expect(integer(source.vaultValueAfterUSDGRaw)).toBe(
        integer(source.startingVaultValueUSDGRaw) +
          integer(source.revenueUSDGRaw) -
          integer(source.buybackSpendUSDGRaw),
      );
      expect(integer(source.buybackSpendUSDGRaw)).toBeLessThanOrEqual(integer(source.revenueUSDGRaw));
      expect(integer(source.gbxBurned)).toBeGreaterThan(0n);
    }

    const mining = namedEntry(sources, 'mining-revenue');
    const lpFees = namedEntry(sources, 'lp-fee-revenue');
    expect(mining.buybackSpendUSDGRaw).toBe(lpFees.buybackSpendUSDGRaw);
    expect(mining.marketPrice).toBe(lpFees.marketPrice);
    expect(mining.gbxBurned).toBe(lpFees.gbxBurned);
    expect(integer(mining.supplyAfter)).toBeGreaterThan(integer(mining.startingSupply));
    expect(integer(lpFees.supplyAfter)).toBeLessThan(integer(lpFees.startingSupply));
    expect(integer(mining.vaultValueAfterUSDGRaw)).toBeGreaterThan(integer(mining.startingVaultValueUSDGRaw));
    expect(lpFees.vaultValueAfterUSDGRaw).toBe(lpFees.startingVaultValueUSDGRaw);
    expect(integer(lpFees.backingPerGBXAfter)).toBeGreaterThan(integer(mining.backingPerGBXAfter));

    const simultaneous = list(section.simultaneousEmissionAndBurn).map(record);
    for (const [index, row] of simultaneous.entries()) {
      const netChange = signedInteger(row.netSupplyChange);
      expect(netChange).toBe(integer(row.emission) - integer(row.burn));
      expect(integer(row.supplyAfter)).toBe(integer(row.startingSupply) + netChange);
      if (index > 0) {
        expect(integer(row.burn)).toBeGreaterThan(integer(simultaneous[index - 1]?.burn));
        expect(integer(row.supplyAfter)).toBeLessThan(integer(simultaneous[index - 1]?.supplyAfter));
      }
    }
    const neutral = simultaneous.find((row) => row.burnRateBps === '10000');
    const netBurn = simultaneous.find((row) => signedInteger(row.netSupplyChange) < 0n);
    expect(neutral?.netSupplyChange).toBe('0');
    expect(neutral?.supplyAfter).toBe(neutral?.startingSupply);
    expect(integer(netBurn?.supplyAfter)).toBeLessThan(integer(netBurn?.startingSupply));
  });

  it('conserves the fully backed LP inventory while sales and USDG proceeds move monotonically', () => {
    const root = record(loadTypeScriptEconomicSuite());
    const section = record(root.redemptionAndBuyback);
    const inventory = list(section.lpInventorySoldOverTime).map(record);
    const totalInventory = integer(inventory[0]?.gbxRemaining) + integer(inventory[0]?.gbxSold);

    for (const [index, row] of inventory.entries()) {
      const positions = list(row.positions).map(record);
      expect(integer(row.gbxRemaining) + integer(row.gbxSold)).toBe(totalInventory);
      expect(positions.reduce((sum, position) => sum + integer(position.gbxAllocation), 0n)).toBe(totalInventory);
      expect(positions.reduce((sum, position) => sum + integer(position.gbxRemaining), 0n)).toBe(
        integer(row.gbxRemaining),
      );
      expect(positions.reduce((sum, position) => sum + integer(position.usdGRaisedWad), 0n)).toBe(
        integer(row.usdGRaisedWad),
      );
      expect(positions.reduce((sum, position) => sum + integer(position.usdGRaisedRaw), 0n)).toBe(
        integer(row.usdGRaisedRaw),
      );
      for (const position of positions) {
        expect(integer(position.gbxRemaining)).toBeLessThanOrEqual(integer(position.gbxAllocation));
        if (integer(row.priceMultipleWad) <= integer(position.lowerPriceMultipleWad)) {
          expect(position.gbxRemaining).toBe(position.gbxAllocation);
          expect(position.usdGRaisedWad).toBe('0');
        }
        if (integer(row.priceMultipleWad) >= integer(position.upperPriceMultipleWad)) {
          expect(position.gbxRemaining).toBe('0');
        }
      }
      if (index > 0) {
        expect(integer(row.priceMultipleWad)).toBeGreaterThan(integer(inventory[index - 1]?.priceMultipleWad));
        expect(integer(row.gbxSold)).toBeGreaterThan(integer(inventory[index - 1]?.gbxSold));
        expect(integer(row.gbxRemaining)).toBeLessThan(integer(inventory[index - 1]?.gbxRemaining));
        expect(integer(row.usdGRaisedRaw)).toBeGreaterThan(integer(inventory[index - 1]?.usdGRaisedRaw));
      }
    }

    expect(inventory[0]?.gbxSold).toBe('0');
    expect(inventory[0]?.usdGRaisedRaw).toBe('0');
    expect(inventory.at(-1)?.gbxRemaining).toBe('0');
    expect(integer(inventory.at(-1)?.gbxSold)).toBe(totalInventory);
  });
});
