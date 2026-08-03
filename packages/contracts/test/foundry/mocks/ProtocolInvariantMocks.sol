// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";

contract ProtocolInvariantToken is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 tokenDecimals_) ERC20(name_, symbol_) {
        _tokenDecimals = tokenDecimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}

/// @notice Raw ERC-20 balances deliberately do not change when the external stock-token multiplier changes.
contract ProtocolInvariantStockToken is ProtocolInvariantToken {
    bytes32 public constant uid = keccak256("STOCK");
    address public ACCESS_CONTROLLED_REGISTRY;
    uint256 public currentMultiplier = 1e18;
    uint256 public pendingMultiplier;
    uint64 public pendingActivationTime;

    constructor() ProtocolInvariantToken("Stock Token", "STOCK", 18) { }

    function configureAccessControlledRegistry(address registry) external {
        require(ACCESS_CONTROLLED_REGISTRY == address(0), "registry configured");
        ACCESS_CONTROLLED_REGISTRY = registry;
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

    function proposeMultiplier(uint256 multiplier, uint64 activationTime) external {
        require(multiplier != 0 && activationTime >= block.timestamp, "invalid multiplier");
        pendingMultiplier = multiplier;
        pendingActivationTime = activationTime;
    }

    function activateMultiplier() external {
        require(pendingMultiplier != 0 && block.timestamp >= pendingActivationTime, "not ready");
        currentMultiplier = pendingMultiplier;
        pendingMultiplier = 0;
        pendingActivationTime = 0;
    }

    function uiMultiplier() external view returns (uint256) {
        return currentMultiplier;
    }
}

contract ProtocolInvariantPoolManager {
    bool public initialized;
    address public initializer;
    uint160 public sqrtPriceX96;
    int24 public currentTick;

    function initialize(PoolKey calldata key, uint160 sqrtPriceX96_) external returns (int24 tick) {
        IHooks(address(key.hooks)).beforeInitialize(msg.sender, key, sqrtPriceX96_);
        initialized = true;
        initializer = msg.sender;
        sqrtPriceX96 = sqrtPriceX96_;
        tick = TickMath.getTickAtSqrtPrice(sqrtPriceX96_);
        currentTick = tick;
    }

    function setCurrentTick(int24 tick) external {
        sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        currentTick = tick;
    }

    function extsload(bytes32) external view returns (bytes32 value) {
        value = bytes32(uint256(sqrtPriceX96) | (uint256(uint24(currentTick)) << 160));
    }
}

contract ProtocolInvariantPermit2 {
    function approve(address, address, uint160, uint48) external { }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        IERC20(token).transferFrom(from, to, amount);
    }
}

