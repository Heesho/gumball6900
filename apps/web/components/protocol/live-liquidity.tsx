'use client';

import { Badge, Button, Card, Notice, SectionHeading, StatCard, TableShell } from '@gumball-6900/ui';

import { useLiveLiquidity, type LiveLiquiditySource } from '../../hooks/use-live-liquidity';
import { useProtocolSummary, type ProtocolSummarySource } from '../../hooks/use-protocol-summary';
import { formatAddress, formatBps, formatDecimalRatio, formatRatioPercent, formatUnits } from '../../lib/format';
import { useRuntimeDeployment } from './runtime-context';

function blockSource(source: LiveLiquiditySource, blockNumber?: bigint): string {
  const block = blockNumber?.toString() ?? 'unavailable';
  if (source === 'live-stale') return `Stale validated v4 snapshot · block ${block}`;
  if (source === 'live') return `Pinned validated v4 snapshot · block ${block}`;
  if (source === 'live-loading') return 'Pinned v4 snapshot loading';
  return 'Validated v4 snapshot unavailable';
}

function positionIndexSource(
  index: Readonly<{ indexedBlock: bigint; indexedBlockHash: `0x${string}`; source: 'genesis-fallback' | 'subgraph' }>,
): string {
  const hash = `${index.indexedBlockHash.slice(0, 10)}…${index.indexedBlockHash.slice(-6)}`;
  return index.source === 'subgraph'
    ? `Subgraph active-ID index · block ${index.indexedBlock.toString()} · ${hash}`
    : `Four genesis getters · block ${index.indexedBlock.toString()} · ${hash}`;
}

function feePercent(fee: number): string {
  return formatRatioPercent(BigInt(fee), 1_000_000n, 2);
}

function integer(value: bigint): string {
  return value.toLocaleString('en-US');
}

function exactTokenAmount(value: bigint, decimals: number, symbol: string): string {
  return `${formatUnits(value, decimals, { maximumFractionDigits: decimals })} ${symbol}`;
}

function gbxPriceUSDG(price: Readonly<{ numerator: bigint; denominator: bigint }>): string {
  const formatted = formatDecimalRatio(price.numerator, price.denominator, 8);
  return `${formatted === '0' && price.numerator > 0n ? '<0.00000001' : formatted} USDG`;
}

function feeSource(source: ProtocolSummarySource, blockNumber?: bigint): string {
  if (source === 'live')
    return `Event-derived Protocol aggregate · indexed block ${blockNumber?.toString() ?? 'unknown'}`;
  if (source === 'stale')
    return `Stale event-derived aggregate · indexed block ${blockNumber?.toString() ?? 'unknown'}`;
  if (source === 'loading') return 'Event-derived fee totals loading';
  return 'Event-derived fee totals unavailable';
}

function PoolReadNotice({ compact = false }: { compact?: boolean }) {
  const snapshot = useLiveLiquidity();
  const runtime = useRuntimeDeployment();
  const loading = snapshot.source === 'live-loading';
  const testnetCandidate = runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate';
  return (
    <Notice
      className={compact ? undefined : 'mt-5'}
      data-testid={loading ? 'live-liquidity-loading' : 'live-liquidity-error'}
      title={
        loading
          ? testnetCandidate
            ? 'Loading candidate pool state'
            : 'Loading canonical pool state'
          : testnetCandidate
            ? 'Candidate pool state unavailable'
            : 'Canonical pool state unavailable'
      }
      tone={loading ? 'info' : 'warning'}
    >
      {loading
        ? 'StateView, PositionManager, LiquidityManager, and token custody reads are being pinned to one block.'
        : 'The signed dependency graph or pinned RPC snapshot could not be validated. No demo value or zero is substituted.'}
      {!loading ? (
        <Button className="mt-4" onClick={() => void snapshot.refetch()} size="sm" variant="secondary">
          Retry pool reads
        </Button>
      ) : null}
    </Notice>
  );
}

function StalePoolNotice() {
  return (
    <Notice
      className="mb-5"
      data-testid="live-liquidity-stale"
      title="Showing the last validated pool block"
      tone="warning"
    >
      The latest refresh failed. Values below remain pinned to their displayed block and are stale; no mixed-block data
      is shown.
    </Notice>
  );
}

