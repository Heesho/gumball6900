import { MAX_CUMULATIVE_MINT } from '@gumball-6900/sdk';
import { describe, expect, it } from 'vitest';
import { keccak256, stringToHex, zeroAddress, type Address, type Hash, type PublicClient } from 'viem';

import {
  assertAuctionFillPreflight,
  assertAuctionRestartPreflight,
  readPinnedAuctionPreflight,
  readPinnedRedemptionPreflight,
} from '../lib/financial-preflight';
import { basketAssetSymbols } from '../lib/live-protocol-overview';
import { assetSymbols, strategySymbols } from '../lib/runtime-types';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const BLOCK_NUMBER = 120n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hash;
const REORG_HASH = `0x${'cd'.repeat(32)}` as Hash;
const EXTRA_TOKEN = fixtureAddress(900);
const EXTRA_STRATEGY = fixtureAddress(901);
const EXTRA_REWARDS = fixtureAddress(902);
const SECOND_EXTRA_TOKEN = fixtureAddress(903);
const SECOND_EXTRA_STRATEGY = fixtureAddress(904);
const SECOND_EXTRA_REWARDS = fixtureAddress(905);

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
    vaultBalance: BigInt(index + 1),
  }));
}

function lensStrategyRows() {
  return strategySymbols.map((symbol, index) => ({
    activeWeight: BigInt(index + 1),
    live: true,
    strategy: liveRuntimeFixture.strategies[symbol],
    token: symbol === 'BURN' ? zeroAddress : liveRuntimeFixture.assets[symbol],
    virtualUSDGBudget: BigInt(index + 1),
    voterDisabled: false,
  }));
}

function extraAssetRow(token: Address, strategy: Address, rewards: Address, symbol = 'LINK') {
  return {
    acquisitionEnabled: true,
    assetId: keccak256(stringToHex(`asset:${token}`)),
    decimals: 18,
    isStockToken: false,
    redemptionEnabled: true,
    rewards,
    strategy,
    symbolHash: keccak256(stringToHex(symbol)),
    token,
    vaultBalance: 1n,
  };
}

function extraStrategyRow(token: Address, strategy: Address) {
  return {
    activeWeight: 1n,
    live: true,
    strategy,
    token,
    virtualUSDGBudget: 1n,
    voterDisabled: false,
  };
}

function redemptionClient(options: { amountsLength?: number; reorg?: boolean; tokens?: readonly Address[] } = {}) {
  const contractBlocks: bigint[] = [];
  const expectedTokens = assetSymbols
    .filter((symbol) => symbol !== 'GBX')
    .map((symbol) => liveRuntimeFixture.assets[symbol]);
  const client = {
    getBlock: async ({ blockNumber }: { blockNumber?: bigint }) => ({
      hash: options.reorg && blockNumber !== undefined ? REORG_HASH : BLOCK_HASH,
      number: BLOCK_NUMBER,
    }),
    readContract: async ({ blockNumber, functionName }: { blockNumber: bigint; functionName: string }) => {
      contractBlocks.push(blockNumber);
      if (functionName === 'previewRedemption') {
        const tokens = options.tokens ?? expectedTokens;
        const amountsLength = options.amountsLength ?? tokens.length;
        return [tokens, tokens.slice(0, amountsLength).map((_, index) => BigInt(index + 1))];
      }
      if (functionName === 'supplyView') {
        return {
          cumulativeBurned: 10n,
          cumulativeMinted: 110n,
          remainingMintCapacity: MAX_CUMULATIVE_MINT - 110n,
          totalSupply: 100n,
        };
      }
      if (functionName === 'assetViews') return lensAssetRows();
      if (functionName === 'strategyViews') return lensStrategyRows();
      throw new Error(`Unexpected function ${functionName}`);
    },
  } as unknown as PublicClient;
  return { client, contractBlocks, expectedTokens };
}

