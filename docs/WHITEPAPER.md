# GumBall6900

## The index fund that chooses itself

Whitepaper v0.11 — 30 August 2026 — by Heesho

> Development status: experimental, not deployed, and not authorized for user funds. A V12 finding export was received
> for commit `3ae171b997254b56602298d873b3918d1575b3c7`, but it is not a complete assurance package or release approval;
> the current internal exitability review reconfirmed three historical behaviors. Its working-tree ADR 0052 patch adds
> an onchain bound for the prior Resonance overflow, and ADR 0053's internally verified remediation adds
> beneficiary-authorized Bribe claims plus a caller-owned Resonance claim batch. ADR 0054's one-transaction launch
> structurally removes the prior pre-handoff Mine exposure window for the canonical graph. ADR 0055 later adds Mine's
> future-revenue Router cutover and two-step Mine/Resonance ownership. Fresh independent closure remains open. Review of the fixed mining economics,
> deployment parameters, third-party provenance, governance integration, and remaining security gates is still open.
> ADR 0051's SignalGBX API and periphery, ADR 0052's cap, ADR 0053's authorization/batch changes, ADR 0054's launcher,
> and ADR 0055's migration/ownership surface remain outside V12 and require fresh independent review.

## Abstract

GumBall6900 is a proposed signal-directed onchain fund. GBX holders deposit into non-transferable SignalGBX (`sGBX`)
only while assigning every receipt unit to an acquisition Strategy. sGBX records block-clock ERC20Votes checkpoints
for a future external governance integration while continuously directing new USDG. Each Strategy exchanges USDG for
one configured asset through a reverse Dutch auction. Its acquired-asset payment uses Resonance's single global,
prospective automatic-Bribe rate. The rate defaults to 10% and is owner-settable from 0% through 20%. Strategy sends
the 80%-to-100% complement directly to an ownerless Fund and buffers the Bribe share in its paired BribeRouter. GBX
holders may burn GBX to redeem a caller-selected pro-rata share of raw Fund assets.

GBX distribution uses an immutable multislot Mine. A slot can be replaced at any time.
Its USDG price decays to zero over one hour, creating a continuously clearing market rather than a pooled daily round.
The outgoing tenure miner receives 80% of a nonzero replacement payment, while Mine deposits the 20% remainder into
ResonanceRouter for later permissionless routing into the signal-directed acquisition flow.

## 1. Economic loop

The protocol has five recurring actions:

1. A participant takes a mining slot at its current USDG price.
2. The current tenure miner accrues GBX continuously at the rate fixed when that tenure began.
3. Mine deposits protocol revenue into ResonanceRouter; a later permissionless call can enter it into a seven-day
   Resonance stream whose elapsed flow follows current sGBX signals.
4. Strategies atomically pull released USDG and exchange their accumulated balance for configured payment assets.
   Each purchase uses the current 0%-to-20% global Bribe rate, pays the complement directly to Fund, and sends the
   Bribe share to its paired reward buffer.
5. A GBX holder may burn GBX for selected Fund assets in kind.

```text
nonempty slot replacement -> 80% outgoing tenure miner claim
                          -> 20% ResonanceRouter --permissionless route()--> Resonance stream -> Strategy -> 80%-100% Fund
                                                                                                    \-> 0%-20% BribeRouter -> Bribe
empty-slot payment -> Mine --100% deposit--> ResonanceRouter

GBX -> sGBX -> live signals ------------------------------^
           \-> IVotes checkpoints -> external governance (unselected) -> Mine + Resonance owner actions
GBX burn -> selected Fund assets -> redeemer
```

The first purchase of an empty slot deposits 100% of its payment into ResonanceRouter because there is no outgoing
tenure miner.
Mine then ends without calling `route()`. There is no team,
management, or protocol fee in mining.

## 2. GBX supply and issuance

