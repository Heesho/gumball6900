# `@gumball-6900/sdk`

Typed ABIs, transaction builders, canonical-block readers, validation, and independent math helpers for the GUM BALL
6900 development core.

The generated ABI set covers `GBX`, `Mine`, `LiquidityPosition`, `SignalGBX`, `ResonanceRouter`, `Resonance`, both
factories, `Strategy`, `BribeRouter`, `Bribe`, `Fund`, and OpenZeppelin `TimelockController`.

```ts
import {
  buildAddSignal,
  buildCheckpointMining,
  buildClaimMiningPayment,
  buildHarvestLiquidityFees,
  buildIncreaseMiningCapacity,
  buildMine,
  buildRedemption,
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
const checkpoint = buildCheckpointMining(mine);
const claim = buildClaimMiningPayment(mine, displacedMiner);
const expand = buildIncreaseMiningCapacity(mine, 3n);
const signal = buildAddSignal(resonance, strategy, 1_000n * 10n ** 18n);
const harvest = buildHarvestLiquidityFees(liquidityPosition);
const redemption = buildRedemption(fund, gbxAmount, receiver, selectedTokens);
const purchase = buildStrategyBuy({ strategy, revenueReceiver: receiver, expectedEpochId, deadline, maximumPayment });
```

`quoteMiningAccrual` accepts explicit per-slot rates because occupied rates are tenure-locked. `miningRateAt` computes
the global rate that a future handoff will divide by current capacity; it must not be used to reprice an incumbent.

Every composed reader pins its RPC calls to one block and revalidates that block before returning. Generated ABIs and
API docs are updated by repository scripts and must not be edited by hand.

`readResonanceView` includes the `1e36` index precision, active scaled rate and remainder schedule, aggregate successor,
Fund carry remainder, finish, last checkpoint, and currently releasable amount. Strategy raw balances alone omit
released-but-not-yet-transferred stream revenue. `buildRouteRevenue` forwards every nonzero complete router balance.
