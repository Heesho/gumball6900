# Access control

> Development design only. No production roles or addresses are configured.

> ADRs 0031, 0034, 0047, and 0048 define the development authority model below. Governance execution remains an unselected
> external integration, so deployment is blocked.

The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. SignalGBX retains
non-transferable ERC20Votes checkpoints on the block-number clock for a future external governance integration, but the
core assigns those checkpoints no proposal, quorum, delay, cancellation, or execution semantics.

Resonance is the only core contract with continuing custom owner authority after bootstrap. After its one-time router
binding, its continuing protocol administration methods are:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeRewardToken`, within the fixed sixteen-token cap; and
- `Resonance.setBribeBps`, globally bounded from 0 through 2,000 basis points.

The Resonance owner can also call inherited `transferOwnership` and `renounceOwnership`; the core no longer claims to
enforce a selector-bounded proposal surface around those capabilities. Mine has no owner or administrative methods.
Resonance ownership cannot change mining replacement prices or their 80/20 outgoing-tenure-miner split, halving parameters,
the tail rate, GBX mint authority, Fund assets, or external liquidity.

SignalGBX, StrategyFactory, and BribeFactory also inherit Ownable for their one-time `setResonance` bindings. Once a
correct binding is consumed, those owners have no remaining custom protocol action, but each contract still exposes
inherited `owner`, `transferOwnership`, and `renounceOwnership`. Production handoff evidence must remove the temporary
owner from all three setup-only ownership shells as well as from Resonance.

The acquired-asset Bribe share is one global prospective parameter, defaults to 1,000 basis points, and cannot exceed
2,000 basis points. Strategy snapshots the rate before interacting with the payment token, floors that purchase's
Bribe share, transfers the complement directly to Fund, and buffers only the Bribe share in BribeRouter. A change
affects only later purchases; already transferred Fund amounts, buffered Bribe tokens, reward schedules, and claims do
not change. There is no cumulative split carry, per-Strategy rate, or second Fund-share setter. At 0%, signal entry,
movement, withdrawal, killed-Strategy exit, existing rewards, and independent Bribe funding remain permissionless and
live.

After the first Strategy is created, `killStrategy` reverts if it would remove the final live Strategy. The Resonance
owner must add a replacement before killing that Strategy. Whether those actions or a Bribe-rate transition can be
scheduled and batched atomically is an external-governance integration property that must be selected and tested
before deployment.

A production deployment must bootstrap every reviewed initial Strategy under a temporary setup owner, transfer
Resonance directly to the exact external governance executor selected by a later ADR, and renounce the consumed
SignalGBX and factory ownership shells. The provider, exact release, deployed bytecode, plugins, voting rules,
permissions, root/admin holders, upgrade paths, batching, delay, cancellation, and ownership receipts all remain
unresolved release gates. No production ownership handoff is authorized until they are reviewed and recorded.

GBX binds Mine once during deployment. SignalGBX, StrategyFactory, and BribeFactory bind Resonance once. Fund and Mine
are ownerless. There are no proxies, pause switches, sweep methods, successor bindings, migrations,
or generic executors in the core protocol contracts.

Mining replacements, outgoing-tenure-miner claims, routing, `signal`, `signalWithPermit`, `moveSignal`,
`withdrawSignal`, Strategy purchases, reward claims, buffered paired-Bribe routing, Fund GBX burning, and
redemption are permissionless. There is no standalone staking or unstaking surface.
Mine stops after a successful nominal `SafeERC20` transfer request to ResonanceRouter under the supported standard
USDG model. The later permissionless `route()` has no keeper role, bounty, or liveness guarantee and belongs to
optional manual, frontend, or cron execution.
Resonance's signal hooks accept only SignalGBX, preventing a second user-facing coordinator. Permissionless
`BribeRouter.route()` can notify only its immutable paired Bribe with its immutable payment token and cannot
redirect the buffer.
