// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";

import { LaunchGuardHook } from "../../../src/liquidity/LaunchGuardHook.sol";
import { GenesisPriceMath } from "../../../src/libraries/GenesisPriceMath.sol";
import {
    GenesisPriceMathHarness,
    LaunchGuardHookHarness,
    LaunchGuardPoolManagerCaller
} from "../mocks/LaunchGuardHookHarness.sol";

contract LaunchGuardHookTest is Test {
    address private constant LIQUIDITY_MANAGER = address(0x6900);
    address private constant GBX = address(0x1000);
    address private constant USDG = address(0x2000);
    uint160 private constant Q96 = 1 << 96;
    uint160 private constant LOW_USDG_GBX_TOKEN1_SQRT_PRICE_X96 =
        708_638_228_457_182_841_184_406_864_642_904_026_128_471;

    LaunchGuardPoolManagerCaller private poolManagerCaller;
    LaunchGuardHookHarness private hook;
    GenesisPriceMathHarness private math;

    function setUp() public {
        poolManagerCaller = new LaunchGuardPoolManagerCaller();
        vm.etch(LIQUIDITY_MANAGER, hex"00");
        hook = new LaunchGuardHookHarness(IPoolManager(address(poolManagerCaller)), address(this), GBX, USDG, 3_000, 60);
        hook.initializeLiquidityManager(LIQUIDITY_MANAGER);
        math = new GenesisPriceMathHarness();
    }

    function test_AllowsOnlyCanonicalPoolInitializationByLiquidityManager() public {
        PoolKey memory key = _canonicalKey();
        bytes4 response = poolManagerCaller.beforeInitialize(hook, LIQUIDITY_MANAGER, key, Q96);

        assertEq(response, IHooks.beforeInitialize.selector);
        assertTrue(hook.canonicalPoolInitialized());
    }

    function test_RejectsUnauthorizedInitializerAndSecondInitialization() public {
        PoolKey memory key = _canonicalKey();
        vm.expectRevert(
            abi.encodeWithSelector(LaunchGuardHook.LaunchGuardHook__UnauthorizedInitializer.selector, address(this))
        );
        poolManagerCaller.beforeInitialize(hook, address(this), key, Q96);

        poolManagerCaller.beforeInitialize(hook, LIQUIDITY_MANAGER, key, Q96);
        vm.expectRevert(LaunchGuardHook.LaunchGuardHook__AlreadyInitialized.selector);
        poolManagerCaller.beforeInitialize(hook, LIQUIDITY_MANAGER, key, Q96);
    }

    function test_RejectsDifferentFeeOrHookPoolKey() public {
        PoolKey memory key = _canonicalKey();
        key.fee = 500;
        vm.expectRevert(LaunchGuardHook.LaunchGuardHook__InvalidPoolKey.selector);
        poolManagerCaller.beforeInitialize(hook, LIQUIDITY_MANAGER, key, Q96);
    }

    function test_LiquidityManagerDependencyIsSetOnceAndMustHaveCode() public {
        address noCodeManager = address(0xDEAD);
        LaunchGuardHookHarness fresh =
            new LaunchGuardHookHarness(IPoolManager(address(poolManagerCaller)), address(this), GBX, USDG, 3_000, 60);
        vm.expectRevert(
            abi.encodeWithSelector(
                LaunchGuardHook.LaunchGuardHook__LiquidityManagerMustBeContract.selector, noCodeManager
            )
        );
        fresh.initializeLiquidityManager(noCodeManager);

        fresh.initializeLiquidityManager(address(poolManagerCaller));
        vm.expectRevert(LaunchGuardHook.LaunchGuardHook__LiquidityManagerAlreadyInitialized.selector);
        fresh.initializeLiquidityManager(address(poolManagerCaller));
    }

    function test_GenesisPriceUsesTokenOrderingAndSignedTickAlignment() public view {
        assertEq(math.sqrtPriceX96(GBX, USDG, 80_000_000 ether, 80_000_000 ether), Q96);
        assertEq(math.sqrtPriceX96(USDG, GBX, 80_000_000 ether, 80_000_000 ether), Q96);
        math.validateSqrtPriceX96(GBX, USDG, 80_000_000 ether, 80_000_000 ether, Q96);
        math.validateSqrtPriceX96(USDG, GBX, 80_000_000 ether, 80_000_000 ether, Q96);
        assertEq(math.alignDown(121, 60), 120);
        assertEq(math.alignUp(121, 60), 180);
        assertEq(math.alignDown(-121, 60), -180);
        assertEq(math.alignUp(-121, 60), -120);
    }

    function test_ValidatesOfficialSDKWitnessOutsideTheOldUint256IntermediateDomain() public view {
        math.validateSqrtPriceX96(USDG, GBX, 1, 80_000_000 ether, LOW_USDG_GBX_TOKEN1_SQRT_PRICE_X96);
    }

    function testFuzz_ValidatesUniqueFixtureFloorAcrossBothCurrencyOrders(uint256 communityUSDG) public {
        communityUSDG = bound(communityUSDG, 1_000_000e6, 80_000_000e6);
        _assertUniqueWitness(GBX, USDG, communityUSDG);
        _assertUniqueWitness(USDG, GBX, communityUSDG);
    }

    function test_RejectsNeighboringWitnessesAndOfficialTickBounds() public {
        vm.expectRevert(
            abi.encodeWithSelector(GenesisPriceMath.GenesisPriceMath__PriceDoesNotMatchAmounts.selector, Q96 - 1)
        );
        math.validateSqrtPriceX96(GBX, USDG, 80_000_000 ether, 80_000_000 ether, Q96 - 1);

        vm.expectRevert(
            abi.encodeWithSelector(GenesisPriceMath.GenesisPriceMath__PriceDoesNotMatchAmounts.selector, Q96 + 1)
        );
        math.validateSqrtPriceX96(GBX, USDG, 80_000_000 ether, 80_000_000 ether, Q96 + 1);

        uint160 belowMinimum = TickMath.MIN_SQRT_PRICE - 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                GenesisPriceMath.GenesisPriceMath__PriceOutsideTickBounds.selector, uint256(belowMinimum)
            )
        );
        math.validateSqrtPriceX96(GBX, USDG, 80_000_000 ether, 80_000_000 ether, belowMinimum);

        vm.expectRevert(
            abi.encodeWithSelector(
                GenesisPriceMath.GenesisPriceMath__PriceOutsideTickBounds.selector, uint256(TickMath.MAX_SQRT_PRICE)
            )
        );
        math.validateSqrtPriceX96(GBX, USDG, 80_000_000 ether, 80_000_000 ether, TickMath.MAX_SQRT_PRICE);
    }

    function test_Token0OneSidedBoundaryAdvancesOnlyWhenPriceIsInsideAlignedTick() public view {
        uint160 exactBoundary = TickMath.getSqrtPriceAtTick(120);

        assertEq(math.oneSidedGBXBoundary(exactBoundary, 120, 60, true), 120);
        assertEq(math.oneSidedGBXBoundary(exactBoundary + 1, 120, 60, true), 180);
        assertEq(math.oneSidedGBXBoundary(TickMath.getSqrtPriceAtTick(121), 121, 60, true), 180);
    }

    function test_Token1OneSidedBoundaryUsesHalfOpenUpperBoundary() public view {
        uint160 insideAlignedTick = TickMath.getSqrtPriceAtTick(120) + 1;

        assertEq(math.oneSidedGBXBoundary(insideAlignedTick, 120, 60, false), 120);
        assertEq(math.oneSidedGBXBoundary(TickMath.getSqrtPriceAtTick(121), 121, 60, false), 120);
    }

    function _canonicalKey() private view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(GBX),
            currency1: Currency.wrap(USDG),
            fee: 3_000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _assertUniqueWitness(address gbx, address usdG, uint256 communityUSDG) private {
        uint160 candidate = math.sqrtPriceX96(gbx, usdG, communityUSDG, 80_000_000 ether);
        math.validateSqrtPriceX96(gbx, usdG, communityUSDG, 80_000_000 ether, candidate);

        vm.expectRevert(
            abi.encodeWithSelector(GenesisPriceMath.GenesisPriceMath__PriceDoesNotMatchAmounts.selector, candidate - 1)
        );
        math.validateSqrtPriceX96(gbx, usdG, communityUSDG, 80_000_000 ether, candidate - 1);

        vm.expectRevert(
            abi.encodeWithSelector(GenesisPriceMath.GenesisPriceMath__PriceDoesNotMatchAmounts.selector, candidate + 1)
        );
        math.validateSqrtPriceX96(gbx, usdG, communityUSDG, 80_000_000 ether, candidate + 1);
    }
}
