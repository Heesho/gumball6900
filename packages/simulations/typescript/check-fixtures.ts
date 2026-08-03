import assert from 'node:assert/strict';

import { loadCommittedFixture, loadPythonResults, loadTypeScriptResults } from './fixture-harness.js';

const typeScriptResults = loadTypeScriptResults();
const pythonResults = loadPythonResults();
const committedFixture = loadCommittedFixture();

assert.deepStrictEqual(pythonResults, typeScriptResults, 'Python and TypeScript reference models diverged');
assert.deepStrictEqual(committedFixture, typeScriptResults, 'Committed fixture is stale; run fixtures:generate');

console.log('Reference fixtures match the independent TypeScript and Python models.');
