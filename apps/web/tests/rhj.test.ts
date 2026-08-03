import { releaseManifestSignaturePolicyConfiguration, type DeploymentManifest } from '@gumball-6900/config';
import { getAddress, keccak256, stringToHex, type Address, type Hex, type PublicClient } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RhjRegisteredStockAsset, RhjRegisteredStockSnapshot } from '../lib/rhj';
import type { RuntimeDeployment } from '../lib/runtime-types';

vi.mock('server-only', () => ({}));

const overviewMock = vi.hoisted(() => ({
  read: vi.fn(),
}));

vi.mock('../lib/live-protocol-overview', () => ({
  readLiveProtocolOverviewAtBlock: overviewMock.read,
}));

const {
  getRhjMetadataSnapshot,
  readRhjRegisteredStockSnapshot,
  resetRhjCacheForTests,
  RHJ_ASSETS_URL,
  RHJ_CORPORATE_ACTIONS_URL,
  RhjReconciliationError,
} = await import('../lib/rhj');

const BLOCK_NUMBER = 8_888n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as const;

const stockAssets = {
  AAPL: {
    address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    registryIndex: 7,
    uid: '0x00000000000000000000000000000000c2425be3658540dd8e2424cbf3c5c649',
  },
  NVDA: {
    address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
    registryIndex: 6,
    uid: '0x00000000000000000000000000000000915f477416294f5099a5e0e09f327ce5',
  },
  QQQ: {
    address: '0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',
    registryIndex: 3,
    uid: '0x000000000000000000000000000000002470b933c52d47ccad017ed9ee80c9ed',
  },
  SPCX: {
    address: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa',
    registryIndex: 5,
    uid: '0x000000000000000000000000000000001aa9c9cc0bf34c5e95cfe7168463d310',
  },
  TSLA: {
    address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
    registryIndex: 4,
    uid: '0x00000000000000000000000000000000cfece3244ea34bb29414dd9488b32d9f',
  },
} as const satisfies Record<string, { address: Address; registryIndex: number; uid: Hex }>;

type StockSymbol = keyof typeof stockAssets;

const appendedStock = registeredAsset(
  'MSFT',
  '0x1111111111111111111111111111111111111111',
  `0x${'11'.repeat(32)}` as Hex,
  8,
  null,
);

function liveRuntime(): Extract<RuntimeDeployment, { mode: 'live' }> {
  const assets = Object.fromEntries(Object.entries(stockAssets).map(([symbol, { address }]) => [symbol, address]));
  const assetMetadata = Object.fromEntries(
    Object.entries(stockAssets).map(([symbol, { address, uid }]) => [
      symbol,
      {
        acquisitionEnabled: true,
        address,
        decimals: 18,
        redemptionEnabled: true,
        registryStatus: 'ASSET_STATUS_ACTIVE',
        symbol,
        uid,
      },
    ]),
  );
  return {
    mode: 'live',
    addresses: {
      assetRegistry: '0x2222222222222222222222222222222222222222',
      gumBallLens: '0x3333333333333333333333333333333333333333',
    },
    assetMetadata,
    chain: {
      id: 4663,
      environment: 'mainnet',
      explorerUrl: 'https://robinhoodchain.blockscout.com',
      name: 'Robinhood Chain',
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      rpcUrl: 'https://rpc.example.test/robinhood',
      fallbackRpcUrls: ['https://rpc-fallback.example.test/robinhood'],
    },
    assets,
  } as unknown as Extract<RuntimeDeployment, { mode: 'live' }>;
}

function approvedManifest(): DeploymentManifest {
  return {
    assets: Object.entries(stockAssets).map(([key, { address, uid }]) => ({ address, decimals: 18, key, uid })),
    deployedContracts: [
      { address: liveRuntime().addresses.assetRegistry, name: 'AssetRegistry' },
      { address: liveRuntime().addresses.gumBallLens, name: 'GumBallLens' },
    ],
    network: { chainId: 4663 },
    release: { status: 'release-approved' },
  } as unknown as DeploymentManifest;
}

function registeredAsset(
  symbol: string,
  address: Address,
  uid: Hex,
  registryIndex: number,
  genesisSymbol: StockSymbol | null,
): RhjRegisteredStockAsset {
  return {
    address: getAddress(address),
    assetId: uid,
    decimals: 18,
    genesisSymbol,
    registryIndex,
    symbol,
    symbolHash: keccak256(stringToHex(symbol)),
    uid,
    uiMultiplier: 10n ** 18n,
  };
}

