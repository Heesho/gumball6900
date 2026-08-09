# Core invariants

- `GBX.lifetimeMinted() <= 1_000_000_000 ether`, including tokens later burned.
- Burns never increase remaining mint capacity.
- Exactly 20 million GBX is minted at construction; no later mint is possible until authority is permanently handed
  to a different minter, intended to be Fundraiser.
- Fundraiser settlement is sequential. Every ended epoch applies exactly one floor-rounded daily decay step; an empty
  epoch allocates zero and carries nothing forward.
- Fundraiser routes the exact contributed USDG amount or reverts the contribution atomically.
- SignalGBX supply is backed one-for-one by GBX held in SignalGBX.
- SignalGBX cannot be transferred; an account may unstake exactly the portion not currently allocated to Strategies.
- Signals are absolute per-Strategy amounts changed by deltas. Their account sum equals `accountSignalWeight`, which
  never exceeds the account's current SignalGBX balance.
- Account signal weights and Strategy signal weights each sum exactly to `totalSignalWeight`.
- Each Bribe account balance mirrors its Strategy signal, and each Bribe supply mirrors its Strategy's total weight.
- A zero signal is removed from `accountStrategies` without leaving a duplicate or stale swap-and-pop index.
- A Bribe has at most eight registered reward tokens.
- Only Resonance can deploy through StrategyFactory or BribeFactory and maintain Bribe virtual balances.
- Acquisition Bribe share never exceeds 50%; buybacks burn 100% of their GBX payment.
- Fund redemption uses one pre-burn supply snapshot for every selected token and is atomic with the GBX burn.
- Redemption rejects GBX, zero addresses, and duplicate token entries.
- Fund is ownerless: redemption is the only path by which any asset can ever leave it.
- LiquidityPosition accepts only its exact precommitted nonempty v4 NFT, canonical hookless pool, and tick range.
- LiquidityPosition liquidity is monotonically non-decreasing: compounding adds exactly 0.20% and never removes
  principal, and the contract retains no token balance after a compound.
- LiquidityPosition is ownerless: once accepted, the canonical NFT can never leave the contract.
