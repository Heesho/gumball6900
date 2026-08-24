# One-pager fact-check register

Sheet: `output/pdf/GumBall6900-one-pager.pdf`, built from `docs/one-pager/gumball6900/`.

Evidence target: current uncommitted development working tree on 2026-08-23, based on commit `d80b92d`. It is not release-pinned, deployed, independently
audited, or authorized for user funds. The source-of-truth order is production Solidity, executable tests, generated
ABIs, independent TypeScript/Python models, accepted ADRs, audit records, then prose.

## Status legend

- **Enforced**: implemented by current Solidity and covered by executable tests.
- **Modeled**: reproduced by independent integer models and committed fixtures.
- **Recorded**: repository or release-state fact, not an onchain guarantee.
- **Illustrative**: explicitly invented explanatory content, not a protocol or market promise.

All token-movement claims assume the fail-closed supported-token model in `docs/SUPPORTED-TOKEN-MODEL.md`.

## Claim register

| ID   | Sheet claim                                                                              | Evidence                                                                                                                                                       | Status and limitation                                                                                            |
| ---- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| H-01 | “An index fund. The people who own it decide what goes in.”                              | `SignalGBX`, `Resonance`, `Strategy`, and `Fund` compose signal-directed acquisitions and registry-free redemption.                                            | Enforced as protocol mechanics; “index fund” is product framing, not a regulated-status claim.                   |
| H-02 | GBX is a share of Fund assets.                                                           | `Fund.redeem` pays selected raw-token balances pro rata against pre-burn GBX supply.                                                                           | Enforced for nominal token amounts; no NAV, price, or value guarantee exists.                                    |
| H-03 | Tokenized stocks, ETFs, and crypto are examples.                                         | Reviewed asset configuration lists representative eligible tokens.                                                                                             | Recorded eligibility examples only; no Strategy registration or Fund holding is claimed.                         |
| S-01 | Mara buys GBX.                                                                           | GBX is transferable; the core provides no primary-sale promise to Mara.                                                                                        | Illustrative market acquisition with invented person and amount.                                                 |
| S-02 | She deposits GBX into sGBX signals.                                                      | `SignalGBX.signal` atomically requests canonical GBX through `SafeERC20`, mints the same nominal non-transferable sGBX, and adds the same paired-Bribe signal. | Enforced under the standard-GBX assumption; no idle sGBX or standalone staking path exists.                      |
| S-03 | New USDG follows current pooled signals.                                                 | Resonance checkpoints elapsed intervals before every signal change and allocates by active Strategy weight.                                                    | Enforced subject to documented index and Strategy flooring surplus.                                              |
| S-04 | The default payment split is 90% Fund / 10% paired Bribe; the Bribe share can be 0%-20%. | `Resonance.bribeBps`, its 2,000-bps maximum, Strategy's direct split, and cross-language transition tests.                                                     | Enforced and modeled prospectively; each purchase uses the rate captured before token interaction.               |
| S-05 | A holder burns GBX and selects assets to receive.                                        | `Fund.redeem` snapshots Mine's constant-time effective supply before burn, then atomically transfers the caller-selected unique non-GBX set.                   | Enforced; omitted assets are forfeited to remaining supply and a broken selected token reverts the basket.       |
| R-01 | Burn 1% of effective supply to receive 1% of each selected asset.                        | `floor(balance * gbxAmount / effectiveSupplyBeforeBurn)` in `Fund.redeem`.                                                                                     | Enforced up to integer floors; accrued unminted mining is included in effective supply.                          |
| R-02 | Mining slots use a one-hour reverse Dutch price.                                         | `Mine.PRICE_DECAY_PERIOD`, `price`, and handoff tests/models.                                                                                                  | Enforced; replacement is never guaranteed.                                                                       |
| R-03 | Nonempty handoffs split 80% to the displaced miner and deposit 20% into the Router.      | `PREVIOUS_MINER_BPS`, exhaustive remainder, `RevenueDeposited`, and independent models.                                                                        | Enforced; an empty slot deposits 100%. Later permissionless routing has no role, bounty, or liveness guarantee.  |
| M-01 | 0% management fee.                                                                       | No team, manager, or fee recipient exists; Mine's 80/20 and Resonance's bounded Fund/Bribe destinations are build-pinned.                                      | Enforced as absence from this immutable surface; the Bribe leg rewards signalers and is not a management fee.    |
| M-02 | 0 team or presale tokens.                                                                | GBX starts at zero supply; after the one-time binding, Mine is the sole lifetime issuer.                                                                       | Enforced for mint authority and constructor supply.                                                              |
| M-03 | 0 lockup or notice period.                                                               | Signal movement/withdrawal and Fund redemption have no time lock, cooldown, or pause.                                                                          | Enforced; a mining-slot occupant cannot force another user to replace them.                                      |
| M-04 | At least 80% of each Strategy asset payment backs Fund.                                  | `MAX_BRIBE_BPS = 2_000`, Strategy's exhaustive complement, and its direct `safeTransfer` to Fund.                                                              | Enforced atomically for every purchase; the default Fund share is 90%, subject to per-purchase integer flooring. |
| M-06 | A 0% automatic rate leaves signaling and independent Bribes live.                        | `SignalGBX` paths do not depend on the automatic split; a zero Bribe amount requires no Router call; open Bribe funding remains.                               | Enforced by zero-rate signal/move/withdraw and independently funded reward tests.                                |
| M-05 | 0 preminted GBX.                                                                         | GBX constructor and zero-initial-supply tests; ADR 0050.                                                                                                       | Enforced; all GBX issuance comes from the permanently bound Mine.                                                |
| G-01 | Every sGBX unit stays assigned until moved or withdrawn.                                 | SignalGBX supply/account balances equal the sum of paired-Bribe supplies/account balances in deterministic and invariant tests.                                | Enforced; unsolicited GBX creates no sGBX, signal, votes, or withdrawal entitlement.                             |
| G-02 | Moving signal changes future allocation without changing custody or votes.               | `SignalGBX.moveSignal` checkpoints both Strategies and paired Bribes without mint, burn, or GBX transfer.                                                      | Enforced; dead Strategies may be sources but never destinations.                                                 |
| G-03 | Earlier Fund holdings remain until redemption.                                           | Fund has no sale, swap, rebalance, rescue, or general withdrawal surface.                                                                                      | Enforced for core actions; individual redeemers can remove their pro-rata selected share.                        |
| T-01 | “Experimental software. Not deployed, and pending independent review.”                   | No signed deployment manifest or independent-audit clearance exists.                                                                                           | Recorded release status, not a safety claim.                                                                     |

## Build-time guards

`build.mjs` re-reads all core Solidity. It pins Mine's exact 80/20 classification and ADR 0044 Router-deposit boundary,
Resonance's 10% default and 20%
maximum, Strategy's direct exhaustive Fund/Bribe split, the absence of privileged fee
identifiers, protocol facts, WCAG contrast, stale claims, word and page budgets, clipping, overlap, type size, embedded
fonts, and PDF geometry before replacing published output.
The build being green is reproducibility evidence only.
