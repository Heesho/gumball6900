# Release checklist

Current description: **ADR 0024/0029/0031/0033-0055 development candidate;
external governance unselected and independent review required**. This is not production-ready or
deployment-authorized.

## Internal engineering

- [x] Fundraiser removed and immutable multislot Mine implemented.
- [x] Occupied-tenure rates remain fixed through time boundaries, redemptions, and other slot replacements.
- [x] Sixteen slots are fixed at construction and Mine administration cannot change mining economics or slot state.
- [x] Nonempty payments classify 80% to the outgoing tenure miner and deposit 20% into ResonanceRouter; empty slots
      deposit 100%.
- [x] Mine emits `RevenueDeposited` and performs no synchronous `route()` call; permissionless routing has no role,
      bounty, or liveness guarantee.
- [x] GBX constructs with zero supply, Mine is its sole lifetime issuer after the permanent handoff, and the continuing
      core contains no liquidity manager. ADR 0054 adds one fixed Mine-issued 1,000-GBX genesis amount and a
      development-only launcher outside the continuing core.
- [x] Fund uses constant-time effective supply, including all pending mining, for the redemption denominator.
- [x] Pre-ADR-0052 source, focused tests, audit records, consumers, and architecture references reconciled through
      ADR 0051; ADRs 0052-0053 have separate open review/consumer gates below.
- [x] Historical post-ADR-0050 contract source at `3ae171b` passed 293/293 default Foundry tests, all 27 invariant entries
      at 1,000 runs of depth 500 with zero handler reverts, 10/10 integration tests, 4/4 Hardhat tests including parity,
      and contract lint, ordering, formatting, build, size, generated-documentation, and SDK ABI checks. This evidence
      predates and does not cover ADR 0051.
- [x] Current ADR-0051 contract matrix passes 299/299 default Foundry tests, all 27 invariant entries at 1,000 runs of
      depth 500 with zero handler reverts, 4/4 Hardhat tests including bytecode parity, contract lint/order/format,
      `forge build --sizes`, generated contract documentation, and SDK ABI checks.
- [x] Recorded pre-ADR-0053 consumer matrix passes 52/52 SDK tests, SDK typecheck/build, 5/5 subgraph specification tests,
      9/9 Matchstick tests, subgraph codegen/build/ABI checks, 28/28 TypeScript simulations, 22/22 Python simulations,
      5/5 simulation-environment tests, 3/3 web unit tests, and repository-wide lint/typecheck/build. That evidence
      predates ADR 0053 and does not clear its new ABI or authorization behavior.
- [x] Post-ADR-0053 ABI checks, focused/full Foundry tests, gas and atomic rollback cases, corrected 70/70 mutation run,
      documentation generation/check, SDK 52/52 with typecheck/pack/ABI checks, subgraph ABI/build and 9/9 Matchstick,
      simulations, root lint/typecheck/build, and Forge formatting/build-size checks are recorded in E-16.
- [x] Post-ADR-0053 browser E2E passes 36/36 and scoped documentation/Solidity formatting checks pass.
- [x] Historical post-ADR-0053 final root `pnpm test` rerun passed 9/9 Turbo tasks in 27m2.477s; its Foundry task passed
      367/367 across 29 suites. This receipt predates ADR 0054.
- [x] Historical ADR 0054 source and focused tests prove the fixed mint amount, permanent one-time consumption, disabled
      direct-deployment path, issuance reconciliation, recipient/code and reciprocal-binding checks, and its then-
      ownerless Mine. ADR 0055 changes that authority model.
- [x] Pre-ADR-0055 ADR 0054 launcher tests pass 16/16 and prove caller/chain/final-owner/decimals checks, single use, complete
      rollback and retry, caller-scoped CREATE2 graph, both token orderings, create-only Factory Pair creation,
      `PairAlreadyExists` for a Factory-precreated Pair, `LaunchInvariantFailed(PAIR_USDG_DEPOSIT)` for counterfactual
      Pair-address USDG prefunding, successful fresh-launcher retry, predictable launcher/Router/Resonance prefunding,
      exact LP math/lock, two Strategy configurations, setup-owner removal, and later Fund-held LP redemption. There is
      no Pair adoption or skim path.
- [x] E-17 preserves the completed validation of the immediately preceding Pair-adoption/skim launcher: 354/354
      non-invariant Foundry, 32/32 invariant/reachability, 386/386 composite, launcher 16/16, Mine 24/24, Hardhat 4/4,
      integration 10/10, 23,676 runtime bytes, a 1/1 pinned fork with a `22,862,200`-gas launch, and a 9/9-task root
      run. Production bytecode changed afterward, so none of those counts, size, or gas figures is current coverage.
