# Trust assumptions

- USDG, GBX, Strategy payment tokens, and registered Bribe reward tokens are standard non-rebasing ERC-20s. Exact-
  delta checks make unsupported movement fail closed but cannot make an adversarial token safe.
- SignalGBX holders understand block-clock snapshot voting, delegation, proposal threshold, and quorum. Users monitor
  the Timelock during its reviewed delay and understand there is no multisig bypass, guardian, or queued-proposal veto.
- ProtocolGovernor is the only Timelock proposer, its immutable Resonance and Mine targets match the deployed graph,
  its four-selector filter and zero-value rule match the reviewed bytecode, execution is open, and no external default
  administrator remains.
- Users understand that Mine governance may add slots but cannot remove them or dilute an occupied slot. Capacity
  expansion can temporarily raise aggregate issuance because incumbents retain their paid-for rates.
- The immutable initial rate, cumulative halving amount, positive tail, price multiplier, and minimum initial price are
  independently modeled and approved before deployment. Test parameters are not production recommendations.
- Miners understand rollover risk: a miner receives the 80% handoff payment only if another user replaces the slot.
- Permissionless callers continue checkpointing when needed. Fund itself forces a bounded checkpoint before redemption.
- Deployment converts the 20 million genesis allocation into the reviewed out-of-range GBX-only v4 position and
  verifies price, ticks, liquidity, token ID, and rounding residual before irreversible custody.
- Configured Uniswap v4 and USDG addresses and runtime code hashes match independently reviewed target-chain values.
- Initial Strategy tokens and price parameters are reviewed and bootstrapped by the temporary setup owner before
  Resonance and Mine ownership passes to the Timelock; the deployment then proves all temporary authority is gone.
- Interfaces discover Fund assets offchain because Fund deliberately has no registry.
- The target chain supports EIP-1153 transient storage; deployment evidence repeats the pinned-chain capability check.
- Farplace MineRig provenance and distribution rights are cleared before public distribution or deployment.

These assumptions are design inputs, not evidence of audit, deployment, or production safety.