/// @notice Stateful position-manager boundary for lifecycle invariants over protocol-owned LP NFTs.
contract ProtocolInvariantPositionManager {
    IERC20 public gbx;
    IERC20 public usdG;
    ProtocolInvariantPermit2 public permit2;
    bool public configured;
    uint256 public nextTokenId = 6_900;
    uint256 public gbxDeposited;
    uint256 public pendingGBX;
    uint256 public pendingUSDG;
    uint256 public migrationGBXRemoved;
    uint256 public migrationUSDGRemoved;
    uint256 public migrationGBXDeposited;
    uint256 public migrationUSDGDeposited;
    mapping(uint256 tokenId => address owner) public ownerOf;
    mapping(uint256 tokenId => uint128 liquidity) public positionLiquidity;
    mapping(uint256 tokenId => bytes32 poolKeyHash) public positionPoolKeyHash;

    function configure(IERC20 gbx_, IERC20 usdG_, ProtocolInvariantPermit2 permit2_) external {
        require(!configured, "already configured");
        configured = true;
        gbx = gbx_;
        usdG = usdG_;
        permit2 = permit2_;
    }

    function setPendingPayout(uint256 gbxAmount, uint256 usdGAmount) external {
        pendingGBX = gbxAmount;
        pendingUSDG = usdGAmount;
    }

    function setMigrationAmounts(uint256 gbxRemoved, uint256 usdGRemoved, uint256 gbxReinvested, uint256 usdGReinvested)
        external
    {
        migrationGBXRemoved = gbxRemoved;
        migrationUSDGRemoved = usdGRemoved;
        migrationGBXDeposited = gbxReinvested;
        migrationUSDGDeposited = usdGReinvested;
    }

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128) {
        return positionLiquidity[tokenId];
    }

    function modifyLiquidities(bytes calldata unlockData, uint256) external payable {
        require(configured, "not configured");
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        uint8 firstAction = uint8(actions[0]);
        if (firstAction == uint8(Actions.MINT_POSITION)) {
            _captureGenesisMints(params);
            return;
        }
        if (firstAction == uint8(Actions.DECREASE_LIQUIDITY)) {
            _collectFees(actions, params);
            return;
        }
        if (firstAction == uint8(Actions.BURN_POSITION) && actions.length == 2) {
            _sweepPosition(actions, params);
            return;
        }
        if (firstAction == uint8(Actions.BURN_POSITION)) {
            _migrate(actions, params);
            return;
        }
        revert("unexpected action");
    }

    function _captureGenesisMints(bytes[] memory params) private {
        uint256 firstTokenId = nextTokenId;
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
            tickLower;
            tickUpper;
            hookData;
            require(liquidity <= type(uint128).max, "liquidity overflow");
            ownerOf[firstTokenId + index] = owner;
            positionLiquidity[firstTokenId + index] = uint128(liquidity);
            positionPoolKeyHash[firstTokenId + index] = keccak256(abi.encode(key));
            totalGBX += address(gbx) < address(usdG) ? uint256(amount0Max) : uint256(amount1Max);
        }

        permit2.transferFrom(msg.sender, address(this), uint160(totalGBX), address(gbx));
        gbxDeposited += totalGBX;
        nextTokenId = firstTokenId + 4;
    }

    function _collectFees(bytes memory actions, bytes[] memory params) private {
        require(actions.length == 2 && uint8(actions[1]) == uint8(Actions.TAKE_PAIR), "invalid collect actions");
        (uint256 tokenId, uint256 liquidityDelta, uint128 amount0Min, uint128 amount1Min, bytes memory hookData) =
            abi.decode(params[0], (uint256, uint256, uint128, uint128, bytes));
        amount0Min;
        amount1Min;
        hookData;
        require(ownerOf[tokenId] != address(0) && liquidityDelta == 0, "invalid collect position");
        _validateTakePair(params[1], msg.sender);
        _payPending(msg.sender);
    }

    function _sweepPosition(bytes memory actions, bytes[] memory params) private {
        require(actions.length == 2 && uint8(actions[1]) == uint8(Actions.TAKE_PAIR), "invalid sweep actions");
        (uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes memory hookData) =
            abi.decode(params[0], (uint256, uint128, uint128, bytes));
        amount0Min;
        amount1Min;
        hookData;
        require(ownerOf[tokenId] != address(0), "invalid sweep position");
        delete ownerOf[tokenId];
        delete positionLiquidity[tokenId];
        delete positionPoolKeyHash[tokenId];
        _validateTakePair(params[1], msg.sender);
        _payPending(msg.sender);
    }

    function _migrate(bytes memory actions, bytes[] memory params) private {
        uint256 replacementCount;
        for (uint256 index; index < actions.length - 1; ++index) {
            uint8 action = uint8(actions[index]);
            if (action == uint8(Actions.BURN_POSITION)) {
                _captureMigrationBurn(params[index]);
            } else if (action == uint8(Actions.MINT_POSITION)) {
                _captureMigrationMint(params[index], nextTokenId + replacementCount);
                replacementCount += 1;
            } else {
                revert("invalid migration action");
            }
        }
        require(uint8(actions[actions.length - 1]) == uint8(Actions.TAKE_PAIR), "missing take pair");
        _validateTakePair(params[actions.length - 1], msg.sender);
        require(migrationGBXDeposited <= migrationGBXRemoved, "gbx debt");
        require(migrationUSDGDeposited <= migrationUSDGRemoved, "usdg debt");

        nextTokenId += replacementCount;
        uint256 residualGBX = migrationGBXRemoved - migrationGBXDeposited;
        uint256 residualUSDG = migrationUSDGRemoved - migrationUSDGDeposited;
        require(gbx.balanceOf(address(this)) >= gbxDeposited + residualGBX, "genesis principal at risk");
        require(usdG.balanceOf(address(this)) >= residualUSDG, "insufficient usdg");
        migrationGBXRemoved = 0;
        migrationUSDGRemoved = 0;
        migrationGBXDeposited = 0;
        migrationUSDGDeposited = 0;
        if (residualGBX != 0) gbx.transfer(msg.sender, residualGBX);
        if (residualUSDG != 0) usdG.transfer(msg.sender, residualUSDG);
    }

    function _captureMigrationBurn(bytes memory param) private {
        (uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes memory hookData) =
            abi.decode(param, (uint256, uint128, uint128, bytes));
        hookData;
        require(ownerOf[tokenId] != address(0), "invalid migration position");
        (uint256 gbxMinimum, uint256 usdGMinimum) = _orderedAmounts(amount0Min, amount1Min);
        require(gbxMinimum <= migrationGBXRemoved && usdGMinimum <= migrationUSDGRemoved, "minimum not met");
        delete ownerOf[tokenId];
        delete positionLiquidity[tokenId];
        delete positionPoolKeyHash[tokenId];
    }

    function _captureMigrationMint(bytes memory param, uint256 tokenId) private {
        (
            PoolKey memory key,
            int24 tickLower,
            int24 tickUpper,
            uint256 liquidity,
            uint128 amount0Max,
            uint128 amount1Max,
            address owner,
            bytes memory hookData
        ) = abi.decode(param, (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
        key;
        tickLower;
        tickUpper;
        hookData;
        require(liquidity <= type(uint128).max, "liquidity overflow");
        (uint256 gbxMaximum, uint256 usdGMaximum) = _orderedAmounts(amount0Max, amount1Max);
        require(migrationGBXDeposited <= gbxMaximum && migrationUSDGDeposited <= usdGMaximum, "maximum exceeded");
        ownerOf[tokenId] = owner;
        positionLiquidity[tokenId] = uint128(liquidity);
        positionPoolKeyHash[tokenId] = keccak256(abi.encode(key));
    }

    function _payPending(address receiver) private {
        uint256 gbxAmount = pendingGBX;
        uint256 usdGAmount = pendingUSDG;
        require(gbx.balanceOf(address(this)) >= gbxDeposited + gbxAmount, "genesis principal at risk");
        require(usdG.balanceOf(address(this)) >= usdGAmount, "insufficient usdg");
        pendingGBX = 0;
        pendingUSDG = 0;
        if (gbxAmount != 0) gbx.transfer(receiver, gbxAmount);
        if (usdGAmount != 0) usdG.transfer(receiver, usdGAmount);
    }

    function _validateTakePair(bytes memory param, address expectedRecipient) private view {
        (Currency currency0, Currency currency1, address recipient) = abi.decode(param, (Currency, Currency, address));
        require(
            Currency.unwrap(currency0) == _token0() && Currency.unwrap(currency1) == _token1(), "invalid currencies"
        );
        require(recipient == expectedRecipient, "invalid recipient");
    }

    function _orderedAmounts(uint256 amount0, uint256 amount1)
        private
        view
        returns (uint256 gbxAmount, uint256 usdGAmount)
    {
        return address(gbx) < address(usdG) ? (amount0, amount1) : (amount1, amount0);
    }

    function _token0() private view returns (address) {
        return address(gbx) < address(usdG) ? address(gbx) : address(usdG);
    }

    function _token1() private view returns (address) {
        return address(gbx) < address(usdG) ? address(usdG) : address(gbx);
    }
}
