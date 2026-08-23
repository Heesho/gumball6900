// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Test } from "forge-std/Test.sol";

import { PoolManager } from "@uniswap/v4-core/src/PoolManager.sol";
import { PoolSwapTest } from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { IPositionDescriptor } from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { IWETH9 } from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { PositionManager } from "@uniswap/v4-periphery/src/PositionManager.sol";
import { IAllowanceTransfer } from "permit2/src/interfaces/IAllowanceTransfer.sol";

import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { ILiquidityRevenueRouter, LiquidityPosition } from "../../src/core/LiquidityPosition.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { IFund } from "../../src/core/interfaces/IFund.sol";
import { MockERC20 } from "../minimal/utils/Tokens.sol";

/// @notice USDG receiver used behind the genuine ResonanceRouter in the v4 integration suite.
contract FeeRevenueReceiverMock {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdg;
    uint256 public totalReceived;
    bool public frozen;

    constructor(IERC20 usdg_) {
        usdg = usdg_;
    }

    function setFrozen(bool frozen_) external {
        frozen = frozen_;
    }

    function left() external pure returns (uint256) {
        return 0;
    }

    function DURATION() external pure returns (uint256) {
        return 7 days;
    }

    function notifyRevenue(uint256 amount) external {
        require(!frozen, "FEE_REVENUE_FROZEN");
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        totalReceived += amount;
    }
}

