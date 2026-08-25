# References

Primary sources behind the whitepaper's claims. The typeset edition's Appendix J mirrors
this list; the claim-by-claim mapping lives in `FACT-CHECK.md`.

## This repository

- Current implementation evidence: `packages/contracts/src/core` in the working tree. It is not release-pinned and a
  green local build remains engineering evidence only.
- Audit records: `packages/contracts/audit/` (`FINDINGS`, `INDEPENDENT-SPECIFICATION`, `MUTATION-TESTING`,
  `FORMAL-CHECKS`, `FORK-VALIDATION`, `RESIDUAL-RISKS`, and `RELEASE-CHECKLIST`). The current disposition register and
  byte-for-byte V12 export target `3ae171b997254b56602298d873b3918d1575b3c7`. The export is external review evidence,
  not a complete assurance package or release authorization; prior historical records remain recoverable from Git.
- Independent models and fixtures: `packages/simulations/` (TypeScript and Python,
  cross-checked at build time via `src/protocol-facts.mjs`).
- Design history: `docs/adr/0013` through `docs/adr/0050`, especially ADR 0019
  (incremental absolute signals and the historical eight-token cap), ADR 0021 (historical uniform 100% Fund
  settlement), ADR 0022 (fixed-principal LP fee routing), ADR 0031 (mandatory signal-backed sGBX), ADR 0036 (bounded
  global prospective Bribe share), ADR 0047 (Synthetix-shaped rewards and direct Strategy settlement), ADR 0048
  (sixteen-token Bribe bound and composed signal movement), ADR 0049 (trusted canonical GBX/USDG transfers), and ADR
  0050 (zero premint and an external LP token treated as an ordinary Strategy asset).
- Protocol documentation: `docs/ARCHITECTURE.md`, `docs/ECONOMICS.md`, `docs/EMISSIONS.md`,
  `docs/SPEC.md`, `docs/ACCESS_CONTROL.md`, `docs/INVARIANTS.md`,
  `docs/SECURITY-INVARIANTS.md`, `docs/THREAT_MODEL.md`, `docs/TRUST_ASSUMPTIONS.md`,
  `docs/SUPPORTED-TOKEN-MODEL.md`, `docs/DEPLOYMENT.md`.
- Licensing and provenance: `NOTICE`, `docs/LEGAL-PROVENANCE-BLOCKER.md` (unresolved;
  distribution and deployment blockers).

## External

- OpenZeppelin Contracts 5.6.1 - ERC-20, ERC20Permit, ERC20Votes, Ownable, ReentrancyGuard, SafeERC20, and Math.
  https://docs.openzeppelin.com/contracts/5.x/
- Uniswap V2 documentation, relevant only to review of an externally created fungible Uniswap v2-style USDG/GBX LP token that may be
  registered as an ordinary Strategy payment asset. No Uniswap code is embedded in the core. https://docs.uniswap.org/contracts/v2/
- Ethereum Improvement Proposals: EIP-20 (token standard), EIP-712 (typed signing),
  EIP-1153 (transient storage), EIP-2612 (permit). https://eips.ethereum.org/
- Solidity 0.8.26 documentation and known-issues list. https://docs.soliditylang.org/
- Robinhood Chain (chain ID 4663): read-only evidence pinned at block 32,035,314, hash
  `0xe13569d3a71001227e35d660dfbcfed1e7660d10b74c0c639e4bc0eab1555aea`
  (`packages/contracts/audit/FORK-VALIDATION.md`).
- USDG issuer documentation - stablecoin properties and issuer powers are held as
  external assumptions, not verified claims.

Upstream code lineage (adapted, with pinned commits and hashes recorded in `NOTICE`):
give.fun monorepo, Liquid Signal Governance, and - transitively for the auction shape -
Euler Fee Flow (GPL-2.0-or-later; an unresolved counsel item). Solidly and Synthetix
ancestry is disclosed by the upstream project without exact pins; resolving it is part of
the licensing blocker.
