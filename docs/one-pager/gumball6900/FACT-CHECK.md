# One-pager fact-check register

Sheet: `output/pdf/GumBall6900-one-pager.pdf`, built from `docs/one-pager/gumball6900/`.

Production contracts described: `ed2ce84` (`feat: replace fundraiser with immutable multislot mine`),
which introduced `packages/contracts/src/core/Mine.sol` and deleted `Fundraiser.sol`. This edition of
the sheet was rewritten against that commit; the previous edition described the pooled daily
Fundraiser and is superseded in full.

Internal audit register: `packages/contracts/audit/FINDINGS.md`. No audit candidate covers the Mine
redesign - `protocol-facts.mjs` reports `status.auditCandidateCommit` as "none for the Mine redesign",
and the sheet claims no audit of any kind.

Source-of-truth order, inherited from `docs/whitepaper/FACT-CHECK.md`: production Solidity under
`packages/contracts/src/core`, then executable tests, generated ABIs, the independent
TypeScript/Python models, accepted ADRs, audit records, and only then prose. Where sources
disagreed, the Solidity won.

## Verification status legend

- **Verified-onchain** - enforced by production contract code and covered by tests.
- **Verified-model** - arithmetic reproduced independently and matched against the committed
  simulation fixture; the build re-derives it and fails on mismatch.
- **Verified-record** - restates a recorded internal engineering result. Internal evidence, not
  independent assurance.
- **Disclosed-limitation** - a stated risk or open finding, not a guarantee.

The **Enforced** column answers one question: is the claim enforced by onchain code, rather than by
convention, frontend, or documentation? All claims assume the supported-token model
(`docs/SUPPORTED-TOKEN-MODEL.md`) unless stated otherwise.

Every number the sheet prints is imported from `src/facts.mjs`, which re-exports
`docs/whitepaper/src/protocol-facts.mjs`. That module mirrors the named Solidity constants and
cross-checks them against `packages/simulations/fixtures/economic-scenarios.json` on every build; a
mismatch throws before anything is rendered. No figure on this sheet is hand-transcribed.

## 1. The definition, and what goes in and out

| ID   | Exact claim on the sheet                                                 | Source                                                                                                                                                                           | Test / model                                                                                                        | Enforced | Limitation                                                                                                                                                                                                                     | Status           |
| ---- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| H-01 | "An index fund. The people who own it decide what goes in."              | `Resonance.sol` distributes incoming revenue by live signal weight; `Fund.sol` holds the result                                                                                  | `Resonance.t.sol`, `Fund.t.sol`, `Invariants.t.sol`                                                                 | Yes      | "Index fund" describes the shape, not a tracked benchmark. The basket caption carries that correction on the sheet                                                                                                             | Verified-onchain |
| H-02 | "Who it's for: anyone who wants a diversified stake, without a manager." | No allowlist or KYC gate exists on any entry path: `Mine.mine`, `SignalGBX.stake` and `Fund.redeem` are all permissionless; `Resonance` has no manager role over allocation      | `AccessControl.t.sol`; `Mine.t.sol`                                                                                 | Yes      | Contract-level openness only. Legal eligibility is outside the contracts and unresolved. Diversification is an outcome of holder choices, not a guarantee                                                                      | Verified-onchain |
| H-03 | "You hold: GBX: a share of the fund, and a say in what it buys."         | `Fund.redeem` pays pro rata against GBX burned; `SignalGBX.stake` then `Resonance.addSignal` directs                                                                             | `Fund.t.sol`, `SignalGBX.t.sol`, `Resonance.t.sol`                                                                  | Yes      | The "say" requires staking GBX into sGBX first; the sheet shows that as story stage 2. This chip replaced "You put in: dollars, as USDG", which described the removed Fundraiser contribution path                             | Verified-onchain |
| H-04 | "You get back: your share of the real assets, whichever ones you pick."  | `Fund.redeem` transfers a caller-selected subset of raw Fund token balances                                                                                                      | `Fund.t.sol` redemption tests; `previewRedemption` model                                                            | Yes      | "Real assets" means the raw tokens the fund holds, which are themselves third-party issued. It is not a claim of direct ownership of any underlying equity - see the note below                                                | Verified-onchain |
| H-05 | "What's in it: tokenized stocks, ETFs and crypto on Robinhood Chain."    | `packages/config/assets/robinhood.ts` requires deployment-time resolution of AAPL, NVDA, QQQ, SPCX and TSLA through an `official-stock-token-registry`, plus USDG, WETH and wBTC | `packages/config/tests/robinhood-asset-manifest.test.ts`; fixture `robinhood-assets.2026-08-01.json` (chainId 4663) | Partial  | Describes what the fund is built to acquire, not what it holds. No Strategy is registered and the fund holds nothing. Eligibility is set by the timelocked `addStrategy`; `Fund` itself is a permissionless raw-token treasury | Verified-record  |

