# Release checklist

Current description: **ADR 0024/0029/0031/0032/0033/0034 development candidate; external governance unselected and
independent review required**. This is not production-ready or deployment-authorized.

## Internal engineering

- [x] Fundraiser removed and immutable multislot Mine implemented.
- [x] Incumbent slot rates remain fixed through thresholds, redemptions, and other slot handoffs.
- [x] Sixteen slots are fixed at construction and Mine has no administrative surface.
- [x] Nonempty payments classify 80% to displaced miner and 20% to Resonance; empty slots route 100%.
- [x] Fund uses constant-time effective supply, including all pending mining, for the redemption denominator.
- [ ] SDK, subgraph, whitepaper, frontend, audit records, and generated references reconciled after ADR 0034 removal.
- [ ] Full current-tree Foundry, Hardhat, SDK, subgraph, simulation, frontend, documentation, and workspace gates pass.
- [ ] Static findings regenerated and manually dispositioned for the Mine graph.
- [ ] Current-tree coverage thresholds recorded for Mine.
- [ ] Current-tree mutation, Medusa, and pinned Echidna campaigns complete.
- [ ] Compatible symbolic analysis or explicit independent disposition complete.
- [x] Bribe A-09 carry is fixed to Fund before signal-supply changes, with entry, exit, and remainder regressions.
- [x] SignalGBX coordinates atomic signal workflows, retains ERC20Votes, and omits its unused ERC20Permit surface.
- [x] In-repository ProtocolGovernor and protocol Timelock removed under ADR 0034 while SignalGBX retains ERC20Votes.
- [ ] Current-tree static findings regenerated and manually dispositioned after the governance-architecture removal.
- [ ] SignalGBX checkpoint/delegation compatibility and voting-power rental risk reviewed against the exact external
      governance release.
- [ ] External governance permissions, proposal scope, batching, quorum/support, execution, delay, cancellation,
      admin, emergency, and upgrade paths independently reviewed and accepted.

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
- [ ] One-time Resonance/factory/router bindings verified.
- [ ] PoolKey, price, ticks, NFT ID, genesis principal, rounding residual, and permanent custody verified.
- [ ] Frontend remains read-only until the complete manifest passes.
- [ ] No CI or local validation script broadcasts mainnet transactions.
