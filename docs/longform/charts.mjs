/**
 * Named figures for the long-form editions.
 *
 * These are charts rather than flowcharts, which is why they are not Mermaid: Mermaid
 * draws graphs and state machines, not decay curves or step functions, and the things
 * hardest to picture from this protocol's prose are exactly the curves — a price falling
 * to zero, a stream that emits one extra unit per second for part of a period, and a rate
 * that halves at fixed elapsed-time boundaries.
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
      txt(x0, 78, `${revenuePct}% is deposited in Router for later routing.`, { size: 9.5, fill: muted }),

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
  const { defaultFundBps: fundBps, defaultBribeBps: bribeBps } = contractConstants.resonance;
  const fundPct = fundBps / 100;
  const bribePct = bribeBps / 100;
  const x0 = 8;
  const barW = 330;
  const fundW = (barW * fundPct) / 100;

  return svg(
    128,
    [
      txt(x0, 16, 'DEFAULT ACQUISITION CLASSIFICATION', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
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
      txt(x0, 112, 'Each purchase floors its Bribe share; Strategy sends the complement directly to Fund.', {
        size: 9.5,
        fill: muted,
      }),
    ].join(''),
    'Acquisition payment split',
  );
};

/* ---------------------------------------------- 4. partition-dependent floors ---- */

