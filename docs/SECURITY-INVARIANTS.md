# Security invariants

This file defines the accounting identities used by the hardening tests. For Resonance revenue and Bribe rewards,
`P = 1e36`.
Quantities named `Scaled` already include their subsystem's precision unit.

> ADRs 0031, 0034, 0035, 0037, and 0047-0055 make the supply, launcher, SignalGBX, Bribe, Strategy settlement, and
> external-governance boundary below authoritative. Governance execution remains unselected and contributes no
> production invariant until separately reviewed.

## Supply and mining

```text
GBX constructor supply = 0
GBX constructor lifetimeMinted = 0
genesisAmount = genesisLiquidityMinted ? 1,000 ether : 0
lifetimeMinted = Mine.totalMined + genesisAmount
totalSupply = lifetimeMinted - lifetimeBurned
aggregateTps = sum_slots(slot.tps)
pendingEmission = storedPendingEmission + (now - pendingUpdatedAt) * aggregateTps
pendingEmission = sum_slots((now - lastAccruedAt) * slot.tps)
effectiveTotalSupply = totalSupply + pendingEmission
```

A zero Mine `genesisAuthority` permanently disables genesis issuance. A nonzero authority may direct only the fixed
`1,000 ether` amount, only once, only to deployed code, and only after GBX has permanently bound that Mine as minter.
Success sets `genesisLiquidityMinted = true` and `genesisAuthority = address(0)` before the GBX call. Transaction rollback
restores all state if the mint fails. The canonical launcher is that authority; after its completed launch,
`Mine.totalMined = 0`, `GBX.lifetimeMinted = 1,000 ether`, and all minted GBX is in the seeded pair.

`slot.tps` is written only when a new tenure begins. It is not rewritten by a time-based halving boundary or a Fund
redemption. On a replacement, only the outgoing slot is settled, then:

```text
newSlot.tps = globalTps(now - startTime) / 16
```

For a positive nonempty-slot payment:

```text
outgoingMinerClaim = floor(price * 8,000 / 10,000)
routerDeposit = price - outgoingMinerClaim
Mine USDG balance = totalClaimableMinerPayments
```

For an empty slot, `routerDeposit = price`; for a zero-price replacement both values are zero. Mine requests these nominal
amounts with `SafeERC20` and trusts canonical USDG's standard movement without sender/receiver balance checks. The
deposit is Mine's terminal revenue action: a later permissionless `ResonanceRouter.route()` call is neither part of nor
a precondition for the replacement.

After every successful `Mine.setResonanceRouter(newRouter)`:

```text
newRouter != previousRouter
newRouter.usdg = Mine.usdg
newRouter.resonance.code.length > 0
newRouter.resonance.usdg = Mine.usdg
newRouter.resonance.fund = Mine.fund
newRouter.resonance.resonanceRouter = newRouter
newRouter.resonance.signalGBX.gbx = Mine.gbx
newRouter.resonance.signalGBX.resonance = newRouter.resonance
```

The setter moves no token and calls no old-graph contract. Previous Router balances, Resonance state, Strategy claims,
Bribe rewards, and signal positions are unchanged by the cutover. These getter identities prove reciprocal structure,
not runtime-code honesty.

## Signals and virtual Bribe balances

```text
sum_strategy Bribe(strategy).signalWeightOf(account) = SignalGBX.balanceOf(account)
sum_strategy Bribe(strategy).totalSignalWeight() = SignalGBX.totalSupply()
GBX.balanceOf(SignalGBX) >= SignalGBX.totalSupply()
sum_account Bribe(strategy).signalWeightOf(account) = Bribe(strategy).totalSignalWeight()
sum_live_strategies Bribe(strategy).totalSignalWeight() = Resonance.totalSignalWeight()
```

Every successful scalar or batched addition requests a GBX deposit, mints the same nominal SignalGBX amount, and
creates the same Strategy and Bribe positions atomically. Every successful scalar or batched removal removes those
positions, burns the same aggregate SignalGBX amount, and requests the same nominal GBX return atomically. Canonical
GBX transfers use `SafeERC20` without balance-delta enforcement. Excess escrow GBX is unsolicited surplus and creates
no receipt, signal, or withdrawal entitlement.
A killed Strategy's paired-Bribe `totalSignalWeight` remains, but its balance is excluded from Resonance's active
`totalSignalWeight` and remains removable.

