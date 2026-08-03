import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CanonicalV4ExactInputQuote } from '@gumball-6900/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TradeQuotePanel } from '../components/protocol/trade-quote';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { liveRuntimeFixture } from './live-runtime-fixture';

const mocked = vi.hoisted(() => {
  const blockHash = `0x${'ab'.repeat(32)}` as const;
  return {
    blockHash,
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber?: bigint } = {}) => ({
      hash: blockHash,
      number: blockNumber ?? 777n,
    })),
    readQuote: vi.fn(),
  };
});

vi.mock('@gumball-6900/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gumball-6900/sdk')>()),
  readCanonicalV4ExactInputQuote: mocked.readQuote,
}));

vi.mock('wagmi', () => ({
  usePublicClient: () => ({ getBlock: mocked.getBlock }),
}));

interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let reject!: (reason: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, reject, resolve };
}

function quote(amountInRaw: bigint, amountOutRaw: bigint): CanonicalV4ExactInputQuote {
  return {
    amountInRaw,
    amountOutRaw,
    blockNumber: 777n,
    gasEstimate: 100_000n,
    inputCurrency: liveRuntimeFixture.assets.USDG,
    inputDecimals: 6,
    outputCurrency: liveRuntimeFixture.assets.GBX,
    outputDecimals: 18,
    zeroForOne: false,
  };
}

function renderPanel() {
  return render(
    <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
      <TradeQuotePanel />
    </RuntimeDeploymentProvider>,
  );
}

describe('trade quote request invalidation', () => {
  beforeEach(() => {
    mocked.getBlock.mockClear();
    mocked.readQuote.mockReset();
  });

  it('labels the quote-size comparison as approximate price impact at one block number and hash', async () => {
    mocked.readQuote
      .mockResolvedValueOnce(quote(10_000n * 10n ** 6n, 8_000n * 10n ** 18n))
      .mockResolvedValueOnce(quote(1n * 10n ** 6n, 9n * 10n ** 17n));
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh exact quote' }));
    await waitFor(() => expect(screen.getByText(/Official v4 Quoter/iu)).toBeDefined());

    expect(screen.getByText('Approximate price impact')).toBeDefined();
    expect(screen.getByText('11.11%')).toBeDefined();
    expect(screen.getByText(/not a guarantee, TWAP, oracle price, or execution slippage limit/iu)).toBeDefined();
    expect(mocked.getBlock).toHaveBeenCalledTimes(1);
    const quoteParameters = mocked.readQuote.mock.calls.map(([, parameters]) => parameters);
    expect(quoteParameters.map(({ exactAmountRaw }) => exactAmountRaw)).toEqual([10_000n * 10n ** 6n, 10n ** 6n]);
    for (const parameters of quoteParameters) {
      expect(parameters).toMatchObject({ atBlock: 777n, expectedBlockHash: mocked.blockHash });
    }
    expect(screen.getByText('Permissioned execution is not bound')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Open approved Uniswap interface/iu })).toBeNull();
  });

  it('fails closed if either quote result does not report the shared pinned block', async () => {
    mocked.readQuote
      .mockResolvedValueOnce(quote(10_000n * 10n ** 6n, 8_000n * 10n ** 18n))
      .mockResolvedValueOnce({ ...quote(1n * 10n ** 6n, 9n * 10n ** 17n), blockNumber: 778n });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh exact quote' }));
    await waitFor(() => expect(screen.getByText('Production quote unavailable')).toBeDefined());

    expect(screen.getByText(/did not match their shared block snapshot/iu)).toBeDefined();
    expect(screen.queryByText(/Official v4 Quoter/iu)).toBeNull();
    expect(screen.queryByRole('link', { name: /Open approved Uniswap interface/iu })).toBeNull();
  });

  it('ignores an old successful quote after the amount changes', async () => {
    const requested = deferred<CanonicalV4ExactInputQuote>();
    const probe = deferred<CanonicalV4ExactInputQuote>();
    mocked.readQuote.mockImplementationOnce(() => requested.promise).mockImplementationOnce(() => probe.promise);
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh exact quote' }));
    await waitFor(() => expect(mocked.readQuote).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('You pay'), { target: { value: '20,000' } });

    await act(async () => {
      requested.resolve(quote(10_000n * 10n ** 6n, 9_000n * 10n ** 18n));
      probe.resolve(quote(1n * 10n ** 6n, 9n * 10n ** 17n));
      await Promise.all([requested.promise, probe.promise]);
    });

    expect(screen.getByText('No fallback quote can authorize a trade')).toBeDefined();
    expect(screen.queryByText(/Official v4 Quoter/iu)).toBeNull();
    expect(screen.queryByRole('link', { name: /Open approved Uniswap interface/iu })).toBeNull();
  });

  it('ignores an old quote error after the direction changes', async () => {
    const requested = deferred<CanonicalV4ExactInputQuote>();
    const probe = deferred<CanonicalV4ExactInputQuote>();
    mocked.readQuote.mockImplementationOnce(() => requested.promise).mockImplementationOnce(() => probe.promise);
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh exact quote' }));
    await waitFor(() => expect(mocked.readQuote).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: /Switch direction/iu }));

    await act(async () => {
      requested.reject(new Error('stale RPC failure'));
      probe.resolve(quote(1n * 10n ** 6n, 9n * 10n ** 17n));
      await Promise.allSettled([requested.promise, probe.promise]);
    });

    expect(screen.getByText('Sell GBX')).toBeDefined();
    expect(screen.getByText('No fallback quote can authorize a trade')).toBeDefined();
    expect(screen.queryByText('Production quote unavailable')).toBeNull();
    expect(screen.queryByText('stale RPC failure')).toBeNull();
  });
});