function auctionClient(
  options: {
    assetRegistry?: Address;
    assets?: readonly unknown[];
    blockTimestamp?: bigint;
    reorg?: boolean;
    strategies?: readonly unknown[];
    symbolByToken?: Readonly<Record<string, string>>;
    targetDecimals?: number;
    targetToken?: Address;
    vault?: Address;
    voter?: Address;
  } = {},
) {
  const contractBlocks: bigint[] = [];
  const values: Record<string, unknown> = {
    ALLOCATION_VOTER: options.voter ?? liveRuntimeFixture.addresses.allocationVoter,
    ASSET_REGISTRY: options.assetRegistry ?? liveRuntimeFixture.addresses.assetRegistry,
    AUCTION_DURATION: 86_400n,
    GBX: liveRuntimeFixture.assets.GBX,
    GBX_DECIMALS: 18,
    GUM_BALL_VAULT: options.vault ?? liveRuntimeFixture.addresses.gumBallVault,
    MAXIMUM_LOT_USDG: 1_000_000_000n,
    MINIMUM_LOT_USDG: 10_000_000n,
    TARGET_DECIMALS: options.targetDecimals ?? 18,
    TARGET_TOKEN: options.targetToken ?? liveRuntimeFixture.assets.NVDA,
    USDG: liveRuntimeFixture.assets.USDG,
    USDG_DECIMALS: 6,
    auctionId: 7n,
    auctionStartTime: 100n,
    currentRate: 500_000_000_000_000_000n,
    fillsPaused: false,
    floorRate: 250_000_000_000_000_000n,
    isLiveStrategy: true,
    previewStrategyBudget: 800_000_000n,
    referenceRate: 500_000_000_000_000_000n,
    startRate: 1_000_000_000_000_000_000n,
  };
  const client = {
    getBlock: async ({ blockNumber }: { blockNumber?: bigint }) => ({
      hash: options.reorg && blockNumber !== undefined ? REORG_HASH : BLOCK_HASH,
      number: BLOCK_NUMBER,
      timestamp: options.blockTimestamp ?? 1_000n,
    }),
    readContract: async ({
      address,
      blockNumber,
      functionName,
    }: {
      address: Address;
      blockNumber: bigint;
      functionName: string;
    }) => {
      contractBlocks.push(blockNumber);
      if (functionName === 'supplyView') {
        return {
          cumulativeBurned: 10n,
          cumulativeMinted: 110n,
          remainingMintCapacity: MAX_CUMULATIVE_MINT - 110n,
          totalSupply: 100n,
        };
      }
      if (functionName === 'assetViews') return options.assets ?? lensAssetRows();
      if (functionName === 'strategyViews') return options.strategies ?? lensStrategyRows();
      if (functionName === 'symbol') {
        const symbol = options.symbolByToken?.[address.toLowerCase()];
        if (symbol !== undefined) return symbol;
      }
      return values[functionName];
    },
  } as unknown as PublicClient;
  return { client, contractBlocks };
}

