# Static-analysis finding register

## Adversarial test campaign — 2026-08-09

This section records findings from an internal adversarial test campaign against the core graph: 330 new Foundry
tests covering unit behavior, property fuzzing, and stateful invariants, plus the Echidna and Medusa state-machine
harness at `audit/harness/ProtocolStateMachineCampaign.sol`. Every finding below is reproduced by a named regression
test, so the recorded behavior cannot change silently.

> **Owner direction — 2026-08-09.** The project now targets **maximum decentralization with minimal governance**.
> Successor binding and migration were removed outright from `Fund` and `LiquidityPosition`, and both contracts are
> ownerless; see [ADR 0017](../../../docs/adr/0017-remove-successor-migration.md). This closes A-01 below and
> deliberately forecloses migration as a mitigation for A-03 and A-04. Those two are accepted as open, unmitigated
> consequences of immutability rather than defects awaiting a governance escape hatch.
>
> **Owner direction — 2026-08-09.** The canonical position now auto-compounds instead of routing its fees; see
> [ADR 0018](../../../docs/adr/0018-auto-compounding-liquidity-position.md). A-06 and A-07 below record the new
> surface and the accepted economic consequence.

This is internal engineering evidence, not an independent audit or a release approval. Five findings remain open,
plus two unresolved design questions recorded at the end of this section.

### A-01 — Resolved by removal — `Fund.migrate` could not enforce its own uniqueness requirement

`Fund.migrate` called `_markToken` and `_clearToken` inside the same loop iteration, so the transient mark set for a
token was always erased before the next iteration could read it. The `DuplicateToken` guard was therefore unreachable
from `migrate`, and the natspec promised a uniqueness property the function did not enforce. `redeem` was unaffected:
it marks every token in a first pass and only clears during a second pass, which is why redemption did reject
duplicates.

Impact was bounded. Migration moved complete balances, so a repeated pass observed a zero balance and transferred
nothing; the observable consequences were a duplicated zero-amount `TokenMigrated` event and wasted gas, not a loss of
assets. A second, independent concern was that permissionless migration raced redemption: a migration landing first
left a redeemer burning GBX and receiving nothing for the migrated asset.

**Disposition: resolved by removing the function.** `setSuccessor` and `migrate` no longer exist, and `Fund` is
ownerless. `test_FundHasNoAdministrativeSurfaceLeft` and `test_RedemptionIsTheOnlyWayAssetsCanEverLeaveFund` assert
that every removed selector reverts with empty returndata, which distinguishes a deleted function from a gated one.

### A-02 — Open — revenue below the index resolution is silently absorbed by Resonance

`Resonance.notifyRevenue` computes `indexDelta = amount * INDEX_PRECISION / totalSignalWeight` and only advances
`revenueIndex` when that value is nonzero. Because signal weight carries eighteen decimals and USDG carries six, the
delta floors to zero for every notification below `totalSignalWeight / 1e18` raw units — that is, below
`staked GBX / 1e12` USDG. At 100,000,000 GBX signaled, the threshold is 100 USDG.

Below that threshold the USDG is pulled into `Resonance`, no index moves, no `claimableRevenue` is created, and
nothing reverts. The amount is unreachable afterwards: `claimableRevenue` derives entirely from the index, which never
accounted for it. Repeated sub-threshold notifications do not aggregate; each is absorbed independently.
`test_SubThresholdRevenueNeverAccumulatesIntoAClaim` routes twenty separate 50 USDG notifications and shows 1,000 USDG
absorbed with the index still at zero.

This is reachable through normal operation: `Fundraiser.MIN_CONTRIBUTION` is 10,000 raw units (0.01 USDG), and each
contribution is routed individually in its own transaction, so small contributions are absorbed whole once signal
weight is large.

Candidate remediations, none applied: raise `INDEX_PRECISION`; carry the sub-threshold remainder forward in storage
and add it to the next notification; or revert when `indexDelta` is zero so the caller can batch instead. The first
two preserve permissionless routing; the third turns silent absorption into a visible failure.

### A-03 — Open — reward streams strand value at low decimals and at zero signal weight

Two independent rounding and accounting behaviors in `Bribe` permanently strand reward tokens.

`notifyRewardAmount` sets `rewardRate = amount / REWARD_DURATION` with `REWARD_DURATION` at 604,800 seconds. The
remainder is never distributed and never rescheduled. For eighteen-decimal tokens this is dust, but for six-decimal
USDG it is material: a 7.00 USDG stream strands 347,200 units, 4.96% of itself, and the smallest amount `BribeRouter`
will forward can strand up to nearly half. `test_LowDecimalRewardTokensLoseTheEntireRateRemainder` and
`test_TheWorstCaseRateFlooringLossIsAlmostHalfOfTheStream` pin both figures.

Separately, `rewardPerToken` cannot advance while `totalSupply` is zero, but the `updateReward` modifier still moves
`lastUpdateTime` forward. Any interval during which a Strategy has no signalers is therefore skipped by the accrual
index and never re-enters accounting. `test_RewardsElapsingWithZeroSignalWeightAreStrandedForever` withdraws all
weight for three days of a seven-day stream and shows three sevenths of the stream permanently unreachable, including
proof that a later `notifyRewardAmount` does not reschedule the stranded balance.

