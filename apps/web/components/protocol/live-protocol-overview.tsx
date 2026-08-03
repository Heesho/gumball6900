'use client';

import { Badge, Card, Notice, SectionHeading, StatCard, TableShell, TokenMark } from '@gumball-6900/ui';

import { useLiveProtocolOverview } from '../../hooks/use-live-protocol-overview';
import { useProtocolSummary } from '../../hooks/use-protocol-summary';
import { useRhjMetadata } from '../../hooks/use-rhj-metadata';
import { formatAddress, formatBps, formatRatioPercent, formatToken, formatUnits } from '../../lib/format';
import { protocolSnapshot } from '../../lib/read-model';
import type { LiveStrategyOverview } from '../../lib/live-protocol-overview';
import { registryPresentation, registryTestId } from '../../lib/registry-presentation';
import { resolveUiAdjustedExposure } from '../../lib/ui-adjusted-exposure';
import { useRuntimeDeployment } from './runtime-context';

function exactTokenAmount(value: bigint, decimals: number, symbol: string): string {
  return `${formatUnits(value, decimals, { maximumFractionDigits: decimals })} ${symbol}`;
}

function overviewSourceLabel(source: string, rehearsal: boolean, blockNumber: bigint): string {
  const prefix = source === 'live-stale' ? 'Stale' : rehearsal ? 'Rehearsal' : 'Pinned';
  return `${prefix} block ${blockNumber.toString()}`;
}

function OverviewUnavailable({ loading, surface }: { loading: boolean; surface: string }) {
  return (
    <Notice
      data-testid={`${surface}-overview-unavailable`}
      title={loading ? 'Contract snapshot loading' : 'Contract snapshot unavailable'}
      tone={loading ? 'info' : 'warning'}
    >
      {loading
        ? 'Reading the signed GumBallLens contract at one pinned block.'
        : 'The signed Lens response could not be validated. No demo or zero balances are substituted.'}
    </Notice>
  );
}

export function HomeBuybackStat() {
  const runtime = useRuntimeDeployment();
  const summary = useProtocolSummary();
  if (runtime.mode === 'demo') {
    return (
      <StatCard
        detail={`${formatToken(protocolSnapshot.buybackUSDGAllTime, 'USDG')} in deterministic demo fills`}
        label="Demo buyback burn"
        value={formatToken(protocolSnapshot.buybackBurnedAllTime, 'GBX')}
      />
    );
  }
  const data = summary.data;
  const available = data !== undefined && (summary.source === 'live' || summary.source === 'stale');
  const source = summary.source === 'stale' ? 'Stale indexed aggregate' : 'Validated indexed aggregate';
  return (
    <StatCard
      detail={
        available
          ? `${exactTokenAmount(data.buybackSpentUSDGRaw, runtime.assetMetadata.USDG.decimals, 'USDG')} spent · ${source} at block ${data.indexedBlock.toString()}`
          : summary.source === 'loading'
            ? 'Loading the event-derived protocol aggregate'
            : 'Validated indexed buyback totals are unavailable; no zero is substituted'
      }
      label="All-time buyback burn"
      value={
        available
          ? exactTokenAmount(data.buybackBurnedGBXRaw, runtime.assetMetadata.GBX.decimals, 'GBX')
          : 'Unavailable'
      }
    />
  );
}

