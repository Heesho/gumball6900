#!/usr/bin/env node
/**
 * Builds `output/pdf/GumBall6900-one-pager.pdf` and `output/png/GumBall6900-one-pager.png`.
 *
 * The sheet is rendered to a self-contained HTML file with one explicit A4 landscape frame
 * and printed by headless Chrome, which subsets and embeds every face it resolves.
 *
 * This build is deliberately less forgiving than the whitepaper's. A whitepaper page that
 * grows can take a line from the next page; a one-pager that grows produces a second page,
 * clipped content, or type shrunk below reading size, and all three are silent. So every
 * one of those is a gate here, and a failed gate never replaces the published file.
 *
 * Usage: node docs/one-pager/gumball6900/build.mjs [--html] [--force] [--open]
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { verifyProtocolFacts } from '../../whitepaper/src/protocol-facts.mjs';
import { assertContrast, brand, contrastRatio, palette } from '../../whitepaper/src/theme.mjs';

import { meta, renderPage } from './src/page.mjs';
import { geometry, stylesheet } from './src/styles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const buildDir = resolve(here, 'build');
const htmlPath = resolve(buildDir, 'one-pager.html');
const pdfPath = resolve(repoRoot, 'output/pdf/GumBall6900-one-pager.pdf');
const pngPath = resolve(repoRoot, 'output/png/GumBall6900-one-pager.png');

/** Millimetres to PostScript points, the PDF's own unit. */
const MM_TO_PT = 72 / 25.4;
const EXPECTED_WIDTH_PT = geometry.pageWidth * MM_TO_PT;
const EXPECTED_HEIGHT_PT = geometry.pageHeight * MM_TO_PT;

/** House limits for a sheet a skeptic has to be able to read. */
const LIMITS = {
  /**
   * The brief asks for "approximately 450 words". The gate sits a little above that so it
   * stops drift rather than forcing a cut that costs comprehension: the sheet has to name
   * what the fund holds, whose choice directs it, and what the basket accumulates to, and
   * that is what the words between 450 and here are buying. Anything approaching this
   * number should be edited down, not accommodated by raising it again.
   */
  words: 480,
  /** Anything a reader must actually read. Sub-9.5pt body copy is the failure to block. */
  minTypePt: 7.5,
  minBodyTypePt: 9.5,
  pages: 1,
  /** Page geometry may differ from A4 landscape by less than a printer's rounding. */
  dimensionTolerancePt: 1,
};

/**
 * Stale-claim gate.
 *
 * Every phrase here described a superseded design. The whitepaper's list is inherited
 * wholesale and extended with the claims that a short, simplifying document is most
 * tempted to make: NAV tracking, rebalancing, guaranteed mining profit, perpetual
 * emissions, and any description of internal testing as an independent audit.
 */
const STALE_PHRASES = [
  // Superseded settlement and reward economics.
  'acquisition reward percentage',
  'adjustable acquisition reward',
  'immutable, hard-coded rule',
  'fixed 90/10',
  'split cannot change',
  '90% of each strategy asset payment backs fund',
  'one reward token per strategy',
  'unlimited reward tokens',
  'auction proceeds fund',
  // Superseded signal accounting.
  'relative weights',
  'relative signal weight',
  'whole-account reset',
  'reset all allocations',
  'all sGBX is automatically allocated',
  'automatically allocated',
  'resonance.addsignal',
  'resonance.removesignal',
  'token that is both her share and her vote',
  'gbx voting token',
  'multisig proposer',
  // Superseded distribution: the pooled daily Fundraiser, removed by ADR 0024. These are
  // the phrases the old edition of this sheet actually printed, so they are the ones a
  // careless revert would reintroduce.
  'fundraiser',
  'contribution mining',
  'contribution window',
  'daily epoch',
  'epoch emission',
  'pooled contribution',
  "day's new gbx",
  "day's dollars",
  'fixed public schedule',
  '980',
  // Superseded supply model. ADR 0024 removed the lifetime ceiling outright: Mine is a
  // permanent minter whose global rate halves toward a strictly positive tail. Every one
  // of these asserts a cap that no longer exists, and a cap is the most attractive thing
  // for a simplifying sheet to promise.
  'maximum supply',
  'max supply',
  'supply cap',
  'capped supply',
  'fixed supply',
  'lifetime ceiling',
  'lifetime mint',
  'that can ever exist',
  'hard cap',
  'one billion',
  // Superseded governance surface.
  'four ongoing',
  'five management actions',
  // Superseded Fund and liquidity design.
  'fund migration',
  'successor fund',
  'migrate liquidity',
  'liquidityposition migration',
  'withdraw the lp nft',
  'withdrawable lp',
  'compoundRequirement',
  'compound the position',
  'compounding liquidity',
  '0.20%',
  'callers keep',
  'caller-funded',
  'fees are not protocol revenue',
  'lp fees do not burn',
  'always receives a majority',
  'fund always receives',
  // Claims the protocol does not make.
  'tracks nav',
  'net asset value',
  'pegged to fund',
  'automatic rebalancing',
  'rebalances',
  'guaranteed profit',
  'guaranteed yield',
  'guaranteed backing',
  'guaranteed mining',
  'guaranteed replacement',
  'risk-free',
  // `never reaches zero`, `infinite emissions` and `perpetual emissions` used to sit here.
  // Under ADR 0024 they describe the protocol accurately - the global rate halves toward a
  // strictly positive tail and mining continues indefinitely - so blocking them would be a
  // gate against the truth. What still has to be blocked is the inference a reader would
  // draw from them, which is that continued issuance implies a continued payout.
  'always profitable',
  'passive income',
  'earn while you sleep',
  // Status language that must never appear before the evidence exists.
  'audited',
  'externally audited',
  'independently audited',
  'battle-tested',
  'fully trustless',
  'fully decentralized',
  'live on',
  'launched',
  'release-ready',
  // Build hygiene.
  'TODO',
  'FIXME',
  'lorem ipsum',
  'XXX',
];

