// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IGBXToken } from "../../src/interfaces/IGBXToken.sol";
import { EmissionController } from "../../src/mining/EmissionController.sol";
import { GBXToken } from "../../src/token/GBXToken.sol";
import { SupplyMiningCodeMock } from "./mocks/SupplyMiningMocks.sol";

contract MinimalEmissionControllerTest is Test {
    uint256 private constant INITIAL_DAILY_EMISSION = 465_152_749_681_042_811_702_004;

    address private constant GENESIS_RECIPIENT = address(0x6900);
    address private constant CLAIMS_RECEIVER = address(0xC1A1);

    SupplyMiningCodeMock private _timelock;
    SupplyMiningCodeMock private _pool;
    GBXToken private _token;
    EmissionController private _controller;

    function setUp() external {
        _timelock = new SupplyMiningCodeMock();
        _pool = new SupplyMiningCodeMock();
        _token = new GBXToken(GENESIS_RECIPIENT, address(this), address(_timelock));
        _controller = new EmissionController(_token, address(_pool), 0, INITIAL_DAILY_EMISSION);
        _token.initializeEmissionController(address(_controller));
    }

    function test_ConstructorStoresTheCanonicalInitialMiningSchedule() external view {
        assertEq(address(_controller.gbx()), address(_token));
        assertEq(_controller.miningPool(), address(_pool));
        assertEq(_controller.nextMiningEpochId(), 0);
        assertEq(_controller.INITIAL_DAILY_SCHEDULED_EMISSION(), INITIAL_DAILY_EMISSION);
        assertEq(_controller.currentScheduledEmission(), INITIAL_DAILY_EMISSION);
        assertEq(_controller.remainingMintCapacity(), 980_000_000 ether);
    }

    function test_ConstructorRejectsInvalidTokenPoolAndOversizedSchedule() external {
        vm.expectRevert(EmissionController.EmissionController__InvalidConfiguration.selector);
        new EmissionController(IGBXToken(address(0)), address(_pool), 0, INITIAL_DAILY_EMISSION);

        vm.expectRevert(EmissionController.EmissionController__InvalidConfiguration.selector);
        new EmissionController(IGBXToken(address(0xBEEF)), address(_pool), 0, INITIAL_DAILY_EMISSION);

        vm.expectRevert(EmissionController.EmissionController__InvalidConfiguration.selector);
        new EmissionController(_token, address(0), 0, INITIAL_DAILY_EMISSION);

        vm.expectRevert(EmissionController.EmissionController__InvalidConfiguration.selector);
        new EmissionController(_token, address(0xBEEF), 0, INITIAL_DAILY_EMISSION);

        uint256 oversizedSchedule = _token.MAX_CUMULATIVE_MINT() + 1;
        vm.expectRevert(EmissionController.EmissionController__InvalidConfiguration.selector);
        new EmissionController(_token, address(_pool), 0, oversizedSchedule);
    }

    function test_ScheduledEmissionMatchesIndependentSequentialFloorVectors() external view {
        assertEq(_controller.scheduledEmission(0), 465_152_749_681_042_811_702_004);
        assertEq(_controller.scheduledEmission(1), 464_931_966_945_802_163_687_533);
        assertEq(_controller.scheduledEmission(2), 464_711_289_004_129_249_641_614);
        assertEq(_controller.scheduledEmission(30), 458_574_651_527_554_231_366_536);
        assertEq(_controller.scheduledEmission(365), 391_145_279_752_197_254_551_815);
        assertEq(_controller.scheduledEmission(1_460), 232_576_374_840_521_271_244_695);
        assertEq(_controller.scheduledEmission(2_920), 116_288_187_420_260_568_318_929);
    }

    function test_EmptyEpochAdvancesWithoutMintOrCarryAndNextNonemptyEpochMintsItsExactSchedule() external {
        uint256 supplyBefore = _token.totalSupply();

        vm.prank(address(_pool));
        uint256 emptyEmission = _controller.settleMiningEpoch(0, CLAIMS_RECEIVER, false);

        assertEq(emptyEmission, 0);
        assertEq(_token.totalSupply(), supplyBefore);
        assertEq(_token.balanceOf(CLAIMS_RECEIVER), 0);
        assertEq(_controller.nextMiningEpochId(), 1);
        assertEq(_controller.currentScheduledEmission(), _controller.scheduledEmission(1));

        uint256 epochOneSchedule = _controller.scheduledEmission(1);
        vm.prank(address(_pool));
        uint256 nonemptyEmission = _controller.settleMiningEpoch(1, CLAIMS_RECEIVER, true);

        assertEq(nonemptyEmission, epochOneSchedule);
        assertEq(_token.balanceOf(CLAIMS_RECEIVER), epochOneSchedule);
        assertEq(_token.totalSupply(), supplyBefore + epochOneSchedule);
        assertEq(_controller.nextMiningEpochId(), 2);
        assertEq(_controller.currentScheduledEmission(), _controller.scheduledEmission(2));
    }

    function test_SettlementEnforcesPoolControllerReceiverAndSequentialEpoch() external {
        vm.expectRevert(
            abi.encodeWithSelector(EmissionController.EmissionController__Unauthorized.selector, address(this))
        );
        _controller.settleMiningEpoch(0, CLAIMS_RECEIVER, false);

        vm.prank(address(_pool));
        vm.expectRevert(EmissionController.EmissionController__ZeroReceiver.selector);
        _controller.settleMiningEpoch(0, address(0), false);

        vm.prank(address(_pool));
        vm.expectRevert(abi.encodeWithSelector(EmissionController.EmissionController__UnexpectedEpoch.selector, 0, 1));
        _controller.settleMiningEpoch(1, CLAIMS_RECEIVER, false);

        EmissionController unbound = new EmissionController(_token, address(_pool), 0, INITIAL_DAILY_EMISSION);
        vm.prank(address(_pool));
        vm.expectRevert(
            abi.encodeWithSelector(
                EmissionController.EmissionController__ControllerMismatch.selector, address(_controller)
            )
        );
        unbound.settleMiningEpoch(0, CLAIMS_RECEIVER, false);
    }
}
