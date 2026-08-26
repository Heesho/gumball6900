# Release checklist

Current description: **ADR 0024/0029/0031/0033-0051 development candidate;
external governance unselected and independent review required**. This is not production-ready or
deployment-authorized.

## Internal engineering

- [x] Fundraiser removed and immutable multislot Mine implemented.
- [x] Occupied-tenure rates remain fixed through time boundaries, redemptions, and other slot replacements.
- [x] Sixteen slots are fixed at construction and Mine has no administrative surface.
- [x] Nonempty payments classify 80% to the outgoing tenure miner and deposit 20% into ResonanceRouter; empty slots
      deposit 100%.
- [x] Mine emits `RevenueDeposited` and performs no synchronous `route()` call; permissionless routing has no role,
      bounty, or liveness guarantee.
- [x] GBX starts with zero supply, Mine is its sole lifetime issuer after the permanent handoff, and the eleven-contract
      core contains no liquidity-specific contract; a reviewed, externally created fungible Uniswap v2-style USDG/GBX
      LP ERC-20 uses the ordinary Strategy path.
- [x] Fund uses constant-time effective supply, including all pending mining, for the redemption denominator.
- [x] Current source, focused tests, audit records, consumers, and architecture references reconciled through ADR 0051.
- [x] Historical post-ADR-0050 contract source at `3ae171b` passed 293/293 default Foundry tests, all 27 invariant entries
      at 1,000 runs of depth 500 with zero handler reverts, 10/10 integration tests, 4/4 Hardhat tests including parity,
      and contract lint, ordering, formatting, build, size, generated-documentation, and SDK ABI checks. This evidence
      predates and does not cover ADR 0051.
- [x] Current ADR-0051 contract matrix passes 299/299 default Foundry tests, all 27 invariant entries at 1,000 runs of
      depth 500 with zero handler reverts, 4/4 Hardhat tests including bytecode parity, contract lint/order/format,
      `forge build --sizes`, generated contract documentation, and SDK ABI checks.
- [x] Current ADR-0051 consumer matrix passes 51/51 SDK tests, SDK typecheck/build, 5/5 subgraph specification tests,
      9/9 Matchstick tests, subgraph codegen/build/ABI checks, 28/28 TypeScript simulations, 22/22 Python simulations,
      5/5 simulation-environment tests, 3/3 web unit tests, and repository-wide lint/typecheck/build. The root test
      matrix passes all nine packages.
- [ ] Final post-ADR-0051 browser E2E, repository-wide format, and full mutation rerun. The concurrent landing redesign
      currently leaves one stale assertion failing in two browser profiles, and the focused ADR-0048 mutation result
      predates later changes.
- [x] Historical focused ADR-0048 migration suites passed 104/104, including the sixteen-token bound, composed move,
      rollback, checkpoint ordering, absent Resonance move selector, and maximum-bound gas regressions. Public move was
      later removed by ADR 0051, so those results are not current batch evidence.
- [ ] Repository-wide format gate passes. Seven unrelated baseline files — six landing files plus `pnpm-lock.yaml` —
      still fail Prettier; this remains open even though the changed files and Solidity formatting pass.
- [ ] Static findings regenerated and manually dispositioned for the complete ADR-0051 graph.
- [ ] Current-tree coverage thresholds recorded for Mine.
- [x] Focused ADR-0048 mutation campaign killed 47/47 mutants, including the cap regression and composed-move
      omission, same-Strategy, and restored-hook mutations.
- [x] Current ADR-0051 focused mutation smokes test-kill 16/16 SignalGBX mutants and 1/1 restored Resonance move-hook
      mutant, with pattern-specific raw reports retained under `audit/reports`.
- [ ] Remaining 34 post-ADR-0051 mutants and one complete 51-mutant campaign run and independently dispositioned.
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
      rollover, uninterrupted zero-supply time, and all-token plus scalar-token claims under a standard-token model.
- [x] Bribe reward registration is append-only and fixed at sixteen tokens. Scalar maximum-bound operations and the
      current two-Strategy batch regression remain far below a 30-million-gas block; larger batches require chunking.
