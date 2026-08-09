/**
 * The whitepaper itself: page order, layout and prose.
 *
 * Pages are declared in order and rendered in two passes, so folios and the contents page
 * are computed rather than transcribed. Prose here is the presentation source; the
 * canonical text is `docs/WHITEPAPER.md`, and the reviewed contracts remain the technical
 * source of truth for both.
 */

import { legend, palette } from './theme.mjs';
import * as fig from './figures.mjs';
import { widths } from './svg.mjs';
import { constants, formatWad, initialEmission } from './model.mjs';

/** Constants quoted in prose are read from the model, never transcribed. */
const facts = {
  initialEmission: formatWad(initialEmission, 18),
  dailyDecay: formatWad(constants.dailyDecayWad, 18),
  miningAllocation: formatWad(constants.miningAllocation, 0),
};

export const meta = {
  title: 'GumBall6900: A Signal-Directed Onchain Fund',
  shortTitle: 'GumBall6900',
  subject:
    'Whitepaper covering fair-launched GBX mining, continuous sGBX signaling, oracleless acquisitions, in-kind redemption, and a governance-minimized core',
  version: 'v0.2',
  date: 'August 2026',
  status: 'Pre-audit · not deployed · not authorized for user funds',
  keywords: [
    'GumBall6900',
    'GBX',
    'sGBX',
    'SignalGBX',
    'onchain fund',
    'reverse Dutch auction',
    'fair launch',
    'mining economics',
    'in-kind redemption',
    'governance minimization',
  ],
};

/* ------------------------------------------------------------- primitives ---- */

const html = (strings, ...values) => strings.reduce((out, part, index) => out + part + (values[index] ?? ''), '');

function sectionHead({ eyebrow, number, title, deck }) {
  return html`
    <header class="full">
      <p class="eyebrow">${eyebrow}</p>
      <h1 class="section-title">${number ? `<span class="numeral">${number}</span>` : ''}${title}</h1>
      ${deck ? `<p class="deck">${deck}</p>` : ''}
      <div class="rule"></div>
    </header>
  `;
}

function note({ label, body, kind = 'signal' }) {
  return html`
    <div class="note note--${kind}">
      <span class="note__label">${label}</span>
      ${body}
    </div>
  `;
}

function figureBlock({ index, svg, caption, className = 'full' }) {
  return html`
    <figure class="figure ${className}">
      ${svg}
      ${caption
        ? `<figcaption class="figcaption"><span class="figcaption__index">Fig. ${index}</span><span>${caption}</span></figcaption>`
        : ''}
    </figure>
  `;
}

function formula({ label, body, where }) {
  return html`
    <p class="formula">
      <span class="formula__label">${label}</span>${body} ${where ? `<span class="formula__where">${where}</span>` : ''}
    </p>
  `;
}

