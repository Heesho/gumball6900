# ADR-0011: Permissioned-Pool Successor Graph

- Status: Implemented and locally rehearsed; not release-authorized
- Date: 2026-08-02
- Decision owners: protocol engineering, independent security review, and legal/compliance review

## Context

ADR-0010 keeps manifest schema v1 fail-closed because the deployed v1 shape has an initialization-only
`LaunchGuardHook`. Uniswap subsequently documented a standard permissioned-pool graph consisting of a verified
Permissions Adapter, `PermissionedHooks`, a Permissioned Position Manager, and Universal Router 2.2.0 or later. The
official shared deployment list currently covers Ethereum and Sepolia, not Robinhood Chain.

GUM BALL has two additional invariants that the shared graph does not solve by itself:

1. Genesis price is known only after the seven-day bootstrap, so nobody may pre-initialize the canonical PoolKey.
2. GBX has zero supply before atomic genesis, while the official factory verifies an adapter only after it holds a
   nonzero amount of underlying. The complete 20,000,000 GBX allocation must still enter protocol-owned liquidity;
   a permanently stranded verification wei or an extra mint is not acceptable.

## Decision

The successor graph uses the official adapter, factory, Permissioned Position Manager, Universal Router, and quoter
relationships. `GumBallPermissionedHook` implements the pinned official permission callbacks and adds the existing
one-shot canonical initialization guard. It trusts only wrappers approved on the adapter and asks those wrappers for
the actual `msgSender()`, matching the standard identity model; it does not treat the PoolManager's immediate sender
as the trader.

`PermissionedLiquidityManager` uses the verified GBX Permissions Adapter as the pool-facing currency while retaining
underlying GBX for supply accounting, real fee burns, and residual checks. The adapter unwraps underlying GBX whenever
PoolManager transfers the adapter currency out.

`AdapterVerificationEscrow` resolves the zero-supply verification cycle during atomic genesis:

1. LiquidityManager deposits exactly 1 wei of its already minted 20,000,000 GBX into the adapter.
2. The official factory verifies the adapter.
3. The escrow wraps exactly that 1 wei to PoolManager inside an unlock, settles it, and immediately takes the adapter
   currency to the immutable LiquidityManager recipient.
4. The adapter burns the wrapper unit and returns the same underlying wei. LiquidityManager proves its balance is
   again exactly 20,000,000 GBX before initializing or minting positions.

The escrow has no amount, currency, recipient, approval, or target input. It is an adapter-approved wrapper, is bound
once to LiquidityManager, and can return only the constant verification deposit through the fixed PoolManager.

`PermissionedPoolController` creates the adapter with itself as owner, so no EOA ever owns the adapter. It configures
the four pinned official wrappers, verification escrow, and canonical hook exactly once. Thereafter it exposes only
typed seven-day-timelocked checker/wrapper/hook/swap controls and guardian stop-only swap/liquidity controls; it has no
arbitrary call or asset-transfer function. `EligibilityAllowlistChecker` maps the canonical GBX eligibility module to
the two official permission bits and fails closed on an ineligible account or module failure.

The machine-readable `permissionedPoolGraphSchema` pins the source commits, runtime code hashes, adapter/factory/hook
relationships, canonical PoolKey, ordered official wrappers, protocol-owned position recipient, verification escrow,
and review evidence. Its `releaseEligible` field is literally `false`: the artifact records a review candidate and
cannot authorize deployment by itself. Deployment-manifest schema v2 is the separate authorization envelope: it
requires exact raw-SHA-256 descriptors for this graph, the reproducible official-source build, and the fresh Robinhood
testnet-fork rehearsal and cross-binds them to the signed config, state, deployed graph, and release observation.

## Pinned source boundary

- `Uniswap/v4-hooks-public` commit `7da5210f2c81a700820a6b4f585264233d91f349`,
  `src/permissioned-pools/PermissionedHooks.sol`.
- Its compatible `Uniswap/v4-periphery` submodule commit
  `76c1891c481cebb4ff58f262473303f01a2d7393`, `src/hooks/permissionedPools`.
