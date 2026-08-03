'use client';

import { buildRedemption, decodeRedemptionReceipt, WAD, type DecodedRedemptionReceipt } from '@gumball-6900/sdk';
import { Badge, Button, Card, Field, Notice, SectionHeading, TokenMark } from '@gumball-6900/ui';
import { useMemo, useState } from 'react';
import { getAddress, isAddress, type Address } from 'viem';
import { useAccount } from 'wagmi';

import { useAllowance, useRedemptionPreview } from '../../hooks/use-protocol-reads';
import { useProtocolTransaction } from '../../hooks/use-protocol-transaction';
import { useRhjMetadata } from '../../hooks/use-rhj-metadata';
import { formatAddress, formatRatioPercent, formatToken, formatUnits } from '../../lib/format';
import { vaultAssets } from '../../lib/read-model';
import { registryPresentation, registryTestId } from '../../lib/registry-presentation';
import { buildErc20Approval, parseInputAmount } from '../../lib/transactions';
import { resolveUiAdjustedExposure } from '../../lib/ui-adjusted-exposure';
import { useRuntimeDeployment } from './runtime-context';
import { guardedActionLabel, TransactionGuard, TransactionStatus } from './transaction-state';

export interface RedemptionReceiptRow {
  readonly token: Address;
  readonly symbol: string;
  readonly decimals: number;
  readonly amountRaw: bigint;
}

export function verifyRedemptionReceipt(
  decoded: DecodedRedemptionReceipt,
  expected: Readonly<{
    expectedAssets: readonly Address[];
    expectedOwner: Address;
    expectedReceiver: Address;
    expectedShares: bigint;
  }>,
): void {
  if (decoded.owner.toLowerCase() !== expected.expectedOwner.toLowerCase())
    throw new Error('Unexpected redemption owner');
  if (decoded.receiver.toLowerCase() !== expected.expectedReceiver.toLowerCase()) {
    throw new Error('Unexpected redemption receiver');
  }
  if (decoded.shares !== expected.expectedShares) throw new Error('Unexpected redeemed share amount');
  const actualTokens = decoded.amounts.map(({ token }) => token.toLowerCase()).sort();
  const expectedTokens = expected.expectedAssets.map((token) => token.toLowerCase()).sort();
  if (
    actualTokens.length !== expectedTokens.length ||
    actualTokens.some((token, index) => token !== expectedTokens[index])
  ) {
    throw new Error('Receipt asset set does not match the previewed basket');
  }
}

export function redemptionReceiptRows(
  decoded: DecodedRedemptionReceipt,
  expectedOutputs: readonly Readonly<{ decimals: number; symbol: string; token: Address }>[],
): readonly RedemptionReceiptRow[] {
  return decoded.amounts.map(({ amountRaw, token }) => {
    const expected = expectedOutputs.find((candidate) => candidate.token.toLowerCase() === token.toLowerCase());
    if (expected === undefined) throw new Error(`Receipt token ${token} is absent from the pinned asset registry`);
    return { amountRaw, decimals: expected.decimals, symbol: expected.symbol, token };
  });
}

export interface RedemptionBasketPreviewProps {
  readonly outputs: readonly Readonly<{
    amount: bigint;
    decimals: number;
    isStockToken: boolean;
    symbol: string;
    token: string;
  }>[];
  readonly source: 'demo' | 'live' | 'live-loading' | 'rpc-fallback';
}

