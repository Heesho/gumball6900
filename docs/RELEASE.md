# Release Candidate Pipeline

Status: fail-closed engineering-evidence pipeline. It does not publish packages or sites, deploy a subgraph, submit
Blockscout verification, transfer roles, fund genesis, sign a manifest, or broadcast a mainnet transaction.

## Invocation contract

`.github/workflows/release.yml` accepts exactly two operator inputs:

- a strict `vMAJOR.MINOR.PATCH[-PRERELEASE]` annotated tag; and
- a normalized, tracked, repository-relative JSON path to the signed `release-approved` deployment manifest.

The first job resolves `refs/tags/<tag>` through the GitHub Git Data API. A lightweight tag, nested tag, unsigned tag,
signature GitHub does not mark `verified` with reason `valid`, non-SemVer name, or tag object that does not point directly
to a commit fails before release work starts. The verified tag must peel to an evidence commit `E` with exactly one
parent: the reviewed source/build commit `C`. For schema v1, `E` may differ from `C` only by adding the signed manifest
and its two declared, raw-SHA-256-bound deployment-config/state JSON snapshots as regular, nonexecutable `100644`
blobs. Permissioned schema v2 may add exactly three more manifest-declared JSON blobs: the permissioned graph,
reproducible official-source build, and Robinhood fork rehearsal. Renames, mode changes, symlinks, replacements, and
any other tree change fail. The manifest's
`release.gitCommit` must equal `C`, and `C` must equal the protected-main workflow SHA for this run. Release metadata
records `C`, `E`, and the annotated tag object separately.

Operators must dispatch the workflow from protected `main` and supply the release tag only as data. Before any external
action runs, an action-free shell guard requires the GitHub event and workflow refs to identify `refs/heads/main`,
requires GitHub to report that ref as protected, and requires the event SHA to equal the workflow-definition SHA. The
resolver separately resolves the annotated tag through the GitHub API to obtain `E`; no workflow code from `E` executes
before the trusted control workflow has validated its restricted data-only diff. The resolver also requires `E`'s sole
parent `C` to be that exact protected workflow SHA, so an older or divergent source suite cannot be paired with current
control validators. A dispatch from a tag, unprotected branch, or alternate workflow ref fails closed.

The resolver checks out the exact workflow SHA as a control-tool worktree and checks out `E` into a separate directory.
Its tracked-tree, registry, and preparation commands are loaded only from the control worktree and receive the `E`
directory as data. The protected authorization job repeats the same split before dependency installation. Archive-RPC
secrets are step-scoped and are absent from checkout, diff validation, registry fetch, preparation, and `pnpm install`.
The authorization install uses `--ignore-scripts`, and action-free Git checks re-prove the control checkout before any
subsequent trusted validator or credentialed fork step.
`GITHUB_REF_PROTECTED` proves only that some branch rule applies; the launch checklist separately requires the reviewed
`main` ruleset to prohibit force pushes/direct unreviewed changes and to require the intended CODEOWNERS approvals.

The manifest path is handled as data, never interpolated as shell code. `scripts/release/prepare-release.mjs` rejects
absolute paths, backslashes, dot/parent/empty segments, non-JSON files, symlinks or symlink ancestry escaping the checkout,
and files not tracked by `E`. It also loads the fixed
`packages/config/deployments/release-manifest-signature-policy.json` trust root. The manifest and policy must be regular,
nonexecutable `100644` blobs in `E`, and the policy blob must be byte-identical in `C` and `E`. Their current raw bytes
must hash to those exact Git blob IDs; filters, replacement refs, inherited Git redirection, index flags, and filesystem
symlinks cannot substitute different bytes. The checkout `HEAD` and Git-reported real root must match the intended
commit and workspace.

The committed policy is strict and must have `state: "configured"`, a nonzero `policyId`, and separate positive
`security`, `economics`, `legalCompliance`, `operations`, and `release` signer-role quorums. Every role uses unique,
nonzero EOAs and membership cannot overlap between roles, so one signer cannot satisfy multiple organizational review
domains. The manifest's `signaturePolicy` must be the exact ordered flattening and aggregate threshold of those committed
role quorums; the manifest cannot authenticate its own signer set. Preparation performs the early
identity/status/tag/source-evidence/gate and trust-root checks; the config package then runs in required-release-evidence
mode and performs full schema, canonical-payload, signature-recovery, authorized-signer, and per-role quorum validation.
Every evidence record on a passed manifest gate must carry a nonzero digest and a durable HTTPS, IPFS, or Arweave URI.

