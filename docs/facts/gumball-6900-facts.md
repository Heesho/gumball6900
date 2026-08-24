# GUM BALL 6900 internal fact registry

> Internal working document. This registry is the evidence base for the public one-pager, layman's article, and
> technical whitepaper. It is engineering evidence only: it is not an audit, a deployment authorization, a legal
> conclusion, or a claim that the protocol is safe for user funds.

- **Current source state:** uncommitted development tree based on `d80b92da5e60c0daa54dbae29653898dde514053`
- **Historical fact baseline:** `dc67d7c4d634097fa6e285fa33ce964d591d2bd2`
- **Working tree at current revision:** dirty; no reviewed candidate commit is pinned
- **Registry revision date:** 2026-08-24

> **Revision note.** Earlier drafts of this registry and its three public documents were written against commits
> `281e601` and then `95ed60e`. Two later changes superseded them. ADR 0033 fixed the Mine at sixteen permanent slots
> with constant-time pending emission, removing capacity governance and the all-slot checkpoint. ADR 0034 deleted
> `ProtocolGovernor` and the protocol `TimelockController` entirely, leaving `Resonance` owned by an external
> governance system that has not been selected; ADR 0035 added the Bribe lifetime reward cap. Those historical
> revisions were re-derived against `dc67d7c`. ADRs 0036-0049 and the current Mine work were subsequently checked
> against an uncommitted development tree based on `40d919e`. HEAD later advanced through `e3ebdd7` and `d80b92d` for
> deck and landing-page work without changing the protocol source; the current uncommitted tree is based on `d80b92d`. Facts
> carrying older commit stamps identify the tree where that unchanged claim was originally verified; facts changed by
> the current work carry an explicit uncommitted or historical commit stamp. **Section E was rewritten in full: every
> ProtocolGovernor, Timelock, proposal-lifecycle, quorum, and cancellation fact from earlier editions describes
> contracts that no longer exist.**

> **Mine-halving revision.** ADR 0041 supersedes the cumulative-mining halving rule in ADR 0024/0033 and the
> `HALVING_AMOUNT` selected by ADR 0038. ADR 0042 sets the current development candidate's provisional 69-day schedule
> and 64 GBX-per-second initial rate; ADR 0043 sets its 1 GBX-per-second tail. This revision is not deployment approval;
> independent economic research remains an open gate.

> **Mine-routing revision.** ADR 0044 makes delivery into ResonanceRouter the terminal Mine revenue action. Mine emits
> `RevenueDeposited` and never calls `route()`; Router forwarding is a later permissionless action with no role,
> bounty, or liveness guarantee.

> **Mine-dependency revision.** ADR 0045 removes Mine's constructor-time `Router.usdg()` read. A pinned
> post-deployment check must prove Mine's USDG and Router identities before GBX's permanent minter handoff or market
> exposure; a mismatched candidate is abandoned and redeployed.

> **Resonance-accounting revision.** ADR 0046 specializes Resonance's permanently USDG-only stream to scalar reward
> state and tokenless reward views. ADR 0047 then restores ordinary Synthetix leftover rollover in Resonance and
> Bribe, removes Bribe queue/pause/carry/Fund-liability accounting and selected-batch claims, moves the payment split
> back into Strategy, and reduces BribeRouter to a Bribe-only buffer. Bribes remain bounded multi-token rewarders.

> **Bribe-cap and move-composition revision.** ADR 0048 raises the fixed append-only Bribe reward-token limit from
> eight to sixteen. It also removes `Resonance.moveSignalFor`; `SignalGBX.moveSignal` now atomically composes
> `removeSignalFor` followed by `addSignalFor`, with complete rollback if the destination addition fails.

> **Canonical-transfer revision.** ADR 0049 removes sender/receiver balance-delta checks from canonical GBX/USDG
> transfers in Mine and SignalGBX. Those paths use `SafeERC20` under the standard-token assumption.
> Fund retains exact debit/credit and basket guards because redeemers may select arbitrary token addresses.

> **Zero-premint revision.** ADR 0050 removes the canonical liquidity contract and 20 million GBX premint. GBX starts
> with zero supply and Mine is its sole lifetime issuer. A reviewed external fungible USDG-GBX Uniswap V2 LP token may
> be registered as an ordinary bootstrap Strategy asset; the core has no liquidity-specific logic or guarantee.

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
| ADR 0017 | Remove successor migration; ownerless Fund and LP            | Fund ownerlessness and removal of successor migration remain accepted. LiquidityPosition provisions are superseded by ADR 0050.                                                                                                                                                                           |
| ADR 0024 | Immutable multislot Mine with tenure-locked rates            | Supply model and tenure rate lock. Its cumulative-mining halving model is superseded by ADR 0041; its GBX-ERC20Votes statement by ADR 0030; its capacity, checkpoint, redemption-denominator, and Mine-administration decisions by ADR 0033; its synchronous downstream route by ADR 0044.                |
| ADR 0028 | Closed Bribe pools after Strategy death                      | Strategy-death and incumbent-exit consequences remain. Its queue/pause-created terminal-lock analysis is superseded by ADR 0047's continuously advancing stream.                                                                                                                                          |
| ADR 0029 | Bribe-based Resonance reward stream                          | Global Resonance streaming, `1e36` index, and accepted surplus remain. Signal entrypoints/state ownership, final-Strategy kill, ownership, Mine routing, and exact raw scheduling are superseded by later ADRs, most recently ADR 0047.                                                                   |
| ADR 0030 | SignalGBX coordination and selector-bounded token governance | Non-transferable ERC20Votes sGBX only. Its ProtocolGovernor, Timelock, selector-filter, and cancellation decisions are superseded by ADR 0034; its idle-sGBX and `allocatedBalance` decisions by ADR 0031; its dedicated Resonance move hook by ADR 0048.                                                 |
| ADR 0031 | Mandatory signal-backed SignalGBX                            | No idle sGBX; atomic signal/withdraw; `balanceOf` is the aggregate; final live Strategy cannot be killed. Its retention of the Governor and Timelock is superseded by ADR 0034, and canonical-GBX balance-delta checks by ADR 0049.                                                                       |
| ADR 0033 | Fixed Mine slots and constant-time pending emission          | Sixteen permanent slots, no capacity governance, no owner, no all-slot checkpoint; constant-time pending emission and the `effectiveTotalSupply` redemption denominator. Its cumulative-mining rate-selection rule is superseded by ADR 0041 and its genesis supply offset by ADR 0050.                   |
| ADR 0034 | External governance ownership                                | **New.** No core Governor, Timelock, executor, or adapter. `Resonance` is the only contract with continuing custom owner authority; its external owner is unselected, the three setup-only Ownable shells must be renounced, and deployment is blocked until a later ADR pins the governance integration. |
| ADR 0035 | Bribe lifetime reward cap                                    | Monotonic per-token `lifetimeRewardNotified` counter; its original `1e18` precision and numeric cap are superseded by ADR 0037.                                                                                                                                                                           |
| ADR 0036 | Bounded dynamic acquisition split                            | Prospective global automatic-Bribe share from 0% through 20%. Its exact weighted carry and deferred-liability settlement are superseded by ADR 0047's per-purchase Strategy split.                                                                                                                        |
| ADR 0037 | High-precision Bribe reward index                            | `1e36` Bribe index and precision-coupled lifetime notification cap remain. Its exact carry and Fund-liability machinery is superseded by ADR 0047; its eight-token bound by ADR 0048.                                                                                                                     |
| ADR 0038 | Fixed Mine economics                                         | Fixed replacement multiplier and starting-price floor. Its initial rate is superseded by ADR 0042, its tail rate by ADR 0043, and its `HALVING_AMOUNT` by ADR 0041.                                                                                                                                       |
| ADR 0039 | Event-only Mine messages                                     | Optional handoff message capped at 280 raw bytes and emitted only in `Mined`.                                                                                                                                                                                                                             |
| ADR 0040 | Deployment-time Mine authority verification                  | Removal of the per-handoff authority check; deployment evidence must prove the permanent GBX minter binding.                                                                                                                                                                                              |
| ADR 0041 | Time-based Mine halvings                                     | Deployment-time halving shape, time anchor, tail clamp, and tenure-lock consequences. Its provisional `4 * 365 days` period and 4 GBX/second initial rate are superseded by ADR 0042; its 0.01 GBX/second tail by ADR 0043.                                                                               |
| ADR 0042 | Provisional accelerated Mine emissions                       | Current provisional 64 GBX/second initial rate and 69-day periods. Its 0.5 GBX/second tail is superseded by ADR 0043. Independent economic review remains open.                                                                                                                                           |
| ADR 0043 | Provisional one-GBX Mine tail                                | Current provisional 1 GBX/second tail; it begins at the sixth 69-day boundary. Independent economic review remains open.                                                                                                                                                                                  |
| ADR 0044 | Decouple Mine handoffs from revenue routing                  | Mine deposits the nominal protocol share into ResonanceRouter and emits `RevenueDeposited` without calling `route()`. Permissionless routing has no role, bounty, or liveness guarantee; its canonical-USDG balance-delta checks are superseded by ADR 0049.                                              |
| ADR 0045 | Defer Mine-to-Router token verification to deployment        | Mine stores supplied dependencies without calling the Router; pinned post-deployment evidence must prove the Mine/Router USDG pairing before permanent binding or exposure.                                                                                                                               |
| ADR 0046 | Specialize Resonance to USDG-only accounting                 | Scalar USDG-only state and tokenless reward views remain. Its preservation of exact raw scheduling is superseded by ADR 0047.                                                                                                                                                                             |
| ADR 0047 | Restore Synthetix-shaped rewards and Strategy settlement     | Ordinary leftover rollover and floor surplus; continuously advancing Bribe streams; all-token plus scalar claims; direct per-purchase Strategy split; BribeRouter-only buffering; standard-token SafeERC20 model. Its preservation of the eight-token bound is superseded by ADR 0048.                    |
| ADR 0048 | Expand Bribe rewards and compose signal moves                | Fixed sixteen-token append-only Bribe registry; no dedicated Resonance move hook; SignalGBX moves atomically compose source removal and live-destination addition.                                                                                                                                        |
| ADR 0049 | Trust canonical token transfers                              | Mine and SignalGBX use `SafeERC20` for canonical GBX/USDG without sender/receiver balance snapshots. Fund's exact selected-token payout and basket guards remain.                                                                                                                                         |
| ADR 0050 | Zero premint and external LP Strategy                        | GBX begins at zero supply and Mine is its sole lifetime issuer. No canonical liquidity contract exists; a reviewed external USDG-GBX UniV2 LP token may be an ordinary bootstrap Strategy asset.                                                                                                          |

