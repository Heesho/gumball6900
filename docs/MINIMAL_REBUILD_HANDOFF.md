# Minimal GBX rebuild handoff

> Local engineering evidence on `codex/minimal-gbx-rebuild`, based on archival `main`
> `04559b9308c8b7933a13a7f68e0b1894a7667997`. This is not an audit, deployment, release approval, or authorization
> to use funds.

## 1. Architecture

The production graph is the requested 14 direct, non-upgradeable contracts: `GBXToken`, `EmissionController`,
`MiningPool`, `MiningClaims`, `StakedGBX`, `AllocationVoter`, `AcquisitionStrategy`, `StrategyRewards`,
`BuybackStrategy`, `GumBallVault`, `AssetRegistry`, `LiquidityCustodian`, `ProtocolTimelock`, and
`EmergencyGuardian`. `AuctionEngine`, two math libraries, and narrow interfaces are internal source components, not
additional authorities.

- Genesis is one constructor mint of 20M GBX to the deployment account. The script creates one hookless, single-sided
  GBX/USDG v4 position, burns unusable integer residual, transfers the exact NFT to `LiquidityCustodian`, and starts
  mining last.
- Mining uses one-day epochs, full scheduled issuance for each non-empty epoch, forfeiture for an empty epoch,
  payer/beneficiary attribution, a fixed optional 2% team fee, and already-minted proportional claims.
- Staking is 1:1 and non-transferable. Signals are immediate absolute weights. Revenue enters the raw vault before
  voter notification; the voter holds no USDG and accounts virtual strategy budgets with 1e27 precision.
- Acquisition and buyback use the bounded give.fun reverse Dutch transition. Acquisition routes 98/2, or 100/0 at
  zero active reward weight. Buyback burns GBX before releasing its fixed USDG lot.
- Redemption is an unpausable, atomic, pre-burn-supply fraction of every registered raw vault balance. There is no
  NAV, oracle, substitution, lending valuation, or canonical-liquidity inclusion.
- USDG and every registered token are required to be standard, non-rebasing, and non-fee-on-transfer. Exact
  debit/receipt checks fail closed; they are not compatibility logic for exotic tokens.

## 2. Exact file disposition

The machine-generated status-relative inventory is in [MINIMAL_REBUILD_FILES.md](MINIMAL_REBUILD_FILES.md). It lists
every added, changed, removed, and deliberately retained/deferred file surface relative to the pinned baseline.

## 3. Old-to-new mapping

