import { Badge, Card, Notice, SectionHeading, TableShell, TokenMark } from '@gumball-6900/ui';
import type { Metadata } from 'next';

import {
  AssetStatusBadge,
  AssetSummaryGrid,
  PageIntro,
  ReadModelBanner,
  VaultComposition,
} from '../../components/page-sections';
import { DemoReadModelOnly } from '../../components/protocol/demo-read-model-only';
import { LiveVaultBacking } from '../../components/protocol/live-protocol-overview';
import { LiveStrategyFillHistory } from '../../components/protocol/protocol-activity';
import { VaultRhjContext } from '../../components/protocol/vault-rhj-context';
import { formatBps, formatToken, formatUSDG, formatUnits } from '../../lib/format';
import { protocolSnapshot, vaultAssets } from '../../lib/read-model';

export const metadata: Metadata = { title: 'Vault' };

export default function VaultPage() {
  return (
    <>
      <PageIntro
        aside={<Badge tone="info">Bounded registry · up to 16 assets</Badge>}
        description="GumBallVault is designed as the sole custody point for redeemable backing. In a validated deployment, raw token balances—not a calculated NAV—determine what every GBX redemption receives."
        eyebrow="In-kind backing"
        title="Inside GumBallVault"
      />
      <ReadModelBanner />
      <VaultRhjContext />

      <DemoReadModelOnly
        description="Current registry membership, token-decimal balances, multipliers, budgets, and fill history require bounded pinned contract or validated indexer reads."
        liveContent={
          <>
            <LiveVaultBacking />
            <LiveStrategyFillHistory />
          </>
        }
        title="Vault balance detail unavailable"
      >
        <>
          <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
            <Card className="p-5 sm:p-6">
              <SectionHeading
                action={<Badge tone="info">Display estimate</Badge>}
                description="Estimated USDG mix uses read-only display prices. It is never an onchain accounting input."
                eyebrow="Composition"
                title={formatUSDG(protocolSnapshot.vaultDisplayValueUSDG, true, 18)}
              />
              <div className="mt-7">
                <VaultComposition />
              </div>
            </Card>

            <Card className="p-5 sm:p-7" tone="highlight">
              <SectionHeading
                description="Stock tokens are redeemed as raw ERC-20 units. uiMultiplier changes presentation of underlying-share exposure without changing the vault’s raw balance or your pro-rata fraction."
                eyebrow="Corporate actions"
                title="Raw units remain authoritative"
              />
              <Notice className="mt-6" title="Preview NVDA multiplier scenario" tone="warning">
                The deterministic scenario models an onchain multiplier moving from 2.0× to 4.0×. Raw NVDA held by
                GumBallVault would remain unchanged. Robinhood registry status and corporate-action history are
                read-only metadata in a validated deployment.
              </Notice>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/7 bg-[#0b1213]/65 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#657373]">Raw NVDA</p>
                  <p className="mt-2 text-lg font-semibold text-white tabular-nums">10,284.442</p>
                </div>
                <div className="rounded-2xl border border-white/7 bg-[#0b1213]/65 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#657373]">UI adjusted</p>
                  <p className="mt-2 text-lg font-semibold text-white tabular-nums">20,568.884</p>
                </div>
                <div className="rounded-2xl border border-[#67f5e4]/15 bg-[#67f5e4]/5 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#72cfc4]">Registry</p>
                  <p className="mt-2 text-lg font-semibold text-[#82fcef]">Preview active</p>
                </div>
              </div>
              <p className="mt-6 text-xs leading-5 text-[#718080]">
                Trading-halt and inactive-registry alerts disable acquisition presentation but never remove already-held
                assets from pro-rata redemption.
              </p>
            </Card>
          </div>

          <div className="mt-5">
            <AssetSummaryGrid />
          </div>

          <Card className="mt-5 p-5 sm:p-7">
            <SectionHeading
              description="Balances use exact token decimals. Display share is an informational value estimate; unlike raw token units, unlike assets cannot be meaningfully summed without a display price."
              eyebrow="Asset registry"
              title="Backing detail"
            />
            <TableShell className="mt-6">
              <table className="financial-table min-w-[84rem]">
                <caption className="sr-only">Registered vault assets and balances</caption>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Raw balance</th>
                    <th>UI adjusted</th>
                    <th>Display mix</th>
                    <th>Signal</th>
                    <th>USDG budget</th>
                    <th>Multiplier / action</th>
                    <th>Recent fill</th>
                    <th>Registry</th>
                    <th>Trading</th>
                  </tr>
                </thead>
                <tbody>
                  {vaultAssets.map((asset) => (
                    <tr key={asset.symbol}>
                      <td>
                        <div className="flex items-center gap-3">
                          <TokenMark color={asset.color} size="sm" symbol={asset.symbol} />
                          <div>
                            <p className="font-semibold text-white">{asset.symbol}</p>
                            <p className="mt-0.5 text-[0.66rem] text-[#647272]">{asset.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="font-semibold text-[#dbe4e2] tabular-nums">
                        {formatUnits(asset.rawBalance, 18, { maximumFractionDigits: 4 })}
                      </td>
                      <td className="tabular-nums">
                        {formatUnits(asset.uiAdjustedBalance, 18, { maximumFractionDigits: 4 })}
                      </td>
                      <td>
                        <span className="font-semibold text-white">{formatBps(asset.displayShareBps)}</span>
                        <span className="ml-1 text-[0.64rem] text-[#657373]">est.</span>
                      </td>
                      <td className="tabular-nums">{formatBps(asset.signalWeightBps)}</td>
                      <td className="tabular-nums">{formatToken(asset.pendingBudgetUSDG, 'USDG')}</td>
                      <td>
                        <p className="font-semibold text-white tabular-nums">
                          {formatUnits(asset.multiplierWad, 18, { maximumFractionDigits: 2 })}×
                        </p>
                        <p className="mt-1 text-[0.64rem] leading-4 text-[#657373]">
                          {asset.pendingMultiplierWad === undefined
                            ? 'No pending action'
                            : `→ ${formatUnits(asset.pendingMultiplierWad, 18, { maximumFractionDigits: 2 })}× · ${asset.pendingMultiplierAt}`}
                        </p>
                      </td>
                      <td>{asset.recentFill}</td>
                      <td>
                        <AssetStatusBadge status={asset.registryStatus} />
                      </td>
                      <td>
                        <Badge tone={asset.tradingHalted ? 'warning' : 'positive'}>
                          {asset.tradingHalted ? 'Halted' : 'Open'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Card>
        </>
      </DemoReadModelOnly>
    </>
  );
}