/**
 * Terms that are wrong to assert and right to deny.
 *
 * "No upgrade or pause switch" is the accurate description of this protocol; "an upgrade
 * path" is a stale claim about an older one. A flat substring list cannot tell those apart
 * and blocks the true sentence along with the false one, so these are only a failure when
 * no negation governs them.
 */
const NEGATABLE_TERMS = [
  'management fee',
  'upgrade path',
  'pause switch',
  'rescue function',
  'sweep function',
  'admin key',
  'withdrawal key',
  'withdrawal function',
  'migration path',
  'successor',
];

const NEGATION_WINDOW = 34;
const NEGATION =
  /(?:\b(?:no|not|never|without|nor|neither|cannot|can't|zero|none|free of|absent|lacks)\b|\b0(?:\.0+)?%?(?=\s))[^.]*$/i;

/** Placeholders that must never survive into a published sheet. */
const PLACEHOLDER_PATTERNS = [/\{\{[^}]*\}\}/, /\$\{[^}]*\}/, /\bundefined\b/, /\bNaN\b/, /\[\s*object Object\s*\]/];

function scanStaleClaims(documentHtml) {
  const text = textContent(documentHtml).toLowerCase();
  const hits = STALE_PHRASES.filter((phrase) => text.includes(phrase.toLowerCase()));

  // Negatable terms: report only the occurrences that are not governed by a negation.
  for (const term of NEGATABLE_TERMS) {
    let from = 0;
    for (let at = text.indexOf(term, from); at !== -1; at = text.indexOf(term, from)) {
      const preceding = text.slice(Math.max(0, at - NEGATION_WINDOW), at);
      if (!NEGATION.test(preceding)) hits.push(`${term} (asserted, not denied)`);
      from = at + term.length;
    }
  }

  if (hits.length > 0) {
    throw new Error(`Stale or forbidden claims present in rendered text:\n  ${hits.join('\n  ')}`);
  }
  return STALE_PHRASES.length + NEGATABLE_TERMS.length;
}

/**
 * Surfaces this sheet introduces that the whitepaper's palette check does not cover.
 *
 * The signal bar's coloured segments and the white plates behind them are local to this
 * layout, so their pairs are asserted here. Those segments use the darkened brand pink
 * rather than the bright one for exactly this reason: white on bright pink is 3.63:1 and
 * fails AA, while white on the darkened edition clears it.
 */
function assertSheetContrast() {
  const checks = [
    ['segment label on pink', brand.white, palette.pink],
    ['segment label on blue', brand.white, palette.blue],
    ['segment label on graphite', brand.white, palette.graphite],
    ['ink on white card', palette.ink, brand.white],
    ['muted ink on white card', palette.inkMuted, brand.white],
    ['faint ink on white card', palette.inkFaint, brand.white],
    // The mining panel's tinted plate, introduced with the ADR 0024 rewrite. Its caveat
    // line is the smallest type on that surface and the one most likely to fail.
    ['mining body on tint', palette.ink, palette.paperTint],
    ['mining caveat on tint', palette.inkMuted, palette.paperTint],
    ['mining label on tint', palette.blue, palette.paperTint],
  ];

  const failures = checks
    .map(([label, foreground, background]) => ({ label, ratio: contrastRatio(foreground, background) }))
    .filter((check) => check.ratio < 4.5);

  if (failures.length > 0) {
    const detail = failures.map((f) => `${f.label}: ${f.ratio.toFixed(2)}:1 < 4.5:1`).join('\n  ');
    throw new Error(`One-pager surfaces fail WCAG AA:\n  ${detail}`);
  }

  return checks.map((check) => ({ label: check[0], ratio: Number(contrastRatio(check[1], check[2]).toFixed(2)) }));
}

