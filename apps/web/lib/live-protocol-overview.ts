import { gumBallLensAbi, MAX_CUMULATIVE_MINT, readSupplyView, type SupplyView } from '@gumball-6900/sdk';
import {
  getAddress,
  isAddress,
  isAddressEqual,
  isHex,
  keccak256,
  size,
  stringToHex,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
} from 'viem';

import {
  rewardSymbols,
  strategySymbols,
  type AssetSymbol,
  type LiveRuntimeDeployment,
  type StrategySymbol,
} from './runtime-types';

export const basketAssetSymbols = ['USDG', 'WETH', 'WBTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL'] as const;
export type BasketAssetSymbol = (typeof basketAssetSymbols)[number];

const erc20SymbolAbi = [
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const MAX_REGISTRY_ASSETS = 16;
export const MAX_REGISTRY_STRATEGIES = 17;

export interface LiveAssetOverview {
  readonly acquisitionEnabled: boolean;
  readonly assetId: Hex;
  readonly decimals: number;
  readonly isStockToken: boolean;
  readonly redemptionEnabled: boolean;
  readonly rewards: Address;
  readonly registryIndex: number;
  readonly strategy: Address;
  /** Signed genesis identity when this is one of the required launch assets. */
  readonly genesisSymbol: BasketAssetSymbol | null;
  /** Token symbol verified against the registry's immutable symbolHash. */
  readonly symbol: string;
  readonly symbolHash: Hex;
  readonly token: Address;
  readonly vaultBalance: bigint;
}

export type LiveStrategyKind = 'hold-usdg' | 'acquisition' | 'buyback' | 'standalone';

export interface LiveStrategyOverview {
  readonly activeWeight: bigint;
  readonly live: boolean;
  readonly kind: LiveStrategyKind;
  readonly registryIndex: number;
  readonly strategy: Address;
  /** Signed genesis identity when this is one of the required launch strategies. */
  readonly genesisSymbol: StrategySymbol | null;
  readonly symbol: string;
  readonly token: Address;
  readonly virtualUSDGBudget: bigint;
  readonly voterDisabled: boolean;
}

export interface LiveProtocolOverview {
  readonly assets: readonly LiveAssetOverview[];
  readonly blockNumber: bigint;
  readonly strategies: readonly LiveStrategyOverview[];
  readonly supply: Omit<SupplyView, 'blockNumber'>;
}

export interface PinnedProtocolBlock {
  readonly hash: Hash;
  readonly number: bigint;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function boundedArray(value: unknown, label: string, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > maximum) throw new Error(`${label} exceeds its onchain bound.`);
  return value;
}

function unsignedBigInt(value: unknown, label: string): bigint {
  if (typeof value !== 'bigint' || value < 0n) throw new Error(`${label} must be an unsigned bigint.`);
  return value;
}

function address(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
    throw new Error(`${label} must be an address.`);
  }
  return getAddress(value);
}

