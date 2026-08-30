# Deployment outline

> This is an unexecuted development outline, not a deployment manifest or release authorization.

Required inputs include the reviewed six-decimal USDG contract; the immutable launch authority; the exact external
governance contract that will own Mine and Resonance; provenance and pinned bytecode evidence for USDG, Uniswap V2 Factory, Pair,
and the recorded Router; independent review of the launcher and hard-coded Mine economics; deterministic transaction
simulation; sufficient gas; and a signed deployment manifest. The governance review must cover the exact provider
release, executor, plugins, voting configuration, permission graph, upgrade model, execution delay, cancellation rules,
and compatibility with two-step ownership acceptance and both ownership receipts.

ADR 0054 replaces the earlier multi-transaction graph bootstrap with one atomic protocol-graph launch. ADR 0055 makes
the Mine and Resonance ownership handoffs explicit post-launch acceptance steps. Deployment of the launcher
infrastructure itself does not create a protocol graph and is not evidence that a launch occurred.

The intended preparation is:

1. Stop unless the exact USDG and external governance integration have been selected and independently reviewed. The
   governance owner passed to `launch` must already contain the reviewed contract code; code presence alone is not
   provenance or security evidence.
2. At a pinned Robinhood Chain mainnet state, verify `chainid == 4663`, the Uniswap V2 Factory at
   `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`, and the recorded V2Router02 at
   `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba`. Reconcile runtime code hashes, Factory/Pair provenance, Pair creation
   code, and Router-to-Factory identity. The Router is informational and must not be invoked by genesis.
3. Deploy and verify the four stateless size-bounded modules: `GBXTokenFundDeployer`, `GBXSignalBribeDeployer`,
   `GBXStrategyResonanceDeployer`, and `GBXRouterMineDeployer`. They must have no owner, mutable configuration, or
   retained authority. Verify each module derives contract-specific CREATE2 salts from its direct caller, precompute the
   launcher's expected outputs, and prove that another public caller receives a different salt namespace and cannot
   consume or shift those canonical addresses. Public calls can create unrelated components, but those outputs are not
   the canonical graph.
4. Deploy `GBXLauncher` with the reviewed USDG, immutable launch authority, and exact four module addresses. Verify the
   constructor's six-decimal USDG check, every immutable, the pinned chain and V2 addresses, the runtime bytecode, and
   `launched == false`. No protocol component exists merely because this infrastructure exists.
5. Fund the exact launch authority with `1e6` raw USDG and approve the launcher for that amount. Record the approval as
   separate preexisting state; if the candidate launch is abandoned, revoke it. Simulate the exact `launch(finalOwner)`
   calldata against the pinned state and verify gas headroom.

One call to `GBXLauncher.launch(finalOwner)` then performs the following in a single transaction:

1. Authenticate the immutable authority, recheck chain ID, USDG decimals, Factory code, the single-use flag, and the
   deployed non-launcher `finalOwner`.
2. Through the four stateless modules, deploy GBX, Fund, SignalGBX, BribeFactory, StrategyFactory, Resonance,
   ResonanceRouter, and Mine. GBX has zero supply and zero lifetime minted when its constructor returns; the launcher is
   Mine's narrow genesis authority.
3. Complete every reciprocal one-time binding and permanently set Mine as GBX minter before any pair or USDG
   interaction. Check the GBX/Mine binding immediately; the final postcondition pass then rechecks GBX/Mine, USDG/Mine,
   Fund/Mine, Mine/Router, Router/Resonance, Resonance/SignalGBX, and factory identities before success can persist.
4. Call the Factory to create a new USDG/GBX Pair, then verify its code, Factory, and token identities. The launcher
   never adopts or skims an existing Pair. If the Pair already exists for this launcher's deterministic GBX, the
   launcher reverts with `PairAlreadyExists`; abandon the unused launcher and deploy a fresh one, whose caller-scoped
   CREATE2 outputs produce a different GBX and Pair. USDG sent to the not-yet-created deterministic Pair leaves the
   Factory lookup zero but later violates `PAIR_USDG_DEPOSIT`; it likewise rejects that candidate rather than being
   cleaned up in place.
