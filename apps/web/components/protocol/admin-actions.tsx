'use client';

import { Badge, Button, Card, Notice, SectionHeading } from '@gumball-6900/ui';
import { useState } from 'react';
import { useAccount } from 'wagmi';

import { useLiveAdminSnapshot } from '../../hooks/use-live-admin-snapshot';
import { useProtocolTransaction } from '../../hooks/use-protocol-transaction';
import { buildGuardianAdminAction, runtimeAdminRole } from '../../lib/admin-transactions';
import { formatAddress } from '../../lib/format';
import { useRuntimeDeployment } from './runtime-context';
import { TransactionGuard, TransactionStatus } from './transaction-state';
import { TypedTimelockWorkbench } from './timelock-workbench';

type GuardianActionKind =
  | 'pause-mining'
  | 'invalidate-mining-epoch'
  | 'pause-signals'
  | 'pause-strategy'
  | 'disable-selected'
  | 'pause-liquidity-migrations';

export function AdminActions() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const snapshot = useLiveAdminSnapshot();
  const transaction = useProtocolTransaction();
  const [strategyAddress, setStrategyAddress] = useState<string | null>(null);
  const live = runtime.mode === 'live';
  const rehearsal = live && runtime.runtimeKind === 'local-rehearsal';
  const testnetCandidate = live && runtime.runtimeKind === 'testnet-candidate';
  const manifestRole = live ? runtimeAdminRole(account.address, runtime) : 'none';
  const current = snapshot.data;
  const actionable = live && snapshot.source === 'live' && current !== undefined;
  const walletReady = transaction.readiness === 'ready';
  const guardianAuthorized =
    actionable &&
    account.address !== undefined &&
    current.guardian.operatorMatchesManifest &&
    current.guardian.operator.toLowerCase() === account.address.toLowerCase() &&
    (manifestRole === 'guardian' || manifestRole === 'both');
  const selectedStrategy =
    current?.strategies.find((row) => row.strategy.toLowerCase() === strategyAddress?.toLowerCase()) ??
    (runtime.mode === 'live'
      ? current?.strategies.find((row) => row.strategy.toLowerCase() === runtime.strategies.NVDA.toLowerCase())
      : undefined) ??
    current?.strategies[0];
  const selectedAsset =
    selectedStrategy?.kind === 'acquisition'
      ? current?.assets.find((row) => row.token.toLowerCase() === selectedStrategy.token.toLowerCase())
      : undefined;
  const disableSelectedAllowed =
    selectedStrategy !== undefined &&
    !selectedStrategy.voterDisabled &&
    (selectedStrategy.kind === 'buyback' ? selectedStrategy.registryLive : selectedAsset?.acquisitionEnabled === true);

  async function guardianAction(kind: GuardianActionKind) {
    if (!live || !guardianAuthorized) return;
    if ((kind === 'pause-strategy' || kind === 'disable-selected') && selectedStrategy === undefined) return;
    const action =
      kind === 'pause-mining' ||
      kind === 'invalidate-mining-epoch' ||
      kind === 'pause-signals' ||
      kind === 'pause-liquidity-migrations'
        ? ({ kind } as const)
        : kind === 'pause-strategy'
          ? ({ kind, strategy: selectedStrategy!.strategy } as const)
          : selectedStrategy!.kind === 'buyback'
            ? ({ kind: 'disable-standalone', strategy: selectedStrategy!.strategy } as const)
            : ({ kind: 'disable-acquisition', token: selectedStrategy!.token } as const);
    await transaction.submit(buildGuardianAdminAction(runtime, action), `Guardian ${kind.replaceAll('-', ' ')}`);
    await snapshot.refetch();
  }

  return (
    <>
      <Card className="mt-5 p-5 sm:p-7" tone="highlight">
        <SectionHeading
          action={
            <Badge tone={manifestRole === 'none' ? 'warning' : 'positive'}>{manifestRole.replaceAll('-', ' ')}</Badge>
          }
          description={`${rehearsal ? 'The client checks both disposable rehearsal-fixture roles' : testnetCandidate ? 'The client checks both validated testnet-candidate manifest roles' : 'The client checks both signed-manifest roles'} and current onchain operator/proposer values. Guardian buttons encode only named stop actions against manifest-pinned protocol targets.`}
          eyebrow="Connected authority"
          title="Immediate exposure controls"
        />
        <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-sm font-semibold text-white">EmergencyGuardian</p>
          <p className="mt-1 text-xs text-[#718080]">
            {snapshot.source === 'live-loading'
              ? 'Reading pinned onchain authority…'
              : guardianAuthorized
                ? 'Authorized operator'
                : 'Wallet is not the verified operator'}
          </p>
          <label className="mt-4 block text-xs font-semibold text-[#aab6b5]" htmlFor="guardian-strategy">
            Target auction strategy
          </label>
          <select
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b1112] px-3 text-sm text-white"
            id="guardian-strategy"
            onChange={(event) => setStrategyAddress(event.target.value)}
            value={selectedStrategy?.strategy ?? ''}
          >
            {(current?.strategies ?? []).map((candidate) => (
              <option key={candidate.strategy.toLowerCase()} value={candidate.strategy}>
                {candidate.symbol} · strategy {formatAddress(candidate.strategy)} · target{' '}
                {formatAddress(candidate.token)}
              </option>
            ))}
          </select>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <Button
              disabled={
                !guardianAuthorized ||
                !walletReady ||
                transaction.isBusy ||
                current?.mining.contributionsPaused !== false
              }
              onClick={() => void guardianAction('pause-mining')}
              variant="danger"
            >
              {current?.mining.contributionsPaused === true
                ? 'Mining contributions paused'
                : 'Pause mining contributions'}
            </Button>
            <Button
              disabled={
                !guardianAuthorized ||
                !walletReady ||
                transaction.isBusy ||
                current?.mining.currentEpochSettled !== false ||
                current?.mining.currentEpochInvalidated !== false
              }
              onClick={() => void guardianAction('invalidate-mining-epoch')}
              variant="danger"
            >
              {current?.mining.currentEpochInvalidated === true
                ? 'Current epoch invalidated'
                : 'Invalidate current epoch'}
            </Button>
            <Button
              disabled={
                !guardianAuthorized ||
                !walletReady ||
                transaction.isBusy ||
                current?.voter.signalActivationsPaused !== false
              }
              onClick={() => void guardianAction('pause-signals')}
              variant="danger"
            >
              {current?.voter.signalActivationsPaused === true
                ? 'Signal activations paused'
                : 'Pause signal activations'}
            </Button>
            <Button
              disabled={
                !guardianAuthorized || !walletReady || transaction.isBusy || selectedStrategy?.fillsPaused !== false
              }
              onClick={() => void guardianAction('pause-strategy')}
              variant="danger"
            >
              {selectedStrategy?.fillsPaused === true ? 'Selected strategy paused' : 'Pause selected strategy fills'}
            </Button>
            <Button
              disabled={!guardianAuthorized || !walletReady || transaction.isBusy || !disableSelectedAllowed}
              onClick={() => void guardianAction('disable-selected')}
              variant="danger"
            >
              Disable selected strategy path
            </Button>
            <Button
              disabled={
                !guardianAuthorized ||
                !walletReady ||
                transaction.isBusy ||
                current?.liquidity.migrationsPaused !== false
              }
              onClick={() => void guardianAction('pause-liquidity-migrations')}
              variant="danger"
            >
              {current?.liquidity.migrationsPaused === true
                ? 'Liquidity migrations paused'
                : 'Pause liquidity migrations'}
            </Button>
          </div>
        </div>
        {manifestRole === 'none' ? (
          <Notice className="mt-5" title="Read-only admin view" tone="warning">
            {rehearsal
              ? 'Connect the configured rehearsal guardian or timelock proposer wallet. This UI never grants a role.'
              : 'Connect the signed guardian or timelock proposer wallet. This UI never grants a role.'}
          </Notice>
        ) : null}
        {live && snapshot.source !== 'live' ? (
          <Notice className="mt-5" title="Admin writes disabled" tone="warning">
            {snapshot.source === 'live-stale'
              ? 'The last complete block is stale after a refresh failure.'
              : snapshot.source === 'live-loading'
                ? 'The one-block admin snapshot is still loading.'
                : 'The complete admin contract graph is unavailable.'}{' '}
            No typed operation can be submitted until a current hash-revalidated snapshot is available.
          </Notice>
        ) : null}
        <div className="mt-5 space-y-3">
          <TransactionGuard
            onSwitchNetwork={() => void transaction.requestNetworkSwitch()}
            readiness={transaction.readiness}
          />
          <TransactionStatus onReset={transaction.reset} state={transaction.state} />
        </div>
      </Card>
      <TypedTimelockWorkbench />
    </>
  );
}
