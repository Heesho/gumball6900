import { createHash } from 'node:crypto';

import { getAddress, id } from 'ethers';

import { stableJson } from './deployment';
import type { ContractRecord, DeploymentConfig, DeploymentState } from './deployment';
import { assertSafeControlPlaneIdentity } from './safe-control-plane';
import type { SafeControlPlaneEvidence } from './safe-control-plane';

export interface ReleaseObservation {
  blockHash: string;
  blockNumber: string;
  expiresAt: string;
  observedAt: string;
}

export interface ReleaseConstructorRecord {
  arguments: unknown[];
  encodedArguments: string;
}

export interface ReleaseDeployedContract {
  address: string;
  blockNumber: string;
  contractName: string;
  constructorParametersKey: string;
  create2SaltKey: string | null;
  name: string;
  runtimeBytecodeHash: string;
  transactionHash: string;
  transactionKey: string;
  verificationStatus: 'pending' | 'verified';
  verificationUrl: string | null;
}

export interface ReleaseAssetRecord {
  acquisitionEnabled: boolean;
  address: string;
  decimals: number;
  key: string;
  proxyEvidence?:
    | {
        adminSlotValue: string;
        implementationAddress: string;
        implementationRuntimeBytecodeHash: string;
        kind: 'eip1967-uups';
        upgradeAuthorityAddress: string;
        upgradeAuthorityRuntimeBytecodeHash: string | null;
        verifiedAtBlock: string;
      }
    | {
        adminAddress: string;
        adminOwnerAddress: string;
        adminOwnerProxyEvidence: {
          adminSlotValue: string;
          implementationAddress: string;
          implementationRuntimeBytecodeHash: string;
        } | null;
        adminOwnerRuntimeBytecodeHash: string;
        adminRuntimeBytecodeHash: string;
        adminSlotValue: string;
        implementationAddress: string;
        implementationRuntimeBytecodeHash: string;
        kind: 'eip1967-transparent';
        proxyAdminInterface: 'oz-v4' | 'oz-v5';
        verifiedAtBlock: string;
      }
    | {
        beaconAddress: string;
        beaconRuntimeBytecodeHash: string;
        implementationAddress: string;
        implementationRuntimeBytecodeHash: string;
        kind: 'eip1967-beacon';
        verifiedAtBlock: string;
      }
    | {
        gateway: {
          address: string;
          implementationAddress: string;
          implementationRuntimeBytecodeHash: string;
          proxyAdminAddress: string;
          runtimeBytecodeHash: string;
        };
        gatewayRouter: {
          address: string;
          implementationAddress: string;
          implementationRuntimeBytecodeHash: string;
          proxyAdminAddress: string;
          runtimeBytecodeHash: string;
        };
        kind: 'wrapped-btc-canonical-bridge';
        l1Token: string;
        sharedProxyAdmin: {
          address: string;
          owner: {
            address: string;
            adminRole: string;
            executorRole: string;
            implementationAddress: string;
            implementationRuntimeBytecodeHash: string;
            runtimeBytecodeHash: string;
          };
          runtimeBytecodeHash: string;
        };
        tokenBeacon: {
          address: string;
          implementationAddress: string;
          implementationRuntimeBytecodeHash: string;
          runtimeBytecodeHash: string;
        };
        verifiedAtBlock: string;
      }
    | null;
  redemptionEnabled: boolean;
  registryStatus: string;
  runtimeBytecodeHash: string;
  uid: string | null;
  uiMultiplier: string | null;
}

export interface ReleaseExternalContract {
  address: string;
  key: string;
  runtimeBytecodeHash: string;
  verifiedAtBlock: string;
}

export interface ReleaseManifest {
  assets: ReleaseAssetRecord[];
  compliance: {
    eligibilityModule: string | null;
    gbxContractHolders: Array<{ address: string; rationale: string; role: string }>;
  };
  constructorParameters: Record<string, ReleaseConstructorRecord>;
  create2Salts: Record<string, string>;
  deployedContracts: ReleaseDeployedContract[];
  externalContracts: ReleaseExternalContract[];
  kind: string;
  network: { chainId: number; explorerUrl: string };
  protocol: string;
  release: { createdAt: string; gitCommit: string; status: string; version: string };
  releaseEvidence: {
    assetCandidate: { path: string; rawSha256: string } | null;
    deploymentConfig: { path: string; rawSha256: string };
    deploymentState: { path: string; rawSha256: string };
    emergencyGuardianSafe: SafeControlPlaneEvidence;
    observation: ReleaseObservation;
    permissionedPool?: PermissionedPoolReleaseEvidenceDescriptor;
    protocolAdminSafe: SafeControlPlaneEvidence;
  };
  roles: {
    deployer: string;
    deployerPrivilegesRenouncedOrIrrelevant: boolean;
    emergencyGuardianMultisig: string;
    protocolTimelock: string;
    protocolTimelockMultisig: string;
  };
  signaturePolicy: { policyId: string };
  schemaVersion: number;
  transactions: Record<string, string>;
}

export interface ReleaseEvidenceFileDescriptor {
  path: string;
  rawSha256: string;
}

export interface PermissionedPoolReleaseEvidenceDescriptor {
  graph: ReleaseEvidenceFileDescriptor;
  officialSourceBuild: ReleaseEvidenceFileDescriptor;
  robinhoodForkRehearsal: ReleaseEvidenceFileDescriptor;
}

export interface PermissionedPoolReleaseEvidenceBytes {
  graphBytes: Uint8Array;
  officialSourceBuildBytes: Uint8Array;
  robinhoodForkRehearsalBytes: Uint8Array;
}

export type RobinhoodRegistryRevalidationStage = 'preliminary' | 'protected-final';

interface RegistryDeploymentRecord {
  chainId: number;
  contractAddress: string;
}

interface RegistrySelectedRecord {
  currentMultiplier: string;
  deployments: RegistryDeploymentRecord[];
  id: string;
  status: string;
  tokenName: string;
  tokenSymbol: string;
}

interface RobinhoodRegistryRevalidationArtifact {
  authorizationEligible: boolean;
  evidence: {
    expiresAt: string;
    fetchedAt: string;
    registryUrl: string;
    selectedRecords: RegistrySelectedRecord[];
    selectedRecordsSha256: string;
    sourceArchive: { fileName: string; rawSha256: string };
    sourceRecordCount: number;
    sourceResponseSha256: string;
  };
  kind: string;
  protocol: string;
  releaseLinkage: {
    assetCandidate: { path: string; rawSha256: string };
    candidatePin: { blockHash: string; blockNumber: string; blockTimestamp: string };
    deploymentConfig: { path: string; rawSha256: string };
    deploymentManifest: { path: string; rawSha256: string };
    evidenceCommit: string;
    evidenceCommitCommittedAt: string;
    releaseObservation: { blockHash: string; blockNumber: string };
    releaseTag: string;
    signaturePolicyId: string;
    sourceCommit: string;
    tagObject: string;
  };
  schemaVersion: number;
  stage: string;
  status: string;
}

const CANONICAL_TARGET_ASSET_METADATA: Readonly<Record<string, { isStockToken: boolean; symbol: string }>> = {
  AAPL: { isStockToken: true, symbol: 'AAPL' },
  NVDA: { isStockToken: true, symbol: 'NVDA' },
  QQQ: { isStockToken: true, symbol: 'QQQ' },
  SPCX: { isStockToken: true, symbol: 'SPCX' },
  TSLA: { isStockToken: true, symbol: 'TSLA' },
  WETH: { isStockToken: false, symbol: 'WETH' },
  WRAPPED_BTC: { isStockToken: false, symbol: 'WBTC' },
};

const PERMISSIONED_SOURCE_PINS = {
  hooks: {
    commit: '7da5210f2c81a700820a6b4f585264233d91f349',
    path: 'src/permissioned-pools/PermissionedHooks.sol',
    repository: 'https://github.com/Uniswap/v4-hooks-public',
  },
  mixedQuoter: {
    commit: 'd576527bff2e7c9db5434bb2b3806fd184610865',
    path: 'src/MixedRouteQuoterV2.sol',
    repository: 'https://github.com/Uniswap/mixed-quoter',
  },
  periphery: {
    commit: '76c1891c481cebb4ff58f262473303f01a2d7393',
    path: 'src/hooks/permissionedPools',
    repository: 'https://github.com/Uniswap/v4-periphery',
  },
  universalRouter: {
    commit: '020e1b786ad9a6bad924874752167934734ad1e1',
    minimumVersion: '2.2.0',
    repository: 'https://github.com/Uniswap/universal-router',
  },
} as const;

const PERMISSIONED_OFFICIAL_ARTIFACTS = {
  mixedRouteQuoterV2: {
    contractName: 'MixedRouteQuoterV2',
    sourceCommit: PERMISSIONED_SOURCE_PINS.mixedQuoter.commit,
    sourcePath: 'src/MixedRouteQuoterV2.sol',
    sourceRepository: PERMISSIONED_SOURCE_PINS.mixedQuoter.repository,
  },
  permissionedPositionManager: {
    contractName: 'PermissionedPositionManager',
    sourceCommit: PERMISSIONED_SOURCE_PINS.periphery.commit,
    sourcePath: 'src/hooks/permissionedPools/PermissionedPositionManager.sol',
    sourceRepository: PERMISSIONED_SOURCE_PINS.periphery.repository,
  },
  permissionsAdapterFactory: {
    contractName: 'PermissionsAdapterFactory',
    sourceCommit: PERMISSIONED_SOURCE_PINS.periphery.commit,
    sourcePath: 'src/hooks/permissionedPools/PermissionsAdapterFactory.sol',
    sourceRepository: PERMISSIONED_SOURCE_PINS.periphery.repository,
  },
  universalRouter: {
    contractName: 'UniversalRouter',
    sourceCommit: PERMISSIONED_SOURCE_PINS.universalRouter.commit,
    sourcePath: 'contracts/UniversalRouter.sol',
    sourceRepository: PERMISSIONED_SOURCE_PINS.universalRouter.repository,
  },
  v4Quoter: {
    contractName: 'V4Quoter',
    sourceCommit: PERMISSIONED_SOURCE_PINS.periphery.commit,
    sourcePath: 'src/lens/V4Quoter.sol',
    sourceRepository: PERMISSIONED_SOURCE_PINS.periphery.repository,
  },
} as const;

const GUMBALL_PERMISSIONED_HOOK_FLAGS = 0x28c0n;
const V4_ALL_HOOK_FLAGS = 0x3fffn;
const GENESIS_TOTAL_GBX = 100_000_000n * 10n ** 18n;
const GENESIS_CLAIMS_GBX = 80_000_000n * 10n ** 18n;
const GENESIS_LIQUIDITY_GBX = 20_000_000n * 10n ** 18n;

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (stableJson(actual) !== stableJson(required)) {
    throw new Error(`${label} fields do not match the versioned evidence schema`);
  }
}

function requiredObject(parent: Record<string, unknown>, key: string, label: string): Record<string, unknown> {
  const value = parent[key];
  assertObject(value, `${label}.${key}`);
  return value;
}

function requiredString(parent: Record<string, unknown>, key: string, label: string): string {
  const value = parent[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label}.${key} must be a nonempty string`);
  return value;
}

function requiredArray(parent: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = parent[key];
  if (!Array.isArray(value)) throw new Error(`${label}.${key} must be an array`);
  return value;
}

function parseEvidenceJson(bytes: Uint8Array, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error });
  }
  assertObject(value, label);
  return value;
}

function assertNonzeroAddress(value: string, label: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value) || BigInt(value) === 0n) throw new Error(`${label} is not a nonzero address`);
}

function assertNonzeroBytes32(value: string, label: string): void {
  if (!/^0x[0-9a-f]{64}$/.test(value) || BigInt(value) === 0n) throw new Error(`${label} is not a nonzero bytes32`);
}

function requiredUnsigned(value: unknown, label: string, positive = false): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error(`${label} is not an unsigned integer string`);
  const parsed = BigInt(value);
  if (positive && parsed === 0n) throw new Error(`${label} must be positive`);
  return parsed;
}

function assertEvidenceDescriptor(value: unknown, label: string): asserts value is ReleaseEvidenceFileDescriptor {
  assertObject(value, label);
  assertExactKeys(value, ['path', 'rawSha256'], label);
  const descriptorPath = requiredString(value, 'path', label);
  if (
    !/^[0-9A-Za-z._/-]+\.json$/.test(descriptorPath) ||
    descriptorPath.startsWith('/') ||
    descriptorPath.includes('\\') ||
    descriptorPath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`${label}.path is not a normalized repository-relative JSON path`);
  }
  assertRawSha256(requiredString(value, 'rawSha256', label), `${label}.rawSha256`);
}

function assertDescriptorEqual(actual: unknown, expected: ReleaseEvidenceFileDescriptor, label: string): void {
  assertEvidenceDescriptor(actual, label);
  if (actual.path !== expected.path || actual.rawSha256 !== expected.rawSha256) {
    throw new Error(`${label} does not match the signed release manifest`);
  }
}

function equalAddress(actual: string, expected: string, label: string): void {
  if (getAddress(actual) !== getAddress(expected)) throw new Error(`${label}: ${actual} != ${expected}`);
}

function equalHash(actual: string, expected: string, label: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${label} mismatch`);
}

