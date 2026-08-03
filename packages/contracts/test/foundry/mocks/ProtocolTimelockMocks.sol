// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";

contract TimelockRegistryMock {
    address[] private _strategies;

    address public configuredVault;
    address public lastAssetToken;
    address public lastStandaloneStrategy;
    address public lastStatusSubject;
    bool public lastStatus;

    function addStrategy(address strategy) external {
        _strategies.push(strategy);
    }

    function configureVault(address vault) external {
        configuredVault = vault;
    }

    function registerAsset(IAssetRegistry.AssetConfig calldata config) external {
        lastAssetToken = config.token;
    }

    function registerStockAsset(
        IAssetRegistry.AssetConfig calldata config,
        IAssetRegistry.StockTokenDependency calldata
    ) external {
        lastAssetToken = config.token;
    }

    function registerStandaloneStrategy(address strategy) external {
        lastStandaloneStrategy = strategy;
    }

    function enableAcquisition(address token) external {
        lastStatusSubject = token;
        lastStatus = true;
    }

    function disableAcquisition(address token) external {
        lastStatusSubject = token;
        lastStatus = false;
    }

    function setRedemptionEnabled(address token, bool enabled) external {
        lastStatusSubject = token;
        lastStatus = enabled;
    }

    function enableStandaloneStrategy(address strategy) external {
        lastStatusSubject = strategy;
        lastStatus = true;
    }

    function disableStandaloneStrategy(address strategy) external {
        lastStatusSubject = strategy;
        lastStatus = false;
    }

    function strategyCount() external view returns (uint256) {
        return _strategies.length;
    }

    function strategyAt(uint256 index) external view returns (address) {
        return _strategies[index];
    }

    function isLiveStrategy(address strategy) external view returns (bool) {
        for (uint256 index; index < _strategies.length; ++index) {
            if (_strategies[index] == strategy) return true;
        }
        return false;
    }
}

contract TimelockStrategyMock {
    error TimelockStrategyMock__ReferenceResetOutOfBounds();

    uint256 public referenceRate = 1 ether;
    bool public fillsPaused = true;

    function resetReferenceRate(uint256 expectedReferenceRate, uint256 newReferenceRate) external {
        if (newReferenceRate < expectedReferenceRate / 2 || newReferenceRate > expectedReferenceRate * 2) {
            revert TimelockStrategyMock__ReferenceResetOutOfBounds();
        }
        referenceRate = newReferenceRate;
    }

    function permissionlessChangeReferenceRate(uint256 newReferenceRate) external {
        referenceRate = newReferenceRate;
    }

    function unpauseFills() external {
        fillsPaused = false;
    }
}

contract TimelockGuardianMock {
    error TimelockGuardianMock__InitializeReverted();

    address public operator;
    address public assetRegistry;
    address public allocationVoter;
    bool public revertsOnInitialize;
    address public permissionedPoolController;
    bool public permissionedPoolControllerFinalized;

    function setRevertsOnInitialize(bool shouldRevert) external {
        revertsOnInitialize = shouldRevert;
    }

    function initializeTargets(address registry, address voter) external {
        if (revertsOnInitialize) revert TimelockGuardianMock__InitializeReverted();
        assetRegistry = registry;
        allocationVoter = voter;
    }

    function finalizePermissionedPoolController(address controller) external {
        permissionedPoolController = controller;
        permissionedPoolControllerFinalized = true;
    }

    function rotateOperator(address newOperator) external {
        operator = newOperator;
    }
}

contract TimelockVoterMock {
    bool public activationsPaused = true;
    address public reactivatedStrategy;
    address public disabledStrategy;

    function unpauseSignalActivations() external {
        activationsPaused = false;
    }

    function reactivateStrategy(address strategy) external {
        reactivatedStrategy = strategy;
    }

    function disableStrategy(address strategy) external {
        disabledStrategy = strategy;
    }
}

contract TimelockMiningPoolMock {
    bool public contributionsPaused = true;

    function setContributionsPaused(bool paused) external {
        contributionsPaused = paused;
    }

    function unpauseContributions() external {
        contributionsPaused = false;
    }
}

contract TimelockLiquidityManagerMock {
    struct MigrationRemoval {
        uint256 positionId;
        uint128 amount0Min;
        uint128 amount1Min;
    }

    struct MigrationReplacement {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    struct MigrationPlan {
        PoolKey destinationPoolKey;
        MigrationRemoval[] removals;
        MigrationReplacement[] replacements;
        uint256 deadline;
    }

    bool public migrationsPaused = true;
    bytes32 public executedPlanHash;

    function migrateLiquidity(MigrationPlan calldata plan) external {
        executedPlanHash = keccak256(abi.encode(plan));
    }

    function poolKey() external pure returns (PoolKey memory key) {
        key = PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: 3_000,
            tickSpacing: 60,
            hooks: IHooks(address(0x3000))
        });
    }

    function unpauseMigrations() external {
        migrationsPaused = false;
    }
}

contract TimelockPermissionedPoolControllerMock {
    address public immutable PROTOCOL_TIMELOCK;
    address public immutable EMERGENCY_GUARDIAN;
    address public immutable PERMISSIONS_ADAPTER;
    address public immutable PERMISSIONED_HOOK;
    bool public constant graphInitialized = true;

    bool public swappingEnabled;
    address public allowListChecker;
    address public wrapper;
    bool public wrapperAllowed;
    bool public canonicalHookAllowed;

    constructor(address protocolTimelock, address emergencyGuardian, address adapter, address hook) {
        PROTOCOL_TIMELOCK = protocolTimelock;
        EMERGENCY_GUARDIAN = emergencyGuardian;
        PERMISSIONS_ADAPTER = adapter;
        PERMISSIONED_HOOK = hook;
    }

    modifier onlyTimelock() {
        require(msg.sender == PROTOCOL_TIMELOCK, "TIMELOCK");
        _;
    }

    function setSwappingEnabled(bool enabled) external onlyTimelock {
        swappingEnabled = enabled;
    }

    function updateAllowListChecker(address checker) external onlyTimelock {
        allowListChecker = checker;
    }

    function setAllowedWrapper(address wrapper_, bool allowed) external onlyTimelock {
        wrapper = wrapper_;
        wrapperAllowed = allowed;
    }

    function setCanonicalHookAllowed(bool allowed) external onlyTimelock {
        canonicalHookAllowed = allowed;
    }
}

contract TimelockVaultMock { }

contract TimelockAcquisitionVoterMock {
    uint256 public budget = type(uint256).max;

    function checkpointStrategyBudget(address) external view returns (uint256) {
        return budget;
    }

    function strategyBudget(address) external view returns (uint256) {
        return budget;
    }
}

contract TimelockAcquisitionVaultMock {
    IERC20 public immutable USDG;

    constructor(IERC20 usdG) {
        USDG = usdG;
    }

    function releaseUSDG(address, uint256) external { }
}

contract TimelockManagerRewardsMock {
    uint256 public notified;

    function notifyReward(uint256 amount) external {
        notified += amount;
    }
}
