// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Bribe } from "./Bribe.sol";

/// @title BribeRouter
/// @author GUM BALL 6900
/// @notice Routes one Strategy's payment-token rewards into its Bribe contract.
/// @dev Adapted from Liquid Signal Governance. If the Strategy has no voters, queued rewards go to Fund instead of
///      becoming claimable by voters who arrive after the purchase.
contract BribeRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Strategy exclusively authorized to queue newly earned rewards.
    address public immutable strategy;
    /// @notice Bribe that streams the queued rewards.
    Bribe public immutable bribe;
    /// @notice Strategy payment token distributed as rewards.
    IERC20 public immutable rewardToken;
    /// @notice Treasury that receives rewards when the Bribe has no voting weight.
    address public immutable fund;

    /// @notice Emitted when queued rewards begin streaming through Bribe.
    /// @param bribe Bribe that received the rewards.
    /// @param rewardToken Token being streamed.
    /// @param amount Amount sent to Bribe.
    event RewardsDistributed(address indexed bribe, address indexed rewardToken, uint256 amount);
    /// @notice Emitted when Strategy sends a newly earned voter reward share.
    /// @param strategy Strategy that supplied the rewards.
    /// @param amount Amount queued in the router.
    event RewardsQueued(address indexed strategy, uint256 amount);
    /// @notice Emitted when rewards are returned to Fund because no voter weight exists.
    /// @param fund Fund that received the rewards.
    /// @param rewardToken Token returned.
    /// @param amount Amount returned.
    event RewardsReturnedToFund(address indexed fund, address indexed rewardToken, uint256 amount);

    error InexactTransfer(uint256 expected, uint256 received);
    error NotStrategy(address caller);
    error ZeroAddress();
    error ZeroAmount();

    /// @notice Creates the fixed route between one Strategy, one reward token, its Bribe, and Fund.
    /// @param strategy_ Strategy exclusively allowed to queue rewards.
    /// @param bribe_ Bribe that streams rewards to voters.
    /// @param rewardToken_ Strategy payment token distributed as rewards.
    /// @param fund_ Treasury receiving rewards when no voter weight exists.
    constructor(address strategy_, Bribe bribe_, IERC20 rewardToken_, address fund_) {
        if (
            strategy_ == address(0) || address(bribe_) == address(0) || address(rewardToken_) == address(0)
                || fund_ == address(0) || strategy_.code.length == 0 || address(bribe_).code.length == 0
                || address(rewardToken_).code.length == 0 || fund_.code.length == 0
        ) revert ZeroAddress();

        strategy = strategy_;
        bribe = bribe_;
        rewardToken = rewardToken_;
        fund = fund_;
    }

    /// @notice Pulls a newly earned bribe share from Strategy and attempts to start a reward stream.
    /// @param amount Amount of `rewardToken` to pull from Strategy.
    /// @return distributed Amount sent immediately to Bribe, or zero when retained or returned to Fund.
    function routeRewards(uint256 amount) external nonReentrant returns (uint256 distributed) {
        if (msg.sender != strategy) revert NotStrategy(msg.sender);
        if (amount == 0) revert ZeroAmount();

        uint256 balanceBefore = rewardToken.balanceOf(address(this));
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = rewardToken.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert InexactTransfer(amount, received);

        emit RewardsQueued(msg.sender, amount);
        distributed = _distribute();
    }

    /// @notice Permissionlessly distributes queued rewards or returns them to Fund when there are no voters.
    /// @return distributed Amount sent to Bribe. Returns zero when rewards are queued or returned to Fund.
    function distribute() external nonReentrant returns (uint256 distributed) {
        distributed = _distribute();
    }

    /// @notice Returns payment-token rewards currently waiting in the router.
    /// @return amount Current queued reward balance.
    function pendingRewards() external view returns (uint256 amount) {
        return rewardToken.balanceOf(address(this));
    }

    /// @notice Attempts to place all queued rewards into their next destination.
    /// @dev Sends queued rewards to Bribe when stream conditions are met, or to Fund when no weight exists.
    /// @return distributed Amount sent to Bribe, or zero when no new stream begins.
    function _distribute() private returns (uint256 distributed) {
        uint256 balance = rewardToken.balanceOf(address(this));
        if (balance == 0) return 0;

        if (bribe.totalSupply() == 0) {
            rewardToken.safeTransfer(fund, balance);
            emit RewardsReturnedToFund(fund, address(rewardToken), balance);
            return 0;
        }

        // Avoid a zero reward rate and avoid resetting a live stream with a smaller amount than remains.
        if (balance < bribe.REWARD_DURATION() || balance <= bribe.left(address(rewardToken))) return 0;

        rewardToken.forceApprove(address(bribe), balance);
        bribe.notifyRewardAmount(address(rewardToken), balance);
        rewardToken.forceApprove(address(bribe), 0);

        emit RewardsDistributed(address(bribe), address(rewardToken), balance);
        return balance;
    }
}
