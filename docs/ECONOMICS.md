# Economics

## Supply

GBX creates 20 million tokens for genesis liquidity, then permanently assigns mint authority to Mine. There is no
protocol-defined economic maximum supply. GBX supports ERC-2612 approvals but has no voting checkpoints; governance
power is minted one-for-one only when GBX is staked as SignalGBX. Supply is exact cumulative accounting:

```text
totalSupply = lifetimeMinted - lifetimeBurned
```

The positive tail rate allows mining revenue, signaling participation, and asset acquisition to continue indefinitely.

## Mining handoffs

Each slot is an hourly reverse Dutch auction. Its replacement price falls linearly from `initialPrice` to zero. When a
slot changes hands:

- the displaced miner receives an 80% USDG pull claim;
- 20% routes through ResonanceRouter; and
- the first occupation of an empty slot routes 100% to ResonanceRouter because nobody was displaced.

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

Mining and liquidity USDG route into Resonance's global seven-day stream. Each elapsed interval follows the SignalGBX
weights active during that interval; moving a signal checkpoints the old interval first and affects only later flow.
A holder may keep sGBX idle for governance without directing revenue or Bribe rewards. SignalGBX coordinates every
change; it stores the account aggregate, paired Bribes store per-Strategy positions and supply, and Resonance stores
only the active total across live Strategies.
A Strategy purchase atomically pulls all revenue released to it through that timestamp, then sells its complete USDG
balance through a reverse Dutch auction. The complete payment becomes a Fund liability. Bribes are independently
funded.

Streaming is lazy accounting: no keeper transaction is required each second. A later signal change, distribution,
purchase, or qualifying notification materializes the elapsed amount. During an active schedule ResonanceRouter holds
its balance while it is below the exact amount left. A qualifying complete balance checkpoints the stream and restarts
seven days with `reward + left`; this can raise or lower the rate and move the finish.

The raw quotient plus front-loaded remainder releases every scheduled six-decimal USDG unit, including a one-raw-unit
schedule. The global reward-per-signal index uses `1e36` precision, but global-index and per-Strategy floors are accepted
surplus rather than explicit carry. Stream time continues at zero active signal weight, making that interval's USDG
unclaimable, and direct Resonance donations are unscheduled surplus. Neither category is assigned to Fund or later
signalers. Bribe separately retains its explicit carry and Fund classification before its virtual supply changes.

Before redemption, Fund checkpoints every mining slot. For each selected token it then pays:

```text
floor(Fund balance * GBX burned / totalSupply after checkpoint and before burn)
```

Omitted assets remain for the post-redemption supply. A basket also reverts if one selected token transfer reduces
another selected address below its own snapshot less payout, preventing shared-ledger double counting. Pending
Fund-held GBX should be burned before quoting redemption.
