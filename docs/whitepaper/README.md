# Whitepaper build support

[`docs/WHITEPAPER.md`](../WHITEPAPER.md) is the sole whitepaper prose source. The files retained
here are only its build code and shared presentation assets: the logo, the licensed Modak font,
and print design tokens. They are not a second edition.

Build the sole PDF output with:

```bash
pnpm docs:whitepaper
```

The command cross-checks contract and economic-fixture constants, rejects known stale claims,
renders to a staging file, and verifies A4 pages, title metadata, embedded Unicode fonts, and
recoverable status text before atomically replacing `output/pdf/GumBall6900-whitepaper.pdf`.
Building documentation is engineering evidence only; it does not authorize distribution,
deployment, or user funds.
