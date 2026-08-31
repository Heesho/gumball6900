# Residual risks

## Mine and supply

- Fixed-tenure rates prevent mid-mine dilution but can keep aggregate issuance above the prospective rate after a
  future-tenure halving. Old slots keep their earlier rates indefinitely unless replaced.
- Miners face rollover risk: an outgoing tenure can be settled at zero USDG after one hour. Its 80% replacement share
  is not a refund or guarantee.
- GBX has no protocol-defined economic supply cap. Immutable future-tenure halvings converge to a positive tail, so
  dilution does not terminate on any modeled horizon. SignalGBX voting checkpoints impose a `uint208` ceiling on the
  amount that can be signaled for governance, even though GBX itself has no such implementation ceiling.
- The hard-coded Mine parameters, including the provisional 64 GBX-per-second initial rate, 69-day halving period, and
  1 GBX-per-second tail, lack independent economic review and materially affect demand, dilution, revenue, and MEV.
- The 751,161,600 GBX day-414 mining amount and 751,162,600 gross supply including fixed genesis issuance are
  synchronized, fully occupied, fully refreshed, fully settled, no-burn references—not caps or forecasts. The roughly
  4.198% initial annual tail ratio declines as supply grows; legacy tenures can emit above that path, empty slots can
  emit below it, and burns alter the denominator.
- Mine now has one deployment-only issuance path outside slot settlement. The fixed `1,000 ether` amount cannot be
  changed and the authority is cleared on success, but a wrong authorized Pair recipient or incorrect canonical graph
  is irreversible. `Mine.totalMined()` excludes this amount, so consumers that equate it with `lifetimeMinted` are
  wrong after canonical launch.
- Accrued GBX is unminted until a slot replacement. Fund uses Mine's constant-time effective supply, and indexers should
  use the same view for inclusive supply displays.
- Mine revenue becomes a Router deposit rather than an automatic stream notification. Permissionless `route()` has no
  designated caller or bounty, so even qualifying revenue may wait indefinitely and its eventual caller can influence
  notification timing. A Router balance below `REWARD_DURATION` raw USDG cannot qualify without another deposit even
  after an active stream finishes. This cannot block a completed Mine replacement, but it can delay Strategy revenue.
- Mine governance can change the Router for future deposits after reciprocal candidate-graph validation. A malicious
  Router/Resonance/SignalGBX graph can mimic the required GBX, USDG, Fund, and reciprocal identity getters, so those
  checks do not replace exact bytecode review. A compromised owner can divert later protocol revenue. The core supplies
  no delay, veto, rollback, or guardian around this call.
- Mine does not validate the candidate Resonance owner, factories, live Strategy count, Bribe parameters, lifetime
  counters, or pristine accounting. A graph can pass reciprocal identity checks yet remain unsafe or unusable for later
  revenue.
- Resonance has a raw-unit lifetime-notification ceiling of `floor((2^256 - 1) / 1e36)`. The cap makes its cumulative
  index representable at the one-raw-signal denominator and preserves signal exits, but headroom never returns. At
  exhaustion, USDG already buffered in that ResonanceRouter remains there because there is no rescue. Governance may
  send only later Mine deposits to a separately deployed and validated graph.
- Mine replacements and effective-supply reads are constant time; rigorous tests separately traverse all sixteen slots as
  a differential oracle.
- Foundry can defensively warp far enough for `elapsed * aggregateTps` or effective supply to exceed `uint256`, but the
  pinned Robinhood Nitro/OffchainLabs target encodes header time as `uint64`. The target therefore cannot supply the
  approximately `5.733e49` years of elapsed time needed by that counterfactual; it is a model boundary, not a
  target-reachable terminal state. The separate ERC20Votes `uint48` block-number clock horizon remains.
- The permanent GBX minter handoff and immutable GBX, USDG, and Fund dependencies cannot be repaired after an incorrect deployment.
  Reciprocal binding checks reject crossed GBX/Mine, Resonance/SignalGBX/factory, and Resonance/router graphs. Mine's
  initial Router pairing remains a deployment evidence gate, while later candidates are checked during the governed
  setter. Malicious lookalikes and incorrect immutable parameters still require signed bytecode and manifest review.
- A Router switch does not move old Router balances, Resonance schedules, Strategy claims, Bribe rewards, or signal
  positions. Users must discover, claim, and unsignal through the old graph before optionally signaling returned GBX
  into the new graph. The switch cannot rescue a position if the old graph's own exit path is already broken, and every
  additional graph increases discovery and monitoring burden.
