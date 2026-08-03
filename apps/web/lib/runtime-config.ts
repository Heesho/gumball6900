import {
  getRobinhoodChain,
  releaseManifestSignaturePolicyConfiguration,
  robinhoodMainnetAssetManifest,
  robinhoodTestnetAssetManifest,
  robinhoodTestnetUniswapV4Manifest,
  validateDeploymentManifest,
  type DeploymentManifest,
  type ReleaseManifestSignaturePolicyConfiguration,
  type RobinhoodChainId,
} from '@gumball-6900/config';
import { addressSchema, protocolAddressesSchema, type ProtocolAddresses } from '@gumball-6900/sdk';
import type { Address } from 'viem';

import {
  assetSymbols,
  requiredExternalContractKeys,
  rewardSymbols,
  strategySymbols,
  type AssetSymbol,
  type ClientChainConfig,
  type RewardSymbol,
  type RuntimeDeployment,
  type RuntimeAdminBoundary,
  type RuntimeAssetMetadata,
  type RuntimeExternalContracts,
  type StrategySymbol,
} from './runtime-types';

const LOOPBACK_IPV4_PATTERN = /^127(?:\.\d{1,3}){3}$/u;

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/u, '')
    .replace(/^\[|\]$/gu, '');
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    LOOPBACK_IPV4_PATTERN.test(normalized)
  );
}

export interface RuntimeEnvironment {
  NODE_ENV?: string | undefined;
  GUMBALL_CLIENT_MODE?: string | undefined;
  GUMBALL_CHAIN_ID?: string | undefined;
  GUMBALL_RPC_URL?: string | undefined;
  GUMBALL_RPC_FALLBACK_URLS_JSON?: string | undefined;
  GUMBALL_PROTOCOL_ADDRESSES_JSON?: string | undefined;
  GUMBALL_STRATEGIES_JSON?: string | undefined;
  GUMBALL_REWARDS_JSON?: string | undefined;
  GUMBALL_DEPLOYMENT_MANIFEST_JSON?: string | undefined;
  GUMBALL_SUBGRAPH_URL?: string | undefined;
}

const manifestAssetKeys: Readonly<Record<Exclude<AssetSymbol, 'GBX'>, DeploymentManifest['assets'][number]['key']>> = {
  USDG: 'USDG',
  WETH: 'WETH',
  WBTC: 'WRAPPED_BTC',
  QQQ: 'QQQ',
  TSLA: 'TSLA',
  SPCX: 'SPCX',
  NVDA: 'NVDA',
  AAPL: 'AAPL',
};

function parseChainId(value: string | undefined, issues: string[]): RobinhoodChainId {
  if (value === undefined || value.trim() === '') return 4663;
  if (value === '4663' || value === '46630') return Number(value) as RobinhoodChainId;
  issues.push('GUMBALL_CHAIN_ID must be 4663 or 46630.');
  return 4663;
}

function clientChain(
  chainId: RobinhoodChainId,
  rpcUrl?: string,
  configuredFallbackRpcUrls: readonly string[] = [],
): ClientChainConfig {
  const configured = getRobinhoodChain(chainId);
  const primaryRpcUrl = rpcUrl ?? configured.publicRpcUrls[0];
  const fallbackRpcUrls = [...configuredFallbackRpcUrls];
  return {
    id: configured.id,
    environment: configured.environment,
    name: configured.name,
    rpcUrl: primaryRpcUrl,
    fallbackRpcUrls,
    explorerUrl: configured.explorer.url,
    nativeCurrency: configured.nativeCurrency,
  };
}

