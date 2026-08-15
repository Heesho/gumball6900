# Independent adversarial specification

Date: 2026-08-15

This is the review target for the ADR 0024, ADR 0027, ADR 0028, ADR 0029, and ADR 0030 development candidate. It is
not an independent audit result.

## Authority model

- Deployments are direct and non-upgradeable. Fund and LiquidityPosition are ownerless.
- TimelockController owns Resonance and Mine. ProtocolGovernor is its sole proposer and accepts only exact zero-value
  calls to add/kill Strategies, register Bribe rewards, or increase Mine capacity.
- SignalGBX votes govern those four calls. The Governor and Timelock are immutable, execution is permissionless after
  the delay, and no public path can cancel an operation after it has been queued.
- No authority can reduce capacity, reprice an occupied slot, replace the GBX minter, set emissions, migrate, pause,
  rescue, sweep, move Fund assets, or withdraw the liquidity NFT.

## GBX and Mine

- GBX mints `20_000_000 ether` at construction, then permanently binds its only issuer to one deployed Mine whose
  reciprocal `gbx()` identity matches.
- Supply reconciles as `lifetimeMinted - lifetimeBurned` and has no protocol-defined economic maximum. GBX retains
  ERC20Permit for approval-based staking but has no voting checkpoints; SignalGBX is the sole protocol vote token.
- Capacity begins at one, only increases, and never exceeds sixteen.
- Each slot price decays linearly to zero over one hour. Epoch ID, deadline, and maximum price protect handoffs.
- A handoff checkpoints every occupied slot. Each receives `elapsed * slot.ups`, and `slot.ups` is never recomputed.
- The incoming tenure receives `globalUps(totalMinedAfterCheckpoint) / currentCapacity`.
- Future-handoff global rates halve at immutable cumulative-mining thresholds and stop falling at a positive tail.
- A nonempty price splits into an 80% displaced-miner pull claim plus a 20% Resonance route. An empty slot routes 100%.
- Exact USDG balance deltas are required. Mine retains only outstanding claims, and claims cannot be redirected.

## Signals, Strategies, and Bribes

- SignalGBX mints and burns one-for-one, is non-transferable, accepts stakes only after reciprocal Resonance binding,
  and is immediately withdrawable to the extent unallocated. Its supply is fully backed; unsolicited GBX is stranded
  surplus rather than receipt issuance. It retains ERC20Votes but not ERC20Permit; the optional
  `stakeAndSignalWithPermit` signature authorizes the underlying GBX transfer only.
- SignalGBX is the sole user-facing signal coordinator. It owns each account's aggregate allocation and supports
  scalar add/remove, live-to-live or killed-to-live moves, stake-and-signal, and remove-and-unstake atomically.
- Each paired Bribe owns account-by-Strategy balances and raw Strategy supply. Resonance owns only the active global
  denominator; compatibility views forward to those canonical ledgers. A killed Strategy is excluded immediately
  while its Bribe balances remain recorded for exit.
- Resonance remains solvent for its scheduled balance and Strategy claims. Per-index and per-Strategy floors,
  zero-active-signal emission, and direct donations are intentionally unclassified surplus rather than Fund
  liabilities.
- Resonance streams revenue through one active seven-day period at `1e36` index precision. Raw USDG rate remainder is
  front-loaded so the complete scheduled amount emits. Signal changes checkpoint old weights first, and
  same-transaction notifications release zero new revenue. A live top-up qualifies only when Router revenue is at
  least the exact active `left`; qualifying revenue restarts seven days with `reward + left`, while smaller balances
  remain in ResonanceRouter for a later permissionless attempt.
- Killing a Strategy checkpoints and preserves its accrued claim, excludes its full weight from future rewards, blocks
  later additions, and leaves incumbent signalers free to exit without decrementing the active total twice.
- One uniform Strategy type checkpoints and pulls released revenue before auctioning its complete USDG lot. Its
  complete payment becomes a fixed Fund liability.
- Bribes are independently funded, have at most eight reward tokens, pause at zero supply, and isolate broken-token
  claims from signal exit. Old-denominator Bribe carry and a fully exiting account's sub-token remainder move to the
  fixed Fund classification before virtual supply changes.

## Fund and liquidity

- Fund is registry-free and ownerless. Before redemption it validates and checkpoints the permanent Mine.
- Every selected token uses one post-checkpoint, pre-burn supply and raw balance snapshot. The checkpoint, burn, and
  all exact transfers are atomic. Zero, GBX, and duplicates are rejected with EIP-1153 marks. A basket-wide final
  balance check rejects distinct selected addresses whose transfers consume the same snapshotted backing.
- LiquidityPosition permanently holds one exact hookless GBX/USDG v4 NFT. Harvesting removes zero principal, routes
  complete USDG through ResonanceRouter, burns complete GBX through Fund, and reverts on any failure.

## Release properties

- Foundry and Hardhat compile the same Solidity tree; SDK/subgraph ABIs come from current artifacts.
- TypeScript and Python independently assert fixed-tenure expansion, future-handoff halvings, 80/20 payments, the
  no-economic-cap issuance model, checkpointed redemption, qualifying Resonance resets and surplus solvency, and
  boundary-carry Fund routing in Bribe.
- Foundry separately proves the four-selector Governor filter, sole-proposer Timelock closure, snapshot quorum,
  coordinator rollback, move semantics, and the accepted absence of queued cancellation.
- No consumer may display pending Mine accrual as already minted supply or the 80% handoff as guaranteed.
- A green local campaign does not clear independent audit, parameter, monitored testnet, manifest, licensing, or legal
  review gates.