- A replacement Resonance requires a new one-time-bound SignalGBX. External governance tied to old SignalGBX does not
  automatically count new sGBX, and users burn old sGBX as they unsignal. Without a separately reviewed voting-token
  transition, migration can weaken or deadlock the governance authority needed to administer Mine and the new graph.

## Existing protocol and economic risk

- Bribes use `1e36` reward precision, so a raw reward unit advances the global index at any realistic signal supply.
  Rate, global-index, and account division floors remain unallocated Bribe surplus. A fully exiting account's
  sub-token floor is not transferred to Fund or reallocated to remaining signalers.
- The `f991253`/V12-249705 third-party Bribe checkpoint cadence is remediated in the working tree under ADR 0053:
  direct claims authorize only the beneficiary or immutable Resonance, and Resonance's batch always claims for its
  external caller. Direct keeper/relayer claims for EOAs no longer work. The caller-controlled Strategy batch is
  atomic and nests each Bribe's at-most-sixteen-token loop, so large arrays may exceed gas and one broken token can
  revert the batch. Direct scalar-token claims remain the healthy-token and gas fallback. Remediated and internally
  verified in the working tree; independent closure, deployment authorization, and user-fund authorization remain
  pending.
- Permissionless `Resonance.distributeRevenue(strategy)` can similarly force a per-Strategy checkpoint before fractional
  USDG accrual combines. CEX-08 proves a two-Strategy cadence that destroys the target's halves while a control combines
  them. Each effective checkpoint loses less than one raw USDG unit, but the loss can equal all otherwise combinable
  Strategy fractions. The current no-carry architecture accepts this as Resonance surplus; changing it requires an ADR.
- The fixed Bribe reward-token bound is sixteen. This keeps mandatory loops finite but raises maximum work. ADR 0051's
  caller-selected signal batches multiply per-Strategy checkpoint work by the array length; stale entries revert the
  complete batch and sufficiently large arrays may exceed the block gas limit. Scalar removal remains available.
  Historical withdrawal and composed-move measurements predate this API and are not current batch evidence.
- Every reward token in every Bribe has a raw-unit lifetime-notification ceiling of
  `floor((2^256 - 1) / 1e36)`. Claims, stream completion, zero supply, and Strategy death do not reopen
  capacity. The ceiling is approximately `1.158e23` whole tokens for an 18-decimal asset, but unusually high-decimal
  tokens can reach it at a much smaller displayed amount. At exhaustion, new direct and automatic notifications fail;
  existing claims and signal exits remain available. An automatic reward stays buffered in BribeRouter while Fund has
  already received its complement atomically with the purchase. Because BribeRouter submits its complete balance, a
  direct donation one raw unit above remaining lifetime headroom can make that complete ownerless buffer permanently
  unrouteable even before exact exhaustion.
- The continuing core does not manage or harvest liquidity, but the development launcher creates and seeds one V2
  Pair. All genesis LP is irreversibly minted to `address(0)`: this prevents withdrawal but also makes a wrong chain,
  Factory, Pair implementation, token, ratio, or seed unrecoverable. Address/code-presence checks do not prove
  provenance or canonical V2 behavior.
- The one-USDG/1,000-GBX seed has approximately two USDG of nominal gross reserve value at the launch assumption. It
  makes no depth, price, swap availability, USDG-value, or MEV guarantee. Any precreation of the predicted Pair makes
  launch revert with `PairAlreadyExists` before `Factory.createPair` and denies that launcher, regardless of the Pair's
  reserves, supply, or token balances. The safe response is to abandon that unused candidate and deploy a fresh
  launcher, whose caller-scoped GBX address and predicted Pair differ. There is no existing-Pair adoption or skim path.
- The launcher's CREATE2 outputs are predictable. USDG prefunding of the launcher, ResonanceRouter, or Resonance does
  not deny launch: launcher-held USDG is forwarded to Fund, while prefunded ResonanceRouter or Resonance balances follow
  their ordinary donation semantics. The deterministic future Pair is the exception: one raw USDG there makes the
  exact Pair-deposit invariant fail and denies that launcher. Such donations create no depositor claim and can still
  become buffered revenue or unrecoverable Resonance surplus.
