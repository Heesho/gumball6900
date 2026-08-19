# Trust assumptions

- USDG, GBX, Strategy payment tokens, and registered Bribe reward tokens are standard non-rebasing ERC-20s. Exact-
  delta checks make unsupported movement fail closed but cannot make an adversarial token safe.
- Users and integrators account for each Bribe's immutable per-token lifetime notification cap of
  `floor(type(uint256).max / 1e18)` raw units. It cannot be reset or bypassed; an exhausted pool must be replaced with a
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
- The immutable initial rate, cumulative halving amount, positive tail, price multiplier, and minimum initial price are
  independently modeled and approved before deployment. Test parameters are not production recommendations.
- Miners understand rollover risk: a miner receives the 80% handoff payment only if another user replaces the slot.
- Miners realize accrued GBX when their slot is replaced and may self-replace for zero USDG after one hour.
- Deployment converts the 20 million genesis allocation into the reviewed out-of-range GBX-only v4 position and
  verifies price, ticks, liquidity, token ID, and rounding residual before irreversible custody.
- Configured Uniswap v4 and USDG addresses and runtime code hashes match independently reviewed target-chain values.
- Initial Strategy tokens and price parameters are reviewed and bootstrapped by the temporary setup owner before
  Resonance ownership passes directly to the exact reviewed external governance executor; the deployment then proves
  all temporary authority is gone.
- Interfaces discover Fund assets offchain because Fund deliberately has no registry.
- The target chain supports EIP-1153 transient storage; deployment evidence repeats the pinned-chain capability check.
- Farplace MineRig provenance and distribution rights are cleared before public distribution or deployment.

These assumptions are design inputs, not evidence of audit, deployment, or production safety.
