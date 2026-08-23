# GUM BALL 6900 core contracts

This is the canonical development source, not a deployment or authorization for user funds.

## System flow

```text
mining:       replacement USDG -> 80% displaced-miner claim + 20% ResonanceRouter deposit
empty slot:   first-payment USDG -> 100% ResonanceRouter deposit
issuance:     slot handoff -> accrued GBX to the displaced slot miner
acquisitions: buyer payment -> Strategy -> direct Fund complement + global 0%-20% paired-Bribe buffer
redemptions:  effective-supply snapshot -> user GBX burn -> selected Fund assets to receiver
liquidity:    accrued USDG -> ResonanceRouter; accrued GBX -> Fund -> atomic burn
```

## Contracts

| Contract            | Responsibility                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `GBX`               | Creates 20M genesis-liquidity GBX, binds Mine as minter, and retains ERC-2612 permit approvals.        |
| `Mine`              | Exactly sixteen hourly reverse-Dutch replacement slots with fixed-tenure GBX rates and 80/20 payments. |
| `LiquidityPosition` | Permanently holds one canonical GBX/USDG v4 NFT at fixed principal and routes fees.                    |
| `SignalGBX`         | Non-transferable signal-backed GBX, ERC20Votes governance power, and sole signal coordinator.          |
| `ResonanceRouter`   | Forwards a complete USDG balance once it meets Resonance's current live-period threshold.              |
| `Resonance`         | Bribe-shaped seven-day USDG rewards over Strategy signal weights, plus Strategy and Bribe creation.    |
| `StrategyFactory`   | Resonance-only Strategy and BribeRouter deployment.                                                    |
| `Strategy`          | Uniform bounded reverse-Dutch acquisition that splits each payment directly between Fund and Router.   |
| `BribeFactory`      | Resonance-only Bribe deployment.                                                                       |
| `BribeRouter`       | Buffers one Strategy's Bribe share and permissionlessly distributes each qualifying complete balance.  |
| `Bribe`             | Seven-day reward streams with at most sixteen tokens and a fixed per-token lifetime notification cap.  |
| `Fund`              | Ownerless raw treasury, GBX burn boundary, and caller-selected in-kind redemption.                     |

Mine has exactly sixteen slots. A slot's assigned GBX/second rate never changes during that miner's tenure. Time-based
halving boundaries affect new occupations only. This deliberately prevents other users from diluting a miner after
entry, while allowing aggregate issuance above the current global rate for as long as old slots remain; turnover is
not guaranteed.

Each handoff may include an empty or nonempty message of at most 280 raw bytes. Mine emits the message in `Mined` but
does not keep it in contract storage. The payer and beneficiary are separate indexed event fields, so clients must
attribute the message to the payer rather than assume the beneficiary authored it.

A nonempty-slot replacement makes 80% of its USDG payment claimable by the displaced miner and deposits the 20%
remainder into ResonanceRouter. An empty slot deposits 100%. `Mine.RevenueDeposited` means this exact deposit completed;
Mine does not call `route()`, so the event does not prove same-transaction delivery into Resonance. There is no team
fee. GBX has no protocol-defined economic supply cap, with
immutable time-based halvings for future handoffs and a positive tail. GBX is permit-enabled but has no voting
checkpoints; governance power is the SignalGBX minted when GBX is deposited directly into a Strategy signal. The
deployment process verifies GBX's permanent reciprocal Mine binding; Mine does not re-read that immutable fact on
every handoff, while GBX itself continues to enforce it on every mint.

SignalGBX is the only external signaling entrypoint. Every mint atomically deposits GBX and adds the same amount of
signal to one live Strategy; every burn atomically removes signal and returns the same GBX. Paired Bribes own
account-by-Strategy balances and per-Strategy supply, while Resonance owns only the active live-Strategy total.
Signal may move between Strategies without minting or burning, and no idle sGBX state is reachable.

Before interacting with a payment token, Strategy snapshots Resonance's global `bribeBps`, which defaults to 10% and
is bounded from 0% through 20%. For each purchase it floors the Bribe share independently, transfers the complement
directly to immutable Fund, and sends any nonzero Bribe share to the paired BribeRouter. There is no cumulative
weighted carry or deferred Fund liability. At 0%, the complete payment reaches Fund while signals, exits, existing
rewards, and independently funded rewards remain live. A failed Fund transfer reverts the complete purchase.

BribeRouter is only a Bribe-share buffer. Its permissionless `distribute()` uses the complete token balance, including
compatible direct donations, once that balance is at least one raw unit per stream second and at least the active
Bribe reward left. A failed Bribe notification leaves the balance buffered without affecting the already completed
purchase.

ResonanceRouter forwards a nonzero balance when a permissionless caller invokes `route()` and the complete balance is
at least both seven days of raw units and the active scheduled reward left; smaller balances remain held. The duration
gate prevents a zero whole-unit rate. Mine handoffs are already complete and cannot be reverted by that later call.
Liquidity-fee collection remains atomically coupled to its route attempt. There is no keeper role, bounty, or
guaranteed caller, so Router funds may wait indefinitely. A qualifying notification checkpoints elapsed rewards,
combines the ordinary Synthetix leftover with the new USDG, and restarts seven days. Rate, index, and per-Strategy
division floors, elapsed zero-signal revenue, and direct Resonance donations remain accepted unallocated surplus.
Killing a Strategy checkpoints its pre-kill claim, removes its complete weight from the active denominator, blocks
additions and future rewards, and leaves every incumbent free to exit.

Each Bribe uses the same standard Synthetix leftover-rollover schedule independently for every registered token.
Reward time does not pause at zero virtual supply, notifications are not queued, and rate, index, and account floors
remain unallocated token surplus rather than Fund or carry accounting.

Each Bribe uses a `1e36` reward-per-signal index. For each reward token, it accepts at most
`floor(type(uint256).max / 1e36)` raw units across its complete lifetime.
The monotonic total has no reset, setter, or escape hatch. An excess notification reverts before checkpointing or token
transfer, so existing claims, signal moves, and withdrawals remain usable. At this cap a later automatic Bribe share
stays buffered in BribeRouter, while the Fund complement already transferred during each purchase. Replacing the
Strategy creates a new paired Bribe without reopening the old closed reward pool.

## Fund redemption

`redeem(gbxAmount, receiver, tokens)` reads `Mine.effectiveTotalSupply()` in constant time and uses that single pre-burn
supply snapshot without checkpointing or settling any mining slot. EIP-1153 transient storage rejects duplicate selected
assets without a registry. The complete basket must also leave every selected address with at least its snapshot less
its own payout, rejecting different facades that debit one shared ledger. Omitted assets remain for the post-redemption
supply.

## Administration

Resonance retains four continuing protocol administration methods: add a Strategy, kill a Strategy, register a Bribe
reward token, and set the bounded global acquired-asset Bribe rate. SignalGBX exposes ERC20Votes checkpoints, but
governance execution is an unselected external integration and is not implemented in this repository. A production
deployment remains blocked until an exact external governance executor is reviewed and receives Resonance ownership.
Mine, Fund, and LiquidityPosition are ownerless. There is no core proxy, migration, rescue, successor, emission setter,
or capacity change.

## Credit

The core adapts give.fun, Liquid Signal Governance, and donut-miner. Strategy's auction also credits Euler Fee Flow.
Exact and unresolved repository pins and licensing status are recorded in `NOTICE`.
