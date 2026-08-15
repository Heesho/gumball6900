# ADR 0016: Governance-minimized immutable final surface

- Status: accepted for the minimized four-action principle; terminology and implementation details are superseded by
  ADRs 0017, 0019, 0020, 0021, 0029, and 0030
- Date: 2026-08-08
- Superseded terminology: every reference below to a "management fee" means the bounded acquisition
  signal-reward share implemented as `bribeBps`; there is no separate management fee

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

After one-time setup, Resonance exposes exactly four ongoing owner-authorized actions:

1. `addStrategy`;
2. `killStrategy`;
3. `setBribeBps`, bounded from 0% through 50%; and
4. `addBribeReward`, bounded by the immutable eight-token Bribe cap.

There is no generic call executor, proxy upgrade, successor migration, arbitrary treasury withdrawal, pause function,
or general protocol parameter setter. Strategy weights and revenue direction remain exclusively controlled by current
`sGBX` signals. ADR 0030 replaces this ADR's designated-manager assumption with a selector-bounded ProtocolGovernor,
which is the Timelock's sole proposer and can schedule only the four final administrative calls.

The final implementation encodes the signal-reward share and its 50% ceiling directly. Strategy death and Bribe reward
registration semantics are specified and tested, and the owner path is intended to terminate at the documented
TimelockController rather than a deployer EOA.

## Current implementation gap

ADRs 0017 and 0019 implemented ownerless custody and the original four-action Resonance surface. ADR 0020 added exact
accounting without expanding it. ADR 0021 removed `setBribeBps`, leaving three ongoing owner-authorized actions.
Deployment remains blocked until a signed manifest verifies TimelockController ownership and roles, every one-time
binding, and removal of meaningful deployer authority.

## Consequences

- Holders control capital direction continuously without proposal ballots or parameter votes.
- Timelocked management can curate Strategy eligibility, set the bounded acquisition signal-reward share, and register
  Bribe rewards up to eight tokens, but cannot rewrite the core protocol.
- Removing upgrade, migration, recovery, and pause mechanisms reduces governance power while making deployment errors
  and unforeseen failures permanent.
- A compromised manager remains able to misuse the four listed actions. It cannot gain additional powers through the
  protocol.
- Incorrect Governor parameters, target binding, Timelock role setup, or temporary-authority removal remains a
  deployment risk and must be verified from signed external evidence.