function assertCanonicalTokenProxyBinding(
  usdG: ReleaseAssetRecord,
  weth: ReleaseAssetRecord,
  dependencies: NonNullable<DeploymentConfig['canonicalTokenDependencies']>,
): void {
  equalHash(usdG.runtimeBytecodeHash, dependencies.usdG.runtimeBytecodeHash, 'Manifest USDG proxy runtime bytecode');
  const usdGEvidence = usdG.proxyEvidence;
  const expectedUsdG = dependencies.usdG.proxyEvidence;
  if (usdGEvidence === undefined || usdGEvidence === null || usdGEvidence.kind !== 'eip1967-uups') {
    throw new Error('Manifest USDG lacks the configured Ownable UUPS dependency evidence');
  }
  equalHash(usdGEvidence.adminSlotValue, expectedUsdG.adminSlotValue, 'Manifest USDG EIP-1967 admin slot');
  equalAddress(usdGEvidence.implementationAddress, expectedUsdG.implementationAddress, 'Manifest USDG implementation');
  equalHash(
    usdGEvidence.implementationRuntimeBytecodeHash,
    expectedUsdG.implementationRuntimeBytecodeHash,
    'Manifest USDG implementation runtime bytecode',
  );
  equalAddress(
    usdGEvidence.upgradeAuthorityAddress,
    expectedUsdG.upgradeAuthorityAddress,
    'Manifest USDG upgrade authority',
  );
  if (usdGEvidence.upgradeAuthorityRuntimeBytecodeHash === null) {
    throw new Error('Manifest USDG upgrade-authority runtime bytecode hash is absent');
  }
  equalHash(
    usdGEvidence.upgradeAuthorityRuntimeBytecodeHash,
    expectedUsdG.upgradeAuthorityRuntimeBytecodeHash,
    'Manifest USDG upgrade-authority runtime bytecode',
  );

  equalHash(weth.runtimeBytecodeHash, dependencies.weth.runtimeBytecodeHash, 'Manifest WETH proxy runtime bytecode');
  const wethEvidence = weth.proxyEvidence;
  const expectedWeth = dependencies.weth.proxyEvidence;
  if (wethEvidence === undefined || wethEvidence === null || wethEvidence.kind !== 'eip1967-transparent') {
    throw new Error('Manifest WETH lacks the configured transparent-proxy dependency evidence');
  }
  equalHash(wethEvidence.adminSlotValue, expectedWeth.adminSlotValue, 'Manifest WETH EIP-1967 admin slot');
  equalAddress(wethEvidence.adminAddress, expectedWeth.adminAddress, 'Manifest WETH ProxyAdmin');
  equalHash(
    wethEvidence.adminRuntimeBytecodeHash,
    expectedWeth.adminRuntimeBytecodeHash,
    'Manifest WETH ProxyAdmin runtime bytecode',
  );
  equalAddress(wethEvidence.implementationAddress, expectedWeth.implementationAddress, 'Manifest WETH implementation');
  equalHash(
    wethEvidence.implementationRuntimeBytecodeHash,
    expectedWeth.implementationRuntimeBytecodeHash,
    'Manifest WETH implementation runtime bytecode',
  );
  equalAddress(wethEvidence.adminOwnerAddress, expectedWeth.adminOwnerAddress, 'Manifest WETH ProxyAdmin owner');
  equalHash(
    wethEvidence.adminOwnerRuntimeBytecodeHash,
    expectedWeth.adminOwnerRuntimeBytecodeHash,
    'Manifest WETH ProxyAdmin-owner runtime bytecode',
  );
  if (wethEvidence.proxyAdminInterface !== expectedWeth.proxyAdminInterface) {
    throw new Error('Manifest WETH ProxyAdmin interface mismatch');
  }
  if (wethEvidence.adminOwnerProxyEvidence === null) {
    throw new Error('Manifest WETH ProxyAdmin-owner proxy evidence is absent');
  }
  equalHash(
    wethEvidence.adminOwnerProxyEvidence.adminSlotValue,
    expectedWeth.adminOwnerProxyEvidence.adminSlotValue,
    'Manifest WETH ProxyAdmin-owner EIP-1967 admin slot',
  );
  equalAddress(
    wethEvidence.adminOwnerProxyEvidence.implementationAddress,
    expectedWeth.adminOwnerProxyEvidence.implementationAddress,
    'Manifest WETH ProxyAdmin-owner implementation',
  );
  equalHash(
    wethEvidence.adminOwnerProxyEvidence.implementationRuntimeBytecodeHash,
    expectedWeth.adminOwnerProxyEvidence.implementationRuntimeBytecodeHash,
    'Manifest WETH ProxyAdmin-owner implementation runtime bytecode',
  );
}

function assertWrappedBtcBridgeBinding(
  asset: ReleaseAssetRecord,
  dependency: NonNullable<DeploymentConfig['wrappedBtcBridgeDependency']>,
): void {
  equalAddress(asset.address, dependency.token.address, 'Manifest WBTC token');
  equalHash(asset.runtimeBytecodeHash, dependency.token.runtimeBytecodeHash, 'Manifest WBTC token runtime bytecode');
  const evidence = asset.proxyEvidence;
  if (evidence === undefined || evidence === null || evidence.kind !== 'wrapped-btc-canonical-bridge') {
    throw new Error('Manifest WBTC lacks the configured canonical bridge and upgrade-control evidence');
  }
  equalAddress(evidence.l1Token, dependency.l1Token, 'Manifest WBTC L1 token');

  for (const [label, actual, expected] of [
    ['gateway', evidence.gateway, dependency.gateway],
    ['gateway router', evidence.gatewayRouter, dependency.gatewayRouter],
  ] as const) {
    equalAddress(actual.address, expected.address, `Manifest WBTC ${label}`);
    equalHash(actual.runtimeBytecodeHash, expected.runtimeBytecodeHash, `Manifest WBTC ${label} runtime bytecode`);
    equalAddress(actual.implementationAddress, expected.implementationAddress, `Manifest WBTC ${label} implementation`);
    equalHash(
      actual.implementationRuntimeBytecodeHash,
      expected.implementationRuntimeBytecodeHash,
      `Manifest WBTC ${label} implementation runtime bytecode`,
    );
    equalAddress(actual.proxyAdminAddress, expected.proxyAdminAddress, `Manifest WBTC ${label} ProxyAdmin`);
  }

  const actualAdmin = evidence.sharedProxyAdmin;
  const expectedAdmin = dependency.sharedProxyAdmin;
  equalAddress(actualAdmin.address, expectedAdmin.address, 'Manifest WBTC shared ProxyAdmin');
  equalHash(
    actualAdmin.runtimeBytecodeHash,
    expectedAdmin.runtimeBytecodeHash,
    'Manifest WBTC shared ProxyAdmin runtime bytecode',
  );
  equalAddress(actualAdmin.owner.address, expectedAdmin.owner.address, 'Manifest WBTC ProxyAdmin owner');
  equalHash(
    actualAdmin.owner.runtimeBytecodeHash,
    expectedAdmin.owner.runtimeBytecodeHash,
    'Manifest WBTC ProxyAdmin-owner runtime bytecode',
  );
  equalHash(actualAdmin.owner.adminRole, expectedAdmin.owner.adminRole, 'Manifest WBTC bridge ADMIN_ROLE');
  equalHash(actualAdmin.owner.executorRole, expectedAdmin.owner.executorRole, 'Manifest WBTC bridge EXECUTOR_ROLE');
  equalAddress(
    actualAdmin.owner.implementationAddress,
    expectedAdmin.owner.proxy.implementationAddress,
    'Manifest WBTC ProxyAdmin-owner implementation',
  );
  equalHash(
    actualAdmin.owner.implementationRuntimeBytecodeHash,
    expectedAdmin.owner.proxy.implementationRuntimeBytecodeHash,
    'Manifest WBTC ProxyAdmin-owner implementation runtime bytecode',
  );

  equalAddress(evidence.tokenBeacon.address, dependency.token.beaconAddress, 'Manifest WBTC token beacon');
  equalHash(
    evidence.tokenBeacon.runtimeBytecodeHash,
    dependency.token.beaconRuntimeBytecodeHash,
    'Manifest WBTC token beacon runtime bytecode',
  );
  equalAddress(
    evidence.tokenBeacon.implementationAddress,
    dependency.token.implementationAddress,
    'Manifest WBTC token implementation',
  );
  equalHash(
    evidence.tokenBeacon.implementationRuntimeBytecodeHash,
    dependency.token.implementationRuntimeBytecodeHash,
    'Manifest WBTC token implementation runtime bytecode',
  );
}

function rawSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const ROBINHOOD_REGISTRY_URL = 'https://api.robinhood.com/rhj/assets';
const ROBINHOOD_REGISTRY_RESPONSE_ARCHIVE = 'robinhood-registry-response.json';
const ROBINHOOD_REGISTRY_VALIDITY_MS = 24 * 60 * 60 * 1_000;
const ROBINHOOD_STOCK_SYMBOLS = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'] as const;

function prefixedSha256(bytes: Uint8Array): string {
  return `0x${rawSha256(bytes)}`;
}

function exactObjectKeys(value: unknown, expectedKeys: readonly string[]): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function canonicalTimestamp(value: unknown, label: string): number {
  if (typeof value !== 'string') throw new Error(`${label} must be a canonical ISO timestamp`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return timestamp;
}

function assertNonzeroLowerBytes32(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value) || /^0x0{64}$/.test(value)) {
    throw new Error(`${label} must be a nonzero lowercase bytes32`);
  }
}

function assertRawSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value) || /^0{64}$/.test(value)) {
    throw new Error(`${label} must be a nonzero lowercase raw SHA-256`);
  }
}

function positiveDecimal(value: unknown, label: string): bigint {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${label} must be a positive canonical decimal`);
  }
  return BigInt(value);
}

function integerToFixed18(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be a canonical nonnegative integer`);
  }
  const amount = BigInt(value);
  return `${amount / 10n ** 18n}.${(amount % 10n ** 18n).toString().padStart(18, '0')}`;
}

function fixed18ToInteger(value: unknown, label: string): string {
  const match = typeof value === 'string' ? /^(0|[1-9][0-9]*)\.([0-9]{18})$/.exec(value) : null;
  if (match === null) throw new Error(`${label} must be a canonical nonnegative fixed-18 value`);
  return (BigInt(match[1]!) * 10n ** 18n + BigInt(match[2]!)).toString();
}

function sortForDeterministicJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForDeterministicJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, sortForDeterministicJson(nested)]),
    );
  }
  return value;
}

function deterministicPrettyJson(value: unknown): string {
  return `${JSON.stringify(sortForDeterministicJson(value), null, 2)}\n`;
}

