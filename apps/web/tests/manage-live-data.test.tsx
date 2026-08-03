import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildCancelPendingSignals, buildCheckpointUser, buildManagerRewardTerminalDustSweep } from '@gumball-6900/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ManageAccountStats,
  ManageStrategyStatePanels,
  RewardClaimsPanel,
  SignalTransactionPanel,
  StakeTransactionPanel,
} from '../components/protocol/manage-actions';
import { DemoReadModelOnly } from '../components/protocol/demo-read-model-only';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { registryPresentation, registryTestId } from '../lib/registry-presentation';
import { liveRewardEntries, liveStrategyEntries, rewardSymbols, strategySymbols } from '../lib/runtime-types';
import { liveRuntimeFixture } from './live-runtime-fixture';

const mocked = vi.hoisted(() => ({
  account: '0x9999999999999999999999999999999999999999',
  accountUnavailable: false,
  activationTime: 1_100n,
  blockNumber: 777n,
  includeDynamic: false,
  inactiveSymbol: null as string | null,
  pendingUSDG: 0n,
  refetch: vi.fn(async (): Promise<void> => undefined),
  rewardReceiver: '0x9999999999999999999999999999999999999999',
  signalScale: 1n,
  submit: vi.fn(async (): Promise<`0x${string}` | null> => null),
  terminalDustError: false,
  terminalDustFetching: false,
  terminalDustRefetch: vi.fn(async (): Promise<void> => undefined),
  terminalDustRows: [] as Array<{
    amountRaw: bigint;
    generation: bigint;
    managerRewards: `0x${string}`;
    queuedBlockNumber: bigint;
    remainderCycle: bigint;
    rewardToken: `0x${string}`;
    rewardTokenDecimals: number;
    strategy: `0x${string}`;
    symbol: string;
  }>,
  totalPendingWeth: 0n,
}));

const DEFAULT_ACCOUNT = '0x9999999999999999999999999999999999999999';
const ALTERNATE_ACCOUNT = '0x8888888888888888888888888888888888888888';
const EXTRA_TOKEN = '0x0000000000000000000000000000000000000384';
const EXTRA_STRATEGY = '0x0000000000000000000000000000000000000385';
const EXTRA_REWARDS = '0x0000000000000000000000000000000000000386';
const SECOND_EXTRA_TOKEN = '0x0000000000000000000000000000000000000387';
const SECOND_EXTRA_STRATEGY = '0x0000000000000000000000000000000000000388';
const TOKEN_UNIT = 10n ** 18n;

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: mocked.account,
    isConnected: true,
  }),
}));