export function RedemptionBasketPreview({ outputs, source }: RedemptionBasketPreviewProps) {
  const runtime = useRuntimeDeployment();
  const rhj = useRhjMetadata();
  const hasLiveStockOutputs = runtime.mode === 'live' && outputs.some(({ isStockToken }) => isStockToken);

  return (
    <Card className="p-5 sm:p-7">
      <SectionHeading
        action={<Badge tone={source === 'live' ? 'positive' : 'info'}>Exact raw preview</Badge>}
        description="One atomic redemption delivers multiple ERC-20 tokens. Stock-token uiMultiplier affects display exposure only, never raw contract output."
        eyebrow="Basket output"
        title="Assets you receive"
      />
      {runtime.mode === 'live' && source !== 'live' ? (
        <Notice className="mt-5" title="Redemption outputs unavailable" tone="warning">
          Exact lens outputs are required before any basket amount is displayed. Demo vault balances are not used as a
          fallback.
        </Notice>
      ) : null}
      {hasLiveStockOutputs && rhj.source === 'stale' ? (
        <Notice className="mt-5" title="Adjusted preview uses an older verified multiplier snapshot" tone="warning">
          Raw redemption outputs remain the current pinned Lens result. Adjusted stock-token exposure is display-only
          and labeled stale because the latest RHJ refresh failed.
        </Notice>
      ) : null}
      <div className="mt-7 divide-y divide-white/6">
        {outputs.map((output) => {
          const asset =
            runtime.mode === 'demo' ? vaultAssets.find(({ symbol }) => symbol === output.symbol) : undefined;
          const decimals = output.decimals;
          const isLiveStockToken = runtime.mode === 'live' && output.isStockToken;
          const liveAdjusted =
            isLiveStockToken && isAddress(output.token, { strict: false })
              ? resolveUiAdjustedExposure(output.amount, getAddress(output.token), output.symbol, rhj.data?.assets)
              : null;
          const demoAdjusted = asset === undefined ? null : (output.amount * asset.multiplierWad) / WAD;
          return (
            <div
              className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto_auto]"
              data-testid={registryTestId('redemption-preview', output.token)}
              key={output.token}
            >
              <div className="flex items-center gap-3">
                <TokenMark
                  color={
                    asset?.color ??
                    (isAddress(output.token, { strict: false })
                      ? registryPresentation(output.symbol, getAddress(output.token)).color
                      : '#8a9999')
                  }
                  size="sm"
                  symbol={output.symbol}
                />
                <div>
                  <p className="text-sm font-semibold text-[#dce5e3]">{output.symbol}</p>
                  <p className="mt-0.5 text-[0.66rem] text-[#657373]">Raw ERC-20 amount</p>
                </div>
              </div>
              <p
                className="text-sm font-semibold text-white tabular-nums"
                title={formatUnits(output.amount, decimals, { maximumFractionDigits: decimals })}
              >
                {formatUnits(output.amount, decimals, { maximumFractionDigits: Math.min(decimals, 8) })}
              </p>
              <div className="col-span-2 text-right text-[0.68rem] text-[#718080] sm:col-span-1 sm:min-w-48">
                {runtime.mode === 'demo' && demoAdjusted !== null ? (
                  <p>
                    Demo UI adjusted{' '}
                    {formatUnits(demoAdjusted, decimals, { maximumFractionDigits: Math.min(decimals, 8) })}
                  </p>
                ) : isLiveStockToken && liveAdjusted !== null ? (
                  <>
                    <p
                      className="font-semibold text-[#b8f8f0] tabular-nums"
                      data-testid={registryTestId('redemption-adjusted', output.token)}
                      title={`${formatUnits(liveAdjusted.amountRaw, decimals, { maximumFractionDigits: decimals })} underlying-share units`}
                    >
                      UI adjusted {formatUnits(liveAdjusted.amountRaw, decimals, { maximumFractionDigits: decimals })}{' '}
                      underlying-share units
                    </p>
                    <p className="mt-1">
                      {formatUnits(liveAdjusted.multiplierWad, 18, { maximumFractionDigits: 18 })}×{' '}
                      {liveAdjusted.multiplierSource}
                      {rhj.source === 'stale' ? ' · stale metadata' : ''}
                    </p>
                  </>
                ) : isLiveStockToken ? (
                  <p className="font-semibold text-[#f6d58f]">
                    UI-adjusted display {rhj.source === 'loading' ? 'loading' : 'unavailable'} · raw output unchanged
                  </p>
                ) : (
                  <p>{decimals.toString()} registry decimals · multiplier not applicable</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasLiveStockOutputs && rhj.data !== undefined ? (
        <p className="mt-4 text-[0.66rem] leading-5 text-[#718080]">
          Adjusted display metadata is address-bound to the signed manifest and was generated{' '}
          {new Date(rhj.data.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC.
        </p>
      ) : null}
      <div className="mt-7 rounded-2xl border border-[#67f5e4]/15 bg-[#67f5e4]/5 p-4">
        <p className="text-xs font-semibold text-[#b8f8f0]">Accounting guarantee</p>
        <p className="mt-2 text-xs leading-5 text-[#7f9b98]">
          For each registered asset: output = vault raw balance before redemption × GBX burned ÷ totalSupply before
          burn. No asset price or NAV oracle enters this calculation.
        </p>
      </div>
    </Card>
  );
}

export function RedemptionTransactionPanel() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const transaction = useProtocolTransaction();
  const [amountText, setAmountText] = useState('10,000');
  const [receiptOutputs, setReceiptOutputs] = useState<readonly RedemptionReceiptRow[] | null>(null);
  const [receiptDecodeError, setReceiptDecodeError] = useState(false);
  const parsed = useMemo(() => {
    try {
      return { amount: parseInputAmount(amountText), error: null };
    } catch (error) {
      return { amount: 0n, error: error instanceof Error ? error.message : 'Enter a valid amount.' };
    }
  }, [amountText]);
  const preview = useRedemptionPreview(parsed.amount);
  const gbx = runtime.mode === 'live' ? runtime.assets.GBX : undefined;
  const vault = runtime.addresses?.gumBallVault;
  const allowance = useAllowance(gbx, vault, parsed.amount);
  const supplyReady = runtime.mode === 'demo' || preview.source === 'live';
  const exceedsSupply = supplyReady && parsed.amount > preview.totalSupply;
  const livePreviewReady = preview.source === 'live' && !preview.isPending;

  async function approve() {
    if (gbx === undefined || vault === undefined || parsed.amount <= 0n) return;
    const hash = await transaction.submit(buildErc20Approval(gbx, vault, parsed.amount), 'Approve GBX for redemption');
    if (hash !== null) await allowance.refetch();
  }

  async function redeem() {
    if (vault === undefined || account.address === undefined || parsed.amount <= 0n || exceedsSupply) return;
    const owner = account.address;
    let submittedPreview: Awaited<ReturnType<typeof preview.refetch>> | null = null;
    setReceiptOutputs(null);
    setReceiptDecodeError(false);
    await transaction.submit(
      async () => {
        submittedPreview = await preview.refetch();
        if (submittedPreview.shares !== parsed.amount) {
          throw new Error('Redemption preflight shares changed before simulation.');
        }
        return buildRedemption(vault, parsed.amount, owner);
      },
      `Redeem ${formatToken(parsed.amount, 'GBX')} in kind`,
      {
        errorTarget: vault,
        onConfirmedReceipt: async (receipt) => {
          try {
            if (runtime.mode !== 'live') throw new Error('A live runtime is required to decode a redemption receipt.');
            if (submittedPreview === null) throw new Error('The submitted redemption preflight is unavailable.');
            const decoded = decodeRedemptionReceipt(receipt.logs, vault);
            verifyRedemptionReceipt(decoded, {
              expectedAssets: submittedPreview.outputs.map(({ token }) => token),
              expectedOwner: owner,
              expectedReceiver: owner,
              expectedShares: parsed.amount,
            });
            setReceiptOutputs(redemptionReceiptRows(decoded, submittedPreview.outputs));
          } catch {
            setReceiptDecodeError(true);
          } finally {
            await Promise.allSettled([preview.refetch(), allowance.refetch()]);
          }
        },
      },
    );
  }

  function resetTransaction() {
    setReceiptOutputs(null);
    setReceiptDecodeError(false);
    transaction.reset();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
      <Card className="p-5 sm:p-7" tone="highlight">
        <SectionHeading
          description="Supply and every basket output are pinned to one block hash, revalidated, then the exact call is simulated immediately before wallet confirmation."
          eyebrow="Burn GBX"
          title="Redemption amount"
        />
        <label className="mt-7 block text-xs font-semibold text-[#aab6b5]" htmlFor="redeem-amount">
          GBX amount
        </label>
        <Field
          className="mt-2"
          id="redeem-amount"
          inputMode="decimal"
          onChange={(event) => setAmountText(event.target.value)}
          value={amountText}
        />
        {parsed.error !== null || exceedsSupply ? (
          <p className="mt-2 text-[0.68rem] text-[#f1c67e]">
            {exceedsSupply ? 'Amount exceeds the current total supply.' : parsed.error}
          </p>
        ) : null}

        <div className="mt-6 space-y-3 rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-[#718080]">GBX burned</span>
            <span className="font-semibold text-white tabular-nums">{formatToken(parsed.amount, 'GBX')}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-[#718080]">Share of supply</span>
            <span className="font-semibold text-white tabular-nums">
              {!supplyReady
                ? 'Unavailable'
                : exceedsSupply
                  ? 'Invalid'
                  : formatRatioPercent(parsed.amount, preview.totalSupply, 5)}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-[#718080]">Raw outputs</span>
            <Badge
              tone={preview.source === 'live' ? 'positive' : preview.source === 'rpc-fallback' ? 'warning' : 'info'}
            >
              {preview.source === 'live'
                ? `Block ${preview.blockNumber?.toString() ?? '?'} · ${preview.blockHash?.slice(0, 8) ?? '?'}…`
                : preview.source.replaceAll('-', ' ')}
            </Badge>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-[#718080]">Allowance</span>
            <Badge tone={allowance.needsApproval ? 'warning' : runtime.mode === 'live' ? 'positive' : 'neutral'}>
              {runtime.mode !== 'live'
                ? 'Demo unavailable'
                : allowance.needsApproval
                  ? 'Approval required'
                  : 'Sufficient'}
            </Badge>
          </div>
        </div>

        <Notice className="mt-5" title="Eligibility check required" tone="warning">
          Robinhood Stock Tokens may be restricted by jurisdiction or account eligibility. The receiving wallet must be
          eligible to hold every stock token in the basket before simulation can succeed.
        </Notice>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button
            disabled={
              transaction.readiness !== 'ready' ||
              transaction.isBusy ||
              !allowance.needsApproval ||
              exceedsSupply ||
              !livePreviewReady
            }
            onClick={() => void approve()}
            variant="secondary"
          >
            Approve exact GBX
          </Button>
          <Button
            disabled={
              transaction.readiness !== 'ready' ||
              transaction.isBusy ||
              allowance.needsApproval ||
              exceedsSupply ||
              !livePreviewReady
            }
            onClick={() => void redeem()}
          >
            {guardedActionLabel(transaction.readiness, 'Simulate redemption', 'Processing…', transaction.isBusy)}
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          <TransactionGuard
            onSwitchNetwork={() => void transaction.requestNetworkSwitch()}
            readiness={transaction.readiness}
          />
          <TransactionStatus onReset={resetTransaction} state={transaction.state} />
          {transaction.state.phase === 'success' && receiptOutputs !== null ? (
            <div
              className="rounded-2xl border border-[#67f5e4]/20 bg-[#67f5e4]/5 p-4"
              data-testid="redemption-receipt-assets"
            >
              <p className="text-xs font-semibold text-[#b8f8f0]">Confirmed basket receipt</p>
              <p className="mt-1 text-[0.68rem] leading-5 text-[#7f9b98]">
                Decoded from GumBallVault events in the successful transaction receipt.
              </p>
              <div className="mt-3 divide-y divide-white/7">
                {receiptOutputs.map((output) => (
                  <div className="flex items-center justify-between gap-4 py-2 text-xs" key={output.token}>
                    <span className="font-semibold text-[#dce5e3]">{output.symbol}</span>
                    <span className="text-right tabular-nums text-white">
                      {formatUnits(output.amountRaw, output.decimals, {
                        maximumFractionDigits: Math.min(output.decimals, 8),
                      })}
                      <span className="ml-2 font-mono text-[0.62rem] text-[#718080]">
                        {formatAddress(output.token)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {transaction.state.phase === 'success' && receiptDecodeError ? (
            <Notice title="Receipt detail unavailable" tone="warning">
              The redemption confirmed, but its vault events did not match the expected manifest-backed basket. Inspect
              the transaction on the explorer; no asset amounts are inferred.
            </Notice>
          ) : null}
        </div>
        <p className="mt-4 text-[0.68rem] leading-5 text-[#657373]">
          Rounding dust remains in GumBallVault and benefits remaining GBX holders. Redemption releases assets; a
          buyback burn does not.
        </p>
      </Card>

      <RedemptionBasketPreview outputs={preview.outputs} source={preview.source} />
    </div>
  );
}
