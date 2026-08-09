# Residual risks

## Open protocol and economic risk

- Permissionless LP fee harvesting has no caller bounty, so fee realization may be delayed until someone voluntarily
  pays gas. A failing Resonance route or Fund burn rolls back collection and leaves the entitlement retryable.
- Harvested USDG is allocated using the signal weights present when `harvestFees` routes it. Because signaling has no
  cooldown, temporary signal can redirect the next lumpy LP-revenue notification; this is the frozen current-signal
  allocation policy and is distinct from A-09's sub-index carry crossing a later denominator boundary.
- Reverse-Dutch Strategy price can fall to zero and the next starting price can ratchet to its configured floor after
  a late fill. This is the accepted A-05 product behavior.
- Fund has no curated asset list, recovery, or migration. Unsolicited or omitted assets stay indefinitely.
- A blocked supported token can leave its own user or fixed Fund liability unpaid. Destinations cannot be redirected;
  exit liveness is isolated from payout liveness.
- Direct token donations to Bribe or BribeRouter are visible surplus but have no recovery/scheduling mechanism.
- A-09 remains open: conserved sub-index carry is divided by the signal supply present when it becomes indexable, so a
  later Strategy signal or signaler can receive value that arrived or emitted before entry. The maximum pending bucket
  grows with signal supply and can be material for low-decimal tokens.

## Governance and setup risk

The project multisig can propose/cancel Resonance owner actions through TimelockController. Ongoing actions are
`addStrategy`, `killStrategy`, and `addBribeReward` (maximum eight tokens). One-time setup
also binds ResonanceRouter, SignalGBX, both factories, and GBX's Fundraiser minter. Incorrect immutable addresses,
PoolKey, ticks, token ID, initial prices, or roles are unrecoverable.

## External dependencies

Security depends on standard-token behavior, OpenZeppelin 5.6.1, the pinned Uniswap/Permit2 code, Robinhood Chain
Cancun/EIP-1153 behavior, RPC accuracy, indexer correctness for presentation only, and wallet/user selection of Fund
and Bribe claim token arrays.

## Evidence gaps

No independent audit, current-tree mutation score, pinned Echidna result, Mythril result, formal proof, legal
clearance, or signed deployment manifest exists. Medusa passed the final graph, but native Echidna 2.3.3 crashed before
transaction one and the pinned 2.3.2 container could not run without Docker. Those are release blockers, not merely
future enhancements.