GBX's constructor starts with zero supply and zero lifetime minted. A temporary deployment minter cannot mint and
permanently assigns the only lifetime mint authority to one deployed Mine. During the canonical atomic launch, Mine
then issues exactly 1,000 GBX solely into the validated USDG/GBX genesis pair. There is no team, presale, treasury, or
discretionary allocation. The handoff and fixed genesis issuance cannot be replaced or reopened.

There is no protocol-defined economic maximum GBX supply. The global issuance rate used for future tenures halves at
fixed intervals measured from Mine deployment and eventually reaches a strictly positive tail. The tail allows mining—and
therefore potential USDG inflow—to continue indefinitely. GBX retains ERC-2612 permit approvals but does not carry
governance checkpoints. Mine hard-codes a 64 GBX-per-second initial global rate, a provisional 69-day halving period,
and a 1 GBX-per-second global tail; those values still require independent economic review.

The supply identity is simple:

```text
total GBX supply = lifetime GBX minted - lifetime GBX burned
```

`Mine.totalMined` counts settled slot emission only. `GBX.lifetimeMinted` also includes the fixed 1,000 GBX genesis
amount once Mine consumes that one-time path.

## 3. The mining market

Mine starts with exactly sixteen permanent slots. Every slot has a replacement price that begins at its
`initialPrice` and falls linearly to zero across one hour. After a replacement, the next initial price is twice the paid
amount, bounded below by 1 USDG and above by `type(uint192).max` raw units.

A participant is buying two things: the right to accrue GBX until replacement and a claim to 80% of the next
positive-price replacement payment. The second component is not guaranteed. The current miner may replace its own
slot, and a replacement may occur for zero USDG after one hour; either no later replacement or a zero-price
replacement produces no nonzero claim. This rollover risk acts like a market discipline on entry price.

The market can clear frequently without a single end-of-day transaction. Miners can compare the current price with
the expected value of accrued GBX, the uncertain replacement claim, GBX liquidity, gas, and risk. None of those economic
outcomes is guaranteed by the contract.

Because price falls with elapsed time and resets upward on every replacement, a pending transaction can be invalidated by
whoever lands first. `mine` therefore takes three caller-supplied bounds. An `epochId` must equal the slot's current
epoch, so a transaction written against one tenure cannot execute against a later tenure. A `deadline` bounds how long
the transaction may remain valid. A `maximumPayment` caps what the caller will pay. Without these a miner front-run at
the moment of purchase would pay the reset opening price—twice the amount just paid—rather than the
decayed price they submitted for. Each bound is supplied per call; the contract holds no allowance for slippage of its
own. When the quoted TPS must also remain valid, the caller sets `deadline` strictly before the next time-based halving
boundary; `epochId` and `maximumPayment` do not bind the assigned rate.

## 4. Fixed-tenure fairness

A slot's TPS rate is written when a tenure begins and remains fixed until the next replacement. It is not changed by
a time-based halving boundary, Fund redemption, or another slot's replacement.

The initial global rate is 230,400 GBX/hour. Each new tenure receives one sixteenth, or 14,400 GBX/hour. If the global
rate later halves, that existing tenure still receives 14,400 GBX/hour while a new tenure receives 7,200 GBX/hour.

The accepted cost is aggregate issuance above the current global rate while old high-rate tenures coexist with new
divided-rate slots. It falls slot by slot only as older tenures are replaced; turnover has no deadline and is not
guaranteed. Integer division residue for a new slot is unissued.

## 5. Accrual and redemption supply

GBX accrues continuously but each slot mints its accrued amount only when the tenure is replaced. Mine maintains the total pending emission
with one aggregate TPS accumulator while all sixteen slots remain on independent schedules.

Fund reads Mine's constant-time effective supply before capturing a redemption denominator. Therefore a redemption
cannot ignore GBX that miners already earned, and it does not call or mutate every mining slot.

Fund computes every selected payout against the same effective pre-burn supply:

```text
payout(token) = floor(Fund balance(token) * GBX burned / (GBX totalSupply() + pending emission) before burn)
```

The burn and every selected transfer are atomic. A redeemer may omit a broken or unwanted token, but that omitted
claim is permanently left for remaining GBX holders.

