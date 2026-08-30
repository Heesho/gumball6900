# Protocol specification

This is the authoritative target-development specification under ADRs 0031 and 0033-0055 in whole or in their
recorded unsuperseded parts. The current
development tree implements these decisions and reconciles their generated consumers. This remains unaudited local
engineering evidence, not deployment approval or authorization for user funds.

The required behavior is:

1. GBX starts with zero supply and zero lifetime minted when its constructor returns. Its setup minter cannot mint and
   permanently assigns the only lifetime mint authority to one immutable Mine only after the Mine identifies that same
   GBX. Mine may permanently disable genesis issuance with a zero `genesisAuthority`, or the canonical launcher may
   consume that authority once after binding to mint exactly `1,000 ether` GBX to a deployed pair. The successful mint
   clears the authority. `GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()`, while lifetime issuance
   additionally satisfies
   `GBX.lifetimeMinted() == Mine.totalMined() + (Mine.genesisLiquidityMinted() ? 1,000 ether : 0)`.
2. Mine has exactly sixteen hourly reverse-Dutch slots and no all-slot checkpoint. It is direct and non-upgradeable;
   its owner cannot change slot count, prices, tenure rates, emissions, GBX mint authority, claims, USDG, GBX, or Fund.
3. Each mining tenure has a fixed GBX TPS. Time-based halving boundaries and redemptions do not reprice an existing
   tenure; only a newly opened tenure receives current global TPS divided by sixteen.
4. A nonempty-slot replacement settles only that slot's accrual, makes 80% of the nominal USDG price claimable by the
   outgoing tenure miner, and transfers the 20% remainder into the current ResonanceRouter. An empty slot deposits 100%; there is no team
   fee. Mine uses `SafeERC20` under the standard canonical-USDG assumption without balance-delta enforcement, then
   ends without calling `route()`. Its `RevenueDeposited` event records the nominal deposit and receiving Router, while the later
   Router-to-Resonance action is permissionless and may be manual or automated without a role or bounty.
5. Global rates used for future tenures halve at immutable intervals measured from Mine deployment and continue at a positive
   immutable tail. GBX therefore has no protocol-defined economic maximum. It retains ERC-2612 permit but has no
   ERC20Votes checkpoints.
6. After reciprocal Resonance binding, SignalGBX accepts scalar `addSignal` and `removeSignal` plus optional
   `addSignalMany` and `removeSignalMany` arrays. Additions target registered live Strategies and atomically request GBX
   through `SafeERC20`, mint the same non-transferable ERC20Votes sGBX amount, and mirror every allocation into its
   paired Bribe. Removals work for live or killed Strategies, remove every named position, burn the same sGBX aggregate,
   and return the same GBX. Empty and zero-valued batches revert; duplicates execute sequentially; any failure reverts
   the complete transaction. Idle sGBX and standalone staking or unstaking do not exist. Canonical GBX transfers trust
   standard token semantics and do not inspect sender or receiver balance deltas. SignalGBX has no permit-consuming
   signal path, public move, shared write Router, ERC-2612 approval permit, or withdrawal lock. Smart accounts may
   atomically compose approval and direct SignalGBX calls.
7. Resonance uses one scalar seven-day USDG schedule. ResonanceRouter buffers until its balance is at least both
   `REWARD_DURATION` raw units and `remainingRevenue()`. A qualifying call checkpoints and restarts seven days using
   ordinary Synthetix leftover rollover. Rate, index, and Strategy floors, zero-active-signal emission, and direct
   donations are accepted Resonance surplus. The global revenue-per-signal index uses `1e36` precision, with cumulative
   fresh notifications capped at `floor(type(uint256).max / 1e36)` before checkpoint or token interaction.
   SignalGBX-coordinated changes checkpoint prior elapsed flow and Strategy purchases
   atomically pull released USDG. An irreversible Strategy kill preserves its pre-kill claim, excludes its complete
   weight from future revenue, blocks additions, and still permits existing signalers to exit. Resonance creates uniform
   acquisition Strategies through bound factories. Strategy snapshots the global `bribeBps` before payment-token
   interaction, transfers `floor(payment * bribeBps / 10,000)` to its BribeRouter, and transfers the complement
   directly to Fund. The rate defaults to 1,000 basis points, is owner-settable from 0 through 2,000, and has no
   per-Strategy override or cumulative split carry. BribeRouter only buffers and exposes permissionless `route()` into the paired
   Bribe. Bribes use Synthetix rollover and floor semantics with fixed token and lifetime caps. At 0%, new payments go
   entirely to Fund while signal additions, removals, existing rewards, and independent funding remain live.
8. Fund reads Mine's constant-time effective supply before every redemption denominator snapshot, then performs registry-free,
   caller-selected in-kind redemption atomically with the GBX burn.
