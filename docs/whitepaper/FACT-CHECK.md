# Whitepaper fact check

This register covers whitepaper v0.4. Solidity and the cross-language economic fixtures are authoritative.

| Claim                                                                         | Source                                              | Status / limitation                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| GBX creates 20M genesis tokens                                                | `GBX.GENESIS_LIQUIDITY_ALLOCATION`                  | Enforced                                              |
| One deployed Mine receives permanent mint authority                           | `GBX.setMinter`, `minterLocked`                     | Enforced after irreversible deployment handoff        |
| GBX has no protocol-defined economic maximum                                  | GBX ABI and ADR 0024                                | Enforced; ERC20Votes retains a uint208 safety ceiling |
| Mine capacity begins at one and never exceeds sixteen                         | `Mine.capacity`, `MAX_CAPACITY`, `increaseCapacity` | Enforced                                              |
| Capacity cannot decrease                                                      | `increaseCapacity` guard; no decrease method        | Enforced                                              |
| Slot price reaches zero after one hour                                        | `PRICE_DECAY_PERIOD`, `Mine._price`                 | Enforced                                              |
| A nonempty replacement splits 80% to displaced miner and 20% to Resonance     | `PREVIOUS_MINER_BPS`, `_allocatePayment`            | Enforced; rounding residue goes to Resonance          |
| An empty slot routes 100%                                                     | `_allocatePayment`                                  | Enforced because no displaced claim exists            |
| An occupied slot's rate is unchanged until replacement                        | `Slot.ups`, `_checkpointAll`, `increaseCapacity`    | Enforced and directly tested                          |
| New occupations divide current global rate by current capacity                | `Mine.mine`                                         | Enforced; integer residue is unissued                 |
| Future-handoff rates halve at cumulative thresholds and reach a positive tail | `_rateState`, constructor checks                    | Enforced; exact production parameters unresolved      |
| Fund checkpoints before redemption                                            | `Fund.redeem`                                       | Enforced atomically, bounded by sixteen slots         |
| Redemption uses a common pre-burn supply snapshot                             | `Fund.redeem`                                       | Enforced                                              |
| Timelock can add capacity but cannot reprice incumbents                       | Mine ownership plus immutable slot logic            | Procedural ownership setup remains undeployed         |
| No deployment or independent audit exists                                     | repository release records                          | Current status; not a safety claim                    |
| Farplace provenance is cleared                                                | `NOTICE`, legal blocker                             | Not cleared; deployment and distribution blocker      |

The build gate rechecks the numeric rows against `economic-scenarios.json`. It intentionally does not repeat obsolete
test counts or audit conclusions from the superseded Fundraiser architecture.