function validateFallbackRpcUrls(
  value: string | undefined,
  primaryRpcUrl: string | null,
  allowLocalRehearsal: boolean,
  remoteTestnet: boolean,
  issues: string[],
): readonly string[] {
  if (value === undefined || value.trim() === '') {
    if (!allowLocalRehearsal)
      issues.push(
        remoteTestnet
          ? 'GUMBALL_RPC_FALLBACK_URLS_JSON requires at least one fallback in remote testnet mode.'
          : 'GUMBALL_RPC_FALLBACK_URLS_JSON requires at least one fallback in live mode.',
      );
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    issues.push('GUMBALL_RPC_FALLBACK_URLS_JSON must contain a JSON array of HTTP(S) URLs.');
    return [];
  }
  if (allowLocalRehearsal && Array.isArray(parsed) && parsed.length === 0) return [];
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((entry) => typeof entry !== 'string')) {
    issues.push('GUMBALL_RPC_FALLBACK_URLS_JSON must contain a nonempty JSON array of HTTP(S) URLs.');
    return [];
  }
  if (parsed.length > 4) {
    issues.push('GUMBALL_RPC_FALLBACK_URLS_JSON supports at most four fallback endpoints.');
    return [];
  }

  const validated: string[] = [];
  for (const candidate of parsed as string[]) {
    try {
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
      const local = isLoopbackHostname(url.hostname);
      if (allowLocalRehearsal ? !local : local || url.protocol !== 'https:') throw new Error('invalid boundary');
      validated.push(url.toString());
    } catch {
      issues.push(
        allowLocalRehearsal
          ? 'Rehearsal fallback RPC endpoints must be localhost HTTP(S) URLs.'
          : 'Live fallback RPC endpoints must be remote HTTPS URLs.',
      );
    }
  }

  const normalized = [primaryRpcUrl, ...validated]
    .filter((candidate): candidate is string => candidate !== null)
    .map((candidate) => new URL(candidate).toString());
  if (new Set(normalized).size !== normalized.length) {
    issues.push('Primary and fallback RPC endpoints must be unique.');
    return [];
  }
  return validated;
}

function parseJsonObject(label: string, value: string | undefined, issues: string[]): Record<string, unknown> | null {
  if (value === undefined || value.trim() === '') {
    issues.push(`${label} is required in contract-enabled mode.`);
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      issues.push(`${label} must contain a JSON object.`);
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    issues.push(`${label} is not valid JSON.`);
    return null;
  }
}

function parseAddressMap<Key extends string>(
  label: string,
  value: string | undefined,
  requiredKeys: readonly Key[],
  issues: string[],
): Readonly<Record<Key, Address>> | null {
  const object = parseJsonObject(label, value, issues);
  if (object === null) return null;

  const parsed = {} as Record<Key, Address>;
  for (const key of requiredKeys) {
    const result = addressSchema.safeParse(object[key]);
    if (!result.success) {
      issues.push(`${label}.${key} must be a nonzero EVM address.`);
      continue;
    }
    if (/^0x0{40}$/u.test(result.data.toLowerCase())) {
      issues.push(`${label}.${key} must not be the zero address.`);
      continue;
    }
    parsed[key] = result.data;
  }

  const extraKeys = Object.keys(object).filter((key) => !requiredKeys.includes(key as Key));
  if (extraKeys.length > 0) issues.push(`${label} contains unsupported keys: ${extraKeys.join(', ')}.`);
  if (Object.keys(parsed).length !== requiredKeys.length) return null;
  if (
    new Set((Object.values(parsed) as Address[]).map((address) => address.toLowerCase())).size !== requiredKeys.length
  ) {
    issues.push(`${label} addresses must be unique.`);
    return null;
  }
  return parsed;
}

function parseProtocolAddresses(value: string | undefined, issues: string[]): ProtocolAddresses | null {
  const object = parseJsonObject('GUMBALL_PROTOCOL_ADDRESSES_JSON', value, issues);
  if (object === null) return null;
  const result = protocolAddressesSchema.safeParse(object);
  if (!result.success) {
    issues.push('GUMBALL_PROTOCOL_ADDRESSES_JSON does not match the SDK protocol address schema.');
    return null;
  }
  const values = Object.values(result.data);
  if (values.some((address) => /^0x0{40}$/u.test(address.toLowerCase()))) {
    issues.push('Protocol contract addresses must not contain the zero address.');
    return null;
  }
  if (new Set(values.map((address) => address.toLowerCase())).size !== values.length) {
    issues.push('Protocol contract addresses must be unique.');
    return null;
  }
  return result.data;
}

