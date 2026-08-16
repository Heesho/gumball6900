/**
 * Named figures for the long-form editions.
 *
 * These are charts rather than flowcharts, which is why they are not Mermaid: Mermaid
 * draws graphs and state machines, not decay curves or step functions, and the things
 * hardest to picture from this protocol's prose are exactly the curves — a price falling
 * to zero, a stream that emits one extra unit per second for part of a period, a rate that
 * halves on a schedule which itself halves.
 *
 * Every number is derived from `contractConstants`, which mirrors the Solidity and is
 * cross-checked against the tested simulation fixture. A figure here cannot print a split
 * or a duration that disagrees with the contracts.
 *
 * Placement is by `<!-- figure: id -->` in the markdown. That marker is invisible on
 * GitHub (where the Mermaid fences already render) and expands to SVG in print.
 *
 * Geometry note: the viewBox is 480 units wide against a ~162mm printed column, so one
 * unit is a little under 1pt. Type below 9 units is unreadable in print; 9–13 is the band
 * these figures use.
 */

import { contractConstants, palette } from './figure-kit.mjs';

const W = 480;

const ink = palette.ink;
const faint = palette.inkFaint;
const muted = palette.inkMuted;
const pink = palette.pink;
const blue = palette.blue;
const rule = palette.ruleStrong;

const FONT = 'Inter, Helvetica Neue, sans-serif';
const MONO = 'JetBrains Mono, Menlo, monospace';

const txt = (x, y, s, { size = 10, fill = ink, anchor = 'start', weight = 400, family = FONT, tracking } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"${
    tracking ? ` letter-spacing="${tracking}"` : ''
  }>${s}</text>`;

const line = (x1, y1, x2, y2, { stroke = rule, width = 1, dash } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"${
    dash ? ` stroke-dasharray="${dash}"` : ''
  } />`;