function baseRegisteredStocks(): readonly RhjRegisteredStockAsset[] {
  return Object.entries(stockAssets).map(([symbol, asset]) =>
    registeredAsset(symbol, asset.address, asset.uid, asset.registryIndex, symbol as StockSymbol),
  );
}

function registeredSnapshot(
  assets: readonly RhjRegisteredStockAsset[] = baseRegisteredStocks(),
): RhjRegisteredStockSnapshot {
  return { assets, blockHash: BLOCK_HASH, blockNumber: BLOCK_NUMBER };
}

function registryReader(snapshot: RhjRegisteredStockSnapshot = registeredSnapshot()) {
  return vi.fn(async () => snapshot);
}

function registryAsset(asset: RhjRegisteredStockAsset): Record<string, unknown> {
  return {
    currentMultiplier: '1.000000000000000000',
    deployments: [{ chainId: 4663, contractAddress: asset.address }],
    id: asset.uid,
    pendingMultiplier: asset.genesisSymbol === 'AAPL' ? '4.000000000000000000' : '',
    ...(asset.genesisSymbol === 'AAPL' ? { pendingMultiplierEffectiveTime: '2026-08-02T00:00:00Z' } : {}),
    status: 'ASSET_STATUS_ACTIVE',
    tokenName: `${asset.symbol} · Robinhood Token`,
    tokenSymbol: asset.symbol,
    tradingCapabilities: {
      allDayTradability: 'tradable',
      extendedHoursFractionalTradability: true,
      fractionalTradability: 'tradable',
    },
  };
}

function quote(asset: RhjRegisteredStockAsset): Record<string, unknown> {
  return {
    ask: '213.47',
    bid: '213.45',
    currency: 'USD',
    dailyTradingVolume: '48293710',
    deployments: [{ chainId: 4663, contractAddress: asset.address }],
    generatedAt: '2026-08-01T12:00:00Z',
    isTradingHalt: asset.genesisSymbol === 'AAPL',
    tokenSymbol: asset.symbol,
  };
}

function action(asset: RhjRegisteredStockAsset): Record<string, unknown> {
  return {
    deployments: [{ chainId: 4663, contractAddress: asset.address }],
    details: { forwardSplit: { newRate: '4', oldRate: '1', underlyingSymbol: asset.symbol } },
    id: asset.uid,
    processDate: { day: 2, month: 8, year: 2026 },
    status: 'CORPORATE_ACTION_STATUS_IN_PROGRESS',
    tokenSymbol: asset.symbol,
    type: 'CORPORATE_ACTION_TYPE_FORWARD_SPLIT',
  };
}

function jsonResponse(value: unknown, cacheControl?: string): Response {
  return new Response(JSON.stringify(value), {
    headers: {
      'content-type': 'application/json',
      ...(cacheControl === undefined ? {} : { 'cache-control': cacheControl }),
    },
    status: 200,
  });
}

function officialFetch(
  selected: readonly RhjRegisteredStockAsset[] = baseRegisteredStocks(),
  options: {
    assetAddressOverride?: Address;
    assetCacheControl?: string | null;
    registryRecords?: readonly Record<string, unknown>[];
    rejectAssets?: boolean;
  } = {},
): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).has('authorization')).toBe(false);
    const url = String(input);
    expect(url.startsWith('https://api.robinhood.com/rhj/')).toBe(true);
    if (url === RHJ_ASSETS_URL) {
      if (options.rejectAssets === true) throw new Error('registry unavailable');
      const assets = [...(options.registryRecords ?? selected.map(registryAsset))];
      if (options.assetAddressOverride !== undefined) {
        const aapl = assets.find(({ tokenSymbol }) => tokenSymbol === 'AAPL')!;
        aapl.deployments = [{ chainId: 4663, contractAddress: options.assetAddressOverride }];
      }
      return jsonResponse(
        { assets },
        options.assetCacheControl === undefined ? 'public, max-age=60' : (options.assetCacheControl ?? undefined),
      );
    }
    if (url === RHJ_CORPORATE_ACTIONS_URL) {
      return jsonResponse({ corpActions: [action(selected.find(({ genesisSymbol }) => genesisSymbol === 'AAPL')!)] });
    }
    const symbol = decodeURIComponent(url.split('/').at(-1)!);
    const matches = selected.filter((asset) => asset.symbol === symbol);
    if (matches.length !== 1) throw new Error(`ambiguous test price request for ${symbol}`);
    return jsonResponse({ quotes: [quote(matches[0]!)] });
  }) as typeof fetch;
}

const manifestValidator = async (): Promise<DeploymentManifest> => approvedManifest();

