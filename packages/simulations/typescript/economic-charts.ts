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
  const scenarios = array(emissions.participationScenarios, 'participationScenarios');
  const colors = ['#f7c948', '#56b4e9', '#9bdb7c', '#f27d8a'];
  const parts: string[] = [];
  scenarios.forEach((entry, scenarioIndex) => {
    const scenario = object(entry, 'participationScenario');
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
    'Cumulative supply by participation path',
    'Every non-empty day receives its full schedule; empty days forfeit it; cumulative mint cap = 1B GBX',
    parts.join('\n'),
  );
}

function auctionChart(root: { [key: string]: DecimalJson }): string {
  const auctions = object(root.auctions!, 'auctions');
  const curve = array(auctions.curve, 'curve');
  const initialPayment = BigInt(string(object(curve[0]!, 'initial curve point').paymentAmount, 'paymentAmount'));
  const points = curve.map((entry) => {
    const point = object(entry, 'curve point');
    const elapsed = BigInt(string(point.elapsedSeconds, 'elapsedSeconds'));
    const paymentAmount = BigInt(string(point.paymentAmount, 'paymentAmount'));
    return {
      x: 78n + (elapsed * 720n) / 86_400n,
      y: 410n - (paymentAmount * 300n) / initialPayment,
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
    'Raw target payment declines linearly from initPrice to zero; the endpoint and later times quote zero',
    [
      polyline(points, '#f7c948'),
      ...labels,
      '  <text x="90" y="112" fill="#f7c948" font-family="ui-sans-serif,system-ui" font-size="12">initPrice</text>',
      '  <text x="748" y="402" fill="#f7c948" font-family="ui-sans-serif,system-ui" font-size="12">zero</text>',
    ].join('\n'),
  );
}

function liquidityChart(root: { [key: string]: DecimalJson }): string {
  const genesis = object(root.genesisLiquidity!, 'genesisLiquidity');
  const allocation = BigInt(string(genesis.constructorMintGBXRaw, 'constructorMintGBXRaw'));
  const height = Number((allocation * 300n) / (20_000_000n * WAD));
  return frame(
    'Deployment-script genesis liquidity',
    'The one-time 20M constructor mint is budgeted to one hookless, one-sided position; unusable residue is burned',
    [
      `  <rect x="330" y="${410 - height}" width="180" height="${height}" rx="8" fill="#56b4e9"/>`,
      '  <text x="420" y="432" text-anchor="middle" fill="#9aa4b2" font-family="ui-sans-serif,system-ui" font-size="11">20M GBX constructor mint</text>',
      '  <text x="420" y="128" text-anchor="middle" fill="#f4f7fb" font-family="ui-sans-serif,system-ui" font-size="13">No public bootstrap</text>',
    ].join('\n'),
  );
}

function gbxAcquisitionAndBurnChart(root: { [key: string]: DecimalJson }): string {
  const redemption = object(root.redemptionAndGbxBurn!, 'redemptionAndGbxBurn');
  const cases = array(redemption.marketRelativeToBacking, 'marketRelativeToBacking');
  const parts: string[] = [];
  cases.forEach((entry, index) => {
    const scenario = object(entry, 'GBX acquisition and burn scenario');
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
    'GBX acquisition price versus basket backing',
    'After GBX reaches Fund and is explicitly burned, acquiring below backing is accretive while acquiring above backing is dilutive in this offchain valuation scenario',
    parts.join('\n'),
  );
}

export function renderEconomicCharts(): Record<string, string> {
  const suite = object(computeEconomicSuite(), 'economic suite');
  return {
    'emissions-supply.svg': emissionChart(suite),
    'auction-curve.svg': auctionChart(suite),
    'genesis-liquidity.svg': liquidityChart(suite),
    'gbx-acquisition-burn.svg': gbxAcquisitionAndBurnChart(suite),
  };
}
