/**
 * Part I - The idea. Part II - Tokens and participants.
 */

import * as fig from '../figures.mjs';
import * as fig2 from '../figures2.mjs';
import { widths } from '../svg.mjs';
import { html, sectionHead, note, figureBlock, table } from '../page-kit.mjs';
import { contractConstants } from '../protocol-facts.mjs';
import { fmtGBX } from '../worked.mjs';

const n = (context, id) => context.sectionNumber(id);

export const part1Pages = [
  {
    id: 'exec-1',
    runner: 'Executive summary',
    group: 'Part I · The idea',
    section: { title: 'Executive summary', note: 'What GumBall6900 is' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part I · The idea',
          number: n(context, 'exec-1'),
          title: 'Executive summary',
          deck: 'GumBall6900 is an onchain fund whose holders continuously direct what it acquires next. This page and the next say everything essential.',
        })}
        <div class="spread">
          <div class="col-main">
            <p class="lede">
              GumBall6900 is a set of twelve immutable smart contracts that together run a shared investment pot, the
              <span class="term">Fund</span>, on a public blockchain. Nobody manages the portfolio. Instead, the people
              who hold the protocol's token decide, continuously and in public, where the next dollar of inflow goes.
            </p>
            <p>
              <strong>GBX</strong> is the protocol's token. It cannot be bought from the team, because there is no team
              allocation: 98% of all GBX that can ever exist is distributed through public <em>mining</em> - sending the
              stablecoin USDG to a contract called the <span class="term">Fundraiser</span> and receiving a share of a
              fixed, publicly known daily emission. The remaining 2% seeds a permanently locked trading pool so GBX has
              a market at all. At most 1,000,000,000 GBX can ever be minted, and burning GBX never reopens that ceiling.
            </p>
            <p>
              <strong>Signaling</strong> is how holders steer. Staking GBX one-for-one produces
              <span class="term">sGBX</span>, a non-transferable receipt. Pointing an amount of sGBX at a
              <span class="term">Strategy</span> - an eligible acquisition path, such as "accumulate a tokenized NVIDIA
              share" - raises that Strategy's share of the next USDG distribution. Signals are absolute amounts you add
              and remove independently, whenever you like, with no voting seasons and no lockups.
            </p>
            <p>
              <strong>Acquisition</strong> happens by auction, not by oracle. Each Strategy periodically offers its
              accumulated USDG for sale and asks buyers to pay in the asset it wants; the required payment falls with
              time until someone accepts. Every completed payment - all of it - becomes backing in the shared Fund.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'Mine GBX from a public schedule, stake it, point it at what the Fund should buy next, and redeem it for a slice of what the Fund already holds.',
            })}
            ${note({
              label: 'What this is not',
              kind: 'capital',
              body: 'Not a fixed index. Not a token pegged to net asset value. Not a DAO with proposals. Not audited, deployed, or authorized for user funds.',
            })}
            ${note({
              label: 'For every reader',
              kind: 'supply',
              body: 'Chapters are self-contained. If a term is unfamiliar - blockchain, wallet, stablecoin, staking - Part II defines each one before relying on it.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          Signals direct the <em>future</em>. The Fund records the <em>past</em>. Redemption connects the two.
        </p>
      </div>
    `,
  },

  {
    id: 'exec-2',
    runner: 'Executive summary',
    section: { title: 'Executive summary, continued', note: 'Control, exits, and the largest risks' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part I · The idea',
          number: n(context, 'exec-2'),
          title: 'Executive summary, continued',
          deck: 'What holders get back, what management can and cannot touch, and the risks that matter most.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              <strong>Redemption</strong> is the exit. Burning GBX entitles the holder to a proportional, in-kind share
              of Fund assets they select themselves: burn 1% of supply, name the tokens you want, receive 1% of each.
              There is no redemption desk, no queue, and no pause switch - and equally no guarantee about what the
              received assets are worth.
            </p>
            <p>
              <strong>Rewards</strong> for signalers exist but are never automatic. Each Strategy has a companion
              contract (technically named a <span class="term">Bribe</span>; this paper says "Strategy reward") that can
              stream up to eight registered tokens to that Strategy's signalers - but only value someone independently
              deposits is ever paid. Auction proceeds never fund rewards.
            </p>
            <p>
              <strong>Management</strong> is deliberately small. A timelocked owner can do exactly three ongoing things:
              add a Strategy, kill a Strategy, and register a reward token within a permanent cap of eight per Strategy.
              It cannot mint GBX, touch Fund assets, redirect payments, pause redemption, move the liquidity position,
              or upgrade any contract. The Fund and the liquidity contract have no owner at all.
            </p>
            <p>
              <strong>The largest risks</strong> are stated, not hidden: immutable bugs would be permanent; assets the
              Fund holds can freeze, fail, or lose value; auctions can clear badly or not at all (a late fill can clear
              at zero); one internal Medium finding (A-09) about timing fairness remains open; and the system has had no
              independent audit. Part XI treats each of these in depth.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why this design exists',
              body: 'Every removed power is a promise: no admin who can rug, no oracle to corrupt, no upgrade to sneak in. The cost is symmetrical - no admin who can fix, either.',
            })}
            ${note({
              label: 'Important risk',
              kind: 'asset',
              body: 'This software is unaudited and undeployed. Every property in this paper is an internal engineering claim until independent review says otherwise.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${table({
            head: ['If you are a...', 'Your one-line takeaway'],
            rows: [
              [
                'GBX miner',
                'You are buying a share of a fixed daily emission; your cost depends on who shows up with you.',
              ],
              ['Signaler', 'Your sGBX steers future inflow only; it never sells what the Fund already holds.'],
              ['Auction buyer', 'You choose the moment the price is right; three parameters protect your fill.'],
              ['Reward claimant', 'Only independently funded streams pay; claim selectively if a token misbehaves.'],
              ['Redeemer', 'You pick the assets; omitted claims are forfeited, and one snapshot prices everything.'],
              ['Reviewer', 'Twelve direct contracts, three governed actions, one open finding, no external audit yet.'],
            ],
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'ninety',
    runner: 'GumBall6900 in 90 seconds',
    section: { title: 'GumBall6900 in 90 seconds', note: 'Eight moves on one page' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part I · The idea',
          number: n(context, 'ninety'),
          title: 'GumBall6900 in 90 seconds',
          deck: 'The whole lifecycle is eight permissionless moves. Everything after this page is detail and evidence.',
        })}
        ${figureBlock({
          index: context.figure('ninety'),
          svg: fig2.ninetySeconds({ width: widths.full }),
          caption:
            'Mine, stake, signal, route, acquire, reward, fund, redeem. Arrows are transaction flow, not obligations: each move is independent, optional after the first, and open to anyone.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              A reader who has never used a blockchain can follow the loop in ordinary terms. People buy in by
              contributing digital dollars on a published schedule (<em>mine</em>). They convert their tokens into
              voting weight that cannot be sold separately (<em>stake</em>) and point that weight at the assets they
              want accumulated (<em>signal</em>). The machine forwards arriving dollars accordingly (<em>route</em>),
              sells them at open, falling-price auctions for the wanted assets (<em>acquire</em>), optionally lets third
              parties tip the people who steered (<em>reward</em>), stores everything bought in a shared vault
              (<em>fund</em>), and lets anyone cash out their share of that vault in the assets themselves
              (<em>redeem</em>).
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why this matters',
              kind: 'capital',
              body: 'No step requires permission, identity, or an operator being awake. The protocol is a standing set of rules, not a service that someone runs.',
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
    id: 'map',
    runner: 'The protocol in one figure',
    section: { title: 'The protocol in one figure', note: 'Every flow on a single page' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part I · The idea',
          number: n(context, 'map'),
          title: 'The protocol in one figure',
          deck: 'Three kinds of value move through GumBall6900. This is all of them, and every place they can end up.',
        })}
        ${figureBlock({
          index: context.figure('map'),
          svg: fig.systemMap({ width: widths.full }),
          caption:
            'Contribution revenue has exactly one entrance and follows live signal weight to a Strategy. Every completed Strategy payment is Fund-bound in full; rewards are only ever funded independently. Redemption and burning are the only exits, and burned mint capacity never reopens.',
        })}
      </div>
    `,
  },

  {
    id: 'core-idea',
    runner: 'The core idea',
    section: { title: 'The core idea', note: 'Against five familiar alternatives' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part I · The idea',
          number: n(context, 'core-idea'),
          title: 'The core idea',
          deck: 'Funds usually make a basket easier to own. GumBall6900 makes the next purchase easier to influence.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              A traditional index fund hands you a finished basket: a methodology decides membership, a committee
              decides weights, and you receive the result. Most onchain "index" products keep that shape and merely move
              custody onchain. GumBall6900 asks a narrower question instead:
            </p>
            <div class="pull stack-1">Who should decide the fund's <em>next</em> purchase?</div>
            <p class="stack-2">
              Its answer: whoever holds live signal weight, continuously, with no round to wait for. Holders never
              approve a target portfolio. They hold weight across eligible acquisition paths, and each new unit of
              revenue follows whatever distribution exists the moment it arrives. The consequence threads the whole
              design: the Fund is a record of past acquisitions, signals are a statement of present preference, and
              changing your mind redirects the future without forcing a single sale.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'The distinction to keep',
              body: '<strong>GBX</strong> is a claim on what the Fund already owns. <strong>sGBX</strong> directs what it may acquire next. They are deliberately different instruments.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${table({
            className: 'table--tight',
            head: ['Model', 'Who picks assets', 'Rebalancing', 'Exit', 'Where GumBall6900 differs'],
            rows: [
              [
                'Traditional index fund',
                'A methodology',
                'Automatic',
                'Cash at NAV',
                'No methodology, no NAV, in-kind exit',
              ],
              [
                'Fixed crypto index token',
                'A curated list',
                'Periodic',
                'Trade or mint/burn',
                'No fixed list; the basket forms over time',
              ],
              [
                'Managed treasury',
                'A manager',
                'Discretionary',
                'Rarely direct',
                'No manager can touch holdings at all',
              ],
              [
                'DAO treasury',
                'Token votes on proposals',
                'Per proposal',
                'Vote-dependent',
                'No proposals; continuous per-account weight',
              ],
              [
                'Synthetic index token',
                'A price formula',
                'By oracle',
                'Against collateral',
                'Real tokens held and redeemed, no oracle',
              ],
            ],
          })}
        </div>
        <div class="spread stack-2">
          <div class="col-main">
            <p class="small muted" style="margin:0;">
              The same three decisions - membership, weighting, timing - exist in every model above. What moves is where
              they are made and who can see them being made. Here, all three are relocated into public, continuous
              mechanisms: governance curates the menu, signals weight it, and buyers time it. Nothing in that sentence
              requires a vote, a season, or a quorum.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why this matters',
              kind: 'capital',
              body: 'Relocating decisions is the whole product. Everything else in this paper is the supporting machinery that makes the relocation safe to run unattended.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'path',
    runner: 'A basket that forms over time',
    section: { title: 'A basket that forms over time', note: 'Path dependence, honestly' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part I · The idea',
          number: n(context, 'path'),
          title: 'A basket that forms over time',
          deck: 'Because every distribution follows the signal of its moment, the Fund holds the sum of every past decision - not a picture of the current one.',
        })}
        ${figureBlock({
          index: context.figure('path'),
          svg: fig.basketFormationChart({ width: widths.full }),
          caption:
            'The upper band is what holders want at each distribution. The lower area is what the Fund actually holds. They are related by accumulation and are never the same picture.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              This is the most important behavioral fact in the design and the one most often misread. A holder who
              moves signal to a new Strategy has changed the destination of <em>future</em> capital and nothing else.
              Assets bought under the old signal stay in the Fund until someone redeems them out. There is no
              rebalancing engine, because building one would require exactly the discretionary selling power this design
              removes.
            </p>
            <p>
              Composition therefore shifts fastest when inflow is large relative to holdings - early distributions shape
              the basket far more than later ones - and the one mechanism that shrinks an existing position is
              redemption, where a holder carries specific assets out with their burned GBX.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'What this does not guarantee',
              kind: 'asset',
              body: 'The basket never automatically tracks current preferences, market weights, or any index. If everyone changes their mind, the Fund still holds what it holds.',
            })}
            ${note({
              label: 'Simple example',
              body: 'A fund that signaled 100% NVDA for a year, then switches to 100% AAPL, still holds a year of NVDA. Only new dollars - and redemptions - change that.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'onchain',
    runner: 'What onchain means',
    section: { title: 'What "onchain" means here', note: 'The guarantee boundary' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part I · The idea',
          number: n(context, 'onchain'),
          title: 'What "onchain" means here',
          deck: 'A blockchain is a shared computer whose past cannot be quietly edited. Rules deployed to it run exactly as written - and only the rules that are actually on it.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              For a reader new to this world: a <strong>blockchain</strong> is a public ledger maintained by many
              computers at once, so no single party can rewrite history or block a valid transaction. A
              <strong>smart contract</strong> is a program stored on that ledger; once deployed without upgrade hooks,
              its rules are fixed. A <strong>wallet</strong> is the keypair you act with, a
              <strong>transaction</strong> is a signed instruction, and <strong>gas</strong> is the execution fee the
              chain charges. GumBall6900 is intended for <strong>Robinhood Chain</strong>, an Ethereum-compatible
              network (chain ID 4663) whose support for the storage feature the Fund uses (EIP-1153) was verified
              read-only at a pinned block during internal review.
            </p>
            <p>
              The figure divides the world honestly. Everything on the left is enforced by contract code this paper can
              cite. Everything on the right is real infrastructure the system needs but cannot control - including the
              issuers of every external token the Fund might hold.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why this matters',
              kind: 'capital',
              body: '"Onchain" is a statement about enforcement, not safety. A rule being immutable does not make it a good rule, and it does not protect assets whose own issuers keep offchain powers.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('onchain'),
            svg: fig2.onchainOffchain({ width: widths.full }),
            caption: 'The left column is what this paper can promise. The right column is what it can only describe.',
          })}
        </div>
      </div>
    `,
  },
];

export const part2Pages = [
  {
    id: 'tokens',
    runner: 'USDG and GBX',
    group: 'Part II · Tokens and participants',
    section: { title: 'What USDG and GBX are', note: 'The two transferable tokens' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part II · Tokens and participants',
          number: n(context, 'tokens'),
          title: 'What USDG and GBX are',
          deck: 'One token comes in; one token measures your stake in what came in.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              <strong>USDG</strong> is a stablecoin: a token issued by an external company that aims to hold the value
              of one US dollar and uses six decimal places (the smallest unit is $0.000001). It is an
              <strong>ERC-20</strong> - the standard interface fungible tokens share, defining balances, transfers, and
              approvals. USDG is the only asset the Fundraiser accepts and the only asset Resonance allocates. Its
              issuer, like most stablecoin issuers, retains powers this protocol cannot see or veto: freezing addresses,
              upgrading the token, blocking transfers. That external trust is stated here once and revisited in Part XI.
            </p>
            <p>
              <strong>GBX</strong> ("GUM BALL 6900") is the protocol's own 18-decimal ERC-20. It is transferable and
              carries two standard extras: <em>Permit</em> (signature-based approvals, EIP-2612) and <em>Votes</em>
              (balance checkpoints). Nothing in the protocol runs token voting; the checkpoint surface is inherited from
              the standard library and left available to others. GBX has exactly three protocol roles: it is what mining
              pays out, what staking converts into signal capacity, and what redemption burns.
            </p>
            <p>
              GBX is <em>not</em> a claim to a fixed price. It is not pegged to the Fund's value and no oracle computes
              a "share price." What a GBX is worth is decided by markets and by what redemption can actually withdraw -
              nothing else.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'USDG is the fuel; GBX is the share-like token that mining mints, staking locks, and redemption burns - with no promised price.',
            })}
            ${note({
              label: 'What the contract enforces',
              kind: 'capital',
              body: 'Exact-transfer checks guard every USDG movement: if a token moves more or less than requested, the transaction reverts rather than mis-accounting.',
            })}
            ${note({
              label: 'What this does not guarantee',
              kind: 'asset',
              body: 'Neither token&rsquo;s market value. USDG can depeg or freeze; GBX can trade anywhere, including far from any notion of backing.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'supply',
    runner: 'GBX lifetime supply',
    section: { title: 'GBX lifetime supply', note: 'One ceiling, four numbers' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part II · Tokens and participants',
          number: n(context, 'supply'),
          title: 'GBX lifetime supply',
          deck: 'One number is capped forever: how much GBX has ever been minted. Everything else follows from it.',
        })}
        ${fig.supplySplit({ width: widths.full })}
        <div class="spread stack-1">
          <div class="col-main">
            <p>
              The contract tracks minting and burning separately, and the distinction matters.
              <strong>Lifetime minted</strong> counts every GBX ever created, including tokens later destroyed; it can
              only rise, and it can never exceed one billion. <strong>Lifetime burned</strong> counts every GBX ever
              destroyed. <strong>Current supply</strong> is the difference, and
              <strong>remaining mint capacity</strong> is the ceiling minus lifetime minted - so burning GBX shrinks
              supply but never refills the mint. A billion minted and a billion burned would leave zero supply and zero
              capacity, permanently.
            </p>
            <p>
              Minting authority is equally rigid: the deployer hands it to the Fundraiser exactly once, the handover
              locks, and from then on only Fundraiser claims can mint - within the 980 million reserved for them.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Simple example',
              kind: 'supply',
              body: 'Think of a ticket roll printed with one billion serial numbers. Tearing tickets up does not print new ones; it only makes the surviving tickets a larger share of what remains.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${table({
            head: ['Quantity', 'Meaning', 'Can it decrease?', 'Enforced where'],
            rows: [
              ['Lifetime minted', 'Every GBX ever created', 'Never', 'GBX.mint reverts past the ceiling'],
              ['Lifetime burned', 'Every GBX ever destroyed', 'Never', 'GBX.burn accumulates it'],
              ['Current supply', 'Minted minus burned', 'Yes, by burning', 'Standard ERC-20 accounting'],
              [
                'Remaining capacity',
                '1,000,000,000 minus lifetime minted',
                'Only toward zero',
                'remainingMintableSupply()',
              ],
            ],
          })}
        </div>
        <div class="spread stack-2">
          <div class="col-main">
            <p class="small muted">
              The split is exact by construction: ${fmtGBX(contractConstants.gbx.genesisLiquidityAllocation, 0)} GBX of
              genesis liquidity plus ${fmtGBX(contractConstants.gbx.fundraiserAllocation, 0)} GBX of Fundraiser capacity
              equals the ${fmtGBX(contractConstants.gbx.maxLifetimeMint, 0)} ceiling, and the contracts assert that
              partition rather than assuming it.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'For GBX holders',
              body: 'Every burn - buyback-style Strategy fills, harvested liquidity fees, redemptions - concentrates the remaining supply&rsquo;s claim on the Fund.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'sgbx',
    runner: 'What sGBX is',
    section: { title: 'What sGBX is', note: 'Staked weight that cannot be sold' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part II · Tokens and participants',
          number: n(context, 'sgbx'),
          title: 'What sGBX is',
          deck: 'Staking converts GBX into signal capacity, one for one. The receipt moves influence out of the market.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              <strong>Staking</strong> here means depositing GBX into the SignalGBX contract, which holds it and mints
              the same number of <strong>sGBX</strong> ("Signal GUM BALL 6900") to you. sGBX is
              <strong>non-transferable</strong>: any transfer that is not a mint or burn reverts. You cannot sell it,
              lend it, or delegate it away by accident; the only way out is <em>unstaking</em>, which burns sGBX and
              returns the same amount of GBX immediately.
            </p>
            <p>
              Why forbid transfers? Because sGBX is influence over shared money. A transferable signal token would
              become a market in influence, rentable by parties with no exposure to the outcome. Binding weight to the
              staked position keeps the person steering the Fund and the person exposed to the Fund the same person.
            </p>
            <p>
              There is deliberately no lock, no cooldown, and no unbonding period. The only thing that pins staked GBX
              in place is your own allocated signal - covered next - and even that only pins the allocated amount, never
              your whole balance.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'sGBX is your steering weight: minted 1:1 by staking, unusable as money, and redeemable back into GBX the moment it is not actively pointing at something.',
            })}
            ${note({
              label: 'Under the hood',
              kind: 'capital',
              body: 'Both stake and unstake verify exact GBX movement on both sides of the transfer, and unstake checks your allocated weight through Resonance before releasing.',
            })}
            ${note({
              label: 'What this does not guarantee',
              kind: 'asset',
              body: 'Staking earns nothing by itself. There is no staking yield; only allocated signal can ever attract independently funded rewards.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          One GBX in, one sGBX out - and back again, immediately, for anything you have not allocated.
        </p>
      </div>
    `,
  },

  {
    id: 'allocated-idle',
    runner: 'Allocated versus idle sGBX',
    section: { title: 'Allocated versus idle sGBX', note: 'Only pointed weight participates' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part II · Tokens and participants',
          number: n(context, 'allocated-idle'),
          title: 'Allocated versus idle sGBX',
          deck: 'Holding sGBX does nothing by itself. Only the amounts you explicitly point at Strategies exist, as far as routing is concerned.',
        })}
        ${figureBlock({
          index: context.figure('allocated-idle'),
          svg: fig2.allocatedIdle({ width: widths.full }),
          caption:
            'Maya&rsquo;s account from the worked example: 900 sGBX pointed at one Strategy, 400 at another, 200 idle. The idle 200 can be unstaked in the same block.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              The protocol tracks, per account, an <em>allocated</em> total - the sum of your per-Strategy signals - and
              treats everything above it as <em>idle</em>. Idle sGBX earns no rewards, directs no USDG, and, just as
              important, does not dilute anyone: allocation math divides by total <em>allocated</em> weight, not by sGBX
              supply. An account that stakes a million GBX and points none of it is invisible to routing.
            </p>
            <p>
              Idle weight is also instantly liquid. Unstaking checks only that the requested amount fits within your
              unallocated balance; it never requires touching your signals, waiting for an epoch, or paying anyone.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'For signalers',
              body: 'Keep a working buffer idle if you like - it costs nothing, dilutes nothing, and leaves instantly. Allocate only what you mean to steer with.',
            })}
            ${note({
              label: 'Why this matters',
              kind: 'capital',
              body: 'Systems that count unallocated stake in the denominator quietly tax inattentive stakers. This one does not: absent weight simply does not exist to the router.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'participants',
    runner: 'Participant roles',
    section: { title: 'Who does what', note: 'Twelve roles, most of them open to anyone' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part II · Tokens and participants',
          number: n(context, 'participants'),
          title: 'Who does what',
          deck: 'Most protocol actions are open to any address. The exceptions are one narrow timelocked owner and the external parties nobody can bind.',
        })}
        ${figureBlock({
          index: context.figure('participants'),
          svg: fig2.participantMap({ width: widths.full }),
          caption:
            'Roles are hats, not registrations: one address can wear several. Contribution can even name a different beneficiary, so a service can mine on a user&rsquo;s behalf without ever holding their GBX.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Three roles deserve emphasis. The <strong>maintenance caller</strong> is anyone willing to pay gas to
              advance public state: settling Fundraiser epochs, routing revenue, distributing to Strategies, paying
              fixed Fund liabilities, harvesting liquidity fees, burning Fund-held GBX. None of these pay a bounty; the
              system assumes interested parties exist. The <strong>manager</strong> is a timelocked contract with three
              ongoing powers, described in Part X. And <strong>token issuers</strong> - of USDG and of every wrapped
              asset - hold powers entirely outside this system's reach.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Important risk',
              kind: 'asset',
              body: 'Unpaid maintenance is a real liveness assumption: if nobody volunteers gas, settlements, distributions, and harvests simply wait.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'trust-matrix',
    runner: 'Can, cannot, must trust',
    section: { title: 'Can, cannot, must trust', note: 'The whole trust model on one page' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part II · Tokens and participants',
          number: n(context, 'trust-matrix'),
          title: 'Can, cannot, must trust',
          deck: 'For each party: what the contracts let them do, what the contracts forbid, and what you are trusting anyway.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            head: ['Party', 'Can (enforced)', 'Cannot (enforced)', 'You must still trust'],
            rows: [
              [
                'Any address',
                'Mine, stake, signal, buy, claim, redeem, and run every maintenance call',
                'Touch another account&rsquo;s balances, signals, or rewards',
                'That volunteers actually perform unpaid maintenance',
              ],
              [
                'Manager (timelock)',
                'Add a Strategy, kill a Strategy, register reward tokens up to eight',
                'Mint GBX, move Fund assets, redirect payments, pause, upgrade, migrate',
                'Multisig signers not to schedule harmful-but-legal actions',
              ],
              [
                'Multisig signers',
                'Propose and cancel timelocked actions',
                'Execute without the public delay elapsing',
                'Their key hygiene and their judgment',
              ],
              [
                'USDG issuer',
                'Everything its own token contract allows',
                'Nothing - this protocol cannot restrict it',
                'Solvency, honesty, and not freezing protocol addresses',
              ],
              [
                'Wrapped-asset issuers',
                'Freeze, upgrade, restrict, or halt their tokens',
                'Nothing - same as above',
                'Custody of the underlying and the legal wrapper terms',
              ],
              [
                'Frontends and indexers',
                'Display anything they choose',
                'Change onchain state or intercept funds',
                'That what they show matches the chain - verify independently',
              ],
              [
                'The chain itself',
                'Order, include, and execute transactions',
                'Rewrite finalized history without consensus',
                'Robinhood Chain&rsquo;s operators, uptime, and EIP-1153 support',
              ],
            ],
          })}
        </div>
        <div class="spread stack-2">
          <div class="col-main">
            <p class="small muted">
              Two vocabulary notes for later chapters. A <strong>multisig</strong> is a wallet that requires several
              signers to approve any action. A <strong>timelock</strong> is a contract that executes approved actions
              only after a public delay, giving everyone time to see - and react to - what is coming.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'The contracts bind the operator tightly, the market loosely, and external issuers not at all.',
            })}
          </div>
        </div>
      </div>
    `,
  },
];