Neither behavior over-distributes or threatens solvency — the invariant suite proves every Bribe stays solvent against
accrued rewards across 500,000 handler calls — but both permanently reduce what signalers receive.

Candidate remediations, none applied: track and re-roll the rate remainder into the next stream; extend
`periodFinish` by the zero-supply interval instead of skipping it; or accept and document the loss and require
`BribeRouter` to forward only amounts large enough to make it negligible.

### A-04 — Open — a revenue token that can block transfers to Fund blocks exit from a retired Strategy

`Resonance._updateStrategy` routes a dead Strategy's share of newly indexed revenue to `Fund` with a direct transfer.
`_reset` checkpoints every Strategy an account selected before clearing its weight, so if that transfer reverts,
`reset` reverts. `accountSignalWeight` then stays nonzero, `SignalGBX.unstake` stays blocked, and the account's staked
GBX is unreachable. The same failure also bricks `distributeAll` and `updateStrategy` for every Strategy in the
registry, not only the retired one.

`test_AFrozenFundPermanentlyBlocksExitFromARetiredStrategy` reproduces the complete lock and shows the exit reopening
only when the transfer can succeed again, so the lock lasts exactly as long as the block does. This requires a
Strategy to have been retired while it still holds signal weight, and new revenue to arrive afterwards.

The dependency is not hypothetical: USDG (Global Dollar) is an administered stablecoin whose issuer can freeze
addresses. A freeze on `Fund` would produce this state.

Candidate remediations, none applied: make the dead-Strategy payout pull-based, accruing to a claimable balance that
anyone can later push to `Fund`, instead of transferring inline; or drop dead-Strategy weight from
`totalSignalWeight` at `killStrategy` so no later checkpoint has anything to route. Note that removing migration
(ADR 0017) removes the previously available escape hatch of migrating `Fund`, which makes remediation more important
rather than less.

### A-05 — Accepted by design — a single late auction fill collapses the price to its floor

`Strategy._nextInitialPrice` derives the next epoch's starting price from the completed payment, floored at
`minimumPrice`. A buyer who waits for full decay pays nothing, so the next auction starts at `minimumPrice`. With
`ABSOLUTE_MINIMUM_PRICE` at 1e6, that is dust for an eighteen-decimal payment asset, and recovery is only geometric:
`test_RecoveryFromTheFloorIsOnlyGeometric` measures more than sixty consecutive best-case full-price fills before the
original level is restored.

**Disposition: by design, per the protocol owner.** This is inherent to a reverse Dutch auction that resets from the
clearing price. The operational consequence is that `minimumPrice` is the only defense and must be chosen with the
payment asset's decimals and expected revenue in mind at Strategy creation; `ABSOLUTE_MINIMUM_PRICE` is a sanity bound,
not a sensible default. `test_OneLateFillCollapsesTheAuctionToItsFloor` documents the behavior so it stays visible.

### A-06 — Open — a compounding caller can time the increase to their own advantage

`LiquidityPosition.compound` requires a fixed 20 basis points of liquidity growth. Liquidity `L` is price-invariant,
but the token mix required to add a given `ΔL` is not: near the low end of the range the increase is paid mostly in
`currency0`, near the high end mostly in `currency1`. A caller therefore chooses the moment, and the composition, at
which they buy their 0.20%.

A caller can go further and nudge the price toward the composition they prefer before compounding in the same
transaction, then let it revert. Their edge is bounded by the position's range width and offset by the swap fees and
slippage of moving the price, so it is expected to be small for a narrow range and to grow with a wide one. It is not
mitigated in the contract, and it is not mitigable without an oracle or a swap, both of which the mechanism
deliberately excludes.

The consequence is a slightly cheaper 0.20% for a sophisticated caller, not a loss of position value: liquidity still
grows by exactly the requirement, and `test_LiquidityIsMonotonicallyNonDecreasing` proves principal is never removed.
Range width at deployment is the only lever.

### A-07 — Accepted by design — liquidity fees are no longer protocol revenue

Under [ADR 0018](../../../docs/adr/0018-auto-compounding-liquidity-position.md) the canonical position's fees fund
the compounding incentive in full. They no longer burn GBX and no longer reach `ResonanceRouter`, so Fundraiser
contributions are the only USDG revenue source for Resonance.

**Disposition: accepted by the protocol owner on 2026-08-09** as the cost of a permanently locked, self-growing
liquidity base. Recorded here so the economic trade-off is not rediscovered as a defect: a reviewer comparing the
contracts against older economic material will find the burn-and-route path missing, and that is intentional.

Note the interaction with A-02. That finding concerns revenue too small to move Resonance's index; with liquidity
fees no longer routed, every unit of Resonance revenue now originates from Fundraiser contributions, whose minimum is
10,000 raw USDG units. The absorption threshold is unchanged, but the flow it applies to is now narrower.

### A-08 — Open — registering a third Bribe reward token inverts the signal/reset gas cost

