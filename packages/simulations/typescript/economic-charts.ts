import { computeEconomicSuite, type DecimalJson } from './economic-model.js';

const WAD = 10n ** 18n;

function object(value: DecimalJson, label: string): { [key: string]: DecimalJson } {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError(`${label} must be an object`);
  return value;
}

function array(value: DecimalJson | undefined, label: string): DecimalJson[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function string(value: DecimalJson | undefined, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`);
  return value;
}

function frame(title: string, subtitle: string, body: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="840" height="500" viewBox="0 0 840 500" role="img">',
    '  <rect width="840" height="500" rx="18" fill="#0b0d12"/>',
    `  <text x="42" y="46" fill="#f4f7fb" font-family="ui-sans-serif,system-ui" font-size="24" font-weight="700">${title}</text>`,
    `  <text x="42" y="72" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="13">${subtitle}</text>`,
    '  <line x1="78" y1="410" x2="798" y2="410" stroke="#394150"/>',
    '  <line x1="78" y1="100" x2="78" y2="410" stroke="#394150"/>',
    body,
    '  <text x="798" y="474" text-anchor="end" fill="#697586" font-family="ui-sans-serif,system-ui" font-size="11">Mechanics scenario — not an investment projection</text>',
    '</svg>',
    '',
  ].join('\n');
}

function polyline(points: Array<{ x: bigint; y: bigint }>, color: string): string {
  const encoded = points.map(({ x, y }) => `${x},${y}`).join(' ');
  return `  <polyline points="${encoded}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function emissionChart(root: { [key: string]: DecimalJson }): string {
  const emissions = object(root.emissions!, 'emissions');
  const scenarios = array(emissions.demandScenarios, 'demandScenarios');
  const colors = ['#f7c948', '#56b4e9', '#9bdb7c', '#f27d8a'];
  const parts: string[] = [];
  scenarios.forEach((entry, scenarioIndex) => {
    const scenario = object(entry, 'demandScenario');
    const checkpoints = array(scenario.checkpoints, 'checkpoints');
    const points = checkpoints.map((checkpoint, index) => {
      const parsed = object(checkpoint, 'checkpoint');
      const supply = BigInt(string(parsed.totalCumulativeMinted, 'totalCumulativeMinted'));
      return { x: 108n + BigInt(index) * 165n, y: 410n - (supply * 300n) / (1_000_000_000n * WAD) };
    });
    const color = colors[scenarioIndex] ?? '#ffffff';
    parts.push(polyline(points, color));
    parts.push(
      `  <text x="${120 + scenarioIndex * 175}" y="455" fill="${color}" font-family="ui-sans-serif,system-ui" font-size="12">${string(scenario.id, 'id')}</text>`,
    );
  });
  ['1y', '4y', '8y', '16y', '32y'].forEach((label, index) => {
    parts.push(
      `  <text x="${108 + index * 165}" y="430" text-anchor="middle" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="11">${label}</text>`,
    );
  });
  return frame(
    'Cumulative supply by demand path',
    'Genesis supply plus recurring emissions; cumulative mint cap = 1B GBX',
    parts.join('\n'),
  );
}

function auctionChart(root: { [key: string]: DecimalJson }): string {
  const auctions = object(root.auctions!, 'auctions');
  const curve = array(auctions.curve, 'curve');
  const points = curve.map((entry) => {
    const point = object(entry, 'curve point');
    const elapsed = BigInt(string(point.elapsedSeconds, 'elapsedSeconds'));
    const rate = BigInt(string(point.rate, 'rate'));
    return {
      x: 78n + (elapsed * 720n) / 86_400n,
      y: 410n - ((rate - 750_000_000_000_000_000n) * 300n) / 550_000_000_000_000_000n,
    };
  });
  const labels = curve
    .map((entry) => object(entry, 'curve point'))
    .map(
      (point, index) =>
        `  <text x="${78 + index * 180}" y="432" text-anchor="middle" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="11">${BigInt(string(point.elapsedSeconds, 'elapsedSeconds')) / 3_600n}h</text>`,
    );
  return frame(
    'Oracleless reverse Dutch auction',
    'Required target units per USDG decline linearly from 125% to the nonzero 80% floor',
    [
      polyline(points, '#f7c948'),
      ...labels,
      '  <text x="90" y="112" fill="#f7c948" font-family="ui-sans-serif,system-ui" font-size="12">1.25×</text>',
      '  <text x="748" y="402" fill="#f7c948" font-family="ui-sans-serif,system-ui" font-size="12">0.80×</text>',
    ].join('\n'),
  );
}

function liquidityChart(root: { [key: string]: DecimalJson }): string {
  const bootstrap = object(root.bootstrap!, 'bootstrap');
  const inventory = array(bootstrap.lpInventory, 'lpInventory');
  const points = inventory.map((entry, index) => {
    const state = object(entry, 'inventory point');
    const remaining = BigInt(string(state.gbxRemaining, 'gbxRemaining'));
    return { x: 90n + BigInt(index) * 116n, y: 410n - (remaining * 300n) / (20_000_000n * WAD) };
  });
  const labels = inventory.map((entry, index) => {
    const state = object(entry, 'inventory point');
    const multiple = BigInt(string(state.priceMultipleWad, 'priceMultipleWad'));
    const whole = multiple / WAD;
    const fraction = ((multiple % WAD) * 100n) / WAD;
    const display = fraction === 0n ? `${whole}×` : `${whole}.${fraction.toString().padStart(2, '0')}×`;
    return `  <text x="${90 + index * 116}" y="432" text-anchor="middle" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="11">${display}</text>`;
  });
  return frame(
    'Protocol-owned LP inventory',
    '20M fully backed GBX sells progressively through the fixed one-sided range ladder',
    [polyline(points, '#56b4e9'), ...labels].join('\n'),
  );
}

function buybackChart(root: { [key: string]: DecimalJson }): string {
  const redemption = object(root.redemptionAndBuyback!, 'redemptionAndBuyback');
  const cases = array(redemption.marketRelativeToBacking, 'marketRelativeToBacking');
  const parts: string[] = [];
  cases.forEach((entry, index) => {
    const scenario = object(entry, 'buyback scenario');
    const before = BigInt(string(scenario.backingPerGBXBefore, 'backingPerGBXBefore'));
    const after = BigInt(string(scenario.backingPerGBXAfter, 'backingPerGBXAfter'));
    const x = 190 + index * 360;
    const beforeHeight = Number((before * 240n) / (12n * 10n ** 17n));
    const afterHeight = Number((after * 240n) / (12n * 10n ** 17n));
    parts.push(
      `  <rect x="${x}" y="${410 - beforeHeight}" width="72" height="${beforeHeight}" rx="6" fill="#697586"/>`,
    );
    parts.push(
      `  <rect x="${x + 92}" y="${410 - afterHeight}" width="72" height="${afterHeight}" rx="6" fill="#f7c948"/>`,
    );
    parts.push(
      `  <text x="${x + 82}" y="437" text-anchor="middle" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="12">${string(scenario.id, 'id')}</text>`,
    );
  });
  parts.push(
    '  <text x="620" y="112" fill="#697586" font-family="ui-sans-serif,system-ui" font-size="12">before</text>',
  );
  parts.push(
    '  <text x="690" y="112" fill="#f7c948" font-family="ui-sans-serif,system-ui" font-size="12">after</text>',
  );
  return frame(
    'Buyback price versus basket backing',
    'Spending below backing is accretive; spending above backing is dilutive in this explicit offchain valuation scenario',
    parts.join('\n'),
  );
}

export function renderEconomicCharts(): Record<string, string> {
  const suite = object(computeEconomicSuite(), 'economic suite');
  return {
    'emissions-supply.svg': emissionChart(suite),
    'auction-curve.svg': auctionChart(suite),
    'bootstrap-liquidity.svg': liquidityChart(suite),
    'buyback-backing.svg': buybackChart(suite),
  };
}
