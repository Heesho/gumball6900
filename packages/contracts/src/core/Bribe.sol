// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GumBall6900 Multi-Token Strategy Reward Stream
/// @author @heesho
/// @notice Streams as many as sixteen registered reward tokens among the accounts signaling one paired Strategy.
/// @dev Resonance is the sole writer of virtual signal weights and the append-only token registry. Each token uses an
///      independent Synthetix-style seven-day stream and a cumulative reward-per-signal index scaled by `1e36`.
///      Rate, index, and account calculations round down; the resulting tokens remain unallocated contract surplus.
///      Time still elapses when total signal weight is zero, so rewards emitted during that interval are likewise
///      unclaimable. Killing the paired Strategy does not stop Bribe streams or remove its recorded weights: existing
///      positions keep earning until moved or withdrawn, claims and notifications remain permissionless, and Resonance
///      may still register rewards. Reward transfers assume standard, non-rebasing ERC-20 behavior.
contract Bribe is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Scheduling and cumulative-index state for one registered reward token.
    /// @param periodFinish Unix timestamp at which the current stream stops accruing.
    /// @param rewardRate Whole raw token units scheduled per second for the current stream.
    /// @param lastUpdateTime Unix timestamp through which `rewardPerSignalStored` has been checkpointed.
    /// @param rewardPerSignalStored Cumulative raw-token reward per signal unit, scaled by `REWARD_PRECISION`.
    struct RewardData {
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerSignalStored;
    }

    /// @notice Returns the fixed duration of every reward stream, in seconds.
    uint256 public constant REWARD_DURATION = 7 days;
    /// @notice Returns the fixed-point scale used by cumulative reward-per-signal accounting.
    uint256 public constant REWARD_PRECISION = 1e36;
    /// @notice Returns the maximum cumulative raw units accepted for any one reward token over this Bribe's lifetime.
    /// @dev Equal to `floor(type(uint256).max / REWARD_PRECISION)` and checked before stream state or custody changes.
    uint256 public constant MAX_LIFETIME_REWARD_AMOUNT = type(uint256).max / REWARD_PRECISION;
    /// @notice Returns the immutable upper bound on registered reward tokens and mandatory all-token loops.
    uint256 public constant MAX_REWARD_TOKENS = 16;

    /// @notice Returns the immutable Resonance authorized to maintain signal weights and register reward tokens.
    address public immutable resonance;

    /// @notice Returns the total raw signal weight assigned to this Bribe's paired Strategy.
    uint256 public totalSignalWeight;
    /// @notice Returns an account's raw signal weight assigned to this Bribe's paired Strategy.
    mapping(address account => uint256 weight) public signalWeightOf;

    address[] private _rewardTokens;
    /// @notice Returns whether a token belongs to the append-only reward-token registry.
    mapping(address token => bool isReward) public isRewardToken;
    /// @notice Returns the current stream timestamps, raw-unit rate, and scaled index for a reward token.
    /// @dev Unregistered tokens return an all-zero `RewardData` value.
    mapping(address token => RewardData data) public rewardData;
    /// @notice Returns the scaled cumulative index already incorporated for an account and reward token.
    mapping(address account => mapping(address token => uint256 paid)) public accountRewardPerSignalPaid;
    /// @notice Returns an account's checkpointed, unclaimed reward in raw token units.
    /// @dev This excludes reward accrued since the account's latest checkpoint; use `earned` for the live amount.
    mapping(address account => mapping(address token => uint256 amount)) public rewards;
    /// @notice Returns cumulative raw units accepted through notifications for a reward token.
    /// @dev The value is monotonic, never resets, and excludes donations and rolled-over remaining rewards.
    mapping(address token => uint256 amount) public lifetimeRewardNotified;

    /// @notice Emitted when Resonance appends a token to the reward registry.
    /// @param rewardToken Token that became eligible for funding and streaming.
    event RewardTokenAdded(address indexed rewardToken);
    /// @notice Emitted when a caller funds and restarts a registered token's seven-day stream.
    /// @param rewardToken Registered token pulled from the caller.
    /// @param amount Fresh raw token units pulled, excluding any remaining reward rolled into the new rate.
    event RewardNotified(address indexed rewardToken, uint256 amount);
    /// @notice Emitted when one account's checkpointed reward is paid.
    /// @param account Account that receives the token transfer regardless of who initiated the claim.
    /// @param rewardToken Registered token paid to `account`.
    /// @param amount Raw token units transferred.
    event RewardPaid(address indexed account, address indexed rewardToken, uint256 amount);
    /// @notice Emitted when Resonance adds signal weight for an account.
    /// @param account Account whose weight in the paired Strategy increased.
    /// @param amount Raw signal units added.
    event SignalWeightAdded(address indexed account, uint256 amount);
    /// @notice Emitted when Resonance removes signal weight for an account.
    /// @param account Account whose weight in the paired Strategy decreased.
    /// @param amount Raw signal units removed.
    event SignalWeightRemoved(address indexed account, uint256 amount);

    /// @notice Raised when an operation requires a registered reward token but receives an unregistered address.
    /// @param token Address that is absent from the append-only registry.
    error NotRewardToken(address token);
    /// @notice Raised when a signal-weight or token-registry mutation does not originate from Resonance.
    /// @param caller Unauthorized caller.
    error NotResonance(address caller);
    /// @notice Raised when a notification contains fewer raw units than the stream duration in seconds.
    /// @param amount Requested fresh notification amount in raw token units.
    error RewardBelowDuration(uint256 amount);
    /// @notice Raised when fresh funding is smaller than the scheduled reward remaining in the active stream.
    /// @param amount Requested fresh notification amount in raw token units.
    /// @param remaining Raw token units still scheduled at the current whole-unit rate.
    error RewardBelowRemaining(uint256 amount, uint256 remaining);
    /// @notice Raised before a notification would exceed the token's lifetime admission cap.
    /// @param token Registered reward token whose cap would be exceeded.
    /// @param notified Cumulative raw units previously accepted for `token`.
    /// @param requested Fresh raw units requested in this notification.
    /// @param maximum Maximum cumulative raw units the token may ever notify.
    error RewardLifetimeCapExceeded(address token, uint256 notified, uint256 requested, uint256 maximum);
    /// @notice Raised when Resonance attempts to register a token after the registry reaches its immutable limit.
    /// @param maximum Maximum number of tokens the registry accepts.
    error RewardTokenLimitReached(uint256 maximum);
    /// @notice Raised when Resonance attempts to append a token that is already registered.
    /// @param token Already-registered reward token.
    error RewardAlreadyAdded(address token);
    /// @notice Raised for a zero account or for a zero or code-less contract dependency or reward token.
    error ZeroAddress();
    /// @notice Raised when Resonance attempts to add or remove zero signal weight.
    error ZeroAmount();

    /// @notice Restricts signal-weight and reward-token registry mutations to the immutable Resonance.
    /// @dev Reverts with `NotResonance` before executing the function body.
    modifier onlyResonance() {
        if (msg.sender != resonance) revert NotResonance(msg.sender);
        _;
    }

    /// @notice Creates an empty, bounded reward stream controlled by one Resonance contract.
    /// @dev Reverts with `ZeroAddress` when `resonance_` is zero or has no deployed code.
    /// @param resonance_ Resonance exclusively authorized to maintain signal weights and register reward tokens.
    constructor(address resonance_) {
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();
        resonance = resonance_;
    }

    /// @notice Checkpoints and pays every registered reward token earned by `account` directly to that account.
    /// @dev Any caller may initiate the claim. The function loops over at most `MAX_REWARD_TOKENS`. A failed token
    ///      transfer reverts the complete all-token claim; `claimReward` provides per-token failure isolation. Emits
    ///      `RewardPaid` once for each token with a nonzero payment.
    /// @param account Account whose accrued raw-token rewards are checkpointed and paid; cannot be zero.
    function claimRewards(address account) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        _updateAllRewards(account);

        uint256 count = _rewardTokens.length;
        for (uint256 i; i < count; ++i) {
            _claim(account, _rewardTokens[i]);
        }
    }

    /// @notice Checkpoints and pays one registered reward token earned by `account` directly to that account.
    /// @dev Any caller may initiate the claim. Other reward streams are neither checkpointed nor transferred. A failed
    ///      transfer reverts the checkpoint and entitlement reset, preserving the scalar claim. Emits `RewardPaid` only
    ///      when a nonzero amount is transferred.
    /// @param account Account whose reward is checkpointed and paid; cannot be zero.
    /// @param rewardToken Registered token to checkpoint and pay.
    /// @return amount Raw token units transferred, or zero when the account has no whole-unit reward.
    function claimReward(address account, address rewardToken) external nonReentrant returns (uint256 amount) {
        if (account == address(0)) revert ZeroAddress();
        _requireRewardToken(rewardToken);
        _updateReward(account, rewardToken);
        amount = _claim(account, rewardToken);
    }

    /// @notice Pulls fresh funding from the caller and restarts a registered token's seven-day reward stream.
    /// @dev Funding is permissionless. `amount` must be at least `REWARD_DURATION`, at least `remainingReward`, and
    ///      within the token's remaining lifetime cap. During an active stream, the new per-second rate is
    ///      `floor((amount + remainingReward) / REWARD_DURATION)`; otherwise it is
    ///      `floor(amount / REWARD_DURATION)`. The period restarts from the current timestamp, and division remainder
    ///      remains unallocated token surplus. Cap and threshold failures occur before checkpointing or token transfer.
    ///      Emits `RewardNotified` after funding and schedule state are updated.
    /// @param rewardToken Registered standard ERC-20 token to pull and stream.
    /// @param amount Fresh raw token units pulled from the caller and counted toward the lifetime cap.
    function notifyReward(address rewardToken, uint256 amount) external nonReentrant {
        _requireRewardToken(rewardToken);
        if (amount < REWARD_DURATION) revert RewardBelowDuration(amount);

        uint256 notified = lifetimeRewardNotified[rewardToken];
        uint256 maximum = MAX_LIFETIME_REWARD_AMOUNT;
        if (amount > maximum - notified) {
            revert RewardLifetimeCapExceeded(rewardToken, notified, amount, maximum);
        }

        uint256 remaining = remainingReward(rewardToken);
        if (amount < remaining) revert RewardBelowRemaining(amount, remaining);

        _updateReward(address(0), rewardToken);
        IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), amount);

        RewardData storage data = rewardData[rewardToken];
        data.rewardRate = (amount + remaining) / REWARD_DURATION;
        data.lastUpdateTime = block.timestamp;
        data.periodFinish = block.timestamp + REWARD_DURATION;
        lifetimeRewardNotified[rewardToken] = notified + amount;

        emit RewardNotified(rewardToken, amount);
    }

    /// @notice Adds signal weight for `account` after checkpointing every registered reward under the prior weights.
    /// @dev Callable only by Resonance. The mandatory checkpoint loop is bounded by `MAX_REWARD_TOKENS`. Emits
    ///      `SignalWeightAdded` after both the account and total weights increase.
    /// @param account Nonzero account whose paired-Strategy signal weight increases.
    /// @param amount Nonzero raw signal units added to both the account weight and total weight.
    function addSignalWeight(address account, uint256 amount) external onlyResonance {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        _updateAllRewards(account);
        totalSignalWeight += amount;
        signalWeightOf[account] += amount;

        emit SignalWeightAdded(account, amount);
    }

    /// @notice Removes signal weight for `account` after checkpointing every registered reward under the prior weights.
    /// @dev Callable only by Resonance. Removing more than the account or total weight reverts by checked arithmetic.
    ///      Emits `SignalWeightRemoved` after both weights decrease.
    /// @param account Nonzero account whose paired-Strategy signal weight decreases.
    /// @param amount Nonzero raw signal units removed from both the account weight and total weight.
    function removeSignalWeight(address account, uint256 amount) external onlyResonance {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        _updateAllRewards(account);
        totalSignalWeight -= amount;
        signalWeightOf[account] -= amount;

        emit SignalWeightRemoved(account, amount);
    }

    /// @notice Appends a reward token to this Bribe's permanent registry.
    /// @dev Callable only by Resonance. The token must be a unique, nonzero contract and the resulting registry length
    ///      cannot exceed `MAX_REWARD_TOKENS`; registration does not fund or start a stream. Emits `RewardTokenAdded`.
    /// @param rewardToken ERC-20 contract address to register.
    function addRewardToken(address rewardToken) external onlyResonance {
        if (rewardToken == address(0) || rewardToken.code.length == 0) revert ZeroAddress();
        if (isRewardToken[rewardToken]) revert RewardAlreadyAdded(rewardToken);
        if (_rewardTokens.length == MAX_REWARD_TOKENS) revert RewardTokenLimitReached(MAX_REWARD_TOKENS);

        isRewardToken[rewardToken] = true;
        _rewardTokens.push(rewardToken);

        emit RewardTokenAdded(rewardToken);
    }

    /// @notice Returns every registered reward-token address in immutable insertion order.
    /// @return tokens Copy of the append-only registry, containing at most `MAX_REWARD_TOKENS` entries.
    function rewardTokens() external view returns (address[] memory tokens) {
        return _rewardTokens;
    }

    /// @notice Returns the raw token units still scheduled in a reward token's active stream.
    /// @dev Computes `(periodFinish - block.timestamp) * rewardRate` while active and zero afterward. The result
    ///      excludes elapsed rewards, direct donations, and rate-division surplus. Unregistered tokens return zero.
    /// @param rewardToken Reward token whose current stream is queried.
    /// @return amount Raw token units remaining at the stored whole-unit-per-second rate.
    function remainingReward(address rewardToken) public view returns (uint256 amount) {
        RewardData storage data = rewardData[rewardToken];
        if (block.timestamp >= data.periodFinish) return 0;
        return (data.periodFinish - block.timestamp) * data.rewardRate;
    }

    /// @notice Returns the live cumulative reward allocated per raw signal unit for one reward token.
    /// @dev The result is scaled by `REWARD_PRECISION` and each index increment rounds down. Accrual stops at
    ///      `periodFinish`. If total signal weight is zero, the index remains unchanged and elapsed rewards cannot be
    ///      captured by accounts that add weight later. This view does not write a checkpoint.
    /// @param rewardToken Reward token whose cumulative index is queried; unregistered tokens return zero.
    /// @return accumulatedReward Cumulative reward-per-signal index scaled by `REWARD_PRECISION`.
    function rewardPerSignal(address rewardToken) public view returns (uint256 accumulatedReward) {
        RewardData storage data = rewardData[rewardToken];
        uint256 signalWeight = totalSignalWeight;
        if (signalWeight == 0) return data.rewardPerSignalStored;

        uint256 elapsed = _lastApplicableRewardTime(rewardToken) - data.lastUpdateTime;
        return data.rewardPerSignalStored + Math.mulDiv(elapsed * data.rewardRate, REWARD_PRECISION, signalWeight);
    }

    /// @notice Returns one account's checkpointed plus pending reward for one token in whole raw units.
    /// @dev Pending accrual is computed from the live index and rounds down; this view does not write a checkpoint or
    ///      validate that `rewardToken` is registered.
    /// @param account Account whose entitlement is queried.
    /// @param rewardToken Reward token whose entitlement is queried.
    /// @return amount Raw token units currently payable after checkpointing.
    function earned(address account, address rewardToken) public view returns (uint256 amount) {
        uint256 rewardDelta = rewardPerSignal(rewardToken) - accountRewardPerSignalPaid[account][rewardToken];
        return rewards[account][rewardToken] + Math.mulDiv(signalWeightOf[account], rewardDelta, REWARD_PRECISION);
    }

    /// @dev Persists every registered token's index and time checkpoint, then checkpoints `account` under its current
    ///      signal weight when `account` is nonzero. The loop is bounded by `MAX_REWARD_TOKENS`.
    /// @param account Account to checkpoint, or the zero address to update only global stream state.
    function _updateAllRewards(address account) private {
        uint256 count = _rewardTokens.length;
        for (uint256 i; i < count; ++i) {
            _updateReward(account, _rewardTokens[i]);
        }
    }

    /// @dev Persists one stream's live cumulative index and applicable timestamp. For a nonzero `account`, converts
    ///      its index delta at its current signal weight into whole raw-token rewards, rounded down, before recording
    ///      the new paid index.
    /// @param account Account to checkpoint, or the zero address to update only global stream state.
    /// @param rewardToken Reward token whose stream and optional account entitlement are checkpointed.
    function _updateReward(address account, address rewardToken) private {
        RewardData storage data = rewardData[rewardToken];
        uint256 current = rewardPerSignal(rewardToken);
        data.rewardPerSignalStored = current;
        data.lastUpdateTime = _lastApplicableRewardTime(rewardToken);

        if (account != address(0)) {
            uint256 rewardDelta = current - accountRewardPerSignalPaid[account][rewardToken];
            rewards[account][rewardToken] += Math.mulDiv(signalWeightOf[account], rewardDelta, REWARD_PRECISION);
            accountRewardPerSignalPaid[account][rewardToken] = current;
        }
    }

    /// @dev Clears and transfers one account's checkpointed whole-unit reward using checks-effects-interactions.
    /// @param account Entitled transfer recipient.
    /// @param rewardToken Reward token to transfer.
    /// @return amount Raw token units transferred, or zero when no checkpointed reward exists.
    function _claim(address account, address rewardToken) private returns (uint256 amount) {
        amount = rewards[account][rewardToken];
        if (amount == 0) return 0;

        rewards[account][rewardToken] = 0;
        IERC20(rewardToken).safeTransfer(account, amount);

        emit RewardPaid(account, rewardToken, amount);
    }

    /// @dev Reverts with `NotRewardToken` unless `rewardToken` is in the append-only registry.
    /// @param rewardToken Token address to validate.
    function _requireRewardToken(address rewardToken) private view {
        if (!isRewardToken[rewardToken]) revert NotRewardToken(rewardToken);
    }

    /// @dev Caps reward accrual at the stream's `periodFinish` timestamp.
    /// @param rewardToken Reward token whose stream boundary is queried.
    /// @return timestamp Earlier of the current Unix timestamp and the token's `periodFinish`.
    function _lastApplicableRewardTime(address rewardToken) private view returns (uint256 timestamp) {
        return Math.min(block.timestamp, rewardData[rewardToken].periodFinish);
    }
}
