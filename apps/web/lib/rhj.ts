import 'server-only';

import {
  releaseManifestSignaturePolicyConfiguration,
  validateDeploymentManifest,
  type DeploymentManifest,
  type ReleaseManifestSignaturePolicyConfiguration,
} from '@gumball-6900/config';
import { gumBallLensAbi } from '@gumball-6900/sdk';
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHex,
  keccak256,
  parseAbi,
  stringToHex,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
} from 'viem';

import { readLiveProtocolOverviewAtBlock } from './live-protocol-overview';
import type { RuntimeDeployment } from './runtime-types';

export const RHJ_ASSETS_URL = 'https://api.robinhood.com/rhj/assets' as const;
export const RHJ_CORPORATE_ACTIONS_URL = 'https://api.robinhood.com/rhj/corporate-actions' as const;

const STOCK_SYMBOLS = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'] as const;
const STOCK_SYMBOL_SET = new Set<string>(STOCK_SYMBOLS);
const RHJ_BASE_URL = 'https://api.robinhood.com/rhj/';
const CORPORATE_ACTION_CACHE_MILLISECONDS = 60 * 60 * 1_000;
const PRICE_CACHE_MILLISECONDS = 15 * 1_000;
const DEFAULT_TIMEOUT_MILLISECONDS = 4_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 18;
const MAX_REGISTERED_ASSETS = 16;
const FIXED_18_PATTERN = /^\d+\.\d{18}$/u;
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/u;
const BYTES_32_PATTERN = /^0x[0-9a-f]{64}$/u;

const STOCK_TOKEN_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function uid() view returns (bytes32)',
  'function uiMultiplier() view returns (uint256)',
]);

export type RhjStockSymbol = (typeof STOCK_SYMBOLS)[number];
export type RhjRegistryStatus =
  | 'ASSET_STATUS_ACTIVE'
  | 'ASSET_STATUS_INACTIVE'
  | 'ASSET_STATUS_UNSPECIFIED'
  | 'UNKNOWN';
export type RhjSourceStatus = 'fresh' | 'cached' | 'unavailable';

export interface RhjTradingCapabilities {
  readonly allDayTradability: '' | 'position_closing_only' | 'tradable' | 'untradable' | null;
  readonly extendedHoursFractionalTradability: boolean | null;
  readonly fractionalTradability: 'position_closing_only' | 'position_opening_only' | 'tradable' | 'untradable' | null;
}

export interface RhjQuote {
  readonly ask: string;
  readonly bid: string;
  readonly currency: string;
  readonly dailyTradingVolume: string;
  readonly generatedAt: string;
  readonly isTradingHalt: boolean;
}

export interface RhjCorporateAction {
  readonly details: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly processDate: Readonly<{ day: number; month: number; year: number }> | null;
  readonly status: string;
  readonly type: string;
}

export interface RhjAssetMetadata {
  readonly address: Address;
  readonly assetId: Hex;
  readonly corporateActions: readonly RhjCorporateAction[];
  readonly currentMultiplier: string | null;
  readonly currentMultiplierSource: 'onchain' | 'registry' | 'unavailable';
  readonly decimals: number;
  readonly genesisSymbol: RhjStockSymbol | null;
  readonly identitySource: 'signed-genesis' | 'registered-post-launch';
  readonly isTradingHalt: boolean | null;
  readonly pendingMultiplier: string | null;
  readonly pendingMultiplierEffectiveTime: string | null;
  readonly quote: RhjQuote | null;
  readonly registryIndex: number;
  readonly registryStatus: RhjRegistryStatus;
  readonly symbol: string;
  readonly symbolHash: Hex;
  readonly tokenName: string;
  readonly tradingCapabilities: RhjTradingCapabilities | null;
  readonly uid: Hex;
  readonly verification: Readonly<{
    assetRegistry: 'matched';
    manifestAddress: 'matched' | 'not-applicable';
    manifestUid: 'matched' | 'not-applicable';
    onchainUid: 'matched';
    registry: 'matched' | 'unavailable';
    tokenMetadata: 'matched';
  }>;
  readonly warnings: readonly string[];
}

export interface RhjMetadataSnapshot {
  readonly assets: readonly RhjAssetMetadata[];
  readonly chainId: 4663;
  readonly generatedAt: string;
  readonly pricesAreMultiplierAdjusted: false;
  readonly readOnly: true;
  readonly registryBlockHash: Hash;
  readonly registryBlockNumber: string;
  readonly sources: Readonly<{
    assets: RhjSourceStatus;
    corporateActions: RhjSourceStatus;
    prices: readonly Readonly<{ address: Address; status: RhjSourceStatus; uid: Hex }>[];
  }>;
  readonly transactionAuthoritative: false;
}

interface RegistryDeployment {
  readonly chainId: number;
  readonly contractAddress: Address;
}

interface RegistryAsset {
  readonly currentMultiplier: string;
  readonly deployments: readonly RegistryDeployment[];
  readonly id: Hex;
  readonly pendingMultiplier: string;
  readonly pendingMultiplierEffectiveTime: string | null;
  readonly status: Exclude<RhjRegistryStatus, 'UNKNOWN'>;
  readonly tokenName: string;
  readonly tokenSymbol: string;
  readonly tradingCapabilities: RhjTradingCapabilities | null;
}

interface RegistryQuote extends RhjQuote {
  readonly deployments: readonly RegistryDeployment[];
  readonly tokenSymbol: string;
}

interface RegistryCorporateAction extends RhjCorporateAction {
  readonly deployments: readonly RegistryDeployment[];
  readonly id: Hex;
  readonly tokenSymbol: string;
}

