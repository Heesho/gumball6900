/**
 * Shared page primitives for the whitepaper.
 *
 * Every part module builds its pages from these helpers so the document keeps one voice:
 * the same section head, the same side notes, the same figure, formula, and table blocks.
 * Layout rules live in `styles.mjs`; this file only assembles markup.
 */

export const html = (strings, ...values) =>
  strings.reduce((out, part, index) => out + part + (values[index] ?? ''), '');

export function sectionHead({ eyebrow, number, title, deck }) {
  return html`
    <header class="full">
      <p class="eyebrow">${eyebrow}</p>
      <h1 class="section-title">${number ? `<span class="numeral">${number}</span>` : ''}${title}</h1>
      ${deck ? `<p class="deck">${deck}</p>` : ''}
      <div class="rule"></div>
    </header>
  `;
}

/**
 * Side note. `kind` selects the label colour: 'signal' (pink), 'capital' (blue),
 * 'asset' (pink), 'supply' (graphite). The recurring editorial callouts - "In one
 * sentence", "Why this matters", "What the contract enforces", "What this does not
 * guarantee", "Under the hood", "Important risk", and the per-role "For ..." notes -
 * are all rendered through this device.
 */
export function note({ label, body, kind = 'signal' }) {
  return html`
    <div class="note note--${kind}">
      <span class="note__label">${label}</span>
      ${body}
    </div>
  `;
}

export function figureBlock({ index, svg, caption, className = 'full' }) {
  return html`
    <figure class="figure ${className}">
      ${svg}
      ${caption
        ? `<figcaption class="figcaption"><span class="figcaption__index">Fig. ${index}</span><span>${caption}</span></figcaption>`
        : ''}
    </figure>
  `;
}

export function formula({ label, body, where }) {
  return html`
    <p class="formula">
      <span class="formula__label">${label}</span>${body} ${where ? `<span class="formula__where">${where}</span>` : ''}
    </p>
  `;
}

export function table({ head, rows, className = '' }) {
  return html`
    <table class="table ${className}">
      ${head ? `<thead><tr>${head.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>` : ''}
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row.map((cell, index) => `<td${index === 0 ? ' class="table__key"' : ''}>${cell}</td>`).join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

/** Two-column yes/no ledger used for guarantees-vs-limits spreads. */
export function ledger({ yesHead, yesItems, noHead, noItems }) {
  const item = (entry) => `<li><span class="muted">${entry}</span></li>`;
  return html`
    <div class="ledger">
      <div class="ledger__side">
        <div class="ledger__head ledger__head--yes">${yesHead}</div>
        <ul class="checklist capital">
          ${yesItems.map(item).join('')}
        </ul>
      </div>
      <div class="ledger__side">
        <div class="ledger__head ledger__head--no">${noHead}</div>
        <ul class="checklist signal">
          ${noItems.map(item).join('')}
        </ul>
      </div>
    </div>
  `;
}

/** Numbered walkthrough list. */
export function steps(items) {
  return html`<ol class="numbered">
    ${items.map((entry) => `<li>${entry}</li>`).join('')}
  </ol>`;
}

/** Question-and-answer block for the FAQ pages. */
export function qa(entries) {
  return entries
    .map(
      (entry) => html`
        <div class="qa">
          <p class="qa__q">${entry.q}</p>
          <p class="qa__a">${entry.a}</p>
        </div>
      `,
    )
    .join('');
}

/** Compact definition rows for glossary-style pages. */
export function defs(entries, className = 'table--tight') {
  return table({ rows: entries, className });
}