type ManifestValidator = (
  value: unknown,
  trustedSignaturePolicy?: ReleaseManifestSignaturePolicyConfiguration,
) => Promise<DeploymentManifest>;

async function parseManifest(
  value: string | undefined,
  chainId: RobinhoodChainId,
  requiredStatus: 'release-approved' | 'testnet-candidate',
  issues: string[],
  validator: ManifestValidator,
): Promise<DeploymentManifest | null> {
  if (value === undefined || value.trim() === '') {
    issues.push('GUMBALL_DEPLOYMENT_MANIFEST_JSON is required in contract-enabled mode.');
    return null;
  }
  try {
    const manifest = await validator(JSON.parse(value) as unknown, releaseManifestSignaturePolicyConfiguration);
    if (manifest.release.status !== requiredStatus) {
      issues.push(
        requiredStatus === 'release-approved'
          ? 'The deployment manifest must have release-approved status.'
          : 'Testnet and rehearsal modes require a testnet-candidate manifest.',
      );
    }
    if (manifest.network.chainId !== chainId) {
      issues.push('The deployment manifest chain does not match GUMBALL_CHAIN_ID.');
    }
    return manifest;
  } catch (error) {
    issues.push('GUMBALL_DEPLOYMENT_MANIFEST_JSON failed signed-manifest schema validation.');
    if (error instanceof Error && error.message.trim() !== '') {
      issues.push(`Manifest signature validation: ${error.message}`);
    }
    return null;
  }
}

function validateRpcUrl(
  value: string | undefined,
  chainId: RobinhoodChainId,
  allowLocalRehearsal: boolean,
  remoteTestnet: boolean,
  issues: string[],
): string | null {
  if (value === undefined || value.trim() === '') {
    issues.push('GUMBALL_RPC_URL is required in live mode.');
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
  } catch {
    issues.push('GUMBALL_RPC_URL must be an HTTP(S) URL.');
    return null;
  }
  const local = isLoopbackHostname(url.hostname);
  if (local && !allowLocalRehearsal) {
    issues.push(
      remoteTestnet
        ? 'GUMBALL_RPC_URL must be a remote HTTPS endpoint in testnet mode; localhost is reserved for rehearsal.'
        : 'GUMBALL_RPC_URL must be a remote HTTPS endpoint in live mode; localhost is reserved for rehearsal.',
    );
    return null;
  }
  if (url.protocol !== 'https:' && !(allowLocalRehearsal && local)) {
    issues.push('GUMBALL_RPC_URL must use HTTPS, except in explicit local rehearsal mode.');
    return null;
  }
  const publicRpc = new URL(getRobinhoodChain(chainId).publicRpcUrls[0]);
  const normalizedPath = (candidate: URL) => `${candidate.origin}${candidate.pathname.replace(/\/$/u, '')}`;
  if (normalizedPath(url) === normalizedPath(publicRpc)) {
    issues.push(
      remoteTestnet
        ? 'Remote testnet mode requires a non-public RPC endpoint, not the rate-limited public RPC.'
        : 'Live mode requires a production RPC endpoint, not the rate-limited public RPC.',
    );
    return null;
  }
  return value;
}

function isLocalUrl(value: string): boolean {
  return isLoopbackHostname(new URL(value).hostname);
}

