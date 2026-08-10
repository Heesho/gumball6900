/**
 * Part XIII - Frequently asked questions. Part XIV - Conclusion.
 */

import * as fig2 from '../figures2.mjs';
import { widths } from '../svg.mjs';
import { html, sectionHead, note, figureBlock, qa, table } from '../page-kit.mjs';

const n = (context, id) => context.sectionNumber(id);

const faq1 = [
  {
    q: 'Is GumBall6900 a traditional index fund?',
    a: 'No. There is no methodology, no committee, no rebalancing, and no NAV. It is a mechanism for forming a basket over time out of signal-directed purchases.',
  },
  {
    q: 'Is GBX pegged to the Fund&rsquo;s value?',
    a: 'No. Nothing computes or defends a price. GBX&rsquo;s redemption right is a pro-rata in-kind claim on selected Fund balances - whatever those happen to be worth.',
  },
  {
    q: 'Does the Fund have a fixed target basket?',
    a: 'No. Composition is the accumulated history of past acquisitions plus anything sent to it, minus redemptions. It never snaps to current preferences.',
  },
  {
    q: 'Who chooses future acquisitions?',
    a: 'sGBX signalers, continuously, within the menu of Strategies governance has created. Weight in equals share of future inflow out.',
  },
  {
    q: 'Can signals sell assets the Fund already holds?',
    a: 'Never. Signals steer inflow only. The only way assets leave the Fund is redemption (and GBX burning).',
  },
  {
    q: 'How do I mine GBX?',
    a: 'Send USDG (minimum 0.01) to the Fundraiser during an epoch, then claim your pro-rata share of that day&rsquo;s fixed emission after it settles.',
  },
  {
    q: 'Is mining profitable?',
    a: 'Sometimes, for some participants, never guaranteed. Your cost is set by everyone else&rsquo;s contributions; your revenue by a market this protocol does not control.',
  },
  {
    q: 'What happens in an empty epoch?',
    a: 'Its scheduled emission is forfeited forever. The schedule advances on wall-clock time regardless of attendance.',
  },
  {
    q: 'Can more than one billion GBX ever exist?',
    a: 'No. Lifetime minting is capped at exactly 1,000,000,000, checked on every mint.',
  },
  {
    q: 'Do burns let more GBX be minted?',
    a: 'No. The ceiling counts lifetime mints. Burns shrink supply and refill nothing.',
  },
  {
    q: 'What is sGBX?',
    a: 'A non-transferable receipt minted 1:1 for staked GBX. It measures signal capacity and nothing else.',
  },
  {
    q: 'Can sGBX be transferred or sold?',
    a: 'No. Any transfer that is not a mint or burn reverts. Influence stays attached to exposure.',
  },
  {
    q: 'Must I allocate all my sGBX?',
    a: 'No. Idle sGBX is fine: it earns nothing, dilutes nobody, and unstakes instantly.',
  },
  {
    q: 'Are signals percentages?',
    a: 'No. The chain stores absolute per-Strategy amounts. A frontend may display percentages, but you submit amounts.',
  },
  {
    q: 'Does adding a Strategy resize my existing signals?',
    a: 'No. Every operation is an independent delta against one Strategy. Nothing else in your account moves.',
  },
];

const faq2 = [
  {
    q: 'Do I ever have to reset my whole account?',
    a: 'No such operation exists. The old whole-account model was removed; only per-Strategy deltas remain.',
  },
  {
    q: 'What happens after a Strategy is killed?',
    a: 'It stops receiving future USDG; its undistributed revenue becomes a Fund liability. Your signal on it stops mattering and can be removed whenever you like.',
  },
  {
    q: 'Can a frozen token trap my signal?',
    a: 'No. Signal removal and unstaking transfer no tokens at all, so no token&rsquo;s behavior can block them.',
  },
  {
    q: 'How does USDG reach Strategies?',
    a: 'One path: contributions and harvested fees enter ResonanceRouter, Resonance indexes them by live signal weight, and anyone triggers distribution.',
  },
  {
    q: 'What happens to tiny USDG amounts?',
    a: 'They wait as exact carry until enough accumulates to move the index - nothing is rounded away. See also the open A-09 caveat about who shares carry across weight changes.',
  },
  {
    q: 'What does a Strategy auction actually sell?',
    a: 'Its entire current USDG balance, as one lot, for a payment in its configured token that declines with time.',
  },
  {
    q: 'Why no price oracle?',
    a: 'Oracles are trusted reporters and trusted reporters fail adversarially. The falling-clock design discovers price from actual buyer behavior instead.',
  },
  {
    q: 'Is the quoted auction number a per-USDG price?',
    a: 'No - it is the payment for the whole lot, however large the lot has grown during the epoch. Judge lot ÷ payment.',
  },
  {
    q: 'Can the auction really reach zero?',
    a: 'Yes. At expiry the lot can be taken for nothing, and the next epoch restarts at its configured floor. Accepted, disclosed behavior (A-05).',
  },
  {
    q: 'What share of a payment reaches the Fund?',
    a: 'All of it. 100%, recorded as a fixed liability at fill time. No split, no fee, no reward share - and no function to create one.',
  },
  {
    q: 'Can management change that percentage?',
    a: 'No. The ninety-ten split of an earlier draft and its setter were removed from the design entirely; the Fund receiving everything is not a parameter.',
  },
  {
    q: 'What is a Bribe?',
    a: 'The technical name of each Strategy&rsquo;s reward contract - an open incentive pot inherited from onchain voting systems. This paper says "Strategy reward". It implies no offchain payment.',
  },
  {
    q: 'Can one Strategy have several reward tokens?',
    a: 'Yes - up to eight: its payment token automatically, plus up to seven more that governance registers.',
  },
  {
    q: 'How do supplemental reward tokens get funded?',
    a: 'Anyone deposits via notifyRewardAmount. Registration only makes a token eligible; funding is always a voluntary external act.',
  },
  {
    q: 'Why an eight-token limit? Can governance raise it?',
    a: 'It bounds every mandatory reward loop, keeping worst-case exit gas under ~1.35M. The cap is a compile-time constant; nobody can raise it.',
  },
];

