'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import { readTimelockOperationSnapshot, validateTimelockOperationDraft } from '../lib/admin-operation-preflight';
import { hashKnownTimelockOperation, type TimelockOperation } from '../lib/admin-transactions';
import type { LiveAdminSnapshot } from '../lib/live-admin-snapshot';

export type TimelockOperationReadSource = 'disabled' | 'loading' | 'live' | 'stale' | 'unavailable';

export function useTimelockOperation(
  operation: TimelockOperation | undefined,
  adminSnapshot: LiveAdminSnapshot | undefined,
  adminSnapshotCurrent: boolean,
) {
  const runtime = useRuntimeDeployment();
  const client = usePublicClient();
  let operationId: string | null = null;
  let encodingError: Error | null = null;
  if (runtime.mode === 'live' && operation !== undefined) {
    try {
      operationId = hashKnownTimelockOperation(runtime, operation);
    } catch (error) {
      encodingError = error instanceof Error ? error : new Error('The named operation could not be encoded.');
    }
  }
  const enabled =
    runtime.mode === 'live' &&
    client !== undefined &&
    operation !== undefined &&
    operationId !== null &&
    adminSnapshot !== undefined &&
    adminSnapshotCurrent;
  const query = useQuery({
    enabled,
    queryKey: [
      'typed-timelock-operation',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      adminSnapshot?.blockHash,
      operationId,
    ],
    queryFn: async () => {
      if (runtime.mode !== 'live' || client === undefined || operation === undefined || adminSnapshot === undefined) {
        throw new Error('A current admin snapshot and named operation are required.');
      }
      const state = await readTimelockOperationSnapshot(client, runtime, adminSnapshot, operation);
      const validationPhase = state.state === 'matured' ? 'execute' : 'schedule';
      const preconditionError =
        state.state === 'pending' || state.state === 'expired'
          ? null
          : await validateTimelockOperationDraft(client, runtime, adminSnapshot, operation, validationPhase);
      return { ...state, preconditionError };
    },
    refetchInterval: 8_000,
    retry: false,
    staleTime: 6_000,
  });
  const source: TimelockOperationReadSource = !enabled
    ? 'disabled'
    : query.data !== undefined && query.error !== null
      ? 'stale'
      : query.data !== undefined
        ? 'live'
        : query.isPending
          ? 'loading'
          : 'unavailable';
  return {
    data: query.data,
    encodingError,
    error: query.error,
    isFetching: query.isFetching,
    operationId,
    refetch: query.refetch,
    source,
  };
}
