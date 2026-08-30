# Access control

> Development design only. No production roles or addresses are configured.

> ADRs 0031, 0034, 0047, 0048, 0054, and 0055 define the development authority model below. Governance execution remains
> an unselected external integration, so deployment is blocked.

The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. SignalGBX retains
non-transferable ERC20Votes checkpoints on the block-number clock for a future external governance integration, but the
core assigns those checkpoints no proposal, quorum, delay, cancellation, or execution semantics.

Mine and Resonance are the only core contracts with continuing custom owner authority after bootstrap. Mine exposes
exactly one such method:

- `Mine.setResonanceRouter`, which may change only the destination of future protocol-share deposits after validating
  the replacement Router/Resonance/SignalGBX graph against Mine's immutable GBX, USDG, and Fund.

Resonance's continuing protocol administration methods are:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeRewardToken`, within the fixed sixteen-token cap; and
- `Resonance.setBribeBps`, globally bounded from 0 through 2,000 basis points.

Resonance also has one setup-only owner action, `setResonanceRouter`, which the launcher consumes before handoff. It
permanently binds the only Router allowed to notify revenue and cannot replace or clear that binding later; it is not a
fifth continuing governance method.

Mine and Resonance use OpenZeppelin `Ownable2Step`: the current owner begins a transfer and the exact pending owner must
accept it. Before acceptance, the current owner may replace the pending owner or cancel the pending transfer by calling
`transferOwnership(address(0))`; the pending owner has no owner authority merely from being pending. Inherited
`renounceOwnership` remains immediate. Two-step ownership does not delay ordinary owner methods or protect against
malicious governance. The core no longer claims to enforce a selector-bounded proposal surface around these
capabilities. Neither owner can change mining replacement prices or their 80/20 outgoing-tenure-miner split, halving
parameters, the tail rate, GBX mint authority, Fund assets, or external liquidity.

SignalGBX, StrategyFactory, and BribeFactory retain plain `Ownable` for their one-time `setResonance` bindings. Once a
correct binding is consumed, those owners have no remaining custom protocol action, but each contract still exposes
inherited `owner`, `transferOwnership`, and `renounceOwnership`. Production handoff evidence must remove the temporary
owner from all three setup-only ownership shells. They do not use `Ownable2Step` because their intended terminal action
is immediate renunciation rather than transfer to continuing governance.

The acquired-asset Bribe share is one global prospective parameter, defaults to 1,000 basis points, and cannot exceed
2,000 basis points. Strategy snapshots the rate before interacting with the payment token, floors that purchase's
Bribe share, transfers the complement directly to Fund, and buffers only the Bribe share in BribeRouter. A change
affects only later purchases; already transferred Fund amounts, buffered Bribe tokens, reward schedules, and claims do
not change. There is no cumulative split carry, per-Strategy rate, or second Fund-share setter. At 0%, signal entry,
addition, removal, killed-Strategy exit, existing rewards, and independent Bribe funding remain permissionless and
live.

After the first Strategy is created, `killStrategy` reverts if it would remove the final live Strategy. The Resonance
owner must add a replacement before killing that Strategy. Whether those actions or a Bribe-rate transition can be
scheduled and batched atomically is an external-governance integration property that must be selected and tested
before deployment.

A canonical GBX launch uses one immutable `GBXLauncher.launchAuthority` only to call the one-shot
`launch(finalOwner)` entrypoint. That transaction deploys and binds the graph, registers exactly the GBX and seeded-LP
Strategies, renounces the consumed SignalGBX and factory ownership shells, and begins two-step transfers of Mine and
Resonance to `finalOwner`. The four component deployers are intentionally public and stateless; they retain no
authority, and an unrelated caller's outputs are not canonical GBX contracts. A successful launch leaves the launcher
with no protocol entrypoint that can exercise the formal Mine or Resonance ownership it retains until acceptance, and
cannot be repeated. In particular, it cannot use the ordinary current-owner cancellation path after launch. The exact
pending governance contract must separately accept both ownerships before public exposure.

Mine's `genesisAuthority` is a narrower deployment capability, not a continuing owner. It may select one contract
recipient for the fixed `1,000 ether` genesis-liquidity issue only after Mine is permanently bound as GBX's minter.
The amount cannot change, the call can succeed only once, and the authority is cleared before minting. The canonical
launcher is that authority and directs the issue only to the validated USDG/GBX Pair in the same atomic transaction.

The immutable launch authority and `finalOwner` must be fixed to exact reviewed addresses before any production
transaction. A code-presence check does not establish that `finalOwner` is safe governance. The provider, exact
release, deployed bytecode, plugins, voting rules, permissions, root/admin holders, upgrade paths, batching, delay,
cancellation, two-step acceptance compatibility, launcher/module provenance, and both ownership receipts all remain
unresolved release gates. No production launch or ownership handoff is authorized until they are reviewed and recorded.

GBX binds Mine once during deployment. SignalGBX, StrategyFactory, and BribeFactory bind one Resonance once. Fund is
ownerless. There are no proxies, pause switches, sweep methods, state-copy migrations, forced signal moves, or generic
executors in the core protocol contracts. Mine's validated Router setter is a prospective revenue cutover only: old
Router, Resonance, Strategy, Bribe, signal, stream, and balance state remains untouched and independently claimable or
removable through the old graph. The new graph's SignalGBX is a different voting-token address; any external governance
transition between old and new checkpoints is separately selected and reviewed.

Mining replacements, outgoing-tenure-miner claims, routing, `addSignal`, `addSignalMany`, `removeSignal`,
`removeSignalMany`, Strategy purchases, Bribe reward notifications, buffered paired-Bribe routing, Fund GBX burning,
and redemption are permissionless. Direct `Bribe.claimRewards(account)` and `claimReward(account, token)` calls instead
authorize only `account` or that Bribe's immutable Resonance and always pay `account`.
`Resonance.claimBribeRewards(strategies)` is permissionless only as a caller-owned convenience path: it always claims
for `msg.sender`, accepts registered live or killed Strategies, allows duplicates to execute sequentially, and reverts
the complete atomic batch on an empty or invalid array or a failed reward-token transfer. Direct scalar Bribe claims
remain the bounded gas and broken-token fallback. There is no standalone staking, unstaking, permit-consuming signal,
or public move surface.
Mine stops after a successful nominal `SafeERC20` transfer request to ResonanceRouter under the supported standard
USDG model. The later permissionless `route()` has no keeper role, bounty, or liveness guarantee and belongs to
optional manual, frontend, or cron execution. `RevenueDeposited` identifies which historical Router received each
deposit.
Resonance's signal hooks accept only SignalGBX, preventing a second user-facing or write-through coordinator. Wallet
batches must call SignalGBX directly so the wallet remains `msg.sender`. Permissionless
`BribeRouter.route()` can notify only its immutable paired Bribe with its immutable payment token and cannot
redirect the buffer.