- Both initial Strategies start their 24-hour decay in the launch transaction. If revenue arrives after full decay,
  the first nonempty GBX or LP lot can be bought for zero; the configured minimum starts only the next epoch.
- Only genesis LP is locked. Later LP acquired by Fund remains ordinary caller-selected redemption backing, and later
  independent providers retain the ordinary market and token risks of that Strategy.
- Signal timing changes which Strategies earn later intervals of a restarted revenue stream because signaling has no
  cooldown. Checkpoint-before-weight-change ordering prevents retroactive capture but not short-duration positioning.
- Strategy price may fall to zero. Fund has no curated asset list, recovery, or migration.
- A blocked token can revert its Strategy purchase, Router distribution, or user reward claim. Fund and reward
  destinations remain fixed; the scalar Bribe claim isolates unrelated reward tokens.
- Omitted redemption assets stay for the post-redemption supply; unsolicited Fund tokens have no recovery path.
- CEX-09 records that tracked landing, deck, and web copy overstate this selective path as a slice of everything; the
  deck also guarantees profitable gap closure. The maintainer explicitly accepted that Medium product-claim risk on
  2026-08-31 with no contract or copy change. Users receive every asset only if every address is selected, omitted shares
  are permanently forfeited, and arbitrage profitability or gap closure remains non-guaranteed.
- Resonance governance may change the global prospective automatic-Bribe share from 0% through 20%. Every change is
  prospective and cannot reprice an earlier purchase, Fund balance, buffered Bribe share, active stream, or claim.
  Each purchase floors independently with no weighted carry, so payment partitioning can change raw-unit
  classification. The setting can materially change future Fund backing and signaler incentives around pending
  auctions. A 0% rate does not disable Bribes or signal exits.

## Governance and setup

ADR 0034 removed the local ProtocolGovernor and protocol Timelock. SignalGBX retains block-number ERC20Votes
checkpoints, but the core assigns them no proposal, quorum, voting-period, execution-delay, or cancellation semantics.
Historical checkpoints survive signal removal, so voting-power rental and post-removal voting remain properties
that the selected external governance integration must address.

Resonance's owner can add/kill Strategies, register up to sixteen reward tokens per Bribe, and set the global
prospective Bribe share between 0 and 2,000 basis points. Mine's owner can redirect future revenue to a structurally
consistent replacement graph. Both use `Ownable2Step`, so a transfer requires pending-owner acceptance, but both retain
immediate renunciation and ordinary owner calls have no core delay. Fund and Mine economics remain outside these
setters. A compromised or misconfigured external owner can misuse all five custom administration methods, transfer
control again, or permanently renounce control.

No external provider, release, proxy/upgrade model, plugin set, permission graph, voting configuration, delay,
cancellation policy, emergency path, or executor address has been selected. The launcher checks only that its supplied
final owner contains code. Incorrect dependencies, immutable launch authority, module bytecode, Pair state, bootstrap
Strategies, bindings, ownership, external-governance permissions, or ownership handoff may be permanent. Deployment
evidence must prove the exact integration, successful launch-time pending-owner assignments, later acceptance of both
Mine and Resonance, consumed launcher/genesis authority, and that no temporary setup authority survives. A governance
contract unable to accept ownership leaves both administrations inert under the single-use launcher.

## Evidence gaps

The 2026-08-25 V12 export covers commit `3ae171b997254b56602298d873b3918d1575b3c7`, but it is not a complete
assurance package: it has no explicit scope, methodology, named auditor, date, signature, or report-level rationale,
and internal revalidation confirmed three behaviors. V12-249695 is remediated in the development tree through ADR 0052
but has not received independent closure; V12-249702 remains a pre-exposure deployment-evidence requirement; and
V12-249705 is remediated and internally verified in the working tree through ADR 0053; independent closure remains
pending. V12
does not cover ADR 0051's renamed selectors, batch loops, aggregate custody, Lens, SDK, or subgraph position index;
ADR 0052's remediation; ADR 0053's authorization and claim-batch changes; ADR 0054's fixed Mine issuance, launcher,
component deployers, V2 seeding/locking, and two initial Strategies; or ADR 0055's Mine Router setter and validation,
old/new graph operations, two-step ownership, and dual acceptance handoff.

