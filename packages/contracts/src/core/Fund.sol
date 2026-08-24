// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";
import { IMine } from "./interfaces/IMine.sol";

/// @title GumBall6900 Ownerless In-Kind Redemption Fund
/// @author heesho
/// @notice Holds the protocol's raw token backing and lets GBX holders redeem a selected in-kind basket.
/// @dev Fund intentionally has no asset registry. Callers select the assets they want to redeem, which keeps a
///      malformed token from blocking every other asset in the treasury. Fund is ownerless and immutable: it has no
///      administrator, upgrade path, or successor. Non-GBX backing moves only through holder redemption; Fund-held GBX
///      may instead be destroyed through the permissionless `burnGBX` path. Each selected payout rounds down in that
///      token's raw units and is checked for exact sender and receiver deltas.
contract Fund is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Domain separator for transaction-scoped EIP-1153 duplicate-token marks.
    bytes32 private constant REDEMPTION_NAMESPACE = keccak256("gumball6900.fund.redemption");

    /// @notice Canonical GBX token burned by redemptions and permissionless maintenance.
    GBX public immutable gbx;

    /// @notice Emitted when GBX held by Fund is permanently burned.
    /// @param caller Account that triggered the burn.
    /// @param amount Raw GBX amount burned from Fund's balance.
    event GBXBurned(address indexed caller, uint256 amount);
    /// @notice Emitted after a holder completes a selective in-kind redemption.
    /// @param account Account whose GBX was burned.
    /// @param receiver Address that received the selected assets.
    /// @param gbxAmount Raw GBX amount burned from `account`.
    /// @param tokenCount Number of unique selected asset addresses processed.
    event Redeemed(address indexed account, address indexed receiver, uint256 gbxAmount, uint256 tokenCount);

    /// @notice A redemption selected the same token more than once.
    /// @param token Repeated token address.
    error DuplicateToken(address token);
    /// @notice A redemption selected no backing assets.
    error EmptyTokenList();
    /// @notice A redemption selected GBX or zero, or construction received a zero or code-less GBX dependency.
    /// @param token Forbidden selection or invalid constructor dependency.
    error ForbiddenToken(address token);
    /// @notice A selected asset did not debit Fund and credit the receiver by the exact payout.
    /// @param token Selected token whose transfer produced inexact balance deltas.
    /// @param expected Expected payout in the selected token's raw units.
    /// @param fundDebit Actual decrease in Fund's raw token balance.
    /// @param receiverCredit Actual increase in the receiver's raw token balance.
    error InexactTransfer(address token, uint256 expected, uint256 fundDebit, uint256 receiverCredit);
    /// @notice A selected token's balance fell below the minimum required at the current processing stage.
    /// @param token Selected token whose Fund balance fell too far.
    /// @param expectedMinimum Minimum permitted raw token balance at this stage of redemption.
    /// @param currentBalance Observed raw token balance held by Fund.
    error SelectedBalanceDecreased(address token, uint256 expectedMinimum, uint256 currentBalance);
    /// @notice A redemption receiver is the zero address or Fund itself.
    /// @param receiver Invalid requested receiver.
    error InvalidReceiver(address receiver);
    /// @notice GBX mining authority is not permanently bound to the expected deployed Mine shape.
    /// @param mine Address reported by GBX as its current minter.
    error InvalidMine(address mine);
    /// @notice A burn or redemption amount is zero.
    error ZeroAmount();

    /// @notice Creates the ownerless, registry-free treasury backing `gbx_`.
    /// @dev Reverts unless `gbx_` is a nonzero address containing deployed code. Reciprocal Mine validation is deferred
    ///      until redemption because GBX is expected to be constructed before its one-time Mine handoff.
    /// @param gbx_ Canonical GBX token backed by this Fund.
    constructor(GBX gbx_) {
        if (address(gbx_) == address(0) || address(gbx_).code.length == 0) revert ForbiddenToken(address(gbx_));
        gbx = gbx_;
    }

    /// @notice Burns GBX already held by Fund, including GBX received from a Strategy payment.
    /// @dev Permissionless and non-reentrant. Burns from Fund's own balance, never from the caller, and reverts if Fund
    ///      holds less than `amount`. No backing asset is transferred by this maintenance operation. GBX emits its burn
    ///      events, followed by Fund's `GBXBurned`.
    /// @param amount Nonzero raw GBX amount to burn from Fund's balance.
    function burnGBX(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        gbx.burn(amount);

        emit GBXBurned(msg.sender, amount);
    }

    /// @notice Burns GBX and returns the caller-selected pro-rata share of Fund assets.
    /// @dev Non-reentrant and atomic. The caller must hold and approve `gbxAmount`. Every payout is
    ///      `floor(balanceBefore * gbxAmount / effectiveSupplyBeforeBurn)` in the selected token's raw units, using one
    ///      denominator that includes all accrued unminted Mine emission. Balances are snapshotted before the GBX burn.
    ///      Each nonzero asset transfer must debit Fund and credit `receiver` by the exact payout, and no selected
    ///      transfer may consume another selected address's backing. Tokens omitted by the caller remain in Fund and
    ///      that redeemer permanently forfeits their share. The token array has no length cap beyond transaction gas.
    ///      Any validation, burn, or transfer failure reverts all work. Emits `Redeemed` after every selected token has
    ///      passed its final balance check.
    /// @param gbxAmount Nonzero raw GBX amount transferred from and burned for the caller.
    /// @param receiver Nonzero, non-Fund address receiving every selected asset payout; may differ from the caller.
    /// @param tokens Nonempty array of unique, nonzero, non-GBX token addresses selected by the caller.
    function redeem(uint256 gbxAmount, address receiver, address[] calldata tokens) external nonReentrant {
        if (gbxAmount == 0) revert ZeroAmount();
        if (receiver == address(0) || receiver == address(this)) revert InvalidReceiver(receiver);

        uint256 tokenCount = tokens.length;
        if (tokenCount == 0) revert EmptyTokenList();

        address mine = gbx.minter();
        if (!gbx.minterLocked() || mine.code.length == 0 || IMine(mine).gbx() != address(gbx)) {
            revert InvalidMine(mine);
        }

        // Pending mining emission is economically issued even though it is minted only when its individual slot is
        // replaced. Include Mine's constant-time pending accumulator without mutating or iterating through Mine.
        uint256 supplyBeforeBurn = IMine(mine).effectiveTotalSupply();
        uint256[] memory balancesBefore = new uint256[](tokenCount);
        uint256[] memory payouts = new uint256[](tokenCount);

        // Snapshot all balances before moving or burning GBX so every selected asset uses one consistent denominator.
        for (uint256 i; i < tokenCount; ++i) {
            address token = tokens[i];
            _markToken(token);
            uint256 balance = IERC20(token).balanceOf(address(this));
            balancesBefore[i] = balance;
            payouts[i] = Math.mulDiv(balance, gbxAmount, supplyBeforeBurn);
        }

        IERC20(address(gbx)).safeTransferFrom(msg.sender, address(this), gbxAmount);
        gbx.burn(gbxAmount);

        for (uint256 i; i < tokenCount; ++i) {
            address token = tokens[i];
            uint256 payout = payouts[i];
            uint256 currentBalance = IERC20(token).balanceOf(address(this));
            if (currentBalance < balancesBefore[i]) {
                revert SelectedBalanceDecreased(token, balancesBefore[i], currentBalance);
            }

            if (payout != 0) _transferExact(token, receiver, payout);

            _clearToken(token);
        }

        // A selected transfer must not consume another selected address's backing. This final pass also catches
        // asymmetric alias facades where only the later transfer mutates an earlier address's reported balance.
        for (uint256 i; i < tokenCount; ++i) {
            address token = tokens[i];
            uint256 expectedMinimum = balancesBefore[i] - payouts[i];
            uint256 currentBalance = IERC20(token).balanceOf(address(this));
            if (currentBalance < expectedMinimum) {
                revert SelectedBalanceDecreased(token, expectedMinimum, currentBalance);
            }
        }

        emit Redeemed(msg.sender, receiver, gbxAmount, tokenCount);
    }

    /// @dev Transfers one selected payout and rejects fee-on-transfer, rebasing, aliasing, or other behavior that does
    ///      not reduce Fund's balance and increase the receiver's balance by exactly `amount` raw units.
    /// @param token Selected ERC-20 asset to transfer.
    /// @param receiver Account receiving the payout.
    /// @param amount Nonzero payout in the selected token's raw units.
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

    /// @notice Marks one token for duplicate detection during the current transaction.
    /// @dev Rejects the zero address, GBX, and any token already marked by this Fund in the transaction. This provides
    ///      O(n) duplicate detection without an asset registry, sorting requirement, permanent writes, or a nonce.
    /// @param token Token address to mark for the current transaction.
    function _markToken(address token) private {
        if (token == address(0) || token == address(gbx)) revert ForbiddenToken(token);

        bytes32 slot = keccak256(abi.encode(REDEMPTION_NAMESPACE, token));
        if (_transientLoad(slot) != 0) revert DuplicateToken(token);
        _transientStore(slot, 1);
    }

    /// @notice Clears one token's transient duplicate mark after its successful payout processing.
    /// @dev Clearing allows another call involving the token later in the same transaction.
    /// @param token Token address whose mark is cleared.
    function _clearToken(address token) private {
        _transientStore(keccak256(abi.encode(REDEMPTION_NAMESPACE, token)), 0);
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
