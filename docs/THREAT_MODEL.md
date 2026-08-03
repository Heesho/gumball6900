# Threat model

## Scope and assets

The protected assets and rights are:

- remaining GBX lifetime mint capacity;
- raw USDG and registered-asset balances in `GumBallVault`;
- the canonical Uniswap v4 position NFT and its fees;
- GBX and sGBX held by users;
- already-minted GBX in `MiningClaims`;
- accrued target tokens in `StrategyRewards`; and
- accurate strategy-budget, signal, idle-revenue, and registry accounting.

The model covers the direct contracts in `packages/contracts/src` and the one-shot minimal deployment script. It does
not treat a UI, indexer, candidate manifest, upstream audit, or local test as a trust root.

## Compatibility boundary

USDG and all acquisition or registered assets must be reviewed standard ERC-20 contracts that are non-rebasing and
non-fee-on-transfer. Exact debit/receipt equality checks fail closed; other measured deltas are accounting guards.
Neither is compatibility support. Issuer freezes, blacklists, upgrades, pauses, seizures, or later behavioral changes
remain material external risks.

## Actors

| Actor                                  | Intended capability                                           | Compromise impact                                                                                    |
| -------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| User/filler                            | Contribute, claim, stake, signal, fill, redeem, collect fees. | Can exploit public timing and rounding, but receives no administrative bypass.                       |
| Timelock proposer                      | Schedule only typed operations.                               | Can exercise the three delayed code/value surfaces and redirect future team fees or resume exposure. |
| Mature-operation executor              | Execute exact scheduled parameters.                           | No discretion, but can choose execution timing after maturity.                                       |
| Guardian operator                      | Stop new exposure and terminally disable live strategies.     | Availability loss; no direct asset movement or exit pause.                                           |
| Deployment operator                    | Complete the reviewed graph and position setup sequence.      | Can choose bad inputs or code if review/manifest controls fail.                                      |
| Token issuer/admin                     | Control external token liveness or code where applicable.     | Can break transfer and redemption liveness outside protocol controls.                                |
| Controller/strategy/NFT-recipient code | Execute admitted semantics.                                   | Can misuse the explicitly delegated surface described below.                                         |

## Primary threats

### Malicious controller replacement

A candidate can expose the expected getters while minting the token's entire remaining capacity to an arbitrary
receiver. The token cap prevents more than one billion cumulative minting, but there is no onchain schedule or
receiver attestation for replacement code. Mitigation is review plus seven days of notice, not prevention.

### Malicious NFT recipient

A scheduled recipient needs only deployed code and the ability to accept the safe transfer. It can then remove
liquidity or move the NFT. The operation transfers only the exact NFT, but that NFT represents the complete canonical
position. Mitigation is review plus notice.

### Malicious strategy admission

A contract can implement expected wiring getters and still call `releaseUSDG` without receiving target value or
burning GBX. It may choose any receiver. The vault caps loss to that strategy's current signaled budget and consumes
the budget before transfer; registry wiring checks are not bytecode attestation. Initial deployed strategies are
inactive until their separate seven-day registrations mature.

An acquisition registration also admits its rewards hook. Voter weight callbacks are strict while the strategy is
live, so a reverting rewards contract can block signal updates/reset and therefore unstaking. The guardian or
timelock can terminally disable the strategy. Later zero-weight resets do not call the disabled hook at all and clear
voter weight, restoring exit liveness even against gas-burning code. Honest rewards retain a terminal weight snapshot,
which preserves already indexed claims and is inert because canonical disabled strategies cannot notify new rewards;
the bypass cannot guarantee correct accounting inside malicious code.

### Mature-operation persistence

The timelock has neither cancellation nor expiry. A mistakenly or maliciously scheduled operation stays executable
after seven days until consumed. Monitoring must treat scheduling as the decisive security event.

### Zero-price auction fill

The exact auction transition reaches zero at the endpoint and stays zero. A filler can receive the entire immutable
USDG lot while paying zero target token or GBX if sufficient strategy budget exists. Lot, duration, initial/minimum
price, and operational monitoring must be reviewed with this behavior understood.

### Revenue-timing capture

Signals are immediate and have no minimum holding period. A staker can increase weight before a predictable mining
settlement or fee collection, receive a share of that notification, then reset and unstake. This is an intended
liquidity tradeoff, not a time-weighted allocation. Pausing increases can stop new timing exposure but cannot block
decreases or exits.

### Tiny-contribution emission capture

Any nonzero epoch receives the complete scheduled emission, independent of contribution size. A lone minimal
contributor can receive almost the whole epoch. This is explicit economics and must not be represented as a
demand-priced sale.

### Registered-token liveness failure

Redemption transfers every registered asset atomically. A token that reverts, blocks the receiver, changes behavior,
or no longer transfers exactly can block every redemption. Asset disablement does not remove it from the basket and
there is no administrator skip/substitute function. Upfront and continuous issuer/token review are required.

### Unsupported token behavior

Rebasing, fee-on-transfer, callback-rich, or otherwise exotic tokens can make observed balances inconsistent or
introduce unexpected call paths. Such tokens are out of scope. Exact transfer and reentrancy checks fail closed where
equality is required; observed-delta accounting is not evidence that these tokens are safe to register.

### Rounding and dust

Mining claims, revenue indices, strategy budgets, rewards, redemption, and v4 liquidity use integer rounding. Dust
stays in protocol custody or as unused mint capacity; there is no sweep. Independent models must match Solidity
rounding exactly.

### Front-running and stale quotes

Auction fills are public. Expected epoch ID, deadline, and caller maximum payment protect a filler from a changed
auction state or excess quote, but not from ordinary ordering competition. Users should set bounded deadlines and
maxima. At the zero-price endpoint, those controls do not create a positive payment floor.

### Deployment-input substitution

Wrong token, PositionManager, Permit2, target, pool price/range, strategy parameter, proposer, guardian, or team inputs
can produce an internally consistent but unsafe graph. The script validates code presence and wiring, not economic
suitability, source provenance, issuer policy, or runtime identity. A reviewed signed manifest and pinned-fork
rehearsal are required before any external authorization.

## Defensive properties

- Direct non-upgradeable core contracts and no generic executor reduce ambient authority.
- Cumulative supply cap survives malicious controller behavior.
- Redemption has no protocol pause and uses raw balances.
- Strategy release consumes a virtual budget before exact USDG transfer.
- Acquisition and buyback implementations move/burn payment before release.
- Terminal disablement removes disabled-strategy reward callbacks from zero-weight reset and unstake entirely.
- Registry and redemption loops are bounded to 16 entries.
- Reentrancy guards protect value-moving public paths.
- The guardian can stop new exposure but cannot block exits or move value.
- Controller replacement, NFT transfer, and registration are separately parameter-bound and delayed.

## Residual risks and release blockers

The three delayed trust surfaces are accepted, not eliminated. External-token liveness, immediate signal timing,
zero-price auctions, tiny-contribution emission capture, integer dust, and deployment-configuration errors also
remain. Production is blocked on exact inputs, full testing and independent review, chain/issuer/legal evidence, a
signed manifest, operating procedures, and resolution of the repository licensing question.
