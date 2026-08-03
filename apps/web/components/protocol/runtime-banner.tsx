'use client';

import { Badge, Notice } from '@gumball-6900/ui';

import { useProtocolSnapshot } from '../../hooks/use-protocol-reads';
import { formatToken } from '../../lib/format';
import { getRuntimeStatusCopy } from '../../lib/runtime-copy';
import { useRuntimeDeployment } from './runtime-context';

export function ProtocolRuntimeBanner() {
  const runtime = useRuntimeDeployment();
  const snapshot = useProtocolSnapshot();
  const statusCopy = getRuntimeStatusCopy(runtime);

  if (runtime.mode === 'demo') {
    return (
      <Notice className="mb-6" title={statusCopy.bannerTitle} tone="warning">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <span>
            Values are typed deterministic preview data. Live configuration is{' '}
            {runtime.fallbackReason.replaceAll('-', ' ')}; reads and writes are disabled against unverified addresses.
          </span>
          <Badge tone="warning">Demo · no writes</Badge>
        </div>
      </Notice>
    );
  }

  if (runtime.runtimeKind === 'local-rehearsal') {
    const warning = snapshot.source === 'rpc-fallback' || snapshot.source === 'live-stale';
    const rehearsalSource =
      snapshot.source === 'live'
        ? 'rehearsal RPC'
        : snapshot.source === 'live-loading'
          ? 'rehearsal RPC loading'
          : snapshot.source === 'live-stale'
            ? 'stale rehearsal RPC'
            : snapshot.source.replaceAll('-', ' ');
    return (
      <Notice className="mb-6" title={statusCopy.bannerTitle} tone={warning ? 'warning' : 'info'}>
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <span>
            Contract reads and writes use a disposable localhost fixture. This is test evidence only, not a deployed,
            verified, audited, or release-approved network.
          </span>
          <Badge tone={warning ? 'warning' : 'info'}>{rehearsalSource} · disposable state</Badge>
        </div>
      </Notice>
    );
  }

  if (runtime.runtimeKind === 'testnet-candidate') {
    const warning = snapshot.source === 'rpc-fallback' || snapshot.source === 'live-stale';
    const testnetSource =
      snapshot.source === 'live'
        ? 'testnet RPC'
        : snapshot.source === 'live-loading'
          ? 'testnet RPC loading'
          : snapshot.source === 'live-stale'
            ? 'stale testnet RPC'
            : snapshot.source.replaceAll('-', ' ');
    return (
      <Notice className="mb-6" title={statusCopy.bannerTitle} tone={warning ? 'warning' : 'info'}>
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <span>
            Contract reads and writes target a remote Robinhood Chain testnet deployment described by a validated,
            signed testnet-candidate manifest. Bespoke v4 contracts are candidate-only; this is not canonical mainnet,
            release-approved, audited, or launch evidence.
          </span>
          <Badge tone={warning ? 'warning' : 'info'}>
            {testnetSource} · {runtime.manifest.version}
          </Badge>
        </div>
      </Notice>
    );
  }

  const copy =
    snapshot.source === 'live'
      ? `Live core SDK reads${snapshot.isRefreshing ? ' (refreshing)' : ''} · ${formatToken(snapshot.data.totalSupply, 'GBX')} total supply. Values marked indexed or display estimate remain offchain presentation data.`
      : snapshot.source === 'live-loading'
        ? 'Loading signed-manifest contract state from the configured production RPC.'
        : snapshot.source === 'live-stale'
          ? 'The latest RPC refresh failed. The last successful onchain values are retained and marked stale; transaction simulation remains mandatory.'
          : 'RPC reads failed; unavailable contract fields remain hidden and writes still require exact simulation.';
  const warning = snapshot.source === 'rpc-fallback' || snapshot.source === 'live-stale';
  return (
    <Notice className="mb-6" title={statusCopy.bannerTitle} tone={warning ? 'warning' : 'positive'}>
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <span>{copy}</span>
        <Badge tone={snapshot.source === 'live' ? 'positive' : warning ? 'warning' : 'info'}>
          {snapshot.source.replaceAll('-', ' ')} · {runtime.manifest.version}
        </Badge>
      </div>
    </Notice>
  );
}
