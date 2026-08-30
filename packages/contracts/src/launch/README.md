# GBX atomic launch infrastructure

This directory contains the development-only, GBX-specific deployment path. It is not a generic fund factory, is not
authorized to broadcast, and is not evidence that GumBall6900 is audited, deployed, or ready for user funds. The
design decision and accepted consequences are recorded in
[ADR 0054](../../../../docs/adr/0054-atomic-gbx-launch-and-genesis-v2-liquidity.md).

## Components

`GBXLauncher` is the only user-facing orchestrator. Four predeployed modules split contract creation into EIP-170-sized
groups:

| Module                         | Deploys                       | Retained module authority |
| ------------------------------ | ----------------------------- | ------------------------- |
| `GBXTokenFundDeployer`         | GBX and Fund                  | None                      |
| `GBXSignalBribeDeployer`       | SignalGBX and BribeFactory    | None                      |
| `GBXStrategyResonanceDeployer` | StrategyFactory and Resonance | None                      |
| `GBXRouterMineDeployer`        | ResonanceRouter and Mine      | None                      |

The modules store no state and are intentionally callable. Every output uses a caller-scoped CREATE2 salt derived as
`keccak256(abi.encode(msg.sender, contractDomain))`, with the constructor arguments remaining in the initcode hash.
Another public caller therefore cannot consume or shift the launcher's deterministic outputs. Their direct caller
receives only the temporary setup roles created by the underlying constructors. Outputs created by another caller are
unrelated deployments, not canonical GBX instances. `GBXLauncher` consumes and removes every temporary authority in
its successful transaction.

## Fixed launch configuration

The launcher enforces the following configuration in source:

| Item                      | Value                                                      |
| ------------------------- | ---------------------------------------------------------- |
| Chain                     | Robinhood Chain mainnet, chain ID `4663`                   |
| Uniswap V2 Factory        | `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`               |
| Informational V2Router02  | `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba`               |
| USDG seed                 | `1e6` raw units, exactly 1 USDG at the required 6 decimals |
| Mine-issued GBX seed      | `1,000 ether` raw units                                    |
| Expected total genesis LP | `31,622,776,601,683` raw units                             |
| Expected provider LP      | `31,622,776,600,683` raw units                             |
| Genesis LP recipient      | `address(0)`; complete genesis supply permanently locked   |
| Initial Strategies        | GBX and the actual seeded USDG/GBX Pair                    |
| Strategy duration         | 24 hours                                                   |
| Strategy multiplier       | `1.2e18`                                                   |
| GBX initial/minimum       | `100,000 ether` raw GBX                                    |
| LP initial/minimum        | `50 * pair.totalSupply()` = `1,581,138,830,084,150` raw LP |

The USDG address is an immutable reviewed constructor input rather than a source constant. Its contract code and six
decimals are checked when the launcher is deployed, and decimals are checked again during launch. The source pins the
Factory address but does not prove Factory, Pair, Router, USDG, or governance provenance. A deployment manifest must
verify exact code hashes and configuration at a pinned block.

The V2 Router is not called. Genesis uses `Factory.createPair`, transfers the exact token amounts directly to the Pair,
and calls `Pair.mint(address(0))`.

## Preconditions

Before a reviewed launch transaction can be constructed, all of these must hold:

- `GBXLauncher` was configured with the exact reviewed USDG, immutable launch authority, and four reviewed module
  deployments.
- The active chain ID is `4663`, the official Factory address contains the expected reviewed bytecode, and USDG still
  reports six decimals.
- The immutable launch authority holds at least `1e6` raw USDG and has approved the launcher to transfer that exact
  amount. Prefer an exact allowance rather than an unlimited approval.
- `finalOwner` is the exact reviewed external governance executor, already contains code, and is not the launcher.
- The governance integration, launch calldata, expected caller-scoped CREATE2 addresses, pair state, gas limit, and postconditions
  have been simulated against the pinned target state.
- The independent audit, manifest, signer, legal, and user-fund gates outside this package are complete. Code checks
  alone do not satisfy them.

## Atomic sequence

`launch(finalOwner)` is callable only by the immutable `launchAuthority` and can succeed only once. It performs:

1. Recheck caller, chain, USDG decimals, Factory code, and final-owner code.
2. Deploy the eight-contract base graph at the launcher's caller-scoped CREATE2 outputs through the four stateless modules.
3. Bind both factories and SignalGBX to Resonance, bind ResonanceRouter reciprocally, and permanently bind GBX to Mine.
4. Create a new GBX/USDG Pair and require the reviewed identity and exact seed state.
5. Direct Mine's fixed one-time 1,000 GBX issue to the Pair and transfer exactly 1 USDG from the launch authority.
6. Mint the complete expected genesis LP supply to the zero address and validate balances, reserves, and supply.
7. Register the GBX Strategy followed by the seeded LP Strategy with the fixed parameters above.
8. Forward any canonical USDG already held by the launcher into Fund as ordinary backing.
9. Renounce SignalGBX, BribeFactory, and StrategyFactory setup ownership; begin two-step Mine and Resonance ownership
   transfers to `finalOwner`.