### On naming real tickers

The sheet prints NVDA, QQQ and TSLA in the signal bar and the basket chart. Three things make
that defensible, and all three are load-bearing:

1. **They are sourced, not invented.** All three are named in
   `packages/config/assets/robinhood.ts` as assets whose token addresses the deployment
   manifest must resolve and verify before release.
2. **They are labelled illustrative, next to where they appear.** The story header reads
   "Illustrative: Mara, the amounts and the mix are invented. Nothing has been bought yet."
   The percentages and the four-round accumulation are hypothetical.
3. **The sheet never claims a holding, a return, or a relationship.** No Strategy has been
   registered, so the fund's balance is zero; nothing on the page says otherwise, and no
   issuer is described as a partner or endorser.

One material distinction the sheet does not spell out, recorded here: a tokenized stock is a
third-party issued ERC-20 whose issuer retains roles including `MINTER_ROLE`, `BLOCKER_ROLE`
and `MULTIPLIER_UPDATER_ROLE` (the last for corporate actions such as splits). Holding one is
not direct ownership of the underlying equity.

## 2. The worked example (Mara)

Mara is invented and the sheet says so on the page, beside the story rather than in a
footnote. The $500 is an illustrative input, not a claim about the protocol.

Stage 1 changed with ADR 0024 and is the most important row in this register. The previous
edition had Mara contribute dollars to the Fundraiser and claim a proportional share of that
day's issuance. That mechanism no longer exists in any form, so the stage was rewritten as a
market purchase rather than restated against the Mine.

| ID   | Exact claim on the sheet                                                                                         | Source                                                                                                                                                                 | Test / model                                                         | Enforced | Limitation                                                                                                                                                                                                                                                                          | Status               |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| S-01 | Setup: "Every fund she finds hands her a finished basket and decides when she can leave."                        | General description of intermediated fund administration. Names no firm and asserts nothing about any identified entity                                                | -                                                                    | n/a      | Framing, not a factual claim about any company                                                                                                                                                                                                                                      | Disclosed-limitation |
| S-02 | 1: "Mara buys $500 of GBX, the token that is both her share and her vote."                                       | No protocol path issues GBX to a payer. GBX is acquired on the market; the canonical venue is the genesis GBX/USDG Uniswap v4 position held by `LiquidityPosition.sol` | `LiquidityPosition.t.sol`; ADR 0014, ADR 0024                        | No       | **Not an onchain guarantee.** The protocol does not undertake to sell GBX, quote a price, or maintain liquidity. Whether $500 of GBX is purchasable at any price is a market outcome. Mining is the only protocol-issued route, and it is a competitive auction, not a subscription | Disclosed-limitation |
| S-03 | 2: "She stakes her GBX for sGBX and assigns it to the assets she wants bought."                                  | `SignalGBX.stake` (1:1, non-transferable), then `Resonance.addSignal` (absolute amounts)                                                                               | `SignalGBX.t.sol`; `Resonance.t.sol`; ADR 0019                       | Yes      | Only unallocated sGBX can be assigned; unallocated sGBX can be unstaked immediately                                                                                                                                                                                                 | Verified-onchain     |
| S-04 | 3: "New dollars follow all holders' assignments. The price falls until a trader is willing to supply the asset." | `Resonance._distribute` splits by weight; `Strategy.currentPrice` decays linearly to zero                                                                              | `Routing.t.sol`, `Strategy.t.sol`; `auctionCurve` model              | Yes      | No oracle. A late fill can clear at or near zero (audit A-05, accepted and disclosed)                                                                                                                                                                                               | Verified-onchain     |
| S-05 | 4: "The asset joins the basket: everything holders have bought so far."                                          | `BribeRouter.payFundPayment` delivers to `Fund`; `Fund` has no owner and no non-redeem exit                                                                            | `BribeRouter.t.sol`, `Fund.t.sol`, `AccessControl.t.sol`; ADR 0021   | Yes      | GBX held by Fund is separately burnable by anyone through `burnGBX`; that removes supply, not backing                                                                                                                                                                               | Verified-onchain     |
| S-06 | 5: "She burns her GBX and takes that exact share of the ones she picks. No desk, no notice."                     | `Fund.redeem`: `floor(balance * gbxAmount / supplyBeforeBurn)` per selected token                                                                                      | `Fund.t.sol`; `previewRedemption` model; SDK `readRedemptionPreview` | Yes      | Redemption is unpausable and needs no approval. Payouts floor per token. `Fund` calls `Mine.checkpointAll` first, so accrued mining supply is in the denominator                                                                                                                    | Verified-onchain     |

