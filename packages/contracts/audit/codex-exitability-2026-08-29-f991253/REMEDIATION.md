# Remediation plan

## P0 — Close principal-exit requirements before any exposure

### 1. Retain and independently review the Resonance lifetime cap

Status: implemented in the working tree under ADR 0052; not independently closed.

Minimal construction:

```solidity
uint256 public constant MAX_LIFETIME_REVENUE_AMOUNT =
    type(uint256).max / REWARD_PRECISION;

uint256 public lifetimeRevenueNotified;

error RevenueLifetimeCapExceeded(
    uint256 notified,
    uint256 requested,
    uint256 maximum
);
```

`notifyRevenue` must reject zero, cap overflow, and active-stream threshold failure before checkpointing or token
interaction; then checkpoint, pull standard USDG, set the schedule, and monotonically record the fresh amount. There is
no reset, setter, saturation, wrap, or admin override.

Compatibility and tradeoff:

- The source/API gains two getters and one error; runtime bytecode and all artifact hashes change.
- Exact lifetime exhaustion permanently stops new Resonance admissions and leaves later Router revenue buffered.
- No normal-horizon economics change is measurable because the bound is approximately `1.158e41` raw USDG.
- Existing immutable deployments cannot adopt the fix and must not be exposed.

Required closure evidence:

- preserve the original public-function PoC and its original-source result;
- accept the exact cap and reject cap plus one/headroom plus one before state/custody mutation;
- prove active rollover counts fresh input once, zero-weight schedules consume capacity, and donations do not;
- prove live/killed scalar exits with 0, 1, and 16 rewards at the cap, including a broken reward token;
- run full 1,000 × 500 stateful escapes, differential models, gas, mutation, ABI, docs, SDK, subgraph, and workspace gates;
- independently review the proof that cumulative emitted revenue never exceeds cumulative fresh admissions.

### 2. Decide and implement bounded current-state position discovery

CEX-03 cannot be fixed in periphery alone under the review's “no historical/indexer-only exit” requirement.

Preferred architecture:

- keep amounts canonical only in paired Bribes;
- maintain an O(1) current per-account Strategy membership set at the canonical Resonance transition;
- add/remove membership only on canonical zero-to-nonzero/nonzero-to-zero changes;
- expose offset/limit pagination and count, never a mandatory whole-array read;
- refresh every returned amount directly from the paired Bribe;
- preserve killed positions until their complete removal;
- ensure duplicates in one batch do not duplicate membership and complete transaction rollback restores membership.

Tradeoffs: permanent storage growth/churn, higher signal gas, larger core ABI, new invariant-critical code, potential
index corruption, and migration difficulty. A global Strategy list alone makes a user's fallback grow with global state
and does not satisfy the requirement. Record the decision in an ADR before implementation.

Required tests: scalar/batch duplicate additions, partial and final removal, killed exit, reverted later batch entry,
re-add after zero, swap/pop edge cases, pagination stability, four-ledger reconciliation, fuzz/invariant escape using only
current state, and target gas at long membership history.

### 3. Align release-facing Fund and arbitrage claims with the implemented mechanics

CEX-09 is a documentation/implementation mismatch, not authorization to change Fund silently. Before any release:

- replace the complete-basket claims in `apps/landing`, `docs/deck/gumball6900-deck.html`, and
  `apps/web/components/home/mechanism-dashboard.tsx` with the exact caller-selected model;
- say that holders redeem a pro-rata share of the Fund assets they select and permanently give up omitted shares;
- state that the asset list is supplied by the caller, is not discoverable from a bounded Fund registry, and must fit in
  one successful atomic redemption for the original fraction;
- describe discount arbitrage as possible support, never guaranteed profit or guaranteed gap closure; and
- add a release-copy check that rejects unqualified complete-basket, NAV, guaranteed-profit, and guaranteed-convergence
  language while preserving the protocol facts source as the canonical claim boundary.