/** Compact Home stat backed by StateView active liquidity, never a display-value or NAV estimate. */
export function HomeLiquidityStat() {
  const snapshot = useLiveLiquidity();
  const data = snapshot.data;
  return (
    <StatCard
      detail={
        data === undefined
          ? blockSource(snapshot.source)
          : `${blockSource(snapshot.source, data.blockNumber)} · tick ${data.pool.currentTick.toString()}`
      }
      label="Active v4 liquidity"
      value={
        data === undefined
          ? snapshot.source === 'live-loading'
            ? 'Loading…'
            : 'Unavailable'
          : integer(data.pool.activeLiquidity)
      }
    />
  );
}

/** Shared Trade pool-state card; quote execution remains a separate read-only Quoter boundary. */
export function LivePoolStateCard() {
  const snapshot = useLiveLiquidity();
  const runtime = useRuntimeDeployment();
  const testnetCandidate = runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate';
  const data = snapshot.data;
  if (data === undefined) return <PoolReadNotice compact />;
  return (
    <Card className="p-5 sm:p-7" data-testid="live-pool-state-card">
      {snapshot.source === 'live-stale' ? <StalePoolNotice /> : null}
      <SectionHeading
        action={
          <Badge tone={snapshot.source === 'live-stale' ? 'warning' : 'positive'}>
            Block {data.blockNumber.toString()}
          </Badge>
        }
        description="StateView slot0 and active liquidity validated against the signed PoolKey and LiquidityManager dependencies. No NAV or token reserve estimate is calculated."
        eyebrow={testnetCandidate ? 'Candidate market state' : 'Canonical market state'}
        title="GBX / USDG · 0.30%"
      />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          className="bg-white/[0.02]"
          detail={blockSource(snapshot.source, data.blockNumber)}
          label="Current tick"
          value={data.pool.currentTick.toString()}
        />
        <StatCard
          className="bg-white/[0.02]"
          detail="Exact slot0 price with GBX and USDG decimals applied"
          label="Current GBX price"
          value={gbxPriceUSDG(data.pool.gbxPriceUSDG)}
        />
        <StatCard
          className="bg-white/[0.02]"
          detail="Raw in-range v4 liquidity units"
          label="Active liquidity"
          value={integer(data.pool.activeLiquidity)}
        />
        <StatCard
          className="bg-white/[0.02]"
          detail={data.pool.protocolFee === 0 ? 'No PoolManager protocol fee' : 'PoolManager protocol fee is enabled'}
          label="Current LP fee"
          value={feePercent(data.pool.lpFee)}
        />
      </div>
    </Card>
  );
}

