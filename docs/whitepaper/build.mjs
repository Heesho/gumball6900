#!/usr/bin/env node
/**
 * Builds the sole whitepaper PDF from the canonical Markdown source:
 *
 *   docs/WHITEPAPER.md -> output/pdf/GumBall6900-whitepaper.pdf
 *
 * Markdown is the source of truth, Chrome paginates, and the shared theme keeps the PDF
 * consistent with the websites without maintaining a second authored edition.
 *
 * Usage: node docs/whitepaper/build.mjs [--html]
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

/**
 * markdown-it is present in the workspace but only transitively, so a bare specifier does
 * not resolve from here. Declaring it as a root devDependency was tried and rejected:
 * `pnpm add` rewrote 3,669 lines of the lockfile, and a docs build has no business
 * shifting resolutions across the workspace. This resolves it from the store instead,
 * globbing the version so a bump does not break the build, and fails loudly with the fix
 * if the package ever leaves the tree.
 */
const require_ = createRequire(import.meta.url);

function loadMarkdownIt() {
  try {
    return require_('markdown-it');
  } catch {
    /* fall through to the store lookup */
  }
  const storeDir = resolve(repoRoot, 'node_modules/.pnpm');
  const match = existsSync(storeDir)
    ? readdirSync(storeDir)
        .filter((d) => d.startsWith('markdown-it@'))
        .sort()
        .pop()
    : undefined;
  if (!match) {
    throw new Error(
      'markdown-it is not resolvable. It is normally present transitively; if it has left the tree, add it explicitly:\n' +
        '  pnpm add -Dw markdown-it\n' +
        'and review the resulting lockfile diff before committing.',
    );
  }
  return require_(resolve(storeDir, match, 'node_modules/markdown-it'));
}
import { brandmark } from './src/brand-asset.mjs';
import { verifyProtocolFacts } from './src/protocol-facts.mjs';
import { assertContrast } from './src/theme.mjs';
import { stylesheet } from './styles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const buildDir = resolve(here, 'build');

/**
 * Claims that must never reach a rendered edition.
 *
 * These are assertion-shaped, not identifier-shaped, and that distinction is the whole
 * design. A first pass listed bare identifiers like `stakeAndSignalWithPermit`, which
 * fired on the whitepaper's own supersession history — §14.1 names the removed functions
 * precisely to record that ADR 0031 removed them. Naming a dead API is correct; asserting
 * it is current is not, and only the latter can be caught by phrase matching.
 *
 * `scanStale` additionally skips any line carrying a supersession marker, so a future
 * passage that quotes a superseded claim in order to retract it does not trip the gate.
 */
const STALE_PHRASES = [
  'no auction proceeds ever fund bribe',
  'never fund bribe rewards',
  '100% of every auction payment becomes a fixed fund liability',
  'idle sgbx votes but directs no revenue',
  'there is no idle state, so staking alone',
];

/** Lines that retract or historicise a claim are exempt from the phrase gate. */
const SUPERSESSION_MARKERS = [
  'supersed',
  'removed by',
  'no longer',
  'earlier draft',
  'was rejected',
  'formerly',
  'previously',
  'must not be presented',
  'discard',
  'stale',
  'historical',
];

const EDITIONS = [
  {
    key: 'whitepaper',
    source: 'docs/WHITEPAPER.md',
    out: 'output/pdf/GumBall6900-whitepaper.pdf',
    toc: true,
  },
];

/* ------------------------------------------------------------- front matter ---- */

