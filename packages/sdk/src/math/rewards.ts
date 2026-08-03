import { ACCUMULATOR_PRECISION } from './constants.js';
import { assertNonNegative, assertPositive, mulDiv } from './integer.js';

export interface RewardAccumulatorUpdate {
  distributableReward: bigint;
  rewardPerWeightIncrement: bigint;
  representedReward: bigint;
  /** Scaled numerator carry, denominated modulo totalActiveWeight rather than reward-token units. */
  nextRemainder: bigint;
}

/**
 * Applies a reward notification to a live strategy weight. Zero-weight notifications must be
 * redirected to the vault before reaching this accounting helper.
 */
export function updateRewardAccumulator(
  rewardAmount: bigint,
  totalActiveWeight: bigint,
  priorRemainder = 0n,
  precision = ACCUMULATOR_PRECISION,
): RewardAccumulatorUpdate {
  assertNonNegative(rewardAmount, 'rewardAmount');
  assertPositive(totalActiveWeight, 'totalActiveWeight');
  assertNonNegative(priorRemainder, 'priorRemainder');
  assertPositive(precision, 'precision');

  let rewardPerWeightIncrement = mulDiv(rewardAmount, precision, totalActiveWeight);
  const combinedRemainder = ((rewardAmount * precision) % totalActiveWeight) + priorRemainder;
  rewardPerWeightIncrement += combinedRemainder / totalActiveWeight;
  const representedReward = mulDiv(rewardPerWeightIncrement, totalActiveWeight, precision);

  return {
    distributableReward: rewardAmount,
    rewardPerWeightIncrement,
    representedReward,
    nextRemainder: combinedRemainder % totalActiveWeight,
  };
}

export function earnedManagerReward(
  activeWeight: bigint,
  rewardPerWeightStored: bigint,
  userRewardPerWeightPaid: bigint,
  accruedReward = 0n,
  precision = ACCUMULATOR_PRECISION,
): bigint {
  assertNonNegative(activeWeight, 'activeWeight');
  assertNonNegative(rewardPerWeightStored, 'rewardPerWeightStored');
  assertNonNegative(userRewardPerWeightPaid, 'userRewardPerWeightPaid');
  assertNonNegative(accruedReward, 'accruedReward');
  assertPositive(precision, 'precision');
  if (userRewardPerWeightPaid > rewardPerWeightStored) {
    throw new RangeError('userRewardPerWeightPaid must not exceed rewardPerWeightStored');
  }

  const newlyEarned = mulDiv(activeWeight, rewardPerWeightStored - userRewardPerWeightPaid, precision);
  return accruedReward + newlyEarned;
}
