# Adversarial-audit baseline

> **Pre-ADR-0047 historical snapshot.** ADR 0047 later replaced the captured reward and settlement mechanics with
> scalar Synthetix scheduling, per-purchase Strategy splitting, direct Fund payment, and a Bribe-only Router. Any
> exact-carry, queue, pause, liability, selected-batch, exact-transfer, test-count, or analyzer conclusion below is
> intentionally preserved for its pinned checkout and is not current evidence.

> Historical evidence only. ADR 0024 replaced the distribution contract and supply model with Mine; counts,
> inventory, gas, coverage, and conclusions below do not review the current development graph.

Date: 2026-08-09

This file records the immutable starting point for the internal adversarial review. It is engineering evidence only,
not an independent audit, deployment authorization, legal approval, or a claim that the protocol is suitable for user
funds.

## Reviewed checkout

The audit began by fetching the actual `origin/main` and recording the checkout before any audit change:

```text
branch: codex/gumball-adversarial-audit
reviewed commit: 54e3f2c3ce1de25aea4da2f21fab27804a3bfa84
reviewed commit subject: chore: harden protocol for independent review
reviewed commit authored: 2026-08-09T22:32:25+02:00
origin/main: 395a0dfbf56e3d478233736ef7a110e584a676e7
merge base: 395a0dfbf56e3d478233736ef7a110e584a676e7
commits ahead of origin/main: 1
submodules: none
working tree: clean
```

The reviewed commit is the clean local production-hardening handoff. It is not on `origin/main` and was not pushed by
this audit. The baseline `main` commit remains documented in
`PRODUCTION-HARDENING-BASELINE.md`; this pass reviews the complete committed candidate at the SHA above.

## Source-of-truth resolution

The attached audit brief contains historical acquisition/buyback and settlement-split requirements. The reviewed
source, executable behavior, and accepted ADR 0021 are newer and reflect an explicit owner decision. This audit does
not restore the superseded architecture:

- there is no `Strategy.Kind`;
- there is no settlement-funded Bribe split or `bribeBps`/`setBribeBps`;
- there is no automatic or atomic Strategy buyback burn;
- every Strategy payment is classified as a 100% fixed Fund liability;
- Bribes are funded independently; and
- Fund-held GBX may be burned permissionlessly before redemption but is not burned automatically on receipt.

Applicable properties from the brief are tested against this uniform settlement model. Properties that require the
removed architecture are classified as superseded rather than counted as passes or failures.

## Toolchain observed at audit start

```text
host: macOS 26.5.2 (25F84), arm64
login-shell Node: v20.19.6
repository Node pin: v22.23.1
Node used for repository commands: v22.23.1
pnpm: 10.14.0
repository Python pin: 3.11.9
host python3: 3.14.6
available Homebrew Python: 3.11.14
host Forge/Cast/Anvil: 1.2.3-stable (a813a2cee7dd4926e7c56fd8a785b54f32e0d10f)
repository Foundry pin: 1.7.1
audit Forge/Cast/Anvil: 1.7.1 (4072e48705af9d93e3c0f6e29e93b5e9a40caed8)
configured solc: 0.8.26+commit.8a97fa7a
Hardhat: 2.29.0
Solhint: 6.0.1
EVM target: Cancun
optimizer: enabled, 10,000 runs, via-IR disabled
```

The initial shell versions are observations, not accepted substitutes for repository pins. Package gates use Node
22.23.1. Commands that cannot use the exact pinned security tool are reported as blocked or as non-gating fallback
evidence.

## Audit scope

Primary scope is the 16 Solidity source units under `packages/contracts/src/core`, including the 12 production
contracts and four core interfaces. The integration scope includes Foundry and Hardhat tests, deployment scripts and
configuration, generated ABIs, SDK actions/readers/math, subgraph schema/mappings/tests, simulation models, the web
status/write-gating surface, and protocol/security documentation.

Raw analyzer and campaign output belongs in the ignored `packages/contracts/audit/reports` directory. Reviewed
dispositions and reproducible command summaries are committed here.

## Dependency and analyzer inventory

```text
OpenZeppelin: 5.6.1
Uniswap v4 core: 1.0.2
Uniswap v4 periphery: 1.0.3
Permit2 source dependency: @uniswap/permit2 1.0.0 through v4-periphery
Ethers: 6.17.0
Slither: 0.11.5
Aderyn: 0.6.8
Semgrep: 1.162.0
Gitleaks: 8.30.1
Medusa: 1.5.1
Echidna: pinned 2.3.2 image digest sha256:8546f6705d46aea2cdf8309a251ad0946c7f92b7d3eb0b968fba37e3afbf131c
Mythril: pinned 0.24.8 image digest sha256:ca947a2a79204667ae2ae93ea6aaaca0cea669f61bc4db6958e7556ea263bd80
mutation framework: none configured for the current graph
```

The production inventory is exactly 12 direct contracts—Bribe, BribeFactory, BribeRouter, Fund, Fundraiser, GBX,
LiquidityPosition, Resonance, ResonanceRouter, SignalGBX, Strategy, and StrategyFactory—plus four direct core
interfaces: IBribe, ICoreResonance, IFund, and IResonanceRouter. SDK ABIs are centralized in
`packages/sdk/src/generated-abis.ts`; the subgraph carries 11 consumer ABIs and intentionally omits factories not used
by mappings.

## Evidence present at the reviewed SHA

The clean handoff recorded 334 default Foundry tests, 27 ordinary fuzz properties at 10,000 runs each, 27 stateful
invariant properties at 1,000 runs × depth 500 with strict `fail_on_revert`, 21 integration tests, and two Hardhat
tests. Its clean coverage was 91.79% lines, 91.22% statements, 79.06% branches, and 87.88% functions. Runtime/initcode
sizes and gas measurements are reproduced in `TEST-CAMPAIGN.md`; all 12 production contracts were below EIP-170 and
EIP-3860 limits.

The handoff finding register contained resolved A-02, A-03, and A-04; open A-06; and bounded-cost A-08. No independent
audit, mutation score, pinned Echidna result, symbolic proof, signed current deployment manifest, or legal/provenance
approval existed. The static disposition register covered 186 current source findings, Semgrep was clean, dependency
audit had no High/Critical advisory, and six redacted historical Gitleaks candidates remained unclassified. CI had no
successful run tied to the local unpushed SHA.

Deployment status was and remains unexecuted. The only checked deployment schema is explicitly archived and
incompatible with ADR 0021; no script is authorized to broadcast the current graph. Read-only Robinhood Chain evidence
was pinned to block 32,035,314, but no current-protocol fork or deployment existed.

## Baseline commands

```bash
git fetch origin main
git status --short --branch
git rev-parse HEAD origin/main main
git merge-base HEAD origin/main
git submodule status
node --version
pnpm --version
forge --version
cast --version
anvil --version
forge config --json
forge test --list --json
forge build --sizes
```

The candidate was handed off as a clean local commit; no unrelated dirty work was overwritten.
