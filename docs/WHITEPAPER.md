# GumBall6900

## The index fund that chooses itself

Whitepaper v0.8 — 23 August 2026 — by Heesho

> Development status: experimental, not deployed, not independently audited, and not authorized for user funds.
> Independent review of the fixed mining economics, deployment parameters, third-party provenance, and security remain
> open release gates. ADRs 0031 and 0033-0048 are authoritative development decisions; ADRs 0042 and 0043 record the
> current provisional Mine rates and period. Governance execution and the production Resonance owner remain an unselected
> external integration, so deployment is blocked.

## Abstract

GumBall6900 is a proposed signal-directed onchain fund. GBX holders deposit into non-transferable SignalGBX (`sGBX`)
only while assigning every receipt unit to an acquisition Strategy. sGBX records block-clock ERC20Votes checkpoints
for a future external governance integration while continuously directing new USDG. Each Strategy exchanges USDG for
one configured asset through a reverse Dutch auction. Its acquired-asset payment uses Resonance's single global,
prospective automatic-Bribe rate. The rate defaults to 10% and is owner-settable from 0% through 20%. Strategy sends
the 80%-to-100% complement directly to an ownerless Fund and buffers the Bribe share in its paired BribeRouter. GBX
holders may burn GBX to redeem a caller-selected pro-rata share of raw Fund assets.

GBX distribution uses an immutable multislot Mine. A slot can change hands at any time.
Its USDG price decays to zero over one hour, creating a continuously clearing market rather than a pooled daily round.
The displaced miner receives 80% of a nonzero replacement payment, while Mine deposits the 20% remainder into
ResonanceRouter for later permissionless routing into the signal-directed acquisition flow.

## 1. Economic loop

The protocol has five recurring actions:

1. A participant takes a mining slot at its current USDG price.
2. The incumbent accrues GBX continuously at the rate fixed when that tenure began.
3. Mine deposits protocol revenue into ResonanceRouter; a later permissionless call can enter it into a seven-day
   Resonance stream whose elapsed flow follows current sGBX signals.
4. Strategies atomically pull released USDG and exchange their accumulated balance for configured payment assets.
   Each purchase uses the current 0%-to-20% global Bribe rate, pays the complement directly to Fund, and sends the
   Bribe share to its paired reward buffer.
5. A GBX holder may burn GBX for selected Fund assets in kind.

```text
slot replacement -> 80% displaced miner
                -> 20% ResonanceRouter --permissionless route()--> Resonance stream -> Strategy -> 80%-100% Fund
                                                                                          \-> 0%-20% BribeRouter -> Bribe

GBX -> sGBX -> live signals ------------------------------^
           \-> IVotes checkpoints -> external governance (unselected) -> Resonance owner actions
GBX burn -> selected Fund assets -> redeemer
```

The first purchase of an empty slot deposits 100% of its payment into ResonanceRouter because no miner was displaced.
Mine then ends without calling `route()`. There is no team,
management, or protocol fee in mining.

## 2. GBX supply and issuance

GBX creates 20 million tokens at construction for the canonical genesis-liquidity position. A temporary deployment
minter then permanently assigns the only mint authority to one deployed Mine. This handoff cannot be replaced or
reopened.

There is no protocol-defined economic maximum GBX supply. The global issuance rate used for future handoffs halves at
fixed intervals measured from Mine deployment and eventually reaches a strictly positive tail. The tail allows mining—and
therefore potential USDG inflow—to continue indefinitely. GBX retains ERC-2612 permit approvals but does not carry
governance checkpoints. Mine hard-codes a 64 GBX-per-second initial global rate, a provisional 69-day halving period,
and a 1 GBX-per-second global tail; those values still require independent economic review.

The supply identity is simple:

```text
total GBX supply = lifetime GBX minted - lifetime GBX burned
```

## 3. The mining market

Mine starts with exactly sixteen permanent slots. Every slot has a replacement price that begins at its
`initialPrice` and falls linearly to zero across one hour. After a handoff, the next initial price is twice the paid
amount, bounded below by 1 USDG and above by `type(uint192).max` raw units.