- [x] Resonance exposes no dedicated move hook. ADR 0051 also removes public SignalGBX move; any wallet-level
      reallocation composes direct remove/add calls without granting a Router custody or operator authority.
- [ ] SignalGBX checkpoint/delegation compatibility and voting-power rental risk reviewed against the exact external
      governance release.
- [ ] External governance permissions, proposal scope, batching, quorum/support, execution, delay, cancellation,
      admin, emergency, and upgrade paths independently reviewed and accepted, including `setBribeBps` scheduling and
      public monitoring.

## Economic and independent review

- [ ] Initial GBX/second, time-based halving period, positive tail, USDG multiplier, and minimum price independently
      reviewed. ADRs 0042 and 0043 record a provisional 64 GBX/second, 69-day, 1 GBX/second development schedule.
- [ ] Fixed Mine economic schedule independently reviewed and approved.
- [ ] Fixed-tenure excess issuance modeled under staggered, frequent-turnover, slow-turnover, and permanent-no-turnover
      scenarios.
- [ ] Rollover, zero-price replacement, MEV, demand collapse, and thin-liquidity scenarios reviewed.
- [x] V12 finding export for `3ae171b997254b56602298d873b3918d1575b3c7` received, hash-pinned, and independently
      dispositioned in `FINDINGS.md`.
- [ ] ADR 0051's renamed selectors, scalar/batch implementations, aggregate custody loops, periphery Lens, SDK
      composition, and subgraph position index independently reviewed. None is covered by the V12 export for `3ae171b`.
- [x] V12 249695 accepted as a theoretical risk under the canonical six-decimal USDG identity and supply assumption; no
      source change selected. Reopen if the supported revenue-token model changes.
- [ ] V12 249702 deployment evidence proves every slot remained untouched through binding; any contaminated candidate
      is abandoned and redeployed before exposure.
- [ ] V12 249705 resolved by selecting beneficiary-only or permissionless claims, then updating disclosure and adding
      independent low-decimal/checkpoint regression coverage for the selected behavior.
- [ ] Independent external audit complete; all material findings resolved.
- [ ] donut-miner, give.fun, Liquid Signal, Euler, Solidly, Synthetix, and dependency provenance cleared by counsel.
- [ ] Repository license, SPDX identifiers, attribution, and notices approved.

## Deployment evidence

- [ ] Canonical USDG and any selected external LP dependencies approved with runtime code hashes.
- [ ] Signed manifest verifies chain, bytecode, constructor arguments, fixed Mine constants, `startTime`, deployment
      block timestamp, first boundary, deployment-to-exposure delay, and dependencies.
- [ ] Pinned post-deployment reads prove `Mine.gbx() == GBX`, `Mine.usdg() == USDG`,
      `Mine.resonanceRouter() == ResonanceRouter`, and `ResonanceRouter.usdg() == USDG` before the permanent GBX minter
      handoff or market exposure.
- [ ] GBX deploys with zero supply and its permanent minter handoff resolves to the deployed Mine before any issuance.
- [ ] Reviewed initial Strategies are created and receipt-recorded before external-governance ownership handoff.
- [ ] Mine starts with exactly sixteen slots and no owner; Resonance ownership resolves to the exact reviewed external
      governance executor.
- [ ] External governance provider, exact release and bytecode, proxy/upgrade model, plugin set, permission graph,
      root/admin holders, emergency paths, and execution semantics are verified.
- [ ] SignalGBX voting checkpoints and delegation are integration-tested against the selected governance system.
- [ ] Ownership-transfer receipts prove the temporary Resonance setup owner retains no authority.
- [ ] One-time SignalGBX/factory/ResonanceRouter bindings are verified; receipts prove the consumed SignalGBX and factory
      ownership shells were renounced and the temporary setup owner retains no authority through them.
- [ ] Any initial USDG-GBX LP Strategy is verified as an ordinary externally created fungible Uniswap v2-style token
      Strategy with the intended pair and deployment provenance; no liquidity-specific core behavior is assumed.
- [ ] Frontend remains read-only until the complete manifest passes.
- [ ] No CI or local validation script broadcasts mainnet transactions.
