# Residual risks and explicit assumptions

## Principal exit and discovery

- A known live or killed Strategy position has a bounded scalar `removeSignal` path. A user's Strategy membership is not
  enumerable through a state-growth-independent bounded current-state query. Durable wallet records, logs, or an indexer
  provide the practical path; factory-nonce CREATE derivation is finite at a snapshot but O(total factory creations).
  This is CEX-03 and prevents an unconditional “no known principal-exit blocker” claim.
- The working-tree Resonance lifetime cap proves the specific CEX-01 index bound only for a fresh deployment containing
  that bytecode. There is no upgrade or migration path for a previously deployed unbounded Resonance.
- Batch removal is convenience only. A very large or stale batch can exceed gas or revert atomically; it does not replace
  scalar calls once the Strategy addresses are known.
- Signal removal intentionally checkpoints Resonance and up to sixteen Bribe reward indexes. Reward-token contracts are
  not called, but arithmetic and the canonical GBX/SignalGBX/Resonance/Bribe graph remain intrinsic dependencies.

## Immutable setup and deployment

- No current signed deployment manifest, exact artifact hash set, constructor receipt set, external governance executor,
  or ownership handoff receipt exists. Current release tooling fails closed because its retained schema describes an old
  graph. Production remains blocked.
- Reciprocal getters prove consistency only. A counterfeit but internally consistent graph must be rejected through
  runtime/initcode hashes, immutable arguments, constructor transactions, exact addresses, ownership state, and signed
  evidence.
- Mine can accept a tenure before GBX grants it mint authority. Any touched candidate must be abandoned before exposure,
  or deployment must close the window atomically/private and prove all sixteen slots untouched after binding.
- SignalGBX, StrategyFactory, and BribeFactory retain setup Ownable shells after their one-time bindings. Production
  evidence must separately remove each temporary owner. Resonance ownership must be received by the exact independently
  reviewed executor; a promise to do so later is not evidence.
- Direct contracts are non-upgradeable and ownerless where specified. A latent bug, wrong immutable, or contaminated
  graph has no pause, rescue, sweep, successor, arbitrary executor, or migration authority. Redeployment before exposure
  is often the only safe recovery.

## Token behavior boundaries

- GBX and USDG are assumed standard, non-rebasing, non-fee, conventionally returning ERC-20s. A mutable USDG blocklist or
  issuer/proxy behavior can block a beneficiary's miner claim, Resonance distribution, or paid Mine replacement. A
  zero-price replacement still settles GBX without USDG, but the USDG claim intrinsically cannot be paid without USDG.
- Strategy payment tokens and Bribe reward tokens are admitted by governance using address/code checks, not semantic
  proofs. Fee, no-op, rebasing, pausable, callback, mutable-blocklist, false-return, or behavior-changing tokens can
  underfund, misaccount, or brick their own purchase/reward path. Governance admission is a trust boundary.
- Bribe scalar claims isolate one broken reward token from healthy rewards. `claimRewards` is bounded but atomic, so one
  broken token reverts the all-token convenience path. Transfer failure restores the entitlement.
- Fund deliberately accepts arbitrary unsolicited tokens and makes exact caller-selected payout checks. A malicious
  selected token can revert or lie about its own/aliased ledger; the whole attempted burn rolls back. It can be omitted,
  so it does not infect a known healthy one-token redemption. Omitted value is permanently forfeited by that redeemer.
- Current tracked landing/deck/web copy still promises a slice of everything and, in the deck, guaranteed profitable gap
  closure. CEX-09 treats that mismatch as a Medium release blocker. This review did not establish that any of these
  surfaces is published; the repository claim must still be corrected before any release or backed by a separately reviewed Fund
  redesign.
- No-return tokens may be SafeERC20-compatible, but they are not proof of correct balance semantics. ERC-777-like hooks
  and token callbacks are outside the supported canonical-token model; adversarial tests bound the observed blast radius,
  not promise support.

## Revenue, reward, and surplus behavior

- The new Resonance lifetime cap is finite. After exact exhaustion, later Router USDG cannot be scheduled and remains
  buffered indefinitely. Bribe reward tokens have the analogous per-token lifetime cap. Those balances are protocol
  yield/reward buffers, not deposited signal principal. A BribeRouter routes only its complete balance; a direct
  donation one unit above the paired Bribe's remaining lifetime headroom can therefore make that complete buffer
  permanently unrouteable before exact cap exhaustion. Existing notified claims and signal exits remain independent.
- Router calls are permissionless but have no keeper, bounty, or liveness guarantee. Below-threshold balances and failed
  notifications may remain forever. Mine replacement, signal exit, Fund redemption, and already accrued healthy scalar
  claims remain independent.
- Rate, global-index, Strategy/account, and Fund divisions intentionally floor. Zero-weight emissions, direct donations,
  and remainders may become unallocated or unclaimable surplus. ADR 0053's working-tree authorization removes CEX-02's
  outsider-selected Bribe claim cadence, but beneficiaries may still discard their own fractions by self-claiming
  frequently, and signal mutations retain accepted account-floor semantics. CEX-08 separately lets an outsider choose
  a Strategy's USDG checkpoint cadence; each effective forced Strategy checkpoint loses less than one raw USDG unit but
  can destroy all otherwise combinable fractions.
