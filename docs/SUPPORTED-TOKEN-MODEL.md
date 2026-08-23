# Supported token model

> ADRs 0031, 0035, 0036, 0037, and 0047 define the current token interactions below.

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

## Transfer-check boundary

The core deliberately uses two different transfer-check shapes:

- `Strategy`, `Resonance`, and `Bribe` use `SafeERC20`. This checks call success and conventional optional return
  values, but it does not prove exact sender and receiver balance deltas. These contracts do not keep fee-token
  adapters, normalized balances, or exact-transfer helper functions.
- `BribeRouter` and `ResonanceRouter` read their complete token balance, approve that amount, and rely on the
  downstream `transferFrom`. They do not compare post-call balances or normalize a residual allowance.
- Custody-critical `Mine` and `SignalGBX` paths, caller-selected Fund redemption transfers, and canonical
  `LiquidityPosition` fee routing retain their own explicit balance-delta checks where those checks protect a local
  custody or conservation invariant.

Router approvals are exact-sized and immediately followed by notification. With an ordinary token, the downstream
pull consumes the allowance completely. The Routers do not clear or inspect the allowance afterward. `Strategy`
does not approve BribeRouter: it transfers the Bribe share directly to the Router. A token that rejects a standalone
zero approval can therefore work when the initial nonzero approval succeeds and is fully consumed; a token whose
allowance behavior leaves a sticky residue is unsupported.

GBX supports ERC-2612 permit approvals, including the permit attempted by SignalGBX's atomic `signalWithPermit`
workflow. That workflow uses the underlying permit as authorization and still applies SignalGBX's exact GBX custody
check. SignalGBX deliberately has no ERC-2612 approval permit because it is non-transferable; its signature-based
delegation belongs to ERC20Votes governance rather than token spending.

## Reward precision, floors, and notification limits

Resonance and Bribe use ordinary Synthetix-style whole-unit rates and leftover rollover. A notification during an
active stream combines the new amount with `left()` and restarts a seven-day schedule at
`floor((amount + left) / duration)`. Neither contract stores a front-loaded remainder, successor queue, pause clock,
fractional carry, or Fund reward liability.

Both rewarders use a `1e36` reward-per-signal index. The following amounts remain unallocated surplus in the reward
contract rather than becoming liabilities:

- the notification amount omitted by the whole-unit rate floor;
- the global-index division remainder;
- each account's sub-token division remainder;
- rewards whose stream time elapses while active signal supply is zero; and
- direct donations that were never admitted through a notification.

The high-precision index lets a single raw reward unit remain useful at realistic 18-decimal signal supplies, but it
does not promise exact conservation or a later path for every fraction.

Each reward token also has a per-Bribe lifetime notification budget of
`floor(type(uint256).max / 1e36)` raw units. The monotonic counter counts accepted notifications, not the current token
balance or direct donations, and claims never restore capacity. A standard 18-decimal token would need about
`1.158e23` whole tokens to exhaust the budget; high-decimal, unusually mintable, or upgradeable tokens can reach the
raw-unit limit with materially less economic value. The cap is checked before checkpointing and token transfer, so an
over-cap attempt leaves the existing stream unchanged and does not prevent claims, signal movement, or withdrawal.

## Settlement and failure isolation

Every Strategy purchase snapshots the current global Bribe rate before interacting with the payment token, pulls the
payment, and floors that purchase's Bribe share independently. Strategy transfers the Fund complement directly to
Fund in the purchase transaction and transfers a nonzero Bribe share directly to its paired BribeRouter. There is no
cross-purchase split carry and no deferred Fund liability. A failed Fund transfer therefore reverts the complete
purchase.

BribeRouter is only a payment-token buffer. `distribute()` is permissionless and notifies its complete balance once
that balance is at least both `REWARD_DURATION` and the paired Bribe's active `left(paymentToken)`. A failed
notification leaves the tokens in BribeRouter for a later retry. A lifetime-cap failure likewise leaves the buffered
balance there, but the exhausted Bribe cannot admit that token again. A replacement Strategy and Bribe would have a
fresh per-pool lifetime budget. Direct compatible payment-token donations to BribeRouter join its next complete-balance
notification; direct donations to Bribe are not scheduled.

ResonanceRouter applies the analogous threshold `max(Resonance.DURATION(), Resonance.left())` to its complete USDG
balance. Direct compatible USDG donations to the Router join the next notification. Direct USDG donations to
Resonance and stream time elapsed at zero active signal remain unclaimable surplus.

Resonance distribution and Bribe claims record effects before calling a token. A reverting transfer rolls back that
call and preserves the accrued amount for retry. Bribe offers two claim shapes:

- `claimRewards(account)` checkpoints and pays all registered reward tokens atomically; and
- `claimReward(account, token)` isolates one registered token from failures in the others.

There is no caller-selected batch claim. Both functions can be called by anyone but always pay the entitled account.
`withdrawSignal` does not claim Bribe rewards, distribute Resonance revenue, or settle Router balances, so failures in
those token paths do not block signal movement or withdrawal.

## Fund and Mine special cases

Fund is intentionally a permissionless raw-token treasury. Any ERC-20 can be sent to it, but that does not make the
token supported or official. A redeemer chooses which unique non-GBX addresses to include. A broken selected token
reverts the complete redemption, while omitted assets remain permanently for the post-redemption GBX supply. Every
selected address must also retain at least its own snapshotted balance less its payout after the complete basket
transfer, preventing two token facades backed by one shared ledger from consuming the same backing twice.

Mine USDG is isolated through pull accounting. Exact USDG receipt is required at replacement, and the exact protocol
share must reach ResonanceRouter; Mine retains only displaced-miner claims. A blocked transfer into the Router reverts
the paid handoff, but later Router or Resonance failures occur in a separate transaction and cannot roll it back. A
blocked claim recipient does not redirect the claim or block another miner's claim.

## Offchain presentation

Official protocol membership comes from Strategies registered in Resonance, not from Fund balances. Frontends and
indexers must:

- label unsolicited Fund and direct reward-contract balances separately;
- allow manual Fund redemption asset-address entry and warn that omissions are forfeited;
- show the fixed sixteen-token Bribe cap and each token's remaining lifetime notification capacity;
- show BribeRouter and ResonanceRouter balances as buffered, not scheduled or claimable;
- apply the live Router threshold before presenting a distribution as available;
- offer both all-token and scalar Bribe claims, with a warning that the all-token call is atomic; and
- never present a seventeenth reward token, an over-cap notification, or an unsupported token behavior as valid.
