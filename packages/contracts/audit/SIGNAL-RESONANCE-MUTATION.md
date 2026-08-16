# Signal and Resonance mutation campaign

Run date: 2026-08-16. Runner:
`node audit/run-signal-resonance-mutations.mjs`. Raw report:
`audit/reports/signal-resonance-mutation-latest.json` (ignored engineering evidence).

The runner creates an exact disposable package copy below `packages/.signal-resonance-mutation.*`, applies one pinned
text mutation, runs its narrow deterministic regression with 1,000 fuzz runs available, restores the source, records
the result, and removes only the validated temporary path.

## Result

43 of 43 mutants were killed: 100% raw mutation score; zero survivors.

| Family                                                                                                    | Mutants | Result    |
| --------------------------------------------------------------------------------------------------------- | ------: | --------- |
| Restored idle stake/unstake, mint/burn/hook/transfer/vote-supply drift                                    |       9 | 9 killed  |
| Resonance authorization, Bribe synchronization, checkpointing, precision, stream, receiver, and lifecycle |      21 | 21 killed |
| ResonanceRouter boundary and Strategy claim-before-snapshot                                               |       2 | 2 killed  |
| 90/10 constants, destination swap, cumulative remainder, and double settlement                            |       6 | 6 killed  |
| Bribe duration, entry/exit carry, double claim, and receiver redirect                                     |       5 | 5 killed  |

The set explicitly kills restored idle selectors, missing receipt mint/burn, missing Resonance or Bribe mutation,
public signal hooks, transferability, move minting, burn-before-removal, omitted or post-balance checkpoints, `1e36` to
`1e18`, lost stream remainder/leftover, duration drift, arbitrary receivers, final-Strategy death, double dead-weight
subtraction, blocked killed-Strategy exit, stale purchase inventory, Router comparison drift, 90/10 drift, swapped
classification, lost split carry, uncleared liabilities, lost Bribe carry, and uncleared claims.

There are no surviving mutants requiring `equivalent`, `unreachable`, `test gap`, `spec ambiguity`, or `real defect`
classification in this run. Text-pinned mutation is intentionally narrow: compiler-equivalent transformations and
mutations outside the listed security boundaries are not evidence-covered by this score.
