/**
 * Every figure in the whitepaper.
 *
 * Charts derive their geometry from `model.mjs`, which mirrors the committed reference
 * model, so a figure cannot quietly disagree with the economics the repository tests.
 * Schematics share one colour grammar: blue is USDG arriving, pink is the holder-directed
 * chain (signal, the acquisition it causes, and optional independent rewards), graphite is GBX supply and
 * burns. Charts whose series are categorical rather than semantic — the basket-formation
 * chart — opt out and use three separable colours instead.
 */

import { fonts, legend, legendCaptions, palette } from './theme.mjs';
import {
  areaPath,
  arrowDefs,
  axisX,
  axisY,
  circle,
  elbow,
  figure,
  label,
  line,
  node,
  path,
  rect,
  ribbon,
  smoothPath,
  text,
  widths,
} from './svg.mjs';
import {
  auctionCurve,
  auctionRatchet,
  basketFormation,
  emissionCurve,
  emissionMilestones,
  miningMarket,
  previewRedemption,
} from './model.mjs';

const flow = {
  capital: palette.blue,
  signal: palette.pink,
  asset: palette.pink,
  supply: palette.graphite,
};

const flowDeep = {
  capital: palette.blueBright,
  signal: palette.pinkBright,
  asset: palette.pinkBright,
  supply: palette.onDeepMuted,
};

const markers = arrowDefs(flow);
const markersDeep = arrowDefs(flowDeep);

const compact = (value) =>
  value >= 1e9
    ? `${(value / 1e9).toFixed(value % 1e9 === 0 ? 0 : 1)}B`
    : value >= 1e6
      ? `${(value / 1e6).toFixed(value % 1e6 === 0 ? 0 : 1)}M`
      : value >= 1e3
        ? `${(value / 1e3).toFixed(value % 1e3 === 0 ? 0 : 1)}k`
        : String(value);

/* ------------------------------------------------------------------ cover ---- */

/**
 * The brand badge: black disc, pink band, and stacked caps set large enough to run out
 * over the band. The overlap is deliberate — it makes the mark read as one object rather
 * than a label sitting inside a rule.
 */
export function brandMark({ width = '100%', lettering = palette.blueBright } = {}) {
  const row = (value, y) =>
    `<text x="50" y="${y}" text-anchor="middle" font-family="${fonts.brand}" font-size="31" fill="${lettering}">${value}</text>`;

  return [
    `<svg class="figure-svg" viewBox="0 0 100 100" width="${width}" role="img" aria-label="GumBall6900" xmlns="http://www.w3.org/2000/svg">`,
    '<defs><clipPath id="brandDisc"><circle cx="50" cy="50" r="50"/></clipPath></defs>',
    '<g clip-path="url(#brandDisc)">',
    circle({ cx: 50, cy: 50, r: 50, fill: palette.pinkBright }),
    circle({ cx: 50, cy: 50, r: 40, fill: palette.deep }),
    row('GUM', 33),
    row('BALL', 56),
    row('6900', 79),
    '</g></svg>',
  ].join('');
}

/**
 * The earlier abstract mark, kept because it still carries the thesis: signal weight around
 * the rim shapes the basket accumulating inside it. No longer on the cover now that the
 * brand badge exists.
 */
export function coverMark({ size = 300 } = {}) {
  const cx = size / 2;
  const cy = size / 2;
  // Every element has to fit inside the viewBox, so the ring is sized from the outermost
  // thing drawn — the capital arrows — rather than the other way around.
  const arrowReach = size * 0.49;
  const arrowLength = size * 0.1;
  const spokeMax = size * 0.05;
  const outer = arrowReach - arrowLength - spokeMax - 6;
  const parts = [];

  parts.push(circle({ cx, cy, r: outer, stroke: palette.deepRule, strokeWidth: 0.7 }));
  parts.push(circle({ cx, cy, r: outer * 0.995, stroke: palette.pinkBright, strokeWidth: 1.6, opacity: 0.5 }));

  // Signal spokes: 72 ticks whose length encodes an uneven, live signal distribution.
  const weights = Array.from({ length: 72 }, (_, index) => {
    const angle = (index / 72) * Math.PI * 2;
    return 0.32 + 0.34 * Math.abs(Math.sin(angle * 1.5)) + 0.3 * Math.abs(Math.cos(angle * 2.5 + 0.7)) ** 2;
  });

  weights.forEach((weight, index) => {
    const angle = (index / weights.length) * Math.PI * 2 - Math.PI / 2;
    const inner = outer + 4;
    const reach = inner + weight * spokeMax;
    parts.push(
      line({
        x1: cx + Math.cos(angle) * inner,
        y1: cy + Math.sin(angle) * inner,
        x2: cx + Math.cos(angle) * reach,
        y2: cy + Math.sin(angle) * reach,
        stroke: palette.pinkBright,
        width: 1.5,
        opacity: 0.35 + weight * 0.55,
        cap: 'round',
      }),
    );
  });

  // Capital entering from outside the ring, aimed between the spokes.
  [0.07, 0.4, 0.73].forEach((turn) => {
    const angle = turn * Math.PI * 2 - Math.PI / 2;
    const to = outer + spokeMax + 6;
    const from = to + arrowLength;
    parts.push(
      path(
        `M${(cx + Math.cos(angle) * from).toFixed(2)},${(cy + Math.sin(angle) * from).toFixed(2)} L${(cx + Math.cos(angle) * to).toFixed(2)},${(cy + Math.sin(angle) * to).toFixed(2)}`,
        { stroke: palette.blueBright, strokeWidth: 2, marker: 'arrow-capital' },
      ),
    );
  });

  // The basket: acquired assets accumulating inside, unevenly, over time.
  const orbs = [
    { x: -0.15, y: -0.14, r: 0.2, fill: palette.pinkBright, opacity: 0.95 },
    { x: 0.16, y: 0.02, r: 0.135, fill: palette.blueBright, opacity: 0.9 },
    { x: -0.04, y: 0.21, r: 0.105, fill: palette.pinkBright, opacity: 0.85 },
    { x: 0.13, y: -0.22, r: 0.062, fill: palette.onDeep, opacity: 0.55 },
    { x: -0.24, y: 0.1, r: 0.048, fill: palette.onDeep, opacity: 0.32 },
    { x: 0.03, y: -0.03, r: 0.036, fill: palette.pinkBright, opacity: 0.5 },
  ];

  orbs.forEach((orb) => {
    parts.push(
      circle({
        cx: cx + orb.x * size,
        cy: cy + orb.y * size,
        r: orb.r * size * 0.5,
        fill: orb.fill,
        opacity: orb.opacity,
      }),
    );
  });

  return figure({
    width: size,
    height: size,
    defs: markersDeep,
    title: 'Signal weight around the ring directs capital into a basket that accumulates inside it',
    children: parts.join(''),
  });
}

/* ----------------------------------------------------------------- legend ---- */

export function legendStrip({ width = widths.full, onDark = false } = {}) {
  const height = 34;
  const columnWidth = width / legend.length;
  const parts = [];

  legend.forEach((entry, index) => {
    const x = index * columnWidth;
    const color = onDark ? entry.deep : entry.paper;
    parts.push(rect({ x, y: 12, width: 16, height: 3.4, r: 1.7, fill: color }));
    parts.push(
      text(entry.label, {
        x: x + 22,
        y: 15.6,
        size: 7.4,
        weight: 600,
        fill: onDark ? palette.onDeep : palette.ink,
      }),
    );
    parts.push(
      text(legendCaptions[index], {
        x: x + 22,
        y: 26,
        size: 6.4,
        fill: onDark ? palette.onDeepMuted : palette.inkMuted,
      }),
    );
  });

  return figure({ width, height, children: parts.join(''), title: 'Colour key used by every figure' });
}

