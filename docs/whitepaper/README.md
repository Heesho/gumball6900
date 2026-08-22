# Typeset whitepaper source

`docs/WHITEPAPER.md` is the canonical prose. This directory renders a concise typeset edition whose facts are checked
against the current mining simulation fixture before HTML or PDF output is written.

```bash
pnpm docs:whitepaper
```

The current edition describes the immutable multislot Mine introduced by ADR 0024 and refined through ADRs 0033,
0038-0044: 20M genesis GBX, permanent Mine authority, exactly sixteen slots, hourly price decay, 80/20 nonempty
handoffs, tenure-locked slot rates, a provisional 64 GBX/second to 1 GBX/second schedule with 69-day periods, a
positive infinite tail, and Fund's constant-time effective-supply denominator. It also reflects ADR 0030's
non-transferable sGBX voting checkpoints and ADR 0034's external-governance ownership boundary, ADR 0031's mandatory
signal-backed receipt, ADR 0032's cumulative settlement foundation, ADR 0036's bounded global Bribe rate, and ADR
0037's high-precision Bribe reward index.

ADR 0044 makes exact ResonanceRouter deposit Mine's terminal revenue action. Mine emits `RevenueDeposited` but never
calls `route()`; later permissionless routing has no role, bounty, or liveness guarantee. LiquidityPosition's atomic
route attempt is unchanged, and optional frontend or cron composition remains periphery.

ADR 0036 supersedes only ADR 0032's fixed-rate rule. The typeset edition now describes one Resonance-owned global
prospective automatic-Bribe share: 10% by default, bounded from 0% through 20%, with Fund receiving the complement.
The same cumulative carry persists across rate changes, and 0% leaves signaling and independently funded rewards live.

ADR 0037 raises each paired Bribe's reward index to `1e36` without reading token decimals and couples the lifetime
notification cap to that scale. This prevents economically material six-decimal rewards from remaining below index
resolution at realistic sGBX supply while retaining the cumulative-overflow proof.

The ADR 0031, ADR 0036, and ADR 0037 implementations have landed: mandatory signal-backed sGBX with no idle receipts,
the bounded global acquired-asset Bribe share with weighted cumulative carry, and high-precision Bribe accounting.
The typeset edition therefore describes
implemented behaviour rather than target architecture. That is not a conformance proof: the current edition reflects
an uncommitted development tree rather than a pinned review candidate, and a local green build remains engineering
evidence, never a safety, audit, or release claim.

The output remains development documentation. Building it does not authorize distribution, deployment, or user funds.
