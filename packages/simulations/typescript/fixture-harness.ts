import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeReferenceResults, parseReferenceScenarios } from './reference-model.js';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const scenarioPath = join(packageRoot, 'scenarios', 'reference-cases.json');
export const fixturePath = join(packageRoot, 'fixtures', 'reference-results.json');

export function loadTypeScriptResults() {
  const scenarios = parseReferenceScenarios(JSON.parse(readFileSync(scenarioPath, 'utf8')) as unknown);
  return computeReferenceResults(scenarios);
}

export function loadPythonResults(): unknown {
  const output = execFileSync('python3', [join(packageRoot, 'python', 'reference_model.py'), scenarioPath], {
    encoding: 'utf8',
  });
  return JSON.parse(output) as unknown;
}

export function loadCommittedFixture(): unknown {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;
}
