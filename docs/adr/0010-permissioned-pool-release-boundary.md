# ADR-0010: Permissioned-Pool Release Boundary

- Status: Accepted
- Date: 2026-08-02
- Decision owners: protocol engineering, security review, and legal/compliance review

ADR-0011 now specifies and locally implements a successor review candidate. This ADR remains authoritative for the
v1 release boundary: schema v1 is still unable to authorize permissioned production.

## Context

The master specification requires deployment-time selection between unrestricted test operation and a compliant
production mode. It also requires a standard permissioned-pool architecture if counsel or an issuer determines that
GBX/USDG secondary trading must be permissioned.

The protocol's pinned Uniswap v4-periphery dependency is version `1.0.3`. The canonical pool currently uses the
minimal `LaunchGuardHook`, whose sole permission bit is `beforeInitialize`. It protects the intended PoolKey from
pre-initialization but deliberately has no swap-time behavior. The exact graph therefore cannot enforce trader
eligibility at the pool boundary.

Uniswap's permissioned-pools implementation now exists upstream, but it is a materially different integration graph:
it includes permission adapters and permission-aware router and position-manager surfaces rather than a boolean mode
on an initialization-only hook. No exact upstream permissioned-pools source, deployment set, audit artifact, router
compatibility decision, issuer policy, or Robinhood deployment is currently bound into this repository's dependency
lock and signed manifest model.

## Decision

The v1 graph supports `NoopEligibilityModule` for local/test use and `RegistryEligibilityModule` for permissioned GBX,
mining, staking, manager-reward, and redemption boundaries. It does **not** claim that those checks make the canonical
v4 pool permissioned.

Release-manifest schema v1 must continue to reject `release-approved` manifests whose compliance mode is
`permissioned-production`, even when a review flag is supplied. The current graph may become release-eligible only
after counsel and issuers explicitly approve `unrestricted-production-approved` and every other release gate passes.
This is a fail-closed release boundary, not approval of unrestricted trading.

If production requires permissioned pool trading, implementation moves to a separately reviewed successor graph. That
work must pin an exact official Uniswap permissioned-pools source, use its required permission adapter/router/position
manager relationships, preserve the launch backing and NFT-custody invariants, update the PoolKey and CREATE2 witness,
and bind every additional runtime and authority into deployment and release verification. It must not retrofit
swap-time permissioning into `LaunchGuardHook` or accept a manifest-only switch.

## Invariant impact

- The v1 canonical pool remains initialization-guarded but unrestricted at swap time.
- No manifest can describe that v1 pool as permissioned production.
- GBX transfer eligibility remains enforced by `GBXToken` when a registry adapter is selected, but that alone is not
  treated as proof that every v4 routing or settlement path satisfies an issuer's trading policy.
- Redemption remains unpausable. Any eligible alternate-receiver or recovery policy requires explicit legal and
  protocol review and cannot create an administrator-controlled vault withdrawal.
- The one-billion cumulative mint cap, 20 million fully backed LP allocation, protocol-owned NFT custody, fee routing,
  and constrained migration rules are unchanged.

## Consequences

The repository cannot authorize a permissioned mainnet launch today. This intentionally preserves a hard blocker
rather than presenting an incomplete compliance hook as production support. A production requirement for permissioned
trading expands the contract graph, SDK, web routing, deployment manifest, fork verification, monitoring, and audit
scope.

An unrestricted production launch is also blocked until qualified reviewers explicitly approve that mode. Local and
testnet engineering evidence cannot make either legal decision.

## Rejected alternatives

### Treat `RegistryEligibilityModule` as pool permissioning

Rejected because token-level transfer checks and pool/router permission semantics are not interchangeable, and the
required identity may be obscured by routers or settlement contracts.

### Add `beforeSwap` to LaunchGuardHook and check `sender`

Rejected because the v4 hook sender can be a router or other intermediary rather than the economic trader. A bespoke
check would be incompatible with standard routing assumptions and would create a new unaudited compliance protocol.

### Allow the manifest review boolean to waive missing code

Rejected because evidence metadata cannot create an enforcement mechanism or bind omitted runtime dependencies.

### Vendor the newest upstream files without a release migration

Rejected because the permissioned-pools graph is broader than one hook contract. Importing selected files would not
prove router, position-manager, adapter, custody, deployment, and operational compatibility.

## Verification

- Manifest-schema tests must reject `permissioned-production` for schema v1 regardless of the review boolean.
- Deployment and release verifiers must bind the initialization-only hook's exact permission bits and PoolKey.
- Documentation and UI must state that the current hook is not a permissioned-pool implementation.
- A successor implementation requires dedicated unit, integration, invariant, local-v4, and Robinhood fork coverage
  for trader identity, routing, liquidity custody, initialization, swaps in both directions, failure/recovery behavior,
  and every new authority.

## References

- Uniswap, “Introducing Permissioned Pools on Uniswap v4”:
  <https://blog.uniswap.org/introducing-permissioned-pools-on-uniswap-v4>
- Upstream v4-periphery permissioned-pools source observed at commit
  `3245c3cb99c48fa1dc2459c3b60abc37d4294aba`:
  <https://github.com/Uniswap/v4-periphery/tree/3245c3cb99c48fa1dc2459c3b60abc37d4294aba/src/hooks/permissionedPools>
- [ADR-0011 successor graph](0011-permissioned-pool-successor-graph.md)
