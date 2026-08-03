import { getAddress, isAddress, isHex, keccak256, size, stringToHex, type Address, type Hex } from 'viem';

const RHJ_GENESIS_SYMBOLS = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'] as const;
const MAX_RHJ_ASSETS = 16;
const MAX_CORPORATE_ACTIONS = 5_000;
const MAX_WARNINGS = 8;
export type PublicRhjGenesisSymbol = (typeof RHJ_GENESIS_SYMBOLS)[number];

const FIXED_18_PATTERN = /^\d+\.\d{18}$/u;
const MAX_UINT256 = (1n << 256n) - 1n;

export const UI_MULTIPLIER_SCALE = 10n ** 18n;

/** Parses the public fixed-18 multiplier without crossing through floating-point arithmetic. */
export function parseUiMultiplierWad(value: string): bigint {
  if (!FIXED_18_PATTERN.test(value)) throw new Error('UI multiplier must have exactly 18 decimal places');
  const [whole = '0', fraction = ''] = value.split('.');
  const multiplierWad = BigInt(whole) * UI_MULTIPLIER_SCALE + BigInt(fraction);
  if (multiplierWad > MAX_UINT256) throw new Error('UI multiplier exceeds uint256');
  return multiplierWad;
}

export interface PublicRhjCorporateAction {
  readonly processDate: Readonly<{ day: number; month: number; year: number }> | null;
  readonly status: string;
  readonly type: string;
}

export interface PublicRhjAsset {
  readonly address: Address;
  readonly assetId: Hex;
  readonly corporateActions: readonly PublicRhjCorporateAction[];
  readonly currentMultiplier: string | null;
  readonly currentMultiplierSource: 'onchain' | 'registry' | 'unavailable';
  readonly decimals: number;
  readonly genesisSymbol: PublicRhjGenesisSymbol | null;
  readonly identitySource: 'signed-genesis' | 'registered-post-launch';
  readonly isTradingHalt: boolean | null;
  readonly pendingMultiplier: string | null;
  readonly pendingMultiplierEffectiveTime: string | null;
  readonly registryIndex: number;
  readonly registryStatus: 'ASSET_STATUS_ACTIVE' | 'ASSET_STATUS_INACTIVE' | 'ASSET_STATUS_UNSPECIFIED' | 'UNKNOWN';
  readonly symbol: string;
  readonly symbolHash: Hex;
  readonly tokenName: string;
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

export interface PublicRhjSnapshot {
  readonly assets: readonly PublicRhjAsset[];
  readonly chainId: 4663;
  readonly generatedAt: string;
  readonly pricesAreMultiplierAdjusted: false;
  readonly readOnly: true;
  readonly registryBlockHash: Hex;
  readonly registryBlockNumber: string;
  readonly sources: Readonly<{
    assets: 'fresh' | 'cached' | 'unavailable';
    corporateActions: 'fresh' | 'cached' | 'unavailable';
    prices: readonly Readonly<{
      address: Address;
      status: 'fresh' | 'cached' | 'unavailable';
      uid: Hex;
    }>[];
  }>;
  readonly transactionAuthoritative: false;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  return value;
}

function boundedString(value: unknown, label: string, maximumLength: number): string {
  const parsed = string(value, label);
  if (parsed.length === 0 || parsed.length > maximumLength) throw new Error(`${label} must be a bounded string`);
  return parsed;
}

function bytes32(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHex(value, { strict: true }) || size(value) !== 32 || /^0x0{64}$/u.test(value)) {
    throw new Error(`${label} must be nonzero bytes32`);
  }
  return value;
}

function displaySymbol(value: unknown, label: string): string {
  const parsed = boundedString(value, label, 32);
  for (const character of parsed) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x21 || codePoint > 0x7e) throw new Error(`${label} contains unsupported display characters`);
  }
  return parsed;
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function nullableIsoDate(value: unknown, label: string): string | null {
  if (value === null) return null;
  const parsed = boundedString(value, label, 64);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`${label} must be an ISO-8601 timestamp`);
  return parsed;
}

function nullableUiMultiplier(value: unknown, label: string): string | null {
  const multiplier = nullableString(value, label);
  if (multiplier !== null) {
    if (multiplier.length > 128) throw new Error(`${label} must be bounded`);
    parseUiMultiplierWad(multiplier);
  }
  return multiplier;
}

function oneOf<Value extends string>(value: unknown, allowed: readonly Value[], label: string): Value {
  if (typeof value !== 'string' || !allowed.includes(value as Value)) throw new Error(`${label} is unsupported`);
  return value as Value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(`${label} is invalid`);
  return value;
}

