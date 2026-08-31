# CEX-03 Exact Change Preview

Status: **REVIEW ONLY — NOT APPROVED OR IMPLEMENTED**

Frozen source baseline: `70091b642006f0b2788bd89a6a0e734a632619cf`

This artifact shows the exact proposed production-Solidity change for the narrow CEX-03 remediation in
[Plan 001](./001-bounded-graph-local-signal-discovery.md). It was applied and compiled only in a disposable detached
worktree. The production Solidity tree in the shared workspace remains byte-for-byte unchanged from the frozen commit.

## Proposed disposition

CEX-03 is confirmed Medium. The narrow change makes an account's current Strategy keys enumerable within each new
`Resonance` graph without duplicating canonical amounts or weakening scalar exits:

- each paired Bribe remains the sole canonical per-account amount ledger;
- `Resonance` stores only an address membership set per account;
- a successful add inserts membership idempotently;
- a partial removal retains membership;
- a successful final canonical removal attempts membership deletion and ignores a logically absent member;
- killing a Strategy never deletes membership, so killed positions remain discoverable and removable;
- scalar removal never performs enumeration and remains the bounded exit path; and
- no authority, economics, migration, rescue, bulk-exit, or state-changing selector is added.

The remediation remains partial across Router cutovers: the caller must still know every historical `Resonance` address
to query. Plan 002 can preserve an authenticated append-only offchain inventory, but it cannot turn replaceable index
data into a core liveness dependency or retrofit an already deployed non-upgradeable graph.

Approving CEX-03 does not resolve or approve the separate confirmed Medium `SECURITY-01`; production remains blocked on
its later independent fix-or-explicit-acceptance decision.

## Exact proposed production diff

Only `packages/contracts/src/core/Resonance.sol` changes. The authoritative byte-exact zero-context unified patch is
[CEX03-EXACT-CHANGE.patch](./CEX03-EXACT-CHANGE.patch). It is reproduced below with ordinary context for review;
Markdown formatting may normalize whitespace-only context lines without changing the proposed source result.

The zero-context file deliberately avoids whitespace-only context records that would themselves fail the repository's
trailing-whitespace check. Verify it only against the frozen HEAD with
`git apply --index --unidiff-zero --check plans/CEX03-EXACT-CHANGE.patch`; ordinary `git apply` is not valid for this
format.

