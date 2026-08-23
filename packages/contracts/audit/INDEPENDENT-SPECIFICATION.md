# Independent adversarial specification

Date: 2026-08-15. Reconciled 2026-08-23 through ADR 0048.

This is the current review target for the unsuperseded portions of ADRs 0028, 0029, 0031, 0033-0048 in the
development candidate. It is not an independent audit result.

## Authority model

- Deployments are direct and non-upgradeable. Fund and LiquidityPosition are ownerless.
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
- No authority can change the fixed slot count, reprice an occupied slot, replace the GBX minter, set emissions, migrate, pause,
  rescue, sweep, move Fund assets, or withdraw the liquidity NFT.

## GBX and Mine

- GBX mints `20_000_000 ether` at construction, then permanently binds its only issuer to one deployed Mine whose
  reciprocal `gbx()` identity matches.
- Supply reconciles as `lifetimeMinted - lifetimeBurned` and has no protocol-defined economic maximum. GBX retains
  ERC20Permit for approval-based signaling but has no voting checkpoints; SignalGBX exposes the core's only IVotes
  checkpoints for a future external governance integration.
- Mine has exactly sixteen permanent slots from construction.
- Each slot price decays linearly to zero over one hour. Epoch ID, deadline, and maximum price protect handoffs.
- A handoff settles only the displaced slot. Each tenure receives `elapsed * slot.tps`, and `slot.tps` is never recomputed.
- The incoming tenure receives `globalTps(now - startTime) / 16`.
- `aggregateTps`, `storedPendingEmission`, and `pendingUpdatedAt` make total pending emission and effective supply
  constant-time without iterating or mutating all slots.
- Future-handoff global rates halve at immutable intervals measured from Mine deployment and stop falling at a positive tail.
- A nonempty price splits into an 80% displaced-miner pull claim plus a 20% exact deposit into ResonanceRouter. An
  empty slot deposits 100%.
- Exact USDG balance deltas are required. Mine retains only outstanding claims, claims cannot be redirected, and
  `RevenueDeposited` proves the protocol share reached ResonanceRouter.
- Mine never calls `ResonanceRouter.route()`. Routing is a later permissionless action with no caller role, bounty, or
  liveness guarantee. A failed Router deposit can revert a paid handoff; later Router or Resonance failure cannot.

## Signals, Strategies, and Bribes

- SignalGBX mints and burns one-for-one, is non-transferable, and accepts GBX only after reciprocal Resonance binding.
  Every mint atomically adds the same signal to one live Strategy, and every burn atomically removes signal and returns
  the same GBX. Its supply is fully backed; unsolicited GBX is stranded surplus rather than token issuance. It retains
  ERC20Votes but not ERC20Permit; `signalWithPermit` authorizes only the underlying GBX transfer.
- SignalGBX is the sole user-facing signal coordinator. Its balance is each account's aggregate signal and it supports
  atomic deposit-and-signal, live-to-live or killed-to-live moves, and remove-burn-withdraw. Idle sGBX is unreachable.
- Each paired Bribe owns account-by-Strategy balances and raw Strategy supply. Resonance owns only the active global
  denominator; compatibility views forward to those canonical ledgers. A killed Strategy is excluded immediately
  while its Bribe balances remain recorded for exit.
- Resonance remains solvent for its scheduled balance and Strategy claims. Per-index and per-Strategy floors,
  zero-active-signal emission, and direct donations are intentionally unclassified surplus rather than Fund
  liabilities.
- Resonance stores one scalar four-field USDG schedule: `periodFinish`, `rewardRate`, `lastUpdateTime`, and
  `rewardPerTokenStored`. It streams at `1e36` index precision using the ordinary whole-unit rate. A qualifying top-up
  checkpoints old weights, combines the new amount with `left()`, and restarts seven days; the rate remainder stays
  unallocated USDG surplus rather than being front-loaded.
- ResonanceRouter retains its complete balance below `max(DURATION, Resonance.left())` and notifies the complete
  balance once it qualifies. A sub-`DURATION` balance needs another deposit even after the old stream ends.
- A qualifying Router balance does not execute itself and may wait indefinitely until a manual, frontend, volunteer-
  keeper, or cron caller invokes `route()`.
