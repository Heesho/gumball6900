import { getAddress, type Address, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import {
  parseProtocolDeployment,
  protocolAddressesSchema,
  protocolPeripheryAddressesSchema,
  readRedemptionPreview,
  readSupplyView,
  selectProtocolDeployment,
} from '../src/index.js';

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

  it('keeps replaceable periphery addresses separate from the core deployment graph', () => {
    expect(protocolPeripheryAddressesSchema.parse({ signalPortfolioLens: address(9) })).toEqual({
      signalPortfolioLens: getAddress(address(9)),
    });
    expect(() =>
      protocolPeripheryAddressesSchema.parse({
        signalPortfolioLens: '0x0000000000000000000000000000000000000000',
      }),
    ).toThrow();
  });

  it('labels unauthenticated release metadata as caller-claimed and rejects the legacy status key', () => {
    const metadata = {
      addresses: {
        bribeFactory: address(1),
        fund: address(2),
        gbx: address(3),
        mine: address(4),
        signalGBX: address(5),
        strategyFactory: address(6),
        resonance: address(7),
        resonanceRouter: address(8),
      },
      chainId: 4663,
      deploymentId: 'self-declared-without-attestation',
      manifestPayloadHash: `0x${'11'.repeat(32)}`,
      releaseVersion: 'v9.9.9',
    } as const;
    const parseUntrusted = (value: unknown) => parseProtocolDeployment(JSON.parse(JSON.stringify(value)) as unknown);

    const approved = parseUntrusted({ ...metadata, claimedStatus: 'release-approved' });
    expect(selectProtocolDeployment([approved], 4663)).toEqual(approved);
    expect(approved.claimedStatus).toBe('release-approved');
    expect(approved).not.toHaveProperty('status');
    expect(approved).not.toHaveProperty('attestation');
    expect(approved).not.toHaveProperty('signature');

    expect(() => parseUntrusted({ ...metadata, status: 'release-approved' })).toThrow();
    expect(() =>
      parseUntrusted({ ...metadata, claimedStatus: 'release-approved', status: 'release-approved' }),
    ).toThrow();

    const draft = parseUntrusted({ ...metadata, claimedStatus: 'draft' });
    expect(() => selectProtocolDeployment([draft], 4663)).toThrow(/received 0/u);
    expect(selectProtocolDeployment([draft], 4663, { requireClaimedReleaseApproved: false })).toEqual(draft);

    if (false) {
      // @ts-expect-error The legacy option implied authentication and is intentionally unsupported.
      selectProtocolDeployment([approved], 4663, { requireReleaseApproved: false });
    }
  });
});
