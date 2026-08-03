import { isHex, type Hex } from 'viem';
import { z } from 'zod';

import type { EvmJsonRpcClient } from './json-rpc.js';

const bytes32Schema = z.string().regex(/^0x[0-9a-f]{64}$/);

export const nightlyMainnetPinSchema = z
  .object({
    blockHash: bytes32Schema,
    blockNumber: z.string().regex(/^[1-9]\d*$/),
    chainId: z.literal(4663),
    confirmationDepth: z.number().int().min(32).max(4096),
    deploymentApproved: z.literal(false),
    headBlockNumber: z.string().regex(/^[1-9]\d*$/),
    kind: z.literal('robinhood-mainnet-nightly-pin'),
    observedAt: z.string().datetime({ offset: true }),
    parentBlockHash: bytes32Schema,
    schemaVersion: z.literal(1),
    status: z.literal('provisional-nightly'),
  })
  .strict();

export type NightlyMainnetPin = z.infer<typeof nightlyMainnetPinSchema>;

interface RpcBlock {
  readonly hash: Hex;
  readonly number: bigint;
  readonly parentHash: Hex;
  readonly timestamp: bigint;
}

function parseHex(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHex(value, { strict: true })) {
    throw new Error(`${label} returned invalid hex data`);
  }
  return value.toLowerCase() as Hex;
}

function parseQuantity(value: unknown, label: string): bigint {
  const quantity = parseHex(value, label);
  if (!/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(quantity)) {
    throw new Error(`${label} returned a non-canonical quantity`);
  }
  return BigInt(quantity);
}

function parseBytes32(value: unknown, label: string): Hex {
  const parsed = parseHex(value, label);
  if (!/^0x[0-9a-f]{64}$/.test(parsed)) throw new Error(`${label} did not return bytes32 data`);
  return parsed;
}

function quantity(value: bigint): Hex {
  if (value < 0n) throw new Error('RPC quantity cannot be negative');
  return `0x${value.toString(16)}`;
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

function timestampIso(timestamp: bigint): string {
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Pinned block timestamp exceeds safe date range');
  const date = new Date(Number(timestamp) * 1_000);
  if (!Number.isFinite(date.getTime())) throw new Error('Pinned block timestamp is invalid');
  return date.toISOString();
}

export async function selectNightlyMainnetPin(
  rpc: EvmJsonRpcClient,
  confirmationDepth = 64,
): Promise<NightlyMainnetPin> {
  if (!Number.isSafeInteger(confirmationDepth) || confirmationDepth < 32 || confirmationDepth > 4096) {
    throw new Error('Confirmation depth must be an integer between 32 and 4096');
  }
  const chainId = parseQuantity(await rpc.request<unknown>('eth_chainId'), 'eth_chainId');
  if (chainId !== 4663n) throw new Error(`Expected Robinhood mainnet chain ID 4663, received ${chainId}`);

  const headBlockNumber = parseQuantity(await rpc.request<unknown>('eth_blockNumber'), 'eth_blockNumber');
  if (headBlockNumber <= BigInt(confirmationDepth)) {
    throw new Error('Robinhood mainnet head is too low for the required confirmation depth');
  }
  const blockNumber = headBlockNumber - BigInt(confirmationDepth);
  const blockTag = quantity(blockNumber);
  const first = parseBlock(await rpc.request<unknown>('eth_getBlockByNumber', [blockTag, false]), blockNumber);
  const second = parseBlock(await rpc.request<unknown>('eth_getBlockByNumber', [blockTag, false]), blockNumber);
  if (
    first.hash !== second.hash ||
    first.number !== second.number ||
    first.parentHash !== second.parentHash ||
    first.timestamp !== second.timestamp
  ) {
    throw new Error('Pinned Robinhood mainnet block drifted while selecting nightly evidence');
  }

  return nightlyMainnetPinSchema.parse({
    blockHash: first.hash,
    blockNumber: first.number.toString(),
    chainId: 4663,
    confirmationDepth,
    deploymentApproved: false,
    headBlockNumber: headBlockNumber.toString(),
    kind: 'robinhood-mainnet-nightly-pin',
    observedAt: timestampIso(first.timestamp),
    parentBlockHash: first.parentHash,
    schemaVersion: 1,
    status: 'provisional-nightly',
  });
}
