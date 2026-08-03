'use client';

import { Badge, Button, Card, Notice, SectionHeading, TableShell } from '@gumball-6900/ui';
import { useState } from 'react';

import { useLiveProtocolOverview } from '../../hooks/use-live-protocol-overview';
import { useProtocolActivity } from '../../hooks/use-protocol-activity';
import { formatAddress, formatToken } from '../../lib/format';
import type { LiveProtocolOverview } from '../../lib/live-protocol-overview';
import { protocolSnapshot, type ActivityReadModel } from '../../lib/read-model';
import {
  activityFilters,
  type ProtocolActivityCursor,
  type ProtocolActivityEvent,
  type ProtocolActivityFilter,
} from '../../lib/subgraph-activity';
import { transactionExplorerUrl } from '../../lib/transactions';
import type { RuntimeDeployment } from '../../lib/runtime-types';
import { ActivityFeed, MicroBars } from '../page-sections';
import { useRuntimeDeployment } from './runtime-context';
import { SubgraphHealthGrid } from './subgraph-health';

function matchingEntry<Key extends string>(
  entries: Readonly<Record<Key, string>>,
  candidate: string | null,
): Key | null {
  if (candidate === null) return null;
  const normalized = candidate.toLowerCase();
  return (
    (Object.entries(entries) as Array<[Key, string]>).find(([, value]) => value.toLowerCase() === normalized)?.[0] ??
    null
  );
}

interface ActivityTokenIdentity {
  readonly decimals: number;
  readonly symbol: string;
}

interface ActivityStrategyIdentity {
  readonly kind: 'hold-usdg' | 'acquisition' | 'buyback' | 'standalone';
  readonly symbol: string;
  readonly target: ActivityTokenIdentity | null;
}

function coreTokenIdentity(runtime: RuntimeDeployment, symbol: 'GBX' | 'USDG'): ActivityTokenIdentity {
  return {
    decimals: runtime.mode === 'live' ? runtime.assetMetadata[symbol].decimals : 18,
    symbol,
  };
}

function registeredAssetIdentity(
  runtime: RuntimeDeployment,
  overview: LiveProtocolOverview | undefined,
  candidate: string | null,
): ActivityTokenIdentity | null {
  if (runtime.mode !== 'live' || candidate === null) return null;
  if (overview !== undefined) {
    const asset = overview.assets.find((row) => row.token.toLowerCase() === candidate.toLowerCase());
    return asset === undefined ? null : { decimals: asset.decimals, symbol: asset.symbol };
  }
  const symbol = matchingEntry(runtime.assets, candidate);
  return symbol === null ? null : { decimals: runtime.assetMetadata[symbol].decimals, symbol };
}

function registeredStrategyIdentity(
  runtime: RuntimeDeployment,
  overview: LiveProtocolOverview | undefined,
  candidate: string | null,
): ActivityStrategyIdentity | null {
  if (runtime.mode !== 'live' || candidate === null) return null;
  if (overview !== undefined) {
    const strategy = overview.strategies.find((row) => row.strategy.toLowerCase() === candidate.toLowerCase());
    if (strategy === undefined) return null;
    if (strategy.kind === 'buyback') {
      return { kind: strategy.kind, symbol: strategy.symbol, target: coreTokenIdentity(runtime, 'GBX') };
    }
    if (strategy.kind !== 'acquisition') {
      return { kind: strategy.kind, symbol: strategy.symbol, target: null };
    }
    const target = overview.assets.find(
      (asset) =>
        asset.token.toLowerCase() === strategy.token.toLowerCase() &&
        asset.strategy.toLowerCase() === strategy.strategy.toLowerCase(),
    );
    return target === undefined
      ? null
      : {
          kind: strategy.kind,
          symbol: target.symbol,
          target: { decimals: target.decimals, symbol: target.symbol },
        };
  }

  const symbol = matchingEntry(runtime.strategies, candidate);
  if (symbol === null) return null;
  if (symbol === 'BURN') {
    return { kind: 'buyback', symbol, target: coreTokenIdentity(runtime, 'GBX') };
  }
  if (symbol === 'USDG') return { kind: 'hold-usdg', symbol, target: null };
  return {
    kind: 'acquisition',
    symbol,
    target: { decimals: runtime.assetMetadata[symbol].decimals, symbol },
  };
}

