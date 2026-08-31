# Mine Router migration state machine

For each accepted cutover `G_n -> G_n+1`, Mine validates only the new reciprocal identity graph and writes the future
deposit destination. It does not call either graph or move balances, schedules, signal, votes, claims, Strategies, or
Bribes.

Deposits before the successful setter transaction remain attributable to `G_n`; later deposits use `G_n+1`. Every old
graph remains independently routable, claimable, and unsignalable under its own state. Users voluntarily recover GBX
from an old SignalGBX and may signal it into the new graph; no cross-graph impersonation or forced migration exists.
