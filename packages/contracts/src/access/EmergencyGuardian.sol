// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IMiningPool } from "../interfaces/IMiningPool.sol";

interface IEmergencyAssetRegistry {
    /// @notice Irreversibly disables one registered strategy.
    function disableStrategy(address strategy) external;
}

interface IEmergencyStrategyPause {
    /// @notice Stops new auction fills.
    function pauseFills() external;
}

/// @title EmergencyGuardian
/// @notice Bound stop-only coordinator; it cannot resume, move assets, mint, or block exits.
contract EmergencyGuardian {
    /// @notice Account allowed to invoke the stop-only guardian actions.
    address public immutable OPERATOR;
    /// @notice Deployment coordinator allowed to bind guardian targets once.
    address public immutable TARGET_INITIALIZER;

    /// @notice Mining pool whose contributions the guardian can pause.
    IMiningPool public miningPool;
    /// @notice Allocation voter whose signal increases the guardian can pause.
    IAllocationVoter public allocationVoter;
    /// @notice Registry whose live strategies the guardian can disable.
    IAssetRegistry public assetRegistry;
    /// @notice Whether the three emergency targets have been bound.
    bool public targetsInitialized;

    error EmergencyGuardian__AlreadyInitialized();
    error EmergencyGuardian__StrategyNotLive(address strategy);
    error EmergencyGuardian__Unauthorized(address caller);
    error EmergencyGuardian__ZeroAddress();

    event EmergencyGuardian__MiningPaused(address indexed miningPool);
    event EmergencyGuardian__SignalIncreasesPaused(address indexed voter);
    event EmergencyGuardian__StrategyDisabled(address indexed strategy);
    event EmergencyGuardian__StrategyFillsPaused(address indexed strategy);
    event EmergencyGuardian__TargetsInitialized(
        address indexed miningPool, address indexed allocationVoter, address indexed assetRegistry
    );

    /// @notice Configures the fixed guardian operator and one-time target initializer.
    constructor(address operator, address targetInitializer) {
        if (operator == address(0) || targetInitializer == address(0)) revert EmergencyGuardian__ZeroAddress();
        OPERATOR = operator;
        TARGET_INITIALIZER = targetInitializer;
    }

    /// @notice Binds the mining pool, allocation voter, and asset registry once.
    function initializeTargets(
        IMiningPool miningPool_,
        IAllocationVoter allocationVoter_,
        IAssetRegistry assetRegistry_
    ) external {
        if (msg.sender != TARGET_INITIALIZER) revert EmergencyGuardian__Unauthorized(msg.sender);
        if (targetsInitialized) revert EmergencyGuardian__AlreadyInitialized();
        if (
            address(miningPool_) == address(0) || address(allocationVoter_) == address(0)
                || address(assetRegistry_) == address(0)
        ) revert EmergencyGuardian__ZeroAddress();
        if (
            address(miningPool_).code.length == 0 || address(allocationVoter_).code.length == 0
                || address(assetRegistry_).code.length == 0
        ) revert EmergencyGuardian__ZeroAddress();
        miningPool = miningPool_;
        allocationVoter = allocationVoter_;
        assetRegistry = assetRegistry_;
        targetsInitialized = true;
        emit EmergencyGuardian__TargetsInitialized(
            address(miningPool_), address(allocationVoter_), address(assetRegistry_)
        );
    }

    /// @notice Stops new mining contributions through the configured pool.
    function pauseMiningContributions() external {
        _onlyOperator();
        miningPool.pauseContributions();
        emit EmergencyGuardian__MiningPaused(address(miningPool));
    }

    /// @notice Stops allocation-signal increases through the configured voter.
    function pauseSignalIncreases() external {
        _onlyOperator();
        allocationVoter.pauseSignalIncreases();
        emit EmergencyGuardian__SignalIncreasesPaused(address(allocationVoter));
    }

    /// @notice Stops fills on one currently live strategy.
    function pauseStrategyFills(address strategy) external {
        _onlyOperator();
        if (!assetRegistry.isLiveStrategy(strategy)) revert EmergencyGuardian__StrategyNotLive(strategy);
        IEmergencyStrategyPause(strategy).pauseFills();
        emit EmergencyGuardian__StrategyFillsPaused(strategy);
    }

    /// @notice Terminally disables one live strategy in both registry and voter.
    function disableStrategy(address strategy) external {
        _onlyOperator();
        if (!assetRegistry.isLiveStrategy(strategy)) revert EmergencyGuardian__StrategyNotLive(strategy);
        IEmergencyAssetRegistry(address(assetRegistry)).disableStrategy(strategy);
        allocationVoter.disableStrategy(strategy);
        emit EmergencyGuardian__StrategyDisabled(strategy);
    }

    function _onlyOperator() private view {
        if (msg.sender != OPERATOR) revert EmergencyGuardian__Unauthorized(msg.sender);
    }
}
