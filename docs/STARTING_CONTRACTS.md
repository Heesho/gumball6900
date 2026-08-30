# Canonical contract starting point

> This is the target development architecture under ADRs 0031 and 0033-0055 in whole or in their recorded
> unsuperseded parts, not a claim of current Solidity
> conformance, deployment, audit, or authorization for user funds. Implementation gaps are listed in
> [ARCHITECTURE-IMPLEMENTATION-GAP.md](ARCHITECTURE-IMPLEMENTATION-GAP.md).

## Core graph

```text
nonempty slot replacement -> Mine -> 20% deposit -> ResonanceRouter --permissionless route()--> Resonance -> seven-day stream -> Strategies
                                   -> 80% outgoing-tenure-miner claim
empty-slot payment -------------> Mine -> 100% deposit -> ResonanceRouter
                                      |       |
                                      |       +-> acquired payment --complement--> Fund
                                      |                             \--global 0%-20%--> BribeRouter --> paired Bribe
                                      +-> additional Bribe rewards -> signalers

seeded Uniswap V2 USDG/GBX LP ERC-20 -> ordinary bootstrap Strategy -> Fund / paired Bribe

GBXLauncher --fixed Mine issue + 1 USDG--> USDG/GBX Pair --all genesis LP--> address(0)
            \--register Strategies; remove setup owners; begin Mine + Resonance handoffs--> external governance

GBX -> SignalGBX -> signals -> Resonance
                  -> IVotes checkpoints -> external governance (unselected) -> Mine + Resonance ownership
```

Resonance's revenue stream is permanently USDG-only and uses a scalar schedule and per-Strategy revenue state. Bribes
remain independently multi-token within their fixed sixteen-token cap.

The first purchase of an empty mining slot has no outgoing tenure miner, so its complete USDG payment is deposited into
ResonanceRouter. Mine never calls `route()` during a replacement. GBX holders atomically deposit GBX, mint one-for-one non-transferable SignalGBX (`sGBX`), and assign
every minted unit to a live Strategy. sGBX retains ERC20Votes checkpoints for a future external governance integration
and is the sole user-facing signal coordinator; an idle receipt state is not permitted.

## Contract responsibilities

| Contract          | Responsibility and important boundaries                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GBX`             | Constructs with zero supply, permanently hands its only lifetime mint authority to Mine before issuance, and supports ERC-2612 permit. It has no voting checkpoints. |
| `Mine`            | Makes one fixed genesis issue, runs sixteen immutable hourly slots, splits payments 80%/20%, and exposes one governed validated Router pointer for future revenue.   |
| `SignalGBX`       | Holds GBX, mints only signal-backed non-transferable ERC20Votes sGBX, and coordinates every signal and withdrawal. It has no approval permit or idle state.          |
| `ResonanceRouter` | Buffers USDG until its balance can sustain a nonzero stream and cover the active amount left, then forwards it permissionlessly.                                     |
| `Resonance`       | Maintains the active signal total and one Bribe-shaped seven-day USDG schedule, and creates the fixed Strategy/Bribe graph.                                          |
| `StrategyFactory` | Bound once to Resonance; only that Resonance may deploy Strategies and their BribeRouters.                                                                           |
| `Strategy`        | Sells its complete USDG balance, pays the floored Bribe share to its Router, and pays the complement directly to Fund.                                               |
| `BribeFactory`    | Bound once to Resonance; only that Resonance may deploy Bribes.                                                                                                      |
| `BribeRouter`     | Minimal acquired-asset buffer that permissionlessly notifies its paired Bribe once simple stream gates are met.                                                      |
| `Bribe`           | Streams the automatic acquired-asset share and additional rewards over virtual signal balances, within fixed token-count and lifetime-notification caps.             |
| `Fund`            | Ownerless raw-token treasury, permissionless GBX burn boundary, and caller-selected pro-rata redemption mechanism.                                                   |

## Supply and mining

GBX starts construction with zero supply and zero lifetime minted. Its temporary deployment minter may call
`setMinter` exactly once, and only with a deployed contract; it cannot call `mint` before that binding is locked. Mine
then becomes the only lifetime issuer. The canonical launcher gives Mine one temporary `genesisAuthority`, which Mine
consumes and clears when it issues the fixed `1,000 ether` GBX directly to the validated Pair. The amount is not slot
emission and cannot be changed or repeated. The supply identities are:

```text
GBX total supply = GBX lifetime minted - GBX lifetime burned

