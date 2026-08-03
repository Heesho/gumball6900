// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IAllocationVoterRewards } from "../interfaces/IAllocationVoterRewards.sol";
import { IEligibilityModule } from "../interfaces/IEligibilityModule.sol";
import { IManagerRewards } from "../interfaces/IManagerRewards.sol";

/// @title ManagerRewards
/// @notice High-precision accumulator for one strategy and exactly one acquired-asset reward token.
/// @dev Only the associated AcquisitionStrategy may notify rewards. Third-party bribes are not accepted or indexed.
contract ManagerRewards is IManagerRewards, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Fixed-point precision used by reward-per-weight and fractional remainder accounting.
    uint256 public constant REWARD_PRECISION = 1e27;

    error ManagerRewards__IneligibleReceiver(address receiver);
    /// @notice Reverts when voter and reward-accumulator strategy generations do not advance consecutively.
    /// @param expected The generation expected by ManagerRewards.
    /// @param actual The generation supplied by AllocationVoter.
    error ManagerRewards__InvalidGeneration(uint64 expected, uint64 actual);
    error ManagerRewards__InsufficientUnaccountedReward(uint256 notified, uint256 unaccounted);
    error ManagerRewards__NotAllocationVoter(address caller);
    error ManagerRewards__NotStrategy(address caller);
    /// @notice Reverts when a terminal-dust cycle has no queued vault liability.
    /// @param generation The requested reward generation.
    /// @param remainderCycle The requested fractional-remainder cycle.
    error ManagerRewards__NoPendingTerminalDust(uint64 generation, uint64 remainderCycle);
    /// @notice Reverts when a natural terminal settlement is attempted while live manager weight remains.
    error ManagerRewards__NonZeroStrategyWeight(uint256 strategyWeight);
    /// @notice Reverts when a reward transfer removes a non-exact amount from this accumulator.
    /// @param expected The nominal amount removed from reward liabilities.
    /// @param observed The actual balance decrease observed at this accumulator.
    error ManagerRewards__ObservedDebitMismatch(uint256 expected, uint256 observed);
    /// @notice Reverts when a reward transfer delivers less or more than the exact accounted amount.
    /// @param receiver The intended recipient whose balance was observed.
    /// @param expected The nominal amount removed from reward liabilities.
    /// @param observed The actual receiver balance increase observed during the transfer.
    error ManagerRewards__ObservedReceiptMismatch(address receiver, uint256 expected, uint256 observed);
    /// @notice Reverts if one generation/cycle terminal boundary is finalized more than once.
    /// @param generation The already-finalized reward generation.
    /// @param remainderCycle The already-finalized fractional-remainder cycle.
    error ManagerRewards__TerminalCycleAlreadyFinalized(uint64 generation, uint64 remainderCycle);
    /// @notice Reverts if canonical voter state would settle more stale weight than a closed generation retained.
    error ManagerRewards__UnsettledWeightUnderflow(uint64 generation, uint256 settling, uint256 remaining);
    error ManagerRewards__ZeroAddress();
    error ManagerRewards__ZeroAmount();

    event ManagerRewards__Claimed(address indexed user, address indexed receiver, uint256 amount);
    /// @notice Emitted when a strategy disable fixes the terminal index for one reward generation.
    /// @param closedGeneration The generation that can no longer receive new reward index increments.
    /// @param nextGeneration The consecutive generation reserved for any later strategy reactivation.
    /// @param endingRewardPerWeight The immutable terminal reward-per-weight index for the closed generation.
    event ManagerRewards__GenerationAdvanced(
        uint64 indexed closedGeneration, uint64 indexed nextGeneration, uint256 endingRewardPerWeight
    );
    event ManagerRewards__Notified(
        uint256 amount, uint256 strategyWeight, uint256 rewardPerWeightDelta, uint256 remainder
    );
    event ManagerRewards__ReceiverSet(address indexed user, address indexed receiver);
    event ManagerRewards__RedirectedToVault(uint256 amount);
    /// @notice Emitted when a fully checkpointed terminal reward cycle queues non-claimable dust for the vault.
    /// @param generation The strategy generation whose terminal cycle was finalized.
    /// @param remainderCycle The fractional-remainder cycle invalidated by this terminal boundary.
    /// @param amount The raw reward-token dust queued for GumBallVault.
    /// @param generationPendingAfter Pending terminal dust across this generation after the queue operation.
    /// @param totalPendingAfter Pending terminal dust across every generation after the queue operation.
    event ManagerRewards__TerminalDustQueued(
        uint64 indexed generation,
        uint64 indexed remainderCycle,
        uint256 amount,
        uint256 generationPendingAfter,
        uint256 totalPendingAfter
    );
    /// @notice Emitted only after one queued terminal reward cycle is delivered exactly to GumBallVault.
    /// @param generation The strategy generation whose terminal cycle was reconciled.
    /// @param remainderCycle The fractional-remainder cycle invalidated by this terminal boundary.
    /// @param amount The raw reward-token dust redirected to GumBallVault.
    /// @param accountedRewardsAfter Manager and pending-vault liabilities retained after the redirect.
    event ManagerRewards__TerminalDustSettled(
        uint64 indexed generation, uint64 indexed remainderCycle, uint256 amount, uint256 accountedRewardsAfter
    );
    event ManagerRewards__UserCheckpointed(address indexed user, uint256 activeWeight, uint256 accrued);

    /// @notice Target asset received from fills and paid to active managers.
    IERC20 public immutable REWARD_TOKEN;
    /// @notice Sole acquisition strategy permitted to deposit and notify rewards.
    address public immutable STRATEGY;
    /// @notice Canonical voter that supplies strategy and user active weights.
    IAllocationVoterRewards public immutable ALLOCATION_VOTER;
    /// @notice Canonical vault receiving notifications made while strategy weight is zero.
    address public immutable GUM_BALL_VAULT;
    /// @notice Immutable policy used to validate selected reward receivers.
    IEligibilityModule public immutable ELIGIBILITY_MODULE;

    /// @notice Cumulative raw reward entitlement per active strategy-weight unit, scaled by `REWARD_PRECISION`.
    uint256 public rewardPerWeightStored;
    /// @notice Scaled division remainder carried across reward notifications.
    uint256 public rewardRemainder;
    /// @notice Raw manager and pending-vault reward-token liability currently retained by this contract.
    uint256 public accountedRewards;
    /// @notice Aggregate unpaid whole-token entitlement across every manager and generation.
    uint256 public totalAccruedRewards;
    /// @notice Strategy generation currently permitted to accrue new reward-index increments.
    uint64 public currentGeneration;
    /// @notice Fractional-remainder cycle currently accruing inside the live strategy generation.
    uint64 public currentRemainderCycle;
    /// @notice Terminal reward index for each generation closed by a strategy disable.
    mapping(uint64 generation => uint256 endingIndex) public generationEndRewardPerWeight;
    /// @notice Whether a generation's terminal reward index has been fixed, including a legitimate zero index.
    mapping(uint64 generation => bool closed) public generationClosed;
    /// @notice Remainder cycle fixed at each administratively closed generation boundary.
    mapping(uint64 generation => uint64 cycle) public generationEndRemainderCycle;
    /// @notice Raw rewards notified while each strategy generation was live.
    mapping(uint64 generation => uint256 amount) public generationNotifiedRewards;
    /// @notice Cumulative whole-token entitlements materialized for each generation.
    mapping(uint64 generation => uint256 amount) public generationWholeEntitlements;
    /// @notice Cumulative terminal dust already redirected for each generation.
    mapping(uint64 generation => uint256 amount) public generationRedirectedDust;
    /// @notice Cumulative terminal dust finalized for each generation, whether pending or already redirected.
    mapping(uint64 generation => uint256 amount) public generationFinalizedTerminalDust;
    /// @notice Terminal dust still awaiting exact vault delivery for each generation.
    mapping(uint64 generation => uint256 amount) public generationPendingTerminalDust;
    /// @notice Terminal dust still awaiting exact vault delivery for each generation and remainder cycle.
    mapping(uint64 generation => mapping(uint64 remainderCycle => uint256 amount)) public pendingTerminalDust;
    /// @notice Whether a generation and remainder cycle has crossed its terminal accounting boundary.
    mapping(uint64 generation => mapping(uint64 remainderCycle => bool finalized)) public terminalCycleFinalized;
    /// @notice Aggregate terminal dust awaiting exact vault delivery across every generation and cycle.
    uint256 public totalPendingTerminalDust;
    /// @notice Closed-generation weight still requiring one final user checkpoint.
    mapping(uint64 generation => uint256 weight) public generationUnsettledWeight;
    /// @notice Whether a user's stored weight was reconciled against one closed generation.
    mapping(uint64 generation => mapping(address user => bool settled)) public generationUserSettled;

    /// @notice Last global reward index checkpointed for each manager.
    mapping(address user => uint256 paid) public userRewardPerWeightPaid;
    /// @notice Whole raw reward amount accrued and not yet claimed by each manager.
    mapping(address user => uint256 amount) public accruedRewards;
    /// @notice Scaled fractional reward remainder carried for each manager.
    mapping(address user => uint256 scaledRemainder) public userScaledRemainder;
    /// @notice Remainder cycle to which each manager's scaled fractional remainder belongs.
    mapping(address user => uint64 cycle) public userRemainderCycle;
    /// @notice Optional eligible reward receiver selected by each manager, or zero for self.
    mapping(address user => address receiver) public rewardReceiver;

    /// @notice Wires this accumulator permanently to one strategy, voter, token, vault, and eligibility policy.
    /// @param rewardToken_ The acquired target token paid to active managers.
    /// @param strategy_ The sole AcquisitionStrategy permitted to notify rewards.
    /// @param allocationVoter_ The canonical AllocationVoter that checkpoints user weights.
    /// @param gumBallVault_ The canonical vault that receives zero-weight rewards.
    /// @param eligibilityModule_ The immutable receiver eligibility policy.
    constructor(
        address rewardToken_,
        address strategy_,
        address allocationVoter_,
        address gumBallVault_,
        address eligibilityModule_
    ) {
        if (
            rewardToken_ == address(0) || strategy_ == address(0) || allocationVoter_ == address(0)
                || gumBallVault_ == address(0) || eligibilityModule_ == address(0)
        ) revert ManagerRewards__ZeroAddress();

        REWARD_TOKEN = IERC20(rewardToken_);
        STRATEGY = strategy_;
        ALLOCATION_VOTER = IAllocationVoterRewards(allocationVoter_);
        GUM_BALL_VAULT = gumBallVault_;
        ELIGIBILITY_MODULE = IEligibilityModule(eligibilityModule_);
    }

    /// @notice Accounts an observed reward-token deposit from the immutable strategy.
    /// @dev The strategy transfers tokens before calling. A zero-weight notification is sent directly to the vault.
    /// @param amount The raw reward-token amount already deposited by the strategy.
    function notifyReward(uint256 amount) external nonReentrant {
        if (msg.sender != STRATEGY) revert ManagerRewards__NotStrategy(msg.sender);
        if (amount == 0) revert ManagerRewards__ZeroAmount();

        uint256 physicalBalance = REWARD_TOKEN.balanceOf(address(this));
        uint256 unaccounted = physicalBalance - accountedRewards;
        if (amount > unaccounted) {
            revert ManagerRewards__InsufficientUnaccountedReward(amount, unaccounted);
        }

        uint256 weight = ALLOCATION_VOTER.strategyWeight(STRATEGY);
        if (weight == 0) {
            _transferExact(GUM_BALL_VAULT, amount);
            emit ManagerRewards__RedirectedToVault(amount);
            return;
        }

        accountedRewards += amount;
        generationNotifiedRewards[currentGeneration] += amount;
        uint256 rewardPerWeightDelta = Math.mulDiv(amount, REWARD_PRECISION, weight);
        uint256 combinedRemainder = mulmod(amount, REWARD_PRECISION, weight) + rewardRemainder;
        rewardPerWeightDelta += combinedRemainder / weight;
        rewardRemainder = combinedRemainder % weight;
        rewardPerWeightStored += rewardPerWeightDelta;

        emit ManagerRewards__Notified(amount, weight, rewardPerWeightDelta, rewardRemainder);
    }

    /// @inheritdoc IManagerRewards
    function checkpointUser(address user, uint256 activeWeight, uint64 weightGeneration) external {
        if (msg.sender != address(ALLOCATION_VOTER)) revert ManagerRewards__NotAllocationVoter(msg.sender);
        _checkpoint(user, activeWeight, weightGeneration);
    }

    /// @inheritdoc IManagerRewards
    function settleTerminalDust() external {
        if (msg.sender != address(ALLOCATION_VOTER)) revert ManagerRewards__NotAllocationVoter(msg.sender);
        uint256 liveWeight = ALLOCATION_VOTER.strategyWeight(STRATEGY);
        if (liveWeight != 0) revert ManagerRewards__NonZeroStrategyWeight(liveWeight);
        _finalizeTerminalCycle(currentGeneration, currentRemainderCycle);
        rewardRemainder = 0;
        currentRemainderCycle += 1;
    }

    /// @inheritdoc IManagerRewards
    function sweepTerminalDust(uint64 generation, uint64 remainderCycle)
        external
        nonReentrant
        returns (uint256 amount)
    {
        amount = pendingTerminalDust[generation][remainderCycle];
        if (amount == 0) revert ManagerRewards__NoPendingTerminalDust(generation, remainderCycle);

        pendingTerminalDust[generation][remainderCycle] = 0;
        generationPendingTerminalDust[generation] -= amount;
        totalPendingTerminalDust -= amount;
        generationRedirectedDust[generation] += amount;
        accountedRewards -= amount;
        _transferExact(GUM_BALL_VAULT, amount);

        emit ManagerRewards__TerminalDustSettled(generation, remainderCycle, amount, accountedRewards);
    }

    /// @inheritdoc IManagerRewards
    function advanceGeneration(uint64 nextGeneration) external {
        if (msg.sender != address(ALLOCATION_VOTER)) revert ManagerRewards__NotAllocationVoter(msg.sender);
        uint64 closedGeneration = currentGeneration;
        if (nextGeneration != closedGeneration + 1) {
            revert ManagerRewards__InvalidGeneration(closedGeneration + 1, nextGeneration);
        }

        uint256 unsettledWeight = ALLOCATION_VOTER.strategyWeight(STRATEGY);
        generationEndRewardPerWeight[closedGeneration] = rewardPerWeightStored;
        generationClosed[closedGeneration] = true;
        generationEndRemainderCycle[closedGeneration] = currentRemainderCycle;
        generationUnsettledWeight[closedGeneration] = unsettledWeight;
        rewardRemainder = 0;
        currentGeneration = nextGeneration;
        currentRemainderCycle += 1;
        emit ManagerRewards__GenerationAdvanced(closedGeneration, nextGeneration, rewardPerWeightStored);
        if (unsettledWeight == 0) {
            _finalizeTerminalCycle(closedGeneration, generationEndRemainderCycle[closedGeneration]);
        }
    }

    /// @notice Claims a user's accrued rewards to their self-selected receiver, or to the user by default.
    /// @dev Anyone may trigger the claim; the caller can never redirect it.
    /// @param user The manager whose accrued rewards are checkpointed and paid.
    /// @return amount The raw reward-token amount paid to the user's configured receiver.
    function claim(address user) external nonReentrant returns (uint256 amount) {
        ALLOCATION_VOTER.checkpointUser(user);
        address receiver = rewardReceiver[user];
        if (receiver == address(0)) receiver = user;
        if (!ELIGIBILITY_MODULE.canHold(receiver)) revert ManagerRewards__IneligibleReceiver(receiver);

        amount = accruedRewards[user];
        if (amount == 0) return 0;

        accruedRewards[user] = 0;
        accountedRewards -= amount;
        totalAccruedRewards -= amount;
        _transferExact(receiver, amount);
        emit ManagerRewards__Claimed(user, receiver, amount);
    }

    /// @notice Selects a fixed reward receiver; passing zero restores payment directly to the user.
    /// @param receiver The eligible receiver, or zero to restore the caller as receiver.
    function setRewardReceiver(address receiver) external {
        if (receiver != address(0) && !ELIGIBILITY_MODULE.canHold(receiver)) {
            revert ManagerRewards__IneligibleReceiver(receiver);
        }
        rewardReceiver[msg.sender] = receiver;
        emit ManagerRewards__ReceiverSet(msg.sender, receiver);
    }

    /// @notice Returns currently claimable rewards using the user's present effective weight.
    /// @param user The manager whose accrued and pending rewards are queried.
    /// @return amount The raw reward-token amount currently claimable.
    function earned(address user) external view returns (uint256 amount) {
        (uint256 weight, uint64 weightGeneration) = ALLOCATION_VOTER.rewardWeight(user, STRATEGY);
        uint256 endingIndex = _endingIndex(weightGeneration);
        uint256 paid = userRewardPerWeightPaid[user];
        uint256 indexDelta = endingIndex > paid ? endingIndex - paid : 0;
        uint64 cycle = _remainderCycle(weightGeneration);
        uint256 priorRemainder = userRemainderCycle[user] == cycle ? userScaledRemainder[user] : 0;
        (uint256 newlyAccrued,) = _scaledAccrual(weight, indexDelta, priorRemainder);
        amount = accruedRewards[user] + newlyAccrued;
    }

    function _checkpoint(address user, uint256 activeWeight, uint64 weightGeneration) private {
        uint256 paid = userRewardPerWeightPaid[user];
        uint256 endingIndex = _endingIndex(weightGeneration);
        uint64 cycle = _remainderCycle(weightGeneration);
        uint256 priorRemainder = userRemainderCycle[user] == cycle ? userScaledRemainder[user] : 0;
        if (endingIndex > paid) {
            (uint256 newlyAccrued, uint256 remainder) = _scaledAccrual(activeWeight, endingIndex - paid, priorRemainder);
            accruedRewards[user] += newlyAccrued;
            totalAccruedRewards += newlyAccrued;
            generationWholeEntitlements[weightGeneration] += newlyAccrued;
            priorRemainder = remainder;
        }

        if (weightGeneration == currentGeneration) {
            userScaledRemainder[user] = priorRemainder;
            userRemainderCycle[user] = cycle;
        } else {
            // A closed generation cannot receive another index increment. Once this stored weight is
            // reconciled, its sub-token fraction belongs to that generation's terminal vault dust.
            userScaledRemainder[user] = 0;
            userRemainderCycle[user] = currentRemainderCycle;
            _settleClosedGenerationWeight(weightGeneration, user, activeWeight);
        }
        // A stale generation is fully settled at its fixed boundary. Advancing the paid index to the
        // current value prevents that old weight from participating in any later generation.
        userRewardPerWeightPaid[user] = rewardPerWeightStored;
        emit ManagerRewards__UserCheckpointed(user, activeWeight, accruedRewards[user]);
    }

    function _settleClosedGenerationWeight(uint64 generation, address user, uint256 activeWeight) private {
        if (activeWeight == 0 || generationUserSettled[generation][user]) return;
        uint256 remaining = generationUnsettledWeight[generation];
        if (activeWeight > remaining) {
            revert ManagerRewards__UnsettledWeightUnderflow(generation, activeWeight, remaining);
        }
        generationUserSettled[generation][user] = true;
        remaining -= activeWeight;
        generationUnsettledWeight[generation] = remaining;
        if (remaining == 0) {
            _finalizeTerminalCycle(generation, generationEndRemainderCycle[generation]);
        }
    }

    function _finalizeTerminalCycle(uint64 generation, uint64 cycle) private {
        if (terminalCycleFinalized[generation][cycle]) {
            revert ManagerRewards__TerminalCycleAlreadyFinalized(generation, cycle);
        }
        uint256 notified = generationNotifiedRewards[generation];
        uint256 wholeEntitlements = generationWholeEntitlements[generation];
        uint256 finalizedBefore = generationFinalizedTerminalDust[generation];
        uint256 amount = notified - wholeEntitlements - finalizedBefore;
        terminalCycleFinalized[generation][cycle] = true;
        generationFinalizedTerminalDust[generation] = finalizedBefore + amount;
        if (amount != 0) {
            pendingTerminalDust[generation][cycle] = amount;
            generationPendingTerminalDust[generation] += amount;
            totalPendingTerminalDust += amount;
        }
        emit ManagerRewards__TerminalDustQueued(
            generation, cycle, amount, generationPendingTerminalDust[generation], totalPendingTerminalDust
        );
    }

    function _remainderCycle(uint64 weightGeneration) private view returns (uint64 cycle) {
        if (weightGeneration == currentGeneration) return currentRemainderCycle;
        cycle = generationEndRemainderCycle[weightGeneration];
    }

    function _endingIndex(uint64 weightGeneration) private view returns (uint256 endingIndex) {
        uint64 generation = currentGeneration;
        if (weightGeneration == generation) return rewardPerWeightStored;
        if (weightGeneration > generation || !generationClosed[weightGeneration]) {
            revert ManagerRewards__InvalidGeneration(generation, weightGeneration);
        }
        endingIndex = generationEndRewardPerWeight[weightGeneration];
    }

    function _scaledAccrual(uint256 weight, uint256 indexDelta, uint256 priorRemainder)
        private
        pure
        returns (uint256 wholeReward, uint256 remainder)
    {
        wholeReward = Math.mulDiv(weight, indexDelta, REWARD_PRECISION);
        uint256 fractional = mulmod(weight, indexDelta, REWARD_PRECISION);
        uint256 combined = priorRemainder + fractional;
        wholeReward += combined / REWARD_PRECISION;
        remainder = combined % REWARD_PRECISION;
    }

    function _transferExact(address receiver, uint256 amount) private {
        uint256 senderBalanceBefore = REWARD_TOKEN.balanceOf(address(this));
        uint256 balanceBefore = REWARD_TOKEN.balanceOf(receiver);
        REWARD_TOKEN.safeTransfer(receiver, amount);
        uint256 senderBalanceAfter = REWARD_TOKEN.balanceOf(address(this));
        uint256 balanceAfter = REWARD_TOKEN.balanceOf(receiver);
        uint256 observedDebit = senderBalanceBefore > senderBalanceAfter ? senderBalanceBefore - senderBalanceAfter : 0;
        if (observedDebit != amount) {
            revert ManagerRewards__ObservedDebitMismatch(amount, observedDebit);
        }
        uint256 observed = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;
        if (observed != amount) {
            revert ManagerRewards__ObservedReceiptMismatch(receiver, amount, observed);
        }
    }
}
