# Archived release tooling

The files in this directory describe and implement the superseded pre-rebuild release process. They reference removed
contracts, fork suites, deployment phases, and a release workflow that no longer exists.
They have no package-script or CI entrypoint and must not be used as current build, deployment, authorization, or
release evidence.

In particular, that process predates ADR 0050's zero-premint, eleven-contract core and still assumes protocol-owned
genesis liquidity. The current core deploys no liquidity position; any reviewed external Uniswap v2-style USDG-GBX LP
ERC-20 is only an ordinary Strategy deployment input.

The minimal rebuild is intentionally not deployed or release-ready. Any future release process must be designed from
the external-governance ownership boundary in ADR 0034 after that integration is selected and separately authorized;
these archived scripts are not a starting authorization and must not be re-enabled piecemeal.

`prepare-release.mjs` now fails before creating output when given the retained schema-v3 manifest. The generic
`deriveSubgraphNetworks` helper also fails rather than translating removed contract names into a seemingly current
network file. The explicitly named `deriveArchivedSubgraphNetworks` helper remains available only for structural tests
of historical fixtures.

`check-release-readiness.mjs` may still inspect the retained evidence for regressions, but its generic report always
includes the current external-governance tooling blocker and therefore cannot emit
`eligible-for-technical-final-gate` for this architecture.
