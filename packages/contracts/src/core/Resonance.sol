// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Bribe } from "./Bribe.sol";
import { BribeFactory } from "./BribeFactory.sol";
import { BribeRouter } from "./BribeRouter.sol";
import { Strategy } from "./Strategy.sol";
import { StrategyFactory } from "./StrategyFactory.sol";
import { IResonanceRouterIdentity } from "./interfaces/IResonanceRouter.sol";

/// @title GumBall6900 Signal-Directed Revenue Allocator
/// @author @heesho
/// @notice Streams USDG revenue to live Strategies in proportion to their SignalGBX weights.
/// @dev Uses one Synthetix-style seven-day stream and a global revenue-per-signal index. SignalGBX is the only caller
///      allowed to change weights, and each paired Bribe is the canonical ledger for a Strategy's account and total
///      weights. Weight changes checkpoint elapsed revenue before changing that ledger. Killing a Strategy checkpoints
///      and preserves its accrued claim, removes its complete weight from the active total, and permanently excludes it
///      from later revenue while allowing existing signal to exit. The canonical deployment assumes six-decimal USDG
///      and eighteen-decimal SignalGBX, so the cumulative index uses 1e36 precision; this contract accounts only in raw
///      units and does not read or enforce either token's decimals. USDG is assumed to be a standard, non-rebasing
///      ERC-20; transfers use SafeERC20 but do not verify sender or receiver balance deltas. Rate, index, and Strategy-
///      level divisions round down, and the resulting undistributed USDG remains in this contract as surplus.
contract Resonance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Stores the single global USDG streaming schedule and its cumulative allocation index.
    /// @param periodFinish Unix timestamp when the active stream stops accruing.
    /// @param revenueRate Whole raw USDG units emitted per second during the active stream.
    /// @param lastUpdateTime Unix timestamp through which `revenuePerSignalStored` has been checkpointed.
    /// @param revenuePerSignalStored Cumulative raw USDG allocation scaled by `REWARD_PRECISION` per raw signal unit.
    struct RevenueData {
        uint256 periodFinish;
        uint256 revenueRate;
        uint256 lastUpdateTime;
        uint256 revenuePerSignalStored;
    }

    /// @notice Fixed duration of every USDG revenue stream, in seconds.
    uint256 public constant REWARD_DURATION = 7 days;
    /// @notice Fixed-point precision used to allocate raw USDG units across raw SignalGBX units.
    uint256 public constant REWARD_PRECISION = 1e36;
    /// @notice Basis-point denominator used to split each Strategy payment between Fund and its paired BribeRouter.
    uint256 public constant BPS = 10_000;
    /// @notice Initial prospective Strategy-payment share assigned to the paired BribeRouter, in basis points.
    uint256 public constant DEFAULT_BRIBE_BPS = 1_000;
    /// @notice Maximum prospective Strategy-payment share assignable to a paired BribeRouter, in basis points.
    uint256 public constant MAX_BRIBE_BPS = 2_000;
    /// @notice Immutable non-transferable receipt and sole coordinator allowed to change Strategy signal weights.
    IERC20 public immutable signalGBX;
    /// @notice Immutable USDG revenue token streamed to Strategies and accounted for only in raw token units.
    IERC20 public immutable usdg;
    /// @notice Immutable treasury that receives the non-Bribe share of every Strategy payment.
    address public immutable fund;
    /// @notice Immutable Resonance-bound factory used to deploy one canonical Bribe per Strategy.
    BribeFactory public immutable bribeFactory;
    /// @notice Immutable Resonance-bound factory used to deploy Strategies and their paired BribeRouters.
    StrategyFactory public immutable strategyFactory;

    /// @notice Current global stream timestamps, whole-unit rate, and checkpointed revenue-per-signal index.
    RevenueData public revenueData;
    /// @notice Per-Strategy checkpoint of the scaled global revenue-per-signal index already incorporated into accrual.
    mapping(address strategy => uint256 paid) public strategyRevenuePerSignalPaid;
    /// @notice Stored whole raw USDG units accrued and not yet transferred to each registered Strategy.
    mapping(address strategy => uint256 revenue) public strategyRevenue;

    /// @notice Total raw SignalGBX weight across live Strategies currently eligible for Resonance revenue.
    uint256 public totalSignalWeight;
    /// @notice Number of registered Strategies that remain eligible for new signal and future Resonance revenue.
    uint256 public liveStrategyCount;

    /// @notice Whether an address was created and permanently registered as a Strategy by this Resonance.
    mapping(address strategy => bool registered) public isStrategyRegistered;
    /// @notice Whether a registered Strategy can receive new signal and accrue future Resonance revenue.
    mapping(address strategy => bool live) public isStrategyLive;
    /// @notice Canonical Bribe virtual-weight and reward contract paired with each registered Strategy.
    mapping(address strategy => address bribe) public bribeFor;
    /// @notice Bribe-only payment-token buffer paired with each registered Strategy.
    mapping(address strategy => address router) public bribeRouterFor;
    /// @notice Sole validated ResonanceRouter authorized to supply USDG and notify Resonance revenue; zero pre-bind.
    address public resonanceRouter;
    /// @notice Current prospective share of each Strategy payment sent to its BribeRouter, in basis points.
    uint256 public bribeBps = DEFAULT_BRIBE_BPS;

    /// @notice Emitted when governance changes the prospective automatic-Bribe share.
    /// @param previousBribeBps Prior global payment share in basis points.
    /// @param newBribeBps New global payment share in basis points, applied only to later purchases.
    event BribeBpsSet(uint256 previousBribeBps, uint256 newBribeBps);
    /// @notice Emitted when governance registers another independently fundable reward token on a paired Bribe.
    /// @param strategy Registered Strategy whose Bribe received the token.
    /// @param bribe Paired Bribe on which the token was registered.
    /// @param rewardToken ERC-20 reward token added to the Bribe's append-only registry.
    event BribeRewardTokenAdded(address indexed strategy, address indexed bribe, address indexed rewardToken);
    /// @notice Emitted when nonzero accrued USDG is transferred to its entitled Strategy.
    /// @param caller Account that permissionlessly triggered distribution.
    /// @param strategy Registered Strategy that received the USDG.
    /// @param amount Whole raw USDG units transferred.
    event RevenueDistributed(address indexed caller, address indexed strategy, uint256 amount);
    /// @notice Emitted when ResonanceRouter funds and restarts the global USDG stream.
    /// @param resonanceRouter Bound Router that supplied the tokens.
    /// @param amount Nominal raw USDG units pulled, excluding revenue carried forward from the prior schedule.
    event RevenueNotified(address indexed resonanceRouter, uint256 amount);
    /// @notice Emitted when the sole ResonanceRouter is permanently bound.
    /// @param resonanceRouter Router whose reciprocal Resonance and USDG identities were validated.
    event ResonanceRouterSet(address indexed resonanceRouter);
    /// @notice Emitted when SignalGBX adds weight for an account to a live Strategy.
    /// @param account SignalGBX holder whose paired-Bribe virtual balance increased.
    /// @param strategy Live Strategy whose aggregate signal weight increased.
    /// @param amount Raw SignalGBX units added.
    event SignalAdded(address indexed account, address indexed strategy, uint256 amount);
    /// @notice Emitted when SignalGBX removes weight for an account from a Strategy.
    /// @param account SignalGBX holder whose paired-Bribe virtual balance decreased.
    /// @param strategy Registered live or killed Strategy whose signal weight decreased.
    /// @param amount Raw SignalGBX units removed.
    event SignalRemoved(address indexed account, address indexed strategy, uint256 amount);
    /// @notice Emitted when governance atomically registers a new Strategy, Bribe, and BribeRouter graph.
    /// @param strategy Newly deployed and registered Strategy.
    /// @param bribe Newly deployed Bribe and canonical signal-weight ledger for the Strategy.
    /// @param bribeRouter Newly deployed buffer for the automatic payment-token Bribe share.
    /// @param paymentToken ERC-20 buyers must pay to fill the Strategy auction.
    event StrategyAdded(
        address indexed strategy, address indexed bribe, address indexed bribeRouter, address paymentToken
    );
    /// @notice Emitted when governance permanently kills a Strategy after checkpointing its accrued revenue.
    /// @param strategy Strategy excluded from new signal and all later Resonance revenue.
    event StrategyKilled(address indexed strategy);

    /// @notice Thrown when a requested automatic-Bribe share exceeds `MAX_BRIBE_BPS`.
    /// @param requested Requested share in basis points.
    error BribeBpsAboveMaximum(uint256 requested);
    /// @notice Thrown when a newly created Strategy address is already registered.
    /// @param strategy Duplicate Strategy address.
    error DuplicateStrategy(address strategy);
    /// @notice Thrown when killing a Strategy would remove the final live Strategy after protocol bootstrap.
    /// @param strategy Final live Strategy that governance attempted to kill.
    error FinalLiveStrategy(address strategy);
    /// @notice Thrown when governance attempts to use SignalGBX as a Strategy payment token.
    /// @param token Forbidden SignalGBX token address.
    error ForbiddenPaymentToken(address token);
    /// @notice Thrown when governance attempts to register SignalGBX as a Bribe reward token.
    /// @param token Forbidden SignalGBX token address.
    error ForbiddenRewardToken(address token);
    /// @notice Thrown when an account attempts to remove more signal than its paired-Bribe balance.
    /// @param strategy Strategy from which removal was requested.
    /// @param available Raw signal units currently recorded for the account in the paired Bribe.
    /// @param requested Raw signal units requested for removal.
    error InsufficientSignal(address strategy, uint256 available, uint256 requested);
    /// @notice Thrown when a proposed Router cannot prove this Resonance and USDG as its immutable endpoints.
    /// @param resonanceRouter Invalid Router candidate.
    error InvalidResonanceRouter(address resonanceRouter);
    /// @notice Thrown when the one-time ResonanceRouter binding has already completed.
    /// @param resonanceRouter Permanently bound Router.
    error ResonanceRouterAlreadySet(address resonanceRouter);
    /// @notice Thrown when newly notified revenue is smaller than the active schedule's remaining amount.
    /// @param amount Newly proposed raw USDG amount.
    /// @param remaining Raw USDG units still scheduled at the prior whole-unit rate.
    error RevenueBelowRemaining(uint256 amount, uint256 remaining);
    /// @notice Thrown when a killed Strategy is targeted by another kill or a signal addition.
    /// @param strategy Permanently killed Strategy.
    error StrategyAlreadyDead(address strategy);
    /// @notice Thrown when an operation requires a registered Strategy but receives an unknown address.
    /// @param strategy Unregistered address.
    error StrategyNotFound(address strategy);
    /// @notice Thrown when revenue notification does not originate from the bound ResonanceRouter.
    /// @param caller Unauthorized caller.
    error UnauthorizedRevenueSource(address caller);
    /// @notice Thrown when signal accounting does not originate from the immutable SignalGBX coordinator.
    /// @param caller Unauthorized caller.
    error UnauthorizedSignalSource(address caller);
    /// @notice Thrown when a required address is zero or a required deployed dependency has no code.
    error ZeroAddress();
    /// @notice Thrown when a signal delta or notified revenue amount is zero.
    error ZeroAmount();

    /// @dev Restricts revenue notifications to the sole Router stored in `resonanceRouter`.
    modifier onlyResonanceRouter() {
        if (msg.sender != resonanceRouter) revert UnauthorizedRevenueSource(msg.sender);
        _;
    }

    /// @dev Restricts signal-weight mutations to the immutable `signalGBX` coordinator.
    modifier onlySignalGBX() {
        if (msg.sender != address(signalGBX)) revert UnauthorizedSignalSource(msg.sender);
        _;
    }

    /// @notice Creates the allocator with immutable token, Fund, factory, and initial governance dependencies.
    /// @dev Every protocol dependency except `initialOwner` must be nonzero and have deployed code. OpenZeppelin
    ///      `Ownable` rejects a zero `initialOwner`. Factories and ResonanceRouter are reciprocally bound separately.
    /// @param signalGBX_ Non-transferable signal receipt and sole signal coordinator.
    /// @param usdg_ ERC-20 revenue token; canonical deployments use USDG with six decimals, which is not enforced.
    /// @param fund_ Treasury receiving the non-Bribe share of Strategy payments.
    /// @param bribeFactory_ Factory that deploys each Strategy's Bribe.
    /// @param strategyFactory_ Factory that deploys each Strategy and BribeRouter pair.
    /// @param initialOwner Deployment-time governance address for the bounded administration surface.
    constructor(
        IERC20 signalGBX_,
        IERC20 usdg_,
        address fund_,
        BribeFactory bribeFactory_,
        StrategyFactory strategyFactory_,
        address initialOwner
    ) Ownable(initialOwner) {
        if (
            address(signalGBX_) == address(0) || address(usdg_) == address(0) || fund_ == address(0)
                || address(bribeFactory_) == address(0) || address(strategyFactory_) == address(0)
                || address(signalGBX_).code.length == 0 || address(usdg_).code.length == 0 || fund_.code.length == 0
                || address(bribeFactory_).code.length == 0 || address(strategyFactory_).code.length == 0
        ) revert ZeroAddress();

        signalGBX = signalGBX_;
        usdg = usdg_;
        fund = fund_;
        bribeFactory = bribeFactory_;
        strategyFactory = strategyFactory_;
    }

    /// @notice Adds signal weight for an account to a live Strategy.
    /// @dev Callable only by the immutable SignalGBX coordinator. Elapsed revenue is checkpointed for the Strategy at
    ///      its prior weight before `totalSignalWeight` and the paired Bribe's canonical virtual balances increase.
    ///      Reverts for a zero account, zero amount, unregistered Strategy, or killed Strategy. Emits `SignalAdded`
    ///      after the paired Bribe emits `SignalWeightAdded`.
    /// @param account SignalGBX holder whose paired-Bribe weight increases.
    /// @param strategy Live registered Strategy receiving the weight.
    /// @param amount Raw SignalGBX units to add.
    function addSignalFor(address account, address strategy, uint256 amount) external nonReentrant onlySignalGBX {
        if (account == address(0)) revert ZeroAddress();
        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);
        if (!isStrategyLive[strategy]) revert StrategyAlreadyDead(strategy);
        if (amount == 0) revert ZeroAmount();

        _updateRevenue(strategy);

        totalSignalWeight += amount;
        Bribe(bribeFor[strategy]).addSignalWeight(account, amount);

        emit SignalAdded(account, strategy, amount);
    }

    /// @notice Removes signal weight for an account from a registered Strategy.
    /// @dev Callable only by the immutable SignalGBX coordinator. Elapsed revenue is checkpointed at the Strategy's
    ///      prior weight before the paired Bribe's canonical virtual balances decrease. Exits remain available after a
    ///      Strategy is killed; killed weight was removed from `totalSignalWeight` at kill time and is not subtracted a
    ///      second time. Reverts for a zero account or amount, an unregistered Strategy, or an amount exceeding the
    ///      account's weight in the paired Bribe. Emits `SignalRemoved` after the paired Bribe emits
    ///      `SignalWeightRemoved`.
    /// @param account SignalGBX holder whose paired-Bribe weight decreases.
    /// @param strategy Registered live or killed Strategy losing the weight.
    /// @param amount Raw SignalGBX units to remove.
    function removeSignalFor(address account, address strategy, uint256 amount) external nonReentrant onlySignalGBX {
        if (account == address(0)) revert ZeroAddress();
        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);
        if (amount == 0) revert ZeroAmount();

        Bribe bribe = Bribe(bribeFor[strategy]);
        uint256 allocated = bribe.signalWeightOf(account);
        if (amount > allocated) revert InsufficientSignal(strategy, allocated, amount);

        _updateRevenue(strategy);

        if (isStrategyLive[strategy]) totalSignalWeight -= amount;
        bribe.removeSignalWeight(account, amount);

        emit SignalRemoved(account, strategy, amount);
    }

    /// @notice Pulls newly routed USDG and restarts the global seven-day revenue stream.
    /// @dev Callable only by the permanently bound ResonanceRouter. First checkpoints global accrual through the prior
    ///      period's applicable timestamp. During an active period, `amount` must be at least `remainingRevenue()`; the
    ///      new schedule contains both the transferred amount and that previously scheduled remainder. Division by
    ///      `REWARD_DURATION` rounds the new per-second rate down, leaving any unscheduled raw-unit remainder as
    ///      contract surplus. The standard Router additionally requires at least `REWARD_DURATION` raw units so this
    ///      rate is nonzero. USDG balance deltas are not measured; the schedule uses the nominal `amount` under the
    ///      standard-token assumption. Reverts for zero, insufficient active-period revenue, or a failed USDG transfer.
    ///      Emits `RevenueNotified` after the new schedule is stored.
    /// @param amount Newly supplied raw USDG units to pull from ResonanceRouter, excluding the prior remainder.
    function notifyRevenue(uint256 amount) external nonReentrant onlyResonanceRouter {
        _updateRevenue(address(0));
        if (amount == 0) revert ZeroAmount();

        uint256 remaining = remainingRevenue();
        if (amount < remaining) revert RevenueBelowRemaining(amount, remaining);

        usdg.safeTransferFrom(msg.sender, address(this), amount);

        RevenueData storage data = revenueData;
        data.revenueRate = (amount + remaining) / REWARD_DURATION;
        data.lastUpdateTime = block.timestamp;
        data.periodFinish = block.timestamp + REWARD_DURATION;

        emit RevenueNotified(msg.sender, amount);
    }

    /// @notice Checkpoints and transfers one registered Strategy's accrued USDG to that Strategy.
    /// @dev Permissionless, including for killed Strategies with preserved accrual. Returns zero and emits no event
    ///      when nothing is owed. The Strategy-level index conversion rounds down to whole raw USDG units. A failed
    ///      USDG transfer reverts the checkpoint and claim reset atomically. A successful nonzero transfer emits
    ///      `RevenueDistributed`.
    /// @param strategy Registered Strategy whose fixed address receives the transfer.
    /// @return amount Whole raw USDG units transferred, or zero when no revenue is accrued.
    function distributeRevenue(address strategy) external nonReentrant returns (uint256 amount) {
        _updateRevenue(strategy);
        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);

        amount = strategyRevenue[strategy];
        if (amount == 0) return 0;

        strategyRevenue[strategy] = 0;
        usdg.safeTransfer(strategy, amount);

        emit RevenueDistributed(msg.sender, strategy, amount);
    }

    /// @notice Permanently binds the sole ResonanceRouter allowed to notify USDG revenue.
    /// @dev Callable only by the current owner and only before a Router is bound. The candidate must be a deployed
    ///      contract whose identity getters return this Resonance and the immutable `usdg`; missing or reverting
    ///      identity getters fail validation. The binding cannot be replaced or cleared. Emits `ResonanceRouterSet`.
    /// @param resonanceRouter_ Router candidate to validate and bind.
    function setResonanceRouter(address resonanceRouter_) external onlyOwner {
        if (resonanceRouter != address(0)) revert ResonanceRouterAlreadySet(resonanceRouter);
        if (resonanceRouter_ == address(0) || resonanceRouter_.code.length == 0) revert ZeroAddress();
        IResonanceRouterIdentity router = IResonanceRouterIdentity(resonanceRouter_);
        try router.resonance() returns (address configuredResonance) {
            if (configuredResonance != address(this)) revert InvalidResonanceRouter(resonanceRouter_);
        } catch {
            revert InvalidResonanceRouter(resonanceRouter_);
        }
        try router.usdg() returns (address configuredUSDG) {
            if (configuredUSDG != address(usdg)) revert InvalidResonanceRouter(resonanceRouter_);
        } catch {
            revert InvalidResonanceRouter(resonanceRouter_);
        }

        resonanceRouter = resonanceRouter_;
        emit ResonanceRouterSet(resonanceRouter_);
    }

    /// @notice Sets the prospective paired-Bribe share for every later Strategy purchase.
    /// @dev Callable only by the current owner. Values from zero through `MAX_BRIBE_BPS` are accepted. Each Strategy
    ///      snapshots this value before token interaction, so earlier and in-flight purchases and active Bribe reward
    ///      streams are not repriced. Emits `BribeBpsSet`, including when `newBribeBps` equals the current value.
    /// @param newBribeBps New global share in basis points, from zero through `MAX_BRIBE_BPS`.
    function setBribeBps(uint256 newBribeBps) external onlyOwner {
        if (newBribeBps > MAX_BRIBE_BPS) revert BribeBpsAboveMaximum(newBribeBps);

        uint256 previousBps = bribeBps;
        bribeBps = newBribeBps;

        emit BribeBpsSet(previousBps, newBribeBps);
    }

    /// @notice Creates and registers a Strategy, its canonical Bribe, and its BribeRouter as one atomic graph.
    /// @dev Callable only by the current owner. `paymentToken` must be a deployed ERC-20-like contract and cannot be
    ///      SignalGBX. The payment token is registered as the paired Bribe's first reward token. The new Strategy's
    ///      revenue checkpoint starts at the stored global index; its zero initial signal weight prevents it from
    ///      claiming historical revenue. Factory or constructor validation failures revert the complete graph creation.
    ///      Factory and paired-Bribe creation events precede the final `StrategyAdded` event.
    /// @param paymentToken ERC-20 asset buyers must pay to fill the new Strategy and its automatic Bribe reward token.
    /// @param config Immutable reverse-Dutch-auction configuration for the new Strategy.
    /// @return strategyAddress Newly deployed and registered Strategy.
    /// @return bribeAddress Newly deployed Bribe and canonical signal-weight ledger for the Strategy.
    /// @return bribeRouterAddress Newly deployed buffer for the Strategy's automatic Bribe share.
    function addStrategy(IERC20 paymentToken, Strategy.Config calldata config)
        external
        nonReentrant
        onlyOwner
        returns (address strategyAddress, address bribeAddress, address bribeRouterAddress)
    {
        if (address(paymentToken) == address(0) || address(paymentToken).code.length == 0) {
            revert ZeroAddress();
        }
        if (address(paymentToken) == address(signalGBX)) revert ForbiddenPaymentToken(address(paymentToken));

        Bribe bribe = bribeFactory.createBribe();
        bribe.addRewardToken(address(paymentToken));

        (Strategy strategy, BribeRouter bribeRouter) =
            strategyFactory.createStrategy(usdg, paymentToken, fund, bribe, config);

        strategyAddress = address(strategy);
        bribeAddress = address(bribe);
        bribeRouterAddress = address(bribeRouter);
        if (isStrategyRegistered[strategyAddress]) revert DuplicateStrategy(strategyAddress);

        isStrategyRegistered[strategyAddress] = true;
        isStrategyLive[strategyAddress] = true;
        ++liveStrategyCount;
        bribeFor[strategyAddress] = bribeAddress;
        bribeRouterFor[strategyAddress] = bribeRouterAddress;
        strategyRevenuePerSignalPaid[strategyAddress] = revenueData.revenuePerSignalStored;

        emit StrategyAdded(strategyAddress, bribeAddress, bribeRouterAddress, address(paymentToken));
    }

    /// @notice Permanently stops a registered Strategy from receiving new signal or future Resonance revenue.
    /// @dev Callable only by the current owner. Checkpoints the Strategy under its full prior weight, preserves that
    ///      accrued USDG for later permissionless distribution, marks the Strategy dead, and removes its complete
    ///      paired-Bribe weight from the active total. Existing signal and Bribe rewards remain recorded and removable.
    ///      After the first Strategy is registered, the final live Strategy cannot be killed. Emits `StrategyKilled`.
    /// @param strategy Live registered Strategy to kill irreversibly.
    function killStrategy(address strategy) external nonReentrant onlyOwner {
        _updateRevenue(strategy);
        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);
        if (!isStrategyLive[strategy]) revert StrategyAlreadyDead(strategy);
        if (liveStrategyCount == 1) revert FinalLiveStrategy(strategy);

        isStrategyLive[strategy] = false;
        --liveStrategyCount;
        totalSignalWeight -= _strategySignalWeight(strategy);

        emit StrategyKilled(strategy);
    }

    /// @notice Registers an additional independently funded reward token on a registered Strategy's Bribe.
    /// @dev Callable only by the current owner. The Strategy may be live or killed. The reward token must be a deployed
    ///      contract and cannot be SignalGBX. The paired Bribe enforces its append-only sixteen-token registry,
    ///      duplicate-token rejection, and all later notification rules. The Bribe's `RewardTokenAdded` event precedes
    ///      `BribeRewardTokenAdded`.
    /// @param strategy Registered Strategy whose paired Bribe receives the token.
    /// @param rewardToken ERC-20 token to add to the paired Bribe's reward registry.
    function addBribeRewardToken(address strategy, address rewardToken) external onlyOwner {
        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);
        if (rewardToken == address(0) || rewardToken.code.length == 0) revert ZeroAddress();
        if (rewardToken == address(signalGBX)) revert ForbiddenRewardToken(rewardToken);

        address bribe = bribeFor[strategy];
        Bribe(bribe).addRewardToken(rewardToken);

        emit BribeRewardTokenAdded(strategy, bribe, rewardToken);
    }

    /// @notice Returns the current cumulative USDG allocation per raw unit of active SignalGBX weight.
    /// @dev Includes elapsed time through the earlier of the current timestamp and `periodFinish` without mutating
    ///      storage. If active weight is zero, the index does not increase and revenue elapsed during that interval is
    ///      unallocated surplus. The index increment rounds down at `REWARD_PRECISION`.
    /// @return accumulatedRevenue Cumulative raw USDG units multiplied by `REWARD_PRECISION` per raw signal unit.
    function revenuePerSignal() public view returns (uint256 accumulatedRevenue) {
        RevenueData storage data = revenueData;
        accumulatedRevenue = data.revenuePerSignalStored;
        if (totalSignalWeight == 0) return accumulatedRevenue;

        uint256 applicable = _lastApplicableRevenueTime();
        uint256 lastUpdate = data.lastUpdateTime;
        if (applicable <= lastUpdate) return accumulatedRevenue;

        uint256 emitted = (applicable - lastUpdate) * data.revenueRate;
        return accumulatedRevenue + Math.mulDiv(emitted, REWARD_PRECISION, totalSignalWeight);
    }

    /// @notice Returns one Strategy's stored plus currently elapsed USDG entitlement.
    /// @dev Does not mutate checkpoints. Only a live Strategy's canonical paired-Bribe weight participates in elapsed
    ///      allocation; a killed Strategy returns only the revenue preserved when it was checkpointed. Conversion from
    ///      the scaled index rounds down to whole raw USDG units.
    /// @param strategy Strategy whose entitlement is queried.
    /// @return revenue Whole raw USDG units currently transferable to the Strategy.
    function earnedRevenue(address strategy) external view returns (uint256 revenue) {
        uint256 delta = revenuePerSignal() - strategyRevenuePerSignalPaid[strategy];
        uint256 activeBalance = isStrategyLive[strategy] ? _strategySignalWeight(strategy) : 0;
        return strategyRevenue[strategy] + Math.mulDiv(activeBalance, delta, REWARD_PRECISION);
    }

    /// @notice Returns the USDG still scheduled at the active stream's stored whole-unit rate.
    /// @dev Returns zero at or after `periodFinish`. This excludes already elapsed Strategy entitlements, notification
    ///      remainders lost to rate flooring, zero-weight emissions, and direct token donations.
    /// @return amount Whole raw USDG units scheduled between the current timestamp and `periodFinish`.
    function remainingRevenue() public view returns (uint256 amount) {
        RevenueData storage data = revenueData;
        if (block.timestamp >= data.periodFinish) return 0;
        return (data.periodFinish - block.timestamp) * data.revenueRate;
    }

    /// @dev Checkpoints the global index and optionally one Strategy before a weight or revenue state transition. The
    ///      zero address updates only global schedule state. For a nonzero live Strategy, accrual uses its paired
    ///      Bribe's weight before the caller changes it; killed Strategies preserve stored revenue without later
    ///      accrual. Both global-index and Strategy-entitlement conversions round down.
    /// @param strategy Strategy to checkpoint, or the zero address to checkpoint only the global stream.
    function _updateRevenue(address strategy) private {
        RevenueData storage data = revenueData;
        uint256 currentRevenuePerSignal = revenuePerSignal();

        data.revenuePerSignalStored = currentRevenuePerSignal;
        data.lastUpdateTime = _lastApplicableRevenueTime();

        if (strategy != address(0)) {
            uint256 revenueDelta = currentRevenuePerSignal - strategyRevenuePerSignalPaid[strategy];
            uint256 activeBalance = isStrategyLive[strategy] ? _strategySignalWeight(strategy) : 0;
            strategyRevenue[strategy] += Math.mulDiv(activeBalance, revenueDelta, REWARD_PRECISION);
            strategyRevenuePerSignalPaid[strategy] = currentRevenuePerSignal;
        }
    }

    /// @dev Reads a Strategy's canonical aggregate raw signal weight from its paired Bribe. Returns zero when no Bribe
    ///      has been registered for the supplied address.
    /// @param strategy Strategy whose paired-Bribe weight is queried.
    /// @return amount Aggregate raw SignalGBX units recorded by the paired Bribe.
    function _strategySignalWeight(address strategy) private view returns (uint256 amount) {
        address bribe = bribeFor[strategy];
        if (bribe == address(0)) return 0;
        return Bribe(bribe).totalSignalWeight();
    }

    /// @dev Caps revenue accrual at the current stream's finish timestamp.
    /// @return timestamp Earlier of the current block timestamp and `revenueData.periodFinish`.
    function _lastApplicableRevenueTime() private view returns (uint256 timestamp) {
        uint256 finish = revenueData.periodFinish;
        return block.timestamp < finish ? block.timestamp : finish;
    }
}
