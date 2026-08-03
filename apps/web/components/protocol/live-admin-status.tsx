'use client';

import { Badge, Card, Notice, SectionHeading, TableShell } from '@gumball-6900/ui';

import { useLiveAdminSnapshot } from '../../hooks/use-live-admin-snapshot';
import { useRhjMetadata } from '../../hooks/use-rhj-metadata';
import { formatAddress, formatUnits } from '../../lib/format';
import type { KnownOperationState } from '../../lib/live-admin-snapshot';
import { registryTestId } from '../../lib/registry-presentation';
import { useRuntimeDeployment } from './runtime-context';

function timestampLabel(timestamp: bigint): string {
  const milliseconds = timestamp * 1_000n;
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) return `Unix ${timestamp.toString()}`;
  return new Date(Number(milliseconds)).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function durationLabel(seconds: bigint): string {
  const days = seconds / 86_400n;
  const hours = (seconds % 86_400n) / 3_600n;
  if (days > 0n) return `${days.toString()}d ${hours.toString()}h`;
  const minutes = (seconds % 3_600n) / 60n;
  return `${hours.toString()}h ${minutes.toString()}m`;
}

function stateTone(state: KnownOperationState): 'neutral' | 'info' | 'positive' | 'warning' {
  if (state === 'pending') return 'info';
  if (state === 'matured') return 'positive';
  if (state === 'expired') return 'warning';
  return 'neutral';
}

function SnapshotUnavailable({ loading, surface }: { loading: boolean; surface: string }) {
  return (
    <Notice
      className="mt-5"
      data-testid={`${surface}-admin-snapshot-unavailable`}
      title={loading ? 'Admin snapshot loading' : 'Admin snapshot unavailable'}
      tone={loading ? 'info' : 'warning'}
    >
      {loading
        ? 'Reading every manifest-bound admin target at one pinned block.'
        : 'The complete contract graph could not be validated. Current controls and queue state are hidden rather than partially inferred.'}
    </Notice>
  );
}