GBX lifetime minted = Mine totalMined
                    + (genesisLiquidityMinted ? 1,000 GBX : 0)
```

Mine starts with exactly sixteen permanent slots and has no capacity control. Each slot may
be replaced at any time. Its quoted USDG price falls linearly from `initialPrice` to zero over one hour. A nonempty-slot
replacement makes 80% of the price claimable by the outgoing tenure miner and deposits the 20% remainder into
ResonanceRouter. An empty slot deposits 100% because there is no outgoing tenure miner. Mine uses `SafeERC20` and trusts the
canonical USDG's standard transfer semantics without balance-delta checks. Mine's `RevenueDeposited` event records the
requested nominal deposit; under that supported-token assumption it reached the Router, but the event does not mean
Resonance received a notification in the same transaction. Mine's `Ownable2Step` owner cannot change slots, emissions,
prices, claims, GBX, USDG, or Fund. Its only custom authority may set a different Router for future deposits after
validating a reciprocally bound replacement graph. Each replacement may attach up
to 280 raw bytes of event-only message metadata; empty messages are allowed and Mine never stores the message.

Each newly opened tenure receives `current global TPS / 16`. That assigned rate is locked for the entire tenure.
Time-based halving boundaries, Fund redemptions, and other slots' replacements do not change it. The accepted consequence is higher
aggregate issuance after a halving for as long as older slots remain; turnover is not guaranteed. Mine maintains exact
total pending emission in constant time, and Fund reads effective supply without calling or mutating all slots.

The global rate used for future tenures begins at 64 GBX per second, halves on a hard-coded 69-day schedule measured
from Mine deployment, and reaches a 1 GBX-per-second tail at day 414. These values are provisional pending independent
economic review. There is no protocol-defined economic maximum GBX supply, rate setter, oracle, balance or position
migration, or team fee.

## Atomic launch and external liquidity Strategy

The continuing core owns or manages no liquidity, but the development-only `GBXLauncher` is a narrow deployment
exception under ADR 0054. It is callable once by one immutable authority on Robinhood Chain mainnet and uses the pinned
Uniswap V2 Factory directly. Four predeployed component modules split CREATE work but retain no state or authority.
The launcher deploys and binds the complete graph, creates a new USDG/GBX Pair, transfers
exactly `1e6` raw six-decimal USDG plus the Mine-issued 1,000 GBX, and mints every genesis LP unit to `address(0)`.

The fixed seed must produce `31,622,776,601,683` raw total LP supply, all permanently locked. The launcher never adopts
or skims an existing Pair. If the Factory lookup is already nonzero for that launcher's deterministic GBX, the
transaction reverts with `PairAlreadyExists` and an unused launcher can be replaced with a fresh launcher whose caller-scoped CREATE2 outputs produce a
different GBX and Pair. The V2 Router is recorded but is not called during genesis.

Before removing setup authority, the launcher registers exactly two ordinary Strategies: GBX at initial/minimum price
`100,000 ether`, then the actual Pair at initial/minimum price `50 * pair.totalSupply()`. Both have a 24-hour epoch and
`1.2e18` multiplier. Each first epoch can decay to zero before inventory arrives because `minimumPrice` controls the
next epoch's start. Later LP follows the same global Fund/Bribe split as every supported payment asset, and Fund-held
LP remains caller-selectable redemption backing. The launcher adds no continuing liquidity custody, price, harvest,
swap, rebalance, or guarantee.

## Revenue and acquisition rules

- Resonance uses one scalar seven-day Synthetix-style USDG schedule. Ordinary rate division may leave surplus; its
  global revenue-per-signal index uses `1e36` precision. Its monotonic fresh-notification total cannot exceed
  `floor(type(uint256).max / 1e36)`, preserving index representability at the minimum positive signal denominator.
- SignalGBX is the only external signal entrypoint. Its signal changes checkpoint elapsed revenue under the prior
  weights before changing them. A Strategy purchase checkpoints and transfers its released allocation before reading
  inventory. No lock, cooldown, or epoch is added.
- `SignalGBX.balanceOf(account)` is each account's aggregate signal, each paired Bribe stores
  `signalWeightOf(account)` and `totalSignalWeight`, and Resonance stores only the active live-Strategy total.
- `addSignal`, `addSignalMany`, `removeSignal`, and `removeSignalMany` are the only public SignalGBX position
  workflows. Addition deposits and mints; removal is its exact burn-and-return inverse. Batch variants aggregate GBX
  custody while preserving one incremental event per allocation. SignalGBX consumes no permit signature.
- Resonance retains only `addSignalFor` and `removeSignalFor`. There is no public move, dedicated Resonance move hook,
  or shared write-through signal Router. Smart accounts may atomically compose approval and direct SignalGBX calls.
- `ResonanceRouter.route()` is permissionless. A manual caller, frontend, volunteer keeper, or cron process may call;
  there is no role, bounty, or protocol liveness guarantee. During an active schedule the Router can hold any balance
  until called. If the balance is at least `max(REWARD_DURATION, remainingRevenue())`, Resonance checkpoints and
  restarts seven days with ordinary leftover rollover; a nonzero smaller balance remains held.
- Released revenue is indexed pro rata across live Strategy weights. Global-index and per-Strategy floors remain
  accepted surplus. Revenue elapsed while active signal weight is zero and USDG donated directly to Resonance are also
  unclaimable or unscheduled surplus, with no Fund classification, synchronization, rescue, or recovery path.
- Killing a Strategy is irreversible: the kill checkpoints and preserves its accrued claim, excludes its complete
  weight from active revenue allocation, rejects additions, and lets existing signalers remove without subtracting that weight
  from the active total a second time. After bootstrap the final live Strategy cannot be killed until a replacement is
  added; killed positions remain removable through either scalar or batch exit.
- SignalGBX supply equals aggregate signal across live and killed paired Bribes; idle sGBX is unreachable.
- Every Strategy snapshots Resonance's global `bribeBps` before payment-token interaction. It defaults to 10%, is
  governance-settable from 0% through 20%, and has no per-Strategy override. Strategy sends the floored Bribe share to
  BribeRouter and the complement directly to Fund. There is no cumulative split carry or deferred Fund settlement.
- At 0%, new payments go entirely to Fund. The paired Bribe remains active for signal accounting, existing and
  independent rewards, and scalar or batched additions and removals. Raising the rate later resumes automatic rewards
  without replacing the Strategy graph.
- A GBX Strategy payment is not burned at settlement. Once the dynamically Fund-classified share reaches Fund, anyone
  may burn it with `Fund.burnGBX`; any nonzero Bribe share funds the paired Bribe.
- Bribes use a `1e36` reward-per-signal index, receive the acquired payment asset automatically, and may receive
  additional independent notifications. For each reward token and Bribe, the monotonic accepted-notification total
  cannot exceed `floor(type(uint256).max / 1e36)` raw units. The limit has no reset, setter, or escape hatch and rejects excess before
  checkpointing or transfer, leaving existing claims and exits live.
- Bribes use standard leftover rollover; a notification must be at least `REWARD_DURATION` raw units and at least the
  current amount left. Streams do not pause at zero `totalSignalWeight`, notifications do not queue, and rate/index/account floors
  remain unallocated surplus. If notification fails, the automatic reward share remains buffered in BribeRouter.
- Direct Bribe claims authorize only the beneficiary or the Bribe's immutable Resonance. Resonance exposes one optional
  caller-selected Strategy-array batch that always claims each canonical paired Bribe for `msg.sender`, including for
  registered killed Strategies. Empty arrays and unregistered Strategies revert, duplicates execute sequentially, and
  the complete caller-controlled batch is atomic. The beneficiary's direct scalar-token claim remains available to
  isolate a broken reward token or split unaffordable batch work.

## Fund redemption

Before every redemption, Fund reads Mine's constant-time effective supply. This includes accrued unminted GBX in the
common pre-burn denominator without iterating or mutating mining slots:

```text
payout(token) = floor(Fund balance(token) * GBX burned / (GBX totalSupply() + pending emission) before burn)
```

The caller chooses a nonempty array of unique non-GBX tokens. Fund snapshots balances, transfers in and burns GBX,
then transfers each payout atomically. EIP-1153 transient storage rejects duplicate entries without maintaining an
asset registry. Omitted assets remain for the post-redemption supply.

## Governance

There is no balance migration or upgrade path. Fund is ownerless. The core includes no Governor, Timelock, generic
executor, or provider-specific governance adapter. Mine and Resonance use `Ownable2Step`. Mine's only custom owner
method is `setResonanceRouter`, which changes only future revenue after validating the candidate against Mine's
immutable GBX, USDG, and Fund. Resonance's protocol administration surface is:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeRewardToken`, subject to the immutable sixteen-token cap; and
- `Resonance.setBribeBps`, globally bounded from 0 through 2,000 basis points.