## 3. What your share is worth

The band carries one exact proportion and one description of a market, and they are set at
different sizes on the sheet for exactly that reason. W-01 is arithmetic that holds at any
size. W-02 is not arithmetic a reader can rely on, and ends on the sentence that says so.

| ID   | Exact claim on the sheet                                                              | Source                                                                                                                                                         | Test / model                                                                                   | Enforced | Limitation                                                                                                                                                                                            | Status           |
| ---- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| W-01 | Coming out: "Burn 1% of all GBX, get 1% of each asset you pick."                      | `Fund.redeem`: `payouts[i] = mulDiv(IERC20(token).balanceOf(address(this)), gbxAmount, supplyBeforeBurn)`                                                      | `Fund.t.sol` redemption tests; `previewRedemption` model; SDK `readRedemptionPreview`          | Yes      | Floors per token. The denominator is the post-checkpoint, pre-burn total supply, so GBX sitting in Fund counts until someone burns it through `burnGBX`                                               | Verified-onchain |
| W-02 | New GBX: "Mining slots are always for sale"                                           | `Mine.mine` may be called against any index below `capacity` at any time; a slot has no lock or cooldown                                                       | `Mine.t.sol` replacement tests                                                                 | Yes      | "For sale" means replaceable, not that a price is quoted by anyone. After an hour the price is zero and the slot is still replaceable                                                                 | Verified-onchain |
| W-03 | New GBX: "each price falling to zero over 1 hour"                                     | `Mine.PRICE_DECAY_PERIOD = 1 hours`; `_price` decays `initialPrice` linearly to zero                                                                           | `Mine.t.sol` price-decay tests; `economic-scenarios.json` `priceDecaySeconds`                  | Yes      | Linear in elapsed time from `auctionStartedAt`. The next opening price is the paid amount times an immutable multiplier, floored at an immutable minimum                                              | Verified-onchain |
| W-04 | New GBX: "The buyer pays USDG and earns GBX until replaced"                           | `Mine.mine` transfers exactly `paid` USDG; the slot accrues `ups` GBX per second until the next handoff                                                        | `Mine.t.sol`; `Invariants.t.sol`                                                               | Yes      | Accrual is minted at checkpoints, not continuously. The rate is fixed for the tenure and is not changed by a halving, a redemption, or a capacity increase                                            | Verified-onchain |
| W-05 | New GBX: "80% of each payment repays the miner replaced, 20% is what the fund spends" | `Mine.PREVIOUS_MINER_BPS = 8_000`; `_allocatePayment` credits `mulDiv(paid, 8_000, 10_000)` as a pull claim and routes the remainder through `ResonanceRouter` | `Mine.t.sol` split tests; `economic-scenarios.json` `previousMinerBps` / `resonanceRevenueBps` | Yes      | Applies to a **nonempty** slot. A first occupation routes 100%, because no displaced miner exists. Rounding residue goes to the routed side. The 80% is a pull claim through `Mine.claim`, not a push | Verified-onchain |
| W-06 | New GBX: "Nobody is promised a replacement."                                          | Nothing in `Mine` obliges a replacement, guarantees a handoff payment, or bounds a tenure                                                                      | `Mine.t.sol`                                                                                   | Yes      | This is the sentence that keeps the row a description rather than an offer. A miner who is never replaced receives no exit payment at all                                                             | Verified-onchain |

