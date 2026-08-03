# Mainnet Launch Checklist

Every checkbox is blocking. Local implementation completion does not satisfy external review, legal, deployment, or
operational evidence.

## Source and reproducibility

- [ ] Reviewed source/build commit `C`, evidence commit `E`, and the annotated tag object are immutable and recorded.
- [ ] The workflow is dispatched from protected `main`; before any external action, a failing guard proves GitHub's
      event and workflow refs identify `refs/heads/main`, GitHub reports that ref as protected, and the event SHA equals
      the workflow-definition SHA. The annotated tag is resolved separately as data to `E`; no workflow from `E` is
      trusted to validate its own restricted diff, and `E`'s sole parent `C` equals that exact protected workflow SHA.
- [ ] The effective `main` ruleset is independently reviewed and archived: direct and force pushes are disabled, the
      intended CODEOWNERS approvals and status checks are required, administrators cannot silently bypass it, and the
      release-control workflow files and validation scripts are in the protected review scope.
- [ ] The `release-approval` environment requires the reviewed independent approvers, prevents self-review and silent
      bypass, restricts deployment branches to protected `main`, and its successful job/run provenance is archived with
      the checksummed protected-final registry evidence. `authorizationEligible: true` is not accepted by itself.
- [ ] Every reusable action in every repository workflow is referenced by its reviewed full upstream commit SHA; no
      mutable branch, major-version, or release-tag ref is executable.
- [ ] GitHub marks the annotated SemVer tag signature verified; it peels directly to `E`, `E` has exactly one parent
      `C`, and `E`'s only tree changes from `C` are addition of the signed release-approved manifest plus its exact
      deployment-config and deployment-state evidence snapshots as three regular nonexecutable `100644` blobs. The
      manifest's `release.gitCommit` equals `C` and its raw SHA-256 descriptors bind both snapshots.
- [ ] The fixed committed release-manifest signature policy is configured with the reviewed nonzero policy ID, signer
      set, and threshold; its exact raw `100644` blob is byte-identical in `C` and `E`, the manifest is read from `E`,
      and the manifest's signer policy equals that trust root exactly.
- [ ] The fixed repository license/NOTICE policy is configured only after owner/counsel review and binds the exact
      `LICENSE` and `NOTICE` SHA-256 values, operative SPDX and BUSL change/additional-use metadata, and dated NOTICE
      review evidence; the root package declaration matches it.
- [ ] The Linux x64 dependency-license policy binds the exact `pnpm-lock.yaml`, `pnpm-workspace.yaml`, platform, and full
      generated installed-inventory hashes, contains one exact
      disposition for every unknown/copyleft/restricted entry, is `approved` with dated reviewer evidence, and has no
      undetermined, needs-counsel, blocked, stale, missing, or newly unreviewed release-relevant entry.
- [ ] Dependency/analyzer installs leave tracked source unchanged: clean worktree/index diffs and full raw-tree proofs
      pass at `E` before release-input validation and at `C` before and after builds/tests/scanners. Ignored outputs alone
      may be added.
- [ ] Clean-clone frozen install, format, lint, typecheck, build, and every workspace test pass from `C`; build ID,
      source archive, and `SOURCE_DATE_EPOCH` bind `C`, while manifest/policy snapshots bind `E`.
- [ ] Foundry and Hardhat compile identical Solidity source/settings; sizes, storage layouts, ABIs, gas snapshot, and
      build hashes are reproduced independently.
- [ ] 10,000-run fuzz, 1,000x500 invariants, nightly campaigns, coverage, adversarial tokens, economic differential,
      deployment rehearsal, and both Robinhood fork suites pass at recorded blocks.
- [ ] Slither, Aderyn, Semgrep, Solhint, Mythril, Echidna/Medusa, CodeQL, dependency, license, and secret reports are
      archived; every finding is resolved or has reviewed time-bounded justification.
- [ ] Python analyzers run from a reviewed hermetic Linux environment bound to one exact Python patch release and
      hash-complete transitive locks or immutable analyzer image digests; the analyzer-environment policy is configured.

## Independent review

- [ ] Independent final-commit smart-contract and deployment audit is complete and remediations are verified.
- [ ] Independent economic review covers mining demand scaling, genesis backing, auction bands/lots, range ladder,
      manager incentives, redemption, and mining-funded versus fee-funded buybacks.
- [ ] Audit scope, reports, findings, commit hashes, and reviewer attestations are public.

## Canonical external facts

- [ ] Chain ID, RPC/explorer metadata, USDG, WETH, wrapped BTC, every stock token, Permit2, PoolManager,
      PositionManager, Quoter, StateView, Universal Router, and code/proxy hashes are reverified from current primary
      sources.
- [ ] Every stock-token UID, decimals, symbol, multiplier, pending action, registry status, transfer behavior, and
      issuer/admin risk matches the signed manifest.
- [ ] Raw stock-registry collection output is independently reviewed into the fixed dated candidate path; the canonical
      candidate is a nonexecutable tracked file whose bytes and `source.observedAt` date validate against source commit
      `C`. The ignored `generated/` output is not a deployment input.
- [ ] Unresolved/provisional values have been replaced; manifests, code hashes, observations, and signatures pass the
      fail-closed validators.

## Legal and compliance

- [ ] Qualified counsel and relevant issuers approve GBX, mining, staking/signals, manager target-asset rewards,
      in-kind stock-token redemption, secondary trading, jurisdictions, terms, privacy, and sanctions controls.
- [ ] Deployment explicitly selects approved `PermissionedProductionMode` or documented
      `UnrestrictedProductionApproved`; unresolved/noop mainnet is rejected.