/* ------------------------------------------------------------- system map ---- */

/** The whole protocol on one page: who pays what to whom, and what is irreversible. */
export function systemMap({ width = widths.full } = {}) {
  const height = 552;
  const parts = [];
  const boxW = 126;
  const boxH = 34;
  const centre = width / 2;
  // A clear lane down the right edge carries the one connector that must cross every row.
  const lane = width - 5;
  const rightX = width - boxW - 16;

  const band = (y, h, title) => {
    parts.push(rect({ x: 0, y, width, height: h, r: 4, fill: palette.paperTint, opacity: 0.5 }));
    parts.push(label(title, { x: 7, y: y + 11, fill: palette.inkFaint }));
  };

  band(0, 60, 'Outside the protocol');
  band(478, 74, 'Terminal outcomes');

  const boxes = {
    miner: { x: 7, y: 22, w: 108, h: 30, title: 'Miner', accent: flow.capital },
    holder: { x: centre - 54, y: 22, w: 108, h: 30, title: 'GBX holder', accent: flow.supply },
    market: { x: width - 131, y: 22, w: 108, h: 30, title: 'Market participant', accent: flow.asset },

    fundraiser: {
      x: 7,
      y: 94,
      w: boxW,
      h: boxH,
      title: 'Fundraiser',
      sub: 'Fixed daily GBX schedule',
      accent: flow.capital,
    },
    liquidity: {
      x: rightX,
      y: 94,
      w: boxW,
      h: boxH,
      title: 'LiquidityPosition',
      sub: 'Fixed 0.20% auto-compounding',
      accent: flow.capital,
    },

    router: {
      x: centre - boxW / 2,
      y: 166,
      w: boxW,
      h: boxH,
      title: 'ResonanceRouter',
      sub: 'Single revenue entrance',
      accent: flow.capital,
    },
    resonance: {
      x: centre - boxW / 2,
      y: 230,
      w: boxW,
      h: boxH,
      title: 'Resonance',
      sub: 'Splits by live signal',
      accent: flow.capital,
    },
    signalgbx: {
      x: rightX,
      y: 230,
      w: boxW,
      h: boxH,
      title: 'SignalGBX (sGBX)',
      sub: 'Non-transferable weight',
      accent: flow.signal,
    },

    strategyA: {
      x: 7,
      y: 312,
      w: 140,
      h: boxH,
      title: 'Strategy — acquire',
      sub: 'Reverse Dutch auction',
      accent: flow.asset,
    },
    strategyB: {
      x: centre - 70,
      y: 312,
      w: 140,
      h: boxH,
      title: 'Strategy — acquire',
      sub: 'Reverse Dutch auction',
      accent: flow.asset,
    },
    gbxStrategy: {
      x: width - 163,
      y: 312,
      w: 140,
      h: boxH,
      title: 'Strategy — GBX',
      sub: 'GBX payment is Fund-bound',
      accent: flow.supply,
    },

    fund: { x: 30, y: 398, w: 160, h: boxH, title: 'Fund', sub: 'Shared raw-token backing', accent: flow.asset },
    bribe: {
      x: width - 206,
      y: 398,
      w: 160,
      h: boxH,
      title: 'Bribe',
      sub: 'Independently funded',
      accent: flow.asset,
    },

    redeem: {
      x: 7,
      y: 498,
      w: 148,
      h: 32,
      title: 'In-kind redemption',
      sub: 'Selected assets, pro rata',
      accent: flow.supply,
    },
    claimed: {
      x: centre - 74,
      y: 498,
      w: 148,
      h: 32,
      title: 'Signal rewards',
      sub: 'Claimed by signalers',
      accent: flow.asset,
    },
    burned: {
      x: width - 155,
      y: 498,
      w: 148,
      h: 32,
      title: 'Burned',
      sub: 'Capacity never reopens',
      accent: flow.supply,
    },
  };

  const connect = (d, kind, { dash, opacity = 1, strokeWidth = 1.15 } = {}) =>
    parts.push(path(d, { stroke: flow[kind], strokeWidth, marker: `arrow-${kind}`, dash, opacity }));

  const annotate = (value, x, y, anchor = 'middle', fill = palette.inkMuted) =>
    parts.push(text(value, { x, y, size: 6.2, fill, anchor, weight: 600 }));

  const bottom = (key) => boxes[key].y + boxes[key].h;
  const cx = (key) => boxes[key].x + boxes[key].w / 2;

  // Connectors are drawn first so every node box sits cleanly on top of them.

  // Mining: USDG down into the Fundraiser, GBX back up to the miner.
  connect(`M${boxes.miner.x + 30},52 L${boxes.miner.x + 30},94`, 'capital');
  connect(`M${boxes.fundraiser.x + 100},94 L${boxes.fundraiser.x + 100},52`, 'supply');

  // All contribution revenue reaches exactly one entrance.
  connect(
    elbow({ x1: cx('fundraiser'), y1: bottom('fundraiser'), x2: cx('router') - 20, y2: 166, axis: 'y', bend: 0.58 }),
    'capital',
  );
  connect(`M${cx('router')},${bottom('router')} L${cx('router')},230`, 'capital', { strokeWidth: 1.7 });

  // Signal is a read, not a transfer.
  connect(`M${boxes.signalgbx.x - 2},247 L${boxes.resonance.x + boxes.resonance.w + 3},247`, 'signal', {
    dash: '2.6 2.4',
  });

  // Weighted split of the next distribution.
  [
    ['strategyA', 2],
    ['strategyB', 1.4],
    ['gbxStrategy', 0.8],
  ].forEach(([key, weight]) => {
    connect(
      elbow({ x1: cx('resonance'), y1: bottom('resonance'), x2: cx(key), y2: 312, axis: 'y', bend: 0.55 }),
      'capital',
      {
        strokeWidth: weight,
      },
    );
  });

  // Acquisitions clear against the open market, down the free right-hand lane.
  connect(
    `M${boxes.market.x + boxes.market.w},37 L${lane},37 L${lane},329 L${boxes.gbxStrategy.x + boxes.gbxStrategy.w + 2},329`,
    'asset',
    {
      dash: '2.6 2.4',
      opacity: 0.6,
    },
  );

  // Every Strategy payment is Fund-bound.
  connect(
    elbow({ x1: cx('strategyA'), y1: bottom('strategyA'), x2: cx('fund') - 26, y2: 398, axis: 'y', bend: 0.46 }),
    'asset',
    { strokeWidth: 2 },
  );
  connect(
    elbow({ x1: cx('strategyB') - 30, y1: bottom('strategyB'), x2: cx('fund') + 26, y2: 398, axis: 'y', bend: 0.66 }),
    'asset',
    { strokeWidth: 1.5 },
  );
  connect(
    elbow({ x1: cx('gbxStrategy'), y1: bottom('gbxStrategy'), x2: cx('fund') + 54, y2: 398, axis: 'y', bend: 0.2 }),
    'asset',
    { strokeWidth: 1.2 },
  );

  // Terminal legs.
  connect(`M${cx('fund')},${bottom('fund')} L${cx('fund')},498`, 'supply');
  connect(
    `M${cx('bribe')},${bottom('bribe')} L${cx('bribe')},466 L${cx('claimed')},466 L${cx('claimed')},498`,
    'asset',
    { opacity: 0.8 },
  );
  connect(
    elbow({ x1: cx('fund') + 34, y1: bottom('fund'), x2: cx('burned'), y2: 498, axis: 'y', bend: 0.72 }),
    'supply',
    {
      strokeWidth: 1.2,
    },
  );

  Object.values(boxes).forEach((box) => {
    parts.push(
      node({
        x: box.x,
        y: box.y,
        width: box.w,
        height: box.h,
        title: box.title,
        subtitle: box.sub,
        accent: box.accent,
        surface: palette.paper,
        titleSize: box.sub ? 7.8 : 7.6,
      }),
    );
  });

  // Annotations last, each parked clear of the line it describes.
  annotate('USDG in', boxes.miner.x + 26, 76, 'end', palette.blue);
  annotate('GBX out', boxes.fundraiser.x + 104, 76, 'start', palette.graphite);
  annotate('contribution USDG', boxes.fundraiser.x + 2, 145, 'start', palette.blue);
  annotate('USDG fees', boxes.liquidity.x + boxes.liquidity.w - 2, 145, 'end', palette.blue);
  annotate('reads live sGBX weight', boxes.signalgbx.x + boxes.signalgbx.w, 222, 'end', palette.pink);
  annotate('weighted USDG follows signal', cx('resonance'), 283, 'middle', palette.blue);
  annotate('fills the auction', lane - 6, 200, 'end', palette.pink);
  annotate('100% Fund-bound', 4, 384, 'start', palette.pink);
  annotate('external incentives', boxes.bribe.x + boxes.bribe.w, 380, 'end', palette.pink);
  annotate('burn GBX to claim', cx('fund') + 6, 480, 'start', palette.graphite);
  annotate('permissionless Fund burn', boxes.burned.x + boxes.burned.w, 480, 'end', palette.graphite);

  return figure({
    width,
    height,
    defs: markers,
    title: 'Complete money flow from contribution through acquisition to redemption',
    children: parts.join(''),
  });
}

