import { computeEconomicSuite, type DecimalJson } from './economic-model.js';

function object(value: DecimalJson, label: string): { [key: string]: DecimalJson } {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError(`${label} must be object`);
  return value;
}

function array(value: DecimalJson | undefined, label: string): DecimalJson[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be array`);
  return value;
}

function string(value: DecimalJson | undefined, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be string`);
  return value;
}

function frame(title: string, subtitle: string, body: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="840" height="500" viewBox="0 0 840 500" role="img">',
    '  <rect width="840" height="500" rx="18" fill="#0b0d12"/>',
    `  <text x="42" y="46" fill="#f4f7fb" font-family="ui-sans-serif,system-ui" font-size="24" font-weight="700">${title}</text>`,
    `  <text x="42" y="72" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="13">${subtitle}</text>`,
    '  <line x1="78" y1="410" x2="798" y2="410" stroke="#394150"/>',
    body,
    '  <text x="798" y="474" text-anchor="end" fill="#697586" font-family="ui-sans-serif,system-ui" font-size="11">Mechanics scenario — not an investment projection</text>',
    '</svg>',
    '',
  ].join('\n');
}

function miningRates(root: { [key: string]: DecimalJson }): string {
  const expansion = object(object(root.mining!, 'mining').capacityExpansion!, 'capacityExpansion');
  const emissions = array(expansion.oneHourEmissions, 'oneHourEmissions').map((value) => BigInt(string(value, 'rate')));
  const maximum = emissions[0]!;
  const colors = ['#f7c948', '#56b4e9', '#56b4e9'];
  const bars = emissions.map((amount, index) => {
    const height = Number((amount * 280n) / maximum);
    const x = 170 + index * 190;
    return [
      `  <rect x="${x}" y="${410 - height}" width="100" height="${height}" rx="8" fill="${colors[index]}"/>`,
      `  <text x="${x + 50}" y="435" text-anchor="middle" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="12">${index === 0 ? 'incumbent' : `new slot ${index}`}</text>`,
    ].join('\n');
  });
  return frame(
    'Capacity expansion preserves incumbent rate',
    'The occupied slot keeps 100 GBX/hour; newly filled slots receive the current rate divided by capacity',
    bars.join('\n'),
  );
}

function miningPriceChart(root: { [key: string]: DecimalJson }): string {
  const curve = array(object(root.mining!, 'mining').priceCurve, 'priceCurve');
  const points = curve.map((entry) => {
    const point = object(entry, 'point');
    const elapsed = BigInt(string(point.elapsedSeconds, 'elapsedSeconds'));
    const price = BigInt(string(point.priceRaw, 'priceRaw'));
    return `${78n + (elapsed * 720n) / 3_600n},${410n - (price * 280n) / 2_000_000n}`;
  });
  return frame(
    'Hourly Mine replacement price',
    'Each slot falls linearly to zero over one hour and can be replaced at any time',
    `  <polyline points="${points.join(' ')}" fill="none" stroke="#f7c948" stroke-width="4"/>`,
  );
}

function genesisChart(root: { [key: string]: DecimalJson }): string {
  const genesis = object(root.genesisLiquidity!, 'genesisLiquidity');
  const allocation = BigInt(string(genesis.genesisLiquidityAllocationGBXRaw, 'allocation'));
  const height = Number((allocation * 280n) / (20_000_000n * 10n ** 18n));
  return frame(
    'Genesis liquidity allocation',
    'Only 20M GBX is precreated; all later GBX is minted by the permanently bound Mine',
    `  <rect x="330" y="${410 - height}" width="180" height="${height}" rx="8" fill="#56b4e9"/>`,
  );
}

function redemptionChart(root: { [key: string]: DecimalJson }): string {
  const redemption = object(root.redemption!, 'redemption');
  const without = BigInt(string(redemption.payoutWithoutCheckpointRaw, 'without'));
  const withCheckpoint = BigInt(string(redemption.payoutWithCheckpointRaw, 'with'));
  const maximum = without;
  const heights = [without, withCheckpoint].map((value) => Number((value * 280n) / maximum));
  return frame(
    'Pending mining belongs in redemption supply',
    'Fund checkpoints every live slot before taking the common pre-burn denominator',
    heights
      .map(
        (height, index) =>
          `  <rect x="${260 + index * 220}" y="${410 - height}" width="120" height="${height}" rx="8" fill="${index === 0 ? '#697586' : '#f7c948'}"/>`,
      )
      .join('\n'),
  );
}

export function renderEconomicCharts(): Record<string, string> {
  const root = object(computeEconomicSuite(), 'suite');
  return {
    'emissions-supply.svg': miningRates(root),
    'auction-curve.svg': miningPriceChart(root),
    'genesis-liquidity.svg': genesisChart(root),
    'gbx-acquisition-burn.svg': redemptionChart(root),
  };
}
