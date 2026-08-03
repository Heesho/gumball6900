// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AllocationVoter } from "../signal/AllocationVoter.sol";

/// @title RevenueRouter
/// @notice Permissionless observed-delta routing of non-emission USDG revenue into GumBallVault allocation accounting.
/// @dev Has no owner, fee split, rescue, or withdrawal path.
contract RevenueRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Reverts when a nominal revenue pull debits its payer above the signed maximum.
    /// @param maximum The maximum raw USDG amount authorized by the payer for this call.
    /// @param observed The actual payer balance decrease observed during the transfer.
    error RevenueRouter__PayerDebitExceededMaximum(uint256 maximum, uint256 observed);
    error RevenueRouter__ZeroAddress();
    error RevenueRouter__ZeroAmount();
    error RevenueRouter__ZeroReceived();
    error RevenueRouter__TargetHasNoCode(address target);

    event RevenueRouter__RevenueRouted(
        address indexed payer, bytes32 indexed sourceId, uint256 requestedAmount, uint256 vaultReceived
    );

    /// @notice Canonical USDG routed using observed balance changes.
    IERC20 public immutable USDG;
    /// @notice Canonical vault receiving all routed USDG.
    address public immutable GUM_BALL_VAULT;
    /// @notice Canonical voter notified only for the vault's observed receipt.
    AllocationVoter public immutable ALLOCATION_VOTER;

    /// @notice Wires canonical USDG, vault, and voter permanently.
    /// @param usdG_ The canonical USDG token routed as observed balance deltas.
    /// @param gumBallVault_ The canonical vault receiving every routed USDG unit.
    /// @param allocationVoter_ The canonical voter notified only for the vault's observed increase.
    constructor(address usdG_, address gumBallVault_, address allocationVoter_) {
        if (usdG_ == address(0) || gumBallVault_ == address(0) || allocationVoter_ == address(0)) {
            revert RevenueRouter__ZeroAddress();
        }
        if (usdG_.code.length == 0) revert RevenueRouter__TargetHasNoCode(usdG_);
        if (gumBallVault_.code.length == 0) revert RevenueRouter__TargetHasNoCode(gumBallVault_);
        if (allocationVoter_.code.length == 0) revert RevenueRouter__TargetHasNoCode(allocationVoter_);
        USDG = IERC20(usdG_);
        GUM_BALL_VAULT = gumBallVault_;
        ALLOCATION_VOTER = AllocationVoter(allocationVoter_);
    }

    /// @notice Pulls USDG, forwards the observed receipt to the vault, and notifies only the vault's observed increase.
    /// @param requestedAmount The maximum raw USDG amount requested from the payer.
    /// @param sourceId An offchain-defined attribution label emitted for observability only.
    /// @return vaultReceived The raw USDG balance increase observed at GumBallVault.
    function routeRevenue(uint256 requestedAmount, bytes32 sourceId)
        external
        nonReentrant
        returns (uint256 vaultReceived)
    {
        if (requestedAmount == 0) revert RevenueRouter__ZeroAmount();

        uint256 payerBalanceBefore = USDG.balanceOf(msg.sender);
        uint256 routerBalanceBefore = USDG.balanceOf(address(this));
        USDG.safeTransferFrom(msg.sender, address(this), requestedAmount);
        uint256 payerBalanceAfter = USDG.balanceOf(msg.sender);
        uint256 observedPayerDebit = payerBalanceBefore > payerBalanceAfter ? payerBalanceBefore - payerBalanceAfter : 0;
        if (observedPayerDebit > requestedAmount) {
            revert RevenueRouter__PayerDebitExceededMaximum(requestedAmount, observedPayerDebit);
        }
        uint256 received = USDG.balanceOf(address(this)) - routerBalanceBefore;
        if (received == 0) revert RevenueRouter__ZeroReceived();

        uint256 vaultBalanceBefore = USDG.balanceOf(GUM_BALL_VAULT);
        USDG.safeTransfer(GUM_BALL_VAULT, received);
        vaultReceived = USDG.balanceOf(GUM_BALL_VAULT) - vaultBalanceBefore;
        if (vaultReceived == 0) revert RevenueRouter__ZeroReceived();

        ALLOCATION_VOTER.notifyRevenue(vaultReceived, AllocationVoter.RevenueSource.RevenueRouter);
        emit RevenueRouter__RevenueRouted(msg.sender, sourceId, requestedAmount, vaultReceived);
    }
}