/**
 * Stylesheet hygiene.
 *
 * `palette` carries no `white` or `black` - those are brand tokens - so `${palette.white}`
 * interpolates to the string "undefined", the browser drops the declaration, and the
 * element silently inherits some other colour. That is how the accent band once shipped at
 * 3.36:1. A rendered stylesheet must contain no such value.
 */
function scanStylesheet(css) {
  const offenders = [...new Set(css.match(/[a-z-]+\s*:\s*[^;{}]*\b(?:undefined|NaN|null)\b[^;{}]*/g) ?? [])];
  if (offenders.length > 0) {
    throw new Error(`Unresolved values in the generated stylesheet:\n  ${offenders.join('\n  ')}`);
  }
}

/**
 * The "0% management fee" guard.
 *
 * That figure is a claim of absence, and absence is the hardest kind of claim to keep true:
 * nothing about printing it stops someone reintroducing a split later. An earlier design did
 * have one - `Resonance.bribeBps` takes a bounded share of every later acquisition for
 * signalers. ADR 0036 permits that one global prospective share to move from 0% through
 * 20%; its complement remains Fund-bound. Neither destination is a team, manager, or
 * privileged fee recipient.
 *
 * ADR 0024 complicated this guard rather than retiring it. `Mine` genuinely does split a
 * payment in basis points: 80% to the miner being displaced, 20% into the buying flow. A
 * flat "no bps in core" rule would now fail on an honest contract, and deleting the rule
 * would give up the check everywhere else. Mine's split is pinned to exactly two constants.
 * Resonance's bounded policy and BribeRouter's weighted classification are pinned independently.
 * Neither split reaches the team; the moment one does, the arithmetic below stops matching.
 */
