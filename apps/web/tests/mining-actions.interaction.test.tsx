import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { miningPoolAbi } from '@gumball-6900/sdk';
import { decodeFunctionData, type Address, type Hash } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MiningClaimAction,
  MiningContributionActions,
  MiningEpochOverview,
  MiningEpochStats,
  MiningRefundAction,
} from '../components/protocol/mining-actions';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import type { RuntimeDeployment } from '../lib/runtime-types';
import { erc20TransactionAbi } from '../lib/transactions';

const mocked = vi.hoisted(() => ({
  submit: vi.fn(async (transaction: { to: Address; data: `0x${string}` }, label: string): Promise<Hash | null> => {
    void transaction;
    void label;
    return `0x${'56'.repeat(32)}` as Hash;
  }),
  refetchAllowance: vi.fn(async () => undefined),
  refetchEpoch: vi.fn(async () => undefined),
  referenceMiningPrice: 10n ** 18n,
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x9999999999999999999999999999999999999999', isConnected: true }),
}));

vi.mock('../hooks/use-protocol-reads', () => ({
  useAllowance: () => ({
    allowance: 0n,
    isPending: false,
    needsApproval: true,
    refetch: mocked.refetchAllowance,
  }),
  useCurrentMiningEpoch: () => ({
    data: {
      beneficiaryContribution: 0n,
      blockNumber: 77n,
      blockTimestamp: 1_000n,
      contributionsPaused: false,
      currentScheduledEmission: 100_000n * 10n ** 18n,
      endTime: 87_400n,
      epochId: 7n,
      extensionUsed: 0n,
      invalidated: false,
      referenceMiningPrice: mocked.referenceMiningPrice,
      remainingMintCapacity: 900_000_000n * 10n ** 18n,
      startTime: 1_000n,
      totalContributed: 0n,
      usdGDecimals: 6,
    },
    isError: false,
    isPending: false,
    refetch: mocked.refetchEpoch,
  }),
}));

vi.mock('../hooks/use-protocol-transaction', () => ({
  useProtocolTransaction: () => ({
    state: { phase: 'idle', label: null, hash: null, message: null },
    readiness: 'ready',
    isBusy: false,
    submit: mocked.submit,
    requestNetworkSwitch: vi.fn(async () => undefined),
    reset: vi.fn(),
  }),
}));

function address(seed: number): Address {
  return `0x${seed.toString(16).padStart(40, '0')}` as Address;
}

