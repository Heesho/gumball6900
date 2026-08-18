# Whitepaper fact check

This register covers whitepaper v0.6. Existing Solidity and cross-language fixtures remain authoritative local
engineering evidence for implemented mechanics. ADRs 0031 and 0032 are implemented in the development tree; no row is
an independent audit or deployment claim.

| Claim                                                                         | Source                                     | Status / limitation                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| GBX creates 20M genesis tokens                                                | `GBX.GENESIS_LIQUIDITY_ALLOCATION`         | Enforced                                              |
| One deployed Mine receives permanent mint authority                           | `GBX.setMinter`, `minterLocked`            | Enforced after irreversible deployment handoff        |
| GBX has no protocol-defined economic maximum                                  | GBX ABI and ADR 0024                       | Enforced; GBX has no voting checkpoints               |
| GBX permit and sGBX voting responsibilities are separate                      | `GBX`, `SignalGBX`, ADR 0030               | GBX has permit; sGBX has votes and no approval permit |
| ProtocolGovernor is limited to three exact zero-value calls                   | `ProtocolGovernor._propose`, ADR 0033      | Enforced at immutable Resonance target                |
| Every minted sGBX unit is atomically assigned to one Strategy                 | `SignalGBX.signal`, ADR 0031               | Enforced and covered by deterministic/stateful tests  |
| Final live Strategy cannot be killed after bootstrap                          | `Resonance.killStrategy`, ADR 0031         | Enforced through explicit live-Strategy count         |
| Strategy payment is cumulatively 90% Fund / 10% paired Bribe                  | `BribeRouter.routePayment`, ADR 0032       | Enforced with explicit split remainder                |
| Mine has exactly sixteen permanent slots                                      | `Mine.SLOT_COUNT`, constructor             | Enforced                                              |
| Mine has no owner or capacity mutation                                        | Mine ABI, ADR 0033                         | Enforced                                              |
| Slot price reaches zero after one hour                                        | `PRICE_DECAY_PERIOD`, `Mine._price`        | Enforced                                              |
| A nonempty replacement splits 80% to displaced miner and 20% to Resonance     | `PREVIOUS_MINER_BPS`, `_allocatePayment`   | Enforced; rounding residue goes to Resonance          |
| An empty slot routes 100%                                                     | `_allocatePayment`                         | Enforced because no displaced claim exists            |
| An occupied slot's rate is unchanged until replacement                        | `Slot.tps`, `Mine.mine`                    | Enforced and directly tested                          |
| New occupations divide current global TPS by sixteen                          | `Mine.mine`                                | Enforced; integer residue is unissued                 |
| Future-handoff rates halve at cumulative thresholds and reach a positive tail | `_rateState`, constructor checks           | Enforced; exact production parameters unresolved      |
| Mine reports total pending emission in constant time                          | `aggregateTps`, `pendingEmission()`        | Differentially tested against all sixteen slots       |
| Redemption uses a common effective pre-burn supply snapshot                   | `Fund.redeem`, `Mine.effectiveTotalSupply` | Enforced without mutating Mine                        |
| No governance path can reprice incumbents                                     | Ownerless Mine plus immutable slot logic   | Enforced; deployment remains unauthorized             |
| No deployment or independent audit exists                                     | repository release records                 | Current status; not a safety claim                    |
| Farplace provenance is cleared                                                | `NOTICE`, legal blocker                    | Not cleared; deployment and distribution blocker      |

The build gate rechecks the numeric rows against `economic-scenarios.json`. It intentionally does not repeat obsolete
test counts or audit conclusions from the superseded Fundraiser architecture.
