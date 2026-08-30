# GumBall6900 liveness and exitability review

- Review date: 2026-08-29 UTC
- Authoritative starting commit: `f9912533e999454f1a3fd49276558bd85e1390da`
- Starting branch: `main`
- Prior V12 target: `3ae171b997254b56602298d873b3918d1575b3c7`
- Review type: internal adversarial engineering evidence
- Post-review remediation status: ADRs 0052 and 0053 are internally verified in the working tree; CEX-05's ambiguous SDK
  field/option names are explicitly caller-claimed and internally verified; none is independently closed
- Release status: **blocked**

## Executive conclusion

The starting source contained a real global signal-principal failure: a finite sequence of accepted USDG schedules could
overflow Resonance's monotonic `1e36` revenue index, and scalar `removeSignal` had to evaluate that index before returning
GBX. The path was reproduced through the public Mine, Router, Resonance, SignalGBX, Strategy, and Bribe graph without
storage mutation. Its impact was critical and its practical likelihood negligible. The working tree now contains a
precision-coupled lifetime admission cap, the original disabled PoC, and a compiled before/after regression. This report
records internal boundary, cap-edge live/killed exit, callback, gas, mutation, ABI/consumer, stateful, and workspace
verification. It does not treat the remediation as independently closed or as repairing any immutable starting-revision
deployment.

One principal-exit requirement remains unsatisfied even if every contract behaves correctly: a user's aggregate sGBX
balance is visible in current state, but the core has no state-growth-independent bounded method to discover which
Strategy Bribes hold it. Scalar removal is bounded once a Strategy address is known. Without wallet records, logs, or an
indexer, a client can derive the factory's finite CREATE history from its current nonce, but that scan is O(total factory
creations) and grows with global history. That is a requirements-level exit-discovery dependency, not an accounting
mismatch.

The review also reconfirmed permissionless forced Bribe flooring and the pre-binding Mine occupation window. Neither
locks signal principal under the tested assumptions: the former can destroy reward entitlement, and the latter requires
an exposed, partially initialized candidate and is recoverable only by abandonment before user exposure. ADR 0053 now
remediates the Bribe cadence in the working tree with beneficiary/immutable-Resonance authorization plus a caller-owned
Resonance batch. Remediated and internally verified in the working tree; independent closure, deployment authorization,
and user-fund authorization remain pending.

A supplied ChatGPT-authored direct review was subsequently preserved and dispositioned item by item. It duplicates
CEX-01, CEX-02, and CEX-04; adds one reproduced Low Strategy-flooring finding as CEX-08; and identifies a complete-basket
redemption limitation that is promoted to CEX-09 Medium because current tracked landing/deck/web claims exceed the intentional
caller-selected Fund mechanics. Its BribeRouter cap item is an already documented residual, and its CI/target-evidence
statements are partially superseded by this bundle's later local evidence. See `CHATGPT-DIRECT-AUDIT-INTAKE.md`.

No deployment authorization follows from this work. There is no current signed manifest, selected external governance
executor, current-graph non-broadcast fork campaign, ownership receipt, or exact deployed-bytecode record. Those are
independent release blockers.

## Finding summary

| Overall severity | Count | IDs                            |
| ---------------- | ----: | ------------------------------ |
| Critical         |     0 | —                              |
| High             |     0 | —                              |
| Medium           |     4 | CEX-01, CEX-02, CEX-03, CEX-09 |
| Low              |     3 | CEX-04, CEX-05, CEX-08         |
| Informational    |     1 | CEX-07                         |
| Rejected         |     1 | CEX-06                         |

Impact and likelihood are reported separately. In particular, CEX-01 has **Critical impact** despite its negligible
likelihood and Medium overall severity. V12 labeled 249705 Low / Invalid; this combined audit internally re-rates it as
CEX-02 Medium because both impact and likelihood are Medium for a sufficiently valuable low-decimal reward. CEX-02
remains counted even though an internally verified working-tree remediation now exists; finding counts describe
identified issues, not unresolved-only totals.