function tokenAmount(amount: bigint, token: ActivityTokenIdentity): string {
  return formatToken(amount, token.symbol, 4, token.decimals);
}

export function formatActivityTimestamp(timestamp: bigint): string {
  const milliseconds = timestamp * 1_000n;
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) return `Unix ${timestamp.toString()}`;
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Number(milliseconds)));
}

function actionLabel(action: string | null): string {
  return action === null ? 'updated' : action.toLowerCase().replaceAll('_', ' ');
}

export function activityReadModel(
  event: ProtocolActivityEvent,
  runtime: RuntimeDeployment,
  overview?: LiveProtocolOverview,
): ActivityReadModel {
  const time = `${formatActivityTimestamp(event.timestamp)} UTC`;
  const strategy = registeredStrategyIdentity(runtime, overview, event.strategyAddress);
  const rewardAsset = registeredAssetIdentity(runtime, overview, event.assetAddress);
  const gbx = coreTokenIdentity(runtime, 'GBX');
  const usdg = coreTokenIdentity(runtime, 'USDG');
  const actor = event.actorAddress === null ? 'Unknown account' : formatAddress(event.actorAddress);

  if (event.type === 'genesis-contribution' || event.type === 'mining-contribution') {
    const genesis = event.type === 'genesis-contribution';
    return {
      id: event.id,
      kind: 'Mining',
      title: genesis ? 'Genesis contribution received' : `Mining epoch #${event.epochId?.toString() ?? '?'} funded`,
      detail: `${actor} · raw USDG received`,
      amount: event.amountRaw === null ? 'Unavailable' : `+${tokenAmount(event.amountRaw, usdg)}`,
      time,
      tone: 'blue',
    };
  }
  if (event.type === 'genesis-claim' || event.type === 'mining-claim') {
    return {
      id: event.id,
      kind: 'Claim',
      title: event.type === 'genesis-claim' ? 'Genesis GBX claimed' : 'Mining GBX claimed',
      detail: `${actor} · distribution claim`,
      amount: event.amountRaw === null ? 'Unavailable' : `+${tokenAmount(event.amountRaw, gbx)}`,
      time,
      tone: 'blue',
    };
  }
  if (event.type === 'pending-signal') {
    return {
      id: event.id,
      kind: 'Signal',
      title: `Allocation signals ${actionLabel(event.action)}`,
      detail: actor,
      amount: 'Persistent signal',
      time,
      tone: 'cyan',
    };
  }
  if (event.type === 'strategy-fill') {
    const acquisition = strategy?.kind === 'acquisition' ? strategy : null;
    const symbol = acquisition?.symbol ?? 'target asset';
    const target =
      event.targetAmountRaw === null || acquisition?.target === null || acquisition === null
        ? 'Target amount unavailable'
        : `+${tokenAmount(event.targetAmountRaw, acquisition.target)}`;
    return {
      id: event.id,
      kind: 'Acquisition',
      title: `${symbol} strategy filled`,
      detail:
        event.amountRaw === null
          ? `Auction #${event.auctionId?.toString() ?? '?'}`
          : `${tokenAmount(event.amountRaw, usdg)} lot · auction #${event.auctionId?.toString() ?? '?'}`,
      amount: target,
      time,
      tone: 'cyan',
    };
  }
  if (event.type === 'manager-reward-notification' || event.type === 'manager-reward-claim') {
    const rewardToken = rewardAsset ?? (strategy?.kind === 'acquisition' ? strategy.target : null);
    const redirected = event.type === 'manager-reward-notification' && event.redirectedToVault === true;
    return {
      id: event.id,
      kind: 'Reward',
      title:
        event.type === 'manager-reward-claim'
          ? 'Manager rewards claimed'
          : redirected
            ? 'Manager share redirected to vault'
            : 'Manager rewards notified',
      detail: `${strategy?.symbol ?? 'Unknown'} strategy · ${redirected ? 'zero active manager weight' : actor}`,
      amount:
        event.amountRaw === null || rewardToken === null
          ? 'Unavailable'
          : `+${tokenAmount(event.amountRaw, rewardToken)}`,
      time,
      tone: 'gold',
    };
  }
  if (event.type === 'redemption') {
    return {
      id: event.id,
      kind: 'Redemption',
      title: 'Basket redeemed in kind',
      detail: `${actor} · pre-burn supply accounting`,
      amount: event.amountRaw === null ? 'Unavailable' : `−${tokenAmount(event.amountRaw, gbx)}`,
      time,
      tone: 'neutral',
    };
  }
  if (event.type === 'buyback') {
    return {
      id: event.id,
      kind: 'Buyback',
      title: 'GBX bought and burned',
      detail:
        event.amountRaw === null
          ? `Auction #${event.auctionId?.toString() ?? '?'}`
          : `${tokenAmount(event.amountRaw, usdg)} spent · auction #${event.auctionId?.toString() ?? '?'}`,
      amount: event.targetAmountRaw === null ? 'Unavailable' : `−${tokenAmount(event.targetAmountRaw, gbx)}`,
      time,
      tone: 'pink',
    };
  }
  if (event.type === 'burn') {
    return {
      id: event.id,
      kind: 'Burn',
      title: 'GBX supply burned',
      detail: `${actor} · canonical token event`,
      amount: event.amountRaw === null ? 'Unavailable' : `−${tokenAmount(event.amountRaw, gbx)}`,
      time,
      tone: 'pink',
    };
  }
  if (event.type === 'revenue-notification') {
    return {
      id: event.id,
      kind: 'Signal',
      title: 'USDG revenue allocated',
      detail: actionLabel(event.action),
      amount: event.amountRaw === null ? 'Unavailable' : `+${tokenAmount(event.amountRaw, usdg)}`,
      time,
      tone: 'cyan',
    };
  }
  return {
    id: event.id,
    kind: 'Liquidity',
    title: `Liquidity ${actionLabel(event.action)}`,
    detail:
      event.targetAmountRaw === null
        ? 'Canonical v4 position event'
        : `${tokenAmount(event.targetAmountRaw, usdg)} routed`,
    amount: event.amountRaw === null ? 'Unavailable' : tokenAmount(event.amountRaw, gbx),
    time,
    tone: 'cyan',
  };
}