/* --------------------------------------------------------------- problem ---- */

export function problemContrast({ width = widths.full } = {}) {
  const height = 150;
  const parts = [];
  const half = width / 2 - 9;

  const column = (x, title, caption, steps, accent, live) => {
    parts.push(rect({ x, y: 0, width: half, height, r: 5, fill: live ? palette.paperTintWarm : palette.paperTint }));
    parts.push(label(title, { x: x + 14, y: 20, fill: accent }));
    parts.push(text(caption, { x: x + 14, y: 38, size: 8.2, weight: 600, fill: palette.ink }));

    steps.forEach((step, index) => {
      const y = 62 + index * 24;
      parts.push(circle({ cx: x + 19, cy: y - 3, r: 6.4, fill: 'none', stroke: accent, strokeWidth: 0.8 }));
      parts.push(
        text(String(index + 1), { x: x + 19, y: y - 0.6, size: 6, fill: accent, anchor: 'middle', weight: 600 }),
      );
      parts.push(text(step, { x: x + 32, y, size: 7.4, fill: palette.ink }));
      if (index < steps.length - 1) {
        parts.push(line({ x1: x + 19, y1: y + 4, x2: x + 19, y2: y + 14, stroke: accent, width: 0.7, opacity: 0.4 }));
      }
    });
  };

  column(
    0,
    'Conventional index product',
    'The basket arrives finished',
    ['A methodology sets membership', 'A committee sets weights', 'Investors receive the result'],
    palette.inkMuted,
    false,
  );
  column(
    width - half,
    'GumBall6900',
    'The basket is formed continuously',
    ['Strategies define eligible paths', 'Holders signal where flow goes', 'Each acquisition adds to the basket'],
    palette.pink,
    true,
  );

  parts.push(
    text('vs', { x: width / 2, y: height / 2 + 3, size: 9, fill: palette.inkFaint, anchor: 'middle', family: 'serif' }),
  );

  return figure({ width, height, children: parts.join(''), title: 'Where basket formation happens in each model' });
}

/* ---------------------------------------------------------- economic loop ---- */

export function economicLoop({ width = widths.full } = {}) {
  const height = 268;
  const cx = width / 2;
  const cy = height / 2 + 2;
  const radius = 92;
  const parts = [];

  const steps = [
    { title: 'Mine', body: 'Send USDG, take the day’s GBX', kind: 'capital' },
    { title: 'Signal', body: 'Stake GBX, allocate sGBX weight', kind: 'signal' },
    { title: 'Route', body: 'New USDG follows live weight', kind: 'capital' },
    { title: 'Acquire', body: 'An auction fills at a market price', kind: 'asset' },
    { title: 'Redeem', body: 'Burn GBX for selected assets', kind: 'supply' },
  ];

  const angleOf = (index) => (index / steps.length) * Math.PI * 2 - Math.PI / 2;
  const pointAt = (angle, r = radius) => [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];

  // Arcs run node-to-node along the ring, padded just enough to clear each node marker.
  steps.forEach((step, index) => {
    const pad = 0.2;
    const [x0, y0] = pointAt(angleOf(index) + pad);
    const [x1, y1] = pointAt(angleOf(index + 1) - pad);
    parts.push(
      path(`M${x0.toFixed(2)},${y0.toFixed(2)} A${radius},${radius} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`, {
        stroke: flow[step.kind],
        strokeWidth: 1.3,
        marker: `arrow-${step.kind}`,
        opacity: 0.85,
      }),
    );
  });

  parts.push(circle({ cx, cy, r: 48, fill: palette.paperTint }));
  parts.push(text('Every distribution', { x: cx, y: cy - 8, size: 7.4, fill: palette.inkMuted, anchor: 'middle' }));
  parts.push(text('re-reads the', { x: cx, y: cy + 3, size: 7.4, fill: palette.inkMuted, anchor: 'middle' }));
  parts.push(text('live signal', { x: cx, y: cy + 16, size: 10, weight: 600, fill: palette.pink, anchor: 'middle' }));

  steps.forEach((step, index) => {
    const angle = angleOf(index);
    const [x, y] = pointAt(angle);
    const color = flow[step.kind];

    parts.push(circle({ cx: x, cy: y, r: 11.5, fill: palette.paper, stroke: color, strokeWidth: 1.3 }));
    parts.push(text(String(index + 1), { x, y: y + 3.2, size: 8.6, weight: 600, fill: color, anchor: 'middle' }));

    // Labels sit radially outside the ring, anchored away from the centre.
    const [lx, ly] = pointAt(angle, radius + 22);
    const horizontal = Math.abs(Math.cos(angle)) > 0.3;
    const anchor = horizontal ? (Math.cos(angle) > 0 ? 'start' : 'end') : 'middle';
    const baseY = horizontal ? ly - 1 : Math.sin(angle) < 0 ? ly - 6 : ly + 12;

    parts.push(text(step.title, { x: lx, y: baseY, size: 9.2, weight: 600, fill: palette.ink, anchor }));
    parts.push(text(step.body, { x: lx, y: baseY + 10.5, size: 6.8, fill: palette.inkMuted, anchor }));
  });

  return figure({ width, height, defs: markers, children: parts.join(''), title: 'The five-step economic loop' });
}

/* ------------------------------------------------------------ supply split ---- */

