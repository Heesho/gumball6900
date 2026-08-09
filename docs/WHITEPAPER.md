# GumBall6900

## A signal-directed onchain fund

Whitepaper v0.1 - August 2026

> **Development status:** GumBall6900 is an experimental, pre-audit protocol design. It is not deployed and is not
> authorized for user funds. This paper describes the intended governance-minimized final system. The current
> development contracts still have a broader administrative surface and must be reconciled with this specification
> before deployment.

## Abstract

GumBall6900 is a proposed onchain fund in which holders continuously direct new capital toward eligible assets. Anyone
can mine GBX by contributing USDG through a fixed public Fundraiser schedule. A holder may stake GBX one-for-one into
non-transferable SignalGBX, ticker `sGBX`, and signal the active Strategies for assets they want the protocol to
accumulate.

Incoming USDG follows current signals. A normal Strategy uses a bounded reverse Dutch auction to exchange that USDG
for its target asset without requiring the core protocol to maintain a price oracle. After an acquisition, 90% of the
received asset enters a shared Fund and 10% is streamed to eligible signalers of that Strategy. GBX holders may burn
GBX to redeem a proportional, in-kind share of caller-selected Fund assets.

The result is not a token that tracks a predetermined index. It is a mechanism for forming a basket over time. Signals
direct future flow rather than forcing the Fund to sell existing holdings. The intended final contracts are deployed
once, are not upgradeable, and expose only four management actions on Resonance: add a Strategy, kill a Strategy,
change the signal-reward share within a fixed bound, and add Bribe rewards.

The fixed Fundraiser emission also creates a recurring market for new GBX. If GBX has a usable market price and enough
liquidity, miners can compare the value of each day's emission with the USDG currently competing for it. Profitable
mining attracts more USDG until competition compresses the opportunity. Every contributed USDG is then committed to
the signal-directed acquisition path.

## 1. The problem

Traditional funds make a basket easier to own, but investors normally receive a finished methodology. Membership,
weighting, and rebalancing decisions are made upstream. Onchain index products often preserve the same structure: the
basket moves onchain, while formation of the basket remains a separate process.

GumBall6900 starts from a different question:

> What if holders continuously directed where the fund's next dollar went?

This changes the unit of coordination. Holders do not periodically vote on a complete target portfolio. They signal
among eligible acquisition paths, and every new unit of protocol revenue follows the signal distribution that exists
when it is routed.

The Fund therefore records past acquisitions, while signals express present preferences. A changed signal affects
future capital. It does not automatically sell assets already held.

## 2. Design goals

The target system is designed around six goals:

1. **Fair public distribution.** GBX is mined through the Fundraiser without a team, founder, investor, presale, or
   advisor allocation. The separate 20 million GBX genesis tranche is committed to canonical liquidity.
2. **Continuous holder direction.** Absolute per-Strategy `sGBX` amounts may be increased or decreased independently at
   any time. There is no voting season, allocation epoch, signal cooldown, forced whole-account reset, or withdrawal
   lock on unallocated `sGBX`.
3. **Real assets, not a synthetic index number.** The Fund holds raw tokens and redemption transfers selected tokens in
   kind. The core does not need a protocol-wide net asset value oracle.
4. **Market-based acquisition.** Reverse Dutch auctions let external buyers decide when an acquisition price is
   acceptable.
5. **Governance minimization.** Signals govern capital direction. Management maintains only four explicitly authorized
   edges, each bounded, and the deployed core cannot be upgraded.
6. **Inspectability.** Each contract has a narrow responsibility so money flow and failure boundaries remain legible.

### 2.1 Non-goals

GumBall6900 does not promise a stable GBX price, a fixed portfolio composition, automatic rebalancing, guaranteed
auction execution, guaranteed signal rewards, or protection from the risks of assets received by the Fund.

## 3. System overview

The economic loop has five steps:

1. **Mine.** A contributor sends USDG to the Fundraiser and earns GBX from the public emission schedule.
2. **Signal.** A holder stakes GBX into `sGBX` and allocates signal weight among active Strategies.
3. **Route.** Resonance distributes newly received USDG according to current signal weights.
4. **Acquire.** A Strategy exchanges accumulated USDG for its target asset through a bounded reverse Dutch auction.
5. **Redeem.** A holder burns GBX for a proportional share of selected assets already held by the Fund.

Revenue follows the normal path:

`Fundraiser -> ResonanceRouter -> Resonance -> Strategy`

All contribution revenue enters through a single router. There is no second path into the Fund and no discretionary
wallet in between. The routing layer does not decide which asset deserves capital: it reads the live `sGBX`
distribution and applies it.

