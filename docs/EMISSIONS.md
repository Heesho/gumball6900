# GBX emissions

## Fixed token-level bounds

| Quantity                            |          Raw value |
| ----------------------------------- | -----------------: |
| Lifetime cumulative mint cap        | `1,000,000,000e18` |
| One-time constructor allocation     |    `20,000,000e18` |
| Nominal canonical mining allocation |   `980,000,000e18` |

The deployment account uses the constructor allocation only for the canonical one-sided position. Any amount v4
integer math cannot use is burned. There is no other initial GBX distribution.

## Canonical controller curve

| Parameter                     |                                         Value |
| ----------------------------- | --------------------------------------------: |
| Epoch duration                |                                       `1 day` |
| Real half-life                |                                  `1,460 days` |
| `DAILY_DECAY`                 |                     `999,525,354,337,060,160` |
| Epoch-zero scheduled emission |     `465,152,749,681,042,811,702,004` raw wei |
| Sequential scheduled total    | `979,999,999,999,999,181,815,005,172` raw wei |
| Nominal floor residual        |                     `818,184,994,828` raw wei |

The next scheduled amount is `floor(current * DAILY_DECAY / 1e18)`. The epoch-zero value is independently derived as
`floor(980,000,000e18 * (1 - 2^(-1/1460)))`; it is not derived by subtracting the rounded WAD decay constant.

For each ended epoch:

- non-empty: mint the complete scheduled amount, limited by remaining token capacity, into `MiningClaims`;
- empty: mint zero; and
- both: increment the epoch ID and decay the next scheduled amount exactly once.

There is no carry, demand scaling, mint-on-claim, or reopening of capacity after burns. The complete positive
sequence is reproduced independently in Python and TypeScript. The accepted 36,500-step schedule digest recorded by
ADR-0012 is `0x22aef4fca7057d13da902b2bd05d3fd4b3bca71cb0e4c3ca4c35a1898f2a41db`.

## Replacement caveat

Only the current controller may call the token's post-constructor mint path. After a typed seven-day delay, the
timelock can replace it with deployed code that reports the same GBX and the canonical mining pool cached by the
token. Replacement never queries the current controller and does not require an epoch or schedule value that could
become stale during the delay. These checks preserve narrow wiring continuity, not schedule semantics. A malicious
replacement can mint all remaining capacity to an arbitrary receiver. The cumulative one-billion ceiling remains
enforceable; the four-year curve does not.

## Claims

Settlement mints the whole epoch allocation before any beneficiary claim. A claim transfers:

```text
floor(beneficiaryContribution * epochEmission / totalContribution)
```

to the beneficiary. Anyone may submit that claim, but cannot redirect it. Rounding remainder stays in claims custody.
