// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GumBall6900 Multi-Token Strategy Reward Stream
/// @notice Streams up to sixteen independently registered reward assets to holders signaling one Strategy.
/// @dev Uses the Synthetix MultiRewards cumulative-index and leftover-rollover model over Resonance-controlled virtual
///      signal balances. Registered reward tokens are assumed to implement standard, non-rebasing ERC-20 semantics.
contract Bribe is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Independent scheduling and cumulative-index state for one registered reward token.
    /// @param periodFinish Timestamp at which the current seven-day stream ends.
    /// @param rewardRate Whole raw reward units emitted per second.
    /// @param lastUpdateTime Last timestamp incorporated into the stored cumulative index.
    /// @param rewardPerSignalStored Cumulative reward allocated per virtual signal unit.
    struct RewardData {
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerSignalStored;
    }

    /// @notice Fixed duration assigned to every reward stream.
    uint256 public constant REWARD_DURATION = 7 days;
    /// @notice Fixed-point scale preserving low-decimal rewards over eighteen-decimal virtual signal weights.
    uint256 public constant REWARD_PRECISION = 1e36;
    /// @notice Maximum cumulative raw units one reward token may notify over this Bribe's lifetime.
    uint256 public constant MAX_LIFETIME_REWARD_AMOUNT = type(uint256).max / REWARD_PRECISION;
    /// @notice Immutable upper bound on append-only reward tokens and every mandatory reward loop.
    uint256 public constant MAX_REWARD_TOKENS = 16;

    /// @notice Resonance exclusively authorized to maintain virtual balances and register reward assets.
    address public immutable resonance;

    /// @notice Total virtual signal weight assigned to this Bribe.
    uint256 public totalSignalWeight;
    /// @notice Virtual signal weight assigned to each account by Resonance.
    mapping(address account => uint256 weight) public signalWeightOf;

    address[] private _rewardTokens;
    /// @notice Append-only membership flag for tokens governance registered through Resonance.
    mapping(address token => bool isReward) public isRewardToken;
    /// @notice Independent stream state for every registered reward token.
    mapping(address token => RewardData data) public rewardData;
    /// @notice Cumulative reward index already incorporated for one account and token.
    mapping(address account => mapping(address token => uint256 paid)) public accountRewardPerSignalPaid;
    /// @notice Whole-token accrued user liability, payable only to the entitled account.
    mapping(address account => mapping(address token => uint256 amount)) public rewards;
    /// @notice Monotonic cumulative raw units admitted through notifications for each reward token.
    mapping(address token => uint256 amount) public lifetimeRewardNotified;

    /// @notice Emitted when Resonance appends one supported reward token.
    event RewardTokenAdded(address indexed rewardToken);
    /// @notice Emitted when a caller funds and restarts a registered reward stream.
    event RewardNotified(address indexed rewardToken, uint256 amount);
    /// @notice Emitted when accrued rewards are paid to their entitled account.
    event RewardPaid(address indexed account, address indexed rewardToken, uint256 amount);
    /// @notice Emitted when Resonance adds virtual signal weight.
    event SignalWeightAdded(address indexed account, uint256 amount);
    /// @notice Emitted when Resonance removes virtual signal weight.
    event SignalWeightRemoved(address indexed account, uint256 amount);

    /// @notice Raised when a token is not in the append-only reward registry.
    error NotRewardToken(address token);
    /// @notice Raised when a virtual-balance or registry call does not originate from Resonance.
    error NotResonance(address caller);
    /// @notice Raised when a notification is too small to sustain a nonzero seven-day reward rate.
    error RewardBelowDuration(uint256 amount);
    /// @notice Raised when a notification is smaller than the reward remaining in the active stream.
    error RewardBelowRemaining(uint256 amount, uint256 remaining);
    /// @notice Raised before cumulative notifications can exhaust the reward index's numeric range.
    error RewardLifetimeCapExceeded(address token, uint256 notified, uint256 requested, uint256 maximum);
    /// @notice Raised before a seventeenth reward token can change state.
    error RewardTokenLimitReached(uint256 maximum);
    /// @notice Raised when governance attempts to register an existing reward token again.
    error RewardAlreadyAdded(address token);
    /// @notice Raised for a zero address dependency, account, or token.
    error ZeroAddress();
    /// @notice Raised for a zero signal mutation.
    error ZeroAmount();

    /// @dev Restricts virtual-balance and reward-token administration to the immutable Resonance.
    modifier onlyResonance() {
        if (msg.sender != resonance) revert NotResonance(msg.sender);
        _;
    }

    /// @notice Creates a bounded reward stream controlled by one Resonance.
    /// @param resonance_ Resonance exclusively authorized to maintain virtual balances.
    constructor(address resonance_) {
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();
        resonance = resonance_;
    }

    /// @notice Claims every registered reward token earned by `account`.
    /// @dev A broken reward token reverts this convenience path; the scalar claim remains independent.
    /// @param account Account whose accrued rewards are paid.
    function claimRewards(address account) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        _updateAllRewards(account);

        uint256 count = _rewardTokens.length;
        for (uint256 i; i < count; ++i) {
            _claim(account, _rewardTokens[i]);
        }
    }

    /// @notice Claims one registered reward token for `account` without touching any other reward token.
    /// @dev Anyone may trigger the claim, but payment can only reach the entitled account.
    /// @param account Entitled account.
    /// @param rewardToken Registered token to claim.
    /// @return amount Amount paid.
    function claimReward(address account, address rewardToken) external nonReentrant returns (uint256 amount) {
        if (account == address(0)) revert ZeroAddress();
        _requireRewardToken(rewardToken);
        _updateReward(account, rewardToken);
        amount = _claim(account, rewardToken);
    }

    /// @notice Funds and restarts a seven-day reward stream using the standard leftover-rollover model.
    /// @dev Permissionless funding must be at least one duration in raw units and at least the active reward remaining.
    /// @param rewardToken Registered token to fund.
    /// @param amount Amount pulled from the caller.
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

    /// @notice Adds virtual signal weight for `account` after checkpointing all registered rewards.
    /// @param account Account whose virtual balance increases.
    /// @param amount Weight to add.
    function addSignalWeight(address account, uint256 amount) external onlyResonance {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        _updateAllRewards(account);
        totalSignalWeight += amount;
        signalWeightOf[account] += amount;

        emit SignalWeightAdded(account, amount);
    }

    /// @notice Removes virtual signal weight for `account` after checkpointing all registered rewards.
    /// @param account Account whose virtual balance decreases.
    /// @param amount Weight to remove.
    function removeSignalWeight(address account, uint256 amount) external onlyResonance {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        _updateAllRewards(account);
        totalSignalWeight -= amount;
        signalWeightOf[account] -= amount;

        emit SignalWeightRemoved(account, amount);
    }

    /// @notice Registers another append-only reward token through Resonance governance.
    /// @param rewardToken Token to register.
    function addRewardToken(address rewardToken) external onlyResonance {
        if (rewardToken == address(0) || rewardToken.code.length == 0) revert ZeroAddress();
        if (isRewardToken[rewardToken]) revert RewardAlreadyAdded(rewardToken);
        if (_rewardTokens.length == MAX_REWARD_TOKENS) revert RewardTokenLimitReached(MAX_REWARD_TOKENS);

        isRewardToken[rewardToken] = true;
        _rewardTokens.push(rewardToken);

        emit RewardTokenAdded(rewardToken);
    }

    /// @notice Returns all registered reward tokens in immutable insertion order.
    function rewardTokens() external view returns (address[] memory tokens) {
        return _rewardTokens;
    }

    /// @notice Returns whole reward units remaining in the active stream.
    function remainingReward(address rewardToken) public view returns (uint256 amount) {
        RewardData storage data = rewardData[rewardToken];
        if (block.timestamp >= data.periodFinish) return 0;
        return (data.periodFinish - block.timestamp) * data.rewardRate;
    }

    /// @notice Returns the cumulative reward per virtual signal unit.
    function rewardPerSignal(address rewardToken) public view returns (uint256 accumulatedReward) {
        RewardData storage data = rewardData[rewardToken];
        uint256 signalWeight = totalSignalWeight;
        if (signalWeight == 0) return data.rewardPerSignalStored;

        uint256 elapsed = _lastApplicableRewardTime(rewardToken) - data.lastUpdateTime;
        return data.rewardPerSignalStored + Math.mulDiv(elapsed * data.rewardRate, REWARD_PRECISION, signalWeight);
    }

    /// @notice Returns whole rewards currently claimable by one account for one token.
    function earned(address account, address rewardToken) public view returns (uint256 amount) {
        uint256 rewardDelta = rewardPerSignal(rewardToken) - accountRewardPerSignalPaid[account][rewardToken];
        return rewards[account][rewardToken] + Math.mulDiv(signalWeightOf[account], rewardDelta, REWARD_PRECISION);
    }

    /// @notice Advances every registered reward stream and checkpoints `account` when nonzero.
    function _updateAllRewards(address account) private {
        uint256 count = _rewardTokens.length;
        for (uint256 i; i < count; ++i) {
            _updateReward(account, _rewardTokens[i]);
        }
    }

    /// @notice Advances one reward stream and checkpoints `account` when nonzero.
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

    /// @notice Consumes and pays one account's whole-token reward after recording effects.
    function _claim(address account, address rewardToken) private returns (uint256 amount) {
        amount = rewards[account][rewardToken];
        if (amount == 0) return 0;

        rewards[account][rewardToken] = 0;
        IERC20(rewardToken).safeTransfer(account, amount);

        emit RewardPaid(account, rewardToken, amount);
    }

    /// @notice Reverts unless `rewardToken` is in the append-only registry.
    function _requireRewardToken(address rewardToken) private view {
        if (!isRewardToken[rewardToken]) revert NotRewardToken(rewardToken);
    }

    /// @notice Returns the last timestamp currently eligible to advance one reward stream.
    function _lastApplicableRewardTime(address rewardToken) private view returns (uint256 timestamp) {
        return Math.min(block.timestamp, rewardData[rewardToken].periodFinish);
    }
}
