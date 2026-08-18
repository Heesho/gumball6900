# Access control

> Development design only. No production roles or addresses are configured.

> ADRs 0031 and 0032 define the target authority model below. Their implementation is pending; current contracts and
> integrations still reflect the superseded design.

OpenZeppelin TimelockController owns Resonance. ProtocolGovernor is its sole proposer and sole
`CANCELLER_ROLE` holder; the zero-address executor makes execution permissionless after the documented delay. No
external default admin remains after setup.

The timelock can call only these lasting administrative methods:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeReward`, within the fixed eight-token cap.

Mine has no owner or administrative methods. The timelock cannot change mining prices, splits,
halving parameters, the tail rate, GBX mint authority, Fund assets, or liquidity custody.

The 90% Fund / 10% paired-Bribe acquired-asset split is immutable and exposes no setter. After the first Strategy is
created, `killStrategy` reverts if it would remove the final live Strategy. Governance replaces that Strategy by
batching `addStrategy` before `killStrategy`; this is an execution constraint on an existing allowed selector, not a
new administrative power.

ProtocolGovernor fixes SignalGBX, TimelockController, Resonance, voting delay, voting period, proposal threshold,
and quorum percentage at construction. Its proposal filter accepts only the three exact zero-value calls above.
Inherited generic relay and Timelock replacement entrypoints always revert. Standard Governor cancellation is available
only to the proposal's proposer while Pending; there is no multisig bypass, guardian, or cancellation path once queued.

GBX binds Mine once during deployment. SignalGBX, StrategyFactory, and BribeFactory bind Resonance once. Fund and
LiquidityPosition are ownerless. There are no proxies, pause switches, sweep methods, successor bindings, migrations,
or generic executors in protocol contracts.

Mining, displaced-miner claims, routing, `signal`, `signalWithPermit`, `moveSignal`,
`withdrawSignal`, Strategy purchases, reward claims, Fund-liability payment, paired-Bribe notification, liquidity fee
harvesting, Fund GBX burning, and redemption are permissionless. There is no standalone staking or unstaking surface.
Resonance's signal hooks accept only SignalGBX, preventing a second user-facing coordinator. Permissionless
`payFundPayment` and `notifyBribeReward` can settle only their immutable destinations and cannot redirect either
liability.
