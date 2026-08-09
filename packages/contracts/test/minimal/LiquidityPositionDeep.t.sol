// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { PositionInfo, PositionInfoLibrary } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { ILiquidityRevenueRouter, LiquidityPosition } from "../../src/core/LiquidityPosition.sol";
import { IFund } from "../../src/core/interfaces/IFund.sol";

import { MockERC20 } from "./utils/Tokens.sol";

/// @notice Minimal immutable revenue-route identity for admission and dependency tests.
contract RevenueRouterIdentityMock {
    IERC20 public immutable usdg;

    constructor(IERC20 usdg_) {
        usdg = usdg_;
    }

    function route() external pure returns (uint256 amount) {
        return 0;
    }
}

/// @notice PositionManager stand-in exposing exactly the surface LiquidityPosition depends on.
contract PositionManagerMock is ERC721 {
    mapping(uint256 tokenId => PoolKey key) private _poolKeys;
    mapping(uint256 tokenId => PositionInfo info) private _positionInfo;
    mapping(uint256 tokenId => uint128 liquidity) private _liquidity;

    constructor() ERC721("Uniswap v4 Positions", "UNI-V4-POSM") { }

    function mint(address owner, uint256 tokenId, PoolKey memory key, int24 tickLower, int24 tickUpper, uint128 liq)
        external
    {
        _poolKeys[tokenId] = key;
        _positionInfo[tokenId] = PositionInfoLibrary.initialize(key, tickLower, tickUpper);
        _liquidity[tokenId] = liq;
        _mint(owner, tokenId);
    }

    function destroy(uint256 tokenId) external {
        _burn(tokenId);
    }

    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, PositionInfo) {
        return (_poolKeys[tokenId], _positionInfo[tokenId]);
    }

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128) {
        return _liquidity[tokenId];
    }
}