Leaving a signal position is not symmetric with entering it, and past a threshold the exit becomes the more expensive
side. This matters more than an ordinary gas observation because the exit path is the only way a staker recovers their
GBX, and ADR 0017 removed every rescue mechanism, so an exit that cannot complete is permanent.

**Mechanism.** `Resonance._reset` calls `Bribe.withdraw` for every Strategy the account signaled to, and `withdraw`
carries the `updateReward(account)` modifier, which loops every registered reward token. Two opposing effects:

- Per Strategy, reset is roughly 63,000 gas **cheaper** than signal. Signal pays cold zero-to-nonzero writes for
  `_accountStrategies.push`, `accountSignals`, `strategySignalWeight`, and the Bribe's `totalSupply` and `balanceOf`;
  reset zeroes them and collects the refunds.
- Per reward token, reset is roughly 42,000 gas **more expensive**. Entering, `rewards[account][token]` and
  `userRewardPerTokenPaid` are zero-to-zero and nearly free because `balanceOf[account]` is still zero when the
  modifier runs. Leaving, `earned()` is nonzero, so both become cold zero-to-nonzero writes.

**Measurements** (Foundry, this repository, `optimizer_runs = 10_000`):

| Configuration                                   | signal    | reset     | reset ÷ signal |
| ----------------------------------------------- | --------- | --------- | -------------- |
| 20 Strategies, 1 reward token each (as shipped) | 2,722,271 | 1,458,354 | 0.54           |
| 60 Strategies, 1 reward token each (as shipped) | 8,025,991 | 4,370,554 | 0.54           |
| 1 Strategy, 21 reward tokens                    | 539,312   | 1,325,019 | 2.46           |

Per Strategy in the shipped configuration: signal ≈ 136,000, reset ≈ 73,000. Each additional reward token adds
≈ 20,000 to signal and ≈ 63,000 to reset. The crossover is at **three total reward tokens per Bribe**; at two, reset
is still cheaper.

**Current exposure is nil.** As shipped, every Bribe has exactly one reward token, registered at Strategy creation.
Reset is roughly half the cost of signal, and the ratio is flat in the number of Strategies, so in a 30,000,000 gas
block an account can signal to about 220 Strategies but reset about 410. An account therefore cannot signal its way
into a position it cannot leave: if entry fit, exit fits, with roughly 2x headroom.

**The exposure is created solely by `Resonance.addBribeReward`.** It is `onlyOwner` behind the timelock, so this is a
trust-model gap rather than a permissionless attack, but the protocol's stated direction is that user funds cannot be
trapped regardless of how governance behaves. Aggravating factors, all confirmed by reading the source:

- `_reset` is atomic over all of an account's Strategies. There is no bounded variant, even though `distributeRange`
  exists for exactly this reason on the distribution loop.
- `reset()` acts on `msg.sender` only. No third party can reset on an account's behalf or pay its gas.
- sGBX is non-transferable, so a trapped account cannot sell its way out.
- `Bribe._rewardTokens` is append-only. There is no removal function, so the cost only ever rises.
- The exit price is not fixed when the account signals. Reward tokens registered afterwards raise it while the account
  is already committed.

**Remediation options considered, none applied.** These solve the problem at different costs and are not exclusive:

1. **Bound the reward tokens.** A `MAX_REWARD_TOKENS` constant in `Bribe.addRewardToken`, set to 2, keeps reset
   cheaper than signal by construction and forever. One line, no new governance surface. Removing
   `Resonance.addBribeReward` entirely, and making the reward token immutable in the Bribe constructor, is the
   stronger version: it deletes the array, reduces `updateReward` to constant work, and drops Resonance's
   administrative surface from four actions to three.
2. **Rework the accrual accounting.** Decouple weight accounting from reward accrual: record token-agnostic
   weight-change checkpoints and compute per-token rewards lazily at claim time. Exit then costs `O(strategies)`
   regardless of token count, and the per-token expense moves to `claim`, which is optional and non-trapping. This is
   architecturally the cleanest answer and the only one that supports many reward tokens, but it is a rewrite of the
   protocol's subtlest math and adds storage and lookup complexity. Only worth it if multi-token rewards are wanted.
3. **Add `resetRange(start, end)`**, mirroring `distributeRange`. This does not reduce the cost; it removes the cliff,
   so however expensive reset becomes, an account can always make progress across several transactions. Safe by
   construction because `SignalGBX.unstake` requires `accountSignalWeight == 0`, so a partial reset simply defers
   withdrawal until the account finishes.

Options 1 and 3 together give a provable liveness property — the exit path can always be completed in bounded steps —
without touching the accrual math before an independent audit. The suggested regression tests are a gas assertion that
reset per Strategy stays below signal per Strategy in the shipped configuration, and a stateful invariant that every
actor can always fully reset and unstake after any action sequence.

### Open design questions — 2026-08-09

Recorded so later sessions can pick these up with the context intact. Neither is a defect; both are unresolved
decisions that interact with A-08.

