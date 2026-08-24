import { getAddress, type Address, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { protocolAddressesSchema, readRedemptionPreview, readSupplyView } from '../src/index.js';

const address = (value: number): Address => `0x${value.toString(16).padStart(40, '0')}`;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as const;

function pinnedClient(values: Readonly<Record<string, unknown>>): PublicClient {
  return {
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber?: bigint } = {}) => ({
      hash: BLOCK_HASH,
      number: blockNumber ?? 100n,
      timestamp: 1_000n,
    })),
    readContract: vi.fn(async ({ address: target, functionName }: { address: Address; functionName: string }) => {
      const keyed = values[`${target.toLowerCase()}:${functionName}`];
      if (keyed !== undefined) return keyed;
      const unkeyed = values[functionName];
      if (unkeyed !== undefined) return unkeyed;
      throw new Error(`Unexpected read ${functionName} at ${target}`);
    }),
  } as unknown as PublicClient;
}

describe('minimal SDK reads and deployment metadata', () => {
  it('pins and revalidates mined supply reads', async () => {
    const client = pinnedClient({
      lifetimeBurned: 5n,
      lifetimeMinted: 1_000n,
      minter: address(2),
      minterLocked: true,
      totalSupply: 995n,
    });
    await expect(readSupplyView(client, address(1))).resolves.toEqual({
      blockNumber: 100n,
      lifetimeBurned: 5n,
      lifetimeMinted: 1_000n,
      minter: address(2),
      minterLocked: true,
      totalSupply: 995n,
    });
    expect(client.getBlock).toHaveBeenCalledTimes(2);
  });

  it('previews each Fund balance against Mine effective supply at the pinned block', async () => {
    const mine = address(2);
    const vault = address(3);
    const usdG = address(4);
    const target = address(5);
    const client = pinnedClient({
      [`${mine.toLowerCase()}:effectiveTotalSupply`]: 125n,
      [`${usdG.toLowerCase()}:balanceOf`]: 1_000n,
      [`${target.toLowerCase()}:balanceOf`]: 500n,
    });
    await expect(readRedemptionPreview(client, { fund: vault, mine }, 25n, [usdG, target])).resolves.toMatchObject({
      amounts: [200n, 100n],
      effectiveSupplyBefore: 125n,
      gbxAmount: 25n,
      tokens: [usdG, target],
    });
  });

  it('accepts only the fixed minimal deployment graph', () => {
    const keys = [
      'bribeFactory',
      'fund',
      'gbx',
      'mine',
      'signalGBX',
      'strategyFactory',
      'resonance',
      'resonanceRouter',
    ] as const;
    const deployment = Object.fromEntries(keys.map((key, index) => [key, address(index + 1)]));
    expect(protocolAddressesSchema.parse(deployment)).toEqual(
      Object.fromEntries(Object.entries(deployment).map(([key, value]) => [key, getAddress(value)])),
    );
    expect(() => protocolAddressesSchema.parse({ ...deployment, legacyVault: address(99) })).toThrow();
  });
});
