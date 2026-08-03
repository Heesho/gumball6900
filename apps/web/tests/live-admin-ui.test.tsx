import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, keccak256, zeroAddress, type Address, type Hex } from 'viem';

import { AdminActions } from '../components/protocol/admin-actions';
import { LiveAdminOperationalStatus, LiveTimelockQueue } from '../components/protocol/live-admin-status';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import type { TimelockOperation } from '../lib/admin-transactions';
import { adminStrategySymbols, knownOperationKey, type LiveAdminSnapshot } from '../lib/live-admin-snapshot';
import { basketAssetSymbols } from '../lib/live-protocol-overview';
import { strategySymbols } from '../lib/runtime-types';
import { registryTestId } from '../lib/registry-presentation';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const mocked = vi.hoisted(() => ({
  account: '0x0000000000000000000000000000000000000039',
  lastOperation: undefined as TimelockOperation | undefined,
  readiness: 'ready' as 'demo-disabled' | 'disconnected' | 'wrong-network' | 'ready',
  rhj: {} as Record<string, unknown>,
  snapshot: {} as Record<string, unknown>,
  timelockOperation: {} as Record<string, unknown>,
  submit: vi.fn(async () => null),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: mocked.account, isConnected: true }),
  usePublicClient: () => undefined,
}));

vi.mock('../hooks/use-live-admin-snapshot', () => ({
  useLiveAdminSnapshot: () => mocked.snapshot,
}));

vi.mock('../hooks/use-rhj-metadata', () => ({
  useRhjMetadata: () => mocked.rhj,
}));

vi.mock('../hooks/use-protocol-transaction', () => ({
  useProtocolTransaction: () => ({
    isBusy: false,
    readiness: mocked.readiness,
    requestNetworkSwitch: vi.fn(async () => undefined),
    reset: vi.fn(),
    state: { hash: null, label: null, message: null, phase: 'idle' },
    submit: mocked.submit,
  }),
}));

vi.mock('../hooks/use-timelock-operation', () => ({
  useTimelockOperation: (operation: TimelockOperation | undefined) => {
    mocked.lastOperation = operation;
    return mocked.timelockOperation;
  },
}));

