# Core invariants

> These are development invariants under ADRs 0031, 0034-0037, and 0047-0050. Governance execution remains an
> unselected external integration and contributes no production invariant until separately reviewed.

## GBX and Mine

- GBX starts with zero supply and zero lifetime minted, has no protocol-defined economic maximum, supports ERC-2612
  permit approvals, and carries no ERC20Votes checkpoints.
- `GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()`.
- The temporary minter cannot mint and may permanently hand authority to one deployed Mine exactly once. After the
  handoff, neither the minter nor the lock can change, and Mine is the sole lifetime issuer.
- Mine has exactly sixteen immutable, ownerless slots.
- Every occupied slot accrues `elapsedSeconds * slot.tps`. Its `tps` is fixed from occupation until replacement.
- Time-based halving boundaries and redemptions never reprice an occupied slot.
- Each newly opened tenure receives `globalTps(now - startTime) / 16`; floor remainder is unissued.
- Global rates used for future tenures halve at immutable intervals measured from Mine deployment and never fall below the
  positive immutable tail.
- `Mine.aggregateTps() == sum(Mine.slot(i).tps)` across all sixteen slots.
- `Mine.effectiveTotalSupply() == GBX.totalSupply() + Mine.pendingEmission()`.
- A replacement settles only its outgoing slot before assigning the incoming tenure.
- A nonempty-slot USDG payment is exactly `80% outgoing-tenure-miner claim + 20% Router deposit`. An empty-slot payment is
  100% deposited into ResonanceRouter. A zero-price replacement transfers nothing. Mine never requires a downstream
  Router-to-Resonance call to complete the replacement. These nominal transfer identities rely on standard canonical USDG;
  Mine uses `SafeERC20` without inspecting balance deltas.
- Under the supported USDG model and absent unsolicited donations, Mine USDG balance equals total outstanding pull
  claims; claim execution reduces both by the same nominal amount.
- Every Fund redemption uses Mine's constant-time effective supply without checkpointing or mutating Mine.

## Signals, revenue, and Bribes

- SignalGBX supply is backed at least one-for-one by GBX held in SignalGBX, cannot be transferred, and retains
  ERC20Votes checkpoints for a future external governance integration. Direct GBX donations are stranded surplus and
  mint no receipt or votes; SignalGBX has no ERC-2612 approval permit.
- Idle SignalGBX is unreachable. Every mint atomically requests a GBX deposit and creates the same nominal Strategy
  and paired-Bribe position; every burn atomically removes the same nominal position and requests the GBX return.
  SignalGBX relies on standard canonical GBX semantics and does not inspect transfer deltas.
- SignalGBX is the sole external signal coordinator. `SignalGBX.balanceOf(account)` is the canonical account aggregate,
  each paired Bribe's `signalWeightOf(account)` and `totalSignalWeight` are the canonical account-by-Strategy and
  Strategy aggregate ledgers, and Resonance reads those values rather than duplicating them. There is no separate
  `allocatedBalance`.
- For every account, SignalGBX balance equals the sum of its positions across every live and killed paired Bribe.
- SignalGBX total supply equals the sum of all paired-Bribe `totalSignalWeight` values across live and killed Strategies.
- Active Resonance `totalSignalWeight` equals the sum of paired-Bribe `totalSignalWeight` values for live Strategies
  only. A killed Strategy keeps its recorded user and Bribe signal weights while its complete weight remains excluded
  from active `totalSignalWeight`.
- Before the first Strategy is created, live Strategy count may be zero and new signal is impossible. After bootstrap,
  live Strategy count never reaches zero; the final Strategy can be killed only after a replacement is added.
- An active Resonance schedule finishes seven days after its most recent qualifying notification and emits
  `REWARD_DURATION * revenueRate` raw USDG. Rate-division remainder is accepted surplus.
- ResonanceRouter forwards its complete balance only when it is at least
  `max(REWARD_DURATION, remainingRevenue())`; smaller balances
  remain buffered. Resonance restarts seven days with ordinary Synthetix leftover rollover.
- The Resonance USDG balance is at least its whole scheduled remainder plus every Strategy's previewed whole revenue.
  Rate, index, and Strategy floors, zero-active-signal emission, and direct donations are accepted surplus.
