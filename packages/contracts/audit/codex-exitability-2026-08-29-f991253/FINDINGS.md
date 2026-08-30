# Findings and candidate dispositions

## Severity table

| ID     | Title                                                                    | Overall       | Impact              | Likelihood  | Liveness class                                          | Status                                                           |
| ------ | ------------------------------------------------------------------------ | ------------- | ------------------- | ----------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| CEX-01 | Unbounded Resonance index can globally freeze signal principal           | Medium        | Critical            | Negligible  | Global permanent principal lock                         | Remediated and internally verified; independent closure pending  |
| CEX-02 | Third parties can force away fractional Bribe rewards                    | Medium        | Medium              | Medium      | Reward destruction, per account/token                   | Remediated and internally verified; independent closure pending  |
| CEX-03 | Unknown signal positions are not discoverable from bounded current state | Medium        | High                | Low         | Principal exit depends on historical/offchain discovery | Open architectural decision                                      |
| CEX-04 | Mine accepts pre-binding tenures that survive canonicalization           | Low           | Medium              | Low         | Pre-exposure immutable graph contamination              | Open deployment control                                          |
| CEX-05 | SDK release status is self-declared rather than authenticated            | Low           | High if misused     | Low         | Counterfeit integration / unsafe call construction      | Naming ambiguity remediated; authentication remains release gate |
| CEX-06 | Mine and Fund `uint256` horizon model                                    | Rejected      | Counterfactual only | Unreachable | Target timestamp cannot encode the required state       | Retained as defensive model evidence                             |
| CEX-07 | Signal exits have a finite ERC-5805 block-clock horizon                  | Informational | Critical at horizon | Negligible  | Global signal burn/exit lock                            | Accepted explicit horizon                                        |
| CEX-08 | Permissionless Strategy checkpoints maximize accepted floor loss         | Low           | Low                 | Low         | Protocol USDG yield destruction, per Strategy           | Confirmed; accepted-floor architecture                           |
| CEX-09 | Public complete-basket claims exceed selective Fund redemption           | Medium        | Medium              | High        | Release-claim mismatch; omitted backing is forfeited    | Confirmed; open release blocker                                  |

The table contains eight confirmed findings and one rejected candidate retained for evidence. No overall Critical or High
finding is counted by collapsing impact into likelihood. CEX-01 remains a Critical-impact finding even though its
practical reachability horizon is fantastically remote.

## CEX-01 — Unbounded Resonance index can globally freeze signal principal

- Overall severity: **Medium**
- Impact severity: **Critical**
- Likelihood: **Negligible but finite and publicly reachable**
- Confidence: **High**
- Liveness classification: global, permanent principal-exit lock
- Affected assets/users: all GBX escrowed as sGBX when the terminal state is reached, live or killed Strategy positions
- Violated invariants: L-01, L-04, L-05, L-11, L-15, L-18
- Original affected code at `f991253`: `packages/contracts/src/core/Resonance.sol:255-270` (`removeSignalFor`),
  `:282-297` (`notifyRevenue`), `:442-453` (`revenuePerSignal`), and `:482-495` (`_updateRevenue`), reached
  from `packages/contracts/src/core/SignalGBX.sol:135-168` (`removeSignal` / `removeSignalMany`)
- Remediation code in this tree: `packages/contracts/src/core/Resonance.sol:48-50`, `:70-72`, `:169-173`, and
  `:295-317`
- Preconditions: a canonical public graph; one raw live or killed signal unit; accepted standard USDG revenue totaling
  the exact arithmetic schedules below; and passage of the stated stream time
- Maximum damage: every sGBX holder becomes unable to return any escrowed GBX through either scalar or batched removal;
  further signal mutations, Strategy kills, notifications, distributions, and revenue-backed buys also halt
- Asset disposition: no asset is transferred to an attacker or diluted; all GBX escrowed behind sGBX is globally frozen
  and permanently trapped in the original immutable deployment after the terminal state
- Recovery: none in the immutable original contract; a not-yet-exposed candidate must be abandoned. The working-tree
  cap prevents the terminal state only in a fresh deployment
- Executable cross-version PoC/regression: `packages/contracts/test/minimal/audit-exitability/CEX01CrossVersionRegression.t.sol::test_OriginalOverflowSequenceMustLeaveSignalPrincipalRemovable`
- Remediation regression: `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol::test_Regression_LifetimeCapPreservesSignalExitAndBuffersRejectedRevenue`
- Cap-edge exit matrix:
  `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_LiveOneRewardStrategyExitsAtSaturatedLifetimeCaps`
  and its killed/16-reward/broken-token variants
- Original PoC: `packages/contracts/test/minimal/audit-exitability/reproductions/CEX-01-original-f991253.t.sol.disabled`
- Status: remediated and internally verified in the working tree by ADR 0052; independent closure is pending and
  existing immutable deployments would require replacement
- Why existing tests missed it: ordinary-scale handlers never reached the one-raw-unit denominator and cumulative
  precision boundary; the prior disposition relied on an unenforced offchain USDG-supply assumption

### Root cause and exact bound

The original `notifyRevenue` admitted an unbounded lifetime sequence of fresh USDG schedules. With precision
`P = 10^36`, `revenuePerSignal` checked-adds `floor(emitted * P / totalSignalWeight)` to a monotonic `uint256` index.
Every signal removal called `_updateRevenue` before reducing Bribe weight and before SignalGBX burned the receipt and
returned GBX.

Let:

```text
M = 2^256 - 1
P = 10^36
D = 604800
Q = floor(M / P)
  = 115792089237316195423570985008687907853269 raw USDG
Q mod D = 582869
S = Q - (Q mod D)
  = 115792089237316195423570985008687907270400 raw USDG
```

At the minimum reachable denominator of one raw signal unit, a completed `S` schedule stores `S * P` safely. A second
`S` schedule needs only one second of emission before the checked addition exceeds `M`. The pre-remediation PoC reached
this state exclusively through public functions and a standard freely mintable USDG test token; it did not use
`vm.store` or counterfeit protocol contracts.

For canonical six-decimal USDG, `Q` displays as approximately `1.158e35` whole tokens. That makes immediate real-world
exploitation implausible, but decimals are presentation only and the supported-token model did not enforce a supply or
lifetime-throughput cap. A finite token supply is not a mathematical proof: after each minimum `D`-raw-unit schedule,
revenue can be distributed to a Strategy, acquired at zero price, returned to the Router, and reused. The required cycle
count remains absurdly high—`floor(Q / D) + 1 = 191455174003499000369661020186322599`—but finite.

Direct Resonance donations do not affect the index because they are not scheduled. Router notifications and restarted
schedules do. Long time alone does not create more emitted revenue than admitted funding, but it lets each schedule
finish. Different decimals, bridge models, issuer implementations, or later supply policy do not preserve the old
offchain assumption.

### Reachable transaction sequence and observed result

