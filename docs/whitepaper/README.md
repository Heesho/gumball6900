# Typeset whitepaper source

`docs/WHITEPAPER.md` is the canonical prose. This directory renders a concise typeset edition whose facts are checked
against the current mining simulation fixture before HTML or PDF output is written.

```bash
pnpm docs:whitepaper
```

The current edition describes the immutable multislot Mine introduced by ADR 0024: 20M genesis GBX, permanent Mine
authority, one-to-sixteen slots, hourly price decay, 80/20 nonempty handoffs, tenure-locked slot rates, future-handoff
halvings, a positive infinite tail, and Fund checkpointing before redemption.

The output remains development documentation. Building it does not authorize distribution, deployment, or user funds.
