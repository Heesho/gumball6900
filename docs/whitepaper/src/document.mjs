import { html } from './page-kit.mjs';
import { meta } from './meta.mjs';
import { currentPages } from './pages/current.mjs';

export { meta };

export const pages = currentPages;

function contents(entries) {
  return `<div class="toc">${entries
    .map(
      (entry) =>
        html`<a class="toc__link" href="#${entry.id}"
          ><div class="toc__row">
            <span class="toc__num">${String(entry.number).padStart(2, '0')}</span>
            <span class="toc__title">${entry.title}<em>${entry.note}</em></span>
            <span class="toc__leader"></span><span class="toc__folio">${String(entry.folio).padStart(2, '0')}</span>
          </div></a
        >`,
    )
    .join('')}</div>`;
}

export function renderPages() {
  const entries = [];
  let number = 0;
  pages.forEach((page, index) => {
    page.folio = index + 1;
    if (page.section) entries.push({ ...page.section, id: page.id, folio: page.folio, number: ++number });
  });
  const context = { toc: contents(entries) };

  return pages
    .map((page) => {
      const runner = page.bare
        ? ''
        : html`<div class="runner runner--head">
              <span class="runner__mark"
                ><span class="runner__tick"></span
                ><span class="runner__section">${page.runner ?? meta.shortTitle}</span></span
              ><span>${meta.shortTitle} · Whitepaper ${meta.version}</span>
            </div>
            <div class="runner runner--foot">
              <span>${meta.status}</span><span class="runner__folio">${String(page.folio).padStart(2, '0')}</span>
            </div>`;
      return `<section class="page${page.deep ? ' page--deep' : ''}" id="${page.id}">${page.render(context)}${runner}</section>`;
    })
    .join('\n');
}
