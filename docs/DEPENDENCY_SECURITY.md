# Dependency security

Last reviewed: 2026-08-02

Run the workspace audit from the repository root:

```sh
pnpm audit --json
```

CI stores that complete report, then runs
`packages/contracts/audit/check-pnpm-audit.mjs`. The policy fails on every
high or critical advisory without an exception path. The raw `pnpm audit` exit
code is not used directly because lower-severity records remain review input;
the policy parser validates the report shape and applies the release threshold.

The nightly workflow also archives machine-readable `pnpm outdated` and audit
reports without modifying the lockfile, and asserts that the dependency scan
did not rewrite any package manifest. Available updates are review input, not
authorization for an unattended upgrade.

The workspace, CI, and production runtime use exact Node.js `22.23.1`. Both production Dockerfiles pin the supported
multi-architecture `node:22.23.1-bookworm-slim` index to
`sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3`; the Dockerfile frontend is also digest-bound.
The Node index digest was resolved from Docker's publisher registry and checked against the returned manifest bytes on
2026-08-02. Updating a tag or digest requires recording and reviewing the replacement, rebuilding the standalone app,
and rerunning the container gates.

The release workflow starts that already-built image as the non-root user with every Linux capability dropped,
`no-new-privileges`, and a read-only root filesystem. `container-smoke.mjs` requires Docker health to become healthy,
probes `/healthz`, `/`, `/mine`, `/redeem`, and `/admin`, validates application markers, and enforces the production CSP,
HSTS, anti-framing, content-type, referrer, permissions, and framework-disclosure header policy. `/healthz` is only a
process liveness contract; it deliberately does not claim chain, indexer, or deployment readiness.

`scripts/release/container-security-policy.json` pins the official Syft `1.50.0` and Grype `0.116.1` images by full
multi-architecture digest. The workflow exports the exact local image with `docker save`; Syft receives only that
read-only archive and its evidence directory under `--network none`, never the Docker control socket. Syft emits both
native and SPDX JSON SBOMs for the exact Linux/amd64 image ID. Grype scans the
archived native SBOM with a current database, and the local checker rejects a malformed or image-mismatched SBOM, a
scanner-version mismatch, an invalid database, a database older than 72 hours or more than 15 minutes in the future,
any ignored match, any package lifecycle alert, or any High/Critical match. There is no exception path. The raw SBOMs,
raw Grype report, database status, policy, smoke result, and hash-bound summary are included in checksummed candidate
evidence. A separate always-run artifact preserves partial raw evidence when the gate fails. The database refresh is a
read-only network input to the vulnerability gate; it does not publish an image or change the source checkout.

The SDK's bundled Uniswap v4 helper preserves esbuild-recognized third-party
legal comments in `dist/v4.js.LEGAL.txt` and links that file from `dist/v4.js`.
The SDK build fails if either the link or notice file disappears. This is a
distribution safeguard, not a substitute for counsel approving the repository's
final `LICENSE` and complete `NOTICE` before any package is published.

## Hash-bound dependency-license inventory

`packages/contracts/audit/dependency-license-inventory.json` is the generated
Linux x64 release inventory; the adjacent `.darwin-arm64.json` inventory is the
local macOS engineering counterpart. Each contains every normalized installed
package entry, the exact entry-set digest, pnpm/workspace-configuration hashes,
license-group counts, and the derived set whose license is unknown, copyleft, or
outside the checker's narrow permissive allowlist. `run-static.sh` selects the
inventory for the running platform and regenerates it from the frozen installed
graph, so a fabricated or omitted entry cannot hide behind a hand-written digest.
Unsupported platforms fail closed.

Each platform has a matching review policy. The unsuffixed Linux x64 inventory
and policy are the release inputs; the Darwin pair is local evidence only. A
policy binds the exact inventory, `pnpm-lock.yaml`, platform, and
`pnpm-workspace.yaml` bytes by SHA-256 and requires one exact disposition for
every review-required name, license expression, and version set. The committed
workspace installs the explicit Darwin/Linux, arm64/x64, glibc/musl optional
artifact union so native packages are available for deterministic inventory
generation; the target filter records only the selected platform graph.

