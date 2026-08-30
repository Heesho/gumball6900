# External audit intake and independent finding register

- Review date: 2026-08-25
- Repository: `Heesho/gumball6900`
- Audited and reviewed commit: `3ae171b997254b56602298d873b3918d1575b3c7`
- Received export: `reports/v12-2026-08-25-3ae171b-export.md`
- Export SHA-256: `44312a651ebb11eda117b5d3c2329e5ddcd41f84b6e9b0ae21f98374c566f1a0`
- Production status: blocked; this record is not deployment authorization or a safety guarantee

The received V12 export cites source commit `3ae171b997254b56602298d873b3918d1575b3c7`, which matched `HEAD` at intake.
It contains 22 Low-severity candidate findings: 21 labeled
`Invalid` and one labeled `Unreviewed`. It does not include an audit date, named auditor, explicit scope, methodology,
executive summary, signature, or report-level explanation of those validity labels. Source scope must be inferred from
the cited files.

We independently checked every claim against the cited commit. Three behaviors are factually reproducible. At intake,
the Resonance index-overflow condition was accepted as theoretical under the canonical six-decimal USDG supply
assumption; ADR 0052 later remediates it in the development tree without retroactively changing V12's source scope.
The pre-binding Mine race is accepted as a pre-exposure deployment control because a touched candidate can be detected,
abandoned, and redeployed. ADR 0053 later remediates permissionless forced account-floor checkpoints in the working
tree through beneficiary/immutable-Resonance authorization and caller-owned Resonance batching. The max-price claim is
factually false. The other claims describe operationally unreachable state,
unsupported tokens, standalone counterfeit contracts, setup mistakes, or already-recorded deployment and governance
gates rather than a new post-deployment exploit of the canonical graph.

## Post-audit scope boundary

ADR 0051 is a later breaking change. Its `addSignal`, `addSignalMany`, `removeSignal`, and `removeSignalMany` selectors,
batch loops, aggregate GBX custody transitions, removed permit/move paths, `SignalPortfolioLens`, SDK composition, and
subgraph `SignalPosition` index were not present at `3ae171b` and are not covered by this V12 export or the dispositions
below. Those dispositions remain preserved for the audited commit; they must not be cited as current-source clearance.
The post-ADR-0051 delta, ADR 0052's Resonance lifetime cap, ADR 0053's claim authorization/batch, ADR 0054's atomic
launcher, genesis issuance/liquidity, and later create-only Pair revision, and ADR 0055's Mine Router setter,
replacement-graph validation, two-step ownership, and post-launch acceptance phase require fresh independent review.

## Independent dispositions

