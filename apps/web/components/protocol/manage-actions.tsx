'use client';

import {
  buildCancelPendingSignals,
  buildCheckpointUser,
  buildManagerRewardClaim,
  buildManagerRewardTerminalDustSweep,
  buildResetSignals,
  buildSignal,
  buildStake,
  buildUnstake,
} from '@gumball-6900/sdk';
import {
  Badge,
  Button,
  Card,
  Field,
  Notice,
  SectionHeading,
  SegmentedBar,
  StatCard,
  TableShell,
  TokenMark,
} from '@gumball-6900/ui';
import { useMemo, useState, type CSSProperties } from 'react';
import type { Address } from 'viem';
import { useAccount } from 'wagmi';

import {
  useAllowance,
  useLiveManageAccountState,
  useLiveManagerRewardTerminalDust,
  useLiveStrategyState,
  type LiveManageAccountState,
} from '../../hooks/use-protocol-reads';
import { useProtocolTransaction } from '../../hooks/use-protocol-transaction';
import { formatBps, formatCountdown, formatToken, formatUSDG } from '../../lib/format';
import { registryPresentation, registryTestId } from '../../lib/registry-presentation';
import { signalAllocations, strategyFills, userSignalAccount } from '../../lib/read-model';
import { buildErc20Approval, parseInputAmount } from '../../lib/transactions';
import type { StrategySymbol } from '../../lib/runtime-types';
import { LiveStrategyFillHistory } from './protocol-activity';
import { useRuntimeDeployment } from './runtime-context';
import { guardedActionLabel, TransactionGuard, TransactionStatus } from './transaction-state';

const BPS_SCALE = 10_000n;
const MAX_USER_STRATEGIES = 16;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

function desiredSignalDraftBps(data: LiveManageAccountState): Record<string, bigint> {
  const desired = data.signals.map(({ activeWeight, pendingIncrease, strategy }, index) => ({
    index,
    key: strategy.toLowerCase(),
    raw: activeWeight + pendingIncrease,
  }));
  const totalDesired = desired.reduce((sum, row) => sum + row.raw, 0n);
  if (data.stakedBalance === 0n || totalDesired === 0n) {
    return Object.fromEntries(desired.map(({ key }) => [key, 0n]));
  }

  // A valid signal state never exceeds the stake balance. Normalizing defensively if it does keeps the draft bounded.
  const denominator = totalDesired > data.stakedBalance ? totalDesired : data.stakedBalance;
  const rows = desired.map((row) => {
    const scaled = row.raw * BPS_SCALE;
    return { ...row, bps: scaled / denominator, remainder: scaled % denominator };
  });
  const targetBps = (totalDesired * BPS_SCALE) / denominator;
  const assignedBps = rows.reduce((sum, row) => sum + row.bps, 0n);
  const remainderOrder = [...rows].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  const undistributed = Number(targetBps - assignedBps);
  for (let index = 0; index < undistributed; ++index) {
    const row = remainderOrder[index];
    if (row !== undefined) row.bps += 1n;
  }
  return Object.fromEntries(rows.map(({ bps, key }) => [key, bps]));
}

function resolvedRewardReceiver(configuredReceiver: string | undefined, beneficiary: string | undefined) {
  if (configuredReceiver === undefined) return undefined;
  return configuredReceiver.toLowerCase() === ZERO_ADDRESS ? beneficiary : configuredReceiver;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function demoStrategyKind(symbol: StrategySymbol): 'hold-usdg' | 'acquisition' | 'buyback' {
  if (symbol === 'USDG') return 'hold-usdg';
  return symbol === 'BURN' ? 'buyback' : 'acquisition';
}

export function SignalTransactionPanel() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const editorKey = `${runtime.mode}:${runtime.manifest?.gitCommit ?? 'demo'}:${
    runtime.mode === 'live' ? (account.address?.toLowerCase() ?? 'disconnected') : 'fixture'
  }`;
  return <SignalTransactionPanelForAccount accountAddress={account.address} key={editorKey} />;
}

