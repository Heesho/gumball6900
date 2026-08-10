/**
 * The whitepaper: page order and rendering.
 *
 * Prose lives in `pages/*.mjs`, one module per part, all built from the shared primitives
 * in `page-kit.mjs`. This file assembles them, assigns section and figure numbers in
 * document order, computes the two contents pages, and stamps runners and folios. The
 * canonical text remains `docs/WHITEPAPER.md`; the reviewed contracts remain the source of
 * truth for both, enforced by `protocol-facts.mjs` at build time.
 */

import { html } from './page-kit.mjs';
import { meta } from './meta.mjs';
import { frontPages } from './pages/front.mjs';
import { part1Pages, part2Pages } from './pages/part1-2.mjs';
import { part3Pages, part4Pages } from './pages/part3-4.mjs';
import { part5Pages, part6Pages, part7Pages } from './pages/part5-7.mjs';
import { part8Pages, part9Pages, part10Pages } from './pages/part8-10.mjs';
import { part11Pages, part12Pages } from './pages/part11-12.mjs';
import { part13Pages, part14Pages } from './pages/part13-14.mjs';
import { appendixPages } from './pages/appendices.mjs';

export { meta };

export const pages = [
  ...frontPages,
  ...part1Pages,
  ...part2Pages,
  ...part3Pages,
  ...part4Pages,
  ...part5Pages,
  ...part6Pages,
  ...part7Pages,
  ...part8Pages,
  ...part9Pages,
  ...part10Pages,
  ...part11Pages,
  ...part12Pages,
  ...part13Pages,
  ...part14Pages,
  ...appendixPages,
];

/* -------------------------------------------------------------- rendering ---- */

function buildContentsRows(entries) {
  const rows = [];
  let currentGroup = null;

  entries.forEach((entry) => {
    if (entry.group && entry.group !== currentGroup) {
      currentGroup = entry.group;
      rows.push({ group: true, html: `<div class="toc__group">${entry.group}</div>` });
    }
    rows.push({
      group: false,
      html: html`<a class="toc__link" href="#${entry.id}"
        ><div class="toc__row">
          <span class="toc__num">${entry.number ? String(entry.number).padStart(2, '0') : '·'}</span>
          <span class="toc__title">${entry.title}<em>${entry.note}</em></span>
          <span class="toc__leader"></span>
          <span class="toc__folio">${String(entry.folio).padStart(2, '0')}</span>
        </div></a
      >`,
    });
  });

  return rows;
}

/** The contents renders as one two-column flow on a single page. */
function renderContents(rows) {
  return `<div class="toc">${rows.map((row) => row.html).join('')}</div>`;
}

export function renderPages() {
  // Pass one: folios, section numbers, and contents entries.
  const entries = [];
  const sectionNumbers = new Map();
  let sectionCounter = 0;

  pages.forEach((page, index) => {
    page.folio = index + 1;
    if (page.section) {
      const numbered = page.section.numbered !== false;
      if (numbered) {
        sectionCounter += 1;
        sectionNumbers.set(page.id, sectionCounter);
      }
      entries.push({
        ...page.section,
        id: page.id,
        number: numbered ? sectionCounter : null,
        group: page.group,
        folio: page.folio,
      });
    }
  });

  const toc = renderContents(buildContentsRows(entries));

  // Figure numbering is assigned in document order on first request.
  const figureNumbers = new Map();
  const context = {
    toc,
    figure: (key) => {
      if (!figureNumbers.has(key)) figureNumbers.set(key, figureNumbers.size + 1);
      return String(figureNumbers.get(key)).padStart(2, '0');
    },
    sectionNumber: (id) => {
      const value = sectionNumbers.get(id);
      return value ? String(value) : '';
    },
  };

  return pages
    .map((page) => {
      const runner = page.bare
        ? ''
        : html`
            <div class="runner runner--head">
              <span class="runner__mark"
                ><span class="runner__tick"></span
                ><span class="runner__section">${page.runner ?? meta.shortTitle}</span></span
              >
              <span>${meta.shortTitle} · Whitepaper ${meta.version}</span>
            </div>
            <div class="runner runner--foot">
              <span>${meta.status}</span>
              <span class="runner__folio">${String(page.folio).padStart(2, '0')}</span>
            </div>
          `;

      return `<section class="page${page.deep ? ' page--deep' : ''}" id="${page.id}">${page.render(context)}${runner}</section>`;
    })
    .join('\n');
}