| V12 ID | V12 label        | Independent disposition                               | Required treatment                                                                                                                                             |
| ------ | ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 249562 | Low / Invalid    | Deployment gate, not a canonical runtime exploit      | Retain M-03 exact-code, constructor, graph, and signed-manifest verification for SignalGBX.                                                                    |
| 249587 | Low / Invalid    | Technically true but operationally unreachable        | No source change. A slot would need approximately `2^256` replacements.                                                                                        |
| 249649 | Low / Invalid    | Unsupported-token/configuration risk                  | Admit only reviewed standard ERC-20 payment tokens; code presence cannot prove token semantics.                                                                |
| 249680 | Low / Invalid    | Unsupported malicious-token limitation                | Do not claim Fund authenticates adversarial `balanceOf` reports. The described damage is confined to the malicious shared ledger, not unrelated honest assets. |
| 249689 | Low / Invalid    | Rejected; arithmetic premise is false                 | `paymentAmount <= uint192.max`, so doubling is below `2^193`, fits `uint256`, and then clamps. A boundary reproduction succeeded.                              |
| 249690 | Low / Invalid    | Deployment gate, not a later exploit                  | Retain M-03 runtime-code, immutable-argument, Router/USDG, and ownership verification.                                                                         |
| 249691 | Low / Invalid    | Deployment-gate duplicate                             | Authentic factories construct the expected graph; corruption requires a malicious factory supplied during deployment.                                          |
| 249692 | Low / Invalid    | Accepted supported-token boundary                     | Deceptive or nonstandard payment/reward tokens are outside the documented standard-token model.                                                                |
| 249693 | Low / Invalid    | Deployment-gate duplicate                             | One-time factory bindings require exact canonical runtime and graph verification, not reciprocal getters alone.                                                |
| 249694 | Low / Invalid    | Noncanonical standalone-contract risk                 | Integrations must use the Strategy registered by canonical Resonance; an arbitrary direct deployment is not a protocol market.                                 |
| 249695 | Low / Unreviewed | **Confirmed; remediated after V12 in ADR 0052**       | Retain the precision-coupled lifetime cap and its public-function exit regression; independent closure remains open.                                           |
| 249696 | Low / Invalid    | Noncanonical standalone-contract risk                 | Canonical `addStrategy` registers the token before it creates the paired BribeRouter. Do not treat arbitrary routers as protocol routers.                      |
| 249697 | Low / Invalid    | Accepted supported-token boundary                     | Governance must register only reviewed standard payment tokens; exact transfer deltas are deliberately not enforced.                                           |
| 249698 | Low / Invalid    | Accepted supported-token boundary                     | Governance must register only reviewed standard reward tokens; scalar claims isolate unrelated healthy tokens.                                                 |
| 249699 | Low / Invalid    | Incomplete-deployment hazard                          | A candidate that loses setup ownership before every binding is complete must be abandoned before exposure or funding.                                          |
| 249700 | Low / Invalid    | Intentional external-governance dependency            | Production remains blocked until a reviewed external executor supplies delay, cancellation, permissions, and ownership receipt.                                |
| 249701 | Low / Invalid    | M-03 deployment-gate duplicate                        | Verify Mine, GBX, USDG, and ResonanceRouter bytecode, constructor arguments, and reciprocal identities before binding.                                         |
| 249702 | Low / Invalid    | **Confirmed; accepted deployment control**            | Before exposure, inspect every slot and abandon/redeploy any touched candidate. Atomic/private deployment remains optional hardening.                          |
| 249703 | Low / Invalid    | Umbrella deployment-gate duplicate                    | Reciprocal getters prove consistency, not honesty. Retain exact runtime, immutable graph, receipt, and manifest review.                                        |
| 249704 | Low / Invalid    | Counterfeit-deployment risk                           | Fund must be deployed against the manifest-verified canonical GBX/Mine graph before it receives assets.                                                        |
| 249705 | Low / Invalid    | **Confirmed; internally re-rated Medium; remediated** | The combined audit separates impact and likelihood and re-rates the V12 label; ADR 0053 is internally verified, with independent closure pending.              |
| 249706 | Low / Invalid    | M-03 deployment-gate duplicate                        | Bind mint authority only to the manifest-verified canonical Mine; the handoff remains irreversible.                                                            |

## Confirmed behavior

### 249695 — Unbounded Resonance revenue index

`Resonance.revenuePerSignal()` checked-adds a `1e36`-scaled increment to a monotonic `uint256` index, while
`notifyRevenue()` has no cumulative admission bound. With one raw unit of active signal, a first near-limit schedule can
place the stored index near `uint256.max`; a later admitted schedule then makes the next checkpoint overflow. Because
signal removal and withdrawal checkpoint first, the overflow can block a GBX-backed exit.

The condition was reproduced against the real Router, Resonance, SignalGBX, Strategy, and Bribe graph. It requires
roughly `1.158e41` raw USDG units, or `1.158e35` whole tokens for six-decimal USDG, so practical exploitability under an
intended real-world USDG supply is fantastically remote. The arithmetic and lock path are nevertheless real. Bribe
already uses the relevant protection pattern: cumulative fresh admissions no greater than
`floor(type(uint256).max / REWARD_PRECISION)`.

