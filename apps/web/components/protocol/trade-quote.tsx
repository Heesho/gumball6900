'use client';

import { canonicalPoolKey, pinBlockSnapshot, readCanonicalV4ExactInputQuote } from '@gumball-6900/sdk';
import { Badge, Button, Card, Field, Notice, TokenMark } from '@gumball-6900/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePublicClient } from 'wagmi';

import { formatBps, formatToken, formatUnits } from '../../lib/format';
import { parseInputAmount } from '../../lib/transactions';
import { approvedUniswapSwapUrl } from '../../lib/uniswap-link';
import { useRuntimeDeployment } from './runtime-context';

type TradeDirection = 'USDG_TO_GBX' | 'GBX_TO_USDG';

interface QuoteState {
  phase: 'idle' | 'loading' | 'success' | 'error';
  amountOutRaw: bigint;
  blockNumber: bigint;
  gasEstimate: bigint;
  impactBps: bigint;
  rateWad: bigint;
  message: string | null;
}

const initialQuote: QuoteState = {
  phase: 'idle',
  amountOutRaw: 0n,
  blockNumber: 0n,
  gasEstimate: 0n,
  impactBps: 0n,
  rateWad: 0n,
  message: null,
};

function normalizedWad(amountRaw: bigint, decimals: number): bigint {
  if (decimals > 18) throw new RangeError('Trade display supports token decimals up to 18');
  return amountRaw * 10n ** BigInt(18 - decimals);
}

function effectiveRateWad(amountInRaw: bigint, inputDecimals: number, amountOutRaw: bigint, outputDecimals: number) {
  const inputWad = normalizedWad(amountInRaw, inputDecimals);
  const outputWad = normalizedWad(amountOutRaw, outputDecimals);
  return inputWad === 0n ? 0n : (outputWad * 10n ** 18n) / inputWad;
}