function bytes32(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHex(value, { strict: true }) || size(value) !== 32) {
    throw new Error(`${label} must be bytes32.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function decimals(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 255) {
    throw new Error(`${label} must be uint8.`);
  }
  return Number(value);
}

function matchingAddress(left: Address, right: Address): boolean {
  return isAddressEqual(left, right);
}

function expectedReward(runtime: LiveRuntimeDeployment, symbol: BasketAssetSymbol): Address {
  if (symbol === 'USDG') return zeroAddress;
  if (!rewardSymbols.includes(symbol)) throw new Error(`No manager-reward identity exists for ${symbol}.`);
  return runtime.rewards[symbol];
}

interface ParsedAssetView extends Omit<LiveAssetOverview, 'genesisSymbol' | 'symbol'> {
  readonly genesisSymbol: BasketAssetSymbol | null;
  readonly symbol: string | null;
}

function parseAssetViews(value: unknown, runtime: LiveRuntimeDeployment): readonly ParsedAssetView[] {
  const rows = boundedArray(value, 'GumBallLens asset views', MAX_REGISTRY_ASSETS);
  if (rows.length < basketAssetSymbols.length) {
    throw new Error('GumBallLens asset views omit a required signed genesis asset.');
  }
  const seenTokens = new Set<string>();
  const parsed: ParsedAssetView[] = [];

  for (const [index, raw] of rows.entries()) {
    const row = object(raw, `GumBallLens asset view ${index.toString()}`);
    const token = address(row.token, `assetViews[${index.toString()}].token`);
    if (matchingAddress(token, zeroAddress)) throw new Error('GumBallLens returned a zero-address asset.');
    if (seenTokens.has(token.toLowerCase())) throw new Error('GumBallLens returned duplicate asset views.');
    seenTokens.add(token.toLowerCase());

    const genesisSymbol = basketAssetSymbols[index] ?? null;
    if (genesisSymbol !== null && !matchingAddress(token, runtime.assets[genesisSymbol])) {
      throw new Error(`GumBallLens signed genesis asset order drifted at ${genesisSymbol}.`);
    }

    const assetDecimals = decimals(row.decimals, `assetViews[${index.toString()}].decimals`);
    const strategy = address(row.strategy, `assetViews[${index.toString()}].strategy`);
    const rewards = address(row.rewards, `assetViews[${index.toString()}].rewards`);
    const symbolHash = bytes32(row.symbolHash, `assetViews[${index.toString()}].symbolHash`);
    const isStockToken = boolean(row.isStockToken, `assetViews[${index.toString()}].isStockToken`);
    if (genesisSymbol !== null) {
      const expectedSymbolHash = keccak256(stringToHex(genesisSymbol));
      if (assetDecimals !== runtime.assetMetadata[genesisSymbol].decimals) {
        throw new Error(`GumBallLens ${genesisSymbol} decimals do not match the signed manifest.`);
      }
      if (!matchingAddress(strategy, runtime.strategies[genesisSymbol])) {
        throw new Error(`GumBallLens ${genesisSymbol} strategy does not match the signed manifest.`);
      }
      if (!matchingAddress(rewards, expectedReward(runtime, genesisSymbol))) {
        throw new Error(`GumBallLens ${genesisSymbol} rewards contract does not match the signed manifest.`);
      }
      if (symbolHash.toLowerCase() !== expectedSymbolHash.toLowerCase()) {
        throw new Error(`GumBallLens ${genesisSymbol} symbol hash does not match its manifest symbol.`);
      }
      const expectedStockToken = runtime.assetMetadata[genesisSymbol].registryStatus === 'ASSET_STATUS_ACTIVE';
      if (isStockToken !== expectedStockToken) {
        throw new Error(`GumBallLens ${genesisSymbol} stock-token identity does not match the signed manifest.`);
      }
    }

    parsed.push({
      acquisitionEnabled: boolean(row.acquisitionEnabled, `assetViews[${index.toString()}].acquisitionEnabled`),
      assetId: bytes32(row.assetId, `assetViews[${index.toString()}].assetId`),
      decimals: assetDecimals,
      genesisSymbol,
      isStockToken,
      redemptionEnabled: boolean(row.redemptionEnabled, `assetViews[${index.toString()}].redemptionEnabled`),
      rewards,
      registryIndex: index,
      strategy,
      symbol: genesisSymbol,
      symbolHash,
      token,
      vaultBalance: unsignedBigInt(row.vaultBalance, `assetViews[${index.toString()}].vaultBalance`),
    });
  }
  return parsed;
}

function expectedStrategyToken(runtime: LiveRuntimeDeployment, symbol: StrategySymbol): Address {
  return symbol === 'BURN' ? zeroAddress : runtime.assets[symbol as Exclude<AssetSymbol, 'GBX'>];
}

function parseStrategyViews(
  value: unknown,
  runtime: LiveRuntimeDeployment,
  assets: readonly LiveAssetOverview[],
): readonly LiveStrategyOverview[] {
  const rows = boundedArray(value, 'GumBallLens strategy views', MAX_REGISTRY_STRATEGIES);
  if (rows.length < strategySymbols.length) {
    throw new Error('GumBallLens strategy views omit a required signed genesis strategy.');
  }
  const assetsByToken = new Map(assets.map((asset) => [asset.token.toLowerCase(), asset] as const));
  const seenStrategies = new Set<string>();
  const parsed: LiveStrategyOverview[] = [];

  for (const [index, raw] of rows.entries()) {
    const row = object(raw, `GumBallLens strategy view ${index.toString()}`);
    const strategy = address(row.strategy, `strategyViews[${index.toString()}].strategy`);
    if (matchingAddress(strategy, zeroAddress)) throw new Error('GumBallLens returned a zero-address strategy.');
    if (seenStrategies.has(strategy.toLowerCase())) throw new Error('GumBallLens returned duplicate strategy views.');
    seenStrategies.add(strategy.toLowerCase());
    const token = address(row.token, `strategyViews[${index.toString()}].token`);
    const genesisSymbol = strategySymbols[index] ?? null;
    if (genesisSymbol !== null) {
      if (!matchingAddress(strategy, runtime.strategies[genesisSymbol])) {
        throw new Error(`GumBallLens signed genesis strategy order drifted at ${genesisSymbol}.`);
      }
      if (!matchingAddress(token, expectedStrategyToken(runtime, genesisSymbol))) {
        throw new Error(`GumBallLens ${genesisSymbol} strategy token does not match the signed manifest.`);
      }
    }
    const asset = matchingAddress(token, zeroAddress) ? undefined : assetsByToken.get(token.toLowerCase());
    if (!matchingAddress(token, zeroAddress) && asset === undefined) {
      throw new Error('GumBallLens returned a strategy token outside the bounded asset registry.');
    }
    if (asset !== undefined && !matchingAddress(asset.strategy, strategy)) {
      throw new Error(`GumBallLens ${asset.symbol} asset and strategy records disagree.`);
    }
    const symbol = genesisSymbol ?? asset?.symbol ?? `STRATEGY-${strategy.slice(2, 10).toUpperCase()}`;
    const kind: LiveStrategyKind =
      genesisSymbol === 'BURN'
        ? 'buyback'
        : genesisSymbol === 'USDG'
          ? 'hold-usdg'
          : asset !== undefined
            ? 'acquisition'
            : 'standalone';
    parsed.push({
      activeWeight: unsignedBigInt(row.activeWeight, `strategyViews[${index.toString()}].activeWeight`),
      genesisSymbol,
      kind,
      live: boolean(row.live, `strategyViews[${index.toString()}].live`),
      registryIndex: index,
      strategy,
      symbol,
      token,
      virtualUSDGBudget: unsignedBigInt(row.virtualUSDGBudget, `strategyViews[${index.toString()}].virtualUSDGBudget`),
      voterDisabled: boolean(row.voterDisabled, `strategyViews[${index.toString()}].voterDisabled`),
    });
  }
  for (const asset of assets) {
    if (
      !matchingAddress(asset.strategy, zeroAddress) &&
      !parsed.some((strategy) => matchingAddress(strategy.strategy, asset.strategy))
    ) {
      throw new Error(`GumBallLens omitted the registered ${asset.symbol} asset strategy.`);
    }
  }
  return parsed;
}

function validDisplaySymbol(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 32) {
    throw new Error(`${label} must be a nonempty string of at most 32 characters.`);
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x21 || codePoint > 0x7e) throw new Error(`${label} contains unsupported display characters.`);
  }
  return value;
}

async function resolveAssetSymbols(
  client: PublicClient,
  blockNumber: bigint,
  assets: readonly ParsedAssetView[],
): Promise<readonly LiveAssetOverview[]> {
  return Promise.all(
    assets.map(async (asset) => {
      const symbol =
        asset.symbol ??
        validDisplaySymbol(
          await client.readContract({
            abi: erc20SymbolAbi,
            address: asset.token,
            blockNumber,
            functionName: 'symbol',
          }),
          `Registered token ${asset.token} symbol`,
        );
      if (keccak256(stringToHex(symbol)).toLowerCase() !== asset.symbolHash.toLowerCase()) {
        throw new Error(`Registered token ${asset.token} symbol does not match its immutable registry symbolHash.`);
      }
      return { ...asset, symbol };
    }),
  );
}

function validateSupply(supply: SupplyView, blockNumber: bigint): Omit<SupplyView, 'blockNumber'> {
  if (supply.blockNumber !== blockNumber) throw new Error('GumBallLens supply was not read at the pinned block.');
  if (supply.cumulativeMinted > MAX_CUMULATIVE_MINT) {
    throw new Error('GumBallLens cumulative minting exceeds the one-billion cap.');
  }
  if (supply.cumulativeBurned > supply.cumulativeMinted) {
    throw new Error('GumBallLens cumulative burns exceed cumulative minting.');
  }
  if (supply.totalSupply !== supply.cumulativeMinted - supply.cumulativeBurned) {
    throw new Error('GumBallLens supply counters are inconsistent.');
  }
  if (supply.remainingMintCapacity !== MAX_CUMULATIVE_MINT - supply.cumulativeMinted) {
    throw new Error('GumBallLens remaining mint capacity is inconsistent.');
  }
  return {
    cumulativeBurned: supply.cumulativeBurned,
    cumulativeMinted: supply.cumulativeMinted,
    remainingMintCapacity: supply.remainingMintCapacity,
    totalSupply: supply.totalSupply,
  };
}

/** Reads the signed Lens graph at a caller-owned block pin. The caller must hash-revalidate the pin. */
export async function readLiveProtocolOverviewAtBlock(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  pinnedBlock: PinnedProtocolBlock,
): Promise<LiveProtocolOverview> {
  const [supply, rawAssets, rawStrategies] = await Promise.all([
    readSupplyView(client, runtime.addresses.gumBallLens, {
      atBlock: pinnedBlock.number,
      expectedBlockHash: pinnedBlock.hash,
    }),
    client.readContract({
      abi: gumBallLensAbi,
      address: runtime.addresses.gumBallLens,
      blockNumber: pinnedBlock.number,
      functionName: 'assetViews',
    }),
    client.readContract({
      abi: gumBallLensAbi,
      address: runtime.addresses.gumBallLens,
      blockNumber: pinnedBlock.number,
      functionName: 'strategyViews',
    }),
  ]);

  const assets = await resolveAssetSymbols(client, pinnedBlock.number, parseAssetViews(rawAssets, runtime));
  const overview = {
    assets,
    blockNumber: pinnedBlock.number,
    strategies: parseStrategyViews(rawStrategies, runtime, assets),
    supply: validateSupply(supply, pinnedBlock.number),
  };
  return overview;
}

/** Reads the signed Lens graph at one block and rejects identity drift or a reorg before exposing values. */
export async function readLiveProtocolOverview(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
): Promise<LiveProtocolOverview> {
  const pinnedBlock = await client.getBlock({ blockTag: 'latest' });
  if (pinnedBlock.hash === null) throw new Error('Pinned protocol-overview block did not have a hash.');
  const overview = await readLiveProtocolOverviewAtBlock(client, runtime, {
    hash: pinnedBlock.hash,
    number: pinnedBlock.number,
  });
  const confirmedBlock = await client.getBlock({ blockNumber: pinnedBlock.number });
  if (confirmedBlock.hash === null || confirmedBlock.hash.toLowerCase() !== pinnedBlock.hash.toLowerCase()) {
    throw new Error('Chain state changed during protocol-overview reads.');
  }
  return overview;
}