export interface RhjRegisteredStockAsset {
  readonly address: Address;
  readonly assetId: Hex;
  readonly decimals: number;
  readonly genesisSymbol: RhjStockSymbol | null;
  readonly registryIndex: number;
  readonly symbol: string;
  readonly symbolHash: Hex;
  readonly uid: Hex;
  readonly uiMultiplier: bigint;
}

export interface RhjRegisteredStockSnapshot {
  readonly assets: readonly RhjRegisteredStockAsset[];
  readonly blockHash: Hash;
  readonly blockNumber: bigint;
}

export type RhjRegistryReader = (
  input: Readonly<{
    runtime: Extract<RuntimeDeployment, { mode: 'live' }>;
    rpcUrls: readonly string[];
  }>,
) => Promise<RhjRegisteredStockSnapshot>;

interface CacheEntry {
  readonly expiresAt: number;
  readonly value: unknown;
}

interface CachedResult<T> {
  readonly status: Exclude<RhjSourceStatus, 'unavailable'>;
  readonly value: T;
}

interface FetchedJson {
  readonly upstreamMaxAgeMilliseconds: number | null;
  readonly value: unknown;
}

interface RhjDependencies {
  readonly fetchImplementation?: typeof fetch;
  readonly manifestValidator?: (
    value: unknown,
    trustedSignaturePolicy?: ReleaseManifestSignaturePolicyConfiguration,
  ) => Promise<DeploymentManifest>;
  readonly now?: () => number;
  readonly registryReader?: RhjRegistryReader;
  readonly timeoutMilliseconds?: number;
}

const upstreamCache = new Map<string, CacheEntry>();
const pendingFetches = new Map<string, Promise<CachedResult<unknown>>>();

export class RhjConfigurationError extends Error {
  override readonly name = 'RhjConfigurationError';
}

export class RhjReconciliationError extends Error {
  override readonly name = 'RhjReconciliationError';
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string, maximumLength = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) {
    throw new Error(`${label} must be a non-empty bounded string`);
  }
  return value;
}

function asAddress(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value)) throw new Error(`${label} must be an EVM address`);
  return getAddress(value);
}

function asUid(value: unknown, label: string): Hex {
  if (
    typeof value !== 'string' ||
    !BYTES_32_PATTERN.test(value) ||
    !isHex(value, { strict: true }) ||
    /^0x0{64}$/u.test(value)
  ) {
    throw new Error(`${label} must be a nonzero lowercase bytes32 value`);
  }
  return value as Hex;
}

function asDisplaySymbol(value: unknown, label: string): string {
  const symbol = asString(value, label, 32);
  for (const character of symbol) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x21 || codePoint > 0x7e) {
      throw new Error(`${label} contains unsupported display characters`);
    }
  }
  return symbol;
}

function asTokenDecimals(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 255) {
    throw new Error(`${label} must be uint8`);
  }
  return Number(value);
}

function asDecimal(value: unknown, label: string): string {
  const parsed = asString(value, label, 128);
  if (!DECIMAL_PATTERN.test(parsed)) throw new Error(`${label} must be a decimal string`);
  return parsed;
}

function asFixed18(value: unknown, label: string): string {
  const parsed = asString(value, label, 128);
  if (!FIXED_18_PATTERN.test(parsed)) throw new Error(`${label} must have exactly 18 decimal places`);
  return parsed;
}

function asIsoDate(value: unknown, label: string): string {
  const parsed = asString(value, label);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`${label} must be an ISO-8601 timestamp`);
  return parsed;
}

function parseDeployments(value: unknown, label: string): readonly RegistryDeployment[] {
  if (!Array.isArray(value) || value.length > 16) throw new Error(`${label} must be a bounded array`);
  return value.map((entry, index) => {
    const record = asRecord(entry, `${label}[${index.toString()}]`);
    if (!Number.isSafeInteger(record.chainId) || Number(record.chainId) <= 0) {
      throw new Error(`${label}[${index.toString()}].chainId must be a positive integer`);
    }
    return {
      chainId: Number(record.chainId),
      contractAddress: asAddress(record.contractAddress, `${label}[${index.toString()}].contractAddress`),
    };
  });
}

function parseTradingCapabilities(value: unknown): RhjTradingCapabilities | null {
  if (value === undefined || value === null) return null;
  const record = asRecord(value, 'tradingCapabilities');
  const fractionalValues = ['position_closing_only', 'position_opening_only', 'tradable', 'untradable'] as const;
  const allDayValues = ['', 'position_closing_only', 'tradable', 'untradable'] as const;
  const fractional = record.fractionalTradability;
  const allDay = record.allDayTradability;
  const extended = record.extendedHoursFractionalTradability;
  if (fractional !== null && !fractionalValues.includes(fractional as (typeof fractionalValues)[number])) {
    throw new Error('tradingCapabilities.fractionalTradability is invalid');
  }
  if (allDay !== null && !allDayValues.includes(allDay as (typeof allDayValues)[number])) {
    throw new Error('tradingCapabilities.allDayTradability is invalid');
  }
  if (extended !== null && typeof extended !== 'boolean') {
    throw new Error('tradingCapabilities.extendedHoursFractionalTradability is invalid');
  }
  return {
    allDayTradability: allDay as RhjTradingCapabilities['allDayTradability'],
    extendedHoursFractionalTradability: extended as boolean | null,
    fractionalTradability: fractional as RhjTradingCapabilities['fractionalTradability'],
  };
}

