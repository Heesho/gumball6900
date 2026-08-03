import type { Hex, PublicClient } from 'viem';

import { bytes32Schema, unsignedBigIntSchema } from './validation.js';

export interface BlockSnapshot {
  readonly blockHash: Hex;
  readonly blockNumber: bigint;
  /** Canonical timestamp returned with the pinned header when the RPC supplies it. */
  readonly blockTimestamp?: bigint;
}

export class BlockSnapshotChangedError extends Error {
  constructor(message = 'Chain state changed during block-pinned reads.') {
    super(message);
    this.name = 'BlockSnapshotChangedError';
  }
}

function parseHash(value: unknown): Hex {
  return bytes32Schema.parse(value) as Hex;
}

/** Pins a block number and hash, optionally requiring a caller-supplied hash for cross-read coherence. */
export async function pinBlockSnapshot(
  client: PublicClient,
  atBlock?: bigint,
  expectedBlockHash?: Hex,
): Promise<BlockSnapshot> {
  const requestedBlock = atBlock === undefined ? undefined : unsignedBigIntSchema.parse(atBlock);
  const block =
    requestedBlock === undefined
      ? await client.getBlock({ blockTag: 'latest' })
      : await client.getBlock({ blockNumber: requestedBlock });
  const blockNumber = unsignedBigIntSchema.parse(block.number);
  const blockHash = parseHash(block.hash);
  const blockTimestamp = block.timestamp === undefined ? undefined : unsignedBigIntSchema.parse(block.timestamp);
  if (requestedBlock !== undefined && blockNumber !== requestedBlock) {
    throw new BlockSnapshotChangedError('RPC returned a different block number than requested.');
  }
  if (expectedBlockHash !== undefined && blockHash.toLowerCase() !== parseHash(expectedBlockHash).toLowerCase()) {
    throw new BlockSnapshotChangedError();
  }
  return blockTimestamp === undefined ? { blockHash, blockNumber } : { blockHash, blockNumber, blockTimestamp };
}

/** Re-reads a pinned block header and fails if a reorg replaced the observed block hash. */
export async function revalidateBlockSnapshot(client: PublicClient, snapshot: BlockSnapshot): Promise<void> {
  const block = await client.getBlock({ blockNumber: snapshot.blockNumber });
  const blockNumber = unsignedBigIntSchema.parse(block.number);
  const blockHash = parseHash(block.hash);
  if (blockNumber !== snapshot.blockNumber || blockHash.toLowerCase() !== snapshot.blockHash.toLowerCase()) {
    throw new BlockSnapshotChangedError();
  }
}
