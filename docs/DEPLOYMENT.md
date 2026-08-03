# Minimal deployment and activation runbook

> **No deployment is authorized or represented by this document.** `DeployMinimal.s.sol` is local engineering code.
> Do not broadcast, verify externally, transfer roles, fund contracts, sign a manifest, or publish a site unless that
> exact action is separately authorized and every prerequisite below is satisfied.

## Release blockers

Before any external deployment authorization, all of the following remain required:

- resolution of the repository-wide license and the transitive GPL ancestry recorded in `NOTICE`;
- independent contract, economic, deployment-script, and operational security review;
- legal, issuer, and asset-compatibility approval;
- exact network, external-contract, and token runtime-code evidence at pinned blocks;
- full Foundry, Hardhat, ABI, subgraph, simulation, SDK, and web gates;
- a reviewed production configuration and repeated pinned-fork rehearsal;
- proposer/guardian/team operational ownership and monitoring procedures; and
- a signed, public, machine-readable manifest binding every address, code hash, value, role, and transaction plan.

Local compilation or a green rehearsal is engineering evidence only.

## Deployment graph

`packages/contracts/script/minimal/DeployMinimal.s.sol` deploys:

1. `ProtocolTimelock`
2. `EmergencyGuardian`
3. `GBXToken`
4. `MiningClaims`
5. `AssetRegistry`
6. `AllocationVoter`
7. `GumBallVault`
8. `StakedGBX`
9. `StrategyRewards`
10. `AcquisitionStrategy`
11. `BuybackStrategy`
12. `LiquidityCustodian`
13. `MiningPool`
14. `EmissionController`

It then consumes the initializer-only dependency bindings, initializes the hookless pool, mints one single-sided
position, clears approvals, burns residual GBX, transfers the exact NFT into custody, validates the strategy graph,
and starts epoch zero.

The script does **not** register either strategy. Successful completion leaves one registered asset (USDG), zero
registered strategies, and the deployed acquisition and buyback strategies inactive.

## Required configuration

Every value is explicit. None may be guessed from a symbol, UI, previous candidate file, or unpinned endpoint.