function snapshotData(): LiveAdminSnapshot {
  const bootstrapTargets = basketAssetSymbols.slice(1).map((symbol) => liveRuntimeFixture.assets[symbol]);
  const bootstrapTargetsHash = keccak256(encodeAbiParameters([{ type: 'address[]' }], [bootstrapTargets]));
  const knownOperations: readonly { label: string; operation: TimelockOperation }[] = [
    { label: 'Reopen mining contributions', operation: { kind: 'unpause-mining' } },
    { label: 'Resume signal activations', operation: { kind: 'unpause-signals' } },
    ...adminStrategySymbols.map((symbol) => ({
      label: `Reopen ${symbol} strategy fills`,
      operation: { kind: 'unpause-strategy', strategy: liveRuntimeFixture.strategies[symbol] } as const,
    })),
  ];
  return {
    assets: basketAssetSymbols.map((symbol, registryIndex) => ({
      acquisitionEnabled: true,
      assetId: `0x${'11'.repeat(32)}` as Hex,
      decimals: liveRuntimeFixture.assetMetadata[symbol].decimals,
      genesisSymbol: symbol,
      isStockToken: liveRuntimeFixture.assetMetadata[symbol].registryStatus === 'ASSET_STATUS_ACTIVE',
      redemptionEnabled: true,
      rewards: symbol === 'USDG' ? fixtureAddress(0) : liveRuntimeFixture.rewards[symbol],
      registryIndex,
      strategy: liveRuntimeFixture.strategies[symbol],
      symbol,
      symbolHash: `0x${'22'.repeat(32)}` as Hex,
      token: liveRuntimeFixture.assets[symbol],
      vaultBalance: 1n,
    })),
    blockHash: `0x${'aa'.repeat(32)}`,
    blockNumber: 777n,
    blockTimestamp: 200_000n,
    guardian: {
      allocationVoter: liveRuntimeFixture.addresses.allocationVoter,
      assetRegistry: liveRuntimeFixture.addresses.assetRegistry,
      operator: liveRuntimeFixture.admin.guardianOperator,
      operatorMatchesManifest: true,
      targetsInitialized: true,
    },
    mining: {
      contributionsPaused: false,
      currentEpochId: 7n,
      currentEpochInvalidated: false,
      currentEpochSettled: false,
    },
    liquidity: {
      activePositionCount: 4n,
      migrationsPaused: false,
      poolKey: {
        currency0:
          BigInt(liveRuntimeFixture.addresses.gbx) < BigInt(liveRuntimeFixture.assets.USDG)
            ? liveRuntimeFixture.addresses.gbx
            : liveRuntimeFixture.assets.USDG,
        currency1:
          BigInt(liveRuntimeFixture.addresses.gbx) < BigInt(liveRuntimeFixture.assets.USDG)
            ? liveRuntimeFixture.assets.USDG
            : liveRuntimeFixture.addresses.gbx,
        fee: 3_000,
        hooks: liveRuntimeFixture.addresses.launchGuardHook,
        tickSpacing: 60,
      },
    },
    operations: knownOperations.map(({ label, operation }, index) => {
      return {
        delay: 172_800n,
        expiresAt: null,
        key: knownOperationKey(operation),
        label,
        operation,
        operationId: `0x${(index + 1).toString(16).padStart(64, '0')}` as Hex,
        readyAt: 0n,
        state: 'unscheduled' as const,
        target: fixtureAddress(100 + index),
      };
    }),
    strategyDeployer: {
      acquisitionStrategyCreationCodeHash: `0x${'91'.repeat(32)}`,
      acquisitionStrategyCreationCodeLength: 1n,
      address: fixtureAddress(60),
      bootstrapAcquisitionTargetCount: BigInt(bootstrapTargets.length),
      bootstrapAcquisitionTargetsHash: bootstrapTargetsHash,
      dependenciesConfigured: true,
      expectedBootstrapAcquisitionTargetCount: BigInt(bootstrapTargets.length),
      expectedBootstrapAcquisitionTargetsHash: bootstrapTargetsHash,
      managerRewardsCreationCodeHash: `0x${'92'.repeat(32)}`,
      managerRewardsCreationCodeLength: 1n,
      strategyBootstrapFinalized: true,
      usdG: liveRuntimeFixture.assets.USDG,
    },
    strategyRegistry: strategySymbols.map((symbol, registryIndex) => ({
      activeWeight: 1n,
      genesisSymbol: symbol,
      kind:
        symbol === 'USDG'
          ? ('hold-usdg' as const)
          : symbol === 'BURN'
            ? ('buyback' as const)
            : ('acquisition' as const),
      live: true,
      registryIndex,
      strategy: liveRuntimeFixture.strategies[symbol],
      symbol,
      token: symbol === 'BURN' ? zeroAddress : liveRuntimeFixture.assets[symbol],
      virtualUSDGBudget: 1n,
      voterDisabled: false,
    })),
    strategies: adminStrategySymbols.map((symbol, registryIndex) => ({
      auctionDuration: 86_400n,
      auctionId: 9n,
      auctionStartTime: 190_000n,
      currentRate: 5n * 10n ** 18n,
      expired: false,
      fillsPaused: false,
      floorRate: 4n * 10n ** 18n,
      kind: symbol === 'BURN' ? ('buyback' as const) : ('acquisition' as const),
      referenceRate: 5n * 10n ** 18n,
      registryIndex: registryIndex + 1,
      registryLive: true,
      startRate: 6n * 10n ** 18n,
      strategy: liveRuntimeFixture.strategies[symbol],
      symbol,
      token: symbol === 'BURN' ? zeroAddress : liveRuntimeFixture.assets[symbol],
      voterDisabled: false,
    })),
    timelock: {
      boundedMaintenanceDelay: 172_800n,
      criticalChangeDelay: 604_800n,
      executionGracePeriod: 2_592_000n,
      proposer: liveRuntimeFixture.admin.protocolTimelockProposer,
      strategyBootstrapFinalized: true,
      strategyDeployer: fixtureAddress(60),
      targetsInitialized: true,
    },
    voter: { signalActivationsPaused: false },
  };
}

function setSnapshot(data: LiveAdminSnapshot = snapshotData(), source = 'live') {
  mocked.snapshot = {
    data,
    error: source === 'live-stale' ? new Error('refresh failed') : null,
    isFetching: false,
    refetch: vi.fn(async () => undefined),
    source,
  };
}

function renderLive(children: React.ReactNode) {
  return render(<RuntimeDeploymentProvider runtime={liveRuntimeFixture}>{children}</RuntimeDeploymentProvider>);
}