SignalGBX is the only caller accepted by Resonance's `addSignalFor` and `removeSignalFor`. Resonance has no dedicated
move hook, and SignalGBX has no public move or shared write-through Router. SignalGBX balance owns the aggregate
signal; the paired Bribe owns
account-by-Strategy and per-Strategy balances; Resonance owns only the active live-Strategy total. A separate
`allocatedBalance`, standalone stake/unstake state, or intermediate idle receipt is forbidden.

Before the first Strategy is registered, `liveStrategyCount = 0` and new signal is impossible. After registration:

```text
liveStrategyCount >= 1
liveStrategyCount = sum_strategy(isStrategyLive(strategy) ? 1 : 0)
```

Killing the final live Strategy reverts. Adding a replacement before killing the old Strategy preserves the invariant;
whether an external governance system can batch those calls atomically remains an unselected integration property.

## Governance authority

```text
in-repository Governor = none
in-repository Timelock = none
SignalGBX IVotes clock = blocknumber
continuing Resonance owner calls = {
  Resonance.addStrategy,
  Resonance.killStrategy,
  Resonance.addBribeRewardToken,
  Resonance.setBribeBps
}
setup-only Resonance owner calls = {
  Resonance.setResonanceRouter (consumed exactly once before handoff)
}
continuing Mine owner calls = {
  Mine.setResonanceRouter
}
inherited Mine and Resonance owner calls = {
  transferOwnership (including replacement or address(0) cancellation of pending owner),
  acceptOwnership,
  renounceOwnership
}
setup-only plain Ownable shells = {SignalGBX, StrategyFactory, BribeFactory}
continuing launcher or component-deployer callable authority = none
```

SignalGBX retains non-transferable ERC20Votes checkpoints, but the core assigns them no proposal threshold, quorum,
voting period, permission, batching, delay, cancellation, or execution semantics. The external Mine/Resonance owner
remains unselected; deployment is blocked until a later ADR pins and reviews that integration and both ownership
handoffs. At the canonical launch boundary, SignalGBX, StrategyFactory, and BribeFactory owners are `address(0)`, Mine
and Resonance owners are the launcher, both pending owners are the passed deployed governance contract, and Mine's
genesis authority is zero. After acceptance, both owners are governance and both pending owners are zero. The
single-use launcher and component deployers expose no post-launch callable path over the canonical graph.
The launcher therefore cannot replace or cancel its pending Mine or Resonance transfers after `launch` returns, even
though a normally callable current owner may do so before acceptance.
`setBribeBps` is globally bounded and satisfies:

```text
BPS = 10,000
DEFAULT_BRIBE_BPS = 1,000
0 <= bribeBps <= MAX_BRIBE_BPS = 2,000
fundBps = BPS - bribeBps
```

## Resonance USDG solvency and surplus

Resonance intentionally uses a solvency inequality rather than exact carried accounting. Across every registered
Strategy at one block:

```text
scheduledRevenue = remainingRevenue()
previewedStrategyLiability = sum(earnedRevenue(strategy))
USDG.balanceOf(Resonance)
  = scheduledRevenue + previewedStrategyLiability + surplus
surplus >= 0
```

`surplus` includes global-index and per-Strategy floors, emission elapsed while active signal weight was zero, and USDG
sent directly without a Router notification. It is neither a Strategy nor Fund liability and there is no synchronization,
recovery, or later-allocation path. Strategy payouts reduce both the token balance and the matching whole revenue.

For every active stream:

```text
periodFinish - mostRecentQualifyingNotification = 7 days
baseRateRaw = floor(scheduledRaw / 7 days)
rateRemainderRaw = scheduledRaw mod 7 days
releasedRaw(first x active seconds)
  = x * baseRateRaw
releasedRaw(7 days) = scheduledRaw - rateRemainderRaw
```

ResonanceRouter forwards only when its complete balance is at least
`max(REWARD_DURATION, remainingRevenue())`; otherwise `route` returns zero. Resonance checkpoints elapsed emission and
restarts a seven-day schedule at
`floor((routerBalance + remainingRevenueBeforeNotification) / REWARD_DURATION)`. The division remainder remains
surplus.

