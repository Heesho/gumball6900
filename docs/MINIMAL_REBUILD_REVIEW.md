# Minimal GBX rebuild: implemented design baseline

> **Status: approved for local implementation and testing only. Not audited, deployed, or release-authorized.** This
> file records the current minimal design and review conclusions. It is not a signed manifest, legal approval,
> external security report, or authorization to commit, broadcast, fund, publish, or transfer roles.

## Review conclusion

The current source tree implements a narrow combination of:

1. give.fun-style daily contributions, proportional claims, and the exact pinned reverse Dutch auction transition;
2. Liquid Signal Governance-style 1:1 staking, immediate signaling, indexed revenue allocation, and virtual-weight
   rewards; and
3. GBX-specific cumulative supply, passive raw-basket custody, fixed-lot acquisition/buyback, single-position
   liquidity custody, and in-kind redemption.

The rebuild has 14 deployed contract types plus shared libraries/abstract code. Core contracts are direct deployments.
There is no generic administrator executor, proxy upgrade path, public strategy factory, arbitrary vault call,
valuation feed, broad liquidity manager, public initial distribution mechanism, or staking withdrawal lock.

## Implemented graph

| Area        | Current implementation                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Supply      | `GBXToken` mints 20M once to the deployment account, enforces one-billion cumulative minting, and tracks irreversible burns.          |
| Emissions   | `EmissionController` advances a sequential daily four-year-half-life curve and mints complete non-empty epochs to claims custody.     |
| Mining      | `MiningPool` records payer/beneficiary, optionally routes a fixed 2% team fee, deposits exact net USDG, and settles permissionlessly. |
| Claims      | `MiningClaims` transfers already-minted floor-proportional entitlements to beneficiaries.                                             |
| Staking     | `StakedGBX` is non-transferable 1:1 weight with immediate exit after signal reset.                                                    |
| Allocation  | `AllocationVoter` holds no USDG; it indexes physically deposited revenue into virtual strategy budgets or permanent idle backing.     |
| Acquisition | One fixed USDG lot for a falling target-token quote; observed receipt goes 98/2 or 100/0 between vault and supporters.                |
| Buyback     | One fixed USDG lot for a falling GBX quote; every observed GBX unit burns before release.                                             |
| Basket      | `AssetRegistry` bounds and orders assets/strategies; `GumBallVault` holds raw balances and redeems without valuation.                 |
| Liquidity   | One hookless, single-sided v4 position; exact NFT custody; permissionless fee collection burns GBX and vaults USDG.                   |
| Controls    | A typed seven-day timelock and stop-only guardian; no generic call authority.                                                         |

## Constructor allocation and canonical position

The token constructor mints exactly `20_000_000 ether`. There is no USDG paired at initialization and no separate
initial allocation to users. The deployment script:

1. initializes the reviewed hookless GBX/USDG PoolKey;
2. computes maximal integer one-sided liquidity;
3. supplies the usable GBX principal;
4. clears approvals and burns every residual unit;
5. transfers the exact expected position NFT to `LiquidityCustodian`;
6. proves the deployment account holds no GBX; and
7. starts mining only after custody and dependency checks pass.

The position sits outside `GumBallVault` and therefore outside raw-balance redemption.

## Mining decision

The nominal post-constructor allocation is 980M. The canonical initial controller uses:

```text
DAILY_DECAY = 999_525_354_337_060_160
INITIAL_DAILY_SCHEDULED_EMISSION = 465_152_749_681_042_811_702_004
next = floor(current * DAILY_DECAY / 1e18)
```

The positive sequential schedule totals `979_999_999_999_999_181_815_005_172` raw wei, leaving
`818_184_994_828` raw wei of nominal floor residual. A non-empty epoch mints the complete scheduled amount regardless
of contribution size. An empty epoch advances without minting or carry. Claims never mint.

## Strategy deployment and activation decision

The deployment script includes one acquisition/rewards pair and one buyback strategy so their immutable wiring and
economic parameters are part of the rehearsed graph. It intentionally does not register either one. Immediately
after completion:

```text
assetCount == 1          // USDG only
strategyCount == 0
isLive(acquisition) == false
isLive(buyback) == false
```

The acquisition tuple and standalone buyback require separate typed registrations, each scheduled by the proposer
and executed only after seven days. Before registration they cannot receive signals, fill, or release USDG.

