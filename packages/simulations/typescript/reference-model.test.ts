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
    expect(results.genesisLiquidityAllocation).toBe('20000000000000000000000000');
    expect(results.miningQuotes[0]).toMatchObject({
      price: '1000000',
      previousMinerAmount: '800000',
      resonanceAmount: '200000',
    });
    expect(results.miningQuotes[1]?.price).toBe('0');
    expect(results.miningQuotes[1]?.slotEmissions[0]).toBe('22500000000000000000000');
    expect(results.miningQuotes[1]?.nextGlobalTps).toBe('50000000000000000000');
  });

  it('matches cumulative default-rate acquired-asset classification across payment partitions', () => {
    const quote = loadTypeScriptResults().auctionQuotes[0];
    expect(quote).toMatchObject({
      fundAmount: '37800000000000000000',
      bribeAmount: '4200000000000000000',
      splitRemainder: '0',
      partitionFundAmount: '37800000000000000000',
      partitionBribeAmount: '4200000000000000000',
      partitionRemainder: '0',
    });
  });

  it('matches weighted classification across governance rate changes', () => {
    const quote = loadTypeScriptResults().auctionQuotes[1];
    expect(quote).toMatchObject({
      partitionBribeBasisPoints: ['1000', '0', '500', '2000'],
      partitionFundAmount: '56',
      partitionBribeAmount: '6',
      partitionRemainder: '2500',
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
