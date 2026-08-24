# ADR 0017: Remove successor migration and make Fund and LiquidityPosition ownerless

- Status: accepted as historical context; all `LiquidityPosition` provisions are superseded by ADR 0050
- Date: 2026-08-09
- Supersedes the migration provisions of [ADR 0013](0013-upstream-shaped-core-starting-point.md) and
  [ADR 0014](0014-fixed-distribution-and-v4-liquidity-position.md)
- Implements part of [ADR 0016](0016-governance-minimized-final-surface.md)

## Context

ADR 0016 recorded the intended final trust model and listed "successor migration" among the powers the deployed
protocol must not have. It also recorded that the implementation had not caught up: the Solidity, ABIs, SDK,
subgraph, and documentation still described a broader administrative and migration surface. AGENTS.md, meanwhile,
still required migration as mandatory behavior, so the two documents disagreed about the intended system.

Adversarial testing of the migration path also surfaced two concrete problems with keeping it:

1. `Fund.migrate` could not enforce its own documented uniqueness requirement. It called `_markToken` and
   `_clearToken` inside the same loop iteration, so a duplicate entry's mark was always erased before the next
   iteration could observe it, making the `DuplicateToken` guard unreachable. The impact was bounded — migration
   moved complete balances, so the repeated pass transferred nothing — but the guard was dead code.
2. Migration is permissionless once bound, so it races redemption. A migration landing first leaves a redeemer's
   transaction burning GBX and receiving nothing for the migrated asset, with the claim recoverable only against a
   successor Fund the redeemer never approved.

The owner has since set the project direction explicitly: maximum decentralization with minimal governance.

## Decision

Remove successor binding and migration entirely, from both contracts, and remove the ownership that existed only to
operate them.

`Fund` drops `successor`, `setSuccessor`, `migrate`, the `MIGRATION_NAMESPACE` transient namespace, the `SuccessorSet`
and `TokenMigrated` events, the `InvalidSuccessor`, `SuccessorAlreadySet`, and `SuccessorNotSet` errors, and its
`Ownable` inheritance and `initialOwner` constructor parameter. Redemption becomes the only path by which any asset
can leave Fund. Anyone may still burn GBX that Fund holds.

`LiquidityPosition` drops `successor`, `setSuccessor`, `migratePosition`, the `SuccessorSet` and `PositionMigrated`
events, the `IncompatibleSuccessor`, `SuccessorAlreadySet`, and `SuccessorNotSet` errors, its `Ownable` inheritance,
and the `initialOwner` field of its `Dependencies` struct. The `ILiquidityPosition` interface existed only to validate
a successor candidate and is deleted. Once the precommitted NFT is accepted it can never be transferred out.
Permissionless fee processing is unaffected and continues for the life of the contract.

At this decision point, `Resonance` was the only contract in the protocol with an owner. ADR 0024 later introduced
timelock-owned Mine administration for increase-only capacity. ADR 0021 removed `setBribeBps`; Resonance's remaining
surface is `addStrategy`, `killStrategy`, and `addBribeReward`.

## Consequences

- The protocol has no upgrade path, no migration, no recovery function, and no pause. Deployment errors and
  unforeseen failures are permanent. This is accepted deliberately, not overlooked.
- The canonical Uniswap v4 position is locked in `LiquidityPosition` forever. An incorrect genesis pool, range, or
  token ID cannot be corrected after the fact. The admission checks in `onERC721Received` run once, on receipt, and
  are the only defense; genesis parameters must therefore be verified before the NFT is delivered, not after.
- Assets sent to `Fund` that redeemers omit remain there for the remaining GBX supply indefinitely. There is no
  sweep, rescue, or administrative withdrawal, by design.
- The redemption-versus-migration race is gone, because migration is gone.
- Two failure modes previously mitigated by migration were tracked at this decision point: a frozen or blocklisting
  revenue token could block the then-current `reset`, `distributeAll`, and `updateStrategy` paths, and notifications
  below the then-current index resolution could enter Resonance without creating a claim. These selectors and risk
  descriptions are historical. [ADR 0020](0020-exact-carry-and-deferred-fixed-liabilities.md) replaced the transfer
  coupling with fixed pull liabilities; [ADR 0029](0029-bribe-based-resonance.md) later replaced the Resonance carry
  remedy with explicitly accepted flooring, zero-signal, and direct-donation surplus.
- Generated artifacts follow the contracts: SDK ABIs and the `buildMigrateLiquidityPosition` action, the
  `LiquidityPositionView.successor` reader field, subgraph handlers, manifest entries, spec coverage list, and schema
  fields for `fundSuccessor` and `liquidityPositionSuccessor` are all removed.
- Regression tests assert the removal directly rather than merely not exercising it: calling any removed selector
  reverts with empty returndata, which distinguishes a deleted function from an access-gated one.
