import assert from 'node:assert/strict';

import {
  loadCommittedEconomicFixture,
  loadPythonEconomicSuite,
  loadTypeScriptEconomicSuite,
} from './economic-fixture-harness.js';

const typeScriptResults = loadTypeScriptEconomicSuite();
assert.deepStrictEqual(loadPythonEconomicSuite(), typeScriptResults, 'Python and TypeScript economic models diverged');
assert.deepStrictEqual(
  loadCommittedEconomicFixture(),
  typeScriptResults,
  'Committed economic fixture is stale; run fixtures:generate',
);
console.log('Section 33 fixtures match the independent TypeScript and Python models.');
