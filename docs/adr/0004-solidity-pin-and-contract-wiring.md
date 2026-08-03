# ADR-0004: Solidity Pin and Contract Wiring

- Status: Accepted for the implementation baseline
- Date: 2026-08-01
- Decision owners: protocol engineering and security review
- Supersedes: none

## Context

The protocol must compile one Solidity source tree with Foundry and Hardhat, integrate OpenZeppelin 5.x and Uniswap
v4, remain reproducible, and avoid upgrade or mutable-reference risks. Uniswap v4 compatibility also requires an EVM
target with the opcodes and semantics used by the pinned release.

Construction order creates some cyclic relationships: for example, staking and voting need fixed references to each
other, while the token's minter and launch components must be known before genesis settlement. A broad initializer or
mutable role system would make these relationships replaceable after review.

## Decision

The baseline pins:

```text
Solidity:               0.8.26
EVM target:             Cancun
Optimizer:              enabled, 10,000 runs
viaIR:                  false
Metadata bytecode hash: none
Metadata CBOR trailer:  disabled
OpenZeppelin Contracts: 5.6.1
Uniswap v4 core:        1.0.2
Uniswap v4 periphery:   1.0.3
```

Every source file uses the exact pragma `pragma solidity 0.8.26;`. Foundry and Hardhat compile the same
`packages/contracts/src` tree with equivalent optimizer, EVM, and metadata settings. Dependency versions are exact,
not ranges. Release artifacts record compiler binary/version, settings, dependency lockfile, source hash, and
reproducible bytecode hash.

Robinhood mainnet and testnet deployment remains blocked until a fork rehearsal proves Cancun opcode support and
compatibility with the official v4 contracts at the verified addresses.

Core contracts are direct, non-upgradeable deployments. There are no transparent, UUPS, beacon, diamond, or other
proxy upgrade paths.

Wiring follows this order of preference:

1. Constructor immutable for every peer known at deployment.
2. A one-time setter only where a documented construction cycle makes an immutable impossible.
3. The setter is restricted to a construction coordinator, validates nonzero address and expected code/interface,
   rejects a second call, emits the finalized peer, and permanently closes before any user funds enter.

Operational actors cannot replace the token, minter, vault, voter, strategy, reward contract, USDG, or liquidity
manager. EmissionController exposes role-specific genesis and mining methods rather than a generic mint role.
Strategies, revenue sources, and maintenance endpoints use exact peer/selector authorization rather than an
arbitrary executor.

The LaunchGuardHook is a direct CREATE2 deployment. Its address is mined for the required Uniswap v4 permission bits,
its bytecode is verified before launch, and it has no upgrade path.

## Consequences

Benefits:

- Compiler and bytecode are reproducible across both toolchains.
- Reviewed economic wiring cannot be redirected after deposits arrive.
- Privileged compromise is constrained to explicitly documented maintenance operations.
- Storage-layout drift is irrelevant to upgrades, though layout output remains an audit artifact.

Costs and risks:

- A core defect requires risk shutdown and a separately reviewed successor deployment rather than an upgrade.
- Deployment orchestration is more involved because all one-time wiring must finish before launch.
- Cancun or library incompatibility on Robinhood Chain blocks deployment and requires a new ADR, dependency review,
  full differential/fork rerun, and new audit scope.
- Exact dependency updates require deliberate review rather than automatic semver uptake.

## Verification

- `forge build` and Hardhat compile the same source with the recorded settings; the Hardhat parity test compares both
  init bytecode and deployed bytecode for every deployable protocol source.
- CI rejects open compiler ranges, proxy imports/deployments, mutable core peer setters, and ABI drift.
- Tests prove each one-time setter rejects unauthorized, zero, code-less, incompatible, and repeated initialization.
- Deployment tests assert every peer address and role before allowing bootstrap contributions.
- Mainnet and testnet fork tests exercise transient-storage/v4 behavior under the pinned EVM target.
- A reproducible build regenerates identical deployed bytecode from the release commit.
