# ADR 0029: Bribe-based Resonance reward stream

- Status: accepted for the Resonance reward stream; direct signal entrypoints and signal-state ownership were
  superseded by ADR 0030 and then ADR 0031; permission to kill the final live Strategy is superseded by ADR 0031; the
  preserved 100%-Fund settlement is superseded by ADR 0032; the intended Timelock owner is superseded by
  [ADR 0034](0034-external-governance-ownership.md); Mine no longer calls the Router synchronously under ADR 0044;
  not audited or deployed; not approved for user funds
- Date: 2026-08-15
- Supersedes: ADR 0026 and the Resonance carry, direct-donation synchronization, and Resonance Fund-liability provisions
  of ADR 0020
- Preserves historically: ADR 0019's incremental signals, ADR 0021's then-current complete Strategy-payment liability,
  ADR 0027's Bribe carry policy, and ADR 0028's closed Bribe pool after Strategy death. ADRs 0031 and 0032 replace the
  first two where stated above.

## Context

The active-plus-successor Resonance implementation preserved every scaled USDG unit and classified all old-denominator
carry. It consequently maintained a separate stream queue, global and per-Strategy carry, fixed Fund precision and whole
liabilities, direct-donation synchronization, and several checkpoint and settlement surfaces.

Resonance needs a simpler job: treat live Strategies as virtual stakers, stream USDG to their aggregate SignalGBX
balances, and mirror each user's signal into the Strategy's Bribe. The existing Bribe reward shape already provides that
model. This decision accepts rounding and zero-supply surplus in exchange for using that recognizable state machine
directly.

## Decision

### Fixed graph and authorization

Resonance keeps immutable SignalGBX, USDG, Fund, StrategyFactory, and BribeFactory identities. SignalGBX and both
factories bind reciprocally to Resonance once. ResonanceRouter is likewise bound once after validating that it identifies
the same Resonance and USDG. The continuing owner surface remains `addStrategy`, `killStrategy`, and `addBribeReward`;
the intended owner is TimelockController.

Only Resonance may deploy through the bound factories. `addStrategy` creates the Strategy, BribeRouter, and Bribe graph,
registers its payment token on the Bribe, and initializes the Strategy at the current USDG reward index. An externally
chosen graph cannot be registered.

### Bribe-shaped virtual staking

Each live Strategy is one virtual staker:

```text
strategySignalWeight[strategy] = aggregate SignalGBX assigned to the Strategy
totalSignalWeight = sum(strategySignalWeight[strategy]) over live Strategies only
```

SignalGBX is the sole external coordinator. Its additions, removals, and moves call restricted Resonance hooks that
checkpoint the Strategy's USDG reward before changing its balance. The same operation deposits or withdraws the
identical amount for that account in the paired Bribe. SignalGBX's `allocatedBalance` is the canonical aggregate
reservation across live and dead Strategies; the paired Bribe is canonical for account-by-Strategy balances and
Strategy supply, while Resonance owns only active `totalSignalWeight`.

Anyone may checkpoint and claim a Strategy's accrued USDG, but the receiver is always that Strategy. A Strategy purchase
does this before reading its USDG inventory, so revenue notified in the same transaction has no elapsed time to release.

### Seven-day schedule and qualifying resets

USDG uses one active seven-day schedule and no successor queue. Let `D = 604800` seconds. Before a notification,
Resonance checkpoints elapsed emission and calculates the exact raw USDG still scheduled as `left`.

During an active period, a notification is accepted only when its `reward` is at least `left`. A qualifying notification
pulls the exact reward from ResonanceRouter and starts a new seven-day period at the current timestamp with:

```text
scheduled = reward + left
baseRate = floor(scheduled / D)
rateRemainder = scheduled mod D
```

The base rate releases for all `D` seconds. One additional raw USDG unit releases during each of the first
`rateRemainder` seconds. The complete `scheduled` amount is therefore emitted by the new finish, including a schedule of
one raw six-decimal USDG unit. Front-loading can shift less than `D` raw units earlier within the period.

ResonanceRouter compares its complete pending balance with `left`. If the balance is nonzero but smaller than `left`,
`route` leaves it in the Router and returns zero. If it is at least `left`, `route` approves and forwards the complete
balance, and the qualifying notification restarts the combined schedule. There is no separate `0.6048 USDG` minimum.

A qualifying top-up may raise or lower the rate and always replaces the prior finish with seven days from the
notification. This reset behavior is intentional.

### Precision and accepted surplus

The cumulative reward-per-signal index uses `REWARD_PRECISION = 1e36`:

```text
indexDelta = floor(emittedRaw * 1e36 / totalSignalWeight)
strategyReward = floor(strategyWeight * indexDelta / 1e36)
```

Resonance does not retain the remainder from either floor. Those raw-token fractions remain in the contract as
unclassified surplus. The high precision makes ordinary individual losses small, but the protocol does not claim exact
conservation or a lifetime bound on their aggregate value.

When active `totalSignalWeight` is zero, wall-clock stream time still advances while the reward index stays unchanged. USDG
emitted during that interval becomes unclaimable surplus; it is not paused, queued, or owed to Fund or later signalers.
USDG transferred directly to Resonance without the Router notification is unscheduled surplus for the same reason.
There is no `syncRevenue`, Fund reclassification, rescue, or recovery path for either category.

The operative accounting property is solvency rather than equality. Across all registered Strategies:

```text
USDG.balanceOf(Resonance) >= left(USDG) + sum(earned(strategy, USDG))
```

The difference is schedule/index/Strategy rounding, zero-active-signal emission, direct donations, and any other
unsupported balance surplus.

### Irreversible Strategy death

`killStrategy` checkpoints the Strategy through the kill timestamp, preserves that accrued claim, marks the Strategy
dead, and subtracts its complete `strategySignalWeight` from active `totalSignalWeight`. It does not erase user
allocations or reduce the paired Bribe's virtual balances.

A dead Strategy rejects every later signal addition and earns no later Resonance USDG. Its pre-kill USDG remains
claimable to the fixed Strategy address. Existing signalers may remove their positions incrementally; those removals
decrease the user's allocation, the Strategy's recorded balance, and the Bribe balance, but do not subtract the already
excluded weight from active `totalSignalWeight` again. Its independently funded Bribe remains the closed pool specified
by ADR 0028.

## Consequences

- Resonance uses one familiar reward state machine without a successor queue, explicit scaled carry, or Resonance Fund
  liability.
- Router revenue may wait between Mine or LiquidityPosition delivery and Resonance notification. The Router has no
  absolute minimum and will eventually qualify as `left` decays to zero, even if no more revenue arrives.
- A qualifying top-up restarts the complete remaining schedule. Transaction ordering and the timing of top-ups can
  influence the release curve.
- Same-transaction signal, notification, and Strategy purchase still releases none of the new notification because no
  time elapses after the reset.
- Zero-active-signal intervals, direct donations, and arithmetic floors can leave USDG permanently in Resonance. These
  balances do not back a claim and cannot be swept by governance.
- Killing the final live Strategy can make active `totalSignalWeight` zero even while dead-Strategy user allocations
  remain.
- The factory-controlled graph, one-time bindings, no-pause rule, and three-action continuing Resonance administration
  remain unchanged.
- This decision requires new unit, invariant, integration, SDK, subgraph, and independent-model evidence. It does not
  constitute an audit, deployment approval, or authorization for user funds.