The resolver snapshots the manifest and policy from `E`. Build gates install dependencies and prove the complete
tracked raw tree at `E`, validate those release inputs, then detach to `C` and prove its complete tracked raw tree before
building. Readiness, fork, and security jobs operate on `C`. Immediately after every dependency or analyzer install,
the workflow first requires clean Git worktree/index diffs and then verifies every tracked path's type, mode, and raw blob
identity; ignored generated outputs are allowed. Final raw-tree proofs also run after build, fork, and static-analysis
processes before their evidence is packaged. Every reusable GitHub Action across the PR, main, nightly, and release
workflows is pinned to the full commit resolved from its reviewed upstream tag; the adjacent tag comment is descriptive
and never the executable reference.

After proving E, the resolver makes one read-only request to the exact official Robinhood `/rhj/assets` URL. It archives
the raw response and a deterministic `preliminary` revalidation artifact bound to the reviewed stock candidate, signed
config/manifest bytes, candidate pin, release observation, policy, C, E, tag, and tag object. Preliminary evidence is
always `authorizationEligible: false`. Build and fork jobs download and revalidate those exact bytes; they do not refetch
or silently create a newer candidate.

## Independent gates

After tag resolution, these jobs run independently so a legal-readiness failure does not suppress technical evidence:

1. **Release readiness** requires substantive canonical UTF-8, owner/counsel-approved `LICENSE` and `NOTICE` bytes, a
   positive README License section tied to their configured SPDX identifier and links, a concrete private
   GitHub private-advisory endpoint in `SECURITY.md`, expressed on a standalone `Private reporting endpoint:` line as
   exactly `[Open a private vulnerability report](EXPECTED_URL)` or `<EXPECTED_URL>` outside front matter, comments,
   code, and raw HTML, and bound to exactly
   one untrimmed, NUL-delimited, no-include raw GitHub `origin` repository value (with operational ownership, repository
   existence, and end-to-end channel testing remaining human release requirements). The reporting field must be the
   policy's only bracket/angle construct so it cannot be nested in another Markdown element. Readiness also requires the
   exact approved canonical PNG at
   `apps/web/public/brand/gum-ball-6900-logo.png`. The fixed repository-license/NOTICE policy
   binds both text-file SHA-256 values and review metadata; the fixed logo-provenance policy binds the PNG SHA-256 and
   source/rights review. The fixed Linux x64 dependency-license policy must be `approved`, remain bound to the exact
   lockfile, workspace configuration, platform-derived full inventory, and contain no undetermined or blocking release
   disposition. The release-manifest signature policy
   and Robinhood testnet fork evidence must also be configured. A missing, malformed, hash-mismatched, unapproved, or
   `unconfigured` input is a hard blocker. The machine-readable report is archived even on failure.
2. **Build and container gates** install exact Node.js, pnpm, Python/pytest, and Foundry versions; use the frozen workspace lockfile;
   validate the signed manifest; test the release tooling and dependency-exception policy; compile Foundry and Hardhat
   twice and compare sorted artifact hashes; build the deployable web output twice with a commit-bound build-ID input and
   compare its complete raw inventory while securely retaining only pass A's Next.js build-local cryptographic cache for
   pass B; prove shared bytecode parity; run formatting, lint, typecheck, all workspace builds/tests, SDK/subgraph ABI
   checks, Forge and Hardhat coverage, gas snapshot generation, a manifest-resolved production subgraph build, Matchstick
   coverage, export fixed-name Forge/Hardhat LCOV artifacts and deterministic summaries into the audit-report surface,
   generated contract-doc build, Storybook, the available Playwright suite, and a production container built from the
   already-compared web output. The container then runs non-root under a read-only/capability-dropped boundary while a
   fail-closed smoke probe checks liveness, key routes, unique CSP nonces, and the complete production security-header
   baseline. Digest-pinned Syft and Grype images generate native/SPDX SBOMs, scan the exact image ID with a fresh valid
   database, and enforce zero High/Critical findings, ignored findings, or package lifecycle alerts. Scanner/database
   retrieval is the only read-only network portion of this gate; no image is pushed and no release is published.
