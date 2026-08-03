import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { genesisBootstrapAbi, genesisClaimsAbi } from '@gumball-6900/sdk';
import { decodeFunctionData, type Address, type Hash } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GenesisLifecyclePanel } from '../components/protocol/genesis-actions';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { erc20TransactionAbi } from '../lib/transactions';
import { liveRuntimeFixture } from './live-runtime-fixture';

const beneficiary = '0x9999999999999999999999999999999999999999' as const;
const mocked = vi.hoisted(() => ({
  allowanceNeedsApproval: true,
  genesisState: 2,
  previewClaim: 0n,
  refetchAllowance: vi.fn(async () => undefined),
  refetchGenesis: vi.fn(async () => undefined),
  submit: vi.fn(async (transaction: { to: Address; data: `0x${string}` }, label: string): Promise<Hash | null> => {
    void transaction;
    void label;
    return `0x${'56'.repeat(32)}` as Hash;
  }),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: beneficiary, isConnected: true }),
}));

vi.mock('../hooks/use-protocol-reads', () => ({
  useAllowance: () => ({
    allowance: mocked.allowanceNeedsApproval ? 0n : 10n ** 30n,
    isPending: false,
    needsApproval: mocked.allowanceNeedsApproval,
    refetch: mocked.refetchAllowance,
  }),
  useGenesisBootstrapView: () => ({
    data: {
      beneficiaryContribution: 25_000n * 10n ** 6n,
      beneficiaryPreviewClaim: mocked.previewClaim,
      blockNumber: 77n,
      blockTimestamp: 1_000n,
      bootstrapContributionCap: 200_000n * 10n ** 6n,
      communityUSDG: 25_000n * 10n ** 6n,
      contributionEnd: 87_400n,
      contributionStart: 1_000n,
      genesisPriceWad: 0n,
      minimumBootstrapUSDG: 100_000n * 10n ** 6n,
      requiredSponsorUSDG: 0n,
      settledAt: mocked.genesisState === 4 ? 1_100n : 0n,
      settlementDeadline: 0n,
      sponsorEscrow: 50_000n * 10n ** 6n,
      state: mocked.genesisState,
      usdGDecimals: 6,
    },
    isError: false,
    isFetching: false,
    refetch: mocked.refetchGenesis,
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

function renderPanel() {
  return render(
    <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
      <GenesisLifecyclePanel />
    </RuntimeDeploymentProvider>,
  );
}

describe('genesis beneficiary actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.allowanceNeedsApproval = true;
    mocked.genesisState = 2;
    mocked.previewClaim = 0n;
  });

  it('approves the exact edited USDG amount for GenesisBootstrap', async () => {
    const user = userEvent.setup();
    renderPanel();
    const amount = screen.getByLabelText('Genesis USDG amount');
    await user.clear(amount);
    await user.type(amount, '12,345.67');
    await user.click(screen.getByRole('button', { name: 'Approve exact genesis USDG' }));

    const [transaction, label] = mocked.submit.mock.calls[0] ?? [];
    expect(transaction?.to).toBe(liveRuntimeFixture.assets.USDG);
    const decoded = decodeFunctionData({ abi: erc20TransactionAbi, data: transaction?.data ?? '0x' });
    expect(decoded.functionName).toBe('approve');
    expect(decoded.args).toEqual([liveRuntimeFixture.addresses.genesisBootstrap, 12_345_670_000n]);
    expect(label).toBe('Approve USDG for genesis');
  });

  it('submits a capped contribution for only the connected beneficiary', async () => {
    mocked.allowanceNeedsApproval = false;
    const user = userEvent.setup();
    renderPanel();
    const amount = screen.getByLabelText('Genesis USDG amount');
    await user.clear(amount);
    await user.type(amount, '100,000');
    await user.click(screen.getByRole('button', { name: 'Simulate genesis contribution' }));

    const [transaction] = mocked.submit.mock.calls[0] ?? [];
    expect(transaction?.to).toBe(liveRuntimeFixture.addresses.genesisBootstrap);
    const decoded = decodeFunctionData({ abi: genesisBootstrapAbi, data: transaction?.data ?? '0x' });
    expect(decoded.functionName).toBe('contribute');
    expect(decoded.args).toEqual([beneficiary, 100_000n * 10n ** 6n]);
  });

  it('routes refundable USDG and settled GBX to the connected beneficiary', async () => {
    const user = userEvent.setup();
    mocked.genesisState = 5;
    const rendered = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Refund genesis USDG' }));

    const [refundTransaction] = mocked.submit.mock.calls[0] ?? [];
    const decodedRefund = decodeFunctionData({
      abi: genesisBootstrapAbi,
      data: refundTransaction?.data ?? '0x',
    });
    expect(decodedRefund.functionName).toBe('refund');
    expect(decodedRefund.args).toEqual([beneficiary]);

    rendered.unmount();
    mocked.submit.mockClear();
    mocked.genesisState = 4;
    mocked.previewClaim = 20_000_000n * 10n ** 18n;
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Claim genesis GBX' }));

    const [claimTransaction] = mocked.submit.mock.calls[0] ?? [];
    const decodedClaim = decodeFunctionData({ abi: genesisClaimsAbi, data: claimTransaction?.data ?? '0x' });
    expect(decodedClaim.functionName).toBe('claim');
    expect(decodedClaim.args).toEqual([beneficiary]);
  });
});
