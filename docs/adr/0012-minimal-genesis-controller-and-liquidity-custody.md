# ADR-0012: Constructor Liquidity and Three Delayed Trust Surfaces

- Status: accepted for local implementation; not release-authorized
- Date: 2026-08-03
- Decision owners: protocol engineering, economic review, and security review

## Context

The minimal protocol needs a bounded initial liquidity allocation, a daily mining schedule, one canonical Uniswap v4
position, a small strategy graph, and enough delayed evolution to replace issuance code, hand off the position, and
admit strategies. The design must state those authorities honestly rather than describe the system as completely
immutable.

## Decision

### One 20M constructor allocation

`GBXToken` is a direct non-proxy ERC-20. Its constructor mints exactly `20_000_000 ether` to the deployment account and
counts it in `cumulativeMinted`. There is no other initial GBX allocation and no initial USDG collection.

The deployment script initializes a reviewed hookless GBX/USDG v4 pool, creates one entirely single-sided position
with maximal integer GBX principal, burns every unusable residual unit, clears approvals, and transfers the exact
expected NFT to `LiquidityCustodian`. Mining starts only after custody and dependency invariants pass. The deployment
account must finish with zero GBX and no unconsumed initialization authority.

The position is outside `GumBallVault` and outside raw-basket redemption.

### Canonical daily schedule

The nominal post-constructor allocation is `980_000_000 ether`. The initial controller uses one-day epochs and:

```text
DAILY_DECAY_WAD = 999_525_354_337_060_160
INITIAL_DAILY_SCHEDULED_EMISSION = 465_152_749_681_042_811_702_004
next = floor(current * DAILY_DECAY_WAD / 1e18)
```

The initial value is `floor(980_000_000 ether * (1 - 2^(-1/1460)))`, preserving the real four-year-half-life
derivation. It is not derived from `1e18 - DAILY_DECAY_WAD`.

Sequential floor rounding totals `979_999_999_999_999_181_815_005_172` raw wei and leaves
`818_184_994_828` raw wei of nominal residual. The accepted 36,500-step schedule digest is
`0x22aef4fca7057d13da902b2bd05d3fd4b3bca71cb0e4c3ca4c35a1898f2a41db`.

A non-empty ended epoch mints the complete available scheduled amount into `MiningClaims`. An empty epoch mints zero,
advances once, and carries nothing. Claims transfer already-minted GBX. Burns never restore capacity.

### Trust surface 1: controller replacement

The token stores one current controller and caches the canonical mining pool during initial binding. A named
seven-day operation can replace the controller. Candidate code must report the same GBX and cached pool. Validation
never calls the current controller and does not require an epoch or schedule checkpoint that permissionless
settlement could make stale during the delay. The candidate's scheduled amount, transition, and mint receiver are not
attested.

The proposer can therefore select malicious compatible code that mints all remaining lifetime capacity to an
arbitrary receiver. The delay provides notice. The token-level guarantee is only:

```text
cumulativeMinted <= 1_000_000_000 ether
```

The four-year schedule is not immutable against replacement.

### Trust surface 2: exact position-NFT recipient

`LiquidityCustodian` accepts exactly one NFT from the configured PositionManager, deployment depositor, expected
token ID, and PoolKey. Anyone may collect fees; GBX fees burn and exact USDG fees enter the vault before notification.
The custodian exposes no principal withdrawal, approval, rescue, range change, or arbitrary PositionManager call.

A separate named seven-day operation can transfer that exact NFT to any nonzero deployed-code recipient. Recipient
code is not interface- or bytecode-attested. After transfer, it controls the complete canonical position and the
original custodian's restrictions no longer protect it.

### Trust surface 3: strategy-code admission

The deployment script creates one acquisition/rewards pair and one buyback strategy, validates selected wiring and
economic getters, and deliberately leaves both unregistered and inactive. The initial registry contains USDG only.

