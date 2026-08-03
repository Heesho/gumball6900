'use client';

import { buildMiningClaimBatch, buildMiningContribution, buildMiningRefund } from '@gumball-6900/sdk';
import {
  Badge,
  Button,
  Card,
  Field,
  Notice,
  ProgressBar,
  SectionHeading,
  StatCard,
  TableShell,
} from '@gumball-6900/ui';
import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import type { Hash } from 'viem';

import {
  useAllowance,
  useCurrentMiningEpoch,
  useLiveMiningClaims,
  type LiveMiningClaimRow,
} from '../../hooks/use-protocol-reads';
import { useProtocolTransaction } from '../../hooks/use-protocol-transaction';
import { CANONICAL_USDG_DECIMALS, formatCountdown, formatToken, formatUSDG } from '../../lib/format';
import { estimateCurrentMiningContribution, miningSecondsRemaining } from '../../lib/mining-epoch';
import { chunkMiningClaimEpochs, submitMiningClaimBatches } from '../../lib/mining-claims';
import { claimableEpochs, miningEpoch } from '../../lib/read-model';
import { buildErc20Approval, parseInputAmount, transactionExplorerUrl } from '../../lib/transactions';
import { useRuntimeDeployment } from './runtime-context';
import { guardedActionLabel, TransactionGuard, TransactionStatus } from './transaction-state';

