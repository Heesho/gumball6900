# Trust assumptions

- The configured USDG and every token users select behave sufficiently like ERC-20 for exact balance-delta checks.
- The project multisig protects proposer/canceller authority and users monitor the timelock delay.
- OpenZeppelin `TimelockController` is deployed with the reviewed roles, delay, and no external default administrator.
- The fixed Fundraiser constants and sequential settlement implementation continue matching the independently tested
  980 million allocation model.
- Deployment correctly converts the entire 20 million genesis allocation into the reviewed out-of-range GBX-only v4
  position and verifies the initial price, ticks, liquidity, token ID, and any rounding residual before handover.
- The configured Uniswap v4 PositionManager and hookless GBX/USDG PoolKey are canonical for the selected chain.
- Initial Strategy tokens and price parameters are reviewed before their timelocked creation.
- Interfaces discover Fund assets offchain because the protocol deliberately keeps no onchain asset registry.
- Robinhood Chain supports EIP-1153 transient storage for Fund's duplicate detection.

These assumptions are design inputs, not evidence of audit, deployment, or production safety.
