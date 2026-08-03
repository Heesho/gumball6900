# Minimal protocol invariants

These properties are the review and test baseline for the current direct-deployment contracts. “Always” means across
contract-reachable states, subject to normal EVM atomicity and the explicitly identified external-token liveness
risk. Properties that depend on admitted code are separated from token- or vault-enforced bounds.

USDG, GBX counterparties, and every acquisition or registered asset are required to be standard ERC-20 contracts,
non-rebasing and non-fee-on-transfer. Exact debit/receipt assertions are fail-closed checks; other measured deltas are
accounting guards. Passing or partially tolerating one transfer pattern does not make an exotic token supported.

## Supply

- `cumulativeMinted <= 1_000_000_000 ether`.
- `totalSupply() == cumulativeMinted - cumulativeBurned`.
- Constructor minting occurs once and is exactly `20_000_000 ether`.
- After construction, only `emissionController` may mint.
- Burns increase `cumulativeBurned` and never increase `remainingMintCapacity()`.
- The deployment script ends with `positionPrincipal + residualBurned == 20_000_000 ether` and zero deployment-account
  GBX.

The token does not enforce the canonical daily schedule or mint receiver. A delayed replacement controller remains
bounded by the cumulative cap but can otherwise spend all remaining capacity.

## Mining and claims

- Mining cannot start until the exact canonical NFT is in `LiquidityCustodian` and a compatible epoch-zero controller
  is bound.
- Epochs are sequential, one day long, and settle at most once.
- Settlement is permissionless after the current epoch ends, even when contributions are paused.
- A non-empty epoch sends the exact net USDG receipt to the vault before notification and mints the complete available
  scheduled emission into `MiningClaims`.
- An empty epoch mints zero, advances the schedule once, and carries nothing forward.
- Team fee is zero when the team address is zero; otherwise it is exactly `floor(totalContributed * 200 / 10_000)`.
- Beneficiary entitlement is `floor(contributionOf * epochEmission / totalContributed)`.
- A claim is single-use and always transfers to its beneficiary, regardless of caller.
- Claims transfer existing GBX and never mint.

## Staking and signaling

- sGBX is minted and burned 1:1 against exact GBX transfers and cannot be transferred between accounts.
- A user cannot signal more total weight than their sGBX balance.
- A signal call replaces the user's complete allocation and contains at most 16 unique, live strategies with nonzero
  weights.
- Signal reset and weight decreases remain possible while increases are paused, subject to strict callbacks from a
  live strategy's admitted rewards hook.
- Unstake has no delay but requires `usedWeight == 0`.
- `AllocationVoter` never transfers or custodies USDG.
- After terminal strategy disablement, a zero-weight reset clears voter weight without calling that strategy's rewards
  hook, restoring unstaking liveness even against gas-burning code. Live-strategy reward callbacks remain strict;
  honest disabled rewards retain their terminal weight snapshot and already indexed claims.

## Revenue and budgets

- Only the initialized mining pool and liquidity custodian may notify revenue.
- Notification cannot make `accountedVaultUSDG` exceed the vault's physical USDG balance.
- Revenue notified at zero total active weight increases `idleUSDG` and can never be allocated retroactively.
- A live strategy's budget increases only from its weight across later index deltas.
- `GumBallVault.releaseUSDG` accepts only a live caller strategy, checkpoints and consumes its budget first, and makes
  an exact USDG transfer.
- A strategy can release no more than its current signaled budget, but the vault intentionally accepts that strategy's
  chosen receiver.
- Redemption scales budgets, idle USDG, and accounted USDG by the remaining-supply fraction.
- Disabling a strategy is terminal; its checkpointed budget becomes idle and future weight is excluded.

Registration wiring checks are not code attestation. These budget bounds survive malicious strategy code, but honest
payment-before-release semantics do not.

## Registry and basket

- USDG is registered at asset index zero during construction.
- Asset count is at most 16, including USDG; strategy count is at most 16.
- Assets and strategies are append-only and deterministically ordered.
- An acquisition registration binds one target, strategy, and rewards tuple through getter checks.
- Standalone registration does not add GBX to the redeemable asset list.
- Initial script completion has exactly one registered asset, zero registered strategies, and both deployed strategies
  inactive.
- A disabled acquisition target remains a registered redemption asset.

## Auctions

- Lot, duration, multiplier, minimum initial price, assets, vault, registry, guardian, and timelock are immutable per
  deployed strategy.
- Duration is within 1 hour and 365 days; multiplier is within 1.1e18 and 3e18.
- Price is linear, equals zero at the exact endpoint, and remains zero afterward.
- Fill checks expected epoch, deadline, and maximum quoted payment.
- State advances once per successful fill and uses the quoted payment for the next initial price.
- Acquisition transfers target value before USDG release; its reward split uses observed receipt.
- With zero reward weight, all observed target receipt goes to the vault.
- Buyback burns all observed GBX before USDG release.

The payment-before-release statements describe the deployed strategy implementations, not arbitrary future admitted
strategy code. A zero-price fill is valid and can release a full USDG lot.

## Redemption

- Redemption is public and has no pause flag.
- Denominator is total supply immediately before the burn.
- Every registered amount is `floor(rawVaultBalance * shares / supplyBefore)` and is snapshotted before transfer.
- The user's GBX burns before outbound asset transfers; the transaction remains atomic on any failure.
- Each outbound token transfer must debit and credit exactly the computed amount.
- No administrator can omit a registered asset, select a substitute, use a NAV, or sweep the vault.

A reverting, blocked, rebasing, taxed, or inexact registered token can revert the all-asset redemption. Such tokens
are outside the compatibility boundary, but issuer controls can still make a previously standard token noncompliant.
This external-token liveness risk is not repairable by a privileged bypass.

## Canonical position

- Pool currencies are sorted GBX/USDG, the hook address is zero, and fee/tick spacing are immutable.
- The custodian accepts one NFT only from the configured PositionManager, configured deployment depositor, expected
  token ID, and exact PoolKey.
- The script creates one entirely single-sided position with maximal integer liquidity and burns the GBX residual.
- Fee collection removes zero principal, burns observed GBX fees, deposits exact USDG fees into the vault, and only
  then notifies revenue.
- The custodian exposes no approval, rescue, range change, arbitrary PositionManager call, or principal withdrawal.
- A typed seven-day operation may transfer only the recorded NFT to a nonzero deployed-code recipient.

After that transfer, the original custodian no longer enforces how recipient code treats the position.

## Control plane

- Every timelocked operation is action- and parameter-bound and has a fixed seven-day delay.
- Only the immutable proposer schedules; execution is permissionless after maturity.
- There is no generic target/calldata executor.
- The guardian is stop-only and cannot resume, mint, transfer the NFT, release vault assets, or block exit paths.
- Timelock resumption never changes the guardian into a value-moving authority.

Three delayed code/value trust surfaces are explicitly outside semantic enforcement:

1. replacement emission-controller code;
2. the recipient of the exact position NFT; and
3. newly registered strategy code.

Review and monitoring of those scheduled parameters are required; the delay alone is not an attestation.
