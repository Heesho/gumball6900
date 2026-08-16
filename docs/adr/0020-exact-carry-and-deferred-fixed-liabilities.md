# ADR 0020: Preserve exact carry and defer fixed-destination payouts

- Status: accepted for Bribe and fixed-liability behavior; Resonance carry, direct-donation synchronization, and
  Resonance Fund-liability provisions superseded by ADR 0029; Strategy-routing provision superseded by ADRs 0021 and
  0032
- Date: 2026-08-09
- Builds on [ADR 0019](0019-incremental-absolute-signals-and-bounded-bribe-rewards.md)
- Supersedes the A-02, A-03, and A-04 risk descriptions in ADRs 0017 and 0019

The Resonance-specific decisions below are retained as historical context only. [ADR 0029](0029-bribe-based-resonance.md)
replaces them with Bribe-style reward indexing and explicitly accepted surplus. The Bribe, BribeRouter, selective-claim,
and fixed Strategy-payment liability decisions remain active.

## Context

The frozen core graph used cumulative indexes for USDG and reward allocation. Whole-unit division could silently lose
sub-index revenue, seven-day rate division left a remainder, reward time elapsed with zero signal supply, and a direct
dead-Strategy transfer to Fund coupled signal exit to an administered USDG transfer.

These were accounting and liveness defects, not a reason to add governance, migration, or another protocol component.

## Decision

Keep the contract graph and permissions unchanged while making accounting explicit:

- Resonance retains global scaled carry, globally indexed but uncheckpointed value, and per-Strategy carry.
- Bribe retains exact rate remainders, scaled global/indexed/user carry, queues notifications behind a live stream,
  and pauses active stream time while virtual supply is zero.
- Revenue or rewards already committed to Fund become fixed, permissionlessly payable liabilities. Signal removal and
  unstaking never transfer USDG or a reward token.
- Bribe exposes scalar and caller-selected reward claims so a broken token need not block unrelated rewards.
- BribeRouter pulls an acquisition payment once and classifies its fixed destinations atomically. ADR 0021's later
  100%-Fund rule was itself superseded by ADR 0032's cumulative 90% Fund and 10% paired-Bribe liabilities.
- Direct USDG donations to Resonance are observable and permissionlessly classifiable with `syncRevenue`.

No destination can be redirected, no recovery role is introduced, and `MAX_REWARD_TOKENS` remains eight.

## Consequences

A-02, A-03, and A-04 are resolved in the internal candidate. A-08's unbounded-liveness concern is resolved by the
fixed cap and selective/scalar surfaces, while the measured linear gas cost remains a documented residual. A failed
fixed-destination token transfer leaves an observable liability and can be retried; it does not authorize a fallback
receiver. Direct unsupported-token donations remain outside protocol accounting unless an explicit synchronization
surface exists.

The change adds accounting state, events, SDK readers/actions, and subgraph fields. It does not make the protocol
independently audited or release-authorized.