## Known principal-exit blockers

1. **Original-source arithmetic blocker, remediated in the working tree:** CEX-01 globally froze live and killed signal
   exits after the Resonance index overflowed. The lifetime cap removes this path for a fresh deployment.
2. **Open discovery dependency:** CEX-03 has no state-growth-independent bounded reconstruction for an unknown
   portfolio. Factory-nonce reconstruction is finite at a snapshot but grows with total factory history; known
   positions still have a finite scalar exit.
3. **Deployment-only blockers:** an exposed pre-binding Mine candidate can be contaminated; a wrong immutable graph is
   unrecoverable; no exact current manifest/governance handoff exists. Abandon any contaminated or unverifiable candidate.
4. **Finite but physically remote horizon:** the ERC-5805 block clock eventually overflows. The rejected Mine/Fund
   `uint256` horizon is rejected because the target's `uint64` timestamp cannot encode the required state.

## Scope and methodology

The review covered every first-party Solidity contract and interface; the SignalPortfolioLens; constructors and one-time
bindings; Foundry and Hardhat configuration; deployment/configuration/release gates; SDK transaction and deployment
helpers; subgraph position tracking; audit harnesses; mutations; dependencies; and the complete V12-to-current diff.

Work combined line-by-line call tracing, ledger and callback graphs, public-function reproductions, deterministic and
fuzz tests, stateful arbitrary-prefix escape attempts, independent arithmetic models, gas measurements, mutation and
static tooling, and pinned live target-chain observations. Existing reports, comments, tests, and vendor labels were
treated as claims. Exact commands and limitations are in `TEST-EVIDENCE.md` and `commands.log`.

## Explicit supported assumptions

- Canonical GBX and USDG remain standard, non-rebasing, non-fee ERC-20s with conventional transfer and balance behavior.
- Governance registers only reviewed standard Strategy payment and Bribe reward tokens. Unsupported token behavior is
  tested for blast-radius isolation, not promised to work.
- The deployed immutable graph, runtime bytecode, constructor arguments, and one-time bindings match a separately signed
  manifest and are checked before any exposure.
- Durable Strategy-address records mitigate CEX-03 operationally, but do not satisfy this review's bounded-current-state
  exit requirement. Deployment remains blocked until CEX-03 is remediated.
- Operations occur before the explicit ERC-5805 block-clock horizon; target timestamps remain within the pinned
  client's `uint64` representation.
- Robinhood Chain continues to execute the probed Cancun opcodes and preserves the observed gas/size configuration.

## Exclusions and evidence boundaries

- No economic review establishes suitable emission, auction, bribe, or liquidity parameters.
- No legal, governance-provider, bridge, issuer, market-liquidity, or oracle review was completed.
- No mainnet transaction was broadcast. No contract was deployed, verified, funded, or assigned production ownership.
- Live opcode probes are not a substitute for a pinned exact-artifact Fund deployment/fork campaign.
- Scanner output is supporting triage only; confirmed findings require a trace or reproducible argument.
- This internal review is not an independent audit and does not make the protocol safe, audited, deployable, or suitable
  for user funds.

## Report map

- `ARCHITECTURE.md`: dependency, authority, ledger, value-flow, callback, and state-machine maps.
- `FUNCTION-MATRIX.md`: complete state-changing public/external surface.
- `EXIT-MATRIX.md`: every position, entitlement, exit, fallback, and failure dependency.
- `FINDINGS.md` / `findings.json`: confirmed, rejected, remediated, and unresolved results.
- `CHATGPT-DIRECT-AUDIT-INTAKE.md`: preserved-source provenance, duplicate map, corrected evidence, and imported
  candidate dispositions.
- `TEST-EVIDENCE.md` / `commands.log`: exact campaigns, versions, observations, and gaps.
- `RESIDUAL-RISKS.md`: assumptions and irreducible limitations.
- `REMEDIATION.md`: prioritized source, architecture, deployment, and evidence work.
