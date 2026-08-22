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
    expect(root.schemaVersion).toBe('13');
    expect(synchronized.referenceCase).toBe('synchronized-full-refresh-no-burn');
    expect(synchronized.modelAssumption).toBe(
      'Synchronized full-refresh, no-burn reference: all sixteen slots are occupied from deployment, all sixteen refresh to the prospective rate at every boundary, and all accrued emission is settled. Actual tenure-locked issuance depends on slot occupancy and turnover; this is neither a supply cap nor a forecast.',
    );
    expect(synchronized.tailBoundaryCount).toBe('6');
    expect(synchronized.tailStartsAtSeconds).toBe('35769600');
    expect(synchronized.miningEmissionAtTail).toBe('751161600000000000000000000');
    expect(synchronized.grossSupplyAtTail).toBe('771161600000000000000000000');
    expect(synchronized.minedBpsOfGrossSupplyAtTail).toBe('9740');
    expect(synchronized.annualTailInflationPpmAtTail).toBe('40894');

    expect(
      list(synchronized.boundaryPoints).map((point) => {
        const parsed = row(point);
        return [parsed.boundaryIndex, parsed.globalTps, parsed.grossSupply];
      }),
    ).toEqual([
      ['0', '64000000000000000000', '20000000000000000000000000'],
      ['1', '32000000000000000000', '401542400000000000000000000'],
      ['2', '16000000000000000000', '592313600000000000000000000'],
      ['3', '8000000000000000000', '687699200000000000000000000'],
      ['4', '4000000000000000000', '735392000000000000000000000'],
      ['5', '2000000000000000000', '759238400000000000000000000'],
      ['6', '1000000000000000000', '771161600000000000000000000'],
    ]);

    const horizons = Object.fromEntries(
      list(synchronized.horizonPoints).map((point) => {
        const parsed = row(point);
        return [parsed.years, parsed.grossSupply];
      }),
    );
    expect(horizons).toEqual({
      '1': '762694400000000000000000000',
      '3': '830000000000000000000000000',
      '5': '893072000000000000000000000',
      '10': '1050752000000000000000000000',
      '40': '1996832000000000000000000000',
    });

    const tailRelativeHorizons = Object.fromEntries(
      list(synchronized.tailRelativeHorizonPoints).map((point) => {
        const parsed = row(point);
        return [parsed.yearsAfterTail, [parsed.grossSupply, parsed.annualTailInflationPpm]];
      }),
    );
    expect(tailRelativeHorizons).toEqual({
      '1': ['802697600000000000000000000', '39287'],
      '2': ['834233600000000000000000000', '37802'],
      '5': ['928841600000000000000000000', '33951'],
      '10': ['1086521600000000000000000000', '29024'],
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

  it('classifies tiny Strategy payments with the same default cumulative 90/10 result as one payment', () => {
    const auction = row(row(loadTypeScriptEconomicSuite()).strategyAuction);
    const tiny = row(auction.tenOneUnitPayments);
    const combined = row(auction.oneCombinedPayment);
    expect(tiny.fundLiability).toBe('9');
    expect(tiny.bribeLiability).toBe('1');
    expect(tiny.splitRemainder).toBe('0');
    expect(tiny.fundLiability).toBe(combined.fundLiability);
    expect(tiny.bribeLiability).toBe(combined.bribeLiability);
    expect(auction.directRouterDonationSurplus).toBe('7');
  });

  it('preserves exact weighted carry through 10%, 0%, 5%, and 20%', () => {
    const auction = row(row(loadTypeScriptEconomicSuite()).strategyAuction);
    const changed = row(auction.rateChangeSequence);
    expect(changed.bribeBps).toEqual(['1000', '0', '500', '2000']);
    expect(changed.totalPayment).toBe('62');
    expect(changed.fundLiability).toBe('56');
    expect(changed.bribeLiability).toBe('6');
    expect(changed.splitRemainder).toBe('2500');

    const zero = row(auction.zeroPercentPayments);
    expect(zero.fundLiability).toBe(zero.totalPayment);
    expect(zero.bribeLiability).toBe('0');
    expect(zero.splitRemainder).toBe('0');
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
