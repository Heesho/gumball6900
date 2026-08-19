# Supported token model

> ADRs 0031, 0032, and 0035 define the target token interactions below.

## Canonical and registered tokens

GBX, USDG, Strategy payment tokens, and Bribe reward tokens are supported only when they behave as standard,
non-rebasing ERC-20s:

- a requested transfer debits the sender by exactly the requested amount;
- it credits the receiver by exactly the requested amount;
- `balanceOf`, `approve`, `transfer`, and `transferFrom` follow their conventional semantics;
- balances do not change asynchronously through rebases;
- token callbacks cannot bypass protocol reentrancy guards or authorization.

Core mining payment, receipt, reward, revenue, redemption, and liquidity-fee-routing paths compare balance deltas and revert
atomically on inexact movement. This is fail-closed evidence, not support for fee-on-transfer, rebasing, ERC-777-style,
blocklisting, pausable, or otherwise adversarial tokens.

Token decimals affect the economic size of accounting floors. Resonance's six-decimal USDG index uses `1e36` precision,
but its global-index and per-Strategy remainders are accepted surplus rather than Fund liabilities. Bribes use `1e18`
precision and still assign unindexable old-denominator carry to Fund before changing virtual signal supply. Low-decimal
Bribe rewards can therefore create a larger whole-token Fund liability at a boundary, but cannot transfer pre-entry
carry to a later signaler.

Each reward token also has a per-Bribe lifetime notification budget of
`floor(type(uint256).max / 1e18)` raw units. The monotonic counter counts accepted notifications, not the current token
balance or direct donations, and claims never restore capacity. A standard 18-decimal token would need about
`1.158e41` whole tokens to exhaust the budget; high-decimal, unusually mintable, or upgradeable tokens can reach the
raw-unit limit with materially less economic value. The cap is checked before checkpointing and token transfer, so an
over-cap attempt leaves the existing stream unchanged and does not prevent signal movement or withdrawal.

SignalGBX is explicitly forbidden as a Strategy payment or Bribe reward token because its transfers are permanently
disabled. Tokens that reject zero approvals remain usable when the exact allowance is fully consumed; if a token
under-consumes an allowance, the protocol still attempts fail-closed cleanup and may reject that token.

GBX supports ERC-2612 permit approvals, including the permit attempted by SignalGBX's atomic
`signalWithPermit` workflow. That workflow uses the underlying permit as authorization and still relies on the exact
GBX `transferFrom` as its custody check. SignalGBX deliberately has no ERC-2612 approval permit because it is
non-transferable; its signature-based delegation belongs to ERC20Votes governance rather than token spending.

## Failure isolation

A token that rejects a payout can leave its fixed Fund, Bribe, or user liability unpaid. It cannot change the
destination. Accrued Resonance Strategy rewards and BribeRouter's Fund and paired-Bribe liabilities are visible and
permissionlessly retryable. A failed Fund payment does not consume the Bribe liability and a failed Bribe notification
does not consume the Fund liability. When failure is caused by an exhausted lifetime cap, the automatic reward
liability remains in BribeRouter but cannot enter that old Bribe; a replacement Strategy and Bribe provide a fresh
per-pool budget. `withdrawSignal` does not perform either payout. Bribe users can claim one token or a selected unique
list, allowing them to omit a broken reward token. Direct USDG donations and zero-active-signal Resonance emission are
surplus, not retryable liabilities.

Fund is intentionally different: it is a permissionless raw-token treasury. Any ERC-20 can be sent to it, but that
does not make the token supported or official. A redeemer chooses which unique non-GBX addresses to include. A broken
selected token reverts the complete redemption, while omitted assets remain permanently for the post-redemption GBX
supply. Every selected address must also retain at least its own snapshotted balance less its payout after the complete
basket transfer, preventing two token facades backed by one shared ledger from consuming the same backing twice.

Mine USDG is also isolated through pull accounting. Exact USDG receipt is required at replacement, exact routed
revenue must reach ResonanceRouter, and the contract retains only displaced-miner claims. A blocked claim recipient
does not redirect the liability or block another miner's claim.

## Offchain presentation

Official protocol membership comes from Strategies registered in Resonance, not from Fund balances. Frontends and
indexers must label unsolicited Fund balances separately, allow manual asset-address entry, warn that omissions are
forfeited, show both the fixed eight-token Bribe cap and each registered token's remaining lifetime notification
capacity, and never present registration of a ninth reward token or an over-cap notification as valid.
