# GUM BALL 6900 Invariants

Status: normative verification baseline. An implementation is incomplete until automated tests exercise these
properties across unit, fuzz, stateful invariant, differential, integration, fork, and adversarial-token suites.

## Notation

- `CM`: cumulative GBX minted.
- `CB`: cumulative GBX burned.
- `TS`: current GBX total supply.
- `CAP`: `1,000,000,000e18` GBX units.
- `M`: `80,000,000e18`, the genesis miner allocation.
- `L`: `20,000,000e18`, the genesis liquidity allocation.
- `C`: accepted community bootstrap USDG in raw token units.
- `S`: required sponsor USDG in raw token units.
- `B[i]`: pre-redemption raw vault balance of registered asset `i`.
- `x`: GBX shares redeemed.

Unless stated otherwise, integer division rounds down and the implementation uses overflow-safe `Math.mulDiv`.

## Supply integrity

At every reachable state:

```text
TS = CM - CB
CM <= CAP
```

Every mint increments `CM` by the exact minted amount. Every real burn increments `CB` by the exact burned amount
and decreases `TS`. A burn never decreases `CM`, so it never reopens mint capacity.

Only EmissionController may mint. Its public surface contains role-specific genesis and recurring emission methods;
there is no generic admin mint path, mutable minter, cap setter, rebase, or balance seizure.

## Genesis backing

Genesis may mint only the exact pair `(M, L)`. Sponsor backing uses ceiling rounding:

```text
S = ceil(C * L / M)
S * M >= C * L
S = 0 or (S - 1) * M < C * L
```

This is the smallest raw USDG amount that never underbacks the LP allocation relative to community GBX. Any
granularity surplus is less than one raw USDG unit. The same rule applies to maximum sponsor escrow from the
bootstrap contribution cap. See [ADR-0002](adr/0002-safe-sponsor-backing-rounding.md).

Genesis settlement is atomic. If the minimum raise, sponsor balance, pool initialization, position creation, mint,
vault transfer, allocation notification, or sponsor refund fails, none of the launch state changes persist. A failed
bootstrap remains permissionlessly refundable.

Before any community claim, the full `M + L` is already included in `TS`.

## Recurring emissions and claims

For epoch `e`:

```text
scheduled[e] <= CAP - CM_before
affordable[e] = contributedUSDG[e] / minimumMiningPrice[e]
actual[e] = min(scheduled[e], affordable[e])
```

`actual[e]` is zero when contributions are zero. The scheduled-emission state advances for every elapsed epoch,
including empty epochs. Unused emission is forfeited and never carried forward.

At settlement, all accepted epoch USDG enters GumBallVault, exactly `actual[e]` GBX is minted to MiningClaims, and:

```text
sum(user entitlements) + claim rounding dust <= actual[e]
```

A claim can be triggered by any caller but always pays the recorded beneficiary. It cannot be replayed. After two
years, unclaimed epoch GBX is permissionlessly burned and is never redirected.

GenesisClaims additionally accepts at most 64 beneficiaries in one call. The complete batch is atomic: each entry is
consumed for genesis distribution zero before any beneficiary transfer, and any invalid or duplicate entry reverts
all claim flags, aggregate accounting, and payments.

Every refundable genesis contribution, genesis sponsor escrow, and invalidated-epoch contribution is cleared only if
the custody contract's observed USDG debit and the recorded beneficiary's observed USDG credit both equal the full
liability. A later transfer fee or sender surcharge reverts the transfer and liability update atomically.

Every genesis sponsor/community contribution and recurring mining contribution also treats its requested USDG amount
as a hard payer-debit maximum. The receiver's observed increase determines accepted accounting, while any payer
decrease above the request reverts the pull and all contribution state.

The Solidity emission schedule must match independent Python and TypeScript models for at least 100 years of daily
epochs, including fully funded, underfunded, empty, and burn-heavy scenarios.

## Redemption

For `0 < x <= TS_before`:

```text
out[i] = floor(B[i] * x / TS_before)
```

The denominator is `GBXToken.totalSupply()` before the burn. Wallet-held, staked, claims-held, escrowed, and
LiquidityManager-held GBX all count. “Circulating supply” is never a protocol input.

For every registered asset:

```text
0 <= out[i] <= B[i]
vaultBalanceAfter[i] = B[i] - out[i]
receiverBalanceAfter[i] = receiverBalanceBefore[i] + out[i]
```