- **Should multi-token Bribe rewards exist at all?** The owner raised removing `addBribeReward` so that a signaler
  only ever earns the asset of the Strategy they signaled for, then paused the decision. Removing it eliminates A-08
  structurally and makes option 2 above unnecessary. The cost is that a third party cannot incentivize a Strategy in
  its own token, though `Bribe.notifyRewardAmount` is already permissionless for the registered payment token, so
  outside incentives survive denominated in the asset the Strategy actually buys. The deciding question is whether
  multi-token rewards are a wanted product capability; if they are not, option 1 is strictly better than option 2.
- **Should `Bribe` be renamed?** The term is inherited from the Curve and Velodrome vernacular and carries an
  unhelpful connotation. If multi-token rewards are removed, it also becomes inaccurate: the payout is a signaler's
  share of the payments made to the Strategy they backed, not a payment to vote. The codebase already uses an
  acoustic vocabulary (Resonance, Signal, sGBX), so a name from that family fits. Any rename touches `Bribe`,
  `BribeFactory`, `BribeRouter`, `IBribe`, `bribeBps`, `DEFAULT_BRIBE_BPS`, `MAX_BRIBE_BPS`, `bribeFor`,
  `bribeRouterFor`, the `BribeBpsSet` and `BribeRewardAdded` events, the subgraph, the SDK, the docs, and the name
  list AGENTS.md pins. ADR 0015 is precedent for recording a terminology change. Sequence the mechanism decision
  first: renaming something that is about to be redesigned is wasted churn.

### Adversarial campaign evidence

- 329 Foundry tests under the default profile plus 6 harness-profile tests, all passing under `FOUNDRY_PROFILE=ci`.
- 22 stateful invariants at 1,000 runs and depth 500 each: 11,000,000 handler calls with zero reverts under
  `fail_on_revert = true`. The handler is guarded so that any revert is a genuine finding, and
  `test_EveryHandlerActionIsReachable` proves no handler action is dead code that always short-circuits.
- Reentrancy was attacked across `Fund.redeem`, `Strategy.buy`, and `LiquidityPosition.collectFees` with a token that
  calls back into the protocol mid-transfer. Same-contract reentry is rejected by the guards; cross-contract reentry
  during acquisition settlement is reachable but harmless, because `Strategy.buy` snapshots the revenue balance before
  pulling payment, so injected revenue funds the next epoch instead of the current buyer.
- The complete 99,884-epoch emission schedule was replayed step by step and fits inside the 980,000,000 GBX Fundraiser
  allocation while using at least 99.9% of it.
- Fee-on-transfer, missing-return, returns-false, blocklisting, and reentrant token behaviors are covered as
  fail-closed evidence only. Supporting non-standard tokens remains a non-objective.
- Echidna and Medusa were not executed for this campaign; neither binary is available in the local toolchain. The
  harness they target is exercised under Foundry instead through `pnpm --filter @gumball-6900/contracts test:harness`,
  which asserts all nineteen `echidna_` properties across seeded and randomized action sequences.

## Current minimal graph internal audit — 2026-08-03

This section reviews the exact dirty working tree on `codex/minimal-gbx-rebuild` at base commit
`04559b9308c8b7933a13a7f68e0b1894a7667997`. It covers all 26 Solidity source units under `src` (2,813 physical
lines; 2,064 Aderyn SLOC), the minimal deployment script, and their active Foundry/Hardhat build graph. The economic
review assumes every protocol token is a standard, non-rebasing, non-fee-on-transfer ERC-20, as specified by the
protocol owner. Adversarial token tests are retained only as fail-closed evidence; supporting those token types is not
an objective.

This is an internal engineering review, not an independent audit or a release approval. Three findings remain open:

> **Owner decision — 2026-08-03.** Proceed with the deliberately minimal contract graph as the audit candidate while
> M-01, L-01, and I-01 remain explicitly deferred and open. This decision freezes the simpler architecture for further
> review; it does not accept the findings for production, authorize deployment, or waive the independent audit and
> release gates.

### M-01 — Open — timelock disablement does not bind the registry to its canonical voter

`ProtocolTimelock.scheduleStrategyDisablement` and `executeStrategyDisablement` accept any code-bearing registry and
voter pair. A proposer can therefore schedule the canonical registry together with a substituted voter. Execution
terminally disables the strategy in the canonical registry and sets the disabled bit only in the substituted voter.
The canonical voter remains in its live-callback mode. A later correct timelock operation cannot repair the split
because the registry disable repeats and reverts; the guardian also rejects the now-non-live strategy before reaching
the voter.

If the admitted rewards hook is faulty, reverting, or gas-burning, users can consequently remain unable to reset the
affected signal and unstake even though the registry reports the strategy terminally disabled. This violates the
documented terminal-disablement exit fallback. Exploitation requires a mistaken or compromised trusted proposer and
survives a seven-day visible delay; an untrusted executor cannot substitute parameters for an already scheduled
operation. The regression `test_AuditProof_StrategyDisablementDoesNotBindTheRegistryToTheCanonicalVoter` reproduces
the irreparable split.

