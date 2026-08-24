# Deployment outline

> This is an unexecuted development outline, not a deployment manifest or release authorization.

Required inputs include reviewed USDG, the externally created fungible Uniswap v2-style USDG/GBX LP ERC-20 address and
Strategy configuration, all other
initial Strategies, independent review of the hard-coded Mine economics, provenance clearance, independent security evidence,
and a later ADR selecting the exact external governance provider, release, executor, plugins, voting configuration,
permission graph, upgrade model, execution delay, cancellation rules, and ownership-handoff evidence.

The intended order is:

1. Deploy zero-premint GBX with a temporary deployment coordinator as minter. The coordinator cannot mint and exists
   only to complete the one-time Mine handoff. Verify total supply and lifetime minted are both zero.
2. Deploy Fund, SignalGBX, BribeFactory, and StrategyFactory.
3. Deploy Resonance with a temporary setup owner, bind Resonance once in SignalGBX and both factories, deploy
   ResonanceRouter,
   and complete Resonance's one-time router binding. Each call verifies the candidate points back to the exact
   SignalGBX, factory, Resonance, and USDG identities before storing the irreversible binding. SignalGBX cannot accept
   signals before this step completes.
4. Deploy the ownerless Mine with GBX, USDG, and ResonanceRouter. At one pinned post-deployment state, verify
   `Mine.gbx() == GBX`, `Mine.usdg() == USDG`, `Mine.resonanceRouter() == ResonanceRouter`, and
   `ResonanceRouter.usdg() == USDG`; Mine deliberately does not enforce the final equality in its constructor. Abandon
   and redeploy the candidate before any permanent binding or exposure if one equality fails. Record and verify that
   `startTime` equals the Mine deployment timestamp. Verify its fixed sixteen slots and the hard-coded Mine constants:
   2× price reset, 1 USDG floor, 64 GBX-per-second initial global rate, provisional `69 days` halving period, and 1
   GBX-per-second global tail. The prospective-rate clock starts at deployment even while all slots are empty, so
   minimize and report any delay between Mine deployment and public market exposure. Verify Mine emits
   `RevenueDeposited` after a successful `SafeERC20` request for the nominal Router share and contains no synchronous
   `route()` call.
5. From the temporary GBX minter, call `GBX.setMinter(Mine)` exactly once. Verify `minterLocked == true`, Mine is the
   minter, `Mine.gbx()` equals GBX, and no alternative mint authority exists. This step is irreversible and must be
   complete before publishing or exposing the Mine address because Mine does not repeat these deployment checks on
   every replacement.
6. While the temporary setup owner still controls Resonance, create every reviewed initial Strategy, including one
   ordinary Strategy whose payment token is the reviewed, externally created fungible Uniswap v2-style USDG/GBX LP
   ERC-20, and register any
   reviewed initial Bribe reward tokens. Verify the complete Strategy, BribeRouter, and Bribe graph. The LP token has
   no special core configuration or behavior. Do not defer bootstrap membership until after ownership handoff.
7. Stop unless a later ADR has selected and reviewed the external governance integration. This repository deploys no
   Governor or Timelock and currently has no authorized production Resonance owner. Verify the selected integration's
   exact provider release, deployed bytecode or proxy implementation, plugins, SignalGBX compatibility, permission and
   admin graph, upgrade and emergency paths, proposal rules, batching, execution delay, and cancellation semantics.
8. After verifying their permanent Resonance bindings, renounce ownership of SignalGBX, StrategyFactory, and
   BribeFactory. Verify each `owner()` is the zero address. Then transfer Resonance directly from the temporary setup
   owner to the exact reviewed external governance executor. Verify `Resonance.owner()` and every ownership receipt,
   and prove that the deployment coordinator retains no authority.
9. Reconcile runtime bytecode, constructor arguments, zero initial supply, one-time bindings, bootstrap Strategies,
   the reviewed external LP Strategy payment token, external governance configuration and ownership, permanent Mine
   authority, fixed slot count sixteen, Mine `startTime`, elapsed deployment-to-exposure delay, and the Mine/Router
   event and call boundary.

Optional manual, frontend, volunteer-keeper, or cron calls to permissionless `ResonanceRouter.route()` are periphery,
not deployment dependencies. No keeper role or bounty is configured, and no automation may be presented as a protocol
liveness guarantee.

The frontend must remain read-only until a signed manifest proves those facts. Mine's constants still require
independent economic review. The external governance integration is unselected, and no signed manifest exists for
this repository state; deployment is therefore blocked.

No script in this repository is authorized to broadcast these steps. A failed setup must be abandoned before use;
the immutable deployed system has no migration or repair authority.
