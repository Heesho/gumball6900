import { getAddress, isAddress, isHex, keccak256, type Address, type Hex } from 'viem';
import { z } from 'zod';

import { robinhoodMainnetAssetManifest } from '../assets/robinhood.js';
import { compareCodeUnits } from './deterministic-json.js';
import type { EvmJsonRpcClient } from './json-rpc.js';

const hashSchema = z.string().regex(/^0x[0-9a-f]{64}$/);
const addressSchema = z.string().refine(isAddress, 'Expected an EVM address');

export const expectedBytecodeHashesSchema = z
  .object({
    blockNumber: z.string().regex(/^\d+$/),
    chainId: z.literal(4663),
    hashes: z.record(z.string().min(1), hashSchema),
    observedAt: z.string().datetime({ offset: true }),
    schemaVersion: z.literal(1),
    sourceRpcLabel: z.string().min(1),
    status: z.literal('provisional'),
  })
  .strict();

export type ExpectedBytecodeHashes = z.infer<typeof expectedBytecodeHashesSchema>;

export interface BytecodeTarget {
  readonly address: Address;
  readonly key: string;
  readonly source: 'canonical-token';
}

const verifiedBytecodeTargetSchema = z
  .object({
    address: addressSchema,
    expectedRuntimeBytecodeHash: hashSchema.nullable(),
    key: z.string().min(1),
    runtimeBytecodeHash: hashSchema,
    source: z.literal('canonical-token'),
  })
  .strict();

export const bytecodeVerificationReportSchema = z
  .object({
    blockHash: hashSchema,
    chainId: z.literal(4663),
    blockNumber: z.string().regex(/^\d+$/),
    deploymentApproved: z.literal(false),
    kind: z.literal('canonical-bytecode-verification'),
    observedAt: z.string().datetime({ offset: true }),
    parentBlockHash: hashSchema,
    schemaVersion: z.literal(1),
    status: z.enum(['collected-unapproved', 'matched-provisional-pins']),
    targets: z.array(verifiedBytecodeTargetSchema).min(1),
  })
  .strict()
  .superRefine((report, context) => {
    const keys = report.targets.map(({ key }) => key);
    const sortedKeys = [...keys].sort(compareCodeUnits);
    if (keys.some((key, index) => key !== sortedKeys[index])) {
      context.addIssue({ code: 'custom', message: 'Targets must be sorted by key', path: ['targets'] });
    }
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: 'custom', message: 'Target keys must be unique', path: ['targets'] });
    }
  });

export type BytecodeVerificationReport = z.infer<typeof bytecodeVerificationReportSchema>;

export interface VerifyCanonicalBytecodeOptions {
  readonly blockNumber?: bigint;
  readonly expectedHashes?: ExpectedBytecodeHashes;
  readonly observedAt: string;
  readonly requirePinnedHashes?: boolean;
  readonly rpc: EvmJsonRpcClient;
  readonly targets?: readonly BytecodeTarget[];
}

interface RpcBlock {
  readonly hash: Hex;
  readonly number: bigint;
  readonly parentHash: Hex;
  readonly timestamp: bigint;
}

function parseHexData(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHex(value, { strict: true })) {
    throw new Error(`${label} returned invalid hex data`);
  }
  return value;
}

function parseChainId(value: unknown): number {
  const chainId = Number(BigInt(parseHexData(value, 'eth_chainId')));
  if (!Number.isSafeInteger(chainId)) {
    throw new Error('eth_chainId exceeds the safe integer range');
  }
  return chainId;
}

function parseQuantity(value: unknown, label: string): bigint {
  const quantity = parseHexData(value, label);
  if (!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(quantity)) {
    throw new Error(`${label} returned a non-canonical quantity`);
  }
  return BigInt(quantity);
}

function blockTagFor(blockNumber: bigint): Hex {
  if (blockNumber < 0n) throw new Error('Block number must be nonnegative');
  return `0x${blockNumber.toString(16)}`;
}

function parseBytes32(value: unknown, label: string): Hex {
  const parsed = parseHexData(value, label).toLowerCase() as Hex;
  if (!/^0x[0-9a-f]{64}$/.test(parsed)) throw new Error(`${label} did not return bytes32 data`);
  return parsed;
}

function parseBlock(value: unknown, expectedBlockNumber: bigint): RpcBlock {
  if (typeof value !== 'object' || value === null) throw new Error('Pinned block response is missing');
  const record = value as Record<string, unknown>;
  const number = parseQuantity(record.number, 'pinnedBlock.number');
  if (number !== expectedBlockNumber) throw new Error('Pinned block number does not match the requested block');
  return {
    hash: parseBytes32(record.hash, 'pinnedBlock.hash'),
    number,
    parentHash: parseBytes32(record.parentHash, 'pinnedBlock.parentHash'),
    timestamp: parseQuantity(record.timestamp, 'pinnedBlock.timestamp'),
  };
}

function blockTimestampIso(timestamp: bigint): string {
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Pinned block timestamp exceeds safe date range');
  const date = new Date(Number(timestamp) * 1_000);
  if (!Number.isFinite(date.getTime())) throw new Error('Pinned block timestamp is invalid');
  return date.toISOString();
}

