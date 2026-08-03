# GUM BALL 6900 Incident Response

Status: response-plan baseline. Replace role aliases, communication channels, issuer contacts, RPC providers, and
legal escalation details with reviewed production values before the incident-readiness gate can pass.

## Safety rules

During an incident:

- preserve evidence and verify state through multiple direct RPC reads;
- stop only new exposure using existing bounded controls;
- keep redemption, unstaking, signal reduction/reset, real burns, refunds, settled claims, accrued reward claims, and
  vault-directed fee routing available whenever their external tokens permit;
- never sweep GumBallVault, add arbitrary execution, change claims, redirect rewards, bypass a timelock, transfer LP
  NFTs to an EOA, or represent a dead-address transfer as a burn;
- never use an unreviewed oracle/NAV calculation to mutate state; and
- communicate confirmed facts, uncertainty, user impact, and next update time without promising external-token or
  chain recovery.

Core contracts are non-upgradeable. An emergency does not expand operator authority.

## Severity

| Severity | Definition                                                                                                                                                                           | Initial response target             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| SEV-0    | Confirmed or strongly suspected loss/theft of backing, unauthorized mint, supply invariant break, arbitrary vault authority, or compromised deployment ceremony before funds arrive. | Immediate; page all response roles. |
| SEV-1    | Redemption broadly unavailable, registered token frozen, chain finality failure, strategy releases USDG incorrectly, critical role compromise, or canonical LP custody at risk.      | 15 minutes.                         |
| SEV-2    | New mining/acquisition/liquidity risk, stale/incorrect allocation or rewards, single-provider/indexer outage, significant UI transaction error, or compliance-system degradation.    | 60 minutes.                         |
| SEV-3    | Non-financial display/indexing issue, keeper delay with permissionless fallback, or low-risk operational anomaly.                                                                    | Same business day.                  |

If severity is uncertain, start at the higher level and downgrade with recorded evidence.

## Response roles

| Role                        | Responsibility                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Incident commander          | Own severity, decisions, timeline, handoffs, and closure. Does not improvise contract authority.  |
| Onchain investigator        | Reproduce chain state, transactions, traces, code/role hashes, and invariant impact.              |
| Security lead               | Assess exploitability, containment, attacker behavior, and audit/vendor escalation.               |
| Guardian coordinator        | Prepare and independently verify only the bounded emergency payload, if needed.                   |
| Timelock coordinator        | Prepare delayed remediation/rotation proposals with decoded calldata and evidence.                |
| Infrastructure lead         | RPC, indexer, keeper, web, monitoring, and status-service recovery.                               |
| External-dependency liaison | Coordinate with Robinhood Chain, USDG, token issuer, bridge, Uniswap, or RPC provider.            |
| Legal/compliance lead       | Eligibility, jurisdiction, sanctions, disclosure, issuer, and regulator obligations.              |
| Communications lead         | Publish signed, timestamped user updates and corrections.                                         |
| Scribe                      | Maintain immutable timeline, evidence hashes, participants, decisions, and outstanding questions. |

Production documentation must list primary/backup holders for every role and an out-of-band channel.

## First 15 minutes

1. Open an incident record and preserve the triggering alert, logs, transaction, block, RPC responses, UI state, and
   relevant manifest/code hashes.
2. Establish chain ID and finalized height through two independent RPC providers. Treat a single provider or subgraph
   view as unconfirmed.
3. Reconcile the smallest affected invariant set: supply, vault balances, budgets, weights, rewards, strategy ordering,
   LP ownership, roles, pause state, and external token status.
4. Determine whether the issue is onchain truth, chain reorg/halt, external-token behavior, RPC/indexer drift, UI error,
   or an operator-key event.
5. Stop automation that could add exposure or spam failing transactions. Permissionless user operations remain
   available.
6. If justified, prepare a guardian action limited to new contributions, refundable unsettled settlement, new signal
   activations, acquisition fills, or liquidity additions/migrations. Independently decode and simulate it.
7. Publish an initial notice with confirmed scope, protected operations, known external dependency, and next update.

Do not speculate about attacker identity, asset value, recovery time, or legal outcome.

## Invariant triage

Capture before/after values and transaction traces for:

```text
totalSupply == cumulativeMinted - cumulativeBurned
cumulativeMinted <= 1,000,000,000 GBX
sum(strategy budgets) <= GumBallVault USDG
sum(user active weights) == sum(strategy weights) == total live weight
user active + pending <= staked balance
vault target receipt + manager receipt == actual target pulled
GBX buyback receipt precedes burn and USDG release
redemption uses pre-burn total supply and pre-transfer raw balances
canonical position NFTs remain owned by LiquidityManager
```

Any confirmed failure is at least SEV-1 and may be SEV-0. Preserve the exact node/client versions used for traces.

## Playbooks

### Registered token pause, freeze, or transfer rejection

Symptoms include failed redemption simulation/call, issuer pause event, inactive registry status, bytecode/admin change,
or direct transfer probe failure.

1. Confirm the failure at a pinned block with two RPCs and distinguish account eligibility from global token failure.
2. Guardian disables new acquisition for the asset and pauses related fills.
3. Verify other protected operations remain available. Do not remove, skip, substitute, rescue, or haircut the asset.
4. Notify the issuer/compliance liaison and publish that atomic all-asset redemption may revert until transferability
   returns.
5. Monitor raw vault balance without using UI multiplier changes as balance changes.
6. After issuer recovery, re-run transfer/interface/status/code checks before re-enabling acquisition through the
   approved process.

This is the accepted high-impact residual risk in ADR-0003. No recovery-time guarantee exists.

### USDG freeze, upgrade, or depeg

