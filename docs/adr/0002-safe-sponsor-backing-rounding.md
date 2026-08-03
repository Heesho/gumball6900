# ADR-0002: Safe Sponsor-Backing Rounding

- Status: Superseded by ADR-0012; archival baseline only.
- Date: 2026-08-01
- Decision owners: protocol engineering and economic review
- Supersedes: none

## Context

Genesis allocates 80 million GBX to community miners and 20 million GBX to protocol-owned liquidity. The liquidity
allocation must enter `totalSupply()` and therefore must be backed at the same community clearing ratio.

In real contracts, community USDG `C` is an integer number of raw USDG units. `C * 20m / 80m` may not be integral.
Floor division can underfund the LP claim by a fraction of one raw USDG unit, violating the strict “never launch
unbacked” requirement. The bootstrap cap also needs a sponsor maximum that is safe under the same granularity.

## Decision

Define:

```text
M = 80,000,000e18 GBX
L = 20,000,000e18 GBX
C = accepted community USDG in raw USDG units
```

The required sponsor amount is the least integer raw USDG amount that cannot underback the LP allocation:

```text
S = ceil(C * L / M)
```

Solidity computes this with overflow-safe full-precision arithmetic equivalent to:

```solidity
Math.mulDiv(C, L, M, Math.Rounding.Ceil)
```

It must not compute `C * L` with ordinary multiplication first. The maximum sponsor escrow is likewise:

```text
maxSponsorUSDG = ceil(bootstrapContributionCap * L / M)
```

At settlement, sponsor escrow must be at least `S`; exactly `S` moves to GumBallVault and only escrow above `S` is
refunded. Community contribution accounting and sponsor deposits use observed balance deltas.

The safety properties are:

```text
S * M >= C * L
S = 0 or (S - 1) * M < C * L
```

Thus `S` is minimal and any overbacking caused by granularity is strictly less than one raw USDG unit. That dust
stays in GumBallVault and benefits all GBX holders; it is not refundable or sweepable.

The recorded genesis price is derived from `C / M` with explicit USDG/GBX decimal normalization and the rounding
convention required by Uniswap initialization. Pool math uses official Uniswap libraries. The sponsor test uses the
raw-unit ratio above and does not depend on a rounded displayed price.

## Consequences

- The 20 million LP GBX is never underbacked due to integer truncation.
- A sponsor may contribute at most one raw USDG unit more than the exact rational ratio.
- The familiar `C / 4` expression is documentation shorthand; implementations and deployment tooling use ceiling
  `mulDiv`.
- The bootstrap cap gives the sponsor a deterministic safe maximum before community contributions open.
- If USDG transfer behavior causes observed sponsor balance to fall below `S`, settlement fails and community refunds
  remain permissionless.

## Rejected alternatives

### Floor `C / 4`

Rejected because any nonzero remainder creates measurable, if tiny, underbacking.

### Round to nearest

Rejected because half of remainder cases round down and violate the one-sided safety property.

### Mint fewer than 20 million LP GBX

Rejected because the genesis allocation is fixed and exact.

### Add the missing dust from community funds

Rejected because it changes the sponsor/community economic identity and can still be implemented incorrectly around
decimal normalization.

## Verification

- Unit tests cover `C = 0`, values around multiples of four raw units, contribution cap, minimum raise, and maximum
  integer-safe ranges.
- Fuzz tests prove both minimal-ceiling properties for all valid `C`.
- Genesis integration tests assert vault USDG, exact `(M, L)` mint, claim denominator, sponsor refund, and atomic
  rollback on one-unit underfunding.
- Python and TypeScript models use the same ceiling rule and generate shared fixtures.
- The launch manifest records `C`, `S`, cap-derived maximum escrow, normalized `P0`, rounding modes, and resulting
  backing per GBX.
