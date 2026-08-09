# Formal and symbolic checks

The protocol is not formally verified.

The current evidence consists of executable Foundry invariants, independent Python and TypeScript conservation
models, compiler overflow checks, and targeted property fuzzing. These cover supply ceilings, minter lock, sequential
emissions, signal identities, exact revenue/reward conservation, complete Strategy-to-Fund settlement, deferred GBX
burning, redemption snapshots, duplicate rejection, and LP custody/growth. They are testing evidence, not
mathematical proof of all EVM
behaviors.

Mythril 0.24.8 is pinned in `audit/toolchain.lock`. The audit corrected its policy from the deleted legacy graph to
the exact 12 current production contracts and ran:

```bash
node audit/check-mythril-findings.mjs --run audit/mythril-policy.json . audit/reports
```

The runner failed closed before launching analysis. Ten contracts contain constructor-resolved immutable references,
and deployed runtimes must be linked from actual constructor values before sound analysis. The runtime templates also
contain Cancun instructions Mythril 0.24.8 cannot safely interpret: `MCOPY` in GBX, SignalGBX, and
LiquidityPosition, plus `TLOAD`/`TSTORE` in Fund. The summary is retained under ignored raw reports. This is a current
symbolic compatibility blocker, not a pass and not merely an unavailable Docker image.

No Certora, Halmos, Kontrol, hevm symbolic, or Solidity SMTChecker proof specification is checked in for the current
graph. Symbolic result: blocked/unavailable. Any later runner must analyze constructor-resolved deployed bytecode and
remain Cancun-aware; analyzing creation templates or silently treating unknown opcodes as legacy instructions is not
acceptable.

The two unfixed compiler bugs listed for Solidity 0.8.26 were reviewed:

- `SOL-2026-2 UnsoundSpillInMutualRecursion` requires `viaIR=true`; this build uses the legacy pipeline and has no
  mutually recursive production functions.
- `SOL-2025-1 LostStorageArrayWriteOnSlotOverflow` requires an intentionally boundary-straddling storage array. The
  core uses ordinary compiler-assigned storage and no custom storage layout near `2**256 - 1`.

Neither bug is applicable to this build configuration. Moving to Solidity 0.8.36 would change bytecode and dependency
compatibility and was not performed without a dedicated upgrade campaign.