```diff
diff --git a/packages/contracts/src/core/Resonance.sol b/packages/contracts/src/core/Resonance.sol
index fda2600..9fffea3 100644
--- a/packages/contracts/src/core/Resonance.sol
+++ b/packages/contracts/src/core/Resonance.sol
@@ -7,6 +7,7 @@ import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
 import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
 import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
 import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

 import { Bribe } from "./Bribe.sol";
 import { BribeFactory } from "./BribeFactory.sol";
@@ -19,8 +20,9 @@ import { IResonanceRouterIdentity } from "./interfaces/IResonanceRouter.sol";
 /// @author heesho
 /// @notice Streams USDG revenue to live Strategies in proportion to their SignalGBX weights.
 /// @dev Uses one Synthetix-style seven-day stream and a global revenue-per-signal index. SignalGBX is the only caller
-///      allowed to change weights, and each paired Bribe is the canonical ledger for a Strategy's account and total
-///      weights. Weight changes checkpoint elapsed revenue before changing that ledger. Killing a Strategy checkpoints
+///      allowed to change weights. Each paired Bribe is the canonical ledger for a Strategy's account and total
+///      weights, while a graph-local address-only set exposes each account's current Strategy memberships. Weight
+///      changes checkpoint elapsed revenue before changing the canonical Bribe ledger. Killing a Strategy checkpoints
 ///      and preserves its accrued claim, removes its complete weight from the active total, and permanently excludes it
 ///      from later revenue while allowing existing signal to exit. The canonical deployment assumes six-decimal USDG
 ///      and eighteen-decimal SignalGBX, so the cumulative index uses 1e36 precision; this contract accounts only in raw
@@ -28,6 +30,7 @@ import { IResonanceRouterIdentity } from "./interfaces/IResonanceRouter.sol";
 ///      ERC-20; transfers use SafeERC20 but do not verify sender or receiver balance deltas. Rate, index, and Strategy-
 ///      level divisions round down, and the resulting undistributed USDG remains in this contract as surplus.
 contract Resonance is ReentrancyGuard, Ownable2Step {
+    using EnumerableSet for EnumerableSet.AddressSet;
     using SafeERC20 for IERC20;

     /// @notice Stores the single global USDG streaming schedule and its cumulative allocation index.
@@ -93,6 +96,9 @@ contract Resonance is ReentrancyGuard, Ownable2Step {
     address public resonanceRouter;
     /// @notice Current prospective share of each Strategy payment sent to its BribeRouter, in basis points.
     uint256 public bribeBps = DEFAULT_BRIBE_BPS;
+    /// @dev Graph-local address-only discovery metadata for each account's positive Strategy memberships. Each paired
+    ///      Bribe remains the canonical ledger for signal amounts.
+    mapping(address account => EnumerableSet.AddressSet strategies) private _signalStrategies;

     /// @notice Emitted when governance changes the prospective automatic-Bribe share.
     /// @param previousBribeBps Prior global payment share in basis points.
@@ -237,9 +243,10 @@ contract Resonance is ReentrancyGuard, Ownable2Step {

     /// @notice Adds signal weight for an account to a live Strategy.
     /// @dev Callable only by the immutable SignalGBX coordinator. Elapsed revenue is checkpointed for the Strategy at
-    ///      its prior weight before `totalSignalWeight` and the paired Bribe's canonical virtual balances increase.
-    ///      Reverts for a zero account, zero amount, unregistered Strategy, or killed Strategy. Emits `SignalAdded`
-    ///      after the paired Bribe emits `SignalWeightAdded`.
+    ///      its prior weight before `totalSignalWeight` and the paired Bribe's canonical virtual balances increase. Once
+    ///      the canonical Bribe update succeeds, the Strategy is inserted into the account's address-only discovery set
+    ///      idempotently. Reverts for a zero account, zero amount, unregistered Strategy, or killed Strategy. Emits
+    ///      `SignalAdded` after the paired Bribe emits `SignalWeightAdded`.
     /// @param account SignalGBX holder whose paired-Bribe weight increases.
     /// @param strategy Live registered Strategy receiving the weight.
     /// @param amount Raw SignalGBX units to add.
@@ -253,6 +260,7 @@ contract Resonance is ReentrancyGuard, Ownable2Step {

         totalSignalWeight += amount;
         Bribe(bribeFor[strategy]).addSignalWeight(account, amount);
+        _signalStrategies[account].add(strategy);

         emit SignalAdded(account, strategy, amount);
     }
@@ -262,8 +270,9 @@ contract Resonance is ReentrancyGuard, Ownable2Step {
     ///      prior weight before the paired Bribe's canonical virtual balances decrease. Exits remain available after a
     ///      Strategy is killed; killed weight was removed from `totalSignalWeight` at kill time and is not subtracted a
     ///      second time. Reverts for a zero account or amount, an unregistered Strategy, or an amount exceeding the
-    ///      account's weight in the paired Bribe. Emits `SignalRemoved` after the paired Bribe emits
-    ///      `SignalWeightRemoved`.
+    ///      account's weight in the paired Bribe. A successful final canonical removal also removes the Strategy from
+    ///      the account's discovery set; a missing metadata entry is ignored and cannot block that removal. Emits
+    ///      `SignalRemoved` after the paired Bribe emits `SignalWeightRemoved`.
     /// @param account SignalGBX holder whose paired-Bribe weight decreases.
     /// @param strategy Registered live or killed Strategy losing the weight.
     /// @param amount Raw SignalGBX units to remove.
@@ -280,6 +289,7 @@ contract Resonance is ReentrancyGuard, Ownable2Step {

         if (isStrategyLive[strategy]) totalSignalWeight -= amount;
         bribe.removeSignalWeight(account, amount);
+        if (amount == allocated) _signalStrategies[account].remove(strategy);

         emit SignalRemoved(account, strategy, amount);
     }
@@ -476,6 +486,27 @@ contract Resonance is ReentrancyGuard, Ownable2Step {
         emit BribeRewardTokenAdded(strategy, bribe, rewardToken);
     }

+    /// @notice Returns the number of Strategies in an account's graph-local signal-discovery set.
+    /// @dev O(1). The set records addresses only; each paired Bribe remains canonical for signal amounts. Enumeration
+    ///      order is unstable and may change after any membership addition or removal, so count and index reads must be
+    ///      pinned to the same block.
+    /// @param account Account whose current Strategy membership count is queried.
+    /// @return count Number of live-or-killed Strategy memberships currently recorded for the account.
+    function signalStrategyCount(address account) external view returns (uint256 count) {
+        return _signalStrategies[account].length();
+    }
+
+    /// @notice Returns one Strategy from an account's graph-local signal-discovery set.
+    /// @dev O(1). Enumeration order is unstable and may change after any membership addition or removal, so count and
+    ///      index reads must be pinned to the same block. Reverts with Solidity's array-out-of-bounds panic when `index`
+    ///      is not strictly less than `signalStrategyCount(account)`.
+    /// @param account Account whose Strategy membership is queried.
+    /// @param index Current zero-based set index.
+    /// @return strategy Live-or-killed Strategy address stored at `index`.
+    function signalStrategyAt(address account, uint256 index) external view returns (address strategy) {
+        return _signalStrategies[account].at(index);
+    }
+
     /// @notice Returns the current cumulative USDG allocation per raw unit of active SignalGBX weight.
     /// @dev Includes elapsed time through the earlier of the current timestamp and `periodFinish` without mutating
     ///      storage. If active weight is zero, the index does not increase and revenue elapsed during that interval is
```

