# GUM BALL 6900 Threat Model

Status: design-time threat model. It must be updated against deployed bytecode, final asset manifests, audit findings,
legal/compliance architecture, and operational owners before any production launch.

## Security objectives

The protocol prioritizes:

1. Correct cumulative supply and burn accounting.
2. Permissionless, in-kind redemption using pre-burn total supply.
3. Full backing of the genesis LP allocation.
4. Target-asset delivery before any strategy receives vault USDG.
5. Immediate unstaking without residual vote or reward manipulation.
6. Minimal, bounded privilege with no arbitrary vault execution.
7. Exact strategy bytecode and complete dependency/runtime provenance before any strategy becomes live.
8. Continued access to settled claims, accrued rewards, refunds, and exits during protocol emergencies.

Oracleless does not mean riskless. The protocol avoids an onchain NAV dependency but accepts market execution,
liquidity, issuer, bridge, stablecoin, and chain risks.

## Assets at risk

- Registered raw ERC-20 balances in GumBallVault.
- USDG temporarily escrowed during bootstrap and recurring mining.
- Already-minted GBX held by claims and staking contracts.
- Target-token rewards owed to active signal managers.
- Virtual strategy USDG budgets and allocation/reward index state.
- Canonical Uniswap v4 position NFTs, principal, and fees.
- Supply, clearing-price, reference-price, auction, and signal checkpoint state.
- Strategy creation-bytecode commitments, deployment provenance, and registry identity metadata.
- Deployment manifests, role ownership, compliance registry integrity, and public protocol metadata.

## Trust assumptions

- Core contracts are non-upgradeable and their deployed bytecode matches reviewed source.
- StrategyDeployer's immutable creation-bytecode hashes and lengths match the exact reviewed compiler artifacts;
  deployment and release verification recompute rather than trust manifest-supplied commitments.
- The timelock multisig and guardian multisig are independent, secured, monitored, and subject to the documented
  authority bounds.
- Canonical USDG, WETH, wrapped BTC, and stock-token contracts match a live, signed deployment manifest.
- Registered assets exhibit the transfer behavior validated before registration. Unexpected fee, rebase, callback,
  pause, freeze, proxy-upgrade, or eligibility behavior remains an external risk.
- Robinhood Stock Tokens share an upgradeable beacon and issuer AccessControl registry. Registration atomically binds
  the reviewed proxy shell, beacon, implementation, UID, symbol, multiplier, registry link, and unpaused state, but it
  cannot remove the issuer's later authority. The release evidence must reconstruct and bind the complete role map.
  At the 2026-08-02 review pin, every one of the 13 issuer roles—including upgrade, mint, arbitrary-address burn,
  account block, and global/token pause roles—was held by a direct EOA with no onchain delay. This is a material,
  explicitly accepted external trust boundary, not protocol governance.
- Robinhood Chain provides the EVM behavior required by the pinned compiler and Uniswap v4 release.
- Official Uniswap v4 deployments and pinned libraries are authentic and compatible.
- Market makers are economically motivated but untrusted. Auction fills and secondary liquidity are not guaranteed.
- Display APIs, RPCs, subgraphs, and corporate-action services are non-authoritative and may be unavailable or wrong.

## Permissionless attacker analysis

