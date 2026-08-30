# Signal and Resonance residual risks

This local campaign is not an independent audit or proof of safety. The older native-fuzzer results predate ADR 0034's
removal of the local Governor and Timelock, ADR 0036's governed global Bribe share, ADR 0037's high-precision Bribe
index, ADR 0047's reward and Strategy-settlement simplification, and ADR 0048's sixteen-token and composed-move
change. Focused ADR-0048 suites passed 104/104 and its revised mutation campaign killed 47/47 targeted mutants, but
both results predate ADRs 0049-0051. A separate pre-ADR-0053 snapshot on 2026-08-30 reran Medusa and attempted Echidna as
recorded below; neither that internal evidence nor the later ADR 0052-0053 reconciliation is independent assurance. ADR
0051's signal batches, ADR 0053's Bribe claim authorization/batch, and ADR 0055's Mine Router and ownership changes
remain outside V12's `3ae171b` scope.

1. ADR 0028 accepts that a killed Strategy's final signal exit can leave the remaining active Bribe stream and later
   zero-supply notifications permanently unclaimable. Reward time continues rather than pausing, and there is no
   queue. ADRs 0035/0037 prevent Bribe cumulative-index overflow without adding a rescue, refund, retirement, sweep,
   Fund redirection, or escape hatch.
2. Each token/Bribe pair can accept at most `floor((2^256 - 1) / 1e36)` notified raw units over its complete lifetime.
   Claims, completed streams, zero supply, and Strategy death never restore headroom. The limit is
   effectively unreachable for a conventional 18-decimal asset but can constrain unusually high-decimal tokens. If an
   automatic reward exhausts the cap, its amount remains buffered in BribeRouter while Fund has already received its
   complement directly from Strategy. Because BribeRouter routes only its complete balance, a direct donation one raw
   unit above remaining headroom can make that complete buffer permanently unrouteable before exact cap exhaustion.
   ADR 0052 separately applies the same precision-coupled lifetime bound to Resonance's one USDG stream. At exhaustion,
   USDG already deposited remains buffered in that ResonanceRouter permanently, but the rejection occurs before
   checkpointing and preserves existing Strategy distributions and signal exits. ADR 0055 permits only later Mine
   deposits to use a separately deployed replacement graph.
3. The pre-ADR-0053 Medusa 1.5.1 campaign completed 100,669 calls, covered 3,430 branches with corpus 90, and passed all
   26 properties plus 44 assertions. That is one internal seed, not proof. The current local Echidna 2.3.3 attempt is
   invalid evidence: every worker crashed in `Set.elemAt`, with zero calls and zero of 26 properties executed; the
   validator correctly rejects its misleading exit-zero/JSON-success surface. The pinned Echidna 2.3.2 Docker path
   could not run because Docker remains unavailable. Therefore no valid current-tree Echidna campaign or second
   external seed is claimed.
4. Pre-ADR-0053 Slither 0.11.5, Aderyn 0.6.8, Semgrep 1.162.0, and Gitleaks 8.30.1 completed, but the integrated static
   gate remained red: the disposition register expired on 2026-08-23 and the Aderyn `missing-inheritance` rationale
   covered 56 registered instances versus 105 current instances. Manual triage found no plausible new blocker, but it
   does not substitute for renewing the exact policy register. Mythril 0.24.8 still cannot analyze the
   constructor-resolved immutable/Cancun-opcode graph fail-closed, and no compatible symbolic or formal proof is
   claimed.
5. Gitleaks now passes with narrow path-and-regex conjunctions for reviewed public chain identifiers and historical
   test fixtures. A future match outside those exact conjunctions remains blocking; the allowlist is not independent
   secret review.
6. The npm dependency graph retains three Low and one Moderate advisory in Hardhat/tooling transitives. The current
   High nanoid advisory was removed. These packages are not protocol runtime dependencies, but must be revisited when
   compatible upstream releases exist.
7. The host default Python 3.14.6 is outside the pinned 3.11 policy and lacks the test dependencies. The exact locked
   Python gate passes through a disposable `/tmp` Python 3.11.14 environment; future runs must recreate or supply an
   equivalent `GUMBALL_PYTHON` environment rather than relying on the host default.
8. Forge coverage emits known source-map anchor warnings. The run completed and the parsed LCOV policy passed; those
   warnings prevent interpreting the percentages as a formal reachability proof.
