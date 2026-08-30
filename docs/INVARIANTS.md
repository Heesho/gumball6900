# Core invariants

> These are development invariants under ADRs 0031, 0034-0037, and 0047-0055. Governance execution remains an
> unselected external integration and contributes no production invariant until separately reviewed.

## GBX and Mine

- GBX starts with zero supply and zero lifetime minted when its constructor returns, has no protocol-defined economic
  maximum, supports ERC-2612 permit approvals, and carries no ERC20Votes checkpoints.
- `GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()`.
- The temporary minter cannot mint and may permanently hand authority to one deployed Mine exactly once. After the
  handoff, neither the minter nor the lock can change, and Mine is the sole lifetime issuer.
- A Mine constructed with `genesisAuthority == address(0)` can never mint genesis liquidity. Otherwise only that
  authority may consume the path, only once, only after permanent GBX binding, only to a deployed recipient, and only
  for `Mine.GENESIS_LIQUIDITY_GBX() == 1,000 ether`. A successful call sets `genesisLiquidityMinted == true` and clears
  `genesisAuthority` before minting.
- `GBX.lifetimeMinted() == Mine.totalMined() + (Mine.genesisLiquidityMinted() ? 1,000 ether : 0)`.
- Mine has exactly sixteen immutable slots; owner authority cannot alter their count or accounting.
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
- Mine's Router may change only through `setResonanceRouter`; the candidate differs from the current Router and
  reciprocally identifies Mine's immutable USDG and Fund through a deployed Resonance whose SignalGBX identifies Mine's
  immutable GBX. A successful update changes no prior Mine claim, Router balance, Resonance state, or signal position.

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
- `addSignalMany` and `removeSignalMany` are atomic across their caller-supplied arrays, use one aggregate custody
  transition, and emit the same per-allocation events as scalar calls. Scalar removal remains independently callable.
- SignalGBX exposes no public move and Resonance exposes no dedicated move hook; smart wallets may compose direct
  remove/add calls without granting a shared Router custody or operator authority.
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
- `removeSignal` and `removeSignalMany` never depend on transferring a revenue, payment, or reward token other than
  their canonical GBX return. Killed-Strategy positions remain removable.
- Only Resonance can deploy through StrategyFactory or BribeFactory or maintain Bribe virtual balances.

## Governance

- The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter.
- SignalGBX retains ERC20Votes checkpoints on its default block-number clock, but the core assigns them no proposal
  threshold, quorum, voting period, cancellation, delay, or execution semantics.
- Mine and Resonance are the only core contracts with continuing custom owner authority. Mine retains only
  `setResonanceRouter`; Resonance retains `addStrategy`, `killStrategy`, `addBribeRewardToken`, and bounded global
  `setBribeBps`. Both use two-step ownership transfer and immediate renunciation. SignalGBX, StrategyFactory, and
  BribeFactory retain setup-only plain-`Ownable` shells after their one-time bindings, with no remaining custom owner
  action. Resonance's own setup-only `setResonanceRouter` binding is consumed before handoff and cannot be replaced or
  cleared.
- `0 <= Resonance.bribeBps() <= 2_000`, its deployment default is 1,000, and Fund's classification rate is always
  `10_000 - bribeBps`. There is no per-Strategy rate or separately configurable Fund rate.
- The external Mine/Resonance owner is unselected. No production ownership, voting, permission, upgrade, batching, delay, or
  cancellation invariant exists until a later ADR selects the exact external integration, so deployment is blocked.
- A successful canonical launch ends with SignalGBX, StrategyFactory, and BribeFactory owners equal to `address(0)`,
  Mine and Resonance owned by the launcher, and their pending owners equal to the passed deployed governance contract.
  After separate acceptance receipts, both owners equal governance and both pending owners are zero. The single-use
  launcher and four stateless component deployers have no callable continuing protocol action.
- Every component deployer's CREATE2 salt is caller-scoped as `keccak256(abi.encode(caller, contractDomain))`. An
  unrelated caller therefore cannot consume or shift the canonical launcher caller's component output addresses.

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
- The single-use canonical launcher is fixed to Robinhood Chain mainnet, the reviewed Uniswap V2 Factory, one
  six-decimal USDG, `1e6` raw USDG, and `1,000 ether` GBX. The seed creates exactly `31,622,776,601,683` raw LP supply,
  all held by `address(0)`; neither the launcher nor any other account receives genesis LP.
- The launcher always calls the pinned Factory to create a new Pair and verifies the exact Factory and USDG/GBX
  identities. It never adopts or skims an existing Pair. A preexisting Pair reverts the complete launch; a fresh
  launcher receives a different deterministic GBX and Pair from the modules' caller-scoped CREATE2 salts. Exact seed
  balances and LP output must still hold. Failure of any launch step reverts the complete protocol graph and token
  movement.
- Canonical bootstrap registers exactly two Strategies in order: GBX at initial and minimum `100,000 ether`, then the
  actual LP at initial and minimum `50 * pair.totalSupply()`. Both use 24-hour epochs and `1.2e18` multipliers.
- A Strategy's initial epoch begins at deployment and its live price may decay to zero. `minimumPrice` is the next
  epoch's starting minimum, not a fill-time floor; delayed first nonempty inventory may therefore be bought for zero.
- Only genesis LP is permanently locked. LP minted later follows the same Fund/Bribe split as every other Strategy
  payment token, and later LP held by ownerless Fund is an ordinary caller-selectable redemption asset.
- The continuing core has no liquidity-management custody, pricing, swap, harvest, or guarantee.