function IndexedActivityFeed({
  events,
  overview,
}: {
  events: readonly ProtocolActivityEvent[];
  overview: LiveProtocolOverview | undefined;
}) {
  const runtime = useRuntimeDeployment();
  return <ActivityFeed items={events.map((event) => activityReadModel(event, runtime, overview))} />;
}

function ActivityCoordinates({ events }: { events: readonly ProtocolActivityEvent[] }) {
  const runtime = useRuntimeDeployment();
  return (
    <TableShell className="mt-6">
      <table className="financial-table min-w-[38rem]">
        <caption className="sr-only">Indexed event coordinates</caption>
        <thead>
          <tr>
            <th>Type</th>
            <th>Block</th>
            <th>Log</th>
            <th>Transaction</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <Badge>{event.category}</Badge>
              </td>
              <td className="tabular-nums">{event.blockNumber.toLocaleString('en-US')}</td>
              <td className="tabular-nums">{event.logIndex.toString()}</td>
              <td>
                <a
                  aria-label={`Open transaction ${event.transactionHash}`}
                  className="font-mono text-[0.7rem] text-[#75f7e7] hover:text-white"
                  href={transactionExplorerUrl(runtime.chain.explorerUrl, event.transactionHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {event.transactionHash.slice(0, 10)}…{event.transactionHash.slice(-8)} ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

export function ActivityExplorer() {
  const runtime = useRuntimeDeployment();
  const overview = useLiveProtocolOverview();
  const [filter, setFilter] = useState<ProtocolActivityFilter>('All');
  const [cursorHistory, setCursorHistory] = useState<readonly (ProtocolActivityCursor | null)[]>([null]);
  const page = cursorHistory.length - 1;
  const activity = useProtocolActivity(filter, cursorHistory.at(-1) ?? null, 12);
  const events = activity.data?.events ?? [];

  return (
    <>
      <Card className="p-4 sm:p-5">
        <div aria-label="Activity filters" className="flex gap-2 overflow-x-auto pb-1" role="group">
          {activityFilters.map((candidate) => {
            const selected = candidate === filter;
            return (
              <button
                aria-pressed={selected}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition ${
                  selected
                    ? 'border-[#67f5e4]/70 bg-[#67f5e4] text-[#07100f]'
                    : 'border-white/9 bg-white/[0.025] text-[#819090] hover:border-white/20 hover:text-white'
                }`}
                key={candidate}
                onClick={() => {
                  setFilter(candidate);
                  setCursorHistory([null]);
                }}
                type="button"
              >
                {candidate}
              </button>
            );
          })}
        </div>
      </Card>

      {runtime.mode === 'demo' ? (
        <Card className="mt-5 p-5 sm:p-7">
          <SectionHeading
            action={<Badge tone="info">Demo preview</Badge>}
            description="Deterministic fixture events. Contract-enabled deployments use validated subgraph rows instead."
            eyebrow="Demo"
            title="Event feed preview"
          />
          <div className="mt-7">
            <ActivityFeed />
          </div>
        </Card>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <Card className="p-5 sm:p-7">
            <SectionHeading
              action={
                activity.data === undefined ? (
                  <Badge tone="warning">{activity.source}</Badge>
                ) : (
                  <Badge tone={activity.source === 'stale' ? 'warning' : 'positive'}>
                    {activity.source === 'stale' ? 'Stale indexed block' : 'Indexed block'}{' '}
                    {activity.data.indexedBlock.toString()}
                  </Badge>
                )
              }
              description="Cursor pages are pinned to one indexed block hash and merged by immutable block and log coordinates across protocol entities."
              eyebrow="Live index"
              title={`${filter} activity`}
            />
            {activity.source === 'stale' ? (
              <Notice className="mt-6" title="Showing the last validated event page" tone="warning">
                The latest indexer refresh failed. Rows remain tied to the displayed indexed block and are not presented
                as current.
              </Notice>
            ) : null}
            {events.length > 0 && overview.data === undefined ? (
              <Notice className="mt-6" title="Registry metadata unavailable" tone="warning">
                Dynamic strategy and token labels remain withheld until the bounded Lens registry is available from a
                hash-revalidated block. Signed genesis identities remain usable.
              </Notice>
            ) : null}
            {activity.source === 'loading' ? (
              <p className="mt-6 text-sm text-[#879696]" role="status">
                Loading indexed events…
              </p>
            ) : activity.source === 'unavailable' ? (
              <Notice className="mt-6" title="Indexed activity unavailable" tone="warning">
                The configured subgraph did not return a valid bounded event page. No demo events are substituted.
              </Notice>
            ) : events.length === 0 ? (
              <Notice className="mt-6" title="No matching indexed events">
                No {filter.toLowerCase()} events were returned for this page.
              </Notice>
            ) : (
              <div className="mt-7" data-testid="live-activity-feed">
                <IndexedActivityFeed events={events} overview={overview.data} />
              </div>
            )}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/7 pt-4">
              <Button
                disabled={page === 0 || activity.isFetching}
                onClick={() => setCursorHistory((current) => current.slice(0, -1))}
                size="sm"
                variant="secondary"
              >
                Previous
              </Button>
              <span className="text-xs text-[#718080]">Page {(page + 1).toString()}</span>
              <Button
                disabled={
                  activity.data?.nextCursor === null || activity.data === undefined || activity.isFetching || page >= 9
                }
                onClick={() => {
                  const currentPage = activity.data;
                  if (currentPage === undefined || currentPage.nextCursor === null) return;
                  setCursorHistory((current) => [...current.slice(0, -1), currentPage.cursor, currentPage.nextCursor]);
                }}
                size="sm"
                variant="secondary"
              >
                Next
              </Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <SectionHeading
              description="Each immutable row retains its exact block, transaction hash, and log index."
              eyebrow="Finality"
              title="Event coordinates"
            />
            <SubgraphHealthGrid />
            {events.length > 0 ? <ActivityCoordinates events={events} /> : null}
          </Card>
        </div>
      )}
    </>
  );
}

export function HomeRecentActivityPanel() {
  const runtime = useRuntimeDeployment();
  const overview = useLiveProtocolOverview();
  const activity = useProtocolActivity('All', null, 4);
  if (runtime.mode === 'demo') {
    return (
      <Card className="p-5 sm:p-6">
        <SectionHeading
          action={<Badge tone="info">Demo preview</Badge>}
          description="Deterministic demo activity; contract state remains authoritative."
          eyebrow="Network"
          title="Demo recent activity"
        />
        <div className="mt-7 grid gap-6 md:grid-cols-[.38fr_.62fr]">
          <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#647272]">
              Demo canonical v4 liquidity
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">
              {formatToken(protocolSnapshot.liquidityDisplayValueUSDG, 'USDG')}
            </p>
            <div className="mt-6">
              <MicroBars />
            </div>
          </div>
          <ActivityFeed limit={4} />
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-5 sm:p-6">
      <SectionHeading
        action={
          activity.data === undefined ? (
            <Badge tone="warning">{activity.source}</Badge>
          ) : (
            <Badge tone={activity.source === 'stale' ? 'warning' : 'positive'}>
              {activity.source === 'stale' ? 'Stale block' : 'Block'} {activity.data.indexedBlock.toString()}
            </Badge>
          )
        }
        description="Latest validated immutable events from the configured protocol subgraph."
        eyebrow="Network"
        title="Recent protocol activity"
      />
      {activity.source === 'stale' ? (
        <Notice className="mt-6" title="Recent activity is stale" tone="warning">
          The current indexer refresh failed. The last validated bounded event page remains visible below.
        </Notice>
      ) : null}
      {(activity.data?.events.length ?? 0) > 0 && overview.data === undefined ? (
        <Notice className="mt-6" title="Registry metadata unavailable" tone="warning">
          Dynamic activity identities remain withheld until the bounded Lens registry is available from a
          hash-revalidated block.
        </Notice>
      ) : null}
      {activity.source === 'unavailable' ? (
        <Notice className="mt-6" title="Recent activity unavailable" tone="warning">
          The indexer did not return a valid event page. Demo activity remains hidden.
        </Notice>
      ) : activity.source === 'loading' ? (
        <p className="mt-6 text-sm text-[#879696]" role="status">
          Loading recent activity…
        </p>
      ) : activity.data?.events.length === 0 ? (
        <Notice className="mt-6" title="No indexed activity yet">
          The indexer is healthy but has no protocol events.
        </Notice>
      ) : (
        <div className="mt-7" data-testid="home-live-activity">
          <IndexedActivityFeed events={activity.data?.events ?? []} overview={overview.data} />
        </div>
      )}
    </Card>
  );
}

export function LiveStrategyFillHistory() {
  const runtime = useRuntimeDeployment();
  const overview = useLiveProtocolOverview();
  const activity = useProtocolActivity('Asset purchases', null, 8);
  if (runtime.mode === 'demo') return null;
  const fills = activity.data?.events.filter((event) => event.type === 'strategy-fill') ?? [];

  return (
    <Card className="mt-5 p-5 sm:p-7">
      <SectionHeading
        action={
          activity.data === undefined ? (
            <Badge tone="warning">{activity.source}</Badge>
          ) : (
            <Badge tone={activity.source === 'stale' ? 'warning' : 'positive'}>
              {activity.source === 'stale' ? 'Stale' : 'Indexed'} · block {activity.data.indexedBlock.toString()}
            </Badge>
          )
        }
        description="Validated acquisition settlement events with exact raw vault and manager splits."
        eyebrow="Acquisition history"
        title="Recent strategy fills"
      />
      {activity.source === 'stale' ? (
        <Notice className="mt-5" title="Showing the last validated fill page" tone="warning">
          The latest indexer refresh failed. These bounded settlement rows remain tied to indexed block{' '}
          {activity.data?.indexedBlock.toString()} and are not presented as current.
        </Notice>
      ) : null}
      {fills.length > 0 && overview.data === undefined ? (
        <Notice className="mt-5" title="Fill metadata unavailable" tone="warning">
          Dynamic strategy labels and token units remain unavailable until the bounded Lens registry is read from a
          hash-revalidated block. No symbol-based substitution is used.
        </Notice>
      ) : null}
      {activity.source === 'unavailable' ? (
        <Notice className="mt-5" title="Fill history unavailable" tone="warning">
          The configured subgraph did not return valid fill rows. Demo settlements are not substituted.
        </Notice>
      ) : activity.source === 'loading' ? (
        <p className="mt-5 text-sm text-[#879696]" role="status">
          Loading strategy fills…
        </p>
      ) : fills.length === 0 ? (
        <Notice className="mt-5" title="No indexed acquisition fills">
          No acquisition fill has been indexed yet.
        </Notice>
      ) : (
        <TableShell className="mt-6">
          <table className="financial-table min-w-[62rem]">
            <caption className="sr-only">Live acquisition strategy fills</caption>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>USDG spent</th>
                <th>Target received</th>
                <th>Vault 98%</th>
                <th>Managers 2%</th>
                <th>Block</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {fills.map((fill) => {
                const strategy = registeredStrategyIdentity(runtime, overview.data, fill.strategyAddress);
                const acquisition = strategy?.kind === 'acquisition' ? strategy : null;
                return (
                  <tr
                    data-strategy-address={fill.strategyAddress?.toLowerCase()}
                    data-testid="live-strategy-fill"
                    key={fill.id}
                  >
                    <td className="font-semibold text-white">{acquisition?.symbol ?? 'Unknown'}</td>
                    <td>
                      {fill.amountRaw === null
                        ? 'Unavailable'
                        : tokenAmount(fill.amountRaw, coreTokenIdentity(runtime, 'USDG'))}
                    </td>
                    <td>
                      {fill.targetAmountRaw === null || acquisition?.target === null || acquisition === null
                        ? 'Unavailable'
                        : tokenAmount(fill.targetAmountRaw, acquisition.target)}
                    </td>
                    <td>
                      {fill.vaultAmountRaw === null || acquisition?.target === null || acquisition === null
                        ? 'Unavailable'
                        : tokenAmount(fill.vaultAmountRaw, acquisition.target)}
                    </td>
                    <td>
                      {fill.managerAmountRaw === null || acquisition?.target === null || acquisition === null
                        ? 'Unavailable'
                        : tokenAmount(fill.managerAmountRaw, acquisition.target)}
                    </td>
                    <td className="tabular-nums">{fill.blockNumber.toString()}</td>
                    <td>
                      <a
                        className="font-mono text-[0.68rem] text-[#75f7e7] hover:text-white"
                        href={transactionExplorerUrl(runtime.chain.explorerUrl, fill.transactionHash)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {fill.transactionHash.slice(0, 10)}… ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}
    </Card>
  );
}
