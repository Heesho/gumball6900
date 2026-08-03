import { describe, expect, it } from 'vitest';

import {
  humanizeTransactionError,
  initialTransactionState,
  refreshConfirmedProtocolState,
  transactionStateReducer,
} from '../hooks/use-protocol-transaction';
import { parseInputAmount, transactionExplorerUrl } from '../lib/transactions';

describe('transaction state machine', () => {
  it('moves only from simulation through wallet, pending, and confirmed receipt states', () => {
    const hash = `0x${'12'.repeat(32)}` as const;
    const simulating = transactionStateReducer(initialTransactionState, { type: 'start', label: 'Redeem GBX' });
    expect(simulating.phase).toBe('simulating');
    const wallet = transactionStateReducer(simulating, { type: 'wallet' });
    expect(wallet.phase).toBe('awaiting-wallet');
    const pending = transactionStateReducer(wallet, { type: 'pending', hash });
    expect(pending).toMatchObject({ phase: 'pending', hash });
    const success = transactionStateReducer(pending, { type: 'success', hash });
    expect(success).toMatchObject({ phase: 'success', hash });
    expect(transactionStateReducer(success, { type: 'reset' })).toEqual(initialTransactionState);
  });

  it('normalizes token input without floating-point conversion', () => {
    expect(parseInputAmount('1,250.000000000000000001')).toBe(1_250_000_000_000_000_000_001n);
    expect(() => parseInputAmount('1,25')).toThrow('plain positive token amount');
    expect(() => parseInputAmount('0')).toThrow('greater than zero');
  });

  it('produces bounded wallet errors and explorer URLs', () => {
    expect(humanizeTransactionError({ code: 4001, message: 'internal details' })).toBe(
      'The wallet request was rejected.',
    );
    const hash = `0x${'ab'.repeat(32)}` as const;
    expect(transactionExplorerUrl('https://explorer.example/', hash)).toBe(`https://explorer.example/tx/${hash}`);
  });

  it('refetches active protocol state after a confirmed write', async () => {
    const calls: unknown[] = [];
    await refreshConfirmedProtocolState({
      invalidateQueries: async (filters) => {
        calls.push(filters);
      },
    });
    expect(calls).toEqual([{ refetchType: 'active' }]);
  });
});
