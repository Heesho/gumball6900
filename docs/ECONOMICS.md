# Minimal GBX economics

> These formulas describe integer contract mechanics. They are not forecasts, valuations, or claims that any asset,
> issuer, market, or deployment is safe. Every token in scope is assumed to be a reviewed standard ERC-20 that is
> non-rebasing and non-fee-on-transfer.

## Supply

All GBX amounts use 18 decimals.

```text
MAX_CUMULATIVE_MINT = 1,000,000,000e18
CONSTRUCTOR_ALLOCATION = 20,000,000e18
NOMINAL_MINING_ALLOCATION = 980,000,000e18
```

The token constructor mints the 20M allocation once. The script contributes the maximal usable amount to one
single-sided v4 position and burns the integer-rounding residual:

```text
positionPrincipal + residualBurned = 20,000,000e18
```

The position principal is not deposited in `GumBallVault`, so it is not part of the vault's redemption basket.

At all times:

```text
cumulativeMinted <= 1,000,000,000e18
totalSupply = cumulativeMinted - cumulativeBurned
remainingMintCapacity = MAX_CUMULATIVE_MINT - cumulativeMinted
```

Burns lower `totalSupply` and increase `cumulativeBurned`; they do not lower `cumulativeMinted` or restore capacity.

## Daily mining

The canonical initial controller uses:

```text
epochDuration = 1 day
dailyDecayWad = 999,525,354,337,060,160
initialScheduledEmission = 465,152,749,681,042,811,702,004 raw GBX wei
next = floor(current * dailyDecayWad / 1e18)
```

This is a smooth four-year half-life. Sequential floor rounding of every positive scheduled amount totals:

```text
979,999,999,999,999,181,815,005,172 raw GBX wei
```

The canonical curve therefore leaves `818,184,994,828` raw wei of the nominal 980M unused even if every positive
epoch is non-empty. Empty epochs create additional permanently unrealized issuance under this controller: they mint
zero, advance one decay step, and do not carry the missed amount forward.

This curve is not an immutable token guarantee. A seven-day typed operation can select a compatible replacement
controller. That code can choose another schedule and receiver up to the token's remaining cumulative capacity.

## Contributions and claims

`MiningPool` accounts for the USDG amount it actually receives. Payer and beneficiary may differ. For a non-empty
ended epoch with contribution total `C`:

```text
teamFee = team == address(0) ? 0 : floor(C * 200 / 10,000)
vaultRevenue = C - teamFee
```

The vault must receive `vaultRevenue` exactly before it is reported to the allocation ledger. The epoch emission is
not scaled by contribution demand or price. For a beneficiary contribution `c_i` and settled emission `E`:

```text
claim_i = floor(c_i * E / C)
```

Claim-floor dust stays in `MiningClaims`; there is no administrator sweep or expiry path. Contributions are final;
there is no cancellation or repayment state.

## Virtual USDG allocation

`AllocationVoter` never owns USDG. It accounts only for USDG already present in `GumBallVault`.

For notified revenue `R`, total active weight `W`, and precision `Q = 1e27`:

```text
if W == 0:
    idleUSDG += R
else:
    globalRevenueIndex += floor(R * Q / W)
```

For a strategy weight `w_j` checkpointed across index delta `d`:

```text
strategyBudget_j += floor(w_j * d / Q)
```

Revenue made idle at notification time is not assigned later. Index and checkpoint rounding can also leave physical
USDG in the vault that is not releasable by a strategy. It remains redemption backing.

When `s` shares are redeemed from pre-burn supply `S`, every budget, `idleUSDG`, and `accountedVaultUSDG` is scaled by:

```text
floor(value * (S - s) / S)
```

This keeps virtual claims proportional to the vault backing retained after the in-kind withdrawal.

## Reverse Dutch auctions

Each strategy sells one immutable USDG lot. `initPrice` is the target-token amount for acquisition or GBX amount for
buyback. With elapsed time `t` and immutable period `T`:

```text
price(t) = initPrice - floor(initPrice * t / T), 0 <= t <= T
price(t) = 0, t > T
```

The price is exactly zero at and after the endpoint. A valid zero-price fill can therefore consume a full strategy
budget lot and release USDG without target-token or GBX payment. This is part of the pinned auction transition and
must be reflected in lot, duration, monitoring, and risk review.

After a fill at quoted payment `p`:

```text
nextInitPrice = clamp(floor(p * priceMultiplier / 1e18), minInitPrice, ABS_MAX_INIT_PRICE)
```

The transition uses the quote, not the observed receipt. Exact debit/receipt assertions fail closed where equality is
required; other measured deltas only account for observed amounts. Neither pattern supports transfer-tax, rebasing,
callback, or other exotic tokens.

## Acquisition split

The seller transfers the target token before USDG release. Let `A` be the target amount actually observed by the
strategy:

```text
if supporterWeight == 0:
    vaultTarget = A
    supporterReward = 0
else:
    supporterReward = floor(A * 200 / 10,000)
    vaultTarget = A - supporterReward
```

The rewards contract distributes its observed 2% share through a `1e27` cumulative index. Reward floor dust remains
in that contract; there is no sweep.

## Buyback

The filler transfers the quoted GBX amount first. The strategy measures its balance increase and burns every observed
unit before asking the vault to release its fixed USDG lot. A burn does not create new issuance capacity. Buyback is
not a treasury repurchase: the received GBX does not remain owned by the protocol.

## In-kind redemption

For burn shares `s`, pre-burn total supply `S`, and each registered vault balance `B_i`:

```text
redemption_i = floor(B_i * s / S)
```

The vault snapshots all amounts before the burn, burns the caller's GBX, scales virtual USDG accounting, and performs
exact transfers. It does not price assets or offset one asset against another. Disabled-strategy assets remain in the
ordered basket.

## Liquidity fees

Anyone may collect fees from the one canonical position while the NFT remains in custody. Collected GBX is burned.
Collected USDG must be received exactly by the vault before notification. Position principal is not withdrawn by fee
collection and is not included in vault redemption.

## Economic risks

- A very small non-empty contribution earns the same complete scheduled epoch emission as a large contribution,
  divided only among that epoch's beneficiaries.
- The auction reaches zero, allowing a zero-payment fixed-lot release.
- Signals assign future notified revenue, not past idle revenue.
- A registered token's transfer behavior can block atomic all-asset redemption.
- Unsupported token behavior can revert deposits, fills, fee routing, rewards, or redemption; deployment review must
  exclude rebasing and fee-on-transfer tokens rather than rely on the balance checks as compatibility logic.
- The token cap does not preserve the canonical mining curve against a malicious replacement controller.
- A malicious admitted strategy can choose any receiver for no more than its current signaled USDG budget.
- Transfer of the canonical NFT can surrender the position to arbitrary deployed recipient code.

No production parameter is implied by this document.
