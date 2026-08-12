# Building the whitepaper

Run:

```bash
pnpm docs:whitepaper
```

Use the repository's pinned Node 22.23.1 and a local Chrome/Chromium (`CHROME_PATH` may override discovery). No network
access is needed.

The build:

1. checks current Mine facts against `packages/simulations/fixtures/economic-scenarios.json`;
2. verifies stylesheet contrast;
3. renders the current page source and blocks phrases from superseded protocol designs;
4. audits fixed A4 pages for clipping and overprinting;
5. prints with embedded fonts and stamps development-status metadata; and
6. replaces `output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf` only after verification succeeds.

`--html` stops after HTML generation, `--open` opens the completed PDF, and `--force` may bypass layout failures only
while drafting. A generated PDF is documentation, not a release artifact or authorization.
