# ADR 0022: Fixed-principal LP fee routing

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-09
- Supersedes: ADR 0018 and all clauses requiring LP fee compounding or excluding LP fees from protocol revenue

## Context

ADR 0018 made the ownerless `LiquidityPosition` grow its canonical GBX/USDG position by a fixed 0.20% whenever a
permissionless caller claimed the accrued fees. Uniswap v4 netted fees against that increase and the caller funded any
shortfall. The mechanism introduced caller-capital, price/range timing, permanent Permit2 approvals, and a searcher
profitability assumption solely to decide when fees could leave the position.

The protocol already has immutable destinations for both canonical fee assets. USDG can enter the normal
`ResonanceRouter -> Resonance -> Strategy` revenue path. GBX can enter ownerless Fund and be burned without changing
the Strategy settlement rule adopted by ADR 0021.

## Decision

The canonical position retains exactly its deposited principal liquidity. `LiquidityPosition` removes `COMPOUND_BPS`,
Permit2, caller funding, token approvals, `compoundRequirement`, and `compound`.

Anyone may call `harvestFees()`. It invokes Uniswap v4 PositionManager's documented fee-collection path:
`DECREASE_LIQUIDITY` with a zero liquidity amount, followed by closing both currency credits. The call verifies that
position liquidity is unchanged.

The complete canonical-token balances held after collection have fixed destinations:

- USDG is transferred exactly to `ResonanceRouter`, which routes it into Resonance in the same transaction; and
- GBX is transferred exactly to Fund and the harvested amount is burned from Fund in the same transaction.

Direct GBX or USDG donations to `LiquidityPosition` follow the same destinations on the next harvest. Collection,
routing, and burn are atomic. A failure leaves the fee entitlement on the position and changes no principal.

No caller bounty, keeper role, swap, oracle, fee split, governance parameter, rescue path, or NFT migration is added.

## Consequences

- The genesis position never grows and can never shrink or leave `LiquidityPosition`.
- LP USDG becomes a second protocol-revenue source alongside Fundraiser contributions.
- LP GBX is burned atomically at harvest; this is distinct from ADR 0021 Strategy payments, which remain deferred
  fixed Fund liabilities and are not automatically burned during auction settlement.
- Permissionless harvest has no direct caller reward. Fees may remain accrued until a user, interface, or bot performs
  maintenance; this delays revenue but cannot block signal exits, redemption, or position custody.
- The caller-funded composition/timing risk recorded as A-06 is removed. Signal-timing and scaled-carry allocation
  behavior still apply when harvested USDG reaches Resonance.
