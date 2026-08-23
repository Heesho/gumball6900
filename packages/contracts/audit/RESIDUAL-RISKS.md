# Residual risks

## Mine and supply

- Fixed-tenure rates prevent mid-mine dilution but can keep aggregate issuance above the prospective rate after a
  future-handoff halving. Old slots keep their earlier rates indefinitely unless replaced.
- Miners face rollover risk and may be replaced at zero USDG after one hour. The 80% successor payment is not a refund
  or guarantee.
- GBX has no protocol-defined economic supply cap. Immutable future-handoff halvings converge to a positive tail, so
  dilution does not terminate on any modeled horizon. SignalGBX voting checkpoints impose a `uint208` ceiling on the
  amount that can be signaled for governance, even though GBX itself has no such implementation ceiling.
- The hard-coded Mine parameters, including the provisional 64 GBX-per-second initial rate, 69-day halving period, and
  1 GBX-per-second tail, lack independent economic review and materially affect demand, dilution, revenue, and MEV.
- The 771,161,600 GBX day-414 supply and approximately 4.089% initial annual tail ratio are synchronized, fully
  occupied, fully refreshed, fully settled, no-burn references—not caps or forecasts. The ratio declines as supply
  grows; legacy tenures can emit above that path, empty slots can emit below it, and burns alter the denominator.
- Accrued GBX is unminted until a slot handoff. Fund uses Mine's constant-time effective supply, and indexers should
  use the same view for inclusive supply displays.
- Mine revenue becomes a Router deposit rather than an automatic stream notification. Permissionless `route()` has no
  designated caller or bounty, so even qualifying revenue may wait indefinitely and its eventual caller can influence
  notification timing. A Router balance below `DURATION` raw USDG cannot qualify without another deposit even after
  an active stream finishes. This cannot block a completed Mine handoff, but it can delay Strategy revenue.
  LiquidityPosition remains atomically coupled to its route attempt.
- Mine handoffs and effective-supply reads are constant time; rigorous tests separately traverse all sixteen slots as
  a differential oracle.
- The permanent GBX minter handoff and immutable dependencies cannot be repaired after an incorrect deployment.
  Reciprocal binding checks reject crossed GBX/Mine, Resonance/SignalGBX/factory, and Resonance/router graphs. Mine's
  separate Router/token pairing is deliberately a post-deployment evidence gate under ADR 0045; a crossed candidate
  must be abandoned before binding or exposure. Malicious lookalikes and incorrect immutable parameters still require
  signed bytecode and manifest review.

## Existing protocol and economic risk

- Bribes use `1e36` reward precision, so a raw reward unit advances the global index at any realistic signal supply.
  Rate, global-index, and account division floors remain unallocated Bribe surplus. A fully exiting account's
  sub-token floor is not transferred to Fund or reallocated to remaining signalers.
- The fixed Bribe reward-token bound is sixteen. This keeps mandatory loops finite but raises maximum work: current
  focused measurements are 1,129,059 gas for withdrawal, 1,471,439 for an all-token claim, and 1,890,938 for a
  composed move with sixteen active streams on both Bribes. Chain-specific headroom still requires deployment review.
- Signal movement is an atomic source removal followed by destination addition. A destination failure rolls the source
  back, but a failing move may consume source-side checkpoint gas before reverting.
- Every reward token in every Bribe has a raw-unit lifetime-notification ceiling of
  `floor((2^256 - 1) / 1e36)`. Claims, stream completion, zero supply, and Strategy death do not reopen
  capacity. The ceiling is approximately `1.158e23` whole tokens for an 18-decimal asset, but unusually high-decimal
  tokens can reach it at a much smaller displayed amount. At exhaustion, new direct and automatic notifications fail;
  existing claims and signal exits remain available. An automatic reward stays buffered in BribeRouter while Fund has
  already received its complement atomically with the purchase.
- Permissionless LP fee harvesting has no bounty and may be delayed until someone volunteers gas.
- Signal timing changes which Strategies earn later intervals of a restarted revenue stream because signaling has no
  cooldown. Checkpoint-before-weight-change ordering prevents retroactive capture but not short-duration positioning.
- Strategy price may fall to zero. Fund has no curated asset list, recovery, or migration.
- A blocked token can revert its Strategy purchase, Router distribution, or user reward claim. Fund and reward
  destinations remain fixed; the scalar Bribe claim isolates unrelated reward tokens.
- Omitted redemption assets stay for the post-redemption supply; unsolicited Fund tokens have no recovery path.
- Resonance governance may change the global prospective automatic-Bribe share from 0% through 20%. Every change is
  prospective and cannot reprice an earlier purchase, Fund balance, buffered Bribe share, active stream, or claim.
  Each purchase floors independently with no weighted carry, so payment partitioning can change raw-unit
  classification. The setting can materially change future Fund backing and signaler incentives around pending
  auctions. A 0% rate does not disable Bribes or signal exits.

## Governance and setup

ADR 0034 removed the local ProtocolGovernor and protocol Timelock. SignalGBX retains block-number ERC20Votes
checkpoints, but the core assigns them no proposal, quorum, voting-period, execution-delay, or cancellation semantics.
Historical checkpoints survive signal withdrawal, so voting-power rental and post-withdrawal voting remain properties
that the selected external governance integration must address.

Resonance's owner can add/kill Strategies, register up to sixteen reward tokens per Bribe, set the global prospective
Bribe share between 0 and 2,000 basis points, transfer ownership, or renounce ownership. The immutable ownerless
contracts and Mine economics remain outside that authority, but the core no longer enforces a selector-bounded
proposal layer or delayed execution around Resonance ownership. A compromised or misconfigured external owner can
misuse all four administration methods, transfer control again, or permanently renounce control.

No external provider, release, proxy/upgrade model, plugin set, permission graph, voting configuration, delay,
cancellation policy, emergency path, or executor address has been selected. Incorrect dependencies, bootstrap
Strategies, bindings, ownership, PoolKey, ticks, token ID, external-governance permissions, or ownership handoff may be
permanent. Deployment evidence must prove the exact integration and that no temporary setup authority survives.

## Evidence gaps

No independent audit, compatible symbolic proof, exact external-governance integration review, legal clearance, or
signed deployment manifest exists. The pinned Echidna and Medusa campaigns and the recorded full 43-mutant
SignalGBX/Resonance/BribeRouter campaign predate ADRs 0034–0036 and are internal engineering evidence, not independent
review. A later narrow 49-mutant campaign passed with no survivors against the ADR 0036/0037 tree, but it predates ADR
0047 and remains historical internal engineering evidence. The focused ADR-0048 migration passes 104/104 and kills
47/47 targeted mutants, but no current external-fuzzer, static-analysis, symbolic, or complete deterministic/workspace
campaign covers the complete ADR-0048 tree.