const rect = (x, y, w, h, fill, { rx = 2, opacity = 1 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${opacity}" />`;

const svg = (height, body, label) =>
  `<svg viewBox="0 0 ${W} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${body}</svg>`;

/* ------------------------------------------------------- 1. mining handoff ---- */

const miningSplit = () => {
  const { previousMinerBps, resonanceBps } = contractConstants.mine;
  const minerPct = previousMinerBps / 100;
  const revenuePct = resonanceBps / 100;
  const x0 = 8;
  const barW = 300;
  const minerW = (barW * minerPct) / 100;

  return svg(
    150,
    [
      txt(x0, 16, 'OCCUPIED SLOT — SOMEONE IS DISPLACED', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      rect(x0, 24, minerW, 26, blue),
      rect(x0 + minerW, 24, barW - minerW, 26, pink),
      txt(x0 + minerW / 2, 41, `${minerPct}%`, { anchor: 'middle', fill: '#fff', weight: 600, size: 11 }),
      txt(x0 + minerW + (barW - minerW) / 2, 41, `${revenuePct}%`, {
        anchor: 'middle',
        fill: '#fff',
        weight: 600,
        size: 10,
      }),
      txt(x0 + barW + 10, 34, 'Displaced miner', { size: 10, fill: ink }),
      txt(x0 + barW + 10, 46, 'pull claim', { size: 9, fill: muted }),
      txt(x0, 66, `${minerPct}% is a claim the displaced miner withdraws.`, { size: 9.5, fill: muted }),
      txt(x0, 78, `${revenuePct}% becomes protocol revenue and enters the stream.`, { size: 9.5, fill: muted }),

      txt(x0, 106, 'EMPTY SLOT — NOBODY TO COMPENSATE', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      rect(x0, 114, barW, 26, pink),
      txt(x0 + barW / 2, 131, '100%', { anchor: 'middle', fill: '#fff', weight: 600, size: 11 }),
      txt(x0 + barW + 10, 131, 'All protocol revenue', { size: 10, fill: ink }),
    ].join(''),
    'Mining handoff payment split',
  );
};

/* --------------------------------------------------------- 2. price decay ---- */

const auctionDecay = () => {
  const ox = 40;
  const oy = 130;
  const w = 290;
  const h = 96;
  const fillAt = 0.55;

  const pts = `${ox},${oy - h} ${ox + w},${oy}`;
  const fx = ox + w * fillAt;
  const fy = oy - h * (1 - fillAt);

  return svg(
    186,
    [
      // axes
      line(ox, oy, ox + w + 8, oy, { stroke: rule, width: 1.2 }),
      line(ox, oy, ox, oy - h - 12, { stroke: rule, width: 1.2 }),
      txt(ox - 6, oy - h, 'start', { size: 9, fill: faint, anchor: 'end' }),
      txt(ox - 6, oy + 3, '0', { size: 9, fill: faint, anchor: 'end' }),
      txt(ox - 30, oy - h / 2, 'price', { size: 9.5, fill: muted, anchor: 'middle' }),
      txt(ox + w / 2, oy + 16, 'time elapsed in the epoch', { size: 9.5, fill: muted, anchor: 'middle' }),
      txt(ox + w + 10, oy + 3, 'D', { size: 10, fill: faint, family: MONO }),

      // the decay itself
      `<polyline points="${pts}" fill="none" stroke="${pink}" stroke-width="2" />`,

      // fill marker
      line(fx, fy, fx, oy, { stroke: blue, width: 1, dash: '3 3' }),
      line(ox, fy, fx, fy, { stroke: blue, width: 1, dash: '3 3' }),
      `<circle cx="${fx}" cy="${fy}" r="4" fill="${blue}" />`,
      txt(fx + 8, fy - 6, 'someone fills here', { size: 9.5, fill: blue, weight: 600 }),
      txt(fx + 8, fy + 6, 'they pay this much', { size: 9, fill: muted }),

      // next epoch
      txt(ox, oy + 36, 'The next epoch restarts at the price just paid × a fixed multiplier,', {
        size: 9.5,
        fill: muted,
      }),
      txt(ox, oy + 48, 'so a hot auction opens higher and an unfilled one keeps falling to zero.', {
        size: 9.5,
        fill: muted,
      }),
    ].join(''),
    'Descending-price auction',
  );
};

/* ---------------------------------------------------- 3. acquisition split ---- */

const acquisitionSplit = () => {
  const { fundBps, bribeBps } = contractConstants.bribeRouter;
  const fundPct = fundBps / 100;
  const bribePct = bribeBps / 100;
  const x0 = 8;
  const barW = 330;
  const fundW = (barW * fundPct) / 100;

  return svg(
    128,
    [
      txt(x0, 16, 'EVERY ACQUIRED PAYMENT', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      rect(x0, 26, fundW, 30, ink),
      rect(x0 + fundW, 26, barW - fundW, 30, pink),
      txt(x0 + fundW / 2, 46, `${fundPct}%`, { anchor: 'middle', fill: '#fff', weight: 600, size: 13 }),
      txt(x0 + fundW + (barW - fundW) / 2, 46, `${bribePct}%`, {
        anchor: 'middle',
        fill: '#fff',
        weight: 600,
        size: 10,
      }),
      txt(x0, 74, 'Fund', { size: 11, weight: 600, fill: ink }),
      txt(x0, 87, 'treasury backing for every GBX holder', { size: 9.5, fill: muted }),
      txt(x0 + fundW, 74, 'Signalers', { size: 11, weight: 600, fill: pink }),
      txt(x0 + fundW, 87, 'reward for signaling this Strategy', { size: 9.5, fill: muted }),
      txt(x0, 112, 'Fixed in code. No setter, no governance parameter, no caller-chosen destination.', {
        size: 9.5,
        fill: muted,
      }),
    ].join(''),
    'Acquisition payment split',
  );
};

/* ------------------------------------------------- 4. cumulative exactness ---- */

const cumulativeSplit = () => {
  const x0 = 30;
  const step = 34;
  const baseY = 96;

  const cells = [];
  for (let i = 1; i <= 10; i++) {
    const x = x0 + (i - 1) * step;
    const isLast = i === 10;
    cells.push(rect(x, baseY - 22, 26, 22, isLast ? pink : palette.paperTint, { rx: 2 }));
    cells.push(
      txt(x + 13, baseY - 7, isLast ? '1' : '0', {
        anchor: 'middle',
        size: 11,
        weight: 600,
        fill: isLast ? '#fff' : faint,
      }),
    );
    cells.push(txt(x + 13, baseY + 14, `${i}`, { anchor: 'middle', size: 8.5, fill: faint }));
    // carry bar
    const carry = (i % 10) / 10 || 1;
    cells.push(rect(x, baseY + 24, 26, 18 * (isLast ? 0 : carry), blue, { rx: 1, opacity: 0.55 }));
  }

  return svg(
    186,
    [
      txt(8, 16, 'TEN SEPARATE ONE-UNIT PAYMENTS', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(8, 32, 'Naive flooring would give the Bribe zero every time, forever.', { size: 9.5, fill: muted }),
      txt(8, 44, 'The carried remainder makes the tenth payment settle the debt exactly.', { size: 9.5, fill: muted }),
      txt(8, baseY - 7, 'to Bribe', { size: 9, fill: faint }),
      txt(8, baseY + 40, 'carry', { size: 9, fill: faint }),
      ...cells,
      line(x0, baseY + 2, x0 + step * 10 - 8, baseY + 2, { stroke: rule, width: 0.8 }),
      txt(8, 166, 'Cumulative result: Fund 9, Bribe 1, remainder 0 — identical to one lump payment of ten.', {
        size: 9.5,
        fill: ink,
      }),
    ].join(''),
    'Cumulative split exactness',
  );
};

/* -------------------------------------------------------- 5. reward stream ---- */

const streamSchedule = () => {
  const ox = 44;
  const oy = 108;
  const w = 300;
  const hiY = oy - 62;
  const loY = oy - 34;
  const breakX = ox + w * 0.42;

  return svg(
    174,
    [
      txt(8, 16, 'ONE SEVEN-DAY SCHEDULE', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(8, 32, 'The division remainder is not discarded — it is paid out one extra unit', { size: 9.5, fill: muted }),
      txt(8, 44, 'per second at the start, so every scheduled unit is emitted.', { size: 9.5, fill: muted }),

      line(ox, oy, ox + w + 8, oy, { stroke: rule, width: 1.2 }),
      line(ox, oy, ox, oy - 74, { stroke: rule, width: 1.2 }),

      rect(ox, hiY, breakX - ox, oy - hiY, pink, { rx: 0, opacity: 0.9 }),
      rect(breakX, loY, ox + w - breakX, oy - loY, pink, { rx: 0, opacity: 0.45 }),

      txt(ox + (breakX - ox) / 2, hiY - 8, 'rate + 1', { anchor: 'middle', size: 10, weight: 600, fill: pink }),
      txt(breakX + (ox + w - breakX) / 2, loY - 8, 'rate', { anchor: 'middle', size: 10, weight: 600, fill: muted }),

      line(breakX, oy, breakX, hiY - 4, { stroke: ink, width: 1, dash: '3 3' }),
      txt(breakX, oy + 14, 'remainderFinish', { anchor: 'middle', size: 9, fill: ink, family: MONO }),
      txt(ox, oy + 14, 't₀', { anchor: 'middle', size: 9.5, fill: faint }),
      txt(ox + w, oy + 14, 't₀ + 7 days', { anchor: 'middle', size: 9, fill: faint }),
      txt(ox - 32, oy - 40, 'USDG/s', { size: 9.5, fill: muted, anchor: 'middle' }),

      txt(8, 158, 'A one-raw-unit schedule still emits: the rate is zero and the single unit lands in second one.', {
        size: 9.5,
        fill: muted,
      }),
    ].join(''),
    'Reward stream with front-loaded remainder',
  );
};

/* ------------------------------------------------------ 6. halving schedule ---- */

const halvingCurve = () => {
  const ox = 44;
  const oy = 132;
  const w = 300;
  const top = 46;

  const steps = [
    { x: 0, w: 0.5, h: 1.0, label: 'u₀' },
    { x: 0.5, w: 0.25, h: 0.5, label: 'u₀/2' },
    { x: 0.75, w: 0.125, h: 0.25, label: 'u₀/4' },
    { x: 0.875, w: 0.0625, h: 0.125, label: '' },
    { x: 0.9375, w: 0.0625, h: 0.0625, label: '' },
  ];
  const H = oy - top;
  const tailY = oy - H * 0.05;

  const bars = steps
    .map((s) =>
      [
        rect(ox + w * s.x, oy - H * s.h, w * s.w - 1, H * s.h, pink, { rx: 0, opacity: 0.85 }),
        s.label
          ? txt(ox + w * s.x + (w * s.w) / 2, oy - H * s.h - 6, s.label, {
              anchor: 'middle',
              size: 9,
              fill: muted,
            })
          : '',
      ].join(''),
    )
    .join('');

  return svg(
    196,
    [
      txt(8, 16, 'GLOBAL RATE AGAINST CUMULATIVE MINING', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(8, 32, 'The thresholds halve too, so the whole schedule finishes below 2H —', { size: 9.5, fill: muted }),
      txt(8, 44, 'unlike a Bitcoin-style curve, where halvings continue indefinitely.', { size: 9.5, fill: muted }),

      line(ox, oy, ox + w + 30, oy, { stroke: rule, width: 1.2 }),
      line(ox, oy, ox, top - 6, { stroke: rule, width: 1.2 }),
      bars,

      // tail
      line(ox, tailY, ox + w + 26, tailY, { stroke: blue, width: 1.4, dash: '5 3' }),
      txt(ox + w + 30, tailY + 3, 'tail', { size: 9.5, fill: blue, weight: 600 }),

      // 2H marker
      line(ox + w, oy, ox + w, top - 6, { stroke: ink, width: 1, dash: '3 3' }),
      txt(ox + w, oy + 15, '2H', { anchor: 'middle', size: 10, fill: ink, family: MONO }),
      txt(ox, oy + 15, '0', { anchor: 'middle', size: 9, fill: faint }),
      txt(ox - 30, (oy + top) / 2, 'GBX/s', { size: 9.5, fill: muted, anchor: 'middle' }),

      txt(
        8,
        180,
        'After the last halving the rate is permanently the tail. Issuance never stops and never reaches zero.',
        {
          size: 9.5,
          fill: muted,
        },
      ),
    ].join(''),
    'Halving schedule and permanent tail',
  );
};

/* ------------------------------------------------- 7. signal allocation walk ---- */

const signalAllocation = () => {
  const ox = 52;
  const oy = 150;
  const colW = 88;
  const gap = 26;
  const H = 96;

  // Day shares from the article's worked example.
  const days = [
    {
      label: 'Day 1',
      parts: [
        ['A', 1000 / 4600],
        ['B', 3000 / 4600],
        ['C', 600 / 4600],
      ],
    },
    {
      label: 'Day 2',
      parts: [
        ['A', 4000 / 4600],
        ['B', 0],
        ['C', 600 / 4600],
      ],
    },
    {
      label: 'Day 3',
      parts: [
        ['A', 1],
        ['B', 0],
        ['C', 0],
      ],
    },
  ];
  const colour = { A: pink, B: ink, C: blue };

  const cols = days
    .map((d, i) => {
      const x = ox + i * (colW + gap);
      let y = oy;
      const stack = d.parts
        .filter(([, v]) => v > 0)
        .map(([k, v]) => {
          const h = H * v;
          y -= h;
          return [
            rect(x, y, colW, h, colour[k], { rx: 0 }),
            h > 14
              ? txt(x + colW / 2, y + h / 2 + 4, k, { anchor: 'middle', size: 11, weight: 600, fill: '#fff' })
              : '',
          ].join('');
        })
        .join('');
      return stack + txt(x + colW / 2, oy + 16, d.label, { anchor: 'middle', size: 10, fill: muted });
    })
    .join('');

  return svg(
    206,
    [
      txt(8, 16, 'WHERE ONE DAY OF REVENUE GOES', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(8, 32, 'Each day is the same 86,400 USDG, split by whoever is signaling at the time.', {
        size: 9.5,
        fill: muted,
      }),
      line(ox - 8, oy, ox + 3 * (colW + gap) - gap + 8, oy, { stroke: rule, width: 1.2 }),
      cols,
      txt(8, oy - H, '100%', { size: 9, fill: faint }),
      txt(8, oy, '0', { size: 9, fill: faint }),
      txt(8, 190, 'Day 2: Ben moves to A — Day 1 is already settled, so his move changes only later flow.', {
        size: 9.5,
        fill: muted,
      }),
      txt(8, 202, 'Day 3: Cara withdraws entirely, so A takes everything.', { size: 9.5, fill: muted }),
    ].join(''),
    'Signal allocation over three days',
  );
};

/* ------------------------------------------------------------ 8. redemption ---- */

const redemption = () => {
  const x0 = 8;
  const boxW = 128;

  return svg(
    166,
    [
      txt(x0, 16, 'REDEEMING', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),

      rect(x0, 26, boxW, 34, ink),
      txt(x0 + boxW / 2, 47, 'Burn your GBX', { anchor: 'middle', size: 10.5, fill: '#fff', weight: 600 }),

      txt(x0 + boxW + 14, 47, '→', { size: 14, fill: faint }),

      rect(x0 + boxW + 36, 26, boxW, 34, palette.paperTint),
      txt(x0 + boxW + 36 + boxW / 2, 41, 'Name the assets', { anchor: 'middle', size: 10, fill: ink, weight: 600 }),
      txt(x0 + boxW + 36 + boxW / 2, 53, 'you want', { anchor: 'middle', size: 9.5, fill: muted }),

      txt(x0 + 2 * boxW + 50, 47, '→', { size: 14, fill: faint }),

      rect(x0 + 2 * boxW + 72, 26, boxW - 20, 34, pink),
      txt(x0 + 2 * boxW + 72 + (boxW - 20) / 2, 47, 'Your slice', {
        anchor: 'middle',
        size: 10.5,
        fill: '#fff',
        weight: 600,
      }),

      txt(x0, 86, 'For each asset you name:', { size: 10, fill: ink, weight: 600 }),
      txt(x0, 104, 'floor( Fund’s balance × your GBX ÷ total GBX supply )', { size: 11, fill: pink, family: MONO }),

      txt(x0, 128, 'The supply is snapshotted after every miner is credited, so nobody is diluted by', {
        size: 9.5,
        fill: muted,
      }),
      txt(x0, 140, 'unminted rewards. Assets you leave out are forfeited — permanently, to everyone else.', {
        size: 9.5,
        fill: muted,
      }),
      txt(x0, 158, 'It is one atomic step. If any transfer fails, the burn is undone too.', { size: 9.5, fill: muted }),
    ].join(''),
    'Redemption',
  );
};

/* -------------------------------------------------------------- registry ---- */

const CHARTS = {
  'mining-split': {
    svg: miningSplit,
    caption:
      'Mining handoff. Taking an occupied slot compensates the miner you displaced; taking an empty one funds the protocol entirely.',
  },
  'auction-decay': {
    svg: auctionDecay,
    caption:
      'Both the mining slots and the Strategy auctions use the same shape: the asking price falls in a straight line to zero, and whoever thinks it is cheap enough fills it.',
  },
  'acquisition-split': {
    svg: acquisitionSplit,
    caption: 'Every asset the protocol acquires is divided by an immutable rule the moment it arrives.',
  },
  'cumulative-split': {
    svg: cumulativeSplit,
    caption:
      'Why the split carries its remainder: without it, an adversary paying in dust would starve the reward share permanently.',
  },
  'stream-schedule': {
    svg: streamSchedule,
    caption:
      'Revenue is released over seven days at a base rate plus a front-loaded remainder, so the schedule emits its exact total.',
  },
  'halving-curve': {
    svg: halvingCurve,
    caption:
      'Issuance halves at thresholds that themselves halve, so the entire schedule completes below twice the first threshold and then runs on a permanent tail.',
  },
  'signal-allocation': {
    svg: signalAllocation,
    caption: 'The worked example from the text: the same daily revenue, redirected as signalers change their minds.',
  },
  redemption: {
    svg: redemption,
    caption: 'Redemption in full. No queue, no gate, no discretion — only arithmetic against a snapshot.',
  },
};

/** Returns `{svg, caption}` for a named figure, or null when the id is unknown. */
export function chartFor(id) {
  const chart = CHARTS[id];
  if (!chart) return null;
  return { svg: chart.svg(), caption: chart.caption };
}

/** Every registered id, for the builder's error message. */
export function chartIds() {
  return Object.keys(CHARTS);
}
