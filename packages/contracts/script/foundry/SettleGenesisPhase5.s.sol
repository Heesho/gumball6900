// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { GenesisBootstrap } from "../../src/mining/GenesisBootstrap.sol";
import { DeploymentBase } from "./DeploymentBase.sol";

/// @notice Permissionlessly closes and atomically settles genesis after community mining ends.
contract SettleGenesisPhase5 is DeploymentBase {
    function run() external {
        _requireFoundryLocalRehearsal();
        uint256 executorKey = vm.envUint("GENESIS_SETTLEMENT_EXECUTOR_KEY");
        uint256 rawSqrtPriceX96 = vm.envUint("GENESIS_SQRT_PRICE_X96");
        require(rawSqrtPriceX96 <= type(uint160).max, "genesis sqrt price exceeds uint160");
        uint160 sqrtPriceX96 = uint160(rawSqrtPriceX96);
        DeploymentAddresses memory deployment = _readDeploymentAddresses(vm.envString("DEPLOYMENT_STATE_PATH"));
        GenesisBootstrap bootstrap = GenesisBootstrap(deployment.genesisBootstrap);

        vm.startBroadcast(executorKey);
        if (bootstrap.state() == GenesisBootstrap.State.CONTRIBUTING) bootstrap.close();
        if (bootstrap.state() == GenesisBootstrap.State.AWAITING_SETTLEMENT) bootstrap.settle(sqrtPriceX96);
        vm.stopBroadcast();

        require(bootstrap.state() == GenesisBootstrap.State.SETTLED, "genesis not settled");
    }
}