Recommended remediation: one-time bind the canonical registry/voter pair in the timelock, or at minimum validate at
both scheduling and execution that the voter's immutable registry is the supplied registry and that both targets are
controlled by this timelock. After remediation, invert the regression so every substituted pair reverts before either
terminal bit changes.

### L-01 — Open — selecting MiningPool as the team recipient strands every future team fee

`MiningPool.setTeamAddress` permits `address(this)`. With the specified standard ERC-20 semantics, settlement's
`USDG.safeTransfer(address(this), teamFee)` succeeds without changing the pool balance. Settlement then sends only the
98% net amount to the vault and records the 2% fee as paid. The retained fee has no claim, refund, or rescue path and
remains permanently stranded in `MiningPool`. This requires a mistaken or compromised timelock configuration, but it
can lock 2% of every contribution settled while the value is configured. The regression
`test_AuditProof_MiningPoolAsTeamRecipientStrandsTheTwoPercentFee` proves the accounting and balance outcome.

Recommended remediation: reject `team == address(this)` in both construction and `setTeamAddress`, while preserving
the intentional zero address that returns the complete contribution to the vault.

### I-01 — Open — exact-price one-sided genesis ranges are rejected

`DeployMinimal._positionPlan` compares `tickLower <= initialTick` for GBX-as-token0 and
`tickUpper >= initialTick` for GBX-as-token1. At an exact tick-boundary price, equality is still a valid one-sided
liquidity configuration, but the deployment reverts `DeployMinimal__InvalidRange`. This is a deployment availability
and documentation mismatch rather than a value-loss path. The regression
`test_AuditProof_ExactPriceBoundaryIsRejectedEvenThoughItIsSingleSided` reproduces the rejection.

Recommended remediation: validate the actual square-root boundaries instead: token0 requires
`sqrtLower >= initialSqrtPriceX96`, and token1 requires `sqrtUpper <= initialSqrtPriceX96`, with equality accepted.

### Test and analyzer evidence

- The final configured Foundry run passed 150/150 tests. Ten fuzz properties completed 10,000 cases each, and eight
  invariants completed 1,000 runs at depth 500 with zero handler reverts: 100,000 configured fuzz cases and 4,000,000
  configured stateful calls. Additional deterministic seed matrices brought the campaign totals to 427,680 fuzz cases
  and 6,097,152 stateful calls. The two invariant graphs compose the live GBX, emissions, mining, staking, signaling,
  registry, vault, rewards, acquisition, buyback, timelock, guardian, and a gas-burning rewards dependency.
- New boundary and penetration-style tests cover every typed scheduling authority, operation-ID domain separation and
  replay, constructor/dependency binding, callback reentrancy across voter/mining/strategy/custodian boundaries,
  exact transfer rollback, lifetime-cap exhaustion, maximum 16-strategy reset, maximum 16-asset redemption, destroyed
  position custody, time-varying auction quotes, independent pro-rata/split/reward models, and terminal exits through
  a poisoned rewards hook. Exotic token cases are fail-closed tests only; support remains intentionally out of scope.
- The complete monorepo build and test gates, Hardhat bytecode-parity and supply tests, SDK ABI check, subgraph
  build/Matchstick tests, and six Playwright desktop/mobile checks passed under pinned Node 22.23.1 and an isolated
  Python 3.11.14 environment with all five exact dependency pins.
- Production-only IR coverage reported 958/1,025 lines (93.46%), 143/230 branches (62.17%), and 131/131 functions
  (100%). Ordinary instrumentation does not compile this graph because it triggers a compiler stack-depth failure;
  `--ir-minimum` emits inaccurate-source-mapping warnings. The figures are therefore directional, and branch-source
  locations are not treated as exact proof even though newly added revert paths execute successfully in normal mode.
- Slither 0.11.5 emitted 196 results across the Foundry graph: 5 high, 22 medium, 39 low, and 130 informational. The
  production-source subset contains 190 results: 3 high, 19 medium, 38 low, and 130 informational. The three high
  results are balance-after-call heuristics on `LiquidityCustodian`; `nonReentrant`, exact-delta rollback, custody-loss,
  and callback tests cover those paths. Manual review found no additional practical untrusted exploit beyond the open
  findings above.
- Aderyn 0.6.8 scanned all 26 source units with 88 detectors and emitted 2 high classes plus 9 low classes. Its high
  classes are reentrancy-state-change instances on guarded/constructor/trusted-dependency paths and the
  `uint64(readyAt)` cast in `ProtocolTimelock`. An executable audit-proof test demonstrates delay collapse only beyond
  the `uint64` timestamp horizon; this is not a realistic present-day path, but the lifetime bound is now explicit.
- A six-rule Semgrep 1.162.0 audit policy emitted one blocking match: unchecked `epochId` increment in `AuctionEngine`.
  An executable audit-proof test demonstrates wrap only after `2^256` successful fills. This is not a practical path,
  but it records the arithmetic assumption instead of silently dismissing the analyzer result.
