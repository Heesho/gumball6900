import { type Address, type Hex } from 'viem';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchLiquidityPositionIndex,
  LIQUIDITY_POSITION_INDEX_QUERY,
  parseLiquidityPositionIndexResponse,
} from '../lib/subgraph-liquidity';

const MANAGER = '0x00000000000000000000000000000000000000a1' as Address;
const BLOCK = 777n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hex;

function envelope(
  positionIds: readonly bigint[] = [101n, 102n, 103n, 104n],
  overrides: Readonly<{
    activePositionCount?: number;
    blockHash?: Hex;
    blockNumber?: bigint;
    manager?: Address;
    migrationCount?: number;
  }> = {},
) {
  const manager = overrides.manager ?? MANAGER;
  const blockNumber = overrides.blockNumber ?? BLOCK;
  return {
    data: {
      _meta: {
        block: { hash: overrides.blockHash ?? BLOCK_HASH, number: blockNumber.toString() },
        hasIndexingErrors: false,
      },
      liquidityPool: {
        activePositionCount: overrides.activePositionCount ?? positionIds.length,
        manager,
        migrationCount: overrides.migrationCount ?? 1,
      },
      liquidityPositions: positionIds.map((positionId) => ({
        active: true,
        lastBlockNumber: blockNumber.toString(),
        pool: { manager },
        positionId: positionId.toString(),
      })),
    },
  };
}

describe('pinned liquidity position index', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses a complete bounded active-ID snapshot with explicit block provenance', () => {
    expect(parseLiquidityPositionIndexResponse(envelope(), MANAGER)).toEqual({
      activePositionCount: 4,
      indexedBlock: BLOCK,
      indexedBlockHash: BLOCK_HASH,
      migrationCount: 1n,
      positionIds: [101n, 102n, 103n, 104n],
    });
  });

  it('accepts an exact zero active count with an empty pinned ID list', () => {
    expect(parseLiquidityPositionIndexResponse(envelope([]), MANAGER)).toEqual({
      activePositionCount: 0,
      indexedBlock: BLOCK,
      indexedBlockHash: BLOCK_HASH,
      migrationCount: 1n,
      positionIds: [],
    });
  });

  it('accepts the complete contract-enforced maximum of sixteen active positions', () => {
    const maximum = Array.from({ length: 16 }, (_, index) => BigInt(index + 1));
    expect(parseLiquidityPositionIndexResponse(envelope(maximum), MANAGER).positionIds).toEqual(maximum);
  });

  it('rejects omissions, duplicates, unordered IDs, and excess active sets', () => {
    expect(() =>
      parseLiquidityPositionIndexResponse(envelope([101n, 102n], { activePositionCount: 3 }), MANAGER),
    ).toThrow('omitted or added');
    expect(() => parseLiquidityPositionIndexResponse(envelope([101n, 101n]), MANAGER)).toThrow('duplicate');
    expect(() => parseLiquidityPositionIndexResponse(envelope([102n, 101n]), MANAGER)).toThrow('strictly ascending');
    const excess = Array.from({ length: 17 }, (_, index) => BigInt(index + 1));
    expect(() => parseLiquidityPositionIndexResponse(envelope(excess), MANAGER)).toThrow('bounded');
  });

  it('rejects manager inconsistency, future rows, indexing errors, and pinned-block hash drift', () => {
    const otherManager = '0x00000000000000000000000000000000000000b2' as Address;
    expect(() => parseLiquidityPositionIndexResponse(envelope([101n], { manager: otherManager }), MANAGER)).toThrow(
      'does not match the runtime',
    );
    const future = envelope([101n]);
    future.data.liquidityPositions[0]!.lastBlockNumber = (BLOCK + 1n).toString();
    expect(() => parseLiquidityPositionIndexResponse(future, MANAGER)).toThrow('newer than its pinned block');
    const unhealthy = envelope([101n]);
    unhealthy.data._meta.hasIndexingErrors = true;
    expect(() => parseLiquidityPositionIndexResponse(unhealthy, MANAGER)).toThrow('indexing health');
    expect(() =>
      parseLiquidityPositionIndexResponse(envelope(), MANAGER, {
        indexedBlock: BLOCK,
        indexedBlockHash: `0x${'cd'.repeat(32)}`,
      }),
    ).toThrow('did not match its pinned block');
  });

  it('anchors first, then pins the entity query to that exact hash and bounded manager ID', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { _meta: { block: { hash: BLOCK_HASH, number: BLOCK.toString() }, hasIndexingErrors: false } },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchLiquidityPositionIndex('https://subgraph.example/graphql', {
        chainId: 4663,
        liquidityManager: MANAGER,
      }),
    ).resolves.toMatchObject({ indexedBlock: BLOCK, indexedBlockHash: BLOCK_HASH });
    const secondRequest = fetchMock.mock.calls[1]![1] as RequestInit;
    const body = JSON.parse(secondRequest.body as string) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(body.query).toBe(LIQUIDITY_POSITION_INDEX_QUERY);
    expect(body.query).toContain('orderBy: positionId');
    expect(body.query).toContain('where: { pool: $poolIdFilter, active: true }');
    expect(body.query.match(/block: \{ hash: \$indexedBlockHash \}/gu)).toHaveLength(3);
    expect(body.variables).toEqual({
      first: 17,
      indexedBlockHash: BLOCK_HASH,
      poolId: `4663-${MANAGER.toLowerCase()}`,
      poolIdFilter: `4663-${MANAGER.toLowerCase()}`,
    });
  });
});