### Historical context only — partially superseded

| ADR      | Superseded provisions that must not be presented as current                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 0013 | Acquisition-split and buyback provisions (by ADR 0021, then 0032); external proposer/canceller model (by ADR 0030, then removed entirely by ADR 0034).                                                        |
| ADR 0014 | GBX mint authority and distribution (by ADR 0024); fee routing (by ADR 0018, then ADR 0022).                                                                                                                  |
| ADR 0015 | Whole-account action/event examples (by ADR 0019); public coordination surface (by ADR 0030).                                                                                                                 |
| ADR 0016 | Terminology and implementation details; "management fee" wording means the bounded acquisition auction; its eight-token Bribe cap is superseded by ADR 0048.                                                  |
| ADR 0019 | Resonance batch/enumeration APIs (by 0029); direct Resonance signal entrypoints and aggregate state (by 0030); idle-allocation and standalone exit (by 0031); eight-token Bribe cap (by 0048).                |
| ADR 0020 | Resonance carry/donation/Fund-liability (by 0029); Strategy routing (by 0021, then 0032/0047); Bribe exact-carry, queue, pause, Fund-liability, selected-batch-claim, and exact-transfer decisions (by 0047). |

### Fully superseded — excluded from all public documents

| ADR      | Title                                              | Superseded by |
| -------- | -------------------------------------------------- | ------------- |
| ADR 0018 | Auto-compounding liquidity position                | ADR 0022      |
| ADR 0022 | Fixed-principal LP fee routing                     | ADR 0050      |
| ADR 0021 | Uniform Strategy settlement into Fund (100%-Fund)  | **ADR 0032**  |
| ADR 0023 | Fixed GBX supply and pre-funded Fundraiser reserve | ADR 0024      |
| ADR 0025 | Global seven-day Resonance revenue stream          | ADR 0026      |
| ADR 0026 | Exact active-plus-successor Resonance stream       | ADR 0029      |
| ADR 0027 | Fix Bribe carry before signal-supply boundaries    | ADR 0047      |
| ADR 0032 | Fixed 90/10 acquired-asset settlement              | ADR 0036/0047 |

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
be reported as current. `packages/contracts/audit/FINDINGS.md` is the latest disposition register, reconciled on
2026-08-24 through ADR 0049. `packages/contracts/audit/SIGNAL-RESONANCE-FINDINGS.md` is explicitly a pre-ADR-0047
historical campaign ledger.

**Pinned static analysis, native external fuzzing, and the earlier mutation results are historical.** The pinned
static-analysis and native external-fuzzer campaigns predate substantial current architecture changes. A narrow
49-mutant Signal/Resonance campaign covers ADRs 0036/0037 but predates ADR 0043, and the separate 46/46 campaign
covers ADR 0047 but predates ADR 0048. The focused ADR-0048 campaign killed 47/47 targeted mutants, but it predates
ADR 0049. None of these results is an independent audit or complete production-safety review.

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
  `test_ConstructorStartsWithZeroSupply`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Governance weight exists only after GBX is staked into SignalGBX (FACT-SGBX-01).

### FACT-GBX-02 — GBX starts with zero supply

- **Plain-English claim:** The token contract creates no GBX at deployment. There is no team allocation, presale,
  airdrop, or liquidity premint in the token contract.
- **Technical formulation:** The constructor sets only the temporary `minter`; `totalSupply`, `lifetimeMinted`, and
  `lifetimeBurned` all begin at zero. `mint` rejects every caller until the one-time Mine binding is locked.
- **Source:** `packages/contracts/src/core/GBX.sol`
- **Functions/state:** `constructor`, `lifetimeMinted`, `minter`, `minterLocked`, `mint`
- **ADR:** ADR 0050 (supersedes the genesis-offset provisions of ADR 0024 and ADR 0033)
- **Tests:** `test_ConstructorStartsWithZeroSupply`, `test_OnlyPermanentlyBoundMineCanMint`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0050 development candidate (2026-08-24)
- **Caveats:** The constructor's temporary minter may perform the one-time binding but cannot mint GBX.

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
- **Functions/state:** `slot`, `Slot.tps`, `Slot.lastAccruedAt`, `pendingSlotEmission`, `pendingEmission`, `totalMined`
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
- **Functions/state:** `SLOT_COUNT`, `slot`
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
- **Functions/state:** `PRICE_DECAY_PERIOD`, `currentPrice`, `_price`, `Slot.initialPrice`, `Slot.auctionStartedAt`
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
  Mine requests transfer of `revenueAmount` into ResonanceRouter through `SafeERC20` and emits `RevenueDeposited`; it
  does not inspect balance deltas or call `route()`.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `PREVIOUS_MINER_BPS`, `BPS`, `_allocatePayment`, `_collectAndDeposit`, `RevenueDeposited`,
  `claimableMinerPayment`, `totalClaimableMinerPayments`
- **ADR:** ADR 0024 as superseded in routing behavior by ADR 0044 and transfer checks by ADR 0049
- **Tests:** `test_ReplacementAfterThirtyMinutesSettlesOnlyThatSlotAndSplitsEightyTwenty`,
  `test_FirstMinerDepositsCompletePaymentAndReceivesOneSixteenthGlobalTps`,
  `test_ZeroPriceSelfReplacementRealizesAccrualAndRestartsAtOneDollar`,
  `testFuzz_MineRevenueAndHandoffClaimsReachFinalDestinationsWithScheduleSurplus`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0049 development candidate (2026-08-24)
- **Caveats:** `revenueAmount = paid - floor(paid * 0.8)`, so the deposited share is `ceil(paid * 0.2)`. The protocol,
  not the displaced miner, receives the rounding unit. `RevenueDeposited` records the nominal Router deposit; under
  the supported standard-USDG assumption it arrives, but Mine does not prove balance movement. The event does not
  prove same-transaction stream entry. There is no team fee anywhere in `Mine.sol`.

### FACT-MINE-05 — Displaced-miner payments are pull claims, permissionless to trigger, always paid to the entitled account

- **Plain-English claim:** A displaced miner's 80% is held for them to withdraw. Anyone can trigger the withdrawal,
  but the money can only go to the miner.
- **Technical formulation:** `claimMinerPayment(address account)` reads `claimableMinerPayment[account]`, zeroes it,
  decrements `totalClaimableMinerPayments`, and requests transfer to `account` through `SafeERC20` — never to
  `msg.sender`. Canonical USDG is
  trusted to move the requested amount; balance deltas are not inspected.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `claimMinerPayment`, `claimableMinerPayment`, `totalClaimableMinerPayments`
- **ADR:** ADR 0024 as modified by ADR 0049
- **Tests:** `test_ClaimIsPermissionlessButAlwaysPaysTheDisplacedMiner`,
  `test_ClaimRejectsZeroAndAccountsWithoutLiability`, `invariant_MineIsSolventAgainstReplacementClaims`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0049 development candidate (2026-08-24)

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
  | `MIN_INITIAL_PRICE` | `1e6` |
  | `MAX_INITIAL_PRICE` | `type(uint192).max` |
  | `INITIAL_TPS` | `64 ether` |
  | `HALVING_PERIOD` | `69 days` (`5_961_600` seconds) |
  | `TAIL_TPS` | `1 ether` |
  Mine also stores the deployment timestamp in immutable `startTime`. Mine stores the supplied USDG and Router without
  calling the Router; ADR 0045 requires pinned post-deployment checks that `Mine.usdg() == USDG`,
  `Mine.resonanceRouter() == ResonanceRouter`, and `ResonanceRouter.usdg() == USDG`.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `constructor`, fixed constants
- **ADR:** ADR 0038, ADR 0041, ADR 0042, ADR 0043, ADR 0045
- **Tests:** `test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority`,
  `test_ConstructorRejectsInvalidDependenciesAndDefersRouterTokenVerification`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0045 development candidate (2026-08-22)
- **Caveats:** The emission schedule remains provisional. Selection and deterministic modelling do not constitute
  independent economic review or deployment approval. In the synchronized, fully occupied, fully refreshed, fully
  settled, no-burn reference, mining emits and supplies 751,161,600 GBX before the day-414 tail; annual tail flow is
  initially about 4.1982% of that reference and declines as supply grows. Legacy
  tenures can exceed this path, empty slots can undershoot it, and burns change the live denominator.

### FACT-MINE-09 — The next slot opening price is the paid price times an immutable multiplier, clamped

- **Plain-English claim:** After a slot is bought, the next auction starts higher — a fixed multiple of what was just
  paid — with a floor and a ceiling.
- **Technical formulation:**
  `nextInitialPrice = clamp(paymentAmount * PRICE_MULTIPLIER, MIN_INITIAL_PRICE, MAX_INITIAL_PRICE)`, with
  `PRICE_MULTIPLIER = 2`.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `_nextInitialPrice`, `PRICE_MULTIPLIER`, `MIN_INITIAL_PRICE`, `MAX_INITIAL_PRICE`
- **ADR:** ADR 0038
- **Tests:** `test_NextStartingPriceCapsAtTheAbsoluteMaximum`,
  `test_ZeroPriceSelfReplacementRealizesAccrualAndRestartsAtOneDollar`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** A fill at zero (after the hour elapses) produces zero before clamping, so the next auction restarts at
  `MIN_INITIAL_PRICE`. Price recovery from the floor is geometric, not immediate.

### FACT-MINE-10 — Replacement callers are protected by expected epoch, deadline, and maximum payment

- **Plain-English claim:** A miner's transaction specifies which auction round they expect, the latest time they will
  accept, and the most they will pay. Any mismatch reverts.
- **Technical formulation:** `mine(miner, slotIndex, expectedEpochId, deadline, maximumPayment, message)` reverts with
  `EpochIdMismatch`, `DeadlinePassed`, `IndexOutOfBounds`, or `MaximumPaymentExceeded`. `epochId` increments on every
  fill.
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
  job ends after its nominal protocol-share transfer request into ResonanceRouter succeeds.
- **Technical formulation:** `_collectAndDeposit` uses `SafeERC20` for payer → Mine and Mine → ResonanceRouter without
  inspecting balance deltas, emits `RevenueDeposited(index, epochId, revenueAmount)`, and contains no external
  `route()` call. A failed transfer call into ResonanceRouter still reverts the paid handoff.
  `ResonanceRouter.route()` is separately permissionless and may be called manually or by optional
  frontend/keeper/cron periphery, with no role or bounty.
- **Source:** `packages/contracts/src/core/Mine.sol`; `packages/contracts/src/core/ResonanceRouter.sol`
- **Functions/state:** `Mine.mine`, `_collectAndDeposit`, `RevenueDeposited`, `ResonanceRouter.route`,
  `USDG.balanceOf(ResonanceRouter)`
