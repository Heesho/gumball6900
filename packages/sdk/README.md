# `@gumball-6900/sdk`

Typed ABIs, transaction builders, canonical-block readers, validation, and independent math helpers for the GUM BALL
6900 development core.

The generated ABI set covers `GBX`, `Mine`, `SignalGBX`, `ResonanceRouter`, `Resonance`, both factories, `Strategy`,
`BribeRouter`, `Bribe`, and `Fund`.

```ts
import {
  buildClaimMiningPayment,
  buildMine,
  buildRedemption,
  buildSignal,
  buildSignalWithPermit,
  buildStrategyBuy,
  readMineSlotView,
  readResonanceView,
  readRedemptionPreview,
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
const claim = buildClaimMiningPayment(mine, displacedMiner);
const signal = buildSignal(signalGBX, strategy, 1_000n * 10n ** 18n);
const signalWithPermit = buildSignalWithPermit({
  signalGBX,
  strategy,
  amount,
  deadline,
  v,
  r,
  s,
}); // Uses the underlying GBX permit; SignalGBX itself has no ERC-20 Permit.
const redemptionPreview = await readRedemptionPreview(publicClient, { fund, mine }, gbxAmount, selectedTokens);
const redemption = buildRedemption(fund, gbxAmount, receiver, selectedTokens);
const purchase = buildStrategyBuy({ strategy, revenueReceiver: receiver, expectedEpochId, deadline, maximumPayment });
```

`quoteMiningAccrual` accepts explicit per-slot TPS values because occupied rates are tenure-locked. `miningRateAt`
computes the global TPS from elapsed Mine deployment time that a future handoff will divide by sixteen; it must not be
used to reprice an incumbent. A handoff executing across a halving boundary receives the new lower TPS. When a quoted
TPS must remain valid, set the `buildMine` deadline strictly before `slot.nextHalvingBoundary`. The composed Mine read
derives that value from onchain `startTime`, `HALVING_PERIOD`, and its pinned block timestamp; it is `null` once the
permanent tail has begun. Do not derive this deadline from the caller's wall clock.

Development API migration: `miningRateAt` now interprets its first `bigint` as elapsed seconds since Mine deployment,
not cumulative raw GBX, and `MiningCurveConfig.halvingAmount` was replaced by `halvingPeriod`. Old calls can still
typecheck because both values are `bigint`, so consumers must update semantics rather than rely on the compiler to flag
the change. No production deployment or compatibility shim exists.

Every composed reader pins its RPC calls to one block and revalidates that block before returning. Generated ABIs and
API docs are updated by repository scripts and must not be edited by hand.

`readResonanceView` includes `rewardDuration`, `remainingRevenue`, `revenuePerSignalStored`, `1e36` reward precision,
live signal weight, the bound Router and USDG, the scalar Synthetix schedule, and Resonance's actual USDG balance. Arithmetic
floors, zero-active-signal intervals, and direct donations may make the token balance exceed scheduled and claimable
revenue. `readStrategyView.availableRevenue` reads the Strategy's USDG `balanceOf` directly; it omits
released-but-not-yet-transferred stream revenue.

Resonance's USDG accounting uses revenue-specific names: `revenueData`, `revenuePerSignal`,
`strategyRevenuePerSignalPaid`, `strategyRevenue`, and `earnedRevenue`. `addBribeRewardToken` registers another paired
Bribe token. Bribe itself intentionally retains `rewardData`, `rewardPerSignal`, and `earned` because it handles
independently funded rewards rather than Resonance revenue.

SignalGBX is the user-facing signaling and vote-delegation boundary. `buildSignal` atomically deposits GBX, mints the
same sGBX amount, and assigns it to one live Strategy; `buildSignalWithPermit` does the same using underlying GBX
permit. `buildMoveSignal` reallocates existing signal, and `buildWithdrawSignal` atomically removes signal, burns sGBX,
and returns GBX. Idle SignalGBX is unreachable, and direct SignalGBX transfers are disabled.

`buildRouteRevenue` leaves a Router balance below `max(REWARD_DURATION, remainingRevenue())` in the Router; a qualifying
complete balance restarts seven days with ordinary Synthetix leftover rollover. `buildRouteBribeRewards` performs the
matching full-balance route for a paired BribeRouter, and
`buildClaimAllBribeRewards` complements the scalar-token claim builder.

The SDK intentionally includes no governance proposal builders or readers. SignalGBX exposes ERC20Votes checkpoints,
but the external governance system that will own Resonance has not been selected. Provider-specific actions and views
will be added only after an exact integration and release are reviewed.