For positive active signal weight, elapsed raw emission advances the global revenue-per-signal index by
`floor(emittedRaw * P / totalSignalWeight)`. Strategy checkpointing accrues
`floor(strategyWeight * indexDelta / P)`. Neither floor retains a remainder. At zero active supply the index is unchanged
while stream time advances, so that elapsed emission enters `surplus`.

For Resonance precision `P = 1e36`, lifetime admission satisfies:

```text
0 <= lifetimeRevenueNotified <= floor(type(uint256).max / P)
revenuePerSignal <= lifetimeRevenueNotified * P <= type(uint256).max
```

Fresh revenue beyond the remaining headroom reverts before checkpointing or USDG interaction. Direct donations never
enter the schedule, and rolled-over remaining revenue was already counted by its original fresh notification. Claims,
distribution, stream completion, and signal changes never reduce the monotonic counter.

Elapsed revenue is checkpointed before a signal weight changes. `Strategy.buy` checkpoints and transfers its released
allocation before it snapshots auction inventory. In one block, newly notified revenue has zero elapsed stream time.

Killing a live Strategy checkpoints its whole accrued revenue, preserves that claim, and subtracts its complete recorded
weight from active `totalSignalWeight`. The recorded account, Strategy, and Bribe balances remain. Later removals reduce
those three balances but do not subtract the already excluded weight from active `totalSignalWeight`; additions are
forbidden. The transition also decrements `liveStrategyCount` and reverts if the Strategy is the final live one.

## Bribe reward-token conservation

For Bribe precision `P = 1e36`, every token in every Bribe satisfies:

```text
0 <= lifetimeRewardNotified[token] <= floor(type(uint256).max / P)
previewedRewardPerSignal[token] <= lifetimeRewardNotified[token] * P <= type(uint256).max
```

Every accepted notification adds its raw amount to `lifetimeRewardNotified`; claims and later
balance changes never decrease it. Direct donations do not count because Bribe never indexes them. An over-cap amount
reverts before reward checkpointing or token transfer, so the rejection cannot mutate a stream or gate a signal exit.

```text
scheduledReward[token] = remainingReward(token)
previewedAccountRewards[token] = sum_account earned(account, token)
ERC20(token).balanceOf(Bribe)
  = scheduledReward[token] + previewedAccountRewards[token] + surplus[token]
surplus[token] >= 0
```

Notifications must satisfy `amount >= REWARD_DURATION` and `amount >= remainingReward(token)`. A valid notification checkpoints
the current index, pulls the standard token, and sets
`rewardRate = floor((amount + remainingRewardBeforeNotification) / REWARD_DURATION)`. Stream time continues at zero
signal weight.
Rate, global-index, and account floors remain surplus; there are no queue, pause, carry, or Fund-reward buckets.

For either direct Bribe claim selector:

```text
authorized claim caller = beneficiary || Bribe.resonance()
reward receiver = beneficiary
```

An unauthorized call reverts before the beneficiary's checkpoint or entitlement changes. Resonance's cross-Bribe
batch fixes the beneficiary to the external `msg.sender`, accepts only registered Strategy keys, and resolves each
canonical paired Bribe from `bribeFor`. Registered killed Strategies remain valid claim targets. The caller-controlled
batch is atomic and may exceed practical gas or encounter one broken token, so it is never the sole realization path.
All-token claims are atomic across the registered set. Direct scalar claims touch only one token and therefore preserve
claim liveness when another registered token fails.

## Strategy settlement and BribeRouter buffering

```text
BPS = 10,000
0 <= appliedBribeBps <= 2,000
bribeAmount = floor(strategyPayment * appliedBribeBps / BPS)
fundAmount = strategyPayment - bribeAmount
strategyPayment = fundAmount + bribeAmount
```

Strategy snapshots `appliedBribeBps` before payment-token interaction, pulls the payment, transfers `fundAmount`
directly to Fund, and transfers nonzero `bribeAmount` to BribeRouter. There is no split carry or deferred Fund
liability; different payment partitions may differ by sub-token flooring. A failed Fund transfer reverts the purchase.

BribeRouter's complete compatible-token balance is the next candidate notification, including direct donations. Its
`route` operation returns zero until that balance is at least both `REWARD_DURATION` and the Bribe's `remainingReward`
amount.
A failed notification reverts without moving the balance; a successful notification leaves the Router empty.

