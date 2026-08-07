# Fundraiser distribution schedule

GBX has a one-billion-token cumulative mint ceiling. Construction creates exactly 20 million GBX for the canonical
single-sided Uniswap v4 position. The deployment coordinator cannot mint any additional GBX; it may only use the
one-time handover to make Fundraiser the permanent minter of the remaining 980 million capacity.

Fundraiser preserves the previous implementation's exact daily schedule:

```text
epoch duration       = 1 day
epoch 0 emission     = 465152.749681042811702004 GBX
daily decay          = 0.999525354337060160
half-life            = 1,460 days (four years)
next emission        = floor(current emission * daily decay)
```

The floor is applied after every sequential daily step. This matters: computing a distant epoch with a single
exponentiation would not reproduce the same integer results. Known vectors include:

| Epoch |        Scheduled GBX wei |
| ----: | -----------------------: |
|     0 | 465152749681042811702004 |
|     1 | 464931966945802163687533 |
|     2 | 464711289004129249641614 |
|    30 | 458574651527554231366536 |
|   365 | 391145279752197254551815 |
| 1,460 | 232576374840521271244695 |
| 2,920 | 116288187420260568318929 |

An ended epoch must be settled before claims can mint. `settleEpochs(maximumEpochs)` is permissionless and advances a
caller-bounded number of epochs in strict order. This allows catch-up without making one unbounded transaction walk
the full schedule.

- A nonempty epoch assigns the complete scheduled amount pro rata to contributors.
- Contribution size determines only the contributor's share, not the epoch's total allocation.
- An empty epoch assigns zero, advances the decay once, and permanently forfeits that day's emission.
- There is no carry, governance-controlled rate, minimum emission, or separate emission-controller contract.
- Per-account claims mint directly to the beneficiary and use floor division.

The sequential curve has 99,884 positive integer-wei epochs and sums to
`979999999999999181815005172` wei if every one is nonempty. The `818184994828` wei difference from nominal 980
million GBX is deterministic fixed-point/flooring residual, not an administratively mintable reserve. Empty epochs,
unclaimed rewards, and per-account division dust can make actual lifetime minting lower.
