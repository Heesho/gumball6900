# GUM BALL 6900 core contracts

This is the canonical development source, not a deployment or authorization for user funds.

## System flow

```text
mining:       replacement USDG -> 80% outgoing-tenure claim + 20% ResonanceRouter deposit
empty slot:   first-payment USDG -> 100% ResonanceRouter deposit
issuance:     slot replacement -> accrued GBX to the outgoing tenure miner
genesis:      fixed Mine issue + 1 USDG -> USDG/GBX Pair -> complete genesis LP locked at address(0)
acquisitions: buyer payment -> Strategy -> direct Fund complement + global 0%-20% paired-Bribe buffer
redemptions:  effective-supply snapshot -> user GBX burn -> selected Fund assets to receiver
```

## Contracts

| Contract          | Responsibility                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `GBX`             | Constructs at zero supply, binds Mine as its sole issuer, and retains ERC-2612 permit approvals.     |
| `Mine`            | One fixed genesis issue, sixteen immutable slots, and one governed future-revenue Router pointer.    |
| `SignalGBX`       | Non-transferable signal-backed GBX, ERC20Votes governance power, and sole signal coordinator.        |
| `ResonanceRouter` | Forwards a complete USDG balance once it meets Resonance's current live-period threshold.            |
| `Resonance`       | Seven-day USDG revenue, Strategy/Bribe administration, and caller-owned cross-Bribe reward batching. |
| `StrategyFactory` | Resonance-only Strategy and BribeRouter deployment.                                                  |
| `Strategy`        | Uniform bounded reverse-Dutch acquisition that splits each payment directly between Fund and Router. |
| `BribeFactory`    | Resonance-only Bribe deployment.                                                                     |
| `BribeRouter`     | Buffers one Strategy's Bribe share and permissionlessly routes each qualifying complete balance.     |
| `Bribe`           | Bounded reward streams with beneficiary-authorized all-token and isolated scalar-token claims.       |
| `Fund`            | Ownerless raw treasury, GBX burn boundary, and caller-selected in-kind redemption.                   |

Mine has exactly sixteen slots. A slot's assigned GBX/second rate never changes during that miner's tenure. Time-based
halving boundaries affect new occupations only. This deliberately prevents other users from diluting a miner after
entry, while allowing aggregate issuance above the current global rate for as long as old slots remain; turnover is
not guaranteed.

Each replacement may include an empty or nonempty message of at most 280 raw bytes. Mine emits the message in `Mined` but
does not keep it in contract storage. The payer and beneficiary are separate indexed event fields, so clients must
attribute the message to the payer rather than assume the beneficiary authored it.

A nonempty-slot replacement makes 80% of its USDG payment claimable by the outgoing tenure miner and deposits the 20%
remainder into ResonanceRouter. An empty slot deposits 100%. `Mine.RevenueDeposited` records the nominal protocol
share and receiving Router requested through `SafeERC20`; Mine does not call `route()`, so the event does not prove same-transaction
delivery into Resonance. There is no team fee. GBX constructs with zero supply and has no protocol-defined economic
cap, with immutable time-based halvings for future replacements and a positive tail. After reciprocal binding, Mine's
temporary genesis authority may issue the fixed `1,000 ether` GBX exactly once to a contract; the canonical launcher
sends it to the validated Pair and clears the authority in the same transaction. `Mine.totalMined()` counts only
settled slot emission, so lifetime minted reconciles as mining plus the consumed fixed genesis amount. GBX is
permit-enabled but has no voting checkpoints; governance power is the SignalGBX minted when GBX is escrowed and
assigned to a Strategy. GBX continues to enforce its permanent Mine binding on every mint.

SignalGBX is the only external signaling entrypoint. `addSignal` and `removeSignal` retain bounded one-Strategy paths;
`addSignalMany` and `removeSignalMany` optionally apply caller-supplied arrays while transferring/minting or
burning/returning the checked aggregate once. Every raw sGBX unit remains atomically backed by the same GBX amount and
assigned to one Strategy. Paired Bribes own account-by-Strategy balances and per-Strategy supply, while Resonance owns
only the active live-Strategy total. There is no public move, permit-consuming signal path, shared write Router, or
reachable idle sGBX state.

The stateless optional `SignalPortfolioLens` batches caller-selected account and Strategy reads but owns no registry,
role, custody, or write path. Subgraph positions are discovery-only. Transaction construction must refresh canonical
Bribe and Strategy state onchain; SDK write helpers encode direct SignalGBX calls rather than routing ownership through
periphery.

Before interacting with a payment token, Strategy snapshots Resonance's global `bribeBps`, which defaults to 10% and
is bounded from 0% through 20%. For each purchase it floors the Bribe share independently, transfers the complement
directly to immutable Fund, and sends any nonzero Bribe share to the paired BribeRouter. There is no cumulative
weighted carry or deferred Fund liability. At 0%, the complete payment reaches Fund while signals, exits, existing
rewards, and independently funded rewards remain live. A failed Fund transfer reverts the complete purchase.

BribeRouter is only a Bribe-share buffer. Its permissionless `route()` uses the complete token balance, including
compatible direct donations, once that balance is at least one raw unit per stream second and at least the active
`remainingReward`. A failed Bribe notification leaves the balance buffered without affecting the already completed
purchase. The canonical launch registers the actual seeded fungible USDG/GBX LP ERC-20 through this ordinary Strategy
path without adding continuing liquidity-specific core logic.

## Atomic launch boundary

