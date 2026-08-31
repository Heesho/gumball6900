# GumBall6900 internal fact registry

> Internal working document. This registry is the evidence base for the canonical whitepaper and both websites. It is
> engineering evidence only: it is not an audit, a deployment authorization, a legal
> conclusion, or a claim that the protocol is safe for user funds.

- **Reviewed source state:** post-V12 ADR 0054 development tree; V12 covers only
  `3ae171b997254b56602298d873b3918d1575b3c7` and does not cover the later signal batching/periphery, Resonance
  lifetime-cap, Bribe claim-authorization/batch remediations, or atomic launcher and fixed genesis issuance
- **Historical fact baseline:** `dc67d7c4d634097fa6e285fa33ce964d591d2bd2`
- **Audit revision:** 2026-08-25 tracked intake and independent disposition for the commit-pinned protocol source
- **Registry revision date:** 2026-08-31

> **Revision note.** Earlier drafts of this registry and the former public-document set were written against commits
> `281e601` and then `95ed60e`. Two later changes superseded them. ADR 0033 fixed the Mine at sixteen permanent slots
> with constant-time pending emission, removing capacity governance and the all-slot checkpoint. ADR 0034 deleted
> `ProtocolGovernor` and the protocol `TimelockController` entirely, leaving `Resonance` owned by an external
> governance system that has not been selected; ADR 0035 added the Bribe lifetime reward cap. Those historical
> revisions were re-derived against `dc67d7c`. ADRs 0036-0054 and the current Mine work were subsequently checked
> against successive development trees; V12's export and the current independent disposition target `3ae171b`. Facts
> carrying older commit stamps identify the tree where that unchanged claim was originally verified; later development
> facts retain their explicit development or historical stamp. **Section E was rewritten in full: every
> ProtocolGovernor, Timelock, proposal-lifecycle, quorum, and cancellation fact from earlier editions describes
> contracts that no longer exist.**

> **Canonical-document note.** On 2026-08-31 the separately authored deck, one-pager, explainer article, compact
> whitepaper, and long technical whitepaper were retired. `docs/WHITEPAPER.md` is now the sole whitepaper prose source,
> `output/pdf/GumBall6900-whitepaper.pdf` is its sole generated PDF, and the websites plus retained repository READMEs
> are the other public copy surfaces. The former compact-edition fact-check and reference ledgers are folded into this
> more complete registry: current contract and fixture pins remain in the constant cross-check below, repository and
> external dependencies remain in FACT-EXT-01, and audit/release limitations remain in FACT-STATUS-01 through
> FACT-STATUS-05.

> **Mine-halving revision.** ADR 0041 supersedes the cumulative-mining halving rule in ADR 0024/0033 and the
> `HALVING_AMOUNT` selected by ADR 0038. ADR 0042 sets the current development candidate's provisional 69-day schedule
> and 64 GBX-per-second initial rate; ADR 0043 sets its 1 GBX-per-second tail. This revision is not deployment approval;
> independent economic research remains an open gate.

> **Mine-routing revision.** ADR 0044 makes delivery into ResonanceRouter the terminal Mine revenue action. Mine emits
> `RevenueDeposited` and never calls `route()`; Router forwarding is a later permissionless action with no role,
> bounty, or liveness guarantee.

> **Mine-dependency revision.** ADR 0045 removes Mine's initial constructor-time `Router.usdg()` read. ADR 0055 later
> makes the Router mutable and validates the reciprocal Router, Resonance, SignalGBX, GBX, USDG, and Fund graph on each
> governed change. Pinned bytecode provenance remains a separate deployment obligation.

> **Resonance-accounting revision.** ADR 0046 specializes Resonance's permanently USDG-only stream to scalar revenue
> state and tokenless revenue views. ADR 0047 then restores ordinary Synthetix leftover rollover in Resonance and
> Bribe, removes Bribe queue/pause/carry/Fund-liability accounting and selected-batch claims, moves the payment split
> back into Strategy, and reduces BribeRouter to a Bribe-only buffer. Bribes remain bounded multi-token rewarders.

> **Bribe-cap and move-composition revision.** ADR 0048 raises the fixed append-only Bribe reward-token limit from
> eight to sixteen. It also removed `Resonance.moveSignalFor` and, at the time, composed the public SignalGBX move from
> the retained hooks. ADR 0051 later removes that public move while preserving the absence of a Resonance move hook.

> **Canonical-transfer revision.** ADR 0049 removes sender/receiver balance-delta checks from canonical GBX/USDG
> transfers in Mine and SignalGBX. Those paths use `SafeERC20` under the standard-token assumption.
> Fund retains exact debit/credit and basket guards because redeemers may select arbitrary token addresses.

> **Atomic-launch revision.** ADR 0050 removes the prior canonical liquidity contract and 20 million GBX allocation.
> ADR 0054 partially supersedes its completed-zero-supply and external-bootstrap rules. GBX still constructs at zero
> and Mine remains its sole lifetime issuer; during the canonical atomic launch, Mine issues exactly 1,000 GBX only
> into the pinned Robinhood Uniswap V2 USDG/GBX pair beside exactly 1 USDG. Every genesis LP unit is minted to the zero
> address. GBX and the actual LP are the two initial Strategies. Later LP remains ordinary redeemable Fund backing,
> and no continuing liquidity manager or guarantee exists.

> **Signal-batch and read-periphery revision.** ADR 0051 replaces `signal`, `signalWithPermit`, `moveSignal`, and
> `withdrawSignal` with scalar and batched `addSignal`/`removeSignal` entrypoints. Batches aggregate custody but preserve
> per-allocation events and scalar exit. `SignalPortfolioLens`, SDK helpers, and subgraph positions are replaceable read
> and composition aids; there is no shared write-through signal Router. This delta is outside V12's `3ae171b` scope.

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

