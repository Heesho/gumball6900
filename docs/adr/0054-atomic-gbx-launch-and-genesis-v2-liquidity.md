# ADR 0054: Atomic GBX launch and permanently locked genesis V2 liquidity

- Status: accepted for development; ADR 0055 supersedes its ownerless-Mine and one-step Resonance handoff details with
  Mine/Resonance two-step pending-owner handoffs; not independently audited, deployed, or approved for user funds
- Date: 2026-08-30
- Supersedes: [ADR 0050](0050-zero-premint-and-external-lp-strategy.md) only where it requires the completed GBX graph
  to have zero supply, forbids a fixed genesis issuance, or leaves the initial LP venue, pair creation, seed, and
  launch process entirely external and unpinned
- Preserves: ADR 0050's removal of `LiquidityPosition` and Uniswap v4-specific core machinery; fungible LP treatment
  under ordinary Strategy settlement and Fund redemption; Mine's sole lifetime mint authority after binding; and the
  absence of continuing liquidity management, rebalancing, fee harvesting, swapping, or liquidity guarantees

## Context

ADR 0050 simplified the protocol by deleting the dedicated Uniswap v4 position and its 20 million GBX construction
allocation. It made an externally created fungible USDG/GBX V2 LP token an ordinary possible Strategy payment asset,
but deliberately left pair creation, initial reserves, LP custody, and launch sequencing outside the protocol.

The canonical GBX deployment now needs one reproducible transaction that cannot expose a partly bound graph. It also
needs a real USDG/GBX market before registering the LP token as an initial Strategy. Because GBX is not deployed before
that transaction, an external LP supplier cannot seed the canonical pair with GBX first. A discretionary setup minter
would solve that ordering problem but would reintroduce avoidable issuance authority.

The selected design therefore adds one fixed Mine-issued genesis amount and a GBX-specific launch orchestrator. This
is not a generic fund-launch factory. Future permissionless funds, creator economics, protocol fees, and alternative
market configurations require a separate decision.

## Decision

### Fixed Mine-issued genesis GBX

GBX still has zero supply and zero lifetime minted when its constructor returns. The temporary GBX setup authority
still cannot mint and may only bind GBX permanently to one Mine. Mine remains the only contract that ever calls
`GBX.mint` after that binding.

Mine adds exactly one deployment-only issuance path:

```text
GENESIS_LIQUIDITY_GBX = 1,000 ether
```

The Mine constructor receives a `genesisAuthority`. A zero value permanently disables this path for direct,
non-launch deployments. Otherwise only that authority may call `mintGenesisLiquidity`, only after
`GBX.minterLocked() == true` and `GBX.minter() == Mine`, and only once. The recipient must contain code. The amount is
fixed in Mine; the authority cannot choose it, redirect later issuance, alter mining, or reopen the path. Mine marks
the issuance consumed and clears `genesisAuthority` before calling GBX, with ordinary transaction rollback if the
mint fails.

The canonical launcher is the genesis authority and calls this path only for the validated USDG/GBX pair. After a
successful launch:

```text
GBX.totalSupply()      = 1,000 ether
GBX.lifetimeMinted()  = 1,000 ether
GBX.lifetimeBurned()  = 0
Mine.totalMined()     = 0
```

The existing GBX identity remains:

```text
GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()
```

Mine emission reconciliation now distinguishes settled mining from fixed genesis issuance:

```text
GBX.lifetimeMinted()
    == Mine.totalMined()
     + (Mine.genesisLiquidityMinted() ? Mine.GENESIS_LIQUIDITY_GBX() : 0)
```

### GBX-specific one-shot launcher

`GBXLauncher` is a single-use deployment orchestrator under `packages/contracts/src/launch`, not a continuing core
administrator. Its constructor fixes one nonzero `launchAuthority`, one reviewed six-decimal USDG contract, and four
predeployed component-deployer modules. Only the immutable authority may call `launch`, and a successful call cannot be
repeated.

The component deployers group the graph by constructor dependencies and keep deployer runtimes below EIP-170:

1. `GBXTokenFundDeployer` deploys GBX and Fund.
2. `GBXSignalBribeDeployer` deploys SignalGBX and BribeFactory.
3. `GBXStrategyResonanceDeployer` deploys StrategyFactory and Resonance.
4. `GBXRouterMineDeployer` deploys ResonanceRouter and Mine.