- A scoped mutation probe found three surviving GBX event-deletion mutants. Explicit initialization, controller
  replacement, mint, and burn event assertions were added and pass. No mutation kill ratio is claimed: the runner
  rewrote the working-directory source despite a temporary target, so the campaign was stopped; the production source
  was restored from its pre-run copy and verified byte-for-byte before the complete suite was rerun.
- Solhint 6.0.1 emitted no errors and 848 warnings, dominated by 704 NatSpec suggestions plus event naming, ordering,
  and gas-style rules. These are documentation/style debt, not suppressed security conclusions.
- Gitleaks 8.30.1 emitted two false positives: a public onchain address and a committed public hash/address field in
  candidate configuration evidence. No credential or secret was identified.
- `pnpm audit` reported one moderate and three low advisories, all in Hardhat's transitive developer/tooling graph
  (`uuid`, `cookie`, `elliptic`, and `diff`); there were no high or critical advisories. These do not execute in the
  deployed protocol, but the toolchain should be upgraded or overridden where patches are available before release.

Fresh raw reports are `audit/reports/current-{slither,aderyn,semgrep,gitleaks}.*`; the earlier full-tool snapshot remains
under `audit/reports/current-minimal-2026-08-03/`. These reports are ignored review evidence rather than release gates.

> **Superseded archive.** The findings and dispositions below apply to the pre-rebuild contract graph. Their analyzer
> runners and CI/package entrypoints are disabled because they reference removed contracts and scripts. None of the
> counts or conclusions below describes the current 14-contract architecture; a fresh campaign and review are required.

This register documented findings rather than suppressing them. Raw reports were generated under `audit/reports/` and
uploaded by the prior CI. Any future review must replace the target inventory and refresh the reports for the exact
current commit before adding a new reviewed section.

## Slither 0.11.5 and Aderyn 0.6.8 — 2026-08-02

The first pass found unsafe integer downcasts and modifier-order issues. Those were remediated with OpenZeppelin
`SafeCast`, first-position `nonReentrant` modifiers, smaller external API surface, and direct use of budget checkpoint
return values. The final exact-source pass also replaced ambiguous packed init-code concatenation with `bytes.concat`
and moved `nonReentrant` ahead of authorization modifiers on every StrategyDeployer state-changing entry point. The
affected unit and integration suites passed after remediation.

The current exact-source machine baseline contains exactly 891 internally reviewed findings across 35 tool-detector
classes: 644 Slither findings and 247 Aderyn findings. Slither scans every severity and the Foundry deployment scripts
as well as production contracts. Its report contains three high-, 104 medium-, 162 low-, and 375 informational-severity
findings: two `assembly`, 97 `calls-loop`, ten `costly-loop`, four `cyclomatic-complexity`, two `dead-code`, 18
`incorrect-equality`, one `locked-ether`, two `low-level-calls`, four `missing-inheritance`, five `missing-zero-check`,
343 `naming-convention`, three `reentrancy-balance`, 12 `reentrancy-benign`, 27 `reentrancy-events`, 22
`reentrancy-no-eth`, 21 `timestamp`, four `too-many-digits`, 17 `uninitialized-local`, 46 `unused-return`, and four
`unused-state` findings. Aderyn reports 99 high-severity instances (one `contract-locks-ether` and 98
`reentrancy-state-change`) plus 148 low-severity instances across its 13 retained low-severity classes.
`audit/static-dispositions.json` fingerprints every exact tool, class,
severity, confidence, path, symbol, span, and normalized description; CI rejects any new, moved, changed, stale,
malformed, or expired disposition rather than accepting a class-level allowlist.

Each tool-detector rationale is also bound to a versioned internal-review profile recording the reviewer, potential
impact, exploitability assessment, affected assumptions, re-review trigger, and compensating controls. Each exact
finding copies the profile and reviewer identifiers plus the review date, so stale review metadata fails closed. The
named reviewer is protocol engineering and is explicitly not represented as an independent auditor.

The 2026-08-02 post-format/NatSpec refresh replaced 45 exact fingerprints in the permissioned-pool controller and
interfaces. A before/after multiset comparison retained all 891 findings and all 35 detector classes with identical
tool, detector, severity, confidence, path, semantic symbol grouping, rationale, and reviewer-profile counts. The
refresh therefore records source-span and analyzer-description movement only; it does not approve a new detector
class, change a disposition, or substitute for the independent release review.

Three high-severity detector classes remain in the raw report:

- `contract-locks-ether` on `GumBallVault` is not a payable custody path. Its only native-ETH receiver always reverts.
  ETH forcibly sent by EVM mechanics cannot be rejected, and the specification intentionally forbids any vault rescue
  or arbitrary transfer surface. ERC-20 backing and redemption accounting never includes native ETH.
- `reentrancy-state-change` groups constructors, trusted immutable view dependencies, observed-balance accounting, and
  guarded value paths. All value-moving public entry points in the listed contracts use `nonReentrant`. Incoming-token
  state updates intentionally occur after transfer so fee-on-transfer assets are measured by balance delta. Liquidity
  initialization marks `genesisSeeded` before calling v4, and completed-position sweeping marks the record nonexistent
  before calling PositionManager. Constructor instances cannot be reentered before deployment completes. For the
  permissioned controller, all external pool dependencies are immutable and release-bound to reviewed runtime hashes;
  callbacks are not the dependency initializer, timelock, or guardian, and every live-graph action fails while atomic
  graph initialization is incomplete. The permissionless bootstrap enable consumes its one-shot state before the
  adapter mutation.