export function supplySplit({ width = widths.full } = {}) {
  const height = 92;
  const barY = 34;
  const barH = 26;
  const parts = [];
  const genesisW = width * 0.02;

  parts.push(rect({ x: 0, y: barY, width, height: barH, r: 3, fill: palette.paperTint }));
  parts.push(rect({ x: 0, y: barY, width: genesisW, height: barH, r: 3, fill: palette.pink }));
  parts.push(
    rect({ x: genesisW + 1.5, y: barY, width: width - genesisW - 1.5, height: barH, r: 3, fill: palette.graphite }),
  );

  parts.push(label('Lifetime mint ceiling', { x: 0, y: 12, fill: palette.inkFaint }));
  parts.push(text('1,000,000,000 GBX', { x: 0, y: 27, size: 10.5, weight: 600, fill: palette.ink }));

  parts.push(
    text('20M', {
      x: genesisW + 8,
      y: barY + 16,
      size: 7.4,
      weight: 600,
      fill: palette.onDeep,
      anchor: 'start',
      opacity: 0,
    }),
  );
  parts.push(
    text('980,000,000 GBX — public Fundraiser mining capacity, 98%', {
      x: genesisW + 12,
      y: barY + 16.6,
      size: 7.6,
      weight: 600,
      fill: palette.paper,
    }),
  );

  parts.push(
    line({
      x1: genesisW / 2,
      y1: barY + barH,
      x2: genesisW / 2,
      y2: barY + barH + 10,
      stroke: palette.pink,
      width: 0.7,
    }),
  );
  parts.push(
    text('20,000,000 GBX — genesis liquidity only, 2%', {
      x: 0,
      y: barY + barH + 20,
      size: 7,
      fill: palette.pink,
      weight: 600,
    }),
  );
  parts.push(
    text('0 GBX to team, founders, investors, presale or advisors', {
      x: width,
      y: barY + barH + 20,
      size: 7,
      fill: palette.inkMuted,
      anchor: 'end',
    }),
  );

  return figure({ width, height, children: parts.join(''), title: 'Distribution of the one billion GBX mint ceiling' });
}

/* ------------------------------------------------------------- emissions ---- */

/**
 * The schedule is a geometric series whose infinite sum is exactly the mining
 * allocation — that identity is the point of the chart, so it is annotated directly.
 */
export function emissionChart({ width = widths.full } = {}) {
  const height = 206;
  const points = emissionCurve({ years: 16, samplesPerYear: 24 });
  const plot = { left: 34, right: width - 26, top: 24, cumulativeBottom: 116, dailyTop: 140, dailyBottom: 182 };

  const x = linear([0, 16], [plot.left, plot.right]);
  const yCumulative = linear([0, 1], [plot.cumulativeBottom, plot.top]);
  const maxDaily = points[0].daily;
  const yDaily = linear([0, maxDaily], [plot.dailyBottom, plot.dailyTop]);
  const parts = [];

  parts.push(
    axisY({
      scale: yCumulative,
      x: plot.left,
      x2: plot.right,
      ticks: [0, 0.25, 0.5, 0.75, 1],
      format: (value) => `${Math.round(value * 100)}%`,
    }),
  );

  parts.push(
    path(
      areaPath(
        points,
        (p) => x(p.years),
        (p) => yCumulative(p.emittedShare),
        () => yCumulative(0),
      ),
      { fill: palette.blue, opacity: 0.14 },
    ),
  );
  parts.push(
    path(
      smoothPath(
        points,
        (p) => x(p.years),
        (p) => yCumulative(p.emittedShare),
      ),
      { stroke: palette.blue, strokeWidth: 1.6 },
    ),
  );

  // The halving ladder: every four years closes half the remaining distance to 100%.
  emissionMilestones([4, 8, 12, 16]).forEach((milestone, index) => {
    const px = x(milestone.years);
    const py = yCumulative(milestone.sharePercent / 100);
    const last = index === 3;
    parts.push(
      line({
        x1: px,
        y1: py,
        x2: px,
        y2: plot.cumulativeBottom,
        stroke: palette.pink,
        width: 0.6,
        dash: '2 2.2',
        opacity: 0.7,
      }),
    );
    parts.push(circle({ cx: px, cy: py, r: 2.4, fill: palette.paper, stroke: palette.pink, strokeWidth: 1.1 }));
    parts.push(
      text(`${milestone.sharePercent.toFixed(2)}%`, {
        x: last ? px + 5 : px,
        y: last ? py + 2.4 : py - 7,
        size: 6.2,
        weight: 600,
        fill: palette.pink,
        anchor: last ? 'start' : 'middle',
      }),
    );
  });

  parts.push(label('Share of the 980M mining allocation emitted', { x: plot.left, y: 13, fill: palette.inkMuted }));

  parts.push(
    line({
      x1: plot.left,
      y1: yCumulative(1),
      x2: plot.right,
      y2: yCumulative(1),
      stroke: palette.blue,
      width: 0.6,
      dash: '3 2.4',
      opacity: 0.6,
    }),
  );
  parts.push(
    text('The whole schedule sums to exactly 980,000,000 GBX', {
      x: plot.left + 6,
      y: yCumulative(1) + 11,
      size: 7,
      weight: 600,
      fill: palette.blue,
    }),
  );

  // Daily emission panel, sharing the x-axis.
  parts.push(label('Scheduled daily emission, GBX', { x: plot.left, y: plot.dailyTop - 10, fill: palette.inkMuted }));
  parts.push(
    path(
      areaPath(
        points,
        (p) => x(p.years),
        (p) => yDaily(p.daily),
        () => yDaily(0),
      ),
      { fill: palette.graphite, opacity: 0.12 },
    ),
  );
  parts.push(
    path(
      smoothPath(
        points,
        (p) => x(p.years),
        (p) => yDaily(p.daily),
      ),
      { stroke: palette.graphite, strokeWidth: 1.4 },
    ),
  );

  [
    [0, points[0].daily],
    [4, emissionMilestones([4])[0].dailyEmission],
    [8, emissionMilestones([8])[0].dailyEmission],
  ].forEach(([years, daily]) => {
    parts.push(
      text(compact(Math.round(daily)), {
        x: x(years) + (years === 0 ? 4 : 0),
        y: yDaily(daily) - 5,
        size: 6.2,
        weight: 600,
        fill: palette.graphite,
        anchor: years === 0 ? 'start' : 'middle',
      }),
    );
  });

  parts.push(
    axisX({
      scale: x,
      y: plot.dailyBottom,
      ticks: [0, 4, 8, 12, 16],
      format: (value) => (value === 0 ? 'day 0' : `year ${value}`),
      title: 'Four-year half-life, 1,460 days',
    }),
  );

  return figure({ width, height, children: parts.join(''), title: 'Emission schedule and its cumulative total' });
}

function linear(domain, range) {
  const scale = (value) => range[0] + ((value - domain[0]) / (domain[1] - domain[0] || 1)) * (range[1] - range[0]);
  scale.domain = domain;
  scale.range = range;
  return scale;
}

/* --------------------------------------------------------- mining market ---- */

