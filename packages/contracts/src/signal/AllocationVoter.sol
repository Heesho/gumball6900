// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IManagerRewards } from "../interfaces/IManagerRewards.sol";

/// @title AllocationVoter
/// @notice Persistent, delayed liquid signaling and virtual USDG budget accounting for approved strategies.
/// @dev This contract never takes custody of USDG. Physical funds remain in GumBallVault until a valid strategy fill.
contract AllocationVoter is IAllocationVoter, ReentrancyGuard {
    /// @notice Fixed-point precision used by global allocation and strategy remainder accounting.
    uint256 public constant INDEX_PRECISION = 1e27;
    /// @notice Delay applied only to new or increased signal weight.
    uint256 public constant SIGNAL_ACTIVATION_DELAY = 1 days;
    /// @notice Maximum unique strategies in one user's active or pending allocation.
    uint256 public constant MAX_USER_STRATEGIES = 16;
    uint256 private constant REVENUE_SOURCE_COUNT = 4;

    enum RevenueSource {
        GenesisBootstrap,
        MiningPool,
        RevenueRouter,
        LiquidityManager
    }

    error AllocationVoter__AlreadyConfigured();
    error AllocationVoter__DependenciesNotConfigured();
    error AllocationVoter__DuplicateRevenueSource(address source);
    error AllocationVoter__DuplicateStrategy(address strategy);
    error AllocationVoter__InsolventRevenueNotification(uint256 notifiedAfter, uint256 physicalBalance);
    error AllocationVoter__InvalidArrayLength();
    error AllocationVoter__NoPendingSignals(address user);
    error AllocationVoter__NotEmergencyGuardian(address caller);
    error AllocationVoter__NotGuardianOrTimelock(address caller);
    error AllocationVoter__NotProtocolTimelock(address caller);
    error AllocationVoter__NotStakedGBX(address caller);
    error AllocationVoter__NotVault(address caller);
    error AllocationVoter__PendingSignalRoundsToZero(address strategy);
    error AllocationVoter__StrategyAlreadyDisabled(address strategy);
    error AllocationVoter__StrategyBudgetTooLow(address strategy, uint256 requested, uint256 available);
    error AllocationVoter__StrategyStillLive(address strategy);
    error AllocationVoter__UnauthorizedInitializer(address caller);
    error AllocationVoter__UnauthorizedRevenueSource(address caller, RevenueSource source);
    error AllocationVoter__UnregisteredOrInactiveStrategy(address strategy);
    error AllocationVoter__UnstakeExceedsBalance(uint256 amount, uint256 balance);
    error AllocationVoter__ZeroAddress();
    error AllocationVoter__ZeroAmount();
    error AllocationVoter__ZeroSignalWeight();
    error AllocationVoter__ZeroStakedBalance();

    event AllocationVoter__DependenciesConfigured(address indexed vault, address indexed stakedGBX);
    event AllocationVoter__SignalActivationPauseSet(bool paused);
    event AllocationVoter__PendingSignalsCancelled(address indexed user);
    event AllocationVoter__RevenueNotified(
        address indexed source, RevenueSource indexed sourceType, uint256 amount, uint256 indexDelta, uint256 remainder
    );
    event AllocationVoter__SignalsActivated(address indexed user, uint256 activatedAt);
    event AllocationVoter__SignalsPending(address indexed user, uint256 activationTime);
    event AllocationVoter__SignalsReset(address indexed user);
    event AllocationVoter__StrategyBudgetCheckpointed(address indexed strategy, uint256 budget, uint256 globalIndex);
    event AllocationVoter__StrategyBudgetConsumed(address indexed strategy, uint256 amount, uint256 budgetRemaining);
    event AllocationVoter__StrategyBudgetScaled(
        address indexed strategy, uint256 budgetAfter, uint256 scaledRemainderAfter
    );
    event AllocationVoter__StrategyDisabled(
        address indexed strategy, uint64 newGeneration, uint256 budgetReturnedToIdle
    );
    event AllocationVoter__StrategyReactivated(address indexed strategy, uint64 generation);
    event AllocationVoter__StrategyWeightUpdated(address indexed strategy, uint256 previousWeight, uint256 newWeight);
    event AllocationVoter__UserWeightUpdated(
        address indexed user, address indexed strategy, uint256 previousWeight, uint256 newWeight
    );
    event AllocationVoter__VaultAccountingScaled(uint256 shares, uint256 supplyBefore, uint256 accountedVaultUSDGAfter);

    /// @notice Canonical USDG whose physical vault balance backs all virtual allocation accounting.
    IERC20 public immutable USDG;
    /// @notice Canonical bounded registry used to validate live strategies.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Delayed authority permitted to reactivate strategies and resume signal activations.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Stop-only authority permitted to pause activations and disable dead strategy weight.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice One-use prelaunch account permitted to close dependency cycles.
    address public immutable DEPENDENCY_INITIALIZER;

    /// @notice Canonical GumBallVault physically holding every accounted USDG unit.
    address public vault;
    /// @notice Canonical sGBX contract permitted to checkpoint stake balance changes.
    address public stakedGBX;
    /// @notice Whether the vault, sGBX, and four revenue sources have been bound exactly once.
    bool public dependenciesConfigured;
    /// @notice Whether matured signal increases are temporarily prevented from activating.
    bool public signalActivationsPaused;

    /// @notice Canonical authorized sender for each enumerated revenue source.
    mapping(RevenueSource sourceType => address source) public revenueSourceAddress;

    /// @notice Cumulative USDG allocation per unit of live signal weight, scaled by `INDEX_PRECISION`.
    uint256 public globalAllocationIndex;
    /// @notice Scaled division remainder carried across global revenue notifications.
    uint256 public allocationRemainder;
    /// @notice Raw accounted USDG not assigned because no live weight existed when it arrived.
    uint256 public idleUSDG;
    /// @notice Scaled fractional remainder attached to idle USDG accounting.
    uint256 public idleScaledRemainder;
    /// @notice Raw USDG balance at the vault that remains assigned to budgets or idle accounting.
    uint256 public accountedVaultUSDG;
    /// @notice Aggregate current-generation signal weight across all live strategies.
    uint256 public totalLiveWeight;

    /// @notice Last global allocation index materialized for each strategy.
    mapping(address strategy => uint256 index) public strategyIndex;
    /// @notice Materialized raw virtual USDG budget for each strategy.
    mapping(address strategy => uint256 budget) public strategyBudget;
    /// @notice Scaled fractional budget remainder carried for each strategy.
    mapping(address strategy => uint256 scaledRemainder) public strategyScaledRemainder;
    /// @notice Aggregate current-generation active sGBX weight assigned to each strategy.
    mapping(address strategy => uint256 weight) public strategyWeight;
    /// @notice Whether a strategy has been removed from allocation denominators.
    mapping(address strategy => bool disabled) public strategyDisabled;
    /// @notice Monotonic generation invalidating all stale user weights after strategy disable.
    mapping(address strategy => uint64 generation) public strategyGeneration;

    mapping(address user => address[] strategies) private _activeStrategies;
    mapping(address user => mapping(address strategy => uint256 weight)) private _storedActiveWeight;
    mapping(address user => mapping(address strategy => uint64 generation)) private _activeGeneration;

    mapping(address user => address[] strategies) private _pendingStrategies;
    mapping(address user => mapping(address strategy => uint256 weight)) private _storedPendingWeight;
    mapping(address user => mapping(address strategy => uint64 generation)) private _pendingGeneration;
    /// @notice Earliest timestamp when each user's queued signal increases may activate.
    mapping(address user => uint64 activationTime) public pendingActivationTime;

    modifier onlyConfigured() {
        if (!dependenciesConfigured) revert AllocationVoter__DependenciesNotConfigured();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert AllocationVoter__NotVault(msg.sender);
        _;
    }

    modifier onlyStakedGBX() {
        if (msg.sender != stakedGBX) revert AllocationVoter__NotStakedGBX(msg.sender);
        _;
    }

    /// @notice Deploys voter accounting with immutable canonical token, registry, and maintenance authorities.
    /// @param usdG_ The canonical USDG token whose vault balance backs virtual budgets.
    /// @param assetRegistry_ The canonical bounded registry of live strategies.
    /// @param protocolTimelock_ The purpose-limited delayed maintenance authority.
    /// @param emergencyGuardian_ The stop-only emergency authority.
    /// @param dependencyInitializer_ The one-use account permitted to close construction cycles.
    constructor(
        address usdG_,
        address assetRegistry_,
        address protocolTimelock_,
        address emergencyGuardian_,
        address dependencyInitializer_
    ) {
        if (
            usdG_ == address(0) || assetRegistry_ == address(0) || protocolTimelock_ == address(0)
                || emergencyGuardian_ == address(0) || dependencyInitializer_ == address(0)
        ) revert AllocationVoter__ZeroAddress();

        USDG = IERC20(usdG_);
        ASSET_REGISTRY = IAssetRegistry(assetRegistry_);
        PROTOCOL_TIMELOCK = protocolTimelock_;
        EMERGENCY_GUARDIAN = emergencyGuardian_;
        DEPENDENCY_INITIALIZER = dependencyInitializer_;
    }

    /// @notice Resolves deployment-order circularity exactly once and fixes all authorized revenue sources.
    /// @param vault_ The canonical GumBallVault that physically custodies USDG.
    /// @param stakedGBX_ The canonical sGBX contract permitted to checkpoint stake changes.
    /// @param revenueSources Canonical senders in `RevenueSource` enum order.
    function initializeDependencies(address vault_, address stakedGBX_, address[4] calldata revenueSources) external {
        if (msg.sender != DEPENDENCY_INITIALIZER) revert AllocationVoter__UnauthorizedInitializer(msg.sender);
        if (dependenciesConfigured) revert AllocationVoter__AlreadyConfigured();
        if (vault_ == address(0) || stakedGBX_ == address(0)) revert AllocationVoter__ZeroAddress();
        if (vault_.code.length == 0 || stakedGBX_.code.length == 0) revert AllocationVoter__ZeroAddress();

        for (uint256 index; index < REVENUE_SOURCE_COUNT; ++index) {
            address source = revenueSources[index];
            if (source == address(0) || source.code.length == 0) revert AllocationVoter__ZeroAddress();
            for (uint256 prior; prior < index; ++prior) {
                if (revenueSources[prior] == source) revert AllocationVoter__DuplicateRevenueSource(source);
            }
            revenueSourceAddress[RevenueSource(index)] = source;
        }

        vault = vault_;
        stakedGBX = stakedGBX_;
        dependenciesConfigured = true;

        emit AllocationVoter__DependenciesConfigured(vault_, stakedGBX_);
    }

    /// @notice Replaces the caller's desired relative allocation, delaying only new or increased weight.
    /// @param strategies The unique, active strategy addresses in the caller's desired allocation.
    /// @param relativeWeights Positive relative weights normalized across the caller's complete sGBX balance.
    function signal(address[] calldata strategies, uint256[] calldata relativeWeights)
        external
        nonReentrant
        onlyConfigured
    {
        uint256 length = strategies.length;
        if (length == 0 || length > MAX_USER_STRATEGIES || length != relativeWeights.length) {
            revert AllocationVoter__InvalidArrayLength();
        }

        _checkpointMatured(msg.sender);
        _pruneStaleActive(msg.sender);

        uint256 stakedBalance = IERC20(stakedGBX).balanceOf(msg.sender);
        if (stakedBalance == 0) revert AllocationVoter__ZeroStakedBalance();

        uint256 totalRelativeWeight;
        for (uint256 index; index < length; ++index) {
            address strategy = strategies[index];
            if (!_isSignalable(strategy)) revert AllocationVoter__UnregisteredOrInactiveStrategy(strategy);
            if (relativeWeights[index] == 0) revert AllocationVoter__ZeroSignalWeight();
            totalRelativeWeight += relativeWeights[index];
            for (uint256 prior; prior < index; ++prior) {
                if (strategies[prior] == strategy) revert AllocationVoter__DuplicateStrategy(strategy);
            }
        }

        _checkpointAllUserRewards(msg.sender);
        _clearPending(msg.sender);

        uint256[] memory desiredWeights = new uint256[](length);
        uint256 assigned;
        for (uint256 index; index < length; ++index) {
            uint256 desired = index + 1 == length
                ? stakedBalance - assigned
                : Math.mulDiv(stakedBalance, relativeWeights[index], totalRelativeWeight);
            if (desired == 0) revert AllocationVoter__PendingSignalRoundsToZero(strategies[index]);
            desiredWeights[index] = desired;
            assigned += desired;
        }

        address[] memory current = _activeStrategies[msg.sender];
        for (uint256 index; index < current.length; ++index) {
            address strategy = current[index];
            uint256 oldWeight = _effectiveActiveWeight(msg.sender, strategy);
            uint256 desiredWeight = _desiredWeight(strategy, strategies, desiredWeights);
            if (desiredWeight < oldWeight) _setActiveWeight(msg.sender, strategy, desiredWeight);
        }

        bool hasPending;
        for (uint256 index; index < length; ++index) {
            address strategy = strategies[index];
            uint256 active = _effectiveActiveWeight(msg.sender, strategy);
            if (desiredWeights[index] > active) {
                _pendingStrategies[msg.sender].push(strategy);
                _storedPendingWeight[msg.sender][strategy] = desiredWeights[index] - active;
                _pendingGeneration[msg.sender][strategy] = strategyGeneration[strategy];
                hasPending = true;
            }
        }

        if (hasPending) {
            uint64 activationTime = SafeCast.toUint64(block.timestamp + SIGNAL_ACTIVATION_DELAY);
            pendingActivationTime[msg.sender] = activationTime;
            emit AllocationVoter__SignalsPending(msg.sender, activationTime);
        }
    }

    /// @notice Permissionlessly activates a user's matured pending signal increases.
    /// @param user The account whose mature signals and manager rewards are checkpointed.
    function checkpointUser(address user) external nonReentrant onlyConfigured {
        _checkpointMatured(user);
        _pruneStaleActive(user);
        _checkpointAllUserRewards(user);
    }

    /// @notice Immediately pauses only matured signal increases; reductions, resets, and unstaking remain live.
    function pauseSignalActivations() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert AllocationVoter__NotEmergencyGuardian(msg.sender);
        signalActivationsPaused = true;
        emit AllocationVoter__SignalActivationPauseSet(true);
    }

    /// @notice Reopens delayed signal activation only through the protocol timelock.
    function unpauseSignalActivations() external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AllocationVoter__NotProtocolTimelock(msg.sender);
        signalActivationsPaused = false;
        emit AllocationVoter__SignalActivationPauseSet(false);
    }

    /// @notice Cancels every pending increase before a permissionless activation transaction executes.
    function cancelPendingSignals() external nonReentrant onlyConfigured {
        if (_pendingStrategies[msg.sender].length == 0) revert AllocationVoter__NoPendingSignals(msg.sender);
        _clearPending(msg.sender);
        emit AllocationVoter__PendingSignalsCancelled(msg.sender);
    }

    /// @notice Immediately removes all active and pending signals after checkpointing manager rewards.
    function resetSignals() external nonReentrant onlyConfigured {
        _checkpointMatured(msg.sender);
        _pruneStaleActive(msg.sender);
        _checkpointAllUserRewards(msg.sender);
        _clearPending(msg.sender);

        address[] memory current = _activeStrategies[msg.sender];
        for (uint256 index; index < current.length; ++index) {
            _setActiveWeight(msg.sender, current[index], 0);
        }

        emit AllocationVoter__SignalsReset(msg.sender);
    }

    /// @inheritdoc IAllocationVoter
    function onStake(address user) external nonReentrant onlyConfigured onlyStakedGBX {
        _checkpointMatured(user);
        _pruneStaleActive(user);
        _checkpointAllUserRewards(user);
    }

    /// @inheritdoc IAllocationVoter
    function onUnstake(address user, uint256 amount) external nonReentrant onlyConfigured onlyStakedGBX {
        if (amount == 0) revert AllocationVoter__ZeroAmount();

        uint256 balanceBefore = IERC20(stakedGBX).balanceOf(user);
        if (amount > balanceBefore) revert AllocationVoter__UnstakeExceedsBalance(amount, balanceBefore);

        _checkpointMatured(user);
        _pruneStaleActive(user);
        _pruneStalePending(user);

        uint256 remainingBalance = balanceBefore - amount;
        uint256 activeTotal = activeWeightTotal(user);
        uint256 pendingTotal = pendingWeightTotal(user);
        uint256 assigned = activeTotal + pendingTotal;
        if (assigned <= remainingBalance) return;

        _checkpointAllUserRewards(user);
        uint256 excess = assigned - remainingBalance;

        if (pendingTotal != 0) {
            uint256 pendingReduction = Math.min(excess, pendingTotal);
            _scalePending(user, pendingTotal - pendingReduction, pendingTotal);
            excess -= pendingReduction;
        }

        if (excess != 0) {
            activeTotal = activeWeightTotal(user);
            _scaleActive(user, activeTotal - excess, activeTotal);
        }
    }

    /// @notice Accounts newly deposited USDG using only current effective signal weights.
    /// @param amount The raw USDG balance increase already observed at GumBallVault.
    /// @param source The source class whose prebound sender must match the caller.
    function notifyRevenue(uint256 amount, RevenueSource source) external nonReentrant onlyConfigured {
        address expectedSource = revenueSourceAddress[source];
        if (msg.sender != expectedSource) {
            revert AllocationVoter__UnauthorizedRevenueSource(msg.sender, source);
        }
        if (amount == 0) revert AllocationVoter__ZeroAmount();

        uint256 notifiedAfter = accountedVaultUSDG + amount;
        uint256 physicalBalance = USDG.balanceOf(vault);
        if (notifiedAfter > physicalBalance) {
            revert AllocationVoter__InsolventRevenueNotification(notifiedAfter, physicalBalance);
        }
        accountedVaultUSDG = notifiedAfter;

        uint256 indexDelta;
        if (totalLiveWeight == 0) {
            idleUSDG += amount;
            _creditIdleScaled(allocationRemainder);
            allocationRemainder = 0;
        } else {
            indexDelta = Math.mulDiv(amount, INDEX_PRECISION, totalLiveWeight);
            uint256 combinedRemainder = mulmod(amount, INDEX_PRECISION, totalLiveWeight) + allocationRemainder;
            indexDelta += combinedRemainder / totalLiveWeight;
            allocationRemainder = combinedRemainder % totalLiveWeight;
            globalAllocationIndex += indexDelta;
        }

        emit AllocationVoter__RevenueNotified(msg.sender, source, amount, indexDelta, allocationRemainder);
    }

    /// @inheritdoc IAllocationVoter
    function consumeStrategyBudget(address strategy, uint256 amount) external nonReentrant onlyConfigured onlyVault {
        if (amount == 0) revert AllocationVoter__ZeroAmount();
        _checkpointStrategyBudget(strategy);
        uint256 available = strategyBudget[strategy];
        if (amount > available) revert AllocationVoter__StrategyBudgetTooLow(strategy, amount, available);

        strategyBudget[strategy] = available - amount;
        accountedVaultUSDG -= amount;
        emit AllocationVoter__StrategyBudgetConsumed(strategy, amount, available - amount);
    }

    /// @inheritdoc IAllocationVoter
    function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore)
        external
        nonReentrant
        onlyConfigured
        onlyVault
    {
        if (shares == 0 || supplyBefore == 0 || shares > supplyBefore) {
            revert AllocationVoter__ZeroAmount();
        }
        uint256 remainingSupply = supplyBefore - shares;
        uint256 count = ASSET_REGISTRY.strategyCount();

        for (uint256 index; index < count; ++index) {
            address strategy = ASSET_REGISTRY.strategyAt(index);
            _checkpointStrategyBudget(strategy);
            (strategyBudget[strategy], strategyScaledRemainder[strategy]) = _scaleWholeAndRemainder(
                strategyBudget[strategy], strategyScaledRemainder[strategy], remainingSupply, supplyBefore
            );
            emit AllocationVoter__StrategyBudgetScaled(
                strategy, strategyBudget[strategy], strategyScaledRemainder[strategy]
            );
        }

        allocationRemainder = Math.mulDiv(allocationRemainder, remainingSupply, supplyBefore);
        (idleUSDG, idleScaledRemainder) =
            _scaleWholeAndRemainder(idleUSDG, idleScaledRemainder, remainingSupply, supplyBefore);
        accountedVaultUSDG = Math.mulDiv(accountedVaultUSDG, remainingSupply, supplyBefore);

        emit AllocationVoter__VaultAccountingScaled(shares, supplyBefore, accountedVaultUSDG);
    }

    /// @notice Removes a registry-disabled strategy from all allocation denominators without iterating over users.
    /// @param strategy The registered strategy already disabled in AssetRegistry.
    function disableStrategy(address strategy) external nonReentrant onlyConfigured {
        if (msg.sender != EMERGENCY_GUARDIAN && msg.sender != PROTOCOL_TIMELOCK) {
            revert AllocationVoter__NotGuardianOrTimelock(msg.sender);
        }
        if (strategyDisabled[strategy]) revert AllocationVoter__StrategyAlreadyDisabled(strategy);
        if (ASSET_REGISTRY.isLiveStrategy(strategy)) revert AllocationVoter__StrategyStillLive(strategy);

        _checkpointStrategyBudget(strategy);
        uint256 oldWeight = strategyWeight[strategy];
        uint64 nextGeneration = strategyGeneration[strategy] + 1;
        address token = ASSET_REGISTRY.tokenForStrategy(strategy);
        if (token != address(0)) {
            address rewards = ASSET_REGISTRY.configFor(token).rewards;
            if (rewards != address(0)) IManagerRewards(rewards).advanceGeneration(nextGeneration);
        }
        if (oldWeight != 0) {
            _settleAllocationRemainderToIdle();
            totalLiveWeight -= oldWeight;
        }
        strategyWeight[strategy] = 0;
        strategyDisabled[strategy] = true;
        strategyGeneration[strategy] = nextGeneration;

        uint256 returnedBudget = strategyBudget[strategy];
        uint256 returnedScaledRemainder = strategyScaledRemainder[strategy];
        strategyBudget[strategy] = 0;
        strategyScaledRemainder[strategy] = 0;
        idleUSDG += returnedBudget;
        _creditIdleScaled(returnedScaledRemainder);
        if (totalLiveWeight == 0) {
            _creditIdleScaled(allocationRemainder);
            allocationRemainder = 0;
        }

        emit AllocationVoter__StrategyDisabled(strategy, nextGeneration, returnedBudget);
    }

    /// @notice Allows fresh signals after the timelock re-enables a reviewed strategy; stale user weights never revive.
    /// @param strategy The registered live strategy whose voter generation remains reset.
    function reactivateStrategy(address strategy) external onlyConfigured {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AllocationVoter__NotProtocolTimelock(msg.sender);
        if (!strategyDisabled[strategy]) revert AllocationVoter__UnregisteredOrInactiveStrategy(strategy);
        if (!ASSET_REGISTRY.isLiveStrategy(strategy)) revert AllocationVoter__UnregisteredOrInactiveStrategy(strategy);

        strategyDisabled[strategy] = false;
        strategyIndex[strategy] = globalAllocationIndex;
        emit AllocationVoter__StrategyReactivated(strategy, strategyGeneration[strategy]);
    }

    /// @notice Checkpoints lazy allocation for one strategy.
    /// @param strategy The registered strategy whose global allocation index is materialized.
    /// @return budget The strategy's raw USDG virtual budget after checkpointing.
    function checkpointStrategyBudget(address strategy) external nonReentrant onlyConfigured returns (uint256 budget) {
        _checkpointStrategyBudget(strategy);
        budget = strategyBudget[strategy];
    }

    /// @notice Returns a strategy's budget including revenue accrued since its last state-changing checkpoint.
    /// @dev This mirrors `_checkpointStrategyBudget` without mutating indices or remainders.
    /// @param strategy The registered strategy whose lazy budget is previewed.
    /// @return budget The raw USDG virtual budget including uncheckpointed index accrual.
    function previewStrategyBudget(address strategy) external view returns (uint256 budget) {
        budget = strategyBudget[strategy];
        uint256 currentIndex = globalAllocationIndex;
        uint256 priorIndex = strategyIndex[strategy];
        uint256 weight = strategyWeight[strategy];
        if (currentIndex <= priorIndex || weight < 1) return budget;

        uint256 indexDelta = currentIndex - priorIndex;
        uint256 wholeBudget = Math.mulDiv(weight, indexDelta, INDEX_PRECISION);
        uint256 combinedRemainder = strategyScaledRemainder[strategy] + mulmod(weight, indexDelta, INDEX_PRECISION);
        return budget + wholeBudget + combinedRemainder / INDEX_PRECISION;
    }

    /// @notice Returns a user's effective active weight for one strategy.
    /// @param user The signaling account to query.
    /// @param strategy The strategy whose effective generation-bound weight is queried.
    /// @return weight The user's current active sGBX weight for the strategy.
    function activeWeight(address user, address strategy) external view returns (uint256 weight) {
        weight = _effectiveActiveWeight(user, strategy);
    }

    /// @notice Returns generation-bound stored weight that has not yet been settled by ManagerRewards.
    /// @dev Stale weight is intentionally exposed here but remains excluded from signaling and allocation totals.
    /// @param user The signaling account to query.
    /// @param strategy The strategy whose reward-settlement weight is queried.
    /// @return weight The stored weight, including an uncheckpointed prior-generation weight.
    /// @return generation The generation in which `weight` was active, or the current generation for zero weight.
    function rewardWeight(address user, address strategy) external view returns (uint256 weight, uint64 generation) {
        weight = _storedActiveWeight[user][strategy];
        generation = weight == 0 ? strategyGeneration[strategy] : _activeGeneration[user][strategy];
    }

    /// @notice Returns the sum of a user's effective active weights across at most sixteen strategies.
    /// @param user The signaling account to query.
    /// @return total The sum of all current generation-bound active weights.
    function activeWeightTotal(address user) public view returns (uint256 total) {
        address[] storage strategies = _activeStrategies[user];
        for (uint256 index; index < strategies.length; ++index) {
            total += _effectiveActiveWeight(user, strategies[index]);
        }
    }

    /// @notice Returns the sum of a user's valid pending increases.
    /// @param user The signaling account to query.
    /// @return total The sum of all signalable current-generation pending increases.
    function pendingWeightTotal(address user) public view returns (uint256 total) {
        address[] storage strategies = _pendingStrategies[user];
        for (uint256 index; index < strategies.length; ++index) {
            address strategy = strategies[index];
            if (_pendingGeneration[user][strategy] == strategyGeneration[strategy] && _isSignalable(strategy)) {
                total += _storedPendingWeight[user][strategy];
            }
        }
    }

    /// @notice Returns one user's still-valid pending increase for a strategy.
    /// @param user The signaling account to query.
    /// @param strategy The strategy whose pending increase is queried.
    /// @return weight The still-valid pending sGBX weight, or zero if stale or no longer signalable.
    function pendingWeight(address user, address strategy) external view returns (uint256 weight) {
        if (_pendingGeneration[user][strategy] != strategyGeneration[strategy] || !_isSignalable(strategy)) return 0;
        weight = _storedPendingWeight[user][strategy];
    }

    /// @notice Returns a copy of the user's bounded active strategy list.
    /// @param user The signaling account to query.
    /// @return strategies The stored bounded list; effective weights must still be checked by generation.
    function activeStrategies(address user) external view returns (address[] memory strategies) {
        strategies = _activeStrategies[user];
    }

    /// @notice Returns a copy of the user's bounded pending strategy list.
    /// @param user The signaling account to query.
    /// @return strategies The stored bounded pending list; validity must still be checked by generation.
    function pendingStrategies(address user) external view returns (address[] memory strategies) {
        strategies = _pendingStrategies[user];
    }

    function _checkpointMatured(address user) private {
        _pruneStaleActive(user);
        _pruneStalePending(user);
        uint64 activationTime = pendingActivationTime[user];
        if (activationTime == 0 || block.timestamp < activationTime) return;
        if (signalActivationsPaused) return;

        _checkpointAllUserRewards(user);
        address[] memory pendingForRewards = _pendingStrategies[user];
        for (uint256 index; index < pendingForRewards.length; ++index) {
            address strategy = pendingForRewards[index];
            _checkpointReward(user, strategy, _effectiveActiveWeight(user, strategy));
        }
        address[] memory pending = _pendingStrategies[user];
        for (uint256 index; index < pending.length; ++index) {
            address strategy = pending[index];
            if (_pendingGeneration[user][strategy] != strategyGeneration[strategy] || !_isSignalable(strategy)) {
                continue;
            }
            uint256 newWeight = _effectiveActiveWeight(user, strategy) + _storedPendingWeight[user][strategy];
            _setActiveWeight(user, strategy, newWeight);
        }

        _clearPending(user);
        emit AllocationVoter__SignalsActivated(user, block.timestamp);
    }

    function _setActiveWeight(address user, address strategy, uint256 newWeight) private {
        uint256 oldWeight = _effectiveActiveWeight(user, strategy);
        if (oldWeight == newWeight) return;

        _checkpointStrategyBudget(strategy);
        _settleAllocationRemainderToIdle();
        uint256 oldStrategyWeight = strategyWeight[strategy];
        if (newWeight > oldWeight) {
            uint256 increase = newWeight - oldWeight;
            strategyWeight[strategy] = oldStrategyWeight + increase;
            totalLiveWeight += increase;
        } else {
            uint256 decrease = oldWeight - newWeight;
            strategyWeight[strategy] = oldStrategyWeight - decrease;
            totalLiveWeight -= decrease;
        }

        if (newWeight == 0) {
            delete _storedActiveWeight[user][strategy];
            delete _activeGeneration[user][strategy];
            _removeAddress(_activeStrategies[user], strategy);
        } else {
            if (oldWeight == 0) _activeStrategies[user].push(strategy);
            _storedActiveWeight[user][strategy] = newWeight;
            _activeGeneration[user][strategy] = strategyGeneration[strategy];
        }

        if (oldStrategyWeight != 0 && strategyWeight[strategy] == 0) {
            address token = ASSET_REGISTRY.tokenForStrategy(strategy);
            if (token != address(0)) {
                address rewards = ASSET_REGISTRY.configFor(token).rewards;
                if (rewards != address(0)) IManagerRewards(rewards).settleTerminalDust();
            }
        }

        emit AllocationVoter__UserWeightUpdated(user, strategy, oldWeight, newWeight);
        emit AllocationVoter__StrategyWeightUpdated(strategy, oldStrategyWeight, strategyWeight[strategy]);
    }

    function _checkpointStrategyBudget(address strategy) private {
        uint256 currentIndex = globalAllocationIndex;
        uint256 priorIndex = strategyIndex[strategy];
        if (currentIndex != priorIndex) {
            uint256 weight = strategyWeight[strategy];
            if (weight != 0) {
                uint256 indexDelta = currentIndex - priorIndex;
                uint256 wholeBudget = Math.mulDiv(weight, indexDelta, INDEX_PRECISION);
                uint256 combinedRemainder =
                    strategyScaledRemainder[strategy] + mulmod(weight, indexDelta, INDEX_PRECISION);
                strategyBudget[strategy] += wholeBudget + combinedRemainder / INDEX_PRECISION;
                strategyScaledRemainder[strategy] = combinedRemainder % INDEX_PRECISION;
            }
            strategyIndex[strategy] = currentIndex;
        }
        emit AllocationVoter__StrategyBudgetCheckpointed(strategy, strategyBudget[strategy], currentIndex);
    }

    function _checkpointAllUserRewards(address user) private {
        address[] storage strategies = _activeStrategies[user];
        for (uint256 index; index < strategies.length; ++index) {
            address strategy = strategies[index];
            _checkpointReward(user, strategy, _storedActiveWeight[user][strategy]);
        }
    }

    function _checkpointReward(address user, address strategy, uint256 weight) private {
        address token = ASSET_REGISTRY.tokenForStrategy(strategy);
        if (token == address(0)) return;
        address rewards = ASSET_REGISTRY.configFor(token).rewards;
        if (rewards != address(0)) {
            uint64 weightGeneration = weight == 0 ? strategyGeneration[strategy] : _activeGeneration[user][strategy];
            IManagerRewards(rewards).checkpointUser(user, weight, weightGeneration);
        }
    }

    function _pruneStaleActive(address user) private {
        uint256 index = _activeStrategies[user].length;
        while (index != 0) {
            --index;
            address strategy = _activeStrategies[user][index];
            if (_activeGeneration[user][strategy] != strategyGeneration[strategy] || strategyDisabled[strategy]) {
                _checkpointReward(user, strategy, _storedActiveWeight[user][strategy]);
                delete _storedActiveWeight[user][strategy];
                delete _activeGeneration[user][strategy];
                _removeAt(_activeStrategies[user], index);
            }
        }
    }

    function _pruneStalePending(address user) private {
        uint256 index = _pendingStrategies[user].length;
        while (index != 0) {
            --index;
            address strategy = _pendingStrategies[user][index];
            if (_pendingGeneration[user][strategy] != strategyGeneration[strategy] || !_isSignalable(strategy)) {
                delete _storedPendingWeight[user][strategy];
                delete _pendingGeneration[user][strategy];
                _removeAt(_pendingStrategies[user], index);
            }
        }
        if (_pendingStrategies[user].length == 0) pendingActivationTime[user] = 0;
    }

    function _scalePending(address user, uint256 targetTotal, uint256 oldTotal) private {
        address[] memory strategies = _pendingStrategies[user];
        uint64 activationTime = pendingActivationTime[user];
        uint256[] memory scaled = new uint256[](strategies.length);
        for (uint256 index; index < strategies.length; ++index) {
            scaled[index] = Math.mulDiv(_storedPendingWeight[user][strategies[index]], targetTotal, oldTotal);
        }
        _clearPending(user);
        for (uint256 index; index < strategies.length; ++index) {
            if (scaled[index] == 0) continue;
            address strategy = strategies[index];
            _pendingStrategies[user].push(strategy);
            _storedPendingWeight[user][strategy] = scaled[index];
            _pendingGeneration[user][strategy] = strategyGeneration[strategy];
        }
        if (_pendingStrategies[user].length != 0) pendingActivationTime[user] = activationTime;
    }

    function _scaleActive(address user, uint256 targetTotal, uint256 oldTotal) private {
        address[] memory strategies = _activeStrategies[user];
        for (uint256 index; index < strategies.length; ++index) {
            address strategy = strategies[index];
            uint256 scaled = Math.mulDiv(_effectiveActiveWeight(user, strategy), targetTotal, oldTotal);
            _setActiveWeight(user, strategy, scaled);
        }
    }

    function _clearPending(address user) private {
        address[] storage strategies = _pendingStrategies[user];
        for (uint256 index; index < strategies.length; ++index) {
            address strategy = strategies[index];
            delete _storedPendingWeight[user][strategy];
            delete _pendingGeneration[user][strategy];
        }
        delete _pendingStrategies[user];
        pendingActivationTime[user] = 0;
    }

    function _effectiveActiveWeight(address user, address strategy) private view returns (uint256) {
        if (strategyDisabled[strategy] || _activeGeneration[user][strategy] != strategyGeneration[strategy]) return 0;
        return _storedActiveWeight[user][strategy];
    }

    function _isSignalable(address strategy) private view returns (bool) {
        return !strategyDisabled[strategy] && ASSET_REGISTRY.isLiveStrategy(strategy);
    }

    function _desiredWeight(address strategy, address[] calldata desiredStrategies, uint256[] memory desiredWeights)
        private
        pure
        returns (uint256)
    {
        for (uint256 index; index < desiredStrategies.length; ++index) {
            if (desiredStrategies[index] == strategy) return desiredWeights[index];
        }
        return 0;
    }

    function _removeAddress(address[] storage values, address value) private {
        for (uint256 index; index < values.length; ++index) {
            if (values[index] == value) {
                _removeAt(values, index);
                return;
            }
        }
    }

    function _removeAt(address[] storage values, uint256 index) private {
        uint256 last = values.length - 1;
        if (index != last) values[index] = values[last];
        values.pop();
    }

    function _creditIdleScaled(uint256 scaledAmount) private {
        uint256 combined = idleScaledRemainder + scaledAmount;
        idleUSDG += combined / INDEX_PRECISION;
        idleScaledRemainder = combined % INDEX_PRECISION;
    }

    function _settleAllocationRemainderToIdle() private {
        uint256 remainder = allocationRemainder;
        if (remainder == 0) return;
        allocationRemainder = 0;
        _creditIdleScaled(remainder);
    }

    function _scaleWholeAndRemainder(
        uint256 wholeAmount,
        uint256 scaledRemainder,
        uint256 numerator,
        uint256 denominator
    ) private pure returns (uint256 scaledWholeAmount, uint256 nextScaledRemainder) {
        scaledWholeAmount = Math.mulDiv(wholeAmount, numerator, denominator);
        uint256 wholeFraction = Math.mulDiv(mulmod(wholeAmount, numerator, denominator), INDEX_PRECISION, denominator);
        uint256 carriedFraction = Math.mulDiv(scaledRemainder, numerator, denominator);
        uint256 combined = wholeFraction + carriedFraction;
        scaledWholeAmount += combined / INDEX_PRECISION;
        nextScaledRemainder = combined % INDEX_PRECISION;
    }
}