function validateSubgraphUrl(
  value: string | undefined,
  allowLocalRehearsal: boolean,
  remoteTestnet: boolean,
  issues: string[],
): string | null {
  if (value === undefined || value.trim() === '') {
    issues.push('GUMBALL_SUBGRAPH_URL is required in live mode.');
    return null;
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
    const local = isLoopbackHostname(url.hostname);
    if (local && !allowLocalRehearsal) {
      issues.push(
        remoteTestnet
          ? 'GUMBALL_SUBGRAPH_URL must be a remote HTTPS endpoint in testnet mode; localhost is reserved for rehearsal.'
          : 'GUMBALL_SUBGRAPH_URL must be a remote HTTPS endpoint in live mode; localhost is reserved for rehearsal.',
      );
      return null;
    }
    if (url.protocol !== 'https:' && !(allowLocalRehearsal && local)) {
      throw new Error('non-HTTPS remote URL');
    }
    return url.toString();
  } catch {
    issues.push('GUMBALL_SUBGRAPH_URL must use HTTPS, except in explicit local rehearsal mode.');
    return null;
  }
}

interface RuntimeAssets {
  addresses: Readonly<Record<AssetSymbol, Address>>;
  metadata: Readonly<Record<AssetSymbol, RuntimeAssetMetadata>>;
}

function buildAssetMap(
  manifest: DeploymentManifest | null,
  addresses: ProtocolAddresses | null,
  chainId: RobinhoodChainId,
  requireCanonicalBindings: boolean,
  issues: string[],
): RuntimeAssets | null {
  if (manifest === null || addresses === null) return null;
  const assets = { GBX: addresses.gbx } as Record<AssetSymbol, Address>;
  const metadata = {
    GBX: {
      symbol: 'GBX',
      address: addresses.gbx,
      decimals: 18,
      uid: null,
      registryStatus: 'NOT_APPLICABLE',
      acquisitionEnabled: false,
      redemptionEnabled: true,
    },
  } as Record<AssetSymbol, RuntimeAssetMetadata>;
  for (const [symbol, manifestKey] of Object.entries(manifestAssetKeys) as Array<
    [Exclude<AssetSymbol, 'GBX'>, DeploymentManifest['assets'][number]['key']]
  >) {
    const record = manifest.assets.find(({ key }) => key === manifestKey);
    if (record === undefined) {
      issues.push(`The signed manifest is missing asset ${manifestKey}.`);
      continue;
    }
    assets[symbol] = record.address as Address;
    metadata[symbol] = {
      symbol,
      address: record.address as Address,
      decimals: record.decimals,
      uid: record.uid as `0x${string}` | null,
      registryStatus: record.registryStatus,
      acquisitionEnabled: record.acquisitionEnabled,
      redemptionEnabled: record.redemptionEnabled,
    };
  }

  if (requireCanonicalBindings) {
    const canonicalAssetManifest =
      chainId === robinhoodMainnetAssetManifest.chainId ? robinhoodMainnetAssetManifest : robinhoodTestnetAssetManifest;
    for (const canonical of canonicalAssetManifest.canonicalTokens) {
      const symbol = canonical.key as 'USDG' | 'WETH';
      if (assets[symbol]?.toLowerCase() !== canonical.address.toLowerCase()) {
        issues.push(`Signed-manifest ${symbol} does not match the canonical config address.`);
      }
      if (metadata[symbol]?.decimals !== canonical.expectedDecimals) {
        issues.push(`Signed-manifest ${symbol} decimals do not match canonical config.`);
      }
    }
  }
  return assetSymbols.every((symbol) => assets[symbol] !== undefined && metadata[symbol] !== undefined)
    ? { addresses: assets, metadata }
    : null;
}

const externalManifestKeys = {
  poolManager: 'uniswapV4.poolManager',
  positionManager: 'uniswapV4.positionManager',
  quoter: 'uniswapV4.quoter',
  stateView: 'uniswapV4.stateView',
  universalRouter: 'uniswapV4.universalRouter',
  permit2: 'uniswapV4.permit2',
} as const;

