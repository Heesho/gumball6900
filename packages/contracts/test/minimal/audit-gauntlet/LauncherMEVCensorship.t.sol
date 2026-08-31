// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Fund } from "../../../src/core/Fund.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { GBXLauncher } from "../../../src/launch/GBXLauncher.sol";
import { GBXLauncherTest, MockLauncherV2Pair } from "../GBXLauncher.t.sol";

/// @notice Cold-review reproductions for public ordering attacks against predictable launch addresses.
contract LauncherMEVCensorshipTest is GBXLauncherTest {
    uint256 private constant POISON_AMOUNT = 1;

    function testAdaptiveOneRawUSDGPoisonCanInvalidateSuccessiveCandidates() public {
        assertTrue(usdg.transfer(ATTACKER, 2 * POISON_AMOUNT));

        address firstPair = _predictedPair(launcher);
        vm.prank(ATTACKER);
        assertTrue(usdg.transfer(firstPair, POISON_AMOUNT));

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.LaunchInvariantFailed.selector, PAIR_USDG_DEPOSIT));
        launcher.launch(address(governance));
        assertFalse(launcher.launched());
        assertEq(usdg.balanceOf(firstPair), POISON_AMOUNT);

        GBXLauncher replacement = new GBXLauncher(
            usdg, address(this), tokenFundDeployer, signalBribeDeployer, strategyResonanceDeployer, routerMineDeployer
        );
        address secondPair = _predictedPair(replacement);
        assertNotEq(secondPair, firstPair);

        vm.prank(ATTACKER);
        assertTrue(usdg.transfer(secondPair, POISON_AMOUNT));
        usdg.approve(address(replacement), replacement.GENESIS_USDG());

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.LaunchInvariantFailed.selector, PAIR_USDG_DEPOSIT));
        replacement.launch(address(governance));
        assertFalse(replacement.launched());
        assertEq(usdg.balanceOf(secondPair), POISON_AMOUNT);
    }

    function testPoisonedCandidateStrandsPermittedLauncherPrefundAfterReplacementSucceeds() public {
        uint256 launcherPrefund = 777;
        assertTrue(usdg.transfer(address(launcher), launcherPrefund));
        assertTrue(usdg.transfer(ATTACKER, POISON_AMOUNT));

        address poisonedPair = _predictedPair(launcher);
        vm.prank(ATTACKER);
        assertTrue(usdg.transfer(poisonedPair, POISON_AMOUNT));

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.LaunchInvariantFailed.selector, PAIR_USDG_DEPOSIT));
        launcher.launch(address(governance));
        assertEq(usdg.balanceOf(address(launcher)), launcherPrefund);

        GBXLauncher replacement = new GBXLauncher(
            usdg, address(this), tokenFundDeployer, signalBribeDeployer, strategyResonanceDeployer, routerMineDeployer
        );
        usdg.approve(address(replacement), replacement.GENESIS_USDG());
        GBXLauncher.Deployment memory result = replacement.launch(address(governance));

        assertTrue(replacement.launched());
        assertEq(usdg.balanceOf(address(launcher)), launcherPrefund);
        assertEq(IERC20(address(usdg)).balanceOf(result.fund), 0);
        assertEq(address(Fund(result.fund).gbx()), result.gbx);
    }

    function _predictedPair(GBXLauncher candidate) private view returns (address) {
        address predictedGBX = _predictedGBX(candidate);
        (address token0, address token1) =
            predictedGBX < address(usdg) ? (predictedGBX, address(usdg)) : (address(usdg), predictedGBX);
        bytes32 pairSalt = keccak256(abi.encodePacked(token0, token1));
        bytes32 pairInitCodeHash = keccak256(
            abi.encodePacked(type(MockLauncherV2Pair).creationCode, abi.encode(token0, token1, address(factory)))
        );
        return vm.computeCreate2Address(pairSalt, pairInitCodeHash, address(factory));
    }

    function _predictedGBX(GBXLauncher candidate) private view returns (address) {
        bytes32 salt = keccak256(abi.encode(address(candidate), GBX_SALT_DOMAIN));
        bytes32 initCodeHash = keccak256(abi.encodePacked(type(GBX).creationCode, abi.encode(address(candidate))));
        return vm.computeCreate2Address(salt, initCodeHash, address(tokenFundDeployer));
    }
}
