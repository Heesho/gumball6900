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

function miningSupply(root: { [key: string]: DecimalJson }): string {
  const synchronized = object(object(root.mining!, 'mining').synchronizedSupply!, 'synchronizedSupply');
  const boundaries = array(synchronized.boundaryPoints, 'boundaryPoints').map((entry) => object(entry, 'boundary'));
  const supplies = boundaries.map((point) => BigInt(string(point.grossSupply, 'grossSupply')));
  const maximum = supplies.at(-1)!;
  const coordinates = supplies.map((supply, index) => {
    const x = 78 + (index * 720) / (supplies.length - 1);
    const y = 410 - Number((supply * 280n) / maximum);
    return { x, y };
  });
  const markers = coordinates
    .map(({ x, y }) => {
      return `  <circle cx="${x}" cy="${y}" r="5" fill="#f7c948"/>`;
    })
    .join('\n');
  const tailSupply = maximum / 10n ** 18n;
  const tailDay = BigInt(string(boundaries.at(-1)!.elapsedSinceStart, 'elapsedSinceStart')) / 86_400n;
  const boundaryLabels = boundaries
    .map((boundary, index) => {
      const day = BigInt(string(boundary.elapsedSinceStart, 'elapsedSinceStart')) / 86_400n;
      const rate = BigInt(string(boundary.globalTps, 'globalTps')) / 10n ** 18n;
      const tenthsOfMillions = (supplies[index]! + 50_000n * 10n ** 18n) / (100_000n * 10n ** 18n);
      const supplyLabel = `${tenthsOfMillions / 10n}.${tenthsOfMillions % 10n}M`;
      const { x, y } = coordinates[index]!;
      return [
        `  <text x="${x}" y="${y - 12}" text-anchor="middle" fill="#f4f7fb" font-family="ui-sans-serif,system-ui" font-size="11">${supplyLabel}</text>`,
        `  <text x="${x}" y="435" text-anchor="middle" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="11">day ${day}</text>`,
        `  <text x="${x}" y="452" text-anchor="middle" fill="#697586" font-family="ui-sans-serif,system-ui" font-size="10">${rate} GBX/s</text>`,
      ].join('\n');
    })
    .join('\n');
  return frame(
    'Synchronized Mine supply path',
    `Full-refresh, no-burn reference: ${tailSupply.toLocaleString('en-US')} GBX at day ${tailDay}; actual issuance depends on turnover`,
    [
      `  <polyline points="${coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}" fill="none" stroke="#f7c948" stroke-width="4"/>`,
      markers,
      boundaryLabels,
    ].join('\n'),
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

function redemptionChart(root: { [key: string]: DecimalJson }): string {
  const redemption = object(root.redemption!, 'redemption');
  const without = BigInt(string(redemption.payoutIgnoringPendingRaw, 'without'));
  const withPending = BigInt(string(redemption.payoutWithEffectiveSupplyRaw, 'with'));
  const maximum = without;
  const heights = [without, withPending].map((value) => Number((value * 280n) / maximum));
  return frame(
    'Pending mining belongs in redemption supply',
    'Fund reads minted supply plus the constant-time pending accumulator; no mining checkpoint is called',
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
    'emissions-supply.svg': miningSupply(root),
    'auction-curve.svg': miningPriceChart(root),
    'gbx-acquisition-burn.svg': redemptionChart(root),
  };
}
