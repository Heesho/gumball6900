# Access control

> Development design only. No production roles or addresses are configured.

OpenZeppelin TimelockController owns Resonance and Mine. The project multisig is proposer/canceller; execution may be
permissionless after the documented delay. No external default admin remains after setup.

The timelock can call only these lasting administrative methods:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeReward`, within the fixed eight-token cap; and
- `Mine.increaseCapacity`, increase-only from one to a hard maximum of 16.

Increasing capacity never changes an occupied slot's reward rate. The timelock cannot change mining prices, splits,
halving parameters, the tail rate, GBX mint authority, Fund assets, or liquidity custody.

GBX binds Mine once during deployment. SignalGBX, StrategyFactory, and BribeFactory bind Resonance once. Fund and
LiquidityPosition are ownerless. There are no proxies, pause switches, sweep methods, successor bindings, migrations,
or generic executors in protocol contracts.

Mining, slot checkpointing, displaced-miner claims, routing, signaling, staking, unstaking, Strategy purchases, reward
claims, liability payment, liquidity fee harvesting, Fund GBX burning, and redemption are permissionless.