3. **Fork gates** require both `ROBINHOOD_MAINNET_ARCHIVE_RPC_URL` and `ROBINHOOD_TESTNET_ARCHIVE_RPC_URL` repository
   secrets. Mainnet derives its exact block/hash and all 88 schema-v1 or 92 permissioned-schema-v2 fork-context fields
   only from the fresh signed
   manifest, hash-bound config, and validated candidate pin through a deterministic context exporter, never a workflow
   or Solidity constant. The preliminary late-registry bytes are independently revalidated before the verifier may use
   that pin; the offchain fetch does not claim a new onchain block.
   The gate validates the three schema-v1 or six schema-v2 exact E blobs, checks out and compiles C, and verifies every
   nonexternal deployment's
   artifact, ordered constructor encoding, creation transaction/receipt, runtime code, roles, graph, and settled backed
   genesis at that historical block; the CREATE2 hook also re-derives its canonical deployer input and address. Testnet
   loads its exact nonzero block, parent-block hash,
   USDG/WETH/PoolManager/PositionManager/Permit2 addresses, and runtime code hashes only from the committed
   `robinhood-testnet-fork-evidence.json` file in source commit `C`; its observation must be current and its validity
   window is capped at 24 hours. The fork asserts that the exact signed block timestamp is no later than `observedAt`
   and no more than 15 minutes older. A live header check at the fork gate and again after protected approval re-reads
   the exact block hash around a fresh canonical head, requires at least 64 descendant blocks, and rejects a head more
   than five minutes stale. The signed release manifest binds `C`, so mutable
   repository variables cannot change fork facts for the same tag. Any missing or unconfigured input fails; neither
   suite can silently use latest state or omit dependencies. Evidence archives the non-secret build-bound snapshot
   without recording credential-bearing URLs.
4. **Security evidence** runs CodeQL with GitHub code-scanning upload enabled, archives the action's validated
   post-processed SARIF, installs the pinned static toolchain, and reruns Slither, Aderyn, Semgrep, Solhint, Gitleaks,
   contract sizes, storage layouts, dependency audit-policy enforcement, and license inventory. Raw reports, the reviewed
   finding register, toolchain lock, analyzer-environment policy, and checksums are archived even when a finding blocks
   the job. Candidate authorization additionally requires that policy to bind a reviewed hermetic Linux/Python analyzer
   graph; the checked-in non-hermetic sentinel intentionally blocks release until hash-complete locks or immutable
   analyzer images exist.
5. **Deep candidate campaigns** checkout source commit `C` directly and rerun the 100,000-case Foundry fuzz profile,
   deep invariants, 100-year differential economics, Echidna, Medusa, and selected Mythril targets with exact toolchain,
   workflow/run, `C`, and evidence-commit `E` identity. Their logs, policies, fixtures, tool versions, and sorted checksums
   are retained for 365 days. The analyzer dependencies are prepared but await independent review, and Mythril-incompatible runtime templates fail
   closed; an ordinary scheduled-nightly artifact cannot be substituted for this release-tag-bound evidence.
6. **Candidate authorization** is protected by the `release-approval` GitHub environment and runs only after every prior
   job, including both source-`C` deep campaigns, succeeds. After approval it refetches the official registry and archives
   a distinct `protected-final` artifact plus exact raw response. Only this stage can be authorization eligible; expiry,
   source substitution, identity drift, or candidate/config/manifest/tag linkage drift fails. An independent exporter
   must validate those exact bytes before it emits the 88 schema-v1 or 92 schema-v2 signed fork inputs; the job then
   runs the complete pinned mainnet fork suite, including proxy/control-plane identity and nonzero `transfer`/`transferFrom` balance-delta checks
   through all five selected stock-token runtimes, before its final live graph check.
   Synthetic fork balances do not establish a real holder's eligibility. The job performs no external publication,
   registry mutation, candidate write, broadcast, or persistent onchain state change.

`authorizationEligible: true` is a stage invariant, not a standalone attestation that GitHub environment reviewers
approved a run. Release acceptance must also verify that the checksummed protected artifact belongs to the successful
`release-approval` job for the recorded repository, workflow SHA, run ID, and attempt. A locally generated JSON file with
the same field is never authorization evidence.