function parseJsonBytes(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8 JSON`, { cause: error });
  }
}

function sameAddress(left: unknown, right: unknown): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return false;
  }
}

function deriveCandidateRegistryRecords(
  candidateValue: unknown,
  config: DeploymentConfig,
  manifest: ReleaseManifest,
): {
  blockHash: string;
  blockNumber: bigint;
  blockTimestamp: string;
  blockTimestampMs: number;
  records: RegistrySelectedRecord[];
  selectedRecordsSha256: string;
} {
  assertObject(candidateValue, 'reviewed stock candidate');
  const candidate = candidateValue;
  if (
    candidate.kind !== 'robinhood-stock-asset-manifest' ||
    candidate.schemaVersion !== 2 ||
    candidate.chainId !== 4_663 ||
    candidate.status !== 'generated-candidate' ||
    candidate.deploymentApproved !== false ||
    !Array.isArray(candidate.assets) ||
    candidate.assets.length !== ROBINHOOD_STOCK_SYMBOLS.length
  ) {
    throw new Error('Reviewed stock candidate identity or v2 shape is invalid');
  }
  assertObject(candidate.source, 'reviewed stock candidate source');
  const source = candidate.source;
  if (source.registryUrl !== ROBINHOOD_REGISTRY_URL || source.observedAt !== source.blockTimestamp) {
    throw new Error('Reviewed stock candidate does not use the canonical registry and pinned block timestamp');
  }
  const blockNumber = positiveDecimal(source.blockNumber, 'candidate source blockNumber');
  assertNonzeroLowerBytes32(source.blockHash, 'candidate source blockHash');
  assertNonzeroLowerBytes32(source.registryResponseSha256, 'candidate selected-record digest');
  const blockTimestampMs = canonicalTimestamp(source.blockTimestamp, 'candidate source blockTimestamp');
  const stockIndexes = config.assets.isStockToken.flatMap((isStock, index) => (isStock ? [index] : []));

  const records = candidate.assets.map((assetValue, candidateIndex): RegistrySelectedRecord => {
    assertObject(assetValue, `reviewed stock candidate asset ${candidateIndex}`);
    const asset = assetValue;
    const symbol = ROBINHOOD_STOCK_SYMBOLS[candidateIndex];
    if (symbol === undefined) throw new Error(`Unexpected reviewed stock candidate index ${candidateIndex}`);
    if (
      asset.symbol !== symbol ||
      asset.chainId !== 4_663 ||
      asset.decimals !== 18 ||
      asset.registryStatus !== 'ASSET_STATUS_ACTIVE' ||
      typeof asset.tokenName !== 'string' ||
      asset.tokenName.length === 0 ||
      typeof asset.address !== 'string'
    ) {
      throw new Error(`Reviewed stock candidate ${symbol} identity is invalid or unsorted`);
    }
    assertNonzeroLowerBytes32(asset.uid, `reviewed stock candidate ${symbol} UID`);
    assertNonzeroLowerBytes32(asset.runtimeBytecodeHash, `reviewed stock candidate ${symbol} runtime bytecode hash`);
    const currentMultiplier = integerToFixed18(
      asset.currentMultiplier,
      `reviewed stock candidate ${symbol} multiplier`,
    );
    const configIndexes = stockIndexes.filter((index) => sameAddress(config.assets.tokens[index], asset.address));
    if (configIndexes.length !== 1) throw new Error(`Deployment config lacks one exact ${symbol} stock target`);
    const configIndex = configIndexes[0]!;
    if (
      config.assets.decimals[configIndex] !== 18 ||
      config.assets.assetIds[configIndex]?.toLowerCase() !== asset.uid ||
      config.assets.runtimeBytecodeHashes[configIndex]?.toLowerCase() !== asset.runtimeBytecodeHash ||
      config.assets.uiMultipliers[configIndex] !== asset.currentMultiplier
    ) {
      throw new Error(`Deployment config ${symbol} identity differs from the reviewed candidate`);
    }
    const manifestMatches = manifest.assets.filter(
      (manifestAsset) => manifestAsset.key === symbol && sameAddress(manifestAsset.address, asset.address),
    );
    const manifestAsset = manifestMatches[0];
    if (
      manifestMatches.length !== 1 ||
      manifestAsset === undefined ||
      manifestAsset.decimals !== 18 ||
      manifestAsset.uid?.toLowerCase() !== asset.uid ||
      manifestAsset.uiMultiplier !== asset.currentMultiplier ||
      manifestAsset.registryStatus !== 'ASSET_STATUS_ACTIVE'
    ) {
      throw new Error(`Signed manifest ${symbol} identity differs from the reviewed candidate`);
    }
    if (!sameAddress(asset.address, asset.address) || /^0x0{40}$/i.test(asset.address)) {
      throw new Error(`Reviewed stock candidate ${symbol} address is invalid`);
    }
    return {
      currentMultiplier,
      deployments: [{ chainId: 4_663, contractAddress: asset.address }],
      id: asset.uid,
      status: 'ASSET_STATUS_ACTIVE',
      tokenName: asset.tokenName,
      tokenSymbol: symbol,
    };
  });
  const selectedRecordsSha256 = prefixedSha256(Buffer.from(deterministicPrettyJson(records), 'utf8'));
  if (selectedRecordsSha256 !== source.registryResponseSha256) {
    throw new Error('Reviewed stock candidate selected-record digest does not match its identities');
  }
  return {
    blockHash: source.blockHash,
    blockNumber,
    blockTimestamp: source.blockTimestamp as string,
    blockTimestampMs,
    records,
    selectedRecordsSha256,
  };
}

function selectOfficialRegistryRecords(
  registryValue: unknown,
  expectedRecords: readonly RegistrySelectedRecord[],
): { records: RegistrySelectedRecord[]; sourceRecordCount: number } {
  assertObject(registryValue, 'archived official Robinhood registry response');
  const sourceAssets = registryValue.assets;
  if (!Array.isArray(sourceAssets)) {
    throw new Error('Archived official Robinhood registry response lacks assets');
  }
  const records = expectedRecords.map((expected) => {
    const matches = sourceAssets.filter((record) => {
      if (record === null || typeof record !== 'object' || Array.isArray(record)) return false;
      return (record as Record<string, unknown>).tokenSymbol === expected.tokenSymbol;
    });
    if (matches.length !== 1) {
      throw new Error(`Archived official registry does not contain one exact ${expected.tokenSymbol} record`);
    }
    const record = matches[0]!;
    assertObject(record, `archived official ${expected.tokenSymbol} record`);
    const deployments = Array.isArray(record.deployments)
      ? record.deployments.filter(
          (deployment) =>
            deployment !== null &&
            typeof deployment === 'object' &&
            !Array.isArray(deployment) &&
            deployment.chainId === 4_663,
        )
      : [];
    const deployment = deployments[0];
    if (
      record.status !== 'ASSET_STATUS_ACTIVE' ||
      typeof record.id !== 'string' ||
      record.id.toLowerCase() !== expected.id ||
      record.tokenName !== expected.tokenName ||
      fixed18ToInteger(record.currentMultiplier, `official ${expected.tokenSymbol} multiplier`) !==
        fixed18ToInteger(expected.currentMultiplier, `candidate ${expected.tokenSymbol} multiplier`) ||
      deployments.length !== 1 ||
      deployment === null ||
      typeof deployment !== 'object' ||
      Array.isArray(deployment) ||
      !sameAddress(deployment.contractAddress, expected.deployments[0]!.contractAddress)
    ) {
      throw new Error(`Archived official registry ${expected.tokenSymbol} identity or active status changed`);
    }
    return expected;
  });
  return { records, sourceRecordCount: sourceAssets.length };
}

/**
 * Independently verifies the exact late official-registry bytes and their release linkage. The offchain
 * fetch creates no new onchain block: candidatePin must remain identical to the reviewed candidate pin.
 */
export function assertRobinhoodRegistryRevalidationEvidence(options: {
  assetCandidateBytes: Uint8Array;
  config: DeploymentConfig;
  configBytes: Uint8Array;
  evidenceBytes: Uint8Array;
  evidenceCommit: string;
  evidenceCommitCommittedAt: string;
  expectedStage: RobinhoodRegistryRevalidationStage;
  manifest: ReleaseManifest;
  manifestBytes: Uint8Array;
  manifestRepositoryPath: string;
  nowMs?: number;
  registryResponseBytes: Uint8Array;
  sourceCommit: string;
  tagObject: string;
}): RobinhoodRegistryRevalidationArtifact {
  const artifactValue = parseJsonBytes(options.evidenceBytes, 'Robinhood registry revalidation artifact');
  if (Buffer.from(options.evidenceBytes).toString('utf8') !== deterministicPrettyJson(artifactValue)) {
    throw new Error('Robinhood registry revalidation artifact must use deterministic canonical JSON bytes');
  }
  if (
    !exactObjectKeys(artifactValue, [
      'authorizationEligible',
      'evidence',
      'kind',
      'protocol',
      'releaseLinkage',
      'schemaVersion',
      'stage',
      'status',
    ])
  ) {
    throw new Error('Robinhood registry revalidation artifact has unexpected top-level fields');
  }
  const artifact = artifactValue as RobinhoodRegistryRevalidationArtifact;
  if (
    artifact.kind !== 'gumball-6900-robinhood-registry-revalidation' ||
    artifact.protocol !== 'GUM BALL 6900' ||
    artifact.schemaVersion !== 1 ||
    artifact.stage !== options.expectedStage ||
    artifact.authorizationEligible !== (options.expectedStage === 'protected-final') ||
    artifact.status !== 'registry-identities-unchanged'
  ) {
    throw new Error('Robinhood registry revalidation artifact identity, stage, or eligibility is invalid');
  }
  if (
    !exactObjectKeys(artifact.evidence, [
      'expiresAt',
      'fetchedAt',
      'registryUrl',
      'selectedRecords',
      'selectedRecordsSha256',
      'sourceArchive',
      'sourceRecordCount',
      'sourceResponseSha256',
    ]) ||
    !exactObjectKeys(artifact.evidence.sourceArchive, ['fileName', 'rawSha256']) ||
    artifact.evidence.registryUrl !== ROBINHOOD_REGISTRY_URL ||
    artifact.evidence.sourceArchive.fileName !== ROBINHOOD_REGISTRY_RESPONSE_ARCHIVE
  ) {
    throw new Error('Robinhood registry revalidation evidence fields are invalid');
  }
  assertNonzeroLowerBytes32(artifact.evidence.selectedRecordsSha256, 'registry selected-record digest');
  assertNonzeroLowerBytes32(artifact.evidence.sourceResponseSha256, 'registry source-response digest');
  assertRawSha256(artifact.evidence.sourceArchive.rawSha256, 'registry source-archive raw digest');
  const nowMs = options.nowMs ?? Date.now();
  const fetchedAtMs = canonicalTimestamp(artifact.evidence.fetchedAt, 'registry fetchedAt');
  const expiresAtMs = canonicalTimestamp(artifact.evidence.expiresAt, 'registry expiresAt');
  if (fetchedAtMs > nowMs || expiresAtMs <= nowMs || expiresAtMs - fetchedAtMs !== ROBINHOOD_REGISTRY_VALIDITY_MS) {
    throw new Error('Robinhood registry revalidation evidence is future-dated, expired, or has invalid validity');
  }

  const parsedConfig = parseJsonBytes(options.configBytes, 'prepared deployment config');
  const parsedManifest = parseJsonBytes(options.manifestBytes, 'prepared deployment manifest');
  if (
    stableJson(parsedConfig) !== stableJson(options.config) ||
    stableJson(parsedManifest) !== stableJson(options.manifest)
  ) {
    throw new Error('Prepared deployment inputs differ from the values being independently verified');
  }
  if (
    options.manifest.releaseEvidence.assetCandidate === null ||
    options.config.assetReview === null ||
    rawSha256(options.assetCandidateBytes) !== options.manifest.releaseEvidence.assetCandidate.rawSha256 ||
    rawSha256(options.configBytes) !== options.manifest.releaseEvidence.deploymentConfig.rawSha256 ||
    stableJson(options.config.assetReview) !== stableJson(options.manifest.releaseEvidence.assetCandidate)
  ) {
    throw new Error('Registry revalidation inputs do not match the signed candidate/config descriptors');
  }
  const candidate = deriveCandidateRegistryRecords(
    parseJsonBytes(options.assetCandidateBytes, 'prepared reviewed stock candidate'),
    options.config,
    options.manifest,
  );
  if (
    candidate.blockNumber >
    positiveDecimal(options.manifest.releaseEvidence.observation.blockNumber, 'release observation blockNumber')
  ) {
    throw new Error('Reviewed stock candidate pin is later than the signed release observation');
  }
  const official = selectOfficialRegistryRecords(
    parseJsonBytes(options.registryResponseBytes, 'archived official Robinhood registry response'),
    candidate.records,
  );
  if (
    artifact.evidence.sourceRecordCount !== official.sourceRecordCount ||
    stableJson(artifact.evidence.selectedRecords) !== stableJson(official.records) ||
    prefixedSha256(Buffer.from(deterministicPrettyJson(artifact.evidence.selectedRecords), 'utf8')) !==
      artifact.evidence.selectedRecordsSha256 ||
    artifact.evidence.selectedRecordsSha256 !== candidate.selectedRecordsSha256
  ) {
    throw new Error('Robinhood registry selected records or candidate-pin digest are invalid');
  }
  const sourceRawSha256 = rawSha256(options.registryResponseBytes);
  if (
    artifact.evidence.sourceArchive.rawSha256 !== sourceRawSha256 ||
    artifact.evidence.sourceResponseSha256 !== `0x${sourceRawSha256}`
  ) {
    throw new Error('Archived official Robinhood registry bytes do not match the evidence digests');
  }

  const linkage = artifact.releaseLinkage;
  if (
    !exactObjectKeys(linkage, [
      'assetCandidate',
      'candidatePin',
      'deploymentConfig',
      'deploymentManifest',
      'evidenceCommit',
      'evidenceCommitCommittedAt',
      'releaseObservation',
      'releaseTag',
      'signaturePolicyId',
      'sourceCommit',
      'tagObject',
    ]) ||
    !exactObjectKeys(linkage.assetCandidate, ['path', 'rawSha256']) ||
    !exactObjectKeys(linkage.deploymentConfig, ['path', 'rawSha256']) ||
    !exactObjectKeys(linkage.deploymentManifest, ['path', 'rawSha256']) ||
    !exactObjectKeys(linkage.candidatePin, ['blockHash', 'blockNumber', 'blockTimestamp']) ||
    !exactObjectKeys(linkage.releaseObservation, ['blockHash', 'blockNumber']) ||
    stableJson(linkage.assetCandidate) !== stableJson(options.manifest.releaseEvidence.assetCandidate) ||
    stableJson(linkage.deploymentConfig) !== stableJson(options.manifest.releaseEvidence.deploymentConfig) ||
    linkage.deploymentManifest.path !== options.manifestRepositoryPath ||
    linkage.deploymentManifest.rawSha256 !== rawSha256(options.manifestBytes) ||
    linkage.evidenceCommit !== options.evidenceCommit ||
    linkage.evidenceCommitCommittedAt !== options.evidenceCommitCommittedAt ||
    linkage.releaseTag !== options.manifest.release.version ||
    linkage.sourceCommit !== options.sourceCommit ||
    linkage.tagObject !== options.tagObject ||
    linkage.signaturePolicyId !== options.manifest.signaturePolicy.policyId ||
    linkage.candidatePin.blockHash !== candidate.blockHash ||
    linkage.candidatePin.blockNumber !== candidate.blockNumber.toString() ||
    linkage.candidatePin.blockTimestamp !== candidate.blockTimestamp ||
    linkage.releaseObservation.blockHash !== options.manifest.releaseEvidence.observation.blockHash ||
    linkage.releaseObservation.blockNumber !== options.manifest.releaseEvidence.observation.blockNumber ||
    options.manifest.release.gitCommit !== options.sourceCommit
  ) {
    throw new Error('Robinhood registry revalidation release linkage is invalid');
  }
  if (
    !/^[0-9a-f]{40}$/.test(options.evidenceCommit) ||
    !/^[0-9a-f]{40}$/.test(options.sourceCommit) ||
    !/^[0-9a-f]{40}$/.test(options.tagObject)
  ) {
    throw new Error('Robinhood registry revalidation Git linkage is invalid');
  }
  assertNonzeroLowerBytes32(options.manifest.signaturePolicy.policyId, 'release signature policy ID');
  const evidenceCommitMs = canonicalTimestamp(options.evidenceCommitCommittedAt, 'evidence commit committedAt');
  const manifestCreatedAtMs = canonicalTimestamp(options.manifest.release.createdAt, 'release manifest createdAt');
  if (fetchedAtMs < evidenceCommitMs || fetchedAtMs < manifestCreatedAtMs || fetchedAtMs < candidate.blockTimestampMs) {
    throw new Error('Robinhood registry revalidation fetch predates its candidate, manifest, or evidence commit');
  }
  return artifact;
}

function mapUniqueBy<T>(records: readonly T[], key: (record: T) => string, label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const record of records) {
    const recordKey = key(record);
    if (result.has(recordKey)) throw new Error(`${label} contains duplicate ${recordKey}`);
    result.set(recordKey, record);
  }
  return result;
}

function stateRuntimeHash(state: DeploymentState, address: string, label: string): string {
  const matches = state.contracts.filter((record) => getAddress(record.address) === getAddress(address));
  if (matches.length !== 1) throw new Error(`${label} lacks one exact deployment-state code record`);
  return matches[0]!.runtimeCodeHash;
}

function assertRuntimeRecord(
  value: unknown,
  expectedAddress: string,
  expectedRuntimeHash: string,
  label: string,
): void {
  assertObject(value, label);
  assertExactKeys(value, ['address', 'runtimeBytecodeHash'], label);
  const address = requiredString(value, 'address', label);
  const runtimeHash = requiredString(value, 'runtimeBytecodeHash', label);
  assertNonzeroAddress(address, `${label}.address`);
  assertNonzeroBytes32(runtimeHash, `${label}.runtimeBytecodeHash`);
  equalAddress(address, expectedAddress, `${label} address`);
  equalHash(runtimeHash, expectedRuntimeHash, `${label} runtime bytecode`);
}

function assertPermissionedGraphEvidence(
  value: Record<string, unknown>,
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  state: DeploymentState,
): void {
  assertExactKeys(
    value,
    [
      'contracts',
      'evidence',
      'kind',
      'network',
      'pool',
      'protocol',
      'relationships',
      'releaseEligible',
      'schemaVersion',
      'sourcePins',
      'status',
    ],
    'permissioned graph evidence',
  );
  if (
    value.kind !== 'gumball-6900-permissioned-pool-graph' ||
    value.protocol !== 'GUM BALL 6900' ||
    value.schemaVersion !== 1 ||
    value.status !== 'review-candidate' ||
    value.releaseEligible !== false
  ) {
    throw new Error('Permissioned graph evidence identity or candidate status is invalid');
  }
  const network = requiredObject(value, 'network', 'permissioned graph evidence');
  assertExactKeys(network, ['chainId', 'name'], 'permissioned graph network');
  if (network.chainId !== 4_663 || network.name !== 'Robinhood Chain' || manifest.network.chainId !== 4_663) {
    throw new Error('Permissioned graph evidence must target the signed Robinhood mainnet release');
  }
  const sourcePins = requiredObject(value, 'sourcePins', 'permissioned graph evidence');
  if (stableJson(sourcePins) !== stableJson(PERMISSIONED_SOURCE_PINS)) {
    throw new Error('Permissioned graph evidence source pins do not match the build-bound trust root');
  }

  const permissionedDependencies = config.liquidity.permissionedDependencies;
  if (permissionedDependencies === null) throw new Error('Permissioned graph lacks configured official dependencies');
  const expectedContracts: Readonly<Record<string, readonly [string, string]>> = {
    adapterVerificationEscrow: [
      state.addresses.adapterVerificationEscrow,
      stateRuntimeHash(state, state.addresses.adapterVerificationEscrow, 'AdapterVerificationEscrow'),
    ],
    eligibilityAllowlistChecker: [
      state.addresses.eligibilityAllowlistChecker,
      stateRuntimeHash(state, state.addresses.eligibilityAllowlistChecker, 'EligibilityAllowlistChecker'),
    ],
    emergencyGuardian: [
      state.addresses.emergencyGuardian,
      stateRuntimeHash(state, state.addresses.emergencyGuardian, 'EmergencyGuardian'),
    ],
    gbxPermissionsAdapter: [
      state.addresses.gbxPermissionsAdapter,
      stateRuntimeHash(state, state.addresses.gbxPermissionsAdapter, 'UniswapPermissionsAdapter'),
    ],
    gumBallPermissionedHook: [
      state.addresses.launchGuardHook,
      stateRuntimeHash(state, state.addresses.launchGuardHook, 'GumBallPermissionedHook'),
    ],
    mixedRouteQuoterV2: [
      permissionedDependencies.mixedRouteQuoterV2.address,
      permissionedDependencies.mixedRouteQuoterV2.runtimeBytecodeHash,
    ],
    permissionedLiquidityManager: [
      state.addresses.liquidityManager,
      stateRuntimeHash(state, state.addresses.liquidityManager, 'PermissionedLiquidityManager'),
    ],
    permissionedPoolController: [
      state.addresses.permissionedPoolController,
      stateRuntimeHash(state, state.addresses.permissionedPoolController, 'PermissionedPoolController'),
    ],
    permissionedPositionManager: [
      permissionedDependencies.permissionedPositionManager.address,
      permissionedDependencies.permissionedPositionManager.runtimeBytecodeHash,
    ],
    permissionsAdapterFactory: [
      permissionedDependencies.permissionsAdapterFactory.address,
      permissionedDependencies.permissionsAdapterFactory.runtimeBytecodeHash,
    ],
    protocolTimelock: [
      state.addresses.protocolTimelock,
      stateRuntimeHash(state, state.addresses.protocolTimelock, 'ProtocolTimelock'),
    ],
    universalRouter: [
      permissionedDependencies.universalRouter.address,
      permissionedDependencies.universalRouter.runtimeBytecodeHash,
    ],
    v4Quoter: [permissionedDependencies.v4Quoter.address, permissionedDependencies.v4Quoter.runtimeBytecodeHash],
  };
  const contracts = requiredObject(value, 'contracts', 'permissioned graph evidence');
  assertExactKeys(contracts, Object.keys(expectedContracts), 'permissioned graph contracts');
  for (const [key, [address, runtimeHash]] of Object.entries(expectedContracts)) {
    assertRuntimeRecord(contracts[key], address, runtimeHash, `permissioned graph contracts.${key}`);
  }

  const graphEvidence = requiredObject(value, 'evidence', 'permissioned graph evidence');
  assertExactKeys(
    graphEvidence,
    ['independentSecurityReview', 'legalDecision', 'robinhoodForkRehearsal'],
    'permissioned graph evidence links',
  );
  assertEvidenceDescriptor(graphEvidence.independentSecurityReview, 'permissioned graph independent security review');
  assertEvidenceDescriptor(graphEvidence.legalDecision, 'permissioned graph legal decision');
  assertDescriptorEqual(
    graphEvidence.robinhoodForkRehearsal,
    manifest.releaseEvidence.permissionedPool!.robinhoodForkRehearsal,
    'permissioned graph Robinhood fork rehearsal',
  );

  const relationships = requiredObject(value, 'relationships', 'permissioned graph evidence');
  const relationshipKeys = [
    'adapterAdmin',
    'adapterFactory',
    'adapterUnderlyingToken',
    'allowListChecker',
    'allowedWrappers',
    'controllerAdapter',
    'controllerEmergencyGuardian',
    'controllerHook',
    'controllerProtocolTimelock',
    'controllerVerificationEscrow',
    'dependencyInitializer',
    'gbx',
    'graphInitialized',
    'hookAdapterFactory',
    'liquidityPositionOwner',
    'permit2',
    'poolManager',
    'positionManagerAdapterFactory',
    'swappingEnabled',
    'usdG',
    'verificationWrapper',
  ] as const;
  assertExactKeys(relationships, relationshipKeys, 'permissioned graph relationships');
  const expectedRelationships: Readonly<Record<string, string>> = {
    adapterAdmin: state.addresses.permissionedPoolController,
    adapterFactory: permissionedDependencies.permissionsAdapterFactory.address,
    adapterUnderlyingToken: state.addresses.gbx,
    allowListChecker: state.addresses.eligibilityAllowlistChecker,
    controllerAdapter: state.addresses.gbxPermissionsAdapter,
    controllerEmergencyGuardian: state.addresses.emergencyGuardian,
    controllerHook: state.addresses.launchGuardHook,
    controllerProtocolTimelock: state.addresses.protocolTimelock,
    controllerVerificationEscrow: state.addresses.adapterVerificationEscrow,
    dependencyInitializer: state.dependencyInitializer,
    gbx: state.addresses.gbx,
    hookAdapterFactory: permissionedDependencies.permissionsAdapterFactory.address,
    liquidityPositionOwner: state.addresses.liquidityManager,
    permit2: config.uniswapV4.permit2,
    poolManager: config.uniswapV4.poolManager,
    positionManagerAdapterFactory: permissionedDependencies.permissionsAdapterFactory.address,
    usdG: config.usdG,
    verificationWrapper: state.addresses.adapterVerificationEscrow,
  };
  for (const [key, expected] of Object.entries(expectedRelationships)) {
    const actual = requiredString(relationships, key, 'permissioned graph relationships');
    assertNonzeroAddress(actual, `permissioned graph relationships.${key}`);
    equalAddress(actual, expected, `permissioned graph relationship ${key}`);
  }
  if (relationships.graphInitialized !== true || relationships.swappingEnabled !== true) {
    throw new Error('Permissioned graph must be initialized with post-genesis swapping enabled');
  }
  const wrappers = requiredArray(relationships, 'allowedWrappers', 'permissioned graph relationships');
  const expectedWrappers = [
    permissionedDependencies.permissionedPositionManager.address,
    permissionedDependencies.universalRouter.address,
    permissionedDependencies.v4Quoter.address,
    permissionedDependencies.mixedRouteQuoterV2.address,
  ];
  if (
    wrappers.length !== expectedWrappers.length ||
    wrappers.some(
      (wrapper, index) => typeof wrapper !== 'string' || getAddress(wrapper) !== getAddress(expectedWrappers[index]!),
    )
  ) {
    throw new Error('Permissioned graph allowed-wrapper order does not match the configured official dependencies');
  }

  const pool = requiredObject(value, 'pool', 'permissioned graph evidence');
  assertExactKeys(pool, ['currency0', 'currency1', 'fee', 'hook', 'tickSpacing'], 'permissioned graph PoolKey');
  const currencies = [state.addresses.gbxPermissionsAdapter, config.usdG].sort((left, right) =>
    BigInt(left) < BigInt(right) ? -1 : 1,
  );
  equalAddress(requiredString(pool, 'currency0', 'permissioned graph PoolKey'), currencies[0]!, 'PoolKey currency0');
  equalAddress(requiredString(pool, 'currency1', 'permissioned graph PoolKey'), currencies[1]!, 'PoolKey currency1');
  equalAddress(
    requiredString(pool, 'hook', 'permissioned graph PoolKey'),
    state.addresses.launchGuardHook,
    'PoolKey hook',
  );
  if (pool.fee !== 3_000 || pool.tickSpacing !== 60)
    throw new Error('Permissioned graph PoolKey fee or tick spacing is invalid');
  if ((BigInt(state.addresses.launchGuardHook) & V4_ALL_HOOK_FLAGS) !== GUMBALL_PERMISSIONED_HOOK_FLAGS) {
    throw new Error('GumBallPermissionedHook address does not encode exactly 0x28c0 hook permissions');
  }
}

function assertPermissionedOfficialSourceBuild(
  value: Record<string, unknown>,
  manifest: ReleaseManifest,
  config: DeploymentConfig,
): void {
  assertExactKeys(
    value,
    ['build', 'dependencies', 'kind', 'network', 'protocol', 'schemaVersion', 'sourceArchives', 'sourcePins', 'status'],
    'permissioned official-source build evidence',
  );
  if (
    value.kind !== 'gumball-6900-permissioned-pool-official-source-build' ||
    value.protocol !== 'GUM BALL 6900' ||
    value.schemaVersion !== 1 ||
    value.status !== 'reproduced'
  ) {
    throw new Error('Permissioned official-source build evidence identity or status is invalid');
  }
  const network = requiredObject(value, 'network', 'permissioned official-source build evidence');
  assertExactKeys(network, ['chainId', 'name'], 'permissioned official-source build network');
  if (network.chainId !== 4_663 || network.name !== 'Robinhood Chain') {
    throw new Error('Permissioned official-source build evidence must bind Robinhood mainnet dependencies');
  }
  const sourcePins = requiredObject(value, 'sourcePins', 'permissioned official-source build evidence');
  if (stableJson(sourcePins) !== stableJson(PERMISSIONED_SOURCE_PINS)) {
    throw new Error('Permissioned official-source build source pins do not match the build-bound trust root');
  }

  const build = requiredObject(value, 'build', 'permissioned official-source build evidence');
  assertExactKeys(
    build,
    ['command', 'completedAt', 'compiler', 'environment', 'lockfile'],
    'permissioned source build',
  );
  requiredString(build, 'command', 'permissioned source build');
  const completedAt = Date.parse(requiredString(build, 'completedAt', 'permissioned source build'));
  const releaseCreatedAt = Date.parse(manifest.release.createdAt);
  if (!Number.isFinite(completedAt) || completedAt > releaseCreatedAt) {
    throw new Error('Permissioned official-source reproduction must complete before the release manifest is created');
  }
  const compiler = requiredObject(build, 'compiler', 'permissioned source build');
  assertExactKeys(compiler, ['settingsSha256', 'version'], 'permissioned source compiler');
  assertRawSha256(
    requiredString(compiler, 'settingsSha256', 'permissioned source compiler'),
    'compiler settings SHA-256',
  );
  if (!/^0\.8\.\d+(?:\+[0-9A-Za-z.-]+)?$/.test(requiredString(compiler, 'version', 'permissioned source compiler'))) {
    throw new Error('Permissioned source compiler version is invalid');
  }
  const environment = requiredObject(build, 'environment', 'permissioned source build');
  assertExactKeys(environment, ['image', 'imageDigest', 'platform'], 'permissioned source build environment');
  requiredString(environment, 'image', 'permissioned source build environment');
  if (
    !/^sha256:[0-9a-f]{64}$/.test(requiredString(environment, 'imageDigest', 'permissioned source build environment'))
  ) {
    throw new Error('Permissioned source build image digest is invalid');
  }
  if (environment.platform !== 'linux/amd64') throw new Error('Permissioned source build platform must be linux/amd64');
  assertEvidenceDescriptor(build.lockfile, 'permissioned source build lockfile');

  const sourceArchives = requiredObject(value, 'sourceArchives', 'permissioned official-source build evidence');
  assertExactKeys(sourceArchives, Object.keys(PERMISSIONED_SOURCE_PINS), 'permissioned source archives');
  const archiveHashes = new Set<string>();
  for (const [key, pin] of Object.entries(PERMISSIONED_SOURCE_PINS)) {
    const archive = requiredObject(sourceArchives, key, 'permissioned source archives');
    assertExactKeys(archive, ['commit', 'rawSha256', 'repository'], `permissioned source archive ${key}`);
    if (archive.commit !== pin.commit || archive.repository !== pin.repository) {
      throw new Error(`Permissioned source archive ${key} does not match its pinned upstream`);
    }
    const archiveHash = requiredString(archive, 'rawSha256', `permissioned source archive ${key}`);
    assertRawSha256(archiveHash, `${key} archive SHA-256`);
    if (archiveHashes.has(archiveHash)) throw new Error('Permissioned source archive hashes must be unique');
    archiveHashes.add(archiveHash);
  }

  const permissionedDependencies = config.liquidity.permissionedDependencies;
  if (permissionedDependencies === null) throw new Error('Permissioned source build lacks configured dependencies');
  const dependencies = requiredObject(value, 'dependencies', 'permissioned official-source build evidence');
  assertExactKeys(dependencies, Object.keys(PERMISSIONED_OFFICIAL_ARTIFACTS), 'permissioned source-build dependencies');
  const configuredDependencies = permissionedDependencies as unknown as Record<
    keyof typeof PERMISSIONED_OFFICIAL_ARTIFACTS,
    { address: string; runtimeBytecodeHash: string }
  >;
  for (const [key, expectedArtifact] of Object.entries(PERMISSIONED_OFFICIAL_ARTIFACTS)) {
    const dependency = requiredObject(dependencies, key, 'permissioned source-build dependencies');
    assertExactKeys(
      dependency,
      [
        'address',
        'artifactCreationBytecodeHash',
        'constructorArgumentsHash',
        'contractName',
        'reproducedRuntimeBytecodeHash',
        'runtimeBytecodeHash',
        'sourceCommit',
        'sourcePath',
        'sourceRepository',
      ],
      `permissioned source-build dependency ${key}`,
    );
    const configured = configuredDependencies[key as keyof typeof PERMISSIONED_OFFICIAL_ARTIFACTS];
    equalAddress(requiredString(dependency, 'address', key), configured.address, `${key} source-build address`);
    const runtimeHash = requiredString(dependency, 'runtimeBytecodeHash', key);
    const reproducedHash = requiredString(dependency, 'reproducedRuntimeBytecodeHash', key);
    assertNonzeroBytes32(runtimeHash, `${key} runtime bytecode hash`);
    assertNonzeroBytes32(reproducedHash, `${key} reproduced runtime bytecode hash`);
    equalHash(runtimeHash, configured.runtimeBytecodeHash, `${key} configured runtime bytecode`);
    equalHash(reproducedHash, runtimeHash, `${key} reproduced runtime bytecode`);
    assertNonzeroBytes32(
      requiredString(dependency, 'artifactCreationBytecodeHash', key),
      `${key} artifact creation bytecode hash`,
    );
    assertNonzeroBytes32(
      requiredString(dependency, 'constructorArgumentsHash', key),
      `${key} constructor arguments hash`,
    );
    for (const field of ['contractName', 'sourceCommit', 'sourcePath', 'sourceRepository'] as const) {
      if (dependency[field] !== expectedArtifact[field]) {
        throw new Error(`Permissioned source-build dependency ${key} ${field} does not match its official source pin`);
      }
    }
  }
}

function assertPermissionedForkRehearsal(
  value: Record<string, unknown>,
  manifest: ReleaseManifest,
  nowMs: number,
): void {
  assertExactKeys(
    value,
    [
      'adapter',
      'authorizationEligible',
      'block',
      'evidence',
      'genesis',
      'kind',
      'network',
      'pool',
      'protocol',
      'schemaVersion',
      'state',
      'status',
      'swapActivation',
    ],
    'permissioned Robinhood fork rehearsal',
  );
  if (
    value.kind !== 'gumball-6900-permissioned-pool-robinhood-fork-rehearsal' ||
    value.protocol !== 'GUM BALL 6900' ||
    value.schemaVersion !== 1 ||
    value.status !== 'passed' ||
    value.authorizationEligible !== true
  ) {
    throw new Error('Permissioned Robinhood fork rehearsal identity or pass status is invalid');
  }
  const network = requiredObject(value, 'network', 'permissioned Robinhood fork rehearsal');
  assertExactKeys(network, ['chainId', 'name'], 'permissioned fork network');
  if (network.chainId !== 46_630 || network.name !== 'Robinhood Chain Testnet') {
    throw new Error('Permissioned fork rehearsal must target Robinhood Chain Testnet');
  }

  const block = requiredObject(value, 'block', 'permissioned Robinhood fork rehearsal');
  assertExactKeys(
    block,
    ['confirmations', 'expiresAt', 'hash', 'number', 'observedAt', 'parentHash'],
    'permissioned fork observation',
  );
  const observedAt = Date.parse(requiredString(block, 'observedAt', 'permissioned fork observation'));
  const expiresAt = Date.parse(requiredString(block, 'expiresAt', 'permissioned fork observation'));
  if (
    !Number.isFinite(observedAt) ||
    !Number.isFinite(expiresAt) ||
    observedAt > nowMs ||
    expiresAt <= nowMs ||
    expiresAt <= observedAt ||
    expiresAt - observedAt > 24 * 60 * 60 * 1_000
  ) {
    throw new Error('Permissioned fork rehearsal is future-dated, expired, or valid for longer than 24 hours');
  }
  if (requiredUnsigned(block.confirmations, 'permissioned fork confirmations', true) < 64n) {
    throw new Error('Permissioned fork rehearsal has fewer than 64 confirmations');
  }
  requiredUnsigned(block.number, 'permissioned fork block number', true);
  assertNonzeroBytes32(requiredString(block, 'hash', 'permissioned fork observation'), 'permissioned fork block hash');
  assertNonzeroBytes32(
    requiredString(block, 'parentHash', 'permissioned fork observation'),
    'permissioned fork parent block hash',
  );

  const evidence = requiredObject(value, 'evidence', 'permissioned Robinhood fork rehearsal');
  assertExactKeys(
    evidence,
    ['deploymentConfig', 'deploymentState', 'officialSourceBuild', 'permissionedPoolGraph'],
    'permissioned fork evidence links',
  );
  for (const key of ['deploymentConfig', 'deploymentState', 'permissionedPoolGraph'] as const) {
    assertEvidenceDescriptor(evidence[key], `permissioned fork evidence.${key}`);
  }
  assertDescriptorEqual(
    evidence.officialSourceBuild,
    manifest.releaseEvidence.permissionedPool!.officialSourceBuild,
    'permissioned fork official-source build',
  );

  const state = requiredObject(value, 'state', 'permissioned Robinhood fork rehearsal');
  assertExactKeys(state, ['configHash', 'phase', 'sourceCommit'], 'permissioned fork state');
  assertNonzeroBytes32(requiredString(state, 'configHash', 'permissioned fork state'), 'permissioned fork config hash');
  if (state.phase !== 'GENESIS_SETTLED' || state.sourceCommit !== manifest.release.gitCommit) {
    throw new Error('Permissioned fork rehearsal is not settled from the exact release source commit');
  }

  const genesis = requiredObject(value, 'genesis', 'permissioned Robinhood fork rehearsal');
  assertExactKeys(
    genesis,
    [
      'activePositionCount',
      'adapterPrincipal',
      'claimsAllocation',
      'cumulativeMinted',
      'liquidityAllocation',
      'managerResidual',
      'positions',
      'totalSupply',
    ],
    'permissioned fork genesis',
  );
  if (genesis.activePositionCount !== 4) throw new Error('Permissioned fork genesis must have exactly four positions');
  if (
    requiredUnsigned(genesis.cumulativeMinted, 'permissioned fork cumulative mint', true) !== GENESIS_TOTAL_GBX ||
    requiredUnsigned(genesis.totalSupply, 'permissioned fork total supply', true) !== GENESIS_TOTAL_GBX ||
    requiredUnsigned(genesis.claimsAllocation, 'permissioned fork claims allocation', true) !== GENESIS_CLAIMS_GBX ||
    requiredUnsigned(genesis.liquidityAllocation, 'permissioned fork liquidity allocation', true) !==
      GENESIS_LIQUIDITY_GBX
  ) {
    throw new Error('Permissioned fork rehearsal genesis allocations do not match 100M/80M/20M GBX');
  }
  const adapterPrincipal = requiredUnsigned(genesis.adapterPrincipal, 'permissioned fork adapter principal', true);
  const managerResidual = requiredUnsigned(genesis.managerResidual, 'permissioned fork manager residual');
  if (adapterPrincipal + managerResidual !== GENESIS_LIQUIDITY_GBX) {
    throw new Error('Permissioned fork principal and residual do not conserve 20,000,000 GBX');
  }
  const positions = requiredArray(genesis, 'positions', 'permissioned fork genesis');
  if (positions.length !== 4) throw new Error('Permissioned fork evidence must record exactly four positions');
  let recordedPrincipal = 0n;
  const tokenIds = new Set<string>();
  for (const [index, positionValue] of positions.entries()) {
    assertObject(positionValue, `permissioned fork position ${index}`);
    assertExactKeys(positionValue, ['exists', 'gbxPrincipal', 'tokenId'], `permissioned fork position ${index}`);
    if (positionValue.exists !== true) throw new Error(`Permissioned fork position ${index} is not active`);
    recordedPrincipal += requiredUnsigned(
      positionValue.gbxPrincipal,
      `permissioned fork position ${index} principal`,
      true,
    );
    const tokenId = requiredString(positionValue, 'tokenId', `permissioned fork position ${index}`);
    requiredUnsigned(tokenId, `permissioned fork position ${index} token ID`, true);
    if (tokenIds.has(tokenId)) throw new Error('Permissioned fork position token IDs are not unique');
    tokenIds.add(tokenId);
  }
  if (recordedPrincipal !== adapterPrincipal) {
    throw new Error('Permissioned fork position principal does not equal adapter principal');
  }

  const adapter = requiredObject(value, 'adapter', 'permissioned Robinhood fork rehearsal');
  assertExactKeys(
    adapter,
    [
      'address',
      'admin',
      'allowListChecker',
      'poolManagerBalance',
      'permissionedPoolController',
      'swappingEnabled',
      'totalSupply',
      'underlyingBalance',
      'underlyingGBX',
    ],
    'permissioned fork adapter',
  );
  for (const key of ['address', 'admin', 'allowListChecker', 'permissionedPoolController', 'underlyingGBX'] as const) {
    assertNonzeroAddress(requiredString(adapter, key, 'permissioned fork adapter'), `permissioned fork adapter.${key}`);
  }
  equalAddress(
    requiredString(adapter, 'admin', 'permissioned fork adapter'),
    requiredString(adapter, 'permissionedPoolController', 'permissioned fork adapter'),
    'permissioned fork adapter admin/controller',
  );
  if (adapter.swappingEnabled !== true) throw new Error('Permissioned fork adapter swaps are not enabled');
  for (const [key, label] of [
    ['totalSupply', 'supply'],
    ['underlyingBalance', 'underlying backing'],
    ['poolManagerBalance', 'PoolManager balance'],
  ] as const) {
    if (requiredUnsigned(adapter[key], `permissioned fork adapter ${label}`, true) !== adapterPrincipal) {
      throw new Error(`Permissioned fork adapter ${label} does not equal its position principal`);
    }
  }

  const pool = requiredObject(value, 'pool', 'permissioned Robinhood fork rehearsal');
  assertExactKeys(
    pool,
    ['currency0', 'currency1', 'fee', 'hook', 'hookPermissionBits', 'initialized', 'poolId', 'tickSpacing', 'usdG'],
    'permissioned fork PoolKey',
  );
  const currency0 = requiredString(pool, 'currency0', 'permissioned fork PoolKey');
  const currency1 = requiredString(pool, 'currency1', 'permissioned fork PoolKey');
  const hook = requiredString(pool, 'hook', 'permissioned fork PoolKey');
  const forkUsdG = requiredString(pool, 'usdG', 'permissioned fork PoolKey');
  for (const [label, address] of [
    ['currency0', currency0],
    ['currency1', currency1],
    ['hook', hook],
    ['usdG', forkUsdG],
  ] as const) {
    assertNonzeroAddress(address, `permissioned fork PoolKey ${label}`);
  }
  if (
    BigInt(currency0) >= BigInt(currency1) ||
    pool.fee !== 3_000 ||
    pool.tickSpacing !== 60 ||
    pool.initialized !== true ||
    pool.hookPermissionBits !== '0x28c0' ||
    (BigInt(hook) & V4_ALL_HOOK_FLAGS) !== GUMBALL_PERMISSIONED_HOOK_FLAGS
  ) {
    throw new Error('Permissioned fork PoolKey or hook permissions are invalid');
  }
  const expectedForkCurrencies = [requiredString(adapter, 'address', 'permissioned fork adapter'), forkUsdG].sort(
    (left, right) => (BigInt(left) < BigInt(right) ? -1 : 1),
  );
  if (
    getAddress(currency0) !== getAddress(expectedForkCurrencies[0]!) ||
    getAddress(currency1) !== getAddress(expectedForkCurrencies[1]!)
  ) {
    throw new Error('Permissioned fork PoolKey does not contain the adapter and USDG');
  }
  assertNonzeroBytes32(requiredString(pool, 'poolId', 'permissioned fork PoolKey'), 'permissioned fork pool ID');

  const swapActivation = requiredObject(value, 'swapActivation', 'permissioned Robinhood fork rehearsal');
  assertExactKeys(
    swapActivation,
    [
      'bootstrapEnableConsumed',
      'permissionlessSwapSucceeded',
      'permissionlessSwapTransactionHash',
      'swappingEnabled',
      'transactionHash',
    ],
    'permissioned fork swap activation',
  );
  if (
    swapActivation.bootstrapEnableConsumed !== true ||
    swapActivation.permissionlessSwapSucceeded !== true ||
    swapActivation.swappingEnabled !== true
  ) {
    throw new Error('Permissioned fork rehearsal did not activate and exercise permissionless post-genesis swaps');
  }
  assertNonzeroBytes32(
    requiredString(swapActivation, 'transactionHash', 'permissioned fork swap activation'),
    'permissioned fork swap activation transaction',
  );
  const permissionlessSwapTransactionHash = requiredString(
    swapActivation,
    'permissionlessSwapTransactionHash',
    'permissioned fork swap activation',
  );
  assertNonzeroBytes32(permissionlessSwapTransactionHash, 'permissioned fork permissionless swap transaction');
  if (permissionlessSwapTransactionHash === swapActivation.transactionHash) {
    throw new Error('Permissioned fork activation and permissionless swap transaction hashes must be distinct');
  }
}

function assertPermissionedReleaseEvidence(
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  state: DeploymentState,
  evidenceBytes: PermissionedPoolReleaseEvidenceBytes | undefined,
  nowMs: number,
): void {
  const descriptor = manifest.releaseEvidence.permissionedPool;
  if (descriptor === undefined || evidenceBytes === undefined) {
    throw new Error('Schema v2 permissioned release requires graph, official-source build, and Robinhood fork bytes');
  }
  assertObject(descriptor, 'permissioned release evidence descriptor');
  assertExactKeys(
    descriptor as unknown as Record<string, unknown>,
    ['graph', 'officialSourceBuild', 'robinhoodForkRehearsal'],
    'permissioned release evidence descriptor',
  );
  for (const key of ['graph', 'officialSourceBuild', 'robinhoodForkRehearsal'] as const) {
    assertEvidenceDescriptor(descriptor[key], `permissioned release evidence descriptor.${key}`);
  }
  if (
    rawSha256(evidenceBytes.graphBytes) !== descriptor.graph.rawSha256 ||
    rawSha256(evidenceBytes.officialSourceBuildBytes) !== descriptor.officialSourceBuild.rawSha256 ||
    rawSha256(evidenceBytes.robinhoodForkRehearsalBytes) !== descriptor.robinhoodForkRehearsal.rawSha256
  ) {
    throw new Error('Permissioned release evidence bytes do not match the signed manifest descriptors');
  }
  const signedDescriptors = [descriptor.graph, descriptor.officialSourceBuild, descriptor.robinhoodForkRehearsal];
  const descriptorPaths = signedDescriptors.map(({ path }) => path);
  const descriptorHashes = signedDescriptors.map(({ rawSha256 }) => rawSha256);
  if (new Set(descriptorPaths).size !== 3 || new Set(descriptorHashes).size !== 3) {
    throw new Error('Permissioned release evidence descriptors must use distinct files and hashes');
  }
  const graph = parseEvidenceJson(evidenceBytes.graphBytes, 'permissioned graph evidence');
  const sourceBuild = parseEvidenceJson(
    evidenceBytes.officialSourceBuildBytes,
    'permissioned official-source build evidence',
  );
  const fork = parseEvidenceJson(evidenceBytes.robinhoodForkRehearsalBytes, 'permissioned Robinhood fork rehearsal');
  assertPermissionedGraphEvidence(graph, manifest, config, state);
  assertPermissionedOfficialSourceBuild(sourceBuild, manifest, config);
  assertPermissionedForkRehearsal(fork, manifest, nowMs);
}

function fixedLogicalAddresses(state: DeploymentState, permissioned: boolean): Array<readonly [string, string]> {
  const a = state.addresses;
  const common: Array<readonly [string, string]> = [
    ['ProtocolTimelock', a.protocolTimelock],
    ['EmergencyGuardian', a.emergencyGuardian],
    ['EligibilityModule', a.eligibilityModule],
    ['GBXToken', a.gbx],
    ['StrategyDeployer', a.strategyDeployer],
    ['EmissionController', a.emissionController],
    ['GenesisClaims', a.genesisClaims],
    ['MiningClaims', a.miningClaims],
    ['AssetRegistry', a.assetRegistry],
    ['AllocationVoter', a.allocationVoter],
    ['GumBallVault', a.gumBallVault],
    ['StakedGBX', a.stakedGBX],
    ['GumBallRouter', a.gumBallRouter],
    ['MiningPool', a.miningPool],
    ['GenesisBootstrap', a.genesisBootstrap],
    ['RevenueRouter', a.revenueRouter],
    ['HoldUSDGStrategy', a.holdUSDGStrategy],
    ['BuybackBurnStrategy', a.buybackBurnStrategy],
  ];
  if (permissioned) {
    common.push(
      ['EligibilityAllowlistChecker', a.eligibilityAllowlistChecker],
      ['PermissionedPoolController', a.permissionedPoolController],
      ['UniswapPermissionsAdapter', a.gbxPermissionsAdapter],
      ['GumBallPermissionedHook', a.launchGuardHook],
    );
  } else {
    common.push(['LaunchGuardHook', a.launchGuardHook]);
  }
  common.push(['GenesisLiquidityCalculator', a.genesisLiquidityCalculator]);
  if (permissioned) common.push(['AdapterVerificationEscrow', a.adapterVerificationEscrow]);
  common.push([permissioned ? 'PermissionedLiquidityManager' : 'LiquidityManager', a.liquidityManager]);
  common.push(['GumBallLens', a.lens]);
  return common;
}

function requireManifestAssetByAddress(manifest: ReleaseManifest, address: string, label: string): ReleaseAssetRecord {
  const matches = manifest.assets.filter((asset) => getAddress(asset.address) === getAddress(address));
  if (matches.length !== 1) throw new Error(`${label} must have exactly one manifest asset record`);
  return matches[0]!;
}

function expectedLogicalAddresses(
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  state: DeploymentState,
): Array<readonly [string, string]> {
  const records = fixedLogicalAddresses(state, config.liquidity.mode === 'permissioned');
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    const asset = requireManifestAssetByAddress(manifest, config.assets.tokens[index]!, `target asset ${index}`);
    records.push([`AcquisitionStrategy:${asset.key}`, state.addresses.acquisitionStrategies[index]!]);
    records.push([`ManagerRewards:${asset.key}`, state.addresses.managerRewards[index]!]);
  }
  return records;
}

function assertSnapshotHashes(
  manifest: ReleaseManifest,
  assetCandidateBytes: Uint8Array,
  configBytes: Uint8Array,
  stateBytes: Uint8Array,
): void {
  if (
    manifest.releaseEvidence.assetCandidate === null ||
    rawSha256(assetCandidateBytes) !== manifest.releaseEvidence.assetCandidate.rawSha256
  ) {
    throw new Error('Prepared reviewed asset-candidate bytes do not match the signed release manifest');
  }
  if (rawSha256(configBytes) !== manifest.releaseEvidence.deploymentConfig.rawSha256) {
    throw new Error('Prepared deployment config bytes do not match the signed release manifest');
  }
  if (rawSha256(stateBytes) !== manifest.releaseEvidence.deploymentState.rawSha256) {
    throw new Error('Prepared deployment state bytes do not match the signed release manifest');
  }
}

function assertAssetReviewBinding(manifest: ReleaseManifest, config: DeploymentConfig): void {
  if (config.assetReview === null || manifest.releaseEvidence.assetCandidate === null) {
    throw new Error('Mainnet release lacks reviewed asset-candidate evidence');
  }
  if (
    config.assetReview.path !== manifest.releaseEvidence.assetCandidate.path ||
    config.assetReview.rawSha256 !== manifest.releaseEvidence.assetCandidate.rawSha256
  ) {
    throw new Error('Reviewed asset candidate does not match the signed deployment config');
  }
}

export function assertReleaseManifestObservation(
  manifest: ReleaseManifest,
  chainId: bigint,
  nowMs: number,
): ReleaseObservation {
  assertObject(manifest.release, 'release');
  assertObject(manifest.network, 'network');
  assertObject(manifest.releaseEvidence, 'releaseEvidence');
  assertObject(manifest.releaseEvidence.observation, 'releaseEvidence.observation');
  if (manifest.kind !== 'gumball-6900-deployment-manifest' || manifest.protocol !== 'GUM BALL 6900') {
    throw new Error('Release manifest identity is invalid');
  }
  if (manifest.release.status !== 'release-approved' || BigInt(manifest.network.chainId) !== chainId) {
    throw new Error('Release manifest status or chain does not match verification target');
  }
  const observation = manifest.releaseEvidence.observation;
  if (!/^[1-9][0-9]*$/.test(observation.blockNumber) || !/^0x[0-9a-f]{64}$/.test(observation.blockHash)) {
    throw new Error('Release manifest observation block is invalid');
  }
  const observedAt = Date.parse(observation.observedAt);
  const createdAt = Date.parse(manifest.release.createdAt);
  const expiresAt = Date.parse(observation.expiresAt);
  if (
    !Number.isFinite(observedAt) ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    observedAt > createdAt ||
    createdAt > nowMs ||
    observedAt > nowMs ||
    expiresAt <= nowMs ||
    expiresAt <= observedAt ||
    expiresAt - observedAt > 24 * 60 * 60 * 1_000
  ) {
    throw new Error('Release manifest observation is future-dated, expired, or longer than 24 hours');
  }
  return observation;
}

function assertAssetAndExternalBindings(
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  state: DeploymentState,
  observationBlock: bigint,
): void {
  const assetByAddress = mapUniqueBy(manifest.assets, (asset) => getAddress(asset.address), 'manifest assets');
  const usdG = assetByAddress.get(getAddress(config.usdG));
  if (
    usdG === undefined ||
    usdG.key !== 'USDG' ||
    usdG.decimals !== config.usdGDecimals ||
    usdG.registryStatus !== 'NOT_APPLICABLE' ||
    usdG.uid !== null ||
    usdG.uiMultiplier !== null ||
    !usdG.acquisitionEnabled ||
    !usdG.redemptionEnabled
  ) {
    throw new Error('Manifest USDG asset does not match deployment config');
  }
  const canonicalTokenDependencies = config.canonicalTokenDependencies;
  if (canonicalTokenDependencies !== null) {
    equalAddress(usdG.address, canonicalTokenDependencies.usdG.address, 'Manifest canonical USDG address');
    const weth = assetByAddress.get(getAddress(canonicalTokenDependencies.weth.address));
    if (weth === undefined || weth.key !== 'WETH') {
      throw new Error('Manifest lacks the configured canonical WETH asset');
    }
    assertCanonicalTokenProxyBinding(usdG, weth, canonicalTokenDependencies);
  }
  if (manifest.assets.length !== config.assets.tokens.length + 1) {
    throw new Error('Manifest asset set does not exactly match deployment config');
  }
  const wrappedBtcBridgeDependency = config.wrappedBtcBridgeDependency;
  if (manifest.network.chainId === 4_663 && wrappedBtcBridgeDependency === null) {
    throw new Error('Robinhood mainnet release config lacks wrapped-BTC bridge dependency evidence');
  }
  let wrappedBtcBound = false;
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    const asset = assetByAddress.get(getAddress(config.assets.tokens[index]!));
    const canonical = asset === undefined ? undefined : CANONICAL_TARGET_ASSET_METADATA[asset.key];
    if (
      asset === undefined ||
      asset.decimals !== config.assets.decimals[index] ||
      canonical === undefined ||
      canonical.isStockToken !== config.assets.isStockToken[index] ||
      id(canonical.symbol).toLowerCase() !== config.assets.symbolHashes[index]!.toLowerCase() ||
      asset.runtimeBytecodeHash.toLowerCase() !== config.assets.runtimeBytecodeHashes[index]!.toLowerCase() ||
      asset.acquisitionEnabled !== true ||
      asset.redemptionEnabled !== true
    ) {
      throw new Error(`Manifest target asset ${index} does not match deployment config`);
    }
    if (canonical.isStockToken) {
      if (
        asset.registryStatus !== 'ASSET_STATUS_ACTIVE' ||
        asset.uid !== config.assets.assetIds[index] ||
        asset.uiMultiplier !== config.assets.uiMultipliers[index]
      ) {
        throw new Error(`Manifest stock-token identity ${index} does not match deployment config`);
      }
      const dependency = config.stockTokenDependency;
      if (
        dependency === null ||
        asset.proxyEvidence === undefined ||
        asset.proxyEvidence === null ||
        asset.proxyEvidence.kind !== 'eip1967-beacon' ||
        getAddress(asset.proxyEvidence.beaconAddress) !== getAddress(dependency.beaconAddress) ||
        asset.proxyEvidence.beaconRuntimeBytecodeHash.toLowerCase() !==
          dependency.beaconRuntimeBytecodeHash.toLowerCase() ||
        getAddress(asset.proxyEvidence.implementationAddress) !== getAddress(dependency.implementationAddress) ||
        asset.proxyEvidence.implementationRuntimeBytecodeHash.toLowerCase() !==
          dependency.implementationRuntimeBytecodeHash.toLowerCase()
      ) {
        throw new Error(`Manifest stock-token proxy dependency ${index} does not match deployment config`);
      }
    } else {
      if (asset.key === 'WRAPPED_BTC') {
        if (wrappedBtcBridgeDependency === null) {
          throw new Error('Manifest WBTC is not backed by configured bridge dependency evidence');
        }
        assertWrappedBtcBridgeBinding(asset, wrappedBtcBridgeDependency);
        wrappedBtcBound = true;
      }
      if (asset.registryStatus !== 'NOT_APPLICABLE' || asset.uid !== null || asset.uiMultiplier !== null) {
        throw new Error(`Manifest non-stock-token identity ${index} does not match deployment config`);
      }
    }
  }
  if (wrappedBtcBridgeDependency !== null && !wrappedBtcBound) {
    throw new Error('Deployment config WBTC bridge dependency has no matching WBTC target asset');
  }

  const externalByKey = mapUniqueBy(manifest.externalContracts, (record) => record.key, 'external contracts');
  const expectedConfigExternals: Array<readonly [string, string]> = [
    ['USDG', config.usdG],
    ['uniswapV4.poolManager', config.uniswapV4.poolManager],
    ['uniswapV4.positionManager', config.uniswapV4.positionManager],
    ['uniswapV4.permit2', config.uniswapV4.permit2],
  ];
  if (config.liquidity.permissionedDependencies !== null) {
    const dependencies = config.liquidity.permissionedDependencies;
    expectedConfigExternals.push(
      ['uniswapV4.permissionsAdapterFactory', dependencies.permissionsAdapterFactory.address],
      ['uniswapV4.universalRouter', dependencies.universalRouter.address],
      ['uniswapV4.quoter', dependencies.v4Quoter.address],
      ['uniswapV4.mixedRouteQuoterV2', dependencies.mixedRouteQuoterV2.address],
    );
  }
  for (const [key, address] of expectedConfigExternals) {
    const external = externalByKey.get(key);
    if (external === undefined) throw new Error(`Manifest lacks config-bound external contract ${key}`);
    equalAddress(external.address, address, `external contract ${key}`);
  }
  for (const external of manifest.externalContracts) {
    if (BigInt(external.verifiedAtBlock) !== observationBlock) {
      throw new Error(`External contract ${external.key} was not recorded at the signed observation block`);
    }
  }
  for (const asset of manifest.assets) {
    if (asset.proxyEvidence !== undefined && asset.proxyEvidence !== null) {
      if (BigInt(asset.proxyEvidence.verifiedAtBlock) !== observationBlock) {
        throw new Error(`Asset ${asset.key} proxy evidence was not recorded at the signed observation block`);
      }
    }
  }

  const externalStateByAddress = mapUniqueBy(
    state.contracts.filter((record) => record.external),
    (record) => getAddress(record.address),
    'external deployment-state records',
  );
  for (const [key, address] of expectedConfigExternals) {
    const stateRecord = externalStateByAddress.get(getAddress(address));
    const manifestRecord = externalByKey.get(key)!;
    if (stateRecord === undefined || stateRecord.runtimeCodeHash !== manifestRecord.runtimeBytecodeHash) {
      throw new Error(`External contract ${key} does not match the deployment state`);
    }
  }
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    const address = config.assets.tokens[index]!;
    const stateRecord = externalStateByAddress.get(getAddress(address));
    const asset = assetByAddress.get(getAddress(address))!;
    if (stateRecord === undefined || stateRecord.runtimeCodeHash !== asset.runtimeBytecodeHash) {
      throw new Error(`Target asset ${index} does not match the deployment state`);
    }
  }
}

function assertRoleBindings(manifest: ReleaseManifest, config: DeploymentConfig, state: DeploymentState): void {
  equalAddress(manifest.roles.deployer, state.dependencyInitializer, 'manifest deployer');
  equalAddress(manifest.roles.protocolTimelock, state.addresses.protocolTimelock, 'manifest protocol timelock');
  equalAddress(
    manifest.roles.protocolTimelockMultisig,
    config.roles.protocolTimelockMultisig,
    'manifest protocol-timelock multisig',
  );
  equalAddress(
    manifest.roles.emergencyGuardianMultisig,
    config.roles.emergencyGuardianOperator,
    'manifest emergency-guardian multisig',
  );
  if (!manifest.roles.deployerPrivilegesRenouncedOrIrrelevant) {
    throw new Error('Manifest does not close deployer privileges');
  }
  if (manifest.compliance.eligibilityModule === null) {
    throw new Error('Release manifest lacks the selected eligibility module');
  }
  equalAddress(manifest.compliance.eligibilityModule, state.addresses.eligibilityModule, 'manifest eligibility module');

  const manifestHolders = mapUniqueBy(
    manifest.compliance.gbxContractHolders,
    (holder) => holder.role,
    'manifest GBX contract holders',
  );
  if (manifestHolders.size !== state.gbxContractHolders.length) {
    throw new Error('Manifest GBX contract-holder set does not match deployment state');
  }
  for (const expected of state.gbxContractHolders) {
    const actual = manifestHolders.get(expected.role);
    if (actual === undefined || actual.rationale !== expected.rationale) {
      throw new Error(`Manifest GBX contract holder ${expected.role} does not match deployment state`);
    }
    equalAddress(actual.address, expected.address, `manifest GBX contract holder ${expected.role}`);
  }
}

function assertProtocolAdminSafeBinding(
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  observation: ReleaseObservation,
): void {
  if (config.protocolAdminSafe === null) throw new Error('Mainnet release config lacks protocol-admin Safe identity');
  const evidence = manifest.releaseEvidence.protocolAdminSafe;
  assertSafeControlPlaneIdentity(evidence, config.protocolAdminSafe, 'Manifest protocol-admin Safe');
  if (evidence.network.chainId !== config.network.chainId || evidence.network.name !== config.network.name) {
    throw new Error('Manifest protocol-admin Safe evidence network does not match config');
  }
  equalAddress(evidence.safeAddress, manifest.roles.protocolTimelockMultisig, 'manifest protocol-admin Safe');
  if (
    evidence.block.number !== observation.blockNumber ||
    evidence.block.hash.toLowerCase() !== observation.blockHash.toLowerCase()
  ) {
    throw new Error('Manifest protocol-admin Safe evidence does not use the signed observation block');
  }
}

function assertEmergencyGuardianSafeBinding(
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  observation: ReleaseObservation,
): void {
  if (config.emergencyGuardianSafe === null) throw new Error('Mainnet release config lacks guardian Safe identity');
  const evidence = manifest.releaseEvidence.emergencyGuardianSafe;
  assertSafeControlPlaneIdentity(evidence, config.emergencyGuardianSafe, 'Manifest emergency-guardian Safe');
  if (evidence.network.chainId !== config.network.chainId || evidence.network.name !== config.network.name) {
    throw new Error('Manifest emergency-guardian Safe evidence network does not match config');
  }
  equalAddress(evidence.safeAddress, manifest.roles.emergencyGuardianMultisig, 'manifest emergency-guardian Safe');
  if (
    evidence.block.number !== observation.blockNumber ||
    evidence.block.hash.toLowerCase() !== observation.blockHash.toLowerCase()
  ) {
    throw new Error('Manifest emergency-guardian Safe evidence does not use the signed observation block');
  }
  if (getAddress(evidence.safeAddress) === getAddress(manifest.releaseEvidence.protocolAdminSafe.safeAddress)) {
    throw new Error('Manifest protocol-admin and emergency-guardian Safe roles are not distinct');
  }
}

function stateTransactionHashes(state: DeploymentState): Record<string, string> {
  return Object.fromEntries(Object.entries(state.transactions).map(([key, record]) => [key, record.hash]));
}

function assertDeploymentBindings(
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  state: DeploymentState,
  observationBlock: bigint,
): Map<string, ReleaseDeployedContract> {
  const logicalAddresses = expectedLogicalAddresses(manifest, config, state);
  const expectedByName = mapUniqueBy(logicalAddresses, ([name]) => name, 'expected logical deployments');
  const manifestByName = mapUniqueBy(manifest.deployedContracts, (record) => record.name, 'manifest deployments');
  if (manifestByName.size !== expectedByName.size) {
    throw new Error('Manifest deployment graph does not exactly match deployment state');
  }
  const nonexternalByAddress = mapUniqueBy(
    state.contracts.filter((record) => !record.external),
    (record) => getAddress(record.address),
    'nonexternal deployment-state records',
  );
  if (nonexternalByAddress.size !== expectedByName.size) {
    throw new Error('Deployment state has an unexpected nonexternal contract set');
  }
  if (stableJson(manifest.transactions) !== stableJson(stateTransactionHashes(state))) {
    throw new Error('Signed manifest transaction map does not exactly match deployment state');
  }

  for (const [name, expectedAddress] of logicalAddresses) {
    const manifestRecord = manifestByName.get(name);
    if (manifestRecord === undefined) throw new Error(`Manifest lacks deployment ${name}`);
    equalAddress(manifestRecord.address, expectedAddress, `manifest deployment ${name}`);
    const stateRecord = nonexternalByAddress.get(getAddress(expectedAddress));
    if (stateRecord === undefined) throw new Error(`Deployment state lacks nonexternal contract ${name}`);
    if (
      manifestRecord.contractName !== stateRecord.contractName ||
      manifestRecord.blockNumber !== String(stateRecord.blockNumber) ||
      manifestRecord.transactionHash !== stateRecord.deploymentTransactionHash ||
      manifestRecord.runtimeBytecodeHash !== stateRecord.runtimeCodeHash ||
      BigInt(manifestRecord.blockNumber) > observationBlock
    ) {
      throw new Error(`Manifest deployment ${name} does not match deployment-state provenance`);
    }
    if (manifest.transactions[manifestRecord.transactionKey] !== stateRecord.deploymentTransactionHash) {
      throw new Error(`Manifest deployment ${name} is not linked to its exact state transaction`);
    }
    const constructorRecord = manifest.constructorParameters[manifestRecord.constructorParametersKey];
    if (
      constructorRecord === undefined ||
      stableJson(constructorRecord.arguments) !== stableJson(stateRecord.constructorArguments)
    ) {
      throw new Error(`Manifest deployment ${name} constructor arguments do not match deployment state`);
    }
  }

  const hookName = config.liquidity.mode === 'permissioned' ? 'GumBallPermissionedHook' : 'LaunchGuardHook';
  const hook = manifestByName.get(hookName);
  if (
    hook === undefined ||
    hook.create2SaltKey === null ||
    Object.keys(manifest.create2Salts).length !== 1 ||
    manifest.create2Salts[hook.create2SaltKey] !== state.hookSalt
  ) {
    throw new Error(`Manifest ${hookName} CREATE2 salt does not match deployment state`);
  }
  for (const record of manifest.deployedContracts) {
    if (record.name !== hookName && record.create2SaltKey !== null) {
      throw new Error(`Unexpected CREATE2 salt on ${record.name}`);
    }
  }
  return manifestByName;
}

/**
 * Independently binds prepared raw snapshots to the signed manifest and then binds every manifest
 * identity to the deployment config/state. Source-artifact and receipt checks happen online next.
 */
export function assertReleaseManifestMatchesSnapshots(
  manifestValue: unknown,
  config: DeploymentConfig,
  state: DeploymentState,
  assetCandidateBytes: Uint8Array,
  configBytes: Uint8Array,
  stateBytes: Uint8Array,
  chainId: bigint,
  nowMs = Date.now(),
  permissionedEvidence?: PermissionedPoolReleaseEvidenceBytes,
): {
  manifest: ReleaseManifest;
  manifestByName: Map<string, ReleaseDeployedContract>;
  observation: ReleaseObservation;
} {
  assertObject(manifestValue, 'release manifest');
  const manifest = manifestValue as unknown as ReleaseManifest;
  if (state.phase !== 'GENESIS_SETTLED') {
    throw new Error(`Release-approved deployment state must be GENESIS_SETTLED, received ${state.phase}`);
  }
  if (manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2) {
    throw new Error('Release manifest schemaVersion must be 1 or 2');
  }
  if (config.liquidity.mode === 'permissioned' && manifest.schemaVersion !== 2) {
    throw new Error(
      'Release manifest schema v1 cannot authorize the permissioned successor graph; schema v2 evidence is required',
    );
  }
  if (config.liquidity.mode !== 'permissioned' && manifest.schemaVersion !== 1) {
    throw new Error('Release manifest schema v2 is reserved for the permissioned successor graph');
  }
  assertObject(manifest.releaseEvidence, 'releaseEvidence');
  assertObject(manifest.releaseEvidence.deploymentConfig, 'releaseEvidence.deploymentConfig');
  assertObject(manifest.releaseEvidence.deploymentState, 'releaseEvidence.deploymentState');
  assertObject(manifest.releaseEvidence.assetCandidate, 'releaseEvidence.assetCandidate');
  assertObject(manifest.releaseEvidence.observation, 'releaseEvidence.observation');
  if (
    !Array.isArray(manifest.assets) ||
    !Array.isArray(manifest.deployedContracts) ||
    !Array.isArray(manifest.externalContracts) ||
    !Array.isArray(manifest.compliance?.gbxContractHolders)
  ) {
    throw new Error('Release manifest graph collections are invalid');
  }
  assertObject(manifest.constructorParameters, 'constructorParameters');
  assertObject(manifest.create2Salts, 'create2Salts');
  assertObject(manifest.roles, 'roles');
  assertObject(manifest.transactions, 'transactions');
  if (config.liquidity.mode === 'permissioned') {
    assertPermissionedReleaseEvidence(manifest, config, state, permissionedEvidence, nowMs);
  } else if (manifest.releaseEvidence.permissionedPool !== undefined) {
    throw new Error('Schema v1 release cannot carry permissioned-pool evidence');
  }
  assertSnapshotHashes(manifest, assetCandidateBytes, configBytes, stateBytes);
  assertAssetReviewBinding(manifest, config);
  const observation = assertReleaseManifestObservation(manifest, chainId, nowMs);
  assertObject(manifest.releaseEvidence.protocolAdminSafe, 'releaseEvidence.protocolAdminSafe');
  assertObject(manifest.releaseEvidence.emergencyGuardianSafe, 'releaseEvidence.emergencyGuardianSafe');
  assertProtocolAdminSafeBinding(manifest, config, observation);
  assertEmergencyGuardianSafeBinding(manifest, config, observation);
  if (
    manifest.releaseEvidence.protocolAdminSafe.block.timestamp !==
    manifest.releaseEvidence.emergencyGuardianSafe.block.timestamp
  ) {
    throw new Error('Manifest Safe evidence must use the same exact observation block timestamp');
  }
  const observationBlock = BigInt(observation.blockNumber);
  assertAssetAndExternalBindings(manifest, config, state, observationBlock);
  assertRoleBindings(manifest, config, state);
  const manifestByName = assertDeploymentBindings(manifest, config, state, observationBlock);
  return { manifest, manifestByName, observation };
}

export function manifestRecordForStateContract(
  manifest: ReleaseManifest,
  stateRecord: ContractRecord,
): ReleaseDeployedContract {
  const matches = manifest.deployedContracts.filter(
    (record) => getAddress(record.address) === getAddress(stateRecord.address),
  );
  if (matches.length !== 1) {
    throw new Error(`State contract ${stateRecord.contractName} lacks one exact signed-manifest deployment record`);
  }
  return matches[0]!;
}
