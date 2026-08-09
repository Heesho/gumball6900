# Uniswap v4 integration review

## Pinned source packages

| Component         | Package                       | Upstream commit                            | Integrity / reviewed interface SHA-256                                                       |
| ----------------- | ----------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| v4 core           | `@uniswap/v4-core@1.0.2`      | `59d3ecf53afa9264a16bba0e38f4c5d2231f80bc` | `IPoolManager.sol`: `a98405333567e4ab344489728014795721cf0071c151536377d2fcc986e0600c`       |
| v4 periphery      | `@uniswap/v4-periphery@1.0.3` | `60cd93803ac2b7fa65fd6cd351fd5fd4cc8c9db5` | `IPositionManager.sol`: `b7aa2a13c92f5f2e5612948359120d1b92263e575ce8d134b4576227f8629569`   |
| Permit2 submodule | `@uniswap/permit2@1.0.0`      | `cc56ad0f3439c502c246fc5cfcc3db92bb8b7219` | `IAllowanceTransfer.sol`: `a31c712c5cc8d171818a4225c09011f9ba86b2d5edf6045ac812bab93b6bbb87` |

The npm v4-core package declares BUSL-1.1 but does not include a root LICENSE file in the installed tarball. v4
periphery and the vendored Permit2 submodule include MIT text. This belongs in the unresolved dependency/legal review.

## Contract behavior reviewed

LiquidityPosition fixes the exact PositionManager, Permit2, GBX/USDG currency ordering, fee, tick spacing, hookless
PoolKey hash, tick range, depositor, and token ID. The ERC-721 receiver validates ownership, pool identity, range, and
nonzero liquidity before recording the position. There is no outward ERC-721 call.

`compound` reads current liquidity, adds `floor(L * 20 / 10000)`, uses PositionManager
`INCREASE_LIQUIDITY + CLOSE_CURRENCY + CLOSE_CURRENCY`, checks the resulting liquidity lower bound, and transfers all
returned balances to the caller with exact deltas. Its event records liquidity before/added/after, funding maxima, and
total transferred amounts. Principal removal, swaps, oracles, fee splits, keepers, and governance parameters are absent.

## Genuine integration result

`FOUNDRY_PROFILE=integration forge test` passed 21 tests: 15 real PoolManager/PositionManager compounding tests and six
campaign-harness tests. The fuzzed compounding test ran 257 cases. Canonical Permit2 itself is replaced only in this
suite because its exact 0.8.17 pragma cannot compile in the pinned 0.8.26 graph; the netting property under test lives
in PositionManager.

## Target-chain read-only evidence

Robinhood Chain ID 4663 was read at block 32,035,314, hash
`0xe13569d3a71001227e35d660dfbcfed1e7660d10b74c0c639e4bc0eab1555aea`, timestamp
2026-08-09T15:14:32Z. Officially documented addresses and observed code hashes were:

| Contract        | Address                                      | Observed runtime code hash                                           |
| --------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| PoolManager     | `0x8366a39cc670b4001a1121b8f6a443a643e40951` | `0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626` |
| PositionManager | `0x58daec3116aae6d93017baaea7749052e8a04fa7` | `0xc873e135dc9aaec88489cfbad146b4cb49d6a32e0d80326377784b7ba17670b2` |
| Permit2         | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | `0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca` |

An `eth_call` using initcode with `TSTORE` then `TLOAD` returned the stored value `0x2a`, demonstrating EIP-1153
execution at that pinned block. These hashes are review evidence only; a signed deployment manifest must re-verify
them, PoolKey/ticks/token ID, and final custody.

## Residual

A compounder can choose or atomically influence the market price at which the fixed liquidity delta is funded. The
required token composition changes across the range. This A-06 timing/composition risk remains open because an oracle
or protocol swap would violate the frozen design.