function parseRegistryAssets(value: unknown): readonly RegistryAsset[] {
  const response = asRecord(value, 'RHJ assets response');
  if (!Array.isArray(response.assets) || response.assets.length > 2_000) {
    throw new Error('RHJ assets response.assets must be a bounded array');
  }
  return response.assets.map((entry, index) => {
    const record = asRecord(entry, `assets[${index.toString()}]`);
    const status = record.status;
    if (!['ASSET_STATUS_ACTIVE', 'ASSET_STATUS_INACTIVE', 'ASSET_STATUS_UNSPECIFIED'].includes(String(status))) {
      throw new Error(`assets[${index.toString()}].status is invalid`);
    }
    return {
      currentMultiplier: asFixed18(record.currentMultiplier, `assets[${index.toString()}].currentMultiplier`),
      deployments: parseDeployments(record.deployments, `assets[${index.toString()}].deployments`),
      id: asUid(record.id, `assets[${index.toString()}].id`),
      pendingMultiplier:
        record.pendingMultiplier === ''
          ? ''
          : asFixed18(record.pendingMultiplier, `assets[${index.toString()}].pendingMultiplier`),
      pendingMultiplierEffectiveTime:
        record.pendingMultiplierEffectiveTime === undefined
          ? null
          : asIsoDate(
              record.pendingMultiplierEffectiveTime,
              `assets[${index.toString()}].pendingMultiplierEffectiveTime`,
            ),
      status: status as Exclude<RhjRegistryStatus, 'UNKNOWN'>,
      tokenName: asString(record.tokenName, `assets[${index.toString()}].tokenName`),
      tokenSymbol: asString(record.tokenSymbol, `assets[${index.toString()}].tokenSymbol`, 16),
      tradingCapabilities: parseTradingCapabilities(record.tradingCapabilities),
    };
  });
}

function parseQuote(value: unknown): RegistryQuote {
  const response = asRecord(value, 'RHJ prices response');
  if (!Array.isArray(response.quotes) || response.quotes.length !== 1) {
    throw new Error('RHJ symbol price response must contain exactly one quote');
  }
  const record = asRecord(response.quotes[0], 'quotes[0]');
  if (typeof record.isTradingHalt !== 'boolean') throw new Error('quotes[0].isTradingHalt must be boolean');
  return {
    ask: asDecimal(record.ask, 'quotes[0].ask'),
    bid: asDecimal(record.bid, 'quotes[0].bid'),
    currency: asString(record.currency, 'quotes[0].currency', 8),
    dailyTradingVolume: asDecimal(record.dailyTradingVolume, 'quotes[0].dailyTradingVolume'),
    deployments: parseDeployments(record.deployments, 'quotes[0].deployments'),
    generatedAt: asIsoDate(record.generatedAt, 'quotes[0].generatedAt'),
    isTradingHalt: record.isTradingHalt,
    tokenSymbol: asString(record.tokenSymbol, 'quotes[0].tokenSymbol', 16),
  };
}

function parseActionDetails(value: unknown, label: string): Readonly<Record<string, Readonly<Record<string, string>>>> {
  const outer = asRecord(value, label);
  const outerEntries = Object.entries(outer);
  if (outerEntries.length !== 1) throw new Error(`${label} must contain exactly one action variant`);
  const [variant, rawFields] = outerEntries[0]!;
  const fields = asRecord(rawFields, `${label}.${variant}`);
  if (Object.keys(fields).length > 12) throw new Error(`${label}.${variant} has too many fields`);
  return {
    [asString(variant, `${label} variant`, 64)]: Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [
        asString(key, `${label} field`, 64),
        asString(field, `${label}.${key}`, 128),
      ]),
    ),
  };
}

function parseCorporateActions(value: unknown): readonly RegistryCorporateAction[] {
  const response = asRecord(value, 'RHJ corporate-actions response');
  if (!Array.isArray(response.corpActions) || response.corpActions.length > 5_000) {
    throw new Error('RHJ corporate-actions response.corpActions must be a bounded array');
  }
  return response.corpActions.map((entry, index) => {
    const label = `corpActions[${index.toString()}]`;
    const record = asRecord(entry, label);
    let processDate: RhjCorporateAction['processDate'] = null;
    if (record.processDate !== undefined && record.processDate !== null) {
      const date = asRecord(record.processDate, `${label}.processDate`);
      if (
        !Number.isInteger(date.year) ||
        !Number.isInteger(date.month) ||
        !Number.isInteger(date.day) ||
        Number(date.year) < 1900 ||
        Number(date.month) < 1 ||
        Number(date.month) > 12 ||
        Number(date.day) < 1 ||
        Number(date.day) > 31
      ) {
        throw new Error(`${label}.processDate is invalid`);
      }
      processDate = { day: Number(date.day), month: Number(date.month), year: Number(date.year) };
    }
    return {
      deployments: parseDeployments(record.deployments, `${label}.deployments`),
      details: parseActionDetails(record.details, `${label}.details`),
      id: asUid(record.id, `${label}.id`),
      processDate,
      status: asString(record.status, `${label}.status`, 64),
      tokenSymbol: asString(record.tokenSymbol, `${label}.tokenSymbol`, 16),
      type: asString(record.type, `${label}.type`, 96),
    };
  });
}

function priceUrl(symbol: string): string {
  return `${RHJ_BASE_URL}prices/${encodeURIComponent(symbol)}`;
}

function ensureOfficialUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://api.robinhood.com' || !parsed.pathname.startsWith('/rhj/')) {
    throw new Error('RHJ fetch attempted a non-official URL');
  }
}

function pruneCache(now: number): void {
  for (const [key, entry] of upstreamCache) {
    if (entry.expiresAt <= now) upstreamCache.delete(key);
  }
  while (upstreamCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = upstreamCache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    upstreamCache.delete(oldestKey);
  }
}

