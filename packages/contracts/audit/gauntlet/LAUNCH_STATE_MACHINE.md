# Launch state machine

`unused -> executing -> reverted(unused)` or `unused -> executing -> launched`.

Authorization, chain/dependency checks, caller-scoped deployments, graph binding, genesis issuance, Factory Pair
creation, exact seed and LP verification, initial Strategy registration, setup-owner renunciation, and both pending
ownership assignments are one transaction. Any failure rolls back the launch flag and every created or transferred
state. The launched state exposes no callable path through which the launcher can exercise its temporary formal Mine or
Resonance ownership.
