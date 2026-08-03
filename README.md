# GUM BALL 6900

GUM BALL 6900 is a deliberately minimal, oracleless onchain basket. Users contribute USDG to daily mining epochs,
receive GBX from a bounded lifetime issuance schedule, signal staked GBX toward fixed-lot strategies, and may burn GBX
for an in-kind fraction of every raw asset balance registered in `GumBallVault`.

> **Not audited. Not deployed. Not ready for user funds.** The repository is an engineering workspace. Local builds,
> tests, generated artifacts, and candidate configuration are not a release, verification, signed manifest, or
> authorization to broadcast transactions.

## Minimal protocol

- `GBXToken` mints exactly 20,000,000 GBX once to the deployment account and enforces a cumulative lifetime mint cap
  of 1,000,000,000 GBX. Burns never restore mint capacity.
- The deployment script places as much of the 20M allocation as Uniswap v4 integer math permits into one hookless,
  single-sided GBX/USDG position, burns the unusable residual, and transfers the exact NFT to `LiquidityCustodian`.
- `EmissionController` schedules the remaining nominal 980M over daily mining epochs with a smooth four-year
  half-life. A non-empty ended epoch receives the complete scheduled amount; an empty epoch advances without minting
  or carry.
- `MiningPool` records payer and beneficiary separately. On settlement it sends an optional fixed 2% fee to the
  configured team, deposits the remainder into `GumBallVault`, and mints the epoch allocation into `MiningClaims`.
- `StakedGBX` is a non-transferable 1:1 receipt. Signals are immediately replaceable or resettable, and unstaking is
  immediate after all signals are reset.
- `AllocationVoter` is only an accounting ledger. USDG remains physically in the vault. Revenue received while total
  active strategy weight is zero becomes `idleUSDG`; it is never assigned retroactively.
- `AcquisitionStrategy` and `BuybackStrategy` use fixed USDG lots and the exact pinned give.fun reverse Dutch auction
  transition. Acquisition sends observed target tokens 98% to the vault and 2% to supporters when reward weight
  exists, otherwise 100% to the vault. Buyback burns observed GBX before USDG release.
- Redemption is unpausable and uses pre-burn `totalSupply()` against every registered raw vault balance. It does not
  use a price, NAV, substitution, or valuation feed.
- USDG and every acquisition or registered asset are deployment-approved standard ERC-20 tokens: non-rebasing and
  non-fee-on-transfer. Exact debit/receipt assertions fail closed; measured deltas elsewhere are accounting guards.
  Neither adds support for exotic token behavior.
- There are no proxies, public strategy factory, generic executor, arbitrary vault call, staking withdrawal lock,
  or additional initial funding/distribution machinery.

## Initial deployment state

`DeployMinimal.s.sol` deploys and wires one acquisition/rewards pair and one buyback strategy, but deliberately leaves
both strategies unregistered and inactive. The registry initially contains only USDG and zero strategies. Each
strategy must be admitted by its own typed `ProtocolTimelock` operation after the fixed seven-day delay:

- the acquisition target, acquisition strategy, and rewards contract are registered together; and
- the buyback strategy is registered separately without adding GBX to the redeemable basket.

Both auction clocks remain unset before admission. Each successful registration atomically starts that strategy's
first auction at the configured initial price, so the registration delay does not age the auction.

Mining starts only after the exact position NFT is in custody. Revenue received before a live strategy has active
signal weight stays idle and redeemable in the vault; later registration or signaling does not retroactively allocate
it.

## Delayed trust surfaces

The typed timelock is not a claim of immutability. Its proposer can schedule three code/value-moving operations, each
visible for seven days:

1. replace the emission controller; a malicious compatible replacement can mint all remaining lifetime capacity to
   an arbitrary receiver, although it cannot exceed the token's cumulative cap;
2. transfer the exact canonical Uniswap v4 position NFT to any nonzero deployed-code recipient; and
3. admit strategy code to the registry. A registered strategy may release only its current signaled USDG budget, but
   it chooses the release receiver. Registration checks immutable-style wiring getters; they do not attest runtime
   bytecode or prove strategy semantics.

