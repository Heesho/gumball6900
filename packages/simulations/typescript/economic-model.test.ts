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
    expect(list(slots.oneHourEmissions)).toEqual(['6250000000000000000', '3125000000000000000', '3125000000000000000']);
  });

  it('reconstructs the global TPS when all sixteen slots share one generation', () => {
    const filled = row(row(row(loadTypeScriptEconomicSuite()).mining).allSlotsBeforeHalving);
    const rates = list(filled.assignedRatesPerHour);
    expect(filled.slotCount).toBe('16');
    expect(rates).toHaveLength(16);
    expect(rates[0]).toBe('6250000000000000000');
    expect(rates[15]).toBe('6250000000000000000');
    expect(filled.aggregateBpsOfGlobalRate).toBe('10000');
  });

  it('classifies tiny Strategy payments with the same cumulative 90/10 result as one payment', () => {
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

  it('applies a lower rate only at a later slot handoff and preserves a positive tail', () => {
    const mining = row(row(loadTypeScriptEconomicSuite()).mining);
    const halving = row(mining.handoffHalving);
    expect(integer(halving.incumbentSlotRateAfterThreshold)).toBeGreaterThan(integer(halving.nextReplacementSlotRate));
    expect(integer(halving.aggregateLockedSixteenSlots)).toBeGreaterThan(integer(halving.globalRateAfter));
    const tail = row(mining.infiniteTail);
    expect(integer(tail.annualTailEmission)).toBeGreaterThan(0n);
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