## 4. Protocol components

The conceptual system can be understood through six pieces:

- **USDG:** the stable asset contributed and routed toward acquisitions.
- **GBX:** the transferable protocol token, subject to a one billion lifetime mint ceiling.
- **SignalGBX (`sGBX`):** non-transferable staked GBX that measures an account's live signal weight.
- **Strategy:** an eligible destination for USDG, normally an asset acquisition or GBX buyback.
- **Resonance:** the allocation engine that distributes newly received USDG according to current signals.
- **Fund:** the permissionless raw-token treasury that holds acquired assets and supports in-kind redemption.

Additional narrow contracts handle fundraising, the canonical liquidity position, Strategy and Bribe creation, revenue
routing, auctions, and signal rewards. These implementation boundaries matter for engineers, but a holder can reason
about the protocol through the six pieces above.

## 5. GBX mining and supply

GBX has a cumulative lifetime mint ceiling of:

`1,000,000,000 GBX`

The intended distribution is:

- **20,000,000 GBX (2%):** genesis liquidity only.
- **980,000,000 GBX (98%):** public Fundraiser mining capacity.
- **0 GBX:** team, founder, investor, presale, or advisor allocation.

In this paper, _mining_ means contributing USDG through the public Fundraiser and receiving the GBX emitted for that
contribution period. It does not mean proof-of-work.

The Fundraiser follows a fixed daily declining schedule. The initial scheduled daily emission is
`465,152.749681042811702004 GBX`, multiplied each day by a decay factor of `0.999525354337060160`. This corresponds to a
1,460-day, or four-year, half-life. Contributions within a day share that day's emission proportionally. An empty day
forfeits its scheduled emission; it does not carry forward.

The two constants are not independent, and the relationship between them is the point. The opening emission is derived
from the decay factor so that the schedule pays out its own allocation and no more:

`E_0 = A x (1 - d)`, so `sum over t of E_0 x d^t = E_0 / (1 - d) = A`

where `A` is the 980,000,000 GBX mining allocation and `d` is the daily decay factor. Summing the entire infinite
schedule returns the allocation exactly, so the mining cap is a property of the arithmetic rather than a separate
check. Each four-year period closes half the remaining distance to it: about 50% of the allocation is emitted by year
four, 75% by year eight, and 93.75% by year sixteen. The daily emission never reaches zero, and the total never exceeds
980,000,000 GBX.

Burning GBX never reopens mint capacity. Cumulative minting can never exceed one billion GBX even if previously minted
tokens have been burned.

### 5.1 The mining market

The Fundraiser does not sell GBX at a fixed price. It distributes a fixed scheduled emission for the day across that
day's contributors in proportion to their USDG contributions.

Let:

- `E_t` be the GBX emitted on day `t`;
- `c_i` be miner `i`'s USDG contribution; and
- `C_t` be all USDG contributed that day.

Ignoring integer flooring, miner `i` receives:

`GBX_i = E_t x c_i / C_t`

If GBX trades at `P_t` USDG per GBX, the gross market value of that day's emission is:

`gross emission value_t = P_t x E_t`

Before gas, slippage, timing, contract, and market risk, mining is attractive while total daily contributions are below
the value miners expect to realize from the emission. Competition therefore creates a rough break-even benchmark:

`C_t ~= P_t x E_t`

This relationship is self-adjusting. A higher GBX price or larger daily emission can support more USDG contributions.
If contributions are low relative to the emission's market value, the implied GBX cost is lower and new miners have an
incentive to enter. As more USDG competes for the same emission, each USDG earns less GBX and the margin compresses.

For example, suppose a day emits 100,000 GBX and GBX trades at 0.50 USDG. The gross emission value is 50,000 USDG. If
only 20,000 USDG has been contributed, the average gross acquisition cost is about 0.20 USDG per GBX before expenses and
risk. That gap can attract more miners. Near 50,000 USDG of total contributions, the simple spot-price margin is mostly
competed away.

This is why a liquid GBX market can continuously pull USDG into the protocol. It is not an unconditional guarantee that
miners will participate. A quoted GBX price must be realizable with enough liquidity, miners must be able and willing to
act, and expected value must exceed costs and risks.

The contract-level guarantee is narrower and stronger:

1. every USDG contribution enters the signal-directed acquisition path rather than a discretionary team wallet;
2. miners compete for a fixed scheduled GBX emission rather than a team-selected sale price; and
3. when a normal acquisition succeeds, the acquired target asset splits between the Fund and signal rewards at the
   current share, and the Fund always receives the majority.