A registered acquisition tuple also admits its rewards hook. While live, a reverting rewards callback can block
signal updates or reset. Terminal guardian/timelock disablement restores exit liveness: subsequent zero-weight resets
do not call the disabled strategy's rewards contract, allowing the user to unstake even if that code reverts or burns
all forwarded gas. An honest rewards contract keeps a terminal weight snapshot so already indexed claims remain
claimable; canonical disabled acquisition strategies cannot produce new reward notifications.

The proposer, candidate controller code, NFT recipient code, and every strategy candidate therefore require review.
The delay is notice, not enforcement that the new code behaves honestly. See
[Trust assumptions](docs/TRUST_ASSUMPTIONS.md) and [Access control](docs/ACCESS_CONTROL.md).

`EmergencyGuardian` is stop-only: it can pause new mining contributions, pause signal increases, pause live strategy
fills, or terminally disable a live strategy. It cannot resume, mint, move the NFT or vault assets, block redemption,
block reset/unstake, block claims, or stop ended-epoch settlement.

## Repository layout

```text
apps/web                    Web application
packages/contracts/src      Single Solidity source tree for Foundry and Hardhat
packages/contracts/script   Deployment and operational scripts
packages/contracts/test     Foundry and Hardhat tests
packages/sdk                Generated ABIs and typed SDK
packages/subgraph           Subgraph schema, mappings, and tests
packages/simulations        Independent Python and TypeScript economic models
packages/config             Candidate network and deployment evidence
docs                        Architecture, economics, controls, and operating limits
```

Do not edit generated compiler output under `artifacts`, `cache`, `out`, or `typechain-types`. Generate SDK ABIs from
Foundry artifacts and synchronize subgraph ABIs after any relevant event or interface change.

## Local checks

Use Node `22.23.1`, pnpm `10.14.0`, Solidity `0.8.26`, and the repository-pinned toolchain.

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm sdk:abi:check
pnpm subgraph:build
pnpm web:test:e2e
```

Contract changes also require `forge fmt --check`, `forge build --sizes`, the configured Foundry suite, and Hardhat
tests. Economic changes require both independent models and `pnpm simulations:fixtures:check`. A skipped fork is not
a pass; any fork result must name the RPC capability and pinned block.

## Deployment boundary

No canonical deployment exists in this repository. Production inputs remain unresolved, including USDG,
PositionManager, Permit2, acquisition target, initial square-root price, fee tier, tick spacing and range, both auction
lots and price bounds, auction duration and multiplier, the absolute future liquidity deadline, proposer, guardian,
team, chain/fork evidence, and a signed manifest. Token review must establish standard non-rebasing,
non-fee-on-transfer ERC-20 behavior for USDG and every candidate asset. `packages/config/deployments` contains
candidates or evidence only unless a signed manifest clears every gate.

The deployment script must be rehearsed against exact inputs and must prove the complete graph, one-position
custody, residual burn, zero deployer GBX balance, controller initialization, and inactive/unregistered strategy
state. Deploying, verifying, transferring roles, funding, or publishing requires separate explicit authorization.

See [Deployment](docs/DEPLOYMENT.md) for the full input and verification checklist.

## Documentation

- [Specification](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Economics](docs/ECONOMICS.md)
- [Emissions](docs/EMISSIONS.md)
- [Invariants](docs/INVARIANTS.md)
- [Uniswap v4 integration](docs/UNISWAP_V4.md)
- [Trust assumptions](docs/TRUST_ASSUMPTIONS.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Access control](docs/ACCESS_CONTROL.md)
- [Minimal rebuild review](docs/MINIMAL_REBUILD_REVIEW.md)
- [ADR-0012](docs/adr/0012-minimal-genesis-controller-and-liquidity-custody.md)

## Licensing

The distribution license is unresolved. Source files currently retain BUSL-1.1 headers pending counsel, while the
pinned give.fun and Liquid Signal Governance inputs carry MIT headers and disclose transitive ancestry that includes
Euler Fee Flow GPL-2.0-or-later material. No separate permission or dual-license evidence has been identified. The
exact provenance is recorded in [NOTICE](NOTICE); this blocker must be resolved before distribution or release.