export function miningMarketChart({ width = widths.full } = {}) {
  const height = 174;
  const dailyEmission = 100_000;
  const gbxPrice = 0.5;
  const maxContribution = 100_000;
  const market = miningMarket({ dailyEmission, gbxPrice, maxContribution });

  const plot = { left: 40, right: width - 26, top: 24, bottom: 138 };
  const x = linear([0, maxContribution], [plot.left, plot.right]);
  const y = linear([0, 1], [plot.bottom, plot.top]);
  const parts = [];

  parts.push(label('USDG paid per GBX', { x: plot.left - 30, y: 13, fill: palette.inkMuted }));
  parts.push(
    axisY({
      scale: y,
      x: plot.left,
      x2: plot.right,
      ticks: [0, 0.25, 0.5, 0.75, 1],
      format: (value) => value.toFixed(2),
    }),
  );

  // The region a miner is buying into below the market price.
  const breakEvenX = x(market.breakEven);
  parts.push(
    path(`M${plot.left},${y(0)} L${breakEvenX},${y(gbxPrice)} L${plot.left},${y(gbxPrice)} Z`, {
      fill: palette.blue,
      opacity: 0.13,
    }),
  );

  parts.push(
    line({
      x1: plot.left,
      y1: y(gbxPrice),
      x2: plot.right,
      y2: y(gbxPrice),
      stroke: palette.pink,
      width: 1.2,
      dash: '3.4 2.6',
    }),
  );
  parts.push(
    text('GBX market price, 0.50 USDG', {
      x: plot.right,
      y: y(gbxPrice) - 6,
      size: 6.8,
      weight: 600,
      fill: palette.pink,
      anchor: 'end',
    }),
  );

  parts.push(
    path(
      market.points
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'}${x(point.contributed).toFixed(2)},${y(point.impliedCost).toFixed(2)}`,
        )
        .join(' '),
      { stroke: palette.blue, strokeWidth: 1.7 },
    ),
  );
  parts.push(
    text('Average cost paid by that day’s miners = C / E', {
      x: plot.left + 8,
      y: y(0.9),
      size: 6.8,
      weight: 600,
      fill: palette.blue,
    }),
  );

  // Worked example and equilibrium markers.
  const marks = [
    { contributed: 20_000, note: 'Thin day: 0.20 USDG per GBX', color: palette.blue },
    { contributed: market.breakEven, note: 'Break-even: C = P × E', color: palette.ink },
  ];

  marks.forEach((mark) => {
    const px = x(mark.contributed);
    const py = y(mark.contributed / dailyEmission);
    parts.push(
      line({ x1: px, y1: py, x2: px, y2: plot.bottom, stroke: mark.color, width: 0.6, dash: '2 2.2', opacity: 0.65 }),
    );
    parts.push(circle({ cx: px, cy: py, r: 2.8, fill: palette.paper, stroke: mark.color, strokeWidth: 1.2 }));
  });

  parts.push(
    text('20k contributed → 0.20 per GBX', {
      x: x(20_000) + 7,
      y: y(0.2) + 10,
      size: 6.6,
      weight: 600,
      fill: palette.blue,
    }),
  );
  parts.push(
    text('50k — margin competed away', {
      x: breakEvenX - 7,
      y: y(0.5) - 7,
      size: 6.6,
      weight: 600,
      fill: palette.ink,
      anchor: 'end',
    }),
  );
  parts.push(
    text('Miner margin', { x: plot.left + 10, y: y(0.34), size: 6.6, weight: 600, fill: palette.blue, opacity: 0.85 }),
  );

  parts.push(
    axisX({
      scale: x,
      y: plot.bottom,
      ticks: [0, 25_000, 50_000, 75_000, 100_000],
      format: (value) => (value === 0 ? '0' : `${compact(value)}`),
      title: 'USDG contributed on the day (C)',
    }),
  );

  return figure({ width, height, children: parts.join(''), title: 'How competition prices a fixed daily emission' });
}

/* ------------------------------------------------------------- signalling ---- */

export function signalAllocation({ width = widths.full } = {}) {
  const height = 220;
  const parts = [];
  const leftX = 4;
  const rightX = width - 172;
  const sourceY = 100;

  parts.push(
    node({
      x: leftX,
      y: sourceY - 21,
      width: 150,
      height: 42,
      title: 'Your sGBX',
      subtitle: '1,000,000 staked one-for-one',
      accent: palette.pink,
    }),
  );

  const targets = [
    { title: 'Strategy — NVDA', sub: 'NVIDIA-linked asset', weight: 0.5, amount: 500_000 },
    { title: 'Strategy — AAPL', sub: 'Apple-linked asset', weight: 0.25, amount: 250_000 },
    { title: 'Strategy — SPCX', sub: 'SpaceX-linked asset', weight: 0.15, amount: 150_000 },
    { title: 'Unallocated sGBX', sub: 'Idle and withdrawable', weight: 0.1, amount: 100_000 },
  ];

  targets.forEach((target, index) => {
    const y = 30 + index * 48;
    parts.push(
      path(
        ribbon({
          x1: leftX + 152,
          y1: sourceY,
          x2: rightX - 2,
          y2: y + 17,
          w1: target.weight * 46,
          w2: target.weight * 46,
        }),
        {
          fill: palette.pink,
          opacity: 0.2,
        },
      ),
    );
    parts.push(
      node({ x: rightX, y, width: 168, height: 34, title: target.title, subtitle: target.sub, accent: palette.pink }),
    );
    parts.push(
      text(`${compact(target.amount)}`, {
        x: rightX - 12,
        y: y + 20,
        size: 9.4,
        weight: 600,
        fill: palette.pink,
        anchor: 'end',
      }),
    );
  });

  parts.push(label('Add absolute amounts; leave any remainder idle', { x: leftX, y: 16, fill: palette.inkMuted }));

  return figure({ width, height, children: parts.join(''), title: 'Allocating sGBX weight across Strategies' });
}

/* ----------------------------------------------------------- routing flow ---- */

/**
 * Revenue splits by live signal, then every Strategy payment converges on Fund.
 */
export function routingFlow({ width = widths.full } = {}) {
  const height = 238;
  const parts = [];
  const revenueX = 4;
  const strategyX = 168;
  const strategyW = 132;
  const outX = width - 132;
  const bandTotal = 108;
  const midY = 156;
  const fundY = 40;

  const shares = [
    { name: 'Strategy A', weight: 0.5 },
    { name: 'Strategy B', weight: 0.3 },
    { name: 'Strategy C', weight: 0.2 },
  ];

  const stackHeight = bandTotal + (shares.length - 1) * 12;
  let cursor = midY - stackHeight / 2;
  const placed = shares.map((share) => {
    const bandHeight = share.weight * bandTotal;
    const entry = { ...share, y: cursor, height: bandHeight, centre: cursor + bandHeight / 2 };
    cursor += bandHeight + 12;
    return entry;
  });

  // Split 1 — cyan, weighted by live signal.
  placed.forEach((share) => {
    parts.push(
      path(
        ribbon({
          x1: revenueX + 130,
          y1: midY + (share.centre - midY) * 0.08,
          x2: strategyX,
          y2: share.centre,
          w1: share.weight * bandTotal,
          w2: share.height,
        }),
        { fill: palette.blue, opacity: 0.22 },
      ),
    );
  });

  // Every auction payment converges on Fund without a reward split.
  placed.forEach((share) => {
    parts.push(
      path(
        ribbon({
          x1: strategyX + strategyW,
          y1: share.centre,
          x2: outX,
          y2: fundY + 20,
          w1: share.height,
          w2: share.height,
        }),
        { fill: palette.pink, opacity: 0.2 },
      ),
    );
  });

  parts.push(
    node({
      x: revenueX,
      y: midY - 22,
      width: 126,
      height: 44,
      title: 'Resonance',
      subtitle: 'Distributes new USDG',
      accent: palette.blue,
    }),
  );

  placed.forEach((share) => {
    parts.push(
      rect({
        x: strategyX,
        y: share.y,
        width: strategyW,
        height: share.height,
        r: 3,
        fill: palette.paper,
        stroke: palette.blue,
        strokeWidth: 0.9,
      }),
    );
    parts.push(
      text(share.name, { x: strategyX + 10, y: share.centre - 1.4, size: 7.8, weight: 600, fill: palette.ink }),
    );
    parts.push(
      text(`${Math.round(share.weight * 100)}% of signal weight`, {
        x: strategyX + 10,
        y: share.centre + 8.6,
        size: 6.5,
        fill: palette.inkMuted,
      }),
    );
  });

  parts.push(
    node({
      x: outX,
      y: fundY,
      width: 128,
      height: 42,
      title: 'Fund',
      subtitle: '100% — shared backing',
      accent: palette.pink,
    }),
  );
  parts.push(label('Split — by live signal weight', { x: revenueX, y: 14, fill: palette.blue }));
  parts.push(label('Settlement — 100% Fund-bound', { x: width, y: 14, fill: palette.pink, anchor: 'end' }));
  parts.push(
    line({
      x1: strategyX + strategyW + 16,
      y1: 24,
      x2: strategyX + strategyW + 16,
      y2: height - 12,
      stroke: palette.rule,
      width: 0.6,
      dash: '2 3',
    }),
  );

  parts.push(text('USDG changes hands', { x: revenueX, y: 26, size: 6.8, weight: 600, fill: palette.blue }));
  parts.push(
    text('and becomes the acquired asset', {
      x: width,
      y: 26,
      size: 6.8,
      weight: 600,
      fill: palette.pink,
      anchor: 'end',
    }),
  );

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'Revenue follows signals; payments converge on Fund',
  });
}

