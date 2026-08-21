# Release checklist

Current description: **ADR 0024/0029/0031/0033/0034/0035/0036/0037 development candidate; external governance unselected and
independent review required**. This is not production-ready or deployment-authorized.

## Internal engineering

- [x] Fundraiser removed and immutable multislot Mine implemented.
- [x] Incumbent slot rates remain fixed through thresholds, redemptions, and other slot handoffs.
- [x] Sixteen slots are fixed at construction and Mine has no administrative surface.
- [x] Nonempty payments classify 80% to displaced miner and 20% to Resonance; empty slots route 100%.
- [x] Fund uses constant-time effective supply, including all pending mining, for the redemption denominator.
- [x] SDK, subgraph, whitepaper, frontend, audit records, and generated references reconciled after ADRs 0036 and 0037.
- [x] Full current-tree Foundry, Hardhat, SDK, subgraph, simulation, frontend, documentation, and workspace gates pass.
- [ ] Static findings regenerated and manually dispositioned for the Mine graph.
- [ ] Current-tree coverage thresholds recorded for Mine.
- [x] Current-tree 49-mutant campaign complete with zero survivors.
- [ ] Current-tree Medusa and pinned Echidna campaigns complete.
- [ ] Compatible symbolic analysis or explicit independent disposition complete.
- [x] Bribe A-09 carry is fixed to Fund before signal-supply changes, with entry, exit, and remainder regressions.
- [x] SignalGBX coordinates atomic signal workflows, retains ERC20Votes, and omits its unused ERC20Permit surface.
- [x] In-repository ProtocolGovernor and protocol Timelock removed under ADR 0034 while SignalGBX retains ERC20Votes.
- [x] Global automatic-Bribe share is prospective, uniform, owner-only, and bounded from 0% through 20%; weighted
      numerator carry, existing liabilities, and signal liveness are covered by deterministic and integration tests.
- [x] Bribe reward accounting uses `1e36` precision with a precision-coupled lifetime cap; six-decimal direct and
      automatic rewards are covered by deterministic, fuzz, stateful, integration, and independent-model tests.
- [ ] Full current-tree invariant, Medusa, Echidna, static, ABI, model, subgraph, and consumer gates rerun
      after ADRs 0036 and 0037.
- [ ] Current-tree static findings regenerated and manually dispositioned after the governance-architecture removal.
- [ ] SignalGBX checkpoint/delegation compatibility and voting-power rental risk reviewed against the exact external
      governance release.
- [ ] External governance permissions, proposal scope, batching, quorum/support, execution, delay, cancellation,
      admin, emergency, and upgrade paths independently reviewed and accepted, including `setBribeBps` scheduling and
      public monitoring.

## Economic and independent review

- [ ] Initial GBX/second, cumulative halving amount, positive tail, USDG multiplier, and minimum price approved.
- [ ] Fixed-tenure transitional over-issuance modeled under staggered halving and turnover scenarios.
- [ ] Rollover, zero-price replacement, MEV, demand collapse, and thin-liquidity scenarios reviewed.
- [ ] Independent external audit complete; all material findings resolved.
- [ ] Farplace, give.fun, Liquid Signal, Euler, Solidly, Synthetix, and dependency provenance cleared by counsel.
- [ ] Repository license, SPDX identifiers, attribution, and notices approved.

## Deployment evidence

- [ ] Canonical USDG and Uniswap dependencies approved with runtime code hashes.
- [ ] Signed manifest verifies chain, bytecode, constructor arguments, immutable Mine parameters, and dependencies.
- [ ] GBX genesis recipient receives exactly 20M and permanent minter handoff resolves to the deployed Mine.
- [ ] Reviewed initial Strategies are created and receipt-recorded before external-governance ownership handoff.
- [ ] Mine starts with exactly sixteen slots and no owner; Resonance ownership resolves to the exact reviewed external
      governance executor.
- [ ] External governance provider, exact release and bytecode, proxy/upgrade model, plugin set, permission graph,
      root/admin holders, emergency paths, and execution semantics are verified.
- [ ] SignalGBX voting checkpoints and delegation are integration-tested against the selected governance system.
- [ ] Ownership-transfer receipts prove the temporary Resonance setup owner retains no authority.
- [ ] One-time SignalGBX/factory/router bindings are verified; receipts prove the consumed SignalGBX and factory
      ownership shells were renounced and the temporary setup owner retains no authority through them.
- [ ] PoolKey, price, ticks, NFT ID, genesis principal, rounding residual, and permanent custody verified.
- [ ] Frontend remains read-only until the complete manifest passes.
- [ ] No CI or local validation script broadcasts mainnet transactions.
