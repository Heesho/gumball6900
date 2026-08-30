# Whitepaper fact check

This register covers whitepaper v0.11. Existing Solidity and cross-language fixtures remain authoritative local
engineering evidence for implemented mechanics. ADRs 0031 and 0033-0055 are implemented in the uncommitted development
tree; no row is an independent audit or deployment claim. V12 remains pinned to `3ae171b`, while the current edition is
based on `f991253` plus uncommitted remediation.

| Claim                                                                                   | Source                                                | Status / limitation                                          |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| GBX's constructor creates zero tokens                                                   | `GBX` constructor and `totalSupply` tests             | Enforced before the canonical launch transaction             |
| One deployed Mine receives permanent mint authority                                     | `GBX.setMinter`, `minterLocked`                       | Enforced after irreversible deployment handoff               |
| Mine issues exactly 1,000 GBX solely into the canonical genesis pair                    | `Mine.mintGenesisLiquidity`, ADR 0054                 | Fixed one-time path after permanent Mine binding             |
| The launcher seeds 1 USDG and locks the complete genesis LP supply at zero              | `GBXLauncher`, direct V2 Pair mint, ADR 0054          | No LP holder can burn the seed; swaps can change reserves    |
| GBX and the actual USDG/GBX LP are the two initial Strategies                           | `GBXLauncher._addInitialStrategies`, ADR 0054         | Enforced by launcher final-state checks                      |
| Later fungible LP held by Fund is an ordinary redemption asset                          | `Strategy`, `Fund.redeem`, ADRs 0050/0054             | No special settlement or redemption path                     |
| GBX has no protocol-defined economic maximum                                            | GBX ABI and ADR 0024                                  | Enforced; GBX has no voting checkpoints                      |
| GBX permit and sGBX voting responsibilities are separate                                | `GBX`, `SignalGBX`, ADR 0030                          | GBX has permit; sGBX has votes and no approval permit        |
| Governance execution is not implemented in the core                                     | ADR 0034; no governance source tree                   | External integration and ownership handoff unresolved        |
| Every minted sGBX unit is atomically assigned to one Strategy                           | `SignalGBX.addSignal`/`addSignalMany`, ADRs 0031/0051 | Enforced and covered by deterministic/stateful tests         |
| Final live Strategy cannot be killed after bootstrap                                    | `Resonance.killStrategy`, ADR 0031                    | Enforced through explicit live-Strategy count                |
| Strategy payment uses a global Bribe rate: default 10%, bounded 0%-20%                  | `Resonance.setBribeBps`, ADR 0036                     | Prospective; Fund receives the 80%-to-100% complement        |
| Strategy pays the Fund complement directly and buffers the Bribe share                  | `Strategy._settlePayment`, ADR 0047                   | Per-purchase floor; no cumulative split carry                |
| Resonance and Bribe use ordinary Synthetix leftover rollover                            | `notifyRevenue`, `notifyReward`                       | Rate, index, and account floors remain surplus               |
| A 0% automatic rate leaves signal and independent-reward paths live                     | `SignalGBX`, `Bribe`, zero-rate tests                 | Only new automatic auction rewards are disabled              |
| Bribe reward indices use `1e36` precision                                               | `Bribe.REWARD_PRECISION`, ADR 0037                    | Six-decimal rewards remain useful at realistic signal supply |
| Bribe lifetime capacity is `floor(uint256.max / 1e36)` raw units                        | `MAX_LIFETIME_REWARD_AMOUNT`, ADR 0037                | Precision and overflow bound remain coupled                  |
| Resonance fresh-notification capacity is `floor(uint256.max / 1e36)` raw USDG           | `MAX_LIFETIME_REVENUE_AMOUNT`, ADR 0052               | Monotonic cap rejects excess before checkpoint or custody    |
| Direct Bribe claims require the beneficiary or immutable Resonance                      | `Bribe.claimReward(s)`, ADR 0053                      | Internally verified remediation; independent closure pending |
| Resonance batches canonical Bribe all-token claims only for `msg.sender`                | `Resonance.claimBribeRewards`, ADR 0053               | Optional convenience; direct scalar claim remains fallback   |
| Mine has exactly sixteen permanent slots                                                | `Mine.SLOT_COUNT`, constructor                        | Enforced                                                     |
| Mine has no capacity mutation; its sole owner setter changes only future revenue Router | Mine ABI, ADRs 0033 and 0055                          | Enforced; owner and Router change require fresh review       |
| Slot price reaches zero after one hour                                                  | `PRICE_DECAY_PERIOD`, `Mine._price`                   | Enforced                                                     |
| A nonempty replacement splits 80% to outgoing-tenure miner and 20% to Router            | `PREVIOUS_MINER_BPS`, `_allocatePayment`              | Enforced; rounding residue is deposited into Router          |
| An empty slot deposits 100%                                                             | `_allocatePayment`                                    | Enforced because no outgoing-tenure claim exists             |
| Mine does not synchronously call the Router                                             | `_collectAndDeposit`, ADR 0044                        | Enforced; `RevenueDeposited` marks the nominal deposit       |
| An occupied slot's rate is unchanged until replacement                                  | `Slot.tps`, `Mine.mine`                               | Enforced and directly tested                                 |
| New occupations divide current global TPS by sixteen                                    | `Mine.mine`                                           | Enforced; integer residue is unissued                        |
| Future-replacement rates halve on deployment time and reach a positive tail             | `startTime`, `_globalTps`                             | Enforced; provisional 64/69-day/1 schedule needs review      |
| Mine reports total pending emission in constant time                                    | `aggregateTps`, `pendingEmission()`                   | Differentially tested against all sixteen slots              |
| Redemption uses a common effective pre-burn supply snapshot                             | `Fund.redeem`, `Mine.effectiveTotalSupply`            | Enforced without mutating Mine                               |
| No governance path can reprice outgoing tenures                                         | Immutable Mine slot logic, ADRs 0033 and 0055         | Enforced; the Router setter cannot change mining parameters  |
| No deployment exists; the received V12 export is incomplete and not release-authorizing | repository release and audit records                  | Current status; not a safety claim                           |
| donut-miner provenance is cleared                                                       | `NOTICE`, legal blocker                               | Not cleared; deployment and distribution blocker             |

The build gate rechecks the numeric rows against `economic-scenarios.json`. It intentionally does not repeat obsolete
test counts or audit conclusions from the superseded Fundraiser architecture.
