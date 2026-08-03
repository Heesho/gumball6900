// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { PoolManager } from "@uniswap/v4-core/src/PoolManager.sol";
import { IUnlockCallback } from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { BalanceDelta } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { ModifyLiquidityParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";

import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GenesisLiquidityCalculator } from "../../../src/liquidity/GenesisLiquidityCalculator.sol";
import { LaunchGuardHook } from "../../../src/liquidity/LaunchGuardHook.sol";
import { LiquidityManager } from "../../../src/liquidity/LiquidityManager.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AdversarialToken } from "../mocks/AdversarialTokenMocks.sol";
import { GBXTokenMinterMock } from "../mocks/GBXTokenMinterMock.sol";
import { LaunchGuardHookHarness } from "../mocks/LaunchGuardHookHarness.sol";
import {
    GenesisBootstrapCallerMock,
    LiquidityAllocationVoterMock,
    Permit2Mock
} from "../mocks/LiquidityManagerMocks.sol";

/// @dev Minimal adapter that drives v4 core's real modify-liquidity and settlement paths for this regression.
contract GenesisV4PositionManager is IUnlockCallback {
    IPoolManager public immutable POOL_MANAGER;
    Permit2Mock public immutable PERMIT2;

    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => address owner) public ownerOf;
    mapping(uint256 tokenId => uint128 liquidity) public positionLiquidity;

    constructor(IPoolManager poolManager_, Permit2Mock permit2_) {
        POOL_MANAGER = poolManager_;
        PERMIT2 = permit2_;
    }

    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable {
        require(block.timestamp <= deadline, "DEADLINE");
        POOL_MANAGER.unlock(abi.encode(msg.sender, unlockData));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(POOL_MANAGER), "POOL_MANAGER_ONLY");
        (address payer, bytes memory unlockData) = abi.decode(data, (address, bytes));
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        require(actions.length == 6 && params.length == 6, "INVALID_PLAN");

        for (uint256 index; index < 4; ++index) {
            require(uint8(actions[index]) == uint8(Actions.MINT_POSITION), "MINT_ONLY");
            _mintAndSettle(payer, params[index]);
        }
        require(uint8(actions[4]) == uint8(Actions.CLOSE_CURRENCY), "CLOSE0");
        require(uint8(actions[5]) == uint8(Actions.CLOSE_CURRENCY), "CLOSE1");
        return bytes("");
    }

    function _mintAndSettle(address payer, bytes memory encodedPosition) private {
        (
            PoolKey memory key,
            int24 tickLower,
            int24 tickUpper,
            uint256 liquidity,
            uint128 amount0Max,
            uint128 amount1Max,
            address owner,
            bytes memory hookData
        ) = abi.decode(encodedPosition, (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
        require(liquidity <= type(uint128).max, "LIQUIDITY");

        uint256 tokenId = nextTokenId++;
        (BalanceDelta delta,) = POOL_MANAGER.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: int256(liquidity), salt: bytes32(tokenId)
            }),
            hookData
        );
        uint128 amount0 = _owed(delta.amount0());
        uint128 amount1 = _owed(delta.amount1());
        require(amount0 <= amount0Max, "AMOUNT0_MAX");
        require(amount1 <= amount1Max, "AMOUNT1_MAX");
        _settle(key.currency0, payer, amount0);
        _settle(key.currency1, payer, amount1);

        ownerOf[tokenId] = owner;
        positionLiquidity[tokenId] = uint128(liquidity);
    }

    function _settle(Currency currency, address payer, uint128 amount) private {
        if (amount == 0) return;
        POOL_MANAGER.sync(currency);
        PERMIT2.transferFrom(payer, address(POOL_MANAGER), uint160(amount), Currency.unwrap(currency));
        POOL_MANAGER.settle();
    }

    function _owed(int128 delta) private pure returns (uint128 amount) {
        require(delta <= 0, "POSITIVE_DELTA");
        amount = uint128(uint256(-int256(delta)));
    }
}

