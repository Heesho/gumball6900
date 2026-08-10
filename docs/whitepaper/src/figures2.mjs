/**
 * Additional figures for the expanded edition.
 *
 * Same rules as `figures.mjs`: geometry from the models, one colour grammar (blue is USDG
 * arriving, pink is the holder-directed chain, graphite is GBX supply and burns), and no
 * hand-transcribed numbers - anything numeric is computed in `worked.mjs`,
 * `protocol-facts.mjs`, or `model.mjs` and formatted here.
 */

import { palette } from './theme.mjs';
import {
  arrowDefs,
  axisX,
  axisY,
  circle,
  elbow,
  figure,
  label,
  line,
  linearScale,
  node,
  path,
  polyline,
  rect,
  text,
  widths,
} from './svg.mjs';
import { schedule } from './protocol-facts.mjs';
import { fmtGBX, fmtUSDG, worked } from './worked.mjs';
import { emissionSchedule } from './model.mjs';

const flow = {
  capital: palette.blue,
  signal: palette.pink,
  asset: palette.pink,
  supply: palette.graphite,
};

const markers = arrowDefs(flow);

const WAD = 10n ** 18n;

/* ---------------------------------------------------------- drawing system ---- */

/**
 * One geometry and type system for all twenty-six figures in this module, so that a
 * reader turning pages sees the same corner radius, the same stroke ladder, the same
 * box padding and the same footnote band every time.
 */

/** Corner radii. Chips and bars are tighter than cards; grouping panels are looser. */
const R = { chip: 2, card: 3, panel: 4.5 };

/** Stroke ladder. Nothing in this module uses a weight that is not on it. */
const W = { hair: 0.5, rule: 0.7, card: 0.8, thin: 1, flow: 1.4, spine: 2.2 };

/** Type ladder in points. `hero` is the one value a figure exists to show. */
const T = { hero: 10.6, title: 8, sub: 6.8, note: 6.4, small: 6.2, micro: 5.8 };

/** Horizontal padding inside every box. */
const PAD = 8;

/** The footnote band: rule offset, first baseline, leading, and tail clearance. */
const FOOT = { rule: 8, first: 16.5, lead: 10, tail: 3 };

/** Wrap to a character budget and return the lines, so callers can size before drawing. */
function wrapLines(value, maxChars) {
  const words = String(value).split(' ');
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function wrapText(parts, value, { x, y, size, fill, maxChars, leading, weight = 400, anchor = 'start' }) {
  wrapLines(value, maxChars).forEach((lineText, index) => {
    parts.push(text(lineText, { x, y: y + index * leading, size, fill, weight, anchor }));
  });
}

/** Pick the arrowhead that matches a connector's colour, so head and line never disagree. */
function markerFor(color) {
  if (color === palette.blue) return 'arrow-capital';
  if (color === palette.pink) return 'arrow-asset';
  return 'arrow-supply';
}

/** Rough advance width, used to size chips around their own text. */
function measure(value, size, weight = 400) {
  return String(value).length * size * (weight >= 600 ? 0.53 : 0.5);
}

/** The module's card: a tinted surface with an accent spine down its left edge. */
function surface(parts, { x, y, width: w, height: h, r = R.card, fill = palette.paperTint, stroke, dash, accent }) {
  parts.push(rect({ x, y, width: w, height: h, r, fill, stroke: stroke ?? 'none', strokeWidth: W.card, dash }));
  if (accent) parts.push(rect({ x, y, width: W.spine, height: h, r: W.spine / 2, fill: accent }));
}

/** Hairline used inside a card to separate its header from its body. */
function divider(parts, { x, y, width: w, opacity = 1 }) {
  parts.push(line({ x1: x, y1: y, x2: x + w, y2: y, stroke: palette.rule, width: W.hair, opacity }));
}

/** Split notes into rendered lines at the figure measure, before the height is fixed. */
function footNotes(notes, width) {
  const maxChars = Math.max(24, Math.floor(width / (T.note * 0.52)));
  return notes.filter(Boolean).flatMap((entry) => {
    const value = typeof entry === 'string' ? entry : entry.text;
    const rest = typeof entry === 'string' ? {} : entry;
    if (rest.eyebrow) return [{ ...rest, text: value }];
    return wrapLines(value, maxChars).map((lineText) => ({ ...rest, text: lineText }));
  });
}

const footHeight = (count) => FOOT.first + Math.max(0, count - 1) * FOOT.lead + FOOT.tail;

/** Draw the footnote band under `top`. Every figure carrying a note ends this way. */
function footBand(parts, { width, top, notes = [], right, rightFill = palette.inkMuted }) {
  parts.push(line({ x1: 0, y1: top + FOOT.rule, x2: width, y2: top + FOOT.rule, stroke: palette.rule, width: W.hair }));

  notes.forEach((entry, index) => {
    const y = top + FOOT.first + index * FOOT.lead;
    if (entry.eyebrow) {
      parts.push(label(entry.text, { x: 0, y, fill: entry.fill ?? palette.inkFaint }));
      return;
    }
    parts.push(
      text(entry.text, { x: 0, y, size: T.note, weight: entry.weight ?? 400, fill: entry.fill ?? palette.inkMuted }),
    );
  });

  if (right) parts.push(text(right, { x: width, y: top + FOOT.first, size: T.note, fill: rightFill, anchor: 'end' }));
}

/* ------------------------------------------------- ninety-second pipeline ---- */

/**
 * The whole lifecycle as one row of eight moves.
 *
 * The paper's hero explainer, so it is built on a rail: a single hairline runs the full
 * measure behind the cards and surfaces in each gap as a coloured arrowhead, which makes
 * eight boxes read as one continuous strip rather than eight islands. Inside each card the
 * grid is fixed - ordinal, rule, verb, gloss - so the eye can scan any one band across all
 * eight without re-finding it.
 */
export function ninetySeconds({ width = widths.full } = {}) {
  const parts = [];
  const stepsRow = [
    { t: 'Mine', s: 'USDG in, GBX out', k: 'capital' },
    { t: 'Stake', s: '1 GBX = 1 sGBX', k: 'signal' },
    { t: 'Signal', s: 'point weight', k: 'signal' },
    { t: 'Route', s: 'USDG follows it', k: 'capital' },
    { t: 'Acquire', s: 'auction fills', k: 'asset' },
    { t: 'Reward', s: 'optional streams', k: 'asset' },
    { t: 'Fund', s: 'shared backing', k: 'asset' },
    { t: 'Redeem', s: 'burn for assets', k: 'supply' },
  ];
  const gap = 7;
  const w = (width - gap * (stepsRow.length - 1)) / stepsRow.length;
  const top = 6;
  const cardH = 54;
  const rail = top + 26;

  parts.push(line({ x1: 0, y1: rail, x2: width, y2: rail, stroke: palette.rule, width: W.hair }));

  stepsRow.forEach((step, index) => {
    const x = index * (w + gap);
    const accent = flow[step.k];

    parts.push(
      rect({ x, y: top, width: w, height: cardH, r: R.card, fill: palette.paper, stroke: accent, strokeWidth: W.card }),
    );
    parts.push(rect({ x, y: top, width: W.spine, height: cardH, r: W.spine / 2, fill: accent }));
    parts.push(text(String(index + 1), { x: x + PAD, y: top + 12, size: T.small, weight: 600, fill: accent }));
    divider(parts, { x: x + PAD, y: top + 16, width: w - PAD - 6, opacity: 0.9 });
    parts.push(text(step.t, { x: x + PAD, y: top + 30, size: T.title, weight: 600, fill: palette.ink }));
    wrapText(parts, step.s, {
      x: x + PAD,
      y: top + 41,
      size: T.micro,
      fill: palette.inkMuted,
      maxChars: 15,
      leading: 7.6,
    });

    if (index < stepsRow.length - 1) {
      parts.push(
        path(`M${x + w + 0.8},${rail} L${x + w + gap - 1.2},${rail}`, {
          stroke: accent,
          strokeWidth: W.thin,
          marker: `arrow-${step.k}`,
        }),
      );
    }
  });

  const notes = footNotes(
    ['Every move is a separate permissionless transaction. None is required to follow the last.'],
    width,
  );
  const contentBottom = top + cardH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes, right: 'Steps 2, 3 and 6 are optional.' });

  return figure({ width, height, defs: markers, children: parts.join(''), title: 'GumBall6900 in eight moves' });
}

/* -------------------------------------------------------- participant map ---- */

/**
 * Twelve roles on a four-by-three grid.
 *
 * The tinted card wall this replaced gave every role the same visual weight and read as
 * texture rather than information. Here the surface is dropped: an accent spine carries the
 * colour grammar, hairlines separate the rows, and the reader's own row - the last cell -
 * is the single filled block, so the grid has somewhere to land.
 */
export function participantMap({ width = widths.full } = {}) {
  const parts = [];
  const cols = 4;
  const gap = 8;
  const w = (width - gap * (cols - 1)) / cols;
  const roles = [
    ['Contributor / miner', 'Sends USDG, claims the epoch’s GBX', 'capital'],
    ['GBX holder', 'Holds, trades, burns, or redeems', 'supply'],
    ['Staker / signaler', 'Stakes into sGBX, points weight', 'signal'],
    ['Auction buyer', 'Fills a Strategy’s USDG lot', 'asset'],
    ['Reward notifier', 'Independently funds a registered token', 'asset'],
    ['Reward claimant', 'Claims accrued streams', 'asset'],
    ['Redeemer', 'Burns GBX for selected assets', 'supply'],
    ['Maintenance caller', 'Settles, routes, harvests, burns, pays liabilities', 'capital'],
    ['Manager (timelock)', 'Adds or kills Strategies, registers reward tokens', 'signal'],
    ['Token issuer', 'Controls each external asset’s own rules', 'supply'],
    ['Frontend / subgraph', 'Presentation only; no protocol authority', 'capital'],
    ['You, reading this', 'Verify before you interact', 'signal'],
  ];

  const rowPitch = 50;
  const cellH = 42;
  const top = 2;
  const focus = roles.length - 1;

  for (let row = 1; row < Math.ceil(roles.length / cols); row += 1) {
    divider(parts, { x: 0, y: top + row * rowPitch - 5, width });
  }

  roles.forEach((role, index) => {
    const x = (index % cols) * (w + gap);
    const y = top + Math.floor(index / cols) * rowPitch;
    const accent = flow[role[2]];
    const lead = index === focus;

    if (lead) parts.push(rect({ x, y, width: w, height: cellH, r: R.card, fill: palette.pink }));
    parts.push(rect({ x, y, width: W.spine, height: cellH, r: W.spine / 2, fill: lead ? palette.paper : accent }));
    parts.push(
      text(role[0], { x: x + 10, y: y + 12, size: 7.4, weight: 600, fill: lead ? palette.paper : palette.ink }),
    );
    wrapText(parts, role[1], {
      x: x + 10,
      y: y + 23,
      size: T.small,
      fill: lead ? palette.paper : palette.inkMuted,
      maxChars: 32,
      leading: 8.4,
    });
  });

  const height = top + 2 * rowPitch + cellH + 4;

  return figure({ width, height, children: parts.join(''), title: 'Twelve participant roles' });
}

/* ------------------------------------------------------ onchain / offchain ---- */

/**
 * What the contracts enforce, against what they merely depend on.
 *
 * Two floating panels used to imply the boundary; now one panel is split by a real dashed
 * rule and the sentence that names that boundary sits on top of it, so the punchline and
 * the geometry are the same object.
 */
