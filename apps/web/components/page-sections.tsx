'use client';

import { Badge, Card, Notice, SegmentedBar, TokenMark, type Segment } from '@gumball-6900/ui';
import type { ReactNode } from 'react';

import { formatBps, formatCompactUnits, formatToken, formatUSDG, formatUnits } from '../lib/format';
import {
  recentActivity,
  signalAllocations,
  vaultAssets,
  type ActivityReadModel,
  type AssetStatus,
} from '../lib/read-model';
import { ProtocolRuntimeBanner } from './protocol/runtime-banner';
import { useRuntimeDeployment } from './protocol/runtime-context';
import { LiveAllocationComposition } from './protocol/live-protocol-overview';

export function PageIntro({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
      <div className="max-w-3xl">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#67f5e4]">{eyebrow}</p>
        <h1 className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.055em] text-[#f4f8f7] sm:text-[2.8rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#879696] sm:text-[0.95rem] sm:leading-7">{description}</p>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

export function ReadModelBanner() {
  return <ProtocolRuntimeBanner />;
}

function activityTone(tone: ActivityReadModel['tone']): string {
  if (tone === 'cyan') return 'bg-[#67f5e4]';
  if (tone === 'pink') return 'bg-[#ff6ca3]';
  if (tone === 'blue') return 'bg-[#8ba8ff]';
  if (tone === 'gold') return 'bg-[#f5bd62]';
  return 'bg-[#869494]';
}

export function ActivityFeed({ items, limit }: { items?: readonly ActivityReadModel[]; limit?: number }) {
  const runtime = useRuntimeDeployment();
  if (runtime.mode === 'live' && items === undefined) {
    return (
      <Notice title="Indexed activity unavailable" tone="warning">
        A bounded, validated event query is not available for this view. Demo activity is hidden.
      </Notice>
    );
  }
  const sourceItems = items ?? recentActivity;
  const visibleItems = limit === undefined ? sourceItems : sourceItems.slice(0, limit);
  return (
    <div className="divide-y divide-white/6">
      {visibleItems.map((item) => (
        <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0" key={item.id}>
          <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${activityTone(item.tone)}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start sm:gap-4">
              <div>
                <p className="text-sm font-semibold text-[#dce5e3]">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#6f7e7e]">{item.detail}</p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-xs font-semibold text-[#c9d4d2] tabular-nums">{item.amount}</p>
                <p className="mt-1 text-[0.68rem] text-[#5d6a6a]">{item.time}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VaultComposition({ compact = false }: { compact?: boolean }) {
  const runtime = useRuntimeDeployment();
  if (runtime.mode === 'live') {
    return (
      <Notice title="Vault composition unavailable" tone="warning">
        Current raw balances require a bounded pinned registry-and-vault read. Demo balances are hidden.
      </Notice>
    );
  }
  const segments: Segment[] = vaultAssets.map((asset) => ({
    color: asset.color,
    label: asset.symbol,
    valueBps: asset.displayShareBps,
  }));
  const assets = compact ? vaultAssets.slice(0, 5) : vaultAssets;

  return (
    <div>
      <SegmentedBar segments={segments} />
      <div className="mt-5 space-y-3">
        {assets.map((asset) => (
          <div className="flex items-center justify-between gap-4" key={asset.symbol}>
            <div className="flex min-w-0 items-center gap-3">
              <TokenMark color={asset.color} size="sm" symbol={asset.symbol} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#dbe4e2]">{asset.symbol}</p>
                <p className="truncate text-[0.68rem] text-[#687777]">{asset.name}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-[#d6dfdd] tabular-nums">
                {formatUSDG(asset.displayValueUSDG, true, 18)}
              </p>
              <p className="mt-0.5 text-[0.68rem] text-[#687777]">{formatBps(asset.displayShareBps)} est.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignalComposition({ compact = false }: { compact?: boolean }) {
  const runtime = useRuntimeDeployment();
  if (runtime.mode === 'live') {
    return <LiveAllocationComposition compact={compact} />;
  }
  const items = compact ? signalAllocations.slice(0, 5) : signalAllocations;
  return (
    <div className="space-y-3.5">
      {items.map((signal) => (
        <div key={signal.symbol}>
          <div className="mb-2 flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-[#aab7b6]">{signal.label}</span>
            <span className="font-semibold text-[#dde6e4] tabular-nums">{formatBps(signal.activeBps)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
            <div
              className="h-full rounded-full"
              style={{ backgroundColor: signal.color, width: formatBps(signal.activeBps, 2) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MicroBars() {
  const runtime = useRuntimeDeployment();
  if (runtime.mode === 'live') {
    return <p className="text-xs text-[#718080]">Indexed trend unavailable</p>;
  }
  const heights = ['34%', '48%', '42%', '61%', '55%', '72%', '66%', '81%', '75%', '92%', '84%', '100%'];
  return (
    <div aria-label="Recent protocol activity trend" className="flex h-20 items-end gap-1.5" role="img">
      {heights.map((height, index) => (
        <span
          aria-hidden="true"
          className="min-w-0 flex-1 rounded-t-sm bg-[linear-gradient(180deg,#67f5e4,rgba(103,245,228,.16))] opacity-80"
          key={`${height}-${index.toString()}`}
          style={{ height }}
        />
      ))}
    </div>
  );
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  if (status === 'active') return <Badge tone="info">Preview active</Badge>;
  if (status === 'halted') return <Badge tone="warning">Preview halted</Badge>;
  return <Badge tone="warning">Preview watch</Badge>;
}

export function AssetSummaryGrid() {
  const runtime = useRuntimeDeployment();
  if (runtime.mode === 'live') {
    return (
      <Notice title="Asset balance grid unavailable" tone="warning">
        Exact token-decimal vault balances are not available from a pinned registry snapshot. Demo rows are hidden.
      </Notice>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {vaultAssets.map((asset) => (
        <Card className="p-4" key={asset.symbol} tone="subtle">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TokenMark color={asset.color} symbol={asset.symbol} />
              <div>
                <p className="text-sm font-semibold text-[#e0e8e7]">{asset.symbol}</p>
                <p className="mt-0.5 text-[0.67rem] text-[#647272]">Raw vault balance</p>
              </div>
            </div>
            <AssetStatusBadge status={asset.registryStatus} />
          </div>
          <p className="mt-5 text-xl font-semibold tracking-[-0.04em] text-white tabular-nums">
            {formatCompactUnits(asset.rawBalance, 18, 3)}
          </p>
          <p className="mt-1 text-xs text-[#718080]">
            UI-adjusted: {formatUnits(asset.uiAdjustedBalance, 18, { maximumFractionDigits: 3 })}
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3 text-[0.68rem]">
            <span className="text-[#637171]">Signal {formatBps(asset.signalWeightBps)}</span>
            <span className="text-[#a7b4b3]">{formatToken(asset.pendingBudgetUSDG, 'USDG')}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
