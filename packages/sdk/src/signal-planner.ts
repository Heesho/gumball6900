import type { Address } from 'viem';

import {
  buildAddSignal,
  buildAddSignalMany,
  buildApproval,
  buildRemoveSignal,
  buildRemoveSignalMany,
  type ContractTransaction,
} from './actions.js';
import {
  normalizeSignalAllocations,
  type NormalizedSignalAllocations,
  type SignalAllocation,
} from './signal-allocations.js';
import { assertUint, unsignedBigIntSchema } from './validation.js';

/** Inputs required to prepare direct SignalGBX addition calls and any GBX approval. */
export interface AddSignalsPlanParameters {
  readonly gbx: Address;
  readonly signalGBX: Address;
  readonly allocations: readonly SignalAllocation[];
  /** Current GBX allowance from the signaling account to SignalGBX at the transaction's pinned planning block. */
  readonly currentAllowance: bigint;
}

/** Direct-to-SignalGBX addition plan with a native batch and scalar recovery path. */
export interface AddSignalsPlan extends NormalizedSignalAllocations {
  readonly requiredAllowance: bigint;
  readonly allowanceShortfall: bigint;
  readonly approvalRequired: boolean;
  /** Exact-total GBX approval, or null when the supplied allowance already covers the aggregate addition. */
  readonly approvalTransaction: ContractTransaction | null;
  /** Native `addSignalMany` call, irrespective of allocation count. */
  readonly batchTransaction: ContractTransaction;
  /** One `addSignal` call per normalized allocation, usable when a batch is too large or unsupported. */
  readonly scalarTransactions: readonly ContractTransaction[];
  /** Scalar for one allocation, otherwise the native batch. */
  readonly preferredSignalTransaction: ContractTransaction;
  /** Calls a smart account may execute atomically: optional GBX approval followed by the preferred SignalGBX call. */
  readonly accountCalls: readonly ContractTransaction[];
}

/** Direct-to-SignalGBX removal plan with a native batch and scalar recovery path. */
export interface RemoveSignalsPlan extends NormalizedSignalAllocations {
  /** Native `removeSignalMany` call, irrespective of allocation count. */
  readonly batchTransaction: ContractTransaction;
  /** One `removeSignal` call per normalized allocation, preserving a withdrawal path if a batch is unsuitable. */
  readonly scalarTransactions: readonly ContractTransaction[];
  /** Scalar for one allocation, otherwise the native batch. */
  readonly preferredTransaction: ContractTransaction;
}

/** Plans a normalized signal addition without introducing a write-through router or delegated operator. */
export function planAddSignals(parameters: AddSignalsPlanParameters): AddSignalsPlan {
  const normalized = normalizeSignalAllocations(parameters.allocations);
  let currentAllowance: bigint;
  try {
    currentAllowance = unsignedBigIntSchema.parse(parameters.currentAllowance);
  } catch {
    throw new RangeError('currentAllowance must be nonnegative');
  }
  assertUint(currentAllowance, 256, 'currentAllowance');

  const requiredAllowance = normalized.totalAmount;
  const allowanceShortfall = currentAllowance >= requiredAllowance ? 0n : requiredAllowance - currentAllowance;
  const approvalTransaction =
    allowanceShortfall === 0n ? null : buildApproval(parameters.gbx, parameters.signalGBX, requiredAllowance);
  const batchTransaction = buildAddSignalMany(parameters.signalGBX, normalized.allocations);
  const scalarTransactions = normalized.allocations.map(({ strategy, amount }) =>
    buildAddSignal(parameters.signalGBX, strategy, amount),
  );
  const preferredSignalTransaction = scalarTransactions.length === 1 ? scalarTransactions[0]! : batchTransaction;

  return {
    ...normalized,
    requiredAllowance,
    allowanceShortfall,
    approvalRequired: approvalTransaction !== null,
    approvalTransaction,
    batchTransaction,
    scalarTransactions,
    preferredSignalTransaction,
    accountCalls:
      approvalTransaction === null ? [preferredSignalTransaction] : [approvalTransaction, preferredSignalTransaction],
  };
}

/** Plans a normalized signal removal; every returned write targets SignalGBX directly. */
export function planRemoveSignals(signalGBX: Address, allocations: readonly SignalAllocation[]): RemoveSignalsPlan {
  const normalized = normalizeSignalAllocations(allocations);
  const batchTransaction = buildRemoveSignalMany(signalGBX, normalized.allocations);
  const scalarTransactions = normalized.allocations.map(({ strategy, amount }) =>
    buildRemoveSignal(signalGBX, strategy, amount),
  );
  const preferredTransaction = scalarTransactions.length === 1 ? scalarTransactions[0]! : batchTransaction;

  return {
    ...normalized,
    batchTransaction,
    scalarTransactions,
    preferredTransaction,
  };
}
