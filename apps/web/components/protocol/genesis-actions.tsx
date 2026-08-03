'use client';

import { buildGenesisClaim, buildGenesisContribution, buildGenesisRefund } from '@gumball-6900/sdk';
import { Badge, Button, Card, Field, Notice, ProgressBar, SectionHeading } from '@gumball-6900/ui';
import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

import { useAllowance, useGenesisBootstrapView } from '../../hooks/use-protocol-reads';
import { useProtocolTransaction } from '../../hooks/use-protocol-transaction';
import { CANONICAL_USDG_DECIMALS, formatCountdown, formatToken } from '../../lib/format';
import { buildErc20Approval, parseInputAmount } from '../../lib/transactions';
import { useRuntimeDeployment } from './runtime-context';
import { guardedActionLabel, TransactionGuard, TransactionStatus } from './transaction-state';

export const GENESIS_STATE_LABELS = [
  'Awaiting sponsor',
  'Sponsor funded',
  'Contributing',
  'Awaiting settlement',
  'Settled',
  'Refundable',
] as const;

function stateTone(state: number): 'neutral' | 'positive' | 'warning' | 'info' {
  if (state === 4) return 'positive';
  if (state === 5) return 'warning';
  if (state === 2 || state === 3) return 'info';
  return 'neutral';
}