| ADR      | Title                                                         | Authoritative for                                                                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 0017 | Remove successor migration; ownerless Fund and LP             | Fund ownerlessness and removal of successor migration remain accepted. LiquidityPosition provisions are superseded by ADR 0050.                                                                                                                                                                                |
| ADR 0024 | Immutable multislot Mine with tenure-locked rates             | Supply model and tenure rate lock. Its cumulative-mining halving model is superseded by ADR 0041; its GBX-ERC20Votes statement by ADR 0030; its capacity, checkpoint, and redemption-denominator decisions by ADR 0033; its synchronous downstream route by ADR 0044; and ownerless-Mine decision by ADR 0055. |
| ADR 0028 | Closed Bribe pools after Strategy death                       | Strategy-death and incumbent-exit consequences remain. Its queue/pause-created terminal-lock analysis is superseded by ADR 0047's continuously advancing stream.                                                                                                                                               |
| ADR 0029 | Bribe-based Resonance reward stream                           | Global Resonance streaming, `1e36` index, and accepted surplus remain. Signal entrypoints/state ownership, final-Strategy kill, ownership, Mine routing, and exact raw scheduling are superseded by later ADRs, most recently ADR 0047.                                                                        |
| ADR 0030 | SignalGBX coordination and selector-bounded token governance  | Non-transferable ERC20Votes sGBX only. Its ProtocolGovernor, Timelock, selector-filter, and cancellation decisions are superseded by ADR 0034; its idle-sGBX and `allocatedBalance` decisions by ADR 0031; its dedicated Resonance move hook by ADR 0048.                                                      |
| ADR 0031 | Mandatory signal-backed SignalGBX                             | No idle sGBX; atomic add/remove backing; `balanceOf` is the aggregate; final live Strategy cannot be killed. Its exact public surface is superseded by ADR 0051, governance dependencies by ADR 0034, and canonical-GBX balance-delta checks by ADR 0049.                                                      |
| ADR 0033 | Fixed Mine slots and constant-time pending emission           | Sixteen permanent slots, no capacity governance, no all-slot checkpoint, constant-time pending emission, and the `effectiveTotalSupply` denominator remain. Its rate-selection rule is superseded by ADR 0041, genesis offset first by ADR 0050 then ADR 0054, and ownerless-Mine decision by ADR 0055.        |
| ADR 0034 | External governance ownership                                 | No core Governor, Timelock, executor, or adapter; external governance remains unselected. ADR 0054 makes three setup-shell renunciations atomic. ADR 0055 adds Mine's narrow continuing authority and makes Mine/Resonance handoff two-step.                                                                   |
| ADR 0035 | Bribe lifetime reward cap                                     | Monotonic per-token `lifetimeRewardNotified` counter; its original `1e18` precision and numeric cap are superseded by ADR 0037.                                                                                                                                                                                |
| ADR 0036 | Bounded dynamic acquisition split                             | Prospective global automatic-Bribe share from 0% through 20%. Its exact weighted carry and deferred-liability settlement are superseded by ADR 0047's per-purchase Strategy split.                                                                                                                             |
| ADR 0037 | High-precision Bribe reward index                             | `1e36` Bribe index and precision-coupled lifetime notification cap remain. Its exact carry and Fund-liability machinery is superseded by ADR 0047; its eight-token bound by ADR 0048.                                                                                                                          |
| ADR 0038 | Fixed Mine economics                                          | Fixed replacement multiplier and starting-price floor. Its initial rate is superseded by ADR 0042, its tail rate by ADR 0043, and its `HALVING_AMOUNT` by ADR 0041.                                                                                                                                            |
| ADR 0039 | Event-only Mine messages                                      | Optional handoff message capped at 280 raw bytes and emitted only in `Mined`.                                                                                                                                                                                                                                  |
| ADR 0040 | Deployment-time Mine authority verification                   | Removal of the per-handoff authority check; deployment evidence must prove the permanent GBX minter binding.                                                                                                                                                                                                   |
| ADR 0041 | Time-based Mine halvings                                      | Deployment-time halving shape, time anchor, tail clamp, and tenure-lock consequences. Its provisional `4 * 365 days` period and 4 GBX/second initial rate are superseded by ADR 0042; its 0.01 GBX/second tail by ADR 0043.                                                                                    |
| ADR 0042 | Provisional accelerated Mine emissions                        | Current provisional 64 GBX/second initial rate and 69-day periods. Its 0.5 GBX/second tail is superseded by ADR 0043. Independent economic review remains open.                                                                                                                                                |
| ADR 0043 | Provisional one-GBX Mine tail                                 | Current provisional 1 GBX/second tail; it begins at the sixth 69-day boundary. Independent economic review remains open.                                                                                                                                                                                       |
| ADR 0044 | Decouple Mine handoffs from revenue routing                   | Mine deposits the nominal protocol share into ResonanceRouter and emits `RevenueDeposited` without calling `route()`. Permissionless routing has no role, bounty, or liveness guarantee; its canonical-USDG balance-delta checks are superseded by ADR 0049.                                                   |
| ADR 0045 | Defer Mine-to-Router token verification to deployment         | Applies to the initial constructor boundary. ADR 0055 later makes Mine's Router mutable and requires reciprocal candidate-graph checks on every governed change. Exact bytecode provenance remains a deployment obligation.                                                                                    |
| ADR 0046 | Specialize Resonance to USDG-only accounting                  | Scalar USDG-only state and tokenless reward views remain. Its preservation of exact raw scheduling is superseded by ADR 0047.                                                                                                                                                                                  |
| ADR 0047 | Restore Synthetix-shaped rewards and Strategy settlement      | Ordinary leftover rollover and floor surplus; continuously advancing Bribe streams; all-token plus scalar claims; direct per-purchase Strategy split; BribeRouter-only buffering; standard-token SafeERC20 model. Its preservation of the eight-token bound is superseded by ADR 0048.                         |
| ADR 0048 | Expand Bribe rewards and compose signal moves                 | Fixed sixteen-token append-only Bribe registry and no dedicated Resonance move hook remain. Its preserved public SignalGBX move is superseded by ADR 0051.                                                                                                                                                     |
| ADR 0049 | Trust canonical token transfers                               | Mine and SignalGBX use `SafeERC20` for canonical GBX/USDG without sender/receiver balance snapshots. Fund's exact selected-token payout and basket guards remain.                                                                                                                                              |
| ADR 0050 | Zero premint and external LP Strategy                         | Removal of the old liquidity contract and 20 million GBX allocation, ordinary fungible-LP Strategy/Fund treatment, and no continuing liquidity management remain. Its completed-zero-supply and fully external bootstrap rules are superseded by ADR 0054.                                                     |
| ADR 0051 | Scalar and batched signal entrypoints                         | Scalar and optional batched `addSignal`/`removeSignal`, aggregate batch custody, no permit/move/write Router, direct smart-wallet composition, and discovery-only read periphery.                                                                                                                              |
| ADR 0052 | Resonance lifetime revenue cap                                | Monotonic precision-coupled fresh-USDG admission bound; cap and active-remainder failures precede checkpointing/token interaction so cumulative-index overflow cannot block signal exits.                                                                                                                      |
| ADR 0053 | Beneficiary-authorized Bribe claims and Resonance batching    | Bribe claims accept only the beneficiary or immutable Resonance; Resonance batches caller-selected registered live/killed Strategy Bribes only for `msg.sender`, with direct scalar-token fallback.                                                                                                            |
| ADR 0054 | Atomic GBX launch and permanently locked genesis V2 liquidity | One-shot authorized Robinhood launcher; fixed Mine-issued 1,000 GBX plus 1 USDG seed; all genesis LP locked at zero; GBX and LP initial Strategies; setup-owner removal. Its ownerless-Mine and direct Resonance handoff details are superseded by ADR 0055.                                                   |
| ADR 0055 | Governed Mine revenue-router migration and two-step ownership | Mine's sole custom owner action changes only future protocol-revenue routing after reciprocal graph checks; Mine and Resonance use Ownable2Step; the launcher begins both handoffs and governance accepts after launch; old graph state does not migrate.                                                      |

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

### Superseded audit documents — removed from the current directory

The former `AUDIT-BASELINE.md`, `TEST-CAMPAIGN.md`, and pre-ADR-0047 Signal/Resonance campaign ledger described
superseded trees. They were removed from the current audit directory on 2026-08-25 and remain recoverable through Git
history. Their counts, including the 340-test figure at `54e3f2c3ce1de25aea4da2f21fab27804a3bfa84`, **must not** be
reported as current. `packages/contracts/audit/FINDINGS.md` now records the independent disposition of the V12 export
for exact source commit `3ae171b997254b56602298d873b3918d1575b3c7`.

**Pinned static analysis, native external fuzzing, and the earlier mutation results are historical.** The pinned
static-analysis and native external-fuzzer campaigns predate substantial current architecture changes. A narrow
49-mutant Signal/Resonance campaign covers ADRs 0036/0037 but predates ADR 0043, and the separate 46/46 campaign
covers ADR 0047 but predates ADR 0048. The focused ADR-0048 campaign killed 47/47 targeted mutants, but it predates
ADR 0049. None of these results is an independent audit or complete production-safety review.

No `Fundraiser.sol` exists in the current source or generated artifact trees. The historical Fundraiser design was
superseded by ADR 0024 and may appear only in material explicitly labeled as design history.

---

# Facts

## A. What GBX is

### FACT-GBX-01 — GBX is a plain transferable ERC-20 with permit and no vote checkpoints

- **Plain-English claim:** GBX is an ordinary transferable token. It can be moved, escrowed through a signal addition,
  and burned, and it supports gasless approvals, but holding GBX alone gives no governance vote.
- **Technical formulation:** `contract GBX is ERC20, ERC20Permit`. Name `"GumBall6900"`, symbol `"GBX"`, 18 decimals
  (inherited default). `ERC20Votes` is **not** inherited, so there are no vote checkpoints and no `delegate` surface.
- **Source:** `packages/contracts/src/core/GBX.sol`
- **Functions/state:** `constructor`, `permit` (via `ERC20Permit`), `transfer`, `approve`
- **ADR:** ADR 0030 (supersedes the ADR 0024 statement that GBX carries ERC20Votes)
- **Tests:** `test_PermitGrantsAllowanceAndCannotBeReplayed`, `test_PermitRejectsExpiredDeadline`,
  `test_ConstructorStartsWithZeroSupply`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Governance weight exists only after GBX is escrowed through SignalGBX (FACT-SGBX-01).

### FACT-GBX-02 — GBX constructs at zero; the canonical graph completes launch with fixed genesis supply

- **Plain-English claim:** The token contract creates no GBX in its constructor. After it permanently binds to Mine,
  the canonical launcher causes exactly 1,000 GBX to be issued solely into the genesis liquidity pair. No team,
  presale, treasury, or discretionary allocation exists.
- **Technical formulation:** The constructor sets only the temporary `minter`; `totalSupply`, `lifetimeMinted`, and
  `lifetimeBurned` all begin at zero. `mint` rejects every caller until the one-time Mine binding is locked. Mine's
  `GENESIS_LIQUIDITY_GBX` is fixed at `1_000 ether`; `mintGenesisLiquidity` is authority-gated, one-time, recipient-code
  gated, and clears its authority. The launcher directs it only to the validated pair.
- **Source:** `packages/contracts/src/core/GBX.sol`; `Mine.sol`; `packages/contracts/src/launch/GBXLauncher.sol`
- **Functions/state:** `constructor`, `lifetimeMinted`, `minter`, `minterLocked`, `mint`, `mintGenesisLiquidity`
- **ADR:** ADR 0050 as partially superseded by ADR 0054
- **Tests:** `test_ConstructorStartsWithZeroSupply`, `test_GenesisLiquidityMintIsFixedOneTimeAndClearsAuthority`,
  `testLaunchBuildsAndFinalizesCanonicalGraph`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0054 development candidate (2026-08-30)
- **Caveats:** `1,000 GBX` is genesis liquidity, not an insider allocation. Canonical post-launch supply is 1,000 GBX
  before mining; constructor supply remains zero.

### FACT-GBX-03 — Supply reconciles exactly as minted minus burned; there is no protocol supply cap

- **Plain-English claim:** Total GBX in existence always equals everything ever created minus everything ever
  destroyed. The contract sets no maximum supply.
- **Technical formulation:** `GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()` holds at every block.
  For a GBX bound to Mine, `GBX.lifetimeMinted() == Mine.totalMined() +
(Mine.genesisLiquidityMinted() ? Mine.GENESIS_LIQUIDITY_GBX() : 0)`. No constant, require, or branch bounds later
  mining issuance.
- **Source:** `packages/contracts/src/core/GBX.sol`; `Mine.sol`
- **Functions/state:** `lifetimeMinted`, `lifetimeBurned`, `mint`, `burn`
- **ADR:** ADR 0024
- **Tests:** `testFuzz_SupplyEqualsLifetimeMintedMinusBurned`, `invariant_GBXSupplyReconcilesWithBurns`,
  `test_GBXSupplyReconcilesContinuousIssuanceAndBurns`, `invariant_MiningPendingAndTpsCachesMatchEverySlot`,
  `echidna_mineIsTheOnlyLifetimeIssuer`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Issuance is bounded by time and rate, not by a cap. With a strictly positive tail rate (FACT-MINE-07),
  supply grows without limit over infinite time. The broad Foundry handler explicitly adds its test-only Mine-
  impersonation mints to the reconciliation; the no-cheat state-machine property asserts the production identity
  directly.