/* ---------------------------------------------------------------- auction ---- */

/**
 * The mechanism the previous edition drew as a vague downward line. The payment a filler
 * must hand over decays to exactly zero, and each fill re-opens the next epoch higher.
 */
export function auctionChart({ width = widths.full } = {}) {
  const height = 208;
  const epochPeriod = 86_400;
  const initPrice = 1_000n * 10n ** 18n;
  const fairValue = 400;
  const curve = auctionCurve({ initPrice, epochPeriod });

  const plot = { left: 42, right: width * 0.55, top: 36, bottom: 160 };
  const x = linear([0, 24], [plot.left, plot.right]);
  const y = linear([0, 1000], [plot.bottom, plot.top]);
  const parts = [];

  parts.push(label('One epoch — target asset the filler must pay', { x: 0, y: 13, fill: palette.ink }));
  parts.push(
    axisY({
      scale: y,
      x: plot.left,
      x2: plot.right,
      ticks: [0, 250, 500, 750, 1000],
      format: (value) => compact(value),
    }),
  );

  // Below fair value nobody rational fills; above it, filling is profitable.
  const crossHours = 24 * (1 - fairValue / 1000);
  parts.push(
    rect({
      x: plot.left,
      y: plot.top,
      width: x(crossHours) - plot.left,
      height: plot.bottom - plot.top,
      fill: palette.inkFaint,
      opacity: 0.09,
    }),
  );
  parts.push(
    rect({
      x: x(crossHours),
      y: plot.top,
      width: plot.right - x(crossHours),
      height: plot.bottom - plot.top,
      fill: palette.pink,
      opacity: 0.1,
    }),
  );

  parts.push(
    path(
      curve
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.hours).toFixed(2)},${y(point.payment).toFixed(2)}`)
        .join(' '),
      {
        stroke: palette.pink,
        strokeWidth: 1.8,
      },
    ),
  );

  parts.push(
    line({
      x1: plot.left,
      y1: y(fairValue),
      x2: plot.right,
      y2: y(fairValue),
      stroke: palette.blue,
      width: 1.1,
      dash: '3.4 2.6',
    }),
  );
  parts.push(
    text('What the market thinks the USDG is worth', {
      x: plot.left + 4,
      y: y(fairValue) - 8,
      size: 6.4,
      weight: 600,
      fill: palette.blue,
    }),
  );

  parts.push(
    circle({
      cx: x(crossHours),
      cy: y(fairValue),
      r: 3.4,
      fill: palette.paper,
      stroke: palette.pink,
      strokeWidth: 1.4,
    }),
  );
  parts.push(
    text('Fills here', { x: x(crossHours) + 7, y: y(fairValue) - 5, size: 7.2, weight: 600, fill: palette.pink }),
  );
  parts.push(text('Nobody fills', { x: plot.left + 5, y: plot.bottom - 6, size: 6.4, fill: palette.inkMuted }));
  parts.push(
    text('Profitable to fill', {
      x: plot.right - 4,
      y: plot.bottom - 6,
      size: 6.4,
      fill: palette.pink,
      anchor: 'end',
      weight: 600,
    }),
  );

  parts.push(
    axisX({
      scale: x,
      y: plot.bottom,
      ticks: [0, 6, 12, 18, 24],
      format: (value) => `${value}h`,
      title: 'Elapsed epoch time',
    }),
  );

  // Ratchet panel.
  const ratchet = auctionRatchet({
    initPrice: 1_000n * 10n ** 18n,
    epochPeriod,
    priceMultiplierWad: 2n * 10n ** 18n,
    minInitPrice: 10n ** 6n,
    fairValue: 400n * 10n ** 18n,
    epochs: 4,
  });

  const rLeft = width * 0.68;
  const rx = linear([0, ratchet.length], [rLeft, width - 6]);
  const ry = linear([0, 1000], [plot.bottom, plot.top]);
  parts.push(label('Four epochs in sequence', { x: width, y: 13, fill: palette.ink, anchor: 'end' }));
  parts.push(axisY({ scale: ry, x: rLeft, x2: width - 6, ticks: [0, 500, 1000], format: (value) => compact(value) }));

  ratchet.forEach((epoch, index) => {
    const x0 = rx(index) + 3;
    const x1 = rx(index + 1) - 3;
    parts.push(
      path(`M${x0},${ry(epoch.openingTokens)} L${x1},${ry(0)}`, {
        stroke: palette.pink,
        strokeWidth: 1.3,
        opacity: 0.85,
      }),
    );
    if (epoch.fills) {
      const fx = x0 + (x1 - x0) * epoch.fillFraction;
      parts.push(
        circle({
          cx: fx,
          cy: ry(epoch.paymentTokens),
          r: 2.6,
          fill: palette.paper,
          stroke: palette.pink,
          strokeWidth: 1.2,
        }),
      );
    }
  });

  parts.push(
    line({
      x1: rLeft,
      y1: ry(fairValue),
      x2: width - 6,
      y2: ry(fairValue),
      stroke: palette.blue,
      width: 1,
      dash: '3.4 2.6',
    }),
  );
  parts.push(
    axisX({
      scale: rx,
      y: plot.bottom,
      ticks: [0.5, 1.5, 2.5, 3.5],
      format: (value) => `#${Math.ceil(value)}`,
      title: 'Epoch',
      tickLength: 0,
    }),
  );

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'Reverse Dutch auction decay and the price ratchet',
  });
}

/* ------------------------------------------------------------- redemption ---- */

