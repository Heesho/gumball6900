/**
 * The sheet itself: five bands, assembled top to bottom.
 *
 * Reading order is the teaching order. A reader is told what the product is, watches one
 * person use it from beginning to end, sees who else is involved and why, and only then
 * reaches the argument about crypto rails - which is supporting evidence for the story
 * above it, not the story. Limits and status close the page.
 *
 * The vertical budget is roughly 70% product, 20% rails, 10% status, and the band heights
 * in `styles.mjs` are what enforce that split.
 */

import { brandmark } from '../../../whitepaper/src/brand-asset.mjs';
import { hero, reasons, rules, signal, status, story } from './copy.mjs';
// Still read, but only for the PDF's Info dictionary: the sheet records which contracts it
// describes without spending a line of the page on it.
import { commits } from './facts.mjs';
import * as fig from './figures.mjs';

const html = (strings, ...values) => strings.reduce((out, part, i) => out + part + (values[i] ?? ''), '');

/** A band wrapper. `chrome` selects the full-bleed surface: deep, accent, tint, or paper. */
function band(name, body, chrome = '') {
  return html`
    <section class="band band--${name} ${chrome}" data-band="${name}">
      <div class="band__rail">${body}</div>
    </section>
  `;
}

/* -------------------------------------------------------------------- hero ---- */

/**
 * The identity block pairs the brandmark with the wordmark.
 *
 * History: this band was wordmark-only for a long stretch. `brandMark()` from the
 * whitepaper's figure library was deleted by ADR 0024's rewrite, and it was left out
 * afterwards on the reasoning that the name and the ball device derive from an existing
 * brand whose usage rights are unresolved, so a sheet not cleared for distribution should
 * not be what propagates the asset.
 *
 * That reasoning was overridden by an explicit owner decision on 2026-08-16, taken with
 * the provenance state stated: `canonical-logo-provenance-policy.json` is still
 * `unconfigured`, and `docs/LEGAL-PROVENANCE-BLOCKER.md` still gates distribution. The
 * mark now appears on both this sheet and the whitepaper cover. Embedding it is a
 * presentation decision and remains no evidence whatsoever that rights are cleared.
 */
function heroBand() {
  const chip = (entry) => html`
    <div class="chip">
      <span class="chip__label">${entry.label}</span>
      <p class="chip__body chk">${entry.body}</p>
    </div>
  `;

  return band(
    'hero',
    html`
      <div class="hero">
        <div class="hero__identity">
          ${brandmark('14mm', 'brandmark--sheet')}
          <div>
            <p class="hero__wordmark">${hero.wordmark}</p>
            <p class="hero__tagline">${hero.tagline}</p>
          </div>
        </div>
        <div class="hero__rule"></div>
        <div class="hero__say">
          <p class="eyebrow">${hero.question}</p>
          <h1 class="hero__definition chk">${hero.definition}</h1>
        </div>
      </div>
      <div class="hero__chips box">${hero.chips.map(chip).join('')}</div>
    `,
    'band--deep',
  );
}

/* ------------------------------------------------------------------- story ---- */

function storyBand() {
  const stage = (entry) => html`
    <div class="stage">
      <div class="stage__badge">
        <span class="stage__n">${entry.n}</span>
        <span class="stage__verb">${entry.verb}</span>
      </div>
      <p class="stage__body chk">${entry.body}</p>
      <p class="stage__tech tech">${entry.tech}</p>
    </div>
  `;

  const joint = html`<div class="stage__joint">${fig.stepArrow()}</div>`;

  return band(
    'story',
    html`
      <div class="story">
        <div class="story__top">
          <div>
            <h2 class="section-head">${story.title}</h2>
            <p class="story__setup chk">${story.setup}</p>
          </div>
          <p class="story__disclaimer chk">${story.disclaimer}</p>
        </div>

        <div class="story__stages box">${story.stages.map(stage).join(joint)}</div>
      </div>
    `,
  );
}

