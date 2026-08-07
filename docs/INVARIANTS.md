# Core invariants

- `GBX.lifetimeMinted() <= 1_000_000_000 ether`, including tokens later burned.
- Burns never increase remaining mint capacity.
- Exactly 20 million GBX is minted at construction; no later mint is possible until authority is permanently handed
  to a different minter, intended to be Fundraiser.
- Fundraiser settlement is sequential. Every ended epoch applies exactly one floor-rounded daily decay step; an empty
  epoch allocates zero and carries nothing forward.
- Fundraiser routes the exact contributed USDG amount or reverts the contribution atomically.
- SignalGBX supply is backed one-for-one by GBX held in SignalGBX.
- SignalGBX cannot be transferred; an account cannot unstake while it has active Voter weight.
- A Voter allocation may be replaced or reset at any time and never exceeds the account's current SignalGBX balance.
- Only Voter can deploy through StrategyFactory or BribeFactory and maintain Bribe virtual balances.
- Acquisition Bribe share never exceeds 50%; buybacks burn 100% of their GBX payment.
- Fund redemption uses one pre-burn supply snapshot for every selected token and is atomic with the GBX burn.
- Redemption and migration reject GBX, zero addresses, and duplicate token entries.
- A Fund successor is same-GBX, one-time, and receives only complete selected balances.
- LiquidityPosition accepts only its exact precommitted nonempty v4 NFT, canonical hookless pool, and tick range.
- LiquidityPosition fee collection removes zero liquidity, burns its complete GBX balance, and routes its complete
  USDG balance atomically.
- A LiquidityPosition successor is configuration-identical, one-time, and receives only the exact canonical NFT.
