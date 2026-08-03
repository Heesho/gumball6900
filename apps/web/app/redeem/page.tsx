import { Badge, Card, SectionHeading } from '@gumball-6900/ui';
import type { Metadata } from 'next';

import { PageIntro, ReadModelBanner } from '../../components/page-sections';
import { RedemptionTransactionPanel } from '../../components/protocol/redemption-actions';

export const metadata: Metadata = { title: 'Redeem' };

export default function RedeemPage() {
  return (
    <>
      <PageIntro
        aside={<Badge tone="positive">Redemption cannot be paused</Badge>}
        description="Burn GBX to receive the same pro-rata fraction of every registered asset held by GumBallVault. The denominator is GBX totalSupply immediately before the burn—not circulating supply and not an oracle-priced NAV."
        eyebrow="Non-pausable exit"
        title="Redeem your share of the basket"
      />
      <ReadModelBanner />
      <RedemptionTransactionPanel />

      <Card className="mt-5 p-5 sm:p-7">
        <SectionHeading
          description="A write is enabled only after runtime deployment validation, wallet connection, the correct chain, allowance, and a successful latest-state simulation."
          eyebrow="Transaction state"
          title="Simulation → confirmation → receipt"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <Badge tone="warning">1 · Eligibility</Badge>
            <h3 className="mt-4 text-sm font-semibold text-white">Eligibility + allowance</h3>
            <p className="mt-2 text-xs leading-5 text-[#718080]">
              Verify the receiver can hold every registered asset, then submit an exact GBX approval when required.
            </p>
          </div>
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <Badge tone="info">2 · Final confirmation</Badge>
            <h3 className="mt-4 text-sm font-semibold text-white">Re-simulate exact outputs</h3>
            <p className="mt-2 text-xs leading-5 text-[#718080]">
              Refresh supplyBefore and raw vault balances, simulate the encoded SDK call, then ask the wallet once.
            </p>
          </div>
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
            <Badge tone="positive">3 · Atomic receipt</Badge>
            <h3 className="mt-4 text-sm font-semibold text-white">Confirm successful inclusion</h3>
            <p className="mt-2 text-xs leading-5 text-[#718080]">
              Success is shown only after a successful chain receipt; the explorer link provides canonical event detail.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}