| Archival surface                                                                             | Minimal result                                                                     |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GenesisBootstrap`, `GenesisClaims`, public contribution/refund state                        | Removed; 20M constructor mint plus one-shot `DeployMinimal` script                 |
| `GenesisLiquidityCalculator`, `GenesisPriceMath`, migration ladder                           | `GenesisLiquidityMath` plus exact single-position script math                      |
| `LiquidityManager`, permissioned managers/controllers, verification escrow, allowlist, hooks | One hookless `LiquidityCustodian` holding one exact NFT                            |
| `ManagerRewards` generations/terminal queues                                                 | One immediate-index `StrategyRewards`; no dust sweep or queue                      |
| `BuybackBurnStrategy`                                                                        | `BuybackStrategy`, with GBX burned before fixed-lot release                        |
| `RevenueRouter`                                                                              | Removed; `MiningPool` and `LiquidityCustodian` deposit and notify atomically       |
| `StrategyDeployer` and public factory behavior                                               | Removed; explicit script deployment and typed seven-day registry admission         |
| `HoldUSDGStrategy`                                                                           | Removed; zero-weight USDG remains idle raw vault backing                           |
| `GumBallRouter` and `GumBallLens`                                                            | Removed; direct bounded calls and block-pinned SDK readers                         |
| Eligibility modules/registry                                                                 | Removed; typed, capped `AssetRegistry` checks the exact strategy/reward identities |
| Broad guardian/admin interfaces                                                              | Narrow exposure-only guardian and named typed timelock operations                  |
| Existing token, emissions, mining, staking, voter, vault, registry, acquisition              | Rebuilt in place to the minimal semantics                                          |

## 4. Trust and mutability

Immutable or structurally fixed properties:

- GBX cumulative minting cannot exceed 1B; burns never restore capacity.
- The initial deployment is direct/non-proxy, and there is no generic executor, vault call, factory, rescue, hook,
  oracle, or broad migration authority.
- Redemption uses the pre-burn denominator and every registered raw balance and has no pause path.
- The canonical custodian accepts one expected NFT from one expected depositor and PoolKey.

Accepted delayed or emergency authority:

- The proposer can schedule typed actions with a fixed seven-day delay; execution is permissionless after maturity.
- A compatible replacement emission controller can accelerate and direct all remaining mint capacity. The 1B cap
  survives; the four-year schedule does not.
- The exact liquidity NFT can be transferred after seven days to any reviewed deployed-code recipient. The recipient
  then controls that position.
- Typed strategy admission checks selected identities, not honest runtime behavior. A live admitted strategy can
  request no more than its signaled budget but can choose the receiver.
- A live malicious reward callback can block signal changes. Terminal disablement skips that callback entirely,
  restoring reset and unstake liveness; honest rewards retain a terminal weight snapshot and indexed claims.
- The guardian may stop only new exposure: contributions, signal increases, and fills. It cannot stop redemption,
  ended-epoch settlement, claims, burns, fee collection, signal decreases/reset, or post-reset unstaking.
- Standard-token issuers, freezes, blocklists, upgrades, and later behavior changes remain external liveness risks.

## 5. Emission constants and model results

| Quantity                       |                                                          Exact value |
| ------------------------------ | -------------------------------------------------------------------: |
| Cumulative mint cap            |                                                   `1,000,000,000e18` |
| Constructor allocation         |                                                      `20,000,000e18` |
| Nominal mining allocation      |                                                     `980,000,000e18` |
| Epoch                          |                                                              `1 day` |
| Real half-life                 |                                                         `1,460 days` |
| Daily decay WAD                |                                            `999,525,354,337,060,160` |
| Initial daily emission, raw    |                                    `465,152,749,681,042,811,702,004` |
| Positive scheduled epochs      |                                                             `99,884` |
| Sequential mining total, raw   |                                `979,999,999,999,999,181,815,005,172` |
| Nominal residual, raw          |                                                    `818,184,994,828` |
| Four-year mining issuance, raw |                                `489,999,999,999,999,874,551,856,292` |
| 36,500-day digest              | `0x22aef4fca7057d13da902b2bd05d3fd4b3bca71cb0e4c3ca4c35a1898f2a41db` |

The Solidity, TypeScript, and Python implementations apply sequential floor rounding. Full model evidence passed:
TypeScript 22/22, Python environment policy 5/5, Python model 16/16, fixtures, charts, and hookless liquidity report.

## 6. Auction fidelity

- give.fun `Auction.sol` at `ef6ee14a454432210d13e312d0ef825f670bd79d` is the sole transition authority.
- The local suite has eight deterministic boundary tests plus two independent pinned-reference differential fuzz
  properties, each run for 10,000 cases. All 10/10 tests passed.
- Covered domains include `t=0`, `E-1`, `E`, `E+1`, floor rounding, zero endpoint, epoch/deadline/max equality,
  one-fill consumption, 1.1x..3x multiplier, and min/max clamps over the valid uint192 payment domain.
- Relevant unmodified upstream suites passed in temporary pinned clones: give.fun 103 tests and Liquid Signal
  Governance 177 tests. Those results establish upstream baselines only; they do not cover GBX adaptations.

## 7. Contract verification

- Foundry: 103/103, zero failed/skipped. Three fuzz properties ran 10,000 cases each.
- Hardhat: 2/2, including byte-for-byte Foundry/Hardhat compiler parity and cumulative-supply integrity.
- Deployment rehearsal: 7/7, including both GBX currency orderings, exact maximum static fee/tick spacing, explicit
  future liquidity deadline, one NFT custody, residual burn, zero deployer GBX, inactive strategies, and mining last.
- Terminal exit regression uses all 16 user strategy slots, including 13 gas-burning reward hooks; reset completes
  with a 1,000,000 gas cap and immediate unstake with a 250,000 gas cap.

## 8. Repository checks

| Gate                                         | Result                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm format:check`                          | Pass                                                                                |
| `pnpm lint`                                  | Pass; Solhint advisory warnings remain non-fatal                                    |
| `pnpm typecheck`                             | Pass, 9/9 tasks                                                                     |
| `pnpm build`                                 | Pass, 7/7 tasks                                                                     |
| `pnpm test`                                  | Pass, 9/9 tasks                                                                     |
| SDK ABI and docs drift                       | Pass; 14 generated ABIs                                                             |
| SDK tests and dry pack                       | 36/36; 85 files, 307,702 bytes; nothing published                                   |
| Subgraph ABI/codegen/build/tests             | Pass; 7 entities, 49 handlers, spec 4/4, Matchstick 3/3                             |
| Web unit/build/E2E                           | 3/3 unit, build pass, Playwright 6/6                                                |
| UI tests                                     | 12/12                                                                               |
| Config tests                                 | 124/124; unresolved minimal manifest validates                                      |
| Economic models                              | TypeScript 22/22; Python 5/5 environment + 16/16 model; fixtures/charts/report pass |
| Foundry format/build/sizes/tests             | Pass                                                                                |
| Hardhat suite                                | 2/2                                                                                 |
| Docs generation/check and `git diff --check` | Pass                                                                                |

