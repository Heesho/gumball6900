import { MAX_CUMULATIVE_MINT } from '@gumball-6900/sdk';
import { describe, expect, it, vi } from 'vitest';
import { keccak256, stringToHex, zeroAddress, type PublicClient } from 'viem';

import { basketAssetSymbols, readLiveProtocolOverview } from '../lib/live-protocol-overview';
import { rewardSymbols, strategySymbols } from '../lib/runtime-types';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const BLOCK_NUMBER = 777n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as const;
const MINTED = 1_000n * 10n ** 18n;
const BURNED = 100n * 10n ** 18n;
const EXTRA_SYMBOL = 'LINK';
const EXTRA_TOKEN = fixtureAddress(900);
const EXTRA_STRATEGY = fixtureAddress(901);
const EXTRA_REWARDS = fixtureAddress(902);

function lensAssetRows() {
  return basketAssetSymbols.map((symbol, index) => ({
    acquisitionEnabled: true,
    assetId: keccak256(stringToHex(`asset:${symbol}`)),
    decimals: liveRuntimeFixture.assetMetadata[symbol].decimals,
    isStockToken: liveRuntimeFixture.assetMetadata[symbol].registryStatus === 'ASSET_STATUS_ACTIVE',
    redemptionEnabled: true,
    rewards: symbol === 'USDG' ? zeroAddress : liveRuntimeFixture.rewards[symbol],
    strategy: liveRuntimeFixture.strategies[symbol],
    symbolHash: keccak256(stringToHex(symbol)),
    token: liveRuntimeFixture.assets[symbol],
    vaultBalance: BigInt(index + 1) * 10n ** BigInt(liveRuntimeFixture.assetMetadata[symbol].decimals),
  }));
}

function lensStrategyRows() {
  return strategySymbols.map((symbol, index) => ({
    activeWeight: BigInt(index + 1) * 10n ** 18n,
    live: true,
    strategy: liveRuntimeFixture.strategies[symbol],
    token: symbol === 'BURN' ? zeroAddress : liveRuntimeFixture.assets[symbol],
    virtualUSDGBudget: BigInt(index + 1) * 1_000_000n,
    voterDisabled: false,
  }));
}

function extraAssetRow(symbol = EXTRA_SYMBOL) {
  return {
    acquisitionEnabled: true,
    assetId: keccak256(stringToHex(`asset:${symbol}`)),
    decimals: 18,
    isStockToken: false,
    redemptionEnabled: true,
    rewards: EXTRA_REWARDS,
    strategy: EXTRA_STRATEGY,
    symbolHash: keccak256(stringToHex(symbol)),
    token: EXTRA_TOKEN,
    vaultBalance: 42n * 10n ** 18n,
  };
}

function extraStrategyRow() {
  return {
    activeWeight: 10n * 10n ** 18n,
    live: true,
    strategy: EXTRA_STRATEGY,
    token: EXTRA_TOKEN,
    virtualUSDGBudget: 10_000_000n,
    voterDisabled: false,
  };
}

function clientFor(
  options: { assets?: unknown; confirmationHash?: `0x${string}`; dynamicSymbol?: unknown; strategies?: unknown } = {},
) {
  const readContract = vi.fn(
    async ({ address, functionName }: { address?: string; blockNumber?: bigint; functionName: string }) => {
      if (functionName === 'supplyView') {
        return {
          cumulativeBurned: BURNED,
          cumulativeMinted: MINTED,
          remainingMintCapacity: MAX_CUMULATIVE_MINT - MINTED,
          totalSupply: MINTED - BURNED,
        };
      }
      if (functionName === 'assetViews') return options.assets ?? lensAssetRows();
      if (functionName === 'strategyViews') return options.strategies ?? lensStrategyRows();
      if (functionName === 'symbol' && address?.toLowerCase() === EXTRA_TOKEN.toLowerCase()) {
        return options.dynamicSymbol ?? EXTRA_SYMBOL;
      }
      throw new Error(`Unexpected read ${functionName}`);
    },
  );
  const getBlock = vi.fn(async (parameters: { blockNumber?: bigint; blockTag?: string }) => ({
    hash: parameters.blockTag === 'latest' ? BLOCK_HASH : (options.confirmationHash ?? BLOCK_HASH),
    number: BLOCK_NUMBER,
    timestamp: 1_000n,
  }));
  return {
    client: { getBlock, readContract } as unknown as PublicClient,
    getBlock,
    readContract,
  };
}

