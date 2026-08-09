# Canonical contract starting point

> This is the active development architecture, not a deployment, audit, or authorization for user funds. The previous
> larger Solidity graph has been removed.

## Core graph

```text
Fundraiser -> ResonanceRouter -> Resonance -> Strategies
                                      |       |
                                      |       +-> buyback GBX -> Fund -> burn
                                      +-> acquisition payment -> 90% Fund
                                                               -> 10% BribeRouter -> Bribe -> signalers

Uniswap v4 position -> LiquidityPosition -> caller adds 0.20% liquidity
                                        -> caller takes the accrued fees
```

GBX holders stake one-for-one into SignalGBX (`sGBX`) and allocate their complete signal balance among active Strategies.
Signaling is unrestricted: an account may replace or reset its allocations at any time and can unstake immediately after
resetting. This also lets a holder target the asset they want to accumulate: when a signaled acquisition Strategy
successfully settles, its configured signal-reward share is streamed in the acquired asset across eligible signalers.

## Contract responsibilities

| Contract            | Responsibility and important boundaries                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GBX`               | Transferable token with permits and signal checkpoints. It creates 20M genesis-liquidity GBX, disables later minting until the one-time Fundraiser handover, and enforces the one-billion lifetime cap.                       |
| `Fundraiser`        | Preserves the exact daily four-year-half-life schedule for the 980M contributor allocation, routes all contributed USDG immediately, settles sequentially, and mints pro-rata claims.                                         |
| `LiquidityPosition` | Ownerless. Validates and permanently holds one precommitted hookless GBX/USDG v4 NFT and auto-compounds it: anyone may add 0.20% liquidity to claim the accrued fees. Principal is never removed and the NFT can never leave. |
| `SignalGBX`         | Holds staked GBX and mints non-transferable `sGBX` signal weight one-for-one. Withdrawal has no time lock but requires the account to clear its active signal weight first.                                                   |
| `ResonanceRouter`   | Holds no intended long-term balance. Anyone can route its complete USDG balance into Resonance, which also makes unsolicited USDG recoverable into the intended revenue flow.                                                 |
| `Resonance`         | Normalizes relative signals, maintains the global revenue index, physically distributes USDG, creates Strategy/Bribe graphs, and maintains each Bribe's virtual balances. Zero-signal USDG goes to Fund.                      |
| `StrategyFactory`   | Can be bound once to Resonance. Only that Resonance may deploy a Strategy and its dedicated BribeRouter.                                                                                                                      |
| `Strategy`          | Sells its complete USDG balance through a bounded linearly declining price. Acquisition payments are split between Fund and signal rewards; buyback payments are GBX and are burned atomically.                               |
| `BribeFactory`      | Can be bound once to Resonance. Only that Resonance may deploy Bribes.                                                                                                                                                        |
| `BribeRouter`       | Receives the Strategy's signal-reward share and starts a reward stream when possible. If no signal weight exists, the queued balance goes to Fund.                                                                            |
| `Bribe`             | Streams registered reward tokens for seven days across virtual balances maintained only by Resonance. Reward streaming is not a staking or withdrawal lock.                                                                   |
| `Fund`              | Ownerless. Holds arbitrary ERC-20 balances without registration, burns held GBX, and supports caller-selected pro-rata redemption. Redemption is the only way an asset can ever leave.                                        |

## Supply and daily distribution

GBX mints exactly 20 million tokens once to the genesis-liquidity recipient. Its deployment minter cannot mint and may
only hand authority permanently to Fundraiser, leaving 980 million of lifetime capacity for contribution rewards.

Fundraiser begins at `465152.749681042811702004 GBX` per daily epoch and applies the exact sequential floor-rounded
decay multiplier `0.999525354337060160`, producing a four-year/1,460-day half-life. Anyone may settle ended epochs in
bounded sequential batches. A nonempty epoch assigns its complete scheduled amount pro rata; an empty epoch assigns
zero and permanently forfeits the day without carry.

## Genesis liquidity and fees

The canonical Uniswap v4 position starts entirely in GBX, outside the active starting price, using the 20 million
genesis allocation. LiquidityPosition accepts only the precommitted PositionManager, NFT ID, hookless GBX/USDG pool,
tick range, and a nonzero-liquidity position. The deployment process remains responsible for proving the exact 20
million amount was converted into the reviewed position and handling any deterministic rounding residual.

Anyone may call `compound`. It increases position liquidity by 0.20% and pays the caller every token the contract
holds afterward, which is the position's accrued fees plus any unspent funding. Principal is never removed and the
NFT never moves. Direct GBX or USDG transfers to LiquidityPosition are swept to the next caller the same way, so
nothing becomes stuck.

The caller's `amount0Max` and `amount1Max` are both the funding pulled from them and the slippage ceiling Uniswap
enforces on the increase; unspent funding is returned in the same call.

## Revenue and acquisition rules

- A contribution is not complete unless its exact USDG amount reaches ResonanceRouter and is routed to Resonance atomically.
- With active signals, Resonance indexes USDG pro rata across Strategy weight. Without signals, it sends the USDG to Fund.
- The default acquisition payment split is 9,000 basis points to Fund and 1,000 basis points to BribeRouter.
- Timelocked governance may set the bribe share from 0 to 5,000 basis points.
- If the relevant Bribe has no signal weight, BribeRouter returns its queued payment-token balance to Fund.
- A buyback accepts only the Fund's GBX token and burns the full payment without a bribe split.

## Fund redemption

A redemption receives a caller-selected subset rather than iterating over a protocol asset list:

```text
payout(token) = floor(Fund balance(token) * GBX burned / GBX total supply before burn)
```

The caller supplies `gbxAmount`, `receiver`, and an array of token addresses. The Fund:

1. rejects an empty list, GBX, the zero address, and duplicates;
2. snapshots each selected raw balance against one pre-burn total supply;
3. transfers in and burns the caller's GBX;
4. transfers each calculated payout; and
5. reverts the entire operation, including the burn, if a selected transfer fails.

There is no registry and no protocol-wide asset-count limit. EIP-1153 transient storage provides O(n) duplicate
detection in arbitrary order and is cleared before success, including when a batching contract calls redemption more
than once in the same transaction. Omitted assets remain in Fund for the post-redemption GBX supply.

## Governance

There is no migration. Fund and LiquidityPosition are ownerless and immutable: neither has a successor, an upgrade
path, a recovery function, or any administrator. Assets leave Fund only through GBX redemption, and the canonical v4
NFT never leaves LiquidityPosition at all.

Resonance holds the entire remaining administrative surface, intended for OpenZeppelin `TimelockController` with the
project multisig holding proposer and canceller roles. It exposes exactly four owner operations through the timelock:

- setting the acquisition bribe share, bounded at 50%;
- creating a Strategy/Bribe/BribeRouter graph;
- killing a Strategy, permanently; and
- registering an additional Bribe reward token.

The controller is deployed without an external default administrator. Timelock role or delay changes therefore must
be scheduled through the controller itself.

## Deliberate scope

- Deployment broadcasting remains intentionally unimplemented for this starting point.
- The 20M/980M allocation and Fundraiser schedule are fixed in code; deployment-specific pool price, fee, spacing,
  range, PositionManager, and NFT ID remain unresolved.
- The core does not yet have a dedicated emergency guardian design.
- Independent security review and production deployment evidence remain required.

## Credit

The starting mechanics are adapted from give.fun and Liquid Signal Governance, with Strategy's auction design also
crediting Euler Fee Flow. Exact repository commits are pinned in `NOTICE`.