export function onchainOffchain({ width = widths.full } = {}) {
  const parts = [];

  const columns = [
    {
      x: 0,
      title: 'Enforced onchain',
      accent: palette.blue,
      items: [
        'GBX supply, mint ceiling, burns',
        'Contributions, emissions, claims',
        'Staking, absolute signals, weights',
        'USDG routing and allocation',
        'Auction prices and settlement',
        'Reward streams and claims',
        'Fund balances and redemption',
        'LP custody and fee harvesting',
      ],
    },
    {
      x: width / 2,
      title: 'Offchain or externally dependent',
      accent: palette.pink,
      items: [
        'Frontend, subgraph, RPC, wallet',
        'Token metadata and asset discovery',
        'Market prices and liquidity',
        'Each token issuer’s own controls',
        'Legal rights behind wrapped assets',
        'The chain itself and its operators',
        'Independent audits (none yet)',
        'Your own key management',
      ],
    },
  ];

  const rowTop = 56;
  const rowPitch = 14.6;
  const bodyBottom = rowTop + 7 * rowPitch;
  const height = bodyBottom + 14;

  parts.push(rect({ x: 0, y: 0, width, height, r: R.panel, fill: palette.paperTint, opacity: 0.7 }));

  // The claim in the caption is that a boundary exists, so the figure draws it.
  parts.push(
    text('The paper’s guarantees stop at this line', {
      x: width / 2,
      y: 15,
      size: T.note,
      fill: palette.inkFaint,
      anchor: 'middle',
    }),
  );
  parts.push(
    line({
      x1: width / 2,
      y1: 23,
      x2: width / 2,
      y2: height - 10,
      stroke: palette.ruleStrong,
      width: W.rule,
      dash: '2.4 2.4',
    }),
  );

  columns.forEach((column) => {
    parts.push(label(column.title, { x: column.x + 14, y: 38, fill: column.accent }));
    column.items.forEach((item, index) => {
      const y = rowTop + index * rowPitch;
      parts.push(circle({ cx: column.x + 17, cy: y - 2.4, r: 1.6, fill: column.accent }));
      parts.push(text(item, { x: column.x + 25, y, size: T.sub, fill: palette.ink }));
    });
  });

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'What the contracts enforce versus what they depend on',
  });
}

/* ------------------------------------------- integer schedule end behaviour ---- */

/**
 * The end of the integer schedule: the last few decades of daily emissions on a log-like
 * downsampled axis, annotated with the exact final epoch and remainder.
 */
export function integerScheduleEnd({ width = widths.full } = {}) {
  const parts = [];
  const plotX = 44;
  const plotW = width - plotX - 10;
  const plotY = 18;
  const plotH = 94;

  // Sample the replayed schedule every ~2 years across the full run.
  const days = Number(schedule.nonzeroEpochs);
  const sampled = [];
  const full = emissionSchedule(days);
  for (let index = 0; index < days; index += 730) sampled.push(full[index]);
  sampled.push(full[days - 1]);

  const x = linearScale([0, days / 365], [plotX, plotX + plotW]);
  // Log10 of daily emission in wei, from 1 wei (0) up to the initial (~5.67e23).
  const logOf = (wei) => (wei <= 0n ? 0 : Math.log10(Number(wei)));
  const top = logOf(full[0].daily);
  const y = linearScale([0, top], [plotY + plotH, plotY]);

  const points = sampled.map((entry) => ({ years: entry.day / 365, log: logOf(entry.daily) }));

  [0, 6, 12, 18, 23].forEach((decade) => {
    const yy = y(decade);
    parts.push(
      line({
        x1: plotX,
        y1: yy,
        x2: plotX + plotW,
        y2: yy,
        stroke: decade === 0 ? palette.ruleStrong : palette.rule,
        width: W.hair,
      }),
    );
    parts.push(
      text(decade === 0 ? '1 wei' : `1e${decade}`, {
        x: plotX - 5,
        y: yy + 2.2,
        size: T.micro,
        fill: palette.inkFaint,
        anchor: 'end',
      }),
    );
  });
  parts.push(label('daily emission, wei (log scale)', { x: plotX, y: plotY - 6, fill: palette.inkFaint }));

  parts.push(
    path(
      polyline(
        points,
        (p) => x(p.years),
        (p) => y(p.log),
      ),
      {
        stroke: palette.graphite,
        strokeWidth: 1.4,
      },
    ),
  );

  parts.push(
    axisX({
      scale: x,
      y: plotY + plotH,
      ticks: [0, 50, 100, 150, 200, 250, Math.round(days / 365)],
      format: (v) => `${v}y`,
      title: 'years since launch',
    }),
  );

  // The end of the schedule is the whole point of the chart, so it carries the only
  // saturated mark: a dashed cut-off, a ringed terminal dot, and the two lines that name it.
  const endX = x(days / 365);
  parts.push(
    line({ x1: endX, y1: plotY, x2: endX, y2: plotY + plotH, stroke: palette.pink, width: W.card, dash: '2.4 2.2' }),
  );
  parts.push(circle({ cx: endX, cy: y(0), r: 2.8, fill: palette.paper, stroke: palette.pink, strokeWidth: W.thin }));
  parts.push(
    text(`epoch ${schedule.lastNonzeroEpochIndex.toLocaleString('en-US')}: 1 wei`, {
      x: endX - 6,
      y: plotY + 9,
      size: T.note,
      weight: 600,
      fill: palette.pink,
      anchor: 'end',
    }),
  );
  parts.push(
    text(`epoch ${schedule.nonzeroEpochs.toLocaleString('en-US')} onward: zero`, {
      x: endX - 6,
      y: plotY + 19,
      size: T.small,
      fill: palette.inkMuted,
      anchor: 'end',
    }),
  );

  const notes = footNotes(
    [
      `Total nonzero epochs: ${schedule.nonzeroEpochs.toLocaleString('en-US')} · emitted if every epoch is claimed: ${fmtGBX(schedule.cumulativeEmitted, 6)} GBX · unminted remainder: ${schedule.unmintedRemainder.toLocaleString('en-US')} wei`,
    ],
    width,
  );
  const contentBottom = plotY + plotH + 34;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    children: parts.join(''),
    title: `The integer emission schedule ends after ${schedule.nonzeroEpochs.toLocaleString('en-US')} nonzero epochs`,
  });
}

/* --------------------------------------------------------- epoch scenarios ---- */

/**
 * Quiet, crowded, and empty days share one fixed emission very differently.
 *
 * The two GBX figures are the comparison, so they are the only type at hero size; the
 * denominators and captions drop to micro and recede. The empty day is drawn hollow -
 * dashed outline, no tint - because nothing happens on it.
 */
export function epochScenarios({ width = widths.full } = {}) {
  const parts = [];
  const gap = 10;
  const w = (width - gap * 2) / 3;
  const emission = worked.epochEmission;
  const top = 2;
  const cardH = 106;

  const scenario = (x, title, body, contributed, mayaGets, accent, hollow = false) => {
    surface(parts, {
      x,
      y: top,
      width: w,
      height: cardH,
      r: R.panel,
      fill: hollow ? palette.paper : palette.paperTint,
      stroke: hollow ? palette.ruleStrong : undefined,
      dash: hollow ? '2.6 2.4' : undefined,
      accent,
    });
    parts.push(label(title, { x: x + 12, y: top + 16, fill: accent }));
    parts.push(text(body, { x: x + 12, y: top + 29, size: T.note, fill: palette.inkMuted }));
    divider(parts, { x: x + 12, y: top + 37, width: w - 24 });
    parts.push(text('Total contributed', { x: x + 12, y: top + 49, size: T.micro, fill: palette.inkFaint }));
    parts.push(
      text(contributed, {
        x: x + 12,
        y: top + 62,
        size: T.hero,
        weight: 600,
        fill: hollow ? palette.inkMuted : palette.blue,
      }),
    );
    parts.push(text('1,000 USDG earns', { x: x + 12, y: top + 78, size: T.micro, fill: palette.inkFaint }));
    parts.push(
      text(mayaGets, {
        x: x + 12,
        y: top + 91,
        size: T.hero,
        weight: 600,
        fill: hollow ? palette.inkMuted : palette.graphite,
      }),
    );
    parts.push(
      text(`of ${fmtGBX(emission, 2)} GBX scheduled`, {
        x: x + 12,
        y: top + 102,
        size: T.micro,
        fill: palette.inkFaint,
      }),
    );
  };

  const quiet = (emission * 1_000n) / 10_000n;
  const crowded = (emission * 1_000n) / 40_000n;
  scenario(0, 'Quiet day', '10,000 USDG competes', '10,000 USDG', `${fmtGBX(quiet, 2)} GBX`, palette.blue);
  scenario(w + gap, 'Crowded day', '40,000 USDG competes', '40,000 USDG', `${fmtGBX(crowded, 2)} GBX`, palette.pink);
  scenario((w + gap) * 2, 'Empty day', 'Nobody contributes', '0 USDG', 'nothing to claim', palette.graphite, true);

  const notes = footNotes(
    ['The schedule advances on wall-clock time. The empty day’s emission is forfeited forever.'],
    width,
  );
  const contentBottom = top + cardH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'The same scheduled emission under three participation levels',
  });
}

/* ------------------------------------------------------ allocated vs idle ---- */

/**
 * One account's stake, split by where its weight points.
 *
 * The total is promoted to hero type because it is the quantity being divided; segment
 * names move above the bar so nothing sits under it competing with the footnote, and the
 * idle segment is drawn hollow rather than tinted, which is what "earns nothing" looks like.
 */
export function allocatedIdle({ width = widths.full } = {}) {
  const parts = [];
  const barY = 36;
  const barH = 26;
  const total = worked.maya.staked;
  const segs = [
    { name: 'NVDA-linked Strategy', amount: worked.maya.toNvda, color: palette.pink },
    { name: 'AAPL-linked Strategy', amount: worked.maya.toAapl, color: palette.blue },
    { name: 'Idle (unallocated)', amount: worked.maya.idle, color: palette.graphite, idle: true },
  ];

  parts.push(text(`Maya’s ${fmtGBX(total, 0)} sGBX`, { x: 0, y: 14, size: T.hero, weight: 600, fill: palette.ink }));

  let x = 0;
  segs.forEach((seg) => {
    const w = (Number(seg.amount / WAD) / Number(total / WAD)) * width;
    parts.push(
      rect({
        x,
        y: barY,
        width: w - 1.6,
        height: barH,
        r: R.chip,
        fill: seg.idle ? palette.paper : seg.color,
        stroke: seg.idle ? seg.color : 'none',
        strokeWidth: W.card,
        dash: seg.idle ? '2.6 2.4' : undefined,
      }),
    );
    parts.push(text(seg.name, { x, y: barY - 7, size: T.small, fill: palette.inkMuted }));
    parts.push(
      text(fmtGBX(seg.amount, 0), {
        x: x + 9,
        y: barY + 17,
        size: 8.6,
        weight: 600,
        fill: seg.idle ? palette.graphite : palette.paper,
      }),
    );
    x += w;
  });

  const notes = footNotes(
    [
      'Idle sGBX earns nothing, directs nothing, dilutes nobody - and can be unstaked immediately.',
      'Allocated sGBX stays staked until its signals are removed.',
    ],
    width,
  );
  const contentBottom = barY + barH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({ width, height, children: parts.join(''), title: 'Allocated versus idle sGBX in one account' });
}

/* ---------------------------------------------------- incremental signals ---- */

