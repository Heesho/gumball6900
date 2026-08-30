# Architecture

The target graph is direct, immutable, and deliberately small.

> Development architecture: ADRs 0031 and 0033-0055 are authoritative in whole or in their recorded unsuperseded
> parts. Governance execution remains an
> unselected external integration, so this document is not deployment approval or evidence of a complete production
> graph.

```text
nonempty replacement USDG -> Mine --20% deposit--> ResonanceRouter --permissionless route()--> Resonance
                                       \--80%--> outgoing tenure miner claim           \--7-day stream--> Strategy
empty-slot payment ------------------> Mine --100% deposit--> ResonanceRouter

Mine --continuous GBX--> current slot miners
GBX --signal deposit--> SignalGBX --signal coordination--> Resonance allocation weights
                                  \--IVotes checkpoints---> external governance (unselected) --owns--> Mine + Resonance
Strategy acquired-asset payment --(100% - global bribeBps)--> Fund
                                \--global bribeBps (0%-20%)--> BribeRouter buffer --> paired Bribe
additional reward funder ------------------------------> Bribe -> Strategy signalers
GBXLauncher --fixed 1 USDG + 1,000 GBX--> V2 pair --all genesis LP--> address(0)
GBX / actual USDG-GBX LP -> two initial Strategies -> Fund / paired Bribes
GBX holder -> Fund.redeem(selected tokens) -> in-kind assets
governance --validated future-revenue switch--> replacement ResonanceRouter / Resonance graph
```

The core keeps custody and accounting invariants inside the contracts that own them, while optional transaction
composition and liveness automation stay in periphery. In particular, a paid Mine replacement transfers its nominal
protocol share into ResonanceRouter through `SafeERC20` under the standard-USDG assumption and then ends.
`Mine.RevenueDeposited` records that requested deposit and the Router that received it only. A manual caller, frontend,
volunteer keeper, or cron process may later call the permissionless `route()` function; there is no role, bounty, or
guaranteed caller, so even a qualifying balance may wait indefinitely. A future frontend-facing helper could compose
`mine()` and `route()`, but Mine correctness and replacement liveness must never depend on that optional call succeeding.

GBX starts with zero supply and zero lifetime minted when its constructor returns. Its setup minter cannot mint before a
one-time deployment binding permanently assigns all lifetime mint authority to a Mine that identifies the same GBX. A
Mine constructed with a zero genesis authority can never use the genesis path. During the canonical launch, Mine instead
accepts the launcher as that narrow authority and, only after binding, mints the fixed 1,000 GBX genesis amount to the
validated pair exactly once. The mint clears the authority. Mine has exactly sixteen hourly reverse-Dutch slots. Each
occupied slot keeps its TPS until replacement; each newly opened tenure receives the current global TPS divided by
sixteen. Mine is non-upgradeable and its owner cannot alter that accounting. Its only custom owner action changes the
Router for future protocol-share deposits after validating a reciprocally bound replacement graph with the same GBX,
USDG, and Fund.

`GBXLauncher` is GBX-specific, authorized, and single-use. Four predeployed stateless component deployers divide the
constructor graph so each runtime stays below EIP-170; they have no owner, storage, or authority over their outputs and
are not continuing protocol factories. Each module derives caller-scoped CREATE2 salts as
`keccak256(abi.encode(msg.sender, contractDomain))`, so an unrelated caller cannot consume or shift the launcher's
canonical outputs. One `launch` call deploys the graph, completes reciprocal bindings, seeds the canonical pair,
registers both initial Strategies, removes setup owners, begins two-step Mine and Resonance transfers, and checks the
final state. EVM atomicity reverts every deployment and token movement if any step fails. The pending governance
contract accepts both ownerships afterward. Until acceptance, the single-use launcher is the formal owner but exposes
no post-launch path that can exercise either authority.

Fund reads Mine's constant-time effective supply before its redemption snapshot. Pending GBX is included in the
denominator without minting it, iterating slots, or changing mining state.

SignalGBX is a non-transferable one-for-one GBX escrow token, retains ERC20Votes checkpoints for a future external
governance integration, and is the only external signal coordinator. Idle sGBX is invalid. Scalar `addSignal` and
`removeSignal` provide bounded one-Strategy entry and exit. `addSignalMany` and `removeSignalMany` apply optional
caller-supplied arrays while transferring/minting or burning/returning the aggregate once. Every allocation still
passes through Resonance's restricted add/remove hook and paired Bribe, and any failure reverts the complete batch.
There is no permit-consuming signal path, public move, dedicated Resonance move hook, or shared write-through Router.
Smart wallets may batch approvals and direct SignalGBX calls while retaining caller identity. sGBX itself has no
ERC-2612 approval permit.

