# Signal and Resonance residual risks

This local campaign is not an independent audit or proof of safety. The following remain after the 2026-08-16 run.

1. ADR 0028 accepts that a killed Strategy's final signal exit can leave active and queued Bribe rewards permanently
   accounted but unreachable. No rescue, refund, retirement, sweep, or Fund redirection exists.
2. Current native campaigns passed for pinned Echidna 2.3.2 and Medusa 1.5.1, but a second external seed and the
   digest-pinned Docker path were not run. Docker remains unavailable. The Echidna result depends on a dedicated
   metadata-retaining analysis profile; the nightly result validator now rejects its prior exit-zero, zero-call crash.
3. Pinned Slither 0.11.5, Aderyn 0.6.8, Semgrep 1.162.0, and Gitleaks 8.30.1 ran on the current graph. Exact static
   dispositions still require human context and expire; a green register is not a formal proof. Mythril 0.24.8 is
   installed but rejects the constructor-resolved immutable and Cancun-opcode graph fail-closed. SMTChecker remains
   unavailable, so no symbolic or formal proof is claimed.
4. Gitleaks now passes with narrow path-and-regex conjunctions for reviewed public chain identifiers and historical
   test fixtures. A future match outside those exact conjunctions remains blocking; the allowlist is not independent
   secret review.
5. The npm dependency graph retains three Low and one Moderate advisory in Hardhat/tooling transitives. The current
   High nanoid advisory was removed. These packages are not protocol runtime dependencies, but must be revisited when
   compatible upstream releases exist.
6. The host default Python 3.14.6 is outside the pinned 3.11 policy and lacks the test dependencies. The exact locked
   Python gate passes through a disposable `/tmp` Python 3.11.14 environment; future runs must recreate or supply an
   equivalent `GUMBALL_PYTHON` environment rather than relying on the host default.
7. Forge coverage emits known source-map anchor warnings. The run completed and the parsed LCOV policy passed; those
   warnings prevent interpreting the percentages as a formal reachability proof.
8. Reward and payment tokens are governance-reviewed but externally implemented. Exact-delta checks fail closed for
   fee, surcharge, rebasing, shared-ledger, and callback anomalies; a broken token can still delay its own fixed claim.
9. SignalGBX voting power is liquid: a holder can move or withdraw after a proposal snapshot. Governor delay, period,
   threshold, quorum, timelock, and three-selector restriction bound the consequence but do not remove governance-market
   capture or voting-power rental risk.
10. No mainnet fork, deployment receipt, live role state, legal clearance, signed manifest, or independent review was
    produced. The tree is suitable for independent review, not release authorization.
