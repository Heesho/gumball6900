// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { PositionInfo, PositionInfoLibrary } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

import { GenesisLiquidityMath } from "../../../src/libraries/GenesisLiquidityMath.sol";
import { GenesisPriceMath } from "../../../src/libraries/GenesisPriceMath.sol";

/// @notice Mintable token used only by the disposable browser/Anvil rehearsal.
contract WebRehearsalERC20 is ERC20 {
    uint8 private immutable _tokenDecimals;
    address public immutable ACCESS_CONTROLLED_REGISTRY;
    bytes32 public immutable uid;
    uint256 public immutable uiMultiplier;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 tokenDecimals_,
        address accessControlledRegistry_,
        bytes32 uid_,
        uint256 uiMultiplier_
    ) ERC20(name_, symbol_) {
        _tokenDecimals = tokenDecimals_;
        ACCESS_CONTROLLED_REGISTRY = accessControlledRegistry_;
        uid = uid_;
        uiMultiplier = uiMultiplier_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function paused() external pure returns (bool) {
        return false;
    }

    function tokenPaused() external pure returns (bool) {
        return false;
    }

    function oraclePaused() external pure returns (bool) {
        return false;
    }
}

/// @notice Code-bearing stand-in for dependencies outside the bounded browser rehearsal.
contract WebRehearsalCodeStub { }

/// @notice Reviewed implementation identity used by disposable stock-token registration evidence.
contract WebRehearsalStockTokenImplementation { }

/// @notice Shared local beacon whose exact implementation and runtime hash are committed by the timelock operation.
contract WebRehearsalStockTokenBeacon {
    address public immutable implementation;

    constructor(address implementation_) {
        implementation = implementation_;
    }

    function paused() external pure returns (bool) {
        return false;
    }

    function isBlocked(address) external pure returns (bool) {
        return false;
    }
}

/// @notice Read-only StateView boundary used to prove the browser's pinned canonical-pool reads on disposable Anvil.
contract WebRehearsalStateView {
    address public immutable poolManager;
    address public liquidityManager;

    uint160 private _sqrtPriceX96;
    int24 private _tick;
    uint128 private _activeLiquidity;
    bool private _seeded;
    mapping(bytes32 rangeKey => uint128 liquidity) private _rangeLiquidity;
    mapping(bytes32 rangeKey => bool exists) private _rangeExists;

    constructor(address poolManager_) {
        poolManager = poolManager_;
    }

    function configure(address liquidityManager_) external {
        require(liquidityManager == address(0) && liquidityManager_ != address(0), "configured");
        liquidityManager = liquidityManager_;
    }

    function seed(
        uint160 sqrtPriceX96_,
        int24 tick_,
        int24[4] calldata tickLower,
        int24[4] calldata tickUpper,
        uint128[4] calldata liquidities
    ) external {
        require(msg.sender == liquidityManager && !_seeded, "seed");
        uint256 activeLiquidity;
        for (uint256 index; index < 4; ++index) {
            bytes32 rangeKey = _rangeKey(tickLower[index], tickUpper[index]);
            require(!_rangeExists[rangeKey] && liquidities[index] != 0, "range");
            _rangeExists[rangeKey] = true;
            _rangeLiquidity[rangeKey] = liquidities[index];
            if (tick_ >= tickLower[index] && tick_ < tickUpper[index]) activeLiquidity += liquidities[index];
        }
        require(activeLiquidity <= type(uint128).max, "active liquidity");
        _sqrtPriceX96 = sqrtPriceX96_;
        _tick = tick_;
        _activeLiquidity = uint128(activeLiquidity);
        _seeded = true;
    }

    function getSlot0(bytes32)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)
    {
        require(_seeded, "unseeded");
        return (_sqrtPriceX96, _tick, 0, 3_000);
    }

    function getLiquidity(bytes32) external view returns (uint128 liquidity) {
        require(_seeded, "unseeded");
        return _activeLiquidity;
    }

    function getPositionInfo(bytes32, address, int24 tickLower, int24 tickUpper, bytes32)
        external
        view
        returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128)
    {
        return (_liquidityForRange(tickLower, tickUpper), 0, 0);
    }

    function getFeeGrowthInside(bytes32, int24 tickLower, int24 tickUpper)
        external
        view
        returns (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128)
    {
        _liquidityForRange(tickLower, tickUpper);
        return (0, 0);
    }

    function _liquidityForRange(int24 tickLower, int24 tickUpper) private view returns (uint128 liquidity) {
        bytes32 rangeKey = _rangeKey(tickLower, tickUpper);
        require(_rangeExists[rangeKey], "unknown range");
        return _rangeLiquidity[rangeKey];
    }

    function _rangeKey(int24 tickLower, int24 tickUpper) private pure returns (bytes32) {
        return keccak256(abi.encode(tickLower, tickUpper));
    }
}

