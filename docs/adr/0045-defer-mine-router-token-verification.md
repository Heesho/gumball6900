# ADR 0045: Defer Mine-to-Router token verification to deployment

- Status: accepted for development; not audited, deployed, or approved for user funds
- Date: 2026-08-22
- Supersedes: Mine's constructor-time Router USDG identity check

## Context

Mine receives immutable GBX, USDG, and ResonanceRouter addresses at construction. It previously called
`ResonanceRouter.usdg()` during construction and rejected a Router whose reported token differed from Mine's USDG.
That check prevented an accidentally crossed deployment but did not authenticate the Router's bytecode or prove that
it was the reviewed protocol instance.

Deployments in this repository are already required to verify constructor arguments, runtime bytecode, dependency
identities, and the complete protocol graph before binding GBX's permanent Mine authority or exposing the market. A
wrong standalone Mine deployment can be abandoned and replaced during that verification phase.

## Decision

Mine no longer calls `ResonanceRouter.usdg()` in its constructor. The constructor checks that GBX, USDG, and
ResonanceRouter are nonzero deployed contracts, then stores those exact immutable values. The local
`IRevenueRouterIdentity` interface and `UnexpectedRevenueToken` error are removed.

Before calling `GBX.setMinter(Mine)`, publishing the Mine address, or accepting user funds, deployment evidence must
verify all of the following at one pinned chain state:

```text
Mine.gbx() == GBX
Mine.usdg() == USDG
Mine.resonanceRouter() == ResonanceRouter
ResonanceRouter.usdg() == USDG
```

The deployed Mine and its complete deployment attempt must be abandoned if any equality fails. Production evidence
must also verify the exact Mine and ResonanceRouter runtime bytecode and constructor arguments; getter equality alone
does not authenticate a dependency.

`Resonance.setResonanceRouter` retains its own one-time reciprocal Resonance and USDG checks. GBX also retains its
one-time reciprocal `Mine.gbx()` check when permanent mint authority is handed over. No runtime mining, payment,
routing, emission, or custody behavior changes after a correctly wired deployment.

## Consequences

- An isolated Mine can now be deployed with a Router that reports a different token. This is intentionally a
  deployment-invalid candidate, not an acceptable protocol graph.
- A crossed candidate costs deployment gas but remains replaceable until the permanent GBX minter handoff and market
  exposure. Release tooling and human review must fail closed during that window.
- Mine construction no longer depends on an external Router getter call and its ABI no longer contains
  `UnexpectedRevenueToken` or the local identity interface artifact.
- The change removes one constructor defense against accidental cross-wiring. Signed manifest and post-deployment
  identity evidence become the authoritative control.
- This decision does not authorize deployment or use with user funds.
