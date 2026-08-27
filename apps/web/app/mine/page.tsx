import { DetailPage, detailMetadata } from '../../components/detail-page';
import { EmissionChart } from '../../components/figures';

export const metadata = detailMetadata(
  'Mine',
  'Sixteen independent reverse Dutch mining slots issue GBX on a fixed time-based schedule.',
);

export default function MinePage() {
  return (
    <DetailPage
      active="mine"
      cards={[
        {
          title: 'Sixteen independent auctions',
          body: 'Every slot runs its own hourly reverse Dutch replacement auction. A slot can begin a new tenure at any time, including with the same miner.',
        },
        {
          title: 'A rate locked for the tenure',
          body: 'A newly occupied slot receives the current global rate divided by sixteen. That assigned rate does not reprice until the slot is replaced.',
        },
        {
          title: 'Revenue leaves Mine cleanly',
          body: 'First occupation routes 100% of USDG toward Resonance. On replacement, 80% becomes a pull claim for the outgoing miner and the nominal 20% enters the Router. There is no team fee.',
        },
      ]}
      eyebrow="Mechanism 01"
      figure={<EmissionChart />}
      figureLabel="Time-based emission schedule"
      metrics={[
        { label: 'Permanent slots', value: '16' },
        { label: 'Initial global rate', value: '64 GBX/s' },
        { label: 'Halving period', value: '69 days' },
        { label: 'Tail rate', value: '1 GBX/s' },
      ]}
      next={{ href: '/signal', label: 'Signal' }}
      summary="GBX begins at zero supply. Sixteen permanent slots issue it through independent replacement auctions, while the global schedule halves with time toward a fixed tail rate."
      title="Mine"
    />
  );
}
