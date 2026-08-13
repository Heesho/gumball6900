// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Bribe } from "./Bribe.sol";
import { BribeFactory } from "./BribeFactory.sol";
import { BribeRouter } from "./BribeRouter.sol";
import { Strategy } from "./Strategy.sol";
import { StrategyFactory } from "./StrategyFactory.sol";
import { IResonanceRouterIdentity } from "./interfaces/IResonanceIdentity.sol";

/// @title GumBall6900 Signal-Directed Revenue Allocator
/// @author Heesho
/// @notice Streams USDG to Strategies according to live SignalGBX allocations and accounts for independent Bribes.
/// @dev Adapted from Liquid Signal Governance. Revenue is released lazily through an exact active seven-day stream and
///      one aggregate queued successor. Every signal mutation first checkpoints elapsed revenue at the prior weights.
///      Scaled carry preserves every received USDG unit without a global Strategy loop, while fixed-destination Fund
///      liabilities keep signal exits independent of transfers.
/// @custom:version 1.0.0
contract Resonance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Fixed-point precision for indexed USDG revenue.
    uint256 public constant INDEX_PRECISION = 1e36;
    /// @notice Exact duration of each USDG revenue period.
    uint256 public constant REVENUE_STREAM_DURATION = 7 days;
    /// @notice Non-transferable staking receipt used as current signal power.
    IERC20 public immutable signalGBX;
    /// @notice Revenue token distributed among Strategies.
    IERC20 public immutable usdg;
    /// @notice Treasury that receives zero-weight and disabled-Strategy revenue.
    address public immutable fund;
    /// @notice Factory used to create one Bribe per Strategy.
    BribeFactory public immutable bribeFactory;
    /// @notice Factory used to create Strategies and their BribeRouters.
    StrategyFactory public immutable strategyFactory;

    /// @notice Sole router authorized to notify USDG revenue.
    address public resonanceRouter;
    /// @notice Total SignalGBX weight currently allocated across all Strategies.
    uint256 public totalSignalWeight;
    /// @notice Cumulative USDG revenue per unit of signal weight.
    uint256 public revenueIndex;
    /// @notice Received USDG represented in revenue precision but not yet large enough for another index increment.
    uint256 public pendingRevenueScaled;
    /// @notice Revenue precision already added to the global index but not yet checkpointed by Strategies.
    uint256 public indexedRevenueScaled;
    /// @notice Sum of whole-token live-Strategy liabilities represented by `claimableRevenue`.
    uint256 public totalClaimableRevenue;
    /// @notice Whole USDG units irrevocably owed to the immutable Fund and payable by any caller.
    uint256 public fundRevenueLiability;
    /// @notice Exact supported-token balance pulled or synchronized minus completed Strategy and Fund payouts.
    uint256 public accountedRevenueBalance;

    address[] private _strategies;
    /// @notice Bribe associated with each Strategy.
    mapping(address strategy => address bribe) public bribeFor;
    /// @notice BribeRouter associated with each Strategy.
    mapping(address strategy => address router) public bribeRouterFor;
    /// @notice Payment token required by each Strategy.
    mapping(address strategy => address paymentToken) public paymentTokenFor;
    /// @notice Total SignalGBX weight allocated to each Strategy.
    mapping(address strategy => uint256 signalWeight) public strategySignalWeight;
    /// @notice Whether an address is a Resonance-created Strategy.
    mapping(address strategy => bool isValid) public isStrategy;
    /// @notice Whether a Strategy remains eligible for future USDG.
    mapping(address strategy => bool isAlive) public isStrategyAlive;
    /// @notice Global revenue index last accounted for each Strategy.
    mapping(address strategy => uint256 index) public strategyRevenueIndex;
    /// @notice Indexed USDG available to distribute to each Strategy.
    mapping(address strategy => uint256 amount) public claimableRevenue;
    /// @notice Sub-USDG precision retained for each Strategy across checkpoints instead of being rounded away.
    mapping(address strategy => uint256 scaledRemainder) public strategyRevenueRemainder;

    /// @notice Signal weight an account assigned to a Strategy.
    mapping(address account => mapping(address strategy => uint256 signals)) public accountSignals;
    mapping(address account => address[] strategies) private _accountStrategies;
    mapping(address account => mapping(address strategy => uint256 indexPlusOne)) private _accountStrategyIndex;
    /// @notice Total signal weight currently allocated by an account.
    mapping(address account => uint256 signalWeight) public accountSignalWeight;

    // Appended after the account mappings to preserve their pinned storage slots in deployment tooling and tests.
    /// @notice Current USDG release rate, expressed as scaled USDG units per second.
    uint256 public revenueStreamRateScaled;
    /// @notice Scaled USDG received but not yet released into signal-weight accounting.
    uint256 public revenueStreamRemainingScaled;
    /// @notice Timestamp through which the current stream has been checkpointed.
    uint256 public revenueStreamLastUpdate;
    /// @notice Timestamp by which the current scheduled balance will be fully released.
    uint256 public revenueStreamFinish;
    /// @notice Exclusive timestamp through which the active stream emits one scaled unit above its base rate.
    uint256 public revenueStreamRemainderFinish;
    /// @notice Whole USDG notifications aggregated behind the active stream.
    uint256 public queuedRevenue;
    /// @notice Sub-USDG precision irrevocably assigned to Fund when an allocation boundary cannot retain it safely.
    uint256 public fundRevenueRemainderScaled;

    /// @notice Emitted when governance registers another reward token on a Strategy's Bribe.
    /// @param strategy Strategy whose Bribe was updated.
    /// @param bribe Bribe that accepted the reward token.
    /// @param rewardToken Newly registered token.
    event BribeRewardAdded(address indexed strategy, address indexed bribe, address indexed rewardToken);
    /// @notice Emitted when indexed USDG is transferred to a Strategy.
    /// @param caller Account that triggered distribution.
    /// @param strategy Strategy that received USDG.
    /// @param amount Amount distributed.
    event RevenueDistributed(address indexed caller, address indexed strategy, uint256 amount);
    /// @notice Emitted when ResonanceRouter supplies newly routed USDG for streaming.
    /// @param resonanceRouter Authorized router that supplied USDG.
    /// @param amount Amount received and scheduled.
    event RevenueNotified(address indexed resonanceRouter, uint256 amount);
    /// @notice Emitted when direct USDG already held by Resonance is incorporated into protocol accounting.
    /// @param caller Account that triggered synchronization.
    /// @param amount Previously unaccounted USDG incorporated.
    event RevenueSynced(address indexed caller, uint256 amount);
    /// @notice Emitted when elapsed stream revenue enters signal-weight accounting.
    /// @param releasedScaled Revenue released, expressed in `INDEX_PRECISION`.
    /// @param remainingScaled Revenue still scheduled, expressed in `INDEX_PRECISION`.
    event RevenueStreamCheckpointed(uint256 releasedScaled, uint256 remainingScaled);
    /// @notice Emitted whenever an exact seven-day revenue stream begins.
    /// @param amount Whole USDG units assigned to the stream.
    /// @param amountScaled Exact scaled USDG units assigned to the stream.
    /// @param startedAt Inclusive stream start.
    /// @param finish Timestamp at which the period completes.
    /// @param rateScaled Base release rate expressed as scaled USDG units per second.
    /// @param rateRemainder Number of initial stream seconds that emit one additional scaled unit.
    event RevenueStreamScheduled(
        uint256 amount,
        uint256 amountScaled,
        uint256 startedAt,
        uint256 finish,
        uint256 rateScaled,
        uint256 rateRemainder
    );
    /// @notice Emitted when a notification aggregates behind the active stream without changing it.
    /// @param amount Newly queued whole USDG units.
    /// @param totalQueued Complete queued successor amount.
    event RevenueQueued(uint256 amount, uint256 totalQueued);
    /// @notice Emitted when otherwise unassignable scaled allocation carry is irrevocably assigned to Fund.
    /// @param amountScaled Scaled carry assigned by this operation.
    /// @param remainderScaled Complete sub-USDG Fund remainder afterward.
    event RevenueCarryFunded(uint256 amountScaled, uint256 remainderScaled);
    /// @notice Emitted when whole-token revenue becomes irrevocably payable to Fund.
    /// @param amount Newly accrued Fund entitlement.
    /// @param totalLiability Complete Fund entitlement after accrual.
    event FundRevenueAccrued(uint256 amount, uint256 totalLiability);
    /// @notice Emitted after a permissionless caller pays the complete fixed-destination Fund entitlement.
    /// @param caller Account that triggered payment.
    /// @param fund Immutable Fund that received USDG.
    /// @param amount Amount paid.
    event FundRevenuePaid(address indexed caller, address indexed fund, uint256 amount);
    /// @notice Emitted when governance creates a complete Strategy reward graph.
    /// @param strategy Newly deployed Strategy.
    /// @param bribe Bribe paired with the Strategy.
    /// @param bribeRouter Router paired with the Strategy and Bribe.
    /// @param paymentToken Asset accepted by the Strategy.
    event StrategyAdded(
        address indexed strategy, address indexed bribe, address indexed bribeRouter, address paymentToken
    );
    /// @notice Emitted when governance permanently stops future revenue for a Strategy.
    /// @param strategy Strategy that was killed.
    event StrategyKilled(address indexed strategy);
    /// @notice Emitted when an account incrementally adds signal weight to a Strategy.
    /// @param account Signal account.
    /// @param strategy Strategy receiving the weight.
    /// @param amount Absolute SignalGBX amount added to the existing signal.
    event SignalAdded(address indexed account, address indexed strategy, uint256 amount);
    /// @notice Emitted when an account incrementally removes signal weight from a Strategy.
    /// @param account Signal account.
    /// @param strategy Strategy losing the weight.
    /// @param amount Absolute SignalGBX amount removed from the existing signal.
    event SignalRemoved(address indexed account, address indexed strategy, uint256 amount);
    /// @notice Emitted when the sole USDG revenue router is bound.
    /// @param resonanceRouter Bound ResonanceRouter address.
    event ResonanceRouterSet(address indexed resonanceRouter);

    /// @notice Governance attempted to register an existing Strategy twice.
    error DuplicateStrategy(address strategy);
    /// @notice Governance selected a protocol token that cannot support Strategy payment transfers.
    error ForbiddenPaymentToken(address token);
    /// @notice Governance selected a protocol token that cannot support Bribe reward transfers.
    error ForbiddenRewardToken(address token);
    /// @notice A signal removal exceeds the account's allocation to one Strategy.
    error InsufficientSignal(address strategy, uint256 available, uint256 requested);
    /// @notice A signal addition exceeds the account's unallocated SignalGBX balance.
    error InsufficientUnallocatedSignal(uint256 available, uint256 requested);
    /// @notice Routed USDG did not credit Resonance by the exact requested amount.
    error InexactRevenueTransfer(uint256 expected, uint256 received);
    /// @notice A USDG payout did not produce the exact Resonance debit and receiver credit.
    error InexactRevenuePayout(address receiver, uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    /// @notice Parallel Strategy and amount arrays have different lengths.
    error LengthMismatch();
    /// @notice Governance attempted to kill an already-dead Strategy.
    error StrategyAlreadyDead(address strategy);
    /// @notice A requested address is not a registered Strategy.
    error StrategyNotFound(address strategy);
    /// @notice The one-time ResonanceRouter binding has already completed.
    error ResonanceRouterAlreadySet(address resonanceRouter);
    /// @notice A candidate router does not point back to this Resonance and its immutable USDG token.
    error InvalidResonanceRouter(address resonanceRouter);
    /// @notice An account other than the permanently bound router tried to notify revenue.
    error UnauthorizedRevenueSource(address caller);
    /// @notice The USDG balance is below the amount already classified by accounting.
    error RevenueBalanceDeficit(uint256 accounted, uint256 actual);
    /// @notice Scaling an observed USDG balance would overflow internal accounting precision.
    error RevenueScaleOverflow(uint256 balance);
    /// @notice A required deployment or binding address is zero.
    error ZeroAddress();
    /// @notice A requested signal or revenue amount is zero.
    error ZeroAmount();

    /// @notice Creates the allocation system with immutable token, Fund, and factory dependencies.
    /// @param signalGBX_ Non-transferable staking receipt used as signal power.
    /// @param usdg_ Revenue token allocated among Strategies.
    /// @param fund_ Treasury receiving unallocated or disabled-Strategy revenue.
    /// @param bribeFactory_ Factory used to deploy one Bribe per Strategy.
    /// @param strategyFactory_ Factory used to deploy Strategies and BribeRouters.
    /// @param initialOwner Typed timelock authorized to administer the system.
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

    /// @notice Adds an absolute SignalGBX amount to the caller's existing signal for one Strategy.
    /// @dev `amount` is a delta, not a target: repeated calls increase rather than replace the existing allocation.
    /// @param strategy Strategy whose signal should increase.
    /// @param amount Absolute SignalGBX amount to add to the existing signal.
    function addSignal(address strategy, uint256 amount) external nonReentrant {
        _addSignal(msg.sender, strategy, amount);
    }

    /// @notice Removes an absolute SignalGBX amount from the caller's existing signal for one Strategy.
    /// @dev `amount` is a delta, not a target. Removal remains available after a Strategy is killed.
    /// @param strategy Strategy whose signal should decrease.
    /// @param amount Absolute SignalGBX amount to remove from the existing signal.
    function removeSignal(address strategy, uint256 amount) external nonReentrant {
        _removeSignal(msg.sender, strategy, amount);
    }

    /// @notice Adds absolute SignalGBX amounts to the caller's existing signals for several Strategies.
    /// @dev Every amount is a delta, not a target. The caller controls the batch size, so no unbounded batch is forced.
    /// @param requestedStrategies Strategies whose signals should increase.
    /// @param amounts Absolute SignalGBX amounts to add to the corresponding existing signals.
    function addSignalMany(address[] calldata requestedStrategies, uint256[] calldata amounts) external nonReentrant {
        if (requestedStrategies.length != amounts.length) revert LengthMismatch();

        uint256 strategyCount = requestedStrategies.length;
        for (uint256 i; i < strategyCount; ++i) {
            _addSignal(msg.sender, requestedStrategies[i], amounts[i]);
        }
    }

    /// @notice Removes absolute SignalGBX amounts from the caller's existing signals for several Strategies.
    /// @dev Every amount is a delta, not a target. The caller controls the batch size, so no unbounded batch is forced.
    /// @param requestedStrategies Strategies whose signals should decrease.
    /// @param amounts Absolute SignalGBX amounts to remove from the corresponding existing signals.
    function removeSignalMany(address[] calldata requestedStrategies, uint256[] calldata amounts)
        external
        nonReentrant
    {
        if (requestedStrategies.length != amounts.length) revert LengthMismatch();

        uint256 strategyCount = requestedStrategies.length;
        for (uint256 i; i < strategyCount; ++i) {
            _removeSignal(msg.sender, requestedStrategies[i], amounts[i]);
        }
    }

    /// @notice Claims rewards from the Bribes associated with `strategies` for the caller.
    /// @param requestedStrategies Strategies whose Bribes should pay the caller.
    function claimRewards(address[] calldata requestedStrategies) external {
        uint256 strategyCount = requestedStrategies.length;
        for (uint256 i; i < strategyCount; ++i) {
            address strategy = requestedStrategies[i];
            if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
            Bribe(bribeFor[strategy]).claimRewards(msg.sender);
        }
    }

    /// @notice Pulls USDG from ResonanceRouter and starts a stream or aggregates one queued successor.
    /// @dev The active stream is checkpointed before the pull and is never reset or extended by a live top-up.
    /// @param amount Amount of USDG to pull and schedule.
    function notifyRevenue(uint256 amount) external nonReentrant {
        if (msg.sender != resonanceRouter) revert UnauthorizedRevenueSource(msg.sender);
        if (amount == 0) revert ZeroAmount();

        _checkpointRevenue();

        uint256 balanceBefore = usdg.balanceOf(address(this));
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdg.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert InexactRevenueTransfer(amount, received);

        accountedRevenueBalance += amount;
        _requireScalableBalance();
        _scheduleRevenue(amount);

        emit RevenueNotified(msg.sender, amount);
    }

    /// @notice Incorporates direct USDG donations into the active stream or its aggregate successor.
    /// @dev A negative balance delta is unsupported and fails visibly instead of corrupting stored liabilities.
    /// @return amount Newly synchronized USDG.
    function syncRevenue() external nonReentrant returns (uint256 amount) {
        uint256 actualBalance = usdg.balanceOf(address(this));
        uint256 accounted = accountedRevenueBalance;
        if (actualBalance < accounted) revert RevenueBalanceDeficit(accounted, actualBalance);

        uint256 candidate = actualBalance - accounted;
        if (candidate == 0) return 0;
        amount = candidate;

        _checkpointRevenue();
        accountedRevenueBalance = actualBalance;
        _requireScalableBalance();
        _scheduleRevenue(amount);

        emit RevenueSynced(msg.sender, amount);
    }

    /// @notice Attempts to convert carried scaled revenue into another global index increment.
    /// @dev Permissionless progress lets carried revenue become reachable without waiting for another notification.
    /// @return indexDelta Increment added to `revenueIndex`, or zero while scaled carry is below one index step.
    function indexPendingRevenue() external returns (uint256 indexDelta) {
        indexDelta = _checkpointRevenue();
    }

    /// @notice Distributes currently claimable revenue to every Strategy.
    function distributeAll() external {
        distributeRange(0, _strategies.length);
    }

    /// @notice Updates one Strategy's stored revenue without transferring it.
    /// @param strategy Strategy whose index checkpoint should advance.
    function updateStrategy(address strategy) external {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        _checkpointRevenue();
        _updateStrategy(strategy);
    }

    /// @notice Binds the sole ResonanceRouter after reciprocal Resonance and USDG identity validation.
    /// @param resonanceRouter_ ResonanceRouter address to bind permanently.
    function setResonanceRouter(address resonanceRouter_) external onlyOwner {
        if (resonanceRouter != address(0)) revert ResonanceRouterAlreadySet(resonanceRouter);
        if (resonanceRouter_ == address(0) || resonanceRouter_.code.length == 0) revert ZeroAddress();
        try IResonanceRouterIdentity(resonanceRouter_).resonance() returns (address configuredResonance) {
            if (configuredResonance != address(this)) revert InvalidResonanceRouter(resonanceRouter_);
        } catch {
            revert InvalidResonanceRouter(resonanceRouter_);
        }
        try IResonanceRouterIdentity(resonanceRouter_).usdg() returns (address configuredUSDG) {
            if (configuredUSDG != address(usdg)) revert InvalidResonanceRouter(resonanceRouter_);
        } catch {
            revert InvalidResonanceRouter(resonanceRouter_);
        }

        resonanceRouter = resonanceRouter_;

        emit ResonanceRouterSet(resonanceRouter_);
    }

    /// @notice Creates a Strategy, its Bribe, and its BribeRouter as one Resonance-controlled graph.
    /// @param paymentToken Asset buyers pay to fill the Strategy.
    /// @param config Immutable auction configuration.
    /// @return strategyAddress Newly deployed Strategy.
    /// @return bribeAddress Bribe paired with the Strategy.
    /// @return bribeRouterAddress BribeRouter paired with the Strategy and Bribe.
    function addStrategy(IERC20 paymentToken, Strategy.Config calldata config)
        external
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

        if (isStrategy[strategyAddress]) revert DuplicateStrategy(strategyAddress);

        _strategies.push(strategyAddress);
        isStrategy[strategyAddress] = true;
        isStrategyAlive[strategyAddress] = true;
        bribeFor[strategyAddress] = bribeAddress;
        bribeRouterFor[strategyAddress] = bribeRouterAddress;
        paymentTokenFor[strategyAddress] = address(paymentToken);
        strategyRevenueIndex[strategyAddress] = revenueIndex;

        emit StrategyAdded(strategyAddress, bribeAddress, bribeRouterAddress, address(paymentToken));
    }

    /// @notice Stops a Strategy from receiving future USDG; its already indexed revenue is returned to Fund.
    /// @dev Existing signal weights remain until their owners remove them incrementally. Their dead-Strategy revenue
    ///      share is routed to Fund whenever that Strategy's index is updated.
    /// @param strategy Strategy to disable permanently.
    function killStrategy(address strategy) external nonReentrant onlyOwner {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (!isStrategyAlive[strategy]) revert StrategyAlreadyDead(strategy);

        _checkpointRevenue();
        _updateStrategy(strategy);

        uint256 amount = claimableRevenue[strategy];
        if (amount != 0) {
            claimableRevenue[strategy] = 0;
            totalClaimableRevenue -= amount;
            _accrueFundRevenue(amount);
        }

        isStrategyAlive[strategy] = false;

        emit StrategyKilled(strategy);
    }

    /// @notice Registers an additional reward token on a Strategy's Bribe.
    /// @param strategy Strategy whose Bribe should accept the token.
    /// @param rewardToken Token to register.
    function addBribeReward(address strategy, address rewardToken) external onlyOwner {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (rewardToken == address(0) || rewardToken.code.length == 0) revert ZeroAddress();
        if (rewardToken == address(signalGBX)) revert ForbiddenRewardToken(rewardToken);

        address bribe = bribeFor[strategy];
        Bribe(bribe).addRewardToken(rewardToken);

        emit BribeRewardAdded(strategy, bribe, rewardToken);
    }

    /// @notice Returns all protocol Strategies in creation order.
    /// @return strategyList Strategy addresses in creation order.
    function strategies() external view returns (address[] memory strategyList) {
        return _strategies;
    }

    /// @notice Returns the Strategies currently selected by `account`.
    /// @param account Signal account to inspect.
    /// @return strategyList Strategies currently selected by `account`.
    function accountStrategies(address account) external view returns (address[] memory strategyList) {
        return _accountStrategies[account];
    }

    /// @notice Returns revenue accrued since `strategy` was last updated.
    /// @param strategy Strategy whose uncheckpointed revenue is queried.
    /// @return amount Revenue accrued since the Strategy's last index update.
    function pendingRevenue(address strategy) external view returns (uint256 amount) {
        if (!isStrategy[strategy]) return 0;

        uint256 previewIndex = revenueIndex;
        uint256 weightTotal = totalSignalWeight;
        if (weightTotal != 0) {
            uint256 previewPendingScaled = pendingRevenueScaled + releasableRevenueScaled();
            previewIndex += previewPendingScaled / weightTotal;
        }

        uint256 weight = strategySignalWeight[strategy];
        uint256 scaled = strategyRevenueRemainder[strategy];
        if (weight != 0) scaled += weight * (previewIndex - strategyRevenueIndex[strategy]);
        return scaled / INDEX_PRECISION;
    }

    /// @notice Returns the scaled USDG that a checkpoint at the current timestamp would release.
    /// @dev Previews at most the active stream and its single aggregate queued successor.
    /// @return releasedScaled Releasable amount expressed in `INDEX_PRECISION`.
    function releasableRevenueScaled() public view returns (uint256 releasedScaled) {
        uint256 remainingScaled = revenueStreamRemainingScaled;
        uint256 lastUpdate = revenueStreamLastUpdate;
        if (remainingScaled == 0 || block.timestamp <= lastUpdate) return 0;

        uint256 finish = revenueStreamFinish;
        uint256 applicable = block.timestamp < finish ? block.timestamp : finish;
        releasedScaled = _emissionBetween(revenueStreamRateScaled, revenueStreamRemainderFinish, lastUpdate, applicable);

        if (block.timestamp > finish) {
            uint256 queued = queuedRevenue;
            if (queued != 0) {
                uint256 queuedScaled = queued * INDEX_PRECISION;
                uint256 queuedFinish = finish + REVENUE_STREAM_DURATION;
                uint256 queuedApplicable = block.timestamp < queuedFinish ? block.timestamp : queuedFinish;
                releasedScaled += _emissionBetween(
                    queuedScaled / REVENUE_STREAM_DURATION,
                    finish + (queuedScaled % REVENUE_STREAM_DURATION),
                    finish,
                    queuedApplicable
                );
            }
        }
    }

    /// @notice Transfers a Strategy's indexed USDG allocation to that Strategy.
    /// @param strategy Strategy whose indexed revenue should be transferred.
    /// @return amount Amount of USDG distributed.
    function distribute(address strategy) public nonReentrant returns (uint256 amount) {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);

        _checkpointRevenue();
        _updateStrategy(strategy);
        amount = claimableRevenue[strategy];
        if (amount == 0) return 0;

        claimableRevenue[strategy] = 0;
        totalClaimableRevenue -= amount;
        accountedRevenueBalance -= amount;
        _transferRevenueExact(strategy, amount);

        emit RevenueDistributed(msg.sender, strategy, amount);
    }

    /// @notice Pays the complete accumulated dead/zero-signal USDG entitlement to the immutable Fund.
    /// @dev State is cleared before interaction; a transfer failure atomically restores the full liability.
    /// @return amount USDG paid to Fund.
    function payFundRevenue() external nonReentrant returns (uint256 amount) {
        _checkpointRevenue();
        amount = fundRevenueLiability;
        if (amount == 0) return 0;

        fundRevenueLiability = 0;
        accountedRevenueBalance -= amount;
        _transferRevenueExact(fund, amount);

        emit FundRevenuePaid(msg.sender, fund, amount);
    }

    /// @notice Returns USDG held outside the explicit accounting identity, normally a direct unsynchronized donation.
    /// @return amount Unaccounted supported-token balance.
    function unaccountedRevenue() external view returns (uint256 amount) {
        uint256 actualBalance = usdg.balanceOf(address(this));
        uint256 accounted = accountedRevenueBalance;
        if (actualBalance < accounted) revert RevenueBalanceDeficit(accounted, actualBalance);
        return actualBalance - accounted;
    }

    /// @notice Distributes revenue to a bounded half-open range of Strategies: `[start, end)`.
    /// @param start Inclusive index in the Strategy list.
    /// @param end Exclusive index, capped at the current Strategy count.
    function distributeRange(uint256 start, uint256 end) public {
        uint256 strategyCount = _strategies.length;
        if (end > strategyCount) end = strategyCount;

        for (uint256 i = start; i < end; ++i) {
            distribute(_strategies[i]);
        }
    }

    /// @notice Applies one absolute signal increase.
    /// @param account Signal account whose allocation increases.
    /// @param strategy Strategy receiving the allocation.
    /// @param amount Absolute SignalGBX delta to add.
    function _addSignal(address account, address strategy, uint256 amount) private {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (!isStrategyAlive[strategy]) revert StrategyAlreadyDead(strategy);
        if (amount == 0) revert ZeroAmount();

        uint256 allocated = accountSignalWeight[account];
        uint256 available = signalGBX.balanceOf(account) - allocated;
        if (amount > available) revert InsufficientUnallocatedSignal(available, amount);

        _checkpointRevenue();
        _updateStrategy(strategy);
        _fundPendingRevenueCarry();

        uint256 previousSignal = accountSignals[account][strategy];
        if (previousSignal == 0) {
            _accountStrategies[account].push(strategy);
            _accountStrategyIndex[account][strategy] = _accountStrategies[account].length;
        }

        accountSignals[account][strategy] = previousSignal + amount;
        accountSignalWeight[account] = allocated + amount;
        strategySignalWeight[strategy] += amount;
        totalSignalWeight += amount;
        Bribe(bribeFor[strategy]).deposit(amount, account);

        emit SignalAdded(account, strategy, amount);
    }

    /// @notice Applies one absolute signal decrease and removes empty account-list entries with swap-and-pop.
    /// @param account Signal account whose allocation decreases.
    /// @param strategy Strategy losing the allocation.
    /// @param amount Absolute SignalGBX delta to remove.
    function _removeSignal(address account, address strategy, uint256 amount) private {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (amount == 0) revert ZeroAmount();

        uint256 previousSignal = accountSignals[account][strategy];
        if (amount > previousSignal) revert InsufficientSignal(strategy, previousSignal, amount);

        _checkpointRevenue();
        _updateStrategy(strategy);
        _fundPendingRevenueCarry();

        uint256 remainingSignal = previousSignal - amount;
        accountSignals[account][strategy] = remainingSignal;
        accountSignalWeight[account] -= amount;
        strategySignalWeight[strategy] -= amount;
        totalSignalWeight -= amount;
        Bribe(bribeFor[strategy]).withdraw(amount, account);

        if (strategySignalWeight[strategy] == 0) {
            _accrueFundRevenueScaled(strategyRevenueRemainder[strategy]);
            delete strategyRevenueRemainder[strategy];
        }

        if (remainingSignal == 0) {
            address[] storage selectedStrategies = _accountStrategies[account];
            uint256 removedIndex = _accountStrategyIndex[account][strategy] - 1;
            uint256 lastIndex = selectedStrategies.length - 1;

            if (removedIndex != lastIndex) {
                address movedStrategy = selectedStrategies[lastIndex];
                selectedStrategies[removedIndex] = movedStrategy;
                _accountStrategyIndex[account][movedStrategy] = removedIndex + 1;
            }

            selectedStrategies.pop();
            delete _accountStrategyIndex[account][strategy];
        }

        emit SignalRemoved(account, strategy, amount);
    }

    /// @notice Advances one Strategy to the current global revenue index.
    /// @dev Records live-Strategy revenue as claimable and accrues dead-Strategy revenue to a fixed Fund liability.
    /// @param strategy Strategy whose revenue checkpoint should advance.
    function _updateStrategy(address strategy) private {
        uint256 currentIndex = revenueIndex;
        uint256 previousIndex = strategyRevenueIndex[strategy];
        strategyRevenueIndex[strategy] = currentIndex;

        uint256 weight = strategySignalWeight[strategy];
        if (weight == 0 || currentIndex == previousIndex) return;

        uint256 newlyIndexedScaled = weight * (currentIndex - previousIndex);
        indexedRevenueScaled -= newlyIndexedScaled;

        uint256 accruedScaled = strategyRevenueRemainder[strategy] + newlyIndexedScaled;
        uint256 amount = accruedScaled / INDEX_PRECISION;
        strategyRevenueRemainder[strategy] = accruedScaled % INDEX_PRECISION;
        if (isStrategyAlive[strategy]) {
            claimableRevenue[strategy] += amount;
            totalClaimableRevenue += amount;
        } else if (amount != 0) {
            _accrueFundRevenue(amount);
        }
    }

    /// @notice Starts a seven-day stream or aggregates revenue into its queued successor.
    /// @dev A live notification never changes the active stream's rate or finish.
    /// @param amount Whole USDG units newly entering accounting.
    function _scheduleRevenue(uint256 amount) private {
        if (revenueStreamRemainingScaled == 0) {
            _startRevenueStream(amount, block.timestamp);
            return;
        }

        queuedRevenue += amount;
        emit RevenueQueued(amount, queuedRevenue);
    }

    /// @notice Releases elapsed revenue through at most the active stream and one queued successor.
    /// @return indexDelta Increment applied to the global revenue index.
    function _checkpointRevenue() private returns (uint256 indexDelta) {
        if (revenueStreamRemainingScaled != 0) {
            uint256 firstFinish = revenueStreamFinish;
            uint256 firstApplicable = block.timestamp < firstFinish ? block.timestamp : firstFinish;
            _accrueRevenueUntil(firstApplicable);

            if (block.timestamp >= firstFinish) {
                _clearRevenueStream();

                uint256 queued = queuedRevenue;
                if (queued != 0) {
                    queuedRevenue = 0;
                    _startRevenueStream(queued, firstFinish);

                    uint256 secondFinish = revenueStreamFinish;
                    uint256 secondApplicable = block.timestamp < secondFinish ? block.timestamp : secondFinish;
                    _accrueRevenueUntil(secondApplicable);
                    if (block.timestamp >= secondFinish) _clearRevenueStream();
                }
            }
        }

        indexDelta = _indexPendingRevenue();
    }

    /// @notice Starts an exact fixed-point stream, assigning its division remainder to the earliest seconds.
    /// @param amount Whole USDG units assigned to the stream.
    /// @param startedAt Inclusive stream start.
    function _startRevenueStream(uint256 amount, uint256 startedAt) private {
        uint256 amountScaled = amount * INDEX_PRECISION;
        uint256 rateScaled = amountScaled / REVENUE_STREAM_DURATION;
        uint256 rateRemainder = amountScaled % REVENUE_STREAM_DURATION;

        revenueStreamRateScaled = rateScaled;
        revenueStreamRemainingScaled = amountScaled;
        revenueStreamLastUpdate = startedAt;
        revenueStreamFinish = startedAt + REVENUE_STREAM_DURATION;
        revenueStreamRemainderFinish = startedAt + rateRemainder;

        emit RevenueStreamScheduled(amount, amountScaled, startedAt, revenueStreamFinish, rateScaled, rateRemainder);
    }

    /// @notice Releases one exact active-stream interval into scaled allocation carry.
    /// @param timestamp Timestamp through which to release, capped at the active finish.
    function _accrueRevenueUntil(uint256 timestamp) private {
        uint256 from = revenueStreamLastUpdate;
        if (timestamp <= from) return;

        uint256 releasedScaled =
            _emissionBetween(revenueStreamRateScaled, revenueStreamRemainderFinish, from, timestamp);
        revenueStreamRemainingScaled -= releasedScaled;
        revenueStreamLastUpdate = timestamp;
        pendingRevenueScaled += releasedScaled;

        emit RevenueStreamCheckpointed(releasedScaled, revenueStreamRemainingScaled);
    }

    /// @notice Clears completed active-stream fields while preserving allocation accounting.
    function _clearRevenueStream() private {
        revenueStreamRateScaled = 0;
        revenueStreamRemainingScaled = 0;
        revenueStreamLastUpdate = 0;
        revenueStreamFinish = 0;
        revenueStreamRemainderFinish = 0;
    }

    /// @notice Returns exact scaled emission over one active-stream interval.
    /// @param rateScaled Base scaled emission per second.
    /// @param remainderFinish Exclusive end of the initial one-unit-per-second remainder interval.
    /// @param from Inclusive interval start.
    /// @param to Exclusive interval end.
    /// @return amountScaled Exact scaled emission in `[from, to)`.
    function _emissionBetween(uint256 rateScaled, uint256 remainderFinish, uint256 from, uint256 to)
        private
        pure
        returns (uint256 amountScaled)
    {
        if (to <= from) return 0;
        amountScaled = (to - from) * rateScaled;
        if (from < remainderFinish) {
            uint256 remainderEnd = to < remainderFinish ? to : remainderFinish;
            amountScaled += remainderEnd - from;
        }
    }

    /// @notice Converts as much scaled carry as possible into the current weight index without looping Strategies.
    /// @return indexDelta Increment applied to the global index.
    function _indexPendingRevenue() private returns (uint256 indexDelta) {
        uint256 weight = totalSignalWeight;
        if (weight == 0) {
            _fundPendingRevenueCarry();
            return 0;
        }

        indexDelta = pendingRevenueScaled / weight;
        if (indexDelta == 0) return 0;

        uint256 indexedScaled = indexDelta * weight;
        pendingRevenueScaled -= indexedScaled;
        indexedRevenueScaled += indexedScaled;
        revenueIndex += indexDelta;
    }

    /// @notice Prevents scaled carry released under prior weights from crossing a signal-weight boundary.
    function _fundPendingRevenueCarry() private {
        uint256 amountScaled = pendingRevenueScaled;
        if (amountScaled == 0) return;
        pendingRevenueScaled = 0;
        _accrueFundRevenueScaled(amountScaled);
    }

    /// @notice Adds scaled revenue to Fund's exact remainder and materializes every complete raw unit.
    /// @param amountScaled Scaled USDG units irrevocably assigned to Fund.
    function _accrueFundRevenueScaled(uint256 amountScaled) private {
        if (amountScaled == 0) return;

        uint256 combinedScaled = fundRevenueRemainderScaled + amountScaled;
        uint256 amount = combinedScaled / INDEX_PRECISION;
        fundRevenueRemainderScaled = combinedScaled % INDEX_PRECISION;
        if (amount != 0) _accrueFundRevenue(amount);

        emit RevenueCarryFunded(amountScaled, fundRevenueRemainderScaled);
    }

    /// @notice Adds an irrevocable whole-token entitlement for the immutable Fund without making an external call.
    /// @param amount Whole USDG units newly owed to Fund.
    function _accrueFundRevenue(uint256 amount) private {
        fundRevenueLiability += amount;
        emit FundRevenueAccrued(amount, fundRevenueLiability);
    }

    /// @notice Transfers supported USDG only when both sender debit and recipient credit equal `amount`.
    /// @param receiver Fixed Strategy or Fund destination.
    /// @param amount Whole USDG units to transfer.
    function _transferRevenueExact(address receiver, uint256 amount) private {
        uint256 senderBefore = usdg.balanceOf(address(this));
        uint256 receiverBefore = usdg.balanceOf(receiver);
        usdg.safeTransfer(receiver, amount);
        uint256 senderDebit = senderBefore - usdg.balanceOf(address(this));
        uint256 receiverCredit = usdg.balanceOf(receiver) - receiverBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactRevenuePayout(receiver, amount, senderDebit, receiverCredit);
        }
    }

    /// @notice Rejects balances whose exact precision representation cannot fit the accounting word.
    function _requireScalableBalance() private view {
        uint256 balance = accountedRevenueBalance;
        if (balance > type(uint256).max / INDEX_PRECISION) revert RevenueScaleOverflow(balance);
    }
}
