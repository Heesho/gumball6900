'use client';

import { Badge, Card, Notice, SectionHeading, TableShell, TokenMark } from '@gumball-6900/ui';

import { useRhjMetadata } from '../../hooks/use-rhj-metadata';
import type { PublicRhjCorporateAction } from '../../lib/rhj-client';
import { registryTestId } from '../../lib/registry-presentation';
import { useRuntimeDeployment } from './runtime-context';

function corporateActionLabel(action: PublicRhjCorporateAction | undefined): string {
  if (action === undefined) return 'None reported';
  const date = action.processDate;
  const dateLabel =
    date === null
      ? 'date pending'
      : `${date.year.toString()}-${date.month.toString().padStart(2, '0')}-${date.day.toString().padStart(2, '0')}`;
  return `${action.type.replaceAll('_', ' ')} · ${action.status} · ${dateLabel}`;
}

function CorporateActionHistory({ actions, symbol }: { actions: readonly PublicRhjCorporateAction[]; symbol: string }) {
  if (actions.length === 0) return 'None reported';
  return (
    <ol aria-label={`${symbol} corporate-action history`} className="space-y-1.5">
      {actions.map((action, index) => (
        <li className="text-[0.72rem] leading-5" key={`${action.type}:${action.status}:${index.toString()}`}>
          {corporateActionLabel(action)}
        </li>
      ))}
    </ol>
  );
}

