// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IBribe } from "./interfaces/IBribe.sol";

/// @title GumBall6900 Bribe Reward Router
/// @notice Buffers one Strategy's acquired-payment Bribe share until it can start or top up the paired reward stream.
/// @dev Strategy performs the Fund/Bribe split and transfers only the Bribe share here. Routing is permissionless.
contract BribeRouter {
    using SafeERC20 for IERC20;

    /// @notice Strategy payment token distributed by the paired Bribe.
    IERC20 public immutable paymentToken;
    /// @notice Bribe paired with the Strategy and fixed as the reward destination.
    IBribe public immutable bribe;

    /// @notice Emitted when the Router's complete buffered balance enters the paired Bribe.
    event RewardRouted(address indexed bribe, address indexed rewardToken, uint256 amount);

    /// @notice Raised for a zero or code-less immutable dependency.
    error ZeroAddress();

    /// @notice Creates the fixed route between one payment token and its paired Bribe.
    /// @param bribe_ Bribe paired with the Strategy.
    /// @param paymentToken_ Strategy payment token.
    constructor(IBribe bribe_, IERC20 paymentToken_) {
        if (
            address(bribe_) == address(0) || address(paymentToken_) == address(0) || address(bribe_).code.length == 0
                || address(paymentToken_).code.length == 0
        ) revert ZeroAddress();

        paymentToken = paymentToken_;
        bribe = bribe_;
    }

    /// @notice Notifies the paired Bribe with the Router's complete balance once it satisfies the top-up gates.
    /// @return amount Amount sent to Bribe, or zero when the Router is empty or its balance must keep
    ///         accumulating.
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