function assertNoProtocolFee() {
  const coreDir = resolve(repoRoot, 'packages/contracts/src/core');
  const sources = readdirSync(coreDir)
    .filter((name) => name.endsWith('.sol'))
    .map((name) => ({ name, text: readFileSync(resolve(coreDir, name), 'utf8') }));

  if (sources.length === 0) throw new Error('Fee guard: no core Solidity found to check.');

  // Identifiers that would only exist to take or route a cut. `poolFee` and `harvestFees`
  // are Uniswap's own fee tier and collection call, so the list is deliberately specific
  // rather than a search for "fee".
  const forbidden = [
    'feeBps',
    'protocolFee',
    'managementFee',
    'performanceFee',
    'feeRecipient',
    'treasuryFee',
    'teamFee',
    'ownerFee',
    'BPS_DENOMINATOR',
  ];
  // Basis-point arithmetic, which is how a split would have to be expressed.
  const splitPatterns = [/\/\s*10_?000\b/, /\bbps\b/i];
  // The files whose reviewed basis-point policy is expected, and therefore pinned rather than banned.
  const SPLIT_FILES = new Set(['Mine.sol', 'Resonance.sol', 'BribeRouter.sol']);

  const hits = [];
  for (const { name, text } of sources) {
    for (const identifier of forbidden) {
      if (text.includes(identifier)) hits.push(`${name}: ${identifier}`);
    }
    if (SPLIT_FILES.has(name)) continue;
    for (const pattern of splitPatterns) {
      if (pattern.test(text)) hits.push(`${name}: split arithmetic ${pattern}`);
    }
  }

  // The pinned half: Mine's handoff split is the two shares the sheet prints, and nothing
  // else. `revenueAmount = paid - previousMinerAmount` is the line that makes the split
  // exhaustive - with it, there is no third share to pay a team out of.
  const mine = sources.find((entry) => entry.name === 'Mine.sol');
  if (!mine) hits.push('Mine.sol is missing');
  else {
    const pins = [
      ['PREVIOUS_MINER_BPS = 8_000', /uint256 public constant PREVIOUS_MINER_BPS = 8_000;/],
      ['BPS = 10_000', /uint256 public constant BPS = 10_000;/],
      ['exhaustive two-way split', /revenueAmount = paid - previousMinerAmount;/],
      [
        'RevenueDeposited event',
        /event RevenueDeposited\(uint256 indexed index, uint256 indexed epochId, uint256 amount\);/,
      ],
      ['exact ResonanceRouter deposit', /usdg\.safeTransfer\(resonanceRouter, revenueAmount\);/],
    ];
    for (const [label, pattern] of pins) {
      if (!pattern.test(mine.text)) hits.push(`Mine.sol: ${label} no longer holds`);
    }
    if (/\.route\(\);/.test(mine.text)) {
      hits.push('Mine.sol: synchronous downstream route call returned');
    }
    // Any basis-point constant beyond the two pinned ones is a third share.
    const bpsConstants = [...mine.text.matchAll(/constant\s+(\w*BPS\w*)\s*=/g)].map((match) => match[1]);
    const unexpected = bpsConstants.filter((name) => name !== 'BPS' && name !== 'PREVIOUS_MINER_BPS');
    if (unexpected.length > 0) hits.push(`Mine.sol: unexpected share ${unexpected.join(', ')}`);
  }

  // ADR 0036 policy: one global prospective rate, default 10%, bounded at 20%.
  const resonance = sources.find((entry) => entry.name === 'Resonance.sol');
  if (!resonance) hits.push('Resonance.sol is missing');
  else {
    const pins = [
      ['BPS = 10_000', /uint256 public constant BPS = 10_000;/],
      ['DEFAULT_BRIBE_BPS = 1_000', /uint256 public constant DEFAULT_BRIBE_BPS = 1_000;/],
      ['MAX_BRIBE_BPS = 2_000', /uint256 public constant MAX_BRIBE_BPS = 2_000;/],
      ['default global state', /uint256 public bribeBps = DEFAULT_BRIBE_BPS;/],
      ['bounded owner setter', /function setBribeBps\(uint256 newBribeBps\) external onlyOwner/],
      ['maximum enforced', /if \(newBribeBps > MAX_BRIBE_BPS\) revert BribeBpsAboveMaximum\(newBribeBps\);/],
    ];
    for (const [label, pattern] of pins) {
      if (!pattern.test(resonance.text)) hits.push(`Resonance.sol: ${label} no longer holds`);
    }
    const bpsConstants = [...resonance.text.matchAll(/constant\s+(\w*BPS\w*)\s*=/g)].map((match) => match[1]);
    const expected = new Set(['BPS', 'DEFAULT_BRIBE_BPS', 'MAX_BRIBE_BPS']);
    const unexpected = bpsConstants.filter((name) => !expected.has(name));
    if (unexpected.length > 0) hits.push(`Resonance.sol: unexpected share ${unexpected.join(', ')}`);
  }

  // ADR 0036 classification: snapshot the global rate and preserve one weighted cumulative carry.
  const router = sources.find((entry) => entry.name === 'BribeRouter.sol');
  if (!router) hits.push('BribeRouter.sol is missing');
  else {
    const pins = [
      ['BPS = 10_000', /uint256 public constant BPS = 10_000;/],
      ['global rate snapshot', /uint256 appliedBribeBps = ICoreResonance\(resonance\)\.bribeBps\(\);/],
      ['dynamic Bribe numerator', /Math\.mulDiv\(amount, appliedBribeBps, BPS\)/],
      ['weighted remainder', /mulmod\(amount, appliedBribeBps, BPS\)/],
      ['exhaustive Fund complement', /uint256 fundAmount = amount - bribeAmount;/],
      ['Fund liability classification', /fundPaymentLiability \+= fundAmount;/],
      ['Bribe liability classification', /bribePaymentLiability \+= bribeAmount;/],
      ['frequency-independent remainder', /splitRemainder = accumulatedRemainder % BPS;/],
    ];
    for (const [label, pattern] of pins) {
      if (!pattern.test(router.text)) hits.push(`BribeRouter.sol: ${label} no longer holds`);
    }
    const bpsConstants = [...router.text.matchAll(/constant\s+(\w*BPS\w*)\s*=/g)].map((match) => match[1]);
    const expected = new Set(['BPS']);
    const unexpected = bpsConstants.filter((name) => !expected.has(name));
    if (unexpected.length > 0) hits.push(`BribeRouter.sol: unexpected share ${unexpected.join(', ')}`);
  }

  if (hits.length > 0) {
    throw new Error(
      `The sheet prints "0% management fee", but the contracts now contain a fee or unreviewed split:\n  ${hits.join('\n  ')}\n` +
        'Update the reasons strip and the mining panel in src/copy.mjs before publishing.',
    );
  }

  return sources.length;
}

function scanPlaceholders(documentHtml) {
  const text = textContent(documentHtml);
  const hits = PLACEHOLDER_PATTERNS.filter((pattern) => pattern.test(text)).map(String);
  if (hits.length > 0) {
    throw new Error(`Unresolved placeholders in rendered text:\n  ${hits.join('\n  ')}`);
  }
}

/**
 * Strip markup and collapse whitespace: what a reader actually sees.
 *
 * Labels set inside a figure are words on the page and are extracted by `pdftotext` like
 * any other, so `<text>` inside an SVG is kept while the rest of the drawing is dropped.
 * Counting only the HTML would let a figure quietly carry copy past the word budget.
 */