function RhjAdminAlerts() {
  const runtime = useRuntimeDeployment();
  const metadata = useRhjMetadata();
  if (runtime.mode === 'demo') return null;
  if (metadata.source === 'unsupported') {
    return (
      <Notice className="mt-5" title="Issuer status not asserted on testnet" tone="warning">
        Official Robinhood registry, trading-halt, and corporate-action evidence is unavailable on chain 46630. The
        admin view does not infer mainnet issuer status from manifest labels.
      </Notice>
    );
  }
  if (metadata.source === 'loading') {
    return (
      <Notice className="mt-5" title="Loading reconciled issuer evidence" tone="info">
        External stock-token alerts remain hidden until the fixed RHJ response matches manifest addresses and UIDs.
      </Notice>
    );
  }
  if (metadata.source === 'unavailable' || metadata.data === undefined) {
    return (
      <Notice className="mt-5" title="Issuer evidence unavailable" tone="warning">
        Registry status, trading halts, and corporate actions are not inferred without a reconciled RHJ snapshot.
      </Notice>
    );
  }
  const alerts = metadata.data.assets.filter(
    (asset) =>
      asset.registryStatus !== 'ASSET_STATUS_ACTIVE' ||
      asset.isTradingHalt !== false ||
      asset.pendingMultiplier !== null ||
      asset.corporateActions.length > 0 ||
      asset.warnings.length > 0,
  );
  return (
    <Card className="mt-5 p-5 sm:p-7" data-testid="admin-rhj-alerts">
      <SectionHeading
        action={<Badge tone={alerts.length === 0 ? 'positive' : 'warning'}>{alerts.length.toString()} alerts</Badge>}
        description="Only reconciled RHJ registry, halt, multiplier, and corporate-action evidence appears here. It is read-only and never changes vault accounting or redemption."
        eyebrow="External evidence"
        title="Stock-token issuer context"
      />
      {alerts.length === 0 ? (
        <p className="mt-6 text-sm text-[#879696]">No RHJ context alerts were reported in the reconciled snapshot.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {alerts.map((asset) => (
            <div
              className="rounded-2xl border border-[#f4c56a]/15 bg-[#f4c56a]/5 p-4"
              data-testid={registryTestId('admin-rhj-alert', asset.address)}
              key={asset.address.toLowerCase()}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">
                  {asset.symbol} · {formatAddress(asset.address)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={asset.registryStatus === 'ASSET_STATUS_ACTIVE' ? 'positive' : 'warning'}>
                    {asset.registryStatus.replace('ASSET_STATUS_', '').toLowerCase()}
                  </Badge>
                  <Badge tone={asset.isTradingHalt === false ? 'positive' : 'warning'}>
                    {asset.isTradingHalt === null ? 'halt unknown' : asset.isTradingHalt ? 'halted' : 'open'}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#a99a7a]">
                {asset.pendingMultiplier === null
                  ? 'No pending multiplier.'
                  : `Pending multiplier ${asset.pendingMultiplier}×.`}{' '}
                {asset.corporateActions.length.toString()} corporate action
                {asset.corporateActions.length === 1 ? '' : 's'} reported.
                {asset.warnings.length === 0 ? '' : ` ${asset.warnings.join(' ')}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function LiveAdminOperationalStatus() {
  const runtime = useRuntimeDeployment();
  const snapshot = useLiveAdminSnapshot();
  if (runtime.mode === 'demo') return null;
  if (snapshot.data === undefined) {
    return <SnapshotUnavailable loading={snapshot.source === 'live-loading'} surface="operational" />;
  }
  const data = snapshot.data;
  const stale = snapshot.source === 'live-stale';
  const operationalDrift = data.assets.filter((asset) => {
    if (asset.genesisSymbol === null) return false;
    const signed = runtime.assetMetadata[asset.genesisSymbol];
    return (
      asset.acquisitionEnabled !== signed.acquisitionEnabled || asset.redemptionEnabled !== signed.redemptionEnabled
    );
  });
  const alertStrategies = data.strategies.filter(
    (strategy) => strategy.expired || strategy.fillsPaused || !strategy.registryLive || strategy.voterDisabled,
  );
  const scheduled = data.operations.filter((operation) => operation.state !== 'unscheduled');

  return (
    <>
      <Card className="p-5 sm:p-7" data-testid="live-admin-operational-status">
        <SectionHeading
          action={
            <Badge tone={stale ? 'warning' : 'info'}>
              {stale ? 'Stale' : 'Pinned'} block {data.blockNumber.toString()}
            </Badge>
          }
          description="Guardian, timelock, registry, voter, mining, and strategy state read at one hash-revalidated block. Redemption has no pause control."
          eyebrow="Bounded controls"
          title="Current operational status"
        />
        {stale ? (
          <Notice className="mt-5" title="Read-only stale snapshot" tone="warning">
            The latest refresh failed. These values remain visible for diagnosis, but every admin action is disabled.
          </Notice>
        ) : null}
        {!data.guardian.operatorMatchesManifest ? (
          <Notice className="mt-5" title="Guardian operator differs from the signed runtime" tone="warning">
            The onchain operator is {formatAddress(data.guardian.operator)}. Guardian writes remain disabled until a
            reviewed runtime identifies the current operator.
          </Notice>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#718080]">Mining contributions</p>
            <p className="mt-2 font-semibold text-white">
              {data.mining.contributionsPaused ? 'Paused' : 'Open'} · epoch #{data.mining.currentEpochId.toString()}
            </p>
            <p className="mt-1 text-[0.65rem] text-[#718080]">
              {data.mining.currentEpochInvalidated
                ? 'Current epoch invalidated'
                : data.mining.currentEpochSettled
                  ? 'Current epoch settled'
                  : 'Current epoch unsettled'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#718080]">Signal activations</p>
            <p className="mt-2 font-semibold text-white">{data.voter.signalActivationsPaused ? 'Paused' : 'Active'}</p>
          </div>
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#718080]">Known queued ops</p>
            <p className="mt-2 font-semibold text-white">{scheduled.length.toString()}</p>
          </div>
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#718080]">Snapshot time</p>
            <p className="mt-2 text-xs font-semibold text-white">{timestampLabel(data.blockTimestamp)}</p>
          </div>
        </div>

        <dl className="mt-4 grid gap-3 text-xs lg:grid-cols-3">
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <dt className="font-bold uppercase tracking-[0.12em] text-[#718080]">Current guardian operator</dt>
            <dd className="mt-2 break-all font-mono text-white">{data.guardian.operator}</dd>
          </div>
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <dt className="font-bold uppercase tracking-[0.12em] text-[#718080]">Immutable timelock proposer</dt>
            <dd className="mt-2 break-all font-mono text-white">{data.timelock.proposer}</dd>
          </div>
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <dt className="font-bold uppercase tracking-[0.12em] text-[#718080]">Bounded delay / execution grace</dt>
            <dd className="mt-2 text-white">
              {durationLabel(data.timelock.boundedMaintenanceDelay)} /{' '}
              {durationLabel(data.timelock.executionGracePeriod)}
            </dd>
          </div>
        </dl>

        {operationalDrift.length > 0 ? (
          <Notice className="mt-5" title="Manifest-bound asset control changes" tone="warning">
            {operationalDrift.map(({ symbol }) => symbol).join(', ')} acquisition or redemption readiness differs from
            the signed deployment baseline. Current onchain flags shown below are authoritative for operations.
          </Notice>
        ) : null}
        {alertStrategies.length > 0 ? (
          <Notice className="mt-5" title={`${alertStrategies.length.toString()} strategy alerts`} tone="warning">
            Paused, disabled, inactive, or expired auction state requires review. An expired auction may be restarted
            permissionlessly at the unchanged reference; this UI does not invent or accept a replacement reference rate.
          </Notice>
        ) : null}

        <TableShell className="mt-6">
          <table className="financial-table min-w-[84rem]">
            <caption className="sr-only">Current strategy pause, registry, voter, and auction status</caption>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Acquisition</th>
                <th>Registry</th>
                <th>Voter</th>
                <th>Fills</th>
                <th>Auction</th>
                <th>Exact current rate</th>
                <th>Reference / bounds</th>
              </tr>
            </thead>
            <tbody>
              {data.strategies.map((strategy) => {
                const asset =
                  strategy.kind === 'buyback'
                    ? undefined
                    : data.assets.find(({ token }) => token.toLowerCase() === strategy.token.toLowerCase());
                return (
                  <tr
                    data-testid={registryTestId('live-admin-strategy', strategy.strategy)}
                    key={strategy.strategy.toLowerCase()}
                  >
                    <td>
                      <p className="font-semibold text-white">{strategy.symbol}</p>
                      <p className="mt-0.5 text-[0.65rem] text-[#718080]">{formatAddress(strategy.strategy)}</p>
                    </td>
                    <td>
                      <Badge tone={asset === undefined || asset.acquisitionEnabled ? 'positive' : 'warning'}>
                        {asset === undefined ? 'Standalone' : asset.acquisitionEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {asset !== undefined && !asset.redemptionEnabled ? (
                        <p className="mt-1 text-[0.64rem] text-[#f6d58f]">Integration not ready</p>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={strategy.registryLive ? 'positive' : 'warning'}>
                        {strategy.registryLive ? 'Live' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={strategy.voterDisabled ? 'warning' : 'positive'}>
                        {strategy.voterDisabled ? 'Disabled' : 'Enabled'}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={strategy.fillsPaused ? 'warning' : 'positive'}>
                        {strategy.fillsPaused ? 'Paused' : 'Open'}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={strategy.expired ? 'warning' : 'info'}>
                        #{strategy.auctionId.toString()} · {strategy.expired ? 'Expired' : 'Active'}
                      </Badge>
                      <p className="mt-1 text-[0.64rem] text-[#718080]">
                        {durationLabel(data.blockTimestamp - strategy.auctionStartTime)} old
                      </p>
                    </td>
                    <td className="font-semibold text-white tabular-nums">
                      {formatUnits(strategy.currentRate, 18, { maximumFractionDigits: 18 })}
                      <p className="mt-1 text-[0.64rem] font-normal text-[#718080]">
                        target units / USDG · not a price
                      </p>
                    </td>
                    <td className="tabular-nums">
                      {formatUnits(strategy.referenceRate, 18, { maximumFractionDigits: 18 })}
                      <p className="mt-1 text-[0.64rem] text-[#718080]">
                        {formatUnits(strategy.floorRate, 18, { maximumFractionDigits: 18 })}–
                        {formatUnits(strategy.startRate, 18, { maximumFractionDigits: 18 })}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      </Card>
      <RhjAdminAlerts />
    </>
  );
}

export function LiveTimelockQueue() {
  const runtime = useRuntimeDeployment();
  const snapshot = useLiveAdminSnapshot();
  if (runtime.mode === 'demo') return null;
  if (snapshot.data === undefined) {
    return <SnapshotUnavailable loading={snapshot.source === 'live-loading'} surface="queue" />;
  }
  const scheduled = snapshot.data.operations.filter((operation) => operation.state !== 'unscheduled');
  return (
    <Card className="p-5 sm:p-7" data-testid="live-timelock-queue">
      <SectionHeading
        action={
          <Badge tone={snapshot.source === 'live-stale' ? 'warning' : 'info'}>
            {scheduled.length.toString()} active known
          </Badge>
        }
        description={`Authoritative operationReadyAt values for the UI's ${snapshot.data.operations.length.toString()} typed registry-derived unpause operations at block ${snapshot.data.blockNumber.toString()}.`}
        eyebrow="ProtocolTimelock"
        title="Known operation queue"
      />
      {scheduled.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-5 py-10 text-center">
          <p className="text-sm font-semibold text-[#b7c2c0]">No active known unpause operations</p>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#657373]">
            This statement is limited to the fixed mining, signal, and strategy operations encoded by this UI.
          </p>
        </div>
      ) : (
        <TableShell className="mt-6">
          <table className="financial-table min-w-[62rem]">
            <caption className="sr-only">Active known ProtocolTimelock operations</caption>
            <thead>
              <tr>
                <th>Operation</th>
                <th>State</th>
                <th>Ready at</th>
                <th>Expires at</th>
                <th>Delay</th>
                <th>Operation ID</th>
              </tr>
            </thead>
            <tbody>
              {scheduled.map((operation) => (
                <tr data-testid={`live-timelock-operation-${operation.key}`} key={operation.key}>
                  <td className="font-semibold text-white">{operation.label}</td>
                  <td>
                    <Badge tone={stateTone(operation.state)}>{operation.state}</Badge>
                  </td>
                  <td className="tabular-nums">{timestampLabel(operation.readyAt)}</td>
                  <td className="tabular-nums">
                    {operation.expiresAt === null ? 'Unavailable' : timestampLabel(operation.expiresAt)}
                  </td>
                  <td>{durationLabel(operation.delay)}</td>
                  <td className="font-mono text-[0.65rem] text-[#8fa09f]">{formatAddress(operation.operationId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
      <Notice className="mt-5" title="Historical queue events are not indexed" tone="warning">
        The current subgraph schema has no ProtocolTimelock schedule, execute, or cancel entities. This view therefore
        reports current mappings for known operations only and does not claim a complete historical audit trail.
      </Notice>
    </Card>
  );
}
