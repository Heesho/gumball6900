import { html, ledger, note, sectionHead, steps, table } from '../page-kit.mjs';
import { brandmark } from '../brand-asset.mjs';
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
          <div style="position:absolute; top:60mm; left:0; right:0;">${brandmark('26mm', 'brandmark--cover')}</div>
          <div style="position:absolute; top:92mm; left:0; right:0;">
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
                <div class="kpi__value">16</div>
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
                audit, and is not authorized for user funds. Independent review of Mine's fixed economics, target-chain
                dependencies, legal provenance, and a signed deployment manifest remain unresolved.
              </p>
              <p style="color:${palette.onDeepMuted}">
                This edition describes the uncommitted development tree implementing ADRs 0031 and 0033-0044. Its full
                deterministic current-tree matrix passed locally on 22 August 2026, but there is no commit-pinned review
                candidate. External governance remains unselected. A local green build is engineering evidence, never a
                safety, audit, or release claim.
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
                ['Supply limit', 'No economic cap; GBX has no voting checkpoints'],
                ['Governance', 'External Resonance owner unselected; sGBX IVotes retained'],
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
            deck: 'Mining brings USDG in; signal-backed sGBX coordinates acquisition weights and exposes IVotes checkpoints.',
          })}
          <div class="spread">
            <div class="col-main">
              ${steps([
                'A participant takes a mining slot at its current hourly decaying USDG price.',
                'The incumbent accrues GBX continuously at the fixed rate assigned on entry.',
                'A signal atomically escrows GBX, mints non-transferable voting sGBX, and assigns every unit to one live Strategy.',
                'Twenty percent of a nonempty-slot handoff is deposited into ResonanceRouter; eighty percent becomes a displaced-miner claim.',
                'Mine stops after deposit. A later permissionless route of a qualifying balance restarts seven days with new USDG plus the remainder.',
                'Strategies pull released USDG; each acquired-asset payment uses the current global 0%-to-20% Bribe rate and its Fund complement, with 1e36 reward-index precision.',
                'A GBX holder may burn GBX for a selected pro-rata basket of raw Fund assets.',
              ])}
            </div>
            <div class="col-side">
              ${note({
                label: 'Empty slots',
                kind: 'capital',
                body: 'A first occupation deposits 100% into the Router. Mine stops there; permissionless routing has no guaranteed caller.',
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
                  ['Nonempty replacement', '80% claim / 20% Router deposit'],
                ],
              })}
            </div>
            <div class="col-side">
              ${note({
                label: 'Not guaranteed',
                kind: 'asset',
                body: 'Profitability, a successor payment, GBX liquidity, and frequent replacement are market outcomes—not contract guarantees.',
              })}
              ${note({
                label: 'Caller bounds',
                body: 'Every purchase supplies an expected epoch, a deadline, and a maximum price, so a miner front-run at purchase cannot be charged the reset opening price.',
              })}
            </div>
          </div>`,
      ),
  },
  {
    id: 'fairness',
    runner: 'Fixed-tenure fairness',
    section: { title: 'Fixed-tenure fairness', note: 'Halvings cannot dilute incumbents' },
    render: () =>
      frame(
        html`${sectionHead({
            eyebrow: 'Part III',
            number: '03',
            title: 'Miners keep the rate they bought',
            deck: 'A slot rate changes only when that slot changes hands.',
          })}
          <p class="lead">
            Time-based halving boundaries, claims, redemptions, and other slots' handoffs never rewrite an occupied
            slot's GBX-per-second rate.
          </p>
          ${table({
            head: ['State', 'Earlier incumbent', 'New tenure'],
            rows: [
              ['Global 230,400 GBX/hour', '14,400 GBX/hour', '14,400 GBX/hour'],
              ['Global rate halves', 'Still 14,400 GBX/hour', '7,200 GBX/hour'],
              ['Incumbent is replaced', 'Tenure ends', '7,200 GBX/hour'],
            ],
          })}
          <div class="spread stack-2">
            <div class="col-main">
              <p>
                All sixteen slots divide the current global rate by sixteen when a tenure begins. A time boundary
                changes only the rate offered at a later handoff, never an incumbent's already-assigned rate.
              </p>
            </div>
            <div class="col-side">
              ${note({
                label: 'Accepted tradeoff',
                kind: 'supply',
                body: 'Aggregate issuance can exceed the current global rate for as long as old high-rate tenures remain; turnover is not guaranteed.',
              })}
            </div>
          </div>`,
      ),
  },
  {
    id: 'supply-redemption',
    runner: 'Supply and redemption',
    section: { title: 'Supply and redemption', note: 'Infinite tail, constant-time denominator' },
    render: () =>
      frame(
        html`${sectionHead({
            eyebrow: 'Part IV',
            number: '04',
            title: 'Accrued mining counts before redemption',
            deck: "Fund reads Mine's constant-time effective supply before taking the common snapshot.",
          })}
          <div class="spread">
            <div class="col-main">
              <p>
                GBX begins with ${Number(contractConstants.gbx.genesisLiquidityTokens).toLocaleString('en-US')} genesis
                tokens. Its only later issuer is the permanently bound Mine. Global rates offered to future occupants
                halve every 69 days measured from Mine deployment and reach a 1 GBX-per-second tail at day 414. That
                schedule is provisional pending independent economic review. GBX supports permit approvals but has no
                governance checkpoints; votes begin only after signaling into sGBX.
              </p>
              <p>
                Rewards accrue continuously but each slot mints only when it changes hands. Fund reads Mine's
                constant-time effective supply before every redemption, so already-earned unminted GBX cannot be omitted
                from the denominator and redemption never depends on touching all slots.
              </p>
              <p class="formula">
                <span class="formula__label">Payout</span> floor(Fund token balance × GBX burned ÷ effective pre-burn
                supply)
              </p>
            </div>
            <div class="col-side">
              ${note({
                label: 'Constant-time supply',
                kind: 'capital',
                body: `Mine maintains one aggregate TPS accumulator across ${contractConstants.mine.slotCount} fixed slots; Fund performs no slot loop or mining mutation.`,
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
    section: { title: 'Governance and risks', note: 'External integration remains a release gate' },
    render: () =>
      frame(
        html`${sectionHead({
            eyebrow: 'Part V',
            number: '05',
            title: 'Immutable by design',
            deck: 'The core exposes four Resonance administration methods; external execution rules remain unselected.',
          })}
          ${ledger({
            yesHead: 'Resonance owner actions',
            yesItems: [
              'Add a Strategy',
              'Permanently kill a Strategy',
              'Register a Bribe reward token, up to eight',
              'Set the global prospective Bribe share, 0%-20%',
            ],
            noHead: 'Absent powers',
            noItems: [
              'No Mine administration or incumbent repricing',
              'No emission setter or replacement authority',
              'No core Governor, Timelock, or generic executor',
              'No Fund withdrawal or liquidity NFT recovery',
            ],
          })}
          <div class="spread stack-2">
            <div class="col-main">
              <p>
                SignalGBX retains block-clock ERC20Votes checkpoints, including historical weight after signal exits,
                but this repository does not select or implement the governance system that will consume them. A later
                ADR must pin the exact external executor, permissions, voting rules, upgrades, delay, cancellation, and
                ownership handoff. After bootstrap, the final live Strategy cannot be killed until a replacement is
                added. A rate change affects only later payment classifications; 0% disables no signaling or
                independently funded reward path.
              </p>
            </div>
            <div class="col-side">
              ${note({
                label: 'Release status',
                kind: 'asset',
                body: 'External governance selection, independent audit, parameter review, provenance clearance, and signed deployment evidence are still required.',
              })}
            </div>
          </div>`,
      ),
  },
];