function textContent(documentHtml) {
  return documentHtml
    .replace(
      /<svg[\s\S]*?<\/svg>/g,
      (block) => ` ${[...block.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]).join(' ')} `,
    )
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Word budget.
 *
 * Counted from the rendered text rather than from the copy module, so a word added in a
 * template or a label counts exactly like a word added to a sentence.
 */
function countWords(documentHtml) {
  const words = textContent(documentHtml)
    .split(' ')
    .filter((token) => /[A-Za-z0-9]/.test(token));
  return words.length;
}

function assertWordBudget(documentHtml) {
  const words = countWords(documentHtml);
  if (words > LIMITS.words) {
    throw new Error(
      `Word budget exceeded: ${words} words against a ${LIMITS.words} limit.\n` +
        'Cut copy in src/copy.mjs. Do not shrink type to fit more content.',
    );
  }
  return words;
}

/** ASCII hyphens only: em and en dashes are a house rule, and they print as boxes if a
 *  fallback face lacks them. */
function assertAsciiPunctuation(documentHtml) {
  const text = textContent(documentHtml);
  const offenders = [...new Set(text.match(/[‒-―−]/g) ?? [])];
  if (offenders.length > 0) {
    throw new Error(`Non-ASCII dashes in rendered text: ${offenders.join(' ')}. Use ASCII hyphens.`);
  }
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findChrome() {
  const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!chrome) {
    throw new Error(
      `No Chrome or Chromium binary found. Set CHROME_PATH to one, or install Chrome.\nLooked in:\n  ${CHROME_CANDIDATES.join('\n  ')}`,
    );
  }
  return chrome;
}

function chromeFlags(profileName) {
  return [
    '--headless',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    `--user-data-dir=${resolve(tmpdir(), `gumball-one-pager-${profileName}-${process.pid}`)}`,
  ];
}

function disposeProfile(profileName) {
  rmSync(resolve(tmpdir(), `gumball-one-pager-${profileName}-${process.pid}`), { recursive: true, force: true });
}

const OVERFLOW_MARKER = 'LAYOUT-OVERFLOW';
const CLIP_MARKER = 'LAYOUT-CLIP';
const OVERLAP_MARKER = 'LAYOUT-OVERLAP';
const TYPE_MARKER = 'LAYOUT-TYPE';
const BAND_MARKER = 'LAYOUT-BAND';
const OVERRUN_MARKER = 'LAYOUT-OVERRUN';

/**
 * Layout audit, reported back through the document title.
 *
 * Chrome copies the title into the printed PDF's metadata, so one print pass carries both
 * the document and its own layout report, with no second browser launch to go wrong. Four
 * separate failures are measured, because they fail in four different ways:
 *
 *   OVERFLOW - content escapes the fixed page frame and is clipped at the sheet edge;
 *   CLIP     - a text block is taller than the box drawn around it, so its last line is
 *              cut off inside an otherwise clean-looking page;
 *   OVERLAP  - two sibling panels intersect, which no overflow measurement can see;
 *   TYPE     - some text ended up below the readable floor.
 *
 * CLIP is the one that matters most here. Every band has a fixed height, so a sentence one
 * word too long does not push the page out - it quietly loses its descender line.
 */
const AUDIT_SCRIPT = `
(() => {
  const report = [];
  const frame = document.querySelector('.frame');

  // 1. Frame overflow.
  if (frame) {
    const overflow = Math.max(
      frame.scrollHeight - frame.clientHeight,
      frame.scrollWidth - frame.clientWidth,
    );
    if (overflow > 1) report.push('${OVERFLOW_MARKER} frame+' + Math.ceil(overflow));
  }

  // 2. Clipped text. Every text-bearing leaf carries .chk.
  // Display type overhangs its line box by a pixel or two; a genuinely lost line is a whole
  // leading, so the threshold sits between the two rather than at zero.
  const CLIP_FLOOR = 4;
  const clipped = [];
  document.querySelectorAll('.chk').forEach((node, index) => {
    const vertical = node.scrollHeight - node.clientHeight;
    const horizontal = node.scrollWidth - node.clientWidth;
    const worst = Math.max(vertical, horizontal);
    if (worst > CLIP_FLOOR) {
      const words = (node.textContent || '').trim().split(/\\s+/).slice(0, 3).join('_');
      clipped.push((words || ('node' + index)) + '+' + Math.ceil(worst));
    }
  });
  if (clipped.length > 0) report.push('${CLIP_MARKER} ' + clipped.join(' '));

  // 3. Sibling panels must not intersect.
  const overlaps = [];
  const panels = [...document.querySelectorAll('.box')];
  for (let i = 0; i < panels.length; i += 1) {
    for (let j = i + 1; j < panels.length; j += 1) {
      if (panels[i].contains(panels[j]) || panels[j].contains(panels[i])) continue;
      const a = panels[i].getBoundingClientRect();
      const b = panels[j].getBoundingClientRect();
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > 2 && y > 2) overlaps.push(i + 'x' + j + '~' + Math.ceil(y));
    }
  }
  if (overlaps.length > 0) report.push('${OVERLAP_MARKER} ' + overlaps.join(' '));

  // 4. Readable type. Measured on rendered text nodes, not on the stylesheet.
  const sizes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const element = node.parentElement;
    if (!element) continue;
    let size = parseFloat(getComputedStyle(element).fontSize);

    // Text inside a figure is set in user units, which the viewBox scales on the way to
    // the page. Without applying that ratio a 9.5-unit label in a shrunken figure reads
    // as compliant while printing at 6pt.
    const owner = element.closest('svg');
    if (owner) {
      const viewBox = owner.viewBox && owner.viewBox.baseVal;
      const rendered = owner.getBoundingClientRect().width;
      if (!viewBox || !viewBox.width || !rendered) continue;
      size *= rendered / viewBox.width;
    }

    // Computed sizes are CSS pixels at 96dpi; convert to points.
    sizes.push({ pt: size * 0.75, text: node.textContent.trim().slice(0, 18) });
  }
  const tooSmall = sizes.filter((entry) => entry.pt < ${LIMITS.minTypePt} - 0.05);
  if (tooSmall.length > 0) {
    report.push('${TYPE_MARKER} ' + tooSmall.map((e) => e.pt.toFixed(1) + 'pt:' + e.text.replace(/\\s+/g, '_')).join(' '));
  }

  // 5. Per-band budget, always reported. This is the diagnostic that turns "the sheet is
  //    9mm too tall" into "the base band wants 45mm and has 36mm", which is the only form
  //    of that fact you can act on.
  const toMm = (value) => (value / 96) * 25.4;
  const budgets = [];
  const overruns = [];
  document.querySelectorAll('.band').forEach((node) => {
    const rail = node.querySelector('.band__rail');
    if (!rail) return;
    const railTop = rail.getBoundingClientRect().top;
    let content = rail.scrollHeight;
    for (const child of rail.children) {
      content = Math.max(content, child.getBoundingClientRect().bottom - railTop);
    }
    const declared = toMm(node.getBoundingClientRect().height);
    const wanted = toMm(content);
    budgets.push(node.dataset.band + ':' + wanted.toFixed(1) + '/' + declared.toFixed(1));
    if (wanted - declared > 0.5) overruns.push(node.dataset.band + '+' + (wanted - declared).toFixed(1));
  });
  report.push('${BAND_MARKER} ' + budgets.join(' '));
  if (overruns.length > 0) report.push('${OVERRUN_MARKER} ' + overruns.join(' '));

  document.title = report.join(' | ');
})();
`;

function renderDocument() {
  const css = stylesheet({ brandFontUrl: `file://${resolve(repoRoot, 'docs/whitepaper/fonts/Modak-Regular.ttf')}` });
  scanStylesheet(css);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${meta.title}</title>
<meta name="author" content="${meta.author}">
<meta name="subject" content="${meta.subject}">
<meta name="keywords" content="${meta.keywords.join(', ')}">
<meta name="description" content="${meta.subject}">
<style>
${css}
</style>
</head>
<body>
${renderPage()}
<script>${AUDIT_SCRIPT}</script>
</body>
</html>
`;
}

/** Pull one marker's segment out of the reported title. Segments are ' | '-separated. */
function readReportSegment(title, marker) {
  const segment = title.split(' | ').find((part) => part.trim().startsWith(marker));
  if (!segment) return [];
  return segment.trim().slice(marker.length).trim().split(/\s+/).filter(Boolean);
}

async function printToPdf(chrome, { htmlFile, pdfFile, timeoutMs = 180_000 }) {
  rmSync(pdfFile, { force: true });
  disposeProfile('print');

  const child = spawn(
    chrome,
    [
      ...chromeFlags('print'),
      '--no-pdf-header-footer',
      '--font-render-hinting=none',
      `--print-to-pdf=${pdfFile}`,
      `file://${htmlFile}`,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let exited = false;
  child.on('exit', () => {
    exited = true;
  });

  const deadline = Date.now() + timeoutMs;
  let lastSize = -1;
  let stableFor = 0;

  try {
    while (Date.now() < deadline) {
      await sleep(300);
      const size = existsSync(pdfFile) ? statSync(pdfFile).size : -1;

      if (size > 0 && size === lastSize) {
        stableFor += 300;
        if (stableFor >= 1_200) return;
      } else {
        stableFor = 0;
      }
      lastSize = size;

      if (exited && size <= 0) throw new Error(`Chrome exited without writing a PDF.\n${stderr.trim()}`);
    }
    throw new Error(`Chrome did not produce a PDF within ${timeoutMs / 1000}s.\n${stderr.trim()}`);
  } finally {
    if (!exited) child.kill('SIGKILL');
    disposeProfile('print');
  }
}

/**
 * Metadata stamp.
 *
 * Chrome writes only Title, Creator, Producer, and dates. Author, subject, keywords, and
 * the commits this sheet describes belong in the file too, so this appends a
 * standards-conforming incremental update that replaces the Info object. Appending rather
 * than rewriting leaves every existing byte and cross-reference untouched.
 */
function stampMetadata(path) {
  const buffer = readFileSync(path);
  const text = buffer.toString('latin1');

  const tail = text.slice(-2048);
  const trailerMatch = tail.match(/trailer\s*<<([\s\S]*?)>>\s*startxref\s*(\d+)\s*%%EOF\s*$/);
  if (!trailerMatch) throw new Error('Metadata stamp: could not parse the PDF trailer.');
  const trailerDict = trailerMatch[1];
  const previousStartXref = Number(trailerMatch[2]);
  const size = Number(trailerDict.match(/\/Size (\d+)/)?.[1]);
  const root = trailerDict.match(/\/Root (\d+) 0 R/)?.[1];
  const infoNum = trailerDict.match(/\/Info (\d+) 0 R/)?.[1];
  if (!size || !root || !infoNum) throw new Error('Metadata stamp: trailer is missing Size, Root, or Info.');

  const infoBody = text.match(new RegExp(`(?:^|\\n)${infoNum} 0 obj\\n<<([\\s\\S]*?)>>\\nendobj`))?.[1];
  if (!infoBody) throw new Error('Metadata stamp: could not locate the Info object.');
  const keep = (key) => infoBody.match(new RegExp(`\\/${key} \\((?:[^\\\\)]|\\\\.)*\\)`))?.[0] ?? '';

  const escape = (value) => String(value).replace(/([()\\])/g, '\\$1');
  const entries = [
    `/Title (${escape(meta.title)})`,
    `/Author (${escape(meta.author)})`,
    `/Subject (${escape(meta.subject)})`,
    `/Keywords (${escape(meta.keywords.join(', '))})`,
    keep('Creator'),
    keep('Producer'),
    keep('CreationDate'),
    keep('ModDate'),
    `/GBXContractsCommit (${escape(meta.contractsCommit)})`,
    `/GBXAuditCandidateCommit (${escape(meta.auditCandidateCommit)})`,
  ].filter(Boolean);

  const objectOffset = buffer.length + 1;
  const objectBytes = `\n${infoNum} 0 obj\n<<${entries.join('\n')}>>\nendobj\n`;
  const xrefOffset = objectOffset + objectBytes.length - 1;
  const update =
    objectBytes +
    `xref\n${infoNum} 1\n${String(objectOffset).padStart(10, '0')} 00000 n \n` +
    `trailer\n<</Size ${size}\n/Root ${root} 0 R\n/Info ${infoNum} 0 R\n/Prev ${previousStartXref}>>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  writeFileSync(path, Buffer.concat([buffer, Buffer.from(update, 'latin1')]));
}

/**
 * Read the printed file back and confirm it is what we intended to ship.
 *
 * `qpdf --check` is not available on every machine that builds this, so the structural
 * assertions it would cover - header, single EOF-terminated trailer chain, resolvable page
 * tree, declared MediaBox - are made here instead, from the bytes.
 */
function inspectPdf(path) {
  const buffer = readFileSync(path);
  const text = buffer.toString('latin1');

  if (!text.startsWith('%PDF-')) throw new Error('Printed file is not a PDF.');
  if (!text.trimEnd().endsWith('%%EOF')) throw new Error('PDF does not end with %%EOF; the file may be truncated.');

  const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const embedded = (text.match(/\/FontFile[23]?/g) ?? []).length;
  const fonts = [...new Set(text.match(/\/BaseFont\s*\/([A-Za-z0-9+,-]+)/g) ?? [])].map((entry) =>
    entry.replace(/\/BaseFont\s*\//, ''),
  );
  const titleMatch = text.match(/\/Title\s*\(((?:[^\\)]|\\.)*)\)/);
  const title = (titleMatch?.[1] ?? '').replace(/\\([()\\])/g, '$1');

  const mediaBoxes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/g)].map(
    (match) => ({
      width: Number(match[3]) - Number(match[1]),
      height: Number(match[4]) - Number(match[2]),
    }),
  );

  return { bytes: buffer.length, pageCount, embedded, fonts, title, mediaBoxes };
}

/** Rasterise the exact printed page at print resolution. */
function renderPng(dpi = 300) {
  mkdirSync(dirname(pngPath), { recursive: true });
  const stem = pngPath.replace(/\.png$/, '');
  execFileSync('pdftoppm', ['-png', '-r', String(dpi), '-f', '1', '-l', '1', '-singlefile', pdfPath, stem]);
  if (!existsSync(pngPath)) throw new Error('pdftoppm did not produce the expected PNG.');
  return statSync(pngPath).size;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const problems = [];

  // 1. Protocol facts: contract constants against the replayed schedule and the
  //    independently tested simulation fixture.
  const facts = verifyProtocolFacts();
  console.log(`facts     ${facts.checks} cross-checks pass against the tested simulation fixture`);

  // 2. Contrast: every foreground/background pair in the shared palette clears WCAG AA.
  const coreSources = assertNoProtocolFee();
  console.log(`fee       no fee in ${coreSources} core contracts · Mine 80/20 and Strategy 0%-20% Bribe policy pinned`);

  const contrast = [...assertContrast(), ...assertSheetContrast()];
  const worst = contrast.reduce((low, check) => (check.ratio < low.ratio ? check : low));
  console.log(`contrast  ${contrast.length} pairs pass AA · lowest ${worst.ratio}:1 (${worst.label})`);

  // 3. Copy gates, before anything is rendered to a page.
  mkdirSync(buildDir, { recursive: true });
  const documentHtml = renderDocument();
  const scanned = scanStaleClaims(documentHtml);
  scanPlaceholders(documentHtml);
  assertAsciiPunctuation(documentHtml);
  const words = assertWordBudget(documentHtml);
  writeFileSync(htmlPath, documentHtml, 'utf8');

  console.log(`stale     ${scanned} forbidden claims absent · no unresolved placeholders · ASCII hyphens only`);
  console.log(`words     ${words} of ${LIMITS.words}`);
  console.log(`html      ${htmlPath}`);

  if (args.has('--html')) return;

  // 4. Print, then read the artifact back.
  const chrome = findChrome();
  const stagedPath = resolve(buildDir, 'one-pager.pdf');
  await printToPdf(chrome, { htmlFile: htmlPath, pdfFile: stagedPath });
  stampMetadata(stagedPath);
  const report = inspectPdf(stagedPath);

  // 5. Layout audit, carried out of the browser in the document title.
  const overflow = readReportSegment(report.title, OVERFLOW_MARKER);
  const clipped = readReportSegment(report.title, CLIP_MARKER);
  const overlaps = readReportSegment(report.title, OVERLAP_MARKER);
  const tinyType = readReportSegment(report.title, TYPE_MARKER);
  const budgets = readReportSegment(report.title, BAND_MARKER);
  const overruns = readReportSegment(report.title, OVERRUN_MARKER);

  // Always show the band budget: it is how a height failure is diagnosed, and how the
  // score in src/styles.mjs is kept honest when copy changes.
  console.log(`bands     content/declared mm · ${budgets.join('  ')}`);

  if (overflow.length > 0) problems.push(`content overflows the sheet: ${overflow.join(', ')}`);
  if (clipped.length > 0) problems.push(`text is clipped inside its box: ${clipped.join(', ')}`);
  if (overlaps.length > 0) problems.push(`panels overlap: ${overlaps.join(', ')}`);
  if (tinyType.length > 0) problems.push(`type below ${LIMITS.minTypePt}pt: ${tinyType.join(', ')}`);
  if (overruns.length > 0) problems.push(`band content taller than its declared height (mm): ${overruns.join(', ')}`);

  // 6. Exactly one page, at exactly A4 landscape.
  if (report.pageCount !== LIMITS.pages) {
    problems.push(`page count is ${report.pageCount}, expected exactly ${LIMITS.pages}`);
  }
  if (report.mediaBoxes.length === 0) problems.push('no /MediaBox found; page geometry is undeclared');
  report.mediaBoxes.forEach((page, index) => {
    const offBy = Math.max(Math.abs(page.width - EXPECTED_WIDTH_PT), Math.abs(page.height - EXPECTED_HEIGHT_PT));
    if (offBy > LIMITS.dimensionTolerancePt) {
      problems.push(
        `page ${index + 1} is ${page.width.toFixed(1)}x${page.height.toFixed(1)}pt, ` +
          `expected A4 landscape ${EXPECTED_WIDTH_PT.toFixed(1)}x${EXPECTED_HEIGHT_PT.toFixed(1)}pt`,
      );
    }
  });

  // 7. Fonts must travel with the file.
  if (report.embedded === 0) {
    problems.push('no embedded font programs; the sheet would fall back to base-14 faces elsewhere');
  }

  if (problems.length > 0) {
    const detail = problems.map((entry) => `  - ${entry}`).join('\n');
    if (!args.has('--force')) {
      throw new Error(
        `Build gates failed:\n${detail}\n\nFix the copy or the band heights in src/styles.mjs.\n` +
          `Staged file (not published): ${stagedPath}`,
      );
    }
    console.log(`gates     FORCED past ${problems.length} failure(s):\n${detail}`);
  } else {
    console.log('layout    one page, nothing clipped, nothing overlapping, all type readable');
  }

  // 8. Publish only after every gate has passed.
  mkdirSync(dirname(pdfPath), { recursive: true });
  writeFileSync(pdfPath, readFileSync(stagedPath));
  const pngBytes = renderPng(300);

  console.log(`pdf       ${pdfPath}`);
  console.log(
    `          ${report.pageCount} page · ${(report.bytes / 1024).toFixed(0)} KB · ` +
      `${report.mediaBoxes[0]?.width.toFixed(1)}x${report.mediaBoxes[0]?.height.toFixed(1)}pt · ` +
      `${report.embedded} embedded font programs`,
  );
  console.log(`          ${[...new Set(report.fonts.map((name) => name.replace(/^[A-Z]{6}\+/, '')))].join(', ')}`);
  console.log(`png       ${pngPath} · 300 dpi · ${(pngBytes / 1024).toFixed(0)} KB`);

  if (args.has('--open')) execFileSync('open', [pdfPath]);
}

await main();