## 6. Signals and acquisitions

`addSignal` deposits GBX and mints sGBX one-for-one only while assigning every raw unit to a live Strategy in the same
transaction. `addSignalMany` performs that transition across a caller-supplied Strategy array while transferring and
minting the aggregate once. sGBX is non-transferable, retains ERC20Votes, and is the only user-facing signal
coordinator. A first addition made with no current delegate self-delegates voting power. Canonical GBX is trusted to
move the requested amount without balance-delta verification. SignalGBX consumes no permit signature; a smart account
may atomically batch a GBX approval with direct signal calls. Idle sGBX and standalone staking or unstaking are not
valid protocol states.

`removeSignal` removes one selected Strategy and paired-Bribe position, burns the same sGBX amount, and returns the
same GBX atomically. `removeSignalMany` applies every requested removal before burning and returning the aggregate
once. Batch entries use the same restricted Resonance hooks and incremental events as the scalar operations. Empty or
zero-valued batches revert, duplicate Strategies execute sequentially, and any failed entry rolls back the complete
batch. Scalar removal remains available when a larger batch is stale or too expensive. There is no public move or
write-through Router; a reallocation is a removal plus an addition, which smart wallets may compose atomically.

Signal state has one canonical owner at each layer. SignalGBX balance is the account's complete signaled amount. Each
Strategy's paired Bribe stores `signalWeightOf(account)` and that Strategy's complete `totalSignalWeight`. Resonance stores
only the active total across live Strategies and accepts signal mutation hooks only from SignalGBX. A separate
`allocatedBalance` duplicate is not maintained.

Resonance schedules forwarded USDG in one active seven-day stream. Each signal mutation first checkpoints the elapsed
interval under the old weights, so a signal changed now affects later flow without a lock, cooldown, or voting epoch. A
Strategy purchase checkpoints and pulls its released share before reading auction inventory. Consequently, signaling a
thin Strategy, separately routing newly deposited mining USDG, and filling its stale cheap auction in one transaction cannot capture that new
USDG: no stream time has elapsed.

The schedule follows the ordinary Synthetix whole-unit rate and leftover rollover. Elapsed release is
`seconds * revenueRate`; division residue is unallocated USDG surplus. Its global revenue-per-signal index uses `1e36`
precision. A monotonic lifetime counter admits at most `floor(type(uint256).max / 1e36)` fresh raw USDG and rejects
excess before checkpointing or token interaction, keeping signal exits representable at the minimum one-raw-unit
denominator. ResonanceRouter waits until someone calls `route()`. It holds a balance smaller than seven days in raw
units, which would create a zero rate, and during an active period also holds a balance smaller than the scheduled
amount remaining. A qualifying notification checkpoints elapsed revenue and restarts seven days with
`new revenue + remaining revenue`.
The second threshold prevents a small permissionless top-up from cheaply slowing an existing stream.

Mine's `RevenueDeposited` event records the nominal `SafeERC20` transfer requested into ResonanceRouter. Under the
supported standard-USDG model that amount arrives, but Mine does not verify the balance deltas. `route()` has no caller
role or bounty, so revenue may remain there indefinitely even after qualifying. A manual caller, frontend, volunteer
keeper, or cron process may advance it. This optional periphery does not affect Mine replacement correctness or liveness.

<!-- pdf-page-break-padded -->

Settlement remains lazy—ordinary signal, distribution, purchase, and qualifying-notification calls materialize elapsed
revenue—so the protocol needs no per-second keeper. Global-index and per-Strategy floors are accepted surplus rather
than explicit carry. Stream time continues when active signal weight is zero, making that interval's emission
unclaimable, and direct USDG donations to Resonance are unscheduled surplus. Neither category is assigned to Fund or
later signalers. Killing a Strategy checkpoints and preserves its pre-kill claim, removes its complete weight from future
revenue, forbids additions, and leaves existing signalers free to exit. After the first Strategy is registered, the
final live Strategy cannot be killed until the Resonance owner adds a replacement.