vi.mock('../hooks/use-protocol-reads', async () => {
  const { liveRuntimeFixture: runtime } = await import('./live-runtime-fixture');
  const { rewardSymbols: rewards, strategySymbols: strategies } = await import('../lib/runtime-types');
  return {
    useAllowance: () => ({ isPending: false, needsApproval: false, refetch: mocked.refetch }),
    useLiveManageAccountState: () => ({
      data: mocked.accountUnavailable
        ? undefined
        : {
            activationTime: mocked.pendingUSDG === 0n ? 0n : mocked.activationTime,
            activationsPaused: false,
            beneficiary: mocked.account,
            blockNumber: mocked.blockNumber,
            blockTimestamp: 1_000n,
            gbxBalance: 5_000n * 10n ** 18n,
            rewards: [
              ...rewards.map((symbol, index) => ({
                earnedRaw: BigInt(index + 101) * 10n ** BigInt(runtime.assetMetadata[symbol].decimals),
                managerRewards: runtime.rewards[symbol],
                receiver: mocked.rewardReceiver,
                rewardToken: runtime.assets[symbol],
                rewardTokenDecimals: runtime.assetMetadata[symbol].decimals,
                strategy: runtime.strategies[symbol],
                symbol,
                totalPendingTerminalDust: symbol === 'WETH' ? mocked.totalPendingWeth : 0n,
              })),
              ...(mocked.includeDynamic
                ? [
                    {
                      earnedRaw: 108n * TOKEN_UNIT,
                      managerRewards: EXTRA_REWARDS,
                      receiver: mocked.rewardReceiver,
                      rewardToken: '0x0000000000000000000000000000000000000384',
                      rewardTokenDecimals: 18,
                      strategy: '0x0000000000000000000000000000000000000385',
                      symbol: 'LINK',
                      totalPendingTerminalDust: 0n,
                    },
                  ]
                : []),
            ],
            signals: [
              ...strategies.map((symbol, index) => ({
                activeWeight: BigInt(index + 1) * mocked.signalScale * TOKEN_UNIT,
                pendingIncrease: symbol === 'USDG' ? mocked.pendingUSDG : 0n,
                strategy: runtime.strategies[symbol],
                symbol,
              })),
              ...(mocked.includeDynamic
                ? [
                    {
                      activeWeight: 10n * mocked.signalScale * TOKEN_UNIT,
                      pendingIncrease: 0n,
                      strategy: '0x0000000000000000000000000000000000000385',
                      symbol: 'LINK',
                    },
                    {
                      activeWeight: 11n * mocked.signalScale * TOKEN_UNIT,
                      pendingIncrease: 0n,
                      strategy: SECOND_EXTRA_STRATEGY,
                      symbol: 'LINK',
                    },
                  ]
                : []),
            ],
            stakedBalance: 100n * TOKEN_UNIT,
          },
      isError: false,
      isFetching: false,
      refetch: mocked.refetch,
    }),
    useLiveManagerRewardTerminalDust: () => ({
      data: mocked.terminalDustError
        ? undefined
        : {
            indexedBlock: 776n,
            indexedBlockHash: `0x${'7'.repeat(64)}`,
            rows: mocked.terminalDustRows,
          },
      isError: mocked.terminalDustError,
      isFetching: mocked.terminalDustFetching,
      refetch: mocked.terminalDustRefetch,
    }),
    useLiveStrategyState: () => ({
      data: {
        blockNumber: 777n,
        rows: [
          ...strategies.map((symbol, index) => ({
            activeWeight: BigInt(index + 1) * 10n ** 18n,
            disabled: false,
            kind:
              symbol === 'USDG'
                ? ('hold-usdg' as const)
                : symbol === 'BURN'
                  ? ('buyback' as const)
                  : ('acquisition' as const),
            live: mocked.inactiveSymbol !== symbol,
            strategy: runtime.strategies[symbol],
            symbol,
            token: symbol === 'BURN' ? runtime.assets.GBX : runtime.assets[symbol],
            virtualUSDGBudget: BigInt(index + 1) * 1_000_000n,
          })),
          ...(mocked.includeDynamic
            ? [
                {
                  activeWeight: 10n * TOKEN_UNIT,
                  disabled: false,
                  kind: 'acquisition' as const,
                  live: true,
                  strategy: '0x0000000000000000000000000000000000000385',
                  symbol: 'LINK',
                  token: EXTRA_TOKEN,
                  virtualUSDGBudget: 10_000_000n,
                },
                {
                  activeWeight: 11n * TOKEN_UNIT,
                  disabled: false,
                  kind: 'acquisition' as const,
                  live: true,
                  strategy: SECOND_EXTRA_STRATEGY,
                  symbol: 'LINK',
                  token: SECOND_EXTRA_TOKEN,
                  virtualUSDGBudget: 11_000_000n,
                },
              ]
            : []),
        ],
      },
      isError: false,
      refetch: mocked.refetch,
    }),
  };
});

vi.mock('../hooks/use-protocol-transaction', () => ({
  useProtocolTransaction: () => ({
    isBusy: false,
    readiness: 'ready',
    requestNetworkSwitch: vi.fn(async () => undefined),
    reset: vi.fn(),
    state: { hash: null, label: null, message: null, phase: 'idle' },
    submit: mocked.submit,
  }),
}));

vi.mock('../hooks/use-protocol-activity', () => ({
  useProtocolActivity: () => ({
    data: { events: [], hasNextPage: false, indexedBlock: 777n, page: 0, pageSize: 8 },
    isFetching: false,
    refetch: vi.fn(async () => undefined),
    source: 'live',
  }),
}));

vi.mock('../hooks/use-live-protocol-overview', () => ({
  useLiveProtocolOverview: () => ({
    data: undefined,
    error: null,
    isFetching: false,
    refetch: vi.fn(async () => undefined),
    source: 'rpc-fallback',
  }),
}));

