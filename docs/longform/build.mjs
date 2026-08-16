#!/usr/bin/env node
/**
 * Builds the two long-form PDF editions from their markdown sources:
 *
 *   docs/articles/gumball-6900-explained.md      -> output/pdf/GumBall6900-explained.pdf
 *   docs/whitepapers/gumball-6900/whitepaper.md  -> output/pdf/GumBall6900-whitepaper.pdf
 *
 * The whitepaper and one-pager builders paginate by hand, which is right for an eight-page
 * designed artefact and impossible for a 21,000-word reference. Here the markdown is the
 * source of truth, Chrome paginates, and the shared theme keeps all editions in one visual
 * family.
 *
 * Usage: node docs/longform/build.mjs [--html] [--only=article|whitepaper]
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

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

import { brandmark } from '../whitepaper/src/brand-asset.mjs';
import { assertContrast } from '../whitepaper/src/theme.mjs';
import { chartFor, chartIds } from './charts.mjs';
import { figureFor } from './figures.mjs';
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
    key: 'article',
    source: 'docs/articles/gumball-6900-explained.md',
    out: 'output/pdf/GumBall6900-explained.pdf',
    title: 'GumBall6900 — Explained',
    subtitle: 'How GUM BALL 6900 turns community\nconviction into an onchain portfolio',
    thesis:
      'A plain-language walkthrough of the whole protocol: what GBX is, what signaling does, where revenue comes from, how acquisitions and redemptions work, and what the design explicitly does not guarantee.',
    runner: 'GumBall6900 — Explained',
    toc: false,
  },
  {
    key: 'whitepaper',
    source: 'docs/whitepapers/gumball-6900/whitepaper.md',
    out: 'output/pdf/GumBall6900-whitepaper.pdf',
    title: 'GumBall6900 — Technical Whitepaper',
    subtitle: 'A signal-directed onchain portfolio\nacquisition and redemption protocol',
    thesis:
      'The complete technical specification: exact formulas, state-transition tables, accounting identities, security invariants, precision analysis, threat model, and verification evidence.',
    runner: 'GumBall6900 — Technical Whitepaper',
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

/**
 * Mermaid fences are replaced with hand-set SVG. A fence with no counterpart is reported
 * by the caller rather than dropped, so a new diagram cannot silently vanish from print.
 */
/**
 * Expands `<!-- figure: id -->` markers into named charts.
 *
 * The marker is an HTML comment so it stays invisible wherever the markdown is read
 * directly. An unknown id fails the build rather than vanishing, which is the same rule
 * the Mermaid path follows.
 */
function renderNamedFigures(body, unknown) {
  return body.replace(/<!--\s*figure:\s*([a-z0-9-]+)\s*-->/g, (_m, id) => {
    const chart = chartFor(id);
    if (!chart) {
      unknown.push(id);
      return '';
    }
    return `<div class="figure">${chart.svg}<p class="figure__caption">${chart.caption}</p></div>`;
  });
}

function renderFences(body, missing, drifted) {
  return body.replace(/```mermaid\n([\s\S]*?)```/g, (_match, source) => {
    const figure = figureFor(source);
    if (!figure) {
      missing.push(source.split('\n')[0].trim());
      return '';
    }
    if (figure.drift) {
      drifted.push(figure.drift);
      return '';
    }
    return `<div class="figure">${figure.svg}<p class="figure__caption">${figure.caption}</p></div>`;
  });
}

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
    ['Source commit', meta.source_commit ? `${meta.source_commit.slice(0, 12)}…` : null],
    ['Protocol status', meta.protocol_status],
    ['Deployment', meta.deployment_status],
    ['Independent audit', meta.independent_audit_status],
  ].filter(([, v]) => v);

  return `
<section class="cover">
  <div class="cover__inner">
    <span class="cover__chip">${edition.key === 'whitepaper' ? 'Technical whitepaper' : 'Explainer'} · ${meta.date ?? ''}</span>
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
  const { meta, body } = splitFrontMatter(raw);
  const missing = [];
  const drifted = [];
  const unknownFigures = [];
  // The H1 becomes the cover title, so it is dropped from the flow to avoid printing twice.
  const withoutTitle = body.replace(/^#\s+.+$/m, '');
  const withCharts = renderNamedFigures(withoutTitle, unknownFigures);
  const withFigures = renderFences(withCharts, missing, drifted);
  const rendered = markLongTables(md.render(withFigures));

  const brandFont = resolve(repoRoot, 'docs/whitepaper/fonts/Modak-Regular.ttf');
  const css = stylesheet({
    brandFontUrl: existsSync(brandFont) ? `file://${brandFont}` : undefined,
    documentTitle: edition.runner,
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${edition.title}</title>
<style>${css}</style>
</head>
<body>
${coverBlock(edition, meta)}
${edition.toc ? tocBlock(body) : ''}
<main>${rendered}</main>
</body>
</html>`;

  return { html, meta, missing, drifted, unknownFigures };
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

async function printPdf(chrome, htmlPath, pdfPath) {
  mkdirSync(dirname(pdfPath), { recursive: true });
  const profile = resolve(tmpdir(), `gumball-longform-${process.pid}`);
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
  await new Promise((res, rej) => {
    const proc = spawn(chrome, args, { stdio: 'ignore' });
    proc.on('error', rej);
    proc.on('exit', (code) => (code === 0 ? res() : rej(new Error(`Chrome exited ${code}`))));
  });
  rmSync(profile, { recursive: true, force: true });
  // Chrome writes the file after the process reports exit on some platforms.
  for (let i = 0; i < 40 && !existsSync(pdfPath); i++) await sleep(50);
  if (!existsSync(pdfPath)) throw new Error(`Chrome produced no PDF at ${pdfPath}`);
}

function pdfPageCount(pdfPath) {
  try {
    const out = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    return Number(out.match(/^Pages:\s+(\d+)$/m)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------------- main ---- */

const htmlOnly = process.argv.includes('--html');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

assertContrast();
mkdirSync(buildDir, { recursive: true });

const chrome = htmlOnly ? null : findChrome();

for (const edition of EDITIONS) {
  if (only && only !== edition.key) continue;

  const sourcePath = resolve(repoRoot, edition.source);
  const raw = readFileSync(sourcePath, 'utf8');
  const { html, meta, missing, drifted, unknownFigures } = buildHtml(edition, raw);

  if (unknownFigures.length > 0) {
    throw new Error(`Unknown figure id(s): ${unknownFigures.join(', ')}\nRegistered: ${chartIds().join(', ')}`);
  }

  if (drifted.length > 0) {
    throw new Error(
      `Diagram source changed since the figure was drawn:\n` +
        drifted.map((d) => `  ${d.id}: expected ${d.expected}, source now ${d.actual}`).join('\n') +
        `\nRedraw the SVG in docs/longform/figures.mjs and update its hashes, or revert the Mermaid.`,
    );
  }

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
  if (missing.length > 0) {
    console.log(`  FIGURES   ${missing.length} mermaid block(s) with no hand-set figure: ${missing.join(', ')}`);
  }
  console.log(`  html      ${htmlPath}`);

  if (htmlOnly) continue;

  const pdfPath = resolve(repoRoot, edition.out);
  await printPdf(chrome, htmlPath, pdfPath);
  const size = (statSync(pdfPath).size / 1024).toFixed(0);
  const pages = pdfPageCount(pdfPath);
  console.log(`  pdf       ${edition.out} · ${pages || '?'} pages · ${size} KB`);
  if (!meta.source_commit) console.log('  WARNING   source has no source_commit in front matter');
}
