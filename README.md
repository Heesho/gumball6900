# GumBall6900

GumBall6900 is an experimental, governance-minimized onchain index protocol for Robinhood Chain. GBX miners supply
recurring USDG revenue, GBX signalers continuously direct which assets the protocol should acquire, and GBX can be
burned for caller-selected Fund assets.

> Development status: not deployed, audited, or authorized for user funds. Independent review, legal/provenance
> clearance, final economic parameters, and signed deployment evidence remain release blockers.

> Architecture status: [ADR 0031](docs/adr/0031-mandatory-signal-backed-signalgbx.md),
> [ADR 0032](docs/adr/0032-fixed-90-10-acquired-asset-settlement.md),
> [ADR 0033](docs/adr/0033-fixed-mine-slots-and-constant-time-pending-emission.md),
> [ADR 0034](docs/adr/0034-external-governance-ownership.md),
> [ADR 0035](docs/adr/0035-bribe-lifetime-reward-cap.md),
> [ADR 0036](docs/adr/0036-governed-global-bribe-share.md), and
> [ADR 0037](docs/adr/0037-high-precision-bribe-index.md), together with the Mine decisions
> [ADR 0038](docs/adr/0038-fixed-mine-economics.md),
> [ADR 0039](docs/adr/0039-event-only-mine-messages.md),
> [ADR 0040](docs/adr/0040-deployment-time-mine-authority-verification.md),
> [ADR 0041](docs/adr/0041-time-based-mine-halvings.md),
> [ADR 0042](docs/adr/0042-provisional-accelerated-mine-emissions.md),
> [ADR 0043](docs/adr/0043-provisional-one-gbx-tail.md), and
> [ADR 0044](docs/adr/0044-decouple-mine-from-revenue-routing.md),
> [ADR 0045](docs/adr/0045-defer-mine-router-token-verification.md), and
> [ADR 0046](docs/adr/0046-usdg-only-resonance-accounting.md), and
> [ADR 0047](docs/adr/0047-synthetix-shaped-rewards-and-strategy-settlement.md), and
> [ADR 0048](docs/adr/0048-expand-bribe-rewards-and-compose-signal-moves.md),
> [ADR 0049](docs/adr/0049-trust-canonical-token-transfers.md),
> [ADR 0050](docs/adr/0050-zero-premint-and-external-lp-strategy.md), and
> [ADR 0051](docs/adr/0051-scalar-and-batched-signal-entrypoints.md), are implemented in the development tree.
> ADR 0047 restores Synthetix-shaped reward schedules and direct per-purchase Strategy settlement; ADR 0048 raises the
> fixed Bribe reward-token cap to sixteen and removes Resonance's dedicated move hook in favor of SignalGBX composing
> removal and addition atomically. ADR 0049 standardizes canonical GBX/USDG paths on `SafeERC20` without balance-delta
> snapshots while retaining Fund's arbitrary-asset redemption guards. ADR 0050 removes the GBX premint and canonical
> liquidity contract; one reviewed, externally created fungible Uniswap v2-style USDG/GBX LP ERC-20 is instead an
> ordinary bootstrap Strategy asset. ADR 0051 replaces signal/permit/move/withdraw with scalar and optional batched
> add/remove operations and adds stateless read periphery without a shared write-through Router.
> Governance execution remains an unselected external integration, so deployment is
> blocked. This is local engineering evidence only; independent review and every deployment gate remain outstanding.

## Protocol loop

1. A user replaces an hourly Mine slot. For a nonempty-slot replacement, 80% of the USDG payment becomes a claim for
   the outgoing tenure miner and Mine deposits the 20% remainder into ResonanceRouter. An empty slot deposits 100%. A
   later permissionless `route()` call may forward the Router balance into Resonance.
2. The slot miner continuously accrues GBX at a rate fixed for that complete tenure.
3. GBX holders call SignalGBX (`sGBX`), the non-transferable governance token and sole signal coordinator, to add signal
   to one or several live Strategies atomically. Scalar and batched removals burn the corresponding sGBX and return the
   same GBX; scalar removal remains the bounded fallback. Smart wallets may compose approvals and direct calls, but no
   shared Router owns or writes user signal.
