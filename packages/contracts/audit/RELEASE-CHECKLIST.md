# Release checklist

Current description: **internal adversarial review completed with open findings; focused independent security review
is required**. This is not a production-ready or deployment-authorized state.

## Internal engineering

- [x] Contract graph and minimized trust model preserved; ADR 0021 supersedes the earlier settlement split.
- [x] A-02 exact revenue carry implemented with conservation invariants.
- [x] A-03 exact stream/queue/zero-supply accounting and selective claims implemented.
- [x] A-04 exit path decoupled from fixed-destination transfers.
- [x] A-06 caller-funded LP composition risk removed by ADR 0022 fixed-principal fee routing.
- [x] Eight-token cap preserved and worst-case exit gas measured below 3,000,000.
- [x] ABI generation and subgraph ABI synchronization updated.
- [x] Genuine Uniswap v4 integration suite passed.
- [x] Target-chain EIP-1153 and documented v4 addresses checked at a pinned block.
- [ ] A-09 carry-boundary reallocation resolved or explicitly accepted with a documented low-decimal-token policy.
- [ ] Current-tree mutation campaign has no surviving meaningful mutant.
- [x] Medusa 1.5.1 passes the current graph at more than 100,000 calls.
- [ ] Pinned Echidna 2.3.2 passes the current graph.
- [ ] Mythril/symbolic checks complete or formally dispositioned.
- [x] Static disposition database regenerated for the current graph.
- [x] Coverage and Mythril policies enumerate the exact current 12-contract graph and fail closed on drift.
- [ ] Six redacted Gitleaks history matches independently classified.

## Independent and legal

- [ ] Independent external audit complete; all Critical/High/Medium findings resolved.
- [ ] Licensing/provenance approved by counsel, including Euler/Solidly/Synthetix lineage and Uniswap dependency terms.
- [ ] Repository license, SPDX identifiers, attribution, and notices approved.

## Deployment evidence

- [ ] Canonical USDG and all external dependency addresses approved.
- [ ] Current ADR 0021 deployment schema and non-broadcast validation harness replace the archived legacy graph.
- [ ] Signed manifest verifies chain ID, runtime bytecode, constructor arguments, and code hashes.
- [ ] Timelock delay and proposer/canceller/executor/default-admin roles verified.
- [ ] GBX minter lock and all one-time bindings verified.
- [ ] PoolKey, initial price, ticks, NFT ID, genesis principal, rounding residual, and final custody verified.
- [ ] Frontend stays read-only until the complete manifest passes.
- [ ] No CI or local script broadcasts mainnet transactions during validation.

## Blocked reproducible commands

```bash
bash packages/contracts/audit/install-tools.sh nightly
bash packages/contracts/audit/run-nightly.sh
FOUNDRY_PROFILE=nightly forge test --summary
```

The pinned nightly command requires Docker for Echidna and Mythril. Exact Foundry 1.7.1 is available and was used for
the completed contract and Medusa campaigns, but Docker is unavailable. A native Echidna 2.3.3 fallback is not a
substitute for the pinned 2.3.2 image; all four native workers crashed before transaction one.
