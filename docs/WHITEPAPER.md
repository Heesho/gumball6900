# GumBall6900

## The index fund that chooses itself

Whitepaper v0.6 — 16 August 2026 — by Heesho

> Development status: experimental, not deployed, not independently audited, and not authorized for user funds.
> Exact mining economics, deployment parameters, third-party provenance, and independent security review remain open
> release gates. ADRs 0031 and 0032 are authoritative development decisions, but the Solidity and integrations have not
> yet been reconciled to them; this paper describes the target architecture, not current implementation conformance.

## Abstract

GumBall6900 is a proposed signal-directed onchain fund. GBX holders deposit into non-transferable SignalGBX (`sGBX`)
only while assigning every receipt unit to an acquisition Strategy. sGBX supplies block-clock governance votes and
continuously directs new USDG. Each Strategy exchanges USDG for one configured asset through a reverse Dutch auction.
Its acquired-asset payment is classified 90% to an ownerless Fund and 10% to the paired Bribe for signalers. GBX
holders may burn GBX to redeem a caller-selected pro-rata share of raw Fund assets.

GBX distribution uses an immutable multislot Mine adapted from Farplace MineRig. A slot can change hands at any time.
Its USDG price decays to zero over one hour, creating a continuously clearing market rather than a pooled daily round.
The displaced miner receives 80% of a nonzero replacement payment and 20% enters the signal-directed acquisition flow.

## 1. Economic loop

The protocol has five recurring actions:

1. A participant takes a mining slot at its current USDG price.
2. The incumbent accrues GBX continuously at the rate fixed when that tenure began.
3. Mining revenue enters a seven-day Resonance stream whose elapsed flow follows current sGBX signals.
4. Strategies atomically pull released USDG and exchange their accumulated balance for configured payment assets,
   which are classified cumulatively 90% to Fund and 10% to the paired Bribe.
5. A GBX holder may burn GBX for selected Fund assets in kind.

```text
slot replacement -> 80% displaced miner
                -> 20% ResonanceRouter -> Resonance stream -> Strategies -> 90% Fund
                                                                       \-> 10% paired Bribe

GBX -> sGBX -> live signals ------------------------------^
           \-> ProtocolGovernor -> Timelock -> four bounded actions
GBX burn -> selected Fund assets -> redeemer
```

The first purchase of an empty slot routes 100% of its payment because no miner was displaced. There is no team,
management, or protocol fee in mining.

## 2. GBX supply and issuance

GBX creates 20 million tokens at construction for the canonical genesis-liquidity position. A temporary deployment
minter then permanently assigns the only mint authority to one deployed Mine. This handoff cannot be replaced or
reopened.

There is no protocol-defined economic maximum GBX supply. The global issuance rate used for future handoffs halves at
immutable cumulative-mining thresholds and eventually reaches a strictly positive tail. The tail allows mining—and
therefore potential USDG inflow—to continue indefinitely. GBX retains ERC-2612 permit approvals but does not carry
governance checkpoints. Exact production rates and thresholds are not selected in this paper.

The supply identity is simple:

```text
total GBX supply = lifetime GBX minted - lifetime GBX burned
```

## 3. The mining market

Mine starts with one slot and may grow to at most sixteen. Every slot has a replacement price that begins at its
`initialPrice` and falls linearly to zero across one hour. After a handoff, the next initial price is the paid amount
times an immutable multiplier, bounded below by an immutable minimum.

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
the moment of purchase would pay the reset opening price—the amount just paid times the multiplier—rather than the
decayed price they submitted for. Each bound is supplied per call; the contract holds no allowance for slippage of its
own.

## 4. Fixed-tenure fairness

A slot's GBX-per-second rate is written when a miner enters and remains fixed until that miner is replaced. It is not
changed by checkpointing, a cumulative-mining threshold crossing, Fund redemption, or a capacity increase.

Suppose the system's global rate is 100 GBX/hour while capacity is one. The incumbent receives 100 GBX/hour. If the
timelock expands capacity to three, that incumbent still receives 100 GBX/hour. New occupants receive approximately
one third of the then-current global rate. Governance cannot dilute someone after they paid to mine.

The accepted cost is temporary aggregate issuance above the current global rate while old high-rate tenures coexist
with new divided-rate slots. This ends slot by slot as incumbents are replaced. Integer division residue for a new slot
is unissued.

## 5. Accrual, checkpoints, and redemption supply

GBX accrues continuously but is minted at checkpoints. Anyone may checkpoint all live slots. Every replacement and
capacity increase checkpoints before changing state.

Fund also checkpoints every slot before capturing a redemption denominator. Therefore a redemption cannot ignore GBX
that miners already earned merely because nobody sent a separate checkpoint transaction. The sixteen-slot hard cap
makes this work bounded.

After checkpointing, Fund computes every selected payout against the same pre-burn total supply:

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

`moveSignal` moves an existing position between live Strategies without transferring GBX, minting or burning sGBX, or
changing voting units. `withdrawSignal` removes a selected Strategy and paired-Bribe position, burns the same sGBX
amount, and returns the same GBX atomically. Both remain immediate scalar operations with no cooldown or epoch.