5. Consume Mine's genesis authority to mint exactly `1,000 ether` GBX directly to the Pair, transfer exactly `1e6` raw
   USDG from the authority to the Pair, and call the Pair directly to mint all provider LP to `address(0)`. Verify:

   ```text
   total genesis LP supply = 31,622,776,601,683 raw
   provider liquidity      = 31,622,776,600,683 raw
   zero-address LP balance = 31,622,776,601,683 raw
   launcher LP balance     = 0
   ```

   This permanently locks all genesis LP, including the Pair's `1,000` minimum liquidity. A mistaken seed ratio or
   venue has no governance recovery path.

6. While the launcher is still temporary Resonance owner, register exactly two live Strategies in order:

   | Payment token | Initial and next-epoch minimum | Epoch | Multiplier |
   | ------------- | -----------------------------: | ----: | ---------: |
   | GBX           |                `100,000 ether` | 1 day |   `1.2e18` |
   | USDG/GBX LP   |      `50 * pair.totalSupply()` | 1 day |   `1.2e18` |

   The second price is `1,581,138,830,084,150` raw LP at the fixed genesis supply. Strategy deployment starts the first
   epoch immediately. If no purchase occurs before the complete 24-hour decay, first nonempty inventory may be bought
   for zero; the minimum controls the next epoch's start, not a fill-time floor.

7. Forward any canonical USDG already held by the predictable launcher address into Fund as ordinary backing.
   Preexisting USDG at the predictable ResonanceRouter or Resonance address follows the receiving contract's ordinary
   buffer or direct-donation-surplus semantics and does not alter launch-time schedule accounting.
8. Renounce the consumed plain-`Ownable` SignalGBX, StrategyFactory, and BribeFactory ownership shells. Begin
   `Ownable2Step` transfers of both Mine and Resonance to `finalOwner`; do not attempt to impersonate governance's
   required acceptance.
9. Verify all permanent bindings, two Strategy/Bribe/BribeRouter graphs, exact prices, fixed supply, Pair reserves and LP
   lock, zero launcher token balances, `Mine.genesisLiquidityMinted() == true`,
   `Mine.genesisAuthority() == address(0)`, the three zero setup owners, launcher ownership of Mine and Resonance, and
   `Mine.pendingOwner() == Resonance.pendingOwner() == finalOwner`. Emit the canonical address record only after these
   checks pass.

The successful launch is followed by an explicit governance-receipt phase:

1. The exact pending governance contract calls `acceptOwnership()` on Mine and Resonance, either separately or in one
   reviewed governance batch.
2. Verify both `owner()` getters equal governance and both `pendingOwner()` getters are zero. Reconcile the acceptance
   receipts against the signed manifest.
3. Keep every project-controlled public write surface disabled until both acceptances are final. A completed launch with
   missing acceptance leaves administration inert; it is not a completed production handoff.

OpenZeppelin `Ownable2Step` ordinarily lets the current owner replace or cancel a pending transfer before acceptance,
including cancellation through `transferOwnership(address(0))`. The canonical launcher cannot exercise that path after
launch because its only entrypoint is consumed, but acceptance is still a distinct release gate rather than an atomic
launch postcondition.

Post-transaction evidence must also reconcile all runtime bytecode and constructor arguments, Mine's sixteen empty
slots and deployment-time `startTime`, the 2x price reset, 1 USDG floor, 64 GBX-per-second initial global rate,
provisional 69-day halving period, 1 GBX-per-second global tail, elapsed deployment-to-public-exposure delay, and the
Mine/Router call boundary. Mine must emit `RevenueDeposited` only after the nominal Router transfer request and must not
call `route()` during replacement.

The launcher sets its single-use flag before external interaction. If any later step fails, EVM atomicity reverts the
flag, every newly created contract, Pair creation, token movement, ownership change, and event. A failed call consumes
gas but cannot leave a partially constructed canonical graph. A successful call cannot be repeated. Until governance
accepts, the launcher remains formal Mine and Resonance owner but has no post-launch entrypoint capable of exercising
that authority.