export function canonicalRobinhoodMainnetBytecodeTargets(): readonly BytecodeTarget[] {
  const tokenTargets = robinhoodMainnetAssetManifest.canonicalTokens.map((token) => ({
    address: getAddress(token.address),
    key: token.key,
    source: 'canonical-token' as const,
  }));
  return tokenTargets.sort((left, right) => compareCodeUnits(left.key, right.key));
}

export async function verifyCanonicalBytecode(
  options: VerifyCanonicalBytecodeOptions,
): Promise<BytecodeVerificationReport> {
  const observedAt = z.string().datetime({ offset: true }).parse(options.observedAt);
  const requirePinnedHashes = options.requirePinnedHashes ?? true;
  const expectedHashes =
    options.expectedHashes === undefined ? undefined : expectedBytecodeHashesSchema.parse(options.expectedHashes);
  if (requirePinnedHashes && expectedHashes === undefined) {
    throw new Error('Pinned expected bytecode hashes are required in verification mode');
  }

  const chainId = parseChainId(await options.rpc.request<unknown>('eth_chainId'));
  if (chainId !== 4663) {
    throw new Error(`RPC chain mismatch: expected 4663, received ${chainId}`);
  }
  if (expectedHashes !== undefined && expectedHashes.chainId !== chainId) {
    throw new Error('Expected bytecode hash file targets a different chain');
  }
  const blockNumber =
    options.blockNumber ?? parseQuantity(await options.rpc.request<unknown>('eth_blockNumber'), 'eth_blockNumber');
  if (blockNumber <= 0n) throw new Error('Pinned block number must be positive');
  const blockTag = blockTagFor(blockNumber);
  const pinnedBlock = parseBlock(
    await options.rpc.request<unknown>('eth_getBlockByNumber', [blockTag, false]),
    blockNumber,
  );
  const pinnedObservedAt = blockTimestampIso(pinnedBlock.timestamp);
  if (Date.parse(observedAt) !== Date.parse(pinnedObservedAt)) {
    throw new Error(`observedAt ${observedAt} does not equal pinned block timestamp ${pinnedObservedAt}`);
  }

  const targets = [...(options.targets ?? canonicalRobinhoodMainnetBytecodeTargets())].sort((left, right) =>
    compareCodeUnits(left.key, right.key),
  );
  if (targets.length === 0) {
    throw new Error('At least one bytecode target is required');
  }
  if (new Set(targets.map(({ key }) => key)).size !== targets.length) {
    throw new Error('Bytecode target keys must be unique');
  }
  if (new Set(targets.map(({ address }) => address.toLowerCase())).size !== targets.length) {
    throw new Error('Bytecode target addresses must be unique');
  }

  if (requirePinnedHashes) {
    const expectedKeys = Object.keys(expectedHashes!.hashes).sort(compareCodeUnits);
    const targetKeys = targets.map(({ key }) => key);
    if (expectedKeys.length !== targetKeys.length || expectedKeys.some((key, index) => key !== targetKeys[index])) {
      throw new Error('Pinned hash keys must exactly match canonical bytecode target keys');
    }
  }

  const verifiedTargets: Array<z.infer<typeof verifiedBytecodeTargetSchema>> = [];
  for (const target of targets) {
    const code = parseHexData(
      await options.rpc.request<unknown>('eth_getCode', [target.address, blockTag]),
      `${target.key}.eth_getCode`,
    );
    if (code === '0x' || /^0x0+$/.test(code)) {
      throw new Error(`${target.key} has no runtime bytecode`);
    }
    const runtimeBytecodeHash = keccak256(code);
    const expectedRuntimeBytecodeHash = expectedHashes?.hashes[target.key] ?? null;
    if (requirePinnedHashes && runtimeBytecodeHash !== expectedRuntimeBytecodeHash) {
      throw new Error(
        `${target.key} bytecode hash mismatch: expected ${expectedRuntimeBytecodeHash}, received ${runtimeBytecodeHash}`,
      );
    }
    verifiedTargets.push({
      address: getAddress(target.address),
      expectedRuntimeBytecodeHash,
      key: target.key,
      runtimeBytecodeHash,
      source: target.source,
    });
  }

  const finalPinnedBlock = parseBlock(
    await options.rpc.request<unknown>('eth_getBlockByNumber', [blockTag, false]),
    blockNumber,
  );
  if (
    finalPinnedBlock.hash !== pinnedBlock.hash ||
    finalPinnedBlock.parentHash !== pinnedBlock.parentHash ||
    finalPinnedBlock.timestamp !== pinnedBlock.timestamp
  ) {
    throw new Error('Pinned block hash, parent, or timestamp drifted during bytecode verification');
  }

  return bytecodeVerificationReportSchema.parse({
    blockHash: pinnedBlock.hash,
    blockNumber: blockNumber.toString(),
    chainId: 4663,
    deploymentApproved: false,
    kind: 'canonical-bytecode-verification',
    observedAt: pinnedObservedAt,
    parentBlockHash: pinnedBlock.parentHash,
    schemaVersion: 1,
    status: requirePinnedHashes ? 'matched-provisional-pins' : 'collected-unapproved',
    targets: verifiedTargets,
  });
}