The final local run used Node `22.23.1`, pnpm `10.14.0`, and Python `3.11.14` with the exact five dependency pins.

## 9. Production runtime sizes

| Contract              | Runtime bytes |
| --------------------- | ------------: |
| `AcquisitionStrategy` |         6,442 |
| `AllocationVoter`     |         9,333 |
| `AssetRegistry`       |         4,746 |
| `BuybackStrategy`     |         4,733 |
| `EmergencyGuardian`   |         2,862 |
| `EmissionController`  |         2,191 |
| `GBXToken`            |         4,935 |
| `GumBallVault`        |         4,870 |
| `LiquidityCustodian`  |         8,230 |
| `MiningClaims`        |         2,533 |
| `MiningPool`          |         8,860 |
| `ProtocolTimelock`    |         5,336 |
| `StakedGBX`           |         4,876 |
| `StrategyRewards`     |         4,441 |

The largest runtime is 9,333 bytes, leaving 15,243 bytes below the 24,576-byte EIP-170 limit.

## 10. Unresolved deployment decisions

No canonical deployment exists. The following remain explicit inputs or evidence, never defaults:

- chain and pinned fork block; deployer/broadcast signer; USDG, v4 PositionManager, Permit2, and PoolManager evidence;
- proposer, guardian operator, optional team address, acquisition target, and standard-token reviews;
- initial `sqrtPriceX96`, static fee, tick spacing, tick lower/upper, and an absolute future liquidity deadline;
- acquisition/buyback fixed USDG lots, initial/minimum prices, shared epoch period, and multiplier;
- resolved contract addresses, code hashes, transaction receipts, exact position ID/liquidity/principal/residual;
- separately delayed acquisition and buyback registration operations;
- manifest signature policy, legal/security/economic approvals, and all signed release evidence.

`packages/subgraph/networks.json` deliberately retains zero addresses. Production network validation therefore fails
closed with `GBXToken.address must be a nonzero deployed address`; the fixture-backed build passes.

## 11. Remaining blockers and unavailable evidence

- Provenance/licensing is unresolved. give.fun Auction and LSG Strategy disclose Euler Fee Flow ancestry; the pinned
  Euler file is GPL-2.0-or-later and no separate permission was found. LSG also names Solidly and Synthetix ancestors
  without exact pins. `NOTICE` is evidence, not a legal conclusion.
- There is no pinned real Robinhood/v4 fork rehearsal. Local mocks are not fork evidence.
- There is no fresh external audit, Slither/Aderyn report, or Echidna/Medusa campaign for this graph. Archived reports
  and policies are explicitly not current evidence.
- Foundry broadcasting is multi-transaction and requires receipt-by-receipt recovery/reconciliation planning.
- The legacy archived audit-policy suite had 4/64 stale expectation failures before its active aliases were removed.
  It is not represented as a current gate. `actionlint` was unavailable; workflows received structural YAML parsing.
- Upstream Uniswap packages emit missing-source-map warnings. Solhint emits style/NatSpec advisories. Both current
  commands exit successfully.
- Superseded permissioned-pool config exports and a package-local validator remain clearly archival and are absent
  from root CI/release authority.

An internal final review found no outstanding P0/P1/P2 implementation defect under the standard-token assumption.
That review is not an external audit or a production-readiness statement.

## 12. External-action confirmation

Nothing was committed, pushed, deployed, verified onchain, broadcast, signed, funded, role-transferred, published, or
released. The branch and working tree remain local and intentionally uncommitted for review.