const protocolManifestNames = {
  protocolTimelock: 'ProtocolTimelock',
  strategyDeployer: 'StrategyDeployer',
  emergencyGuardian: 'EmergencyGuardian',
  eligibilityModule: 'EligibilityModule',
  gbx: 'GBXToken',
  emissionController: 'EmissionController',
  genesisClaims: 'GenesisClaims',
  miningClaims: 'MiningClaims',
  assetRegistry: 'AssetRegistry',
  allocationVoter: 'AllocationVoter',
  gumBallVault: 'GumBallVault',
  stakedGBX: 'StakedGBX',
  gumBallRouter: 'GumBallRouter',
  miningPool: 'MiningPool',
  genesisBootstrap: 'GenesisBootstrap',
  revenueRouter: 'RevenueRouter',
  holdUSDGStrategy: 'HoldUSDGStrategy',
  buybackBurnStrategy: 'BuybackBurnStrategy',
  launchGuardHook: 'LaunchGuardHook',
  genesisLiquidityCalculator: 'GenesisLiquidityCalculator',
  liquidityManager: 'LiquidityManager',
  gumBallLens: 'GumBallLens',
} as const satisfies Readonly<Record<keyof ProtocolAddresses, string>>;

const strategyManifestNames = {
  USDG: 'HoldUSDGStrategy',
  WETH: 'AcquisitionStrategy:WETH',
  WBTC: 'AcquisitionStrategy:WRAPPED_BTC',
  QQQ: 'AcquisitionStrategy:QQQ',
  TSLA: 'AcquisitionStrategy:TSLA',
  SPCX: 'AcquisitionStrategy:SPCX',
  NVDA: 'AcquisitionStrategy:NVDA',
  AAPL: 'AcquisitionStrategy:AAPL',
  BURN: 'BuybackBurnStrategy',
} as const satisfies Readonly<Record<StrategySymbol, string>>;

const rewardManifestNames = {
  WETH: 'ManagerRewards:WETH',
  WBTC: 'ManagerRewards:WRAPPED_BTC',
  QQQ: 'ManagerRewards:QQQ',
  TSLA: 'ManagerRewards:TSLA',
  SPCX: 'ManagerRewards:SPCX',
  NVDA: 'ManagerRewards:NVDA',
  AAPL: 'ManagerRewards:AAPL',
} as const satisfies Readonly<Record<RewardSymbol, string>>;

function validateNamedDeploymentBindings<Key extends string>(
  manifest: DeploymentManifest | null,
  label: string,
  addresses: Readonly<Record<Key, Address>> | null,
  names: Readonly<Record<Key, string>>,
  issues: string[],
): void {
  if (manifest === null || addresses === null) return;
  for (const key of Object.keys(names) as Key[]) {
    const logicalName = names[key];
    const deployment = manifest.deployedContracts.find(({ name }) => name === logicalName);
    if (deployment === undefined) {
      issues.push(`The signed manifest is missing deployed contract ${logicalName}.`);
    } else if (deployment.address.toLowerCase() !== addresses[key].toLowerCase()) {
      issues.push(`${label}.${key} does not match signed-manifest deployment ${logicalName}.`);
    }
  }
}

function buildExternalContracts(
  manifest: DeploymentManifest | null,
  allowLocalSources: boolean,
  issues: string[],
): RuntimeExternalContracts | null {
  if (manifest === null) return null;
  const output = {} as Record<(typeof requiredExternalContractKeys)[number], RuntimeExternalContracts['quoter']>;
  for (const key of requiredExternalContractKeys) {
    const record = manifest.externalContracts.find(({ key: manifestKey }) => manifestKey === externalManifestKeys[key]);
    if (record === undefined) {
      issues.push(`The signed manifest is missing ${externalManifestKeys[key]}.`);
      continue;
    }
    try {
      const source = new URL(record.sourceUrl);
      if (source.protocol !== 'https:' && !(allowLocalSources && isLocalUrl(record.sourceUrl))) {
        throw new Error('not an allowed source URL');
      }
    } catch {
      issues.push(
        `Signed external contract ${externalManifestKeys[key]} must use an HTTPS source, except in a localhost-only rehearsal.`,
      );
      continue;
    }
    output[key] = {
      address: record.address as Address,
      sourceUrl: record.sourceUrl,
      verifiedAtBlock: record.verifiedAtBlock,
    };
  }
  if (!requiredExternalContractKeys.every((key) => output[key] !== undefined)) return null;
  if (
    new Set(Object.values(output).map(({ address }) => address.toLowerCase())).size !==
    requiredExternalContractKeys.length
  ) {
    issues.push('Signed external contract addresses must be unique.');
    return null;
  }
  return output;
}