/// @title LiquidityFeeHarvestTest
/// @notice Integration coverage of fixed-principal fee harvesting against genuine Uniswap v4 contracts.
/// @dev PoolManager and PositionManager are the pinned production implementations. Permit2 is stubbed only for
///      genesis minting and test swaps; LiquidityPosition itself has no Permit2 dependency or token approval.
contract LiquidityFeeHarvestTest is Test {
    uint256 private constant TOKEN_ID = 1;
    address private constant HARVESTER = address(0x5EA12);
    address private constant TRADER = address(0x712AD3);
    uint24 private constant POOL_FEE = 3_000;
    int24 private constant TICK_SPACING = 60;

    PoolManager private poolManager;
    Permit2Stub private permit2;
    PositionManager private positionManager;
    PoolSwapTest private swapRouter;

    GBX private gbx;
    MockERC20 private usdg;
    Fund private fund;
    FeeRevenueReceiverMock private revenueReceiver;
    ResonanceRouter private resonanceRouter;
    LiquidityPosition private position;
    PoolKey private poolKey;
    int24 private tickLower;
    int24 private tickUpper;

    function setUp() external {
        vm.warp(365 days);

        poolManager = new PoolManager(address(this));
        permit2 = new Permit2Stub();
        positionManager = new PositionManager(
            poolManager,
            IAllowanceTransfer(address(permit2)),
            100_000,
            IPositionDescriptor(address(0)),
            IWETH9(address(0))
        );
        swapRouter = new PoolSwapTest(poolManager);

        gbx = new GBX(address(this), address(this));
        usdg = new MockERC20("Global Dollar", "USDG", 18);
        usdg.mint(address(this), 100_000_000 ether);
        fund = new Fund(gbx);
        revenueReceiver = new FeeRevenueReceiverMock(IERC20(address(usdg)));
        resonanceRouter = new ResonanceRouter(IERC20(address(usdg)), address(revenueReceiver));

        (address token0, address token1) =
            address(gbx) < address(usdg) ? (address(gbx), address(usdg)) : (address(usdg), address(gbx));
        poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        tickLower = -6_000;
        tickUpper = 6_000;
        poolManager.initialize(poolKey, TickMath.getSqrtPriceAtTick(0));

        _approveAll(address(this));
        _mintCanonicalPosition();

        position = _deployPosition(address(this));
        IERC721(address(positionManager)).safeTransferFrom(address(this), address(position), TOKEN_ID);
    }

    function test_UniswapV4ZeroLiquidityDecreaseCollectsFeesWithoutRemovingPrincipal() external {
        _generateFees(40 ether);

        uint128 principalBefore = positionManager.getPositionLiquidity(TOKEN_ID);
        uint256 supplyBefore = gbx.totalSupply();
        uint256 revenueBefore = revenueReceiver.totalReceived();
        uint256 harvesterGBXBefore = gbx.balanceOf(HARVESTER);
        uint256 harvesterUSDGBefore = usdg.balanceOf(HARVESTER);

        vm.prank(HARVESTER);
        (uint256 usdgRouted, uint256 gbxBurned) = position.harvestFees();

        assertGt(usdgRouted, 0, "two-way volume must create USDG fees");
        assertGt(gbxBurned, 0, "two-way volume must create GBX fees");
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), principalBefore, "principal must remain fixed");
        assertEq(revenueReceiver.totalReceived() - revenueBefore, usdgRouted, "USDG reaches Resonance ingress");
        assertEq(supplyBefore - gbx.totalSupply(), gbxBurned, "harvested GBX is burned");
        assertEq(gbx.balanceOf(address(fund)), 0, "Fund burns exactly what harvest supplies");
        assertEq(gbx.balanceOf(HARVESTER), harvesterGBXBefore, "caller receives no GBX bounty");
        assertEq(usdg.balanceOf(HARVESTER), harvesterUSDGBefore, "caller receives no USDG bounty");
        assertEq(IERC721(address(positionManager)).ownerOf(TOKEN_ID), address(position), "custody is unchanged");
    }

    function test_RepeatedHarvestsNeverChangePrincipal() external {
        uint128 principal = positionManager.getPositionLiquidity(TOKEN_ID);

        for (uint256 i; i < 5; ++i) {
            _generateFees(30 ether);
            position.harvestFees();
            assertEq(positionManager.getPositionLiquidity(TOKEN_ID), principal);
        }
    }

    function test_HarvestRetainsNoCanonicalTokens() external {
        _generateFees(40 ether);
        position.harvestFees();

        assertEq(gbx.balanceOf(address(position)), 0);
        assertEq(usdg.balanceOf(address(position)), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(gbx.balanceOf(address(fund)), 0);
    }

    function test_DirectCanonicalDonationsFollowTheSameDestinations() external {
        gbx.transfer(address(position), 3 ether);
        usdg.mint(address(position), 7 ether);
        uint256 supplyBefore = gbx.totalSupply();

        (uint256 usdgRouted, uint256 gbxBurned) = position.harvestFees();

        assertEq(usdgRouted, 7 ether);
        assertEq(gbxBurned, 3 ether);
        assertEq(revenueReceiver.totalReceived(), 7 ether);
        assertEq(supplyBefore - gbx.totalSupply(), 3 ether);
    }

    function test_HarvestWithNoFeesIsANoOp() external {
        uint128 principal = positionManager.getPositionLiquidity(TOKEN_ID);
        uint256 supply = gbx.totalSupply();

        (uint256 usdgRouted, uint256 gbxBurned) = position.harvestFees();

        assertEq(usdgRouted, 0);
        assertEq(gbxBurned, 0);
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), principal);
        assertEq(gbx.totalSupply(), supply);
    }

    function test_HarvestRequiresARecordedPositionInCustody() external {
        LiquidityPosition fresh = _deployPosition(address(this));

        vm.expectRevert(LiquidityPosition.NoPositionRecorded.selector);
        fresh.harvestFees();
    }

    function test_HarvestIsPermissionless() external {
        _generateFees(40 ether);

        vm.prank(address(0xC0FFEE));
        position.harvestFees();
    }

    function test_RoutingFailureAtomicallyRestoresTheFeeEntitlementAndBurn() external {
        _generateFees(40 ether);
        uint128 principal = positionManager.getPositionLiquidity(TOKEN_ID);
        uint256 supply = gbx.totalSupply();
        revenueReceiver.setFrozen(true);

        vm.expectRevert(bytes("FEE_REVENUE_FROZEN"));
        position.harvestFees();

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), principal);
        assertEq(gbx.totalSupply(), supply, "GBX burn must roll back with failed USDG routing");
        assertEq(gbx.balanceOf(address(position)), 0, "collection itself must roll back");
        assertEq(usdg.balanceOf(address(position)), 0, "collection itself must roll back");

        revenueReceiver.setFrozen(false);
        (uint256 usdgRouted, uint256 gbxBurned) = position.harvestFees();
        assertGt(usdgRouted, 0);
        assertGt(gbxBurned, 0);
    }

    function test_HarvestStillWorksAfterPriceLeavesTheRange() external {
        _generateFees(30 ether);
        _swapOneWay(2_000 ether, true);
        uint128 principal = positionManager.getPositionLiquidity(TOKEN_ID);

        (uint256 usdgRouted, uint256 gbxBurned) = position.harvestFees();

        assertGt(usdgRouted + gbxBurned, 0);
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), principal);
    }

    function test_CompoundingAndCallerFundingSurfacesAreGone() external {
        (bool compoundSucceeded, bytes memory compoundData) = address(position)
            .call(abi.encodeWithSignature("compound(uint128,uint128,uint256)", uint128(0), uint128(0), block.timestamp));
        assertFalse(compoundSucceeded);
        assertEq(compoundData.length, 0);

        (bool requirementSucceeded, bytes memory requirementData) =
            address(position).call(abi.encodeWithSignature("compoundRequirement()"));
        assertFalse(requirementSucceeded);
        assertEq(requirementData.length, 0);

        (bool permitSucceeded, bytes memory permitData) = address(position).call(abi.encodeWithSignature("permit2()"));
        assertFalse(permitSucceeded);
        assertEq(permitData.length, 0);
    }

    function testFuzz_HarvestIsExactAndPrincipalIsFixed(uint256 volume) external {
        _generateFees(bound(volume, 0.01 ether, 150 ether));
        uint128 principal = positionManager.getPositionLiquidity(TOKEN_ID);
        uint256 supplyBefore = gbx.totalSupply();
        uint256 revenueBefore = revenueReceiver.totalReceived();

        (uint256 usdgRouted, uint256 gbxBurned) = position.harvestFees();

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), principal);
        assertEq(revenueReceiver.totalReceived() - revenueBefore, usdgRouted);
        assertEq(supplyBefore - gbx.totalSupply(), gbxBurned);
        assertEq(gbx.balanceOf(address(position)), 0);
        assertEq(usdg.balanceOf(address(position)), 0);
    }

    function _deployPosition(address depositor) private returns (LiquidityPosition deployed) {
        return new LiquidityPosition(
            LiquidityPosition.Dependencies({
                positionManager: IPositionManager(address(positionManager)),
                positionDepositor: depositor,
                expectedPositionTokenId: TOKEN_ID,
                gbx: gbx,
                usdg: IERC20(address(usdg)),
                resonanceRouter: ILiquidityRevenueRouter(address(resonanceRouter)),
                fund: IFund(address(fund))
            }),
            poolKey,
            tickLower,
            tickUpper
        );
    }

    function _approveAll(address account) private {
        vm.startPrank(account);
        gbx.approve(address(permit2), type(uint256).max);
        usdg.approve(address(permit2), type(uint256).max);
        permit2.approve(address(gbx), address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(address(usdg), address(positionManager), type(uint160).max, type(uint48).max);
        gbx.approve(address(swapRouter), type(uint256).max);
        usdg.approve(address(swapRouter), type(uint256).max);
        vm.stopPrank();
    }

    function _mintCanonicalPosition() private {
        bytes memory actions = new bytes(2);
        actions[0] = bytes1(uint8(Actions.MINT_POSITION));
        actions[1] = bytes1(uint8(Actions.SETTLE_PAIR));

        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            uint256(1_000 ether),
            type(uint128).max,
            type(uint128).max,
            address(this),
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);

        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    function _generateFees(uint256 amount) private {
        gbx.transfer(TRADER, amount * 3);
        usdg.mint(TRADER, amount * 3);
        _approveAll(TRADER);

        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false });

        vm.startPrank(TRADER);
        swapRouter.swap(
            poolKey,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(amount), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            settings,
            bytes("")
        );
        swapRouter.swap(
            poolKey,
            SwapParams({
                zeroForOne: false, amountSpecified: -int256(amount), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            settings,
            bytes("")
        );
        vm.stopPrank();
    }

    function _swapOneWay(uint256 amount, bool zeroForOne) private {
        gbx.transfer(TRADER, amount * 2);
        usdg.mint(TRADER, amount * 2);
        _approveAll(TRADER);

        vm.prank(TRADER);
        swapRouter.swap(
            poolKey,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amount),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false }),
            bytes("")
        );
    }
}

/// @notice Minimal Permit2 stand-in for test-only genesis minting and swaps.
contract Permit2Stub {
    mapping(address owner => mapping(address token => mapping(address spender => uint160 amount))) public allowanceOf;

    function approve(address token, address spender, uint160 amount, uint48) external {
        allowanceOf[msg.sender][token][spender] = amount;
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        uint160 allowed = allowanceOf[from][token][msg.sender];
        require(allowed >= amount, "PERMIT2_STUB_ALLOWANCE");
        if (allowed != type(uint160).max) allowanceOf[from][token][msg.sender] = allowed - amount;
        require(IERC20(token).transferFrom(from, to, amount), "PERMIT2_STUB_TRANSFER");
    }
}
