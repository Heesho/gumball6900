# Access control

> Development design only. No production roles or addresses are configured.

## Timelock

The protocol uses OpenZeppelin `TimelockController` directly. There is no project-specific timelock contract.

- The project multisig receives `PROPOSER_ROLE` and `CANCELLER_ROLE`.
- `EXECUTOR_ROLE` may be granted to the zero address so anyone can execute a ready operation.
- The controller is deployed with `admin = address(0)`. Its own default admin is the controller itself.
- Role and delay changes must therefore be scheduled and executed through the same timelock.
- Resonance ownership is transferred to the controller. Fund and LiquidityPosition have no owner to transfer.

OpenZeppelin's controller is a generic call executor. Governance authority is constrained by the methods the owned
contracts expose, not by a project-specific calldata allowlist.

## Governed methods

Resonance ownership controls:

- `setResonanceRouter`, once;
- `setBribeBps`, bounded to 0–5,000 basis points;
- `addStrategy`;
- `killStrategy`, permanently; and
- `addBribeReward`.

Fund has no owner at all. It exposes no administrative withdrawal, arbitrary-call method, successor, or migration.
Assets leave Fund only when a GBX holder burns their own tokens through `redeem`.

LiquidityPosition has no owner at all. Once the precommitted NFT is accepted it can never be transferred out, by any
caller or any mechanism. Only permissionless fee processing remains.

## One-time deployment bindings

SignalGBX, StrategyFactory, and BribeFactory each bind Resonance once. Their owners have no further mutable factory or
staking parameters after that binding. GBX similarly allows its initial minter to hand minting authority over once;
the intended final minter is Fundraiser.

## Permissionless operations

Contribution, epoch settlement, claiming, routing, signaling, allocation reset, staking, unstaking, Strategy purchase, revenue
distribution, Bribe claiming, liquidity-fee collection, Fund burning, redemption, and post-activation migrations do
not require an administrator.