The workflow executes the Playwright suite from source commit `C`. The release expectation in `docs/WEBAPP.md` and the
launch checklist is met only when that reviewed source commit contains and passes the full local
deployment/write-flow rehearsal.

## Hash-bound distribution and brand approvals

`packages/config/deployments/repository-license-notice-policy.json` starts as a minimal `unconfigured` sentinel. A
configured replacement is an approval binding, not a license generator. It must record:

- the exact lowercase SHA-256 and fixed path for both `LICENSE` and `NOTICE`;
- the operative SPDX identifier, licensor, licensed work, change date, change-license SPDX identifier, and additional-use
  grant metadata for the exact LICENSE bytes;
- a dated NOTICE review, reviewer or accountable review body, durable review reference, and an affirmative record that
  third-party notices were reviewed; and
- no unresolved or placeholder metadata.

The readiness checker compares the exact raw bytes with those hashes, requires substantive canonical UTF-8 text,
requires the approved license metadata to appear in the LICENSE itself, requires a positive README License section,
rejects future/placeholder review metadata, and requires the root package's `license` field to equal the approved
operative SPDX identifier. It does not decide whether terms are legally sufficient, whether a
dependency may be distributed, or what BUSL parameters should be. Those decisions remain owner/counsel inputs and must
be represented by the reviewed files and metadata before changing `state` to `configured`.

`packages/config/deployments/canonical-logo-provenance-policy.json` is likewise an `unconfigured` sentinel. A configured
record binds the exact canonical path and lowercase PNG SHA-256, the exact supplied `GUM_BALL_6900_LOGO.png` source
filename, durable source reference, an
affirmation that the supplied original was preserved, and dated reviewer/reference/scope metadata for approved usage
rights. Readiness requires a CRC-valid, legal-IHDR, non-interlaced, zlib-decodable PNG with valid scanline filters and an
exact policy hash match. It cannot infer authorship,
ownership, trademark status, or usage rights from image bytes, so those remain explicit owner/reviewer inputs.

Compute candidate hashes without modifying either source file:

```bash
shasum -a 256 LICENSE NOTICE apps/web/public/brand/gum-ball-6900-logo.png
```

The hashes are identifiers, not approvals. Do not configure either policy until the referenced review has actually
occurred and the exact files are final.

The dependency-license boundary is intentionally two-stage and platform-bound. Static engineering checks regenerate the
current Darwin arm64 or Linux x64 inventory from the installed frozen graph and accept its committed
`inventory-baselined` policy only when its platform/lockfile/workspace/inventory hashes and per-entry dispositions are
exact, so ordinary PRs detect dependency drift without requiring legal approval. Release readiness separately requires
the Linux x64 policy
to be `approved`, dated, attributed, and free of `undetermined`, `needs-counsel`, or `blocked` release-relevant entries.
The baseline currently records every review-required dependency as needing owner/counsel review; it does not make a
distribution decision. See `docs/DEPENDENCY_SECURITY.md` for the schema and update rules.

## Reproducibility and checksummed evidence

`scripts/release/package-offline-evidence.sh` creates normalized archives for source, contract artifacts, ABIs, SDK,
subgraph, web standalone output, Storybook, and generated contract docs. Generated-path archives use sorted paths, zero
timestamps, numeric ownership, and gzip without a timestamp; the source archive is deterministic `git archive` output
for `C`, with inherited Git configuration, replacement refs, and prompts disabled. Build ID and `SOURCE_DATE_EPOCH` also
derive from `C`; the manifest, deployment config/state, and policy snapshots derive from `E`. The evidence includes:

- the exact signed deployment manifest and its SHA-256;
- the exact raw deployment-config and deployment-state snapshots, their repository paths, and manifest-bound SHA-256
  values, plus the signed observation block/hash/time/expiry;
- the fixed release-manifest signature-policy path, policy ID, and exact policy SHA-256;
- the preliminary late-registry artifact, exact raw official response, fetch/expiry time, selected-record and source
  digests, candidate pin, and complete release linkage; this offline artifact is explicitly nonauthorizing;
