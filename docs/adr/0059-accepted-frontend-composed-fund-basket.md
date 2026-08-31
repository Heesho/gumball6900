# ADR 0059: Accept frontend-composed Fund basket claims

- Status: accepted for development; CEX-09 accepted risk; not deployed or approved for user funds
- Date: 2026-08-31
- Preserves: ownerless registry-free Fund; caller-selected redemption assets; exact selected-token payouts; permanent
  omission forfeiture; and no NAV, oracle, complete-basket loop, recovery, or asset-admission authority

## Context

`Fund.redeem` accepts a caller-selected array of unique non-GBX token addresses. The caller receives the same pro-rata
share of every selected balance, atomically with the GBX burn. Tokens omitted from that array stay in Fund and the
redeemer permanently forfeits the omitted shares.

Fund intentionally has no asset registry. Any ERC-20 may be transferred to it, including unsolicited assets unknown to
the official interface. The contract therefore cannot prove that a submitted array contains every Fund holding.

Tracked landing, web, and deck material describes redemption as taking a share of every holding or everything in one
transaction. The deck also describes below-backing redemption as necessarily profitable and gap-closing. Those are
product-level claims stronger than the contract's caller-selected mechanism and non-guaranteed market behavior.

## Decision

The maintainer explicitly accepts CEX-09 as a Medium product-claim and asset-discovery risk and selects no contract or
copy change:

- retain the registry-free caller-selected Fund design;
- expect the official interface to identify and submit all assets it presents as Fund holdings;
- permit users and other interfaces to submit any independently discovered complete list;
- retain the existing public complete-basket and arbitrage wording without treating it as contract-enforced; and
- do not add an asset registry, complete-basket loop, pagination state, redemption receipt, oracle, NAV calculation, or
  price-support guarantee.

This decision does not fix or downgrade CEX-09. A user receives every asset only if the submitted array actually names
every Fund token address.

## Accepted consequences

- An index or interface may omit an unsolicited, newly acquired, stale, or otherwise undiscovered Fund asset.
- A successful redemption permanently forfeits the user's share of every omitted asset.
- The core cannot attest that an interface's list is complete, and no project subgraph or index becomes authoritative.
- Buying GBX below an estimated backing value may support price convergence, but profitability and gap closure are not
  guaranteed after omitted assets, rounding, gas, liquidity, execution ordering, and market movement.
- The existing public wording remains an implementation/prose mismatch and must not be cited as a contract guarantee or
  as audit-validated release language.

## Evidence and release boundary

`packages/contracts/test/minimal/Fund.t.sol::test_OmittedTokensArePermanentlyForfeitedForThatRedeemer` proves the
selected-token and omission behavior. The live CEX-09 register identifies every tracked claim reviewed at the frozen
target.

Nothing in this decision proves that any current or future interface discovers every Fund asset, authorizes publication,
or clears the repository's separate implementation/prose release gate.
