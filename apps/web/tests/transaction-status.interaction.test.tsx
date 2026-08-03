import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { TransactionStatus } from '../components/protocol/transaction-state';
import { resolveRuntimeDeployment } from '../lib/runtime-config';

describe('transaction status interaction', () => {
  it('renders confirmed state and lets the user clear it', async () => {
    const onReset = vi.fn();
    const hash = `0x${'34'.repeat(32)}` as const;
    const runtime = await resolveRuntimeDeployment({ GUMBALL_CLIENT_MODE: 'demo' });
    render(
      <RuntimeDeploymentProvider runtime={runtime}>
        <TransactionStatus onReset={onReset} state={{ phase: 'success', label: 'Redeem GBX', hash, message: null }} />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByText('Confirmed')).toBeDefined();
    expect(screen.getByText('Redeem GBX')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