- Slither's `reentrancy-balance` instances are the verification escrow's fixed one-wei recycle and the voter's guarded
  signal path. The escrow is callable only by its immutable liquidity manager during atomic genesis, and exact
  pre/post balances plus transaction rollback prevent a callback from retaining a partial recycle. Signaling is
  `nonReentrant` and its callback rollback behavior is covered by adversarial tests.

The remaining medium, low, and informational classes are retained in the raw report. Stateful collection loops are
capped at four, sixteen, seventeen, or 64 entries and require atomic completion; the separate pure uint128 liquidity
binary search takes at most 128 iterations. Timestamp use is limited to intended epoch, auction, bootstrap, deadline,
and timelock boundaries. The two low-level calls are the timelock's exact target/selector/calldata allowlist and the
registry's read-only, length- and content-checked token-symbol query; neither is an arbitrary executor.
Deployment-script return-value and inherited-constant findings concern Foundry broadcast and
serialization helpers; the phase-one script consumes the canonical CREATE2 deployer while later inherited phases do
not. The two `assembly` findings are memory-safe, bounded symbol-response decoding and value-free `CREATE` using exact
immutable creation-code hash and length commitments; malformed data or code-less deployment results revert. The one
token-approval finding was remediated: genesis funding now uses `SafeERC20.forceApprove` and requires the
reported sponsor receipt to equal the signed funding amount. Fixed-size array configuration cannot be `immutable` in
Solidity; Permit2's void-returning `approve` is not an
ERC-20 approval; timelock target addresses are checked by `_requireContract` immediately before assignment. Naming,
structural inheritance, numeric-literal, zero-initialization, and one-use helper findings are retained style or gas
suggestions without changed security semantics.

This triage is not an external security review and must not be treated as one.

## Internal specification audit — 2026-08-01

The following cross-contract accounting defects were identified during the master-spec completion audit and remediated
before any deployment:

- **Resolved — strategy disable could leave dead allocation weight.** The guardian previously disabled only the
  registry entry, while voter cleanup required a second call; the timelock also exposed independent registry and voter
  disable selectors whose permissionless executions could be separated. `EmergencyGuardian` now permanently binds and
  validates the canonical registry/voter pair, and its asset and standalone-strategy disables update both contracts
  atomically. The timelock no longer permits any non-atomic disable selector. Mock rollback tests, real
  Guardian/AssetRegistry/AllocationVoter integration tests, and the complete target-selector-calldata policy matrix
  cover active and pending signals, exact calldata, target substitution, one-time execution, and replay rejection.
- **Resolved — liquidity USDG notification used the manager delta rather than the vault receipt.** A transfer-taxed or
  upgraded USDG could make fee, completed-range, or migration routing notify more than the vault received; an earlier
  unaccounted donation could cushion that mismatch. All three paths now share an observed-vault-delta helper and reject
  a zero vault receipt. Adversarial transfer-fee tests cover fee collection, range sweep, and migration, including a
  preexisting vault donation.
- **Resolved — stale manager weight could cross a strategy-reactivation boundary.** Disabling a strategy invalidated
  user weights lazily, but the single reward index could advance again after timelocked reactivation before an old user
  checkpointed. That user could then receive rewards earned by the new signal generation, while the pre-disable
  entitlement was temporarily omitted from `earned`. AllocationVoter now closes the associated ManagerRewards index
  at every generation increment. Reward checkpoints and views settle stale weight only to that immutable boundary and
  advance its paid index past later generations. A disable/reactivate regression proves old rewards remain visible,
  stale weight earns nothing after reactivation, and new active weight receives the complete new-generation reward.
- **Resolved — nominal manager-reward transfers could underpay a recipient or overdebit the accumulator.** Manager
  claims and the zero-weight vault fallback previously reduced or bypassed liabilities by the requested transfer
  amount without verifying both balance deltas. A target token that enabled a receiver-deducted fee after onboarding
  could burn part of the payout, while a sender-paid surcharge could deliver the nominal claim but leave remaining
  liabilities physically insolvent. Both paths now require the exact observed receiver credit and accumulator debit;
  adversarial tests prove either mismatch reverts the transfer, checkpoint, and liability update atomically.
- **Resolved — synchronous terminal-dust delivery could block the final manager exit.** Removing the last live strategy
  weight previously transferred residual ManagerRewards dust to GumBallVault inside the voter's checkpoint path. A
  paused, false-returning, fee-charging, or sender-surcharging reward token could therefore revert signal reset or
  unstake and leave GBX inaccessible. Terminal reconciliation now queues the generation/cycle residual without a
  token call. Pending dust remains in `accountedRewards` and cannot be notified again; a separate permissionless sweep
  has a fixed GumBallVault destination and exact transfer checks. A failed sweep preserves the queue for retry without
  rolling back staking, voting, reset, or unstake. Terminal-exit, transfer-anomaly, reentrancy, disable/reactivation,
  multi-cycle, and 10,000-run accounting fuzz tests cover the separation and conservation identities.
