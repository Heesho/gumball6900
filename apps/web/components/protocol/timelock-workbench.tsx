'use client';

import { Badge, Button, Card, Field, Notice, SectionHeading } from '@gumball-6900/ui';
import { useEffect, useRef, useState } from 'react';
import {
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { useAccount, usePublicClient } from 'wagmi';

import { useLiveAdminSnapshot } from '../../hooks/use-live-admin-snapshot';
import { useProtocolTransaction } from '../../hooks/use-protocol-transaction';
import { useTimelockOperation } from '../../hooks/use-timelock-operation';
import {
  assertTimelockOperationPreconditions,
  readTimelockOperationSnapshot,
} from '../../lib/admin-operation-preflight';
import {
  buildKnownTimelockCancel,
  buildKnownTimelockTransaction,
  runtimeAdminRole,
  type TimelockMigrationRemoval,
  type TimelockMigrationReplacement,
  type TimelockOperation,
} from '../../lib/admin-transactions';
import {
  acquisitionStrategyCreationCode,
  managerRewardsCreationCode,
} from '../../lib/generated-strategy-creation-code';
import { formatAddress, parseUnitsExact } from '../../lib/format';
import { readLiveAdminSnapshot } from '../../lib/live-admin-snapshot';
import { parseInputAmount } from '../../lib/transactions';
import type { LiveRuntimeDeployment } from '../../lib/runtime-types';
import { useRuntimeDeployment } from './runtime-context';
import { TransactionGuard, TransactionStatus } from './transaction-state';

type WorkbenchKind =
  | 'unpause-mining'
  | 'unpause-signals'
  | 'unpause-strategy'
  | 'reset-reference-rate'
  | 'rotate-guardian'
  | 'recover-registry'
  | 'reactivate-strategy'
  | 'set-redemption-enabled'
  | 'unpause-liquidity-migrations'
  | 'deploy-acquisition'
  | 'register-asset'
  | 'migrate-liquidity';

interface MigrationRemovalDraft {
  positionId: string;
  amount0Min: string;
  amount1Min: string;
}

interface MigrationReplacementDraft {
  tickLower: string;
  tickUpper: string;
  liquidity: string;
  amount0Max: string;
  amount1Max: string;
}

const inputClass =
  'mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b1112] px-3 text-sm text-white outline-none focus:border-[#67f5e4]/55';

function exactAddress(value: string, label: string): Address {
  const trimmed = value.trim();
  if (!isAddress(trimmed, { strict: false })) throw new TypeError(`${label} must be an EVM address.`);
  const parsed = getAddress(trimmed);
  if (parsed.toLowerCase() === zeroAddress) throw new TypeError(`${label} must not be zero.`);
  return parsed;
}

function exactHash(value: string, label: string): Hex {
  const trimmed = value.trim();
  if (!/^0x[\da-f]{64}$/iu.test(trimmed) || /^0x0{64}$/iu.test(trimmed)) {
    throw new TypeError(`${label} must be a nonzero 32-byte hex value.`);
  }
  return trimmed.toLowerCase() as Hex;
}

function exactInteger(value: string, label: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+$/u.test(trimmed)) throw new TypeError(`${label} must be a non-negative integer.`);
  return BigInt(trimmed);
}

function exactSignedInteger(value: string, label: string): number {
  const trimmed = value.trim();
  if (!/^-?\d+$/u.test(trimmed)) throw new TypeError(`${label} must be an integer.`);
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) throw new RangeError(`${label} is outside the safe integer range.`);
  return parsed;
}

function nonnegativeTokenAmount(value: string, decimals: number, label: string): bigint {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/u.test(trimmed)) {
    throw new TypeError(`${label} must be a non-negative decimal token amount.`);
  }
  const parsed = parseUnitsExact(trimmed.replaceAll(',', ''), decimals);
  if (parsed < 0n) throw new RangeError(`${label} must not be negative.`);
  return parsed;
}

export function parseMigrationDeadline(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(trimmed)) {
    throw new TypeError('Migration deadline must use exact UTC format YYYY-MM-DDTHH:mm:ssZ.');
  }
  const milliseconds = Date.parse(trimmed);
  if (!Number.isSafeInteger(milliseconds) || new Date(milliseconds).toISOString().replace('.000Z', 'Z') !== trimmed) {
    throw new TypeError('Migration deadline is not a real UTC timestamp.');
  }
  return BigInt(milliseconds / 1_000);
}

function operationLabel(operation: TimelockOperation): string {
  const labels: Record<TimelockOperation['kind'], string> = {
    'unpause-mining': 'unpause mining contributions',
    'unpause-signals': 'unpause signal activations',
    'unpause-strategy': 'unpause auction fills',
    'reset-reference-rate': 'supersede the auction reference rate',
    'rotate-guardian': 'rotate guardian operator',
    'enable-acquisition': 're-enable asset acquisition',
    'enable-standalone': 're-enable standalone buyback',
    'reactivate-strategy': 'reactivate strategy in the voter',
    'set-redemption-enabled': 'set redemption-readiness metadata',
    'unpause-liquidity-migrations': 'unpause liquidity migrations',
    'deploy-acquisition': 'deploy canonical acquisition strategy pair',
    'register-asset': 'register validated asset',
    'register-stock-asset': 'register validated stock asset',
    'migrate-liquidity': 'migrate canonical liquidity positions',
  };
  return labels[operation.kind];
}

