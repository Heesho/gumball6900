# ADR-0006: Seventeen-Strategy Registry Bound

- Status: Accepted
- Date: 2026-08-01
- Decision owners: protocol engineering and security review
- Supersedes: the literal sixteen-entry bound for the complete strategy registry

## Context

The master specification fixes `MAX_ASSETS` and `MAX_USER_STRATEGIES` at sixteen and describes redemption budget
scaling as an acceptable O(n) loop because the strategy count is bounded to sixteen. The approved protocol topology
also gives every registered asset one asset-linked strategy and includes the buyback as a separate, signalable,
zero-manager-reward strategy whose target is not a redemption asset.

At the maximum basket size, those requirements produce seventeen registry entries:

```text
16 asset-linked strategies + 1 standalone buyback strategy = 17 live strategies
```

USDG's asset-linked entry is `HoldUSDGStrategy`; normal target assets use `AcquisitionStrategy`. The standalone
buyback cannot be attached to a redemption asset because it accepts and burns GBX rather than acquiring an asset for
GumBallVault. Restoring a sixteen-entry global registry bound would therefore make the specified buyback impossible
at the specified sixteen-asset maximum, or would silently reduce `MAX_ASSETS` to fifteen.

## Decision

`AssetRegistry.MAX_ASSETS` remains sixteen and `AllocationVoter.MAX_USER_STRATEGIES` remains sixteen.
`AssetRegistry.MAX_STRATEGIES` is seventeen so the bounded global strategy universe can contain one strategy for each
maximum-size basket asset plus the standalone buyback.

A user may signal at most sixteen strategies in one persistent allocation. This preserves the specified per-user
calldata, storage, and checkpoint bound; it does not require every user to signal every globally registered strategy.
Different users can select different subsets, and aggregate accounting may therefore have live weight across all
seventeen strategies.

Redemption checkpoints and scales every registered strategy budget across a maximum of seventeen entries. The loop
remains statically bounded and performs the same remaining-supply multiplication for every entry. No strategy receives
special rounding, ordering, or custody treatment.

## Invariant impact

- The basket remains bounded to sixteen registered redemption assets.
- For every redemption, all live virtual USDG budgets are scaled by the identical
  `(supplyBefore - shares) / supplyBefore` fraction, now across at most seventeen strategies.
- `sum(live strategy budgets) <= GumBallVault USDG balance` remains unchanged.
- User active plus pending signal weight remains bounded by sGBX, and one user still references at most sixteen
  strategies.
- The buyback remains signalable without consuming a redemption-asset slot and continues to pay no manager reward.
- The extra bounded entry introduces no new privileged role, arbitrary call, custody location, or mutable trust.

## Consequences

The worst-case redemption-budget loop has one more iteration than the literal specification text. This is a small,
fixed gas increase and preserves the safer topology: the asset cap, HoldUSDG allocation target, and standalone buyback
can all coexist without an unbounded registry or a public factory.

Registration authority is unchanged. Only the typed protocol timelock can register assets or a standalone strategy;
the exposure-only guardian can disable acquisition or buyback activity but cannot add entries, move funds, or stop
redemption.

## Rejected alternatives

### Count buyback as one of sixteen asset strategies

Rejected because a maximum-size sixteen-asset basket would have no registry slot for the required buyback.

### Reduce the asset maximum to fifteen

Rejected because the specification independently fixes `MAX_ASSETS` at sixteen and redemption is already safely
tested at that bound.

### Attach buyback to GBX or USDG as an asset-linked strategy

Rejected because buyback has different direction, burn, reward, and registry semantics. Treating GBX as a vault
redemption asset would also create circular backing.

### Remove the per-user sixteen-strategy limit

Rejected because no user must signal the complete global set. Keeping the specified user bound limits calldata,
storage, duplicate checks, and checkpoint work without changing aggregate allocation correctness.

## Verification

- `AssetRegistry.t.sol` proves the basket asset enumeration stops at sixteen and the standalone strategy lifecycle is
  separate from redemption assets.
- `AllocationVoter.t.sol::test_ActivatesMaximumSixteenStrategySignal` proves one user can activate the complete
  permitted per-user set.
- `AllocationVoter.t.sol::test_ScalesEveryBudgetAtMaximumSeventeenStrategies` activates weight on seventeen registry
  entries, allocates revenue across all of them, redeems a fraction, and proves every budget and aggregate accounted
  USDG value scales exactly.
- `GumBallVault.t.sol::test_RedeemsMaximumSixteenRegisteredAssets` proves the independent maximum basket loop and
  pre-burn redemption denominator.
- Stateful invariants continuously assert budget solvency, signal-weight conservation, and identical pro-rata
  redemption accounting across the registered basket.