/**
 * Before/after bars: one removeSignal call trims one Strategy and touches nothing else.
 *
 * The old pair of bars left the reader to diff two rows of numbers. Leader lines now drop
 * from each boundary in the "before" bar: the untouched NVDA boundary drops straight as a
 * hairline, and the boundary that moved carries a pink arrow across the gap it travelled.
 * That single arrow is the figure.
 */
export function incrementalSignals({ width = widths.full } = {}) {
  const parts = [];
  const rows = [
    {
      label: 'Before',
      segs: [
        { v: worked.maya.toNvda, c: palette.pink },
        { v: worked.maya.toAapl, c: palette.blue },
        { v: worked.maya.idle, c: palette.graphite, idle: true },
      ],
    },
    {
      label: `After removeSignal(AAPL, ${fmtGBX(worked.maya.aaplTrim, 0)})`,
      segs: [
        { v: worked.maya.toNvda, c: palette.pink },
        { v: worked.maya.aaplAfterTrim, c: palette.blue },
        { v: worked.maya.idle + worked.maya.aaplTrim, c: palette.graphite, idle: true },
      ],
    },
  ];
  const total = worked.maya.staked;
  const barH = 22;
  const barY = [14, 74];
  const span = (value) => (Number(value / WAD) / Number(total / WAD)) * width;

  rows.forEach((row, rowIndex) => {
    const y = barY[rowIndex];
    parts.push(label(row.label, { x: 0, y: y - 6, fill: rowIndex === 0 ? palette.inkFaint : palette.pink }));

    let x = 0;
    row.segs.forEach((seg) => {
      const w = span(seg.v);
      parts.push(
        rect({
          x,
          y,
          width: Math.max(0, w - 1.6),
          height: barH,
          r: R.chip,
          fill: seg.idle ? palette.paper : seg.c,
          stroke: seg.idle ? seg.c : 'none',
          strokeWidth: W.card,
          dash: seg.idle ? '2.6 2.4' : undefined,
        }),
      );
      parts.push(
        text(fmtGBX(seg.v, 0), {
          x: x + 7,
          y: y + 14.4,
          size: 7,
          weight: 600,
          fill: seg.idle ? palette.graphite : palette.paper,
        }),
      );
      x += w;
    });
  });

  // Two boundaries, drawn so the reader can see which one held and which one moved.
  const heldX = span(worked.maya.toNvda);
  const fromX = span(worked.maya.toNvda + worked.maya.toAapl);
  const toX = span(worked.maya.toNvda + worked.maya.aaplAfterTrim);
  const channel = 52;

  parts.push(line({ x1: heldX, y1: barY[0] + barH, x2: heldX, y2: barY[1], stroke: palette.rule, width: W.hair }));
  parts.push(
    line({ x1: fromX, y1: barY[0] + barH, x2: fromX, y2: channel, stroke: palette.pink, width: W.hair, dash: '2 2' }),
  );
  parts.push(line({ x1: toX, y1: channel, x2: toX, y2: barY[1], stroke: palette.pink, width: W.hair, dash: '2 2' }));
  parts.push(
    path(`M${fromX},${channel} L${toX + 1},${channel}`, {
      stroke: palette.pink,
      strokeWidth: W.thin,
      marker: 'arrow-signal',
    }),
  );

  const notes = footNotes(
    [
      `The amount is a delta, not a target. The NVDA signal is untouched; the freed ${fmtGBX(worked.maya.aaplTrim, 0)} sGBX becomes immediately withdrawable.`,
    ],
    width,
  );
  const contentBottom = barY[1] + barH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    defs: markers,
    children: parts.join(''),
    title: 'One incremental removal against one Strategy',
  });
}

/* ------------------------------------------------------------ swap and pop ---- */

export function swapAndPop({ width = widths.main } = {}) {
  const parts = [];
  const gap = 6;
  const cell = (width - gap * 3) / 4;
  const cellH = 22;
  const cx = (index) => index * (cell + gap) + cell / 2;
  const rowY = [16, 66];

  const row = (y, items, { struck = -1, moved = -1 } = {}) => {
    items.forEach((name, index) => {
      const x = index * (cell + gap);
      const isStruck = index === struck;
      const isMoved = index === moved;
      parts.push(
        rect({
          x,
          y,
          width: cell,
          height: cellH,
          r: R.chip,
          fill: isStruck ? palette.paper : isMoved ? palette.paperTintWarm : palette.paperTint,
          stroke: isStruck || isMoved ? palette.pink : 'none',
          strokeWidth: W.card,
          dash: isStruck ? '2.4 2.2' : undefined,
        }),
      );
      parts.push(
        text(name, {
          x: x + cell / 2,
          y: y + 13.6,
          size: T.note,
          weight: 600,
          anchor: 'middle',
          fill: isStruck ? palette.pink : palette.ink,
        }),
      );
      if (isStruck) {
        const half = measure(name, T.note, 600) / 2 + 2;
        parts.push(
          line({
            x1: x + cell / 2 - half,
            y1: y + 11.2,
            x2: x + cell / 2 + half,
            y2: y + 11.2,
            stroke: palette.pink,
            width: W.thin,
          }),
        );
      }
    });
  };

  parts.push(label('Account strategy list before', { x: 0, y: 10, fill: palette.inkFaint }));
  parts.push(
    text('remove AAPL (its signal reached zero)', {
      x: width,
      y: 10,
      size: T.note,
      weight: 600,
      fill: palette.pink,
      anchor: 'end',
    }),
  );
  row(rowY[0], ['NVDA', 'AAPL', 'TSLA', 'GBX'], { struck: 1 });

  parts.push(label('After: last entry swapped in, list popped', { x: 0, y: 52, fill: palette.inkFaint }));
  row(rowY[1], ['NVDA', 'GBX', 'TSLA'], { moved: 1 });

  // The move runs through a clear channel below the labels, so nothing crosses type.
  parts.push(
    path(`M${cx(3)},${rowY[0] + cellH} L${cx(3)},60 L${cx(1)},60 L${cx(1)},${rowY[1] - 1.6}`, {
      stroke: palette.graphite,
      strokeWidth: 0.9,
      dash: '2.4 2.2',
      marker: 'arrow-supply',
    }),
  );

  const notes = footNotes(
    ['Order is not meaningful; membership is. Removal costs the same wherever the entry sits.'],
    width,
  );
  const contentBottom = rowY[1] + cellH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({ width, height, defs: markers, children: parts.join(''), title: 'Swap-and-pop list maintenance' });
}

/* ---------------------------------------------------------- revenue carry ---- */

/**
 * Tiny revenue is carried exactly until it can advance the index.
 *
 * Four stages on one internal grid: title, rule, body, then the running value pinned to a
 * common baseline so the four values line up and read as a single sequence across the row.
 */
export function revenueCarry({ width = widths.full } = {}) {
  const parts = [];
  const w = worked;
  const stages = [
    {
      title: '0.00005 USDG arrives',
      body: `Weight ${fmtGBX(w.tiny.totalWeight, 0)} sGBX. Too small for one index step.`,
      value: 'carry: 0.000050',
      accent: palette.blue,
    },
    {
      title: 'Nothing is lost',
      body: 'The full amount waits as scaled carry. No Strategy is looped.',
      value: 'index: +0',
      accent: palette.graphite,
    },
    {
      title: '0.15 USDG arrives later',
      body: 'Combined carry now crosses the index resolution.',
      value: 'index: +1 step',
      accent: palette.pink,
    },
    {
      title: 'Strategies accrue',
      body: `${fmtUSDG(w.tinyFollowup.allocations[0].amount, 6)} / ${fmtUSDG(w.tinyFollowup.allocations[1].amount, 6)} / ${fmtUSDG(w.tinyFollowup.allocations[2].amount, 6)} USDG`,
      value: `carry: ${fmtUSDG(w.tinyFollowup.carriedScaled / WAD, 6)}`,
      accent: palette.blue,
    },
  ];
  const gap = 8;
  const cw = (width - gap * 3) / 4;
  const top = 4;
  const cardH = 90;

  stages.forEach((stage, index) => {
    const x = index * (cw + gap);
    surface(parts, { x, y: top, width: cw, height: cardH, r: R.panel, accent: stage.accent });
    parts.push(text(stage.title, { x: x + PAD + 2, y: top + 15, size: 7.2, weight: 600, fill: palette.ink }));
    divider(parts, { x: x + PAD + 2, y: top + 21, width: cw - PAD - 10 });
    wrapText(parts, stage.body, {
      x: x + PAD + 2,
      y: top + 32,
      size: T.small,
      fill: palette.inkMuted,
      maxChars: 28,
      leading: 8.6,
    });
    divider(parts, { x: x + PAD + 2, y: top + 70, width: cw - PAD - 10 });
    parts.push(text(stage.value, { x: x + PAD + 2, y: top + 82, size: 7.2, weight: 600, fill: stage.accent }));

    if (index < stages.length - 1) {
      parts.push(
        path(`M${x + cw + 0.8},${top + cardH / 2} L${x + cw + gap - 1.2},${top + cardH / 2}`, {
          stroke: stage.accent,
          strokeWidth: W.thin,
          marker: markerFor(stage.accent),
        }),
      );
    }
  });

  const notes = footNotes(
    [
      `Numbers computed by the worked model at ${fmtGBX(w.tiny.totalWeight, 0)} sGBX of total weight. Anyone may call indexPendingRevenue() to convert waiting carry.`,
    ],
    width,
  );
  const contentBottom = top + cardH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    defs: markers,
    children: parts.join(''),
    title: 'Sub-resolution revenue is carried, never lost',
  });
}

/* ---------------------------------------------------------- carry boundary ---- */

/**
 * A-09: carry is divided by the weight that exists when it finally crosses resolution.
 *
 * The two panels are deliberately unequal. Conservation is settled, so it sits in the plain
 * tint; the open finding takes the warm tint and a pink outline, which is where the eye
 * should land on a page about an unresolved issue.
 */
export function carryBoundary({ width = widths.full } = {}) {
  const parts = [];
  const half = width / 2 - 8;
  const top = 2;
  const panelH = 104;

  const panel = (x, title, rows, accent, conclusion, open = false) => {
    surface(parts, {
      x,
      y: top,
      width: half,
      height: panelH,
      r: R.panel,
      fill: open ? palette.paperTintWarm : palette.paperTint,
      stroke: open ? palette.pink : undefined,
    });
    parts.push(label(title, { x: x + 12, y: top + 16, fill: accent }));
    divider(parts, { x: x + 12, y: top + 22, width: half - 24 });
    rows.forEach((rowText, index) => {
      const y = top + 36 + index * 15;
      parts.push(circle({ cx: x + 15, cy: y - 2.2, r: 1.6, fill: accent }));
      parts.push(text(rowText, { x: x + 23, y, size: T.note, fill: palette.ink }));
    });
    divider(parts, { x: x + 12, y: top + 86, width: half - 24 });
    parts.push(text(conclusion, { x: x + 12, y: top + 97, size: T.sub, weight: 600, fill: accent }));
  };

  panel(
    0,
    'What conservation proves',
    [
      '99 base units arrive; two incumbents hold all weight',
      'The 99 units wait as exact carry',
      'No unit is ever lost or double-counted',
    ],
    palette.blue,
    'Solvency holds exactly.',
  );
  panel(
    width - half,
    'What A-09 permits (open finding)',
    [
      'New signal doubles the weight after the value arrived',
      '101 more units push the carry over the threshold',
      'The late weight shares value that predates it',
    ],
    palette.pink,
    'Attribution across time is not guaranteed.',
    true,
  );

  const notes = footNotes(
    [
      'Bound: under totalSignalWeight / 1e18 base units per bucket - negligible at 18 decimals, up to 1,000 whole tokens at 6.',
    ],
    width,
  );
  const contentBottom = top + panelH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'A-09: conserved carry can cross a signal-supply boundary',
  });
}