function validateTestnetExternalBindings(externalContracts: RuntimeExternalContracts | null, issues: string[]): void {
  if (externalContracts === null) return;
  const canonicalPermit2 = robinhoodTestnetUniswapV4Manifest.addresses.permit2;
  if (canonicalPermit2 === undefined) {
    issues.push('Canonical testnet Permit2 is unresolved in the typed deployment config.');
    return;
  }
  if (externalContracts.permit2.address.toLowerCase() !== canonicalPermit2.toLowerCase()) {
    issues.push('Signed external contract uniswapV4.permit2 does not match canonical testnet config.');
  }
}

function validateRemoteTestnetSignatureState(manifest: DeploymentManifest | null, issues: string[]): void {
  if (manifest === null) return;
  if (manifest.signaturePolicy.threshold <= 0 || manifest.signatures.length < manifest.signaturePolicy.threshold) {
    issues.push(
      'Remote testnet mode requires a signed testnet-candidate manifest with a satisfied positive threshold.',
    );
  }
}

function deployedAddress(
  manifest: DeploymentManifest,
  name: 'EmergencyGuardian' | 'ProtocolTimelock',
  issues: string[],
): Address | null {
  const record = manifest.deployedContracts.find(({ name: candidate }) => candidate === name);
  if (record === undefined) {
    issues.push(`The signed manifest is missing deployed contract ${name}.`);
    return null;
  }
  return record.address as Address;
}

function buildAdminBoundary(manifest: DeploymentManifest | null, issues: string[]): RuntimeAdminBoundary | null {
  if (manifest === null) return null;
  const emergencyGuardian = deployedAddress(manifest, 'EmergencyGuardian', issues);
  const protocolTimelock = deployedAddress(manifest, 'ProtocolTimelock', issues);
  if (protocolTimelock !== null && protocolTimelock.toLowerCase() !== manifest.roles.protocolTimelock.toLowerCase()) {
    issues.push('Manifest ProtocolTimelock role does not match its deployed contract record.');
  }
  if (emergencyGuardian === null || protocolTimelock === null) return null;
  return {
    emergencyGuardian,
    protocolTimelock,
    guardianOperator: manifest.roles.emergencyGuardianMultisig as Address,
    protocolTimelockProposer: manifest.roles.protocolTimelockMultisig as Address,
  };
}

function validateManifestCoverage(
  manifest: DeploymentManifest | null,
  addressGroups: ReadonlyArray<Readonly<Record<string, Address>> | null>,
  issues: string[],
): void {
  if (manifest === null || addressGroups.some((group) => group === null)) return;
  const deployed = new Set(manifest.deployedContracts.map(({ address }) => address.toLowerCase()));
  for (const address of addressGroups.flatMap((group) => Object.values(group ?? {}))) {
    if (!deployed.has(address.toLowerCase())) {
      issues.push(`Configured protocol address ${address} is absent from the signed deployment manifest.`);
    }
  }
}

