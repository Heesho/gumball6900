# Access control

> Development design only. No production roles or addresses are configured.

## Timelock

The protocol uses OpenZeppelin `TimelockController` directly. There is no project-specific timelock contract.

- The project multisig receives `PROPOSER_ROLE` and `CANCELLER_ROLE`.
- `EXECUTOR_ROLE` may be granted to the zero address so anyone can execute a ready operation.
- The controller is deployed with `admin = address(0)`. Its own default admin is the controller itself.
- Role and delay changes must therefore be scheduled and executed through the same timelock.
- Resonance, Fund, and LiquidityPosition ownership is transferred to the controller.

OpenZeppelin's controller is a generic call executor. Governance authority is constrained by the methods the owned
contracts expose, not by a project-specific calldata allowlist.

## Governed methods

Resonance ownership controls:

- `setResonanceRouter`, once;
- `setBribeBps`, bounded to 0–5,000 basis points;
- `addStrategy`;
- `killStrategy`, permanently; and
- `addBribeReward`.

Fund ownership controls only `setSuccessor`, which is one-time and requires a same-GBX Fund-compatible destination.
It does not expose an administrative withdrawal or arbitrary-call method.

LiquidityPosition ownership controls only its one-time `setSuccessor`. The successor must commit to receiving the
same PositionManager NFT and expose identical GBX, USDG, ResonanceRouter, pool-key, and tick-range configuration. Position
migration becomes permissionless after that delayed commitment.

## One-time deployment bindings

SignalGBX, StrategyFactory, and BribeFactory each bind Resonance once. Their owners have no further mutable factory or
staking parameters after that binding. GBX similarly allows its initial minter to hand minting authority over once;
the intended final minter is Fundraiser.

## Permissionless operations

Contribution, epoch settlement, claiming, routing, signaling, allocation reset, staking, unstaking, Strategy purchase, revenue
distribution, Bribe claiming, liquidity-fee collection, Fund burning, redemption, and post-activation migrations do
not require an administrator.
