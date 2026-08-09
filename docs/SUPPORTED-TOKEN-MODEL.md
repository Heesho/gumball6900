# Supported token model

## Canonical and registered tokens

GBX, USDG, Strategy payment tokens, and Bribe reward tokens are supported only when they behave as standard,
non-rebasing ERC-20s:

- a requested transfer debits the sender by exactly the requested amount;
- it credits the receiver by exactly the requested amount;
- `balanceOf`, `approve`, `transfer`, and `transferFrom` follow their conventional semantics;
- balances do not change asynchronously through rebases;
- token callbacks cannot bypass protocol reentrancy guards or authorization.

Core receipt, payment, reward, revenue, redemption, and liquidity-funding paths compare balance deltas and revert
atomically on inexact movement. This is fail-closed evidence, not support for fee-on-transfer, rebasing, ERC-777-style,
blocklisting, pausable, or otherwise adversarial tokens.

## Failure isolation

A token that rejects a payout can leave its fixed Fund or user liability unpaid. It cannot change the destination.
Revenue, reward, and Router Fund liabilities are visible and permissionlessly retryable. Signal removal and unstaking
do not perform those payouts. Bribe users can claim one token or a selected unique list, allowing them to omit a broken
reward token.

Fund is intentionally different: it is a permissionless raw-token treasury. Any ERC-20 can be sent to it, but that
does not make the token supported or official. A redeemer chooses which unique non-GBX addresses to include. A broken
selected token reverts the complete redemption, while omitted assets remain permanently for the post-redemption GBX
supply.

## Offchain presentation

Official protocol membership comes from Strategies registered in Resonance, not from Fund balances. Frontends and
indexers must label unsolicited Fund balances separately, allow manual asset-address entry, warn that omissions are
forfeited, show the fixed eight-token Bribe cap, and never present registration of a ninth reward token as valid.
