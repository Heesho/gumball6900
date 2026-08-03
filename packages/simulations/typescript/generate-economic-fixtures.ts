import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

import {
  economicFixturePath,
  loadPythonEconomicSuite,
  loadTypeScriptEconomicSuite,
} from './economic-fixture-harness.js';

const typeScriptResults = loadTypeScriptEconomicSuite();
const pythonResults = loadPythonEconomicSuite();
assert.deepStrictEqual(
  pythonResults,
  typeScriptResults,
  'refusing to write a fixture while TypeScript and Python diverge',
);
writeFileSync(economicFixturePath, `${JSON.stringify(typeScriptResults, null, 2)}\n`, 'utf8');
console.log(`Wrote ${economicFixturePath}`);
