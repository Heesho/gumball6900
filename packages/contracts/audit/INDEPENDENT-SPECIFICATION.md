# Independent adversarial specification

Date: 2026-08-15. Authority model reconciled 2026-08-19 for ADR 0034.

This is the review target for the ADR 0027, ADR 0028, ADR 0029, ADR 0031, ADR 0032, ADR 0033, and ADR 0034 development
candidate. It is not an independent audit result.

## Authority model

- Deployments are direct and non-upgradeable. Fund and LiquidityPosition are ownerless.
- Resonance is the only owned core contract. Its owner may add/kill Strategies, register Bribe rewards, transfer
  ownership, or renounce ownership. Mine has no administrative authority.
- The core contains no Governor, protocol Timelock, generic executor, or provider-specific governance adapter.
  SignalGBX retains ERC20Votes checkpoints for a future external integration, but the core assigns them no proposal,
  quorum, execution, delay, or cancellation semantics.
- External governance is unselected. Production requires a separately reviewed integration and direct transfer of
  Resonance ownership to its exact executor, with no surviving temporary setup authority.
- No authority can change the fixed slot count, reprice an occupied slot, replace the GBX minter, set emissions, migrate, pause,
  rescue, sweep, move Fund assets, or withdraw the liquidity NFT.

## GBX and Mine

- GBX mints `20_000_000 ether` at construction, then permanently binds its only issuer to one deployed Mine whose
  reciprocal `gbx()` identity matches.
- Supply reconciles as `lifetimeMinted - lifetimeBurned` and has no protocol-defined economic maximum. GBX retains
  ERC20Permit for approval-based signaling but has no voting checkpoints; SignalGBX exposes the core's only IVotes
  checkpoints for a future external governance integration.
- Mine has exactly sixteen permanent slots from construction.
- Each slot price decays linearly to zero over one hour. Epoch ID, deadline, and maximum price protect handoffs.
- A handoff settles only the displaced slot. Each tenure receives `elapsed * slot.tps`, and `slot.tps` is never recomputed.
- The incoming tenure receives `globalTps(totalMined + pendingEmission) / 16`.
- `aggregateTps`, `storedPendingEmission`, and `pendingUpdatedAt` make total pending emission and effective supply
  constant-time without iterating or mutating all slots.
- Future-handoff global rates halve at immutable cumulative-mining thresholds and stop falling at a positive tail.
- A nonempty price splits into an 80% displaced-miner pull claim plus a 20% Resonance route. An empty slot routes 100%.
- Exact USDG balance deltas are required. Mine retains only outstanding claims, and claims cannot be redirected.

## Signals, Strategies, and Bribes

- SignalGBX mints and burns one-for-one, is non-transferable, and accepts GBX only after reciprocal Resonance binding.
  Every mint atomically adds the same signal to one live Strategy, and every burn atomically removes signal and returns
  the same GBX. Its supply is fully backed; unsolicited GBX is stranded surplus rather than token issuance. It retains
  ERC20Votes but not ERC20Permit; `signalWithPermit` authorizes only the underlying GBX transfer.
- SignalGBX is the sole user-facing signal coordinator. Its balance is each account's aggregate signal and it supports
  atomic deposit-and-signal, live-to-live or killed-to-live moves, and remove-burn-withdraw. Idle sGBX is unreachable.
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
  payment becomes cumulative fixed liabilities: exactly 90% for Fund and 10% for its paired Bribe.
- Each BribeRouter liability can be paid independently and permissionlessly, and payment-frequency changes cannot
  alter cumulative classification. Direct router donations remain surplus. Bribes may also be independently funded,
  have at most eight reward tokens, pause at zero supply, and isolate broken-token
  claims from signal exit. Old-denominator Bribe carry and a fully exiting account's sub-token remainder move to the
  fixed Fund classification before virtual supply changes.

## Fund and liquidity

- Fund is registry-free and ownerless. Before redemption it validates the permanent Mine and reads its effective supply.
- Every selected token uses one effective pre-burn supply and raw balance snapshot. The burn and
  all exact transfers are atomic. Zero, GBX, and duplicates are rejected with EIP-1153 marks. A basket-wide final
  balance check rejects distinct selected addresses whose transfers consume the same snapshotted backing.
- LiquidityPosition permanently holds one exact hookless GBX/USDG v4 NFT. Harvesting removes zero principal, routes
  complete USDG through ResonanceRouter, burns complete GBX through Fund, and reverts on any failure.

## Release properties

- Foundry and Hardhat compile the same Solidity tree; SDK/subgraph ABIs come from current artifacts.
- TypeScript and Python independently assert fixed sixteen-slot tenure, future-handoff halvings, 80/20 payments, the
  no-economic-cap issuance model, effective-supply redemption, qualifying Resonance resets and surplus solvency, and
  boundary-carry Fund routing in Bribe.
- Foundry separately proves coordinator rollback, move semantics, and that historical SignalGBX voting checkpoints
  survive withdrawal. A later integration campaign must prove the selected external system's token compatibility,
  permissions, voting, proposal scope, delay, cancellation, execution, and ownership handoff.
- No consumer may display pending Mine accrual as already minted supply or the 80% handoff as guaranteed.
- A green local campaign does not clear independent audit, parameter, monitored testnet, manifest, licensing, or legal
  review gates.
