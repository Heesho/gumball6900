# Deployment outline

> This is an unexecuted development outline, not a deployment manifest or release authorization.

Required inputs include the reviewed USDG and Uniswap v4 addresses, canonical hookless pool fee and tick spacing,
genesis price and one-sided position range, initial Strategy configuration, project multisig, timelock delay, and
independent security evidence.

The intended order is:

1. Deploy OpenZeppelin `TimelockController` with the multisig as proposer/canceller, an open executor role, and no
   external default admin.
2. Deploy GBX with the liquidity bootstrap as recipient of exactly 20 million GBX and the deployment coordinator as
   temporary one-time wiring minter. Additional minting remains disabled.
3. Deploy Fund, SignalGBX, BribeFactory, and StrategyFactory.
4. Deploy Resonance with the timelock as owner.
5. Bind Resonance once in SignalGBX and both factories.
6. Deploy ResonanceRouter and schedule Resonance's one-time router binding through the timelock.
7. Deploy Fundraiser with the fixed daily schedule and permanently hand it GBX minting authority.
8. Initialize the reviewed hookless GBX/USDG v4 pool and create the precommitted out-of-range position using only the
   20 million GBX allocation. Verify token ordering, price, ticks, liquidity, NFT ID, and any unavoidable residual.
9. Deploy LiquidityPosition with that exact pool, range, NFT ID, PositionManager, ResonanceRouter, and timelock owner; then
   safe-transfer the NFT and verify custody. No USDG belongs in the position at genesis.
10. Schedule initial Strategy creation through the timelock.
11. Transfer Fund ownership to the timelock and verify every immutable dependency, role, and one-time binding.

No script in this repository is authorized to broadcast these steps. Deployment tooling should be rebuilt for this
core rather than adapting the deleted legacy deployment graph.
