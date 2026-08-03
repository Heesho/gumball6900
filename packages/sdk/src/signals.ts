import { getAddress, type Address } from 'viem';

import { mulDiv } from './math/integer.js';
import { assertUint } from './validation.js';

export interface RelativeSignal {
  readonly strategy: Address;
  readonly relativeWeight: bigint;
}

export interface NormalizedSignal {
  readonly strategy: Address;
  readonly activeAndPendingWeight: bigint;
}

/** Mirrors AllocationVoter.signal: floors each allocation and gives the final strategy all residual atomic units. */
export function normalizeSignalWeights(
  stakedBalance: bigint,
  signals: readonly RelativeSignal[],
): readonly NormalizedSignal[] {
  if (stakedBalance <= 0n) throw new RangeError('stakedBalance must be positive');
  assertUint(stakedBalance, 256, 'stakedBalance');
  if (signals.length === 0 || signals.length > 16) throw new RangeError('signals length must be between 1 and 16');
  const strategies = signals.map(({ strategy }) => getAddress(strategy));
  if (new Set(strategies.map((strategy) => strategy.toLowerCase())).size !== strategies.length) {
    throw new RangeError('duplicate strategy');
  }
  if (signals.some(({ relativeWeight }) => relativeWeight <= 0n)) {
    throw new RangeError('relative weights must be positive');
  }
  signals.forEach(({ relativeWeight }) => assertUint(relativeWeight, 256, 'relativeWeight'));

  const totalRelativeWeight = signals.reduce((sum, signal) => sum + signal.relativeWeight, 0n);
  assertUint(totalRelativeWeight, 256, 'totalRelativeWeight');
  let assigned = 0n;
  return signals.map(({ relativeWeight }, index) => {
    const activeAndPendingWeight =
      index + 1 === signals.length
        ? stakedBalance - assigned
        : mulDiv(stakedBalance, relativeWeight, totalRelativeWeight);
    if (activeAndPendingWeight === 0n) throw new RangeError(`signal at index ${index} rounds to zero`);
    assigned += activeAndPendingWeight;
    return { strategy: strategies[index]!, activeAndPendingWeight };
  });
}
