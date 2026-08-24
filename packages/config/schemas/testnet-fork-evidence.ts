import { isAddress } from 'viem';
import { z } from 'zod';

import evidenceJson from '../deployments/robinhood-testnet-fork-evidence.json' with { type: 'json' };

const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const nonzeroAddressSchema = z
  .string()
  .refine(isAddress, 'Expected an EVM address')
  .refine((value) => value.toLowerCase() !== ZERO_ADDRESS, 'Address must be nonzero');
const nonzeroBytes32Schema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine((value) => value !== ZERO_BYTES32, 'Bytes32 value must be nonzero');
const positiveBlockSchema = z
  .string()
  .regex(/^\d+$/)
  .refine((value) => BigInt(value) > 0n, 'Fork block must be positive');

export const TESTNET_FORK_EVIDENCE_MAX_VALIDITY_MS = 24 * 60 * 60 * 1_000;
export const TESTNET_FORK_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS = 15 * 60 * 1_000;
export const TESTNET_FORK_OBSERVATION_MIN_CONFIRMATIONS = 64n;
export const TESTNET_FORK_OBSERVATION_MAX_HEAD_AGE_MS = 5 * 60 * 1_000;
export const TESTNET_FORK_OBSERVATION_MAX_HEAD_FUTURE_SKEW_MS = 60 * 1_000;

const dependencySchema = z
  .object({
    address: nonzeroAddressSchema,
    runtimeBytecodeHash: nonzeroBytes32Schema,
  })
  .strict();

const configuredSchema = z
  .object({
    blockHash: nonzeroBytes32Schema,
    blockNumber: positiveBlockSchema,
    chainId: z.literal(46630),
    dependencies: z
      .object({
        usdG: dependencySchema,
      })
      .strict(),
    expiresAt: z.string().datetime({ offset: true }),
    kind: z.literal('gumball-6900-robinhood-testnet-fork-evidence'),
    observedAt: z.string().datetime({ offset: true }),
    parentBlockHash: nonzeroBytes32Schema,
    protocol: z.literal('GUM BALL 6900'),
    schemaVersion: z.literal(1),
    sourceUrl: z.string().url(),
    state: z.literal('configured'),
  })
  .strict()
  .superRefine((evidence, context) => {
    const observedAt = Date.parse(evidence.observedAt);
    const expiresAt = Date.parse(evidence.expiresAt);
    if (expiresAt <= observedAt || expiresAt - observedAt > TESTNET_FORK_EVIDENCE_MAX_VALIDITY_MS) {
      context.addIssue({
        code: 'custom',
        message: 'Testnet fork evidence validity must be positive and no longer than 24 hours',
        path: ['expiresAt'],
      });
    }
  });

export const robinhoodTestnetForkEvidenceSchema = z.discriminatedUnion('state', [
  z
    .object({
      kind: z.literal('gumball-6900-robinhood-testnet-fork-evidence'),
      protocol: z.literal('GUM BALL 6900'),
      schemaVersion: z.literal(1),
      state: z.literal('unconfigured'),
    })
    .strict(),
  configuredSchema,
]);

export type RobinhoodTestnetForkEvidence = z.infer<typeof robinhoodTestnetForkEvidenceSchema>;
export type ConfiguredRobinhoodTestnetForkEvidence = z.infer<typeof configuredSchema>;

export function parseRobinhoodTestnetForkEvidence(value: unknown): RobinhoodTestnetForkEvidence {
  return robinhoodTestnetForkEvidenceSchema.parse(value);
}

export function requireConfiguredRobinhoodTestnetForkEvidence(value: unknown): ConfiguredRobinhoodTestnetForkEvidence {
  const evidence = parseRobinhoodTestnetForkEvidence(value);
  if (evidence.state !== 'configured') throw new Error('Robinhood testnet fork evidence is unconfigured');
  return evidence;
}

/** Wall-clock release check kept separate so historical evidence remains structurally inspectable. */
export function requireFreshRobinhoodTestnetForkEvidence(
  value: unknown,
  nowMs = Date.now(),
): ConfiguredRobinhoodTestnetForkEvidence {
  const evidence = requireConfiguredRobinhoodTestnetForkEvidence(value);
  const observedAt = Date.parse(evidence.observedAt);
  const expiresAt = Date.parse(evidence.expiresAt);
  if (observedAt > nowMs) throw new Error('Robinhood testnet fork evidence is future-dated');
  if (expiresAt <= nowMs) throw new Error('Robinhood testnet fork evidence has expired');
  if (expiresAt - observedAt > TESTNET_FORK_EVIDENCE_MAX_VALIDITY_MS) {
    throw new Error('Robinhood testnet fork evidence validity exceeds 24 hours');
  }
  return evidence;
}

