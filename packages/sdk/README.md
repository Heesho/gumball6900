# `@gumball-6900/sdk`

Typed ABIs, transaction builders, canonical-block readers, validation, and independent Uniswap pool-key helpers for the
GUM BALL 6900 development core.

The generated ABI set covers `GBX`, `Fundraiser`, `LiquidityPosition`, `SignalGBX`, `ResonanceRouter`, `Resonance`,
`StrategyFactory`, `Strategy`, `BribeFactory`, `BribeRouter`, `Bribe`, `Fund`, and OpenZeppelin `TimelockController`. Strategies, Bribes, and
BribeRouters are discovered through Resonance rather than stored as fixed deployment addresses.

```ts
import {
  buildContribution,
  buildAddSignal,
  buildAddSignalMany,
  buildCompoundLiquidity,
  buildRemoveSignal,
  buildRemoveSignalMany,
  buildRedemption,
  buildStrategyBuy,
  buildSettleFundraiserEpochs,
  readRedemptionPreview,
  readSupplyView,
  readResonanceView,
} from '@gumball-6900/sdk';

const supply = await readSupplyView(publicClient, gbx);
const resonance = await readResonanceView(publicClient, resonanceAddress);
const preview = await readRedemptionPreview(publicClient, { fund, gbx }, amount, selectedTokens);

const addSignal = buildAddSignal(resonanceAddress, strategyAddress, 1_000n * 10n ** 18n);
const addSignals = buildAddSignalMany(resonanceAddress, strategyAddresses, absoluteAmounts);
const removeSignal = buildRemoveSignal(resonanceAddress, strategyAddress, 250n * 10n ** 18n);
const removeSignals = buildRemoveSignalMany(resonanceAddress, strategyAddresses, amountsToRemove);
const contribution = buildContribution(fundraiser, beneficiary, usdGAmount);
const settlement = buildSettleFundraiserEpochs(fundraiser, 30n);
const compound = buildCompoundLiquidity(liquidityPosition, amount0Max, amount1Max, deadline);
const redemption = buildRedemption(fund, gbxAmount, receiver, selectedTokens);
const purchase = buildStrategyBuy({
  strategy,
  revenueReceiver: receiver,
  expectedEpochId,
  deadline,
  maximumPayment,
});
```

Every composed reader pins its RPC calls to one block and revalidates that block before returning. Generated ABIs are
updated with `pnpm sdk:abi:generate` and must not be edited by hand.
