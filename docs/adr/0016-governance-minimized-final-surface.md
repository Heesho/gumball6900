# ADR 0016: Governance-minimized immutable final surface

- Status: proposed
- Date: 2026-08-08

## Context

GumBall6900 is intended to use signals for continuous capital direction rather than conventional proposal governance.
The current development contracts still contain a broader owner-controlled surface, including mutable economic and
successor-management functions. That implementation does not match the intended final trust model.

The final deployment should distinguish two jobs:

1. `sGBX` holders continuously direct new capital among active Strategies through signals.
2. A designated manager maintains only the small set of boundaries that cannot be expressed through capital signals.

## Proposed decision

Deploy the protocol once as direct, non-upgradeable contracts. The core bytecode and all protocol rules outside the
explicit management surface remain fixed after deployment.

The manager receives exactly four authorized actions:

1. add a Strategy;
2. remove a Strategy;
3. change the management fee; and
4. add Bribe rewards.

There is no generic call executor, proxy upgrade, successor migration, arbitrary treasury withdrawal, pause function,
signal-reward split setter, or general parameter setter. Strategy weights and revenue direction remain exclusively
controlled by current `sGBX` signals.

The final implementation must encode the meaning and any bounds of the management fee directly. Strategy removal and
Bribe reward registration semantics must also be fully specified and tested. The manager authorization mechanism and
key lifecycle must be resolved without introducing additional callable management functions.

## Current implementation gap

This ADR records a target, not an implemented claim. The current Solidity, deployment scripts, access-control docs,
ABIs, SDK, subgraph, and tests still describe a broader administrative and migration surface. No deployment or release
may proceed until those powers are removed, the four-action surface is implemented, and every generated artifact and
public document agrees with the final contracts.

## Consequences

- Holders control capital direction continuously without proposal ballots or parameter votes.
- Management can curate Strategy eligibility, set the management fee, and register Bribe rewards, but cannot rewrite
  the core protocol.
- Removing upgrade, migration, recovery, and pause mechanisms reduces governance power while making deployment errors
  and unforeseen failures permanent.
- A compromised manager remains able to misuse the four listed actions. It cannot gain additional powers through the
  protocol.
- The proposal remains unresolved until the management-fee economics, manager authorization, key lifecycle, and exact
  contract interfaces are specified.
