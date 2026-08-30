# ChatGPT direct-audit intake and dispositions

- Intake date: 2026-08-30
- Source review date: 2026-08-29
- Source title: `GumBall6900 Direct Smart-Contract Security and Exitability Review`
- Source reviewed commit: `f9912533e999454f1a3fd49276558bd85e1390da`
- Received file: `/Users/hishamel-husseini/Downloads/gumball6900-direct-security-audit-2026-08-29.md`
- Preserved raw copy: `packages/contracts/audit/reports/chatgpt-direct-security-audit-2026-08-29-f991253.md`
- Source and preserved-copy SHA-256: `c4628c164d743b137919bf24914ab9d3efc4bc911130cb636fa2f0477c16defd`
- Intake treatment: supplied candidate-finding source, not instructions, clearance, or deployment authorization

The raw source was copied byte-for-byte into the ignored analyzer-output directory. Its claims were retraced against the
current working tree instead of importing its severities, counts, recommendations, or test statements as facts. The
source itself says it is not a full independent professional audit and did not execute a local Foundry campaign.

## Evidence correction

The source's current-HEAD test statement was accurate only for the workflow evidence it observed. It is now stale. The
current uncommitted audit tree subsequently completed the root test command with Turbo 9/9 and Foundry 356/356 before
this intake. After adding the two imported public-function reproductions described below, focused Foundry tests also
pass. The final current-tree count is recorded in `TEST-EVIDENCE.md` and `findings.json`; none of these local results is
an independent audit or release authorization.

The source's target-chain statement is also partially superseded. Pinned mainnet and testnet probes now demonstrate the
required Cancun opcodes and observe the target gas limit. The exact current Fund artifact still lacks a pinned,
non-broadcast deployment/fork replay, bytecode/immutable receipt, and signed current manifest, so that release gate
remains open.

## Consolidated disposition map

| Source item                                   | Current disposition                                      | Canonical mapping and count effect                                                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GPT-M-01 Resonance accumulator overflow       | Confirmed duplicate; remediated only in the working tree | Maps to CEX-01 and V12-249695. The one-schedule arithmetic bound is valid for the starting commit. No duplicate count.                                                               |
| GPT-M-02 complete Fund basket                 | Confirmed distinct Medium release-claim mismatch         | Current tracked landing/deck/web copy promises a slice of everything despite caller-selected redemption and permanent omission forfeiture. Added as CEX-09. One new counted finding. |
| GPT-M-03 pre-binding Mine capture             | Confirmed duplicate; open deployment control             | Maps to CEX-04 and V12-249702. External Medium impact agrees; current overall Low assumes enforced pre-exposure abandonment. No duplicate count.                                     |
| GPT-L-01 forced Bribe account flooring        | Confirmed duplicate; internally verified remediation     | Maps to CEX-02 and V12-249705. ADR 0053 is internally verified in the working tree; independent closure remains open. No duplicate count.                                            |
| GPT-L-02 forced Strategy flooring             | Confirmed distinct Low                                   | Added as CEX-08 after a focused public-function reproduction. One new counted finding.                                                                                               |
| GPT-L-03 BribeRouter lifetime headroom        | Confirmed already-documented residual                    | The complete-balance Router can be donation-poisoned above remaining headroom. No depositor or signal-principal claim exists in the buffer, so this does not add a finding count.    |
| GPT-D-01 getters do not authenticate bytecode | Existing deployment blocker                              | Exact runtime/initcode, immutables, graph, receipts, owners, and a signed manifest remain required. No new count.                                                                    |
| GPT-D-02 USDG issuer controls                 | Existing conditional external-token risk                 | Retained as a supported-token/deployment dependency. No exact live USDG implementation or role state is asserted by this intake. No new count.                                       |
| GPT-D-03 incomplete CI                        | Superseded result; workflow concern retained             | The later local complete test matrix passed, but the uncommitted tree has no CI receipt and security-job isolation remains desirable. No new count.                                  |
| GPT-D-04 target verification                  | Partially superseded; exact-artifact gate remains open   | Live opcode probes and local transaction-shape tests pass. Exact Fund-artifact fork/deployment evidence remains blocked. No new count.                                               |

