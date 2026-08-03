// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ProtocolTimelock } from "../../src/access/ProtocolTimelock.sol";
import { AssetRegistry } from "../../src/vault/AssetRegistry.sol";
import { DeploymentBase } from "./DeploymentBase.sol";

/// @notice Permissionlessly executes the scheduled operations after their enforced seven-day delay.
contract ExecuteRegistrationsPhase3 is DeploymentBase {
    function run() external {
        _requireFoundryLocalRehearsal();
        uint256 executorKey = vm.envUint("TIMELOCK_EXECUTOR_KEY");
        Config memory config = _readConfig(vm.envString("DEPLOYMENT_CONFIG_PATH"), address(1));
        DeploymentAddresses memory deployment = _readDeploymentAddresses(vm.envString("DEPLOYMENT_STATE_PATH"));
        _assertConfigMatches(config, deployment);
        ProtocolTimelock timelock = ProtocolTimelock(deployment.protocolTimelock);

        vm.startBroadcast(executorKey);
        _execute(
            timelock,
            deployment.assetRegistry,
            abi.encodeCall(AssetRegistry.configureVault, (deployment.gumBallVault)),
            "CONFIGURE_VAULT"
        );
        _execute(
            timelock,
            deployment.assetRegistry,
            abi.encodeCall(AssetRegistry.registerAsset, (_assetConfigForUSDG(config, deployment))),
            "REGISTER_USDG"
        );
        for (uint256 index; index < config.targetTokens.length; ++index) {
            _execute(
                timelock,
                deployment.assetRegistry,
                _registrationDataForTarget(config, deployment, index),
                "REGISTER_TARGET"
            );
        }
        _execute(
            timelock,
            deployment.assetRegistry,
            abi.encodeCall(AssetRegistry.registerStandaloneStrategy, (deployment.buybackBurnStrategy)),
            "REGISTER_BUYBACK"
        );
        vm.stopBroadcast();

        AssetRegistry registry = AssetRegistry(deployment.assetRegistry);
        require(registry.vault() == deployment.gumBallVault, "vault registration mismatch");
        require(registry.assetCount() == config.targetTokens.length + 1, "asset count mismatch");
        require(registry.strategyCount() == config.targetTokens.length + 2, "strategy count mismatch");
    }

    function _execute(ProtocolTimelock timelock, address target, bytes memory data, string memory label) private {
        timelock.execute(target, data, _operationSalt(label, target, data));
    }
}
