'use client';

import { Badge, Button, Notice } from '@gumball-6900/ui';

import type { TransactionReadiness, TransactionState } from '../../hooks/use-protocol-transaction';
import { transactionExplorerUrl } from '../../lib/transactions';
import { useRuntimeDeployment } from './runtime-context';

export function TransactionGuard({
  readiness,
  onSwitchNetwork,
}: {
  readiness: TransactionReadiness;
  onSwitchNetwork: () => void;
}) {
  const runtime = useRuntimeDeployment();
  if (readiness === 'ready') return null;
  if (readiness === 'demo-disabled') {
    return (
      <Notice title="Safe demo fallback" tone="warning">
        Deterministic preview data is active. Contract writes stay disabled until an explicitly selected production or
        testnet runtime, its required validated manifest, remote RPC boundary, and complete SDK address map pass runtime
        validation.
      </Notice>
    );
  }
  if (readiness === 'disconnected') {
    return (
      <Notice title="Wallet required">Connect a wallet from the header to simulate and submit this action.</Notice>
    );
  }
  return (
    <Notice title="Wrong network" tone="warning">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <span>
          Switch to {runtime.chain.name} ({runtime.chain.id.toString()}) before simulation.
        </span>
        <Button onClick={onSwitchNetwork} size="sm" variant="secondary">
          Switch network
        </Button>
      </div>
    </Notice>
  );
}

export function TransactionStatus({ state, onReset }: { state: TransactionState; onReset: () => void }) {
  const runtime = useRuntimeDeployment();
  if (state.phase === 'idle') return null;

  const labels: Record<Exclude<TransactionState['phase'], 'idle'>, string> = {
    simulating: 'Simulating',
    'awaiting-wallet': 'Wallet confirmation',
    pending: 'Pending onchain',
    success: 'Confirmed',
    error: 'Action stopped',
  };
  const tone = state.phase === 'success' ? 'positive' : state.phase === 'error' ? 'warning' : 'info';

  return (
    <div
      aria-live="polite"
      className="rounded-2xl border border-white/8 bg-[#0a1112]/70 p-4"
      data-transaction-phase={state.phase}
    >
      <div className="flex items-center justify-between gap-3">
        <Badge tone={tone}>{labels[state.phase]}</Badge>
        {state.phase === 'error' || state.phase === 'success' ? (
          <Button onClick={onReset} size="sm" variant="quiet">
            Clear
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-semibold text-white">{state.label ?? 'Protocol transaction'}</p>
      {state.phase === 'simulating' ? (
        <p className="mt-1 text-xs leading-5 text-[#7c8b8b]">Checking the exact call against current chain state.</p>
      ) : null}
      {state.phase === 'awaiting-wallet' ? (
        <p className="mt-1 text-xs leading-5 text-[#7c8b8b]">
          Review the destination, amount, and network in your wallet.
        </p>
      ) : null}
      {state.phase === 'pending' ? (
        <p className="mt-1 text-xs leading-5 text-[#7c8b8b]">Submitted. Waiting for a successful receipt.</p>
      ) : null}
      {state.message !== null ? <p className="mt-1 text-xs leading-5 text-[#f2ca85]">{state.message}</p> : null}
      {state.hash !== null ? (
        <a
          className="mt-3 inline-flex font-mono text-[0.68rem] text-[#75f7e7] hover:text-white"
          href={transactionExplorerUrl(runtime.chain.explorerUrl, state.hash)}
          rel="noreferrer"
          target="_blank"
        >
          {state.hash.slice(0, 10)}…{state.hash.slice(-8)} ↗
        </a>
      ) : null}
    </div>
  );
}

export function guardedActionLabel(
  readiness: TransactionReadiness,
  readyLabel: string,
  busyLabel: string,
  isBusy: boolean,
): string {
  if (isBusy) return busyLabel;
  if (readiness === 'demo-disabled') return 'Live deployment required';
  if (readiness === 'disconnected') return 'Connect wallet to continue';
  if (readiness === 'wrong-network') return 'Switch network to continue';
  return readyLabel;
}
