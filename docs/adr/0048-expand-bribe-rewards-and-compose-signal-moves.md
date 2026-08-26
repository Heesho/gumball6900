# ADR 0048: Expand Bribe rewards and compose signal moves

- Status: accepted for the sixteen-token bound and absence of `Resonance.moveSignalFor`; ADR 0051 supersedes its
  preservation of public `SignalGBX.moveSignal`; not audited, deployed, or approved for user funds
- Date: 2026-08-23
- Supersedes: ADR 0016, ADR 0019, ADR 0037, and ADR 0047 only where they fix the Bribe reward-token limit at eight;
  ADR 0030 only where it requires a dedicated `Resonance.moveSignalFor` hook
- Preserved at acceptance: the fixed append-only Bribe registry, bounded mandatory reward loops, the `1e36` reward index, the
  lifetime-notification cap, SignalGBX's public `moveSignal` operation, atomic movement, checkpoint-before-weight-change
  ordering, killed-Strategy exits, and the rule that signal movement changes neither GBX custody, sGBX supply, nor
  voting units

ADR 0051 later removes public `SignalGBX.moveSignal`; the composed-move body below remains historical evidence for the
now-superseded surface. The retained Resonance add/remove hooks and checkpoint ordering remain active.

## Context

The eight-token Bribe limit was introduced to put a hard bound on every reward-token loop. It includes the Strategy's
payment token, leaving seven slots for independently funded incentives. The bound remains important, but eight is too
restrictive for the intended range of Strategy incentives. A fixed limit of sixteen permits the automatic payment
asset plus fifteen additional reward assets while keeping every mandatory loop finite and statically reviewable.

SignalGBX already owns the public signal-movement transaction. Resonance separately exposed `addSignalFor`,
`removeSignalFor`, and a dedicated `moveSignalFor`, even though the move transition is exactly a removal followed by an
addition. The dedicated hook duplicated validation, checkpoint, virtual-balance, live-weight, interface, and test
surface that the two scalar hooks already provide.

The protocol is not deployed, so neither the cap change nor the selector removal needs a compatibility shim or
storage migration.

## Decision

### Sixteen-token Bribe bound

`Bribe.MAX_REWARD_TOKENS` is fixed at `16`. The Strategy payment token is registered when the Strategy graph is
created and occupies the first slot. The Resonance owner may append at most fifteen additional reward tokens through
`addBribeReward`. Registration of a seventeenth token reverts at the existing `addRewardToken` chokepoint.

The limit remains bytecode-fixed and is not a governance parameter. Every all-token claim and mandatory Bribe
checkpoint loop remains bounded by the same constant. The per-token schedule, lifetime-notification cap, scalar claim,
and standard-token assumption do not change.

### Composed signal movement

`Resonance.moveSignalFor` is removed from the core contract and interface. `SignalGBX.moveSignal` remains the only
public move operation. After rejecting zero amounts and identical source and destination Strategies, it atomically
calls:

```text
Resonance.removeSignalFor(account, fromStrategy, amount)
Resonance.addSignalFor(account, toStrategy, amount)
```

Both calls execute in one EVM transaction. If the destination is unregistered or dead, or if any later operation
fails, the destination addition reverts the complete transaction and rolls back the source removal.

The composed ordering preserves reward attribution. The removal checkpoints elapsed Resonance and Bribe rewards for
the source under the pre-move weights. The addition then checkpoints the destination before increasing its weight. No
time elapses between the two calls, so the destination's old balance receives the already stored global index while
the moved balance earns only later emission.

Live-to-live movement decrements and then restores `totalSignalWeight`, leaving the aggregate unchanged at transaction
completion. Removal from a killed Strategy does not decrement the already excluded weight; the subsequent live
addition increases the active total exactly once. A dead Strategy cannot be the destination. The source and
destination `SignalRemoved` and `SignalAdded` events remain the observable transition.

## Development evidence

The focused migration suites pass 104/104. Maximum-bound gas measurements are: signal addition 491,494; withdrawal
1,129,059; scalar claim 93,018; sixteen sequential scalar claims 1,488,760; all-token claim 1,471,439; Strategy
purchase 139,502; a composed move with sixteen active streams on both Bribes 1,890,938; adding token sixteen 50,810;
and rejecting token seventeen 5,349. The focused ADR-0048 mutation campaign killed 47/47 targeted mutants. These are
local development measurements, not a block-limit guarantee on an unreviewed deployment, and the complete
post-ADR-0048 repository matrix still requires a rerun.

## Accepted consequences

- Worst-case Bribe checkpoint and all-token-claim work may approximately double. The fixed bound prevents unbounded
  growth, but gas measurements and invariant campaigns must cover the sixteen-token maximum.
- A move that names an invalid destination may perform the source-side work before reverting at the addition. Atomic
  rollback preserves state, but the failed call can consume more gas than a dedicated pre-validating move hook.
- Removing one core selector reduces duplicated implementation and ABI surface while relying on EVM transaction
  atomicity for composition.
- Consumers, tests, audit harnesses, generated ABIs, and documentation must remove `moveSignalFor` and use the two
  retained hooks when modelling a move. The public SignalGBX API does not change.
- These changes are local engineering decisions, not evidence of audit, deployment safety, or release readiness.
