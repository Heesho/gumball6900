#!/usr/bin/env node
/**
 * Builds `output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf`.
 *
 * The document is rendered to a self-contained HTML file with explicit A4 pagination and
 * printed by headless Chrome, which subsets and embeds every face it resolves. Run with
 * `--html` to stop after writing the HTML, which is the fastest way to iterate on layout.
 *
 * Usage: node docs/whitepaper/build.mjs [--html] [--open]
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { meta, renderPages } from './src/document.mjs';
import { verifyProtocolFacts } from './src/protocol-facts.mjs';
import { stylesheet } from './src/styles.mjs';
import { assertContrast } from './src/theme.mjs';

/**
 * Stale-claim gate. These phrases described earlier design iterations and must never
 * reappear in rendered output. Matching is case-insensitive against the page HTML.
 */
const STALE_PHRASES = [
  'relative weights',
  'whole-account reset',
  'reset all allocations',
  'one reward token per strategy',
  'unlimited reward tokens',
  'management fee',
  'five management actions',
  'four ongoing',
  'setBribeBps',
  'bribeBps',
  // '90/10' was listed here while the split was a superseded ADR 0013/0016 design. ADR
  // 0032 made a fixed 90% Fund / 10% paired-Bribe classification the current behaviour,
  // so blocking the term would now reject a correct document. The phrases that became
  // stale in its place are the 100%-Fund claims below.
  'fund migration',
  'successor fund',
  'migrate liquidity',
  'withdraw the LP NFT',
  'compoundRequirement',
  'compound the position',
  'fees are not protocol revenue',
  'always receives a majority',
  'never reaches zero',
  'automatic rebalancing',
  'fixed basket',
  'tracks nav',
  'pegged to fund',
  'guaranteed profit',
  'guaranteed yield',
  'guaranteed backing',
  'risk-free',
  'battle-tested',
  'fully trustless',
  'fully decentralized',
  'live on robinhood',
  'TODO',
  'FIXME',
  'fundraiser',
  '980,000,000',
  'fixed gbx supply',
  'gbx erc20votes',
  'gbx voting token',
  'multisig proposer',
  'resonance.addsignal',
  'resonance.removesignal',
  // Superseded by ADR 0032: acquired-asset payments are no longer wholly Fund-bound.
  '100% to fund',
  '100% fund',
  'no auction proceeds',
  'never fund bribes',
  'never receive auction proceeds',
  // Superseded by ADR 0031: idle receipts and the standalone staking surface are gone.
  'idle sgbx',
  'idle receipt',
  'allocatedbalance',
  'stakeandsignal',
  'removesignalandunstake',
  'stake and signal',
  'remove signal and unstake',
];

function scanStaleClaims(documentHtml) {
  const lower = documentHtml.toLowerCase();
  const hits = STALE_PHRASES.filter((phrase) => lower.includes(phrase.toLowerCase()));
  if (hits.length > 0) {
    throw new Error(`Stale or forbidden phrases present in rendered document:\n  ${hits.join('\n  ')}`);
  }
  return STALE_PHRASES.length;
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const buildDir = resolve(here, 'build');
const htmlPath = resolve(buildDir, 'whitepaper.html');
const pdfPath = resolve(repoRoot, 'output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf');

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

/**
 * Chrome flags shared by both passes.
 *
 * The throwaway profile lives in the OS temp directory rather than the worktree: a fresh
 * profile inside the repo is slow to create and would otherwise litter version control.
 */
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
    `--user-data-dir=${resolve(tmpdir(), `gumball-whitepaper-${profileName}-${process.pid}`)}`,
  ];
}

function disposeProfile(profileName) {
  rmSync(resolve(tmpdir(), `gumball-whitepaper-${profileName}-${process.pid}`), { recursive: true, force: true });
}