GBX price and liquidity create the incentive to contribute. The fixed routing and acquisition rules determine what
happens after a contribution. Fund growth still depends on contributions occurring and acquisitions clearing.

## 6. Signaling with sGBX

A holder may stake GBX one-for-one to receive non-transferable `sGBX`. The holder then allocates that signal weight
among active Strategies.

If the active Strategies target NVDA, AAPL, SPCX, or another eligible onchain asset, a holder can signal the Strategy
for the asset they personally want to accumulate. When that Strategy completes acquisitions, the signal-reward share
is streamed in the acquired asset across eligible signal balances.

The simple version is:

- want to accumulate the NVIDIA-linked asset: signal NVDA;
- want to accumulate the Apple-linked asset: signal AAPL;
- want to accumulate a SpaceX-linked asset: signal SPCX; and
- want something else: signal its Strategy once an eligible onchain asset and active Strategy exist.

Signaling is continuous and incremental. Each call adds or removes an absolute amount from one Strategy, or applies a
bounded batch of those deltas. The amount is a delta, not a target or a relative weight. A holder may leave some `sGBX`
unallocated and withdraw that unallocated balance immediately. Allocated `sGBX` remains staked until the holder removes
the corresponding signals; no whole-account reset is required.

Signaling alone does not guarantee a reward. The selected Strategy must receive capital and complete an acquisition,
and the holder's reward depends on eligible signal weight during distribution.

## 7. Capital allocation

Let `S_i` be the active signal weight assigned to Strategy `i`, and let `S_total` be the total active signal weight
across Strategies. When Resonance distributes revenue `R`, Strategy `i` receives:

`allocation_i = floor(R x S_i / S_total)`

Rounding and no-signal behavior are implementation details that must preserve value and avoid discretionary routing.
Conceptually, the formula means that a Strategy holding 30% of active signal weight receives about 30% of the next
distribution.

`S_total` may be smaller than the total `sGBX` supply because holders may leave balances idle. Idle `sGBX` earns no
Strategy reward and does not dilute active signalers; only explicitly allocated amounts participate in routing and
Bribe accounting.

Signals apply when new revenue is distributed. If preferences change after an acquisition, existing Fund holdings do
not automatically rebalance. This makes the basket path-dependent: its composition reflects the full history of
contributions, signals, and completed acquisitions.

## 8. Acquisitions

A normal Strategy accumulates USDG and runs a reverse Dutch auction for its target asset.

The direction matters, so state it plainly: the Strategy is the seller of USDG. It offers its accumulated USDG balance
and asks a filler to hand over a quantity of the target asset in exchange. The auction opens by demanding a large
quantity — a good deal for the protocol and a bad one for the filler — and that demand decays linearly to zero as the
epoch elapses:

`payment(t) = init - floor(init x t / period)`

There is no floor price. If nobody fills, the requirement reaches zero at the end of the epoch. The moment a filler
chooses to act is itself the price discovery. The swap is atomic: the filler receives the USDG and the target asset
enters protocol flow in the same transaction.

After a fill at payment `p`, the next epoch opens at `p` multiplied by a bounded price multiplier, floored at a
configured minimum. That ratchet is what removes the oracle. The protocol never reads a price; it proposes one,
observes whether the market takes it, and adjusts. A fill that arrives early says the opening ask was too generous and
the next epoch opens higher; a fill that arrives late, or not at all, says the opposite.

Auction parameters are bounded by construction: the epoch period between one hour and one year, and the price
multiplier between 1.1x and 3x. Those bounds constrain how fast the ratchet can move, not where it settles.

This design avoids requiring the core protocol to maintain a price feed for every possible asset. It does not remove
market risk. Poor liquidity, unusual token behavior, thin participation, or badly chosen epoch and multiplier
parameters can still lead to delayed or unfavorable execution.

## 9. Fund formation and signal rewards

After a normal acquisition, the target asset splits in two:

- **90% enters the Fund.** This becomes shared raw-token backing available through proportional in-kind redemption.
- **10% funds signal rewards.** The Strategy's Bribe streams the asset across eligible signal balances.

The 10% signal-reward share is the launch value, not a constant. It is adjustable through timelocked governance and is
bounded: it may never exceed 50%, so a majority of every acquisition always reaches the Fund. Raising it moves value
from shared backing toward the holders who directed that specific acquisition; lowering it does the reverse. If no
eligible signalers exist, the signal-reward share returns to the Fund regardless of its setting.

This structure combines a common benefit with a personal incentive. Most of each acquisition strengthens the shared
basket, while the smaller share lets a holder earn the asset they chose to signal.

