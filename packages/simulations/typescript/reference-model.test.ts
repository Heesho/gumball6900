import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { fixturePath, loadCommittedFixture, loadTypeScriptResults, scenarioPath } from './fixture-harness.js';
import { parseReferenceScenarios } from './reference-model.js';

describe('TypeScript economic reference model', () => {
  it('matches the committed decimal-string fixture', () => {
    expect(loadTypeScriptResults()).toEqual(loadCommittedFixture());
  });

  it('covers all required long-horizon checkpoints including 100 years', () => {
    const results = loadTypeScriptResults();
    expect(results.emissionHorizons.map(({ days }) => days)).toEqual(['365', '1460', '2920', '5840', '11680', '36500']);
    expect(results.emissionDaily100YearDigest).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('rejects numeric financial inputs that could lose precision', () => {
    const scenarios = JSON.parse(readFileSync(scenarioPath, 'utf8')) as Record<string, unknown>;
    const miningCases = scenarios.miningCases as Array<Record<string, unknown>>;
    const firstCase = miningCases[0];
    if (firstCase === undefined) {
      throw new Error('expected a mining scenario');
    }
    firstCase.totalContributedRaw = 250;

    expect(() => parseReferenceScenarios(scenarios)).toThrow('must be a decimal integer string');
  });

  it('keeps the fixture in the package fixture directory', () => {
    expect(fixturePath.endsWith('/fixtures/reference-results.json')).toBe(true);
  });

  it('retains explicit token-decimal metadata and exact auction endpoints', () => {
    const results = loadTypeScriptResults();
    expect(results.usdGDecimals).toBe('6');
    expect(results.targetDecimals).toBe('18');
    expect(results.auctionQuotes.map(({ paymentAmount }) => paymentAmount)).toEqual([
      '100000000000000000000',
      '50000000000000000000',
      '1157407407407408',
      '0',
      '0',
    ]);
  });

  it('pins the 20M genesis, 980M schedule, and empty/non-empty settlement semantics', () => {
    const results = loadTypeScriptResults();
    expect(results.genesisSupply).toBe('20000000000000000000000000');
    expect(results.miningEmissionAllocation).toBe('980000000000000000000000000');
    expect(results.initialDailyScheduledEmission).toBe('465152749681042811702004');
    expect(results.emissionDaily100YearDigest).toBe(
      '0x22aef4fca7057d13da902b2bd05d3fd4b3bca71cb0e4c3ca4c35a1898f2a41db',
    );
    expect(results.emissionScheduleLifetime).toEqual({
      positiveEpochs: '99884',
      sequentialScheduledTotal: '979999999999999181815005172',
      nominalAllocationResidual: '818184994828',
    });
    expect(results.miningQuotes[0]?.actualEmission).toBe(results.miningQuotes[1]?.actualEmission);
    expect(results.miningQuotes[2]?.actualEmission).toBe('0');
    expect(results.miningQuotes[2]?.forfeitedEmission).toBe('100000000000000000000');
  });
});