1. Confirm contract behavior, proxy/admin/code changes, transferability, and market condition separately.
2. Pause new mining contributions and acquisition fills if they increase exposure; preserve refundable state.
3. Do not value or socialize losses onchain. USDG remains a raw redemption asset while transfers work.
4. Coordinate with issuer and legal/compliance. Any replacement asset or successor protocol requires a new reviewed
   specification and voluntary migration.

### Wrapped BTC bridge or representation failure

Disable new acquisition, preserve the raw vault claim, contact the official bridge/issuer, and publish the exact
representation and code hash. Never substitute a same-ticker token or use an Ethereum/Base address.

### Robinhood Chain halt, reorg, or RPC divergence

1. Stop keepers and all operator writes until finality is understood.
2. Compare official chain status and multiple independent nodes; capture competing block hashes.
3. Do not rebroadcast state-dependent transactions blindly.
4. After recovery, wait the reviewed confirmation window, rebuild indexers from the common finalized block, reconcile
   every financial event, and only then resume automation.

Contracts cannot solve chain liveness. A chain halt does not authorize a deployment elsewhere with the same manifest.

### Strategy ordering, split, or budget anomaly

1. Pause acquisition fills globally or for the affected asset.
2. Trace target pull, observed delta, vault/reward delivery, budget debit, and USDG release.
3. Reconcile physical vault USDG against all virtual budgets and idle balance.
4. Keep redemption available. Do not top up or rewrite accounting through an admin transfer.
5. If an invariant failed in deployed immutable code, do not re-enable; commission independent analysis and specify a
   voluntary successor path.

### Mining or supply anomaly

1. Pause new contributions and, only if refunds remain permissionless, affected unsettled settlement.
2. Verify EmissionController caller, epoch ordering, scheduled/affordable emission, cumulative capacity, mint event,
   claims receipt, and all burn events.
3. An unauthorized mint or cap breach is SEV-0. There is no admin clawback or rebase.
4. Preserve claims/refunds and publish exact supply impact. Any successor requires independent security/economic/legal
   review.

### Signal or manager-reward anomaly

Pause new signal activations or related fills; preserve reductions, reset, unstaking, and accrued claims. Reconcile
active/pending weights, checkpoint order, activation timestamps, accumulator/remainder, and reward-token balances.
Never delete accrued rewards or require a withdrawal lock as an emergency patch.

### Canonical pool, hook, or position incident

1. Pause liquidity additions/migrations and inspect PoolKey, hook code/permission bits, position owner, ticks, principal,
   fees, approvals, and recent calls.
2. Canonical pool price manipulation alone does not change minting or redemption accounting.
3. Continue constrained USDG fee/principal routing to GumBallVault when safe. Never transfer NFTs/principal to an EOA.
4. A migration needs its precommitted destination and seven-day timelock; an incident does not waive either.

### Guardian compromise

Guardian cannot move funds or stop protected exits. Verify every pause/disable action, publish impact, keep reductions
and exits available, and queue guardian rotation through the timelock. Do not grant a temporary all-powerful guardian.

### Timelock multisig compromise

1. Decode all queued/executed operations and remaining delays.
2. Cancel malicious proposals through an existing reviewed cancel path, if available.
3. Guardian pauses only new exposure that a matured action could affect.
4. Target contracts must independently reject out-of-scope selectors/arguments; if they do not, treat as SEV-0/1.
5. Rotate signers/control through the approved delayed mechanism. Do not shorten delay or add arbitrary vault access.

### Compliance registry compromise or outage

Determine whether the module fails open or closed and identify affected transfers/mining/staking/rewards/redemption.
Preserve evidence of eligibility changes, stop new exposure where authorized, engage legal/issuer teams, and use only
the reviewed registry rotation/recovery process. Compliance authority cannot seize or sweep assets. Be explicit that
account-level eligibility can impair redemption even without a protocol pause.

### RPC, subgraph, or web compromise

Disable affected write UI and keeper endpoint, direct users to verified contracts/explorer, rotate infrastructure
credentials, and compare direct reads with the public manifest. Because offchain systems are non-authoritative, do not
send corrective onchain transactions unless chain state independently requires them.

### Deployment or manifest mismatch before launch

Do not open contributions. Freeze the ceremony, preserve all outputs, compare source/build/address/salt/constructor/
role/code hashes, and redeploy only from a new reviewed manifest. If community contributions opened but genesis has
not settled, use only the refundable abort path.

## Communications

Every update includes:

- incident ID, severity, UTC timestamp, affected chain/contracts/assets;
- confirmed facts and evidence source;
- affected/unaffected user operations;
- bounded action taken or queued, with transaction/calldata link;
- external dependency and its ownership, if relevant;
- known uncertainty and next update time; and
- a warning against unsolicited “migration” links or approvals.

Corrections remain visible. Never publish private keys, provider credentials, personal eligibility data, exploit
details that create immediate additional loss, or unverified attribution.

## Recovery gate

Resume a paused new-risk operation only when:

1. root cause and affected state are understood;
2. direct state and all relevant invariants reconcile;
3. external dependency status is restored and independently checked;
4. the resumed operation is simulated against current finalized state;
5. security and legal/compliance owners approve where relevant;
6. the exact unpause/re-enable authority is documented and reviewed; and
7. a signed user update explains residual risk.

Do not close the incident merely because alerts stopped.

## Post-incident

Within the reviewed timeline, publish a postmortem containing impact, full UTC timeline, root and contributing causes,
detection gaps, decision rationale, onchain/offchain evidence hashes, user remediation, unresolved risk, and owners/
deadlines for corrective actions. Update tests, fixtures, threat model, operations, deployment gates, and monitoring.

Any proposed economic, custody, governance, upgradeability, redemption, eligibility, or recovery change requires an
ADR and new audit scope. Incident urgency is not sufficient justification to weaken the protocol's non-negotiable
constraints.
