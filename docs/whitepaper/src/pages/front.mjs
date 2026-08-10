/**
 * Front matter: cover, document status, contents (two pages), and how to read.
 */

import { palette } from '../theme.mjs';
import * as fig from '../figures.mjs';
import { html, note } from '../page-kit.mjs';
import { status } from '../protocol-facts.mjs';
import { meta } from '../meta.mjs';

export const frontPages = [
  {
    id: 'cover',
    deep: true,
    bare: true,
    render: () => html`
      <div class="frame">
        <div class="cover__mark">${fig.brandMark()}</div>
        <div style="position:absolute; top:0; left:0;">
          <span class="chip">Whitepaper ${meta.version} · ${meta.date}</span>
        </div>
        <div style="position:absolute; top:96mm; left:0; right:0;">
          <h1 class="cover__title">GumBall6900</h1>
          <p class="cover__subtitle">The index fund<br />that chooses itself</p>
          <p class="cover__thesis" style="margin-top:6mm;">
            A plain-English whitepaper for a signal-directed onchain fund. Anyone can mine GBX from a fixed public
            schedule, stake it into non-transferable sGBX, and continuously direct where the fund's next dollar goes.
            Acquisitions clear against the open market. Redemption pays out real tokens, in kind. The deployed core is
            fixed: signals govern capital, code governs the rules.
          </p>
          <p class="cover__thesis" style="margin-top:5mm; color:${palette.blueBright}; font-weight:600;">
            Mine GBX. Signal acquisitions. Build shared backing. Redeem onchain.
          </p>
          <p class="cover__thesis" style="margin-top:5mm;">by Heesho</p>
        </div>
        <div style="position:absolute; bottom:24mm; left:0; right:0;">
          <div class="rule" style="background:${palette.deepRule}; margin:0 0 6mm;"></div>
          <div class="kpi-row">
            <div>
              <div class="kpi__value">1,000,000,000</div>
              <div class="kpi__label">GBX lifetime mint ceiling</div>
            </div>
            <div>
              <div class="kpi__value">98%</div>
              <div class="kpi__label">Public mining capacity</div>
            </div>
            <div>
              <div class="kpi__value">Zero</div>
              <div class="kpi__label">Team or investor allocation</div>
            </div>
            <div>
              <div class="kpi__value">Three</div>
              <div class="kpi__label">Ongoing management actions</div>
            </div>
          </div>
        </div>
        <div style="position:absolute; bottom:0; left:0; right:0; display:flex; justify-content:space-between;">
          <span class="note" style="color:${palette.onDeepMuted};">${meta.date}</span>
          <span class="note" style="color:${palette.onDeepMuted};">${meta.status}</span>
        </div>
      </div>
    `,
  },

  {
    id: 'status',
    deep: true,
    runner: 'Document status',
    render: () => html`
      <div class="frame">
        <p class="eyebrow" style="color:${palette.pinkBright};">Read this first</p>
        <h1 class="section-title">This describes reviewed code,<br />not a deployed system.</h1>
        <div class="rule" style="background:${palette.deepRule};"></div>

        <div class="spread stack-1">
          <div class="col-main">
            <p style="color:${palette.onDeep};">
              GumBall6900 is experimental software. It is <strong>not deployed</strong>, has had
              <strong>no independent external audit</strong>, and is <strong>not authorized for user funds</strong>.
              This paper explains what the production contracts do, what internal review found, and what remains
              unfinished. Nothing here is investment, legal, or tax advice, and nothing here is a promise.
            </p>
            <p style="color:${palette.onDeepMuted};">
              Every protocol number here is read from the production Solidity, recomputed at build time by independent
              models, or quoted from the internal audit record, and the build fails if a stated number disagrees with
              the tested model. Where this paper and deployed bytecode disagree, the bytecode controls. The
              claim-by-claim record lives in
              <code style="color:${palette.onDeep};">docs/whitepaper/FACT-CHECK.md</code>.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Edition',
              kind: 'capital',
              body: `${meta.version}, ${meta.date}. Supersedes v0.2. This edition describes the internally reviewed implementation rather than a target design: the contracts now match the surface this paper documents.`,
            })}
          </div>
        </div>

        <div class="stack-2">
          <p class="eyebrow" style="color:${palette.blueBright};">Document status</p>
          <div class="stack-1" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:2.8mm 10mm;">
            ${[
              ['Document version', `${meta.version} · ${meta.date}`],
              ['Author', 'Heesho'],
              ['Contracts described (commit)', status.contractsCommit],
              ['Internal-review candidate (commit)', status.auditCandidateCommit],
              [
                'Code changed after that candidate?',
                'Yes: checked increments in Fundraiser.settleEpochs and the ADR 0022 fee-harvest redesign. The finalized campaign covers the later tree; the exact final commit has no separate re-review.',
              ],
              ['Intended network', status.targetNetwork],
              ['Mainnet deployment', status.deployment],
              ['Testnet deployment', status.testnetDeployment],
              ['Security review', `${status.securityReview}. ${status.externalAudit}.`],
              ['Licensing and provenance', status.licensing],
              ['Legal review', status.legalReview],
              ['Known open finding', 'A-09, Medium: carry can reach later signal weight. Chapter 30.'],
            ]
              .map(
                ([term, value]) => html`
                  <div style="border-top:0.7pt solid ${palette.deepRule}; padding-top:2mm;">
                    <div class="kpi__label" style="color:${palette.onDeepMuted};">${term}</div>
                    <p class="note" style="margin-top:1.2mm; color:${palette.onDeep}; overflow-wrap:anywhere;">
                      ${value}
                    </p>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>

        <!-- In normal flow, not absolutely positioned: an absolute block here silently overprints
             the status grid, and the build's overflow guard cannot see an overprint. -->
        <div class="stack-1">
          <div class="rule" style="background:${palette.deepRule}; margin:4mm 0 3mm;"></div>
          <p class="note" style="color:${palette.onDeepMuted};">
            One-paragraph disclaimer: this whitepaper explains open-source smart-contract software under development. It
            offers nothing for sale, promises no profit, guarantees no outcome, and omits any number it could not
            verify. Participation in any future deployment would carry real risks, described honestly in Part XI, and
            should never be based on this document alone.
          </p>
        </div>
      </div>
    `,
  },

  {
    id: 'contents',
    runner: 'Contents',
    render: (context) => html`
      <div class="frame">
        <header class="full">
          <p class="eyebrow">How this paper is arranged</p>
          <h1 class="section-title">Contents</h1>
          <div class="rule" style="margin: 4mm 0;"></div>
        </header>
        ${context.toc}
      </div>
    `,
  },

  {
    id: 'how-to-read',
    runner: 'How to read this paper',
    section: { title: 'How to read this paper', note: 'Three paths, one color grammar', numbered: false },
    group: 'Orientation',
    render: () => html`
      <div class="frame">
        <header class="full">
          <p class="eyebrow">Orientation</p>
          <h1 class="section-title">How to read this paper</h1>
          <p class="deck">
            This is a long document because it is honest about details. You do not need all of it to get value from it.
          </p>
          <div class="rule"></div>
        </header>
        <div class="spread">
          <div class="col-main">
            <p>
              <strong>If you have five minutes,</strong> read the two-page executive summary and the one-page figure
              that follows it. <strong>If you are deciding whether to participate someday,</strong> add Part II (what
              the tokens are), Part XI (security and trust), and the safety checklists in Part XII.
              <strong>If you are a developer or reviewer,</strong> the mechanism chapters in Parts III to X follow the
              contracts closely, and the appendices give the exact formulas, the access-control matrix, and the recorded
              test evidence.
            </p>
            <p>
              Every major concept is introduced the same way: a plain sentence first, an everyday comparison, what the
              contracts enforce, and what they cannot guarantee. Technical detail sits in clearly marked
              <em>Under the hood</em> passages you can skip without losing the thread. Terms are defined before they are
              used; the glossary in the appendices collects them all.
            </p>
            <p>
              One continuous worked example runs through the paper. Maya mines and signals, Elena signals, Noor fills
              auctions, and Leo redeems. All four are fictional, every asset in the example is illustrative, and every
              number in it is computed by the same arithmetic the contracts apply - never typed in by hand.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Color is not decoration',
              kind: 'capital',
              body: 'Every figure uses one grammar. Blue is USDG capital arriving. Pink is the holder-directed chain: signal, the acquisition it causes, and optional rewards. Graphite is GBX supply and burns.',
            })}
            ${note({
              label: 'Where the numbers come from',
              body: 'Charts are computed at build time from the same emission, auction, stream, and redemption rules the repository tests in TypeScript and Python. A stated number that drifts from the tested model fails the build.',
            })}
          </div>
        </div>
        <div class="stack-2">${fig.legendStrip({})}</div>
        <div class="stack-3 tint">
          <h3>The recurring callouts</h3>
          <p class="small muted" style="margin:0;">
            <strong>In one sentence</strong> compresses a chapter. <strong>Why this matters</strong> connects a rule to
            its consequence. <strong>What the contract enforces</strong> and
            <strong>what this does not guarantee</strong> keep promises separate from hopes.
            <strong>Under the hood</strong> is optional depth. <strong>Important risk</strong> is never optional. Role
            notes - for miners, signalers, buyers, claimants, redeemers, and callers - flag what each reader should take
            away.
          </p>
        </div>
      </div>
    `,
  },
];
