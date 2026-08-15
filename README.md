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
3. GBX holders stake one-for-one into non-transferable SignalGBX (`sGBX`), the governance token and sole signal
   coordinator. They may stake and signal atomically, move absolute allocations, or remove a signal and unstake in one
   call. Signal changes checkpoint elapsed flow first; idle sGBX can govern but directs no revenue or Bribe rewards.
4. A Strategy buyer atomically pulls its released USDG, receives the complete Strategy balance, and pays the asset that
   Strategy acquires; the complete payment becomes a Fund
   liability.
5. A GBX holder burns tokens to redeem a proportional share of caller-selected Fund assets.

```text
replacement USDG -> Mine --20%--> ResonanceRouter -> Resonance --7-day stream--> Strategies
                         \--80%--> displaced miner
Mine -> continuous GBX
SignalGBX --signal coordination------> Resonance allocation weights
SignalGBX --block-clock votes--------> ProtocolGovernor -> Timelock
Strategy payment -> BribeRouter -> Fund
GBX burn -> Fund selected assets
```

ResonanceRouter waits while its USDG balance is below the exact amount left in the active stream. A qualifying balance
checkpoints elapsed revenue and restarts seven days with the new reward plus that remainder. Resonance uses a `1e36`
reward index; index and Strategy floors, zero-active-signal intervals, and direct donations are accepted surplus.

## Mining and supply

GBX creates only 20 million tokens for the permanent, one-sided genesis liquidity position. Deployment then binds its
sole mint authority permanently to Mine. There is no protocol-defined economic supply cap or replacement minter. GBX
retains ERC-2612 permit approvals but carries no governance checkpoints; voting power exists only after staking into
sGBX.

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

All core contracts are direct and non-upgradeable. Fund and LiquidityPosition are ownerless. SignalGBX voting power
operates an immutable, selector-bounded ProtocolGovernor. It is the TimelockController's sole proposer, and the
Timelock owns only the narrow remaining administration:

- add or kill a Strategy;
- add a Bribe reward token within the fixed cap of eight; and
- increase Mine capacity, never decrease it, up to 16.

Governor proposals contain only those four exact zero-value calls at immutable Resonance and Mine targets. Voting
delay, voting period, proposal threshold, and quorum percentage use sGBX's block-number clock and are fixed at
construction. Execution is permissionless after the Timelock delay. There is no multisig bypass, guardian, queued
proposal veto, proxy, pause switch, treasury sweep, arbitrary call path, successor, or migration routine.

## Contracts

| Contract            | Role                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `GBX`               | Genesis allocation, permanent Mine authority, cumulative mint/burn accounting, ERC-2612 permits.  |
| `Mine`              | Hourly multislot handoffs, continuous tenure-locked GBX accrual, 80/20 USDG split, positive tail. |
| `SignalGBX`         | Non-transferable staked GBX, ERC20Votes governance power, and the sole signal coordinator.        |
| `ResonanceRouter`   | Holds USDG below the active amount left, then permissionlessly forwards a qualifying balance.     |
| `Resonance`         | Bribe-shaped seven-day USDG rewards, active signal totals, and Strategy/Bribe administration.     |
| `Strategy`          | Reverse Dutch acquisition auction.                                                                |
| `BribeRouter`       | Fixed complete Strategy-payment liability to Fund.                                                |
| `Bribe`             | Up to eight independently funded reward streams for signalers.                                    |
| `Fund`              | Registry-free backing, selective redemption, and permissionless Fund-held GBX burn.               |
| `LiquidityPosition` | Permanent fixed-principal Uniswap v4 position and permissionless fee routing.                     |
| `ProtocolGovernor`  | Immutable four-selector sGBX governance over Timelock-owned Resonance and Mine.                   |

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
[ADR 0029](docs/adr/0029-bribe-based-resonance.md), and
[ADR 0030](docs/adr/0030-signalgbx-coordination-and-token-governance.md).

## Provenance

The signaling and acquisition graph adapts pinned give.fun and Liquid Signal Governance sources. Mine adapts the
Farplace MineRig mechanics, with protocol-specific changes for a strict 80/20 split, bounded multislot capacity,
tenure-locked rates, permanent GBX mint authority, and redemption checkpointing. Exact pins and unresolved licensing
clearance are recorded in [NOTICE](NOTICE).
