# Fork-validation record

Original record date: 2026-08-09

Current audit update: 2026-08-31

Authority update: ADR 0034 later removed the in-repository Governor and Timelock. No external governance system has
been selected or fork-validated. ADR 0050 later removed the canonical Uniswap v4 position and every
LiquidityPosition dependency; the historical target-chain observations below remain unchanged but no longer describe
the current graph. ADR 0054 now adds a GBX-specific atomic launcher, fixed Mine-issued genesis GBX, and direct Uniswap
V2 Factory/Pair interactions. Those additions are not covered by the historical v4 reads or the exitability opcode
probes, but the create-only launcher now has the separate pinned non-broadcast fork result below.
ADR 0055 later changes Mine and Resonance ownership, the Mine constructor and Router authority, the launch handoff, and
the runtime graph. The fresh current-artifact fork below supersedes the older launcher artifact only for the exact
launcher and dual-ownership path it executes; the older receipts remain historical.

## Current ADR-0055 launcher fork result

On 2026-08-31, the opt-in Foundry harness
`test/fork/GBXLauncherFork.t.sol::testForkLaunchUsesTheRealUSDGFactoryAndPair` passed 1/1 against explicit Robinhood
Chain mainnet block `50,340,734`, block hash
`0x36700202ad39596aae93f0858f717b840754c25007960373a684da857d23b52e`, timestamp
`2026-08-30T21:47:50Z`. The non-broadcast run used the current ADR-0055 launcher artifact, the real USDG proxy, and the
real Uniswap V2 Factory. The predicted caller-scoped GBX/USDG Pair did not already exist at the fork pin.

Reproducible command form:

```bash
FOUNDRY_PROFILE=launcher_fork forge test \
  --fork-url https://rpc.mainnet.chain.robinhood.com \
  --fork-block-number 50340734 \
  --match-contract GBXLauncherForkTest -vv
```

The fork verified the complete graph launch, reciprocal GBX/Mine and Fund bindings, exact seed reserves and permanently
locked LP supply, two initial Strategies, renounced setup-shell owners, Mine and Resonance pending ownership by the
code-bearing governance fixture, and separate successful acceptance of both ownership transfers. The isolated
`GBXLauncher.launch` call used `23,437,200` gas, leaving `8,562,800` below the separately observed mutable 32,000,000
target transaction limit. The complete fork test used `42,754,991` gas because its test-only execution also deployed
the four modules, launcher, and governance fixture; that whole-test figure is not a production-transaction requirement.

This is engineering evidence, not a deployment receipt, governance review, independent audit, or release authorization.
The harness uses a code-bearing governance stand-in rather than a selected production executor. It does not execute a
later Mine Router replacement or old/new graph cutover on the dependency fork; focused local artifact tests cover those
paths. The official public RPC rejected replay of the older block `50,125,267` with `metadata is not found`, so this
fresh pin is reproducible only while the endpoint retains the required state unless an archive-capable provider is used.

## Historical pre-ADR-0055 create-only launcher fork result

On 2026-08-30, the opt-in Foundry harness
`test/fork/GBXLauncherFork.t.sol::testForkLaunchUsesTheRealUSDGFactoryAndPair` passed 1/1 against explicit Robinhood
Chain mainnet block `50,125,267`, block hash
`0x98c12175a4f9e303ef8c1e0ed2af91371df5210f1ce1c34217cfce2ad183020b`, timestamp
`2026-08-30T15:44:01Z`. The non-broadcast run used the then-current launcher whose successful path calls the real Factory's
`createPair` for the caller-scoped GBX and real USDG; the predicted Pair did not already exist at that fork state.

Reproducible command form:

```bash
FOUNDRY_PROFILE=launcher_fork forge test \
  --fork-url https://rpc.mainnet.chain.robinhood.com \
  --fork-block-number 50125267 \
  --match-contract GBXLauncherForkTest -vv
```

The fork passed 1/1. The isolated `GBXLauncher.launch` call used `22,853,567` gas, leaving `9,146,433` below the
separately observed mutable 32,000,000 target transaction limit. The complete fork test used `41,411,361` gas because
its test-only execution also deployed the four modules, launcher, and governance fixture; that whole-test figure is not
a production-transaction requirement. This is historical engineering evidence, not a deployment receipt or release
authorization. It does not cover ADR 0055. It does not test a precreated Pair on the live dependency fork; the focused local suite covers the
atomic failure and fresh-launcher recovery branch.