Resonance holds forwarded USDG in one scalar global seven-day stream, with no reward-token registry or token-keyed
revenue state, and uses unrestricted absolute SignalGBX allocations for
each elapsed interval. SignalGBX calls Resonance's restricted coordination hooks, which checkpoint elapsed revenue
before changing weights. A Strategy purchase also
checkpoints and pulls its released allocation before reading the auction inventory. During an active period,
ResonanceRouter holds a nonzero balance until it is at least both `REWARD_DURATION` raw USDG units and
`remainingRevenue()` at the active rate. A qualifying complete-balance notification checkpoints elapsed emission, combines the new revenue
with `remainingSeconds * revenueRate`, and restarts the schedule for seven days. The Synthetix-style rate uses ordinary
integer division; rate, index, and Strategy floors, zero-active-signal emission, and direct donations remain
unclassified surplus. The revenue-per-signal index uses `1e36` precision.

Signal state is deliberately split rather than duplicated: `SignalGBX.balanceOf(account)` is each account's aggregate
signal, the paired Bribe stores `signalWeightOf(account)` and its complete `totalSignalWeight`, and Resonance stores
the active total across live Strategies. There is no separate `allocatedBalance` duplicate.

`SignalPortfolioLens` is optional stateless read periphery over an explicit Strategy list. The subgraph's nonzero
account-by-Strategy positions help discover that list. Neither surface is authoritative for writes: clients refresh
canonical Bribe balances and Strategy status onchain, and write helpers target SignalGBX directly.

StrategyFactory and BribeFactory are bound once to Resonance. Each Strategy has a dedicated Bribe and BribeRouter.
Resonance stores one global acquired-asset `bribeBps`, defaulting to 10% and bounded from 0% through 20%. Before token
interaction, Strategy snapshots that rate, transfers the floored Bribe share to its BribeRouter, and pays the
complement directly to Fund. There is no cumulative split carry or deferred Fund liability. At 0%, new payments go
entirely to Fund, while Bribe balance accounting, signals, exits, existing rewards, and independent reward funding
remain live. BribeRouter simply buffers the Bribe share until its complete balance satisfies the Bribe's minimum and
active-left notification gates. Bribes use ordinary Synthetix rollover and floor semantics, with no queue, pause,
carry, or Fund rounding state. Each Bribe has a fixed append-only limit of sixteen reward tokens. They retain `1e36`
reward precision, and each
reward token has a monotonic lifetime notification cap of `floor(type(uint256).max / 1e36)` raw units, checked
before checkpointing or transfer so index overflow cannot block signal exits. Killing a Strategy checkpoints and
preserves its accrued Resonance claim, removes its complete weight from active revenue allocation, and leaves its Bribe as a
closed pool for existing signalers; no new signal can enter, and a final exit can permanently abandon unfinished
rewards. After bootstrap, the final live Strategy cannot be killed until a replacement has been added, while killed-
Strategy positions remain removable through either scalar or batched exit. Reallocation uses direct removal followed
by addition to a live Strategy.

Fund is an ownerless raw-token treasury with caller-selected redemption arrays and no registry or migration path. The
one-shot launcher is pinned to Robinhood Chain mainnet and the reviewed Uniswap V2 Factory. It always creates a new
USDG/GBX pair and directly seeds it with exactly `1e6` raw six-decimal USDG and `1,000 ether` GBX, producing
`31,622,776,601,683` raw LP supply. The pair's minimum liquidity and all returned provider LP are minted to
`address(0)`, permanently locking the complete genesis supply. The Router address is recorded for clients but is not
called during genesis. The launcher never adopts or skims an existing Pair. If the Factory lookup is already nonzero,
the transaction reverts with `PairAlreadyExists`; a fresh launcher produces a different deterministic GBX and Pair through the
modules' caller-scoped CREATE2 salts.

