# Trust assumptions

- USDG, GBX, Strategy payment tokens, and registered Bribe reward tokens are standard non-rebasing ERC-20s. Exact-
  delta checks make unsupported movement fail closed but cannot make an adversarial token safe.
- Users and integrators account for each Bribe's immutable per-token lifetime notification cap of
  `floor(type(uint256).max / 1e36)` raw units. It cannot be reset or bypassed; an exhausted pool must be replaced with a
  new Strategy and Bribe while incumbent positions remain movable or withdrawable from the old pool.
- SignalGBX holders understand that its non-transferable ERC20Votes checkpoints and delegation remain available to a
  future external governance integration, but the core assigns them no proposal threshold, quorum, delay, cancellation,
  or execution semantics.
- No external governance system or production Resonance owner has been selected. Deployment remains blocked until a
  later ADR pins and reviews the provider release, deployed code, plugins, SignalGBX compatibility, permission and admin
  graph, upgrade paths, proposal rules, batching, delay, cancellation behavior, and ownership handoff.
- Users understand that a compromised external Resonance owner can misuse Strategy membership or Bribe reward-token
  registration and can transfer or renounce ownership. Mine, Fund, and LiquidityPosition remain ownerless and outside
  that authority.
- Users understand that Mine has exactly sixteen ownerless slots and a halving never reprices an occupied tenure.
- Interfaces derive the next boundary from Mine `startTime` and use a pre-boundary handoff deadline when a quoted TPS
  must remain valid; the contract has no separate TPS-slippage parameter.
- Mine's hard-coded initial rate, time-based halving period, positive tail, price multiplier, and minimum initial price
  are independently reviewed before deployment. The provisional 64 GBX-per-second, 69-day, 1 GBX-per-second schedule
  is not economic approval.
- Deployment verifies the permanent reciprocal GBX/Mine binding before exposing Mine. Mine does not spend gas
  re-reading that immutable deployment fact on each handoff; GBX still rejects every unauthorized mint.
- Miners understand rollover risk: a miner receives the 80% handoff payment only if another user replaces the slot.
- Users understand that a paid Mine handoff ends after the exact protocol share reaches ResonanceRouter. Permissionless
  `route()` has no designated keeper, bounty, or liveness guarantee, so the balance may wait indefinitely until a
  manual, frontend, volunteer-keeper, or cron caller acts. LiquidityPosition fee harvesting remains atomically coupled
  to its own route attempt.
- Miners realize accrued GBX when their slot is replaced and may self-replace for zero USDG after one hour.
- Interfaces treat Mine messages as untrusted payer-authored event data, escape them before display, and enforce the
  280-byte limit in bytes rather than assuming 280 Unicode characters. Mine does not validate UTF-8 or store messages.
- Deployment converts the 20 million genesis allocation into the reviewed out-of-range GBX-only v4 position and
  verifies price, ticks, liquidity, token ID, and rounding residual before irreversible custody.
- Configured Uniswap v4 and USDG addresses and runtime code hashes match independently reviewed target-chain values.
- Initial Strategy tokens and price parameters are reviewed and bootstrapped by the temporary setup owner before
  Resonance ownership passes directly to the exact reviewed external governance executor; the deployment then proves
  all temporary authority is gone.
- Interfaces discover Fund assets offchain because Fund deliberately has no registry.
- The target chain supports EIP-1153 transient storage; deployment evidence repeats the pinned-chain capability check.
- donut-miner provenance and distribution rights are cleared before public distribution or deployment.

These assumptions are design inputs, not evidence of audit, deployment, or production safety.
