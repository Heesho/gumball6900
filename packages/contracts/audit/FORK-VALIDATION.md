# Fork-validation record

Date: 2026-08-09

Authority update: ADR 0034 later removed the in-repository Governor and Timelock. No external governance system has
been selected or fork-validated. ADR 0050 later removed the canonical Uniswap v4 position and every
LiquidityPosition dependency; the historical target-chain observations below remain unchanged but no longer describe
the current core graph.

No current-graph fork campaign passed in this audit. This is a blocked release gate, not a skipped test represented as
success.

## What was validated

The prior hardening pass performed non-mutating JSON-RPC reads against Robinhood Chain ID 4663 at block `32,035,314`,
block hash `0xe13569d3a71001227e35d660dfbcfed1e7660d10b74c0c639e4bc0eab1555aea`. It recorded code hashes for the
documented PoolManager, PositionManager, and Permit2 addresses and successfully executed `TSTORE`/`TLOAD` in an
`eth_call`. Exact addresses and hashes are in `UNISWAP-V4-REVIEW.md`.

That evidence establishes Cancun/EIP-1153 availability and observed dependency code at one historical block. It does
not instantiate this undeployed protocol, verify a deployment manifest, prove current code at a later block, or test
the canonical pool/NFT because no canonical GBX deployment exists.

## Why a fork did not run

- The repository has no signed deployment manifest for the current direct-core graph and its required external
  governance ownership integration.
- The checked deployment schema and release/fork utilities are explicitly archived legacy evidence for a different
  14-contract graph and cannot safely construct current protocol state.
- No current deployment addresses, constructor arguments, one-time bindings, reviewed external LP Strategy input,
  external-governance configuration, or ownership snapshot are authorized.
- No credential-bearing RPC URL was requested, recorded, or printed during this review.

## Reproducible requirement

Before release, build a current non-broadcast deployment/fork harness, bind it to a signed manifest, record the RPC
provider capability without exposing credentials, and pin chain ID, block number, block hash, dependency code hashes,
constructor inputs, one-time bindings, the exact external-governance release and bytecode, proxy/upgrade and permission
graph, voting/execution/delay/cancellation policy, Resonance ownership receipt, and every reviewed initial Strategy
input, including the externally created fungible Uniswap v2-style USDG/GBX LP ERC-20 and its ordinary Strategy
configuration. Then rerun Fund EIP-1153
redemption and the complete current core campaign against that exact state. No pool operation belongs in the core fork
harness.

Status: **blocked / not executed**. Release blocker: **yes**.
