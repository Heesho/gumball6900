# ADR 0060: Define no premint as no discretionary allocation

- Status: accepted and implemented in the uncommitted audit candidate
- Date: 2026-08-31
- Preserves: fixed 1,000 GBX launcher-only genesis-liquidity issuance; permanently locked genesis LP; permanent Mine
  mint authority; and no team, presale, treasury, investor, or discretionary allocation

## Context

GBX constructs with zero supply. During canonical launch, after Mine becomes the permanent issuer, Mine issues exactly
1,000 GBX solely into the newly created USDG/GBX Pair. The complete genesis LP supply is minted to `address(0)`. At that
point `GBX.lifetimeMinted() == 1,000 ether` while `Mine.totalMined() == 0`.

Before this remediation, some public surfaces said both “no premint” and that every GBX in existence comes from mining.
The first phrase can accurately describe the absence of an insider or discretionary allocation. The second claim does
not describe the fixed launcher-only genesis-liquidity issuance.

## Decision

Retain **No premint** as the public positioning and define it precisely:

- no GBX goes to a team, presale, treasury, investor, or discretionary allocation;
- the token constructor returns with zero supply;
- canonical launch then issues a fixed 1,000 GBX solely into permanently locked genesis liquidity; and
- every subsequent GBX is issued through mining.

No protocol or economic change is selected. The maintainer approved the byte-exact public/test wording diff before it
was applied.

## Implementation evidence

The approved six-file diff is preserved in `plans/CEX10-EXACT-COPY-CHANGE.patch`, SHA-256
`d5cd3fb73752b75ba45c336d5dc3f9d1db010db2ad715de30604004a9794d243`. The applied scoped diff has the identical hash.
Four web test files with 32 tests, web typecheck, the web production build, formatting, and three focused Mine/launcher
supply tests passed under the repository's pinned Node 22.23.1 environment. A fresh read-only reviewer independently
confirmed the exact diff, supply claims, consumer search, and active release-surface search. No Solidity source changed.

## Consequences

- “No premint” must not be used to assert zero post-launch supply or zero non-mining lifetime issuance.
- Genesis-liquidity GBX is not circulating insider inventory, but it remains part of `totalSupply` and
  `lifetimeMinted` for accounting and redemption.
- Supply charts, simulations, tests, and deployment evidence must distinguish token-constructor state from completed
  canonical-launch state.
- Nothing in this ADR authorizes editing, publishing, deploying, or describing the protocol as launched.