Signals steer future flow; they do not force Fund to sell past holdings or maintain a target portfolio. Before a
payment-token interaction, Strategy snapshots Resonance's current global automatic-Bribe rate. The rate defaults to
10%, may be set from 0% through 20%, and makes Fund's share its 100% complement. For each payment `a` at rate `r`,
Strategy computes `bribeAmount = floor(a * r / 10,000)`, pays `a - bribeAmount` directly to Fund, and sends a nonzero
Bribe share to BribeRouter. There is no cumulative split carry or deferred Fund liability. A rate change affects only
later purchases. At 0%, the complete new payment goes directly to Fund, while signals, existing rewards, and
independently funded Bribe rewards remain live.

BribeRouter is only a small availability buffer. Anyone may call `route()` for its complete payment-token balance once
it can sustain a nonzero seven-day rate and, during an active stream, covers the scheduled amount left. A failed Bribe
notification cannot revert the already completed auction purchase; the tokens remain in the Router. The acquired
payment asset, not USDG, is the automatic Bribe reward. Direct compatible-token donations join the next route.

Each Bribe supports at most sixteen append-only reward tokens and uses a `1e36` reward-per-signal index so low-decimal
rewards remain useful over 18-decimal signal weight. Its multi-token accounting otherwise follows Synthetix: one
four-field stream per registered token, ordinary leftover rollover, and an all-token claim. A scalar claim is retained
so one broken reward token need not block another. Reward time does not pause at zero `totalSignalWeight`, notifications are
not queued, and rate/index/account division floors remain unallocated token surplus rather than explicit carry or Fund
liabilities.
Direct Bribe claims authorize only the beneficiary or the Bribe's immutable Resonance. Resonance can batch all-token
claims across caller-selected registered live or killed Strategies, but always for `msg.sender`; direct scalar claims
remain the broken-token and gas fallback.
Each reward token also has a monotonic lifetime accepted-notification limit of
`floor(type(uint256).max / 1e36)` raw units. It is checked before reward checkpointing or token transfer and cannot be
reset, so claims can never reopen capacity. A normal 18-decimal token would require about `1.158e23` whole tokens to
reach it. If an irregular token does reach it, existing signalers can still claim rewards or remove their positions;
smart accounts may reallocate with direct remove/add calls. A new Strategy and Bribe must replace the exhausted pool.
An automatic reward amount rejected at the cap remains buffered in
BribeRouter. The old killed Bribe remains a closed reward pool without an escape hatch.

## 7. Permanently locked genesis liquidity and an ordinary LP Strategy

The single-use GBX launcher calls the pinned Robinhood Chain Uniswap V2 Factory to create a new USDG/GBX pair, seeds
exactly 1 USDG and Mine's fixed 1,000 GBX genesis issuance, and mints the complete genesis LP supply to the zero address.
It never adopts or skims an existing Pair. If the Pair already exists for that launcher's deterministic GBX, the launch
reverts and a fresh launcher produces a different GBX and Pair through caller-scoped CREATE2 outputs. No LP holder can
burn those units to remove the seed as liquidity, although swaps can still change the pair's reserves. In the same atomic transaction, the launcher
registers GBX and the actual LP token as the two initial Strategy payment assets, removes every temporary setup owner,
and makes the reviewed external governance contract pending owner of Mine and Resonance. That contract must accept both
roles after launch.

Only the genesis LP is locked. LP tokens minted later remain ordinary fungible assets: Strategy applies the same
global Fund/Bribe split, and any LP reaching Fund is caller-selectable redemption backing. Neither the launcher nor
the core manages, prices, rebalances, compounds, harvests, swaps, or guarantees liquidity after launch.

## 8. Governance and immutability

The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. SignalGBX retains
non-transferable ERC20Votes checkpoints on the block-number clock, but the core assigns them no proposal, quorum,
delay, cancellation, or execution semantics. Mine and Resonance are the only core contracts with continuing custom
owner authority. Resonance's protocol administration methods are:

