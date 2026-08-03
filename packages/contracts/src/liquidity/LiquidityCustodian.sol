// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";

import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";

/// @title LiquidityCustodian
/// @notice Holds one canonical GBX/USDG Uniswap v4 position and permissionlessly routes its fees.
/// @dev This repository-original v4 integration has no approvals, principal withdrawal, rescue, or migration path.
///      A future reviewed contract may receive only the recorded NFT through the purpose-limited ProtocolTimelock.
contract LiquidityCustodian is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Dependencies {
        address positionManager;
        address positionDepositor;
        uint256 expectedPositionTokenId;
        address gbx;
        address usdG;
        address gumBallVault;
        address allocationVoter;
        address protocolTimelock;
    }

    error LiquidityCustodian__AddressHasNoCode(address account);
    error LiquidityCustodian__InvalidPoolCurrencies(address currency0, address currency1);
    error LiquidityCustodian__InvalidPoolKey(bytes32 expected, bytes32 actual);
    error LiquidityCustodian__InexactUSDGTransfer(uint256 expected, uint256 debit, uint256 receipt);
    error LiquidityCustodian__NoPositionRecorded();
    error LiquidityCustodian__NonzeroHook(address hook);
    error LiquidityCustodian__NotProtocolTimelock(address caller);
    error LiquidityCustodian__PositionAlreadyRecorded(uint256 positionId);
    error LiquidityCustodian__PositionNotInCustody(uint256 positionId);
    error LiquidityCustodian__PositionNotOwned(uint256 positionId, address owner);
    error LiquidityCustodian__UnexpectedNFTSender(address sender);
    error LiquidityCustodian__UnexpectedPositionDepositor(address depositor);
    error LiquidityCustodian__UnexpectedPositionTokenId(uint256 expected, uint256 actual);
    error LiquidityCustodian__ZeroAddress();

    event LiquidityCustodian__FeesCollected(
        uint256 indexed positionId, address indexed caller, uint256 gbxBurned, uint256 usdGToVault
    );
    event LiquidityCustodian__PositionRecorded(
        uint256 indexed positionId, address indexed previousOwner, bytes32 indexed poolKeyHash
    );
    event LiquidityCustodian__PositionTransferred(uint256 indexed positionId, address indexed recipient);

    /// @notice Canonical Uniswap v4 position NFT contract.
    IPositionManager public immutable POSITION_MANAGER;
    /// @notice Reviewed one-time account allowed to deliver the genesis position.
    address public immutable POSITION_DEPOSITOR;
    /// @notice Precommitted PositionManager token ID for the genesis position.
    uint256 public immutable EXPECTED_POSITION_TOKEN_ID;
    /// @notice Canonical GBX token whose collected fees are burned.
    IGBXToken public immutable GBX;
    /// @notice Canonical USDG token whose collected fees are deposited into the vault.
    IERC20 public immutable USDG;
    /// @notice Passive protocol vault receiving collected USDG.
    address public immutable GUM_BALL_VAULT;
    /// @notice Allocation ledger notified only after the vault receives USDG.
    IAllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Purpose-limited timelock authorized to transfer the exact recorded position.
    address public immutable PROTOCOL_TIMELOCK;

    /// @notice Lower-address token in the canonical v4 pool.
    address public immutable CURRENCY0;
    /// @notice Higher-address token in the canonical v4 pool.
    address public immutable CURRENCY1;
    /// @notice Fee tier of the canonical v4 pool.
    uint24 public immutable POOL_FEE;
    /// @notice Tick spacing of the canonical v4 pool.
    int24 public immutable TICK_SPACING;
    /// @notice Hash of the complete canonical hookless pool key.
    bytes32 public immutable POOL_KEY_HASH;

    /// @notice Whether the reviewed deployment transfer has recorded the canonical position.
    bool public positionRecorded;
    /// @notice The sole canonical PositionManager token ID accepted by this custodian.
    uint256 public positionTokenId;

    /// @notice Configures the sole accepted v4 position and its fixed protocol dependencies.
    /// @param dependencies Fixed protocol contracts and assets.
    /// @param canonicalPoolKey Exact hookless GBX/USDG pool identity accepted for the one position.
    constructor(Dependencies memory dependencies, PoolKey memory canonicalPoolKey) {
        if (
            dependencies.positionManager == address(0) || dependencies.positionDepositor == address(0)
                || dependencies.gbx == address(0) || dependencies.usdG == address(0)
                || dependencies.gumBallVault == address(0) || dependencies.allocationVoter == address(0)
                || dependencies.protocolTimelock == address(0)
        ) revert LiquidityCustodian__ZeroAddress();

        _requireCode(dependencies.positionManager);
        _requireCode(dependencies.gbx);
        _requireCode(dependencies.usdG);
        _requireCode(dependencies.gumBallVault);
        _requireCode(dependencies.allocationVoter);
        _requireCode(dependencies.protocolTimelock);

        address currency0 = Currency.unwrap(canonicalPoolKey.currency0);
        address currency1 = Currency.unwrap(canonicalPoolKey.currency1);
        address expectedCurrency0 = dependencies.gbx < dependencies.usdG ? dependencies.gbx : dependencies.usdG;
        address expectedCurrency1 = dependencies.gbx < dependencies.usdG ? dependencies.usdG : dependencies.gbx;
        if (currency0 != expectedCurrency0 || currency1 != expectedCurrency1) {
            revert LiquidityCustodian__InvalidPoolCurrencies(currency0, currency1);
        }
        address hook = address(canonicalPoolKey.hooks);
        if (hook != address(0)) revert LiquidityCustodian__NonzeroHook(hook);

        POSITION_MANAGER = IPositionManager(dependencies.positionManager);
        POSITION_DEPOSITOR = dependencies.positionDepositor;
        EXPECTED_POSITION_TOKEN_ID = dependencies.expectedPositionTokenId;
        GBX = IGBXToken(dependencies.gbx);
        USDG = IERC20(dependencies.usdG);
        GUM_BALL_VAULT = dependencies.gumBallVault;
        ALLOCATION_VOTER = IAllocationVoter(dependencies.allocationVoter);
        PROTOCOL_TIMELOCK = dependencies.protocolTimelock;
        CURRENCY0 = currency0;
        CURRENCY1 = currency1;
        POOL_FEE = canonicalPoolKey.fee;
        TICK_SPACING = canonicalPoolKey.tickSpacing;
        POOL_KEY_HASH = keccak256(abi.encode(canonicalPoolKey));
    }

    /// @notice Returns the immutable canonical hookless pool identity.
    function poolKey() public view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(CURRENCY0),
            currency1: Currency.wrap(CURRENCY1),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
    }

    /// @notice Returns whether the exact recorded position currently remains owned by this custodian.
    function positionInCustody() public view returns (bool) {
        if (!positionRecorded) return false;
        try IERC721(address(POSITION_MANAGER)).ownerOf(positionTokenId) returns (address owner) {
            return owner == address(this);
        } catch {
            return false;
        }
    }

    /// @notice Records the first and only canonical PositionManager NFT received by safe transfer.
    function onERC721Received(address, address from, uint256 tokenId, bytes calldata) external returns (bytes4) {
        if (msg.sender != address(POSITION_MANAGER)) {
            revert LiquidityCustodian__UnexpectedNFTSender(msg.sender);
        }
        if (positionRecorded) revert LiquidityCustodian__PositionAlreadyRecorded(positionTokenId);
        if (from != POSITION_DEPOSITOR) revert LiquidityCustodian__UnexpectedPositionDepositor(from);
        if (tokenId != EXPECTED_POSITION_TOKEN_ID) {
            revert LiquidityCustodian__UnexpectedPositionTokenId(EXPECTED_POSITION_TOKEN_ID, tokenId);
        }

        positionRecorded = true;
        positionTokenId = tokenId;

        address owner = IERC721(address(POSITION_MANAGER)).ownerOf(tokenId);
        if (owner != address(this)) revert LiquidityCustodian__PositionNotOwned(tokenId, owner);
        (PoolKey memory receivedPoolKey,) = POSITION_MANAGER.getPoolAndPositionInfo(tokenId);
        bytes32 receivedPoolKeyHash = keccak256(abi.encode(receivedPoolKey));
        if (receivedPoolKeyHash != POOL_KEY_HASH) {
            revert LiquidityCustodian__InvalidPoolKey(POOL_KEY_HASH, receivedPoolKeyHash);
        }

        emit LiquidityCustodian__PositionRecorded(tokenId, from, receivedPoolKeyHash);
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Collects fees without removing liquidity, burns GBX, and deposits USDG before voter notification.
    /// @return gbxBurned Collected GBX irreversibly burned by this call.
    /// @return usdGToVault Collected USDG actually received by GumBallVault and notified to AllocationVoter.
    function collectFees() external nonReentrant returns (uint256 gbxBurned, uint256 usdGToVault) {
        _requirePositionInCustody();

        uint256 gbxBalanceBefore = GBX.balanceOf(address(this));
        uint256 usdGBalanceBefore = USDG.balanceOf(address(this));

        bytes memory actions = new bytes(2);
        actions[0] = bytes1(uint8(Actions.DECREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(positionTokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        PoolKey memory key = poolKey();
        params[1] = abi.encode(key.currency0, key.currency1, address(this));
        POSITION_MANAGER.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        gbxBurned = GBX.balanceOf(address(this)) - gbxBalanceBefore;
        uint256 usdGCollected = USDG.balanceOf(address(this)) - usdGBalanceBefore;
        if (gbxBurned != 0) GBX.burn(gbxBurned);

        if (usdGCollected != 0) {
            uint256 custodianBalanceBefore = USDG.balanceOf(address(this));
            uint256 vaultBalanceBefore = USDG.balanceOf(GUM_BALL_VAULT);
            USDG.safeTransfer(GUM_BALL_VAULT, usdGCollected);
            uint256 custodianBalanceAfter = USDG.balanceOf(address(this));
            usdGToVault = USDG.balanceOf(GUM_BALL_VAULT) - vaultBalanceBefore;
            uint256 custodianDebit = custodianBalanceBefore - custodianBalanceAfter;
            if (custodianDebit != usdGCollected || usdGToVault != usdGCollected) {
                revert LiquidityCustodian__InexactUSDGTransfer(usdGCollected, custodianDebit, usdGToVault);
            }
            ALLOCATION_VOTER.notifyRevenue(usdGToVault);
        }

        emit LiquidityCustodian__FeesCollected(positionTokenId, msg.sender, gbxBurned, usdGToVault);
    }

    /// @notice Transfers only the recorded canonical NFT to a deployed replacement contract through ProtocolTimelock.
    /// @param recipient Reviewed replacement custodian or migration contract receiving the canonical position.
    function transferPosition(address recipient) external nonReentrant {
        if (msg.sender != PROTOCOL_TIMELOCK) revert LiquidityCustodian__NotProtocolTimelock(msg.sender);
        if (recipient == address(0)) revert LiquidityCustodian__ZeroAddress();
        _requireCode(recipient);
        _requirePositionInCustody();

        uint256 tokenId = positionTokenId;
        IERC721(address(POSITION_MANAGER)).safeTransferFrom(address(this), recipient, tokenId);
        emit LiquidityCustodian__PositionTransferred(tokenId, recipient);
    }

    function _requirePositionInCustody() private view {
        if (!positionRecorded) revert LiquidityCustodian__NoPositionRecorded();
        if (!positionInCustody()) revert LiquidityCustodian__PositionNotInCustody(positionTokenId);
    }

    function _requireCode(address account) private view {
        if (account.code.length == 0) revert LiquidityCustodian__AddressHasNoCode(account);
    }
}
