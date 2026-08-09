# Internal production-hardening audit

Date: 2026-08-09

Baseline: `395a0dfbf56e3d478233736ef7a110e584a676e7`
Scope: the 16 Solidity files under `packages/contracts/src/core`, their factories, tests, generated ABIs, SDK,
subgraph, simulations, frontend status surface, and affected documentation.

This is internal engineering work, not an independent audit, legal approval, deployment authorization, or evidence
that contracts are suitable for unlimited value.

## Architecture conclusion

The frozen graph is preserved: Fundraiser routes USDG through ResonanceRouter and Resonance; Resonance creates
Strategy/BribeRouter/Bribe graphs through its two bound factories; Fund and LiquidityPosition remain ownerless; the
canonical v4 NFT remains permanently locked; every Strategy payment is Fund-bound and GBX burns are explicit later
Fund maintenance; and OpenZeppelin TimelockController remains
the intended owner of Resonance. No proxy, pause, rescue, recovery, migration, successor, oracle, generic factory,
arbitrary call, NAV system, or conventional DAO was added.

The implementation change is confined to exact accounting, failure isolation, observability, and consumer support.
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
| A-06    | Open residual                                 | Compound timing changes required token composition; no oracle/swap is allowed by design.           |
| A-08    | Liveness issue resolved; linear cost retained | Eight-token cap, scalar removal/claim, caller-bounded batches, measured 1.342M worst-case removal. |

A-06 and the external, licensing, pinned-fuzzer, mutation, formal, and deployment-evidence gaps prevent a production
readiness claim.

## Key security conclusions

- GBX lifetime minting remains cumulatively capped at one billion; burns never reopen capacity.
- Fundraiser's initial emission, daily floor decay, empty-day forfeiture, and sequential settlement are unchanged.
- Signal entry/removal maintains account, Strategy, total, and Bribe virtual-balance identities.
- Signal removal and unstaking do not transfer revenue or reward tokens.
- Supported-token transfers fail atomically unless observed sender debit and receiver credit are exact at the relevant
  trust boundary.
- Fund redemption retains one pre-burn denominator, caller-selected unique tokens, EIP-1153 duplicate detection, and
  atomic burn/transfers.
- LiquidityPosition validates the precommitted hookless PoolKey, ticks, token ID, custody, and nonzero liquidity; its
  event now exposes liquidity before/added/after, caller funding maxima, and total balances returned.

## Review limitations

The current tree has no completed independent audit, current-tree mutation score, pinned Echidna result, Mythril run,
or formal proof. Medusa 1.5.1 completed the final harness successfully, but it is only one independent fuzzer and does
not clear the pinned nightly gate. The target-chain checks are read-only evidence at one pinned block, not deployment
verification. See the dedicated campaign, static, formal, mutation, Uniswap, residual-risk, and release-checklist files
in this directory.
