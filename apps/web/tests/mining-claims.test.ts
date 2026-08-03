import { describe, expect, it } from 'vitest';

import { chunkMiningClaimEpochs, MAX_MINING_CLAIM_BATCH, submitMiningClaimBatches } from '../lib/mining-claims';

describe('mining claim batching', () => {
  it.each([
    { count: 65, lengths: [64, 1] },
    { count: 129, lengths: [64, 64, 1] },
  ])('splits $count epochs at the onchain batch cap', ({ count, lengths }) => {
    const epochIds = Array.from({ length: count }, (_, index) => BigInt(index));
    const batches = chunkMiningClaimEpochs(epochIds);

    expect(batches.map((batch) => batch.length)).toEqual(lengths);
    expect(batches.flat()).toEqual(epochIds);
    expect(batches.every((batch) => batch.length <= MAX_MINING_CLAIM_BATCH)).toBe(true);
  });

  it('returns no transactions for an empty claim set', () => {
    expect(chunkMiningClaimEpochs([])).toEqual([]);
  });

  it('stops after a failed later batch and reports confirmed progress', async () => {
    const batches = chunkMiningClaimEpochs(Array.from({ length: 129 }, (_, index) => BigInt(index)));
    const submitted: number[] = [];
    const result = await submitMiningClaimBatches(batches, async (_batch, index) => {
      submitted.push(index);
      return index === 1 ? null : `hash-${index}`;
    });

    expect(submitted).toEqual([0, 1]);
    expect(result).toEqual({ confirmedResults: ['hash-0'], failedBatchIndex: 1, totalBatches: 3 });
  });

  it('reports all confirmed batches when the sequence completes', async () => {
    const batches = chunkMiningClaimEpochs(Array.from({ length: 65 }, (_, index) => BigInt(index)));
    const result = await submitMiningClaimBatches(batches, async (_batch, index) => `hash-${index}`);

    expect(result).toEqual({ confirmedResults: ['hash-0', 'hash-1'], failedBatchIndex: null, totalBatches: 2 });
  });
});
