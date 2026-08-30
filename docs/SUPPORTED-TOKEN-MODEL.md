# Supported token model

> ADRs 0031, 0035, 0036, 0037, 0047, 0049, 0050, and 0054 define the current token interactions below.

## Canonical and registered tokens

GBX, USDG, Strategy payment tokens, and Bribe reward tokens are supported only when they behave as standard,
non-rebasing ERC-20s:

- a requested transfer debits the sender by the requested amount;
- it credits the receiver by the requested amount;
- `balanceOf`, `approve`, `transfer`, and `transferFrom` follow their conventional semantics;
- balances do not change asynchronously through rebases; and
- token callbacks cannot bypass protocol reentrancy guards or authorization.

Registration is not an adapter or a safety certification. Fee-on-transfer, rebasing, ERC-777-style, blocklisting,
pausable, upgradeable, sticky-allowance, partial-pull, and otherwise adversarial tokens are outside the supported
model. Depending on the path, such a token may revert, underfund a reward schedule, consume unrelated surplus, leave a
residual allowance, or make a market unusable.

SignalGBX is explicitly forbidden as either a Strategy payment token or a Bribe reward token because its transfers are
permanently disabled.

The canonical launcher additionally requires its immutable USDG input to contain code and report exactly six decimals,
then checks decimals again at launch. Mine, Resonance, Router, and Strategy still account in raw units and do not
normalize decimals. The check is a launch-configuration constraint, not a general token adapter or proof that USDG's
code, transfer behavior, value, or administration is safe.

## Transfer-check boundary

The core deliberately uses two transfer-check shapes:

- Canonical GBX/USDG paths in `Mine` and `SignalGBX`, together with `Strategy`, `Resonance`, and
  `Bribe`, use `SafeERC20`. This checks call success and conventional optional return values, but it does not prove
  exact sender and receiver balance deltas. These contracts do not keep fee-token adapters, normalized balances, or
  exact-transfer helper functions.
- `BribeRouter` and `ResonanceRouter` read their complete token balance, approve that amount, and rely on the
  downstream `transferFrom`. They do not compare post-call balances or normalize a residual allowance.
- Caller-selected Fund redemption transfers retain explicit debit/credit checks plus pre-transfer and basket-wide
  retained-balance guards. Fund accepts arbitrary token addresses, so it cannot rely on canonical deployment review.

The launcher transfers exactly `1e6` raw USDG from its authority directly to the newly created Pair and checks the Pair's
raw USDG and GBX balances, reserves, and expected LP supply. It also forwards its complete preexisting USDG balance to
Fund so predictable-address prefunding cannot veto launch. Prefunding at the future ResonanceRouter or Resonance address
retains ordinary direct-donation semantics and does not initialize schedule accounting. These paths do not support
transfer fees, rebases, callbacks, balance aliases, or noncanonical V2 mint math. An unsupported USDG or Pair should
revert the complete launch rather than produce a partially seeded graph.

Router approvals are exact-sized and immediately followed by notification. With an ordinary token, the downstream
pull consumes the allowance completely. The Routers do not clear or inspect the allowance afterward. `Strategy`
does not approve BribeRouter: it transfers the Bribe share directly to the Router. A token that rejects a standalone
zero approval can therefore work when the initial nonzero approval succeeds and is fully consumed; a token whose
allowance behavior leaves a sticky residue is unsupported.

GBX supports ERC-2612 permit approvals for general integrations, but SignalGBX does not consume permit signatures.
Signal additions rely on the caller's existing allowance and `SafeERC20.safeTransferFrom` without inspecting balance
deltas. A smart account may atomically batch GBX approval with direct `addSignal` or `addSignalMany`; a plain externally
owned account without account-level batching establishes allowance separately. SignalGBX deliberately has no ERC-2612
approval permit because it is non-transferable; its signature-based delegation belongs to ERC20Votes governance rather
than token spending.

## Reward precision, floors, and notification limits

Resonance and Bribe use ordinary Synthetix-style whole-unit rates and leftover rollover. A notification during an
active stream combines the new amount with the scheduled remainder and restarts a seven-day schedule at
`floor((amount + remaining) / duration)`. Neither contract stores a front-loaded remainder, successor queue, pause clock,
fractional carry, or Fund reward liability.

Resonance uses a `1e36` revenue-per-signal index, and each Bribe uses a `1e36` reward-per-signal index. The following
amounts remain unallocated surplus in the respective contract rather than becoming liabilities:

- the notification amount omitted by the whole-unit rate floor;
- the global-index division remainder;
- each Strategy's Resonance allocation floor and each Bribe account's reward floor;
- streamed revenue or rewards whose time elapses while active signal weight is zero; and
- direct donations that were never admitted through a notification.

The high-precision index lets a single raw streamed-token unit remain useful at realistic 18-decimal signal weights, but it
does not promise exact conservation or a later path for every fraction.

Each reward token also has a per-Bribe lifetime notification budget of
`floor(type(uint256).max / 1e36)` raw units. The monotonic counter counts accepted notifications, not the current token
balance or direct donations, and claims never restore capacity. A standard 18-decimal token would need about
`1.158e23` whole tokens to exhaust the budget; high-decimal, unusually mintable, or upgradeable tokens can reach the
raw-unit limit with materially less economic value. The cap is checked before checkpointing and token transfer, so an
over-cap attempt leaves the existing stream unchanged and does not prevent claims or scalar/batched signal removal.