beforeEach(() => {
  resetRhjCacheForTests();
  overviewMock.read.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('read-only Robinhood metadata service', () => {
  it('reconciles every signed stock through the manifest, AssetRegistry, chain, and official records', async () => {
    const fetchImplementation = officialFetch();
    const readRegistry = registryReader();
    const anchoredManifestValidator = vi.fn(async (): Promise<DeploymentManifest> => approvedManifest());
    const snapshot = await getRhjMetadataSnapshot(liveRuntime(), '{}', {
      fetchImplementation,
      manifestValidator: anchoredManifestValidator,
      now: () => Date.parse('2026-08-01T12:00:01Z'),
      registryReader: readRegistry,
    });

    expect(snapshot.readOnly).toBe(true);
    expect(snapshot.transactionAuthoritative).toBe(false);
    expect(snapshot.pricesAreMultiplierAdjusted).toBe(false);
    expect(snapshot.registryBlockHash).toBe(BLOCK_HASH);
    expect(snapshot.registryBlockNumber).toBe(BLOCK_NUMBER.toString());
    expect(snapshot.assets).toHaveLength(5);
    expect(fetchImplementation).toHaveBeenCalledTimes(7);
    expect(readRegistry).toHaveBeenCalledTimes(1);
    expect(anchoredManifestValidator).toHaveBeenCalledWith({}, releaseManifestSignaturePolicyConfiguration);
    const aapl = snapshot.assets.find(({ genesisSymbol }) => genesisSymbol === 'AAPL')!;
    expect(aapl.verification).toEqual({
      assetRegistry: 'matched',
      manifestAddress: 'matched',
      manifestUid: 'matched',
      onchainUid: 'matched',
      registry: 'matched',
      tokenMetadata: 'matched',
    });
    expect(aapl.currentMultiplierSource).toBe('onchain');
    expect(aapl.isTradingHalt).toBe(true);
    expect(aapl.registryStatus).toBe('ASSET_STATUS_ACTIVE');
    expect(aapl.corporateActions).toHaveLength(1);
    expect(aapl.warnings.join(' ')).toContain('trading halt');
    expect(aapl.warnings.join(' ')).toContain('pending multiplier');
  });

  it('uses bounded endpoint TTLs without caller-derived cache keys', async () => {
    let now = Date.parse('2026-08-01T12:00:00Z');
    const fetchImplementation = officialFetch();
    const options = {
      fetchImplementation,
      manifestValidator,
      now: () => now,
      registryReader: registryReader(),
    };

    await getRhjMetadataSnapshot(liveRuntime(), '{}', options);
    const cached = await getRhjMetadataSnapshot(liveRuntime(), '{}', options);
    expect(fetchImplementation).toHaveBeenCalledTimes(7);
    expect(cached.sources.assets).toBe('cached');
    expect(cached.sources.corporateActions).toBe('cached');
    expect(cached.sources.prices.map(({ status }) => status)).toEqual(Array(5).fill('cached'));

    now += 15_001;
    const refreshed = await getRhjMetadataSnapshot(liveRuntime(), '{}', options);
    expect(fetchImplementation).toHaveBeenCalledTimes(12);
    expect(refreshed.sources.assets).toBe('cached');
    expect(refreshed.sources.corporateActions).toBe('cached');
    expect(refreshed.sources.prices.map(({ status }) => status)).toEqual(Array(5).fill('fresh'));
  });

  it('keeps official upstream failure explicit while retaining block-verified registry identity', async () => {
    const snapshot = await getRhjMetadataSnapshot(liveRuntime(), '{}', {
      fetchImplementation: officialFetch(baseRegisteredStocks(), { rejectAssets: true }),
      manifestValidator,
      now: () => Date.parse('2026-08-01T12:00:00Z'),
      registryReader: registryReader(),
    });

    expect(snapshot.sources.assets).toBe('unavailable');
    expect(snapshot.assets.every(({ currentMultiplierSource }) => currentMultiplierSource === 'onchain')).toBe(true);
    expect(snapshot.assets.every(({ registryStatus }) => registryStatus === 'UNKNOWN')).toBe(true);
    expect(snapshot.assets.every(({ verification }) => verification.registry === 'unavailable')).toBe(true);
  });

  it('includes a valid appended stock without weakening the five signed-genesis bindings', async () => {
    const selected = [...baseRegisteredStocks(), appendedStock];
    const snapshot = await getRhjMetadataSnapshot(liveRuntime(), '{}', {
      fetchImplementation: officialFetch(selected),
      manifestValidator,
      registryReader: registryReader(registeredSnapshot(selected)),
    });

    expect(snapshot.assets).toHaveLength(6);
    expect(snapshot.assets.filter(({ identitySource }) => identitySource === 'signed-genesis')).toHaveLength(5);
    expect(snapshot.assets.find(({ address }) => address === appendedStock.address)).toMatchObject({
      assetId: appendedStock.uid,
      decimals: 18,
      genesisSymbol: null,
      identitySource: 'registered-post-launch',
      registryIndex: 8,
      symbol: 'MSFT',
      uid: appendedStock.uid,
      verification: {
        assetRegistry: 'matched',
        manifestAddress: 'not-applicable',
        manifestUid: 'not-applicable',
        onchainUid: 'matched',
        registry: 'matched',
        tokenMetadata: 'matched',
      },
    });
  });

  it('fails closed on official substitution or an omitted appended official identity', async () => {
    const substitutedManifest = approvedManifest();
    substitutedManifest.deployedContracts.find(({ name }) => name === 'GumBallLens')!.address =
      '0x4444444444444444444444444444444444444444';
    await expect(
      getRhjMetadataSnapshot(liveRuntime(), '{}', {
        fetchImplementation: officialFetch(),
        manifestValidator: async () => substitutedManifest,
        registryReader: registryReader(),
      }),
    ).rejects.toThrow('Runtime Lens or AssetRegistry does not match');

    await expect(
      getRhjMetadataSnapshot(liveRuntime(), '{}', {
        fetchImplementation: officialFetch(baseRegisteredStocks(), {
          assetAddressOverride: '0x4444444444444444444444444444444444444444',
        }),
        manifestValidator,
        registryReader: registryReader(),
      }),
    ).rejects.toBeInstanceOf(RhjReconciliationError);

    resetRhjCacheForTests();
    const duplicateOfficial = registryAsset(baseRegisteredStocks()[0]!);
    await expect(
      getRhjMetadataSnapshot(liveRuntime(), '{}', {
        fetchImplementation: officialFetch(baseRegisteredStocks(), {
          registryRecords: [...baseRegisteredStocks().map(registryAsset), duplicateOfficial],
        }),
        manifestValidator,
        registryReader: registryReader(),
      }),
    ).rejects.toThrow('does not uniquely reconcile by UID and address');

    resetRhjCacheForTests();
    const selected = [...baseRegisteredStocks(), appendedStock];
    await expect(
      getRhjMetadataSnapshot(liveRuntime(), '{}', {
        fetchImplementation: officialFetch(selected, {
          registryRecords: baseRegisteredStocks().map(registryAsset),
        }),
        manifestValidator,
        registryReader: registryReader(registeredSnapshot(selected)),
      }),
    ).rejects.toThrow('does not uniquely reconcile by UID and address');
  });

  it('rejects duplicate registry UID or address while allowing duplicate display symbols without cross-attachment', async () => {
    const duplicateUid = { ...appendedStock, uid: stockAssets.AAPL.uid, assetId: stockAssets.AAPL.uid };
    await expect(
      getRhjMetadataSnapshot(liveRuntime(), '{}', {
        fetchImplementation: officialFetch(),
        manifestValidator,
        registryReader: registryReader(registeredSnapshot([...baseRegisteredStocks(), duplicateUid])),
      }),
    ).rejects.toThrow('duplicate UID');

    const duplicateAddress = { ...appendedStock, address: stockAssets.AAPL.address };
    await expect(
      getRhjMetadataSnapshot(liveRuntime(), '{}', {
        fetchImplementation: officialFetch(),
        manifestValidator,
        registryReader: registryReader(registeredSnapshot([...baseRegisteredStocks(), duplicateAddress])),
      }),
    ).rejects.toThrow('duplicate address');

    const sameSymbol = {
      ...appendedStock,
      symbol: 'AAPL',
      symbolHash: keccak256(stringToHex('AAPL')),
    };
    const selected = [...baseRegisteredStocks(), sameSymbol];
    const fetchImplementation = officialFetch(selected);
    const snapshot = await getRhjMetadataSnapshot(liveRuntime(), '{}', {
      fetchImplementation,
      manifestValidator,
      registryReader: registryReader(registeredSnapshot(selected)),
    });
    const aaplRows = snapshot.assets.filter(({ symbol }) => symbol === 'AAPL');
    expect(aaplRows).toHaveLength(2);
    expect(aaplRows.every(({ isTradingHalt }) => isTradingHalt === null)).toBe(true);
    expect(
      snapshot.sources.prices
        .filter(({ address }) => aaplRows.some((asset) => asset.address === address))
        .every(({ status }) => status === 'unavailable'),
    ).toBe(true);
    expect(fetchImplementation).not.toHaveBeenCalledWith(expect.stringContaining('/prices/AAPL'), expect.anything());
    expect(aaplRows.find(({ identitySource }) => identitySource === 'signed-genesis')?.corporateActions).toHaveLength(
      1,
    );
    expect(
      aaplRows.find(({ identitySource }) => identitySource === 'registered-post-launch')?.corporateActions,
    ).toHaveLength(0);
  });

  it('pins Lens and token identity reads to one hash and rejects a reorg before returning', async () => {
    const runtime = liveRuntime();
    const selected = baseRegisteredStocks();
    overviewMock.read.mockResolvedValue({
      assets: selected.map((asset) => ({
        ...asset,
        isStockToken: true,
        token: asset.address,
      })),
      blockNumber: BLOCK_NUMBER,
      strategies: [],
      supply: {},
    });
    const tokenByAddress = new Map(selected.map((asset) => [asset.address.toLowerCase(), asset] as const));
    const readContract = vi.fn(
      async ({
        address,
        blockNumber,
        functionName,
      }: {
        address: Address;
        blockNumber: bigint;
        functionName: string;
      }) => {
        expect(blockNumber).toBe(BLOCK_NUMBER);
        if (functionName === 'ASSET_REGISTRY') return runtime.addresses.assetRegistry;
        const asset = tokenByAddress.get(address.toLowerCase())!;
        if (functionName === 'uid') return asset.uid;
        if (functionName === 'uiMultiplier') return asset.uiMultiplier;
        if (functionName === 'symbol') return asset.symbol;
        if (functionName === 'decimals') return asset.decimals;
        throw new Error(`unexpected read ${functionName}`);
      },
    );
    const stableClient = {
      getBlock: vi.fn(async ({ blockTag }: { blockNumber?: bigint; blockTag?: string }) => ({
        hash: BLOCK_HASH,
        number: BLOCK_NUMBER,
        timestamp: blockTag === 'latest' ? 1n : 2n,
      })),
      getChainId: vi.fn(async () => 4663),
      readContract,
    } as unknown as PublicClient;

    const snapshot = await readRhjRegisteredStockSnapshot(stableClient, runtime);
    expect(snapshot.blockHash).toBe(BLOCK_HASH);
    expect(snapshot.assets).toHaveLength(5);
    expect(overviewMock.read).toHaveBeenCalledWith(stableClient, runtime, {
      hash: BLOCK_HASH,
      number: BLOCK_NUMBER,
    });
    expect(readContract.mock.calls.every(([request]) => request.blockNumber === BLOCK_NUMBER)).toBe(true);

    const substitutedLensClient = {
      ...stableClient,
      readContract: vi.fn(async (request: { address: Address; blockNumber: bigint; functionName: string }) =>
        request.functionName === 'ASSET_REGISTRY'
          ? '0x4444444444444444444444444444444444444444'
          : readContract(request),
      ),
    } as unknown as PublicClient;
    await expect(readRhjRegisteredStockSnapshot(substitutedLensClient, runtime)).rejects.toThrow(
      'does not reference the signed AssetRegistry',
    );

    const substitutedUidClient = {
      ...stableClient,
      readContract: vi.fn(async (request: { address: Address; blockNumber: bigint; functionName: string }) =>
        request.functionName === 'uid' && request.address.toLowerCase() === selected[0]!.address.toLowerCase()
          ? (`0x${'77'.repeat(32)}` as Hex)
          : readContract(request),
      ),
    } as unknown as PublicClient;
    await expect(readRhjRegisteredStockSnapshot(substitutedUidClient, runtime)).rejects.toThrow(
      'UID does not match its AssetRegistry assetId',
    );

    const reorgClient = {
      ...stableClient,
      getBlock: vi
        .fn()
        .mockResolvedValueOnce({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: 1n })
        .mockResolvedValueOnce({ hash: `0x${'cd'.repeat(32)}`, number: BLOCK_NUMBER, timestamp: 2n }),
    } as unknown as PublicClient;
    await expect(readRhjRegisteredStockSnapshot(reorgClient, runtime)).rejects.toThrow(
      'Chain state changed during RHJ registry reads',
    );
  });

  it('keeps testnet unsupported', async () => {
    const mainnet = liveRuntime();
    const testnet = {
      ...mainnet,
      chain: { ...mainnet.chain, environment: 'testnet' as const, id: 46630 as const },
    };
    await expect(getRhjMetadataSnapshot(testnet, '{}')).rejects.toThrow('available only for Robinhood Chain 4663');
  });
});
