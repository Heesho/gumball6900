# Release checklist

Current description: **ADR 0024/0029/0030 development candidate; independent review required**. This is not
production-ready or deployment-authorized.

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
- [x] Bribe A-09 carry is fixed to Fund before signal-supply changes, with entry, exit, and remainder regressions.
- [x] SignalGBX coordinates atomic signal workflows, retains ERC20Votes, and omits its unused ERC20Permit surface.
- [x] ProtocolGovernor restricts proposals to the four exact zero-value maintenance calls.
- [ ] Current-tree static findings regenerated and manually dispositioned for ProtocolGovernor and coordinator flows.
- [ ] Governance vote borrowing, quorum liveness, immutable parameters, and absent queued cancellation independently
      reviewed and accepted.

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
- [ ] Reviewed initial Strategies are created and receipt-recorded before governance ownership handoff.
- [ ] Mine starts at capacity one; Resonance and Mine ownership resolve to the reviewed Timelock.
- [ ] ProtocolGovernor token, Timelock, Resonance, Mine, immutable settings, and four-selector filter are verified.
- [ ] Governor is the sole Timelock proposer/canceller, execution is open, and no external default admin survives.
- [ ] One-time Resonance/factory/router bindings verified.
- [ ] PoolKey, price, ticks, NFT ID, genesis principal, rounding residual, and permanent custody verified.
- [ ] Frontend remains read-only until the complete manifest passes.
- [ ] No CI or local validation script broadcasts mainnet transactions.