describe('financial transaction preflights', () => {
  it('pins every redemption read to one block and binds token count and order to the manifest', async () => {
    const { client, contractBlocks, expectedTokens } = redemptionClient();
    const result = await readPinnedRedemptionPreflight(client, liveRuntimeFixture, 5n);

    expect(result).toMatchObject({ blockHash: BLOCK_HASH, blockNumber: BLOCK_NUMBER, shares: 5n, totalSupply: 100n });
    expect(result.outputs.map(({ token }) => token.toLowerCase())).toEqual(
      expectedTokens.map((token) => token.toLowerCase()),
    );
    expect(new Set(contractBlocks)).toEqual(new Set([BLOCK_NUMBER]));
  });

  it('fails closed on redemption length, order, and reorg drift', async () => {
    await expect(
      readPinnedRedemptionPreflight(redemptionClient({ amountsLength: 7 }).client, liveRuntimeFixture, 5n),
    ).rejects.toThrow('length mismatch');

    const short = redemptionClient({ tokens: redemptionClient().expectedTokens.slice(0, -1) });
    await expect(readPinnedRedemptionPreflight(short.client, liveRuntimeFixture, 5n)).rejects.toThrow('asset count');

    const ordered = redemptionClient().expectedTokens;
    const swapped = [ordered[1]!, ordered[0]!, ...ordered.slice(2)];
    await expect(
      readPinnedRedemptionPreflight(redemptionClient({ tokens: swapped }).client, liveRuntimeFixture, 5n),
    ).rejects.toThrow('token order');

    await expect(
      readPinnedRedemptionPreflight(redemptionClient({ reorg: true }).client, liveRuntimeFixture, 5n),
    ).rejects.toThrow('Chain state changed');
  });

  it('pins the complete auction quote, verifies token bindings, and enforces actionable terms', async () => {
    const { client, contractBlocks } = auctionClient();
    const result = await readPinnedAuctionPreflight(
      client,
      liveRuntimeFixture,
      { kind: 'acquisition', strategy: liveRuntimeFixture.strategies.NVDA },
      100_000_000n,
    );

    expect(result).toMatchObject({
      auctionExpiresAt: 86_500n,
      auctionId: 7n,
      blockHash: BLOCK_HASH,
      blockNumber: BLOCK_NUMBER,
      blockTimestamp: 1_000n,
      isExpired: false,
      symbol: 'NVDA',
      targetToken: liveRuntimeFixture.assets.NVDA,
      usdGToken: liveRuntimeFixture.assets.USDG,
    });
    expect(result.requiredTargetRaw).toBe(50n * 10n ** 18n);
    expect(new Set(contractBlocks)).toEqual(new Set([BLOCK_NUMBER]));
    expect(() => assertAuctionFillPreflight(result, result.requiredTargetRaw)).not.toThrow();
    expect(() => assertAuctionFillPreflight(result, result.requiredTargetRaw - 1n)).toThrow('maximum token payment');
  });

  it('rejects fills and permits restart at the exact auction-expiry boundary', async () => {
    const atExpiry = await readPinnedAuctionPreflight(
      auctionClient({ blockTimestamp: 86_500n }).client,
      liveRuntimeFixture,
      { kind: 'acquisition', strategy: liveRuntimeFixture.strategies.NVDA },
      100_000_000n,
    );
    expect(atExpiry.isExpired).toBe(true);
    expect(() => assertAuctionFillPreflight(atExpiry, atExpiry.requiredTargetRaw)).toThrow(
      'Restart it permissionlessly',
    );
    expect(() => assertAuctionRestartPreflight(atExpiry)).not.toThrow();

    const beforeExpiry = await readPinnedAuctionPreflight(
      auctionClient({ blockTimestamp: 86_499n }).client,
      liveRuntimeFixture,
      { kind: 'acquisition', strategy: liveRuntimeFixture.strategies.NVDA },
      100_000_000n,
    );
    expect(beforeExpiry.isExpired).toBe(false);
    expect(() => assertAuctionRestartPreflight(beforeExpiry)).toThrow('still active');
  });

  it('selects an appended acquisition by address even when two registered assets share a symbol', async () => {
    const assets = [
      ...lensAssetRows(),
      extraAssetRow(EXTRA_TOKEN, EXTRA_STRATEGY, EXTRA_REWARDS),
      extraAssetRow(SECOND_EXTRA_TOKEN, SECOND_EXTRA_STRATEGY, SECOND_EXTRA_REWARDS),
    ];
    const strategies = [
      ...lensStrategyRows(),
      extraStrategyRow(EXTRA_TOKEN, EXTRA_STRATEGY),
      extraStrategyRow(SECOND_EXTRA_TOKEN, SECOND_EXTRA_STRATEGY),
    ];
    const { client } = auctionClient({
      assets,
      strategies,
      symbolByToken: {
        [EXTRA_TOKEN.toLowerCase()]: 'LINK',
        [SECOND_EXTRA_TOKEN.toLowerCase()]: 'LINK',
      },
      targetToken: SECOND_EXTRA_TOKEN,
    });
    const result = await readPinnedAuctionPreflight(
      client,
      liveRuntimeFixture,
      { kind: 'acquisition', strategy: SECOND_EXTRA_STRATEGY },
      100_000_000n,
    );

    expect(result).toMatchObject({
      kind: 'acquisition',
      registryIndex: 10,
      strategy: SECOND_EXTRA_STRATEGY,
      symbol: 'LINK',
      targetDecimals: 18,
      targetToken: SECOND_EXTRA_TOKEN,
    });
  });

  it('accepts only the signed canonical buyback address and rejects arbitrary strategy targets', async () => {
    const buyback = await readPinnedAuctionPreflight(
      auctionClient().client,
      liveRuntimeFixture,
      { kind: 'buyback', strategy: liveRuntimeFixture.strategies.BURN },
      100_000_000n,
    );
    expect(buyback).toMatchObject({
      kind: 'buyback',
      registryIndex: 8,
      symbol: 'BURN',
      targetDecimals: 18,
      targetToken: liveRuntimeFixture.assets.GBX,
    });
    expect(buyback.strategy.toLowerCase()).toBe(liveRuntimeFixture.strategies.BURN.toLowerCase());

    await expect(
      readPinnedAuctionPreflight(
        auctionClient().client,
        liveRuntimeFixture,
        { kind: 'acquisition', strategy: fixtureAddress(999) },
        100_000_000n,
      ),
    ).rejects.toThrow('absent from the bounded registry');
  });

  it('rejects target, kind, protocol-binding, decimal, and mixed-block substitution', async () => {
    await expect(
      readPinnedAuctionPreflight(
        auctionClient({ targetToken: liveRuntimeFixture.assets.AAPL }).client,
        liveRuntimeFixture,
        { kind: 'acquisition', strategy: liveRuntimeFixture.strategies.NVDA },
        100_000_000n,
      ),
    ).rejects.toThrow('immutable binding');

    await expect(
      readPinnedAuctionPreflight(
        auctionClient().client,
        liveRuntimeFixture,
        { kind: 'buyback', strategy: liveRuntimeFixture.strategies.NVDA },
        100_000_000n,
      ),
    ).rejects.toThrow('kind does not match');

    await expect(
      readPinnedAuctionPreflight(
        auctionClient({ assetRegistry: liveRuntimeFixture.admin.protocolTimelock }).client,
        liveRuntimeFixture,
        { kind: 'acquisition', strategy: liveRuntimeFixture.strategies.NVDA },
        100_000_000n,
      ),
    ).rejects.toThrow('immutable binding');

    await expect(
      readPinnedAuctionPreflight(
        auctionClient({ targetDecimals: 8 }).client,
        liveRuntimeFixture,
        { kind: 'acquisition', strategy: liveRuntimeFixture.strategies.NVDA },
        100_000_000n,
      ),
    ).rejects.toThrow('decimals do not match');

    await expect(
      readPinnedAuctionPreflight(
        auctionClient({ reorg: true }).client,
        liveRuntimeFixture,
        { kind: 'acquisition', strategy: liveRuntimeFixture.strategies.NVDA },
        100_000_000n,
      ),
    ).rejects.toThrow('Chain state changed');
  });
});
