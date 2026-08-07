import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../../app/page';

describe('core starting-point status page', () => {
  it('shows the immutable cap and current starting economics without implying a deployment', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'The deliberately minimal GBX protocol.' })).toBeTruthy();
    expect(screen.getByText('1,000,000,000 GBX')).toBeTruthy();
    expect(screen.getByText('90% Fund · 10% voters')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText('Local implementation evidence · not deployed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /connect wallet/i })).toBeNull();
  });

  it('discloses the current timelock and migration trust surfaces', () => {
    render(<HomePage />);

    expect(screen.getByText(/TimelockController owns Voter, Fund, and LiquidityPosition/i)).toBeTruthy();
    expect(screen.getByText(/multisig proposes or cancels operations/i)).toBeTruthy();
    expect(screen.getByText(/cannot exceed 50%/i)).toBeTruthy();
    expect(screen.getByText(/migration is one-way/i)).toBeTruthy();
  });
});
