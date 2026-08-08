# GumBall6900

## The community-directed onchain index fund

**Mine GBX. Signal acquisitions. Build a shared treasury. Redeem onchain.**

GumBall6900 is an experimental index protocol designed for Robinhood Chain. At launch, anyone will be able to mine GBX
by contributing USDG through the Fundraiser. Those contributions and other protocol revenue build a growing basket of
onchain assets chosen by GBX holders.

Think of it as a community-built onchain index: approved acquisition Strategies compete for signal-directed capital,
the assets they acquire accumulate in a shared Fund, and GBX can be burned to redeem a proportional share of selected
Fund holdings. There is no synthetic price peg, NAV oracle, or offchain redemption desk in the core protocol.

> **Development status:** this repository is a pre-audit engineering starting point. The protocol is not deployed and
> is not authorized for user funds.

## The idea

Traditional indices are assembled by a committee. Onchain treasuries are often controlled by a small group of
signers. GumBall6900 explores a different model: fair-launch the coin through public Fundraiser mining, let holders
continuously direct new capital toward the assets they believe should become part of the treasury, then make the
resulting holdings redeemable onchain.

The result is a simple flywheel:

1. **Mine** — users contribute USDG through the Fundraiser and mine GBX from a fixed public distribution schedule.
2. **Signal** — GBX can be staked one-for-one into SignalGBX (`sGBX`) and allocated among approved Strategies without a
   time lock or signal cooldown.
3. **Acquire** — USDG follows current signals. Each acquisition Strategy runs a reverse Dutch auction in which a buyer
   receives the accumulated USDG and pays with the asset that Strategy is acquiring.
4. **Build the Fund** — 90% of each acquisition payment enters the Fund. The initial 10% signal-reward share is streamed
   through that Strategy's Bribe and can be changed by timelocked governance, up to a 50% maximum.
5. **Redeem** — a holder can burn GBX for a proportional share of any caller-selected Fund assets.
6. **Reduce supply** — GBX received through buybacks and GBX fees collected from the canonical liquidity position are
   burned permanently.

```text
USDG contribution
       |
       v
  Fundraiser ---> GBX public mining
       |
       v
  ResonanceRouter ---> Resonance <--- sGBX allocations
                      |
                      v
                  Strategies
                      |
          target asset payment
                /            \
          90% Fund       10% signal rewards
              |
              v
     selective GBX redemption
```

## One loop, four participants

| Participant       | Incentive                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------- |
| GBX miners        | Contribute USDG to mine GBX from the fixed public distribution curve.                        |
| GBX holders       | Direct new acquisitions, earn Strategy signal rewards, and retain in-kind redemption rights. |
| Asset communities | Compete for allocation and Fund inclusion after a Strategy is admitted.                      |
| Auction buyers    | Receive a Strategy's accumulated USDG when the declining price reaches their target.         |

## Why it is different

### Holder-directed index formation

GBX holders decide how new USDG revenue is allocated among active Strategies. Signaling is deliberately liquid: an
account can replace or reset its allocations at any time and withdraw its staked GBX after clearing its signals.

### Signal what you want to accumulate

Signaling is also a personal accumulation choice. If an active Strategy acquires an onchain representation of NVIDIA
shares (`NVDA`), an `sGBX` holder can signal that Strategy and earn a pro-rata stream of the acquired asset when its
auctions settle. The same idea applies to Apple (`AAPL`), a SpaceX-linked asset, or anything else with an eligible
onchain asset and an active GumBall6900 Strategy.

The initial split sends 90% of each completed acquisition to the shared Fund and 10% to eligible signalers through the
Strategy's Bribe. Signaling alone does not guarantee a reward or a particular amount: the Strategy must successfully
complete acquisitions, and the reward depends on the holder's signal weight and the configured reward share.

### Assets instead of price exposure

Acquisition Strategies deliver tokens to the Fund rather than tracking their prices synthetically. GBX holders can
burn tokens and redeem their proportional share of selected Fund balances directly.

### Selective, registry-free redemption

The Fund does not maintain an enumerable asset registry. A redeemer supplies the assets they want to receive and can
omit broken, unwanted, or unknown tokens. One malformed token therefore cannot block redemption of every other Fund
asset.

### Permissionless execution

Revenue routing, Strategy distribution, Fundraiser settlement, liquidity-fee collection, reward claims, and committed
migrations can all be executed permissionlessly. Administrative decisions remain delayed through OpenZeppelin's
`TimelockController`.

### A deliberately small core

The active contracts are direct, non-upgradeable deployments adapted from the simple boundaries used by give.fun and
Liquid Signal Governance. The protocol avoids a conventional DAO, generic vault calls, an asset registry, and onchain
NAV or price oracles.

## GBX fair launch and mining

GBX is designed for a fair launch. There is no reserved allocation for the team, founders, investors, advisors, a
private sale, or a presale. Everyone participates on the same Fundraiser terms: contribute USDG and mine GBX from the
fixed curve. Here, "mining" means earning GBX through Fundraiser contributions, not proof-of-work.

GBX has a cumulative lifetime mint limit of **1 billion tokens**. Burning GBX never restores mint capacity.

| Allocation                   | GBX               |    Share |
| ---------------------------- | ----------------- | -------: |
| Genesis Uniswap v4 liquidity | 20,000,000        |       2% |
| Public Fundraiser mining     | 980,000,000       |      98% |
| **Lifetime maximum**         | **1,000,000,000** | **100%** |

