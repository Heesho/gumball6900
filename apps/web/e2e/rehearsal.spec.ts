import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';
import {
  allocationVoterAbi,
  emergencyGuardianAbi,
  gbxAbi,
  genesisSqrtPriceX96,
  genesisBootstrapAbi,
  genesisClaimsAbi,
  managerRewardsAbi,
  miningClaimsAbi,
  miningPoolAbi,
  revenueRouterAbi,
  stakedGbxAbi,
} from '@gumball-6900/sdk';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  type Address,
} from 'viem';

interface RehearsalFixture {
  account: Address;
  addresses: {
    allocationVoter: Address;
    emergencyGuardian: Address;
    gbx: Address;
    genesisBootstrap: Address;
    genesisClaims: Address;
    gumBallVault: Address;
    miningClaims: Address;
    miningPool: Address;
    protocolTimelock: Address;
    revenueRouter: Address;
    stakedGBX: Address;
  };
  assets: Record<'GBX' | 'LINK' | 'NVDA' | 'USDG', Address>;
  chainId: 46630;
  chainTimestamp: number;
  rewards: Record<'NVDA', Address>;
  postLaunch: { rewards: Address; strategy: Address; symbol: 'LINK'; token: Address };
  rpcUrl: string;
  strategies: Record<'BURN' | 'NVDA', Address>;
}

const fixturePath = new URL('../test-results/rehearsal-fixture.json', import.meta.url);
const erc20Abi = parseAbi([
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function mint(address receiver,uint256 amount)',
]);
const CONTRIBUTION = 1_250n * 10n ** 6n;
const INVALIDATED_CONTRIBUTION = 500n * 10n ** 6n;
const FAILED_GENESIS_CONTRIBUTION = 25_000n * 10n ** 6n;
const SUCCESSFUL_GENESIS_CONTRIBUTION = 100_000n * 10n ** 6n;
const STAKE = 25_000n * 10n ** 18n;
const REVENUE = 100_000n * 10n ** 6n;
const AUCTION_USDG = 25_000n * 10n ** 6n;
const POST_LAUNCH_AUCTION_USDG = 10_000n * 10n ** 6n;
const BUYBACK_USDG = 10_000n * 10n ** 6n;
const REDEMPTION = 10_000n * 10n ** 18n;

async function fixture(): Promise<RehearsalFixture> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as RehearsalFixture;
}

async function installInjectedWallet(page: Page, state: RehearsalFixture) {
  await page.addInitScript(({ account, chainId, chainTimestamp, rpcUrl }) => {
    const realNow = Date.now.bind(Date);
    const fixtureTimeOffsetMilliseconds = chainTimestamp * 1_000 - realNow();
    Date.now = () => {
      let advancedSeconds = 0;
      try {
        advancedSeconds = Number.parseInt(sessionStorage.getItem('gumball-rehearsal-time-advance') ?? '0', 10);
      } catch {
        // Session storage is unavailable in an opaque initial document.
      }
      return realNow() + fixtureTimeOffsetMilliseconds + advancedSeconds * 1_000;
    };
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    let requestId = 0;
    const emit = (event: string, ...args: unknown[]) => {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    };
    const forwardRpc = async (method: string, params: readonly unknown[]) => {
      const response = await fetch(rpcUrl, {
        body: JSON.stringify({ id: ++requestId, jsonrpc: '2.0', method, params }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const payload = (await response.json()) as { error?: { message?: string }; result?: unknown };
      if (payload.error !== undefined) {
        const error = new Error(payload.error.message ?? `Local RPC rejected ${method}`) as Error & {
          code?: number;
        };
        error.code = -32603;
        throw error;
      }
      return payload.result;
    };
    const provider = {
      isConnected: () => true,
      on(event: string, listener: (...args: unknown[]) => void) {
        const eventListeners = listeners.get(event) ?? new Set();
        eventListeners.add(listener);
        listeners.set(event, eventListeners);
        return provider;
      },
      removeListener(event: string, listener: (...args: unknown[]) => void) {
        listeners.get(event)?.delete(listener);
        return provider;
      },
      async request({ method, params = [] }: { method: string; params?: readonly unknown[] }) {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
          return [account];
        }
        if (method === 'eth_chainId') return `0x${chainId.toString(16)}`;
        if (method === 'eth_coinbase') return account;
        if (method === 'wallet_getPermissions' || method === 'wallet_requestPermissions') {
          return [{ caveats: [], date: Date.now(), invoker: window.location.origin, parentCapability: 'eth_accounts' }];
        }
        if (method === 'wallet_addEthereumChain' || method === 'wallet_switchEthereumChain') {
          queueMicrotask(() => emit('chainChanged', `0x${chainId.toString(16)}`));
          return null;
        }
        if (method === 'eth_sendTransaction') {
          const transaction = params[0];
          if (typeof transaction === 'object' && transaction !== null && !('gas' in transaction)) {
            // Model wallet gas headroom explicitly: Anvil's unlocked-account path otherwise mines with the exact
            // current-block estimate, while a time-dependent auction can execute in the following timestamp.
            const estimatedGas = await forwardRpc('eth_estimateGas', [transaction]);
            if (typeof estimatedGas !== 'string') throw new Error('Local RPC returned an invalid gas estimate');
            const gasWithWalletMargin = (BigInt(estimatedGas) * 120n + 99n) / 100n;
            return forwardRpc(method, [{ ...transaction, gas: `0x${gasWithWalletMargin.toString(16)}` }]);
          }
        }
        return forwardRpc(method, params);
      },
    };
    Object.defineProperty(window, 'ethereum', { configurable: false, value: provider });
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
              name: 'Local Anvil rehearsal',
              rdns: 'local.gumball.rehearsal',
              uuid: '69000000-0000-4000-8000-000000046630',
            },
            provider,
          },
        }),
      );
    window.addEventListener('eip6963:requestProvider', announce);
    announce();
  }, state);
}

