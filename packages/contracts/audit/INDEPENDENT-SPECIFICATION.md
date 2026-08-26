# Independent adversarial specification

Date: 2026-08-15. Reconciled 2026-08-26 through ADR 0051.

This is the current review target for the unsuperseded portions of ADRs 0028, 0029, 0031, 0033-0051 in the
development candidate. ADR 0051 is outside the received V12 scope at `3ae171b`. This is not an independent audit
result.

## Authority model

- Deployments are direct and non-upgradeable. Fund is ownerless.
- Resonance is the only core contract with continuing custom owner authority. Its owner may add/kill Strategies,
  register Bribe rewards, set the one global prospective Bribe share from 0 through 2,000 basis points, transfer
  ownership, or renounce ownership. SignalGBX and both factories retain setup-only inherited ownership shells after
  their one-time bindings, with no remaining custom owner action. Mine has no administrative authority.
- The core contains no Governor, protocol Timelock, generic executor, or provider-specific governance adapter.
  SignalGBX retains ERC20Votes checkpoints for a future external integration, but the core assigns them no proposal,
  quorum, execution, delay, or cancellation semantics.
- External governance is unselected. Production requires a separately reviewed integration, renunciation of the three
  consumed setup-only ownership shells, and direct transfer of Resonance ownership to its exact executor, with no
  surviving temporary setup authority.
- No authority can change the fixed slot count, reprice an occupied slot, replace the GBX minter, set emissions,
  migrate, pause, rescue, sweep, or move Fund assets.

## GBX and Mine

- GBX starts with zero supply and permanently binds its only lifetime issuer to one deployed Mine whose reciprocal
  `gbx()` identity matches. Its setup minter cannot mint before that handoff.
- Supply reconciles as `lifetimeMinted - lifetimeBurned` and has no protocol-defined economic maximum. GBX retains
  ERC20Permit for general integrations but has no voting checkpoints; SignalGBX exposes the core's only IVotes
  checkpoints for a future external governance integration.
- Mine has exactly sixteen permanent slots from construction.
- Each slot price decays linearly to zero over one hour. Epoch ID, deadline, and maximum payment protect replacements.
- A replacement settles only the outgoing tenure in its selected slot. Each tenure receives `elapsed * slot.tps`, and
  `slot.tps` is never recomputed.
- The incoming tenure receives `globalTps(now - startTime) / 16`.
- `aggregateTps`, `storedPendingEmission`, and `pendingUpdatedAt` make total pending emission and effective supply
  constant-time without iterating or mutating all slots.
- Future-tenure global rates halve at immutable intervals measured from Mine deployment and stop falling at a positive tail.
- A nonempty price splits into an 80% outgoing tenure miner pull claim plus a 20% nominal deposit into
  ResonanceRouter. An empty slot deposits 100%.
- Mine uses `SafeERC20` without balance-delta checks and trusts canonical USDG to move requested amounts. Mine retains
  only outstanding claims, claims cannot be redirected, and `RevenueDeposited` records the nominal protocol share
  requested into ResonanceRouter.
- Mine never calls `ResonanceRouter.route()`. Routing is a later permissionless action with no caller role, bounty, or
  liveness guarantee. A failed Router deposit can revert a paid replacement; later Router or Resonance failure cannot.

## Signals, Strategies, and Bribes

- SignalGBX mints and burns one-for-one, is non-transferable, and accepts GBX only after reciprocal Resonance binding.
  Every mint atomically adds the same signal to live Strategies, and every burn atomically removes signal and returns
  the same GBX. Its supply is fully backed; unsolicited GBX is stranded surplus rather than token issuance. It retains
  ERC20Votes but not ERC20Permit and consumes no underlying permit signature.
- SignalGBX is the sole user-facing signal coordinator. Its balance is each account's aggregate signal. Scalar
  `addSignal`/`removeSignal` remain bounded; `addSignalMany`/`removeSignalMany` optionally aggregate custody and loop
  over caller-supplied allocations atomically. Idle sGBX is unreachable.
- Each paired Bribe owns account-by-Strategy signal weight and total Strategy signal weight. Resonance owns only the
  active global denominator and reads the Bribe's canonical `signalWeightOf` and `totalSignalWeight` values. A killed
  Strategy is excluded immediately while its Bribe weights remain recorded for exit.
- Resonance remains solvent for its scheduled balance and Strategy claims. Per-index and per-Strategy floors,
  zero-active-signal emission, and direct donations are intentionally unclassified surplus rather than Fund
  liabilities.
- The canonical deployment assumes six-decimal USDG, but Resonance, its Router, Mine, and Strategy account only in raw
  units and neither read nor enforce token decimals.
