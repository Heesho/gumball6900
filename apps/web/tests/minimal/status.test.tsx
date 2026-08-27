import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AuctionPage from '../../app/auction/page';
import GovernPage from '../../app/govern/page';
import HomePage from '../../app/page';

describe('Gumball6900 protocol site', () => {
  it('presents the cinematic hero and the four mechanism products', () => {
    const { container } = render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'An onchain index fund built by its holders.' })).toBeTruthy();
    expect(container.querySelector('video source')?.getAttribute('src')).toBe('/media/gumball6900-cinematic-90s.mp4');
    expect(screen.getByRole('heading', { level: 2, name: 'Four mechanisms. One holder-built fund.' })).toBeTruthy();
    expect(screen.getByText('16', { exact: true })).toBeTruthy();
    expect(screen.getByText('1:1', { exact: true })).toBeTruthy();
    expect(screen.getByText('80–100%', { exact: true })).toBeTruthy();
    expect(screen.getByText('4', { exact: true })).toBeTruthy();
    expect(screen.getByText(/development protocol with no production addresses configured/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /connect wallet/i })).toBeNull();
  });

  it('keeps acquisition bounds and governance gates explicit', () => {
    const { unmount } = render(<AuctionPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Auction' })).toBeTruthy();
    expect(screen.getByText('80–100%', { exact: true })).toBeTruthy();
    expect(screen.getByText('0–20%', { exact: true })).toBeTruthy();
    expect(screen.getByText(/without a protocol NAV or price oracle/i)).toBeTruthy();
    unmount();

    render(<GovernPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Govern' })).toBeTruthy();
    expect(screen.getByText('Unresolved', { exact: true })).toBeTruthy();
    expect(screen.getByText(/production deployment remains blocked/i)).toBeTruthy();
  });
});