<!-- prettier-ignore -->
| Threat | Preventive controls | Detection | Recovery / residual risk |
|---|---|---|---|
| Reentrancy and malicious token callbacks | Reentrancy guard on value-moving entries; checks-effects-interactions; narrow token calls; no generic callbacks. | Adversarial ERC-777-style tests, invariant failures, runtime alerts. | Pause new contributions/fills where authorized; redemption remains unpausable. |
| Exact-input and fee-on-transfer mismatch | Measure incoming transfers by balance delta; bound an auction taker's observed debit by their signed maximum; require exact sender debit and receiver credit when a claim, budget, or refund/reward liability is reduced; validate asset behavior. | Pre-registration probes, fork tests, sender/receiver-balance assertions. | Disable new acquisition. Existing nonstandard asset may impair redemption; see ADR-0003. |
| Rebasing asset accounting drift | Do not register unsupported rebasing tokens; redemption always snapshots raw balance. | Registry reconciliation and balance-change monitoring. | Disable acquisition; existing raw balance remains redeemable if transfers work. |
| Flash-loan stake and same-block vote capture | Non-transferable sGBX; 24-hour activation for increases; checkpointed active weight at fill time. | Same-block and multi-actor flash-loan simulations. | Cancel pending changes or pause new activations during incident response. |
| Vote, unstake, retain weight | Unstake checkpoints and proportionally removes active/pending weight before returning GBX. | Global weight/stake invariants. | Immediate resets and unstaking remain enabled. |
| Duplicate or dead strategy weight | Unique bounded signal inputs; live registry checks; disable path removes denominator weight and pending signals. | Weight-denominator invariant and strategy health alerts. | Guardian disables acquisition; checkpoint/cleanup remains permissionless. |
| Last-minute mining sniping | Material final-window contributions extend the epoch, capped at two hours. | Epoch extension events and contribution concentration metrics. | Economic behavior is public; no promise of MEV-free clearing. |
| Nearly empty epoch over-mint | Demand-scaled emission at endogenous minimum price; schedule cap and cumulative cap. | Settlement differential model and price/reference alerts. | Empty/underfunded emission is forfeited, not carried forward. |
| Auction front-run/back-run | Expected auction ID, deadline, maximum target input, deterministic public curve, bounded lots. | Fill simulations and mempool/execution monitoring. | Takers set slippage protection; no guarantee of private execution. |
| Stale or zero auction rate | Nonzero floor, expiry/restart behavior, and a timelocked two-argument reset. Scheduling pins the live expected baseline; execution is bounded to 50%–200% of that baseline without rechecking mutable live state. Reset and fill are mutually non-reentrant. | Stale-rate dashboard, queued-baseline decoder, and outlier clearing alerts. | Pause fills or execute/cancel the bounded reset. Fills and permissionless restarts cannot censor a mature reset, and concurrently queued resets cannot compound from one another. |
| Strategy budget race or USDG over-release | Checkpoint and debit budget before release; vault verifies caller and recorded budget; non-reentrant fill. | `sum budgets <= vault USDG` invariant and failed-call telemetry. | Pause fills; vault backing remains in custody. |
| Getter-shaped or malicious strategy registration | Only ProtocolTimelock can invoke the exact-bytecode StrategyDeployer; AssetRegistry admits only recorded target/rewards pairs whose full graph and current runtime hashes match provenance. | Monitor typed deployment events, child runtime code, provenance mappings, registry queues, and asset/strategy associations. | Cancel whichever operation is still queued; after registration, guardian disables new acquisition. A malicious already-held asset remains basket risk. |
| Malformed or deceptive token symbol | Registration requires nonzero identity/hash, canonical dynamic-string ABI data, 1–32 printable ASCII bytes excluding space, and an exact symbol hash. | Decode queued registration against direct token reads and manifest evidence. | Registration reverts atomically; cancel stale queue after token metadata drift. Mutable external metadata remains an issuer risk after admission. |
| Rounding grief and dust | `Math.mulDiv`, high-precision accumulators, explicit live remainder carry, bounded arrays, and terminal ManagerRewards reconciliation that preserves aggregate whole liabilities. | Differential, fuzz, terminal-exit, and ghost-variable checks reconcile notified rewards with whole entitlements and finalized dust, and finalized dust with pending plus redirected. | Active-cycle fractions remain available to future rewards; after every manager exits, only non-claimable dust is queued for GumBallVault, never an operator. Zero dust requires no sweep. |
| Terminal reward-token failure blocks manager exit | Final signal removal and generation cleanup only finalize and queue terminal dust; they make no token call. Pending dust remains reserved in `accountedRewards`. The separate permissionless sweep has an immutable GumBallVault destination and exact debit/credit checks. | Monitor queued, pending, and redirected dust by generation/cycle plus failed-sweep telemetry; exercise false-return, fee, surcharge, and callback regressions. | A failed sweep leaves the queue intact for retry and cannot block staking, voting, reset, or unstaking. Unsupported token behavior may delay the vault receipt, so disable new acquisition where authorized. |
| Arbitrary token donation | Vault ignores unregistered tokens; registration is validated and timelocked. | Token-balance discovery versus registry. | Vault has no rescue. Donors accept that unsupported tokens may be unrecoverable. |
| Claim replay or beneficiary substitution | Settled entitlement and claimed state; claim-on-behalf always pays recorded beneficiary. | Replay and arbitrary-caller tests. | No admin entitlement rewrite; unclaimed expiry uses real burn. |
| Pool pre-initialization | The CREATE2-mined launch guard or permissioned hook restricts the exact intended PoolKey initialization to LiquidityManager. | Fork rehearsal and PoolKey/state checks before launch. | Atomic launch reverts; investigate before retrying with reviewed configuration. |
| v4 hook permission misuse | Minimal non-upgradeable hook; permission-bit tests; no swap-time behavior in launch-guard mode. | Bytecode/hash verification and hook lifecycle tests. | No hook upgrade; migrate only through constrained, delayed process if required. |
| Permissioned wrapper identity spoofing | Successor hook accepts only adapter-approved wrappers and checks the wrapper-reported account against the adapter for the required swap or liquidity flag. | Exact wrapper-set/hash checks, negative sender tests, and real-router fork rehearsals. | Schema v1 rejects the successor until every wrapper and runtime is independently reviewed; a compromised approved wrapper remains a disclosed trust boundary. |
| Adapter verification deposit changes genesis supply | Successor settlement deposits exactly one wei from the fixed 20 million POL allocation, verifies once, recycles it through a fixed PoolManager unlock, and proves the entire underlying balance is restored before initialization. | Supply/balance assertions, callback tests, and real-adapter atomic-genesis rehearsal. | Any mismatch reverts all genesis state. The review candidate is not release-authorized without the real integration campaign. |
| Spot-price manipulation | No spot price or NAV is consumed by minting, redemption, signals, auction settlement, or buyback. | Static call-graph review for external price reads. | Users bear market price and execution risk; direct basket redemption remains the hard economic exit when transfers work. |
| Large or sequential redemption | Pre-burn supply denominator, snapshot balances, pro-rata budget scaling, bounded asset loop. | Stateful large/full-supply redemption tests. | Rounding dust benefits remaining holders; no admin intervention. |
| Corporate-action timing | Contracts use raw token balances only; multiplier/API data is display-only. | Index multiplier events and registry status. | UI warns users; issuer behavior remains external. |
| Trading halt timing | Guardian can disable new acquisition; fill validates live asset state where enforceable. | Registry/halt alerts. | Existing asset stays in basket; transfer pause may block atomic redemption. |

