# Residual risks

## Mine and supply

- Fixed-tenure rates prevent mid-mine dilution but temporarily raise aggregate issuance after a future-handoff
  halving. Old slots keep their earlier rates until replacement.
- Miners face rollover risk and may be replaced at zero USDG after one hour. The 80% successor payment is not a refund
  or guarantee.
- GBX has no protocol-defined economic supply cap. Immutable future-handoff halvings converge to a positive tail, so
  dilution does not terminate on any modeled horizon. SignalGBX voting checkpoints impose a `uint208` ceiling on the
  amount that can be signaled for governance, even though GBX itself has no such implementation ceiling.
- Exact production Mine parameters remain unresolved and materially affect demand, dilution, revenue, and MEV.
- Accrued GBX is unminted until a slot handoff. Fund uses Mine's constant-time effective supply, and indexers should
  use the same view for inclusive supply displays.
- Mine handoffs and effective-supply reads are constant time; rigorous tests separately traverse all sixteen slots as
  a differential oracle.
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

SignalGBX voting may propose only three exact actions through ProtocolGovernor: add/kill Strategies and register up to
eight Bribe reward tokens. The Governor is the Timelock's sole proposer; it cannot change Mine's fixed slot count,
reprice incumbents, change Mine economics, move Fund assets, recover the liquidity NFT, relay
an arbitrary call, replace the Timelock, or upgrade/migrate the core.

Voting uses block snapshots while the Timelock delay uses seconds. Signaled GBX has no withdrawal lock, so a voter can
exit after the snapshot while retaining historical voting weight, and short-lived borrowed GBX can influence a known
snapshot. Undelegated SignalGBX counts toward historical total supply and therefore quorum but casts no vote; large
undelegated supply can deadlock all three maintenance actions. Once queued, an action has no public cancellation path.
Stale or conflicting queued operations may remain forever and revert on execution, though they do not block a
differently described replacement proposal.

Incorrect vote parameters, dependencies, bootstrap Strategies, bindings, ownership, PoolKey, ticks, token ID, or
Timelock roles are permanent. Deployment evidence must prove the initial Strategy set and that no external proposer,
canceller, or default administrator survives setup.

## Evidence gaps

No independent audit, compatible symbolic proof, legal clearance, or signed deployment manifest exists. Current
pinned Echidna and Medusa campaigns and the 43-mutant SignalGBX/Resonance/BribeRouter campaign are internal engineering
evidence and must not be presented as independent review.