export async function resolveRuntimeDeployment(
  environment: RuntimeEnvironment,
  manifestValidator: ManifestValidator = validateDeploymentManifest,
): Promise<RuntimeDeployment> {
  const issues: string[] = [];
  const chainId = parseChainId(environment.GUMBALL_CHAIN_ID, issues);
  const mode = environment.GUMBALL_CLIENT_MODE?.trim();
  const localRehearsal = mode === 'rehearsal';
  const remoteTestnet = mode === 'testnet';

  if (mode !== 'live' && !remoteTestnet && !localRehearsal) {
    return {
      mode: 'demo',
      fallbackReason: mode === 'demo' ? 'explicit-demo' : 'missing-live-configuration',
      chain: clientChain(chainId),
      issues: [
        ...issues,
        mode === 'demo'
          ? 'Demo mode is explicitly selected; contract writes are disabled.'
          : 'Live deployment environment is absent; contract writes are disabled.',
      ],
      addresses: null,
      assets: {},
      assetMetadata: {},
      strategies: {},
      rewards: {},
      externalContracts: null,
      admin: null,
      subgraphUrl: null,
      manifest: null,
    };
  }

  if (mode === 'live' && chainId !== 4663) {
    issues.push('Live mode is restricted to Robinhood Chain mainnet chain ID 4663.');
  }
  if (remoteTestnet && chainId !== 46630) {
    issues.push('Remote testnet mode is restricted to Robinhood Chain testnet chain ID 46630.');
  }
  if (localRehearsal) {
    if (environment.NODE_ENV === 'production') {
      issues.push('Local rehearsal mode is disabled in production.');
    }
    if (chainId !== 46630) {
      issues.push('Local rehearsal mode is restricted to Robinhood Chain testnet chain ID 46630.');
    }
  }

  const rpcUrl = validateRpcUrl(environment.GUMBALL_RPC_URL, chainId, localRehearsal, remoteTestnet, issues);
  const fallbackRpcUrls = validateFallbackRpcUrls(
    environment.GUMBALL_RPC_FALLBACK_URLS_JSON,
    rpcUrl,
    localRehearsal,
    remoteTestnet,
    issues,
  );
  const subgraphUrl = validateSubgraphUrl(environment.GUMBALL_SUBGRAPH_URL, localRehearsal, remoteTestnet, issues);
  if (localRehearsal && rpcUrl !== null && !isLocalUrl(rpcUrl)) {
    issues.push('Local rehearsal mode requires a localhost RPC endpoint.');
  }
  if (localRehearsal && subgraphUrl !== null && !isLocalUrl(subgraphUrl)) {
    issues.push('Local rehearsal mode requires a localhost subgraph endpoint.');
  }
  const addresses = parseProtocolAddresses(environment.GUMBALL_PROTOCOL_ADDRESSES_JSON, issues);
  const strategies = parseAddressMap<StrategySymbol>(
    'GUMBALL_STRATEGIES_JSON',
    environment.GUMBALL_STRATEGIES_JSON,
    strategySymbols,
    issues,
  );
  const rewards = parseAddressMap<RewardSymbol>(
    'GUMBALL_REWARDS_JSON',
    environment.GUMBALL_REWARDS_JSON,
    rewardSymbols,
    issues,
  );
  const manifest = await parseManifest(
    environment.GUMBALL_DEPLOYMENT_MANIFEST_JSON,
    chainId,
    remoteTestnet || localRehearsal ? 'testnet-candidate' : 'release-approved',
    issues,
    manifestValidator,
  );
  if (remoteTestnet) validateRemoteTestnetSignatureState(manifest, issues);
  // The disposable local Anvil rehearsal intentionally deploys mock token addresses. Any remote candidate must bind
  // canonical chain-specific token identities before the UI enables writes.
  const runtimeAssets = buildAssetMap(manifest, addresses, chainId, !localRehearsal, issues);
  const externalContracts = buildExternalContracts(manifest, localRehearsal, issues);
  if (remoteTestnet) validateTestnetExternalBindings(externalContracts, issues);
  const admin = buildAdminBoundary(manifest, issues);
  validateNamedDeploymentBindings(
    manifest,
    'GUMBALL_PROTOCOL_ADDRESSES_JSON',
    addresses,
    protocolManifestNames,
    issues,
  );
  validateNamedDeploymentBindings(manifest, 'GUMBALL_STRATEGIES_JSON', strategies, strategyManifestNames, issues);
  validateNamedDeploymentBindings(manifest, 'GUMBALL_REWARDS_JSON', rewards, rewardManifestNames, issues);
  if (
    addresses !== null &&
    strategies !== null &&
    strategies.BURN.toLowerCase() !== addresses.buybackBurnStrategy.toLowerCase()
  ) {
    issues.push('GUMBALL_STRATEGIES_JSON.BURN must match protocolAddresses.buybackBurnStrategy.');
  }
  validateManifestCoverage(manifest, [addresses, strategies, rewards], issues);

  if (
    issues.length > 0 ||
    rpcUrl === null ||
    addresses === null ||
    strategies === null ||
    rewards === null ||
    runtimeAssets === null ||
    externalContracts === null ||
    admin === null ||
    subgraphUrl === null ||
    manifest === null ||
    manifest.compliance.mode === 'unresolved'
  ) {
    return {
      mode: 'demo',
      fallbackReason: remoteTestnet ? 'invalid-testnet-configuration' : 'invalid-live-configuration',
      chain: clientChain(chainId),
      issues,
      addresses: null,
      assets: {},
      assetMetadata: {},
      strategies: {},
      rewards: {},
      externalContracts: null,
      admin: null,
      subgraphUrl: null,
      manifest: null,
    };
  }

  return {
    mode: 'live',
    runtimeKind: localRehearsal ? 'local-rehearsal' : remoteTestnet ? 'testnet-candidate' : 'production',
    fallbackReason: null,
    chain: clientChain(chainId, rpcUrl, fallbackRpcUrls),
    issues: [],
    addresses,
    assets: runtimeAssets.addresses,
    assetMetadata: runtimeAssets.metadata,
    strategies,
    rewards,
    externalContracts,
    admin,
    subgraphUrl,
    manifest: {
      version: manifest.release.version,
      gitCommit: manifest.release.gitCommit,
      status: manifest.release.status as 'release-approved' | 'testnet-candidate',
      complianceMode: manifest.compliance.mode,
      miningPoolDeploymentBlock: manifest.deployedContracts.find(({ name }) => name === 'MiningPool')!.blockNumber,
      signatureCount: manifest.signatures.length,
      signatureThreshold: manifest.signaturePolicy.threshold,
    },
  };
}

