# ADR-0013: familiar core contracts as the development starting point

## Status

Accepted as historical starting point; acquisition-split and buyback provisions superseded by ADR 0021. Not approved
for deployment or user funds.

## Context

The previous rebuild separated mining across several contracts, used a registered vault basket, and introduced more
production machinery than was useful for early protocol iteration. That made the code harder to compare with the
mechanics the project team already understood.

The first replacement draft overcorrected to six contracts. It omitted revenue and bribe routers, both factories, signal
rewards, selective redemption, and migration. It also retained the names `Miner` and `Auction`, which did not match the
project language.

## Decision

The canonical core under `packages/contracts/src/core` uses these contracts:

`GBX`, `Fundraiser`, `LiquidityPosition`, `SignalGBX`, `ResonanceRouter`, `Resonance`, `StrategyFactory`, `Strategy`,
`BribeFactory`, `BribeRouter`, `Bribe`, and `Fund`. ADR-0014 fixes the GBX allocation, Fundraiser schedule, and
LiquidityPosition boundaries added after this initial decision.

The system makes the following deliberate choices:

- every Fundraiser contribution routes through ResonanceRouter into Resonance;
- SignalGBX signaling and withdrawal have no time-based restriction;
- Resonance alone uses the Strategy and Bribe factories;
- acquisitions begin with a 90% Fund / 10% signal-reward split, adjustable up to 50% through timelocked governance;
- buybacks burn their entire GBX payment and do not pay signal rewards;
- Fund has no asset registry and redemption operates over a unique caller-selected token array;
- duplicate detection uses EIP-1153 transient storage;
- omitted redemption assets remain for the remaining GBX supply;
- Fund can bind one same-GBX successor and migrate complete selected balances in permissionless batches; and
- Resonance and Fund administration use OpenZeppelin `TimelockController`, with the project multisig as proposer and
  canceller, permissionless delayed execution, and no external default administrator.

The cumulative one-billion lifetime GBX mint ceiling remains mandatory and burns never reopen mint capacity.

## Consequences

- The core is recognizable and small enough to iterate on, but routers and factories make every payment path explicit.
- Unrestricted signaling favors simplicity and liquidity over epoch-level allocation stability.
- Caller-selected redemption prevents one malformed token from globally blocking exits, but users and interfaces must
  discover Fund balances and understand that omitted claims are forfeited.
- A permissionless Fund accepts unsolicited tokens as backing. There is intentionally no unregistered-token recovery.
- Migration provides a constrained escape hatch while introducing a timelocked governance trust assumption.
- The standard OpenZeppelin controller removes custom governance code, but governance can schedule any call exposed by
  a contract it owns. Contract-level access controls and one-way invariants remain the authority boundary.
- Bribe rewards stream for seven days even though staking itself has no lock.
- The previous Solidity rebuild is removed rather than compiled alongside the new starting point.

## Credit

The starting mechanics are adapted from give.fun and Liquid Signal Governance. The Strategy auction also credits Euler
Fee Flow. Exact source pins are recorded in `NOTICE`.