### Why there is no "going in" proportion any more

The previous edition printed two proportions: "put in 5% of a day's dollars, get 5% of that
day's new GBX" alongside the redemption rule. The first was an exact statement of
`Fundraiser.claim`, and ADR 0024 deleted that contract.

Nothing in the Mine replaces it. A payer does not receive a proportional claim on an epoch's
issuance; they receive a slot at a decaying price, an issuance rate fixed for as long as they
hold it, and an uncertain 80% of whatever the next buyer pays. Writing that as a proportion
would be the single easiest way for this sheet to state something false, so the replacement
row is deliberately prose, deliberately smaller than the redemption rule, and deliberately
ends on W-06.

## 4. The reasons strip

Five figures under the heading "Why you'd want in". The three zeros are claims of absence,
so each row below names the code that would have to exist for the claim to be false.

| ID   | Value on the sheet                       | Source                                                                                                                                                                                                                                                                       | Test / model                                                                                                                             | Enforced | Limitation                                                                                                                                                                                                                                                                                                                                 | Status           |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| M-01 | 0% - "Management fee, ever"              | No fee, skim, or team split exists anywhere in `packages/contracts/src/core`. `BribeRouter.routePayment` does `fundPaymentLiability += amount` on the complete payment; `Bribe.notifyRewardAmount` pulls its tokens from `msg.sender`; ADR 0021 removed `Resonance.bribeBps` | `Invariants.t.sol` conservation identities; `BribeRouter.t.sol`; `Bribe.t.sol`; and the build's own `assertNoProtocolFee()` source guard | Yes      | "Fee" means a recurring charge by a manager, and there is none. It is not a claim that participating is costless: users pay gas, and the fund sells USDG through a declining-price auction, so whatever discount a filler captures is a real execution cost (audit A-05). **Mine's 80/20 handoff split is not a fee** - see the note below | Verified-onchain |
| M-02 | 0 - "Team or presale tokens"             | `GBX.sol` constructor mints only `GENESIS_LIQUIDITY_ALLOCATION` to the genesis-liquidity recipient; every later mint requires the permanently locked `Mine`                                                                                                                  | `GBX.t.sol` handover tests; `MiningAuthorityNotFinalized` guard in `Mine`                                                                | Yes      | The 20,000,000 genesis tranche is minted to an address at deployment and its commitment to the locked position is procedural, not enforced by `GBX` itself                                                                                                                                                                                 | Verified-onchain |
| M-03 | 0 - "Lockup or notice period"            | `SignalGBX` has no cooldown or time lock; `Resonance.removeSignal` has none; `Fund.redeem` is unpausable and permissionless                                                                                                                                                  | `SignalGBX.t.sol`; `invariant_EveryActorCanUnstakeItsUnallocatedBalance`; `Fund.t.sol`                                                   | Yes      | sGBX allocated to a Strategy must have its signal removed first, which is itself immediate and uncapped. A **mining slot** is a separate matter: a miner cannot force an exit, because exiting means being replaced                                                                                                                        | Verified-onchain |
| M-04 | 100% - "Of payments reach the fund"      | `BribeRouter.routePayment`: `fundPaymentLiability += amount` for the whole payment                                                                                                                                                                                           | `BribeRouter.t.sol`; `Strategy.t.sol`; ADR 0021; audit A-04                                                                              | Yes      | Scope is a **Strategy payment**: once the fund buys an asset, all of it is the fund's. It is not a claim that 100% of a miner's payment reaches the fund; that share is 20%, and W-05 states it                                                                                                                                            | Verified-onchain |
| M-05 | 20M - "Genesis GBX, locked in liquidity" | `GBX.GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 ether`, minted once in the constructor; `LiquidityPosition.sol` is ownerless, holds the position NFT permanently, and reverts on any principal change (`PrincipalLiquidityChanged`)                                           | `GBX.t.sol`; `LiquidityPosition.t.sol` harvest tests; ADR 0018, ADR 0022                                                                 | Yes      | Two separate facts: the 20M mint is enforced by `GBX`, and the permanence of the position is enforced by `LiquidityPosition`. The **transfer** of the tranche into that position at deployment is procedural. Fee harvesting is permissionless and does not touch principal                                                                | Verified-onchain |

