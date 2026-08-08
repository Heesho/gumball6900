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
import { stylesheet } from './src/styles.mjs';
import { assertContrast } from './src/theme.mjs';

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

/**
 * Layout guard.
 *
 * Pages are fixed-height and clip their overflow, which keeps pagination predictable but
 * would silently swallow content that grew too tall. This script measures every page after
 * layout and, when anything escapes its frame, reports it through the document title —
 * which Chrome copies into the printed PDF's metadata. That lets one print pass carry both
 * the document and its own layout report, with no second browser launch to go wrong.
 */
const AUDIT_SCRIPT = `
(() => {
  const offenders = [];
  document.querySelectorAll('.page').forEach((page) => {
    const frame = page.querySelector('.frame');
    if (!frame) return;
    const overflow = Math.max(
      frame.scrollHeight - frame.clientHeight,
      frame.scrollWidth - frame.clientWidth,
    );
    if (overflow > 1) offenders.push(page.id + '+' + Math.ceil(overflow));
  });
  if (offenders.length > 0) document.title = '${OVERFLOW_MARKER} ' + offenders.join(' ');
})();
`;

function renderDocument() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${meta.title}</title>
<meta name="author" content="GumBall6900">
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
function readOverflowReport(title) {
  if (!title.startsWith(OVERFLOW_MARKER)) return [];
  return title
    .slice(OVERFLOW_MARKER.length)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => {
      const [id, overflowPx] = entry.split('+');
      return { id, overflowPx: Number(overflowPx) };
    });
}

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

  const contrast = assertContrast();
  const worst = contrast.reduce((low, check) => (check.ratio < low.ratio ? check : low));

  mkdirSync(buildDir, { recursive: true });
  writeFileSync(htmlPath, renderDocument(), 'utf8');
  console.log(`html      ${htmlPath}`);
  console.log(`contrast  ${contrast.length} pairs pass AA · lowest ${worst.ratio}:1 (${worst.label})`);

  if (args.has('--html')) return;

  const chrome = findChrome();

  // Print to a staging path so a failed verification never replaces a good published PDF.
  const stagedPath = resolve(buildDir, 'whitepaper.pdf');
  await printToPdf(chrome, { htmlFile: htmlPath, pdfFile: stagedPath });

  const report = inspectPdf(stagedPath);

  const offenders = readOverflowReport(report.title);
  if (offenders.length > 0) {
    const detail = offenders.map((page) => `${page.id} (+${page.overflowPx}px)`).join(', ');
    console.log(`layout    OVERFLOW on ${offenders.length} page(s): ${detail}`);
    if (!args.has('--force')) {
      throw new Error(
        `Content is clipped on the pages listed above. Shorten them, or pass --force.\nStaged file: ${stagedPath}`,
      );
    }
  } else {
    console.log(`layout    all ${report.pageCount} pages fit their frames`);
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