### FACT-GBX-04 — Mint authority is handed to one Mine exactly once and can never be changed again

- **Plain-English claim:** After deployment, exactly one contract can ever create new GBX, and that assignment is
  permanent. There is no way to add, replace, or revoke a minter.
- **Technical formulation:** `setMinter` requires `msg.sender == minter`, reverts if `minterLocked`, rejects zero,
  self, and code-less targets, and requires `IMine(newMinter).gbx() == address(this)`. It then sets
  `minterLocked = true` permanently. `mint` requires both `msg.sender == minter` and `minterLocked == true`.
- **Source:** `packages/contracts/src/core/GBX.sol`
- **Functions/state:** `minter`, `minterLocked`, `setMinter`, `mint`
- **ADR:** ADR 0024, ADR 0017
- **Tests:** `test_MinterHandoverIsOneTimeAndRequiresDeployedCode`, `test_OnlyPermanentlyBoundMineCanMint`,
  `test_BurnTracksCumulativeSupplyDestructionWithoutReopeningHandover`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** The reciprocal check confirms the target _claims_ the same GBX. It cannot distinguish a malicious
  lookalike that returns the expected identity. This is finding M-03, an open release gate (FACT-STATUS-04). Mine does
  not repeat the permanent-authority reads on each replacement; deployment verification is mandatory under ADR 0040.

### FACT-GBX-05 — Anyone may burn their own GBX; burning never reopens mint authority

- **Plain-English claim:** Any holder can permanently destroy their own GBX. Doing so does not unlock minting.
- **Technical formulation:** `burn(uint256 amount)` burns from `msg.sender` only, increments `lifetimeBurned`, and
  touches neither `minter` nor `minterLocked`. Zero is rejected.
- **Source:** `packages/contracts/src/core/GBX.sol`
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
  raw GBX units. A replacement mints only that outgoing slot's amount to `slot.miner`. `tps` means GBX raw token units
  (18 decimals) per second.
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `slot`, `Slot.tps`, `Slot.lastAccruedAt`, `pendingSlotEmission`, `pendingEmission`, `totalMined`
- **ADR:** ADR 0033
- **Tests:** `test_StaggeredSlotsSettleIndependentlyWhileCachedTotalRemainsExact`,
  `test_EffectiveSupplyIncludesPendingEmissionWithoutMintingOrChangingSlots`,
  `invariant_EffectiveSupplyIncludesEveryPendingEmission`, `invariant_MiningPendingAndTpsCachesMatchEverySlot`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** This fact describes ongoing mining, not the separate fixed genesis issuance in FACT-GBX-02.
  `Mine.totalMined` excludes that 1,000 GBX. Mining accrual is _lazy_: it is not minted until that slot's current
  tenure is replaced. `GBX.totalSupply()` therefore understates economic supply between slot settlements;
  `Mine.effectiveTotalSupply()` is the inclusive figure.

### FACT-MINE-02 — Mine has exactly 16 permanent slots

- **Plain-English claim:** The mine opens with sixteen empty slots and the slot count can never change.
- **Technical formulation:** `SLOT_COUNT = 16`; construction initializes every index `0..15`. Mine has no
  capacity-changing function, and its sole custom owner action changes only the future revenue Router.
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
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `PRICE_DECAY_PERIOD`, `currentPrice`, `_price`, `Slot.initialPrice`, `Slot.auctionStartedAt`
- **ADR:** ADR 0024
- **Tests:** `testFuzz_PriceMatchesTheExactLinearFormula`, `testFuzz_PriceIsMonotonicallyNonIncreasingWithinAnEpoch`,
  `test_PriceDecaysLinearlyToZeroAcrossTheEpoch`, `test_PriceStaysAtZeroLongAfterTheEpochEnds`
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** Because `floor` is applied to the subtracted term, `price(e)` is a non-increasing step function, not an
  exact real-valued line. Rounding keeps the payer's quoted price at or above the ideal line; the later 80% outgoing-
  tenure claim is floored independently.

### FACT-MINE-04 — A replacement pays USDG; 80% becomes the outgoing-tenure miner's pull claim and 20% is deposited into ResonanceRouter

- **Plain-English claim:** When you start a new tenure in an occupied slot, 80% of what you pay becomes a claim for the
  outgoing tenure miner
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
  not the outgoing tenure miner, receives the rounding unit. `RevenueDeposited` records the nominal Router deposit; under
  the supported standard-USDG assumption it arrives, but Mine does not prove balance movement. The event does not
  prove same-transaction stream entry. The new tenure miner may be the same address as the outgoing one; there is no
  distinct-address requirement. There is no team fee anywhere in `Mine.sol`.

### FACT-MINE-05 — Outgoing-tenure miner payments are pull claims, permissionless to trigger, always paid to the entitled account

- **Plain-English claim:** An outgoing tenure miner's 80% is held for them to withdraw. Anyone can trigger the withdrawal,
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
  replacements, redemptions, or emission halvings never reduce it.
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
- **Caveats:** Because outgoing tenures keep their assigned rates while later tenures get the halved global rate divided by sixteen,
  aggregate issuance can exceed the current global rate for as long as old-rate tenures remain; turnover is not
  guaranteed.

### FACT-MINE-07 — The global replacement rate halves on deployment-time boundaries down to a strictly positive tail

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
  first period. A replacement immediately before a boundary can lock the older rate for that complete tenure. The tail
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
  Mine also stores the deployment timestamp in immutable `startTime`. It stores immutable USDG and Fund identities and
  a mutable Router. Initial deployment evidence verifies the complete graph; every later Router change must pass ADR
  0055's reciprocal Router, Resonance, SignalGBX, GBX, USDG, and Fund checks.
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
- **Source:** `packages/contracts/src/core/Mine.sol`
- **Functions/state:** `mine`, `Slot.epochId`
- **ADR:** ADR 0024
- **Tests:** `test_ExpectedEpochDeadlineAndMaximumPriceProtectReplacement`, `test_MineAndSlotViewsRejectInvalidInputs`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-MINE-11 — A replacement may emit a bounded message without growing Mine storage

- **Plain-English claim:** A slot payer may attach a short public message to the replacement. It remains in the transaction
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

### FACT-MINE-12 — A Mine replacement never calls the revenue Router

- **Plain-English claim:** Buying a mining slot cannot fail because a later Resonance routing step is broken. Mine's
  job ends after its nominal protocol-share transfer request into ResonanceRouter succeeds.
- **Technical formulation:** `_collectAndDeposit` uses `SafeERC20` for payer → Mine and Mine → ResonanceRouter without
  inspecting balance deltas, emits `RevenueDeposited(index, epochId, revenueAmount)`, and contains no external
  `route()` call. A failed transfer call into ResonanceRouter still reverts the paid replacement.
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
  one or more Strategies happen together in a single indivisible step. sGBX can never be sent to anyone.
- **Technical formulation:** `contract SignalGBX is ERC20, ERC20Votes, ReentrancyGuard, Ownable`; name
  `"SignalGumBall6900"`, symbol `"sGBX"`, 18 decimals. `_update` reverts `TransferDisabled` whenever both `from`
  and `to` are nonzero, permitting only mint and burn. Minting occurs only inside `_depositAndMint`, reached by
  `addSignal` and `addSignalMany`; every minted unit is matched by an immediate `Resonance.addSignalFor` allocation.
  Burning occurs only inside `_burnAndWithdraw`, reached by `removeSignal` and `removeSignalMany` after all matching
  `Resonance.removeSignalFor` calls succeed. Both directions use `SafeERC20` and trust canonical GBX without inspecting
  sender or receiver balance deltas.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `addSignal`, `addSignalMany`, `removeSignal`, `removeSignalMany`, `_depositAndMint`,
  `_burnAndWithdraw`, `_update`
- **ADR:** ADR 0031 (mandatory backing) as modified by ADRs 0049 and 0051
- **Tests:** `test_AddSignalAtomicallyCustodiesMintsDelegatesAndMirrors`,
  `test_AddSignalManyCustodiesAndMintsAggregateWhileMirroringEveryAllocation`,
  `test_RemoveSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying`,
  `test_RemoveSignalManyBurnsAndReturnsAggregateIncludingKilledStrategyPositions`,
  `test_TransfersRemainPermanentlyDisabled`, `invariant_SignalReceiptIsFullyCollateralized`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0051 development candidate (2026-08-26)
- **Caveats:** GBX sent directly to the SignalGBX contract is stranded surplus: it mints no receipt, no signal, no
  withdrawal entitlement, and no votes
  (`test_DirectDonationIsSurplusAndCreatesNoSignalVotesOrWithdrawalEntitlement`).

### FACT-SGBX-02 — sGBX carries ERC20Votes on the block-number clock and self-delegates on first signal

- **Plain-English claim:** Signalled GBX is the protocol's voting power. Your first signal automatically activates your
  vote without a second transaction.
- **Technical formulation:** `SignalGBX` inherits `ERC20Votes` with the OpenZeppelin default `clock()` (block number)
  and `CLOCK_MODE` `mode=blocknumber`. Inside `_depositAndMint`,
  `if (delegates(account) == address(0)) _delegate(account, account)`.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `delegates`, `_delegate`, `getPastVotes`, `getPastTotalSupply`
