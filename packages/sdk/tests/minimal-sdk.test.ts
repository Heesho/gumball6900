import { getAddress, zeroAddress, type Address, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { canonicalPoolKey, protocolAddressesSchema, readRedemptionPreview, readSupplyView } from '../src/index.js';

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
  it('pins and revalidates cumulative supply reads', async () => {
    const client = pinnedClient({
      cumulativeBurned: 5n,
      cumulativeMinted: 20n,
      emissionController: address(2),
      remainingMintCapacity: 980n,
      totalSupply: 15n,
    });
    await expect(readSupplyView(client, address(1))).resolves.toEqual({
      blockNumber: 100n,
      cumulativeBurned: 5n,
      cumulativeMinted: 20n,
      emissionController: address(2),
      remainingMintCapacity: 980n,
      totalSupply: 15n,
    });
    expect(client.getBlock).toHaveBeenCalledTimes(2);
  });

  it('previews each raw vault balance against the pre-burn supply', async () => {
    const gbx = address(1);
    const registry = address(2);
    const vault = address(3);
    const usdG = address(4);
    const target = address(5);
    const client = pinnedClient({
      assetCount: 2n,
      assetAt: usdG,
      [`${gbx.toLowerCase()}:totalSupply`]: 100n,
      [`${usdG.toLowerCase()}:balanceOf`]: 1_000n,
      [`${target.toLowerCase()}:balanceOf`]: 500n,
    });
    (client.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(100n)
      .mockResolvedValueOnce(2n)
      .mockResolvedValueOnce(usdG)
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(1_000n)
      .mockResolvedValueOnce(500n);

    await expect(readRedemptionPreview(client, { assetRegistry: registry, gbx, vault }, 25n)).resolves.toMatchObject({
      amounts: [250n, 125n],
      assets: [usdG, target],
      shares: 25n,
      supplyBefore: 100n,
    });
  });

  it('accepts only the fixed minimal deployment graph', () => {
    const keys = [
      'allocationVoter',
      'assetRegistry',
      'buybackStrategy',
      'emergencyGuardian',
      'emissionController',
      'gbx',
      'gumBallVault',
      'liquidityCustodian',
      'miningClaims',
      'miningPool',
      'protocolTimelock',
      'stakedGBX',
    ] as const;
    const deployment = Object.fromEntries(keys.map((key, index) => [key, address(index + 1)]));
    expect(protocolAddressesSchema.parse(deployment)).toEqual(
      Object.fromEntries(Object.entries(deployment).map(([key, value]) => [key, getAddress(value)])),
    );
    expect(() => protocolAddressesSchema.parse({ ...deployment, gumBallRouter: address(99) })).toThrow();
  });

  it('builds the hookless GBX/USDG PoolKey only from explicit reviewed fee and spacing inputs', () => {
    expect(
      canonicalPoolKey(
        address(2),
        address(1),
        { chainId: 4663, gbxDecimals: 18, usdGDecimals: 6 },
        { fee: 500, tickSpacing: 10 },
      ),
    ).toEqual({
      currency0: address(1),
      currency1: address(2),
      fee: 500,
      hooks: zeroAddress,
      tickSpacing: 10,
    });
  });
});
