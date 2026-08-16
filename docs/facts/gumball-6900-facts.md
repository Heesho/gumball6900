# GUM BALL 6900 internal fact registry

> Internal working document. This registry is the evidence base for the public one-pager, layman's article, and
> technical whitepaper. It is engineering evidence only: it is not an audit, a deployment authorization, a legal
> conclusion, or a claim that the protocol is safe for user funds.

- **Source commit:** `95ed60efe333d875f7a66da7853eebdf5384e956`
- **Commit subject:** `merge: signal and resonance hardening`
- **Branch:** `claude/gumball-6900-docs-f8db2c` (fast-forwarded to `origin/main`)
- **Working tree at capture:** clean apart from these new documents
- **Registry date:** 2026-08-16

> **Revision note.** An earlier draft of this registry and its three public documents was written against commit
> `281e601`. That commit is superseded by ADR 0031 (mandatory signal-backed SignalGBX) and ADR 0032 (fixed 90/10
> acquired-asset settlement), which changed the settlement split, removed idle sGBX and the entire standalone
> staking surface, and blocked killing the final live Strategy. Every affected claim has been re-derived against
> `95ed60e`. Facts still carrying a `281e601` commit stamp were re-verified as unchanged at `95ed60e`.

- **Solidity source tree:** `packages/contracts/src`
- **Compiler:** Solidity `0.8.26`, Cancun target (EIP-1153 transient storage is required)

## How to read this registry

