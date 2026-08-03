import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

import { fixturePath, loadPythonResults, loadTypeScriptResults } from './fixture-harness.js';

const typeScriptResults = loadTypeScriptResults();
const pythonResults = loadPythonResults();

assert.deepStrictEqual(pythonResults, typeScriptResults, 'Refusing to write fixtures while reference models diverge');
writeFileSync(fixturePath, `${JSON.stringify(typeScriptResults, null, 2)}\n`, 'utf8');
console.log(`Wrote ${fixturePath}`);
