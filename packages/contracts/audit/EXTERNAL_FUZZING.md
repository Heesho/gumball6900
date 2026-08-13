# External state-machine fuzzing

`harness/ProtocolStateMachineCampaign.sol` deploys and wires the current core graph without Forge cheatcodes. Three
distinct actor contracts drive staking, partial unstaking, scalar and bounded-batch signal deltas, fundraising,
routing, Strategy purchases, claims, redemption, Strategy killing, and the bounded Resonance governance surface.
Echidna and Medusa share the `echidna_` property surface.

The accounting properties reconcile account, Strategy, Resonance, Bribe, staking, emission, revenue, and supply state.
The liveness/boundedness properties additionally prove that every represented account's complete exit remains within
the configured three-Strategy/eight-reward-token graph and that reward-token loops cannot grow beyond Bribe's immutable
cap. A later production-hardening change resolves A-04 by recording a fixed Fund liability, so hostile USDG cannot block removal of the affected dead-Strategy
signal, although unallocated `sGBX` and signals on unaffected Strategies remain independently removable.

The 2026-08-09 adversarial rerun completed 101,840 Medusa calls, 3,632 branches, corpus 101, and 62/62 passing
property/assertion surfaces. That run predates ADRs 0026 and 0027. Current deterministic tests assign unindexable
Resonance and Bribe carry to Fund at denominator changes, but the external campaigns have not been rerun against that
policy.

Run the pinned campaign with:

```bash
bash audit/install-tools.sh nightly
bash audit/run-nightly.sh
```

Both engines are configured for 100,000 transactions, sequences up to 150 calls, and a one-hour ceiling. `run-nightly`
also performs the Foundry campaign smoke test and the pinned static/Mythril gates. Raw reports and corpora are ignored
engineering evidence under `audit/reports`; a green campaign is neither an independent audit nor release approval.
