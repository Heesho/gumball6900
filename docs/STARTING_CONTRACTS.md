# Canonical contract starting point

> This is the target development architecture under ADRs 0031 and 0033-0050 in whole or in their recorded
> unsuperseded parts, not a claim of current Solidity
> conformance, deployment, audit, or authorization for user funds. Implementation gaps are listed in
> [ARCHITECTURE-IMPLEMENTATION-GAP.md](ARCHITECTURE-IMPLEMENTATION-GAP.md).

## Core graph

```text
slot replacement -> Mine -> 20% deposit -> ResonanceRouter --permissionless route()--> Resonance -> seven-day stream -> Strategies
                          -> 80% displaced-miner claim
                                      |       |
                                      |       +-> acquired payment --complement--> Fund
                                      |                             \--global 0%-20%--> BribeRouter --> paired Bribe
                                      +-> additional Bribe rewards -> signalers

external USDG/GBX LP ERC-20 -> ordinary bootstrap Strategy -> Fund / paired Bribe

GBX -> SignalGBX -> signals -> Resonance
                  -> IVotes checkpoints -> external governance (unselected) -> Resonance ownership
```

Resonance's revenue stream is permanently USDG-only and uses scalar schedule and per-Strategy reward state. Bribes
remain independently multi-token within their fixed sixteen-token cap.

The first purchase of an empty mining slot has no displaced miner, so its complete USDG payment is deposited into
ResonanceRouter. Mine never calls `route()` during a handoff. GBX holders atomically deposit GBX, mint one-for-one non-transferable SignalGBX (`sGBX`), and assign
every minted unit to a live Strategy. sGBX retains ERC20Votes checkpoints for a future external governance integration
and is the sole user-facing signal coordinator; an idle receipt state is not permitted.

## Contract responsibilities