- Bribe registry size is permanently capped at sixteen, but an account can have an unbounded number of Strategy
  positions over time. Scalar exit cost is per known position; portfolio-wide work is not one bounded transaction.
- Resonance's cross-Bribe claim batch is caller-sized and atomic. An invalid Strategy, broken reward token, or excessive
  array can make the convenience call fail after consuming gas; all earlier effects roll back. Callers may split the
  Strategy list and use direct scalar-token Bribe claims for bounded healthy-token isolation. Registered killed
  Strategies remain claimable.

## Time and arithmetic horizons

- Foundry can model Mine/Fund `uint256` overflow only by warping beyond the pinned target client's `uint64` block-header
  timestamp. At the public maximum `64 ether` aggregate rate, every target-representable integrated emission remains
  roughly `9.8e37` below `uint256` maximum. CEX-06 is therefore rejected and retained only as defensive model evidence.
- SignalGBX uses OpenZeppelin's default `uint48` block-number clock. At block numbers above `2^48 - 1`, vote checkpoint
  writes, including the burn inside signal removal, revert. Pinned Nitro source and live probes show `NUMBER` is the
  parent-chain counter; at a twelve-second parent cadence the target-representable `uint64` horizon is roughly 107
  million years away.
- SignalGBX's inherited ERC20Votes safe supply is `uint208`. This bounds outstanding receipt/voting units and can reject
  new additions at an extreme supply; it does not by itself unlock or migrate positions.
- Mine and Strategy epoch IDs use checked `uint256` increments. No target-reachable exhaustion sequence was established;
  the same applies to other monotonic counters within the reviewed target execution bounds.
- No report statement uses “forever” as a mathematical proof. Evidence applies to the explicitly tested and defensible
  operating horizon.

## Governance and economics

- Existing known positions remain removable if Resonance ownership disappears or is renounced. Governance loss prevents
  Strategy addition, replacement of the final live Strategy, reward-token admission, and bribe-rate changes, but is not
  a normal existing-principal exit dependency.
- Governance can set any allowed 0–2,000 bribe BPS value, kill any non-final live Strategy, or register operationally
  broken reward tokens. Those choices change yield and optional reward realization, not the bounded known-position exit.
- The exact external governance implementation, code provenance, voting token, delay, cancellation, upgrade/admin paths,
  batching support, and ownership receipt are unselected and unreviewed.
- A zero-price Strategy buyer may send inventory back to the Strategy and restart the auction floor. Repeated ordering can
  delay acquisition, but an honest buyer can pay the current floor and no individual owns the inventory as principal.
- Occupied Mine slots retain tenure TPS through halvings, aggregate issuance can exceed the prospective global rate, and
  turnover is not guaranteed. These are provisional economics, not security-proven issuance targets.
- The core provides no liquidity, oracle, market-maker, reserve ratio, price support, or redemption-price guarantee.
  Users redeem a pro-rata share of caller-selected Fund assets; buyer demand, dilution, and selective forfeiture remain.

## Target chain and external infrastructure

- Pinned live mainnet/testnet probes executed PUSH0, TSTORE/TLOAD, and MCOPY and observed 32,000,000 maximum transaction
  and block gas limits. Official configuration permits 96 KiB runtime and 192 KiB initcode. These observations establish
  current opcode availability at the pinned blocks, not future compatibility.
- The exact current Fund artifact was not deployed on a target fork in this review. EIP-1153 defines frame-revert and
  transaction-clearing semantics, and local tests cover duplicates/retries, but a signed exact-artifact non-broadcast
  target campaign remains a deployment gate.
- Public RPC observations are not signed deployment receipts. RPC operators, sequencer behavior, ArbOS upgrades, bridge
  behavior, USDG issuer behavior, and chain governance remain external dependencies.
- The subgraph, SDK, Lens, frontend, and event history are replaceable aids and not canonical accounting. CEX-03 records
  the remaining discovery dependence when every aid is unavailable.

## Tooling and assurance boundary

- Foundry fuzz/invariant, differential, gas, mutation, static, Echidna/Medusa, and Mythril evidence each has a documented
  scope in `TEST-EVIDENCE.md`. A passing campaign does not prove absence of unmodeled reachable states.
- Mythril 0.24.8 cannot soundly resolve the current constructor immutables and Cancun runtime; any attempted output is a
  compatibility observation, not symbolic clearance. No Certora, Halmos, Kontrol, hevm, or SMTChecker proof closes the
  full graph.
- Solidity 0.8.26's official bug registry lists two applicable-version bugs. The build is non-viaIR, has no mutual
  recursion, and has no storage array near the terminal storage slot, so the known trigger conditions were not found.
  That narrow disposition is not a compiler correctness proof.
- No reviewed imported path uses the OpenZeppelin Bytes or InteroperableAddress functions implicated by the reviewed
  advisories/fixes. Dependency pinning and bytecode parity still require revalidation for every change.

This file states residual risk, not acceptance on behalf of users or deployment authorization.