The pre-ADR-0053 2026-08-30 internal campaign passed 358/358 Foundry tests across 29 suites, exercised 30 invariant
properties plus two deterministic reachability harness tests, killed 59/59 focused mutants, and completed one Medusa
campaign. Those historical receipts do not cover ADR 0053.

The post-ADR-0053 internal campaign passed 367/367 Foundry tests across 29 suites. `ProtocolInvariantsTest` passed 32/32
total tests: 30 invariant properties at 1,000 runs × 500 depth (500,000 handler calls per property) plus two deterministic
reachability tests. The invariant campaign reached 31/31 selectors with zero reverts or discards. Hardhat passed 4/4
with bytecode parity; integration passed 10/10 at 256 fuzz runs; the corrected
mutation run test-killed 70/70 with zero survivors or errors; and the applicable SDK, subgraph, documentation,
simulation, web, lint, typecheck, build, Forge formatting, and build-size checks passed. Exact gas receipts and remaining
workspace limitations are recorded in E-16. No post-ADR-0053 Medusa, Echidna, static, symbolic, formal, or independent
review result is claimed. The final root `pnpm test` rerun passed 9/9 Turbo tasks in 27m2.477s, including 367/367
Foundry tests across 29 suites.

Every E-16 receipt in that post-ADR-0053 campaign predates ADR 0054 and remains historical. E-17 records the completed
post-prefunding campaign for the immediately preceding Pair-adoption/skim launcher: 354/354 non-invariant Foundry tests
across 29 suites; 32/32 configured `ProtocolInvariantsTest` tests; a 386/386 composite total; launcher 16/16; Mine 24/24;
Hardhat 4/4; integration 10/10; a 23,676-byte launcher; a 1/1 pinned fork with a `22,862,200`-gas launch; and a final
9/9-task root run whose Forge task passed 386/386. Those receipts are preserved historical evidence, not coverage of
the current create-only production bytecode.

E-18 records a focused 16/16 `GBXLauncherTest` pass, 354/354 non-invariant Foundry tests across 29 suites, a
22,762-byte launcher, and a refreshed 1/1 pinned fork measuring `22,853,567` gas for `launch`. It covers the create-only
`Factory.createPair` success path, `PairAlreadyExists` for Factory precreation,
`LaunchInvariantFailed(PAIR_USDG_DEPOSIT)` for counterfactual Pair-address USDG prefunding, successful recovery through
a fresh launcher and different caller-scoped GBX/Pair, and the unchanged launcher/ResonanceRouter/Resonance
USDG-prefunding semantics. Final SDK ABI regeneration/check, SDK typecheck, and 53/53 tests also passed. At the E-18
checkpoint, the configured invariant/reachability campaign, final root run, and remaining workspace gates were pending;
no composite total is formed from those historical receipts. E-18 predates ADR 0055 and is not current coverage of its
Mine, Resonance, launcher, ABI, or operations delta.

E-19 records the current ADR-0055 internal campaign: 393/393 configured Foundry tests across 30 suites, including the
32/32 invariant/reachability suite; focused Mine 30/30 and launcher 17/17; Hardhat 4/4 with bytecode parity; 8/8 focused
Mine mutants; integration 10/10; current ABI/SDK/subgraph consumers; simulations, web, documentation,
lint/typecheck/build gates; current
build sizes; and a 1/1 fresh pinned launcher fork with both ownership acceptances. The aggregate root test receipt is
still open because its first shell selected an incompatible Python 3.14 environment, although the affected package
gates passed under the compatible Python 3.11 environment. Whole-repository Prettier and the known one-page PDF layout
gate also remain open for unrelated pre-existing files/layout. No tracked independent review, fresh complete 77-mutant
campaign, manifest-bound production rehearsal with the selected governance executor, authorized ownership receipt, or
complete release campaign is claimed here.

The current Echidna 2.3.3 attempt is invalid: all workers crashed in `Set.elemAt` before executing any of 26 properties,
so its zero exit status is not a pass; pinned 2.3.2 could not run because Docker is unavailable. The current static
toolchain completed, but its integrated policy gate remains red because the disposition register expired and its
Aderyn `missing-inheritance` rationale does not cover the current instance set. Mythril cannot resolve the current
immutable/Cancun-opcode graph, and CodeQL/Halmos-compatible proof is absent. A second independently seeded
external-fuzzer campaign, complete external-audit closure, exact external-governance integration review, legal
clearance, signed deployment manifest, and manifest-bound target deployment/handoff evidence remain absent.