/* ------------------------------------------------------- live versus killed ---- */

/**
 * Revenue for live and killed Strategies.
 *
 * Rebuilt as two lanes hanging off one source. The three boxes used to sit in a row with
 * connectors doubling back across their own labels; now Resonance forks once, the live lane
 * carries a solid blue arrow and the killed lane a struck dead path, and each lane runs
 * straight down to its own terminal without crossing the other.
 */
export function liveVsKilled({ width = widths.full } = {}) {
  const parts = [];
  const boxW = 168;
  const boxH = 32;
  const srcW = 150;
  const srcY = 4;
  const midY = 70;
  const endY = 126;
  const forkY = 50;
  const liveCx = 6 + boxW / 2;
  const killCx = width - 6 - boxW / 2;

  // Connectors first, so every box sits cleanly on top of them.
  parts.push(
    path(`M${width / 2},${srcY + boxH} L${width / 2},${forkY} L${liveCx},${forkY} L${liveCx},${midY - 1.6}`, {
      stroke: palette.blue,
      strokeWidth: W.flow,
      marker: 'arrow-capital',
    }),
  );
  parts.push(
    path(`M${width / 2},${srcY + boxH} L${width / 2},${forkY} L${killCx},${forkY} L${killCx},${midY - 4}`, {
      stroke: palette.rule,
      strokeWidth: W.thin,
      dash: '1.8 2.2',
    }),
  );
  // The killed lane receives nothing new, so its inbound path is struck out, not drawn.
  parts.push(line({ x1: killCx - 4.6, y1: 57.4, x2: killCx + 4.6, y2: 66.6, stroke: palette.graphite, width: W.thin }));
  parts.push(line({ x1: killCx + 4.6, y1: 57.4, x2: killCx - 4.6, y2: 66.6, stroke: palette.graphite, width: W.thin }));

  parts.push(
    path(`M${liveCx},${midY + boxH} L${liveCx},${endY - 1.6}`, {
      stroke: palette.pink,
      strokeWidth: W.flow,
      marker: 'arrow-asset',
    }),
  );
  parts.push(
    path(`M${killCx - 60},${midY + boxH} L${killCx - 60},${endY - 1.6}`, {
      stroke: palette.graphite,
      strokeWidth: W.thin,
      marker: 'arrow-supply',
    }),
  );

  parts.push(
    node({
      x: width / 2 - srcW / 2,
      y: srcY,
      width: srcW,
      height: boxH,
      title: 'Resonance',
      subtitle: 'indexed USDG',
      accent: palette.blue,
    }),
  );
  parts.push(
    node({
      x: 6,
      y: midY,
      width: boxW,
      height: boxH,
      title: 'Live Strategy',
      subtitle: 'claimable revenue',
      accent: palette.pink,
    }),
  );
  parts.push(
    node({
      x: width - boxW - 6,
      y: midY,
      width: boxW,
      height: boxH,
      title: 'Killed Strategy',
      subtitle: 'no future USDG',
      accent: palette.graphite,
    }),
  );
  parts.push(
    node({
      x: liveCx - 55,
      y: endY,
      width: 110,
      height: 26,
      title: 'distribute()',
      accent: palette.pink,
      titleSize: 7.2,
    }),
  );
  parts.push(
    node({
      x: killCx - 84,
      y: endY,
      width: 168,
      height: 26,
      title: 'Fund liability',
      subtitle: 'payFundRevenue(), anyone',
      accent: palette.graphite,
      titleSize: 7.2,
    }),
  );

  parts.push(
    text('already-indexed and future value', {
      x: killCx - 66,
      y: 116,
      size: T.small,
      fill: palette.inkMuted,
      anchor: 'end',
    }),
  );
  parts.push(
    text('existing signal stays removable', { x: width, y: 116, size: T.small, fill: palette.pink, anchor: 'end' }),
  );

  return figure({
    width,
    height: endY + 30,
    defs: markers,
    children: parts.join(''),
    title: 'Revenue for live and killed Strategies',
  });
}

/* ------------------------------------------------------ complete-lot pricing ---- */

/**
 * Complete-lot pricing: payment follows the clock, the lot follows deposits.
 *
 * The two series measure different things in different units, so plotting them against one
 * y-axis was simply wrong - the reader could read a crossing that means nothing. They are
 * now stacked in two lanes over a shared time axis, each with its own scale and title, and
 * the consequence moves to the footnote band so the chart gets the full measure.
 */
export function lotPricing({ width = widths.full } = {}) {
  const parts = [];
  const plotX = 40;
  const plotW = width - plotX - 10;
  const priceTop = 20;
  const priceH = 54;
  const lotTop = 96;
  const lotH = 40;
  const axisYPos = lotTop + lotH;

  const x = linearScale([0, 24], [plotX, plotX + plotW]);
  const yPrice = linearScale([0, 60], [priceTop + priceH, priceTop]);
  const yLot = linearScale([0, 8000], [axisYPos, lotTop]);

  parts.push(label('required payment for the whole lot', { x: plotX, y: priceTop - 8, fill: palette.pink }));
  parts.push(axisY({ scale: yPrice, x: plotX, x2: plotX + plotW, ticks: [0, 20, 40, 60] }));
  parts.push(
    path(`M${x(0)},${yPrice(60)} L${x(24)},${yPrice(0)} L${x(0)},${yPrice(0)} Z`, { fill: palette.pink, opacity: 0.1 }),
  );
  parts.push(path(`M${x(0)},${yPrice(60)} L${x(24)},${yPrice(0)}`, { stroke: palette.pink, strokeWidth: 1.6 }));
  parts.push(circle({ cx: x(0), cy: yPrice(60), r: 2.4, fill: palette.pink }));
  parts.push(circle({ cx: x(24), cy: yPrice(0), r: 2.4, fill: palette.pink }));

  parts.push(label('USDG in the lot (grows mid-epoch)', { x: plotX, y: lotTop - 8, fill: palette.blue }));
  const steps = `M${x(0)},${yLot(4000)} L${x(9)},${yLot(4000)} L${x(9)},${yLot(6173)} L${x(17)},${yLot(6173)} L${x(17)},${yLot(7500)} L${x(24)},${yLot(7500)}`;
  parts.push(path(`${steps} L${x(24)},${yLot(0)} L${x(0)},${yLot(0)} Z`, { fill: palette.blue, opacity: 0.12 }));
  parts.push(path(steps, { stroke: palette.blue, strokeWidth: 1.5 }));

  parts.push(axisX({ scale: x, y: axisYPos, ticks: [0, 6, 12, 18, 24], format: (v) => `${v}h`, title: 'epoch time' }));

  const notes = footNotes(
    [
      { text: 'Consequence', eyebrow: true, fill: palette.pink },
      'The clock prices the lot, not the token. More USDG entering mid-epoch makes the same payment buy more, so the effective rate is path-dependent.',
    ],
    width,
  );
  const contentBottom = axisYPos + 24;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'Complete-lot pricing: payment follows the clock, the lot follows deposits',
  });
}

/* --------------------------------------------------------- zero-price fill ---- */

/**
 * A late fill can clear at zero; the next epoch restarts from the floor.
 *
 * On one linear axis the recovery epochs sat within a point of the baseline and every
 * annotation piled onto the same sliver. The chart is now two panels on a shared time axis:
 * the first opening at full scale, and a magnified detail panel carrying the restart ladder,
 * tied to the sliver it expands by two leader lines. No axis is distorted to make it fit.
 */
export function zeroPriceTimeline({ width = widths.full } = {}) {
  const parts = [];
  const plotX = 44;
  const plotW = width - plotX - 10;
  const plotTop = 18;
  const plotBottom = 102;

  const x = linearScale([0, 3], [plotX, plotX + plotW]);
  const y = linearScale([0, 60], [plotBottom, plotTop]);

  parts.push(label('payment for the lot', { x: plotX, y: plotTop - 6, fill: palette.inkFaint }));
  parts.push(axisY({ scale: y, x: plotX, x2: plotX + plotW, ticks: [0, 20, 40, 60] }));

  // Epoch 1 at full scale: the opening price decays to nothing and a buyer takes the lot.
  parts.push(path(`M${x(0)},${y(60)} L${x(1)},${y(0)}`, { stroke: palette.pink, strokeWidth: 1.6 }));
  parts.push(
    path(`M${x(1)},${y(1.2)} L${x(1.8)},${y(0.24)}`, { stroke: palette.pink, strokeWidth: 1.2, opacity: 0.4 }),
  );
  parts.push(
    path(`M${x(1.8)},${y(0.48)} L${x(2.6)},${y(0.1)}`, { stroke: palette.pink, strokeWidth: 1.2, opacity: 0.4 }),
  );
  parts.push(
    path(`M${x(2.6)},${y(0.96)} L${x(3)},${y(0.8)}`, { stroke: palette.pink, strokeWidth: 1.2, opacity: 0.4 }),
  );
  parts.push(circle({ cx: x(1), cy: y(0), r: 2.8, fill: palette.paper, stroke: palette.pink, strokeWidth: W.thin }));

  parts.push(text('nobody fills; price reaches zero', { x: x(0.52), y: y(42), size: T.note, fill: palette.inkMuted }));

  // The sliver every later epoch lives inside, and the callout that magnifies it. Drawn as
  // a box floating in the plot's empty quadrant rather than a second panel below the axis,
  // which would read as negative payment.
  const insetX = x(1.3);
  const insetW = x(3) - insetX;
  const insetTop = 24;
  const insetH = 50;
  const bandTop = y(1.35);

  parts.push(
    rect({ x: x(1), y: bandTop, width: x(3) - x(1), height: y(0) - bandTop, fill: palette.pink, opacity: 0.16 }),
  );
  parts.push(line({ x1: x(1), y1: bandTop, x2: x(3), y2: bandTop, stroke: palette.pink, width: W.hair }));
  parts.push(
    line({
      x1: x(1),
      y1: bandTop,
      x2: insetX,
      y2: insetTop + insetH,
      stroke: palette.inkFaint,
      width: W.hair,
      dash: '1.6 2.2',
    }),
  );
  parts.push(
    line({
      x1: x(3),
      y1: bandTop,
      x2: insetX + insetW,
      y2: insetTop + insetH,
      stroke: palette.inkFaint,
      width: W.hair,
      dash: '1.6 2.2',
    }),
  );

  parts.push(
    rect({
      x: insetX,
      y: insetTop,
      width: insetW,
      height: insetH,
      r: R.chip,
      fill: palette.paperTint,
      stroke: palette.ruleStrong,
      strokeWidth: W.hair,
    }),
  );

  const xi = linearScale([1, 3], [insetX + 10, insetX + insetW - 10]);
  const yi = linearScale([0, 1.35], [insetTop + insetH - 8, insetTop + 14]);

  [1.8, 2.6].forEach((at) => {
    parts.push(
      line({
        x1: xi(at),
        y1: insetTop + 4,
        x2: xi(at),
        y2: insetTop + insetH - 4,
        stroke: palette.rule,
        width: W.hair,
      }),
    );
  });
  parts.push(path(`M${xi(1)},${yi(1.2)} L${xi(1.8)},${yi(0.24)}`, { stroke: palette.pink, strokeWidth: 1.5 }));
  parts.push(path(`M${xi(1.8)},${yi(0.48)} L${xi(2.6)},${yi(0.1)}`, { stroke: palette.pink, strokeWidth: 1.5 }));
  parts.push(
    path(`M${xi(2.6)},${yi(0.96)} L${xi(3)},${yi(0.8)}`, { stroke: palette.pink, strokeWidth: 1.5, opacity: 0.7 }),
  );
  parts.push(circle({ cx: xi(1.8), cy: yi(0.24), r: 2.2, fill: palette.graphite }));
  parts.push(circle({ cx: xi(2.6), cy: yi(0.1), r: 2.2, fill: palette.graphite }));

  parts.push(
    text('restart at minimumPrice', { x: insetX + 10, y: insetTop + 10, size: T.small, fill: palette.inkMuted }),
  );
  // The inset's y-axis is expanded about 44x (0-60 outside, 0-1.35 inside). Without saying so,
  // the magnified restart ladder reads as payment jumping back to ~45, which is the opposite
  // of what happens.
  parts.push(
    text('detail: y-scale expanded ~44x', {
      x: insetX + insetW - 10,
      y: insetTop + 10,
      size: T.micro,
      fill: palette.inkFaint,
      anchor: 'end',
    }),
  );
  parts.push(
    text('recovery is geometric: each fill multiplies the next open by 1.1x-3x', {
      x: insetX + insetW - 5,
      y: insetTop + insetH + 11,
      size: T.small,
      fill: palette.inkMuted,
      anchor: 'end',
    }),
  );

  // The fill at zero is the claim in the title, so it is labelled last, over a paper
  // knockout, and therefore sits above the leader it would otherwise be crossed by.
  const fillLabel = 'a buyer takes the whole lot for 0';
  const fillW = measure(fillLabel, T.note, 600);
  parts.push(rect({ x: x(1) + 5, y: y(24) - 7, width: fillW + 6, height: 10, fill: palette.paper }));
  parts.push(text(fillLabel, { x: x(1) + 8, y: y(24), size: T.note, weight: 600, fill: palette.pink }));

  parts.push(axisX({ scale: x, y: plotBottom, ticks: [0, 1, 2], format: (v) => `epoch ${v}`, title: '' }));
  parts.push(
    text('epoch 3', { x: plotX + plotW, y: plotBottom + 10.2, size: T.micro, fill: palette.inkFaint, anchor: 'end' }),
  );

  const notes = footNotes(
    ['Accepted A-05 behaviour: the protocol prefers giving the lot away to trusting an oracle.'],
    width,
  );
  const contentBottom = plotBottom + 16;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'A late fill can clear at zero; the next epoch restarts from the floor',
  });
}