function SignalTransactionPanelForAccount({ accountAddress }: Readonly<{ accountAddress: string | undefined }>) {
  const runtime = useRuntimeDeployment();
  const transaction = useProtocolTransaction();
  const accountState = useLiveManageAccountState();
  const strategyState = useLiveStrategyState();
  const accountKey = runtime.mode === 'live' ? (accountAddress?.toLowerCase() ?? null) : null;
  const accountSnapshot =
    runtime.mode === 'live' && accountKey !== null && accountState.data?.beneficiary.toLowerCase() === accountKey
      ? accountState.data
      : undefined;
  const [editedWeights, setEditedWeights] = useState<Readonly<Record<string, bigint>> | null>(null);
  const weights =
    editedWeights ??
    (runtime.mode === 'live'
      ? accountSnapshot === undefined
        ? {}
        : desiredSignalDraftBps(accountSnapshot)
      : Object.fromEntries(
          userSignalAccount.allocations.map((allocation) => [allocation.symbol, allocation.pendingBps]),
        ));
  const liveSignals = new Map(accountSnapshot?.signals.map((signal) => [signal.strategy.toLowerCase(), signal]));
  const signalEntries =
    runtime.mode === 'live'
      ? (strategyState.data?.rows ?? []).map((row) => ({
          disabled: row.disabled,
          key: row.strategy.toLowerCase(),
          kind: row.kind,
          live: row.live,
          strategy: row.strategy as Address | undefined,
          symbol: row.symbol,
          token: row.token,
        }))
      : userSignalAccount.allocations.map(({ symbol }) => ({
          disabled: false,
          key: symbol,
          kind: demoStrategyKind(symbol),
          live: true,
          strategy: runtime.strategies[symbol],
          symbol,
          token: symbol === 'BURN' ? runtime.assets.GBX : runtime.assets[symbol],
        }));
  const segments = signalEntries.map((entry) => ({
    ...entry,
    color: registryPresentation(entry.symbol, entry.strategy ?? ZERO_ADDRESS, entry.kind).color,
    id: entry.key,
    label:
      runtime.mode === 'live' && entry.strategy !== undefined
        ? `${entry.symbol} ${shortAddress(entry.strategy)}`
        : entry.symbol,
    valueBps: runtime.mode === 'live' && (!entry.live || entry.disabled) ? 0n : (weights[entry.key] ?? 0n),
  }));
  const total = segments.reduce((sum, segment) => sum + segment.valueBps, 0n);
  const selectedCount = segments.filter(({ valueBps }) => valueBps > 0n).length;
  const liveReady =
    runtime.mode === 'live' &&
    accountSnapshot !== undefined &&
    !accountState.isError &&
    strategyState.data !== undefined &&
    !strategyState.isError;
  const hasPendingSignals = runtime.mode === 'live' && (accountSnapshot?.activationTime ?? 0n) !== 0n;
  const pendingSignalsMature =
    hasPendingSignals &&
    accountSnapshot !== undefined &&
    accountSnapshot.blockTimestamp >= accountSnapshot.activationTime &&
    !accountSnapshot.activationsPaused;

  async function refreshSignalsAndRehydrateDraft(draftAtSubmission: typeof editedWeights) {
    await Promise.all([accountState.refetch(), strategyState.refetch()]);
    // A confirmed receipt is visible before this supplementary refresh finishes. Do not let an older action erase a
    // draft the user started after confirmation while still rehydrating from the new onchain snapshot otherwise.
    setEditedWeights((current) => (current === draftAtSubmission ? null : current));
  }

  async function submitSignals() {
    if (runtime.addresses === null || total !== 10_000n || (runtime.mode === 'live' && !liveReady)) return;
    const selected = segments.filter(
      (segment): segment is typeof segment & { strategy: Address } =>
        segment.valueBps > 0n && segment.strategy !== undefined,
    );
    if (selected.length === 0 || selected.length > MAX_USER_STRATEGIES) return;
    const draftAtSubmission = editedWeights;
    const hash = await transaction.submit(
      buildSignal(
        runtime.addresses.allocationVoter,
        selected.map(({ strategy }) => strategy),
        selected.map(({ valueBps }) => valueBps),
      ),
      'Update persistent allocation signals',
    );
    if (hash !== null) await refreshSignalsAndRehydrateDraft(draftAtSubmission);
  }

  async function resetSignals() {
    if (runtime.addresses === null) return;
    const draftAtSubmission = editedWeights;
    const hash = await transaction.submit(
      buildResetSignals(runtime.addresses.allocationVoter),
      'Reset all allocation signals',
    );
    if (hash !== null) await refreshSignalsAndRehydrateDraft(draftAtSubmission);
  }

  async function cancelPendingSignals() {
    if (runtime.addresses === null || !hasPendingSignals) return;
    const draftAtSubmission = editedWeights;
    const hash = await transaction.submit(
      buildCancelPendingSignals(runtime.addresses.allocationVoter),
      'Cancel pending signal changes',
    );
    if (hash !== null) await refreshSignalsAndRehydrateDraft(draftAtSubmission);
  }

  async function activatePendingSignals() {
    if (runtime.addresses === null || accountSnapshot === undefined || !pendingSignalsMature) return;
    const draftAtSubmission = editedWeights;
    const hash = await transaction.submit(
      buildCheckpointUser(runtime.addresses.allocationVoter, accountSnapshot.beneficiary),
      'Activate matured signal changes',
    );
    if (hash !== null) await refreshSignalsAndRehydrateDraft(draftAtSubmission);
  }

  return (
    <Card className="p-5 sm:p-7">
      <SectionHeading
        action={<Badge tone={total === 10_000n ? 'info' : 'warning'}>{formatBps(total)} allocated</Badge>}
        description="Adjust a draft across every bounded registry strategy. Onchain active weights are shown separately; increases wait 24 hours before becoming effective."
        eyebrow="Your persistent signal"
        title="Allocation weights"
      />
      <SegmentedBar className="mt-7" segments={segments} />
      <div className="mt-7 space-y-5">
        {signalEntries.map((entry) => {
          const liveSignal = liveSignals.get(entry.key);
          const signalable = runtime.mode !== 'live' || (entry.live && !entry.disabled);
          const draftWeight = signalable ? (weights[entry.key] ?? 0n) : 0n;
          const activeBps =
            accountSnapshot === undefined || accountSnapshot.stakedBalance === 0n
              ? 0n
              : ((liveSignal?.activeWeight ?? 0n) * BPS_SCALE) / accountSnapshot.stakedBalance;
          const pendingBps =
            accountSnapshot === undefined || accountSnapshot.stakedBalance === 0n
              ? 0n
              : ((liveSignal?.pendingIncrease ?? 0n) * BPS_SCALE) / accountSnapshot.stakedBalance;
          const demoAllocation = userSignalAccount.allocations.find((allocation) => allocation.symbol === entry.symbol);
          const presentation = registryPresentation(entry.symbol, entry.strategy ?? ZERO_ADDRESS, entry.kind);
          const activeLabel =
            runtime.mode === 'live'
              ? accountSnapshot === undefined
                ? 'Unavailable'
                : formatBps(activeBps)
              : formatBps(demoAllocation?.activeBps ?? 0n);
          const pendingLabel =
            runtime.mode === 'live'
              ? accountSnapshot === undefined
                ? 'Unavailable'
                : formatBps(pendingBps)
              : formatBps(demoAllocation?.pendingBps ?? 0n);
          return (
            <div
              className="rounded-2xl border border-white/7 bg-white/[0.018] p-4"
              data-testid={registryTestId('strategy-row', entry.strategy ?? entry.key)}
              key={entry.key}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <TokenMark color={presentation.color} size="sm" symbol={entry.symbol} />
                  <div>
                    <p className="text-sm font-semibold text-[#dde6e4]">{presentation.label}</p>
                    {entry.strategy === undefined || entry.token === undefined ? null : (
                      <p
                        className="mt-0.5 font-mono text-[0.64rem] text-[#718080]"
                        data-testid={registryTestId('strategy-identity', entry.strategy)}
                      >
                        Target {shortAddress(entry.token)} · Strategy {shortAddress(entry.strategy)}
                      </p>
                    )}
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-[0.68rem] text-[#647272]">
                      <span data-testid={registryTestId('active-weight', entry.strategy ?? entry.key)}>
                        Onchain active {activeLabel}
                      </span>
                      <span data-testid={registryTestId('pending-weight', entry.strategy ?? entry.key)}>
                        Pending increase {pendingLabel}
                      </span>
                      <span data-testid={registryTestId('draft-weight', entry.strategy ?? entry.key)}>
                        Draft {formatBps(draftWeight)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {runtime.mode === 'live' && !signalable ? (
                    <Badge tone="warning">{entry.live ? 'Signal disabled' : 'Registry inactive'}</Badge>
                  ) : null}
                  <span className="text-sm font-semibold text-white tabular-nums">{formatBps(draftWeight)}</span>
                </div>
              </div>
              <label className="sr-only" htmlFor={`signal-${entry.key}`}>
                Draft {entry.symbol} signal weight for target {entry.token ?? ZERO_ADDRESS} and strategy{' '}
                {entry.strategy ?? entry.key}
              </label>
              <input
                className="signal-slider mt-4"
                disabled={runtime.mode === 'live' && (!liveReady || !signalable)}
                id={`signal-${entry.key}`}
                max="10000"
                min="0"
                onChange={(event) =>
                  setEditedWeights((current) => ({
                    ...(current ?? weights),
                    [entry.key]: BigInt(event.target.value),
                  }))
                }
                style={{ '--slider-color': presentation.color } as CSSProperties}
                type="range"
                value={draftWeight.toString()}
              />
            </div>
          );
        })}
      </div>
      {runtime.mode === 'live' && !liveReady ? (
        <Notice
          className="mt-5"
          title={accountState.isError ? 'Signal state unavailable' : 'Loading signal state'}
          tone="warning"
        >
          Draft controls remain disabled until the connected account and the complete bounded strategy registry are read
          from one pinned block.
        </Notice>
      ) : null}
      {selectedCount > MAX_USER_STRATEGIES ? (
        <Notice className="mt-5" title="Too many selected strategies" tone="warning">
          AllocationVoter accepts at most {MAX_USER_STRATEGIES.toString()} nonzero strategies per update. Set at least
          one draft weight to zero before submitting.
        </Notice>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          disabled={
            transaction.readiness !== 'ready' ||
            transaction.isBusy ||
            total !== 10_000n ||
            selectedCount === 0 ||
            selectedCount > MAX_USER_STRATEGIES ||
            (runtime.mode === 'live' && !liveReady)
          }
          onClick={() => void submitSignals()}
          size="lg"
        >
          {guardedActionLabel(transaction.readiness, 'Simulate signal update', 'Processing…', transaction.isBusy)}
        </Button>
        <Button
          disabled={
            transaction.readiness !== 'ready' ||
            transaction.isBusy ||
            !pendingSignalsMature ||
            (runtime.mode === 'live' && !liveReady)
          }
          onClick={() => void activatePendingSignals()}
          size="lg"
          variant="secondary"
        >
          Activate matured changes
        </Button>
        <Button
          disabled={
            transaction.readiness !== 'ready' ||
            transaction.isBusy ||
            !hasPendingSignals ||
            (runtime.mode === 'live' && !liveReady)
          }
          onClick={() => void cancelPendingSignals()}
          size="lg"
          variant="secondary"
        >
          Cancel pending changes
        </Button>
        <Button
          disabled={transaction.readiness !== 'ready' || transaction.isBusy || (runtime.mode === 'live' && !liveReady)}
          onClick={() => void resetSignals()}
          size="lg"
          variant="secondary"
        >
          Reset onchain signals
        </Button>
      </div>
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

export function StakeTransactionPanel() {
  const runtime = useRuntimeDeployment();
  const transaction = useProtocolTransaction();
  const accountState = useLiveManageAccountState();
  const [amountText, setAmountText] = useState('25,000');
  const parsed = useMemo(() => {
    try {
      return { amount: parseInputAmount(amountText), error: null };
    } catch (error) {
      return { amount: 0n, error: error instanceof Error ? error.message : 'Enter a valid amount.' };
    }
  }, [amountText]);
  const validAmount = parsed.error === null && parsed.amount > 0n;
  const gbx = runtime.mode === 'live' ? runtime.assets.GBX : undefined;
  const stakedGBX = runtime.addresses?.stakedGBX;
  const allowance = useAllowance(gbx, stakedGBX, parsed.amount);

  async function approve() {
    if (gbx === undefined || stakedGBX === undefined || parsed.amount <= 0n) return;
    const hash = await transaction.submit(buildErc20Approval(gbx, stakedGBX, parsed.amount), 'Approve GBX for staking');
    if (hash !== null) await allowance.refetch();
  }

  async function stake() {
    if (stakedGBX === undefined || parsed.amount <= 0n) return;
    const hash = await transaction.submit(
      buildStake(stakedGBX, parsed.amount),
      `Stake ${formatToken(parsed.amount, 'GBX')}`,
    );
    if (hash !== null) await accountState.refetch();
  }

  async function unstake() {
    if (stakedGBX === undefined || parsed.amount <= 0n) return;
    const hash = await transaction.submit(
      buildUnstake(stakedGBX, parsed.amount),
      `Unstake ${formatToken(parsed.amount, 'GBX')}`,
    );
    if (hash !== null) await accountState.refetch();
  }

  return (
    <Card className="p-5 sm:p-6" tone="highlight">
      <SectionHeading
        description="GBX enters StakedGBX and mints non-transferable sGBX 1:1."
        eyebrow="Stake"
        title="Convert GBX to sGBX"
      />
      <label className="mt-6 block text-xs font-semibold text-[#aab6b5]" htmlFor="stake-amount">
        GBX amount
      </label>
      <Field
        className="mt-2"
        id="stake-amount"
        inputMode="decimal"
        onChange={(event) => setAmountText(event.target.value)}
        value={amountText}
      />
      {parsed.error !== null ? <p className="mt-2 text-[0.68rem] text-[#f1c67e]">{parsed.error}</p> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Button
          disabled={transaction.readiness !== 'ready' || transaction.isBusy || !validAmount || !allowance.needsApproval}
          onClick={() => void approve()}
          variant="secondary"
        >
          Approve
        </Button>
        <Button
          disabled={transaction.readiness !== 'ready' || transaction.isBusy || !validAmount || allowance.needsApproval}
          onClick={() => void stake()}
        >
          Stake GBX
        </Button>
        <Button
          disabled={transaction.readiness !== 'ready' || transaction.isBusy || !validAmount}
          onClick={() => void unstake()}
          variant="secondary"
        >
          Unstake
        </Button>
      </div>
      <Notice className="mt-5" title="No seven-day lock" tone="positive">
        You may unstake immediately. Active and pending signals are checkpointed and automatically reduced first, so
        withdrawn GBX never leaves unbacked signal weight.
      </Notice>
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

export function RewardClaimsPanel() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const transaction = useProtocolTransaction();
  const accountState = useLiveManageAccountState();
  const terminalDustState = useLiveManagerRewardTerminalDust();
  const rewardSnapshot =
    account.address !== undefined && accountState.data?.beneficiary.toLowerCase() === account.address.toLowerCase()
      ? accountState.data
      : undefined;
  const rewards =
    runtime.mode === 'live'
      ? (rewardSnapshot?.rewards ?? []).map((reward) => ({
          earnedRaw: reward.earnedRaw,
          identity: reward.rewardToken,
          managerRewards: reward.managerRewards as Address | undefined,
          receiver: resolvedRewardReceiver(reward.receiver, account.address),
          rewardTokenDecimals: reward.rewardTokenDecimals,
          symbol: reward.symbol,
          totalPendingTerminalDust: reward.totalPendingTerminalDust,
        }))
      : userSignalAccount.rewards.map((reward) => ({
          earnedRaw: reward.amount,
          identity: reward.symbol,
          managerRewards: undefined,
          receiver: undefined,
          rewardTokenDecimals: 18,
          symbol: reward.symbol,
          totalPendingTerminalDust: null,
        }));
  const terminalDustRows = runtime.mode === 'live' ? (terminalDustState.data?.rows ?? []) : [];

  async function claim(reward: (typeof rewards)[number]) {
    if (runtime.mode !== 'live' || account.address === undefined || reward.managerRewards === undefined) return;
    const hash = await transaction.submit(
      buildManagerRewardClaim(reward.managerRewards, account.address),
      `Claim ${reward.symbol} manager rewards`,
      { validatedErrorContractKind: 'manager-rewards' },
    );
    if (hash !== null) await accountState.refetch();
  }

  async function sweepTerminalDust(row: (typeof terminalDustRows)[number]) {
    if (runtime.mode !== 'live') return;
    const hash = await transaction.submit(
      buildManagerRewardTerminalDustSweep(row.managerRewards, row.generation, row.remainderCycle),
      `Sweep ${row.symbol} terminal dust generation ${row.generation.toString()} cycle ${row.remainderCycle.toString()} to the vault`,
      { validatedErrorContractKind: 'manager-rewards' },
    );
    if (hash !== null) await Promise.all([terminalDustState.refetch(), accountState.refetch()]);
  }

  return (
    <Card className="p-5 sm:p-6">
      <SectionHeading
        action={
          runtime.mode === 'live' && rewardSnapshot !== undefined ? (
            <Badge tone="info">Pinned block {rewardSnapshot.blockNumber.toString()}</Badge>
          ) : undefined
        }
        eyebrow="Manager rewards"
        title="Assets earned"
      />
      {runtime.mode === 'live' && account.address === undefined ? (
        <Notice className="mt-5" title="Connect a wallet">
          Reward accrual is beneficiary-specific.
        </Notice>
      ) : null}
      {runtime.mode === 'live' && account.address !== undefined && rewardSnapshot === undefined ? (
        <Notice
          className="mt-5"
          title={accountState.isError ? 'Reward reads unavailable' : 'Loading rewards'}
          tone="warning"
        >
          No fixture reward amounts are substituted. Every registered reward contract must validate at one pinned block
          before claims are enabled.
        </Notice>
      ) : null}
      <div className="mt-6 divide-y divide-white/6">
        {rewards.map((reward) => {
          const alternateReceiver =
            runtime.mode === 'live' &&
            account.address !== undefined &&
            reward.receiver !== undefined &&
            reward.receiver.toLowerCase() !== account.address.toLowerCase();
          const presentation = registryPresentation(reward.symbol, reward.managerRewards ?? ZERO_ADDRESS);
          return (
            <div
              className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              data-testid={registryTestId('reward-row', reward.identity)}
              key={reward.identity.toLowerCase()}
            >
              <div className="flex items-center gap-3">
                <TokenMark color={presentation.color} size="sm" symbol={reward.symbol} />
                <div>
                  <p className="text-sm font-semibold text-[#cdd7d5]">{reward.symbol}</p>
                  <p className="mt-0.5 text-[0.68rem] text-[#657373]">
                    {reward.earnedRaw === null
                      ? 'Unavailable'
                      : formatToken(reward.earnedRaw, reward.symbol, 4, reward.rewardTokenDecimals)}
                  </p>
                  {reward.managerRewards === undefined ? null : (
                    <p className="mt-0.5 font-mono text-[0.62rem] text-[#526060]">
                      Rewards contract {shortAddress(reward.managerRewards)}
                    </p>
                  )}
                  {reward.totalPendingTerminalDust === null || reward.managerRewards === undefined ? null : (
                    <p
                      className="mt-0.5 text-[0.68rem] text-[#7f8e8d]"
                      data-testid={registryTestId('reward-terminal-dust', reward.managerRewards)}
                    >
                      Queued terminal dust{' '}
                      {formatToken(reward.totalPendingTerminalDust, reward.symbol, 6, reward.rewardTokenDecimals)}
                    </p>
                  )}
                  {reward.receiver === undefined ? null : (
                    <p
                      className="mt-0.5 font-mono text-[0.62rem] text-[#687777]"
                      data-testid={registryTestId('reward-receiver', reward.identity)}
                      title={reward.receiver}
                    >
                      Claim receiver {shortAddress(reward.receiver)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {alternateReceiver ? <Badge tone="warning">Alternate receiver</Badge> : null}
                <Button
                  disabled={
                    transaction.readiness !== 'ready' ||
                    transaction.isBusy ||
                    reward.earnedRaw === null ||
                    reward.earnedRaw === 0n ||
                    (runtime.mode === 'live' && (accountState.isFetching || accountState.isError))
                  }
                  onClick={() => void claim(reward)}
                  size="sm"
                  variant="secondary"
                >
                  Claim
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {runtime.mode === 'live' ? (
        <div className="mt-7 border-t border-white/7 pt-7">
          <SectionHeading
            action={
              terminalDustState.data === undefined ? (
                <Badge tone="warning">Unavailable</Badge>
              ) : (
                <Badge tone="info">Indexed block {terminalDustState.data.indexedBlock.toString()}</Badge>
              )
            }
            description="Completed signal generations can leave indivisible token dust. Every listed coordinate is permissionlessly swept to the fixed GumBallVault destination."
            eyebrow="Terminal accounting"
            title="Queued vault dust"
          />
          {terminalDustState.data === undefined ? (
            <Notice
              className="mt-5"
              title={terminalDustState.isError ? 'Dust index unavailable' : 'Loading dust index'}
              tone="warning"
            >
              {terminalDustState.isError
                ? 'The complete paginated subgraph rows, Lens-derived contract identities, and same-block onchain totals did not all validate. No fixture rows or sweep actions are substituted.'
                : 'Validating every unsettled page against the Lens-derived rewards contracts and onchain totals at one indexed block.'}
              {terminalDustState.isError ? (
                <Button className="mt-3" onClick={() => void terminalDustState.refetch()} size="sm" variant="secondary">
                  Retry dust index
                </Button>
              ) : null}
            </Notice>
          ) : terminalDustRows.length === 0 ? (
            <Notice className="mt-5" title="No queued terminal dust" tone="positive">
              Every configured ManagerRewards contract reports a zero pending aggregate at the indexed block.
            </Notice>
          ) : (
            <TableShell className="mt-5">
              <table className="financial-table min-w-[48rem]">
                <caption className="sr-only">Permissionless ManagerRewards terminal-dust sweeps</caption>
                <thead>
                  <tr>
                    <th>Reward</th>
                    <th>Generation</th>
                    <th>Cycle</th>
                    <th>Amount</th>
                    <th>Fixed destination</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {terminalDustRows.map((row) => {
                    const coordinate = `${row.managerRewards.toLowerCase()}-${row.generation.toString()}-${row.remainderCycle.toString()}`;
                    return (
                      <tr data-testid={`terminal-dust-row-${coordinate}`} key={coordinate}>
                        <td>
                          <div className="font-semibold text-white">{row.symbol}</div>
                          <div className="mt-1 font-mono text-[0.62rem] text-[#657373]">
                            {shortAddress(row.managerRewards)}
                          </div>
                        </td>
                        <td className="tabular-nums">{row.generation.toString()}</td>
                        <td className="tabular-nums">{row.remainderCycle.toString()}</td>
                        <td className="font-semibold text-[#79f8e8] tabular-nums">
                          {formatToken(row.amountRaw, row.symbol, 6, row.rewardTokenDecimals)}
                        </td>
                        <td>
                          <div>GumBallVault</div>
                          <div className="mt-1 font-mono text-[0.62rem] text-[#657373]">
                            {shortAddress(runtime.addresses.gumBallVault)}
                          </div>
                        </td>
                        <td>
                          <Button
                            aria-label={`Sweep ${row.symbol} generation ${row.generation.toString()} cycle ${row.remainderCycle.toString()} to GumBallVault`}
                            disabled={
                              transaction.readiness !== 'ready' || transaction.isBusy || terminalDustState.isFetching
                            }
                            onClick={() => void sweepTerminalDust(row)}
                            size="sm"
                            variant="secondary"
                          >
                            Sweep to vault
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          )}
        </div>
      ) : null}
      <p className="mt-5 text-[0.68rem] leading-5 text-[#687676]">
        Only effective active weight at fill settlement earns the 2% target-asset manager split. Accrued rewards remain
        claimable after unstaking.
      </p>
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

export function ManageAccountStats() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const accountState = useLiveManageAccountState();

  if (runtime.mode === 'demo') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail="Deterministic demo wallet"
          label="GBX balance"
          value={formatToken(userSignalAccount.walletGBX, 'GBX')}
        />
        <StatCard
          detail="Deterministic demo, non-transferable"
          label="sGBX balance"
          value={formatToken(userSignalAccount.stakedGBX, 'sGBX')}
        />
        <StatCard
          detail="Deterministic demo"
          label="Unallocated sGBX"
          value={formatToken(userSignalAccount.unallocatedSGBX, 'sGBX')}
        />
        <StatCard
          detail="Deterministic demo"
          label="Pending activation"
          value={formatCountdown(userSignalAccount.pendingActivatesInSeconds)}
        />
      </div>
    );
  }

  const data =
    account.address !== undefined && accountState.data?.beneficiary.toLowerCase() === account.address.toLowerCase()
      ? accountState.data
      : undefined;
  const desiredWeight =
    data?.signals.reduce((sum, signal) => sum + signal.activeWeight + signal.pendingIncrease, 0n) ?? 0n;
  const unallocated =
    data === undefined || desiredWeight >= data.stakedBalance ? 0n : data.stakedBalance - desiredWeight;
  const pendingSeconds =
    data === undefined || data.activationTime <= data.blockTimestamp
      ? 0
      : Number(data.activationTime - data.blockTimestamp);
  const detail =
    account.address === undefined
      ? 'Connect beneficiary wallet'
      : data === undefined
        ? accountState.isError
          ? 'Pinned RPC read failed'
          : 'Loading pinned RPC state'
        : `Pinned block ${data.blockNumber.toString()}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        detail={detail}
        label="GBX balance"
        value={data === undefined ? 'Unavailable' : formatToken(data.gbxBalance, 'GBX')}
      />
      <StatCard
        detail={detail}
        label="sGBX balance"
        value={data === undefined ? 'Unavailable' : formatToken(data.stakedBalance, 'sGBX')}
      />
      <StatCard
        detail={detail}
        label="Unallocated sGBX"
        value={data === undefined ? 'Unavailable' : formatToken(unallocated, 'sGBX')}
      />
      <StatCard
        detail={detail}
        label="Pending activation"
        value={
          data === undefined ? 'Unavailable' : data.activationTime === 0n ? 'None' : formatCountdown(pendingSeconds)
        }
      />
    </div>
  );
}

export function ManageStrategyStatePanels() {
  const runtime = useRuntimeDeployment();
  const strategyState = useLiveStrategyState();

  if (runtime.mode === 'demo') {
    return (
      <>
        <Card className="mt-5 p-5 sm:p-7">
          <SectionHeading
            description="Deterministic preview budgets and effective weights."
            eyebrow="Demo allocation"
            title="Preview budgets and effective weight"
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {signalAllocations.map((signal) => (
              <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4" key={signal.symbol}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#d5dedd]">{signal.label}</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{formatBps(signal.activeBps)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-[0.68rem]">
                  <span className="text-[#657373]">Virtual budget</span>
                  <span className="text-[#9fadaa]">{formatUSDG(signal.budgetUSDG, true, 18)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <DemoStrategyFills />
      </>
    );
  }

  const totalActive = strategyState.data?.rows.reduce((sum, row) => sum + row.activeWeight, 0n) ?? 0n;
  const rows = strategyState.data?.rows ?? [];
  return (
    <>
      <Card className="mt-5 p-5 sm:p-7">
        <SectionHeading
          action={
            strategyState.data === undefined ? (
              <Badge tone="warning">Unavailable</Badge>
            ) : (
              <Badge tone="info">Pinned block {strategyState.data.blockNumber.toString()}</Badge>
            )
          }
          description="Every row is keyed from the bounded onchain registry; weight and budget come from one pinned Lens snapshot."
          eyebrow="Protocol allocation"
          title="Current budgets and effective weight"
        />
        {strategyState.data === undefined ? (
          <Notice
            className="mt-5"
            title={strategyState.isError ? 'Strategy reads failed' : 'Loading strategies'}
            tone="warning"
          >
            No deterministic budgets are substituted in a contract-enabled runtime.
          </Notice>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((state) => {
            const presentation = registryPresentation(state.symbol, state.strategy, state.kind);
            return (
              <div
                className="rounded-2xl border border-white/7 bg-white/[0.02] p-4"
                data-testid={registryTestId('global-strategy-row', state.strategy)}
                key={state.strategy.toLowerCase()}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#d5dedd]">{presentation.label}</span>
                  <Badge tone={state.disabled ? 'warning' : 'info'}>
                    {!state.live
                      ? 'Registry inactive'
                      : state.disabled
                        ? 'Signal disabled'
                        : totalActive === 0n
                          ? '0%'
                          : formatBps((state.activeWeight * 10_000n) / totalActive)}
                  </Badge>
                </div>
                <p className="mt-2 font-mono text-[0.62rem] text-[#526060]">{shortAddress(state.strategy)}</p>
                <div className="mt-4 flex items-center justify-between text-[0.68rem]">
                  <span className="text-[#657373]">Virtual budget</span>
                  <span className="text-[#9fadaa]">
                    {formatUSDG(state.virtualUSDGBudget, true, runtime.assetMetadata.USDG.decimals)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <LiveStrategyFillHistory />
    </>
  );
}

function DemoStrategyFills() {
  return (
    <Card className="mt-5 p-5 sm:p-7">
      <SectionHeading
        description="Deterministic reverse Dutch auction settlement examples."
        eyebrow="Demo fills"
        title="Acquisition settlement preview"
      />
      <TableShell className="mt-6">
        <table className="financial-table min-w-[56rem]">
          <caption className="sr-only">Demo acquisition strategy fills</caption>
          <thead>
            <tr>
              <th>Strategy</th>
              <th>USDG spent</th>
              <th>Target received</th>
              <th>Vault 98%</th>
              <th>Managers 2%</th>
              <th>Settled</th>
            </tr>
          </thead>
          <tbody>
            {strategyFills.map((fill) => (
              <tr key={fill.id}>
                <td className="font-semibold text-white">{fill.symbol}</td>
                <td>{formatToken(fill.usdSpent, 'USDG')}</td>
                <td>{formatToken(fill.targetReceived, fill.symbol, 4)}</td>
                <td>{formatToken(fill.vaultReceived, fill.symbol, 4)}</td>
                <td>{formatToken(fill.managerReceived, fill.symbol, 4)}</td>
                <td>{fill.settled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </Card>
  );
}