### Why "0% management fee" survives a contract that splits payments 80/20

`Mine` genuinely performs basis-point arithmetic: `PREVIOUS_MINER_BPS = 8_000` of every
nonempty handoff becomes a pull claim for the displaced miner, and the remainder is routed
into Resonance. That is a split, and it is not a fee, because neither leg reaches a team,
a treasury, or any privileged address. One leg repays a user; the other buys assets for the
fund every holder can redeem against.

Because "0%" is a claim of absence, `build.mjs` defends it against the source rather than
trusting this note. `assertNoProtocolFee()` reads all twelve core contracts on every run and
fails the build if `bribeBps`, `setBribeBps`, `feeBps`, `protocolFee`, `managementFee`,
`performanceFee`, `feeRecipient`, `treasuryFee`, `teamFee`, `ownerFee` or `BPS_DENOMINATOR`
appears anywhere, or if `BribeRouter` stops crediting the complete payment to Fund.

The Mine split is allowed in exactly one file and pinned rather than exempted. The guard
requires `PREVIOUS_MINER_BPS = 8_000`, `BPS = 10_000`, and the line
`revenueAmount = paid - previousMinerAmount;` that makes the split exhaustive, and it fails
on any basis-point constant in `Mine.sol` beyond those two. A third share cannot be added
without stopping this build.

## 5. How signaling works

One section, two rows, one causal chain: this round's pooled signal, and what a run of those
rounds accumulates into. Unaffected by ADR 0024 - signals decide where routed dollars go,
whatever brought them in. The tickers are eligible assets from the deployment manifest, not
holdings; the split and the four rounds are invented, and the sheet says so above them.

| ID   | Exact claim on the sheet                                                                         | Source                                                                                                                           | Test / model                                                                                                     | Enforced | Limitation                                                                                                                               | Status           |
| ---- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| G-01 | Lead: "Stake GBX for sGBX, then point it at the assets you want the fund to own."                | `SignalGBX.stake` mints sGBX one-for-one and is non-transferable; `Resonance.addSignal` assigns absolute per-Strategy amounts    | `SignalGBX.t.sol`; `Resonance.t.sol`; ADR 0019                                                                   | Yes      | Only unallocated sGBX can be newly assigned. Which assets are signalable is set by the timelocked `addStrategy`                          | Verified-onchain |
| G-02 | Lead: "What it buys backs your GBX, and you can take your share of it out."                      | Every completed Strategy payment becomes a fixed `Fund` liability; `Fund.redeem` pays each holder pro rata against Fund balances | `BribeRouter.t.sol`, `Fund.t.sol`; ADR 0021; audit A-04                                                          | Yes      | This is the signaler's actual return on signalling: exposure, not a yield. Backing is nominal token balances whose market value can fall | Verified-onchain |
| G-03 | "Every holder's sGBX is pooled, so the next dollar in splits the same way. Move yours any time." | `Resonance._distribute` allocates incoming USDG by each Strategy's share of `totalSignalWeight`; no cooldown or epoch exists     | `Resonance.t.sol`; `Invariants.t.sol` accounting identity; `invariant_EveryActorCanUnstakeItsUnallocatedBalance` | Yes      | Subject to the A-09 carry caveat. Idle sGBX directs nothing and does not dilute active signalers                                         | Verified-onchain |
| G-04 | Accumulation bars are cumulative and never shrink                                                | `Fund` has no sell, swap, or rebalance surface; assets leave only through `redeem`                                               | `Fund.t.sol`; `AccessControl.t.sol`; ADR 0016, ADR 0021                                                          | Yes      | Balances are nominal token amounts. Their market value can fall, and the sheet claims nothing about value                                | Verified-onchain |
| G-05 | The mix shifts between rounds while earlier holdings stay put                                    | `Resonance` acts only on incoming revenue; a changed signal redirects the next distribution, never past ones                     | `Resonance.t.sol`; whitepaper abstract                                                                           | Yes      | The protocol's defining property: the basket is a running sum of past distributions, not a portfolio anyone maintains                    | Verified-onchain |
| G-06 | Caption: "Nothing is sold, so the basket is every round so far."                                 | `Resonance._distribute` (forward-looking only); `Fund.redeem` (the sole outward path)                                            | `Resonance.t.sol`, `Fund.t.sol`; ADR 0021                                                                        | Yes      | GBX held by Fund is separately burnable by anyone; that removes supply, not backing                                                      | Verified-onchain |

