# ADR 0019: Incremental absolute signals and bounded Bribe rewards

- Status: accepted
- Date: 2026-08-09
- Supersedes the signaling provisions of
  [ADR 0013](0013-upstream-shaped-core-starting-point.md)
- Builds on [ADR 0015](0015-resonance-terminology.md),
  [ADR 0016](0016-governance-minimized-final-surface.md), and
  [ADR 0017](0017-remove-successor-migration.md)

## Context

Resonance previously accepted relative weights, normalized them across the caller's complete SignalGBX balance, and
replaced the account's entire allocation atomically. Exiting likewise required one atomic `reset` across every
Strategy the account had selected. That model created three permanent liveness risks in an immutable protocol:

1. exit cost grew with every Strategy and could not be split across transactions;
2. one dead Strategy whose revenue-token transfer to Fund reverted blocked the account's complete exit; and
3. every append-only Bribe reward token increased signal removal, claims, and acquisition-settlement gas without a
   bound.

Relative weights also made a position unstable as a user-facing fact. Staking more changed the absolute amount behind
every percentage the next time the account updated its allocation, and adding one Strategy required resending the
complete set.

## Decision

Replace whole-account `signal` and `reset` with four non-overloaded functions:

```solidity
addSignal(address strategy, uint256 amount)
removeSignal(address strategy, uint256 amount)
addSignalMany(address[] strategies, uint256[] amounts)
removeSignalMany(address[] strategies, uint256[] amounts)
```

Every `amount` is an absolute SignalGBX delta, not a target. Adds consume only
`signalGBX.balanceOf(account) - accountSignalWeight[account]`. A dead Strategy rejects new signal, while an existing
signal can still be removed after the Strategy is killed. Batch size is entirely caller-controlled; no exit requires
iteration over an account's complete position.

Resonance retains `accountStrategies(address)` for readers and SDK consumers. It tracks a 1-based per-account Strategy
index and removes zero-signal entries with swap-and-pop, updating the moved Strategy's index in the same transaction.
`SignalAdded` and `SignalRemoved` report the incremental amount applied by each operation.

SignalGBX unstaking reserves only `accountSignalWeight`. A holder may burn and withdraw any unallocated balance without
first changing signals assigned elsewhere.

Bribe defines `MAX_REWARD_TOKENS = 8` and enforces it at the single `addRewardToken` chokepoint. The limit is fixed in
bytecode and adds no governance surface. It covers the payment token registered during Strategy creation and every
later token registered through `Resonance.addBribeReward`.

## Economic consequences

Partial allocation is now possible. Idle SignalGBX earns no Bribe rewards, directs no USDG, and does not dilute active
signalers. Consequently `totalSignalWeight` will generally be lower than SignalGBX total supply. Staking more does not
silently resize existing signals; the holder must explicitly add the newly available amount.

## Security and liveness consequences

- Every normal exit is decomposable into bounded per-Strategy removals followed by unstaking.
- A failure in one Strategy no longer freezes signals assigned to other Strategies or the account's unallocated
  SignalGBX. This historical A-04 statement is superseded by [ADR 0020](0020-exact-carry-and-deferred-fixed-liabilities.md),
  which makes the Fund destination a fixed pull liability and removes token transfers from signal exit.
- The eight-token cap bounds, but does not eliminate, the linear per-token work in Bribe accounting. Removal, claiming,
  and Strategy settlement remain measured gas-regression surfaces.
- Swap-and-pop bookkeeping is new state complexity. Unit, adversarial, fuzz, stateful invariant, Echidna, and Medusa
  campaigns must preserve the account-list and aggregate-weight identities.
- `Resonance.addBribeReward` remains part of the timelocked administrative surface. Whether multi-token rewards should
  exist at all remains an open product and trust-model question.

This is a breaking ABI and indexing change. Contract artifacts, SDK builders and reader schemas, subgraph events and
handlers, generated references, audit harnesses, and public documentation must change together. The repository has no
production deployment, so no migration or compatibility shim is introduced.
