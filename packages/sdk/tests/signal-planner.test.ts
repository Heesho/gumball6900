import { decodeFunctionData, type Address } from 'viem';
import { describe, expect, it } from 'vitest';

import { gbxAbi, normalizeSignalAllocations, planAddSignals, planRemoveSignals, signalGbxAbi } from '../src/index.js';

const address = (value: number): Address => `0x${value.toString(16).padStart(40, '0')}`;

describe('signal allocation normalization', () => {
  it('checksums and coalesces duplicates in first-seen order', () => {
    expect(
      normalizeSignalAllocations([
        { strategy: address(2), amount: 3n },
        { strategy: address(3), amount: 5n },
        { strategy: address(2), amount: 7n },
      ]),
    ).toEqual({
      allocations: [
        { strategy: address(2), amount: 10n },
        { strategy: address(3), amount: 5n },
      ],
      totalAmount: 15n,
    });
  });

  it('rejects empty, zero, and overflowing aggregate allocations', () => {
    expect(() => normalizeSignalAllocations([])).toThrow(RangeError);
    expect(() => normalizeSignalAllocations([{ strategy: address(2), amount: 0n }])).toThrow(RangeError);
    expect(() =>
      normalizeSignalAllocations([
        { strategy: address(2), amount: (1n << 256n) - 1n },
        { strategy: address(3), amount: 1n },
      ]),
    ).toThrow(RangeError);
  });
});

describe('signal transaction plans', () => {
  it('builds one approval plus a native multi-add for smart-account execution', () => {
    const plan = planAddSignals({
      gbx: address(1),
      signalGBX: address(4),
      currentAllowance: 4n,
      allocations: [
        { strategy: address(2), amount: 3n },
        { strategy: address(3), amount: 5n },
        { strategy: address(2), amount: 7n },
      ],
    });

    expect(plan.totalAmount).toBe(15n);
    expect(plan.requiredAllowance).toBe(15n);
    expect(plan.allowanceShortfall).toBe(11n);
    expect(plan.approvalRequired).toBe(true);
    expect(plan.scalarTransactions).toHaveLength(2);
    expect(plan.accountCalls).toHaveLength(2);
    expect(plan.preferredSignalTransaction.to).toBe(address(4));
    expect(plan.scalarTransactions.every((transaction) => transaction.to === address(4))).toBe(true);
    expect(decodeFunctionData({ abi: gbxAbi, data: plan.accountCalls[0]!.data })).toMatchObject({
      functionName: 'approve',
      args: [address(4), 15n],
    });
    expect(decodeFunctionData({ abi: signalGbxAbi, data: plan.preferredSignalTransaction.data })).toMatchObject({
      functionName: 'addSignalMany',
    });
  });

  it('omits approval and prefers the scalar function for one normalized addition', () => {
    const plan = planAddSignals({
      gbx: address(1),
      signalGBX: address(4),
      currentAllowance: 100n,
      allocations: [{ strategy: address(2), amount: 10n }],
    });

    expect(plan.approvalRequired).toBe(false);
    expect(plan.approvalTransaction).toBeNull();
    expect(plan.accountCalls).toEqual([plan.preferredSignalTransaction]);
    expect(decodeFunctionData({ abi: signalGbxAbi, data: plan.preferredSignalTransaction.data })).toMatchObject({
      functionName: 'addSignal',
      args: [address(2), 10n],
    });
  });

  it('builds batch and scalar removal paths without approval or custody intermediaries', () => {
    const signalGBX = address(4);
    const plan = planRemoveSignals(signalGBX, [
      { strategy: address(2), amount: 3n },
      { strategy: address(3), amount: 5n },
    ]);

    expect(plan.totalAmount).toBe(8n);
    expect(plan.batchTransaction.to).toBe(signalGBX);
    expect(plan.scalarTransactions.every((transaction) => transaction.to === signalGBX)).toBe(true);
    expect(decodeFunctionData({ abi: signalGbxAbi, data: plan.preferredTransaction.data })).toMatchObject({
      functionName: 'removeSignalMany',
    });
  });
});