- add a Strategy;
- permanently kill a Strategy;
- register a Bribe reward token, subject to the immutable sixteen-token cap;
- set the global prospective automatic-Bribe rate from 0% through 20%.

Mine's sole custom owner action is a structurally validated change to the Router that receives future protocol revenue.
It cannot change slots, prices, emissions, mint authority, Fund assets, old graph state, or user positions.

Mine and Resonance use `Ownable2Step`; their owners can transfer or immediately renounce ownership. SignalGBX,
StrategyFactory, and BribeFactory retain setup-only inherited ownership shells after their one-time Resonance bindings,
with no remaining custom owner action. Production must renounce those consumed shells. The launcher makes the selected
external executor pending owner of both Mine and Resonance, and that executor must accept both roles after launch. It
remains unselected. A later ADR must pin and review the external governance provider, exact release and deployed code,
plugins, SignalGBX compatibility, permissions and administrators, upgrade model, proposal rules, batching, delay,
cancellation, and both ownership handoffs. Until then deployment is blocked.

Mine has exactly sixteen slots and no owner path to change slot capacity, reprice a tenure, or alter emissions. Fund is
ownerless. No core contract has a proxy, general executor, pause switch, rescue function, emission setter, successor,
or state-migration path. Deployment must bootstrap reviewed initial Strategies and remove temporary setup authority
before beginning both two-step ownership handoffs.

<!-- pdf-page-break -->

## 9. Important risks

- GBX price, liquidity, mining profitability, replacement frequency, Strategy fills, and Fund value are uncertain.
- A mining tenure can be replaced at any time and is not guaranteed a nonzero 80% replacement claim.
- Legacy tenures can keep aggregate issuance above the prospective global rate indefinitely if they never turn over.
- A bad immutable dependency or contract bug cannot be patched. Governance can redirect only future Mine revenue to a
  validated graph; old balances and positions remain.
- SignalGBX checkpoints do not lock withdrawals. If the selected external governance system uses historical snapshots,
  a holder may withdraw after the snapshot and retain that proposal's weight. Its delegation, quorum, capture, and
  liveness properties require separate review.
- The external governance system is unselected. The core guarantees no proposal filter, delay, cancellation path,
  guardian, open executor, immutable voting configuration, or external-governance upgrade boundary.

<!-- pdf-page-break -->

- The Resonance owner can change the automatic-Bribe share immediately within its 0%-to-20% bound. Transaction
  ordering determines which rate a pending Strategy fill snapshots; the external governance review must address delay
  and execution transparency.
- Permissionless signaling permits rapid allocation movement, but only stream time held at a weight earns new flow;
  existing Strategy inventory, qualifying-reset timing, and accepted rounding surplus still have timing considerations.
- Broken or blocklisting tokens can block their own payout paths.
- Mine and SignalGBX trust the canonical GBX and USDG implementations to move requested amounts;
  `SafeERC20` does not prove sender or receiver balance changes. Fund retains explicit checks for arbitrary selected
  redemption assets.
- An exhausted Bribe lifetime notification cap permanently rejects that token's later notifications in the old pool;
  replacement requires a new Strategy and paired Bribe rather than a reset or rescue.
- Fund assets omitted from redemption remain permanently for the post-redemption supply.
- The received V12 export lacks an explicit scope, methodology, named auditor, date, signature, and report-level
  rationale. The internally revalidated register accepts the theoretical index-overflow condition, retains a
  pre-exposure deployment check, and records ADR 0053's internally verified but independently unreviewed working-tree
  claim-authorization remediation; it does not clear release.
  Donut-miner/give.fun/Liquid Signal provenance also remains legally unresolved.

## 10. Status

This repository contains development contracts, independent TypeScript/Python economic models, Foundry and Hardhat
tests, an SDK, a subgraph, and a read-only interface. Local passing checks and the received finding export are bounded
engineering/review evidence only. They are not evidence of deployment, legal clearance, or production readiness.
