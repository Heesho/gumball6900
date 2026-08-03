'use client';

import { Badge, Card, Notice, ProgressBar, SectionHeading, StatCard } from '@gumball-6900/ui';

import { useCurrentMiningEpoch } from '../../hooks/use-protocol-reads';
import { formatCountdown, formatToken, formatUSDG } from '../../lib/format';
import { estimateCurrentMiningContribution, miningSecondsRemaining } from '../../lib/mining-epoch';
import { miningEpoch } from '../../lib/read-model';
import { useRuntimeDeployment } from './runtime-context';

function unavailableSource(rehearsal: boolean, testnetCandidate: boolean): string {
  return rehearsal
    ? 'Rehearsal RPC snapshot unavailable'
    : testnetCandidate
      ? 'Pinned testnet-candidate snapshot unavailable'
      : 'Pinned production snapshot unavailable';
}

export function HomeMiningStatCards() {
  const runtime = useRuntimeDeployment();
  const currentEpoch = useCurrentMiningEpoch();
  const rehearsal = runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal';
  const testnetCandidate = runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate';

  if (runtime.mode === 'live' && currentEpoch.data === undefined) {
    const detail = unavailableSource(rehearsal, testnetCandidate);
    return (
      <>
        <StatCard detail={detail} label="Mining emission cap" value="Unavailable" />
        <StatCard detail={detail} label="Clearing estimate" value="Unavailable" />
      </>
    );
  }

  const estimate = currentEpoch.data === undefined ? null : estimateCurrentMiningContribution(currentEpoch.data, 0n);
  const scheduledEmission = estimate?.quote.scheduledEmission ?? miningEpoch.scheduledEmission;
  const clearingPrice = estimate?.quote.clearingPrice ?? miningEpoch.estimatedClearingPrice;
  const source =
    runtime.mode === 'demo'
      ? 'Deterministic demo preview'
      : rehearsal
        ? `Rehearsal block ${currentEpoch.data!.blockNumber.toString()}`
        : `Pinned block ${currentEpoch.data!.blockNumber.toString()}`;

  return (
    <>
      <StatCard
        detail={`Current epoch maximum · ${source}`}
        label="Mining emission cap"
        value={formatToken(scheduledEmission, 'GBX')}
      />
      <StatCard
        detail={`Endogenous mining estimate · ${source}`}
        label="Clearing estimate"
        value={formatToken(clearingPrice, 'USDG / GBX', 4)}
      />
    </>
  );
}

export function HomeMiningEpochCard() {
  const runtime = useRuntimeDeployment();
  const currentEpoch = useCurrentMiningEpoch();
  const rehearsal = runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal';
  const testnetCandidate = runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate';

  if (runtime.mode === 'live' && currentEpoch.data === undefined) {
    return (
      <Card className="p-5 sm:p-6">
        <SectionHeading eyebrow="Mining" title="Current epoch" />
        <Notice className="mt-6" title="Current mining snapshot unavailable" tone="warning">
          {unavailableSource(rehearsal, testnetCandidate)}. Deterministic preview economics are not substituted into a
          contract-enabled runtime.
        </Notice>
      </Card>
    );
  }

  const snapshot = currentEpoch.data;
  const estimate = snapshot === undefined ? null : estimateCurrentMiningContribution(snapshot, 0n);
  const actualEmission = estimate?.quote.actualEmission ?? miningEpoch.estimatedActualEmission;
  const fundingBps = estimate?.fundingBps ?? miningEpoch.fundingBps;
  const totalContributed = snapshot?.totalContributed ?? miningEpoch.totalUSDG;
  const minimumPrice = estimate?.quote.minimumMiningPrice ?? miningEpoch.minimumMiningPrice;
  const secondsRemaining = snapshot === undefined ? miningEpoch.endsInSeconds : miningSecondsRemaining(snapshot);
  const usdGDecimals = snapshot?.usdGDecimals ?? 18;
  const source =
    runtime.mode === 'demo'
      ? 'Demo preview'
      : rehearsal
        ? `Rehearsal block ${snapshot!.blockNumber.toString()}`
        : `Pinned block ${snapshot!.blockNumber.toString()}`;

  return (
    <Card className="p-5 sm:p-6">
      <SectionHeading
        action={<Badge tone={runtime.mode === 'demo' ? 'warning' : 'info'}>{source}</Badge>}
        eyebrow="Mining"
        title="Current epoch"
      />
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#657373]">
            {runtime.mode === 'demo' ? 'Demo estimated actual emission' : 'Pinned demand estimate'}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white tabular-nums">
            {formatToken(actualEmission, 'GBX')}
          </p>
        </div>
        <Badge tone={secondsRemaining === 0 ? 'warning' : 'info'}>{formatCountdown(secondsRemaining)} left</Badge>
      </div>
      <ProgressBar className="mt-7" label="Demand funding" valueBps={fundingBps} />
      <div className="mt-7 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-3">
          <p className="text-[0.64rem] uppercase tracking-[0.12em] text-[#647272]">Contributed</p>
          <p className="mt-2 text-sm font-semibold text-white tabular-nums">
            {formatUSDG(totalContributed, true, usdGDecimals)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-3">
          <p className="text-[0.64rem] uppercase tracking-[0.12em] text-[#647272]">Min price</p>
          <p className="mt-2 text-sm font-semibold text-white tabular-nums">{formatUSDG(minimumPrice, false, 18)}</p>
        </div>
      </div>
    </Card>
  );
}