const faq3 = [
  {
    q: 'Can a broken reward token block my claims?',
    a: 'Only claims that include it. Claim tokens individually or as a chosen set and it cannot touch you.',
  },
  {
    q: 'Does signaling guarantee rewards?',
    a: 'No. Unfunded reward contracts pay nothing, and most may stay unfunded. Signaling guarantees only your share of whatever is actually funded.',
  },
  {
    q: 'What is a buyback Strategy?',
    a: 'A Strategy whose payment token is GBX: buyers pay GBX for its USDG, the GBX lands in the Fund, and anyone may burn it there.',
  },
  {
    q: 'Where does burned GBX go?',
    a: 'Out of existence. Supply falls, lifetime-burned rises, and the mint ceiling is unaffected.',
  },
  {
    q: 'Does the Fund keep an asset list?',
    a: 'No. Holdings are discovered by reading balances offchain. Strategy membership - what the protocol actively accumulates - lives in Resonance.',
  },
  {
    q: 'What if I omit an asset when redeeming?',
    a: 'That claim is forfeited; the value stays for remaining holders. Omission is the intended tool for skipping broken or worthless tokens.',
  },
  {
    q: 'Can one bad token block all redemptions?',
    a: 'No - only redemptions that select it. Your list, your dependencies.',
  },
  {
    q: 'Can management withdraw Fund assets?',
    a: 'No function exists for anyone - manager included - to move Fund assets except redemption and GBX burning.',
  },
  {
    q: 'Can the contracts be upgraded or paused?',
    a: 'No. All twelve are direct, unproxied deployments with no pause switch. What ships is final, bugs included.',
  },
  {
    q: 'Can the liquidity NFT be pulled out?',
    a: 'No. The custody contract has no owner and no outbound transfer path. Delivery is one-way.',
  },
  {
    q: 'Why would anyone harvest fees or run maintenance?',
    a: 'No bounty exists. Beneficiaries - holders wanting burns, signalers wanting routed revenue - have reasons; the design accepts volunteer timing.',
  },
  {
    q: 'Is every amount a harvest moves a "fee"?',
    a: 'Mostly, plus any direct donations to the position contract. Either way it takes the same fixed route: USDG to Resonance, GBX to the burn.',
  },
  {
    q: 'Is GumBall6900 a registered investment fund?',
    a: 'No, and this paper is not an offer of one. Securities, collective-investment, and other laws vary by jurisdiction and legal review has not been performed.',
  },
  {
    q: 'Are tokenized stocks the same as owning shares?',
    a: 'No. They are issuer-dependent claims with their own freeze, upgrade, transfer, and legal limitations - none of which this protocol can see or fix.',
  },
  {
    q: 'Has GumBall6900 been audited?',
    a: 'No independent external audit has been completed. Internal adversarial review exists, with one open Medium finding (A-09), and its full evidence is in Part XI.',
  },
  {
    q: 'What should I verify before interacting?',
    a: 'That a deployment exists at all (none does today), that its addresses and bytecode match reviewed code, that the timelock roles are as documented - and every line of the checklist page.',
  },
];

