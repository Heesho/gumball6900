# Canonical contract starting point

> This is the active development architecture, not a deployment, audit, or authorization for user funds.

## Core graph

```text
slot replacement -> Mine -> 20% ResonanceRouter -> Resonance -> seven-day stream -> Strategies
                          -> 80% displaced-miner claim
                                      |       |
                                      |       +-> complete payment -> BribeRouter -> Fund
                                      +-> independently funded Bribes -> signalers

Uniswap v4 position -> LiquidityPosition -> USDG -> ResonanceRouter -> Resonance
                                        -> GBX -> Fund -> atomic burn

GBX -> SignalGBX -> signals -> Resonance
                  -> votes -> ProtocolGovernor -> Timelock -> Resonance / Mine
```

The first purchase of an empty mining slot has no displaced miner, so its complete USDG payment routes through
ResonanceRouter. GBX holders stake one-for-one into non-transferable SignalGBX (`sGBX`), which is both the ERC20Votes
governance token and the sole user-facing signal coordinator. They allocate absolute amounts among active Strategies;
idle sGBX can vote, and any unallocated sGBX may be unstaked immediately.

## Contract responsibilities

| Contract            | Responsibility and important boundaries                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GBX`               | Creates the 20 million genesis-liquidity allocation, permanently hands mint authority to Mine, and supports ERC-2612 permit. It has no voting checkpoints.           |
| `Mine`              | Runs one to sixteen independently replaceable hourly reverse-Dutch slots, checkpoints continuous GBX accrual, and splits nonempty-slot replacement payments 80%/20%. |
| `LiquidityPosition` | Ownerless holder of one precommitted hookless GBX/USDG v4 NFT. Harvesting preserves principal, sends USDG to ResonanceRouter, and burns collected GBX through Fund.  |
| `SignalGBX`         | Holds staked GBX, mints non-transferable ERC20Votes sGBX, and coordinates every signal. It has no approval permit; idle balances can govern.                         |
| `ResonanceRouter`   | Holds USDG below the active amount left, then permissionlessly forwards its complete qualifying balance.                                                             |
| `Resonance`         | Maintains the active signal total and one Bribe-shaped seven-day USDG schedule, and creates the fixed Strategy/Bribe graph.                                          |
| `StrategyFactory`   | Bound once to Resonance; only that Resonance may deploy Strategies and their BribeRouters.                                                                           |
| `Strategy`          | Sells its complete USDG balance through a bounded linearly declining price. Its complete payment becomes a fixed Fund liability.                                     |
| `BribeFactory`      | Bound once to Resonance; only that Resonance may deploy Bribes.                                                                                                      |
| `BribeRouter`       | Pulls a complete Strategy payment once and records it as a fixed Fund liability payable by any caller.                                                               |
| `Bribe`             | Streams up to eight independently funded reward tokens over virtual signal balances.                                                                                 |
| `Fund`              | Ownerless raw-token treasury, permissionless GBX burn boundary, and caller-selected pro-rata redemption mechanism.                                                   |
| `ProtocolGovernor`  | Uses sGBX checkpoints to propose only four exact zero-value calls through the immutable Timelock and target graph.                                                   |

## Supply and mining

GBX mints exactly 20 million tokens for genesis liquidity at construction. Its temporary deployment minter may call
`setMinter` exactly once, and only with a deployed contract. That permanently locks the Mine as the only issuer. The
supply identity is:

```text
GBX total supply = GBX lifetime minted - GBX lifetime burned
```

Mine starts with one slot. The timelock may only increase capacity, up to the immutable cap of sixteen. Each slot may
be replaced at any time. Its quoted USDG price falls linearly from `initialPrice` to zero over one hour. A nonempty-slot
replacement makes 80% of the price claimable by the displaced miner and routes 20% through ResonanceRouter. An empty
slot routes 100% because there is no displaced miner. Payments are exact-transfer checked.

Each new occupant receives `current global GBX/second / current capacity`. That assigned rate is locked for the entire
tenure. Checkpointing, threshold crossings, Fund redemptions, and later capacity increases do not change it. For
example, if an incumbent holds 100 GBX/hour and capacity grows from one to three, that incumbent keeps 100 GBX/hour;
new occupants receive approximately one third of the then-current global rate. The accepted consequence is temporarily
higher aggregate issuance until older slots turn over.

The global rate used for future handoffs halves at constructor-immutable cumulative-mining thresholds and eventually
reaches a strictly positive immutable tail. There is no protocol-defined economic maximum GBX supply, rate setter,
oracle, migration, or team
fee. Exact production parameters remain deployment inputs.

## Genesis liquidity and fees

The canonical Uniswap v4 position starts entirely in GBX, outside the active starting price, using the 20 million
genesis allocation. `LiquidityPosition` accepts only the precommitted PositionManager, NFT ID, hookless GBX/USDG pool,
tick range, and a nonzero-liquidity position.

Anyone may call `harvestFees`. A zero-liquidity decrease collects fees while preserving principal. Complete USDG
proceeds transfer to ResonanceRouter, which forwards them when its complete balance qualifies and otherwise retains
them. Complete GBX proceeds transfer to Fund and are burned atomically. The NFT never moves.

## Revenue and acquisition rules

- Resonance uses one active seven-day USDG schedule. Its raw quotient plus front-loaded remainder releases the complete
  scheduled amount, including a one-raw-unit stream; its global reward-per-signal index uses `1e36` precision.
- SignalGBX is the only external signal entrypoint. Its signal changes checkpoint elapsed revenue under the prior
  weights before changing them. A Strategy purchase checkpoints and transfers its released allocation before reading
  inventory. No lock, cooldown, or epoch is added.
- SignalGBX stores each account's aggregate allocation, each paired Bribe stores account-by-Strategy balances and
  per-Strategy supply, and Resonance stores only the active live-Strategy total.
- `stakeAndSignal`, `stakeAndSignalWithPermit`, `moveSignal`, and `removeSignalAndUnstake` provide atomic combined
  workflows. The permit variant uses GBX's ERC-2612 permit; SignalGBX has no approval permit.
- During an active schedule ResonanceRouter holds a balance below the exact amount left. Once its complete balance is at
  least `left`, Resonance checkpoints and restarts seven days with `reward + left`; there is no absolute minimum.
- Released revenue is indexed pro rata across live Strategy weights. Global-index and per-Strategy floors remain
  accepted surplus. Revenue elapsed while active signal weight is zero and USDG donated directly to Resonance are also
  unclaimable or unscheduled surplus, with no Fund classification, synchronization, rescue, or recovery path.
- Killing a Strategy is irreversible: the kill checkpoints and preserves its accrued claim, excludes its complete
  weight from active rewards, rejects additions, and lets existing signalers remove without subtracting that weight
  from the active total a second time.
- Idle sGBX earns nothing and dilutes nothing; `totalSignalWeight` may be below staked supply.
- Every Strategy's complete payment becomes a fixed Fund liability.
- A GBX Strategy payment is not burned at settlement. Once paid to Fund, anyone may burn it with `Fund.burnGBX`.
- Bribes receive only independent reward notifications and never a built-in share of Strategy payments.

## Fund redemption

Before every redemption, Fund checkpoints every live mining slot. This crystallizes accrued GBX before the common
pre-burn denominator is captured:

```text
payout(token) = floor(Fund balance(token) * GBX burned / GBX total supply before burn)
```

The caller chooses a nonempty array of unique non-GBX tokens. Fund snapshots balances, transfers in and burns GBX,
then transfers each payout atomically. EIP-1153 transient storage rejects duplicate entries without maintaining an
asset registry. Omitted assets remain for the post-redemption supply.

## Governance

There is no migration or upgrade path. Fund and LiquidityPosition are ownerless. TimelockController owns Resonance and
Mine, and ProtocolGovernor is its sole proposer. The continuing administrative surface is exactly:

- `Resonance.addStrategy`;
- `Resonance.killStrategy`;
- `Resonance.addBribeReward`, subject to the immutable eight-token cap; and
- `Mine.increaseCapacity`, which can only increase from one to at most sixteen and never reprices incumbents.

ProtocolGovernor accepts only those exact zero-value calls at immutable Resonance and Mine targets. Its voting delay,
period, proposal threshold, and quorum percentage are immutable constructor inputs and use SignalGBX's block-number
clock. Execution is permissionless after the configured Timelock delay. There is no multisig bypass, external default
administrator, guardian, or queued-proposal veto; standard proposer cancellation ends when a proposal leaves Pending.
Every reviewed initial Strategy is bootstrapped by the temporary setup owner before Resonance and Mine ownership moves
to the Timelock and that temporary authority is removed.

## Deliberate scope

- Deployment broadcasting is intentionally absent.
- Exact Mine economics and v4 pool parameters remain unresolved deployment inputs.
- Independent security review and production deployment evidence remain required.
- Farplace provenance and licensing clearance remain a release blocker recorded in `NOTICE`.

## Credit

The starting mechanics are adapted from give.fun, Liquid Signal Governance, and Farplace MineRig. Strategy's auction
design also credits Euler Fee Flow. Exact repository pins are recorded in `NOTICE`.
