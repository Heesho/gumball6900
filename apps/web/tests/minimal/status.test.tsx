import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../../app/page';

describe('core starting-point status page', () => {
  it('shows the immutable cap and current starting economics without implying a deployment', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'The governance-minimized GBX protocol.' })).toBeTruthy();
    expect(screen.getByText('20,000,000 GBX')).toBeTruthy();
    expect(screen.getByText('100% Fund-bound')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
    expect(
      screen.getByText(/Stake GBX into non-transferable sGBX to signal which assets Fund should accumulate/i),
    ).toBeTruthy();
    expect(screen.getByText('Pro-rata independently funded Bribe stream')).toBeTruthy();
    expect(screen.getByText('stakeAndSignal() · removeSignalAndUnstake()')).toBeTruthy();
    expect(screen.getByText('20% Resonance · 80% displaced miner')).toBeTruthy();
    expect(screen.getByText('USDG → Resonance · GBX → Fund burn · principal fixed')).toBeTruthy();
    expect(screen.getByText('Internally hardened candidate · not deployed · external audit pending')).toBeTruthy();
    expect(screen.getByText('left(USDG) · distribute(strategy)')).toBeTruthy();
    expect(screen.getByText('fundPaymentLiability → payFundPayment()')).toBeTruthy();
    expect(screen.getByText('claimReward() · claimRewards(account, tokens)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /connect wallet/i })).toBeNull();
  });

  it('limits token governance to four immutable timelocked actions without a multisig bypass', () => {
    render(<HomePage />);

    expect(screen.getByText('Add a Strategy.')).toBeTruthy();
    expect(screen.getByText('Kill a Strategy.')).toBeTruthy();
    expect(screen.getByText('Add Bribe rewards.')).toBeTruthy();
    expect(screen.getByText('Increase Mine capacity, without repricing incumbent slots.')).toBeTruthy();
    expect(
      screen.getByText(/SignalGBX voting power operates an immutable ProtocolGovernor, the Timelock's sole proposer/i),
    ).toBeTruthy();
    expect(screen.getByText(/no multisig bypass, guardian, or queued-proposal veto/i)).toBeTruthy();
    expect(screen.getByText(/internally hardened deployment candidate/i)).toBeTruthy();
  });
});
