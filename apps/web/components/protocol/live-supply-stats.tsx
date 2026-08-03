'use client';

import { MAX_CUMULATIVE_MINT } from '@gumball-6900/sdk';
import { StatCard } from '@gumball-6900/ui';

import { useLiveProtocolOverview } from '../../hooks/use-live-protocol-overview';
import { formatCompactUnits, formatToken } from '../../lib/format';
import { protocolSnapshot } from '../../lib/read-model';
import { useRuntimeDeployment } from './runtime-context';

export function LiveSupplyStats() {
  const runtime = useRuntimeDeployment();
  const overview = useLiveProtocolOverview();
  const data =
    runtime.mode === 'demo'
      ? {
          cumulativeBurned: protocolSnapshot.cumulativeBurned,
          cumulativeMinted: protocolSnapshot.cumulativeMinted,
          remainingMintCapacity: MAX_CUMULATIVE_MINT - protocolSnapshot.cumulativeMinted,
          totalSupply: protocolSnapshot.totalSupply,
        }
      : overview.data?.supply;
  const exact = data !== undefined;
  const source =
    overview.source === 'live'
      ? runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal'
        ? `Rehearsal Lens · block ${overview.data?.blockNumber.toString() ?? 'unavailable'}`
        : runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate'
          ? `Testnet-candidate Lens · block ${overview.data?.blockNumber.toString() ?? 'unavailable'}`
          : `Production Lens · block ${overview.data?.blockNumber.toString() ?? 'unavailable'}`
      : overview.source === 'live-stale'
        ? `Stale Lens snapshot · block ${overview.data?.blockNumber.toString() ?? 'unavailable'}`
        : overview.source === 'demo'
          ? 'Deterministic demo data'
          : overview.source === 'live-loading'
            ? 'Pinned Lens snapshot loading'
            : 'Validated Lens snapshot unavailable';

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        detail={`${source} · redeemable denominator`}
        label="GBX total supply"
        value={exact ? formatToken(data.totalSupply, 'GBX') : 'Unavailable'}
      />
      <StatCard
        detail={`${source} · burns never reopen capacity`}
        label="Cumulative minted"
        value={exact ? formatCompactUnits(data.cumulativeMinted) : 'Unavailable'}
      />
      <StatCard
        detail={`${source} · redemptions and real burns`}
        label="Cumulative burned"
        value={exact ? formatToken(data.cumulativeBurned, 'GBX') : 'Unavailable'}
      />
      <StatCard
        detail={`${source} · lifetime minted minus lifetime burned`}
        label="Net supply change"
        value={exact ? formatToken(data.cumulativeMinted - data.cumulativeBurned, 'GBX') : 'Unavailable'}
      />
      <StatCard
        detail={`${source} · cumulative burns do not reopen this cap`}
        label="Remaining mint capacity"
        value={exact ? formatToken(data.remainingMintCapacity, 'GBX') : 'Unavailable'}
      />
    </div>
  );
}
