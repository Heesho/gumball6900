/**
 * Part VIII - The shared Fund. Part IX - Liquidity. Part X - Governance minimization.
 */

import * as fig from '../figures.mjs';
import * as fig2 from '../figures2.mjs';
import { widths } from '../svg.mjs';
import { html, sectionHead, note, figureBlock, formula, table, ledger } from '../page-kit.mjs';
import { fmtGBX, fmtUSDG, worked } from '../worked.mjs';

const n = (context, id) => context.sectionNumber(id);

export const part8Pages = [
  {
    id: 'fund-what',
    runner: 'What the Fund is',
    group: 'Part VIII · The shared Fund',
    section: { title: 'What the Fund is', note: 'Ownerless custody, no registry, no administrator' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VIII · The shared Fund',
          number: n(context, 'fund-what'),
          title: 'What the Fund is',
          deck: 'The Fund is a vault with no keyholder: raw tokens in, redemption and burning out, and not one other door.',
        })}
        ${figureBlock({
          index: context.figure('fund-entry'),
          svg: fig2.fundEntry({ width: widths.full }),
          caption:
            'Three ways in - Strategy payments, protocol liabilities, and anyone&rsquo;s direct transfer - and exactly two ways out, both initiated by GBX holders or the public, never by an operator.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              The Fund contract is deliberately tiny. It holds whatever ERC-20 balances it holds; it can burn GBX it
              owns when anyone asks; and it can redeem. It has <strong>no owner</strong>, no upgrade path, no successor,
              no migration, no sweep function, and no pause - properties the repository enforces with tests that verify
              the removed functions do not merely revert but do not exist.
            </p>
            <p>
              Just as deliberately, it keeps <strong>no asset registry</strong>. "What does the Fund hold?" is answered
              by reading token balances offchain, not by an onchain list. Official protocol membership - which assets
              the machine actively accumulates - lives in Resonance's Strategy set; the Fund itself accepts anything
              anyone sends it, which means unsolicited, worthless, or hostile tokens can sit there indefinitely. A
              registry would have to be curated, and a curator is an administrator - the thing this design refuses to
              have.
            </p>
            <p>
              Direct donations simply become backing for all GBX holders. Mistaken transfers are unrecoverable, by the
              same immutability that protects everything else.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'The Fund is shared property administered by arithmetic: nobody can take from it, and everybody with GBX can take their share of it.',
            })}
            ${note({
              label: 'Why no recovery admin',
              kind: 'asset',
              body: 'Any key that can "recover mistakes" can also make them. The design prices lost donations below the cost of a rescue power.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'redemption',
    runner: 'Selective in-kind redemption',
    section: { title: 'Selective in-kind redemption', note: 'Burn, select, receive - atomically' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VIII · The shared Fund',
          number: n(context, 'redemption'),
          title: 'Selective in-kind redemption',
          deck: 'Redemption pays in the assets themselves. The redeemer - not the protocol - decides which assets, and one snapshot prices them all.',
        })}
        <div class="spread">
          <div class="col-main">
            ${formula({
              label: 'Per selected token',
              body: 'payout = floor(fundBalanceBefore × gbxBurned / gbxSupplyBeforeBurn)',
              where:
                'One pre-burn total supply is captured first and used as the denominator for every selected token; balances are snapshotted before any movement. The GBX burn and all selected transfers then execute in one atomic transaction - if any selected transfer fails, everything reverts, including the burn.',
            })}
            <p class="stack-1">
              The caller supplies the GBX amount, a receiver, and a list of unique non-GBX token addresses. Duplicates
              revert - detected in O(n) using EIP-1153 <em>transient storage</em>, a Cancun-era feature giving contracts
              scratch space that lives only for one transaction, so the check needs no permanent bookkeeping. GBX itself
              can never be selected, and "in-kind" means exactly that: you receive the tokens, with all their properties
              and problems, not a cash equivalent.
            </p>
            <p>
              Selectivity is the safety mechanism. Because the Fund can hold broken or hostile tokens, a redemption
              forced to touch <em>every</em> holding could be blocked by any one of them. Naming your own list makes
              each redemption depend only on tokens you chose - one bad asset can spoil a redemption that includes it,
              and no redemption that omits it.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Redemption cannot be paused',
              kind: 'supply',
              body: 'There is no pause switch anywhere in the core - which means there is none on the exit either.',
            })}
            ${note({
              label: 'Not "automatic"',
              kind: 'capital',
              body: 'Redemption is a transaction you construct: your amount, your receiver, your token list. Discovery of what is worth selecting happens offchain, in your tooling.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('redemption'),
            svg: fig.redemptionFigure({ width: widths.full }),
            caption:
              'Selecting an asset claims a pro-rata slice of it. Omitting one forfeits that claim permanently - the value stays behind for whoever still holds GBX.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'redemption-worked',
    runner: 'A worked redemption',
    section: { title: 'A worked redemption, and omitted assets', note: 'Leo takes two of three' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part VIII · The shared Fund',
          number: n(context, 'redemption-worked'),
          title: 'A worked redemption, and omitted assets',
          deck: 'Leo burns 10,000 GBX against a 120 million supply, selects two assets, and deliberately omits a third.',
        })}
        ${figureBlock({
          index: context.figure('redemption-worked'),
          svg: fig2.redemptionWorked({ width: widths.full }),
          caption:
            'Every payout uses the same pre-burn denominator. The omitted PARTNER balance simply stays in the Fund, slightly enriching every remaining holder - including Leo, if he still holds GBX.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Leo's ${fmtGBX(worked.redemption.leoBurn, 0)} GBX is one twelve-thousandth of the
              ${fmtGBX(worked.redemption.supplyBeforeBurn, 0)} pre-burn supply, so he receives exactly that fraction of
              each selected balance: ${fmtGBX(worked.redemption.leoPayouts[0].payout, 6)} wrapper tokens from the Fund's
              ${fmtGBX(worked.redemption.fundBalances[0].balance, 0)}, and
              ${fmtUSDG(worked.redemption.leoPayouts[1].payout, 6)} USDG from its
              ${fmtUSDG(worked.redemption.fundBalances[1].balance, 0)}. He omits the 12-token PARTNER dust because the
              claim - a millionth of a token - is worth less than the gas and the risk of touching it.
            </p>
            <p>
              Omission is permanent for that redemption: the claim is not banked, deferred, or redeemable later at the
              old ratio. And flooring is real: a selected token whose pro-rata share rounds to zero (a seven-wei balance
              against a small burn, say) transfers nothing while still consuming a list slot. Redeemers with small burns
              should select accordingly.
            </p>
            <p>
              If a selected token turns out to be frozen or malicious, the whole redemption reverts - burn included -
              and Leo simply resubmits without it. The failure mode is a wasted transaction, never a lost burn.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'For redeemers',
              body: 'Preview every balance offchain, drop dust and suspect tokens, and remember: your list, your risk, one atomic result.',
            })}
            ${note({
              label: 'Maintenance first',
              kind: 'supply',
              body: 'Fund-held GBX in the supply denominator dilutes every redemption. Anyone can - and should - call burnGBX and settle GBX liabilities before redeeming.',
            })}
          </div>
        </div>
      </div>
    `,
  },
];

export const part9Pages = [
  {
    id: 'genesis',
    runner: 'Why GBX needs a market',
    group: 'Part IX · Liquidity',
    section: { title: 'Genesis liquidity: 20 million GBX, one position', note: 'Single-sided, out of range, hookless' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IX · Liquidity',
          number: n(context, 'genesis'),
          title: 'Genesis liquidity: 20 million GBX, one position',
          deck: 'Mining economics needs a GBX price to exist. The 2% genesis allocation exists to make one - and for nothing else.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              A <strong>liquidity pool</strong> is a standing pot of two tokens that anyone can trade against; prices
              move along a curve as trades tilt the pot. <strong>Uniswap v4</strong> is the pool system used here, and
              an <strong>LP position</strong> is a deposit into a chosen price <em>range</em> (delimited by
              <em>ticks</em>) that earns a share of trading fees while the market price is inside it. The canonical
              GumBall6900 pool is GBX/USDG and <em>hookless</em> - no custom code attaches to the pool, so it behaves
              exactly like a vanilla pool with no surprises.
            </p>
            <p>
              The entire 20 million GBX genesis allocation funds one precommitted position, and it launches
              <strong>single-sided and out of range</strong>: all GBX, no USDG, parked above the launch price. The
              protocol seeds no dollars and therefore asserts no valuation. If buyers push the price up into the range,
              the position sells GBX into that demand and begins earning fees; if they never do, the protocol has still
              promised nothing.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why single-sided',
              kind: 'capital',
              body: 'Pairing GBX with protocol-owned USDG would mean the deployer picked the launch price. Out-of-range GBX lets the market do the pricing from the first trade.',
            })}
            ${note({
              label: 'Not a treasury',
              kind: 'supply',
              body: 'The 20 million is committed, not held: once the NFT is in custody, no one - not governance, not the deployer - can withdraw the principal, ever.',
            })}
          </div>
        </div>
        <div class="stack-2">
          ${figureBlock({
            index: context.figure('genesis-range'),
            svg: fig2.genesisRange({ width: widths.full }),
            caption:
              'The precommitted range sits above the launch price. The pool key, fee tier, tick range, and position NFT identity are all fixed before deployment and validated on delivery.',
          })}
        </div>
      </div>
    `,
  },

  {
    id: 'custody',
    runner: 'Permanent custody',
    section: { title: 'Permanent custody and one-time admission', note: 'The NFT enters once and never leaves' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IX · Liquidity',
          number: n(context, 'custody'),
          title: 'Permanent custody and one-time admission',
          deck: 'The LiquidityPosition contract accepts exactly one NFT, checks everything about it, and then has no code path that could ever release it.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              Uniswap positions are represented as NFTs, so custody means holding one token forever. At deployment the
              contract commits to the exact PositionManager address, depositor address, token ID, pool key hash, and
              tick range it will accept. The ERC-721 receiver hook validates all of them on delivery - wrong sender,
              wrong depositor, wrong ID, wrong pool, wrong ticks, or zero liquidity each revert - and a successful
              delivery flips a one-time flag. There is no transfer function, no approval function, and no owner: like
              the Fund, the contract has no administrator at all.
            </p>
            <p>
              The mirror image of that safety is rigidity: an incorrectly configured genesis position - wrong fee tier,
              wrong range, wrong initial price - is permanent. The deployment checklist in the appendices exists mostly
              because of this page. Verification happens once, before delivery, or never.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'What the contract enforces',
              kind: 'capital',
              body: 'Six admission checks at delivery; custody queries afterward; principal invariance on every harvest. No path out exists to restrict.',
            })}
            ${note({
              label: 'Important risk',
              kind: 'asset',
              body: 'Irreversible genesis configuration is a real, named risk: a mispriced range cannot be corrected, only lived with.',
            })}
          </div>
        </div>
        <p class="statement stack-2">
          No owner. No withdrawal. No migration. No rescue.
          <em>The position is protocol anatomy, not protocol property.</em>
        </p>
      </div>
    `,
  },

  {
    id: 'harvest',
    runner: 'Harvesting fees',
    section: { title: 'Harvesting fees with fixed principal', note: 'USDG to Resonance, GBX to the burn' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IX · Liquidity',
          number: n(context, 'harvest'),
          title: 'Harvesting fees with fixed principal',
          deck: 'Anyone may collect the position&rsquo;s accrued trading fees. The principal cannot move; the fees have exactly two fixed destinations.',
        })}
        ${figureBlock({
          index: context.figure('burns'),
          svg: fig.burnLoops({ width: widths.full }),
          caption:
            'harvestFees() collects both fee balances with a zero-liquidity decrease, verifies the principal is exactly unchanged, routes all USDG into Resonance, and sends all GBX to the Fund where it is burned - one atomic transaction.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Mechanically, the harvest uses Uniswap v4's fee-collection idiom - a liquidity decrease of zero followed
              by closing both currency balances - then asserts the position's liquidity equals its pre-harvest value to
              the unit. The collected USDG goes through ResonanceRouter and is allocated by the signal weights live at
              that moment; the collected GBX goes to the Fund and is burned in the same call. The caller funds nothing,
              receives nothing, and needs no permission. Direct GBX or USDG donations to the contract ride along to the
              same destinations on the next harvest.
            </p>
            <p>
              Under the accepted design, liquidity fees <em>are</em> protocol revenue - USDG fees join contributions in
              the signal-directed path, and GBX fees shrink supply. An interim design (ADR 0018) briefly compounded fees
              back into the position with caller funding and a growth requirement; ADR 0022 removed all of it - the
              compounding surface, the Permit2 dependency, the caller-timing question that internal review had flagged
              as finding A-06 - in favor of this fixed-principal routing. The integration suite exercises the shipped
              behavior against genuine Uniswap v4 contracts, including a 10,000-case fuzz of exact routing and a
              rollback test proving a failed destination restores the fee entitlement intact.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'What the contract enforces',
              kind: 'capital',
              body: 'Principal invariance, exact transfer deltas, fixed destinations, atomicity: a failing route or burn reverts the entire harvest, leaving fees collectible later.',
            })}
            ${note({
              label: 'For harvest callers',
              body: 'There is no bounty. Harvest when the public benefit - revenue routed, supply burned - is worth your gas, or when you simply want the flywheel turned.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'harvest-timing',
    runner: 'Harvest timing and residual risk',
    section: { title: 'Harvest timing, honestly', note: 'What remains after the redesign' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part IX · Liquidity',
          number: n(context, 'harvest-timing'),
          title: 'Harvest timing, honestly',
          deck: 'Removing caller funding removed the manipulation surface internal review worried about. Two smaller timing facts remain, and they are stated here.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              <strong>First: fee realization is voluntary.</strong> With no bounty, fees sit uncollected until someone
              pays gas. Nothing is at risk while they wait - Uniswap accounts them to the position - but revenue and
              burns arrive in lumps whose timing depends on volunteers.
            </p>
            <p>
              <strong>Second: allocation snapshots at the harvest.</strong> Harvested USDG follows the signal weights
              present when the harvest routes it. Because signaling has no cooldown, weight can move just before a large
              harvest and redirect that lump. This is the same frozen current-signal policy every distribution uses,
              disclosed in the residual-risk record - distinct from open finding A-09, which concerns sub-index carry
              rather than whole distributions.
            </p>
            <p>
              What no timing can do: touch the principal, change the destinations, split the fees, or take a cut. The
              earlier compound design let a sophisticated caller choose token composition at favorable pool prices; that
              entire class of concern ended when ADR 0022 removed caller funding. Internal review closed A-06 on that
              basis, and the old "A-07" question - whether LP fees should count as protocol revenue at all - was settled
              the same way: they do.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Important risk',
              kind: 'asset',
              body: 'Lumpy, volunteer-timed revenue plus cooldown-free signaling means harvest-adjacent signal moves are possible and permissionless. Watch large pending fees the way you watch the timelock queue.',
            })}
            ${note({
              label: 'What this does not guarantee',
              body: 'That fees are meaningful. A quiet pool harvests dust; the mechanism&rsquo;s value scales with trading volume the protocol does not control.',
            })}
          </div>
        </div>
        ${ledger({
          yesHead: 'Fixed by the shipped design',
          yesItems: [
            'Principal liquidity can never change - a harvest that would change it reverts.',
            'USDG fees route to Resonance; GBX fees burn through the Fund; both atomically.',
            'No caller funding, payout, bounty, swap, oracle, or Permit2 dependency exists.',
          ],
          noHead: 'Left open, on purpose',
          noItems: [
            'When harvests happen - volunteers decide.',
            'Which signals catch a given harvest - the live weights decide.',
            'Whether fees are ever large - the market decides.',
          ],
        })}
      </div>
    `,
  },
];

