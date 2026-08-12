# Release checklist

Current description: **ADR 0024 development candidate; independent review required**. This is not production-ready or
deployment-authorized.

## Internal engineering

- [x] Fundraiser removed and immutable multislot Mine implemented.
- [x] Incumbent slot rates remain fixed through checkpoints, thresholds, redemptions, and capacity increases.
- [x] Capacity is increase-only from one to sixteen.
- [x] Nonempty payments classify 80% to displaced miner and 20% to Resonance; empty slots route 100%.
- [x] Fund checkpoints all live slots before the redemption denominator.
- [x] SDK, subgraph, simulations, whitepaper, frontend, and active architecture docs updated.
- [x] Full current-tree Foundry, Hardhat, SDK, subgraph, simulation, frontend, documentation, and workspace gates pass.
- [ ] Static findings regenerated and manually dispositioned for the Mine graph.
- [ ] Current-tree coverage thresholds recorded for Mine.
- [ ] Current-tree mutation, Medusa, and pinned Echidna campaigns complete.
- [ ] Compatible symbolic analysis or explicit independent disposition complete.
- [ ] A-09 resolved or explicitly accepted with a supported-token policy.

## Economic and independent review

- [ ] Initial GBX/second, cumulative halving amount, positive tail, USDG multiplier, and minimum price approved.
- [ ] Fixed-tenure transitional over-issuance modeled under capacity and threshold scenarios.
- [ ] Rollover, zero-price replacement, MEV, demand collapse, and thin-liquidity scenarios reviewed.
- [ ] Independent external audit complete; all material findings resolved.
- [ ] Farplace, give.fun, Liquid Signal, Euler, Solidly, Synthetix, and dependency provenance cleared by counsel.
- [ ] Repository license, SPDX identifiers, attribution, and notices approved.

## Deployment evidence

- [ ] Canonical USDG and Uniswap dependencies approved with runtime code hashes.
- [ ] Signed manifest verifies chain, bytecode, constructor arguments, immutable Mine parameters, and dependencies.
- [ ] GBX genesis recipient receives exactly 20M and permanent minter handoff resolves to the deployed Mine.
- [ ] Mine starts at capacity one; Resonance and Mine ownership resolve to the reviewed timelock.
- [ ] Timelock delay and proposer/canceller/executor/default-admin roles verified.
- [ ] One-time Resonance/factory/router bindings verified.
- [ ] PoolKey, price, ticks, NFT ID, genesis principal, rounding residual, and permanent custody verified.
- [ ] Frontend remains read-only until the complete manifest passes.
- [ ] No CI or local validation script broadcasts mainnet transactions.