Rewards are streamed rather than airdropped. They accrue against signal weight held over the distribution period
using a reward-per-weight accumulator, so signaling immediately before a fill does not retroactively earn the whole
reward.

### 9.1 Following one contribution

The following trace is illustrative and assumes every step completes. None of them is guaranteed.

1. **Mine.** A contributor sends 1,000 USDG on a day scheduled to emit 100,000 GBX where 50,000 USDG is contributed in
   total. They receive 2,000 GBX, a 2% share of the day. A quieter day would have produced more GBX for the same
   1,000 USDG.
2. **Signal.** They stake the 2,000 GBX into 2,000 `sGBX` and allocate all of it to the NVDA Strategy.
3. **Route.** The 1,000 USDG reaches `ResonanceRouter`, then Resonance, which reads live weights. If the NVDA Strategy
   holds 30% of active signal weight, that Strategy receives about 300 USDG. Capital follows the aggregate
   distribution, not the preference of the specific contributor who supplied it.
4. **Acquire.** The Strategy offers its accumulated USDG and the required NVDA payment decays until a filler acts.
5. **Split.** 90% of the received asset enters the Fund; 10% streams to eligible NVDA signalers, including this
   holder.
6. **Redeem.** Later, the holder burns GBX and names the Fund assets they want, receiving a proportional share of
   exactly those assets, in kind.

## 10. Fund behavior and redemption

The Fund is a permissionless raw-token treasury, not a curated asset registry. Official protocol membership is
represented by active Strategies, not by a list inside the Fund. Any ERC-20 sent to the Fund may become part of GBX
backing.

A holder redeems by supplying:

- an amount of GBX to burn;
- a receiver; and
- a caller-selected list of unique, non-GBX token addresses.

For each selected token `j`, the transfer is:

`payout_j = floor(FundBalance_j x GBXBurned / GBXSupplyBeforeBurn)`

Example: if a holder burns 1,000 GBX while supply is 100,000 GBX, the holder is redeeming 1%. If the Fund holds 50,000
units of Asset X and 8,000 units of Asset Y, selecting both returns 500 X and 80 Y, subject to integer flooring.

The supply and token balances are snapshotted before the burn. The burn and every selected transfer are atomic. If one
selected token transfer fails, the full redemption reverts, including the burn.

A holder may omit an unwanted or broken token. The omitted claim is permanently forfeited and remains for the GBX
supply that continues after redemption. This selective design avoids making every Fund asset a mandatory dependency
of every redemption.

## 11. Liquidity compounding and buybacks

The canonical market position is a precommitted, hookless GBX/USDG Uniswap v4 position funded with the 20 million GBX
genesis allocation.

The position removes zero principal. Its permissionless `compound` operation increases position liquidity by a fixed
0.20% and pays the caller everything accrued by the position. Uniswap v4 nets accrued fees against the increase, so the
caller funds only any shortfall. Position fees are the compounding incentive: they are not protocol revenue, do not
burn GBX, and do not enter ResonanceRouter.

A buyback Strategy uses USDG to buy GBX and burns all received GBX atomically. Buybacks pay no signal reward. They are a
separate route for protocol-directed capital and must not leave purchased GBX sitting as treasury inventory.

## 12. Governance-minimized final design

GumBall6900 separates economic direction from maintenance.

`sGBX` holders direct capital continuously by signaling active Strategies. The intended final management authority has
exactly four callable actions on Resonance:

1. add a Strategy;
2. kill a Strategy;
3. change the signal-reward share, within its 0-50% bound; and
4. add Bribe rewards, subject to each Bribe's lifetime maximum of eight reward tokens.

There is no general call executor, proxy upgrade, successor migration, arbitrary treasury withdrawal, pause function,
or general parameter setter. The system is deployed as direct contracts and the core rules cannot be rewritten after
deployment.

Changing the signal-reward share moves the split between shared backing and directed rewards, and its
bound guarantees the Fund keeps a majority of every acquisition. It cannot redirect either share to a third party, and
it cannot reach the Fund's existing holdings.

The timelock owns Resonance; the project multisig proposes or cancels actions, and execution may be permissionless after
the documented delay. Whether additional Bribe reward tokens should exist at all remains an open owner decision. The
eight-token cap bounds lifetime loop growth but does not make multi-token reward registration desirable by itself.

Immutability reduces governance power, but it also makes mistakes permanent. That tradeoff is part of the design, not a
claim that immutable code is automatically safe.

## 13. Core invariants

The final implementation should make the following properties explicit and testable:

