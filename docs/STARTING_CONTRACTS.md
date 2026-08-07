# Canonical contract starting point

> This is the active development architecture, not a deployment, audit, or authorization for user funds. The previous
> larger Solidity graph has been removed.

## Core graph

```text
Fundraiser -> VoterRouter -> Voter -> Strategies
                                      |       |
                                      |       +-> buyback GBX -> Fund -> burn
                                      +-> acquisition payment -> 90% Fund
                                                               -> 10% BribeRouter -> Bribe -> voters

Uniswap v4 position -> LiquidityPosition -> GBX fees burned
                                        -> USDG fees -> VoterRouter -> Voter
```

GBX holders stake one-for-one into SignalGBX and allocate their complete voting balance among active Strategies.
Voting is unrestricted: an account may replace or reset its allocations at any time and can unstake immediately after
resetting.

## Contract responsibilities

| Contract            | Responsibility and important boundaries                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GBX`               | Transferable token with permits and vote checkpoints. It creates 20M genesis-liquidity GBX, disables later minting until the one-time Fundraiser handover, and enforces the one-billion lifetime cap.      |
| `Fundraiser`        | Preserves the exact daily four-year-half-life schedule for the 980M contributor allocation, routes all contributed USDG immediately, settles sequentially, and mints pro-rata claims.                      |
| `LiquidityPosition` | Validates and holds one precommitted hookless GBX/USDG v4 NFT, burns GBX fees, routes USDG fees, removes no principal during collection, and supports one compatible successor.                            |
| `SignalGBX`         | Holds staked GBX and mints non-transferable voting weight one-for-one. Withdrawal has no time lock but requires the account to clear its active Voter weight first.                                        |
| `VoterRouter`       | Holds no intended long-term balance. Anyone can route its complete USDG balance into Voter, which also makes unsolicited USDG recoverable into the intended revenue flow.                                  |
| `Voter`             | Normalizes relative votes, maintains the global revenue index, physically distributes USDG, creates Strategy/Bribe graphs, and maintains each Bribe's virtual balances. Zero-vote USDG goes to Fund.       |
| `StrategyFactory`   | Can be bound once to Voter. Only that Voter may deploy a Strategy and its dedicated BribeRouter.                                                                                                           |
| `Strategy`          | Sells its complete USDG balance through a bounded linearly declining price. Acquisition payments are split between Fund and voter rewards; buyback payments are GBX and are burned atomically.             |
| `BribeFactory`      | Can be bound once to Voter. Only that Voter may deploy Bribes.                                                                                                                                             |
| `BribeRouter`       | Receives the Strategy's voter share and starts a reward stream when possible. If no voting weight exists, the queued balance goes to Fund.                                                                 |
| `Bribe`             | Streams registered reward tokens for seven days across virtual balances maintained only by Voter. Reward streaming is not a staking or withdrawal lock.                                                    |
| `Fund`              | Holds arbitrary ERC-20 balances without registration, burns held GBX, supports caller-selected pro-rata redemption, and can bind one same-GBX successor for permissionless full-balance migration batches. |

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

Anyone may collect fees. The PositionManager call requests zero liquidity removal, all GBX held afterward is burned,
and all USDG is sent through VoterRouter. Direct GBX or USDG transfers to LiquidityPosition are processed the same way.

## Revenue and acquisition rules

- A contribution is not complete unless its exact USDG amount reaches VoterRouter and is routed to Voter atomically.
- With active votes, Voter indexes USDG pro rata across Strategy weight. Without votes, it sends the USDG to Fund.
- The default acquisition payment split is 9,000 basis points to Fund and 1,000 basis points to BribeRouter.
- Timelocked governance may set the bribe share from 0 to 5,000 basis points.
- If the relevant Bribe has no voting weight, BribeRouter returns its queued payment-token balance to Fund.
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

## Migration and governance

Fund, Voter, and LiquidityPosition ownership are intended for OpenZeppelin `TimelockController`, with the project
multisig holding proposer and canceller roles. The controller may set one Fund successor exactly once. The successor must expose the same GBX
address. Once set, anyone can migrate the old Fund's complete balance of caller-selected non-GBX tokens; there is no
arbitrary receiver or partial administrative transfer. GBX in the old Fund remains there to be burned, and redemption
remains available for omitted assets.

LiquidityPosition follows the same one-way pattern. Governance may bind one successor that exposes the same
PositionManager, NFT ID, GBX, USDG, VoterRouter, pool key, and ticks and expects the old custodian as depositor. Anyone
may then migrate the exact NFT; there is no arbitrary position withdrawal.

The contracts expose the following owner operations through the standard timelock:

- setting the acquisition bribe share;
- creating a Strategy/Bribe/BribeRouter graph;
- killing a Strategy;
- registering an additional Bribe reward token;
- binding a Fund successor; and
- binding a LiquidityPosition successor.

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
