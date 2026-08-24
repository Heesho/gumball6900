# Legal and provenance blocker

The repository is not authorized for distribution or deployment until counsel and maintainers resolve the chain of
title described in [`NOTICE`](../NOTICE).

The active contracts are narrow adaptations of pinned give.fun commit
`ef6ee14a454432210d13e312d0ef825f670bd79d` and Liquid Signal Governance commit
`14b5fbbbe1945f2e6501f84976e5f12b39fb227a`. Strategy's reverse-Dutch shape has a transitive Euler Fee Flow ancestor
at commit `3bee858a1568d1313f37d615953f83391a897866`, whose reviewed file is GPL-2.0-or-later. The Liquid Signal Bribe and
Voter lineage statements also name Synthetix StakingRewards and Solidly without exact repository, commit, or path.
Mine additionally adapts [donut-miner](https://github.com/Heesho/donut-miner), but its exact source revision, path,
file hashes, and licensing have not yet been pinned or reviewed.

The reviewed upstream files have per-file MIT headers, but the pinned upstream repository states and transitive GPL
lineage do not establish a complete distribution conclusion. The current BUSL-1.1 headers are not a legal resolution.
No clean-room, compatibility, relicensing, or separate-permission claim is made.

## Active-file lineage inventory

All active Solidity files currently declare `SPDX-License-Identifier: MIT` and `@author Heesho`. The root package
declares BUSL-1.1, so the repository-level and file-level terms are not reconciled.

| Active file            | Recorded behavioral source                                                                      | Status                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `GBX.sol`              | give.fun `packages/hardhat/contracts/Coin.sol` at `ef6ee14a...`                                 | Adapted; exact upstream SHA-256 is in `NOTICE`.             |
| `Mine.sol`             | `Heesho/donut-miner`; exact commit and source path unresolved                                   | Adapted; upstream pin, file hash, and licensing unresolved. |
| `Fund.sol`             | give.fun `packages/hardhat/contracts/Core.sol` at `ef6ee14a...`                                 | Materially redesigned ownerless redemption treasury.        |
| `SignalGBX.sol`        | Liquid Signal `contracts/GovernanceToken.sol` at `14b5fbbb...`                                  | Adapted; exact upstream SHA-256 is in `NOTICE`.             |
| `Resonance.sol`        | Liquid Signal `contracts/Voter.sol` at `14b5fbbb...`                                            | Materially redesigned Bribe-shaped reward allocator.        |
| `ResonanceRouter.sol`  | Liquid Signal `contracts/RevenueRouter.sol` at `14b5fbbb...`                                    | Adapted; exact upstream SHA-256 is in `NOTICE`.             |
| `Strategy.sol`         | Liquid Signal `contracts/Strategy.sol` at `14b5fbbb...`; give.fun `Auction.sol`; Euler Fee Flow | Adapted; transitive GPL question unresolved.                |
| `Bribe.sol`            | Liquid Signal `contracts/Bribe.sol` at `14b5fbbb...`; stated Synthetix ancestor                 | Material rewrite; exact Synthetix source unresolved.        |
| `BribeFactory.sol`     | Liquid Signal `contracts/BribeFactory.sol` at `14b5fbbb...`                                     | Upstream SHA-256 `2fb1fc54...4d3ac`.                        |
| `BribeRouter.sol`      | Liquid Signal `contracts/BribeRouter.sol` at `14b5fbbb...`                                      | Upstream SHA-256 `4179621d...3430d`.                        |
| `StrategyFactory.sol`  | Liquid Signal `contracts/StrategyFactory.sol` at `14b5fbbb...`                                  | Upstream SHA-256 `f0a7394b...2dd4`.                         |
| `IBribe.sol`           | Liquid Signal `contracts/interfaces/IBribe.sol` at `14b5fbbb...`                                | Upstream SHA-256 `34794632...9467`.                         |
| `IResonanceRouter.sol` | Liquid Signal `contracts/interfaces/IRevenueRouter.sol` at `14b5fbbb...`                        | Upstream SHA-256 `e3dcdd04...4cb4`.                         |
| `ICoreResonance.sol`   | Project interface combining adapted Voter/Core surfaces                                         | No single upstream source; relationship review required.    |

Ellipses in this table are display abbreviations; `NOTICE` and the repository history retain full primary commit and
hash evidence. The newly reviewed full upstream hashes should be copied into `NOTICE` only after legal review confirms
the intended attribution format.

Before any public distribution or deployment, counsel must approve:

- the repository-wide license and every active Solidity SPDX identifier;
- GPL compatibility and source-availability consequences for Euler-derived auction behavior;
- exact Solidly and Synthetix ancestor identification and attribution;
- donut-miner ownership, source pin, license scope, and required attribution;
- `NOTICE`, copyright ownership, author attribution, and dependency notices;
- whether generated ABI, documentation, SDK, subgraph, and frontend artifacts have matching distribution terms.

This is a release blocker and not legal advice.
