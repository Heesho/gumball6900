# Killed-Strategy Bribe terminal-state decision

Status: accepted residual under ADR 0028 and preserved by ADR 0035; no retirement or escape-hatch code change. This
note is engineering evidence, not deployment approval.

## Exact terminal state

When the last signaler exits a dead Strategy, `Bribe.withdraw` checkpoints every registered reward, fixes old-supply
aggregate carry and the exiting account's sub-token remainder to Fund, records the user's already accrued whole-token
claim, reduces virtual supply to zero, and pauses each unfinished stream. No reward transfer occurs during the signal
exit.

The exact unreachable principal for one reward token is:

`scheduledRewards[token] + queuedRewards[token] + successful later zero-supply notifications`

The last term cannot exceed the token's remaining lifetime headroom:

`MAX_LIFETIME_REWARD_AMOUNT - lifetimeRewardNotified[token]`

Already accrued user liabilities remain claimable. Whole Fund liabilities remain permissionlessly payable. Direct
donations that did not pass through `notifyRewardAmount` are outside Bribe accounting and are not included in the
formula. The abandoned amount is not bounded to dust: it can include nearly a complete seven-day stream plus the
remaining notification headroom. ADR 0035 bounds raw units per token/Bribe pair, but the protocol does not bound their
economic value.

## Alternatives considered

| Alternative                                  | Why it was rejected                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve the closed pool                     | Matches ADR 0028, keeps death irreversible, preserves incumbent signalers' existing reward rights, and adds no authority. This is the accepted design.                             |
| Move remaining rewards to Fund on final exit | Changes ownership of explicitly scheduled rewards, requires a new terminal checkpoint/reclassification rule for every token, and conflicts with the accepted no-retirement policy. |
| Refund reward funders                        | Notifications are permissionless, can be aggregated from many callers, and Bribe stores no refundable notifier ledger. Adding one creates a new custody and withdrawal system.     |
| Permit signal re-entry after death           | Violates irreversible Strategy death and would restore weight to a Strategy excluded from future Resonance revenue.                                                                |
| Add rescue, sweep, successor, or migration   | Violates the protocol's immutable administrative surface and introduces discretionary asset control.                                                                               |
| Disable notifications after death            | Would remove incumbent signalers' ability to keep earning independently funded Bribes while the closed pool still has supply, changing ADR 0028's chosen behavior.                 |

## Operational controls

- Interfaces must show Strategy liveness and warn before the final signal exits when any registered reward has a
  nonzero scheduled or queued amount.
- Reward-funding clients must warn on every dead Strategy and refuse by default when its Bribe signal supply is zero.
  Direct contract calls remain possible while lifetime headroom remains and cannot be made recoverable.
- Monitoring must classify `dead Strategy && Bribe.totalSupply() == 0 && (scheduledRewards > 0 || queuedRewards > 0)`
  as permanently unreachable under the accepted policy, not as a recoverable protocol receivable.
- Monitoring and reward-funding clients should expose `lifetimeRewardNotified(token)` and
  `MAX_LIFETIME_REWARD_AMOUNT`; reaching the cap rejects only new notifications and does not create a withdrawal or
  retirement right.
- The deterministic regression
  `BribeRetirementRiskTest.test_KnownRisk_DeadStrategyBribeCanPauseAndQueueRewardsForever` must remain green.

ADR 0035 deliberately fixes the separate cumulative-index liveness risk without changing this ownership decision. A
killed Strategy is not needed to escape the overflow condition: the lifetime cap keeps every admitted checkpoint
representable, so existing positions can still move or withdraw after notification capacity is exhausted.

Reopen this decision only through an explicit replacement ADR that defines reward ownership at retirement and accepts
the resulting trust-model change. Do not patch the expected regression or add an authority as an operational fix.