export function HomeVaultBalances() {
  const runtime = useRuntimeDeployment();
  const overview = useLiveProtocolOverview();
  if (runtime.mode === 'demo') return null;
  if (overview.data === undefined) {
    return <OverviewUnavailable loading={overview.source === 'live-loading'} surface="home-vault" />;
  }
  const data = overview.data;
  const stale = overview.source === 'live-stale';
  return (
    <Card className="p-5 sm:p-6" data-testid="home-live-vault-balances">
      <SectionHeading
        action={
          <Badge tone={stale ? 'warning' : 'info'}>
            {overviewSourceLabel(overview.source, runtime.runtimeKind === 'local-rehearsal', data.blockNumber)}
          </Badge>
        }
        description="Exact ERC-20 balances held by GumBallVault. Unlike token units are deliberately not summed into a NAV."
        eyebrow="GumBallVault"
        title="Raw basket balances"
      />
      {stale ? (
        <Notice className="mt-5" title="Showing the last validated block" tone="warning">
          The latest refresh failed. Values remain pinned to the displayed block and are not presented as current.
        </Notice>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {data.assets.map((asset) => (
          <div
            className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/7 bg-[#0b1213]/60 p-3"
            data-testid={registryTestId('home-live-vault-asset', asset.token)}
            key={asset.token}
          >
            <div className="flex min-w-0 items-center gap-3">
              <TokenMark
                color={registryPresentation(asset.symbol, asset.token).color}
                size="sm"
                symbol={asset.symbol}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#dbe4e2]">{asset.symbol}</p>
                <p className="truncate text-[0.65rem] text-[#687777]">{formatAddress(asset.token)}</p>
              </div>
            </div>
            <p
              className="min-w-0 truncate text-right text-xs font-semibold text-white tabular-nums"
              title={exactTokenAmount(asset.vaultBalance, asset.decimals, asset.symbol)}
            >
              {exactTokenAmount(asset.vaultBalance, asset.decimals, asset.symbol)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function strategyShare(row: LiveStrategyOverview, totalWeight: bigint): string {
  return totalWeight === 0n ? '0%' : formatRatioPercent(row.activeWeight, totalWeight, 2);
}

function strategyShareBps(row: LiveStrategyOverview, totalWeight: bigint): bigint {
  return totalWeight === 0n ? 0n : (row.activeWeight * 10_000n) / totalWeight;
}

export function LiveAllocationComposition({ compact = false }: { compact?: boolean }) {
  const runtime = useRuntimeDeployment();
  const overview = useLiveProtocolOverview();
  if (runtime.mode === 'demo') return null;
  if (overview.data === undefined) {
    return <OverviewUnavailable loading={overview.source === 'live-loading'} surface="home-allocation" />;
  }
  const totalWeight = overview.data.strategies.reduce((total, row) => total + row.activeWeight, 0n);
  return (
    <div className={compact ? 'space-y-3' : 'space-y-3.5'} data-testid="home-live-allocation">
      {overview.source === 'live-stale' ? (
        <p className="text-xs font-semibold text-[#f6d58f]">
          Stale pinned allocation · block {overview.data.blockNumber.toString()}
        </p>
      ) : (
        <p className="text-xs text-[#718080]">Pinned block {overview.data.blockNumber.toString()}</p>
      )}
      {overview.data.strategies.map((row) => {
        const shareBps = strategyShareBps(row, totalWeight);
        const presentation = registryPresentation(row.symbol, row.strategy, row.kind);
        return (
          <div data-testid={registryTestId('home-live-allocation', row.strategy)} key={row.strategy}>
            <div className="mb-1.5 flex items-start justify-between gap-4 text-xs">
              <div>
                <p className="font-medium text-[#aab7b6]">{presentation.label}</p>
                <p className="mt-0.5 text-[0.65rem] text-[#667575]">
                  {exactTokenAmount(row.virtualUSDGBudget, runtime.assetMetadata.USDG.decimals, 'USDG virtual budget')}
                  {!row.live ? ' · registry inactive' : row.voterDisabled ? ' · allocation disabled' : ''}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-[#dde6e4] tabular-nums">
                {strategyShare(row, totalWeight)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
              <div
                className="h-full rounded-full"
                style={{ backgroundColor: presentation.color, width: formatBps(shareBps, 2) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LiveVaultBacking() {
  const runtime = useRuntimeDeployment();
  const overview = useLiveProtocolOverview();
  const rhj = useRhjMetadata();
  if (runtime.mode === 'demo') return null;
  if (overview.data === undefined) {
    return <OverviewUnavailable loading={overview.source === 'live-loading'} surface="vault" />;
  }
  const { assets, blockNumber, strategies } = overview.data;
  const stale = overview.source === 'live-stale';
  const totalWeight = strategies.reduce((total, row) => total + row.activeWeight, 0n);
  const totalRawVaultUnits = assets.reduce((total, asset) => total + asset.vaultBalance, 0n);
  const usdGDecimals = runtime.assetMetadata.USDG.decimals;
  const gbxDecimals = runtime.assetMetadata.GBX.decimals;

  return (
    <div data-testid="live-vault-backing">
      {stale ? (
        <Notice className="mb-5" title="Showing the last validated vault block" tone="warning">
          The current refresh failed. Every displayed value remains pinned to block {blockNumber.toString()}.
        </Notice>
      ) : null}
      {rhj.source === 'stale' ? (
        <Notice className="mb-5" title="Adjusted stock exposure uses an older verified snapshot" tone="warning">
          The latest RHJ refresh failed. Raw Lens balances remain pinned to their displayed block; adjusted stock-token
          exposure uses the separately timestamped multiplier snapshot shown in the verified RHJ context and is labeled
          stale.
        </Notice>
      ) : rhj.source === 'loading' ? (
        <Notice className="mb-5" title="Adjusted stock exposure loading">
          Raw vault balances are available. Verified stock-token multipliers are still loading, so adjusted display
          exposure is not inferred.
        </Notice>
      ) : rhj.source === 'unavailable' ? (
        <Notice className="mb-5" title="Adjusted stock exposure unavailable" tone="warning">
          Raw vault balances remain authoritative. The verified RHJ multiplier snapshot is unavailable, and no default
          multiplier is substituted.
        </Notice>
      ) : rhj.source === 'unsupported' ? (
        <Notice className="mb-5" title="Adjusted stock exposure unavailable on this network" tone="warning">
          The local or testnet runtime has no validated Robinhood stock-token metadata. Raw balances are still shown
          without a mainnet multiplier substitution.
        </Notice>
      ) : null}
      <Card className="p-5 sm:p-7">
        <SectionHeading
          action={
            <Badge tone={stale ? 'warning' : 'info'}>
              {overviewSourceLabel(overview.source, runtime.runtimeKind === 'local-rehearsal', blockNumber)}
            </Badge>
          }
          description="Each balance is reported by GumBallLens at one block. The raw-unit percentages compare atomic-unit counts only and are not an oracle-derived NAV."
          eyebrow="Signed contract graph"
          title={`${assets.length.toString()} registered raw balances`}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {assets.map((asset) => {
            const presentation = registryPresentation(asset.symbol, asset.token);
            const adjusted = asset.isStockToken
              ? resolveUiAdjustedExposure(asset.vaultBalance, asset.token, asset.symbol, rhj.data?.assets)
              : null;
            const rawUnitPercentage =
              totalRawVaultUnits === 0n ? '0%' : formatRatioPercent(asset.vaultBalance, totalRawVaultUnits, 4);
            return (
              <Card
                className="p-4"
                data-testid={registryTestId('live-vault-asset-row', asset.token)}
                key={asset.token}
                tone="subtle"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <TokenMark color={presentation.color} symbol={asset.symbol} />
                    <div>
                      <p className="text-sm font-semibold text-[#e0e8e7]">{asset.symbol}</p>
                      <p className="mt-0.5 text-[0.65rem] text-[#647272]">
                        {asset.isStockToken ? 'Stock token' : 'ERC-20 asset'}
                      </p>
                    </div>
                  </div>
                  <Badge tone={asset.acquisitionEnabled ? 'positive' : 'warning'}>
                    {asset.acquisitionEnabled ? 'Acquire' : 'Acquire off'}
                  </Badge>
                </div>
                <div className="mt-5">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#647272]">
                    Raw vault balance
                  </p>
                  <p
                    className="mt-1 break-words text-base font-semibold tracking-[-0.025em] text-white tabular-nums"
                    title={exactTokenAmount(asset.vaultBalance, asset.decimals, asset.symbol)}
                  >
                    {exactTokenAmount(asset.vaultBalance, asset.decimals, asset.symbol)}
                  </p>
                  <div
                    aria-label={`${asset.symbol} percentage of total raw vault units, not asset value: ${rawUnitPercentage}`}
                    className="mt-3 flex items-center justify-between gap-3 text-[0.68rem]"
                    data-testid={registryTestId('live-vault-raw-unit-share', asset.token)}
                  >
                    <span className="text-[#718080]">Percentage of total raw vault units</span>
                    <span className="font-semibold text-[#c9fff8] tabular-nums">{rawUnitPercentage}</span>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-white/6 bg-[#071011]/55 p-3">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#647272]">
                    UI-adjusted display
                  </p>
                  {!asset.isStockToken ? (
                    <p className="mt-1 text-xs text-[#788787]">Not applicable to this asset</p>
                  ) : adjusted === null ? (
                    <p className="mt-1 text-xs font-semibold text-[#f6d58f]">
                      Unavailable · raw units above remain exact
                    </p>
                  ) : (
                    <>
                      <p
                        className="mt-1 break-words text-sm font-semibold text-[#c9fff8] tabular-nums"
                        data-testid={registryTestId('live-vault-adjusted', asset.token)}
                        title={`${formatUnits(adjusted.amountRaw, asset.decimals, { maximumFractionDigits: asset.decimals })} underlying-share units`}
                      >
                        {formatUnits(adjusted.amountRaw, asset.decimals, { maximumFractionDigits: asset.decimals })}{' '}
                        underlying-share units
                      </p>
                      <p className="mt-1 text-[0.62rem] text-[#718080]">
                        {formatUnits(adjusted.multiplierWad, 18, { maximumFractionDigits: 18 })}×{' '}
                        {adjusted.multiplierSource}
                        {rhj.source === 'stale' ? ' · stale metadata' : ''}
                      </p>
                    </>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/6 pt-3 text-[0.65rem]">
                  <span className="text-[#637171]">{formatAddress(asset.token)}</span>
                  <span className={asset.redemptionEnabled ? 'text-[#8efff1]' : 'text-[#f6d58f]'}>
                    {asset.redemptionEnabled ? 'Redemption ready' : 'Integration not ready'}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
        <Notice className="mt-5" title="Raw-unit percentages are not value weights">
          Each percentage divides one token&apos;s raw atomic-unit count by the sum of every registered token&apos;s raw
          atomic-unit count. Token decimals differ, so this literal raw-unit comparison is not basket composition,
          economic exposure, backing value, or NAV.
        </Notice>
      </Card>

      <Card className="mt-5 p-5 sm:p-7">
        <SectionHeading
          description="Active signal shares are derived only from exact bigint weights at the same pinned block. Virtual USDG budgets are accounting values, not vault balances."
          eyebrow="AllocationVoter"
          title="Live weights and strategy budgets"
        />
        <TableShell className="mt-6">
          <table className="financial-table min-w-[62rem]">
            <caption className="sr-only">Live allocation weights and virtual USDG strategy budgets</caption>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Active share</th>
                <th>Exact active weight</th>
                <th>Exact virtual budget</th>
                <th>Registry</th>
                <th>Voter</th>
                <th>Contract</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((row) => (
                <tr data-testid={registryTestId('live-vault-strategy-row', row.strategy)} key={row.strategy}>
                  <td>
                    <div className="flex items-center gap-3">
                      <TokenMark
                        color={registryPresentation(row.symbol, row.strategy, row.kind).color}
                        size="sm"
                        symbol={row.symbol}
                      />
                      <div>
                        <p className="font-semibold text-white">
                          {registryPresentation(row.symbol, row.strategy, row.kind).label}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-[#647272]">{row.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-semibold text-white tabular-nums">{strategyShare(row, totalWeight)}</td>
                  <td className="tabular-nums">{exactTokenAmount(row.activeWeight, gbxDecimals, 'sGBX')}</td>
                  <td className="tabular-nums">{exactTokenAmount(row.virtualUSDGBudget, usdGDecimals, 'USDG')}</td>
                  <td>
                    <Badge tone={row.live ? 'positive' : 'warning'}>{row.live ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td>
                    <Badge tone={row.voterDisabled ? 'warning' : 'positive'}>
                      {row.voterDisabled ? 'Disabled' : 'Enabled'}
                    </Badge>
                  </td>
                  <td className="text-[#8fa09f]">{formatAddress(row.strategy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Card>
    </div>
  );
}
