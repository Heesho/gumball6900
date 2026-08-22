# ADR 0040: Deployment-time Mine authority verification

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-21

## Context

GBX permanently assigns its only mint authority through `setMinter`. That function requires a deployed Mine whose
`gbx()` identity points back to the exact GBX, records the Mine as `minter`, and irreversibly sets `minterLocked`.
GBX also checks both facts whenever `mint` is called.

Mine previously repeated two external GBX reads on every handoff to confirm `gbx.minter() == address(this)` and
`gbx.minterLocked() == true`. Once the one-time handoff is finalized, neither value can change. Rechecking them for
every slot replacement therefore charged recurring gas for permanent deployment facts.

## Decision

Mine no longer performs a runtime mining-authority check in `mine`. The private `_requireMiningAuthority` helper and
`MiningAuthorityNotFinalized` error are removed.

Deployment must complete `GBX.setMinter(Mine)` and verify all of the following before publishing, funding, or exposing
the Mine market:

```text
Mine.gbx() == GBX
GBX.minter() == Mine
GBX.minterLocked() == true
```

GBX remains the enforcement boundary for issuance: every nonzero settlement still calls `GBX.mint`, which rejects a
caller other than the permanently locked minter.

## Consequences

- Every Mine handoff avoids two redundant external GBX getter calls.
- An incomplete deployment is not a usable production deployment even if its Mine bytecode exists. Deployment tooling,
  evidence, manifests, and interfaces must fail closed until the reciprocal binding is verified.
- Before binding, an empty-slot occupation has no prior emission to mint and therefore is not rejected by GBX. The Mine
  address must not be exposed as canonical during this setup window.
- Once binding succeeds, the authority is immutable and later handoffs obtain no additional safety from re-reading it.
- This does not weaken `GBX.mint`: unauthorized or unlocked minting still reverts at the token boundary.
- Removing a custom error changes the Mine ABI but not its function selectors, events, storage layout, economics, or
  authority graph.
- This development decision does not authorize deployment or use with user funds.
