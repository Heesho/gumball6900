import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeEconomicSuite } from './economic-model.js';

export const economicPackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const economicFixturePath = join(economicPackageRoot, 'fixtures', 'economic-scenarios.json');
export const economicChartsDirectory = join(economicPackageRoot, 'charts');

export function loadTypeScriptEconomicSuite() {
  return computeEconomicSuite();
}

export function loadPythonEconomicSuite(): unknown {
  const output = execFileSync('python3', [join(economicPackageRoot, 'python', 'economic_model.py')], {
    encoding: 'utf8',
  });
  return JSON.parse(output) as unknown;
}

export function loadCommittedEconomicFixture(): unknown {
  return JSON.parse(readFileSync(economicFixturePath, 'utf8')) as unknown;
}