function findChrome() {
  const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!chrome) {
    throw new Error(
      `No Chrome or Chromium binary found. Set CHROME_PATH to one, or install Chrome.\nLooked in:\n  ${CHROME_CANDIDATES.join('\n  ')}`,
    );
  }
  return chrome;
}

const OVERFLOW_MARKER = 'LAYOUT-OVERFLOW';
const OVERPRINT_MARKER = 'LAYOUT-OVERPRINT';

/**
 * Layout guard.
 *
 * Pages are fixed-height and clip their overflow, which keeps pagination predictable but
 * would silently swallow content that grew too tall. This script measures every page after
 * layout and, when anything escapes its frame, reports it through the document title —
 * which Chrome copies into the printed PDF's metadata. That lets one print pass carry both
 * the document and its own layout report, with no second browser launch to go wrong.
 *
 * It also catches OVERPRINTS, which overflow cannot see. An absolutely positioned block
 * inside a frame sits outside normal flow, so it can land on top of in-flow content while
 * the frame's scrollHeight stays perfectly within bounds — the page reports clean and prints
 * with two paragraphs stacked on each other. Page 2 shipped that way once; this is the check
 * that would have caught it.
 */
const AUDIT_SCRIPT = `
(() => {
  const offenders = [];
  const collisions = [];

  document.querySelectorAll('.page').forEach((page) => {
    const frame = page.querySelector('.frame');
    if (!frame) return;

    const overflow = Math.max(
      frame.scrollHeight - frame.clientHeight,
      frame.scrollWidth - frame.clientWidth,
    );
    if (overflow > 1) offenders.push(page.id + '+' + Math.ceil(overflow));

    // Overprint check: any out-of-flow child of the frame versus every in-flow child.
    const children = [...frame.children];
    const positioned = [];
    const inFlow = [];
    for (const child of children) {
      const style = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      (style.position === 'absolute' || style.position === 'fixed' ? positioned : inFlow).push(rect);
    }
    for (const a of positioned) {
      for (const b of inFlow) {
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 2 && overlapY > 2) {
          collisions.push(page.id + '~' + Math.ceil(overlapY));
        }
      }
    }
  });

  const report = [];
  if (offenders.length > 0) report.push('${OVERFLOW_MARKER} ' + offenders.join(' '));
  if (collisions.length > 0) report.push('${OVERPRINT_MARKER} ' + [...new Set(collisions)].join(' '));
  if (report.length > 0) document.title = report.join(' | ');
})();
`;