Modulo independent integer rounding, the same fraction `x / TS_before` is applied to every registered asset.
Rounding dust remains in the vault. The burn and every asset transfer are atomic: any transfer failure, including a
successful-return token that debits or credits a non-exact amount after onboarding, reverts the entire redemption.
The vault exposes no protocol-controlled redemption pause or asset-skip switch.

## Allocation custody and budgets

AllocationVoter never holds USDG. At every externally observable state:

```text
sum(live strategy virtual USDG budgets) <= GumBallVault USDG balance
```

Every revenue notification corresponds to USDG newly deposited into GumBallVault. A source cannot double-notify a
deposit or notify more than the deposit. With zero live weight, new revenue remains idle USDG and creates no virtual
budget. RevenueRouter likewise rejects any payer debit above its requested route amount.

Revenue allocation uses at least 1e27 precision and carries the scaled numerator rather than treating it as whole
USDG:

```text
baseDelta = floor(newRevenue * PRECISION / totalLiveWeight)
combined = (newRevenue * PRECISION mod totalLiveWeight) + previousScaledRemainder
indexDelta = baseDelta + floor(combined / totalLiveWeight)
nextScaledRemainder = combined mod totalLiveWeight
```

No revenue silently disappears. Before weight change, strategy disable, budget spend, or redemption scaling, the
affected indices are checkpointed.

Before a redemption, every outstanding strategy budget is scaled by the same remaining-supply fraction. A disabled
strategy has no live denominator weight, receives no new allocation, and returns its unused budget to idle USDG.
Each scaled strategy budget is emitted exactly for deterministic index reconstruction.
Every successful strategy release decreases GumBallVault's raw USDG balance and increases the fill receiver's raw
USDG balance by exactly the budget amount consumed; receiver fees and sender surcharges revert the complete fill.
The scaling loop is bounded to sixteen asset-linked strategies plus the standalone buyback as specified in
[ADR-0006](adr/0006-seventeen-strategy-registry-bound.md); the independent per-user signal limit remains sixteen.

## Stake and signal consistency

sGBX is non-transferable and minted 1:1 against the actual GBX balance increase on stake. For every user:

```text
activeSignalWeight + pendingSignalWeight <= sGBX balance
```

Globally:

```text
sum(user active weights) = sum(strategy live weights) = totalLiveWeight
```

New and increased signal weight cannot become effective before the 24-hour activation delay and a checkpoint. It
has no same-block effect. Reductions and resets checkpoint rewards before decreasing effective weight.

After any unstake, both active and pending weight fit within the remaining stake. Unstaking requires no prior reset,
cannot strand votes, and cannot destroy already accrued rewards.

Signals affect only USDG notified after their effective checkpoint. They confer no authority to sell, rebalance, or
execute against assets already held by the vault.

## Strategy fills

For each acquisition fill:

```text
actualTargetReceived = targetBalanceAfterPull - targetBalanceBeforePull
actualTakerDebit = takerBalanceBeforePull - takerBalanceAfterPull
actualTakerDebit <= maxTargetAmount
vaultPortion + managerPortion = actualTargetReceived
managerPortion = floor(actualTargetReceived * 200 / 10_000)
vaultPortion = actualTargetReceived - managerPortion
```

The remainder assignment above preserves the exact split identity and ensures managers never receive more than 2%.
Every successful fill observes a strategy balance decrease equal to `actualTargetReceived`, a vault increase equal to
`vaultPortion`, and a ManagerRewards increase equal to `managerPortion`. Deployment validation also rejects target
tokens whose transfer behavior prevents those exact deltas.

The lot is within configured minimum and maximum bounds and no larger than the live virtual budget. Both the quoted
requirement and the observed taker debit are bounded by the taker's `maxTargetAmount`, including sender surcharges
that apply only to the pull. The auction rate is always positive. A stale auction ID, expired deadline, excessive
target requirement, disabled asset, or trading halt prevents the fill.

Target receipt, accounting updates, vault/reward delivery, and only then USDG release occur in one non-reentrant
transaction. Therefore:

```text
USDG released <= budget debited
target asset arrives before any USDG leaves GumBallVault
```

If live strategy weight is zero, the would-be manager portion goes to GumBallVault. Normal strategies pay exactly
2%; HoldUSDG and BuybackBurn pay zero. Those percentages have no mutable v1 setter.