export function VaultRhjContext() {
  const runtime = useRuntimeDeployment();
  const metadata = useRhjMetadata();
  if (runtime.mode === 'demo') return null;

  if (metadata.source === 'unsupported') {
    return (
      <Notice className="mt-5" title="RHJ metadata unavailable on testnet" tone="warning">
        Official Robinhood stock-token registry, halt, and corporate-action metadata is served only for validated chain
        4663 deployments. No mainnet metadata is substituted into this rehearsal.
      </Notice>
    );
  }

  const alerts =
    metadata.data?.assets.filter(
      (asset) =>
        asset.isTradingHalt === true ||
        asset.registryStatus !== 'ASSET_STATUS_ACTIVE' ||
        asset.pendingMultiplier !== null ||
        asset.corporateActions.length > 0,
    ) ?? [];

  return (
    <Card className="mt-5 p-5 sm:p-7" data-testid="rhj-vault-context">
      <SectionHeading
        action={
          metadata.data === undefined ? (
            <Badge tone="warning">{metadata.source}</Badge>
          ) : (
            <div className="flex flex-wrap gap-2">
              {metadata.source === 'stale' ? <Badge tone="warning">Stale snapshot</Badge> : null}
              <Badge tone={metadata.data.sources.assets === 'unavailable' ? 'warning' : 'positive'}>
                Registry {metadata.data.sources.assets}
              </Badge>
              <Badge tone={metadata.data.sources.corporateActions === 'unavailable' ? 'warning' : 'info'}>
                Actions {metadata.data.sources.corporateActions}
              </Badge>
            </div>
          )
        }
        description="Read-only Robinhood registry data is reconciled against signed-manifest addresses and UIDs plus onchain multipliers. It never enters vault accounting."
        eyebrow="Verified external context"
        title="Stock-token registry, halts, and actions"
      />
      {metadata.source === 'loading' ? (
        <p className="mt-6 text-sm text-[#879696]" role="status">
          Loading verified stock-token metadata…
        </p>
      ) : metadata.source === 'unavailable' ? (
        <Notice className="mt-6" title="Verified stock-token metadata unavailable" tone="warning">
          The fixed same-origin RHJ endpoint did not return a reconciled snapshot. Registry status, trading halts, and
          corporate actions are hidden rather than inferred.
        </Notice>
      ) : metadata.data !== undefined ? (
        <>
          {metadata.source === 'stale' ? (
            <Notice className="mt-6" title="Showing the last verified metadata snapshot" tone="warning">
              The current RHJ refresh failed. Multiplier, registry, halt, and corporate-action fields remain labeled as
              the older snapshot generated at the time shown below.
            </Notice>
          ) : null}
          {alerts.length > 0 ? (
            <Notice
              className="mt-6"
              title={`${alerts.length.toString()} stock-token context alert${alerts.length === 1 ? '' : 's'}`}
              tone="warning"
            >
              Review inactive status, trading halts, pending multipliers, and corporate actions before interpreting
              display exposure. These alerts do not disable in-kind redemption.
            </Notice>
          ) : null}
          <TableShell className="mt-6">
            <table className="financial-table min-w-[70rem]">
              <caption className="sr-only">Verified Robinhood stock-token metadata</caption>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Registry</th>
                  <th>Trading</th>
                  <th>UI multiplier</th>
                  <th>Pending multiplier</th>
                  <th>Corporate-action history</th>
                  <th>Identity</th>
                </tr>
              </thead>
              <tbody>
                {metadata.data.assets.map((asset) => (
                  <tr data-testid={registryTestId('rhj-asset', asset.address)} key={asset.address.toLowerCase()}>
                    <td>
                      <div className="flex items-center gap-3">
                        <TokenMark color="#8de0ff" size="sm" symbol={asset.symbol} />
                        <div>
                          <p className="font-semibold text-white">{asset.symbol}</p>
                          <p className="mt-0.5 text-[0.66rem] text-[#718080]">
                            {asset.tokenName} · registry #{asset.registryIndex.toString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={asset.registryStatus === 'ASSET_STATUS_ACTIVE' ? 'positive' : 'warning'}>
                        {asset.registryStatus.replace('ASSET_STATUS_', '').toLowerCase()}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={asset.isTradingHalt === false ? 'positive' : 'warning'}>
                        {asset.isTradingHalt === null ? 'Unavailable' : asset.isTradingHalt ? 'Halted' : 'Open'}
                      </Badge>
                    </td>
                    <td className="tabular-nums">
                      {asset.currentMultiplier === null ? 'Unavailable' : `${asset.currentMultiplier}×`}
                      <p className="mt-1 text-[0.64rem] text-[#718080]">{asset.currentMultiplierSource}</p>
                    </td>
                    <td className="tabular-nums">
                      {asset.pendingMultiplier === null ? 'None' : `${asset.pendingMultiplier}×`}
                      {asset.pendingMultiplierEffectiveTime === null ? null : (
                        <p className="mt-1 text-[0.64rem] text-[#718080]">{asset.pendingMultiplierEffectiveTime}</p>
                      )}
                    </td>
                    <td>
                      <CorporateActionHistory actions={asset.corporateActions} symbol={asset.symbol} />
                    </td>
                    <td>
                      <Badge
                        tone={
                          asset.verification.onchainUid === 'matched' && asset.verification.registry === 'matched'
                            ? 'positive'
                            : 'warning'
                        }
                      >
                        {asset.verification.onchainUid === 'matched' && asset.verification.registry === 'matched'
                          ? asset.identitySource === 'signed-genesis'
                            ? 'Manifest + chain + registry'
                            : 'AssetRegistry + chain + RHJ'
                          : 'Partial verification'}
                      </Badge>
                      <p className="mt-1 font-mono text-[0.62rem] text-[#718080]">
                        {asset.address.slice(0, 8)}…{asset.address.slice(-6)}
                      </p>
                      {asset.warnings.length > 0 ? (
                        <p className="mt-1 max-w-xs text-[0.64rem] leading-4 text-[#b99a69]">
                          {asset.warnings.join(' ')}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          <p className="mt-4 text-[0.68rem] leading-5 text-[#718080]">
            Registry block {metadata.data.registryBlockNumber} · snapshot generated{' '}
            {new Date(metadata.data.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC. Prices, where
            available upstream, are not multiplier-adjusted and are never used by contracts.
          </p>
        </>
      ) : null}
    </Card>
  );
}