The committed policy is deliberately `inventory-baselined`. Every current
review-required entry is recorded as `needs-counsel` with an `undetermined`
release relevance. This is an explicit engineering disposition, not a legal or
distribution approval. It lets ordinary PR/static checks enforce completeness
and drift without pretending that owner or counsel review has occurred. A
lockfile, workspace configuration, platform, or inventory byte change; a new,
missing, or falsified dependency entry; a stale/duplicate disposition; a
classification mismatch; malformed metadata; a future review date; or
placeholder/nonapproval language fails the check. The full `pnpm licenses`
output remains a supplemental raw CI artifact, while the generated inventory is
the enforced platform record.

Release readiness applies a separate rule to the Linux x64 policy. It must be
`approved`, carry a nonfuture exact review date and non-placeholder reviewer
identity, and contain no
`undetermined`, `needs-counsel`, or `blocked` release-relevant disposition.
Resolved entries must pair consistently: `allowed` with `release`, `dev-only`
with `development-only`, or `not-distributed` with `not-distributed`. Changing
those fields is an owner/reviewer decision. Neither the inventory generator nor
the checker determines license compatibility, distribution scope, or legal
sufficiency.

The 2026-08-01 remediation reduced the audit from 1 critical, 33 high, 43
moderate, and 8 low vulnerability occurrences to 0 critical, 0 high, 2
moderate, and 3 low occurrences. The root `pnpm.overrides` entries are scoped
to the immediate dependency that needs the patched version. Do not widen them
to global overrides without rerunning the affected package's complete build and
test suite.

## Patched Graph CLI archive extraction

Status: remediated; no dependency-audit exception remains.

- Dependency path: `packages__subgraph>@graphprotocol/graph-cli>decompress`
- Installed versions: `@graphprotocol/graph-cli@0.98.1` and the maintained
  `@xhmikosr/decompress@11.1.3` replacement
- Critical advisory: CVE-2026-53486 / GHSA-mp2f-45pm-3cg9
- Moderate advisory: CVE-2026-10732 / GHSA-h39j-r5qq-r9mm
- Resolution: a dependency-edge-scoped pnpm alias replaces only Graph CLI's
  abandoned `decompress` package with its API-compatible maintained fork
- Verification: subgraph codegen, fixture-bound dry-run build, and all ten
  Matchstick tests pass with the replacement; `pnpm audit` reports no high or
  critical advisory

`@graphprotocol/graph-cli` remains a subgraph-only devDependency and is not
bundled into the web application, SDK, deployed subgraph, or Solidity bytecode.
Keep the edge override until Graph CLI itself adopts the maintained package or
another upstream release removes the abandoned dependency, then rerun the same
subgraph and audit evidence before removing it.

## Other residual advisories

These lower-severity paths were not forced across unsupported major-version
boundaries. Revisit them when their immediate parents publish compatible
updates.

| Severity | Package          | Exact audit path                                                                                                                                         | Disposition                                                                                        |
| -------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Moderate | `uuid@9.0.1`     | `apps__web>wagmi>@wagmi/connectors>@gemini-wallet/core>@metamask/rpc-errors>@metamask/utils>uuid`                                                        | A fix requires `uuid>=11.1.1`; do not force a two-major upgrade through the wallet connector tree. |
| Moderate | `uuid@8.3.2`     | `apps__web>wagmi>@wagmi/connectors>@metamask/sdk>uuid`                                                                                                   | A fix requires `uuid>=11.1.1`; do not force a three-major upgrade through MetaMask SDK.            |
| Low      | `cookie@0.4.2`   | `packages__contracts>hardhat>@sentry/node>cookie`                                                                                                        | Hardhat-only tooling path; the fix crosses pre-1.0 minor versions in Sentry's dependency tree.     |
| Low      | `elliptic@6.6.1` | `packages__contracts>@nomicfoundation/hardhat-toolbox>@nomicfoundation/hardhat-network-helpers>ethereumjs-util>ethereum-cryptography>secp256k1>elliptic` | No patched version is reported; Hardhat test-tooling path only.                                    |
| Low      | `diff@7.0.0`     | `packages__contracts>hardhat>mocha>diff`                                                                                                                 | The fix requires the next major (`diff>=8.0.3`); wait for Mocha/Hardhat compatibility.             |