- [x] Pre-ADR-0055 create-only launcher evidence passes 354/354 non-invariant Foundry tests across 29 suites and reports a
      22,762-byte `GBXLauncher` runtime, leaving 1,814 bytes below EIP-170.
- [x] Pre-ADR-0055 non-broadcast launcher fork passes 1/1 at Robinhood block `50,125,267` against the real USDG
      and Factory/createPair path; isolated `launch` gas is `22,853,567`, leaving `9,146,433` below the observed
      32-million target ceiling. The whole fork test used `41,411,361` gas including test-only setup. This does not
      select governance or authorize release.
- [x] Pre-ADR-0055 SDK ABI generation/check, SDK typecheck, and 53/53 SDK tests pass after the final `PairAlreadyExists` ABI
      generation.
- [x] ADR 0055's Mine and Resonance `Ownable2Step` implementation, sole Mine Router setter, immutable Fund identity,
      reciprocal replacement-graph validation, unchanged old-graph state, and two pending-owner launch handoffs receive
      focused and adversarial regression coverage in E-19.
- [x] The post-ADR-0055 configured Foundry, invariant/reachability, Hardhat parity, focused mutation, SDK ABI, subgraph,
      documentation, simulation, web, and build-size gates are recorded in E-19 without combining
      historical totals.
- [x] The separate post-ADR-0055 integration profile passes 10/10, including 256 fuzzed 12-action sequences.
- [x] CEX-05's unauthenticated SDK metadata is explicitly named `claimedStatus`; the matching selector option is
      `requireClaimedReleaseApproved`, legacy `status` input is rejected, and SDK tests/typecheck/build/package/docs pass.
- [ ] Production transaction construction is bound to independently verified signed-manifest and live-graph evidence;
      caller-claimed SDK metadata is never treated as authentication.
- [x] The current configured Foundry campaign passes 393/393 across 30 suites, including the 32/32
      invariant/reachability campaign at 1,000 runs x 500 calls with zero handler reverts.
- [ ] A clean aggregate root `pnpm test` receipt remains open. Its initial shell selected Python 3.14 without the
      required packages; every affected package gate later passed with the repository-compatible Python 3.11
      environment, as recorded in E-19.
- [x] Historical focused ADR-0048 migration suites passed 104/104, including the sixteen-token bound, composed move,
      rollback, checkpoint ordering, absent Resonance move selector, and maximum-bound gas regressions. Public move was
      later removed by ADR 0051, so those results are not current batch evidence.
- [ ] Repository-wide format gate passes. Eight unrelated pre-existing files — six landing files, `pnpm-lock.yaml`, and
      `tmp/videos/gumball6900-cinematic-80s/SHOT-LIST.md` — still fail Prettier; this remains open even though scoped
      files and Solidity formatting pass.
- [ ] Static findings regenerated and manually dispositioned for the complete ADR-0055 graph, including launch modules
      and the Mine replacement-graph identity calls.
- [ ] Current-tree coverage thresholds recorded for Mine.
- [x] Focused ADR-0048 mutation campaign killed 47/47 mutants, including the cap regression and composed-move
      omission, same-Strategy, and restored-hook mutations.
- [x] Recorded ADR-0051 focused mutation smokes test-kill 16/16 SignalGBX mutants and 1/1 restored Resonance move-hook
      mutant, with pattern-specific raw reports retained under `audit/reports`.
- [x] ADR 0053 authorization/batch mutants added and the complete corrected 70-mutant manifest run test-kills 70/70
      with zero survivors or errors.
- [x] Focused current Mine mutation campaign test-kills 8/8, covering the original Mine routing operator and seven
      ADR-0055 authority/graph-identity operators.
- [ ] The current 77-mutant operator set and all equivalence decisions are independently dispositioned, and a fresh
      complete 77/77 campaign is recorded. The current 8/8 Mine result is only the focused ADR-0055 subset.
- [ ] Current-tree Medusa and pinned Echidna campaigns complete, with time-jump bounds reaching the first 69-day
      boundary and day-414 tail boundary.
- [ ] Compatible symbolic analysis or explicit independent disposition complete.
- [x] Resonance and Bribe use Synthetix-style leftover rollover and ordinary floors; there are no carry buckets or Fund
      reward liabilities, and entry/exit regressions prove rounded pre-change value is not inherited by later weights.
- [x] SignalGBX's scalar and batched add/remove workflows preserve aggregate custody, full rollback, per-allocation
      events, duplicate-entry sequential semantics, killed-Strategy exit, and bounded scalar liveness at the
      sixteen-token Bribe maximum.
- [x] `SignalPortfolioLens`, direct-call SDK builders/planners, and subgraph `SignalPosition` discovery are synchronized;
      transaction-sensitive writes refresh canonical state onchain and no shared write-through Router exists.
