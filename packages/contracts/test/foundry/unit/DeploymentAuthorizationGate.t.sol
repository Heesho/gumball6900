// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { DeploymentBase } from "../../../script/foundry/DeploymentBase.sol";

contract DeploymentAuthorizationGateHarness is DeploymentBase {
    function requireFoundryLocalRehearsal() external view {
        _requireFoundryLocalRehearsal();
    }

    function foundryLocalRehearsalAllowed(uint256 chainId, string calldata mode) external pure returns (bool) {
        return _foundryLocalRehearsalAllowed(chainId, mode);
    }
}

contract DeploymentAuthorizationGateTest is Test {
    DeploymentAuthorizationGateHarness private harness;

    function setUp() external {
        harness = new DeploymentAuthorizationGateHarness();
    }

    function testAllowsExplicitLocalRehearsal() external {
        vm.chainId(31_337);
        vm.setEnv("DEPLOYMENT_EXECUTION_MODE", "rehearsal");
        harness.requireFoundryLocalRehearsal();
    }

    function testRejectsNonlocalFoundryExecutionBeforeBroadcast() external {
        vm.chainId(46_630);
        vm.setEnv("DEPLOYMENT_EXECUTION_MODE", "rehearsal");
        vm.expectRevert(DeploymentBase.Deployment__FoundryBroadcastAuthorizationUnavailable.selector);
        harness.requireFoundryLocalRehearsal();
    }

    function testRejectsWrongOrEmptyModeOnLocalChain() external view {
        assertFalse(harness.foundryLocalRehearsalAllowed(31_337, "authorized-broadcast"));
        assertFalse(harness.foundryLocalRehearsalAllowed(31_337, ""));
    }

    function testRejectsRehearsalModeOnMainnet() external view {
        assertFalse(harness.foundryLocalRehearsalAllowed(4_663, "rehearsal"));
    }
}
