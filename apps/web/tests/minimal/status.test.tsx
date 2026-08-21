import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../../app/page';

describe('core starting-point status page', () => {
  it('shows the immutable cap and current starting economics without implying a deployment', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'The governance-minimized GBX protocol.' })).toBeTruthy();
    expect(screen.getByText('20,000,000 GBX')).toBeTruthy();
    expect(screen.getByText('10% default · 0–20%')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText(/Deposit GBX directly into a Strategy signal to mint non-transferable sGBX/i)).toBeTruthy();
    expect(screen.getByText('Pro-rata Bribe stream from its explicit notifications')).toBeTruthy();
    expect(screen.getByText('signal() / signalWithPermit() · withdrawSignal()')).toBeTruthy();
    expect(screen.getByText('20% Resonance · 80% displaced miner')).toBeTruthy();
    expect(screen.getByText('USDG → Resonance · GBX → Fund burn · principal fixed')).toBeTruthy();
    expect(screen.getByText('Internally hardened candidate · not deployed · external audit pending')).toBeTruthy();
    expect(screen.getByText('left(USDG) · distribute(strategy)')).toBeTruthy();
    expect(screen.getByText(/fundPaymentLiability → payFundPayment\(\).*bribePaymentLiability/)).toBeTruthy();
    expect(screen.getByText('claimReward() · claimRewards(account, tokens)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /connect wallet/i })).toBeNull();
  });

  it('shows the bounded Resonance administration and unresolved external governance gate', () => {
    render(<HomePage />);

    expect(screen.getByText('Add a Strategy.')).toBeTruthy();
    expect(screen.getByText('Kill a Strategy.')).toBeTruthy();
    expect(screen.getByText('Add Bribe rewards.')).toBeTruthy();
    expect(screen.getByText(/Set the global prospective automatic-Bribe share from 0% through 20%/i)).toBeTruthy();
    expect(screen.getByText(/0% automatic Bribe rate leaves signaling, movement, withdrawal/i)).toBeTruthy();
    expect(screen.queryByText(/Increase Mine capacity/i)).toBeNull();
    expect(
      screen.getByText(/does not select or implement the governance system that will own Resonance/i),
    ).toBeTruthy();
    expect(screen.getByText(/Deployment remains blocked until the exact external executor/i)).toBeTruthy();
    expect(screen.getByText(/internally hardened deployment candidate/i)).toBeTruthy();
  });
});
