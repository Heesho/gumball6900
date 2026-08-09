// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { Test } from "forge-std/Test.sol";

import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { PoolManager } from "@uniswap/v4-core/src/PoolManager.sol";
import { PoolSwapTest } from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { IPositionDescriptor } from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import { IWETH9 } from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import { PositionManager } from "@uniswap/v4-periphery/src/PositionManager.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { IAllowanceTransfer } from "permit2/src/interfaces/IAllowanceTransfer.sol";

import { GBX } from "../../src/core/GBX.sol";
import { LiquidityPosition } from "../../src/core/LiquidityPosition.sol";
import { MockERC20 } from "../minimal/utils/Tokens.sol";

/// @title LiquidityCompoundingTest
/// @notice Integration coverage of the auto-compounder against real Uniswap v4 contracts.
/// @dev This suite deploys the genuine `PoolManager` and `PositionManager` from the pinned Uniswap dependencies
///      rather than stand-ins, then generates fees with real swaps. Only Permit2 is stubbed, because canonical
///      Permit2 pins solc 0.8.17 and cannot compile alongside this project. The compounding mechanism depends
///      on v4 netting a position's accrued fees against an increase, which is a property of `PositionManager._increase`
///      and cannot be proven by a mock that simply reimplements the assumption.
contract LiquidityCompoundingTest is Test {
    uint256 private constant TOKEN_ID = 1;
    address private constant SEARCHER = address(0x5EA12);
    address private constant TRADER = address(0x712AD3);

    /// @dev Funding doubles as the slippage ceiling, so callers pass a realistic bound, not uint128 max.
    uint128 private constant FUND_CAP = 50 ether;

    uint24 private constant POOL_FEE = 3_000;
    int24 private constant TICK_SPACING = 60;

    PoolManager private poolManager;
    Permit2Stub private permit2;
    PositionManager private positionManager;
    PoolSwapTest private swapRouter;

    GBX private gbx;
    MockERC20 private usdg;

    LiquidityPosition private position;
    PoolKey private poolKey;
    int24 private tickLower;
    int24 private tickUpper;

    event Compounded(
        uint256 indexed positionTokenId,
        address indexed caller,
        uint128 liquidityAdded,
        uint256 claimed0,
        uint256 claimed1
    );

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

        (address token0, address token1) =
            address(gbx) < address(usdg) ? (address(gbx), address(usdg)) : (address(usdg), address(gbx));
        poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        // A wide two-sided range around parity so swaps in both directions accrue fees to the position.
        tickLower = -6_000;
        tickUpper = 6_000;
        poolManager.initialize(poolKey, TickMath.getSqrtPriceAtTick(0));

        _approveAll(address(this));
        _mintCanonicalPosition();

        position = _deployPosition(address(this));
        IERC721(address(positionManager)).safeTransferFrom(address(this), address(position), TOKEN_ID);
    }

    /*//////////////////////////////////////////////////////////////
                        THE CORE V4 ASSUMPTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Proves the mechanism's foundation: v4 nets accrued fees against an increase, against real contracts.
    /// @dev `PositionManager._increase` computes `(liquidityDelta - feesAccrued)` for slippage, so the position's
    ///      own fees pay for part of the growth and the caller funds only the remainder. Everything else in the
    ///      compounder follows from this.
    function test_UniswapV4NetsAccruedFeesAgainstAnIncrease() external {
        _generateFees(40 ether);

        uint128 required = position.compoundRequirement();
        assertGt(required, 0);

        (uint128 added, uint256 claimed0, uint256 claimed1) = _compound(FUND_CAP, FUND_CAP);

        assertEq(added, required);
        assertGt(claimed0 + claimed1, 0, "the position's accrued fees must reach the caller");
    }

    /*//////////////////////////////////////////////////////////////
                          COMPOUNDING BEHAVIOR
    //////////////////////////////////////////////////////////////*/

    function test_CompoundGrowsThePositionByExactlyTwentyBasisPoints() external {
        _generateFees(40 ether);

        uint128 before = positionManager.getPositionLiquidity(TOKEN_ID);
        uint128 required = position.compoundRequirement();
        assertEq(required, (before * 20) / 10_000);

        _compound(FUND_CAP, FUND_CAP);

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), before + required);
        assertEq(IERC721(address(positionManager)).ownerOf(TOKEN_ID), address(position), "custody is unchanged");
    }

    function test_CompoundingRepeatedlyCompoundsTheLiquidity() external {
        uint128 start = positionManager.getPositionLiquidity(TOKEN_ID);

        for (uint256 i; i < 5; ++i) {
            _generateFees(30 ether);
            _compound(FUND_CAP, FUND_CAP);
        }

        uint128 finish = positionManager.getPositionLiquidity(TOKEN_ID);
        assertGt(finish, start);

        // Five compounding rounds of 20bps each, allowing for per-round integer flooring.
        uint128 expected = start;
        for (uint256 i; i < 5; ++i) {
            expected += (expected * 20) / 10_000;
        }
        assertEq(finish, expected);
    }

    function test_TheContractRetainsNothingAfterCompounding() external {
        _generateFees(40 ether);
        _compound(FUND_CAP, FUND_CAP);

        assertEq(gbx.balanceOf(address(position)), 0, "no GBX may be retained");
        assertEq(usdg.balanceOf(address(position)), 0, "no USDG may be retained");
    }

    /// @notice An unsolicited transfer is swept to the next compounder rather than becoming stuck.
    function test_DonatedTokensAreSweptToTheNextCompounder() external {
        _generateFees(30 ether);
        gbx.transfer(address(position), 3 ether);
        usdg.mint(address(position), 7 ether);

        _compound(FUND_CAP, FUND_CAP);

        assertEq(gbx.balanceOf(address(position)), 0);
        assertEq(usdg.balanceOf(address(position)), 0);
    }

    /// @notice With no fees accrued, compounding is a pure donation that still grows the position.
    function test_CompoundingWithNoFeesIsADonationThatStillGrows() external {
        uint128 before = positionManager.getPositionLiquidity(TOKEN_ID);
        _seedSearcher();

        uint256 fundedTotal = gbx.balanceOf(SEARCHER) + usdg.balanceOf(SEARCHER);

        vm.startPrank(SEARCHER);
        gbx.approve(address(position), type(uint256).max);
        usdg.approve(address(position), type(uint256).max);
        (uint128 added,,) = position.compound(FUND_CAP, FUND_CAP, block.timestamp);
        vm.stopPrank();

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), before + added, "the position still grows");
        assertLt(
            gbx.balanceOf(SEARCHER) + usdg.balanceOf(SEARCHER),
            fundedTotal,
            "with nothing accrued, the caller is strictly out of pocket"
        );
    }

    /*//////////////////////////////////////////////////////////////
                              VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_CompoundRejectsAPassedDeadline() external {
        _seedSearcher();
        vm.startPrank(SEARCHER);
        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.CompoundDeadlinePassed.selector, block.timestamp - 1));
        position.compound(type(uint128).max, type(uint128).max, block.timestamp - 1);
        vm.stopPrank();
    }

    function test_CompoundRequiresARecordedPositionInCustody() external {
        LiquidityPosition fresh = _deployPosition(address(this));

        vm.expectRevert(LiquidityPosition.NoPositionRecorded.selector);
        fresh.compound(0, 0, block.timestamp);
        assertEq(fresh.compoundRequirement(), 0, "an unrecorded position requires nothing");
    }

    /// @notice Slippage bounds are enforced by Uniswap itself and reject an increase priced above the caller's limit.
    function test_CompoundRespectsTheCallersSlippageBounds() external {
        _generateFees(40 ether);
        _seedSearcher();

        vm.startPrank(SEARCHER);
        gbx.approve(address(position), type(uint256).max);
        usdg.approve(address(position), type(uint256).max);
        vm.expectRevert();
        position.compound(1, 1, block.timestamp);
        vm.stopPrank();
    }

    function test_CompoundIsPermissionless() external {
        _generateFees(40 ether);

        // Any address may perform it; there is no keeper role and no allowlist.
        address outsider = address(0xC0FFEE);
        gbx.transfer(outsider, 1_000 ether);
        usdg.mint(outsider, 1_000 ether);

        vm.startPrank(outsider);
        gbx.approve(address(position), type(uint256).max);
        usdg.approve(address(position), type(uint256).max);
        position.compound(FUND_CAP, FUND_CAP, block.timestamp);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                           SEARCHER INCENTIVE
    //////////////////////////////////////////////////////////////*/

    /// @notice The mechanism only pays a searcher once accrued fees exceed the cost of the growth requirement.
    /// @dev This is the whole economic claim: compounding is unprofitable while fees are small, becomes profitable
    ///      as they accumulate, and therefore happens on its own without a keeper, an oracle, or an incentive
    ///      budget. Measured in summed token units, which is a fair numeraire here because the pool sits at parity.
    function test_ASearcherIsPaidOnlyOnceFeesExceedTheGrowthCost() external {
        _generateFees(0.05 ether);
        int256 thinPnl = _compoundProfitAndLoss();
        assertLt(thinPnl, 0, "barely any fees accrued, so compounding must cost the caller");

        // Let real volume accumulate against the position without anyone compounding.
        for (uint256 i; i < 12; ++i) {
            _generateFees(120 ether);
        }

        int256 richPnl = _compoundProfitAndLoss();
        assertGt(richPnl, 0, "once fees exceed the growth cost the caller is paid to compound");
        assertGt(richPnl, thinPnl);
    }

    /// @notice Compounding stays available and correct even after the price leaves the position's range.
    function test_CompoundingStillWorksWhenThePriceLeavesTheRange() external {
        // One swap larger than the range can absorb drives the price to the edge, leaving the position single-sided.
        _swapOneWay(2_000 ether, true);

        uint128 before = positionManager.getPositionLiquidity(TOKEN_ID);
        uint128 required = position.compoundRequirement();
        _compound(FUND_CAP, FUND_CAP);

        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), before + required);
        assertEq(gbx.balanceOf(address(position)), 0);
        assertEq(usdg.balanceOf(address(position)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            IMMUTABILITY
    //////////////////////////////////////////////////////////////*/

    /// @notice Compounding can only ever grow the position: no path removes principal.
    function test_LiquidityIsMonotonicallyNonDecreasing() external {
        uint128 previous = positionManager.getPositionLiquidity(TOKEN_ID);

        for (uint256 i; i < 4; ++i) {
            _generateFees(25 ether);
            _compound(FUND_CAP, FUND_CAP);
            uint128 current = positionManager.getPositionLiquidity(TOKEN_ID);
            assertGe(current, previous);
            previous = current;
        }
    }

    function test_TheOldFeeRoutingSurfaceIsGone() external {
        string[3] memory removed = ["collectFees()", "resonanceRouter()", "migratePosition()"];

        for (uint256 i; i < removed.length; ++i) {
            (bool succeeded, bytes memory returnData) = address(position).call(abi.encodeWithSignature(removed[i]));
            assertFalse(succeeded, string.concat("LiquidityPosition must not expose ", removed[i]));
            assertEq(returnData.length, 0);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice Whatever the trading volume, compounding grows the position by exactly the requirement and retains nothing.
    function testFuzz_CompoundingIsExactAndRetainsNothing(uint256 volume) external {
        uint256 swapAmount = bound(volume, 0.01 ether, 150 ether);
        _generateFees(swapAmount);

        uint128 before = positionManager.getPositionLiquidity(TOKEN_ID);
        uint128 required = position.compoundRequirement();

        (uint128 added,,) = _compound(FUND_CAP, FUND_CAP);

        assertEq(added, required);
        assertEq(positionManager.getPositionLiquidity(TOKEN_ID), before + required);
        assertEq(gbx.balanceOf(address(position)), 0);
        assertEq(usdg.balanceOf(address(position)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                               HELPERS
    //////////////////////////////////////////////////////////////*/

    function _deployPosition(address depositor) private returns (LiquidityPosition deployed) {
        return new LiquidityPosition(
            LiquidityPosition.Dependencies({
                positionManager: IPositionManager(address(positionManager)),
                positionDepositor: depositor,
                expectedPositionTokenId: TOKEN_ID,
                gbx: gbx,
                usdg: IERC20(address(usdg)),
                permit2: IAllowanceTransfer(address(permit2))
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

    /// @notice Runs real swaps in both directions so the position accrues fees in both currencies.
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
                zeroForOne: true,
                amountSpecified: -int256(amount),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            settings,
            bytes("")
        );
        swapRouter.swap(
            poolKey,
            SwapParams({
                zeroForOne: false,
                amountSpecified: -int256(amount),
                sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            settings,
            bytes("")
        );
        vm.stopPrank();
    }

    /// @notice Runs one compound and returns the caller's net token change across both sides.
    function _compoundProfitAndLoss() private returns (int256 pnl) {
        _seedSearcher();
        uint256 before = gbx.balanceOf(SEARCHER) + usdg.balanceOf(SEARCHER);

        vm.startPrank(SEARCHER);
        gbx.approve(address(position), type(uint256).max);
        usdg.approve(address(position), type(uint256).max);
        position.compound(FUND_CAP, FUND_CAP, block.timestamp);
        vm.stopPrank();

        return int256(gbx.balanceOf(SEARCHER) + usdg.balanceOf(SEARCHER)) - int256(before);
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

    function _seedSearcher() private {
        gbx.transfer(SEARCHER, 1_000 ether);
        usdg.mint(SEARCHER, 1_000 ether);
    }

    function _compound(uint128 amount0Max, uint128 amount1Max)
        private
        returns (uint128 added, uint256 claimed0, uint256 claimed1)
    {
        _seedSearcher();

        vm.startPrank(SEARCHER);
        gbx.approve(address(position), type(uint256).max);
        usdg.approve(address(position), type(uint256).max);
        (added, claimed0, claimed1) = position.compound(amount0Max, amount1Max, block.timestamp);
        vm.stopPrank();
    }
}

/// @notice Minimal stand-in for canonical Permit2, implementing exactly the allowance surface v4 settlement uses.
/// @dev Canonical Permit2 pins `pragma solidity =0.8.17` and cannot compile alongside this project's pinned 0.8.26,
///      so it is the one component of this integration that is not the genuine contract. PoolManager and
///      PositionManager are real, which is what matters: the fee-netting property under test lives in
///      `PositionManager._increase`, and Permit2 is only the payment rail beneath `_close`.
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
