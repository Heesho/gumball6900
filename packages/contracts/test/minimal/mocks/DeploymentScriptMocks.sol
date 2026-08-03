// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { PositionInfo } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

contract DeploymentScriptUSDGCode is ERC20 {
    constructor() ERC20("Global Dollar", "USDG") { }
}

contract DeploymentScriptPermit2Mock {
    struct PackedAllowance {
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    mapping(address owner => mapping(address token => mapping(address spender => PackedAllowance approval))) private
        _allowances;

    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        PackedAllowance storage approval = _allowances[msg.sender][token][spender];
        approval.amount = amount;
        approval.expiration = expiration;
    }

    function allowance(address owner, address token, address spender)
        external
        view
        returns (uint160 amount, uint48 expiration, uint48 nonce)
    {
        PackedAllowance storage approval = _allowances[owner][token][spender];
        return (approval.amount, approval.expiration, approval.nonce);
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        PackedAllowance storage approval = _allowances[from][token][msg.sender];
        require(approval.amount >= amount && approval.expiration >= block.timestamp, "PERMIT2_ALLOWANCE");
        approval.amount -= amount;
        IERC20(token).transferFrom(from, to, amount);
    }
}

contract DeploymentScriptPositionManagerMock is ERC721 {
    DeploymentScriptPermit2Mock public immutable PERMIT2;

    uint256 public nextTokenId = 6_900;
    uint256 public depositedPrincipal;
    uint256 public liquidityDeadline;
    bytes32 public initializedPoolKeyHash;
    uint160 public initializedSqrtPriceX96;
    mapping(uint256 tokenId => PoolKey key) private _poolKey;

    constructor(DeploymentScriptPermit2Mock permit2) ERC721("Uniswap V4 Positions NFT", "UNI-V4-POSM") {
        PERMIT2 = permit2;
    }

    function initializePool(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24 tick) {
        require(initializedSqrtPriceX96 == 0, "ALREADY_INITIALIZED");
        initializedPoolKeyHash = keccak256(abi.encode(key));
        initializedSqrtPriceX96 = sqrtPriceX96;
        return TickMath.getTickAtSqrtPrice(sqrtPriceX96);
    }

    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable {
        require(deadline >= block.timestamp, "DEADLINE");
        liquidityDeadline = deadline;
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        require(actions.length == 3 && params.length == 3, "ACTION_LENGTH");
        require(uint8(actions[0]) == uint8(Actions.MINT_POSITION), "MINT_ACTION");
        require(uint8(actions[1]) == uint8(Actions.CLOSE_CURRENCY), "CLOSE_0_ACTION");
        require(uint8(actions[2]) == uint8(Actions.CLOSE_CURRENCY), "CLOSE_1_ACTION");

        (
            PoolKey memory key,
            int24 tickLower,
            int24 tickUpper,
            uint256 liquidity,
            uint128 amount0Max,
            uint128 amount1Max,
            address owner,
            bytes memory hookData
        ) = abi.decode(params[0], (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
        require(keccak256(abi.encode(key)) == initializedPoolKeyHash, "POOL_KEY");
        require(tickLower < tickUpper && liquidity != 0 && hookData.length == 0, "POSITION");
        require((amount0Max == 0) != (amount1Max == 0), "NOT_SINGLE_SIDED");

        uint160 principal = amount0Max == 0 ? amount1Max : amount0Max;
        address token = amount0Max == 0 ? Currency.unwrap(key.currency1) : Currency.unwrap(key.currency0);
        PERMIT2.transferFrom(msg.sender, address(this), principal, token);
        depositedPrincipal += principal;

        uint256 tokenId = nextTokenId;
        nextTokenId = tokenId + 1;
        _poolKey[tokenId] = key;
        _safeMint(owner, tokenId);
    }

    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, PositionInfo) {
        _requireOwned(tokenId);
        return (_poolKey[tokenId], PositionInfo.wrap(0));
    }
}
