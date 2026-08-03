// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

contract GuardianOperatorMock { }

import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";

contract GuardianMiningMock {
    bool public paused;
    bool public invalidated;

    function pauseContributions() external {
        paused = true;
    }

    function invalidateCurrentEpoch() external {
        invalidated = true;
    }
}

contract GuardianStrategyMock {
    bool public fillsPaused;

    function pauseFills() external {
        fillsPaused = true;
    }
}

contract GuardianRegistryMock {
    address public PROTOCOL_TIMELOCK;
    address public EMERGENCY_GUARDIAN;
    address public disabledAsset;
    address public disabledStandalone;
    mapping(address token => address strategy) public strategyForToken;

    function disableAcquisition(address token) external {
        disabledAsset = token;
    }

    function disableStandaloneStrategy(address strategy) external {
        disabledStandalone = strategy;
    }

    function configFor(address token) external view returns (IAssetRegistry.AssetConfig memory config) {
        config.token = token;
        config.strategy = strategyForToken[token];
    }

    function setStrategyForToken(address token, address strategy) external {
        strategyForToken[token] = strategy;
    }

    function setWiring(address protocolTimelock, address emergencyGuardian) external {
        PROTOCOL_TIMELOCK = protocolTimelock;
        EMERGENCY_GUARDIAN = emergencyGuardian;
    }
}

contract GuardianVoterMock {
    address public ASSET_REGISTRY;
    address public PROTOCOL_TIMELOCK;
    address public EMERGENCY_GUARDIAN;
    bool public activationsPaused;
    address public disabledStrategy;
    bool public revertsOnDisable;

    error GuardianVoterMock__ForcedRevert();

    function pauseSignalActivations() external {
        activationsPaused = true;
    }

    function disableStrategy(address strategy) external {
        if (revertsOnDisable) revert GuardianVoterMock__ForcedRevert();
        disabledStrategy = strategy;
    }

    function setRevertsOnDisable(bool enabled) external {
        revertsOnDisable = enabled;
    }

    function setWiring(address registry, address protocolTimelock, address emergencyGuardian) external {
        ASSET_REGISTRY = registry;
        PROTOCOL_TIMELOCK = protocolTimelock;
        EMERGENCY_GUARDIAN = emergencyGuardian;
    }
}

contract GuardianLiquidityManagerMock {
    bool public migrationsPaused;

    function pauseMigrations() external {
        migrationsPaused = true;
    }
}

contract GuardianPermissionedPoolControllerMock {
    address public immutable EMERGENCY_GUARDIAN;
    bool public liquidityDisabled;
    bool public swappingDisabled;

    constructor(address emergencyGuardian) {
        EMERGENCY_GUARDIAN = emergencyGuardian;
    }

    function emergencyDisableSwapping() external {
        require(msg.sender == EMERGENCY_GUARDIAN, "GUARDIAN");
        swappingDisabled = true;
    }

    function emergencyDisableLiquidity() external {
        require(msg.sender == EMERGENCY_GUARDIAN, "GUARDIAN");
        liquidityDisabled = true;
    }
}
