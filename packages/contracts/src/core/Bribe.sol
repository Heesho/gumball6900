// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ICoreResonance } from "./interfaces/ICoreResonance.sol";

/**
 * @title GumBall6900 Multi-Token Strategy Reward Stream
 * @author Heesho
 * @notice Streams up to eight independently registered reward assets to holders signaling one Strategy.
 * @dev Exact stream remainders, zero-supply pausing, selective claims, and fixed Fund liabilities preserve every
 *      supported-token unit while keeping signal entry and exit loops permanently bounded.
 * @custom:version 1.0.0
 */
contract Bribe is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Independent scheduling and cumulative-index state for one registered reward token.
    /// @param periodFinish Exclusive timestamp at which the active seven-day stream ends.
    /// @param remainderFinish Exclusive timestamp through which the stream emits one unit above its base rate.
    /// @param rewardRate Base whole-token emission per second.
    /// @param lastUpdateTime Last active-stream timestamp incorporated into stored accounting.
    /// @param rewardPerTokenStored Cumulative scaled reward allocated per virtual signal unit.
    /// @param pauseStarted Timestamp at which a zero-supply pause began, or zero while running.
    struct RewardData {
        uint256 periodFinish;
        uint256 remainderFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
        uint256 pauseStarted;
    }

    /// @notice Fixed duration assigned to each independently started reward stream.
    uint256 public constant REWARD_DURATION = 7 days;
    /// @notice Fixed-point scale used to preserve sub-token reward allocation across checkpoints.
    uint256 public constant REWARD_PRECISION = 1e18;
    /// @notice Maximum cumulative raw units one reward token may notify over this Bribe's lifetime.
    uint256 public constant MAX_LIFETIME_REWARD_AMOUNT = type(uint256).max / REWARD_PRECISION;
    /// @notice Immutable upper bound on append-only reward tokens and every mandatory reward loop.
    uint256 public constant MAX_REWARD_TOKENS = 8;

    /// @notice Resonance exclusively authorized to maintain virtual balances and register reward assets.
    address public immutable resonance;
    /// @notice Fixed treasury destination derived once from Resonance for rounding liabilities that outlive all signalers.
    address public immutable fund;

    /// @notice Total virtual signal weight assigned to this Bribe.
    uint256 public totalSupply;
    /// @notice Virtual signal weight assigned to each account by Resonance.
    mapping(address account => uint256 balance) public balanceOf;

    address[] private _rewardTokens;
    /// @notice Append-only membership flag for tokens governance registered through Resonance.
    mapping(address token => bool isReward) public isRewardToken;
    /// @notice Independent exact stream state for every registered reward token.
    mapping(address token => RewardData data) public rewardData;
    /// @notice Cumulative reward index already incorporated for one account and token.
    mapping(address account => mapping(address token => uint256 paid)) public userRewardPerTokenPaid;
    /// @notice Whole-token accrued user liability, payable only to the entitled account.
    mapping(address account => mapping(address token => uint256 amount)) public rewards;
    /// @notice Sub-token scaled user accrual retained across checkpoints instead of rounded away.
    mapping(address account => mapping(address token => uint256 scaledRemainder)) public userRewardRemainder;

    /// @notice Active-stream whole-token amount not yet moved into scaled reward allocation.
    mapping(address token => uint256 amount) public scheduledRewards;
    /// @notice Whole-token notifications waiting for the current stream to finish or for signal supply to become nonzero.
    mapping(address token => uint256 amount) public queuedRewards;
    /// @notice Emitted reward precision not yet large enough for another reward-per-token increment.
    mapping(address token => uint256 scaledAmount) public pendingRewardScaled;
    /// @notice Reward precision allocated globally but not yet checkpointed into individual account state.
    mapping(address token => uint256 scaledAmount) public indexedRewardScaled;
    /// @notice Aggregate whole-token user liability represented by `rewards` for each token.
    mapping(address token => uint256 amount) public accruedRewardLiability;
    /// @notice Whole-token reward liability irrevocably owed to the immutable Fund.
    mapping(address token => uint256 amount) public fundRewardLiability;
    /// @notice Sub-token Fund precision carried until it combines into another payable whole unit.
    mapping(address token => uint256 scaledRemainder) public fundRewardRemainder;
    /// @notice Exact supported-token balance notified minus completed user and Fund payouts.
    mapping(address token => uint256 amount) public accountedRewardBalance;
    /// @notice Monotonic cumulative raw units admitted through notifications for each reward token.
    mapping(address token => uint256 amount) public lifetimeRewardNotified;

    /// @notice Emitted when Resonance appends one supported reward token.
    /// @param rewardToken Newly registered reward token.
    event RewardAdded(address indexed rewardToken);
    /// @notice Emitted when a caller funds a registered reward token.
    /// @param rewardToken Token funded.
    /// @param amount Exact amount pulled from the caller.
    event RewardNotified(address indexed rewardToken, uint256 amount);
    /// @notice Emitted when a notification waits behind a live stream or zero supply.
    /// @param rewardToken Token queued.
    /// @param amount Newly queued amount.
    /// @param totalQueued Complete queue after the notification.
    event RewardQueued(address indexed rewardToken, uint256 amount, uint256 totalQueued);
    /// @notice Emitted when an exact seven-day stream begins.
    /// @param rewardToken Token being streamed.
    /// @param amount Exact scheduled amount.
    /// @param startedAt Inclusive stream start.
    /// @param periodFinish Exclusive stream finish.
    /// @param rewardRate Base emission per second.
    /// @param rateRemainder Number of initial stream seconds that emit one additional unit.
    event RewardStreamStarted(
        address indexed rewardToken,
        uint256 amount,
        uint256 startedAt,
        uint256 periodFinish,
        uint256 rewardRate,
        uint256 rateRemainder
    );
    /// @notice Emitted when zero virtual supply pauses a running stream.
    /// @param rewardToken Token whose schedule paused.
    /// @param pausedAt Pause timestamp.
    event RewardStreamPaused(address indexed rewardToken, uint256 pausedAt);
    /// @notice Emitted when signal supply resumes a paused stream without counting the zero-supply interval.
    /// @param rewardToken Token whose schedule resumed.
    /// @param resumedAt Resume timestamp.
    /// @param pausedDuration Duration added to the stream boundaries.
    event RewardStreamResumed(address indexed rewardToken, uint256 resumedAt, uint256 pausedDuration);
    /// @notice Emitted when accrued rewards are paid to their entitled account.
    /// @param account Account that received the rewards.
    /// @param rewardToken Token paid.
    /// @param amount Exact amount paid.
    event RewardPaid(address indexed account, address indexed rewardToken, uint256 amount);
    /// @notice Emitted when old-denominator or exiting-account precision becomes fixed Fund classification.
    /// @param rewardToken Token whose carry is reclassified.
    /// @param amountScaled Scaled precision assigned by this operation.
    /// @param remainderScaled Complete sub-token Fund remainder afterward.
    event RewardCarryFunded(address indexed rewardToken, uint256 amountScaled, uint256 remainderScaled);
    /// @notice Emitted when aggregate sub-unit carry becomes a fixed Fund entitlement.
    /// @param rewardToken Token owed to Fund.
    /// @param amount Newly payable whole-token amount.
    /// @param totalLiability Complete whole-token Fund liability.
    event FundRewardAccrued(address indexed rewardToken, uint256 amount, uint256 totalLiability);
    /// @notice Emitted after a caller pays a token's complete fixed-destination Fund liability.
    /// @param caller Account that triggered payment.
    /// @param fund Immutable Fund receiver.
    /// @param rewardToken Token paid.
    /// @param amount Exact amount paid.
    event FundRewardPaid(address indexed caller, address indexed fund, address indexed rewardToken, uint256 amount);
    /// @notice Emitted when Resonance adds virtual signal weight.
    /// @param account Account whose virtual balance increased.
    /// @param amount Weight added.
    event SignalWeightDeposited(address indexed account, uint256 amount);
    /// @notice Emitted when Resonance removes virtual signal weight.
    /// @param account Account whose virtual balance decreased.
    /// @param amount Weight removed.
    event SignalWeightWithdrawn(address indexed account, uint256 amount);

    /// @notice Raised when a selective claim repeats a reward token.
    /// @param token Repeated token.
    error DuplicateRewardToken(address token);
    /// @notice Raised when an incoming notification does not debit and credit the exact requested amount.
    /// @param expected Requested amount.
    /// @param senderDebit Observed notifier debit.
    /// @param receiverCredit Observed Bribe credit.
    error InexactRewardTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    /// @notice Raised when an outgoing supported-token transfer has an inexact debit or credit.
    /// @param receiver Fixed entitled receiver.
    /// @param expected Requested amount.
    /// @param senderDebit Observed Bribe debit.
    /// @param receiverCredit Observed receiver credit.
    error InexactRewardPayout(address receiver, uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    /// @notice Raised when a token is not in the append-only reward registry.
    /// @param token Rejected token.
    error NotRewardToken(address token);
    /// @notice Raised when a virtual-balance or registry call does not originate from Resonance.
    /// @param caller Unauthorized caller.
    error NotResonance(address caller);
    /// @notice Raised before a ninth reward token can change state.
    /// @param maximum Immutable token limit.
    error RewardTokenLimitReached(uint256 maximum);
    /// @notice Raised when governance attempts to register an existing reward token again.
    /// @param token Existing token.
    error RewardAlreadyAdded(address token);
    /// @notice Raised when a supported token balance falls below recorded liabilities.
    /// @param token Deficit token.
    /// @param accounted Recorded supported-token balance.
    /// @param actual Observed balance.
    error RewardBalanceDeficit(address token, uint256 accounted, uint256 actual);
    /// @notice Raised when a token balance cannot be represented at `REWARD_PRECISION` without overflow.
    /// @param token Oversized token balance.
    /// @param balance Observed balance.
    error RewardScaleOverflow(address token, uint256 balance);
    /// @notice Raised before cumulative notifications can exhaust the reward index's numeric range.
    /// @param token Reward token whose immutable lifetime cap would be exceeded.
    /// @param notified Cumulative raw units already admitted.
    /// @param requested Additional raw units requested by this notification.
    /// @param maximum Immutable cumulative raw-unit limit.
    error RewardLifetimeCapExceeded(address token, uint256 notified, uint256 requested, uint256 maximum);
    /// @notice Raised for a zero address dependency, account, or token.
    error ZeroAddress();
    /// @notice Raised for a zero signal mutation or reward notification.
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
        address fund_ = ICoreResonance(resonance_).fund();
        if (fund_ == address(0) || fund_.code.length == 0) revert ZeroAddress();

        resonance = resonance_;
        fund = fund_;
    }

    /// @notice Claims every registered reward token earned by `account`.
    /// @dev This bounded convenience path may fail on a broken selected token; scalar claims remain independent.
    /// @param account Account whose accrued rewards are paid.
    function claimRewards(address account) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        _checkpointAll(account);

        uint256 count = _rewardTokens.length;
        for (uint256 i; i < count; ++i) {
            _claim(account, _rewardTokens[i]);
        }
    }

    /// @notice Claims one registered reward token for `account` without touching any other reward token.
    /// @dev Anyone may trigger the claim, but payment can only reach the entitled account.
    /// @param account Entitled account.
    /// @param rewardToken Registered token to claim.
    /// @return amount Exact amount paid.
    function claimReward(address account, address rewardToken) external nonReentrant returns (uint256 amount) {
        if (account == address(0)) revert ZeroAddress();
        _requireRewardToken(rewardToken);
        _checkpointToken(rewardToken);
        _checkpointAccount(account, rewardToken);
        amount = _claim(account, rewardToken);
    }

    /// @notice Claims a caller-selected bounded set of reward tokens for `account`.
    /// @dev Duplicate or unregistered selections revert deterministically before any token interaction.
    /// @param account Entitled account.
    /// @param rewardTokens_ Registered unique tokens to claim.
    function claimRewards(address account, address[] calldata rewardTokens_) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        uint256 count = rewardTokens_.length;
        for (uint256 i; i < count; ++i) {
            address token = rewardTokens_[i];
            _requireRewardToken(token);
            for (uint256 j; j < i; ++j) {
                if (rewardTokens_[j] == token) revert DuplicateRewardToken(token);
            }
        }

        for (uint256 i; i < count; ++i) {
            address token = rewardTokens_[i];
            _checkpointToken(token);
            _checkpointAccount(account, token);
            _claim(account, token);
        }
    }

    /// @notice Funds an exact seven-day stream or queues behind the currently active stream.
    /// @dev Live-stream notifications never restart or extend existing rewards, preventing repeated tiny top-up griefing.
    /// @param rewardToken Registered token to fund.
    /// @param amount Exact amount pulled from the caller.
    function notifyRewardAmount(address rewardToken, uint256 amount) external nonReentrant {
        _requireRewardToken(rewardToken);
        if (amount == 0) revert ZeroAmount();

        uint256 notified = lifetimeRewardNotified[rewardToken];
        uint256 maximum = MAX_LIFETIME_REWARD_AMOUNT;
        if (amount > maximum - notified) {
            revert RewardLifetimeCapExceeded(rewardToken, notified, amount, maximum);
        }

        _checkpointToken(rewardToken);
        lifetimeRewardNotified[rewardToken] = notified + amount;

        IERC20 token = IERC20(rewardToken);
        uint256 senderBalanceBefore = token.balanceOf(msg.sender);
        uint256 receiverBalanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 senderDebit = senderBalanceBefore - token.balanceOf(msg.sender);
        uint256 receiverCredit = token.balanceOf(address(this)) - receiverBalanceBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactRewardTransfer(amount, senderDebit, receiverCredit);
        }

        accountedRewardBalance[rewardToken] += amount;
        _requireScalableBalance(rewardToken);
        emit RewardNotified(rewardToken, amount);

        RewardData storage data = rewardData[rewardToken];
        if (totalSupply == 0 || data.periodFinish != 0) {
            queuedRewards[rewardToken] += amount;
            emit RewardQueued(rewardToken, amount, queuedRewards[rewardToken]);
            return;
        }

        _startStream(rewardToken, amount, block.timestamp);
    }

    /// @notice Adds virtual signal weight for `account` after checkpointing all bounded reward state.
    /// @param amount Weight to add.
    /// @param account Account whose virtual balance increases.
    function deposit(uint256 amount, address account) external nonReentrant onlyResonance {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        bool wasZero = totalSupply == 0;
        _checkpointAll(account);
        _fundAllPendingRewards();

        totalSupply += amount;
        balanceOf[account] += amount;

        if (wasZero) {
            _resumeAllStreams();
        }

        emit SignalWeightDeposited(account, amount);
    }

    /// @notice Removes virtual signal weight after accounting only; no reward token is called or transferred.
    /// @param amount Weight to remove.
    /// @param account Account whose virtual balance decreases.
    function withdraw(uint256 amount, address account) external nonReentrant onlyResonance {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        _checkpointAll(account);
        _fundAllPendingRewards();

        totalSupply -= amount;
        balanceOf[account] -= amount;

        uint256 count = _rewardTokens.length;
        if (balanceOf[account] == 0) {
            for (uint256 i; i < count; ++i) {
                address token = _rewardTokens[i];
                _accrueFundScaled(token, userRewardRemainder[account][token]);
                delete userRewardRemainder[account][token];
            }
        }

        if (totalSupply == 0) {
            for (uint256 i; i < count; ++i) {
                address token = _rewardTokens[i];
                _movePendingToFund(token);
                _pauseStream(token);
            }
        }

        emit SignalWeightWithdrawn(account, amount);
    }

    /// @notice Registers another append-only reward token through Resonance governance.
    /// @param rewardToken Token to register.
    function addRewardToken(address rewardToken) external onlyResonance {
        if (rewardToken == address(0) || rewardToken.code.length == 0) revert ZeroAddress();
        if (isRewardToken[rewardToken]) revert RewardAlreadyAdded(rewardToken);
        if (_rewardTokens.length == MAX_REWARD_TOKENS) revert RewardTokenLimitReached(MAX_REWARD_TOKENS);

        isRewardToken[rewardToken] = true;
        _rewardTokens.push(rewardToken);

        emit RewardAdded(rewardToken);
    }

    /// @notice Pays one token's whole Fund-bound liability to the immutable Fund.
    /// @dev State clears before interaction; a failed token transfer atomically restores the complete liability.
    /// @param rewardToken Registered reward token to pay.
    /// @return amount Exact amount paid.
    function payFundReward(address rewardToken) external nonReentrant returns (uint256 amount) {
        _requireRewardToken(rewardToken);
        amount = fundRewardLiability[rewardToken];
        if (amount == 0) return 0;

        fundRewardLiability[rewardToken] = 0;
        accountedRewardBalance[rewardToken] -= amount;
        _transferRewardExact(rewardToken, fund, amount);

        emit FundRewardPaid(msg.sender, fund, rewardToken, amount);
    }

    /// @notice Returns all registered reward tokens in immutable insertion order.
    /// @return tokens Registered reward tokens.
    function rewardTokens() external view returns (address[] memory tokens) {
        return _rewardTokens;
    }

    /// @notice Returns exact whole tokens remaining in the active stream, excluding its independent queue.
    /// @param rewardToken Token whose active schedule is queried.
    /// @return amount Remaining active-stream amount.
    function left(address rewardToken) public view returns (uint256 amount) {
        RewardData storage data = rewardData[rewardToken];
        amount = scheduledRewards[rewardToken];
        if (amount == 0 || data.periodFinish == 0 || data.pauseStarted != 0) return amount;

        uint256 applicable = Math.min(block.timestamp, data.periodFinish);
        if (applicable <= data.lastUpdateTime) return amount;
        return amount - _emissionBetween(data, data.lastUpdateTime, applicable);
    }

    /// @notice Returns the last timestamp currently eligible to advance the active stream.
    /// @param rewardToken Token whose stream is queried.
    /// @return timestamp Active time capped at finish, or the pause timestamp while supply is zero.
    function lastTimeRewardApplicable(address rewardToken) public view returns (uint256 timestamp) {
        RewardData storage data = rewardData[rewardToken];
        if (data.periodFinish == 0) return data.lastUpdateTime;
        if (data.pauseStarted != 0) return data.pauseStarted;
        return Math.min(block.timestamp, data.periodFinish);
    }

    /// @notice Returns the exact previewed cumulative reward per virtual signal unit.
    /// @param rewardToken Token whose cumulative index is queried.
    /// @return accumulatedReward Cumulative reward per weight scaled by `REWARD_PRECISION`.
    function rewardPerToken(address rewardToken) public view returns (uint256 accumulatedReward) {
        RewardData storage data = rewardData[rewardToken];
        accumulatedReward = data.rewardPerTokenStored;
        uint256 supply = totalSupply;
        if (supply == 0) return accumulatedReward;

        uint256 emitted = _previewEmission(rewardToken);
        uint256 scaled = pendingRewardScaled[rewardToken] + emitted * REWARD_PRECISION;
        return accumulatedReward + scaled / supply;
    }

    /// @notice Returns whole rewards currently claimable by one account for one token.
    /// @param account Account whose rewards are queried.
    /// @param rewardToken Registered reward token.
    /// @return amount Whole-token accrued amount, including previewed stream progress.
    function earned(address account, address rewardToken) public view returns (uint256 amount) {
        uint256 rewardDelta = rewardPerToken(rewardToken) - userRewardPerTokenPaid[account][rewardToken];
        uint256 scaled = userRewardRemainder[account][rewardToken] + balanceOf[account] * rewardDelta;
        uint256 supply = totalSupply;
        if (supply != 0 && balanceOf[account] == supply) {
            uint256 globalScaled = pendingRewardScaled[rewardToken] + _previewEmission(rewardToken) * REWARD_PRECISION;
            scaled += globalScaled % supply;
        }
        return rewards[account][rewardToken] + scaled / REWARD_PRECISION;
    }

    /// @notice Returns direct token balance not introduced through the notification accounting path.
    /// @dev Direct donation surplus is classified but intentionally unscheduled and has no privileged recovery path.
    /// @param rewardToken Token whose surplus is queried.
    /// @return amount Direct-donation surplus.
    function rewardSurplus(address rewardToken) external view returns (uint256 amount) {
        uint256 actual = IERC20(rewardToken).balanceOf(address(this));
        uint256 accounted = accountedRewardBalance[rewardToken];
        if (actual < accounted) revert RewardBalanceDeficit(rewardToken, accounted, actual);
        return actual - accounted;
    }

    /// @notice Advances every registered stream and checkpoints `account` when nonzero.
    /// @param account Account to checkpoint, or zero for global stream state only.
    function _checkpointAll(address account) private {
        uint256 count = _rewardTokens.length;
        for (uint256 i; i < count; ++i) {
            address token = _rewardTokens[i];
            _checkpointToken(token);
            if (account != address(0)) _checkpointAccount(account, token);
        }
    }

    /// @notice Advances one token through at most its current stream and one queued successor stream.
    /// @param rewardToken Registered token to advance.
    function _checkpointToken(address rewardToken) private {
        uint256 supply = totalSupply;
        if (supply == 0) return;

        RewardData storage data = rewardData[rewardToken];
        if (data.pauseStarted != 0) return;

        if (data.periodFinish == 0) {
            uint256 queued = queuedRewards[rewardToken];
            if (queued != 0) {
                queuedRewards[rewardToken] = 0;
                _startStream(rewardToken, queued, block.timestamp);
            }
        }

        if (data.periodFinish != 0) {
            uint256 firstFinish = data.periodFinish;
            _accrueUntil(rewardToken, Math.min(block.timestamp, firstFinish));
            if (block.timestamp >= firstFinish) {
                _clearFinishedStream(data);
                uint256 queued = queuedRewards[rewardToken];
                if (queued != 0) {
                    queuedRewards[rewardToken] = 0;
                    _startStream(rewardToken, queued, firstFinish);
                    uint256 secondFinish = data.periodFinish;
                    _accrueUntil(rewardToken, Math.min(block.timestamp, secondFinish));
                    if (block.timestamp >= secondFinish) _clearFinishedStream(data);
                }
            }
        }

        _indexPendingReward(rewardToken);
    }

    /// @notice Converts one account's new scaled index allocation into whole liability plus retained sub-unit carry.
    /// @param account Account to checkpoint.
    /// @param rewardToken Registered token to checkpoint.
    function _checkpointAccount(address account, address rewardToken) private {
        RewardData storage data = rewardData[rewardToken];
        uint256 paid = userRewardPerTokenPaid[account][rewardToken];
        uint256 current = data.rewardPerTokenStored;
        userRewardPerTokenPaid[account][rewardToken] = current;

        uint256 newlyIndexedScaled = balanceOf[account] * (current - paid);
        if (newlyIndexedScaled != 0) indexedRewardScaled[rewardToken] -= newlyIndexedScaled;

        uint256 soleSignalerCarry = 0;
        uint256 accountBalance = balanceOf[account];
        if (accountBalance != 0 && accountBalance == totalSupply) {
            soleSignalerCarry = pendingRewardScaled[rewardToken];
            pendingRewardScaled[rewardToken] = 0;
        }

        uint256 accruedScaled = userRewardRemainder[account][rewardToken] + newlyIndexedScaled + soleSignalerCarry;
        uint256 whole = accruedScaled / REWARD_PRECISION;
        userRewardRemainder[account][rewardToken] = accruedScaled % REWARD_PRECISION;
        if (whole != 0) {
            rewards[account][rewardToken] += whole;
            accruedRewardLiability[rewardToken] += whole;
        }
    }

    /// @notice Starts one exact stream, assigning the division remainder to its earliest seconds.
    /// @param rewardToken Registered token to stream.
    /// @param amount Exact whole-token schedule.
    /// @param startedAt Inclusive start timestamp.
    function _startStream(address rewardToken, uint256 amount, uint256 startedAt) private {
        RewardData storage data = rewardData[rewardToken];
        uint256 rate = amount / REWARD_DURATION;
        uint256 remainder = amount % REWARD_DURATION;

        data.periodFinish = startedAt + REWARD_DURATION;
        data.remainderFinish = startedAt + remainder;
        data.rewardRate = rate;
        data.lastUpdateTime = startedAt;
        data.pauseStarted = 0;
        scheduledRewards[rewardToken] = amount;

        emit RewardStreamStarted(rewardToken, amount, startedAt, data.periodFinish, data.rewardRate, remainder);
    }

    /// @notice Moves active emission through `timestamp` into exact scaled allocation carry.
    /// @param rewardToken Token whose active stream advances.
    /// @param timestamp Active timestamp not beyond the stream finish.
    function _accrueUntil(address rewardToken, uint256 timestamp) private {
        RewardData storage data = rewardData[rewardToken];
        uint256 from = data.lastUpdateTime;
        if (timestamp <= from) return;

        uint256 emitted = _emissionBetween(data, from, timestamp);
        data.lastUpdateTime = timestamp;
        scheduledRewards[rewardToken] -= emitted;
        pendingRewardScaled[rewardToken] += emitted * REWARD_PRECISION;
    }

    /// @notice Indexes as much scaled emitted reward as the current virtual supply permits.
    /// @param rewardToken Token whose carry is indexed.
    function _indexPendingReward(address rewardToken) private {
        uint256 supply = totalSupply;
        if (supply == 0) return;
        uint256 delta = pendingRewardScaled[rewardToken] / supply;
        if (delta == 0) return;

        uint256 indexedScaled = delta * supply;
        pendingRewardScaled[rewardToken] -= indexedScaled;
        indexedRewardScaled[rewardToken] += indexedScaled;
        rewardData[rewardToken].rewardPerTokenStored += delta;
    }

    /// @notice Fixes all old-denominator carry to Fund before virtual signal supply changes.
    function _fundAllPendingRewards() private {
        uint256 count = _rewardTokens.length;
        for (uint256 i; i < count; ++i) {
            _movePendingToFund(_rewardTokens[i]);
        }
    }

    /// @notice Pauses one active stream when all virtual signal supply has exited.
    /// @param rewardToken Token whose active time pauses.
    function _pauseStream(address rewardToken) private {
        RewardData storage data = rewardData[rewardToken];
        if (data.periodFinish == 0 || data.pauseStarted != 0) return;
        data.pauseStarted = block.timestamp;
        emit RewardStreamPaused(rewardToken, block.timestamp);
    }

    /// @notice Resumes all paused streams and starts zero-supply queues only after signal supply exists.
    function _resumeAllStreams() private {
        uint256 count = _rewardTokens.length;
        for (uint256 i; i < count; ++i) {
            address token = _rewardTokens[i];
            RewardData storage data = rewardData[token];
            uint256 pausedAt = data.pauseStarted;
            if (pausedAt != 0) {
                uint256 pausedDuration = block.timestamp - pausedAt;
                data.periodFinish += pausedDuration;
                data.remainderFinish += pausedDuration;
                data.lastUpdateTime += pausedDuration;
                data.pauseStarted = 0;
                emit RewardStreamResumed(token, block.timestamp, pausedDuration);
            } else if (data.periodFinish == 0) {
                uint256 queued = queuedRewards[token];
                if (queued != 0) {
                    queuedRewards[token] = 0;
                    _startStream(token, queued, block.timestamp);
                }
            }
        }
    }

    /// @notice Converts unattributable aggregate sub-unit carry into a fixed Fund destination.
    /// @param rewardToken Token whose carry is reclassified.
    function _movePendingToFund(address rewardToken) private {
        uint256 scaled = pendingRewardScaled[rewardToken];
        pendingRewardScaled[rewardToken] = 0;

        _accrueFundScaled(rewardToken, scaled);
    }

    /// @notice Adds scaled precision to the Fund's fixed reward classification.
    /// @param rewardToken Token whose Fund entitlement increases.
    /// @param scaledAmount Scaled precision to classify.
    function _accrueFundScaled(address rewardToken, uint256 scaledAmount) private {
        uint256 scaled = fundRewardRemainder[rewardToken] + scaledAmount;

        uint256 whole = scaled / REWARD_PRECISION;
        fundRewardRemainder[rewardToken] = scaled % REWARD_PRECISION;
        if (scaledAmount != 0) {
            emit RewardCarryFunded(rewardToken, scaledAmount, fundRewardRemainder[rewardToken]);
        }
        if (whole != 0) {
            fundRewardLiability[rewardToken] += whole;
            emit FundRewardAccrued(rewardToken, whole, fundRewardLiability[rewardToken]);
        }
    }

    /// @notice Consumes and pays one account's whole-token liability after all effects are recorded.
    /// @param account Fixed entitled receiver.
    /// @param rewardToken Registered token to pay.
    /// @return amount Exact amount paid.
    function _claim(address account, address rewardToken) private returns (uint256 amount) {
        amount = rewards[account][rewardToken];
        if (amount == 0) return 0;

        rewards[account][rewardToken] = 0;
        accruedRewardLiability[rewardToken] -= amount;
        accountedRewardBalance[rewardToken] -= amount;
        _transferRewardExact(rewardToken, account, amount);

        emit RewardPaid(account, rewardToken, amount);
    }

    /// @notice Transfers a supported reward token with exact Bribe debit and receiver credit checks.
    /// @param rewardToken Token to transfer.
    /// @param receiver Fixed entitled account or Fund.
    /// @param amount Exact amount to transfer.
    function _transferRewardExact(address rewardToken, address receiver, uint256 amount) private {
        IERC20 token = IERC20(rewardToken);
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 receiverBefore = token.balanceOf(receiver);
        token.safeTransfer(receiver, amount);
        uint256 senderDebit = senderBefore - token.balanceOf(address(this));
        uint256 receiverCredit = token.balanceOf(receiver) - receiverBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactRewardPayout(receiver, amount, senderDebit, receiverCredit);
        }
    }

    /// @notice Returns emission over `[from, to)` for the currently stored exact stream.
    /// @param data Active stream data.
    /// @param from Inclusive timestamp.
    /// @param to Exclusive timestamp.
    /// @return amount Exact whole-token emission.
    function _emissionBetween(RewardData storage data, uint256 from, uint256 to) private view returns (uint256 amount) {
        amount = (to - from) * data.rewardRate;
        uint256 remainderFinish = data.remainderFinish;
        if (from < remainderFinish) amount += Math.min(to, remainderFinish) - from;
    }

    /// @notice Previews at most the active stream and its single aggregate queued successor.
    /// @param rewardToken Token whose emission is previewed.
    /// @return amount Whole-token emission not yet checkpointed.
    function _previewEmission(address rewardToken) private view returns (uint256 amount) {
        RewardData storage data = rewardData[rewardToken];
        if (data.pauseStarted != 0) return 0;

        uint256 finish = data.periodFinish;
        if (finish == 0) return 0;

        uint256 applicable = Math.min(block.timestamp, finish);
        if (applicable > data.lastUpdateTime) {
            amount = _emissionBetween(data, data.lastUpdateTime, applicable);
        }

        if (block.timestamp > finish) {
            uint256 queued = queuedRewards[rewardToken];
            if (queued != 0) amount += _previewFreshStream(queued, finish, block.timestamp);
        }
    }

    /// @notice Previews a fresh exact stream without copying production state-transition control flow.
    /// @param amount Exact stream amount.
    /// @param startedAt Inclusive start.
    /// @param timestamp Timestamp through which to preview.
    /// @return emitted Exact emission through the capped timestamp.
    function _previewFreshStream(uint256 amount, uint256 startedAt, uint256 timestamp)
        private
        pure
        returns (uint256 emitted)
    {
        uint256 elapsed = Math.min(timestamp - startedAt, REWARD_DURATION);
        emitted = elapsed * (amount / REWARD_DURATION) + Math.min(elapsed, amount % REWARD_DURATION);
    }

    /// @notice Clears completed scheduling fields while preserving the cumulative reward index.
    /// @param data Completed stream data.
    function _clearFinishedStream(RewardData storage data) private {
        data.periodFinish = 0;
        data.remainderFinish = 0;
        data.rewardRate = 0;
        data.pauseStarted = 0;
    }

    /// @notice Reverts unless `rewardToken` is in the append-only registry.
    /// @param rewardToken Token to validate.
    function _requireRewardToken(address rewardToken) private view {
        if (!isRewardToken[rewardToken]) revert NotRewardToken(rewardToken);
    }

    /// @notice Rejects balances whose exact precision representation cannot fit one accounting word.
    /// @param rewardToken Token whose accounted balance is checked.
    function _requireScalableBalance(address rewardToken) private view {
        uint256 balance = accountedRewardBalance[rewardToken];
        if (balance > type(uint256).max / REWARD_PRECISION) revert RewardScaleOverflow(rewardToken, balance);
    }
}