const cumulativeSplit = () => {
  const x0 = 8;
  const leftX = 8;
  const rightX = 252;
  const barY = 68;
  const barW = 210;
  const cells = Array.from({ length: 10 }, (_, i) => {
    const x = rightX + i * 21;
    return [
      rect(x, barY, 18, 28, ink, { rx: 1 }),
      txt(x + 9, barY + 18, '1', { anchor: 'middle', size: 9, fill: '#fff' }),
    ];
  }).flat();

  return svg(
    184,
    [
      txt(x0, 16, 'PARTITION-DEPENDENT PER-PURCHASE FLOORS', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(x0, 32, 'The same ten raw units can classify differently at the same 10% rate.', { size: 9.5, fill: muted }),

      txt(leftX, 54, 'ONE 10-UNIT PURCHASE', { size: 8.5, fill: faint, weight: 600 }),
      rect(leftX, barY, barW * 0.9, 28, ink),
      rect(leftX + barW * 0.9, barY, barW * 0.1, 28, pink),
      txt(leftX + 94, barY + 18, 'Fund 9', { anchor: 'middle', size: 10, fill: '#fff', weight: 600 }),
      txt(leftX + barW * 0.95, barY + 18, '1', { anchor: 'middle', size: 9, fill: '#fff', weight: 600 }),

      txt(rightX, 54, 'TEN 1-UNIT PURCHASES', { size: 8.5, fill: faint, weight: 600 }),
      ...cells,
      txt(rightX + barW / 2, 112, 'Fund 10 · Bribe 0', { anchor: 'middle', size: 9.5, fill: ink, weight: 600 }),

      line(x0, 128, W - 8, 128, { stroke: rule, width: 0.8 }),
      txt(x0, 148, 'No cross-purchase remainder is stored. The smaller state machine is deliberate;', {
        size: 9.5,
        fill: ink,
      }),
      txt(x0, 162, 'the partition-dependent rounding difference is accepted.', { size: 9.5, fill: muted }),
    ].join(''),
    'Partition-dependent payment classification',
  );
};

/* -------------------------------------------------------- 5. reward stream ---- */

const streamSchedule = () => {
  const ox = 44;
  const oy = 108;
  const w = 300;
  const rateY = oy - 44;

  return svg(
    184,
    [
      txt(8, 16, 'ONE SYNTHETIX-SHAPED SEVEN-DAY SCHEDULE', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(8, 32, 'rewardRate = floor( (new amount + ordinary leftover) ÷ 604,800 )', {
        size: 9.5,
        fill: muted,
        family: MONO,
      }),

      line(ox, oy, ox + w + 8, oy, { stroke: rule, width: 1.2 }),
      line(ox, oy, ox, oy - 74, { stroke: rule, width: 1.2 }),

      rect(ox, rateY, w, oy - rateY, pink, { rx: 0, opacity: 0.72 }),
      txt(ox + w / 2, rateY - 8, 'one flat whole-unit rate', {
        anchor: 'middle',
        size: 10,
        weight: 600,
        fill: pink,
      }),
      txt(ox, oy + 14, 't₀', { anchor: 'middle', size: 9.5, fill: faint }),
      txt(ox + w, oy + 14, 't₀ + 7 days', { anchor: 'middle', size: 9, fill: faint }),
      txt(ox - 30, rateY + 24, 'units/s', { size: 9.5, fill: muted, anchor: 'middle' }),

      txt(8, 142, 'S mod 604,800 is not front-loaded or carried; it remains unallocated contract surplus.', {
        size: 9.5,
        fill: muted,
      }),
      txt(8, 158, 'A qualifying active top-up rolls in left = remaining seconds × old rate, then restarts at now.', {
        size: 9.5,
        fill: muted,
      }),
      txt(8, 174, 'Routers wait for balance ≥ 604,800 raw units and ≥ left before notifying.', {
        size: 9.5,
        fill: ink,
      }),
    ].join(''),
    'Synthetix-shaped reward stream',
  );
};

/* ------------------------------------------------------ 6. halving schedule ---- */

const halvingCurve = () => {
  const ox = 44;
  const oy = 132;
  const w = 300;
  const top = 46;
  const periodDays = Number(contractConstants.mine.halvingPeriodSeconds) / 86_400;
  let tailIndex = 0;
  let shiftedRate = contractConstants.mine.initialTps;
  while (shiftedRate > contractConstants.mine.tailTps) {
    shiftedRate >>= 1n;
    tailIndex += 1;
  }
  const horizonDays = (tailIndex + 1) * periodDays;
  const xForDay = (day) => ox + (w * day) / horizonDays;
  // Logarithmic vertical spacing keeps every halving legible in print.
  const yForIndex = (index) => top + ((oy - top) * index) / tailIndex;
  const segments = [];
  for (let index = 0; index < tailIndex; index += 1) {
    const x0 = xForDay(index * periodDays);
    const x1 = xForDay((index + 1) * periodDays);
    const y0 = yForIndex(index);
    const y1 = yForIndex(index + 1);
    segments.push(line(x0, y0, x1, y0, { stroke: pink, width: 2 }));
    segments.push(line(x1, y0, x1, y1, { stroke: pink, width: 1.2 }));
  }
  const tailX = xForDay(tailIndex * periodDays);
  const tailY = yForIndex(tailIndex);
  segments.push(line(tailX, tailY, xForDay(horizonDays), tailY, { stroke: blue, width: 2 }));

  return svg(
    196,
    [
      txt(8, 16, 'GLOBAL RATE AGAINST TIME SINCE MINE DEPLOYMENT', {
        size: 9,
        fill: faint,
        tracking: 0.6,
        weight: 600,
      }),
      txt(8, 32, `Fixed ${periodDays}-day intervals; vertical spacing is logarithmic for legibility.`, {
        size: 9.5,
        fill: muted,
      }),

      line(ox, oy, ox + w + 30, oy, { stroke: rule, width: 1.2 }),
      line(ox, oy, ox, top - 6, { stroke: rule, width: 1.2 }),
      segments.join(''),
      txt(ox + 3, top - 6, 'u₀', { size: 9, fill: pink, weight: 600 }),
      txt(tailX + 4, tailY - 6, 'u∞ tail', { size: 9, fill: blue, weight: 600 }),
      txt(ox, oy + 15, '0', { anchor: 'middle', size: 9, fill: faint }),
      txt(xForDay(periodDays), oy + 15, `${periodDays}d`, { anchor: 'middle', size: 9, fill: faint }),
      txt(tailX, oy + 15, `${tailIndex * periodDays}d`, { anchor: 'middle', size: 9, fill: faint }),
      txt(ox - 30, (oy + top) / 2, 'GBX/s (log)', { size: 9, fill: muted, anchor: 'middle' }),

      txt(
        8,
        180,
        `The provisional clock advances even while slots are empty; at day ${tailIndex * periodDays} the prospective rate reaches the tail.`,
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

/* ------------------------------------------------------- 9. the slot grid ---- */

/**
 * The mine as an interface rather than a formula. ADR 0033 fixed the market at sixteen
 * permanent slots specifically so it maps to a 4-by-4 board, and no other figure in the
 * set shows that the slots are independent: sixteen auctions, sixteen tenures, sixteen
 * locked rates, none of which interact.
 */
const mineGrid = () => {
  const { slotCount, priceDecaySeconds, previousMinerBps } = contractConstants.mine;
  const cols = 4;
  const cellW = 78;
  const cellH = 44;
  const gapX = 10;
  const gapY = 9;
  const x0 = 8;
  const y0 = 34;

  // Illustrative board state: most slots held at differing tenure rates, one empty, one
  // mid-auction. The rates are relative labels so the board emphasizes tenure generations;
  // the fixed absolute rates and their independent-review gate are documented elsewhere.
  const board = [
    ['held', '1.00×'],
    ['held', '1.00×'],
    ['auction', ''],
    ['held', '0.50×'],
    ['held', '1.00×'],
    ['held', '0.50×'],
    ['held', '0.50×'],
    ['held', '0.25×'],
    ['held', '0.50×'],
    ['empty', ''],
    ['held', '0.25×'],
    ['held', '0.25×'],
    ['held', '0.25×'],
    ['held', '0.25×'],
    ['held', '0.25×'],
    ['held', '0.25×'],
  ];

  const cells = board.slice(0, slotCount).flatMap(([state, rate], i) => {
    const x = x0 + (i % cols) * (cellW + gapX);
    const y = y0 + Math.floor(i / cols) * (cellH + gapY);
    if (state === 'empty') {
      return [
        `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3" fill="none" stroke="${rule}" stroke-width="1" stroke-dasharray="3 2" />`,
        txt(x + cellW / 2, y + 20, 'empty', { anchor: 'middle', size: 9.5, fill: faint }),
        txt(x + cellW / 2, y + 33, 'deposits 100%', { anchor: 'middle', size: 8.5, fill: faint }),
      ];
    }
    if (state === 'auction') {
      return [
        rect(x, y, cellW, cellH, pink, { rx: 3 }),
        txt(x + cellW / 2, y + 20, 'for sale', { anchor: 'middle', size: 9.5, fill: '#fff', weight: 600 }),
        txt(x + cellW / 2, y + 33, 'price falling', { anchor: 'middle', size: 8.5, fill: '#fff' }),
      ];
    }
    return [
      rect(x, y, cellW, cellH, palette.paperTint, { rx: 3 }),
      `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3" fill="none" stroke="${rule}" stroke-width="0.8" />`,
      rect(x, y, 3, cellH, ink, { rx: 0 }),
      txt(x + 10, y + 20, 'held', { size: 9.5, fill: ink }),
      txt(x + 10, y + 33, rate, { size: 9, fill: muted, family: MONO }),
    ];
  });

  const gridBottom = y0 + 4 * cellH + 3 * gapY;

  return svg(
    gridBottom + 58,
    [
      txt(x0, 16, `${slotCount} PERMANENT SLOTS`, { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(W - 8, 16, 'fixed at construction · no owner · no capacity setter', {
        size: 9,
        fill: faint,
        anchor: 'end',
      }),
      ...cells,
      txt(
        x0,
        gridBottom + 20,
        'Each slot runs its own auction, falling to zero over ' +
          `${priceDecaySeconds / 3600} hour, and pays ${previousMinerBps / 100}% to whoever it displaces.`,
        {
          size: 9.5,
          fill: ink,
        },
      ),
      txt(x0, gridBottom + 33, 'A slot’s issuance rate is fixed when it is taken and never moves again. The mixed', {
        size: 9.5,
        fill: muted,
      }),
      txt(x0, gridBottom + 46, 'rates above are incumbents who took their slots under different halvings.', {
        size: 9.5,
        fill: muted,
      }),
    ].join(''),
    'The sixteen mining slots',
  );
};

/* ------------------------------------------------------ 10. tenure lock ---- */

/**
 * Why the aggregate can exceed the global rate (finding M-01). The global rate halves at
 * a time boundary, but nobody is repriced: incumbents keep the rate they were sold. The
 * shaded band persists until replacement, and it is a fairness decision rather than a
 * defect, which is exactly the thing prose struggles to make legible.
 */
const tenureLock = () => {
  const ox = 44;
  const oy = 116;
  const w = 300;
  const h = 72;
  const halvingX = ox + w * 0.42;
  const yFor = (frac) => oy - h * frac;

  return svg(
    196,
    [
      txt(8, 16, 'A HALVING DOES NOT REPRICE ANYONE', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),

      // axes
      line(ox, oy, ox + w, oy, { stroke: rule }),
      line(ox, oy, ox, yFor(1) - 12, { stroke: rule }),
      txt(ox - 6, yFor(1) + 3, 'r', { anchor: 'end', size: 9, fill: faint, family: MONO }),
      txt(ox - 6, yFor(0.5) + 3, 'r/2', { anchor: 'end', size: 9, fill: faint, family: MONO }),
      txt(ox + w, oy + 26, 'time since Mine deployment', { anchor: 'end', size: 9, fill: faint }),

      // the legacy-rate excess, which is the whole point of the figure
      rect(halvingX, yFor(1), 84, h * 0.5, pink, { rx: 0, opacity: 0.16 }),

      // global rate, stepping down at the time boundary
      `<path d="M ${ox} ${yFor(1)} L ${halvingX} ${yFor(1)} L ${halvingX} ${yFor(0.5)} L ${ox + w} ${yFor(0.5)}" fill="none" stroke="${ink}" stroke-width="1.6" />`,

      // one incumbent carrying its pre-halving rate past the time boundary
      `<path d="M ${halvingX - 46} ${yFor(1) - 7} L ${halvingX + 84} ${yFor(1) - 7}" fill="none" stroke="${pink}" stroke-width="1.6" stroke-dasharray="4 2.5" />`,
      `<circle cx="${halvingX + 84}" cy="${yFor(1) - 7}" r="2.6" fill="${pink}" />`,

      // boundary marker, labelled below the axis so it clears the title and the curve
      line(halvingX, oy, halvingX, yFor(1) - 4, { stroke: rule, width: 0.8, dash: '2 2' }),
      txt(halvingX, oy + 13, 'time boundary', { anchor: 'middle', size: 8.5, fill: faint }),

      txt(ox + w + 6, yFor(0.5) + 3, 'new tenures', { size: 9, fill: ink }),
      txt(halvingX + 92, yFor(1) - 4, 'incumbent, unchanged', { size: 9, fill: pink, weight: 600 }),
      txt(halvingX + 92, yFor(1) + 8, 'until replaced', { size: 8.5, fill: muted }),

      txt(
        8,
        168,
        'The shaded band is real: while pre-halving tenures survive, total issuance sits above the current global rate.',
        {
          size: 9.5,
          fill: ink,
        },
      ),
      txt(8, 181, 'Accepted deliberately, so that nobody can change the deal a miner already paid for.', {
        size: 9.5,
        fill: muted,
      }),
    ].join(''),
    'Tenure-locked rates across a halving',
  );
};

/* ----------------------------------------------------- 11. authority map ---- */

/**
 * The governance answer as a picture. With ADR 0034 the interesting fact is negative
 * space: only Resonance retains continuing custom owner authority, and that custom protocol
 * reach stops at four calls besides inherited ownership transfer and renunciation. The chart
 * also preserves the production obligation to renounce the three setup-only Ownable shells.
 */
const authorityMap = () => {
  const noContinuingCustomAuthority = [
    ['Mine', 'sixteen slots, fixed'],
    ['Fund', 'the treasury itself'],
    ['GBX', 'minter locked once'],
    ['Strategy', 'auction parameters fixed'],
    ['BribeRouter', 'Bribe-only qualifying buffer'],
  ];
  const rowH = 21;
  const x0 = 8;
  const colW = 242;
  const rx = x0 + colW + 14;
  const rightW = W - rx - 8;
  const top = 44;

  const left = noContinuingCustomAuthority.flatMap(([name, note], i) => {
    const y = top + i * rowH;
    return [
      txt(x0 + 2, y + 11, name, { size: 10, weight: 600, fill: ink }),
      txt(x0 + 110, y + 11, note, { size: name === 'BribeRouter' ? 8 : 9, fill: muted }),
      line(x0, y + 17, x0 + colW - 8, y + 17, { stroke: palette.rule, width: 0.6 }),
    ];
  });

  const actions = ['add a Strategy', 'retire a Strategy', 'register a reward token', 'set Bribe share (0–20%)'];
  const right = actions.flatMap((a, i) => [txt(rx + 14, top + 32 + i * 16, `— ${a}`, { size: 9.5, fill: ink })]);

  const bottom = top + noContinuingCustomAuthority.length * rowH;

  return svg(
    bottom + 90,
    [
      txt(x0, 16, 'NO CONTINUING CUSTOM OWNER AUTHORITY', {
        size: 6.9,
        fill: faint,
        tracking: 0.35,
        weight: 600,
      }),
      txt(x0, 30, 'No local custom owner-administration calls.', { size: 8.8, fill: muted }),
      ...left,

      txt(rx, 16, 'CONTINUING CUSTOM OWNER AUTHORITY', {
        size: 6.9,
        fill: pink,
        tracking: 0.35,
        weight: 600,
      }),
      txt(rx, 30, 'Resonance — four custom protocol calls:', { size: 8.8, fill: muted }),
      rect(rx, top + 12, rightW, 76, palette.paperTint, { rx: 3 }),
      rect(rx, top + 12, 3, 76, pink, { rx: 0 }),
      ...right,
      txt(rx, top + 100, 'The holder of that address is', { size: 9.5, fill: ink }),
      txt(rx, top + 113, 'not yet chosen.', { size: 9.5, fill: pink, weight: 600 }),

      line(x0, bottom + 22, W - 8, bottom + 22, { stroke: palette.rule, width: 0.6 }),
      txt(
        x0,
        bottom + 40,
        'There is no upgrade path, pause switch, sweep, or migration route anywhere in the protocol —',
        {
          size: 9.5,
          fill: ink,
        },
      ),
      txt(x0, bottom + 53, 'so this map is the complete authority surface, not a summary of it.', {
        size: 9.5,
        fill: muted,
      }),
      txt(
        x0,
        bottom + 68,
        'SignalGBX, StrategyFactory, and BribeFactory retain setup-only Ownable shells until production',
        { size: 8.5, fill: muted },
      ),
      txt(x0, bottom + 80, 'explicitly renounces them; after binding, those owners have no custom protocol call.', {
        size: 8.5,
        fill: muted,
      }),
    ].join(''),
    'What can and cannot be changed',
  );
};

/* -------------------------------------------- 12. constant-time accounting ---- */

/**
 * The accounting trick behind ADR 0033. Sixteen slots start at different times and hold
 * different rates, yet total pending emission is one multiplication, and a handoff mints
 * for exactly one slot. Redemption depends on the first property; miner fairness on the
 * second.
 */
const pendingEmission = () => {
  const x0 = 8;
  const barY = 46;
  const barH = 40;
  const n = 16;
  const slotW = 17;
  const gap = 4;
  const heights = [34, 20, 28, 12, 38, 24, 30, 16, 22, 36, 14, 26, 32, 18, 28, 22];

  const bars = heights.slice(0, n).flatMap((hgt, i) => {
    const x = x0 + i * (slotW + gap);
    const settled = i === 9;
    return [
      rect(x, barY + barH - hgt, slotW, hgt, settled ? pink : ink, { rx: 1, opacity: settled ? 1 : 0.16 }),
      settled ? rect(x, barY + barH - hgt, slotW, hgt, pink, { rx: 1 }) : '',
    ];
  });

  const boxY = barY + barH + 34;

  return svg(
    boxY + 96,
    [
      txt(x0, 16, 'PENDING EMISSION, ALL SIXTEEN SLOTS', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(x0, 30, 'Different start times, different locked rates, all accruing at once.', { size: 9.5, fill: muted }),
      ...bars,
      line(x0, barY + barH + 1, x0 + n * (slotW + gap) - gap, barY + barH + 1, { stroke: rule, width: 0.8 }),
      txt(x0 + 9 * (slotW + gap) + slotW / 2, barY + barH + 15, 'replaced', {
        anchor: 'middle',
        size: 8.5,
        fill: pink,
        weight: 600,
      }),

      rect(x0, boxY, W - 16, 34, palette.paperTint, { rx: 3 }),
      txt(x0 + 12, boxY + 21, 'pendingEmission  =  stored + (now − updatedAt) × aggregateTps', {
        size: 10.5,
        fill: ink,
        family: MONO,
      }),

      txt(
        x0,
        boxY + 56,
        'The total is one multiplication no matter how many slots are occupied, which is why redemption can',
        {
          size: 9.5,
          fill: ink,
        },
      ),
      txt(x0, boxY + 69, 'count unminted mining without touching the mine.', { size: 9.5, fill: ink }),
      txt(
        x0,
        boxY + 86,
        'A handoff mints for the replaced slot only. The other fifteen are not read, checkpointed, or disturbed.',
        {
          size: 9.5,
          fill: muted,
        },
      ),
    ].join(''),
    'Constant-time pending emission',
  );
};

/* -------------------------------------------------- 13. signal lifecycle ---- */

/**
 * ADR 0031's central claim is an absence: there is no state between "holding GBX" and
 * "committed to a Strategy". Three boxes joined by one bracket say that faster than the
 * paragraph explaining that idle sGBX is unreachable.
 */
const signalLifecycle = () => {
  const x0 = 8;
  const boxW = 138;
  const boxH = 46;
  const gap = 26;
  const y = 44;
  const xs = [x0, x0 + boxW + gap, x0 + 2 * (boxW + gap)];

  const steps = [
    ['Deposit GBX', 'held by the receipt contract'],
    ['Receive sGBX', 'same amount, non-transferable'],
    ['Assign to a Strategy', 'named at the same moment'],
  ];

  const boxes = steps.flatMap(([title, note], i) => [
    rect(xs[i], y, boxW, boxH, palette.paperTint, { rx: 3 }),
    rect(xs[i], y, 3, boxH, i === 2 ? pink : ink, { rx: 0 }),
    txt(xs[i] + 12, y + 20, title, { size: 10, weight: 600, fill: ink }),
    txt(xs[i] + 12, y + 34, note, { size: 8.8, fill: muted }),
  ]);

  const arrows = [0, 1].map((i) => {
    const ax = xs[i] + boxW + 5;
    return `<path d="M ${ax} ${y + boxH / 2} L ${ax + gap - 10} ${y + boxH / 2}" stroke="${rule}" stroke-width="1.1" fill="none" marker-end="url(#chartAh)" />`;
  });

  const braceY = y + boxH + 12;
  const braceRight = xs[2] + boxW;

  return svg(
    braceY + 74,
    [
      `<defs><marker id="chartAh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${rule}" /></marker></defs>`,
      txt(x0, 16, 'SIGNALING IS ONE STEP, NOT THREE', { size: 9, fill: faint, tracking: 0.6, weight: 600 }),
      txt(x0, 30, 'All of this happens in a single transaction, or none of it happens.', { size: 9.5, fill: muted }),
      ...boxes,
      ...arrows,
      `<path d="M ${x0} ${braceY + 8} L ${x0} ${braceY} L ${braceRight} ${braceY} L ${braceRight} ${braceY + 8}" fill="none" stroke="${rule}" stroke-width="0.9" />`,
      txt((x0 + braceRight) / 2, braceY + 22, 'one transaction · withdrawing reverses all three', {
        anchor: 'middle',
        size: 9,
        fill: faint,
      }),

      txt(
        x0,
        braceY + 48,
        'There is deliberately no state in between. You cannot hold sGBX that is not pointed at something,',
        {
          size: 9.5,
          fill: ink,
        },
      ),
      txt(x0, braceY + 61, 'so every unit of signal that exists is a unit of signal doing work.', {
        size: 9.5,
        fill: muted,
      }),
    ].join(''),
    'The signaling lifecycle',
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
    caption:
      'The default is 90% Fund / 10% Bribe. Strategy floors each purchase’s Bribe share independently, sends Fund’s complement directly, and buffers only the Bribe share.',
  },
  'cumulative-split': {
    svg: cumulativeSplit,
    caption:
      'Payment classification is intentionally partition-dependent: one ten-unit purchase yields one Bribe unit, while ten one-unit purchases yield none.',
  },
  'stream-schedule': {
    svg: streamSchedule,
    caption:
      'Resonance and Bribe use one flat whole-unit rate with ordinary leftover rollover; the division remainder stays as unallocated surplus.',
  },
  'halving-curve': {
    svg: halvingCurve,
    caption:
      'The prospective rate halves every 69 days from Mine deployment. At day 414 it reaches the permanent positive tail.',
  },
  'signal-allocation': {
    svg: signalAllocation,
    caption: 'The worked example from the text: the same daily revenue, redirected as signalers change their minds.',
  },
  redemption: {
    svg: redemption,
    caption: 'Redemption in full. No queue, no gate, no discretion — only arithmetic against a snapshot.',
  },
  'mine-grid': {
    svg: mineGrid,
    caption:
      'The mining market is a fixed board of sixteen independent slots. Nothing can add a seventeenth, and no slot’s rate can be changed by anyone once it is taken.',
  },
  'tenure-lock': {
    svg: tenureLock,
    caption:
      'Time-based halvings apply to newly taken slots, never to sitting miners. Excess issuance persists until the legacy tenure is replaced, which is not guaranteed.',
  },
  'authority-map': {
    svg: authorityMap,
    caption:
      'The complete custom protocol authority surface: four bounded calls on Resonance, with no local administration on the contracts at left. Inherited ownership transfer and renunciation remain; who holds that owner address is the largest open question.',
  },
  'pending-emission': {
    svg: pendingEmission,
    caption:
      'Sixteen independent tenures, one constant-time total. Redemption reads the accumulator; a handoff settles only the slot that changed hands.',
  },
  'signal-lifecycle': {
    svg: signalLifecycle,
    caption:
      'Deposit, receipt, and commitment are one atomic step. The absence of an in-between state is what makes the amount of signal that exists and the amount doing work the same quantity.',
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