Each module is stateless, has no owner, and retains no authority over what it deploys. Every module derives each
CREATE2 salt as `keccak256(abi.encode(msg.sender, contractDomain))`; constructor arguments remain part of the ordinary
CREATE2 initcode hash. The modules are callable by other accounts, but another caller has a separate salt namespace and
cannot consume or shift the launcher's deterministic outputs. Their unrelated outputs are not part of the canonical
GBX graph. They are size-bounded deployment infrastructure, not generic protocol factories.

The launcher performs, in order, every deployment, reciprocal binding, genesis mint, USDG transfer, direct pair mint,
initial Strategy registration, launcher-held USDG forwarding into Fund, setup-owner removal, governance handoff, and
final invariant check. It sets its single-use flag before external interaction; if any later operation fails, EVM
transaction atomicity rolls back that flag, every newly created contract, pair creation, token movement, ownership
change, and event.

The caller supplies a `finalOwner` that must already be a deployed contract and cannot be the launcher. The launcher
transfers Resonance directly to that address. Code presence is only a structural check: deployment remains blocked
until the exact external governance implementation, parameters, permissions, and ownership receipt are independently
reviewed.

### Canonical Robinhood V2 seed

The GBX launcher is pinned to Robinhood Chain mainnet chain ID `4663` and the reviewed Uniswap V2 Factory:

```text
Factory: 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f
Router:  0x89e5DB8B5aA49aA85AC63f691524311AEB649eba
```

The Router address is recorded for clients but is not involved in genesis. The launcher calls the Factory and Pair
directly, avoiding Router allowance, deadline, and token-order branches. Source-level address checks do not replace
deployment-time bytecode and provenance verification.

The fixed deposit is:

```text
1 USDG   = 1,000,000 raw units at 6 decimals
1,000 GBX = 1,000 ether raw units at 18 decimals
```

For the canonical V2 square-root mint and `MINIMUM_LIQUIDITY == 1,000`, the expected raw values are:

```text
total LP supply      = floor(sqrt(1e6 * 1,000e18)) = 31,622,776,601,683
provider liquidity   = total LP supply - 1,000     = 31,622,776,600,683
```

The Pair first mints its standard minimum liquidity and then mints the provider liquidity directly to `address(0)`.
Consequently the zero address holds the complete `31,622,776,601,683` raw genesis LP supply, the launcher holds none,
and no LP holder can burn genesis LP to withdraw the reserves proportionally. Swaps can still change and withdraw one
side of the reserves. The LP lock is permanent; a mistaken seed ratio or venue cannot be recovered by governance.

The launcher always calls `Factory.createPair` for the actual deployed GBX address. It does not adopt or skim an
existing Pair. If the Factory already has a Pair for that GBX and USDG, creation reverts the complete transaction and
the launcher reverts with `PairAlreadyExists`; its single-use flag and graph deployments roll back. The operator may abandon the unused launcher and
deploy a fresh reviewed launcher. Because every component deployer scopes CREATE2 salts to its direct caller, that
fresh launcher produces a different GBX address and therefore a different Pair address. Pair prefunding that prevents
the exact deposit-balance or LP-output checks likewise rejects that candidate rather than being cleaned up in place.
Specifically, USDG sent to the not-yet-created deterministic Pair leaves the Factory lookup zero and later reverts at
`PAIR_USDG_DEPOSIT` after creation; it is distinct from the `PairAlreadyExists` branch.

The launcher and caller-scoped CREATE2 outputs are predictable once the deployment infrastructure exists. A direct
USDG transfer to one of those addresses therefore cannot be treated as proof of launch-time mutation. Any USDG already
held by the launcher is forwarded into the newly deployed Fund as ordinary backing. USDG already held at the future
ResonanceRouter remains its ordinary unscheduled buffer, and USDG already held at Resonance remains direct-donation
surplus; neither changes a schedule or liability merely by existing. Accounting state must still be pristine, and the
Pair remains subject to its separate create-only and exact-seed rules above.

### Two initial Strategies

While the launcher remains Resonance's temporary owner, it registers exactly two live Strategies in this order:

| Strategy payment token |                                              Initial price | Next-epoch minimum | Epoch duration | Price multiplier |
| ---------------------- | ---------------------------------------------------------: | -----------------: | -------------: | ---------------: |
| GBX                    |                                            `100,000 ether` |    `100,000 ether` |       24 hours |         `1.2e18` |
| USDG/GBX LP            | `50 * pair.totalSupply()` = `1,581,138,830,084,150` raw LP |               same |       24 hours |         `1.2e18` |

At the seed ratio, one GBX is represented by `0.001 USDG`, so `100,000 GBX` is the agreed $100 launch reference. The
genesis pool represents approximately $2 of total reserves, so fifty complete LP supplies represent the same $100
reference. These are raw auction-payment quantities, not oracles or continuing price pegs.

`minimumPrice` controls the next epoch's starting price; it is not a fill-time floor. Each first Strategy epoch begins
when its contract is deployed and decays to zero after 24 hours even if that Strategy has no USDG inventory. Therefore,
if first revenue is not bought before full decay, the first nonempty fill can be free. A free fill restarts the next
epoch at the configured minimum. This timing behavior is accepted for the selected Liquid Signal-shaped parameters and
must be visible in launch operations and user interfaces.

### Final authority and LP treatment

Before returning, the launcher renounces the inherited setup ownership of SignalGBX, StrategyFactory, and
BribeFactory. It transfers Resonance to the reviewed `finalOwner`. Fund and Mine remain ownerless, GBX's Mine binding
is permanent, Mine's genesis authority is zero, and the launcher has no post-launch protocol role.

Only the genesis LP supply is permanently locked. LP tokens minted later by independent liquidity providers remain
ordinary fungible assets. When an LP Strategy purchase sends its Fund share to Fund, a GBX redeemer may include that LP
token in the caller-selected redemption basket and receive the ordinary pro-rata payout. The paired Bribe share remains
subject to ordinary Bribe accounting. No later LP is automatically burned or locked by this decision.

## Consequences

- The completed canonical graph begins with 1,000 GBX rather than zero, but GBX itself still constructs at zero and
  never grants discretionary premint authority.
- One Mine method and one fixed supply component are added to the audit and invariant surface. `Mine.totalMined`
  continues to mean settled slot emission and does not include the genesis amount.
- The launch transaction needs exactly `1e6` raw USDG from the immutable authority and sufficient allowance. A prior
  approval is separate state and is not undone if a later launch transaction reverts; operators should use an exact
  approval and revoke it if the reviewed launch is abandoned.
- All launch-created state and token movement are atomic. Failure consumes gas but cannot leave a partially deployed
  or partially owned canonical graph from that transaction.
- Permanently locked genesis LP prevents withdrawal of the initial reserves but does not guarantee useful depth,
  stable pricing, trading availability, USDG value, or protection from market movement.
- Pair precreation and predicted-Pair prefunding do not silently change the seed. The launcher never adopts or skims a
  Pair; a collision or exact-seed mismatch rejects that candidate and requires a fresh launcher with a different
  deterministic GBX and Pair.
- Predictable-address USDG prefunding cannot veto an otherwise valid launch merely by making a component balance
  nonzero. Launcher-held USDG becomes Fund backing; Router and Resonance balances retain their documented donation
  semantics while schedule and liability state must remain pristine.
- The hard-coded chain and Factory intentionally make this launcher unsuitable for another chain or venue. A different
  market requires a separately reviewed launcher and ADR rather than a runtime governance setting.
- Direct V2 minting makes the recorded Router non-critical to launch correctness. Later swaps and liquidity additions
  are external market actions outside this decision.
- The first-epoch 24-hour decay can make delayed initial Strategy inventory purchasable for zero payment. The minimum
  price only resets the following epoch's start.
- The launcher and module implementation is development work only. Passing local tests does not establish Factory,
  USDG, governance, deployment, market, audit, legal, or user-fund authorization.

## Deployment and review boundary

Production remains blocked on an independently reviewed governance integration; exact USDG, Factory, Pair, and Router
provenance; code hashes at a pinned Robinhood Chain block; launcher and Mine audit coverage; deterministic transaction
simulation; gas sufficiency; final ownership receipt; and a signed deployment manifest. CI must not broadcast this
flow. Nothing in this ADR claims that the graph or market is live, launched, audited, verified, or release-ready.
