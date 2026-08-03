# External state-machine fuzzing

`audit/harness/ProtocolStateMachineCampaign.sol` is the common Echidna and Medusa target. It lives outside Foundry's
default source roots because its test-only constructor embeds the complete topology's creation code and intentionally
exceeds the deployable initcode limit. It contains no Forge test inheritance, cheatcode address, `vm` call, mocked
external call, FFI, or direct storage mutation. Two persistent
actor contracts make every holder-facing call, while each fuzzer advances block timestamps between transactions to
exercise the one-day signal delay and auction-expiry boundary.

## Production surface exercised

The campaign deploys and composes the production `GBXToken`, `AssetRegistry`, `AllocationVoter`, `StakedGBX`,
`GumBallVault`, `AcquisitionStrategy`, `ManagerRewards`, and `BuybackBurnStrategy`. The actor sequence covers:

- controller-bound GBX minting, direct holder burns, transfers, staking, immediate unstaking, delayed one- and
  two-strategy signals, checkpointing, cancellation, and reset;
- physical USDG deposits through all four prebound revenue-source enum slots, lazy strategy-budget checkpointing, and
  budget consumption;
- acquisition fills with exact observed target receipt, 98/2 vault/manager delivery, zero-weight redirection, physical
  USDG release, and manager reward claims;
- buyback fills with an affordable bounded lot, a real GBX balance transfer and burn, unchanged cumulative minting,
  exact cumulative-burn growth, and physical USDG release;
- in-kind redemption of both registered assets from balances snapshotted before the GBX burn, including proportional
  virtual-budget scaling; and
- unsolicited target-token backing donations so redemption ratios are not coupled only to auction output.

The public `successfulActions(bytes32)` and `actionAmounts(bytes32)` ghost mappings distinguish every successful
action and its cumulative amount; the additional `acquired-target` and `buyback-burn` amount keys preserve both sides
of those fills. Echidna coverage artifacts and Medusa's corpus should be reviewed with these counters; a property-only
pass without successful fill and redemption transitions is insufficient campaign evidence.

## Properties

Both fuzzers run the same eight `echidna_` properties over 100,000 calls and 150-call sequences:

1. lifetime cumulative minting never exceeds one billion GBX;
2. total supply always equals cumulative minting minus cumulative burning;
3. all campaign GBX remains in the two actors or the canonical staking escrow;
4. sGBX supply equals escrowed GBX exactly, and all sGBX belongs to the two actors;
5. each actor's active plus pending weight is bounded by stake, while per-actor and per-strategy active-weight sums are
   exact;
6. actionable acquisition and buyback preview budgets never exceed accounted USDG; those previews plus idle USDG
   never exceed physical vault USDG; and accounted USDG never exceeds that same physical balance;
7. `ManagerRewards.accountedRewards` equals its physical target-token balance; and
8. transition snapshots detect any stake escrow drift, acquisition split or budget drift, buyback burn/order drift,
   reward-liability drift, or deviation from pre-burn pro-rata redemption math.

## Deliberate limits

- USDG and the target are plain mintable ERC-20 test tokens. Fee-on-transfer, rebasing, callback, payer-surcharge, and
  malformed-return behavior remain in the adversarial Foundry suites; this campaign focuses on coupled protocol state.
- Because the plain USDG receiver has no callback, the buyback property proves the strongest atomic postcondition:
  cumulative burning and supply move by the exact received GBX, the strategy retains zero GBX, and USDG custody moves
  exactly. The dedicated adversarial callback test independently observes that the burn completes before receiver
  execution, so the external campaign does not claim a second temporal observation it cannot make.
- The basket contains USDG and one normal acquisition target, plus the standalone buyback. Stock-token multiplier
  changes, sixteen-asset iteration bounds, mining/genesis claims, Uniswap v4 liquidity, and typed timelock scheduling
  remain covered by their dedicated invariant, integration, fuzz, and unit suites.
- Authorities are the campaign contract because delayed administrative execution is not the property under test. The
  campaign does not expose actions that disable strategies or pause fills, so generation reset and guardian recovery
  remain dedicated-suite responsibilities.
- Medusa's contract-size check is disabled only for this test target because its constructor embeds creation code for
  the complete composed topology. The deployed campaign runtime remains below EIP-170, and production contract sizes
  continue to be enforced independently by `forge build --sizes`; this setting is not deployment evidence.
- The deterministic Foundry smoke test uses `vm.warp` only outside the campaign to prove a representative delayed
  sequence. The Solidity target consumed by Echidna and Medusa remains cheatcode-free.
