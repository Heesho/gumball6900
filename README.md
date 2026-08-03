# GUM BALL 6900

<p align="center">
  <img alt="GUM BALL 6900 logo" src="apps/web/public/brand/gum-ball-6900-logo.png" width="220" />
</p>

GUM BALL 6900 is an oracleless, community-managed onchain basket designed for Robinhood Chain. Users contribute
USDG to recurring mining epochs and receive GUM BALL 6900 (`GBX`). GBX is a direct, in-kind, pro-rata claim on every
registered raw asset balance in GumBallVault.

GBX holders may stake 1:1 into non-transferable Staked GUM BALL 6900 (`sGBX`) and persistently signal which approved
assets future USDG should accumulate. Normal acquisition strategies use bounded reverse Dutch auctions: 98% of each
target asset received goes to GumBallVault and 2% goes to active managers signaling for that strategy. The buyback
strategy accepts GBX for USDG and performs a real supply-reducing burn.

> **Not audited. Not deployed. Not ready for user funds.** This repository is an implementation workspace. Every
> provisional address and design assumption must pass the gates below before any testnet or mainnet launch.

## Fixed protocol commitments

- Maximum cumulative mint is 1,000,000,000 GBX; burns never reopen mint capacity.
- Genesis mints 80,000,000 GBX to community claims and 20,000,000 fully sponsor-backed GBX to protocol-owned
  single-sided Uniswap v4 liquidity.
- Redemption uses `GBXToken.totalSupply()` before burn and transfers the same raw-balance fraction of every
  registered vault asset.
- Signals allocate only future and newly notified USDG. They cannot sell or rebalance assets already held.
- sGBX can be unstaked immediately. New/increased signal weight has a 24-hour activation delay.
- State-changing protocol logic uses no external asset-price or NAV oracle.
- GumBallVault has no arbitrary execution, approval, lending, leverage, sweep, or rescue interface.
- Core contracts are non-upgradeable; there is no public factory or conventional DAO governance.
- Redemption, unstaking, settled claims, accrued reward claims, refunds, and real burns have no protocol pause.

## Repository baseline

```text
apps/web                 Next.js user application
packages/contracts       Shared Foundry and Hardhat Solidity source and tests
packages/config          Typed chain, asset, and external deployment manifests
packages/sdk             Bigint-only TypeScript SDK
packages/subgraph        Protocol indexing and Matchstick tests
packages/simulations     Python and TypeScript economic reference models
packages/ui              Shared user-interface components
docs                     Architecture, invariants, trust, threat, and decision records
```

The packages contain a local implementation and automated test baseline. Presence in the workspace still does not
imply independent review, a verified external deployment, or authorization for user funds.

## How the protocol works

### Mining and actual emission

Genesis is a capped seven-day USDG batch. Successful settlement mints 80 million GBX into beneficiary claims and 20
million GBX into protocol-owned Uniswap v4 positions. The liquidity backer escrows `ceil(community USDG / 4)`, so
the LP allocation has the same claim value per GBX as community GBX at the genesis clearing price. Backing transfer,
minting, mining initialization, pool initialization, position creation, and revenue notification are atomic. A
failed launch is permissionlessly refundable.

Recurring mining uses daily scheduled emissions with a four-year half-life, but the schedule is only a maximum. The
actual emission is the lesser of the schedule, remaining lifetime mint capacity, and GBX affordable from that day's
USDG at 95% of the previous endogenous mining reference. Empty and underfunded emission is forfeited; it never
carries forward. This prevents a nearly empty epoch from minting a full daily schedule.

### Liquid signals without a withdrawal lock

GBX stakes 1:1 into non-transferable sGBX. There is no seven-day lock: a user may unstake immediately, and the voter
reduces pending then active weight before returning GBX. New or increased signals wait 24 hours and require a
checkpoint, preventing same-block stake-and-reward capture. Reductions and resets take effect immediately after
reward checkpointing. Signals persist and direct only future notified USDG; they cannot sell or rebalance assets
already in GumBallVault.

### Oracleless acquisitions and manager rewards

Each approved target has a bounded reverse Dutch auction expressing target-token units per USDG. The rate starts at
125% of its reference and decays linearly to a nonzero 80% floor over 24 hours. Takers choose a lot within immutable
bounds, provide the target asset first, and set auction ID, deadline, and maximum-payment protection. GumBallVault
releases USDG only after observed target delivery and budget debit.

