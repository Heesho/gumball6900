# ADR 0001: Supply-kernel wiring and bounded schedule calculation

- Status: Accepted
- Date: 2026-08-01
- Scope: `GBXToken`, `EmissionController`, and daily emission math

## Context

`GBXToken` must have exactly one non-replaceable minter, while `EmissionController` must hold an immutable GBX
reference. Constructing both contracts with immutable references would create a deployment cycle. The master specification
permits set-once references where construction order makes immutables impossible.

The emission curve also needs a `scheduledEmission(epochId)` view that agrees exactly with the authoritative stored
schedule. Because each elapsed epoch floor-rounds independently, fixed-point exponentiation is not bit-for-bit
equivalent to sequential decay.

## Decision

1. Deploy `GBXToken` first with an immutable deployment initializer and no minter.
2. Deploy `EmissionController` with the token as an immutable reference and the same deployment initializer.
3. Assign `EmissionController` to the token exactly once. The token requires deployed bytecode at that address.
4. Directly deploy `GenesisBootstrap` and `MiningPool`, then assign both callers to `EmissionController` in one set-once
   operation. Neither initializer retains any post-initialization authority.
5. Require mining epoch IDs to advance one at a time. A zero-demand epoch advances the schedule but performs no token
   mint, so unused emission never carries forward.
6. Advance stored schedule state with exactly one `Math.mulDiv(currentScheduledEmission, DAILY_DECAY, 1e18)` per
   settled epoch. Calculate previews by applying the identical sequential operation and stop early when the integer
   emission reaches zero. This keeps state and previews bit-for-bit identical across the required 100-year horizon.
7. Configure an optional immutable eligibility module in the GBX constructor. A zero module selects permissionless mode.
   A configured module checks receivers on mints and both sides of ordinary transfers. Burns bypass the module entirely,
   so compliance infrastructure cannot pause or censor real burns.

## Invariants affected

- Only `EmissionController` can mint GBX after initialization.
- The controller cannot be replaced.
- Genesis can mint exactly 80 million GBX to claims and 20 million GBX to protocol-owned liquidity, once.
- `cumulativeMinted` never exceeds one billion GBX.
- Burns never restore mint capacity.
- Empty mining epochs advance the decay curve and do not carry emission forward.
- A configured eligibility module fails closed for mints and transfers but cannot interfere with burns.

## Verification

Foundry unit and fuzz tests cover one-time wiring, authorization, exact genesis amounts, sequential epoch advancement,
zero-demand epochs, lifetime supply accounting, and the one-billion boundary. A Hardhat parity test compiles the same
source tree and confirms mint/burn accounting through the generated ABI.

## Privileged trust

The deployment initializer can choose the controller and caller contracts only while the system is unfunded and
uninitialized. Once each assignment succeeds it is irreversible, and the initializer has no mint, burn, or caller-
replacement capability. Deployment tooling must perform both assignments before accepting contributions.
