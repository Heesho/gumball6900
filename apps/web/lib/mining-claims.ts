export const MAX_MINING_CLAIM_BATCH = 64;

export function chunkMiningClaimEpochs(epochIds: readonly bigint[]): readonly (readonly bigint[])[] {
  const batches: bigint[][] = [];
  for (let index = 0; index < epochIds.length; index += MAX_MINING_CLAIM_BATCH) {
    batches.push(epochIds.slice(index, index + MAX_MINING_CLAIM_BATCH));
  }
  return batches;
}

export interface MiningClaimBatchSubmissionResult<Result> {
  readonly confirmedResults: readonly Result[];
  readonly failedBatchIndex: number | null;
  readonly totalBatches: number;
}

/** Stops at the first unconfirmed batch; callers must refresh before retrying the remainder. */
export async function submitMiningClaimBatches<Result>(
  batches: readonly (readonly bigint[])[],
  submit: (batch: readonly bigint[], index: number, total: number) => Promise<Result | null>,
): Promise<MiningClaimBatchSubmissionResult<Result>> {
  const confirmedResults: Result[] = [];
  for (const [index, batch] of batches.entries()) {
    const result = await submit(batch, index, batches.length);
    if (result === null) {
      return { confirmedResults, failedBatchIndex: index, totalBatches: batches.length };
    }
    confirmedResults.push(result);
  }
  return { confirmedResults, failedBatchIndex: null, totalBatches: batches.length };
}
