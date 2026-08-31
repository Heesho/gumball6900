# Semantic diffs

Status: exact-source function map complete; expanded executable differentials remain in progress.

Every shared upstream function will be labeled `unchanged`, `parameter-only change`, `mechanically adapted`,
`behaviorally modified`, `rewritten`, or `original GumBall logic`. Each non-unchanged function must map the displaced
upstream invariant to a current executable test or an explicit coverage gap.

## Curve MultiRewards to Bribe

- Unchanged equations: last-applicable timestamp, remaining active reward, quotient-only rollover, cumulative
  reward-per-weight index, earned amount, and checkpoint-before-weight-change ordering.
- Parameter-only: index precision changes from `1e18` to `1e36`; duration becomes one fixed seven-day constant.
- Mechanical: checked Solidity and `Math.mulDiv` replace SafeMath; real staking balances become virtual signal weights.
- Behavioral: permissionless funding adds duration/remaining/lifetime gates; registry becomes append-only and capped at
  sixteen; beneficiary/Resonance claim authorization and scalar broken-token isolation are added; staking, pause,
  rescue, mutable distributor/duration, and exit functions are removed.

## Curve MultiRewards to Resonance

- Unchanged equations: one-token schedule rollover, remaining revenue, index, earned revenue, and checkpoint kernel.
- Mechanical: Strategies replace staking accounts, paired Bribes provide canonical weights, and precision is `1e36`.
- Rewritten composition: Router-only fresh funding, permissionless Strategy distribution, Strategy registration/kill,
  live-weight exclusion, factories, paired Bribe graphs, global payment split, and caller-owned cross-Bribe claims.

## Euler FeeFlowController to Strategy

- Unchanged kernel: parameter bounds, linear decay including zero at the duration boundary, deadline/epoch/slippage
  guards, multiplied next price, and min/max clamp.
- Mechanical: widened `uint256` epoch/price/timestamp fields, `Math.mulDiv`, config struct, and OZ reentrancy guard.
- Behavioral: EVC sender support and caller-selected asset arrays are removed; fixed USDG inventory is pulled from
  Resonance; empty inventory reverts; payment is split to Fund/BribeRouter under callback-stable policy; epoch IDs no
  longer wrap or alias through `uint16`.

## Euler FeeFlowController to Mine

- Shared kernel only: linear price decay, deadline/epoch/slippage guards, doubled next price, and Euler-equivalent
  `1e6`/`uint192.max` clamp.
- Rewritten behavior: sixteen slots, occupied/empty payment classification, tenure-locked issuance, constant-time
  pending emission, pull claims, genesis issuance, and validated future-only Router cutover.
- The multi-slot/emission ancestry remains unresolved and is not classified as original GumBall logic.

## Executable gaps

- randomized multi-user, multi-token reward operation sequences including zero-weight gaps and claims;
- explicit `1e18` parity and intentional `1e36` precision-divergence cases;
- lifetime-cap accept/reject differentials proving no mutation on rejection;
- Resonance top-ups, signal changes, kill, killed exits, and later claims in one model sequence;
- arbitrary Euler-valid Strategy configurations and repeated fills;
- explicit Euler `uint16` epoch-wrap/input-alias divergence versus GumBall `uint256` non-aliasing;
- arbitrary paid/zero Mine fills and multi-slot sequencing;
- an immutable exact-source hash manifest consumed by executable checks.
