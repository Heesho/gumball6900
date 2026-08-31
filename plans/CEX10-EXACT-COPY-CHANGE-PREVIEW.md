# CEX-10 Exact Copy Change Preview

Status: **APPROVED AND APPLIED TO THE UNCOMMITTED AUDIT CANDIDATE**

Frozen source baseline: `70091b642006f0b2788bd89a6a0e734a632619cf`

## Selected positioning

The maintainer selected **No premint** as the public positioning. Here it means no GBX allocation to a team, presale,
treasury, investor, or discretionary recipient. It does not mean that canonical launch leaves lifetime issuance at zero:
Mine issues exactly 1,000 GBX solely into the USDG/GBX Pair, and every genesis LP token is permanently locked.

The proposed copy keeps the headline while distinguishing:

- zero supply when the GBX constructor returns;
- the fixed 1,000 GBX canonical locked-liquidity issuance; and
- mining as the source of every subsequent GBX.

No contract, ABI, deployment, or economic file changed. The maintainer approved the byte-exact proposed public/test
diff, and that exact diff was then applied in the shared workspace. It is preserved as
[CEX10-EXACT-COPY-CHANGE.patch](./CEX10-EXACT-COPY-CHANGE.patch).

Patch SHA-256: `d5cd3fb73752b75ba45c336d5dc3f9d1db010db2ad715de30604004a9794d243`.

## Exact surfaces

- `apps/landing/docs/BRIEF.md`
- `apps/web/lib/protocol.ts`
- `apps/web/components/home/mechanism-dashboard.tsx`
- `apps/web/components/home/cinematic-hero.tsx`
- `apps/web/tests/minimal/honesty.test.ts`
- `docs/deck/gumball6900-deck.html`

The repository's README, whitepaper, facts, article, and one-pager already distinguish constructor-zero supply from the
fixed genesis-liquidity issuance and require no CEX-10 change.

## Verification

The exact patch was first exercised in a detached disposable worktree at the frozen baseline, then applied after
maintainer approval. The applied six-file diff has the same SHA-256 as the preserved patch.

| Check                                                 | Result                   |
| ----------------------------------------------------- | ------------------------ |
| Web Vitest suite selected through the package command | 4 files, 32 tests passed |
| Web TypeScript typecheck                              | passed                   |
| Web production build                                  | passed                   |
| Prettier check for all six changed files              | passed                   |
| `git diff --check`                                    | passed                   |
| Focused Mine/launcher supply proofs                   | 3 passed                 |
| Fresh independent read-only review                    | passed                   |

These results establish that the wording/type rename is mechanically compatible and accurately describes the source.
They do not publish the website or deck, provide visual acceptance, or authorize deployment.
