# ADR 0050: Zero-premint GBX and external LP Strategy

- Status: accepted for development; not audited, deployed, or approved for user funds
- Date: 2026-08-24
- Supersedes: ADR 0014, ADR 0017, ADR 0022, ADR 0024, ADR 0033, ADR 0042, ADR 0043, ADR 0044, and ADR 0049 only where
  they require a genesis GBX allocation, a canonical protocol-owned liquidity position, `LiquidityPosition`, or
  special liquidity-fee routing
- Preserves: Mine's issuance schedule and permanent mint authority, ordinary Strategy settlement, permissionless Fund
  burns, and caller-selected Fund redemption

## Context

The development architecture reserved 20 million GBX at construction for one permanent, single-sided GBX/USDG
Uniswap v4 position. A dedicated ownerless `LiquidityPosition` contract admitted its NFT, retained fixed principal,
harvested fees, routed USDG, and burned GBX.

That mechanism made one venue, position shape, custody policy, and fee path part of the core protocol even though the
index already has a generic way to acquire fungible assets: a Strategy. It also placed 20 million GBX into supply
before any Mine issuance.

The desired liquidity exposure is much simpler. If a fungible Uniswap v2-style USDG/GBX LP token exists outside the
protocol, governance may register that ERC-20 as an ordinary Strategy payment token. The Strategy then acquires LP
tokens for the index under exactly the same auction and settlement rules as any other asset.

## Decision

GBX starts with zero supply and zero lifetime minted. Its constructor creates no allocation and accepts no liquidity
recipient. The temporary setup minter cannot mint before the one-time Mine binding because `mint` remains disabled
until `minterLocked` is true. After reciprocal identity validation and permanent binding, Mine is the sole lifetime GBX
issuer.

Delete `LiquidityPosition` and every core requirement for a canonical Uniswap v4 pool, position NFT, range, Position
Manager, Permit2 approval, principal check, fee harvest, liquidity router deposit, or liquidity-specific burn.

A reviewed external fungible USDG/GBX LP ERC-20 is registered during bootstrap as one ordinary Strategy payment token.
Its exact address and configuration remain reviewed deployment inputs rather than source constants. This is not a
special Strategy type. The existing global Strategy split applies without exception: the floored `bribeBps` share goes
to the paired BribeRouter and the complement goes directly to Fund. LP tokens held by Fund are ordinary
caller-selectable redemption assets.

The core does not create, seed, own, custody, price, rebalance, compound, harvest, swap, or guarantee liquidity. It does
not select a Uniswap v2 factory, router, pair address, initial reserve ratio, LP supplier, or market-launch process.
Those are external deployment and market decisions and must not become a core correctness or liveness dependency.

## Consequences

- At deployment, `totalSupply == lifetimeMinted == lifetimeBurned == 0`. Supply begins only when an occupied Mine slot
  accrues and settles emission.
- The supply identity remains `totalSupply == lifetimeMinted - lifetimeBurned`, with no genesis offset.
- The synchronized no-burn emission reference is reduced by 20 million GBX at every point; the Mine rate schedule is
  unchanged.
- The core graph loses one contract and all Uniswap v4 position dependencies, callbacks, custody invariants, fee
  routing, integration tests, SDK helpers, subgraph entities, and deployment evidence specific to that position.
- Registering an LP Strategy does not guarantee that the pair exists, has useful liquidity, has a sound reserve ratio,
  or remains usable. Governance and users bear the same asset-selection and token-behavior risks as for any other
  Strategy payment token.
- A Strategy acquisition can place fungible LP tokens in Fund and its paired Bribe, but the protocol performs no
  liquidity operation. Any underlying pool fees accrue inside the external LP token's reserves according to that
  venue's rules.
- No canonical LP address is invented or required by this decision.
