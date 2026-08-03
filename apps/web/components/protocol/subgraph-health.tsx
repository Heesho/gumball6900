'use client';

import { Badge, Button, Notice } from '@gumball-6900/ui';

import { useSubgraphHealth, type SubgraphHealthSource } from '../../hooks/use-subgraph-health';

function healthTone(source: SubgraphHealthSource): 'positive' | 'warning' | 'info' {
  if (source === 'live') return 'positive';
  if (source === 'loading' || source === 'demo') return 'info';
  return 'warning';
}

function healthLabel(source: SubgraphHealthSource): string {
  if (source === 'live') return 'Indexer synchronized';
  if (source === 'loading') return 'Checking indexer';
  if (source === 'lagging') return 'Indexer lagging';
  if (source === 'stale') return 'Last good index retained';
  if (source === 'fallback') return 'Direct RPC fallback';
  return 'Demo index model';
}

export function SubgraphStatusBadge() {
  const health = useSubgraphHealth();
  return <Badge tone={healthTone(health.source)}>{healthLabel(health.source)}</Badge>;
}

export function SubgraphHealthGrid() {
  const health = useSubgraphHealth();
  const missing = health.indexedBlock === null || health.headBlock === null;
  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
          <p className="text-[0.65rem] uppercase tracking-[0.13em] text-[#657373]">Indexed block</p>
          <p className="mt-2 text-lg font-semibold text-white tabular-nums">
            {health.indexedBlock?.toLocaleString('en-US') ?? 'Unavailable'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
          <p className="text-[0.65rem] uppercase tracking-[0.13em] text-[#657373]">Head lag</p>
          <p className="mt-2 text-lg font-semibold text-[#7af9e9] tabular-nums">
            {missing ? 'Unavailable' : `${health.lag.toLocaleString('en-US')} blocks`}
          </p>
        </div>
        <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
          <p className="text-[0.65rem] uppercase tracking-[0.13em] text-[#657373]">Last response</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {health.lastUpdatedAt === null ? 'Not fetched' : new Date(health.lastUpdatedAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
          <p className="text-[0.65rem] uppercase tracking-[0.13em] text-[#657373]">Source</p>
          <p className="mt-2 text-lg font-semibold text-white">{healthLabel(health.source)}</p>
        </div>
      </div>
      {health.source === 'stale' || health.source === 'fallback' || health.source === 'lagging' ? (
        <Notice className="mt-4" title="Indexed data is non-authoritative" tone="warning">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <span>
              {health.hasIndexingErrors
                ? 'The indexer reports deterministic indexing errors. Contract storage and direct RPC reads remain authoritative.'
                : 'The indexed view is unavailable, stale, or behind the RPC head. No transaction is authorized from this view.'}
            </span>
            <Button onClick={() => void health.refetch()} size="sm" variant="secondary">
              Retry reads
            </Button>
          </div>
        </Notice>
      ) : null}
    </>
  );
}
