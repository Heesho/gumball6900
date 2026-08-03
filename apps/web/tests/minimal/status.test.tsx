import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../../app/page';

describe('minimal rebuild status page', () => {
  it('shows exact supply constants and fails closed without a deployment', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'The deliberately minimal GBX protocol.' })).toBeTruthy();
    expect(screen.getByText('1,000,000,000 GBX')).toBeTruthy();
    expect(screen.getByText('20,000,000 GBX')).toBeTruthy();
    expect(screen.getByText('980,000,000 GBX')).toBeTruthy();
    expect(screen.getByText('465,152.749681042811702004 GBX')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /connect wallet/i })).toBeNull();
  });

  it('discloses every mutable code/custody trust surface', () => {
    render(<HomePage />);

    expect(screen.getByText(/replace the mining controller/i)).toBeTruthy();
    expect(screen.getByText(/transfer only the recorded canonical liquidity NFT/i)).toBeTruthy();
    expect(screen.getByText(/strategy registration admits code/i)).toBeTruthy();
    expect(screen.getByText(/arbitrary recipient/i)).toBeTruthy();
  });
});
