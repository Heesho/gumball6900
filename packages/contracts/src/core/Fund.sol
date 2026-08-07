// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";
import { IFund } from "./interfaces/IFund.sol";

/// @title Fund
/// @author GUM BALL 6900
/// @notice Holds the protocol's raw token backing and lets GBX holders redeem a selected in-kind basket.
/// @dev Fund intentionally has no asset registry. Callers select the assets they want to redeem or migrate, which
///      keeps a malformed token from blocking every other asset in the treasury.
contract Fund is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    bytes32 private constant REDEMPTION_NAMESPACE = keccak256("gumball6900.fund.redemption");
    bytes32 private constant MIGRATION_NAMESPACE = keccak256("gumball6900.fund.migration");

    /// @notice GBX token burned by redemptions and buybacks.
    GBX public immutable gbx;

    /// @notice One-way migration destination. The zero address means migration is not enabled.
    address public successor;

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
    /// @notice Emitted when the one-way migration destination is set.
    /// @param successor New Fund-compatible destination.
    event SuccessorSet(address indexed successor);
    /// @notice Emitted after one complete token balance is migrated.
    /// @param caller Account that triggered migration.
    /// @param token Token migrated.
    /// @param successor Fund that received the token balance.
    /// @param amount Amount migrated.
    event TokenMigrated(address indexed caller, address indexed token, address indexed successor, uint256 amount);

    error DuplicateToken(address token);
    error EmptyTokenList();
    error ForbiddenToken(address token);
    error InexactTransfer(address token, uint256 expected, uint256 received);
    error InvalidReceiver(address receiver);
    error InvalidSuccessor(address successor);
    error SuccessorAlreadySet(address successor);
    error SuccessorNotSet();
    error ZeroAmount();

    /// @notice Creates a registry-free treasury for `gbx_` and assigns migration authority to `initialOwner`.
    /// @param gbx_ GBX token backed by this Fund.
    /// @param initialOwner Timelock that may configure the one-way successor.
    constructor(GBX gbx_, address initialOwner) Ownable(initialOwner) {
        if (address(gbx_) == address(0) || address(gbx_).code.length == 0) revert ForbiddenToken(address(gbx_));
        gbx = gbx_;
    }

    /// @notice Burns GBX already held by Fund, including GBX received during a buyback.
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

            if (payout != 0) {
                uint256 receiverBalanceBefore = IERC20(token).balanceOf(receiver);
                IERC20(token).safeTransfer(receiver, payout);
                uint256 received = IERC20(token).balanceOf(receiver) - receiverBalanceBefore;
                if (received != payout) revert InexactTransfer(token, payout, received);
            }

            _clearToken(REDEMPTION_NAMESPACE, token);
        }

        emit Redeemed(msg.sender, receiver, gbxAmount, tokenCount);
    }

    /// @notice Permanently enables one-way, token-by-token migration to `newSuccessor`.
    /// @dev The successor must be a Fund-compatible contract backed by this exact GBX token.
    /// @param newSuccessor Fund-compatible destination to set permanently.
    function setSuccessor(address newSuccessor) external onlyOwner {
        if (successor != address(0)) revert SuccessorAlreadySet(successor);
        if (newSuccessor == address(0) || newSuccessor == address(this) || newSuccessor.code.length == 0) {
            revert InvalidSuccessor(newSuccessor);
        }
        if (IFund(newSuccessor).gbx() != address(gbx)) revert InvalidSuccessor(newSuccessor);

        successor = newSuccessor;

        emit SuccessorSet(newSuccessor);
    }

    /// @notice Moves the complete Fund balance of each selected token to the configured successor.
    /// @dev Anyone may execute migration in gas-bounded batches. GBX cannot be migrated and remains burnable here.
    /// @param tokens Unique, non-GBX token addresses whose complete balances should move.
    function migrate(address[] calldata tokens) external nonReentrant {
        address migrationTarget = successor;
        if (migrationTarget == address(0)) revert SuccessorNotSet();

        uint256 tokenCount = tokens.length;
        if (tokenCount == 0) revert EmptyTokenList();

        for (uint256 i; i < tokenCount; ++i) {
            address token = tokens[i];
            _markToken(MIGRATION_NAMESPACE, token);

            uint256 amount = IERC20(token).balanceOf(address(this));
            if (amount != 0) {
                uint256 successorBalanceBefore = IERC20(token).balanceOf(migrationTarget);
                IERC20(token).safeTransfer(migrationTarget, amount);
                uint256 received = IERC20(token).balanceOf(migrationTarget) - successorBalanceBefore;
                if (received != amount) revert InexactTransfer(token, amount, received);
            }

            _clearToken(MIGRATION_NAMESPACE, token);
            emit TokenMigrated(msg.sender, token, migrationTarget, amount);
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
