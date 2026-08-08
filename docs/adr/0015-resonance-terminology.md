# ADR 0015: Resonance terminology for holder signaling

- Status: accepted
- Date: 2026-08-08

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
- Retain the `Bribe`, `BribeRouter`, and `bribeBps` contract names because they describe the incentive mechanism rather
  than the holder allocation action.
- Retain standards-defined or inherited names such as OpenZeppelin `ERC20Votes`, `getVotes`, and `getPastVotes` where
  changing them would fork a standard interface. Historical upstream provenance and provisional evidence for the
  removed `AllocationVoter` graph also preserve their original names.

## Consequences

This is an intentional breaking ABI and integration change. Deployments and clients built against the former contract,
function, event, or address-field names are not compatible without migration. Contract artifacts, SDK ABIs and APIs,
subgraph mappings, documentation, and tests must be regenerated or updated together.

The repository has no production deployment, so the rename is made at the development starting point rather than
through an onchain upgrade or compatibility shim. The underlying allocation, revenue, reward, and access-control
behavior is unchanged.
