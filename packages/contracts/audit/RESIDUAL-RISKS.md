# Residual risks

## Mine and supply

- Fixed-tenure rates prevent mid-mine dilution but temporarily raise aggregate issuance after capacity expansion or a
  future-handoff halving. Old slots keep their earlier rates until replacement.
- Miners face rollover risk and may be replaced at zero USDG after one hour. The 80% successor payment is not a refund
  or guarantee.
- GBX has no protocol-defined economic supply cap. Immutable future-handoff halvings converge to a positive tail, so
  dilution does not terminate on any modeled horizon. SignalGBX voting checkpoints impose a `uint208` ceiling on the
  amount that can be staked for governance, even though GBX itself has no such implementation ceiling.
- Exact production Mine parameters remain unresolved and materially affect demand, dilution, revenue, and MEV.
- Accrued GBX is unminted between checkpoints. Fund forces a checkpoint before redemption, but indexers must compute
  pending emission for effective-supply displays.
- Every handoff, capacity increase, and redemption checkpoints up to sixteen slots. Work is bounded but linear.
- The permanent GBX minter handoff and immutable dependencies cannot be repaired after an incorrect deployment.
  Reciprocal identity checks reject crossed GBX/Mine, Resonance/SignalGBX/factory, and Resonance/router graphs, but a
  malicious lookalike contract or incorrect immutable parameter still requires signed bytecode and manifest review.

## Existing protocol and economic risk

- Low-decimal Bribe rewards or very large signal denominators can classify economically meaningful carry to Fund when
  signal supply changes. The value remains conserved, but is no longer attributed to incumbent signalers.
- Permissionless LP fee harvesting has no bounty and may be delayed until someone volunteers gas.
- Signal timing can redirect a lumpy revenue notification because signaling has no cooldown.
- Strategy price may fall to zero. Fund has no curated asset list, recovery, or migration.
- A blocked token can leave its own liability unpaid. Destinations remain fixed and retryable.
- Omitted redemption assets stay for the post-redemption supply; unsolicited Fund tokens have no recovery path.

## Governance and setup

SignalGBX voting may propose only four exact actions through ProtocolGovernor: add/kill Strategies, register up to
eight Bribe reward tokens, and increase Mine capacity to sixteen. The Governor is the Timelock's sole proposer; it
cannot reduce capacity, reprice incumbents, change Mine economics, move Fund assets, recover the liquidity NFT, relay
an arbitrary call, replace the Timelock, or upgrade/migrate the core.

Voting uses block snapshots while the Timelock delay uses seconds. Staked GBX has no withdrawal lock, so a voter can
exit after the snapshot while retaining historical voting weight, and short-lived borrowed GBX can influence a known
snapshot. Idle and undelegated SignalGBX counts toward historical total supply and therefore quorum but casts no vote;
large inactive supply can deadlock all four maintenance actions. Once queued, an action has no public cancellation
path. Stale or conflicting queued operations may remain forever and revert on execution, though they do not block a
differently described replacement proposal.

Incorrect vote parameters, dependencies, bootstrap Strategies, bindings, ownership, PoolKey, ticks, token ID, or
Timelock roles are permanent. Deployment evidence must prove the initial Strategy set and that no external proposer,
canceller, or default administrator survives setup.

## Evidence gaps

No independent audit, current Mine mutation score, pinned Echidna result, compatible symbolic proof, legal clearance,
or signed deployment manifest exists. Historical campaign evidence must not be presented as a review of ADR 0024.