export const part10Pages = [
  {
    id: 'governance',
    runner: 'What the manager controls',
    group: 'Part X · Governance minimization',
    section: { title: 'What signals govern, what the manager controls', note: 'Three ongoing actions' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part X · Governance minimization',
          number: n(context, 'governance'),
          title: 'What signals govern, what the manager controls',
          deck: 'Economic direction belongs to signal holders, continuously. Human management holds three bounded powers - and the boundary is bytecode.',
        })}
        ${figureBlock({
          index: context.figure('governance'),
          svg: fig.governancePerimeter({ width: widths.full }),
          caption:
            'The complete ongoing management surface: add a Strategy, kill a Strategy, register a reward token within the eight-token cap. Everything on the right has no entry point at all - not a restricted one.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Resonance is the only owned core contract, and its owner - intended to be a timelock - can call exactly
              three ongoing functions. <code>addStrategy</code> deploys a new Strategy with its paired reward and router
              contracts through two bound factories. <code>killStrategy</code> permanently stops one Strategy's future
              revenue. <code>addBribeReward</code> registers a reward token, subject to the immutable cap of eight per
              Strategy. That is the entire recurring surface: there is no parameter to tune, no fee to set, no treasury
              to spend, and - since ADR 0021 removed the reward split and its governance setter - no percentage anywhere
              for management to adjust.
            </p>
            <p>
              A handful of <strong>one-time</strong> setup calls exist only to wire the system at deployment: binding
              Resonance into SignalGBX and the two factories, binding the router into Resonance, and handing GBX minting
              to the Fundraiser. Each locks permanently after first use; a mistake in any of them is unrecoverable,
              which is why the deployment checklist verifies every one.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'Management curates the menu of Strategies; it never touches the money, the weights, the schedule, or the rules.',
            })}
            ${note({
              label: 'No fees of any kind',
              kind: 'capital',
              body: 'No fee, no salary, no carry, no revenue share exists anywhere in production code - and no function exists through which one could be introduced.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'cannot',
    runner: 'What the manager cannot do',
    section: { title: 'What the manager cannot do', note: 'The absence is the feature' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part X · Governance minimization',
          number: n(context, 'cannot'),
          title: 'What the manager cannot do',
          deck: 'These are not permissions withheld by policy. They are functions that do not exist in the deployed bytecode.',
        })}
        <div class="spread">
          <div class="col-main">
            ${table({
              className: 'table--tight',
              head: ['Cannot', 'Because'],
              rows: [
                [
                  'Mint GBX or reopen burned capacity',
                  'Minting is locked to the Fundraiser; the ceiling counts lifetime mints',
                ],
                ['Change the emission schedule', 'Every constant is immutable in the Fundraiser'],
                ['Withdraw or redirect Fund assets', 'The Fund has no owner and only redemption and burning as exits'],
                [
                  'Redirect Strategy payments or revenue',
                  'Destinations are immutable fields; liabilities are fixed at accrual',
                ],
                ['Move or unwind the liquidity position', 'The position contract has no owner and no outbound path'],
                ['Pause anything, including redemption', 'No pause switch exists in any core contract'],
                ['Upgrade or migrate any contract', 'All twelve are direct deployments; no proxy, no successor'],
                ['Seize or freeze staked GBX', 'SignalGBX answers only to its stakers'],
                ['Alter an existing Strategy&rsquo;s configuration', 'Auction parameters are immutable per Strategy'],
                ['Raise the eight-token reward cap', 'MAX_REWARD_TOKENS is a compile-time constant'],
                ['Sweep or rescue arbitrary assets', 'No generic call executor or sweep exists in the core'],
              ],
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'Verify, don&rsquo;t trust',
              kind: 'capital',
              body: 'Every row is checkable against the generated ABI: the functions are absent, not gated. The appendices point to the exact interfaces.',
            })}
            ${note({
              label: 'What remains possible',
              kind: 'asset',
              body: 'A hostile manager could still add a junk Strategy, kill a good one, or register useless reward tokens. Bounded harm is the honest claim - not zero harm.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'timelock',
    runner: 'The timelock',
    section: { title: 'The timelock, and a compromised key', note: 'Delay as the universal defense' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part X · Governance minimization',
          number: n(context, 'timelock'),
          title: 'The timelock, and a compromised key',
          deck: 'The intended Resonance owner is a standard OpenZeppelin TimelockController: every management action crosses a public delay before it can execute.',
        })}
        ${figureBlock({
          index: context.figure('timelock'),
          svg: fig2.timelockLifecycle({ width: widths.full }),
          caption:
            'Propose, wait publicly, execute - with cancellation available throughout the delay. Execution can be left open to anyone, so operators cannot even be a bottleneck at the finish line.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              The intended configuration: the project multisig holds the proposer and canceller roles; the executor role
              may be open; and the controller is deployed with no external admin, administering its own roles and delay
              only through its own delayed operations. Be precise about what this is: the TimelockController is a
              generic call executor, and what bounds governance is not a calldata allowlist but the narrowness of what
              Resonance exposes. The accurate claim is that Resonance offers three ongoing management methods - not that
              only three transactions could ever pass through the timelock.
            </p>
            <p>
              Now walk the nightmare: an attacker controls the multisig. They can propose - publicly, with the delay
              running - to kill Strategies, add hostile ones, or register junk reward tokens. They cannot touch anything
              on the previous page's list, because no function exists to call. The community's defenses are time and
              exit: cancel (if honest signers retain the canceller role), unwind signals, unstake, and redeem - none of
              which any key can pause. The worst credible outcome is disruption and misdirected future flow, not
              confiscation.
            </p>
            <p class="small muted">
              None of this is instantiated yet: roles, delay, and signers exist only as a deployment outline, and no
              signed manifest verifies them. Until one does, this chapter describes intent, and says so.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Why immutability is a tradeoff',
              kind: 'asset',
              body: 'The same absence of power that caps a hostile key also caps a benevolent one: bugs cannot be hotfixed, mistakes cannot be reversed, and rescue is not a phone call away. This design chooses that trade knowingly.',
            })}
            ${note({
              label: 'For everyone',
              body: 'The timelock queue is the protocol&rsquo;s only announcement channel that cannot lie. Watch it.',
            })}
          </div>
        </div>
      </div>
    `,
  },
];