- Resonance stores one scalar four-field USDG schedule in `revenueData`: `periodFinish`, `revenueRate`,
  `lastUpdateTime`, and `revenuePerSignalStored`. It streams at `1e36` index precision using the ordinary whole-unit
  rate. A qualifying top-up
  checkpoints old weights, combines the new amount with `remainingRevenue()`, and restarts seven days; the rate remainder stays
  unallocated USDG surplus rather than being front-loaded.
- ResonanceRouter retains its complete balance below
  `max(REWARD_DURATION, Resonance.remainingRevenue())` and notifies the complete balance once it qualifies. A
  sub-`REWARD_DURATION` balance needs another deposit even after the old stream ends.
- A qualifying Router balance does not execute itself and may wait indefinitely until a manual, frontend, volunteer-
  keeper, or cron caller invokes `route()`.
- Killing a Strategy checkpoints and preserves its accrued claim, excludes its full weight from future Resonance
  revenue, blocks later signal additions, and leaves incumbent signalers free to exit without decrementing the active
  total twice. Its paired Bribe remains independently fundable.
- SignalGBX exposes no public move and Resonance exposes no dedicated move hook. Each retained add/remove hook
  checkpoints its Strategy before its own weight mutation. Smart wallets may compose direct calls atomically; a shared
  write Router is forbidden because it would become the signal owner under `msg.sender` semantics.
- One uniform Strategy type checkpoints and pulls released revenue before auctioning its complete USDG lot. Each
  payment snapshots Resonance's current global Bribe rate; the Fund rate is its complement and no Strategy override
  exists. For each purchase `a` at its snapshotted rate `r`, Strategy computes
  `bribeAmount = floor(a * r / 10_000)` and `fundAmount = a - bribeAmount`. No split remainder crosses purchases.
- Strategy pulls the payment, sends `fundAmount` directly to Fund, and transfers a nonzero `bribeAmount` to the paired
  BribeRouter. A failed Fund transfer reverts the purchase. The BribeRouter has no Fund leg or liability ledger; its
  permissionless `route()` notifies the paired Bribe with the complete buffered balance only after satisfying both
  `REWARD_DURATION` and `remainingReward` thresholds. Direct compatible-token Router donations join that notification.
- Bribes remain independently fundable and have at most sixteen registered reward tokens. Each token uses a four-field
  seven-day Synthetix schedule and a `1e36` index. Reward time continues at zero supply; notifications are not queued;
  and rate, index, and account floors remain unallocated Bribe surplus rather than carry or Fund liabilities.
  `claimRewards(account)` is the bounded all-token convenience path, while `claimReward(account, token)` isolates a
  broken token. Neither scalar nor batched signal removal transfers a reward token.
- At a 0% automatic rate, new Strategy payments go entirely to Fund. Existing reward settlement, independent
  notifications, signal additions, removals, and killed-Strategy exit remain unchanged and callable.
- Mine, SignalGBX, Strategy, Resonance, and Bribe use `SafeERC20` under standard canonical or
  registered-token assumptions rather than checking sender and receiver deltas. Fund redemption retains exact payout
  deltas and basket guards because selected assets are arbitrary.

## Fund

- Fund is registry-free and ownerless. Before redemption it validates the permanent Mine and reads its effective supply.
- Every selected token uses one effective pre-burn supply and raw balance snapshot. The burn and
  all exact transfers are atomic. Zero, GBX, and duplicates are rejected with EIP-1153 marks. A basket-wide final
  balance check rejects distinct selected addresses whose transfers consume the same snapshotted backing.
- The core contains no liquidity custodian or liquidity-specific settlement path. A reviewed, externally created
  fungible Uniswap v2-style USDG-GBX LP ERC-20 may be registered as an ordinary Strategy payment token and follows the
  same acquisition split as any other supported payment token.

## Release properties

- Foundry and Hardhat compile the same Solidity tree; SDK/subgraph ABIs come from current artifacts.
- TypeScript and Python independently assert fixed sixteen-slot tenure, future-tenure halvings, 80/20 payments, the
  no-economic-cap issuance model, effective-supply redemption, qualifying Resonance resets and surplus solvency. The
  Solidity suites cover per-purchase Strategy floors, direct Fund settlement, Router buffering, Synthetix leftover
  rollover, and Bribe surplus floors. The ADR-0048 focused suites passed 104/104 and the revised mutation campaign
  killed 47/47 mutants before ADRs 0049-0051; the complete deterministic/workspace and external campaigns require a
  post-ADR-0051 rerun.
- Current review must separately prove scalar and batch rollback, aggregate custody, duplicate-entry semantics, and
  that historical SignalGBX voting checkpoints survive removal. A later integration campaign must prove the selected external system's token compatibility,
  permissions, voting, proposal scope, delay, cancellation, execution, and ownership handoff.
- No consumer may display pending Mine accrual as already minted supply or the 80% replacement claim as guaranteed.
- A green local campaign does not clear independent audit, parameter, monitored testnet, manifest, licensing, or legal
  review gates.
