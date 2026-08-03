// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IStrategyRewards } from "../interfaces/IStrategyRewards.sol";

/// @title AllocationVoter
/// @notice Immediate liquid signaling and vault-backed virtual USDG budget accounting.
/// @dev This ledger never transfers or custodies USDG.
contract AllocationVoter is IAllocationVoter, ReentrancyGuard {
    /// @notice Fixed-point precision used by the global revenue index.
    uint256 public constant INDEX_PRECISION = 1e27;
    /// @notice Maximum simultaneous strategy signals maintained by one user.
    uint256 public constant MAX_USER_STRATEGIES = 16;

    /// @notice Vault revenue token used only for physical-backing checks.
    IERC20 public immutable USDG;
    /// @notice Registry defining the bounded live strategy set.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Timelock allowed to resume signals and terminally disable strategies.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Stop-only guardian allowed to pause increases and disable strategies.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice Deployment coordinator allowed to bind circular dependencies once.
    address public immutable DEPENDENCY_INITIALIZER;

    /// @notice Passive vault that physically custodies allocated USDG.
    address public vault;
    /// @notice Non-transferable staked GBX token that bounds user signals.
    address public stakedGBX;
    /// @notice Mining pool authorized to notify deposited revenue.
    address public miningPool;
    /// @notice Liquidity custodian authorized to notify deposited fee revenue.
    address public liquidityCustodian;
    /// @notice Whether all circular dependencies have been bound.
    bool public dependenciesInitialized;
    /// @notice Whether signal-weight increases are paused.
    bool public signalIncreasesPaused;

    /// @notice Cumulative USDG revenue index per unit of active weight.
    uint256 public globalRevenueIndex;
    /// @notice Aggregate active signal weight across all live strategies.
    uint256 public override totalActiveWeight;
    /// @notice Total vault USDG currently represented by budgets and idle backing.
    uint256 public accountedVaultUSDG;
    /// @notice Accounted vault USDG not assigned to active strategy weight.
    uint256 public idleUSDG;

    /// @notice Returns the global revenue index last checkpointed for a strategy.
    mapping(address strategy => uint256 index) public strategyIndex;
    /// @notice Returns a strategy's checkpointed unconsumed USDG budget.
    mapping(address strategy => uint256 budget) public strategyBudget;
    /// @notice Returns the active aggregate signal weight assigned to a strategy.
    mapping(address strategy => uint256 weight) public override strategyWeight;
    /// @notice Returns whether a strategy has been terminally disabled in this ledger.
    mapping(address strategy => bool disabled) public strategyDisabled;
    /// @notice Returns one user's signal weight assigned to a strategy.
    mapping(address user => mapping(address strategy => uint256 weight)) public userWeight;
    /// @notice Returns one user's aggregate active signal weight.
    mapping(address user => uint256 weight) public override usedWeight;
    mapping(address user => address[] strategies) private _userStrategies;

    error AllocationVoter__AlreadyInitialized();
    error AllocationVoter__DuplicateStrategy(address strategy);
    error AllocationVoter__InsolventNotification(uint256 accountedAfter, uint256 physicalBalance);
    error AllocationVoter__InvalidArrayLength();
    error AllocationVoter__NotInitialized();
    error AllocationVoter__SignalIncreasePaused(address strategy);
    error AllocationVoter__StrategyBudgetTooLow(address strategy, uint256 requested, uint256 available);
    error AllocationVoter__StrategyStillLive(address strategy);
    error AllocationVoter__Unauthorized(address caller);
    error AllocationVoter__UnregisteredStrategy(address strategy);
    error AllocationVoter__WeightExceedsStake(uint256 requested, uint256 balance);
    error AllocationVoter__ZeroAddress();
    error AllocationVoter__ZeroAmount();

    event AllocationVoter__DependenciesInitialized(
        address indexed vault, address indexed stakedGBX, address indexed miningPool, address liquidityCustodian
    );
    event AllocationVoter__RevenueNotified(address indexed source, uint256 amount, uint256 indexDelta);
    event AllocationVoter__SignalIncreasesPauseSet(bool paused);
    event AllocationVoter__SignalsReset(address indexed user);
    event AllocationVoter__SignalsSet(address indexed user, uint256 totalWeight);
    event AllocationVoter__StrategyBudgetConsumed(address indexed strategy, uint256 amount, uint256 remaining);
    event AllocationVoter__StrategyBudgetScaled(address indexed strategy, uint256 budgetAfter);
    event AllocationVoter__StrategyDisabled(address indexed strategy, uint256 strandedBudget);
    event AllocationVoter__StrategyWeightSet(address indexed strategy, uint256 previousWeight, uint256 newWeight);

    /// @notice Configures the registry, access-control roles, token, and one-time dependency initializer.
    constructor(
        address usdG,
        IAssetRegistry assetRegistry,
        address protocolTimelock,
        address emergencyGuardian,
        address dependencyInitializer
    ) {
        if (
            usdG == address(0) || address(assetRegistry) == address(0) || protocolTimelock == address(0)
                || emergencyGuardian == address(0) || dependencyInitializer == address(0)
        ) revert AllocationVoter__ZeroAddress();
        if (usdG.code.length == 0 || address(assetRegistry).code.length == 0) revert AllocationVoter__ZeroAddress();
        USDG = IERC20(usdG);
        ASSET_REGISTRY = assetRegistry;
        PROTOCOL_TIMELOCK = protocolTimelock;
        EMERGENCY_GUARDIAN = emergencyGuardian;
        DEPENDENCY_INITIALIZER = dependencyInitializer;
    }

    /// @notice Binds the vault, staked token, mining pool, and liquidity custodian once.
    function initializeDependencies(
        address vault_,
        address stakedGBX_,
        address miningPool_,
        address liquidityCustodian_
    ) external {
        if (msg.sender != DEPENDENCY_INITIALIZER) revert AllocationVoter__Unauthorized(msg.sender);
        if (dependenciesInitialized) revert AllocationVoter__AlreadyInitialized();
        if (
            vault_ == address(0) || stakedGBX_ == address(0) || miningPool_ == address(0)
                || liquidityCustodian_ == address(0)
        ) revert AllocationVoter__ZeroAddress();
        if (
            vault_.code.length == 0 || stakedGBX_.code.length == 0 || miningPool_.code.length == 0
                || liquidityCustodian_.code.length == 0
        ) revert AllocationVoter__ZeroAddress();
        vault = vault_;
        stakedGBX = stakedGBX_;
        miningPool = miningPool_;
        liquidityCustodian = liquidityCustodian_;
        dependenciesInitialized = true;
        emit AllocationVoter__DependenciesInitialized(vault_, stakedGBX_, miningPool_, liquidityCustodian_);
    }

    /// @notice Replaces the caller's complete absolute strategy-weight allocation immediately.
    function signal(address[] calldata strategies, uint256[] calldata weights) external nonReentrant {
        _requireInitialized();
        uint256 length = strategies.length;
        if (length == 0 || length > MAX_USER_STRATEGIES || length != weights.length) {
            revert AllocationVoter__InvalidArrayLength();
        }
        uint256 requestedTotal;
        for (uint256 index; index < length; ++index) {
            address strategy = strategies[index];
            uint256 weight = weights[index];
            if (!ASSET_REGISTRY.isLiveStrategy(strategy) || strategyDisabled[strategy]) {
                revert AllocationVoter__UnregisteredStrategy(strategy);
            }
            if (weight == 0) revert AllocationVoter__ZeroAmount();
            if (signalIncreasesPaused && weight > userWeight[msg.sender][strategy]) {
                revert AllocationVoter__SignalIncreasePaused(strategy);
            }
            requestedTotal += weight;
            for (uint256 prior; prior < index; ++prior) {
                if (strategies[prior] == strategy) revert AllocationVoter__DuplicateStrategy(strategy);
            }
        }
        uint256 balance = IERC20(stakedGBX).balanceOf(msg.sender);
        if (requestedTotal > balance) revert AllocationVoter__WeightExceedsStake(requestedTotal, balance);

        _reset(msg.sender);
        for (uint256 index; index < length; ++index) {
            _userStrategies[msg.sender].push(strategies[index]);
            _setUserWeight(msg.sender, strategies[index], weights[index]);
        }
        emit AllocationVoter__SignalsSet(msg.sender, requestedTotal);
    }

    /// @notice Clears the caller's complete strategy allocation immediately.
    function resetSignals() external nonReentrant {
        _requireInitialized();
        _reset(msg.sender);
        emit AllocationVoter__SignalsReset(msg.sender);
    }

    /// @notice Accounts newly deposited vault USDG across active strategy weight.
    function notifyRevenue(uint256 amount) external override nonReentrant {
        _requireInitialized();
        if (msg.sender != miningPool && msg.sender != liquidityCustodian) {
            revert AllocationVoter__Unauthorized(msg.sender);
        }
        if (amount == 0) revert AllocationVoter__ZeroAmount();
        uint256 accountedAfter = accountedVaultUSDG + amount;
        uint256 physicalBalance = USDG.balanceOf(vault);
        if (accountedAfter > physicalBalance) {
            revert AllocationVoter__InsolventNotification(accountedAfter, physicalBalance);
        }
        accountedVaultUSDG = accountedAfter;

        uint256 indexDelta;
        if (totalActiveWeight == 0) {
            idleUSDG += amount;
        } else {
            indexDelta = Math.mulDiv(amount, INDEX_PRECISION, totalActiveWeight);
            globalRevenueIndex += indexDelta;
        }
        emit AllocationVoter__RevenueNotified(msg.sender, amount, indexDelta);
    }

    /// @notice Debits already accrued USDG budget for the calling vault and strategy.
    function consumeStrategyBudget(address strategy, uint256 amount) external override nonReentrant {
        _requireInitialized();
        if (msg.sender != vault) revert AllocationVoter__Unauthorized(msg.sender);
        if (amount == 0) revert AllocationVoter__ZeroAmount();
        _checkpointStrategy(strategy);
        uint256 available = strategyBudget[strategy];
        if (amount > available) revert AllocationVoter__StrategyBudgetTooLow(strategy, amount, available);
        strategyBudget[strategy] = available - amount;
        accountedVaultUSDG -= amount;
        emit AllocationVoter__StrategyBudgetConsumed(strategy, amount, available - amount);
    }

    /// @notice Scales all accounted USDG after an in-kind redemption reduces vault balances.
    function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external override nonReentrant {
        _requireInitialized();
        if (msg.sender != vault) revert AllocationVoter__Unauthorized(msg.sender);
        if (shares == 0 || supplyBefore == 0 || shares > supplyBefore) revert AllocationVoter__ZeroAmount();
        uint256 remaining = supplyBefore - shares;
        uint256 count = ASSET_REGISTRY.strategyCount();
        for (uint256 index; index < count; ++index) {
            address strategy = ASSET_REGISTRY.strategyAt(index);
            _checkpointStrategy(strategy);
            strategyBudget[strategy] = Math.mulDiv(strategyBudget[strategy], remaining, supplyBefore);
            emit AllocationVoter__StrategyBudgetScaled(strategy, strategyBudget[strategy]);
        }
        idleUSDG = Math.mulDiv(idleUSDG, remaining, supplyBefore);
        accountedVaultUSDG = Math.mulDiv(accountedVaultUSDG, remaining, supplyBefore);
    }

    /// @notice Removes a registry-disabled strategy from future revenue and strands its budget as idle backing.
    function disableStrategy(address strategy) external override nonReentrant {
        _requireInitialized();
        if (msg.sender != PROTOCOL_TIMELOCK && msg.sender != EMERGENCY_GUARDIAN) {
            revert AllocationVoter__Unauthorized(msg.sender);
        }
        if (ASSET_REGISTRY.isLiveStrategy(strategy)) revert AllocationVoter__StrategyStillLive(strategy);
        if (strategyDisabled[strategy]) revert AllocationVoter__UnregisteredStrategy(strategy);
        _checkpointStrategy(strategy);
        uint256 weight = strategyWeight[strategy];
        if (weight != 0) totalActiveWeight -= weight;
        uint256 stranded = strategyBudget[strategy];
        strategyBudget[strategy] = 0;
        idleUSDG += stranded;
        strategyDisabled[strategy] = true;
        emit AllocationVoter__StrategyDisabled(strategy, stranded);
    }

    /// @notice Checkpoints and returns one strategy's current USDG budget.
    function checkpointStrategyBudget(address strategy) external nonReentrant returns (uint256 budget) {
        _requireInitialized();
        _checkpointStrategy(strategy);
        return strategyBudget[strategy];
    }

    /// @notice Previews one strategy's checkpointed and newly indexed USDG budget.
    function previewStrategyBudget(address strategy) external view override returns (uint256 budget) {
        budget = strategyBudget[strategy];
        if (strategyDisabled[strategy]) return budget;
        uint256 delta = globalRevenueIndex - strategyIndex[strategy];
        if (delta != 0) budget += Math.mulDiv(strategyWeight[strategy], delta, INDEX_PRECISION);
    }

    /// @notice Returns the strategies currently carrying nonzero signal entries for a user.
    function activeStrategies(address user) external view returns (address[] memory) {
        return _userStrategies[user];
    }

    /// @notice Stops signal increases while preserving reductions, resets, and unstaking exits.
    function pauseSignalIncreases() external override {
        if (msg.sender != EMERGENCY_GUARDIAN) revert AllocationVoter__Unauthorized(msg.sender);
        signalIncreasesPaused = true;
        emit AllocationVoter__SignalIncreasesPauseSet(true);
    }

    /// @notice Re-enables signal increases through the protocol timelock.
    function resumeSignalIncreases() external override {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AllocationVoter__Unauthorized(msg.sender);
        signalIncreasesPaused = false;
        emit AllocationVoter__SignalIncreasesPauseSet(false);
    }

    function _reset(address user) private {
        address[] storage strategies = _userStrategies[user];
        while (strategies.length != 0) {
            address strategy = strategies[strategies.length - 1];
            strategies.pop();
            _setUserWeight(user, strategy, 0);
        }
    }

    function _setUserWeight(address user, address strategy, uint256 newWeight) private {
        uint256 previous = userWeight[user][strategy];
        if (previous == newWeight) return;
        _checkpointStrategy(strategy);

        bool disabled = strategyDisabled[strategy];
        if (!disabled) {
            address rewards = ASSET_REGISTRY.rewardsForStrategy(strategy);
            if (rewards != address(0)) IStrategyRewards(rewards).setWeight(user, newWeight);
        }

        if (disabled) {
            if (newWeight != 0) revert AllocationVoter__UnregisteredStrategy(strategy);
            // The registry is already terminally disabled before this voter bit is set. Skipping the admitted rewards
            // code entirely bounds reset gas and preserves exit liveness even if that code reverts or burns all gas.
            // Honest StrategyRewards keeps a terminal weight snapshot; with fills disabled, its index cannot advance,
            // so previously indexed claims remain correct without a final callback.
            strategyWeight[strategy] -= previous;
        } else {
            uint256 oldStrategyWeight = strategyWeight[strategy];
            uint256 nextStrategyWeight = oldStrategyWeight - previous + newWeight;
            strategyWeight[strategy] = nextStrategyWeight;
            totalActiveWeight = totalActiveWeight - previous + newWeight;
            emit AllocationVoter__StrategyWeightSet(strategy, oldStrategyWeight, nextStrategyWeight);
        }
        userWeight[user][strategy] = newWeight;
        usedWeight[user] = usedWeight[user] - previous + newWeight;
    }

    function _checkpointStrategy(address strategy) private {
        uint256 currentIndex = globalRevenueIndex;
        uint256 prior = strategyIndex[strategy];
        if (currentIndex != prior) {
            if (!strategyDisabled[strategy]) {
                strategyBudget[strategy] += Math.mulDiv(strategyWeight[strategy], currentIndex - prior, INDEX_PRECISION);
            }
            strategyIndex[strategy] = currentIndex;
        }
    }

    function _requireInitialized() private view {
        if (!dependenciesInitialized) revert AllocationVoter__NotInitialized();
    }
}
