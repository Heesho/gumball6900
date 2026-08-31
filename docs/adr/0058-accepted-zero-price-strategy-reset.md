# ADR 0058: Accept zero-price Strategy reset behavior

- Status: accepted for development; SECURITY-01 accepted risk; not deployed or approved for user funds
- Date: 2026-08-31
- Preserves: the Euler Fee Flow-shaped linear auction, a zero price after full decay, caller-selected revenue receiver,
  successful-fill epoch advancement, and `minimumPrice` as only the next epoch's starting-price floor

## Context

Each Strategy's price decays linearly to zero over its epoch. A successful fill transfers the complete snapshotted USDG
inventory to the caller-selected receiver, increments the epoch, and starts the next epoch at the bounded clearing-price
multiple or `minimumPrice`. A zero-price fill intentionally collects no payment token.

SECURITY-01 composes those intended transitions with freely transferable USDG. At full decay, an untrusted helper can
buy for zero, receive the inventory, let `buy` finish and reset the next epoch to `minimumPrice`, then return the USDG to
the Strategy in the same outer transaction. The helper can repeat the transition once each matured epoch without GBX or
allowance. Receiver-identity checks, code-size checks, in-call balance deltas, and `nonReentrant` do not prevent a
sequential return after `buy` completes.

The auction kernel descends from the pinned Euler Fee Flow lineage recorded in the audit provenance register. That
lineage and its production experience informed the maintainer's economic choice, but they do not transfer security
assurance to GumBall's exact USDG, Fund, Bribe, receiver, and Strategy composition. The GumBall-specific round trip was
therefore reproduced and dispositioned independently.

## Decision

The maintainer explicitly accepts SECURITY-01 as intended auction behavior and selects no production change:

- retain a zero purchase price at and after full epoch decay;
- permit any nonzero revenue receiver, including a receiver that later returns the fungible USDG;
- advance every successful fill to a new epoch and apply `minimumPrice` only to that next epoch's starting price;
- do not add a fill-time floor, zero-fill fee or bond, cooldown, receiver classification, donation quarantine, or
  balance-delta requirement; and
- do not claim that a zero-price fill durably clears Strategy inventory or that an untrusted caller cannot reset a
  matured auction while returning the asset.

The finding remains a confirmed Medium accepted risk. It is not fixed or downgraded by upstream ancestry, tests, or
this ADR.

## Accepted consequences

- A gas-paying ordering adversary may repeatedly move a matured auction from zero back to `minimumPrice` while leaving
  the same or greater USDG inventory in the Strategy.
- Competing zero-price transactions become stale when the adversary advances the epoch.
- A buyer willing to pay the valid reset-floor price can clear the inventory immediately; the behavior is delay and
  MEV grief rather than an absolute freeze.
- The behavior does not alter signal balances, block live or killed Strategy exits, affect Mine claims, or change Fund
  redemption.
- Strategy acquisition and payment flow has no guaranteed completion time. Public and operator documentation must not
  promise bounded acquisition or durable zero-price clearance.
- Making `minimumPrice` a fill-time floor could eliminate the token-free reset but would remove free clearance and may
  leave unattractive inventory unsold indefinitely. That alternative is rejected here as a different economic design.

## Evidence and release boundary

The permanent reproduction is
`packages/contracts/test/minimal/audit-exitability/reproductions/StrategySelfReceiverGrief.t.sol`. It covers repeated
self-receiver and non-self helper round trips. The exact upstream mapping and differential evidence are recorded in
`packages/contracts/audit/gauntlet/UPSTREAM_PROVENANCE.md`, `SEMANTIC_DIFFS.md`, and
`test/minimal/audit-gauntlet/UpstreamSequenceDifferential.t.sol`.

Current legal and license provenance gates remain separate and unresolved. Nothing in this decision converts upstream
production history into legal clearance, an independent GumBall audit, deployment authorization, or approval for user
funds.