The 20 million genesis allocation is committed to the canonical liquidity position rather than assigned to a person
or team. The remaining 980 million lifetime mint capacity is permanently assigned to Fundraiser mining.

The Fundraiser uses a fixed daily distribution curve:

- initial daily emission: `465,152.749681042811702004 GBX`;
- daily multiplier: `0.999525354337060160`;
- emission half-life: 1,460 days, or four years; and
- empty days advance the schedule and forfeit that day's emission rather than carrying it forward.

Sequential integer rounding leaves less than one millionth of one GBX unminted across the complete curve.

## Liquidity and protocol revenue

The canonical market is one hookless GBX/USDG Uniswap v4 position. It begins outside the active price range with the
20 million GBX genesis allocation on one side.

The position stays inside `LiquidityPosition`; there is no arbitrary NFT withdrawal. Anyone can collect its fees
without removing principal:

- collected GBX is burned; and
- collected USDG enters `ResonanceRouter -> Resonance -> Strategies`.

Timelocked governance can bind one fully compatible successor exactly once. After that commitment, anyone can migrate
the exact position NFT.

## Fund backing and redemption

For each asset selected by a redeemer, the Fund pays:

```text
floor(Fund asset balance * GBX burned / GBX total supply before the burn)
```

Every selected balance is snapshotted before the GBX burn, and the burn plus all transfers are atomic. If one selected
token fails, the entire redemption reverts. Assets omitted by the redeemer stay in the Fund for the remaining GBX
supply.

The Fund has no general administrative withdrawal. Its only migration path is a one-time, timelocked commitment to a
same-GBX successor, followed by permissionless migration of complete caller-selected token balances.

## Protocol map

| Contract            | Role                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `GBX`               | Transferable protocol token, burns, signal checkpoints, and the one-billion lifetime mint ceiling.  |
| `Fundraiser`        | USDG contributions and the fixed 980-million-GBX contributor distribution.                          |
| `SignalGBX`         | Non-transferable, one-for-one staked GBX with ticker `sGBX`, used for current Strategy allocations. |
| `ResonanceRouter`   | Permissionlessly moves accumulated USDG into Resonance.                                             |
| `Resonance`         | Tracks allocations, distributes USDG, and controls Strategy and Bribe creation.                     |
| `StrategyFactory`   | Resonance-only factory for Strategies and their dedicated BribeRouters.                             |
| `Strategy`          | Reverse Dutch acquisition auction or GBX buyback.                                                   |
| `BribeFactory`      | Resonance-only factory for one Bribe per Strategy.                                                  |
| `BribeRouter`       | Routes the signal-reward share of acquisition payments to the Strategy's Bribe.                     |
| `Bribe`             | Streams payment-token rewards across the Strategy's signal balances.                                |
| `Fund`              | Registry-free asset backing, selective redemption, GBX burning, and constrained migration.          |
| `LiquidityPosition` | Custody, fee processing, and constrained migration for the canonical Uniswap v4 position.           |

The Solidity source of truth is [`packages/contracts/src/core`](packages/contracts/src/core). Foundry and Hardhat
compile the same source tree.

## Governance surface

`Resonance`, `Fund`, and `LiquidityPosition` are intended to be owned by OpenZeppelin `TimelockController`, with a project
multisig proposing and cancelling operations. The initial administrative surface is limited to:

- creating and permanently disabling Strategies;
- setting the acquisition signal-reward share between 0% and 50%;
- registering additional Bribe reward tokens; and
- committing the one-time Fund and LiquidityPosition successors.

The timelock cannot arbitrarily withdraw Fund assets or the Uniswap v4 position.

## Repository

```text
packages/contracts    Solidity contracts, Foundry tests, and Hardhat parity tests
packages/sdk          TypeScript ABIs, actions, readers, and protocol math
packages/subgraph     Protocol indexing and Matchstick tests
packages/simulations  Independent TypeScript and Python economic models
packages/config       Chain metadata and provisional deployment evidence
apps/web              Protocol interface
docs                  Architecture, economics, governance, and threat model
```

### Local development

The repository requires Node.js 22.23.1, pnpm 10.14.0, Foundry, and Solidity 0.8.26.

```bash
pnpm install --frozen-lockfile
pnpm contracts:test
pnpm contracts:test:hardhat
pnpm sdk:test
pnpm subgraph:test
pnpm build
```

Start with:

- [`docs/STARTING_CONTRACTS.md`](docs/STARTING_CONTRACTS.md) for contract behavior;
- [`docs/ECONOMICS.md`](docs/ECONOMICS.md) for the value flows;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for system boundaries;
- [`docs/ACCESS_CONTROL.md`](docs/ACCESS_CONTROL.md) for governance;
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) for known risks; and
- [`AGENTS.md`](AGENTS.md) for repository execution rules.

## Acknowledgements

The starting mechanics are minimally adapted from
[give.fun](https://github.com/Heesho/givedotfun-monorepo) and
[Liquid Signal Governance](https://github.com/Heesho/liquid-signal-governance). The reverse Dutch Strategy design also
credits [Euler Fee Flow](https://github.com/euler-xyz/fee-flow). Exact source revisions and unresolved provenance notes
are recorded in [`NOTICE`](NOTICE).

## Current status

This codebase is under active development. Local tests are engineering evidence only; they are not an audit or a
production-readiness claim. Before any deployment, the project still requires finalized network parameters, deployment
rehearsals, independent security review, and resolution of the repository's licensing and provenance questions.
