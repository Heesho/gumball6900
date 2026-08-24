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
/// @notice Streams USDG to Strategies according to their live SignalGBX allocations.
/// @dev Uses Synthetix-style linear revenue accounting. A qualifying notification checkpoints the current period and
///      restarts a seven-day stream containing the new revenue plus the amount remaining at the prior whole-unit
///      rate. USDG uses six decimals while SignalGBX uses eighteen, so the cumulative revenue index uses 1e36
///      precision.
contract Resonance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice USDG revenue schedule and cumulative-index state.
    struct RevenueData {
        uint256 periodFinish;
        uint256 revenueRate;
        uint256 lastUpdateTime;
        uint256 revenuePerSignalStored;
    }

    /// @notice Fixed duration of every USDG revenue period.
    uint256 public constant REWARD_DURATION = 7 days;
    /// @notice Fixed-point precision for allocating six-decimal USDG across eighteen-decimal SignalGBX.
    uint256 public constant REWARD_PRECISION = 1e36;
    /// @notice Basis-point denominator for Strategy-payment classification.
    uint256 public constant BPS = 10_000;
    /// @notice Initial share of every new Strategy payment assigned to its paired Bribe.
    uint256 public constant DEFAULT_BRIBE_BPS = 1_000;
    /// @notice Hard governance ceiling preserving at least 80% of every classified payment for Fund.
    uint256 public constant MAX_BRIBE_BPS = 2_000;
    /// @notice Non-transferable signal receipt used as allocation and governance power.
    IERC20 public immutable signalGBX;
    /// @notice Six-decimal revenue token streamed to Strategies.
    IERC20 public immutable usdg;
    /// @notice Treasury exposed to the paired Bribe graph and Strategy settlement.
    address public immutable fund;
    /// @notice Resonance-bound factory used to create one Bribe per Strategy.
    BribeFactory public immutable bribeFactory;
    /// @notice Resonance-bound factory used to create Strategies and their BribeRouters.
    StrategyFactory public immutable strategyFactory;

    /// @notice The sole USDG revenue schedule and cumulative revenue-per-signal index.
    RevenueData public revenueData;
    /// @notice Cumulative USDG revenue-per-signal already incorporated for each Strategy.
    mapping(address strategy => uint256 paid) public strategyRevenuePerSignalPaid;
    /// @notice Accrued whole raw USDG units owed to each Strategy.
    mapping(address strategy => uint256 revenue) public strategyRevenue;

    /// @notice Total active SignalGBX weight eligible for Resonance revenue.
    uint256 public totalSignalWeight;
    /// @notice Number of registered Strategies eligible for new signal and future Resonance revenue.
    uint256 public liveStrategyCount;

    /// @notice Whether an address is a Resonance-created Strategy.
    mapping(address strategy => bool registered) public isStrategyRegistered;
    /// @notice Whether a Strategy can receive new signal and future Resonance revenue.
    mapping(address strategy => bool live) public isStrategyLive;
    /// @notice Bribe associated with each Strategy.
    mapping(address strategy => address bribe) public bribeFor;
    /// @notice BribeRouter associated with each Strategy.
    mapping(address strategy => address router) public bribeRouterFor;
    /// @notice Sole validated Router authorized to pull USDG into Resonance and notify revenue.
    address public resonanceRouter;
    /// @notice Governance-selected share of newly classified Strategy payments assigned to paired Bribes.
    uint256 public bribeBps = DEFAULT_BRIBE_BPS;

    /// @notice Emitted after governance changes the prospective automatic-Bribe share.
    event BribeBpsSet(uint256 previousBribeBps, uint256 newBribeBps);
    /// @notice Emitted after governance registers another reward token on a Strategy's paired Bribe.
    event BribeRewardTokenAdded(address indexed strategy, address indexed bribe, address indexed rewardToken);
    /// @notice Emitted after accrued USDG is transferred to its entitled Strategy.
    event RevenueDistributed(address indexed caller, address indexed strategy, uint256 amount);
    /// @notice Emitted after ResonanceRouter funds and restarts the USDG stream.
    event RevenueNotified(address indexed resonanceRouter, uint256 amount);
    /// @notice Emitted after the sole ResonanceRouter is permanently bound.
    event ResonanceRouterSet(address indexed resonanceRouter);
    /// @notice Emitted after SignalGBX adds signal weight to a live Strategy.
    event SignalAdded(address indexed account, address indexed strategy, uint256 amount);
    /// @notice Emitted after SignalGBX removes signal weight from a Strategy.
    event SignalRemoved(address indexed account, address indexed strategy, uint256 amount);
    /// @notice Emitted after governance creates a complete Strategy, Bribe, and BribeRouter graph.
    event StrategyAdded(
        address indexed strategy, address indexed bribe, address indexed bribeRouter, address paymentToken
    );
    /// @notice Emitted after governance permanently kills a Strategy.
    event StrategyKilled(address indexed strategy);

    /// @notice A requested automatic-Bribe share exceeds the immutable maximum.
    error BribeBpsAboveMaximum(uint256 requested);
    /// @notice A Strategy address was already registered.
    error DuplicateStrategy(address strategy);
    /// @notice Killing a Strategy would remove the final live Strategy.
    error FinalLiveStrategy(address strategy);
    /// @notice A Strategy attempted to use SignalGBX as its payment token.
    error ForbiddenPaymentToken(address token);
    /// @notice Governance attempted to register SignalGBX as a Bribe reward token.
    error ForbiddenRewardToken(address token);
    /// @notice An account attempted to remove more signal than the paired Bribe records.
    error InsufficientSignal(address strategy, uint256 available, uint256 requested);
    /// @notice A proposed ResonanceRouter does not match this Resonance and USDG graph.
    error InvalidResonanceRouter(address resonanceRouter);
    /// @notice The one-time ResonanceRouter binding has already completed.
    error ResonanceRouterAlreadySet(address resonanceRouter);
    /// @notice A revenue notification is smaller than the scheduled amount remaining.
    error RevenueBelowRemaining(uint256 amount, uint256 remaining);
    /// @notice A killed Strategy was targeted by another kill or signal addition.
    error StrategyAlreadyDead(address strategy);
    /// @notice An address is not a registered Strategy.
    error StrategyNotFound(address strategy);
    /// @notice Revenue notification did not originate from the bound ResonanceRouter.
    error UnauthorizedRevenueSource(address caller);
    /// @notice Signal accounting did not originate from the bound SignalGBX coordinator.
    error UnauthorizedSignalSource(address caller);
    /// @notice A required dependency, Strategy, account, or token address is zero.
    error ZeroAddress();
    /// @notice A signal or revenue amount is zero.
    error ZeroAmount();

    modifier onlyResonanceRouter() {
        if (msg.sender != resonanceRouter) revert UnauthorizedRevenueSource(msg.sender);
        _;
    }

    modifier onlySignalGBX() {
        if (msg.sender != address(signalGBX)) revert UnauthorizedSignalSource(msg.sender);
        _;
    }

    /// @notice Creates the allocator with immutable token, Fund, and factory dependencies.
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

    /// @notice Adds an absolute SignalGBX delta for an account through the bound SignalGBX coordinator.
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

    /// @notice Removes an absolute SignalGBX delta for an account through the bound SignalGBX coordinator.
    /// @dev Exits remain available after a Strategy is killed and do not decrement active weight a second time.
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

    /// @notice Pulls qualifying USDG from ResonanceRouter and restarts the seven-day revenue period.
    /// @dev During an active period, the new amount must be at least the scheduled revenue remaining in that period.
    ///      As in Synthetix StakingRewards, division by `REWARD_DURATION` floors and any raw-unit remainder stays as
    ///      contract surplus.
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

    /// @notice Pays one Strategy's accrued USDG. Anyone may trigger payment to the fixed entitled Strategy.
    function distributeRevenue(address strategy) external nonReentrant returns (uint256 amount) {
        _updateRevenue(strategy);
        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);

        amount = strategyRevenue[strategy];
        if (amount == 0) return 0;

        strategyRevenue[strategy] = 0;
        usdg.safeTransfer(strategy, amount);

        emit RevenueDistributed(msg.sender, strategy, amount);
    }

    /// @notice Binds the sole ResonanceRouter after reciprocal Resonance and USDG identity validation.
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

    /// @notice Sets the prospective paired-Bribe share for every later Strategy-payment classification.
    /// @dev Earlier purchases and active reward streams are never repriced.
    /// @param newBribeBps New global share in basis points, from zero through `MAX_BRIBE_BPS`.
    function setBribeBps(uint256 newBribeBps) external onlyOwner {
        if (newBribeBps > MAX_BRIBE_BPS) revert BribeBpsAboveMaximum(newBribeBps);

        uint256 previousBps = bribeBps;
        bribeBps = newBribeBps;

        emit BribeBpsSet(previousBps, newBribeBps);
    }

    /// @notice Creates a Strategy, its Bribe, and its BribeRouter as one Resonance-controlled graph.
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

    /// @notice Permanently stops a Strategy from receiving new signal or future Resonance revenue.
    /// @dev Revenue accrued through this checkpoint remains claimable. Existing signal remains recorded and removable.
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

    /// @notice Registers an additional independently funded reward token on one Strategy's Bribe.
    function addBribeRewardToken(address strategy, address rewardToken) external onlyOwner {
        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);
        if (rewardToken == address(0) || rewardToken.code.length == 0) revert ZeroAddress();
        if (rewardToken == address(signalGBX)) revert ForbiddenRewardToken(rewardToken);

        address bribe = bribeFor[strategy];
        Bribe(bribe).addRewardToken(rewardToken);

        emit BribeRewardTokenAdded(strategy, bribe, rewardToken);
    }

    /// @notice Returns cumulative scaled USDG allocated per unit of active SignalGBX.
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

    /// @notice Returns one Strategy's stored plus elapsed USDG revenue.
    function earnedRevenue(address strategy) external view returns (uint256 revenue) {
        uint256 delta = revenuePerSignal() - strategyRevenuePerSignalPaid[strategy];
        uint256 activeBalance = isStrategyLive[strategy] ? _strategySignalWeight(strategy) : 0;
        return strategyRevenue[strategy] + Math.mulDiv(activeBalance, delta, REWARD_PRECISION);
    }

    /// @notice Returns whole raw USDG units remaining at the active period's stored rate.
    function remainingRevenue() public view returns (uint256 amount) {
        RevenueData storage data = revenueData;
        if (block.timestamp >= data.periodFinish) return 0;
        return (data.periodFinish - block.timestamp) * data.revenueRate;
    }

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

    function _strategySignalWeight(address strategy) private view returns (uint256 amount) {
        address bribe = bribeFor[strategy];
        if (bribe == address(0)) return 0;
        return Bribe(bribe).totalSignalWeight();
    }

    function _lastApplicableRevenueTime() private view returns (uint256 timestamp) {
        uint256 finish = revenueData.periodFinish;
        return block.timestamp < finish ? block.timestamp : finish;
    }
}
