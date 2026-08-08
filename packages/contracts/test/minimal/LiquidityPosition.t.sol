// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { PositionInfo, PositionInfoLibrary } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

import { GBX } from "../../src/core/GBX.sol";
import { LiquidityPosition } from "../../src/core/LiquidityPosition.sol";

contract LiquidityUSDGMock is ERC20 {
    constructor() ERC20("Global Dollar", "USDG") { }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}

contract LiquidityResonanceRouterMock {
    IERC20 public immutable usdg;
    address public immutable resonance;

    constructor(IERC20 usdg_, address resonance_) {
        usdg = usdg_;
        resonance = resonance_;
    }

    function route() external returns (uint256 amount) {
        amount = usdg.balanceOf(address(this));
        usdg.transfer(resonance, amount);
    }
}

contract LiquidityPositionManagerMock is ERC721 {
    GBX public immutable gbx;
    LiquidityUSDGMock public immutable usdg;

    mapping(uint256 tokenId => PoolKey key) private _poolKeys;
    mapping(uint256 tokenId => PositionInfo info) private _positionInfo;
    mapping(uint256 tokenId => uint128 liquidity) private _positionLiquidity;

    uint256 public pendingGBXFees;
    uint256 public pendingUSDGFees;
    uint256 public lastLiquidityRemoved;

    constructor(GBX gbx_, LiquidityUSDGMock usdg_) ERC721("Uniswap v4 Positions", "UNI-V4-POSM") {
        gbx = gbx_;
        usdg = usdg_;
    }

    function mint(
        address owner,
        uint256 tokenId,
        PoolKey memory key,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external {
        _poolKeys[tokenId] = key;
        _positionInfo[tokenId] = PositionInfoLibrary.initialize(key, tickLower, tickUpper);
        _positionLiquidity[tokenId] = liquidity;
        _mint(owner, tokenId);
    }

    function setPendingFees(uint256 gbxFees, uint256 usdgFees) external {
        pendingGBXFees = gbxFees;
        pendingUSDGFees = usdgFees;
    }

    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, PositionInfo) {
        _requireOwned(tokenId);
        return (_poolKeys[tokenId], _positionInfo[tokenId]);
    }

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128) {
        _requireOwned(tokenId);
        return _positionLiquidity[tokenId];
    }

    function modifyLiquidities(bytes calldata unlockData, uint256) external payable {
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        require(actions.length == 2 && params.length == 2, "INVALID_LENGTH");
        require(uint8(actions[0]) == uint8(Actions.DECREASE_LIQUIDITY), "INVALID_ACTION");
        require(uint8(actions[1]) == uint8(Actions.TAKE_PAIR), "INVALID_ACTION");

        (uint256 tokenId, uint256 liquidity,,,) = abi.decode(params[0], (uint256, uint256, uint128, uint128, bytes));
        (,, address receiver) = abi.decode(params[1], (Currency, Currency, address));
        require(ownerOf(tokenId) == msg.sender, "NOT_OWNER");
        lastLiquidityRemoved = liquidity;

        uint256 gbxFees = pendingGBXFees;
        uint256 usdgFees = pendingUSDGFees;
        pendingGBXFees = 0;
        pendingUSDGFees = 0;
        if (gbxFees != 0) IERC20(address(gbx)).transfer(receiver, gbxFees);
        if (usdgFees != 0) usdg.transfer(receiver, usdgFees);
    }
}

