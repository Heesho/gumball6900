// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IStrategyRewards } from "../interfaces/IStrategyRewards.sol";

/// @title StrategyRewards
/// @notice Immediate high-precision target-token reward index for one strategy's active supporters.
contract StrategyRewards is IStrategyRewards, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Fixed-point precision used by the reward-per-weight index.
    uint256 public constant REWARD_PRECISION = 1e27;

    /// @notice Allocation voter exclusively authorized to update user weights.
    address public immutable ALLOCATION_VOTER;
    /// @notice Deployment coordinator allowed to bind the strategy once.
    address public immutable STRATEGY_INITIALIZER;
    /// @notice Strategy exclusively authorized to notify funded rewards.
    address public override STRATEGY;
    /// @notice Token distributed by this rewards index.
    address public immutable override REWARD_TOKEN;

    /// @notice Aggregate supporter weight last synchronized while the strategy was live.
    /// @dev This freezes as a terminal claim-accounting snapshot after registry/voter disablement.
    uint256 public override totalWeight;
    /// @notice Cumulative reward per unit of supporter weight.
    uint256 public rewardPerWeightStored;
    /// @notice Total funded rewards not yet paid to beneficiaries.
    uint256 public accountedRewards;
    /// @notice Returns one user's last synchronized reward weight, including a terminal disabled-strategy snapshot.
    mapping(address user => uint256 weight) public weightOf;
    /// @notice Returns the reward index last checkpointed for a user.
    mapping(address user => uint256 index) public rewardPerWeightPaid;
    /// @notice Returns a user's checkpointed unpaid rewards.
    mapping(address user => uint256 amount) public accrued;

    error StrategyRewards__AlreadyInitialized();
    error StrategyRewards__InexactTransfer(uint256 expected, uint256 debit, uint256 receipt);
    error StrategyRewards__InsufficientFunding(uint256 required, uint256 balance);
    error StrategyRewards__NoReward(address beneficiary);
    error StrategyRewards__Unauthorized(address caller);
    error StrategyRewards__ZeroAddress();
    error StrategyRewards__ZeroAmount();
    error StrategyRewards__ZeroWeight();

    event StrategyRewards__Claimed(address indexed beneficiary, address indexed caller, uint256 amount);
    event StrategyRewards__RewardNotified(uint256 amount, uint256 rewardPerWeightAfter);
    event StrategyRewards__WeightSet(address indexed user, uint256 previousWeight, uint256 newWeight);

    /// @notice Configures the reward token, allocation voter, and one-time strategy initializer.
    constructor(address rewardToken, address allocationVoter, address strategyInitializer) {
        if (rewardToken == address(0) || allocationVoter == address(0) || strategyInitializer == address(0)) {
            revert StrategyRewards__ZeroAddress();
        }
        if (rewardToken.code.length == 0 || allocationVoter.code.length == 0) revert StrategyRewards__ZeroAddress();
        REWARD_TOKEN = rewardToken;
        ALLOCATION_VOTER = allocationVoter;
        STRATEGY_INITIALIZER = strategyInitializer;
    }

    /// @notice Binds the sole strategy allowed to notify rewards.
    function initializeStrategy(address strategy) external {
        if (msg.sender != STRATEGY_INITIALIZER) revert StrategyRewards__Unauthorized(msg.sender);
        if (STRATEGY != address(0)) revert StrategyRewards__AlreadyInitialized();
        if (strategy == address(0) || strategy.code.length == 0) revert StrategyRewards__ZeroAddress();
        STRATEGY = strategy;
    }

    /// @notice Checkpoints and replaces one user's active reward weight.
    function setWeight(address user, uint256 newWeight) external override {
        if (msg.sender != ALLOCATION_VOTER) revert StrategyRewards__Unauthorized(msg.sender);
        if (user == address(0)) revert StrategyRewards__ZeroAddress();
        _checkpoint(user);
        uint256 previous = weightOf[user];
        totalWeight = totalWeight - previous + newWeight;
        weightOf[user] = newWeight;
        emit StrategyRewards__WeightSet(user, previous, newWeight);
    }

    /// @notice Accounts a nonzero reward amount already held by this contract.
    function notifyReward(uint256 amount) external override {
        if (msg.sender != STRATEGY) revert StrategyRewards__Unauthorized(msg.sender);
        if (amount == 0) revert StrategyRewards__ZeroAmount();
        uint256 weight = totalWeight;
        if (weight == 0) revert StrategyRewards__ZeroWeight();
        uint256 required = accountedRewards + amount;
        uint256 balance = IERC20(REWARD_TOKEN).balanceOf(address(this));
        if (balance < required) revert StrategyRewards__InsufficientFunding(required, balance);

        accountedRewards = required;
        rewardPerWeightStored += Math.mulDiv(amount, REWARD_PRECISION, weight);
        emit StrategyRewards__RewardNotified(amount, rewardPerWeightStored);
    }

    /// @notice Permissionlessly pays a beneficiary to that same beneficiary address.
    function claim(address beneficiary) external nonReentrant returns (uint256 amount) {
        if (beneficiary == address(0)) revert StrategyRewards__ZeroAddress();
        _checkpoint(beneficiary);
        amount = accrued[beneficiary];
        if (amount == 0) revert StrategyRewards__NoReward(beneficiary);
        accrued[beneficiary] = 0;
        accountedRewards -= amount;

        IERC20 token = IERC20(REWARD_TOKEN);
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 receiverBefore = token.balanceOf(beneficiary);
        token.safeTransfer(beneficiary, amount);
        uint256 senderAfter = token.balanceOf(address(this));
        uint256 receiverAfter = token.balanceOf(beneficiary);
        uint256 debit = senderBefore > senderAfter ? senderBefore - senderAfter : 0;
        uint256 receipt = receiverAfter > receiverBefore ? receiverAfter - receiverBefore : 0;
        if (debit != amount || receipt != amount) revert StrategyRewards__InexactTransfer(amount, debit, receipt);

        emit StrategyRewards__Claimed(beneficiary, msg.sender, amount);
    }

    /// @notice Returns a user's checkpointed plus newly indexed unpaid rewards.
    function earned(address user) external view returns (uint256) {
        return accrued[user]
            + Math.mulDiv(weightOf[user], rewardPerWeightStored - rewardPerWeightPaid[user], REWARD_PRECISION);
    }

    function _checkpoint(address user) private {
        uint256 index = rewardPerWeightStored;
        uint256 paid = rewardPerWeightPaid[user];
        if (index != paid) {
            accrued[user] += Math.mulDiv(weightOf[user], index - paid, REWARD_PRECISION);
            rewardPerWeightPaid[user] = index;
        }
    }
}
