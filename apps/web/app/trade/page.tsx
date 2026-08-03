import { Badge, Card, Notice, SectionHeading, StatCard } from '@gumball-6900/ui';
import type { Metadata } from 'next';

import { PageIntro, ReadModelBanner } from '../../components/page-sections';
import { DemoReadModelOnly } from '../../components/protocol/demo-read-model-only';
import { LivePoolStateCard } from '../../components/protocol/live-liquidity';
import { TradeQuotePanel } from '../../components/protocol/trade-quote';
import { formatToken, formatUSDG } from '../../lib/format';
import { liquidityPool } from '../../lib/read-model';

export const metadata: Metadata = { title: 'Trade' };

export default function TradePage() {
  return (
    <>
      <PageIntro
        aside={<Badge tone="info">Manifest-bound pool</Badge>}
        description="In a validated runtime, read an exact quote from its pinned v4 Quoter. Mainnet may hand off to the approved Uniswap interface; a remote testnet candidate exposes its bespoke quote only. Or redeem GBX directly for your in-kind vault share: redemption burns GBX and delivers every registered vault asset pro rata."
        eyebrow="Market liquidity"
        title="Trade GBX / USDG"
      />
      <ReadModelBanner />

      <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
        <TradeQuotePanel />

        <div className="space-y-5">
          <DemoReadModelOnly
            description="Current pool price, tick, and inventory require validated StateView reads."
            liveContent={<LivePoolStateCard />}
            title="Pool state unavailable"
          >
            <Card className="p-5 sm:p-7">
              <SectionHeading
                action={<Badge tone="info">Demo pool {liquidityPool.poolId}</Badge>}
                description="Deterministic presentation data for the configured range-ladder design."
                eyebrow="Demo canonical market"
                title="GBX / USDG · 0.30%"
              />
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <StatCard
                  className="bg-white/[0.02]"
                  detail="Demo display estimate"
                  label="GBX price"
                  value={formatUSDG(liquidityPool.displayPriceUSDG, false, 18)}
                />
                <StatCard
                  className="bg-white/[0.02]"
                  detail="Demo active ranges"
                  label="GBX inventory"
                  value={formatToken(liquidityPool.gbxInventory, 'GBX')}
                />
                <StatCard
                  className="bg-white/[0.02]"
                  detail="Demo converted liquidity"
                  label="USDG inventory"
                  value={formatToken(liquidityPool.usdgInventory, 'USDG')}
                />
              </div>
            </Card>
          </DemoReadModelOnly>

          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <Badge tone="info">Swap exit</Badge>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-white">Trade at the market price</h2>
              <p className="mt-3 text-sm leading-6 text-[#849393]">
                Receive one output token through Uniswap v4. The quote depends on current pool liquidity, tick movement,
                fees, and price impact. A swap does not burn GBX unless a separate buyback strategy is the taker.
              </p>
              <p className="mt-5 text-xs font-semibold text-[#aeb9b8]">Best for a simple GBX ↔ USDG market trade.</p>
            </Card>
            <Card className="p-5 sm:p-6" tone="highlight">
              <Badge tone="positive">Redemption exit</Badge>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-white">
                Burn for the exact basket fraction
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#849393]">
                Receive every registered vault asset pro rata. There is no market quote or NAV calculation; output comes
                directly from raw vault balances and total GBX supply.
              </p>
              <p className="mt-5 text-xs font-semibold text-[#8bf8ea]">Best for the protocol’s hard in-kind exit.</p>
            </Card>
          </div>

          <Notice title="Production eligibility" tone="warning">
            Mainnet pool access may use a permissioned Uniswap v4 architecture. The compliance deployment gate and
            official interface eligibility checks remain authoritative; this client never treats a successful quote as
            permission to trade.
          </Notice>
        </div>
      </div>
    </>
  );
}
