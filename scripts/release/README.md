# Archived release tooling

The files in this directory describe and implement the superseded pre-rebuild release process. They reference removed
contracts, fork suites, permissioned-pool evidence, deployment phases, and a release workflow that no longer exists.
They have no package-script or CI entrypoint and must not be used as current build, deployment, authorization, or
release evidence.

The minimal rebuild is intentionally not deployed or release-ready. Any future release process must be designed from
the current ProtocolGovernor architecture in ADR 0030 and separately authorized; these archived scripts are not a
starting authorization and must not be re-enabled piecemeal.

`prepare-release.mjs` now fails before creating output when given the retained schema-v3 manifest. The generic
`deriveSubgraphNetworks` helper also fails rather than translating removed contract names into a seemingly current
network file. `export-mainnet-fork-context.mjs` and its generic builder likewise fail before writing or exporting the
old Safe-bound context. The explicitly named `deriveArchivedSubgraphNetworks` and
`buildArchivedMainnetForkContext` helpers remain available only for structural tests of historical fixtures.

`check-release-readiness.mjs` may still inspect the retained evidence for regressions, but its generic report always
includes the current ProtocolGovernor tooling blocker and therefore cannot emit
`eligible-for-technical-final-gate` for this architecture.