## Manager rewards

For one strategy and its single target reward token:

```text
total manager assets paid + currently owed <= total manager assets actually notified
```

Accumulator precision is at least 1e27, and notification remainder is included in the next update. Claims pay the
user or an explicitly authorized receiver. A claim or zero-weight vault redirect succeeds only when the receiver's
observed balance increases and ManagerRewards' balance decreases by the exact liability amount. Receiver-deducted
fees and sender-paid surcharges therefore revert every accounting change. Accrued rewards survive signal changes and
unstaking. Only the associated strategy may notify; third-party bribes cannot enter reward accounting.

After the final live manager weight is individually checkpointed and removed, the generation or live remainder cycle
must satisfy:

```text
generationNotifiedRewards = generationWholeEntitlements + generationFinalizedTerminalDust
generationFinalizedTerminalDust = generationRedirectedDust + generationPendingTerminalDust
totalAccruedRewards + totalPendingTerminalDust <= accountedRewards
```

Terminal finalization queues a nonzero residual without calling the reward token. Pending dust remains in
`accountedRewards`, cannot be notified again as an unaccounted deposit, and becomes `generationRedirectedDust` only
after a permissionless fixed-destination sweep transfers the exact amount to GumBallVault. A failed sweep preserves
the pending amount for retry and cannot roll back staking, voting, reset, or unstake. A zero residual finalizes the
cycle without creating a pending sweep. Every unpaid whole-token entitlement remains accounted and claimable. The
terminal boundary invalidates per-user fractional carry, so a later signal cannot claim finalized dust. An
administrative generation close records unresolved stored weight and waits for its final checkpoints before
performing this reconciliation; it never treats dormant, uncheckpointed whole claims as dust.

Every strategy disable fixes the terminal reward index for the generation being invalidated. A stale user's weight
can accrue only through that generation's terminal index, never through reward increments after reactivation. A new
generation starts at the existing global index, so newly activated weight cannot claim earlier rewards.

## Buyback and burn

Every GBX unit accepted by BuybackBurnStrategy is burned before USDG is released:

```text
TS_after = TS_before + newEmission - GBXActuallyBurned
CM_after = CM_before + newEmission
```

Buyback pays no manager reward. Contracts do not calculate whether a fill is accretive because there is no onchain
NAV oracle.

## Assets and liquidity

- Registered asset token and strategy addresses are unique; the set is bounded to 16.
- An asset with a nonzero GumBallVault balance cannot be removed from redemption.
- Unexpected tokens sent to the vault do not become registered redemption assets.
- Stock-token raw balances do not change when `uiMultiplier()` changes.
- The canonical LP allocation is exactly 20 million GBX and is backed before entering the pool.
- Every live canonical position NFT is owned by LiquidityManager; migration burns old NFTs and atomically mints
  precommitted replacements back to LiquidityManager.
- At most 16 canonical position records are active at once. Genesis establishes four, completed-range sweeps decrement
  the count, and every migration preflights its resulting active count before PositionManager execution.
- A migration destination equals the one canonical PoolKey byte-for-byte. The path cannot choose a new hook, fee,
  tick spacing, currency ordering, pool, spender, or recipient.
- Replacement inputs cannot exceed the v4 credits created by the removed positions. The batch never settles a debt
  from LiquidityManager or Permit2.
- Removed principal can go only to a replacement position or, as residual, to GumBallVault (USDG) / burn (GBX).
- Collected USDG fees go to GumBallVault and allocation; collected GBX fees are really burned.

## Privilege invariants

No guardian, timelock, deployer, multisig, hook, strategy, or liquidity operator can:

- mint beyond explicit EmissionController paths;
- change the cumulative cap;
- sweep or arbitrarily call GumBallVault;
- pause redemption, unstaking, burns, refunds, or settled/accrued claims;
- redirect claims or manager rewards;
- transfer protocol position NFTs to an EOA;
- replace immutable economic splits or core references; or
- upgrade a core contract.

## Stateful verification minimum

Handlers must include at least five miners, five signal managers, three auction takers, two redeemers, one guardian,
one timelock, multiple assets, variable time, empty epochs, buybacks, and multiplier updates. Ghost variables track
aggregate deposits, mints, burns, claims, budgets, acquired assets, reward notifications, and LP custody.

Any invariant exception must be documented in an ADR with the replacement property and a test that demonstrates it.