function boundedUnsignedInteger(value: unknown, label: string, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function parseCorporateAction(value: unknown, index: number): PublicRhjCorporateAction {
  const row = record(value, `corporateActions[${index.toString()}]`);
  const processDate =
    row.processDate === null
      ? null
      : (() => {
          const date = record(row.processDate, `corporateActions[${index.toString()}].processDate`);
          const day = positiveInteger(date.day, 'corporate action day');
          const month = positiveInteger(date.month, 'corporate action month');
          const year = positiveInteger(date.year, 'corporate action year');
          if (day > 31 || month > 12 || year < 1900) throw new Error('corporate action date is out of bounds');
          return { day, month, year };
        })();
  return {
    processDate,
    status: boundedString(row.status, 'corporate action status', 64),
    type: boundedString(row.type, 'corporate action type', 96),
  };
}

function parseAsset(value: unknown, index: number): PublicRhjAsset {
  const row = record(value, `assets[${index.toString()}]`);
  if (typeof row.address !== 'string' || !isAddress(row.address, { strict: false }))
    throw new Error('RHJ address is invalid');
  const uid = bytes32(row.uid, 'RHJ UID');
  const assetId = bytes32(row.assetId, 'RHJ assetId');
  const symbolHash = bytes32(row.symbolHash, 'RHJ symbolHash');
  if (
    !Array.isArray(row.corporateActions) ||
    row.corporateActions.length > MAX_CORPORATE_ACTIONS ||
    !Array.isArray(row.warnings) ||
    row.warnings.length > MAX_WARNINGS
  ) {
    throw new Error('RHJ lists are invalid or exceed their bounds');
  }
  const verification = record(row.verification, 'RHJ verification');
  if (row.isTradingHalt !== null && typeof row.isTradingHalt !== 'boolean') throw new Error('RHJ halt is invalid');
  const symbol = displaySymbol(row.symbol, 'RHJ symbol');
  const currentMultiplier = nullableUiMultiplier(row.currentMultiplier, 'current multiplier');
  const currentMultiplierSource = oneOf(
    row.currentMultiplierSource,
    ['onchain', 'registry', 'unavailable'],
    'multiplier source',
  );
  const onchainUid = oneOf(verification.onchainUid, ['matched'], 'onchain UID verification');
  const registry = oneOf(verification.registry, ['matched', 'unavailable'], 'registry verification');
  const identitySource = oneOf(row.identitySource, ['signed-genesis', 'registered-post-launch'], 'RHJ identity source');
  const genesisSymbol =
    row.genesisSymbol === null ? null : oneOf(row.genesisSymbol, RHJ_GENESIS_SYMBOLS, 'RHJ signed-genesis symbol');
  const pendingMultiplier = nullableUiMultiplier(row.pendingMultiplier, 'pending multiplier');
  if ((currentMultiplier === null) !== (currentMultiplierSource === 'unavailable')) {
    throw new Error('RHJ current multiplier and source are inconsistent');
  }
  if (currentMultiplierSource === 'onchain' && onchainUid !== 'matched') {
    throw new Error('RHJ onchain multiplier lacks matched onchain identity');
  }
  if (currentMultiplierSource === 'registry' && registry !== 'matched') {
    throw new Error('RHJ registry multiplier lacks matched registry identity');
  }
  if (pendingMultiplier !== null && registry !== 'matched') {
    throw new Error('RHJ pending multiplier lacks matched registry identity');
  }
  if (assetId.toLowerCase() !== uid.toLowerCase()) throw new Error('RHJ assetId and UID differ');
  if (keccak256(stringToHex(symbol)).toLowerCase() !== symbolHash.toLowerCase()) {
    throw new Error('RHJ symbol does not match its AssetRegistry symbolHash');
  }
  const manifestAddress = oneOf(
    verification.manifestAddress,
    ['matched', 'not-applicable'],
    'manifest address verification',
  );
  const manifestUid = oneOf(verification.manifestUid, ['matched', 'not-applicable'], 'manifest UID verification');
  if (
    identitySource === 'signed-genesis'
      ? genesisSymbol === null || symbol !== genesisSymbol || manifestAddress !== 'matched' || manifestUid !== 'matched'
      : genesisSymbol !== null || manifestAddress !== 'not-applicable' || manifestUid !== 'not-applicable'
  ) {
    throw new Error('RHJ identity source and signed-manifest verification are inconsistent');
  }
  return {
    address: getAddress(row.address),
    assetId,
    corporateActions: row.corporateActions.map(parseCorporateAction),
    currentMultiplier,
    currentMultiplierSource,
    decimals: boundedUnsignedInteger(row.decimals, 'RHJ decimals', 255),
    genesisSymbol,
    identitySource,
    isTradingHalt: row.isTradingHalt,
    pendingMultiplier,
    pendingMultiplierEffectiveTime: nullableIsoDate(row.pendingMultiplierEffectiveTime, 'pending multiplier time'),
    registryIndex: boundedUnsignedInteger(row.registryIndex, 'RHJ registry index', MAX_RHJ_ASSETS - 1),
    registryStatus: oneOf(
      row.registryStatus,
      ['ASSET_STATUS_ACTIVE', 'ASSET_STATUS_INACTIVE', 'ASSET_STATUS_UNSPECIFIED', 'UNKNOWN'],
      'registry status',
    ),
    symbol,
    symbolHash,
    tokenName: boundedString(row.tokenName, 'token name', 256),
    uid,
    verification: {
      assetRegistry: oneOf(verification.assetRegistry, ['matched'], 'AssetRegistry verification'),
      manifestAddress,
      manifestUid,
      onchainUid,
      registry,
      tokenMetadata: oneOf(verification.tokenMetadata, ['matched'], 'token metadata verification'),
    },
    warnings: row.warnings.map((warning, warningIndex) =>
      boundedString(warning, `warnings[${warningIndex.toString()}]`, 512),
    ),
  };
}

export function parsePublicRhjSnapshot(value: unknown): PublicRhjSnapshot {
  const row = record(value, 'RHJ snapshot');
  if (
    !Array.isArray(row.assets) ||
    row.assets.length < RHJ_GENESIS_SYMBOLS.length ||
    row.assets.length > MAX_RHJ_ASSETS
  ) {
    throw new Error('RHJ assets must be a bounded array containing every signed stock');
  }
  const assets = row.assets.map(parseAsset);
  if (
    new Set(assets.map(({ address }) => address.toLowerCase())).size !== assets.length ||
    new Set(assets.map(({ uid }) => uid.toLowerCase())).size !== assets.length ||
    new Set(assets.map(({ registryIndex }) => registryIndex)).size !== assets.length
  ) {
    throw new Error('RHJ snapshot contains a duplicate address, UID, or registry index');
  }
  const signedGenesis = assets.filter(({ identitySource }) => identitySource === 'signed-genesis');
  if (
    signedGenesis.length !== RHJ_GENESIS_SYMBOLS.length ||
    RHJ_GENESIS_SYMBOLS.some(
      (symbol) => signedGenesis.filter(({ genesisSymbol }) => genesisSymbol === symbol).length !== 1,
    )
  ) {
    throw new Error('RHJ snapshot must contain every signed stock identity exactly once');
  }
  const sources = record(row.sources, 'RHJ sources');
  const generatedAt = boundedString(row.generatedAt, 'RHJ generatedAt', 64);
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('RHJ generatedAt is invalid');
  const registryBlockHash = bytes32(row.registryBlockHash, 'RHJ registry block hash');
  const registryBlockNumber = boundedString(row.registryBlockNumber, 'RHJ registry block number', 32);
  if (!/^(?:0|[1-9]\d*)$/u.test(registryBlockNumber)) throw new Error('RHJ registry block number is invalid');
  if (!Array.isArray(sources.prices) || sources.prices.length !== assets.length) {
    throw new Error('RHJ price sources must contain every registered stock identity');
  }
  const priceSources = sources.prices.map((value, index) => {
    const source = record(value, `RHJ price source ${index.toString()}`);
    if (typeof source.address !== 'string' || !isAddress(source.address, { strict: false })) {
      throw new Error('RHJ price source address is invalid');
    }
    return {
      address: getAddress(source.address),
      status: oneOf(source.status, ['fresh', 'cached', 'unavailable'], 'price source'),
      uid: bytes32(source.uid, 'RHJ price source UID'),
    };
  });
  if (
    new Set(priceSources.map(({ address }) => address.toLowerCase())).size !== priceSources.length ||
    priceSources.some(({ address, uid }) => {
      const asset = assets.find((candidate) => candidate.address.toLowerCase() === address.toLowerCase());
      return asset === undefined || asset.uid.toLowerCase() !== uid.toLowerCase();
    })
  ) {
    throw new Error('RHJ price sources do not uniquely match registered stock identities');
  }
  if (
    row.chainId !== 4663 ||
    row.pricesAreMultiplierAdjusted !== false ||
    row.readOnly !== true ||
    row.transactionAuthoritative !== false
  ) {
    throw new Error('RHJ trust-boundary fields are invalid');
  }
  return {
    assets,
    chainId: 4663,
    generatedAt,
    pricesAreMultiplierAdjusted: false,
    readOnly: true,
    registryBlockHash,
    registryBlockNumber,
    sources: {
      assets: oneOf(sources.assets, ['fresh', 'cached', 'unavailable'], 'assets source'),
      corporateActions: oneOf(sources.corporateActions, ['fresh', 'cached', 'unavailable'], 'corporate-actions source'),
      prices: priceSources,
    },
    transactionAuthoritative: false,
  };
}

export async function fetchPublicRhjSnapshot(signal?: AbortSignal): Promise<PublicRhjSnapshot> {
  const response = await fetch('/rhj', {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`RHJ metadata request failed with HTTP ${response.status.toString()}`);
  return parsePublicRhjSnapshot(await response.json());
}
