# `@gumball-6900/sdk`

Typed ABIs, transaction builders, canonical-block readers, validation, and independent math helpers for the GUM BALL
6900 development core.

The generated ABI set covers `GBXLauncher`, `GBX`, `Mine`, `SignalGBX`, `ResonanceRouter`, `Resonance`, both factories,
`Strategy`, `BribeRouter`, `Bribe`, `Fund`, and the optional stateless `SignalPortfolioLens`.

```ts
import {
  planAddSignals,
  buildClaimMiningPayment,
  buildMine,
  buildRedemption,
  buildStrategyBuy,
  readMineSlotView,
  readResonanceView,
  readRedemptionPreview,
  readSignalPortfolio,
  readSupplyView,
} from '@gumball-6900/sdk';

const supply = await readSupplyView(publicClient, gbx);
const slot = await readMineSlotView(publicClient, mine, 0n, beneficiary);
const resonanceState = await readResonanceView(publicClient, resonance);
const occupy = buildMine({
  mine,
  beneficiary,
  slotIndex: 0n,
  expectedEpochId: slot.epochId,
  deadline,
  maximumPrice,
  message: 'hello from the mine',
});
const claim = buildClaimMiningPayment(mine, outgoingMiner);
const signalPlan = planAddSignals({
  gbx,
  signalGBX,
  currentAllowance,
  allocations: [
    { strategy: strategyA, amount: 600n * 10n ** 18n },
    { strategy: strategyB, amount: 400n * 10n ** 18n },
  ],
});
// A smart account may submit signalPlan.accountCalls atomically. Every signaling write targets SignalGBX directly;
// signalPlan.scalarTransactions remains available if the native batch is unsuitable.
const portfolio = await readSignalPortfolio(
  publicClient,
  signalPortfolioLens,
  { signalGBX, resonance },
  account,
  strategyAddresses,
);
const redemptionPreview = await readRedemptionPreview(publicClient, { fund, mine }, gbxAmount, selectedTokens);
const redemption = buildRedemption(fund, gbxAmount, receiver, selectedTokens);
const purchase = buildStrategyBuy({ strategy, revenueReceiver: receiver, expectedEpochId, deadline, maximumPayment });
```

`quoteMiningAccrual` accepts explicit per-slot TPS values because occupied rates are tenure-locked. `miningRateAt`
computes the global TPS from elapsed Mine deployment time that a future replacement will divide by sixteen; it must
not be used to reprice an occupied tenure. A replacement executing across a halving boundary receives the new lower
TPS. When a quoted
TPS must remain valid, set the `buildMine` deadline strictly before `slot.nextHalvingBoundary`. The composed Mine read
derives that value from onchain `startTime`, `HALVING_PERIOD`, and its pinned block timestamp; it is `null` once the
permanent tail has begun. Do not derive this deadline from the caller's wall clock.

Development API migration: `miningRateAt` now interprets its first `bigint` as elapsed seconds since Mine deployment,
not cumulative raw GBX, and `MiningCurveConfig.halvingAmount` was replaced by `halvingPeriod`. Old calls can still
typecheck because both values are `bigint`, so consumers must update semantics rather than rely on the compiler to flag
the change. No production deployment or compatibility shim exists.

Every composed reader pins its RPC calls to one block and revalidates that block before returning. Generated ABIs and
API docs are updated by repository scripts and must not be edited by hand.

`readResonanceView` includes `rewardDuration`, `remainingRevenue`, `revenuePerSignalStored`, the `1e36`
`rewardPrecision` revenue-index scale, total live signal weight, the bound Router and USDG, the scalar Synthetix
schedule, and Resonance's actual USDG balance. Arithmetic floors, zero-active-signal intervals, and direct donations
may make the token balance exceed scheduled and claimable revenue. `readStrategyView.availableRevenue` is an SDK
derived field that reads the Strategy's USDG `balanceOf` directly; it omits
released-but-not-yet-transferred stream revenue.

Resonance's USDG accounting uses revenue-specific names: `revenueData`, `revenuePerSignal`,
`strategyRevenuePerSignalPaid`, `strategyRevenue`, and `earnedRevenue`. `addBribeRewardToken` registers another paired
Bribe token. Bribe itself intentionally retains `rewardData`, `rewardPerSignal`, and `earned` because it handles
independently funded rewards rather than Resonance revenue.

SignalGBX is the user-facing signaling and vote-delegation boundary. `buildAddSignal` and `buildAddSignalMany`
atomically deposit GBX, mint the same aggregate sGBX amount, and assign it to one or more live Strategies.
`buildRemoveSignal` and `buildRemoveSignalMany` perform the inverse, including for killed-Strategy exits. The planners
coalesce duplicate Strategy rows, expose the total and current allowance shortfall, prefer scalar calls for one
allocation and native batches for multiple allocations, and retain normalized scalar transactions as a fallback.
There is no write-through router: a smart account may atomically bundle the optional GBX approval with the direct
SignalGBX call, while an EOA may approve separately. Idle SignalGBX is unreachable, and direct receipt transfers are
disabled.

`readSignalPortfolio` uses the optional stateless `SignalPortfolioLens` to return one account summary and a
caller-selected set of current Strategy, signal-weight, Resonance-revenue, and paired-Bribe reward views at one pinned,
revalidated block. The Lens has no Strategy registry and is not an authoritative deployment source. Discover the
Strategy list from indexed `StrategyAdded` events or the subgraph, pass trusted core addresses explicitly, and chunk
large portfolios when an RPC's gas or response-size limits require it.
`protocolPeripheryAddressesSchema` validates its replaceable address separately rather than treating it as part of the
fixed core deployment graph.

`parseProtocolDeployment` validates caller-supplied deployment syntax only. Its `claimedStatus` and
`manifestPayloadHash` fields are unauthenticated metadata, and `selectProtocolDeployment` filters only on that claimed
label. Neither function proves a signature, bytecode, immutable binding, ownership state, or live graph. Production
consumers must use separately verified signed-manifest evidence before constructing approvals or protocol calls.

`buildRouteRevenue` leaves a Router balance below `max(REWARD_DURATION, remainingRevenue())` in the Router; a qualifying
complete balance restarts seven days with ordinary Synthetix leftover rollover. `buildRouteBribeRewards` performs the
matching full-balance route for a paired BribeRouter. `buildClaimBribeRewards` claims every registered reward from the
canonical Bribe paired with each caller-selected Strategy through Resonance; the submitting wallet is always the
beneficiary, and callers should split arrays that do not fit available gas. `buildClaimAllBribeRewards` and
`buildClaimBribeReward` remain direct one-Bribe fallbacks, and their `account` argument must be the submitting wallet.
The scalar-token builder isolates a healthy reward from a broken token that would revert an all-token claim.

The SDK intentionally includes no governance proposal builders or readers. SignalGBX exposes ERC20Votes checkpoints,
but the external governance system that will own Resonance has not been selected. Provider-specific actions and views
will be added only after an exact integration and release are reviewed.