## Settlement and failure isolation

Every Strategy purchase snapshots the current global Bribe rate before interacting with the payment token, pulls the
payment, and floors that purchase's Bribe share independently. Strategy transfers the Fund complement directly to
Fund in the purchase transaction and transfers a nonzero Bribe share directly to its paired BribeRouter. There is no
cross-purchase split carry and no deferred Fund liability. A failed Fund transfer therefore reverts the complete
purchase.

BribeRouter is only a payment-token buffer. `route()` is permissionless and notifies its complete balance once
that balance is at least both `REWARD_DURATION` and the paired Bribe's active `remainingReward(paymentToken)`. A failed
notification leaves the tokens in BribeRouter for a later retry. A lifetime-cap failure likewise leaves the buffered
balance there, but the exhausted Bribe cannot admit that token again. A replacement Strategy and Bribe would have a
fresh per-pool lifetime budget. Direct compatible payment-token donations to BribeRouter join its next complete-balance
notification; direct donations to Bribe are not scheduled.

ResonanceRouter applies the analogous threshold
`max(Resonance.REWARD_DURATION(), Resonance.remainingRevenue())` to its complete USDG
balance. Direct compatible USDG donations to the Router join the next notification. Direct USDG donations to
Resonance and stream time elapsed at zero active signal remain unclaimable surplus.

Resonance distribution and Bribe claims record effects before calling a token. A reverting transfer rolls back that
call and preserves the accrued amount for retry. Bribe offers two claim shapes:

- `claimRewards(account)` checkpoints and pays all registered reward tokens atomically; and
- `claimReward(account, token)` isolates one registered token from failures in the others.

Both direct functions authorize only the beneficiary `account` or the Bribe's immutable Resonance and always pay
`account`. `Resonance.claimBribeRewards(strategies)` is the narrow caller-owned cross-Bribe all-token batch: it always
claims for `msg.sender`, accepts only registered live or killed Strategies, permits duplicates that execute
sequentially, and reverts on an empty array. The complete batch is atomic, so an invalid Strategy or failed reward-token
transfer rolls back every earlier entry. Direct scalar `claimReward` remains the bounded gas and broken-token fallback.
`removeSignal` and `removeSignalMany` do not claim Bribe rewards, distribute Resonance revenue, or settle Router
balances, so failures in those token paths do not block signal removal.

## Fund and Mine special cases

Fund is intentionally a permissionless raw-token treasury. Any ERC-20 can be sent to it, but that does not make the
token supported or official. A redeemer chooses which unique non-GBX addresses to include. A broken selected token
reverts the complete redemption, while omitted assets remain permanently for the post-redemption GBX supply. Every
selected address must also retain at least its own snapshotted balance less its payout after the complete basket
transfer, preventing two token facades backed by one shared ledger from consuming the same backing twice.

Mine USDG is isolated through pull accounting. It requests the complete nominal price, retains only outgoing-tenure-miner
claims, and requests transfer of the nominal protocol share to ResonanceRouter. Under the supported standard USDG
model, successful `SafeERC20` calls move those requested amounts; Mine does not prove them with balance snapshots. A
blocked transfer into the Router reverts the paid replacement, but later Router or Resonance failures occur in a separate
transaction and cannot roll it back. A blocked claim recipient does not redirect the claim or block another miner's
claim.

Mine's fixed genesis mint is an issuance exception, not an ERC-20 transfer exception. After reciprocal GBX binding,
the canonical launcher directs exactly `1,000 ether` GBX once to the validated Pair. Mine clears its authority before
calling GBX, and a failed mint rolls back the complete launch. `Mine.totalMined()` remains slot-emission accounting and
does not include this fixed amount.

The launcher always calls Factory `createPair`, never adopts an existing Pair, and never calls Pair `skim`. A
preexisting Pair makes the launcher revert with `PairAlreadyExists`. USDG sent to the not-yet-created deterministic
Pair leaves the lookup zero and instead fails `PAIR_USDG_DEPOSIT` after creation. The operator may abandon the unused launcher and deploy a fresh one whose
caller-scoped CREATE2 outputs yield a different GBX and Pair. All genesis LP is minted to `address(0)`; LP minted later
is an ordinary ERC-20, including when acquired by Fund and selected in redemption.

## Offchain presentation

Official protocol membership comes from Strategies registered in Resonance, not from Fund balances. Frontends and
indexers must:

- label unsolicited Fund and direct reward-contract balances separately;
- allow manual Fund redemption asset-address entry and warn that omissions are forfeited;
- show the fixed sixteen-token Bribe cap and each token's remaining lifetime notification capacity;
- show BribeRouter and ResonanceRouter balances as buffered, not scheduled or claimable;
- apply the live Router threshold before presenting a route as available;
- distinguish the fixed Mine-issued 1,000-GBX genesis amount from `Mine.totalMined`, and distinguish permanently locked
  genesis LP from ordinary later LP;
- display the exact Pair/Factory identities and seed reserves without implying price stability, useful depth, or a
  liquidity guarantee;
- offer beneficiary-authorized direct all-token and scalar Bribe claims plus Resonance's caller-owned Strategy-array
  batch, warning that each all-token path is atomic and that direct scalar claims isolate broken tokens; and
- never present a seventeenth reward token, an over-cap notification, or an unsupported token behavior as valid.
