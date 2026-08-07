// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Bribe
/// @author GUM BALL 6900
/// @notice Streams Strategy payment rewards to the SignalGBX holders voting for that Strategy.
/// @dev Adapted from the Liquid Signal Governance Bribe contract. Balances are virtual: only Voter can add or remove
///      voting weight, while reward tokens remain in this contract until claimed.
contract Bribe is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct RewardData {
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    /// @notice Duration of each reward stream.
    uint256 public constant REWARD_DURATION = 7 days;
    /// @notice Fixed-point precision used for cumulative rewards per unit of voting weight.
    uint256 public constant REWARD_PRECISION = 1e18;

    /// @notice Voter contract allowed to maintain virtual balances and register reward tokens.
    address public immutable voter;

    /// @notice Total virtual voting weight assigned to this Bribe.
    uint256 public totalSupply;
    /// @notice Virtual voting weight assigned to each account.
    mapping(address account => uint256 balance) public balanceOf;

    address[] private _rewardTokens;
    /// @notice Whether a token is registered as a reward for this Bribe.
    mapping(address token => bool isReward) public isRewardToken;
    /// @notice Streaming state for each registered reward token.
    mapping(address token => RewardData data) public rewardData;
    /// @notice Cumulative reward-per-weight checkpoint already accounted to an account.
    mapping(address account => mapping(address token => uint256 paid)) public userRewardPerTokenPaid;
    /// @notice Accrued, unclaimed reward balance for an account and token.
    mapping(address account => mapping(address token => uint256 amount)) public rewards;

    /// @notice Emitted when Voter registers a supported reward token.
    /// @param rewardToken Newly registered reward token.
    event RewardAdded(address indexed rewardToken);
    /// @notice Emitted when a new amount starts or extends a reward stream.
    /// @param rewardToken Token being streamed.
    /// @param amount Amount added to the stream.
    event RewardNotified(address indexed rewardToken, uint256 amount);
    /// @notice Emitted when accrued rewards are paid to an account.
    /// @param account Account that received the rewards.
    /// @param rewardToken Token paid.
    /// @param amount Amount paid.
    event RewardPaid(address indexed account, address indexed rewardToken, uint256 amount);
    /// @notice Emitted when Voter adds virtual voting weight.
    /// @param account Account whose virtual balance increased.
    /// @param amount Weight added.
    event VotingWeightDeposited(address indexed account, uint256 amount);
    /// @notice Emitted when Voter removes virtual voting weight.
    /// @param account Account whose virtual balance decreased.
    /// @param amount Weight removed.
    event VotingWeightWithdrawn(address indexed account, uint256 amount);

    error InexactRewardTransfer(uint256 expected, uint256 received);
    error NotRewardToken(address token);
    error NotVoter(address caller);
    error RewardAlreadyAdded(address token);
    error RewardBelowDuration(uint256 amount);
    error RewardBelowRemaining(uint256 amount, uint256 remaining);
    error ZeroAddress();
    error ZeroAmount();

    /// @dev Restricts virtual-balance and reward-token administration to Voter.
    modifier onlyVoter() {
        if (msg.sender != voter) revert NotVoter(msg.sender);
        _;
    }

    /// @dev Advances every reward stream and, when nonzero, checkpoints `account` before its balance changes.
    /// @param account Account to checkpoint, or zero when only global stream state should advance.
    modifier updateReward(address account) {
        uint256 rewardTokenCount = _rewardTokens.length;
        for (uint256 i; i < rewardTokenCount; ++i) {
            address rewardToken = _rewardTokens[i];
            RewardData storage data = rewardData[rewardToken];

            data.rewardPerTokenStored = rewardPerToken(rewardToken);
            data.lastUpdateTime = lastTimeRewardApplicable(rewardToken);

            if (account != address(0)) {
                rewards[account][rewardToken] = earned(account, rewardToken);
                userRewardPerTokenPaid[account][rewardToken] = data.rewardPerTokenStored;
            }
        }
        _;
    }

    /// @notice Creates a reward stream controlled by `voter_`.
    /// @param voter_ Voter exclusively authorized to maintain virtual balances.
    constructor(address voter_) {
        if (voter_ == address(0) || voter_.code.length == 0) revert ZeroAddress();
        voter = voter_;
    }

    /// @notice Claims every registered reward token earned by `account`.
    /// @dev Anyone may trigger a claim, but rewards are always sent directly to `account`.
    /// @param account Account whose accrued rewards are paid.
    function claimRewards(address account) external nonReentrant updateReward(account) {
        if (account == address(0)) revert ZeroAddress();

        uint256 rewardTokenCount = _rewardTokens.length;
        for (uint256 i; i < rewardTokenCount; ++i) {
            address rewardToken = _rewardTokens[i];
            uint256 reward = rewards[account][rewardToken];
            if (reward == 0) continue;

            rewards[account][rewardToken] = 0;
            IERC20(rewardToken).safeTransfer(account, reward);

            emit RewardPaid(account, rewardToken, reward);
        }
    }

    /// @notice Adds `amount` to a seven-day reward stream for `rewardToken`.
    /// @dev Existing undistributed rewards are rolled into the new stream. BribeRouter avoids calling this function
    ///      until the amount can sustain a non-zero rate and exceeds the remaining stream.
    /// @param rewardToken Registered token to stream.
    /// @param amount Amount pulled from the caller and added to the stream.
    function notifyRewardAmount(address rewardToken, uint256 amount) external nonReentrant updateReward(address(0)) {
        if (!isRewardToken[rewardToken]) revert NotRewardToken(rewardToken);
        if (amount < REWARD_DURATION) revert RewardBelowDuration(amount);

        uint256 remainingReward = left(rewardToken);
        if (amount <= remainingReward) revert RewardBelowRemaining(amount, remainingReward);

        uint256 balanceBefore = IERC20(rewardToken).balanceOf(address(this));
        IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(rewardToken).balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert InexactRewardTransfer(amount, received);

        RewardData storage data = rewardData[rewardToken];
        if (block.timestamp >= data.periodFinish) {
            data.rewardRate = amount / REWARD_DURATION;
        } else {
            uint256 secondsRemaining = data.periodFinish - block.timestamp;
            uint256 undistributed = secondsRemaining * data.rewardRate;
            data.rewardRate = (amount + undistributed) / REWARD_DURATION;
        }

        data.lastUpdateTime = block.timestamp;
        data.periodFinish = block.timestamp + REWARD_DURATION;

        emit RewardNotified(rewardToken, amount);
    }

    /// @notice Adds virtual voting weight for `account`.
    /// @param amount Weight to add.
    /// @param account Account whose virtual balance increases.
    function deposit(uint256 amount, address account) external onlyVoter updateReward(account) {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        totalSupply += amount;
        balanceOf[account] += amount;

        emit VotingWeightDeposited(account, amount);
    }

    /// @notice Removes virtual voting weight for `account`.
    /// @param amount Weight to remove.
    /// @param account Account whose virtual balance decreases.
    function withdraw(uint256 amount, address account) external onlyVoter updateReward(account) {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        totalSupply -= amount;
        balanceOf[account] -= amount;

        emit VotingWeightWithdrawn(account, amount);
    }

    /// @notice Registers an additional token that may be distributed by this Bribe.
    /// @param rewardToken Token to register.
    function addRewardToken(address rewardToken) external onlyVoter {
        if (rewardToken == address(0) || rewardToken.code.length == 0) revert ZeroAddress();
        if (isRewardToken[rewardToken]) revert RewardAlreadyAdded(rewardToken);

        isRewardToken[rewardToken] = true;
        _rewardTokens.push(rewardToken);

        emit RewardAdded(rewardToken);
    }

    /// @notice Returns all registered reward tokens.
    /// @return tokens Registered reward tokens in insertion order.
    function rewardTokens() external view returns (address[] memory tokens) {
        return _rewardTokens;
    }

    /// @notice Returns rewards still scheduled for distribution.
    /// @param rewardToken Token whose stream is queried.
    /// @return amount Undistributed rewards remaining in the active stream.
    function left(address rewardToken) public view returns (uint256 amount) {
        RewardData storage data = rewardData[rewardToken];
        if (block.timestamp >= data.periodFinish) return 0;
        return (data.periodFinish - block.timestamp) * data.rewardRate;
    }

    /// @notice Returns the last timestamp that contributes to the current reward period.
    /// @param rewardToken Token whose stream is queried.
    /// @return timestamp Current time capped at the stream's finishing time.
    function lastTimeRewardApplicable(address rewardToken) public view returns (uint256 timestamp) {
        return Math.min(block.timestamp, rewardData[rewardToken].periodFinish);
    }

    /// @notice Returns cumulative rewards per unit of virtual voting weight.
    /// @param rewardToken Token whose cumulative index is queried.
    /// @return accumulatedReward Cumulative reward per unit of weight, scaled by `REWARD_PRECISION`.
    function rewardPerToken(address rewardToken) public view returns (uint256 accumulatedReward) {
        RewardData storage data = rewardData[rewardToken];
        if (totalSupply == 0) return data.rewardPerTokenStored;

        uint256 elapsed = lastTimeRewardApplicable(rewardToken) - data.lastUpdateTime;
        return data.rewardPerTokenStored + Math.mulDiv(elapsed * data.rewardRate, REWARD_PRECISION, totalSupply);
    }

    /// @notice Returns rewards accrued by `account` for `rewardToken`.
    /// @param account Account whose rewards are queried.
    /// @param rewardToken Reward token to query.
    /// @return amount Accrued, unclaimed reward amount.
    function earned(address account, address rewardToken) public view returns (uint256 amount) {
        uint256 rewardDelta = rewardPerToken(rewardToken) - userRewardPerTokenPaid[account][rewardToken];
        return rewards[account][rewardToken] + Math.mulDiv(balanceOf[account], rewardDelta, REWARD_PRECISION);
    }
}