A participant is buying two things: the right to accrue GBX until replacement and the possibility of receiving 80% of
the next participant's payment. The second component is not guaranteed. If nobody replaces the miner, it receives no
handoff payment. This rollover risk acts like a market discipline on entry price.

The market can clear frequently without a single end-of-day transaction. Miners can compare the current price with
the expected value of accrued GBX, the uncertain handoff payment, GBX liquidity, gas, and risk. None of those economic
outcomes is guaranteed by the contract.

Because price falls with elapsed time and resets upward on every handoff, a pending transaction can be invalidated by
whoever lands first. `mine` therefore takes three caller-supplied bounds. An `epochId` must equal the slot's current
epoch, so a transaction written against one tenure cannot execute against its successor. A `deadline` bounds how long
the transaction may remain valid. A `maximumPrice` caps what the caller will pay. Without these a miner front-run at
the moment of purchase would pay the reset opening price—twice the amount just paid—rather than the
decayed price they submitted for. Each bound is supplied per call; the contract holds no allowance for slippage of its
own. When the quoted TPS must also remain valid, the caller sets `deadline` strictly before the next time-based halving
boundary; `epochId` and `maximumPrice` do not bind the assigned rate.

## 4. Fixed-tenure fairness

A slot's TPS rate is written when a miner enters and remains fixed until that miner is replaced. It is not changed by
a time-based halving boundary, Fund redemption, or another slot's handoff.

The initial global rate is 230,400 GBX/hour. Each new tenure receives one sixteenth, or 14,400 GBX/hour. If the global
rate later halves, an incumbent still receives 14,400 GBX/hour while a new tenure receives 7,200 GBX/hour.

The accepted cost is aggregate issuance above the current global rate while old high-rate tenures coexist with new
divided-rate slots. It falls slot by slot only if incumbents are replaced; turnover has no deadline and is not
guaranteed. Integer division residue for a new slot is unissued.

## 5. Accrual and redemption supply

GBX accrues continuously but each slot mints only when it changes hands. Mine maintains the total pending emission
with one aggregate TPS accumulator while all sixteen slots remain on independent schedules.

Fund reads Mine's constant-time effective supply before capturing a redemption denominator. Therefore a redemption
cannot ignore GBX that miners already earned, and it does not call or mutate every mining slot.

Fund computes every selected payout against the same effective pre-burn supply:

```text
payout(token) = floor(Fund balance(token) * GBX burned / GBX supply before burn)
```

The burn and every selected transfer are atomic. A redeemer may omit a broken or unwanted token, but that omitted
claim is permanently left for remaining GBX holders.

## 6. Signals and acquisitions

`signal` deposits GBX and mints sGBX one-for-one only while assigning every raw unit to a live Strategy in the same
transaction. sGBX is non-transferable, retains ERC20Votes, and is the only user-facing signal coordinator. A first
signal made with no current delegate self-delegates voting power. `signalWithPermit` uses the underlying GBX permit and
relies on the exact GBX transfer; sGBX itself has no ERC-2612 approval permit. Idle sGBX and standalone staking or
unstaking are not valid protocol states.

`moveSignal` atomically removes an existing position through `Resonance.removeSignalFor` and adds the same amount to a
live destination through `Resonance.addSignalFor`. Resonance has no dedicated move hook; a failed addition rolls back
the removal. A successful move transfers no GBX, mints or burns no sGBX, and changes no voting units. `withdrawSignal`
removes a selected Strategy and paired-Bribe position, burns the same sGBX amount, and returns the same GBX atomically.
Both remain immediate scalar operations with no cooldown or epoch.

Signal state has one canonical owner at each layer. SignalGBX balance is the account's complete signaled amount. Each
Strategy's paired Bribe stores account-by-Strategy balances and that Strategy's complete signal supply. Resonance stores
only the active total across live Strategies and accepts signal mutation hooks only from SignalGBX. A separate
`allocatedBalance` duplicate is not maintained.

