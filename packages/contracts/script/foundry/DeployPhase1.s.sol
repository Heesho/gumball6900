// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { DeploymentBase } from "./DeploymentBase.sol";

/// @notice Directly deploys and irreversibly wires the complete non-upgradeable graph.
contract DeployPhase1 is DeploymentBase {
    function run() external returns (DeploymentAddresses memory addresses_) {
        _requireFoundryLocalRehearsal();
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        Config memory config = _readConfig(vm.envString("DEPLOYMENT_CONFIG_PATH"), deployer);

        vm.startBroadcast(deployerKey);
        Deployment memory deployment = _deployPhaseOne(config, CANONICAL_CREATE2_DEPLOYER);
        vm.stopBroadcast();

        addresses_ = _addresses(deployment);
        addresses_.chainId = block.chainid;
        addresses_.configHash = config.configHash;
        addresses_.dependencyInitializer = deployer;
        _writeDeploymentAddresses(
            addresses_, vm.envOr("DEPLOYMENT_STATE_PATH", string("deployments/foundry-phase1.json"))
        );
    }
}