export function redemptionFigure({ width = widths.full } = {}) {
  const parts = [];

  // Payouts come from the model's redemption rule rather than being written in by hand.
  const burned = 1_000n;
  const supplyBeforeBurn = 100_000n;
  const holdings = [
    { name: 'Asset X', held: 50_000n, selected: true },
    { name: 'Asset Y', held: 8_000n, selected: true },
    { name: 'Asset Z', held: 12_000n, selected: false },
  ];
  const payouts = previewRedemption({ balances: holdings.map((entry) => entry.held), burned, supplyBeforeBurn });
  const assets = holdings.map((entry, index) => ({
    name: entry.name,
    held: Number(entry.held),
    selected: entry.selected,
    payout: entry.selected ? Number(payouts[index]) : 0,
  }));
  const sharePercent = Number((burned * 10_000n) / supplyBeforeBurn) / 100;

  parts.push(
    label(
      `Burn ${Number(burned).toLocaleString()} GBX while supply is ${Number(supplyBeforeBurn).toLocaleString()} GBX — a ${sharePercent}% claim`,
      {
        x: 4,
        y: 14,
        fill: palette.ink,
      },
    ),
  );

  const rowY = (index) => 40 + index * 54;
  const barLeft = 104;
  const barMax = width - 104 - 176;
  const largest = Math.max(...assets.map((asset) => asset.held));

  assets.forEach((asset, index) => {
    const y = rowY(index);
    const scale = barMax / largest;
    const accent = asset.selected ? palette.pink : palette.inkFaint;
    const barWidth = asset.held * scale;
    // A 1% slice is genuinely almost invisible; it gets a minimum width and a tick so the
    // proportion stays honest while the claim remains findable.
    const sliceWidth = Math.max(2.2, asset.payout * scale);

    parts.push(
      text(asset.name, {
        x: 4,
        y: y + 12,
        size: 8.4,
        weight: 600,
        fill: asset.selected ? palette.ink : palette.inkMuted,
      }),
    );
    parts.push(
      text(asset.selected ? 'selected' : 'omitted', {
        x: 4,
        y: y + 22,
        size: 6.4,
        fill: asset.selected ? palette.pink : palette.inkFaint,
      }),
    );

    parts.push(
      rect({ x: barLeft, y, width: barWidth, height: 20, r: 2, fill: accent, opacity: asset.selected ? 0.22 : 0.12 }),
    );
    if (asset.selected) {
      parts.push(rect({ x: barLeft, y, width: sliceWidth, height: 20, r: 1.2, fill: accent }));
      parts.push(
        line({ x1: barLeft + sliceWidth, y1: y - 4, x2: barLeft + sliceWidth, y2: y + 24, stroke: accent, width: 0.7 }),
      );
    }
    parts.push(
      text(`${asset.held.toLocaleString()} held`, {
        x: barLeft + barWidth + 7,
        y: y + 13.6,
        size: 6.8,
        fill: palette.inkMuted,
      }),
    );

    parts.push(
      text(asset.selected ? `→ ${asset.payout} transferred` : '→ nothing transferred', {
        x: width - 4,
        y: y + 8,
        size: 7.6,
        weight: 600,
        fill: asset.selected ? palette.pink : palette.inkFaint,
        anchor: 'end',
      }),
    );
    parts.push(
      text(
        asset.selected ? `floor(${asset.held.toLocaleString()} × ${sharePercent}%)` : 'claim permanently forfeited',
        {
          x: width - 4,
          y: y + 19,
          size: 6.4,
          fill: palette.inkMuted,
          anchor: 'end',
        },
      ),
    );
  });

  return figure({
    width,
    height: rowY(assets.length - 1) + 30,
    children: parts.join(''),
    title: 'Selective in-kind redemption',
  });
}

/* ------------------------------------------------------------- burn loops ---- */

export function burnLoops({ width = widths.full } = {}) {
  const height = 186;
  const parts = [];
  const half = width / 2 - 10;

  const loop = (originX, title, caption, steps, accent) => {
    parts.push(rect({ x: originX, y: 0, width: half, height, r: 5, fill: palette.paperTint, opacity: 0.6 }));
    parts.push(label(title, { x: originX + 14, y: 20, fill: accent }));
    parts.push(text(caption, { x: originX + 14, y: 36, size: 7.8, weight: 600, fill: palette.ink }));

    steps.forEach((step, index) => {
      const y = 60 + index * 30;
      parts.push(
        rect({
          x: originX + 14,
          y: y - 11,
          width: half - 28,
          height: 24,
          r: 3,
          fill: palette.paper,
          stroke: step.terminal ? palette.graphite : accent,
          strokeWidth: 0.8,
        }),
      );
      parts.push(
        text(step.text, { x: originX + 24, y: y + 4, size: 7.2, fill: palette.ink, weight: step.terminal ? 600 : 400 }),
      );
      if (step.terminal) {
        parts.push(
          text('terminal', {
            x: originX + half - 24,
            y: y + 4,
            size: 6.2,
            fill: palette.graphite,
            anchor: 'end',
            weight: 600,
          }),
        );
      }
      if (index < steps.length - 1) {
        parts.push(
          path(`M${originX + half / 2},${y + 13} L${originX + half / 2},${y + 19}`, {
            stroke: step.terminal ? palette.graphite : accent,
            strokeWidth: 1,
            marker: step.terminal ? 'arrow-supply' : 'arrow-capital',
          }),
        );
      }
    });
  };

  loop(
    0,
    'Liquidity compounding',
    'Grow without removing principal',
    [
      { text: 'Caller adds the fixed 0.20% liquidity' },
      { text: 'v4 nets fees against the increase' },
      { text: 'Caller receives every accrued fee', terminal: true },
    ],
    palette.blue,
  );

  loop(
    width - half,
    'GBX-priced Strategy',
    'Spend USDG, deliver GBX',
    [
      { text: 'A GBX-priced Strategy receives routed USDG' },
      { text: 'It buys GBX on the open market' },
      { text: 'Fund receives GBX; anyone may burn it later', terminal: true },
    ],
    palette.graphite,
  );

  return figure({
    width,
    height,
    defs: markers,
    children: parts.join(''),
    title: 'Liquidity compounding and explicit Fund burns',
  });
}

/* -------------------------------------------------------- path dependence ---- */

/**
 * The clearest way to show that signals steer flow rather than holdings: put the live
 * signal above the accumulated basket and let the reader see one move while the other lags.
 */
