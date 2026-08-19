# Access control

> Development design only. No production roles or addresses are configured.

> ADRs 0031, 0032, and 0034 define the development authority model below. Governance execution remains an unselected
> external integration, so deployment is blocked.

The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. SignalGBX retains
non-transferable ERC20Votes checkpoints on the block-number clock for a future external governance integration, but the
core assigns those checkpoints no proposal, quorum, delay, cancellation, or execution semantics.

Resonance is the only owned core contract. After its one-time router binding, its continuing protocol administration
methods are:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeReward`, within the fixed eight-token cap.

The Resonance owner can also call inherited `transferOwnership` and `renounceOwnership`; the core no longer claims to
enforce a selector-bounded proposal surface around those capabilities. Mine has no owner or administrative methods.
Resonance ownership cannot change mining prices, splits, halving parameters, the tail rate, GBX mint authority, Fund
assets, or liquidity custody.

The 90% Fund / 10% paired-Bribe acquired-asset split is immutable and exposes no setter. After the first Strategy is
created, `killStrategy` reverts if it would remove the final live Strategy. The Resonance owner must add a replacement
before killing that Strategy. Whether those actions can be batched atomically is an external-governance integration
property that must be selected and tested before deployment.

A production deployment must bootstrap every reviewed initial Strategy under a temporary setup owner, then transfer
Resonance directly to the exact external governance executor selected by a later ADR. The provider, exact release,
deployed bytecode, plugins, voting rules, permissions, root/admin holders, upgrade paths, batching, delay, cancellation,
and ownership receipt all remain unresolved release gates. No production ownership handoff is authorized until they are
reviewed and recorded.

GBX binds Mine once during deployment. SignalGBX, StrategyFactory, and BribeFactory bind Resonance once. Fund and
LiquidityPosition are ownerless. There are no proxies, pause switches, sweep methods, successor bindings, migrations,
or generic executors in the core protocol contracts.

Mining, displaced-miner claims, routing, `signal`, `signalWithPermit`, `moveSignal`,
`withdrawSignal`, Strategy purchases, reward claims, Fund-liability payment, paired-Bribe notification, liquidity fee
harvesting, Fund GBX burning, and redemption are permissionless. There is no standalone staking or unstaking surface.
Resonance's signal hooks accept only SignalGBX, preventing a second user-facing coordinator. Permissionless
`payFundPayment` and `notifyBribeReward` can settle only their immutable destinations and cannot redirect either
liability.