function FieldLabel({ children, htmlFor }: Readonly<{ children: React.ReactNode; htmlFor: string }>) {
  return (
    <label className="block text-xs font-semibold text-[#aab6b5]" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function prepareOperation(
  kind: WorkbenchKind,
  runtime: LiveRuntimeDeployment,
  snapshot: NonNullable<ReturnType<typeof useLiveAdminSnapshot>['data']>,
  values: Readonly<{
    selectedAuctionStrategy: Address | undefined;
    selectedRecoveryStrategy: Address | undefined;
    selectedAssetToken: Address | undefined;
    expectedReferenceRate: string;
    referenceRate: string;
    newGuardian: string;
    redemptionEnabled: boolean;
    assetToken: string;
    assetId: string;
    assetSymbol: string;
    assetDecimals: string;
    assetStrategy: string;
    assetRewards: string;
    stock: boolean;
    tokenRuntimeHash: string;
    beacon: string;
    beaconRuntimeHash: string;
    implementation: string;
    implementationRuntimeHash: string;
    uiMultiplier: string;
    minimumLot: string;
    maximumLot: string;
    initialReferenceRate: string;
    removals: readonly MigrationRemovalDraft[];
    replacements: readonly MigrationReplacementDraft[];
    migrationDeadline: string;
  }>,
): TimelockOperation {
  if (kind === 'unpause-mining' || kind === 'unpause-signals') return { kind };
  if (kind === 'unpause-strategy') {
    if (values.selectedAuctionStrategy === undefined) throw new Error('Select an auction strategy.');
    return { kind, strategy: values.selectedAuctionStrategy };
  }
  if (kind === 'reset-reference-rate') {
    if (values.selectedAuctionStrategy === undefined) throw new Error('Select an auction strategy.');
    return {
      kind,
      strategy: values.selectedAuctionStrategy,
      expectedReferenceRate: parseInputAmount(values.expectedReferenceRate, 18),
      newReferenceRate: parseInputAmount(values.referenceRate, 18),
    };
  }
  if (kind === 'rotate-guardian') {
    return { kind, newOperator: exactAddress(values.newGuardian, 'New guardian operator') };
  }
  if (kind === 'recover-registry') {
    if (values.selectedRecoveryStrategy === undefined) throw new Error('Select a disabled strategy path.');
    const row = snapshot.strategyRegistry.find(
      (candidate) => candidate.strategy.toLowerCase() === values.selectedRecoveryStrategy!.toLowerCase(),
    );
    if (row === undefined) throw new Error('Selected recovery strategy is absent from the pinned registry.');
    return row.kind === 'buyback'
      ? { kind: 'enable-standalone', strategy: row.strategy }
      : { kind: 'enable-acquisition', token: row.token };
  }
  if (kind === 'reactivate-strategy') {
    if (values.selectedRecoveryStrategy === undefined) throw new Error('Select a voter-disabled strategy.');
    return { kind, strategy: values.selectedRecoveryStrategy };
  }
  if (kind === 'set-redemption-enabled') {
    if (values.selectedAssetToken === undefined) throw new Error('Select a registered asset.');
    return { kind, token: values.selectedAssetToken, enabled: values.redemptionEnabled };
  }
  if (kind === 'unpause-liquidity-migrations') return { kind };

  const targetToken = exactAddress(values.assetToken, 'Target token');
  if (kind === 'deploy-acquisition') {
    return {
      kind,
      strategyCreationCode: acquisitionStrategyCreationCode,
      rewardsCreationCode: managerRewardsCreationCode,
      targetToken,
      minimumLotUSDG: parseInputAmount(values.minimumLot, runtime.assetMetadata.USDG.decimals),
      maximumLotUSDG: parseInputAmount(values.maximumLot, runtime.assetMetadata.USDG.decimals),
      initialReferenceRate: parseInputAmount(values.initialReferenceRate, 18),
    };
  }
  if (kind === 'register-asset') {
    const symbol = values.assetSymbol.trim();
    if (!/^[!-~]{1,32}$/u.test(symbol)) throw new Error('Expected token symbol must be 1–32 printable ASCII bytes.');
    const decimals = Number(values.assetDecimals.trim());
    if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) {
      throw new Error('Token decimals must be an integer from 0 through 18.');
    }
    const config = {
      token: targetToken,
      assetId: exactHash(values.assetId, 'Asset ID'),
      symbolHash: keccak256(stringToHex(symbol)),
      decimals,
      strategy: exactAddress(values.assetStrategy, 'AcquisitionStrategy'),
      rewards: exactAddress(values.assetRewards, 'ManagerRewards'),
      isStockToken: values.stock,
      acquisitionEnabled: true,
      redemptionEnabled: true,
    } as const;
    if (!values.stock) return { kind, config };
    return {
      kind: 'register-stock-asset',
      config,
      dependency: {
        tokenRuntimeCodeHash: exactHash(values.tokenRuntimeHash, 'Token runtime code hash'),
        beacon: exactAddress(values.beacon, 'Stock-token beacon'),
        beaconRuntimeCodeHash: exactHash(values.beaconRuntimeHash, 'Beacon runtime code hash'),
        implementation: exactAddress(values.implementation, 'Stock-token implementation'),
        implementationRuntimeCodeHash: exactHash(values.implementationRuntimeHash, 'Implementation runtime code hash'),
        uiMultiplier: parseInputAmount(values.uiMultiplier, 18),
      },
    };
  }

  const token0IsGBX = snapshot.liquidity.poolKey.currency0.toLowerCase() === runtime.addresses.gbx.toLowerCase();
  const amount0Decimals = token0IsGBX ? runtime.assetMetadata.GBX.decimals : runtime.assetMetadata.USDG.decimals;
  const amount1Decimals = token0IsGBX ? runtime.assetMetadata.USDG.decimals : runtime.assetMetadata.GBX.decimals;
  const removals: TimelockMigrationRemoval[] = values.removals.map((row, index) => ({
    positionId: exactInteger(row.positionId, `Removal ${index + 1} position ID`),
    amount0Min: nonnegativeTokenAmount(row.amount0Min, amount0Decimals, `Removal ${index + 1} amount0`),
    amount1Min: nonnegativeTokenAmount(row.amount1Min, amount1Decimals, `Removal ${index + 1} amount1`),
  }));
  const replacements: TimelockMigrationReplacement[] = values.replacements.map((row, index) => ({
    tickLower: exactSignedInteger(row.tickLower, `Replacement ${index + 1} lower tick`),
    tickUpper: exactSignedInteger(row.tickUpper, `Replacement ${index + 1} upper tick`),
    liquidity: exactInteger(row.liquidity, `Replacement ${index + 1} liquidity`),
    amount0Max: nonnegativeTokenAmount(row.amount0Max, amount0Decimals, `Replacement ${index + 1} amount0`),
    amount1Max: nonnegativeTokenAmount(row.amount1Max, amount1Decimals, `Replacement ${index + 1} amount1`),
  }));
  return {
    kind,
    plan: {
      destinationPoolKey: snapshot.liquidity.poolKey,
      removals,
      replacements,
      deadline: parseMigrationDeadline(values.migrationDeadline),
    },
  };
}

async function freshOperationTransaction(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  operation: TimelockOperation,
  mode: 'schedule' | 'execute',
) {
  const snapshot = await readLiveAdminSnapshot(client, runtime);
  const state = await readTimelockOperationSnapshot(client, runtime, snapshot, operation);
  if (mode === 'schedule' ? state.state !== 'unscheduled' : state.state !== 'matured') {
    throw new Error(
      mode === 'schedule'
        ? 'This exact operation is already scheduled.'
        : 'This exact operation is not inside its mature execution window.',
    );
  }
  await assertTimelockOperationPreconditions(client, runtime, snapshot, operation, mode);
  return buildKnownTimelockTransaction(runtime, mode, operation);
}

async function freshCancelTransaction(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  operation: TimelockOperation,
) {
  const snapshot = await readLiveAdminSnapshot(client, runtime);
  const state = await readTimelockOperationSnapshot(client, runtime, snapshot, operation);
  if (state.state === 'unscheduled') throw new Error('This exact operation is not scheduled.');
  return buildKnownTimelockCancel(runtime, state.operationId);
}

export function TypedTimelockWorkbench() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const client = usePublicClient();
  const admin = useLiveAdminSnapshot();
  const transaction = useProtocolTransaction();
  const [kind, setKind] = useState<WorkbenchKind>('unpause-mining');
  const [auctionStrategy, setAuctionStrategy] = useState('');
  const [recoveryStrategy, setRecoveryStrategy] = useState('');
  const [assetSelection, setAssetSelection] = useState('');
  const [expectedReferenceRate, setExpectedReferenceRate] = useState('');
  const [referenceRate, setReferenceRate] = useState('');
  const [newGuardian, setNewGuardian] = useState('');
  const [redemptionEnabled, setRedemptionEnabled] = useState(true);
  const [assetToken, setAssetToken] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assetSymbol, setAssetSymbol] = useState('');
  const [assetDecimals, setAssetDecimals] = useState('18');
  const [assetStrategy, setAssetStrategy] = useState('');
  const [assetRewards, setAssetRewards] = useState('');
  const [stock, setStock] = useState(false);
  const [tokenRuntimeHash, setTokenRuntimeHash] = useState('');
  const [beacon, setBeacon] = useState('');
  const [beaconRuntimeHash, setBeaconRuntimeHash] = useState('');
  const [implementation, setImplementation] = useState('');
  const [implementationRuntimeHash, setImplementationRuntimeHash] = useState('');
  const [uiMultiplier, setUiMultiplier] = useState('1');
  const [minimumLot, setMinimumLot] = useState('');
  const [maximumLot, setMaximumLot] = useState('');
  const [initialReferenceRate, setInitialReferenceRate] = useState('');
  const [migrationDeadline, setMigrationDeadline] = useState('');
  const [removals, setRemovals] = useState<MigrationRemovalDraft[]>([
    { positionId: '', amount0Min: '0', amount1Min: '0' },
  ]);
  const [replacements, setReplacements] = useState<MigrationReplacementDraft[]>([
    { tickLower: '', tickUpper: '', liquidity: '', amount0Max: '0', amount1Max: '0' },
  ]);
  const baselineStrategyRef = useRef<string | null>(null);

  const snapshot = admin.data;
  const selectedAuction =
    snapshot?.strategies.find((row) => row.strategy.toLowerCase() === auctionStrategy.toLowerCase()) ??
    snapshot?.strategies[0];
  useEffect(() => {
    if (kind !== 'reset-reference-rate' || selectedAuction === undefined) return;
    const selectedKey = selectedAuction.strategy.toLowerCase();
    if (baselineStrategyRef.current === selectedKey) return;
    baselineStrategyRef.current = selectedKey;
    setExpectedReferenceRate(formatUnits(selectedAuction.referenceRate, 18));
  }, [kind, selectedAuction]);
  const eligibleRecoveryStrategies =
    snapshot?.strategyRegistry.filter((row) =>
      kind === 'recover-registry' ? !row.live : kind === 'reactivate-strategy' ? row.live && row.voterDisabled : false,
    ) ?? [];
  const selectedRecovery =
    eligibleRecoveryStrategies.find((row) => row.strategy.toLowerCase() === recoveryStrategy.toLowerCase()) ??
    eligibleRecoveryStrategies[0];
  const selectedAsset =
    snapshot?.assets.find((row) => row.token.toLowerCase() === assetSelection.toLowerCase()) ?? snapshot?.assets[0];
  let operation: TimelockOperation | undefined;
  let formError: string | null = null;
  if (runtime.mode === 'live' && snapshot !== undefined) {
    try {
      operation = prepareOperation(kind, runtime, snapshot, {
        selectedAuctionStrategy: selectedAuction?.strategy,
        selectedRecoveryStrategy: selectedRecovery?.strategy,
        selectedAssetToken: selectedAsset?.token,
        expectedReferenceRate,
        referenceRate,
        newGuardian,
        redemptionEnabled,
        assetToken,
        assetId,
        assetSymbol,
        assetDecimals,
        assetStrategy,
        assetRewards,
        stock,
        tokenRuntimeHash,
        beacon,
        beaconRuntimeHash,
        implementation,
        implementationRuntimeHash,
        uiMultiplier,
        minimumLot,
        maximumLot,
        initialReferenceRate,
        removals,
        replacements,
        migrationDeadline,
      });
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Complete every required field.';
    }
  }
  const operationRead = useTimelockOperation(operation, snapshot, admin.source === 'live');
  const live = runtime.mode === 'live';
  const manifestRole = live ? runtimeAdminRole(account.address, runtime) : 'none';
  const proposerAuthorized =
    live &&
    admin.source === 'live' &&
    snapshot !== undefined &&
    account.address !== undefined &&
    snapshot.timelock.proposer.toLowerCase() === account.address.toLowerCase() &&
    (manifestRole === 'timelock-proposer' || manifestRole === 'both');
  const exactState = operationRead.source === 'live' ? operationRead.data : undefined;
  const canQueue =
    proposerAuthorized &&
    exactState?.state === 'unscheduled' &&
    exactState.preconditionError === null &&
    transaction.readiness === 'ready' &&
    !transaction.isBusy;
  const canExecute =
    admin.source === 'live' &&
    exactState?.state === 'matured' &&
    exactState.preconditionError === null &&
    transaction.readiness === 'ready' &&
    !transaction.isBusy;
  const canCancel =
    proposerAuthorized &&
    exactState !== undefined &&
    exactState.state !== 'unscheduled' &&
    transaction.readiness === 'ready' &&
    !transaction.isBusy;

  async function submit(mode: 'schedule' | 'execute') {
    if (!live || client === undefined || operation === undefined) return;
    await transaction.submit(
      () => freshOperationTransaction(client, runtime, operation, mode),
      `${mode === 'schedule' ? 'Queue' : 'Execute'} ${operationLabel(operation)}`,
      { errorTarget: runtime.admin.protocolTimelock },
    );
    await Promise.allSettled([admin.refetch(), operationRead.refetch()]);
  }

  async function cancel() {
    if (!live || client === undefined || operation === undefined || !proposerAuthorized) return;
    await transaction.submit(
      () => freshCancelTransaction(client, runtime, operation),
      `Cancel ${operationLabel(operation)}`,
      { errorTarget: runtime.admin.protocolTimelock },
    );
    await Promise.allSettled([admin.refetch(), operationRead.refetch()]);
  }

  const showAuction = kind === 'unpause-strategy' || kind === 'reset-reference-rate';
  const showRecovery = kind === 'recover-registry' || kind === 'reactivate-strategy';
  const showAssetSelection = kind === 'set-redemption-enabled';
  const showGrowth = kind === 'deploy-acquisition' || kind === 'register-asset';
  const token0Symbol =
    live && snapshot?.liquidity.poolKey.currency0.toLowerCase() === runtime.addresses.gbx.toLowerCase()
      ? 'GBX'
      : 'USDG';
  const token1Symbol = token0Symbol === 'GBX' ? 'USDG' : 'GBX';

  return (
    <Card className="mt-5 p-5 sm:p-7" data-testid="typed-timelock-workbench">
      <SectionHeading
        action={
          <Badge tone={proposerAuthorized ? 'positive' : 'info'}>
            {proposerAuthorized ? 'Proposer' : 'Read / execute'}
          </Badge>
        }
        description="Select one named target-pinned operation. Queue and cancel require the immutable proposer; execution is permissionless only during the exact mature grace window. No target, calldata, recipient, salt, or bytecode field is exposed."
        eyebrow="ProtocolTimelock"
        title="Typed operation workbench"
      />
      <div className="mt-6 grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
        <div className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <div>
            <FieldLabel htmlFor="typed-timelock-kind">Named operation</FieldLabel>
            <select
              className={inputClass}
              id="typed-timelock-kind"
              onChange={(event) => setKind(event.target.value as WorkbenchKind)}
              value={kind}
            >
              <optgroup label="48-hour maintenance">
                <option value="unpause-mining">Unpause mining contributions · 48h</option>
                <option value="unpause-signals">Unpause signal activations · 48h</option>
                <option value="unpause-strategy">Unpause selected auction fills · 48h</option>
                <option value="reset-reference-rate">Supersede auction reference · 48h</option>
                <option value="rotate-guardian">Rotate guardian operator · 48h</option>
                <option value="recover-registry">Recovery step 1: enable registry path · 48h</option>
                <option value="reactivate-strategy">Recovery step 2: reactivate voter · 48h</option>
                <option value="set-redemption-enabled">Set redemption-readiness metadata · 48h</option>
                <option value="unpause-liquidity-migrations">Unpause liquidity migrations · 48h</option>
              </optgroup>
              <optgroup label="7-day critical changes">
                <option value="deploy-acquisition">Deploy exact acquisition + rewards pair · 7d</option>
                <option value="register-asset">Register validated asset or stock token · 7d</option>
                <option value="migrate-liquidity">Migrate canonical liquidity positions · 7d</option>
              </optgroup>
            </select>
          </div>

          {showAuction ? (
            <div>
              <FieldLabel htmlFor="typed-auction-strategy">Auction strategy</FieldLabel>
              <select
                className={inputClass}
                id="typed-auction-strategy"
                onChange={(event) => setAuctionStrategy(event.target.value)}
                value={selectedAuction?.strategy ?? ''}
              >
                {(snapshot?.strategies ?? []).map((row) => (
                  <option key={row.strategy.toLowerCase()} value={row.strategy}>
                    {row.symbol} · strategy {formatAddress(row.strategy)} · target {formatAddress(row.token)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {kind === 'reset-reference-rate' ? (
            <div className="space-y-4">
              <div>
                <FieldLabel htmlFor="typed-expected-reference-rate">
                  Reviewed baseline target units per USDG · 18-decimal rate
                </FieldLabel>
                <Field
                  className="mt-2"
                  id="typed-expected-reference-rate"
                  inputMode="decimal"
                  onChange={(event) => setExpectedReferenceRate(event.target.value)}
                  placeholder="0.0042"
                  value={expectedReferenceRate}
                />
                <p className="mt-2 font-mono text-[0.66rem] text-[#718080]">
                  Pinned current:{' '}
                  {selectedAuction === undefined ? 'unavailable' : formatUnits(selectedAuction.referenceRate, 18)}
                </p>
              </div>
              <div>
                <FieldLabel htmlFor="typed-reference-rate">New target units per USDG · 18-decimal rate</FieldLabel>
                <Field
                  className="mt-2"
                  id="typed-reference-rate"
                  inputMode="decimal"
                  onChange={(event) => setReferenceRate(event.target.value)}
                  placeholder="0.0042"
                  value={referenceRate}
                />
              </div>
              <p className="mt-2 text-[0.66rem] leading-5 text-[#718080]">
                Queueing requires the reviewed baseline to equal the pinned current reference. Keep or re-enter that
                historical baseline after scheduling: it is part of the operation ID and must not follow later state.
                The new rate must stay above the rounded 50% floor and below the 200% ceiling capped by the strategy
                maximum. Execution starts a new auction and invalidates stale auction IDs; fills and permissionless
                restarts cannot censor a mature reset.
              </p>
            </div>
          ) : null}
          {kind === 'rotate-guardian' ? (
            <div>
              <FieldLabel htmlFor="typed-new-guardian">New guardian contract / Safe</FieldLabel>
              <Field
                className="mt-2 font-mono"
                id="typed-new-guardian"
                onChange={(event) => setNewGuardian(event.target.value)}
                placeholder="0x…"
                value={newGuardian}
              />
              <p className="mt-2 text-[0.66rem] leading-5 text-[#718080]">
                The client requires nonzero deployed code and a different address. Reviewed Safe ownership policy and a
                replacement signed runtime remain external prerequisites.
              </p>
            </div>
          ) : null}
          {showRecovery ? (
            <div>
              <FieldLabel htmlFor="typed-recovery-strategy">Recovery strategy</FieldLabel>
              <select
                className={inputClass}
                disabled={eligibleRecoveryStrategies.length === 0}
                id="typed-recovery-strategy"
                onChange={(event) => setRecoveryStrategy(event.target.value)}
                value={selectedRecovery?.strategy ?? ''}
              >
                {eligibleRecoveryStrategies.length === 0 ? (
                  <option value="">
                    {kind === 'recover-registry'
                      ? 'No registry-disabled strategy path'
                      : 'No registry-live voter-disabled strategy'}
                  </option>
                ) : null}
                {eligibleRecoveryStrategies.map((row) => (
                  <option key={row.strategy.toLowerCase()} value={row.strategy}>
                    {row.symbol} · {row.kind} · strategy {formatAddress(row.strategy)} · target{' '}
                    {formatAddress(row.token)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[0.66rem] leading-5 text-[#718080]">
                {eligibleRecoveryStrategies.length === 0
                  ? kind === 'recover-registry'
                    ? 'No registry-disabled path is eligible for recovery in the pinned snapshot.'
                    : 'No registry-live, voter-disabled path is eligible for reactivation in the pinned snapshot.'
                  : 'Execute registry enable first. Voter reactivation is a separate operation and rejects until the registry path is live; old user weights never revive.'}
              </p>
            </div>
          ) : null}
          {showAssetSelection ? (
            <div>
              <FieldLabel htmlFor="typed-redemption-asset">Registered asset</FieldLabel>
              <select
                className={inputClass}
                id="typed-redemption-asset"
                onChange={(event) => setAssetSelection(event.target.value)}
                value={selectedAsset?.token ?? ''}
              >
                {(snapshot?.assets ?? []).map((row) => (
                  <option key={row.token.toLowerCase()} value={row.token}>
                    {row.symbol} · token {formatAddress(row.token)} · strategy {formatAddress(row.strategy)}
                  </option>
                ))}
              </select>
              <label className="mt-3 flex items-center gap-2 text-xs text-[#aab6b5]" htmlFor="typed-redemption-value">
                <input
                  checked={redemptionEnabled}
                  id="typed-redemption-value"
                  onChange={(event) => setRedemptionEnabled(event.target.checked)}
                  type="checkbox"
                />
                Integration ready
              </label>
              <p className="mt-2 text-[0.66rem] leading-5 text-[#718080]">
                This is metadata, never a redemption pause. Disabling is rejected while the vault raw balance is
                nonzero.
              </p>
            </div>
          ) : null}

          {showGrowth ? (
            <>
              <div>
                <FieldLabel htmlFor="typed-asset-token">Target token</FieldLabel>
                <Field
                  className="mt-2 font-mono"
                  id="typed-asset-token"
                  onChange={(event) => setAssetToken(event.target.value)}
                  placeholder="0x…"
                  value={assetToken}
                />
              </div>
              {kind === 'deploy-acquisition' ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <FieldLabel htmlFor="typed-minimum-lot">Minimum USDG lot</FieldLabel>
                    <Field
                      id="typed-minimum-lot"
                      inputMode="decimal"
                      onChange={(event) => setMinimumLot(event.target.value)}
                      value={minimumLot}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="typed-maximum-lot">Maximum USDG lot</FieldLabel>
                    <Field
                      id="typed-maximum-lot"
                      inputMode="decimal"
                      onChange={(event) => setMaximumLot(event.target.value)}
                      value={maximumLot}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="typed-initial-rate">Initial target / USDG rate</FieldLabel>
                    <Field
                      id="typed-initial-rate"
                      inputMode="decimal"
                      onChange={(event) => setInitialReferenceRate(event.target.value)}
                      value={initialReferenceRate}
                    />
                  </div>
                  <p className="text-[0.66rem] leading-5 text-[#718080] sm:col-span-3">
                    Creation code is bundled from this exact compiler build and hash-matched to StrategyDeployer.
                    Execute this operation, validate the emitted pair, then separately queue registration—CREATE
                    addresses are never guessed.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="typed-asset-id">Asset ID / stock UID · bytes32</FieldLabel>
                      <Field
                        className="font-mono"
                        id="typed-asset-id"
                        onChange={(event) => setAssetId(event.target.value)}
                        value={assetId}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="typed-asset-symbol">Exact token symbol</FieldLabel>
                      <Field
                        id="typed-asset-symbol"
                        onChange={(event) => setAssetSymbol(event.target.value)}
                        value={assetSymbol}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="typed-asset-decimals">Token decimals</FieldLabel>
                      <Field
                        id="typed-asset-decimals"
                        inputMode="numeric"
                        onChange={(event) => setAssetDecimals(event.target.value)}
                        value={assetDecimals}
                      />
                    </div>
                    <label
                      className="flex items-center gap-2 self-end pb-3 text-xs text-[#aab6b5]"
                      htmlFor="typed-stock-asset"
                    >
                      <input
                        checked={stock}
                        id="typed-stock-asset"
                        onChange={(event) => setStock(event.target.checked)}
                        type="checkbox"
                      />
                      Robinhood stock-token beacon proxy
                    </label>
                    <div>
                      <FieldLabel htmlFor="typed-asset-strategy">Deployed AcquisitionStrategy</FieldLabel>
                      <Field
                        className="font-mono"
                        id="typed-asset-strategy"
                        onChange={(event) => setAssetStrategy(event.target.value)}
                        value={assetStrategy}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="typed-asset-rewards">Deployed ManagerRewards</FieldLabel>
                      <Field
                        className="font-mono"
                        id="typed-asset-rewards"
                        onChange={(event) => setAssetRewards(event.target.value)}
                        value={assetRewards}
                      />
                    </div>
                  </div>
                  {stock ? (
                    <div className="grid gap-4 border-t border-white/8 pt-4 sm:grid-cols-2">
                      {[
                        ['typed-token-runtime', 'Token runtime code hash', tokenRuntimeHash, setTokenRuntimeHash],
                        ['typed-stock-beacon', 'Beacon address', beacon, setBeacon],
                        ['typed-beacon-runtime', 'Beacon runtime code hash', beaconRuntimeHash, setBeaconRuntimeHash],
                        ['typed-stock-implementation', 'Implementation address', implementation, setImplementation],
                        [
                          'typed-implementation-runtime',
                          'Implementation runtime code hash',
                          implementationRuntimeHash,
                          setImplementationRuntimeHash,
                        ],
                        ['typed-ui-multiplier', 'UI multiplier', uiMultiplier, setUiMultiplier],
                      ].map(([id, label, value, setter]) => (
                        <div key={id as string}>
                          <FieldLabel htmlFor={id as string}>{label as string}</FieldLabel>
                          <Field
                            className="font-mono"
                            id={id as string}
                            onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                            value={value as string}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-[0.66rem] leading-5 text-[#718080]">
                    The client rechecks token symbol/decimals/code, exact deployer provenance, runtime hashes, and—when
                    stock—beacon implementation, UID, multiplier, pause flags, and three transfer blocklist accounts at
                    the execution block.
                  </p>
                </>
              )}
            </>
          ) : null}

          {kind === 'migrate-liquidity' ? (
            <div className="space-y-4">
              <Notice title="Canonical PoolKey is fixed">
                {snapshot === undefined
                  ? 'Unavailable'
                  : `${token0Symbol}/${token1Symbol} · fee ${snapshot.liquidity.poolKey.fee.toString()} · spacing ${snapshot.liquidity.poolKey.tickSpacing.toString()} · hook ${formatAddress(snapshot.liquidity.poolKey.hooks)}`}
              </Notice>
              <div>
                <FieldLabel htmlFor="typed-migration-deadline">
                  Execution deadline · UTC YYYY-MM-DDTHH:mm:ssZ
                </FieldLabel>
                <Field
                  id="typed-migration-deadline"
                  onChange={(event) => setMigrationDeadline(event.target.value)}
                  placeholder="2026-09-01T12:00:00Z"
                  value={migrationDeadline}
                />
              </div>
              <div className="space-y-3">
                {removals.map((row, index) => (
                  <div
                    className="grid gap-3 rounded-xl border border-white/8 p-3 sm:grid-cols-3"
                    key={`removal-${index.toString()}`}
                  >
                    {(
                      [
                        ['positionId', 'Position ID', row.positionId],
                        ['amount0Min', `${token0Symbol} minimum`, row.amount0Min],
                        ['amount1Min', `${token1Symbol} minimum`, row.amount1Min],
                      ] as const
                    ).map(([key, label, value]) => (
                      <div key={key}>
                        <FieldLabel htmlFor={`removal-${index.toString()}-${key}`}>{label}</FieldLabel>
                        <Field
                          id={`removal-${index.toString()}-${key}`}
                          onChange={(event) =>
                            setRemovals((current) =>
                              current.map((candidate, candidateIndex) =>
                                candidateIndex === index ? { ...candidate, [key]: event.target.value } : candidate,
                              ),
                            )
                          }
                          value={value}
                        />
                      </div>
                    ))}
                    {removals.length > 1 ? (
                      <Button
                        onClick={() =>
                          setRemovals((current) => current.filter((_, candidateIndex) => candidateIndex !== index))
                        }
                        size="sm"
                        variant="danger"
                      >
                        Remove row
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  disabled={removals.length >= 16}
                  onClick={() =>
                    setRemovals((current) => [...current, { positionId: '', amount0Min: '0', amount1Min: '0' }])
                  }
                  size="sm"
                  variant="secondary"
                >
                  Add removal
                </Button>
              </div>
              <div className="space-y-3 border-t border-white/8 pt-4">
                {replacements.map((row, index) => (
                  <div
                    className="grid gap-3 rounded-xl border border-white/8 p-3 sm:grid-cols-5"
                    key={`replacement-${index.toString()}`}
                  >
                    {(
                      [
                        ['tickLower', 'Lower tick', row.tickLower],
                        ['tickUpper', 'Upper tick', row.tickUpper],
                        ['liquidity', 'Exact v4 liquidity', row.liquidity],
                        ['amount0Max', `${token0Symbol} maximum`, row.amount0Max],
                        ['amount1Max', `${token1Symbol} maximum`, row.amount1Max],
                      ] as const
                    ).map(([key, label, value]) => (
                      <div key={key}>
                        <FieldLabel htmlFor={`replacement-${index.toString()}-${key}`}>{label}</FieldLabel>
                        <Field
                          id={`replacement-${index.toString()}-${key}`}
                          onChange={(event) =>
                            setReplacements((current) =>
                              current.map((candidate, candidateIndex) =>
                                candidateIndex === index ? { ...candidate, [key]: event.target.value } : candidate,
                              ),
                            )
                          }
                          value={value}
                        />
                      </div>
                    ))}
                    {replacements.length > 1 ? (
                      <Button
                        onClick={() =>
                          setReplacements((current) => current.filter((_, candidateIndex) => candidateIndex !== index))
                        }
                        size="sm"
                        variant="danger"
                      >
                        Remove row
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  disabled={replacements.length >= 16}
                  onClick={() =>
                    setReplacements((current) => [
                      ...current,
                      { tickLower: '', tickUpper: '', liquidity: '', amount0Max: '0', amount1Max: '0' },
                    ])
                  }
                  size="sm"
                  variant="secondary"
                >
                  Add replacement
                </Button>
              </div>
              <p className="text-[0.66rem] leading-5 text-[#718080]">
                Every removal must remain active and manager-owned at execution. Token limits use human units; v4
                liquidity is an exact uint128. The resulting active count cannot exceed sixteen.
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-2xl border border-white/8 bg-[#071011]/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Exact operation state</p>
            <Badge
              tone={exactState?.state === 'matured' ? 'positive' : exactState?.state === 'expired' ? 'warning' : 'info'}
            >
              {operationRead.source === 'live' ? (exactState?.state ?? 'unavailable') : operationRead.source}
            </Badge>
          </div>
          {operation === undefined ? (
            <Notice title="Complete the typed parameters" tone="warning">
              {formError ?? 'A current live snapshot is required.'}
            </Notice>
          ) : operationRead.source !== 'live' || exactState === undefined ? (
            <Notice title="Exact operation unavailable" tone="warning">
              {operationRead.encodingError?.message ??
                (operationRead.error instanceof Error
                  ? operationRead.error.message
                  : 'The operation ID and queue state are not available from a current pinned block.')}
            </Notice>
          ) : (
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="font-semibold text-[#718080]">Target</dt>
                <dd className="mt-1 break-all font-mono text-white">{exactState.target}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#718080]">Operation ID</dt>
                <dd className="mt-1 break-all font-mono text-white" data-testid="typed-operation-id">
                  {exactState.operationId}
                </dd>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-[#718080]">Enforced delay</dt>
                  <dd className="mt-1 text-white">{(exactState.delay / 86_400n).toString()} days</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#718080]">Pinned block</dt>
                  <dd className="mt-1 text-white">
                    #{exactState.blockNumber.toString()} · {exactState.blockHash.slice(0, 10)}…
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#718080]">Ready at</dt>
                  <dd className="mt-1 text-white">
                    {exactState.readyAt === 0n ? 'Not scheduled' : exactState.readyAt.toString()}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#718080]">Expires at</dt>
                  <dd className="mt-1 text-white">{exactState.expiresAt?.toString() ?? 'Not scheduled'}</dd>
                </div>
              </div>
            </dl>
          )}
          {exactState?.preconditionError !== null && exactState?.preconditionError !== undefined ? (
            <Notice title="Current precondition not met" tone="warning">
              {exactState.preconditionError}
            </Notice>
          ) : null}
          <Notice title="Non-enumerable exact calldata">
            Save the operation ID and every displayed form parameter in the reviewed change record. After reload, enter
            the exact same parameters to rediscover, cancel, or execute this operation; the timelock cannot enumerate
            historical calldata.
          </Notice>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button disabled={!canQueue} onClick={() => void submit('schedule')} variant="secondary">
              Queue exact operation
            </Button>
            <Button disabled={!canExecute} onClick={() => void submit('execute')}>
              Execute mature operation
            </Button>
            <Button disabled={!canCancel} onClick={() => void cancel()} variant="danger">
              Cancel exact operation
            </Button>
          </div>
          <p className="text-[0.66rem] leading-5 text-[#718080]">
            Queue/cancel: verified proposer. Execute: any connected account during maturity. Every submission rereads
            the full admin graph, validates the block hash, rechecks requiredDelay and operation ID, and simulates the
            exact transaction before the wallet opens.
          </p>
          <TransactionGuard
            onSwitchNetwork={() => void transaction.requestNetworkSwitch()}
            readiness={transaction.readiness}
          />
          <TransactionStatus onReset={transaction.reset} state={transaction.state} />
        </div>
      </div>
    </Card>
  );
}