describe('manifest-complete live Manage data', () => {
  beforeEach(() => {
    mocked.account = DEFAULT_ACCOUNT;
    mocked.accountUnavailable = false;
    mocked.activationTime = 1_100n;
    mocked.blockNumber = 777n;
    mocked.inactiveSymbol = null;
    mocked.includeDynamic = false;
    mocked.pendingUSDG = 0n;
    mocked.rewardReceiver = DEFAULT_ACCOUNT;
    mocked.signalScale = 1n;
    mocked.refetch.mockReset();
    mocked.refetch.mockResolvedValue(undefined);
    mocked.submit.mockReset();
    mocked.submit.mockResolvedValue(null);
    mocked.terminalDustError = false;
    mocked.terminalDustFetching = false;
    mocked.terminalDustRefetch.mockReset();
    mocked.terminalDustRefetch.mockResolvedValue(undefined);
    mocked.terminalDustRows = [];
    mocked.totalPendingWeth = 0n;
  });

  it('enumerates every strategy and manager reward address from the validated runtime', () => {
    expect(liveStrategyEntries(liveRuntimeFixture)).toEqual(
      strategySymbols.map((symbol) => ({ address: liveRuntimeFixture.strategies[symbol], symbol })),
    );
    expect(liveRewardEntries(liveRuntimeFixture)).toEqual(
      rewardSymbols.map((symbol) => ({ address: liveRuntimeFixture.rewards[symbol], symbol })),
    );
  });

  it('renders all live strategy and reward rows without demo reward amounts', () => {
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
        <RewardClaimsPanel />
        <ManageStrategyStatePanels />
      </RuntimeDeploymentProvider>,
    );

    for (const symbol of strategySymbols) {
      expect(screen.getByTestId(registryTestId('strategy-row', liveRuntimeFixture.strategies[symbol]))).toBeDefined();
      expect(
        screen.getByTestId(registryTestId('global-strategy-row', liveRuntimeFixture.strategies[symbol])),
      ).toBeDefined();
    }
    for (const symbol of rewardSymbols) {
      expect(screen.getByTestId(registryTestId('reward-row', liveRuntimeFixture.assets[symbol]))).toBeDefined();
    }
    expect(screen.queryByText(/0\.1942 WETH/iu)).toBeNull();
    expect(screen.queryByText(/3\.82 QQQ/iu)).toBeNull();
    expect(screen.queryByText(/9\.41 NVDA/iu)).toBeNull();
    expect(screen.queryByText('Acquisition settlement preview')).toBeNull();
    expect(screen.getByText('Recent strategy fills')).toBeDefined();
    expect(screen.getByText('No indexed acquisition fills')).toBeDefined();
  });

  it('renders an appended registry strategy and reward contract using address-bound identities', () => {
    mocked.includeDynamic = true;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
        <RewardClaimsPanel />
        <ManageStrategyStatePanels />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByTestId(registryTestId('strategy-row', EXTRA_STRATEGY))).toBeDefined();
    expect(screen.getByTestId(registryTestId('strategy-row', SECOND_EXTRA_STRATEGY))).toBeDefined();
    expect(screen.getByTestId(registryTestId('global-strategy-row', EXTRA_STRATEGY))).toBeDefined();
    expect(screen.getByTestId(registryTestId('reward-row', EXTRA_TOKEN))).toBeDefined();
    expect(screen.getAllByText('LINK').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(new RegExp(EXTRA_STRATEGY, 'iu'))).toBeDefined();
    expect(screen.getByLabelText(new RegExp(SECOND_EXTRA_STRATEGY, 'iu'))).toBeDefined();
    expect(screen.getByTestId(registryTestId('strategy-identity', EXTRA_STRATEGY)).textContent).toContain(
      '0x000000…000385',
    );
    expect(screen.getByTestId(registryTestId('strategy-identity', SECOND_EXTRA_STRATEGY)).textContent).toContain(
      '0x000000…000388',
    );
    expect(registryPresentation('USDG', EXTRA_STRATEGY, 'acquisition').label).toBe('Accumulate USDG');
  });

  it('hydrates the draft from active plus pending weights and excludes both from unallocated sGBX', async () => {
    mocked.pendingUSDG = 9n * TOKEN_UNIT;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <ManageAccountStats />
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    await waitFor(() =>
      expect((screen.getByLabelText(/^Draft USDG signal weight/u) as HTMLInputElement).value).toBe('1000'),
    );
    expect(screen.getByTestId(registryTestId('active-weight', liveRuntimeFixture.strategies.USDG)).textContent).toBe(
      'Onchain active 1%',
    );
    expect(screen.getByTestId(registryTestId('pending-weight', liveRuntimeFixture.strategies.USDG)).textContent).toBe(
      'Pending increase 9%',
    );
    expect(screen.getByTestId(registryTestId('draft-weight', liveRuntimeFixture.strategies.USDG)).textContent).toBe(
      'Draft 10%',
    );
    expect(screen.getByText('46 sGBX')).toBeDefined();
  });

  it('cancels pending increases without encoding a destructive active-signal reset', async () => {
    mocked.pendingUSDG = 9n * TOKEN_UNIT;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    const cancel = screen.getByRole('button', { name: 'Cancel pending changes' });
    expect(cancel.hasAttribute('disabled')).toBe(false);
    fireEvent.click(cancel);

    await waitFor(() =>
      expect(mocked.submit).toHaveBeenCalledWith(
        buildCancelPendingSignals(liveRuntimeFixture.addresses.allocationVoter),
        'Cancel pending signal changes',
      ),
    );
  });

  it('preserves a new signal draft while confirmed cancellation state is still refreshing', async () => {
    mocked.pendingUSDG = 9n * TOKEN_UNIT;
    mocked.submit.mockResolvedValueOnce('0x1111111111111111111111111111111111111111111111111111111111111111');
    let releaseRefetch!: () => void;
    const refetchGate = new Promise<void>((resolve) => {
      releaseRefetch = resolve;
    });
    mocked.refetch.mockImplementation(() => refetchGate);
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel pending changes' }));
    await waitFor(() => expect(mocked.refetch).toHaveBeenCalledTimes(2));

    const nextDraft = {
      AAPL: '0',
      BURN: '1000',
      NVDA: '2500',
      QQQ: '0',
      SPCX: '0',
      TSLA: '0',
      USDG: '5500',
      WBTC: '0',
      WETH: '1000',
    } as const;
    for (const [symbol, value] of Object.entries(nextDraft)) {
      fireEvent.change(screen.getByLabelText(new RegExp(`^Draft ${symbol} signal weight`, 'u')), {
        target: { value },
      });
    }
    expect(screen.getByRole('button', { name: 'Simulate signal update' }).hasAttribute('disabled')).toBe(false);

    await act(async () => {
      releaseRefetch();
      await refetchGate;
    });

    for (const [symbol, value] of Object.entries(nextDraft)) {
      expect((screen.getByLabelText(new RegExp(`^Draft ${symbol} signal weight`, 'u')) as HTMLInputElement).value).toBe(
        value,
      );
    }
    expect(screen.getByRole('button', { name: 'Simulate signal update' }).hasAttribute('disabled')).toBe(false);
  });

  it('disables pending-signal cancellation when there is no pending activation', () => {
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByRole('button', { name: 'Cancel pending changes' }).hasAttribute('disabled')).toBe(true);
  });

  it('permissionlessly activates a matured pending signal through the connected account view', async () => {
    mocked.pendingUSDG = 9n * TOKEN_UNIT;
    mocked.activationTime = 900n;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    const activate = screen.getByRole('button', { name: 'Activate matured changes' });
    expect(activate.hasAttribute('disabled')).toBe(false);
    fireEvent.click(activate);

    await waitFor(() =>
      expect(mocked.submit).toHaveBeenCalledWith(
        buildCheckpointUser(liveRuntimeFixture.addresses.allocationVoter, DEFAULT_ACCOUNT),
        'Activate matured signal changes',
      ),
    );
  });

  it('does not activate a pending signal before its 24-hour timestamp', () => {
    mocked.pendingUSDG = 9n * TOKEN_UNIT;
    mocked.activationTime = 1_100n;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByRole('button', { name: 'Activate matured changes' }).hasAttribute('disabled')).toBe(true);
  });

  it("discards the prior wallet's edited draft and rehydrates when the connected wallet changes", async () => {
    const view = render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );
    const slider = () => screen.getByLabelText(/^Draft USDG signal weight/u) as HTMLInputElement;
    await waitFor(() => expect(slider().value).toBe('100'));
    fireEvent.change(slider(), { target: { value: '1234' } });
    expect(slider().value).toBe('1234');

    mocked.account = ALTERNATE_ACCOUNT;
    mocked.blockNumber = 778n;
    mocked.signalScale = 2n;
    view.rerender(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    await waitFor(() => expect(slider().value).toBe('200'));
  });

  it('preserves a locally edited draft when the same wallet snapshot refreshes', async () => {
    const view = render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );
    const slider = () => screen.getByLabelText(/^Draft USDG signal weight/u) as HTMLInputElement;
    await waitFor(() => expect(slider().value).toBe('100'));
    fireEvent.change(slider(), { target: { value: '1234' } });

    mocked.blockNumber = 778n;
    mocked.signalScale = 2n;
    view.rerender(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    expect(slider().value).toBe('1234');
    expect(screen.getByTestId(registryTestId('draft-weight', liveRuntimeFixture.strategies.USDG)).textContent).toBe(
      'Draft 12.3%',
    );
  });

  it('shows and warns about an alternate manager-reward receiver', () => {
    mocked.rewardReceiver = ALTERNATE_ACCOUNT;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <RewardClaimsPanel />
      </RuntimeDeploymentProvider>,
    );

    const row = screen.getByTestId(registryTestId('reward-row', liveRuntimeFixture.assets.WETH));
    expect(row.textContent).toContain('Alternate receiver');
    expect(
      screen.getByTestId(registryTestId('reward-receiver', liveRuntimeFixture.assets.WETH)).getAttribute('title'),
    ).toBe(ALTERNATE_ACCOUNT);
  });

  it('resolves an unset manager-reward receiver to the beneficiary wallet', () => {
    mocked.rewardReceiver = '0x0000000000000000000000000000000000000000';
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <RewardClaimsPanel />
      </RuntimeDeploymentProvider>,
    );

    const row = screen.getByTestId(registryTestId('reward-row', liveRuntimeFixture.assets.WETH));
    expect(row.textContent).not.toContain('Alternate receiver');
    expect(
      screen.getByTestId(registryTestId('reward-receiver', liveRuntimeFixture.assets.WETH)).getAttribute('title'),
    ).toBe(DEFAULT_ACCOUNT);
  });

  it('renders pinned per-contract terminal dust and sweeps an indexed coordinate only to GumBallVault', async () => {
    const amountRaw = 5n * TOKEN_UNIT;
    mocked.totalPendingWeth = amountRaw;
    mocked.terminalDustRows = [
      {
        amountRaw,
        generation: 3n,
        managerRewards: liveRuntimeFixture.rewards.WETH,
        queuedBlockNumber: 770n,
        remainderCycle: 9n,
        rewardToken: liveRuntimeFixture.assets.WETH,
        rewardTokenDecimals: 18,
        strategy: liveRuntimeFixture.strategies.WETH,
        symbol: 'WETH',
      },
    ];
    mocked.submit.mockResolvedValueOnce(`0x${'1'.repeat(64)}`);
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <RewardClaimsPanel />
      </RuntimeDeploymentProvider>,
    );

    expect(
      screen.getByTestId(registryTestId('reward-terminal-dust', liveRuntimeFixture.rewards.WETH)).textContent,
    ).toContain('Queued terminal dust 5 WETH');
    const row = screen.getByTestId(`terminal-dust-row-${liveRuntimeFixture.rewards.WETH.toLowerCase()}-3-9`);
    expect(row.textContent).toContain('WETH');
    expect(row.textContent).toContain('GumBallVault');
    expect(row.textContent).toContain('5 WETH');

    fireEvent.click(screen.getByRole('button', { name: 'Sweep WETH generation 3 cycle 9 to GumBallVault' }));
    await waitFor(() =>
      expect(mocked.submit).toHaveBeenCalledWith(
        buildManagerRewardTerminalDustSweep(liveRuntimeFixture.rewards.WETH, 3n, 9n),
        'Sweep WETH terminal dust generation 3 cycle 9 to the vault',
        { validatedErrorContractKind: 'manager-rewards' },
      ),
    );
    await waitFor(() => expect(mocked.terminalDustRefetch).toHaveBeenCalledTimes(1));
    expect(mocked.refetch).toHaveBeenCalledTimes(1);
  });

  it('renders an appended Lens-derived rewards contract and binds its generated error profile', async () => {
    mocked.includeDynamic = true;
    mocked.terminalDustRows = [
      {
        amountRaw: 2n * TOKEN_UNIT,
        generation: 4n,
        managerRewards: EXTRA_REWARDS,
        queuedBlockNumber: 771n,
        remainderCycle: 10n,
        rewardToken: EXTRA_TOKEN,
        rewardTokenDecimals: 18,
        strategy: EXTRA_STRATEGY,
        symbol: 'LINK',
      },
    ];
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <RewardClaimsPanel />
      </RuntimeDeploymentProvider>,
    );

    const row = screen.getByTestId(`terminal-dust-row-${EXTRA_REWARDS.toLowerCase()}-4-10`);
    expect(row.textContent).toContain('LINK');
    expect(row.textContent).toContain('2 LINK');
    const sweep = screen.getByRole('button', { name: 'Sweep LINK generation 4 cycle 10 to GumBallVault' });
    fireEvent.click(sweep);
    await waitFor(() =>
      expect(mocked.submit).toHaveBeenCalledWith(
        buildManagerRewardTerminalDustSweep(EXTRA_REWARDS, 4n, 10n),
        'Sweep LINK terminal dust generation 4 cycle 10 to the vault',
        { validatedErrorContractKind: 'manager-rewards' },
      ),
    );
  });

  it('fails closed without fixture sweep rows when the live dust index is unavailable', () => {
    mocked.terminalDustError = true;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <RewardClaimsPanel />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByText('Dust index unavailable')).toBeDefined();
    expect(screen.getByText(/No fixture rows or sweep actions are substituted/iu)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Sweep .* GumBallVault/iu })).toBeNull();
  });

  it('renders an inactive manifest strategy but excludes and disables its draft weight', () => {
    mocked.inactiveSymbol = 'USDG';
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    expect(
      screen.getByTestId(registryTestId('strategy-row', liveRuntimeFixture.strategies.USDG)).textContent,
    ).toContain('Registry inactive');
    expect(screen.getByLabelText(/^Draft USDG signal weight/u).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Simulate signal update' }).hasAttribute('disabled')).toBe(true);
  });

  it('does not label a missing account snapshot as zero active weight', () => {
    mocked.accountUnavailable = true;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <SignalTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    const usdGRow = screen.getByTestId(registryTestId('strategy-row', liveRuntimeFixture.strategies.USDG));
    expect(usdGRow.textContent).toContain('Onchain active Unavailable');
    expect(usdGRow.textContent).not.toContain('Onchain active 0%');
  });

  it('does not render demo-only fixture children in a live runtime', () => {
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <DemoReadModelOnly description="Current data needs a validated source." title="Current data unavailable">
          <span>fixture sentinel balance 123456</span>
        </DemoReadModelOnly>
      </RuntimeDeploymentProvider>,
    );

    expect(screen.queryByText('fixture sentinel balance 123456')).toBeNull();
    expect(screen.getByText('Current data unavailable')).toBeDefined();
  });

  it('disables staking actions for zero and malformed amounts', () => {
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <StakeTransactionPanel />
      </RuntimeDeploymentProvider>,
    );

    const amount = screen.getByLabelText('GBX amount');
    const stake = screen.getByRole('button', { name: 'Stake GBX' });
    const unstake = screen.getByRole('button', { name: 'Unstake' });

    fireEvent.change(amount, { target: { value: '0' } });
    expect(stake.hasAttribute('disabled')).toBe(true);
    expect(unstake.hasAttribute('disabled')).toBe(true);

    fireEvent.change(amount, { target: { value: 'not-a-number' } });
    expect(stake.hasAttribute('disabled')).toBe(true);
    expect(unstake.hasAttribute('disabled')).toBe(true);
    fireEvent.click(stake);
    fireEvent.click(unstake);
    expect(mocked.submit).not.toHaveBeenCalled();

    fireEvent.change(amount, { target: { value: '1' } });
    expect(stake.hasAttribute('disabled')).toBe(false);
    expect(unstake.hasAttribute('disabled')).toBe(false);
  });
});