## ABI and storage surface

| New function                        | Selector     | Mutability | Complexity |
| ----------------------------------- | ------------ | ---------- | ---------- |
| `signalStrategyCount(address)`      | `0xae63d5a5` | `view`     | O(1)       |
| `signalStrategyAt(address,uint256)` | `0xd6a86644` | `view`     | O(1)       |

The selectors do not collide with the frozen ABI. No `IResonance` change is proposed because no core contract consumes
the getters. No event, error, owner function, state-changing selector, `contains`, unbounded `values`, or bulk exit is
added.

The mapping is appended after all existing state. The compiler-reported baseline-to-preview tail is:

| State variable      | Baseline slot | Preview slot |
| ------------------- | ------------- | ------------ |
| `resonanceRouter`   | 15            | 15           |
| `bribeBps`          | 16            | 16           |
| `_signalStrategies` | —             | 17           |

This preserves every existing declared storage slot even though `Resonance` is directly deployed and non-upgradeable.

## Disposable simulation evidence

The exact diff above was compiled in a detached worktree with dependencies symlinked from the shared workspace and used
read-only by these checks. Existing tests prove compatibility only; they do not replace the new CEX-03 proof suite
required after approval.

A second disposable campaign then implemented the exact proposed adversarial proof tests without changing the shared
production tree. See [CEX-03 disposable proof evidence](./CEX03-DISPOSABLE-PROOF-EVIDENCE.md) and the
[byte-exact proof-test patch](./CEX03-DISPOSABLE-PROOFS.patch). It passed 100,000 randomized 32-step sequences, the full
401-test Foundry suite, the 1,000-run/500,000-call invariant campaign, and all four Hardhat parity tests. These remain
review evidence, not implementation authorization.

| Check                                                    | Result |
| -------------------------------------------------------- | ------ |
| `forge fmt --check`                                      | pass   |
| `forge build --sizes`                                    | pass   |
| `forge test --match-path test/minimal/Resonance.t.sol`   | 40/40  |
| `forge test --match-path test/minimal/SignalGBX.t.sol`   | 26/26  |
| `forge test --match-path test/minimal/GBXLauncher.t.sol` | 17/17  |

The three suites total 83 passing tests, including three 10,000-run fuzz cases. The canonical-launch regression still
passes at `22,074,230` gas.

| Affected contract/embedder     | Baseline runtime | Preview runtime | Delta | Preview runtime margin | Baseline init | Preview init | Delta | Preview init margin |
| ------------------------------ | ---------------: | --------------: | ----: | ---------------------: | ------------: | -----------: | ----: | ------------------: |
| `Resonance`                    |         10,671 B |        11,366 B | 695 B |               13,210 B |      11,462 B |     12,157 B | 695 B |            36,995 B |
| `GBXStrategyResonanceDeployer` |         21,286 B |        21,981 B | 695 B |                2,595 B |      21,314 B |     22,009 B | 695 B |            27,143 B |

`GBXLauncher` remains 23,471 runtime bytes with a 1,105-byte EIP-170 margin in this simulation. The build emitted only
the repository's pre-existing Foundry lint warnings; it produced no compiler error or new size failure.

## Proof still required after approval

Implementation may begin only after the source baseline and approval gate in Plan 001 are resolved. The new proof suite
must include at least:

1. deterministic add, duplicate-add, partial-remove, final-remove, remove/re-add, kill, and multi-Strategy swap-and-pop
   transitions;
2. rollback of membership and every canonical ledger when a later SignalGBX hook or GBX transfer fails;
3. killed-position discovery through exact principal recovery;
4. registry-versus-canonical-Bribe invariants across scalar and batch transitions;
5. a Foundry-only absent-membership fault injection that clears both the set array length and that Strategy's set
   position before proving a final scalar exit still succeeds; clearing only the length creates artificial structural
   corruption and is not a valid absent-member simulation;