- **ADR:** ADR 0044 as modified by ADR 0049
- **Tests:** `test_FirstMinerDepositsCompletePaymentAndReceivesOneSixteenthGlobalTps`,
  `test_BlockedRevenueIngressDoesNotBlockMineAndRemainsPermissionlesslyRetryable`,
  `testFuzz_MineRevenueAndHandoffClaimsReachFinalDestinationsWithScheduleSurplus`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0049 development candidate (2026-08-24)
- **Caveats:** Permissionless does not mean automatic. Router revenue may wait indefinitely even after qualifying if no
  caller submits `route()`, and routing timing can affect the next seven-day restart. A future optional mine-and-route helper may live in
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
  `Resonance.removeSignalFor` has succeeded for the same amount. Both directions use `SafeERC20` and trust canonical
  GBX without inspecting sender or receiver balance deltas.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `signal`, `signalWithPermit`, `withdrawSignal`, `_depositAndMint`, `_burnAndWithdraw`, `_update`
- **ADR:** ADR 0031 (supersedes ADR 0030's standalone staking) as modified by ADR 0049
- **Tests:** `test_SignalAtomicallyCustodiesMintsVotesAndMirrorsThePairedBribe`,
  `test_SignalAtomicallyCustodiesMintsDelegatesAndMirrors`,
  `test_WithdrawSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying`,
  `test_TransfersRemainPermanentlyDisabled`, `testFuzz_SignalMoveWithdrawRoundTripIsLossless`,
  `invariant_SignalReceiptIsFullyCollateralized`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0049 development candidate (2026-08-24)
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
  `test_MoveSignalComposesRemoveAndAddWhilePreservingCustodySupplyVotesAndAggregateSignal`
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
  subsequent `SafeERC20.safeTransferFrom` in `_depositAndMint` as the allowance and call-success check. ADR 0049
  deliberately removes balance-delta verification.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `signalWithPermit`
- **ADR:** ADR 0031 as modified by ADR 0049
- **Tests:** `test_DelegateBySigWorksButReceiptHasNoPermitEntrypoint`,
  `test_SignalWithPermitNeedsNoApprovalAndToleratesPreConsumedSignature`,
  `test_SignalWithPermitRollsBackPermitWhenStrategyMutationFails`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0049 development candidate (2026-08-24)
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
  `ISignalGBXAllocation` interface (the file was already deleted in the listed source state).
  `SignalGBX.balanceOf(account)` **is** the account's aggregate signal. Because mint and burn are atomically coupled to
  the matching Bribe virtual-balance change (FACT-SGBX-01), there is no reachable successful state in which a minted
  raw unit is idle or a burned raw unit leaves signal behind.
- **Source:** `packages/contracts/src/core/SignalGBX.sol:75-132`; `packages/contracts/src/core/Resonance.sol:362-364`
- **Functions/state:** `SignalGBX.balanceOf`, `Bribe.signalWeightOf`
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
- **Functions/state:** `SignalGBX.totalSupply`, `getPastTotalSupply`, `Bribe.totalSignalWeight`
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
- **Technical formulation:** `Resonance.addSignalFor` and `removeSignalFor` carry the `onlySignalGBX` modifier, which
  reverts `UnauthorizedSignalSource` unless `msg.sender == address(signalGBX)`. Resonance exposes no move-only hook;
  `SignalGBX.moveSignal` composes the retained hooks.
- **Source:** `packages/contracts/src/core/Resonance.sol`; `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `onlySignalGBX`, `addSignalFor`, `removeSignalFor`, `moveSignal`
- **ADR:** ADR 0030 (supersedes ADR 0019's direct Resonance entry points), ADR 0048
- **Tests:** `test_OnlySignalGBXCanMutateAnotherAccountsSignal`, `test_AnAttackerCannotRemoveAnotherAccountsSignal`,
  `test_HostileSignalInputsCannotCreateOrDestroyWeight`, `test_RemovedResonanceMoveHookIsAbsentFromRuntime`
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
- **ADR:** ADR 0019, **ADR 0031**, ADR 0048
- **Tests:** `test_SignalAtomicallyCustodiesMintsVotesAndMirrorsThePairedBribe`,
  `test_WithdrawSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying`,
  `test_MoveSignalComposesRemoveAndAddWhilePreservingCustodySupplyVotesAndAggregateSignal`,
  `test_MoveSignalRejectsZeroSameStrategyAndInsufficientSource`,
  `test_MoveSignalDestinationFailureRollsBackSourceRemoval`,
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

  | Level                    | Canonical owner | Accessor                  |
  | ------------------------ | --------------- | ------------------------- |
  | Account aggregate        | SignalGBX       | `balanceOf(account)`      |
  | Account × Strategy       | Bribe(s)        | `signalWeightOf(account)` |
  | Strategy total           | Bribe(s)        | `totalSignalWeight()`     |
  | Active total (live only) | Resonance       | `totalSignalWeight()`     |

  `Resonance` reads each Strategy's total from its Bribe rather than duplicating that ledger. ADR 0031 removed the
  separate `allocatedBalance` ledger because it would always be identical to `SignalGBX.balanceOf` (FACT-SGBX-05).

- **Source:** `packages/contracts/src/core/Resonance.sol:66`, `:355-375`
- **Functions/state:** `SignalGBX.balanceOf`, `Bribe.signalWeightOf`, `Bribe.totalSignalWeight`,
  `Resonance.totalSignalWeight`
- **ADR:** ADR 0030, **ADR 0031**
- **Tests:** `invariant_BribeBalancesMirrorAccountSignals`, `invariant_BribeSupplyMirrorsStrategyWeight`,
  `invariant_StrategyWeightsSumToTheGlobalTotal`, `invariant_AccountWeightsSumToAllRecordedStrategyWeight`,
  `invariant_EveryReceiptUnitIsAssigned`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Accounting identity (ADR 0031):** across live **and** killed Strategies,
  `SignalGBX.balanceOf(a) = Σ_s Bribe(s).signalWeightOf(a)` and
  `SignalGBX.totalSupply() = Σ_s Bribe(s).totalSignalWeight()`, with
  `GBX.balanceOf(SignalGBX) ≥ SignalGBX.totalSupply()`.

### FACT-SIG-04 — Every signal change checkpoints elapsed revenue before weights move

- **Plain-English claim:** Changing your signal never retroactively redirects revenue that accrued under the old
  weights.
- **Technical formulation:** `addSignalFor` and `removeSignalFor` call `_updateRevenue(strategy)` before their respective
  `totalSignalWeight` and Bribe mutations. `SignalGBX.moveSignal` calls source removal and then destination addition in
  one transaction. The source is checkpointed before removal; the destination is checkpointed before addition. No
  time elapses between calls, so both old positions receive the stored pre-move index and the moved amount earns only
  later flow. `_updateRevenue` advances `revenuePerSignalStored` and `lastUpdateTime`, then settles
  `strategyRevenue[strategy]`.
- **Source:** `packages/contracts/src/core/Resonance.sol`; `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `_updateRevenue`, `revenuePerSignal`, `earnedRevenue`
- **ADR:** ADR 0029, ADR 0046, ADR 0048
- **Tests:** `test_FlashSignalWeightCannotRedirectANewNotification`,
  `test_StrategyAddedAfterAccrualCannotClaimHistoricRevenue` (named in FINDINGS.md as the A-11 regression),
  `test_NewStrategyWeightReceivesOnlyPostEntryRevenue`,
  `test_ComposedMoveCheckpointsBothStrategiesBeforeChangingTheirWeights`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** This prevents _same-transaction_ capture only. A signal held over real elapsed time legitimately earns
  that interval's flow. There is no epoch, cooldown, or anti-churn guarantee.

### FACT-SIG-05 — A newly added Strategy starts at the current index and cannot claim historical revenue

- **Plain-English claim:** A Strategy created today cannot claim revenue that accrued before it existed.
- **Technical formulation:** `addStrategy` sets
  `strategyRevenuePerSignalPaid[strategy] = revenueData.revenuePerSignalStored`.
- **Source:** `packages/contracts/src/core/Resonance.sol:278-307`
- **Functions/state:** `addStrategy`, `strategyRevenuePerSignalPaid`, `revenueData`
- **ADR:** ADR 0029, ADR 0046
- **Tests:** `test_StrategyAddedAfterAccrualCannotClaimHistoricRevenue`,
  `test_NewStrategyWeightReceivesOnlyPostEntryRevenue`
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
  `addStrategy`, `killStrategy`, `addBribeRewardToken`, and `setBribeBps`, plus inherited `transferOwnership` and
  `renounceOwnership`.
  `setResonanceRouter` is owner-gated but single-use (`ResonanceRouterAlreadySet`). `SignalGBX`, `StrategyFactory`,
  and `BribeFactory` are `Ownable` but retain no owner-callable function after `setResonance` is consumed. `Mine`,
  `Fund`, `Strategy`, and `BribeRouter` are not `Ownable`. `Bribe.addRewardToken` is gated on
  the immutable `resonance` address, not on an owner.
- **Source:** `packages/contracts/src/core/Resonance.sol`, `SignalGBX.sol`, `Mine.sol`, `Fund.sol`, `Bribe.sol`
- **Functions/state:** `owner`, `addStrategy`, `killStrategy`, `addBribeRewardToken`, `setBribeBps`,
  `setResonanceRouter`
- **ADR:** ADR 0034, ADR 0033 (ownerless Mine), ADR 0017 (ownerless Fund)
- **Tests:** `test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`,
  `test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal`,
  `test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe`,
  `test_DefaultBoundsAndOwnerAuthorization`,
  `test_ResonanceRouterBindingIsOwnerOnlyValidatedAndSingleUse`,
  `test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority`, `test_FundHasNoAdministrativeSurfaceLeft`
- **Status:** `implemented`
- **Commit:** `dc67d7c`

### FACT-GOV-03 — The owner's only economic reach is the bounded prospective Bribe share

- **Plain-English claim:** Even a hostile owner cannot drain the treasury, mint tokens, change mining rates, or
  redirect a payment. It can change only the prospective automatic Bribe share, within 0–20%.
- **Technical formulation:** Mining parameters are fixed and `Mine` has no owner. `Resonance.setBribeBps` is bounded
  by `MAX_BRIBE_BPS = 2_000` and applies only when a later payment is classified; Fund receives the complement and no
  prior purchase, Fund balance, buffered Bribe share, or active reward stream is repriced. `GBX.setMinter` is
  single-use with `minterLocked`. `Fund` exposes only `redeem` and `burnGBX`. `Strategy` auction parameters are
  immutable and bounded at construction.
- **Source:** `Mine.sol`, `Resonance.sol`, `GBX.sol`, `Fund.sol`, `Strategy.sol`
- **ADR:** ADR 0033, ADR 0036, ADR 0047, ADR 0017, ADR 0050
- **Tests:** `test_RedemptionIsTheOnlyWayAssetsCanEverLeaveFund`, `test_FundHasNoAdministrativeSurfaceLeft`,
  `test_DefaultBoundsAndOwnerAuthorization`, `test_ChangingPolicyCannotRepriceAnOldBufferedShareOrInterruptItsStream`
- **Status:** `implemented`
- **Commit:** `uncommitted`

### FACT-GOV-04 — The final live Strategy cannot be killed

- **Plain-English claim:** There is always at least one place to signal, enforced in code.
- **Technical formulation:** `killStrategy` reverts `FinalLiveStrategy(strategy)` when `liveStrategyCount == 1`. A
  replacement must be added first.
- **Source:** `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `killStrategy`, `liveStrategyCount`, `isStrategyLive`
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
  executor, and removal of the temporary owner) and **G-03** (the integration itself). Reciprocal binding checks and
  ADR 0045's post-deployment Mine/Router verification reject a crossed graph but cannot detect a malicious lookalike
  that returns the expected identities, and the protocol has no upgrade, successor, or migration authority to repair
  a wrong value after exposure.

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
- **Technical formulation:** `REWARD_DURATION = 7 days = 604800` seconds. Resonance stores one scalar `revenueData`
  record containing only `periodFinish`, `revenueRate`, `lastUpdateTime`, and `revenuePerSignalStored` for its immutable USDG
  token; it has no reward-token registry or token-keyed schedule. Allocation follows a Synthetix-shaped
  `revenuePerSignal` index over `totalSignalWeight`.
- **Source:** `packages/contracts/src/core/Resonance.sol:28-64`, `:337-408`
- **Functions/state:** `REWARD_DURATION`, `revenueData`, `totalSignalWeight`
- **ADR:** ADR 0029, ADR 0046, ADR 0047
- **Tests:** `test_NotificationStartsOneScalarScheduleAndKeepsTheRateFloorAsSurplus`,
  `test_RevenueSplitsByCurrentStrategyWeight`,
  `test_RewardViewsExposeTheSingleUSDGSchedule`, `invariant_RevenueStreamStateIsCoherent`,
  `test_RemovedMultiTokenResonanceSelectorsAreAbsentFromRuntime`
- **Status:** `implemented`
- **Commit:** `uncommitted`

### FACT-RES-02 — The USDG stream uses the ordinary Synthetix whole-unit rate

- **Plain-English claim:** Resonance releases a constant raw-unit rate for seven days. Division dust is deliberately
  left unallocated instead of tracked in another schedule field.
- **Technical formulation:** On restart with `S = amount + remaining`, `revenueRate = floor(S / REWARD_DURATION)`,
  `periodFinish = t0 + REWARD_DURATION`, and elapsed emission is `(to - from) * revenueRate`. The difference
  `S - revenueRate * REWARD_DURATION` remains USDG surplus.
- **Source:** `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `revenueData`, `revenuePerSignal`, `remainingRevenue`
- **ADR:** ADR 0047 (supersedes ADR 0029's exact raw schedule)
- **Tests:** `test_NotificationStartsOneScalarScheduleAndKeepsTheRateFloorAsSurplus`,
  `test_OrdinaryRateFloorLeavesTheRawRemainderAsSurplus`,
  `test_OrdinaryRateFloorMatchesHistoricalAndLeavesSurplus`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Worked example:** For `S = 1_000_000` raw USDG, `revenueRate = floor(1_000_000 / 604_800) = 1` raw unit per
  second. The stream schedules `604_800` raw units and leaves `395_200` raw units unallocated.

### FACT-RES-03 — A qualifying notification uses standard leftover rollover

- **Plain-English claim:** New revenue does not just extend the old schedule. It is combined with whatever was left
  and restarted as a fresh seven-day stream.
- **Technical formulation:** `notifyRevenue(amount)` requires `amount >= remainingRevenue()` (else
  `RevenueBelowRemaining`),
  checkpoints elapsed emission, pulls `amount` with `SafeERC20`, sets
  `revenueRate = floor((amount + remaining) / REWARD_DURATION)`, and resets the finish to seven days from now.
- **Source:** `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `notifyRevenue`, `remainingRevenue`, `revenueData`
- **ADR:** ADR 0047
- **Tests:** `test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft`,
  `test_RouterBuffersUntilItsBalanceReachesTheActiveAmountLeft`,
  `test_DivisibleStreamsMatchHistoricalRateIndexEarnedRestartAndClaimAccounting`,
  `test_NotifyRevenueIsRouterOnlyAndRejectsZero`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** A restart can raise **or lower** the instantaneous rate and always moves the finish to `now + 7 days`.
  Because `amount >= remainingRevenue()`, forcing an early reset requires economically matching the scheduled
  remainder. This
  permissionless match-cost gate is a small deliberate deviation from an owner-only Synthetix distributor; it makes
  slowing costly but does not guarantee that every accepted restart preserves or raises the instantaneous rate.

### FACT-RES-04 — ResonanceRouter buffers below the greater of one duration and the active amount left

- **Plain-English claim:** Revenue waits in a router until someone calls; a sub-threshold attempt leaves it there, while
  a qualifying attempt forwards the complete balance.
- **Technical formulation:** `route()` reverts `NoRevenue` on a zero balance. Otherwise it reads
  `minimum = max(Resonance.REWARD_DURATION(), Resonance.remainingRevenue())`; if `pending < minimum` it emits
  `RevenueHeld` and returns
  `0` without transferring. Otherwise it approves Resonance for, and notifies, the **complete** pending balance.
  Under ADR 0047's standard-token assumption it does not compare post-call token balances or clear a residual
  allowance.
- **Source:** `packages/contracts/src/core/ResonanceRouter.sol`
- **Functions/state:** `route`, `USDG.balanceOf(ResonanceRouter)`, `RevenueHeld`
- **ADR:** ADR 0029 and ADR 0047; Mine call-site behavior superseded by ADR 0044
- **Tests:** `test_RouterBuffersUntilAtLeastOneRawUnitPerSecondCanBeScheduled`,
  `test_RouterBuffersUntilItsBalanceReachesTheActiveAmountLeft`,
  `test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies`,
  `test_RouteIsPermissionlessAndForwardsTheCompleteBalance`, `test_RouteRejectsAnEmptyRouter`,
  `invariant_RevenueRouterRetentionIsFullyVisible`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** `REWARD_DURATION` raw units is the absolute minimum, so a smaller balance never qualifies without another
  deposit. A qualifying balance still requires an external caller; with no role, bounty, or guaranteed caller,
  revenue may wait indefinitely. Mine is isolated because it never calls `route`. Interfaces must distinguish
  "deposited in Router" from "forwarded into the active stream". A direct
  Router donation joins the next complete-balance notification rather than creating a separately accounted claim.

### FACT-RES-05 — The revenue-per-signal index uses 1e36 precision because USDG has 6 decimals and sGBX has 18

- **Plain-English claim:** Because the revenue token is tracked to six decimal places and the signal token to
  eighteen, the internal accounting uses very high precision so tiny allocations are not rounded to nothing.
- **Technical formulation:** `REWARD_PRECISION = 1e36`.
  `revenuePerSignal += floor(emitted * 1e36 / totalSignalWeight)`, and
  `earnedRevenue = strategyRevenue + floor(activeBalance * (revenuePerSignal - paid) / 1e36)`.
- **Source:** `packages/contracts/src/core/Resonance.sol:38`, `:343-361`
- **Functions/state:** `REWARD_PRECISION`, `revenuePerSignal`, `earnedRevenue`
- **ADR:** ADR 0029, ADR 0047
- **Tests:** `test_OneE36IndexPreservesOneRawRewardAcrossEighteenDecimalSignal`,
  `test_RevenueSplitsByCurrentStrategyWeight`, `test_MoveCheckpointsBothStrategiesBeforeChangingTheirWeights`,
  `invariant_RevenueIndexIsMonotonic`
- **Status:** `implemented`
- **Commit:** `uncommitted`
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
  3. `revenuePerSignal` returns early when `totalSignalWeight == 0`, so stream time elapsing at zero active signal
     weight advances `lastUpdateTime` without ever crediting any Strategy.
     Direct USDG transfers to Resonance are never scheduled because scheduling occurs only inside `notifyRevenue`.
     The solvency relation is an inequality:
     `USDG.balanceOf(Resonance) = remainingRevenue() + sum_strategies earnedRevenue(strategy) + surplus`,
     `surplus >= 0`.
- **Source:** `packages/contracts/src/core/Resonance.sol:337-408`; `docs/SECURITY-INVARIANTS.md`
- **Functions/state:** `revenuePerSignal`, `earnedRevenue`, `_updateRevenue`
- **ADR:** ADR 0029 and ADR 0047 (finding **A-02**, **A-09** Resonance half)
- **Tests:** `test_ZeroSignalElapsedRevenueBecomesSurplusAndCannotBeCapturedLater`,
  `test_RevenueWithoutSignalsBecomesUnallocatedResonanceSurplus`,
  `test_USDGDonatedDirectlyToResonanceRemainsUnscheduledSurplus`, `test_DirectDonationIsNotScheduled`,
  `invariant_ResonanceIsSolventAgainstClaimableRevenue`, `invariant_ResonanceScheduledAndEarnedRevenueIsSolvent`,
  `testFuzz_AccruedAndScheduledRevenueNeverExceedsTheHeldBalance`,
  `testFuzz_DistributionNeverOverpaysAndFractionalDustRemainsHeld`
- **Status:** `accepted-limitation`
- **Commit:** `uncommitted`
- **Caveats:** **No exact conservation identity and no lifetime dust bound is claimed for Resonance.** There is no
  synchronization, sweep, rescue, or later-allocation path. Bribe now accepts the same ordinary rate/index/account
  floors rather than carrying them exactly (FACT-BRIBE-05).

### FACT-RES-07 — Distribution is permissionless and always pays the entitled Strategy

- **Plain-English claim:** Anyone can push a Strategy's accrued revenue to it; the money can only go to that Strategy.
- **Technical formulation:** `distributeRevenue(strategy)` is public and non-reentrant. It checkpoints the Strategy,
  then zeroes
  `strategyRevenue[strategy]` and calls `usdg.safeTransfer(strategy, amount)`. It does not snapshot sender or receiver
  balances; registered USDG is assumed to follow standard ERC-20 transfer semantics.
- **Source:** `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `distributeRevenue`, `strategyRevenue`
- **ADR:** ADR 0029, ADR 0046, ADR 0047
- **Tests:** `test_DistributionIsPermissionlessButAlwaysPaysTheStrategy`, `test_DistributingTwicePaysNothingTheSecondTime`,
  `test_BlockedStrategyDoesNotBrickUnrelatedDistributionOrItsOwnLaterRetry`
- **Status:** `implemented`
- **Commit:** `uncommitted`

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
- **Functions/state:** `addStrategy`, `isStrategyRegistered`, `isStrategyLive`, `bribeFor`, `bribeRouterFor`,
  `Strategy.paymentToken`
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
  `Resonance.distributeRevenue(address(this))`, reads `revenueAmount = usdg.balanceOf(this)` (reverts `EmptyRevenue`
  at zero), computes `paymentAmount = currentPrice()`, collects that many `paymentToken` units, settles them, and
  transfers the snapshotted **entire** USDG balance to `revenueReceiver` with `SafeERC20`. The path assumes standard
  token semantics and does not compare the buyer, Strategy, Fund, Router, or receiver balance deltas.
- **Source:** `packages/contracts/src/core/Strategy.sol:144-176`
- **Functions/state:** `buy`, `usdg`, `currentPrice`, `epochId`, `epochStartedAt`, `initialPrice`
- **ADR:** ADR 0021, ADR 0029, ADR 0047
- **Tests:** `test_BuyAtomicallyIncludesRevenueReleasedThroughTheCurrentTimestamp`,
  `test_CompletePaymentSplitsInlineAndAdvancesTheEpoch`, `test_BuyRejectsAnEmptyStrategy`, `test_BuyRejectsAStaleEpochId`,
  `test_BuyRejectsAPassedDeadline`, `test_BuyRejectsAPaymentAboveTheBuyersLimit`, `test_BuyRejectsAZeroRevenueReceiver`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** `revenueReceiver` is buyer-chosen. Setting it to Resonance creates unscheduled surplus
  (`test_RevenueReceiverEqualToResonanceCreatesUnscheduledSurplus`); setting it to the Strategy transfers to self,
  advances the epoch, and leaves the revenue available for the next epoch
  (`test_RevenueReceiverEqualToStrategyLeavesTheRevenueForTheNextEpoch`).

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
  `FinalLiveStrategy` when `liveStrategyCount == 1`, then sets `isStrategyLive[strategy] = false`, decrements
  `liveStrategyCount`, and subtracts the Strategy Bribe's `totalSignalWeight()` from Resonance's
  `totalSignalWeight`. The revenue checkpoint runs first, so accrued whole USDG units are preserved in
  `strategyRevenue`. `earnedRevenue` returns
  `activeBalance = 0` for a dead Strategy, so no further accrual occurs. `addSignalFor` reverts `StrategyAlreadyDead`;
  `removeSignalFor` skips the `totalSignalWeight` decrement for a dead Strategy so the weight is not removed twice.
- **Source:** `packages/contracts/src/core/Resonance.sol:66-67`, `:290-292`, `:303-313`
- **Functions/state:** `killStrategy`, `isStrategyLive`, `liveStrategyCount`, `FinalLiveStrategy`,
  `totalSignalWeight`, `earnedRevenue`
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
  drives `totalSignalWeight` to zero. A composed move from a dead Strategy first removes without decrementing the
  already excluded weight, then adds the amount **back** into `totalSignalWeight` at the live destination.

### FACT-STR-06 — A killed Strategy's Bribe becomes a closed reward pool, and a final exit can permanently abandon rewards

- **Plain-English claim:** After a Strategy is retired, its reward pool stays open for whoever is still signaling it,
  but nobody new can join. If the last signaler leaves while rewards remain, those rewards are stranded forever.
- **Technical formulation:** `Bribe` has no kill state. `addSignalWeight` is unreachable for a dead Strategy because
  `Resonance.addSignalFor` rejects it, but incumbent accounts may still claim and withdraw. Reward time follows the
  Synthetix clock even when `totalSignalWeight == 0`; after the final exit, later elapsed rewards advance no index and can
  never be assigned because no new deposit can occur.
- **Source:** `packages/contracts/src/core/Bribe.sol`; `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `removeSignalWeight`, `rewardPerSignal`, `isStrategyLive`
- **ADR:** ADR 0028 as modified by ADR 0047
- **Tests:** `test_KillingAStrategyDoesNotConfiscateStreamingRewards`, killed-Strategy exit coverage in `SignalGBX.t.sol`
- **Status:** `accepted-limitation`
- **Commit:** `uncommitted`
- **Caveats:** The abandoned amount is **not bounded to dust**. It may include a complete unvested stream plus any
  later notification made at zero supply. There is deliberately no pause, queue, retirement, refund, rescue, sweep,
  or Fund-reclassification path. Interfaces must warn the final signaler before they exit.

---

## H. Auction-payment settlement and acquired assets

### FACT-SETL-01 — Every auction payment is classified at a bounded global rate, defaulting to 90% Fund / 10% Bribe

- **Plain-English claim:** Of everything a buyer pays, a governed share becomes a reward for the people signaling that
  Strategy and the remainder becomes treasury backing. The share starts at 10% and can never exceed 20%, so at least
  80% of everything acquired always reaches the treasury.
- **Technical formulation:** `Resonance` holds the single global rate: `DEFAULT_BRIBE_BPS = 1_000`,
  `MAX_BRIBE_BPS = 2_000`, `bribeBps = DEFAULT_BRIBE_BPS`, mutated only by `onlyOwner setBribeBps(newBribeBps)` which
  reverts `BribeBpsAboveMaximum` above the ceiling. `Strategy.buy` snapshots the rate **before any payment-token
  interaction**, so a token callback cannot alter the split of the fill it belongs to:

  ```text
  appliedBribeBps = Resonance.bribeBps()
  pull payment from buyer
  bribeAmount     = ⌊paymentAmount · appliedBribeBps / 10000⌋
  fundAmount      = paymentAmount − bribeAmount
  transfer fundAmount directly to Fund
  transfer nonzero bribeAmount to paired BribeRouter
  ```

  A rate change is prospective only: it cannot alter an earlier purchase, notified or claimable reward, or prior Fund
  balance. There is no per-Strategy override, no BribeRouter-local setter, no team fee, and no caller-selected
  destination.

- **Source:** `packages/contracts/src/core/Resonance.sol` (`DEFAULT_BRIBE_BPS`, `MAX_BRIBE_BPS`, `setBribeBps`);
  `packages/contracts/src/core/Strategy.sol` (`buy`, `_settlePayment`)
- **Functions/state:** `bribeBps`, `setBribeBps`, `buy`, `_settlePayment`
- **ADR:** ADR 0036's bounded rate as simplified by ADR 0047
- **Caveats:** Rate-setting transaction order is economically observable — a purchase settled before a change uses the
  old rate, one after it uses the new rate. The external system's delay and execution rules remain an open gate.
- **Tests:** `test_CompletePaymentSplitsInlineAndAdvancesTheEpoch`,
  `testFuzz_CompletePaymentIsConservedByTheInlineSplit`, `test_DefaultBoundsAndOwnerAuthorization`,
  `test_FourCompletedAuctionsUseTenZeroFiveAndTwentyPercentProspectively`,
  `test_PaymentTokenCallbackCannotRetroactivelyChangeTheCurrentPaymentsSnapshot`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** This **replaces** the previous 100%-to-Fund rule. Any document, ABI consumer, or interface still
  asserting "no auction proceeds fund Bribes" describes superseded behavior. Note the split applies to the **acquired
  payment asset**, not to USDG: Resonance still transfers 100% of a Strategy's earned USDG to that Strategy
  (FACT-RES-07).

### FACT-SETL-01b — Each purchase floors independently; no split carry crosses purchases

- **Plain-English claim:** Each purchase is intentionally classified on its own. Splitting a payment can change the
  raw-unit result, avoiding a persistent carry ledger at the cost of partition-dependent dust.
- **Technical formulation:** For each payment `a_i` at its snapshotted rate `r_i`:

  ```text
  bribe_i = ⌊a_i · r_i / BPS⌋
  fund_i  = a_i − bribe_i
  ```

  The implementation uses `Math.mulDiv`; it stores no remainder between calls.

- **Source:** `packages/contracts/src/core/Strategy.sol`; `docs/adr/0047-synthetix-shaped-rewards-and-strategy-settlement.md`
- **Functions/state:** `_settlePayment`
- **ADR:** ADR 0047 (supersedes ADR 0036's cumulative carry)
- **Tests:** `test_EachPurchaseFloorsItsOwnBribeShareWithoutCarry`,
  `test_ADustPaymentFloorsTheBribeShareAndGoesDirectlyToFund`,
  `testFuzz_OnePurchaseUsesTheCurrentRateAndFloorsItsShare`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Worked example:** At 10%, ten separate one-raw-unit payments produce **Fund 10, Bribe 0**; one ten-unit payment
  produces **Fund 9, Bribe 1**. This difference is accepted explicitly.

### FACT-SETL-02 — Fund settlement is direct; Bribe notification remains buffered

- **Plain-English claim:** A successful purchase has already paid Fund. Its Bribe share may wait safely in a small
  Router until anyone can distribute a qualifying balance.
- **Technical formulation:** Strategy transfers `fundAmount` directly to Fund and `bribeAmount` to BribeRouter.
  `BribeRouter.route()` reads its complete balance and returns zero below
  `max(REWARD_DURATION, remainingReward(token))`; otherwise it approves the paired Bribe, notifies the complete
  balance, and emits `RewardRouted`. A failed
  Fund transfer reverts the purchase; a failed later Bribe notification leaves the Router balance in place. The
  Router does not keep Fund/Bribe liabilities, split carry, a caller role, or a post-notification allowance cleanup.
- **Source:** `packages/contracts/src/core/Strategy.sol`; `packages/contracts/src/core/BribeRouter.sol`
- **Functions/state:** `_settlePayment`, `route`
- **ADR:** ADR 0047
- **Tests:** `test_CompletePaymentSplitsInlineAndAdvancesTheEpoch`,
  `test_DistributeAccumulatesUntilTheBalanceCanSustainANonzeroRate`,
  `test_DistributeWaitsUntilTheCompleteBalanceMeetsTheActiveStreamLeft`,
  `test_DistributeCanRetryAfterTheBribeTokenPullFails`,
  `test_RemovedRouterLiabilityAndCarrySelectorsAreAbsentFromRuntime`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** A permanently broken or blocklisting payment token can make purchases or Bribe distribution unusable.
  Destinations cannot be changed and there is no recovery path.

### FACT-SETL-03 — A GBX-priced Strategy does not burn during settlement; burning is a separate permissionless step

- **Plain-English claim:** If a Strategy buys GBX, that GBX first lands in the Fund. Anyone can then burn it, but it
  is not burned automatically.
- **Technical formulation:** `Strategy` sends the Fund complement directly to Fund and the Bribe share to BribeRouter.
  `Fund.burnGBX(amount)` is public and calls `gbx.burn(amount)` on the Fund's own balance.
- **Source:** `packages/contracts/src/core/Fund.sol:64-70`
- **Functions/state:** `burnGBX`, `GBX.balanceOf(Fund)`
- **ADR:** ADR 0021 as superseded in settlement shape by ADR 0047
- **Tests:** `testFuzz_GBXPaymentCanBeBurnedPermissionlesslyAfterInlineFundDelivery`,
  `test_GBXPaymentReachesFundInlineAndRemainsPermissionlesslyBurnable`,
  `test_BurnGBXIsPermissionlessAndBurnsFundsOwnBalance`, `test_BurnGBXCannotExceedTheFundBalance`,
  `test_TheGBXPaymentPathIsReachableFromTheCampaign`, `invariant_GBXPaymentsNeverRemainInStrategy`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** **GBX sitting unburned in Fund inflates the redemption denominator**, because `Fund.redeem` snapshots
  `gbx.totalSupply()`, which includes Fund-held GBX. Redeemers should settle and burn pending Fund GBX first.

---

## I. Bribes and BribeRouters

### FACT-BRIBE-01 — Each Bribe registers at most sixteen append-only reward tokens

- **Plain-English claim:** A Strategy's reward pool supports up to sixteen different reward tokens. Tokens can be added
  but never removed, and the limit is hard-coded.
- **Technical formulation:** `MAX_REWARD_TOKENS = 16`. `addRewardToken` is `onlyResonance`, rejects zero/code-less
  addresses, rejects duplicates (`RewardAlreadyAdded`), and reverts `RewardTokenLimitReached` at sixteen. The Strategy's
  payment token occupies the first slot automatically (FACT-STR-01). Governance adds the rest through
  `Resonance.addBribeRewardToken`, which additionally rejects `signalGBX`.
- **Source:** `packages/contracts/src/core/Bribe.sol`; `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `MAX_REWARD_TOKENS`, `addRewardToken`, `isRewardToken`, `rewardTokens`
- **ADR:** ADR 0019 as modified by ADR 0048
- **Tests:** `test_RewardTokenCountIsPermanentlyCappedAtSixteen`, `test_TheOwnerCannotExceedTheRewardTokenCap`,
  `test_RewardTokensAreAppendOnlyAndListedInInsertionOrder`,
  `test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe`,
  `test_NonTransferableSignalGBXCannotBeAStrategyPaymentToken`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** The cap is what keeps every mandatory signal-entry, signal-exit, and settlement loop bounded (finding
  **A-08**). The higher bound accepts more worst-case gas for fifteen independent incentives after the automatic
  payment token. Measured maxima include signal addition 491,494, withdrawal 1,129,059, all-token claim 1,471,439,
  and a composed move with sixteen active streams on both Bribes 1,890,938 gas.

### FACT-BRIBE-02 — Bribes have two funding sources: the bounded automatic acquisition share and open external funding

- **Plain-English claim:** A Strategy's reward pool is fed by the global automatic share active when each payment is
  classified — 10% by default and adjustable prospectively from 0% through 20% — and separately by anyone who chooses
  to add rewards on top.
- **Technical formulation:** `notifyReward(rewardToken, amount)` is public. It requires a registered token,
  a qualifying amount, and remaining lifetime-notification capacity, then pulls with `SafeERC20`. Two routes use it:
  1. **Automatic** — `BribeRouter.route()` notifies its complete buffered balance in the Strategy payment token,
     which `addStrategy` registered as reward token 1 of 16 at creation (FACT-SETL-01).
  2. **External** — any account may fund any registered reward token to attract signal toward that Strategy.
- **Source:** `packages/contracts/src/core/Bribe.sol`; `packages/contracts/src/core/BribeRouter.sol`
- **Functions/state:** `notifyReward`, `lifetimeRewardNotified`, `BribeRouter.route`
- **ADR:** ADR 0019, ADR 0036, ADR 0037, ADR 0047
- **Tests:** `test_NotifyRejectsUnregisteredAndBelowDurationAmounts`,
  `test_ZeroAutomaticShareStillAllowsIndependentlyFundedBribeRewards`,
  `test_DistributeIncludesTheCompleteDirectlyDonatedBalance`,
  `test_RewardsDonatedDirectlyToABribeAreNeverScheduled`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** ADR 0032 superseded ADR 0021's rule that auction proceeds never fund Bribes by introducing a fixed 10%
  share; ADR 0036 then replaced that fixed policy with the current 0–20% prospective range and 10% default. A direct
  donation to Bribe is not scheduled, while a compatible payment-token donation to BribeRouter joins its next
  complete-balance notification. Every accepted notification consumes the same monotonic lifetime capacity.

### FACT-BRIBE-03 — A qualifying top-up uses ordinary Synthetix leftover rollover

- **Plain-English claim:** A large enough top-up combines with what remains and restarts one fresh seven-day stream.
  Smaller notifications cannot reset or slow the active schedule.
- **Technical formulation:** Each token has one four-field `RewardData` record: `periodFinish`, `rewardRate`,
  `lastUpdateTime`, and `rewardPerSignalStored`. For one token, `remaining = remainingReward(token)`. A notification
  must satisfy
  `amount >= REWARD_DURATION` and `amount >= remaining`. After checkpointing the old stream and pulling `amount`,
  Bribe writes `rewardRate = floor((amount + remaining) / REWARD_DURATION)`, `lastUpdateTime = now`, and
  `periodFinish = now + REWARD_DURATION`. There is no queued successor or front-loaded remainder field.
- **Source:** `packages/contracts/src/core/Bribe.sol`
- **Functions/state:** `notifyReward`, `remainingReward`, `rewardData`
- **ADR:** ADR 0047
- **Tests:** `test_ActiveTopUpBelowTheAmountLeftRevertsWithoutChangingTheStream`,
  `test_ActiveTopUpEqualToTheAmountLeftIsAccepted`,
  `test_ActiveTopUpUsesStandardLeftoverRolloverAndRestartsSevenDays`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** A qualifying restart may change the instantaneous rate and always resets the finish to seven days from
  the notification. Automatic Strategy-payment rewards wait in BribeRouter until its balance meets both gates;
  independently funded callers may notify Bribe directly under the same gates.

### FACT-BRIBE-04 — Bribe reward time continues while signal supply is zero

- **Plain-English claim:** If nobody is signaling a Strategy, the seven-day clock keeps running. Rewards released
  during that interval remain unclaimable surplus rather than waiting for a later signaler.
- **Technical formulation:** `_lastApplicableRewardTime` continues toward `periodFinish`. When
  `totalSignalWeight == 0`, `rewardPerSignal` returns the stored index; the next checkpoint advances `lastUpdateTime`
  without allocating the
  elapsed reward. Bribe has no pause timestamp, queue, or resume operation.
- **Source:** `packages/contracts/src/core/Bribe.sol`
- **Functions/state:** `rewardPerSignal`, `_updateReward`, `_lastApplicableRewardTime`
- **ADR:** ADR 0047
- **Tests:** `test_ElapsedRewardsAtZeroSupplyRemainUnclaimableSurplus`,
  `test_LaterSignalerCannotReceivePreEntryRoundedReward`, `test_KilledStrategySignalCanExitAndCannotEarnAfterExit`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** After a Strategy is killed, no new signal can enter. If its final signal exits, all later stream time is
  therefore permanently unclaimable (FACT-STR-06).

### FACT-BRIBE-05 — Rate, index, and account floors remain unallocated Bribe surplus

- **Plain-English claim:** High precision keeps low-decimal rewards useful, but the contract deliberately does not
  carry every fractional unit or send it to Fund.
- **Technical formulation:** `REWARD_PRECISION = 1e36`.
  `rewardPerSignal += floor(elapsed * rewardRate * 1e36 / totalSignalWeight)` and
  `earned += floor(signalWeight * indexDelta / 1e36)`. The notification-rate remainder, global-index remainder, and
  account remainder stay as unallocated token custody. `addSignalWeight` and `removeSignalWeight` checkpoint the old
  weight and total weight before mutation, so a later signaler cannot receive pre-entry elapsed rewards and remaining
  signalers do not receive a departing account's sub-token floor. No carry or Fund reward-liability mappings exist.
- **Source:** `packages/contracts/src/core/Bribe.sol`
- **Functions/state:** `REWARD_PRECISION`, `rewardPerSignal`, `earned`, `_updateReward`
- **ADR:** ADR 0037 as simplified by ADR 0047
- **Tests:** `test_SevenDayRateFloorsAndLeavesTheOrdinaryRemainderAsSurplus`,
  `test_LaterSignalerCannotReceivePreEntryRoundedReward`,
  `test_RemainingSignalerCannotReceivePreExitRoundedReward`, `test_FullExitSubTokenFloorIsNotReallocated`,
  `testFuzz_HighPrecisionFloorsWithoutCreatingRewards`, `invariant_BribeScheduleStateIsCoherent`,
  `invariant_BribesAreSolventAgainstAccruedRewards`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** There is no exact conservation identity, Fund classification, sweep, or later-allocation path for this
  surplus. The lifetime-notification cap remains
  `floor(type(uint256).max / REWARD_PRECISION)` and is checked before checkpointing or transfer.

### FACT-BRIBE-06 — Bribe exposes an all-token claim and one independent scalar-token claim

- **Plain-English claim:** The convenience call claims every registered reward. If one token is broken, callers can
  instead claim another token by itself.
- **Technical formulation:** `claimRewards(account)` checkpoints and attempts every registered token atomically.
  `claimReward(account, token)` checkpoints and pays only one registered token. Both always pay `account`, never
  `msg.sender`. There is no caller-selected batch overload in core.
- **Source:** `packages/contracts/src/core/Bribe.sol`
- **Functions/state:** `claimRewards`, `claimReward`, `_claim`
- **ADR:** ADR 0019 as simplified by ADR 0047
- **Tests:** `test_AllTokenClaimPaysEachRegisteredRewardToTheEntitledAccount`,
  `test_AllTokenFailureIsAtomicAndScalarClaimsIsolateABrokenToken`,
  `test_ClaimValidationAndEmptyClaimAreHarmless`, `test_ReentrantRewardPayoutCannotDoubleClaim`
- **Status:** `implemented`
- **Commit:** `uncommitted`

### FACT-BRIBE-07 — Signal removal and unstaking never transfer a reward, payment, or revenue token

- **Plain-English claim:** You can always get your stake back. Leaving a Strategy is pure accounting — it never
  depends on a token transfer that could fail.
- **Technical formulation:** `Bribe.removeSignalWeight` checkpoints every registered reward under the old account and
  total signal weights, then decrements `totalSignalWeight` and `signalWeightOf`. It contains no token transfer.
  `SignalGBX.withdrawSignal`
  then burns the receipt and returns only the account's escrowed GBX. Reward claims remain separate.
- **Source:** `packages/contracts/src/core/Bribe.sol`; `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `removeSignalWeight`, `totalSignalWeight`, `signalWeightOf`
- **ADR:** ADR 0020 (finding **A-04**) as simplified by ADR 0047
- **Tests:** `invariant_EveryActorCanFullyWithdrawSignals`,
  `test_AHostileRewardTokenCannotReenterSignalChanges`,
  `test_ZeroSharePreservesMoveAndWithdrawalFromAKilledStrategy`,
  `test_KilledStrategySignalCanExitAndCannotEarnAfterExit`,
  `test_AFrozenFundCannotBlockKilledStrategyExitOrItsPreservedClaim`
- **Status:** `implemented`
- **Commit:** `uncommitted`

---

## J. The Fund

### FACT-FUND-01 — Fund is an ownerless, registry-free raw-token treasury

- **Plain-English claim:** The Fund holds whatever tokens it receives. It has no administrator, no list of approved
  assets, and no way to move assets except redemption by GBX holders.
- **Technical formulation:** `contract Fund is ReentrancyGuard` — no `Ownable`, no roles. Its only state is the
  immutable `gbx`. The only functions that move value are `burnGBX` (destroys Fund-held GBX) and `redeem`. There is no
  sweep, rescue, recovery, or migration function.
- **Source:** `packages/contracts/src/core/Fund.sol:19-60`
- **Functions/state:** `gbx`, `burnGBX`, `redeem`, `GBX.balanceOf(Fund)`
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

## K. External LP Strategy

### FACT-LP-01 — An external USDG-GBX UniV2 LP token may be an ordinary bootstrap Strategy asset

- **Plain-English claim:** The reviewed fungible token representing an external USDG-GBX Uniswap V2 pool may be one of
  the assets the index buys. It has no special protocol path.
- **Technical formulation:** Bootstrap may call `Resonance.addStrategy(lpToken, ...)` using a reviewed deployment-input
  address. The resulting Strategy applies the same auction, global prospective Fund/Bribe split, signaling, kill, and
  redemption behavior as every other Strategy payment token. No LP address is hard-coded.
- **Source:** `packages/contracts/src/core/Resonance.sol`; `Strategy.sol`; `Fund.sol`; `docs/DEPLOYMENT.md`
- **ADR:** ADR 0050
- **Tests:** ordinary Strategy registration, purchase settlement, and redemption tests
- **Status:** `config-dependent`
- **Commit:** uncommitted ADR 0050 development candidate (2026-08-24)
- **Caveats:** Registration is not a review certificate or liquidity guarantee. The external token, pair, venue, and
  underlying assets retain their independent third-party risks.

### FACT-LP-02 — The core contains no liquidity-specific mechanism

- **Plain-English claim:** The protocol does not create, seed, own, custody, price, rebalance, compound, harvest, or
  swap liquidity.
- **Technical formulation:** There is no canonical liquidity contract or protocol-owned LP position. The external LP
  token is handled only through generic ERC-20 Strategy settlement and Fund custody. The protocol promises neither a
  market price nor available liquidity.
- **Source:** `packages/contracts/src/core`; ADR 0050
- **ADR:** ADR 0050 (supersedes ADRs 0014, 0018, and 0022 and the LiquidityPosition clauses of ADR 0017)
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0050 development candidate (2026-08-24)

---

## L. Immutable bindings and deployment topology

### FACT-BIND-01 — One-time bindings validate reciprocal identity; Mine/Router pairing is a deployment gate

- **Plain-English claim:** Each one-time binding confirms that the contract it is about to trust points back at it. Mine
  constructor arguments are instead cross-checked immediately after deployment and before its permanent GBX binding.
- **Technical formulation:**
  | Binding | Guard | Reciprocal check |
  | ------------------------------------ | ---------------------------------------------------- | ----------------------------------------- |
  | `GBX.setMinter(Mine)` | `msg.sender == minter`, `!minterLocked` | `IMine(newMinter).gbx() == address(this)` |
  | `SignalGBX.setResonance` | `onlyOwner`, `resonance == address(0)` | `Resonance.signalGBX() == address(this)` |
  | `StrategyFactory.setResonance` | `onlyOwner`, `resonance == address(0)` | `Resonance.strategyFactory() == address(this)` |
  | `BribeFactory.setResonance` | `onlyOwner`, `resonance == address(0)` | `Resonance.bribeFactory() == address(this)` |
  | `Resonance.setResonanceRouter` | `onlyOwner`, `resonanceRouter == address(0)` | `Router.resonance() == address(this)` **and** `Router.usdg() == usdg` |
  ADR 0045 separately requires pinned reads proving `Mine.usdg() == USDG`, `Mine.resonanceRouter() == Router`, and
  `Router.usdg() == USDG`; a mismatch invalidates that deployment candidate.
- **Source:** `GBX.sol`; `SignalGBX.sol`; `StrategyFactory.sol`; `BribeFactory.sol`; `Resonance.sol`; `Mine.sol`
- **ADR:** ADR 0030 and ADR 0045 (finding **E-02**)
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
  `Resonance.addStrategy`, `Resonance.killStrategy`, `Resonance.addBribeRewardToken`, `Resonance.setBribeBps`,
  `Resonance.setResonanceRouter` (one-time), `SignalGBX.setResonance` (one-time), `StrategyFactory.setResonance`
  (one-time), `BribeFactory.setResonance` (one-time). The one-time bindings are consumed during deployment, leaving
  the four continuing actions. `Fund` and `Mine` have no owner at all.
- **Source:** `Resonance.sol`; `Mine.sol`; `Fund.sol`
- **ADR:** ADR 0016, ADR 0017, ADR 0033, ADR 0034
- **Tests:** `test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`,
  `test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal`,
  `test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe`, `test_FundHasNoAdministrativeSurfaceLeft`
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
- **Tests:** `test_FundHasNoAdministrativeSurfaceLeft`, `test_RedemptionIsTheOnlyWayAssetsCanEverLeaveFund`
- **Status:** `implemented`
- **Commit:** `dc67d7c`
- **Caveats:** This is a strength and a risk simultaneously. A discovered bug cannot be patched in place.

---

## M. Supported assets and external dependencies

### FACT-TOK-01 — Only standard, non-rebasing ERC-20 behavior is supported

- **Plain-English claim:** The protocol works with ordinary tokens. Tokens that take a cut on transfer, rebase, or
  behave unusually are outside the supported model; canonical, reward, and Strategy paths do not add accounting to
  normalize them. Fund remains stricter for arbitrary selected redemption assets.
- **Technical formulation:** Under ADRs 0047 and 0049:
  - `Mine`, `SignalGBX`, `Strategy`, `Resonance`, and `Bribe` use `SafeERC20` and trust a
    successful call to move the requested amount. They do not snapshot pre/post balances. `BribeRouter` and
    `ResonanceRouter` likewise rely on the downstream pull.
  - Selected-asset redemption in `Fund` retains exact debit/credit checks plus pre-transfer and basket-wide guards
    because the caller can supply arbitrary token addresses.
    A fee-on-transfer or rebasing token may therefore revert, underfund accounting, consume unrelated surplus, or make
    a market unusable depending on the path. Canonical binding or registration is not an adapter or safety certification.
- **Source:** `packages/contracts/src/core/Strategy.sol`; `Resonance.sol`; `ResonanceRouter.sol`; `Bribe.sol`;
  `BribeRouter.sol`; `Mine.sol`; `SignalGBX.sol`; `Fund.sol`
- **ADR:** ADR 0020 as superseded for reward and Strategy settlement paths by ADR 0047; ADR 0049 for canonical GBX/USDG
- **Tests:** `test_SignalAtomicallyCustodiesMintsDelegatesAndMirrors`,
  `test_WithdrawSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying`,
  `test_ReplacementAfterThirtyMinutesSettlesOnlyThatSlotAndSplitsEightyTwenty`,
  `test_RedeemRejectsAFeeOnTransferAsset`,
  `test_MissingReturnRewardTokenCompletesIngressAndPayout`, `test_RedeemSupportsTokensThatReturnNoBoolean`
- **Status:** `implemented`
- **Commit:** `uncommitted`
- **Caveats:** `SafeERC20` checks call success and conventional optional return values; it does not prove the requested
  balance deltas occurred. Deployment must bind reviewed canonical GBX/USDG, and governance must register only suitable
  payment and reward tokens.

### FACT-TOK-02 — Router approvals are immediate and exact-sized, but residual allowances are not normalized

- **Plain-English claim:** Routers approve only the amount they are about to notify. Ordinary tokens consume that
  allowance in the same call; the core does not maintain cleanup logic for nonstandard allowance behavior.
- **Technical formulation:** `BribeRouter.route` and `ResonanceRouter.route` call
  `forceApprove(downstream, completeBalance)` immediately before notification. They do not clear or inspect the
  allowance afterward. `Strategy` no longer approves BribeRouter at all; it transfers the Bribe share directly.
  A token that accepts the nonzero approval and consumes the requested allowance works even if it rejects a separate
  zero approval. A sticky or partial-pull token may leave residual allowance and is outside the supported model.
- **Source:** `packages/contracts/src/core/BribeRouter.sol`; `ResonanceRouter.sol`; `Strategy.sol`
- **ADR:** ADR 0047 (supersedes finding **E-04**'s cleanup-specific implementation)
- **Tests:** `test_BuyDoesNotRequireStrategyToApproveTheRouter`,
  `test_DistributeAccumulatesUntilTheBalanceCanSustainANonzeroRate`,
  `test_RouteIsPermissionlessAndForwardsTheCompleteBalance`
- **Status:** `implemented`
- **Commit:** `uncommitted`

### FACT-EXT-01 — External dependencies

- **Plain-English claim:** The protocol depends on OpenZeppelin libraries, a USDG stablecoin it does not control, and
  a chain that supports transient storage. Registered payment, reward, and LP tokens add their own external risks.
- **Technical formulation:**
  | Dependency | Used by | Nature of trust |
  | -------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
  | OpenZeppelin `ERC20`, `ERC20Permit`, `ERC20Votes`, `Ownable`, `ReentrancyGuard`, `SafeERC20`, `Math` | all contracts | Library correctness |
  | USDG (external ERC-20, 6 decimals by deployment) | `Mine`, `Resonance`, `ResonanceRouter`, `Strategy` | Issuer solvency, no blocklist, no rebase; **the issuer is not the protocol** |
  | Strategy payment tokens and Bribe reward tokens | `Strategy`, `BribeRouter`, `Bribe`, `Fund` | Each is an independent third-party token with its own upgrade and freeze risk |
  | External UniV2 LP token, if registered | ordinary `Strategy` and `Fund` paths | Pair, venue, underlying-token, upgrade, freeze, and liquidity risk |
  | EIP-1153 transient storage (Cancun) | `Fund.redeem` | Target chain must support `tstore`/`tload` |
  There is **no price oracle, NAV calculation, entropy source, or keeper role** anywhere in the protocol.
- **Source:** import statements across `packages/contracts/src`; `docs/TRUST_ASSUMPTIONS.md`
- **ADR:** ADR 0016, ADR 0024, ADR 0050
- **Tests:** core unit and integration profiles exercise the active dependency paths.
- **Status:** `implemented` / `config-dependent`
- **Commit:** uncommitted ADR 0050 development candidate (2026-08-24)
- **Caveats:** The intended target chain is named as **Robinhood Chain** in `README.md`, and
  `packages/config/deployments` holds dated _candidate_ files (for example
  `robinhood-mainnet-wrapped-btc.2026-08-02.candidate.json`). No canonical USDG or bootstrap LP token address is
  resolved, and no signed manifest clears them.

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

### FACT-LIM-09 — External LP registration guarantees no market liquidity

See FACT-LP-01 and FACT-LP-02. Registering an external LP token as a Strategy asset neither creates nor guarantees a
liquid GBX market; its pair and venue remain external.

### FACT-LIM-10 — Lazy accounting means displayed balances understate entitlements

Mining accrual (FACT-MINE-01) and Resonance streaming (FACT-RES-01) are both lazy. `GBX.totalSupply()` understates
economic supply; a Strategy's raw USDG balance understates its executable auction inventory. Interfaces must preview
`Mine.effectiveTotalSupply()` and `Resonance.earnedRevenue(strategy)` rather than reading raw balances.

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
- **Source:** `packages/contracts/audit/FINDINGS.md` ("The candidate ... has not received an independent audit");
  `docs/THREAT_MODEL.md` ("Current internal hardening does not replace independent security review.")
- **Status:** verified at `281e601`

### FACT-STATUS-03 — Current ADR 0049 internal engineering evidence status

- **Claim:** Extensive local test campaigns exist. They are engineering evidence, not proof and not an audit.
- **Latest focused evidence, verified locally on 2026-08-23 before ADR 0049:** the ADR-0048 migration suites pass **104/104** and the
  focused mutation campaign kills **47/47** targeted mutants. The maximum-bound regressions measure a composed move
  with sixteen active streams on both Bribes at 1,890,938 gas against a 3,000,000 ceiling, all-token claim at
  1,471,439, sixteen sequential scalar claims at 1,488,760, withdrawal at 1,129,059, and signal addition at 491,494.
- **Historical pre-ADR-0048 matrix:** the immediately preceding ADR-0047 tree passed **312/312 Foundry tests across 23
  suites**, all **29 invariant entries** at 1,000 runs of depth 500 with zero handler reverts, integration **21/21**,
  Hardhat **4/4**, SDK **47/47**, TypeScript simulations **36/36**, Python environment checks **5/5**, Python
  simulations **22/22**, Matchstick **9/9**, web unit **3/3**, Playwright **6/6**, and focused mutation **46/46**.
  Its build, typecheck, lint, documentation, ABI, subgraph-build, generated-artifact, changed-file Prettier, and
  `forge fmt --check` gates passed. Those results predate the sixteen-token and composed-move changes and are not a
  complete current-tree matrix.
- **Still absent:** a complete post-ADR-0049 deterministic and workspace rerun, independent external audit,
  compatible current-tree symbolic analysis, re-run static analysis and external fuzzing, a second external-fuzzer
  seed, independent review of the provisional Mine economics, external-governance integration review, monitored
  testnet rehearsal, release review, a signed deployment manifest, and a clean repository-wide format gate. The
  repository-wide format gate was already open because **11 unchanged baseline landing/lockfile files** failed
  Prettier.
- **Status:** recorded ADR-0048 tests and mutation evidence predate ADR 0049; the broad post-change matrix remains
  pending and no reviewed candidate commit is pinned

### FACT-STATUS-04 — Open release gates

| Finding | Severity | Gate                                                                                                                                            |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| M-03    | High     | Immutable bindings cannot detect a malicious lookalike; requires signed manifest, runtime code hashes, constructor arguments, receipts.         |
| M-04    | High     | Mine economics are selected, hard-coded, and modelled, but still require independent economic review before deployment.                         |
| G-03    | High     | The external governance system that will own `Resonance` is unselected; its voting, delegation, permission, and delay semantics are unreviewed. |
| G-01    | High     | sGBX checkpoints survive withdrawal; the selected external system's snapshot-to-vote spacing requires independent review of the capture model.  |
| E-02    | High     | Reduced but not eliminated; codehash, parameter, and manifest review remains external.                                                          |

Additionally open per the current ADR-0049 `FINDINGS.md`: independent audit, current-tree regeneration of the
static-analysis and external-fuzzing gates, a second external-fuzzer seed, legal clearance, reviewed production
parameters, exact external-governance integration review, monitored testnet rehearsal, a signed deployment manifest,
the complete post-ADR-0049 repository matrix, and the repository-wide format gate. ADR 0049 changes the implementation
but does not close those release gates.

- **Source:** `packages/contracts/audit/FINDINGS.md`, `packages/contracts/audit/SIGNAL-RESONANCE-FINDINGS.md`
- **Status:** open gates carried forward in the ADR-0049-reconciled audit register

### FACT-STATUS-05 — Legal and provenance clearance is an unresolved release blocker

- **Claim:** The chain of title for the protocol's upstream code lineage is not resolved, and repository-level
  (BUSL-1.1) and file-level (MIT) license terms are not reconciled.
- **Technical detail:** Active contracts are adaptations of pinned give.fun `ef6ee14a…`, pinned Liquid Signal
  Governance `14b5fbbb…`, and unpinned donut-miner lineage. `Strategy`'s reverse-Dutch shape has a transitive Euler Fee Flow
  ancestor at `3bee858a…` whose reviewed file is **GPL-2.0-or-later**. Synthetix and Solidly ancestors are named
  without exact repository, commit, or path.
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

| Constant                                                | Source               | Value                        |
| ------------------------------------------------------- | -------------------- | ---------------------------- |
| GBX initial supply                                      | `core/GBX.sol`       | `0`                          |
| `Mine.BPS` / `Mine.PREVIOUS_MINER_BPS`                  | `core/Mine.sol`      | `10_000` / `8_000`           |
| `Mine.PRICE_DECAY_PERIOD`                               | `core/Mine.sol`      | `1 hours`                    |
| `Mine.SLOT_COUNT` / `PRICE_MULTIPLIER`                  | `core/Mine.sol`      | `16` / `2`                   |
| `Mine.MIN_INITIAL_PRICE` / `MAX_INITIAL_PRICE`          | `core/Mine.sol`      | `1e6` / `uint192.max`        |
| `Mine.INITIAL_TPS` / `TAIL_TPS`                         | `core/Mine.sol`      | `64 ether` / `1 ether`       |
| `Mine.HALVING_PERIOD`                                   | `core/Mine.sol`      | `69 days`                    |
| `Resonance.REWARD_DURATION` / `REWARD_PRECISION`        | `core/Resonance.sol` | `7 days` / `1e36`            |
| `Bribe.REWARD_DURATION` / `REWARD_PRECISION`            | `core/Bribe.sol`     | `7 days` / `1e36`            |
| `Bribe.MAX_REWARD_TOKENS`                               | `core/Bribe.sol`     | `16`                         |
| `Strategy.MIN_/MAX_EPOCH_DURATION`                      | `core/Strategy.sol`  | `1 hours` / `365 days`       |
| `Strategy.ABSOLUTE_MINIMUM_PRICE` / `PRICE_SCALE`       | `core/Strategy.sol`  | `1e6` / `1e18`               |
| `Bribe.MAX_LIFETIME_REWARD_AMOUNT`                      | `core/Bribe.sol`     | `⌊(2²⁵⁶−1)/1e36⌋`            |
| `Resonance.BPS` / `DEFAULT_BRIBE_BPS` / `MAX_BRIBE_BPS` | `core/Resonance.sol` | `10_000` / `1_000` / `2_000` |
| `Strategy.BPS`                                          | `core/Strategy.sol`  | `10_000`                     |

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
**Resolution used in public documents:** the ADR 0044 uncommitted tree independently passed 356 default and 19
integration tests, and the distinct ADR 0042 tree happened to record the same totals. Both are historical evidence.
The immediately preceding ADR-0047 development tree separately passed 312/312 Foundry tests across 23 suites, 29
invariant entries at 1,000 runs of depth 500 with zero handler reverts, and 21/21 integration tests. Those results
predate ADR 0048. The current focused ADR-0048 migration suites pass 104/104 and its targeted mutation campaign kills
47/47 mutants; the complete post-change repository matrix remains pending. All results remain unpinned local
engineering evidence, and the repository-wide format gate remains open because 11 unchanged baseline landing/lockfile
files fail Prettier.

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

The `AGENTS.md` formulation is the precise one and is supported by the implementation:
`Resonance.isStrategyRegistered` / `isStrategyLive` is a real, governance-curated registry of the assets the protocol
targets. What the implementation
does **not** contain is any index _methodology_ — there is no target weighting, rebalancing, drift correction,
reconstitution rule, or NAV computation anywhere in `packages/contracts/src`, and `Fund` deliberately has no asset
registry at all (FACT-FUND-01).

**Resolution used in public documents:** the `AGENTS.md` sense is adopted. Registered Strategies are described as
index membership; the absence of index methodology, weights, rebalancing, and NAV is stated explicitly; and
membership is never inferred from a Fund balance, since `Fund` accepts unsolicited transfers without review. An
earlier draft of these documents flatly denied that the protocol is an index, which overcorrected against
`AGENTS.md:72`; that phrasing was revised.
