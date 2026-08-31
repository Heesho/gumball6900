# Frozen target delta

The semantic-delta base is `f9912533e999454f1a3fd49276558bd85e1390da`; the target is
`70091b642006f0b2788bd89a6a0e734a632619cf`.

Across contracts, tests, audit records, SDK, subgraph, and configuration scope, the delta changes 84 files with 12,734
insertions and 376 deletions. Production Solidity changes include `Bribe`, `GBX`, `Mine`, `Resonance`, the
`IResonance` surface, a new revenue-migration identity interface, the single-use `GBXLauncher`, four stateless CREATE2
component deployers, and two Uniswap V2 interfaces.

Security-sensitive themes introduced or materially changed by the delta:

- lifetime revenue accounting and overflow headroom;
- beneficiary-authorized Bribe claims and cross-Bribe caller-owned batching;
- one-time genesis issuance and permanent Mine binding;
- the atomic launcher, caller-scoped CREATE2 namespaces, exact V2 seed, and permanent LP lock;
- Mine's future-only Router replacement graph and old/new graph liveness;
- independent `Ownable2Step` handoffs for Mine and Resonance;
- ABI, SDK, subgraph, deployment, and audit-harness changes coupled to those behaviors.

Historical evidence at the parent commit is not treated as coverage of this delta.
