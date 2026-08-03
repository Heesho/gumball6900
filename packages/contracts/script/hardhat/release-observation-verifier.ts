import type { Provider } from 'ethers';

import type { ReleaseObservation } from './release-manifest-binding';

/**
 * A signed observation must be made soon after its block was produced. This prevents a fresh
 * `observedAt` signature from laundering an arbitrarily old historical block.
 */
export const RELEASE_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS = 15 * 60 * 1_000;

/** A release observation must be buried by this many newer blocks when it is authorized. */
export const RELEASE_OBSERVATION_MIN_CONFIRMATIONS = 64n;

/** A halted or badly lagging RPC head is not acceptable release evidence. */
export const RELEASE_OBSERVATION_MAX_HEAD_AGE_MS = 5 * 60 * 1_000;

/** Small clock skew is tolerated, but an RPC head materially in the future fails closed. */
export const RELEASE_OBSERVATION_MAX_HEAD_FUTURE_SKEW_MS = 60 * 1_000;

type BlockHeader = Awaited<ReturnType<Provider['getBlock']>>;

function requiredBlockHeader(block: BlockHeader, label: string): NonNullable<BlockHeader> {
  if (block === null || block.hash === null) throw new Error(`${label} is unavailable`);
  if (
    !Number.isSafeInteger(block.number) ||
    block.number < 0 ||
    !Number.isSafeInteger(block.timestamp) ||
    block.timestamp < 0 ||
    !/^0x[0-9a-fA-F]{64}$/.test(block.hash) ||
    /^0x0{64}$/i.test(block.hash)
  ) {
    throw new Error(`${label} header is invalid`);
  }
  return block;
}

function assertSignedHeader(
  block: NonNullable<BlockHeader>,
  observation: ReleaseObservation,
  observationBlock: bigint,
): void {
  if (BigInt(block.number) !== observationBlock) {
    throw new Error(`Observation RPC returned block ${block.number} for signed block ${observationBlock}`);
  }
  if (block.hash!.toLowerCase() !== observation.blockHash) {
    throw new Error(`Observation block hash mismatch at ${observationBlock}`);
  }
}

export interface LiveReleaseObservationResult {
  confirmations: bigint;
  headBlock: bigint;
  headHash: string;
  observationBlock: bigint;
}

/**
 * Re-reads the signed header around a current-head query and applies the live release policy.
 * This is an authorization-time liveness/reorg boundary, not a claim of protocol-level finality.
 */
export async function verifyLiveReleaseObservation(
  provider: Pick<Provider, 'getBlock'>,
  observation: ReleaseObservation,
  nowMs = Date.now(),
): Promise<LiveReleaseObservationResult> {
  if (!Number.isFinite(nowMs)) throw new Error('Release observation verification time is invalid');
  if (!/^[1-9][0-9]*$/.test(observation.blockNumber)) {
    throw new Error('Release observation block number is invalid');
  }
  if (!/^0x[0-9a-f]{64}$/.test(observation.blockHash) || /^0x0{64}$/.test(observation.blockHash)) {
    throw new Error('Release observation block hash is invalid');
  }
  const observedAt = Date.parse(observation.observedAt);
  if (!Number.isFinite(observedAt) || observedAt > nowMs) {
    throw new Error('Release observation observedAt is invalid or in the future');
  }

  const observationBlock = BigInt(observation.blockNumber);
  if (observationBlock > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Observation block exceeds safe provider range');
  }
  const observationBlockTag = Number(observationBlock);
  const firstSignedHeader = requiredBlockHeader(
    await provider.getBlock(observationBlockTag),
    `Observation block ${observationBlock}`,
  );
  assertSignedHeader(firstSignedHeader, observation, observationBlock);

  const head = requiredBlockHeader(await provider.getBlock('latest'), 'Current chain head');
  const secondSignedHeader = requiredBlockHeader(
    await provider.getBlock(observationBlockTag),
    `Observation block ${observationBlock} re-read`,
  );
  assertSignedHeader(secondSignedHeader, observation, observationBlock);
  if (secondSignedHeader.hash!.toLowerCase() !== firstSignedHeader.hash!.toLowerCase()) {
    throw new Error(`Observation block ${observationBlock} changed while it was being verified`);
  }

  const observationTimestampMs = firstSignedHeader.timestamp * 1_000;
  if (observationTimestampMs > observedAt) {
    throw new Error('Signed observedAt timestamp predates its observation block');
  }
  if (observedAt - observationTimestampMs > RELEASE_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS) {
    throw new Error('Signed observedAt is detached from an observation block older than 15 minutes');
  }

  const headBlock = BigInt(head.number);
  if (headBlock < observationBlock) {
    throw new Error(`Current chain head ${headBlock} predates signed observation block ${observationBlock}`);
  }
  const confirmations = headBlock - observationBlock;
  if (confirmations < RELEASE_OBSERVATION_MIN_CONFIRMATIONS) {
    throw new Error(
      `Signed observation has ${confirmations} confirmations; ${RELEASE_OBSERVATION_MIN_CONFIRMATIONS} are required`,
    );
  }
  if (head.timestamp < firstSignedHeader.timestamp) {
    throw new Error('Current chain head timestamp predates the signed observation block');
  }
  const headTimestampMs = head.timestamp * 1_000;
  if (headTimestampMs > nowMs + RELEASE_OBSERVATION_MAX_HEAD_FUTURE_SKEW_MS) {
    throw new Error('Current chain head timestamp is materially in the future');
  }
  if (nowMs - headTimestampMs > RELEASE_OBSERVATION_MAX_HEAD_AGE_MS) {
    throw new Error('Current chain head is more than 5 minutes stale');
  }

  return { confirmations, headBlock, headHash: head.hash!.toLowerCase(), observationBlock };
}
