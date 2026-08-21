# GumBall6900

GumBall6900 is an experimental, governance-minimized onchain index protocol for Robinhood Chain. GBX miners supply
recurring USDG revenue, GBX signalers continuously direct which assets the protocol should acquire, and GBX can be
burned for caller-selected Fund assets.

> Development status: not deployed, audited, or authorized for user funds. Independent review, legal/provenance
> clearance, final economic parameters, and signed deployment evidence remain release blockers.

> Architecture status: [ADR 0031](docs/adr/0031-mandatory-signal-backed-signalgbx.md),
> [ADR 0032](docs/adr/0032-fixed-90-10-acquired-asset-settlement.md),
> [ADR 0034](docs/adr/0034-external-governance-ownership.md), and
> [ADR 0035](docs/adr/0035-bribe-lifetime-reward-cap.md),
> [ADR 0036](docs/adr/0036-governed-global-bribe-share.md), and
> [ADR 0037](docs/adr/0037-high-precision-bribe-index.md) are implemented in the development tree. ADR 0036
> supersedes ADR 0032's fixed-rate rule while retaining its cumulative liability accounting. Governance execution
> remains an unselected external integration, so deployment is blocked. This is local engineering evidence only;
> independent review and every deployment gate remain outstanding.

## Protocol loop

1. A user replaces an hourly Mine slot. If a miner is displaced, 80% of the USDG payment becomes their claim and 20%
   routes to Resonance. An empty slot routes 100% to Resonance.
2. The slot miner continuously accrues GBX at a rate fixed for that complete tenure.
3. GBX holders call SignalGBX (`sGBX`), the non-transferable governance token and sole signal coordinator, to deposit
   GBX, mint the same sGBX amount, and assign every minted unit to one live Strategy atomically. They may move an
   allocation without changing custody or votes, or withdraw it by removing signal, burning sGBX, and receiving GBX.
4. A Strategy buyer atomically pulls its released USDG, receives the complete Strategy balance, and pays the asset that
   Strategy acquires; BribeRouter cumulatively classifies the payment at Resonance's current global Bribe rate. It
   defaults to 10%, can be set from 0% through 20%, and sends the 80%-to-100% complement to Fund. Paired Bribes use a
   `1e36` reward index so ordinary six-decimal rewards remain distributable at realistic sGBX supply.
5. A GBX holder burns tokens to redeem a proportional share of caller-selected Fund assets.

```text
replacement USDG -> Mine --20%--> ResonanceRouter -> Resonance --7-day stream--> Strategies
                         \--80%--> displaced miner
Mine -> continuous GBX
GBX -> SignalGBX --mandatory signal--> Resonance allocation weights
SignalGBX --IVotes checkpoints-------> external governance (unselected) --owns--> Resonance
Strategy acquired-asset payment -> BribeRouter --80%-100% complement--> Fund
                                              \--0%-20% current rate--> paired Bribe -> signalers
GBX burn -> Fund selected assets
```

ResonanceRouter waits while its USDG balance is below the exact amount left in the active stream. A qualifying balance
checkpoints elapsed revenue and restarts seven days with the new reward plus that remainder. Resonance uses a `1e36`
reward index; index and Strategy floors, zero-active-signal intervals, and direct donations are accepted surplus.

## Mining and supply

GBX creates only 20 million tokens for the permanent, one-sided genesis liquidity position. Deployment then binds its
sole mint authority permanently to Mine. There is no protocol-defined economic supply cap or replacement minter. GBX
retains ERC-2612 permit approvals but carries no governance checkpoints; voting power exists only while GBX backs an
active Strategy signal through sGBX.

Mine has exactly 16 ownerless slots. Every slot's USDG replacement price decays linearly to zero over one hour and can
be filled at any time.

An occupied slot's GBX TPS cannot be changed mid-tenure. Mining halvings apply only when a slot is newly occupied or
replaced. This protects miners from mid-tenure dilution, while accepting that aggregate issuance can temporarily
exceed the current global TPS as old-rate and new-rate slots coexist. Constructor-fixed cumulative-mining
halvings end in a positive tail so mining and revenue can continue indefinitely.

## Redemption

Fund reads Mine's constant-time effective supply, without checkpointing any slot, then pays each selected token as:

```text
floor(Fund token balance * GBX burned / (minted GBX + pending mining emission) before burn)
```

The denominator includes accrued unminted mining rewards. Omitted assets stay in Fund. A failed selected-token
transfer reverts the complete redemption and burn.

## Governance-minimized core

All core contracts are direct and non-upgradeable. Fund and LiquidityPosition are ownerless. Resonance retains only
four continuing protocol administration methods:

- add or kill a Strategy;
- add a Bribe reward token within the fixed cap of eight;
- set the single global prospective automatic-Bribe share from 0% through 20%.

Changing that rate never reprices an earlier payment, liability, reward stream, queued reward, claim, or fractional
carry. At 0%, new Strategy payments classify entirely to Fund; paired Bribes, independently funded rewards, signal
movement, and withdrawal remain available.

SignalGBX retains block-clock ERC20Votes checkpoints for an external governance system, but this repository does not
select or implement that system. The exact executor, release, plugins, permissions, voting rules, upgrade model,
execution delay, and cancellation behavior remain deployment blockers. The selected external executor will own
Resonance directly and can also transfer or renounce that ownership. After the first Strategy is created,
`killStrategy` cannot remove the final live Strategy; the selected governance system must replace it by atomically
batching an addition before the old Strategy's kill.

## Contracts

| Contract            | Role                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `GBX`               | Genesis allocation, permanent Mine authority, cumulative mint/burn accounting, ERC-2612 permits.  |
| `Mine`              | Hourly multislot handoffs, continuous tenure-locked GBX accrual, 80/20 USDG split, positive tail. |
| `SignalGBX`         | Mandatory signal-backed GBX escrow, ERC20Votes governance, and sole signal coordinator.           |
| `ResonanceRouter`   | Holds USDG below the active amount left, then permissionlessly forwards a qualifying balance.     |
| `Resonance`         | Bribe-shaped seven-day USDG rewards, active signal totals, and Strategy/Bribe administration.     |
| `Strategy`          | Reverse Dutch acquisition auction.                                                                |
| `BribeRouter`       | Cumulative weighted Fund/Bribe classification at Resonance's bounded global prospective rate.     |
| `Bribe`             | Automatic and independent rewards, with eight-token and per-token lifetime notification caps.     |
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

### Reading it in plain English

Four editions describe the protocol for non-Solidity readers, in increasing depth:

```text
docs/deck                     21-slide pitch deck, self-contained HTML
docs/one-pager/gumball6900    One-page sheet, built to PDF and PNG
docs/articles                 Explainer article, built to PDF
docs/whitepapers/gumball-6900 Technical whitepaper, built to PDF
```

```bash
pnpm docs:one-pager
pnpm docs:longform
pnpm docs:whitepaper
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
[emissions](docs/EMISSIONS.md), [access control](docs/ACCESS_CONTROL.md),
[operations](docs/OPERATIONS.md), and
[ADR 0024](docs/adr/0024-immutable-multislot-mine.md), and
[ADR 0029](docs/adr/0029-bribe-based-resonance.md),
[ADR 0030](docs/adr/0030-signalgbx-coordination-and-token-governance.md),
[ADR 0031](docs/adr/0031-mandatory-signal-backed-signalgbx.md), and
[ADR 0032](docs/adr/0032-fixed-90-10-acquired-asset-settlement.md),
[ADR 0033](docs/adr/0033-fixed-mine-slots-and-constant-time-pending-emission.md),
[ADR 0034](docs/adr/0034-external-governance-ownership.md), and
[ADR 0035](docs/adr/0035-bribe-lifetime-reward-cap.md),
[ADR 0036](docs/adr/0036-governed-global-bribe-share.md), and
[ADR 0037](docs/adr/0037-high-precision-bribe-index.md).

## Provenance

The signaling and acquisition graph adapts pinned give.fun and Liquid Signal Governance sources. Mine adapts the
Farplace MineRig mechanics, with protocol-specific changes for a strict 80/20 split, bounded multislot capacity,
tenure-locked rates, permanent GBX mint authority, and redemption checkpointing. Exact pins and unresolved licensing
clearance are recorded in [NOTICE](NOTICE).
