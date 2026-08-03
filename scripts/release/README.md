# Release evidence format

The release-candidate workflow creates normalized, checksummed engineering evidence. It does not publish a package,
deploy a subgraph or website, verify a live contract, transfer a role, fund genesis, or broadcast a mainnet transaction.
It must be dispatched from GitHub-protected `main`; the annotated release tag and evidence commit `E` are untrusted data
until that control workflow proves their exact relationship and restricted tree diff. Workflow code from `E` is never
the root of trust for validating `E` itself. The resolver and protected authorization jobs keep exact control and
candidate checkouts separate and execute the control checkout's validators against the candidate directory. RPC secrets
are introduced only on the individual live-verification/fork steps, after candidate diff proof and a lifecycle-disabled
dependency install.

- `source-*.tar.gz` is sanitized `git archive` output for reviewed source/build commit `C`, compressed without a gzip
  timestamp. `C` must be the exact protected-main workflow SHA that dispatched the run. The verified annotated tag peels
  to single-parent evidence commit `E`, whose parent is `C` and whose sole tree changes are additions of the signed
  manifest and its two declared, raw-SHA-256-bound deployment config/state JSON snapshots.
- `contracts-*`, `abi-*`, `sdk-*`, `subgraph-*`, `web-*`, `storybook-*`, and `contract-docs-*` use sorted paths,
  zero timestamps, and numeric root ownership.
- `*-artifacts.sha256` and `web-pass-*.sha256` inventories permit independent two-build comparison.
  `contract-bytecode-parity.json` proves the current Foundry and Hardhat outputs agree byte-for-byte for every shared
  protocol artifact.
- The web builds share only pass A's Next.js build-local preview/server-action cache records; all other output is rebuilt
  after a clean. Raw deployable output must then match byte-for-byte. Those records remain candidate-specific entropy, so
  this is not a cross-invocation identity claim. Untouched raw web output remains in `web-*.tar.gz` and is covered by
  `SHA256SUMS`.
- `Dockerfile.web-artifact` packages only that already-compared standalone/static/public output; it does not perform a
  hidden third application build.
- `web-container-smoke.json` binds the exact local image ID and proves that its Docker healthcheck, process liveness,
  key protocol routes, per-request CSP nonces, production security headers, non-root user, and restricted runtime
  settings passed. `container-security-policy.json`, the native/SPDX SBOMs, raw Grype report/database status, and
  `web-container-vulnerability-summary.json` bind the same image to the digest-pinned Syft/Grype gate. High or Critical
  matches, ignored matches, package lifecycle alerts, stale/invalid database state, or malformed evidence fail closed.
  Syft scans a read-only `docker save` archive with networking disabled; it never receives the Docker daemon socket.
  These files are also uploaded through a separate always-run artifact so a failing severity gate preserves raw input.
- `release-metadata.json` separately binds the tag object, source commit `C`, evidence commit `E`, signed manifest digest,
  exact config/state paths and raw digests, signed observation, fixed release-manifest signature-policy path/ID/digest,
  chain, `C`-derived source-date epoch, and the late Robinhood registry stage/digests. Preparation accepts the three
  tracked evidence files and policy only when their current raw bytes are exact regular nonexecutable `100644` blobs in
  `E`, the policy is byte-identical in `C` and `E`, and the manifest policy equals the configured committed trust root.
  It separately requires the untracked late artifact and raw registry response to be fresh and exactly linked to those
  tracked bytes.
- `robinhood-registry-response.json` preserves the exact bytes fetched from the official `/rhj/assets` endpoint.
  `robinhood-registry-revalidation.json` binds its raw and prefixed SHA-256 values, the five canonical selected records
  and digest, fetch/expiry timestamps, candidate pin, signed observation, candidate/config/manifest raw digests, policy,
  commits, tag, and annotated tag object. The offline archive carries only the explicitly nonauthorizing `preliminary`
  stage. After environment approval, the workflow fetches and retains a distinct `protected-final` pair; only that stage
  can be authorization eligible. That field is not standalone proof of reviewer approval: acceptance also requires the
  checksummed artifact's provenance to the successful `release-approval` job and its recorded workflow/run identity.
- `subgraph-networks.json` is derived from the release-approved manifest and is build evidence, not a deployed endpoint.
- Fork evidence includes the exact committed Robinhood testnet fork snapshot from source commit `C` and the mainnet
  artifact/receipt/graph verification at the signed observation block from E; only credential URLs remain protected
  runtime secrets, while block ancestry, addresses, and bytecode hashes are build-bound.
- `forge-coverage.lcov`, `forge-coverage-summary.json`, `hardhat-coverage.lcov`, and
  `hardhat-coverage-summary.json` are validated fixed-name copies of the two contract coverage surfaces. The separate
  release security artifact contains `codeql-javascript-typescript.sarif`, captured from the CodeQL action's
  post-processed upload input. That artifact and the offline evidence include the analyzer-environment policy and, only
  for a configured policy, its three raw Linux x64 analyzer lock files. Candidate authorization recomputes each lock's
  SHA-256 from the exact tracked checkout and requires the Python analyzer graph to be release-hermetic.
- `SHA256SUMS` covers every evidence file except itself.

Candidate authorization also depends on two release-tag-bound deep artifacts. `deep-contracts-economics-*` records the
source-`C` 100,000-case Foundry profile, deep invariants, 100-year differential fixtures/charts, exact tool versions, and
checksums. `deep-external-security-*` records the source-`C` Echidna, Medusa, and selected Mythril campaigns plus their
exact policies and analyzer environment. Both bind `C`, evidence commit `E`, tag, workflow SHA, run ID, and attempt; a
scheduled nightly from another ref is not accepted as candidate evidence. The external campaign intentionally fails
while the committed analyzer environment remains non-hermetic or a selected Mythril target is incompatible.

The `release-approval` environment may hold a candidate while reviewers decide. After that approval is granted, the
authorization job checks out exact evidence commit `E` (not a mutable branch or tag target), re-proves its single-parent
relationship to source `C`, performs a fresh protected-final official-registry fetch, revalidates the signed
manifest/signature policy/snapshot hashes, selected stock identities, exact raw response, release linkage, and wall-clock
expiry, then
switches to exact `C`. Immediately before it prints an authorization result, a credentialed mainnet RPC re-reads the
signed observation header, reads the current head, and re-reads the signed header to detect a concurrent reorg. The
signed block timestamp may precede `observedAt` by at most 15 minutes, the block must have at least 64 newer blocks, the
current head may be at most 5 minutes behind the verifier clock and no more than 60 seconds ahead. Expiry is still capped
at 24 hours from `observedAt`, so a delayed environment approval cannot authorize unbounded stale evidence.

The offchain fetch has no onchain block of its own. Its `candidatePin` must reproduce the reviewed candidate's exact
block/hash/timestamp; the signed `releaseObservation` remains separately recorded. After approval, the context exporter
must validate the protected-final artifact and exact response bytes before the workflow runs nonzero balance-delta
`transfer` and `transferFrom` checks through all five selected token runtimes at that signed observation. The balances are
synthetically supplied inside the fork, so this is bytecode behavior evidence rather than proof of an existing eligible
holder. All registry collection and verification in this workflow is read-only and never broadcasts.

These thresholds are conservative fail-closed engineering gates, not a claim that 64 blocks proves Robinhood Chain
finality. A reviewed chain-finality policy may tighten them; changing them changes source `C` and therefore requires a
new evidence commit, signed manifest, annotated tag, and complete candidate run.

Package publication, Blockscout submission, production subgraph deployment, and production web deployment are separate
protected external stages. Their credentials and destinations are intentionally absent from this repository.
