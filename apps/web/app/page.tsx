import { Badge, Card, Notice, SectionHeading, StatCard, buttonStyles } from '@gumball-6900/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ReadModelBanner, SignalComposition, VaultComposition } from '../components/page-sections';
import { LiveSupplyStats } from '../components/protocol/live-supply-stats';
import { LiveEpochBadge } from '../components/protocol/live-epoch-badge';
import { HomeMiningEpochCard, HomeMiningStatCards } from '../components/protocol/home-mining-state';
import { DemoReadModelOnly } from '../components/protocol/demo-read-model-only';
import { HomeLiquidityStat } from '../components/protocol/live-liquidity';
import { HomeBuybackStat, HomeVaultBalances } from '../components/protocol/live-protocol-overview';
import { HomeRecentActivityPanel } from '../components/protocol/protocol-activity';
import { formatUSDG } from '../lib/format';
import { protocolSnapshot } from '../lib/read-model';

export const metadata: Metadata = { title: 'Overview' };

export default function HomePage() {
  return (
    <>
      <ReadModelBanner />

      <Card className="hero-grid p-6 sm:p-8 xl:p-10" tone="highlight">
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <LiveEpochBadge />
            <Badge>Oracleless by design</Badge>
          </div>
          <h1 className="mt-7 max-w-3xl text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.065em] text-white sm:text-[3.8rem] xl:text-[4.6rem]">
            A basket directed by signals, not price oracles.
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-[#9aa9a8] sm:text-base">
            Mine GBX with USDG. Stake GBX 1:1 into non-transferable sGBX and continuously signal what future USDG
            accumulates. Redeem GBX directly for the same pro-rata share of every supported vault asset.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className={buttonStyles({ size: 'lg' })} href="/mine">
              Mine GBX <span aria-hidden="true">↗</span>
            </Link>
            <Link className={buttonStyles({ size: 'lg', variant: 'secondary' })} href="/vault">
              Explore the basket
            </Link>
          </div>
        </div>
        <div className="relative z-10 mt-10 grid gap-4 border-t border-white/8 pt-6 sm:grid-cols-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#647373]">Redeemability</p>
            <p className="mt-2 text-sm font-semibold text-[#e0e7e6]">Non-pausable and in kind</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#647373]">Signal activation</p>
            <p className="mt-2 text-sm font-semibold text-[#e0e7e6]">24h delay · immediate unstake</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#647373]">Supply ceiling</p>
            <p className="mt-2 text-sm font-semibold text-[#e0e7e6]">1B cumulative GBX mint cap</p>
          </div>
        </div>
      </Card>

      <div className="mt-5">
        <LiveSupplyStats />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HomeMiningStatCards />
        <HomeBuybackStat />
        <DemoReadModelOnly
          description="Current pool inventory requires a validated Uniswap state read."
          liveContent={<HomeLiquidityStat />}
          title="Liquidity inventory unavailable"
        >
          <StatCard
            detail="Deterministic demo pool"
            label="Demo protocol-owned liquidity"
            value={formatUSDG(protocolSnapshot.liquidityDisplayValueUSDG, true, 18)}
          />
        </DemoReadModelOnly>
      </div>

      <Notice className="mt-4" title="Read buybacks correctly">
        Every accepted GBX is really burned, but a mining-funded buyback is not automatically backing-accretive in the
        same epoch: mining creates GBX and the buyback spends USDG that otherwise remains redeemable. Contracts do not
        use a price oracle to make that judgment.
      </Notice>

      <div className="mt-9 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <DemoReadModelOnly
          description="Current basket balances require a bounded pinned registry-and-vault snapshot."
          liveContent={<HomeVaultBalances />}
          title="Basket composition unavailable"
        >
          <Card className="p-5 sm:p-6">
            <SectionHeading
              action={<Badge tone="info">Demo display estimate</Badge>}
              description="Raw balances remain the redemption source of truth. Demo display values never enter contract accounting."
              eyebrow="GumBallVault"
              title="Demo basket composition"
            />
            <div className="mt-7">
              <VaultComposition compact />
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/7 pt-5">
              <span className="text-xs text-[#718080]">Demo estimated display value</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {formatUSDG(protocolSnapshot.vaultDisplayValueUSDG, true, 18)}
              </span>
            </div>
          </Card>
        </DemoReadModelOnly>

        <Card className="p-5 sm:p-6">
          <SectionHeading
            description="Persistent active signal weight applied only to future and newly notified USDG."
            eyebrow="Community direction"
            title="Active allocation"
          />
          <div className="mt-7">
            <SignalComposition compact />
          </div>
          <Link
            className="mt-6 inline-flex min-h-11 items-center text-xs font-semibold text-[#75f7e7] hover:text-white"
            href="/manage"
          >
            Open signal manager <span aria-hidden="true">&nbsp;↗</span>
          </Link>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[.78fr_1.22fr]">
        <HomeMiningEpochCard />

        <HomeRecentActivityPanel />
      </div>
    </>
  );
}
