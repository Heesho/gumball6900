# ADR 0015: Resonance terminology for holder signaling

- Status: accepted for Resonance and signaling terminology; whole-account action and event examples are superseded by
  ADR 0019, and the public coordination surface is superseded by ADR 0030
- Date: 2026-08-08

The `Resonance`, `ResonanceRouter`, signaler, and signal-weight names remain current. ADR 0019 replaced the action and
event examples below with incremental `SignalAdded` and `SignalRemoved` behavior; ADR 0029 later simplified the
Resonance reward API, and ADR 0030 made SignalGBX the sole signal coordinator without changing this terminology.

## Context

The allocation layer previously used the names `VoterRouter` and `Voter`, with actions and events described as votes.
Those names imply ballots, governance periods, and collective decision finality. The protocol instead exposes a liquid,
continuously replaceable allocation signal: a GBX holder can redirect or reset their complete SignalGBX allocation at
any time, without an epoch, cooldown, or once-per-period rule.

The public terminology should make that minimized governance model clear and should distinguish continuous capital
signals from conventional DAO voting.

## Decision

- Rename `VoterRouter` to `ResonanceRouter` and `Voter` to `Resonance`.
- Rename the allocation action from `vote` to `signal` and the allocation state from votes to signals.
- Use `SignalAllocated`, `SignalReset`, and `ResonanceRouterSet` for the corresponding protocol events.
- Rename contract bindings, deployment fields, SDK builders and readers, subgraph data sources, and indexed fields to
  the same Resonance and signaling vocabulary.
- Describe participants as signalers, their allocation as signal weight, and their Strategy-linked distributions as
  signal rewards.
- Retain the `Bribe` and `BribeRouter` contract names because they describe the incentive mechanism rather
  than the holder allocation action.
- Retain standards-defined or inherited names such as OpenZeppelin `ERC20Votes`, `getVotes`, and `getPastVotes` on
  SignalGBX where changing them would fork a standard interface. GBX itself does not implement that interface.
  Historical upstream provenance and provisional evidence for the removed `AllocationVoter` graph also preserve their
  original names.

## Consequences

This is an intentional breaking ABI and integration change. Deployments and clients built against the former contract,
function, event, or address-field names are not compatible without migration. Contract artifacts, SDK ABIs and APIs,
subgraph mappings, documentation, and tests must be regenerated or updated together.

The repository has no production deployment, so the rename is made at the development starting point rather than
through an onchain upgrade or compatibility shim. The underlying allocation, revenue, reward, and access-control
behavior is unchanged.