The adjacent `src/launch` package contains a development-only GBX-specific one-shot orchestrator and four stateless
component deployers. On Robinhood Chain mainnet it uses the pinned Uniswap V2 Factory directly, seeds exactly one USDG
and 1,000 GBX, requires total genesis LP supply `31,622,776,601,683`, and mints all LP to `address(0)`. It then registers
GBX at `100,000 ether` and the Pair at `50 * pair.totalSupply()` as the two initial Strategy payment tokens; both use a
24-hour epoch and `1.2e18` multiplier. A first epoch can decay to zero before inventory arrives because the configured
minimum starts the next epoch.

The launcher is not a continuing core administrator or a generic fund factory. It removes SignalGBX and both factory
setup owners, clears Mine's genesis authority, and begins two-step ownership transfers of Mine and Resonance to the
reviewed final governance contract before returning. Governance must accept both afterward; until then the single-use
launcher remains formal owner but exposes no post-launch path that can exercise either authority. Only genesis LP is
locked; later Fund-held LP remains an ordinary caller-selected redemption asset. Address constants and local tests do
not establish target Factory, Pair, USDG, Router, or governance provenance.

ResonanceRouter forwards a nonzero balance when a permissionless caller invokes `route()` and the complete balance is
at least both `REWARD_DURATION` raw units and `remainingRevenue()`; smaller balances remain held. The duration
gate prevents a zero whole-unit rate. Mine replacements are already complete and cannot be reverted by that later call.
There is no keeper role, bounty, or guaranteed caller, so Router funds may wait indefinitely. A qualifying
notification checkpoints elapsed revenue, combines the ordinary Synthetix leftover with the new USDG, and restarts
seven days. Rate, index, and per-Strategy
division floors, elapsed zero-signal revenue, and direct Resonance donations remain accepted unallocated surplus.
Resonance admits at most `floor(type(uint256).max / 1e36)` fresh raw USDG units over its complete lifetime. The
monotonic counter has no reset and rolled-over remaining revenue is not counted twice. An excess notification reverts
before checkpointing or USDG interaction, so signal removal remains usable; the rejected USDG stays buffered in that
ResonanceRouter. Governance may direct only later Mine deposits to a separately deployed and validated replacement
graph; it cannot sweep the exhausted Router or move old state.
Killing a Strategy checkpoints its pre-kill claim, removes its complete weight from the active denominator, blocks
signal additions and future Resonance revenue, and leaves every existing signaler free to exit or claim independently funded
Bribe rewards.

Each Bribe uses the same standard Synthetix leftover-rollover schedule independently for every registered token.
Reward time does not pause at zero virtual supply, notifications are not queued, and rate, index, and account floors
remain unallocated token surplus rather than Fund or carry accounting.

Direct `claimRewards(account)` and `claimReward(account, token)` calls accept only `account` itself or the Bribe's
immutable Resonance. Resonance's optional `claimBribeRewards(strategies)` batch always claims for `msg.sender`, resolves
only registered canonical Strategy/Bribe pairs, and supports both live and killed Strategies. The caller controls batch
length and duplicates execute sequentially; an empty array or unregistered Strategy reverts. A failed reward-token
transfer reverts the complete all-token or cross-Bribe batch, so the account's direct scalar-token claim remains the
bounded broken-token and gas fallback.

Each Bribe uses a `1e36` reward-per-signal index. For each reward token, it accepts at most
`floor(type(uint256).max / 1e36)` raw units across its complete lifetime.
The monotonic total has no reset, setter, or escape hatch. An excess notification reverts before checkpointing or token
transfer, so existing claims and signal removals remain usable. At this cap a later automatic Bribe share
stays buffered in BribeRouter, while the Fund complement already transferred during each purchase. A governance
replacement is a newly deployed Strategy, Bribe, and BribeRouter graph; killing the old Strategy leaves its Bribe
closed to new signal but still permissionlessly fundable while lifetime headroom remains.

## Fund redemption

`redeem(gbxAmount, receiver, tokens)` reads `Mine.effectiveTotalSupply()` in constant time and uses that single pre-burn
supply snapshot without checkpointing or settling any mining slot. EIP-1153 transient storage rejects duplicate selected
assets without a registry. The complete basket must also leave every selected address with at least its snapshot less
its own payout, rejecting different facades that debit one shared ledger. Omitted assets remain for the post-redemption
supply.

## Administration

Resonance retains four continuing protocol administration methods: add a Strategy, kill a Strategy, register a Bribe
reward token, and set the bounded global acquired-asset Bribe rate. Mine separately retains only
`setResonanceRouter`, which validates that a deployed replacement graph reports the same GBX, USDG, and immutable Fund
before changing where future protocol revenue is deposited. Resonance also has one setup-only `setResonanceRouter`
binding that is consumed before handoff and cannot later be replaced or cleared. Mine and Resonance use
`Ownable2Step`; before acceptance, a callable current owner can replace or cancel a pending transfer, while
renunciation remains immediate. SignalGBX and both factories remain plain-`Ownable` setup shells whose ownership is
renounced after binding. SignalGBX exposes ERC20Votes
checkpoints, but governance execution is an unselected external integration and is not implemented in this repository.
A production deployment remains blocked until an exact external governance executor is reviewed and accepts both Mine
and Resonance ownership.

A Router switch is not a state migration. Old Router balances, Resonance schedules and Strategy claims, Bribe rewards,
and signal positions remain in the old graph. Users claim and remove signal there before optionally adding the returned
GBX to the new graph. Fund remains ownerless and immutable across accepted replacement graphs. There is no core proxy,
balance sweep, forced position migration, rescue, emission setter, or capacity change.

## Credit

The core adapts give.fun, Liquid Signal Governance, and donut-miner. Strategy's auction also credits Euler Fee Flow.
Exact and unresolved repository pins and licensing status are recorded in `NOTICE`.