While still temporary owner, the launcher registers GBX first at an initial and next-epoch minimum price of
`100,000 ether`, then the actual LP at `50 * pair.totalSupply()`. Both use 24-hour decay and a `1.2e18` multiplier.
Because the first auction epoch begins at Strategy deployment, first inventory that arrives only after the complete
decay can be filled for zero; the configured minimum controls the next epoch's start, not the current fill floor. Only
genesis LP is locked. Later LP remains transferable, follows the ordinary Fund/Bribe split, and is caller-selectable in
Fund redemption. The continuing core does not rebalance, harvest, swap, price, or guarantee liquidity.

The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. Resonance retains
the signal-and-acquisition administration methods `addStrategy`, `killStrategy`, `addBribeRewardToken`, and bounded
global `setBribeBps`. Mine separately retains only `setResonanceRouter`. Both use `Ownable2Step`, including
two-step transfer and immediate renunciation. Resonance's own setup-only `setResonanceRouter` is consumed before
handoff and cannot replace the bound Router later. SignalGBX, StrategyFactory, and BribeFactory retain setup-only plain-
`Ownable` shells after their one-time bindings. The canonical launch renounces those three consumed ownership shells
and makes the passed deployed governance contract pending owner of Mine and Resonance; governance must accept both
afterward. A production setup must pass the exact external governance executor selected by a later ADR. That
integration's release, permissions, voting
rules, administrators, upgrade model, batching, delay, and cancellation semantics remain unselected, so deployment is
blocked.

A Mine Router update is deliberately not a state migration. Governance deploys and binds a complete replacement
Router/Resonance/SignalGBX graph around the same GBX, USDG, and Fund, verifies its exact bytecode and identities, and
switches Mine last. Only later Mine deposits use the new Router. Old Router balances, Resonance schedules, Strategy
claims, Bribe rewards, and signal positions stay in the old graph; users claim and unsignal there before optionally
signaling returned GBX into the new graph. Permissionless routing and exits remain graph-local. The replacement uses a
new SignalGBX address, so any external governance tied to old SignalGBX checkpoints needs a separately reviewed voting-
token transition; Mine changes no governance configuration.

See [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), [ADR 0024](adr/0024-immutable-multislot-mine.md),
[ADR 0027](adr/0027-bribe-carry-boundaries.md), [ADR 0028](adr/0028-closed-bribe-pools-after-strategy-death.md),
[ADR 0029](adr/0029-bribe-based-resonance.md),
[ADR 0030](adr/0030-signalgbx-coordination-and-token-governance.md),
[ADR 0031](adr/0031-mandatory-signal-backed-signalgbx.md),
[ADR 0032](adr/0032-fixed-90-10-acquired-asset-settlement.md),
[ADR 0033](adr/0033-fixed-mine-slots-and-constant-time-pending-emission.md),
[ADR 0034](adr/0034-external-governance-ownership.md),
[ADR 0035](adr/0035-bribe-lifetime-reward-cap.md),
[ADR 0036](adr/0036-governed-global-bribe-share.md),
[ADR 0037](adr/0037-high-precision-bribe-index.md),
[ADR 0038](adr/0038-fixed-mine-economics.md),
[ADR 0039](adr/0039-event-only-mine-messages.md),
[ADR 0040](adr/0040-deployment-time-mine-authority-verification.md),
[ADR 0041](adr/0041-time-based-mine-halvings.md),
[ADR 0042](adr/0042-provisional-accelerated-mine-emissions.md),
[ADR 0043](adr/0043-provisional-one-gbx-tail.md),
[ADR 0044](adr/0044-decouple-mine-from-revenue-routing.md),
[ADR 0045](adr/0045-defer-mine-router-token-verification.md),
[ADR 0046](adr/0046-usdg-only-resonance-accounting.md),
[ADR 0047](adr/0047-synthetix-shaped-rewards-and-strategy-settlement.md),
[ADR 0048](adr/0048-expand-bribe-rewards-and-compose-signal-moves.md),
[ADR 0049](adr/0049-trust-canonical-token-transfers.md),
[ADR 0050](adr/0050-zero-premint-and-external-lp-strategy.md),
[ADR 0051](adr/0051-scalar-and-batched-signal-entrypoints.md),
[ADR 0052](adr/0052-resonance-lifetime-revenue-cap.md),
[ADR 0053](adr/0053-beneficiary-authorized-bribe-claims.md),
[ADR 0054](adr/0054-atomic-gbx-launch-and-genesis-v2-liquidity.md), and
[ADR 0055](adr/0055-governed-mine-revenue-router-migration.md).
