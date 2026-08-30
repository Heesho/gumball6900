# Typeset whitepaper source

`docs/WHITEPAPER.md` is the canonical prose. This directory renders a concise typeset edition whose facts are checked
against the current mining simulation fixture before HTML or PDF output is written.

```bash
pnpm docs:whitepaper
```

The current edition describes the immutable multislot Mine introduced by ADR 0024 and refined through ADRs 0033 and
0038-0045: zero GBX constructor supply, permanent Mine authority, exactly sixteen slots, hourly price decay, 80/20 nonempty
replacements, tenure-locked slot rates, a provisional 64 GBX/second to 1 GBX/second schedule with 69-day periods, a
positive infinite tail, and Fund's constant-time effective-supply denominator. It also reflects ADR 0030's
non-transferable sGBX voting checkpoints and ADR 0034's external-governance ownership boundary, ADR 0031's mandatory
signal-backed receipt, ADR 0036's bounded global Bribe rate, ADR 0037's high-precision Bribe reward index, ADR 0046's
scalar USDG-only Resonance state, ADR 0047's Synthetix-shaped rewards and direct Strategy settlement, and ADR 0048's
sixteen-token Bribe bound and removal of the Resonance move hook. ADR 0049 removes balance-delta snapshots from canonical GBX/USDG
paths while preserving Fund's arbitrary-asset redemption guards. ADR 0050 removes the old canonical liquidity
contract and 20 million GBX allocation. ADR 0054 partially supersedes its zero-completed-supply and external-bootstrap
rules: a one-shot launcher directs Mine's fixed 1,000 GBX genesis issuance plus 1 USDG into the pinned Robinhood
Uniswap V2 pair, permanently locks every genesis LP unit, and registers GBX plus that LP as the initial Strategies.
ADR 0051 adds scalar and batched add/remove signal entrypoints, removes the public
permit/move paths, and confines read convenience to the stateless Lens/subgraph and write composition to direct-call
SDK helpers. ADR 0052 adds the precision-coupled lifetime admission cap that preserves Resonance signal exits, and ADR
0053 restricts direct Bribe claims to the beneficiary or immutable Resonance while adding caller-owned cross-Bribe
batching in Resonance.

The launcher is GBX-specific deployment infrastructure, not a continuing liquidity manager or a generic fund factory.
Only the genesis LP is locked. Later fungible LP acquired by Fund remains ordinary caller-selectable redemption
backing, and neither the launcher nor the core prices, rebalances, harvests, swaps, or guarantees liquidity.

ADR 0044 makes ResonanceRouter deposit Mine's terminal revenue action. Under ADR 0049 Mine requests the nominal amount
through `SafeERC20` without inspecting balance deltas. Mine emits `RevenueDeposited` but never
calls `route()`; later permissionless routing has no role, bounty, or liveness guarantee. Optional frontend or cron
composition remains periphery.

ADR 0047 preserves ADR 0036's one Resonance-owned global prospective automatic-Bribe share: 10% by default and bounded
from 0% through 20%. Each Strategy floors each purchase's Bribe share independently, sends the complement directly to
Fund, and transfers the Bribe share to its small permissionless Router. There is no cumulative split carry or deferred
Fund liability; 0% leaves signaling and independently funded rewards live.

ADR 0037 raises each paired Bribe's reward index to `1e36` without reading token decimals and couples the lifetime
notification cap to that scale. This prevents economically material six-decimal rewards from remaining below index
resolution at realistic sGBX supply while retaining the cumulative-overflow proof.

The ADR 0031 and ADRs 0036-0054 implementations have landed in the uncommitted development tree: mandatory
signal-backed sGBX with no idle receipts, the
bounded global acquired-asset Bribe share, scalar Resonance accounting, ordinary leftover rollover and floor surplus,
all-token plus scalar Bribe claims, direct Fund settlement, BribeRouter-only buffering, a fixed sixteen-token Bribe
limit, scalar and batched SignalGBX additions/removals, a bounded Resonance revenue index, beneficiary-authorized Bribe
claims, caller-owned Resonance claim batching, and the atomic fixed-genesis launcher. The typeset
edition therefore describes implemented behaviour rather than target architecture. That is not a conformance proof.
V12 reviewed source commit `3ae171b997254b56602298d873b3918d1575b3c7`; it did not cover ADRs 0051-0055. The current
edition is based on `f9912533e999454f1a3fd49276558bd85e1390da` plus uncommitted remediation and spans that post-V12
delta. Internal verification remains engineering evidence, never independent assurance or a safety/release claim.

The output remains development documentation. Building it does not authorize distribution, deployment, or user funds.
