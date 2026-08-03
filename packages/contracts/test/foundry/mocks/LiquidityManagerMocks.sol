// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";

import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { LiquidityManager } from "../../../src/liquidity/LiquidityManager.sol";
import { GenesisPriceTestMath } from "./GenesisPriceTestMath.sol";

contract LiquidityPoolManagerMock {
    bool public initialized;
    address public initializer;
    uint160 public initializedSqrtPriceX96;
    bytes32 public initializedKeyHash;
    uint160 public currentSqrtPriceX96;
    int24 public currentTick;

    function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24 tick) {
        initialized = true;
        initializer = msg.sender;
        initializedSqrtPriceX96 = sqrtPriceX96;
        initializedKeyHash = keccak256(abi.encode(key));
        tick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);
        currentSqrtPriceX96 = sqrtPriceX96;
        currentTick = tick;
    }

    function setCurrentTick(int24 tick) external {
        currentSqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        currentTick = tick;
    }

    function setSlot0(uint160 sqrtPriceX96, int24 tick) external {
        currentSqrtPriceX96 = sqrtPriceX96;
        currentTick = tick;
    }

    function extsload(bytes32) external view returns (bytes32 value) {
        value = bytes32(uint256(currentSqrtPriceX96) | (uint256(uint24(currentTick)) << 160));
    }
}

contract Permit2Mock {
    address public approvedOwner;
    address public approvedToken;
    address public approvedSpender;
    uint160 public approvedAmount;
    uint48 public approvedExpiration;

    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        approvedOwner = msg.sender;
        approvedToken = token;
        approvedSpender = spender;
        approvedAmount = amount;
        approvedExpiration = expiration == 0 ? uint48(block.timestamp) : expiration;
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        IERC20(token).transferFrom(from, to, amount);
    }
}