async function connectWallet(page: Page) {
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Wallet connection status' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Choose a wallet', exact: true }).click();
  await page.getByRole('button', { name: /Local Anvil rehearsal/u }).click();
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeHidden();
}

async function ensureWalletConnected(page: Page) {
  const connect = page.getByRole('button', { name: 'Connect wallet', exact: true });
  if (await connect.isVisible().catch(() => false)) await connectWallet(page);
}

async function expectRehearsalTrustCopy(page: Page) {
  const body = page.locator('body');
  await expect(body).not.toContainText(/\b(?:live|signed)\b/iu);
  await expect(body).not.toContainText(/0\s*\/\s*0\s+quorum/iu);
}

async function navigate(page: Page, label: string, path: string) {
  await page.getByRole('link', { name: label, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`, 'u'));
  await expectRehearsalTrustCopy(page);
}

async function expectConfirmed(page: Page, label: string | RegExp) {
  const transaction = page.locator('[data-transaction-phase]').filter({ hasText: label });
  await expect(transaction).toHaveAttribute('data-transaction-phase', 'success', { timeout: 45_000 });
  await expect(transaction.getByText('Confirmed', { exact: true })).toBeVisible();
}

function statCardByLabel(page: Page, label: string) {
  return page.locator('p').getByText(label, { exact: true }).locator('../..');
}

test('runs a contract-backed user, strategy, redemption, guardian, and timelock journey', async ({ page }) => {
  const state = await fixture();
  await installInjectedWallet(page, state);
  const chain = defineChain({
    id: state.chainId,
    name: 'Disposable Robinhood rehearsal',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [state.rpcUrl] } },
    testnet: true,
  });
  const publicClient = createPublicClient({ chain, transport: http(state.rpcUrl, { retryCount: 0 }) });
  const walletClient = createWalletClient({ account: state.account, chain, transport: http(state.rpcUrl) });

  async function write(address: Address, abi: readonly unknown[], functionName: string, args: readonly unknown[] = []) {
    const hash = await walletClient.writeContract({
      abi,
      account: state.account,
      address,
      args,
      functionName,
    } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe('success');
    return receipt;
  }

  async function rpcRequest(method: string, params: readonly unknown[] = []) {
    const response = await fetch(state.rpcUrl, {
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const payload = (await response.json()) as { error?: unknown; result?: unknown };
    expect(payload.error).toBeUndefined();
    return payload.result;
  }

  async function increaseTime(seconds: number) {
    await rpcRequest('evm_increaseTime', [seconds]);
    await rpcRequest('evm_mine');
    await page.evaluate((advancedSeconds) => {
      const key = 'gumball-rehearsal-time-advance';
      const current = Number.parseInt(sessionStorage.getItem(key) ?? '0', 10);
      sessionStorage.setItem(key, (current + advancedSeconds).toString());
    }, seconds);
  }

  async function restoreSnapshot(snapshotId: unknown) {
    expect(await rpcRequest('evm_revert', [snapshotId])).toBe(true);
    const restoredBlock = await publicClient.getBlock();
    await page.evaluate(
      ({ chainTimestamp, restoredTimestamp }) => {
        sessionStorage.setItem(
          'gumball-rehearsal-time-advance',
          Math.max(0, restoredTimestamp - chainTimestamp).toString(),
        );
      },
      { chainTimestamp: state.chainTimestamp, restoredTimestamp: Number(restoredBlock.timestamp) },
    );
    await page.reload();
    await ensureWalletConnected(page);
  }

  await test.step('the browser contributes to a failed bootstrap, refunds its beneficiary, and restores the chain', async () => {
    await page.goto('/mine');
    await expect(page.getByText('Local Anvil rehearsal', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('not a deployed, verified, audited, or release-approved network').first(),
    ).toBeVisible();
    await expectRehearsalTrustCopy(page);
    await connectWallet(page);

    const panel = page.getByTestId('genesis-lifecycle-panel');
    await expect(panel.getByText('Contributing', { exact: true })).toBeVisible();
    const snapshotId = await rpcRequest('evm_snapshot');
    expect(snapshotId).toBeDefined();

    const amount = page.getByLabel('Genesis USDG amount');
    await amount.fill('25,000');
    const approve = panel.getByRole('button', { name: 'Approve exact genesis USDG' });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectConfirmed(page, 'Approve USDG for genesis');
    const contribute = panel.getByRole('button', { name: 'Simulate genesis contribution' });
    await expect(contribute).toBeEnabled();
    await contribute.click();
    await expectConfirmed(page, /Contribute .* USDG to genesis/);
    expect(
      await publicClient.readContract({
        abi: genesisBootstrapAbi,
        address: state.addresses.genesisBootstrap,
        args: [state.account],
        functionName: 'communityContribution',
      }),
    ).toBe(FAILED_GENESIS_CONTRIBUTION);

    await increaseTime(7 * 24 * 60 * 60 + 1);
    await write(state.addresses.genesisBootstrap, genesisBootstrapAbi, 'close');
    await page.reload();
    await ensureWalletConnected(page);
    const refundablePanel = page.getByTestId('genesis-lifecycle-panel');
    await expect(refundablePanel.getByText('Refundable', { exact: true })).toBeVisible();
    const balanceBeforeRefund = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.USDG,
      args: [state.account],
      functionName: 'balanceOf',
    });
    await refundablePanel.getByRole('button', { name: 'Refund genesis USDG' }).click();
    await expectConfirmed(page, 'Refund genesis USDG to beneficiary');
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.assets.USDG,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(balanceBeforeRefund + FAILED_GENESIS_CONTRIBUTION);

    await restoreSnapshot(snapshotId);
    const restoredPanel = page.getByTestId('genesis-lifecycle-panel');
    await expect(restoredPanel.getByText('Contributing', { exact: true })).toBeVisible();
    expect(
      await publicClient.readContract({
        abi: genesisBootstrapAbi,
        address: state.addresses.genesisBootstrap,
        args: [state.account],
        functionName: 'communityContribution',
      }),
    ).toBe(0n);
  });

  await test.step('the browser funds successful genesis, then claims after atomic production settlement', async () => {
    const panel = page.getByTestId('genesis-lifecycle-panel');
    const amount = page.getByLabel('Genesis USDG amount');
    await amount.fill('100,000');
    const approve = panel.getByRole('button', { name: 'Approve exact genesis USDG' });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectConfirmed(page, 'Approve USDG for genesis');
    const contribute = panel.getByRole('button', { name: 'Simulate genesis contribution' });
    await expect(contribute).toBeEnabled();
    await contribute.click();
    await expectConfirmed(page, /Contribute .* USDG to genesis/);
    expect(
      await publicClient.readContract({
        abi: genesisBootstrapAbi,
        address: state.addresses.genesisBootstrap,
        args: [state.account],
        functionName: 'communityContribution',
      }),
    ).toBe(SUCCESSFUL_GENESIS_CONTRIBUTION);

    await increaseTime(7 * 24 * 60 * 60 + 1);
    await write(state.addresses.genesisBootstrap, genesisBootstrapAbi, 'close');
    expect(
      await publicClient.readContract({
        abi: genesisBootstrapAbi,
        address: state.addresses.genesisBootstrap,
        functionName: 'state',
      }),
    ).toBe(3);
    await write(state.addresses.genesisBootstrap, genesisBootstrapAbi, 'settle', [
      genesisSqrtPriceX96(state.addresses.gbx, state.assets.USDG, SUCCESSFUL_GENESIS_CONTRIBUTION),
    ]);
    expect(
      await publicClient.readContract({
        abi: genesisBootstrapAbi,
        address: state.addresses.genesisBootstrap,
        functionName: 'state',
      }),
    ).toBe(4);

    const previewClaim = await publicClient.readContract({
      abi: genesisClaimsAbi,
      address: state.addresses.genesisClaims,
      args: [state.account],
      functionName: 'previewClaim',
    });
    expect(previewClaim).toBe(80_000_000n * 10n ** 18n);
    const balanceBeforeClaim = await publicClient.readContract({
      abi: gbxAbi,
      address: state.addresses.gbx,
      args: [state.account],
      functionName: 'balanceOf',
    });
    await page.reload();
    await ensureWalletConnected(page);
    const settledPanel = page.getByTestId('genesis-lifecycle-panel');
    await expect(settledPanel.getByText('Settled', { exact: true })).toBeVisible();
    await settledPanel.getByRole('button', { name: 'Claim genesis GBX' }).click();
    await expectConfirmed(page, 'Claim genesis GBX to beneficiary');
    expect(
      await publicClient.readContract({
        abi: gbxAbi,
        address: state.addresses.gbx,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(balanceBeforeClaim + previewClaim);
  });

  await test.step('the client submits a real recurring mining contribution after genesis', async () => {
    const currentEpochId = await publicClient.readContract({
      abi: miningPoolAbi,
      address: state.addresses.miningPool,
      functionName: 'currentEpochId',
    });
    await expect(page.getByTestId('current-mining-epoch-id')).toHaveText(`Epoch ${currentEpochId.toString()}`);
    const estimate = page.getByTestId('estimated-mining-gbx');
    await expect(estimate).not.toHaveText('Unavailable');
    const initialEstimate = await estimate.innerText();
    const amount = page.getByLabel('USDG amount');
    await amount.fill('250');
    await expect(estimate).not.toHaveText(initialEstimate);
    await amount.fill('1,250');

    const approve = page.getByRole('button', { name: 'Approve exact USDG' });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectConfirmed(page, 'Approve USDG for mining');
    const contribute = page.getByRole('button', { name: 'Simulate contribution' });
    await expect(contribute).toBeEnabled();
    await contribute.click();
    await expectConfirmed(page, /Contribute .* USDG to mining/);

    expect(
      await publicClient.readContract({
        abi: miningPoolAbi,
        address: state.addresses.miningPool,
        args: [0n, state.account],
        functionName: 'contributionOf',
      }),
    ).toBe(CONTRIBUTION);
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.assets.USDG,
        args: [state.account, state.addresses.miningPool],
        functionName: 'allowance',
      }),
    ).toBe(0n);
  });

  await test.step('staking and persistent signals execute through production contracts', async () => {
    await navigate(page, 'Manage', '/manage');
    const approve = page.getByRole('button', { name: 'Approve', exact: true });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectConfirmed(page, 'Approve GBX for staking');
    const stake = page.getByRole('button', { name: 'Stake GBX', exact: true });
    await expect(stake).toBeEnabled();
    await stake.click();
    await expectConfirmed(page, /Stake .* GBX/);
    expect(
      await publicClient.readContract({
        abi: stakedGbxAbi,
        address: state.addresses.stakedGBX,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(STAKE);

    const setDraftWeight = async (symbol: 'BURN' | 'LINK' | 'NVDA' | 'USDG', value: string) => {
      await page
        .getByLabel(new RegExp(`^Draft ${symbol} signal weight for target`, 'u'))
        .evaluate((element, nextValue) => {
          const input = element as HTMLInputElement;
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter === undefined) throw new Error('Range input value setter is unavailable.');
          nativeSetter.call(input, nextValue);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
    };
    await setDraftWeight('USDG', '10000');
    const temporarySignal = page.getByRole('button', { name: 'Simulate signal update' });
    await expect(temporarySignal).toBeEnabled();
    await temporarySignal.click();
    await expectConfirmed(page, 'Update persistent allocation signals');
    const cancelPending = page.getByRole('button', { name: 'Cancel pending changes' });
    await expect(cancelPending).toBeEnabled();
    await cancelPending.click();
    await expectConfirmed(page, 'Cancel pending signal changes');
    await expect
      .poll(() =>
        publicClient.readContract({
          abi: allocationVoterAbi,
          address: state.addresses.allocationVoter,
          args: [state.account],
          functionName: 'pendingWeightTotal',
        }),
      )
      .toBe(0n);
    expect(
      await publicClient.readContract({
        abi: allocationVoterAbi,
        address: state.addresses.allocationVoter,
        args: [state.account],
        functionName: 'activeWeightTotal',
      }),
    ).toBe(0n);
    await expect(page.getByLabel(/^Draft USDG signal weight for target/u)).toHaveValue('0');

    await setDraftWeight('USDG', '5500');
    await setDraftWeight('NVDA', '2500');
    await setDraftWeight('LINK', '1000');
    await setDraftWeight('BURN', '1000');
    const signal = page.getByRole('button', { name: 'Simulate signal update' });
    await expect(signal).toBeEnabled();
    await signal.click();
    await expectConfirmed(page, 'Update persistent allocation signals');
    expect(
      await publicClient.readContract({
        abi: allocationVoterAbi,
        address: state.addresses.allocationVoter,
        args: [state.account],
        functionName: 'pendingWeightTotal',
      }),
    ).toBe(STAKE);

    await increaseTime(24 * 60 * 60 + 1);
    const gbxBeforeMiningClaim = await publicClient.readContract({
      abi: gbxAbi,
      address: state.addresses.gbx,
      args: [state.account],
      functionName: 'balanceOf',
    });
    await write(state.addresses.miningPool, miningPoolAbi, 'settleCurrentEpoch');
    const miningClaim = await publicClient.readContract({
      abi: miningClaimsAbi,
      address: state.addresses.miningClaims,
      args: [state.account, 0n],
      functionName: 'previewClaim',
    });
    expect(miningClaim).toBeGreaterThan(0n);
    await navigate(page, 'Mine', '/mine');
    await expect(page.getByTestId('current-mining-epoch-id')).toHaveText('Epoch 1');
    const epochRow = page.getByRole('row').filter({ hasText: '#0' });
    await expect(epochRow.getByText('Claimable', { exact: true })).toBeVisible();
    await epochRow.getByRole('button', { name: 'Claim', exact: true }).click();
    await expectConfirmed(page, 'Claim epoch #0 mining rewards');
    await expect(epochRow.getByText('Claimed', { exact: true })).toBeVisible();
    expect(
      await publicClient.readContract({
        abi: gbxAbi,
        address: state.addresses.gbx,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(gbxBeforeMiningClaim + miningClaim);
    expect(
      await publicClient.readContract({
        abi: miningPoolAbi,
        address: state.addresses.miningPool,
        functionName: 'currentEpochId',
      }),
    ).toBe(1n);

    const invalidatedAmount = page.getByLabel('USDG amount');
    await invalidatedAmount.fill('500');
    const invalidatedApprove = page.getByRole('button', { name: 'Approve exact USDG' });
    await expect(invalidatedApprove).toBeEnabled();
    await invalidatedApprove.click();
    await expectConfirmed(page, 'Approve USDG for mining');
    const invalidatedContribute = page.getByRole('button', { name: 'Simulate contribution' });
    await expect(invalidatedContribute).toBeEnabled();
    await invalidatedContribute.click();
    await expectConfirmed(page, /Contribute .* USDG to mining/);
    await write(state.addresses.emergencyGuardian, emergencyGuardianAbi, 'invalidateMiningEpoch', [
      state.addresses.miningPool,
    ]);
    const usdGBeforeInvalidatedRefund = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.USDG,
      args: [state.account],
      functionName: 'balanceOf',
    });
    await page.reload();
    await ensureWalletConnected(page);
    const invalidatedRow = page.getByRole('row').filter({ hasText: '#1' });
    await expect(invalidatedRow.getByText('Invalidated', { exact: true })).toBeVisible();
    await invalidatedRow.getByRole('button', { name: 'Refund', exact: true }).click();
    await expect
      .poll(
        () =>
          publicClient.readContract({
            abi: miningPoolAbi,
            address: state.addresses.miningPool,
            args: [1n, state.account],
            functionName: 'contributionOf',
          }),
        { timeout: 45_000 },
      )
      .toBe(0n);
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.assets.USDG,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(usdGBeforeInvalidatedRefund + INVALIDATED_CONTRIBUTION);

    await navigate(page, 'Manage', '/manage');
    const activateSignals = page.getByRole('button', { name: 'Activate matured changes' });
    await expect(activateSignals).toBeEnabled();
    await activateSignals.click();
    await expectConfirmed(page, 'Activate matured signal changes');
    expect(
      await publicClient.readContract({
        abi: allocationVoterAbi,
        address: state.addresses.allocationVoter,
        args: [state.account],
        functionName: 'pendingWeightTotal',
      }),
    ).toBe(0n);
    expect(
      await publicClient.readContract({
        abi: allocationVoterAbi,
        address: state.addresses.allocationVoter,
        args: [state.account],
        functionName: 'activeWeightTotal',
      }),
    ).toBe(STAKE);
    await write(state.assets.USDG, erc20Abi, 'approve', [state.addresses.revenueRouter, REVENUE]);
    await write(state.addresses.revenueRouter, revenueRouterAbi, 'routeRevenue', [
      REVENUE,
      keccak256(stringToHex('browser-rehearsal')),
    ]);
    expect(
      await publicClient.readContract({
        abi: allocationVoterAbi,
        address: state.addresses.allocationVoter,
        args: [state.strategies.NVDA],
        functionName: 'previewStrategyBudget',
      }),
    ).toBe(AUCTION_USDG);
    expect(
      await publicClient.readContract({
        abi: allocationVoterAbi,
        address: state.addresses.allocationVoter,
        args: [state.postLaunch.strategy],
        functionName: 'previewStrategyBudget',
      }),
    ).toBe(POST_LAUNCH_AUCTION_USDG);
  });

  await test.step('the browser fills the real oracleless strategy and claims its 2% manager reward', async () => {
    const userUSDGBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.USDG,
      args: [state.account],
      functionName: 'balanceOf',
    });
    const userTargetBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.NVDA,
      args: [state.account],
      functionName: 'balanceOf',
    });
    const vaultTargetBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.NVDA,
      args: [state.addresses.gumBallVault],
      functionName: 'balanceOf',
    });
    const rewardsTargetBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.NVDA,
      args: [state.rewards.NVDA],
      functionName: 'balanceOf',
    });

    await navigate(page, 'Activity', '/activity');
    await expect(page.getByText('Local Anvil rehearsal', { exact: true }).first()).toBeVisible();
    const pinnedAuctionBlock = page.getByText(/^Block \d+ · 0x[0-9a-f]{6}…$/u).first();
    await expect(pinnedAuctionBlock).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reverse Dutch auction fill' })).toBeVisible();
    await expect(
      page.locator(`#auction-strategy option[value="${state.postLaunch.strategy.toLowerCase()}"]`),
    ).toContainText('LINK');
    const restart = page.getByRole('button', { name: 'Restart expired auction' });
    await expect(restart).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Approve exact maximum' })).toBeDisabled();
    await restart.click();
    await expectConfirmed(page, 'Restart NVDA acquisition auction');
    const approve = page.getByRole('button', { name: 'Approve exact maximum' });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectConfirmed(page, 'Approve NVDA for auction fill');
    const auctionBlockBeforeFill = await pinnedAuctionBlock.textContent();
    const fill = page.getByRole('button', { name: 'Simulate auction fill' });
    await expect(fill).toBeEnabled();
    await fill.click();
    await expectConfirmed(page, 'NVDA reverse Dutch auction fill');
    await expect(pinnedAuctionBlock).not.toHaveText(auctionBlockBeforeFill ?? '');

    const userUSDGAfter = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.USDG,
      args: [state.account],
      functionName: 'balanceOf',
    });
    const userTargetAfterFill = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.NVDA,
      args: [state.account],
      functionName: 'balanceOf',
    });
    const vaultTargetAfter = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.NVDA,
      args: [state.addresses.gumBallVault],
      functionName: 'balanceOf',
    });
    const rewardsTargetAfter = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.NVDA,
      args: [state.rewards.NVDA],
      functionName: 'balanceOf',
    });
    const targetPaid = userTargetBefore - userTargetAfterFill;
    const vaultReceived = vaultTargetAfter - vaultTargetBefore;
    const managerReceived = rewardsTargetAfter - rewardsTargetBefore;
    expect(userUSDGAfter - userUSDGBefore).toBe(AUCTION_USDG);
    expect(vaultReceived + managerReceived).toBe(targetPaid);
    expect(managerReceived).toBe((targetPaid * 200n) / 10_000n);
    expect(vaultReceived).toBe(targetPaid - managerReceived);

    await navigate(page, 'Manage', '/manage');
    const nvdaClaim = page
      .getByTestId(`reward-row-${state.assets.NVDA.toLowerCase()}`)
      .getByRole('button', { name: 'Claim', exact: true });
    await expect(nvdaClaim).toBeEnabled();
    await nvdaClaim.click();
    await expectConfirmed(page, 'Claim NVDA manager rewards');
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.assets.NVDA,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(userTargetAfterFill + managerReceived);
  });

  await test.step('the browser address-selects and fills the post-launch LINK strategy', async () => {
    const userUSDGBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.USDG,
      args: [state.account],
      functionName: 'balanceOf',
    });
    const userTargetBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.postLaunch.token,
      args: [state.account],
      functionName: 'balanceOf',
    });
    const vaultTargetBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.postLaunch.token,
      args: [state.addresses.gumBallVault],
      functionName: 'balanceOf',
    });
    const rewardsTargetBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.postLaunch.token,
      args: [state.postLaunch.rewards],
      functionName: 'balanceOf',
    });

    await navigate(page, 'Activity', '/activity');
    const strategySelect = page.locator('#auction-strategy');
    await strategySelect.selectOption(state.postLaunch.strategy.toLowerCase());
    await expect(strategySelect).toHaveValue(state.postLaunch.strategy.toLowerCase());
    await expect(page.getByLabel('Maximum LINK payment')).toBeVisible();
    await page.locator('#auction-usdg').fill('10,000');
    await page.locator('#auction-payment').fill('100');
    const pinnedAuctionBlock = page.getByText(/^Block \d+ · 0x[0-9a-f]{6}…$/u).first();
    await expect(pinnedAuctionBlock).toBeVisible();
    const restart = page.getByRole('button', { name: 'Restart expired auction' });
    await expect(restart).toBeEnabled();
    await restart.click();
    await expectConfirmed(page, 'Restart LINK acquisition auction');
    const approve = page.getByRole('button', { name: 'Approve exact maximum' });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectConfirmed(page, 'Approve LINK for auction fill');
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.postLaunch.token,
        args: [state.account, state.postLaunch.strategy],
        functionName: 'allowance',
      }),
    ).toBe(100n * 10n ** 18n);

    const auctionBlockBeforeFill = await pinnedAuctionBlock.textContent();
    const fill = page.getByRole('button', { name: 'Simulate auction fill' });
    await expect(fill).toBeEnabled();
    await fill.click();
    await expectConfirmed(page, 'LINK reverse Dutch auction fill');
    await expect(pinnedAuctionBlock).not.toHaveText(auctionBlockBeforeFill ?? '');

    const userUSDGAfter = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.USDG,
      args: [state.account],
      functionName: 'balanceOf',
    });
    const userTargetAfterFill = await publicClient.readContract({
      abi: erc20Abi,
      address: state.postLaunch.token,
      args: [state.account],
      functionName: 'balanceOf',
    });
    const vaultTargetAfter = await publicClient.readContract({
      abi: erc20Abi,
      address: state.postLaunch.token,
      args: [state.addresses.gumBallVault],
      functionName: 'balanceOf',
    });
    const rewardsTargetAfter = await publicClient.readContract({
      abi: erc20Abi,
      address: state.postLaunch.token,
      args: [state.postLaunch.rewards],
      functionName: 'balanceOf',
    });
    const targetPaid = userTargetBefore - userTargetAfterFill;
    const vaultReceived = vaultTargetAfter - vaultTargetBefore;
    const managerReceived = rewardsTargetAfter - rewardsTargetBefore;
    expect(userUSDGAfter - userUSDGBefore).toBe(POST_LAUNCH_AUCTION_USDG);
    expect(vaultReceived + managerReceived).toBe(targetPaid);
    expect(managerReceived).toBe((targetPaid * 200n) / 10_000n);
    expect(vaultReceived).toBe(targetPaid - managerReceived);

    await navigate(page, 'Manage', '/manage');
    const linkClaim = page
      .getByTestId(`reward-row-${state.postLaunch.token.toLowerCase()}`)
      .getByRole('button', { name: 'Claim', exact: true });
    await expect(linkClaim).toBeEnabled();
    await linkClaim.click();
    await expectConfirmed(page, 'Claim LINK manager rewards');
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.postLaunch.token,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(userTargetAfterFill + managerReceived);
  });

  await test.step('the pinned dust index discovers and permissionlessly settles real terminal dust', async () => {
    // Perturb the otherwise exactly divisible rehearsal signal weight, then seed one raw reward unit through the
    // immutable strategy-only notification boundary. Queueing and settlement still execute in production contracts.
    await write(state.addresses.stakedGBX, stakedGbxAbi, 'unstake', [1n * 10n ** 18n]);
    expect(
      await publicClient.readContract({
        abi: stakedGbxAbi,
        address: state.addresses.stakedGBX,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(STAKE - 1n * 10n ** 18n);
    await page.getByLabel('GBX amount').fill('24,999');

    await write(state.postLaunch.token, erc20Abi, 'mint', [state.postLaunch.rewards, 1n]);
    await rpcRequest('anvil_setBalance', [state.postLaunch.strategy, '0x3635c9adc5dea00000']);
    await rpcRequest('anvil_impersonateAccount', [state.postLaunch.strategy]);
    try {
      const strategyWallet = createWalletClient({
        account: state.postLaunch.strategy,
        chain,
        transport: http(state.rpcUrl, { retryCount: 0 }),
      });
      const hash = await strategyWallet.writeContract({
        abi: managerRewardsAbi,
        account: state.postLaunch.strategy,
        address: state.postLaunch.rewards,
        args: [1n],
        functionName: 'notifyReward',
      });
      expect((await publicClient.waitForTransactionReceipt({ hash })).status).toBe('success');
    } finally {
      await rpcRequest('anvil_stopImpersonatingAccount', [state.postLaunch.strategy]);
    }
    expect(
      await publicClient.readContract({
        abi: managerRewardsAbi,
        address: state.postLaunch.rewards,
        functionName: 'rewardRemainder',
      }),
    ).toBeGreaterThan(0n);

    const vaultBeforeSweep = await publicClient.readContract({
      abi: erc20Abi,
      address: state.postLaunch.token,
      args: [state.addresses.gumBallVault],
      functionName: 'balanceOf',
    });
    const unstake = page.getByRole('button', { name: 'Unstake', exact: true });
    await expect(unstake).toBeEnabled();
    await unstake.click();
    await expectConfirmed(page, /Unstake .* GBX/);
    expect(
      await publicClient.readContract({
        abi: stakedGbxAbi,
        address: state.addresses.stakedGBX,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(0n);
    expect(
      await publicClient.readContract({
        abi: managerRewardsAbi,
        address: state.postLaunch.rewards,
        args: [0n, 0n],
        functionName: 'pendingTerminalDust',
      }),
    ).toBe(1n);

    const dustRow = page.getByTestId(`terminal-dust-row-${state.postLaunch.rewards.toLowerCase()}-0-0`);
    await expect(dustRow).toBeVisible();
    await expect(page.getByText(/^Indexed block \d+$/u)).toBeVisible();
    await expect(dustRow).toContainText('LINK');
    await expect(dustRow).toContainText('GumBallVault');
    const sweep = dustRow.getByRole('button', { name: 'Sweep LINK generation 0 cycle 0 to GumBallVault' });
    await expect(sweep).toBeEnabled();
    await sweep.click();
    await expectConfirmed(page, 'Sweep LINK terminal dust generation 0 cycle 0 to the vault');
    await expect(dustRow).toHaveCount(0);
    expect(
      await publicClient.readContract({
        abi: managerRewardsAbi,
        address: state.postLaunch.rewards,
        functionName: 'totalPendingTerminalDust',
      }),
    ).toBe(0n);
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.postLaunch.token,
        args: [state.addresses.gumBallVault],
        functionName: 'balanceOf',
      }),
    ).toBe(vaultBeforeSweep + 1n);
  });

  await test.step('the browser sells GBX into the buyback strategy and the token records a real burn', async () => {
    const burnedBefore = await publicClient.readContract({
      abi: gbxAbi,
      address: state.addresses.gbx,
      functionName: 'cumulativeBurned',
    });
    const supplyBefore = await publicClient.readContract({
      abi: gbxAbi,
      address: state.addresses.gbx,
      functionName: 'totalSupply',
    });
    const usdGBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.USDG,
      args: [state.account],
      functionName: 'balanceOf',
    });

    await navigate(page, 'Activity', '/activity');
    await page.locator('#auction-strategy').selectOption(state.strategies.BURN.toLowerCase());
    await page.locator('#auction-usdg').fill('10,000');
    await expect(page.getByText('Real burn · no manager reward', { exact: true })).toBeVisible();
    const restart = page.getByRole('button', { name: 'Restart expired auction' });
    await expect(restart).toBeEnabled();
    await restart.click();
    await expectConfirmed(page, 'Restart buyback auction');
    const approve = page.getByRole('button', { name: 'Approve exact maximum' });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectConfirmed(page, 'Approve GBX for auction fill');
    const fill = page.getByRole('button', { name: 'Simulate auction fill' });
    await expect(fill).toBeEnabled();
    await fill.click();
    await expectConfirmed(page, 'Buyback reverse Dutch auction fill');

    const burnedAfter = await publicClient.readContract({
      abi: gbxAbi,
      address: state.addresses.gbx,
      functionName: 'cumulativeBurned',
    });
    const supplyAfter = await publicClient.readContract({
      abi: gbxAbi,
      address: state.addresses.gbx,
      functionName: 'totalSupply',
    });
    expect(burnedAfter).toBeGreaterThan(burnedBefore);
    expect(burnedAfter - burnedBefore).toBe(supplyBefore - supplyAfter);
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.assets.USDG,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBe(usdGBefore + BUYBACK_USDG);
  });

  await test.step('in-kind redemption burns GBX and refreshes exact live preview state', async () => {
    const burnedBefore = await publicClient.readContract({
      abi: gbxAbi,
      address: state.addresses.gbx,
      functionName: 'cumulativeBurned',
    });
    const usdGBefore = await publicClient.readContract({
      abi: erc20Abi,
      address: state.assets.USDG,
      args: [state.account],
      functionName: 'balanceOf',
    });
    await navigate(page, 'Redeem', '/redeem');
    const pinnedRedemptionBlock = page.getByText(/^Block \d+ · 0x[0-9a-f]{6}…$/u).first();
    await expect(pinnedRedemptionBlock).toBeVisible();
    const approve = page.getByRole('button', { name: 'Approve exact GBX' });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectConfirmed(page, 'Approve GBX for redemption');
    const redemptionBlockBeforeWrite = await pinnedRedemptionBlock.textContent();
    const redeem = page.getByRole('button', { name: 'Simulate redemption' });
    await expect(redeem).toBeEnabled();
    await redeem.click();
    await expectConfirmed(page, /Redeem .* GBX in kind/);
    await expect(pinnedRedemptionBlock).not.toHaveText(redemptionBlockBeforeWrite ?? '');
    await expect(page.getByText('Confirmed basket receipt', { exact: true })).toBeVisible();
    await expect(page.getByTestId('redemption-receipt-assets').locator('div.divide-y > div')).toHaveCount(9);

    expect(
      await publicClient.readContract({
        abi: gbxAbi,
        address: state.addresses.gbx,
        functionName: 'cumulativeBurned',
      }),
    ).toBe(burnedBefore + REDEMPTION);
    expect(
      await publicClient.readContract({
        abi: erc20Abi,
        address: state.assets.USDG,
        args: [state.account],
        functionName: 'balanceOf',
      }),
    ).toBeGreaterThan(usdGBefore);
  });

  await test.step('typed timelock recovery and a fresh bounded guardian pause both execute onchain', async () => {
    await navigate(page, 'Admin', '/admin');
    await expect(page.getByText('Unsigned disposable fixture', { exact: true })).toBeVisible();
    await expect(page.getByText('Rehearsal asset metadata', { exact: true })).toBeVisible();
    await expect(page.getByTestId('live-admin-operational-status')).toBeVisible();
    await expect(page.locator('[data-testid^="live-admin-strategy-"]')).toHaveCount(9);
    await expect(page.getByTestId('live-timelock-queue')).toBeVisible();
    await expect(page.getByText('No active known unpause operations', { exact: true })).toBeVisible();
    await expect(page.getByText('Issuer status not asserted on testnet', { exact: true })).toBeVisible();
    await expect(page.getByText('Authorized operator', { exact: true })).toBeVisible();
    await expect(page.getByTestId('typed-timelock-workbench').getByText('Proposer', { exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Mining contributions paused' })).toBeDisabled();
    expect(
      await publicClient.readContract({
        abi: miningPoolAbi,
        address: state.addresses.miningPool,
        functionName: 'contributionsPaused',
      }),
    ).toBe(true);

    const queue = page.getByRole('button', { name: 'Queue exact operation' });
    await expect(queue).toBeEnabled();
    await queue.click();
    await expectConfirmed(page, 'Queue unpause mining contributions');
    await expect(page.getByTestId('live-timelock-operation-unpause-mining')).toContainText('pending');
    await increaseTime(48 * 60 * 60 + 1);

    const execute = page.getByRole('button', { name: 'Execute mature operation' });
    await expect(execute).toBeEnabled();
    await expect(page.getByTestId('live-timelock-operation-unpause-mining')).toContainText('matured');
    await execute.click();
    await expectConfirmed(page, 'Execute unpause mining contributions');
    expect(
      await publicClient.readContract({
        abi: miningPoolAbi,
        address: state.addresses.miningPool,
        functionName: 'contributionsPaused',
      }),
    ).toBe(false);

    const pause = page.getByRole('button', { name: 'Pause mining contributions' });
    await expect(pause).toBeEnabled();
    await pause.click();
    await expectConfirmed(page, 'Guardian pause mining');
    expect(
      await publicClient.readContract({
        abi: miningPoolAbi,
        address: state.addresses.miningPool,
        functionName: 'contributionsPaused',
      }),
    ).toBe(true);
  });

  await test.step('contract-enabled routes never substitute deterministic fixture economics', async () => {
    await page.goto('/manage');
    await ensureWalletConnected(page);
    await expectRehearsalTrustCopy(page);
    await expect(page.locator('[data-testid^="strategy-row-"]')).toHaveCount(10);
    await expect(page.locator('[data-testid^="global-strategy-row-"]')).toHaveCount(10);
    await expect(page.locator('[data-testid^="reward-row-"]')).toHaveCount(8);
    await expect(page.getByTestId(`strategy-row-${state.postLaunch.strategy.toLowerCase()}`)).toContainText('LINK');
    await expect(page.getByText('Acquisition settlement preview', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Recent strategy fills', { exact: true })).toBeVisible();
    await expect(page.getByTestId('live-strategy-fill')).toHaveCount(2);
    const linkFill = page.locator(
      `[data-testid="live-strategy-fill"][data-strategy-address="${state.postLaunch.strategy.toLowerCase()}"]`,
    );
    await expect(linkFill.locator('td').nth(0)).toHaveText('LINK');
    await expect(linkFill.locator('td').nth(1)).toHaveText('10K USDG');
    await expect(linkFill.locator('td').nth(2)).toHaveText('50 LINK');
    await expect(linkFill.locator('td').nth(3)).toHaveText('49 LINK');
    await expect(linkFill.locator('td').nth(4)).toHaveText('1 LINK');

    await page.goto('/vault');
    await expect(page.getByTestId('live-vault-backing')).toBeVisible();
    await expect(page.locator('[data-testid^="live-vault-asset-row-"]')).toHaveCount(9);
    await expect(page.locator('[data-testid^="live-vault-strategy-row-"]')).toHaveCount(10);
    await expect(page.getByTestId(`live-vault-asset-row-${state.postLaunch.token.toLowerCase()}`)).toContainText(
      'LINK',
    );
    await expect(page.getByText('9 registered raw balances', { exact: true })).toBeVisible();
    await expect(page.getByText('Vault balance detail unavailable', { exact: true })).toHaveCount(0);
    await expect(page.getByText('RHJ metadata unavailable on testnet', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('10,284.442', { exact: true })).toHaveCount(0);

    await page.goto('/activity');
    await expect(page.getByTestId('live-activity-feed')).toBeVisible();
    await expect(page.getByText('NVDA strategy filled', { exact: true })).toBeVisible();
    await expect(page.getByText('LINK strategy filled', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: new RegExp(`Open transaction 0x${'ab'.repeat(32)}`, 'u') }),
    ).toHaveCount(3);
    await page.getByRole('button', { exact: true, name: 'Mining' }).click();
    await expect(page.getByRole('button', { exact: true, name: 'Mining' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Mining epoch #1 funded', { exact: true })).toBeVisible();
    await expect(page.getByText('NVDA strategy filled', { exact: true })).toHaveCount(0);
    await expect(page.getByText('LINK strategy filled', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { exact: true, name: 'Asset purchases' }).click();
    await expect(page.getByText('NVDA strategy filled', { exact: true })).toBeVisible();
    await expect(page.getByText('LINK strategy filled', { exact: true })).toBeVisible();
    await expect(page.getByText('Mining epoch #1 funded', { exact: true })).toHaveCount(0);

    await page.goto('/trade');
    const poolStateCard = page.getByTestId('live-pool-state-card');
    await expect(poolStateCard).toBeVisible();
    await expect(page.getByText('Pool state unavailable', { exact: true })).toHaveCount(0);
    await expect(statCardByLabel(page, 'Active liquidity').getByText('0', { exact: true })).toBeVisible();
    await expect(statCardByLabel(page, 'Current GBX price')).toBeVisible();
    await expect(page.getByText(/sqrtPriceX96/u)).toHaveCount(0);
    await expect(page.getByText(`Pool 0x7e91…69a0`, { exact: true })).toHaveCount(0);
    const quoteImpact = page
      .getByText('Approximate price impact', { exact: true })
      .locator('..')
      .locator('span')
      .last();
    await page.getByRole('button', { name: 'Refresh exact quote' }).click();
    await expect(page.getByText(/ABI-compatible rehearsal Quoter · block/iu)).toBeVisible();
    await expect(quoteImpact).toHaveText(/\d+(?:\.\d+)?%/u);
    await expect(page.getByText(/not a guarantee, TWAP, oracle price, or execution slippage limit/iu)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open approved Uniswap interface ↗' })).toHaveCount(0);

    await page.getByRole('button', { name: /Switch direction/iu }).click();
    await expect(page.getByText('Sell GBX', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh exact quote' }).click();
    await expect(page.getByText(/ABI-compatible rehearsal Quoter · block/iu)).toBeVisible();
    await expect(quoteImpact).toHaveText(/\d+(?:\.\d+)?%/u);
    await expect(page.getByRole('link', { name: 'Open approved Uniswap interface ↗' })).toHaveCount(0);

    await page.goto('/liquidity');
    await expect(page.getByTestId('live-liquidity-dashboard')).toBeVisible();
    await expect(page.locator('[data-testid^="live-liquidity-position-"]')).toHaveCount(4);
    await expect(page.getByText('Liquidity state unavailable', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'LiquidityManager', exact: true })).toHaveCount(4);
    await expect(statCardByLabel(page, 'Current GBX price')).toBeVisible();
    await expect(statCardByLabel(page, 'Active v4 liquidity').getByText('0', { exact: true })).toBeVisible();
    for (const index of [0, 1, 2, 3]) {
      const position = page.getByTestId(`live-liquidity-position-${index}`);
      await expect(position.locator('td').nth(4)).toHaveText(/[1-9][\d,]*(?:\.\d+)? GBX/u);
      await expect(position.locator('td').nth(5)).toHaveText('0 USDG');
    }

    await page.goto('/');
    const buybackStat = statCardByLabel(page, 'All-time buyback burn');
    await expect(buybackStat).toBeVisible();
    await expect(buybackStat.getByText('50 GBX', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid^="home-live-vault-asset-"]')).toHaveCount(9);
    await expect(page.locator('[data-testid^="home-live-allocation-"]')).toHaveCount(10);
    await expect(page.getByText('Buyback totals unavailable', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Basket composition unavailable', { exact: true })).toHaveCount(0);
    await expect(statCardByLabel(page, 'Active v4 liquidity').getByText('0', { exact: true })).toBeVisible();
    await expect(page.getByTestId('home-live-activity')).toBeVisible();
    await expect(page.getByText('NVDA strategy filled', { exact: true })).toBeVisible();
    await expect(page.getByText('LINK strategy filled', { exact: true })).toBeVisible();

    await page.goto('/admin');
    await expect(page.getByTestId('live-admin-operational-status')).toBeVisible();
    await expect(page.locator('[data-testid^="live-admin-strategy-"]')).toHaveCount(9);
    await expect(page.getByTestId('live-timelock-queue')).toBeVisible();
    await expect(page.getByText('Historical queue events are not indexed', { exact: true })).toBeVisible();
    await expect(page.getByText('Queued actions unavailable', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Preview enabled', { exact: true })).toHaveCount(0);
  });
});
