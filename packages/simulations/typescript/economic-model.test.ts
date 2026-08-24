import { describe, expect, it } from 'vitest';

import {
  loadCommittedEconomicFixture,
  loadPythonEconomicSuite,
  loadTypeScriptEconomicSuite,
} from './economic-fixture-harness.js';

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value as Row;
const list = (value: unknown): unknown[] => value as unknown[];
const integer = (value: unknown): bigint => BigInt(value as string);

describe('multislot Mine economic suite', () => {
  it('matches the independent Python model and committed fixture', () => {
    const typescript = loadTypeScriptEconomicSuite();
    expect(loadPythonEconomicSuite()).toEqual(typescript);
    expect(loadCommittedEconomicFixture()).toEqual(typescript);
  });

  it('pins no-economic-cap supply, 80/20 handoffs, and the one-hour price endpoint', () => {
    const root = row(loadTypeScriptEconomicSuite());
    const assumptions = row(root.assumptions);
    expect(assumptions.infiniteSupply).toBe(true);
    expect(assumptions.priceDecaySeconds).toBe('3600');
    expect(assumptions.previousMinerBps).toBe('8000');
    expect(assumptions.resonanceRevenueBps).toBe('2000');
    expect(assumptions.minePriceMultiplier).toBe('2');
    expect(assumptions.mineMinimumInitialPrice).toBe('1000000');
    expect(assumptions.mineInitialTps).toBe('64000000000000000000');
    expect(assumptions.mineHalvingPeriodSeconds).toBe('5961600');
    expect(assumptions.mineTailTps).toBe('1000000000000000000');
    expect(assumptions.mineTailBoundaryCount).toBe('6');
    expect(assumptions.initialSupplyGBXRaw).toBe('0');
    expect(assumptions.externalLpUsesOrdinaryStrategySettlement).toBe(true);
    expect(assumptions.liquiditySpecificCoreLogic).toBe(false);

    const mining = row(root.mining);
    const curve = list(mining.priceCurve).map(row);
    expect(curve.map((point) => point.priceRaw)).toEqual(['2000000', '1500000', '1000000', '500000', '0']);
    const replacement = list(mining.paymentSplits).map(row)[1]!;
    expect(replacement.previousMiner).toBe('800000');
    expect(replacement.resonance).toBe('200000');
  });

  it('keeps an incumbent TPS fixed when later tenures receive a halved TPS', () => {
    const slots = row(row(row(loadTypeScriptEconomicSuite()).mining).staggeredFixedSlots);
    expect(slots.incumbentRateAfterHalvingPerHour).toBe(slots.incumbentRatePerHour);
    expect(list(slots.oneHourEmissions)).toEqual([
      '14400000000000000000000',
      '7200000000000000000000',
      '7200000000000000000000',
    ]);
  });

  it('derives exact time boundaries, empty-market aging, and the permanent tail independently', () => {
    const schedule = row(row(row(loadTypeScriptEconomicSuite()).mining).timeBasedSchedule);
    const points = list(schedule.points).map(row);
    expect(points.map((point) => [point.elapsedSinceStart, point.globalTps])).toEqual([
      ['5961599', '64000000000000000000'],
      ['5961600', '32000000000000000000'],
      ['11923199', '32000000000000000000'],
      ['11923200', '16000000000000000000'],
      ['35769599', '2000000000000000000'],
      ['35769600', '1000000000000000000'],
      ['5961600000', '1000000000000000000'],
    ]);
    expect(schedule.emptyMarketAtFirstBoundary).toEqual({
      elapsedSinceStart: '5961600',
      totalMined: '0',
      pendingEmission: '0',
      globalTps: '32000000000000000000',
    });

    const boundaries = list(schedule.boundaryRates).map(row);
    expect(boundaries.map((point) => point.globalTps)).toEqual([
      '64000000000000000000',
      '32000000000000000000',
      '16000000000000000000',
      '8000000000000000000',
      '4000000000000000000',
      '2000000000000000000',
      '1000000000000000000',
    ]);
  });

  it('pins synchronized supply separately from turnover-dependent actual issuance', () => {
    const root = row(loadTypeScriptEconomicSuite());
    const synchronized = row(row(root.mining).synchronizedSupply);
    expect(root.schemaVersion).toBe('15');
    expect(synchronized.referenceCase).toBe('synchronized-full-refresh-no-burn');
    expect(synchronized.modelAssumption).toBe(
      'Synchronized full-refresh, no-burn reference: all sixteen slots are occupied from deployment, all sixteen refresh to the prospective rate at every boundary, and all accrued emission is settled. Actual tenure-locked issuance depends on slot occupancy and turnover; this is neither a supply cap nor a forecast.',
    );
    expect(synchronized.tailBoundaryCount).toBe('6');
    expect(synchronized.tailStartsAtSeconds).toBe('35769600');
    expect(synchronized.miningEmissionAtTail).toBe('751161600000000000000000000');
    expect(synchronized.grossSupplyAtTail).toBe('751161600000000000000000000');
    expect(synchronized.minedBpsOfGrossSupplyAtTail).toBe('10000');
    expect(synchronized.annualTailInflationPpmAtTail).toBe('41982');

    expect(
      list(synchronized.boundaryPoints).map((point) => {
        const parsed = row(point);
        return [parsed.boundaryIndex, parsed.globalTps, parsed.grossSupply];
      }),
    ).toEqual([
      ['0', '64000000000000000000', '0'],
      ['1', '32000000000000000000', '381542400000000000000000000'],
      ['2', '16000000000000000000', '572313600000000000000000000'],
      ['3', '8000000000000000000', '667699200000000000000000000'],
      ['4', '4000000000000000000', '715392000000000000000000000'],
      ['5', '2000000000000000000', '739238400000000000000000000'],
      ['6', '1000000000000000000', '751161600000000000000000000'],
    ]);

    const horizons = Object.fromEntries(
      list(synchronized.horizonPoints).map((point) => {
        const parsed = row(point);
        return [parsed.years, parsed.grossSupply];
      }),
    );
    expect(horizons).toEqual({
      '1': '742694400000000000000000000',
      '3': '810000000000000000000000000',
      '5': '873072000000000000000000000',
      '10': '1030752000000000000000000000',
      '40': '1976832000000000000000000000',
    });

    const tailRelativeHorizons = Object.fromEntries(
      list(synchronized.tailRelativeHorizonPoints).map((point) => {
        const parsed = row(point);
        return [parsed.yearsAfterTail, [parsed.grossSupply, parsed.annualTailInflationPpm]];
      }),
    );
    expect(tailRelativeHorizons).toEqual({
      '1': ['782697600000000000000000000', '40291'],
      '2': ['814233600000000000000000000', '38730'],
      '5': ['908841600000000000000000000', '34699'],
      '10': ['1066521600000000000000000000', '29569'],
    });
  });

  it('reconstructs the global TPS when all sixteen slots share one generation', () => {
    const filled = row(row(row(loadTypeScriptEconomicSuite()).mining).allSlotsBeforeHalving);
    const rates = list(filled.assignedRatesPerHour);
    expect(filled.slotCount).toBe('16');
    expect(rates).toHaveLength(16);
    expect(rates[0]).toBe('14400000000000000000000');
    expect(rates[15]).toBe('14400000000000000000000');
    expect(filled.aggregateBpsOfGlobalRate).toBe('10000');
  });

  it('accepts per-purchase flooring instead of carrying tiny Strategy-payment fractions', () => {
    const auction = row(row(loadTypeScriptEconomicSuite()).strategyAuction);
    const tiny = row(auction.tenOneUnitPayments);
    const combined = row(auction.oneCombinedPayment);
    expect(tiny.fundAmount).toBe('10');
    expect(tiny.bribeAmount).toBe('0');
    expect(combined.fundAmount).toBe('9');
    expect(combined.bribeAmount).toBe('1');
    expect(auction.perPurchaseSplitCanDependOnPartitioning).toBe(true);
    expect(auction.directRouterDonation).toBe('7');
  });

  it('applies 10%, 0%, 5%, and 20% independently without split carry', () => {
    const auction = row(row(loadTypeScriptEconomicSuite()).strategyAuction);
    const changed = row(auction.rateChangeSequence);
    expect(changed.bribeBps).toEqual(['1000', '0', '500', '2000']);
    expect(changed.totalPayment).toBe('62');
    expect(changed.fundAmount).toBe('58');
    expect(changed.bribeAmount).toBe('4');

    const zero = row(auction.zeroPercentPayments);
    expect(zero.fundAmount).toBe(zero.totalPayment);
    expect(zero.bribeAmount).toBe('0');
  });

  it('applies a lower rate only at a later slot handoff and preserves a positive tail', () => {
    const mining = row(row(loadTypeScriptEconomicSuite()).mining);
    const halving = row(mining.handoffHalving);
    expect(integer(halving.incumbentSlotRateAfterBoundaryPerHour)).toBeGreaterThan(
      integer(halving.nextReplacementSlotRatePerHour),
    );
    expect(integer(halving.aggregateLockedSixteenSlotsPerHour)).toBeGreaterThan(
      integer(halving.globalRateAfterPerHour),
    );
    const tail = row(mining.infiniteTail);
    expect(tail.annualTailEmission).toBe('31536000000000000000000000');
  });

  it('includes cached pending mining in the redemption denominator without checkpointing', () => {
    const redemption = row(row(loadTypeScriptEconomicSuite()).redemption);
    expect(integer(redemption.effectiveSupplyBeforeBurn)).toBe(
      integer(redemption.mintedSupplyBefore) + integer(redemption.pendingMining),
    );
    expect(integer(redemption.payoutWithEffectiveSupplyRaw)).toBeLessThan(integer(redemption.payoutIgnoringPendingRaw));
  });

  it('reconciles cumulative issuance and burns without a maximum supply', () => {
    const supply = row(row(loadTypeScriptEconomicSuite()).supply);
    expect(supply.maximumSupply).toBeNull();
    expect(integer(supply.totalSupply)).toBe(integer(supply.lifetimeMinted) - integer(supply.lifetimeBurned));
  });
});
