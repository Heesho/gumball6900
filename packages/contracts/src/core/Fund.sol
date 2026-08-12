// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";
import { IMine } from "./interfaces/IMine.sol";

/// @title GumBall6900 Ownerless In-Kind Redemption Fund
/// @author Heesho
/// @notice Holds the protocol's raw token backing and lets GBX holders redeem a selected in-kind basket.
/// @dev Fund intentionally has no asset registry. Callers select the assets they want to redeem, which keeps a
///      malformed token from blocking every other asset in the treasury. Fund is ownerless and immutable: it has no
///      administrator, no upgrade path, no successor, and no way to move assets except redemption by GBX holders.
/// @custom:version 1.0.0
contract Fund is ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 private constant REDEMPTION_NAMESPACE = keccak256("gumball6900.fund.redemption");

    /// @notice GBX token burned by redemptions and permissionless maintenance.
    GBX public immutable gbx;

    /// @notice Emitted when GBX held by Fund is permanently burned.
    /// @param caller Account that triggered the burn.
    /// @param amount Amount of GBX burned.
    event GBXBurned(address indexed caller, uint256 amount);
    /// @notice Emitted after a holder completes a selective in-kind redemption.
    /// @param account Account whose GBX was burned.
    /// @param receiver Address that received the selected assets.
    /// @param gbxAmount Amount of GBX burned.
    /// @param tokenCount Number of selected assets processed.
    event Redeemed(address indexed account, address indexed receiver, uint256 gbxAmount, uint256 tokenCount);

    /// @notice A redemption selected the same token more than once.
    error DuplicateToken(address token);
    /// @notice A redemption selected no backing assets.
    error EmptyTokenList();
    /// @notice A redemption selected GBX or the zero address.
    error ForbiddenToken(address token);
    /// @notice A selected asset did not debit Fund and credit the receiver by the exact payout.
    error InexactTransfer(address token, uint256 expected, uint256 fundDebit, uint256 receiverCredit);
    /// @notice A redemption receiver is the zero address or Fund itself.
    error InvalidReceiver(address receiver);
    /// @notice GBX mining authority is not permanently bound to the expected deployed Mine shape.
    error InvalidMine(address mine);
    /// @notice A burn or redemption amount is zero.
    error ZeroAmount();

    /// @notice Creates the ownerless, registry-free treasury backing `gbx_`.
    /// @param gbx_ GBX token backed by this Fund.
    constructor(GBX gbx_) {
        if (address(gbx_) == address(0) || address(gbx_).code.length == 0) revert ForbiddenToken(address(gbx_));
        gbx = gbx_;
    }

    /// @notice Burns GBX already held by Fund, including GBX received from a Strategy payment.
    /// @param amount Amount of GBX to burn.
    function burnGBX(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        gbx.burn(amount);

        emit GBXBurned(msg.sender, amount);
    }

    /// @notice Burns GBX and returns the caller-selected pro-rata share of Fund assets.
    /// @param gbxAmount Amount of GBX to burn.
    /// @param receiver Address that receives the selected assets.
    /// @param tokens Unique, non-GBX token addresses to include in this redemption.
    /// @dev Every payout uses the same total supply captured before GBX is burned. Tokens omitted by the caller remain
    ///      in Fund for the remaining GBX supply, and a failure in any selected transfer reverts the entire operation.
    function redeem(uint256 gbxAmount, address receiver, address[] calldata tokens) external nonReentrant {
        if (gbxAmount == 0) revert ZeroAmount();
        if (receiver == address(0) || receiver == address(this)) revert InvalidReceiver(receiver);

        uint256 tokenCount = tokens.length;
        if (tokenCount == 0) revert EmptyTokenList();

        address mine = gbx.minter();
        if (!gbx.minterLocked() || mine.code.length == 0 || IMine(mine).gbx() != address(gbx)) {
            revert InvalidMine(mine);
        }

        // Crystallize every live slot's accrued GBX before taking the common redemption denominator. This makes a
        // handoff convert pending supply into minted supply without ever letting pending miner rewards disappear from
        // a redemption snapshot.
        IMine(mine).checkpointAll();
        uint256 supplyBeforeBurn = gbx.totalSupply();
        uint256[] memory payouts = new uint256[](tokenCount);

        // Snapshot all balances before moving or burning GBX so every selected asset uses one consistent denominator.
        for (uint256 i; i < tokenCount; ++i) {
            address token = tokens[i];
            _markToken(REDEMPTION_NAMESPACE, token);
            payouts[i] = Math.mulDiv(IERC20(token).balanceOf(address(this)), gbxAmount, supplyBeforeBurn);
        }

        IERC20(address(gbx)).safeTransferFrom(msg.sender, address(this), gbxAmount);
        gbx.burn(gbxAmount);

        for (uint256 i; i < tokenCount; ++i) {
            address token = tokens[i];
            uint256 payout = payouts[i];

            if (payout != 0) _transferExact(token, receiver, payout);

            _clearToken(REDEMPTION_NAMESPACE, token);
        }

        emit Redeemed(msg.sender, receiver, gbxAmount, tokenCount);
    }

    function _transferExact(address token, address receiver, uint256 amount) private {
        IERC20 asset = IERC20(token);
        uint256 fundBalanceBefore = asset.balanceOf(address(this));
        uint256 receiverBalanceBefore = asset.balanceOf(receiver);
        asset.safeTransfer(receiver, amount);
        uint256 fundDebit = fundBalanceBefore - asset.balanceOf(address(this));
        uint256 receiverCredit = asset.balanceOf(receiver) - receiverBalanceBefore;
        if (fundDebit != amount || receiverCredit != amount) {
            revert InexactTransfer(token, amount, fundDebit, receiverCredit);
        }
    }

    /// @notice Returns GBX currently held by Fund and available to burn.
    /// @return amount GBX balance currently held by Fund.
    function pendingGBX() external view returns (uint256 amount) {
        return gbx.balanceOf(address(this));
    }

    /// @notice Marks one token for duplicate detection during the current transaction.
    /// @dev This provides O(n) duplicate detection without an asset
    ///      registry, sorting requirement, permanent mapping writes, or monotonically increasing nonce.
    /// @param namespace Operation-specific namespace that prevents cross-operation collisions.
    /// @param token Token address to mark for the current transaction.
    function _markToken(bytes32 namespace, address token) private {
        if (token == address(0) || token == address(gbx)) revert ForbiddenToken(token);

        bytes32 slot = keccak256(abi.encode(namespace, token));
        if (_transientLoad(slot) != 0) revert DuplicateToken(token);
        _transientStore(slot, 1);
    }

    /// @notice Clears one token's transient duplicate mark after a successful operation.
    /// @dev Clearing allows another call involving the token later in the same transaction.
    /// @param namespace Operation-specific namespace used when the token was marked.
    /// @param token Token address whose mark is cleared.
    function _clearToken(bytes32 namespace, address token) private {
        _transientStore(keccak256(abi.encode(namespace, token)), 0);
    }

    /// @notice Writes one EIP-1153 transient storage slot.
    /// @dev Values live only for the current transaction.
    /// @param slot Transient slot to write.
    /// @param value Value to store until it is cleared or the transaction ends.
    function _transientStore(bytes32 slot, uint256 value) private {
        assembly ("memory-safe") {
            tstore(slot, value)
        }
    }

    /// @notice Reads one EIP-1153 transient storage slot.
    /// @dev Values written during another transaction are never visible.
    /// @param slot Transient slot to read.
    /// @return value Value currently stored in `slot` for this transaction.
    function _transientLoad(bytes32 slot) private view returns (uint256 value) {
        assembly ("memory-safe") {
            value := tload(slot)
        }
    }
}
