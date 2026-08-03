// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { PositionInfo } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

import { LiquidityCustodian } from "../../../src/liquidity/LiquidityCustodian.sol";

contract LiquidityCustodianGBXMock is ERC20Burnable {
    constructor() ERC20("Gumball", "GBX") { }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}

contract LiquidityCustodianUSDGMock is ERC20 {
    uint256 public vaultTransferFeeBps;
    address public feeSender;
    address public feeRecipient;

    constructor() ERC20("Global Dollar", "USDG") { }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function setVaultTransferFee(address sender, address recipient, uint256 feeBps) external {
        feeSender = sender;
        feeRecipient = recipient;
        vaultTransferFeeBps = feeBps;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == feeSender && to == feeRecipient && vaultTransferFeeBps != 0) {
            uint256 fee = value * vaultTransferFeeBps / 10_000;
            if (fee != 0) super._update(from, address(0), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

contract LiquidityCustodianVaultMock { }

contract LiquidityCustodianAllocationVoterMock {
    IERC20 public immutable USDG;
    address public immutable VAULT;

    address public notifier;
    uint256 public notifiedAmount;
    uint256 public vaultBalanceAtNotification;
    address public reentryTarget;
    bool public attemptReentry;
    bool public reentrySucceeded;

    constructor(IERC20 usdG, address vault) {
        USDG = usdG;
        VAULT = vault;
    }

    function setReentry(address target, bool enabled) external {
        reentryTarget = target;
        attemptReentry = enabled;
    }

    function notifyRevenue(uint256 amount) external {
        notifier = msg.sender;
        notifiedAmount += amount;
        vaultBalanceAtNotification = USDG.balanceOf(VAULT);
        if (attemptReentry) {
            (reentrySucceeded,) = reentryTarget.call(abi.encodeCall(LiquidityCustodian.collectFees, ()));
        }
    }
}

contract LiquidityCustodianPositionManagerMock is ERC721 {
    LiquidityCustodianGBXMock public immutable GBX;
    LiquidityCustodianUSDGMock public immutable USDG;

    mapping(uint256 tokenId => PoolKey key) private _poolKey;

    uint256 public pendingGBXFees;
    uint256 public pendingUSDGFees;
    uint256 public modifyCallCount;
    uint256 public lastDeadline;
    bytes public lastActions;
    uint256 public lastTokenId;
    uint256 public lastLiquidity;
    uint128 public lastAmount0Min;
    uint128 public lastAmount1Min;
    bytes public lastHookData;
    address public lastCurrency0;
    address public lastCurrency1;
    address public lastRecipient;

    constructor(LiquidityCustodianGBXMock gbx, LiquidityCustodianUSDGMock usdG)
        ERC721("Uniswap V4 Positions NFT", "UNI-V4-POSM")
    {
        GBX = gbx;
        USDG = usdG;
    }

    function mint(address owner, uint256 tokenId, PoolKey memory key) external {
        _poolKey[tokenId] = key;
        _mint(owner, tokenId);
    }

    function setPendingFees(uint256 gbxFees, uint256 usdGFees) external {
        pendingGBXFees = gbxFees;
        pendingUSDGFees = usdGFees;
    }

    function burnPosition(uint256 tokenId) external {
        _burn(tokenId);
    }

    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, PositionInfo) {
        _requireOwned(tokenId);
        return (_poolKey[tokenId], PositionInfo.wrap(0));
    }

    function callReceiverWithoutTransfer(address receiver, address from, uint256 tokenId) external returns (bytes4) {
        return IERC721Receiver(receiver).onERC721Received(address(this), from, tokenId, "");
    }

    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable {
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        require(actions.length == 2 && params.length == 2, "INVALID_LENGTH");
        require(uint8(actions[0]) == uint8(Actions.DECREASE_LIQUIDITY), "INVALID_FIRST_ACTION");
        require(uint8(actions[1]) == uint8(Actions.TAKE_PAIR), "INVALID_SECOND_ACTION");

        (uint256 tokenId, uint256 liquidity, uint128 amount0Min, uint128 amount1Min, bytes memory hookData) =
            abi.decode(params[0], (uint256, uint256, uint128, uint128, bytes));
        (Currency currency0, Currency currency1, address recipient) =
            abi.decode(params[1], (Currency, Currency, address));
        require(ownerOf(tokenId) == msg.sender, "NOT_POSITION_OWNER");

        modifyCallCount += 1;
        lastDeadline = deadline;
        lastActions = actions;
        lastTokenId = tokenId;
        lastLiquidity = liquidity;
        lastAmount0Min = amount0Min;
        lastAmount1Min = amount1Min;
        lastHookData = hookData;
        lastCurrency0 = Currency.unwrap(currency0);
        lastCurrency1 = Currency.unwrap(currency1);
        lastRecipient = recipient;

        uint256 gbxFees = pendingGBXFees;
        uint256 usdGFees = pendingUSDGFees;
        pendingGBXFees = 0;
        pendingUSDGFees = 0;
        if (gbxFees != 0) GBX.transfer(msg.sender, gbxFees);
        if (usdGFees != 0) USDG.transfer(msg.sender, usdGFees);
    }
}

contract LiquidityCustodianOtherNFTMock is ERC721 {
    constructor() ERC721("Other NFT", "OTHER") { }

    function mint(address receiver, uint256 tokenId) external {
        _mint(receiver, tokenId);
    }
}

contract LiquidityCustodianRecipientMock is IERC721Receiver {
    address public nft;
    uint256 public tokenId;

    function onERC721Received(address, address, uint256 receivedTokenId, bytes calldata) external returns (bytes4) {
        nft = msg.sender;
        tokenId = receivedTokenId;
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract LiquidityCustodianNonReceiverMock { }

contract LiquidityCustodianTimelockMock {
    function transferPosition(LiquidityCustodian custodian, address recipient) external {
        custodian.transferPosition(recipient);
    }
}
