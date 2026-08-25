# Release checklist

Current description: **ADR 0024/0029/0031/0033-0050 development candidate;
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
- [x] Current source, focused tests, audit records, and architecture references reconciled through ADR 0050.
- [x] The post-ADR-0050 contract source at `3ae171b` passes 293/293 default Foundry tests, all 27 invariant entries
      at 1,000 runs of depth 500 with zero handler reverts, 10/10 integration tests, 4/4 Hardhat tests including parity,
      and contract lint, ordering, formatting, build, size, generated-documentation, and SDK ABI checks.
- [ ] Final post-ADR-0050 SDK-test, simulation, subgraph, frontend, wider workspace, artifact, full lint/typecheck, and
      mutation matrix rerun. The recorded complete ADR-0047 workspace matrix and focused ADR-0048 mutation result
      predate later changes.
- [x] Focused ADR-0048 migration suites pass 104/104, including the sixteen-token bound, composed move, rollback,
      checkpoint ordering, absent Resonance move selector, and maximum-bound gas regressions.
- [ ] Repository-wide format gate passes. Seven unrelated baseline files — six landing files plus `pnpm-lock.yaml` —
      still fail Prettier; this remains open even though the changed files and Solidity formatting pass.
- [ ] Static findings regenerated and manually dispositioned for the complete ADR-0050 graph.
- [ ] Current-tree coverage thresholds recorded for Mine.
- [x] Focused ADR-0048 mutation campaign killed 47/47 mutants, including the cap regression and composed-move
      omission, same-Strategy, and restored-hook mutations.
- [ ] Current-tree Medusa and pinned Echidna campaigns complete, with time-jump bounds reaching the first 69-day
      boundary and day-414 tail boundary.
- [ ] Compatible symbolic analysis or explicit independent disposition complete.
- [x] Resonance and Bribe use Synthetix-style leftover rollover and ordinary floors; there are no carry buckets or Fund
      reward liabilities, and entry/exit regressions prove rounded pre-change value is not inherited by later weights.
- [x] SignalGBX coordinates atomic signal workflows, retains ERC20Votes, and omits its unused ERC20Permit surface.
- [x] In-repository ProtocolGovernor and protocol Timelock removed under ADR 0034 while SignalGBX retains ERC20Votes.
- [x] Global automatic-Bribe share is prospective, uniform, owner-only, and bounded from 0% through 20%; each Strategy
      purchase floors independently, sends the complement directly to Fund, and buffers only its Bribe share.
- [x] Bribe reward accounting uses `1e36` precision with a precision-coupled lifetime cap, standard seven-day leftover
      rollover, uninterrupted zero-supply time, and all-token plus scalar-token claims under a standard-token model.
- [x] Bribe reward registration is append-only and fixed at sixteen tokens. Current gas measurements remain below two
      million for every focused maximum-bound operation, including 1,890,938 for a composed move across two full
      Bribes.
- [x] SignalGBX movement atomically composes `removeSignalFor` then `addSignalFor`; destination failure rolls back the
      source, both Strategies checkpoint before their own weight mutation, and Resonance exposes no dedicated move
      hook.
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