contract LiquidityPositionTest is Test {
    uint256 private constant POSITION_TOKEN_ID = 7;
    address private constant RESONANCE = address(0xB07E);
    address private constant KEEPER = address(0xBEEF);

    GBX private gbx;
    LiquidityUSDGMock private usdg;
    LiquidityResonanceRouterMock private resonanceRouter;
    LiquidityPositionManagerMock private positionManager;
    LiquidityPosition private liquidityPosition;
    PoolKey private canonicalPoolKey;
    int24 private tickLower;
    int24 private tickUpper;

    function setUp() external {
        gbx = new GBX(address(this), address(this));
        usdg = new LiquidityUSDGMock();
        resonanceRouter = new LiquidityResonanceRouterMock(IERC20(address(usdg)), RESONANCE);
        positionManager = new LiquidityPositionManagerMock(gbx, usdg);

        address token0 = address(gbx) < address(usdg) ? address(gbx) : address(usdg);
        address token1 = address(gbx) < address(usdg) ? address(usdg) : address(gbx);
        canonicalPoolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3_000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        // A range above the starting tick holds token0 only; a range below holds token1 only.
        if (token0 == address(gbx)) {
            tickLower = 60;
            tickUpper = 120;
        } else {
            tickLower = -120;
            tickUpper = -60;
        }

        positionManager.mint(address(this), POSITION_TOKEN_ID, canonicalPoolKey, tickLower, tickUpper, 1 ether);
        liquidityPosition = _deployLiquidityPosition(address(this), address(this));
        positionManager.safeTransferFrom(address(this), address(liquidityPosition), POSITION_TOKEN_ID);
    }

    function test_CollectFeesNeverRemovesPrincipalAndBurnsGBXWhileRoutingUSDG() external {
        gbx.transfer(address(positionManager), 5 ether);
        usdg.mint(address(positionManager), 7_000_000);
        positionManager.setPendingFees(4 ether, 6_000_000);

        // Direct token transfers are processed together with fees rather than becoming stuck.
        gbx.transfer(address(liquidityPosition), 1 ether);
        usdg.mint(address(liquidityPosition), 1_000_000);

        uint256 supplyBefore = gbx.totalSupply();
        vm.prank(KEEPER);
        (uint256 gbxBurned, uint256 usdgRouted) = liquidityPosition.collectFees();

        assertEq(gbxBurned, 5 ether);
        assertEq(usdgRouted, 7_000_000);
        assertEq(gbx.totalSupply(), supplyBefore - 5 ether);
        assertEq(usdg.balanceOf(RESONANCE), 7_000_000);
        assertEq(positionManager.lastLiquidityRemoved(), 0);
        assertEq(positionManager.ownerOf(POSITION_TOKEN_ID), address(liquidityPosition));
        assertTrue(liquidityPosition.positionInCustody());
    }

    function test_PositionMigrationRequiresOneCompatibleSuccessorAndIsPermissionlessAfterBinding() external {
        LiquidityPosition successor = _deployLiquidityPosition(address(liquidityPosition), address(this));

        liquidityPosition.setSuccessor(address(successor));
        vm.prank(KEEPER);
        liquidityPosition.migratePosition();

        assertEq(positionManager.ownerOf(POSITION_TOKEN_ID), address(successor));
        assertTrue(successor.positionInCustody());
        assertFalse(liquidityPosition.positionInCustody());

        LiquidityPosition anotherSuccessor = _deployLiquidityPosition(address(liquidityPosition), address(this));
        vm.expectRevert(abi.encodeWithSelector(LiquidityPosition.SuccessorAlreadySet.selector, address(successor)));
        liquidityPosition.setSuccessor(address(anotherSuccessor));
    }

    function test_RejectsPositionWithUnexpectedTicks() external {
        uint256 anotherTokenId = POSITION_TOKEN_ID + 1;
        positionManager.mint(address(this), anotherTokenId, canonicalPoolKey, tickLower - 60, tickUpper, 1 ether);

        LiquidityPosition anotherPosition = new LiquidityPosition(
            LiquidityPosition.Dependencies({
                positionManager: IPositionManager(address(positionManager)),
                positionDepositor: address(this),
                expectedPositionTokenId: anotherTokenId,
                gbx: gbx,
                usdg: IERC20(address(usdg)),
                resonanceRouter: address(resonanceRouter),
                initialOwner: address(this)
            }),
            canonicalPoolKey,
            tickLower,
            tickUpper
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityPosition.InvalidPositionTicks.selector, tickLower, tickUpper, tickLower - 60, tickUpper
            )
        );
        positionManager.safeTransferFrom(address(this), address(anotherPosition), anotherTokenId);
    }

    function _deployLiquidityPosition(address depositor, address owner) private returns (LiquidityPosition position) {
        position = new LiquidityPosition(
            LiquidityPosition.Dependencies({
                positionManager: IPositionManager(address(positionManager)),
                positionDepositor: depositor,
                expectedPositionTokenId: POSITION_TOKEN_ID,
                gbx: gbx,
                usdg: IERC20(address(usdg)),
                resonanceRouter: address(resonanceRouter),
                initialOwner: owner
            }),
            canonicalPoolKey,
            tickLower,
            tickUpper
        );
    }
}
