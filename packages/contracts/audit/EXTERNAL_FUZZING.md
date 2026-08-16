# External state-machine fuzzing

`harness/ProtocolStateMachineCampaign.sol` deploys and wires the current core graph without Forge cheatcodes. Three
distinct actor contracts drive atomic signaling and withdrawal, bounded signal moves, mining, routing,
Strategy purchases, claims, redemption, Strategy killing, and the bounded maintenance surface.
Echidna and Medusa share the `echidna_` property surface.

The accounting properties reconcile account, Strategy, Resonance, Bribe, mandatory signaling, emission, revenue, and
supply state.
The liveness/boundedness properties additionally prove that every represented account's complete exit remains within
the configured three-Strategy/eight-reward-token graph and that reward-token loops cannot grow beyond Bribe's immutable
cap. Killing a Strategy preserves its checkpointed Resonance claim at the fixed Strategy receiver while allowing every
incumbent signaler to remove their position without another active-denominator decrement or an inline USDG transfer.
Hostile USDG therefore cannot block dead-Strategy signal exit, and signals on unaffected Strategies remain
independently movable or withdrawable. The accounting surface also checks that SignalGBX supply equals total signal
and that cumulative router liabilities conserve every classified payment under the fixed 90/10 split.

The 2026-08-16 current-graph Medusa 1.5.1 campaign completed 101,602 calls, 3,988 branches, corpus 84, and zero failures
across 65 property/assertion surfaces. The pinned Echidna 2.3.2 campaign completed 100,213 calls with seed 6900,
42,054 unique instructions, corpus 36, and all 25 properties passing. These are local internal runs, not independent
review.

Echidna initially returned exit code zero after every worker crashed before making a call because the default Foundry
profile deliberately omits compiler metadata while the harness constructor deploys contracts containing immutables.
The dedicated `echidna` Foundry profile retains metadata only for that engine. `check-echidna-results.mjs` now rejects
the empty-call crash, any below-limit campaign, and any incomplete or failed property even when Echidna itself exits
zero. The default production build remains metadata-free.

The harness checks Resonance solvency under qualifying stream resets, accepted rounding and zero-signal surplus,
irreversible Strategy death, exact 90/10 Strategy-payment classification, and mandatory signal accounting. It does
not model ProtocolGovernor proposal lifecycles; selector, snapshot, role, queue, and execution properties are covered
by Foundry tests and still require external review. Bribe's exact carry-to-Fund policy also remains covered by
deterministic tests.

Run the pinned campaign with:

```bash
bash audit/install-tools.sh nightly
bash audit/run-nightly.sh
```

Both engines are configured for 100,000 transactions, sequences up to 150 calls, and a one-hour ceiling. `run-nightly`
also performs the Foundry campaign smoke test and the pinned static/Mythril gates. Docker remains required by the
checked nightly command for the digest-pinned Echidna image; the recorded current result used the SHA-256-verified
official native aarch64 release of the same pinned version. Raw reports and corpora are ignored engineering evidence
under `audit/reports`; a green campaign is neither an independent audit nor release approval.