describe('live admin UI', () => {
  beforeEach(() => {
    mocked.account = liveRuntimeFixture.admin.guardianOperator;
    mocked.rhj = { data: undefined, isFetching: false, refetch: vi.fn(), source: 'unsupported' };
    mocked.submit.mockClear();
    mocked.readiness = 'ready';
    mocked.lastOperation = undefined;
    mocked.timelockOperation = {
      data: {
        blockHash: `0x${'aa'.repeat(32)}`,
        blockNumber: 777n,
        blockTimestamp: 200_000n,
        delay: 172_800n,
        expiresAt: null,
        operationId: `0x${'77'.repeat(32)}`,
        preconditionError: null,
        readyAt: 0n,
        state: 'unscheduled',
        target: liveRuntimeFixture.addresses.miningPool,
      },
      encodingError: null,
      error: null,
      isFetching: false,
      operationId: `0x${'77'.repeat(32)}`,
      refetch: vi.fn(async () => undefined),
      source: 'live',
    };
    setSnapshot();
  });

  it('shows only current, role-gated guardian controls and disables every write on stale state', () => {
    const view = renderLive(<AdminActions />);
    expect(screen.getByRole('button', { name: 'Pause mining contributions' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Pause signal activations' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Queue exact operation' }).hasAttribute('disabled')).toBe(true);

    view.unmount();
    setSnapshot(snapshotData(), 'live-stale');
    renderLive(<AdminActions />);
    expect(screen.getByText('Admin writes disabled')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Pause mining contributions' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Execute mature operation' }).hasAttribute('disabled')).toBe(true);
  });

  it('offers queueing to the verified proposer only when the underlying control is paused', () => {
    mocked.account = liveRuntimeFixture.admin.protocolTimelockProposer;
    const base = snapshotData();
    const data = { ...base, mining: { ...base.mining, contributionsPaused: true } };
    setSnapshot(data);
    renderLive(<AdminActions />);
    expect(within(screen.getByTestId('typed-timelock-workbench')).getByText('Proposer', { exact: true })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Queue exact operation' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Execute mature operation' }).hasAttribute('disabled')).toBe(true);
  });

  it('disables every guardian and timelock write when wallet readiness is not ready', () => {
    mocked.readiness = 'wrong-network';
    const guardianView = renderLive(<AdminActions />);

    for (const name of [
      'Pause mining contributions',
      'Invalidate current epoch',
      'Pause signal activations',
      'Pause selected strategy fills',
      'Disable selected strategy path',
      'Pause liquidity migrations',
    ]) {
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }

    guardianView.unmount();
    mocked.account = liveRuntimeFixture.admin.protocolTimelockProposer;
    const base = snapshotData();
    setSnapshot({ ...base, mining: { ...base.mining, contributionsPaused: true } });
    const queueView = renderLive(<AdminActions />);
    expect(screen.getByRole('button', { name: 'Queue exact operation' }).hasAttribute('disabled')).toBe(true);

    queueView.unmount();
    mocked.timelockOperation = {
      ...mocked.timelockOperation,
      data: {
        ...(mocked.timelockOperation.data as Record<string, unknown>),
        expiresAt: 2_500_000n,
        readyAt: 2_000_000n,
        state: 'pending',
      },
    };
    const cancelView = renderLive(<AdminActions />);
    expect(screen.getByRole('button', { name: 'Cancel exact operation' }).hasAttribute('disabled')).toBe(true);

    cancelView.unmount();
    mocked.timelockOperation = {
      ...mocked.timelockOperation,
      data: {
        ...(mocked.timelockOperation.data as Record<string, unknown>),
        readyAt: 199_000n,
        state: 'matured',
      },
    };
    renderLive(<AdminActions />);
    expect(screen.getByRole('button', { name: 'Execute mature operation' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows only state-eligible strategies for each ordered recovery step and an explicit empty state', async () => {
    const user = userEvent.setup();
    const base = snapshotData();
    setSnapshot({
      ...base,
      strategyRegistry: [
        { ...base.strategyRegistry[0]!, live: false, voterDisabled: true },
        { ...base.strategyRegistry[1]!, live: false, voterDisabled: true },
        { ...base.strategyRegistry[2]!, live: true, voterDisabled: true },
        ...base.strategyRegistry.slice(3),
      ],
    });
    const view = renderLive(<AdminActions />);
    await user.selectOptions(screen.getByLabelText('Named operation'), 'recover-registry');

    let labels = Array.from((screen.getByLabelText('Recovery strategy') as HTMLSelectElement).options).map(
      (option) => option.textContent ?? '',
    );
    expect(labels.some((label) => label.startsWith('USDG · hold-usdg'))).toBe(true);
    expect(labels.some((label) => label.startsWith('WETH · acquisition'))).toBe(true);
    expect(labels.some((label) => label.startsWith('WBTC · acquisition'))).toBe(false);

    await user.selectOptions(screen.getByLabelText('Named operation'), 'reactivate-strategy');
    labels = Array.from((screen.getByLabelText('Recovery strategy') as HTMLSelectElement).options).map(
      (option) => option.textContent ?? '',
    );
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatch(/^WBTC · acquisition/u);

    view.unmount();
    setSnapshot(base);
    renderLive(<AdminActions />);
    await user.selectOptions(screen.getByLabelText('Named operation'), 'recover-registry');
    expect(screen.getByRole('option', { name: 'No registry-disabled strategy path' })).toBeDefined();
    expect(
      screen.getByText('No registry-disabled path is eligible for recovery in the pinned snapshot.'),
    ).toBeDefined();
  });

  it('shows exact operational rows, active known queue state, and no unsupported issuer inference', () => {
    const base = snapshotData();
    const data = {
      ...base,
      operations: base.operations.map((operation, index) =>
        index === 0 ? { ...operation, expiresAt: 2_792_000n, readyAt: 199_900n, state: 'matured' as const } : operation,
      ),
    };
    setSnapshot(data);
    renderLive(
      <>
        <LiveAdminOperationalStatus />
        <LiveTimelockQueue />
      </>,
    );
    expect(screen.getAllByTestId(/^live-admin-strategy-/u)).toHaveLength(8);
    expect(screen.getByTestId('live-timelock-operation-unpause-mining')).toBeDefined();
    expect(screen.getByText('Historical queue events are not indexed')).toBeDefined();
    expect(screen.getByText('Issuer status not asserted on testnet')).toBeDefined();
    expect(screen.queryByText(/Preview enabled/iu)).toBeNull();
  });

  it('renders a newly registered acquisition strategy as a typed guardian and timelock target', () => {
    const base = snapshotData();
    const token = fixtureAddress(900);
    const strategy = fixtureAddress(901);
    const operation = { kind: 'unpause-strategy', strategy } as const;
    setSnapshot({
      ...base,
      assets: [
        ...base.assets,
        {
          acquisitionEnabled: true,
          assetId: `0x${'33'.repeat(32)}`,
          decimals: 18,
          genesisSymbol: null,
          isStockToken: false,
          redemptionEnabled: true,
          rewards: fixtureAddress(902),
          registryIndex: 8,
          strategy,
          symbol: 'LINK',
          symbolHash: `0x${'44'.repeat(32)}`,
          token,
          vaultBalance: 1n,
        },
      ],
      operations: [
        ...base.operations,
        {
          delay: 172_800n,
          expiresAt: null,
          key: knownOperationKey(operation),
          label: 'Reopen LINK strategy fills',
          operation,
          operationId: `0x${'55'.repeat(32)}`,
          readyAt: 0n,
          state: 'unscheduled',
          target: strategy,
        },
      ],
      strategies: [
        ...base.strategies,
        {
          auctionDuration: 86_400n,
          auctionId: 10n,
          auctionStartTime: 190_000n,
          currentRate: 5n * 10n ** 18n,
          expired: false,
          fillsPaused: false,
          floorRate: 4n * 10n ** 18n,
          kind: 'acquisition',
          referenceRate: 5n * 10n ** 18n,
          registryIndex: 9,
          registryLive: true,
          startRate: 6n * 10n ** 18n,
          strategy,
          symbol: 'LINK',
          token,
          voterDisabled: false,
        },
      ],
    });
    renderLive(
      <>
        <AdminActions />
        <LiveAdminOperationalStatus />
      </>,
    );

    expect(screen.getByRole('option', { name: /^LINK · strategy/u })).toBeDefined();
    expect(screen.getAllByTestId(/^live-admin-strategy-/u)).toHaveLength(9);
    expect(screen.getByTestId(registryTestId('live-admin-strategy', strategy))).toBeDefined();
  });

  it('keys duplicate-symbol RHJ alerts by registered token address', () => {
    const firstAddress = liveRuntimeFixture.assets.AAPL;
    const secondAddress = fixtureAddress(999);
    const alert = (address: Address) => ({
      address,
      corporateActions: [],
      isTradingHalt: true,
      pendingMultiplier: null,
      registryStatus: 'ASSET_STATUS_ACTIVE',
      symbol: 'AAPL',
      warnings: ['Robinhood reports an active trading halt.'],
    });
    mocked.rhj = {
      data: { assets: [alert(firstAddress), alert(secondAddress)] },
      isFetching: false,
      refetch: vi.fn(),
      source: 'live',
    };
    renderLive(<LiveAdminOperationalStatus />);

    expect(screen.getByTestId(registryTestId('admin-rhj-alert', firstAddress))).toBeDefined();
    expect(screen.getByTestId(registryTestId('admin-rhj-alert', secondAddress))).toBeDefined();
    expect(screen.getAllByText(/AAPL ·/u)).toHaveLength(2);
  });

  it('fails closed instead of rendering a partial status table', () => {
    mocked.snapshot = {
      data: undefined,
      error: new Error('RPC failed'),
      isFetching: false,
      refetch: vi.fn(),
      source: 'rpc-fallback',
    };
    renderLive(
      <>
        <AdminActions />
        <LiveAdminOperationalStatus />
        <LiveTimelockQueue />
      </>,
    );
    expect(screen.getAllByText('Admin snapshot unavailable')).toHaveLength(2);
    expect(screen.queryByTestId(/^live-admin-strategy-/u)).toBeNull();
    expect(screen.getByRole('button', { name: 'Pause mining contributions' }).hasAttribute('disabled')).toBe(true);
  });

  it('builds a hard-bounded auction-superseding rate reset from human units', async () => {
    const user = userEvent.setup();
    const view = renderLive(<AdminActions />);
    await user.selectOptions(screen.getByLabelText('Named operation'), 'reset-reference-rate');
    const baseline = screen.getByLabelText(
      'Reviewed baseline target units per USDG · 18-decimal rate',
    ) as HTMLInputElement;
    expect(baseline.value).toBe('5');
    await user.clear(baseline);
    await user.type(baseline, '4.75');
    const refreshed = snapshotData();
    setSnapshot({
      ...refreshed,
      strategies: [{ ...refreshed.strategies[0]!, referenceRate: 6n * 10n ** 18n }, ...refreshed.strategies.slice(1)],
    });
    view.rerender(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <AdminActions />
      </RuntimeDeploymentProvider>,
    );
    expect(baseline.value).toBe('4.75');
    await user.type(screen.getByLabelText('New target units per USDG · 18-decimal rate'), '2.5');

    expect(mocked.lastOperation).toEqual({
      kind: 'reset-reference-rate',
      expectedReferenceRate: 4_750_000_000_000_000_000n,
      newReferenceRate: 2_500_000_000_000_000_000n,
      strategy: liveRuntimeFixture.strategies.WETH,
    });
    expect(screen.getByText(/rounded 50% floor and below the 200% ceiling/u)).toBeDefined();
  });

  it('exposes ordered HoldUSDG recovery and permissionless mature execution', async () => {
    const base = snapshotData();
    setSnapshot({
      ...base,
      assets: [{ ...base.assets[0]!, acquisitionEnabled: false }, ...base.assets.slice(1)],
      strategyRegistry: [
        { ...base.strategyRegistry[0]!, live: false, voterDisabled: true },
        ...base.strategyRegistry.slice(1),
      ],
    });
    mocked.account = fixtureAddress(999);
    mocked.timelockOperation = {
      ...mocked.timelockOperation,
      data: {
        ...(mocked.timelockOperation.data as Record<string, unknown>),
        expiresAt: 2_500_000n,
        preconditionError: null,
        readyAt: 199_000n,
        state: 'matured',
      },
      source: 'live',
    };
    const user = userEvent.setup();
    renderLive(<AdminActions />);
    await user.selectOptions(screen.getByLabelText('Named operation'), 'recover-registry');

    expect(screen.getByRole('option', { name: /USDG · hold-usdg · strategy/u })).toBeDefined();
    expect(mocked.lastOperation).toEqual({ kind: 'enable-acquisition', token: liveRuntimeFixture.assets.USDG });
    expect(screen.getByRole('button', { name: 'Queue exact operation' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Execute mature operation' }).hasAttribute('disabled')).toBe(false);
  });

  it('distinguishes duplicate symbols by both strategy and token identity', () => {
    const base = snapshotData();
    const duplicateStrategy = fixtureAddress(990);
    const duplicateToken = fixtureAddress(991);
    setSnapshot({
      ...base,
      strategies: [
        ...base.strategies,
        {
          ...base.strategies[0]!,
          registryIndex: 50,
          strategy: duplicateStrategy,
          symbol: base.strategies[0]!.symbol,
          token: duplicateToken,
        },
      ],
    });
    renderLive(<AdminActions />);
    const labels = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(labels).toContain(
      `WETH · strategy ${duplicateStrategy.slice(0, 6)}…${duplicateStrategy.slice(-4)} · target ${duplicateToken.slice(0, 6)}…${duplicateToken.slice(-4)}`,
    );
  });
});