1. Acquire GBX through Mine settlement and add exactly one raw unit of signal to a live Strategy.
2. Fund the real ResonanceRouter with `S` raw USDG and call `route`.
3. Wait seven days.
4. Fund and route another `S` raw USDG.
5. Wait one second.
6. `revenuePerSignal`, `distributeRevenue`, and scalar `removeSignal` all revert with checked arithmetic panic `0x11`.
7. The victim still owns one sGBX, the paired Bribe still records one unit, and no GBX is returned.

The same global checkpoint also blocks further signal mutations, Strategy killing, revenue notification, and
revenue-backed Strategy purchases. It does **not** block direct Bribe claims, GBX transfers, Fund redemption, or Mine
replacement. Governance has no recovery method and cannot kill around the state because killing checkpoints first.

The same compiled cross-version regression was copied into a detached `f991253` worktree and then run in the current
tree. It failed on the original source at the victim's scalar exit and passed after the cap:

```text
# detached f991253 worktree
forge test --match-path test/minimal/audit-exitability/CEX01CrossVersionRegression.t.sol -vvv
[FAIL: panic: arithmetic underflow or overflow (0x11)]
test_OriginalOverflowSequenceMustLeaveSignalPrincipalRemovable()

# current working tree
forge test --match-path test/minimal/audit-exitability/CEX01CrossVersionRegression.t.sol -vvv
[PASS] test_OriginalOverflowSequenceMustLeaveSignalPrincipalRemovable() (gas: 592018)
```

The disabled original-source assertion remains durable evidence rather than part of the remediated compiler target.

### Why existing tests missed it

The stateful handler bounded signal additions to at least `1e15` and revenue donations to ordinary test-scale values.
The existing full-exit invariant was useful but could not reach the one-raw-unit denominator or lifetime arithmetic
boundary. Prior V12 intake accepted an offchain supply assumption instead of enforcing it.

### Remediation and tradeoffs

ADR 0052 adds:

- `MAX_LIFETIME_REVENUE_AMOUNT = floor(type(uint256).max / REWARD_PRECISION)`;
- monotonic `lifetimeRevenueNotified` with no reset or setter; and
- `RevenueLifetimeCapExceeded`, checked before checkpointing and USDG interaction.

Across schedule restarts, elapsed emission plus rolled remaining revenue cannot exceed cumulative fresh admitted
revenue. At any positive signal denominator `W >= 1`, cumulative index growth is therefore at most
`lifetimeRevenueNotified * P <= M`. Zero-weight intervals consume capacity but do not grow the index; donations remain
unscheduled. Saturation, wrapping, resetting, or skipping the failing checkpoint were rejected because each would
discard or misattribute revenue.

At cap exhaustion, later Router revenue remains buffered and cannot be scheduled. That is a new explicit lifetime
admission boundary and delayed/stranded protocol yield, not user principal. The regression fills the remaining exact
headroom, rejects the next schedule without custody or schedule mutation, and then removes the one-raw-unit signal and
returns exactly one raw GBX. New deployments require new bytecode and regenerated consumers; an already deployed
unbounded Resonance cannot be repaired.

## CEX-02 — Third parties can force away fractional Bribe rewards

- Overall severity: **Medium**
- Impact severity: **Medium**
- Likelihood: **Medium** for a sufficiently valuable low-decimal reward; attack cost can dominate value
- Confidence: **High**
- Liveness classification: repeatable reward-entitlement destruction; no principal lock
- Affected users/assets: one beneficiary and one Bribe reward token per cadence; signal GBX remains removable
- Violated invariant: L-10
- Affected starting-revision code: `packages/contracts/src/core/Bribe.sol:138-160` (`claimRewards` / `claimReward`) and
  `:301-312` (`_updateReward`)
- Preconditions: at least two signalers share a reward stream; the victim's per-checkpoint entitlement is below one raw
  unit; an outsider repeatedly calls a claim selector for the victim between accrual intervals
- Maximum damage: 100% of that beneficiary's otherwise claimable whole-unit reward for one token over the attack
  cadence; extending the demonstrated one-second pattern mathematically across seven days yields 302,400 raw units.
  GBX/sGBX principal is unaffected
- Asset disposition: the victim's rounded-away Bribe entitlement is permanently destroyed as unallocated surplus; no
  GBX/sGBX principal is stolen, diluted, frozen, delayed, or trapped
- Recovery: already floored entitlement is unrecoverable and remains surplus; stopping outsider checkpoints allows
  later uncheckpointed fractions to combine normally
- Preserved PoC: `packages/contracts/test/minimal/audit-exitability/reproductions/CEX-02-original-f991253.t.sol.disabled::test_ThirdPartyClaimsForceFractionalAccountCheckpoints`
- Current regression: `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol::test_Regression_ThirdPartyClaimsCannotForceFractionalAccountCheckpoints`
- Regression status: the before/after, direct, contract-wallet, live/killed/duplicate batch, fixed-caller/validation,
  broken-token scalar isolation, adversarial reentrancy, and gas regressions pass in E-16; independent closure remains
  pending
- Status: Remediated and internally verified in the working tree; independent closure, deployment authorization, and
  user-fund authorization remain pending.
- Why existing tests missed it: they checked ordinary flooring and permissionless convenience separately, but never let
  an unrelated account adversarially control the beneficiary's checkpoint cadence

In `f991253`, claims accept an arbitrary nonzero beneficiary and any caller. `_updateReward` credits
`floor(weight * deltaIndex / 1e36)` whole raw units, then advances the beneficiary's paid index even when the credited
amount is zero. An outsider can choose the checkpoint cadence and prevent fractional increments from combining.

Public sequence:

1. Alice and Bob each receive one raw signal unit in the same Bribe.
2. Fund a standard reward stream at one raw unit per second.
3. After one second, Carol calls `claimReward(ALICE, token)`; Alice's half-unit floors to zero and her paid index moves.
4. Carol repeats after another second; Alice again receives zero.
5. Bob's uncheckpointed two-second accrual combines to one raw unit and is paid.

For checkpoint intervals `i`, the forced loss is:

```text
floor(weight * sum(deltaIndex[i]) / P)
  - sum(floor(weight * deltaIndex[i] / P))
```

It is below the number of forced checkpoints in raw units, yet can equal 100% of the victim's otherwise payable reward.
The executable PoC demonstrates the loss across two one-second forced claims. Mathematical repetition of that exact
two-equal-weight pattern once per second can erase Alice's complete 302,400-raw-unit share of a seven-day stream; the
test does not execute 604,800 separate transactions. Transfer failure is not involved; discarded entitlement becomes
unallocated Bribe surplus.

Existing tests checked ordinary flooring and permissionless convenience independently, but did not adversarially vary
another account's checkpoint cadence. Signal removal remains live because removal performs bounded accounting and no
reward-token transfer.

Selected resolution under ADR 0053: both Bribe selectors authorize only `msg.sender == account` or
`msg.sender == immutable resonance`. `UnauthorizedClaimCaller(caller, account)` rejects every other caller before a
reward checkpoint changes. A Safe or ERC-4337 wallet calls as itself, so this is wallet-native, but direct
keeper/relayer claims for an EOA disappear.

