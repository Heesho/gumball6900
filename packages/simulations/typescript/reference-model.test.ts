import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  fixturePath,
  loadCommittedFixture,
  loadPythonResults,
  loadTypeScriptResults,
  scenarioPath,
} from './fixture-harness.js';
import { parseReferenceScenarios } from './reference-model.js';

describe('Mine reference model', () => {
  it('matches both the independent Python result and committed fixture', () => {
    const typescript = loadTypeScriptResults();
    expect(loadPythonResults()).toEqual(typescript);
    expect(loadCommittedFixture()).toEqual(typescript);
  });

  it('pins rate protection, 80/20 payment, hourly zero, and effective supply', () => {
    const results = loadTypeScriptResults();
    expect(results.infiniteSupply).toBe(true);
    expect(results.initialSupply).toBe('0');
    expect(results.miningQuotes[0]).toMatchObject({
      price: '1000000',
      previousMinerAmount: '800000',
      resonanceAmount: '200000',
    });
    expect(results.miningQuotes[1]?.price).toBe('0');
    expect(results.miningQuotes[1]?.slotEmissions[0]).toBe('14400000000000000000000');
    expect(results.miningQuotes[1]?.nextGlobalTps).toBe('32000000000000000000');
  });

  it('pins exact time boundaries and the tail independently of occupancy', () => {
    const rates = Object.fromEntries(
      loadTypeScriptResults().miningQuotes.map((quote) => [quote.id, quote.nextGlobalTps]),
    );
    expect(rates).toMatchObject({
      'just-before-first-time-boundary': '64000000000000000000',
      'protected-staggered-halving': '32000000000000000000',
      'just-before-second-time-boundary': '32000000000000000000',
      'at-second-time-boundary': '16000000000000000000',
      'just-before-tail-time-boundary': '2000000000000000000',
      'at-tail-time-boundary': '1000000000000000000',
      'far-after-tail': '1000000000000000000',
      'ten-years-synchronized-supply': '1000000000000000000',
    });
  });

  it('pins synchronized full-occupancy supply without treating it as guaranteed turnover', () => {
    const quotes = Object.fromEntries(loadTypeScriptResults().miningQuotes.map((quote) => [quote.id, quote]));
    expect(quotes['at-tail-time-boundary']).toMatchObject({
      synchronizedMiningEmission: '751161600000000000000000000',
      synchronizedGrossSupply: '751161600000000000000000000',
    });
    expect(quotes['ten-years-synchronized-supply']).toMatchObject({
      synchronizedMiningEmission: '1030752000000000000000000000',
      synchronizedGrossSupply: '1030752000000000000000000000',
    });
  });

  it('matches per-purchase default-rate acquired-asset classification', () => {
    const quote = loadTypeScriptResults().auctionQuotes[0];
    expect(quote).toMatchObject({
      fundAmount: '37800000000000000000',
      bribeAmount: '4200000000000000000',
      partitionFundAmount: '37800000000000000002',
      partitionBribeAmount: '4199999999999999998',
    });
  });

  it('matches independently floored classification across governance rate changes', () => {
    const quote = loadTypeScriptResults().auctionQuotes[1];
    expect(quote).toMatchObject({
      partitionBribeBasisPoints: ['1000', '0', '500', '2000'],
      partitionFundAmount: '58',
      partitionBribeAmount: '4',
    });
  });

  it('rejects numeric financial inputs that could lose precision', () => {
    const scenarios = JSON.parse(readFileSync(scenarioPath, 'utf8')) as Record<string, unknown>;
    const first = (scenarios.miningCases as Array<Record<string, unknown>>)[0]!;
    first.initialPrice = 2_000_000;
    expect(() => parseReferenceScenarios(scenarios)).not.toThrow();
    first.id = '';
    expect(() => parseReferenceScenarios(scenarios)).toThrow('non-empty string');
  });

  it('keeps the fixture in the package fixture directory', () => {
    expect(fixturePath.endsWith('/fixtures/reference-results.json')).toBe(true);
  });
});
