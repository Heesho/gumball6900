import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../../app/page';

describe('core starting-point status page', () => {
  it('shows the immutable cap and current starting economics without implying a deployment', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'The governance-minimized GBX protocol.' })).toBeTruthy();
    expect(screen.getByText('20,000,000 GBX')).toBeTruthy();
    expect(screen.getByText('90% Fund · 10% Bribe')).toBeTruthy();
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

  it('limits token governance to three immutable timelocked actions without a multisig bypass', () => {
    render(<HomePage />);

    expect(screen.getByText('Add a Strategy.')).toBeTruthy();
    expect(screen.getByText('Kill a Strategy.')).toBeTruthy();
    expect(screen.getByText('Add Bribe rewards.')).toBeTruthy();
    expect(screen.queryByText(/Increase Mine capacity/i)).toBeNull();
    expect(
      screen.getByText(/SignalGBX voting power operates an immutable ProtocolGovernor, the Timelock's sole proposer/i),
    ).toBeTruthy();
    expect(screen.getByText(/no multisig bypass, guardian, or queued-proposal veto/i)).toBeTruthy();
    expect(screen.getByText(/internally hardened deployment candidate/i)).toBeTruthy();
  });
});