1. cumulative GBX minting never exceeds one billion;
2. burning GBX never restores mint capacity;
3. Fundraiser emissions follow the fixed sequential daily schedule;
4. all contribution revenue enters the signal-directed routing path;
5. absolute per-Strategy `sGBX` signals change by incremental deltas, never exceed the account's staked balance, and
   leave unallocated `sGBX` immediately withdrawable;
6. redemption uses pre-burn supply and balance snapshots;
7. a redemption burn and all selected transfers are atomic;
8. a normal acquisition splits the acquired asset at the current signal-reward share, which starts at 10% and can
   never exceed 50%, and returns that share to the Fund when no eligible signalers exist;
9. a buyback burns all received GBX atomically and pays no signal reward;
10. each Bribe registers at most eight append-only reward tokens;
11. permissionless liquidity compounding increases position liquidity by 0.20%, removes no principal, and pays the
    caller all accrued position fees; and
12. the deployed core has no upgrade or arbitrary asset-withdrawal path.

## 14. Risks and trust assumptions

GumBall6900 remains exposed to meaningful risks:

- **Smart-contract risk.** A coding error can break routing, auctions, rewards, burns, or redemption. Immutability can
  make the consequences permanent.
- **Manager-key risk.** A compromised proposer can schedule misuse of the four authorized actions, including pushing the
  signal-reward share to its 50% cap, even though it cannot upgrade the
  core or withdraw Fund assets.
- **Signal concentration.** Large `sGBX` holders may direct a disproportionate share of future capital.
- **Market execution.** Auctions depend on buyers, liquidity, pricing bounds, and target-token behavior.
- **Asset quality.** The Fund can receive unwanted, malicious, frozen, rebasing, fee-on-transfer, or otherwise broken
  tokens.
- **Selective-redemption risk.** Selecting a broken token can revert the call; omitting a token permanently forfeits
  that claim.
- **Stable-asset and chain risk.** USDG, the execution chain, bridges, sequencers, and external market infrastructure
  introduce dependencies outside the core contracts.
- **Economic risk.** Demand for GBX, signal participation, auction fills, and the value of Fund assets are not
  guaranteed.
- **Legal and regulatory risk.** Tokenized assets may have issuer, custody, transfer, eligibility, and jurisdictional
  restrictions that differ from direct ownership of an underlying asset.

## 15. Implementation status

This whitepaper specifies a target final design, not a deployed system.

The current repository is a pre-audit engineering starting point. Its contracts, generated interfaces, indexing layer,
deployment scripts, and technical documentation require independent review and must remain reconciled before any
deployment.

At minimum, production would require:

- final contract interfaces matching the four-action Resonance management surface;
- an owner decision on whether multi-token Bribe rewards should exist;
- complete unit, integration, invariant, and economic-model tests;
- reviewed asset and chain configuration;
- reproducible deployment rehearsals;
- independent security review; and
- explicit resolution of every open trust, licensing, and operational question.

A passing local build is engineering evidence only. It is not an audit, authorization, or launch claim.

## 16. Conclusion

GumBall6900 is an attempt to turn fund formation into a continuous onchain process.

GBX represents a transferable claim that can be redeemed against selected assets already held by the Fund. `sGBX`
expresses where newly arriving capital should go. Strategies turn that signal into acquisitions, and the resulting
history becomes the basket.

The distinction is simple:

- **GBX relates to what the Fund already owns.**
- **sGBX directs what the Fund may acquire next.**
- **The fixed core defines the rules both must follow.**

The protocol does not promise that holders will select the best assets, that auctions will always clear, or that GBX
will retain value. Its proposition is narrower: public mining, continuous signals, market-executed acquisitions,
in-kind redemption, and a governance-minimized core can make capital allocation more open and inspectable.

## Glossary

- **Bribe:** the Strategy-specific reward contract that streams acquired assets across eligible signal balances.
- **Fund:** the raw-token treasury that holds acquired assets and supports selective in-kind redemption.
- **Fundraiser:** the public USDG contribution mechanism through which GBX is mined.
- **GBX:** the transferable protocol token with a one billion lifetime mint ceiling.
- **Resonance:** the allocation engine that distributes incoming USDG according to live `sGBX` signals.
- **SignalGBX (`sGBX`):** non-transferable staked GBX; only explicitly allocated amounts become live signal weight.
- **Strategy:** an active, eligible acquisition or buyback path.
- **USDG:** the stable asset contributed and routed through the protocol.

## Document basis

This paper summarizes the intended target design recorded in the GumBall6900 repository as of 8 August 2026. The
technical source of truth remains the final reviewed contracts and their matching specifications. If this paper and the
deployed bytecode ever disagree, the bytecode controls system behavior.

Educational protocol overview only. Nothing in this document is investment, legal, or tax advice.
