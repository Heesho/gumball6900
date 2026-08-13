# Independent adversarial specification

Date: 2026-08-12

This is the review target for the ADR 0024 and ADR 0025 development candidate. It is not an independent audit result.

## Authority model

- Deployments are direct and non-upgradeable. Fund and LiquidityPosition are ownerless.
- TimelockController owns Resonance and Mine.
- Resonance may add/kill Strategies and register Bribe rewards. Mine ownership may only increase capacity.
- No authority can reduce capacity, reprice an occupied slot, replace the GBX minter, set emissions, migrate, pause,
  rescue, sweep, move Fund assets, or withdraw the liquidity NFT.

## GBX and Mine

- GBX mints `20_000_000 ether` at construction, then permanently binds its only issuer to one deployed Mine.
- Supply reconciles as `lifetimeMinted - lifetimeBurned` and has no protocol-defined economic maximum; inherited
  ERC20Votes accounting retains its `uint208` safety ceiling.
- Capacity begins at one, only increases, and never exceeds sixteen.
- Each slot price decays linearly to zero over one hour. Epoch ID, deadline, and maximum price protect handoffs.
- A handoff checkpoints every occupied slot. Each receives `elapsed * slot.ups`, and `slot.ups` is never recomputed.
- The incoming tenure receives `globalUps(totalMinedAfterCheckpoint) / currentCapacity`.
- Future-handoff global rates halve at immutable cumulative-mining thresholds and stop falling at a positive tail.
- A nonempty price splits into an 80% displaced-miner pull claim plus a 20% Resonance route. An empty slot routes 100%.
- Exact USDG balance deltas are required. Mine retains only outstanding claims, and claims cannot be redirected.

## Signals, Strategies, and Bribes

- SignalGBX is one-for-one, non-transferable, and immediately withdrawable to the extent unallocated.
- Signals are incremental absolute amounts. Account, Strategy, total, and Bribe virtual-supply identities remain equal.
- Every exact Resonance USDG unit is represented by scheduled stream balance, carry, a Strategy liability, or fixed
  Fund liability.
- Resonance streams revenue globally through rolling seven-day periods at a `1e18`-scaled rate. Signal changes
  checkpoint old weights first, same-transaction notifications release zero new revenue, and ResonanceRouter holds a
  top-up until it is at least 604,800 raw units and exceeds the live whole-unit remainder.
- One uniform Strategy type checkpoints and pulls released revenue before auctioning its complete USDG lot. Its
  complete payment becomes a fixed Fund liability.
- Bribes are independently funded, have at most eight reward tokens, pause at zero supply, and isolate broken-token
  claims from signal exit. A-09 remains the known historical carry-attribution limitation.

## Fund and liquidity

- Fund is registry-free and ownerless. Before redemption it validates and checkpoints the permanent Mine.
- Every selected token uses one post-checkpoint, pre-burn supply and raw balance snapshot. The checkpoint, burn, and
  all exact transfers are atomic. Zero, GBX, and duplicates are rejected with EIP-1153 marks.
- LiquidityPosition permanently holds one exact hookless GBX/USDG v4 NFT. Harvesting removes zero principal, routes
  complete USDG through ResonanceRouter, burns complete GBX through Fund, and reverts on any failure.

## Release properties

- Foundry and Hardhat compile the same Solidity tree; SDK/subgraph ABIs come from current artifacts.
- TypeScript and Python independently assert fixed-tenure expansion, future-handoff halvings, 80/20 payments, the
  no-economic-cap issuance model, checkpointed redemption, scaled streaming, and anti-grief reset thresholds.
- No consumer may display pending Mine accrual as already minted supply or the 80% handoff as guaranteed.
- A green local campaign does not clear independent audit, parameter, monitored testnet, manifest, licensing, or legal
  review gates.
