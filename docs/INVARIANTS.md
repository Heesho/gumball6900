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
- Every accounted Resonance USDG unit is represented by global scaled carry, indexed scaled carry, per-Strategy
  scaled carry, live Strategy liability, or fixed Fund liability. Completed exact payouts reduce both balance and
  liability by the same amount.
- Conservation does not imply historical attribution: pending Resonance and Bribe carry is divided by the signal
  supply present when it becomes indexable. A-09 remains an explicit open property with deterministic PoCs.
- Every accounted Bribe reward-token unit is represented by an active schedule, queue, pending/indexed scaled carry,
  user scaled carry, whole user liability, or fixed Fund liability and carry.
- Bribe stream-rate division remainders emit during the earliest seconds; zero supply pauses rather than consumes
  stream time, and a live stream is never reset by a top-up.
- A zero signal is removed from `accountStrategies` without leaving a duplicate or stale swap-and-pop index.
- A Bribe has at most eight registered reward tokens.
- A broken reward token can block only a claim selecting that token; scalar and caller-selected claims for other
  tokens remain available.
- Signal removal and unstaking never require a USDG, Fund, Strategy-payment-token, or reward-token transfer.
- Only Resonance can deploy through StrategyFactory or BribeFactory and maintain Bribe virtual balances.
- Every nonzero Strategy payment is fully classified as a fixed Fund liability; no auction proceeds queue for Bribe.
- A GBX-priced Strategy does not change GBX supply. GBX is burned only by an explicit later burn from Fund or redemption.
- Fund redemption uses one pre-burn supply snapshot for every selected token and is atomic with the GBX burn.
- Redemption rejects GBX, zero addresses, and duplicate token entries.
- Fund is ownerless: redemption is the only path by which any asset can ever leave it.
- LiquidityPosition accepts only its exact precommitted nonempty v4 NFT, canonical hookless pool, and tick range.
- Every successful LiquidityPosition harvest leaves principal liquidity exactly unchanged, routes its complete USDG
  balance through ResonanceRouter, burns its complete GBX balance through Fund, and retains neither token.
- LiquidityPosition is ownerless: once accepted, the canonical NFT can never leave the contract.