## 6. Status

The sheet carries one status line, not a section.

| ID   | Exact claim on the sheet                                               | Source                                                                                                                                 | Enforced | Status          |
| ---- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| T-01 | "Experimental software. Not deployed, and pending independent review." | `protocol-facts.mjs` `status.deployment` and `status.externalAudit`; no signed manifest in `packages/config/deployments`               | n/a      | Verified-record |
| T-02 | "Full detail: docs/WHITEPAPER.md"                                      | The path exists and is the canonical prose behind the generated typeset edition (8 pages at this commit, down from 77 before ADR 0024) | n/a      | Verified-record |

The described commits are recorded in the PDF's Info dictionary rather than on the page:
`pdfinfo` reports `GBXContractsCommit` and `GBXAuditCandidateCommit`.

## 7. Claims considered and deliberately omitted

| Omitted claim                                                       | Why it is not on the sheet                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any token price, market cap, TVL, volume, yield, or return          | None exists. The protocol is not deployed and there is no market                                                                                                                                                                                                                                                                                                           |
| Any Fund holding, asset name, or basket composition                 | No Strategy has ever been registered; Fund holds nothing                                                                                                                                                                                                                                                                                                                   |
| Any deployed address, partner, integration, or user count           | No signed deployment manifest exists                                                                                                                                                                                                                                                                                                                                       |
| Any launch or availability date                                     | No date is set, and release blockers remain open                                                                                                                                                                                                                                                                                                                           |
| "Audited", or any characterisation of internal work as external     | The campaign in `packages/contracts/audit/` is internal engineering review. The build's stale-claim gate blocks the word outright                                                                                                                                                                                                                                          |
| A maximum or lifetime GBX supply                                    | **Newly false.** ADR 0024 removed `MAX_LIFETIME_MINT` with the Fundraiser: `Mine` is a permanent minter whose global rate halves toward a strictly positive tail, so there is no cap to print. The previous edition's fifth metric was exactly this figure. Nine cap-implying phrases are now in `STALE_PHRASES` so it cannot come back by accident                        |
| Mining as the reader's way in (story stage 1)                       | Deliberate editorial choice: the sheet's job is a 30-second explanation for a reader new to crypto, and a reverse-Dutch slot auction is how the fund is supplied rather than how that reader takes part. Mining is explained once, as plumbing, in W-02 to W-06                                                                                                            |
| The exact emission schedule, halving thresholds, and tail rate      | `initialUps`, `halvingAmount`, `tailUps`, `minimumInitialPrice` and `priceMultiplier` are constructor inputs that are **not chosen**. ADR 0024 records them as release blockers pending independent modelling. Printing any of them would invent a parameter                                                                                                               |
| The 16-slot capacity cap, and that capacity can only increase       | True and enforced (`MAX_CAPACITY`, `increaseCapacity`), but it is governance detail for a reader who is not mining. It is on the whitepaper's cover and in its governance ledger                                                                                                                                                                                           |
| The `epochId` / `deadline` / `maximumPrice` caller bounds on `mine` | Real and user-facing, but they protect a miner mid-transaction, and this sheet does not teach anyone to mine. Added to the whitepaper's mining section in this same change                                                                                                                                                                                                 |
| The failure case (a fund token freezes; the redeemer omits it)      | Removed at the owner's direction as a minor detail. The capability is still on the page - stage 5 says "the ones she picks" - and the mechanism remains recorded at S-06 and in `docs/SUPPORTED-TOKEN-MODEL.md`                                                                                                                                                            |
| The risk sentence, open findings, and the printed commit colophon   | Removed at the owner's direction: a teaching sheet is the wrong place for a carry-boundary finding. All remain in the whitepaper and `FINDINGS.md`. What survives is the fact that changes what a reader should do next - that it is not deployed - and the commits stay in the PDF's metadata                                                                             |
| The whole "why this needs crypto rails" section                     | Removed at the owner's direction. Its space went to the basket-formation chart, which teaches the protocol's defining mechanic                                                                                                                                                                                                                                             |
| The vector `brandMark()` on the hero                                | The whitepaper module that defined it was deleted by the ADR 0024 rewrite, and it was not reconstructed. The name and ball device derive from an existing brand whose usage rights are unresolved, and the whitepaper's current cover is likewise set in type. The logo PNG at `apps/web/public/brand/` remains excluded for the same reason: its policy is `unconfigured` |

