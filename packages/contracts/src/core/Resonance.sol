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
/// @dev Adapted from Liquid Signal Governance's Bribe rewarder. A qualifying notification checkpoints the current
///      period and restarts a seven-day stream containing the new reward plus the exact active-period remainder.
///      USDG uses six decimals while SignalGBX uses eighteen, so the cumulative reward index uses 1e36 precision.
/// @custom:version 1.0.0
contract Resonance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Fixed duration of every USDG reward period.
    uint256 public constant DURATION = 7 days;
    /// @notice Fixed-point precision for allocating six-decimal USDG across eighteen-decimal SignalGBX.
    uint256 public constant REWARD_PRECISION = 1e36;
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

    /// @notice Independent reward schedule and cumulative-index state for one token.
    struct Reward {
        uint256 periodFinish;
        uint256 remainderFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    /// @notice Reward schedule and cumulative-index state for a registered token.
    /// @dev The Bribe-shaped token-keyed ledger is retained even though Resonance permanently registers only USDG.
    mapping(address token => Reward data) public token_RewardData;
    /// @notice Whether a token is registered for Resonance rewards; permanently true only for USDG.
    mapping(address token => bool isReward) public token_IsReward;
    /// @notice Registered Resonance reward tokens; permanently contains only USDG.
    address[] public rewardTokens;

    /// @notice Strategy => token => cumulative reward-per-signal already incorporated.
    mapping(address strategy => mapping(address token => uint256 paid)) public account_Token_RewardPerTokenPaid;
    /// @notice Strategy => token => accrued whole raw reward units.
    mapping(address strategy => mapping(address token => uint256 reward)) public account_Token_Rewards;

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

    error DuplicateStrategy(address strategy);
    error FinalLiveStrategy(address strategy);
    error ForbiddenPaymentToken(address token);
    error ForbiddenRewardToken(address token);
    error InexactRevenuePayout(address receiver, uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    error InexactRevenueTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    error InsufficientSignal(address strategy, uint256 available, uint256 requested);
    error InvalidResonanceRouter(address resonanceRouter);
    error ResonanceRouterAlreadySet(address resonanceRouter);
    error RewardSmallerThanLeft(uint256 reward, uint256 left);
    error SameStrategy(address strategy);
    error StrategyAlreadyDead(address strategy);
    error StrategyNotFound(address strategy);
    error UnauthorizedRevenueSource(address caller);
    error UnauthorizedSignalSource(address caller);
    error ZeroAddress();
    error ZeroAmount();

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

        token_IsReward[address(usdg_)] = true;
        rewardTokens.push(address(usdg_));
    }

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

    /// @notice Atomically moves signal for an account from one Strategy to another through SignalGBX.
    /// @dev A killed Strategy may be the source, but only a live Strategy may receive the moved signal.
    function moveSignalFor(address account, address fromStrategy, address toStrategy, uint256 amount)
        external
        nonReentrant
        onlySignalGBX
    {
        if (account == address(0)) revert ZeroAddress();
        if (!isStrategy[fromStrategy]) revert StrategyNotFound(fromStrategy);
        if (!isStrategy[toStrategy]) revert StrategyNotFound(toStrategy);
        if (!isStrategyAlive[toStrategy]) revert StrategyAlreadyDead(toStrategy);
        if (fromStrategy == toStrategy) revert SameStrategy(fromStrategy);
        if (amount == 0) revert ZeroAmount();

        Bribe sourceBribe = Bribe(bribeFor[fromStrategy]);
        uint256 allocated = sourceBribe.balanceOf(account);
        if (amount > allocated) revert InsufficientSignal(fromStrategy, allocated, amount);

        _updateReward(fromStrategy);
        _updateReward(toStrategy);

        if (!isStrategyAlive[fromStrategy]) totalSignalWeight += amount;
        sourceBribe.withdraw(amount, account);
        Bribe(bribeFor[toStrategy]).deposit(amount, account);

        emit SignalRemoved(account, fromStrategy, amount);
        emit SignalAdded(account, toStrategy, amount);
    }

    /// @notice Pulls qualifying USDG from ResonanceRouter and restarts the seven-day reward period.
    /// @dev During an active period, the new reward must be at least the exact reward left in that period. The restarted
    ///      schedule contains the new reward plus that remainder. Raw-unit division remainder is emitted during the
    ///      first seconds of the new period, so every scheduled USDG unit is represented.
    function notifyRevenue(uint256 reward) external nonReentrant onlyResonanceRouter updateReward(address(0)) {
        if (reward == 0) revert ZeroAmount();

        address rewardToken = address(usdg);
        uint256 remaining = left(rewardToken);
        if (reward < remaining) revert RewardSmallerThanLeft(reward, remaining);

        _pullRewardExact(usdg, reward);
        _restartRewardPeriod(rewardToken, reward, remaining);

        emit RevenueNotified(msg.sender, reward);
    }

    /// @notice Pays one Strategy's accrued USDG. Anyone may trigger payment to the fixed entitled Strategy.
    function distribute(address strategy) public nonReentrant updateReward(strategy) returns (uint256 amount) {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);

        address rewardToken = address(usdg);
        amount = account_Token_Rewards[strategy][rewardToken];
        if (amount == 0) return 0;

        account_Token_Rewards[strategy][rewardToken] = 0;
        _transferRevenueExact(strategy, amount);

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
        account_Token_RewardPerTokenPaid[strategyAddress][address(usdg)] =
        token_RewardData[address(usdg)].rewardPerTokenStored;

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
    function lastTimeRewardApplicable(address rewardToken) public view returns (uint256 timestamp) {
        uint256 finish = token_RewardData[rewardToken].periodFinish;
        return block.timestamp < finish ? block.timestamp : finish;
    }

    /// @notice Returns cumulative scaled USDG allocated per unit of active SignalGBX.
    function rewardPerToken(address rewardToken) public view returns (uint256 accumulatedReward) {
        Reward storage data = token_RewardData[rewardToken];
        accumulatedReward = data.rewardPerTokenStored;
        if (totalSignalWeight == 0) return accumulatedReward;

        uint256 applicable = lastTimeRewardApplicable(rewardToken);
        uint256 lastUpdate = data.lastUpdateTime;
        if (applicable <= lastUpdate) return accumulatedReward;

        uint256 emitted = _emissionBetween(rewardToken, lastUpdate, applicable);
        return accumulatedReward + Math.mulDiv(emitted, REWARD_PRECISION, totalSignalWeight);
    }

    /// @notice Returns one Strategy's stored plus elapsed USDG reward.
    function earned(address strategy, address rewardToken) public view returns (uint256 reward) {
        uint256 delta = rewardPerToken(rewardToken) - account_Token_RewardPerTokenPaid[strategy][rewardToken];
        uint256 activeBalance = isStrategyAlive[strategy] ? strategySignalWeight(strategy) : 0;
        return account_Token_Rewards[strategy][rewardToken] + Math.mulDiv(activeBalance, delta, REWARD_PRECISION);
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

    /// @notice Returns exact raw reward units left in the active period.
    function left(address rewardToken) public view returns (uint256 reward) {
        Reward storage data = token_RewardData[rewardToken];
        if (block.timestamp >= data.periodFinish) return 0;
        return _emissionBetween(rewardToken, block.timestamp, data.periodFinish);
    }

    /// @notice Returns the complete amount represented by the current seven-day schedule.
    function getRewardForDuration(address rewardToken) external view returns (uint256 reward) {
        Reward storage data = token_RewardData[rewardToken];
        if (data.periodFinish == 0) return 0;

        uint256 startedAt = data.periodFinish - DURATION;
        uint256 remainder = data.remainderFinish - startedAt;
        return data.rewardRate * DURATION + remainder;
    }

    /// @notice Returns the permanently single-element reward-token registry.
    function getRewardTokens() external view returns (address[] memory tokens) {
        return rewardTokens;
    }

    function _updateReward(address strategy) private {
        address rewardToken = address(usdg);
        Reward storage data = token_RewardData[rewardToken];

        data.rewardPerTokenStored = rewardPerToken(rewardToken);
        data.lastUpdateTime = lastTimeRewardApplicable(rewardToken);

        if (strategy != address(0)) {
            account_Token_Rewards[strategy][rewardToken] = earned(strategy, rewardToken);
            account_Token_RewardPerTokenPaid[strategy][rewardToken] = data.rewardPerTokenStored;
        }
    }

    function _pullRewardExact(IERC20 token, uint256 reward) private {
        uint256 senderBefore = token.balanceOf(msg.sender);
        uint256 receiverBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), reward);
        uint256 senderDebit = senderBefore - token.balanceOf(msg.sender);
        uint256 receiverCredit = token.balanceOf(address(this)) - receiverBefore;
        if (senderDebit != reward || receiverCredit != reward) {
            revert InexactRevenueTransfer(reward, senderDebit, receiverCredit);
        }
    }

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

    function _restartRewardPeriod(address rewardToken, uint256 reward, uint256 remaining) private {
        uint256 scheduled = reward + remaining;
        uint256 rate = scheduled / DURATION;
        uint256 rateRemainder = scheduled % DURATION;
        uint256 startedAt = block.timestamp;

        Reward storage data = token_RewardData[rewardToken];
        data.rewardRate = rate;
        data.lastUpdateTime = startedAt;
        data.periodFinish = startedAt + DURATION;
        data.remainderFinish = startedAt + rateRemainder;
    }

    /// @notice Returns exact raw reward units emitted over `[from, to)`.
    function _emissionBetween(address rewardToken, uint256 from, uint256 to) private view returns (uint256 amount) {
        if (to <= from) return 0;

        Reward storage data = token_RewardData[rewardToken];
        amount = (to - from) * data.rewardRate;

        uint256 remainderFinish = data.remainderFinish;
        if (from < remainderFinish) {
            uint256 remainderEnd = to < remainderFinish ? to : remainderFinish;
            amount += remainderEnd - from;
        }
    }
}