/* ------------------------------------------------------- payment settlement ---- */

/**
 * Settlement: the complete payment is Fund-bound.
 *
 * One left-to-right chain on a single row, with the buyer feeding it from above and the
 * Bribe hung below the router it is not paid by. That reroute is the whole fix: previously
 * the "no auction share ever" path ran diagonally across the Bribe box and its own label.
 */
export function paymentSettlement({ width = widths.full } = {}) {
  const parts = [];
  const boxW = 140;
  const boxH = 32;
  const rowY = 62;
  const midY = rowY + boxH / 2;
  const bribeY = 122;
  const centreX = width / 2;
  const rightX = width - boxW;

  // Connectors first; boxes are drawn over them.
  parts.push(
    path(`M${boxW / 2},${8 + boxH} L${boxW / 2},${rowY - 1.6}`, {
      stroke: palette.pink,
      strokeWidth: W.flow,
      marker: 'arrow-asset',
    }),
  );
  parts.push(
    path(`M${boxW},${midY} L${centreX - boxW / 2 - 1.6},${midY}`, {
      stroke: palette.pink,
      strokeWidth: W.flow,
      marker: 'arrow-asset',
    }),
  );
  parts.push(
    path(`M${centreX + boxW / 2},${midY} L${rightX - 1.6},${midY}`, {
      stroke: palette.pink,
      strokeWidth: W.flow,
      dash: '3 2.4',
      marker: 'arrow-asset',
    }),
  );

  // The path that does NOT exist: drawn faint, struck, and given its own clear lane.
  parts.push(
    path(`M${centreX},${rowY + boxH} L${centreX},${bribeY - 2}`, {
      stroke: palette.rule,
      strokeWidth: W.thin,
      dash: '1.6 2.2',
    }),
  );
  parts.push(
    line({ x1: centreX - 4.6, y1: 103.4, x2: centreX + 4.6, y2: 112.6, stroke: palette.inkFaint, width: W.thin }),
  );
  parts.push(
    line({ x1: centreX + 4.6, y1: 103.4, x2: centreX - 4.6, y2: 112.6, stroke: palette.inkFaint, width: W.thin }),
  );
  parts.push(
    text('no auction share ever', {
      x: centreX + 12,
      y: 110.4,
      size: T.note,
      weight: 600,
      fill: palette.inkFaint,
    }),
  );

  parts.push(
    node({
      x: 0,
      y: 8,
      width: boxW,
      height: boxH,
      title: 'Noor (buyer)',
      subtitle: 'pays the payment token',
      accent: palette.pink,
    }),
  );
  parts.push(
    node({
      x: 0,
      y: rowY,
      width: boxW,
      height: boxH,
      title: 'Strategy',
      subtitle: 'hands over its USDG lot',
      accent: palette.blue,
    }),
  );
  parts.push(
    node({
      x: centreX - boxW / 2,
      y: rowY,
      width: boxW,
      height: boxH,
      title: 'BribeRouter',
      subtitle: '100% Fund liability',
      accent: palette.pink,
    }),
  );
  parts.push(
    node({
      x: rightX,
      y: rowY,
      width: boxW,
      height: boxH,
      title: 'Fund',
      subtitle: 'paid by anyone, later',
      accent: palette.pink,
    }),
  );
  parts.push(
    node({
      x: centreX - boxW / 2,
      y: bribeY,
      width: boxW,
      height: boxH,
      title: 'Bribe',
      subtitle: 'independently funded only',
      accent: palette.graphite,
    }),
  );

  // Connector labels sit in the clear band above the row, never over a box title.
  parts.push(text('payment', { x: boxW / 2 + 6, y: 50, size: T.small, weight: 600, fill: palette.pink }));
  parts.push(
    text('routePayment: pulls 100%', {
      x: (boxW + centreX - boxW / 2) / 2,
      y: rowY - 6,
      size: T.small,
      fill: palette.inkMuted,
      anchor: 'middle',
    }),
  );
  parts.push(
    text('payFundPayment(), permissionless', {
      x: (centreX + boxW / 2 + rightX) / 2,
      y: rowY - 6,
      size: T.small,
      fill: palette.inkMuted,
      anchor: 'middle',
    }),
  );

  const notes = footNotes(
    [
      'Buyer protections on every fill: expected epoch ID, a deadline, and a maximum payment. USDG leaves in the same transaction.',
      'If the payment token is GBX, Fund receives it unburned; anyone may then call Fund.burnGBX().',
    ],
    width,
  );
  const contentBottom = bribeY + boxH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    defs: markers,
    children: parts.join(''),
    title: 'Settlement: the complete payment is Fund-bound',
  });
}

/* ----------------------------------------------------------- reward tokens ---- */

/**
 * The eight-token reward cap.
 *
 * The cap is the claim, so it is drawn: a bracket spans exactly the eight legal slots and
 * carries the sentence that states the limit, which leaves the ninth slot visibly outside
 * the bracket rather than merely dashed at the end of an undifferentiated row.
 */
export function rewardTokens({ width = widths.full } = {}) {
  const parts = [];
  const gap = 6;
  const w = (width - gap * 8) / 9;
  const slotY = 4;
  const slotH = 44;

  const slot = (index, title, kind) => {
    const x = index * (w + gap);
    const fill =
      kind === 'canonical'
        ? palette.pink
        : kind === 'open'
          ? palette.paperTint
          : kind === 'used'
            ? palette.blue
            : palette.paper;
    const strokeColor = kind === 'rejected' ? palette.pink : 'none';
    parts.push(
      rect({
        x,
        y: slotY,
        width: w,
        height: slotH,
        r: R.card,
        fill: kind === 'rejected' ? palette.paper : fill,
        stroke: strokeColor,
        strokeWidth: W.card,
        dash: kind === 'rejected' ? '2.4 2' : undefined,
        opacity: kind === 'open' ? 0.8 : 1,
      }),
    );
    const fg =
      kind === 'canonical' || kind === 'used' ? palette.paper : kind === 'rejected' ? palette.pink : palette.inkMuted;
    parts.push(
      text(String(index + 1), { x: x + w / 2, y: slotY + 19, size: 7.6, weight: 600, anchor: 'middle', fill: fg }),
    );
    parts.push(text(title, { x: x + w / 2, y: slotY + 32, size: T.micro, anchor: 'middle', fill: fg }));
  };

  slot(0, 'payment token', 'canonical');
  slot(1, 'PARTNER', 'used');
  for (let index = 2; index < 8; index += 1) slot(index, 'open', 'open');
  slot(8, 'reverts', 'rejected');

  // A bracket under the eight legal slots, so the cap is a shape and not just a sentence.
  const capRight = 7 * (w + gap) + w;
  const bracketY = slotY + slotH + 7;
  parts.push(
    path(`M0,${bracketY + 4} L0,${bracketY} L${capRight},${bracketY} L${capRight},${bracketY + 4}`, {
      stroke: palette.ruleStrong,
      strokeWidth: W.rule,
      cap: 'butt',
      join: 'miter',
    }),
  );
  parts.push(
    text('One Bribe: at most eight reward tokens, forever', {
      x: capRight / 2,
      y: bracketY + 14,
      size: T.note,
      weight: 600,
      fill: palette.inkMuted,
      anchor: 'middle',
    }),
  );

  const notes = footNotes(
    [
      'Slot 1 is automatic: the Strategy’s payment token. Governance may register up to seven more. The ninth registration reverts and no one can raise the cap.',
      'Registration schedules nothing. A token pays only what someone independently notifies.',
    ],
    width,
  );
  const contentBottom = bracketY + 18;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({ width, height, children: parts.join(''), title: 'The eight-token reward cap' });
}

/* ----------------------------------------------------------- reward stream ---- */

/**
 * Reward streams: exact rates, queues, and zero-supply pausing.
 *
 * Three scenarios sharing one time span. The lanes were previously unreadable because the
 * explanatory sentences were set inside the bars, in white on a half-transparent fill. Each
 * lane is now a header, a full-span track whose segments carry only short in-place labels
 * at readable contrast, and one annotation line beneath. Every bar starts and ends on the
 * same two x positions, so the three scenarios can be compared vertically.
 */
