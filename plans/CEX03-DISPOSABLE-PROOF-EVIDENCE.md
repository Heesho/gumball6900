# CEX-03 Disposable Adversarial Proof Evidence

Status: **REVIEW ONLY — NOT APPROVED OR IMPLEMENTED**

Frozen source baseline: `70091b642006f0b2788bd89a6a0e734a632619cf`

This record strengthens the pre-approval evidence for the exact production diff in
[CEX03-EXACT-CHANGE.patch](./CEX03-EXACT-CHANGE.patch). The production patch and three proof files were applied only in
a detached disposable worktree. The shared workspace's `packages/contracts/src` tree remained unchanged.

The exact proposed proof tests are preserved in
[CEX03-DISPOSABLE-PROOFS.patch](./CEX03-DISPOSABLE-PROOFS.patch), SHA-256
`94351fbbafcd6cd2b020afa7d29aec16e4ccbba2e421b8c4959b9f6cdd355383`. That patch depends on applying the production
preview first; it is evidence for review, not authorization to add either patch.

## New proof coverage

Nine deterministic/fuzz tests were added in the disposable worktree:

| Proof file                         | SHA-256                                                            | Coverage                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CEX03MembershipTransitions.t.sol` | `68d9d9c643d57e8e0e759d9103150b53d558cb3919b95b5a9e8c0e846afa9147` | First/duplicate add, partial/final remove, re-add, three-Strategy swap-and-pop, two-account same-Strategy isolation, killed discovery and exact exit, getter bounds |
| `CEX03RollbackProof.t.sol`         | `0c553e8a1b874057ec5dec1193b565d47f91cd8a32fcca1e4c1e2f9b9d371cdc` | Late GBX-return failure and later batch-allocation failure restore every earlier membership/canonical/custody transition                                            |
| `CEX03FaultFuzzProof.t.sol`        | `e5d1d76d46c580baae6ae33b10ce40279548fead7b0148e34aff8d985272c88a` | Slot-17 logically absent member, repair on later add, randomized canonical-membership and exact-exit state machine                                                  |

The rollback assertions cover membership count/address, account and aggregate Bribe weights, Resonance active weight,
sGBX balance/supply/votes/delegate, user GBX, and SignalGBX custody.

The fault injection used the compiler-reported layout, not a guessed slot. `_signalStrategies` is slot 17; for one
account, the test cleared both the nested EnumerableSet array length and the selected Strategy's `_positions` entry.
It did not create the invalid half-cleared structure that can make OpenZeppelin's `remove` panic.

## Results

| Command/evidence                                    | Result                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `forge fmt --check`                                 | pass                                                                                       |
| Final focused `CEX03*.t.sol` run                    | 9/9 pass, including the post-red-team two-account isolation regression                     |
| CEX-03 randomized sequence, default campaign        | 10,000 sequences × 32 decisions, pass                                                      |
| CEX-03 randomized sequence, promoted campaign       | 100,000 sequences × 32 decisions, pass                                                     |
| Complete `forge test -vv`                           | 401/401 tests across 33 suites, 0 failed/skipped, before the test-only isolation addition  |
| Stateful invariant suite                            | 30 invariants plus 2 harness checks; 1,000 runs and 500,000 calls per invariant, 0 reverts |
| Independent economic differential suite             | 6/6 properties, 10,000 runs each                                                           |
| Maximum-reward 32-Strategy rollback/scalar fallback | pass; failed batch consumed 31,975,451 gas before rollback                                 |
| `pnpm test:hardhat`                                 | 4/4 pass, including Foundry/Hardhat deployable-bytecode parity                             |
| Compiler-reported storage layout                    | existing slots 0–16 preserved; `_signalStrategies` at slot 17                              |

Every randomized sequence finished by scalar-removing every remaining position, whether live or killed, and asserted
recovery of the exact initial GBX principal. The set was checked after every decision for membership if and only if the
paired Bribe's canonical account weight was positive, uniqueness, receipt/supply/vote/custody equality, and live-only
global-weight equality.

The complete run also re-executed Fund solvency/redemption, Mine, Strategy, Bribe, Router, launcher
precreation/prefund, callback, reward-cap, broken-token isolation, gas, and historical exitability suites against the
exact production preview. The later isolation regression changed only a disposable proof file, not that production
preview.

## Evidence boundaries

- These results prove the reviewed patch's transition and rollback behavior in a disposable local build. They do not
  authorize or constitute a production source change.
- Generated ABI, SDK, subgraph, documentation, mutation, Echidna, and Medusa changes required by Plan 001 remain
  unapplied. The two final whole-system red-team passes have not begun.
- Already deployed Resonance instances cannot receive the storage/getters. Unknown historical Resonance addresses still
  require authenticated history. CEX-03 therefore remains only partially remediable under the approved architecture.
- `SECURITY-01` remains a separate confirmed Medium requiring its own fix-or-explicit-acceptance decision.
- No deployment, transaction, manifest, release, or clearance claim is supported by this evidence.

The maintainer approval choice in the exact preview is unchanged.
