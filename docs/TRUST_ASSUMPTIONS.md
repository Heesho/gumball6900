# Trust assumptions

- USDG, GBX, Strategy payment tokens, and registered Bribe reward tokens are standard, non-rebasing ERC-20s whose
  sender debit and receiver credit equal the requested amount. Unsupported tokens fail closed where exact deltas are
  checked; their own payout may remain blocked without blocking signal exit.
- The project multisig protects proposer/canceller authority and users monitor the timelock delay.
- OpenZeppelin `TimelockController` is deployed with the reviewed roles, delay, and no external default administrator.
- The fixed Fundraiser constants and sequential settlement implementation continue matching the independently tested
  980 million allocation model.
- Deployment correctly converts the entire 20 million genesis allocation into the reviewed out-of-range GBX-only v4
  position and verifies the initial price, ticks, liquidity, token ID, and any rounding residual before handover.
- The configured Uniswap v4 PositionManager and hookless GBX/USDG PoolKey are canonical for the selected chain.
- Initial Strategy tokens and price parameters are reviewed before their timelocked creation.
- Interfaces discover Fund assets offchain because the protocol deliberately keeps no onchain asset registry.
- Robinhood Chain ID 4663 continues to support EIP-1153 transient storage. A pinned-block `eth_call` exercised
  `TSTORE`/`TLOAD` successfully during the 2026-08-09 internal review; deployment evidence must repeat the check.
- The configured PoolManager, PositionManager, and Permit2 runtime bytecode matches the independently reviewed
  target-chain addresses and code hashes before any NFT is transferred.

These assumptions are design inputs, not evidence of audit, deployment, or production safety.
