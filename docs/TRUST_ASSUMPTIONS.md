# Trust assumptions

- USDG, GBX, Strategy payment tokens, and registered Bribe reward tokens are standard non-rebasing ERC-20s.
  `SafeERC20` checks call success and conventional optional returns but does not prove balance movement. Canonical
  Mine and SignalGBX transfers deliberately trust the reviewed GBX/USDG implementations; Fund
  retains stricter checks only for caller-selected arbitrary assets.
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
  registration and can transfer or renounce ownership. Mine and Fund remain ownerless and outside
  that authority.
- Users understand that Mine has exactly sixteen ownerless slots and a halving never reprices an occupied tenure.
- Interfaces derive the next boundary from Mine `startTime` and use a pre-boundary replacement deadline when a quoted TPS
  must remain valid; the contract has no separate TPS-slippage parameter.
- Mine's hard-coded initial rate, time-based halving period, positive tail, price multiplier, and minimum initial price
  are independently reviewed before deployment. The provisional 64 GBX-per-second, 69-day, 1 GBX-per-second schedule
  is not economic approval.
- Deployment verifies the permanent reciprocal GBX/Mine binding before exposing Mine. Mine does not spend gas
  re-reading that immutable deployment fact on each replacement; GBX still rejects every unauthorized mint.
- Miners understand rollover risk: only a positive-price replacement produces a nonzero 80% claim for the outgoing
  tenure miner. The current miner may replace its own slot, including for zero USDG after one hour.
- Users understand that a paid Mine replacement ends after Mine's successful `SafeERC20` transfer request for the nominal
  protocol share into ResonanceRouter. Under the supported USDG model the requested amount arrives; Mine does not
  inspect transfer deltas. Permissionless `route()` has no designated keeper, bounty, or liveness guarantee, so the
  balance may wait indefinitely until a manual, frontend, volunteer-keeper, or cron caller acts.
- Miners realize accrued GBX when their slot is replaced and may self-replace for zero USDG after one hour.
- Interfaces treat Mine messages as untrusted payer-authored event data, escape them before display, and enforce the
  280-byte limit in bytes rather than assuming 280 Unicode characters. Mine does not validate UTF-8 or store messages.
- GBX begins at zero supply and the temporary setup minter cannot mint before Mine is permanently bound as the sole
  lifetime issuer.
- One reviewed, externally created fungible Uniswap v2-style USDG/GBX LP ERC-20 is registered as an ordinary bootstrap
  Strategy payment token.
  Its address and configuration are deployment inputs; the core makes no reserve-value or liquidity guarantee.
- Initial Strategy tokens and price parameters are reviewed and bootstrapped by the temporary setup owner before
  Resonance ownership passes directly to the exact reviewed external governance executor; the deployment then proves
  all temporary authority is gone.
- Interfaces discover Fund assets offchain because Fund deliberately has no registry.
- The target chain supports EIP-1153 transient storage; deployment evidence repeats the pinned-chain capability check.
- donut-miner provenance and distribution rights are cleared before public distribution or deployment.

These assumptions are design inputs, not evidence of audit, deployment, or production safety.