If the intended product is instead a complete-basket claim, stop and record a new ADR. A registry, pagination model, or
redemption receipt changes custody/accounting assumptions and needs separate implementation, gas analysis, migration
planning, invariants, and independent review.

### 4. Build the exact deployment and governance evidence pipeline

Do not deploy until a new current-graph schema binds:

- source commit, solc long version/settings, artifacts and init/runtime hashes/sizes;
- constructor transactions/arguments and immutable values;
- every canonical address and reciprocal graph edge;
- GBX minter lock, untouched Mine slots, Router/factory/SignalGBX bindings;
- every initial Strategy/Bribe/BribeRouter and reviewed external LP token;
- removal of temporary SignalGBX/StrategyFactory/BribeFactory owners;
- exact external governance runtime, admin/upgrade graph, voting token, proposal threshold, quorum, delay, cancellation,
  batching semantics, ownership receipt, and signer/authorization evidence;
- signed manifest payload and current authorization, with no credential material committed.

Any mismatch or pre-binding Mine activity requires abandonment and redeployment before exposure. CI must remain
non-broadcasting.

## P1 — Resolve material reward and integration grief

### 5. Independently close ADR 0053's beneficiary-authorized Bribe claims

ADR 0053 selects and the working tree implements the wallet-native option: both existing Bribe claim selectors accept
only the beneficiary or the Bribe's immutable Resonance and reject other callers with
`UnauthorizedClaimCaller(caller, account)` before checkpoint mutation. A Safe/ERC-4337 account executes as itself.
This removes direct keeper/relayer claims for EOAs and prevents an outsider from choosing the beneficiary's flooring
cadence.

Resonance provides the narrow convenience path `claimBribeRewards(strategies)`. It always claims for `msg.sender`,
validates each canonical registered Strategy, supports live and killed Strategies, allows sequential duplicates, and
rejects an empty batch. Batch length is caller-controlled and the complete call is atomic. A failed token or invalid
entry may revert the whole batch, so direct scalar Bribe claims remain the broken-token and gas fallback.

The original public-function PoC is preserved with a noncompiled extension. The focused current regression is
`HistoricalExitabilityFindingsTest.test_Regression_ThirdPartyClaimsCannotForceFractionalAccountCheckpoints`. Internal
verification shows outsider calls leave paid indexes/rewards unchanged; EOA and contract-wallet self-claims work; many
sub-unit intervals equal one deferred checkpoint; live/killed, duplicate, empty, and unregistered Strategy batches have
the specified semantics; batch failures roll back; hostile callbacks cannot reenter; and broken-token scalar isolation
remains.

The post-ADR-0053 receipt is 367/367 Foundry across 29 suites and 32/32 total `ProtocolInvariantsTest` tests: 30 invariant
properties at 1,000 runs × 500 depth (500,000 handler calls per property) plus two deterministic reachability tests, with
31/31 selectors reached and zero reverts/discards in the invariant campaign; Hardhat 4/4 with bytecode parity;
integration 10/10 at 256 fuzz runs; corrected mutation 70/70 test-killed with zero survivors/errors; and the exact gas
and consumer/workspace-component results in `TEST-EVIDENCE.md` E-16. Remediated and internally verified in the working
tree; independent closure, deployment authorization, and user-fund authorization remain pending. The final root
`pnpm test` rerun passed 9/9 Turbo tasks; unrelated repository-wide formatting blockers remain open.

Scaled per-account/token remainder carry is not selected. It would preserve permissionless claims but adds storage,
gas, and accounting complexity and changes the deliberate no-carry design; any later adoption requires a new ADR and
differential proof.

### 6. Close or harden the Mine pre-binding window

Source-hardening option: only while an outgoing slot is empty, require `gbx.minterLocked()` and
`gbx.minter() == address(this)` before installing its first tenure. This adds permanent-fact reads only once per slot and
prevents setup contamination, but changes the deliberately minimal Mine deployment behavior.

Operational option: atomically/private deploy and bind, then record all sixteen slots as untouched in a signed receipt.
Because public addresses are observable, “not published in the frontend” is not a control. Keep the permanent PoC either
way.