function upstreamMaxAgeMilliseconds(cacheControl: string | null): number | null {
  if (cacheControl === null) return null;
  const match = /(?:^|,)\s*(?:s-maxage|max-age)=(\d+)/iu.exec(cacheControl);
  if (match === null) return null;
  const seconds = Number(match[1]);
  if (!Number.isSafeInteger(seconds) || seconds < 0) return null;
  return Math.min(seconds * 1_000, CORPORATE_ACTION_CACHE_MILLISECONDS);
}

async function fetchJson(
  url: string,
  fetchImplementation: typeof fetch,
  timeoutMilliseconds: number,
): Promise<FetchedJson> {
  ensureOfficialUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetchImplementation(url, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { accept: 'application/json' },
      method: 'GET',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RHJ request failed with status ${response.status.toString()}`);
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error('RHJ response exceeds the maximum size');
    }
    if (response.body === null) throw new Error('RHJ response body is unavailable');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedBytes = 0;
    let body = '';
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      receivedBytes += chunk.value.byteLength;
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('RHJ response exceeds the maximum size');
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return {
      upstreamMaxAgeMilliseconds: upstreamMaxAgeMilliseconds(response.headers.get('cache-control')),
      value: JSON.parse(body) as unknown,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function cachedFetch<T>(
  key: string,
  url: string,
  ttlMilliseconds: number | null,
  parse: (value: unknown) => T,
  dependencies: Required<Pick<RhjDependencies, 'fetchImplementation' | 'now' | 'timeoutMilliseconds'>>,
): Promise<CachedResult<T>> {
  const now = dependencies.now();
  const cached = upstreamCache.get(key);
  if (cached !== undefined && cached.expiresAt > now) {
    upstreamCache.delete(key);
    upstreamCache.set(key, cached);
    return { status: 'cached', value: cached.value as T };
  }

  const existing = pendingFetches.get(key);
  if (existing !== undefined) return existing as Promise<CachedResult<T>>;

  const pending = (async (): Promise<CachedResult<T>> => {
    const response = await fetchJson(url, dependencies.fetchImplementation, dependencies.timeoutMilliseconds);
    const parsed = parse(response.value);
    const effectiveTtl = ttlMilliseconds ?? response.upstreamMaxAgeMilliseconds ?? 0;
    if (effectiveTtl > 0) {
      pruneCache(dependencies.now());
      upstreamCache.set(key, { expiresAt: dependencies.now() + effectiveTtl, value: parsed });
    }
    return { status: 'fresh', value: parsed };
  })();
  pendingFetches.set(key, pending as Promise<CachedResult<unknown>>);
  try {
    return await pending;
  } finally {
    pendingFetches.delete(key);
  }
}

/**
 * Discovers every stock token through the signed Lens at one block on one RPC transport. Token metadata and the
 * Lens' immutable AssetRegistry binding are checked before the block hash is re-read, so a mixed/reorged view is
 * never returned.
 */
export async function readRhjRegisteredStockSnapshot(
  client: PublicClient,
  runtime: Extract<RuntimeDeployment, { mode: 'live' }>,
): Promise<RhjRegisteredStockSnapshot> {
  const chainId = await client.getChainId();
  if (chainId !== 4663) throw new RhjReconciliationError('The configured RHJ RPC is not chain 4663');
  const pinnedBlock = await client.getBlock({ blockTag: 'latest' });
  if (pinnedBlock.hash === null) throw new RhjReconciliationError('The RHJ registry block did not have a hash');

  const lensRegistry = await client.readContract({
    abi: gumBallLensAbi,
    address: runtime.addresses.gumBallLens,
    blockNumber: pinnedBlock.number,
    functionName: 'ASSET_REGISTRY',
  });
  if (getAddress(lensRegistry).toLowerCase() !== runtime.addresses.assetRegistry.toLowerCase()) {
    throw new RhjReconciliationError('GumBallLens does not reference the signed AssetRegistry');
  }

  const overview = await readLiveProtocolOverviewAtBlock(client, runtime, {
    hash: pinnedBlock.hash,
    number: pinnedBlock.number,
  });
  const registeredStocks = overview.assets.filter(({ isStockToken }) => isStockToken);
  if (registeredStocks.length > MAX_REGISTERED_ASSETS) {
    throw new RhjReconciliationError('The RHJ stock-token set exceeds the protocol asset bound');
  }

  const assets = await Promise.all(
    registeredStocks.map(async (asset): Promise<RhjRegisteredStockAsset> => {
      const [rawUid, rawMultiplier, rawSymbol, rawDecimals] = await Promise.all([
        client.readContract({
          abi: STOCK_TOKEN_ABI,
          address: asset.token,
          blockNumber: pinnedBlock.number,
          functionName: 'uid',
        }),
        client.readContract({
          abi: STOCK_TOKEN_ABI,
          address: asset.token,
          blockNumber: pinnedBlock.number,
          functionName: 'uiMultiplier',
        }),
        client.readContract({
          abi: STOCK_TOKEN_ABI,
          address: asset.token,
          blockNumber: pinnedBlock.number,
          functionName: 'symbol',
        }),
        client.readContract({
          abi: STOCK_TOKEN_ABI,
          address: asset.token,
          blockNumber: pinnedBlock.number,
          functionName: 'decimals',
        }),
      ]);
      const uid = asUid(rawUid, `${asset.token} uid`);
      const symbol = asDisplaySymbol(rawSymbol, `${asset.token} symbol`);
      const tokenDecimals = asTokenDecimals(rawDecimals, `${asset.token} decimals`);
      if (typeof rawMultiplier !== 'bigint' || rawMultiplier < 0n) {
        throw new RhjReconciliationError(`${asset.token} uiMultiplier is not uint256`);
      }
      if (uid.toLowerCase() !== asset.assetId.toLowerCase()) {
        throw new RhjReconciliationError(`${asset.token} UID does not match its AssetRegistry assetId`);
      }
      if (symbol !== asset.symbol || keccak256(stringToHex(symbol)).toLowerCase() !== asset.symbolHash.toLowerCase()) {
        throw new RhjReconciliationError(`${asset.token} symbol does not match its AssetRegistry symbolHash`);
      }
      if (tokenDecimals !== asset.decimals) {
        throw new RhjReconciliationError(`${asset.token} decimals do not match AssetRegistry`);
      }
      const genesisSymbol =
        asset.genesisSymbol !== null && isRhjStockSymbol(asset.genesisSymbol) ? asset.genesisSymbol : null;
      return {
        address: asset.token,
        assetId: asset.assetId,
        decimals: asset.decimals,
        genesisSymbol,
        registryIndex: asset.registryIndex,
        symbol,
        symbolHash: asset.symbolHash,
        uid,
        uiMultiplier: rawMultiplier,
      };
    }),
  );

  const seenAddresses = new Set<string>();
  const seenUids = new Set<string>();
  for (const asset of assets) {
    const normalizedAddress = asset.address.toLowerCase();
    const normalizedUid = asset.uid.toLowerCase();
    if (seenAddresses.has(normalizedAddress)) {
      throw new RhjReconciliationError('AssetRegistry returned a duplicate stock-token address');
    }
    if (seenUids.has(normalizedUid)) {
      throw new RhjReconciliationError('AssetRegistry returned a duplicate stock-token UID');
    }
    seenAddresses.add(normalizedAddress);
    seenUids.add(normalizedUid);
  }

  const confirmedBlock = await client.getBlock({ blockNumber: pinnedBlock.number });
  if (confirmedBlock.hash === null || confirmedBlock.hash.toLowerCase() !== pinnedBlock.hash.toLowerCase()) {
    throw new RhjReconciliationError('Chain state changed during RHJ registry reads');
  }
  return { assets, blockHash: pinnedBlock.hash, blockNumber: pinnedBlock.number };
}

async function defaultRegistryReader(
  input: Readonly<{
    runtime: Extract<RuntimeDeployment, { mode: 'live' }>;
    rpcUrls: readonly string[];
  }>,
): Promise<RhjRegisteredStockSnapshot> {
  const rpcUrls = [...new Set(input.rpcUrls)];
  if (rpcUrls.length === 0 || rpcUrls.length > 5) {
    throw new RhjConfigurationError('Between one and five manifest-validated RHJ RPC endpoints are required');
  }
  let lastFailure: unknown;
  for (const rpcUrl of rpcUrls) {
    const client = createPublicClient({
      transport: http(rpcUrl, { retryCount: 1, timeout: DEFAULT_TIMEOUT_MILLISECONDS }),
    });
    try {
      return await readRhjRegisteredStockSnapshot(client, input.runtime);
    } catch (error) {
      if (error instanceof RhjReconciliationError) throw error;
      lastFailure = error;
    }
  }
  void lastFailure;
  throw new RhjConfigurationError('Every manifest-validated RHJ RPC endpoint is unavailable');
}

function deploymentAddress(deployments: readonly RegistryDeployment[], chainId: number, label: string): Address | null {
  const matches = deployments.filter((deployment) => deployment.chainId === chainId);
  if (matches.length > 1) throw new RhjReconciliationError(`${label} has duplicate chain deployments`);
  return matches[0]?.contractAddress ?? null;
}

function assertAddressMatch(actual: Address | null, expected: Address, label: string): void {
  if (actual === null || actual.toLowerCase() !== expected.toLowerCase()) {
    throw new RhjReconciliationError(`${label} does not match the registered token address`);
  }
}

function normalizeRegisteredStockSnapshot(value: RhjRegisteredStockSnapshot): RhjRegisteredStockSnapshot {
  const snapshot = asRecord(value, 'RHJ registered-stock snapshot');
  if (typeof snapshot.blockNumber !== 'bigint' || snapshot.blockNumber < 0n) {
    throw new RhjReconciliationError('RHJ registry block number is invalid');
  }
  const blockHash = asUid(snapshot.blockHash, 'RHJ registry block hash') as Hash;
  if (!Array.isArray(snapshot.assets) || snapshot.assets.length > MAX_REGISTERED_ASSETS) {
    throw new RhjReconciliationError('RHJ registered-stock snapshot exceeds the protocol asset bound');
  }
  const seenAddresses = new Set<string>();
  const seenUids = new Set<string>();
  const seenIndexes = new Set<number>();
  const assets = snapshot.assets.map((value, index): RhjRegisteredStockAsset => {
    const asset = asRecord(value, `registeredStocks[${index.toString()}]`);
    const address = asAddress(asset.address, `registeredStocks[${index.toString()}].address`);
    const assetId = asUid(asset.assetId, `registeredStocks[${index.toString()}].assetId`);
    const uid = asUid(asset.uid, `registeredStocks[${index.toString()}].uid`);
    const symbol = asDisplaySymbol(asset.symbol, `registeredStocks[${index.toString()}].symbol`);
    const symbolHash = asUid(asset.symbolHash, `registeredStocks[${index.toString()}].symbolHash`);
    if (
      typeof asset.registryIndex !== 'number' ||
      !Number.isSafeInteger(asset.registryIndex) ||
      asset.registryIndex < 0 ||
      asset.registryIndex >= MAX_REGISTERED_ASSETS
    ) {
      throw new RhjReconciliationError('RHJ registered-stock registry index is invalid');
    }
    const registryIndex = asset.registryIndex;
    if (asset.genesisSymbol !== null && !isRhjStockSymbol(String(asset.genesisSymbol))) {
      throw new RhjReconciliationError('RHJ registered-stock genesis symbol is invalid');
    }
    if (typeof asset.uiMultiplier !== 'bigint' || asset.uiMultiplier < 0n) {
      throw new RhjReconciliationError('RHJ registered-stock multiplier is invalid');
    }
    if (assetId.toLowerCase() !== uid.toLowerCase()) {
      throw new RhjReconciliationError('RHJ registered-stock UID differs from its AssetRegistry assetId');
    }
    if (keccak256(stringToHex(symbol)).toLowerCase() !== symbolHash.toLowerCase()) {
      throw new RhjReconciliationError('RHJ registered-stock symbol differs from its AssetRegistry symbolHash');
    }
    const normalizedAddress = address.toLowerCase();
    const normalizedUid = uid.toLowerCase();
    if (seenAddresses.has(normalizedAddress)) {
      throw new RhjReconciliationError('RHJ registered-stock snapshot contains a duplicate address');
    }
    if (seenUids.has(normalizedUid)) {
      throw new RhjReconciliationError('RHJ registered-stock snapshot contains a duplicate UID');
    }
    if (seenIndexes.has(registryIndex)) {
      throw new RhjReconciliationError('RHJ registered-stock snapshot contains a duplicate registry index');
    }
    seenAddresses.add(normalizedAddress);
    seenUids.add(normalizedUid);
    seenIndexes.add(registryIndex);
    return {
      address,
      assetId,
      decimals: asTokenDecimals(asset.decimals, `registeredStocks[${index.toString()}].decimals`),
      genesisSymbol: asset.genesisSymbol as RhjStockSymbol | null,
      registryIndex,
      symbol,
      symbolHash,
      uid,
      uiMultiplier: asset.uiMultiplier,
    };
  });
  return { assets, blockHash, blockNumber: snapshot.blockNumber };
}

function validateSignedGenesisStocks(
  runtime: Extract<RuntimeDeployment, { mode: 'live' }>,
  manifest: DeploymentManifest,
  registeredStocks: readonly RhjRegisteredStockAsset[],
): ReadonlySet<string> {
  if (manifest.release.status !== 'release-approved' || manifest.network.chainId !== runtime.chain.id) {
    throw new RhjConfigurationError('The cryptographically validated manifest is not approved for this runtime chain');
  }
  const manifestLens = manifest.deployedContracts.find(({ name }) => name === 'GumBallLens');
  const manifestRegistry = manifest.deployedContracts.find(({ name }) => name === 'AssetRegistry');
  if (
    manifestLens === undefined ||
    manifestRegistry === undefined ||
    manifestLens.address.toLowerCase() !== runtime.addresses.gumBallLens.toLowerCase() ||
    manifestRegistry.address.toLowerCase() !== runtime.addresses.assetRegistry.toLowerCase()
  ) {
    throw new RhjConfigurationError(
      'Runtime Lens or AssetRegistry does not match the cryptographically validated manifest',
    );
  }
  const signedAddresses = new Set<string>();
  for (const symbol of STOCK_SYMBOLS) {
    const asset = manifest.assets.find(({ key }) => key === symbol);
    if (asset === undefined || asset.uid === null) {
      throw new RhjConfigurationError(`The signed manifest is missing stock token ${symbol}`);
    }
    const runtimeAddress = runtime.assets[symbol];
    const runtimeMetadata = runtime.assetMetadata[symbol];
    if (runtimeAddress.toLowerCase() !== asset.address.toLowerCase()) {
      throw new RhjConfigurationError(`Runtime ${symbol} does not match the cryptographically validated manifest`);
    }
    if (
      runtimeMetadata.uid === null ||
      runtimeMetadata.uid.toLowerCase() !== asset.uid.toLowerCase() ||
      runtimeMetadata.decimals !== asset.decimals
    ) {
      throw new RhjConfigurationError(
        `Runtime ${symbol} metadata does not match the cryptographically validated manifest`,
      );
    }
    const matches = registeredStocks.filter(({ address }) => address.toLowerCase() === runtimeAddress.toLowerCase());
    if (matches.length !== 1) {
      throw new RhjReconciliationError(`${symbol} does not uniquely reconcile with the signed AssetRegistry`);
    }
    const registered = matches[0]!;
    if (
      registered.genesisSymbol !== symbol ||
      registered.symbol !== symbol ||
      registered.uid.toLowerCase() !== asset.uid.toLowerCase() ||
      registered.assetId.toLowerCase() !== asset.uid.toLowerCase() ||
      registered.decimals !== asset.decimals
    ) {
      throw new RhjReconciliationError(`${symbol} AssetRegistry identity conflicts with the signed manifest`);
    }
    signedAddresses.add(registered.address.toLowerCase());
  }
  const unexpectedGenesis = registeredStocks.find(
    ({ address, genesisSymbol }) => genesisSymbol !== null && !signedAddresses.has(address.toLowerCase()),
  );
  if (unexpectedGenesis !== undefined) {
    throw new RhjReconciliationError('An appended stock token claimed a signed-genesis identity');
  }
  return signedAddresses;
}

async function validatedManifest(
  rawManifest: string | undefined,
  validator: (
    value: unknown,
    trustedSignaturePolicy?: ReleaseManifestSignaturePolicyConfiguration,
  ) => Promise<DeploymentManifest>,
): Promise<DeploymentManifest> {
  if (rawManifest === undefined || rawManifest.trim() === '') {
    throw new RhjConfigurationError('The signed deployment manifest is unavailable');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawManifest) as unknown;
  } catch {
    throw new RhjConfigurationError('The signed deployment manifest is invalid JSON');
  }
  try {
    return await validator(parsed, releaseManifestSignaturePolicyConfiguration);
  } catch {
    throw new RhjConfigurationError('The deployment manifest failed cryptographic validation');
  }
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function formatFixed18(value: bigint): string {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0');
  return `${whole.toString()}.${fraction}`;
}

function sourceStatus<T>(result: PromiseSettledResult<CachedResult<T>>): RhjSourceStatus {
  return result.status === 'fulfilled' ? result.value.status : 'unavailable';
}

/**
 * Builds public, read-only stock-token metadata from fixed official endpoints.
 * No caller, wallet, cookie, or query data is accepted or retained.
 */
export async function getRhjMetadataSnapshot(
  runtime: RuntimeDeployment,
  rawManifest: string | undefined,
  dependencies: RhjDependencies = {},
): Promise<RhjMetadataSnapshot> {
  if (runtime.mode !== 'live') {
    throw new RhjConfigurationError('RHJ metadata is disabled until a live deployment passes runtime validation');
  }
  if (runtime.chain.id !== 4663) {
    throw new RhjConfigurationError('Official RHJ stock-token metadata is available only for Robinhood Chain 4663');
  }

  const fetchImplementation = dependencies.fetchImplementation ?? fetch;
  const manifestValidator = dependencies.manifestValidator ?? validateDeploymentManifest;
  const now = dependencies.now ?? Date.now;
  const registryReader = dependencies.registryReader ?? defaultRegistryReader;
  const timeoutMilliseconds = Math.max(
    250,
    Math.min(dependencies.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS, 10_000),
  );
  const fetchDependencies = { fetchImplementation, now, timeoutMilliseconds };
  const manifest = await validatedManifest(rawManifest, manifestValidator);
  const registeredSnapshot = normalizeRegisteredStockSnapshot(
    await registryReader({
      rpcUrls: [runtime.chain.rpcUrl, ...runtime.chain.fallbackRpcUrls],
      runtime,
    }),
  );
  const selectedAssets = registeredSnapshot.assets;
  const signedAddresses = validateSignedGenesisStocks(runtime, manifest, selectedAssets);
  const symbolCounts = new Map<string, number>();
  for (const { symbol } of selectedAssets) symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + 1);

  const assetsRequest = cachedFetch('assets', RHJ_ASSETS_URL, null, parseRegistryAssets, fetchDependencies);
  const actionsRequest = cachedFetch(
    'corporate-actions',
    RHJ_CORPORATE_ACTIONS_URL,
    CORPORATE_ACTION_CACHE_MILLISECONDS,
    parseCorporateActions,
    fetchDependencies,
  );
  const priceRequests = selectedAssets.map(({ address, symbol, uid }) =>
    symbolCounts.get(symbol) === 1
      ? cachedFetch(
          `price:${uid.toLowerCase()}:${address.toLowerCase()}`,
          priceUrl(symbol),
          PRICE_CACHE_MILLISECONDS,
          parseQuote,
          fetchDependencies,
        )
      : null,
  );

  const [assetsResult, actionsResult, priceResults] = await Promise.all([
    Promise.resolve(assetsRequest).then(
      (value): PromiseSettledResult<CachedResult<readonly RegistryAsset[]>> => ({ status: 'fulfilled', value }),
      (reason): PromiseSettledResult<CachedResult<readonly RegistryAsset[]>> => ({ status: 'rejected', reason }),
    ),
    Promise.resolve(actionsRequest).then(
      (value): PromiseSettledResult<CachedResult<readonly RegistryCorporateAction[]>> => ({
        status: 'fulfilled',
        value,
      }),
      (reason): PromiseSettledResult<CachedResult<readonly RegistryCorporateAction[]>> => ({
        status: 'rejected',
        reason,
      }),
    ),
    Promise.all(
      priceRequests.map(async (request): Promise<PromiseSettledResult<CachedResult<RegistryQuote>> | null> => {
        if (request === null) return null;
        try {
          return { status: 'fulfilled', value: await request };
        } catch (reason) {
          return { status: 'rejected', reason };
        }
      }),
    ),
  ]);

  const registryAssets = settledValue(assetsResult)?.value ?? null;
  const registryActions = settledValue(actionsResult)?.value ?? null;
  const priceStatuses: { address: Address; status: RhjSourceStatus; uid: Hex }[] = [];

  const assets = selectedAssets.map((selected, index): RhjAssetMetadata => {
    const warnings: string[] = [];
    let registryAsset: RegistryAsset | null = null;
    if (registryAssets !== null) {
      const registryMatches = registryAssets.filter((candidate) => {
        const candidateAddress = deploymentAddress(
          candidate.deployments,
          runtime.chain.id,
          `${candidate.tokenSymbol} registry record`,
        );
        return (
          candidate.id.toLowerCase() === selected.uid.toLowerCase() ||
          candidateAddress?.toLowerCase() === selected.address.toLowerCase()
        );
      });
      if (registryMatches.length !== 1) {
        throw new RhjReconciliationError(
          `${selected.symbol} does not uniquely reconcile by UID and address with the RHJ asset registry`,
        );
      }
      registryAsset = registryMatches[0]!;
      if (
        registryAsset.tokenSymbol !== selected.symbol ||
        registryAsset.id.toLowerCase() !== selected.uid.toLowerCase()
      ) {
        throw new RhjReconciliationError(`${selected.symbol} RHJ registry symbol or UID conflicts with AssetRegistry`);
      }
      assertAddressMatch(
        deploymentAddress(registryAsset.deployments, runtime.chain.id, `${selected.symbol} registry record`),
        selected.address,
        `${selected.symbol} registry record`,
      );
    } else {
      warnings.push('RHJ asset registry is unavailable; AssetRegistry identity and onchain multiplier are shown.');
    }

    const priceResult = priceResults[index]!;
    const priceStatus = priceResult === null ? 'unavailable' : sourceStatus(priceResult);
    priceStatuses.push({ address: selected.address, status: priceStatus, uid: selected.uid });
    const quote: RegistryQuote | null = priceResult === null ? null : (settledValue(priceResult)?.value ?? null);
    if (quote !== null) {
      if (quote.tokenSymbol !== selected.symbol) {
        throw new RhjReconciliationError(`${selected.symbol} quote symbol conflicts with AssetRegistry`);
      }
      assertAddressMatch(
        deploymentAddress(quote.deployments, runtime.chain.id, `${selected.symbol} quote`),
        selected.address,
        `${selected.symbol} quote`,
      );
    } else {
      warnings.push(
        priceResult === null
          ? 'RHJ price and trading-halt data are unavailable because this symbol is not unique.'
          : 'RHJ price and trading-halt data are temporarily unavailable.',
      );
    }

    const matchingActions =
      registryActions?.filter((action) => {
        const actionAddress = deploymentAddress(
          action.deployments,
          runtime.chain.id,
          `${action.tokenSymbol} corporate action`,
        );
        return (
          action.id.toLowerCase() === selected.uid.toLowerCase() ||
          actionAddress?.toLowerCase() === selected.address.toLowerCase()
        );
      }) ?? [];
    for (const action of matchingActions) {
      if (action.tokenSymbol !== selected.symbol || action.id.toLowerCase() !== selected.uid.toLowerCase()) {
        throw new RhjReconciliationError(`${selected.symbol} corporate-action identity conflicts with AssetRegistry`);
      }
      assertAddressMatch(
        deploymentAddress(action.deployments, runtime.chain.id, `${selected.symbol} corporate action`),
        selected.address,
        `${selected.symbol} corporate action`,
      );
    }
    if (registryActions === null) warnings.push('RHJ corporate-action history is temporarily unavailable.');

    const onchainMultiplier = formatFixed18(selected.uiMultiplier);
    if (registryAsset !== null && onchainMultiplier !== registryAsset.currentMultiplier) {
      warnings.push('The onchain multiplier differs from the cached RHJ registry value; the onchain value is shown.');
    }
    if (registryAsset?.status !== undefined && registryAsset.status !== 'ASSET_STATUS_ACTIVE') {
      warnings.push(`RHJ registry status is ${registryAsset.status}.`);
    }
    if (quote?.isTradingHalt === true) warnings.push('Robinhood reports an active trading halt.');
    if (registryAsset?.pendingMultiplier !== '') warnings.push('Robinhood reports a pending multiplier change.');

    const publicQuote: RhjQuote | null =
      quote === null
        ? null
        : {
            ask: quote.ask,
            bid: quote.bid,
            currency: quote.currency,
            dailyTradingVolume: quote.dailyTradingVolume,
            generatedAt: quote.generatedAt,
            isTradingHalt: quote.isTradingHalt,
          };
    return {
      address: selected.address,
      assetId: selected.assetId,
      corporateActions: matchingActions.map(({ details, processDate, status, type }) => ({
        details,
        processDate,
        status,
        type,
      })),
      currentMultiplier: onchainMultiplier,
      currentMultiplierSource: 'onchain',
      decimals: selected.decimals,
      genesisSymbol: selected.genesisSymbol,
      identitySource: signedAddresses.has(selected.address.toLowerCase()) ? 'signed-genesis' : 'registered-post-launch',
      isTradingHalt: publicQuote?.isTradingHalt ?? null,
      pendingMultiplier: registryAsset?.pendingMultiplier === '' ? null : (registryAsset?.pendingMultiplier ?? null),
      pendingMultiplierEffectiveTime: registryAsset?.pendingMultiplierEffectiveTime ?? null,
      quote: publicQuote,
      registryIndex: selected.registryIndex,
      registryStatus: registryAsset?.status ?? 'UNKNOWN',
      symbol: selected.symbol,
      symbolHash: selected.symbolHash,
      tokenName: registryAsset?.tokenName ?? `${selected.symbol} · Robinhood Token`,
      tradingCapabilities: registryAsset?.tradingCapabilities ?? null,
      uid: selected.uid,
      verification: {
        assetRegistry: 'matched',
        manifestAddress: signedAddresses.has(selected.address.toLowerCase()) ? 'matched' : 'not-applicable',
        manifestUid: signedAddresses.has(selected.address.toLowerCase()) ? 'matched' : 'not-applicable',
        onchainUid: 'matched',
        registry: registryAsset === null ? 'unavailable' : 'matched',
        tokenMetadata: 'matched',
      },
      warnings,
    };
  });

  return {
    assets,
    chainId: runtime.chain.id,
    generatedAt: new Date(now()).toISOString(),
    pricesAreMultiplierAdjusted: false,
    readOnly: true,
    registryBlockHash: registeredSnapshot.blockHash,
    registryBlockNumber: registeredSnapshot.blockNumber.toString(),
    sources: {
      assets: sourceStatus(assetsResult),
      corporateActions: sourceStatus(actionsResult),
      prices: priceStatuses,
    },
    transactionAuthoritative: false,
  };
}

export function resetRhjCacheForTests(): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('RHJ cache reset is test-only');
  upstreamCache.clear();
  pendingFetches.clear();
}

export function isRhjStockSymbol(value: string): value is RhjStockSymbol {
  return STOCK_SYMBOL_SET.has(value);
}