| Contract          | Responsibility and important boundaries                                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GBX`             | Starts with zero supply, permanently hands its only lifetime mint authority to Mine before minting can begin, and supports ERC-2612 permit. It has no voting checkpoints.                                                                |
| `Mine`            | Runs exactly sixteen independently replaceable hourly reverse-Dutch slots, checkpoints continuous GBX accrual, splits nonempty-slot replacement payments 80%/20%, and deposits protocol revenue into ResonanceRouter without calling it. |
| `SignalGBX`       | Holds GBX, mints only signal-backed non-transferable ERC20Votes sGBX, and coordinates every signal and withdrawal. It has no approval permit or idle state.                                                                              |
| `ResonanceRouter` | Buffers USDG until its balance can sustain a nonzero stream and cover the active amount left, then forwards it permissionlessly.                                                                                                         |
| `Resonance`       | Maintains the active signal total and one Bribe-shaped seven-day USDG schedule, and creates the fixed Strategy/Bribe graph.                                                                                                              |
| `StrategyFactory` | Bound once to Resonance; only that Resonance may deploy Strategies and their BribeRouters.                                                                                                                                               |
| `Strategy`        | Sells its complete USDG balance, pays the floored Bribe share to its Router, and pays the complement directly to Fund.                                                                                                                   |
| `BribeFactory`    | Bound once to Resonance; only that Resonance may deploy Bribes.                                                                                                                                                                          |
| `BribeRouter`     | Minimal acquired-asset buffer that permissionlessly notifies its paired Bribe once simple stream gates are met.                                                                                                                          |
| `Bribe`           | Streams the automatic acquired-asset share and additional rewards over virtual signal balances, within fixed token-count and lifetime-notification caps.                                                                                 |
| `Fund`            | Ownerless raw-token treasury, permissionless GBX burn boundary, and caller-selected pro-rata redemption mechanism.                                                                                                                       |

## Supply and mining

GBX starts with zero supply and zero lifetime minted. Its temporary deployment minter may call `setMinter` exactly
once, and only with a deployed contract; it cannot call `mint` before that binding is locked. Mine then becomes the
only lifetime issuer. The
supply identity is:

```text
GBX total supply = GBX lifetime minted - GBX lifetime burned
```

Mine starts with exactly sixteen permanent slots and has no owner or capacity control. Each slot may
be replaced at any time. Its quoted USDG price falls linearly from `initialPrice` to zero over one hour. A nonempty-slot
replacement makes 80% of the price claimable by the displaced miner and deposits the 20% remainder into
ResonanceRouter. An empty slot deposits 100% because there is no displaced miner. Mine uses `SafeERC20` and trusts the
canonical USDG's standard transfer semantics without balance-delta checks. Mine's `RevenueDeposited` event records the
requested nominal deposit; under that supported-token assumption it reached the Router, but the event does not mean
Resonance received a notification in the same transaction. Each handoff may attach up
to 280 raw bytes of event-only message metadata; empty messages are allowed and Mine never stores the message.

Each new occupant receives `current global TPS / 16`. That assigned rate is locked for the entire tenure. Time-based
halving boundaries, Fund redemptions, and other slots' handoffs do not change it. The accepted consequence is higher
aggregate issuance after a halving for as long as older slots remain; turnover is not guaranteed. Mine maintains exact
total pending emission in constant time, and Fund reads effective supply without calling or mutating all slots.

The global rate used for future handoffs begins at 64 GBX per second, halves on a hard-coded 69-day schedule measured
from Mine deployment, and reaches a 1 GBX-per-second tail at day 414. These values are provisional pending independent
economic review. There is no protocol-defined economic maximum GBX supply, rate setter, oracle, migration, or team fee.

## External liquidity Strategy

One reviewed external fungible Uniswap v2-style USDG/GBX LP ERC-20 is registered during bootstrap as an ordinary
Strategy payment token. Its exact address and Strategy configuration remain deployment inputs. Its purchases use the
same global Fund/Bribe split as every other Strategy, and Fund holds its share as an ordinary redemption asset. The
core creates, owns, prices, harvests, swaps, or guarantees no liquidity.

## Revenue and acquisition rules

- Resonance uses one scalar seven-day Synthetix-style USDG schedule. Ordinary rate division may leave surplus; its
  global revenue-per-signal index uses `1e36` precision.
- SignalGBX is the only external signal entrypoint. Its signal changes checkpoint elapsed revenue under the prior
  weights before changing them. A Strategy purchase checkpoints and transfers its released allocation before reading
  inventory. No lock, cooldown, or epoch is added.
- `SignalGBX.balanceOf(account)` is each account's aggregate signal, each paired Bribe stores account-by-Strategy
  balances and per-Strategy supply, and Resonance stores only the active live-Strategy total.
- `signal`, `signalWithPermit`, `moveSignal`, and `withdrawSignal` are the only public SignalGBX position workflows.
  Minting and initial allocation are one transition; withdrawal is its exact inverse. The permit variant uses GBX's
  ERC-2612 permit; SignalGBX has no approval permit.
- `moveSignal` atomically composes Resonance's retained `removeSignalFor` and `addSignalFor` hooks. Resonance has no
  dedicated move hook, and any destination failure rolls the source removal back with the complete transaction.
- `ResonanceRouter.route()` is permissionless. A manual caller, frontend, volunteer keeper, or cron process may call;
  there is no role, bounty, or protocol liveness guarantee. During an active schedule the Router can hold any balance
  until called. If the balance is at least `max(REWARD_DURATION, remainingRevenue())`, Resonance checkpoints and
  restarts seven days with ordinary leftover rollover; a nonzero smaller balance remains held.
- Released revenue is indexed pro rata across live Strategy weights. Global-index and per-Strategy floors remain
  accepted surplus. Revenue elapsed while active signal weight is zero and USDG donated directly to Resonance are also
  unclaimable or unscheduled surplus, with no Fund classification, synchronization, rescue, or recovery path.
- Killing a Strategy is irreversible: the kill checkpoints and preserves its accrued claim, excludes its complete
  weight from active rewards, rejects additions, and lets existing signalers remove without subtracting that weight
  from the active total a second time. After bootstrap the final live Strategy cannot be killed until a replacement is
  added; killed positions remain movable to a live Strategy or withdrawable.
- SignalGBX supply equals aggregate signal across live and killed paired Bribes; idle sGBX is unreachable.
- Every Strategy snapshots Resonance's global `bribeBps` before payment-token interaction. It defaults to 10%, is
  governance-settable from 0% through 20%, and has no per-Strategy override. Strategy sends the floored Bribe share to
  BribeRouter and the complement directly to Fund. There is no cumulative split carry or deferred Fund settlement.
- At 0%, new payments go entirely to Fund. The paired Bribe remains active for signal accounting, existing and
  independent rewards, moves, and withdrawals. Raising the rate later resumes automatic rewards without replacing the
  Strategy graph.
- A GBX Strategy payment is not burned at settlement. Once the dynamically Fund-classified share reaches Fund, anyone
  may burn it with `Fund.burnGBX`; any nonzero Bribe share funds the paired Bribe.
- Bribes use a `1e36` reward-per-signal index, receive the acquired payment asset automatically, and may receive
  additional independent notifications. For each reward token and Bribe, the monotonic accepted-notification total
  cannot exceed `floor(type(uint256).max / 1e36)` raw units. The limit has no reset, setter, or escape hatch and rejects excess before
  checkpointing or transfer, leaving existing claims and exits live.
- Bribes use standard leftover rollover; a notification must be at least `REWARD_DURATION` raw units and at least the
  current amount left. Streams do not pause at zero supply, notifications do not queue, and rate/index/account floors
  remain unallocated surplus. If notification fails, the automatic reward share remains buffered in BribeRouter.

## Fund redemption

Before every redemption, Fund reads Mine's constant-time effective supply. This includes accrued unminted GBX in the
common pre-burn denominator without iterating or mutating mining slots:

```text
payout(token) = floor(Fund balance(token) * GBX burned / GBX total supply before burn)
```

The caller chooses a nonempty array of unique non-GBX tokens. Fund snapshots balances, transfers in and burns GBX,
then transfers each payout atomically. EIP-1153 transient storage rejects duplicate entries without maintaining an
asset registry. Omitted assets remain for the post-redemption supply.

## Governance

There is no migration or upgrade path. Fund and Mine are ownerless. The core includes no Governor,
Timelock, generic executor, or provider-specific governance adapter. Resonance is the only core contract with
continuing custom owner authority, and its protocol administration surface is:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeRewardToken`, subject to the immutable sixteen-token cap; and
- `Resonance.setBribeBps`, globally bounded from 0 through 2,000 basis points.