Resonance schedules forwarded USDG in one active seven-day stream. Each signal mutation first checkpoints the elapsed
interval under the old weights, so a signal moved now affects later flow without a lock, cooldown, or voting epoch. A
Strategy purchase checkpoints and pulls its released share before reading auction inventory. Consequently, signaling a
thin Strategy, separately routing newly deposited mining USDG, and filling its stale cheap auction in one transaction cannot capture that new
USDG: no stream time has elapsed.

The schedule follows the ordinary Synthetix whole-unit rate and leftover rollover. Elapsed release is
`seconds * rewardRate`; division residue is unallocated USDG surplus. Its global reward-per-signal index uses `1e36`
precision. ResonanceRouter waits until someone calls `route()`. It holds a balance smaller than seven days in raw
units, which would create a zero rate, and during an active period also holds a balance smaller than the scheduled
amount left. A qualifying notification checkpoints elapsed revenue and restarts seven days with `reward + left`.
The second threshold prevents a small permissionless top-up from cheaply slowing an existing stream.

Mine's `RevenueDeposited` event proves only exact delivery into ResonanceRouter. `route()` has no caller role or bounty,
so revenue may remain there indefinitely even after qualifying. A manual caller, frontend, volunteer keeper, or cron
process may advance it. This optional periphery does not affect Mine handoff correctness or liveness. LiquidityPosition
fee harvesting remains different: it attempts routing atomically during the harvest.

Settlement remains lazy—ordinary signal, distribution, purchase, and qualifying-notification calls materialize elapsed
revenue—so the protocol needs no per-second keeper. Global-index and per-Strategy floors are accepted surplus rather
than explicit carry. Stream time continues when active signal weight is zero, making that interval's emission
unclaimable, and direct USDG donations to Resonance are unscheduled surplus. Neither category is assigned to Fund or
later signalers. Killing a Strategy checkpoints and preserves its pre-kill claim, removes its complete weight from later
rewards, forbids additions, and leaves incumbent signalers free to exit. After the first Strategy is registered, the
final live Strategy cannot be killed until the Resonance owner adds a replacement.

Signals steer future flow; they do not force Fund to sell past holdings or maintain a target portfolio. Before a
payment-token interaction, Strategy snapshots Resonance's current global automatic-Bribe rate. The rate defaults to
10%, may be set from 0% through 20%, and makes Fund's share its 100% complement. For each payment `a` at rate `r`,
Strategy computes `bribeAmount = floor(a * r / 10,000)`, pays `a - bribeAmount` directly to Fund, and sends a nonzero
Bribe share to BribeRouter. There is no cumulative split carry or deferred Fund liability. A rate change affects only
later purchases. At 0%, the complete new payment goes directly to Fund, while signals, existing rewards, and
independently funded Bribe rewards remain live.

BribeRouter is only a small availability buffer. Anyone may distribute its complete payment-token balance once it can
sustain a nonzero seven-day rate and, during an active stream, covers the scheduled amount left. A failed Bribe
notification cannot revert the already completed auction purchase; the tokens remain in the Router. The acquired
payment asset, not USDG, is the automatic Bribe reward. Direct compatible-token donations join the next distribution.

Each Bribe supports at most sixteen append-only reward tokens and uses a `1e36` reward-per-signal index so low-decimal
rewards remain useful over 18-decimal signal weight. Its multi-token accounting otherwise follows Synthetix: one
four-field stream per registered token, ordinary leftover rollover, and an all-token claim. A scalar claim is retained
so one broken reward token need not block another. Reward time does not pause at zero signal supply, notifications are
not queued, and rate/index/account division floors remain unallocated token surplus rather than explicit carry or Fund
liabilities.
Each reward token also has a monotonic lifetime accepted-notification limit of
`floor(type(uint256).max / 1e36)` raw units. It is checked before reward checkpointing or token transfer and cannot be
reset, so claims can never reopen capacity. A normal 18-decimal token would require about `1.158e23` whole tokens to
reach it. If an irregular token does reach it, existing signalers can still claim, move, or withdraw; a new Strategy
and Bribe must replace the exhausted pool. An automatic reward amount rejected at the cap remains buffered in
BribeRouter. The old killed Bribe remains a closed reward pool without an escape hatch.

