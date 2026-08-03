import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Badge, Button, Card, ProgressBar, SegmentedBar, TokenMark, buttonStyles, cn } from './primitives.js';

describe('shared UI primitives', () => {
  it('joins only usable class names and preserves caller overrides last', () => {
    expect(cn('base', false, undefined, null, 'override')).toBe('base override');
    expect(buttonStyles({ className: 'custom-class', size: 'sm', variant: 'danger' })).toMatch(/danger|custom-class/);
    expect(buttonStyles({ className: 'custom-class', size: 'sm', variant: 'danger' }).endsWith('custom-class')).toBe(
      true,
    );
  });

  it('uses safe button semantics and the requested visual variants', () => {
    const markup = renderToStaticMarkup(
      <Button disabled size="lg" variant="secondary">
        Continue
      </Button>,
    );

    expect(markup).toContain('type="button"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Continue');
    expect(markup).toContain('min-h-12');
  });

  it('lets cards shrink inside responsive grids while retaining horizontal child scrollers', () => {
    const markup = renderToStaticMarkup(<Card>Scrollable table</Card>);

    expect(markup).toContain('min-w-0');
  });

  it('clamps progress widths while retaining an exact accessible label', () => {
    const belowZero = renderToStaticMarkup(<ProgressBar label="Allocation" valueBps={-1n} />);
    const aboveMaximum = renderToStaticMarkup(<ProgressBar label="Allocation" valueBps={10_001n} />);
    const fractional = renderToStaticMarkup(<ProgressBar label="Allocation" valueBps={6_969n} />);

    expect(belowZero).toContain('width:0%');
    expect(aboveMaximum).toContain('width:100%');
    expect(fractional).toContain('69.69%');
  });

  it('labels segmented data and bounds token marks without leaking long symbols', () => {
    const segments = renderToStaticMarkup(
      <SegmentedBar segments={[{ color: '#fff', label: 'USDG reserve', valueBps: 2_500n }]} />,
    );
    const token = renderToStaticMarkup(<TokenMark symbol="TOO-LONG" />);

    expect(segments).toContain('aria-label="USDG reserve 25%"');
    expect(segments).toContain('role="img"');
    expect(segments).toContain('aria-hidden="true"');
    expect(token).toContain('TOO-');
    expect(token).not.toContain('TOO-LONG');
  });

  it('renders badge tones as presentational text without changing content', () => {
    const markup = renderToStaticMarkup(<Badge tone="positive">Operational</Badge>);

    expect(markup).toContain('Operational');
    expect(markup).toContain('text-[#8efff1]');
  });
});