- [x] A two-Strategy batch against two sixteen-token Bribes records 1,070,988 gas for addition and 190,321 gas for
      removal, each below its six-million-gas regression bound.
- [ ] A larger intended UI allocation/chunk bound selected and measured. Gas grows with both allocation count and
      registered Bribe tokens, and scalar removal remains the bounded exit fallback.
- [x] In-repository ProtocolGovernor and protocol Timelock removed under ADR 0034 while SignalGBX retains ERC20Votes.
- [x] Global automatic-Bribe share is prospective, uniform, owner-only, and bounded from 0% through 20%; each Strategy
      purchase floors independently, sends the complement directly to Fund, and buffers only its Bribe share.
- [x] Bribe reward accounting uses `1e36` precision with a precision-coupled lifetime cap, standard seven-day leftover
      rollover, uninterrupted zero-supply time, beneficiary/immutable-Resonance claim authorization, and all-token plus
      scalar-token claims under a standard-token model.
- [x] ADR 0053 selects the narrow Resonance cross-Bribe batch: the beneficiary is always `msg.sender`, only registered
      live or killed Strategy keys are accepted, duplicates execute sequentially, and direct scalar claims remain the
      broken-token and gas fallback.
- [x] Bribe reward registration is append-only and fixed at sixteen tokens. Scalar maximum-bound operations and the
      current two-Strategy batch regression remain far below a 30-million-gas block; larger batches require chunking.
- [x] Resonance exposes no dedicated move hook. ADR 0051 also removes public SignalGBX move; any wallet-level
      reallocation composes direct remove/add calls without granting a Router custody or operator authority.
- [ ] SignalGBX checkpoint/delegation compatibility and voting-power rental risk reviewed against the exact external
      governance release.
- [ ] External governance permissions, proposal scope, batching, quorum/support, execution, delay, cancellation,
      admin, emergency, and upgrade paths independently reviewed and accepted, including `setBribeBps`,
      `setResonanceRouter`, two-step acceptance, current-owner replacement/cancellation of a pending ownership transfer,
      immediate renunciation, and public monitoring.

## Economic and independent review

- [ ] Initial GBX/second, time-based halving period, positive tail, USDG multiplier, and minimum price independently
      reviewed. ADRs 0042 and 0043 record a provisional 64 GBX/second, 69-day, 1 GBX/second development schedule.
- [ ] Fixed Mine economic schedule independently reviewed and approved.
- [ ] Fixed-tenure excess issuance modeled under staggered, frequent-turnover, slow-turnover, and permanent-no-turnover
      scenarios.
- [ ] Rollover, zero-price replacement, MEV, demand collapse, and thin-liquidity scenarios reviewed.
- [ ] ADR 0054's 1,000-GBX/one-USDG seed, permanent LP lock, `100,000 ether` GBX Strategy price,
      `50 * pair.totalSupply()` LP Strategy price, 24-hour first-epoch decay, and `1.2e18` multiplier independently
      reviewed. The possible free first fill after full decay is explicitly accepted or changed by ADR.
- [x] V12 finding export for `3ae171b997254b56602298d873b3918d1575b3c7` received, hash-pinned, and independently
      dispositioned in `FINDINGS.md`.
- [ ] ADR 0051's renamed selectors, scalar/batch implementations, aggregate custody loops, periphery Lens, SDK
      composition, and subgraph position index independently reviewed. None is covered by the V12 export for `3ae171b`.
- [x] V12 249695 reproduced against the current public graph and remediated in the development tree by ADR 0052's
      precision-coupled lifetime cap and post-cap scalar-exit regression.
- [ ] ADR 0052's Resonance lifetime cap and generated consumers independently reviewed; V12 covers the vulnerable
      `3ae171b` source only and does not close the later remediation.
- [ ] V12 249702 atomic-launch trace proves all sixteen freshly constructed slots remained untouched through the
      permanent GBX/Mine binding and genesis issue; any transaction that does not establish that ordering is rejected.
- [ ] ADR 0053's V12-249705/CEX-02 authorization remediation, Resonance claim batch, generated consumers, and
      low-decimal/checkpoint regressions independently reviewed. Working-tree selection does not close the finding.
- [ ] ADR 0054's Mine issuance and complete launcher/deployer/V2/ownership surface independently audited. Neither V12
      at `3ae171b` nor the pre-ADR-0054 E-16 campaign covers it.
- [ ] ADR 0055's Mine Router mutability, validation graph, immutable Fund reference, old/new graph liveness boundary,
      Mine/Resonance `Ownable2Step`, launcher pending-owner state, and post-launch dual acceptance are independently
      audited. V12, the direct review, E-16, E-17, and E-18 do not cover them.
