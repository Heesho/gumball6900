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
    firstCase.totalUSDGRaw = 250;

    expect(() => parseReferenceScenarios(scenarios)).toThrow('must be a decimal integer string');
  });

  it('keeps the fixture in the package fixture directory', () => {
    expect(fixturePath.endsWith('/fixtures/reference-results.json')).toBe(true);
  });

  it('quotes canonical 6-decimal USDG into 18-decimal target units', () => {
    const results = loadTypeScriptResults();
    expect(results.usdGDecimals).toBe('6');
    expect(results.targetDecimals).toBe('18');
    expect(results.auctionQuotes[0]?.requiredTargetAmount).toBe('52500000000000000000');
    expect(results.genesisQuotes[0]?.genesisPriceWad).toBe('1000000000000000000');
  });
});