export function rewardStream({ width = widths.full } = {}) {
  const parts = [];
  const plotX = 0;
  const plotW = width;
  const trackH = 18;
  const lanePitch = 50;
  const laneTop = 4;
  const x = linearScale([0, 7], [plotX, plotX + plotW]);

  const laneY = (index) => laneTop + index * lanePitch;

  const lane = (index, title) => {
    const y = laneY(index);
    parts.push(rect({ x: plotX, y: y + 12, width: plotW, height: trackH, r: R.chip, fill: palette.paperTint }));
    parts.push(rect({ x: plotX, y: y + 12, width: W.spine, height: trackH, r: W.spine / 2, fill: palette.pink }));
    parts.push(text(title, { x: plotX, y: y + 6, size: T.sub, weight: 600, fill: palette.ink }));
    return y;
  };

  const note = (index, value, at = plotX) => {
    parts.push(text(value, { x: at, y: laneY(index) + 40, size: T.small, fill: palette.inkMuted }));
  };

  // Lane 1: a 7-day stream whose remainder is paid out first.
  let y = lane(0, 'Notify 350 tokens with signal present: a 7-day stream starts');
  parts.push(
    rect({ x: x(0), y: y + 12, width: x(7) - x(0), height: trackH, r: R.chip, fill: palette.pink, opacity: 0.16 }),
  );
  parts.push(rect({ x: x(0), y: y + 12, width: x(0.34) - x(0), height: trackH, r: R.chip, fill: palette.pink }));
  parts.push(text('remainder first', { x: x(0.44), y: y + 24, size: T.micro, weight: 600, fill: palette.pink }));
  note(0, 'rate = floor(350e18 / 604,800) per second; the remainder is emitted one wei per second at the start');

  // Lane 2: a notify during a live stream queues behind it.
  y = lane(1, 'Notify during a live stream: the amount queues, the live stream is untouched');
  parts.push(
    rect({ x: x(0), y: y + 12, width: x(3) - x(0), height: trackH, r: R.chip, fill: palette.pink, opacity: 0.22 }),
  );
  parts.push(
    rect({
      x: x(3) + 2,
      y: y + 12,
      width: x(7) - x(3) - 2,
      height: trackH,
      r: R.chip,
      fill: palette.blue,
      opacity: 0.18,
    }),
  );
  parts.push(line({ x1: x(3), y1: y + 12, x2: x(3), y2: y + 12 + trackH, stroke: palette.blue, width: W.thin }));
  parts.push(text('active stream continues', { x: x(0.1), y: y + 24, size: T.micro, fill: palette.ink }));
  parts.push(
    text('queued: starts only after the active stream finishes', {
      x: x(3.1),
      y: y + 24,
      size: T.micro,
      fill: palette.ink,
    }),
  );

  // Lane 3: with no signal left, the clock stops rather than paying an empty room.
  y = lane(2, 'All signal leaves mid-stream: time pauses; nothing is emitted to an empty room');
  parts.push(
    rect({ x: x(0), y: y + 12, width: x(2) - x(0), height: trackH, r: R.chip, fill: palette.pink, opacity: 0.22 }),
  );
  parts.push(
    rect({
      x: x(2) + 1,
      y: y + 12,
      width: x(4.4) - x(2) - 2,
      height: trackH,
      r: R.chip,
      fill: palette.paper,
      stroke: palette.ruleStrong,
      strokeWidth: W.rule,
      dash: '2.2 2',
    }),
  );
  parts.push(
    rect({ x: x(4.4), y: y + 12, width: x(7) - x(4.4), height: trackH, r: R.chip, fill: palette.pink, opacity: 0.22 }),
  );
  parts.push(text('paused', { x: x(3.2), y: y + 24, size: T.micro, fill: palette.inkMuted, anchor: 'middle' }));
  note(2, 'resumes; the finish moves out by the pause', x(4.4));

  const notes = footNotes(
    [
      'Exact stream arithmetic from the reviewed contract: nothing rounds away, and a live stream can never be diluted by a top-up.',
    ],
    width,
  );
  const contentBottom = laneY(2) + 44;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'Reward streams: exact rates, queues, and zero-supply pausing',
  });
}

/* -------------------------------------------------------- selective claims ---- */

/**
 * Selective claims isolate broken reward tokens.
 *
 * The claim call is the only filled block on the page, so the eye lands on the thing the
 * caller controls. The frozen token now terminates in a struck stub under its own box
 * rather than a floating cross, which makes it read as a path that stops, not a decoration.
 */
export function selectiveClaims({ width = widths.full } = {}) {
  const parts = [];
  const gap = 12;
  const boxW = (width - gap * 2) / 3;
  const tokens = [
    { name: 'Wrapper token', state: 'claims fine', c: palette.pink },
    { name: 'PARTNER', state: 'claims fine', c: palette.blue },
    { name: 'FROZEN token', state: 'transfers revert', c: palette.graphite },
  ];

  const topY = 4;
  const boxH = 32;
  const claimY = 84;
  const claimW = 224;
  const claimX = width / 2 - claimW / 2;

  // The two healthy tokens flow into one selective claim; the frozen one stops short.
  parts.push(
    path(elbow({ x1: boxW / 2, y1: topY + boxH, x2: claimX + 48, y2: claimY - 1.6, axis: 'y', bend: 0.58 }), {
      stroke: palette.pink,
      strokeWidth: 1.2,
      marker: 'arrow-asset',
    }),
  );
  parts.push(
    path(
      elbow({
        x1: boxW + gap + boxW / 2,
        y1: topY + boxH,
        x2: claimX + claimW - 48,
        y2: claimY - 1.6,
        axis: 'y',
        bend: 0.58,
      }),
      { stroke: palette.blue, strokeWidth: 1.2, marker: 'arrow-capital' },
    ),
  );

  const fx = 2 * (boxW + gap) + boxW / 2;
  parts.push(line({ x1: fx, y1: topY + boxH, x2: fx, y2: 56, stroke: palette.rule, width: W.thin, dash: '1.8 2.2' }));
  parts.push(line({ x1: fx - 5, y1: 56, x2: fx + 5, y2: 66, stroke: palette.pink, width: 1.3 }));
  parts.push(line({ x1: fx + 5, y1: 56, x2: fx - 5, y2: 66, stroke: palette.pink, width: 1.3 }));
  parts.push(text('omitted', { x: fx, y: 78, size: T.note, weight: 600, fill: palette.pink, anchor: 'middle' }));

  tokens.forEach((token, index) => {
    const x = index * (boxW + gap);
    parts.push(
      node({
        x,
        y: topY,
        width: boxW,
        height: boxH,
        title: token.name,
        subtitle: token.state,
        accent: token.c,
        titleSize: 7.6,
      }),
    );
  });

  parts.push(
    node({
      x: claimX,
      y: claimY,
      width: claimW,
      height: 32,
      title: 'claimRewards(account, [1, 2])',
      subtitle: 'caller-selected unique tokens',
      accent: palette.pink,
      surface: palette.pink,
      onDark: true,
      titleSize: 7.4,
    }),
  );

  const notes = footNotes(['Claim one token, a chosen set, or all eight - the claimant chooses.'], width);
  const contentBottom = claimY + 32;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes, right: 'Omitted rewards stay claimable later.' });

  return figure({
    width,
    height,
    defs: markers,
    children: parts.join(''),
    title: 'Selective claims isolate broken reward tokens',
  });
}

/* --------------------------------------------------------- fund asset entry ---- */

/**
 * How value enters and leaves the Fund.
 *
 * All three inbound elbows used to turn at the same height and land on the same point, so
 * they stacked into one illegible line. Each now turns at its own height and lands on its
 * own third of the Fund's top edge: three arrivals, three distinct paths, no crossings.
 */
export function fundEntry({ width = widths.full } = {}) {
  const parts = [];
  const boxW = 148;
  const boxH = 30;
  const srcY = 4;
  const fundY = 78;
  const fundW = 200;
  const exitY = 116;
  const gap = (width - 3 * boxW) / 2;

  const sources = [
    { title: 'Strategy payments', sub: '100% fixed liabilities', accent: palette.pink, bend: 0.44, land: -52 },
    {
      title: 'Revenue and reward liabilities',
      sub: 'zero-signal, killed, residual',
      accent: palette.blue,
      bend: 0.5,
      land: 0,
    },
    {
      title: 'Anyone, directly',
      sub: 'donations and unsolicited tokens',
      accent: palette.graphite,
      bend: 0.68,
      land: 52,
    },
  ];

  sources.forEach((source, index) => {
    parts.push(
      path(
        elbow({
          x1: index * (boxW + gap) + boxW / 2,
          y1: srcY + boxH,
          x2: width / 2 + source.land,
          y2: fundY - 1.6,
          axis: 'y',
          bend: source.bend,
        }),
        { stroke: source.accent, strokeWidth: 1.2, marker: markerFor(source.accent) },
      ),
    );
  });

  sources.forEach((source, index) => {
    parts.push(
      node({
        x: index * (boxW + gap),
        y: srcY,
        width: boxW,
        height: boxH,
        title: source.title,
        subtitle: source.sub,
        accent: source.accent,
        titleSize: 7.2,
      }),
    );
  });

  parts.push(
    node({
      x: width / 2 - fundW / 2,
      y: fundY,
      width: fundW,
      height: 34,
      title: 'Fund',
      subtitle: 'ownerless raw-token custody, no registry',
      accent: palette.pink,
    }),
  );

  [-52, 52].forEach((offset) => {
    parts.push(
      path(`M${width / 2 + offset},${fundY + 34} L${width / 2 + offset},${exitY + 8}`, {
        stroke: palette.graphite,
        strokeWidth: 1.2,
        marker: 'arrow-supply',
      }),
    );
  });
  parts.push(
    text('selective in-kind redemption', {
      x: width / 2 - 60,
      y: exitY + 12,
      size: T.note,
      weight: 600,
      fill: palette.graphite,
      anchor: 'end',
    }),
  );
  parts.push(
    text('permissionless GBX burn', {
      x: width / 2 + 60,
      y: exitY + 12,
      size: T.note,
      weight: 600,
      fill: palette.graphite,
    }),
  );

  const notes = footNotes(
    ['The only exits. Nothing else - no owner, no sweep, no migration - can move a Fund balance.'],
    width,
  );
  const contentBottom = exitY + 16;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    defs: markers,
    children: parts.join(''),
    title: 'How value enters and leaves the Fund',
  });
}

/* ------------------------------------------------------------ genesis range ---- */

/**
 * The genesis position launches single-sided and out of range.
 *
 * The axis now carries a direction: a marked launch price sitting below the band, and a
 * short blue arrow along the axis toward it, so "out of range" is a distance the eye can
 * measure rather than a caption. The third sentence moves into the footnote band, which
 * lets the band itself hold only the two statements about the position.
 */
export function genesisRange({ width = widths.full } = {}) {
  const parts = [];
  const plotX = 0;
  const plotW = width;
  const bandTop = 22;
  const bandH = 50;
  const axisYPos = 82;

  const x = linearScale([0, 1], [plotX, plotX + plotW]);

  parts.push(
    rect({
      x: x(0.3),
      y: bandTop,
      width: x(0.97) - x(0.3),
      height: bandH,
      r: R.card,
      fill: palette.pink,
      opacity: 0.14,
    }),
  );
  parts.push(rect({ x: x(0.3), y: bandTop, width: W.spine, height: bandH, r: W.spine / 2, fill: palette.pink }));
  parts.push(
    text('the position’s fixed tick range: 20,000,000 GBX, no USDG', {
      x: x(0.3) + 12,
      y: bandTop + 20,
      size: 7.2,
      fill: palette.pink,
      weight: 600,
    }),
  );
  parts.push(
    text('as the price rises into the range, the position sells GBX for USDG and earns fees', {
      x: x(0.3) + 12,
      y: bandTop + 34,
      size: T.note,
      fill: palette.inkMuted,
    }),
  );

  parts.push(
    line({
      x1: plotX,
      y1: axisYPos,
      x2: plotX + plotW,
      y2: axisYPos,
      stroke: palette.ruleStrong,
      width: W.card,
    }),
  );
  parts.push(label('price of GBX in USDG', { x: plotX, y: axisYPos + 14, fill: palette.inkFaint }));

  parts.push(
    line({
      x1: x(0.14),
      y1: bandTop - 4,
      x2: x(0.14),
      y2: axisYPos,
      stroke: palette.blue,
      width: W.thin,
      dash: '2.6 2.2',
    }),
  );
  parts.push(circle({ cx: x(0.14), cy: axisYPos, r: 2.8, fill: palette.blue }));
  parts.push(
    path(`M${x(0.17)},${axisYPos - 8} L${x(0.27)},${axisYPos - 8}`, {
      stroke: palette.blue,
      strokeWidth: W.thin,
      marker: 'arrow-capital',
    }),
  );
  parts.push(
    text('launch price: below the range', {
      x: x(0.14),
      y: bandTop - 10,
      size: T.note,
      fill: palette.blue,
      anchor: 'middle',
      weight: 600,
    }),
  );

  const notes = footNotes(
    [
      'The protocol seeds only GBX, so the market - not the deployer - sets what a GBX is worth.',
      'The pool is hookless; the range, fee tier, and position NFT are precommitted. A wrongly configured genesis position cannot be corrected afterward.',
    ],
    width,
  );
  const contentBottom = axisYPos + 18;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    defs: markers,
    children: parts.join(''),
    title: 'The genesis position launches single-sided and out of range',
  });
}

