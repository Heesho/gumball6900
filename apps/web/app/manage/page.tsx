import { Badge } from '@gumball-6900/ui';
import type { Metadata } from 'next';

import { PageIntro, ReadModelBanner } from '../../components/page-sections';
import {
  ManageAccountStats,
  ManageStrategyStatePanels,
  RewardClaimsPanel,
  SignalTransactionPanel,
  StakeTransactionPanel,
} from '../../components/protocol/manage-actions';

export const metadata: Metadata = { title: 'Manage' };

export default function ManagePage() {
  return (
    <>
      <PageIntro
        aside={<Badge tone="positive">Immediate unstake</Badge>}
        description="Stake GBX 1:1 into non-transferable sGBX and continuously signal how future and newly notified USDG should be allocated. This is not DAO governance: there are no proposals, quorum rules, delegation markets, or executable calls."
        eyebrow="Liquid signaling"
        title="Manage the basket’s direction"
      />
      <ReadModelBanner />

      <ManageAccountStats />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.18fr_.82fr]">
        <SignalTransactionPanel />

        <div className="space-y-5">
          <StakeTransactionPanel />
          <RewardClaimsPanel />
        </div>
      </div>

      <ManageStrategyStatePanels />
    </>
  );
}