- [ ] CEX-09 release-facing landing, deck, and web claims match caller-selected Fund redemption, permanent omission
      forfeiture, and possible rather than guaranteed arbitrage support; alternatively, a complete-basket Fund redesign
      is selected by ADR and independently reviewed.
- [ ] Independent external audit complete; all material findings resolved.
- [ ] donut-miner, give.fun, Liquid Signal, Euler, Solidly, Synthetix, and dependency provenance cleared by counsel.
- [ ] Repository license, SPDX identifiers, attribution, and notices approved.

## Deployment evidence

- [ ] Canonical six-decimal USDG, pinned Uniswap V2 Factory
      `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`, resulting Pair, and informational Router
      `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` approved with runtime code hashes and provenance at one pinned block.
- [ ] Signed manifest verifies chain ID 4663; launcher and four stateless deployer bytecode; immutable GBX, USDG, Fund,
      and launch authority; every constructor argument and expected caller-scoped CREATE2 address; final-owner code;
      fixed Mine constants; `startTime`; deployment block/timestamp; first boundary; deployment-to-exposure delay; and
      dependencies.
- [ ] A current non-broadcast target-state simulation proves the complete launch fits the target transaction gas limit,
      uses the intended authority/final owner, and creates the pristine Pair through the pinned Factory. Any precreated
      Pair blocks that candidate; the operator records the failure, abandons the unused launcher, and repeats the
      manifest review with a fresh launcher whose caller-scoped GBX/Pair addresses differ.
- [ ] The pinned launch trace proves `Mine.gbx() == GBX`, `Mine.usdg() == USDG`, `Mine.fund() == Fund`,
      `Mine.resonanceRouter() == ResonanceRouter`, and the complete reciprocal Router/Resonance/SignalGBX graph before
      seed interaction; pinned post-launch reads repeat those identities and the permanent minter binding before market
      exposure.
- [ ] GBX constructor receipts prove zero supply; permanent minter handoff resolves to Mine before issuance; the only
      launch issuance is exactly `1,000 ether` to the Pair; and Mine ends with `genesisLiquidityMinted == true`, zero
      genesis authority, zero `totalMined`, and the documented lifetime-issuance reconciliation.
- [ ] Pair receipts and pinned reads prove exact token identities, Factory identity, `1e6` USDG and `1,000 ether` GBX
      balances/reserves, total LP supply `31,622,776,601,683`, all LP held by `address(0)`, and no launcher-held LP.
- [ ] Exactly two initial Strategies are receipt-recorded before handoff: GBX at `100,000 ether` and the actual Pair at
      `1,581,138,830,084,150` raw LP, each with equal initial/minimum price, 24-hour epoch, and `1.2e18` multiplier.
- [ ] Mine starts with exactly sixteen slots; launch completion leaves Mine and Resonance owned by the launcher with the
      exact reviewed external governance executor pending; separate receipts prove that executor accepted both and both
      pending owners are zero before exposure.
- [ ] External governance provider, exact release and bytecode, proxy/upgrade model, plugin set, permission graph,
      root/admin holders, emergency paths, and execution semantics are verified.
- [ ] SignalGBX voting checkpoints and delegation are integration-tested against the selected governance system.
- [ ] Ownership-transfer receipts prove the temporary Mine and Resonance setup owner has no callable post-launch path,
      the reviewed governance executor accepted both contracts, and no unexpected pending owner remains.
- [ ] One-time SignalGBX/factory/ResonanceRouter bindings are verified; receipts prove the consumed SignalGBX and factory
      ownership shells were renounced and the temporary setup owner retains no authority through them.
- [ ] Atomicity evidence proves a forced failure after each external stage leaves no partial canonical graph, pair seed,
      ownership transfer, or consumed launcher flag; the operator separately handles any preexisting USDG allowance.
- [ ] The launcher's successful-call flag is consumed, all three setup-only owners are zero, Mine and Resonance belong
      to the exact reviewed executor after explicit acceptance, both pending owners are zero, and only genesis LP is
      locked. Later Fund-held LP is verified as an ordinary selectable redemption asset.
- [ ] The operational cutover plan authenticates a complete replacement graph, switches Mine last, preserves old-graph
      discovery/claim/unsignal paths, reconciles the first new-Router deposit, and never describes the change as moving
      old balances or rescuing an already broken old exit.
- [ ] Replacement evidence separately verifies the new Resonance owner, both factories, live Strategy set, Bribe rate,
      lifetime counters, and intended initial accounting state; Mine's structural setter checks do not cover them.
- [ ] The external governance integration explicitly handles the replacement SignalGBX address and proves that old-
      signal exits cannot remove voting power required to authorize or complete the transition. No Mine call migrates
      checkpoints or changes the governance voting token.
- [ ] Frontend remains read-only until the complete manifest passes.
- [ ] No CI or local validation script broadcasts mainnet transactions.