export const part13Pages = [
  {
    id: 'faq-1',
    runner: 'FAQ',
    group: 'Part XIII · Questions, answered',
    section: { title: 'FAQ: the idea, mining, and signaling', note: 'Fifteen questions' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XIII · Questions, answered',
          number: n(context, 'faq-1'),
          title: 'FAQ: the idea, mining, and signaling',
          deck: 'Short answers with chapter-length backing. Part and chapter references throughout the paper carry the detail.',
        })}
        <div class="full qa-grid">${qa(faq1)}</div>
      </div>
    `,
  },
  {
    id: 'faq-2',
    runner: 'FAQ',
    section: { title: 'FAQ: revenue, auctions, and rewards', note: 'Fifteen more' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XIII · Questions, answered',
          number: n(context, 'faq-2'),
          title: 'FAQ: revenue, auctions, and rewards',
          deck: 'The middle of the machine: how money moves, clears, and optionally tips.',
        })}
        <div class="full qa-grid">${qa(faq2)}</div>
      </div>
    `,
  },
  {
    id: 'faq-3',
    runner: 'FAQ',
    section: { title: 'FAQ: the Fund, governance, and status', note: 'Sixteen more' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XIII · Questions, answered',
          number: n(context, 'faq-3'),
          title: 'FAQ: the Fund, governance, and status',
          deck: 'Exits, powers, and the honest answers about where this project actually stands.',
        })}
        <div class="full qa-grid">${qa(faq3)}</div>
      </div>
    `,
  },
];

export const part14Pages = [
  {
    id: 'worked-thread',
    runner: 'The worked example, end to end',
    group: 'Part XIV · Conclusion',
    section: { title: 'The worked example, end to end', note: 'Maya, Elena, Noor, and Leo, once through' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XIV · Conclusion',
          number: n(context, 'worked-thread'),
          title: 'The worked example, end to end',
          deck: 'Every thread from the paper, tied once: eight steps, four fictional people, and numbers the build recomputes on every run.',
        })}
        ${figureBlock({
          index: context.figure('worked-thread'),
          svg: fig2.workedThread({ width: widths.full }),
          caption:
            'One pass through the whole machine. Two scenarios worth replaying against it: a frozen wrapper token would strand only its own payouts and claims (steps 5-6) while every exit stayed live; and a signal shift just before step 3 or a fee harvest would legally redirect that lump - the disclosed timing surface of a cooldown-free system.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              The example is deliberately unglamorous. Nobody in it got rich; a fifth of a reward stream and a
              twelve-thousandth of a treasury are the kind of numbers real mechanisms produce. What the thread
              demonstrates is narrower and more valuable: at every step, the rule that applied was published in advance,
              applied to everyone identically, and executed without anyone&rsquo;s permission - and every number in it
              came out of the same arithmetic the contracts run.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'All fictional',
              body: 'The people are inventions; the tokenized assets are illustrative; availability of any real wrapped asset is not implied; nothing here is a projection of returns.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'conclusion',
    runner: 'Conclusion',
    section: { title: 'What GumBall6900 makes possible', note: 'Eight precise takeaways' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XIV · Conclusion',
          number: n(context, 'conclusion'),
          title: 'What GumBall6900 makes possible',
          deck: 'Not a prediction of success - a statement of what this mechanism, if deployed and sound, would let people do that they cannot easily do today.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              It would let strangers form a shared portfolio without trusting a manager, by making the only
              discretionary act - choosing what to accumulate next - continuous, proportional, and public. It would let
              them leave without permission, in kind, at arithmetic&rsquo;s price rather than an operator&rsquo;s. And
              it would make the whole arrangement inspectable: every rule cited in this paper is a line of immutable
              code, every number a recomputable fact.
            </p>
            ${table({
              className: 'table--tight',
              rows: [
                [
                  '1',
                  'GBX distribution is fully public: a fixed, self-funding schedule with no insider allocation of any kind.',
                ],
                [
                  '2',
                  'Direction is continuous and granular: absolute per-Strategy signals, adjustable at any moment, with idle weight instantly liquid.',
                ],
                [
                  '3',
                  'Acquisition needs no oracle: falling-clock auctions discover prices from real buyers, and accept the visible cost of zero-price expiry.',
                ],
                [
                  '4',
                  'Settlement is total: every Strategy payment belongs to the Fund - no splits, no fees, no exceptions.',
                ],
                [
                  '5',
                  'Rewards are honest: optional, externally funded, capped at eight tokens, and never a tax on shared backing.',
                ],
                [
                  '6',
                  'Exit is unstoppable: selective in-kind redemption with one snapshot, full atomicity, and no pause switch anywhere.',
                ],
                [
                  '7',
                  'Management is three bounded actions behind a public delay - and the Fund and liquidity position answer to no one at all.',
                ],
                [
                  '8',
                  'Status is stated plainly: internally reviewed with one open Medium finding, unaudited externally, undeployed, and unlicensed for user funds until every recorded blocker clears.',
                ],
              ],
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'The narrow claim',
              kind: 'capital',
              body: 'Not that holders will choose well - only that the choosing can be public, continuous, and inspectable, with exits no one can close.',
            })}
            ${note({
              label: 'What would change our minds',
              body: 'Independent review finding the mechanism unsound, A-09 proving unacceptable at real scale, or legal review foreclosing the design. Each would be reported the way this paper reports everything else.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          Public mining. Continuous signals. Market-executed acquisitions. Total settlement. In-kind exit.
          <em>A fixed core - stated honestly, evidence and open questions included.</em>
        </p>
      </div>
    `,
  },
];