## Historical Pair-adoption/skim launcher fork result

On 2026-08-30, the opt-in Foundry harness
`test/fork/GBXLauncherFork.t.sol::testForkLaunchUsesTheRealUSDGFactoryAndPair` passed 1/1 against explicit Robinhood
Chain mainnet block `50,125,267`, block hash
`0x98c12175a4f9e303ef8c1e0ed2af91371df5210f1ce1c34217cfce2ad183020b`, timestamp
`2026-08-30T15:44:01Z`. That non-broadcast command used the preceding post-prefunding source artifacts, the real USDG
contract, the real Uniswap V2 Factory, and the Factory-created counterfactual USDG/GBX Pair in ephemeral fork state.

The test verified chain ID `4663`, six-decimal USDG, caller-scoped CREATE2 prediction for GBX, absence of a preexisting
Pair for that predicted token, complete graph launch, reciprocal GBX/Mine and Fund bindings, exact `1e6` USDG plus
`1,000 ether` GBX reserves, total LP supply `31,622,776,601,683`, the complete LP supply at `address(0)`, exactly two
live Strategies, removed setup owners, and Resonance handoff to a code-bearing test governance contract. The measured
`GBXLauncher.launch` call used `22,862,200` gas, leaving `9,137,800` gas below the separately observed mutable
32,000,000 target transaction limit. The complete fork test used `41,603,390` gas because its test-only execution also
deployed the four modules, launcher, and governance fixture before measuring `launch` separately; that whole-test figure
is not a production-transaction requirement. That `22,862,200` measurement superseded an even earlier
pre-prefunding `22,860,635` measurement, but both are now historical because the launcher production bytecode changed
to remove existing-Pair adoption and skim.

Foundry supplied the exact genesis USDG balance with a test cheatcode, the final owner was only a code-bearing stand-in,
no signed manifest fixed the future production addresses or governance integration, and one passing pinned state does
not guarantee that a later target block retains the same code, Pair state, or gas configuration.

## Current read-only target evidence

The 2026-08-30 exitability review refreshed non-broadcast Robinhood Chain mainnet and testnet observations. At explicit
block/hash pins it executed creation code using `PUSH0`, `TSTORE`/`TLOAD`, and `MCOPY`; read ArbOS version 116; and read
32,000,000 as both the maximum transaction and block gas limit. Separate pinned `NUMBER` probes confirmed that Solidity
`block.number` is Nitro's parent-chain counter while `ArbSys.arbBlockNumber()` exposes the faster L2 header number.

Those observations, their distinct block pins, official Nitro/geth source links, and a later failed replay against
pruned/rate-limited public RPC state are recorded in
`codex-exitability-2026-08-29-f991253/TEST-EVIDENCE.md` E-10 and its `commands.log`. They establish live opcode support at
the recorded blocks. They do not instantiate or bind the exact current Fund artifact, constructor arguments,
immutables, reciprocal graph, launcher modules, V2 Pair, fixed seed, governance handoff, or a future target state.

The same-date launcher refresh also read the following dependency state at block `50,125,267`:

| Dependency | Address                                      | Runtime bytes | Runtime code hash                                                    |
| ---------- | -------------------------------------------- | ------------: | -------------------------------------------------------------------- |
| V2 Factory | `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` |        13,859 | `0xbab145d02e7005f0d84c6c1639d39b799b0ea16df99ebbdaf5a14d9da820b4e0` |
| V2 Router  | `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` |        21,902 | `0xbd55ea26b2f8d42a8ff151511cef92a326a9817686899fe96a8a8f81ee7fc55e` |
| USDG proxy | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |           170 | `0x864cc9ad53b338b82da1f7cab85ab0b3d5c8861acb422b6fec63cf36234f36a6` |

USDG returned `decimals() == 6` and `symbol() == "USDG"` at that pin. A proxy runtime hash is not implementation
provenance; the implementation, proxy administration, supported-token behavior, and legal/canonical selection still
need manifest-backed review.

As a supplemental compatibility check, latest-state Arbitrum One (`chainid 42161`) returned the same raw ArbOS version
`116`, the same 32,000,000 maximum transaction/block gas values, and successfully executed the same `PUSH0`,
`TSTORE`/`TLOAD`, and `MCOPY` creation-code probes. That supports the shared Nitro execution model but is not GBX launch
evidence: the production launcher requires chain ID `4663` and Robinhood-specific USDG/Factory/Pair state.

