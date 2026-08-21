# ADR 0034: External governance ownership

- Status: accepted for the development architecture; external governance remains unselected and deployment remains
  blocked; its three-method administration list is superseded by ADR 0036's addition of bounded global
  `setBribeBps`; not independently audited or deployed; not approved for user funds
- Date: 2026-08-19
- Supersedes:
  - ADR 0030's `ProtocolGovernor`, selector filter, `TimelockController`, cancellation, and governance-deployment
    decisions;
  - ADR 0031's preservation and use of that Governor and Timelock; and
  - ADR 0029's intended Timelock owner for Resonance.
- Preserves: SignalGBX's non-transferable ERC20Votes checkpoints, mandatory signal backing, immediate exits, and the
  direct non-upgradeable core. ADR 0036 later expands the continuing Resonance surface from three methods to four.

## Context

The repository implemented a bespoke OpenZeppelin Governor and Timelock solely to administer Resonance's then-current
methods.
The intended deployment will instead use an established external governance system, with Aragon under consideration.
Keeping a second in-repository proposal, voting, queue, and execution stack would duplicate that system and expose an
integration surface that is not intended to be deployed.

No exact external governance product, release, plugin set, permission graph, voting configuration, or execution-delay
policy has yet been selected. The repository therefore must not imply that Aragon or any other provider is already part
of the reviewed protocol graph.

## Decision

The core does not include `ProtocolGovernor`, a protocol `TimelockController`, a generic executor, or a
provider-specific governance adapter. Their Solidity source, tests, ABIs, SDK lifecycle helpers, and subgraph data
sources are removed.

SignalGBX remains a non-transferable ERC20Votes token on the default block-number clock. Its checkpoints are available
to a future external governance integration, but the core assigns them no proposal threshold, quorum, voting period,
or execution semantics.

Resonance remains the only core contract with continuing custom owner authority. Its protocol administration methods
remain:

```text
Resonance.addStrategy
Resonance.killStrategy
Resonance.addBribeReward
Resonance.setBribeBps
```

The owner can also call inherited `transferOwnership` and `renounceOwnership`. The core no longer claims to enforce a
selector-bounded proposal surface around those owner capabilities.

SignalGBX, StrategyFactory, and BribeFactory also inherit Ownable around their one-time Resonance bindings. Once those
bindings are consumed they expose no remaining custom owner action, but inherited ownership transfer and renunciation
remain in their ABIs. Production must explicitly renounce those three setup-only ownership shells after verifying the
bindings; “transfer Resonance” alone does not remove the temporary owner everywhere.

Development and tests may keep the deployment fixture as setup owner. A production deployment must create and verify
all one-time bindings and reviewed bootstrap Strategies, renounce the three consumed setup-only ownership shells, then
transfer Resonance directly to the exact external governance executor selected by a later ADR. The temporary setup
owner must retain no authority afterward.

The later integration decision must pin and review at least:

- provider, exact release, deployed bytecode, and proxy or upgrade model;
- plugin set, permission graph, root/admin holders, and any emergency path;
- direct compatibility with SignalGBX voting checkpoints and delegation;
- proposal creation, quorum, support, voting duration, execution, batching, cancellation, and delay semantics; and
- the exact Resonance owner address and transaction evidence proving the handoff.

Until those facts are selected, tested, and recorded, no deployment is authorized.

## Consequences

- The core and its SDK/subgraph no longer maintain an unused governance lifecycle.
- SignalGBX remains ready for an IVotes-compatible external system without committing the protocol to one today.
- The core itself no longer guarantees selector filtering, immutable governance parameters, a post-vote Timelock delay,
  permissionless execution, sole-proposer closure, or queued-operation cancellation rules.
- Security analysis of snapshot borrowing, quorum liveness, permissions, upgrades, and execution behavior moves to the
  selected external governance integration and must be repeated against its exact release.
- A compromised external Resonance owner can misuse the four administration methods, including moving the global
  Bribe share anywhere within its 0%-20% bound, transfer ownership, or renounce ownership. Ownerless contracts and
  immutable core parameters remain outside that authority.
- This is a breaking ABI, deployment, indexing, SDK, documentation, and threat-model change. There is no production
  deployment, so no migration or compatibility shim is introduced.