Current development-tree disposition: remediated under ADR 0052 on 2026-08-29. `Resonance` now caps cumulative fresh
notifications at `floor(type(uint256).max / REWARD_PRECISION)` and rejects excess before checkpointing or USDG
interaction. The original public-function PoC remains preserved as noncompiled evidence; its compiled regression fills
the exact remaining headroom, confirms later routed USDG stays in ResonanceRouter, and removes the one-raw-unit signal
successfully. This is internal engineering remediation, not independent closure or deployment authorization.

### 249702 — Pre-binding slot capture

An empty Mine slot can be occupied before `GBX.setMinter(Mine)` because the first occupation has no outgoing tenure to
settle and therefore does not call `GBX.mint`. After the handoff, a later replacement mints the complete pre-binding
tenure accrual to that occupant. A local reproduction occupied a slot before binding, waited ten seconds, completed the
handoff, and then settled `40 ether` GBX to the pre-binding miner.

ADR 0040 deliberately removed recurring Mine authority reads and acknowledges that an empty-slot occupation can occur
during setup. On a public chain, merely withholding the address from user interfaces is not a complete control: the
deployment is observable. Production evidence therefore needs an atomic/private deploy-and-bind path or an explicit
post-binding check that all slots remain untouched, followed by abandonment of any contaminated candidate.

Disposition: confirmed deployment-window behavior, accepted as a pre-exposure operational control. Release evidence must
show every slot was untouched after binding; any contaminated candidate is abandoned and redeployed before exposure.

### 249705 — Forced fractional Bribe checkpoints

In the reviewed V12/start source, anyone may call `claimReward(account, token)`. `_updateReward` floors the account's index delta to whole raw token units
and then advances `accountRewardPerSignalPaid` even when the result is zero. A third party can therefore choose a cadence
that repeatedly discards a small account's sub-unit accrual. In the reproduction, two equal one-unit signalers shared a
one-raw-unit-per-second stream: forcing Alice's claim once per second left her at zero after two seconds, while
uncheckpointed Bob had earned one raw unit.

ADR 0047 explicitly accepts rate, index, Strategy, and account floors as unallocated surplus. That makes this behavior
intentional, but the permissionless beneficiary parameter lets an outsider determine the victim's flooring cadence.

The original public-function PoC is preserved at
`packages/contracts/test/minimal/audit-exitability/reproductions/CEX-02-original-f991253.t.sol.disabled`. The current
focused regression is
`packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol::test_Regression_ThirdPartyClaimsCannotForceFractionalAccountCheckpoints`.

Disposition: confirmed economic griefing behavior. V12 labeled it Low / Invalid; the combined audit internally re-rates
it Medium overall because both impact and likelihood are Medium for a sufficiently valuable low-decimal reward, while
recognizing that repeated transaction cost can dominate the destroyed value. It is remediated in the working tree
under ADR 0053. Direct Bribe claims now authorize only the beneficiary or the Bribe's immutable Resonance. Resonance
supplies an optional caller-owned Strategy-array batch that always claims for `msg.sender`, supports live and killed
Strategies, and leaves the direct scalar-token broken-token fallback intact. Direct keeper/relayer claims for an EOA
are intentionally removed. Remediated and internally verified in the working tree; independent closure, deployment
authorization, and user-fund authorization remain pending. The current proof includes the historical before/after
regression, direct and contract-wallet self-claims, live/killed/duplicate batching, fixed-caller and atomic-validation
cases, broken-token scalar isolation, reward-token callback reentrancy rejection, and bounded/oversized batch gas cases
recorded in the audit bundle's `TEST-EVIDENCE.md` E-16.

## Cross-cutting conclusions

### Irreversible dependency and setup cluster