- **Resolved — offsetting target-token behavior could violate the immutable acquisition split.** AcquisitionStrategy
  previously checked only that the two observed distribution deltas summed to the observed fill. A taxed vault leg
  plus an offsetting credit to ManagerRewards could therefore leave the vault below 98% and managers above 2% while
  passing the total check. Sender-paid surcharges could also consume a preexisting strategy donation. Distribution
  now requires an exact strategy debit and exact vault and ManagerRewards leg deltas. Adversarial tests reproduce both
  cases and prove the complete fill, budget, and token movements roll back.
- **Resolved — a pull-only sender surcharge could exceed the taker's signed maximum.** AcquisitionStrategy enforced
  `maxTargetAmount` against its nominal quote but did not observe the taker's balance decrease during `transferFrom`.
  A token could surcharge only that pull, deliver the quoted amount to the strategy, and use ordinary transfers for
  the later 98/2 split, completing while debiting the taker above their limit. The fill now measures the taker's raw
  balance delta and reverts atomically when it exceeds `maxTargetAmount`; a scoped-surcharge regression reproduces the
  former success path.
- **Resolved — contribution and revenue pulls could overdebit their payers.** Genesis sponsor/community funding,
  MiningPool contribution, and RevenueRouter routing measured only receiver growth. A scoped sender surcharge could
  therefore debit more USDG than the caller-authorized maximum while accounting the nominal receipt. Each path now
  observes the payer decrease as well and rejects any debit above the requested amount. Four regressions prove token,
  escrow/contribution, vault, and revenue-notification state all roll back.
- **Resolved — nominal vault and refund transfers could break accounted payout identities.** GumBallVault redemption
  and strategy release, GenesisBootstrap community and sponsor refunds, and invalidated MiningPool refunds previously
  trusted a successful ERC-20 return without measuring the sender debit and receiver credit. A token that enabled a
  receiver fee after onboarding could burn GBX, consume strategy budget, or clear a refund entitlement while paying
  less than the accounted amount. A sender surcharge could consume remaining basket backing or USDG backing another
  virtual budget/refund liability when a donation or another user's escrow cushioned the debit. These paths now
  require both observed deltas to equal the nominal amount; ten adversarial fee/surcharge regressions prove every
  token movement and accounting change rolls back atomically on mismatch.
- **Resolved — aligned genesis ticks could require unavailable USDG.** For GBX token0, an aligned floor tick whose
  square-root boundary remained below the actual genesis price made the first nominally one-sided position in range.
  The mint plan now compares the aligned boundary square root with the actual genesis price and advances one spacing
  only when strictly necessary; exact equality remains one-sided. The reported six-decimal vector and a real Uniswap
  v4 PoolManager settlement prove zero USDG is pulled for both ordering semantics.
- **Resolved — token1 ranges could be swept before complete conversion.** Tick equality at a lower bound can still be
  in range when the actual square-root price lies inside that tick. Completed-range sweeping now compares slot0 square
  root directly with the terminal TickMath boundary for both token orderings, with equality, inside-tick, and beyond-
  boundary regressions.
- **Resolved — indexed virtual budgets and signal weights could become stale.** Redemption now emits every exact
  post-scale strategy budget for deterministic indexing. Signal allocations store their recorded strategy generation
  instead of presenting an unmaintainable account aggregate as current; consumers treat a weight as effective only
  when its generation matches an enabled strategy. Matchstick tests cover scaling and disable/reactivation invalidation.
- **Resolved — a reward checkpoint could mutate stake after a signal balance snapshot.** A timelock-registered
  ManagerRewards implementation is an external callback during signal checkpointing. Before hardening, that callback
  could donate its own prefunded GBX through `stakeFor` while the outer signal operation still used the earlier sGBX
  balance. This did not steal assets or create excess weight, but it could leave the donated stake temporarily
  under-allocated. `AllocationVoter.onStake` is now reentrancy-guarded, and a callback regression proves the nested
  stake is rejected without changing balances, active weight, pending weight, or total live weight.

These internal findings and tests are audit-preparation evidence only. They do not replace the independent security
and economic reviews required by the launch gate.

## Solhint warning policy

Solhint runs without hiding its recommended-rule warnings, and CI archives the complete output. Several recommended
style rules intentionally conflict with the protocol's source conventions: contract-prefixed event/error names are
used for unambiguous indexer and incident logs, and `use-natspec` also requests author tags plus documentation for
private helpers, interface shims, events, and errors beyond the master spec's public function requirement. Every
source-defined callable, constructor parameter, return value, and compiler-generated public getter has direct or
inherited NatSpec; the remaining recommended-rule warnings are non-callable documentation, naming/order, and gas-style
suggestions retained for reviewer visibility rather than disabled. The generated artifact reference enumerates every
ABI function. Any semantic, visibility, compiler, or formatting error remains release-blocking.
