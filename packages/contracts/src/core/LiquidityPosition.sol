// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
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
import { PositionInfo } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

import { GBX } from "./GBX.sol";
import { ILiquidityPosition } from "./interfaces/ILiquidityPosition.sol";
import { IResonanceRouter } from "./interfaces/IResonanceRouter.sol";

/// @title LiquidityPosition
/// @author GUM BALL 6900
/// @notice Holds the canonical GBX/USDG Uniswap v4 position and permissionlessly processes its trading fees.
/// @dev The genesis position starts outside the active price as a GBX-only position. Fee collection never removes
///      principal: collected GBX is burned and collected USDG is routed through ResonanceRouter. The owner can only bind
///      one fully compatible successor, after which anyone may execute the exact NFT migration.
contract LiquidityPosition is IERC721Receiver, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Dependencies {
        IPositionManager positionManager;
        address positionDepositor;
        uint256 expectedPositionTokenId;
        GBX gbx;
        IERC20 usdg;
        address resonanceRouter;
        address initialOwner;
    }

    /// @notice Canonical Uniswap v4 PositionManager.
    IPositionManager public immutable positionManager;
    /// @notice One-time account expected to deliver the genesis position.
    address public immutable positionDepositor;
    /// @notice Precommitted token ID of the genesis position.
    uint256 public immutable expectedPositionTokenId;
    /// @notice GBX token burned when collected as fees.
    GBX public immutable gbx;
    /// @notice USDG token routed to Resonance.
    IERC20 public immutable usdg;
    /// @notice Router receiving all collected USDG.
    address public immutable resonanceRouter;

    /// @notice Lower-address token of the canonical pool.
    address public immutable currency0;
    /// @notice Higher-address token of the canonical pool.
    address public immutable currency1;
    /// @notice Fee tier of the canonical pool.
    uint24 public immutable poolFee;
    /// @notice Tick spacing of the canonical pool.
    int24 public immutable tickSpacing;
    /// @notice Hash of the complete hookless GBX/USDG pool key.
    bytes32 public immutable poolKeyHash;
    /// @notice Expected lower tick of the genesis position.
    int24 public immutable expectedTickLower;
    /// @notice Expected upper tick of the genesis position.
    int24 public immutable expectedTickUpper;

    /// @notice Whether the expected position has been received and validated.
    bool public positionRecorded;
    /// @notice The canonical PositionManager NFT held by this contract.
    uint256 public positionTokenId;
    /// @notice One-way compatible migration target, or zero before governance binds one.
    address public successor;

    /// @notice Emitted after collected and directly transferred fee tokens are processed.
    /// @param positionTokenId Canonical position NFT.
    /// @param caller Account that triggered collection.
    /// @param gbxBurned GBX permanently burned.
    /// @param usdgRouted USDG delivered through ResonanceRouter.
    event FeesProcessed(uint256 indexed positionTokenId, address indexed caller, uint256 gbxBurned, uint256 usdgRouted);
    /// @notice Emitted after the canonical NFT moves to its committed successor.
    /// @param positionTokenId Canonical position NFT.
    /// @param caller Account that triggered migration.
    /// @param successor Compatible destination that received the NFT.
    event PositionMigrated(uint256 indexed positionTokenId, address indexed caller, address indexed successor);
    /// @notice Emitted after the expected position is received and validated.
    /// @param positionTokenId Canonical position NFT.
    /// @param previousOwner Account that delivered the NFT.
    /// @param poolKeyHash Hash of the validated PoolKey.
    event PositionRecorded(uint256 indexed positionTokenId, address indexed previousOwner, bytes32 indexed poolKeyHash);
    /// @notice Emitted when governance permanently binds the compatible migration target.
    /// @param successor Compatible migration target.
    event SuccessorSet(address indexed successor);

    error AddressHasNoCode(address account);
    error EmptyPosition(uint256 positionTokenId);
    error IncompatibleSuccessor(address successor);
    error InexactUSDGTransfer(uint256 expected, uint256 debited, uint256 received);
    error InvalidPoolCurrencies(address currency0, address currency1);
    error InvalidPoolKey(bytes32 expected, bytes32 actual);
    error InvalidPositionTicks(int24 expectedLower, int24 expectedUpper, int24 actualLower, int24 actualUpper);
    error InvalidTickRange(int24 tickLower, int24 tickUpper);
    error NoPositionRecorded();
    error NonzeroHook(address hook);
    error PositionAlreadyRecorded(uint256 positionTokenId);
    error PositionNotInCustody(uint256 positionTokenId);
    error PositionNotOwned(uint256 positionTokenId, address owner);
    error SuccessorAlreadySet(address successor);
    error SuccessorNotSet();
    error UnexpectedNFTSender(address sender);
    error UnexpectedPositionDepositor(address depositor);
    error UnexpectedPositionTokenId(uint256 expected, uint256 actual);
    error ZeroAddress();

    /// @notice Fixes the exact v4 pool, range, NFT, fee route, and timelocked migration authority.
    /// @param dependencies Immutable protocol and PositionManager dependencies.
    /// @param canonicalPoolKey Exact hookless GBX/USDG pool identity.
    /// @param tickLower Expected lower tick of the precommitted single-sided position.
    /// @param tickUpper Expected upper tick of the precommitted single-sided position.
    constructor(Dependencies memory dependencies, PoolKey memory canonicalPoolKey, int24 tickLower, int24 tickUpper)
        Ownable(dependencies.initialOwner)
    {
        if (
            address(dependencies.positionManager) == address(0) || dependencies.positionDepositor == address(0)
                || address(dependencies.gbx) == address(0) || address(dependencies.usdg) == address(0)
                || dependencies.resonanceRouter == address(0) || dependencies.initialOwner == address(0)
        ) revert ZeroAddress();

        _requireCode(address(dependencies.positionManager));
        _requireCode(address(dependencies.gbx));
        _requireCode(address(dependencies.usdg));
        _requireCode(dependencies.resonanceRouter);
        _requireCode(dependencies.initialOwner);

        address poolCurrency0 = Currency.unwrap(canonicalPoolKey.currency0);
        address poolCurrency1 = Currency.unwrap(canonicalPoolKey.currency1);
        address expectedCurrency0 = address(dependencies.gbx) < address(dependencies.usdg)
            ? address(dependencies.gbx)
            : address(dependencies.usdg);
        address expectedCurrency1 = address(dependencies.gbx) < address(dependencies.usdg)
            ? address(dependencies.usdg)
            : address(dependencies.gbx);
        if (poolCurrency0 != expectedCurrency0 || poolCurrency1 != expectedCurrency1) {
            revert InvalidPoolCurrencies(poolCurrency0, poolCurrency1);
        }
        if (address(canonicalPoolKey.hooks) != address(0)) revert NonzeroHook(address(canonicalPoolKey.hooks));
        if (tickLower >= tickUpper) revert InvalidTickRange(tickLower, tickUpper);

        positionManager = dependencies.positionManager;
        positionDepositor = dependencies.positionDepositor;
        expectedPositionTokenId = dependencies.expectedPositionTokenId;
        gbx = dependencies.gbx;
        usdg = dependencies.usdg;
        resonanceRouter = dependencies.resonanceRouter;
        currency0 = poolCurrency0;
        currency1 = poolCurrency1;
        poolFee = canonicalPoolKey.fee;
        tickSpacing = canonicalPoolKey.tickSpacing;
        poolKeyHash = keccak256(abi.encode(canonicalPoolKey));
        expectedTickLower = tickLower;
        expectedTickUpper = tickUpper;
    }

    /// @notice Returns the immutable canonical hookless pool identity.
    /// @return key Canonical GBX/USDG PoolKey.
    function poolKey() public view returns (PoolKey memory key) {
        return PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: poolFee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
    }

    /// @notice Returns whether this contract currently owns the exact recorded position.
    /// @return inCustody Whether this contract currently owns the position NFT.
    function positionInCustody() public view returns (bool inCustody) {
        if (!positionRecorded) return false;

        try IERC721(address(positionManager)).ownerOf(positionTokenId) returns (address positionOwner) {
            return positionOwner == address(this);
        } catch {
            return false;
        }
    }

    /// @notice Records and validates the first and only accepted PositionManager NFT.
    /// @param operator Account that initiated the safe transfer.
    /// @param from Previous position owner.
    /// @param tokenId PositionManager token ID.
    /// @param data Optional transfer data; ignored.
    /// @return selector ERC-721 receiver acceptance selector.
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4 selector)
    {
        operator;
        data;
        if (msg.sender != address(positionManager)) revert UnexpectedNFTSender(msg.sender);
        if (positionRecorded) revert PositionAlreadyRecorded(positionTokenId);
        if (from != positionDepositor) revert UnexpectedPositionDepositor(from);
        if (tokenId != expectedPositionTokenId) revert UnexpectedPositionTokenId(expectedPositionTokenId, tokenId);

        positionRecorded = true;
        positionTokenId = tokenId;

        address positionOwner = IERC721(address(positionManager)).ownerOf(tokenId);
        if (positionOwner != address(this)) revert PositionNotOwned(tokenId, positionOwner);

        (PoolKey memory receivedPoolKey, PositionInfo positionInfo) = positionManager.getPoolAndPositionInfo(tokenId);
        bytes32 receivedPoolKeyHash = keccak256(abi.encode(receivedPoolKey));
        if (receivedPoolKeyHash != poolKeyHash) revert InvalidPoolKey(poolKeyHash, receivedPoolKeyHash);

        int24 actualTickLower = positionInfo.tickLower();
        int24 actualTickUpper = positionInfo.tickUpper();
        if (actualTickLower != expectedTickLower || actualTickUpper != expectedTickUpper) {
            revert InvalidPositionTicks(expectedTickLower, expectedTickUpper, actualTickLower, actualTickUpper);
        }
        if (positionManager.getPositionLiquidity(tokenId) == 0) revert EmptyPosition(tokenId);

        emit PositionRecorded(tokenId, from, receivedPoolKeyHash);
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Collects fees without removing principal, burns all held GBX, and routes all held USDG to Resonance.
    /// @dev Processing complete balances also makes direct GBX or USDG transfers harmless. A failure in collection,
    ///      burning, transfer, or routing reverts the entire operation atomically.
    /// @return gbxBurned GBX permanently burned in this call.
    /// @return usdgRouted USDG delivered to ResonanceRouter in this call.
    function collectFees() external nonReentrant returns (uint256 gbxBurned, uint256 usdgRouted) {
        _requirePositionInCustody();

        bytes memory actions = new bytes(2);
        actions[0] = bytes1(uint8(Actions.DECREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(positionTokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        PoolKey memory key = poolKey();
        params[1] = abi.encode(key.currency0, key.currency1, address(this));
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        gbxBurned = gbx.balanceOf(address(this));
        if (gbxBurned != 0) gbx.burn(gbxBurned);

        usdgRouted = usdg.balanceOf(address(this));
        if (usdgRouted != 0) {
            uint256 positionBalanceBefore = usdgRouted;
            uint256 routerBalanceBefore = usdg.balanceOf(resonanceRouter);
            usdg.safeTransfer(resonanceRouter, usdgRouted);
            uint256 positionDebit = positionBalanceBefore - usdg.balanceOf(address(this));
            uint256 routerReceipt = usdg.balanceOf(resonanceRouter) - routerBalanceBefore;
            if (positionDebit != usdgRouted || routerReceipt != usdgRouted) {
                revert InexactUSDGTransfer(usdgRouted, positionDebit, routerReceipt);
            }
            IResonanceRouter(resonanceRouter).route();
        }

        emit FeesProcessed(positionTokenId, msg.sender, gbxBurned, usdgRouted);
    }

    /// @notice Permanently binds one replacement contract with identical immutable position configuration.
    /// @param newSuccessor Compatible LiquidityPosition that expects this contract to deliver the same NFT.
    function setSuccessor(address newSuccessor) external onlyOwner {
        if (successor != address(0)) revert SuccessorAlreadySet(successor);
        if (newSuccessor == address(0) || newSuccessor == address(this) || newSuccessor.code.length == 0) {
            revert IncompatibleSuccessor(newSuccessor);
        }

        ILiquidityPosition candidate = ILiquidityPosition(newSuccessor);
        if (
            candidate.positionManager() != address(positionManager) || candidate.positionDepositor() != address(this)
                || candidate.expectedPositionTokenId() != expectedPositionTokenId || candidate.gbx() != address(gbx)
                || candidate.usdg() != address(usdg) || candidate.resonanceRouter() != resonanceRouter
                || candidate.poolKeyHash() != poolKeyHash || candidate.expectedTickLower() != expectedTickLower
                || candidate.expectedTickUpper() != expectedTickUpper || candidate.positionRecorded()
        ) revert IncompatibleSuccessor(newSuccessor);

        successor = newSuccessor;
        emit SuccessorSet(newSuccessor);
    }

    /// @notice Moves the exact canonical position to the configured compatible successor.
    /// @dev Execution is permissionless after the timelocked owner has committed to the successor.
    function migratePosition() external nonReentrant {
        address migrationTarget = successor;
        if (migrationTarget == address(0)) revert SuccessorNotSet();
        _requirePositionInCustody();

        uint256 tokenId = positionTokenId;
        IERC721(address(positionManager)).safeTransferFrom(address(this), migrationTarget, tokenId);

        emit PositionMigrated(tokenId, msg.sender, migrationTarget);
    }

    /// @notice Reverts unless the canonical position is recorded and currently owned here.
    function _requirePositionInCustody() private view {
        if (!positionRecorded) revert NoPositionRecorded();
        if (!positionInCustody()) revert PositionNotInCustody(positionTokenId);
    }

    /// @notice Reverts unless an immutable dependency is a deployed contract.
    /// @param account Dependency address to validate.
    function _requireCode(address account) private view {
        if (account.code.length == 0) revert AddressHasNoCode(account);
    }
}
