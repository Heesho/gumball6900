import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderEconomicCharts } from './economic-charts.js';
import { economicChartsDirectory } from './economic-fixture-harness.js';

for (const [filename, expected] of Object.entries(renderEconomicCharts())) {
  const actual = readFileSync(join(economicChartsDirectory, filename), 'utf8');
  assert.equal(actual, expected, `${filename} is stale; run charts:generate`);
}
console.log('Committed SVG charts match the deterministic economic fixture model.');
