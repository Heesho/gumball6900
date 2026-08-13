# Deployment outline

> This is an unexecuted development outline, not a deployment manifest or release authorization.

Required inputs include reviewed USDG and Uniswap v4 addresses, the hookless pool configuration, genesis price and
one-sided range, initial Strategies, project multisig, timelock delay, all immutable Mine parameters, provenance
clearance, and independent security evidence.

The intended order is:

1. Deploy OpenZeppelin `TimelockController` with the multisig as proposer/canceller, an open executor role, and no
   external default administrator.
2. Deploy GBX with the liquidity bootstrap as recipient of exactly 20 million GBX and a temporary deployment
   coordinator as minter. The coordinator exists only to complete the one-time Mine handoff.
3. Deploy Fund, SignalGBX, BribeFactory, and StrategyFactory.
4. Deploy Resonance with a setup owner, bind Resonance once in SignalGBX and both factories, deploy ResonanceRouter,
   and complete Resonance's one-time router binding. Each call verifies the candidate points back to the exact
   SignalGBX, factory, Resonance, and USDG identities before storing the irreversible binding. SignalGBX cannot accept
   stakes before this step completes.
5. Deploy Mine with the exact signed values for price multiplier, minimum initial USDG price, initial GBX/second,
   cumulative halving amount, positive tail GBX/second, capacity one, and its intended owner. Verify its GBX, USDG,
   and ResonanceRouter identities.
6. From the temporary GBX minter, call `GBX.setMinter(Mine)` exactly once. Verify `minterLocked == true`, Mine is the
   minter, `Mine.gbx()` equals GBX, and no alternative mint authority exists. This step is irreversible.
7. Transfer Resonance and Mine ownership to TimelockController if they were not constructed with it directly. Verify
   Resonance exposes only its three intended actions and Mine exposes only increase-only capacity management.
8. Initialize the reviewed hookless GBX/USDG v4 pool and create the precommitted out-of-range position using only the
   20 million GBX allocation. Verify ordering, price, ticks, liquidity, NFT ID, and any deterministic residual.
9. Deploy LiquidityPosition with that exact pool, range, NFT ID, PositionManager, and Permit2. Verify every immutable
   before safe-transferring the NFT, then prove custody and zero genesis USDG. The NFT can never be recovered.
10. Schedule initial Strategy creation through the timelock.
11. Reconcile runtime bytecode, constructor arguments, one-time bindings, ownership, timelock roles and delay, the
    20-million allocation, permanent Mine authority, capacity one, PoolKey, ticks, NFT ID, and NFT custody.

The frontend must remain read-only until a signed manifest proves those facts. Exact Mine parameters are release
inputs, not values to infer from tests or examples. No signed manifest exists for this repository state.

No script in this repository is authorized to broadcast these steps. A failed setup must be abandoned before use;
the immutable deployed system has no migration or repair authority.
