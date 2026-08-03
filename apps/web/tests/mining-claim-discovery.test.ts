import { describe, expect, it, vi } from 'vitest';

import {
  canResumeContributionEpochScan,
  mapWithConcurrency,
  scanContributionEpochWindows,
} from '../lib/mining-claim-discovery';

describe('incremental mining contribution discovery', () => {
  it('uses inclusive non-overlapping windows and resumes from its checkpoint', async () => {
    const readWindow = vi
      .fn<(fromBlock: bigint, toBlock: bigint) => Promise<readonly bigint[]>>()
      .mockResolvedValueOnce([1n])
      .mockResolvedValueOnce([2n, 1n])
      .mockResolvedValueOnce([3n]);

    const first = await scanContributionEpochWindows(
      { deploymentBlock: 0n, maxWindows: 1, targetBlock: 40_000n, windowSize: 20_000n },
      readWindow,
    );
    expect(first).toMatchObject({ complete: false, nextFromBlock: 20_000n, scannedThroughBlock: 19_999n });

    const second = await scanContributionEpochWindows(
      {
        checkpoint: first,
        deploymentBlock: 0n,
        maxWindows: 1,
        targetBlock: 40_000n,
        windowSize: 20_000n,
      },
      readWindow,
    );
    expect(second).toMatchObject({ complete: false, nextFromBlock: 40_000n, scannedThroughBlock: 39_999n });

    const third = await scanContributionEpochWindows(
      {
        checkpoint: second,
        deploymentBlock: 0n,
        maxWindows: 1,
        targetBlock: 40_000n,
        windowSize: 20_000n,
      },
      readWindow,
    );
    expect(third).toMatchObject({ complete: true, nextFromBlock: 40_001n, scannedThroughBlock: 40_000n });
    expect(new Set(third.epochIds)).toEqual(new Set([1n, 2n, 3n]));
    expect(readWindow.mock.calls).toEqual([
      [0n, 19_999n],
      [20_000n, 39_999n],
      [40_000n, 40_000n],
    ]);
  });

  it('completes an exact-size window without requesting an extra range', async () => {
    const readWindow = vi.fn(async () => [] as readonly bigint[]);
    const result = await scanContributionEpochWindows(
      { deploymentBlock: 10n, maxWindows: 1, targetBlock: 20_009n, windowSize: 20_000n },
      readWindow,
    );

    expect(result.complete).toBe(true);
    expect(readWindow).toHaveBeenCalledExactlyOnceWith(10n, 20_009n);
  });

  it('fails closed when deployment is newer than the pinned head', async () => {
    const readWindow = vi.fn(async () => [] as readonly bigint[]);
    await expect(
      scanContributionEpochWindows({ deploymentBlock: 101n, targetBlock: 100n }, readWindow),
    ).rejects.toThrow('deploymentBlock exceeds the pinned chain head');
    expect(readWindow).not.toHaveBeenCalled();
  });

  it('surfaces a failed RPC window instead of advancing the checkpoint silently', async () => {
    await expect(
      scanContributionEpochWindows({ deploymentBlock: 0n, targetBlock: 10n }, async () => {
        throw new Error('range unavailable');
      }),
    ).rejects.toThrow('range unavailable');
  });

  it('invalidates an incremental checkpoint after a backward head or changed anchor hash', () => {
    expect(canResumeContributionEpochScan(100n, '0xaaa', 101n, '0xaaa')).toBe(true);
    expect(canResumeContributionEpochScan(100n, '0xaaa', 99n, '0xaaa')).toBe(false);
    expect(canResumeContributionEpochScan(100n, '0xaaa', 101n, '0xbbb')).toBe(false);
    expect(canResumeContributionEpochScan(100n, '0xaaa', 101n, null)).toBe(false);
  });
});

describe('bounded claim read concurrency', () => {
  it('preserves result order while respecting the worker cap', async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await mapWithConcurrency([0, 1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return value * 10;
    });

    expect(maximumActive).toBe(2);
    expect(results).toEqual([0, 10, 20, 30, 40]);
  });
});
