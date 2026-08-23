# Signal and Resonance mutation campaign

> **Pre-ADR-0047 historical campaign.** The 49-mutant set and results below target the former exact-carry,
> queue/pause, deferred-liability, and weighted-split graph. ADR 0047 replaced those mechanics with scalar Synthetix
> scheduling, per-purchase Strategy splitting, direct Fund payment, and a Bribe-only Router. The recorded score is not
> current evidence, and the changed runner requires a fresh reviewed campaign.

Initial run date: 2026-08-16. Current-tree rerun: 2026-08-21. Runner:
`node audit/run-signal-resonance-mutations.mjs`. Raw report:
`audit/reports/signal-resonance-mutation-latest.json` (ignored engineering evidence).

The runner creates an exact disposable package copy below `packages/.signal-resonance-mutation.*`, applies one pinned
text mutation, runs its narrow deterministic regression with 1,000 fuzz runs available, restores the source, records
the result, and removes only the validated temporary path.

## Result

49 of 49 mutants were killed on the ADR 0036/0037 current tree: 100% raw mutation score; zero survivors.

| Family                                                                                                    | Mutants | Result    |
| --------------------------------------------------------------------------------------------------------- | ------: | --------- |
| Restored idle stake/unstake, mint/burn/hook/transfer/vote-supply drift                                    |       9 | 9 killed  |
| Resonance authorization, Bribe synchronization, checkpointing, precision, stream, receiver, and lifecycle |      21 | 21 killed |
| ResonanceRouter boundary and Strategy claim-before-snapshot                                               |       2 | 2 killed  |
| Global policy default, maximum, authorization, and inclusive bound                                        |       4 | 4 killed  |
| Prospective snapshot, policy binding, destination, weighted carry, and double settlement                  |       7 | 7 killed  |
| Bribe duration, precision, entry/exit carry, double claim, and receiver redirect                          |       6 | 6 killed  |

The set explicitly kills restored idle selectors, missing receipt mint/burn, missing Resonance or Bribe mutation,
public signal hooks, transferability, move minting, burn-before-removal, omitted or post-balance checkpoints, `1e36` to
`1e18`, lost stream remainder/leftover, duration drift, arbitrary receivers, final-Strategy death, double dead-weight
subtraction, blocked killed-Strategy exit, stale purchase inventory, Router comparison drift, policy default/range or
authorization drift, stale fixed-rate use, callback-late snapshots, policy-source misbinding, swapped
classification, lost weighted split carry, uncleared liabilities, lost Bribe carry, and uncleared claims.

The current replacement family mutates `DEFAULT_BRIBE_BPS`, `MAX_BRIBE_BPS`, owner authorization, inclusive maximum
acceptance, prospective rate reads, callback snapshot order, Router policy-source binding, weighted remainder carry,
classification destination, and independent settlement clearing.

There are no surviving mutants requiring `equivalent`, `unreachable`, `test gap`, `spec ambiguity`, or `real defect`
classification in the current run. Text-pinned mutation is intentionally narrow: compiler-equivalent transformations
and mutations outside the listed security boundaries are not evidence-covered by this score.