describe('signed Lens protocol overview', () => {
  it('pins supply, all raw assets, and every strategy budget to one revalidated block', async () => {
    const { client, getBlock, readContract } = clientFor();
    const overview = await readLiveProtocolOverview(client, liveRuntimeFixture);

    expect(overview.blockNumber).toBe(BLOCK_NUMBER);
    expect(overview.supply).toEqual({
      cumulativeBurned: BURNED,
      cumulativeMinted: MINTED,
      remainingMintCapacity: MAX_CUMULATIVE_MINT - MINTED,
      totalSupply: MINTED - BURNED,
    });
    expect(overview.assets.map(({ symbol }) => symbol)).toEqual(basketAssetSymbols);
    expect(overview.assets.find(({ symbol }) => symbol === 'WBTC')).toMatchObject({
      decimals: 8,
      vaultBalance: 3_00000000n,
    });
    expect(overview.strategies.map(({ symbol }) => symbol)).toEqual(strategySymbols);
    expect(overview.strategies.at(-1)).toMatchObject({ symbol: 'BURN', token: zeroAddress });
    expect(getBlock.mock.calls.map(([request]) => request)).toEqual([
      { blockTag: 'latest' },
      { blockNumber: BLOCK_NUMBER },
      { blockNumber: BLOCK_NUMBER },
      { blockNumber: BLOCK_NUMBER },
    ]);
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
    for (const symbol of rewardSymbols) {
      expect(overview.assets.find((asset) => asset.symbol === symbol)?.rewards.toLowerCase()).toBe(
        liveRuntimeFixture.rewards[symbol].toLowerCase(),
      );
    }
  });

  it('rejects manifest identity drift and incomplete bounded results', async () => {
    const wrongDecimals = lensAssetRows();
    wrongDecimals[2] = { ...wrongDecimals[2]!, decimals: 18 };
    await expect(
      readLiveProtocolOverview(clientFor({ assets: wrongDecimals }).client, liveRuntimeFixture),
    ).rejects.toThrow('WBTC decimals do not match');

    await expect(
      readLiveProtocolOverview(clientFor({ strategies: lensStrategyRows().slice(0, -1) }).client, liveRuntimeFixture),
    ).rejects.toThrow('omit a required signed genesis strategy');

    const reordered = lensAssetRows();
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    await expect(readLiveProtocolOverview(clientFor({ assets: reordered }).client, liveRuntimeFixture)).rejects.toThrow(
      'signed genesis asset order drifted',
    );
  });

  it('accepts an appended registered asset and strategy while preserving signed genesis identities', async () => {
    const { client, readContract } = clientFor({
      assets: [...lensAssetRows(), extraAssetRow()],
      strategies: [...lensStrategyRows(), extraStrategyRow()],
    });
    const overview = await readLiveProtocolOverview(client, liveRuntimeFixture);

    expect(overview.assets).toHaveLength(9);
    expect(overview.assets.slice(0, 8).map(({ genesisSymbol }) => genesisSymbol)).toEqual(basketAssetSymbols);
    expect(overview.assets.at(-1)).toMatchObject({
      genesisSymbol: null,
      registryIndex: 8,
      strategy: EXTRA_STRATEGY,
      symbol: EXTRA_SYMBOL,
      token: EXTRA_TOKEN,
    });
    expect(overview.strategies).toHaveLength(10);
    expect(overview.strategies.slice(0, 9).map(({ genesisSymbol }) => genesisSymbol)).toEqual(strategySymbols);
    expect(overview.strategies.at(-1)).toMatchObject({
      genesisSymbol: null,
      kind: 'acquisition',
      registryIndex: 9,
      strategy: EXTRA_STRATEGY,
      symbol: EXTRA_SYMBOL,
      token: EXTRA_TOKEN,
    });
    expect(
      readContract.mock.calls.some(
        ([request]) =>
          request.functionName === 'symbol' && request.address?.toLowerCase() === EXTRA_TOKEN.toLowerCase(),
      ),
    ).toBe(true);
  });

  it('rejects a dynamically read token symbol that differs from the immutable registry hash', async () => {
    await expect(
      readLiveProtocolOverview(
        clientFor({
          assets: [...lensAssetRows(), extraAssetRow()],
          dynamicSymbol: 'FAKE',
          strategies: [...lensStrategyRows(), extraStrategyRow()],
        }).client,
        liveRuntimeFixture,
      ),
    ).rejects.toThrow('symbol does not match its immutable registry symbolHash');
  });

  it('rejects a block-hash change before returning a mixed or reorged snapshot', async () => {
    await expect(
      readLiveProtocolOverview(clientFor({ confirmationHash: `0x${'cd'.repeat(32)}` }).client, liveRuntimeFixture),
    ).rejects.toThrow('Chain state changed');
  });
});
