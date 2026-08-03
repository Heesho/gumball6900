import type { Metadata } from 'next';

import { PageIntro, ReadModelBanner } from '../../components/page-sections';
import { AuctionFillPanel } from '../../components/protocol/auction-actions';
import { ActivityExplorer } from '../../components/protocol/protocol-activity';
import { SubgraphStatusBadge } from '../../components/protocol/subgraph-health';

export const metadata: Metadata = { title: 'Activity' };

export default function ActivityPage() {
  return (
    <>
      <PageIntro
        aside={<SubgraphStatusBadge />}
        description="Explore event-derived protocol activity with block and transaction context. The index is for discovery and presentation; contract storage remains authoritative for balances and accounting."
        eyebrow="Event stream"
        title="Protocol activity"
      />
      <ReadModelBanner />

      <ActivityExplorer />
      <AuctionFillPanel />
    </>
  );
}