contract PositionManagerMock {
    struct CapturedMint {
        int24 tickLower;
        int24 tickUpper;
        uint256 liquidity;
        uint128 amount0Max;
        uint128 amount1Max;
        address owner;
    }

    IERC20 public immutable GBX;
    IERC20 public immutable USDG;
    Permit2Mock public immutable PERMIT2;

    uint256 public nextTokenId = 6_900;
    uint256 public lastDeadline;
    bytes public lastActions;
    CapturedMint[4] private _capturedMints;
    uint256 public pendingGBXFees;
    uint256 public pendingUSDGFees;
    uint256 public migrationGBXRemoved;
    uint256 public migrationUSDGRemoved;
    uint256 public migrationGBXDeposited;
    uint256 public migrationUSDGDeposited;
    uint128 public lastBurnAmount0Min;
    uint128 public lastBurnAmount1Min;
    uint128 public lastMintAmount0Max;
    uint128 public lastMintAmount1Max;
    bytes32 public lastMigrationPoolKeyHash;
    mapping(uint256 positionId => address owner) public ownerOf;
    mapping(uint256 positionId => uint128 liquidity) public positionLiquidity;

    constructor(IERC20 gbx, IERC20 usdG, Permit2Mock permit2) {
        GBX = gbx;
        USDG = usdG;
        PERMIT2 = permit2;
    }

    function capturedMint(uint256 index) external view returns (CapturedMint memory) {
        return _capturedMints[index];
    }

    function setPendingFees(uint256 gbxFees, uint256 usdGFees) external {
        pendingGBXFees = gbxFees;
        pendingUSDGFees = usdGFees;
    }

    function setMigrationAmounts(uint256 gbxRemoved, uint256 usdGRemoved, uint256 gbxDeposited, uint256 usdGDeposited)
        external
    {
        migrationGBXRemoved = gbxRemoved;
        migrationUSDGRemoved = usdGRemoved;
        migrationGBXDeposited = gbxDeposited;
        migrationUSDGDeposited = usdGDeposited;
    }

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128) {
        return positionLiquidity[tokenId];
    }

    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable {
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        lastActions = actions;
        lastDeadline = deadline;

        if (uint8(actions[0]) == uint8(Actions.MINT_POSITION)) {
            _captureMints(params);
            nextTokenId += 4;
        } else if (actions.length > 2 && uint8(actions[0]) == uint8(Actions.BURN_POSITION)) {
            _captureMigration(actions, params);
        } else if (
            uint8(actions[0]) == uint8(Actions.DECREASE_LIQUIDITY) || uint8(actions[0]) == uint8(Actions.BURN_POSITION)
        ) {
            uint256 gbxFees = pendingGBXFees;
            uint256 usdGFees = pendingUSDGFees;
            pendingGBXFees = 0;
            pendingUSDGFees = 0;
            if (gbxFees != 0) GBX.transfer(msg.sender, gbxFees);
            if (usdGFees != 0) USDG.transfer(msg.sender, usdGFees);
        }
    }

    function _captureMigration(bytes memory actions, bytes[] memory params) private {
        uint256 replacementCount;
        for (uint256 index; index < actions.length - 1; ++index) {
            uint8 action = uint8(actions[index]);
            if (action == uint8(Actions.BURN_POSITION)) {
                (uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes memory hookData) =
                    abi.decode(params[index], (uint256, uint128, uint128, bytes));
                hookData;
                lastBurnAmount0Min = amount0Min;
                lastBurnAmount1Min = amount1Min;
                delete ownerOf[tokenId];
                delete positionLiquidity[tokenId];
            } else if (action == uint8(Actions.MINT_POSITION)) {
                (
                    PoolKey memory key,
                    int24 tickLower,
                    int24 tickUpper,
                    uint256 liquidity,
                    uint128 amount0Max,
                    uint128 amount1Max,
                    address owner,
                    bytes memory hookData
                ) = abi.decode(params[index], (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
                tickLower;
                tickUpper;
                hookData;
                require(liquidity <= type(uint128).max, "LIQUIDITY_OVERFLOW");
                uint256 tokenId = nextTokenId + replacementCount;
                replacementCount += 1;
                ownerOf[tokenId] = owner;
                positionLiquidity[tokenId] = uint128(liquidity);
                lastMintAmount0Max = amount0Max;
                lastMintAmount1Max = amount1Max;
                lastMigrationPoolKeyHash = keccak256(abi.encode(key));
            } else {
                revert("UNSUPPORTED_MIGRATION_ACTION");
            }
        }

        require(uint8(actions[actions.length - 1]) == uint8(Actions.TAKE_PAIR), "MISSING_TAKE_PAIR");
        (Currency currency0, Currency currency1, address recipient) =
            abi.decode(params[actions.length - 1], (Currency, Currency, address));
        currency0;
        currency1;
        require(recipient == msg.sender, "INVALID_RECIPIENT");
        require(migrationGBXDeposited <= migrationGBXRemoved, "GBX_DEBT");
        require(migrationUSDGDeposited <= migrationUSDGRemoved, "USDG_DEBT");
        require(
            migrationGBXDeposited <= (address(GBX) < address(USDG) ? lastMintAmount0Max : lastMintAmount1Max), "GBX_MAX"
        );
        require(
            migrationUSDGDeposited <= (address(USDG) < address(GBX) ? lastMintAmount0Max : lastMintAmount1Max),
            "USDG_MAX"
        );

        nextTokenId += replacementCount;
        uint256 residualGBX = migrationGBXRemoved - migrationGBXDeposited;
        uint256 residualUSDG = migrationUSDGRemoved - migrationUSDGDeposited;
        if (residualGBX != 0) GBX.transfer(msg.sender, residualGBX);
        if (residualUSDG != 0) USDG.transfer(msg.sender, residualUSDG);
    }

    function _captureMints(bytes[] memory params) private {
        uint256 totalGBX;
        for (uint256 index; index < 4; ++index) {
            (
                PoolKey memory key,
                int24 tickLower,
                int24 tickUpper,
                uint256 liquidity,
                uint128 amount0Max,
                uint128 amount1Max,
                address owner,
                bytes memory hookData
            ) = abi.decode(params[index], (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
            key;
            hookData;
            _capturedMints[index] = CapturedMint({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidity: liquidity,
                amount0Max: amount0Max,
                amount1Max: amount1Max,
                owner: owner
            });
            uint256 tokenId = nextTokenId + index;
            ownerOf[tokenId] = owner;
            positionLiquidity[tokenId] = uint128(liquidity);
            totalGBX += address(GBX) < address(USDG) ? amount0Max : amount1Max;
        }
        PERMIT2.transferFrom(msg.sender, address(this), uint160(totalGBX), address(GBX));
    }
}

contract LiquidityAllocationVoterMock {
    uint256 public notifiedAmount;
    AllocationVoter.RevenueSource public notifiedSource;
    address public notifier;

    function notifyRevenue(uint256 amount, AllocationVoter.RevenueSource source) external {
        notifiedAmount += amount;
        notifiedSource = source;
        notifier = msg.sender;
    }
}

contract GenesisBootstrapCallerMock {
    function initializeAndSeed(LiquidityManager manager, uint256 communityUSDG) external returns (uint160) {
        uint160 sqrtPriceX96 = GenesisPriceTestMath.sqrtPriceX96(
            address(manager.GBX()), address(manager.USDG()), communityUSDG, manager.GENESIS_MINER_ALLOCATION()
        );
        return manager.initializeAndSeed(communityUSDG, sqrtPriceX96);
    }

    function initializeAndSeedWithPrice(LiquidityManager manager, uint256 communityUSDG, uint160 sqrtPriceX96)
        external
        returns (uint160)
    {
        return manager.initializeAndSeed(communityUSDG, sqrtPriceX96);
    }
}

contract EmptyLaunchGuardHookMock { }
