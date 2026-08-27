import { DetailPage, detailMetadata } from '../../components/detail-page';
import { SignalBars } from '../../components/figures';

export const metadata = detailMetadata(
  'Signal',
  'Escrow GBX one-for-one as non-transferable sGBX and allocate it immediately to live Strategies.',
);

export default function SignalPage() {
  return (
    <DetailPage
      active="signal"
      cards={[
        {
          title: 'Escrow and allocation are atomic',
          body: 'Every successful addition deposits GBX, mints the same raw amount of sGBX, and assigns that amount to one live Strategy. Idle sGBX is not permitted.',
        },
        {
          title: 'One weight, two destinations',
          body: 'The selected Strategy gains Resonance weight while its paired Bribe records the holder’s virtual balance. Scalar and struct-array batch operations use the same accounting path.',
        },
        {
          title: 'Exit stays available',
          body: 'Removing signal performs the inverse operation, burns sGBX, and returns GBX. Existing positions remain removable even after a Strategy is irreversibly killed.',
        },
      ]}
      eyebrow="Mechanism 02"
      figure={<SignalBars />}
      figureLabel="Illustrative Strategy distribution"
      metrics={[
        { label: 'GBX to sGBX', value: '1:1' },
        { label: 'Idle sGBX', value: '0' },
        { label: 'Resonance stream', value: '7 days' },
        { label: 'Operations', value: 'Scalar + batch' },
      ]}
      next={{ href: '/auction', label: 'Auction' }}
      summary="Holders escrow GBX as non-transferable voting weight and allocate it immediately. Signal chooses which live Strategies share revenue and which Bribes recognize each holder."
      title="Signal"
    />
  );
}
