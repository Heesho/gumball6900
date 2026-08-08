# GUM BALL 6900 core contracts

This directory is the canonical development starting point for GUM BALL 6900. It is not wired to a deployment or
authorized for user funds.

## System flow

```text
contributions: Fundraiser -> ResonanceRouter -> Resonance -> Strategy
acquisitions:  buyer payment -> Fund + BribeRouter -> Bribe -> signalers
buybacks:      buyer GBX -> Fund -> burn
redemptions:   user GBX -> burn; selected Fund assets -> receiver
liquidity fees: GBX -> burn; USDG -> ResonanceRouter -> Resonance
```

## Contracts

| Contract            | Responsibility                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GBX`               | Creates 20M genesis-liquidity GBX, reserves the remaining 980M capacity for Fundraiser, and enforces the lifetime cap. |
| `Fundraiser`        | Fixed daily four-year-half-life contribution schedule, proportional GBX claims, and immediate USDG routing.            |
| `LiquidityPosition` | Holds one canonical GBX/USDG v4 NFT, burns GBX fees, routes USDG fees, and supports one compatible successor.          |
| `SignalGBX`         | Non-transferable, one-for-one staked GBX used as signal weight. There is no time lock.                                 |
| `ResonanceRouter`   | Permissionlessly forwards all accumulated USDG to Resonance.                                                           |
| `Resonance`         | Unrestricted SignalGBX allocation, indexed USDG distribution, Strategy creation, and Bribe accounting.                 |
| `StrategyFactory`   | Resonance-only deployment of a Strategy and its BribeRouter.                                                           |
| `Strategy`          | Bounded reverse Dutch acquisition or GBX buyback.                                                                      |
| `BribeFactory`      | Resonance-only deployment of Bribe contracts.                                                                          |
| `BribeRouter`       | Sends an acquisition's signal-reward share to Bribe, or to Fund when the Strategy has no signalers.                    |
| `Bribe`             | Seven-day reward streams over virtual signal balances maintained by Resonance.                                         |
| `Fund`              | Registry-free raw treasury, GBX burn boundary, selective in-kind redemption, and one-way batched migration.            |

The initial acquisition split is 90% Fund and 10% signal rewards. Typed timelocked governance may change the signal-reward
share up to 50%. Buybacks never pay signal rewards.

## Fund redemption

`redeem(gbxAmount, receiver, tokens)` pays the pre-burn pro-rata balance of each unique non-GBX token selected by the
caller. Tokens may appear in any order. EIP-1153 transient storage rejects duplicates without an asset registry or
permanent writes. Omitting an asset permanently leaves that claim with the remaining GBX supply, and selecting a
malformed token can only revert that caller-selected transaction.

## Administration

Resonance, Fund, and LiquidityPosition use OpenZeppelin ownership so their owner can be OpenZeppelin
`TimelockController`. The project multisig is intended to hold proposer and canceller roles, while execution may be
permissionless after the configured delay.
The timelock has no external default administrator after setup; changing its own roles or delay must pass through the
same delayed execution path.

## Credit

The starting mechanics are adapted from give.fun and Liquid Signal Governance. Strategy's auction design also credits
Euler Fee Flow. Repository provenance pins remain recorded in `NOTICE`.