Managers with active signal weight share at most 2% of the acquired target; GumBallVault receives the remainder. If
weight is zero, the manager share is redirected to the vault. Rewards use high-precision accumulators, survive
unstaking, and cannot accept arbitrary external bribes. Buyback is a separate zero-reward auction: it receives GBX,
performs a real burn, and only then releases USDG.

### Redemption and total supply

Redemption burns GBX and transfers the same pre-burn fraction of every registered raw vault balance. The denominator
is `totalSupply()`, not a circulating-supply estimate, so staked, unclaimed, escrowed, wallet-held, and LP-held GBX
all count. Rounding dust stays in GumBallVault. No protocol role can pause redemption or skip a registered asset.

That unpausability cannot force an external issuer token to transfer: a frozen registered token can make the atomic
all-asset redemption revert until its issuer restores liveness. This is an explicit high-impact residual risk.

`GumBallRouter` adds narrowly typed EIP-2612 convenience paths for staking and basket redemption. It cannot select an
arbitrary target or calldata, cannot redirect a stake, clears downstream approvals atomically, and must restore its
pre-call GBX balance. Signal changes and unstaking remain direct identity-bearing calls (or future smart-account
batches), so the router is not a generic executor.

### Why the contracts are oracleless

Minting, signals, auctions, buyback, and redemption do not consume an external asset price or calculated NAV.
Genesis/mining batch history and auction fills provide endogenous references; Uniswap provides market execution;
redemption uses raw custody. Display APIs may estimate values but never alter state. Oracleless design avoids feed
manipulation and liveness dependencies while accepting stale references, thin liquidity, adverse execution, absent
market makers, and no contract-level guarantee that a buyback is accretive.

### Administration, stock tokens, and eligibility

ProtocolTimelock is a multisig-controlled allowlist of specific maintenance selectors, not a generic executor. The
guardian can stop only new exposure. Neither can mint, sweep the vault, redirect claims/rewards, seize balances,
transfer canonical LP NFTs to an EOA, or pause user exits.

Robinhood Stock Tokens introduce issuer, eligibility, market-hours, halt, corporate-action, proxy/admin, and legal
risks. Contracts custody and redeem raw ERC-20 balances; `uiMultiplier()` and REST corporate actions affect display
only. The five reviewed tokens share an upgradeable beacon. At the 2026-08-02 evidence pin, all 13 issuer roles were
held by direct EOAs without an onchain delay; those roles include upgrade, mint, arbitrary-address burn, account
blocking, and global/token pause authority. Registration and release tooling bind and recheck that control plane, but
cannot neutralize it, so issuer compromise remains a material backing and redemption-liveness risk. In permissioned
mode, mining checks the recorded beneficiary before accepting USDG, staking checks the staker
before accepting GBX, GBX checks ordinary transfers, manager rewards check their receiver, and redemption checks the
basket receiver. Mainnet remains blocked until counsel and issuers approve the eligibility and pool mode,
jurisdictions, terms, privacy/sanctions handling, and alternate-receiver policy.

The v1 `LaunchGuardHook` is intentionally initialization-only; manifest schema v1 therefore rejects release approval
in `permissioned-production` mode. The implemented schema-v2 successor uses `GumBallPermissionedHook`,
`PermissionedLiquidityManager`, and the bounded `AdapterVerificationEscrow`, plus source- and bytecode-bound official
Uniswap adapter, Permissioned Position Manager, Universal Router 2.2, and quoter dependencies. Schema v2 remains
fail-closed unless its signed manifest binds the exact graph, reproducible official-source build, and fresh Robinhood
testnet-fork rehearsal bytes and all ordinary release gates pass. Those real production evidence artifacts, external
reviews, and legal/issuer approvals do not yet exist in this repository, so mainnet remains blocked.
[ADR-0011](docs/adr/0011-permissioned-pool-successor-graph.md) records the boundary.

## Configuration status

`packages/config` separates chain metadata from asset and Uniswap v4 manifests.

- Robinhood mainnet (`4663`) and testnet (`46630`) chain metadata is typed.
- Specification-date USDG, WETH, and Uniswap v4 mainnet addresses are marked **provisional**.
- Mainnet AAPL, NVDA, QQQ, SPCX, and TSLA candidate addresses/UIDs were generated from Robinhood's live `/rhj/assets`
  registry on 2026-08-01 and remain **provisional**.