## 8. Stale claims specifically checked for and absent

The build fails on any of these appearing in the rendered text. The full list is `STALE_PHRASES` and
`NEGATABLE_TERMS` in `build.mjs`; 92 phrases are checked on every run, up from 71 before ADR 0024.

| Stale claim                                                   | Status on this sheet                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fundraiser, contribution mining, contribution window          | Absent. Removed by ADR 0024, and now blocked outright                                                             |
| "A day's dollars" / "that day's new GBX" / daily epochs       | Absent. There are no epochs; a slot clears whenever someone replaces it                                           |
| A maximum, lifetime, fixed or capped GBX supply               | Absent. Nine cap-implying phrases are blocked; the sheet's fifth metric is now the genesis tranche (M-05)         |
| 980,000,000 public distribution capacity                      | Absent. The allocation no longer exists                                                                           |
| 90% Fund / 10% signal rewards from settlement                 | Absent. The sheet prints 100% fund-bound (M-04), which is what ADR 0021 and `BribeRouter` implement               |
| `bribeBps` setter, adjustable acquisition reward              | Absent. Removed by ADR 0021 and guarded by `assertNoProtocolFee()`                                                |
| Relative signal weights, whole-account signal reset           | Absent. Signals are absolute per-Strategy amounts changed by delta, per ADR 0019                                  |
| Fund migration, successor Fund, withdrawable LP NFT           | Absent. Removed by ADR 0017; M-05 states the opposite                                                             |
| GBX tracks NAV, automatic rebalancing                         | Absent. There is no oracle and no NAV concept anywhere in the contracts                                           |
| Guaranteed mining profit, guaranteed replacement              | Absent. W-06 states the opposite in the sheet's own words                                                         |
| "Always profitable", "passive income", "earn while you sleep" | Absent, and newly blocked. Continued issuance under the infinite tail must not be presented as a continued payout |

Three phrases were **removed** from the stale list by this change: `infinite emissions`,
`perpetual emissions` and `never reaches zero`. Under ADR 0024 all three describe the protocol
accurately - the global rate halves toward a strictly positive tail and mining continues
indefinitely - so blocking them would have been a gate against the truth. What replaced them
blocks the inference a reader would draw from them instead.

## 9. How to re-verify

```bash
node docs/one-pager/gumball6900/build.mjs
```

The build refuses to publish unless: the 10 protocol-fact cross-checks pass against the simulation
fixture; 30 colour pairs clear WCAG AA; no fee or unpinned split exists in the 12 core contracts; the
generated stylesheet contains no unresolved value; 92 stale phrases are absent; there are no
unresolved placeholders; punctuation is ASCII; the sheet is at or under 480 words; every band's
content fits its declared height; no text is clipped; no panels overlap; no type is under 7.5pt; the
output is exactly one A4 landscape page; and font programs are embedded.
