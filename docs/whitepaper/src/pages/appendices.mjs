/**
 * Technical appendices and back matter.
 */

import { palette } from '../theme.mjs';
import * as fig2 from '../figures2.mjs';
import { widths } from '../svg.mjs';
import { html, sectionHead, note, figureBlock, table } from '../page-kit.mjs';
import { schedule, status } from '../protocol-facts.mjs';
import { meta } from '../meta.mjs';

export const appendixPages = [
  {
    id: 'app-contracts',
    runner: 'Appendix A · Contract map',
    group: 'Appendices',
    section: { title: 'Appendix A: Contract map', note: 'Twelve contracts, one dependency', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix A',
          title: 'Contract map',
          deck: 'The complete production surface: twelve direct, non-upgradeable contracts plus the standard timelock that owns exactly one of them.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            head: ['Contract', 'Role', 'Owner', 'Key entry points'],
            rows: [
              ['GBX', 'Capped token; permit, votes', 'None (minter locked)', 'mint · burn · setMinter¹'],
              ['Fundraiser', 'Daily USDG-for-GBX mining', 'None', 'contribute · claim · settleEpochs'],
              ['SignalGBX', '1:1 non-transferable receipt', 'Deployer¹', 'stake · unstake · setResonance¹'],
              ['ResonanceRouter', 'Single revenue entrance', 'None', 'route'],
              [
                'Resonance',
                'Signals and allocation',
                'Timelock (intended)',
                'signal ops · distribute* · sync/index · payFundRevenue · addStrategy · killStrategy · addBribeReward',
              ],
              ['StrategyFactory', 'Deploys Strategy pairs', 'Deployer¹', 'createStrategy (Resonance only)'],
              ['Strategy (each)', 'Reverse Dutch auction', 'None; config immutable', 'buy · currentPrice'],
              ['BribeFactory', 'Deploys Bribes', 'Deployer¹', 'createBribe (Resonance only)'],
              ['BribeRouter (each)', '100% payment liabilities', 'None', 'routePayment · payFundPayment'],
              ['Bribe (each)', 'Capped 8-token streams', 'None', 'notifyRewardAmount · claims · payFundReward'],
              ['Fund', 'In-kind redemption treasury', 'None', 'redeem · burnGBX'],
              ['LiquidityPosition', 'NFT custody, fee routing', 'None', 'harvestFees · onERC721Received¹'],
              ['TimelockController', 'OZ standard; owns Resonance', 'Self-administered', 'schedule · execute · cancel'],
            ],
          })}
        </div>
        <p class="small muted stack-2">
          ¹ one-time. Dependencies: OpenZeppelin 5.6.1; Uniswap v4 core 1.0.2 / periphery 1.0.3. Permit2 appears only in
          test tooling. Interfaces: IBribe, ICoreResonance, IFund, IResonanceRouter. Generated documentation for all 252
          public ABI functions: <code>docs/reference/contracts.md</code>.
        </p>
      </div>
    `,
  },

  {
    id: 'app-formulas',
    runner: 'Appendix B · Exact formulas',
    section: { title: 'Appendix B: Exact formulas', note: 'Every quantitative rule in one place', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix B',
          title: 'Exact formulas',
          deck: 'All arithmetic is integer arithmetic. floor() is written explicitly wherever the EVM floors.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            head: ['Rule', 'Formula'],
            rows: [
              [
                'Lifetime supply',
                'lifetimeMinted ≤ 1,000,000,000e18; remaining = ceiling − lifetimeMinted; supply = lifetimeMinted − lifetimeBurned',
              ],
              [
                'Emission step',
                'scheduled₀ = 465,152,749,681,042,811,702,004 wei; scheduledₜ₊₁ = floor(scheduledₜ × 999,525,354,337,060,160 / 10¹⁸)',
              ],
              [
                'Schedule end',
                `${schedule.nonzeroEpochs.toLocaleString('en-US')} nonzero epochs; Σ = ${schedule.cumulativeEmitted.toLocaleString('en-US')} wei; remainder = ${schedule.unmintedRemainder.toLocaleString('en-US')} wei`,
              ],
              ['Contributor claim', 'reward = floor(contribution × epochEmission / totalEpochContributions)'],
              [
                'Signal capacity',
                'available = sGBX.balanceOf(account) − accountSignalWeight[account]; every add/remove is a delta against one Strategy',
              ],
              [
                'Revenue indexing',
                'pendingScaled += amount × 10¹⁸; indexDelta = floor(pendingScaled / totalSignalWeight); index += indexDelta; pendingScaled −= indexDelta × totalSignalWeight',
              ],
              [
                'Strategy accrual',
                'accruedScaled = remainder + weight × (index − lastIndex); claim += floor(accruedScaled / 10¹⁸); remainder = accruedScaled mod 10¹⁸',
              ],
              ['Auction price', 'payment(t) = initial − floor(initial × elapsed / duration), zero at/after expiry'],
              ['Next opening', 'next = floor(payment × multiplier / 10¹⁸), floored at minimumPrice, capped at 2¹⁹²−1'],
              ['Settlement', 'fundLiability += payment (the whole payment, every fill)'],
              [
                'Stream rate',
                'rate = floor(amount / 604,800) per second, +1 wei/second for the first (amount mod 604,800) seconds',
              ],
              ['Reward accrual', 'same index-and-remainder shape as revenue, per token, over Bribe virtual balances'],
              [
                'Redemption payout',
                'payout = floor(fundBalanceBefore × gbxBurned / gbxSupplyBeforeBurn), one pre-burn supply snapshot for all selected tokens',
              ],
              [
                'Harvest invariant',
                'positionLiquidityAfter = positionLiquidityBefore; contract USDG and GBX balances end at zero',
              ],
            ],
          })}
        </div>
        <div class="spread stack-2">
          <div class="col-main">
            <p class="small muted">
              Bounds fixed at deployment: auction epochs in [1 hour, 365 days]; multipliers in [1.1×, 3.0×]; configured
              prices in [10⁶, 2¹⁹²−1]; minimum contribution 10,000 raw USDG units; reward tokens ≤ 8 per Bribe; index
              precision 10¹⁸ throughout.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Verified how',
              kind: 'capital',
              body: 'The build replays the emission schedule and stream arithmetic and cross-checks the repository&rsquo;s tested fixtures before a page renders (protocol-facts.mjs).',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'app-lifecycles',
    runner: 'Appendix C · Lifecycles',
    section: { title: 'Appendix C: Lifecycle summaries', note: 'State machines in table form', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix C',
          title: 'Lifecycle summaries',
          deck: 'Each mechanism&rsquo;s states and transitions, compressed to one row each.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            head: ['Lifecycle', 'Path'],
            rows: [
              [
                'Fundraiser epoch',
                'open (day t) → ended → settled in strict order (anyone, batched) → claims minted per account, forever',
              ],
              ['Staking', 'GBX → stake → sGBX (± signals) → unstake unallocated → GBX'],
              [
                'Signal',
                'add (live Strategy only) ↔ remove (always, even after kill) → zero removes list entry via swap-and-pop',
              ],
              [
                'Revenue',
                'router → notify → carry/index → checkpoint on touch → distribute (live) or Fund liability (zero-weight, killed) → payFundRevenue',
              ],
              [
                'Auction epoch',
                'open at price P → linear decay → fill (protected) or expiry at 0 → next epoch at max(payment × m, floor)',
              ],
              [
                'Payment',
                'fill → router pulls 100% → fixed Fund liability → payFundPayment (anyone) → Fund [→ burnGBX if GBX]',
              ],
              [
                'Reward stream',
                'notify → start (signal present, none active) / queue → 7-day exact stream ± zero-supply pause → claims; empty-room carry → Fund liability',
              ],
              [
                'Redemption',
                'select unique non-GBX tokens → snapshot supply and balances → pull and burn GBX → pay each selected → all-or-nothing',
              ],
              ['LP admission', 'precommitted NFT from fixed depositor → six checks → recorded forever'],
              ['LP harvest', 'zero-liquidity decrease → principal unchanged → USDG routed, GBX burned'],
              ['Strategy life', 'created (immutable config) → live → killed (signals removable, revenue to Fund)'],
              ['Deployment', 'the figure below; every binding one-time; nothing executed to date'],
            ],
          })}
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: 'C.1',
            svg: fig2.deploymentSequence({ width: widths.full }),
            caption:
              'The intended deployment order. Unexecuted: no signed manifest exists and no script is authorized to broadcast.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'app-access',
    runner: 'Appendix D · Access control',
    section: { title: 'Appendix D: Access-control matrix', note: 'Every state-changing function', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix D',
          title: 'Access-control matrix',
          deck: 'Who may call what, what moves, and whether it can ever be undone.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            head: ['Function', 'Caller', 'Moves', 'Notes'],
            rows: [
              ['Fundraiser.contribute', 'Anyone', 'USDG → Resonance', 'Routed atomically; irreversible'],
              ['Fundraiser.claim / settleEpochs', 'Anyone', 'GBX mint / none', 'Sequential, batched'],
              ['SignalGBX.stake / unstake', 'Holder', 'GBX ↔ contract', 'Symmetric; unallocated only'],
              ['Resonance signal ops (±, ±Many)', 'Signaler', 'None', 'Accounting only; symmetric'],
              ['Resonance.notifyRevenue', 'Router only', 'USDG in', 'Binding-gated'],
              ['distribute* / sync / index / payFundRevenue', 'Anyone', 'USDG out', 'Fixed destinations'],
              [
                'addStrategy / killStrategy / addBribeReward',
                'Timelocked owner',
                'None',
                'Governed, delayed; kill permanent',
              ],
              [
                'setResonanceRouter · setResonance ×3 · setMinter',
                'Owner/deployer once',
                'None',
                'One-time; never reversible',
              ],
              ['Strategy.buy', 'Anyone', 'Payment in, lot out', 'Epoch, deadline, cap checks'],
              ['BribeRouter.routePayment / payFundPayment', 'Strategy / anyone', 'Payment → Fund', '100% liability'],
              ['Bribe.notify / claims / payFundReward', 'Anyone', 'Reward tokens', 'Claims pay entitled account only'],
              ['Bribe.addRewardToken / deposit / withdraw', 'Resonance only', 'None', 'Registration permanent, ≤ 8'],
              ['Fund.redeem / burnGBX', 'Holder / anyone', 'Burn; assets out', 'Atomic; burns forever'],
              [
                'LiquidityPosition.harvestFees / receiver hook',
                'Anyone / fixed depositor',
                'Fees out / NFT in',
                'Principal fixed; NFT never leaves',
              ],
            ],
          })}
        </div>
        <p class="small muted stack-2">
          "Timelocked owner" means reachable only through the Resonance owner after its public delay. Everything else is
          permissionless from block one. Nothing is pausable, and nothing takes a fee.
        </p>
      </div>
    `,
  },

  {
    id: 'app-invariants',
    runner: 'Appendix E · Invariants',
    section: { title: 'Appendix E: Security invariants', note: 'Plain English and identity form', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix E',
          title: 'Security invariants',
          deck: 'Statements that must hold after every valid transaction - each falsifiable by a test, and tested.',
        })}
        <div class="spread">
          <div class="col-main">
            ${table({
              className: 'table--tight',
              head: ['Plain English', 'Identity'],
              rows: [
                ['Minting never exceeds the ceiling, ever', 'lifetimeMinted ≤ 10⁹ × 10¹⁸'],
                ['Burns never reopen capacity', 'remaining = ceiling − lifetimeMinted (burns absent)'],
                ['Receipts are fully backed', 'sGBX.totalSupply = GBX held by SignalGBX'],
                ['Signals are balance-bounded', 'accountSignalWeight[a] ≤ sGBX.balanceOf(a)'],
                [
                  'Signal sums agree',
                  'Σₛ accountSignals[a][s] = accountSignalWeight[a]; Σₐ = strategySignalWeight[s]; Σₛ strategyWeight = totalSignalWeight',
                ],
                [
                  'Rewards mirror signals',
                  'Bribe(s).balanceOf(a) = accountSignals[a][s]; totalSupply = strategySignalWeight[s]',
                ],
                [
                  'Revenue is conserved',
                  'accounted × 10¹⁸ = pendingScaled + indexedScaled + Σ remainders + (claimable + fundLiability) × 10¹⁸',
                ],
                ['Rewards are conserved', 'the analogous 8-term per-token identity in every Bribe'],
                [
                  'Payments are total',
                  'BribeRouter.accountedBalance = fundPaymentLiability; no payment enters reward accounting',
                ],
                [
                  'Redemption is snapshotted and atomic',
                  'payoutⱼ = floor(balanceⱼ × burn / supplyBefore); all-or-nothing',
                ],
                ['Exits move no tokens', 'removeSignal and unstake perform no USDG or reward-token transfer'],
                [
                  'Principal is permanent',
                  'position liquidity after any harvest = before; NFT custody has no exit path',
                ],
              ],
            })}
            <p class="small muted stack-1">
              Explicitly <em>not</em> an invariant: exact temporal attribution of carry across a signal-supply change.
              That is open finding A-09, held visible by two deterministic proof-of-concept tests rather than papered
              over by the conservation identities - which all still hold.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'How they were exercised',
              kind: 'capital',
              body: '27 invariant properties × 1,000 runs × depth 500 - 13.5 million randomized calls across 22 handler actions with zero reverts - plus Medusa&rsquo;s independent 101,840-call campaign over 62 property and assertion surfaces.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'app-evidence',
    runner: 'Appendix F · Evidence record',
    section: { title: 'Appendix F: Evidence and toolchain record', note: 'For reproducers', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix F',
          title: 'Evidence and toolchain record',
          deck: 'The exact tools behind Part XI&rsquo;s numbers, and where each recorded artifact lives in the repository.',
        })}
        <div class="spread">
          <div class="col-main">
            ${table({
              className: 'table--tight',
              head: ['Tool', 'Pin', 'Disposition'],
              rows: [
                ['Foundry', '1.7.1', 'All contract campaigns; re-run for this edition'],
                ['Solidity', '0.8.26, Cancun, opt. 10,000', 'Clean compile; two known bugs reviewed inapplicable'],
                ['Hardhat / Node / pnpm', '2.29.0 / 22.23.1 / 10.14.0', 'Parity, supply, workspace gates'],
                ['Medusa', '1.5.1', 'Passed: 101,840 calls, 62/62 surfaces'],
                ['Echidna', '2.3.2 pinned; 2.3.3 fallback', 'Blocked / invalid - release blocker'],
                ['Mythril', '0.24.8', 'Fails closed on Cancun opcodes - blocker'],
                [
                  'Slither / Aderyn / Semgrep / Solhint / Gitleaks',
                  '0.11.5 / 0.6.8 / 1.162.0 / 6.0.1 / 8.30.1',
                  '186 dispositioned; 0 Semgrep; 6 matches open',
                ],
                ['Mutation framework', 'none pinned', 'No current score - release blocker'],
              ],
            })}
            <p class="small muted stack-1">
              Primary records live under <code>packages/contracts/audit/</code>: FINDINGS, TEST-CAMPAIGN,
              STATIC-ANALYSIS, MUTATION-TESTING, FORMAL-CHECKS, UNISWAP-V4-REVIEW, FORK-VALIDATION, EXTERNAL_FUZZING,
              RESIDUAL-RISKS, RELEASE-CHECKLIST. This paper quotes those records; it does not replace them.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Commits',
              kind: 'capital',
              body: `Baseline ${status.auditBaselineCommitShort}; register candidate ${status.auditCandidateCommitShort}; described head ${status.contractsCommitShort}. The head differs from the candidate by the Fundraiser increment hardening and the ADR 0022 harvest redesign, both covered by the finalized campaign.`,
            })}
            ${note({
              label: 'Environment caveats from this pass',
              body: 'Reproduction here used Foundry 1.7.1 and the pinned Node; the subgraph&rsquo;s Matchstick binary would not execute on this host (spec checks passed 4/4), and Docker-dependent gates remain blocked as recorded.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'app-residual',
    runner: 'Appendix G · Residual risks and checklist',
    section: {
      title: 'Appendix G: Residual risks and deployment checklist',
      note: 'What remains before anyone should trust this',
      numbered: false,
    },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix G',
          title: 'Residual risks and the deployment checklist',
          deck: 'The recorded list of what stays true even if everything works - and what must be verified before deployment could be responsible.',
        })}
        <div class="spread">
          <div class="col-main">
            <h3>Standing residual risks</h3>
            ${table({
              className: 'table--tight',
              rows: [
                [
                  'Unpaid maintenance',
                  'Harvests, settlements, distributions, and burns wait for volunteers; realization timing is uncontrolled',
                ],
                [
                  'Harvest-time allocation',
                  'Routed lumps follow the signal weights of that moment; signaling has no cooldown',
                ],
                ['A-05 by design', 'Expired auctions clear at zero and restart from the floor'],
                ['A-09 open', 'Carry can cross signal-supply boundaries; material mainly for low-decimal tokens'],
                ['Registry-free custody', 'Unsolicited and worthless tokens accumulate in the Fund indefinitely'],
                [
                  'Blocked tokens',
                  'A freezing token strands its own payouts (retryable, fixed-destination) but never anyone&rsquo;s exit',
                ],
                ['Donations', 'Direct transfers to any core contract are visible but have no recovery path'],
              ],
            })}
            <h3 class="stack-2">Deployment verification checklist (condensed)</h3>
            <p class="small muted">
              Independent audit passed and findings resolved · A-09 resolved or formally accepted · mutation campaign
              with reviewed survivors · pinned Echidna and Mythril runs · six secret-scan classifications · licensing
              and provenance cleared by counsel · signed manifest proving chain ID, bytecode, constructor arguments,
              timelock roles and delay, minter lock, all one-time bindings, PoolKey, ticks, token ID, and NFT custody ·
              frontend read-only until the manifest passes. Every unchecked box is a reason not to deploy - and none
              were checked when this edition shipped.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Status in one line',
              kind: 'asset',
              body: 'Internal adversarial review completed with one open Medium finding; independent review required; deployment neither performed nor authorized.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'app-events',
    runner: 'Appendix H · Event guide',
    section: { title: 'Appendix H: Event guide', note: 'What to index, and what each emission means', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix H',
          title: 'Event guide',
          deck: 'The observable record. Every meaningful state change emits; indexers and auditors need nothing else.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight table--wrap',
            head: ['Surface', 'Events and meaning'],
            rows: [
              ['GBX supply', 'Minted, Burned, MinterSet: every supply change and the one-time handover'],
              ['Mining', 'Contributed, EpochSettled, Claimed: who paid, what settled, what minted'],
              ['Staking', 'Staked, Unstaked, ResonanceSet'],
              [
                'Signals',
                'SignalAdded, SignalRemoved - plus the Bribe&rsquo;s SignalWeightDeposited / Withdrawn mirror',
              ],
              ['Revenue', 'RevenueNotified, RevenueSynced, RevenueDistributed, FundRevenueAccrued, FundRevenuePaid'],
              [
                'Governance',
                'StrategyAdded, StrategyKilled, BribeRewardAdded, ResonanceRouterSet - the whole governed surface',
              ],
              ['Auctions', 'Purchased: buyer, receiver, epoch, lot, payment'],
              ['Settlement', 'PaymentRouted, FundPaymentAccrued, FundPaymentPaid'],
              [
                'Rewards',
                'RewardAdded, Notified, Queued, StreamStarted (with exact rate and remainder), Paused, Resumed, Paid, FundRewardAccrued, FundRewardPaid',
              ],
              ['Fund', 'Redeemed (account, receiver, burn, token count), GBXBurned'],
              ['Liquidity', 'PositionRecorded, FeesHarvested (principal, routed USDG, burned GBX)'],
            ],
          })}
        </div>
        <p class="small muted stack-2">
          The repository&rsquo;s subgraph indexes these into five entities with 36 handlers; auction fills are its one
          notable gap (readable directly from Strategy events). Presentation layers remain conveniences - the events are
          the record.
        </p>
      </div>
    `,
  },

  {
    id: 'app-glossary',
    runner: 'Appendix I · Glossary',
    section: { title: 'Appendix I: Glossary', note: 'Every term, briefly', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix I',
          title: 'Glossary',
          deck: 'Definitions as this paper uses them.',
        })}
        <div class="full qa-grid qa-grid--tight">
          ${[
            ['Basis point (bps)', 'One hundredth of one percent.'],
            ['Blockchain', 'A public ledger maintained by many computers; finalized history cannot be quietly edited.'],
            [
              'Bribe',
              'The technical name of a Strategy&rsquo;s reward contract; an open incentive pot, capped at eight tokens. Plain prose: "Strategy reward".',
            ],
            [
              'Dutch auction (reverse)',
              'A sale whose required payment falls with time; here the Strategy sells USDG and the falling number is the buyer&rsquo;s payment.',
            ],
            [
              'EIP-1153 / transient storage',
              'Cancun-era scratch storage lasting one transaction; used for O(n) duplicate detection in redemption.',
            ],
            ['Epoch', 'A fixed period: one day for mining; a configured decay window for each auction.'],
            ['ERC-20', 'The standard fungible-token interface (balances, transfers, approvals).'],
            [
              'Exact-transfer check',
              'Verifying both sides&rsquo; balance deltas equal the requested amount; anything else reverts.',
            ],
            ['Fixed-point / WAD', 'Integers scaled by 10¹⁸ to represent fractions exactly.'],
            ['Fund', 'The ownerless treasury holding acquired assets; exits are redemption and GBX burning only.'],
            ['Fundraiser', 'The public mining contract: USDG in, scheduled GBX out, pro rata per epoch.'],
            ['Gas', 'The execution fee every transaction pays the chain.'],
            ['GBX', 'The protocol token: capped lifetime mint, permit and votes extensions, redeemable, burnable.'],
            ['In-kind redemption', 'Receiving the underlying tokens themselves rather than a cash equivalent.'],
            ['Killed Strategy', 'One permanently excluded from future revenue; existing signal remains removable.'],
            [
              'Liquidity pool / LP position / tick / range',
              'A standing two-token market; a deposit into it earning fees within a chosen price range delimited by ticks.',
            ],
            ['Multisig', 'A wallet requiring several signers per action.'],
            [
              'Permit2 / EIP-2612',
              'Signature-based token approvals; production code uses EIP-2612 on its own tokens and does not depend on Permit2.',
            ],
            [
              'Reentrancy',
              'Re-entering a contract mid-execution via callback; guarded against on every token-moving entry point.',
            ],
            ['Resonance', 'The signal registry and revenue allocator; the only owned core contract.'],
            ['ResonanceRouter', 'The single fixed entrance for USDG revenue.'],
            ['Reward stream', 'A seven-day exact-rate distribution of a notified amount across signal weight.'],
            ['sGBX / SignalGBX', 'The non-transferable 1:1 staking receipt measuring signal capacity.'],
            [
              'Signal',
              'An absolute amount of sGBX pointed at one Strategy; a delta-adjustable claim on future flow direction.',
            ],
            ['Smart contract', 'A program on the chain; immutable here by construction.'],
            [
              'Stablecoin / USDG',
              'An issuer-backed token targeting $1; USDG (6 decimals) is this protocol&rsquo;s revenue asset.',
            ],
            ['Staking', 'Depositing GBX for sGBX at par; reversible for any unallocated amount.'],
            ['Strategy', 'An immutable auction contract accumulating USDG toward one configured payment token.'],
            [
              'Timelock',
              'A contract executing approved actions only after a public delay; the intended Resonance owner.',
            ],
            ['Wallet', 'The keypair you act with; its security is yours alone.'],
          ]
            .map(
              ([term, definition]) => html`
                <div class="qa">
                  <p class="qa__q">${term}</p>
                  <p class="qa__a">${definition}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    `,
  },

  {
    id: 'app-references',
    runner: 'Appendix J · References',
    section: { title: 'Appendix J: References', note: 'Primary sources only', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Appendix J',
          title: 'References',
          deck: 'Primary sources wherever they exist. Nothing security-critical in this paper rests on secondary commentary.',
        })}
        <div class="spread">
          <div class="col-main">
            ${table({
              className: 'table--tight',
              head: ['Source', 'What it grounds'],
              rows: [
                [
                  `Repository at ${status.contractsCommitShort}...`,
                  'Every contract behavior (packages/contracts/src/core)',
                ],
                ['packages/contracts/audit/', 'All evidence, findings, and blocked-gate statements'],
                ['docs/whitepaper/FACT-CHECK.md', 'The claim-by-claim verification register behind this paper'],
                ['packages/simulations/', 'Independently tested TS and Python arithmetic, cross-checked at build time'],
                [
                  '<a href="https://docs.openzeppelin.com/contracts/5.x/">OpenZeppelin 5.6.1</a>',
                  'ERC-20, Permit, Votes, ReentrancyGuard, TimelockController semantics',
                ],
                [
                  '<a href="https://docs.uniswap.org/">Uniswap v4 1.0.2 / 1.0.3 (pinned)</a>',
                  'Pool, position, and fee-collection behavior',
                ],
                [
                  '<a href="https://eips.ethereum.org/">EIP-20, EIP-712, EIP-1153, EIP-2612</a>',
                  'Token standard, typed signing, transient storage, permits',
                ],
                [
                  '<a href="https://docs.soliditylang.org/">Solidity 0.8.26 release notes</a>',
                  'Compiler semantics; the two reviewed known issues',
                ],
                ['Robinhood Chain reads (4663 @ 32,035,314)', 'EIP-1153 availability; documented v4 addresses'],
                ['USDG issuer documentation', 'Stablecoin properties and issuer powers, as external assumptions'],
                ['NOTICE; LEGAL-PROVENANCE-BLOCKER', 'Upstream lineage and the unresolved licensing record'],
                ['ADRs 0013-0022', 'Design history, including ADR 0021 settlement and ADR 0022 harvesting'],
              ],
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'Citation style',
              body: 'The prose avoids per-sentence footnotes by design; every quantitative claim routes through the fact-check register, which cites file-level sources.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'disclosure',
    runner: 'Legal and risk disclosure',
    section: { title: 'Legal and risk disclosure', note: 'Read in full', numbered: false },
    render: () => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Disclosure',
          title: 'Legal and risk disclosure',
          deck: 'Plain language, complete, and binding on how this document may be read.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              <strong>GumBall6900 is experimental software.</strong> This whitepaper explains it; it promises nothing.
              It is not an offer, solicitation, or recommendation of any asset or activity, and it is not legal, tax,
              investment, accounting, or financial advice. No one should contribute, stake, signal, trade, or redeem
              anything solely because of this document.
            </p>
            <p>
              <strong>Nothing is guaranteed.</strong> GBX is not a stablecoin and is not represented as tracking the
              Fund's value. Public mining does not guarantee profit. Signaling does not guarantee rewards. Auctions may
              settle unfavorably, at zero, or not at all. Fund assets - including any tokenized-stock wrappers - may
              freeze, fail, become illiquid, lose value, or become legally restricted, and such wrappers do not confer
              the rights of directly registered shares. Supplemental reward tokens can fail independently.
              Smart-contract testing and internal review reduce risk; they do not eliminate it, and the contracts cannot
              be patched after deployment.
            </p>
            <p>
              <strong>Law applies and varies.</strong> Securities, collective-investment, commodities,
              money-transmission, stablecoin, sanctions, tax, and consumer-protection regimes may each apply to some or
              all of this design, differently by jurisdiction. No legal review of this protocol has been performed; the
              repository's own licensing and provenance remain unresolved and are recorded as distribution blockers.
              Anyone considering interaction with any future deployment should obtain their own professional advice.
            </p>
            <p>
              <strong>Status, restated.</strong> Not deployed. Not audited externally. One internal Medium finding open.
              Not authorized for user funds. The authors may abandon, change, or restart the project, and this document
              may become stale the day after it is built.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'If you remember one thing',
              kind: 'asset',
              body: 'This paper is a description of code, not an invitation to fund it. Treat every hopeful sentence in it as conditional on reviews that have not happened yet.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'colophon',
    deep: true,
    runner: 'Document basis',
    section: { title: 'Document basis', note: 'Sources, build, and provenance', numbered: false },
    render: () => html`
      <div class="frame">
        <p class="eyebrow" style="color:${palette.blueBright};">Document basis</p>
        <h1 class="section-title" style="font-size:22pt; line-height:26pt;">
          If this paper and deployed bytecode<br />ever disagree, the bytecode wins.
        </h1>
        <div class="rule" style="background:${palette.deepRule};"></div>
        <div class="spread stack-1">
          <div class="col-main">
            <p style="color:${palette.onDeepMuted};">
              This edition describes the production contracts at commit
              <code style="color:${palette.onDeep};">${status.contractsCommitShort}</code> of the GumBall6900
              repository, reviewed internally against candidate
              <code style="color:${palette.onDeep};">${status.auditCandidateCommitShort}</code>. Canonical prose lives
              in <code style="color:${palette.onDeep};">docs/WHITEPAPER.md</code>; this typeset edition is generated
              reproducibly from <code style="color:${palette.onDeep};">docs/whitepaper/</code> by
              <code style="color:${palette.onDeep};">pnpm docs:whitepaper</code>, which verifies protocol facts against
              contract constants and tested simulation fixtures, audits layout and contrast, and refuses to publish over
              a good PDF on any failure.
            </p>
            <p style="color:${palette.onDeepMuted};">
              Charts are computed at build time; the worked example is computed by the same integer arithmetic the
              contracts apply; and the claim-by-claim record - including every place this paper's brief differed from
              the final implementation - is
              <code style="color:${palette.onDeep};">docs/whitepaper/FACT-CHECK.md</code>.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Brand and type',
              kind: 'capital',
              body: 'Brand palette: pink, blue, black, white. The display face Modak is vendored under the SIL Open Font License; body, heading, and mono faces resolve from the build machine and are embedded by the printer.',
            })}
          </div>
        </div>

        <div style="position:absolute; bottom:0; left:0; right:0;">
          <div class="rule" style="background:${palette.deepRule}; margin-bottom:6mm;"></div>
          <div class="kpi-row">
            <div>
              <div class="kpi__label">Edition</div>
              <p class="note" style="color:${palette.onDeepMuted}; margin-top:1.6mm;">
                ${meta.version} · ${meta.date} · by ${meta.author}
              </p>
            </div>
            <div>
              <div class="kpi__label">Status</div>
              <p class="note" style="color:${palette.onDeepMuted}; margin-top:1.6mm;">
                Internal review only. Not audited. Not deployed. Not authorized for user funds.
              </p>
            </div>
            <div>
              <div class="kpi__label">Disclosure</div>
              <p class="note" style="color:${palette.onDeepMuted}; margin-top:1.6mm;">
                Explanatory document only. Not investment, legal, or tax advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    `,
  },
];
