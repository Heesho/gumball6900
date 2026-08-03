import { encodeFunctionResult, zeroAddress, type Address, type Hex, type PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import {
  canonicalPoolId,
  canonicalPoolKey,
  canonicalV4GBXPriceInUSDG,
  canonicalV4PositionPrincipal,
  nearestCanonicalUsableTick,
  readCanonicalV4ExactInputQuote,
  validateHooklessV4PoolConfiguration,
  v4QuoterAbi,
} from '../src/index.js';

const address = (value: number): Address => `0x${value.toString(16).padStart(40, '0')}`;
const GBX = address(1);
const USDG = address(2);
const QUOTER = address(3);
const BLOCK_NUMBER = 456n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hex;
const TOKEN_METADATA = { chainId: 4_663, gbxDecimals: 18, usdGDecimals: 6 } as const;
const REVIEWED_POOL_CONFIGURATION = { fee: 500, tickSpacing: 10 } as const;

describe('explicit hookless v4 pool configuration', () => {
  it('derives distinct PoolIds from caller-reviewed fee and tick-spacing inputs', () => {
    const reviewedKey = canonicalPoolKey(GBX, USDG, TOKEN_METADATA, REVIEWED_POOL_CONFIGURATION);
    const otherKey = canonicalPoolKey(GBX, USDG, TOKEN_METADATA, { fee: 3_000, tickSpacing: 60 });

    expect(reviewedKey).toEqual({
      currency0: GBX,
      currency1: USDG,
      fee: 500,
      hooks: zeroAddress,
      tickSpacing: 10,
    });
    expect(canonicalPoolId(GBX, USDG, TOKEN_METADATA, REVIEWED_POOL_CONFIGURATION)).not.toBe(
      canonicalPoolId(GBX, USDG, TOKEN_METADATA, { fee: otherKey.fee, tickSpacing: otherKey.tickSpacing }),
    );
    expect(nearestCanonicalUsableTick(114, 10)).toBe(110);
    expect(nearestCanonicalUsableTick(114, 60)).toBe(120);
  });

  it('requires valid static fee and tick-spacing values instead of supplying defaults', () => {
    expect(() => validateHooklessV4PoolConfiguration({ fee: 1_000_001, tickSpacing: 10 })).toThrow();
    expect(() => validateHooklessV4PoolConfiguration({ fee: 500, tickSpacing: 0 })).toThrow();
    expect(() => validateHooklessV4PoolConfiguration({ fee: 500, tickSpacing: 32_768 })).toThrow();
  });

  it('uses the explicit configuration for official SDK price and position math', () => {
    const state = {
      activeLiquidity: 1_000_000n,
      currentTick: 0,
      gbx: { address: GBX, chainId: 4_663, decimals: 18 },
      poolConfiguration: REVIEWED_POOL_CONFIGURATION,
      sqrtPriceX96: 1n << 96n,
      usdG: { address: USDG, chainId: 4_663, decimals: 6 },
    } as const;

    expect(canonicalV4GBXPriceInUSDG(state)).toEqual({ denominator: 1n, numerator: 1_000_000_000_000n });
    const principal = canonicalV4PositionPrincipal({
      ...state,
      liquidity: 500_000n,
      tickLower: -10,
      tickUpper: 10,
    });
    expect(principal.gbxRaw).toBeGreaterThan(0n);
    expect(principal.usdGRaw).toBeGreaterThan(0n);
  });

  it('quotes a caller-supplied non-3000/60 PoolKey at one pinned block', async () => {
    const getBlock = vi.fn(async ({ blockNumber }: { blockNumber?: bigint } = {}) => ({
      hash: BLOCK_HASH,
      number: blockNumber ?? BLOCK_NUMBER,
      timestamp: 1_000n,
    }));
    const call = vi.fn(async () => ({
      data: encodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: 'quoteExactInputSingle',
        result: [95n, 123_000n],
      }),
    }));
    const client = { call, getBlock } as unknown as PublicClient;

    await expect(
      readCanonicalV4ExactInputQuote(client, {
        exactAmountRaw: 100n,
        expectedBlockHash: BLOCK_HASH,
        inputCurrency: GBX,
        inputDecimals: 18,
        outputDecimals: 6,
        poolKey: canonicalPoolKey(GBX, USDG, TOKEN_METADATA, REVIEWED_POOL_CONFIGURATION),
        quoter: QUOTER,
      }),
    ).resolves.toMatchObject({
      amountOutRaw: 95n,
      blockNumber: BLOCK_NUMBER,
      outputCurrency: USDG,
      zeroForOne: true,
    });

    expect(call).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: BLOCK_NUMBER, to: QUOTER }));
    expect(getBlock).toHaveBeenCalledTimes(2);
  });
});