6. SDK pagination pinned to one block number and hash, with addresses snapshotted before writes or index zero re-read
   after each swap-and-pop removal, plus a fresh canonical Bribe amount read before each write;
7. focused mutations that fail if membership is added too early, removed on a partial exit or kill, retained after final
   removal, made canonical, or allowed to block an absent-member scalar exit;
8. fresh Echidna and Medusa campaigns of at least 100,000 calls each, unchanged Curve/Euler differentials, full mutation
   parity, size/gas checks, ABI synchronization, and two independent focused reviews; and
9. the later two fresh whole-system red-team passes, which occur only after every pending Medium has been fixed and
   verified or explicitly accepted, including `SECURITY-01`, and do not get satisfied by the focused CEX-03 reviews.

Ignoring `EnumerableSet.remove`'s false return protects a logically absent member. It does not promise recovery from
arbitrary direct corruption of the set's internal array/position storage; no normal protocol action can create that
structural corruption.

## Deployment consequences

The source file is the only production Solidity file edited, but the bytecode impact is broader:

- `GBXStrategyResonanceDeployer` embeds `Resonance` creation code, so its runtime/initcode and code hash change.
- Under the repository's metadata-disabled production compiler settings, byte-for-byte comparison changed only the
  compiled `Resonance` and `GBXStrategyResonanceDeployer` templates. The compiled `GBXLauncher`,
  `GBXRouterMineDeployer`, `ResonanceRouter`, and `Mine` templates remained identical.
- With fixed module and launcher addresses and salt, the changed creation code produces a different Resonance address.
  ResonanceRouter's constructor then receives that new Resonance, changing its CREATE2 initcode/address; Mine's
  constructor receives the new Router, changing Mine's CREATE2 initcode/address in turn. The unchanged Router and Mine
  source templates need not change byte-for-byte for their constructor-augmented deployment initcode to change. The
  deployed Router runtime also changes because Resonance is immutable; Mine's runtime does not change merely because
  its initial Router is stored rather than immutable.
- In the controlled fixed-infrastructure comparison, every other graph address stayed stable. The deployed Strategies
  and Bribes nevertheless received different runtime code because each embeds Resonance as an immutable; factory,
  SignalGBX, and GBX bindings also changed in storage without changing those contracts' compiled template hashes.
- An already deployed old component deployer contains the old Resonance creation code and cannot deploy this fix. A
  membership-capable graph requires a new reviewed module. If an old launcher is already deployed, its module reference
  is immutable, so it also requires a new launcher.
- If the patched module or launcher address changes, the modules' launcher-scoped salts can shift additional or all graph
  outputs. Recompute the complete graph rather than assuming unaffected addresses remain stable.
- Every predicted address, code hash, prefunding assumption, candidate manifest, pinned fork, and launch-gas artifact
  affected by the graph must be invalidated, regenerated, and independently reviewed before any launch claim.
- Mine's Router replacement validation checks only the limited reciprocal Router/Resonance/SignalGBX identity chain,
  not these new selectors or bytecode provenance. The launcher likewise checks identities, not the selectors or module
  provenance. A future replacement-graph review must explicitly require a membership-capable Resonance, or governance
  could recreate the same discovery failure. Mine must not be described as enforcing CEX-03 remediation.

No deployment configuration or candidate address is changed by this preview, and no external action is authorized.

## Exact implementation envelope after approval

Plan 001 also requires synchronized generated ABI/SDK readers, narrow documentation updates, deterministic/fuzz/invariant
tests, mutation/fuzzer evidence, and a partial finding disposition. Plan 002 independently adds graph-scoped, origin-block
subgraph inventory and fail-closed discovery coverage. It adds no Solidity, ABI, protocol selector, or authority.

Explicit nonchanges remain: `SignalGBX.sol`, `Bribe.sol`, `Mine.sol`, `IResonance.sol`, Strategy economics, Fund
redemption, routers, launcher source, governance, ownership, and deployment configuration.

## Maintainer decision

Choose one:

1. **Approve the narrow fix and Plans 001 + 002 (recommended).** Accept that the result is new-deployment-only, requires
   authenticated historical Resonance addresses, and leaves CEX-03 partially remediated rather than fully closed.
2. **Accept CEX-03.** Add no core storage/getters. Plan 002 may still be approved separately as operational indexing
   hardening.

No production implementation begins until that decision is explicit.