- [ ] Eligibility owner/signers, delay, fail behavior, alternate receiver, recovery/appeal, and pool trading behavior
      are documented and tested.
- [ ] External-token freeze/liveness, corporate actions, trading halts, and user disclosures are accepted in writing.

## Testnet genesis rehearsal

- [ ] Current testnet dependencies are official and verified; no mainnet address is reused by assumption.
- [ ] Exact testnet block, parent hash, dependency addresses, and runtime hashes are configured in the build-bound fork
      evidence file in source commit `C`; release jobs do not source those facts from mutable repository variables.
- [ ] Full seven-day-equivalent bootstrap, cap/minimum, sponsor excess/underfunding, refunds, atomic rollback, 80M
      claims, 20M single-sided positions, mining initialization, claims, signals, acquisitions, rewards, buyback,
      redemption, fees, sweep, and migration are rehearsed.
- [ ] PoolKey, hook bits/address, `sqrtPriceX96`, ticks, NFT owner, exact balances, backing identity, roles, and emitted
      events match independently generated expectations.

## Deployment ceremony

- [ ] Hardware/multisig signers, nonce plan, gas policy, CREATE2 salts, config hash, constructors, phased transactions,
      rollback/refund decisions, observers, and communications are reviewed in a dry run.
- [ ] Every live phase has a distinct unexpired threshold-signed deployment authorization binding the clean commit,
      trusted committed policy, chain, canonical config, exact predecessor state, Hardhat command family, phase,
      broadcaster, bounded nonce window, and single-use authorization ID.
- [ ] All operators use the same protected persistent replay ledger; its append-only history and authorization IDs are
      independently reconciled before the next phase.
- [ ] A separately reviewed keyless verifier hands off only to an immutable, reproducibly built key-bearing runner, so
      authorization and exact execution-byte proof occur before signer secrets enter the process trust boundary.
- [x] Repository EOA broadcast paths fail closed on nonlocal chains, and the chain-31337-only rehearsal proves
      secret-free preparation, reproducible runner-byte/call-plan binding, atomic replay refusal, late local key-file
      injection, and receipt-evidence binding without claiming production custody isolation.
- [x] An operator-only isolated production runner exists for deploy/execute/fund/settle, with localhost-fork-only
      keyless planning, a second threshold-signed exact-plan/anchor envelope, reproducible code/lock bindings, late
      key-file access, permanent replay/failure reservations, exact nonce/response checks, and receipt-bound successor
      state with exact registry, sponsor, supply, backing, and genesis-position assertions. It remains absent from CI,
      does not itself authorize or perform any production action, and leaves settled state provisional until the full
      signed-manifest verifier passes after finality.
- [ ] Each phase validates chain, config hash, code, roles, and predecessor receipts before proceeding.
- [ ] Asset/strategy registrations mature for seven days; no delay is bypassed.
- [ ] Genesis backer amount and community cap are independently reconciled before contributions open.
- [ ] Final atomic settlement is simulated immediately before execution.

## Post-deployment proof

- [ ] All contracts are verified on Blockscout and runtime hashes match the signed release manifest.
- [ ] Cumulative mint and supply are exactly 100M after genesis; GenesisClaims owns 80M and canonical positions account
      for the protocol-owned 20M subject only to documented Uniswap atomic rounding.
- [ ] Vault USDG equals observed community + required sponsor backing; sponsor excess returned; AllocationVoter
      notification is solvent.
- [ ] Distinct timelock and guardian multisigs match their typed, block-pinned Safe evidence and role bindings;
      eligibility authority matches disclosures; temporary deployer powers are closed or proven irrelevant.
- [ ] LiquidityManager owns every canonical NFT; no EOA, generic executor, or undocumented approval has custody power.

## Product and operations

- [ ] The approved canonical `apps/web/public/brand/gum-ball-6900-logo.png` is present as a CRC-valid, decodable PNG
      preserved from the exact supplied `GUM_BALL_6900_LOGO.png`, its
      SHA-256 matches the configured provenance policy, and source/preservation/usage-rights review metadata identifies
      the supplied original; no generated or textual substitute is used.
- [ ] SDK/ABI release, subgraph, web build, source hashes, addresses, support/status contacts, terms, and risks are
      published from the signed manifest.
- [ ] Candidate evidence checksums are independently reproduced before separately protected ABI/SDK publication,
      Blockscout verification, subgraph deployment, and web deployment stages are authorized.
- [ ] Production subgraph start blocks, reorg behavior, snapshots, and direct-read reconciliation pass.
- [ ] Playwright exercises all live user/admin flows against the deployed candidate; Storybook accessibility review and
      responsive/browser checks pass.
- [ ] RPC/indexer failover, monitors/alerts, key rotation, incident response, issuer escalation, backups, and public
      status communications are rehearsed.
- [ ] Monitoring covers supply, vault/budgets, weights/rewards, fills/splits, LP custody/fees, timelock/guardian,
      code/registry drift, multipliers, chain finality, and external token liveness.

## Final authorization

- [ ] Security, economic, legal/compliance, operations, and release owners sign the exact manifest and source commit
      `C`, with evidence commit `E` and its annotated tag recorded.
- [ ] The public deployment manifest is `release-approved` and all mandatory signatures validate.
- [ ] Release readiness and preparation both confirm the fixed release-manifest policy is configured and exact; the
      manifest does not self-authorize its signer set.
- [ ] No blocker, unresolved fact, expired exception, or unaccepted finding remains.

Mainnet deployment is manual and intentionally absent from CI.
