# External state-machine fuzzing

> **Pre-ADR-0047 historical campaign.** The recorded native runs, property counts, and present-tense harness
> descriptions below cover the earlier exact-carry and deferred-liability graph. ADR 0047 replaced that graph with
> scalar Synthetix scheduling, per-purchase Strategy splitting, direct Fund payment, and a Bribe-only Router. These
> results are not current evidence; the changed harness requires a fresh pinned campaign. ADR 0048 further raises
> the reward-token cap to sixteen and replaces the dedicated Resonance move hook with atomic remove-then-add
> composition, so every eight-token and move-hook statement below is historical too.

`harness/ProtocolStateMachineCampaign.sol` deployed and wired the then-current core graph without Forge cheatcodes. Three
distinct actor contracts drive atomic signaling, moves, and withdrawal, bounded global Bribe-share changes, mining,
routing, Strategy purchases, claims, redemption, Strategy killing, and one bounded post-bootstrap Strategy addition.
Echidna and Medusa share the `echidna_` property surface.

The accounting properties reconcile account, Strategy, Resonance, Bribe, mandatory signaling, emission, revenue, and
supply state.
The liveness/boundedness properties additionally prove that every represented account's complete exit remains within
the three-Strategy bootstrap graph plus its bounded fourth Strategy and that reward-token loops cannot grow beyond
Bribe's immutable eight-token cap. Killing a Strategy preserves its checkpointed Resonance claim at the fixed Strategy receiver
while allowing every incumbent signaler to remove their position without another active-denominator decrement or an
inline USDG transfer.
Hostile USDG therefore cannot block dead-Strategy signal exit, and signals on unaffected Strategies remain
independently movable or withdrawable. The accounting surface also checks that SignalGBX supply equals total signal
and that every Router matches an independent per-Strategy weighted-numerator oracle across arbitrary 0%–20% policy
changes and independently ordered settlement. For every
represented reward token, it now also checks that lifetime notifications do not exceed
`MAX_LIFETIME_REWARD_AMOUNT`, current accounted rewards do not exceed lifetime notifications, and cumulative
reward-per-signal never exceeds `lifetimeRewardNotified * REWARD_PRECISION`, where Bribe precision is `1e36`.

The 2026-08-16 then-current-graph Medusa 1.5.1 campaign completed 101,602 calls, 3,988 branches, corpus 84, and zero failures
across 65 property/assertion surfaces. The pinned Echidna 2.3.2 campaign completed 100,213 calls with seed 6900,
42,054 unique instructions, corpus 36, and all 25 properties passing. These are local internal runs, not independent
review. ADR 0034 later removed the in-repository Governor and Timelock; the numerical results remain historical
engineering evidence. ADR 0035 later added the lifetime-index properties described above, and ADR 0036 added the
prospective global Bribe-share action and weighted-carry oracle. None of those later changes is exercised by the
recorded native results; the current tree requires a fresh run.

Echidna initially returned exit code zero after every worker crashed before making a call because the default Foundry
profile deliberately omits compiler metadata while the harness constructor deploys contracts containing immutables.
The dedicated `echidna` Foundry profile retains metadata only for that engine. `check-echidna-results.mjs` now rejects
the empty-call crash, any below-limit campaign, and any incomplete or failed property even when Echidna itself exits
zero. The default production build remains metadata-free.

The harness checks Resonance solvency under qualifying stream resets, accepted rounding and zero-signal surplus,
irreversible Strategy death, exact weighted Strategy-payment classification across rate transitions, and mandatory
signal accounting including move and withdrawal while the automatic Bribe share is zero. It models
neither an external governance proposal lifecycle nor its permissions, upgrades, voting, delay, cancellation,
execution, or ownership handoff. SignalGBX checkpoint persistence remains covered by deterministic Foundry tests, but
the exact external integration requires a separate campaign and independent review. Bribe's exact carry-to-Fund policy
and lifetime-notification bound remain covered by deterministic and Foundry-invariant regressions. The lifetime cap
prevents new notifications from making future checkpoints unrepresentable; it does not add a recovery path for rewards
left in an ADR 0028 closed pool.

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