function formatTimestamp(timestamp: bigint): string {
  if (timestamp === 0n) return 'Not set';
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds)) return 'Timestamp unavailable';
  return new Date(seconds * 1_000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function lifecycleTime(state: number, contributionEnd: bigint, settlementDeadline: bigint, settledAt: bigint) {
  if (state === 2) return { label: 'Contribution deadline', timestamp: contributionEnd };
  if (state === 3) return { label: 'Settlement deadline', timestamp: settlementDeadline };
  if (state === 4) return { label: 'Settled at', timestamp: settledAt };
  return { label: 'Lifecycle deadline', timestamp: 0n };
}

function secondsUntil(deadline: bigint, blockTimestamp: bigint): string | null {
  if (deadline <= blockTimestamp) return null;
  const remaining = Number(deadline - blockTimestamp);
  return Number.isSafeInteger(remaining) ? formatCountdown(remaining) : null;
}

/** Genesis lifecycle and beneficiary actions. No demo economics are substituted for unavailable contract reads. */
export function GenesisLifecyclePanel() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const genesis = useGenesisBootstrapView();
  const transaction = useProtocolTransaction();
  const [amountText, setAmountText] = useState('100,000');
  const usdGDecimals = runtime.assetMetadata.USDG?.decimals ?? CANONICAL_USDG_DECIMALS;
  const parsed = useMemo(() => {
    try {
      return { amount: parseInputAmount(amountText, usdGDecimals), error: null };
    } catch (error) {
      return { amount: 0n, error: error instanceof Error ? error.message : 'Enter a valid amount.' };
    }
  }, [amountText, usdGDecimals]);
  const bootstrap = runtime.addresses?.genesisBootstrap;
  const usdG = runtime.mode === 'live' ? runtime.assets.USDG : undefined;
  const allowance = useAllowance(usdG, bootstrap, parsed.amount);

  if (runtime.mode !== 'live') {
    return (
      <Card className="mb-5 p-5 sm:p-7">
        <SectionHeading
          description="Genesis contribution, refund, and claim state is read directly from a validated deployment."
          eyebrow="Canonical launch"
          title="Genesis bootstrap"
        />
        <Notice className="mt-5" title="Genesis state unavailable in demo" tone="warning">
          Deterministic demo data does not invent a launch state, cap, deadline, contribution, refund, or claim. Connect
          this client to a validated deployment to enable these controls.
        </Notice>
      </Card>
    );
  }

  const view = genesis.data;
  const stateLabel = view === undefined ? 'Unavailable' : GENESIS_STATE_LABELS[view.state];
  const time =
    view === undefined
      ? null
      : lifecycleTime(view.state, view.contributionEnd, view.settlementDeadline, view.settledAt);
  const remaining = view === undefined ? 0n : view.bootstrapContributionCap - view.communityUSDG;
  const contributionOpen =
    view !== undefined &&
    view.state === 2 &&
    view.blockTimestamp < view.contributionEnd &&
    parsed.amount > 0n &&
    parsed.amount <= remaining;
  const exactSnapshotReady = view !== undefined && !genesis.isError && !genesis.isFetching;
  const progressBps =
    view === undefined || view.bootstrapContributionCap === 0n
      ? 0n
      : (view.communityUSDG * 10_000n) / view.bootstrapContributionCap;

  async function approve() {
    if (usdG === undefined || bootstrap === undefined || parsed.amount <= 0n) return;
    const hash = await transaction.submit(
      buildErc20Approval(usdG, bootstrap, parsed.amount),
      'Approve USDG for genesis',
    );
    if (hash !== null) await allowance.refetch();
  }

  async function contribute() {
    if (bootstrap === undefined || account.address === undefined || parsed.amount <= 0n) return;
    const hash = await transaction.submit(
      buildGenesisContribution(bootstrap, account.address, parsed.amount),
      `Contribute ${formatToken(parsed.amount, 'USDG', 2, usdGDecimals)} to genesis`,
    );
    if (hash !== null) await Promise.all([genesis.refetch(), allowance.refetch()]);
  }

  async function refund() {
    if (bootstrap === undefined || account.address === undefined) return;
    const hash = await transaction.submit(
      buildGenesisRefund(bootstrap, account.address),
      'Refund genesis USDG to beneficiary',
    );
    if (hash !== null) await genesis.refetch();
  }

  async function claim() {
    if (runtime.addresses === null || account.address === undefined) return;
    const hash = await transaction.submit(
      buildGenesisClaim(runtime.addresses.genesisClaims, account.address),
      'Claim genesis GBX to beneficiary',
    );
    if (hash !== null) await genesis.refetch();
  }

  return (
    <Card className="mb-5 p-5 sm:p-7" data-testid="genesis-lifecycle-panel" tone="highlight">
      <SectionHeading
        action={<Badge tone={view === undefined ? 'warning' : stateTone(view.state)}>{stateLabel}</Badge>}
        description="The seven-day community bootstrap has an exact USDG cap and a fixed 80,000,000 GBX contributor allocation. Refunds and claims always pay the recorded beneficiary."
        eyebrow="Canonical launch"
        title="Genesis bootstrap"
      />

      {view === undefined ? (
        <Notice
          className="mt-5"
          title={genesis.isError ? 'Genesis read failed' : 'Loading genesis state'}
          tone="warning"
        >
          {genesis.isError
            ? 'Genesis controls remain disabled because the lifecycle and beneficiary position could not be verified at one canonical RPC block.'
            : 'Waiting for a hash-bound genesis lifecycle and beneficiary snapshot.'}
          {genesis.isError ? (
            <Button className="mt-3" onClick={() => void genesis.refetch()} size="sm" variant="secondary">
              Retry genesis read
            </Button>
          ) : null}
        </Notice>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#657373]">Community raised</p>
              <p className="mt-2 text-lg font-semibold text-white tabular-nums">
                {formatToken(view.communityUSDG, 'USDG', 2, view.usdGDecimals)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#657373]">Minimum / cap</p>
              <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                {formatToken(view.minimumBootstrapUSDG, 'USDG', 2, view.usdGDecimals)} /{' '}
                {formatToken(view.bootstrapContributionCap, 'USDG', 2, view.usdGDecimals)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#657373]">Your contribution</p>
              <p className="mt-2 text-lg font-semibold text-white tabular-nums" data-testid="genesis-contribution">
                {formatToken(view.beneficiaryContribution, 'USDG', 2, view.usdGDecimals)}
              </p>
            </div>
            <div className="rounded-2xl border border-[#67f5e4]/14 bg-[#67f5e4]/5 p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#72cfc4]">Your GBX claim</p>
              <p className="mt-2 text-lg font-semibold text-[#85fff0] tabular-nums" data-testid="genesis-claim">
                {formatToken(view.beneficiaryPreviewClaim, 'GBX')}
              </p>
            </div>
          </div>
          <ProgressBar className="mt-5" label="Community cap filled" valueBps={progressBps} />
          <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-xl border border-white/7 p-3">
              <p className="text-[#718080]">{time?.label ?? 'Lifecycle deadline'}</p>
              <p className="mt-1 font-semibold text-white" data-testid="genesis-deadline">
                {formatTimestamp(time?.timestamp ?? 0n)}
              </p>
              {time !== null && secondsUntil(time.timestamp, view.blockTimestamp) !== null ? (
                <p className="mt-1 text-[#79dace]">{secondsUntil(time.timestamp, view.blockTimestamp)} remaining</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/7 p-3">
              <p className="text-[#718080]">Sponsor escrow / required</p>
              <p className="mt-1 font-semibold text-white tabular-nums">
                {formatToken(view.sponsorEscrow, 'USDG', 2, view.usdGDecimals)} /{' '}
                {formatToken(view.requiredSponsorUSDG, 'USDG', 2, view.usdGDecimals)}
              </p>
            </div>
            <div className="rounded-xl border border-white/7 p-3">
              <p className="text-[#718080]">Read provenance</p>
              <p className="mt-1 font-semibold text-white">
                {runtime.runtimeKind === 'local-rehearsal' ? 'Rehearsal' : 'Pinned RPC'} block{' '}
                {view.blockNumber.toString()}
              </p>
            </div>
          </div>
        </>
      )}

      {view?.state === 2 ? (
        <form
          className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void contribute();
          }}
        >
          <label className="text-xs font-semibold text-[#aab6b5]" htmlFor="genesis-contribution-amount">
            Genesis USDG amount
          </label>
          <Field
            className="mt-2"
            id="genesis-contribution-amount"
            inputMode="decimal"
            onChange={(event) => setAmountText(event.target.value)}
            value={amountText}
          />
          {parsed.error !== null ? <p className="mt-2 text-xs text-[#f1c67e]">{parsed.error}</p> : null}
          {parsed.amount > remaining ? (
            <p className="mt-2 text-xs text-[#f1c67e]">
              Amount exceeds the remaining {formatToken(remaining, 'USDG', 2, view.usdGDecimals)} cap.
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              disabled={
                transaction.readiness !== 'ready' ||
                transaction.isBusy ||
                !exactSnapshotReady ||
                !contributionOpen ||
                !allowance.needsApproval
              }
              onClick={() => void approve()}
              variant="secondary"
            >
              Approve exact genesis USDG
            </Button>
            <Button
              disabled={
                transaction.readiness !== 'ready' ||
                transaction.isBusy ||
                !exactSnapshotReady ||
                !contributionOpen ||
                allowance.needsApproval
              }
              type="submit"
            >
              {guardedActionLabel(
                transaction.readiness,
                'Simulate genesis contribution',
                'Processing…',
                transaction.isBusy,
              )}
            </Button>
          </div>
        </form>
      ) : null}

      {view?.state === 5 ? (
        <Notice className="mt-6" title="Beneficiary refund available" tone="warning">
          <p>
            This call returns the complete recorded contribution directly to the connected beneficiary. The caller
            cannot redirect the payout.
          </p>
          <Button
            className="mt-3"
            disabled={
              transaction.readiness !== 'ready' ||
              transaction.isBusy ||
              !exactSnapshotReady ||
              view.beneficiaryContribution === 0n
            }
            onClick={() => void refund()}
            size="sm"
            variant="secondary"
          >
            {guardedActionLabel(transaction.readiness, 'Refund genesis USDG', 'Processing…', transaction.isBusy)}
          </Button>
        </Notice>
      ) : null}

      {view?.state === 4 ? (
        <Notice className="mt-6" title="Genesis GBX allocation settled" tone="positive">
          <p>
            Claiming transfers the exact currently previewed GBX entitlement to the connected beneficiary. Anyone may
            trigger it, but no caller can redirect it.
          </p>
          <Button
            className="mt-3"
            disabled={
              transaction.readiness !== 'ready' ||
              transaction.isBusy ||
              !exactSnapshotReady ||
              view.beneficiaryPreviewClaim === 0n
            }
            onClick={() => void claim()}
            size="sm"
          >
            {guardedActionLabel(transaction.readiness, 'Claim genesis GBX', 'Processing…', transaction.isBusy)}
          </Button>
        </Notice>
      ) : null}

      <div className="mt-4 space-y-3">
        <TransactionGuard
          onSwitchNetwork={() => void transaction.requestNetworkSwitch()}
          readiness={transaction.readiness}
        />
        <TransactionStatus onReset={transaction.reset} state={transaction.state} />
      </div>
    </Card>
  );
}
