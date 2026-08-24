# Economics

> Target-development economics: ADRs 0031, 0037, and 0047 are authoritative development decisions.
> These mechanics remain unaudited and are not authorized for user funds.

## Supply

GBX starts with zero supply and permanently assigns its only lifetime mint authority to Mine before minting can begin. There is no
protocol-defined economic maximum supply. GBX supports ERC-2612 approvals but has no voting checkpoints; governance
power is minted one-for-one only when GBX is deposited into a Strategy signal through SignalGBX. Supply is exact
cumulative accounting:

```text
totalSupply = lifetimeMinted - lifetimeBurned
```

The positive tail rate allows mining revenue, signaling participation, and asset acquisition to continue indefinitely.

## Mining replacements

Each slot is an hourly reverse Dutch auction. Its replacement price falls linearly from `initialPrice` to zero. For a
nonempty-slot replacement:

- the outgoing tenure miner receives an 80% USDG pull claim;
- Mine deposits the 20% remainder into ResonanceRouter.

The first occupation of an empty slot instead deposits 100% into ResonanceRouter because there is no outgoing tenure
miner.

There is no team fee. A miner accepts rollover risk: if no positive-price replacement occurs, the tenure accrues GBX
but produces no nonzero 80% replacement claim. The current miner may replace its own slot, including for zero USDG
after the hourly price reaches zero.

## Tenure-locked rates

The TPS assigned when a tenure begins is fixed until the next replacement. Redemptions and later time-based halvings
never dilute that tenure. Each newly opened tenure receives:

```text
current global GBX tokens per second / 16
```

Integer division residue is unissued. Protecting tenure rates means aggregate issuance can remain above the new global
rate for as long as legacy slots retain older TPS; turnover is not guaranteed. The reproduced scenario in
`packages/simulations/fixtures/economic-scenarios.json` makes this tradeoff explicit.

## Emission curve

Mine hard-codes an initial global rate of 64 GBX per second, a provisional 69-day halving period measured from
deployment, and a positive global tail of 1 GBX per second. A lower prospective rate applies only when a slot's next
tenure begins. The schedule remains subject to independent economic review even though deployments cannot choose an
alternative after deployment.

In the synchronized reference path—every slot occupied, refreshed and settled at each boundary, with no burns—the
sixth boundary at day 414 follows 751,161,600 GBX of mining and gives the same 751,161,600 GBX gross supply.
The 31,536,000 GBX annual tail flow is initially about 4.198% of that reference supply and declines as supply grows.
This is not a cap, forecast, or guaranteed inflation rate: empty slots reduce issuance, legacy tenures can keep higher
rates indefinitely and exceed this path, and burns change the live denominator.

| Boundary | Day | Fresh global TPS | Synchronized no-burn gross supply |
| -------- | --- | ---------------- | --------------------------------- |
| Launch   | 0   | 64               | 0                                 |
| 1        | 69  | 32               | 381,542,400                       |
| 2        | 138 | 16               | 572,313,600                       |
| 3        | 207 | 8                | 667,699,200                       |
| 4        | 276 | 4                | 715,392,000                       |
| 5        | 345 | 2                | 739,238,400                       |
| 6 (tail) | 414 | 1                | 751,161,600                       |

After the tail, that same synchronized no-burn reference reaches 782,697,600 GBX after one year, 814,233,600 after
two years, 908,841,600 after five years, and 1,066,521,600 after ten years. These are measured from the day-414 tail,
not from Mine deployment.

## Revenue, acquisitions, and redemption

Mining replacements deposit their protocol USDG share into ResonanceRouter without calling it. A later permissionless
`route()` call moves the complete balance once it is at least both seven days of raw units and the scheduled revenue
remaining; the duration threshold prevents a zero whole-unit rate. There is no caller bounty or liveness guarantee,
so deposit and stream entry may be separated indefinitely. Each elapsed interval follows the SignalGBX
weights active during that interval; moving a signal checkpoints the old interval first and affects only later flow.
A holder mints sGBX only by atomically assigning the same amount to a live Strategy. SignalGBX coordinates every
change; its account balance is the aggregate signal, paired Bribes store per-Strategy positions and
`totalSignalWeight`, and
Resonance stores only the active total across live Strategies. Moving signal changes no custody or votes; withdrawal
removes the position, burns sGBX, and returns GBX atomically.
A Strategy purchase atomically pulls all revenue released to it through that timestamp, then sells its complete USDG
balance through a reverse Dutch auction. Before interacting with the payment token, Strategy snapshots Resonance's
global `bribeBps`. The rate defaults to 10%, governance may set it from 0% through 20%, and there is no per-Strategy
override. For each payment `a` at its captured rate `r`, Strategy computes:

```text
paired Bribe share = floor(a * r / 10,000)
Fund share = a - paired Bribe share
```

Strategy pulls the payment, transfers the Fund share directly to immutable Fund, and sends any nonzero Bribe share to
the paired BribeRouter. Each purchase floors independently; there is no weighted history or fractional carry between
purchases. A 0% purchase transfers the complete payment to Fund and adds nothing to the Router. Changing the rate
reclassifies no earlier Fund transfer, buffered Bribe share, active stream, or claim. Because every applied rate is at
most 20%, Fund receives at least 80% of each payment.

The payment asset, not USDG, funds the automatic paired-Bribe stream. BribeRouter buffers only that share and exposes
permissionless `route()`. It notifies the paired Bribe with its complete balance only when the balance is at least one
raw unit per stream second and at least `remainingReward`; this prevents a zero-rate schedule and preserves
standard leftover rollover. Compatible direct donations join the next notification, and a failed notification leaves
the tokens buffered without reversing the completed purchase. If the payment asset is GBX, the Fund share may be
burned permissionlessly after the purchase while the buffered share rewards signalers. A 0% automatic share does not
disable the paired Bribe: signal, move, withdrawal, existing rewards, and independently funded rewards continue
normally.

Streaming is lazy accounting: no keeper transaction is required each second. A later signal change, distribution,
purchase, or qualifying notification materializes the elapsed amount. A separate caller is required to attempt Router
forwarding, however. During an active schedule ResonanceRouter holds its balance until `route()` is called. A
qualifying complete balance checkpoints the stream, combines the new amount with the ordinary Synthetix leftover
(`remainingSeconds * revenueRate`), and restarts seven days; this can raise or lower the rate and move the finish.

Resonance uses whole-unit `revenueRate`, while each per-token Bribe stream uses `rewardRate`, so division floors remain
as unallocated token surplus rather than explicit carry. Their respective revenue-per-signal and reward-per-signal
indices use `1e36` precision, but index and account division can floor as well. Stream time continues at zero active
signal weight, making that interval's streamed revenue or rewards unclaimable, and
direct Resonance or Bribe donations are unscheduled. Compatible donations to ResonanceRouter or BribeRouter instead
join that Router's next valid complete-balance notification. None of the unallocated surplus is assigned to Fund or
later signalers.

Before redemption, Fund reads Mine's constant-time effective supply, including all accrued unminted mining. For each
selected token it then pays:

```text
floor(Fund balance * GBX burned / effective supply before burn)
```

Omitted assets remain for the post-redemption supply. A basket also reverts if one selected token transfer reduces
another selected address below its own snapshot less payout, preventing shared-ledger double counting. Pending
Fund-held GBX should be burned before quoting redemption.

One reviewed, externally created fungible Uniswap v2-style USDG/GBX LP ERC-20 is an ordinary bootstrap Strategy
payment token. Its purchases use
the same global Fund/Bribe split described above; there is no liquidity-specific accounting, fee route, valuation, or
guarantee in the core.
