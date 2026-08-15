# ADR 0028: Closed Bribe pools after Strategy death

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-14
- Builds on: ADR 0019 incremental signals, ADR 0020 exact Bribe accounting, and ADR 0027 Bribe carry boundaries

## Context

`Resonance.killStrategy` permanently rejects new signal increases but deliberately leaves existing signal allocations
in place so each account can exit incrementally. The paired Bribe has no retirement state. Existing signalers can
therefore continue earning and claiming independently notified rewards after Strategy death.

If the last signaler exits while a reward stream is unfinished, Bribe pauses the stream at zero virtual supply. A
paused stream resumes only after a later signal deposit, which is impossible for a dead Strategy. Rewards notified
after virtual supply reaches zero enter the same unreachable terminal state. The tokens remain exactly accounted but
are not claimable by a user or Fund.

Adding a Bribe retirement transition, refund destination, rescue function, or Fund reclassification would add state
and policy to resolve value that signalers and reward funders can avoid abandoning themselves.

## Decision

Preserve the current terminal behavior:

- Strategy death does not change existing signal or Bribe balances.
- Existing signalers may remain for any duration, earn and claim Bribe rewards, and reduce or fully remove signal.
- No account, including an incumbent, may add signal to a dead Strategy.
- Bribe reward notification remains permissionless after Strategy death. While signal supply is nonzero, notified
  rewards belong exclusively to the closed set of incumbent signalers under the ordinary streaming rules.
- If the final signaler exits before all active and queued rewards finish, the remaining tokens stay permanently in
  Bribe. A later notification at zero supply has the same outcome.
- No retirement state, refund, rescue, sweep, migration, or Fund reclassification is introduced.

## Consequences

- Strategy death creates a simple closed pool rather than a second reward lifecycle.
- Incumbent signalers control whether to remain for scheduled rewards or exit and abandon them.
- Reward funders must inspect Strategy liveness and Bribe signal supply. Direct contract calls remain possible even
  when an interface warns against funding a dead zero-supply Bribe.
- The abandoned amount is unbounded and must not be described as necessarily dust.
- `BribeRetirementRiskTest.test_KnownRisk_DeadStrategyBribeCanPauseAndQueueRewardsForever` is retained as a regression
  proving the accepted terminal state.
- This acceptance does not replace independent review or approve deployment or user funds.
