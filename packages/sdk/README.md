# `@gumball-6900/sdk`

Typed ABIs, transaction builders, canonical-block readers, validation, and independent Uniswap pool-key helpers for the
GUM BALL 6900 development core.

The generated ABI set covers `GBX`, `Fundraiser`, `LiquidityPosition`, `SignalGBX`, `ResonanceRouter`, `Resonance`,
`StrategyFactory`, `Strategy`, `BribeFactory`, `BribeRouter`, `Bribe`, `Fund`, and OpenZeppelin `TimelockController`. Strategies, Bribes, and
BribeRouters are discovered through Resonance rather than stored as fixed deployment addresses.

```ts
import {
  buildContribution,
  buildCollectLiquidityFees,
  buildRedemption,
  buildStrategyBuy,
  buildSignal,
  buildSettleFundraiserEpochs,
  readRedemptionPreview,
  readSupplyView,
  readResonanceView,
} from '@gumball-6900/sdk';

const supply = await readSupplyView(publicClient, gbx);
const resonance = await readResonanceView(publicClient, resonanceAddress);
const preview = await readRedemptionPreview(publicClient, { fund, gbx }, amount, selectedTokens);

const signal = buildSignal(resonanceAddress, strategyAddresses, relativeWeights);
const contribution = buildContribution(fundraiser, beneficiary, usdGAmount);
const settlement = buildSettleFundraiserEpochs(fundraiser, 30n);
const feeCollection = buildCollectLiquidityFees(liquidityPosition);
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