Resonance adds `claimBribeRewards(strategies)`. It accepts no beneficiary or receiver parameter and always claims for
`msg.sender`. Every supplied Strategy must be canonically registered, but may be live or killed; duplicates execute
sequentially and an empty array reverts. The caller controls batch length and the complete batch is atomic. A broken
token can therefore revert a cross-Bribe all-token batch, while the beneficiary's direct scalar Bribe claim remains
the bounded healthy-token and gas fallback.

Verified regression: third-party scalar/all-token calls revert before changing paid indexes; self-claims by an EOA and
contract wallet work; deferred sub-unit accrual equals a single later whole-unit claim; Resonance batches live/killed,
duplicate, empty, and unregistered Strategy cases; batch failures roll back; broken-token scalar isolation remains
intact; hostile reward-token callbacks cannot reenter the batch; and the maximum-registry and oversized-batch gas cases
preserve their stated fallbacks. Fresh independent review remains required.

## CEX-03 — Unknown signal positions are not discoverable from bounded current state

- Overall severity: **Medium**
- Impact severity: **High** under the review's discovery requirement
- Likelihood: **Low**, because public historical logs and normal wallet/indexer records usually remain available
- Confidence: **High** on the state surface; Medium on practical loss scenario
- Liveness classification: account principal exit has no state-growth-independent bounded discovery path
- Affected users/assets: an account's complete GBX escrow if none of its Strategy addresses can be recovered
- Violated invariants: L-02, L-13 and the explicit definition that the only exit must not depend on an indexer or history
- Affected code: `packages/contracts/src/core/Resonance.sol:83-90` (non-enumerable Strategy mappings),
  `packages/contracts/src/periphery/SignalPortfolioLens.sol:9-15,58-79`, `packages/sdk/src/readers.ts:308-349`, and
  `packages/subgraph/schema.graphql:82-97`
- Preconditions: the account has positive signal and no longer knows one or more Strategy keys. Historical records may
  be unavailable, or the user may be limited to reconstructing keys by walking the globally growing factory history
- Maximum damage: up to the account's complete escrowed GBX remains unreachable even though known-key scalar removal is
  sound; other users and known positions are unaffected
- Asset disposition: no GBX is stolen or diluted, but unknown-position escrow can be frozen and effectively trapped
  until its Strategy keys are recovered; recovery delay is unbounded when external records are unavailable
- Recovery: recover the missing Strategy addresses from durable history/offchain records and use scalar removals. A
  client can also derive the factory's finite CREATE outputs from its current nonce and query the resulting Strategy
  candidates, but this is O(total factory creations), grows globally, and is not a state-growth-independent fallback
- Test/evidence gap: Lens/SDK/subgraph tests validate caller-supplied keys; the invariant harness deliberately carries a
  test-only registry, so no current test can prove discovery from production current state
- PoC: `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol::test_Repro_LensCannotDiscoverSignalWithoutCallerStrategyKey`
- Status: open architectural decision and deployment blocker under this review
- Why existing tests missed it: all Lens/SDK tests supplied keys and the invariant harness used a test-only registry, so
  they proved known-key execution while assuming the discovery step that CEX-03 falsifies

Current state exposes `SignalGBX.balanceOf(account)` but no enumerable Strategy registry and no per-account membership
set. Each paired Bribe holds the canonical account amount, keyed by a Strategy address that the caller must already know.
The stateless Lens and SDK explicitly take caller-discovered Strategies; the subgraph is a replaceable, non-authoritative
event index. `StrategyFactory.createStrategy` uses two ordinary CREATE operations per registered Strategy graph, so an
offchain client can read the factory's current account nonce, derive its historical CREATE outputs, and filter candidates
through Resonance. That recovery is finite at any fixed state, but its work grows with the total global Strategy history
rather than the affected account's current position count.

Once a Strategy address is known, scalar removal is finite, works for live and killed Strategies, and does not depend on
the Lens, SDK, frontend, subgraph, governance, or Router. If the original transaction record, historical logs, wallet
database, and indexer are unavailable or incomplete, however, aggregate current state does not identify which scalar
calls to make. The deterministic factory-nonce scan is O(total factory creations), so it violates the review's L-13
requirement for a bounded, state-growth-independent exit fallback even though it avoids scanning the complete address
space.

Existing invariants always carry a test-only `StrategyRegistry`, so they prove execution but assume discovery. Lens and
subgraph tests prove correct indexing of supplied events, not recovery after all discovery aids are lost.

Recommended remediation: add a paginated current membership index without duplicating amounts. Resonance can maintain
an O(1) per-account Strategy set on zero-to-nonzero and nonzero-to-zero Bribe transitions; each reader page must refresh
amounts from the canonical Bribe. A global append-only Strategy array alone is insufficient because an existing user's
fallback cost grows without bound. This changes invariant-critical storage and transition gas, so it requires an ADR,
duplicate-batch/partial/killed rollback tests, migration analysis, gas measurements, and independent review. Under this
review's explicit exitability requirements, CEX-03 remains a deployment blocker until bounded current membership exists;
durable offchain discovery is only a practical mitigation, not closure.

## CEX-04 — Mine accepts pre-binding tenures that survive canonicalization

- Overall severity: **Low**
- Impact severity: **Medium**
- Likelihood: **Low** with enforced deployment controls; permissionless on any publicly visible unbound candidate
- Confidence: **High**
- Liveness classification: pre-exposure immutable graph contamination, not post-launch principal theft
- Violated invariants: L-08 and L-14 at the deployment/exposure boundary
- Historical ID: V12-249702
- Affected code: `packages/contracts/src/core/Mine.sol:197-249` (`mine`) and `:329-339` (`_settleSlot`), plus
  `packages/contracts/src/core/GBX.sol:69-90` (`setMinter`)
- Preconditions: a Mine candidate is publicly callable before GBX permanently binds it; the attacker occupies empty
  slots; setup later performs the one-time handoff; a later replacement settles the preserved tenure
- Maximum damage: pre-binding attackers can reserve all 16 initial slots and later receive aggregate initial issuance
  at 64 GBX/second for their pre-binding tenure, diluting later supply; no existing principal is directly transferred
- Asset disposition: attacker-controlled new issuance dilutes later GBX holders; existing tokens are not stolen, frozen,
  delayed, or trapped, and known-position exits remain callable
- Recovery: before any user exposure, abandon the candidate and redeploy. After binding/exposure there is no clawback,
  tenure deletion, owner, or migration path
- PoCs:
  `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol::test_Repro_PreBindingMineSlotCaptureSettlesAfterHandoff`
  and `::test_Repro_PreBindingOccupiedMineCannotSettleAfterGBXBindsDifferentMine`
- Regression status: reproduction passes; source remains unchanged and the deployment-abandonment gate is open
- Status: accepted deployment blocker; source hardening not selected
- Why existing tests missed it: ordinary fixtures bound GBX to Mine immediately and therefore never exercised public
  empty-slot occupation before the one-time minter handoff

