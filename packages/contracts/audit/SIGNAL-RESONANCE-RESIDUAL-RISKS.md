# Signal and Resonance residual risks

This local campaign is not an independent audit or proof of safety. Its recorded native-fuzzer results predate ADR
0034's removal of the local Governor and Timelock, ADR 0036's governed global Bribe share, ADR 0037's high-precision
Bribe index, ADR 0047's reward and Strategy-settlement simplification, and ADR 0048's sixteen-token and composed-move
change. The following are the current residuals after the 2026-08-23 development reconciliation; the recorded native
campaign results remain historical. Focused ADR-0048 suites pass 104/104 and its revised mutation campaign kills
47/47 targeted mutants.

1. ADR 0028 accepts that a killed Strategy's final signal exit can leave the remaining active Bribe stream and later
   zero-supply notifications permanently unclaimable. Reward time continues rather than pausing, and there is no
   queue. ADRs 0035/0037 prevent cumulative-index overflow without adding a rescue, refund, retirement, sweep, Fund
   redirection, or escape hatch.
2. Each token/Bribe pair can accept at most `floor((2^256 - 1) / 1e36)` notified raw units over its complete lifetime.
   Claims, completed streams, zero supply, and Strategy death never restore headroom. The limit is
   effectively unreachable for a conventional 18-decimal asset but can constrain unusually high-decimal tokens. If an
   automatic reward exhausts the cap, its amount remains buffered in BribeRouter while Fund has already received its
   complement directly from Strategy.
3. The recorded native campaigns passed for pinned Echidna 2.3.2 and Medusa 1.5.1, but a current-tree rerun, a second
   external seed, and the digest-pinned Docker path were not run. Docker remains unavailable. The Echidna result
   depends on a dedicated metadata-retaining analysis profile; the nightly result validator now rejects its prior
   exit-zero, zero-call crash.
4. Pinned Slither 0.11.5, Aderyn 0.6.8, Semgrep 1.162.0, and Gitleaks 8.30.1 ran on the then-current graph. Exact static
   dispositions still require human context and expire; a green register is not a formal proof. Mythril 0.24.8 is
   installed but rejects the constructor-resolved immutable and Cancun-opcode graph fail-closed. SMTChecker remains
   unavailable, so no symbolic or formal proof is claimed.
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
10. SignalGBX historical voting power survives movement or withdrawal after a checkpoint. No local Governor now bounds
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
14. Each Bribe may register sixteen reward tokens. The loop remains fixed, but maximum work is higher than the former
    former eight-token design: a composed move with sixteen active streams on both Bribes measured 1,890,938 gas in the
    focused suite. Deployment review must preserve sufficient chain-specific headroom.
15. SignalGBX composes source removal then destination addition. Atomic rollback preserves state when the destination
    fails, but the failed transaction may spend the source checkpoint work before reverting.
