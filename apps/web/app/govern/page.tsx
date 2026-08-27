import { DetailPage, detailMetadata } from '../../components/detail-page';
import { GovernSurface } from '../../components/figures';

export const metadata = detailMetadata(
  'Govern',
  'A deliberately narrow continuing administration surface for Strategies, Bribe rewards, and one bounded global rate.',
);

export default function GovernPage() {
  return (
    <DetailPage
      active="govern"
      cards={[
        {
          title: 'Four continuing actions',
          body: 'Governance may add a Strategy, kill a Strategy, add a reward token to a paired Bribe, and set the one global Bribe rate within its hard maximum.',
        },
        {
          title: 'Strategy death is final',
          body: 'Killing a Strategy preserves its accrued claim, excludes its weight from later revenue, and keeps existing signal exits open. The final live Strategy cannot be killed alone.',
        },
        {
          title: 'The executor is still unresolved',
          body: 'The exact external governance executor, permissions, delay, cancellation rules, and ownership receipt require a later reviewed ADR. Until then, production deployment remains blocked.',
        },
      ]}
      eyebrow="Mechanism 04"
      figure={<GovernSurface />}
      figureLabel="Continuing administration surface"
      metrics={[
        { label: 'Bounded actions', value: '4' },
        { label: 'Maximum Bribe rate', value: '20%' },
        { label: 'Proxy or pause', value: 'None' },
        { label: 'External executor', value: 'Unresolved' },
      ]}
      next={{ href: '/mine', label: 'Mine' }}
      summary="The protocol keeps ongoing administration to Strategy curation, bounded Bribe configuration, and inherited ownership transfer. Fund and Mine remain ownerless."
      title="Govern"
    />
  );
}