9. Reward and payment tokens admitted by the Resonance owner are externally implemented. Strategy, Resonance, Bribe,
   their Routers, Mine, and SignalGBX assume standard, non-rebasing ERC-20 behavior and use `SafeERC20` without exact balance-delta
   verification. Fee, surcharge, rebasing, shared-ledger, callback, or sticky-allowance behavior may revert, underfund
   accounting, consume surplus, or make that market unusable. Fund redemption retains local exact payout and basket
   checks because its selected tokens are arbitrary.
10. SignalGBX historical voting power survives removal after a checkpoint. No local Governor now bounds
    that property: proposal snapshots, delay, period, threshold, quorum, execution scope, and cancellation are all
    unselected external-integration decisions. Voting-power rental risk must be reviewed against the exact system.
11. No exact external-governance release, permission/admin graph, execution policy, ownership handoff, mainnet fork,
    deployment receipt, legal clearance, signed manifest, or independent review was produced. The tree is suitable
    for independent review, not release authorization.
12. Mine revenue routing is intentionally asynchronous after the nominal Router deposit requested through `SafeERC20`.
    `route()` is permissionless but has
    no designated caller or bounty, so qualifying USDG may wait indefinitely and the eventual caller can influence
    notification timing. A balance below `REWARD_DURATION` raw units remains buffered until another deposit even
    after the active stream finishes. Optional frontend or cron automation is periphery, not a protocol liveness
    guarantee.
13. The Resonance owner may set the global prospective automatic-Bribe share anywhere from 0% through 20%. The change
    cannot reprice an earlier purchase, Fund balance, buffered Bribe share, active stream, or claim. Each purchase
    floors independently with no split carry. A 0% rate does not block signal operations, but governance can
    materially change future Fund backing and signaler incentives around pending auctions. The external integration
    must define delay, cancellation, batching, monitoring, and emergency behavior for this lever; the current core
    supplies none.
14. Each Bribe may register sixteen reward tokens. ADR 0051's signal batches multiply that bounded per-Strategy work
    across caller-selected allocations. The current audit measured 16-allocation add and remove calls at 1,672,277 and
    2,239,499 gas respectively under its fixture. Those observations are environment-specific rather than a deployment
    guarantee. Scalar exit stays bounded for each known Strategy key, but does not solve unknown-key discovery.
15. A stale, dead addition, insufficient position, or other invalid allocation reverts the complete batch after any
    earlier checkpoint work. Atomic rollback preserves state but not gas. SDK discovery must refresh onchain and split
    batches when simulation or gas estimation requires it.
16. Permissionless Strategy distribution lets any caller choose a Strategy's USDG checkpoint cadence. CEX-08 reproduces
    a per-Strategy floor where repeated half-unit checkpoints pay zero while an uncheckpointed control combines the
    halves. The loss is less than one raw USDG unit per effective checkpoint, does not block signal principal, and is
    accepted by the current no-carry architecture unless a later ADR changes it.
17. ADR 0053 removes direct third-party Bribe claims and therefore closes the reproduced outsider-selected account
    checkpoint cadence in the working tree. Resonance's replacement convenience batch always claims for `msg.sender`,
    but its Strategy array is caller-controlled and each entry may traverse sixteen reward tokens. A large batch can
    exceed gas, and one invalid Strategy or broken token reverts the complete batch. Direct scalar Bribe claims remain
    the bounded healthy-token fallback. Remediated and internally verified in the working tree; independent closure,
    deployment authorization, and user-fund authorization remain pending. No post-ADR-0053 Medusa, Echidna, static,
    symbolic, formal, or independent-review result is claimed.
18. ADR 0055 makes Mine and Resonance `Ownable2Step` and gives Mine one setter for future revenue routing. Reciprocal
    GBX, USDG, Fund, Router, Resonance, and SignalGBX getters reject crossed graphs but cannot authenticate honest
    bytecode. A compromised owner can divert later protocol revenue, and the core supplies no delay, veto, or rollback.
    Old balances, schedules, rewards, claims, and signal positions do not migrate. Users remain dependent on the old
    graph's own claim and unsignal paths, which a Mine switch cannot repair if already broken. The replacement SignalGBX
    is a new address; an external governance system tied to old sGBX checkpoints needs a separately reviewed voting-
    token transition. No pre-ADR-0055 audit, mutation, invariant, fork, ABI-consumer, or governance-receipt evidence
    covers this surface. E-19 adds current internal deterministic/stateful, 8/8 focused Mine-mutation, consumer, and
    launcher-fork coverage, but it is not a complete 77-mutant run, selected-governance receipt, independent review, or
    release authorization.