export function MiningContributionActions() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const transaction = useProtocolTransaction();
  const currentEpoch = useCurrentMiningEpoch();
  const [amountText, setAmountText] = useState('1,250');
  const usdGDecimals = runtime.assetMetadata.USDG?.decimals ?? CANONICAL_USDG_DECIMALS;
  const parsed = useMemo(() => {
    try {
      return { amount: parseInputAmount(amountText, usdGDecimals), error: null };
    } catch (error) {
      return { amount: 0n, error: error instanceof Error ? error.message : 'Enter a valid amount.' };
    }
  }, [amountText, usdGDecimals]);
  const token = runtime.mode === 'live' ? runtime.assets.USDG : undefined;
  const spender = runtime.addresses?.miningPool;
  const allowance = useAllowance(token, spender, parsed.amount);
  const estimate = useMemo(() => {
    if (currentEpoch.data === undefined || parsed.amount <= 0n) return null;
    try {
      return estimateCurrentMiningContribution(currentEpoch.data, parsed.amount);
    } catch {
      return null;
    }
  }, [currentEpoch.data, parsed.amount]);
  const contributionOpen =
    currentEpoch.data !== undefined &&
    !currentEpoch.data.contributionsPaused &&
    !currentEpoch.data.invalidated &&
    currentEpoch.data.blockTimestamp < currentEpoch.data.endTime &&
    estimate !== null &&
    estimate.quote.scheduledEmission > 0n;
  const localRehearsal = runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal';
  const exactEpochReady =
    runtime.mode === 'live' && !currentEpoch.isPending && !currentEpoch.isError && contributionOpen;

  async function approve() {
    if (token === undefined || spender === undefined || parsed.amount <= 0n) return;
    const hash = await transaction.submit(buildErc20Approval(token, spender, parsed.amount), 'Approve USDG for mining');
    if (hash !== null) await allowance.refetch();
  }

  async function contribute() {
    if (spender === undefined || account.address === undefined || parsed.amount <= 0n) return;
    const hash = await transaction.submit(
      buildMiningContribution(spender, account.address, parsed.amount),
      `Contribute ${formatToken(parsed.amount, 'USDG', 2, usdGDecimals)} to mining`,
    );
    if (hash !== null) await currentEpoch.refetch();
  }

  return (
    <form
      className="mt-7"
      onSubmit={(event) => {
        event.preventDefault();
        void contribute();
      }}
    >
      <label className="text-xs font-semibold text-[#aab6b5]" htmlFor="contribution-amount">
        USDG amount
      </label>
      <div className="relative mt-2">
        <Field
          aria-describedby="contribution-balance contribution-error"
          id="contribution-amount"
          inputMode="decimal"
          onChange={(event) => setAmountText(event.target.value)}
          value={amountText}
        />
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[0.68rem] font-bold text-[#67f5e4] disabled:opacity-40"
          disabled
          type="button"
        >
          MAX
        </button>
      </div>
      <p className="mt-2 text-[0.68rem] text-[#657373]" id="contribution-balance">
        {runtime.mode === 'demo'
          ? 'Wallet balance and exact allowance are unavailable in deterministic demo mode.'
          : localRehearsal
            ? 'Wallet balance and exact allowance load from the disposable rehearsal chain.'
            : runtime.runtimeKind === 'testnet-candidate'
              ? 'Wallet balance and exact allowance load from the validated remote testnet candidate.'
              : 'Wallet balance and exact allowance load after a validated production connection.'}
      </p>
      {parsed.error !== null ? (
        <p className="mt-2 text-[0.68rem] text-[#f1c67e]" id="contribution-error">
          {parsed.error}
        </p>
      ) : null}

      <div className="mt-6 space-y-3 rounded-2xl border border-white/7 bg-white/[0.02] p-4">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-[#718080]">Estimated total GBX claim</span>
          <span className="font-semibold text-white tabular-nums" data-testid="estimated-mining-gbx">
            {estimate === null ? 'Unavailable' : formatToken(estimate.estimatedBeneficiaryGBX, 'GBX')}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-[#718080]">Minimum mining price</span>
          <span className="font-semibold text-white tabular-nums">
            {estimate === null ? 'Unavailable' : formatToken(estimate.quote.minimumMiningPrice, 'USDG / GBX')}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-[#718080]">Estimated clearing price</span>
          <span className="font-semibold text-white tabular-nums">
            {estimate === null ? 'Unavailable' : formatToken(estimate.quote.clearingPrice, 'USDG / GBX')}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-[#718080]">Estimate source</span>
          <Badge tone={exactEpochReady ? (localRehearsal ? 'info' : 'positive') : 'warning'}>
            {currentEpoch.data === undefined
              ? currentEpoch.isError
                ? 'RPC unavailable'
                : 'Loading current epoch'
              : localRehearsal
                ? `Rehearsal block ${currentEpoch.data.blockNumber.toString()}`
                : `Pinned block ${currentEpoch.data.blockNumber.toString()}`}
          </Badge>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-[#718080]">Allowance</span>
          <Badge tone={allowance.needsApproval ? 'warning' : runtime.mode === 'live' ? 'positive' : 'neutral'}>
            {runtime.mode !== 'live'
              ? 'Demo unavailable'
              : allowance.isPending
                ? 'Checking'
                : allowance.needsApproval
                  ? 'Approval required'
                  : 'Sufficient'}
          </Badge>
        </div>
      </div>

      {runtime.mode === 'live' && !exactEpochReady ? (
        <Notice className="mt-4" title="Current epoch unavailable" tone="warning">
          Contribution controls remain disabled until the current epoch, schedule, mint capacity, and beneficiary state
          are read from one pinned RPC block. Paused, invalidated, ended, and exhausted epochs cannot accept a
          contribution.
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          disabled={
            transaction.readiness !== 'ready' ||
            transaction.isBusy ||
            parsed.amount <= 0n ||
            !allowance.needsApproval ||
            !exactEpochReady
          }
          onClick={() => void approve()}
          variant="secondary"
        >
          Approve exact USDG
        </Button>
        <Button
          disabled={
            transaction.readiness !== 'ready' ||
            transaction.isBusy ||
            parsed.amount <= 0n ||
            allowance.needsApproval ||
            !exactEpochReady
          }
          type="submit"
        >
          {guardedActionLabel(transaction.readiness, 'Simulate contribution', 'Processing…', transaction.isBusy)}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <TransactionGuard
          onSwitchNetwork={() => void transaction.requestNetworkSwitch()}
          readiness={transaction.readiness}
        />
        <TransactionStatus onReset={transaction.reset} state={transaction.state} />
      </div>
    </form>
  );
}

export function MiningEpochOverview() {
  const runtime = useRuntimeDeployment();
  const currentEpoch = useCurrentMiningEpoch();

  if (runtime.mode === 'live' && currentEpoch.data === undefined) {
    return (
      <Card className="p-5 sm:p-7" tone="highlight">
        <SectionHeading eyebrow="Recurring mining" title="Current epoch contract state" />
        <Notice
          className="mt-6"
          title={currentEpoch.isError ? 'Current epoch read failed' : 'Loading current epoch'}
          tone="warning"
        >
          No deterministic epoch values are substituted in a contract-enabled runtime. Contribution controls remain
          disabled until one pinned RPC snapshot is available.
        </Notice>
      </Card>
    );
  }

  if (runtime.mode === 'live' && currentEpoch.data?.referenceMiningPrice === 0n) {
    return (
      <Card className="p-5 sm:p-7" tone="highlight">
        <SectionHeading eyebrow="Recurring mining" title="Current epoch not initialized" />
        <Notice className="mt-6" title="Genesis settlement required" tone="warning">
          Recurring mining begins only after atomic genesis settlement establishes the first endogenous reference price.
          No placeholder epoch economics are shown before that transaction succeeds.
        </Notice>
      </Card>
    );
  }

  const snapshot = currentEpoch.data;
  const demo = runtime.mode === 'demo';
  const estimate = snapshot === undefined ? null : estimateCurrentMiningContribution(snapshot, 0n);
  const epochId = snapshot?.epochId ?? BigInt(miningEpoch.id);
  const secondsRemaining = snapshot === undefined ? miningEpoch.endsInSeconds : miningSecondsRemaining(snapshot);
  const totalContributed = snapshot?.totalContributed ?? miningEpoch.totalUSDG;
  const beneficiaryContribution = snapshot?.beneficiaryContribution ?? miningEpoch.userUSDG;
  const scheduledEmission = estimate?.quote.scheduledEmission ?? miningEpoch.scheduledEmission;
  const actualEmission = estimate?.quote.actualEmission ?? miningEpoch.estimatedActualEmission;
  const fundingBps = estimate?.fundingBps ?? miningEpoch.fundingBps;
  const usdGDecimals = snapshot?.usdGDecimals ?? 18;

  return (
    <Card className="p-5 sm:p-7" tone="highlight">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p
            className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#67f5e4]"
            data-testid="current-mining-epoch-id"
          >
            Epoch {epochId.toString()}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-white tabular-nums">
            {formatCountdown(secondsRemaining)}
          </p>
          <p className="mt-1.5 text-xs text-[#809090]">until current scheduled close</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={demo ? 'warning' : runtime.runtimeKind === 'local-rehearsal' ? 'info' : 'positive'}>
            {demo
              ? 'Deterministic demo preview'
              : runtime.runtimeKind === 'local-rehearsal'
                ? `Rehearsal RPC block ${snapshot!.blockNumber.toString()}`
                : `Pinned RPC block ${snapshot!.blockNumber.toString()}`}
          </Badge>
          <Badge tone="info">
            {snapshot === undefined
              ? 'Preview extension state'
              : `${snapshot.extensionUsed.toString()}s extension used`}
          </Badge>
        </div>
      </div>

      <ProgressBar className="mt-8" label="Demand funding of scheduled emission" valueBps={fundingBps} />

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#657373]">USDG contributed</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white tabular-nums">
            {formatUSDG(totalContributed, true, usdGDecimals)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#657373]">Your contribution</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white tabular-nums">
            {formatToken(beneficiaryContribution, 'USDG', 2, usdGDecimals)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#657373]">Scheduled maximum</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white tabular-nums">
            {formatToken(scheduledEmission, 'GBX')}
          </p>
        </div>
        <div className="rounded-2xl border border-[#67f5e4]/14 bg-[#67f5e4]/5 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#72cfc4]">
            {demo ? 'Demo estimated actual' : 'Pinned demand estimate'}
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#85fff0] tabular-nums">
            {formatToken(actualEmission, 'GBX')}
          </p>
        </div>
      </div>

      <Notice className="mt-5" title="Why actual can be lower">
        Actual emission is the lesser of the scheduled cap and what contributed USDG can afford at 95% of the prior
        endogenous reference price. Empty epochs mint zero and still advance the decay schedule; unused GBX never
        carries forward.
      </Notice>
    </Card>
  );
}

export function MiningEpochStats() {
  const runtime = useRuntimeDeployment();
  const currentEpoch = useCurrentMiningEpoch();
  if (runtime.mode === 'live' && currentEpoch.data === undefined) {
    return (
      <Notice className="mt-5" title="Current mining metrics unavailable" tone="warning">
        {runtime.runtimeKind === 'local-rehearsal'
          ? 'Rehearsal mining metrics are hidden until their pinned localhost reads succeed.'
          : runtime.runtimeKind === 'testnet-candidate'
            ? 'Testnet-candidate mining metrics are hidden until their pinned contract reads succeed.'
            : 'Production mining metrics are hidden until their pinned contract reads succeed.'}
      </Notice>
    );
  }
  if (runtime.mode === 'live' && currentEpoch.data?.referenceMiningPrice === 0n) {
    return (
      <Notice className="mt-5" title="Recurring mining not initialized" tone="warning">
        Reference-price, minimum-price, clearing, and emission metrics remain hidden until genesis settles.
      </Notice>
    );
  }
  const snapshot = currentEpoch.data;
  const estimate = snapshot === undefined ? null : estimateCurrentMiningContribution(snapshot, 0n);
  const referencePrice = snapshot?.referenceMiningPrice ?? miningEpoch.referenceMiningPrice;
  const minimumPrice = estimate?.quote.minimumMiningPrice ?? miningEpoch.minimumMiningPrice;
  const clearingPrice = estimate?.quote.clearingPrice ?? miningEpoch.estimatedClearingPrice;
  const scheduledEmission = estimate?.quote.scheduledEmission ?? miningEpoch.scheduledEmission;
  const source =
    runtime.mode === 'demo'
      ? 'Deterministic demo preview'
      : runtime.runtimeKind === 'local-rehearsal'
        ? `Rehearsal block ${snapshot!.blockNumber.toString()}`
        : `Pinned block ${snapshot!.blockNumber.toString()}`;

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard detail={source} label="Reference price" value={formatToken(referencePrice, 'USDG')} />
      <StatCard
        detail={`95% of reference · ${source}`}
        label="Minimum price"
        value={formatToken(minimumPrice, 'USDG')}
      />
      <StatCard
        detail={`Current demand · ${source}`}
        label="Clearing estimate"
        value={formatToken(clearingPrice, 'USDG')}
      />
      <StatCard
        detail={`Maximum, not guaranteed · ${source}`}
        label="Scheduled emission"
        value={formatToken(scheduledEmission, 'GBX')}
      />
    </div>
  );
}

export function MiningClaimAction({
  disabled = false,
  epochIds,
  label,
  onConfirmed,
  transactionLabel = label,
}: {
  disabled?: boolean;
  epochIds: readonly (bigint | number)[];
  label: string;
  onConfirmed?: (() => Promise<void> | void) | undefined;
  transactionLabel?: string | undefined;
}) {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const transaction = useProtocolTransaction();
  const [batchProgress, setBatchProgress] = useState<{
    confirmed: number;
    hashes: readonly Hash[];
    phase: 'idle' | 'running' | 'complete' | 'incomplete';
    total: number;
  }>({ confirmed: 0, hashes: [], phase: 'idle', total: 0 });

  async function claim() {
    if (runtime.addresses === null || account.address === undefined) return;
    const miningClaims = runtime.addresses.miningClaims;
    const beneficiary = account.address;
    const batches = chunkMiningClaimEpochs(epochIds.map(BigInt));
    if (batches.length === 0) return;
    setBatchProgress({ confirmed: 0, hashes: [], phase: 'running', total: batches.length });
    const result = await submitMiningClaimBatches(batches, async (batch, index, total) => {
      const batchLabel =
        total === 1
          ? `${transactionLabel} mining rewards`
          : `${transactionLabel} mining rewards · batch ${(index + 1).toString()} of ${total.toString()}`;
      const hash = await transaction.submit(buildMiningClaimBatch(miningClaims, beneficiary, batch), batchLabel);
      if (hash !== null) {
        setBatchProgress((current) => ({
          confirmed: index + 1,
          hashes: [...current.hashes, hash],
          phase: 'running',
          total,
        }));
      }
      return hash;
    });
    if (result.confirmedResults.length > 0) await onConfirmed?.();
    setBatchProgress({
      confirmed: result.confirmedResults.length,
      hashes: result.confirmedResults,
      phase: result.failedBatchIndex === null ? 'complete' : 'incomplete',
      total: result.totalBatches,
    });
  }

  function reset() {
    transaction.reset();
    setBatchProgress({ confirmed: 0, hashes: [], phase: 'idle', total: 0 });
  }

  return (
    <div className="space-y-2">
      <Button
        disabled={disabled || epochIds.length === 0 || transaction.readiness !== 'ready' || transaction.isBusy}
        onClick={() => void claim()}
        size="sm"
        variant="secondary"
      >
        {guardedActionLabel(transaction.readiness, label, 'Processing…', transaction.isBusy)}
      </Button>
      {batchProgress.phase === 'running' ? (
        <Notice title="Claim batch progress">
          {batchProgress.confirmed.toString()} of {batchProgress.total.toString()} batches confirmed. Do not assume a
          pending wallet request succeeded.
        </Notice>
      ) : null}
      {batchProgress.phase === 'incomplete' ? (
        <Notice title="Claim batching stopped" tone="warning">
          {batchProgress.confirmed.toString()} of {batchProgress.total.toString()} batches confirmed. The failed batch
          and every later batch remain unassumed; refreshed onchain claim state is authoritative before retrying.
        </Notice>
      ) : null}
      {batchProgress.phase === 'complete' && batchProgress.total > 1 ? (
        <Notice title="All claim batches confirmed">
          {batchProgress.confirmed.toString()} of {batchProgress.total.toString()} batches have successful receipts.
        </Notice>
      ) : null}
      {batchProgress.hashes.length > 0 ? (
        <ul aria-label="Confirmed claim batch transactions" className="space-y-1 rounded-xl border border-white/7 p-3">
          {batchProgress.hashes.map((hash, index) => (
            <li key={hash}>
              <a
                className="font-mono text-[0.66rem] text-[#75f7e7] hover:text-white"
                data-testid="confirmed-claim-batch-hash"
                href={transactionExplorerUrl(runtime.chain.explorerUrl, hash)}
                rel="noreferrer"
                target="_blank"
              >
                Batch {(index + 1).toString()}: {hash.slice(0, 10)}…{hash.slice(-8)} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <TransactionStatus onReset={reset} state={transaction.state} />
    </div>
  );
}

export function MiningRefundAction({
  disabled = false,
  epochId,
  onConfirmed,
}: {
  disabled?: boolean;
  epochId: bigint;
  onConfirmed?: (() => Promise<void> | void) | undefined;
}) {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const transaction = useProtocolTransaction();

  async function refund() {
    if (runtime.addresses === null || account.address === undefined) return;
    const hash = await transaction.submit(
      buildMiningRefund(runtime.addresses.miningPool, account.address, epochId),
      `Refund invalidated epoch #${epochId.toString()} USDG to beneficiary`,
    );
    if (hash !== null) await onConfirmed?.();
  }

  return (
    <div className="space-y-2">
      <Button
        disabled={disabled || transaction.readiness !== 'ready' || transaction.isBusy}
        onClick={() => void refund()}
        size="sm"
        variant="secondary"
      >
        {guardedActionLabel(transaction.readiness, 'Refund', 'Processing…', transaction.isBusy)}
      </Button>
      <TransactionStatus onReset={transaction.reset} state={transaction.state} />
    </div>
  );
}

interface MiningClaimDisplayRow {
  claimable: bigint;
  contributed: bigint;
  epochId: bigint;
  settled: string;
  status: 'Claimable' | 'Claimed' | 'Expired' | 'Invalidated' | 'Pending' | 'No GBX';
}

function liveClaimStatus(row: LiveMiningClaimRow): MiningClaimDisplayRow['status'] {
  if (row.hasClaimed) return 'Claimed';
  if (row.expired) return 'Expired';
  if (row.invalidated) return 'Invalidated';
  if (!row.settled) return 'Pending';
  return row.claimable > 0n ? 'Claimable' : 'No GBX';
}

function settledDate(settledAt: bigint): string {
  if (settledAt === 0n) return 'Pending';
  return new Date(Number(settledAt) * 1_000).toISOString().slice(0, 10);
}

export function MiningClaimsPanel() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const liveClaims = useLiveMiningClaims();
  const live = runtime.mode === 'live';
  const usdGDecimals = runtime.assetMetadata.USDG?.decimals ?? CANONICAL_USDG_DECIMALS;
  const rows: readonly MiningClaimDisplayRow[] = live
    ? (liveClaims.data?.rows ?? []).map((row) => ({
        claimable: row.claimable,
        contributed: row.contributed,
        epochId: row.epochId,
        settled: settledDate(row.settledAt),
        status: liveClaimStatus(row),
      }))
    : claimableEpochs.map((row) => ({
        claimable: row.claimable,
        contributed: row.contributed,
        epochId: BigInt(row.epoch),
        settled: row.settled,
        status: 'Claimable' as const,
      }));
  const scanIncomplete = live && liveClaims.data?.scanComplete === false;
  const claimableIds = rows
    .filter(({ claimable, status }) => status === 'Claimable' && claimable > 0n)
    .map(({ epochId }) => epochId);
  const refetch = async () => {
    await liveClaims.refetch();
  };

  return (
    <Card className="mt-5 p-5 sm:p-7">
      <SectionHeading
        action={
          <MiningClaimAction
            disabled={
              live &&
              (liveClaims.isPending ||
                liveClaims.isFetching ||
                liveClaims.isError ||
                scanIncomplete ||
                claimableIds.length === 0)
            }
            epochIds={claimableIds}
            label="Claim all"
            onConfirmed={live ? refetch : undefined}
          />
        }
        description={
          live
            ? 'Claim rows are discovered incrementally in bounded MiningPool event windows, then amounts and status are revalidated with bounded-concurrency reads pinned to one RPC block.'
            : 'Claims transfer GBX already minted at settlement. Anyone may trigger your claim, but tokens always go to your recorded beneficiary address.'
        }
        eyebrow="Past epochs"
        title="Claimable GBX"
      />
      {live && account.address === undefined ? (
        <Notice className="mt-6" title="Connect a wallet">
          Claim discovery is account-specific. Connect the beneficiary wallet to load its onchain epochs.
        </Notice>
      ) : null}
      {live && liveClaims.isPending ? (
        <Notice className="mt-6" title="Loading onchain claims">
          Scanning beneficiary contribution events and validating each epoch against the latest block.
        </Notice>
      ) : null}
      {scanIncomplete ? (
        <Notice className="mt-6" title="Claim history scan in progress" tone="warning">
          Contribution history is verified through block{' '}
          {liveClaims.data?.scannedThroughBlock?.toString() ?? 'before deployment'} of{' '}
          {liveClaims.data?.targetBlock.toString()}. Claim actions remain disabled until every bounded window is
          complete; scanning continues automatically.
        </Notice>
      ) : null}
      {live && liveClaims.isError ? (
        <Notice className="mt-6" title="Claim discovery unavailable" tone="warning">
          <p>The RPC event scan or exact claim reads failed. Preview rows are not used to authorize contract claims.</p>
          <Button className="mt-3" onClick={() => void refetch()} size="sm" variant="secondary">
            Retry claim discovery
          </Button>
        </Notice>
      ) : null}
      <TableShell className="mt-6">
        <table className="financial-table">
          <caption className="sr-only">Claimable mining epochs</caption>
          <thead>
            <tr>
              <th>Epoch</th>
              <th>Settled</th>
              <th>Contributed</th>
              <th>Claimable</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.epochId.toString()}>
                <td className="font-semibold text-white">#{row.epochId.toString()}</td>
                <td>{row.settled}</td>
                <td className="tabular-nums">{formatToken(row.contributed, 'USDG', 2, usdGDecimals)}</td>
                <td className="font-semibold text-[#79f8e8] tabular-nums">{formatToken(row.claimable, 'GBX')}</td>
                <td>
                  <Badge
                    tone={
                      row.status === 'Claimable' ? 'positive' : row.status === 'Invalidated' ? 'warning' : 'neutral'
                    }
                  >
                    {row.status}
                  </Badge>
                </td>
                <td>
                  {live && row.status === 'Invalidated' ? (
                    <MiningRefundAction
                      disabled={liveClaims.isFetching || liveClaims.isError || scanIncomplete || row.contributed === 0n}
                      epochId={row.epochId}
                      onConfirmed={refetch}
                    />
                  ) : (
                    <MiningClaimAction
                      disabled={
                        row.claimable === 0n ||
                        (live && (liveClaims.isFetching || liveClaims.isError || scanIncomplete))
                      }
                      epochIds={[row.epochId]}
                      label="Claim"
                      onConfirmed={live ? refetch : undefined}
                      transactionLabel={`Claim epoch #${row.epochId.toString()}`}
                    />
                  )}
                </td>
              </tr>
            ))}
            {(!live || account.address !== undefined) &&
            !liveClaims.isPending &&
            !liveClaims.isFetching &&
            !liveClaims.isError &&
            !scanIncomplete &&
            rows.length === 0 ? (
              <tr>
                <td className="text-[#778686]" colSpan={6}>
                  No beneficiary mining contributions were found for this wallet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>
      <p className="mt-4 text-[0.68rem] leading-5 text-[#657373]">
        Unclaimed epoch GBX expires after two years and is permissionlessly burned—not redirected to a team or treasury.
      </p>
    </Card>
  );
}
