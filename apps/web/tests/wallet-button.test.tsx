import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { WalletButton } from '../components/shell/wallet-button';
import { liveRuntimeFixture } from './live-runtime-fixture';

vi.mock('@rainbow-me/rainbowkit', () => ({
  useAccountModal: () => ({ openAccountModal: vi.fn() }),
  useChainModal: () => ({ openChainModal: vi.fn() }),
  useConnectModal: () => ({ openConnectModal: vi.fn() }),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => liveRuntimeFixture.chain.id,
}));

describe('wallet explanation dialog accessibility', () => {
  it('moves focus inside, closes on Escape, and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <WalletButton />
      </RuntimeDeploymentProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Connect wallet' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Wallet connection status' });
    const chooser = screen.getByRole('button', { name: 'Choose a wallet' });
    expect(dialog).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(chooser));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Wallet connection status' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