9. The canonical GBX graph is created in one authorized, single-use launcher transaction on Robinhood Chain mainnet.
   Four predeployed stateless component deployers group constructor dependencies without retaining ownership or
   authority; they are size-bounded deployment infrastructure, not generic protocol factories. Each derives CREATE2
   salts from its direct caller and a contract-specific domain, preventing an unrelated public caller from consuming or
   shifting the launcher's canonical outputs. The launcher uses the pinned Uniswap V2 Factory
   `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` directly, creates a new pair, deposits exactly `1e6` raw
   six-decimal USDG and `1,000 ether` GBX, and mints the complete
   `31,622,776,601,683` raw genesis LP supply to `address(0)`. The recorded Router is not a launch dependency. The
   launcher never adopts or skims an existing Pair. A nonzero Factory lookup reverts with `PairAlreadyExists`, after which an
   unused launcher may be replaced so its caller-scoped CREATE2 outputs produce a different GBX and Pair.
   Predictable-address USDG prefunding of the launcher, Router, or Resonance cannot veto launch solely through a nonzero
   balance: launcher-held USDG is forwarded to Fund, while future Router and Resonance balances retain their ordinary
   buffer/direct-surplus semantics without changing schedule state. The deterministic future Pair is the exception:
   any prefunded USDG there makes the exact deposit invariant fail and denies that launcher. Any failure rolls back the
   complete protocol graph and token movement.
10. The same launcher transaction registers exactly two live Strategies in order: GBX at initial and next-epoch
    minimum `100,000 ether`, then the actual USDG/GBX LP at `50 * pair.totalSupply()` for both values. Each uses a
    24-hour epoch and `1.2e18` multiplier. `minimumPrice` resets the next epoch's starting price rather than imposing a
    fill-time floor, so the first nonempty inventory may be bought for zero if its first epoch reaches the full
    24-hour decay. Only genesis LP is permanently locked. LP minted later is an ordinary transferable Strategy payment
    token, and later LP held by Fund is an ordinary caller-selected redemption asset. The continuing core performs no
    liquidity management, pricing, swap, harvest, or guarantee.
11. The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. SignalGBX
    retains non-transferable ERC20Votes checkpoints on the block-number clock for a future external integration, but
    the core assigns them no proposal, quorum, delay, cancellation, or execution semantics. Mine and Resonance use
    `Ownable2Step` as the only continuing owners. Mine's only custom owner action is `setResonanceRouter`; Resonance
    retains `addStrategy`, `killStrategy`, `addBribeRewardToken`, and bounded global `setBribeBps`. Inherited ownership
    transfer requires acceptance by the pending owner; before acceptance, the current owner can replace or cancel that
    pending transfer, while renunciation remains immediate. Resonance's separate setup-only `setResonanceRouter` is
    consumed before handoff and cannot later replace or clear that binding. SignalGBX, StrategyFactory, and BribeFactory
    retain plain-`Ownable` setup shells after their one-time bindings, but no remaining custom owner action. A successful
    canonical launch renounces all three consumed setup shells and makes the passed
    deployed governance contract pending owner of Mine and Resonance. Governance must accept both before exposure. The
    production owner remains unselected, and deployment is blocked until a later ADR pins and reviews the exact external
    governance integration, two-step compatibility, and both handoff receipts. Fund remains ownerless. After the first
    Strategy is registered, `killStrategy` cannot remove the final live Strategy; a replacement must be added before the
    old Strategy is killed. No core contract is upgradeable.
12. Each Bribe has at most sixteen append-only reward tokens and uses a `1e36` reward-per-signal index. For each token, its
    monotonic lifetime accepted-notification total cannot exceed `floor(type(uint256).max / 1e36)` raw units and has no reset, setter, or escape hatch. The cap is
    checked before checkpointing or transfer; reaching it stops later notifications for only that token and Bribe, not
    claims or scalar/batched signal removal. Streams continue at zero `totalSignalWeight`; notifications are not queued; and rate,
    index, and account floors remain unallocated Bribe surplus rather than carry or Fund liabilities. Direct Bribe
    claims authorize only the beneficiary or that Bribe's immutable Resonance. Resonance exposes an optional
    caller-selected Strategy-array batch that always claims each canonical paired Bribe for `msg.sender`, including
    registered killed Strategies. Empty arrays and unregistered Strategies revert; duplicates execute sequentially;
    and the complete caller-controlled batch is atomic. Bribe retains an all-token claim plus an independent
    scalar-token claim, so a broken payout token can be isolated and does not block signal removal.
13. `SignalGBX.balanceOf(account)` is the canonical account aggregate signal, each paired Bribe owns canonical
    `signalWeightOf(account)` and `totalSignalWeight`, and Resonance owns only the active total across live Strategies.
    SignalGBX maintains no separate `allocatedBalance` duplicate. SignalGBX supply equals the sum of every paired
    Bribe's `totalSignalWeight` across live and killed Strategies, and its GBX escrow balance is at least that supply.
14. `Mine.setResonanceRouter(newRouter)` changes only future Mine revenue deposits and rejects the current Router. Before
    storing a candidate, Mine verifies that it reports Mine's immutable USDG, points to a deployed Resonance that
    reciprocally identifies the candidate Router, same USDG, and Mine's immutable Fund, and uses a SignalGBX that
    reciprocally identifies that Resonance and Mine's immutable GBX. Governance deploys and binds the complete new graph
    before switching Mine last. The setter never calls or moves state from the old graph. Existing old Router balances,
    Resonance schedules, Strategy claims, Bribe rewards, and user signal positions remain there; users claim and
    unsignal through the old graph before optionally signaling returned GBX into the new graph. Getter consistency does
    not authenticate replacement bytecode, and the switch cannot rescue an already broken old exit path. The
    replacement has a different SignalGBX address; Mine neither migrates voting checkpoints nor updates an external
    governance voting token.

Detailed mechanics are in [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), with risks in
[THREAT_MODEL.md](THREAT_MODEL.md).