The first occupation of an empty slot settles no outgoing miner and therefore never asks GBX to mint. `Mine.mine` does
not require that GBX has already locked mint authority to that Mine. A public caller can occupy one or all sixteen slots
before handoff, wait for setup to call `GBX.setMinter(Mine)`, and receive the complete pre-binding tenure emission on a
later replacement. The permanent PoC occupies one slot, binds after ten seconds, replaces, and observes exactly
`40 ether` GBX paid to the pre-binding miner.

The paired wrong-binding PoC first proves that settlement reverts and rolls the slot back while GBX is unbound. It then
permanently binds GBX to a different otherwise-valid Mine and proves the contaminated Mine still cannot settle or
repair its minter identity. This is why abandonment, not a later operational retry, is the only safe response to a
touched or incorrectly bound candidate.

At the initial schedule, all sixteen slots can preserve aggregate `64 ether` TPS for pre-binding occupants. No existing
holder principal is directly stolen, but later supply is diluted. Once detected before exposure, abandonment and
redeployment is permissionless operational recovery for the deployer; after user exposure there is no clawback or
migration authority.

Ordinary fixtures bind immediately, which is why baseline tests did not exercise the window. Current architecture also
deliberately avoids repeatedly reading permanent setup facts on every replacement. Options are: gate only empty-slot
occupation on `minterLocked && minter == Mine`, or retain the architecture and require an atomic/private deploy-bind
sequence plus an explicit all-sixteen-slots-untouched receipt. Any touched candidate must be abandoned before funding or
exposure.

## CEX-05 — SDK release status is self-declared rather than authenticated

- Overall severity: **Low**
- Impact severity: **High if a consumer mistakes selection for verification**
- Likelihood: **Low**; no current production consumer or current release manifest was found
- Confidence: **High** on behavior, Medium on exploitation
- Liveness classification: counterfeit/cross-wired integration can construct calls against the wrong graph
- Violated invariant: L-14's exact immutable-graph authenticity requirement at the SDK trust boundary
- Affected code: `packages/sdk/src/deployment.ts:51-90` (`protocolDeploymentSchema`, `parseProtocolDeployment`, and
  `selectProtocolDeployment`)
- Preconditions: an integration accepts attacker- or operator-supplied deployment JSON and treats the parsed
  `release-approved` label as authentication without separately verifying the graph and signed manifest
- Maximum damage: integration calls can be constructed for an arbitrary counterfeit or cross-wired graph; downstream
  loss is bounded only by the approvals/funds that the consuming wallet gives that graph
- Asset disposition: the repository behavior alone moves no funds; a consumer that mistakes selection for verification
  can have approved assets stolen or trapped by the selected counterfeit graph, with no GumBall6900 recovery path
- Recovery: reject the object before approvals or calls; after interaction, recovery depends entirely on the counterfeit
  contracts. The repository's current release selector fails closed, and no current production consumer was found
- Historical PoC: `packages/sdk/tests/minimal-sdk.test.ts::accepts self-declared release-approved JSON without external attestation`
- Current regression: `packages/sdk/tests/minimal-sdk.test.ts::labels unauthenticated release metadata as caller-claimed and rejects the legacy status key`
- Status: semantic ambiguity remediated and internally verified; authenticated release evidence remains a release gate
- Why existing tests missed it: schema tests validated syntax and selection semantics, while no authentication
  implementation or current production consumer existed to force an authenticity assertion

The reviewed starting SDK accepted any syntactically valid object whose caller supplied `status: "release-approved"`, a
bytes32 manifest hash, and unique addresses. `selectProtocolDeployment` defaulted to filtering on that status but did not verify a
signature, artifact hash, immutable argument, reciprocal dependency, or onchain ownership/minter state. The function is
a selector, not a cryptographic verifier, but the status name can be misused as a trust boundary.

No current packaged release object or production consumer was found, and `packages/config/current-release.ts` fails
closed. Thus this was a latent integration hazard, not a demonstrated deployed exploit. The working tree now renames
the field to `claimedStatus` and the selector option to `requireClaimedReleaseApproved`, documents both parser and
selector as unauthenticated, and rejects the legacy `status` key under the strict schema. SDK 55/55, typecheck, build,
package dry-run, generated-reference, and documentation checks pass. This is semantic hardening, not authentication:
production still requires a separately verified, signed current-schema manifest and live graph evidence.

## CEX-06 — Rejected: Mine and Fund `uint256` horizon is not target-reachable

- Classification: **Rejected candidate; retained as defensive-model evidence**
- Counterfactual impact: **Critical if an EVM host admitted the required timestamp**
- Target reachability: **No** on the pinned Robinhood/Nitro execution client
- Confidence: **High**
- Affected code: `packages/contracts/src/core/Mine.sol:288-307` (`pendingSlotEmission`, `pendingEmission`,
  `effectiveTotalSupply`) and `:320-339` (`_accruePendingEmission`, `_settleSlot`), plus
  `packages/contracts/src/core/Fund.sol:102-157` (`redeem`)
- Rejected precondition: the Foundry model advances `block.timestamp` to approximately `1.8e57` seconds, while the
  pinned target client stores block-header time as `uint64` and pushes that `uint64` into the EVM TIMESTAMP opcode
- Defensive test: `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_DefensiveModel_MineAndFundUint256OverflowRequiresTimestampBeyondTargetUint64`
- Status: not counted as a confirmed finding

Public occupation of all sixteen slots at the initial rate makes `aggregateTps = 64 ether`. With near-zero stored pending
emission, the largest safe elapsed interval is:

```text
floor((2^256 - 1) / 64 ether)
= 1809251394333065553493296640760748560207343510400633813116 seconds
≈ 5.733e49 years
```

One further modeled second overflows `pendingEmission`; a nonzero GBX total supply makes `effectiveTotalSupply` overflow
slightly earlier. But the largest target-representable elapsed interval is at most `2^64 - 1` seconds. At the protocol's
maximum public aggregate rate of `64 ether`, that creates at most `1180591620717411303360e18` raw pending emission,
roughly `9.8e37` times below `uint256` maximum. The sole-Mine issuer has no public path to manufacture the missing
headroom. The test therefore remains useful defensive arithmetic evidence but is not a reachable Robinhood Chain state
and does not falsify L-07, L-08, or L-18 on the target.

