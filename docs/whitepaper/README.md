# Typeset whitepaper source

`docs/WHITEPAPER.md` is the canonical prose. This directory renders a concise typeset edition whose facts are checked
against the current mining simulation fixture before HTML or PDF output is written.

```bash
pnpm docs:whitepaper
```

The current edition describes the immutable multislot Mine introduced by ADR 0024 and refined through ADRs 0033 and
0038-0045: zero initial GBX supply, permanent Mine authority, exactly sixteen slots, hourly price decay, 80/20 nonempty
replacements, tenure-locked slot rates, a provisional 64 GBX/second to 1 GBX/second schedule with 69-day periods, a
positive infinite tail, and Fund's constant-time effective-supply denominator. It also reflects ADR 0030's
non-transferable sGBX voting checkpoints and ADR 0034's external-governance ownership boundary, ADR 0031's mandatory
signal-backed receipt, ADR 0036's bounded global Bribe rate, ADR 0037's high-precision Bribe reward index, ADR 0046's
scalar USDG-only Resonance state, ADR 0047's Synthetix-shaped rewards and direct Strategy settlement, and ADR 0048's
sixteen-token Bribe bound and composed signal moves. ADR 0049 removes balance-delta snapshots from canonical GBX/USDG
paths while preserving Fund's arbitrary-asset redemption guards. ADR 0050 removes the canonical liquidity contract and
premint; a reviewed, externally created fungible Uniswap v2-style USDG/GBX LP token may instead be registered as an
ordinary bootstrap Strategy asset.

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

The ADR 0031 and ADRs 0036-0050 implementations have landed: mandatory signal-backed sGBX with no idle receipts, the
bounded global acquired-asset Bribe share, scalar Resonance accounting, ordinary leftover rollover and floor surplus,
all-token plus scalar Bribe claims, direct Fund settlement, BribeRouter-only buffering, a fixed sixteen-token Bribe
limit, atomic moves composed from Resonance's retained remove/add hooks, zero-premint GBX, and no liquidity-specific
core surface. The typeset edition therefore describes
implemented behaviour rather than target architecture. That is not a conformance proof: the current edition targets
the V12 source commit `3ae171b997254b56602298d873b3918d1575b3c7`, whose finding export is incomplete and
not release-authorizing. A local green build remains engineering evidence, never a safety or release claim.

The output remains development documentation. Building it does not authorize distribution, deployment, or user funds.