Resonance's separate setup-only `setResonanceRouter` action is consumed by the launcher before handoff. It binds the
sole notifying Router exactly once and cannot replace or clear it later.

SignalGBX retains block-number ERC20Votes checkpoints, but the core assigns them no proposal, quorum, delay,
cancellation, or execution semantics. Mine and Resonance owners may begin two-step transfer or immediately renounce.
SignalGBX, StrategyFactory, and BribeFactory retain plain-`Ownable` shells after their one-time Resonance bindings, but
no remaining custom owner action. Every reviewed initial Strategy must be bootstrapped before the canonical launcher
makes the exact external governance executor pending owner of Mine and Resonance. The launcher renounces the consumed
setup-only shells and clears Mine's genesis authority in the atomic launch; governance accepts both continuing
ownerships afterward. The integration's exact
release, code, plugins,
permissions, voting rules, administrators, upgrade model, batching, delay, and cancellation semantics remain
unselected, so deployment is blocked.

The Mine Router setter is a prospective cutover, not a state migration. Governance deploys and binds the complete new
graph first and switches Mine last. Old Router and Resonance balances, Strategy claims, Bribe rewards, and signal
positions remain in the old graph; users claim and unsignal there before optionally signaling returned GBX in the new
graph.

## Deliberate scope

- Deployment broadcasting is intentionally absent.
- The external governance integration and production Mine/Resonance owner remain unresolved release inputs.
- Mine replacement-price constants are fixed by ADR 0038, its time-based schedule by ADR 0041, and the current
  provisional rates and period by ADRs 0042 and 0043; independent review remains required. ADR 0054 fixes the launch
  chain, Factory, seed amounts, genesis LP math, and initial Strategy parameters, all of which require independent
  target-state and economic review.
- Independent security review and production deployment evidence remain required.
- donut-miner provenance and licensing clearance remain a release blocker recorded in `NOTICE`.

## Credit

The starting mechanics are adapted from give.fun, Liquid Signal Governance, and donut-miner. Strategy's auction design
also credits Euler Fee Flow. Exact and unresolved repository pins are recorded in `NOTICE`.
