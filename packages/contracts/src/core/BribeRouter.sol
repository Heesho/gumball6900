// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IBribe } from "./interfaces/IBribe.sol";

/// @title GumBall6900 Bribe Reward Router
/// @author heesho
/// @notice Buffers one Strategy's acquired payment-token Bribe share until the paired reward stream can accept it.
/// @dev The Strategy performs the Fund/Bribe split and transfers only the Bribe share here. Any account may attempt to
///      route the complete buffer, but the balance remains in place until it can sustain a nonzero seven-day rate and,
///      during an active stream, matches or exceeds the reward still scheduled. Direct token donations join the next
///      successful route. The payment token and Bribe are immutable and assumed to follow the standard-token model.
contract BribeRouter {
    using SafeERC20 for IERC20;

    /// @notice Returns the immutable Strategy payment token buffered and distributed as the automatic Bribe reward.
    IERC20 public immutable paymentToken;
    /// @notice Returns the immutable Bribe that pulls and streams the buffered payment token.
    IBribe public immutable bribe;

    /// @notice Emitted after the Router's complete buffered balance is accepted by the paired Bribe.
    /// @param bribe Immutable Bribe that received and scheduled the reward.
    /// @param rewardToken Immutable payment token transferred to the Bribe.
    /// @param amount Complete pre-route Router balance transferred, in raw token units.
    event RewardRouted(address indexed bribe, address indexed rewardToken, uint256 amount);

    /// @notice Raised when either constructor dependency is zero or has no deployed code.
    error ZeroAddress();

    /// @notice Creates the fixed route between one payment token and its paired Bribe.
    /// @dev Reverts with `ZeroAddress` unless both dependencies are nonzero contract addresses. The constructor does
    ///      not validate that `paymentToken_` is already registered by `bribe_`.
    /// @param bribe_ Bribe paired with the Strategy and authorized to pull routed tokens.
    /// @param paymentToken_ Strategy payment token held by this Router before distribution.
    constructor(IBribe bribe_, IERC20 paymentToken_) {
        if (
            address(bribe_) == address(0) || address(paymentToken_) == address(0) || address(bribe_).code.length == 0
                || address(paymentToken_).code.length == 0
        ) revert ZeroAddress();

        paymentToken = paymentToken_;
        bribe = bribe_;
    }

    /// @notice Routes the complete payment-token balance into the paired Bribe when all notification gates are met.
    /// @dev Permissionless. Returns zero without changing state when the balance is zero, below `REWARD_DURATION` raw
    ///      units, or below the Bribe's currently remaining reward. Otherwise, gives the Bribe an exact temporary
    ///      allowance and calls `notifyReward`, which pulls the complete balance and restarts its stream. A Bribe or
    ///      token failure reverts the route, preserving the buffered balance. Most transient failures can be retried,
    ///      but exhaustion of the Bribe's monotonic lifetime cap has no reset and permanently prevents later routing
    ///      for that token; already completed Strategy purchases remain unaffected. Emits `RewardRouted` on success.
    /// @return amount Raw payment-token units routed, or zero when the buffer must continue accumulating.
    function route() external returns (uint256 amount) {
        amount = paymentToken.balanceOf(address(this));
        if (amount == 0 || amount < bribe.REWARD_DURATION() || amount < bribe.remainingReward(address(paymentToken))) {
            return 0;
        }

        paymentToken.forceApprove(address(bribe), amount);
        bribe.notifyReward(address(paymentToken), amount);

        emit RewardRouted(address(bribe), address(paymentToken), amount);
    }
}
