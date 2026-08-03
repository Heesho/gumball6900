'use client';

import {
  buildAcquisitionFill,
  buildBuybackFill,
  buildRestartAcquisitionAuction,
  buildRestartBuybackAuction,
} from '@gumball-6900/sdk';
import { Badge, Button, Card, Field, Notice, SectionHeading } from '@gumball-6900/ui';
import { useState } from 'react';
import type { Address } from 'viem';
import { useAccount } from 'wagmi';

import { useLiveProtocolOverview } from '../../hooks/use-live-protocol-overview';
import { useAllowance, useAuctionRead } from '../../hooks/use-protocol-reads';
import { useProtocolTransaction } from '../../hooks/use-protocol-transaction';
import {
  assertAuctionFillPreflight,
  assertAuctionRestartPreflight,
  FinancialPreflightError,
} from '../../lib/financial-preflight';
import { CANONICAL_USDG_DECIMALS, GBX_DECIMALS, formatAddress, formatToken, formatUnits } from '../../lib/format';
import { registryTestId } from '../../lib/registry-presentation';
import { buildErc20Approval, parseInputAmount } from '../../lib/transactions';
import type { LiveRuntimeDeployment } from '../../lib/runtime-types';
import { useRuntimeDeployment } from './runtime-context';
import { guardedActionLabel, TransactionGuard, TransactionStatus } from './transaction-state';

const demoFillSymbols = ['WETH', 'WBTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL', 'BURN'] as const;

interface AuctionOption {
  readonly key: string;
  readonly kind: 'acquisition' | 'buyback';
  readonly strategy: Address | undefined;
  readonly symbol: string;
  readonly targetDecimals: number;
  readonly targetToken: Address | undefined;
}

function liveAuctionOptions(
  runtime: LiveRuntimeDeployment,
  overview: ReturnType<typeof useLiveProtocolOverview>['data'],
): readonly AuctionOption[] {
  if (overview === undefined) return [];
  return overview.strategies.flatMap((row): readonly AuctionOption[] => {
    if (row.kind === 'buyback') {
      if (row.genesisSymbol !== 'BURN' || row.strategy.toLowerCase() !== runtime.strategies.BURN.toLowerCase()) {
        return [];
      }
      return [
        {
          key: row.strategy.toLowerCase(),
          kind: 'buyback',
          strategy: row.strategy,
          symbol: row.symbol,
          targetDecimals: runtime.assetMetadata.GBX.decimals,
          targetToken: runtime.assets.GBX,
        },
      ];
    }
    if (row.kind !== 'acquisition') return [];
    const asset = overview.assets.find(
      (candidate) =>
        candidate.token.toLowerCase() === row.token.toLowerCase() &&
        candidate.strategy.toLowerCase() === row.strategy.toLowerCase(),
    );
    if (asset === undefined) return [];
    return [
      {
        key: row.strategy.toLowerCase(),
        kind: 'acquisition',
        strategy: row.strategy,
        symbol: asset.symbol,
        targetDecimals: asset.decimals,
        targetToken: asset.token,
      },
    ];
  });
}