Only the genesis LP is locked. LP minted later by independent providers remains transferable, follows the ordinary
Strategy Fund/Bribe split, and is a caller-selectable Fund redemption asset. No continuing contract prices, owns,
rebalances, harvests, swaps, or guarantees liquidity.

Optional manual, frontend, volunteer-keeper, or cron calls to permissionless `ResonanceRouter.route()` are periphery,
not deployment dependencies. No keeper role or bounty is configured, and no automation may be presented as a protocol
liveness guarantee.

## Future revenue-router replacement

A later Router change is a separate governance operation, not part of genesis and not a state migration. Before any
proposal or execution:

1. Deploy and bind the complete replacement ResonanceRouter, Resonance, SignalGBX, factories, Strategies, Bribes, and
   BribeRouters. Do not change Mine yet.
2. Verify exact runtime code and constructor provenance at a pinned block. Confirm the candidate Router uses Mine's
   immutable USDG, its Resonance reciprocally identifies that Router, USDG, and Mine's immutable Fund, and its
   SignalGBX reciprocally identifies that Resonance and Mine's immutable GBX.
3. Preserve old-graph discovery and exit interfaces. Inventory the old Router balance, Resonance schedule and claims,
   Strategy state, Bribe rewards, and account signal positions; none moves automatically.
4. Execute `Mine.setResonanceRouter(newRouter)` through the reviewed Mine owner and reconcile the emitted previous
   Router, new Router, and new Resonance. The new Router must differ from the current one.
5. Verify the Mine pointer changed and that later deposits reach only the new Router. Continue monitoring and routing
   balances already held by the old Router, and continue supporting old reward claims and unsignaling.

The reciprocal getter checks do not authenticate honest bytecode. A malicious graph can mimic them and receive future
revenue, so exact governance authorization, code review, simulation, and a signed cutover record remain mandatory.

The frontend must remain read-only until a signed manifest proves those facts. Mine's constants still require
independent economic review. The external governance integration is unselected, and no signed manifest exists for
this repository state; deployment is therefore blocked.

The create-only pre-ADR-0055 launcher validation passed 16/16 focused launcher tests and 354/354 non-invariant Foundry
tests across 29 suites. That launcher runtime was 22,762 bytes, leaving 1,814 bytes below EIP-170. SDK validation passed
53/53 tests, typecheck, and ABI generation/check. These receipts predate Mine `Ownable2Step`, the Router setter and
validation graph, Resonance `Ownable2Step`, and the two pending-owner handoffs; they are historical rather than current
coverage.

A non-broadcast pre-ADR-0055 create-only launcher fork passed 1/1 at Robinhood block `50,125,267`, hash
`0x98c12175a4f9e303ef8c1e0ed2af91371df5210f1ce1c34217cfce2ad183020b`, timestamp
`2026-08-30T15:44:01Z`, using the real USDG and V2 Factory-created Pair. The isolated `launch` call used `22,853,567`
gas, leaving `9,146,433` gas beneath the separately observed mutable 32,000,000 target ceiling. The complete test used
`41,411,361` gas because it also deployed its modules, launcher, and governance fixture outside the isolated call.
Earlier replays of older pins failed before test execution with public-RPC `metadata is not found`. The fork receipt
does not cover the current ownership or migration design, so an archive-capable provider and a fresh manifest-bound
rehearsal remain release requirements. See `packages/contracts/audit/FORK-VALIDATION.md`.

The earlier pre-create-only ADR-0054 matrix passed 386/386 configured Forge tests, and its final root `pnpm test` passed
9/9 Turbo tasks with Forge 386/386. Its pinned fork used 22,862,200 gas for the isolated launch. Those receipts remain
historical engineering evidence but do not cover the current production launcher bytecode. None of these results is
release authorization.

No script in this repository is authorized to broadcast these steps. This document describes development intent only;
it does not claim that any contract or market is live, launched, audited, verified, or release-ready.
