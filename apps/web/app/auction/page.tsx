import { DetailPage, detailMetadata } from '../../components/detail-page';
import { AuctionCurve } from '../../components/figures';

export const metadata = detailMetadata(
  'Auction',
  'Every Strategy uses the same bounded reverse Dutch mechanism to acquire one reviewed asset for the Fund.',
);

export default function AuctionPage() {
  return (
    <DetailPage
      active="auction"
      cards={[
        {
          title: 'One acquisition shape',
          body: 'Every Strategy is the same bounded reverse Dutch mechanism. It prices one reviewed payment asset directly, without a protocol NAV or price oracle.',
        },
        {
          title: 'Settlement has two destinations',
          body: 'A purchase snapshots the global Bribe rate, transfers 80–100% of payment directly to Fund, and sends any 0–20% Bribe share to the paired buffer.',
        },
        {
          title: 'The Bribe cannot block the buy',
          body: 'BribeRouter buffers the acquired reward asset and routes it separately when notification thresholds are met. Later Bribe failure does not revert a completed Strategy purchase.',
        },
      ]}
      eyebrow="Mechanism 03"
      figure={<AuctionCurve />}
      figureLabel="One-hour reverse Dutch curve"
      metrics={[
        { label: 'To Fund', value: '80–100%' },
        { label: 'To Bribe', value: '0–20%' },
        { label: 'Default Bribe rate', value: '10%' },
        { label: 'Reward-token cap', value: '16' },
      ]}
      next={{ href: '/govern', label: 'Govern' }}
      summary="Signal selects demand; the Strategy turns that demand into acquisition. A successful purchase sends the payment asset to Fund and, at the bounded global rate, its paired Bribe."
      title="Auction"
    />
  );
}
