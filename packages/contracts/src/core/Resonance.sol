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
import { IResonanceRouterIdentity } from "./interfaces/IResonanceIdentity.sol";

/// @title GumBall6900 Signal-Directed Revenue Allocator
/// @author Heesho
/// @notice Streams USDG to Strategies as virtual stakers weighted by live SignalGBX allocations.
/// @dev Uses Synthetix-style linear reward accounting. A qualifying notification checkpoints the current period and
///      restarts a seven-day stream containing the new reward plus the scheduled amount left at the prior whole-unit
///      rate. USDG uses six decimals while SignalGBX uses eighteen, so the cumulative reward index uses 1e36 precision.
/// @custom:version 1.4.0
contract Resonance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice USDG reward schedule and cumulative-index state.
    struct Reward {
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    /// @notice Fixed duration of every USDG reward period.
    uint256 public constant DURATION = 7 days;
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
    /// @notice Six-decimal reward token streamed to Strategies.
    IERC20 public immutable usdg;
    /// @notice Treasury exposed to the paired Bribe graph and Strategy settlement.
    address public immutable fund;
    /// @notice Resonance-bound factory used to create one Bribe per Strategy.
    BribeFactory public immutable bribeFactory;
    /// @notice Resonance-bound factory used to create Strategies and their BribeRouters.
    StrategyFactory public immutable strategyFactory;

    /// @notice The sole USDG reward schedule and cumulative reward-per-signal index.
    Reward public rewardData;
    /// @notice Cumulative USDG reward-per-signal already incorporated for each Strategy.
    mapping(address strategy => uint256 paid) public strategyRewardPerTokenPaid;
    /// @notice Accrued whole raw USDG units owed to each Strategy.
    mapping(address strategy => uint256 reward) public strategyRewards;

    /// @notice Total active SignalGBX weight eligible for Resonance rewards.
    uint256 public totalSignalWeight;
    /// @notice Number of registered Strategies eligible for new signal and future Resonance rewards.
    uint256 public liveStrategyCount;

    /// @notice Whether an address is a Resonance-created Strategy.
    mapping(address strategy => bool valid) public isStrategy;
    /// @notice Whether a Strategy can receive new signal and future Resonance rewards.
    mapping(address strategy => bool alive) public isStrategyAlive;
    /// @notice Bribe associated with each Strategy.
    mapping(address strategy => address bribe) public bribeFor;
    /// @notice BribeRouter associated with each Strategy.
    mapping(address strategy => address router) public bribeRouterFor;
    /// @notice Payment token required by each Strategy.
    mapping(address strategy => address paymentToken) public paymentTokenFor;

    /// @notice Sole validated Router authorized to pull USDG into Resonance and notify rewards.
    address public resonanceRouter;
    /// @notice Governance-selected share of newly classified Strategy payments assigned to paired Bribes.
    uint256 public bribeBps = DEFAULT_BRIBE_BPS;

    event BribeBpsSet(uint256 previousBps, uint256 newBps);
    event BribeRewardAdded(address indexed strategy, address indexed bribe, address indexed rewardToken);
    event RevenueDistributed(address indexed caller, address indexed strategy, uint256 amount);
    event RevenueNotified(address indexed resonanceRouter, uint256 amount);
    event ResonanceRouterSet(address indexed resonanceRouter);
    event SignalAdded(address indexed account, address indexed strategy, uint256 amount);
    event SignalRemoved(address indexed account, address indexed strategy, uint256 amount);
    event StrategyAdded(
        address indexed strategy, address indexed bribe, address indexed bribeRouter, address paymentToken
    );
    event StrategyKilled(address indexed strategy);

    error BribeBpsAboveMaximum(uint256 requested);
    error DuplicateStrategy(address strategy);
    error FinalLiveStrategy(address strategy);
    error ForbiddenPaymentToken(address token);
    error ForbiddenRewardToken(address token);
    error InsufficientSignal(address strategy, uint256 available, uint256 requested);
    error InvalidResonanceRouter(address resonanceRouter);
    error ResonanceRouterAlreadySet(address resonanceRouter);
    error RewardSmallerThanLeft(uint256 reward, uint256 left);
    error StrategyAlreadyDead(address strategy);
    error StrategyNotFound(address strategy);
    error UnauthorizedRevenueSource(address caller);
    error UnauthorizedSignalSource(address caller);
    error ZeroAddress();
    error ZeroAmount();

    modifier updateReward(address strategy) {
        _updateReward(strategy);
        _;
    }

    modifier onlyResonanceRouter() {
        if (msg.sender != resonanceRouter) revert UnauthorizedRevenueSource(msg.sender);
        _;
    }

    modifier onlySignalGBX() {
        if (msg.sender != address(signalGBX)) revert UnauthorizedSignalSource(msg.sender);
        _;
    }

    /// @notice Creates the rewarder with immutable token, Fund, and factory dependencies.
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
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (!isStrategyAlive[strategy]) revert StrategyAlreadyDead(strategy);
        if (amount == 0) revert ZeroAmount();

        _updateReward(strategy);

        totalSignalWeight += amount;
        Bribe(bribeFor[strategy]).deposit(amount, account);

        emit SignalAdded(account, strategy, amount);
    }

    /// @notice Removes an absolute SignalGBX delta for an account through the bound SignalGBX coordinator.
    /// @dev Exits remain available after a Strategy is killed and do not decrement active weight a second time.
    function removeSignalFor(address account, address strategy, uint256 amount) external nonReentrant onlySignalGBX {
        if (account == address(0)) revert ZeroAddress();
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (amount == 0) revert ZeroAmount();

        Bribe bribe = Bribe(bribeFor[strategy]);
        uint256 allocated = bribe.balanceOf(account);
        if (amount > allocated) revert InsufficientSignal(strategy, allocated, amount);

        _updateReward(strategy);

        if (isStrategyAlive[strategy]) totalSignalWeight -= amount;
        bribe.withdraw(amount, account);

        emit SignalRemoved(account, strategy, amount);
    }

    /// @notice Pulls qualifying USDG from ResonanceRouter and restarts the seven-day reward period.
    /// @dev During an active period, the new reward must be at least the scheduled reward left in that period. As in
    ///      Synthetix StakingRewards, division by `DURATION` floors and any raw-unit remainder stays as contract surplus.
    function notifyRevenue(uint256 reward) external nonReentrant onlyResonanceRouter updateReward(address(0)) {
        if (reward == 0) revert ZeroAmount();

        uint256 remaining = left();
        if (reward < remaining) revert RewardSmallerThanLeft(reward, remaining);

        usdg.safeTransferFrom(msg.sender, address(this), reward);

        Reward storage data = rewardData;
        data.rewardRate = (reward + remaining) / DURATION;
        data.lastUpdateTime = block.timestamp;
        data.periodFinish = block.timestamp + DURATION;

        emit RevenueNotified(msg.sender, reward);
    }

    /// @notice Pays one Strategy's accrued USDG. Anyone may trigger payment to the fixed entitled Strategy.
    function distribute(address strategy) public nonReentrant updateReward(strategy) returns (uint256 amount) {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);

        amount = strategyRewards[strategy];
        if (amount == 0) return 0;

        strategyRewards[strategy] = 0;
        usdg.safeTransfer(strategy, amount);

        emit RevenueDistributed(msg.sender, strategy, amount);
    }

    /// @notice Binds the sole ResonanceRouter after reciprocal Resonance and USDG identity validation.
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
        if (isStrategy[strategyAddress]) revert DuplicateStrategy(strategyAddress);

        isStrategy[strategyAddress] = true;
        isStrategyAlive[strategyAddress] = true;
        ++liveStrategyCount;
        bribeFor[strategyAddress] = bribeAddress;
        bribeRouterFor[strategyAddress] = bribeRouterAddress;
        paymentTokenFor[strategyAddress] = address(paymentToken);
        strategyRewardPerTokenPaid[strategyAddress] = rewardData.rewardPerTokenStored;

        emit StrategyAdded(strategyAddress, bribeAddress, bribeRouterAddress, address(paymentToken));
    }

    /// @notice Permanently stops a Strategy from receiving new signal or future Resonance rewards.
    /// @dev Rewards accrued through this checkpoint remain claimable. Existing signal remains recorded and removable.
    function killStrategy(address strategy) external nonReentrant onlyOwner updateReward(strategy) {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (!isStrategyAlive[strategy]) revert StrategyAlreadyDead(strategy);
        if (liveStrategyCount == 1) revert FinalLiveStrategy(strategy);

        isStrategyAlive[strategy] = false;
        --liveStrategyCount;
        totalSignalWeight -= strategySignalWeight(strategy);

        emit StrategyKilled(strategy);
    }

    /// @notice Registers an additional independently funded reward token on one Strategy's Bribe.
    function addBribeReward(address strategy, address rewardToken) external onlyOwner {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (rewardToken == address(0) || rewardToken.code.length == 0) revert ZeroAddress();
        if (rewardToken == address(signalGBX)) revert ForbiddenRewardToken(rewardToken);

        address bribe = bribeFor[strategy];
        Bribe(bribe).addRewardToken(rewardToken);

        emit BribeRewardAdded(strategy, bribe, rewardToken);
    }

    /// @notice Returns the final timestamp applicable to the active reward period.
    function lastTimeRewardApplicable() public view returns (uint256 timestamp) {
        uint256 finish = rewardData.periodFinish;
        return block.timestamp < finish ? block.timestamp : finish;
    }

    /// @notice Returns cumulative scaled USDG allocated per unit of active SignalGBX.
    function rewardPerToken() public view returns (uint256 accumulatedReward) {
        Reward storage data = rewardData;
        accumulatedReward = data.rewardPerTokenStored;
        if (totalSignalWeight == 0) return accumulatedReward;

        uint256 applicable = lastTimeRewardApplicable();
        uint256 lastUpdate = data.lastUpdateTime;
        if (applicable <= lastUpdate) return accumulatedReward;

        uint256 emitted = (applicable - lastUpdate) * data.rewardRate;
        return accumulatedReward + Math.mulDiv(emitted, REWARD_PRECISION, totalSignalWeight);
    }

    /// @notice Returns one Strategy's stored plus elapsed USDG reward.
    function earned(address strategy) public view returns (uint256 reward) {
        uint256 delta = rewardPerToken() - strategyRewardPerTokenPaid[strategy];
        uint256 activeBalance = isStrategyAlive[strategy] ? strategySignalWeight(strategy) : 0;
        return strategyRewards[strategy] + Math.mulDiv(activeBalance, delta, REWARD_PRECISION);
    }

    /// @notice Returns the SignalGBX one account has assigned to one Strategy.
    /// @dev The paired Bribe is the canonical account-by-Strategy signal ledger.
    function accountSignals(address account, address strategy) public view returns (uint256 amount) {
        address bribe = bribeFor[strategy];
        if (bribe == address(0)) return 0;
        return Bribe(bribe).balanceOf(account);
    }

    /// @notice Returns an account's complete signal across live and killed Strategies.
    /// @dev SignalGBX balance is the canonical account aggregate because idle sGBX is unreachable.
    function accountSignalWeight(address account) public view returns (uint256 amount) {
        return signalGBX.balanceOf(account);
    }

    /// @notice Returns the complete SignalGBX weight recorded for one Strategy.
    /// @dev The paired Bribe is the canonical per-Strategy signal-supply ledger.
    function strategySignalWeight(address strategy) public view returns (uint256 amount) {
        address bribe = bribeFor[strategy];
        if (bribe == address(0)) return 0;
        return Bribe(bribe).totalSupply();
    }

    /// @notice Returns whole raw USDG units left at the active period's stored rate.
    function left() public view returns (uint256 reward) {
        Reward storage data = rewardData;
        if (block.timestamp >= data.periodFinish) return 0;
        return (data.periodFinish - block.timestamp) * data.rewardRate;
    }

    /// @notice Returns the complete amount represented by the current seven-day schedule.
    function getRewardForDuration() external view returns (uint256 reward) {
        return rewardData.rewardRate * DURATION;
    }

    function _updateReward(address strategy) private {
        Reward storage data = rewardData;

        data.rewardPerTokenStored = rewardPerToken();
        data.lastUpdateTime = lastTimeRewardApplicable();

        if (strategy != address(0)) {
            strategyRewards[strategy] = earned(strategy);
            strategyRewardPerTokenPaid[strategy] = data.rewardPerTokenStored;
        }
    }
}