- Mainnet wrapped BTC has a dated, exact-block, bridge-derived candidate binding its token, beacon, bridge proxy
  implementations, shared ProxyAdmin, upgradeable role-based owner, and runtime hashes; it remains **provisional**
  and is not deployment approval.
- Testnet USDG and WETH plus Permit2 are recorded from current official sources as **provisional**; wrapped BTC,
  stock-token deployments, and the remaining testnet v4 contracts remain **unresolved**.
- Neither provisional nor unresolved data is deployment authorization.

Deployment automation must re-query official primary sources, validate chain ID, active status, identity, bytecode
and code hash, token interfaces and transfer behavior, stock-token UID/multiplier, and Uniswap compatibility. It must
fail closed and produce a signed, public, machine-readable verified manifest.

## Development

Prerequisites:

- Node.js `22.23.1` (exact; the supported release runtime and CI version)
- pnpm `10.14.0` (exact; dependency-license evidence is package-manager-version-bound)
- Python `3.11.9` with the exact pytest toolchain in `packages/simulations/requirements-dev.lock`
- Foundry compatible with the pinned Solidity toolchain
- Archive-capable Robinhood RPC credentials for fork and production workloads

Typical workspace commands:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm typecheck
pnpm build
pnpm test
pnpm contracts:compile
pnpm contracts:test
```

Useful deeper checks include:

```bash
pnpm contracts:test:hardhat
pnpm contracts:coverage
pnpm simulations:test
pnpm simulations:fixtures:check
pnpm subgraph:test
pnpm web:test
pnpm web:test:e2e
pnpm docs:check
pnpm audit:static
```

These commands are test targets, not a release claim. Static/nightly scripts install repository-pinned analyzers and
archive evidence under `packages/contracts/audit/reports`.

## Deployment and contract addresses

Deployment is phased: deploy/wire, queue seven-day registry operations, execute mature operations, fund/open genesis,
and settle genesis. The Hardhat runner persists chain/config-bound phase state, refuses a phase-one state-file
overwrite, and resumes individual scheduling/execution operations from recorded receipts. The Foundry scripts are
manual, one-shot phase entrypoints: they do not implement safe automated resume and must not be rerun after a partial
broadcast without independent receipt and onchain-state reconciliation. Mainnet deployment is manual; CI never sends
it.

Deployment configs are strict version-1 artifacts with an exact protocol identity and network chain/name pair; unknown
fields and authorization/config/provider network mismatches fail closed. The in-repository nonlocal wrapper is keyless
and Safe-schedule-only. `pnpm contracts:deploy:testnet -- ...` pins an unsigned schedule proposal to chain `46630` and
rejects every EOA broadcast phase. The schedule path captures block-pinned Safe control-plane evidence and produces a
deterministic Safe Transaction Builder batch; it never requires a private key equal to the Safe. The signed
authorization, config, prior state, complete Safe evidence, timelock operation calldata, per-call hashes, and bundle
checksum/hash are bound in that artifact. Rerunning with fresh evidence reconciles already-queued operations before
state advances. Mature timelock execution remains permissionless but must use a separately reviewed external ceremony.

For chain-31337 engineering evidence, `pnpm contracts:prepare:local -- ...` simulates an exact phase inside a reverted
EVM snapshot and emits a local-only preparation artifact plus a byte-reproducible standalone runner. The artifact binds
runner bytes, config/state, local unsigned authorization, anchor block, nonce window, and every call's calldata/value.
The runner refuses nonlocal chains and emits bound receipt evidence. This does not authorize or enable production keys.
`pnpm contracts:verify:testnet` and `pnpm contracts:verify:mainnet` select their matching Hardhat networks explicitly;
explorer submission remains a separately authorized external action.

No GUM BALL 6900 contract is deployed yet. Canonical external addresses in `packages/config` are either provisional
or unresolved and are not authorization:

| Environment               | Protocol contracts | External dependency status                                                           |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| Robinhood mainnet (4663)  | Not deployed       | Mainnet USDG/WETH/v4, stock, and bridge-derived WBTC candidates provisional          |
| Robinhood testnet (46630) | Not deployed       | USDG/WETH/Permit2 provisional; wrapped BTC, stocks, and v4 core/periphery unresolved |

A release-approved signed manifest must publish every protocol/external address, bytecode hash, constructor, role,
transaction, start block, source commit, compliance mode, verification link, and the exact policy ID/signer quorum from
the committed release-manifest trust root. That trust root is currently an explicit unconfigured release blocker.

## Deployment gates

Every item is blocking. A release owner must publish the evidence, reviewer, commit, and manifest hash for each gate.

### 1. Specification and economic gate

- [ ] Supply, genesis backing, recurring emission, redemption, allocation, reward, buyback, and LP invariants are
      implemented and mapped to automated tests.
- [x] Solidity matches the independently generated Python/TypeScript daily schedule digest for every epoch from day 0
      through day 36,500, with long-horizon supply checkpoints retained as readable vectors.
- [ ] Bootstrap and LP simulations justify minimum raise, contribution cap, sponsor maximum, `P0`, and range ladder.
- [ ] Auction simulations justify lot sizes, initial rates, hard reset bounds, and market-maker assumptions.
- [ ] Independent economic review is complete and all findings are resolved or publicly documented.

### 2. Build and verification gate

- [ ] A clean clone installs with a frozen lockfile and passes formatting, typecheck, build, and all package tests.
- [ ] Foundry and Hardhat compile the same Solidity source with the exact settings in
      [ADR-0004](docs/adr/0004-solidity-pin-and-contract-wiring.md).
- [ ] Unit, 10,000-run critical fuzz, stateful invariant, differential, integration, adversarial-token, gas,
      deployment, hook/v4 lifecycle, Robinhood testnet fork, and mainnet fork suites pass.
- [ ] Nightly 100,000-run fuzz, deep invariant, Echidna or Medusa, selected Mythril, long-horizon simulations, and the
      confirmation-lagged read-only Robinhood mainnet reconnaissance fork pass.
- [ ] Reproducible build, contract-size, ABI-diff, storage-layout, coverage, and gas-snapshot artifacts are published.

### 3. Audit and security gate

- [ ] Slither, Semgrep, and Mythril execute in a reviewed hermetic Linux environment bound to an exact Python patch
      release and hash-complete transitive dependency locks or immutable analyzer container digests.
- [ ] Slither, Aderyn, Semgrep, Solhint, CodeQL, dependency, license, secret, and package-audit findings are resolved or
      have written, reviewed justifications.
- [ ] The digest-pinned production image passes the non-root/read-only route and security-header smoke gate; its
      native/SPDX SBOM and current Grype evidence contain no High/Critical match, ignored match, or package lifecycle
      alert under `scripts/release/container-security-policy.json`.
- [ ] An independent smart-contract audit covers the complete deployed source, external integrations, deployment
      scripts, role wiring, v4 hook, and invariant harness.
- [ ] Audit remediations are retested and independently confirmed; final reports and exact commit hashes are public.
- [ ] The threat model and incident runbook include prevention, detection, and recovery for every listed permissionless,
      privileged, and external-dependency threat.
- [ ] The high-impact external-token redemption liveness risk in
      [ADR-0003](docs/adr/0003-external-token-redemption-liveness.md) is explicitly accepted by security, economic,
      and legal reviewers.

### 4. Network and manifest gate

- [ ] Current chain IDs, explorer/RPC metadata, canonical USDG/WETH, wrapped BTC, stock-token identities/status/UIDs,
      and every Uniswap v4 address are reverified from current official sources.
- [ ] Runtime bytecode and code hashes at every external address match the signed manifest; deployment fails closed on
      any missing code or mismatch.
- [ ] Robinhood mainnet and testnet forks prove the pinned Cancun/v4 behavior and token transfer semantics at exact
      nonzero blocks; the real mainnet v4 suite covers bidirectional swaps, fee routing/burn, terminal sweep, and
      timelocked canonical migration.
- [ ] CREATE2 salts, hook permission bits, PoolKey, token ordering, `sqrtPriceX96`, aligned ticks, constructors, and all
      position amounts are independently reproduced.
- [ ] The complete genesis transaction is rehearsed on Robinhood testnet, including failed-launch refunds and atomic
      rollback at every launch step.

### 5. Legal and compliance gate

- [ ] Qualified counsel and each relevant issuer approve the production handling of Robinhood Stock Tokens, GBX,
      mining, staking, manager rewards, in-kind redemption, and secondary trading.
- [ ] The deployment explicitly selects `UnrestrictedTestMode` or reviewed `PermissionedProductionMode`; unrestricted
      mainnet is forbidden unless counsel and issuer requirements explicitly permit it.
- [ ] Production eligibility rules, registry owner, signer threshold, change delay, fail behavior, eligible alternate
      receiver policy, jurisdiction messaging, sanctions/privacy handling, terms, and risk disclosures are approved.
- [ ] The canonical v4 pool uses an audited compliant architecture whenever permissioning is required.
- [ ] Legal approval explicitly addresses external-token freezes, account-level redemption eligibility, corporate
      actions, trading halts, and the fact that protocol-level unpausability cannot guarantee issuer-token liveness.

### 6. Access-control and custody gate

- [ ] All core contracts are direct, non-upgradeable deployments with immutable or permanently closed set-once peers.
- [ ] The ProtocolTimelock exposes only target-side bounded maintenance; no generic executor has vault, mint, reward,
      claim, or LP custody authority.
- [ ] Guardian powers stop only new exposure and cannot stop redemption, unstaking, burns, refunds, settled claims, or
      accrued reward claims.
- [ ] LiquidityManager is the canonical position-NFT owner and every principal/fee/migration recipient is constrained.
- [ ] Roles transfer to the published timelock and guardian multisigs; deployer privileges are renounced or proven
      irrelevant by an independent role scan.
- [ ] No actor can sweep GumBallVault, redirect claims/rewards, change the cumulative cap, or transfer LP NFTs to an EOA.

### 7. Product and operational gate

- [ ] Subgraph mappings, reorg behavior, snapshots, and Matchstick tests cover every required financial event.
- [ ] SDK and web use bigint/exact decimals, simulate writes, decode basket redemption, surface stale data, and fall back
      to direct reads for critical balances.
- [ ] Playwright passes every mining, claim, stake, signal, reward, auction, redemption, trade, liquidity, and bounded
      admin flow against a local deployment.
- [ ] Archive RPC, fallback RPC, indexing, monitoring, alerting, key management, multisig procedures, incident response,
      issuer escalation, status communication, and backup operators are rehearsed.
- [ ] All contracts are verified on Blockscout and the public deployment manifest, source hash, ABI, SDK, subgraph,
      web release, audit artifacts, role holders, and operational contacts are published.

Mainnet launch is forbidden until every gate above is complete. CI must never deploy mainnet from an unreviewed
commit.

## Documentation

- [Repository protocol specification](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Economics and formulas](docs/ECONOMICS.md)
- [Emission schedule](docs/EMISSIONS.md)
- [Economic and security invariants](docs/INVARIANTS.md)
- [Canonical Uniswap v4 design](docs/UNISWAP_V4.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Trust assumptions](docs/TRUST_ASSUMPTIONS.md)
- [Audit scope](docs/AUDIT_SCOPE.md)
- [Access control](docs/ACCESS_CONTROL.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Subgraph](docs/SUBGRAPH.md)
- [Web application](docs/WEBAPP.md)
- [Operations](docs/OPERATIONS.md)
- [Incident response](docs/INCIDENT_RESPONSE.md)
- [Dependency security](docs/DEPENDENCY_SECURITY.md)
- [Security policy](SECURITY.md)
- [Release candidate pipeline](docs/RELEASE.md)
- [Mainnet launch checklist](docs/LAUNCH_CHECKLIST.md)
- [Generated contract API reference](docs/reference/contracts.md)
- [Generated TypeScript SDK API reference](docs/reference/sdk/README.md)
- [ADR-0001: Supply-kernel wiring and schedule](docs/adr/0001-supply-kernel-wiring-and-schedule.md)
- [ADR-0002: Safe sponsor rounding](docs/adr/0002-safe-sponsor-backing-rounding.md)
- [ADR-0003: External-token redemption liveness](docs/adr/0003-external-token-redemption-liveness.md)
- [ADR-0004: Solidity pin and wiring](docs/adr/0004-solidity-pin-and-contract-wiring.md)
- [ADR-0005: Genesis v4 integer-liquidity residual](docs/adr/0005-genesis-v4-integer-liquidity-residual.md)
- [ADR-0006: Seventeen-strategy registry bound](docs/adr/0006-seventeen-strategy-registry-bound.md)

## License

Source files currently identify BUSL-1.1. The licensor, additional-use grant, change date, change license, and final
repository license notice must be approved and added before distribution. This unresolved legal item is a release
blocker, not an implied permission grant. The intentionally unconfigured
`packages/config/deployments/repository-license-notice-policy.json` will bind the exact approved `LICENSE` and `NOTICE`
bytes plus review metadata; its schema does not choose terms or substitute for counsel.