## Privileged attacker analysis

<!-- prettier-ignore -->
| Threat | Preventive controls | Detection | Recovery / residual risk |
|---|---|---|---|
| Compromised guardian | Guardian can only stop new risk; cannot move assets or stop redemption, claims, rewards, unstaking, burns, or refunds. | Every action emits an indexed event; multisig monitoring. | Timelock rotates guardian after delay; users retain exit operations. |
| Compromised timelock multisig | Purpose-specific target/selector bounds; no vault executor role; economic constants and core references immutable. Strategy deployment is limited to one canonically encoded acquisition selector with exact committed compiler-bytecode hash/length pairs and typed bounds. | Queued-action decoder, public delay, onchain policy monitor. | Cancel before maturity where configured; after execution, the pair is still not live without a separate delayed registration. Disable affected acquisition after admission. Core immutability limits repair options. |
| Malicious strategy or asset addition | Postlaunch deployment and registration are separate seven-day operations. StrategyDeployer fixes creation bytecode and constructor graph; operators derive actual child addresses from events/provenance rather than guessed `CREATE` nonces; AssetRegistry rechecks full graph, runtime hashes, identity, symbol, uniqueness, code, UID, and behavior atomically. | Independent manifest signer review, compiler-artifact hash comparison, provenance/runtime inspection, and public inspection of both queues. | Cancel either queue. A deployed but unregistered pair has no live budget authority. Guardian disables acquisition after registration; a bad asset already held can be irrecoverable. |
| Stale-rate reset abuse | Purpose-specific `resetReferenceRate(expected,new)` call, schedule-time equality to the live baseline, 50%–200% bounds around that committed value, 48-hour delay, non-reentrancy, and complete events. Execution omits live-baseline equality so a fill/restart cannot censor it. | Compare both committed values to last clearing and public market display data; alert on concurrent reset queues. | Cancel before execution or pause fills. Every concurrent operation remains bounded to its own reviewed baseline; no oracle-enforced fair value exists. |
| Malicious liquidity operator | LiquidityManager recipients and PoolKeys are constrained; NFTs cannot transfer to EOA; removed principal routes only to vault/replacement. | Position ownership and principal-flow alerts. | Pause additions/migration; completed-range sweep remains constrained. |
| Compliance registry abuse | Treat registry administration as a disclosed production trust boundary; separate it from vault and mint authority. | Eligibility change events, signer monitoring, legal/issuer reconciliation. | Rotate through the approved delayed process where possible; no asset confiscation path. Eligibility can impair individual access. |
| Permissioned adapter owner abuse | The adapter is born owned by a non-upgradeable purpose-limited controller. Timelock calls can change only the checker, four fixed wrappers, canonical hook allowance, and swap state; guardian calls are stop-only. The controller has no transfer or arbitrary-call path. | Monitor controller, checker, wrapper, hook, and swapping events against the signed successor graph. | Guardian stops swaps/additions on drift; direct basket redemption remains separate, subject to underlying-token eligibility and transfer behavior. |
| Deployer retains authority | Temporary deployment initialization is limited to exact typed bootstrap calls. The constructor commits the exact ordered bootstrap target count/hash; finalization checks that commitment and the complete enumerated pair set, persists it, and permanently closes bootstrap. HoldUSDG and buyback are one-time singletons, and StrategyDeployer accepts calls only from ProtocolTimelock. | Both finalization flags, immutable and persisted count/hash, ordered target enumeration, singleton/pair provenance, exact finalizer calldata/events/receipt, post-deployment role scan, and bytecode verification are checked at the signed observation and a fresh head. Complete timelock history reconciliation rejects every unreviewed or outstanding operation. | Production launch remains blocked until bootstrap is finalized, the exact reviewed set is sealed, and no queued or unreviewed deployer authority exists. |