- Killing a Strategy checkpoints and preserves its accrued claim, excludes its full weight from future rewards, blocks
  later additions, and leaves incumbent signalers free to exit without decrementing the active total twice.
- SignalGBX moves by calling `removeSignalFor` for the source and then `addSignalFor` for the destination in one
  transaction. Each hook checkpoints its Strategy before its own weight mutation; destination failure rolls the
  source removal back. Resonance exposes no dedicated move hook.
- One uniform Strategy type checkpoints and pulls released revenue before auctioning its complete USDG lot. Each
  payment snapshots Resonance's current global Bribe rate; the Fund rate is its complement and no Strategy override
  exists. For each purchase `a` at its snapshotted rate `r`, Strategy computes
  `bribeAmount = floor(a * r / 10_000)` and `fundAmount = a - bribeAmount`. No split remainder crosses purchases.
- Strategy pulls the payment, sends `fundAmount` directly to Fund, and transfers a nonzero `bribeAmount` to the paired
  BribeRouter. A failed Fund transfer reverts the purchase. The BribeRouter has no Fund leg or liability ledger; its
  permissionless `distribute()` notifies the paired Bribe with the complete buffered balance only after satisfying
  both the duration and active-left thresholds. Direct compatible-token Router donations join that notification.
- Bribes remain independently fundable and have at most sixteen registered reward tokens. Each token uses a four-field
  seven-day Synthetix schedule and a `1e36` index. Reward time continues at zero supply; notifications are not queued;
  and rate, index, and account floors remain unallocated Bribe surplus rather than carry or Fund liabilities.
  `claimRewards(account)` is the bounded all-token convenience path, while `claimReward(account, token)` isolates a
  broken token. Neither signal movement nor withdrawal transfers a reward token.
- At a 0% automatic rate, new Strategy payments go entirely to Fund. Existing reward settlement, independent
  notifications, signal, move, withdrawal, and killed-Strategy exit remain unchanged and callable.
- Strategy, Resonance, and Bribe use `SafeERC20` under a standard, non-rebasing token assumption rather than checking
  exact sender and receiver deltas. Mine, SignalGBX, Fund redemption, and LiquidityPosition retain their local
  custody-critical exact-delta checks.

## Fund and liquidity

- Fund is registry-free and ownerless. Before redemption it validates the permanent Mine and reads its effective supply.
- Every selected token uses one effective pre-burn supply and raw balance snapshot. The burn and
  all exact transfers are atomic. Zero, GBX, and duplicates are rejected with EIP-1153 marks. A basket-wide final
  balance check rejects distinct selected addresses whose transfers consume the same snapshotted backing.
- LiquidityPosition permanently holds one exact hookless GBX/USDG v4 NFT. Harvesting removes zero principal, deposits
  complete USDG into ResonanceRouter and attempts `route()` in the same transaction, burns complete GBX through Fund,
  and reverts on any failure. ADR 0044 does not decouple this path.

## Release properties

- Foundry and Hardhat compile the same Solidity tree; SDK/subgraph ABIs come from current artifacts.
- TypeScript and Python independently assert fixed sixteen-slot tenure, future-handoff halvings, 80/20 payments, the
  no-economic-cap issuance model, effective-supply redemption, qualifying Resonance resets and surplus solvency. The
  Solidity suites cover per-purchase Strategy floors, direct Fund settlement, Router buffering, Synthetix leftover
  rollover, and Bribe surplus floors. The ADR-0048 focused suites pass 104/104 and the revised mutation campaign kills
  47/47 mutants; the complete deterministic/workspace and external campaigns still require post-ADR-0048 reruns.
- Foundry separately proves coordinator rollback, move semantics, and that historical SignalGBX voting checkpoints
  survive withdrawal. A later integration campaign must prove the selected external system's token compatibility,
  permissions, voting, proposal scope, delay, cancellation, execution, and ownership handoff.
- No consumer may display pending Mine accrual as already minted supply or the 80% handoff as guaranteed.
- A green local campaign does not clear independent audit, parameter, monitored testnet, manifest, licensing, or legal
  review gates.
