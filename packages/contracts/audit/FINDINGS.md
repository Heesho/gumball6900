# V12 audit intake and independent finding register

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

We independently checked every claim against the cited commit. Three behaviors are factually reproducible. The
Resonance index-overflow condition is accepted as theoretical under the canonical six-decimal USDG supply assumption.
The pre-binding Mine race is accepted as a pre-exposure deployment control because a touched candidate can be detected,
abandoned, and redeployed. Permissionless forced account-floor checkpoints remain open pending a decision on claim
authorization. The max-price claim is factually false. The other claims describe operationally unreachable state,
unsupported tokens, standalone counterfeit contracts, setup mistakes, or already-recorded deployment and governance
gates rather than a new post-deployment exploit of the canonical graph.

## Independent dispositions

| V12 ID | V12 label        | Independent disposition                          | Required treatment                                                                                                                                             |
| ------ | ---------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 249562 | Low / Invalid    | Deployment gate, not a canonical runtime exploit | Retain M-03 exact-code, constructor, graph, and signed-manifest verification for SignalGBX.                                                                    |
| 249587 | Low / Invalid    | Technically true but operationally unreachable   | No source change. A slot would need approximately `2^256` replacements.                                                                                        |
| 249649 | Low / Invalid    | Unsupported-token/configuration risk             | Admit only reviewed standard ERC-20 payment tokens; code presence cannot prove token semantics.                                                                |
| 249680 | Low / Invalid    | Unsupported malicious-token limitation           | Do not claim Fund authenticates adversarial `balanceOf` reports. The described damage is confined to the malicious shared ledger, not unrelated honest assets. |
| 249689 | Low / Invalid    | Rejected; arithmetic premise is false            | `paymentAmount <= uint192.max`, so doubling is below `2^193`, fits `uint256`, and then clamps. A boundary reproduction succeeded.                              |
| 249690 | Low / Invalid    | Deployment gate, not a later exploit             | Retain M-03 runtime-code, immutable-argument, Router/USDG, and ownership verification.                                                                         |
| 249691 | Low / Invalid    | Deployment-gate duplicate                        | Authentic factories construct the expected graph; corruption requires a malicious factory supplied during deployment.                                          |
| 249692 | Low / Invalid    | Accepted supported-token boundary                | Deceptive or nonstandard payment/reward tokens are outside the documented standard-token model.                                                                |
| 249693 | Low / Invalid    | Deployment-gate duplicate                        | One-time factory bindings require exact canonical runtime and graph verification, not reciprocal getters alone.                                                |
| 249694 | Low / Invalid    | Noncanonical standalone-contract risk            | Integrations must use the Strategy registered by canonical Resonance; an arbitrary direct deployment is not a protocol market.                                 |
| 249695 | Low / Unreviewed | **Confirmed Low; accepted theoretical risk**     | No source change selected. Retain the canonical six-decimal USDG identity and supply assumption; reopen if Resonance's revenue-token model changes.            |
| 249696 | Low / Invalid    | Noncanonical standalone-contract risk            | Canonical `addStrategy` registers the token before it creates the paired BribeRouter. Do not treat arbitrary routers as protocol routers.                      |
| 249697 | Low / Invalid    | Accepted supported-token boundary                | Governance must register only reviewed standard payment tokens; exact transfer deltas are deliberately not enforced.                                           |
| 249698 | Low / Invalid    | Accepted supported-token boundary                | Governance must register only reviewed standard reward tokens; scalar claims isolate unrelated healthy tokens.                                                 |
| 249699 | Low / Invalid    | Incomplete-deployment hazard                     | A candidate that loses setup ownership before every binding is complete must be abandoned before exposure or funding.                                          |
| 249700 | Low / Invalid    | Intentional external-governance dependency       | Production remains blocked until a reviewed external executor supplies delay, cancellation, permissions, and ownership receipt.                                |
| 249701 | Low / Invalid    | M-03 deployment-gate duplicate                   | Verify Mine, GBX, USDG, and ResonanceRouter bytecode, constructor arguments, and reciprocal identities before binding.                                         |
| 249702 | Low / Invalid    | **Confirmed; accepted deployment control**       | Before exposure, inspect every slot and abandon/redeploy any touched candidate. Atomic/private deployment remains optional hardening.                          |
| 249703 | Low / Invalid    | Umbrella deployment-gate duplicate               | Reciprocal getters prove consistency, not honesty. Retain exact runtime, immutable graph, receipt, and manifest review.                                        |
| 249704 | Low / Invalid    | Counterfeit-deployment risk                      | Fund must be deployed against the manifest-verified canonical GBX/Mine graph before it receives assets.                                                        |
| 249705 | Low / Invalid    | **Confirmed Low; open**                          | Decide whether claims become beneficiary-only. Preserve wallet-native Safe/ERC-4337 calls and add low-decimal regression coverage if remediated.               |
| 249706 | Low / Invalid    | M-03 deployment-gate duplicate                   | Bind mint authority only to the manifest-verified canonical Mine; the handoff remains irreversible.                                                            |

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

Disposition: confirmed Low/theoretical behavior, accepted without a source change for canonical six-decimal USDG. Reopen
the finding if the revenue-token identity, decimals, issuance model, or supported-token scope changes.

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

Anyone may call `claimReward(account, token)`. `_updateReward` floors the account's index delta to whole raw token units
and then advances `accountRewardPerSignalPaid` even when the result is zero. A third party can therefore choose a cadence
that repeatedly discards a small account's sub-unit accrual. In the reproduction, two equal one-unit signalers shared a
one-raw-unit-per-second stream: forcing Alice's claim once per second left her at zero after two seconds, while
uncheckpointed Bob had earned one raw unit.

ADR 0047 explicitly accepts rate, index, Strategy, and account floors as unallocated surplus. That makes this behavior
intentional, but the permissionless beneficiary parameter lets an outsider determine the victim's flooring cadence.

Disposition: confirmed Low economic griefing behavior, open. Beneficiary-only claims appear compatible with ordinary
Safe and ERC-4337 wallet execution while intentionally removing direct keeper/relayer claims, but no remediation has
been selected. Do not present permissionless claiming as harmless convenience while this decision remains open.

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
