'use client';

import type { ContractTransaction } from '@gumball-6900/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useReducer } from 'react';
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import type { Address, Hash, TransactionReceipt } from 'viem';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import { FinancialPreflightError } from '../lib/financial-preflight';
import { decodeProtocolErrorCopy, type ProtocolErrorContractKind } from '../lib/protocol-errors';
import type { RuntimeDeployment } from '../lib/runtime-types';

export type TransactionPhase = 'idle' | 'simulating' | 'awaiting-wallet' | 'pending' | 'success' | 'error';

export interface TransactionState {
  phase: TransactionPhase;
  label: string | null;
  hash: Hash | null;
  message: string | null;
}

export const initialTransactionState: TransactionState = {
  phase: 'idle',
  label: null,
  hash: null,
  message: null,
};

export type TransactionStateAction =
  | { type: 'start'; label: string }
  | { type: 'wallet' }
  | { type: 'pending'; hash: Hash }
  | { type: 'success'; hash: Hash }
  | { type: 'error'; message: string }
  | { type: 'reset' };

export function transactionStateReducer(state: TransactionState, action: TransactionStateAction): TransactionState {
  if (action.type === 'reset') return initialTransactionState;
  if (action.type === 'start') return { phase: 'simulating', label: action.label, hash: null, message: null };
  if (action.type === 'wallet') return { ...state, phase: 'awaiting-wallet' };
  if (action.type === 'pending') return { ...state, phase: 'pending', hash: action.hash };
  if (action.type === 'success') return { ...state, phase: 'success', hash: action.hash };
  return { ...state, phase: 'error', message: action.message };
}

export interface TransactionErrorContext {
  readonly runtime: RuntimeDeployment;
  readonly target: Address;
  /** Set only after the target address has been validated against a pinned registry/Lens snapshot. */
  readonly validatedContractKind?: ProtocolErrorContractKind;
}

export function humanizeTransactionError(error: unknown, context?: TransactionErrorContext): string {
  if (error instanceof FinancialPreflightError) return error.userMessage;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    if (candidate.code === 4001 || candidate.code === 'ACTION_REJECTED') return 'The wallet request was rejected.';
    if (context !== undefined) {
      const decoded = decodeProtocolErrorCopy(error, context);
      if (decoded !== null) return decoded;
    }
    if (typeof candidate.message === 'string') {
      if (/insufficient funds/iu.test(candidate.message)) return 'The wallet does not have enough gas token.';
      if (/revert/iu.test(candidate.message)) return 'Simulation reverted. Review eligibility, allowance, and amount.';
      if (/network|rpc|timeout|timed out|failed to fetch/iu.test(candidate.message)) {
        return 'The RPC request failed. No confirmed state change was assumed; retry from a fresh preflight.';
      }
    }
  }
  return 'The transaction could not be completed. No confirmed state change was assumed.';
}

export type TransactionReadiness = 'demo-disabled' | 'disconnected' | 'wrong-network' | 'ready';

export interface TransactionSubmissionOptions {
  /** Manifest- or Lens-validated destination used when a prepared request fails before returning its transaction. */
  readonly errorTarget?: Address;
  /** Generated ABI profile for a dynamic target already validated by the action's pinned read model. */
  readonly validatedErrorContractKind?: ProtocolErrorContractKind;
  /** Runs only after a successful canonical receipt. Observer failures never rewrite confirmed transaction state. */
  readonly onConfirmedReceipt?: (receipt: TransactionReceipt) => void | Promise<void>;
}

export type ContractTransactionPreparation =
  | ContractTransaction
  | (() => ContractTransaction | Promise<ContractTransaction>);

export async function refreshConfirmedProtocolState(queryClient: {
  invalidateQueries: (filters: { refetchType: 'active' }) => Promise<unknown>;
}): Promise<void> {
  await queryClient.invalidateQueries({ refetchType: 'active' });
}

export function useProtocolTransaction() {
  const runtime = useRuntimeDeployment();
  const queryClient = useQueryClient();
  const account = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const switchChain = useSwitchChain();
  const [state, dispatch] = useReducer(transactionStateReducer, initialTransactionState);

  const readiness: TransactionReadiness =
    runtime.mode !== 'live'
      ? 'demo-disabled'
      : !account.isConnected || account.address === undefined
        ? 'disconnected'
        : chainId !== runtime.chain.id
          ? 'wrong-network'
          : 'ready';

  const submit = useCallback(
    async (
      preparation: ContractTransactionPreparation,
      label: string,
      options: TransactionSubmissionOptions = {},
    ): Promise<Hash | null> => {
      if (
        readiness !== 'ready' ||
        account.address === undefined ||
        publicClient === undefined ||
        walletClient.data === undefined
      ) {
        dispatch({
          type: 'error',
          message:
            readiness === 'demo-disabled'
              ? 'Live writes are disabled because the signed deployment configuration is unavailable.'
              : readiness === 'wrong-network'
                ? `Switch to ${runtime.chain.name} before submitting.`
                : 'Connect a wallet before submitting.',
        });
        return null;
      }

      let transaction = typeof preparation === 'function' ? undefined : preparation;
      try {
        dispatch({ type: 'start', label });
        transaction = typeof preparation === 'function' ? await preparation() : preparation;
        await publicClient.call({
          account: account.address,
          data: transaction.data,
          to: transaction.to,
          value: transaction.value,
        });
        dispatch({ type: 'wallet' });
        const hash = await walletClient.data.sendTransaction({
          account: account.address,
          chain: walletClient.data.chain,
          data: transaction.data,
          to: transaction.to,
          value: transaction.value,
        });
        dispatch({ type: 'pending', hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error('Transaction receipt reported a revert');
        dispatch({ type: 'success', hash });
        try {
          await refreshConfirmedProtocolState(queryClient);
        } catch {
          // A confirmed receipt remains canonical even if a supplementary cache refresh fails.
        }
        try {
          await options.onConfirmedReceipt?.(receipt);
        } catch {
          // Receipt observers render supplementary data; a UI decoding failure cannot turn a confirmed tx into a revert.
        }
        return hash;
      } catch (error) {
        const target = transaction?.to ?? options.errorTarget;
        dispatch({
          type: 'error',
          message: humanizeTransactionError(
            error,
            target === undefined
              ? undefined
              : options.validatedErrorContractKind === undefined
                ? { runtime, target }
                : { runtime, target, validatedContractKind: options.validatedErrorContractKind },
          ),
        });
        return null;
      }
    },
    [account.address, publicClient, queryClient, readiness, runtime, walletClient.data],
  );

  const requestNetworkSwitch = useCallback(async () => {
    try {
      await switchChain.switchChainAsync({ chainId: runtime.chain.id });
    } catch (error) {
      dispatch({ type: 'error', message: humanizeTransactionError(error) });
    }
  }, [runtime.chain.id, switchChain]);

  return {
    state,
    readiness,
    isBusy: ['simulating', 'awaiting-wallet', 'pending'].includes(state.phase),
    submit,
    requestNetworkSwitch,
    reset: () => dispatch({ type: 'reset' }),
  };
}