Revenue deposited before any live strategy has positive weight becomes `idleUSDG`. It remains vault backing and is
not assigned by later registration or signaling.

## Three delayed trust surfaces

The minimal graph is not fully immutable. It deliberately accepts three delayed code/value surfaces:

1. **Controller replacement.** Candidate getter checks preserve GBX/pool/epoch wiring, but do not enforce schedule or
   receiver. A malicious replacement can mint all remaining lifetime capacity to any address. The one-billion cap
   still holds.
2. **Exact NFT transfer.** The recorded position may be transferred to any nonzero deployed-code recipient. That code
   can control the complete position after transfer; code presence is not successor attestation.
3. **Strategy admission.** Registry checks selected target/reward/registry getters, not runtime bytecode or behavior.
   Any live strategy may release no more than its current signaled USDG budget, but it selects the receiver and need
   not implement an honest auction, acquisition, or burn.

Each action has a fixed seven-day typed delay. The delay is observable warning, not semantic enforcement. Scheduled
operations have no cancellation or expiry and remain publicly executable after maturity until consumed.

The third surface means statements such as “vault value can only move after target delivery” apply to the currently
reviewed acquisition and buyback implementations, not to arbitrary future registered code.

Acquisition registration also admits its rewards hook. While live, a reverting hook can block voter weight changes,
including reset, and therefore prevent unstake. Terminal guardian/timelock disablement removes that hook from the
zero-weight path: the voter makes no rewards call, clears its own user weight, and restores unstaking liveness even
against gas-burning code. Honest rewards retain a terminal weight snapshot and already indexed claims; this does not
repair malicious rewards accounting.

## Token compatibility decision

USDG and every acquisition or registered asset are required to be reviewed standard ERC-20 contracts, non-rebasing
and non-fee-on-transfer. Exact debit/receipt assertions fail closed; other observed deltas are accounting guards.
Neither supports taxed, rebasing, callback-rich, or otherwise exotic assets. Issuer freezes, blocklists, upgrades,
pauses, or seizures remain external liveness risks.

## Pinned upstream provenance

Implementation and parity work uses immutable commits, not moving branches.

| Source                   | Commit                                     | Relevant file                               | SHA-256                                                            |
| ------------------------ | ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------ |
| give.fun                 | `ef6ee14a454432210d13e312d0ef825f670bd79d` | `packages/hardhat/contracts/Auction.sol`    | `9f948f2b44afc37957df276daf57639cfe088dbb8704891edfe353bdfa87d784` |
| give.fun                 | same                                       | `packages/hardhat/contracts/Fundraiser.sol` | `1881cb68f7c6e59fe8a203473ca1f85c1ecd0437c01e72b953f6d476b2308b52` |
| give.fun                 | same                                       | `packages/hardhat/contracts/Coin.sol`       | `df62bad7f9795e79f7d161d901745440e7febb3f303ae2f7766985e228472345` |
| give.fun                 | same                                       | `packages/hardhat/contracts/Core.sol`       | `62cc51ff67bf73c6fadf873a1f74f656db43737bb6fee82b4c1b0873b40fd316` |
| Liquid Signal Governance | `14b5fbbbe1945f2e6501f84976e5f12b39fb227a` | `contracts/GovernanceToken.sol`             | `c92f1f8dec9ce1e19e0bcad96c1c57910bfcf5c788c0df890deb094d6c51abb3` |
| Liquid Signal Governance | same                                       | `contracts/Voter.sol`                       | `871549e7aec53b2e3ded7f95528f4cb41f7a99a4abd188fa7f2a2aab83adf7a8` |
| Liquid Signal Governance | same                                       | `contracts/Bribe.sol`                       | `bbda3c0bd967e9f596457abf741de1a0e2e40cd5e81835a56c4ed7225b6c71f1` |
| Liquid Signal Governance | same                                       | `contracts/RevenueRouter.sol`               | `96efda7a0e7c1715a7adc62ba9c02a54eb66ebc23af6c101c47ab96f29472226` |
| Liquid Signal Governance | same                                       | `contracts/Strategy.sol`                    | `eb89ccdf1f99dc24735cc009de908bd18ca295e2852c7880f821579c3697c372` |
| Euler Fee Flow           | `3bee858a1568d1313f37d615953f83391a897866` | `src/FeeFlowController.sol`                 | `b2ae9c1067bd6b6964bb1e91776d181ac89eefca69c9e3795f9229b393067abc` |

