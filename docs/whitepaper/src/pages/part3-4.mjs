/**
 * Part III - Public GBX mining. Part IV - Staking and signaling.
 */

import * as fig from '../figures.mjs';
import * as fig2 from '../figures2.mjs';
import { widths } from '../svg.mjs';
import { html, sectionHead, note, figureBlock, formula, table, ledger } from '../page-kit.mjs';
import { contractConstants, schedule } from '../protocol-facts.mjs';
import { fmtGBX, fmtUSDG, worked } from '../worked.mjs';

const n = (context, id) => context.sectionNumber(id);

export const part3Pages = [
  {
    id: 'mining-meaning',
    runner: 'What mining means here',
    group: 'Part III · Public GBX mining',
    section: { title: 'What "mining" means here', note: 'Contribution, not computation' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part III · Public GBX mining',
          number: n(context, 'mining-meaning'),
          title: 'What "mining" means here',
          deck: 'Mining is contributing USDG through the Fundraiser and receiving a pro-rata share of that day&rsquo;s fixed GBX emission. No hardware, no puzzles.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              Each day is an <strong>epoch</strong>. The contract publishes, in advance and forever, how much GBX each
              epoch emits. Everyone who contributes USDG during an epoch splits that epoch's emission in proportion to
              what they contributed - a thousand USDG among forty thousand earns exactly one fortieth of the day. The
              smallest accepted contribution is 10,000 raw USDG units, which is one cent at USDG's six decimals.
            </p>
            <p>
              Contributions are working capital from the first block: the USDG moves straight through the router into
              Resonance in the same transaction, where current signals decide which Strategies it feeds. There is no
              treasury wallet where it rests and no discretionary step between paying in and being routed.
            </p>
            <p>
              A contribution names a <strong>beneficiary</strong>, which does not have to be the payer - a service can
              mine on your behalf while the claim stays yours. Claims are per-epoch, one per account, minted directly to
              the beneficiary, and never expire once the epoch settles.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'You are not buying GBX at a price; you are buying a share of a fixed daily print run whose cost depends on who shows up beside you.',
            })}
            ${note({
              label: 'Simple example',
              kind: 'capital',
              body: 'A bakery gives away a fixed batch of bread daily, split by how much flour each person brought. Bring flour on a quiet day and you take home more bread.',
            })}
            ${note({
              label: 'What the contract enforces',
              kind: 'supply',
              body: 'The schedule, the pro-rata split, the routing, and the mint - all fixed. What it cannot enforce: that anyone shows up, or that GBX is worth anything.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          Every contributed USDG is committed to the signal-directed path - <em>never to a team wallet.</em>
        </p>
      </div>
    `,
  },

  {
    id: 'emissions',
    runner: 'The emission curve',
    section: { title: 'The daily emission curve', note: 'Halving smoothly every four years' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part III · Public GBX mining',
          number: n(context, 'emissions'),
          title: 'The daily emission curve',
          deck: 'The schedule&rsquo;s two constants are one decision: the decay is a four-year half-life, and the opening emission is derived so the schedule pays out its own allocation.',
        })}
        <div class="spread">
          <div class="col-main">
            ${formula({
              label: 'The schedule funds itself',
              body: 'E₀ = A × (1 − d),&nbsp;&nbsp;so&nbsp;&nbsp;∑<sub>t≥0</sub> E₀·d<sup>t</sup> = A',
              where: `A = ${fmtGBX(contractConstants.fundraiser.distributionAllocation, 0)} GBX mining allocation · d = 0.999525354337060160 per day (the 1,460-day half-life factor) · E₀ = ${fmtGBX(contractConstants.fundraiser.initialDailyEmission, 18)} GBX. In ideal real-number arithmetic the infinite series sums to the allocation exactly.`,
            })}
            <p class="stack-1">
              Day one emits about 465,153 GBX. Four years in, the daily emission is half that; eight years in, a
              quarter. Each four-year period closes half the remaining distance to the allocation: roughly 50% emitted
              by year four, 75% by year eight, 93.75% by year sixteen. Front-loading is deliberate - early participation
              carries the most weight - but the tail is long enough that mining never has a cliff.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why a half-life',
              kind: 'capital',
              body: 'A geometric decay needs no schedule table, no governance dial, and no end-date decision - one multiplier per day does all of it.',
            })}
            ${note({
              label: 'For GBX miners',
              body: 'The curve is common knowledge, so your edge is never information about supply - only your read on demand and participation.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('emissions'),
            svg: fig.emissionChart({ width: widths.full }),
            caption:
              'The ideal curve. Cumulative emission approaches - never exceeds - the 980 million allocation, halving its remaining distance every four years. The next chapter shows where the real integer schedule departs from this ideal.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'integer-schedule',
    runner: 'Ideal curve versus integer schedule',
    section: { title: 'The ideal curve versus the integer schedule', note: 'Where the arithmetic actually ends' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part III · Public GBX mining',
          number: n(context, 'integer-schedule'),
          title: 'The ideal curve versus the integer schedule',
          deck: 'Contracts do not compute with real numbers. The onchain schedule floors after every daily step - and that changes the ending.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              The contract stores each day's emission as a whole number of wei (10<sup>-18</sup> GBX) and computes the
              next day as <code>floor(current × d / 10¹⁸)</code>, one sequential floor per day. Each floor discards a
              fraction of a wei, so the integer schedule runs slightly below the ideal curve - and unlike the ideal
              curve, it terminates. Replaying all of it, in two independent implementations cross-checked against the
              repository's tested fixture, gives exact endpoints:
            </p>
            ${table({
              head: ['Fact', 'Exact value'],
              rows: [
                ['First emission (epoch 0)', `${fmtGBX(contractConstants.fundraiser.initialDailyEmission, 18)} GBX`],
                ['Decay factor per day', '0.999525354337060160'],
                ['Nominal half-life', '1,460 days (four years)'],
                [
                  'Nonzero epochs',
                  `${schedule.nonzeroEpochs.toLocaleString('en-US')} (the last is epoch index ${schedule.lastNonzeroEpochIndex.toLocaleString('en-US')}, about 273 years in)`,
                ],
                ['Final nonzero emission', 'exactly 1 wei'],
                ['Total if every epoch is claimed', `${fmtGBX(schedule.cumulativeEmitted, 18)} GBX`],
                [
                  'Unminted rounding remainder',
                  `${schedule.unmintedRemainder.toLocaleString('en-US')} wei ≈ 0.0000008 GBX`,
                ],
              ],
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'Why be this precise',
              body: 'Earlier drafts ascribed the ideal curve&rsquo;s endlessness to the contract itself. False: the onchain schedule ends. This paper states both curves and never substitutes one for the other.',
            })}
            ${note({
              label: 'Under the hood',
              kind: 'supply',
              body: 'The remainder is a deterministic consequence of flooring, not a reserve: no address, including governance, can ever mint it.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('integer-end'),
            svg: fig2.integerScheduleEnd({ width: widths.full }),
            caption:
              'The real schedule on a log axis: a straight geometric slide from ~4.65 × 10²³ wei per day to a final single-wei epoch, then exactly zero forever.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'epoch-sharing',
    runner: 'Sharing an epoch',
    section: { title: 'Sharing an epoch, and empty epochs', note: 'Pro-rata claims and forfeited days' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part III · Public GBX mining',
          number: n(context, 'epoch-sharing'),
          title: 'Sharing an epoch, and empty epochs',
          deck: 'One formula splits each day. One rule handles a day nobody showed up for: its emission is gone.',
        })}
        <div class="spread">
          <div class="col-main">
            ${formula({
              label: 'A contributor&rsquo;s claim',
              body: 'reward = floor(contribution × epochEmission / totalEpochContributions)',
              where: `Worked: Maya contributes ${fmtUSDG(worked.maya.contribution, 0)} USDG on day 121, which is scheduled to emit ${fmtGBX(worked.epochEmission, 6)} GBX. The day closes at ${fmtUSDG(worked.totalContributions, 0)} USDG total, so her claim is floor(1,000 / 40,000 of the emission) = ${fmtGBX(worked.maya.reward, 6)} GBX.`,
            })}
            <p class="stack-1">
              Settlement is sequential and permissionless: anyone may call <code>settleEpochs(maximum)</code> to advance
              ended epochs in strict order, applying exactly one decay step per epoch, in caller-sized batches so a long
              quiet stretch never becomes an unsettleable backlog. An epoch with zero contributions settles like any
              other - except its emission is recorded as zero for contributors. It does not roll into tomorrow, it is
              not held for later, and no future contributor can ever claim it. The schedule advances on wall-clock time,
              indifferent to attendance.
            </p>
            <p>
              Note the distinction between <em>lifetime minted</em> and what this chapter implies: empty epochs and
              claim-level flooring mean actual lifetime minting can end below the schedule's own total. The ceiling is a
              maximum, not a destiny.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why forfeit, not roll over',
              kind: 'capital',
              body: 'Rollovers would make quiet stretches mint windfalls for whoever times the recovery - and would turn the clean schedule into a lottery about other people&rsquo;s absence.',
            })}
            ${note({
              label: 'For GBX miners',
              body: 'Claims never expire once settled, but nothing is minted until someone claims. Check pendingReward(epoch, account) before paying gas.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('epoch-scenarios'),
            svg: fig2.epochScenarios({ width: widths.full }),
            caption:
              'The same 1,000 USDG contribution against the same scheduled emission: quiet days pay multiples of crowded days, and an empty day pays no one at all.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'mining-market',
    runner: 'The mining market',
    section: { title: 'The mining market', note: 'What competition prices' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part III · Public GBX mining',
          number: n(context, 'mining-market'),
          title: 'The mining market',
          deck: 'The Fundraiser never sets a price. It hands a fixed daily quantity to whoever showed up - which makes the crowd itself the price.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              Because the day's emission <span class="mono">E</span> is fixed, the average cost every miner pays is
              simply <span class="mono">C / E</span> - total USDG contributed over total GBX emitted - no matter who
              contributed what. If GBX trades at price <span class="mono">P</span> with real, exit-sized liquidity, the
              day's emission is worth about <span class="mono">P × E</span>, and mining looks attractive while
              contributions sit below that. Entry then closes the gap, which gives the rough break-even benchmark
              <span class="mono">C ≈ P × E</span>. The adjustment runs both ways: a thin day is precisely the day worth
              entering.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Read the chart this way',
              kind: 'capital',
              body: 'The rising line is what miners pay on average. The dashed line is what GBX quotes at. The wedge between them attracts the next miner - and closes as they arrive.',
            })}
          </div>
        </div>
        <div class="stack-1">
          ${figureBlock({
            index: context.figure('mining'),
            svg: fig.miningMarketChart({ width: widths.full }),
            caption:
              'An illustrative day: 100,000 GBX emitted, GBX quoted at 0.50 USDG. At 20,000 USDG contributed the average cost is 0.20; competition pushes toward 50,000, where the simple spot margin is gone. Profitable entry below the line exists only before gas, slippage, and risk.',
          })}
        </div>
        <div class="stack-1">
          ${ledger({
            yesHead: 'What the contracts guarantee',
            yesItems: [
              'Every contributed USDG enters the signal-directed path, never a discretionary wallet.',
              'Miners compete for a fixed public schedule, not a team-selected sale price.',
              'Every completed Strategy payment is owed entirely to the Fund.',
            ],
            noHead: 'What no contract can guarantee',
            noItems: [
              'That a quoted GBX price survives your exit size, or that liquidity exists at all.',
              'That mining is profitable on any given day - or ever.',
              'That auctions clear, or that Fund assets hold value.',
            ],
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'mining-risk',
    runner: 'Why mining profit is not guaranteed',
    section: { title: 'Why mining profit is not guaranteed', note: 'The full cost stack' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part III · Public GBX mining',
          number: n(context, 'mining-risk'),
          title: 'Why mining profit is not guaranteed',
          deck: 'The break-even benchmark is a compass, not a promise. Between it and your outcome sit at least eight real costs.',
        })}
        <div class="spread">
          <div class="col-main">
            ${table({
              className: 'table--tight',
              head: ['Cost or risk', 'How it bites a miner'],
              rows: [
                [
                  'Late competition',
                  'Contributions arriving after yours dilute the whole day, including you - the day&rsquo;s cost is known only at midnight.',
                ],
                [
                  'Realizable price',
                  'The quoted GBX price is not your exit price. Thin liquidity means slippage; heavy selling moves the market itself.',
                ],
                [
                  'Gas',
                  'Contributing, claiming, staking, and exiting each cost transaction fees regardless of outcome.',
                ],
                [
                  'Timing',
                  'Your USDG routes to Strategies immediately, but your GBX arrives only after the epoch ends and settles.',
                ],
                ['Smart-contract risk', 'Unaudited, immutable code. An exploit or flaw can be permanent.'],
                [
                  'Stablecoin risk',
                  'USDG can depeg, freeze, or restrict transfers under its issuer&rsquo;s own rules.',
                ],
                ['Market risk', 'GBX&rsquo;s value depends on demand for the whole mechanism, not on the schedule.'],
                ['Regulatory risk', 'Token distribution programs face uncertain and jurisdiction-dependent treatment.'],
              ],
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'Important risk',
              kind: 'asset',
              body: 'The equilibrium story describes incentives, not results. Days can stay unprofitable, or profitable, far longer than any model implies - and the model is not the market.',
            })}
            ${note({
              label: 'For GBX miners',
              body: 'A disciplined check: today&rsquo;s emission, total contributed so far, quoted price, and the depth behind that quote. Then decide - knowing the day is not over.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          The contract fixes what happens <em>after</em> you contribute. Whether contributing was wise is entirely
          yours.
        </p>
      </div>
    `,
  },
];

export const part4Pages = [
  {
    id: 'staking',
    runner: 'Staking, step by step',
    group: 'Part IV · Staking and signaling',
    section: { title: 'Staking, step by step', note: 'GBX in, sGBX out, and straight back if idle' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IV · Staking and signaling',
          number: n(context, 'staking'),
          title: 'Staking, step by step',
          deck: 'The staking contract is deliberately boring: hold deposits exactly, mint receipts exactly, release instantly when nothing is allocated.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              <code>stake(amount)</code> pulls GBX with exact-transfer verification on both sides - the contract checks
              that your balance fell by precisely the requested amount and its own rose by the same - then mints equal
              sGBX. First-time stakers are self-delegated automatically so the standard checkpointing works without a
              second transaction. <code>unstake(amount)</code> runs the same choreography in reverse, guarded by a
              single condition: the amount must fit within your <em>unallocated</em> balance, your sGBX minus the sum of
              your live signals.
            </p>
            <p>
              In the worked example, Maya stakes ${fmtGBX(worked.maya.staked, 0)} GBX, allocates
              ${fmtGBX(worked.maya.toNvda, 0)} and ${fmtGBX(worked.maya.toAapl, 0)} to two Strategies, and immediately
              unstakes her idle ${fmtGBX(worked.maya.idle, 0)} - in the same block, with no notice period. Her allocated
              1,300 stays staked exactly until she removes those signals, and not a moment longer.
            </p>
            <p>
              There is no reward for staking itself, no inflation directed at stakers, and no penalty for leaving.
              Staking is a capability, not a yield product.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'Staking converts money into steering weight at par, and back again on demand for whatever is not actively steering.',
            })}
            ${note({
              label: 'Under the hood',
              kind: 'capital',
              body: 'Unstake asks Resonance for accountSignalWeight and refuses only amounts that would dip into allocated weight. No other contract can freeze or seize a staked balance.',
            })}
            ${note({
              label: 'What this does not guarantee',
              kind: 'asset',
              body: 'sGBX is exposed to GBX&rsquo;s market risk the whole time. Non-transferability protects governance, not price.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'absolute-signals',
    runner: 'Absolute signals',
    section: { title: 'Signals are absolute amounts, not percentages', note: 'Deltas, independently adjusted' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IV · Staking and signaling',
          number: n(context, 'absolute-signals'),
          title: 'Signals are absolute amounts, not percentages',
          deck: 'The contract stores "900 sGBX on NVDA" - never "60% of my account". The difference decides how everything else behaves.',
        })}
        ${figureBlock({
          index: context.figure('signal'),
          svg: fig.signalAllocation({ width: widths.full }),
          caption:
            'A live allocation across several accounts. Each bar is an absolute per-Strategy amount; a frontend may display percentages for convenience, but the chain stores amounts.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Four functions manage signals, all taking absolute sGBX amounts as <em>deltas</em>:
              <code>addSignal(strategy, amount)</code> and <code>removeSignal(strategy, amount)</code> adjust one
              Strategy; <code>addSignalMany</code> and <code>removeSignalMany</code> apply caller-chosen batches. Adding
              checks only your unallocated balance; removing checks only that Strategy's existing signal. Nothing ever
              rescales your other positions, and there is no operation - none - that resets a whole account.
            </p>
            <p>
              An earlier design used relative whole-account signals, where changing anything meant restating everything.
              It is gone, and this paper documents only the shipped model: additions and removals are independent,
              per-Strategy, and composable in any order.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why this matters',
              kind: 'capital',
              body: 'Absolute deltas make costs local: touching one Strategy never loops over your others, so gas scales with what you changed, not what you hold.',
            })}
            ${note({
              label: 'For signalers',
              body: 'To move 150 from AAPL to TSLA: removeSignal(AAPL, 150) then addSignal(TSLA, 150) - or batch both in one call. NVDA never notices.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'add-remove',
    runner: 'Adding and removing signal',
    section: { title: 'Adding and removing, worked', note: 'One trim, everything else untouched' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IV · Staking and signaling',
          number: n(context, 'add-remove'),
          title: 'Adding and removing, worked',
          deck: 'Maya trims one position by 150. Watch what changes - and the longer list of what does not.',
        })}
        ${figureBlock({
          index: context.figure('incremental'),
          svg: fig2.incrementalSignals({ width: widths.full }),
          caption:
            'removeSignal(AAPL, 150) lowers one allocation from 400 to 250 and frees 150 into the idle balance. The NVDA position, the account list, and every other account are untouched.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Every signal change also settles bookkeeping at the moment of the change: the global revenue index is
              brought current and the affected Strategy is checkpointed <em>before</em> weights move, so revenue that
              arrived under the old weights is allocated under the old weights. The Strategy's reward contract then
              mirrors the new balance. This ordering is why signal timing can never rewrite the past - a new signal
              participates only in value that arrives after it, subject to one carefully disclosed exception (the open
              A-09 finding, chapter ${n(context, 'a09')}).
            </p>
            <p>
              Batches are caller-sized: the contracts never force you to iterate anything larger than the list you
              submitted. A signal reduced to zero also drops out of your account's tracked Strategy list - detail in
              chapter ${n(context, 'signal-internals')}.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'What the contract enforces',
              kind: 'capital',
              body: 'Additions bound by unallocated balance; removals bound by the target&rsquo;s existing signal; checkpoint-before-change on every mutation; exact Bribe mirroring.',
            })}
            ${note({
              label: 'Signal timing',
              body: 'Ordering within a block still matters: a distribution and a signal change in the same block settle in transaction order, like everything else onchain.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'signals-control',
    runner: 'What signals do and do not control',
    section: { title: 'What signals control - and killed Strategies', note: 'Powers, limits, and exits' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IV · Staking and signaling',
          number: n(context, 'signals-control'),
          title: 'What signals control - and killed Strategies',
          deck: 'A signal is one lever: the share of future USDG a Strategy receives. Everything else it might seem to control, it does not.',
        })}
        <div class="spread">
          <div class="col-main">
            ${ledger({
              yesHead: 'Signals control',
              yesItems: [
                'Each live Strategy&rsquo;s share of every future USDG distribution.',
                'Your own share of that Strategy&rsquo;s independently funded rewards.',
                'Nothing else.',
              ],
              noHead: 'Signals do not control',
              noItems: [
                'Which Strategies exist (governance) or when auctions fill (buyers).',
                'Anything the Fund already holds - no sale, no rebalance, ever.',
                'Reward funding (independent notifiers) or protocol parameters (none exist).',
              ],
            })}
            <p class="stack-2">
              When governance <strong>kills</strong> a Strategy, the kill is forward-looking: the Strategy stops
              receiving future USDG, and revenue already indexed to it converts into a fixed liability owed to the Fund.
              Existing signals are never confiscated - they simply stop mattering, and their owners remove them whenever
              convenient. Adding to a killed Strategy reverts; removing from one always works, because removal makes no
              token transfer at all (the design consequence of resolved finding A-04). Even a Fund that temporarily
              rejects transfers cannot trap a signaler.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Idle sGBX and dilution',
              kind: 'capital',
              body: 'Only allocated weight is in any denominator. Idle sGBX neither earns nor dilutes - a fact worth internalizing before reading reward math.',
            })}
            ${note({
              label: 'For signalers',
              body: 'After a kill: your unrelated signals and idle balance were never at risk; remove the dead signal at leisure and re-point it live.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          Exit liveness is absolute by construction:
          <em>removing signal transfers no token, so no token can block it.</em>
        </p>
      </div>
    `,
  },

  {
    id: 'signal-internals',
    runner: 'Signal accounting under the hood',
    section: { title: 'Under the hood: signal accounting', note: 'Five numbers and a list' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IV · Staking and signaling',
          number: n(context, 'signal-internals'),
          title: 'Under the hood: signal accounting',
          deck: 'Skippable detail for reviewers: the exact state the contracts keep, and the identities the test suite holds invariant.',
        })}
        <div class="spread">
          <div class="col-main">
            ${table({
              className: 'table--tight',
              head: ['State', 'Meaning', 'Held invariant'],
              rows: [
                [
                  'accountSignals[a][s]',
                  'Account a&rsquo;s absolute signal on Strategy s',
                  'Sums over s to accountSignalWeight[a]',
                ],
                [
                  'accountSignalWeight[a]',
                  'Account a&rsquo;s total allocated weight',
                  'Never exceeds a&rsquo;s sGBX balance',
                ],
                ['strategySignalWeight[s]', 'All signal pointed at Strategy s', 'Sums over accounts to the same total'],
                ['totalSignalWeight', 'All allocated weight everywhere', 'Equals both sums; the routing denominator'],
                [
                  'accountStrategies[a]',
                  'The Strategies a currently signals',
                  'Swap-and-pop keeps it exact and duplicate-free',
                ],
                [
                  'Bribe(s) virtual balances',
                  'Mirror of accountSignals for rewards',
                  'balanceOf(a) = accountSignals[a][s]; totalSupply = strategySignalWeight[s]',
                ],
              ],
            })}
            <p class="stack-1 small muted">
              These identities were exercised by 13.5 million randomized state-machine calls with zero handler reverts
              during internal review (Part XI states the campaign precisely). They are engineering evidence, not an
              external audit.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Bribe virtual balances',
              kind: 'capital',
              body: 'Reward contracts never see tokens moving; Resonance pushes weight changes into them so reward accounting always mirrors signal accounting exactly.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('swap-pop'),
            svg: fig2.swapAndPop({ width: widths.main }),
            caption:
              'Removing a zeroed entry swaps the last list element into its slot and pops the tail - constant-time maintenance with no ordering promises.',
            className: '',
          })}
        </div>
      </div>
    `,
  },
];