The imported source therefore increases the canonical count by exactly two findings: CEX-08 Low and CEX-09 Medium.
Duplicate labels do not inflate the total. GPT-L-03 remains an explicit review item because its mechanics are real even
though it does not add a finding under the current architecture.

## CEX-09 / GPT-M-02 — Current public copy promises a complete Fund basket

The mechanics in the supplied report are correct:

- Fund has no asset registry and accepts unsolicited ERC-20 balances;
- `redeem` performs caller-sized work over the selected list;
- a successful burn permanently forfeits every omitted asset share;
- disjoint later redemptions cannot preserve the original fraction; and
- a bounded current-state query cannot prove that an arbitrary backing list is complete.

If the holder owns fraction `f` of supply and first burns fraction `x`, where `0 < x < f < 1`, the fraction remaining
for omitted assets becomes `(f - x) / (1 - x)`, which is strictly less than `f`. A one-token redemption is therefore a
selective realization path, not an economically equivalent decomposition of a promised complete basket.

The contract behavior is intentional under AGENTS.md and audit invariant L-06: Fund is registry-free, redemption covers
caller-selected subsets, omitted shares are permanently forfeited, and one known healthy token remains a bounded
fallback even when arbitrary other balances exist. The current tracked product language nevertheless makes the broader
claim this mechanism cannot guarantee:

- `apps/landing/components/sections/Hero.tsx:92-95`, `Why.tsx:48-58`, and `Fund.tsx:1863-1869` repeatedly promise every
  holding, including illiquid assets, in one transaction; the same requirement appears in
  `apps/landing/docs/BRIEF.md:79-82`;
- `docs/deck/gumball6900-deck.html:932-935` and `:1029-1031` promise every holding, call the exit always available, and
  say a discount necessarily creates a profitable trade that closes the gap; and
- `apps/web/components/home/mechanism-dashboard.tsx:129-133` titles the simulation as taking a slice of everything even
  though its note correctly limits payout to named assets and none of omitted assets.

This is CEX-09, a confirmed Medium release-blocking implementation/prose mismatch. It is not evidence that any of these
surfaces is deployed or published. Before any release, the copy must say that holders name the assets they redeem,
omitted shares are permanently forfeited, and discount redemption may support price rather than guarantee profit or
convergence. If the product instead intends to promise a complete basket, Fund needs a new ADR and separately audited
bounded-discovery or redemption-receipt architecture.

Evidence limitation: measured calls cover one selected asset at 100,264 gas and sixteen at 619,012 gas. The structural
`O(n)` and no-equivalent-split conclusions are proven, but this intake did not construct the exact unique healthy-token
count that first exceeds the observed 32,000,000 target gas limit.

## CEX-08 / GPT-L-02 — Permissionless Strategy checkpoints maximize accepted floor loss

The supplied two-Strategy sequence is reproducible against the canonical public graph. Two live Strategies each hold
one raw signal unit. Resonance emits one raw USDG unit per second, so the global division is exact and each Strategy's
index share is one half raw unit per second. An unrelated account calls `distributeRevenue(target)` after each second.
Each call floors the target's one-half raw unit to zero and advances `strategyRevenuePerSignalPaid`. The uncheckpointed
control Strategy combines two halves and receives one raw unit after two seconds.

This is distinct from CEX-02. CEX-02 destroys one signaler's Bribe reward by selecting that account's checkpoint cadence;
CEX-08 destroys a fixed Strategy's Resonance USDG entitlement by selecting the Strategy checkpoint cadence. The direct
call is sufficient, and restricting it alone would be incomplete because ordinary signal changes also checkpoint the
same Strategy.