- **ADR:** ADR 0030 (voting-token decisions), ADR 0031
- **Tests:** `test_LaterSignalPreservesExplicitDelegateAndSelfDelegatesAgainAfterZeroDelegation`,
  `test_DelegateBySigWorksButReceiptHasNoPermitEntrypoint`,
  `test_AddSignalManyCustodiesAndMintsAggregateWhileMirroringEveryAllocation`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** Self-delegation happens only when the account currently has _no_ delegate. An account that explicitly
  delegates to the zero address re-self-delegates on its next signal; an account delegating elsewhere keeps that
  delegate.

### FACT-SGBX-03 — SignalGBX consumes no permit; smart wallets may compose approval with direct calls

- **Plain-English claim:** Adding signal uses an existing GBX allowance. A smart wallet can bundle approval and signal
  in one account transaction; a plain wallet may approve first.
- **Technical formulation:** `SignalGBX` does not inherit `ERC20Permit` and exposes no permit-consuming entrypoint. It
  inherits `EIP712` only for ERC20Votes delegation signatures. `_depositAndMint` relies on the caller's current GBX
  allowance and `SafeERC20.safeTransferFrom`. Because direct smart-wallet calls preserve the wallet as `msg.sender`, an
  account-level batch may call `GBX.approve` followed by `addSignal` or `addSignalMany` without a shared Router.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `addSignal`, `addSignalMany`, `_depositAndMint`
- **ADR:** ADR 0051
- **Tests:** `test_DelegateBySigWorksButReceiptHasNoPermitEntrypoint`, `test_AddSignalRejectsZeroAndMissingAllowance`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0051 development candidate (2026-08-26)
- **Caveats:** GBX itself still supports ERC-2612 for other integrations. A plain externally owned account without
  account-level batching needs an earlier approval transaction.

### FACT-SGBX-04 — There is no lock, cooldown, or epoch restriction

- **Plain-English claim:** You can add or remove signal at any time. Nothing forces you to wait.
- **Technical formulation:** No timestamp, epoch, or cooldown state exists in `SignalGBX.sol`. `removeSignal` is
  bounded only by the caller's recorded position in the selected Strategy's Bribe, enforced by
  `Resonance.removeSignalFor` (`InsufficientSignal`).
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `addSignal`, `addSignalMany`, `removeSignal`, `removeSignalMany`
- **ADR:** ADR 0031, ADR 0051
- **Tests:** `test_RemoveSignalRejectsZeroAndMoreThanTheSelectedPosition`,
  `invariant_EveryActorCanFullyWithdrawSignals`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** This is the mechanism behind governance finding **G-01**: because voting uses historical block
  snapshots and removal is unrestricted, an account can signal across a snapshot, vote with that weight, and remove
  immediately afterwards.

### FACT-SGBX-05 — Mandatory signal-backing: there is no idle sGBX and no separate allocation ledger

- **Plain-English claim:** Every single unit of sGBX in existence is committed to exactly one Strategy at all times.
  There is no "staked but uncommitted" state.
