# GUM BALL 6900 internal fact registry

> Internal working document. This registry is the evidence base for the public one-pager, layman's article, and
> technical whitepaper. It is engineering evidence only: it is not an audit, a deployment authorization, a legal
> conclusion, or a claim that the protocol is safe for user funds.

- **Current source state:** uncommitted development tree based on `e3ebdd7987653969b31dbf0e8d20b68a838dfa5d`
- **Historical fact baseline:** `dc67d7c4d634097fa6e285fa33ce964d591d2bd2`
- **Working tree at current revision:** dirty; no reviewed candidate commit is pinned
- **Registry revision date:** 2026-08-22

> **Revision note.** Earlier drafts of this registry and its three public documents were written against commits
> `281e601` and then `95ed60e`. Two later changes superseded them. ADR 0033 fixed the Mine at sixteen permanent slots
> with constant-time pending emission, removing capacity governance and the all-slot checkpoint. ADR 0034 deleted
> `ProtocolGovernor` and the protocol `TimelockController` entirely, leaving `Resonance` owned by an external
> governance system that has not been selected; ADR 0035 added the Bribe lifetime reward cap. Those historical
> revisions were re-derived against `dc67d7c`. ADRs 0036-0044 and the current Mine work were subsequently checked
> against an uncommitted development tree based on `40d919e`. HEAD later advanced to `e3ebdd7` for deck and landing-page
> work without changing the protocol source; the current uncommitted tree is therefore based on `e3ebdd7`. Facts
> carrying older commit stamps identify the tree where that unchanged claim was originally verified; facts changed by
> the current work carry an explicit uncommitted or historical commit stamp. **Section E was rewritten in full: every
> ProtocolGovernor, Timelock, proposal-lifecycle, quorum, and cancellation fact from earlier editions describes
> contracts that no longer exist.**

> **Mine-halving revision.** ADR 0041 supersedes the cumulative-mining halving rule in ADR 0024/0033 and the
> `HALVING_AMOUNT` selected by ADR 0038. ADR 0042 sets the current development candidate's provisional 69-day schedule
> and 64 GBX-per-second initial rate; ADR 0043 sets its 1 GBX-per-second tail. This revision is not deployment approval;
> independent economic research remains an open gate.

> **Mine-routing revision.** ADR 0044 makes exact delivery into ResonanceRouter the terminal Mine revenue action.
> Mine emits `RevenueDeposited` and never calls `route()`; Router forwarding is a later permissionless action with no
> role, bounty, or liveness guarantee. LiquidityPosition's atomic route attempt is unchanged.

- **Solidity source tree:** `packages/contracts/src`
- **Compiler:** Solidity `0.8.26`, Cancun target (EIP-1153 transient storage is required)

## How to read this registry