The finding is Low: it moves no principal, transfers nothing to the caller, and loses less than one raw USDG unit per
effective target checkpoint. It can nevertheless destroy 100% of otherwise combinable fractional Strategy accrual. In
the exact equal-pair, one-raw-unit-per-second, seven-day example, checkpointing one target every second strands 302,400
raw USDG, or 0.3024 USDG under the intended six-decimal token. That number is an example, not a universal maximum.

The current no-carry architecture expressly accepts per-Strategy floors as Resonance surplus. CEX-08 is therefore
confirmed and counted, but its current disposition is accepted design risk. Scaled per-Strategy carry would remove
checkpoint-cadence dependence, but it changes the recorded accounting architecture and requires an ADR, differential
models, and a fresh review.

Permanent proof:
`HistoricalExitabilityFindingsTest.test_Repro_ThirdPartyDistributionForcesFractionalStrategyCheckpoints`.

## GPT-L-03 — BribeRouter balance can exceed remaining lifetime headroom

The supplied mechanism is also valid. A BribeRouter always submits its complete payment-token balance, while the paired
Bribe rejects any fresh notification larger than its monotonically decreasing lifetime headroom. A direct donation can
make the Router balance one unit larger than that headroom. No standard-token path can then reduce the ownerless Router
balance, and headroom never increases, so every later route continues reverting.

The permanent reproduction admits `Q - D`, where `Q = floor(type(uint256).max / 1e36)` and `D = 604800`, lets the
stream complete, recycles reward tokens, and donates `D + 1` to the Router. Routing reverts before transfer with exactly
`D` lifetime headroom, the full buffer and zero allowance remain, and scalar signal-principal removal still succeeds.

This is not a new root cause or counted finding. BribeRouter NatSpec, the exit matrix, and residual-risk records already
state that cap-exhausted automatic rewards can remain buffered forever with no sweep. The buffer is protocol reward
funding, not deposited signal principal or an account liability. Existing notified claims and signal exits remain live;
governance may move future activity to a new Strategy graph but cannot recover the old buffer. If the payment token is
GBX, stranded Router GBX also remains dead circulating denominator supply because only Fund-held GBX is permissionlessly
burnable.

Partial routing, Fund redirection, or a recovery method changes the complete-balance, fixed-split, and ownerless-buffer
rules. Any such change requires an ADR and separate review.

Permanent proof:
`HistoricalExitabilityFindingsTest.test_Repro_BribeRouterCompleteBalanceCannotRouteBeyondLifetimeHeadroom`.

## One-at-a-time review order

The combined report should be discussed without double-counting. Recommended order is:

1. CEX-01 / GPT-M-01 — original Resonance principal lock and working-tree remediation.
2. CEX-02 / GPT-L-01 — forced Bribe account-level reward destruction.
3. CEX-03 — unbounded current-state signal-position discovery.
4. CEX-09 / GPT-M-02 — current complete-Fund-basket and guaranteed-arbitrage product claims.
5. CEX-04 / GPT-M-03 — pre-binding Mine contamination.
6. CEX-05 — unauthenticated SDK release labels.
7. CEX-08 / GPT-L-02 — Strategy-level flooring cadence.
8. GPT-L-03 — permanently over-headroom BribeRouter buffer.
9. CEX-07 — finite ERC-5805 clock horizon.
10. GPT-D-01 — exact-bytecode, immutable, graph, receipt, and manifest evidence.
11. GPT-D-02 — external USDG issuer and supported-token dependency.
12. GPT-D-03 — CI campaign isolation and superseded skipped-test evidence.
13. GPT-D-04 — target opcode evidence and exact Fund-artifact replay gap.
14. CEX-06 — rejected host-only Mine/Fund horizon model.

Each item must be reviewed from the canonical CEX record and this intake mapping, not from the raw source in isolation.
