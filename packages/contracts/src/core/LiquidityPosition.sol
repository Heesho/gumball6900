// SPDX-License-Identifier: MIT
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
import { PositionInfo } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

import { GBX } from "./GBX.sol";
import { IFund } from "./interfaces/IFund.sol";
import { IResonanceRouter } from "./interfaces/IResonanceRouter.sol";

/// @title Liquidity Revenue Router Identity
/// @author Heesho
/// @notice Read-only token identity exposed by the immutable revenue router.
interface ILiquidityRevenueRouter is IResonanceRouter {
    /// @notice Canonical USDG token accepted by the router.
    /// @return token Canonical USDG token.
    function usdg() external view returns (IERC20 token);
}

/// @title GumBall6900 Immutable Genesis Liquidity Position
/// @author Heesho
/// @notice Holds the canonical GBX/USDG Uniswap v4 position and lets anyone harvest its fees into the protocol.
/// @dev The genesis position starts outside the active price as a GBX-only position. Harvesting collects fees with a
///      zero-liquidity decrease, routes USDG through ResonanceRouter, and sends GBX to Fund for an atomic burn. The
///      position's principal liquidity never changes, and the contract performs no swap, pricing, or caller funding.
///
///      The contract is ownerless and immutable: once the precommitted NFT is received it can never leave, by any
///      caller or any mechanism, and principal is never withdrawn.
/// @custom:version 1.0.0
contract LiquidityPosition is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Immutable contracts and precommitted NFT identity fixed during deployment.
    /// @param positionManager Canonical Uniswap v4 PositionManager.
    /// @param positionDepositor One-time account authorized to deliver the genesis NFT.
    /// @param expectedPositionTokenId Precommitted PositionManager token ID.
    /// @param gbx Canonical GBX token.
    /// @param usdg Canonical USDG token.
    /// @param resonanceRouter Immutable USDG route into Resonance.
    /// @param fund Ownerless Fund that receives and burns harvested GBX.
    struct Dependencies {
        IPositionManager positionManager;
        address positionDepositor;
        uint256 expectedPositionTokenId;
        GBX gbx;
        IERC20 usdg;
        ILiquidityRevenueRouter resonanceRouter;
        IFund fund;
    }

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
    /// @notice Immutable permissionless USDG route into Resonance.
    ILiquidityRevenueRouter public immutable resonanceRouter;
    /// @notice Ownerless Fund that receives and burns harvested GBX.
    IFund public immutable fund;

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

    /// @notice Emitted after a caller collects all fees without changing principal and routes them into the protocol.
    /// @param positionTokenId Canonical position NFT.
    /// @param caller Account that triggered the permissionless harvest.
    /// @param principalLiquidity Unchanged canonical position liquidity.
    /// @param usdgRouted Complete USDG amount sent through ResonanceRouter.
    /// @param gbxBurned Complete GBX amount sent to Fund and burned.
    event FeesHarvested(
        uint256 indexed positionTokenId,
        address indexed caller,
        uint128 principalLiquidity,
        uint256 usdgRouted,
        uint256 gbxBurned
    );
    /// @notice Emitted after the expected position is received and validated.
    /// @param positionTokenId Canonical position NFT.
    /// @param previousOwner Account that delivered the NFT.
    /// @param poolKeyHash Hash of the validated PoolKey.
    event PositionRecorded(uint256 indexed positionTokenId, address indexed previousOwner, bytes32 indexed poolKeyHash);

    /// @notice A required immutable dependency is not deployed code.
    error AddressHasNoCode(address account);
    /// @notice The delivered position has zero liquidity.
    error EmptyPosition(uint256 positionTokenId);
    /// @notice An immutable route is bound to a token other than the canonical pool token.
    error InvalidDestinationToken(address destination, address expected, address actual);
    /// @notice A protocol-bound transfer did not debit this contract and credit its destination exactly.
    error InexactTransfer(address token, address destination, uint256 expected, uint256 debit, uint256 credit);
    /// @notice The supplied PoolKey does not contain exactly GBX and USDG in address order.
    error InvalidPoolCurrencies(address currency0, address currency1);
    /// @notice The received NFT belongs to a different PoolKey.
    error InvalidPoolKey(bytes32 expected, bytes32 actual);
    /// @notice The received NFT uses a different tick range.
    error InvalidPositionTicks(int24 expectedLower, int24 expectedUpper, int24 actualLower, int24 actualUpper);
    /// @notice The configured lower tick is not below the upper tick.
    error InvalidTickRange(int24 tickLower, int24 tickUpper);
    /// @notice Fee harvesting was requested before the expected NFT was recorded.
    error NoPositionRecorded();
    /// @notice The configured canonical PoolKey uses a hook.
    error NonzeroHook(address hook);
    /// @notice The one-time expected position has already been recorded.
    error PositionAlreadyRecorded(uint256 positionTokenId);
    /// @notice The recorded NFT is no longer owned by this contract.
    error PositionNotInCustody(uint256 positionTokenId);
    /// @notice The NFT receiver callback observed an unexpected post-transfer owner.
    error PositionNotOwned(uint256 positionTokenId, address owner);
    /// @notice Fee collection unexpectedly changed the permanently locked principal liquidity.
    error PrincipalLiquidityChanged(uint128 expected, uint128 actual);
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
                || address(dependencies.resonanceRouter) == address(0) || address(dependencies.fund) == address(0)
        ) revert ZeroAddress();

        _requireCode(address(dependencies.positionManager));
        _requireCode(address(dependencies.gbx));
        _requireCode(address(dependencies.usdg));
        _requireCode(address(dependencies.resonanceRouter));
        _requireCode(address(dependencies.fund));

        address routerToken = address(dependencies.resonanceRouter.usdg());
        if (routerToken != address(dependencies.usdg)) {
            revert InvalidDestinationToken(
                address(dependencies.resonanceRouter), address(dependencies.usdg), routerToken
            );
        }
        address fundToken = dependencies.fund.gbx();
        if (fundToken != address(dependencies.gbx)) {
            revert InvalidDestinationToken(address(dependencies.fund), address(dependencies.gbx), fundToken);
        }

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
        fund = dependencies.fund;
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

    /// @notice Collects every accrued LP fee while preserving principal, routes USDG, and burns GBX.
    /// @dev `DECREASE_LIQUIDITY` with zero liquidity is Uniswap v4 PositionManager's fee-collection path. The two
    ///      `CLOSE_CURRENCY` actions take the complete fee credits into this contract without removing principal.
    ///      Any direct canonical-token donation is intentionally processed with the same destination on the next
    ///      harvest. Routing and burn are atomic with collection: any failure restores the position's fee accounting.
    /// @return usdgRouted Complete USDG balance routed through ResonanceRouter.
    /// @return gbxBurned Complete GBX balance sent to Fund and burned.
    function harvestFees() external nonReentrant returns (uint256 usdgRouted, uint256 gbxBurned) {
        _requirePositionInCustody();

        uint128 principalLiquidity = positionManager.getPositionLiquidity(positionTokenId);
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.DECREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(positionTokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(Currency.wrap(currency0));
        params[2] = abi.encode(Currency.wrap(currency1));
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        uint128 liquidityAfter = positionManager.getPositionLiquidity(positionTokenId);
        if (liquidityAfter != principalLiquidity) {
            revert PrincipalLiquidityChanged(principalLiquidity, liquidityAfter);
        }

        usdgRouted = usdg.balanceOf(address(this));
        if (usdgRouted != 0) {
            _transferExact(usdg, address(resonanceRouter), usdgRouted);
            resonanceRouter.route();
        }

        gbxBurned = gbx.balanceOf(address(this));
        if (gbxBurned != 0) {
            _transferExact(gbx, address(fund), gbxBurned);
            fund.burnGBX(gbxBurned);
        }

        emit FeesHarvested(positionTokenId, msg.sender, principalLiquidity, usdgRouted, gbxBurned);
    }

    /// @notice Reverts unless the canonical position is recorded and currently owned here.
    function _requirePositionInCustody() private view {
        if (!positionRecorded) revert NoPositionRecorded();
        if (!positionInCustody()) revert PositionNotInCustody(positionTokenId);
    }

    /// @notice Transfers a canonical token only when sender debit and destination credit are exact.
    /// @param token Canonical pool token to transfer.
    /// @param destination Immutable protocol destination.
    /// @param amount Complete amount to route.
    function _transferExact(IERC20 token, address destination, uint256 amount) private {
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 destinationBefore = token.balanceOf(destination);
        token.safeTransfer(destination, amount);
        uint256 debit = senderBefore - token.balanceOf(address(this));
        uint256 credit = token.balanceOf(destination) - destinationBefore;
        if (debit != amount || credit != amount) {
            revert InexactTransfer(address(token), destination, amount, debit, credit);
        }
    }

    /// @notice Reverts unless an immutable dependency is a deployed contract.
    /// @param account Dependency address to validate.
    function _requireCode(address account) private view {
        if (account.code.length == 0) revert AddressHasNoCode(account);
    }
}