export function AuctionFillPanel() {
  const runtime = useRuntimeDeployment();
  const overview = useLiveProtocolOverview();
  const account = useAccount();
  const transaction = useProtocolTransaction();
  const [selectionKey, setSelectionKey] = useState('NVDA');
  const [usdgText, setUsdgText] = useState('25,000');
  const [maximumPaymentText, setMaximumPaymentText] = useState('250');
  const usdGDecimals = runtime.assetMetadata.USDG?.decimals ?? CANONICAL_USDG_DECIMALS;
  const options: readonly AuctionOption[] =
    runtime.mode === 'live'
      ? liveAuctionOptions(runtime, overview.data)
      : demoFillSymbols.map((symbol) => ({
          key: symbol,
          kind: symbol === 'BURN' ? ('buyback' as const) : ('acquisition' as const),
          strategy: undefined,
          symbol,
          targetDecimals:
            symbol === 'BURN'
              ? (runtime.assetMetadata.GBX?.decimals ?? GBX_DECIMALS)
              : (runtime.assetMetadata[symbol]?.decimals ?? 18),
          targetToken: undefined,
        }));
  const selected =
    options.find((option) => option.key.toLowerCase() === selectionKey.toLowerCase()) ??
    (runtime.mode === 'live'
      ? options.find((option) => option.strategy?.toLowerCase() === runtime.strategies.NVDA.toLowerCase())
      : options.find((option) => option.symbol === 'NVDA')) ??
    options[0];
  const symbol = selected?.symbol ?? 'NVDA';
  const kind = selected?.kind ?? 'acquisition';
  const targetDecimals = selected?.targetDecimals ?? 18;
  const amounts = (() => {
    try {
      return {
        usdGAmountRaw: parseInputAmount(usdgText, usdGDecimals),
        maximumTargetAmountRaw: parseInputAmount(maximumPaymentText, targetDecimals),
        error: null,
      };
    } catch (error) {
      return {
        usdGAmountRaw: 0n,
        maximumTargetAmountRaw: 0n,
        error: error instanceof Error ? error.message : 'Enter valid amounts.',
      };
    }
  })();
  const strategy = runtime.mode === 'live' ? selected?.strategy : undefined;
  const targetToken = runtime.mode === 'live' ? selected?.targetToken : undefined;
  const allowance = useAllowance(targetToken, strategy, amounts.maximumTargetAmountRaw);
  const auctionSelection = strategy === undefined ? undefined : { kind, strategy };
  const auction = useAuctionRead(auctionSelection, amounts.usdGAmountRaw);
  const auctionSourceLabel =
    auction.source === 'live'
      ? `Block ${auction.blockNumber?.toString() ?? '?'} · ${auction.blockHash?.slice(0, 8) ?? '?'}…`
      : auction.source.replaceAll('-', ' ');
  const auctionExpired = auction.source === 'live' && auction.quote?.isExpired === true;
  const quoteError = (() => {
    if (auction.quote === null) return null;
    try {
      assertAuctionFillPreflight(auction.quote, amounts.maximumTargetAmountRaw);
      return null;
    } catch (error) {
      return error instanceof FinancialPreflightError ? error.userMessage : 'The pinned auction quote is unavailable.';
    }
  })();

  async function approve() {
    if (
      targetToken === undefined ||
      strategy === undefined ||
      amounts.maximumTargetAmountRaw <= 0n ||
      auction.source !== 'live'
    )
      return;
    const hash = await transaction.submit(
      async () => {
        const fresh = await auction.refetch();
        assertAuctionFillPreflight(fresh, amounts.maximumTargetAmountRaw);
        return buildErc20Approval(targetToken, strategy, amounts.maximumTargetAmountRaw);
      },
      `Approve ${kind === 'buyback' ? 'GBX' : symbol} for auction fill`,
      { errorTarget: targetToken, validatedErrorContractKind: 'erc20' },
    );
    if (hash !== null) await allowance.refetch();
  }

  async function fill() {
    if (
      strategy === undefined ||
      account.address === undefined ||
      auction.source !== 'live' ||
      auction.auctionId === null
    ) {
      return;
    }
    const receiver = account.address;
    await transaction.submit(
      async () => {
        const fresh = await auction.refetch();
        assertAuctionFillPreflight(fresh, amounts.maximumTargetAmountRaw);
        const parameters = {
          strategy,
          expectedAuctionId: fresh.auctionId,
          usdGAmountRaw: amounts.usdGAmountRaw,
          maximumTargetAmountRaw: amounts.maximumTargetAmountRaw,
          usdGReceiver: receiver,
          deadline: fresh.blockTimestamp + 1_200n,
        };
        return kind === 'buyback' ? buildBuybackFill(parameters) : buildAcquisitionFill(parameters);
      },
      `${kind === 'buyback' ? 'Buyback' : symbol} reverse Dutch auction fill`,
      {
        errorTarget: strategy,
        validatedErrorContractKind: kind === 'buyback' ? 'buyback-strategy' : 'acquisition-strategy',
        onConfirmedReceipt: async () => {
          await Promise.allSettled([auction.refetch(), allowance.refetch()]);
        },
      },
    );
  }

  async function restart() {
    if (strategy === undefined || auction.source !== 'live' || !auctionExpired) return;
    await transaction.submit(
      async () => {
        const fresh = await auction.refetch();
        assertAuctionRestartPreflight(fresh);
        return kind === 'buyback' ? buildRestartBuybackAuction(strategy) : buildRestartAcquisitionAuction(strategy);
      },
      kind === 'buyback' ? 'Restart buyback auction' : `Restart ${symbol} acquisition auction`,
      {
        errorTarget: strategy,
        validatedErrorContractKind: kind === 'buyback' ? 'buyback-strategy' : 'acquisition-strategy',
        onConfirmedReceipt: async () => {
          await auction.refetch();
        },
      },
    );
  }

  return (
    <Card className="mt-5 p-5 sm:p-7" tone="highlight">
      <SectionHeading
        action={<Badge tone={auction.source === 'live' ? 'positive' : 'warning'}>{auctionSourceLabel}</Badge>}
        description="Permissionless takers deliver the selected target asset and receive USDG. The full quote is pinned to one block hash, revalidated, and refreshed immediately before simulation."
        eyebrow="Oracleless strategy execution"
        title="Reverse Dutch auction fill"
      />
      <div className="mt-7 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <div>
          <label className="text-xs font-semibold text-[#aab6b5]" htmlFor="auction-strategy">
            Strategy
          </label>
          <select
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#0b1112] px-4 text-sm font-semibold text-white outline-none focus:border-[#67f5e4]/55"
            id="auction-strategy"
            onChange={(event) => setSelectionKey(event.target.value)}
            value={selected?.key ?? ''}
          >
            {options.map((option) => (
              <option
                data-testid={registryTestId('auction-strategy-option', option.strategy ?? option.key)}
                key={option.key}
                value={option.key}
              >
                {option.kind === 'buyback'
                  ? 'GBX buyback + real burn'
                  : `Accumulate ${option.symbol}${option.strategy === undefined ? '' : ` · ${formatAddress(option.strategy)}`}`}
              </option>
            ))}
          </select>
          {runtime.mode === 'live' && overview.data === undefined ? (
            <Notice className="mt-4" title="Strategy registry unavailable" tone="warning">
              Auction targets remain disabled until the complete bounded Lens registry is available from a validated
              block.
            </Notice>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-[#aab6b5]" htmlFor="auction-usdg">
                USDG requested
              </label>
              <Field
                className="mt-2"
                id="auction-usdg"
                inputMode="decimal"
                onChange={(event) => setUsdgText(event.target.value)}
                value={usdgText}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#aab6b5]" htmlFor="auction-payment">
                Maximum {kind === 'buyback' ? 'GBX' : symbol} payment
              </label>
              <Field
                className="mt-2"
                id="auction-payment"
                inputMode="decimal"
                onChange={(event) => setMaximumPaymentText(event.target.value)}
                value={maximumPaymentText}
              />
            </div>
          </div>
          {amounts.error !== null ? <p className="mt-2 text-[0.68rem] text-[#f1c67e]">{amounts.error}</p> : null}
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/7 bg-[#0a1112]/70 p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.13em] text-[#657373]">Auction ID</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {auction.auctionId === null ? 'Unavailable' : `#${auction.auctionId.toString()}`}
              </p>
            </div>
            <div className="rounded-2xl border border-white/7 bg-[#0a1112]/70 p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.13em] text-[#657373]">
                {kind === 'buyback' ? 'GBX' : symbol} per USDG rate
              </p>
              <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                {auction.currentRate === null
                  ? 'Unavailable'
                  : formatUnits(auction.currentRate, 18, { maximumFractionDigits: 6 })}
              </p>
            </div>
            <div className="rounded-2xl border border-white/7 bg-[#0a1112]/70 p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.13em] text-[#657373]">USDG output</p>
              <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                {formatToken(amounts.usdGAmountRaw, 'USDG', 2, usdGDecimals)}
              </p>
            </div>
          </div>
          {quoteError !== null ? <p className="text-[0.68rem] text-[#f1c67e]">{quoteError}</p> : null}
          <Notice title={kind === 'buyback' ? 'Real burn · no manager reward' : 'Immutable 98 / 2 settlement'}>
            {kind === 'buyback'
              ? 'Accepted GBX is burned through token supply accounting. The strategy pays no manager reward.'
              : 'Exactly 98% of target assets goes to GumBallVault and 2% goes to managers with effective active weight at settlement.'}
          </Notice>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              disabled={
                transaction.readiness !== 'ready' ||
                transaction.isBusy ||
                amounts.maximumTargetAmountRaw <= 0n ||
                !allowance.needsApproval ||
                quoteError !== null ||
                auction.source !== 'live'
              }
              onClick={() => void approve()}
              variant="secondary"
            >
              Approve exact maximum
            </Button>
            <Button
              disabled={
                transaction.readiness !== 'ready' ||
                transaction.isBusy ||
                amounts.usdGAmountRaw <= 0n ||
                amounts.maximumTargetAmountRaw <= 0n ||
                allowance.needsApproval ||
                quoteError !== null ||
                auction.source !== 'live'
              }
              onClick={() => void fill()}
            >
              {guardedActionLabel(transaction.readiness, 'Simulate auction fill', 'Processing…', transaction.isBusy)}
            </Button>
            <Button
              disabled={
                transaction.readiness !== 'ready' || transaction.isBusy || !auctionExpired || strategy === undefined
              }
              onClick={() => void restart()}
              variant="secondary"
            >
              Restart expired auction
            </Button>
          </div>
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