give.fun `Auction.sol` is the sole behavioral authority for the auction transition. Euler Fee Flow is not an
implementation authority, but is disclosed because give.fun and LSG identify it as transitive ancestry. Upstream
tests, audit history, production use, or reputation do not provide audit coverage for GBX adaptations.

## Behavioral classification

### Preserved narrowly

- fixed daily contribution epochs and payer/beneficiary attribution;
- floor-proportional claims;
- exact auction price, deadline, epoch, multiplier, and clamp ordering;
- 1:1 non-transferable staking and reset-before-exit;
- immediate absolute signaling and global/strategy revenue indices; and
- virtual supporter-weight reward accrual.

### GBX-specific adaptations

- 20M constructor liquidity allocation plus one-billion cumulative cap;
- complete non-empty daily emission rather than contribution-demand scaling;
- passive raw-basket custody and unpausable in-kind redemption;
- fixed-lot target acquisition and observed 98/2 split;
- observed GBX burn before buyback release;
- virtual budgets backed by USDG already held in the vault;
- one exact canonical position NFT; and
- typed delayed controls with the three explicit trust surfaces.

### Deliberately absent

- any additional initial GBX distribution or USDG collection phase;
- contribution cancellation or repayment paths;
- mint-on-claim, claim redirect, expiry, or administrator dust sweep;
- time locks, transferable staking receipts, delegation, or DAO execution;
- a revenue-custody router or physical USDG in the voter;
- variable lots, partial lots, auction restart authority, or valuation feeds;
- generic strategy deployment or automatic strategy activation;
- broad liquidity management, extra positions, principal withdrawal, or arbitrary migration;
- basket substitution, generic vault calls, or redemption pause; and
- proxies or a general-purpose timelock executor.

## Security-critical implementation order

Value-moving code follows checks/effects/interactions and reentrancy protection. Physical USDG must enter the vault
before notification. Strategy budget is consumed before vault transfer. Acquisition moves target value before release
and buyback burns GBX before release. Redemption snapshots raw balances, burns, scales budgets, and transfers atomically.

These sequencing properties remain subject to the strategy-admission caveat: the vault itself cannot force arbitrary
future live strategy code to follow the reviewed acquisition/buyback sequence.

## Licensing finding

The reviewed give.fun and LSG Solidity files carry MIT SPDX headers, but neither pinned checkout contained a tracked
root license/notice file. give.fun `Auction.sol` and LSG `Strategy.sol` identify Euler Fee Flow ancestry; the matching
pinned Euler source is GPL-2.0-or-later. No separate permission or dual-license evidence has been identified. LSG also
names Solidly and Synthetix ancestors without exact repository/commit/path evidence.

The chain-of-title question is unresolved. This engineering review does not conclude that an MIT header cures the
Euler ancestry or select a distribution license. Original GBX files retain BUSL-1.1 headers pending counsel. `NOTICE`
records the evidence, and distribution remains blocked until counsel resolves repository licensing, file SPDX
treatment, attribution, notices, and any source-availability obligations.

## Required validation

- source-faithful auction differential vectors, including the exact zero-price endpoint;
- token supply/emission parity across Solidity, Python, and TypeScript;
- contribution, claims, staking, signaling, reward, strategy, vault, redemption, guardian, and timelock suites;
- adversarial registration tests proving getter checks do not imply code attestation;
- controller-cap and NFT-recipient trust-surface tests;
- standard-token compatibility tests plus fail-closed incompatible-token cases;
- one-position math/custody/fee integration tests;
- a complete deployment rehearsal proving strategies stay inactive; and
- ABI, SDK, subgraph, UI, and simulation synchronization after interface stabilization.

## Outstanding production inputs and gates

Production remains blocked on:

- exact USDG, acquisition target, PositionManager, and Permit2 addresses/code/issuer review;
- proposer, guardian, and optional team identities and operating policies;
- initial v4 price, fee, spacing, one-sided range, and token-ID/position plan;
- acquisition and buyback lots, initial/minimum prices, shared duration, and multiplier;
- pinned network-fork evidence and transaction/recovery plan;
- complete test and independent security/economic review;
- licensing and legal resolution;
- signed manifest, monitoring, incident response, and public evidence; and
- explicit external authorization for every broadcast, verification, role transfer, funding, or publication action.

No unresolved value may be invented or labeled canonical.
