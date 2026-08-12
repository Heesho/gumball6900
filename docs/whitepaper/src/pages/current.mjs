import { html, ledger, note, sectionHead, steps, table } from '../page-kit.mjs';
import { contractConstants, status } from '../protocol-facts.mjs';
import { meta } from '../meta.mjs';
import { palette } from '../theme.mjs';

const frame = (content) => html`<div class="frame">${content}</div>`;

export const currentPages = [
  {
    id: 'cover',
    deep: true,
    bare: true,
    render: () =>
      frame(
        html`<span class="chip">Whitepaper ${meta.version} · ${meta.date}</span>
          <div style="position:absolute; top:82mm; left:0; right:0;">
            <h1 class="cover__title">GumBall6900</h1>
            <p class="cover__subtitle">The index fund<br />that chooses itself</p>
            <p class="cover__thesis" style="margin-top:8mm;">
              An immutable signal-directed onchain fund with continuously clearing GBX mining, tenure-locked miner
              rates, oracleless acquisitions, and in-kind redemption.
            </p>
          </div>
          <div style="position:absolute; bottom:22mm; left:0; right:0;">
            <div class="rule" style="background:${palette.deepRule}"></div>
            <div class="kpi-row">
              <div>
                <div class="kpi__value">20M</div>
                <div class="kpi__label">Genesis GBX</div>
              </div>
              <div>
                <div class="kpi__value">1–16</div>
                <div class="kpi__label">Mining slots</div>
              </div>
              <div>
                <div class="kpi__value">80 / 20</div>
                <div class="kpi__label">Handoff / Resonance</div>
              </div>
              <div>
                <div class="kpi__value">Fixed</div>
                <div class="kpi__label">Tenure rate</div>
              </div>
            </div>
          </div>`,
      ),
  },
  {
    id: 'status',
    deep: true,
    runner: 'Document status',
    render: () =>
      frame(
        html`<p class="eyebrow" style="color:${palette.pinkBright}">Read this first</p>
          <h1 class="section-title">Development design,<br />not a deployed system.</h1>
          <div class="rule" style="background:${palette.deepRule}"></div>
          <div class="spread stack-1">
            <div class="col-main">
              <p style="color:${palette.onDeep}">
                GumBall6900 is experimental software. It is not deployed, has not received an independent external
                audit, and is not authorized for user funds. Exact Mine economics, target-chain dependencies, legal
                provenance, and a signed deployment manifest remain unresolved.
              </p>
              <p style="color:${palette.onDeepMuted}">
                This edition supersedes the daily pooled mining design. The Solidity and tested economic fixtures are
                authoritative. A local green build is engineering evidence, not a safety or release claim.
              </p>
            </div>
            <div class="col-side">
              ${note({
                label: 'Edition',
                kind: 'capital',
                body: `${meta.version}, ${meta.date}. ${status.deployment}. ${status.externalAudit}.`,
              })}
            </div>
          </div>
          <div class="stack-2">
            ${table({
              rows: [
                ['Genesis issuance', '20,000,000 GBX for canonical liquidity'],
                ['Later issuance', 'One permanently bound immutable Mine'],
                ['Supply limit', 'No economic cap; ERC20Votes retains a uint208 safety ceiling'],
                ['Governance', 'Resonance actions plus increase-only Mine capacity'],
                ['Legal status', status.licensing],
              ],
            })}
          </div>`,
      ),
  },
  {
    id: 'contents',
    runner: 'Contents',
    render: (context) =>
      frame(
        html`<p class="eyebrow">Orientation</p>
          <h1 class="section-title">Contents</h1>
          <div class="rule"></div>
          ${context.toc}`,
      ),
  },
  {
    id: 'loop',
    runner: 'Economic loop',
    section: { title: 'Economic loop', note: 'Mine, signal, acquire, redeem' },
    render: () =>
      frame(
        html`${sectionHead({
            eyebrow: 'Part I',
            number: '01',
            title: 'The economic loop',
            deck: 'Mining brings USDG in; sGBX signals decide where the next dollar goes.',
          })}
          <div class="spread">
            <div class="col-main">
              ${steps([
                'A participant takes a mining slot at its current hourly decaying USDG price.',
                'The incumbent accrues GBX continuously at the fixed rate assigned on entry.',
                'Twenty percent of a nonempty-slot handoff routes through Resonance; eighty percent becomes a displaced-miner claim.',
                'Strategies exchange routed USDG for configured assets whose complete payments become Fund liabilities.',
                'A GBX holder may burn GBX for a selected pro-rata basket of raw Fund assets.',
              ])}
            </div>
            <div class="col-side">
              ${note({
                label: 'Empty slots',
                kind: 'capital',
                body: 'A first occupation routes 100% of its USDG payment because no displaced miner exists.',
              })}
              ${note({ label: 'No team fee', body: 'Mining has no team, founder, management, or protocol fee.' })}
            </div>
          </div>`,
      ),
  },
  {
    id: 'mining',
    runner: 'Mining market',
    section: { title: 'Mining market', note: 'Hourly handoffs and rollover risk' },
    render: () =>
      frame(
        html`${sectionHead({
            eyebrow: 'Part II',
            number: '02',
            title: 'A continuously clearing market',
            deck: 'Each independently replaceable slot falls from its opening USDG price to zero in one hour.',
          })}
          <div class="spread">
            <div class="col-main">
              <p>
                A miner buys the right to accrue GBX until replacement and the possibility of receiving 80% of the next
                payment. The second value is uncertain: without a successor, no handoff claim arrives. This rollover
                risk disciplines the price miners are willing to pay.
              </p>
              <p>
                After each handoff, the next opening price is the paid amount multiplied by an immutable factor, with an
                immutable minimum. Expected GBX value, market liquidity, gas, replacement probability, and contract risk
                all influence the real clearing price.
              </p>
              ${table({
                head: ['Moment', 'Contract outcome'],
                rows: [
                  ['Start of hour', 'Price equals the slot opening price'],
                  ['Thirty minutes', 'Approximately half remains'],
                  ['One hour or later', 'Price is zero; replacement still allowed'],
                  ['Nonempty replacement', '80% claim / 20% Resonance'],
                ],
              })}
            </div>
            <div class="col-side">
              ${note({
                label: 'Not guaranteed',
                kind: 'asset',
                body: 'Profitability, a successor payment, GBX liquidity, and frequent replacement are market outcomes—not contract guarantees.',
              })}
            </div>
          </div>`,
      ),
  },
  {
    id: 'fairness',
    runner: 'Fixed-tenure fairness',
    section: { title: 'Fixed-tenure fairness', note: 'Capacity cannot dilute incumbents' },
    render: () =>
      frame(
        html`${sectionHead({
            eyebrow: 'Part III',
            number: '03',
            title: 'Miners keep the rate they bought',
            deck: 'A slot rate changes only when that slot changes hands.',
          })}
          <p class="lead">
            Checkpoints, cumulative-mining thresholds, redemptions, and capacity increases never rewrite an occupied
            slot's GBX-per-second rate.
          </p>
          ${table({
            head: ['State', 'Slot 0 incumbent', 'New slots'],
            rows: [
              ['Capacity 1; global 100 GBX/hour', '100 GBX/hour', 'Closed'],
              ['Capacity grows to 3', 'Still 100 GBX/hour', 'Open'],
              ['New occupations', 'Still 100 GBX/hour', 'About 33 GBX/hour each'],
            ],
          })}
          <div class="spread stack-2">
            <div class="col-main">
              <p>
                This prevents governance from changing the economic deal after entry. Only future occupations divide the
                current global rate by current capacity. A threshold crossing similarly changes only the rate offered at
                a later handoff.
              </p>
            </div>
            <div class="col-side">
              ${note({
                label: 'Accepted tradeoff',
                kind: 'supply',
                body: 'Aggregate issuance can temporarily exceed the current global rate while old high-rate tenures remain.',
              })}
            </div>
          </div>`,
      ),
  },
  {
    id: 'supply-redemption',
    runner: 'Supply and redemption',
    section: { title: 'Supply and redemption', note: 'Infinite tail, checkpointed denominator' },
    render: () =>
      frame(
        html`${sectionHead({
            eyebrow: 'Part IV',
            number: '04',
            title: 'Accrued mining counts before redemption',
            deck: 'Fund crystallizes every live slot before taking the common supply snapshot.',
          })}
          <div class="spread">
            <div class="col-main">
              <p>
                GBX begins with ${contractConstants.gbx.genesisLiquidityTokens} million genesis tokens. Its only later
                issuer is the permanently bound Mine. Global rates offered to future occupants halve at immutable
                cumulative-mining thresholds, then continue at a positive tail on every modeled horizon. ERC20Votes'
                uint208 ceiling remains the remote implementation bound.
              </p>
              <p>
                Rewards accrue continuously but mint at checkpoints. Fund calls <code>checkpointAll</code> before every
                redemption, so already-earned GBX cannot be omitted from the denominator.
              </p>
              <p class="formula">
                <span class="formula__label">Payout</span> floor(Fund token balance × GBX burned ÷ post-checkpoint
                pre-burn supply)
              </p>
            </div>
            <div class="col-side">
              ${note({
                label: 'Bounded work',
                kind: 'capital',
                body: `Capacity is permanently capped at ${contractConstants.mine.maxCapacity}; checkpoint cost grows linearly but cannot become unbounded.`,
              })}
              ${note({
                label: 'Omissions',
                body: 'Assets a redeemer leaves out remain permanently for the post-redemption supply.',
              })}
            </div>
          </div>`,
      ),
  },
  {
    id: 'governance-risks',
    runner: 'Governance and risks',
    section: { title: 'Governance and risks', note: 'Narrow authority, irreversible consequences' },
    render: () =>
      frame(
        html`${sectionHead({
            eyebrow: 'Part V',
            number: '05',
            title: 'Immutable by design',
            deck: 'The timelock can maintain membership and add mining concurrency; it cannot rewrite mining tenures.',
          })}
          ${ledger({
            yesHead: 'Timelocked actions',
            yesItems: [
              'Add a Strategy',
              'Permanently kill a Strategy',
              'Register a Bribe reward token, up to eight',
              'Increase Mine capacity, from one to at most sixteen',
            ],
            noHead: 'Absent powers',
            noItems: [
              'No capacity decrease or incumbent repricing',
              'No emission setter or replacement authority',
              'No proxy, migration, rescue, pause, or arbitrary executor',
              'No Fund withdrawal or liquidity NFT recovery',
            ],
          })}
          <div class="spread stack-2">
            <div class="col-main">
              <p>
                Major risks include uncertain mining demand and GBX liquidity, rollover risk, temporarily elevated
                issuance after expansion, rapid signal movement, failing token dependencies, permanent deployment
                mistakes, and immutable custody.
              </p>
            </div>
            <div class="col-side">
              ${note({
                label: 'Release status',
                kind: 'asset',
                body: 'Independent audit, parameter review, provenance clearance, and signed deployment evidence are still required.',
              })}
            </div>
          </div>`,
      ),
  },
];
