import { ACCUMULATOR_PRECISION } from './constants.js';
import { assertNonNegative, assertPositive, mulDiv } from './integer.js';

export interface RewardIndexUpdate {
  notifiedReward: bigint;
  rewardPerWeightIncrement: bigint;
  indexedReward: bigint;
  residue: bigint;
}

/** Mirrors StrategyRewards.notifyReward. Each notification floors independently; residue is not carried. */
export function updateRewardIndex(
  rewardAmount: bigint,
  totalWeight: bigint,
  precision = ACCUMULATOR_PRECISION,
): RewardIndexUpdate {
  assertNonNegative(rewardAmount, 'rewardAmount');
  assertPositive(totalWeight, 'totalWeight');
  assertPositive(precision, 'precision');
  const rewardPerWeightIncrement = mulDiv(rewardAmount, precision, totalWeight);
  const indexedReward = mulDiv(rewardPerWeightIncrement, totalWeight, precision);
  return {
    notifiedReward: rewardAmount,
    rewardPerWeightIncrement,
    indexedReward,
    residue: rewardAmount - indexedReward,
  };
}

export function earnedStrategyReward(
  weight: bigint,
  rewardPerWeightStored: bigint,
  userRewardPerWeightPaid: bigint,
  accruedReward = 0n,
  precision = ACCUMULATOR_PRECISION,
): bigint {
  assertNonNegative(weight, 'weight');
  assertNonNegative(rewardPerWeightStored, 'rewardPerWeightStored');
  assertNonNegative(userRewardPerWeightPaid, 'userRewardPerWeightPaid');
  assertNonNegative(accruedReward, 'accruedReward');
  assertPositive(precision, 'precision');
  if (userRewardPerWeightPaid > rewardPerWeightStored) {
    throw new RangeError('userRewardPerWeightPaid must not exceed rewardPerWeightStored');
  }
  return accruedReward + mulDiv(weight, rewardPerWeightStored - userRewardPerWeightPaid, precision);
}
