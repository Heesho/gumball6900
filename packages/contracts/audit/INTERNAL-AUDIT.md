# Internal adversarial audit

> Historical evidence only. ADR 0024 replaced the distribution contract and supply model with Mine, ADR 0026
> replaced Resonance routing, streaming, and carry behavior, and ADR 0027 later resolved the A-09 Bribe boundary
> disposition below. ADR 0034 later removed the intended ProtocolGovernor/Timelock ownership architecture; every
> Timelock statement below describes only the pinned reviewed candidate. This report is not an audit of the current
> development graph or any external governance integration.

Date: 2026-08-09

Reviewed candidate: `54e3f2c3ce1de25aea4da2f21fab27804a3bfa84`
Scope: the 16 Solidity files under `packages/contracts/src/core`, their factories, tests, generated ABIs, SDK,
subgraph, simulations, frontend status surface, and affected documentation.

This is internal engineering work, not an independent audit, legal approval, deployment authorization, or evidence
that contracts are suitable for unlimited value.

## Architecture conclusion

The frozen graph is preserved: Fundraiser routes USDG through ResonanceRouter and Resonance; Resonance creates
Strategy/BribeRouter/Bribe graphs through its two bound factories; Fund and LiquidityPosition remain ownerless; the
canonical v4 NFT remains permanently locked at fixed principal; its USDG fees route through ResonanceRouter and its
GBX fees burn through Fund atomically; every Strategy payment is Fund-bound and GBX Strategy-payment burns remain
explicit later Fund maintenance; and OpenZeppelin TimelockController remains
the intended owner of Resonance. No proxy, pause, rescue, recovery, migration, successor, oracle, generic factory,
arbitrary call, NAV system, or conventional DAO was added.

The reviewed production-hardening candidate is confined to exact accounting, failure isolation, observability, and
consumer support.
Resonance and Bribe retain explicit scaled carry. Bribe retains exact stream-rate remainder and pauses stream time at
zero supply. Fund-bound value is a fixed pull liability rather than an inline transfer. BribeRouter pulls each complete
Strategy payment once and records it as a Fund liability. Reward claims may be scalar or caller-selected.
`MAX_REWARD_TOKENS` remains exactly eight.

## Finding disposition

| Finding | Internal disposition                          | Basis                                                                                              |
| ------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A-02    | Resolved in candidate                         | Global and Strategy scaled USDG carry; direct-donation sync; conservation invariants.              |
| A-03    | Resolved in candidate                         | Exact rate remainder, zero-supply pause, queue, per-user/global carry, selective claims.           |
| A-04    | Resolved in candidate                         | Dead/zero-signal value becomes a fixed Fund liability; exit performs no token transfer.            |
| A-06    | Resolved by ADR 0022                          | Removed caller-funded growth; harvest preserves principal and has immutable fee destinations.      |
| A-08    | Liveness issue resolved; linear cost retained | Eight-token cap, scalar removal/claim, caller-bounded batches, measured 1.342M worst-case removal. |
| A-09    | Open Medium; owner decision required          | Conserved carry can cross a later signal-supply boundary; two deterministic PoCs.                  |

A-09 and the external, licensing, pinned-fuzzer, mutation, formal, and deployment-evidence gaps prevent a
production-readiness claim.

## Key security conclusions

- GBX lifetime minting remains cumulatively capped at one billion; burns never reopen capacity.
- Fundraiser's initial emission, daily floor decay, empty-day forfeiture, and sequential settlement are unchanged.
- Signal entry/removal maintains account, Strategy, total, and Bribe virtual-balance identities.
- Signal removal and unstaking do not transfer revenue or reward tokens.
- Supported-token transfers fail atomically unless observed sender debit and receiver credit are exact at the relevant
  trust boundary.
- Fund redemption retains one pre-burn denominator, caller-selected unique tokens, EIP-1153 duplicate detection, and
  atomic burn/transfers.
- LiquidityPosition validates the precommitted hookless PoolKey, ticks, token ID, custody, and nonzero liquidity. A
  harvest leaves principal unchanged, routes complete USDG through ResonanceRouter, burns complete GBX through Fund,
  and emits the principal/routed/burned amounts.
- Exact accounting identities prove solvency and conservation but do not prove temporal attribution across a changing
  signal denominator. The two A-09 PoCs make that limitation executable and visible.

## Audit-pass remediations

A-09 was not changed because it requires a product-level attribution decision. This pass added the two PoCs, three
Strategy receiver-boundary regressions, a current 12-contract Mythril policy, a current exact-source coverage policy,
and corrections for stale audit test fixtures and removed `script/minimal` analyzer paths. The refreshed Semgrep scan
also found an `unchecked` increment block in `Fundraiser.settleEpochs`; it was narrowly replaced by checked increments,
then validated by the 31-test Fundraiser suite and the complete post-ADR-0022 340-test default campaign. The coverage and Mythril
checks now fail closed on graph drift rather than evaluating deleted contracts.

## Review limitations

The current tree has no completed independent audit, current-tree mutation score, valid pinned Echidna result, sound
Mythril result, or formal proof. Medusa 1.5.1 completed 101,840 calls successfully, but it is only one independent
fuzzer and does not clear the pinned nightly gate. The target-chain checks are read-only evidence at one pinned block,
not deployment verification. See the dedicated campaign, static, formal, mutation, Uniswap, fork, residual-risk, and
release-checklist files in this directory.

For the post-ADR-0034 tree, the exact external governance provider and release, code and upgrade model, permission and
admin graph, SignalGBX compatibility, voting and execution semantics, delay and cancellation behavior, and Resonance
ownership handoff are additional deployment and independent-review gates. No conclusion in this historical report
clears them.