/* -------------------------------------------------------- timelock lifecycle ---- */

/**
 * Every governed action crosses one public timelock.
 *
 * The cancel path is a return leg, so it gets its own channel under the chain and its label
 * sits below that channel instead of on top of it. Previously the arrow, its label and the
 * boxes all occupied the same eight points of vertical space.
 */
export function timelockLifecycle({ width = widths.full } = {}) {
  const parts = [];
  const stages = [
    { t: 'Propose', s: 'multisig schedules a call', c: palette.pink },
    { t: 'Delay', s: 'public, fixed, visible to all', c: palette.blue },
    { t: 'Execute', s: 'anyone, after the delay', c: palette.blue },
    { t: 'Effect', s: 'one of three Resonance actions', c: palette.graphite },
  ];
  const gap = 10;
  const w = (width - gap * 3) / 4;

  const boxY = 6;
  const boxH = 34;
  const channel = 58;

  stages.forEach((stage, index) => {
    const x = index * (w + gap);
    parts.push(
      node({
        x,
        y: boxY,
        width: w,
        height: boxH,
        title: stage.t,
        subtitle: stage.s,
        accent: stage.c,
        titleSize: T.title,
      }),
    );
    if (index < stages.length - 1) {
      parts.push(
        path(`M${x + w + 0.8},${boxY + boxH / 2} L${x + w + gap - 1.6},${boxY + boxH / 2}`, {
          stroke: stage.c,
          strokeWidth: 1.1,
          marker: markerFor(stage.c),
        }),
      );
    }
  });

  parts.push(
    path(
      `M${w / 2},${boxY + boxH} L${w / 2},${channel} L${w + gap + w / 2},${channel} L${w + gap + w / 2},${boxY + boxH + 2}`,
      { stroke: palette.pink, strokeWidth: 0.9, dash: '2.6 2.2', marker: 'arrow-asset' },
    ),
  );
  parts.push(
    text('cancel: the multisig can withdraw a queued action during the delay', {
      x: w / 2 + 8,
      y: channel + 12,
      size: T.small,
      fill: palette.inkMuted,
    }),
  );

  const notes = footNotes(
    [
      'The timelock also administers its own roles and delay - through the same public delay. Watching the queue is every user’s early-warning system.',
      'Fund and LiquidityPosition take no orders from it: they are ownerless.',
    ],
    width,
  );
  const contentBottom = channel + 16;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    defs: markers,
    children: parts.join(''),
    title: 'Every governed action crosses one public timelock',
  });
}

/* ---------------------------------------------------------- dependency map ---- */

/**
 * What the protocol depends on but does not control.
 *
 * An inventory has no single hero, so its job is to be scannable: the same four-by-three
 * grid, spine, and hairline rows as `participantMap`, so a reader who has learned to read
 * one map can read the other without re-learning it. No cell is emphasised, deliberately.
 */
export function dependencyMap({ width = widths.full } = {}) {
  const parts = [];
  const cols = 4;
  const gap = 8;
  const w = (width - gap * (cols - 1)) / cols;
  const deps = [
    ['Robinhood Chain', 'Cancun/EIP-1153 execution; verified read-only at a pinned block', 'capital'],
    ['Solidity 0.8.26', 'compiler correctness; two known upstream bugs reviewed as not applicable', 'supply'],
    ['OpenZeppelin 5.6.1', 'ERC-20, Permit, Votes, ReentrancyGuard, TimelockController', 'supply'],
    ['Uniswap v4 (pinned)', 'PoolManager and PositionManager for the canonical position', 'capital'],
    ['USDG', 'issuer-controlled stablecoin; 6 decimals; freeze and upgrade powers external', 'asset'],
    ['Payment tokens', 'each wrapper’s issuer, freeze, and legal terms are external', 'asset'],
    ['Reward tokens', 'up to eight per Bribe; each fails independently', 'asset'],
    ['Wallets and RPC', 'what you sign and what you see; outside the protocol', 'signal'],
    ['Frontend and subgraph', 'presentation only; verify against the chain', 'signal'],
    ['Multisig signers', 'propose and cancel through the timelock', 'signal'],
    ['TimelockController', 'the only owner of Resonance', 'supply'],
    ['Asset discovery', 'Fund holdings are found offchain; no onchain registry exists', 'capital'],
  ];

  const rowPitch = 52;
  const cellH = 44;
  const top = 2;

  for (let row = 1; row < Math.ceil(deps.length / cols); row += 1) {
    divider(parts, { x: 0, y: top + row * rowPitch - 5, width });
  }

  deps.forEach((dep, index) => {
    const x = (index % cols) * (w + gap);
    const y = top + Math.floor(index / cols) * rowPitch;
    const accent = flow[dep[2]];
    parts.push(rect({ x, y, width: W.spine, height: cellH, r: W.spine / 2, fill: accent }));
    parts.push(text(dep[0], { x: x + 10, y: y + 12, size: 7.2, weight: 600, fill: palette.ink }));
    wrapText(parts, dep[1], {
      x: x + 10,
      y: y + 23,
      size: T.micro,
      fill: palette.inkMuted,
      maxChars: 34,
      leading: 8,
    });
  });

  const height = top + 2 * rowPitch + cellH + 4;

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'What the protocol depends on but does not control',
  });
}

/* ----------------------------------------------------------- defense layers ---- */

/**
 * Defense layers, and the missing outermost one.
 *
 * The old drawing put the missing layer innermost, which said the opposite of the caption.
 * The four layers the protocol has are now nested, narrowing inward, and the layer it does
 * not have is the dashed frame drawn around all of them. Each row's description is set
 * flush right against its own edge, so the staircase stays legible as the rows narrow.
 */
export function defenseLayers({ width = widths.full } = {}) {
  const parts = [];
  const built = [
    ['Architecture', 'twelve narrow direct contracts; no proxy, pause, oracle, or generic executor', palette.pink],
    ['Onchain checks', 'exact-transfer deltas, reentrancy guards, one pre-burn snapshot, bounded loops', palette.blue],
    ['Exact accounting', 'scaled carry, fixed pull liabilities, conservation identities', palette.blue],
    ['Testing', '340 unit/fuzz tests, 13.5M invariant calls, genuine-v4 integration, Medusa', palette.graphite],
  ];
  const missing = ['What no layer provides', 'independent audit, formal proof, deployment evidence, legal clearance'];

  const rowH = 24;
  const pitch = 28;
  const firstY = 28;
  const frameH = firstY + built.length * pitch - (pitch - rowH) + 12;

  parts.push(
    rect({
      x: 0,
      y: 0,
      width,
      height: frameH,
      r: R.panel,
      fill: 'none',
      stroke: palette.inkFaint,
      strokeWidth: W.card,
      dash: '2.6 2.2',
    }),
  );
  parts.push(text(missing[0], { x: 12, y: 16, size: 7.4, weight: 600, fill: palette.inkMuted }));
  parts.push(text(missing[1], { x: width - 12, y: 16, size: T.note, fill: palette.inkMuted, anchor: 'end' }));

  built.forEach((layer, index) => {
    const inset = 12 + index * 9;
    const w = width - inset * 2;
    const y = firstY + index * pitch;
    parts.push(
      rect({
        x: inset,
        y,
        width: w,
        height: rowH,
        r: R.card,
        fill: palette.paperTint,
        stroke: layer[2],
        strokeWidth: W.card,
      }),
    );
    parts.push(text(layer[0], { x: inset + 10, y: y + 15, size: 7.4, weight: 600, fill: layer[2] }));
    parts.push(text(layer[1], { x: inset + w - 10, y: y + 15, size: T.note, fill: palette.inkMuted, anchor: 'end' }));
  });

  return figure({
    width,
    height: frameH + 4,
    children: parts.join(''),
    title: 'Defense layers, and the missing outermost one',
  });
}

/* -------------------------------------------------------- deployment steps ---- */

export function deploymentSequence({ width = widths.full } = {}) {
  const parts = [];
  const stepsList = [
    'Deploy TimelockController: multisig proposes and cancels, execution open, no external admin',
    'Deploy GBX: 20M genesis mint to the liquidity bootstrap; coordinator holds one-time minting',
    'Deploy Fund, SignalGBX, BribeFactory, StrategyFactory',
    'Deploy Resonance owned by the timelock; bind it once in SignalGBX and both factories',
    'Deploy ResonanceRouter; schedule its one-time binding through the timelock',
    'Deploy Fundraiser; permanently hand GBX minting to it',
    'Initialize the hookless GBX/USDG v4 pool; create the precommitted out-of-range position',
    'Deploy LiquidityPosition; deliver the precommitted NFT from the fixed depositor',
    'Schedule initial Strategy creation through the timelock',
    'Verify every ownership, binding, lock, PoolKey, tick, token ID, and custody claim',
  ];
  const half = Math.ceil(stepsList.length / 2);
  const colW = width / 2 - 14;
  const colGap = 28;
  const top = 4;
  const pitch = 29;

  // A hairline down the middle keeps the two columns from reading as one ten-wide block.
  parts.push(
    line({ x1: width / 2, y1: top, x2: width / 2, y2: top + half * pitch - 8, stroke: palette.rule, width: W.hair }),
  );

  stepsList.forEach((step, index) => {
    const col = index < half ? 0 : 1;
    const row = index < half ? index : index - half;
    const x = col * (colW + colGap);
    const y = top + row * pitch;

    if (row < half - 1) {
      parts.push(
        line({
          x1: x + 8,
          y1: y + 13.6,
          x2: x + 8,
          y2: y + pitch - 1,
          stroke: palette.pink,
          width: W.hair,
          opacity: 0.45,
        }),
      );
    }
    parts.push(circle({ cx: x + 8, cy: y + 7, r: 6.6, fill: palette.paper, stroke: palette.pink, strokeWidth: 0.9 }));
    parts.push(
      text(String(index + 1), {
        x: x + 8,
        y: y + 9.4,
        size: T.micro,
        weight: 600,
        fill: palette.pink,
        anchor: 'middle',
      }),
    );
    wrapText(parts, step, { x: x + 21, y: y + 5, size: T.small, fill: palette.ink, maxChars: 60, leading: 8.4 });
  });

  const notes = footNotes(
    ['An unexecuted outline from docs/DEPLOYMENT.md. No signed manifest exists; no script is authorized to broadcast.'],
    width,
  );
  const contentBottom = top + half * pitch - 4;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({ width, height, children: parts.join(''), title: 'The intended deployment order (not yet executed)' });
}

