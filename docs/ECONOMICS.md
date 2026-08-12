# Economics

## Supply

GBX creates 20 million tokens for genesis liquidity, then permanently assigns mint authority to Mine. There is no
protocol-defined economic maximum supply; ERC20Votes retains its `uint208` implementation ceiling. Supply is exact
cumulative accounting:

```text
totalSupply = lifetimeMinted - lifetimeBurned
```

The positive tail rate allows mining revenue, signaling participation, and asset acquisition to continue indefinitely.

## Mining handoffs

Each slot is an hourly reverse Dutch auction. Its replacement price falls linearly from `initialPrice` to zero. When a
slot changes hands:

- the displaced miner receives an 80% USDG pull claim;
- 20% routes through ResonanceRouter; and
- the first occupation of an empty slot routes 100% to Resonance because nobody was displaced.

There is no team fee. A miner accepts rollover risk: if no successor pays to replace them, they receive GBX but no 80%
handoff payment.

## Tenure-locked rates

The rate assigned when a slot is occupied is fixed until that slot changes hands. Capacity increases, checkpoints,
redemptions, and later cumulative-mining halvings never dilute an incumbent. A new or replaced slot receives:

```text
current global GBX-per-second rate / current capacity
```

Integer division residue is unissued. Protecting incumbents means capacity expansion can temporarily increase aggregate
issuance: legacy slots retain older rates while new slots receive divided current rates. The reproduced scenario in
`packages/simulations/fixtures/economic-scenarios.json` makes this tradeoff explicit.

## Emission curve

The constructor fixes the initial global rate, cumulative issuance threshold per halving, and positive tail rate. The
global rate is halved at geometric cumulative-mining thresholds, but the lower rate applies only at a later slot
handoff. Exact deployment parameters remain release inputs and must be recorded in a signed manifest.

## Revenue, acquisitions, and redemption

Mining and liquidity USDG route through Resonance and follow current SignalGBX weights. A Strategy sells its complete
USDG balance through a reverse Dutch auction; the complete payment becomes a Fund liability. Bribes are independently
funded.

Before redemption, Fund checkpoints every mining slot. For each selected token it then pays:

```text
floor(Fund balance * GBX burned / totalSupply after checkpoint and before burn)
```

Omitted assets remain for the post-redemption supply. Pending Fund-held GBX should be burned before quoting redemption.
