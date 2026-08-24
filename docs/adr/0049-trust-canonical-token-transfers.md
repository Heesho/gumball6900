# ADR 0049: Trust canonical token transfers

- Status: accepted for Mine and SignalGBX; its LiquidityPosition provisions are superseded by ADR 0050; not audited,
  deployed, or approved for user funds
- Date: 2026-08-24
- Supersedes: ADR 0031 only where it requires SignalGBX to verify GBX sender and receiver balance deltas; ADR 0044 only
  where it requires Mine to verify USDG sender and receiver balance deltas; and ADR 0022 only where it requires
  LiquidityPosition to verify canonical GBX and USDG transfer deltas
- Preserves: one-for-one SignalGBX accounting, Mine's 80/20 nominal payment split and pull claims, Mine's terminal
  ResonanceRouter deposit boundary and Fund's exact selected-token payout and basket guards; the preserved
  LiquidityPosition boundary is later removed by ADR 0050

## Context

GBX and USDG are canonical deployment dependencies rather than permissionlessly registered assets. Deployment fixes
their identities and reviews their implementations. The protocol supports them only as standard, non-rebasing ERC-20s
whose successful transfer moves the requested amount.

Mine, SignalGBX, and LiquidityPosition nevertheless surrounded their canonical-token transfers with sender and
receiver `balanceOf` snapshots. Those checks rejected fee, surcharge, partial-transfer, and rebasing behavior, but
they could not make a malicious token safe: a hostile token can lie through `balanceOf`, reenter, block transfers, or
change behavior. The repeated snapshots increased bytecode, external calls, gas, and review surface while duplicating
the canonical-token trust assumption already used at other core transfer boundaries.

Fund is different. It is a permissionless raw-token treasury, and a redeemer may select arbitrary token addresses.
Its transfer-delta and basket checks defend the caller-selected redemption calculation against fee tokens and multiple
facades backed by one shared ledger. That boundary cannot rely on the same canonical-token review.

## Decision

Mine uses `SafeERC20.safeTransferFrom` to collect the nominal USDG price and `SafeERC20.safeTransfer` to send the
nominal protocol share to ResonanceRouter and to pay a displaced-miner claim. It does not snapshot payer, Mine,
Router, or claimant balances around those transfers. `RevenueDeposited.amount` records the requested protocol share;
under the supported USDG model, that amount is the amount delivered to ResonanceRouter. The event still does not mean
the Router forwarded USDG into Resonance in the same transaction.

SignalGBX uses `SafeERC20.safeTransferFrom` for the GBX deposit and `SafeERC20.safeTransfer` for withdrawal. It does
not snapshot sender or receiver balances. The successful state transition still deposits, mints, assigns, removes,
burns, and returns the same nominal raw amount atomically. This is safe only because the bound GBX is the canonical
standard token; unsupported movement semantics could break one-for-one backing.

LiquidityPosition reads its complete canonical USDG and GBX balances, transfers those nominal amounts with
`SafeERC20`, then calls `ResonanceRouter.route()` and `Fund.burnGBX()` as before. It does not compare its debit with the
destination credit. Fee collection, principal verification, routing, and burning remain one atomic transaction.

Fund does not change. Every selected non-GBX redemption token retains exact debit/credit verification, the
pre-transfer balance guard, and the final basket-wide retained-balance guard. The zero-address, GBX, and duplicate
selection rules also remain.

No fee-on-transfer, rebasing, surcharge, partial-transfer, mutable-blocklist, or adversarial-token support is added.
`SafeERC20` verifies call success and conventional optional return values; it does not prove balance movement. The
deployment and governance processes remain responsible for admitting only supported token implementations.

## Accepted consequences

- Canonical GBX/USDG transfer code is shorter and consistent with the core's standard-token model.
- Canonical transfer paths use fewer external `balanceOf` calls and have smaller review and gas surface.
- Mine, SignalGBX, and LiquidityPosition now trust successful canonical-token calls to move the requested amount. If a
  bound canonical token violates that assumption, accounting can be underfunded or otherwise incorrect without an
  `InexactTransfer`-style revert.
- `SafeERC20` is compatibility and call-success handling, not protection from a malicious token implementation.
- Fund remains intentionally stricter because its selected assets are arbitrary and may not have undergone canonical
  deployment review.
- This development change requires coordinated Solidity, test, ABI, SDK, subgraph, documentation, and audit-evidence
  updates. A green local build is engineering evidence, not audit or deployment approval.
