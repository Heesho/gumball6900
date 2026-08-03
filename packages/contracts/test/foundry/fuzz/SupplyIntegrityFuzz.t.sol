// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { EmissionController } from "../../../src/mining/EmissionController.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GBXTokenMinterMock } from "../mocks/GBXTokenMinterMock.sol";

contract SupplyIntegrityFuzzTest is Test {
    GBXToken private _token;
    GBXTokenMinterMock private _minter;
    EmissionController private _controller;

    address private _holder;

    function setUp() external {
        _holder = makeAddr("holder");

        _token = new GBXToken(address(this), IEligibilityModule(address(0)));
        _minter = new GBXTokenMinterMock();
        _token.initializeEmissionController(address(_minter));

        GBXToken scheduleToken = new GBXToken(address(this), IEligibilityModule(address(0)));
        _controller = new EmissionController(scheduleToken, address(this));
    }

    function testFuzz_MintAndBurnPreserveLifetimeSupplyIdentity(uint256 rawMintAmount, uint256 rawBurnAmount) external {
        uint256 mintAmount = bound(rawMintAmount, 1, _token.MAX_CUMULATIVE_MINT());
        uint256 burnAmount = bound(rawBurnAmount, 1, mintAmount);

        _minter.mint(_token, _holder, mintAmount);

        vm.prank(_holder);
        _token.burn(burnAmount);

        assertLe(_token.cumulativeMinted(), _token.MAX_CUMULATIVE_MINT());
        assertEq(_token.cumulativeMinted(), mintAmount);
        assertEq(_token.cumulativeBurned(), burnAmount);
        assertEq(_token.totalSupply(), _token.cumulativeMinted() - _token.cumulativeBurned());
    }

    function testFuzz_BurnNeverRestoresMintCapacity(uint256 rawBurnAmount) external {
        uint256 maximum = _token.MAX_CUMULATIVE_MINT();
        uint256 burnAmount = bound(rawBurnAmount, 1, maximum);

        _minter.mint(_token, _holder, maximum);

        vm.prank(_holder);
        _token.burn(burnAmount);

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__CumulativeMintCapExceeded.selector, 1, 0));
        _minter.mint(_token, _holder, 1);
    }

    function testFuzz_ScheduledEmissionNeverIncreases(uint32 rawEarlierEpoch, uint32 rawGap) external view {
        uint256 earlierEpoch = bound(uint256(rawEarlierEpoch), 0, 365);
        uint256 gap = bound(uint256(rawGap), 0, 365);
        uint256 laterEpoch = earlierEpoch + gap;

        assertLe(_controller.scheduledEmission(laterEpoch), _controller.scheduledEmission(earlierEpoch));
    }
}