/** Splits YAML front matter from the body. Only flat `key: value` pairs are used. */
function splitFrontMatter(raw) {
  if (!raw.startsWith('---\n')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { meta: {}, body: raw };
  const meta = {};
  for (const line of raw.slice(4, end).split('\n')) {
    const at = line.indexOf(':');
    if (at === -1) continue;
    meta[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return { meta, body: raw.slice(end + 4) };
}

/* ------------------------------------------------------------------ render ---- */

const MarkdownIt = loadMarkdownIt();
const md = new MarkdownIt({ html: true, linkify: false, typographer: true });

/** Long tables are allowed to break across pages; short ones are kept whole. */
function markLongTables(htmlBody) {
  return htmlBody.replace(/<table>([\s\S]*?)<\/table>/g, (match, inner) => {
    const rows = (inner.match(/<tr>/g) ?? []).length;
    return rows > 12 ? `<table class="table--long">${inner}</table>` : match;
  });
}

function coverBlock(edition, meta) {
  const rows = [
    ['Version', meta.version],
    ['Date', meta.date],
    ['Author', meta.author],
    ['Source commit', meta.source_commit ? `${meta.source_commit.slice(0, 12)}…` : null],
    ['Protocol status', meta.protocol_status],
    ['Deployment', meta.deployment_status],
    ['Independent audit', meta.independent_audit_status],
  ].filter(([, v]) => v);

  return `
<section class="cover">
  <div class="cover__inner">
    <span class="cover__chip">Whitepaper · ${meta.date ?? ''}</span>
    <div class="cover__lockup">
      ${brandmark('26mm')}
      <h1 class="cover__title">${edition.title.replace(/ — .*/, '')}</h1>
      <p class="cover__subtitle">${edition.subtitle.replace(/\n/g, '<br />')}</p>
      <p class="cover__thesis">${edition.thesis}</p>
    </div>
    <div class="cover__meta">
      <div class="cover__rule"></div>
      <div class="cover__grid">
        ${rows.map(([k, v]) => `<div><p class="cover__k">${k}</p><p class="cover__v">${v}</p></div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
}

/** Contents from the `## n. Title` headings the whitepaper already numbers. */
function tocBlock(body) {
  const entries = [...body.matchAll(/^## (\d+)\.\s+(.+)$/gm)].map((m) => ({ num: m[1], title: m[2] }));
  if (entries.length === 0) return '';
  return `
<section class="toc">
  <h1>Contents</h1>
  ${entries
    .map(
      (e) =>
        `<div class="toc__row"><span class="toc__num">${e.num}</span><span class="toc__title">${e.title}</span></div>`,
    )
    .join('')}
</section>`;
}

function buildHtml(edition, raw) {
  const split = splitFrontMatter(raw);
  const body = split.body;
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const subtitleMatch = body.match(/^##\s+(.+)$/m);
  const bylineMatch = body.match(/^Whitepaper\s+(v\S+)\s+—\s+(.+?)\s+—\s+by\s+(.+)$/m);
  const abstractMatch = body.match(/^## Abstract\s*\n+([^\n]+(?:\n(?!\n)[^\n]+)*)/m);
  if (!titleMatch || !subtitleMatch || !bylineMatch || !abstractMatch) {
    throw new Error('Canonical whitepaper is missing its title, subtitle, byline, or Abstract opening paragraph.');
  }
  const abstractText = abstractMatch?.[1].replace(/\n/g, ' ').replace(/[`*_]/g, ' ');
  const abstractSentences = abstractText?.match(/[^.!?]+[.!?]+/g) ?? [];
  const meta = {
    ...split.meta,
    version: split.meta.version ?? bylineMatch?.[1],
    date: split.meta.date ?? bylineMatch?.[2],
    author: split.meta.author ?? bylineMatch?.[3],
  };
  const display = {
    ...edition,
    title: titleMatch?.[1] ?? 'GumBall6900',
    subtitle: subtitleMatch?.[1] ?? 'Whitepaper',
    thesis:
      abstractSentences.slice(0, 2).join(' ').trim() ||
      'A signal-directed onchain portfolio acquisition and redemption protocol.',
  };

  // The title, subtitle, and byline become cover matter, so they are removed from the body.
  let withoutCover = body;
  for (const match of [titleMatch, subtitleMatch, bylineMatch]) {
    if (match) withoutCover = withoutCover.replace(match[0], '');
  }
  const rendered = markLongTables(
    md
      .render(withoutCover)
      .replace(
        /<!--\s*pdf-page-break-padded\s*-->/g,
        '<div class="pdf-page-break pdf-page-break--padded" aria-hidden="true"></div>',
      )
      .replace(/<!--\s*pdf-page-break\s*-->/g, '<div class="pdf-page-break" aria-hidden="true"></div>'),
  );

  const brandFont = resolve(repoRoot, 'docs/whitepaper/fonts/Modak-Regular.ttf');
  const css = stylesheet({
    brandFontUrl: existsSync(brandFont) ? `file://${brandFont}` : undefined,
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${display.title}</title>
<meta name="author" content="${meta.author}" />
<style>${css}</style>
</head>
<body>
${coverBlock(display, meta)}
${edition.toc ? tocBlock(body) : ''}
<main>${rendered}</main>
</body>
</html>`;

  return { html };
}

/* -------------------------------------------------------------------- gate ---- */

function scanStale(html) {
  const hits = [];
  let exempted = 0;
  for (const line of html.toLowerCase().split('\n')) {
    const matched = STALE_PHRASES.filter((p) => line.includes(p));
    if (matched.length === 0) continue;
    if (SUPERSESSION_MARKERS.some((m) => line.includes(m))) {
      exempted += matched.length;
      continue;
    }
    hits.push(...matched);
  }
  if (hits.length > 0) {
    throw new Error(
      `Superseded claims asserted as current:\n  ${[...new Set(hits)].join('\n  ')}\n` +
        'If the passage retracts the claim rather than making it, it needs a supersession marker.',
    );
  }
  return { checked: STALE_PHRASES.length, exempted };
}

/* ------------------------------------------------------------------ chrome ---- */

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((c) => existsSync(c));
  if (!found) throw new Error(`No Chrome found. Set CHROME_PATH. Tried:\n  ${CHROME_CANDIDATES.join('\n  ')}`);
  return found;
}

const PRINT_TIMEOUT_MS = 180_000;

async function printPdf(chrome, htmlPath, pdfPath) {
  mkdirSync(dirname(pdfPath), { recursive: true });
  const profile = resolve(tmpdir(), `gumball-whitepaper-${process.pid}`);
  const args = [
    '--headless',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--mute-audio',
    `--user-data-dir=${profile}`,
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ];
  // Headless Chrome writes the PDF and then, on some builds, never exits. Wait for the file to stop growing
  // rather than for the process, then terminate it once the file is stable.
  rmSync(pdfPath, { force: true });
  const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
  let exited = false;
  let spawnError = null;
  child.on('error', (error) => (spawnError = error));
  child.on('exit', () => (exited = true));

  const deadline = Date.now() + PRINT_TIMEOUT_MS;
  let lastSize = -1;
  let stableFor = 0;

  try {
    while (Date.now() < deadline) {
      await sleep(300);
      if (spawnError) throw spawnError;
      const size = existsSync(pdfPath) ? statSync(pdfPath).size : -1;
      if (size > 0 && size === lastSize) {
        stableFor += 300;
        if (stableFor >= 1_200) return;
      } else {
        stableFor = 0;
      }
      lastSize = size;
      if (exited && size <= 0) throw new Error(`Chrome exited without writing a PDF.\n${stderr.trim()}`);
    }
    throw new Error(`Chrome did not produce a PDF within ${PRINT_TIMEOUT_MS / 1000}s.\n${stderr.trim()}`);
  } finally {
    if (!exited) child.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
  }
}

function inspectPdf(pdfPath) {
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const pages = Number(info.match(/^Pages:\s+(\d+)$/m)?.[1] ?? 0);
  const title = info.match(/^Title:\s*(.+)$/m)?.[1].trim();
  const pageSize = info.match(/^Page size:\s*(.+)$/m)?.[1].trim();
  if (pages < 1) throw new Error('PDF inspection found no pages.');
  if (!pageSize?.endsWith('(A4)')) throw new Error(`PDF inspection expected A4 pages, received: ${pageSize ?? 'none'}`);
  if (title !== 'GumBall6900')
    throw new Error(`PDF inspection expected title GumBall6900, received: ${title ?? 'none'}`);
  if (/^Encrypted:\s+yes$/m.test(info)) throw new Error('PDF inspection found unexpected encryption.');

  const fonts = execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' });
  const embeddedFonts = fonts
    .split('\n')
    .slice(2)
    .filter((line) => /\syes\s+yes\s+yes\s+\d+\s+\d+\s*$/.test(line)).length;
  if (embeddedFonts < 1) throw new Error('PDF inspection found no embedded Unicode fonts.');

  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  for (const required of [
    'The index fund that chooses itself',
    'not deployed, and not authorized for user funds',
    '10. Status',
  ]) {
    if (!text.includes(required)) throw new Error(`PDF inspection could not recover required text: ${required}`);
  }

  return { pages, title, pageSize, embeddedFonts };
}

/* -------------------------------------------------------------------- main ---- */

const htmlOnly = process.argv.includes('--html');

assertContrast();
mkdirSync(buildDir, { recursive: true });

const facts = verifyProtocolFacts();
console.log(`facts     ${facts.checks} contract/fixture checks pass`);

const chrome = htmlOnly ? null : findChrome();

for (const edition of EDITIONS) {
  const sourcePath = resolve(repoRoot, edition.source);
  const raw = readFileSync(sourcePath, 'utf8');
  const { html } = buildHtml(edition, raw);

  const stale = scanStale(html);
  const htmlPath = resolve(buildDir, `${edition.key}.html`);
  writeFileSync(htmlPath, html);

  console.log(`\n${edition.key}`);
  console.log(`  source    ${edition.source} · ${raw.split(/\s+/).length.toLocaleString()} words`);
  console.log(`  figures   ${(html.match(/class="figure"/g) ?? []).length} rendered`);
  console.log(
    `  stale     ${stale.checked} superseded claims absent` +
      (stale.exempted ? ` · ${stale.exempted} retraction(s) exempt` : ''),
  );
  console.log(`  html      ${htmlPath}`);

  if (htmlOnly) continue;

  const pdfPath = resolve(repoRoot, edition.out);
  const stagedPath = resolve(buildDir, `${edition.key}.pdf`);
  await printPdf(chrome, htmlPath, stagedPath);
  const report = inspectPdf(stagedPath);
  const size = (statSync(stagedPath).size / 1024).toFixed(0);
  mkdirSync(dirname(pdfPath), { recursive: true });
  renameSync(stagedPath, pdfPath);
  console.log(
    `  pdf       ${edition.out} · ${report.pages} pages · ${size} KB · ${report.embeddedFonts} embedded Unicode fonts`,
  );
}