function table({ head, rows, className = '' }) {
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

/* ------------------------------------------------------------------ pages ---- */

/**
 * Each entry declares its running-header section and its body. `section` marks a page that
 * belongs in the contents; `group` opens a new contents grouping.
 */
export const pages = [
  {
    id: 'cover',
    deep: true,
    bare: true,
    render: () => html`
      <div class="frame">
        <div class="cover__mark">${fig.brandMark()}</div>
        <div style="position:absolute; top:0; left:0;">
          <span class="chip">Whitepaper ${meta.version} · target final design</span>
        </div>
        <div style="position:absolute; top:104mm; left:0; right:0;">
          <h1 class="cover__title">GumBall6900</h1>
          <p class="cover__subtitle">A signal-directed<br />onchain fund</p>
          <p class="cover__thesis">
            Holders mine GBX from a fixed public schedule, stake it into non-transferable sGBX, and continuously direct
            where the fund's next dollar goes. Acquisitions clear against the open market. Redemption pays out real
            tokens, in kind. The deployed core is fixed: signals govern capital, code governs the rules.
          </p>
        </div>
        <div style="position:absolute; bottom:26mm; left:0; right:0;">
          <div class="rule" style="background:${palette.deepRule}; margin:0 0 6mm;"></div>
          <div class="kpi-row">
            <div>
              <div class="kpi__value">1,000,000,000</div>
              <div class="kpi__label">GBX lifetime ceiling</div>
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
              <div class="kpi__value">Five</div>
              <div class="kpi__label">Management actions</div>
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
    runner: 'Status and how to read',
    render: () => html`
      <div class="frame">
        <p class="eyebrow" style="color:${palette.pinkBright};">Read this first</p>
        <h1 class="section-title">This describes a design,<br />not a deployed system.</h1>
        <div class="rule" style="background:${palette.deepRule};"></div>

        <div class="spread stack-1">
          <div class="col-main">
            <p style="color:${palette.onDeep};">
              GumBall6900 is an experimental, pre-audit protocol design. It is not deployed, not audited, and not
              authorized for user funds. Nothing here is investment, legal, or tax advice.
            </p>
            <p style="color:${palette.onDeepMuted};">
              This paper specifies the intended governance-minimized final system. The contracts currently in the
              repository still expose a broader administrative surface than the design described here, and that gap must
              be closed and independently reviewed before any deployment. Where this paper and deployed bytecode ever
              disagree, the bytecode controls behaviour.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Version',
              kind: 'capital',
              body: `${meta.version}, ${meta.date}. Supersedes v0.1. Figures are generated from the same economic model the repository tests.`,
            })}
          </div>
        </div>

        <div class="stack-3">
          <p class="eyebrow" style="color:${palette.blueBright};">Colour is not decoration</p>
          <p class="note" style="color:${palette.onDeepMuted}; max-width:150mm;">
            Every figure uses the same grammar. A line's colour tells you what is moving — and pink traces the whole
            holder-directed chain, from the signal through the acquisition it causes and any independently funded
            reward.
          </p>
          <div class="stack-1">${fig.legendStrip({ onDark: true })}</div>
        </div>

        <div class="stack-3">
          <p class="eyebrow" style="color:${palette.blueBright};">Three ways through</p>
          <div class="kpi-row stack-1">
            <div>
              <div class="kpi__value" style="font-size:11pt; letter-spacing:-0.01em;">The mechanism</div>
              <p class="note" style="margin-top:2mm; color:${palette.onDeepMuted};">
                Read the figure on the next page, then sections 3 to 12.
              </p>
            </div>
            <div>
              <div class="kpi__value" style="font-size:11pt; letter-spacing:-0.01em;">The economics</div>
              <p class="note" style="margin-top:2mm; color:${palette.onDeepMuted};">
                Sections 5, 6 and 13, then the worked example in section 14.
              </p>
            </div>
            <div>
              <div class="kpi__value" style="font-size:11pt; letter-spacing:-0.01em;">What can go wrong</div>
              <p class="note" style="margin-top:2mm; color:${palette.onDeepMuted};">
                Sections 16 to 18 state what must hold, what can fail, and what is unfinished.
              </p>
            </div>
          </div>
        </div>

        <div class="stack-3">
          <p class="eyebrow" style="color:${palette.blueBright};">Fixed by construction</p>
          <p class="note" style="color:${palette.onDeepMuted}; max-width:150mm;">
            Set before deployment. Ongoing management can add or kill Strategies and register bounded Bribe rewards.
          </p>
          <div class="stack-1" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5mm 8mm;">
            ${[
              ['1,000,000,000 GBX', 'Cumulative lifetime mint ceiling'],
              ['20,000,000 GBX', 'Genesis liquidity, committed'],
              ['0 GBX', 'Team, investor and presale allocation'],
              [`${constants.halfLifeDays.toLocaleString()} days`, 'Emission half-life'],
              ['100%', 'Every Strategy payment is Fund-bound'],
              ['None', 'Withdrawal lock, cooldown or epoch'],
            ]
              .map(
                ([value, caption]) => html`
                  <div style="border-top:0.7pt solid ${palette.deepRule}; padding-top:2.4mm;">
                    <div
                      class="sans"
                      style="font-size:10.6pt; font-weight:600; letter-spacing:-0.018em; color:${palette.onDeep};"
                    >
                      ${value}
                    </div>
                    <div class="note" style="margin-top:1mm; color:${palette.onDeepMuted};">${caption}</div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'contents',
    runner: 'Contents',
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'How this paper is arranged',
          title: 'Contents',
          deck: 'The design first, then the economics, then an honest account of the risks and the unfinished work.',
        })}
        <div class="spread">
          <div class="col-main">${context.toc}</div>
          <div class="col-side">
            ${note({
              label: 'Where the numbers come from',
              kind: 'capital',
              body: 'Every chart is computed at build time from the emission, auction and redemption rules in <code>packages/simulations</code>, so a figure cannot drift away from the model the repository tests.',
            })}
            ${note({
              label: 'Naming',
              body: 'Contract names are capitalised — Fundraiser, Resonance, Strategy, Bribe, Fund. Tokens are set in their tickers: GBX, sGBX, USDG.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'map',
    runner: 'The protocol in one figure',
    group: 'Orientation',
    section: { title: 'The protocol in one figure', note: 'Every flow on a single page' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Orientation',
          title: 'The protocol in one figure',
          deck: 'Three kinds of value move through GumBall6900. This is all of them, and every place they can end up.',
        })}
        ${figureBlock({
          index: context.figure('map'),
          svg: fig.systemMap({ width: widths.full }),
          caption:
            'Contribution revenue has exactly one entrance and follows live signal weight to a Strategy. Acquisitions divide between shared backing and the signalers who directed them, 90/10 at launch. Redemption and burning are the only exits, and burned capacity never reopens.',
        })}
      </div>
    `,
  },

  {
    id: 'problem',
    runner: '1 · The problem',
    group: 'The design',
    section: { number: 1, title: 'The problem', note: 'Where basket formation happens' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'From index product to index formation',
          number: '1',
          title: 'The problem',
          deck: 'Onchain funds can move a basket onchain while leaving the decision of what belongs in it somewhere else entirely.',
        })}
        <div class="spread">
          <div class="col-main">
            <p class="lede">
              A traditional fund makes a basket easier to own. It does not make the basket easier to influence.
              Membership, weighting and rebalancing are decided upstream by a methodology or a committee, and the
              investor receives a finished result. Many onchain index products preserve exactly this shape: the token is
              onchain, but formation of the basket remains a separate, off-chain process.
            </p>
            <p>
              GumBall6900 starts from a narrower question. Instead of asking who should decide the portfolio, it asks
              who should decide the <em>next purchase</em>.
            </p>
            <div class="pull stack-1">What if holders continuously directed where the fund's next dollar went?</div>
            <p class="stack-2">
              That change moves the unit of coordination. Holders never approve a complete target portfolio, and there
              is no proposal to pass or reject. They hold live weight across the eligible acquisition paths, and every
              new unit of protocol revenue follows whatever distribution exists at the moment it is routed.
            </p>
            <p>
              The consequence runs through the whole design: the Fund is a record of past acquisitions, while signals
              are a statement of present preference. Changing a signal changes what happens next. It does not sell what
              the protocol already holds.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'The distinction to keep',
              body: '<strong>GBX</strong> is a claim on what the Fund already owns. <strong>sGBX</strong> directs what it may acquire next. They are deliberately different instruments.',
            })}
            ${note({
              label: 'No forced selling',
              kind: 'asset',
              body: 'Because signals steer inflow rather than holdings, a swing in sentiment cannot force the Fund to liquidate. Section 13 shows what that means for composition over time.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('problem'),
            svg: fig.problemContrast({ width: widths.full }),
            caption:
              'The same three decisions, relocated. Nothing about the second column requires a vote, a season, or a quorum.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'goals',
    runner: '2 · Design goals',
    section: { number: 2, title: 'Design goals', note: 'And what is explicitly not promised' },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'What the system is trying to preserve',
          number: '2',
          title: 'Design goals',
          deck: 'Six commitments shape the design. Each one costs something, and the cost is stated alongside it.',
        })}
        <div class="spread">
          <div class="col-main">
            ${table({
              head: ['Goal', 'What it means in practice'],
              rows: [
                [
                  'Fair public distribution',
                  'GBX is mined through the Fundraiser. There is no team, founder, investor, presale or advisor allocation; the separate 20M genesis tranche is committed to canonical liquidity.',
                ],
                [
                  'Continuous direction',
                  'Absolute per-Strategy sGBX amounts may be increased or decreased at any time. No voting season, allocation epoch or signal cooldown; unallocated sGBX is immediately withdrawable.',
                ],
                [
                  'Real assets',
                  'The Fund holds raw tokens and redemption transfers them in kind, so the core never needs a protocol-wide net asset value oracle.',
                ],
                [
                  'Market-based acquisition',
                  'Reverse Dutch auctions let external participants decide when a price is acceptable, rather than the protocol asserting one.',
                ],
                [
                  'Governance minimization',
                  'Signals govern capital. Resonance holds four explicitly authorized actions, each bounded, and the deployed core cannot be upgraded.',
                ],
                [
                  'Inspectability',
                  'Each contract has a narrow responsibility, so money flow and failure boundaries stay legible to a reader who is not the author.',
                ],
              ],
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'The cost of each',
              kind: 'asset',
              body: 'Fair distribution means no funded runway. Continuous direction means no deliberation. Immutability means no fix. These are trades, not free wins.',
            })}
          </div>
        </div>

        <div class="stack-3">
          <h2>Non-goals</h2>
          <div class="ledger stack-1">
            <div class="ledger__side">
              <div class="ledger__head ledger__head--no">The protocol does not promise</div>
              <ul class="checklist signal">
                <li><span class="muted">A stable or rising GBX price.</span></li>
                <li><span class="muted">A fixed portfolio composition or automatic rebalancing.</span></li>
                <li><span class="muted">That any auction will clear, or clear well.</span></li>
                <li><span class="muted">That signaling earns a reward.</span></li>
                <li><span class="muted">Protection from the risks of assets the Fund receives.</span></li>
              </ul>
            </div>
            <div class="ledger__side">
              <div class="ledger__head ledger__head--yes">The contracts do fix</div>
              <ul class="checklist capital">
                <li><span class="muted">That every contributed USDG enters the signal-directed path.</span></li>
                <li><span class="muted">That miners compete for a schedule, not a team-set price.</span></li>
                <li><span class="muted">That every completed Strategy payment is owed entirely to Fund.</span></li>
                <li><span class="muted">That burning never reopens mint capacity.</span></li>
                <li><span class="muted">That redemption cannot be paused.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'loop',
    runner: '3 · The economic loop',
    section: { number: 3, title: 'The economic loop', note: 'Five moves, repeated' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'The holder-facing view',
          number: '3',
          title: 'The economic loop',
          deck: 'The contract system has many boundaries. The loop a holder actually participates in has five moves.',
        })}
        ${figureBlock({
          index: context.figure('loop'),
          svg: fig.economicLoop({ width: widths.full }),
          caption:
            'The loop has no start state to wait for and no round to synchronise with. Mining, signaling, routing, acquiring and redeeming all proceed independently and continuously.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Revenue takes one path. A contribution reaches the Fundraiser, is forwarded to the single revenue entrance
              at <span class="term">ResonanceRouter</span>, and arrives at <span class="term">Resonance</span>, which
              distributes it among active Strategies in proportion to current sGBX weight.
            </p>
            <p>
              The routing layer never forms an opinion. It does not price assets, rank Strategies, or hold a view about
              what deserves capital. It reads the live signal distribution and applies it to whatever arrived.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'One entrance',
              kind: 'capital',
              body: 'Fundraiser contributions are the only USDG revenue entering this router. Liquidity-position fees belong entirely to the permissionless compounding incentive.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          No proposal season. No signaling epoch. No withdrawal lock on unallocated sGBX.
          <em>Every distribution re-reads the signal that exists at that moment.</em>
        </p>
      </div>
    `,
  },

  {
    id: 'components',
    runner: '4 · Protocol components',
    section: { number: 4, title: 'Protocol components', note: 'Six concepts, twelve contracts' },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Six concepts carry the economics',
          number: '4',
          title: 'Protocol components',
          deck: 'Implementation detail stays behind narrow contract boundaries. A holder can reason about the protocol through six pieces.',
        })}
        <div class="spread">
          <div class="col-main">
            ${table({
              head: ['Piece', 'Role'],
              rows: [
                ['USDG', 'The stable asset contributed by miners and routed toward acquisitions.'],
                [
                  'GBX',
                  'The transferable protocol token, capped at one billion cumulative mints, redeemable against Fund assets.',
                ],
                [
                  'sGBX',
                  'Non-transferable staked GBX. It measures an account&rsquo;s live signal weight and nothing else.',
                ],
                ['Strategy', 'An eligible USDG destination whose auction accepts one configured payment asset.'],
                [
                  'Resonance',
                  'The allocation engine that distributes newly received USDG according to current signals.',
                ],
                [
                  'Fund',
                  'The permissionless raw-token treasury that holds acquired assets and pays in-kind redemptions.',
                ],
              ],
            })}
            <p class="stack-2">
              Those six pieces are carried by twelve direct, non-upgradeable contracts. The extra names exist to keep
              each responsibility narrow enough to review in isolation; none of them adds a decision.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why sGBX cannot move',
              body: 'Non-transferability keeps signal weight attached to someone who is exposed to the outcome. A transferable signal token would become a market in influence, rentable by anyone with no position in the Fund.',
            })}
            ${note({
              label: 'Why the Fund is not a registry',
              kind: 'asset',
              body: 'The Fund accepts any ERC-20. Membership of the protocol is expressed by active Strategies, not by a curated list inside the treasury. Section 11 covers what that admits.',
            })}
          </div>
        </div>

        <div class="full stack-2">
          <h3>The twelve contracts, grouped by what they are for</h3>
          <div class="stack-1" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4mm 6mm;">
            ${[
              ['Tokens', ['GBX', 'SignalGBX'], palette.graphite],
              ['Distribution', ['Fundraiser', 'LiquidityPosition'], palette.blue],
              ['Routing', ['ResonanceRouter', 'Resonance', 'StrategyFactory', 'BribeFactory'], palette.blue],
              ['Acquisition and optional rewards', ['Strategy', 'BribeRouter', 'Bribe', 'Fund'], palette.pink],
            ]
              .map(
                ([group, names, accent]) => html`
                  <div style="border-top:0.9pt solid ${accent}; padding-top:2.2mm;">
                    <div
                      class="sans"
                      style="font-size:6.8pt; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:${accent};"
                    >
                      ${group}
                    </div>
                    <div style="margin-top:2mm;">
                      ${names
                        .map((name) => `<div class="mono" style="font-size:7.6pt; line-height:12pt;">${name}</div>`)
                        .join('')}
                    </div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'supply',
    runner: '5 · GBX mining and supply',
    group: 'The economics',
    section: { number: 5, title: 'GBX mining and supply', note: 'A schedule that sums to its own cap' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Fair launch through the Fundraiser',
          number: '5',
          title: 'GBX mining and supply',
          deck: 'Mining here means contributing USDG through the public Fundraiser and receiving that period&rsquo;s scheduled GBX. It is not proof-of-work.',
        })}
        ${fig.supplySplit({ width: widths.full })}
        <div class="spread stack-1">
          <div class="col-main">
            <p>
              Contributions within a day share that day's emission in proportion to their size. An empty day forfeits
              its scheduled emission entirely; nothing carries forward. The schedule's two constants are not
              independent: the daily decay is the 1,460-day half-life factor, and the opening emission is derived from
              it so the schedule pays out its own allocation and no more.
            </p>
            ${formula({
              label: 'The schedule funds itself exactly',
              body: 'E₀ = A × (1 − d),&nbsp;&nbsp;so&nbsp;&nbsp;∑<sub>t≥0</sub> E₀·d<sup>t</sup> = E₀ / (1 − d) = A',
              where: `A = ${facts.miningAllocation} GBX mining allocation · d = ${facts.dailyDecay} · E₀ = ${facts.initialEmission} GBX. Summing the entire infinite schedule returns the allocation exactly, so the cap is a property of the arithmetic rather than a separate check.`,
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'Burning is one-way',
              kind: 'supply',
              body: 'Burning GBX never restores mint capacity. Cumulative minting can never exceed one billion even if every previously minted token has since been destroyed.',
            })}
            ${note({
              label: 'Forfeiture is real',
              body: 'A day with no contributions emits nothing, and that emission is gone. The schedule advances on wall-clock time, not on activity.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('emissions'),
            svg: fig.emissionChart({ width: widths.full }),
            caption:
              'Each four-year period closes half the remaining distance to the allocation: 50% by year four, 75% by year eight, 93.75% by year sixteen. The daily emission never reaches zero and the total never exceeds 980M.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'mining-market',
    runner: '6 · The mining market',
    section: { number: 6, title: 'The mining market', note: 'What competition prices, and what it cannot' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Why a liquid GBX price pulls capital in',
          number: '6',
          title: 'The mining market',
          deck: 'The Fundraiser never sells GBX at a price. It hands a fixed daily quantity to whoever showed up, in proportion to what they brought.',
        })}
        <div class="spread">
          <div class="col-main">
            ${formula({
              label: 'Pro-rata daily mining',
              body: 'GBXᵢ = floor(Eₜ × cᵢ / Cₜ)',
              where:
                'Eₜ = GBX emitted on day t · cᵢ = miner i&rsquo;s USDG contribution · Cₜ = all USDG contributed that day.',
            })}
            <p class="stack-1">
              Because the numerator is fixed, the average cost a day's miners pay is simply
              <span class="mono">Cₜ / Eₜ</span> — it depends only on how much total USDG competed, never on who
              contributed it. If GBX trades at <span class="mono">Pₜ</span>, the day's emission is worth
              <span class="mono">Pₜ × Eₜ</span>, and entry is attractive while contributions sit below that. Entry then
              closes the gap, which gives a rough break-even benchmark of <span class="mono">Cₜ ≈ Pₜ × Eₜ</span>. The
              adjustment runs both ways: a thin day is precisely the day worth entering.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Read the chart this way',
              kind: 'capital',
              body: 'The rising line is what miners pay on average. The dashed line is what GBX is worth. The wedge between them is the margin that attracts the next miner — and closes as they arrive.',
            })}
          </div>
        </div>
        <div class="stack-1">
          ${figureBlock({
            index: context.figure('mining'),
            svg: fig.miningMarketChart({ width: widths.full }),
            caption:
              'An illustrative day: E = 100,000 GBX emitted, P = 0.50 USDG. At 20,000 USDG contributed the average cost is 0.20 per GBX; competition pushes toward 50,000 USDG, where the simple spot-price margin is gone. Entering below the dashed line is profitable only before gas, slippage and risk.',
          })}
        </div>
        <div class="ledger stack-1">
          <div class="ledger__side">
            <div class="ledger__head ledger__head--yes">What the contracts guarantee</div>
            <ul class="checklist capital">
              <li>
                <span class="muted"
                  >Every contributed USDG enters the signal-directed path, never a discretionary wallet.</span
                >
              </li>
              <li><span class="muted">Miners compete for a fixed schedule, not a team-selected sale price.</span></li>
              <li><span class="muted">Every completed Strategy payment is owed entirely to Fund.</span></li>
            </ul>
          </div>
          <div class="ledger__side">
            <div class="ledger__head ledger__head--no">What no contract can guarantee</div>
            <ul class="checklist signal">
              <li>
                <span class="muted"
                  >That a quoted GBX price survives slippage, or that liquidity exists to realize it.</span
                >
              </li>
              <li><span class="muted">That miners participate at all on a given day.</span></li>
              <li><span class="muted">That auctions clear, or that Fund assets hold value.</span></li>
            </ul>
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'signaling',
    runner: '7 · Signaling with sGBX',
    group: 'The mechanism',
    section: { number: 7, title: 'Signaling with sGBX', note: 'Choosing what to accumulate' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Choose what you want to accumulate',
          number: '7',
          title: 'Signaling with sGBX',
          deck: 'Stake GBX one-for-one into non-transferable sGBX, then point that weight at the Strategies whose assets you actually want.',
        })}
        ${figureBlock({
          index: context.figure('signal'),
          svg: fig.signalAllocation({ width: widths.full }),
          caption:
            'Absolute amounts can be added to or removed from active Strategies independently — no epoch, cooldown or forced whole-account reset. Unallocated sGBX is immediately withdrawable. Changing an allocation redirects the next distribution; it never sells what the Fund already holds.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              If the active Strategies target an NVIDIA-linked asset, an Apple-linked asset, a SpaceX-linked asset or
              anything else eligible, a holder signals the Strategy for the asset they want the protocol to accumulate.
              When that Strategy completes an acquisition, the complete payment becomes shared Fund backing.
              Independently funded Bribes may still stream registered incentives across the same signal balances, but
              they never receive an automatic share of the auction payment.
            </p>
            <p>
              Signaling is continuous and reversible. Each operation adds or removes an absolute per-Strategy amount;
              the amount is a delta, not a target. A holder may leave some sGBX idle and withdraw that unallocated
              balance immediately. Idle sGBX earns nothing and dilutes nothing.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'A signal is not a claim',
              body: 'Signaling directs future USDG but creates no automatic reward claim. Any Bribe reward must be funded independently and accrues against eligible weight.',
            })}
            ${note({
              label: 'And not a vote',
              kind: 'capital',
              body: 'There is no threshold to cross and no outcome to lose. A 1% signal directs roughly 1% of the next distribution, whatever everyone else does.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'allocation',
    runner: '8 · Capital allocation',
    section: { number: 8, title: 'Capital allocation', note: 'Signal-directed, then Fund-bound' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'The next distribution follows live weight',
          number: '8',
          title: 'Capital allocation',
          deck: 'Revenue follows live signal weight into Strategies; every resulting payment then converges on Fund.',
        })}
        ${figureBlock({
          index: context.figure('routing'),
          svg: fig.routingFlow({ width: widths.full }),
          caption:
            'Ribbon thickness is proportional to live signal share. Strategy payments then converge completely on the common Fund.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            ${formula({
              label: 'Allocation to Strategy i',
              body: 'allocationᵢ = floor(R × Sᵢ / S_total)',
              where:
                'R = revenue being distributed · Sᵢ = active signal weight on Strategy i · S_total = total active signal weight. Rounding and no-signal behaviour are implementation details that must preserve value and avoid discretionary routing.',
            })}
            <p class="stack-1">
              A Strategy holding 30% of active signal weight receives about 30% of the next distribution. Signals apply
              when new revenue arrives and only then, which is why a change of mind is cheap and a change of holdings is
              not.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'One holder-directed split',
              kind: 'asset',
              body: 'Capital is split by signal before anything is acquired. Settlement has no second policy split: every payment is Fund-bound.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'acquisitions',
    runner: '9 · Acquisitions',
    section: { number: 9, title: 'Acquisitions', note: 'Price discovery without an oracle' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Oracleless reverse Dutch auctions',
          number: '9',
          title: 'Acquisitions',
          deck: 'A Strategy holds USDG and wants an asset. Rather than pricing that asset, it lets the clock lower its demands until someone accepts.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              The direction confuses people, so state it plainly: the Strategy is the <em>seller of USDG</em>. It offers
              its accumulated USDG balance and asks a filler to hand over a quantity of the target asset in exchange.
              The auction opens by demanding a large quantity — a good deal for the protocol and a bad one for the
              filler — and that demand decays linearly to zero as the epoch elapses.
            </p>
            ${formula({
              label: 'Required payment during an epoch',
              body: 'payment(t) = init − floor(init × t / period)',
              where:
                'There is no floor price. If nobody fills, the requirement reaches zero at the end of the epoch. The moment someone chooses to fill is itself the price discovery.',
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'Who pays whom',
              kind: 'asset',
              body: 'Filler → Strategy: the target asset. Strategy → filler: its USDG balance. Both legs settle in one transaction, so neither side is exposed to the other.',
            })}
          </div>
        </div>
        <div class="stack-1">
          ${figureBlock({
            index: context.figure('auction'),
            svg: fig.auctionChart({ width: widths.full }),
            caption:
              'Left: the requirement decays linearly to zero, and a rational filler waits until it falls below what the USDG is worth to them — the fill time is the price. Right: each fill re-opens the next epoch at the fill price multiplied by a bounded factor, so the sequence hunts the market price and re-tests it every epoch.',
          })}
        </div>
        <div class="spread stack-1">
          <div class="col-main">
            <p>
              That ratchet is what removes the oracle. The protocol never reads a price; it proposes one, observes
              whether the market takes it, and adjusts. A fill that comes early says the opening ask was too generous,
              and the next epoch opens higher. A fill that comes late, or not at all, says the opposite.
            </p>
            <p class="small muted">
              This removes an oracle dependency, not market risk. Thin liquidity, unusual token behaviour, low
              participation or badly chosen parameters can still produce delayed or unfavourable execution.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Bounded by construction',
              body: 'Epoch length is bounded between one hour and one year, and the price multiplier between 1.1× and 3×. The bounds constrain how fast the ratchet can move, not where it settles.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'formation',
    runner: '10 · Fund formation and rewards',
    section: { number: 10, title: 'Fund formation and independent rewards', note: 'One settlement rule' },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Every payment builds shared backing',
          number: '10',
          title: 'Fund formation and independent rewards',
          deck: 'Every completed Strategy payment is Fund-bound. Optional Bribes are funded separately across the same signal balances.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              Every Strategy uses one settlement rule: its complete payment becomes an immutable Fund liability. Anyone
              may deliver that liability later, preserving auction and signal-exit liveness if the payment token
              temporarily rejects the Fund. Auction proceeds never fund a Bribe automatically.
            </p>
            <p>
              Bribes remain permissionless, independently funded reward streams. A third party can notify a registered
              reward token, and that reward accrues across the Strategy's live signal balances. This incentive surface
              does not alter where auction payments go and does not depend on the identity of the Strategy payment
              asset.
            </p>
            <p>
              A signal therefore has one protocol-native effect: it directs new USDG toward the asset the common Fund
              should accumulate. Any personal reward is an explicit external incentive, not a tax on shared backing.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Streamed, not airdropped',
              kind: 'asset',
              body: 'Independently notified rewards accrue against signal weight held over the distribution period, using a reward-per-weight accumulator.',
            })}
            ${note({
              label: 'GBX follows the same route',
              kind: 'supply',
              body: 'A GBX-priced Strategy sends its complete payment toward Fund without burning it. Anyone may burn Fund-held GBX later.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          Signal the asset the Fund should accumulate —
          <em>every completed payment strengthens the basket every GBX holder can redeem against.</em>
        </p>
        <div class="stack-2 tint">
          <h3>Why separate Bribes from settlement?</h3>
          <p class="small muted" style="margin:0;">
            A fixed auction-proceeds reward share makes Strategy settlement depend on reward policy and diverts assets
            from common backing. Independent Bribes keep optional incentives possible while leaving the core rule
            legible: the Fund receives every Strategy payment.
          </p>
        </div>
      </div>
    `,
  },

  {
    id: 'redemption',
    runner: '11 · The Fund and redemption',
    section: { number: 11, title: 'The Fund and redemption', note: 'Burn, select, receive' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Burn GBX, choose assets, receive your share',
          number: '11',
          title: 'The Fund and redemption',
          deck: 'The Fund is permissionless raw-token custody, not a curated registry. The redeemer, not the protocol, decides which of its assets to claim.',
        })}
        <div class="spread">
          <div class="col-main">
            ${formula({
              label: 'Payout for each selected asset',
              body: 'payoutⱼ = floor(balanceⱼ × burned / supplyBeforeBurn)',
              where:
                'Supply and balances are snapshotted before the burn. The burn and every selected transfer are atomic: if one selected transfer fails, the entire redemption reverts, including the burn.',
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'Redemption cannot be paused',
              kind: 'supply',
              body: 'There is no pause switch anywhere in the core, which means there is none on the exit either.',
            })}
          </div>
        </div>
        <div class="stack-1">
          ${figureBlock({
            index: context.figure('redemption'),
            svg: fig.redemptionFigure({ width: widths.full }),
            caption:
              'Selecting an asset claims a pro-rata slice of it. Omitting one forfeits that claim permanently — the value stays behind for whoever still holds GBX.',
          })}
        </div>
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Selectivity is the design's answer to a real hazard. Because the Fund accepts any ERC-20, it can end up
              holding tokens that are malicious, frozen, rebasing, fee-on-transfer, or simply broken. If every
              redemption had to touch every asset, one hostile token would be enough to disable the exit for everyone.
            </p>
            <p>
              Letting the caller name the assets removes that dependency, at a price the redeemer pays knowingly: an
              omitted claim is gone, not deferred.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Membership lives elsewhere',
              kind: 'asset',
              body: 'Official protocol membership is represented by active Strategies in Resonance, not by an asset list inside the Fund. Anything can arrive in the Fund; only a Strategy can direct capital at it.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'burns',
    runner: '12 · Liquidity fees and Fund burns',
    section: { number: 12, title: 'Liquidity fees and Fund burns', note: 'Explicit supply maintenance' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'One market loop, one explicit burn path',
          number: '12',
          title: 'Liquidity fees and Fund burns',
          deck: 'The canonical market position auto-compounds; GBX auction payments remain supply-neutral until Fund burns them.',
        })}
        ${figureBlock({
          index: context.figure('burns'),
          svg: fig.burnLoops({ width: widths.full }),
          caption:
            'The position grows by a fixed rule and pays its caller accrued fees; Fund-held GBX can be burned permissionlessly.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              The canonical market position is a precommitted, hookless GBX/USDG Uniswap v4 position funded with the 20
              million GBX genesis allocation. Compounding is permissionless and removes zero principal: a caller grows
              liquidity by the fixed 0.20% and receives every accrued fee. Position fees are not protocol revenue.
            </p>
            <p>
              A Strategy may accept GBX like any other payment asset. Its complete GBX payment becomes a fixed Fund
              liability, and delivery does not change supply. Anyone may later call the dedicated Fund burn function.
              Before redemption, settling outstanding GBX liabilities and burning Fund-held GBX prevents those tokens
              from remaining in the redemption denominator.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Genesis liquidity is not a treasury',
              kind: 'supply',
              body: 'The 20M genesis tranche exists to make GBX tradeable. Its position NFT cannot be withdrawn to an arbitrary receiver, and the fees it generates never return to an operator.',
            })}
            ${note({
              label: 'Why a liquid market matters',
              kind: 'capital',
              body: 'Section 6 depends on GBX having a realizable price. Genesis liquidity is what makes that price exist at all, which is why it is committed rather than allocated.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'path',
    runner: '13 · Why the basket is path-dependent',
    section: { number: 13, title: 'Why the basket is path-dependent', note: 'A history, not a snapshot' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Signals steer flow, not holdings',
          number: '13',
          title: 'Why the basket is path-dependent',
          deck: 'Because every distribution follows the signal that exists at that moment, the Fund ends up holding the sum of every past decision rather than the current one.',
        })}
        ${figureBlock({
          index: context.figure('path'),
          svg: fig.basketFormationChart({ width: widths.full }),
          caption:
            'The upper band is what holders want at each distribution. The lower area is what the Fund actually holds. They are related by accumulation, and they are never the same picture.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              This is the most important behavioural consequence in the design, and the one most likely to be misread. A
              holder who moves signal to a new Strategy has changed the destination of future capital and nothing else.
              The assets bought under the old signal remain in the Fund until someone redeems them out.
            </p>
            <p>
              Composition therefore reflects the full history of contributions, signals and completed acquisitions. Two
              protocols with identical signal distributions today can hold entirely different baskets, because they
              arrived by different routes. There is no rebalancing mechanism that reconciles the two, and adding one
              would require exactly the discretionary selling power the design removes.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'What speeds it up',
              kind: 'capital',
              body: 'Only new revenue. A basket shifts faster when contributions are large relative to existing holdings, which means early distributions shape composition far more than later ones.',
            })}
            ${note({
              label: 'What can unwind it',
              kind: 'supply',
              body: 'Redemption. A holder who burns GBX and selects only some assets removes those specific holdings from the Fund, which is the one mechanism that reduces an existing position.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'worked',
    runner: '14 · One contribution, end to end',
    section: { number: 14, title: 'One contribution, end to end', note: 'A worked example' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'A worked example',
          number: '14',
          title: 'One contribution, end to end',
          deck: 'Everything above, applied once, to 1,000 USDG. Figures are illustrative and assume each step completes.',
        })}
        ${figureBlock({
          index: context.figure('worked'),
          svg: fig.workedExample(),
          caption:
            'Each step is a separate transaction and none of them is guaranteed to follow the last. The Strategy may not fill; the signal may be reallocated; the holder may never redeem.',
        })}
        <div class="spread stack-1">
          <div class="col-main">
            <p class="small muted">
              Two details are worth pausing on. First, the 2,000 GBX in step 1 depends on what everyone else contributed
              that day, not on any price the protocol set — a quieter day would have produced more GBX for the same
              1,000 USDG. Second, the routing in step 3 sends capital wherever signal weight points at that moment,
              which is not necessarily where this particular contributor pointed it.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'You are not buying your own signal',
              body: 'Your contribution joins a common pool and follows the aggregate distribution. Signaling raises the share of <em>all</em> revenue that reaches your chosen Strategy, including everyone else&rsquo;s.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'governance',
    runner: '15 · Governance-minimized design',
    group: 'What must hold, and what can fail',
    section: { number: 15, title: 'Governance-minimized final design', note: 'Four doors, no upgrade' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Signals govern direction; the core stays fixed',
          number: '15',
          title: 'Governance-minimized final design',
          deck: 'Economic direction and system maintenance are deliberately separated, and only one of them is a human decision.',
        })}
        ${figureBlock({
          index: context.figure('governance'),
          svg: fig.governancePerimeter({ width: widths.full }),
          caption:
            'The three authorized actions are the entire ongoing management surface. Everything on the right has no entry point, not a restricted one.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              sGBX holders direct capital continuously by signaling active Strategies. Management maintains the edges of
              the system — which Strategies exist and which additional Bribe rewards are registered — and can do nothing
              else. Each Bribe is permanently capped at eight reward tokens.
            </p>
            <p class="small muted">
              Open work: whether multi-token Bribe rewards should exist at all remains unresolved. The eight-token cap
              bounds the current path without deciding that product question.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Minimized, not absent',
              kind: 'asset',
              body: 'A compromised manager key can still add or kill Strategies and register rewards up to the eight-token limit. It cannot redirect Strategy payments, upgrade the core, withdraw Fund assets, pause redemption, or touch what the Fund already holds.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'invariants',
    runner: '16 · Core invariants',
    section: { number: 16, title: 'Core invariants', note: 'What must remain true' },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Properties the implementation must make testable',
          number: '16',
          title: 'Core invariants',
          deck: 'An invariant is a statement that should hold after every valid transaction, regardless of who calls it or in what order.',
        })}
        <div class="spread">
          <div class="col-main">
            <ol class="numbered">
              <li>Cumulative GBX minting never exceeds one billion.</li>
              <li>Burning GBX never restores mint capacity.</li>
              <li>
                Fundraiser emissions follow the fixed sequential daily schedule, and empty days forfeit without carry.
              </li>
              <li>All contribution revenue enters the signal-directed routing path.</li>
              <li>
                Absolute per-Strategy sGBX signals change by incremental deltas; unallocated sGBX is withdrawable.
              </li>
              <li>Redemption uses pre-burn supply and balance snapshots.</li>
              <li>A redemption burn and all selected transfers are atomic.</li>
              <li>Every Strategy payment is fully classified as an immutable Fund liability.</li>
              <li>A GBX-priced Strategy leaves supply unchanged until an explicit Fund burn or redemption.</li>
              <li>Each Bribe has at most eight append-only reward tokens.</li>
              <li>Liquidity compounding adds 0.20% and removes no principal.</li>
              <li>The deployed core has no upgrade path and no arbitrary asset-withdrawal path.</li>
              <li>Revenue and reward floor remainders remain explicit carry; signal exit transfers no payout token.</li>
            </ol>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why these and not others',
              body: 'Each one names a way value could leave the system unexpectedly, or a discretionary power that could be reintroduced by accident. They are chosen to be falsifiable by a test, not to be reassuring.',
            })}
            ${note({
              label: 'Stated, not proven',
              kind: 'asset',
              body: 'This is a specification of intent. None of these properties is currently established by an independent audit of final bytecode.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'risks',
    runner: '17 · Risks and trust assumptions',
    section: { number: 17, title: 'Risks and trust assumptions', note: 'Mechanism by mechanism' },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Onchain does not mean risk-free',
          number: '17',
          title: 'Risks and trust assumptions',
          deck: 'Removing discretionary powers narrows what an operator can do. It does not narrow what a market, a token, or a bug can do.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            head: ['Where', 'What can fail', 'What the design does about it'],
            rows: [
              [
                'Smart contracts',
                'A flaw breaks routing, auctions, rewards, burns or redemption.',
                'Narrow contract boundaries and stated invariants. Immutability makes any surviving flaw permanent.',
              ],
              [
                'Manager key',
                'A compromised key adds or kills Strategies, or registers Bribe reward tokens.',
                'Three bounded actions only. No upgrade, withdrawal, pause, or way to reach the Fund&rsquo;s existing holdings.',
              ],
              [
                'Signal concentration',
                'A large sGBX holder directs a disproportionate share of future capital.',
                'Nothing. Weight is proportional by design; concentration of GBX becomes concentration of direction.',
              ],
              [
                'Auction execution',
                'Thin participation or bad parameters produce a poor fill, or no fill at all.',
                'Bounded epoch and multiplier, and a ratchet that re-tests the market. Neither guarantees a counterparty.',
              ],
              [
                'Asset quality',
                'The Fund receives malicious, frozen, rebasing or fee-on-transfer tokens.',
                'Selective redemption means one broken token cannot disable the exit for everyone.',
              ],
              [
                'Selective redemption',
                'A caller selects a broken token and reverts, or omits one and loses the claim.',
                'The choice is explicit and per-call. The forfeited claim stays with the remaining GBX supply.',
              ],
              [
                'External systems',
                'USDG, the chain, bridges, sequencers or custody fail.',
                'Nothing. These are dependencies outside the core contracts and outside its guarantees.',
              ],
              [
                'Economics',
                'Demand, participation, fills and asset values all disappoint.',
                'Nothing is promised about any of them. Section 6 states the incentive and its conditions.',
              ],
              [
                'Legal and regulatory',
                'Tokenized assets carry issuer, custody, transfer and jurisdictional restrictions.',
                'Nothing. Holding a tokenized claim is not equivalent to owning the underlying asset.',
              ],
            ],
          })}
        </div>
        <p class="statement stack-2">
          A smaller management surface narrows what an operator can do to you.
          <em>It cannot supply good assets, good prices, good signals, or bug-free code.</em>
        </p>
      </div>
    `,
  },

  {
    id: 'status-impl',
    runner: '18 · Implementation status',
    section: { number: 18, title: 'Implementation status', note: 'What is unfinished' },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'A specification, not a launch claim',
          number: '18',
          title: 'Implementation status',
          deck: 'This paper describes a target final design. The repository behind it is a pre-audit engineering starting point.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              The current contracts, generated interfaces, indexing layer, deployment scripts and technical
              documentation still describe a broader administrative surface than this paper specifies. Those differences
              must be removed and the whole repository reconciled before any deployment is considered.
            </p>
            <h3 class="stack-2">Minimum requirements before production</h3>
            <ol class="numbered stack-1">
              <li>Final contract interfaces matching the four-action Resonance management surface.</li>
              <li>An owner decision on whether multi-token Bribe rewards should exist.</li>
              <li>Complete unit, integration, invariant and economic-model tests.</li>
              <li>Reviewed asset and chain configuration.</li>
              <li>Reproducible deployment rehearsals.</li>
              <li>Independent security review of the final immutable bytecode.</li>
              <li>Explicit resolution of every open trust, licensing and operational question.</li>
            </ol>
          </div>
          <div class="col-side">
            ${note({
              label: 'Question still to decide',
              kind: 'asset',
              body: 'Bribe reward registration is bounded at eight tokens, but the stronger question remains: should additional reward tokens exist at all?',
            })}
            ${note({
              label: 'What a green build means',
              body: 'A passing local build is engineering evidence only. It is not an audit, an authorization, or a launch claim.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'conclusion',
    runner: '19 · Conclusion',
    section: { number: 19, title: 'Conclusion', note: 'What is actually being claimed' },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'A public mechanism for forming a basket',
          number: '19',
          title: 'Conclusion',
          deck: 'GumBall6900 turns fund formation into a continuous onchain process instead of publishing a finished list.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              GBX is a transferable claim, redeemable against assets the Fund already holds. sGBX is a live statement
              about where arriving capital should go. Strategies convert that statement into acquisitions, and the
              accumulated history of those acquisitions is the basket.
            </p>
            ${table({
              className: 'table--tight',
              head: ['', 'Refers to', 'Changes when'],
              rows: [
                ['GBX', 'What the Fund already owns', 'Someone mines, burns, or redeems'],
                ['sGBX', 'What the Fund may acquire next', 'A holder reallocates weight — instantly'],
                ['The fixed core', 'The rules both must follow', 'Never, after deployment'],
              ],
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'The narrow claim',
              kind: 'capital',
              body: 'Not that holders will choose well. Only that the choosing can be public, continuous, and inspectable.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          Public mining. Continuous signals. Market-executed acquisitions. In-kind redemption. A fixed core.
        </p>
        <p class="stack-2 small muted">
          The protocol does not promise that holders will select good assets, that auctions will clear, or that GBX will
          retain value. Its proposition is narrower than any of those: that public mining, continuous signaling,
          market-executed acquisition, in-kind redemption and a governance-minimized core can make shared capital
          allocation more open and more inspectable than the alternative.
        </p>
      </div>
    `,
  },

  {
    id: 'glossary',
    runner: 'Glossary',
    group: 'Reference',
    section: { title: 'Glossary', note: 'Terms used throughout' },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Reference',
          title: 'Glossary',
          deck: 'Short definitions for the terms this paper relies on.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            rows: [
              [
                'Bribe',
                'The Strategy-specific reward contract that streams an acquired asset across eligible signal balances.',
              ],
              [
                'Eligible signaler',
                'An account whose sGBX weight was allocated to a Strategy over the period a reward accrued.',
              ],
              [
                'Fund',
                'The permissionless raw-token treasury that holds acquired assets and supports selective in-kind redemption.',
              ],
              [
                'Fundraiser',
                'The public USDG contribution mechanism through which GBX is mined on a fixed daily schedule.',
              ],
              ['GBX', 'The transferable protocol token, capped at one billion cumulative mints.'],
              [
                'Genesis liquidity',
                'The 20 million GBX committed to the canonical GBX/USDG position. Not a treasury and not withdrawable to an arbitrary receiver.',
              ],
              [
                'In-kind redemption',
                'Receiving the underlying tokens themselves rather than a cash or synthetic equivalent.',
              ],
              ['Bribe reward cap', 'At most eight append-only reward tokens may be registered for one Strategy.'],
              [
                'Mining',
                'Contributing USDG through the public Fundraiser and receiving that period&rsquo;s scheduled GBX. Not proof-of-work.',
              ],
              [
                'Path-dependent',
                'A composition determined by the order and timing of past events, not by current preferences alone.',
              ],
              ['Resonance', 'The allocation engine that distributes incoming USDG according to live sGBX signals.'],
              [
                'Reverse Dutch auction',
                'An auction whose asking amount falls over time. Here the Strategy offers USDG and the target-asset payment it requires decays to zero.',
              ],
              ['sGBX (SignalGBX)', 'Non-transferable staked GBX used as live signal weight.'],
              [
                'Signal weight',
                'The share of active sGBX allocated to a Strategy, which determines its share of the next distribution.',
              ],
              ['Strategy', 'An active reverse Dutch auction registered in Resonance with one payment asset.'],
              ['USDG', 'The stable asset contributed by miners and routed through the protocol.'],
            ],
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'colophon',
    deep: true,
    runner: 'Document basis',
    section: { title: 'Document basis', note: 'Sources, version and disclosure' },
    render: () => html`
      <div class="frame">
        <p class="eyebrow" style="color:${palette.blueBright};">Document basis</p>
        <h1 class="section-title" style="font-size:22pt; line-height:26pt;">
          If this paper and the deployed bytecode<br />ever disagree, the bytecode wins.
        </h1>
        <div class="rule" style="background:${palette.deepRule};"></div>
        <div class="spread stack-1">
          <div class="col-main">
            <p style="color:${palette.onDeepMuted};">
              This paper summarizes the intended target design recorded in the GumBall6900 repository as of 8 August
              2026. The technical source of truth remains the final reviewed contracts and their matching
              specifications. Prose is maintained in <code style="color:${palette.onDeep};">docs/WHITEPAPER.md</code>;
              this typeset edition is generated from <code style="color:${palette.onDeep};">docs/whitepaper</code>.
            </p>
            <p style="color:${palette.onDeepMuted};">
              Charts are computed at build time from the same emission, auction and redemption rules the
              repository&rsquo;s reference model tests, so no figure in this document contains a hand-transcribed
              number.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Colour key',
              kind: 'capital',
              body: legend.map((entry) => entry.label).join(' · '),
            })}
          </div>
        </div>

        <div style="position:absolute; bottom:0; left:0; right:0;">
          <div class="rule" style="background:${palette.deepRule}; margin-bottom:6mm;"></div>
          <div class="kpi-row">
            <div>
              <div class="kpi__label">Edition</div>
              <p class="note" style="color:${palette.onDeepMuted}; margin-top:1.6mm;">${meta.version} · ${meta.date}</p>
            </div>
            <div>
              <div class="kpi__label">Status</div>
              <p class="note" style="color:${palette.onDeepMuted}; margin-top:1.6mm;">
                Pre-audit. Not deployed. Not authorized for user funds.
              </p>
            </div>
            <div>
              <div class="kpi__label">Disclosure</div>
              <p class="note" style="color:${palette.onDeepMuted}; margin-top:1.6mm;">
                Educational protocol overview only. Not investment, legal, or tax advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    `,
  },
];

/* -------------------------------------------------------------- rendering ---- */

function buildContents(entries) {
  const rows = [];
  let currentGroup = null;

  entries.forEach((entry) => {
    if (entry.group && entry.group !== currentGroup) {
      currentGroup = entry.group;
      rows.push(`<div class="toc__group">${entry.group}</div>`);
    }
    rows.push(
      html`<div class="toc__row">
        <span class="toc__num">${entry.number ? String(entry.number).padStart(2, '0') : '·'}</span>
        <span class="toc__title">${entry.title}<em>${entry.note}</em></span>
        <span class="toc__leader"></span>
        <span class="toc__folio">${String(entry.folio).padStart(2, '0')}</span>
      </div>`,
    );
  });

  return `<div class="toc">${rows.join('')}</div>`;
}

export function renderPages() {
  // Pass one: assign folios and collect contents entries.
  const entries = [];
  pages.forEach((page, index) => {
    page.folio = index + 1;
    if (page.section) {
      entries.push({ ...page.section, group: page.group, folio: page.folio });
    }
  });

  const toc = buildContents(entries);

  // Figure numbering is assigned in document order on first request.
  const figureNumbers = new Map();
  const context = {
    toc,
    figure: (key) => {
      if (!figureNumbers.has(key)) figureNumbers.set(key, figureNumbers.size + 1);
      return String(figureNumbers.get(key)).padStart(2, '0');
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
