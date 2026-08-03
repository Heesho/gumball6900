// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { StakedGBX } from "../signal/StakedGBX.sol";
import { GumBallVault } from "../vault/GumBallVault.sol";

/// @title GumBallRouter
/// @notice Typed, non-upgradeable convenience entrypoint for permit-based GBX staking and basket redemption.
/// @dev The router exposes no arbitrary target, calldata, token, approval, receiver-of-stake, or generic multicall.
///      It may transiently hold only the exact caller-provided GBX amount and restores its prior balance atomically.
contract GumBallRouter is ReentrancyGuard {
    using SafeERC20 for IGBXToken;

    error GumBallRouter__GBXBalanceMismatch(uint256 expected, uint256 actual);
    error GumBallRouter__InvalidPeer(address expected, address actual);
    error GumBallRouter__ObservedGBXMismatch(uint256 expected, uint256 observed);
    error GumBallRouter__StakedAmountMismatch(uint256 expected, uint256 actual);
    error GumBallRouter__ZeroAddress();
    error GumBallRouter__ZeroAmount();

    event GumBallRouter__Redeemed(address indexed owner, address indexed receiver, uint256 shares, uint256 assetCount);
    event GumBallRouter__Staked(address indexed payer, uint256 amount);

    /// @notice Canonical GBX transferred transiently for typed staking and redemption flows.
    IGBXToken public immutable GBX;
    /// @notice Canonical sGBX escrow receiving typed stake deposits.
    StakedGBX public immutable STAKED_GBX;
    /// @notice Canonical basket vault receiving typed redemption calls.
    GumBallVault public immutable GUM_BALL_VAULT;

    /// @notice Wires the one canonical GBX, staking escrow, and basket vault, rejecting mismatched peers.
    /// @param gbx_ The canonical GBX token.
    /// @param stakedGBX_ The canonical non-transferable sGBX staking escrow.
    /// @param gumBallVault_ The canonical in-kind basket vault.
    constructor(address gbx_, address stakedGBX_, address gumBallVault_) {
        if (gbx_ == address(0) || stakedGBX_ == address(0) || gumBallVault_ == address(0)) {
            revert GumBallRouter__ZeroAddress();
        }
        if (gbx_.code.length == 0 || stakedGBX_.code.length == 0 || gumBallVault_.code.length == 0) {
            revert GumBallRouter__ZeroAddress();
        }

        address stakingGBX = address(StakedGBX(stakedGBX_).GBX());
        if (stakingGBX != gbx_) revert GumBallRouter__InvalidPeer(gbx_, stakingGBX);
        address vaultGBX = address(GumBallVault(payable(gumBallVault_)).GBX());
        if (vaultGBX != gbx_) revert GumBallRouter__InvalidPeer(gbx_, vaultGBX);

        GBX = IGBXToken(gbx_);
        STAKED_GBX = StakedGBX(stakedGBX_);
        GUM_BALL_VAULT = GumBallVault(payable(gumBallVault_));
    }

    /// @notice Stakes caller-owned GBX 1:1 after a normal ERC-20 approval to this router.
    /// @param amount The raw GBX amount transferred from and staked for the caller.
    /// @return receivedAmount The raw sGBX amount minted to the caller.
    function stake(uint256 amount) external nonReentrant returns (uint256 receivedAmount) {
        return _stake(msg.sender, amount);
    }

    /// @notice Stakes caller-owned GBX 1:1 using an EIP-2612 permit scoped to this router and exact amount.
    /// @param amount The raw GBX amount transferred from and staked for the caller.
    /// @param permitDeadline The EIP-2612 signature expiry timestamp.
    /// @param v The ECDSA recovery identifier.
    /// @param r The first 32 bytes of the ECDSA signature.
    /// @param s The second 32 bytes of the ECDSA signature.
    /// @return receivedAmount The raw sGBX amount minted to the caller.
    function stakeWithPermit(uint256 amount, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
        returns (uint256 receivedAmount)
    {
        GBX.permit(msg.sender, address(this), amount, permitDeadline, v, r, s);
        return _stake(msg.sender, amount);
    }

    /// @notice Burns caller-owned GBX after a normal approval and sends every basket asset directly to receiver.
    /// @param shares The raw GBX amount transferred from the caller and burned.
    /// @param receiver The eligible account that receives every pro-rata basket output.
    /// @return amountsOut The raw asset amounts transferred in AssetRegistry order.
    function redeem(uint256 shares, address receiver) external nonReentrant returns (uint256[] memory amountsOut) {
        return _redeem(msg.sender, shares, receiver);
    }

    /// @notice Burns caller-owned GBX using EIP-2612 and sends every basket asset directly to receiver.
    /// @param shares The raw GBX amount transferred from the caller and burned.
    /// @param receiver The eligible account that receives every pro-rata basket output.
    /// @param permitDeadline The EIP-2612 signature expiry timestamp.
    /// @param v The ECDSA recovery identifier.
    /// @param r The first 32 bytes of the ECDSA signature.
    /// @param s The second 32 bytes of the ECDSA signature.
    /// @return amountsOut The raw asset amounts transferred in AssetRegistry order.
    function redeemWithPermit(uint256 shares, address receiver, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
        returns (uint256[] memory amountsOut)
    {
        GBX.permit(msg.sender, address(this), shares, permitDeadline, v, r, s);
        return _redeem(msg.sender, shares, receiver);
    }

    function _stake(address payer, uint256 amount) private returns (uint256 receivedAmount) {
        if (amount == 0) revert GumBallRouter__ZeroAmount();
        uint256 balanceBefore = _pullExactGBX(payer, amount);

        GBX.forceApprove(address(STAKED_GBX), amount);
        receivedAmount = STAKED_GBX.stakeFor(payer, amount);
        GBX.forceApprove(address(STAKED_GBX), 0);
        if (receivedAmount != amount) revert GumBallRouter__StakedAmountMismatch(amount, receivedAmount);

        _requireRestoredBalance(balanceBefore);
        emit GumBallRouter__Staked(payer, amount);
    }

    function _redeem(address owner, uint256 shares, address receiver) private returns (uint256[] memory amountsOut) {
        if (shares == 0) revert GumBallRouter__ZeroAmount();
        if (receiver == address(0)) revert GumBallRouter__ZeroAddress();
        uint256 balanceBefore = _pullExactGBX(owner, shares);

        GBX.forceApprove(address(GUM_BALL_VAULT), shares);
        amountsOut = GUM_BALL_VAULT.redeem(shares, receiver);
        GBX.forceApprove(address(GUM_BALL_VAULT), 0);

        _requireRestoredBalance(balanceBefore);
        emit GumBallRouter__Redeemed(owner, receiver, shares, amountsOut.length);
    }

    function _pullExactGBX(address payer, uint256 amount) private returns (uint256 balanceBefore) {
        balanceBefore = GBX.balanceOf(address(this));
        GBX.safeTransferFrom(payer, address(this), amount);
        uint256 observed = GBX.balanceOf(address(this)) - balanceBefore;
        if (observed != amount) revert GumBallRouter__ObservedGBXMismatch(amount, observed);
    }

    function _requireRestoredBalance(uint256 expectedBalance) private view {
        uint256 actualBalance = GBX.balanceOf(address(this));
        if (actualBalance != expectedBalance) revert GumBallRouter__GBXBalanceMismatch(expectedBalance, actualBalance);
    }
}
