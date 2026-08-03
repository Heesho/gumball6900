# ADR-0005: Genesis v4 Integer-Liquidity Residual

- Status: Accepted
- Date: 2026-08-01
- Decision owners: protocol engineering, economic review, and release security
- Supersedes: the literal assumption that four fixed v4 ranges can always represent all 20,000,000 GBX as principal

## Context

The master specification fixes a 20,000,000 GBX genesis liquidity allocation and four configurable one-sided ranges.
Section 2 permits a different implementation only when an ADR proves a safer replacement. Uniswap v4 represents a
position's liquidity as an integer `uint128`; the token principal for that liquidity is then computed with rounded
core math. Consequently, an arbitrary raw-token cap is not necessarily representable exactly in a fixed range.

The initial raw token ratio can also exceed a 256-bit shifted intermediate for valid low raises and one currency
ordering. A hand-written onchain square-root implementation would both violate the official-SDK requirement and add a
second price algorithm at the launch boundary.

The pinned Robinhood fork demonstrates the issue. With GBX as token0, a 1:1 human launch price, and the canonical
50/30/15/5 ladder, v4-periphery's `LiquidityAmounts.getLiquidityForAmount0` leaves 67,956,637 wei of GBX because it
truncates `sqrtLower * sqrtUpper / Q96` before solving for liquidity. Removing that intermediate precision loss still
cannot consume every cap exactly: the greatest safe liquidity in each range leaves 71,825, 39,399, 17,077, and
59,953 wei respectively, or 188,254 wei total. Adding one liquidity unit to any position would exceed its allocation
cap. The exact aggregate principal is therefore not universally representable for a flexible genesis price and four
fixed ranges.

## Decision

Genesis continues to mint exactly 20,000,000 GBX to LiquidityManager and the sponsor continues to back all of it.
For each configured range, `GenesisLiquidityMath` finds the greatest integer liquidity whose official v4-core
`SqrtPriceMath` principal is no greater than that range's allocation cap:

```text
cost(L) <= allocationCap
L == uint128.max or cost(L + 1) > allocationCap
```

For token0, the official periphery result is a proven lower bound. A rounded-up official `FullMath` intermediate is a
proven upper bound. A terminating binary search between those bounds validates every candidate with official
`SqrtPriceMath.getAmount0Delta(..., roundUp=true)`. Token1 uses the exact official periphery inverse and validates it
with `getAmount1Delta`. Tick conversions remain the pinned Uniswap implementation.

After contributions close, any settlement caller computes the raw token1/token0 square-root price with the pinned
official Uniswap SDK `encodeSqrtRatioX96` and supplies that deterministic `uint160` witness. The onchain validator
enforces v4's half-open price bounds and proves the exact unique floor with two 512-bit product comparisons:

```text
candidate^2 * amount0 <= amount1 * 2^192
(candidate + 1)^2 * amount0 > amount1 * 2^192
```

The comparison uses `FullMath.mulDiv` plus `mulmod` quotients and remainders, so it never constructs the potentially
wider-than-256-bit right-hand side. A wrong witness reverts the complete atomic settlement and cannot consume launch
state; a correct witness remains permissionlessly submit-able.

The pure price validation and liquidity calculations are exposed by a separately deployed immutable
`GenesisLiquidityCalculator`. It has no storage, token reference, approval, callback, or privileged method.
LiquidityManager holds its fixed address as an immutable. This separation keeps the custody contract below the
EIP-170 runtime limit while the deployment manifest and verifier pin both contracts' bytecode and their immutable edge.

LiquidityManager records actual principal per position, plus immutable historical launch totals:

```text
genesisLiquidityPrincipal + genesisLiquidityResidual = 20,000,000e18
GBX.balanceOf(LiquidityManager) = genesisLiquidityResidual  // immediately after launch
```

The residual remains in LiquidityManager with both ERC-20 and Permit2 approvals revoked. There is no arbitrary
transfer, redemption, approval, NFT-transfer, or execution path that can extract it. Fee collection and completed
range sweeping use observed pre/post deltas, so they neither classify nor burn the genesis residual. A later
seven-day-timelocked canonical migration may include it in the existing rule that burns GBX not deposited into
replacement positions; the historical genesis principal/residual fields do not change.

`LiquidityManager__PositionRecorded` now reports actual `gbxPrincipal` rather than a nominal cap.
`LiquidityManager__CanonicalPoolSeeded` reports both aggregate `gbxPrincipal` and `gbxResidual`.

## Invariant impact

- The fixed genesis mint, cumulative mint accounting, and `totalSupply() == 100,000,000e18` remain exact.
- All 20,000,000 GBX remain fully sponsor-backed and protocol-custodied.
- The economically active v4 principal is maximal for every configured range, rather than overstated as a nominal
  amount that v4 did not transfer.
- The launch conservation invariant replaces an impossible universal claim of exact four-range principal.
- No new privileged role, mutable peer, or trust assumption is introduced.

## Consequences

- On the pinned 1:1 Robinhood vector, 19,999,999.999999999999811746 GBX is v4 principal and 0.000000000000188254 GBX
  is constrained residual custody.
- Monitoring, deployment verification, the subgraph, and SDK must distinguish allocation, actual principal, and
  residual. Indexers must regenerate the changed canonical-seed event ABI before release.
- A future migration can burn a residual under the already reviewed delayed migration rules, but launch does not burn
  it and therefore preserves the exact 100 million genesis supply identity.

## Rejected alternatives

### Burn the residual at launch

Rejected because it would reduce initial total supply below 100 million and make the fixed allocation identity false.

### Over-settle or clear GBX into PoolManager

Rejected because the extra balance would not belong to a position. It would be unowned, irrecoverable custody
masquerading as protocol-owned liquidity.

### Hard-code the pinned-fork liquidity vector

Rejected because token ordering, actual community USDG, and the resulting aligned boundary are launch inputs. The
vector is not valid for every permitted settlement price.

### Search across position allocations until the aggregate happens to be exact

Rejected because no bounded, price-independent proof guarantees a solution. An unbounded onchain search could make a
valid funded launch un-settleable and would add disproportionate audit and gas risk for sub-wei-display dust.

### Retain the lower-precision periphery result without correction

Rejected because official core math proves that more safe liquidity fits. The replacement reduces the pinned residual
from 67,956,637 wei to the unavoidable 188,254 wei.

## Verification

- Unit tests assert position principal against official core delta math, per-position maximality, aggregate
  conservation, exact launch balance, approval revocation, residual preservation across fee collection/sweeping, and
  exact SDK-witness acceptance with neighboring-value rejection in both currency orders.
- Fuzz tests cover both token orderings, reversed square-root inputs, random valid tick ranges, and minimum/maximum
  tick boundaries. Every result proves `cost(L) <= cap` and `cost(L + 1) > cap` unless `L` is `uint128.max`.
- Stateful invariants continuously reconcile recorded principal, residual, PositionManager custody, and the fixed
  allocation.
- The pinned live fork asserts the four exact maximal liquidities and a 188,254 wei residual while preserving 100
  million total supply and zero post-seed approvals.
- Deployment rehearsal and the release verifier require principal plus residual to equal 20 million and require
  LiquidityManager's balance to equal the recorded residual. The release verifier also binds the recorded settlement
  receipt and calldata to the official-SDK witness recomputed from the finalized community amount.