/* ------------------------------------------------------------------- rules ---- */

function rulesBand() {
  const rule = (entry) => html`
    <div class="rule ${entry.tone === 'note' ? 'rule--note' : ''}">
      <span class="rule__label">${entry.label}</span>
      <p class="rule__body chk">${entry.body}</p>
    </div>
  `;

  const reason = (entry) => html`
    <div class="reason">
      <div class="reason__value">${entry.value}</div>
      <div class="reason__label chk">${entry.label}</div>
    </div>
  `;

  return band(
    'rules',
    html`
      <div class="rules">
        <h2 class="section-head">${rules.title}</h2>
        <div class="rules__list box">${rules.items.map(rule).join('')}</div>
        <div class="reasons box">
          <span class="reasons__label">${reasons.label}</span>
          <div class="reasons__row">${reasons.items.map(reason).join('')}</div>
        </div>
      </div>
    `,
  );
}

/* ------------------------------------------------------------------ signal ---- */

/**
 * One section, two rows, one causal chain: this round's pooled signal on top, and what a
 * run of those rounds accumulates into underneath.
 */
function signalBand() {
  const segment = (seg, index) => html`
    <div class="signal__seg signal__seg--${index}" style="flex: ${seg.share}">
      <span class="signal__token chk">${seg.token}</span>
      <span class="signal__share">${seg.share}%</span>
    </div>
  `;

  return band(
    'signal',
    html`
      <div class="signal">
        <div class="signal__top">
          <h2 class="section-head">${signal.title}</h2>
          <p class="signal__lead chk">${signal.lead}</p>
        </div>

        <div class="signal__row">
          <span class="signal__rowlabel">${signal.splitLabel}</span>
          <div class="signal__rowbody">
            <div class="signal__bar">${signal.segments.map(segment).join('')}</div>
            <p class="signal__note chk">${signal.splitNote}</p>
          </div>
        </div>

        <div class="signal__row signal__row--basket">
          <span class="signal__rowlabel">${signal.basketLabel}</span>
          <div class="signal__chart">${fig.basketFormation({ rounds: signal.rounds })}</div>
          <div class="signal__aside">
            <p class="signal__caption chk">${signal.basketCaption}</p>
            <div class="signal__legend">
              ${signal.legend
                .map(
                  (token, index) => html`
                    <span class="signal__key"><i class="signal__swatch signal__swatch--${index}"></i>${token}</span>
                  `,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `,
  );
}

/* -------------------------------------------------------------------- note ---- */

function noteBand() {
  return band(
    'note',
    html`
      <div class="note">
        <span class="note__status chk">${status.note}</span>
        <span class="note__more chk">${status.more}</span>
      </div>
    `,
  );
}

export function renderPage() {
  return html`
    <div class="page" id="one-pager">
      <div class="frame">${heroBand()} ${storyBand()} ${signalBand()} ${rulesBand()} ${noteBand()}</div>
    </div>
  `;
}

export const meta = {
  title: 'GumBall6900: The Index Fund That Chooses Itself - one-page explainer',
  author: 'Heesho',
  subject:
    'A one-page, plain-English explainer for GumBall6900: an index fund whose holders decide what goes in it. ' +
    'Miners pay a dollar-denominated token for continuously reselling mining slots, which is how new GBX is ' +
    'issued and how the fund is supplied; GBX holders deposit into signals that direct which tokenized assets the fund acquires ' +
    'next, and burn GBX to redeem a selected in-kind share of an ownerless treasury. Written for a reader with ' +
    'no crypto background.',
  keywords: [
    'GumBall6900',
    'GBX',
    'index fund',
    'tokenized equities',
    'in-kind redemption',
    'holder-directed capital',
    'governance minimization',
    'one-pager',
    `contracts commit ${commits.contractsShort}`,
    `review candidate ${commits.auditCandidateShort}`,
  ],
  contractsCommit: commits.contracts,
  auditCandidateCommit: commits.auditCandidate,
};
