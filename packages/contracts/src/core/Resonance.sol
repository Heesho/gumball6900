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

/// @title Resonance
/// @author GUM BALL 6900
/// @notice Lets SignalGBX holders direct USDG revenue to Strategies and receive the associated payment-token rewards.
/// @dev Adapted from Liquid Signal Governance. Signaling is intentionally unrestricted: absolute allocations can be
///      increased or decreased at any time, and unallocated SignalGBX can always be unstaked immediately.
contract Resonance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Fixed-point precision for indexed USDG revenue.
    uint256 public constant INDEX_PRECISION = 1e18;
    /// @notice Basis-point denominator for acquisition reward shares.
    uint256 public constant BPS_SCALE = 10_000;
    /// @notice Initial 10% share of acquisition payments streamed to signalers.
    uint256 public constant DEFAULT_BRIBE_BPS = 1_000;
    /// @notice Maximum 50% share governance may stream to signalers.
    uint256 public constant MAX_BRIBE_BPS = 5_000;

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
    /// @notice Share of acquisition payments streamed to signalers, expressed in basis points.
    uint256 public bribeBps = DEFAULT_BRIBE_BPS;
    /// @notice Total SignalGBX weight currently allocated across all Strategies.
    uint256 public totalSignalWeight;
    /// @notice Cumulative USDG revenue per unit of signal weight.
    uint256 public revenueIndex;

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

    /// @notice Signal weight an account assigned to a Strategy.
    mapping(address account => mapping(address strategy => uint256 signals)) public accountSignals;
    mapping(address account => address[] strategies) private _accountStrategies;
    mapping(address account => mapping(address strategy => uint256 indexPlusOne)) private _accountStrategyIndex;
    /// @notice Total signal weight currently allocated by an account.
    mapping(address account => uint256 signalWeight) public accountSignalWeight;

    /// @notice Emitted when governance updates the acquisition signal-reward share.
    /// @param previousBps Previous share in basis points.
    /// @param newBps New share in basis points.
    event BribeBpsSet(uint256 previousBps, uint256 newBps);
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
    /// @notice Emitted when ResonanceRouter supplies newly routed USDG.
    /// @param resonanceRouter Authorized router that supplied USDG.
    /// @param amount Amount received and indexed.
    event RevenueNotified(address indexed resonanceRouter, uint256 amount);
    /// @notice Emitted when governance creates a complete Strategy reward graph.
    /// @param strategy Newly deployed Strategy.
    /// @param bribe Bribe paired with the Strategy.
    /// @param bribeRouter Router paired with the Strategy and Bribe.
    /// @param paymentToken Asset accepted by the Strategy and streamed by its Bribe.
    /// @param kind Whether the Strategy acquires an asset or performs GBX buybacks.
    event StrategyAdded(
        address indexed strategy,
        address indexed bribe,
        address indexed bribeRouter,
        address paymentToken,
        Strategy.Kind kind
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

    error BribeBpsAboveMaximum(uint256 requested);
    error DuplicateStrategy(address strategy);
    error InsufficientSignal(address strategy, uint256 available, uint256 requested);
    error InsufficientUnallocatedSignal(uint256 available, uint256 requested);
    error InexactRevenueTransfer(uint256 expected, uint256 received);
    error LengthMismatch();
    error StrategyAlreadyDead(address strategy);
    error StrategyNotFound(address strategy);
    error ResonanceRouterAlreadySet(address resonanceRouter);
    error UnauthorizedRevenueSource(address caller);
    error ZeroAddress();
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

    /// @notice Pulls USDG from ResonanceRouter and adds it to the global revenue index.
    /// @param amount Amount of USDG to pull and index.
    function notifyRevenue(uint256 amount) external nonReentrant {
        if (msg.sender != resonanceRouter) revert UnauthorizedRevenueSource(msg.sender);
        if (amount == 0) revert ZeroAmount();

        uint256 balanceBefore = usdg.balanceOf(address(this));
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdg.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert InexactRevenueTransfer(amount, received);

        emit RevenueNotified(msg.sender, amount);

        // With no allocations there is no future signaler claim: revenue becomes Fund backing immediately.
        if (totalSignalWeight == 0) {
            usdg.safeTransfer(fund, amount);
            return;
        }

        uint256 indexDelta = Math.mulDiv(amount, INDEX_PRECISION, totalSignalWeight);
        if (indexDelta != 0) revenueIndex += indexDelta;
    }

    /// @notice Distributes currently claimable revenue to every Strategy.
    function distributeAll() external {
        distributeRange(0, _strategies.length);
    }

    /// @notice Updates one Strategy's stored revenue without transferring it.
    /// @param strategy Strategy whose index checkpoint should advance.
    function updateStrategy(address strategy) external {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        _updateStrategy(strategy);
    }

    /// @notice Binds the sole ResonanceRouter revenue source once during deployment.
    /// @param resonanceRouter_ ResonanceRouter address to bind permanently.
    function setResonanceRouter(address resonanceRouter_) external onlyOwner {
        if (resonanceRouter != address(0)) revert ResonanceRouterAlreadySet(resonanceRouter);
        if (resonanceRouter_ == address(0) || resonanceRouter_.code.length == 0) revert ZeroAddress();

        resonanceRouter = resonanceRouter_;

        emit ResonanceRouterSet(resonanceRouter_);
    }

    /// @notice Sets the acquisition payment share streamed to signalers.
    /// @param newBribeBps New share in basis points, capped by `MAX_BRIBE_BPS`.
    function setBribeBps(uint256 newBribeBps) external onlyOwner {
        if (newBribeBps > MAX_BRIBE_BPS) revert BribeBpsAboveMaximum(newBribeBps);

        uint256 previousBps = bribeBps;
        bribeBps = newBribeBps;

        emit BribeBpsSet(previousBps, newBribeBps);
    }

    /// @notice Creates a Strategy, its Bribe, and its BribeRouter as one Resonance-controlled graph.
    /// @param paymentToken Asset buyers pay to fill the Strategy.
    /// @param kind Whether the Strategy acquires an asset or performs GBX buybacks.
    /// @param config Immutable auction configuration.
    /// @return strategyAddress Newly deployed Strategy.
    /// @return bribeAddress Bribe paired with the Strategy.
    /// @return bribeRouterAddress BribeRouter paired with the Strategy and Bribe.
    function addStrategy(IERC20 paymentToken, Strategy.Kind kind, Strategy.Config calldata config)
        external
        onlyOwner
        returns (address strategyAddress, address bribeAddress, address bribeRouterAddress)
    {
        if (address(paymentToken) == address(0) || address(paymentToken).code.length == 0) revert ZeroAddress();

        Bribe bribe = bribeFactory.createBribe();
        bribe.addRewardToken(address(paymentToken));

        (Strategy strategy, BribeRouter bribeRouter) =
            strategyFactory.createStrategy(usdg, paymentToken, fund, bribe, kind, config);

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

        emit StrategyAdded(strategyAddress, bribeAddress, bribeRouterAddress, address(paymentToken), kind);
    }

    /// @notice Stops a Strategy from receiving future USDG; its already indexed revenue is returned to Fund.
    /// @dev Existing signal weights remain until their owners remove them incrementally. Their dead-Strategy revenue
    ///      share is routed to Fund whenever that Strategy's index is updated.
    /// @param strategy Strategy to disable permanently.
    function killStrategy(address strategy) external onlyOwner nonReentrant {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);
        if (!isStrategyAlive[strategy]) revert StrategyAlreadyDead(strategy);

        _updateStrategy(strategy);

        uint256 amount = claimableRevenue[strategy];
        if (amount != 0) {
            claimableRevenue[strategy] = 0;
            usdg.safeTransfer(fund, amount);
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
        uint256 weight = strategySignalWeight[strategy];
        if (weight == 0) return 0;
        return Math.mulDiv(weight, revenueIndex - strategyRevenueIndex[strategy], INDEX_PRECISION);
    }

    /// @notice Transfers a Strategy's indexed USDG allocation to that Strategy.
    /// @param strategy Strategy whose indexed revenue should be transferred.
    /// @return amount Amount of USDG distributed.
    function distribute(address strategy) public nonReentrant returns (uint256 amount) {
        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);

        _updateStrategy(strategy);
        amount = claimableRevenue[strategy];
        if (amount == 0) return 0;

        claimableRevenue[strategy] = 0;
        usdg.safeTransfer(strategy, amount);

        emit RevenueDistributed(msg.sender, strategy, amount);
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

        _updateStrategy(strategy);

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

        _updateStrategy(strategy);

        uint256 remainingSignal = previousSignal - amount;
        accountSignals[account][strategy] = remainingSignal;
        accountSignalWeight[account] -= amount;
        strategySignalWeight[strategy] -= amount;
        totalSignalWeight -= amount;
        Bribe(bribeFor[strategy]).withdraw(amount, account);

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
    /// @dev Records live-Strategy revenue as claimable and routes dead-Strategy revenue to Fund.
    /// @param strategy Strategy whose revenue checkpoint should advance.
    function _updateStrategy(address strategy) private {
        uint256 currentIndex = revenueIndex;
        uint256 previousIndex = strategyRevenueIndex[strategy];
        strategyRevenueIndex[strategy] = currentIndex;

        uint256 weight = strategySignalWeight[strategy];
        if (weight == 0 || currentIndex == previousIndex) return;

        uint256 amount = Math.mulDiv(weight, currentIndex - previousIndex, INDEX_PRECISION);
        if (isStrategyAlive[strategy]) {
            claimableRevenue[strategy] += amount;
        } else if (amount != 0) {
            usdg.safeTransfer(fund, amount);
        }
    }
}
