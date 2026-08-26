# Killed-Strategy Bribe terminal-state decision

Status: accepted residual under ADR 0028, with its terminal accounting simplified by ADR 0047; no retirement or
escape-hatch code change. This note is engineering evidence, not deployment approval.

## Exact terminal state

When the last signaler exits a killed Strategy, `Bribe.removeSignalWeight` checkpoints every registered reward under the
old account and total signal weights, records the user's accrued whole-token claim, and reduces
`totalSignalWeight` to zero. No reward token or Fund asset moves during signal exit.

Reward time does not pause. The active `remainingReward(token)` amount continues to elapse while signal weight is
zero, but the reward index cannot advance without a denominator, so that emission is never allocated. A later
permissionless notification can also start or restart a stream at zero supply and its elapsed rewards are likewise
unclaimable because Strategy death prevents any new signal from entering. “Closed pool” means closed to new signal;
it does not disable reward-token registration, notification, or claims.

There is no exact unreachable-principal identity. It can include the active `remainingReward(token)`, later zero-supply
notifications as they elapse, rate/index/account floors, and direct donations outside notification accounting. The
remaining lifetime notification headroom is:

`MAX_LIFETIME_REWARD_AMOUNT - lifetimeRewardNotified[token]`

Already accrued whole-token user rewards remain claimable through the all-token or scalar-token claim. There is no
Fund reward liability, reward queue, paused schedule, or carry bucket. The abandoned amount is not bounded to dust:
it can include nearly a complete seven-day stream plus later notifications within lifetime headroom. ADR 0035/0037
bound raw units per token/Bribe pair, but the protocol does not bound their economic value.

## Alternatives considered

| Alternative                                  | Why it was rejected                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve the pool closed to new signal       | Matches ADR 0028, keeps death irreversible, preserves incumbent signalers' existing reward rights, and adds no authority. This is the accepted design.                             |
| Move remaining rewards to Fund on final exit | Changes ownership of explicitly scheduled rewards, requires a new terminal checkpoint/reclassification rule for every token, and conflicts with the accepted no-retirement policy. |
| Refund reward funders                        | Notifications are permissionless, can be aggregated from many callers, and Bribe stores no refundable notifier ledger. Adding one creates a new custody and withdrawal system.     |
| Permit signal re-entry after death           | Violates irreversible Strategy death and would restore weight to a Strategy excluded from future Resonance revenue.                                                                |
| Add rescue, sweep, successor, or migration   | Violates the protocol's immutable administrative surface and introduces discretionary asset control.                                                                               |
| Disable notifications after death            | Would remove incumbent signalers' ability to keep earning independently funded Bribes while the pool still has signal supply, changing ADR 0028's chosen behavior.                 |

## Operational controls

- Interfaces must show Strategy liveness and warn before the final signal exits when any registered reward has a
  nonzero `remainingReward(token)` amount.
- Reward-funding clients must warn on every killed Strategy and refuse by default when its Bribe signal supply is zero.
  Direct contract calls remain possible while lifetime headroom remains and cannot be made recoverable.
- Monitoring must classify
  `killed Strategy && Bribe.totalSignalWeight() == 0 && Bribe.remainingReward(token) > 0` as a stream whose
  later emission will be permanently unclaimable, not as a recoverable protocol receivable. Token balance alone
  cannot distinguish scheduled value, accrued user rewards, direct donations, and floor surplus.
- Monitoring and reward-funding clients should expose `lifetimeRewardNotified(token)` and
  `MAX_LIFETIME_REWARD_AMOUNT`; reaching the cap rejects only new notifications and does not create a withdrawal or
  retirement right.
- The deterministic regressions `BribeRetirementCompatibilityTest.test_KilledStrategySignalCanExitAndCannotEarnAfterExit`
  and `AdversarialTest.test_KillingAStrategyDoesNotConfiscateStreamingRewards` must remain green.

ADR 0035/0037 fix the separate cumulative-index liveness risk without changing this ownership decision. ADR 0047
removes the queue, pause, carry, and Fund-reward accounting without adding a recovery beneficiary. A killed Strategy
is not needed to escape the overflow condition: the lifetime cap keeps every admitted checkpoint representable, so
existing positions can still be removed after notification capacity is exhausted. Smart accounts may reallocate by
composing direct removal from the killed Strategy with addition to a live Strategy.

Reopen this decision only through an explicit replacement ADR that defines reward ownership at retirement and accepts
the resulting trust-model change. Do not patch the expected regression or add an authority as an operational fix.