Signal and exit liveness is independent of `bribeBps`: `addSignal`, `addSignalMany`, `removeSignal`, and
`removeSignalMany` do not require a new automatic liability or settlement of an acquired payment token. This remains
true at 0% and for killed-Strategy exits.

## Fund and genesis liquidity

Fund first reads Mine's effective supply, then every selected payout uses the same effective pre-burn supply and raw
balance:

```text
effectiveSupplyBeforeBurn = GBX.totalSupply() + Mine.pendingEmission()
payout(token) = floor(balanceBefore(token) * gbxAmount / effectiveSupplyBeforeBurn)
```

The GBX burn and every selected transfer are atomic. Every successful redemption also satisfies:

```text
finalBalance(token) >= balanceBefore(token) - payout(token)
```

This basket-wide postcondition prevents distinct selected token addresses backed by one shared ledger from consuming
the same backing twice.

The canonical launch is one authorized, single-use transaction on Robinhood Chain mainnet. Four predeployed stateless
component deployers have no owner or retained authority and only divide the constructor graph for runtime-size reasons.
The transaction either deploys, binds, seeds, registers, cleans up setup ownership, begins both two-step handoffs, and
validates the complete graph, or it reverts all graph contracts, Pair creation, token movement, authority changes, and
events. Governance acceptance of Mine and Resonance is a separate post-launch release gate.

For every component output domain:

```text
create2Salt(caller, domain) = keccak256(abi.encode(caller, domain))
create2Salt(callerA, domain) != create2Salt(callerB, domain), where callerA != callerB
```

The public modules therefore do not expose a shared salt that another account can consume or use to shift the
launcher's canonical outputs. Constructor arguments remain part of the CREATE2 initcode hash as usual.

Predictability must not make a plain USDG transfer a launch veto. At successful completion:

```text
USDG.balanceOf(launcher) = 0
launcherPrefundedUSDG is included in USDG.balanceOf(Fund)
Resonance.lifetimeRevenueNotified = 0
```

USDG already held at the future ResonanceRouter remains an ordinary unscheduled buffer. USDG already held at the
future Resonance address remains direct-donation surplus. Neither balance alone changes schedule accounting or rejects
the launch. These exceptions do not extend to the Pair.

Before genesis, the launcher calls the pinned Factory's `createPair(GBX, USDG)` unconditionally. The returned Pair must
satisfy:

```text
Factory.getPair(GBX, USDG) = pair
pair.factory = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f
{pair.token0, pair.token1} = {GBX, USDG}
```

The launcher never adopts or skims an existing Pair. If the Factory already maps this launcher's deterministic GBX and
USDG to a Pair, the launcher reverts with `PairAlreadyExists`. The unused launcher can be abandoned and a fresh
launcher deployed; because module CREATE2 salts are scoped to their direct caller, the fresh launcher produces a
different GBX and therefore a different Pair. USDG sent to the not-yet-created deterministic Pair leaves the Factory
lookup zero and instead reverts at `PAIR_USDG_DEPOSIT` after Pair creation. That candidate is rejected rather than
cleaned up in place.

For six-decimal USDG and eighteen-decimal GBX, successful genesis satisfies:

```text
USDG deposited = 1,000,000 raw = 1 USDG
GBX deposited = 1,000 ether
total LP supply = floor(sqrt(1e6 * 1,000e18)) = 31,622,776,601,683 raw
provider liquidity = total LP supply - 1,000 = 31,622,776,600,683 raw
LP.balanceOf(address(0)) = total LP supply
LP.balanceOf(launcher) = 0
```

All genesis LP is therefore permanently locked. The launcher then registers exactly two live Strategies:

```text
GBX initialPrice = GBX minimumPrice = 100,000 ether
LP initialPrice = LP minimumPrice = 50 * pair.totalSupply() = 1,581,138,830,084,150 raw
epochDuration = 24 hours
priceMultiplier = 1.2e18
```

The initial epoch begins at Strategy deployment. `minimumPrice` controls the next epoch's start and is not a current
fill floor, so first inventory arriving after the complete 24-hour decay may be acquired for zero payment.

Only genesis LP is locked. LP minted later obeys the same Strategy split and Fund redemption rules as every other
payment token; LP held by Fund remains caller-selectable in redemption. No continuing core invariant depends on pool
price, fees, or liquidity availability because the continuing core performs no liquidity operation or management.
