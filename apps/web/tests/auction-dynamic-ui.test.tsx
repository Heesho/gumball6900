import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { acquisitionStrategyAbi } from '@gumball-6900/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, keccak256, stringToHex } from 'viem';

import { AuctionFillPanel } from '../components/protocol/auction-actions';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { registryTestId } from '../lib/registry-presentation';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const mocked = vi.hoisted(() => ({
  expired: false,
  needsApproval: true,
  overview: {} as Record<string, unknown>,
  selections: [] as unknown[],
  submit: vi.fn(async (...args: unknown[]) => {
    void args;
    return null;
  }),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x0000000000000000000000000000000000000039', isConnected: true }),
}));

const firstToken = fixtureAddress(900);
const firstStrategy = fixtureAddress(901);
const secondToken = fixtureAddress(903);
const secondStrategy = fixtureAddress(904);

function asset(token: typeof firstToken, strategy: typeof firstStrategy, registryIndex: number) {
  return {
    acquisitionEnabled: true,
    assetId: keccak256(stringToHex(`asset:${token}`)),
    decimals: 18,
    genesisSymbol: null,
    isStockToken: false,
    redemptionEnabled: true,
    registryIndex,
    rewards: fixtureAddress(950 + registryIndex),
    strategy,
    symbol: 'LINK',
    symbolHash: keccak256(stringToHex('LINK')),
    token,
    vaultBalance: 1n,
  };
}

function strategy(token: typeof firstToken, address: typeof firstStrategy, registryIndex: number) {
  return {
    activeWeight: 1n,
    genesisSymbol: null,
    kind: 'acquisition' as const,
    live: true,
    registryIndex,
    strategy: address,
    symbol: 'LINK',
    token,
    virtualUSDGBudget: 1n,
    voterDisabled: false,
  };
}

vi.mock('../hooks/use-live-protocol-overview', () => ({
  useLiveProtocolOverview: () => mocked.overview,
}));

vi.mock('../hooks/use-protocol-reads', () => ({
  useAllowance: () => ({ isPending: false, needsApproval: mocked.needsApproval, refetch: vi.fn() }),
  useAuctionRead: (selection: unknown, usdGAmountRaw: bigint) => {
    mocked.selections.push(selection);
    const quote = {
      auctionId: 1n,
      auctionExpiresAt: 86_500n,
      availableBudgetRaw: 1_000_000_000n,
      blockTimestamp: mocked.expired ? 86_500n : 1_000n,
      fillsPaused: false,
      isExpired: mocked.expired,
      isLiveStrategy: true,
      maximumLotUSDGRaw: 1_000_000_000n,
      minimumLotUSDGRaw: 1n,
      requiredTargetRaw: 1n,
      usdGAmountRaw,
    };
    return {
      auctionId: 1n,
      blockHash: `0x${'ab'.repeat(32)}`,
      blockNumber: 777n,
      currentRate: 1n * 10n ** 18n,
      isPending: false,
      lastUpdatedAt: 1,
      quote,
      refetch: vi.fn(async () => quote),
      source: 'live',
    };
  },
}));

vi.mock('../hooks/use-protocol-transaction', () => ({
  useProtocolTransaction: () => ({
    isBusy: false,
    readiness: 'ready',
    requestNetworkSwitch: vi.fn(),
    reset: vi.fn(),
    state: { hash: null, label: null, message: null, phase: 'idle' },
    submit: mocked.submit,
  }),
}));