| Environment variable             | Meaning and review requirement                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GBX_DEPLOYER`                   | Actual broadcast account and temporary initializer/position depositor. It must match the signer used by Foundry. |
| `GBX_USDG`                       | Reviewed standard non-rebasing, non-fee-on-transfer USDG contract.                                               |
| `GBX_V4_POSITION_MANAGER`        | Reviewed Uniswap v4 PositionManager with pinned runtime code.                                                    |
| `GBX_PERMIT2`                    | Reviewed Permit2 contract with pinned runtime code.                                                              |
| `GBX_PROTOCOL_PROPOSER`          | Operational proposer, expected to be a reviewed multisig/control account.                                        |
| `GBX_GUARDIAN_OPERATOR`          | Stop-only guardian operator, expected to be a separately controlled account.                                     |
| `GBX_TEAM`                       | Optional mining-fee receiver; zero disables the fee transfer.                                                    |
| `GBX_ACQUISITION_TARGET`         | Reviewed standard non-rebasing, non-fee-on-transfer target token.                                                |
| `GBX_ACQUISITION_USDG_LOT`       | Fixed USDG amount released per acquisition fill.                                                                 |
| `GBX_ACQUISITION_INIT_PRICE`     | Initial target-token quote per fixed acquisition lot, in target raw units.                                       |
| `GBX_ACQUISITION_MIN_INIT_PRICE` | Lower clamp for the next acquisition initial quote.                                                              |
| `GBX_BUYBACK_USDG_LOT`           | Fixed USDG amount released per buyback fill.                                                                     |
| `GBX_BUYBACK_INIT_PRICE`         | Initial GBX quote per fixed buyback lot, in GBX raw units.                                                       |
| `GBX_BUYBACK_MIN_INIT_PRICE`     | Lower clamp for the next buyback initial quote.                                                                  |
| `GBX_AUCTION_EPOCH_PERIOD`       | Shared auction duration, 1 hour through 365 days.                                                                |
| `GBX_AUCTION_PRICE_MULTIPLIER`   | Shared WAD multiplier, 1.1e18 through 3e18.                                                                      |
| `GBX_INITIAL_SQRT_PRICE_X96`     | Reviewed initial v4 square-root price.                                                                           |
| `GBX_V4_LIQUIDITY_DEADLINE`      | Reviewed absolute Unix timestamp, strictly after execution, passed unchanged to the position mint.               |
| `GBX_V4_POOL_FEE`                | Exact static pool fee, from zero through the inclusive v4 maximum `1_000_000`.                                   |
| `GBX_V4_TICK_SPACING`            | Positive exact tick spacing, at most the inclusive v4 maximum `32_767`.                                          |
| `GBX_V4_TICK_LOWER`              | Aligned lower tick for the fully one-sided range.                                                                |
| `GBX_V4_TICK_UPPER`              | Aligned upper tick for the fully one-sided range.                                                                |

Constructor-level bounds additionally require nonzero lots, `initPrice >= minInitPrice`,
`minInitPrice >= 1e6`, and initial/minimum prices no greater than `uint192.max`.

The liquidity deadline must be chosen with enough margin for simulation, transaction sequencing, and mining delay.
The script rejects a deadline at or before its execution timestamp; it never derives a fresh deadline from
`block.timestamp`. Re-review and replace an expired value before a new rehearsal or authorized broadcast rather than
silently extending it.

## Token review requirement

GBX assumes USDG and every acquisition or registered asset is a standard ERC-20, non-rebasing and
non-fee-on-transfer. For each token, deployment evidence must cover at least:

- exact address, chain ID, runtime code hash, implementation/admin state where applicable, and issuer;
- decimals and ordinary ERC-20 return behavior;
- no transfer fee, elastic supply, reflection, callback, or balance mutation unrelated to transfers;
- freeze, blacklist, pause, seizure, upgrade, and sanctions capabilities;
- treatment of the vault, strategies, rewards, custodian, claims, and intended users; and
- continuous monitoring for issuer or implementation changes.

Exact debit/receipt assertions in the contracts fail closed where equality is required. Other measured deltas are
accounting guards. Neither is a basis for approving exotic token behavior.

## Pool and position review

The reviewed inputs must establish:

- GBX/USDG address ordering;
- `hooks == address(0)`;
- a fee/spacing combination accepted by the selected PositionManager/PoolManager graph;
- tick alignment and bounds;
- a range wholly above the initial tick when GBX is token0, or wholly below it when GBX is token1;
- a nonzero maximal integer liquidity result and principal;
- acceptable price and market consequences of a single-sided position; and
- the expected `nextTokenId()` immediately before script execution.

The expected token ID is read by the script before custodian deployment and checked again during mint and receipt.
Any intervening or unexpected ID change reverts simulation/execution.

## Auction review

Deployment leaves both strategy auction clocks unset. The acquisition and standalone buyback clocks each start once,
at the timestamp their separate typed seven-day registration executes. Verify the initial quote at that activation
timestamp and do not treat deployment time as an auction start.

The fixed lots and quoted token amounts must be reviewed together. The price reaches exactly zero at and after the
configured duration, so a mature auction can release the complete USDG lot for zero target token or GBX. The minimum
initial price affects the next auction only; it is not a positive terminal price for the current one.

Review must model raw token decimals, the multiplier transition, both clamps, budget accumulation, predictable
revenue-notification timing, worst-case zero-price extraction, and operational pause/disable thresholds.

## Safe local workflow

1. Verify the worktree and record the exact commit, lockfile, compiler, Foundry, Node, and pnpm versions.
2. Resolve inputs from reviewed primary evidence and store only non-secret candidate data.
3. Run format, lint, typecheck, compilation, size, Foundry, Hardhat, ABI, subgraph, simulation, and web gates as
   applicable.
4. Run the focused `DeploymentScript.t.sol` rehearsal against deterministic local mocks.
5. Rehearse on pinned forks only when the exact RPC capability and block are recorded.
6. Compare every observed address, immutable, event, balance, allowance, token ID, and owner with the candidate
   manifest.
7. Repeat from a clean state. A skipped or unavailable fork is not a pass.

Do not use mainnet broadcasting merely to test configuration.

## Broadcast is not atomic

`vm.startBroadcast()` records a sequence of contract creations and calls. An external script run can result in
multiple transactions; it is not one atomic EVM transaction. A failure or interruption can therefore leave a partial
graph, consumed token ID, initialized pool, allowances, or deployed contracts.

Before any authorized broadcast, the signed plan must specify transaction ordering, nonce range, expected addresses,
gas policy, failure handling, and receipt reconciliation. If a broadcast starts, never rerun it blindly. First record
every submitted transaction, compare receipts and onchain state with the plan, and determine the exact safe recovery.
Do not overwrite deployment state or assume a reverted later transaction undid earlier successful transactions.

Never print private keys, signer material, or credential-bearing RPC URLs.

## Post-deployment assertions

Before treating a completed run as candidate evidence, verify all of the following from chain state:

### Token and emissions

- `cumulativeMinted == 20_000_000 ether` immediately after setup;
- `cumulativeBurned == gbxResidualBurned` and `totalSupply == gbxPrincipal`;
- the deployer has zero GBX and cleared ERC-20/Permit2 approvals;
- the current controller is the deployed `EmissionController`;
- the controller reports the canonical GBX, mining pool, next epoch zero, and initial scheduled amount; and
- controller and source initializer calls cannot be repeated.

### Position

- PositionManager owns/recognizes the exact token ID and `ownerOf(tokenId) == LiquidityCustodian`;
- the returned PoolKey exactly matches sorted GBX/USDG, fee, spacing, and zero hook;
- recorded liquidity/principal match independent v4 math;
- `gbxPrincipal + gbxResidualBurned == 20_000_000 ether`;
- `positionInCustody() == true`; and
- the custodian has the exact depositor and expected token ID.

### Dependency graph

- every immutable peer equals the manifest;
- `MiningClaims.source`, `StrategyRewards.STRATEGY`, voter dependencies, and guardian targets are initialized once;
- mining is started and epoch zero dates are correct;
- vault and voter begin with consistent zero accounting; and
- no initializer retains an unconsumed path.

### Initial registry state

- asset count is exactly one and asset zero is USDG;
- strategy count is exactly zero;
- acquisition and buyback both report not live;
- acquisition/rewards and buyback getters match the intended graph and economic inputs; and
- no registration operation is assumed or described as already active.

Getter equality is not code attestation. Record runtime code hashes and source/build provenance independently.
For acquisition registration, review `StrategyRewards` as an execution dependency: its live `setWeight` callback is
strict and can block reset/unstake if it reverts. Verify the terminal-disable recovery path that clears voter weight
without calling disabled-strategy rewards code, including with multiple gas-burning hooks. For honest rewards, expect
the disabled strategy's last weight snapshot to remain while already indexed claims stay claimable.

## Strategy activation phase

Activation is separate from deployment and requires new signed review because it grants vault-release authority.

For acquisition, schedule the exact tuple:

```text
(AssetRegistry, acquisitionTarget, AcquisitionStrategy, StrategyRewards, salt)
```

For buyback, separately schedule:

```text
(AssetRegistry, BuybackStrategy, salt)
```

Only the proposer may schedule. Each operation has its own seven-day delay and becomes permissionlessly executable
after maturity. The current timelock has no cancellation or expiry, so an incorrect schedule cannot be withdrawn and
remains executable until consumed. Validate all parameters and candidate runtime code **before** scheduling.

After acquisition execution, verify the target appears once at the expected asset index, its tuple is exact, and the
strategy is live. After buyback execution, verify strategy count increments but GBX is not appended to the asset
basket. Only then can users signal. Revenue received before positive active weight remains idle forever and is not
retroactively assigned.

## Delayed control operations

Every operation is parameter-bound, salted, chain/domain-bound, and delayed seven days:

- emission-controller replacement;
- exact position-NFT transfer;
- acquisition tuple registration;
- standalone strategy registration;
- terminal strategy disablement;
- future team-address update;
- mining-contribution resume;
- signal-increase resume; and
- individual strategy-fill resume.

The first three categories of admitted code/value behavior—controller replacement, NFT recipient, and strategy
registration—are material trust surfaces. Wiring getters and deployed-code checks are not semantic or bytecode
attestation.

## Guardian operations

The guardian may:

- pause new mining contributions;
- pause signal increases;
- pause fills on a currently live strategy; and
- terminally disable a currently live strategy in both registry and voter.

The guardian cannot resume, settle or invalidate an epoch, redirect claims, move vault assets, transfer the NFT,
replace the controller, change the team, pause redemption, block signal reset, or block unstaking after reset.

Operational playbooks must distinguish temporary fill pause from terminal disablement. Disablement moves the
strategy's checkpointed budget to idle backing and cannot be reversed.

## Required repository gates

At minimum, run and record:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm sdk:abi:check
pnpm subgraph:build
pnpm web:test:e2e
forge fmt --check
forge build --sizes
forge test
pnpm contracts:test:hardhat
pnpm simulations:fixtures:check
```

Event or ABI changes additionally require subgraph ABI sync/codegen/build/tests and regenerated SDK ABI evidence.
Economic changes require both Python and TypeScript models. Raw audit output belongs in the ignored audit report
directory; reviewed dispositions belong in `packages/contracts/audit/FINDINGS.md`.

## Manifest minimum

A signed manifest must bind:

- chain ID, pinned block/hash/time, RPC capability class, source commit, dirty-tree status, build tools, and lockfile;
- every deployed and external address, runtime code hash, constructor/initializer input, immutable, and role;
- every token's compatibility/issuer evidence;
- PoolKey, initial price, ticks, token ID, liquidity, principal, residual burn, and allowance cleanup;
- auction lots, initial/minimum prices, duration, multiplier, and zero-price risk acceptance;
- initial inactive strategy state and the exact later registration plans;
- all broadcast transactions, nonces, calldata, receipts, and events;
- the three delayed trust surfaces and monitoring response;
- completed test/audit/legal/licensing gates; and
- authorized signer set, threshold, signatures, and manifest hash.

Unresolved fields must remain explicitly unresolved. Never invent a canonical address, approval, reviewer, code hash,
or signature.
