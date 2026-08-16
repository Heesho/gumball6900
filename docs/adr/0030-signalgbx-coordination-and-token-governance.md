# ADR 0030: SignalGBX coordination and selector-bounded token governance

- Status: accepted for ProtocolGovernor, Timelock, voting-token, and selector-bounded governance decisions; idle
  SignalGBX, standalone staking/unstaking, redundant combined workflows, and `allocatedBalance` decisions are
  superseded by [ADR 0031](0031-mandatory-signal-backed-signalgbx.md); not audited or deployed; not approved for user
  funds
- Date: 2026-08-15
- Supersedes:
  - ADR 0013's external proposer/canceller administration model;
  - ADR 0016's designated-manager and unrestricted Timelock-proposer assumptions;
  - ADR 0019's direct Resonance signaling API and Resonance-owned account aggregate;
  - ADR 0024's GBX ERC20Votes implementation-bound statement; and
  - ADR 0029's direct Resonance signal-entry and duplicated signal-ledger descriptions.
- Preserves: ADR 0015's signal terminology, ADR 0019's scalar absolute allocations and immediate exits, ADR 0029's
  Bribe-shaped Resonance stream, and the four continuing administrative actions.

> The `Token responsibilities`, `Sole signal coordinator and combined workflows`, and `Canonical signal state`
> sections below document the superseded idle-receipt design. ADR 0031 replaces those sections with mandatory
> signal-backed minting and burning. The ProtocolGovernor, Timelock, cancellation, and deployment-authority sections
> remain authoritative.

## Context

Signals and administrative governance are different decisions but draw authority from the same committed GBX stake.
The prior graph left users calling Resonance directly, duplicated parts of the allocation ledger, placed voting
checkpoints on transferable GBX, and relied on an external proposer for the Timelock. That created two public signal
surfaces and let the party holding proposer authority schedule any call the generic Timelock could execute.

The final graph needs one staking receipt, one signal coordinator, and token governance that cannot grow beyond the
four already accepted administrative actions. It must preserve immediate allocation changes and exits without adding a
staking lock, governance guardian, upgrade path, or arbitrary-call executor.

## Decision

### Token responsibilities

GBX remains the transferable mining, liquidity, staking, and redemption token. It retains ERC-2612 permit approvals but
does not inherit ERC20Votes and carries no governance checkpoints.

SignalGBX is minted and burned one-for-one against staked GBX. It is non-transferable, retains ERC20Votes on the
default block-number clock, and self-delegates whenever an account stakes with no current delegate so voting
checkpoints activate without a second transaction. SignalGBX has no ERC-2612 approval permit. Its inherited
vote-signature functions are governance
delegation, not token-spending approval.

Allocated and idle sGBX have the same governance power. Idle sGBX directs no Resonance revenue and earns no Bribe
reward, but it can vote. A holder can remove allocations and unstake immediately; historical proposal snapshots do not
lock the stake.

### Sole signal coordinator and combined workflows

SignalGBX is the only user-facing signal coordinator. It exposes:

```solidity
stake(uint256 amount)
stakeAndSignal(address strategy, uint256 amount)
stakeAndSignalWithPermit(address strategy, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
signal(address strategy, uint256 amount)
removeSignal(address strategy, uint256 amount)
moveSignal(address fromStrategy, address toStrategy, uint256 amount)
removeSignalAndUnstake(address strategy, uint256 amount)
unstake(uint256 amount)
```

`stakeAndSignalWithPermit` attempts an underlying GBX permit and tolerates a pre-consumed signature because the exact
GBX `transferFrom` remains authoritative. The other combined workflows are atomic compositions of
the corresponding standalone calls. Amounts remain absolute incremental deltas; there is no whole-account reset, batch,
epoch, cooldown, or withdrawal delay.

Resonance exposes `addSignalFor`, `removeSignalFor`, and `moveSignalFor` only to the bound SignalGBX. Direct user signal
mutation on Resonance is removed.

### Canonical signal state

Each fact has one canonical storage owner:

```text
account aggregate allocation        = SignalGBX.allocatedBalance(account)
account-by-Strategy allocation       = Bribe(strategy).balanceOf(account)
complete Strategy signal supply      = Bribe(strategy).totalSupply()
active live-Strategy aggregate       = Resonance.totalSignalWeight()
```

Resonance view functions may read those owners, but no second account or Strategy allocation ledger is maintained.
SignalGBX updates its aggregate reservation atomically with Resonance checkpointing and paired-Bribe virtual balance
changes.

### Selector-bounded ProtocolGovernor

ProtocolGovernor uses SignalGBX as its immutable IVotes source. Its constructor fixes the TimelockController,
Resonance, Mine, voting delay, voting period, proposal threshold, and quorum numerator. The quorum denominator is fixed
at 100. Voting follows SignalGBX's block-number clock; none of these values or dependencies has a setter.

Every proposal element must have zero ETH value, use the immutable target, use the exact selector, and have the exact
static calldata length for one of:

```text
Resonance.addStrategy
Resonance.killStrategy
Resonance.addBribeReward
Mine.increaseCapacity
```

The inherited generic `relay` and Timelock replacement entrypoints always revert. The execution entrypoint also rejects
nonzero `msg.value` before it can be forwarded to the Timelock. Batches may contain only the same four allowed calls;
they cannot target the Governor, Timelock, another contract, or another selector.

### Timelock authority and cancellation

TimelockController owns Resonance and Mine. ProtocolGovernor is its sole proposer and sole `CANCELLER_ROLE` holder,
the zero address holds the executor role, and no external default administrator remains after setup. There is no
deployer or multisig proposer bypass.

OpenZeppelin Governor's public cancellation rule remains unchanged: only the proposal's proposer can cancel while the
proposal is Pending. No public path reaches Timelock cancellation after queueing. There is deliberately no guardian or
queued-proposal veto; the Timelock delay is an observation and exit window.

### Deployment order

The temporary setup owner completes reciprocal bindings and creates every reviewed initial Strategy before governance
handoff. Deployment then creates the Timelock and ProtocolGovernor, grants only the Governor proposer and canceller
roles, transfers Resonance and Mine ownership to the Timelock, and finally renounces temporary Timelock administration.
The final evidence must also prove that no alternate proposer, external admin, or pre-scheduled operation remains.

## Consequences

- One non-transferable receipt now carries both continuous signal authority and administrative voting power without
  making transferable GBX itself governable.
- Atomic combined workflows reduce approvals and intermediate transactions while preserving the scalar state machine.
- Canonical state ownership removes account and Strategy enumeration from Resonance, but offchain readers must compose
  SignalGBX, Resonance, and the paired Bribe.
- A holder may stake before a snapshot, remove signals and unstake after it, and still cast historical votes. Borrowed
  or short-lived stake across a snapshot is not prevented.
- A percentage quorum is measured against historical staked sGBX supply, not total GBX supply. Low staking participation
  lowers the absolute capture threshold.
- Block production controls the wall-clock duration represented by immutable voting-delay and voting-period values.
- A malicious successful proposal is irrevocable after queueing. Users must rely on the Timelock delay to observe and
  exit rather than on a guardian.
- Incorrect targets, voting parameters, role assignment, initial Strategy bootstrap, or setup-authority removal cannot
  be repaired through governance.

This decision is a breaking ABI, deployment, indexing, SDK, documentation, and threat-model change. The repository has
no production deployment, so no compatibility shim or migration authority is introduced.
