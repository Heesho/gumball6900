# Core invariants

- `GBX.lifetimeMinted() <= 1_000_000_000 ether`, including tokens later burned.
- Burns never increase remaining mint capacity.
- Exactly 20 million GBX is minted at construction; no later mint is possible until authority is permanently handed
  to a different minter, intended to be Fundraiser.
- Fundraiser settlement is sequential. Every ended epoch applies exactly one floor-rounded daily decay step; an empty
  epoch allocates zero and carries nothing forward.
- Fundraiser routes the exact contributed USDG amount or reverts the contribution atomically.
- SignalGBX supply is backed one-for-one by GBX held in SignalGBX.
- SignalGBX cannot be transferred; an account cannot unstake while it has active signal weight.
- A signal allocation may be replaced or reset at any time and never exceeds the account's current SignalGBX balance.
- Only Resonance can deploy through StrategyFactory or BribeFactory and maintain Bribe virtual balances.
- Acquisition Bribe share never exceeds 50%; buybacks burn 100% of their GBX payment.
- Fund redemption uses one pre-burn supply snapshot for every selected token and is atomic with the GBX burn.
- Redemption rejects GBX, zero addresses, and duplicate token entries.
- Fund is ownerless: redemption is the only path by which any asset can ever leave it.
- LiquidityPosition accepts only its exact precommitted nonempty v4 NFT, canonical hookless pool, and tick range.
- LiquidityPosition liquidity is monotonically non-decreasing: compounding adds exactly 0.20% and never removes
  principal, and the contract retains no token balance after a compound.
- LiquidityPosition is ownerless: once accepted, the canonical NFT can never leave the contract.