/* ------------------------------------------------------ redemption worked ---- */

/**
 * A worked selective redemption with one omitted asset.
 *
 * The burned share is the input everything else divides, so it is set at hero size above a
 * rule; the three asset rows below share one column grid, and the omitted row keeps the
 * dashed, spineless treatment used for "nothing happens here" throughout this module.
 */
export function redemptionWorked({ width = widths.full } = {}) {
  const parts = [];
  const r = worked.redemption;
  const shareLabel = `${fmtGBX(r.leoBurn, 0)} of ${fmtGBX(r.supplyBeforeBurn, 0)} GBX`;

  parts.push(label('Leo redeems', { x: 0, y: 10, fill: palette.inkFaint }));
  parts.push(text(shareLabel, { x: 0, y: 26, size: T.hero, weight: 600, fill: palette.ink }));
  parts.push(
    text('one pre-burn supply snapshot prices every selected asset', {
      x: 0,
      y: 38,
      size: T.note,
      fill: palette.inkMuted,
    }),
  );
  divider(parts, { x: 0, y: 48, width });

  const rows = [
    {
      name: 'NVDA-linked wrapper',
      balance: fmtGBX(r.fundBalances[0].balance, 0),
      payout: `${fmtGBX(r.leoPayouts[0].payout, 6)}`,
      selected: true,
    },
    {
      name: 'USDG',
      balance: fmtUSDG(r.fundBalances[1].balance, 0),
      payout: `${fmtUSDG(r.leoPayouts[1].payout, 6)}`,
      selected: true,
    },
    {
      name: 'PARTNER',
      balance: fmtGBX(r.fundBalances[2].balance, 0),
      payout: 'omitted - forfeited to remaining holders',
      selected: false,
    },
  ];

  const rowTop = 56;
  const rowPitch = 26;
  const rowH = 22;

  rows.forEach((row, index) => {
    const y = rowTop + index * rowPitch;
    parts.push(
      rect({
        x: 0,
        y,
        width,
        height: rowH,
        r: R.chip,
        fill: row.selected ? palette.paperTint : palette.paper,
        stroke: row.selected ? 'none' : palette.rule,
        strokeWidth: W.rule,
        dash: row.selected ? undefined : '2.4 2',
      }),
    );
    if (row.selected) parts.push(rect({ x: 0, y, width: W.spine, height: rowH, r: W.spine / 2, fill: palette.pink }));
    parts.push(
      text(row.name, { x: 12, y: y + 14, size: 7.2, weight: 600, fill: row.selected ? palette.ink : palette.inkMuted }),
    );
    parts.push(text(`Fund holds ${row.balance}`, { x: width * 0.42, y: y + 14, size: T.sub, fill: palette.inkMuted }));
    parts.push(
      text(row.selected ? `pays ${row.payout}` : row.payout, {
        x: width - 10,
        y: y + 14,
        size: T.sub,
        weight: row.selected ? 600 : 400,
        fill: row.selected ? palette.pink : palette.inkFaint,
        anchor: 'end',
      }),
    );
  });

  const notes = footNotes(
    [
      'payout = floor(balance x 10,000 / 120,000,000) per selected token. The burn and both transfers are one atomic transaction.',
    ],
    width,
  );
  const contentBottom = rowTop + rows.length * rowPitch - (rowPitch - rowH);
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({
    width,
    height,
    children: parts.join(''),
    title: 'A worked selective redemption with one omitted asset',
  });
}

/* ---------------------------------------------------------- findings board ---- */

/**
 * The internal finding register at a glance.
 *
 * Seven cards on one internal grid - id, severity, rule, summary, state pill. Only the open
 * finding gets the warm surface, the outline and a filled pill, which is the correct focus
 * for a board whose news is what remains unresolved.
 */
export function findingsBoard({ width = widths.full } = {}) {
  const parts = [];
  const entries = [
    { id: 'A-02', s: 'High', txt: 'exact revenue carry', state: 'resolved' },
    { id: 'A-03', s: 'High', txt: 'exact reward streams', state: 'resolved' },
    { id: 'A-04', s: 'High', txt: 'exit isolated from payouts', state: 'resolved' },
    { id: 'A-05', s: 'Product', txt: 'zero-price late fills', state: 'accepted' },
    { id: 'A-06', s: 'Medium', txt: 'LP compounding removed', state: 'resolved' },
    { id: 'A-08', s: 'Medium', txt: 'reward gas linear, capped', state: 'retained' },
    { id: 'A-09', s: 'Medium', txt: 'carry crosses weight change', state: 'open' },
  ];
  const gap = 7;
  const w = (width - gap * (entries.length - 1)) / entries.length;

  const top = 2;
  const cardH = 78;

  entries.forEach((entry, index) => {
    const x = index * (w + gap);
    const open = entry.state === 'open';
    const accepted = entry.state === 'accepted' || entry.state === 'retained';
    const accent = open ? palette.pink : accepted ? palette.blue : palette.graphite;

    surface(parts, {
      x,
      y: top,
      width: w,
      height: cardH,
      fill: open ? palette.paperTintWarm : palette.paperTint,
      stroke: open ? palette.pink : undefined,
    });
    parts.push(text(entry.id, { x: x + PAD, y: top + 16, size: 8.4, weight: 600, fill: accent }));
    parts.push(text(entry.s, { x: x + PAD, y: top + 26, size: T.micro, fill: palette.inkMuted }));
    divider(parts, { x: x + PAD, y: top + 32, width: w - PAD * 2 });
    wrapText(parts, entry.txt, { x: x + PAD, y: top + 43, size: 6, fill: palette.ink, maxChars: 16, leading: 8 });

    // A pill rather than bare caps: the state is the card's verdict, so it gets a shape.
    const pillY = top + cardH - 16;
    parts.push(
      rect({
        x: x + PAD,
        y: pillY,
        width: w - PAD * 2,
        height: 11,
        r: 5.5,
        fill: open ? accent : 'none',
        stroke: open ? 'none' : accent,
        strokeWidth: W.hair,
      }),
    );
    parts.push(
      text(entry.state.toUpperCase(), {
        x: x + w / 2,
        y: pillY + 7.6,
        size: T.micro,
        weight: 600,
        fill: open ? palette.paper : accent,
        tracking: 0.4,
        anchor: 'middle',
      }),
    );
  });

  const notes = footNotes(
    [
      'From the internal register. No unresolved Critical or High finding is known internally; A-09 remains an open Medium allocation-fairness finding.',
      {
        text: 'An independent external audit has not been performed. This board is internal evidence only.',
        weight: 600,
        fill: palette.pink,
      },
    ],
    width,
  );
  const contentBottom = top + cardH;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({ width, height, children: parts.join(''), title: 'The internal finding register at a glance' });
}

/* --------------------------------------------------------- worked timeline ---- */

/**
 * The complete worked-example thread on one page-width band.
 *
 * Promoted from a plain list to the paper's own trace idiom: a numbered spine on the left,
 * the narrative in a fixed measure, and each step's outcome in a tinted chip pinned to a
 * right-hand gutter. Hairlines separate the rows. Because the chips share one right edge,
 * the eight results can be read as a column without reading a word of the narrative.
 */
export function workedThread({ width = widths.full } = {}) {
  const parts = [];
  const w = worked;
  const rows = [
    [
      '1',
      `Maya contributes ${fmtUSDG(w.maya.contribution, 0)} USDG on day 121; the epoch emits ${fmtGBX(w.epochEmission, 2)} GBX`,
      `claims ${fmtGBX(w.maya.reward, 2)} GBX`,
      'capital',
    ],
    [
      '2',
      `stakes ${fmtGBX(w.maya.staked, 0)} GBX; signals ${fmtGBX(w.maya.toNvda, 0)} to NVDA, ${fmtGBX(w.maya.toAapl, 0)} to AAPL; unstakes the idle ${fmtGBX(w.maya.idle, 0)}`,
      'absolute deltas',
      'signal',
    ],
    [
      '3',
      `${fmtUSDG(w.revenueRaw, 6)} USDG routes at live weights 50 / 33.3 / 16.7%`,
      `${fmtUSDG(w.distribution.allocations[0].amount, 2)} to NVDA`,
      'capital',
    ],
    [
      '4',
      `Noor fills the NVDA auction 17h in: pays 17.5 wrapper units for ${fmtUSDG(w.auction.nvdaLot, 2)} USDG`,
      'next epoch opens at 35',
      'asset',
    ],
    ['5', `100% of the payment becomes a Fund liability; a keeper pays it in`, 'Bribes get nothing automatic', 'asset'],
    [
      '6',
      `an independent funder streams ${fmtGBX(w.rewards.canonicalNotified, 0)} wrapper tokens over 7 days across NVDA signalers`,
      'Elena claims her share',
      'asset',
    ],
    [
      '7',
      `the GBX-payment Strategy fills; ${fmtGBX(w.buyback.gbxPaid, 0)} GBX reaches Fund; anyone burns it`,
      'supply falls',
      'supply',
    ],
    [
      '8',
      `Leo burns ${fmtGBX(w.redemption.leoBurn, 0)} GBX of ${fmtGBX(w.redemption.supplyBeforeBurn, 0)}: takes the wrapper and USDG, omits PARTNER`,
      `${fmtGBX(w.redemption.leoPayouts[0].payout, 4)} wrapper + ${fmtUSDG(w.redemption.leoPayouts[1].payout, 2)} USDG`,
      'supply',
    ],
  ];

  const top = 2;
  const pitch = 24;
  const gutter = 128;
  const narrativeW = width - gutter - 22;

  rows.forEach((row, index) => {
    const y = top + index * pitch;
    const accent = flow[row[3]];

    if (index > 0) divider(parts, { x: 0, y: y - 3, width });
    if (index < rows.length - 1) {
      parts.push(line({ x1: 9, y1: y + 15, x2: 9, y2: y + pitch - 4, stroke: accent, width: W.rule, opacity: 0.4 }));
    }

    parts.push(circle({ cx: 9, cy: y + 8, r: 6.4, fill: palette.paper, stroke: accent, strokeWidth: 0.9 }));
    parts.push(text(row[0], { x: 9, y: y + 10.4, size: T.micro, weight: 600, fill: accent, anchor: 'middle' }));
    wrapText(parts, row[1], {
      x: 22,
      y: y + 11,
      size: T.note,
      fill: palette.ink,
      maxChars: Math.floor(narrativeW / (T.note * 0.5)),
      leading: 8.6,
    });

    const chipW = Math.min(gutter, measure(row[2], T.note, 600) + 14);
    parts.push(rect({ x: width - chipW, y: y + 1, width: chipW, height: 16, r: R.chip, fill: palette.paperTint }));
    parts.push(text(row[2], { x: width - 7, y: y + 11.4, size: T.note, weight: 600, fill: accent, anchor: 'end' }));
  });

  const notes = footNotes(
    [
      'All participants fictional; all amounts computed by the worked model from the reviewed rules. Nothing here is a projection.',
    ],
    width,
  );
  const contentBottom = top + rows.length * pitch - 4;
  const height = contentBottom + footHeight(notes.length);
  footBand(parts, { width, top: contentBottom, notes });

  return figure({ width, height, children: parts.join(''), title: 'The worked example, end to end' });
}
