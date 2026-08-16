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

  it('keeps an incumbent rate fixed when capacity expands', () => {
    const capacity = row(row(row(loadTypeScriptEconomicSuite()).mining).capacityExpansion);
    expect(capacity.capacityBefore).toBe('1');
    expect(capacity.capacityAfter).toBe('3');
    expect(capacity.incumbentRateAfterExpansionPerHour).toBe(capacity.incumbentRatePerHour);
    expect(integer(capacity.aggregateOneHourEmission)).toBeGreaterThan(integer(capacity.undividedGlobalRatePerHour));
    expect(list(capacity.oneHourEmissions)).toEqual([
      '100000000000000000000',
      '33333333333333333333',
      '33333333333333333333',
    ]);
  });

  it('quantifies sequential tenure-rate accumulation through the capacity cap', () => {
    const expansion = row(row(row(loadTypeScriptEconomicSuite()).mining).sequentialExpansionToCap);
    const rates = list(expansion.assignedRatesPerHour);
    expect(expansion.capacity).toBe('16');
    expect(rates).toHaveLength(16);
    expect(rates[0]).toBe('100000000000000000000');
    expect(rates[15]).toBe('6250000000000000000');
    expect(expansion.aggregateBpsOfUndividedRate).toBe('33807');
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
    expect(halving.incumbentRateAfterThreshold).toBe(halving.globalRateBefore);
    expect(integer(halving.nextReplacementRateAtCapacityThree)).toBeLessThan(integer(halving.globalRateBefore));
    const tail = row(mining.infiniteTail);
    expect(integer(tail.annualTailEmission)).toBeGreaterThan(0n);
  });

  it('checkpoints pending mining before the redemption denominator', () => {
    const redemption = row(row(loadTypeScriptEconomicSuite()).redemption);
    expect(integer(redemption.denominatorAfterCheckpoint)).toBe(
      integer(redemption.supplyBeforeCheckpoint) + integer(redemption.pendingMining),
    );
    expect(integer(redemption.payoutWithCheckpointRaw)).toBeLessThan(integer(redemption.payoutWithoutCheckpointRaw));
  });

  it('reconciles cumulative issuance and burns without a maximum supply', () => {
    const supply = row(row(loadTypeScriptEconomicSuite()).supply);
    expect(supply.maximumSupply).toBeNull();
    expect(integer(supply.totalSupply)).toBe(integer(supply.lifetimeMinted) - integer(supply.lifetimeBurned));
  });
});
