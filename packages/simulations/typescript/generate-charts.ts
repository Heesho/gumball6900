import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderEconomicCharts } from './economic-charts.js';
import { economicChartsDirectory } from './economic-fixture-harness.js';

mkdirSync(economicChartsDirectory, { recursive: true });
for (const [filename, content] of Object.entries(renderEconomicCharts())) {
  writeFileSync(join(economicChartsDirectory, filename), content, 'utf8');
  console.log(`Wrote ${join(economicChartsDirectory, filename)}`);
}