- Every signal mutation checkpoints elapsed stream revenue before changing weights, and every Strategy purchase
  checkpoints and pulls released revenue before reading inventory.
- `SignalGBX.moveSignal` atomically composes source `removeSignalFor` then destination `addSignalFor`; the destination
  must be live, a failed addition rolls back the removal, and Resonance exposes no dedicated move hook.
- Killing a Strategy checkpoints and preserves its accrued whole Resonance revenue, excludes its complete live weight,
  blocks additions, and lets existing signalers remove without reducing active `totalSignalWeight` again.
- Bribe streams use ordinary Synthetix rate, index, and account floors; unallocated amounts remain token surplus.
- Bribe stream time continues at zero `totalSignalWeight`. Notifications are not queued and may restart a live stream only
  when the new amount is at least both `REWARD_DURATION` and `remainingReward(rewardToken)`.
- A Bribe has at most sixteen append-only reward tokens.
- For every Bribe reward token,
  `lifetimeRewardNotified[token] <= floor(type(uint256).max / Bribe.REWARD_PRECISION())`. The counter increases by each
  accepted raw notification, never decreases, and excludes direct donations. A notification that would exceed the cap
  reverts before checkpointing or transfer. The previewed reward-per-signal index cannot exceed
  `lifetimeRewardNotified[token] * Bribe.REWARD_PRECISION()`.
- `withdrawSignal` never depends on transferring a revenue, payment, or reward token other than its canonical GBX
  return. Killed-Strategy positions remain movable out or withdrawable.
- Only Resonance can deploy through StrategyFactory or BribeFactory or maintain Bribe virtual balances.

## Governance

- The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter.
- SignalGBX retains ERC20Votes checkpoints on its default block-number clock, but the core assigns them no proposal
  threshold, quorum, voting period, cancellation, delay, or execution semantics.
- Resonance is the only core contract with continuing custom owner authority after its one-time router binding. Those
  methods are `addStrategy`, `killStrategy`, `addBribeRewardToken`, and bounded global `setBribeBps`; inherited ownership
  transfer and renunciation remain. SignalGBX, StrategyFactory, and BribeFactory retain setup-only inherited ownership
  shells after their one-time bindings, with no remaining custom owner action.
- `0 <= Resonance.bribeBps() <= 2_000`, its deployment default is 1,000, and Fund's classification rate is always
  `10_000 - bribeBps`. There is no per-Strategy rate or separately configurable Fund rate.
- The external Resonance owner is unselected. No production ownership, voting, permission, upgrade, batching, delay, or
  cancellation invariant exists until a later ADR selects the exact external integration, so deployment is blocked.

## Strategies, Fund, and external liquidity

- Each Strategy payment `a` snapshots rate `r` before payment-token interaction, sends
  `floor(a * r / 10_000)` to BribeRouter, and sends the exact complement directly to Fund. There is no split carry;
  payment partitioning may change cumulative results by sub-token floor amounts.
- A rate change is prospective and changes no prior transfer, Bribe stream, or accrued claim. At rate zero, new
  payments go entirely to Fund while signaling, exit, existing rewards, and independent funding remain live.
- BribeRouter holds only the Bribe share and routes its complete compatible-token balance permissionlessly once
  notification gates are met. Direct donations join that balance. Notification failure leaves the balance buffered.
- A GBX-priced Strategy is supply-neutral until its inline Fund share is burned; its Bribe share remains a reward and
  is not burned by settlement.
- Fund redemption uses one effective pre-burn supply snapshot for every selected token and is atomic with the
  GBX burn and every selected transfer.
- Redemption rejects GBX, the zero address, and duplicates. Fund has no asset registry or administrative withdrawal.
- One reviewed, externally created fungible Uniswap v2-style USDG/GBX LP ERC-20 is an ordinary bootstrap Strategy
  payment token and follows the same
  Fund/Bribe split as every other Strategy.
- The core has no liquidity-specific contract, custody, pricing, swap, harvest, or guarantee.
- Fund is ownerless; external LP tokens held by Fund are ordinary caller-selectable redemption assets.