/// @notice Read-compatible single-pool quote boundary for the disposable browser/Anvil rehearsal.
/// @dev It intentionally models only the official v4 Quoter function consumed by the SDK and never executes swaps.
contract WebRehearsalV4Quoter {
    struct QuoteExactSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 exactAmount;
        bytes hookData;
    }

    address public immutable GBX;
    address public immutable USDG;

    constructor(address gbx_, address usdG_) {
        GBX = gbx_;
        USDG = usdG_;
    }

    function quoteExactInputSingle(QuoteExactSingleParams calldata params)
        external
        view
        returns (uint256 amountOut, uint256 gasEstimate)
    {
        address input = params.zeroForOne
            ? Currency.unwrap(params.poolKey.currency0)
            : Currency.unwrap(params.poolKey.currency1);
        require(input == GBX || input == USDG, "input");
        require(params.hookData.length == 0, "hook data");

        // A bounded constant-product-style size adjustment gives the UI a nonzero quote-size comparison in both
        // decimal directions without pretending this fixture is a production price source.
        if (input == USDG) {
            uint256 wholeInput = uint256(params.exactAmount) / 1e6;
            uint256 baseOutput = uint256(params.exactAmount) * 2e12;
            amountOut = baseOutput * 1_000_000 / (1_000_000 + wholeInput);
        } else {
            uint256 wholeInput = uint256(params.exactAmount) / 1e18;
            uint256 baseOutput = uint256(params.exactAmount) / 2e12;
            amountOut = baseOutput * 1_000_000 / (1_000_000 + wholeInput);
        }
        gasEstimate = 125_000;
    }
}

/// @notice PositionManager read boundary with four immutable-in-practice rehearsal NFTs.
contract WebRehearsalPositionManager {
    address public immutable poolManager;
    address public immutable permit2;

    address private _owner;
    PoolKey private _poolKey;
    bool private _configured;
    bool private _seeded;
    int24[4] private _tickLower;
    int24[4] private _tickUpper;
    uint128[4] private _liquidities;

    constructor(address poolManager_, address permit2_) {
        poolManager = poolManager_;
        permit2 = permit2_;
    }

    function configure(address owner_, PoolKey calldata key_) external {
        require(!_configured, "configured");
        _configured = true;
        _owner = owner_;
        _poolKey = key_;
    }

    function seed(int24[4] calldata tickLower, int24[4] calldata tickUpper, uint128[4] calldata liquidities) external {
        require(msg.sender == _owner && !_seeded, "seed");
        for (uint256 index; index < 4; ++index) {
            require(tickLower[index] < tickUpper[index] && liquidities[index] != 0, "position");
            _tickLower[index] = tickLower[index];
            _tickUpper[index] = tickUpper[index];
            _liquidities[index] = liquidities[index];
        }
        _seeded = true;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        _requirePosition(tokenId);
        return _owner;
    }

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128 liquidity) {
        uint256 index = _positionIndex(tokenId);
        _requireSeeded();
        return _liquidities[index];
    }

    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory key, PositionInfo info) {
        uint256 index = _positionIndex(tokenId);
        _requireSeeded();
        key = _poolKey;
        info = PositionInfoLibrary.initialize(key, _tickLower[index], _tickUpper[index]);
    }

    function _positionIndex(uint256 tokenId) private pure returns (uint256 index) {
        require(tokenId >= 101 && tokenId <= 104, "unknown token");
        index = tokenId - 101;
    }

    function _requirePosition(uint256 tokenId) private pure {
        _positionIndex(tokenId);
    }

    function _requireSeeded() private view {
        require(_seeded, "unseeded");
    }
}

