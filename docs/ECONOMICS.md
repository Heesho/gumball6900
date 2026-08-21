# Economics

> Target-development economics: ADRs 0031, 0036, and 0037 are authoritative development decisions.
> These mechanics remain unaudited and are not authorized for user funds.

## Supply

GBX creates 20 million tokens for genesis liquidity, then permanently assigns mint authority to Mine. There is no
protocol-defined economic maximum supply. GBX supports ERC-2612 approvals but has no voting checkpoints; governance
power is minted one-for-one only when GBX is deposited into a Strategy signal through SignalGBX. Supply is exact
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
- the first occupation of an empty slot routes 100% to ResonanceRouter because nobody was displaced.

There is no team fee. A miner accepts rollover risk: if no successor pays to replace them, they receive GBX but no 80%
handoff payment.

## Tenure-locked rates

The TPS assigned when a slot is occupied is fixed until that slot changes hands. Redemptions and later
cumulative-mining halvings never dilute an incumbent. A new or replaced slot receives:

```text
current global GBX tokens per second / 16
```

Integer division residue is unissued. Protecting incumbents means a halving can temporarily leave aggregate issuance
above the new global rate: legacy slots retain older TPS while new slots receive the new rate. The reproduced scenario in
`packages/simulations/fixtures/economic-scenarios.json` makes this tradeoff explicit.

## Emission curve

The constructor fixes the initial global rate, cumulative issuance threshold per halving, and positive tail rate. The
global rate is halved at geometric cumulative-mining thresholds, but the lower rate applies only at a later slot
handoff. Exact deployment parameters remain release inputs and must be recorded in a signed manifest.

## Revenue, acquisitions, and redemption

Mining and liquidity USDG route into Resonance's global seven-day stream. Each elapsed interval follows the SignalGBX
weights active during that interval; moving a signal checkpoints the old interval first and affects only later flow.
A holder mints sGBX only by atomically assigning the same amount to a live Strategy. SignalGBX coordinates every
change; its account balance is the aggregate signal, paired Bribes store per-Strategy positions and supply, and
Resonance stores only the active total across live Strategies. Moving signal changes no custody or votes; withdrawal
removes the position, burns sGBX, and returns GBX atomically.
A Strategy purchase atomically pulls all revenue released to it through that timestamp, then sells its complete USDG
balance through a reverse Dutch auction. Its acquired-asset payment is classified at Resonance's global `bribeBps`
current when the payment is routed. The rate defaults to 10%, governance may set it from 0% through 20%, and Fund
receives the complement. There is no per-Strategy rate. The two resulting fixed liabilities settle independently, so a
failure at one destination does not block or consume the other. Additional independently funded Bribe rewards remain
possible.

For payments `a_i` classified at applied rates `r_i`:

```text
weighted Bribe numerator = sum(a_i * r_i)
paired Bribe classification = floor(weighted Bribe numerator / 10,000)
Fund classification = sum(a_i) - paired Bribe classification
split remainder = weighted Bribe numerator mod 10,000
```

The remainder persists unchanged across governance transitions, so classification is exact over a history such as
10% to 0% to 5% or 20%. A 0% payment adds no weighted Bribe numerator, creates no new Bribe liability, and classifies
entirely to Fund; prior fractional carry is preserved but cannot cross a raw-token boundary until a later nonzero-rate
payment. Changing the rate reclassifies no prior payment or existing liability, stream, or claim. Because every applied
rate is at most 20%, Fund receives at least 80% across the cumulative history, although carry can make an individual
small payment's visible raw-unit split differ from its nominal percentage.

The payment asset, not USDG, funds the automatic paired-Bribe stream. If the payment asset is GBX, the dynamically
Fund-classified share may be burned permissionlessly after settlement while any nonzero paired-Bribe share rewards
signalers. A 0% automatic share does not disable the paired Bribe: signal, move, withdrawal, existing reward settlement,
and independently funded rewards continue normally.

Streaming is lazy accounting: no keeper transaction is required each second. A later signal change, distribution,
purchase, or qualifying notification materializes the elapsed amount. During an active schedule ResonanceRouter holds
its balance while it is below the exact amount left. A qualifying complete balance checkpoints the stream and restarts
seven days with `reward + left`; this can raise or lower the rate and move the finish.

The raw quotient plus front-loaded remainder releases every scheduled six-decimal USDG unit, including a one-raw-unit
schedule. The global reward-per-signal index uses `1e36` precision, but global-index and per-Strategy floors are accepted
surplus rather than explicit carry. Stream time continues at zero active signal weight, making that interval's USDG
unclaimable, and direct Resonance donations are unscheduled surplus. Neither category is assigned to Fund or later
signalers. Bribe separately retains its explicit carry and Fund classification before its virtual supply changes.

Before redemption, Fund reads Mine's constant-time effective supply, including all accrued unminted mining. For each
selected token it then pays:

```text
floor(Fund balance * GBX burned / effective supply before burn)
```

Omitted assets remain for the post-redemption supply. A basket also reverts if one selected token transfer reduces
another selected address below its own snapshot less payout, preventing shared-ledger double counting. Pending
Fund-held GBX should be burned before quoting redemption.
