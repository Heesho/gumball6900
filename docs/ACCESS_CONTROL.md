# Access control

> Development design only. No production roles or addresses are configured.

OpenZeppelin TimelockController owns Resonance and Mine. ProtocolGovernor is its sole proposer and sole
`CANCELLER_ROLE` holder; the zero-address executor makes execution permissionless after the documented delay. No
external default admin remains after setup.

The timelock can call only these lasting administrative methods:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeReward`, within the fixed eight-token cap; and
- `Mine.increaseCapacity`, increase-only from one to a hard maximum of 16.

Increasing capacity never changes an occupied slot's reward rate. The timelock cannot change mining prices, splits,
halving parameters, the tail rate, GBX mint authority, Fund assets, or liquidity custody.

ProtocolGovernor fixes SignalGBX, TimelockController, Resonance, Mine, voting delay, voting period, proposal threshold,
and quorum percentage at construction. Its proposal filter accepts only the four exact zero-value calls above.
Inherited generic relay and Timelock replacement entrypoints always revert. Standard Governor cancellation is available
only to the proposal's proposer while Pending; there is no multisig bypass, guardian, or cancellation path once queued.

GBX binds Mine once during deployment. SignalGBX, StrategyFactory, and BribeFactory bind Resonance once. Fund and
LiquidityPosition are ownerless. There are no proxies, pause switches, sweep methods, successor bindings, migrations,
or generic executors in protocol contracts.

Mining, slot checkpointing, displaced-miner claims, routing, signaling through SignalGBX, staking, unstaking, Strategy
purchases, reward claims, liability payment, liquidity fee harvesting, Fund GBX burning, and redemption are
permissionless. Resonance's signal hooks accept only SignalGBX, preventing a second user-facing coordinator.
