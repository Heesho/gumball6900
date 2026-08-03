import { type Address, type Hex, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { readAuctionView } from '../src/index.js';

const address = (value: number): Address => `0x${value.toString(16).padStart(40, '0')}`;
const BLOCK_NUMBER = 777n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hex;

function auctionClient(startTime: bigint, price: bigint) {
  const values: Readonly<Record<string, unknown>> = {
    epochId: 3n,
    epochPeriod: 86_400n,
    fillsPaused: false,
    GBX: address(4),
    getPrice: price,
    initPrice: 2_000_000n,
    minInitPrice: 1_000_000n,
    priceMultiplier: 1_100_000_000_000_000_000n,
    startTime,
    STRATEGY_REWARDS: address(3),
    TARGET_TOKEN: address(2),
    USDG_LOT: 10_000_000n,
  };
  const readContract = vi.fn(
    async ({ functionName }: { blockNumber: bigint; functionName: string }): Promise<unknown> => {
      if (functionName === 'getPrice' && startTime === 0n) throw new Error('AuctionEngine__NotActivated');
      if (functionName in values) return values[functionName];
      throw new Error(`Unexpected auction read: ${functionName}`);
    },
  );
  const getBlock = vi.fn(async ({ blockNumber }: { blockNumber?: bigint } = {}) => ({
    hash: BLOCK_HASH,
    number: blockNumber ?? BLOCK_NUMBER,
    timestamp: 2_000n,
  }));
  return { client: { getBlock, readContract } as unknown as PublicClient, getBlock, readContract };
}

describe('auction reads', () => {
  it('represents a registry-pending auction as inactive without calling its reverting price getter', async () => {
    const { client, getBlock, readContract } = auctionClient(0n, 123n);

    await expect(readAuctionView(client, address(1), 'acquisition')).resolves.toEqual({
      blockNumber: BLOCK_NUMBER,
      epochId: 3n,
      epochPeriod: 86_400n,
      fillsPaused: false,
      initPrice: 2_000_000n,
      kind: 'acquisition',
      minInitPrice: 1_000_000n,
      price: null,
      priceMultiplier: 1_100_000_000_000_000_000n,
      rewards: address(3),
      startTime: 0n,
      status: 'inactive',
      strategy: address(1),
      targetToken: address(2),
      usdGLot: 10_000_000n,
    });

    expect(readContract).not.toHaveBeenCalledWith(expect.objectContaining({ functionName: 'getPrice' }));
    expect(getBlock).toHaveBeenCalledTimes(2);
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
  });

  it('reads an active auction price at the same caller-pinned block and revalidates its hash', async () => {
    const { client, getBlock, readContract } = auctionClient(1_900n, 1_750_000n);

    await expect(
      readAuctionView(client, address(1), 'buyback', {
        atBlock: BLOCK_NUMBER,
        expectedBlockHash: BLOCK_HASH,
      }),
    ).resolves.toMatchObject({
      blockNumber: BLOCK_NUMBER,
      kind: 'buyback',
      price: 1_750_000n,
      rewards: null,
      startTime: 1_900n,
      status: 'active',
      targetToken: address(4),
    });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        blockNumber: BLOCK_NUMBER,
        functionName: 'getPrice',
      }),
    );
    expect(getBlock).toHaveBeenNthCalledWith(1, { blockNumber: BLOCK_NUMBER });
    expect(getBlock).toHaveBeenNthCalledWith(2, { blockNumber: BLOCK_NUMBER });
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
  });
});
