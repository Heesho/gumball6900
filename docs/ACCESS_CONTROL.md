# Access control

## Principles

- Core contracts are direct deployments with no proxy administrator.
- Administrative calls are purpose-specific; there is no arbitrary target/calldata executor.
- Timelocked actions wait at least seven days. Scheduling is proposer-only; mature execution is public.
- Guardian authority is stop-only and cannot resume or move value.
- Redemption, reset, post-reset unstaking, claims, ended-epoch settlement, fee collection, and burns remain outside
  protocol pause authority.

## Deployment-only initializers

| Initializer                              | One-time action                                       | Residual authority after success |
| ---------------------------------------- | ----------------------------------------------------- | -------------------------------- |
| `GBXToken.CONTROLLER_INITIALIZER`        | Bind first compatible controller.                     | None; repeat reverts.            |
| `MiningClaims.SOURCE_INITIALIZER`        | Bind `MiningPool` as claim source.                    | None; repeat reverts.            |
| `AllocationVoter.DEPENDENCY_INITIALIZER` | Bind vault, staked token, mining pool, and custodian. | None; repeat reverts.            |
| `StrategyRewards.STRATEGY_INITIALIZER`   | Bind its acquisition strategy.                        | None; repeat reverts.            |
| `EmergencyGuardian.TARGET_INITIALIZER`   | Bind pool, voter, and registry.                       | None; repeat reverts.            |
| `MiningPool.START_INITIALIZER`           | Start epoch zero after controller and NFT checks.     | None; second start reverts.      |

The minimal script uses `GBX_DEPLOYER` for these temporary roles and as the expected NFT depositor. A successful run
must leave it with zero GBX and cleared approvals. The immutable initializer addresses remain readable but their
one-shot paths are consumed.

## ProtocolTimelock operations

`DELAY = 7 days`. Operation IDs bind the timelock address, chain ID, action, ABI-encoded parameters, and salt. Only
the immutable `PROPOSER` schedules. After maturity, anyone may execute the exact parameters. There is no cancellation
or expiry; a scheduled operation stays executable until consumed.

| Action                       | Scheduled parameters                     | Value/security effect                                                           |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Replace controller           | token, candidate controller, salt        | Authorizes new mint code; can consume remaining lifetime capacity.              |
| Transfer position            | custodian, recipient, salt               | Moves the exact canonical NFT to deployed recipient code.                       |
| Register asset               | registry, token, strategy, rewards, salt | Adds target to basket and grants strategy live budget-release authority.        |
| Register standalone strategy | registry, strategy, salt                 | Grants buyback-like code live budget-release authority without adding an asset. |
| Disable strategy             | registry, voter, strategy, salt          | Terminally stops new budget use and moves checkpointed budget idle.             |
| Update team                  | mining pool, team, salt                  | Redirects only future optional 2% mining fees; zero disables the fee.           |
| Resume mining                | mining pool, salt                        | Reopens new contributions.                                                      |
| Resume signals               | voter, salt                              | Reopens signal increases.                                                       |
| Resume fills                 | strategy, salt                           | Reopens fills on that strategy if it remains live.                              |

The first four rows contain three categories of delayed code/value trust: controller replacement, exact-NFT recipient,
and strategy-code admission. These require code and operational review before scheduling.

### Controller compatibility checks

`GBXToken` requires candidate deployed code to report the same GBX and the canonical deployed mining pool cached at
initial controller binding. Replacement validation never calls the live controller and does not enforce an epoch or
schedule checkpoint, because permissionless settlement can advance it during the seven-day delay. It also does not
enforce the candidate's schedule, receiver, or runtime hash.

### Position recipient checks

The timelock and custodian require a nonzero deployed-code recipient. They do not require a successor interface,
runtime hash, or custody policy. Safe transfer acceptance is the only recipient behavior exercised onchain.

### Strategy registration checks

Acquisition registration checks the target, rewards, registry, and reciprocal rewards getters. Standalone
registration checks the registry getter. Those relationships do not prove auction, payment, burn, or receiver
semantics. Once live, any strategy can ask the vault to release at most its current signaled budget to an arbitrary
receiver selected by that strategy.

## Initial strategy state

Deployment creates an acquisition/rewards pair and a buyback contract but does not register either. The initial
registry contains only USDG and zero strategies. Fills and signals fail until the relevant typed registration is
separately scheduled, waits seven days, and executes. Execution atomically starts that strategy's first auction; its
clock does not run while the strategy is unregistered.

Pre-registration revenue—and any later revenue notified while active weight is zero—becomes idle. Registration does
not recover or allocate it retroactively.

## EmergencyGuardian

Only immutable `OPERATOR` may call the guardian coordinator.

| Guardian call                  | Effect                                    | Exit preserved                                     |
| ------------------------------ | ----------------------------------------- | -------------------------------------------------- |
| `pauseMiningContributions()`   | Reject new contributions.                 | Ended epoch settlement and claims.                 |
| `pauseSignalIncreases()`       | Reject weight increases.                  | Decreases, complete reset, and post-reset unstake. |
| `pauseStrategyFills(strategy)` | Pause fills on a currently live strategy. | Claims, redemption, reset, unstake.                |
| `disableStrategy(strategy)`    | Terminal registry/voter disablement.      | Existing reward claims and all user exits.         |

The guardian cannot resume, replace the controller, transfer the NFT, register code, update the team, release USDG,
move basket assets, mint, burn user funds, settle/invalidate epochs, or pause redemption. Terminal disablement also
enables the voter exit fallback: later zero-weight resets make no disabled-strategy rewards call and can clear used
weight for unstaking even if admitted code would revert or exhaust forwarded gas. Callbacks remain strict while the
strategy is live; honest rewards retain their terminal weight snapshot and already indexed claims.

## Public value-moving calls

| Caller        | Call                                | Authorization/value constraint                                                   |
| ------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Anyone        | settle ended mining epoch           | Time and sequential epoch state; payment destinations fixed.                     |
| Anyone        | claim mining/reward for beneficiary | Always pays that beneficiary.                                                    |
| Anyone        | collect position fees               | GBX burns; exact USDG goes to vault before notification.                         |
| User          | stake/unstake/signal/reset/redeem   | Own balances, stake bound, reset requirement, and atomic exact transfers.        |
| Filler        | acquisition/buyback fill            | Live strategy, auction ID/deadline/max, current budget, and implementation flow. |
| Live strategy | `GumBallVault.releaseUSDG`          | No more than current strategy budget; receiver is strategy-selected.             |

The final row is intentionally not receiver-restricted. Security relies on review of admitted strategy code plus the
budget cap and seven-day registration notice.

## Token compatibility

All configured tokens must be standard ERC-20, non-rebasing and non-fee-on-transfer. Exact debit/receipt assertions
fail closed where equality is required; other measured deltas are accounting guards. Neither broadens support. Token
issuer/admin powers remain external and can still impair liveness.

## Operational requirements

- Treat scheduling—not execution—as the critical alert because mature operations cannot be cancelled or expire.
- Publish parameters, source/build provenance, runtime hashes, and plain-language impact before scheduling.
- Independently verify the candidate controller, recipient, or strategy; getter equality is insufficient.
- Separate proposer and guardian control where operationally possible.
- Reconcile every broadcast receipt and onchain state transition; never rerun a partially broadcast script blindly.
- Preserve unresolved and provisional labels until a signed manifest and all external evidence exist.
