export const CLAIM_EVENT_BLOCK_RANGE = 20_000n;
export const MAX_CLAIM_SCAN_WINDOWS_PER_PASS = 32;
export const MAX_CLAIM_READ_CONCURRENCY = 8;

export interface ContributionEpochScanCheckpoint {
  readonly epochIds: readonly bigint[];
  readonly nextFromBlock: bigint;
}

export interface ContributionEpochScanResult extends ContributionEpochScanCheckpoint {
  readonly complete: boolean;
  readonly scannedThroughBlock: bigint | null;
  readonly targetBlock: bigint;
}

export interface ContributionEpochScanInput {
  readonly checkpoint?: ContributionEpochScanCheckpoint | undefined;
  readonly deploymentBlock: bigint;
  readonly maxWindows?: number | undefined;
  readonly targetBlock: bigint;
  readonly windowSize?: bigint | undefined;
}

export function canResumeContributionEpochScan(
  anchorBlockNumber: bigint,
  anchorBlockHash: string,
  currentHeadNumber: bigint,
  canonicalAnchorHash: string | null,
): boolean {
  return (
    anchorBlockNumber <= currentHeadNumber && canonicalAnchorHash !== null && canonicalAnchorHash === anchorBlockHash
  );
}

/**
 * Advances contribution discovery by a bounded number of inclusive block windows.
 * The returned checkpoint can be supplied to the next pass without rescanning old windows.
 */
export async function scanContributionEpochWindows(
  input: ContributionEpochScanInput,
  readWindow: (fromBlock: bigint, toBlock: bigint) => Promise<readonly bigint[]>,
): Promise<ContributionEpochScanResult> {
  const windowSize = input.windowSize ?? CLAIM_EVENT_BLOCK_RANGE;
  const maxWindows = input.maxWindows ?? MAX_CLAIM_SCAN_WINDOWS_PER_PASS;
  if (input.deploymentBlock < 0n) throw new RangeError('deploymentBlock must be non-negative');
  if (input.targetBlock < 0n) throw new RangeError('targetBlock must be non-negative');
  if (input.deploymentBlock > input.targetBlock) {
    throw new RangeError('deploymentBlock exceeds the pinned chain head');
  }
  if (windowSize <= 0n) throw new RangeError('windowSize must be positive');
  if (!Number.isSafeInteger(maxWindows) || maxWindows <= 0) {
    throw new RangeError('maxWindows must be a positive safe integer');
  }

  const epochIds = new Set(input.checkpoint?.epochIds ?? []);
  let nextFromBlock = input.checkpoint?.nextFromBlock ?? input.deploymentBlock;
  if (nextFromBlock < input.deploymentBlock) {
    throw new RangeError('checkpoint precedes deploymentBlock');
  }

  let scannedThroughBlock: bigint | null = nextFromBlock > input.deploymentBlock ? nextFromBlock - 1n : null;
  let windowsRead = 0;
  while (nextFromBlock <= input.targetBlock && windowsRead < maxWindows) {
    const candidateEnd = nextFromBlock + windowSize - 1n;
    const toBlock = candidateEnd < input.targetBlock ? candidateEnd : input.targetBlock;
    for (const epochId of await readWindow(nextFromBlock, toBlock)) epochIds.add(epochId);
    scannedThroughBlock = toBlock;
    nextFromBlock = toBlock + 1n;
    windowsRead += 1;
  }

  return {
    complete: nextFromBlock > input.targetBlock,
    epochIds: [...epochIds],
    nextFromBlock,
    scannedThroughBlock,
    targetBlock: input.targetBlock,
  };
}

/** Maps with a fixed worker count so wallets with long histories cannot fan out unbounded RPC reads. */
export async function mapWithConcurrency<T, Result>(
  values: readonly T[],
  concurrency: number,
  map: (value: T, index: number) => Promise<Result>,
): Promise<readonly Result[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new RangeError('concurrency must be a positive safe integer');
  }
  const results = new Array<Result>(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await map(values[index]!, index);
      }
    }),
  );
  return results;
}
