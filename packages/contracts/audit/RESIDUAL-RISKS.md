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

- Bribes use `1e36` reward precision, so a raw reward unit advances the global index at any realistic signal supply.
  Indivisible per-user sub-raw fractions remain account-specific and become Fund precision if that account fully exits.
- Every reward token in every Bribe has a raw-unit lifetime-notification ceiling of
  `floor((2^256 - 1) / 1e36)`. Claims, Fund payments, stream completion, zero supply, and Strategy death do not reopen
  capacity. The ceiling is approximately `1.158e23` whole tokens for an 18-decimal asset, but unusually high-decimal
  tokens can reach it at a much smaller displayed amount. At exhaustion, new direct and automatic notifications fail;
  existing claims and signal exits remain available. An automatic reward remains a fixed BribeRouter liability while
  its independent Fund leg can still settle.
- Permissionless LP fee harvesting has no bounty and may be delayed until someone volunteers gas.
- Signal timing can redirect a lumpy revenue notification because signaling has no cooldown.
- Strategy price may fall to zero. Fund has no curated asset list, recovery, or migration.
- A blocked token can leave its own liability unpaid. Destinations remain fixed and retryable.
- Omitted redemption assets stay for the post-redemption supply; unsolicited Fund tokens have no recovery path.
- Resonance governance may change the global prospective automatic-Bribe share from 0% through 20%. Every change is
  prospective and preserves old liabilities and weighted carry, but it can materially change future Fund backing and
  signaler incentives around pending auctions. A 0% rate does not disable Bribes or signal exits.

## Governance and setup

ADR 0034 removed the local ProtocolGovernor and protocol Timelock. SignalGBX retains block-number ERC20Votes
checkpoints, but the core assigns them no proposal, quorum, voting-period, execution-delay, or cancellation semantics.
Historical checkpoints survive signal withdrawal, so voting-power rental and post-withdrawal voting remain properties
that the selected external governance integration must address.

Resonance's owner can add/kill Strategies, register up to eight reward tokens per Bribe, set the global prospective
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
review. The current 49-mutant campaign passes with no survivors, but remains narrow internal engineering evidence.