## Remaining ADR-0055 release gaps

The current pinned test closes the narrow executable launcher/Factory/createPair and dual-acceptance path for one
recorded state. It does not select or review the external governance executor, prove its SignalGBX voting-token binding,
provide production funding or signer authority, exercise Mine Router replacement, or validate an old/new graph
cutover. Source-pinned addresses plus code presence do not by themselves
establish USDG proxy implementation provenance or canonical Factory/Pair semantics. The precreated-Pair failure and
fresh-launcher retry branch, predictable launcher/ResonanceRouter/Resonance USDG prefunding, callback mutation rejection,
unrelated-module caller isolation, rollback, and later Fund-held LP redemption are covered by local artifact tests
rather than the one real-dependency fork case. A production rehearsal must bind all of those results to one signed
manifest and a freshly rechecked target pin.

## What was validated

The prior hardening pass performed non-mutating JSON-RPC reads against Robinhood Chain ID 4663 at block `32,035,314`,
block hash `0xe13569d3a71001227e35d660dfbcfed1e7660d10b74c0c639e4bc0eab1555aea`. It recorded code hashes for the
documented PoolManager, PositionManager, and Permit2 addresses and successfully executed `TSTORE`/`TLOAD` in an
`eth_call`. The deleted historical `UNISWAP-V4-REVIEW.md` record remains recoverable from Git at commit
`3ae171b997254b56602298d873b3918d1575b3c7`; it is not current-core evidence.

That evidence establishes Cancun/EIP-1153 availability and observed dependency code at one historical block. It does
not instantiate this undeployed protocol, verify a deployment manifest, prove current code at a later block, or test
the canonical pool/NFT because no canonical GBX deployment exists.

## Historical replay limitation and incomplete production inputs

- Earlier attempts to replay the launcher at blocks `50,114,588` and `50,114,000` failed before test execution because
  the public RPC returned `metadata is not found` for requested historical state. The fresh block `50,125,267` was
  available and passed; the failure remains evidence that this public endpoint is not a durable archive provider.
- The repository has no signed deployment manifest for the current direct-core graph and its required external
  governance ownership integration.
- The checked deployment schema and release/fork utilities are explicitly archived legacy evidence for a different
  14-contract graph and cannot safely construct current protocol state.
- No production deployment addresses, constructor arguments, one-time bindings, external-governance configuration,
  signer, funding source, or ownership snapshot are authorized.
- No credential-bearing RPC URL was requested, recorded, or printed during this review.

## Reproducible requirement

Before release, bind the current non-broadcast deployment/fork harness to a signed manifest, record an archive-capable
RPC provider without exposing credentials, and pin chain ID, block number/hash, USDG/Factory/Pair/Router code
hashes, launcher/module bytecode, constructor inputs, expected CREATE addresses, one-time bindings, authority allowance,
the exact external-governance release and bytecode, proxy/upgrade and permission graph,
voting/execution/delay/cancellation policy, Mine and Resonance pending-owner state, and both ownership-acceptance
receipts. Simulate successful Factory creation and
an adversarially precreated Pair; prove the latter reverts atomically and that a newly reviewed fresh launcher derives
a different caller-scoped GBX/Pair. Prove exact seed balances/reserves, LP supply and zero-address lock, both initial
Strategy configurations, complete failure rollback, setup-owner removal, and launch gas sufficiency. Then rerun Fund
EIP-1153 redemption, including later Fund-held LP, and the complete current campaign against that exact state. The Pair
operation belongs to the deployment harness only and does not make liquidity a continuing core dependency.

The same manifest-bound campaign must deploy a complete replacement graph, prove the Mine setter rejects every crossed
GBX/USDG/Fund/Router/Resonance/SignalGBX identity and the unchanged current Router, execute one valid cutover, and prove
that old Router balances, old Resonance schedules/claims, Bribe rewards, and signal exits remain graph-local and usable.

Status: **current ADR-0055 launcher and dual-ownership fork passed at one fresh explicit pin; production release remains
blocked**. Release blocker: **yes**, pending the signed manifest, exact external-governance review and handoff evidence,
fresh dependency/proxy provenance, authorized signer/funding plan, and complete release campaign.