export function TradeQuotePanel() {
  const runtime = useRuntimeDeployment();
  const testnetCandidate = runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate';
  const publicClient = usePublicClient();
  const [direction, setDirection] = useState<TradeDirection>('USDG_TO_GBX');
  const [amountText, setAmountText] = useState('10,000');
  const [quote, setQuote] = useState<QuoteState>(initialQuote);
  const quoteRequestVersion = useRef(0);
  const inputSymbol = direction === 'USDG_TO_GBX' ? 'USDG' : 'GBX';
  const outputSymbol = direction === 'USDG_TO_GBX' ? 'GBX' : 'USDG';
  const inputMetadata = runtime.assetMetadata[inputSymbol];
  const outputMetadata = runtime.assetMetadata[outputSymbol];
  const parsed = useMemo(() => {
    try {
      return {
        amountRaw: parseInputAmount(amountText, inputMetadata?.decimals ?? (inputSymbol === 'USDG' ? 6 : 18)),
        error: null,
      };
    } catch (error) {
      return { amountRaw: 0n, error: error instanceof Error ? error.message : 'Enter a valid token amount.' };
    }
  }, [amountText, inputMetadata?.decimals, inputSymbol]);

  useEffect(
    () => () => {
      quoteRequestVersion.current += 1;
    },
    [],
  );

  function invalidateQuote() {
    quoteRequestVersion.current += 1;
    setQuote(initialQuote);
  }

  async function refreshQuote() {
    if (
      runtime.mode !== 'live' ||
      publicClient === undefined ||
      inputMetadata === undefined ||
      outputMetadata === undefined ||
      parsed.amountRaw <= 0n
    ) {
      return;
    }
    const requestVersion = quoteRequestVersion.current + 1;
    quoteRequestVersion.current = requestVersion;
    setQuote({ ...initialQuote, phase: 'loading' });
    try {
      const poolKey = canonicalPoolKey(runtime.assets.GBX, runtime.assets.USDG, runtime.addresses.launchGuardHook, {
        chainId: runtime.chain.id,
        gbxDecimals: runtime.assetMetadata.GBX.decimals,
        usdGDecimals: runtime.assetMetadata.USDG.decimals,
      });
      const blockSnapshot = await pinBlockSnapshot(publicClient);
      const probeAmountRaw = 10n ** BigInt(inputMetadata.decimals);
      const parameters = {
        quoter: runtime.externalContracts.quoter.address,
        poolKey,
        inputCurrency: inputMetadata.address,
        inputDecimals: inputMetadata.decimals,
        outputDecimals: outputMetadata.decimals,
        atBlock: blockSnapshot.blockNumber,
        expectedBlockHash: blockSnapshot.blockHash,
      } as const;
      const [requested, probe] = await Promise.all([
        readCanonicalV4ExactInputQuote(publicClient, { ...parameters, exactAmountRaw: parsed.amountRaw }),
        readCanonicalV4ExactInputQuote(publicClient, { ...parameters, exactAmountRaw: probeAmountRaw }),
      ]);
      if (requestVersion !== quoteRequestVersion.current) return;
      if (requested.blockNumber !== blockSnapshot.blockNumber || probe.blockNumber !== blockSnapshot.blockNumber) {
        throw new Error('The requested quote and spot probe did not match their shared block snapshot.');
      }
      const requestedRate = effectiveRateWad(
        requested.amountInRaw,
        requested.inputDecimals,
        requested.amountOutRaw,
        requested.outputDecimals,
      );
      const probeRate = effectiveRateWad(
        probe.amountInRaw,
        probe.inputDecimals,
        probe.amountOutRaw,
        probe.outputDecimals,
      );
      const impactBps =
        probeRate > requestedRate && probeRate !== 0n ? ((probeRate - requestedRate) * 10_000n) / probeRate : 0n;
      setQuote({
        phase: 'success',
        amountOutRaw: requested.amountOutRaw,
        blockNumber: requested.blockNumber,
        gasEstimate: requested.gasEstimate,
        impactBps,
        rateWad: requestedRate,
        message: null,
      });
    } catch (error) {
      if (requestVersion !== quoteRequestVersion.current) return;
      setQuote({
        ...initialQuote,
        phase: 'error',
        message: error instanceof Error ? error.message : 'The verified v4 Quoter request failed.',
      });
    }
  }

  const externalSwapUrl =
    runtime.mode === 'live' &&
    runtime.manifest?.complianceMode === 'unrestricted-production-approved' &&
    inputMetadata !== undefined &&
    outputMetadata !== undefined
      ? approvedUniswapSwapUrl(
          runtime.chain.id,
          inputMetadata.address,
          outputMetadata.address,
          amountText.trim().replaceAll(',', ''),
        )
      : null;

  return (
    <Card className="p-5 sm:p-7" tone="highlight">
      <div className="flex items-center justify-between gap-4">
        <Badge
          tone={
            runtime.mode === 'live' && runtime.runtimeKind === 'production'
              ? 'positive'
              : runtime.mode === 'live'
                ? 'info'
                : 'warning'
          }
        >
          {direction === 'USDG_TO_GBX' ? 'Buy GBX' : 'Sell GBX'}
        </Badge>
        <button
          className="flex min-h-11 items-center px-2 text-xs font-semibold text-[#8bf8ea]"
          onClick={() => {
            setDirection((current) => (current === 'USDG_TO_GBX' ? 'GBX_TO_USDG' : 'USDG_TO_GBX'));
            invalidateQuote();
          }}
          type="button"
        >
          Switch direction ↕
        </button>
      </div>

      <div className="mt-7 rounded-2xl border border-white/8 bg-[#0a1011]/80 p-4">
        <label className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#657373]" htmlFor="swap-input">
          You pay
        </label>
        <div className="mt-3 flex items-center gap-3">
          <Field
            className="border-0 bg-transparent px-0 text-2xl shadow-none focus:ring-0"
            id="swap-input"
            inputMode="decimal"
            onChange={(event) => {
              setAmountText(event.target.value);
              invalidateQuote();
            }}
            value={amountText}
          />
          <div className="flex items-center gap-2 rounded-full border border-white/9 bg-white/[0.05] py-1.5 pl-1.5 pr-3">
            <TokenMark color={inputSymbol === 'USDG' ? '#67f5e4' : '#ff6ca3'} size="sm" symbol={inputSymbol} />
            <span className="text-sm font-semibold">{inputSymbol}</span>
          </div>
        </div>
        {parsed.error !== null ? <p className="mt-2 text-[0.68rem] text-[#f1c67e]">{parsed.error}</p> : null}
      </div>

      <div className="relative my-2 flex justify-center">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-white/8 bg-[#111819] text-sm text-[#829190]">
          ↓
        </span>
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#0a1011]/80 p-4">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#657373]">You receive</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-2xl font-semibold tracking-[-0.04em] text-white tabular-nums">
            {quote.phase === 'success' && outputMetadata !== undefined
              ? formatUnits(quote.amountOutRaw, outputMetadata.decimals, {
                  maximumFractionDigits: Math.min(outputMetadata.decimals, 8),
                })
              : '—'}
          </p>
          <div className="flex items-center gap-2 rounded-full border border-white/9 bg-white/[0.05] py-1.5 pl-1.5 pr-3">
            <TokenMark color={outputSymbol === 'USDG' ? '#67f5e4' : '#ff6ca3'} size="sm" symbol={outputSymbol} />
            <span className="text-sm font-semibold">{outputSymbol}</span>
          </div>
        </div>
        <p className="mt-2 text-[0.68rem] text-[#657373]">
          {quote.phase === 'success'
            ? `${
                runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal'
                  ? 'ABI-compatible rehearsal Quoter'
                  : testnetCandidate
                    ? 'Manifest-bound testnet Quoter'
                    : 'Official v4 Quoter'
              } · block ${quote.blockNumber.toString()}`
            : 'No fallback quote can authorize a trade'}
        </p>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-white/7 bg-white/[0.02] p-4 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-[#718080]">Effective output rate</span>
          <span className="font-semibold text-white">
            {quote.phase === 'success'
              ? `${formatUnits(quote.rateWad, 18, { maximumFractionDigits: 8 })} ${outputSymbol}/${inputSymbol}`
              : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#718080]">Approximate price impact</span>
          <span className="font-semibold text-[#f5d18c]">
            {quote.phase === 'success' ? formatBps(quote.impactBps, 2) : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#718080]">Pool fee</span>
          <span className="font-semibold text-white">0.30%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#718080]">Route</span>
          <span className="font-semibold text-white">
            {testnetCandidate ? 'One manifest-bound candidate v4 pool' : 'One canonical v4 pool'}
          </span>
        </div>
      </div>

      {quote.phase === 'error' ? (
        <Notice
          className="mt-4"
          title={
            runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal'
              ? 'Rehearsal quote unavailable'
              : runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate'
                ? 'Testnet-candidate quote unavailable'
                : 'Production quote unavailable'
          }
          tone="warning"
        >
          {quote.message}
        </Notice>
      ) : null}
      <Button
        className="mt-6 w-full"
        disabled={
          runtime.mode !== 'live' || publicClient === undefined || parsed.amountRaw <= 0n || quote.phase === 'loading'
        }
        onClick={() => void refreshQuote()}
        size="lg"
      >
        {runtime.mode !== 'live'
          ? 'Validated deployment required'
          : quote.phase === 'loading'
            ? 'Reading v4 Quoter…'
            : 'Refresh exact quote'}
      </Button>
      {externalSwapUrl !== null && quote.phase === 'success' ? (
        <a
          className="mt-3 block rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-[#8bf8ea]"
          href={externalSwapUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open approved Uniswap interface ↗
        </a>
      ) : null}
      {runtime.mode === 'live' && runtime.manifest?.complianceMode === 'permissioned-production' ? (
        <Notice className="mt-3" title="Permissioned execution is not bound" tone="warning">
          Quotes are informational only. This client exposes no execution handoff until the validated successor graph
          binds its permissioned router, hook, wrappers, and onboarding evidence.
        </Notice>
      ) : null}
      <p className="mt-4 text-[0.68rem] leading-5 text-[#657373]">
        Approximate price impact compares this trade&apos;s effective output rate with a one-token spot probe at the
        same block. It is a quote-size estimate, not a guarantee, TWAP, oracle price, or execution slippage limit. This
        client does not hand-roll Universal Router calldata. Runtime validation pins Quoter and router addresses. On
        canonical mainnet, execution is handed to the official Uniswap interface only when the manifest explicitly
        records unrestricted-production approval. Permissioned production and remote testnet candidates provide no
        handoff. Neither a local rehearsal fixture nor a remote testnet candidate establishes production signer trust.
      </p>
      {quote.phase === 'success' ? (
        <p className="mt-2 text-[0.66rem] text-[#5f6e6e]">
          Quoter gas estimate {formatToken(quote.gasEstimate, 'gas', 0, 0)}
        </p>
      ) : null}
    </Card>
  );
}
