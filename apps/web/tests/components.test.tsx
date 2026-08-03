import { Badge, ProgressBar, StatCard } from '@gumball-6900/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PageIntro } from '../components/page-sections';

describe('shared presentational primitives', () => {
  it('renders a financial metric with accessible text', () => {
    const markup = renderToStaticMarkup(
      <StatCard detail="Current redeemable denominator" label="GBX total supply" trend="+0.1%" value="239.3M GBX" />,
    );
    expect(markup).toContain('GBX total supply');
    expect(markup).toContain('239.3M GBX');
    expect(markup).toContain('Current redeemable denominator');
  });

  it('renders basis-point progress as a percentage string', () => {
    const markup = renderToStaticMarkup(<ProgressBar label="Funding" valueBps={7_959n} />);
    expect(markup).toContain('79.59%');
    expect(markup).toContain('width:79.59%');
  });

  it('renders semantic page copy and status badges', () => {
    const markup = renderToStaticMarkup(
      <PageIntro
        aside={<Badge tone="positive">Live</Badge>}
        description="No asset-price oracle enters protocol accounting."
        eyebrow="Oracleless"
        title="Protocol overview"
      />,
    );
    expect(markup).toContain('<h1');
    expect(markup).toContain('Protocol overview');
    expect(markup).toContain('No asset-price oracle');
    expect(markup).toContain('Live');
  });
});
