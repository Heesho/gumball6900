import { getAddress, zeroAddress, type Address } from 'viem';

import { assertUint, positiveBigIntSchema } from './validation.js';

/** One raw-unit SignalGBX allocation to a Strategy. */
export interface SignalAllocation {
  readonly strategy: Address;
  readonly amount: bigint;
}

/** Checked, checksummed, first-seen-order allocations with duplicate Strategies coalesced. */
export interface NormalizedSignalAllocations {
  readonly allocations: readonly SignalAllocation[];
  readonly totalAmount: bigint;
}

/**
 * Validates and coalesces a nonempty Strategy allocation list.
 * Duplicate Strategy entries are summed in first-seen order so UI rows cannot accidentally cause redundant checkpoints.
 */
export function normalizeSignalAllocations(allocations: readonly SignalAllocation[]): NormalizedSignalAllocations {
  if (allocations.length === 0) throw new RangeError('allocations cannot be empty');

  const coalesced = new Map<Address, bigint>();
  let totalAmount = 0n;
  for (const allocation of allocations) {
    let amount: bigint;
    try {
      amount = positiveBigIntSchema.parse(allocation.amount);
    } catch {
      throw new RangeError('allocation amount must be positive');
    }
    assertUint(amount, 256, 'allocation amount');

    const strategy = getAddress(allocation.strategy);
    if (strategy === zeroAddress) throw new RangeError('allocation strategy cannot be the zero address');

    const nextStrategyAmount = (coalesced.get(strategy) ?? 0n) + amount;
    assertUint(nextStrategyAmount, 256, 'coalesced allocation amount');
    coalesced.set(strategy, nextStrategyAmount);

    totalAmount += amount;
    assertUint(totalAmount, 256, 'total allocation amount');
  }

  return {
    allocations: [...coalesced].map(([strategy, amount]) => ({ strategy, amount })),
    totalAmount,
  };
}
