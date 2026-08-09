# Formal and symbolic checks

The protocol is not formally verified.

The current evidence consists of executable Foundry invariants, independent Python and TypeScript conservation
models, compiler overflow checks, and targeted property fuzzing. These cover supply ceilings, minter lock, sequential
emissions, signal identities, exact revenue/reward conservation, complete Strategy-to-Fund settlement, deferred GBX
burning, redemption snapshots, duplicate rejection, and LP custody/growth. They are testing evidence, not
mathematical proof of all EVM
behaviors.

Mythril 0.24.8 is pinned in `audit/toolchain.lock`, but its checked-in runner depends on the nightly tool installation
and did not execute in this environment. No Certora, Halmos, Kontrol, hevm symbolic, or Solidity SMTChecker proof
specification is checked in for the current graph. Symbolic result: blocked/unavailable.

The two unfixed compiler bugs listed for Solidity 0.8.26 were reviewed:

- `SOL-2026-2 UnsoundSpillInMutualRecursion` requires `viaIR=true`; this build uses the legacy pipeline and has no
  mutually recursive production functions.
- `SOL-2025-1 LostStorageArrayWriteOnSlotOverflow` requires an intentionally boundary-straddling storage array. The
  core uses ordinary compiler-assigned storage and no custom storage layout near `2**256 - 1`.

Neither bug is applicable to this build configuration. Moving to Solidity 0.8.36 would change bytecode and dependency
compatibility and was not performed without a dedicated upgrade campaign.