export function readRuntimeEnvironment(): RuntimeEnvironment {
  return {
    NODE_ENV: process.env.NODE_ENV,
    GUMBALL_CLIENT_MODE: process.env.GUMBALL_CLIENT_MODE,
    GUMBALL_CHAIN_ID: process.env.GUMBALL_CHAIN_ID,
    GUMBALL_RPC_URL: process.env.GUMBALL_RPC_URL,
    GUMBALL_RPC_FALLBACK_URLS_JSON: process.env.GUMBALL_RPC_FALLBACK_URLS_JSON,
    GUMBALL_PROTOCOL_ADDRESSES_JSON: process.env.GUMBALL_PROTOCOL_ADDRESSES_JSON,
    GUMBALL_STRATEGIES_JSON: process.env.GUMBALL_STRATEGIES_JSON,
    GUMBALL_REWARDS_JSON: process.env.GUMBALL_REWARDS_JSON,
    GUMBALL_DEPLOYMENT_MANIFEST_JSON: process.env.GUMBALL_DEPLOYMENT_MANIFEST_JSON,
    GUMBALL_SUBGRAPH_URL: process.env.GUMBALL_SUBGRAPH_URL,
  };
}

export async function getRuntimeDeployment(): Promise<RuntimeDeployment> {
  return resolveRuntimeDeployment(readRuntimeEnvironment());
}
