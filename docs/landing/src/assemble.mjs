#!/usr/bin/env node
/* Assemble the landing page from fragments. `node assemble.mjs` -> docs/landing/index.html
   `node assemble.mjs --only 30-mining` -> docs/landing/preview-30-mining.html */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = dirname(fileURLToPath(import.meta.url));
const out = dirname(src);
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const head = readFileSync(join(src, '00-head.html'), 'utf8');
const harness = readFileSync(join(src, '90-harness.html'), 'utf8');

let sections;
if (only) {
  const file = join(src, 'sections', `${only}.html`);
  if (!existsSync(file)) { console.error(`no such fragment: ${file}`); process.exit(1); }
  sections = [file];
} else {
  sections = readdirSync(join(src, 'sections')).filter((f) => f.endsWith('.html')).sort()
    .map((f) => join(src, 'sections', f));
}

const body = sections.map((f) => readFileSync(f, 'utf8')).join('\n');
const html = `${head.trimEnd()}\n\n${body.trimEnd()}\n\n${harness.trimEnd()}\n`;

// Guards for the traps the brief lists.
const errs = [];
if (!/meta charset="utf-8"/i.test(html)) errs.push('missing <meta charset="utf-8">');
// Anchor hrefs are navigation, not requests — only flag resource loads (src=, and <link href=).
const external = [
  ...[...html.matchAll(/src="(https?:\/\/[^"]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/<link[^>]*href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]),
].filter((u) => !/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(u));
if (external.length) errs.push(`external resource loads beyond Google Fonts: ${external.join(', ')}`);
const rafCount = (html.match(/requestAnimationFrame\s*\(\s*frame/g) || []).length;
if (!only && rafCount > 2) errs.push(`more than one rAF loop detected (${rafCount} calls)`);
if (/setInterval\s*\(/.test(body)) errs.push('setInterval found in a section fragment — the harness owns time');

const dest = join(out, only ? `preview-${only}.html` : 'index.html');
writeFileSync(dest, html);
console.log(`wrote ${dest} (${(html.length / 1024).toFixed(0)}KB)`);
if (errs.length) { console.error('CONTRACT VIOLATIONS:\n  - ' + errs.join('\n  - ')); process.exit(1); }