4. A Strategy buyer atomically pulls its released USDG, receives the complete Strategy balance, and pays the asset that
   Strategy acquires. Strategy snapshots Resonance's current global Bribe rate, floors that purchase's Bribe share,
   sends the 80%-to-100% complement directly to Fund, and sends the 0%-to-20% Bribe share to its minimal BribeRouter
   buffer. Paired Bribes use a `1e36` reward-per-signal index so ordinary six-decimal rewards remain distributable at realistic
   sGBX supply.
5. A GBX holder burns tokens to redeem a proportional share of caller-selected Fund assets.

```text
nonempty replacement USDG -> Mine --20% deposit--> ResonanceRouter --permissionless route()--> Resonance
                                  \--80%--> outgoing tenure miner claim              \--7-day stream--> Strategies
empty-slot payment -------------> Mine --100% deposit--> ResonanceRouter
Mine -> continuous GBX
GBX -> SignalGBX --mandatory signal--> Resonance allocation weights
SignalGBX --IVotes checkpoints-------> external governance (unselected) --owns--> Resonance
Strategy acquired-asset payment -> Strategy --80%-100% complement--> Fund
                                             \--0%-20% current rate--> BribeRouter --> paired Bribe -> signalers
GBX burn -> Fund selected assets
```

Mine stops after a successful `SafeERC20` request for the nominal protocol share to ResonanceRouter; under the
supported standard USDG model, that amount reached the Router. Mine does not call `route()` during a replacement. Anyone
may route later, directly or through optional frontend/cron automation, but there is no keeper role, bounty, or
liveness guarantee.

ResonanceRouter waits while its USDG balance is below either one raw unit per stream second or the amount left in the
active stream. A qualifying balance checkpoints elapsed revenue and restarts seven days with the new revenue plus the
ordinary Synthetix leftover. Resonance uses a `1e36` revenue-per-signal index; rate, index, and Strategy floors,
zero-active-signal intervals, and direct donations are accepted surplus.

## Mining and supply

GBX starts with zero supply and cannot mint before deployment permanently binds its sole mint authority to Mine. Mine
is then the only lifetime issuer. There is no protocol-defined economic supply cap or replacement minter. GBX
retains ERC-2612 permit approvals but carries no governance checkpoints; voting power exists only while GBX backs an
active Strategy signal through sGBX.

Mine has exactly 16 ownerless slots. Every slot's USDG replacement price decays linearly to zero over one hour and can
be filled at any time. The payer may attach up to 280 raw bytes of message metadata to the `Mined` event; Mine does
not store it in contract state.

An occupied slot's GBX TPS cannot be changed mid-tenure. Mining halvings apply only when a slot is newly occupied or
replaced. This protects miners from mid-tenure dilution, while accepting that aggregate issuance can exceed the
current global TPS for as long as old-rate and new-rate slots coexist; turnover is not guaranteed. The prospective
global rate halves on a fixed deployment-time schedule and ends in a positive tail so mining and revenue can continue
indefinitely.

## Redemption

Fund reads Mine's constant-time effective supply, without checkpointing any slot, then pays each selected token as:

```text
floor(Fund token balance * GBX burned / (GBX totalSupply() + pending mining emission) before burn)
```

The denominator includes accrued unminted mining rewards. Omitted assets stay in Fund. A failed selected-token
transfer reverts the complete redemption and burn.

## Governance-minimized core

All core contracts are direct and non-upgradeable. Fund and Mine are ownerless. Resonance retains only
four continuing protocol administration methods:

- add or kill a Strategy;
- add a Bribe reward token within the fixed cap of sixteen;
- set the single global prospective automatic-Bribe share from 0% through 20%.

Changing that rate never reprices an earlier payment, reward stream, or claim. At 0%, new Strategy payments go
entirely to Fund; paired Bribes, independently funded rewards, and scalar/batched signal removal remain available.