contract GenesisLiquiditySettlementTest is Test {
    uint256 private constant GENESIS_LP_GBX = 20_000_000 ether;
    uint256 private constant ALIGNED_TICK_REPRODUCTION_USDG = 79_716_728_409_744;
    address private constant VAULT = address(0xB011);
    address private constant TIMELOCK = address(0x710E);
    address private constant GUARDIAN = address(0x6911);
    address private constant BEFORE_INITIALIZE_HOOK = address(0x2000);

    struct SettlementFixture {
        PoolManager poolManager;
        GenesisV4PositionManager positionManager;
        AdversarialToken usdG;
        GBXToken gbx;
        GenesisBootstrapCallerMock genesis;
        LiquidityManager liquidityManager;
    }

    function test_AlignedToken0TickSettlesThroughCanonicalV4WithoutUSDG() external {
        SettlementFixture memory fixture = _deployFixture();

        uint160 sqrtPriceX96 =
            fixture.genesis.initializeAndSeed(fixture.liquidityManager, ALIGNED_TICK_REPRODUCTION_USDG);

        assertEq(sqrtPriceX96, 79_087_768_826_803_489_071_904);
        assertEq(fixture.liquidityManager.genesisTick(), -276_360);
        (int24 firstLower,, uint128 firstLiquidity,, bool exists) = fixture.liquidityManager.positionRecord(1);
        assertTrue(exists);
        assertEq(firstLower, -276_300);
        assertGt(firstLiquidity, 0);
        assertGe(TickMath.getSqrtPriceAtTick(firstLower), sqrtPriceX96);
        assertEq(fixture.positionManager.ownerOf(1), address(fixture.liquidityManager));
        assertEq(fixture.positionManager.nextTokenId(), 5);
        assertEq(
            fixture.gbx.balanceOf(address(fixture.poolManager)), fixture.liquidityManager.genesisLiquidityPrincipal()
        );
        assertEq(fixture.usdG.balanceOf(address(fixture.poolManager)), 0);
        assertEq(fixture.usdG.balanceOf(address(fixture.liquidityManager)), 0);
    }

    function _deployFixture() private returns (SettlementFixture memory fixture) {
        fixture.poolManager = new PoolManager(address(this));
        Permit2Mock permit2 = new Permit2Mock();
        fixture.positionManager = new GenesisV4PositionManager(IPoolManager(address(fixture.poolManager)), permit2);

        fixture.usdG = new AdversarialToken("Global Dollar", "USDG", 6);
        fixture.gbx = _deployGBXOnSide(address(fixture.usdG), true);
        GBXTokenMinterMock minter = new GBXTokenMinterMock();
        fixture.gbx.initializeEmissionController(address(minter));
        assertTrue(address(fixture.gbx) < address(fixture.usdG));

        LaunchGuardHookHarness hookImplementation = new LaunchGuardHookHarness(
            IPoolManager(address(fixture.poolManager)),
            address(this),
            address(fixture.gbx),
            address(fixture.usdG),
            3_000,
            60
        );
        vm.etch(BEFORE_INITIALIZE_HOOK, address(hookImplementation).code);
        LaunchGuardHook hook = LaunchGuardHook(BEFORE_INITIALIZE_HOOK);

        fixture.genesis = new GenesisBootstrapCallerMock();
        LiquidityAllocationVoterMock voter = new LiquidityAllocationVoterMock();
        GenesisLiquidityCalculator calculator = new GenesisLiquidityCalculator();
        fixture.liquidityManager = new LiquidityManager(
            LiquidityManager.Dependencies({
                gbx: address(fixture.gbx),
                usdG: address(fixture.usdG),
                gumBallVault: VAULT,
                allocationVoter: address(voter),
                poolManager: address(fixture.poolManager),
                positionManager: address(fixture.positionManager),
                permit2: address(permit2),
                launchGuardHook: address(hook),
                genesisBootstrap: address(fixture.genesis),
                genesisLiquidityCalculator: address(calculator),
                protocolTimelock: TIMELOCK,
                emergencyGuardian: GUARDIAN
            }),
            LiquidityManager.LadderConfig({
                poolFee: 3_000,
                tickSpacing: 60,
                allocationBps: [uint16(5_000), 3_000, 1_500, 500],
                cumulativeTickDeltas: [int24(4_080), 10_980, 17_940, 24_900]
            })
        );
        hook.initializeLiquidityManager(address(fixture.liquidityManager));
        minter.mint(fixture.gbx, address(fixture.liquidityManager), GENESIS_LP_GBX);
    }

    function _deployGBXOnSide(address peer, bool gbxIsToken0) private returns (GBXToken token) {
        bytes memory initCode =
            abi.encodePacked(type(GBXToken).creationCode, abi.encode(address(this), IEligibilityModule(address(0))));
        bytes32 initCodeHash = keccak256(initCode);
        for (uint256 nonce = 1; nonce <= 256; ++nonce) {
            bytes32 salt = bytes32(nonce);
            address predicted = vm.computeCreate2Address(salt, initCodeHash, address(this));
            if ((predicted < peer) == gbxIsToken0) {
                token = new GBXToken{ salt: salt }(address(this), IEligibilityModule(address(0)));
                assertEq(address(token), predicted);
                return token;
            }
        }
        revert("CREATE2_SIDE_NOT_FOUND");
    }
}