function renderDocument() {
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
${stylesheet({ brandFontUrl: `file://${resolve(here, 'fonts/Modak-Regular.ttf')}` })}
</style>
</head>
<body>
${renderPages()}
<script>${AUDIT_SCRIPT}</script>
</body>
</html>
`;
}

/** Read the layout report back out of the printed file's title. */
/** Pull one marker's segment out of the reported title. Segments are ' | '-separated. */
function readReportSegment(title, marker, separator) {
  const segment = title.split(' | ').find((part) => part.trim().startsWith(marker));
  if (!segment) return [];
  return segment
    .trim()
    .slice(marker.length)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => {
      const [id, px] = entry.split(separator);
      return { id, px: Number(px) };
    });
}

const readOverflowReport = (title) => readReportSegment(title, OVERFLOW_MARKER, '+');
const readOverprintReport = (title) => readReportSegment(title, OVERPRINT_MARKER, '~');

/**
 * Print with headless Chrome.
 *
 * Chrome reliably writes the PDF and then, on this platform, frequently fails to exit — so
 * the build waits on the artifact rather than on the process. Once the file has stopped
 * growing it is complete, and the browser is terminated.
 */
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

      if (exited && size <= 0) {
        throw new Error(`Chrome exited without writing a PDF.\n${stderr.trim()}`);
      }
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
 * Chrome writes only Title, Creator, Producer, and dates into the Info dictionary. The
 * document's author, subject, keywords, and the commits it describes belong in the file's
 * metadata too, so this appends a standards-conforming incremental update that replaces
 * the Info object. Appending (rather than rewriting) leaves every existing byte and
 * cross-reference untouched.
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
    keep('Title'),
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

/** Read back the printed file and confirm it is what we intended to ship. */
function inspectPdf(path) {
  const buffer = readFileSync(path);
  const text = buffer.toString('latin1');
  const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const embedded = (text.match(/\/FontFile[23]?/g) ?? []).length;
  const fonts = [...new Set(text.match(/\/BaseFont\s*\/([A-Za-z0-9+,-]+)/g) ?? [])].map((entry) =>
    entry.replace(/\/BaseFont\s*\//, ''),
  );
  const titleMatch = text.match(/\/Title\s*\(((?:[^\\)]|\\.)*)\)/);
  const title = (titleMatch?.[1] ?? '').replace(/\\([()\\])/g, '$1');

  return { bytes: buffer.length, pageCount, embedded, fonts, title };
}

async function main() {
  const args = new Set(process.argv.slice(2));

  const facts = verifyProtocolFacts();
  console.log(
    `facts     ${facts.checks} cross-checks pass · ${facts.genesisLiquidityTokens.toLocaleString('en-US')} genesis GBX · ${facts.maxCapacity} slot hard cap`,
  );

  const contrast = assertContrast();
  const worst = contrast.reduce((low, check) => (check.ratio < low.ratio ? check : low));

  mkdirSync(buildDir, { recursive: true });
  const documentHtml = renderDocument();
  const scanned = scanStaleClaims(documentHtml);
  writeFileSync(htmlPath, documentHtml, 'utf8');
  console.log(`html      ${htmlPath}`);
  console.log(`stale     ${scanned} forbidden phrases absent`);
  console.log(`contrast  ${contrast.length} pairs pass AA · lowest ${worst.ratio}:1 (${worst.label})`);

  if (args.has('--html')) return;

  const chrome = findChrome();

  // Print to a staging path so a failed verification never replaces a good published PDF.
  const stagedPath = resolve(buildDir, 'whitepaper.pdf');
  await printToPdf(chrome, { htmlFile: htmlPath, pdfFile: stagedPath });
  stampMetadata(stagedPath);

  const report = inspectPdf(stagedPath);

  const offenders = readOverflowReport(report.title);
  const overprints = readOverprintReport(report.title);

  if (offenders.length > 0) {
    const detail = offenders.map((page) => `${page.id} (+${page.px}px)`).join(', ');
    console.log(`layout    OVERFLOW on ${offenders.length} page(s): ${detail}`);
  }
  if (overprints.length > 0) {
    const detail = overprints.map((page) => `${page.id} (${page.px}px deep)`).join(', ');
    console.log(`overprint OUT-OF-FLOW CONTENT lands on in-flow content: ${detail}`);
  }

  if (offenders.length > 0 || overprints.length > 0) {
    if (!args.has('--force')) {
      throw new Error(
        'Layout is broken on the pages listed above: content is clipped or printed on top of other content.\n' +
          `Fix them, or pass --force while drafting.\nStaged file: ${stagedPath}`,
      );
    }
  } else {
    console.log(`layout    all ${report.pageCount} pages fit their frames, no overprints`);
  }

  if (report.embedded === 0) {
    throw new Error('Printed PDF embeds no fonts; it would fall back to base-14 faces on other machines.');
  }

  mkdirSync(dirname(pdfPath), { recursive: true });
  writeFileSync(pdfPath, readFileSync(stagedPath));

  console.log(`pdf       ${pdfPath}`);
  console.log(
    `           ${report.pageCount} pages · ${(report.bytes / 1024).toFixed(0)} KB · ${report.embedded} embedded font programs`,
  );
  console.log(`           ${[...new Set(report.fonts.map((name) => name.replace(/^[A-Z]{6}\+/, '')))].join(', ')}`);

  if (args.has('--open')) execFileSync('open', [pdfPath]);
}

await main();