- **Technical formulation:** ADR 0031 removed `allocatedBalance`, `_allocate`, `_deallocate`, and the
  `ISignalGBXAllocation` interface (the file was already deleted in the listed source state).
  `SignalGBX.balanceOf(account)` **is** the account's aggregate signal. Because mint and burn are atomically coupled to
  the matching Bribe virtual-balance change (FACT-SGBX-01), there is no reachable successful state in which a minted
  raw unit is idle or a burned raw unit leaves signal behind.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`; `packages/contracts/src/core/Resonance.sol`
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
  reverts `UnauthorizedSignalSource` unless `msg.sender == address(signalGBX)`. Resonance exposes no move-only hook and
  SignalGBX exposes no public move or shared write-through Router.
- **Source:** `packages/contracts/src/core/Resonance.sol`; `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `onlySignalGBX`, `addSignalFor`, `removeSignalFor`
- **ADR:** ADR 0030 (supersedes ADR 0019's direct Resonance entry points), ADRs 0048 and 0051
- **Tests:** `test_OnlySignalGBXCanMutateAnotherAccountsSignal`, `test_AnAttackerCannotRemoveAnotherAccountsSignal`,
  `test_HostileSignalInputsCannotCreateOrDestroyWeight`, `test_RemovedResonanceMoveHookIsAbsentFromRuntime`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-SIG-02 — Signals are absolute per-Strategy amounts changed by incremental deltas

- **Plain-English claim:** You allocate specific amounts to specific Strategies and adjust them by adding or removing
  amounts. There is no percentage-weight system and no forced whole-account reset.
- **Technical formulation:** The complete user surface is exactly four functions: scalar
  `addSignal(strategy, amount)` and `removeSignal(strategy, amount)`, plus
  `addSignalMany(Allocation[])` and `removeSignalMany(Allocation[])`. Every allocation is an absolute raw sGBX delta.
  Batch adds deposit/mint the aggregate once; batch removals burn/return the aggregate once. Empty or zero-valued
  batches revert, duplicates execute sequentially, and any failed entry reverts the complete batch.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `Allocation`, `addSignal`, `addSignalMany`, `removeSignal`, `removeSignalMany`
- **ADR:** ADR 0019, ADR 0031, **ADR 0051**
- **Tests:** `test_AddSignalAtomicallyCustodiesMintsDelegatesAndMirrors`,
  `test_RemoveSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying`,
  `test_AddSignalManyRollsBackCustodySupplyVotesAndEarlierAllocationWhenLaterAdditionFails`,
  `test_RemoveSignalManyRollsBackEarlierRemovalWhenLaterRemovalFails`,
  `test_AddSignalManyAllowsDuplicateStrategiesAsSequentialAllocations`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0051 development candidate (2026-08-26)
- **Caveats:** Batch length is caller-controlled, so interfaces must simulate and split arrays that do not fit current
  block gas. Scalar removal remains the bounded liveness fallback for each known Strategy key; it cannot discover an
  unknown position key. Reallocating is removal plus addition; smart wallets may compose the direct calls atomically.

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

- **Source:** `packages/contracts/src/core/Resonance.sol`
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
  `totalSignalWeight` and Bribe mutations. Scalar and batch SignalGBX paths use only those hooks. The first batch entry
  advances the global timestamp; later entries in the same transaction observe no elapsed time, so no prior interval
  is reassigned. `_updateRevenue` advances `revenuePerSignalStored` and `lastUpdateTime`, then settles
  `strategyRevenue[strategy]`.
- **Source:** `packages/contracts/src/core/Resonance.sol`; `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `_updateRevenue`, `revenuePerSignal`, `earnedRevenue`
- **ADR:** ADR 0029, ADR 0046, ADR 0051
- **Tests:** `test_FlashSignalWeightCannotRedirectANewNotification`,
  `test_StrategyAddedAfterAccrualCannotClaimHistoricRevenue` (named in FINDINGS.md as the A-11 regression),
  `test_NewStrategyWeightReceivesOnlyPostEntryRevenue`, batch rollback and accounting tests
- **Status:** `implemented`
- **Commit:** `281e601`
- **Caveats:** This prevents _same-transaction_ capture only. A signal held over real elapsed time legitimately earns
  that interval's flow. There is no epoch, cooldown, or anti-churn guarantee.

### FACT-SIG-05 — A newly added Strategy starts at the current index and cannot claim historical revenue

- **Plain-English claim:** A Strategy created today cannot claim revenue that accrued before it existed.
- **Technical formulation:** `addStrategy` sets
  `strategyRevenuePerSignalPaid[strategy] = revenueData.revenuePerSignalStored`.
- **Source:** `packages/contracts/src/core/Resonance.sol`
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
  custom administration is five calls across Mine and Resonance, intended for one external governance executor.
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

### FACT-GOV-02 — Mine and Resonance have the only continuing custom owner authority

- **Plain-English claim:** Resonance retains four continuing protocol actions, and Mine retains one narrow action that
  changes only where future protocol revenue is deposited. SignalGBX, StrategyFactory, and BribeFactory have setup-only
  Ownable shells that the launcher renounces; Fund remains ownerless.
- **Technical formulation:** `Mine` and `Resonance` inherit `Ownable2Step`. Mine's only custom owner-gated function is
  `setResonanceRouter`, which validates a reciprocal replacement graph sharing its immutable GBX, USDG, and Fund.
  Resonance's continuing functions are `addStrategy`, `killStrategy`, `addBribeRewardToken`, and `setBribeBps`; its own
  `setResonanceRouter` is a single-use setup binding. Both continuing owners also inherit two-step transfer, pending-
  transfer replacement/cancellation, acceptance, and immediate renunciation. `SignalGBX`, `StrategyFactory`, and
  `BribeFactory` remain plain `Ownable` but retain no owner-callable custom function after `setResonance` is consumed.
  `Fund`, `Strategy`, and `BribeRouter` are not Ownable. `Bribe.addRewardToken` is gated on immutable Resonance.
- **Source:** `packages/contracts/src/core/Mine.sol`, `Resonance.sol`, `SignalGBX.sol`, `Fund.sol`, `Bribe.sol`
- **Functions/state:** `owner`, `pendingOwner`, `acceptOwnership`, `Mine.setResonanceRouter`, `addStrategy`,
  `killStrategy`, `addBribeRewardToken`, `setBribeBps`, `Resonance.setResonanceRouter`
- **ADR:** ADR 0034, ADR 0054, ADR 0055, ADR 0017 (ownerless Fund)
- **Tests:** `test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`,
  `test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal`,
  `test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe`,
  `test_DefaultBoundsAndOwnerAuthorization`,
  `test_ResonanceRouterBindingIsOwnerOnlyValidatedAndSingleUse`,
  `test_OwnershipTransferRequiresPendingOwnerAcceptanceAndRenunciationClearsIt`,
  `test_SetResonanceRouterIsOwnerOnlyAndRejectsIncompleteOrMismatchedGraphs`,
  `test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority`, `test_FundHasNoAdministrativeSurfaceLeft`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0055 development candidate (2026-08-30)

### FACT-GOV-03 — Owners cannot change mining economics; Mine can redirect only future revenue

- **Plain-English claim:** Governance cannot drain Fund, mint arbitrary GBX, or change Mine's slots, prices, rates,
  halvings, or tail. Resonance may change the later-purchase Bribe share within 0–20%; Mine may redirect only its share
  of future revenue to a structurally consistent replacement graph.
- **Technical formulation:** `Resonance.setBribeBps` is bounded by `MAX_BRIBE_BPS = 2_000` and applies only when a later
  payment is classified. `Mine.setResonanceRouter` changes only the future transfer destination; it moves no old graph
  balance or user position and does not alter mining state. A malicious consistent graph can still steal future
  protocol revenue, so exact bytecode and governance review remain mandatory. `GBX.setMinter` is single-use with
  `minterLocked`. `Fund` exposes only `redeem` and `burnGBX`. Strategy auction parameters are immutable.
- **Source:** `Mine.sol`, `Resonance.sol`, `GBX.sol`, `Fund.sol`, `Strategy.sol`
- **ADR:** ADR 0033, ADR 0036, ADR 0047, ADR 0017, ADR 0050, ADR 0055
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

### FACT-GOV-06 — Voting checkpoints survive signal removal

- **Plain-English claim:** Once a block has passed, the record of what you held at that block is permanent, even if
  you have since removed everything.
- **Technical formulation:** `removeSignal` burns sGBX and writes a new checkpoint, but earlier checkpoints are
  immutable. An account may acquire or borrow GBX, signal it, allow a block to pass, remove, and retain its
  recorded weight at that past block. `SignalGBX` has no lock, cooldown, or epoch.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `removeSignal`, `removeSignalMany`, `_burnAndWithdraw`, `getPastVotes`
- **ADR:** ADR 0034 (§ Consequences), finding G-01
- **Tests:** `test_HistoricalVotingCheckpointsSurviveImmediateSignalRemoval`
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

### FACT-GOV-08 — The launcher begins both two-step handoffs; governance acceptance remains a release obligation

- **Plain-English claim:** A successful launch names the reviewed governance contract as pending owner of Mine and
  Resonance, but governance must separately accept both roles before the handoff is complete.
- **Technical formulation:** `GBXLauncher.launch(finalOwner)` rejects zero, code-less, and self ownership; creates both
  initial Strategies; renounces SignalGBX, StrategyFactory, and BribeFactory ownership; calls `transferOwnership` on
  Mine and Resonance; and verifies that the launcher remains current owner while `finalOwner` is pending owner of both.
  The single-use launcher has no post-launch path to exercise or cancel those roles. Governance must call
  `acceptOwnership()` twice, after which both owners equal governance and both pending owners are zero. Selecting,
  reviewing, and evidencing that executor remains offchain release work.
- **Source:** `packages/contracts/src/launch/GBXLauncher.sol`; `packages/contracts/src/core/Mine.sol`;
  `packages/contracts/src/core/Resonance.sol`
- **ADR:** ADR 0034 and ADR 0054 as superseded for ownership handoff by ADR 0055
- **Tests:** `testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff`,
  `testGovernanceMustAcceptBothPendingOwnershipTransfers`, `testLaunchRejectsInvalidFinalOwnersWithoutConsumingLauncher`
- **Status:** `implemented` pending-handoff structure / `open-gate` acceptance and exact governance identity
- **Commit:** uncommitted ADR 0055 development candidate (2026-08-30)
- **Caveats:** Open High release gates **M-03** (signed manifest proving bytecode, arguments, dependencies, and the
  exact executor) and **G-03** (the integration itself). Reciprocal binding checks and
  ADR 0055's reciprocal replacement-graph checks reject a crossed graph but cannot detect a malicious lookalike that
  returns the expected identities. The narrow setter can move future revenue to another reviewed graph, but it cannot
  recover old balances, positions, claims, or a broken old exit.

### FACT-GOV-09 — Requirements the external governance ADR must satisfy

- **Plain-English claim:** Deployment is blocked until a named list of governance facts is pinned and reviewed.
- **Technical formulation:** ADR 0034 requires a later ADR to pin at least: provider, exact release, deployed
  bytecode, and proxy or upgrade model; plugin set, permission graph, root/admin holders, and any emergency path;
  direct compatibility with SignalGBX voting checkpoints and delegation; proposal creation, quorum, support, voting
  duration, execution, batching, cancellation, and delay semantics; and the exact Mine/Resonance owner address with
  transaction evidence proving both acceptances.
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
- **Source:** `packages/contracts/src/core/Resonance.sol`
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

### FACT-RES-05 — The revenue-per-signal index uses 1e36 precision for intended six-decimal USDG against 18-decimal sGBX

- **Plain-English claim:** Under the intended deployment, USDG is tracked to six decimal places and sGBX to eighteen.
  The internal accounting uses very high precision so tiny allocations are not rounded to nothing. Contracts operate
  only on raw units and do not read or enforce USDG decimals.
- **Technical formulation:** `REWARD_PRECISION = 1e36`.
  `revenuePerSignal += floor(emitted * 1e36 / totalSignalWeight)`, and
  `earnedRevenue = strategyRevenue + floor(activeBalance * (revenuePerSignal - paid) / 1e36)`.
  Fresh lifetime admissions satisfy
  `lifetimeRevenueNotified <= floor(type(uint256).max / REWARD_PRECISION)`.
- **Source:** `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `REWARD_PRECISION`, `revenuePerSignal`, `earnedRevenue`
- **ADR:** ADR 0029, ADR 0047, ADR 0052
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
- **Overflow note:** `Math.mulDiv` computes the intermediate product at 512-bit width, while ADR 0052's monotonic fresh
  admission cap also bounds the cumulative checked addition at the one-raw-signal denominator. Excess notifications
  fail before checkpointing or USDG transfer, rather than relying on a real-world USDG supply assumption.

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
- **Source:** `packages/contracts/src/core/Resonance.sol`; `docs/SECURITY-INVARIANTS.md`
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
- **Source:** `packages/contracts/src/core/Resonance.sol`; `packages/contracts/src/core/StrategyFactory.sol`;
  `packages/contracts/src/core/BribeFactory.sol`
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
- **Source:** `packages/contracts/src/core/Strategy.sol`
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
- **Source:** `packages/contracts/src/core/Strategy.sol`
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
- **Source:** `packages/contracts/src/core/Strategy.sol`
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
- **Technical formulation:** `killStrategy` is `onlyOwner nonReentrant` and explicitly calls
  `_updateRevenue(strategy)` before validating and changing live state. It reverts `FinalLiveStrategy` when
  `liveStrategyCount == 1`, then sets `isStrategyLive[strategy] = false`, decrements
  `liveStrategyCount`, and subtracts the Strategy Bribe's `totalSignalWeight()` from Resonance's
  `totalSignalWeight`. The revenue checkpoint runs first, so accrued whole USDG units are preserved in
  `strategyRevenue`. `earnedRevenue` returns
  `activeBalance = 0` for a dead Strategy, so no further accrual occurs. `addSignalFor` reverts `StrategyAlreadyDead`;
  `removeSignalFor` skips the `totalSignalWeight` decrement for a dead Strategy so the weight is not removed twice.
- **Source:** `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `killStrategy`, `isStrategyLive`, `liveStrategyCount`, `FinalLiveStrategy`,
  `totalSignalWeight`, `earnedRevenue`
- **ADR:** ADR 0028; **ADR 0031** (final-live-Strategy guard, superseding ADR 0029's permission to kill it)
- **Tests:** `test_KillingTheFinalLiveStrategyRevertsAfterBootstrap`,
  `test_RemoveFromKilledStrategyDoesNotDecrementActiveWeightTwice`,
  `test_RemoveSignalManyBurnsAndReturnsAggregateIncludingKilledStrategyPositions`,
  `invariant_DeadStrategiesAreExcludedFromActiveWeight`
- **Status:** `implemented`
- **Commit:** `95ed60e`
- **Caveats:** **At least one live Strategy always exists**, so there is always a valid signal destination. The owner
  replaces the final Strategy by calling `addStrategy(replacement)` before `killStrategy(previous)`; whether those two
  calls can be atomically batched is a property of the external governance system, not of the core.
  This does **not** eliminate the zero-active-weight condition of FACT-RES-06: every signaler removing still drives
  `totalSignalWeight` to zero. A smart-wallet reallocation from a dead Strategy removes without decrementing the already
  excluded weight, then a direct addition adds the amount back into the live denominator.

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
- **Source:** `packages/contracts/src/core/Fund.sol`
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
  payment token. Historical scalar-addition, withdrawal, and composed-move measurements predate ADR 0051. The current
  audit separately measured 16-allocation addition and removal at 1,672,277 and 2,239,499 gas under its fixture. Those
  measurements are engineering evidence, not target deployment guarantees; scalar removal remains available per known
  Strategy key.

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
  instead claim another token by itself. A user may also ask Resonance to claim across several paired Bribes in one
  transaction.
- **Technical formulation:** `claimRewards(account)` checkpoints and attempts every registered token atomically.
  `claimReward(account, token)` checkpoints and pays only one registered token. Both authorize only `account` or the
  Bribe's immutable Resonance and always pay `account`. `Resonance.claimBribeRewards(strategies)` always claims for
  `msg.sender`, validates canonical registered live or killed Strategies, allows sequential duplicates, and rejects an
  empty array. The batch is caller-sized and atomic; direct scalar claiming remains the broken-token and gas fallback.
- **Source:** `packages/contracts/src/core/Bribe.sol`; `packages/contracts/src/core/Resonance.sol`
- **Functions/state:** `claimRewards`, `claimReward`, `claimBribeRewards`, `_claim`
- **ADR:** ADR 0019 as simplified by ADR 0047 and authorization/batching selected by ADR 0053
- **Tests:** `test_AllTokenClaimPaysEachRegisteredRewardToTheEntitledAccount`,
  `test_AllTokenFailureIsAtomicAndScalarClaimsIsolateABrokenToken`,
  `test_ClaimValidationAndEmptyClaimAreHarmless`, `test_ReentrantRewardPayoutCannotDoubleClaim`,
  `test_Regression_ThirdPartyClaimsCannotForceFractionalAccountCheckpoints`,
  `test_OnlyTheBeneficiaryOrResonanceCanInitiateAClaim`, `test_DirectBribeClaimsAreBeneficiaryAuthorized`,
  `test_BatchClaimsCanonicalLiveKilledAndDuplicateStrategyBribesForTheCaller`,
  `test_ContractWalletCanSelfClaimDirectlyAndThroughTheBatchEntrypoint`,
  `test_BatchAlwaysClaimsForTheCallerAndValidatesEveryStrategyAtomically`,
  `test_BrokenTokenRevertsTheBatchWhileDirectScalarClaimsRemainAvailable`, and
  `test_AHostileRewardTokenCannotReenterResonanceBatchClaims`; exact gas tests and receipts are recorded in E-16
- **Status:** `Remediated and internally verified in the working tree; independent closure, deployment authorization,
and user-fund authorization remain pending.`
- **Commit:** `uncommitted`

### FACT-BRIBE-07 — Signal removal never transfers a reward, payment, or revenue token

- **Plain-English claim:** You can always get your escrowed GBX back. Leaving a Strategy is pure accounting — it never
  depends on a token transfer that could fail.
- **Technical formulation:** `Bribe.removeSignalWeight` checkpoints every registered reward under the old account and
  total signal weights, then decrements `totalSignalWeight` and `signalWeightOf`. It contains no token transfer.
  `SignalGBX.removeSignal` or `removeSignalMany`
  then burns the receipt and returns only the account's escrowed GBX. Reward claims remain separate.
- **Source:** `packages/contracts/src/core/Bribe.sol`; `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `removeSignalWeight`, `totalSignalWeight`, `signalWeightOf`
- **ADR:** ADR 0020 (finding **A-04**) as simplified by ADR 0047
- **Tests:** `invariant_EveryActorCanFullyWithdrawSignals`,
  `test_AHostileRewardTokenCannotReenterSignalChanges`,
  `test_ZeroShareDoesNotBrickSignalReallocationOrRemoval`,
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
- **Source:** `packages/contracts/src/core/Fund.sol`
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
- **Source:** `packages/contracts/src/core/Fund.sol`
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
- **Source:** `packages/contracts/src/core/Fund.sol`
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
- **Source:** `packages/contracts/src/core/Fund.sol`
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
- **Source:** `packages/contracts/src/core/Fund.sol`
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

## K. Genesis liquidity and the ordinary LP Strategy

### FACT-LP-01 — The canonical launcher seeds and permanently locks the genesis USDG/GBX V2 liquidity

- **Plain-English claim:** One authorized transaction creates the GBX graph and canonical market, deposits exactly 1
  USDG and 1,000 Mine-issued GBX, and makes the resulting genesis LP permanently non-burnable by any holder.
- **Technical formulation:** `GBXLauncher` is pinned to chain ID 4663 and the reviewed Robinhood Uniswap V2 Factory. It
  always calls `Factory.createPair` for its newly deployed GBX, directs `Mine.mintGenesisLiquidity` to that pair,
  transfers `1e6` raw six-decimal USDG, and calls `pair.mint(address(0))`. The zero address receives the complete
  expected raw LP supply `31_622_776_601_683`; the launcher receives none. The launcher never adopts or skims an
  existing Pair. A nonzero Factory lookup reverts with `PairAlreadyExists`, after which a fresh launcher produces a
  different GBX and Pair through caller-scoped CREATE2 outputs. USDG already held by the predictable launcher is forwarded to Fund, while
  preexisting future Router/Resonance balances retain ordinary donation semantics without initializing a revenue
  schedule.
- **Source:** `packages/contracts/src/launch/GBXLauncher.sol`; `packages/contracts/src/core/Mine.sol`
- **ADR:** ADR 0054
- **Tests:** `testLaunchBuildsAndFinalizesCanonicalGraph`,
  `testPredictableUSDGPrefundingCannotBlockLaunch`,
  `testPrecreatedPairOnlyForcesFreshLauncher`,
  `testCounterfactualPairPrefundingOnlyForcesFreshLauncher`,
  `testLaunchRejectsPairThatDoesNotReportTheOfficialFactory`,
  `testLaunchRejectsAsymmetricFactoryLookup`
- **Status:** `implemented` development candidate
- **Commit:** uncommitted ADR 0054 development candidate (2026-08-30)
- **Caveats:** The lock prevents proportional liquidity removal through an LP burn; swaps can still change reserves.
  It does not guarantee depth, trading availability, USDG value, market price, or venue safety. Exact live
  dependencies and bytecode remain release gates.

### FACT-LP-02 — GBX and the actual LP are the two initial Strategies

- **Plain-English claim:** The initial index targets its own token and the canonical LP token, each through the same
  ordinary Strategy mechanism used for later assets.
- **Technical formulation:** Before ownership handoff, the launcher calls `Resonance.addStrategy` first for GBX and
  then for the obtained pair. Both use a 24-hour epoch and `1.2e18` multiplier. GBX starts and resets at
  `100,000 ether`. LP starts and resets at `50 * pair.totalSupply()`, or `1_581_138_830_084_150` raw LP at genesis.
- **Source:** `packages/contracts/src/launch/GBXLauncher.sol`; `packages/contracts/src/core/Resonance.sol`;
  `Strategy.sol`
- **ADR:** ADR 0054
- **Tests:** `testLaunchBuildsAndFinalizesCanonicalGraph`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0054 development candidate (2026-08-30)
- **Caveats:** These are auction payment quantities derived from the launch ratio, not an oracle or price peg. The
  first epoch decays from deployment and may reach zero before Strategy inventory arrives.

### FACT-LP-03 — Later LP is ordinary redeemable backing; no continuing liquidity manager exists

- **Plain-English claim:** Only the genesis LP is locked. LP created later can become Fund backing and be redeemed just
  like any other non-GBX ERC-20, while no contract manages the pool after launch.
- **Technical formulation:** The LP Strategy uses ordinary per-purchase Fund/Bribe settlement. `Fund.redeem` accepts
  the pair token in the caller-selected asset list. `GBXLauncher` retains no protocol authority, and neither launcher
  nor core exposes liquidity removal, repricing, rebalancing, compounding, harvesting, swapping, or guarantees.
- **Source:** `packages/contracts/src/launch/GBXLauncher.sol`; `packages/contracts/src/core/Strategy.sol`; `Fund.sol`
- **ADR:** ADR 0050 as preserved and narrowed by ADR 0054
- **Tests:** `testLaterMintedFundHeldLPRemainsRedeemable`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0054 development candidate (2026-08-30)

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

### FACT-BIND-02 — SignalGBX cannot accept signal deposits until Resonance is bound

- **Plain-English claim:** Signaling is impossible until the protocol graph is fully wired, so nobody can deposit GBX
  into a half-built signal system.
- **Technical formulation:** Every public scalar or batched add/remove path calls `_configuredResonance()`,
  which reverts `ResonanceNotSet` while `resonance == address(0)`.
- **Source:** `packages/contracts/src/core/SignalGBX.sol`
- **Functions/state:** `_configuredResonance`, `resonance`, `ResonanceNotSet`
- **ADR:** ADR 0030
- **Tests:** `test_AddSignalRequiresBoundResonance`
- **Status:** `implemented`
- **Commit:** `281e601`

### FACT-BIND-03 — The remaining custom administrative surface is exactly five continuing functions

- **Plain-English claim:** After setup, Resonance retains four bounded protocol actions and Mine retains one narrow
  future-revenue Router action. Fund remains ownerless.
- **Technical formulation:** Continuing `onlyOwner` functions in the current source state are
  `Mine.setResonanceRouter`, `Resonance.addStrategy`, `Resonance.killStrategy`, `Resonance.addBribeRewardToken`, and
  `Resonance.setBribeBps`. Setup also consumes `Resonance.setResonanceRouter`, `SignalGBX.setResonance`,
  `StrategyFactory.setResonance`, and `BribeFactory.setResonance`. Mine and Resonance are `Ownable2Step`; the three
  setup shells remain plain `Ownable` and renounce after binding. Fund has no owner.
- **Source:** `Resonance.sol`; `Mine.sol`; `Fund.sol`
- **ADR:** ADR 0016, ADR 0017, ADR 0033, ADR 0034, ADR 0055
- **Tests:** `test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph`,
  `test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal`,
  `test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe`,
  `test_SetResonanceRouterIsOwnerOnlyAndRejectsIncompleteOrMismatchedGraphs`,
  `test_FundHasNoAdministrativeSurfaceLeft`
- **Status:** `implemented`
- **Commit:** uncommitted ADR 0055 development candidate (2026-08-30)
- **Caveats:** Mine and Resonance owners may also use inherited pending transfer, acceptance, cancellation, and immediate
  renunciation. The launcher begins both transfers; governance acceptance and exact executor identity remain deployment
  and signed-evidence obligations (FACT-GOV-08).

### FACT-BIND-04 — There is no upgrade path, proxy, pause switch, sweep, or state migration

- **Plain-English claim:** No contract in the protocol can be upgraded, paused, drained by an admin, or replaced by a
  successor.
- **Technical formulation:** No contract inherits a proxy, `Initializable`, `UUPSUpgradeable`, or `Pausable`. No
  `delegatecall` appears in `packages/contracts/src`. No function transfers an arbitrary token to an
  administrator-chosen address. No successor, migration, or recovery entry point exists. There is also no governance
  machinery of any kind (FACT-GOV-01). Mine's narrow Router setter is a prospective future-revenue cutover, not a
  balance, position, claim, or voting-checkpoint migration; old graph state remains where it was.
- **Source:** whole of `packages/contracts/src`
- **ADR:** ADR 0017, ADR 0016, ADR 0034, ADR 0055
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
  | Canonical Robinhood UniV2 Factory/Pair | `GBXLauncher`; then ordinary `Strategy` and `Fund` paths | Factory/Pair provenance, underlying-token, and liquidity risk |
  | EIP-1153 transient storage (Cancun) | `Fund.redeem` | Target chain must support `tstore`/`tload` |
  There is **no price oracle, NAV calculation, entropy source, or keeper role** anywhere in the protocol.
- **Source:** import statements across `packages/contracts/src`; `docs/TRUST_ASSUMPTIONS.md`
- **ADR:** ADR 0016, ADR 0024, ADR 0050, ADR 0054
- **Tests:** core unit and integration profiles exercise the active dependency paths.
- **Status:** `implemented` / `config-dependent`
- **Commit:** uncommitted ADR 0054 development candidate (2026-08-30)
- **Caveats:** The launcher pins **Robinhood Chain** ID 4663 and the reviewed Uniswap V2 Factory/Router addresses, and
  `packages/config/deployments` holds dated _candidate_ files (for example
  `robinhood-mainnet-wrapped-btc.2026-08-02.candidate.json`). Complete USDG proxy/governance provenance, a fresh
  manifest-bound production rehearsal, receipts, and a signed manifest remain unresolved. One non-broadcast current
  create-only launcher fork rehearsal passed at Robinhood block 50,125,267; the launcher created the Pair from the
  pinned Factory for its newly deployed GBX rather than accepting an arbitrary or preexisting Pair.

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

See FACT-GOV-01. ADR 0034 removed the Governor and Timelock, so an ordinary owner call takes effect in the transaction
that makes it, with no queue. `Ownable2Step` ownership transfers are the narrow observable pending state. Finding
**G-02** (the removed Timelock's uncancellable
queue) is superseded by removal, not proven safe. Whatever protections eventually exist will be properties of the
selected external system.

### FACT-LIM-05 — The external governance system is unselected

See FACT-GOV-08 and FACT-GOV-09. Finding **G-03**, an **open** release gate — not accepted. The protocol's capture
resistance, liveness, delay, and accountability properties are undefined rather than weak. Canonical launch cannot
skip pending-owner assignment, but a noncanonical direct deployment could retain an ordinary admin key and is not the
reviewed graph. Canonical governance must still accept both roles after launch.

### FACT-LIM-06 — Legacy tenures can keep aggregate issuance above the prospective rate

See FACT-MINE-06. Because each tenure's rate is locked until replacement, outgoing tenures keep a pre-halving rate after a
deployment-time boundary is crossed, so aggregate issuance can exceed the current global rate indefinitely if those
tenures do not turn over. Finding **M-01**, accepted by ADR 0033 and retained by ADR 0041.

### FACT-LIM-07 — Miners face rollover risk; there is no guaranteed replacement claim

See FACT-MINE-04. A miner receives the 80% outgoing-tenure claim only if a later replacement clears at a nonzero
price. After the hour elapses the price is zero, so any caller — including the same miner — can replace the tenure
while funding no claim at all. Finding **M-02**, accepted by ADR 0024. Interfaces must not present the replacement
claim as principal, yield, or a
guaranteed refund.

### FACT-LIM-08 — Omitted redemption assets are permanently forfeited

See FACT-FUND-02. There is no partial-claim ledger; omitted assets remain in Fund for the post-redemption supply.

### FACT-LIM-09 — Permanently locked genesis LP guarantees no useful market liquidity

See FACT-LP-01 through FACT-LP-03. Locking the genesis LP prevents proportional liquidity removal through an LP burn,
but swaps can still change reserves. The lock neither proves useful depth nor guarantees trading availability, price
stability, USDG value, later LP supply, or venue safety. No repair or support path exists for a mistaken canonical
seed.

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

### FACT-STATUS-02 — V12 export received; external assurance remains incomplete

- **Claim:** V12 supplied a 22-finding Low-severity export for exact source commit
  `3ae171b997254b56602298d873b3918d1575b3c7`. It lacks an explicit scope, methodology, named auditor, date,
  signature, and report-level validity rationale. Internal revalidation confirmed 249695, 249702, and 249705; the
  export is not release authorization or a complete assurance package.
- **Source:** `packages/contracts/audit/FINDINGS.md`; byte-for-byte raw export under
  `packages/contracts/audit/reports` with SHA-256 recorded in the register.
- **Status:** received and dispositioned on 2026-08-25; remediation and release gates open

### FACT-STATUS-03 — Current post-ADR-0055 internal engineering evidence status

- **Claim:** Extensive local test campaigns exist. They are engineering evidence, not proof and not an audit.
- **Contract evidence for source `3ae171b`, reverified locally on 2026-08-25:** default Foundry passes **293/293**;
  all **27 invariant entries** pass at 1,000 runs of depth 500 with zero handler reverts; integration passes **10/10**;
  and Hardhat passes **4/4**, including bytecode parity. These are local engineering results, not an audit, formal
  proof, deployment approval, or release evidence.
- **ADR-0051 scope boundary:** the renamed scalar selectors, batch loops, aggregate custody, Lens, SDK, and subgraph
  position index are later than `3ae171b`; the V12 export and the results above do not cover them. ADR 0052's Resonance
  cap, ADR 0053's claim authorization/batch, ADR 0054's fixed Mine genesis path and launcher, and ADR 0055's Router and
  ownership changes are later still and likewise outside V12.
- **Pre-ADR-0053 working-tree audit snapshot, 2026-08-30:** the recorded post-ADR-0052 Foundry run passed **358/358**
  across 29 suites. All **30 invariant properties** passed at 1,000 runs of depth 500, totaling 15,000,000 handler calls
  with zero reverts or discards; both deterministic reachability harness tests also passed, and all 31 selectors were
  reached. Integration passed **10/10** and Hardhat passed **4/4**. The focused mutation campaign
  killed **59/59** mutants. Medusa 1.5.1 passed all **26 properties and 44 assertions** over 100,669 calls, 3,430
  branches, and corpus 90. All are internal engineering evidence, not independent assurance, and none verifies the
  later ADR 0053 delta.
- **Post-ADR-0053 internal verification, 2026-08-30:** Foundry passed **367/367** across 29 suites in 1,806.00
  seconds. `ProtocolInvariantsTest` passed **32/32 total tests**: 30 invariant properties at 1,000 runs × 500 depth
  (500,000 handler calls per property) plus two deterministic reachability tests. The invariant campaign reached all 31
  selectors with zero reverts/discards. Hardhat passed **4/4** with bytecode parity; integration passed **10/10** at 256
  fuzz runs; the corrected mutation campaign test-killed **70/70** with zero survivors/errors; and the applicable SDK,
  subgraph, documentation, simulation, web E2E, lint, typecheck, build, Forge formatting, and build-size checks passed.
  The final root `pnpm test` rerun passed **9/9 Turbo tasks** in 27m2.477s, including Foundry **367/367** across 29 suites.
  Exact gas receipts and limitations are in the audit bundle's E-16. These results predate ADR 0054. The
  repository-wide format gate remains open.
- **Historical pre-create-only ADR-0054 internal contract validation, 2026-08-30:** non-invariant Forge passed **354/354
  across 29 suites**.
  `ProtocolInvariantsTest` passed **32/32**: 30 invariant properties at 1,000 runs × 500 depth plus two deterministic
  reachability tests, totaling 15,000,000 aggregate handler calls with zero reverts in **1,357.63 seconds**. The
  configured composite Forge evidence was **386/386**. Focused launcher and Mine suites passed **16/16** and
  **24/24** respectively; Hardhat passed **4/4**, and integration passed **10/10** at 256 fuzz runs. `GBXLauncher`
  runtime is **23,676 bytes**, leaving **900 bytes** below EIP-170. These are internal engineering results, not
  independent assurance. The final root `pnpm test` rerun passed **9/9 Turbo tasks in 21m21.089s**; its Forge task
  passed **386/386 across 30 suites in 1,280.39 seconds** against the then-current production Solidity bytecode. The
  later create-only launcher simplification changed production bytecode, so this matrix and root run remain historical
  and do not cover current source.
- **Historical pre-ADR-0055 create-only launcher validation, 2026-08-30:** the focused launcher suite passed **16/16**, and
  non-invariant Foundry passed **354/354 across 29 suites**. `GBXLauncher` runtime is **22,762 bytes**, leaving **1,814
  bytes** below EIP-170. SDK validation passed **53/53**, typecheck, and ABI generation/check. Invariants were not rerun because the
  production change was confined to the launcher; the older invariant receipt is not presented as current-source
  coverage. ADR 0055 later changed Mine, Resonance, the launcher handoff, ABIs, and operations, so this receipt is no
  longer current-source coverage.
- **Historical pre-create-only ADR-0054 pinned launcher fork, 2026-08-30:** **1/1 passed** at Robinhood block
  **50,125,267**
  (`0x98c12175a4f9e303ef8c1e0ed2af91371df5210f1ce1c34217cfce2ad183020b`, timestamp
  `2026-08-30T15:44:01Z`) against the real USDG and Factory-created Pair. Isolated launch gas was **22,862,200**, leaving
  **9,137,800** gas below the separately observed mutable 32,000,000 target ceiling. The complete test used
  **41,603,390** gas because it also deployed its modules, launcher, and governance fixture outside the isolated call.
  That receipt does not cover the current create-only launcher bytecode.
- **Historical pre-ADR-0055 create-only pinned launcher fork, 2026-08-30:** **1/1 passed** at the same Robinhood block, hash, and
  timestamp. Isolated launch gas was **22,853,567**, leaving **9,146,433** gas below the separately observed mutable
  32,000,000 target ceiling. The complete fixture-bearing test used **41,411,361** gas. USDG was cheatcode-funded and
  governance was a code-bearing stand-in, so this is non-broadcast engineering evidence, not a receipt or release
  authorization. It does not cover ADR 0055.
- **Latest analyzer boundary (not rerun after the create-only launcher or ADR-0055 changes):** Slither 0.11.5, Aderyn 0.6.8, Semgrep
  1.162.0, and Gitleaks 8.30.1 completed, but the
  integrated static policy remains red because the disposition register expired and the Aderyn
  `missing-inheritance` rationale covers 56 registered instances versus 105 current instances. The local Echidna
  2.3.3 attempt is invalid because every worker crashed in `Set.elemAt` before any of 26 properties or fuzz calls ran;
  pinned 2.3.2 could not run without Docker. Mythril remains incompatible with the current immutable/Cancun-opcode
  graph. No formal proof is claimed.
- **Timestamp-boundary classification:** Foundry can model `uint256` Mine/effective-supply overflow with an enormous
  warp, but the pinned Robinhood Nitro/OffchainLabs target encodes header time as `uint64` and cannot supply the
  required approximately `5.733e49` years. That test is a defensive counterfactual, not a confirmed target-reachable
  finding. SignalGBX's separate default `uint48` block-number clock horizon remains.
- **Earlier focused evidence, verified locally on 2026-08-23 before ADR 0049:** the ADR-0048 migration suites pass **104/104** and the
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
- **Still absent:** a clean repository-wide format gate, a valid current-tree Echidna campaign, a second independently
  seeded external-fuzzer campaign,
  compatible symbolic analysis, closure of the red static-policy
  register, complete external-audit closure and retesting, independent review of the provisional Mine economics,
  external-governance integration review, ADR-0055 replacement-graph and dual-handoff review, monitored testnet
  rehearsal, production deployment evidence, a fresh manifest-bound target-state rehearsal, release review, and a
  signed deployment manifest.
- **Status:** the create-only focused launcher, non-invariant Foundry, SDK, and pinned launcher-fork evidence are
  preserved as pre-ADR-0055 history. Current invariant and root-workspace receipts are not recorded here, and all
  external/release gates remain open. V12 remains pinned to `3ae171b` and does not cover ADRs 0051-0055.

### FACT-STATUS-04 — Open release gates

| Finding    | Severity | Gate                                                                                                                                                                    |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-03       | High     | Immutable bindings cannot detect a malicious lookalike; requires signed manifest, runtime code hashes, constructor arguments, receipts.                                 |
| M-04       | High     | Mine economics are selected, hard-coded, and modelled, but still require independent economic review before deployment.                                                 |
| G-03       | High     | The external governance system that will own Mine and Resonance is unselected; its voting, delegation, permission, acceptance, and delay semantics are unreviewed.      |
| G-01       | High     | sGBX checkpoints survive removal; the selected external system's snapshot-to-vote spacing requires independent review of the capture model.                             |
| E-02       | High     | Reduced but not eliminated; codehash, parameter, and manifest review remains external.                                                                                  |
| V12-249702 | Low      | ADR 0054's single transaction removes the canonical pre-handoff interaction window; the later remediation still requires independent closure and exact launch evidence. |
| V12-249705 | Low      | ADR 0053 remediates and internally verifies outsider-selected Bribe claim cadence in the working tree; fresh independent closure remains required.                      |

V12-249695 was reproduced against the current public graph and remediated in the development tree by ADR 0052. The
precision-coupled lifetime cap and its generated consumers still require fresh independent review; V12 covers only the
earlier vulnerable commit.

CEX-09 remains a documented, maintainer-accepted copy risk under ADR 0059 rather than an open remediation gate. The
retired deck is no longer an active surface; the landing and web wording remains intentionally unchanged, while Fund
itself continues to enforce caller-selected redemption and permanent forfeiture of omitted shares.

Additionally open in the current post-ADR-0055 source state: the unrelated repository-wide format gate, fresh
independent review of the claim authorization, Resonance batch, Mine genesis path, launcher, Router migration,
ownership transitions, and old/new graph operations; complete
external-audit closure; closure of
the red static-policy register, a valid current-tree Echidna campaign, a second valid external-fuzzer seed, compatible
symbolic analysis, legal clearance, reviewed production parameters, exact external-governance integration review,
monitored testnet rehearsal, production deployment evidence beyond the historical pinned launcher fork pass,
a fresh manifest-bound target-state rehearsal, and a signed deployment manifest. The historical pre-ADR-0053 Medusa
pass and current focused/non-invariant deterministic passes do not close those release gates.

- **Source:** `packages/contracts/audit/FINDINGS.md`, `packages/contracts/audit/RELEASE-CHECKLIST.md`,
  `packages/contracts/audit/codex-exitability-2026-08-29-f991253/FINDINGS.md`
- **Status:** open gates carried forward into the current post-ADR-0055 development state

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
| GBX constructor supply                                  | `core/GBX.sol`       | `0`                          |
| Canonical completed-launch GBX supply before mining     | `core/Mine.sol`      | `1,000 ether`                |
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

### D-3 — Historical `Fundraiser` design

The Fundraiser design was superseded by ADR 0024, and no `Fundraiser.sol` exists in either the current source tree or
the generated artifact trees. **Resolution:** retain Fundraiser references only where they are explicitly labeled as
historical design context; never present a Fundraiser as part of the current protocol.

### D-4 — Test count drift between documents

The deleted historical `TEST-CAMPAIGN.md` reported 340 default Foundry tests at commit `54e3f2c3` (2026-08-09).
The earlier finding register reported 322 at 2026-08-15; the pre-ADR-0034 campaign recorded 335 default and
17 integration. All predate the current source state.
**Resolution used in public documents:** the ADR 0044 uncommitted tree independently passed 356 default and 19
integration tests, and the distinct ADR 0042 tree happened to record the same totals. Both are historical evidence.
The immediately preceding ADR-0047 development tree separately passed 312/312 Foundry tests across 23 suites, 29
invariant entries at 1,000 runs of depth 500 with zero handler reverts, and 21/21 integration tests. Those results
predate ADR 0048. The focused ADR-0048 migration suites passed 104/104 and its targeted mutation campaign killed
47/47 mutants. The post-ADR-0050 contract source at `3ae171b` passes 293/293 default Foundry tests, all 27 invariant
entries at 1,000 runs of depth 500 with zero handler reverts, 10/10 integration tests, and 4/4 Hardhat tests including
parity. The 2026-08-30 post-ADR-0052 snapshot passed 358/358 Foundry tests across 29 suites. All 30 invariant properties
ran at 1,000 runs of depth 500, totaling 15,000,000 handler calls with zero reverts or discards; both deterministic
reachability harness tests also passed, and all 31 selectors were reached. That snapshot's targeted mutation campaign
killed 59/59 mutants, and its Medusa campaign passed 70/70 properties/assertions. The later post-ADR-0053 campaign
passed 367/367 Foundry tests. The historical pre-create-only ADR-0054 validation then passed 354/354 non-invariant Forge
tests across 29 suites and 32/32 invariant-suite tests, for composite configured Forge evidence of 386/386; focused
launcher and Mine suites passed 16/16 and 24/24, Hardhat passed 4/4, and integration passed 10/10 at 256 fuzz runs. Its
final root `pnpm test` run passed 9/9 Turbo tasks in 21m21.089s, with Forge 386/386 across 30 suites in 1,280.39 seconds.
The later create-only launcher simplification changed production bytecode, so those receipts are historical. Current
create-only evidence is 16/16 focused launcher tests, 354/354 non-invariant Foundry tests across 29 suites, a 22,762-byte
launcher with 1,814 bytes of EIP-170 margin, and SDK 53/53 plus typecheck and ABI generation/check. Invariants were not rerun because
the production delta was launcher-only. These remain local engineering results, not independent audit or release
evidence; external release gates remain open.

### D-5 — Pending ownership handoff is enforced; acceptance and exact governance identity remain procedural

`docs/ACCESS_CONTROL.md`, `docs/INVARIANTS.md`, and `docs/TRUST_ASSUMPTIONS.md` state ownership and administrator
conditions as invariants. ADR 0055's canonical launcher enforces the launch-time part atomically: it renounces the three
consumed setup shells and verifies that the supplied contract is pending owner of both Mine and Resonance while the
launcher remains current owner. It cannot accept on governance's behalf or prove that the supplied contract is the
intended independently reviewed executor. **Resolution used in public documents:** distinguish contract-enforced
pending-owner state from the still-procedural dual acceptance, governance selection, provenance, receipts, and signed-
manifest obligations. See FACT-GOV-08.

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
