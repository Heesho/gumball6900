# Typeset whitepaper source

`docs/WHITEPAPER.md` is the canonical prose. This directory renders a concise typeset edition whose facts are checked
against the current mining simulation fixture before HTML or PDF output is written.

```bash
pnpm docs:whitepaper
```

The current edition describes the immutable multislot Mine introduced by ADR 0024: 20M genesis GBX, permanent Mine
authority, one-to-sixteen slots, hourly price decay, 80/20 nonempty handoffs, tenure-locked slot rates, future-handoff
halvings, a positive infinite tail, and Fund's constant-time effective-supply denominator. It also reflects ADR 0030's
non-transferable sGBX voting checkpoints and ADR 0034's external-governance ownership boundary, ADR 0031's mandatory
signal-backed receipt, ADR 0032's cumulative settlement foundation, and ADR 0036's bounded global Bribe rate.

ADR 0036 supersedes only ADR 0032's fixed-rate rule. The typeset edition now describes one Resonance-owned global
prospective automatic-Bribe share: 10% by default, bounded from 0% through 20%, with Fund receiving the complement.
The same cumulative carry persists across rate changes, and 0% leaves signaling and independently funded rewards live.

The ADR 0031 and ADR 0036 implementations have landed: mandatory signal-backed sGBX with no idle receipts, and the
bounded global acquired-asset Bribe share with weighted cumulative carry. The typeset edition therefore describes
implemented behaviour rather than target architecture. That is not a conformance proof: it reflects the source at the
commit it was built from, and a local green build remains engineering evidence, never a safety, audit, or release claim.

The output remains development documentation. Building it does not authorize distribution, deployment, or user funds.