Acquisition tuple registration and standalone buyback registration are separate named seven-day operations. Registry
checks selected getters, not runtime bytecode or behavior. Each successful registration atomically starts the honest
strategy's one-time auction clock at the full initial price, so pre-registration time does not age it. Once live, any
strategy can ask `GumBallVault` to release no more than its current signaled USDG budget to a receiver chosen by that
strategy. The vault cannot prove that the strategy first received target value, burned GBX, or followed the reviewed
auction.

The acquisition rewards hook is also admitted code. Its weight callback is strict while live and may block reset and
unstake if malicious or faulty. After terminal strategy disablement, zero-weight reset skips the rewards callback
entirely and still clears voter weight, restoring exit liveness even against gas-burning code. Honest rewards retain a
terminal weight snapshot and previously indexed claims; this does not claim to repair malicious rewards accounting.

Revenue received before registration, or whenever total active weight is zero, becomes idle backing and is never
assigned retroactively.

### Standard-token compatibility

USDG and every acquisition or registered asset must be standard ERC-20 code, non-rebasing and non-fee-on-transfer.
Exact debit/receipt assertions fail closed; other measured deltas are accounting guards. Neither is exotic-token
support. Issuer control and later token behavior changes remain external liveness risks.

### No broad upgrade authority

The rebuild adds no proxy, beacon, generic executor, public factory, arbitrary vault call, LSG replacement mechanism,
generic liquidity migration, or basket-movement authority. The three surfaces above are specific and must not be
generalized in documentation.

## Consequences

- Lifetime cumulative minting remains bounded, but issuance timing and receiver can change after notice.
- Canonical liquidity starts under a minimal custodian, but the entire position can be handed to arbitrary reviewed
  recipient code after notice.
- Strategy loss is bounded by current signaled budget, but admitted code can choose any receiver and need not follow
  reviewed payment semantics.
- Strategy activation is a distinct security event after deployment, not an automatic setup step.
- Pre-activation revenue remains idle/nonretroactive.
- Mature scheduled operations have no cancellation or expiry; scheduling requires final parameter review.
- Deployment is operationally sensitive and external broadcasts consist of multiple transactions that require
  receipt-by-receipt reconciliation.

## Rejected alternatives

### Additional initial distribution machinery

Rejected because the minimal graph needs only the 20M constructor liquidity allocation and daily mining.

### Permanently fixed controller

Rejected because delayed replacement is accepted, while the cumulative token cap remains immutable.

### Automatic strategy registration

Rejected because deployment completion should not silently grant vault-release authority. Each strategy admission
must be separately visible for seven days.

### Treat wiring getters as code attestation

Rejected because a malicious contract can return expected values without implementing honest value flow.

### Keep v4 rounding residual

Rejected because the deployment account must end with zero GBX and unusable position dust has no approved custodian.

### General migration or proxy framework

Rejected because it would materially enlarge administrative authority beyond the three accepted surfaces.

## Provenance and release boundary

give.fun `Auction.sol` at `ef6ee14a454432210d13e312d0ef825f670bd79d` is the sole auction-transition authority.
Liquid Signal Governance at `14b5fbbbe1945f2e6501f84976e5f12b39fb227a` is the selected staking/accounting source.
Both selected upstreams disclose ancestry that raises an unresolved GPL-2.0-or-later Euler Fee Flow chain-of-title
question, detailed in `NOTICE`.

This ADR selects no repository distribution license and makes no legal conclusion. Original GBX adaptations retain
BUSL-1.1 headers pending counsel. Upstream tests, audits, history, or production use do not cover GBX changes.

Required evidence includes Solidity/Python/TypeScript schedule parity, source-faithful auction differential tests,
malicious-controller/recipient/strategy tests, standard-token compatibility review, complete deployment rehearsal,
independent security/legal review, exact production inputs, and a signed manifest. No local result authorizes a
broadcast, verification, role transfer, funding, package/site publication, or production-readiness claim.