### 7. Separate deployment parsing from authentication in the SDK

Status: the explicit-name option is implemented and internally verified in the working tree.

The unverified `status` field is now `claimedStatus`; the selector option is
`requireClaimedReleaseApproved`. Parser/selector documentation says that these are caller claims rather than
authentication, and the strict schema rejects the legacy key. A future production release must still introduce a
branded `VerifiedProtocolDeployment` or another reviewed boundary returned only after signature, manifest, artifact,
immutable, graph, ownership, and chain checks. Transaction builders used in production must consume that verified
evidence. No arbitrary input may be presented as authenticated release approval.

## P1 — Close target-chain execution evidence

Extend fork evidence to bind mainnet and testnet block/hash, ArbOS version, effective tx/block gas limits, official chain
configuration, source/compiler settings, exact artifact hashes/sizes, and live creation-code opcode probes. Add a pinned
non-broadcast deployment/fork campaign that executes the actual Fund artifact and proves:

- duplicate arrays in any order;
- caught failed subcall followed by same-token retry in one transaction;
- two successful same-token redemptions in one transaction;
- failed transfer/balance delta rolls back burn and transient marks;
- nested callback/reentrancy behavior;
- one-token and practical multi-token gas below the observed 32,000,000 limit.

Live TSTORE/TLOAD support is observed; this exact-artifact campaign remains required before deployment.

## P2 — Evidence and assurance improvements

- Add explicit mutation operators for the new lifetime check/counter/order and every newly added discovery transition.
- Keep the arbitrary-prefix escape invariants at 1,000 runs × depth 500 or stronger; add one-raw-unit signals to handler
  distributions so arithmetic edges are reachable without direct storage writes.
- Extend the external state-machine harness to actively perform Fund, Mine, miner-claim, scalar Bribe, and known-position
  signal escapes, not only inspect balance equalities.
- Run the pinned static and external-fuzzer environment in CI. The local macOS alternative is useful evidence but cannot
  replace the locked Docker digest when the lock explicitly requires it.
- Replace the Mythril gate or policy only after a reviewed tool can resolve constructor immutables and Cancun opcodes;
  never treat incompatible symbolic output as a pass.
- Add explicit Matchstick duplicate SignalPosition event-order coverage and SDK tests proving deployment selection is not
  authentication.
- Preserve command logs, seeds, raw reports, and commit binding. Expire dispositions when source or tool versions change.

## No source change recommended

- CEX-08's outsider-selected Strategy flooring and the analogous ordinary global/Strategy floors are accepted by the
  current no-carry accounting architecture. A scaled carry would change that architecture and needs a new ADR,
  differential accounting proofs, and fresh review; do not slip it into a local rounding patch.
- Preserve the registry-free, caller-selected Fund model and describe one-token redemption as selective realization,
  not as an economically equivalent scalar claim on every Fund balance. Current complete-basket and guaranteed-arbitrage
  claims are CEX-09 and must be removed before release. Retaining those claims instead requires a new ADR and a separately
  audited registry or redemption-receipt design.
- A BribeRouter balance above remaining lifetime headroom is accepted ownerless reward-buffer surplus, not signal
  principal. Partial routing, Fund redirection, recovery, or sweeping would change the complete-balance/fixed-split
  rules and requires an ADR.
- The Mine/Fund `uint256` overflow model requires a timestamp beyond the target client's `uint64` header field and is
  retained only as defensive evidence. Document and boundary-test genuinely target-reachable epoch and ERC-5805 clock
  horizons without presenting a host-only `vm.warp` state as a confirmed finding.
- Do not add saturation/wrapping, a pause, upgrade proxy, rescue/sweep, successor, arbitrary-call executor, or mutable
  emissions controller to address those horizons.
- Do not make Routers, keepers, liquidity, indexers, or governance a principal-exit dependency.
- Preserve one-token Fund redemption, scalar signal removal, scalar Bribe claim isolation, and killed-Strategy removal.
