# External state-machine fuzzing

`harness/ProtocolStateMachineCampaign.sol` deploys and wires the current core graph without Forge cheatcodes. Three
distinct actor contracts drive staking, partial unstaking, scalar and bounded-batch signal deltas, mining, routing,
Strategy purchases, claims, redemption, Strategy killing, and the bounded maintenance surface.
Echidna and Medusa share the `echidna_` property surface.

The accounting properties reconcile account, Strategy, Resonance, Bribe, staking, emission, revenue, and supply state.
The liveness/boundedness properties additionally prove that every represented account's complete exit remains within
the configured three-Strategy/eight-reward-token graph and that reward-token loops cannot grow beyond Bribe's immutable
cap. Killing a Strategy preserves its checkpointed Resonance claim at the fixed Strategy receiver while allowing every
incumbent signaler to remove their position without another active-denominator decrement or an inline USDG transfer.
Hostile USDG therefore cannot block dead-Strategy signal exit, and unallocated `sGBX` and signals on unaffected
Strategies remain independently removable.

The 2026-08-09 adversarial rerun completed 101,840 Medusa calls, 3,632 branches, corpus 101, and 62/62 passing
property/assertion surfaces. That run predates ADRs 0026 through 0029 and does not validate the current Resonance
architecture. The harness now checks Resonance solvency under qualifying stream resets, accepted rounding and
zero-signal surplus, and irreversible Strategy death; the pinned external campaigns still need to be rerun before
those checks become external-fuzzer evidence. The harness does not model ProtocolGovernor proposal lifecycles; their
selector, snapshot, role, queue, and execution properties are covered by Foundry tests and still require an external
review. Bribe's separate exact carry-to-Fund policy remains covered by current deterministic tests.

Run the pinned campaign with:

```bash
bash audit/install-tools.sh nightly
bash audit/run-nightly.sh
```

Both engines are configured for 100,000 transactions, sequences up to 150 calls, and a one-hour ceiling. `run-nightly`
also performs the Foundry campaign smoke test and the pinned static/Mythril gates. Raw reports and corpora are ignored
engineering evidence under `audit/reports`; a green campaign is neither an independent audit nor release approval.
