# ADR-0014: fixed distribution and canonical v4 liquidity position

## Status

Accepted for development; not approved for deployment or user funds.

## Context

The upstream-shaped core initially replaced the previous emission graph with a configurable halving Fundraiser and
left genesis liquidity outside the active architecture. The intended economics are instead a fixed one-billion GBX
lifetime allocation: 20 million GBX in a single-sided Uniswap v4 position and 980 million GBX distributed to USDG
contributors using the already modeled four-year-half-life schedule.

Automatically reinvesting the v4 fees would depend on reliable third-party executors. The simpler intended fee policy
is to burn GBX and route USDG into signal-directed Strategies.

## Decision

- GBX creates exactly 20 million tokens at construction for the genesis-liquidity recipient.
- Deployment-time minting is disabled. The initial minter can only perform one permanent handover to Fundraiser.
- Fundraiser embeds the prior exact daily sequential-floor schedule: epoch-zero emission
  `465152749681042811702004` wei, daily multiplier `999525354337060160 / 1e18`, and a 1,460-day half-life.
- Empty epochs advance the schedule and mint zero without carry.
- Permissionless `settleEpochs(maximumEpochs)` advances ended epochs in bounded strict order. Claims mint the settled
  epoch allocation directly and pro rata to contributors.
- Separate emission-controller, mining-pool, and mining-claims contracts are not restored.
- LiquidityPosition holds one precommitted nonempty PositionManager NFT for the exact hookless GBX/USDG pool and tick
  range. It accepts no arbitrary NFT.
- Permissionless collection requests zero liquidity removal, burns the contract's complete GBX balance, and routes its
  complete USDG balance through ResonanceRouter.
- LiquidityPosition exposes no arbitrary NFT withdrawal. Timelocked governance can bind one configuration-identical
  successor, after which anyone can migrate the exact position.

## Consequences

- The familiar distribution curve is preserved without restoring the previous multi-contract mining graph.
- Strict sequential settlement preserves floor rounding but creates routine permissionless keeper work. Bounded calls
  allow catch-up after inactivity.
- Empty days, unclaimed accounts, and per-account division dust reduce actual minting; they never create later carry.
- Sequential flooring leaves `818184994828` wei of the nominal 980 million allocation outside the positive schedule.
  The GBX lifetime cap remains the independent final limit.
- The custody contract proves the expected pool, NFT, range, and nonzero liquidity, but deployment evidence must still
  prove the full 20 million GBX allocation was used and document any position-mint rounding residual.
- Liquidity fee processing has no dependency on specialized searchers, but it also does not automatically compound
  principal.
- One-time compatible migration keeps the position recoverable while making a bad successor commitment irreversible.

## Credit

The starting mechanics retain the repository's existing give.fun, Liquid Signal Governance, and Euler Fee Flow
provenance recorded in `NOTICE`. Uniswap v4 interfaces and position mechanics come from the pinned package dependencies.