Every fact carries the source state it was verified against. "Verified" means the claim was read directly out of the
Solidity in that listed state, not inferred from a filename, a summary document, or an ADR narrative. Where a document
in the repository disagrees with the Solidity, the Solidity wins and the discrepancy is recorded in
[Unresolved discrepancies](#unresolved-discrepancies).

**Status vocabulary used throughout:**

| Status                 | Meaning                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `implemented`          | Present in the listed Solidity source state and covered by at least one named test.       |
| `implemented-untested` | Present in the listed Solidity source state; no targeted test was found.                  |
| `config-dependent`     | Behavior is real, but its economic magnitude depends on unselected deployment parameters. |
| `accepted-limitation`  | Known behavior deliberately accepted by an ADR rather than fixed.                         |
| `open-gate`            | Unresolved release blocker recorded in the internal finding register.                     |

## Authoritative and superseded sources

ADR supersession was read from each ADR's own `Status` line in the current source state. Several ADRs are **partially** superseded:
the accepted part is authoritative and the superseded part must not be presented as current behavior.

### Currently authoritative (in whole or in part)

| ADR      | Title                                                        | Authoritative for                                                                                                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 0017 | Remove successor migration; ownerless Fund and LP            | Fully accepted. No successor, migration, or owner on Fund/LiquidityPosition.                                                                                                                                                                                                                              |
| ADR 0022 | Fixed-principal LP fee routing                               | Fully accepted. Harvest routes USDG, burns GBX, never touches principal.                                                                                                                                                                                                                                  |
| ADR 0024 | Immutable multislot Mine with tenure-locked rates            | Supply model and tenure rate lock. Its cumulative-mining halving model is superseded by ADR 0041; its GBX-ERC20Votes statement by ADR 0030; its capacity, checkpoint, redemption-denominator, and Mine-administration decisions by ADR 0033; its synchronous downstream route by ADR 0044.                |
| ADR 0027 | Fix Bribe carry before signal-supply boundaries              | Fully accepted. Bribe carry classification to Fund.                                                                                                                                                                                                                                                       |
| ADR 0028 | Closed Bribe pools after Strategy death                      | Fully accepted, including the accepted permanent-abandonment consequence.                                                                                                                                                                                                                                 |
| ADR 0029 | Bribe-based Resonance reward stream                          | Resonance streaming, `1e36` index, accepted surplus. Signal entrypoints and state ownership superseded by ADR 0030 then 0031; kill-final-Strategy by 0031; 100%-Fund by 0032; intended Timelock owner by 0034; Mine's synchronous route attempt by ADR 0044.                                              |
| ADR 0030 | SignalGBX coordination and selector-bounded token governance | Non-transferable ERC20Votes sGBX only. Its ProtocolGovernor, Timelock, selector-filter, and cancellation decisions are superseded by ADR 0034; its idle-sGBX and `allocatedBalance` decisions by ADR 0031.                                                                                                |
| ADR 0031 | Mandatory signal-backed SignalGBX                            | No idle sGBX; atomic signal/withdraw; `balanceOf` is the aggregate; final live Strategy cannot be killed. Its retention of the Governor and Timelock is superseded by ADR 0034.                                                                                                                           |
| ADR 0032 | Fixed 90/10 acquired-asset settlement                        | 90% Fund / 10% paired Bribe, cumulatively exact and frequency-independent.                                                                                                                                                                                                                                |
| ADR 0033 | Fixed Mine slots and constant-time pending emission          | Sixteen permanent slots, no capacity governance, no owner, no all-slot checkpoint; constant-time pending emission and the `effectiveTotalSupply` redemption denominator. Its cumulative-mining rate-selection rule is superseded by ADR 0041.                                                             |
| ADR 0034 | External governance ownership                                | **New.** No core Governor, Timelock, executor, or adapter. `Resonance` is the only contract with continuing custom owner authority; its external owner is unselected, the three setup-only Ownable shells must be renounced, and deployment is blocked until a later ADR pins the governance integration. |
| ADR 0035 | Bribe lifetime reward cap                                    | Monotonic per-token `lifetimeRewardNotified` counter; its original `1e18` precision and numeric cap are superseded by ADR 0037.                                                                                                                                                                           |
| ADR 0036 | Bounded dynamic acquisition split                            | Prospective global automatic-Bribe share from 0% through 20%, with exact weighted carry and Fund complement.                                                                                                                                                                                              |
| ADR 0037 | High-precision Bribe reward index                            | `1e36` Bribe index and precision-coupled lifetime notification cap.                                                                                                                                                                                                                                       |
| ADR 0038 | Fixed Mine economics                                         | Fixed replacement multiplier and starting-price floor. Its initial rate is superseded by ADR 0042, its tail rate by ADR 0043, and its `HALVING_AMOUNT` by ADR 0041.                                                                                                                                       |
| ADR 0039 | Event-only Mine messages                                     | Optional handoff message capped at 280 raw bytes and emitted only in `Mined`.                                                                                                                                                                                                                             |
| ADR 0040 | Deployment-time Mine authority verification                  | Removal of the per-handoff authority check; deployment evidence must prove the permanent GBX minter binding.                                                                                                                                                                                              |
| ADR 0041 | Time-based Mine halvings                                     | Deployment-time halving shape, time anchor, tail clamp, and tenure-lock consequences. Its provisional `4 * 365 days` period and 4 GBX/second initial rate are superseded by ADR 0042; its 0.01 GBX/second tail by ADR 0043.                                                                               |
| ADR 0042 | Provisional accelerated Mine emissions                       | Current provisional 64 GBX/second initial rate and 69-day periods. Its 0.5 GBX/second tail is superseded by ADR 0043. Independent economic review remains open.                                                                                                                                           |
| ADR 0043 | Provisional one-GBX Mine tail                                | Current provisional 1 GBX/second tail; it begins at the sixth 69-day boundary. Independent economic review remains open.                                                                                                                                                                                  |
| ADR 0044 | Decouple Mine handoffs from revenue routing                  | Mine exact-deposits the protocol share into ResonanceRouter and emits `RevenueDeposited` without calling `route()`. Permissionless routing has no role, bounty, or liveness guarantee; LiquidityPosition remains atomic.                                                                                  |

### Historical context only — partially superseded

| ADR      | Superseded provisions that must not be presented as current                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 0013 | Acquisition-split and buyback provisions (by ADR 0021, then 0032); external proposer/canceller model (by ADR 0030, then removed entirely by ADR 0034).        |
| ADR 0014 | GBX mint authority and distribution (by ADR 0024); fee routing (by ADR 0018, then ADR 0022).                                                                  |
| ADR 0015 | Whole-account action/event examples (by ADR 0019); public coordination surface (by ADR 0030).                                                                 |
| ADR 0016 | Terminology and implementation details; "management fee" wording means the bounded acquisition auction.                                                       |
| ADR 0019 | Resonance batch/enumeration APIs (by 0029); direct Resonance signal entrypoints and aggregate state (by 0030); idle-allocation and standalone exit (by 0031). |
| ADR 0020 | Resonance carry, donation synchronization, Resonance Fund-liability (by 0029); Strategy routing (by 0021, then **0032**).                                     |

### Fully superseded — excluded from all public documents

| ADR      | Title                                              | Superseded by |
| -------- | -------------------------------------------------- | ------------- |
| ADR 0018 | Auto-compounding liquidity position                | ADR 0022      |
| ADR 0021 | Uniform Strategy settlement into Fund (100%-Fund)  | **ADR 0032**  |
| ADR 0023 | Fixed GBX supply and pre-funded Fundraiser reserve | ADR 0024      |
| ADR 0025 | Global seven-day Resonance revenue stream          | ADR 0026      |
| ADR 0026 | Exact active-plus-successor Resonance stream       | ADR 0029      |

> **ADR 0021 became fully superseded between drafts.** Its 100%-Fund settlement rule was the basis for several claims
> in an earlier version of these documents and must no longer be presented as current behavior anywhere.

> **ADR 0030's governance half was removed, not merely superseded.** `ProtocolGovernor.sol`, its tests, ABIs, SDK
> lifecycle helpers, and subgraph data sources were deleted by ADR 0034. No proposal, quorum, voting-period, delay, or
> cancellation claim has any source of enforcement in the current tree. ADR 0030 remains authoritative only for the
> non-transferable ERC20Votes properties of `SignalGBX`.

### Historical audit documents — excluded as current evidence

`packages/contracts/audit/AUDIT-BASELINE.md` and `packages/contracts/audit/TEST-CAMPAIGN.md` both carry explicit
"Historical evidence only" banners and review commit `54e3f2c3ce1de25aea4da2f21fab27804a3bfa84` (2026-08-09), before
the ADR 0024 Mine redesign and the ADR 0029/0030/0031/0032 changes. Their counts (including "340 passed") **must not**
be reported as current. `packages/contracts/audit/FINDINGS.md` is the current disposition register, reconciled on
2026-08-22 through ADR 0044; campaign-specific findings are in
`packages/contracts/audit/SIGNAL-RESONANCE-FINDINGS.md`.

**Static analysis, external fuzzing, and mutation results are also historical.** The pinned static-analysis and native
external-fuzzer campaigns predate substantial current architecture changes. A later narrow 49-mutant
Signal/Resonance campaign covers ADRs 0036/0037 but predates ADR 0043. None may be presented as complete current-tree
evidence.

There is also a stale compiler artifact for a removed contract, `Fundraiser.sol`, under
`packages/contracts/artifacts/hardhat/src/core/`. No `Fundraiser.sol` exists in `packages/contracts/src`. The
Fundraiser design was superseded by ADR 0024 and must not appear in any public document.

---

# Facts

## A. What GBX is

### FACT-GBX-01 — GBX is a plain transferable ERC-20 with permit and no vote checkpoints

- **Plain-English claim:** GBX is an ordinary transferable token. It can be moved, staked, and burned, and it supports
  gasless approvals, but holding GBX alone gives no governance vote.
- **Technical formulation:** `contract GBX is ERC20, ERC20Permit`. Name `"GUM BALL 6900"`, symbol `"GBX"`, 18 decimals
  (inherited default). `ERC20Votes` is **not** inherited, so there are no vote checkpoints and no `delegate` surface.
- **Source:** `packages/contracts/src/core/GBX.sol:15`
- **Functions/state:** `constructor`, `permit` (via `ERC20Permit`), `transfer`, `approve`
- **ADR:** ADR 0030 (supersedes the ADR 0024 statement that GBX carries ERC20Votes)
- **Tests:** `test_PermitGrantsAllowanceAndCannotBeReplayed`, `test_PermitRejectsExpiredDeadline`,
  `test_ConstructorCreatesOnlyGenesisLiquiditySupply`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Governance weight exists only after GBX is staked into SignalGBX (FACT-SGBX-01).

### FACT-GBX-02 — GBX creates exactly 20,000,000 tokens at construction, for genesis liquidity only

- **Plain-English claim:** The token contract creates 20 million GBX once, at deployment, for the permanent liquidity
  position. There is no team allocation, presale, or airdrop in the token contract.
- **Technical formulation:** `GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 ether` = `20000000 * 10^18` raw units. The
  constructor sets `lifetimeMinted = GENESIS_LIQUIDITY_ALLOCATION` and mints that amount to
  `genesisLiquidityRecipient`.
- **Source:** `packages/contracts/src/core/GBX.sol:17`, `:42-54`
- **Functions/state:** `GENESIS_LIQUIDITY_ALLOCATION`, `lifetimeMinted`, `constructor`
- **ADR:** ADR 0024 (supersedes ADR 0014 distribution)
- **Tests:** `test_ConstructorCreatesOnlyGenesisLiquiditySupply`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** The 20 million allocation goes to a `genesisLiquidityRecipient` constructor argument. That the recipient
  converts it into the canonical Uniswap v4 position is a _deployment procedure_ (`docs/DEPLOYMENT.md` step 7), not a
  constraint enforced by `GBX.sol`.

### FACT-GBX-03 — Supply reconciles exactly as minted minus burned; there is no protocol supply cap

- **Plain-English claim:** Total GBX in existence always equals everything ever created minus everything ever
  destroyed. The contract sets no maximum supply.
- **Technical formulation:** `GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()` holds at every block.
  No constant, require, or branch bounds `lifetimeMinted`.
- **Source:** `packages/contracts/src/core/GBX.sol:23-26`, `:82`, `:91`
- **Functions/state:** `lifetimeMinted`, `lifetimeBurned`, `mint`, `burn`
- **ADR:** ADR 0024
- **Tests:** `testFuzz_SupplyEqualsLifetimeMintedMinusBurned`, `invariant_GBXSupplyReconcilesWithBurns`,
  `test_GBXSupplyReconcilesContinuousIssuanceAndBurns`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Issuance is bounded by time and rate, not by a cap. With a strictly positive tail rate (FACT-MINE-07),
  supply grows without limit over infinite time.

### FACT-GBX-04 — Mint authority is handed to one Mine exactly once and can never be changed again

- **Plain-English claim:** After deployment, exactly one contract can ever create new GBX, and that assignment is
  permanent. There is no way to add, replace, or revoke a minter.
- **Technical formulation:** `setMinter` requires `msg.sender == minter`, reverts if `minterLocked`, rejects zero,
  self, and code-less targets, and requires `IMine(newMinter).gbx() == address(this)`. It then sets
  `minterLocked = true` permanently. `mint` requires both `msg.sender == minter` and `minterLocked == true`.
- **Source:** `packages/contracts/src/core/GBX.sol:57-85`
- **Functions/state:** `minter`, `minterLocked`, `setMinter`, `mint`
- **ADR:** ADR 0024, ADR 0017
- **Tests:** `test_MinterHandoverIsOneTimeAndRequiresDeployedCode`, `test_OnlyPermanentlyBoundMineCanMint`,
  `test_BurnTracksCumulativeSupplyDestructionWithoutReopeningHandover`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** The reciprocal check confirms the target _claims_ the same GBX. It cannot distinguish a malicious
  lookalike that returns the expected identity. This is finding M-03, an open release gate (FACT-STATUS-04). Mine does
  not repeat the permanent-authority reads on each handoff; deployment verification is mandatory under ADR 0040.

### FACT-GBX-05 — Anyone may burn their own GBX; burning never reopens mint authority

- **Plain-English claim:** Any holder can permanently destroy their own GBX. Doing so does not unlock minting.
- **Technical formulation:** `burn(uint256 amount)` burns from `msg.sender` only, increments `lifetimeBurned`, and
  touches neither `minter` nor `minterLocked`. Zero is rejected.
- **Source:** `packages/contracts/src/core/GBX.sol:88-94`
- **Functions/state:** `burn`, `lifetimeBurned`
- **ADR:** ADR 0024
- **Tests:** `test_BurnRejectsZeroAndExcess`, `test_BurnTracksCumulativeSupplyDestructionWithoutReopeningHandover`
- **Status:** `implemented`
- **Commit:** `281e601`

---

## B. GBX issuance and mining

### FACT-MINE-01 — Mine issues GBX continuously to whoever currently occupies each slot

- **Plain-English claim:** GBX is created second by second and credited to the current occupant of each mining slot.
- **Technical formulation:** For each occupied slot, accrual is `(block.timestamp - slot.lastAccruedAt) * slot.tps`
  raw GBX units. A handoff mints only that outgoing slot's amount to `slot.miner`. `tps` means GBX raw token units
  (18 decimals) per second.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `slots`, `Slot.tps`, `Slot.lastAccruedAt`, `pendingEmission`, `totalMined`
- **ADR:** ADR 0033
- **Tests:** `test_StaggeredSlotsSettleIndependentlyWhileCachedTotalRemainsExact`,
  `test_EffectiveSupplyIncludesPendingEmissionWithoutMintingOrChangingSlots`,
  `invariant_EffectiveSupplyIncludesEveryPendingEmission`, `invariant_MiningPendingAndTpsCachesMatchEverySlot`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Accrual is _lazy_. GBX is not minted until that slot changes hands. `GBX.totalSupply()` therefore
  understates economic supply between slot settlements; `Mine.effectiveTotalSupply()` is the inclusive figure.

### FACT-MINE-02 — Mine has exactly 16 permanent slots

- **Plain-English claim:** The mine opens with sixteen empty slots and the slot count can never change.
- **Technical formulation:** `SLOT_COUNT = 16`; construction initializes every index `0..15`. Mine has no owner and
  no capacity-changing function.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `SLOT_COUNT`, `slots`
- **ADR:** ADR 0033
- **Tests:** `test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority`,
  `invariant_MiningPendingAndTpsCachesMatchEverySlot`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-MINE-03 — Each slot is an hourly linear reverse Dutch replacement auction

- **Plain-English claim:** The price to take over a mining slot falls in a straight line to zero over one hour, then
  stays at zero until someone takes it.
- **Technical formulation:** With `e = block.timestamp - slot.auctionStartedAt` and
  `D = PRICE_DECAY_PERIOD = 1 hours = 3600`:
  `price(e) = slot.initialPrice - floor(slot.initialPrice * e / D)` for `e < D`, and `price(e) = 0` for `e >= D`.
- **Source:** `packages/contracts/src/core/Mine.sol:31`, `:400-404`
- **Functions/state:** `PRICE_DECAY_PERIOD`, `price`, `_price`, `Slot.initialPrice`, `Slot.auctionStartedAt`
- **ADR:** ADR 0024
- **Tests:** `testFuzz_PriceMatchesTheExactLinearFormula`, `testFuzz_PriceIsMonotonicallyNonIncreasingWithinAnEpoch`,
  `test_PriceDecaysLinearlyToZeroAcrossTheEpoch`, `test_PriceStaysAtZeroLongAfterTheEpochEnds`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Because `floor` is applied to the subtracted term, `price(e)` is a non-increasing step function, not an
  exact real-valued line. Rounding favors the seller (the price is at or above the ideal line).

### FACT-MINE-04 — A replacement pays USDG; 80% becomes the displaced miner's pull claim and 20% is deposited into ResonanceRouter

- **Plain-English claim:** When you take over an occupied slot, 80% of what you pay goes to the miner you displaced
  and 20% becomes protocol revenue. If the slot was empty, 100% is protocol revenue.
- **Technical formulation:** `PREVIOUS_MINER_BPS = 8_000`, `BPS = 10_000`. For `paid > 0` and a nonzero
  `previousSlot.miner`: `previousMinerAmount = floor(paid * 8000 / 10000)`, `revenueAmount = paid - previousMinerAmount`.
  For `previousSlot.miner == address(0)`: `revenueAmount = paid`. For `paid == 0`: both are zero and no token moves.
  Mine exact-transfers `revenueAmount` into ResonanceRouter and emits `RevenueDeposited`; it does not call `route()`.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `PREVIOUS_MINER_BPS`, `BPS`, `_allocatePayment`, `_collectAndDeposit`, `RevenueDeposited`,
  `claimable`, `totalClaimable`
- **ADR:** ADR 0024 as superseded in routing behavior by ADR 0044
- **Tests:** `test_ReplacementAfterThirtyMinutesSettlesOnlyThatSlotAndSplitsEightyTwenty`,
  `test_FirstMinerDepositsCompletePaymentAndReceivesOneSixteenthGlobalTps`,
  `test_ZeroPriceSelfReplacementRealizesAccrualAndRestartsAtOneDollar`,
  `testFuzz_MineRevenueAndHandoffClaimsReachFinalDestinationsWithoutDust`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0044 development candidate (2026-08-22)
- **Caveats:** `revenueAmount = paid - floor(paid * 0.8)`, so the deposited share is `ceil(paid * 0.2)`. The protocol,
  not the displaced miner, receives the rounding unit. `RevenueDeposited` proves Router deposit, not same-transaction
  stream entry. There is no team fee anywhere in `Mine.sol`.

### FACT-MINE-05 — Displaced-miner payments are pull claims, permissionless to trigger, always paid to the entitled account

- **Plain-English claim:** A displaced miner's 80% is held for them to withdraw. Anyone can trigger the withdrawal,
  but the money can only go to the miner.
- **Technical formulation:** `claim(address account)` reads `claimable[account]`, zeroes it, decrements
  `totalClaimable`, and transfers to `account` — never to `msg.sender`. Exact debit/credit is verified or the call
  reverts (`InexactTransfer`).
- **Source:** `packages/contracts/src/core/Mine.sol:280-296`
- **Functions/state:** `claim`, `claimable`, `totalClaimable`
- **ADR:** ADR 0024
- **Tests:** `test_ClaimIsPermissionlessButAlwaysPaysTheDisplacedMiner`, `test_ClaimingTwiceInARowPaysNothingTheSecondTime`,
  `test_ClaimRejectsAnInexactRecipientCreditAndRestoresLiability`,
  `invariant_MineIsSolventAgainstReplacementClaims`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-MINE-06 — A slot's GBX rate is locked for the occupant's entire tenure

- **Plain-English claim:** Once you take a slot, your GBX-per-second rate is fixed until someone replaces you. Other
  handoffs, redemptions, or emission halvings never reduce it.
- **Technical formulation:** `slot.tps` is written only when `mine()` constructs the new `Slot`. A new occupant receives
  `tps = _globalTps() / SLOT_COUNT`, where `_globalTps()` reads elapsed time since Mine deployment. The aggregate
  pending accumulator is synced and only the outgoing slot is settled before the slot changes. The division residue
  is unissued.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `mine`, `Slot.tps`, `_globalTps`, `SLOT_COUNT`
- **ADR:** ADR 0033, ADR 0041, ADR 0042, ADR 0043
- **Tests:** `test_TimeBasedHalvingNeverRepricesAnIncumbent`,
  `test_StaggeredSlotsSettleIndependentlyWhileCachedTotalRemainsExact`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0043 development candidate (2026-08-22)
- **Caveats:** Because incumbents keep old rates while later tenures get the halved global rate divided by sixteen,
  aggregate issuance can exceed the current global rate for as long as old-rate tenures remain; turnover is not
  guaranteed.

### FACT-MINE-07 — The global handoff rate halves on deployment-time boundaries down to a strictly positive tail

- **Plain-English claim:** The rate offered to _new_ slot occupants halves after each fixed period measured from Mine
  deployment, and then stops falling at a permanent floor. Issuance never reaches zero.
- **Technical formulation:** Mine stores `startTime = block.timestamp` in its constructor. With
  `k = floor((block.timestamp - startTime) / HALVING_PERIOD)`, `_globalTps()` returns
  `max(INITIAL_TPS >> k, TAIL_TPS)`. `HALVING_PERIOD = 69 days` provisionally. Neither `totalMined` nor
  `pendingEmission()` influences this prospective rate.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `startTime`, `_globalTps`, `nextGlobalTps`, `INITIAL_TPS`, `HALVING_PERIOD`, `TAIL_TPS`
- **ADR:** ADRs 0041-0043 (together supersede the cumulative-mining rule in ADR 0024/0033 and ADR 0038's
  `HALVING_AMOUNT`, initial rate, and tail rate)
- **Tests:** `test_GlobalRateEventuallyUsesTheFixedTail`,
  `test_GlobalRateHalvesByDeploymentTimeEvenWhenEverySlotIsEmpty`,
  `test_TimeBasedHalvingNeverRepricesAnIncumbent`, `test_DeadlineCanProtectAQuotedTpsAcrossATimeBoundary`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0043 development candidate (2026-08-22)
- **Caveats:** Time advances the schedule even while every slot is empty, and deployment-to-launch delay consumes the
  first period. A handoff immediately before a boundary can lock the older rate for that complete tenure. The tail
  begins at the sixth boundary, day 414, when `64 ether >> 6` equals `1 ether`. The 69-day period and both rate
  constants are provisional pending independent economic review. A transaction that executes across a boundary
  receives the new lower TPS unless its caller set `deadline` strictly before that boundary.

### FACT-MINE-08 — Mine economics are hard-coded protocol constants

- **Plain-English claim:** Every Mine deployment uses one fixed replacement-price and emission schedule.
- **Technical formulation:**
  | Constant | Value |
  | ----------------------- | ----------------------- |
  | `PRICE_MULTIPLIER` | `2` |
  | `MINIMUM_INITIAL_PRICE` | `1e6` |
  | `MAX_INITIAL_PRICE` | `type(uint192).max` |
  | `INITIAL_TPS` | `64 ether` |
  | `HALVING_PERIOD` | `69 days` (`5_961_600` seconds) |
  | `TAIL_TPS` | `1 ether` |
  Mine also stores the deployment timestamp in immutable `startTime`. Additionally
  `IRevenueRouterIdentity(resonanceRouter).usdg()` must equal `usdg`.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `constructor`, fixed constants
- **ADR:** ADR 0038, ADR 0041, ADR 0042, ADR 0043
- **Tests:** `test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority`,
  `test_ConstructorRejectsInvalidDependenciesAndMismatchedRouter`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0043 development candidate (2026-08-22)
- **Caveats:** The emission schedule remains provisional. Selection and deterministic modelling do not constitute
  independent economic review or deployment approval. In the synchronized, fully occupied, fully refreshed, fully
  settled, no-burn reference, mining emits 751,161,600 GBX before the day-414 tail and gross supply including genesis
  is 771,161,600 GBX; annual tail flow is initially about 4.089% of that reference and declines as supply grows. Legacy
  tenures can exceed this path, empty slots can undershoot it, and burns change the live denominator.

### FACT-MINE-09 — The next slot opening price is the paid price times an immutable multiplier, clamped

- **Plain-English claim:** After a slot is bought, the next auction starts higher — a fixed multiple of what was just
  paid — with a floor and a ceiling.
- **Technical formulation:**
  `nextInitialPrice = clamp(paid * PRICE_MULTIPLIER, MINIMUM_INITIAL_PRICE, MAX_INITIAL_PRICE)`, with
  `PRICE_MULTIPLIER = 2`.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `_nextInitialPrice`, `PRICE_MULTIPLIER`, `MINIMUM_INITIAL_PRICE`, `MAX_INITIAL_PRICE`
- **ADR:** ADR 0038
- **Tests:** `test_NextStartingPriceCapsAtTheAbsoluteMaximum`,
  `test_ZeroPriceSelfReplacementRealizesAccrualAndRestartsAtOneDollar`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** A fill at zero (after the hour elapses) produces zero before clamping, so the next auction restarts at
  `MINIMUM_INITIAL_PRICE`. Price recovery from the floor is geometric, not immediate.

### FACT-MINE-10 — Replacement callers are protected by expected epoch, deadline, and maximum price

- **Plain-English claim:** A miner's transaction specifies which auction round they expect, the latest time they will
  accept, and the most they will pay. Any mismatch reverts.
- **Technical formulation:** `mine(miner, index, epochId, deadline, maximumPrice, message)` reverts with
  `EpochIdMismatch`, `DeadlinePassed`, `IndexOutOfBounds`, or `MaxPriceExceeded`. `epochId` increments on every fill.
- **Source:** `packages/contracts/src/core/Mine.sol:182-221`
- **Functions/state:** `mine`, `Slot.epochId`
- **ADR:** ADR 0024
- **Tests:** `test_ExpectedEpochDeadlineAndMaximumPriceProtectReplacement`, `test_MineAndSlotViewsRejectInvalidInputs`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-MINE-11 — A handoff may emit a bounded message without growing Mine storage

- **Plain-English claim:** A slot payer may attach a short public message to the handoff. It remains in the transaction
  log and is not saved in Mine's contract state.
- **Technical formulation:** `MAX_MESSAGE_BYTES = 280`. `mine(..., string message)` rejects
  `bytes(message).length > 280` with `MessageTooLong`, allows an empty message, and appends the unindexed string to
  `Mined`. Solidity does not enforce UTF-8 validity. `Mined.payer` identifies the authoring caller independently from
  the beneficiary in `Mined.miner`.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `mine`, `Mined`, `MAX_MESSAGE_BYTES`
- **ADR:** ADR 0039
- **Tests:** `test_MineEmitsTheBoundedMessageWithoutStoringIt`, `test_MineMessageLimitCountsRawBytes`
- **Status:** `implemented`
- **Caveats:** Logs are permanent chain data but are not readable by other contracts as Mine state. Interfaces must
  treat the message as untrusted content and escape it before rendering. Multibyte Unicode characters consume more
  than one byte.

### FACT-MINE-12 — A Mine handoff never calls the revenue Router

- **Plain-English claim:** Buying a mining slot cannot fail because a later Resonance routing step is broken. Mine's
  job ends once the exact protocol share reaches ResonanceRouter.
- **Technical formulation:** `_collectAndDeposit` exact-delta checks payer → Mine and Mine → ResonanceRouter, emits
  `RevenueDeposited(index, epochId, revenueAmount)`, and contains no external `route()` call. A failed transfer into
  ResonanceRouter still reverts the paid handoff. `ResonanceRouter.route()` is separately permissionless and may be
  called manually or by optional frontend/keeper/cron periphery, with no role or bounty.
- **Source:** `packages/contracts/src/core/Mine.sol`; `packages/contracts/src/core/ResonanceRouter.sol`
- **Functions/state:** `Mine.mine`, `_collectAndDeposit`, `RevenueDeposited`, `ResonanceRouter.route`, `pendingRevenue`
- **ADR:** ADR 0044
- **Tests:** `test_FirstMinerDepositsCompletePaymentAndReceivesOneSixteenthGlobalTps`,
  `test_BlockedRevenueIngressDoesNotBlockMineAndRemainsPermissionlesslyRetryable`,
  `testFuzz_MineRevenueAndHandoffClaimsReachFinalDestinationsWithoutDust`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0044 development candidate (2026-08-22)
- **Caveats:** Permissionless does not mean automatic. Router revenue may wait indefinitely even after qualifying if no
  caller submits `route()`, and routing timing can affect the next seven-day restart. LiquidityPosition's
  `harvestFees()` remains atomically coupled to its route attempt. A future optional mine-and-route helper may live in
  periphery but cannot become a Mine correctness or liveness dependency.

---

## C. SignalGBX

### FACT-SGBX-01 — sGBX is non-transferable and minted only as part of an atomic signal

- **Plain-English claim:** You cannot stake GBX on its own. Depositing GBX, minting sGBX, and committing that sGBX to
  one Strategy happen together in a single indivisible step. sGBX can never be sent to anyone.
- **Technical formulation:** `contract SignalGBX is ERC20, ERC20Votes, ReentrancyGuard, Ownable`; name
  `"Signal GUM BALL 6900"`, symbol `"sGBX"`, 18 decimals. `_update` reverts `TransferDisabled` whenever both `from`
  and `to` are nonzero, permitting only mint and burn. Minting occurs only inside `_depositAndMint`, which is reachable
  only from `signal` and `signalWithPermit`, each of which immediately calls `Resonance.addSignalFor` for the same
  amount. Burning occurs only inside `_burnAndWithdraw`, reachable only from `withdrawSignal` after
  `Resonance.removeSignalFor` has succeeded for the same amount. Exact debit/credit is enforced on both directions.
- **Source:** `packages/contracts/src/core/SignalGBX.sol:22`, `:75-132`, `:159-194`
- **Functions/state:** `signal`, `signalWithPermit`, `withdrawSignal`, `_depositAndMint`, `_burnAndWithdraw`, `_update`
- **ADR:** ADR 0031 (supersedes ADR 0030's standalone staking)
- **Tests:** `test_SignalAtomicallyCustodiesMintsVotesAndMirrorsThePairedBribe`,
  `test_SignalAtomicallyCustodiesMintsDelegatesAndMirrors`,
  `test_WithdrawSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying`,
  `test_TransfersRemainPermanentlyDisabled`, `testFuzz_SignalMoveWithdrawRoundTripIsLossless`,
  `invariant_SignalReceiptIsFullyCollateralized`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** GBX sent directly to the SignalGBX contract is stranded surplus: it mints no receipt, no signal, no
  withdrawal entitlement, and no votes
  (`test_DirectDonationIsSurplusAndCreatesNoSignalVotesOrWithdrawalEntitlement`).

### FACT-SGBX-02 — sGBX carries ERC20Votes on the block-number clock and self-delegates on first signal

- **Plain-English claim:** Signalled GBX is the protocol's voting power. Your first signal automatically activates your
  vote without a second transaction.
- **Technical formulation:** `SignalGBX` inherits `ERC20Votes` with the OpenZeppelin default `clock()` (block number)
  and `CLOCK_MODE` `mode=blocknumber`. Inside `_depositAndMint`,
  `if (delegates(account) == address(0)) _delegate(account, account)`.
- **Source:** `packages/contracts/src/core/SignalGBX.sol:171`
- **Functions/state:** `delegates`, `_delegate`, `getPastVotes`, `getPastTotalSupply`
- **ADR:** ADR 0030 (voting-token decisions), ADR 0031
- **Tests:** `test_LaterSignalPreservesExplicitDelegateAndSelfDelegatesAgainAfterZeroDelegation`,
  `test_DelegateBySigWorksButReceiptHasNoPermitEntrypoint`,
  `test_MoveSignalPreservesCustodySupplyVotesAndAggregateSignal`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** Self-delegation happens only when the account currently has _no_ delegate. An account that explicitly
  delegates to the zero address re-self-delegates on its next signal; an account delegating elsewhere keeps that
  delegate.

### FACT-SGBX-03 — sGBX has no ERC-2612 permit; `signalWithPermit` permits the underlying GBX instead

- **Plain-English claim:** sGBX has no gasless-approval function because it cannot be transferred anyway. The
  one-transaction signal path uses a permit on GBX.
- **Technical formulation:** `SignalGBX` does not inherit `ERC20Permit`; it inherits `EIP712` only for `ERC20Votes`
  delegation signatures. `signalWithPermit` wraps `IERC20Permit(gbx).permit(...)` in `try/catch` and relies on the
  exact `transferFrom` in `_depositAndMint` as the authorization and custody check.
- **Source:** `packages/contracts/src/core/SignalGBX.sol:93-108`
- **Functions/state:** `signalWithPermit`
- **ADR:** ADR 0031
- **Tests:** `test_DelegateBySigWorksButReceiptHasNoPermitEntrypoint`,
  `test_SignalWithPermitNeedsNoApprovalAndToleratesPreConsumedSignature`,
  `test_SignalWithPermitRollsBackPermitWhenStrategyMutationFails`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** The swallowed `catch` is deliberate: a front-runner may consume the permit signature, which is harmless
  because the transfer still requires real allowance. A failed or pre-consumed permit cannot create an unbacked
  receipt or a partial signal.

### FACT-SGBX-04 — There is no lock, cooldown, or epoch restriction

- **Plain-English claim:** You can signal, move, and withdraw at any time. Nothing forces you to wait.
- **Technical formulation:** No timestamp, epoch, or cooldown state exists in `SignalGBX.sol`. `withdrawSignal` is
  bounded only by the caller's recorded position in the selected Strategy's Bribe, enforced by
  `Resonance.removeSignalFor` (`InsufficientSignal`).
- **Source:** `packages/contracts/src/core/SignalGBX.sol:124-132`
- **Functions/state:** `withdrawSignal`, `moveSignal`
- **ADR:** ADR 0031, ADR 0019
- **Tests:** `test_WithdrawSignalRejectsZeroAndMoreThanTheSelectedPosition`,
  `invariant_EveryActorCanFullyWithdrawSignals`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** This is the mechanism behind governance finding **G-01**: because voting uses historical block
  snapshots and withdrawal is unrestricted, an account can signal across a snapshot, vote with that weight, and
  withdraw immediately afterwards.

### FACT-SGBX-05 — Mandatory signal-backing: there is no idle sGBX and no separate allocation ledger

- **Plain-English claim:** Every single unit of sGBX in existence is committed to exactly one Strategy at all times.
  There is no "staked but uncommitted" state.
- **Technical formulation:** ADR 0031 removed `allocatedBalance`, `_allocate`, `_deallocate`, and the
  `ISignalGBXAllocation` interface (the file was already deleted in the listed source state). `SignalGBX.balanceOf(account)` **is** the
  account's aggregate signal; `Resonance.accountSignalWeight(account)` now returns `signalGBX.balanceOf(account)`
  directly. Because mint and burn are atomically coupled to the matching Bribe virtual-balance change (FACT-SGBX-01),
  there is no reachable successful state in which a minted raw unit is idle or a burned raw unit leaves signal behind.
- **Source:** `packages/contracts/src/core/SignalGBX.sol:75-132`; `packages/contracts/src/core/Resonance.sol:362-364`
- **Functions/state:** `balanceOf`, `Resonance.accountSignalWeight`
- **ADR:** ADR 0031 (supersedes ADR 0030's `allocatedBalance` and idle-receipt decisions)
- **Tests:** `test_RemovedIdleReceiptSelectorsAreAbsentFromRuntime`, `invariant_EveryReceiptUnitIsAssigned`,
  `invariant_SignalWeightNeverExceedsTheReceiptBalance`, `invariant_AccountWeightsSumToAllRecordedStrategyWeight`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** `test_RemovedIdleReceiptSelectorsAreAbsentFromRuntime` asserts the removed selectors are absent from
  deployed runtime, not merely from source. This was internal finding **SR-001** (High), fixed locally.

### FACT-SGBX-06 — Vote-checkpoint supply and economically active signal are the same quantity

- **Plain-English claim:** Because no sGBX can sit idle, the total recorded voting supply is exactly the total signal
  directing revenue.
- **Technical formulation:** `sGBX.totalSupply()` is both the ERC20Votes supply exposed by `getPastTotalSupply` and,
  by FACT-SGBX-05, the sum of every Strategy's recorded Bribe supply across live and killed Strategies. Under
  ADR 0030 these were different quantities; under ADR 0031 they coincide.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`; `docs/adr/0031-mandatory-signal-backed-signalgbx.md`
- **Functions/state:** `totalSupply`, `getPastTotalSupply`, `Bribe.totalSupply`
- **ADR:** ADR 0031, ADR 0034
- **Tests:** `invariant_EveryReceiptUnitIsAssigned`, `invariant_StrategyWeightsSumToTheGlobalTotal`
- **Status:** `implemented`
- **Commit:** `dc67d7c`
- **Caveats:** Since ADR 0034 the core reads none of this, so it is a token property offered to a future external
  system rather than a quorum guarantee (FACT-GOV-07). Two qualifications carry forward to whichever system is
  selected: `_depositAndMint` self-delegates a first-time signaler, so undelegated supply no longer arises from the
  token, but signal committed to a **killed** Strategy still counts toward `totalSupply` while contributing nothing
  to `Resonance.totalSignalWeight`. Finding **G-03** remains open as an integration gate.

---

## D. Signal allocation

### FACT-SIG-01 — SignalGBX is the only external signal coordinator

- **Plain-English claim:** All signaling flows through one contract. There is no second user-facing entry point.
- **Technical formulation:** `Resonance.addSignalFor`, `removeSignalFor`, and `moveSignalFor` carry the
  `onlySignalGBX` modifier, which reverts `UnauthorizedSignalSource` unless `msg.sender == address(signalGBX)`.
- **Source:** `packages/contracts/src/core/Resonance.sol:147-150`, `:153`, `:169`, `:188-192`
- **Functions/state:** `onlySignalGBX`, `addSignalFor`, `removeSignalFor`, `moveSignalFor`
- **ADR:** ADR 0030 (supersedes ADR 0019's direct Resonance entry points)
- **Tests:** `test_OnlySignalGBXCanMutateAnotherAccountsSignal`, `test_AnAttackerCannotRemoveAnotherAccountsSignal`,
  `test_HostileSignalInputsCannotCreateOrDestroyWeight`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-SIG-02 — Signals are absolute per-Strategy amounts changed by incremental deltas

- **Plain-English claim:** You allocate specific amounts to specific Strategies and adjust them by adding or removing
  amounts. There is no percentage-weight system and no forced whole-account reset.
- **Technical formulation:** The complete user surface is exactly four functions:
  `signal(strategy, amount)`, `signalWithPermit(strategy, amount, deadline, v, r, s)`,
  `moveSignal(fromStrategy, toStrategy, amount)`, and `withdrawSignal(strategy, amount)`. Each takes a scalar raw sGBX
  amount. No batch or array entry point exists, and no percentage-weight system exists.
- **Source:** `packages/contracts/src/core/SignalGBX.sol:75-132`
- **Functions/state:** `signal`, `signalWithPermit`, `moveSignal`, `withdrawSignal`
- **ADR:** ADR 0019, **ADR 0031**
- **Tests:** `test_SignalAtomicallyCustodiesMintsVotesAndMirrorsThePairedBribe`,
  `test_WithdrawSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying`,
  `test_MoveSignalPreservesCustodySupplyVotesAndAggregateSignal`,
  `test_SignalRejectsZeroAndMissingAllowance`, `test_WithdrawSignalRejectsZeroAndMoreThanTheSelectedPosition`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** ADR 0031 **removed** `stake`, `unstake`, `stakeAndSignal`, `stakeAndSignalWithPermit`, `removeSignal`,
  and `removeSignalAndUnstake`. This is a breaking interface change; the repository has no production deployment, so
  no compatibility shim was introduced. `test_RemovedIdleReceiptSelectorsAreAbsentFromRuntime` asserts the removed
  selectors are absent from deployed runtime.

### FACT-SIG-03 — Signal state has exactly one canonical owner at each level

- **Plain-English claim:** Each level of the signal ledger is owned by exactly one contract; none duplicate each other.
- **Technical formulation:**

  | Level                    | Canonical owner                | Accessor                         |
  | ------------------------ | ------------------------------ | -------------------------------- |
  | Account aggregate        | `SignalGBX.balanceOf(account)` | `Resonance.accountSignalWeight`  |
  | Account × Strategy       | `Bribe(s).balanceOf(account)`  | `Resonance.accountSignals`       |
  | Strategy total           | `Bribe(s).totalSupply`         | `Resonance.strategySignalWeight` |
  | Active total (live only) | `Resonance.totalSignalWeight`  | direct                           |

  `Resonance` reads the first three rather than storing them. ADR 0031 removed the separate `allocatedBalance` ledger
  because it would always be identical to `balanceOf` (FACT-SGBX-05).

- **Source:** `packages/contracts/src/core/Resonance.sol:66`, `:355-375`
- **Functions/state:** `totalSignalWeight`, `accountSignals`, `accountSignalWeight`, `strategySignalWeight`
- **ADR:** ADR 0030, **ADR 0031**
- **Tests:** `invariant_BribeBalancesMirrorAccountSignals`, `invariant_BribeSupplyMirrorsStrategyWeight`,
  `invariant_StrategyWeightsSumToTheGlobalTotal`, `invariant_AccountWeightsSumToAllRecordedStrategyWeight`,
  `invariant_EveryReceiptUnitIsAssigned`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Accounting identity (ADR 0031):** across live **and** killed Strategies,
  `SignalGBX.balanceOf(a) = Σ_s Bribe(s).balanceOf(a)` and `SignalGBX.totalSupply() = Σ_s Bribe(s).totalSupply()`,
  with `GBX.balanceOf(SignalGBX) ≥ SignalGBX.totalSupply()`.

### FACT-SIG-04 — Every signal change checkpoints elapsed revenue before weights move

- **Plain-English claim:** Changing your signal never retroactively redirects revenue that accrued under the old
  weights.
- **Technical formulation:** `addSignalFor` and `removeSignalFor` call `_updateReward(strategy)` before mutating
  `totalSignalWeight` or the Bribe balance. `moveSignalFor` calls `_updateReward(fromStrategy)` and
  `_updateReward(toStrategy)` before both legs. `_updateReward` advances `rewardPerTokenStored` and `lastUpdateTime`,
  then settles `account_Token_Rewards[strategy]`.
- **Source:** `packages/contracts/src/core/Resonance.sol:159`, `:178`, `:204-205`, `:394-405`
- **Functions/state:** `_updateReward`, `rewardPerToken`, `earned`
- **ADR:** ADR 0029
- **Tests:** `test_FlashSignalWeightCannotRedirectANewNotification`,
  `test_StrategyAddedAfterAccrualCannotClaimHistoricRevenue` (named in FINDINGS.md as the A-11 regression),
  `test_NewStrategyWeightReceivesOnlyPostEntryRevenue`, `test_ALateArrivalEarnsNothingForTheElapsedPortion`,
  `test_StrategyAddedAfterAccrualCannotClaimHistoricRevenue`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** This prevents _same-transaction_ capture only. A signal held over real elapsed time legitimately earns
  that interval's flow. There is no epoch, cooldown, or anti-churn guarantee.

### FACT-SIG-05 — A newly added Strategy starts at the current index and cannot claim historical revenue

- **Plain-English claim:** A Strategy created today cannot claim revenue that accrued before it existed.
- **Technical formulation:** `addStrategy` sets
  `account_Token_RewardPerTokenPaid[strategy][usdg] = token_RewardData[usdg].rewardPerTokenStored`.
- **Source:** `packages/contracts/src/core/Resonance.sol:293-294`
- **Functions/state:** `addStrategy`, `account_Token_RewardPerTokenPaid`
- **ADR:** ADR 0029
- **Tests:** `test_StrategyAddedAfterAccrualCannotClaimHistoricRevenue`,
  `test_NewStrategySignalCannotReceivePreEntryRoundedSurplus`
- **Status:** `implemented`
- **Commit:** `281e601`

---

## E. Protocol administration and governance

> **Every FACT-GOV entry in editions before 2026-08-20 described `ProtocolGovernor` and `TimelockController`.**
> ADR 0034 deleted both contracts and their entire supporting surface. This section was rewritten in full; nothing
> from the previous edition survives as a current claim.

### FACT-GOV-01 — The core contains no governance contract

- **Plain-English claim:** The protocol ships no voting contract, no timelock, and no executor. Continuing
  administration is four function calls gated on one owner address.
- **Technical formulation:** `packages/contracts/src` contains no `governance/` directory. No source declares
  `Governor`, `GovernorCountingSimple`, `GovernorVotes`, `GovernorTimelockControl`, or `TimelockController`. The core
  defines no proposal threshold, quorum, voting delay, voting period, execution delay, batching rule, or cancellation
  rule.
- **Source:** absence across `packages/contracts/src`; `docs/adr/0034-external-governance-ownership.md`
- **ADR:** ADR 0034 (supersedes ADR 0030's governance decisions, ADR 0031's retention of them, and ADR 0029's
  intended Timelock owner)
- **Tests:** none possible for an absent contract; `docs/reference/contracts.md` is regenerated from Foundry
  artifacts and lists no governance surface
- **Status:** `implemented`
- **Commit:** `dc67d7c`
- **Caveats:** Removal is not a safety proof. It relocates every governance guarantee to a system that has not been
  selected. Any document asserting a proposal filter, quorum, delay, or cancellation path as a current protocol
  property is wrong.

### FACT-GOV-02 — Resonance has the only continuing custom owner authority

- **Plain-English claim:** Resonance is the only contract whose owner retains custom protocol powers. SignalGBX,
  StrategyFactory, and BribeFactory keep setup-only Ownable shells until production explicitly renounces them after
  their one-time Resonance bindings are consumed; the remaining contracts are ownerless or address-gated.
- **Technical formulation:** `Resonance is ReentrancyGuard, Ownable`. Continuing owner-gated functions are
  `addStrategy`, `killStrategy`, `addBribeReward`, and `setBribeBps`, plus inherited `transferOwnership` and
  `renounceOwnership`.
  `setResonanceRouter` is owner-gated but single-use (`ResonanceRouterAlreadySet`). `SignalGBX`, `StrategyFactory`,
  and `BribeFactory` are `Ownable` but retain no owner-callable function after `setResonance` is consumed. `Mine`,
  `Fund`, `LiquidityPosition`, `Strategy`, and `BribeRouter` are not `Ownable`. `Bribe.addRewardToken` is gated on
  the immutable `resonance` address, not on an owner.
- **Source:** `packages/contracts/src/core/Resonance.sol`, `SignalGBX.sol`, `Mine.sol`, `Fund.sol`,
  `LiquidityPosition.sol`, `Bribe.sol`
- **Functions/state:** `owner`, `addStrategy`, `killStrategy`, `addBribeReward`, `setBribeBps`, `setResonanceRouter`
- **ADR:** ADR 0034, ADR 0033 (ownerless Mine), ADR 0017 (ownerless Fund and LiquidityPosition)
- **Tests:** `test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`,
  `test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal`,
  `test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe`,
  `test_DefaultBoundsAndOwnerAuthorization`,
  `test_ResonanceRouterBindingIsOwnerOnlyValidatedAndSingleUse`,
  `test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority`, `test_FundHasNoAdministrativeSurfaceLeft`
- **Status:** `implemented`
- **Commit:** `dc67d7c`

### FACT-GOV-03 — The owner's only economic reach is the bounded prospective Bribe share

- **Plain-English claim:** Even a hostile owner cannot drain the treasury, mint tokens, change mining rates, move the
  liquidity position, or redirect a payment. It can change only the prospective automatic Bribe share, within 0–20%.
- **Technical formulation:** Mining parameters are fixed and `Mine` has no owner. `Resonance.setBribeBps` is bounded
  by `MAX_BRIBE_BPS = 2_000` and applies only when a later payment is classified; Fund receives the complement and no
  prior liability is repriced. `GBX.setMinter` is single-use with `minterLocked`. `Fund` exposes only `redeem` and
  `burnGBX`. `LiquidityPosition` has no withdrawal path for the NFT. `Strategy` auction parameters are immutable and
  bounded at construction.
- **Source:** `Mine.sol`, `Resonance.sol`, `BribeRouter.sol`, `GBX.sol`, `Fund.sol`, `LiquidityPosition.sol`,
  `Strategy.sol`
- **ADR:** ADR 0033, ADR 0036, ADR 0017, ADR 0022
- **Tests:** `test_RedemptionIsTheOnlyWayAssetsCanEverLeaveFund`,
  `test_TheCanonicalNFTCanNeverLeaveOnceAdmitted`, `test_FundHasNoAdministrativeSurfaceLeft`,
  `test_DefaultBoundsAndOwnerAuthorization`, `test_ChangingPolicyCannotRepriceOldLiabilitiesOrInterruptTheirRewardStream`,
  `testFuzz_HarvestIsExactAndPrincipalIsFixed`
- **Status:** `implemented`
- **Commit:** `dc67d7c`

### FACT-GOV-04 — The final live Strategy cannot be killed

- **Plain-English claim:** There is always at least one place to signal, enforced in code.
- **Technical formulation:** `killStrategy` reverts `FinalLiveStrategy(strategy)` when `liveStrategyCount == 1`. A
  replacement must be added first.
- **Source:** `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `killStrategy`, `liveStrategyCount`, `isStrategyAlive`
- **ADR:** ADR 0031 (supersedes ADR 0029's permission to kill it)
- **Tests:** `test_KillingTheFinalLiveStrategyRevertsAfterBootstrap`,
  `test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal`
- **Status:** `implemented`
- **Commit:** `dc67d7c`
- **Caveats:** Whether the replacement and the kill can be executed atomically depends on the external governance
  system's batching support, which is unselected.

### FACT-GOV-05 — SignalGBX keeps vote checkpoints that nothing in the core reads

- **Plain-English claim:** sGBX records who held how much at each past block, in the standard format a governance
  system would read. No protocol contract reads it today.
- **Technical formulation:** `SignalGBX is ERC20, ERC20Votes, ReentrancyGuard, Ownable` on the default block-number
  clock, with no `clock()` or `CLOCK_MODE` override. `_depositAndMint` self-delegates any account whose delegate is
  the zero address, so a first signal activates checkpoints without a second transaction. No core contract calls
  `getPastVotes`, `getPastTotalSupply`, or `delegates` for any protocol decision.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `_update`, `_depositAndMint`, `delegates`, `getPastVotes`, `getPastTotalSupply`
- **ADR:** ADR 0030 (token properties, retained), ADR 0034 (no core consumer)
- **Tests:** `test_LaterSignalPreservesExplicitDelegateAndSelfDelegatesAgainAfterZeroDelegation`,
  `test_DelegateBySigWorksButReceiptHasNoPermitEntrypoint`,
  `test_DirectDonationIsSurplusAndCreatesNoSignalVotesOrWithdrawalEntitlement`,
  `test_TransfersRemainPermanentlyDisabled`
- **Status:** `implemented`
- **Commit:** `dc67d7c`

### FACT-GOV-06 — Voting checkpoints survive signal withdrawal

- **Plain-English claim:** Once a block has passed, the record of what you held at that block is permanent, even if
  you have since withdrawn everything.
- **Technical formulation:** `withdrawSignal` burns sGBX and writes a new checkpoint, but earlier checkpoints are
  immutable. An account may acquire or borrow GBX, signal it, allow a block to pass, withdraw, and retain its
  recorded weight at that past block. `SignalGBX` has no lock, cooldown, or epoch.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `withdrawSignal`, `_burnAndWithdraw`, `getPastVotes`
- **ADR:** ADR 0034 (§ Consequences), finding G-01
- **Tests:** `test_HistoricalVotingCheckpointsSurviveImmediateSignalWithdrawal`
- **Status:** `implemented` / `accepted-limitation`
- **Commit:** `dc67d7c`
- **Caveats:** Not exploitable in the core, which reads no checkpoints. It becomes exploitable exactly when an
  external system that reads historical balances is attached, and its severity then depends on that system's
  snapshot-to-vote spacing and proposal threshold. Open integration gate (**G-01**).

### FACT-GOV-07 — Because no sGBX can be idle, votes and active signal are the same quantity

- **Plain-English claim:** Every unit of sGBX that exists is committed to a Strategy, so a quorum measured against
  total sGBX supply measures economically active weight only.
- **Technical formulation:** `SignalGBX.signal` mints and assigns atomically; there is no mint path that leaves a
  receipt unassigned (ADR 0031). Therefore `getPastTotalSupply(t)` equals the total signal committed across all
  Strategies at `t`.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`, `Resonance.sol`
- **ADR:** ADR 0031, ADR 0034
- **Tests:** `invariant_EveryReceiptUnitIsAssigned`, `invariant_SignalReceiptIsFullyCollateralized`,
  `invariant_SignalWeightNeverExceedsTheReceiptBalance`
- **Status:** `implemented`
- **Commit:** `dc67d7c`
- **Caveats:** This is a token property, not a quorum guarantee. The core defines no quorum. The former
  undelegated-supply deadlock concern does not arise from the token, but the external system's own liveness model is
  unselected and unreviewed (**G-03**).

### FACT-GOV-08 — Ownership handoff is a deployment obligation, not a contract invariant

- **Plain-English claim:** Nothing in the code forces the deployment to hand ownership to a real governance system.
  That has to be done correctly and proven with evidence.
- **Technical formulation:** `Resonance` is constructed with an `initialOwner`. Deployment steps 9–10 of
  `docs/DEPLOYMENT.md` require stopping unless a later ADR has selected and reviewed the external governance
  integration, then calling `transferOwnership` to the exact reviewed executor and verifying `Resonance.owner()` and
  the handoff receipt. No Solidity enforces any of this; there is no timeout, escrow, or forced handoff. A deployment
  interrupted after bootstrap and before handoff leaves a live admin key.
- **Source:** `packages/contracts/src/core/Resonance.sol` constructor; `docs/DEPLOYMENT.md` steps 9–10
- **ADR:** ADR 0034
- **Tests:** deployment fixtures prove the wiring is achievable, not that any deployment achieved it
- **Status:** `open-gate`
- **Commit:** `dc67d7c`
- **Caveats:** Open High release gates **M-03** (signed manifest proving bytecode, arguments, dependencies, the exact
  executor, and removal of the temporary owner) and **G-03** (the integration itself). Reciprocal identity checks
  reject a crossed graph but cannot detect a malicious lookalike that returns the expected identities, and the
  protocol has no upgrade, successor, or migration authority to repair a wrong value.

### FACT-GOV-09 — Requirements the external governance ADR must satisfy

- **Plain-English claim:** Deployment is blocked until a named list of governance facts is pinned and reviewed.
- **Technical formulation:** ADR 0034 requires a later ADR to pin at least: provider, exact release, deployed
  bytecode, and proxy or upgrade model; plugin set, permission graph, root/admin holders, and any emergency path;
  direct compatibility with SignalGBX voting checkpoints and delegation; proposal creation, quorum, support, voting
  duration, execution, batching, cancellation, and delay semantics; and the exact `Resonance` owner address with
  transaction evidence proving the handoff.
- **Source:** `docs/adr/0034-external-governance-ownership.md`
- **ADR:** ADR 0034
- **Status:** `open-gate`
- **Commit:** `dc67d7c`
- **Caveats:** Aragon is recorded as under consideration. No provider is part of the reviewed protocol graph, and no
  public document may imply that one has been selected.

## F. Resonance

### FACT-RES-01 — Resonance holds one global seven-day USDG stream shared by all live Strategies

- **Plain-English claim:** Protocol revenue does not arrive all at once. It is released steadily over seven days and
  split among Strategies according to how they were signaled during each moment.
- **Technical formulation:** `DURATION = 7 days = 604800` seconds. One `Reward` record is kept per token, and only
  USDG is ever registered (`token_IsReward[usdg] = true` in the constructor; `rewardTokens` holds one element).
  Allocation follows a Synthetix-shaped `rewardPerToken` index over `totalSignalWeight`.
- **Source:** `packages/contracts/src/core/Resonance.sol:29`, `:44-58`, `:133-134`
- **Functions/state:** `DURATION`, `token_RewardData`, `rewardTokens`, `totalSignalWeight`
- **ADR:** ADR 0029
- **Tests:** `test_NotifyStartsASevenDayStreamAtTheFlooredRate`, `test_RevenueSplitsByCurrentStrategyWeight`,
  `test_RewardViewsExposeOnlyTheSingleCurrentSchedule`, `invariant_RevenueStreamStateIsCoherent`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-RES-02 — The raw USDG schedule is quotient plus front-loaded remainder

- **Plain-English claim:** Every single raw unit of scheduled USDG is released — the remainder from the division is
  paid out one unit per second at the start of the period, not discarded.
- **Technical formulation:** On restart with `S = reward + remaining`:
  `rewardRate = floor(S / DURATION)`, `rateRemainder = S mod DURATION`, `periodFinish = t0 + DURATION`,
  `remainderFinish = t0 + rateRemainder`. Emission over `[from, to)` is
  `(to - from) * rewardRate + max(0, min(to, remainderFinish) - from)` when `from < remainderFinish`.
  Total emitted over the full period is exactly `rewardRate * DURATION + rateRemainder = S`.
- **Source:** `packages/contracts/src/core/Resonance.sol:429-454`
- **Functions/state:** `_restartRewardPeriod`, `_emissionBetween`, `left`, `getRewardForDuration`
- **ADR:** ADR 0029
- **Tests:** `test_RawRemainderIsFrontLoadedAndTheCompleteAmountIsScheduled`,
  `test_OneRawUnitEmitsDuringTheFirstActiveSecond`,
  `test_NotifyAcceptsAndExactlySchedulesAnAmountBelowTheDuration`,
  `test_TheFormerFlooredRewardRateRemainderIsFullyClaimable`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Worked example:** `S = 1_000_000` raw USDG (1.00 USDG at 6 decimals). `rewardRate = floor(1000000/604800) = 1`.
  `rateRemainder = 1000000 - 604800 = 395200`. So for the first 395,200 seconds emission is 2 raw units/second and
  thereafter 1 raw unit/second. Total `= 604800*1 + 395200 = 1_000_000`. Exact.

### FACT-RES-03 — A qualifying notification restarts seven days with new reward plus the exact remainder

- **Plain-English claim:** New revenue does not just extend the old schedule. It is combined with whatever was left
  and restarted as a fresh seven-day stream.
- **Technical formulation:** `notifyRevenue(reward)` requires `reward >= left(usdg)` (else `RewardSmallerThanLeft`),
  pulls exactly `reward`, and calls `_restartRewardPeriod(usdg, reward, remaining)` with `S = reward + remaining`.
  `updateReward(address(0))` runs first, so elapsed emission is checkpointed into the index before the restart.
- **Source:** `packages/contracts/src/core/Resonance.sol:219-230`
- **Functions/state:** `notifyRevenue`, `left`, `_restartRewardPeriod`
- **ADR:** ADR 0029 (supersedes ADR 0025 and ADR 0026 reset behavior)
- **Tests:** `test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft`,
  `test_TopUpBelowLeftRevertsAtomicallyAtResonance`, `test_ATopUpWaitsBehindTheUndisturbedActiveStream`,
  `test_AnOutsiderCannotExtendOrSlowTheLiveStream`, `test_NotifyRevenueIsRouterOnlyAndRejectsZero`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** A restart can raise **or lower** the instantaneous rate and always moves the finish to `now + 7 days`.
  Because `reward >= left`, forcing an early reset requires economically matching the remainder. Timing influence is
  intentional and accepted.

### FACT-RES-04 — ResonanceRouter withholds a nonzero balance below the active remainder

- **Plain-English claim:** Revenue waits in a router until someone calls; a sub-threshold attempt leaves it there, while
  a qualifying attempt forwards the complete balance.
- **Technical formulation:** `route()` reverts `NoRevenue` on a zero balance. Otherwise it reads
  `minimum = Resonance.left(usdg)`; if `pending < minimum` it emits `RevenueHeld` and returns `0` without
  transferring. Otherwise it forwards its **complete** balance, and reverts `RevenueRetained` if any USDG remains.
- **Source:** `packages/contracts/src/core/ResonanceRouter.sol:56-76`
- **Functions/state:** `route`, `pendingRevenue`, `RevenueHeld`, `RevenueRetained`
- **ADR:** ADR 0029; Mine call-site behavior superseded by ADR 0044
- **Tests:** `test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies`,
  `test_RouteIsPermissionlessAndForwardsTheCompleteBalance`, `test_RouteRevertsIfResonanceLeavesRevenueBehind`,
  `test_RouteRejectsAnEmptyRouter`, `invariant_RevenueRouterRetentionIsFullyVisible`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** There is no absolute minimum. Because `left` decays to zero at `periodFinish`, any held balance
  eventually qualifies, but qualification does not call the contract. With no role, bounty, or guaranteed caller,
  revenue may wait indefinitely. Mine is isolated because it never calls `route`; LiquidityPosition still calls it
  atomically. Interfaces must distinguish "deposited in Router" from "forwarded into the active stream". Direct
  donations to the Router are unaccounted surplus (`test_DirectRouterDonationsRemainUnaccountedSurplus`).

### FACT-RES-05 — The reward-per-signal index uses 1e36 precision because USDG has 6 decimals and sGBX has 18

- **Plain-English claim:** Because the revenue token is tracked to six decimal places and the signal token to
  eighteen, the internal accounting uses very high precision so tiny allocations are not rounded to nothing.
- **Technical formulation:** `REWARD_PRECISION = 1e36`.
  `rewardPerToken += floor(emitted * 1e36 / totalSignalWeight)`, and
  `earned = rewards + floor(activeBalance * (rewardPerToken - paid) / 1e36)`.
- **Source:** `packages/contracts/src/core/Resonance.sol:31`, `:330-348`
- **Functions/state:** `REWARD_PRECISION`, `rewardPerToken`, `earned`
- **ADR:** ADR 0029
- **Tests:** `test_ScalarSignalsSplitAcrossStrategiesAndExitCompletely`, `test_AccrualIsProportionalToVirtualWeight`,
  `invariant_RevenueIndexIsMonotonic`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** **The six-decimal property is a deployment fact, not a code constant.** No contract calls
  `usdg.decimals()` or asserts it equals 6. The `1e36` choice is calibrated for a 6-decimal reward against an
  18-decimal weight; the test fixture instantiates USDG as `MockERC20("Global Dollar", "USDG", 6)`
  (`packages/contracts/test/minimal/utils/ProtocolFixture.sol:65`). See
  [Unresolved discrepancies](#unresolved-discrepancies) D-2.
- **Overflow note:** `Math.mulDiv` is used for both directions, so the intermediate `emitted * 1e36` is computed at
  512-bit width and cannot overflow for any realistic USDG amount.

### FACT-RES-06 — Resonance keeps rounding floors, zero-signal emission, and donations as unclassified surplus

- **Plain-English claim:** Some very small amounts of USDG, plus any revenue that streams while nobody is signaling
  anything, stay stuck in Resonance forever. They are not paid to anyone and not added to the Fund.
- **Technical formulation:** Three sources of surplus, none carried:
  1. Global index floor: `emitted * 1e36 mod totalSignalWeight` is discarded each checkpoint.
  2. Per-Strategy floor: `activeBalance * delta mod 1e36` is discarded each checkpoint.
  3. `rewardPerToken` returns early when `totalSignalWeight == 0`, so stream time elapsing at zero active signal
     weight advances `lastUpdateTime` without ever crediting any Strategy.
     Direct USDG transfers to Resonance are never scheduled because scheduling occurs only inside `notifyRevenue`.
     The solvency relation is an inequality:
     `USDG.balanceOf(Resonance) = left(USDG) + sum_strategies earned(strategy, USDG) + surplus`, `surplus >= 0`.
- **Source:** `packages/contracts/src/core/Resonance.sol:330-348`, `:394-405`; `docs/SECURITY-INVARIANTS.md`
- **Functions/state:** `rewardPerToken`, `earned`, `_updateReward`
- **ADR:** ADR 0029 (finding **A-02**, **A-09** Resonance half)
- **Tests:** `test_ZeroSignalElapsedRevenueBecomesSurplusAndCannotBeCapturedLater`,
  `test_RevenueWithoutSignalsBecomesUnallocatedResonanceSurplus`,
  `test_USDGDonatedDirectlyToResonanceRemainsUnscheduledSurplus`, `test_DirectDonationIsNotScheduled`,
  `test_NewStrategySignalCannotReceivePreEntryRoundedSurplus`,
  `invariant_ResonanceIsSolventAgainstClaimableRevenue`, `invariant_ResonanceScheduledAndEarnedRevenueIsSolvent`,
  `testFuzz_AccruedAndScheduledRevenueNeverExceedsTheHeldBalance`,
  `testFuzz_DistributionNeverOverpaysAndFractionalDustRemainsHeld`, `testFuzz_TotalPaidNeverExceedsTotalNotified`
- **Status:** `accepted-limitation`
- **Commit:** `281e601`
- **Caveats:** **No exact conservation identity and no lifetime dust bound is claimed for Resonance.** There is no
  synchronization, sweep, rescue, or later-allocation path. This is the deliberate difference from Bribe, which does
  carry exact remainders (FACT-BRIBE-05).

### FACT-RES-07 — Distribution is permissionless and always pays the entitled Strategy

- **Plain-English claim:** Anyone can push a Strategy's accrued revenue to it; the money can only go to that Strategy.
- **Technical formulation:** `distribute(strategy)` is public with `nonReentrant updateReward(strategy)`. It zeroes
  `account_Token_Rewards[strategy][usdg]` and transfers to `strategy`, verifying exact debit and credit.
- **Source:** `packages/contracts/src/core/Resonance.sol:233-244`, `:418-427`
- **Functions/state:** `distribute`, `_transferRevenueExact`
- **ADR:** ADR 0029
- **Tests:** `test_DistributionIsPermissionlessButAlwaysPaysTheStrategy`, `test_DistributingTwicePaysNothingTheSecondTime`,
  `test_InexactDistributionRevertsWithoutConsumingLiabilityAndCanRetry`,
  `test_BlockedStrategyDoesNotBrickUnrelatedDistributionOrItsOwnLaterRetry`
- **Status:** `implemented`
- **Commit:** `281e601`

---

## G. Strategy registration, lifecycle, and auctions

### FACT-STR-01 — A Strategy is created only by Resonance, together with its Bribe and BribeRouter

- **Plain-English claim:** Strategies cannot be created by the public. Governance creates them, and each one comes
  with its own reward contract and payment router.
- **Technical formulation:** `Resonance.addStrategy` is `onlyOwner nonReentrant`. It calls
  `bribeFactory.createBribe()`, registers the payment token as the Bribe's first reward token, then
  `strategyFactory.createStrategy(usdg, paymentToken, fund, bribe, config)` which deploys both `Strategy` and
  `BribeRouter`. Both factories reject any caller other than their bound Resonance.
- **Source:** `packages/contracts/src/core/Resonance.sol:266-297`; `StrategyFactory.sol:62-81`; `BribeFactory.sol:59-67`
- **Functions/state:** `addStrategy`, `isStrategy`, `isStrategyAlive`, `bribeFor`, `bribeRouterFor`, `paymentTokenFor`
- **ADR:** ADR 0029, ADR 0021
- **Tests:** `test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`, `test_StrategyCreationIsResonanceOnly`,
  `test_BribeCreationIsResonanceOnly`, `test_ACreatedStrategyIsPairedWithItsOwnRouter`,
  `test_FactoriesAreResonanceOnly`, `test_EachCreationProducesAFreshIndependentGraph`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** `addStrategy` rejects a zero or code-less payment token and rejects `signalGBX` as payment
  (`ForbiddenPaymentToken`), because sGBX is non-transferable and would create an unfillable auction (finding E-03).

### FACT-STR-02 — Every Strategy is the same bounded reverse Dutch auction selling its USDG balance

- **Plain-English claim:** A Strategy accumulates protocol revenue in USDG and sells all of it to whoever will hand
  over the target asset. The price it asks falls over time until someone takes the trade.
- **Technical formulation:** `buy(revenueReceiver, expectedEpochId, deadline, maximumPayment)` first calls
  `Resonance.distribute(address(this))`, reads `revenueAmount = revenueToken.balanceOf(this)` (reverts `EmptyRevenue`
  at zero), computes `paymentAmount = currentPrice()`, collects that many `paymentToken` units, settles them, and
  transfers the **entire** USDG balance to `revenueReceiver`.
- **Source:** `packages/contracts/src/core/Strategy.sol:147-185`
- **Functions/state:** `buy`, `availableRevenue`, `currentPrice`, `epochId`, `epochStartedAt`, `initialPrice`
- **ADR:** ADR 0021, ADR 0029
- **Tests:** `test_BuyAtomicallyIncludesRevenueReleasedThroughTheCurrentTimestamp`,
  `test_AcquisitionClassifiesTheCompletePaymentNinetyTen`, `test_BuyRejectsAnEmptyStrategy`, `test_BuyRejectsAStaleEpochId`,
  `test_BuyRejectsAPassedDeadline`, `test_BuyRejectsAPaymentAboveTheBuyersLimit`, `test_BuyRejectsAZeroRevenueReceiver`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** `revenueReceiver` is buyer-chosen. Setting it to Resonance creates unscheduled surplus
  (`test_RevenueReceiverEqualToResonanceCreatesUnscheduledSurplus`); setting it to the Strategy itself fails
  atomically (`test_RevenueReceiverEqualToStrategyFailsAtomically`).

### FACT-STR-03 — Strategy price decays linearly to zero over an immutable epoch duration

- **Plain-English claim:** The asking price falls in a straight line from its starting value to zero across the
  configured period, then stays at zero.
- **Technical formulation:** With `e = block.timestamp - epochStartedAt` and `D = epochDuration`:
  `currentPrice() = initialPrice - floor(initialPrice * e / D)` for `e < D`, else `0`.
  `MIN_EPOCH_DURATION = 1 hours`, `MAX_EPOCH_DURATION = 365 days`.
- **Source:** `packages/contracts/src/core/Strategy.sol:34-36`, `:195-199`
- **Functions/state:** `currentPrice`, `epochDuration`, `epochStartedAt`, `initialPrice`
- **ADR:** ADR 0021
- **Tests:** `test_PriceDecaysLinearlyToZeroAcrossTheEpoch`, `test_PriceStaysAtZeroLongAfterTheEpochEnds`,
  `testFuzz_PriceMatchesTheExactLinearFormula`, `testFuzz_PriceIsMonotonicallyNonIncreasingWithinAnEpoch`,
  `invariant_AuctionPricesStayWithinTheirBounds`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-STR-04 — The next epoch's starting price is the clearing payment times a multiplier, clamped

- **Plain-English claim:** If the last auction cleared high, the next one starts high. There is a hard floor and a
  hard ceiling.
- **Technical formulation:**
  `nextInitialPrice = clamp(floor(paymentAmount * priceMultiplier / 1e18), minimumPrice, type(uint192).max)`.
  `PRICE_SCALE = 1e18`, `priceMultiplier ∈ [1.1e18, 3e18]`,
  `minimumPrice ∈ [ABSOLUTE_MINIMUM_PRICE, ABSOLUTE_MAXIMUM_PRICE] = [1e6, type(uint192).max]`.
- **Source:** `packages/contracts/src/core/Strategy.sol:38-46`, `:233-237`
- **Functions/state:** `_nextInitialPrice`, `priceMultiplier`, `minimumPrice`, `PRICE_SCALE`
- **ADR:** ADR 0021
- **Tests:** `testFuzz_NextStartingPriceStaysWithinItsBounds`, `test_TheNextStartingPriceIsFlooredAtTheConfiguredMinimum`,
  `test_TheNextStartingPriceIsCappedAtTheAbsoluteMaximum`, `test_OneLateFillCollapsesTheAuctionToItsFloor`,
  `test_ConsecutiveFillsInTheSameBlockPayTheFullEscalatedPrice`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** `minimumPrice` is a floor on the **next starting price**, not a floor on the fill price. A fill can and
  routinely will occur below `minimumPrice`, including at zero after the epoch fully decays.

### FACT-STR-05 — Killing a Strategy is irreversible and preserves its pre-kill claim

- **Plain-English claim:** Governance can permanently retire a Strategy. It keeps whatever revenue it had already
  earned, receives nothing further, accepts no new signal, and existing signalers can still leave.
- **Technical formulation:** `killStrategy` is `onlyOwner nonReentrant updateReward(strategy)`. It reverts
  `FinalLiveStrategy` when `liveStrategyCount == 1`, then sets `isStrategyAlive[strategy] = false`, decrements
  `liveStrategyCount`, and subtracts `strategySignalWeight(strategy)` from `totalSignalWeight`. The `updateReward`
  runs first, so accrued whole reward units are preserved in `account_Token_Rewards`. `earned` returns
  `activeBalance = 0` for a dead Strategy, so no further accrual occurs. `addSignalFor` reverts `StrategyAlreadyDead`;
  `removeSignalFor` skips the `totalSignalWeight` decrement for a dead Strategy so the weight is not removed twice.
- **Source:** `packages/contracts/src/core/Resonance.sol:66-67`, `:290-292`, `:303-313`
- **Functions/state:** `killStrategy`, `isStrategyAlive`, `liveStrategyCount`, `FinalLiveStrategy`,
  `totalSignalWeight`, `earned`
- **ADR:** ADR 0028; **ADR 0031** (final-live-Strategy guard, superseding ADR 0029's permission to kill it)
- **Tests:** `test_KillingTheFinalLiveStrategyRevertsAfterBootstrap`,
  `test_WithdrawFromKilledStrategyDoesNotDecrementActiveWeightTwice`,
  `test_MoveFromKilledStrategyReentersLiveWeightExactlyOnce`,
  `invariant_DeadStrategiesAreExcludedFromActiveWeight`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** **At least one live Strategy always exists**, so there is always a valid signal destination. The owner
  replaces the final Strategy by calling `addStrategy(replacement)` before `killStrategy(previous)`; whether those two
  calls can be atomically batched is a property of the external governance system, not of the core.
  This does **not** eliminate the zero-active-weight condition of FACT-RES-06 — every signaler withdrawing still
  drives `totalSignalWeight` to zero. `moveSignalFor` from a dead Strategy adds the amount **back** into
  `totalSignalWeight` because it re-enters the live denominator.

### FACT-STR-06 — A killed Strategy's Bribe becomes a closed reward pool, and a final exit can permanently abandon rewards

- **Plain-English claim:** After a Strategy is retired, its reward pool stays open for whoever is still signaling it,
  but nobody new can join. If the last signaler leaves while rewards remain, those rewards are stranded forever.
- **Technical formulation:** `Bribe` has no kill state. `deposit` is unreachable for a dead Strategy because
  `Resonance.addSignalFor` rejects it. When `totalSupply` reaches zero, `withdraw` calls `_pauseStream` for every
  reward token; a paused stream can be resumed only by `deposit`, which can never occur again. Queued rewards
  likewise require a `deposit` to start.
- **Source:** `packages/contracts/src/core/Bribe.sol:314-342`, `:574-603`
- **Functions/state:** `withdraw`, `_pauseStream`, `_resumeAllStreams`, `queuedRewards`, `scheduledRewards`
- **ADR:** ADR 0028 (finding **BR-1**)
- **Tests:** `test_KnownRisk_DeadStrategyBribeCanPauseAndQueueRewardsForever`,
  `test_KillingAStrategyDoesNotConfiscateStreamingRewards`
- **Status:** `accepted-limitation`
- **Commit:** `281e601`
- **Caveats:** The abandoned amount is **not bounded to dust**. It may include a complete unvested stream plus any
  later notification made at zero supply. There is deliberately no retirement, refund, rescue, sweep, or
  Fund-reclassification path. Interfaces must warn the final signaler before they exit.

---

## H. Auction-payment settlement and acquired assets

### FACT-SETL-01 — Every auction payment is classified at a bounded global rate, defaulting to 90% Fund / 10% Bribe

- **Plain-English claim:** Of everything a buyer pays, a governed share becomes a reward for the people signaling that
  Strategy and the remainder becomes treasury backing. The share starts at 10% and can never exceed 20%, so at least
  80% of everything acquired always reaches the treasury.
- **Technical formulation:** `Resonance` holds the single global rate: `DEFAULT_BRIBE_BPS = 1_000`,
  `MAX_BRIBE_BPS = 2_000`, `bribeBps = DEFAULT_BRIBE_BPS`, mutated only by `onlyOwner setBribeBps(newBribeBps)` which
  reverts `BribeBpsAboveMaximum` above the ceiling. `BribeRouter` declares only `BPS = 10_000` and no share of its
  own. `routePayment` snapshots the rate **before any payment-token interaction**, so a token callback cannot alter
  the split of the fill it belongs to:

  ```text
  appliedBribeBps      = Resonance.bribeBps()      (revert BribeBpsAboveBasis if > BPS)
  pull exact `amount` from the immutable strategy
  bribeAmount          = ⌊amount · appliedBribeBps / 10000⌋
  accumulatedRemainder = splitRemainder + (amount · appliedBribeBps mod 10000)
  bribeAmount         += ⌊accumulatedRemainder / 10000⌋
  splitRemainder       = accumulatedRemainder mod 10000
  fundAmount           = amount − bribeAmount
  ```

  A rate change is prospective only: it cannot alter a recorded liability, a notified or claimable reward, or a prior
  Fund balance. There is no per-Strategy override, no BribeRouter-local setter, no team fee, and no caller-selected
  destination.

- **Source:** `packages/contracts/src/core/Resonance.sol` (`DEFAULT_BRIBE_BPS`, `MAX_BRIBE_BPS`, `setBribeBps`);
  `packages/contracts/src/core/BribeRouter.sol` (`routePayment`)
- **Functions/state:** `bribeBps`, `setBribeBps`, `routePayment`, `fundPaymentLiability`, `bribePaymentLiability`,
  `splitRemainder`, `accountedPaymentBalance`
- **ADR:** ADR 0036 (**supersedes ADR 0032's fixed 90/10**; ADR 0032 superseded ADR 0021's 100%-Fund rule)
- **Caveats:** Rate-setting transaction order is economically observable — a purchase settled before a change uses the
  old rate, one after it uses the new rate. The external system's delay and execution rules remain an open gate.
- **Tests:** `test_CompletePaymentIsClassifiedNinetyTenEvenWithLiveSignalWeight`,
  `test_TenOneUnitPaymentsClassifyExactlyNineToFundAndOneToBribe`, `test_TenOneUnitPaymentsDoNotStarveTheBribe`,
  `testFuzz_ClassificationIsFrequencyIndependent`, `test_RoutePaymentIsStrategyOnly`,
  `invariant_BribeRouterAccountingIdentitiesAreExact`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Accounting identity:**
  `accountedPaymentBalance == fundPaymentLiability + bribePaymentLiability` at all times. Direct donations are
  `paymentToken.balanceOf(router) − accountedPaymentBalance`, exposed as `paymentSurplus()`, and change neither
  liability nor the remainder.
- **Caveats:** This **replaces** the previous 100%-to-Fund rule. Any document, ABI consumer, or interface still
  asserting "no auction proceeds fund Bribes" describes superseded behavior. Note the split applies to the **acquired
  payment asset**, not to USDG: Resonance still transfers 100% of a Strategy's earned USDG to that Strategy
  (FACT-RES-07).

### FACT-SETL-01b — Classification is weighted, cumulatively exact, and frequency-independent across rate changes

- **Plain-English claim:** For any history of payments and snapshotted rates, the Router preserves the exact weighted
  cumulative entitlement. Nobody can erase it by splitting payments or changing the prospective rate.
- **Technical formulation:** `splitRemainder` carries the sub-unit Bribe entitlement in basis-point numerator units
  and is always `< BPS`. For payments `a_i` classified at their then-current rates `r_i`:

  ```text
  cumulative Bribe classification = ⌊(Σ a_i · r_i) / BPS⌋
  cumulative Fund classification  = Σ a_i − cumulative Bribe classification
  splitRemainder                  = (Σ a_i · r_i) mod BPS
  ```

  The implementation uses `Math.mulDiv` plus `mulmod` to avoid overflowing the intermediate product.

- **Source:** `packages/contracts/src/core/BribeRouter.sol`; `docs/adr/0036-governed-global-bribe-share.md`
- **Functions/state:** `splitRemainder`
- **ADR:** ADR 0036 (supersedes ADR 0032's fixed-rate policy while preserving cumulative carry)
- **Tests:** `testFuzz_ClassificationIsFrequencyIndependent`,
  `test_TenOneUnitPaymentsClassifyExactlyNineToFundAndOneToBribe`, `test_TenOneUnitPaymentsDoNotStarveTheBribe`,
  `test_WeightedSplitRemainderSurvivesTenZeroFiveAndTwentyPercentTransitions`,
  `testFuzz_ArbitraryRateTransitionsMatchTheWeightedNumeratorModel`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Worked example (internal finding SR-002's minimal trace):** ten separate one-raw-unit payments. Naive per-payment
  flooring would give the Bribe `⌊1·1000/10000⌋ = 0` every time — permanent starvation. With the carry, the tenth
  payment's `accumulatedRemainder` reaches `10000`, so cumulative state is exactly **Fund 9, Bribe 1, remainder 0**.
- **Caveats:** `splitRemainder` is a fractional entitlement in numerator units, never a withdrawable token balance and
  never a caller-controlled destination.

### FACT-SETL-02 — Both settlement legs are deferred, permissionless, and isolated from each other

- **Plain-English claim:** The two shares are recorded as owed and delivered by separate calls anyone can make. A
  problem with the treasury cannot block the reward leg, and vice versa; neither can block the auction itself.
- **Technical formulation:** `payFundPayment()` zeroes `fundPaymentLiability`, reduces `accountedPaymentBalance`, and
  transfers to `fund` with exact-delta checks. `notifyBribeReward()` zeroes `bribePaymentLiability`, reduces
  `accountedPaymentBalance`, approves the paired `Bribe`, calls `notifyRewardAmount`, clears any residual allowance,
  and verifies exact debit/credit. Both are `nonReentrant` and clear state **before** the external interaction, so a
  failure atomically restores only that leg's liability and leaves the other untouched.
- **Source:** `packages/contracts/src/core/BribeRouter.sol:144-179`
- **Functions/state:** `payFundPayment`, `notifyBribeReward`
- **ADR:** ADR 0032, ADR 0020
- **Tests:** `test_PayingFundIsPermissionlessAndClearsTheLiability`,
  `test_NotifyingBribeIsPermissionlessExactAndClearsOnlyItsLeg`,
  `test_AFailureOnEitherSettlementLegDoesNotBlockOrCorruptTheOther`,
  `test_BribeNotificationRejectsReentrancyAndStillVerifiesExactDeltas`,
  `test_BribeNotificationClearsAStickyResidualAllowance`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** A permanently broken or blocklisting payment token can leave either liability unpaid indefinitely.
  Destinations cannot be changed and there is no recovery path. The Bribe leg additionally depends on the payment
  token still being a registered reward token on the paired Bribe — which it always is, because `addStrategy`
  registers it at creation (FACT-STR-01).

### FACT-SETL-03 — A GBX-priced Strategy does not burn during settlement; burning is a separate permissionless step

- **Plain-English claim:** If a Strategy buys GBX, that GBX first lands in the Fund. Anyone can then burn it, but it
  is not burned automatically.
- **Technical formulation:** `Strategy` and `BribeRouter` treat GBX like any other payment token. `Fund.burnGBX(amount)`
  is public and calls `gbx.burn(amount)` on the Fund's own balance.
- **Source:** `packages/contracts/src/core/Fund.sol:64-70`
- **Functions/state:** `burnGBX`, `pendingGBX`
- **ADR:** ADR 0021
- **Tests:** `testFuzz_GBXPaymentCanBeBurnedPermissionlesslyAfterFundDelivery`,
  `test_GBXPaymentRequiresSeparateFundDeliveryAndBurn`,
  `test_GBXPaymentWaitsInRouterUntilFundDeliveryAndPermissionlessBurn`,
  `test_BurnGBXIsPermissionlessAndBurnsFundsOwnBalance`, `test_BurnGBXCannotExceedTheFundBalance`,
  `test_TheGBXPaymentPathIsReachableFromTheCampaign`, `invariant_GBXPaymentsNeverRemainInStrategy`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** **GBX sitting unburned in Fund inflates the redemption denominator**, because `Fund.redeem` snapshots
  `gbx.totalSupply()`, which includes Fund-held GBX. Redeemers should settle and burn pending Fund GBX first.

---

## I. Bribes and BribeRouters

### FACT-BRIBE-01 — Each Bribe registers at most eight append-only reward tokens

- **Plain-English claim:** A Strategy's reward pool supports up to eight different reward tokens. Tokens can be added
  but never removed, and the limit is hard-coded.
- **Technical formulation:** `MAX_REWARD_TOKENS = 8`. `addRewardToken` is `onlyResonance`, rejects zero/code-less
  addresses, rejects duplicates (`RewardAlreadyAdded`), and reverts `RewardTokenLimitReached` at eight. The Strategy's
  payment token occupies the first slot automatically (FACT-STR-01). Governance adds the rest through
  `Resonance.addBribeReward`, which additionally rejects `signalGBX`.
- **Source:** `packages/contracts/src/core/Bribe.sol:43`, `:346-355`; `packages/contracts/src/core/Resonance.sol:312-321`
- **Functions/state:** `MAX_REWARD_TOKENS`, `addRewardToken`, `isRewardToken`, `rewardTokens`
- **ADR:** ADR 0019
- **Tests:** `test_RewardTokenCountIsPermanentlyCappedAtEight`, `test_TheOwnerCannotExceedTheRewardTokenCap`,
  `test_AddRewardTokenRejectsZeroEOAAndDuplicates`, `test_RewardTokensAreListedInInsertionOrder`,
  `test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe`,
  `test_NonTransferableSignalGBXCannotBeAStrategyPaymentToken`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** The cap is what keeps every mandatory signal-entry, signal-exit, and settlement loop bounded (finding
  **A-08**). Gas is measured by `test_MaximumRewardTokenGasStaysFarBelowABlock` and
  `test_RewardTokenGasSlopeIsRecordedAndBounded`.

### FACT-BRIBE-02 — Bribes have two funding sources: the bounded automatic acquisition share and open external funding

- **Plain-English claim:** A Strategy's reward pool is fed by the global automatic share active when each payment is
  classified — 10% by default and adjustable prospectively from 0% through 20% — and separately by anyone who chooses
  to add rewards on top.
- **Technical formulation:** `notifyRewardAmount(rewardToken, amount)` is public. It requires a registered token,
  pulls exactly `amount` with exact-delta checks, and increments `accountedRewardBalance`. Two distinct callers use it:
  1. **Automatic** — `BribeRouter.notifyBribeReward()` delivers the accumulated `bribePaymentLiability` in the
     Strategy's payment token, which `addStrategy` registered as reward token 1 of 8 at creation (FACT-SETL-01).
  2. **External** — any account may fund any registered reward token to attract signal toward that Strategy.
- **Source:** `packages/contracts/src/core/Bribe.sol:260-288`; `packages/contracts/src/core/BribeRouter.sol:158-179`
- **Functions/state:** `notifyRewardAmount`, `accountedRewardBalance`, `BribeRouter.notifyBribeReward`
- **ADR:** ADR 0036 (bounded automatic share; supersedes ADR 0032's fixed 10%), ADR 0019 (external funding and the cap)
- **Tests:** `test_NotifyingBribeIsPermissionlessExactAndClearsOnlyItsLeg`, `test_NotifyRejectsAnUnregisteredToken`,
  `test_NotifyRejectsAFeeOnTransferRewardToken`, `test_MultipleRewardTokensAccrueIndependently`,
  `test_RewardsDonatedDirectlyToABribeAreNeverScheduled`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** ADR 0032 superseded ADR 0021's rule that auction proceeds never fund Bribes by introducing a fixed 10%
  share; ADR 0036 then replaced that fixed policy with the current 0–20% prospective range and 10% default. Whatever
  share is classified arrives through the same queueing and pausing machinery as any other notification
  (FACT-BRIBE-03, FACT-BRIBE-04), so it does not disturb a live stream.

### FACT-BRIBE-03 — A live Bribe stream is never reset by a top-up; extra funding queues behind it

- **Plain-English claim:** You cannot slow down or restart someone else's reward stream by adding a tiny amount.
  New money waits until the current stream finishes.
- **Technical formulation:** In `notifyRewardAmount`, if `totalSupply == 0 || data.periodFinish != 0`, the amount is
  added to `queuedRewards[rewardToken]` and the function returns. Otherwise `_startStream` begins immediately.
  `_checkpointToken` starts the queue when the active stream finishes, advancing through at most the current stream
  and one queued successor per call.
- **Source:** `packages/contracts/src/core/Bribe.sol:280-287`, `:455-487`
- **Functions/state:** `queuedRewards`, `_startStream`, `_checkpointToken`
- **ADR:** ADR 0019, ADR 0027
- **Tests:** `test_NotifyQueuesRatherThanShrinkingALiveStream`, `test_ATopUpWaitsBehindTheUndisturbedActiveStream`,
  `test_AnOutsiderCannotExtendOrSlowTheLiveStream`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** This differs deliberately from Resonance, which _does_ restart on a qualifying notification
  (FACT-RES-03). The two mechanisms are not the same and must not be described interchangeably.

### FACT-BRIBE-04 — Zero signal supply pauses a Bribe stream rather than consuming its time

- **Plain-English claim:** If everyone stops signaling a Strategy, its reward stream freezes instead of burning
  through its schedule with nobody to pay.
- **Technical formulation:** `withdraw` calls `_pauseStream` for every reward token when `totalSupply` reaches zero,
  recording `pauseStarted = block.timestamp`. `deposit` calls `_resumeAllStreams` when supply leaves zero, adding
  `pausedDuration` to `periodFinish`, `remainderFinish`, and `lastUpdateTime`. `_checkpointToken` and
  `_previewEmission` return early while paused.
- **Source:** `packages/contracts/src/core/Bribe.sol:304-306`, `:333-339`, `:574-603`
- **Functions/state:** `pauseStarted`, `_pauseStream`, `_resumeAllStreams`
- **ADR:** ADR 0027
- **Tests:** `test_ZeroSignalWeightPausesAndExtendsTheStreamWithoutRetroactiveAccrual`,
  `testFuzz_RepeatedZeroSupplyPausesPreserveEveryEarlyRemainderUnit`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Pause/resume requires a future `deposit`. After a Strategy is killed, no deposit is possible, so a
  paused stream is permanently frozen (FACT-STR-06).

### FACT-BRIBE-05 — Bribe carries exact sub-unit remainders and classifies unindexable carry to Fund

- **Plain-English claim:** Bribe rewards keep track of fractions of a token so nothing is lost to rounding. Fractions
  that cannot fairly be assigned to anyone go to the Fund, not to other signalers.
- **Technical formulation:** `REWARD_PRECISION = 1e36`. Emission accumulates in `pendingRewardScaled` at
  `emitted * 1e36`. `_indexPendingReward` moves only the exactly divisible part into `rewardPerTokenStored`:
  `delta = pendingRewardScaled / supply`; `indexedScaled = delta * supply`; the remainder stays in
  `pendingRewardScaled`. Before **every** supply change, `_fundAllPendingRewards` moves the whole
  `pendingRewardScaled` into `fundRewardRemainder` via `_accrueFundScaled`, which converts full `1e36` units into
  `fundRewardLiability`. When an account's balance reaches zero, its `userRewardRemainder` also moves to Fund.
- **Source:** `packages/contracts/src/core/Bribe.sol:41`, `:299`, `:319`, `:325-331`, `:492-515`, `:552-562`, `:607-629`
- **Functions/state:** `pendingRewardScaled`, `indexedRewardScaled`, `userRewardRemainder`, `fundRewardRemainder`,
  `fundRewardLiability`, `_movePendingToFund`, `_accrueFundScaled`
- **ADR:** ADR 0027 (finding **A-09** Bribe half), ADR 0037
- **Tests:** `test_NewSignalerCannotReceivePreEntryRewardCarry`, `test_RemainingSignalerCannotReceivePreExitRewardCarry`,
  `test_FullExitCannotReallocateUserRewardRemainder`, `test_FlashSignalWeightCannotStealAccruedBribeRewards`,
  `test_LowDecimalRewardTokensDistributeTheExactRateRemainder`,
  `test_TheWorstCaseFormerRateFlooringRemainderIsFullyDistributed`,
  `invariant_BribeAccountingIdentitiesAreExact`, `invariant_BribesAreSolventAgainstAccruedRewards`,
  `testFuzz_BribeIsAlwaysSolventAgainstAccruedRewards`
- **Status:** `implemented`
- **Commit:** `40d919e`
- **Caveats:** There is a sole-signaler special case: when `balanceOf(account) == totalSupply`, the account absorbs
  `pendingRewardScaled` directly (`_checkpointAccount`), and `earned` mirrors this by adding `globalScaled % supply`.

### FACT-BRIBE-06 — Claims are selective, so a broken reward token cannot block the others

- **Plain-English claim:** You can claim one reward token at a time, or a chosen list, so a token that is frozen or
  broken does not stop you collecting the rest.
- **Technical formulation:** Three entry points: `claimRewards(account)` (all registered tokens),
  `claimReward(account, token)` (one), and `claimRewards(account, address[] calldata)` (selected, with duplicate and
  registration validation performed **before** any token interaction). All pay `account`, never `msg.sender`.
- **Source:** `packages/contracts/src/core/Bribe.sol:210-254`, `:635-645`
- **Functions/state:** `claimRewards`, `claimReward`, `_claim`
- **ADR:** ADR 0019, ADR 0020
- **Tests:** `test_SelectiveClaimOmitsABrokenRewardToken`,
  `test_SelectiveClaimRejectsDuplicatesAndUnregisteredTokensBeforeInteraction`,
  `test_AllTokenClaimFailureIsAtomicAndScalarClaimsRemainIndependent`,
  `test_ClaimAlwaysPaysTheAccountEvenWhenATtriggeredByAThirdParty`, `test_ReentrantRewardPayoutCannotDoubleClaim`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-BRIBE-07 — Signal removal and unstaking never transfer a reward, payment, or revenue token

- **Plain-English claim:** You can always get your stake back. Leaving a Strategy is pure accounting — it never
  depends on a token transfer that could fail.
- **Technical formulation:** `Bribe.withdraw` performs only accounting: checkpoints, carry classification, balance
  decrements, and stream pauses. It contains no `transfer`, `transferFrom`, or `safeTransfer` call.
  `SignalGBX.removeSignal` and `unstake` touch only GBX.
- **Source:** `packages/contracts/src/core/Bribe.sol:314-342`
- **Functions/state:** `withdraw`
- **ADR:** ADR 0020 (finding **A-04**)
- **Tests:** `invariant_EveryActorCanFullyWithdrawSignals`,
  `test_AHostileRevenueTokenCannotReenterRemoveSignal`, `test_AHostileRewardTokenCannotReenterSignalChanges`,
  `test_AdversarialRemovalOrdersCannotCorruptSignalBalances`,
  `test_AFrozenFundCannotBlockKilledStrategyExitOrItsPreservedClaim`
- **Status:** `implemented`
- **Commit:** `281e601`

---

## J. The Fund

### FACT-FUND-01 — Fund is an ownerless, registry-free raw-token treasury

- **Plain-English claim:** The Fund holds whatever tokens it receives. It has no administrator, no list of approved
  assets, and no way to move assets except redemption by GBX holders.
- **Technical formulation:** `contract Fund is ReentrancyGuard` — no `Ownable`, no roles. Its only state is the
  immutable `gbx`. The only functions that move value are `burnGBX` (destroys Fund-held GBX) and `redeem`. There is no
  sweep, rescue, recovery, or migration function.
- **Source:** `packages/contracts/src/core/Fund.sol:19-60`
- **Functions/state:** `gbx`, `burnGBX`, `redeem`, `pendingGBX`
- **ADR:** ADR 0017
- **Tests:** `test_FundHasNoAdministrativeSurfaceLeft`, `test_RedemptionIsTheOnlyWayAssetsCanEverLeaveFund`,
  `test_FundHoldsAssetsPermanentlyWithRedemptionAndBurnAsItsOnlyExits`, `test_DonatedPaymentTokensAreStrandedWithNoRescuePath`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Any ERC-20 sent to Fund becomes redeemable backing without review. Official protocol membership is
  represented by Strategies registered in Resonance, **not** by a Fund balance. Interfaces must label unsolicited Fund
  balances separately.

### FACT-FUND-02 — Redemption pays the floored pro-rata share of caller-selected tokens

- **Plain-English claim:** Burn GBX, name the assets you want, and receive your proportional share of each. Assets you
  do not name are permanently given up.
- **Technical formulation:** For each selected token `i`:
  `payout_i = floor(balanceOf_i(Fund) * gbxAmount / supplyBeforeBurn)`
  where `supplyBeforeBurn = Mine.effectiveTotalSupply()` captured before the burn.
- **Source:** `packages/contracts/src/core/Fund.sol:78-135`
- **Functions/state:** `redeem`, `balancesBefore`, `payouts`
- **ADR:** ADR 0017
- **Tests:** `test_RedeemPaysProRataAgainstThePreBurnSupply`, `testFuzz_PayoutIsExactlyTheFlooredProRataShare`,
  `test_FundRedeemsCallerSelectedAssetsAgainstPreBurnSupply`, `test_RedeemCanDirectAssetsToAThirdParty`,
  `test_OmittedTokensArePermanentlyForfeitedForThatRedeemer`, `test_RedeemingTheEntireSupplyDrainsTheSelectedAssets`,
  `testFuzz_BackingPerGBXNeverDecreasesOnRedemption`, `testFuzz_SequentialRedemptionsStaySolvent`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Worked example (from `packages/simulations/fixtures/economic-scenarios.json`):** minted supply
  `100,000,000e18`, pending mining `1,000,000e18`, effective denominator `101,000,000e18`, Fund USDG
  `50,000,000.000000` (raw `50000000000000`), redeeming `1,000,000e18` GBX. Payout with effective supply is
  `floor(50000000000000 * 1e24 / 1.01e26) = 495,049,504,950` raw USDG. Without the checkpoint it would have been
  `500,000,000,000` — effective supply correctly includes the miners' accrued-but-unminted GBX.

### FACT-FUND-03 — Redemption reads a constant-time effective Mine supply before taking the denominator

- **Plain-English claim:** Before working out your share, the protocol counts every miner's accrued GBX without
  minting it or touching any mining slot.
- **Technical formulation:** `redeem` validates `gbx.minterLocked()`, that `mine` has code, and that
  `IMine(mine).gbx() == address(gbx)`, then reads `IMine(mine).effectiveTotalSupply()`. Mine computes this in constant
  time from minted supply plus its aggregate pending-emission accumulator.
- **Source:** `packages/contracts/src/core/Fund.sol:85-94`
- **Functions/state:** `redeem`, `IMine.effectiveTotalSupply`
- **ADR:** ADR 0033 (finding **A-10**)
- **Tests:** `test_RedemptionUsesEffectiveSupplyWithoutSettlingAnyMiner`,
  `test_RedeemRequiresAFinalizedReciprocalMineIdentity`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-FUND-04 — Redemption rejects GBX, the zero address, and duplicates using EIP-1153 transient storage

- **Plain-English claim:** You cannot list the same asset twice or list GBX itself, and the check works no matter what
  order you list assets in — without leaving any permanent record.
- **Technical formulation:** `_markToken(namespace, token)` reverts `ForbiddenToken` for zero or GBX, computes
  `slot = keccak256(abi.encode(REDEMPTION_NAMESPACE, token))`, reverts `DuplicateToken` if `tload(slot) != 0`, and
  `tstore(slot, 1)`. `_clearToken` zeroes the slot after each successful payout so a second redemption later in the
  same transaction is independent.
- **Source:** `packages/contracts/src/core/Fund.sol:22`, `:160-194`
- **Functions/state:** `_markToken`, `_clearToken`, `_transientStore`, `_transientLoad`
- **ADR:** ADR 0017
- **Tests:** `test_RedeemRejectsGBXTheZeroAddressAndDuplicates`, `test_RedeemRejectsDuplicatesInAnyPosition`,
  `test_TransientDuplicateMarksAreClearedBetweenCallsInOneTransaction`, `test_RedeemRejectsDegenerateArguments`,
  `test_FundAllowsOmissionsAndRejectsDuplicateOrGBXEntries`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** This requires the target chain to support EIP-1153 (Cancun). That is a hard deployment prerequisite
  recorded in `docs/TRUST_ASSUMPTIONS.md`.

### FACT-FUND-05 — A redemption is atomic; one failing selected transfer reverts the burn and every other transfer

- **Plain-English claim:** If any asset you selected cannot be delivered, the entire redemption is undone — including
  the GBX burn. You can retry with that asset omitted.
- **Technical formulation:** All balance snapshots and payouts are computed first; then GBX is pulled and burned; then
  transfers occur with exact debit/credit checks. Any revert unwinds the whole call. Two additional guards run:
  a pre-transfer check that `currentBalance >= balancesBefore[i]`, and a final pass requiring every selected token to
  retain at least `balancesBefore[i] - payouts[i]`.
- **Source:** `packages/contracts/src/core/Fund.sol:99-135`
- **Functions/state:** `redeem`, `SelectedBalanceDecreased`, `_transferExact`
- **ADR:** ADR 0017 (finding **E-01**)
- **Tests:** `test_ASelectedFailingTransferRollsBackTheEntireRedemption`,
  `test_BrokenTokenCanBeOmittedAndSelectedFailureRollsBackBurn`,
  `test_RedeemRejectsDifferentAddressesThatDebitOneSharedLedger`,
  `test_RedeemFinalPassRejectsAnAsymmetricAliasSideEffect`, `test_RedeemRejectsAFeeOnTransferAsset`,
  `test_RedeemIsReentrancyGuarded`, `test_RedeemSupportsTokensThatReturnNoBoolean`,
  `test_RedeemRequiresTheCallerToActuallyHoldTheGBX`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** The final pass exists specifically to defeat two token facades backed by one shared ledger, which would
  otherwise let a redeemer consume the same backing twice.

---

## K. LiquidityPosition

### FACT-LP-01 — LiquidityPosition permanently holds one precommitted hookless Uniswap v4 GBX/USDG position

- **Plain-English claim:** The protocol's market liquidity lives in one position that is locked in a contract forever.
  Nobody, including governance, can take it out.
- **Technical formulation:** `contract LiquidityPosition is IERC721Receiver, ReentrancyGuard` — no `Ownable`, no
  withdrawal function of any kind. `onERC721Received` accepts exactly one NFT, requiring `msg.sender == positionManager`,
  `!positionRecorded`, `from == positionDepositor`, `tokenId == expectedPositionTokenId`, a matching `poolKeyHash`,
  matching `expectedTickLower`/`expectedTickUpper`, and nonzero liquidity. The constructor rejects a hooked pool
  (`NonzeroHook`) and a pool that is not exactly the GBX/USDG pair in address order.
- **Source:** `packages/contracts/src/core/LiquidityPosition.sol:40`, `:157-273`
- **Functions/state:** `onERC721Received`, `positionRecorded`, `positionTokenId`, `poolKeyHash`, `positionInCustody`
- **ADR:** ADR 0017, ADR 0014 (position identity)
- **Tests:** `test_TheAcceptedPositionIsRecordedAndInCustody`, `test_TheCanonicalNFTCanNeverLeaveOnceAdmitted`,
  `test_ASecondPositionIsAlwaysRejected`, `test_OnlyThePositionManagerMayDeliverTheNFT`,
  `test_RejectsAPositionFromADifferentPool`, `test_RejectsAPositionFromAnUnexpectedDepositor`,
  `test_RejectsAPositionWithTheWrongRange`, `test_RejectsAnEmptyPosition`, `test_RejectsAnUnexpectedTokenId`,
  `test_ConstructorRejectsAHookedPool`, `test_ConstructorRejectsAPoolThatIsNotTheCanonicalPair`,
  `test_ThePositionHolderHasNoAdministrativeSurfaceLeft`, `test_PoolKeyRoundTripsToTheCommittedHash`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** A deployment error in pool, range, or token ID is **unrecoverable**. Admission checks run once, on
  receipt, and are the only defense.

### FACT-LP-02 — Harvesting fees is permissionless, preserves principal exactly, routes USDG, and burns GBX

- **Plain-English claim:** Anyone can collect the trading fees the position has earned. The fees in USDG become
  protocol revenue; the fees in GBX are destroyed. The underlying liquidity never moves.
- **Technical formulation:** `harvestFees()` records `principalLiquidity`, calls `modifyLiquidities` with
  `DECREASE_LIQUIDITY(tokenId, 0, 0, 0, "")` followed by two `CLOSE_CURRENCY` actions, then requires
  `getPositionLiquidity(tokenId) == principalLiquidity` (`PrincipalLiquidityChanged`). It transfers its entire USDG
  balance to `resonanceRouter` and calls `route()`, then transfers its entire GBX balance to `fund` and calls
  `fund.burnGBX(...)`. Both transfers use exact debit/credit checks.
- **Source:** `packages/contracts/src/core/LiquidityPosition.sol:282-314`
- **Functions/state:** `harvestFees`, `FeesHarvested`
- **ADR:** ADR 0022 (supersedes ADR 0018 compounding)
- **Tests:** `testFuzz_HarvestIsExactAndPrincipalIsFixed`, `test_HarvestIsPermissionless`,
  `test_RepeatedHarvestsNeverChangePrincipal`, `test_HarvestRetainsNoCanonicalTokens`,
  `test_HarvestWithNoFeesIsANoOp`, `test_HarvestStillWorksAfterPriceLeavesTheRange`,
  `test_RoutingFailureAtomicallyRestoresTheFeeEntitlementAndBurn`, `test_HarvestRequiresARecordedPositionInCustody`,
  `test_CustodyReportsFalseWhenTheNFTNoLongerExists`, `test_CompoundingAndCallerFundingSurfacesAreGone`,
  `test_UniswapV4ZeroLiquidityDecreaseCollectsFeesWithoutRemovingPrincipal`,
  `test_DirectCanonicalDonationsFollowTheSameDestinations`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** There is **no caller bounty**. Fees may sit unharvested until someone voluntarily pays gas. A failing
  route or burn reverts the entire harvest. Direct GBX or USDG donations to the contract are swept to the same
  destinations on the next harvest.

### FACT-LP-03 — The genesis position begins as GBX only, outside the active price range

- **Plain-English claim:** The starting liquidity is one-sided: only GBX, placed above the market, so it sells into
  demand rather than requiring matching stablecoin capital.
- **Technical formulation:** Documented as deployment step 7 in `docs/DEPLOYMENT.md`: initialize the reviewed hookless
  GBX/USDG v4 pool and create the precommitted out-of-range position using only the 20 million GBX allocation.
  `LiquidityPosition` enforces the _range_ (`expectedTickLower`, `expectedTickUpper`) and nonzero liquidity, but does
  not itself verify one-sidedness or that the range is out of market.
- **Source:** `docs/DEPLOYMENT.md` step 7; `packages/contracts/src/core/LiquidityPosition.sol:264-269`
- **Functions/state:** `expectedTickLower`, `expectedTickUpper`
- **ADR:** ADR 0014, ADR 0022
- **Tests:** `test_HarvestStillWorksAfterPriceLeavesTheRange` (behavioral); no test asserts genesis one-sidedness,
  because that is a deployment property.
- **Status:** `config-dependent`
- **Commit:** `281e601`
- **Caveats:** An incorrect genesis price or range can strand the position out of market permanently.

---

## L. Immutable bindings and deployment topology

### FACT-BIND-01 — Every one-time binding requires a reciprocal identity check and can be set only once

- **Plain-English claim:** Each contract confirms that the contract it is about to trust points back at it, and once
  bound, the link is permanent.
- **Technical formulation:**
  | Binding | Guard | Reciprocal check |
  | ------------------------------------ | ---------------------------------------------------- | ----------------------------------------- |
  | `GBX.setMinter(Mine)` | `msg.sender == minter`, `!minterLocked` | `IMine(newMinter).gbx() == address(this)` |
  | `SignalGBX.setResonance` | `onlyOwner`, `resonance == address(0)` | `Resonance.signalGBX() == address(this)` |
  | `StrategyFactory.setResonance` | `onlyOwner`, `resonance == address(0)` | `Resonance.strategyFactory() == address(this)` |
  | `BribeFactory.setResonance` | `onlyOwner`, `resonance == address(0)` | `Resonance.bribeFactory() == address(this)` |
  | `Resonance.setResonanceRouter` | `onlyOwner`, `resonanceRouter == address(0)` | `Router.resonance() == address(this)` **and** `Router.usdg() == usdg` |
  | `Mine` constructor | n/a | `Router.usdg() == usdg` |
  | `LiquidityPosition` constructor | n/a | `Router.usdg() == usdg`, `Fund.gbx() == gbx` |
  All reciprocal reads are wrapped in `try/catch` and revert on failure.
- **Source:** `GBX.sol:57-73`; `SignalGBX.sol:184-196`; `StrategyFactory.sol:44-57`; `BribeFactory.sol:44-56`;
  `Resonance.sol:247-263`; `Mine.sol:160-161`; `LiquidityPosition.sol:170-179`
- **ADR:** ADR 0030 (finding **E-02**)
- **Tests:** `test_SetResonanceIsOwnerOnlyValidatesIdentityAndBindsOnce`, `test_SetResonanceIsOwnerOnlyValidatesIdentityAndBindsOnce`,
  `test_SetResonanceIsOwnerOnlyValidatesIdentityAndBindsOnce`, `test_ResonanceRouterBindingIsOwnerOnlyValidatedAndSingleUse`,
  `test_StrategyFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse`,
  `test_BribeFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse`,
  `test_MinterHandoverIsOneTimeAndRequiresDeployedCode`, `test_ConstructorRejectsMismatchedDestinationTokens`,
  `test_InitialStateAndImmutableIdentities`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** A reciprocal check proves consistency, not honesty. A malicious lookalike returning the expected
  identity passes. Finding **M-03** remains an open High release gate requiring exact runtime code hashes,
  constructor arguments, receipts, and a signed manifest.

### FACT-BIND-02 — SignalGBX cannot accept stakes until Resonance is bound

- **Plain-English claim:** Staking is impossible until the protocol graph is fully wired, so nobody can deposit into a
  half-built system.
- **Technical formulation:** Every staking and signaling entry point calls `_configuredResonance()`, which reverts
  `ResonanceNotSet` while `resonance == address(0)`.
- **Source:** `packages/contracts/src/core/SignalGBX.sol:198-201`
- **Functions/state:** `_configuredResonance`, `resonance`, `ResonanceNotSet`
- **ADR:** ADR 0030
- **Tests:** `test_SignalRequiresBoundResonance`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-BIND-03 — The remaining administrative surface is exactly four functions

- **Plain-English claim:** After setup, the only things the `Resonance` owner can do are: add a Strategy, retire a
  Strategy, register a Bribe reward token, and set the signaler share within its coded 0-20% bound.
- **Technical formulation:** `onlyOwner` functions in the current source state:
  `Resonance.addStrategy`, `Resonance.killStrategy`, `Resonance.addBribeReward`, `Resonance.setBribeBps`,
  `Resonance.setResonanceRouter` (one-time), `SignalGBX.setResonance` (one-time), `StrategyFactory.setResonance`
  (one-time), `BribeFactory.setResonance` (one-time). The one-time bindings are consumed during deployment, leaving
  the four continuing actions. `Fund`, `LiquidityPosition`, and `Mine` have no owner at all.
- **Source:** `Resonance.sol`; `Mine.sol`; `Fund.sol`; `LiquidityPosition.sol`
- **ADR:** ADR 0016, ADR 0017, ADR 0033, ADR 0034
- **Tests:** `test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`,
  `test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal`,
  `test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe`, `test_FundHasNoAdministrativeSurfaceLeft`,
  `test_ThePositionHolderHasNoAdministrativeSurfaceLeft`
- **Status:** `implemented`
- **Commit:** `dc67d7c`
- **Caveats:** The owner may also call inherited `transferOwnership` and `renounceOwnership`. "Setup authority is
  handed to a reviewed external executor" is a deployment procedure (FACT-GOV-08), not a contract-enforced fact.

### FACT-BIND-04 — There is no upgrade path, proxy, pause switch, sweep, or migration anywhere

- **Plain-English claim:** No contract in the protocol can be upgraded, paused, drained by an admin, or replaced by a
  successor.
- **Technical formulation:** No contract inherits a proxy, `Initializable`, `UUPSUpgradeable`, or `Pausable`. No
  `delegatecall` appears in `packages/contracts/src`. No function transfers an arbitrary token to an
  administrator-chosen address. No successor, migration, or recovery entry point exists. There is also no governance
  machinery of any kind (FACT-GOV-01).
- **Source:** whole of `packages/contracts/src`
- **ADR:** ADR 0017, ADR 0016, ADR 0034
- **Tests:** `test_FundHasNoAdministrativeSurfaceLeft`, `test_ThePositionHolderHasNoAdministrativeSurfaceLeft`,
  `test_CompoundingAndCallerFundingSurfacesAreGone`, `test_RedemptionIsTheOnlyWayAssetsCanEverLeaveFund`
- **Status:** `implemented`
- **Commit:** `dc67d7c`
- **Caveats:** This is a strength and a risk simultaneously. A discovered bug cannot be patched in place.

---

## M. Supported assets and external dependencies

### FACT-TOK-01 — Only standard, non-rebasing ERC-20s are supported; exact-delta checks fail closed

- **Plain-English claim:** The protocol works with ordinary tokens. Tokens that take a cut on transfer, rebase, or
  behave unusually will cause transactions to revert rather than silently lose value.
- **Technical formulation:** Every value-moving path in `Mine`, `SignalGBX`, `Resonance`, `Strategy`, `BribeRouter`,
  `Bribe`, `Fund`, and `LiquidityPosition` snapshots sender and receiver balances around the transfer and reverts
  (`InexactTransfer` / `InexactPayment` / `InexactPayout` / `InexactRewardTransfer` / `InexactRevenueTransfer` /
  `InexactUnderlyingTransfer`) unless both deltas equal the requested amount.
- **Source:** `Mine.sol:249-269`, `:288-293`; `SignalGBX.sol:207-242`; `Resonance.sol:407-427`;
  `Strategy.sol:164-227`; `BribeRouter.sol:95-146`; `Bribe.sol:266-274`, `:651-661`; `Fund.sol:137-147`;
  `LiquidityPosition.sol:326-335`
- **ADR:** ADR 0020
- **Tests:** `test_SignalRejectsFeeOnTransferUnderlyingAndRollsBack`, `test_WithdrawRejectsFeeOnTransferAndRestoresEveryLedger`,
  `test_BuyRejectsAFeeOnTransferPaymentToken`, `test_NotifyRejectsAFeeOnTransferRewardToken`,
  `test_NotificationRejectsFeeOnTransferRevenue`, `test_RoutePaymentRejectsAFeeOnTransferToken`,
  `test_RedeemRejectsAFeeOnTransferAsset`, `test_MineRejectsAnInexactIncomingPayment`,
  `test_MineRejectsAnInexactRouterCredit`, `test_MissingReturnRewardTokenCompletesTheWholeFlow`,
  `test_RedeemSupportsTokensThatReturnNoBoolean`, `test_FeeEnabledAfterNotificationRollsBackTheClaimAndCanRetry`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** This is fail-closed **evidence**, not support. It does not make an adversarial, upgradeable, pausable,
  or blocklisting token safe. `docs/SUPPORTED-TOKEN-MODEL.md` is the normative statement.

### FACT-TOK-02 — Tokens that revert on zero approval are supported; exact allowances skip redundant cleanup

- **Plain-English claim:** Some tokens (notably BNB-style) reject a zero approval. The protocol handles them.
- **Technical formulation:** `Strategy._settlePayment` and `ResonanceRouter.route` both call
  `if (allowance(...) != 0) forceApprove(spender, 0)` rather than approving zero unconditionally.
- **Source:** `Strategy.sol:211`; `ResonanceRouter.sol:70`
- **ADR:** finding **E-04**
- **Tests:** `test_BuySupportsAPaymentTokenThatRejectsZeroApprovals`,
  `test_RouteSupportsARevenueTokenThatRejectsZeroApprovals`, `test_BuyClearsAResidualExactAllowanceLeftByANonstandardToken`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-EXT-01 — External dependencies

- **Plain-English claim:** The protocol depends on OpenZeppelin libraries, Uniswap v4, a USDG stablecoin it does not
  control, and a chain that supports transient storage.
- **Technical formulation:**
  | Dependency | Used by | Nature of trust |
  | -------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
  | OpenZeppelin `ERC20`, `ERC20Permit`, `ERC20Votes`, `Ownable`, `ReentrancyGuard`, `SafeERC20`, `Math` | all contracts | Library correctness |
  | Uniswap v4 `IPositionManager`, `Actions`, `PoolKey`, `PositionInfo` | `LiquidityPosition` | Correct fee accounting on a zero-liquidity decrease |
  | USDG (external ERC-20, 6 decimals by deployment) | `Mine`, `Resonance`, `ResonanceRouter`, `Strategy`, `LiquidityPosition` | Issuer solvency, no blocklist, no rebase; **the issuer is not the protocol** |
  | Strategy payment tokens and Bribe reward tokens | `Strategy`, `BribeRouter`, `Bribe`, `Fund` | Each is an independent third-party token with its own upgrade and freeze risk |
  | EIP-1153 transient storage (Cancun) | `Fund.redeem` | Target chain must support `tstore`/`tload` |
  There is **no price oracle, NAV calculation, entropy source, or keeper role** anywhere in the protocol.
- **Source:** import statements across `packages/contracts/src`; `docs/TRUST_ASSUMPTIONS.md`
- **ADR:** ADR 0016, ADR 0024
- **Tests:** `test_UniswapV4ZeroLiquidityDecreaseCollectsFeesWithoutRemovingPrincipal` and the integration profile
  (`FOUNDRY_PROFILE=integration`) exercise real Uniswap v4 fee harvesting.
- **Status:** `implemented` / `config-dependent`
- **Commit:** `281e601`
- **Caveats:** The intended target chain is named as **Robinhood Chain** in `README.md`, and
  `packages/config/deployments` holds dated _candidate_ files (for example
  `robinhood-mainnet-wrapped-btc.2026-08-02.candidate.json`). No canonical USDG or Uniswap v4 address is resolved,
  and no signed manifest clears them.

---

## N. Known limitations (accepted, with no mitigation path)

### FACT-LIM-01 — Resonance surplus is unbounded and unrecoverable

See FACT-RES-06. Rounding floors, zero-active-signal intervals, and direct donations accumulate in Resonance with no
sweep, rescue, or later-allocation path. `1e36` precision makes individual floors small, but **no lifetime dust bound
is claimed**. Finding **A-02**, accepted by ADR 0029.

### FACT-LIM-02 — A dead Strategy's Bribe can permanently abandon an unbounded amount

See FACT-STR-06. Finding **BR-1**, accepted by ADR 0028.

### FACT-LIM-03 — Vote checkpoints outlive the position they record

See FACT-GOV-06. Finding **G-01**. An account may hold or borrow GBX through a block, signal it, then **withdraw**
and retain its recorded historical weight. Not exploitable in the core, which reads no checkpoints; it becomes a live
concern for whichever external system is attached. Open integration gate.

### FACT-LIM-04 — The core provides no delay, veto, or cancellation

See FACT-GOV-01. ADR 0034 removed the Governor and Timelock, so an owner call takes effect in the transaction that
makes it, with no queue and no observable pending state. Finding **G-02** (the removed Timelock's uncancellable
queue) is superseded by removal, not proven safe. Whatever protections eventually exist will be properties of the
selected external system.

### FACT-LIM-05 — The external governance system is unselected

See FACT-GOV-08 and FACT-GOV-09. Finding **G-03**, an **open** release gate — not accepted. The protocol's capture
resistance, liveness, delay, and accountability properties are undefined rather than weak, and a deployment that
skipped the handoff would ship an ordinary admin key.

### FACT-LIM-06 — Legacy tenures can keep aggregate issuance above the prospective rate

See FACT-MINE-06. Because each tenure's rate is locked until replacement, incumbents keep a pre-halving rate after a
deployment-time boundary is crossed, so aggregate issuance can exceed the current global rate indefinitely if those
tenures do not turn over. Finding **M-01**, accepted by ADR 0033 and retained by ADR 0041.

### FACT-LIM-07 — Miners face rollover risk; there is no guaranteed handoff payment

See FACT-MINE-04. A miner receives the 80% handoff amount only if a successor pays a nonzero replacement price. After
the hour elapses the price is zero, so a successor can replace an incumbent while funding no claim at all. Finding
**M-02**, accepted by ADR 0024. Interfaces must not present the successor payment as principal, yield, or a
guaranteed refund.

### FACT-LIM-08 — Omitted redemption assets are permanently forfeited

See FACT-FUND-02. There is no partial-claim ledger; omitted assets remain in Fund for the post-redemption supply.

### FACT-LIM-09 — Fee harvesting has no bounty

See FACT-LP-02. Accrued Uniswap fees can remain unharvested indefinitely if nobody volunteers gas.

### FACT-LIM-10 — Lazy accounting means displayed balances understate entitlements

Mining accrual (FACT-MINE-01) and Resonance streaming (FACT-RES-01) are both lazy. `GBX.totalSupply()` understates
economic supply; a Strategy's raw USDG balance understates its executable auction inventory. Interfaces must preview
`Mine.effectiveTotalSupply()` and `Resonance.earned(strategy, usdg)` rather than reading raw balances.

### FACT-LIM-11 — Permissionless Mine revenue routing has no liveness guarantee

See FACT-MINE-12 and FACT-RES-04. Mine deposits protocol revenue into ResonanceRouter and finishes. Anyone may call
`route()`, but no role, bounty, or automatic transaction exists. A qualifying balance can therefore remain in the
Router indefinitely, delaying its seven-day stream and allowing the eventual caller's timing to affect the restart.
Optional frontend or cron automation belongs in periphery and cannot be treated as a protocol guarantee.

---

## O. Current deployment, review, and audit status

### FACT-STATUS-01 — Not deployed on any network

- **Claim:** No protocol contract is deployed. No signed deployment manifest exists for this repository state.
- **Source:** `docs/DEPLOYMENT.md` ("This is an unexecuted development outline, not a deployment manifest or release
  authorization … No signed manifest exists for this repository state."); `packages/config/deployments/README.md` and
  its dated candidate files; `AGENTS.md` ("The protocol is not audited, deployed, or authorized for user funds.")
- **Status:** verified at `281e601`

### FACT-STATUS-02 — No independent external audit has been performed

- **Claim:** There is no independent third-party audit of any version of this protocol.
- **Source:** `packages/contracts/audit/FINDINGS.md` ("Independent audit, mutation testing, pinned Echidna, legal
  clearance, and a signed deployment manifest remain open."); `docs/THREAT_MODEL.md` ("Current internal hardening does
  not replace independent security review.")
- **Status:** verified at `281e601`

### FACT-STATUS-03 — Internal engineering evidence in the current uncommitted tree

- **Claim:** Extensive local test campaigns exist. They are engineering evidence, not proof and not an audit.
- **Verified locally on 2026-08-22:**
  - The current uncommitted ADR 0044 working tree passed **356/356 default-profile Foundry tests** across 25 suites and
    **19/19 integration tests** across 2 suites, with zero failures or skips. Hardhat passed **4/4**, SDK **50/50**,
    TypeScript simulations **39/39**, Python environment-policy checks **5/5**, Python simulations **25/25**, subgraph
    specification checks **4/4**, Matchstick **10/10**, web unit tests **3/3**, and Playwright **6/6**. Subgraph and
    workspace builds, ABI checks, documentation checks, formatting, lint, and typecheck also passed.
  - The current matrix includes both 10,000-run Mine fuzz cases, 27 stateful invariant entries at 1,000 runs of depth
    500 plus two deterministic reachability regressions (29/29 for the suite) with zero handler reverts, the ADR 0044
    Mine/Router failure-isolation regression, and exact gas, harness, fixture, and chart checks.
- **Explicitly historical and not current Mine evidence:** pinned static analysis, native Medusa and Echidna,
  symbolic-analysis dispositions, and mutation results all predate ADR 0044's Mine changes.
- **Still absent:** independent external audit, compatible current-tree symbolic analysis, re-run static analysis,
  external fuzzing and mutation testing, a second external-fuzzer seed, independent review of the provisional Mine
  economics, external-governance integration review, monitored testnet rehearsal, release review, and a signed
  deployment manifest.
- **Status:** current local engineering evidence for an uncommitted working tree; no reviewed candidate commit is pinned

### FACT-STATUS-04 — Open release gates

| Finding | Severity | Gate                                                                                                                                            |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| M-03    | High     | Immutable bindings cannot detect a malicious lookalike; requires signed manifest, runtime code hashes, constructor arguments, receipts.         |
| M-04    | High     | Mine economics are selected, hard-coded, and modelled, but still require independent economic review before deployment.                         |
| G-03    | High     | The external governance system that will own `Resonance` is unselected; its voting, delegation, permission, and delay semantics are unreviewed. |
| G-01    | High     | sGBX checkpoints survive withdrawal; the selected external system's snapshot-to-vote spacing requires independent review of the capture model.  |
| E-02    | High     | Reduced but not eliminated; codehash, parameter, and manifest review remains external.                                                          |

Additionally open per the current `FINDINGS.md`: independent audit, current-tree regeneration of the static-analysis,
external-fuzzing, and mutation gates, a second external-fuzzer seed, legal clearance, reviewed production parameters,
exact external-governance integration review, monitored testnet rehearsal, and a signed deployment manifest.

- **Source:** `packages/contracts/audit/FINDINGS.md`, `packages/contracts/audit/SIGNAL-RESONANCE-FINDINGS.md`
- **Status:** current uncommitted working-tree review

### FACT-STATUS-05 — Legal and provenance clearance is an unresolved release blocker

- **Claim:** The chain of title for the protocol's upstream code lineage is not resolved, and repository-level
  (BUSL-1.1) and file-level (MIT) license terms are not reconciled.
- **Technical detail:** Active contracts are adaptations of pinned give.fun `ef6ee14a…`, pinned Liquid Signal
  Governance `14b5fbbb…`, and unpinned donut-miner lineage. `Strategy`'s reverse-Dutch shape has a transitive Euler Fee Flow
  ancestor at `3bee858a…` whose reviewed file is **GPL-2.0-or-later**. Synthetix and Solidly ancestors are named
  without exact repository, commit, or path. `LiquidityPosition` cites a TokenJar concept with no recorded
  repository/commit/path.
- **Source:** `docs/LEGAL-PROVENANCE-BLOCKER.md`, `NOTICE`
- **Status:** `open-gate`, verified at `281e601`
- **Caveats:** Additionally, a separate recorded concern exists regarding the project name and logo deriving from a
  third-party brand. That is outside the scope of these documents and is not propagated in them.

---

## Historical verified check results (`281e601`)

Commands were run against the working tree at commit `281e601ecb3f3989da826a8a7dfba37b63b55ca0`.

| Check                       | Command                                            | Result                                                                                                                             |
| --------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Default Foundry suite       | `forge test --summary`                             | 339 passed, 0 failed, 0 skipped (20 suites)                                                                                        |
| Integration Foundry profile | `FOUNDRY_PROFILE=integration forge test --summary` | 17 passed, 0 failed, 0 skipped (2 suites)                                                                                          |
| Formatting                  | `pnpm format:check` (Node 22.23.1)                 | Pass — Prettier and `forge fmt --check` clean                                                                                      |
| Simulation fixtures         | `pnpm simulations:fixtures:check`                  | Pass — reference, economic, and Section 33 fixtures match the independent TypeScript and Python models; committed SVG charts match |
| Relative link resolution    | manual resolution of every `](../…)` target        | Pass — no broken links in the four documents                                                                                       |
| Code-fence balance          | fence parity across all four documents             | Pass — 0 / 4 / 4 / 114 fences, all balanced                                                                                        |
| Constant cross-check        | every quoted constant re-read from Solidity        | Pass — all match (see the table below)                                                                                             |

### Current development-tree constant cross-check

| Constant                                                | Source                 | Value                        |
| ------------------------------------------------------- | ---------------------- | ---------------------------- |
| `GBX.GENESIS_LIQUIDITY_ALLOCATION`                      | `core/GBX.sol`         | `20_000_000 ether`           |
| `Mine.BPS` / `Mine.PREVIOUS_MINER_BPS`                  | `core/Mine.sol`        | `10_000` / `8_000`           |
| `Mine.PRICE_DECAY_PERIOD`                               | `core/Mine.sol`        | `1 hours`                    |
| `Mine.SLOT_COUNT` / `PRICE_MULTIPLIER`                  | `core/Mine.sol`        | `16` / `2`                   |
| `Mine.MINIMUM_INITIAL_PRICE` / `MAX_INITIAL_PRICE`      | `core/Mine.sol`        | `1e6` / `uint192.max`        |
| `Mine.INITIAL_TPS` / `TAIL_TPS`                         | `core/Mine.sol`        | `64 ether` / `1 ether`       |
| `Mine.HALVING_PERIOD`                                   | `core/Mine.sol`        | `69 days`                    |
| `Resonance.DURATION` / `REWARD_PRECISION`               | `core/Resonance.sol`   | `7 days` / `1e36`            |
| `Bribe.REWARD_DURATION` / `REWARD_PRECISION`            | `core/Bribe.sol`       | `7 days` / `1e36`            |
| `Bribe.MAX_REWARD_TOKENS`                               | `core/Bribe.sol`       | `8`                          |
| `Strategy.MIN_/MAX_EPOCH_DURATION`                      | `core/Strategy.sol`    | `1 hours` / `365 days`       |
| `Strategy.ABSOLUTE_MINIMUM_PRICE` / `PRICE_SCALE`       | `core/Strategy.sol`    | `1e6` / `1e18`               |
| `Bribe.MAX_LIFETIME_REWARD_AMOUNT`                      | `core/Bribe.sol`       | `⌊(2²⁵⁶−1)/1e36⌋`            |
| `Resonance.BPS` / `DEFAULT_BRIBE_BPS` / `MAX_BRIBE_BPS` | `core/Resonance.sol`   | `10_000` / `1_000` / `2_000` |
| `BribeRouter.BPS`                                       | `core/BribeRouter.sol` | `10_000`                     |

This registry is descriptive engineering evidence. It neither authorizes deployment nor substitutes for independent
review of the Solidity, tests, generated interfaces, models, and consumer applications it describes.

---

## Unresolved discrepancies

These are recorded rather than silently resolved. None of them is asserted as fact in any public document.

### D-1 — "Reverse Dutch auction" naming

`AGENTS.md`, `docs/EMISSIONS.md`, and `Strategy.sol`'s own NatSpec all describe the mechanism as a _reverse_ Dutch
auction. Mechanically, both `Mine` and `Strategy` implement a **descending-price** auction: the price starts high and
falls linearly to zero until someone fills it. That is conventionally a plain Dutch auction; "reverse Dutch" is the
term used in the Euler Fee Flow lineage this design descends from. **Resolution used in public documents:** the
repository's term is retained, and the mechanics are always stated explicitly ("the price falls until someone takes
it") so no reader is misled by the label.

### D-2 — Six-decimal USDG is a deployment assumption, not a code constant

`Resonance`'s `1e36` precision is calibrated for a 6-decimal reward token against 18-decimal signal weight, and
`AGENTS.md`, `docs/SPEC.md`, and `docs/ECONOMICS.md` all describe USDG as six-decimal. **No contract reads
`usdg.decimals()` or enforces the value.** The only in-repository evidence for "6" is the test fixture
(`ProtocolFixture.sol:65`) and the simulation fixtures. If a deployment bound a USDG with different decimals, the
contracts would still function but the precision calibration and every economic example would change.
**Resolution used in public documents:** stated as a deployment property of the intended USDG, never as a contract
guarantee.

### D-3 — Stale `Fundraiser` artifact

`packages/contracts/artifacts/hardhat/src/core/Fundraiser.sol` exists as compiler output with no corresponding source
in `packages/contracts/src`. The Fundraiser design was superseded by ADR 0024. **Resolution:** excluded entirely; no
public document mentions a Fundraiser. This is a housekeeping issue in generated artifacts, not a protocol fact.
Regenerating Hardhat artifacts would clear it. It was not touched, because generated artifacts are out of scope for
this documentation task.

### D-4 — Test count drift between documents

`packages/contracts/audit/TEST-CAMPAIGN.md` reports 340 default Foundry tests at commit `54e3f2c3` (2026-08-09).
`packages/contracts/audit/FINDINGS.md` reported 322 at 2026-08-15; the pre-ADR-0034 campaign recorded 335 default and
17 integration. All predate the current source state.
**Resolution used in public documents:** the current ADR 0044 uncommitted tree independently passed 356 default and 19
integration tests. The ADR 0042 tree happened to record the same totals, but remains distinct historical evidence.
Public documents cite the ADR 0044 rerun as current local engineering evidence without inventing a review commit;
older counts are omitted or explicitly labelled with their own source state and date.

### D-5 — Ownership closure is procedural, not enforced

`docs/ACCESS_CONTROL.md`, `docs/INVARIANTS.md`, and `docs/TRUST_ASSUMPTIONS.md` state ownership and administrator
conditions as invariants. **No Solidity in this repository enforces any of them**; they are deployment steps 9–10.
Under ADR 0034 the specific obligation changed — from Timelock role closure to transferring `Resonance` to a reviewed
external executor and proving the temporary setup owner retains nothing — but its procedural character did not. Test
fixtures prove the wiring is achievable, not that any deployment achieved it.
**Resolution used in public documents:** always described as an intended deployment configuration that must be proven
by signed deployment evidence, never as a property the code guarantees. See FACT-GOV-08.

### D-6 — Two different senses of "index"

The repository uses the word in two places, with different scope:

- `README.md:3` — "an experimental, governance-minimized onchain **index protocol**".
- `AGENTS.md:72` — "Official protocol/**index membership** is represented by Strategies registered in Resonance, not
  by a Fund asset list."

The `AGENTS.md` formulation is the precise one and is supported by the implementation: `Resonance.isStrategy` /
`isStrategyAlive` is a real, governance-curated registry of the assets the protocol targets. What the implementation
does **not** contain is any index _methodology_ — there is no target weighting, rebalancing, drift correction,
reconstitution rule, or NAV computation anywhere in `packages/contracts/src`, and `Fund` deliberately has no asset
registry at all (FACT-FUND-01).

**Resolution used in public documents:** the `AGENTS.md` sense is adopted. Registered Strategies are described as
index membership; the absence of index methodology, weights, rebalancing, and NAV is stated explicitly; and
membership is never inferred from a Fund balance, since `Fund` accepts unsolicited transfers without review. An
earlier draft of these documents flatly denied that the protocol is an index, which overcorrected against
`AGENTS.md:72`; that phrasing was revised.