/** Full live Liquidity route: exact pool state, direct manager balances, and a pinned complete active-NFT index. */
export function LiveLiquidityDashboard() {
  const runtime = useRuntimeDeployment();
  const snapshot = useLiveLiquidity();
  const feeSummary = useProtocolSummary();
  const data = snapshot.data;
  if (runtime.mode !== 'live' || data === undefined) return <PoolReadNotice />;
  const stale = snapshot.source === 'live-stale';
  return (
    <div className="mt-5" data-testid="live-liquidity-dashboard">
      {stale ? <StalePoolNotice /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          detail={blockSource(snapshot.source, data.blockNumber)}
          label="Current pool tick"
          value={data.pool.currentTick.toString()}
        />
        <StatCard
          detail="Exact slot0 ratio with currency ordering and signed token decimals applied"
          label="Current GBX price"
          value={gbxPriceUSDG(data.pool.gbxPriceUSDG)}
        />
        <StatCard
          detail={`${blockSource(snapshot.source, data.blockNumber)} · ${feePercent(data.pool.lpFee)} LP fee`}
          label="Active v4 liquidity"
          value={integer(data.pool.activeLiquidity)}
        />
        <StatCard
          detail={`Exact active-position principal; excludes fees · ${positionIndexSource(data.positionIndex)}`}
          label="Position composition · GBX"
          value={exactTokenAmount(
            data.pool.positionPrincipalComposition.gbxRaw,
            runtime.assetMetadata.GBX.decimals,
            'GBX',
          )}
        />
        <StatCard
          detail={`Exact active-position principal; excludes fees · ${positionIndexSource(data.positionIndex)}`}
          label="Position composition · USDG"
          value={exactTokenAmount(
            data.pool.positionPrincipalComposition.usdGRaw,
            runtime.assetMetadata.USDG.decimals,
            'USDG',
          )}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail={`${feeSource(feeSummary.source, feeSummary.data?.indexedBlock)} · collected-fee events only`}
          label="Cumulative GBX fees burned"
          value={
            feeSummary.data === undefined
              ? feeSummary.source === 'loading'
                ? 'Loading…'
                : 'Unavailable'
              : exactTokenAmount(feeSummary.data.liquidityGBXFeesBurnedRaw, runtime.assetMetadata.GBX.decimals, 'GBX')
          }
        />
        <StatCard
          detail={`${feeSource(feeSummary.source, feeSummary.data?.indexedBlock)} · excludes swept principal and migration residuals`}
          label="Cumulative USDG fees to vault"
          value={
            feeSummary.data === undefined
              ? feeSummary.source === 'loading'
                ? 'Loading…'
                : 'Unavailable'
              : exactTokenAmount(
                  feeSummary.data.liquidityUSDGFeesToVaultRaw,
                  runtime.assetMetadata.USDG.decimals,
                  'USDG',
                )
          }
        />
        <StatCard
          detail={`StateView fee-growth checkpoints with uint256 wrap and Q128 floor math · ${positionIndexSource(data.positionIndex)}`}
          label="Uncollected fees · GBX"
          value={exactTokenAmount(data.pool.uncollectedFees.gbxRaw, runtime.assetMetadata.GBX.decimals, 'GBX')}
        />
        <StatCard
          detail={`StateView fee-growth checkpoints with uint256 wrap and Q128 floor math · ${positionIndexSource(data.positionIndex)}`}
          label="Uncollected fees · USDG"
          value={exactTokenAmount(data.pool.uncollectedFees.usdGRaw, runtime.assetMetadata.USDG.decimals, 'USDG')}
        />
      </div>
      {feeSummary.source !== 'live' ? (
        <Notice
          className="mt-5"
          data-testid={`live-liquidity-fees-${feeSummary.source}`}
          title={
            feeSummary.source === 'stale' ? 'Showing stale collected-fee totals' : 'Collected-fee totals unavailable'
          }
          tone="warning"
        >
          {feeSummary.source === 'stale'
            ? 'The displayed cumulative routed fees remain pinned to their indexed block after a refresh failure.'
            : feeSummary.source === 'loading'
              ? 'The event-derived Protocol fee aggregate is loading; no zero value is substituted.'
              : 'The event-derived Protocol fee aggregate could not be validated; no zero value is substituted.'}
        </Notice>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="p-5 sm:p-7">
          <SectionHeading
            action={<Badge tone={stale ? 'warning' : 'positive'}>{positionIndexSource(data.positionIndex)}</Badge>}
            description={
              data.positionIndex.source === 'subgraph'
                ? 'The complete bounded active-ID index is cross-checked against LiquidityManager cap, count, and records, PositionManager custody, PoolKey, packed ticks, StateView core liquidity, and fee growth at the same block.'
                : 'Before any migration, the four genesis getters are cross-checked at one block; inactive completed ranges remain visible as historical genesis records and are excluded from principal and fee totals.'
            }
            eyebrow="Protocol-owned positions"
            title={data.positionIndex.source === 'subgraph' ? 'Active position records' : 'Genesis position records'}
          />
          <TableShell className="mt-6">
            <table className="financial-table">
              <caption className="sr-only">
                Validated {runtime.runtimeKind === 'testnet-candidate' ? 'testnet-candidate' : 'canonical'} liquidity
                position records
              </caption>
              <thead>
                <tr>
                  <th>Position NFT</th>
                  <th>Allocation</th>
                  <th>Tick range</th>
                  <th>Liquidity</th>
                  <th>Current GBX principal</th>
                  <th>Current USDG principal</th>
                  <th>Uncollected GBX fees</th>
                  <th>Uncollected USDG fees</th>
                  <th>Custody</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.length === 0 ? (
                  <tr data-testid="live-liquidity-empty-positions">
                    <td className="py-8 text-center text-sm text-[#849393]" colSpan={9}>
                      The pinned index reports zero active protocol-owned positions at block{' '}
                      {data.positionIndex.indexedBlock.toString()}. Position principal and uncollected fee totals are
                      exactly zero.
                    </td>
                  </tr>
                ) : null}
                {data.positions.map((position) => (
                  <tr
                    data-testid={`live-liquidity-position-${position.index.toString()}`}
                    key={position.tokenId.toString()}
                  >
                    <td className="font-semibold text-white">#{position.tokenId.toString()}</td>
                    <td className="tabular-nums">
                      {position.allocationBps === null ? 'Replacement' : formatBps(BigInt(position.allocationBps), 2)}
                    </td>
                    <td className="tabular-nums">
                      {position.tickLower.toString()} → {position.tickUpper.toString()}
                    </td>
                    <td className="tabular-nums">{integer(position.liquidity)}</td>
                    <td className="tabular-nums">
                      {position.principalComposition === null
                        ? 'Inactive'
                        : exactTokenAmount(
                            position.principalComposition.gbxRaw,
                            runtime.assetMetadata.GBX.decimals,
                            'GBX',
                          )}
                    </td>
                    <td className="tabular-nums">
                      {position.principalComposition === null
                        ? 'Inactive'
                        : exactTokenAmount(
                            position.principalComposition.usdGRaw,
                            runtime.assetMetadata.USDG.decimals,
                            'USDG',
                          )}
                    </td>
                    <td className="tabular-nums">
                      {position.uncollectedFees === null
                        ? 'Inactive'
                        : exactTokenAmount(position.uncollectedFees.gbxRaw, runtime.assetMetadata.GBX.decimals, 'GBX')}
                    </td>
                    <td className="tabular-nums">
                      {position.uncollectedFees === null
                        ? 'Inactive'
                        : exactTokenAmount(
                            position.uncollectedFees.usdGRaw,
                            runtime.assetMetadata.USDG.decimals,
                            'USDG',
                          )}
                    </td>
                    <td>
                      {position.exists && position.custodyOwner !== null ? (
                        <Badge tone="positive">LiquidityManager</Badge>
                      ) : (
                        <Badge tone="info">Inactive record</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </Card>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6" tone="highlight">
            <SectionHeading
              eyebrow="Signed identity"
              title={runtime.runtimeKind === 'testnet-candidate' ? 'Candidate PoolKey' : 'Canonical PoolKey'}
            />
            <dl className="mt-6 space-y-4 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-[#718080]">PoolId</dt>
                <dd className="font-semibold text-white" title={data.pool.poolId}>
                  {formatAddress(data.pool.poolId)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#718080]">Currency 0</dt>
                <dd className="font-semibold text-white">{formatAddress(data.pool.poolKey.currency0)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#718080]">Currency 1</dt>
                <dd className="font-semibold text-white">{formatAddress(data.pool.poolKey.currency1)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#718080]">Hook</dt>
                <dd className="font-semibold text-white">{formatAddress(data.pool.poolKey.hooks)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#718080]">Fee / tick spacing</dt>
                <dd className="font-semibold text-white">
                  {feePercent(data.pool.poolKey.fee)} / {data.pool.poolKey.tickSpacing.toString()}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeading eyebrow="Migration boundary" title="Typed liquidity state" />
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#718080]">Completed migrations</span>
                <span className="font-semibold text-white tabular-nums">{data.migration.count.toString()}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#718080]">New migrations</span>
                <Badge tone={data.migration.paused ? 'warning' : 'positive'}>
                  {data.migration.paused ? 'Guardian-paused' : 'Timelock-controlled'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#718080]">Genesis principal</span>
                <span className="font-semibold text-white tabular-nums">
                  {exactTokenAmount(data.genesis.liquidityPrincipalRaw, runtime.assetMetadata.GBX.decimals, 'GBX')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#718080]">Manager residual GBX</span>
                <span className="font-semibold text-white tabular-nums">
                  {exactTokenAmount(data.managerInventory.gbxRaw, runtime.assetMetadata.GBX.decimals, 'GBX')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#718080]">Manager residual USDG</span>
                <span className="font-semibold text-white tabular-nums">
                  {exactTokenAmount(data.managerInventory.usdGRaw, runtime.assetMetadata.USDG.decimals, 'USDG')}
                </span>
              </div>
            </div>
          </Card>

          <Notice title="Exact values only" tone="positive">
            Pool state, principal composition, and direct manager residuals use raw values only. Collected fee totals
            come from explicit indexed events. This view calculates no NAV or cross-asset display value, and exact
            current or uncollected fees remain unavailable.
          </Notice>
        </div>
      </div>
    </div>
  );
}
