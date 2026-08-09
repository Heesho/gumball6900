# ADR 0018: Auto-compound the canonical liquidity position instead of routing its fees

- Status: accepted
- Date: 2026-08-09
- Supersedes the fee-routing provisions of [ADR 0014](0014-fixed-distribution-and-v4-liquidity-position.md)
- Builds on [ADR 0017](0017-remove-successor-migration.md)

## Context

ADR 0017 made `LiquidityPosition` ownerless and locked the canonical Uniswap v4 NFT in it permanently. A position that
can never be moved is a natural candidate for compounding: there is no future in which anyone withdraws it, so growing
it forever is the only thing left to optimize.

Until now the contract collected fees, burned all GBX, and routed all USDG through `ResonanceRouter` into the
signal-directed acquisition flow. That made liquidity fees a protocol revenue stream.

The mechanism adopted here is the one Hayden Adams described for pools.trade: deposit the position into a contract
with a single rule — anyone may take all unclaimed fees provided they increase the position by a fixed percentage.
Fees accumulate, and the moment they are worth more than that percentage a searcher is paid to compound. It is the
shape of Uniswap's TokenJar, where a fixed threshold releases an accumulated basket, applied to an LP position.

Forking was considered and rejected. Uniswap's [protocol-fees](https://github.com/Uniswap/protocol-fees) repository
is AGPL-3.0-only, which conflicts with this project's BUSL-1.1 licensing and its dependency-license review gate, and
it contains only `TokenJar` and `Firepit` — no auto-compounding position contract. No public source for the
pools.trade compounder was found. The mechanism is small enough to implement directly.

## Decision

Replace `collectFees` with `compound(amount0Max, amount1Max, deadline)`.

`compound` grows the position by `COMPOUND_BPS`, a hardcoded 20 basis points of current liquidity, and pays the
caller every token the contract holds afterward. It is permissionless, has no keeper role, no oracle, no swap, and no
governance parameter.

The implementation is a single Uniswap batch of `INCREASE_LIQUIDITY` followed by `CLOSE_CURRENCY` on each side.
`PositionManager._increase` computes slippage against `(liquidityDelta - feesAccrued)`, so v4 itself nets the
position's accrued fees against the increase: the caller funds only the shortfall and keeps the surplus. No separate
collection step is needed, and the protocol never holds, prices, or swaps anything.

`amount0Max` and `amount1Max` are both the funding pulled from the caller and the slippage ceiling Uniswap enforces.
Unspent funding is returned in the same call, so they are ceilings, not expected costs.

Settlement runs through Permit2, which becomes an immutable dependency. `ResonanceRouter` is removed from
`LiquidityPosition`'s dependencies because nothing routes any more.

Liquidity fees are no longer protocol revenue. The full 100% funds the compounding incentive.

## Consequences

- Position liquidity is monotonically non-decreasing and compounds without anyone being paid to watch it. The
  position can never be withdrawn and can never shrink.
- **Resonance loses the liquidity-fee revenue stream, and position fees no longer burn GBX.** Fundraiser
  contributions become the only USDG revenue reaching Resonance. This is the accepted cost of the mechanism and is
  reflected in `ECONOMICS.md`, `ARCHITECTURE.md`, `SPEC.md`, and the README.
- Nothing compounds until the price trades into the position's range. The genesis position is single-sided and out of
  range, so it accrues no fees at launch.
- A caller can time the increase. Liquidity `L` is price-invariant but the token mix required to add it is not, so a
  searcher may compound when the composition is cheapest for them, and could in principle nudge the price first. The
  edge is bounded by the range width and by their own swap costs; it is not mitigated in the contract. Tracked as
  A-06 in `packages/contracts/audit/FINDINGS.md`.
- Unsolicited transfers to the contract are swept to the next caller rather than becoming stuck, which preserves the
  previous behavior's property that nothing accumulates there.
- Generated artifacts follow: the `FeesProcessed` event becomes `Compounded`, the subgraph tracks
  `liquidityAddedRaw` and `liquidityCompoundCount` instead of burned and routed totals, and the SDK's
  `buildCollectLiquidityFees` becomes `buildCompoundLiquidity`.
- The mechanism is verified in `test/minimal/LiquidityCompounding.t.sol` against genuine `PoolManager` and
  `PositionManager` contracts with real swaps, not a stand-in, because the whole design rests on v4's netting
  behavior. Only Permit2 is stubbed there, since canonical Permit2 pins solc 0.8.17 and cannot compile alongside this
  project's pinned 0.8.26.