- annotated tag object, source commit `C`, evidence commit `E`, manifest path, chain ID, and `C`-derived
  `SOURCE_DATE_EPOCH`;
- source and two-pass Foundry/Hardhat artifact hashes;
- two-pass web standalone/static/public/BUILD_ID reproducibility hashes;
- byte-for-byte cross-tool creation/runtime bytecode parity;
- release-resolved subgraph addresses and start blocks derived from the manifest;
- gas, fixed-name Forge/Hardhat LCOV plus deterministic coverage summaries, audit finding/tool-version, lockfile,
  container digest/smoke evidence, native and SPDX SBOMs, raw Grype/database records, and the enforced vulnerability
  summary; and
- `SHA256SUMS` covering every packaged file except the checksum file itself.

The container-security files are also uploaded independently with `if: always()` so a blocking scan does not erase its
raw diagnostic evidence. The SDK/ABI/subgraph/web archives are candidate evidence, not published releases. Their metadata explicitly records that
no package, verification request, deployment, or mainnet transaction was sent.

Next.js creates fresh preview/signing/encryption values even when this application has no draft-mode routes or server
actions. Pass A generates that material normally. The workflow copies only Next.js's private `.previewinfo` and `.rscinfo`
cache records into the otherwise-clean pass B build, never prints or uploads the cache records separately, and then
requires every raw deployable byte and path to match. The records are candidate-specific entropy, so this is an exact
two-build reproducibility claim for one candidate, not a claim that separate workflow invocations produce identical
cryptographic material. The raw web archive is covered by the candidate's `SHA256SUMS`, and the container is built from
the same already-compared bytes and recorded by image digest. This avoids deriving public cryptographic material from the
Git commit or introducing an undeclared release credential.

## Protected external stages

The following stages intentionally have no credentials, destination IDs, or automatic jobs in this repository:

1. publish the ABI and SDK packages to the approved registry;
2. submit and independently confirm every Blockscout source verification;
3. deploy the reviewed subgraph to the selected production indexer;
4. deploy the checksummed web artifact to the selected production host; and
5. publish the manifest, source/evidence hashes, audits, role holders, operational contacts, and support/status links.

Each stage requires explicit user/operator authorization, its own protected environment, a destination chosen outside
this source tree, and post-publication digest/state reconciliation. Mainnet contract deployment remains a manual,
separately reviewed signer ceremony and must never be added to this workflow. The in-repository deployment wrapper is
keyless and Safe-schedule-only; it rejects every nonlocal EOA phase.

## Current blockers

At repository baseline, release authorization is expected to fail because:

- final `LICENSE` and `NOTICE` approval is absent, their hash-bound review policy is `unconfigured`, and the README
  retains unresolved-license language; `SECURITY.md` is bound to the canonical repository's private-advisory endpoint,
  but feature enablement, monitored ownership, and an end-to-end response-path test remain operational launch gates;
- the fixed release-manifest signature policy is intentionally `unconfigured` and therefore cannot authorize any
  release-approved manifest;
- the fixed Robinhood testnet fork-evidence file is intentionally `unconfigured` until official dependencies, an exact
  block, and its parent hash are reviewed into source commit `C`;
- the canonical `apps/web/public/brand/gum-ball-6900-logo.png` source asset is present and byte-preserved, but its
  provenance and usage-rights policy remains `unconfigured` pending accountable review evidence;
- the Linux x64 dependency-license inventory is regenerated from the installed frozen graph and hash-bound alongside
  the Darwin engineering inventory, but the release policy remains `inventory-baselined` with every release relevance
  undetermined rather than owner/reviewer `approved`;
- the canonical GitHub `origin` is configured, but the workspace has not yet produced the required source commit,
  single-parent evidence commit, hosted GitHub-verified annotated release tag, or protected-branch/ruleset evidence;
- release archive-RPC secrets and reviewed production publication destinations are external configuration; and
- independent audit, economic, legal/compliance, testnet rehearsal, Blockscout, role-transfer, and operations evidence
  remains external and must be attached to the exact signed manifest.

Local, non-authorizing checks:

```bash
pnpm release:tools:test
pnpm release:readiness
```

The second command is supposed to fail while the documented brand-asset/provenance, license/NOTICE and dependency-license
review, security-contact, and release-policy blockers remain unresolved.
