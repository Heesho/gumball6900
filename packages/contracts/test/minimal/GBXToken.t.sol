// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IGBXToken } from "../../src/interfaces/IGBXToken.sol";
import { GBXToken } from "../../src/token/GBXToken.sol";
import {
    SupplyMiningCodeMock,
    SupplyMiningCompatibleControllerMock,
    SupplyMiningMalformedControllerMock,
    SupplyMiningRevertingControllerMock
} from "./mocks/SupplyMiningMocks.sol";

contract MinimalGBXTokenTest is Test {
    address private constant GENESIS_RECIPIENT = address(0x6900);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    SupplyMiningCodeMock private _timelock;
    SupplyMiningCodeMock private _pool;
    GBXToken private _token;

    event GBXToken__EmissionControllerInitialized(address indexed controller);
    event GBXToken__EmissionControllerReplaced(address indexed previousController, address indexed newController);
    event GBXToken__Minted(address indexed receiver, uint256 amount, uint256 cumulativeMintedAfter);
    event GBXToken__Burned(
        address indexed operator, address indexed account, uint256 amount, uint256 cumulativeBurnedAfter
    );

    function setUp() external {
        _timelock = new SupplyMiningCodeMock();
        _pool = new SupplyMiningCodeMock();
        _token = new GBXToken(GENESIS_RECIPIENT, address(this), address(_timelock));
    }

    function test_ConstructorMintsOnlyTheOneTimeTwentyMillionAllocation() external {
        assertEq(_token.name(), "GUM BALL 6900");
        assertEq(_token.symbol(), "GBX");
        assertEq(_token.decimals(), 18);
        assertEq(_token.MAX_CUMULATIVE_MINT(), 1_000_000_000 ether);
        assertEq(_token.GENESIS_LIQUIDITY_ALLOCATION(), 20_000_000 ether);
        assertEq(_token.balanceOf(GENESIS_RECIPIENT), 20_000_000 ether);
        assertEq(_token.totalSupply(), 20_000_000 ether);
        assertEq(_token.cumulativeMinted(), 20_000_000 ether);
        assertEq(_token.cumulativeBurned(), 0);
        assertEq(_token.remainingMintCapacity(), 980_000_000 ether);

        SupplyMiningCompatibleControllerMock controller =
            new SupplyMiningCompatibleControllerMock(_token, address(_pool), 0);
        vm.expectEmit(true, false, false, true, address(_token));
        emit GBXToken__EmissionControllerInitialized(address(controller));
        _token.initializeEmissionController(address(controller));

        assertEq(_token.totalSupply(), 20_000_000 ether, "controller binding must not mint a second genesis lot");
        vm.expectRevert(GBXToken.GBXToken__AlreadyInitialized.selector);
        _token.initializeEmissionController(address(controller));
    }

    function test_InitialControllerBindingValidatesAuthorityCodeTokenAndPool() external {
        SupplyMiningCompatibleControllerMock valid = new SupplyMiningCompatibleControllerMock(_token, address(_pool), 0);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__Unauthorized.selector, ALICE));
        _token.initializeEmissionController(address(valid));

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, address(0)));
        _token.initializeEmissionController(address(0));

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, ALICE));
        _token.initializeEmissionController(ALICE);

        SupplyMiningCompatibleControllerMock wrongToken =
            new SupplyMiningCompatibleControllerMock(IGBXToken(address(_timelock)), address(_pool), 0);
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, address(wrongToken)));
        _token.initializeEmissionController(address(wrongToken));

        SupplyMiningCompatibleControllerMock zeroPool = new SupplyMiningCompatibleControllerMock(_token, address(0), 0);
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, address(zeroPool)));
        _token.initializeEmissionController(address(zeroPool));

        _token.initializeEmissionController(address(valid));
        assertEq(_token.emissionController(), address(valid));
        assertEq(_token.canonicalMiningPool(), address(_pool));
    }

    function test_ControllerValidationConvertsEachFaultingIdentityGetterIntoCompatibilityFailure() external {
        SupplyMiningMalformedControllerMock revertingGBX =
            new SupplyMiningMalformedControllerMock(_token, address(_pool), 0, 1, true, false);
        vm.expectRevert(
            abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, address(revertingGBX))
        );
        _token.initializeEmissionController(address(revertingGBX));

        SupplyMiningMalformedControllerMock revertingPool =
            new SupplyMiningMalformedControllerMock(_token, address(_pool), 0, 1, false, true);
        vm.expectRevert(
            abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, address(revertingPool))
        );
        _token.initializeEmissionController(address(revertingPool));
    }

    function test_ConstructorAndReplacementStateMachineRejectEveryInvalidBoundary() external {
        vm.expectRevert(GBXToken.GBXToken__ZeroAddress.selector);
        new GBXToken(address(0), address(this), address(_timelock));
        vm.expectRevert(GBXToken.GBXToken__ZeroAddress.selector);
        new GBXToken(GENESIS_RECIPIENT, address(0), address(_timelock));
        vm.expectRevert(GBXToken.GBXToken__ZeroAddress.selector);
        new GBXToken(GENESIS_RECIPIENT, address(this), address(0));
        vm.expectRevert(GBXToken.GBXToken__ZeroAddress.selector);
        new GBXToken(GENESIS_RECIPIENT, address(this), ALICE);

        SupplyMiningCompatibleControllerMock candidate =
            new SupplyMiningCompatibleControllerMock(_token, address(_pool), 0);
        vm.prank(address(_timelock));
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, address(candidate)));
        _token.replaceEmissionController(address(candidate));

        _token.initializeEmissionController(address(candidate));
        vm.prank(address(_timelock));
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, address(candidate)));
        _token.replaceEmissionController(address(candidate));
    }

    function test_ReplacementUsesCachedPoolAndNeverCallsRevertingCurrentController() external {
        SupplyMiningRevertingControllerMock current = new SupplyMiningRevertingControllerMock(_token, address(_pool));
        _token.initializeEmissionController(address(current));
        current.setRevertIdentityReads(true);

        SupplyMiningCompatibleControllerMock replacement =
            new SupplyMiningCompatibleControllerMock(_token, address(_pool), 999);
        vm.prank(address(_timelock));
        vm.expectEmit(true, true, false, true, address(_token));
        emit GBXToken__EmissionControllerReplaced(address(current), address(replacement));
        _token.replaceEmissionController(address(replacement));

        assertEq(_token.emissionController(), address(replacement));
        assertEq(_token.canonicalMiningPool(), address(_pool));

        SupplyMiningCodeMock wrongPool = new SupplyMiningCodeMock();
        SupplyMiningCompatibleControllerMock wrongPoolReplacement =
            new SupplyMiningCompatibleControllerMock(_token, address(wrongPool), 999);
        vm.prank(address(_timelock));
        vm.expectRevert(
            abi.encodeWithSelector(GBXToken.GBXToken__IncompatibleController.selector, address(wrongPoolReplacement))
        );
        _token.replaceEmissionController(address(wrongPoolReplacement));
        assertEq(_token.emissionController(), address(replacement));
    }

    function test_OnlyCurrentControllerCanMintAndSupplyIdentitySurvivesBothBurnPaths() external {
        SupplyMiningCompatibleControllerMock controller =
            new SupplyMiningCompatibleControllerMock(_token, address(_pool), 0);
        _token.initializeEmissionController(address(controller));

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__Unauthorized.selector, address(this)));
        _token.mintMiningEmission(ALICE, 1 ether);

        vm.expectEmit(true, false, false, true, address(_token));
        emit GBXToken__Minted(ALICE, 100 ether, 20_000_100 ether);
        controller.mint(ALICE, 100 ether);

        vm.prank(ALICE);
        vm.expectEmit(true, true, false, true, address(_token));
        emit GBXToken__Burned(ALICE, ALICE, 40 ether, 40 ether);
        _token.burn(40 ether);

        vm.prank(ALICE);
        _token.approve(BOB, 25 ether);
        vm.prank(BOB);
        vm.expectEmit(true, true, false, true, address(_token));
        emit GBXToken__Burned(BOB, ALICE, 25 ether, 65 ether);
        _token.burnFrom(ALICE, 25 ether);

        assertEq(_token.allowance(ALICE, BOB), 0);
        assertEq(_token.balanceOf(ALICE), 35 ether);
        assertEq(_token.cumulativeMinted(), 20_000_100 ether);
        assertEq(_token.cumulativeBurned(), 65 ether);
        assertEq(_token.totalSupply(), _token.cumulativeMinted() - _token.cumulativeBurned());
        assertEq(_token.remainingMintCapacity(), _token.MAX_CUMULATIVE_MINT() - _token.cumulativeMinted());
    }

    function test_CompatibleMaliciousReplacementCanAccelerateButCannotExceedLifetimeCap() external {
        SupplyMiningCompatibleControllerMock oldController =
            new SupplyMiningCompatibleControllerMock(_token, address(_pool), 0);
        SupplyMiningCompatibleControllerMock maliciousController =
            new SupplyMiningCompatibleControllerMock(_token, address(_pool), 0);
        _token.initializeEmissionController(address(oldController));

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__Unauthorized.selector, address(this)));
        _token.replaceEmissionController(address(maliciousController));

        vm.prank(address(_timelock));
        _token.replaceEmissionController(address(maliciousController));
        assertEq(_token.emissionController(), address(maliciousController));

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__Unauthorized.selector, address(oldController)));
        oldController.mint(ALICE, 1);

        maliciousController.mintRemaining(ALICE);
        assertEq(_token.cumulativeMinted(), _token.MAX_CUMULATIVE_MINT());
        assertEq(_token.totalSupply(), _token.MAX_CUMULATIVE_MINT());
        assertEq(_token.remainingMintCapacity(), 0);

        vm.prank(ALICE);
        _token.burn(10_000_000 ether);
        assertEq(_token.remainingMintCapacity(), 0, "burning must not reopen lifetime mint capacity");
        assertEq(_token.totalSupply(), _token.cumulativeMinted() - _token.cumulativeBurned());

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__CumulativeMintCapExceeded.selector, 1, 0));
        maliciousController.mint(ALICE, 1);
    }

    function test_MintAndBurnRejectInvalidZeroArguments() external {
        SupplyMiningCompatibleControllerMock controller =
            new SupplyMiningCompatibleControllerMock(_token, address(_pool), 0);
        _token.initializeEmissionController(address(controller));

        vm.expectRevert(GBXToken.GBXToken__ZeroAddress.selector);
        controller.mint(address(0), 1);
        vm.expectRevert(GBXToken.GBXToken__ZeroAmount.selector);
        controller.mint(ALICE, 0);

        vm.prank(ALICE);
        vm.expectRevert(GBXToken.GBXToken__ZeroAmount.selector);
        _token.burn(0);

        vm.expectRevert(GBXToken.GBXToken__ZeroAddress.selector);
        _token.burnFrom(address(0), 1);
        vm.expectRevert(GBXToken.GBXToken__ZeroAmount.selector);
        _token.burnFrom(ALICE, 0);
    }

    function testFuzz_CumulativeSupplyIdentityAndCapacitySurviveBurns(uint256 mintAmount, uint256 burnAmount)
        external
    {
        SupplyMiningCompatibleControllerMock controller =
            new SupplyMiningCompatibleControllerMock(_token, address(_pool), 0);
        _token.initializeEmissionController(address(controller));

        mintAmount = bound(mintAmount, 1, _token.remainingMintCapacity());
        controller.mint(ALICE, mintAmount);
        burnAmount = bound(burnAmount, 0, mintAmount);
        if (burnAmount != 0) {
            vm.prank(ALICE);
            _token.burn(burnAmount);
        }

        assertLe(_token.cumulativeMinted(), _token.MAX_CUMULATIVE_MINT());
        assertEq(_token.totalSupply(), _token.cumulativeMinted() - _token.cumulativeBurned());
        assertEq(_token.remainingMintCapacity(), _token.MAX_CUMULATIVE_MINT() - _token.cumulativeMinted());
    }
}