- Universal Router tag `2.2.0`, dereferenced commit `020e1b786ad9a6bad924874752167934734ad1e1`.
- `Uniswap/mixed-quoter` commit `d576527bff2e7c9db5434bb2b3806fd184610865`,
  `src/MixedRouteQuoterV2.sol`.

The npm `@uniswap/v4-periphery` latest tag remains `1.0.3` and does not contain this graph. The repository therefore
does not silently replace its general v1 dependency or claim an unpublished package release. Production tooling must
build or bind the exact reviewed upstream sources and runtime hashes explicitly.

## Invariants

- Exactly 100,000,000 GBX is minted at genesis: 80,000,000 for claims and 20,000,000 for POL.
- The factory verification cycle does not mint GBX and ends with the full 20,000,000 GBX restored to
  LiquidityManager before position minting.
- The canonical PoolKey contains the GBX adapter, canonical USDG, fee 3,000, spacing 60, and
  `GumBallPermissionedHook`.
- Only LiquidityManager can initialize that PoolKey, exactly once.
- Swaps require `SWAP_ALLOWED`, liquidity additions require `LIQUIDITY_ALLOWED`, and removing liquidity remains an
  exit path.
- The Permissioned Position Manager NFT recipient is LiquidityManager and its NFTs remain non-transferable.
- Adapter administration cannot call GumBallVault, mint GBX, redirect protocol positions, or select a verification
  escrow recipient. The purpose-limited controller can change only the checker, four fixed wrappers, canonical hook
  allowance, and swapping state through the declared timelock/guardian paths.

## Release boundary

This implementation does not change ADR-0010's schema-v1 decision: v1 still rejects `permissioned-production`.
Schema v2 now defines the fail-closed production authorization envelope, but it can validate only after operators add
real, independently reviewed evidence to the evidence commit. That evidence must establish all of the following:

- exact Robinhood deployments and runtime hashes for the factory, Permissioned Position Manager, Universal Router,
  both quoters, adapter, hook, escrow, and LiquidityManager;
- full integration tests against the pinned official Position Manager, adapter, and a real v4 PoolManager;
- Robinhood testnet and mainnet-fork rehearsals for genesis, both swap directions, pauses, loss of eligibility,
  collection, sweep, migration, and issuer unwind behavior;
- independent review of the upstream pins and all GUM BALL extensions;
- legal/issuer approval of the checker, administrator, eligible protocol contract set, privacy policy, routing
  onboarding, and recovery behavior.

The Hardhat runner deploys and permanently binds the successor, verifies the one-wei cycle, settles the full 20,000,000
GBX allocation through a local behavior-faithful adapter/PositionManager rehearsal, and records a separate permissionless
swap-activation transaction after atomic genesis. The release ceremony permits exactly six evidence-commit blobs for
schema v2: manifest, deployment config, deployment state, graph, official-source build, and Robinhood fork rehearsal.
The verifier rejects missing bytes, source substitution, reproduced-runtime drift, stale or under-confirmed fork
evidence, incomplete adapter backing, PoolKey drift, or absent post-genesis permissionless swapping. Because the exact
upstream contracts have not yet been built, deployed, and exercised on Robinhood with the required independent and
legal evidence, the repository remains non-release-authorized.

## References

- Uniswap permissioned-pool architecture:
  <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/architecture>
- Uniswap deployment guide and current shared addresses:
  <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/deploy-a-permissioned-pool>
- Official hook source:
  <https://github.com/Uniswap/v4-hooks-public/tree/7da5210f2c81a700820a6b4f585264233d91f349/src/permissioned-pools>
- Official periphery source:
  <https://github.com/Uniswap/v4-periphery/tree/76c1891c481cebb4ff58f262473303f01a2d7393/src/hooks/permissionedPools>
- Official mixed-quoter source:
  <https://github.com/Uniswap/mixed-quoter/tree/d576527bff2e7c9db5434bb2b3806fd184610865/src>
