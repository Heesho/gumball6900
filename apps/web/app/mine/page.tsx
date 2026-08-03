import { Card, SectionHeading } from '@gumball-6900/ui';
import type { Metadata } from 'next';

import { PageIntro, ReadModelBanner } from '../../components/page-sections';
import { GenesisLifecyclePanel } from '../../components/protocol/genesis-actions';
import {
  MiningClaimsPanel,
  MiningContributionActions,
  MiningEpochOverview,
  MiningEpochStats,
} from '../../components/protocol/mining-actions';
import { LiveEpochBadge } from '../../components/protocol/live-epoch-badge';

export const metadata: Metadata = { title: 'Mine' };

export default function MinePage() {
  return (
    <>
      <PageIntro
        aside={<LiveEpochBadge />}
        description="Preview contribution to a daily USDG batch auction. In a validated deployment, scheduled emission is a maximum and GBX actually minted scales down when demand does not fund that maximum at the endogenous minimum mining price."
        eyebrow="Recurring mining"
        title="Mine GBX with USDG"
      />
      <ReadModelBanner />

      <GenesisLifecyclePanel />

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[1.1fr_.9fr]">
        <MiningEpochOverview />

        <Card className="p-5 sm:p-7">
          <SectionHeading
            description="Your wallet will simulate the transaction before submission."
            eyebrow="Contribute"
            title="Enter USDG amount"
          />
          <MiningContributionActions />

          <p className="mt-4 text-[0.68rem] leading-5 text-[#657373]">
            A contribution increasing epoch USDG by at least 1% during the final 15 minutes extends the epoch by 15
            minutes, up to two hours total.
          </p>
        </Card>
      </div>

      <MiningEpochStats />

      <MiningClaimsPanel />
    </>
  );
}