SignalGBX retains block-clock ERC20Votes checkpoints for an external governance system, but this repository does not
select or implement that system. The exact executor, release, plugins, permissions, voting rules, upgrade model,
execution delay, and cancellation behavior remain deployment blockers. The selected external executor will own
Resonance directly and can also transfer or renounce that ownership. After the first Strategy is created,
`killStrategy` cannot remove the final live Strategy; the selected governance system must replace it by atomically
batching an addition before the old Strategy's kill.

## Contracts

| Contract          | Role                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `GBX`             | Zero-premint token with permanent Mine authority, cumulative mint/burn accounting, and ERC-2612. |
| `Mine`            | Hourly multislot replacements, tenure-locked GBX accrual, 80/20 USDG split, and positive tail.   |
| `SignalGBX`       | Mandatory signal-backed GBX escrow, ERC20Votes governance, and sole signal coordinator.          |
| `ResonanceRouter` | Buffers USDG until it can sustain a nonzero stream and cover the active amount left.             |
| `Resonance`       | Scalar seven-day USDG revenue, active signal totals, and Strategy/Bribe administration.          |
| `StrategyFactory` | Resonance-bound factory for uniform Strategy deployments.                                        |
| `Strategy`        | Reverse Dutch acquisition auction.                                                               |
| `BribeFactory`    | Resonance-bound factory for paired Bribe deployments.                                            |
| `BribeRouter`     | Minimal buffer that permissionlessly notifies a paired Bribe with its acquired-asset share.      |
| `Bribe`           | Synthetix-shaped automatic and independent rewards with fixed token and lifetime caps.           |
| `Fund`            | Registry-free backing, selective redemption, and permissionless Fund-held GBX burn.              |

Optional `SignalPortfolioLens` periphery batches caller-selected, stateless portfolio reads. It holds no registry,
role, custody, or write path; SDK write builders target SignalGBX directly.

The core contains no liquidity contract. One reviewed, externally created fungible Uniswap v2-style USDG/GBX LP token
is registered during bootstrap as an ordinary Strategy payment token, using the same Fund/Bribe settlement as every
other index asset. Its address and configuration are deployment inputs; the protocol neither creates nor guarantees
liquidity.

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
[ADR 0037](docs/adr/0037-high-precision-bribe-index.md), and
[ADR 0038](docs/adr/0038-fixed-mine-economics.md),
[ADR 0039](docs/adr/0039-event-only-mine-messages.md),
[ADR 0040](docs/adr/0040-deployment-time-mine-authority-verification.md),
[ADR 0041](docs/adr/0041-time-based-mine-halvings.md),
[ADR 0042](docs/adr/0042-provisional-accelerated-mine-emissions.md), and
[ADR 0043](docs/adr/0043-provisional-one-gbx-tail.md), and
[ADR 0044](docs/adr/0044-decouple-mine-from-revenue-routing.md),
[ADR 0045](docs/adr/0045-defer-mine-router-token-verification.md), and
[ADR 0046](docs/adr/0046-usdg-only-resonance-accounting.md), and
[ADR 0047](docs/adr/0047-synthetix-shaped-rewards-and-strategy-settlement.md), and
[ADR 0048](docs/adr/0048-expand-bribe-rewards-and-compose-signal-moves.md), and
[ADR 0049](docs/adr/0049-trust-canonical-token-transfers.md), and
[ADR 0050](docs/adr/0050-zero-premint-and-external-lp-strategy.md), and
[ADR 0051](docs/adr/0051-scalar-and-batched-signal-entrypoints.md).

## Provenance

The signaling and acquisition graph adapts pinned give.fun and Liquid Signal Governance sources. Mine's mining-market
lineage is donut-miner, with protocol-specific changes for a strict 80/20 split, fixed multislot capacity,
tenure-locked rates, permanent GBX mint authority, and constant-time redemption supply. Its exact upstream pin and
unresolved licensing clearance are recorded in [NOTICE](NOTICE).
