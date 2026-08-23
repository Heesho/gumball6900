# ADR 0032: Fixed 90/10 acquired-asset settlement

- Status: superseded by ADR 0036's bounded rate and ADR 0047's direct per-purchase settlement; retained as historical
  development rationale
- Date: 2026-08-16
- Superseded by: ADR 0036's global prospective 0%-to-20% share and ADR 0047's removal of exact carry and liabilities
- Supersedes: ADR 0021 and its 100%-Fund Strategy-payment rule
- Preserves: 100% of earned USDG flowing from Resonance to the entitled Strategy, deferred fixed-destination
  settlement, permissionless retry, Fund-held GBX burning, the Bribe reward-token cap, and independently funded
  additional Bribe rewards.

## Context

ADR 0021 classified every Strategy auction payment as a fixed Fund liability and prohibited auction proceeds from
funding the paired Bribe. That uniform path isolated auction completion from Fund token behavior, but it removed the
automatic economic reward for accounts currently signaling the acquiring Strategy.

The protocol owner has selected an immutable 90/10 classification of the acquired payment asset. USDG remains the
capital allocated by Resonance and sold by Strategy; it is not the automatic Bribe reward. The buyer's payment token is
the acquired asset and therefore the token divided between Fund and the paired Bribe.

## Decision

### Fixed classification

Resonance transfers 100% of a Strategy's earned USDG to that Strategy. A Strategy purchase sells its complete
post-claim USDG inventory and pulls every nonzero payment into the paired BribeRouter. BribeRouter classifies it using
immutable constants:

```solidity
uint256 constant BPS = 10_000;
uint256 constant FUND_BPS = 9_000;
uint256 constant BRIBE_BPS = 1_000;
```

The economic destinations are:

```text
90% -> fixed Fund liability
10% -> fixed paired-Bribe reward liability
```

There is no setter, governance parameter, team fee, or caller-selected destination. The paired Strategy payment token
is registered as a reward token in the paired Bribe when the Strategy graph is created. Additional independently
funded Bribe reward tokens remain permitted within the existing fixed cap.

### Cumulative exactness

Classification is frequency-independent. BribeRouter retains a sub-token basis-point remainder and uses full-precision
arithmetic equivalent to:

```text
bribeNumerator = payment * BRIBE_BPS + priorSplitRemainder
bribeAmount = floor(bribeNumerator / BPS)
nextSplitRemainder = bribeNumerator mod BPS
fundAmount = payment - bribeAmount
```

The implementation must avoid overflowing the multiplication, for example by combining full-precision division with
`mulmod`. The remainder is a fractional Bribe entitlement expressed in basis-point numerator units, never a
withdrawable token balance or a caller-controlled destination.

For any cumulative payment total `X`, regardless of its partition into calls:

```text
cumulative Bribe classification = floor(X * BRIBE_BPS / BPS)
cumulative Fund classification = X - cumulative Bribe classification
split remainder = (X * BRIBE_BPS) mod BPS
```

Repeated one-raw-unit payments therefore cannot permanently starve the Bribe, and claim, auction, or settlement
frequency cannot change the long-run ratio.

### Isolated settlement legs

`routePayment` pulls the complete exact payment from Strategy, updates the cumulative split remainder, and records both
fixed liabilities. It does not require Fund or Bribe to accept a transfer during the auction fill.

`payFundPayment` is permissionless and pays only the fixed Fund liability. Failure preserves that liability and does
not alter the Bribe liability.

`notifyBribeReward` is permissionless and transfers only the Bribe-classified payment asset into the paired Bribe
through `notifyRewardAmount`. Failure preserves that liability and does not alter the Fund liability.

Effects are recorded before external calls and each path remains non-reentrant. No liability can be redirected or paid
twice. A failure or incompatibility on one leg cannot destroy, consume, or block permissionless retry of the other leg.

Direct payment-token donations to BribeRouter are explicit unaccounted surplus. They do not change either classified
liability or the cumulative split remainder and have no rescue or sweep path.

The conservation boundary is:

```text
total exact Strategy payments received
  = Fund liabilities created
  + Bribe liabilities created

cumulative Bribe target numerator
  = Bribe liabilities created * BPS + split remainder
```

Downstream payments, Bribe scheduling, and user claims consume their matching liabilities without changing the original
classification.

### GBX payment token

For a Strategy priced in GBX, the Fund-classified 90% becomes Fund-bound GBX and remains permissionlessly burnable
through `Fund.burnGBX` after payment. The Bribe-classified 10% becomes the paired Bribe's GBX reward. Strategy settlement
does not burn either share during the auction fill.

## Consequences

- Auction proceeds automatically fund the paired Bribe in the acquired asset, not USDG.
- The split is immutable, cumulative, and independent of payment partitioning.
- Deferred dual liabilities preserve auction liveness when either destination temporarily rejects the token.
- Bribe reward cohort timing remains the ordinary stream behavior: a payment generated by past signal may stream to
  accounts signaling during the subsequent Bribe period.
- The change requires coordinated Solidity, tests, invariant and external-fuzzer properties, mutation tests, models,
  gas evidence, ABI generation, SDK, subgraph, deployment, application, one-pager, and generated-reference updates.
- The implementation campaign now enforces this split across contracts, tests, models, ABIs, SDK, subgraph, web copy,
  and generated references. That local conformance is engineering evidence, not independent assurance or deployment
  approval.