/**
 * Build-bound release input. A release-approved manifest signs source commit C, which binds this exact raw file.
 */
export const robinhoodTestnetForkEvidence = parseRobinhoodTestnetForkEvidence(evidenceJson);

export interface TestnetForkBlockHeader {
  hash: string | null;
  number: bigint;
  timestamp: bigint;
}

export interface TestnetForkHeaderProvider {
  getBlock(args: { blockNumber?: bigint }): Promise<TestnetForkBlockHeader>;
  getChainId(): Promise<number>;
}

export interface LiveTestnetForkObservationResult {
  confirmations: bigint;
  headBlock: bigint;
  headHash: string;
  observationBlock: bigint;
}

function requiredHeader(header: TestnetForkBlockHeader, label: string): TestnetForkBlockHeader & { hash: string } {
  if (
    header.hash === null ||
    !/^0x[0-9a-fA-F]{64}$/.test(header.hash) ||
    /^0x0{64}$/i.test(header.hash) ||
    header.number < 0n ||
    header.timestamp < 0n
  ) {
    throw new Error(`${label} header is invalid`);
  }
  return header as TestnetForkBlockHeader & { hash: string };
}

function timestampMs(timestamp: bigint, label: string): number {
  if (timestamp > BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1_000))) {
    throw new Error(`${label} timestamp exceeds the safe wall-clock range`);
  }
  return Number(timestamp) * 1_000;
}

/** Live RPC boundary preventing a fresh signature from laundering an old testnet fork block. */
export async function verifyLiveRobinhoodTestnetForkEvidence(
  provider: TestnetForkHeaderProvider,
  value: unknown,
  nowMs = Date.now(),
): Promise<LiveTestnetForkObservationResult> {
  if (!Number.isFinite(nowMs)) throw new Error('Testnet fork verification time is invalid');
  const evidence = requireFreshRobinhoodTestnetForkEvidence(value, nowMs);
  if ((await provider.getChainId()) !== 46_630) throw new Error('Testnet fork RPC chain ID is not 46630');

  const observationBlock = BigInt(evidence.blockNumber);
  const firstObservation = requiredHeader(
    await provider.getBlock({ blockNumber: observationBlock }),
    `Testnet observation block ${observationBlock}`,
  );
  const head = requiredHeader(await provider.getBlock({}), 'Current testnet head');
  const secondObservation = requiredHeader(
    await provider.getBlock({ blockNumber: observationBlock }),
    `Testnet observation block ${observationBlock} re-read`,
  );
  for (const observation of [firstObservation, secondObservation]) {
    if (observation.number !== observationBlock || observation.hash.toLowerCase() !== evidence.blockHash) {
      throw new Error(`Testnet observation block ${observationBlock} does not match its signed hash`);
    }
  }
  if (firstObservation.hash.toLowerCase() !== secondObservation.hash.toLowerCase()) {
    throw new Error(`Testnet observation block ${observationBlock} changed during verification`);
  }

  const observedAt = Date.parse(evidence.observedAt);
  const observationTimestampMs = timestampMs(firstObservation.timestamp, 'Testnet observation block');
  if (observationTimestampMs > observedAt) {
    throw new Error('Testnet fork observedAt predates its observation block');
  }
  if (observedAt - observationTimestampMs > TESTNET_FORK_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS) {
    throw new Error('Testnet fork observedAt is detached from a block older than 15 minutes');
  }

  if (head.number < observationBlock) throw new Error('Current testnet head predates the observation block');
  const confirmations = head.number - observationBlock;
  if (confirmations < TESTNET_FORK_OBSERVATION_MIN_CONFIRMATIONS) {
    throw new Error(
      `Testnet fork observation has ${confirmations} confirmations; ${TESTNET_FORK_OBSERVATION_MIN_CONFIRMATIONS} are required`,
    );
  }
  if (head.timestamp < firstObservation.timestamp) {
    throw new Error('Current testnet head timestamp predates the observation block');
  }
  const headTimestampMs = timestampMs(head.timestamp, 'Current testnet head');
  if (headTimestampMs > nowMs + TESTNET_FORK_OBSERVATION_MAX_HEAD_FUTURE_SKEW_MS) {
    throw new Error('Current testnet head timestamp is materially in the future');
  }
  if (nowMs - headTimestampMs > TESTNET_FORK_OBSERVATION_MAX_HEAD_AGE_MS) {
    throw new Error('Current testnet head is more than 5 minutes stale');
  }

  return {
    confirmations,
    headBlock: head.number,
    headHash: head.hash.toLowerCase(),
    observationBlock,
  };
}