10. Validate reciprocal identities, issuance, Pair custody, Strategy configuration, removed setup owners, and pending
    governance ownership before returning the deployment record and emitting `Launched`. The record is assembled during
    execution so callbacks can be checked, but transaction rollback prevents any partial record from persisting after
    failure.

Any failure reverts every action in this transaction, including CREATE2 operations, Pair creation, token movements,
ownership changes, and the launcher's single-use flag. A USDG approval made in an earlier transaction is not part of
that rollback; revoke it if the reviewed launch is abandoned.

## Pair creation and predictable-address prefunding

The launcher always calls `Factory.createPair` for its newly deployed GBX and USDG. It never adopts or skims an existing
Pair. After creation it verifies the Factory lookup, Pair code, Pair-reported Factory, token identities, exact deposits,
reserves, and LP output.

If the Factory already contains a Pair for that GBX and USDG, the launcher reverts with `PairAlreadyExists`. The launcher's
single-use flag and graph deployments roll back, so the operator may abandon that unused launcher and deploy a fresh
reviewed one. Because each module's CREATE2 salts are scoped to its direct caller, a fresh launcher produces a different
GBX and therefore a different Pair. USDG sent to the not-yet-created deterministic Pair leaves the Factory lookup zero
and instead fails `PAIR_USDG_DEPOSIT` after creation. That candidate is rejected rather than being skimmed or adopted.

The launcher and its caller-scoped CREATE2 outputs are predictable. A plain USDG transfer to one of those addresses is
not permitted to become a one-unit launch veto. Launcher-held USDG is forwarded to Fund during launch. USDG already at
the future ResonanceRouter remains its ordinary unscheduled buffer, while USDG already at Resonance remains
direct-donation surplus. Neither balance changes launch-time schedule accounting. This does not relax the Pair checks:
the newly created Pair must still satisfy the exact seed balances and LP output above.

## Required postconditions

The stored `Deployment` and `Launched` event are discovery aids. Independently read the contracts and verify at least:

- GBX is permanently bound to Mine; supply and lifetime minted are exactly `1,000 ether`; lifetime burned and
  `Mine.totalMined()` are zero at launch completion.
- Mine reports the genesis mint consumed and `genesisAuthority == address(0)`.
- Mine, ResonanceRouter, and Resonance agree on GBX, USDG, Router, and Resonance identities.
- SignalGBX, BribeFactory, and StrategyFactory are bound to Resonance and each has `owner() == address(0)`.
- Resonance has exactly two live initial Strategies. Mine and Resonance each have the launcher as current owner and
  `pendingOwner() == finalOwner`; governance must accept both ownership transfers after launch.
- The Pair has exact `1e6` USDG and `1,000 ether` GBX balances/reserves in the correct token order.
- Pair total supply is `31,622,776,601,683`, all of it is held by `address(0)`, and the launcher holds no LP.
- Both Strategies have the exact payment token, starting/minimum price, 24-hour duration, and `1.2e18` multiplier.

Never describe a successful local simulation or test as an onchain launch or ownership receipt.

## Economic and liveness notes

- Permanently locking the genesis LP makes its initial reserves irretrievable. It does not guarantee a stable price,
  useful market depth, functioning external infrastructure, or USDG value.
- Each first Strategy epoch begins during launch and reaches a zero fill price after 24 hours. `minimumPrice` is only
  the next epoch's starting floor. If first inventory is not bought before full decay, the first nonempty fill can be
  free; that fill resets the following epoch to the configured minimum.
- Only genesis LP is locked. LP acquired later by Fund through the ordinary LP Strategy remains a normal ERC-20 Fund
  asset and is redeemable when a GBX holder includes it in the caller-selected redemption basket.
- The LP Strategy's Bribe share remains in its ordinary Bribe path. The launcher adds no LP-specific redemption,
  custody, fee routing, harvest, rebalance, swap, pause, rescue, or management method.
- `Mine.totalMined()` counts settled slot emission only. Lifetime issuance is reconciled as settled mining plus the
  fixed genesis amount once `genesisLiquidityMinted` is true.
- A direct, non-launch Mine deployment may pass a zero genesis authority, which permanently disables the fixed mint.
  The canonical launcher module instead assigns the launcher and consumes that authority in the same transaction.

## Validation boundary

Changes in this package require Forge formatting, size checks, focused and full Foundry tests, Hardhat tests against
the shared source tree, generated ABI synchronization, subgraph ABI synchronization for relevant events, and the
applicable repository gates. Tests must cover atomic rollback, authority and chain checks, exact LP math and token
ordering, Pair-exists rollback followed by a fresh-launcher success, final ownership, single use, both initial
Strategies, and later Fund-held LP redemption. It must also cover USDG prefunding of the launcher and predicted
Router/Resonance addresses without weakening schedule-state checks.

CI must never broadcast. No command, manifest, signer action, live verification, ownership transfer, or funding is
authorized by this README.
