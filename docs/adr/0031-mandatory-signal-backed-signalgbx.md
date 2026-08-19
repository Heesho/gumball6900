# ADR 0031: Mandatory signal-backed SignalGBX

- Status: accepted and implemented in the development tree; not independently audited or deployed; not approved for
  user funds
- Date: 2026-08-16
- Supersedes:
  - ADR 0030's idle SignalGBX, standalone staking, standalone unstaking, redundant combined workflows, and
    `allocatedBalance` decisions; and
  - ADR 0029's permission to kill the final live Strategy.
- Preserves: ADR 0030's non-transferable ERC20Votes token, immediate scalar signal changes, and absence of a lock,
  pause, rescue, migration, or core upgrade path. ADR 0034 later supersedes its ProtocolGovernor and Timelock
  dependencies.

## Context

ADR 0030 allowed GBX to be staked into voting SignalGBX without allocating that SignalGBX to a Strategy. It therefore
needed a second account aggregate, `allocatedBalance`, and public operations for creating, assigning, releasing, and
burning an intermediate idle balance. This made the governance supply larger than the economically active signal
supply and created state combinations that every integration and invariant had to handle.

The protocol owner has selected a stricter state machine before deployment: SignalGBX exists only as a receipt for GBX
that is actively assigned to exactly one Strategy per raw unit. Governance power and aggregate signal ownership remain
on SignalGBX, but an idle receipt state is no longer valid.

## Decision

### Token and public surface

SignalGBX remains a non-transferable ERC20Votes token, backed one-for-one by GBX held in SignalGBX, available to the
external governance integration selected after ADR 0034, and the sole public user coordinator for signal changes. It
exposes these user operations:

```solidity
function signal(address strategy, uint256 amount) external;

function signalWithPermit(
    address strategy,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;

function moveSignal(address fromStrategy, address toStrategy, uint256 amount) external;

function withdrawSignal(address strategy, uint256 amount) external;
```

The protocol does not retain public `stake`, `unstake`, `stakeAndSignal`, `stakeAndSignalWithPermit`, allocation from a
previously idle SignalGBX balance, `removeSignal` that leaves SignalGBX idle, or `removeSignalAndUnstake`. This is a
breaking interface change. The repository has no production deployment, so compatibility shims are not introduced.

### Atomic transitions

`signal` performs one atomic transition:

1. transfer exactly `amount` GBX from the caller into SignalGBX;
2. mint exactly `amount` SignalGBX to the caller;
3. add exactly `amount` signal to the selected live Strategy through Resonance; and
4. deposit exactly `amount` of virtual balance for the caller in the paired Bribe.

`signalWithPermit` performs the same transition using the underlying GBX permit as authorization. The exact GBX
transfer remains authoritative. A failed or pre-consumed permit cannot create an unbacked receipt or a partial signal.

`moveSignal` checkpoints the source and destination Strategies under their old weights, withdraws the caller's virtual
balance from the source Bribe, and deposits the same amount into the destination Bribe. It transfers no GBX, mints or
burns no SignalGBX, and changes neither SignalGBX total supply nor governance voting units.

`withdrawSignal` performs the exact inverse of `signal`: it checkpoints and removes the selected Strategy signal,
withdraws the same virtual balance from the paired Bribe, burns the same SignalGBX amount, and returns exactly that
amount of GBX. A killed Strategy remains a valid withdrawal source and move source.

Every failed sub-operation reverts the complete transition. There is no reachable successful state in which a newly
minted raw SignalGBX unit is idle or a burned raw unit leaves signal behind.

### Canonical state and identities

Canonical signal ownership is:

```text
account aggregate signal             = SignalGBX.balanceOf(account)
account-by-Strategy signal            = Bribe(strategy).balanceOf(account)
complete Strategy signal              = Bribe(strategy).totalSupply()
active live-Strategy aggregate        = Resonance.totalSignalWeight()
```

SignalGBX does not maintain a separate `allocatedBalance`; that value would duplicate `balanceOf` and must always be
identical to it. Across live and killed Strategies:

```text
SignalGBX.balanceOf(account)
  = sum_strategy Bribe(strategy).balanceOf(account)

SignalGBX.totalSupply()
  = sum_strategy Bribe(strategy).totalSupply()

GBX.balanceOf(SignalGBX) >= SignalGBX.totalSupply()
```

Any GBX above the SignalGBX supply is unsolicited surplus. It creates no receipt, signal, withdrawal entitlement, or
governance voting power.

### Governance behavior

`signal` mints voting units. `moveSignal` does not change voting units. `withdrawSignal` burns voting units. Delegating
votes delegates no custody right and no authority to move or withdraw the delegator's signal. ADR 0034 later removes
ADR 0030's ProtocolGovernor and Timelock decisions.

There is still no signal cooldown, epoch, once-per-period restriction, or withdrawal lock. Immediate exit now occurs
through the bounded, per-Strategy `withdrawSignal` operation rather than an idle intermediate balance.

### Bootstrap and final live Strategy

Signal additions are impossible before the first live Strategy exists because only a registered live Strategy is a
valid destination. Reviewed initial Strategies must be created before the final governance handoff.

Resonance tracks `liveStrategyCount`. Before the first Strategy is registered the count may be zero. After the first
Strategy is registered, `killStrategy` must revert when it would reduce the count from one to zero. Any selected
external governance integration must replace the final Strategy by atomically batching `addStrategy(replacement)`
followed by `killStrategy(previous)`. No fake abstain Strategy or implicit null destination is created.

Strategy death remains irreversible. A killed Strategy cannot receive new signal, but every incumbent can move its
signal to a live Strategy or withdraw it completely. The last-live guard adds no pause, rescue, successor, migration,
or owner authority.

## Consequences

- SignalGBX supply, active user signal, escrow custody, and governance supply become one tighter state machine.
- The separate aggregate allocation mapping and every idle-state transition are removed.
- A user who wants voting power must also select a live Strategy and assumes the signal economics of that position.
- The final live Strategy cannot be killed alone. Governance must add a replacement first and may execute both actions
  atomically in one allowed Timelock batch.
- The change requires coordinated Solidity, Foundry, Hardhat, invariant, fuzzer, mutation, ABI, SDK, subgraph,
  deployment, application, one-pager, audit-campaign, and generated-reference updates.
- Until that implementation campaign is complete, the current code and generated artifacts describe the superseded
  ADR 0030 state machine. This ADR and AGENTS.md are authoritative for development; they are not claims of current
  implementation conformance.
