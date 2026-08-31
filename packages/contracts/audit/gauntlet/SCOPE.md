# Scope

## Primary scope

- every first-party Solidity contract and interface under `packages/contracts/src/core`, `src/periphery`, and
  `src/launch`;
- the complete delta from `f9912533e999454f1a3fd49276558bd85e1390da` to the frozen target;
- Foundry, Hardhat, invariant, integration, differential, mutation, static-analysis, and fork harnesses;
- launch/deployment configuration, ABI generation, SDK transaction builders, subgraph safety-critical discovery, and
  economic reference models where an error can cause unsafe calls or hide a required exit path.

## External systems treated as assumptions or reference behavior

- canonical USDG under the repository's standard non-rebasing ERC-20 model;
- Robinhood Chain ID 4663 and the pinned Uniswap V2 Factory;
- Curve MultiRewards and Euler Fee Flow at the exact commits recorded in `UPSTREAM_PROVENANCE.md`;
- a separately selected external governance executor, which remains a release blocker and is not supplied here.

## Excluded from mutation

The pre-existing landing-app and media changes recorded in `TARGET.json` are user work and will not be staged, modified,
or used as audit evidence. No live-chain write, broadcast, deployment, ownership transfer, funding, publication, package
release, or manifest signing is authorized.
