# Ownership state machines

Mine and Resonance independently follow OpenZeppelin `Ownable2Step`:

`owner, no pending -> owner, pending -> pending accepts -> new owner, no pending`.

Before acceptance, only the current owner retains custom authority and may replace or cancel the pending transfer. The
pending owner has no early authority. Immediate renunciation is irreversible and clears the pending owner through the
inherited implementation. One contract's transfer or acceptance never changes the other.

SignalGBX, StrategyFactory, and BribeFactory use setup-only plain `Ownable`; their one-time bindings must be consumed
before ownership is renounced permanently.