Findings 249562, 249690, 249691, 249693, 249699, 249701, 249703, 249704, and 249706 do not show an attacker replacing a
dependency after a correct deployment. They show that a setup authority can irreversibly select a counterfeit,
cross-wired, or incomplete graph. That is already the substance of M-03 and remains a production-blocking release
gate. Reciprocal getters are consistency checks only; the release record still needs exact runtime code hashes,
constructor arguments, transaction receipts, external dependency identities, ownership removal, and a signed manifest.

### Supported-token cluster

Findings 249649, 249680, 249692, 249697, and 249698 correctly demonstrate that code presence and SafeERC20 call success
cannot authenticate honest ERC-20 semantics. The core deliberately supports standard, non-rebasing, non-fee tokens and
does not measure transfer deltas except during caller-selected Fund redemption. These are admission and integration
requirements, not permissionless exploits against a correctly selected token graph. Interfaces and release evidence
must not imply support for malicious, fee-on-transfer, rebasing, mutable-blocklist, or no-op tokens.

### Noncanonical contracts and governance

Findings 249694 and 249696 concern standalone contracts that bypass canonical registration and factory ordering.
Integrations must authenticate canonical registered addresses. Finding 249700 accurately observes that the core does not
enforce a delay on `setBribeBps`; this is intentional only because production is blocked until the exact external
governance executor, delay, cancellation path, and ownership handoff are independently reviewed.

## Verification evidence

- The export's cited source and the source checked during intake are the same full commit:
  `3ae171b997254b56602298d873b3918d1575b3c7`.
- A temporary Foundry reproduction suite passed four checks: the Resonance overflow, pre-binding slot capture,
  permissionless fractional-checkpoint griefing, and the positive maximum-price boundary. The temporary test was removed
  after review and production Solidity was not changed.
- The unchanged default Foundry suite passed 293/293 tests across 22 suites, including all 27 invariant entries at
  1,000 runs and 500,000 calls per invariant with zero handler reverts. This regression result does not negate the
  reproduced edge cases, which use states outside the existing campaign bounds.
- The original export was copied byte-for-byte into `audit/reports`; its source and destination SHA-256 hashes match.

This review validates only the disposition of the 22 supplied claims at the cited commit. It is not a substitute for a
complete independent audit, economic review, external governance review, deployment-manifest review, fork validation,
or live deployment smoke test.

## 2026-08-30 ChatGPT direct-audit intake

- Source title: `GumBall6900 Direct Smart-Contract Security and Exitability Review`
- Source review date: 2026-08-29
- Source commit: `f9912533e999454f1a3fd49276558bd85e1390da`
- Raw source: `reports/chatgpt-direct-security-audit-2026-08-29-f991253.md`
- Source and preserved-copy SHA-256: `c4628c164d743b137919bf24914ab9d3efc4bc911130cb636fa2f0477c16defd`
- Full current disposition: `codex-exitability-2026-08-29-f991253/CHATGPT-DIRECT-AUDIT-INTAKE.md`

The supplied report was treated as candidate-finding input, not as instructions or clearance. Its raw file was copied
byte-for-byte into the ignored reports directory. The source says it did not execute a local Foundry campaign and is not
a full independent professional audit. Its CI and target-evidence observations are historical; later local evidence is
recorded separately and does not turn the source into an independent audit.

