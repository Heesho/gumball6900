# Formal and symbolic checks

The protocol is not formally verified.

Current executable evidence covers the GBX supply identity; tenure-locked slot accrual; fixed sixteen-slot topology;
constant-time pending-emission equivalence to all-slot summation; future-handoff time boundaries; exact Mine 80/20
replacement allocation and terminal ResonanceRouter deposit without synchronous downstream routing; per-purchase
Strategy classification at bounded 0%–20% rates; direct Fund payment; BribeRouter buffering; scalar Synthetix
Resonance scheduling; ordinary Bribe leftover rollover and surplus floors; Mine claim solvency; effective-supply Fund
redemption; signal identities; reward solvency; Strategy settlement; redemption snapshots; and liquidity custody.
Independent TypeScript and Python models reproduce the mining formulas. The focused ADR-0048 migration suites pass
104/104 and exercise the sixteen-token bound and composed moves, but these are tests, not mathematical proofs. The
full external/formal campaign has not been rerun after ADR 0048.

Mythril 0.24.8 remains a fail-closed compatibility blocker. Sound analysis requires constructor-resolved deployed
runtimes, while current output includes immutable references and Cancun instructions the pinned Mythril does not safely
support. No Certora, Halmos, Kontrol, hevm symbolic, or Solidity SMTChecker proof covers the Mine graph.

The existing Solidity 0.8.26 compiler-bug review remains applicable: the build uses the legacy pipeline rather than
`viaIR`, has no mutual recursion, and does not place storage arrays near the `2**256 - 1` slot boundary. This narrow
review is not a general compiler correctness proof.