const runtime = {
  mode: 'live',
  runtimeKind: 'production',
  fallbackReason: null,
  chain: {
    id: 4663,
    environment: 'mainnet',
    name: 'Robinhood Chain',
    rpcUrl: 'https://archive.example/rpc',
    fallbackRpcUrls: ['https://fallback.example/rpc'],
    explorerUrl: 'https://explorer.example',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  issues: [],
  addresses: {
    gbx: address(1),
    protocolTimelock: address(56),
    strategyDeployer: address(60),
    emergencyGuardian: address(55),
    eligibilityModule: address(17),
    genesisBootstrap: address(2),
    genesisClaims: address(3),
    emissionController: address(4),
    miningPool: address(5),
    miningClaims: address(6),
    gumBallVault: address(7),
    assetRegistry: address(8),
    stakedGBX: address(9),
    allocationVoter: address(10),
    revenueRouter: address(11),
    holdUSDGStrategy: address(30),
    buybackBurnStrategy: address(12),
    liquidityManager: address(13),
    launchGuardHook: address(14),
    genesisLiquidityCalculator: address(18),
    gumBallLens: address(15),
    gumBallRouter: address(16),
  },
  assets: {
    USDG: address(20),
    WETH: address(21),
    WBTC: address(22),
    QQQ: address(23),
    TSLA: address(24),
    SPCX: address(25),
    NVDA: address(26),
    AAPL: address(27),
    GBX: address(1),
  },
  assetMetadata: Object.fromEntries(
    [
      ['USDG', 6],
      ['WETH', 18],
      ['WBTC', 8],
      ['QQQ', 18],
      ['TSLA', 18],
      ['SPCX', 18],
      ['NVDA', 18],
      ['AAPL', 18],
      ['GBX', 18],
    ].map(([symbol, decimals], index) => [
      symbol,
      {
        symbol,
        address: symbol === 'GBX' ? address(1) : address(20 + index),
        decimals,
        uid: null,
        registryStatus: 'NOT_APPLICABLE',
        acquisitionEnabled: symbol !== 'GBX',
        redemptionEnabled: true,
      },
    ]),
  ),
  strategies: {
    USDG: address(30),
    WETH: address(31),
    WBTC: address(32),
    QQQ: address(33),
    TSLA: address(34),
    SPCX: address(35),
    NVDA: address(36),
    AAPL: address(37),
    BURN: address(38),
  },
  rewards: {
    WETH: address(41),
    WBTC: address(42),
    QQQ: address(43),
    TSLA: address(44),
    SPCX: address(45),
    NVDA: address(46),
    AAPL: address(47),
  },
  externalContracts: {
    poolManager: { address: address(50), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    positionManager: { address: address(59), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    quoter: { address: address(51), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    stateView: { address: address(52), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    universalRouter: { address: address(53), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    permit2: { address: address(54), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
  },
  admin: {
    emergencyGuardian: address(55),
    protocolTimelock: address(56),
    guardianOperator: address(57),
    protocolTimelockProposer: address(58),
  },
  subgraphUrl: 'https://subgraph.example/graphql',
  manifest: {
    version: 'v1.0.0',
    gitCommit: 'a'.repeat(40),
    status: 'release-approved',
    complianceMode: 'permissioned-production',
    miningPoolDeploymentBlock: '13',
    signatureCount: 2,
    signatureThreshold: 2,
  },
} as const satisfies RuntimeDeployment;

describe('mining transaction interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.referenceMiningPrice = 10n ** 18n;
  });

  it('fails closed without rendering recurring economics before genesis settlement', () => {
    mocked.referenceMiningPrice = 0n;
    render(
      <RuntimeDeploymentProvider runtime={runtime}>
        <MiningEpochOverview />
        <MiningEpochStats />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByText('Genesis settlement required')).toBeDefined();
    expect(screen.getByText('Recurring mining not initialized')).toBeDefined();
    expect(screen.queryByText('Minimum mining price')).toBeNull();
  });

  it('updates the pinned current-epoch estimate when the contribution input changes', async () => {
    const user = userEvent.setup();
    render(
      <RuntimeDeploymentProvider runtime={runtime}>
        <MiningContributionActions />
      </RuntimeDeploymentProvider>,
    );

    const estimate = screen.getByTestId('estimated-mining-gbx');
    const initialEstimate = estimate.textContent;
    const amount = screen.getByLabelText('USDG amount');
    await user.clear(amount);
    await user.type(amount, '2,500.25');

    await waitFor(() => expect(estimate.textContent).not.toBe(initialEstimate));
  });

  it('builds and submits an exact SDK-compatible approval from edited input', async () => {
    const user = userEvent.setup();
    render(
      <RuntimeDeploymentProvider runtime={runtime}>
        <MiningContributionActions />
      </RuntimeDeploymentProvider>,
    );

    const amount = screen.getByLabelText('USDG amount');
    await user.clear(amount);
    await user.type(amount, '2,500.25');
    await user.click(screen.getByRole('button', { name: 'Approve exact USDG' }));

    expect(mocked.submit).toHaveBeenCalledOnce();
    const [transaction, label] = mocked.submit.mock.calls[0] ?? [];
    expect(transaction?.to).toBe(runtime.assets.USDG);
    const decoded = decodeFunctionData({ abi: erc20TransactionAbi, data: transaction?.data ?? '0x' });
    expect(decoded.functionName).toBe('approve');
    expect(decoded.args?.[1]).toBe(2_500_250_000n);
    expect(label).toBe('Approve USDG for mining');
    expect(mocked.refetchAllowance).toHaveBeenCalledOnce();
  });

  it('reports partial claim-batch confirmation and stops before later batches', async () => {
    const confirmedHash = `0x${'12'.repeat(32)}` as Hash;
    mocked.submit.mockResolvedValueOnce(confirmedHash).mockResolvedValueOnce(null);
    const onConfirmed = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(
      <RuntimeDeploymentProvider runtime={runtime}>
        <MiningClaimAction
          epochIds={Array.from({ length: 129 }, (_, index) => BigInt(index))}
          label="Claim all"
          onConfirmed={onConfirmed}
        />
      </RuntimeDeploymentProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Claim all' }));

    expect(await screen.findByText('Claim batching stopped')).toBeDefined();
    expect(screen.getByText(/1 of 3 batches confirmed/iu)).toBeDefined();
    const confirmedLink = screen.getByTestId('confirmed-claim-batch-hash');
    expect(confirmedLink.textContent).toContain(`${confirmedHash.slice(0, 10)}…${confirmedHash.slice(-8)}`);
    expect(confirmedLink.getAttribute('href')).toBe(`${runtime.chain.explorerUrl}/tx/${confirmedHash}`);
    expect(mocked.submit).toHaveBeenCalledTimes(2);
    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it('builds an invalidated-epoch refund for the connected beneficiary', async () => {
    const onConfirmed = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(
      <RuntimeDeploymentProvider runtime={runtime}>
        <MiningRefundAction epochId={9n} onConfirmed={onConfirmed} />
      </RuntimeDeploymentProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Refund' }));

    const [transaction, label] = mocked.submit.mock.calls[0] ?? [];
    expect(transaction?.to).toBe(runtime.addresses.miningPool);
    const decoded = decodeFunctionData({ abi: miningPoolAbi, data: transaction?.data ?? '0x' });
    expect(decoded.functionName).toBe('refund');
    expect(decoded.args).toEqual(['0x9999999999999999999999999999999999999999', 9n]);
    expect(label).toBe('Refund invalidated epoch #9 USDG to beneficiary');
    expect(onConfirmed).toHaveBeenCalledOnce();
  });
});
