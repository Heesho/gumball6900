# ADR-0003: External-Token Redemption Liveness

- Status: Superseded by ADR-0012; archival baseline only.
- Date: 2026-08-01
- Decision owners: protocol engineering, security review, legal/compliance review
- Supersedes: none

## Context

GBX redemption is a direct, atomic, in-kind claim on every registered raw asset balance in GumBallVault. Redemption
cannot be paused by a protocol administrator, and an asset cannot be removed from the redemption set while its vault
balance is nonzero.

USDG, wrapped assets, and Robinhood Stock Tokens are external contracts. Their issuer, bridge, proxy administrator,
compliance mechanism, or token logic may pause, freeze, reject, upgrade, or otherwise fail a transfer. Because a v1
redemption transfers every registered asset atomically, one failing token transfer reverts the whole basket. The
protocol can eliminate its own pause key but cannot guarantee liveness of external token code.

Production eligibility adds a related constraint: the selected receiver may be unable to receive one or more
regulated assets even when those tokens remain globally transferable.

## Decision

V1 preserves atomic all-asset redemption and does not introduce a privileged escape hatch. Specifically:

- Redemption snapshots all registered balances and uses pre-burn total supply.
- Every registered asset transfer must debit the vault and credit the selected receiver by the exact pro-rata amount;
  those observed deltas and the GBX burn succeed together or revert together.
- There is no global protocol redemption pause.
- There is no administrator-controlled asset skip, substitution, haircut, IOU, force-transfer, rescue, or removal
  while a nonzero balance remains.
- The guardian may immediately disable new acquisition of a broken asset but cannot alter existing holders' claim.
- Asset admission requires live registry, code, transfer, pause/upgrade, issuer, bridge, and compliance review before
  any vault exposure is created.
- Production redemption validates the receiving wallet through the selected compliance module. The final deployment
  documentation must state whether an eligible alternate receiver is permitted.

“Redemption cannot be paused” therefore means the protocol has no role or state flag that stops the function. It is
not a guarantee that every external token will always execute a transfer.

If a registered token becomes non-transferable:

1. Monitoring raises a critical incident.
2. The guardian disables new acquisition and other new exposure to the asset.
3. Settled claims, reward claims, unstaking, burns, refunds, and unrelated safe operations remain available.
4. Redemption transactions may revert until the issuer restores transferability; the UI must block misleading
   simulations and show the external cause.
5. Operators coordinate with the issuer/bridge and publish signed status updates.
6. No privileged actor removes or appropriates the frozen balance. Any successor design is separately specified,
   reviewed, and accepted by holders through voluntary migration rather than an arbitrary vault call.

## Consequences

Benefits:

- Every successful redemption remains economically complete and proportional across the basket.
- Administrators cannot selectively omit a valuable asset or expropriate a frozen balance.
- There is no partial-burn/partial-payout state or additional per-asset debt ledger.

Costs and residual risks:

- One external token can block all redemptions for an unbounded period.
- Eligibility failure can block a particular user/receiver even without a global token pause.
- Non-upgradeable v1 cannot add a skip/claim-later mechanism after launch.
- Disabling new acquisition limits future exposure but does not repair an existing balance.
- Users must understand that protocol-level unpausability is weaker than end-to-end external-token liveness.

This residual risk is severe and must appear in the web risk disclosure, audit scope, incident runbook, and mainnet
launch approval.

## Rejected alternatives

### Administrator skips a failing asset

Rejected because it creates discretionary basket alteration and can confiscate the skipped claim from redeemers.

### Burn now and record an IOU for the failed asset

Rejected for v1 because it adds long-lived per-user debt accounting, claim-transfer questions, compliance complexity,
and a second redemption invariant not specified by the protocol.

### Remove a nonzero-balance asset from the registry

Rejected because the remaining vault balance would become stranded outside the GBX redemption claim.

### Catch transfer failure and continue

Rejected because it silently breaks identical pro-rata basket redemption and can burn full GBX for partial value.

## Verification

- Integration tests use tokens that revert, activate a receiver fee, or add a sender surcharge after registration and
  prove the complete redemption, including GBX burn and all other transfers, rolls back atomically.
- Access-control tests prove guardian, timelock, and deployer cannot pause redemption, skip an asset, or remove a
  nonzero-balance asset.
- Eligibility tests cover an ineligible receiver, compliance-infrastructure failure, and the absence of any partial
  payout or GBX burn. Eligible alternate-receiver policy remains a launch decision.
- Mainnet-fork tests execute nonzero `transfer` and `transferFrom` calls through every signed stock-token runtime at
  the pinned issuer state. The balances are supplied synthetically with Foundry, so this proves contract behavior but
  is not evidence that a production holder exists or is eligible. The release rehearsal must still bind the final
  registry observation and compliance decision immediately before launch.
- Local integration tests exercise a legacy token that returns no data across acquisition, the exact 98/2 split,
  manager claims, and redemption; a subsequent issuer freeze proves the USDG leg, GBX burn, and every basket transfer
  roll back atomically.
- Monitoring and incident-response rehearsals demonstrate acquisition disablement without loss of claims or
  unstaking access.
- Legal, security, and economic reviewers explicitly accept the residual risk before the mainnet gate can pass.