Signal state has one canonical owner at each layer. SignalGBX balance is the account's complete signaled amount. Each
Strategy's paired Bribe stores account-by-Strategy balances and that Strategy's complete signal supply. Resonance stores
only the active total across live Strategies and accepts signal mutation hooks only from SignalGBX. A separate
`allocatedBalance` duplicate is not maintained.

Resonance schedules routed USDG in one active seven-day stream. Each signal mutation first checkpoints the elapsed
interval under the old weights, so a signal moved now affects later flow without a lock, cooldown, or voting epoch. A
Strategy purchase checkpoints and pulls its released share before reading auction inventory. Consequently, signaling a
thin Strategy, routing new mining USDG, and filling its stale cheap auction in one transaction cannot capture that new
USDG: no stream time has elapsed.

The raw schedule uses a quotient plus a front-loaded remainder, so every scheduled six-decimal USDG unit is released,
including a one-raw-unit schedule. Its global reward-per-signal index uses `1e36` precision. During an active period,
ResonanceRouter waits while its complete balance is below the exact amount left. Once the balance is at least `left`, a
notification checkpoints elapsed revenue and restarts seven days with `reward + left`. The reset may raise or lower the
rate and move the prior finish; there is no separate absolute minimum.

Settlement remains lazy—ordinary signal, distribution, purchase, and qualifying-notification calls materialize elapsed
revenue—so the protocol needs no per-second keeper. Global-index and per-Strategy floors are accepted surplus rather
than explicit carry. Stream time continues when active signal weight is zero, making that interval's emission
unclaimable, and direct USDG donations to Resonance are unscheduled surplus. Neither category is assigned to Fund or
later signalers. Killing a Strategy checkpoints and preserves its pre-kill claim, removes its complete weight from later
rewards, forbids additions, and leaves incumbent signalers free to exit. After the first Strategy is registered, the
final live Strategy cannot be killed until governance adds a replacement.

Signals steer future flow; they do not force Fund to sell past holdings or maintain a target portfolio. A Strategy's
acquired-asset payment enters BribeRouter, which cumulatively classifies 90% as a fixed Fund liability and 10% as a
fixed paired-Bribe reward liability. Explicit split remainder prevents repeated tiny payments from starving the Bribe.
The two permissionless settlement legs are isolated, so failure of one preserves its liability without consuming the
other. The acquired payment asset, not USDG, is the automatic Bribe reward. Additional independent rewards remain
possible within the eight-token cap.

## 7. Genesis liquidity

The 20 million genesis GBX allocation forms one precommitted, hookless GBX/USDG Uniswap v4 position. It begins outside
the active range with GBX only. The ownerless LiquidityPosition contract permanently holds its NFT and never removes
principal.

Anyone may harvest fees. Harvested USDG routes through ResonanceRouter, while harvested GBX goes to Fund and is burned
atomically. There is no keeper, bounty, oracle, swap, migration, or NFT withdrawal.

## 8. Governance and immutability

TimelockController owns only Resonance and Mine. SignalGBX holders operate ProtocolGovernor, which is the Timelock's
sole proposer. The continuing administrative surface is:

- add a Strategy;
- permanently kill a Strategy;
- register a Bribe reward token, subject to the immutable eight-token cap; and
- increase Mine capacity, from one to at most sixteen.

ProtocolGovernor accepts only those exact zero-value calls at immutable Resonance and Mine addresses. Its voting delay,
period, proposal threshold, and quorum percentage are immutable constructor inputs and use SignalGBX's block-number
clock. Execution is permissionless after the Timelock delay but rejects nonzero executor `msg.value`. The proposer may
cancel only while a proposal is Pending; there is no multisig bypass, guardian, or queued-proposal veto.

Capacity cannot decrease, and expansion cannot reprice an incumbent. Fund and LiquidityPosition are ownerless. No
contract has a proxy, general executor, pause switch, rescue function, emission setter, successor, or migration path.
Deployment bootstraps reviewed initial Strategies before transferring Resonance and Mine to the Timelock and removing
the temporary setup authority.

## 9. Important risks

- GBX price, liquidity, mining profitability, replacement frequency, Strategy fills, and Fund value are uncertain.
- A miner can be replaced at any time and is not guaranteed an 80% successor payment.
- Capacity expansion temporarily raises aggregate issuance under the fixed-tenure fairness rule.
- A bad immutable deployment or token dependency cannot be repaired by governance.
- A holder can withdraw every signal after a proposal snapshot and retain that proposal's historical voting weight.
  Low sGBX participation also lowers the absolute voting weight represented by a percentage quorum. Under the target
  interface this exit occurs through `withdrawSignal`; no idle intermediate receipt exists.
- A queued proposal cannot be canceled; the Timelock delay is an observation and exit window rather than a guardian
  veto.
- Permissionless signaling permits rapid allocation movement, but only stream time held at a weight earns new flow;
  existing Strategy inventory, qualifying-reset timing, and accepted rounding surplus still have timing considerations.
- Broken or blocklisting tokens can block their own payout paths.
- Fund assets omitted from redemption remain permanently for the post-redemption supply.
- The protocol has not received an independent audit, and Farplace/give.fun/Liquid Signal provenance remains legally
  unresolved.

## 10. Status

This repository contains development contracts, independent TypeScript/Python economic models, Foundry and Hardhat
tests, an SDK, a subgraph, and a read-only interface. Local passing checks are engineering evidence only. They are not
evidence of deployment, audit, legal clearance, or production readiness.