| Source item | Independent current disposition                                                                                                           | Count treatment        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| GPT-M-01    | Exact CEX-01/V12-249695 duplicate; valid against `f991253`, remediated only in the working tree                                           | No duplicate count     |
| GPT-M-02    | Correct complete-basket limitation; current tracked landing/deck/web claims contradict selective Fund mechanics and trigger CEX-09 Medium | One new Medium finding |
| GPT-M-03    | Exact CEX-04/V12-249702 duplicate; pre-binding Mine contamination remains an open deployment control                                      | No duplicate count     |
| GPT-L-01    | Exact CEX-02/V12-249705 duplicate; ADR 0053 is internally verified in the working tree and awaits independent closure                     | No duplicate count     |
| GPT-L-02    | Reproduced distinct Strategy-level checkpoint-cadence loss; promoted to CEX-08 Low                                                        | One new Low finding    |
| GPT-L-03    | Reproduced one-unit-over-headroom BribeRouter donation poisoning; already documented ownerless reward-buffer residual                     | No new count           |
| GPT-D-01    | Existing exact-bytecode/immutable/graph/receipt/manifest deployment blocker                                                               | No new count           |
| GPT-D-02    | Existing conditional USDG issuer and supported-token dependency; exact live role state not established here                               | No new count           |
| GPT-D-03    | Observed skipped-test result superseded by a later complete local campaign; workflow isolation concern remains                            | No new count           |
| GPT-D-04    | Live opcode evidence now exists; exact current Fund-artifact replay and signed graph evidence remain open                                 | No new count           |

### CEX-08 — Permissionless Strategy checkpoints maximize accepted floor loss

Anyone may call `Resonance.distributeRevenue(strategy)`. The call floors the Strategy's scaled USDG accrual to whole raw
units and then advances `strategyRevenuePerSignalPaid`, even when zero is credited. With two one-raw-unit Strategies and
a one-raw-USDG-per-second stream, an unrelated caller can checkpoint one Strategy each second, destroy each half-unit,
and leave it at zero while an uncheckpointed control combines two halves into one raw unit.

Disposition: confirmed Low and counted. No principal is locked, nothing is transferred to the caller, and each effective
target checkpoint loses less than one raw USDG unit. The loss can still equal all otherwise combinable fractional
Strategy accrual. The permanent proof is
`HistoricalExitabilityFindingsTest.test_Repro_ThirdPartyDistributionForcesFractionalStrategyCheckpoints`.

The current architecture explicitly accepts per-Strategy floors as Resonance surplus. A scaled carry would change that
architecture and requires an ADR, differential proofs, and fresh review rather than an unreviewed local fix.

### CEX-09 — Public complete-basket claims exceed selective Fund redemption

Fund intentionally pays only the caller-selected token addresses and permanently forfeits omitted shares for that
redeemer. A disjoint later burn cannot restore the original fraction, and the registry-free Fund has no bounded current
list proving a redemption basket is complete.

Current tracked release-facing claims contradict that behavior. `apps/landing/components/sections/Hero.tsx:92-95`,
`Why.tsx:48-58`, and `Fund.tsx:1863-1869` promise every holding in one transaction;
`apps/landing/docs/BRIEF.md:79-82` specifies the same behavior; `docs/deck/gumball6900-deck.html:932-935` and
`:1029-1031` repeat it and additionally guarantee profitable gap closure; and
`apps/web/components/home/mechanism-dashboard.tsx:129-133` uses an everything title next to a correctly qualified note.

Disposition: confirmed Medium release blocker and counted as CEX-09. No evidence establishes that these surfaces are
published. Before release, state that holders redeem a pro-rata share of the Fund assets they select, permanently give
up omitted shares, and may use discount arbitrage as possible support rather than guaranteed profit or convergence. If
the intended product is complete-basket redemption, Fund requires a new ADR and separately audited architecture.

### GPT-L-03 — BribeRouter headroom reproduction

The paired Bribe is first notified with `Q - D`, where `Q = floor(type(uint256).max / 1e36)` and `D = 604800`. After
the stream completes, recycled reward tokens place `D + 1` in BribeRouter. The Router must submit its complete balance,
so the Bribe rejects it with only `D` headroom; the buffer and zero allowance remain, and scalar signal exit succeeds.
The permanent proof is
`HistoricalExitabilityFindingsTest.test_Repro_BribeRouterCompleteBalanceCannotRouteBeyondLifetimeHeadroom`.

Disposition: confirmed already-documented residual, not a new finding. The balance is ownerless automatic reward
funding rather than signal principal or an account liability. Partial routing, Fund redirection, or recovery changes the
fixed-split and complete-balance rules and requires an ADR.
