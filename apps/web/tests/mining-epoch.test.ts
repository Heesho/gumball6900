import { WAD } from '@gumball-6900/sdk';
import { describe, expect, it } from 'vitest';

import type { CurrentMiningEpochSnapshot } from '../hooks/use-protocol-reads';
import { estimateCurrentMiningContribution, miningSecondsRemaining } from '../lib/mining-epoch';

function snapshot(overrides: Partial<CurrentMiningEpochSnapshot> = {}): CurrentMiningEpochSnapshot {
  return {
    beneficiaryContribution: 250_000_000n,
    blockNumber: 50n,
    blockTimestamp: 1_000n,
    contributionsPaused: false,
    currentScheduledEmission: 10_000n * WAD,
    endTime: 2_000n,
    epochId: 4n,
    extensionUsed: 0n,
    invalidated: false,
    referenceMiningPrice: WAD,
    remainingMintCapacity: 900_000_000n * WAD,
    startTime: 500n,
    totalContributed: 1_000_000_000n,
    usdGDecimals: 6,
    ...overrides,
  };
}

describe('current mining epoch estimates', () => {
  it('includes the requested amount in both demand and beneficiary estimates', () => {
    const smaller = estimateCurrentMiningContribution(snapshot(), 500_000_000n);
    const larger = estimateCurrentMiningContribution(snapshot(), 1_500_000_000n);

    expect(smaller.totalContributedAfter).toBe(1_500_000_000n);
    expect(smaller.beneficiaryContributionAfter).toBe(750_000_000n);
    expect(larger.estimatedBeneficiaryGBX).toBeGreaterThan(smaller.estimatedBeneficiaryGBX);
    expect(larger.quote.actualEmission).toBeGreaterThan(smaller.quote.actualEmission);
  });

  it('zeroes invalidated emissions and follows the minimum-price reference path', () => {
    const estimate = estimateCurrentMiningContribution(snapshot({ invalidated: true }), 500_000_000n);

    expect(estimate.quote.actualEmission).toBe(0n);
    expect(estimate.quote.affordableEmission).toBe(0n);
    expect(estimate.quote.clearingPrice).toBe(0n);
    expect(estimate.quote.minimumMiningPrice).toBe((95n * WAD) / 100n);
    expect(estimate.quote.nextReferenceMiningPrice).toBe(estimate.quote.minimumMiningPrice);
    expect(estimate.estimatedBeneficiaryGBX).toBe(0n);
  });

  it('derives the countdown from the pinned block timestamp', () => {
    expect(miningSecondsRemaining(snapshot())).toBe(1_000);
    expect(miningSecondsRemaining(snapshot({ blockTimestamp: 2_000n }))).toBe(0);
  });
});
