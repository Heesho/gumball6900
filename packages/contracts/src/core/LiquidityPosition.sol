// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { PositionInfo } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import { IAllowanceTransfer } from "permit2/src/interfaces/IAllowanceTransfer.sol";

import { GBX } from "./GBX.sol";

/// @title GumBall6900 Immutable Genesis Liquidity Position
/// @author Heesho
/// @notice Holds the canonical GBX/USDG Uniswap v4 position and lets anyone compound its fees back into it.
/// @dev The genesis position starts outside the active price as a GBX-only position. There is one rule: a caller may
///      take everything the position has accrued, provided the same call grows the position by `COMPOUND_BPS`.
///      Uniswap v4 nets accrued fees against an increase, so a caller only funds the shortfall, and the position
///      compounds without the protocol holding, pricing, or swapping anything. Once fees are worth more than the
///      growth requirement a searcher is paid to compound, and until then nobody can move the fees at all.
///
///      The contract is ownerless and immutable: once the precommitted NFT is received it can never leave, by any
///      caller or any mechanism, and principal is never withdrawn. Adapted in shape from Uniswap's TokenJar, where a
///      fixed threshold releases an accumulated basket.
/// @custom:version 1.0.0
contract LiquidityPosition is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Immutable contracts and precommitted NFT identity fixed during deployment.
    /// @param positionManager Canonical Uniswap v4 PositionManager.
    /// @param positionDepositor One-time account authorized to deliver the genesis NFT.
    /// @param expectedPositionTokenId Precommitted PositionManager token ID.
    /// @param gbx Canonical GBX token.
    /// @param usdg Canonical USDG token.
    /// @param permit2 Canonical Permit2 allowance manager.
    struct Dependencies {
        IPositionManager positionManager;
        address positionDepositor;
        uint256 expectedPositionTokenId;
        GBX gbx;
        IERC20 usdg;
        IAllowanceTransfer permit2;
    }

    /// @notice Basis-point denominator for the compounding requirement.
    uint256 public constant BPS_SCALE = 10_000;
    /// @notice Liquidity growth, in basis points, a caller must add to claim the position's accrued fees.
    uint256 public constant COMPOUND_BPS = 20;

    /// @notice Canonical Uniswap v4 PositionManager.
    IPositionManager public immutable positionManager;
    /// @notice One-time account expected to deliver the genesis position.
    address public immutable positionDepositor;
    /// @notice Precommitted token ID of the genesis position.
    uint256 public immutable expectedPositionTokenId;
    /// @notice GBX side of the canonical pool.
    GBX public immutable gbx;
    /// @notice USDG side of the canonical pool.
    IERC20 public immutable usdg;
    /// @notice Canonical Permit2, used to settle the compounding increase.
    IAllowanceTransfer public immutable permit2;

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

    /// @notice Emitted after a caller grows the position and receives every balance returned by PositionManager.
    /// @param positionTokenId Canonical position NFT.
    /// @param caller Account that funded the growth and received the accrued balances.
    /// @param liquidityBefore Position liquidity before the increase.
    /// @param liquidityAdded Liquidity permanently added to the position.
    /// @param liquidityAfter Position liquidity after the increase.
    /// @param funding0 Maximum `currency0` supplied by the caller.
    /// @param funding1 Maximum `currency1` supplied by the caller.
    /// @param transferred0 Complete `currency0` balance paid to the caller after the operation.
    /// @param transferred1 Complete `currency1` balance paid to the caller after the operation.
    event Compounded(
        uint256 indexed positionTokenId,
        address indexed caller,
        uint128 liquidityBefore,
        uint128 liquidityAdded,
        uint128 liquidityAfter,
        uint256 funding0,
        uint256 funding1,
        uint256 transferred0,
        uint256 transferred1
    );
    /// @notice Emitted after the expected position is received and validated.
    /// @param positionTokenId Canonical position NFT.
    /// @param previousOwner Account that delivered the NFT.
    /// @param poolKeyHash Hash of the validated PoolKey.
    event PositionRecorded(uint256 indexed positionTokenId, address indexed previousOwner, bytes32 indexed poolKeyHash);

    /// @notice A required immutable dependency is not deployed code.
    error AddressHasNoCode(address account);
    /// @notice The caller-supplied compound deadline has passed.
    error CompoundDeadlinePassed(uint256 deadline);
    /// @notice The delivered position has zero liquidity.
    error EmptyPosition(uint256 positionTokenId);
    /// @notice PositionManager added less liquidity than the fixed requirement.
    error InsufficientCompound(uint128 expected, uint128 actual);
    /// @notice Caller funding did not produce exact sender debit and position credit.
    error InexactFunding(address token, uint256 expected, uint256 payerDebit, uint256 positionCredit);
    /// @notice A caller payout did not produce exact position debit and caller credit.
    error InexactPayout(address token, uint256 expected, uint256 positionDebit, uint256 callerCredit);
    /// @notice The supplied PoolKey does not contain exactly GBX and USDG in address order.
    error InvalidPoolCurrencies(address currency0, address currency1);
    /// @notice The received NFT belongs to a different PoolKey.
    error InvalidPoolKey(bytes32 expected, bytes32 actual);
    /// @notice The received NFT uses a different tick range.
    error InvalidPositionTicks(int24 expectedLower, int24 expectedUpper, int24 actualLower, int24 actualUpper);
    /// @notice The configured lower tick is not below the upper tick.
    error InvalidTickRange(int24 tickLower, int24 tickUpper);
    /// @notice Compounding was requested before the expected NFT was recorded.
    error NoPositionRecorded();
    /// @notice The configured canonical PoolKey uses a hook.
    error NonzeroHook(address hook);
    /// @notice The one-time expected position has already been recorded.
    error PositionAlreadyRecorded(uint256 positionTokenId);
    /// @notice The recorded NFT is no longer owned by this contract.
    error PositionNotInCustody(uint256 positionTokenId);
    /// @notice The NFT receiver callback observed an unexpected post-transfer owner.
    error PositionNotOwned(uint256 positionTokenId, address owner);
    /// @notice Rounding the fixed growth fraction produced zero liquidity.
    error PositionTooSmallToCompound(uint128 liquidity);
    /// @notice An ERC-721 contract other than the canonical PositionManager called the receiver hook.
    error UnexpectedNFTSender(address sender);
    /// @notice An account other than the precommitted depositor delivered the NFT.
    error UnexpectedPositionDepositor(address depositor);
    /// @notice The delivered NFT ID differs from the precommitted ID.
    error UnexpectedPositionTokenId(uint256 expected, uint256 actual);
    /// @notice A required deployment address is zero.
    error ZeroAddress();

    /// @notice Fixes the exact v4 pool, range, and NFT permanently.
    /// @param dependencies Immutable protocol and PositionManager dependencies.
    /// @param canonicalPoolKey Exact hookless GBX/USDG pool identity.
    /// @param tickLower Expected lower tick of the precommitted single-sided position.
    /// @param tickUpper Expected upper tick of the precommitted single-sided position.
    constructor(Dependencies memory dependencies, PoolKey memory canonicalPoolKey, int24 tickLower, int24 tickUpper) {
        if (
            address(dependencies.positionManager) == address(0) || dependencies.positionDepositor == address(0)
                || address(dependencies.gbx) == address(0) || address(dependencies.usdg) == address(0)
                || address(dependencies.permit2) == address(0)
        ) revert ZeroAddress();

        _requireCode(address(dependencies.positionManager));
        _requireCode(address(dependencies.gbx));
        _requireCode(address(dependencies.usdg));
        _requireCode(address(dependencies.permit2));

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
        permit2 = dependencies.permit2;
        currency0 = poolCurrency0;
        currency1 = poolCurrency1;
        poolFee = canonicalPoolKey.fee;
        tickSpacing = canonicalPoolKey.tickSpacing;
        poolKeyHash = keccak256(abi.encode(canonicalPoolKey));
        expectedTickLower = tickLower;
        expectedTickUpper = tickUpper;

        // Standing approvals so compounding can settle. They grant the canonical PositionManager the ability to pull
        // only what this contract itself holds, and this contract only ever holds a caller's own compounding funds
        // for the duration of one call.
        IERC20(poolCurrency0).forceApprove(address(dependencies.permit2), type(uint256).max);
        IERC20(poolCurrency1).forceApprove(address(dependencies.permit2), type(uint256).max);
        dependencies.permit2
            .approve(poolCurrency0, address(dependencies.positionManager), type(uint160).max, type(uint48).max);
        dependencies.permit2
            .approve(poolCurrency1, address(dependencies.positionManager), type(uint160).max, type(uint48).max);
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
    /// @param operator Account that initiated the safe transfer; not used for authorization.
    /// @param from Previous position owner.
    /// @param tokenId PositionManager token ID.
    /// @param data Optional transfer data; ignored.
    /// @return selector ERC-721 receiver acceptance selector.
    /// @dev The ERC-721 operator and data parameters are intentionally ignored; only the fixed manager, depositor,
    ///      token ID, pool key, hookless configuration, ticks, fee, and custody state authorize acceptance.
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

    /// @notice Returns the liquidity a caller must add right now to claim everything the position has accrued.
    /// @return liquidityRequired Liquidity that `compound` will add to the position.
    function compoundRequirement() public view returns (uint128 liquidityRequired) {
        if (!positionRecorded) return 0;
        uint128 current = positionManager.getPositionLiquidity(positionTokenId);
        return uint128(Math.mulDiv(current, COMPOUND_BPS, BPS_SCALE));
    }

    /// @notice Grows the position by `COMPOUND_BPS` and pays the caller everything the position had accrued.
    /// @dev Permissionless and unpriced. Uniswap v4 nets the position's accrued fees against the increase, so the
    ///      caller funds only the shortfall and keeps the surplus. Once accrued fees exceed the growth requirement
    ///      the surplus is positive and a searcher is paid to compound; before that the call is a donation nobody is
    ///      obliged to make. Principal is never withdrawn, and the position can only ever get larger.
    ///
    ///      Unspent funding is returned in the same call, so `amount0Max` and `amount1Max` are pure slippage bounds:
    ///      set them to what the increase may cost at an acceptable price, not to what it is expected to cost.
    ///      Any token sitting in this contract, including unsolicited transfers, is swept to the caller as part of
    ///      the claim, which is why nothing can become stuck here.
    /// @param amount0Max Maximum `currency0` the caller will fund for the increase.
    /// @param amount1Max Maximum `currency1` the caller will fund for the increase.
    /// @param deadline Latest timestamp at which this call may execute.
    /// @return liquidityAdded Liquidity permanently added to the position.
    /// @return claimed0 Amount of `currency0` paid to the caller.
    /// @return claimed1 Amount of `currency1` paid to the caller.
    function compound(uint128 amount0Max, uint128 amount1Max, uint256 deadline)
        external
        nonReentrant
        returns (uint128 liquidityAdded, uint256 claimed0, uint256 claimed1)
    {
        if (block.timestamp > deadline) revert CompoundDeadlinePassed(deadline);
        _requirePositionInCustody();

        uint128 liquidityBefore = positionManager.getPositionLiquidity(positionTokenId);
        liquidityAdded = uint128(Math.mulDiv(liquidityBefore, COMPOUND_BPS, BPS_SCALE));
        if (liquidityAdded == 0) revert PositionTooSmallToCompound(liquidityBefore);

        // Take the caller's funding up front. Whatever the increase does not consume goes back to them below.
        if (amount0Max != 0) _pullExact(currency0, amount0Max);
        if (amount1Max != 0) _pullExact(currency1, amount1Max);

        // CLOSE_CURRENCY settles or takes each side according to the net delta, so one batch both funds the
        // increase and collects the accrued fees.
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.INCREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(positionTokenId, uint256(liquidityAdded), amount0Max, amount1Max, bytes(""));
        params[1] = abi.encode(Currency.wrap(currency0));
        params[2] = abi.encode(Currency.wrap(currency1));
        positionManager.modifyLiquidities(abi.encode(actions, params), deadline);

        uint128 liquidityAfter = positionManager.getPositionLiquidity(positionTokenId);
        if (liquidityAfter < liquidityBefore + liquidityAdded) {
            revert InsufficientCompound(liquidityBefore + liquidityAdded, liquidityAfter);
        }

        claimed0 = IERC20(currency0).balanceOf(address(this));
        claimed1 = IERC20(currency1).balanceOf(address(this));
        if (claimed0 != 0) _payExact(currency0, claimed0);
        if (claimed1 != 0) _payExact(currency1, claimed1);

        emit Compounded(
            positionTokenId,
            msg.sender,
            liquidityBefore,
            liquidityAdded,
            liquidityAfter,
            amount0Max,
            amount1Max,
            claimed0,
            claimed1
        );
    }

    /// @notice Reverts unless the canonical position is recorded and currently owned here.
    function _requirePositionInCustody() private view {
        if (!positionRecorded) revert NoPositionRecorded();
        if (!positionInCustody()) revert PositionNotInCustody(positionTokenId);
    }

    /// @notice Pulls an exact amount of one canonical pool token from the caller.
    /// @param token Canonical pool token to pull.
    /// @param amount Exact caller-supplied maximum.
    function _pullExact(address token, uint256 amount) private {
        uint256 payerBalanceBefore = IERC20(token).balanceOf(msg.sender);
        uint256 positionBalanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 payerDebit = payerBalanceBefore - IERC20(token).balanceOf(msg.sender);
        uint256 positionCredit = IERC20(token).balanceOf(address(this)) - positionBalanceBefore;
        if (payerDebit != amount || positionCredit != amount) {
            revert InexactFunding(token, amount, payerDebit, positionCredit);
        }
    }

    /// @notice Pays an exact amount of one canonical pool token to the caller.
    /// @param token Canonical pool token to pay.
    /// @param amount Complete post-operation contract balance.
    function _payExact(address token, uint256 amount) private {
        uint256 positionBalanceBefore = IERC20(token).balanceOf(address(this));
        uint256 callerBalanceBefore = IERC20(token).balanceOf(msg.sender);
        IERC20(token).safeTransfer(msg.sender, amount);
        uint256 positionDebit = positionBalanceBefore - IERC20(token).balanceOf(address(this));
        uint256 callerCredit = IERC20(token).balanceOf(msg.sender) - callerBalanceBefore;
        if (positionDebit != amount || callerCredit != amount) {
            revert InexactPayout(token, amount, positionDebit, callerCredit);
        }
    }

    /// @notice Reverts unless an immutable dependency is a deployed contract.
    /// @param account Dependency address to validate.
    function _requireCode(address account) private view {
        if (account.code.length == 0) revert AddressHasNoCode(account);
    }
}
