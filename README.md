# GumBall6900

GumBall6900 is an experimental, governance-minimized onchain index protocol for Robinhood Chain. GBX miners supply
recurring USDG revenue, staked GBX holders continuously signal which assets the protocol should acquire, and GBX can be
burned for caller-selected Fund assets.

> Development status: not deployed, audited, or authorized for user funds. Independent review, legal/provenance
> clearance, final economic parameters, and signed deployment evidence remain release blockers.

## Protocol loop

1. A user replaces an hourly Mine slot. If a miner is displaced, 80% of the USDG payment becomes their claim and 20%
   routes to Resonance. An empty slot routes 100% to Resonance.
2. The slot miner continuously accrues GBX at a rate fixed for that complete tenure.
3. GBX holders stake one-for-one into non-transferable SignalGBX and direct Resonance's seven-day USDG stream among
   active Strategies. Signal changes checkpoint elapsed flow first; there is no signal lock or epoch.
4. A Strategy buyer atomically pulls its released USDG, receives the complete Strategy balance, and pays the asset that
   Strategy acquires; the complete payment becomes a Fund
   liability.
5. A GBX holder burns tokens to redeem a proportional share of caller-selected Fund assets.

```text
replacement USDG -> Mine --20%--> ResonanceRouter -> Resonance --7-day stream--> Strategies
                         \--80%--> displaced miner
Mine -> continuous GBX
SignalGBX ---------------------------> allocation weights
Strategy payment -> BribeRouter -> Fund
GBX burn -> Fund selected assets
```

## Mining and supply

GBX creates only 20 million tokens for the permanent, one-sided genesis liquidity position. Deployment then binds its
sole mint authority permanently to Mine. There is no protocol-defined economic supply cap or replacement minter;
the inherited ERC20Votes representation retains its unreachable-in-practice `uint208` safety ceiling.

Mine starts with one slot. Timelock governance may only increase capacity, up to 16. Every slot's USDG replacement
price decays linearly to zero over one hour and can be filled at any time.

An occupied slot's GBX-per-second rate cannot be changed mid-tenure. Capacity expansion and later mining halvings apply
only when a slot is newly occupied or replaced. This protects miners from governance dilution, while accepting that
aggregate issuance can temporarily rise as old-rate and new-rate slots coexist. Constructor-fixed cumulative-mining
halvings end in a positive tail so mining and revenue can continue indefinitely.

## Redemption

Fund checkpoints all mining slots before taking its supply snapshot, then pays each selected token as:

```text
floor(Fund token balance * GBX burned / GBX total supply before burn)
```

The checkpoint includes accrued unminted mining rewards in supply. Omitted assets stay in Fund. A failed selected-token
transfer reverts the complete redemption and burn.

## Governance-minimized core

All core contracts are direct and non-upgradeable. Fund and LiquidityPosition are ownerless. OpenZeppelin TimelockController
owns only the narrow remaining administration:

- add or kill a Strategy;
- add a Bribe reward token within the fixed cap of eight; and
- increase Mine capacity, never decrease it, up to 16.

There is no proxy, pause switch, treasury sweep, arbitrary call path, successor, or migration routine.

## Contracts

| Contract            | Role                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `GBX`               | Genesis allocation, permanent Mine authority, cumulative mint/burn accounting, permits, votes.    |
| `Mine`              | Hourly multislot handoffs, continuous tenure-locked GBX accrual, 80/20 USDG split, positive tail. |
| `SignalGBX`         | Non-transferable one-for-one staked GBX with immediately withdrawable unallocated balance.        |
| `ResonanceRouter`   | Permissionlessly forwards every nonzero complete USDG balance into Resonance.                     |
| `Resonance`         | Signal accounting, exact active-plus-successor USDG streaming, Strategy and Bribe administration. |
| `Strategy`          | Reverse Dutch acquisition auction.                                                                |
| `BribeRouter`       | Fixed complete Strategy-payment liability to Fund.                                                |
| `Bribe`             | Up to eight independently funded reward streams for signalers.                                    |
| `Fund`              | Registry-free backing, selective redemption, and permissionless Fund-held GBX burn.               |
| `LiquidityPosition` | Permanent fixed-principal Uniswap v4 position and permissionless fee routing.                     |

## Repository

```text
packages/contracts    Solidity, Foundry invariants, Hardhat parity, audit harnesses
packages/sdk          Generated ABIs, transaction builders, readers, exact integer math
packages/subgraph     Mine and protocol event indexing with Matchstick tests
packages/simulations  Independent TypeScript/Python economic fixtures and charts
packages/config       Chain metadata and provisional deployment evidence
apps/web              Development status interface
docs                  Architecture, economics, security, ADRs, and release evidence
```

The repository requires Node.js 22.23.1, pnpm 10.14.0, Foundry, and Solidity 0.8.26.

```bash
pnpm install --frozen-lockfile
pnpm contracts:test
pnpm contracts:test:hardhat
pnpm sdk:test
pnpm subgraph:test
pnpm simulations:test
pnpm build
```

Start with [architecture](docs/ARCHITECTURE.md), [economics](docs/ECONOMICS.md),
[emissions](docs/EMISSIONS.md), [access control](docs/ACCESS_CONTROL.md), and
[ADR 0024](docs/adr/0024-immutable-multislot-mine.md), and
[ADR 0025](docs/adr/0025-global-revenue-stream.md).

## Provenance

The signaling and acquisition graph adapts pinned give.fun and Liquid Signal Governance sources. Mine adapts the
Farplace MineRig mechanics, with protocol-specific changes for a strict 80/20 split, bounded multislot capacity,
tenure-locked rates, permanent GBX mint authority, and redemption checkpointing. Exact pins and unresolved licensing
clearance are recorded in [NOTICE](NOTICE).
