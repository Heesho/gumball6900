import { MAX_CANONICAL_V4_ACTIVE_POSITIONS, type CanonicalV4ActivePositionIndex } from '@gumball-6900/sdk';
import { getAddress, isAddress, isAddressEqual, isHex, size, type Address, type Hex } from 'viem';

export const LIQUIDITY_POSITION_INDEX_META_QUERY = `query GumBallLiquidityPositionIndexAnchor {
  _meta {
    block { number hash }
    hasIndexingErrors
  }
}`;

export const LIQUIDITY_POSITION_INDEX_QUERY = `query GumBallLiquidityPositionIndex(
  $first: Int!
  $indexedBlockHash: Bytes!
  $poolId: ID!
  $poolIdFilter: String!
) {
  _meta(block: { hash: $indexedBlockHash }) {
    block { number hash }
    hasIndexingErrors
  }
  liquidityPool(id: $poolId, block: { hash: $indexedBlockHash }) {
    manager
    activePositionCount
    migrationCount
  }
  liquidityPositions(
    first: $first
    orderBy: positionId
    orderDirection: asc
    block: { hash: $indexedBlockHash }
    where: { pool: $poolIdFilter, active: true }
  ) {
    positionId
    active
    lastBlockNumber
    pool { manager }
  }
}`;

interface ParsedMeta {
  readonly data: Record<string, unknown>;
  readonly indexedBlock: bigint;
  readonly indexedBlockHash: Hex;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function records(value: unknown, label: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry, index) => record(entry, `${label}[${index.toString()}]`));
}

function unsigned(value: unknown, label: string): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/u.test(value)) return BigInt(value);
  throw new Error(`${label} must be an unsigned integer`);
}

function safeCount(value: unknown, label: string): number {
  const parsed = unsigned(value, label);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds the safe integer range`);
  return Number(parsed);
}

function address(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) throw new Error(`${label} must be an address`);
  return getAddress(value);
}

function blockHash(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHex(value, { strict: true }) || size(value) !== 32) {
    throw new Error(`${label} must be a 32-byte block hash`);
  }
  return value;
}

function parseMeta(value: unknown, expected?: Readonly<{ indexedBlock: bigint; indexedBlockHash: Hex }>): ParsedMeta {
  const envelope = record(value, 'subgraph response');
  if (Array.isArray(envelope.errors) && envelope.errors.length > 0)
    throw new Error('The subgraph returned GraphQL errors.');
  const data = record(envelope.data, 'subgraph response.data');
  const meta = record(data._meta, 'subgraph response.data._meta');
  if (meta.hasIndexingErrors !== false) throw new Error('The liquidity index reports or omits indexing health.');
  const block = record(meta.block, 'subgraph response.data._meta.block');
  const indexedBlock = unsigned(block.number, 'indexed block');
  const indexedBlockHash = blockHash(block.hash, 'indexed block hash');
  if (
    expected !== undefined &&
    (indexedBlock !== expected.indexedBlock ||
      indexedBlockHash.toLowerCase() !== expected.indexedBlockHash.toLowerCase())
  ) {
    throw new Error('The liquidity index did not match its pinned block.');
  }
  return { data, indexedBlock, indexedBlockHash };
}

export function parseLiquidityPositionIndexResponse(
  value: unknown,
  expectedManager: Address,
  expectedSnapshot?: Readonly<{ indexedBlock: bigint; indexedBlockHash: Hex }>,
): CanonicalV4ActivePositionIndex {
  const parsed = parseMeta(value, expectedSnapshot);
  const pool = record(parsed.data.liquidityPool, 'liquidityPool');
  const manager = address(pool.manager, 'liquidityPool.manager');
  if (!isAddressEqual(manager, expectedManager))
    throw new Error('The liquidity index manager does not match the runtime.');
  const activePositionCount = safeCount(pool.activePositionCount, 'liquidityPool.activePositionCount');
  const migrationCount = unsigned(pool.migrationCount, 'liquidityPool.migrationCount');
  const rows = records(parsed.data.liquidityPositions, 'liquidityPositions');
  if (rows.length > MAX_CANONICAL_V4_ACTIVE_POSITIONS || activePositionCount > MAX_CANONICAL_V4_ACTIVE_POSITIONS) {
    throw new Error('The liquidity index exceeds the bounded active-position limit.');
  }
  if (rows.length !== activePositionCount) {
    throw new Error('The liquidity index omitted or added active positions relative to its pool count.');
  }
  const positionIds = rows.map((row, index) => {
    if (row.active !== true) throw new Error(`liquidityPositions[${index.toString()}] is not active`);
    const rowManager = address(
      record(row.pool, `liquidityPositions[${index.toString()}].pool`).manager,
      'position pool manager',
    );
    if (!isAddressEqual(rowManager, expectedManager))
      throw new Error('A liquidity position belongs to another manager.');
    const lastBlockNumber = unsigned(row.lastBlockNumber, 'liquidity position last block');
    if (lastBlockNumber > parsed.indexedBlock)
      throw new Error('The liquidity index returned a position newer than its pinned block.');
    const positionId = unsigned(row.positionId, 'liquidity position ID');
    if (positionId === 0n) throw new Error('The liquidity index returned a zero position ID.');
    return positionId;
  });
  if (new Set(positionIds).size !== positionIds.length)
    throw new Error('The liquidity index returned duplicate position IDs.');
  if (positionIds.some((positionId, index) => index > 0 && positionId <= positionIds[index - 1]!)) {
    throw new Error('The liquidity index position IDs are not strictly ascending.');
  }
  return {
    activePositionCount,
    indexedBlock: parsed.indexedBlock,
    indexedBlockHash: parsed.indexedBlockHash,
    migrationCount,
    positionIds,
  };
}

function isLocalEndpoint(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  return hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/u.test(hostname);
}

async function postSubgraph(
  url: URL,
  query: string,
  variables: Readonly<Record<string, unknown>>,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`The liquidity index request failed with HTTP ${response.status.toString()}.`);
  return response.json();
}

/** Fetches a complete active-position ID set in two phases so every entity query is pinned to one indexed hash. */
export async function fetchLiquidityPositionIndex(
  endpoint: string,
  parameters: Readonly<{ chainId: number; liquidityManager: Address; signal?: AbortSignal }>,
): Promise<CanonicalV4ActivePositionIndex> {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !isLocalEndpoint(url)) throw new Error('The subgraph endpoint is not HTTPS.');
  if (!Number.isSafeInteger(parameters.chainId) || parameters.chainId <= 0)
    throw new Error('The runtime chain ID is invalid.');
  const anchor = parseMeta(await postSubgraph(url, LIQUIDITY_POSITION_INDEX_META_QUERY, {}, parameters.signal));
  const poolId = `${parameters.chainId.toString()}-${parameters.liquidityManager.toLowerCase()}`;
  const response = await postSubgraph(
    url,
    LIQUIDITY_POSITION_INDEX_QUERY,
    {
      first: MAX_CANONICAL_V4_ACTIVE_POSITIONS + 1,
      indexedBlockHash: anchor.indexedBlockHash,
      poolId,
      poolIdFilter: poolId,
    },
    parameters.signal,
  );
  return parseLiquidityPositionIndexResponse(response, parameters.liquidityManager, anchor);
}