/// @title LiquidityPositionDeepTest
/// @notice Exhaustive coverage of position admission and immutability on the ownerless position holder.
/// @dev Fee-harvest behavior is covered against real Uniswap v4 contracts in `LiquidityFeeHarvest.t.sol`; this
///      suite uses a stand-in PositionManager so every admission rejection branch is reachable.
contract LiquidityPositionDeepTest is Test {
    uint256 private constant TOKEN_ID = 7;
    address private constant ALICE = address(0xA11CE);

    GBX private gbx;
    MockERC20 private usdg;
    Fund private fund;
    RevenueRouterIdentityMock private resonanceRouter;
    PositionManagerMock private positionManager;
    LiquidityPosition private position;
    PoolKey private poolKey;
    int24 private tickLower;
    int24 private tickUpper;

    event PositionRecorded(uint256 indexed positionTokenId, address indexed previousOwner, bytes32 indexed poolKeyHash);

    function setUp() external {
        vm.warp(365 days);
        gbx = new GBX(address(this), address(this));
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        fund = new Fund(gbx);
        resonanceRouter = new RevenueRouterIdentityMock(IERC20(address(usdg)));
        positionManager = new PositionManagerMock();

        poolKey = _keyFor(address(gbx), address(usdg), 3_000, 60, address(0));
        (tickLower, tickUpper) = address(gbx) < address(usdg) ? (int24(60), int24(120)) : (int24(-120), int24(-60));

        positionManager.mint(address(this), TOKEN_ID, poolKey, tickLower, tickUpper, 1 ether);
        position = _deploy(address(this), TOKEN_ID);
        positionManager.safeTransferFrom(address(this), address(position), TOKEN_ID);
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTION
    //////////////////////////////////////////////////////////////*/

    function test_ConstructorRejectsEveryZeroDependency() external {
        for (uint256 i; i < 6; ++i) {
            LiquidityPosition.Dependencies memory dependencies = _dependencies(address(this), TOKEN_ID);
            if (i == 0) dependencies.positionManager = IPositionManager(address(0));
            if (i == 1) dependencies.positionDepositor = address(0);
            if (i == 2) dependencies.gbx = GBX(address(0));
            if (i == 3) dependencies.usdg = IERC20(address(0));
            if (i == 4) dependencies.resonanceRouter = ILiquidityRevenueRouter(address(0));
            if (i == 5) dependencies.fund = IFund(address(0));

            vm.expectRevert(LiquidityPosition.ZeroAddress.selector);
            new LiquidityPosition(dependencies, poolKey, tickLower, tickUpper);
        }
    }

    function test_ConstructorRejectsEveryCodelessDependency() external {
        for (uint256 i; i < 5; ++i) {
            LiquidityPosition.Dependencies memory dependencies = _dependencies(address(this), TOKEN_ID);
            if (i == 0) dependencies.positionManager = IPositionManager(ALICE);
            if (i == 1) dependencies.gbx = GBX(ALICE);
            if (i == 2) dependencies.usdg = IERC20(ALICE);
            if (i == 3) dependencies.resonanceRouter = ILiquidityRevenueRouter(ALICE);
            if (i == 4) dependencies.fund = IFund(ALICE);

            vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.AddressHasNoCode.selector, ALICE));
            new LiquidityPosition(dependencies, poolKey, tickLower, tickUpper);
        }
    }

    function test_ConstructorRejectsMismatchedDestinationTokens() external {
        MockERC20 stranger = new MockERC20("Stranger", "STR", 18);
        RevenueRouterIdentityMock wrongRouter = new RevenueRouterIdentityMock(IERC20(address(stranger)));
        LiquidityPosition.Dependencies memory dependencies = _dependencies(address(this), TOKEN_ID);
        dependencies.resonanceRouter = ILiquidityRevenueRouter(address(wrongRouter));

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityPosition.InvalidDestinationToken.selector,
                address(wrongRouter),
                address(usdg),
                address(stranger)
            )
        );
        new LiquidityPosition(dependencies, poolKey, tickLower, tickUpper);

        GBX wrongGBX = new GBX(address(this), address(this));
        Fund wrongFund = new Fund(wrongGBX);
        dependencies = _dependencies(address(this), TOKEN_ID);
        dependencies.fund = IFund(address(wrongFund));

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityPosition.InvalidDestinationToken.selector, address(wrongFund), address(gbx), address(wrongGBX)
            )
        );
        new LiquidityPosition(dependencies, poolKey, tickLower, tickUpper);
    }

    function test_ConstructorRejectsAPoolThatIsNotTheCanonicalPair() external {
        MockERC20 stranger = new MockERC20("Stranger", "STR", 18);
        PoolKey memory wrongKey = _keyFor(address(gbx), address(stranger), 3_000, 60, address(0));

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityPosition.InvalidPoolCurrencies.selector,
                Currency.unwrap(wrongKey.currency0),
                Currency.unwrap(wrongKey.currency1)
            )
        );
        new LiquidityPosition(_dependencies(address(this), TOKEN_ID), wrongKey, tickLower, tickUpper);
    }

    function test_ConstructorRejectsAHookedPool() external {
        PoolKey memory hooked = _keyFor(address(gbx), address(usdg), 3_000, 60, address(0xC0FFEE));

        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.NonzeroHook.selector, address(0xC0FFEE)));
        new LiquidityPosition(_dependencies(address(this), TOKEN_ID), hooked, tickLower, tickUpper);
    }

    function test_ConstructorRejectsAnInvertedOrEmptyTickRange() external {
        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.InvalidTickRange.selector, tickUpper, tickLower));
        new LiquidityPosition(_dependencies(address(this), TOKEN_ID), poolKey, tickUpper, tickLower);

        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.InvalidTickRange.selector, tickLower, tickLower));
        new LiquidityPosition(_dependencies(address(this), TOKEN_ID), poolKey, tickLower, tickLower);
    }

    function test_PoolKeyRoundTripsToTheCommittedHash() external view {
        PoolKey memory reconstructed = position.poolKey();

        assertEq(keccak256(abi.encode(reconstructed)), position.poolKeyHash());
        assertEq(keccak256(abi.encode(poolKey)), position.poolKeyHash());
        assertEq(address(reconstructed.hooks), address(0));
        assertEq(reconstructed.fee, 3_000);
        assertEq(reconstructed.tickSpacing, 60);
    }

    /*//////////////////////////////////////////////////////////////
                          POSITION ADMISSION
    //////////////////////////////////////////////////////////////*/

    function test_OnlyThePositionManagerMayDeliverTheNFT() external {
        LiquidityPosition fresh = _deploy(address(this), TOKEN_ID);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.UnexpectedNFTSender.selector, ALICE));
        fresh.onERC721Received(ALICE, address(this), TOKEN_ID, "");
    }

    function test_ASecondPositionIsAlwaysRejected() external {
        uint256 otherId = TOKEN_ID + 1;
        positionManager.mint(address(this), otherId, poolKey, tickLower, tickUpper, 1 ether);

        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.PositionAlreadyRecorded.selector, TOKEN_ID));
        positionManager.safeTransferFrom(address(this), address(position), otherId);
    }

    function test_RejectsAPositionFromAnUnexpectedDepositor() external {
        uint256 otherId = TOKEN_ID + 1;
        LiquidityPosition fresh = _deploy(ALICE, otherId);
        positionManager.mint(address(this), otherId, poolKey, tickLower, tickUpper, 1 ether);

        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.UnexpectedPositionDepositor.selector, address(this)));
        positionManager.safeTransferFrom(address(this), address(fresh), otherId);
    }

    function test_RejectsAnUnexpectedTokenId() external {
        uint256 otherId = TOKEN_ID + 1;
        LiquidityPosition fresh = _deploy(address(this), TOKEN_ID);
        positionManager.mint(address(this), otherId, poolKey, tickLower, tickUpper, 1 ether);

        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.UnexpectedPositionTokenId.selector, TOKEN_ID, otherId));
        positionManager.safeTransferFrom(address(this), address(fresh), otherId);
    }

    function test_RejectsAPositionFromADifferentPool() external {
        uint256 otherId = TOKEN_ID + 1;
        LiquidityPosition fresh = _deploy(address(this), otherId);
        PoolKey memory otherKey = _keyFor(address(gbx), address(usdg), 500, 10, address(0));
        positionManager.mint(address(this), otherId, otherKey, tickLower, tickUpper, 1 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityPosition.InvalidPoolKey.selector,
                keccak256(abi.encode(poolKey)),
                keccak256(abi.encode(otherKey))
            )
        );
        positionManager.safeTransferFrom(address(this), address(fresh), otherId);
    }

    function test_RejectsAPositionWithTheWrongRange() external {
        uint256 otherId = TOKEN_ID + 1;
        LiquidityPosition fresh = _deploy(address(this), otherId);
        positionManager.mint(address(this), otherId, poolKey, tickLower - 60, tickUpper, 1 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityPosition.InvalidPositionTicks.selector, tickLower, tickUpper, tickLower - 60, tickUpper
            )
        );
        positionManager.safeTransferFrom(address(this), address(fresh), otherId);
    }

    function test_RejectsAnEmptyPosition() external {
        uint256 otherId = TOKEN_ID + 1;
        LiquidityPosition fresh = _deploy(address(this), otherId);
        positionManager.mint(address(this), otherId, poolKey, tickLower, tickUpper, 0);

        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.EmptyPosition.selector, otherId));
        positionManager.safeTransferFrom(address(this), address(fresh), otherId);
    }

    function test_TheAcceptedPositionIsRecordedAndInCustody() external {
        uint256 otherId = TOKEN_ID + 1;
        LiquidityPosition fresh = _deploy(address(this), otherId);
        positionManager.mint(address(this), otherId, poolKey, tickLower, tickUpper, 1 ether);

        vm.expectEmit(true, true, true, false);
        emit PositionRecorded(otherId, address(this), keccak256(abi.encode(poolKey)));
        positionManager.safeTransferFrom(address(this), address(fresh), otherId);

        assertTrue(fresh.positionRecorded());
        assertEq(fresh.positionTokenId(), otherId);
        assertTrue(fresh.positionInCustody());
    }

    function test_CustodyReportsFalseWhenTheNFTNoLongerExists() external {
        assertTrue(position.positionInCustody());
        positionManager.destroy(TOKEN_ID);
        assertFalse(position.positionInCustody(), "a reverting ownerOf must be caught, not bubbled");
    }

    /*//////////////////////////////////////////////////////////////
                          OWNERLESS IMMUTABILITY
    //////////////////////////////////////////////////////////////*/

    /// @notice The position holder exposes no administrative surface: no owner, no successor, no migration.
    /// @dev Removed deliberately (see ADR 0017). An absent dispatch target reverts with empty returndata, which is
    ///      what distinguishes a removed power from a merely access-gated one.
    function test_ThePositionHolderHasNoAdministrativeSurfaceLeft() external {
        string[6] memory removed = [
            "owner()",
            "transferOwnership(address)",
            "renounceOwnership()",
            "successor()",
            "setSuccessor(address)",
            "migratePosition()"
        ];

        for (uint256 i; i < removed.length; ++i) {
            (bool succeeded, bytes memory returnData) =
                address(position).call(abi.encodeWithSignature(removed[i], address(0)));

            assertFalse(succeeded, string.concat("LiquidityPosition must not expose ", removed[i]));
            assertEq(returnData.length, 0, string.concat("no dispatch target should exist for ", removed[i]));
        }

        (bool compoundSucceeded, bytes memory compoundData) = address(position)
            .call(abi.encodeWithSignature("compound(uint128,uint128,uint256)", uint128(0), uint128(0), block.timestamp));
        assertFalse(compoundSucceeded, "compound must not exist");
        assertEq(compoundData.length, 0, "compound must have no dispatch target");

        (bool requirementSucceeded, bytes memory requirementData) =
            address(position).call(abi.encodeWithSignature("compoundRequirement()"));
        assertFalse(requirementSucceeded, "compoundRequirement must not exist");
        assertEq(requirementData.length, 0, "compoundRequirement must have no dispatch target");
    }

    /// @notice Once admitted, the canonical NFT can never leave, by any caller or any mechanism.
    /// @dev The accepted cost of removing migration: the genesis position is locked permanently. It stays
    ///      productive regardless, while `LiquidityFeeHarvest.t.sol` proves fixed-principal fee collection.
    function test_TheCanonicalNFTCanNeverLeaveOnceAdmitted() external {
        assertTrue(position.positionInCustody());

        // The holder implements no transfer surface of its own, and it never approves an operator.
        assertEq(positionManager.getApproved(TOKEN_ID), address(0));
        assertFalse(positionManager.isApprovedForAll(address(position), ALICE));

        vm.prank(ALICE);
        vm.expectRevert();
        positionManager.transferFrom(address(position), ALICE, TOKEN_ID);

        assertEq(positionManager.ownerOf(TOKEN_ID), address(position), "still held");
    }

    function _keyFor(address tokenA, address tokenB, uint24 fee, int24 spacing, address hook)
        private
        pure
        returns (PoolKey memory key)
    {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: fee,
            tickSpacing: spacing,
            hooks: IHooks(hook)
        });
    }

    function _dependencies(address depositor, uint256 tokenId)
        private
        view
        returns (LiquidityPosition.Dependencies memory dependencies)
    {
        return LiquidityPosition.Dependencies({
            positionManager: IPositionManager(address(positionManager)),
            positionDepositor: depositor,
            expectedPositionTokenId: tokenId,
            gbx: gbx,
            usdg: IERC20(address(usdg)),
            resonanceRouter: ILiquidityRevenueRouter(address(resonanceRouter)),
            fund: IFund(address(fund))
        });
    }

    function _deploy(address depositor, uint256 tokenId) private returns (LiquidityPosition deployed) {
        return new LiquidityPosition(_dependencies(depositor, tokenId), poolKey, tickLower, tickUpper);
    }

    function _selectorOf(bytes memory data) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := mload(add(data, 0x20))
        }
    }
}
