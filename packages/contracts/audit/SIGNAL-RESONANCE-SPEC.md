# Signal and Resonance executable specification

Status: implemented locally on 2026-08-16; engineering evidence only; not independently audited, deployed, or
authorized for user funds.

## SignalGBX state machine

`SignalGBX` is the only user-facing signal entry point. `signal` and `signalWithPermit` transfer an exact amount of GBX
into custody, mint the same sGBX amount, and add the same account position to one live Strategy and its paired Bribe in
one reverting transaction. A holder without a delegate self-delegates on mint. `moveSignal` changes the source and
destination Bribe positions without changing custody, sGBX supply, or voting units. `withdrawSignal` removes one
Strategy position, burns the same sGBX amount, and returns the same GBX amount atomically.

The runtime contains no `stake`, `unstake`, `stakeAndSignal`, `stakeAndSignalWithPermit`, idle-balance `signal`,
`removeSignal`, or `removeSignalAndUnstake` selector. sGBX transfers are permanently disabled. Direct GBX donations to
SignalGBX are surplus and create no receipt, signal, vote, or withdrawal entitlement.

## Canonical identities

For every reachable state:

```text
SignalGBX.balanceOf(account)
  == sum(Bribe.balanceOf(account) for every registered Strategy, live or killed)

SignalGBX.totalSupply()
  == sum(Bribe.totalSupply() for every registered Strategy, live or killed)

GBX.balanceOf(SignalGBX) >= SignalGBX.totalSupply()

Resonance.totalSignalWeight()
  == sum(Bribe.totalSupply() for live Strategies only)
```

The paired Bribe owns account-by-Strategy balances and Strategy supply. SignalGBX owns aggregate account balance and
receipt supply. Resonance owns only the live aggregate. Only SignalGBX may invoke Resonance signal hooks.

## Resonance rewards

Resonance is a single-token, virtual-staking Bribe derivative. USDG is six decimals, the period is exactly seven days,
and the global reward-per-signal index uses `1e36`. Each signal change checkpoints elapsed revenue under the old
weights. A move checkpoints both Strategies before either Bribe balance changes. A Strategy purchase calls
`Resonance.distribute(strategy)` before taking its USDG inventory snapshot.

The raw stream schedules `quotient * 7 days + remainder`; remainder units are front-loaded one per second. A qualifying
active-period reset checkpoints the old period and schedules the incoming amount plus the exact amount left. Global
index flooring, per-Strategy flooring, direct donations, and revenue elapsed with zero live signal remain accepted
Resonance surplus. Distribution is permissionless but always pays the Strategy and clears its recorded claim before
the exact transfer.

## Strategy lifecycle

Only live Strategies accept new signal or a move destination. A killed Strategy is checkpointed, loses its complete
weight from the live denominator exactly once, earns no future Resonance revenue, and remains a valid move source and
withdrawal source. `liveStrategyCount` tracks registered live Strategies; killing the final live Strategy reverts.

## Acquired-asset settlement

Every Strategy payment is pulled once by its immutable BribeRouter and cumulatively classified as:

```text
bribe cumulative entitlement = floor(cumulative payment * 1,000 / 10,000)
Fund cumulative entitlement   = cumulative payment - bribe cumulative entitlement
```

`splitRemainder` retains the basis-point numerator remainder, making the result independent of fill partitioning.
Fund and Bribe liabilities are fixed, separately permissionless to settle, cleared before interaction, and restored by
transaction rollback on failure. The Bribe leg notifies the acquired asset as a reward. Direct Router donations are
surplus and cannot satisfy or enlarge either liability.

## Governance boundary

ProtocolGovernor voting units are SignalGBX checkpoints. The Governor can propose only exact zero-value calls for
`Resonance.addStrategy`, `Resonance.killStrategy`, `Resonance.addBribeReward`, and `Mine.increaseCapacity`. The Timelock
remains the only post-setup owner of Resonance and Mine, with no guardian or alternate proposer path.

## Supported-token assumption

GBX, USDG, Strategy payment tokens, and registered Bribe rewards must be conventional, non-rebasing ERC-20s with exact
observable debits and credits. Exact-delta guards reject fee, surcharge, missing-balance, and other asymmetric behavior.
Broken Fund assets remain caller-omittable; broken reward tokens retain scalar/selective claim escape paths.