## 7. Genesis liquidity

The 20 million genesis GBX allocation forms one precommitted, hookless GBX/USDG Uniswap v4 position. It begins outside
the active range with GBX only. The ownerless LiquidityPosition contract permanently holds its NFT and never removes
principal.

Anyone may harvest fees. Harvested USDG routes through ResonanceRouter, while harvested GBX goes to Fund and is burned
atomically. There is no keeper, bounty, oracle, swap, migration, or NFT withdrawal.

## 8. Governance and immutability

The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. SignalGBX retains
non-transferable ERC20Votes checkpoints on the block-number clock, but the core assigns them no proposal, quorum,
delay, cancellation, or execution semantics. Resonance is the only core contract with continuing custom owner
authority. Its protocol administration methods are:

- add a Strategy;
- permanently kill a Strategy;
- register a Bribe reward token, subject to the immutable sixteen-token cap;
- set the global prospective automatic-Bribe rate from 0% through 20%.

The Resonance owner can also transfer or renounce ownership. SignalGBX, StrategyFactory, and BribeFactory retain
setup-only inherited ownership shells after their one-time Resonance bindings, with no remaining custom owner action.
Production must renounce those consumed shells and transfer Resonance to the selected external executor. That owner
remains unselected. A later ADR must pin and review the external governance provider, exact release and deployed code,
plugins, SignalGBX compatibility, permissions and administrators, upgrade model, proposal rules, batching, delay,
cancellation, and ownership handoff. Until then the protocol makes no claim that administration is selector-filtered,
delayed, permissionlessly executable, or cancellable, and deployment is blocked.

Mine has exactly sixteen slots, no owner, and no path to reprice an incumbent. Fund and LiquidityPosition are ownerless. No
core contract has a proxy, general executor, pause switch, rescue function, emission setter, successor, or migration
path. Deployment must bootstrap reviewed initial Strategies before transferring Resonance directly to the selected
external governance executor and removing the temporary setup authority.

## 9. Important risks

- GBX price, liquidity, mining profitability, replacement frequency, Strategy fills, and Fund value are uncertain.
- A miner can be replaced at any time and is not guaranteed an 80% successor payment.
- Legacy tenures can keep aggregate issuance above the prospective global rate indefinitely if they never turn over.
- A bad immutable deployment or token dependency cannot be repaired by governance.
- SignalGBX checkpoints do not lock withdrawals. If the selected external governance system uses historical snapshots,
  a holder may withdraw after the snapshot and retain that proposal's weight. Its delegation, quorum, capture, and
  liveness properties require separate review.
- The external governance system is unselected. The core guarantees no proposal filter, delay, cancellation path,
  guardian, open executor, immutable voting configuration, or external-governance upgrade boundary.
- The Resonance owner can change the automatic-Bribe share immediately within its 0%-to-20% bound. Transaction
  ordering determines which rate a pending Strategy fill snapshots; the external governance review must address delay
  and execution transparency.
- Permissionless signaling permits rapid allocation movement, but only stream time held at a weight earns new flow;
  existing Strategy inventory, qualifying-reset timing, and accepted rounding surplus still have timing considerations.
- Broken or blocklisting tokens can block their own payout paths.
- An exhausted Bribe lifetime notification cap permanently rejects that token's later notifications in the old pool;
  replacement requires a new Strategy and paired Bribe rather than a reset or rescue.
- Fund assets omitted from redemption remain permanently for the post-redemption supply.
- The protocol has not received an independent audit, and donut-miner/give.fun/Liquid Signal provenance remains legally
  unresolved.

## 10. Status

This repository contains development contracts, independent TypeScript/Python economic models, Foundry and Hardhat
tests, an SDK, a subgraph, and a read-only interface. Local passing checks are engineering evidence only. They are not
evidence of deployment, audit, legal clearance, or production readiness.
