# Typeset whitepaper source

`docs/WHITEPAPER.md` is the canonical prose. This directory renders a concise typeset edition whose facts are checked
against the current mining simulation fixture before HTML or PDF output is written.

```bash
pnpm docs:whitepaper
```

The current edition describes the immutable multislot Mine introduced by ADR 0024: 20M genesis GBX, permanent Mine
authority, one-to-sixteen slots, hourly price decay, 80/20 nonempty handoffs, tenure-locked slot rates, future-handoff
halvings, a positive infinite tail, and Fund checkpointing before redemption. It also reflects ADR 0030's
non-transferable sGBX voting and the four-selector ProtocolGovernor/Timelock boundary, ADR 0031's mandatory
signal-backed receipt, and ADR 0032's immutable cumulative 90% Fund / 10% paired-Bribe acquired-asset settlement.

The ADR 0031 and ADR 0032 implementation is pending. The typeset edition describes the target development architecture
and must not be cited as evidence that the current Solidity, tests, or consumers conform.

The output remains development documentation. Building it does not authorize distribution, deployment, or user funds.
