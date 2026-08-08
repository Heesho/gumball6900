import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../../app/page';

describe('core starting-point status page', () => {
  it('shows the immutable cap and current starting economics without implying a deployment', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'The governance-minimized GBX protocol.' })).toBeTruthy();
    expect(screen.getByText('1,000,000,000 GBX')).toBeTruthy();
    expect(screen.getByText('90% Fund · 10% signalers')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText(/Point sGBX at the active Strategy for an asset you want to accumulate/i)).toBeTruthy();
    expect(screen.getByText('Pro-rata stream of the acquired asset')).toBeTruthy();
    expect(screen.getByText('Fundraiser → Resonance → Strategies')).toBeTruthy();
    expect(screen.getByText('GBX burned · USDG follows current signals')).toBeTruthy();
    expect(screen.getByText('Target final design · contracts pending update · not deployed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /connect wallet/i })).toBeNull();
  });

  it('limits the target management surface to four explicit actions', () => {
    render(<HomePage />);

    expect(screen.getByText('Add a Strategy.')).toBeTruthy();
    expect(screen.getByText('Remove a Strategy.')).toBeTruthy();
    expect(screen.getByText('Change the management fee.')).toBeTruthy();
    expect(screen.getByText('Add Bribe rewards.')).toBeTruthy();
    expect(
      screen.getByText(/Everything else is fixed in code or directed continuously through sGBX signals/i),
    ).toBeTruthy();
    expect(screen.getByText(/current contracts still expose a broader administrative surface/i)).toBeTruthy();
  });
});
