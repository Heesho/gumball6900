# Critical invariants

## Supply and custody

- `GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()`.
- `GBX.lifetimeMinted() == Mine.totalMined() + (Mine.genesisLiquidityMinted() ? 1_000 ether : 0)`.
- After binding, only Mine can mint; genesis authority is consumed once and never contributes to `totalMined`.
- Effective redemption supply is minted supply plus all accrued, unminted Mine emission exactly once.
- Every sGBX unit is backed one-for-one by GBX held by SignalGBX, and each account's receipt balance equals its aggregate
  paired-Bribe virtual weight.

## Mandatory exitability

- Every live or killed Strategy position has a bounded scalar `removeSignal` path that does not enumerate Strategies,
  route revenue, claim rewards, or transfer a reward token.
- A broken reward token can block only the convenience path that selected it; healthy scalar claims and principal exit
  remain available under the supported model.
- Fund redemption burns and all selected healthy-asset transfers atomically against one pre-burn denominator and
  pre-transfer balance snapshots; an omitted or reverting asset cannot poison later healthy-subset exits.
- Cap exhaustion, Router inactivity/failure, governance renunciation, Strategy death, ownership handoff, and Router
  cutover cannot confiscate or strand a user's existing canonical principal or claim through unrelated state.

## Accounting and state transitions

- Mine's aggregate pending emission equals the sum of all occupied-tenure accrual, and settlement only converts pending
  emission into minted supply at a fixed timestamp.
- Occupied slot TPS is tenure-locked; halving and Router changes affect only the documented prospective state.
- Resonance active weight equals live Strategy weight, weight changes checkpoint first, and kill excludes weight once
  while preserving prior claims and exits.
- Bribe and Resonance lifetime caps reject before checkpointing or token interaction and keep their `1e36` indices
  representable for every onchain denominator of at least one raw unit.
- Every Strategy purchase settles once, conserves the complete payment split, snapshots policy before token callbacks,
  and does not depend on BribeRouter liveness.

## Deployment and authority

- The authorized single-use launch is atomic and retryable after a revert; caller-scoped, domain-separated CREATE2
  salts prevent unrelated callers from consuming canonical outputs.
- The launcher creates a fresh canonical Pair, seeds exact balances, verifies exact LP output, locks every genesis LP at
  `address(0)`, registers exactly two Strategies, removes setup owners, and begins both two-step handoffs.
- Mine Router replacement changes only future deposits, never calls or mutates the old graph, and requires the complete
  reciprocal GBX/USDG/Fund/Router/Resonance/SignalGBX identity graph.
- Pending owners have no authority before acceptance; Mine and Resonance handoffs, cancellation, replacement,
  acceptance, and renunciation remain independent.
