# `@gumball-6900/sdk`

Typed ABIs, transaction builders, canonical-block readers, validation, and independent math helpers for the GUM BALL
6900 development core.

The generated ABI set covers `GBX`, `Mine`, `LiquidityPosition`, `SignalGBX`, `ResonanceRouter`, `Resonance`, both
factories, `Strategy`, `BribeRouter`, `Bribe`, and `Fund`.

```ts
import {
  buildClaimMiningPayment,
  buildHarvestLiquidityFees,
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
const harvest = buildHarvestLiquidityFees(liquidityPosition);
const redemption = buildRedemption(fund, gbxAmount, receiver, selectedTokens);
const purchase = buildStrategyBuy({ strategy, revenueReceiver: receiver, expectedEpochId, deadline, maximumPayment });
```

`quoteMiningAccrual` accepts explicit per-slot TPS values because occupied rates are tenure-locked. `miningRateAt`
computes the global TPS that a future handoff will divide by sixteen; it must not be used to reprice an incumbent.

Every composed reader pins its RPC calls to one block and revalidates that block before returning. Generated ABIs and
API docs are updated by repository scripts and must not be edited by hand.

`readResonanceView` includes the seven-day duration, `1e36` reward precision, live signal weight, bound Router and USDG,
raw quotient-plus-front-loaded-remainder schedule, exact amount left, and Resonance's actual USDG balance. Arithmetic
floors, zero-active-signal intervals, and direct donations may make the token balance exceed scheduled and claimable
revenue. Strategy raw balances alone omit released-but-not-yet-transferred stream revenue.

SignalGBX is the user-facing signaling and vote-delegation boundary. `buildSignal` atomically deposits GBX, mints the
same sGBX amount, and assigns it to one live Strategy; `buildSignalWithPermit` does the same using underlying GBX
permit. `buildMoveSignal` reallocates existing signal, and `buildWithdrawSignal` atomically removes signal, burns sGBX,
and returns GBX. Idle SignalGBX is unreachable, and direct SignalGBX transfers are disabled.

`buildRouteRevenue` leaves a Router balance below the active amount left in the Router; a qualifying complete balance
restarts seven days with `reward + left`. `buildNotifyRevenue` encodes that Router-only call.

The SDK intentionally includes no governance proposal builders or readers. SignalGBX exposes ERC20Votes checkpoints,
but the external governance system that will own Resonance has not been selected. Provider-specific actions and views
will be added only after an exact integration and release are reviewed.