## External dependency analysis

<!-- prettier-ignore -->
| Dependency failure | Effect | Mitigation and recovery |
|---|---|---|
| Robinhood Chain halt, reorg, or sequencer failure | All state changes stop or may reorganize. | Multiple RPCs, confirmation policy, reorg-safe indexing, pause only new risk after recovery. No contract can solve chain liveness. |
| USDG freeze, upgrade, or depeg | Contributions, auctions, liquidity, and USDG redemption may stop or lose economic value. | Verify implementation/proxy/admin risk, monitor status, stop new contributions/fills. Existing exposure cannot be swept away. |
| Stock-token issuer upgrade, mint, burn, block, or pause | A shared-beacon upgrade changes all five tokens; issuer roles can change supply or metadata, burn vault-held backing, block the vault, or make atomic redemption revert for every user. | Bind the full beacon/implementation/role/event state in reviewed evidence; revalidate before authorization and release; alert on every role, upgrade, pause, block, burn, mint, and multiplier event; immediately disable new acquisition on drift. Recovery still depends on the issuer, and the protocol intentionally has no skip/sweep path. |
| Corporate-action multiplier change | UI-adjusted exposure changes; raw balances remain constant. | Index events/API, show pending/effective multiplier, never modify contract balances. |
| Wrapped BTC bridge or upgrade-control failure | Wrapped BTC value or transferability may fail; router, gateway, ProxyAdmin, or executor upgrades can change bridge behavior. | Resolve only the official representation; bind proxy implementations, admin/owner topology, role history, and code hashes; monitor upgrades and bridge state; disable acquisition on drift. Existing exposure remains a basket risk. |
| Uniswap v4 exploit or incompatible deployment | Canonical LP principal/fees and trading may be affected. | Pin audited releases, verify code hashes, fork-test lifecycle, constrain migration. Vault redemption is independent of pool price but not of any vault assets lost through an exploit. |
| RPC/subgraph/API outage | Stale or unavailable UI/indexing. | Archive-grade RPCs, fallbacks, direct reads for critical balances, explicit stale-data state. No offchain source is authoritative. |
| Market-maker absence | Budgets accumulate; target assets are not acquired; buybacks do not execute. | Bounded restartable auctions and visible stale status. USDG remains in the vault and redeemable. |

## External-token redemption liveness

“Redemption cannot be paused” means no protocol role or pause flag can disable it. It does not guarantee that every
external ERC-20 will honor `transfer` forever. The v1 decision is atomic all-asset redemption with no privileged skip,
substitution, removal, or IOU mechanism. A frozen registered token can therefore block the entire call until the
issuer restores transferability. This high-impact residual risk is accepted in
[ADR-0003](adr/0003-external-token-redemption-liveness.md) and must be disclosed prominently.

## Detection and response requirements

- Monitor cumulative mint/burn/supply identities, vault balances, virtual budgets, live weights, reward liabilities,
  strategy fill splits, StrategyDeployer commitments/events/provenance, child runtime code, both postlaunch addition
  queues, LP ownership, guardian actions, token code hashes and symbols, registry status, pauses, multipliers, and
  chain finality.
- Alerts may recommend or trigger only an already-authorized bounded action. Monitoring must never gain vault
  withdrawal or generic execution authority.
- Incident response prioritizes stopping new exposure, preserving claims/refunds/unstaking, publishing verified
  status, collecting forensic evidence, and coordinating with external issuers where required.
- Because the core is non-upgradeable, recovery may require disabling an acquisition path, constrained liquidity
  migration, or a separately reviewed successor deployment. It never justifies an arbitrary vault call.

## Security release gate

Production remains blocked until all threats have prevention, detection, and recovery evidence; stateful invariants
and fork tests pass; static-analysis findings are resolved or justified; an independent security review is complete;
an independent economic review is complete; current external deployment facts are verified; roles are transferred;
and legal/compliance approval explicitly selects the production eligibility and pool mode. Strategy deployment and
admission evidence must also satisfy
[ADR-0009](adr/0009-typed-strategy-deployment-provenance.md).