SignalGBX retains block-number ERC20Votes checkpoints, but the core assigns them no proposal, quorum, delay,
cancellation, or execution semantics. Resonance's owner may also transfer or renounce ownership. SignalGBX,
StrategyFactory, and BribeFactory retain inherited ownership shells after their one-time Resonance bindings, but no
remaining custom owner action. Every reviewed initial Strategy must be bootstrapped before Resonance ownership moves
directly to the exact external governance executor selected by a later ADR, and the consumed setup-only shells must be
renounced so the temporary authority is removed everywhere. The integration's exact release, code, plugins,
permissions, voting rules, administrators, upgrade model, batching, delay, and cancellation semantics remain
unselected, so deployment is blocked.

## Deliberate scope

- Deployment broadcasting is intentionally absent.
- The external governance integration and production Resonance owner remain unresolved release inputs.
- Mine replacement-price constants are fixed by ADR 0038, its time-based schedule by ADR 0041, and the current
  provisional rates and period by ADRs 0042 and 0043; independent review remains required. The external LP token
  address and Strategy configuration remain reviewed deployment inputs.
- Independent security review and production deployment evidence remain required.
- donut-miner provenance and licensing clearance remain a release blocker recorded in `NOTICE`.

## Credit

The starting mechanics are adapted from give.fun, Liquid Signal Governance, and donut-miner. Strategy's auction design
also credits Euler Fee Flow. Exact and unresolved repository pins are recorded in `NOTICE`.