describe('dynamic auction strategy selection', () => {
  beforeEach(() => {
    mocked.expired = false;
    mocked.needsApproval = true;
    mocked.submit.mockClear();
  });

  it('keeps duplicate display symbols selectable by collision-free strategy address', async () => {
    mocked.selections.length = 0;
    mocked.overview = {
      data: {
        assets: [asset(firstToken, firstStrategy, 8), asset(secondToken, secondStrategy, 9)],
        blockNumber: 777n,
        strategies: [strategy(firstToken, firstStrategy, 9), strategy(secondToken, secondStrategy, 10)],
        supply: {
          cumulativeBurned: 0n,
          cumulativeMinted: 1n,
          remainingMintCapacity: 1_000_000_000n * 10n ** 18n - 1n,
          totalSupply: 1n,
        },
      },
      error: null,
      isFetching: false,
      refetch: vi.fn(),
      source: 'live',
    };
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <AuctionFillPanel />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getAllByRole('option', { name: /Accumulate LINK/u })).toHaveLength(2);
    expect(screen.getByTestId(registryTestId('auction-strategy-option', firstStrategy))).toBeDefined();
    expect(screen.getByTestId(registryTestId('auction-strategy-option', secondStrategy))).toBeDefined();

    fireEvent.change(screen.getByLabelText('Strategy'), { target: { value: secondStrategy.toLowerCase() } });
    await waitFor(() =>
      expect(mocked.selections.at(-1)).toMatchObject({ kind: 'acquisition', strategy: secondStrategy }),
    );
  });

  it('blocks approval and fill at exact expiry and submits the typed permissionless restart', async () => {
    mocked.expired = true;
    mocked.overview = {
      data: {
        assets: [asset(firstToken, firstStrategy, 8)],
        blockNumber: 777n,
        strategies: [strategy(firstToken, firstStrategy, 9)],
        supply: {
          cumulativeBurned: 0n,
          cumulativeMinted: 1n,
          remainingMintCapacity: 1_000_000_000n * 10n ** 18n - 1n,
          totalSupply: 1n,
        },
      },
      error: null,
      isFetching: false,
      refetch: vi.fn(),
      source: 'live',
    };
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <AuctionFillPanel />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByRole('button', { name: 'Approve exact maximum' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Simulate auction fill' }).hasAttribute('disabled')).toBe(true);
    const restart = screen.getByRole('button', { name: 'Restart expired auction' });
    expect(restart.hasAttribute('disabled')).toBe(false);
    fireEvent.click(restart);

    await waitFor(() => expect(mocked.submit).toHaveBeenCalledTimes(1));
    const [builder, label, options] = mocked.submit.mock.calls[0]!;
    expect(label).toBe('Restart LINK acquisition auction');
    expect(options).toMatchObject({
      errorTarget: firstStrategy,
      validatedErrorContractKind: 'acquisition-strategy',
    });
    const transaction = await (builder as () => Promise<{ data: `0x${string}`; to: string }>)();
    expect(transaction.to.toLowerCase()).toBe(firstStrategy.toLowerCase());
    expect(decodeFunctionData({ abi: acquisitionStrategyAbi, data: transaction.data }).functionName).toBe(
      'restartExpiredAuction',
    );
  });

  it('derives the fill deadline from the freshly pinned chain timestamp', async () => {
    mocked.needsApproval = false;
    mocked.overview = {
      data: {
        assets: [asset(firstToken, firstStrategy, 8)],
        blockNumber: 777n,
        strategies: [strategy(firstToken, firstStrategy, 9)],
        supply: {
          cumulativeBurned: 0n,
          cumulativeMinted: 1n,
          remainingMintCapacity: 1_000_000_000n * 10n ** 18n - 1n,
          totalSupply: 1n,
        },
      },
      error: null,
      isFetching: false,
      refetch: vi.fn(),
      source: 'live',
    };
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <AuctionFillPanel />
      </RuntimeDeploymentProvider>,
    );

    fireEvent.change(screen.getByLabelText('USDG requested'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate auction fill' }));
    await waitFor(() => expect(mocked.submit).toHaveBeenCalledTimes(1));
    const [builder, , options] = mocked.submit.mock.calls[0]!;
    expect(options).toMatchObject({
      errorTarget: firstStrategy,
      validatedErrorContractKind: 'acquisition-strategy',
    });
    const transaction = await (builder as () => Promise<{ data: `0x${string}`; to: string }>)();
    const decoded = decodeFunctionData({ abi: acquisitionStrategyAbi, data: transaction.data });
    expect(decoded.functionName).toBe('fill');
    expect(decoded.args?.[4]).toBe(2_200n);
  });
});