Every fact carries the commit it was verified against. "Verified" means the claim was read directly out of the
Solidity at this commit, not inferred from a filename, a summary document, or an ADR narrative. Where a document in
the repository disagrees with the Solidity, the Solidity wins and the discrepancy is recorded in
[Unresolved discrepancies](#unresolved-discrepancies).

**Status vocabulary used throughout:**

| Status                 | Meaning                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `implemented`          | Present in Solidity at this commit and covered by at least one named test.                |
| `implemented-untested` | Present in Solidity at this commit; no test was found that targets it specifically.       |
| `config-dependent`     | Behavior is real, but its economic magnitude depends on unselected deployment parameters. |
| `accepted-limitation`  | Known behavior deliberately accepted by an ADR rather than fixed.                         |
| `open-gate`            | Unresolved release blocker recorded in the internal finding register.                     |

## Authoritative and superseded sources

ADR supersession was read from each ADR's own `Status` line at this commit. Several ADRs are **partially** superseded:
the accepted part is authoritative and the superseded part must not be presented as current behavior.

### Currently authoritative (in whole or in part)

| ADR      | Title                                                        | Authoritative for                                                                                                                                                             |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 0017 | Remove successor migration; ownerless Fund and LP            | Fully accepted. No successor, migration, or owner on Fund/LiquidityPosition.                                                                                                  |
| ADR 0022 | Fixed-principal LP fee routing                               | Fully accepted. Harvest routes USDG, burns GBX, never touches principal.                                                                                                      |
| ADR 0024 | Immutable multislot Mine with tenure-locked rates            | Mine design, supply model, tenure rate lock. Its GBX-ERC20Votes statement is superseded by ADR 0030.                                                                          |
| ADR 0027 | Fix Bribe carry before signal-supply boundaries              | Fully accepted. Bribe carry classification to Fund.                                                                                                                           |
| ADR 0028 | Closed Bribe pools after Strategy death                      | Fully accepted, including the accepted permanent-abandonment consequence.                                                                                                     |
| ADR 0029 | Bribe-based Resonance reward stream                          | Resonance streaming, `1e36` index, accepted surplus. Signal entrypoints and state ownership superseded by ADR 0030 then 0031; kill-final-Strategy by 0031; 100%-Fund by 0032. |
| ADR 0030 | SignalGBX coordination and selector-bounded token governance | ProtocolGovernor, Timelock, voting token, selector-bounded proposal filter. Its idle-sGBX and `allocatedBalance` decisions are superseded by ADR 0031.                        |
| ADR 0031 | Mandatory signal-backed SignalGBX                            | **New.** No idle sGBX; atomic signal/withdraw; `balanceOf` is the aggregate; final live Strategy cannot be killed.                                                            |
| ADR 0032 | Fixed 90/10 acquired-asset settlement                        | **New.** 90% Fund / 10% paired Bribe, cumulatively exact and frequency-independent.                                                                                           |

### Historical context only — partially superseded

| ADR      | Superseded provisions that must not be presented as current                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 0013 | Acquisition-split and buyback provisions (by ADR 0021, then 0032); external proposer/canceller model (by ADR 0030).                                           |
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
> in the earlier version of these documents and must no longer be presented as current behavior anywhere.

### Historical audit documents — excluded as current evidence

`packages/contracts/audit/AUDIT-BASELINE.md` and `packages/contracts/audit/TEST-CAMPAIGN.md` both carry explicit
"Historical evidence only" banners and review commit `54e3f2c3ce1de25aea4da2f21fab27804a3bfa84` (2026-08-09), before
the ADR 0024 Mine redesign and the ADR 0029/0030/0031/0032 changes. Their counts (including "340 passed") **must not**
be reported as current. `packages/contracts/audit/FINDINGS.md` (dated 2026-08-16) is the current disposition register;
campaign-specific findings for the ADR 0031/0032 work are in `packages/contracts/audit/SIGNAL-RESONANCE-FINDINGS.md`.

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
  `test_BurnTracksCumulativeSupplyDestructionWithoutReopeningHandover`, `test_MiningRequiresThePermanentGBXHandover`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** The reciprocal check confirms the target _claims_ the same GBX. It cannot distinguish a malicious
  lookalike that returns the expected identity. This is finding M-03, an open release gate (FACT-STATUS-04).

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
- **Technical formulation:** For each occupied slot, accrual is `(block.timestamp - slot.lastAccruedAt) * slot.ups`
  raw GBX units. `_checkpointAll` mints that amount to `slot.miner` and advances `lastAccruedAt`. `ups` is
  GBX raw units (18 decimals) per second.
- **Source:** `packages/contracts/src/core/Mine.sol:353-377`
- **Functions/state:** `slots`, `Slot.ups`, `Slot.lastAccruedAt`, `checkpointAll`, `pendingEmission`, `totalMined`
- **ADR:** ADR 0024
- **Tests:** `test_MiningRoutesRevenueMintsContinuouslyAndPaysTheDisplacedMiner`,
  `test_EffectiveSupplyIncludesPendingEmissionBeforeCheckpoint`,
  `invariant_EffectiveSupplyIncludesEveryPendingEmission`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Accrual is _lazy_. GBX is not minted until someone calls a checkpointing path. `GBX.totalSupply()`
  therefore understates economic supply between checkpoints; `Mine.effectiveTotalSupply()` is the inclusive figure.

### FACT-MINE-02 — Mine starts with one slot; capacity may only increase, to a hard maximum of 16

- **Plain-English claim:** The mine opens with a single slot. Governance can add slots, up to sixteen, but can never
  remove one.
- **Technical formulation:** `capacity = 1` at construction. `increaseCapacity(newCapacity)` is `onlyOwner`, reverts
  when `newCapacity <= capacity` (`CapacityNotIncreased`) and when `newCapacity > MAX_CAPACITY` (`CapacityTooHigh`).
  `MAX_CAPACITY = 16`.
- **Source:** `packages/contracts/src/core/Mine.sol:33`, `:69`, `:299-313`
- **Functions/state:** `capacity`, `MAX_CAPACITY`, `increaseCapacity`
- **ADR:** ADR 0024
- **Tests:** `test_CapacityCanOnlyIncreaseThroughTheOwnerAndNeverAboveTheHardCap`,
  `invariant_MiningCapacityAndRatesStayBounded`
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

### FACT-MINE-04 — A replacement pays USDG; 80% becomes the displaced miner's pull claim and 20% routes to Resonance

- **Plain-English claim:** When you take over an occupied slot, 80% of what you pay goes to the miner you displaced
  and 20% becomes protocol revenue. If the slot was empty, 100% is protocol revenue.
- **Technical formulation:** `PREVIOUS_MINER_BPS = 8_000`, `BPS = 10_000`. For `paid > 0` and a nonzero
  `previousSlot.miner`: `previousMinerAmount = floor(paid * 8000 / 10000)`, `revenueAmount = paid - previousMinerAmount`.
  For `previousSlot.miner == address(0)`: `revenueAmount = paid`. For `paid == 0`: both are zero and no token moves.
- **Source:** `packages/contracts/src/core/Mine.sol:25-27`, `:235-247`
- **Functions/state:** `PREVIOUS_MINER_BPS`, `BPS`, `_allocatePayment`, `claimable`, `totalClaimable`
- **ADR:** ADR 0024
- **Tests:** `test_ReplacementAfterThirtyMinutesMintsGBXAndSplitsPaymentEightyTwenty`,
  `test_FirstMinerRoutesTheCompletePaymentBecauseNoMinerIsDisplaced`,
  `test_ReplacementAtZeroPriceStillSettlesEmissionWithoutCreatingPayment`,
  `testFuzz_MineRevenueAndHandoffClaimsReachFinalDestinationsWithoutDust`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** `revenueAmount = paid - floor(paid * 0.8)`, so the routed share is `ceil(paid * 0.2)`. The protocol,
  not the displaced miner, receives the rounding unit. There is no team fee anywhere in `Mine.sol`.

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

- **Plain-English claim:** Once you take a slot, your GBX-per-second rate is fixed until someone replaces you. Adding
  slots, checkpointing, redemptions, or emission halvings never reduce it.
- **Technical formulation:** `slot.ups` is written only inside `mine()` when constructing the new `Slot`. No other
  function assigns `slot.ups`. A new occupant receives `ups = _globalUps(totalMined) / capacity`, evaluated **after**
  `_checkpointAll()`, using integer division; the division residue is unissued.
- **Source:** `packages/contracts/src/core/Mine.sol:198`, `:209-216`
- **Functions/state:** `mine`, `Slot.ups`, `_globalUps`, `capacity`
- **ADR:** ADR 0024
- **Tests:** `test_IncreasingCapacityPreservesLegacyRateAndDividesOnlyNewSlots`,
  `test_MiningCapacityIncreasePreservesIncumbentAndDividesNewSlotRate`,
  `test_LongTenureKeepsItsOriginalRateAcrossSupplyThresholds`, `test_CheckpointDoesNotResetTheAuctionClockOrPrice`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** This is the accepted consequence recorded as finding **M-01**: because incumbents keep old rates while
  new slots get `globalRate / newCapacity`, aggregate issuance can temporarily exceed the current undivided global
  rate after a capacity increase. `packages/simulations/fixtures/economic-scenarios.json` models capacity 1→3 with an
  incumbent at 100 GBX/hour and two new slots at 33.333… GBX/hour each, for 166.666… GBX/hour aggregate against a
  100 GBX/hour undivided global rate.

### FACT-MINE-07 — The global handoff rate halves at cumulative-mining thresholds down to a strictly positive tail

- **Plain-English claim:** The rate offered to _new_ slot occupants halves as cumulative mining passes fixed
  thresholds, and then stops falling at a permanent floor. Issuance never reaches zero.
- **Technical formulation:** `_rateState(mined)` walks halvings `k = 0, 1, 2, …`. Threshold accumulation is
  `T_1 = H`, `T_{k+1} = T_k + (H >> k)` where `H = halvingAmount`. Rate after `k` halvings is `initialUps >> k`. As
  soon as `initialUps >> k <= tailUps`, the rate is pinned to `tailUps` and the next threshold becomes
  `type(uint256).max`.
- **Source:** `packages/contracts/src/core/Mine.sol:383-398`
- **Functions/state:** `_rateState`, `_globalUps`, `nextGlobalUps`, `initialUps`, `halvingAmount`, `tailUps`, `totalMined`
- **ADR:** ADR 0024
- **Tests:** `test_SupplyThresholdHalvesTheRateAndTailNeverEnds`,
  `test_GlobalRateUsesTheTailWhenTheInitialRateAlreadyEqualsIt`, `test_LongTenureKeepsItsOriginalRateAcrossSupplyThresholds`
- **Status:** `implemented` / `config-dependent`
- **Commit:** `281e601`
- **Caveats:** Because thresholds themselves halve, the _entire_ halving schedule completes below cumulative mined
  `2H`. `sum_{k>=0} (H >> k) < 2H`. After that, issuance is permanently `tailUps` per second globally. The exact
  `initialUps`, `halvingAmount`, and `tailUps` are **unselected** — finding M-04, an open release gate.

### FACT-MINE-08 — Constructor bounds on Mine's immutable economic parameters

- **Plain-English claim:** The deployment parameters must fall inside hard-coded ranges, checked once at construction
  and never changeable.
- **Technical formulation:**
  | Parameter | Constraint |
  | --------------------- | ------------------------------------------------------------------- |
  | `priceMultiplier` | `[MIN_PRICE_MULTIPLIER, MAX_PRICE_MULTIPLIER] = [1.1e18, 3e18]` |
  | `minimumInitialPrice` | `[MIN_INITIAL_PRICE, MAX_INITIAL_PRICE] = [1e6, type(uint192).max]` |
  | `initialUps` | `(0, MAX_INITIAL_UPS] = (0, 1e24]` |
  | `tailUps` | `[MIN_TAIL_UPS, initialUps] = [16, initialUps]` |
  | `halvingAmount` | `[MIN_HALVING_AMOUNT, MAX_HALVING_AMOUNT] = [1_000 ether, 1e27]` |
  Additionally `IRevenueRouterIdentity(resonanceRouter).usdg()` must equal `usdg`.
- **Source:** `packages/contracts/src/core/Mine.sol:28-49`, `:136-173`
- **Functions/state:** `constructor`, `Config`
- **ADR:** ADR 0024
- **Tests:** `test_ConstructorRejectsInvalidDependenciesAndEconomicBounds`, `test_ConstructorRejectsZeroAddresses`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** `MIN_TAIL_UPS = MAX_CAPACITY = 16` exists so that `tailUps / capacity >= 1` at maximum capacity — a new
  slot always receives a strictly positive rate.

### FACT-MINE-09 — The next slot opening price is the paid price times an immutable multiplier, clamped

- **Plain-English claim:** After a slot is bought, the next auction starts higher — a fixed multiple of what was just
  paid — with a floor and a ceiling.
- **Technical formulation:**
  `nextInitialPrice = clamp(floor(paid * priceMultiplier / 1e18), minimumInitialPrice, type(uint192).max)`.
  `PRICE_PRECISION = 1e18`.
- **Source:** `packages/contracts/src/core/Mine.sol:202-207`
- **Functions/state:** `priceMultiplier`, `minimumInitialPrice`, `PRICE_PRECISION`, `MAX_INITIAL_PRICE`
- **ADR:** ADR 0024
- **Tests:** `testFuzz_NextStartingPriceStaysWithinItsBounds`, `test_AFreeFillAtFullDecayRestartsAtTheConfiguredFloor`,
  `test_RecoveryFromTheFloorIsOnlyGeometric`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** A fill at zero (after the hour elapses) produces `floor(0 * m) = 0`, which clamps up to
  `minimumInitialPrice`. Price recovery from the floor is geometric, not immediate.

### FACT-MINE-10 — Replacement callers are protected by expected epoch, deadline, and maximum price

- **Plain-English claim:** A miner's transaction specifies which auction round they expect, the latest time they will
  accept, and the most they will pay. Any mismatch reverts.
- **Technical formulation:** `mine(miner, index, epochId, deadline, maximumPrice)` reverts with `EpochIdMismatch`,
  `DeadlinePassed`, `IndexOutOfBounds`, or `MaxPriceExceeded`. `epochId` increments on every fill.
- **Source:** `packages/contracts/src/core/Mine.sol:182-221`
- **Functions/state:** `mine`, `Slot.epochId`
- **ADR:** ADR 0024
- **Tests:** `test_ExpectedEpochDeadlineAndMaximumPriceProtectReplacement`, `test_MineAndSlotViewsRejectInvalidInputs`
- **Status:** `implemented`
- **Commit:** `281e601`

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
  `ISignalGBXAllocation` interface (the file is deleted at this commit). `SignalGBX.balanceOf(account)` **is** the
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

### FACT-SGBX-06 — Governance weight and economically active signal are now the same quantity

- **Plain-English claim:** Because no sGBX can sit idle, the total voting supply is exactly the total signal directing
  revenue. Everyone who can vote is also earning.
- **Technical formulation:** `sGBX.totalSupply()` is both the ERC20Votes supply used by
  `ProtocolGovernor.quorum` and, by FACT-SGBX-05, the sum of every Strategy's recorded Bribe supply across live and
  killed Strategies. Under ADR 0030 these were different quantities; under ADR 0031 they coincide.
- **Source:** `packages/contracts/src/core/SignalGBX.sol:22`; `docs/adr/0031-mandatory-signal-backed-signalgbx.md`
- **Functions/state:** `totalSupply`, `getPastTotalSupply`, `Bribe.totalSupply`
- **ADR:** ADR 0031
- **Tests:** `invariant_EveryReceiptUnitIsAssigned`, `invariant_StrategyWeightsSumToTheGlobalTotal`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** This narrows but does **not** close finding **G-03**. The quorum denominator no longer includes idle
  receipts, but it still includes **undelegated** sGBX, which votes with nobody. `FINDINGS.md` at this commit was
  updated accordingly, from "idle or undelegated" to "undelegated". Note also that signal on a **killed** Strategy
  still counts toward `totalSupply` and therefore toward quorum, while contributing nothing to
  `Resonance.totalSignalWeight`.

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
  `test_SameTransactionSignalAndPurchaseCannotCaptureNewlyNotifiedRevenue` (named in FINDINGS.md as the A-11 regression),
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

## E. Onchain governance

### FACT-GOV-01 — ProtocolGovernor admits only four exact zero-value calls

- **Plain-English claim:** Governance can do exactly four things and nothing else. Every other proposal is rejected
  before it is even created.
- **Technical formulation:** `_propose` iterates all calls and requires `values[i] == 0` and either:
  | Target | Selector | Required calldata length |
  | ----------- | --------------------------- | ------------------------ |
  | `resonance` | `Resonance.addStrategy` | `4 + 5*32 = 164` bytes |
  | `resonance` | `Resonance.killStrategy` | `4 + 32 = 36` bytes |
  | `resonance` | `Resonance.addBribeReward` | `4 + 2*32 = 68` bytes |
  | `mine` | `Mine.increaseCapacity` | `4 + 32 = 36` bytes |
  Anything else reverts `UnsupportedProposalCall`. Empty proposals revert `GovernorInvalidProposalLength`.
- **Source:** `packages/contracts/src/governance/ProtocolGovernor.sol:26-29`, `:121-155`
- **Functions/state:** `_propose`, `resonance`, `mine`
- **ADR:** ADR 0030, ADR 0016
- **Tests:** `test_OnlyTheFourExactZeroValueCallsCanBeProposed`, `test_ProposalLengthValidationAndPendingCancellation`,
  `test_ApprovedBatchExecutesAllBoundedAdministrationAfterTheTimelock`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-GOV-02 — Governor voting parameters are immutable and set at construction

- **Plain-English claim:** Voting delay, voting period, proposal threshold, quorum percentage, and the target
  contracts are fixed at deployment and can never be changed.
- **Technical formulation:** `_votingDelayBlocks (uint48)`, `_votingPeriodBlocks (uint32)`,
  `_proposalThresholdVotes (uint256)`, `_quorumNumerator (uint256)`, `resonance`, and `mine` are all `immutable`.
  Constructor requires `votingPeriodBlocks != 0`, `quorumNumerator_ != 0`, `quorumNumerator_ <= 100`, and
  `resonance_.signalGBX() == address(votingToken)`.
- **Source:** `packages/contracts/src/governance/ProtocolGovernor.sol:32-39`, `:59-88`
- **Functions/state:** `votingDelay`, `votingPeriod`, `proposalThreshold`, `quorumNumerator`, `quorumDenominator`
- **ADR:** ADR 0030
- **Tests:** `test_ConstructorRejectsMismatchedTokenAndInvalidVotingParameters`,
  `test_DeploymentFixesDependenciesSettingsAndRoleClosure`
- **Status:** `implemented` / `config-dependent`
- **Commit:** `281e601`
- **Caveats:** The actual values are **not selected**. Exact voting delay, period, threshold, quorum, and the target
  chain's block-time assumption remain unresolved production parameters (finding G-03).

### FACT-GOV-03 — Quorum is a percentage of historical sGBX total supply

- **Plain-English claim:** A proposal passes only if enough of all signalled GBX participates, measured at the
  snapshot block.
- **Technical formulation:** `quorum(timepoint) = floor(token().getPastTotalSupply(timepoint) * quorumNumerator / 100)`.
  `QUORUM_DENOMINATOR = 100`.
- **Source:** `packages/contracts/src/governance/ProtocolGovernor.sol:26`, `:116-118`
- **Functions/state:** `quorum`, `QUORUM_DENOMINATOR`
- **ADR:** ADR 0030
- **Tests:** `test_QuorumUsesSnapshotSupplyAndVotingDoesNotLockSignalGBX`,
  `test_ProposalWithWinningVotesButNoQuorumIsDefeated`
- **Status:** `implemented`
- **Commit:** `281e601` (formula unchanged at `95ed60e`; denominator composition changed)
- **Caveats:** Under ADR 0031 the denominator no longer includes **idle** sGBX, because idle sGBX cannot exist
  (FACT-SGBX-06). It still includes **undelegated** sGBX, and it still includes signal committed to **killed**
  Strategies. `FINDINGS.md` at `95ed60e` narrows finding **G-03** accordingly, from "idle or undelegated" to
  "undelegated". G-03 remains an open deployment and parameter gate.

### FACT-GOV-04 — Generic Governor escape hatches are permanently disabled

- **Plain-English claim:** The standard governance features that would let a DAO call arbitrary contracts, receive
  ETH, or swap out its own timelock have all been removed.
- **Technical formulation:** `relay(...)` always reverts `ImmutableGovernanceSurface`. `updateTimelock(...)` always
  reverts. `receive()` always reverts. `execute(...)` reverts when `msg.value != 0`.
- **Source:** `packages/contracts/src/governance/ProtocolGovernor.sol:165-188`
- **Functions/state:** `relay`, `updateTimelock`, `receive`, `execute`
- **ADR:** ADR 0030, ADR 0016
- **Tests:** `test_DirectOwnerAndTimelockSchedulingBypassIsClosed`, `test_DeploymentFixesDependenciesSettingsAndRoleClosure`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-GOV-05 — There is no guardian and no way to cancel a queued proposal

- **Plain-English claim:** Once a passed proposal enters the timelock queue, nobody can stop it. The delay is a
  warning window, not an emergency brake.
- **Technical formulation:** `ProtocolGovernor` exposes no public function that calls `TimelockController.cancel`,
  even though deployment is specified to grant it `CANCELLER_ROLE`. Inherited OpenZeppelin `Governor.cancel` is
  proposer-only and only while the proposal is `Pending`.
- **Source:** `packages/contracts/src/governance/ProtocolGovernor.sol:234-241` (internal `_cancel` override only)
- **Functions/state:** `cancel` (inherited), `_cancel`
- **ADR:** ADR 0030
- **Tests:** `test_QueuedProposalCannotBeCancelled`, `test_ProposalLengthValidationAndPendingCancellation`,
  `test_RevertingLateBatchCallRollsBackEarlierCallsAndRemainsQueued`
- **Status:** `accepted-limitation`
- **Commit:** `281e601`
- **Caveats:** Finding **G-02**, accepted by ADR 0030. A stale or conflicting queued operation can remain queued
  forever and revert on execution; it does not block a differently-described replacement proposal.

### FACT-GOV-06 — Timelock ownership and role closure are a deployment procedure, not a contract invariant

- **Plain-English claim:** The intended setup gives the timelock ownership of Resonance and Mine, makes the Governor
  its only proposer, and leaves execution open to anyone after the delay — but this is done by deployment steps, not
  enforced by the contracts themselves.
- **Technical formulation:** `Resonance` and `Mine` are `Ownable`; ownership transfer to a `TimelockController` and
  the grant/renounce of `PROPOSER_ROLE`, `CANCELLER_ROLE`, `EXECUTOR_ROLE` (zero address), and `DEFAULT_ADMIN_ROLE`
  occur in deployment steps 9–10 of `docs/DEPLOYMENT.md`. No Solidity in this repository enforces them.
- **Source:** `docs/DEPLOYMENT.md` steps 9–11; `packages/contracts/src/core/Resonance.sol:25`;
  `packages/contracts/src/core/Mine.sol:21`
- **Functions/state:** `Ownable.owner`, `transferOwnership`
- **ADR:** ADR 0030, ADR 0016
- **Tests:** `test_DeploymentFixesDependenciesSettingsAndRoleClosure`, `test_TheCampaignWiresTheCompleteProtocolGraph`
  (fixture-level; they prove the intended wiring is achievable, not that any real deployment achieved it)
- **Status:** `open-gate`
- **Commit:** `281e601`
- **Caveats:** Because it is procedural, a misconfigured deployment cannot be repaired — the protocol has no upgrade,
  migration, or successor authority. This is part of findings **M-03** and **E-02**.

---

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

- **Plain-English claim:** Small amounts of revenue wait in a router until they are large enough to qualify, instead
  of reverting the mining or fee-harvest transaction that produced them.
- **Technical formulation:** `route()` reverts `NoRevenue` on a zero balance. Otherwise it reads
  `minimum = Resonance.left(usdg)`; if `pending < minimum` it emits `RevenueHeld` and returns `0` without
  transferring. Otherwise it forwards its **complete** balance, and reverts `RevenueRetained` if any USDG remains.
- **Source:** `packages/contracts/src/core/ResonanceRouter.sol:56-76`
- **Functions/state:** `route`, `pendingRevenue`, `RevenueHeld`, `RevenueRetained`
- **ADR:** ADR 0029
- **Tests:** `test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies`,
  `test_RouteIsPermissionlessAndForwardsTheCompleteBalance`, `test_RouteRevertsIfResonanceLeavesRevenueBehind`,
  `test_RouteRejectsAnEmptyRouter`, `invariant_RevenueRouterRetentionIsFullyVisible`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** There is no absolute minimum. Because `left` decays to zero at `periodFinish`, any held balance
  eventually qualifies. Interfaces must distinguish "delivered to Router" from "in the active stream". Direct
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
- **Tests:** `test_AbsoluteSignalsDoNotRoundAwaySmallAllocations`, `test_AccrualIsProportionalToVirtualWeight`,
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
  `test_AcquisitionSendsCompletePaymentTowardFund`, `test_BuyRejectsAnEmptyStrategy`, `test_BuyRejectsAStaleEpochId`,
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
- **Caveats:** **At least one live Strategy always exists**, so there is always a valid signal destination. Governance
  replaces the final Strategy by batching `addStrategy(replacement)` before `killStrategy(previous)` in one proposal.
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

### FACT-SETL-01 — Every auction payment is classified 90% to Fund and 10% to the paired Bribe

- **Plain-English claim:** Of everything a buyer pays, 90% becomes treasury backing and 10% automatically becomes a
  reward for the people signaling that Strategy. The split is fixed in code and cannot be changed by anyone.
- **Technical formulation:** `BribeRouter` declares `BPS = 10_000`, `FUND_BPS = 9_000`, `BRIBE_BPS = 1_000` as
  `constant`. `routePayment` pulls the exact payment from its immutable `strategy`, then:

  ```text
  bribeAmount          = ⌊amount · 1000 / 10000⌋
  accumulatedRemainder = splitRemainder + (amount · 1000 mod 10000)
  bribeAmount         += ⌊accumulatedRemainder / 10000⌋
  splitRemainder       = accumulatedRemainder mod 10000
  fundAmount           = amount − bribeAmount
  ```

  It then increments `accountedPaymentBalance` by `amount`, `fundPaymentLiability` by `fundAmount`, and
  `bribePaymentLiability` by `bribeAmount`. There is no setter, governance parameter, team fee, or caller-selected
  destination.

- **Source:** `packages/contracts/src/core/BribeRouter.sol:22-27`, `:111-139`
- **Functions/state:** `FUND_BPS`, `BRIBE_BPS`, `routePayment`, `fundPaymentLiability`, `bribePaymentLiability`,
  `splitRemainder`, `accountedPaymentBalance`
- **ADR:** ADR 0032 (**supersedes ADR 0021 and its 100%-Fund rule**)
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

### FACT-SETL-01b — The 90/10 split is cumulatively exact and frequency-independent

- **Plain-English claim:** Splitting one big payment or a thousand tiny ones gives the Bribe exactly the same total.
  Nobody can starve the reward share by paying in dust.
- **Technical formulation:** `splitRemainder` carries the sub-unit Bribe entitlement in basis-point numerator units
  and is always `< BPS`. For any cumulative payment total `X`, regardless of how it was partitioned into calls:

  ```text
  cumulative Bribe classification = ⌊X · 1000 / 10000⌋
  cumulative Fund classification  = X − ⌊X · 1000 / 10000⌋
  splitRemainder                  = (X · 1000) mod 10000
  ```

  The implementation uses `Math.mulDiv` plus `mulmod` to avoid overflowing the intermediate product.

- **Source:** `packages/contracts/src/core/BribeRouter.sol:124-127`; `docs/adr/0032-fixed-90-10-acquired-asset-settlement.md`
- **Functions/state:** `splitRemainder`
- **ADR:** ADR 0032
- **Tests:** `testFuzz_ClassificationIsFrequencyIndependent`,
  `test_TenOneUnitPaymentsClassifyExactlyNineToFundAndOneToBribe`, `test_TenOneUnitPaymentsDoNotStarveTheBribe`
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

### FACT-BRIBE-02 — Bribes have two funding sources: the automatic 10% acquisition share and open external funding

- **Plain-English claim:** A Strategy's reward pool is fed automatically by 10% of every asset that Strategy acquires,
  and separately by anyone who chooses to add rewards on top.
- **Technical formulation:** `notifyRewardAmount(rewardToken, amount)` is public. It requires a registered token,
  pulls exactly `amount` with exact-delta checks, and increments `accountedRewardBalance`. Two distinct callers use it:
  1. **Automatic** — `BribeRouter.notifyBribeReward()` delivers the accumulated `bribePaymentLiability` in the
     Strategy's payment token, which `addStrategy` registered as reward token 1 of 8 at creation (FACT-SETL-01).
  2. **External** — any account may fund any registered reward token to attract signal toward that Strategy.
- **Source:** `packages/contracts/src/core/Bribe.sol:260-288`; `packages/contracts/src/core/BribeRouter.sol:158-179`
- **Functions/state:** `notifyRewardAmount`, `accountedRewardBalance`, `BribeRouter.notifyBribeReward`
- **ADR:** **ADR 0032** (automatic share), ADR 0019 (external funding and the cap)
- **Tests:** `test_NotifyingBribeIsPermissionlessExactAndClearsOnlyItsLeg`, `test_NotifyRejectsAnUnregisteredToken`,
  `test_NotifyRejectsAFeeOnTransferRewardToken`, `test_MultipleRewardTokensAccrueIndependently`,
  `test_RewardsDonatedDirectlyToABribeAreNeverScheduled`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** This supersedes the ADR 0021 rule that "auction proceeds never fund Bribes." Under ADR 0032 exactly 10%
  of the acquired asset does. Note the automatic share arrives through the same queueing and pausing machinery as any
  other notification (FACT-BRIBE-03, FACT-BRIBE-04), so it does not disturb a live stream.

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
- **Technical formulation:** `REWARD_PRECISION = 1e18`. Emission accumulates in `pendingRewardScaled` at
  `emitted * 1e18`. `_indexPendingReward` moves only the exactly divisible part into `rewardPerTokenStored`:
  `delta = pendingRewardScaled / supply`; `indexedScaled = delta * supply`; the remainder stays in
  `pendingRewardScaled`. Before **every** supply change, `_fundAllPendingRewards` moves the whole
  `pendingRewardScaled` into `fundRewardRemainder` via `_accrueFundScaled`, which converts full `1e18` units into
  `fundRewardLiability`. When an account's balance reaches zero, its `userRewardRemainder` also moves to Fund.
- **Source:** `packages/contracts/src/core/Bribe.sol:41`, `:299`, `:319`, `:325-331`, `:492-515`, `:552-562`, `:607-629`
- **Functions/state:** `pendingRewardScaled`, `indexedRewardScaled`, `userRewardRemainder`, `fundRewardRemainder`,
  `fundRewardLiability`, `_movePendingToFund`, `_accrueFundScaled`
- **ADR:** ADR 0027 (finding **A-09** Bribe half), ADR 0020
- **Tests:** `test_NewSignalerCannotReceivePreEntryRewardCarry`, `test_RemainingSignalerCannotReceivePreExitRewardCarry`,
  `test_FullExitCannotReallocateUserRewardRemainder`, `test_FlashSignalWeightCannotStealAccruedBribeRewards`,
  `test_LowDecimalRewardTokensDistributeTheExactRateRemainder`,
  `test_TheWorstCaseFormerRateFlooringRemainderIsFullyDistributed`,
  `invariant_BribeAccountingIdentitiesAreExact`, `invariant_BribesAreSolventAgainstAccruedRewards`,
  `testFuzz_BribeIsAlwaysSolventAgainstAccruedRewards`
- **Status:** `implemented`
- **Commit:** `281e601`
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
- **Tests:** `invariant_EveryActorCanFullyRemoveSignalsAndUnstake`,
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
  where `supplyBeforeBurn = gbx.totalSupply()` captured after `Mine.checkpointAll()` and before the burn.
- **Source:** `packages/contracts/src/core/Fund.sol:78-135`
- **Functions/state:** `redeem`, `balancesBefore`, `payouts`
- **ADR:** ADR 0017
- **Tests:** `test_RedeemPaysProRataAgainstThePreBurnSupply`, `testFuzz_PayoutIsExactlyTheFlooredProRataShare`,
  `test_FundRedeemsCallerSelectedAssetsAgainstPreBurnSupply`, `test_RedeemCanDirectAssetsToAThirdParty`,
  `test_OmittedTokensArePermanentlyForfeitedForThatRedeemer`, `test_RedeemingTheEntireSupplyDrainsTheSelectedAssets`,
  `testFuzz_BackingPerGBXNeverDecreasesOnRedemption`, `testFuzz_SequentialRedemptionsStaySolvent`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Worked example (from `packages/simulations/fixtures/economic-scenarios.json`):** supply before checkpoint
  `100,000,000e18`, pending mining `1,000,000e18`, denominator after checkpoint `101,000,000e18`, Fund USDG
  `50,000,000.000000` (raw `50000000000000`), redeeming `1,000,000e18` GBX. Payout with the checkpoint is
  `floor(50000000000000 * 1e24 / 1.01e26) = 495,049,504,950` raw USDG. Without the checkpoint it would have been
  `500,000,000,000` — the checkpoint correctly dilutes the redeemer by the miners' accrued-but-unminted GBX.

### FACT-FUND-03 — Redemption checkpoints every Mine slot before taking the denominator

- **Plain-English claim:** Before working out your share, the protocol first credits every miner the GBX they have
  earned but not yet received, so redemptions cannot dilute miners out of the picture.
- **Technical formulation:** `redeem` validates `gbx.minterLocked()`, that `mine` has code, and that
  `IMine(mine).gbx() == address(gbx)`, then calls `IMine(mine).checkpointAll()` before reading `gbx.totalSupply()`.
  The loop is bounded by `MAX_CAPACITY = 16`.
- **Source:** `packages/contracts/src/core/Fund.sol:85-94`
- **Functions/state:** `redeem`, `IMine.checkpointAll`
- **ADR:** ADR 0024 (finding **A-10**)
- **Tests:** `test_RedemptionCheckpointsPendingEmissionBeforeTakingItsDenominator`,
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
- **Tests:** `test_SetResonanceBindsExactlyOnce`, `test_SetResonanceIsOwnerOnly`,
  `test_SetResonanceRejectsZeroAndEOATargets`, `test_ResonanceRouterBindingIsOwnerOnlyValidatedAndSingleUse`,
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
- **Tests:** `test_StakeWaitsUntilResonanceIsBound`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-BIND-03 — The remaining administrative surface is exactly four functions

- **Plain-English claim:** After setup, the only things any privileged party can do are: add a Strategy, retire a
  Strategy, register a Bribe reward token, and add mining slots.
- **Technical formulation:** `onlyOwner` functions in the protocol at this commit:
  `Resonance.addStrategy`, `Resonance.killStrategy`, `Resonance.addBribeReward`, `Resonance.setResonanceRouter`
  (one-time), `Mine.increaseCapacity`, `SignalGBX.setResonance` (one-time), `StrategyFactory.setResonance`
  (one-time), `BribeFactory.setResonance` (one-time). The one-time bindings are consumed during deployment, leaving
  the four continuing actions. `Fund` and `LiquidityPosition` have no owner at all.
- **Source:** `Resonance.sol:247`, `:266`, `:301`, `:312`; `Mine.sol:299`; `Fund.sol:19`; `LiquidityPosition.sol:40`
- **ADR:** ADR 0016, ADR 0017, ADR 0030
- **Tests:** `test_OnlyTheFourExactZeroValueCallsCanBeProposed`, `test_FundHasNoAdministrativeSurfaceLeft`,
  `test_ThePositionHolderHasNoAdministrativeSurfaceLeft`, `test_ApprovedBatchExecutesAllBoundedAdministrationAfterTheTimelock`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** "Setup authority is renounced" is a deployment procedure (FACT-GOV-06), not a contract-enforced fact.

### FACT-BIND-04 — There is no upgrade path, proxy, pause switch, sweep, or migration anywhere

- **Plain-English claim:** No contract in the protocol can be upgraded, paused, drained by an admin, or replaced by a
  successor.
- **Technical formulation:** No contract inherits a proxy, `Initializable`, `UUPSUpgradeable`, or `Pausable`. No
  `delegatecall` appears in `packages/contracts/src`. No function transfers an arbitrary token to an
  administrator-chosen address. No successor, migration, or recovery entry point exists.
- **Source:** whole of `packages/contracts/src`
- **ADR:** ADR 0017, ADR 0016
- **Tests:** `test_FundHasNoAdministrativeSurfaceLeft`, `test_ThePositionHolderHasNoAdministrativeSurfaceLeft`,
  `test_CompoundingAndCallerFundingSurfacesAreGone`, `test_DirectOwnerAndTimelockSchedulingBypassIsClosed`,
  `test_RedemptionIsTheOnlyWayAssetsCanEverLeaveFund`
- **Status:** `implemented`
- **Commit:** `281e601`
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
- **Tests:** `test_StakeRejectsFeeOnTransferUnderlying`, `test_UnstakeRejectsFeeOnTransferUnderlyingAndRestoresReceipt`,
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
  | OpenZeppelin `ERC20`, `ERC20Permit`, `ERC20Votes`, `Ownable`, `ReentrancyGuard`, `SafeERC20`, `Math`, `Governor*`, `TimelockController` | all contracts | Library correctness |
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

### FACT-LIM-03 — Governance snapshot voting does not lock signal

See FACT-SGBX-04. Finding **G-01**, accepted by ADR 0030 but flagged as requiring independent review. `FINDINGS.md` at
`95ed60e` restates the mechanism in ADR 0031 terms: an account may hold or borrow GBX through the snapshot, signal it,
then **withdraw** and still vote with historical weight.

### FACT-LIM-04 — Queued proposals cannot be cancelled

See FACT-GOV-05. Finding **G-02**, accepted by ADR 0030.

### FACT-LIM-05 — Undelegated sGBX can deadlock governance

See FACT-GOV-03. Finding **G-03**, an **open** deployment and parameter gate — not yet accepted. ADR 0031 narrowed
this risk by removing idle sGBX from the quorum denominator, but undelegated signal (and signal committed to killed
Strategies) still inflates quorum without voting.

### FACT-LIM-06 — Capacity expansion temporarily raises aggregate issuance

See FACT-MINE-06. Finding **M-01**, accepted by ADR 0024.

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

### FACT-STATUS-03 — Internal engineering evidence at this commit

- **Claim:** Extensive internal test campaigns exist. They are engineering evidence, not proof and not an audit.
- **Verified at `95ed60e` by running the suites (see [Verified check results](#verified-check-results)):**
  - Default Foundry profile: **335 passed, 0 failed, 0 skipped**, across 22 test suites.
  - Integration Foundry profile: **17 passed, 0 failed, 0 skipped**, across 2 test suites, including real Uniswap v4
    fee harvesting and a 256-run randomized action-sequence fuzz.
  - Both figures **match `FINDINGS.md` at this commit exactly**, unlike the `281e601` state where the register's 322
    had drifted from the actual 339 (discrepancy D-4).
  - Campaign configuration from `packages/contracts/foundry.toml`: `fuzz.runs = 10_000`,
    `invariant.runs = 1_000`, `invariant.depth = 500`, `invariant.fail_on_revert = true`.
  - Composition of the default profile: **21 `testFuzz_` properties** (→ 210,000 configured fuzz cases) and
    **27 `invariant_` properties** plus one deterministic handler-reachability test (→ 500,000 calls per property,
    13,500,000 aggregate state-machine calls).
- **Recorded in `FINDINGS.md` (dated 2026-08-16):**
  - 335 default Foundry tests; integration profile 17 tests.
  - Stateful suite: 27 properties at 1,000 runs × 500 calls (**13.5 million aggregate calls**), all **31 selectors**
    reached ~16,000 times, **zero handler reverts or discards**.
  - **Pinned static analysis now passes:** Slither 0.11.5, Aderyn 0.6.8, Semgrep 1.162.0, Gitleaks 8.30.1, plus
    compiler/size, dependency, and license gates. The exact register accepts **177 current-source findings across 28
    reviewed detector classes**; Semgrep and Gitleaks raw reports contain **zero** findings.
  - **External fuzzing now passes:** native Medusa 1.5.1 completed **101,602 calls** with zero failures across 65
    surfaces; pinned Echidna 2.3.2 completed **100,213 calls** with all **25 properties** passing.
  - **Mutation testing now passes:** the current **43-mutant** focused campaign **killed every mutant**.
  - Mythril 0.24.8 remains incompatible with constructor-resolved immutable/Cancun runtimes and **is not a proof**.
- **This is a substantial evidence upgrade over the `281e601` state**, where static analysis, mutation, and external
  fuzzing were all explicitly _not_ passing.
- **Explicitly historical and excluded:** `AUDIT-BASELINE.md` and `TEST-CAMPAIGN.md` (commit `54e3f2c3`, 2026-08-09,
  "340 passed").
- **Still absent:** independent external audit, compatible symbolic analysis, a second external-fuzzer seed, reviewed
  production parameters, monitored testnet rehearsal, release review, and a signed deployment manifest.
- **Status:** verified at `95ed60e`

### FACT-STATUS-04 — Open release gates

| Finding | Severity | Gate                                                                                                                                    |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| M-03    | High     | Immutable bindings cannot detect a malicious lookalike; requires signed manifest, runtime code hashes, constructor arguments, receipts. |
| M-04    | High     | Exact Mine economic parameters (initial rate, halving amount, tail, multiplier, minimum price) are unselected and unmodeled.            |
| G-03    | High     | Governor voting delay, period, threshold, quorum, and block-time assumptions unresolved; undelegated sGBX can deadlock governance.      |
| G-01    | High     | Short-duration voting power accepted by ADR 0030 but requires independent review of the capture/liveness model.                         |
| E-02    | High     | Reduced but not eliminated; codehash, parameter, and manifest review remains external.                                                  |

Additionally open per `FINDINGS.md` at `95ed60e`: independent audit, a second external-fuzzer seed, legal clearance,
reviewed production parameters, monitored testnet rehearsal, and a signed deployment manifest.

- **Source:** `packages/contracts/audit/FINDINGS.md`, `packages/contracts/audit/SIGNAL-RESONANCE-FINDINGS.md`
- **Status:** verified at `95ed60e`

### FACT-STATUS-05 — Legal and provenance clearance is an unresolved release blocker

- **Claim:** The chain of title for the protocol's upstream code lineage is not resolved, and repository-level
  (BUSL-1.1) and file-level (MIT) license terms are not reconciled.
- **Technical detail:** Active contracts are adaptations of pinned give.fun `ef6ee14a…`, Liquid Signal Governance
  `14b5fbbb…`, and Farplace MineRig `8cf74230…`. `Strategy`'s reverse-Dutch shape has a transitive Euler Fee Flow
  ancestor at `3bee858a…` whose reviewed file is **GPL-2.0-or-later**. Synthetix and Solidly ancestors are named
  without exact repository, commit, or path. `LiquidityPosition` cites a TokenJar concept with no recorded
  repository/commit/path.
- **Source:** `docs/LEGAL-PROVENANCE-BLOCKER.md`, `NOTICE`
- **Status:** `open-gate`, verified at `281e601`
- **Caveats:** Additionally, a separate recorded concern exists regarding the project name and logo deriving from a
  third-party brand. That is outside the scope of these documents and is not propagated in them.

---

## Verified check results

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

### Constant cross-check at `281e601`

| Constant                                          | Source                            | Value                      |
| ------------------------------------------------- | --------------------------------- | -------------------------- |
| `GBX.GENESIS_LIQUIDITY_ALLOCATION`                | `core/GBX.sol`                    | `20_000_000 ether`         |
| `Mine.BPS` / `Mine.PREVIOUS_MINER_BPS`            | `core/Mine.sol`                   | `10_000` / `8_000`         |
| `Mine.PRICE_DECAY_PERIOD`                         | `core/Mine.sol`                   | `1 hours`                  |
| `Mine.MAX_CAPACITY` / `MIN_TAIL_UPS`              | `core/Mine.sol`                   | `16` / `MAX_CAPACITY`      |
| `Mine.MIN_/MAX_PRICE_MULTIPLIER`                  | `core/Mine.sol`                   | `1.1e18` / `3e18`          |
| `Mine.MIN_INITIAL_PRICE` / `MAX_INITIAL_UPS`      | `core/Mine.sol`                   | `1e6` / `1e24`             |
| `Mine.MIN_/MAX_HALVING_AMOUNT`                    | `core/Mine.sol`                   | `1_000 ether` / `1e27`     |
| `Resonance.DURATION` / `REWARD_PRECISION`         | `core/Resonance.sol`              | `7 days` / `1e36`          |
| `Bribe.REWARD_DURATION` / `REWARD_PRECISION`      | `core/Bribe.sol`                  | `7 days` / `1e18`          |
| `Bribe.MAX_REWARD_TOKENS`                         | `core/Bribe.sol`                  | `8`                        |
| `Strategy.MIN_/MAX_EPOCH_DURATION`                | `core/Strategy.sol`               | `1 hours` / `365 days`     |
| `Strategy.ABSOLUTE_MINIMUM_PRICE` / `PRICE_SCALE` | `core/Strategy.sol`               | `1e6` / `1e18`             |
| `ProtocolGovernor.QUORUM_DENOMINATOR`             | `governance/ProtocolGovernor.sol` | `100`                      |
| Governor calldata lengths                         | `governance/ProtocolGovernor.sol` | `4+32`, `4+2·32`, `4+5·32` |

No Solidity, test, deployment, ABI, SDK, subgraph, or application file was modified while producing this registry or
the public documents it supports. `git status` at completion shows only four new untracked directories under `docs/`.

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
`packages/contracts/audit/FINDINGS.md` reports 322 at 2026-08-15. Both predate this commit.
**Resolution used in public documents:** only the count verified at `281e601` is reported as current, and the
historical counts are either omitted or explicitly labelled with their own commit and date.

### D-5 — Timelock role closure is procedural, not enforced

`docs/ACCESS_CONTROL.md`, `docs/INVARIANTS.md`, and `docs/TRUST_ASSUMPTIONS.md` state as invariants that
ProtocolGovernor is the Timelock's only proposer, that the executor is the zero address, and that no external default
admin remains. **No Solidity in this repository enforces any of these**; they are deployment steps 9–10. The
`ProtocolGovernanceFixture` proves the wiring is achievable, not that any deployment achieved it.
**Resolution used in public documents:** always described as an intended deployment configuration that must be proven
by signed deployment evidence, never as a property the code guarantees. See FACT-GOV-06.

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