Sources: Robinhood's [official node guide](https://docs.robinhood.com/chain/run-a-full-node/) pins Nitro
`v3.11.2-3599aca`; that exact source pins geth `f3a977d`. The target's
[`Header.Time uint64`](https://github.com/OffchainLabs/go-ethereum/blob/f3a977ddf30b138da2fe673ac5cbff2bc6dd4c88/core/types/block.go#L74-L87)
and [`TIMESTAMP` `SetUint64`](https://github.com/OffchainLabs/go-ethereum/blob/f3a977ddf30b138da2fe673ac5cbff2bc6dd4c88/core/vm/instructions.go#L473-L475)
implementations establish the rejected precondition.

## CEX-07 — Signal exits have a finite ERC-5805 block-clock horizon

- Overall severity: **Informational**
- Impact severity: **Critical at the horizon**
- Likelihood: **Negligible / physically non-actionable**
- Confidence: **High**
- Liveness classification: eventual global sGBX burn and signal-exit lock
- Violated invariants: L-01 and L-18 after the explicit ERC-5805 clock horizon
- Affected code: `packages/contracts/node_modules/@openzeppelin/contracts/governance/utils/Votes.sol:59-61,182-190,233-239`,
  `packages/contracts/node_modules/@openzeppelin/contracts/utils/types/Time.sol:33-35`, and
  `packages/contracts/node_modules/@openzeppelin/contracts/utils/math/SafeCast.sol:475-480`, reached by
  `packages/contracts/src/core/SignalGBX.sol:135-168`
- Target evidence: exact Nitro/geth NUMBER processing returns a `uint64` parent-chain block number, so
  `type(uint48).max + 1` is representable with sixteen bits of headroom
- Preconditions: a valid signal balance exists and target `block.number` advances above `type(uint48).max`
- Maximum damage: every sGBX burn and therefore every principal signal exit fails globally; ordinary GBX holders and
  non-voting protocol paths are unaffected
- Asset disposition: all GBX escrowed behind outstanding sGBX is globally frozen and permanently trapped after the
  clock horizon; no asset is transferred to an attacker or diluted
- Recovery: none once the chain crosses the clock bound in the immutable deployment; no source change is recommended
  because the boundary is millions of years away at defensible block rates
- PoC/boundary test: `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_SignalExitWorksAtLastERC5805BlockAndFailsBeyondTheClockHorizon`
- Regression status: last valid block exits, first invalid block reverts with the expected SafeCast error
- Status: accepted explicit operating horizon
- Why existing tests missed it: ordinary tests never rolled the chain to the exact `uint48` clock boundary and therefore
  did not exercise the inherited ERC20Votes downcast during the removal burn

OpenZeppelin's default Votes clock downcasts `block.number` to `uint48`. Every mint or burn transfers voting units and
pushes a checkpoint using that clock. At `block.number > 2^48 - 1`, the downcast reverts; SignalGBX removal cannot finish
because receipt burning is atomic with the canonical Bribe removal and GBX return. On exact Nitro, the EVM NUMBER hook
returns the parent-chain block number as `uint64`; it has no `uint48` guard. At a 12-second parent-block cadence the
boundary is roughly 107 million years away, well inside both the target's `uint64` number and timestamp domains.

Target trace: Robinhood's [official node guide](https://docs.robinhood.com/chain/run-a-full-node/) pins Nitro
`v3.11.2-3599aca`; exact Nitro wires the
[ArbOS processor](https://github.com/OffchainLabs/nitro/blob/3599acae1ad2fab4059fc46453c9cd3294126641/gethhook/geth-hook.go#L63-L67),
stores the parent number as
[`StorageBackedUint64`](https://github.com/OffchainLabs/nitro/blob/3599acae1ad2fab4059fc46453c9cd3294126641/arbos/blockhash/blockhash.go#L16-L30),
and returns it from the [transaction processor](https://github.com/OffchainLabs/nitro/blob/3599acae1ad2fab4059fc46453c9cd3294126641/arbos/tx_processor.go#L915-L929).
Pinned geth's [NUMBER hook](https://github.com/OffchainLabs/go-ethereum/blob/f3a977ddf30b138da2fe673ac5cbff2bc6dd4c88/core/vm/instructions.go#L478-L485)
pushes that `uint64`. This makes CEX-07 target-representable, unlike rejected CEX-06.

The separate `uint208` safe-supply ceiling rejects new signal minting far before `uint256` supply exhaustion, but it does
not trap already valid signal balances. No source change is recommended. The permanent operating-horizon boundary test
records the last successful exit and first failing block; protocol prose must still avoid unqualified perpetuity claims.

## CEX-08 — Permissionless Strategy checkpoints maximize accepted floor loss

- Overall severity: **Low**
- Impact severity: **Low**
- Likelihood: **Low / feasible but generally uneconomic**
- Confidence: **High**
- Liveness classification: permanent destruction of fractional protocol USDG yield for one Strategy
- Principal impact: none
- Affected code: `packages/contracts/src/core/Resonance.sol:326-337` (`distributeRevenue`) and
  `packages/contracts/src/core/Resonance.sol:502-515` (`_updateRevenue`)
- Preconditions: at least two live Strategy weights, a live USDG stream, and a target Strategy whose entitlement over
  each attacker-selected checkpoint interval is below one raw USDG unit
- Maximum damage: less than one raw USDG unit per effective target checkpoint, but up to 100% of otherwise combinable
  fractional target accrual; no value is transferred to the caller
- Asset disposition: rounded USDG remains ownerless Resonance surplus and is unrecoverable by the affected Strategy
- Recovery: already floored entitlement has none; future uncheckpointed intervals can still combine into whole units
- PoC:
  `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol::test_Repro_ThirdPartyDistributionForcesFractionalStrategyCheckpoints`
- Status: confirmed and counted; accepted by the current no-carry/per-Strategy-floor architecture, so remediation
  requires an ADR

`distributeRevenue(strategy)` is permissionless and always calls `_updateRevenue(strategy)`. That helper converts the
Strategy's scaled index delta into whole raw USDG using `floor(weight * delta / 1e36)`, then advances
`strategyRevenuePerSignalPaid` even when the result is zero. An unrelated caller can therefore choose intervals that
discard a target Strategy's fractional accrual.

The permanent reproduction gives two live Strategies one raw signal unit each and schedules one raw USDG unit per
second. The global division is exact: each second increases the index by `0.5e36`. An unrelated caller checkpoints the
target after each of two seconds, receiving zero both times, while the uncheckpointed control Strategy combines the two
halves and receives one raw unit. This isolates the per-Strategy floor from the separate accepted global-index floor.

For checkpoint intervals `i`, the additional cadence loss is:

```text
floor(weight * sum(deltaIndex[i]) / 1e36)
- sum(floor(weight * deltaIndex[i] / 1e36))
```

It is strictly less than the number of effective forced checkpoints in raw units. In the exact equal-pair,
one-raw-unit-per-second example, one target can lose 302,400 raw units over seven days, or 0.3024 intended six-decimal
USDG. This is an illustrative sequence, not a universal maximum.

Restricting only `distributeRevenue` is insufficient because signal additions and removals also checkpoint their
Strategy. Scaled per-Strategy carry would remove cadence dependence, but it conflicts with the recorded ordinary-floor
architecture and must not be introduced without an ADR, differential accounting proofs, and fresh review.

## CEX-09 — Public complete-basket claims exceed selective Fund redemption

- Overall severity: **Medium**
- Impact severity: **Medium**
- Likelihood: **High / the contradictory claims are repeated in tracked release-facing material**
- Confidence: **High**
- Liveness classification: product/release claim exceeds the bounded redemption path
- Principal impact: a redeemer relying on the broad claim can burn GBX and permanently forfeit every omitted asset share
- Affected claims: `apps/landing/components/sections/Hero.tsx:92-95`, `Why.tsx:48-58`, and `Fund.tsx:1863-1869`;
  `apps/landing/docs/BRIEF.md:79-82`; `docs/deck/gumball6900-deck.html:932-935` and `:1029-1031`; and
  `apps/web/components/home/mechanism-dashboard.tsx:129-133`
- Canonical behavior: `packages/contracts/src/core/Fund.sol:90-102` and AGENTS.md's Fund behavior require a nonempty
  caller-selected token list and permanent forfeiture of omitted shares
- Preconditions: a user relies on the complete-basket or guaranteed-arbitrage language and cannot identify or include
  every desired Fund token in one successful transaction
- Maximum damage: up to the redeemer's complete pro-rata share of every omitted asset; a later disjoint redemption
  cannot restore the original fraction
- Asset disposition: omitted assets stay in Fund for the post-redemption supply and are not paid to the redeemer or an
  attacker
- Recovery: none after the GBX burn succeeds; before release, align the copy or redesign the Fund through a new ADR
- Status: confirmed and counted; release-blocking implementation/prose mismatch, with no evidence here that any of
  these surfaces is deployed or published

Fund is intentionally registry-free. `redeem` pays only the addresses supplied by its caller, and the complete work is
`O(tokens.length)`. A token omitted from a successful call remains in Fund, while the user's GBX has already been burned.
Splitting a desired basket across later burns is not economically equivalent: if a holder starts with supply fraction
`f` and first burns fraction `x`, the remaining fraction for omitted assets becomes `(f - x) / (1 - x) < f`.

The tracked landing app repeatedly promises every holding in one transaction, including illiquid assets, and its own
brief specifies the same behavior. The deck likewise promises every holding, says that exit is always available, and
presents a discount as necessarily profitable and gap-closing. The separate web mechanism title repeats the everything
claim even though its adjacent note correctly limits payout to named assets. These claims contradict the implemented
and documented selective-redemption architecture. They also exceed the core's explicit position that discount
redemption may support price but does not guarantee profit, liquidity, or convergence.

The minimal current-architecture remediation is documentation-only: say that a holder names the assets to redeem,
receives a pro-rata share of those selected balances, and permanently gives up omitted shares. Describe discount
arbitrage as possible support, never a guarantee. If complete-basket redemption is the intended product instead, the
contract needs a separately reviewed bounded-discovery, registry, or redemption-receipt design; copy alone cannot close
that architecture gap.

## Supplied ChatGPT direct-audit intake

The 2026-08-29 ChatGPT-authored direct review was received and independently dispositioned on 2026-08-30. Its preserved
raw SHA-256 is `c4628c164d743b137919bf24914ab9d3efc4bc911130cb636fa2f0477c16defd`. Exact duplicate mappings, the confirmed
complete-Fund-basket claim mismatch, the BribeRouter headroom reproduction, stale evidence corrections, and the proposed
one-at-a-time discussion order are in `CHATGPT-DIRECT-AUDIT-INTAKE.md`. Imported labels do not replace the CEX severity
method or inflate duplicate counts.

## V12 candidate revalidation

Every prior vendor candidate was retraced against the current graph; the label `Invalid` was not treated as clearance.

| V12 ID | Current independent disposition                                                                                                                       | Assumption and test/trace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 249562 | Deployment authenticity gate: exact SignalGBX runtime, constructor and graph verification still required.                                             | Assumption: only a signed manifest bound to runtime/initcode hashes, constructor arguments, immutables, and reciprocal edges establishes a canonical SignalGBX. Trace: `TEST-EVIDENCE.md` E-03 and E-15.                                                                                                                                                                                                                                                                                                                                                              |
| 249587 | Rejected by target execution bounds: approximately `2^256` successful replacements cannot fit the target's finite block-number/gas execution history. | Assumption: epoch IDs start in range and advance by one checked increment per successful replacement, with no storage corruption. The 32,000,000 block gas limit and target execution history cannot admit `2^256` successful transactions. Trace: `TEST-EVIDENCE.md` E-03/E-10.                                                                                                                                                                                                                                                                                      |
| 249649 | Payment-token admission cannot prove semantics; unsupported-token boundary, not a canonical-token exploit.                                            | Assumption: governance admits only reviewed standard, non-rebasing, non-fee payment tokens; address/code checks cannot prove that behavior. Trace: `TEST-EVIDENCE.md` E-08.                                                                                                                                                                                                                                                                                                                                                                                           |
| 249680 | Malicious/alias Fund ledgers can corrupt their own selected accounting; healthy omitted assets remain isolated.                                       | Assumption: the redeemer knows at least one independently accounted healthy asset and omits hostile aliases. Tests: `packages/contracts/test/minimal/Fund.t.sol::test_RedeemRejectsDifferentAddressesThatDebitOneSharedLedger` and `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_FundOmissionKeepsHealthyExitIndependentOfRevertingBalanceView`.                                                                                                                                                                              |
| 249689 | Rejected: Mine payment is at most `uint192.max`; doubling fits below `2^193` before clamping.                                                         | Assumption: `initialPrice` remains a `uint192` value created only by Mine's checked/clamped transition. Test: `packages/contracts/test/minimal/Mine.t.sol::test_NextStartingPriceCapsAtTheAbsoluteMaximum`.                                                                                                                                                                                                                                                                                                                                                           |
| 249690 | Deployment runtime/immutable/Router/USDG gate remains unresolved until a signed current manifest exists.                                              | Assumption: no address is canonical until exact bytecode, immutables, token identities, and Router bindings are manifest-verified on the target chain. Traces: `TEST-EVIDENCE.md` E-03, E-10, and E-15.                                                                                                                                                                                                                                                                                                                                                               |
| 249691 | Authentic factories construct the expected graph; counterfeit deployment is covered by the same gate.                                                 | Assumption: Resonance and both factories are the manifest-authenticated instances with their one-time bindings intact. Tests: `packages/contracts/test/minimal/Resonance.t.sol::test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph` and `packages/contracts/test/minimal/Factories.t.sol::test_ACreatedStrategyIsPairedWithItsOwnRouter`.                                                                                                                                                                                                                          |
| 249692 | Deceptive payment/reward tokens remain explicitly unsupported; blast radius tested separately.                                                        | Assumption: canonical payment/reward tokens obey the stated standard-token model; mutable callback, fee, rebase, and false-return behavior is unsupported. Trace: `TEST-EVIDENCE.md` E-08.                                                                                                                                                                                                                                                                                                                                                                            |
| 249693 | Reciprocal factory getters prove consistency, not honest bytecode; deployment gate retained.                                                          | Assumption: getter reciprocity is necessary but runtime/initcode hashes and constructor evidence are independently authenticated. Traces: `TEST-EVIDENCE.md` E-03 and E-15.                                                                                                                                                                                                                                                                                                                                                                                           |
| 249694 | Direct standalone Strategy is noncanonical; integrations must authenticate Resonance registration.                                                    | Assumption: only a Strategy reported registered by the manifest-authenticated Resonance is canonical. Test: `packages/contracts/test/minimal/Resonance.t.sol::test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`; deployment-authentication gap: `TEST-EVIDENCE.md` E-15.                                                                                                                                                                                                                                                                                         |
| 249695 | Confirmed as CEX-01; original source vulnerable, working-tree remediation and permanent regression added.                                             | Assumption: the public graph and standard USDG permit the exact schedules in CEX-01. Trace: `TEST-EVIDENCE.md` E-05; test: `packages/contracts/test/minimal/audit-exitability/CEX01CrossVersionRegression.t.sol::test_OriginalOverflowSequenceMustLeaveSignalPrincipalRemovable`.                                                                                                                                                                                                                                                                                     |
| 249696 | Direct standalone BribeRouter is noncanonical; canonical addStrategy orders registration correctly.                                                   | Assumption: only the BribeRouter created and registered by the authenticated Resonance/factory transition is canonical. Tests: `packages/contracts/test/minimal/Factories.t.sol::test_ACreatedStrategyIsPairedWithItsOwnRouter` and `packages/contracts/test/minimal/Resonance.t.sol::test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`.                                                                                                                                                                                                                         |
| 249697 | Nominal Strategy transfer accounting is accepted only for reviewed standard payment tokens.                                                           | Assumption: the payment token transfers the nominal requested amount without fee, rebase, callback mutation, or balance deception. Test: `packages/contracts/test/minimal/Strategy.t.sol::test_CompletePaymentSplitsInlineAndAdvancesTheEpoch`; unsupported-token trace: `TEST-EVIDENCE.md` E-08.                                                                                                                                                                                                                                                                     |
| 249698 | Nominal Bribe transfer accounting is accepted only for reviewed standard reward tokens; scalar isolation retained.                                    | Assumption: a supported reward token transfers nominal amounts conventionally; a broken registered token is isolated through scalar claims. Test: `packages/contracts/test/minimal/BribeFlow.t.sol::test_AllTokenFailureIsAtomicAndScalarClaimsIsolateABrokenToken`; token-boundary trace: `TEST-EVIDENCE.md` E-08.                                                                                                                                                                                                                                                   |
| 249699 | Early ownership loss makes a partial candidate unrecoverable; abandon before exposure.                                                                | Assumption: setup ownership is retained until every one-time binding completes; after premature ownership loss no alternate privileged binding path exists. Tests: `packages/contracts/test/minimal/Factories.t.sol::test_BribeFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse`, `packages/contracts/test/minimal/Factories.t.sol::test_StrategyFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse`, and `packages/contracts/test/minimal/SignalGBX.t.sol::test_SetResonanceIsOwnerOnlyValidatesIdentityAndBindsOnce`; lifecycle trace: `TEST-EVIDENCE.md` E-03. |
| 249700 | Exact external governance/delay/cancellation model remains a deployment blocker, not a runtime exit dependency.                                       | Assumption: existing known-position exits remain permissionless, while production ownership is not transferred until the external executor is separately authenticated and reviewed. Trace: `TEST-EVIDENCE.md` E-03 and release-gate trace E-15.                                                                                                                                                                                                                                                                                                                      |
| 249701 | Mine/GBX/USDG/Router exact-graph verification remains part of the deployment cluster.                                                                 | Assumption: the immutable graph is accepted only after exact identities and permanent minter state match the signed manifest. Test: `packages/contracts/test/minimal/Fund.t.sol::test_RedeemRequiresAFinalizedReciprocalMineIdentity`; remaining manifest gap: `TEST-EVIDENCE.md` E-15.                                                                                                                                                                                                                                                                               |
| 249702 | Confirmed as CEX-04 with permanent public-call PoC.                                                                                                   | Assumption: an unbound Mine candidate is publicly callable before `GBX.setMinter` and is not abandoned after a slot is touched. Test: `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol::test_Repro_PreBindingMineSlotCaptureSettlesAfterHandoff`.                                                                                                                                                                                                                                                                                          |
| 249703 | Umbrella deployment-authenticity duplicate; reciprocal getters alone remain insufficient.                                                             | Assumption: internal consistency does not authenticate code or authority; exact hashes, immutables, receipts, and ownership state are required. Traces: `TEST-EVIDENCE.md` E-03 and E-15.                                                                                                                                                                                                                                                                                                                                                                             |
| 249704 | Counterfeit Fund graph is caught only by manifest/runtime/immutable verification before funding.                                                      | Assumption: integrations fund/redeem only through the manifest-authenticated Fund/GBX/Mine graph; reciprocal getters alone may be counterfeited. Traces: `TEST-EVIDENCE.md` E-03 and E-15.                                                                                                                                                                                                                                                                                                                                                                            |
| 249705 | Confirmed as CEX-02 with quantified reward loss; ADR 0053 is internally verified in the working tree and awaits independent closure.                  | Starting-source assumption: third-party claims are permissionless and the victim's per-checkpoint share is below one raw unit. Preserved PoC: `packages/contracts/test/minimal/audit-exitability/reproductions/CEX-02-original-f991253.t.sol.disabled`; current regression: `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol::test_Regression_ThirdPartyClaimsCannotForceFractionalAccountCheckpoints`; complete current receipt: `TEST-EVIDENCE.md` E-16.                                                                                 |
| 249706 | Mint authority must bind only the manifest-verified Mine; one-time handoff is irreversible.                                                           | Assumption: the setup minter authenticates the Mine before consuming the one-time handoff; reciprocal `gbx()` alone is not authenticity. Tests: `packages/contracts/test/minimal/GBX.t.sol::test_MinterHandoverIsOneTimeAndRequiresDeployedCode` and `packages/contracts/test/minimal/GBX.t.sol::test_OnlyPermanentlyBoundMineCanMint`; authentication gap: `TEST-EVIDENCE.md` E-15.                                                                                                                                                                                  |

## Rejected and bounded new candidates

| Candidate                                                | Disposition and evidence boundary                                                                                                                       | Assumption and test/trace                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Caller-sized SignalGBX batches can exceed the gas limit  | True for optional convenience, but atomic rollback and scalar Strategy-by-Strategy removal remain. CEX-03 is the separate discovery caveat.             | Assumption: the account knows each Strategy key and scalar removal remains callable; no batch is the sole exit. Tests: `packages/contracts/test/minimal/audit-exitability/AuditGas.t.sol::test_Gas_SixteenAllocationBatchWithAccruedMaximumRewardRegistry` and `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_DuplicateBatchFailureRollsBackAndScalarFallbackFullyExits`.                                              |
| Duplicate add/remove batch entries corrupt ledgers       | Rejected: entries execute sequentially; over-removal reverts and rolls back custody and all earlier entries.                                            | Assumption: Solidity transaction atomicity and the canonical sequential hooks are unchanged. Tests: `packages/contracts/test/minimal/SignalGBX.t.sol::test_AddSignalManyAllowsDuplicateStrategiesAsSequentialAllocations` and `packages/contracts/test/minimal/SignalGBX.t.sol::test_RemoveSignalManyRollsBackEarlierRemovalWhenLaterRemovalFails`.                                                                                                           |
| Killed Strategy weight is subtracted twice               | Rejected: kill removes active weight once; later removal conditionally skips the live total.                                                            | Assumption: the position belongs to the canonical paired Bribe and kill is executed through Resonance. Test: `packages/contracts/test/minimal/SignalGBX.t.sol::test_RemoveFromKilledStrategyDoesNotDecrementActiveWeightTwice`.                                                                                                                                                                                                                               |
| Broken Bribe token blocks signal principal               | Rejected: signal changes checkpoint bounded arithmetic but make no reward-token call. CEX-01 was the missing arithmetic bound.                          | Assumption: canonical GBX transfers and bounded Bribe/Resonance arithmetic work; the broken reward fails only on token interaction. Tests: `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_LiveSixteenRewardStrategyReturnsPrincipalWithBrokenRewardToken` and `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_KilledSixteenRewardStrategyReturnsPrincipalWithBrokenRewardToken`. |
| Broken reward blocks every claim                         | Rejected: the all-token convenience call is atomic, while scalar `claimReward` isolates a healthy token and preserves failed-token entitlement.         | Assumption: at least one selected reward is healthy and the caller uses its scalar selector. Test: `packages/contracts/test/minimal/BribeFlow.t.sol::test_AllTokenFailureIsAtomicAndScalarClaimsIsolateABrokenToken`.                                                                                                                                                                                                                                         |
| Router inactivity blocks principal                       | Rejected: neither Router is called by signal removal, Mine zero-price settlement, Fund redemption, or an already accrued scalar reward claim.           | Assumption: the user invokes a direct scalar exit after any required Mine one-hour decay; the canonical exit graph is intact. Source trace: `TEST-EVIDENCE.md` E-03; test: `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_ZeroPriceMineReplacementSettlesWhileUSDGTransfersAreDisabled`.                                                                                                                               |
| Fund transient marks poison a caught retry               | Rejected by EIP-1153 frame-revert semantics and the dedicated same-outer-transaction caught-revert regression; successful calls explicitly clear marks. | Assumption: the target executes Cancun EIP-1153 frame-revert and transaction-clearing semantics. Tests: `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_FailedFundRedemptionCanRetrySameTokenInsideOneOuterTransaction` and `packages/contracts/test/minimal/Fund.t.sol::test_TransientDuplicateMarksAreClearedBetweenCallsInOneTransaction`; live opcode trace: `TEST-EVIDENCE.md` E-10.                               |
| One malicious Fund asset globally blocks redemption      | Rejected: caller-selected one-token redemption omits it. Selecting it reverts the complete attempted burn atomically.                                   | Assumption: the redeemer knows and selects a distinct healthy asset and accepts forfeiting omitted assets. Test: `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_FundOmissionKeepsHealthyExitIndependentOfRevertingBalanceView`.                                                                                                                                                                                        |
| Fund denominator can be zero for a valid redeemer        | Rejected: positive GBX supplied by the redeemer implies positive total and effective supply; target-representable Mine arithmetic stays in range.       | Assumption: the caller holds a positive GBX amount and Mine is the finalized reciprocal minter. Tests: `packages/contracts/test/minimal/Fund.t.sol::test_RedeemRequiresTheCallerToActuallyHoldTheGBX` and `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_DefensiveModel_MineAndFundUint256OverflowRequiresTimestampBeyondTargetUint64`.                                                                                |
| Miner-claim accumulator can overflow under standard USDG | Rejected: after collection Mine holds at least old claims plus payment, bounded by the token's representable supply.                                    | Assumption: USDG is standard, non-rebasing, non-fee, and cannot create balances beyond representable supply. Test: `packages/contracts/test/minimal/Invariants.t.sol::invariant_MineIsSolventAgainstReplacementClaims`; adversarial boundary: `TEST-EVIDENCE.md` E-08.                                                                                                                                                                                        |
| USDG failure permanently blocks Mine GBX settlement      | Rejected: after one hour a zero-price replacement makes no USDG or Router call. USDG claims themselves intrinsically depend on USDG.                    | Assumption: the slot's one-hour decay completes, the GBX minter graph is correct, and only USDG interaction is disabled. Test: `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_ZeroPriceMineReplacementSettlesWhileUSDGTransfersAreDisabled`.                                                                                                                                                                           |
| BribeRouter reentrancy corrupts supported principal      | Rejected under standard tokens; a direct transfer callback cannot duplicate the route and remains confined to the unsupported token/reward buffer.      | Assumption: supported payment/reward tokens do not invoke mutable callbacks; callback-capable tokens are outside the supported model and BribeRouter holds no signal principal. Test: `packages/contracts/test/minimal/Adversarial.t.sol::test_AHostilePaymentTokenCannotReenterBribeRouterRoute`; E-08 also records the approval-callback boundary.                                                                                                          |
| Strategy self-receiver permanently captures revenue      | Rejected as auction ordering: inventory stays in Strategy and any buyer can pay the restarted floor; no user has a deferred principal claim.            | Assumption: a later buyer can transfer the current payment token and choose a non-Strategy receiver; no prior buyer retains an onchain claim. Test: `packages/contracts/test/minimal/Strategy.t.sol::test_RevenueReceiverEqualToStrategyLeavesTheRevenueForTheNextEpoch`.                                                                                                                                                                                     |
| Mine/Strategy price multiplication overflows             | Rejected by source bounds and boundary fuzzing.                                                                                                         | Assumption: prices enter multiplication only through checked constructor/state bounds and are clamped before narrowing. Tests: `packages/contracts/test/minimal/Mine.t.sol::test_NextStartingPriceCapsAtTheAbsoluteMaximum` and `packages/contracts/test/minimal/Strategy.t.sol::test_TheNextStartingPriceIsCappedAtTheAbsoluteMaximum`; differential trace: `TEST-EVIDENCE.md` E-06.                                                                         |
| Large halving count reverts                              | Rejected: EVM right shifts at 256+ yield zero and Mine applies the positive tail.                                                                       | Assumption: standard EVM shift semantics and the hard-coded positive `TAIL_TPS` remain unchanged. Test: `packages/contracts/test/minimal/Mine.t.sol::test_GlobalRateEventuallyUsesTheFixedTail`.                                                                                                                                                                                                                                                              |
| Resonance direct donations consume index capacity        | Rejected: only accepted notifications schedule revenue or increment the new lifetime counter.                                                           | Assumption: funds arrive by a plain token transfer without a Router notification; direct balances are not treated as fresh notified revenue. Test: `packages/contracts/test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol::test_ResonanceActiveRolloverCountsOnlyFreshRevenueAndExcludesDonations`.                                                                                                                                                  |
