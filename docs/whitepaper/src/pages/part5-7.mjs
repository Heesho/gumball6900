/**
 * Part V - USDG revenue allocation. Part VI - Strategies and auctions.
 * Part VII - Strategy rewards.
 */

import * as fig from '../figures.mjs';
import * as fig2 from '../figures2.mjs';
import { widths } from '../svg.mjs';
import { html, sectionHead, note, figureBlock, formula, table } from '../page-kit.mjs';
import { auditEvidence, contractConstants } from '../protocol-facts.mjs';
import { fmtGBX, fmtUSDG, worked } from '../worked.mjs';

const n = (context, id) => context.sectionNumber(id);
const gas = auditEvidence.gas;

export const part5Pages = [
  {
    id: 'revenue-path',
    runner: 'The revenue path',
    group: 'Part V · USDG revenue allocation',
    section: { title: 'The revenue path', note: 'One entrance, no discretion' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part V · USDG revenue allocation',
          number: n(context, 'revenue-path'),
          title: 'The revenue path',
          deck: 'All USDG revenue - contributions and harvested liquidity fees alike - crosses one router into one allocator, which holds no opinions.',
        })}
        ${figureBlock({
          index: context.figure('routing'),
          svg: fig.routingFlow({ width: widths.full }),
          caption:
            'Ribbon thickness is proportional to live signal share. Resonance reads the distribution that exists at the moment revenue arrives and applies it - nothing more.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              <span class="term">ResonanceRouter</span> is a fixed pipe: it accepts USDG from anywhere - the Fundraiser
              forwards every contribution to it, the liquidity position routes harvested fees to it, and anyone may
              simply transfer USDG at it - and its single permissionless function pushes the whole balance into
              <span class="term">Resonance</span>. Resonance is the only contract allowed to account that revenue, and
              the router is the only address allowed to notify it. There is no second entrance, no discretionary wallet,
              and no pause between arrival and allocation.
            </p>
            <p>
              Why a separate router at all? Because it makes "all revenue takes one path" a checkable property rather
              than a habit: whatever new revenue source ever appears, it can only join by transferring to the same
              entrance every other source uses.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'Revenue in, weights read, USDG owed to Strategies - with the router existing so that sentence has no exceptions.',
            })}
            ${note({
              label: 'What the contract enforces',
              kind: 'capital',
              body: 'Exact transfer deltas at every hop, a single authorized notifier, and fail-closed accounting: a route that cannot complete reverts entirely.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'revenue-index',
    runner: 'The revenue index',
    section: { title: 'The revenue index and exact carry', note: 'How tiny amounts survive integer math' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part V · USDG revenue allocation',
          number: n(context, 'revenue-index'),
          title: 'The revenue index and exact carry',
          deck: 'Allocation is proportional to live weight - implemented as a global index with explicit remainders, so integer division never quietly deletes value.',
        })}
        <div class="spread">
          <div class="col-main">
            ${formula({
              label: 'Conceptually',
              body: 'strategyShare = revenue × strategyWeight / totalSignalWeight',
              where: `Worked: ${fmtUSDG(worked.revenueRaw, 6)} USDG arrives against weights of 45,000 / 30,000 / 15,000 sGBX. The three Strategies accrue ${fmtUSDG(worked.distribution.allocations[0].amount, 2)}, ${fmtUSDG(worked.distribution.allocations[1].amount, 2)}, and ${fmtUSDG(worked.distribution.allocations[2].amount, 2)} USDG; the sub-cent tail (${fmtUSDG(worked.distribution.carriedScaled / 10n ** 18n, 6)} USDG) stays as exact carry for the next event.`,
            })}
            <p class="stack-1">
              Technically, Resonance maintains a <strong>global revenue index</strong>: cumulative USDG per unit of
              signal weight, at 10¹⁸ fixed-point precision. New revenue raises the index; each Strategy remembers the
              index at its last checkpoint and accrues weight × index-growth when touched. Division leaves remainders at
              two levels - revenue too small to move the global index, and per-Strategy sub-unit accruals - and both are
              stored, not discarded: a global scaled carry and a per-Strategy scaled remainder. Anyone can call
              <code>indexPendingRevenue()</code> to convert accumulated carry the moment it crosses one index step.
            </p>
            <p>
              This is the resolved form of internal finding A-02: an earlier design floored per notification and could
              strand dust forever. The shipped design conserves every unit, with stateful invariant tests reconciling
              all carry classes against the contract's actual balance.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Under the hood',
              kind: 'capital',
              body: 'One identity is tested continuously: accountedBalance × 10¹⁸ = pendingScaled + indexedScaled + Σ strategyRemainders + (claimable + fundLiability) × 10¹⁸.',
            })}
            ${note({
              label: 'Why this matters',
              body: 'Dust sounds trivial until millions of small contributions make it systematic. Exact carry means the protocol&rsquo;s books always balance to the wei.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('carry'),
            svg: fig2.revenueCarry({ width: widths.full }),
            caption:
              'A 0.00005 USDG arrival cannot move the index at 90,000 sGBX of weight, so it waits - exactly - until later revenue tips the combined carry over one step.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'zero-signal',
    runner: 'Zero-signal and killed-Strategy revenue',
    section: { title: 'Zero signal, killed Strategies, and distribution', note: 'Where edge-case revenue goes' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part V · USDG revenue allocation',
          number: n(context, 'zero-signal'),
          title: 'Zero signal, killed Strategies, and distribution',
          deck: 'Revenue with no live weight to follow, and revenue indexed to a Strategy that has since been killed, both take the same fixed road: to the Fund.',
        })}
        ${figureBlock({
          index: context.figure('live-killed'),
          svg: fig2.liveVsKilled({ width: widths.full }),
          caption:
            'Live Strategies accumulate claimable revenue that anyone can distribute to them. Killed-Strategy and zero-weight revenue accrues to a fixed Fund liability that anyone can pay.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              If revenue arrives while <em>no</em> signal is allocated anywhere, there is nothing proportional to do -
              so whole units accrue to <code>fundRevenueLiability</code>, an irrevocable entitlement of the Fund that
              any caller can deliver via <code>payFundRevenue()</code>. Killing a Strategy converts its already-indexed,
              undistributed revenue the same way, and any later index growth attributable to its remaining signal weight
              follows suit. The destination is fixed in code; no key can redirect it.
            </p>
            <p>
              Moving USDG to live Strategies is equally permissionless: <code>distribute(strategy)</code>,
              <code>distributeAll()</code>, or a bounded <code>distributeRange(start, end)</code> for gas-conscious
              callers. Direct USDG donations to Resonance are also handled honestly: they sit visibly as
              <em>unaccounted revenue</em> until anyone calls <code>syncRevenue()</code>, which folds them into the same
              carry accounting as routed revenue.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'What the contract enforces',
              kind: 'capital',
              body: 'Fixed destinations, permissionless delivery, and fail-visible accounting - a balance below the books&rsquo; total reverts rather than papering over a hole.',
            })}
            ${note({
              label: 'For signalers',
              body: 'A killed Strategy&rsquo;s future is the Fund, not you. Your recourse is simply to re-point weight at Strategies you still believe in.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'a09',
    runner: 'The open A-09 boundary',
    section: { title: 'The open finding: carry across weight changes', note: 'A-09, disclosed in full' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part V · USDG revenue allocation',
          number: n(context, 'a09'),
          title: 'The open finding: carry across weight changes',
          deck: 'Internal review left one Medium finding open, and it lives here. This page is its complete, undiluted disclosure.',
        })}
        ${figureBlock({
          index: context.figure('a09'),
          svg: fig2.carryBoundary({ width: widths.full }),
          caption:
            'Conservation and attribution are different properties. The books always balance; who the balance belongs to across a weight change is the open question.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Carried value - both revenue carry in Resonance and reward carry in the Bribes - waits below index
              resolution until enough accumulates, then divides by the signal weight that exists
              <em>at that moment</em>. If weight changed between arrival and indexing, later entrants share value that
              predates them. Two deterministic proof-of-concept tests in the repository demonstrate exactly this: a
              Strategy signaled after 99 base units arrived can capture 100 of the eventual 200, and a signaler entering
              mid-carry can claim more than their pro-rata share of post-entry emission.
            </p>
            <p>
              The bound is strict and small in most cases: less than <code>totalSignalWeight / 10¹⁸</code> base units
              per bucket - immaterial for 18-decimal tokens, but up to about 1,000 whole tokens for a 6-decimal token
              (USDG included) at the one-billion-sGBX extreme. Because signaling has no cooldown, the timing is
              permissionless and could be flash-assisted. No custody, solvency, or exit property is affected; this is an
              allocation-fairness defect, not a loss of funds.
            </p>
            <p>
              It remains open because every exact fix - historical buckets, a dust destination on weight change, or
              explicit acceptance with decimal limits - changes storage, exit bounds, or economic policy, and that is an
              owner and independent-reviewer decision, not an engineering patch. Until resolved, this paper treats A-09
              as a standing caveat on every proportional-allocation claim it makes.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Important risk',
              kind: 'asset',
              body: 'Open finding A-09 (Medium): pending carry can be temporally reallocated across signal changes. Worst case grows with signal supply and shrinking token decimals.',
            })}
            ${note({
              label: 'Why disclose this hard',
              body: 'A paper that only lists resolved findings is marketing. The one still open is precisely the one a prospective user deserves to see first.',
            })}
          </div>
        </div>
      </div>
    `,
  },
];

export const part6Pages = [
  {
    id: 'strategy-what',
    runner: 'What a Strategy is',
    group: 'Part VI · Strategies and auctions',
    section: { title: 'What a Strategy is - and which way the auction points', note: 'The seller of USDG' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VI · Strategies and auctions',
          number: n(context, 'strategy-what'),
          title: 'What a Strategy is - and which way the auction points',
          deck: 'A Strategy is a small immutable contract that accumulates USDG and sells it. Getting the direction right unlocks every other chapter in this part.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              Each Strategy is created by governance with one immutable configuration: the
              <strong>payment token</strong>
              it wants (a tokenized stock wrapper, GBX itself, or any standard ERC-20), an opening price, an epoch
              length, a price multiplier, and a floor for future openings. From then on it does one thing: receive
              signal-directed USDG from Resonance and run a permanent sequence of auctions.
            </p>
            <p>
              State the direction plainly, because intuition inverts it: <strong>the Strategy is the seller</strong>. It
              offers its entire current USDG balance as one lot. An external buyer - Noor, in our example - pays the
              required amount of the payment token and takes the USDG. The protocol ends up holding the payment token;
              the buyer ends up holding stablecoins. The Strategy never goes shopping on an exchange, never reads a
              price feed, and never decides a price is fair - the buyer's willingness is the price discovery.
            </p>
            <p>
              A Strategy whose payment token is GBX is the buyback-style configuration: buyers pay GBX for the USDG lot,
              and that GBX becomes Fund property destined for burning (chapter ${n(context, 'settlement')}).
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'A Strategy is a standing offer: "my USDG for your asset, on a price path that only moves down until someone says yes."',
            })}
            ${note({
              label: 'Simple example',
              kind: 'capital',
              body: 'A vending machine in reverse: it holds cash, displays the number of tokens it wants for that cash, and lowers the ask every hour until a passerby accepts.',
            })}
            ${note({
              label: 'Bounded by construction',
              kind: 'supply',
              body: 'Epoch length is fixed between 1 hour and 365 days; the multiplier between 1.1x and 3.0x; configured prices between 10⁶ and 2¹⁹²−1 raw units.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          The buyer brings the asset. The Strategy hands over the stablecoins.
          <em>Both legs settle in one transaction.</em>
        </p>
      </div>
    `,
  },

  {
    id: 'dutch',
    runner: 'The reverse Dutch auction',
    section: { title: 'The reverse Dutch auction, in plain English', note: 'A clock instead of an oracle' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VI · Strategies and auctions',
          number: n(context, 'dutch'),
          title: 'The reverse Dutch auction, in plain English',
          deck: 'A Dutch auction starts high and falls until someone accepts. Here the falling number is what the buyer must pay for the Strategy&rsquo;s whole USDG lot.',
        })}
        <div class="spread">
          <div class="col-main">
            ${formula({
              label: 'The required payment during an epoch',
              body: 'payment(t) = initial − floor(initial × elapsed / duration)',
              where: `Worked: the NVDA-linked Strategy opens an epoch asking 60 wrapper units for its lot. Seventeen hours into a 24-hour epoch, the ask has fallen to ${fmtGBX(worked.auction.noorPayment, 1)} units - the moment Noor decides that is cheap enough for ${fmtUSDG(worked.auction.nvdaLot, 2)} USDG, and fills.`,
            })}
            <p class="stack-1">
              After a fill at payment <em>p</em>, the next epoch opens at <em>p × multiplier</em> (2.0x in the example:
              the next open is ${fmtGBX(worked.auction.nextOpen, 0)} units), floored at the configured minimum. That
              ratchet is the whole pricing mechanism: fills that come early say the ask was too generous and push the
              next opening up; fills that come late, or not at all, walk it down. Across epochs the sequence hunts the
              market's actual valuation and re-tests it forever - with no oracle anywhere.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why no oracle',
              kind: 'capital',
              body: 'An oracle is a trusted reporter of prices, and trusted reporters get corrupted, censored, or simply wrong at the worst time. A clock cannot be bribed.',
            })}
            ${note({
              label: 'What this does not guarantee',
              kind: 'asset',
              body: 'Oraclelessness removes a dependency, not market risk: thin participation or bad parameters still produce late, unfavorable, or missing fills.',
            })}
          </div>
        </div>
        <div class="stack-1">
          ${figureBlock({
            index: context.figure('auction'),
            svg: fig.auctionChart({ width: widths.full }),
            caption:
              'Left: within an epoch the required payment decays linearly to zero; a rational buyer fills when it crosses their own valuation of the lot. Right: across epochs, each fill re-opens higher by the bounded multiplier, so the sequence tracks a moving market price from below.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'lot-pricing',
    runner: 'Complete-lot pricing',
    section: { title: 'Complete-lot pricing', note: 'The clock prices the lot, not the token' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VI · Strategies and auctions',
          number: n(context, 'lot-pricing'),
          title: 'Complete-lot pricing',
          deck: 'currentPrice() quotes one number for the entire USDG balance - however large that balance has become since the epoch opened.',
        })}
        ${figureBlock({
          index: context.figure('lot'),
          svg: fig2.lotPricing({ width: widths.full }),
          caption:
            'The payment follows only the clock. USDG entering mid-epoch enlarges the lot without repricing it, so the effective per-USDG rate depends on the deposit path - not just the fill time.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              This is a genuine subtlety, stated without varnish: the auction quote is <em>not</em> a per-USDG price. A
              buyer watching an epoch is watching two numbers move independently - the required payment falling with
              time, and the lot growing with each distribution that lands mid-epoch. More USDG arriving makes the
              standing ask a better deal per unit; the mechanism deliberately does not reprice, because repricing on
              deposits would let depositors manipulate fills.
            </p>
            <p>
              For buyers this cuts both ways. A fill just after a large distribution is the bargain case. But the
              reverse also holds: capital routed into a Strategy late in a nearly expired epoch is briefly exposed to
              being sold very cheaply - the zero-price page next makes that concrete.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'For auction buyers',
              body: 'Evaluate lot ÷ payment, not payment alone - and remember the lot can still grow between your simulation and your inclusion.',
            })}
            ${note({
              label: 'Why this matters',
              kind: 'capital',
              body: 'Path-dependence in the effective rate is the honest cost of refusing oracles and repricing hooks. The paper states it rather than rounding it away.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'zero-price',
    runner: 'Zero-price fills',
    section: { title: 'Zero-price fills and the floor restart', note: 'Accepted behavior A-05, disclosed' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VI · Strategies and auctions',
          number: n(context, 'zero-price'),
          title: 'Zero-price fills and the floor restart',
          deck: 'If nobody fills before the epoch expires, the required payment is zero - and a fill at zero is valid. This is deliberate, and it has teeth.',
        })}
        ${figureBlock({
          index: context.figure('zero-price'),
          svg: fig2.zeroPriceTimeline({ width: widths.full }),
          caption:
            'An unfilled epoch decays to zero; the lot can then be taken for nothing. The next epoch restarts at the configured minimumPrice and recovers only geometrically, fill by fill.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              At or past expiry, <code>currentPrice()</code> returns zero and <code>buy()</code> transfers the whole lot
              while collecting nothing. An acquisition Strategy gives its USDG away and receives no target token; a
              GBX-payment Strategy gives its USDG away and burns nothing. The next epoch then opens at
              <code>minimumPrice</code> - a restart floor, <em>not</em> a fill-time floor - and climbs back only by the
              multiplier, one fill at a time. In the worked configuration the restart is
              ${worked.auction.floorRestart.toLocaleString('en-US')} raw units, essentially a fresh start from nothing.
            </p>
            <p>
              Why tolerate this? Because the alternatives are worse: a fill-time floor needs someone to set the right
              floor (an oracle in disguise), and refusing zero fills leaves dead Strategies holding stranded USDG
              forever. The design accepts a sharply visible failure mode - free money for whoever notices - as the cost
              of unstoppable, oracle-free liquidation. Internal review records this as accepted behavior A-05, with two
              regression tests documenting the collapse and the geometric recovery.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Important risk',
              kind: 'asset',
              body: 'USDG routed to an ignored Strategy can be lost to a zero fill. Signalers direct capital at auctions they believe buyers will attend - that belief is part of the signal.',
            })}
            ${note({
              label: 'For auction buyers',
              body: 'Watching for expiring epochs is legitimate: the mechanism explicitly pays whoever shows up. Your competition is every other watcher.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'settlement',
    runner: 'Buyer protections and settlement',
    section: { title: 'Buyer protections and settlement', note: '100% Fund-bound, always' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VI · Strategies and auctions',
          number: n(context, 'settlement'),
          title: 'Buyer protections and settlement',
          deck: 'Three parameters protect every fill. One rule settles every payment: all of it belongs to the Fund.',
        })}
        ${figureBlock({
          index: context.figure('settlement'),
          svg: fig2.paymentSettlement({ width: widths.full }),
          caption:
            'The paired router pulls the complete payment and records it as a fixed Fund liability that anyone may deliver. No share is split off anywhere - reward funding is a separate, voluntary act.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              A buyer calls <code>buy(receiver, expectedEpochId, deadline, maximumPayment)</code>. The epoch check
              defeats being front-run into a different auction round; the deadline bounds how long a signed transaction
              stays valid; the payment cap is slippage protection against the lot being filled and re-opened higher
              mid-flight. Payment collection and lot delivery verify exact balance deltas on both legs.
            </p>
            <p>
              Settlement is deliberately indirect: the Strategy pushes the payment into its paired
              <span class="term">BribeRouter</span>, which records 100% of it as a fixed liability owed to the Fund.
              Anyone may call <code>payFundPayment()</code> to deliver it. The indirection preserves liveness - if the
              payment token temporarily rejects the Fund, auctions keep clearing and the entitlement waits, retryable,
              at its fixed destination. For GBX payments, delivery leaves supply untouched; the burn is a separate
              permissionless <code>Fund.burnGBX()</code> call, and doing it before redemptions keeps Fund-held GBX out
              of the redemption denominator.
            </p>
            <p class="small muted">
              An earlier design split payments ninety-to-ten with an adjustable reward share; ADR 0021 removed the split
              entirely. This paper documents only the shipped rule: the Fund receives everything, every time.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'What the contract enforces',
              kind: 'capital',
              body: 'Epoch, deadline, and cap checks; exact-transfer verification; 100% liability recording; fixed destinations no key can redirect.',
            })}
            ${note({
              label: 'For GBX holders',
              kind: 'supply',
              body: 'A GBX-payment fill is supply-neutral until someone burns. The burn call is free to make and benefits every remaining holder.',
            })}
          </div>
        </div>
      </div>
    `,
  },
];

export const part7Pages = [
  {
    id: 'bribe-what',
    runner: 'What a Bribe is',
    group: 'Part VII · Strategy rewards',
    section: { title: 'Strategy rewards, and the word "Bribe"', note: 'Optional, external, never automatic' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VII · Strategy rewards',
          number: n(context, 'bribe-what'),
          title: 'Strategy rewards, and the word "Bribe"',
          deck: 'Each Strategy has a companion contract that can stream tokens to its signalers. Everything about it is optional except its bounds.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              The contract is named <span class="term">Bribe</span> - a technical term inherited from established
              onchain voting-incentive systems, where third parties openly attach rewards to particular choices. It
              denotes a transparent, permissionless incentive contract, not an unlawful offchain payment; this paper
              says <strong>Strategy reward</strong> in prose and uses the contract name only where precision needs it.
              Whether to rename the contract remains an open product decision recorded in the internal review.
            </p>
            <p>
              What it does: hold up to eight registered reward tokens and stream deposited amounts across the Strategy's
              signalers in proportion to their signal weight over time. Who funds it: anyone, voluntarily - an asset
              community that wants accumulation pointed its way, a partner, the curious. What never funds it: auction
              proceeds. Since ADR 0021 there is no settlement split, no reward percentage, and no fee of any kind; a
              Strategy's payments belong entirely to the Fund, and its rewards exist only if someone chooses to supply
              them.
            </p>
            <p>
              Signaling therefore never guarantees a reward. It guarantees exactly one thing: if rewards are funded,
              they accrue to the signal weight actually present, and to nothing else.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'A Strategy reward is a tip jar with rules: anyone may fill it, only that Strategy&rsquo;s signalers can be paid from it, and it holds at most eight kinds of token.',
            })}
            ${note({
              label: 'Why rewards exist at all',
              kind: 'capital',
              body: 'They let outsiders bid for the fund&rsquo;s attention in the open, on the same rails, instead of through private arrangements nobody can see.',
            })}
            ${note({
              label: 'What this does not guarantee',
              kind: 'asset',
              body: 'Any yield. An unfunded reward contract pays nothing forever, and most may stay unfunded.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'eight-cap',
    runner: 'The eight-token cap',
    section: {
      title: 'Canonical and supplemental tokens, capped at eight',
      note: 'One automatic slot, seven optional',
    },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VII · Strategy rewards',
          number: n(context, 'eight-cap'),
          title: 'Canonical and supplemental tokens, capped at eight',
          deck: 'Registration is governance-gated and append-only; funding is permissionless; and the list can never exceed eight entries.',
        })}
        ${figureBlock({
          index: context.figure('eight'),
          svg: fig2.rewardTokens({ width: widths.full }),
          caption:
            'Slot one is filled automatically at Strategy creation with the payment token. Governance may register up to seven supplemental tokens; the ninth registration reverts, and the cap is immutable bytecode.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              When governance creates a Strategy, the new reward contract automatically registers the Strategy's payment
              token as its first - <em>canonical</em> - reward token. That registration is bookkeeping, not funding: it
              merely makes the token eligible for streams. Governance can register further <em>supplemental</em> tokens
              through the timelock, each subject to the same rule: at most ${contractConstants.bribe.maxRewardTokens}
              tokens per reward contract, ever, with no removal and no cap-raising power anywhere.
            </p>
            <p>
              Two misconceptions are worth killing early. First, a supplemental token is not something the Strategy
              acquires - it is just an extra currency its tip jar accepts. Second, registration by governance does not
              mean funding by governance: <code>notifyRewardAmount</code> is open to any address holding the token.
            </p>
            <p>
              Why cap at eight? Every mandatory reward loop - signal entry, signal exit, the all-token claim - walks the
              registered list. The cap turns those walks into a bounded cost with a measured worst case (next pages)
              instead of an unbounded liability that a hostile registration could inflate.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'What the contract enforces',
              kind: 'capital',
              body: 'Append-only registration through Resonance only; RewardTokenLimitReached at nine; permissionless funding of any registered token.',
            })}
            ${note({
              label: 'For reward claimants',
              body: 'The token list is public per Strategy. Anything not on it can never be streamed there - no matter what a frontend claims.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'streams',
    runner: 'Reward streams, exactly',
    section: { title: 'Reward streams, exactly', note: 'Seven days, exact remainders, honest pauses' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VII · Strategy rewards',
          number: n(context, 'streams'),
          title: 'Reward streams, exactly',
          deck: 'A notification starts a seven-day stream - or queues behind one - and every wei of it is eventually attributable, by construction.',
        })}
        ${figureBlock({
          index: context.figure('stream'),
          svg: fig2.rewardStream({ width: widths.full }),
          caption:
            'Three honest behaviors: exact rates with the division remainder emitted first; queuing that never dilutes a live stream; and zero-supply pausing that stops the clock rather than burning the rewards.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Depositing amount <em>A</em> starts a stream of <code>floor(A / 604,800)</code> per second for seven days,
              with the integer remainder emitted one extra wei per second over the stream's earliest seconds - so the
              schedule sums to <em>A</em> exactly. Worked: ${fmtGBX(worked.rewards.canonicalNotified, 0)} wrapper tokens
              stream at ${worked.rewards.canonicalStream.rate.toLocaleString('en-US')} wei per second, with the first
              ${worked.rewards.canonicalStream.remainderSeconds.toLocaleString('en-US')} seconds emitting one wei more.
            </p>
            <p>
              A notification during a live stream <strong>queues</strong> - it never restarts or extends the active
              stream, which blocks the classic griefing pattern of resetting a stream with dust. If every signaler exits
              mid-stream, the stream <strong>pauses</strong>: the clock stops, nothing is emitted to an empty room, and
              the finish line moves out by exactly the paused duration when signal returns. Sub-unit accruals are
              carried per user with the same exactness the revenue index uses; unattributable carry left behind when the
              room empties becomes - like everything unattributable in this system - a fixed Fund liability.
            </p>
            <p class="small muted">
              This is the resolved form of finding A-03; the temporal caveat of open finding A-09 (chapter
              ${n(context, 'a09')}) applies to reward carry exactly as it does to revenue carry.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Under the hood',
              kind: 'capital',
              body: 'Per token: an 8-term conservation identity reconciles scheduled, queued, pending, indexed, per-user carry, accrued liability, and Fund-bound amounts against the held balance.',
            })}
            ${note({
              label: 'Reward-per-weight',
              body: 'Accrual is signal-weight × time: half the weight for the full week earns half the stream, all the weight for half the week earns half the stream.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'claims-gas',
    runner: 'Claims and the cost of eight',
    section: { title: 'Selective claims, and the cost of eight', note: 'Isolation by choice; gas by measurement' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VII · Strategy rewards',
          number: n(context, 'claims-gas'),
          title: 'Selective claims, and the cost of eight',
          deck: 'Claim one token, a chosen set, or everything. The cap keeps the worst case bounded - and measured.',
        })}
        ${figureBlock({
          index: context.figure('selective'),
          svg: fig2.selectiveClaims({ width: widths.full }),
          caption:
            'A frozen or malicious registered token can block only claims that include it. Scalar and caller-selected claims route around it; omitted rewards remain claimable later.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Anyone may trigger a claim, but payment reaches only the entitled account - claiming is a favor anyone can
              do you, not a theft vector. The convenience path that touches all registered tokens can be blocked by one
              broken token; the selective paths exist precisely so that never matters.
            </p>
            ${table({
              className: 'table--tight',
              head: ['Measured path (8 registered tokens)', 'Gas'],
              rows: [
                ['addSignal', gas.addSignalEightTokens.toLocaleString('en-US')],
                ['removeSignal (worst-case exit)', gas.removeSignalEightTokens.toLocaleString('en-US')],
                ['Claim one selected token', gas.claimOneToken.toLocaleString('en-US')],
                ['Selective eight-token claim', gas.claimEightSelective.toLocaleString('en-US')],
                ['All-token convenience claim', gas.claimAllConvenience.toLocaleString('en-US')],
                ['Strategy.buy', gas.strategyBuyEightTokens.toLocaleString('en-US')],
                [
                  'addSignal / removeSignal at one token',
                  `${gas.addSignalOneToken.toLocaleString('en-US')} / ${gas.removeSignalOneToken.toLocaleString('en-US')}`,
                ],
              ],
            })}
            <p class="small muted stack-1">
              Recorded with Foundry 1.7.1, solc 0.8.26, optimizer 10,000 during internal review. Work grows roughly
              linearly per registered token (about 15.5k gas per token on entry, 160.5k on exit); the cap converts that
              slope into a ceiling - the largest required user exit stays under 1.35 million gas, comfortable margin
              against the documented 60-million-gas block limit. This is the "cost retained" half of finding A-08:
              bounded and priced, not free.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'For reward claimants',
              body: 'Default to selective claims. They cost little more than the convenience path and are immune to any one token&rsquo;s misbehavior.',
            })}
            ${note({
              label: 'Broken-token isolation',
              kind: 'asset',
              body: 'A failing reward token strands only its own payouts - and even those stay retryable once the token recovers. Signal exit never touches reward tokens at all.',
            })}
          </div>
        </div>
      </div>
    `,
  },
];
