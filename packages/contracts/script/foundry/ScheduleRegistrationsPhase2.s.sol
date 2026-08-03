// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ProtocolTimelock } from "../../src/access/ProtocolTimelock.sol";
import { AssetRegistry } from "../../src/vault/AssetRegistry.sol";
import { DeploymentBase } from "./DeploymentBase.sol";

/// @notice Queues only the hard-coded vault and initial registry operations under the seven-day delay.
contract ScheduleRegistrationsPhase2 is DeploymentBase {
    error SchedulePhase__WrongProposer(address expected, address actual);

    function run() external returns (bytes32[] memory operationIds) {
        _requireFoundryLocalRehearsal();
        uint256 proposerKey = vm.envUint("PROTOCOL_TIMELOCK_PROPOSER_KEY");
        address proposer = vm.addr(proposerKey);
        Config memory config = _readConfig(vm.envString("DEPLOYMENT_CONFIG_PATH"), address(1));
        DeploymentAddresses memory deployment = _readDeploymentAddresses(vm.envString("DEPLOYMENT_STATE_PATH"));
        _assertConfigMatches(config, deployment);
        ProtocolTimelock timelock = ProtocolTimelock(deployment.protocolTimelock);
        if (timelock.PROPOSER_MULTISIG() != proposer) {
            revert SchedulePhase__WrongProposer(timelock.PROPOSER_MULTISIG(), proposer);
        }

        operationIds = new bytes32[](config.targetTokens.length + 3);
        vm.startBroadcast(proposerKey);
        uint256 operationIndex;
        operationIds[operationIndex++] = _schedule(
            timelock,
            deployment.assetRegistry,
            abi.encodeCall(AssetRegistry.configureVault, (deployment.gumBallVault)),
            "CONFIGURE_VAULT"
        );
        operationIds[operationIndex++] = _schedule(
            timelock,
            deployment.assetRegistry,
            abi.encodeCall(AssetRegistry.registerAsset, (_assetConfigForUSDG(config, deployment))),
            "REGISTER_USDG"
        );
        for (uint256 index; index < config.targetTokens.length; ++index) {
            operationIds[operationIndex++] = _schedule(
                timelock,
                deployment.assetRegistry,
                _registrationDataForTarget(config, deployment, index),
                "REGISTER_TARGET"
            );
        }
        operationIds[operationIndex] = _schedule(
            timelock,
            deployment.assetRegistry,
            abi.encodeCall(AssetRegistry.registerStandaloneStrategy, (deployment.buybackBurnStrategy)),
            "REGISTER_BUYBACK"
        );
        vm.stopBroadcast();

        string memory objectKey = "phaseTwo";
        vm.serializeUint(objectKey, "chainId", block.chainid);
        vm.serializeString(objectKey, "phase", "TIMELOCK_OPERATIONS_SCHEDULED");
        vm.serializeUint(objectKey, "minimumDelaySeconds", timelock.CRITICAL_CHANGE_DELAY());
        string memory json = vm.serializeBytes32(objectKey, "operationIds", operationIds);
        vm.writeJson(json, vm.envOr("TIMELOCK_SCHEDULE_PATH", string("deployments/foundry-phase2-schedule.json")));
    }

    function _schedule(ProtocolTimelock timelock, address target, bytes memory data, string memory label)
        private
        returns (bytes32)
    {
        return timelock.schedule(target, data, _operationSalt(label, target, data));
    }
}
