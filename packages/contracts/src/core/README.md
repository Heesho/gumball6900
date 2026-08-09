# GUM BALL 6900 core contracts

This directory is the canonical development starting point for GUM BALL 6900. It is not wired to a deployment or
authorized for user funds.

## System flow

```text
contributions: Fundraiser -> ResonanceRouter -> Resonance -> Strategy
acquisitions:  buyer payment -> BribeRouter -> Fund liability -> Fund
GBX payments:  buyer GBX -> BribeRouter -> Fund liability -> Fund -> permissionless burn
redemptions:   user GBX -> burn; selected Fund assets -> receiver
liquidity:      caller funds 0.20% growth shortfall -> position; accrued position fees -> caller
```

## Contracts

| Contract            | Responsibility                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GBX`               | Creates 20M genesis-liquidity GBX, reserves the remaining 980M capacity for Fundraiser, and enforces the lifetime cap. |
| `Fundraiser`        | Fixed daily four-year-half-life contribution schedule, proportional GBX claims, and immediate USDG routing.            |
| `LiquidityPosition` | Permanently holds one canonical GBX/USDG v4 NFT and permissionlessly compounds it by a fixed 0.20%.                    |
| `SignalGBX`         | Non-transferable, one-for-one staked GBX; unallocated `sGBX` is immediately withdrawable.                              |
| `ResonanceRouter`   | Permissionlessly forwards all accumulated USDG to Resonance.                                                           |
| `Resonance`         | Incremental absolute SignalGBX allocation, indexed USDG distribution, Strategy creation, and Bribe accounting.         |
| `StrategyFactory`   | Resonance-only deployment of a Strategy and its BribeRouter.                                                           |
| `Strategy`          | Uniform bounded reverse Dutch acquisition whose complete payment is owed to Fund.                                      |
| `BribeFactory`      | Resonance-only deployment of Bribe contracts.                                                                          |
| `BribeRouter`       | Records every Strategy payment as a fixed, permissionlessly payable Fund liability.                                    |
| `Bribe`             | Seven-day reward streams over virtual signal balances, with at most eight append-only reward tokens.                   |
| `Fund`              | Ownerless registry-free raw treasury, GBX burn boundary, and selective in-kind redemption.                             |

Every Strategy payment is 100% Fund-bound. Bribes are funded independently through explicit reward notifications.
GBX received by Fund is burnable by anyone but is not burned automatically during Strategy settlement.

## Fund redemption

`redeem(gbxAmount, receiver, tokens)` pays the pre-burn pro-rata balance of each unique non-GBX token selected by the
caller. Tokens may appear in any order. EIP-1153 transient storage rejects duplicates without an asset registry or
permanent writes. Omitting an asset permanently leaves that claim with the remaining GBX supply, and selecting a
malformed token can only revert that caller-selected transaction.

## Administration

Resonance is owned by OpenZeppelin `TimelockController`. The project multisig is intended to hold proposer and
canceller roles, while execution may be permissionless after the configured delay. Its continuing management surface
is limited to `addStrategy`, `killStrategy`, and `addBribeReward`.

Fund and LiquidityPosition are ownerless. Fund has no administrative asset path, and the canonical position NFT can
never leave LiquidityPosition after it is accepted.
The timelock has no external default administrator after setup; changing its own roles or delay must pass through the
same delayed execution path.

## Credit

The starting mechanics are adapted from give.fun and Liquid Signal Governance. Strategy's auction design also credits
Euler Fee Flow. Repository provenance pins remain recorded in `NOTICE`.
