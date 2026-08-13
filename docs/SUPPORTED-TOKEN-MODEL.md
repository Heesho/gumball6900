# Supported token model

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

Token decimals affect the economic size of precision classified to Fund at a signal boundary. Resonance uses `1e36`
precision and Bribes use `1e18`; both assign unindexable old-denominator carry to Fund before changing signal supply.
Low-decimal Bribe rewards can therefore create a larger whole-token Fund liability at a boundary, but cannot transfer
pre-entry carry to a later signaler.

SignalGBX is explicitly forbidden as a Strategy payment or Bribe reward token because its transfers are permanently
disabled. Tokens that reject zero approvals remain usable when the exact allowance is fully consumed; if a token
under-consumes an allowance, the protocol still attempts fail-closed cleanup and may reject that token.

## Failure isolation

A token that rejects a payout can leave its fixed Fund or user liability unpaid. It cannot change the destination.
Revenue, reward, and Router Fund liabilities are visible and permissionlessly retryable. Signal removal and unstaking
do not perform those payouts. Bribe users can claim one token or a selected unique list, allowing them to omit a broken
reward token.

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
forfeited, show the fixed eight-token Bribe cap, and never present registration of a ninth reward token as valid.
