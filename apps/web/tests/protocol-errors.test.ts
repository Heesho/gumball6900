import { acquisitionStrategyAbi, gbxAbi, gumBallVaultAbi, managerRewardsAbi } from '@gumball-6900/sdk';
import { encodeErrorResult } from 'viem';
import { describe, expect, it } from 'vitest';

import { humanizeTransactionError } from '../hooks/use-protocol-transaction';
import { nestedRevertData, protocolErrorAbiForTarget } from '../lib/protocol-errors';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

describe('bounded protocol revert decoding', () => {
  it('decodes deeply nested vault custom errors against the manifest-pinned destination ABI', () => {
    const data = encodeErrorResult({
      abi: gumBallVaultAbi,
      errorName: 'GumBallVault__IneligibleReceiver',
      args: [fixtureAddress(999)],
    });
    const error = { cause: { error: { originalError: { data } } } };

    expect(
      humanizeTransactionError(error, {
        runtime: liveRuntimeFixture,
        target: liveRuntimeFixture.addresses.gumBallVault,
      }),
    ).toBe('The receiving wallet is not eligible to hold one or more assets in the redemption basket.');
  });

  it('maps stale auction IDs to actionable copy and never exposes custom-error arguments', () => {
    const data = encodeErrorResult({
      abi: acquisitionStrategyAbi,
      errorName: 'AcquisitionStrategy__StaleAuctionId',
      args: [4n, 5n],
    });
    const message = humanizeTransactionError(
      { cause: { raw: data }, message: `execution reverted with private provider detail ${data}` },
      { runtime: liveRuntimeFixture, target: liveRuntimeFixture.strategies.NVDA },
    );

    expect(message).toBe('The auction changed after your quote. Refresh and review the new terms.');
    expect(message).not.toContain(data);
    expect(message).not.toContain('private provider detail');
  });

  it('decodes a generated acquisition ABI for a Lens-validated post-launch strategy', () => {
    const dynamicStrategy = fixtureAddress(900);
    const data = encodeErrorResult({
      abi: acquisitionStrategyAbi,
      errorName: 'AcquisitionStrategy__ObservedSplitMismatch',
      args: [98n, 97n, 2n, 3n],
    });

    expect(protocolErrorAbiForTarget(liveRuntimeFixture, dynamicStrategy)).toBeNull();
    expect(protocolErrorAbiForTarget(liveRuntimeFixture, dynamicStrategy, 'acquisition-strategy')).not.toBeNull();
    expect(
      humanizeTransactionError(
        { cause: { data }, message: `execution reverted with private amounts 98, 97, 2, 3 ${data}` },
        {
          runtime: liveRuntimeFixture,
          target: dynamicStrategy,
          validatedContractKind: 'acquisition-strategy',
        },
      ),
    ).toBe(
      'Acquisition strategy rejected the transaction: observed split mismatch. Refresh the latest state and review the action.',
    );
  });

  it('uses the generated ManagerRewards ABI for dynamic reward claims and dust sweeps', () => {
    const dynamicRewards = fixtureAddress(901);
    const data = encodeErrorResult({
      abi: managerRewardsAbi,
      errorName: 'ManagerRewards__NoPendingTerminalDust',
      args: [4n, 9n],
    });
    const message = humanizeTransactionError(
      { cause: { raw: data }, message: 'execution reverted with secret coordinate details' },
      {
        runtime: liveRuntimeFixture,
        target: dynamicRewards,
        validatedContractKind: 'manager-rewards',
      },
    );

    expect(message).toBe('This terminal-dust coordinate is no longer pending. Refresh the queue before retrying.');
    expect(message).not.toContain('4');
    expect(message).not.toContain('9');
    expect(message).not.toContain('secret');
  });

  it('decodes generated ERC-20 errors for GBX and Lens-validated dynamic asset approvals', () => {
    const dynamicAsset = fixtureAddress(903);
    const data = encodeErrorResult({
      abi: gbxAbi,
      errorName: 'ERC20InsufficientAllowance',
      args: [fixtureAddress(904), 7n, 8n],
    });

    for (const target of [liveRuntimeFixture.addresses.gbx, dynamicAsset]) {
      expect(
        humanizeTransactionError(
          { cause: { data }, message: 'execution reverted with private allowance values' },
          {
            runtime: liveRuntimeFixture,
            target,
            validatedContractKind: 'erc20',
          },
        ),
      ).toBe('The token allowance is no longer sufficient. Review and approve the exact amount.');
    }
  });

  it('does not decode a valid selector for an unpinned or different target and keeps the fallback sanitized', () => {
    const data = encodeErrorResult({
      abi: acquisitionStrategyAbi,
      errorName: 'AcquisitionStrategy__StaleAuctionId',
      args: [4n, 5n],
    });
    const error = { cause: { data }, shortMessage: 'secret RPC implementation detail', message: 'execution reverted' };

    expect(protocolErrorAbiForTarget(liveRuntimeFixture, fixtureAddress(999))).toBeNull();
    expect(
      protocolErrorAbiForTarget(liveRuntimeFixture, liveRuntimeFixture.addresses.gumBallVault, 'manager-rewards'),
    ).toBeNull();
    expect(
      humanizeTransactionError(error, {
        runtime: liveRuntimeFixture,
        target: liveRuntimeFixture.addresses.gumBallVault,
      }),
    ).toBe('Simulation reverted. Review eligibility, allowance, and amount.');
  });

  it('keeps the sanitized fallback for an unknown selector even when the dynamic contract kind is valid', () => {
    const error = {
      cause: { data: '0xdeadbeef' },
      message: 'execution reverted with private provider diagnostics',
    };

    expect(
      humanizeTransactionError(error, {
        runtime: liveRuntimeFixture,
        target: fixtureAddress(902),
        validatedContractKind: 'manager-rewards',
      }),
    ).toBe('Simulation reverted. Review eligibility, allowance, and amount.');
  });

  it('bounds cyclic nested error traversal', () => {
    const cyclic: Record<string, unknown> = { data: `0x${'12'.repeat(4)}` };
    cyclic.cause = cyclic;
    expect(nestedRevertData(cyclic)).toEqual([`0x${'12'.repeat(4)}`]);
  });
});