export function basketFormationChart({ width = widths.full } = {}) {
  const assets = ['Asset A', 'Asset B', 'Asset C'];
  // Categorical, not semantic: these name three arbitrary assets, so they need three
  // clearly separable colours rather than the flow grammar used elsewhere.
  const colors = [palette.graphite, palette.blue, palette.pink];
  const history = [
    [80, 20, 0],
    [80, 20, 0],
    [70, 30, 0],
    [30, 30, 40],
    [10, 20, 70],
    [10, 20, 70],
    [10, 10, 80],
    [20, 10, 70],
  ];

  const periods = basketFormation({ assets, history, revenuePerPeriod: 100 });
  const parts = [];

  const plot = { left: 40, right: width - 96, signalTop: 30, signalBottom: 72, basketTop: 108, basketBottom: 208 };
  const x = linear([1, periods.length], [plot.left, plot.right]);

  // Live signal: a stacked band that snaps between distributions.
  parts.push(label('Live sGBX signal at each distribution', { x: plot.left, y: 20, fill: palette.pink }));
  periods.forEach((period, index) => {
    const bandWidth = (plot.right - plot.left) / periods.length;
    const x0 = plot.left + index * bandWidth;
    let cursor = plot.signalTop;
    period.signal.forEach((share, assetIndex) => {
      const h = share * (plot.signalBottom - plot.signalTop);
      parts.push(
        rect({ x: x0 + 1, y: cursor, width: bandWidth - 2, height: h, fill: colors[assetIndex], opacity: 0.8 }),
      );
      cursor += h;
    });
  });

  // Accumulated basket: a stacked area that can only grow.
  parts.push(label('Resulting Fund composition, cumulative', { x: plot.left, y: 98, fill: palette.ink }));
  const maxTotal = periods.at(-1).total;
  const y = linear([0, maxTotal], [plot.basketBottom, plot.basketTop]);

  let baseline = periods.map(() => 0);
  assets.forEach((asset, assetIndex) => {
    const upper = periods.map((period, index) => baseline[index] + period.holdings[assetIndex]);
    const area = areaPath(
      periods.map((period, index) => ({ period, index })),
      (item) => x(item.period.period),
      (item) => y(upper[item.index]),
      (item) => y(baseline[item.index]),
    );
    parts.push(path(area, { fill: colors[assetIndex], opacity: 0.72 }));
    parts.push(
      text(asset, {
        x: plot.right + 8,
        y: y((baseline.at(-1) + upper.at(-1)) / 2) + 2.4,
        size: 7,
        weight: 600,
        fill: colors[assetIndex],
      }),
    );
    baseline = upper;
  });

  parts.push(
    axisX({
      scale: x,
      y: plot.basketBottom,
      ticks: [1, 2, 3, 4, 5, 6, 7, 8],
      format: (value) => String(value),
      title: 'Successive distributions',
    }),
  );

  return figure({
    width,
    height: plot.basketBottom + 30,
    children: parts.join(''),
    title: 'Why the basket is path-dependent',
  });
}

/* -------------------------------------------------------------- governance ---- */

export function governancePerimeter({ width = widths.full } = {}) {
  const height = 244;
  const parts = [];
  // The core is offset so both label columns have room for their longest entry.
  const coreX = 126;
  const coreW = width - coreX - 112;

  parts.push(rect({ x: coreX, y: 28, width: coreW, height: 168, r: 6, fill: palette.deep }));
  parts.push(
    rect({
      x: coreX + 5,
      y: 33,
      width: coreW - 10,
      height: 158,
      r: 4,
      fill: 'none',
      stroke: palette.deepRule,
      strokeWidth: 0.7,
      dash: '3 3',
    }),
  );

  parts.push(
    text('Deployed core', {
      x: coreX + coreW / 2,
      y: 92,
      size: 15,
      weight: 600,
      fill: palette.onDeep,
      anchor: 'middle',
    }),
  );
  parts.push(
    text('Direct contracts. No proxy, no upgrade, no successor rewrite.', {
      x: coreX + coreW / 2,
      y: 110,
      size: 7.2,
      fill: palette.onDeepMuted,
      anchor: 'middle',
    }),
  );
  parts.push(
    text('Signals govern capital. Code governs rules.', {
      x: coreX + coreW / 2,
      y: 130,
      size: 7.6,
      weight: 600,
      fill: palette.blueBright,
      anchor: 'middle',
    }),
  );

  // The authorized edges, drawn as the only openings in the perimeter.
  const doors = ['Add a Strategy', 'Kill a Strategy', 'Add Bribe rewards (max 8)'];
  doors.forEach((door, index) => {
    const y = 48 + index * 34;
    parts.push(rect({ x: coreX - 6, y: y - 9, width: 12, height: 18, r: 2, fill: palette.pinkBright }));
    parts.push(text(door, { x: coreX - 14, y: y + 3, size: 7.2, weight: 600, fill: palette.ink, anchor: 'end' }));
    parts.push(text(String(index + 1), { x: 4, y: y + 3, size: 7.2, weight: 600, fill: palette.pink }));
  });
  parts.push(label('Three authorized actions', { x: 4, y: 22, fill: palette.pink }));

  // What has no door at all.
  const sealed = [
    'Proxy upgrade',
    'Successor migration',
    'Arbitrary withdrawal',
    'Pause switch',
    'General parameter setter',
  ];
  parts.push(label('No entry point exists', { x: width - 4, y: 22, fill: palette.inkFaint, anchor: 'end' }));
  sealed.forEach((item, index) => {
    const y = 44 + index * 22;
    parts.push(text(item, { x: width - 18, y: y + 3, size: 7.2, fill: palette.inkMuted, anchor: 'end' }));
    parts.push(line({ x1: width - 14, y1: y, x2: width - 4, y2: y, stroke: palette.inkFaint, width: 0.9 }));
    parts.push(line({ x1: width - 12, y1: y - 4, x2: width - 6, y2: y + 4, stroke: palette.inkFaint, width: 0.9 }));
    parts.push(line({ x1: width - 12, y1: y + 4, x2: width - 6, y2: y - 4, stroke: palette.inkFaint, width: 0.9 }));
  });

  parts.push(
    text(
      'Immutability removes the power to fix mistakes as surely as it removes the power to cause them. That is the trade, stated plainly.',
      {
        x: width / 2,
        y: 222,
        size: 7,
        fill: palette.inkMuted,
        anchor: 'middle',
      },
    ),
  );

  return figure({ width, height, children: parts.join(''), title: 'The management surface and what it cannot reach' });
}

/* ------------------------------------------------------- worked example ---- */

/**
 * Rendered as HTML rather than SVG: the cells are prose of varying length, and only HTML
 * will wrap them instead of silently clipping at the viewBox edge.
 */
export function workedExample() {
  const steps = [
    {
      kind: 'capital',
      title: 'Contribute 1,000 USDG',
      detail: 'On a day scheduled to emit 100,000 GBX, where 50,000 USDG is contributed in total.',
      result: 'You receive 2,000 GBX — a 2% share of the day.',
    },
    {
      kind: 'signal',
      title: 'Stake it into 2,000 sGBX',
      detail: 'You allocate all of that weight behind the NVDA Strategy.',
      result: 'Your weight now steers your slice of every future distribution.',
    },
    {
      kind: 'capital',
      title: 'Your 1,000 USDG is routed',
      detail: 'It reaches ResonanceRouter, then Resonance, which reads live signal weights.',
      result: 'If NVDA holds 30% of signal weight, that Strategy receives about 300 USDG.',
    },
    {
      kind: 'asset',
      title: 'The Strategy runs an auction',
      detail: 'Its accumulated USDG is offered, and the required NVDA payment decays until a filler acts.',
      result: 'The Strategy receives NVDA-linked tokens at a market-set rate.',
    },
    {
      kind: 'asset',
      title: 'The complete payment is Fund-bound',
      detail: 'The Strategy records the received NVDA-linked tokens as a fixed Fund liability.',
      result: 'Any caller can deliver 100% to Fund; auction proceeds do not fund Bribes.',
    },
    {
      kind: 'supply',
      title: 'Later, you redeem',
      detail: 'You burn GBX and name the Fund assets you actually want.',
      result: 'You receive a pro-rata share of exactly those assets, in kind.',
    },
  ];

  const rows = steps
    .map(
      (step, index) => `
      <div class="trace__row">
        <span class="trace__index" style="color:${flow[step.kind]}; border-color:${flow[step.kind]};">${index + 1}</span>
        <span class="trace__body">
          <span class="trace__title">${step.title}</span>
          <span class="trace__detail">${step.detail}</span>
        </span>
        <span class="trace__result" style="color:${flow[step.kind]};">${step.result}</span>
      </div>`,
    )
    .join('');

  return `<div class="trace">${rows}</div>`;
}