/// @notice Protocol-boundary LiquidityManager mock used only by the full browser/Anvil read rehearsal.
contract WebRehearsalLiquidityManager {
    struct PositionRecord {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 gbxPrincipal;
        bool exists;
    }

    address public immutable GBX;
    address public immutable USDG;
    address public immutable POOL_MANAGER;
    address public immutable POSITION_MANAGER;
    address public immutable STATE_VIEW;
    address public immutable PERMIT2;
    address public immutable LAUNCH_GUARD_HOOK;
    uint24 public constant POOL_FEE = 3_000;
    int24 public constant TICK_SPACING = 60;
    uint256 public constant MAX_ACTIVE_POSITIONS = 16;
    uint256 private constant GENESIS_MINER_ALLOCATION = 80_000_000 ether;

    uint16[4] public allocationBps = [uint16(5_000), 3_000, 1_500, 500];
    uint256[4] public positionIds = [uint256(101), 102, 103, 104];
    mapping(uint256 positionId => PositionRecord record) public positionRecord;
    bool public genesisSeeded;
    bool public migrationsPaused;
    uint256 public genesisLiquidityPrincipal;
    uint256 public genesisLiquidityResidual;
    uint256 public migrationCount;
    uint256 public activePositionCount;

    constructor(
        address gbx_,
        address usdG_,
        address poolManager_,
        address positionManager_,
        address stateView_,
        address permit2_,
        address launchGuardHook_
    ) {
        GBX = gbx_;
        USDG = usdG_;
        POOL_MANAGER = poolManager_;
        POSITION_MANAGER = positionManager_;
        STATE_VIEW = stateView_;
        PERMIT2 = permit2_;
        LAUNCH_GUARD_HOOK = launchGuardHook_;
    }

    function poolKey() public view returns (PoolKey memory key) {
        (address token0, address token1) = GBX < USDG ? (GBX, USDG) : (USDG, GBX);
        key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(LAUNCH_GUARD_HOOK)
        });
    }

    function initializeAndSeed(uint256 communityUSDG, uint160 sqrtPriceX96)
        external
        returns (uint160 initializedSqrtPriceX96)
    {
        require(!genesisSeeded, "seeded");
        uint256 balance = IERC20(GBX).balanceOf(address(this));
        require(balance == 20_000_000 ether, "allocation");
        require(communityUSDG != 0, "community");
        genesisSeeded = true;
        GenesisPriceMath.validateSqrtPriceX96(GBX, USDG, communityUSDG, GENESIS_MINER_ALLOCATION, sqrtPriceX96);
        int24 currentTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);
        (int24[4] memory tickLower, int24[4] memory tickUpper, uint128[4] memory liquidities, uint256 principal) =
            _buildGenesisPlan(sqrtPriceX96, currentTick);
        genesisLiquidityPrincipal = principal;
        WebRehearsalPositionManager(POSITION_MANAGER).seed(tickLower, tickUpper, liquidities);
        WebRehearsalStateView(STATE_VIEW).seed(sqrtPriceX96, currentTick, tickLower, tickUpper, liquidities);
        activePositionCount = 4;
        require(IERC20(GBX).transfer(POOL_MANAGER, principal), "transfer");
        genesisLiquidityResidual = IERC20(GBX).balanceOf(address(this));
        require(principal + genesisLiquidityResidual == balance, "principal");
        initializedSqrtPriceX96 = sqrtPriceX96;
    }

    function _buildGenesisPlan(uint160 sqrtPriceX96, int24 currentTick)
        private
        returns (int24[4] memory tickLower, int24[4] memory tickUpper, uint128[4] memory liquidities, uint256 principal)
    {
        bool gbxIsToken0 = GBX < USDG;
        int24 boundary = GenesisPriceMath.oneSidedGBXBoundary(sqrtPriceX96, currentTick, TICK_SPACING, gbxIsToken0);
        int24[4] memory cumulativeTickDeltas = [int24(4_080), 10_980, 17_940, 24_900];

        for (uint256 index; index < 4; ++index) {
            int24 previousDelta = index == 0 ? int24(0) : cumulativeTickDeltas[index - 1];
            tickLower[index] = gbxIsToken0 ? boundary + previousDelta : boundary - cumulativeTickDeltas[index];
            tickUpper[index] = gbxIsToken0 ? boundary + cumulativeTickDeltas[index] : boundary - previousDelta;
            uint256 allocationCap = uint256(allocationBps[index]) * 2_000 ether;
            uint256 positionPrincipal;
            (liquidities[index], positionPrincipal) = gbxIsToken0
                ? GenesisLiquidityMath.maxLiquidityForAmount0(
                    TickMath.getSqrtPriceAtTick(tickLower[index]),
                    TickMath.getSqrtPriceAtTick(tickUpper[index]),
                    allocationCap
                )
                : GenesisLiquidityMath.maxLiquidityForAmount1(
                    TickMath.getSqrtPriceAtTick(tickLower[index]),
                    TickMath.getSqrtPriceAtTick(tickUpper[index]),
                    allocationCap
                );
            principal += positionPrincipal;
            positionRecord[101 + index] = PositionRecord({
                tickLower: tickLower[index],
                tickUpper: tickUpper[index],
                liquidity: liquidities[index],
                gbxPrincipal: positionPrincipal,
                exists: true
            });
        }
    }

    function pauseMigrations() external {
        migrationsPaused = true;
    }

    function unpauseMigrations() external {
        migrationsPaused = false;
    }
}
