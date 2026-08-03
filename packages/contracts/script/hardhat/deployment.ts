import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  AbiCoder,
  Contract,
  Interface,
  concat,
  getAddress,
  getCreate2Address,
  id,
  isAddress,
  keccak256,
  toBeHex,
  toUtf8Bytes,
  ZeroAddress,
} from 'ethers';
import type { ContractRunner, ContractTransactionResponse, Provider, Signer, TransactionReceipt } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { assertConservativeSafeControlPlaneIdentity, type SafeControlPlaneIdentity } from './safe-control-plane';
import { expectedGenesisSqrtPriceX96, poolFacingGBXCurrency } from './genesis-liquidity-verification';

import {
  verifyTransparentProxyEvidence,
  verifyUupsProxyEvidence,
  verifyWrappedBtcBridgeEvidence,
  type TransparentProxyDependencyEvidence,
  type UupsProxyDependencyEvidence,
  type WrappedBtcBridgeDependencyEvidence,
} from './proxy-verification';

export const CANONICAL_CREATE2_DEPLOYER = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
export const HOOK_PERMISSION_MASK = 0x3fffn;
export const BEFORE_INITIALIZE_FLAG = 0x2000n;
export const GUMBALL_PERMISSIONED_HOOK_FLAGS = 0x28c0n;
export const CRITICAL_CHANGE_DELAY_SECONDS = 7n * 24n * 60n * 60n;
export const BOUNDED_MAINTENANCE_DELAY_SECONDS = 48n * 60n * 60n;
export const MAX_TARGET_ASSETS = 15;
export const MAX_STRATEGY_REFERENCE_RATE = (1n << 255n) - 1n;

export type EligibilityMode = 0 | 1 | 2;

type CompleteUupsProxyDependencyEvidence = Omit<UupsProxyDependencyEvidence, 'upgradeAuthorityRuntimeBytecodeHash'> & {
  upgradeAuthorityRuntimeBytecodeHash: string;
};
type CompleteTransparentProxyDependencyEvidence = Omit<
  TransparentProxyDependencyEvidence,
  'adminOwnerProxyEvidence'
> & {
  adminOwnerProxyEvidence: NonNullable<TransparentProxyDependencyEvidence['adminOwnerProxyEvidence']>;
};

export interface CanonicalTokenDependencies {
  usdG: {
    address: string;
    proxyEvidence: CompleteUupsProxyDependencyEvidence;
    runtimeBytecodeHash: string;
  };
  weth: {
    address: string;
    proxyEvidence: CompleteTransparentProxyDependencyEvidence;
    runtimeBytecodeHash: string;
  };
}

export interface WrappedBtcTransparentProxyDependency {
  address: string;
  implementationAddress: string;
  implementationRuntimeBytecodeHash: string;
  kind: 'eip1967-transparent';
  proxyAdminAddress: string;
  runtimeBytecodeHash: string;
}

export interface WrappedBtcBridgeDependency {
  gateway: WrappedBtcTransparentProxyDependency;
  gatewayRouter: WrappedBtcTransparentProxyDependency;
  l1Token: string;
  sharedProxyAdmin: {
    address: string;
    owner: {
      address: string;
      adminRole: string;
      executorRole: string;
      proxy: Omit<WrappedBtcTransparentProxyDependency, 'address' | 'runtimeBytecodeHash'>;
      runtimeBytecodeHash: string;
    };
    runtimeBytecodeHash: string;
  };
  token: {
    address: string;
    beaconAddress: string;
    beaconRuntimeBytecodeHash: string;
    implementationAddress: string;
    implementationRuntimeBytecodeHash: string;
    kind: 'eip1967-beacon';
    runtimeBytecodeHash: string;
  };
}

export interface RuntimeContractDependency {
  address: string;
  runtimeBytecodeHash: string;
}

export interface PermissionedPoolDependencies {
  mixedRouteQuoterV2: RuntimeContractDependency;
  permissionedPositionManager: RuntimeContractDependency;
  permissionsAdapterFactory: RuntimeContractDependency;
  universalRouter: RuntimeContractDependency;
  v4Quoter: RuntimeContractDependency;
}

export interface DeploymentConfig {
  emergencyGuardianSafe: SafeControlPlaneIdentity | null;
  kind: 'gumball-6900-deployment-config';
  protocol: 'GUM BALL 6900';
  protocolAdminSafe: SafeControlPlaneIdentity | null;
  schemaVersion: 1;
  assetReview: {
    path: string;
    rawSha256: string;
  } | null;
  canonicalTokenDependencies: CanonicalTokenDependencies | null;
  stockTokenDependency: {
    beaconAddress: string;
    beaconRuntimeBytecodeHash: string;
    implementationAddress: string;
    implementationRuntimeBytecodeHash: string;
  } | null;
  wrappedBtcBridgeDependency: WrappedBtcBridgeDependency | null;
  network:
    | { chainId: 4_663; name: 'Robinhood Chain' }
    | { chainId: 46_630; name: 'Robinhood Chain Testnet' }
    | { chainId: 31_337; name: 'Hardhat Local Rehearsal' };
  usdG: string;
  usdGDecimals: number;
  uniswapV4: {
    poolManager: string;
    positionManager: string;
    permit2: string;
  };
  roles: {
    protocolTimelockMultisig: string;
    emergencyGuardianOperator: string;
    genesisLiquidityBacker: string;
  };
  eligibility: {
    mode: EligibilityMode;
    registry: string;
    module: string;
  };
  genesis: {
    minimumBootstrapUSDG: string;
    bootstrapContributionCap: string;
  };
  strategies: {
    minimumLotUSDG: string;
    maximumLotUSDG: string;
    buybackInitialReferenceRate: string;
  };
  liquidity: {
    mode: 'unrestricted-test' | 'permissioned';
    permissionedDependencies: PermissionedPoolDependencies | null;
    poolFee: number;
    tickSpacing: number;
    allocationBps: [number, number, number, number];
    cumulativeTickDeltas: [number, number, number, number];
  };
  assets: {
    tokens: string[];
    assetIds: string[];
    symbolHashes: string[];
    decimals: number[];
    isStockToken: boolean[];
    runtimeBytecodeHashes: string[];
    uiMultipliers: Array<string | null>;
    initialReferenceRates: string[];
  };
}

export type DeploymentPhase =
  | 'DEPLOYED_AND_WIRED'
  | 'TIMELOCK_SCHEDULING'
  | 'TIMELOCK_OPERATIONS_SCHEDULED'
  | 'TIMELOCK_EXECUTING'
  | 'REGISTRY_CONFIGURED'
  | 'GENESIS_OPENED'
  | 'GENESIS_SETTLED';

export interface TransactionRecord {
  hash: string;
  blockNumber: number;
}

export interface ContractRecord {
  contractName: string;
  address: string;
  constructorArguments: unknown[];
  deploymentTransactionHash: string | null;
  blockNumber: number | null;
  runtimeCodeHash: string;
  external: boolean;
}

export interface DeploymentAddresses {
  protocolTimelock: string;
  emergencyGuardian: string;
  eligibilityModule: string;
  gbx: string;
  strategyDeployer: string;
  emissionController: string;
  genesisClaims: string;
  miningClaims: string;
  assetRegistry: string;
  allocationVoter: string;
  gumBallVault: string;
  stakedGBX: string;
  gumBallRouter: string;
  miningPool: string;
  genesisBootstrap: string;
  revenueRouter: string;
  holdUSDGStrategy: string;
  buybackBurnStrategy: string;
  eligibilityAllowlistChecker: string;
  permissionedPoolController: string;
  gbxPermissionsAdapter: string;
  adapterVerificationEscrow: string;
  launchGuardHook: string;
  genesisLiquidityCalculator: string;
  liquidityManager: string;
  lens: string;
  acquisitionStrategies: string[];
  managerRewards: string[];
}

export type GBXContractHolderRole =
  | 'GenesisClaims'
  | 'MiningClaims'
  | 'LiquidityManager'
  | 'StakedGBX'
  | 'BuybackBurnStrategy'
  | 'GumBallRouter'
  | 'UniswapV4PoolManager'
  | 'UniswapV4PermissionsAdapter';

export interface GBXContractHolderRecord {
  role: GBXContractHolderRole;
  address: string;
  rationale: string;
}

export interface TimelockOperationRecord {
  label: string;
  target: string;
  data: string;
  salt: string;
  operationId: string;
  requiredDelaySeconds: string;
  readyAt: string;
  scheduleTransactionHash: string | null;
  executeTransactionHash: string | null;
  executed: boolean;
}

export interface DeploymentState {
  schemaVersion: 1;
  chainId: string;
  networkName: string;
  phase: DeploymentPhase;
  configHash: string;
  dependencyInitializer: string;
  hookSalt: string;
  addresses: DeploymentAddresses;
  contracts: ContractRecord[];
  gbxContractHolders: GBXContractHolderRecord[];
  transactions: Record<string, TransactionRecord>;
  timelockOperations: TimelockOperationRecord[];
  updatedAt: string;
}

interface DeployContext {
  hre: HardhatRuntimeEnvironment;
  signer: Signer;
  records: ContractRecord[];
  transactions: Record<string, TransactionRecord>;
}

interface RegistryOperation {
  label: string;
  target: string;
  data: string;
  salt: string;
}

const REGISTRY_INTERFACE = new Interface([
  'function configureVault(address vault)',
  'function registerAsset((address token,bytes32 assetId,bytes32 symbolHash,uint8 decimals,address strategy,address rewards,bool isStockToken,bool acquisitionEnabled,bool redemptionEnabled) config)',
  'function registerStockAsset((address token,bytes32 assetId,bytes32 symbolHash,uint8 decimals,address strategy,address rewards,bool isStockToken,bool acquisitionEnabled,bool redemptionEnabled) config,(bytes32 tokenRuntimeCodeHash,address beacon,bytes32 beaconRuntimeCodeHash,address implementation,bytes32 implementationRuntimeCodeHash,uint256 uiMultiplier) dependency)',
  'function registerStandaloneStrategy(address strategy)',
]);

const TIMELOCK_ABI = [
  'function PROPOSER_MULTISIG() view returns (address)',
  'function CRITICAL_CHANGE_DELAY() view returns (uint256)',
  'function schedule(address target,bytes data,bytes32 salt) returns (bytes32)',
  'function execute(address target,bytes data,bytes32 salt) returns (bytes)',
  'function hashOperation(address target,bytes data,bytes32 salt) view returns (bytes32)',
  'function requiredDelay(address target,bytes data) view returns (uint256)',
  'function operationReadyAt(bytes32 operationId) view returns (uint64)',
] as const;

const GENESIS_ABI = [
  'function GENESIS_LIQUIDITY_BACKER() view returns (address)',
  'function maxSponsorUSDG() view returns (uint256)',
  'function sponsorEscrow() view returns (uint256)',
  'function contributionEnd() view returns (uint64)',
  'function communityUSDG() view returns (uint256)',
  'function state() view returns (uint8)',
  'function fundSponsor(uint256 requestedAmount) returns (uint256)',
  'function openContributions()',
  'function close()',
  'function settle(uint160 sqrtPriceX96) returns (uint160)',
] as const;

const PERMISSIONED_GENESIS_ACTIVATION_ABI = [
  'function bootstrapSwapEnableConsumed() view returns (bool)',
  'function enableSwappingAfterGenesis()',
] as const;

const PERMISSIONS_ADAPTER_SWAP_ABI = ['function swappingEnabled() view returns (bool)'] as const;

const ERC20_ABI = [
  'function ACCESS_CONTROLLED_REGISTRY() view returns (address)',
  'function decimals() view returns (uint8)',
  'function oraclePaused() view returns (bool)',
  'function paused() view returns (bool)',
  'function symbol() view returns (string)',
  'function tokenPaused() view returns (bool)',
  'function uid() view returns (bytes32)',
  'function uiMultiplier() view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
] as const;

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[], label: string): void {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new Error(`${label} contains unknown key ${key}`);
  }
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) throw new Error(`${label}.${key} is required`);
  }
}

function assertLiteral(value: unknown, expected: string | number, label: string): void {
  if (value !== expected) throw new Error(`${label} must equal ${String(expected)}`);
}

function deploymentNetworkName(chainId: bigint): string | undefined {
  if (chainId === 4_663n) return 'Robinhood Chain';
  if (chainId === 46_630n) return 'Robinhood Chain Testnet';
  if (chainId === 31_337n) return 'Hardhat Local Rehearsal';
  return undefined;
}

function assertAddress(value: unknown, label: string, allowZero = false): asserts value is string {
  if (typeof value !== 'string' || !isAddress(value)) throw new Error(`${label} must be an address`);
  if (!allowZero && getAddress(value) === ZeroAddress) throw new Error(`${label} must not be zero`);
}

function assertInteger(value: unknown, label: string, minimum: number, maximum: number): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${label} must be an integer in [${minimum}, ${maximum}]`);
  }
}

function parsePositiveIntegerString(value: unknown, label: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be a canonical unsigned decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed === 0n) throw new Error(`${label} must be greater than zero`);
  return parsed;
}

function assertBytes32(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a bytes32 hex value`);
  }
}

function validateRuntimeContractDependency(value: unknown, label: string): asserts value is RuntimeContractDependency {
  assertObject(value, label);
  assertExactKeys(value, ['address', 'runtimeBytecodeHash'], label);
  assertAddress(value.address, `${label}.address`);
  assertBytes32(value.runtimeBytecodeHash, `${label}.runtimeBytecodeHash`);
  if (BigInt(value.runtimeBytecodeHash) === 0n) throw new Error(`${label}.runtimeBytecodeHash must be nonzero`);
}

function assertNonzeroRuntimeHash(value: unknown, label: string): asserts value is string {
  assertBytes32(value, label);
  if (BigInt(value) === 0n) throw new Error(`${label} must be nonzero`);
}

function validateWrappedBtcTransparentProxy(
  value: unknown,
  label: string,
): asserts value is WrappedBtcTransparentProxyDependency {
  assertObject(value, label);
  assertExactKeys(
    value,
    [
      'address',
      'implementationAddress',
      'implementationRuntimeBytecodeHash',
      'kind',
      'proxyAdminAddress',
      'runtimeBytecodeHash',
    ],
    label,
  );
  assertLiteral(value.kind, 'eip1967-transparent', `${label}.kind`);
  for (const field of ['address', 'implementationAddress', 'proxyAdminAddress'] as const) {
    assertAddress(value[field], `${label}.${field}`);
  }
  for (const field of ['implementationRuntimeBytecodeHash', 'runtimeBytecodeHash'] as const) {
    assertNonzeroRuntimeHash(value[field], `${label}.${field}`);
  }
}

function validateWrappedBtcBridgeDependency(value: unknown): asserts value is WrappedBtcBridgeDependency {
  const label = 'wrappedBtcBridgeDependency';
  assertObject(value, label);
  assertExactKeys(value, ['gateway', 'gatewayRouter', 'l1Token', 'sharedProxyAdmin', 'token'], label);
  assertAddress(value.l1Token, `${label}.l1Token`);
  validateWrappedBtcTransparentProxy(value.gateway, `${label}.gateway`);
  validateWrappedBtcTransparentProxy(value.gatewayRouter, `${label}.gatewayRouter`);
  if (getAddress(value.gateway.address) === getAddress(value.gatewayRouter.address)) {
    throw new Error(`${label} gateway and gateway router must be distinct`);
  }

  assertObject(value.sharedProxyAdmin, `${label}.sharedProxyAdmin`);
  assertExactKeys(value.sharedProxyAdmin, ['address', 'owner', 'runtimeBytecodeHash'], `${label}.sharedProxyAdmin`);
  assertAddress(value.sharedProxyAdmin.address, `${label}.sharedProxyAdmin.address`);
  assertNonzeroRuntimeHash(value.sharedProxyAdmin.runtimeBytecodeHash, `${label}.sharedProxyAdmin.runtimeBytecodeHash`);
  const sharedProxyAdmin = getAddress(value.sharedProxyAdmin.address);
  if (
    getAddress(value.gateway.proxyAdminAddress) !== sharedProxyAdmin ||
    getAddress(value.gatewayRouter.proxyAdminAddress) !== sharedProxyAdmin
  ) {
    throw new Error(`${label} bridge proxies must share the configured ProxyAdmin`);
  }

  assertObject(value.sharedProxyAdmin.owner, `${label}.sharedProxyAdmin.owner`);
  assertExactKeys(
    value.sharedProxyAdmin.owner,
    ['address', 'adminRole', 'executorRole', 'proxy', 'runtimeBytecodeHash'],
    `${label}.sharedProxyAdmin.owner`,
  );
  const owner = value.sharedProxyAdmin.owner;
  assertAddress(owner.address, `${label}.sharedProxyAdmin.owner.address`);
  assertNonzeroRuntimeHash(owner.runtimeBytecodeHash, `${label}.sharedProxyAdmin.owner.runtimeBytecodeHash`);
  assertLiteral(
    owner.adminRole,
    '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
    `${label}.sharedProxyAdmin.owner.adminRole`,
  );
  assertLiteral(
    owner.executorRole,
    '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63',
    `${label}.sharedProxyAdmin.owner.executorRole`,
  );
  assertObject(owner.proxy, `${label}.sharedProxyAdmin.owner.proxy`);
  assertExactKeys(
    owner.proxy,
    ['implementationAddress', 'implementationRuntimeBytecodeHash', 'kind', 'proxyAdminAddress'],
    `${label}.sharedProxyAdmin.owner.proxy`,
  );
  assertLiteral(owner.proxy.kind, 'eip1967-transparent', `${label}.sharedProxyAdmin.owner.proxy.kind`);
  assertAddress(owner.proxy.implementationAddress, `${label}.sharedProxyAdmin.owner.proxy.implementationAddress`);
  assertAddress(owner.proxy.proxyAdminAddress, `${label}.sharedProxyAdmin.owner.proxy.proxyAdminAddress`);
  assertNonzeroRuntimeHash(
    owner.proxy.implementationRuntimeBytecodeHash,
    `${label}.sharedProxyAdmin.owner.proxy.implementationRuntimeBytecodeHash`,
  );
  if (getAddress(owner.proxy.proxyAdminAddress) !== sharedProxyAdmin) {
    throw new Error(`${label} ProxyAdmin owner proxy must be administered by the shared ProxyAdmin`);
  }

  assertObject(value.token, `${label}.token`);
  assertExactKeys(
    value.token,
    [
      'address',
      'beaconAddress',
      'beaconRuntimeBytecodeHash',
      'implementationAddress',
      'implementationRuntimeBytecodeHash',
      'kind',
      'runtimeBytecodeHash',
    ],
    `${label}.token`,
  );
  assertLiteral(value.token.kind, 'eip1967-beacon', `${label}.token.kind`);
  for (const field of ['address', 'beaconAddress', 'implementationAddress'] as const) {
    assertAddress(value.token[field], `${label}.token.${field}`);
  }
  for (const field of [
    'beaconRuntimeBytecodeHash',
    'implementationRuntimeBytecodeHash',
    'runtimeBytecodeHash',
  ] as const) {
    assertNonzeroRuntimeHash(value.token[field], `${label}.token.${field}`);
  }
}

function validateSafeControlPlaneIdentity(value: unknown, label: string): asserts value is SafeControlPlaneIdentity {
  assertObject(value, label);
  assertExactKeys(
    value,
    [
      'enabledModules',
      'fallbackHandler',
      'guard',
      'owners',
      'proxyRuntimeBytecodeHash',
      'safeAddress',
      'singletonAddress',
      'singletonRuntimeBytecodeHash',
      'threshold',
    ],
    label,
  );
  assertAddress(value.safeAddress, `${label}.safeAddress`);
  assertAddress(value.singletonAddress, `${label}.singletonAddress`);
  assertAddress(value.guard, `${label}.guard`, true);
  assertAddress(value.fallbackHandler, `${label}.fallbackHandler`, true);
  for (const field of ['proxyRuntimeBytecodeHash', 'singletonRuntimeBytecodeHash'] as const) {
    assertBytes32(value[field], `${label}.${field}`);
    if (BigInt(value[field]) === 0n) throw new Error(`${label}.${field} must be nonzero`);
  }
  for (const [field, addresses] of [
    ['owners', value.owners],
    ['enabledModules', value.enabledModules],
  ] as const) {
    if (!Array.isArray(addresses) || addresses.length > 256 || (field === 'owners' && addresses.length === 0)) {
      throw new Error(`${label}.${field} has an invalid bounded length`);
    }
    addresses.forEach((address, index) => assertAddress(address, `${label}.${field}[${index}]`));
    if (new Set(addresses.map((address) => getAddress(address))).size !== addresses.length) {
      throw new Error(`${label}.${field} must contain unique addresses`);
    }
  }
  const safeThreshold = parsePositiveIntegerString(value.threshold, `${label}.threshold`);
  const safeOwnerCount = Array.isArray(value.owners) ? value.owners.length : 0;
  if (safeThreshold > BigInt(safeOwnerCount)) throw new Error(`${label}.threshold exceeds owner count`);
  assertConservativeSafeControlPlaneIdentity(value as unknown as SafeControlPlaneIdentity, label);
}

/** Validates every deployment-critical scalar and all bounded parallel asset arrays. */
export function validateDeploymentConfig(value: unknown, chainId: bigint): asserts value is DeploymentConfig {
  assertObject(value, 'config');
  assertExactKeys(
    value,
    [
      'assets',
      'assetReview',
      'canonicalTokenDependencies',
      'emergencyGuardianSafe',
      'eligibility',
      'genesis',
      'kind',
      'liquidity',
      'network',
      'protocol',
      'protocolAdminSafe',
      'roles',
      'schemaVersion',
      'strategies',
      'stockTokenDependency',
      'uniswapV4',
      'usdG',
      'usdGDecimals',
      'wrappedBtcBridgeDependency',
    ],
    'config',
  );
  assertLiteral(value.kind, 'gumball-6900-deployment-config', 'config.kind');
  assertLiteral(value.protocol, 'GUM BALL 6900', 'config.protocol');
  assertLiteral(value.schemaVersion, 1, 'config.schemaVersion');
  assertObject(value.network, 'network');
  assertExactKeys(value.network, ['chainId', 'name'], 'network');
  assertInteger(value.network.chainId, 'network.chainId', 1, Number.MAX_SAFE_INTEGER);
  const expectedNetworkName = deploymentNetworkName(chainId);
  if (expectedNetworkName === undefined) throw new Error(`unsupported deployment chain ${chainId}`);
  if (BigInt(value.network.chainId) !== chainId) {
    throw new Error(`deployment config chain ${value.network.chainId} does not match provider chain ${chainId}`);
  }
  assertLiteral(value.network.name, expectedNetworkName, 'network.name');

  if (value.assetReview === null) {
    if (chainId === 4_663n) throw new Error('assetReview is required for Robinhood mainnet');
  } else {
    assertObject(value.assetReview, 'assetReview');
    assertExactKeys(value.assetReview, ['path', 'rawSha256'], 'assetReview');
    if (
      typeof value.assetReview.path !== 'string' ||
      !/^packages\/config\/deployments\/robinhood-mainnet-assets\.\d{4}-\d{2}-\d{2}\.candidate\.json$/.test(
        value.assetReview.path,
      )
    ) {
      throw new Error('assetReview.path must identify the fixed dated reviewed-candidate path');
    }
    if (typeof value.assetReview.rawSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.assetReview.rawSha256)) {
      throw new Error('assetReview.rawSha256 must be a lowercase raw SHA-256');
    }
    if (chainId !== 4_663n) throw new Error('assetReview is permitted only for Robinhood mainnet');
  }
  if (value.canonicalTokenDependencies === null) {
    if (chainId === 4_663n) throw new Error('canonicalTokenDependencies is required for Robinhood mainnet');
  } else {
    if (chainId !== 4_663n) throw new Error('canonicalTokenDependencies is permitted only for Robinhood mainnet');
    assertObject(value.canonicalTokenDependencies, 'canonicalTokenDependencies');
    assertExactKeys(value.canonicalTokenDependencies, ['usdG', 'weth'], 'canonicalTokenDependencies');
    const canonicalTokens = value.canonicalTokenDependencies;

    assertObject(canonicalTokens.usdG, 'canonicalTokenDependencies.usdG');
    assertExactKeys(
      canonicalTokens.usdG,
      ['address', 'proxyEvidence', 'runtimeBytecodeHash'],
      'canonicalTokenDependencies.usdG',
    );
    assertAddress(canonicalTokens.usdG.address, 'canonicalTokenDependencies.usdG.address');
    assertBytes32(canonicalTokens.usdG.runtimeBytecodeHash, 'canonicalTokenDependencies.usdG.runtimeBytecodeHash');
    if (BigInt(canonicalTokens.usdG.runtimeBytecodeHash) === 0n) {
      throw new Error('canonicalTokenDependencies.usdG.runtimeBytecodeHash must be nonzero');
    }
    assertObject(canonicalTokens.usdG.proxyEvidence, 'canonicalTokenDependencies.usdG.proxyEvidence');
    assertExactKeys(
      canonicalTokens.usdG.proxyEvidence,
      [
        'adminSlotValue',
        'implementationAddress',
        'implementationRuntimeBytecodeHash',
        'kind',
        'upgradeAuthorityAddress',
        'upgradeAuthorityRuntimeBytecodeHash',
      ],
      'canonicalTokenDependencies.usdG.proxyEvidence',
    );
    const usdGProxy = canonicalTokens.usdG.proxyEvidence;
    assertLiteral(usdGProxy.kind, 'eip1967-uups', 'canonicalTokenDependencies.usdG.proxyEvidence.kind');
    assertBytes32(usdGProxy.adminSlotValue, 'canonicalTokenDependencies.usdG.proxyEvidence.adminSlotValue');
    if (BigInt(usdGProxy.adminSlotValue) !== 0n) {
      throw new Error('canonicalTokenDependencies.usdG UUPS admin slot must be zero');
    }
    assertAddress(
      usdGProxy.implementationAddress,
      'canonicalTokenDependencies.usdG.proxyEvidence.implementationAddress',
    );
    assertAddress(
      usdGProxy.upgradeAuthorityAddress,
      'canonicalTokenDependencies.usdG.proxyEvidence.upgradeAuthorityAddress',
    );
    assertBytes32(
      usdGProxy.implementationRuntimeBytecodeHash,
      'canonicalTokenDependencies.usdG.proxyEvidence.implementationRuntimeBytecodeHash',
    );
    assertBytes32(
      usdGProxy.upgradeAuthorityRuntimeBytecodeHash,
      'canonicalTokenDependencies.usdG.proxyEvidence.upgradeAuthorityRuntimeBytecodeHash',
    );
    if (
      BigInt(usdGProxy.implementationRuntimeBytecodeHash) === 0n ||
      BigInt(usdGProxy.upgradeAuthorityRuntimeBytecodeHash) === 0n
    ) {
      throw new Error('canonicalTokenDependencies.usdG proxy runtime bytecode hashes must be nonzero');
    }

    assertObject(canonicalTokens.weth, 'canonicalTokenDependencies.weth');
    assertExactKeys(
      canonicalTokens.weth,
      ['address', 'proxyEvidence', 'runtimeBytecodeHash'],
      'canonicalTokenDependencies.weth',
    );
    assertAddress(canonicalTokens.weth.address, 'canonicalTokenDependencies.weth.address');
    assertBytes32(canonicalTokens.weth.runtimeBytecodeHash, 'canonicalTokenDependencies.weth.runtimeBytecodeHash');
    if (BigInt(canonicalTokens.weth.runtimeBytecodeHash) === 0n) {
      throw new Error('canonicalTokenDependencies.weth.runtimeBytecodeHash must be nonzero');
    }
    assertObject(canonicalTokens.weth.proxyEvidence, 'canonicalTokenDependencies.weth.proxyEvidence');
    assertExactKeys(
      canonicalTokens.weth.proxyEvidence,
      [
        'adminAddress',
        'adminOwnerAddress',
        'adminOwnerProxyEvidence',
        'adminOwnerRuntimeBytecodeHash',
        'adminRuntimeBytecodeHash',
        'adminSlotValue',
        'implementationAddress',
        'implementationRuntimeBytecodeHash',
        'kind',
        'proxyAdminInterface',
      ],
      'canonicalTokenDependencies.weth.proxyEvidence',
    );
    const wethProxy = canonicalTokens.weth.proxyEvidence;
    assertLiteral(wethProxy.kind, 'eip1967-transparent', 'canonicalTokenDependencies.weth.proxyEvidence.kind');
    if (wethProxy.proxyAdminInterface !== 'oz-v4' && wethProxy.proxyAdminInterface !== 'oz-v5') {
      throw new Error('canonicalTokenDependencies.weth.proxyEvidence.proxyAdminInterface is unsupported');
    }
    assertAddress(wethProxy.adminAddress, 'canonicalTokenDependencies.weth.proxyEvidence.adminAddress');
    assertAddress(wethProxy.adminOwnerAddress, 'canonicalTokenDependencies.weth.proxyEvidence.adminOwnerAddress');
    assertAddress(
      wethProxy.implementationAddress,
      'canonicalTokenDependencies.weth.proxyEvidence.implementationAddress',
    );
    for (const [hash, label] of [
      [wethProxy.adminRuntimeBytecodeHash, 'adminRuntimeBytecodeHash'],
      [wethProxy.adminOwnerRuntimeBytecodeHash, 'adminOwnerRuntimeBytecodeHash'],
      [wethProxy.implementationRuntimeBytecodeHash, 'implementationRuntimeBytecodeHash'],
    ] as const) {
      assertBytes32(hash, `canonicalTokenDependencies.weth.proxyEvidence.${label}`);
      if (BigInt(hash) === 0n) {
        throw new Error(`canonicalTokenDependencies.weth.proxyEvidence.${label} must be nonzero`);
      }
    }
    assertBytes32(wethProxy.adminSlotValue, 'canonicalTokenDependencies.weth.proxyEvidence.adminSlotValue');
    if (getAddress(`0x${wethProxy.adminSlotValue.slice(-40)}`) !== getAddress(wethProxy.adminAddress)) {
      throw new Error('canonicalTokenDependencies.weth proxy admin does not match its EIP-1967 admin slot');
    }
    assertObject(
      wethProxy.adminOwnerProxyEvidence,
      'canonicalTokenDependencies.weth.proxyEvidence.adminOwnerProxyEvidence',
    );
    assertExactKeys(
      wethProxy.adminOwnerProxyEvidence,
      ['adminSlotValue', 'implementationAddress', 'implementationRuntimeBytecodeHash'],
      'canonicalTokenDependencies.weth.proxyEvidence.adminOwnerProxyEvidence',
    );
    assertBytes32(
      wethProxy.adminOwnerProxyEvidence.adminSlotValue,
      'canonicalTokenDependencies.weth.proxyEvidence.adminOwnerProxyEvidence.adminSlotValue',
    );
    assertAddress(
      wethProxy.adminOwnerProxyEvidence.implementationAddress,
      'canonicalTokenDependencies.weth.proxyEvidence.adminOwnerProxyEvidence.implementationAddress',
    );
    assertBytes32(
      wethProxy.adminOwnerProxyEvidence.implementationRuntimeBytecodeHash,
      'canonicalTokenDependencies.weth.proxyEvidence.adminOwnerProxyEvidence.implementationRuntimeBytecodeHash',
    );
    if (BigInt(wethProxy.adminOwnerProxyEvidence.implementationRuntimeBytecodeHash) === 0n) {
      throw new Error(
        'canonicalTokenDependencies.weth.proxyEvidence.adminOwnerProxyEvidence implementation hash must be nonzero',
      );
    }
  }
  if (value.stockTokenDependency === null) {
    if (chainId === 4_663n) throw new Error('stockTokenDependency is required for Robinhood mainnet');
  } else {
    assertObject(value.stockTokenDependency, 'stockTokenDependency');
    assertExactKeys(
      value.stockTokenDependency,
      ['beaconAddress', 'beaconRuntimeBytecodeHash', 'implementationAddress', 'implementationRuntimeBytecodeHash'],
      'stockTokenDependency',
    );
    assertAddress(value.stockTokenDependency.beaconAddress, 'stockTokenDependency.beaconAddress');
    assertAddress(value.stockTokenDependency.implementationAddress, 'stockTokenDependency.implementationAddress');
    assertBytes32(
      value.stockTokenDependency.beaconRuntimeBytecodeHash,
      'stockTokenDependency.beaconRuntimeBytecodeHash',
    );
    assertBytes32(
      value.stockTokenDependency.implementationRuntimeBytecodeHash,
      'stockTokenDependency.implementationRuntimeBytecodeHash',
    );
    if (
      BigInt(value.stockTokenDependency.beaconRuntimeBytecodeHash) === 0n ||
      BigInt(value.stockTokenDependency.implementationRuntimeBytecodeHash) === 0n
    ) {
      throw new Error('stockTokenDependency runtime bytecode hashes must be nonzero');
    }
    if (chainId === 46_630n) {
      throw new Error('stockTokenDependency is forbidden while Robinhood testnet stock dependencies are unresolved');
    }
  }

  if (value.wrappedBtcBridgeDependency === null) {
    if (chainId === 4_663n) throw new Error('wrappedBtcBridgeDependency is required for Robinhood mainnet');
  } else {
    if (chainId !== 4_663n) throw new Error('wrappedBtcBridgeDependency is permitted only for Robinhood mainnet');
    validateWrappedBtcBridgeDependency(value.wrappedBtcBridgeDependency);
  }

  const canonicalTokenDependencies = value.canonicalTokenDependencies as CanonicalTokenDependencies | null;
  assertAddress(value.usdG, 'usdG');
  assertInteger(value.usdGDecimals, 'usdGDecimals', 0, 18);
  if (
    canonicalTokenDependencies !== null &&
    getAddress(canonicalTokenDependencies.usdG.address) !== getAddress(value.usdG)
  ) {
    throw new Error('canonicalTokenDependencies.usdG.address must match config.usdG');
  }

  assertObject(value.uniswapV4, 'uniswapV4');
  assertExactKeys(value.uniswapV4, ['permit2', 'poolManager', 'positionManager'], 'uniswapV4');
  assertAddress(value.uniswapV4.poolManager, 'uniswapV4.poolManager');
  assertAddress(value.uniswapV4.positionManager, 'uniswapV4.positionManager');
  assertAddress(value.uniswapV4.permit2, 'uniswapV4.permit2');

  assertObject(value.roles, 'roles');
  assertExactKeys(
    value.roles,
    ['emergencyGuardianOperator', 'genesisLiquidityBacker', 'protocolTimelockMultisig'],
    'roles',
  );
  assertAddress(value.roles.protocolTimelockMultisig, 'roles.protocolTimelockMultisig');
  assertAddress(value.roles.emergencyGuardianOperator, 'roles.emergencyGuardianOperator');
  assertAddress(value.roles.genesisLiquidityBacker, 'roles.genesisLiquidityBacker');

  if (value.protocolAdminSafe === null) {
    if (chainId !== 31_337n) throw new Error('protocolAdminSafe is required for every nonlocal deployment');
  } else {
    if (chainId === 31_337n) throw new Error('protocolAdminSafe is forbidden for local rehearsal');
    validateSafeControlPlaneIdentity(value.protocolAdminSafe, 'protocolAdminSafe');
    if (getAddress(value.protocolAdminSafe.safeAddress) !== getAddress(value.roles.protocolTimelockMultisig)) {
      throw new Error('protocolAdminSafe.safeAddress must match roles.protocolTimelockMultisig');
    }
  }

  if (value.emergencyGuardianSafe === null) {
    if (chainId !== 31_337n) throw new Error('emergencyGuardianSafe is required for every nonlocal deployment');
  } else {
    if (chainId === 31_337n) throw new Error('emergencyGuardianSafe is forbidden for local rehearsal');
    validateSafeControlPlaneIdentity(value.emergencyGuardianSafe, 'emergencyGuardianSafe');
    if (getAddress(value.emergencyGuardianSafe.safeAddress) !== getAddress(value.roles.emergencyGuardianOperator)) {
      throw new Error('emergencyGuardianSafe.safeAddress must match roles.emergencyGuardianOperator');
    }
  }
  if (
    value.protocolAdminSafe !== null &&
    value.emergencyGuardianSafe !== null &&
    getAddress(value.protocolAdminSafe.safeAddress) === getAddress(value.emergencyGuardianSafe.safeAddress)
  ) {
    throw new Error('protocolAdminSafe and emergencyGuardianSafe must be distinct');
  }

  assertObject(value.eligibility, 'eligibility');
  assertExactKeys(value.eligibility, ['mode', 'module', 'registry'], 'eligibility');
  assertInteger(value.eligibility.mode, 'eligibility.mode', 0, 2);
  assertAddress(value.eligibility.registry, 'eligibility.registry', true);
  assertAddress(value.eligibility.module, 'eligibility.module', true);
  if (value.eligibility.mode === 0 && chainId === 4_663n) {
    throw new Error('NoopEligibilityModule is forbidden on Robinhood mainnet');
  }
  if (value.eligibility.mode === 1 && getAddress(value.eligibility.registry) === ZeroAddress) {
    throw new Error('eligibility.registry is required in registry-adapter mode');
  }
  if (value.eligibility.mode === 2 && getAddress(value.eligibility.module) === ZeroAddress) {
    throw new Error('eligibility.module is required in predeployed-module mode');
  }

  assertObject(value.genesis, 'genesis');
  assertExactKeys(value.genesis, ['bootstrapContributionCap', 'minimumBootstrapUSDG'], 'genesis');
  const minimumBootstrap = parsePositiveIntegerString(
    value.genesis.minimumBootstrapUSDG,
    'genesis.minimumBootstrapUSDG',
  );
  const contributionCap = parsePositiveIntegerString(
    value.genesis.bootstrapContributionCap,
    'genesis.bootstrapContributionCap',
  );
  if (contributionCap < minimumBootstrap) {
    throw new Error('genesis.bootstrapContributionCap must cover genesis.minimumBootstrapUSDG');
  }

  assertObject(value.strategies, 'strategies');
  assertExactKeys(value.strategies, ['buybackInitialReferenceRate', 'maximumLotUSDG', 'minimumLotUSDG'], 'strategies');
  const minimumLot = parsePositiveIntegerString(value.strategies.minimumLotUSDG, 'strategies.minimumLotUSDG');
  const maximumLot = parsePositiveIntegerString(value.strategies.maximumLotUSDG, 'strategies.maximumLotUSDG');
  const buybackInitialReferenceRate = parsePositiveIntegerString(
    value.strategies.buybackInitialReferenceRate,
    'strategies.buybackInitialReferenceRate',
  );
  if (buybackInitialReferenceRate > MAX_STRATEGY_REFERENCE_RATE) {
    throw new Error('strategies.buybackInitialReferenceRate exceeds the strategy reference-rate ceiling');
  }
  if (maximumLot < minimumLot) throw new Error('strategies.maximumLotUSDG must cover minimumLotUSDG');

  assertObject(value.liquidity, 'liquidity');
  assertExactKeys(
    value.liquidity,
    ['allocationBps', 'cumulativeTickDeltas', 'mode', 'permissionedDependencies', 'poolFee', 'tickSpacing'],
    'liquidity',
  );
  if (value.liquidity.mode !== 'unrestricted-test' && value.liquidity.mode !== 'permissioned') {
    throw new Error('liquidity.mode must be unrestricted-test or permissioned');
  }
  if (value.liquidity.mode === 'unrestricted-test') {
    if (chainId === 4_663n) throw new Error('unrestricted-test liquidity is forbidden on Robinhood mainnet');
    if (value.liquidity.permissionedDependencies !== null) {
      throw new Error('liquidity.permissionedDependencies must be null in unrestricted-test mode');
    }
  } else {
    if (value.liquidity.poolFee !== 3_000 || value.liquidity.tickSpacing !== 60) {
      throw new Error('permissioned liquidity requires fee 3000 and tick spacing 60');
    }
    assertObject(value.liquidity.permissionedDependencies, 'liquidity.permissionedDependencies');
    assertExactKeys(
      value.liquidity.permissionedDependencies,
      ['mixedRouteQuoterV2', 'permissionedPositionManager', 'permissionsAdapterFactory', 'universalRouter', 'v4Quoter'],
      'liquidity.permissionedDependencies',
    );
    const dependencies = value.liquidity.permissionedDependencies;
    for (const key of [
      'mixedRouteQuoterV2',
      'permissionedPositionManager',
      'permissionsAdapterFactory',
      'universalRouter',
      'v4Quoter',
    ] as const) {
      validateRuntimeContractDependency(dependencies[key], `liquidity.permissionedDependencies.${key}`);
    }
    const typedDependencies = dependencies as unknown as PermissionedPoolDependencies;
    if (
      getAddress(typedDependencies.permissionedPositionManager.address) !== getAddress(value.uniswapV4.positionManager)
    ) {
      throw new Error('permissionedPositionManager must match uniswapV4.positionManager');
    }
    const uniqueDependencies = Object.values(typedDependencies).map(({ address }) => getAddress(address));
    if (new Set(uniqueDependencies).size !== uniqueDependencies.length) {
      throw new Error('permissioned-pool dependency addresses must be unique');
    }
  }
  assertInteger(value.liquidity.poolFee, 'liquidity.poolFee', 1, 1_000_000);
  assertInteger(value.liquidity.tickSpacing, 'liquidity.tickSpacing', 1, 32_767);
  if (!Array.isArray(value.liquidity.allocationBps) || value.liquidity.allocationBps.length !== 4) {
    throw new Error('liquidity.allocationBps must contain exactly four entries');
  }
  if (!Array.isArray(value.liquidity.cumulativeTickDeltas) || value.liquidity.cumulativeTickDeltas.length !== 4) {
    throw new Error('liquidity.cumulativeTickDeltas must contain exactly four entries');
  }
  let totalBps = 0;
  let previousDelta = 0;
  for (let index = 0; index < 4; index += 1) {
    const bps = value.liquidity.allocationBps[index];
    const delta = value.liquidity.cumulativeTickDeltas[index];
    assertInteger(bps, `liquidity.allocationBps[${index}]`, 1, 10_000);
    assertInteger(delta, `liquidity.cumulativeTickDeltas[${index}]`, 1, 887_272);
    if (delta <= previousDelta || delta % value.liquidity.tickSpacing !== 0) {
      throw new Error(`liquidity.cumulativeTickDeltas[${index}] is not an increasing tick-spacing multiple`);
    }
    totalBps += bps;
    previousDelta = delta;
  }
  if (totalBps !== 10_000) throw new Error('liquidity allocations must sum to 10,000 bps');

  assertObject(value.assets, 'assets');
  assertExactKeys(
    value.assets,
    [
      'assetIds',
      'decimals',
      'initialReferenceRates',
      'isStockToken',
      'runtimeBytecodeHashes',
      'symbolHashes',
      'tokens',
      'uiMultipliers',
    ],
    'assets',
  );
  const tokens = value.assets.tokens;
  const assetIds = value.assets.assetIds;
  const symbolHashes = value.assets.symbolHashes;
  const decimalsArray = value.assets.decimals;
  const stockFlags = value.assets.isStockToken;
  const runtimeBytecodeHashes = value.assets.runtimeBytecodeHashes;
  const uiMultipliers = value.assets.uiMultipliers;
  const referenceRates = value.assets.initialReferenceRates;
  if (!Array.isArray(tokens)) throw new Error('assets.tokens must be an array');
  if (!Array.isArray(assetIds)) throw new Error('assets.assetIds must be an array');
  if (!Array.isArray(symbolHashes)) throw new Error('assets.symbolHashes must be an array');
  if (!Array.isArray(decimalsArray)) throw new Error('assets.decimals must be an array');
  if (!Array.isArray(stockFlags)) throw new Error('assets.isStockToken must be an array');
  if (!Array.isArray(runtimeBytecodeHashes)) throw new Error('assets.runtimeBytecodeHashes must be an array');
  if (!Array.isArray(uiMultipliers)) throw new Error('assets.uiMultipliers must be an array');
  if (!Array.isArray(referenceRates)) throw new Error('assets.initialReferenceRates must be an array');
  const arrays: Array<[unknown[], string]> = [
    [tokens, 'assets.tokens'],
    [assetIds, 'assets.assetIds'],
    [symbolHashes, 'assets.symbolHashes'],
    [decimalsArray, 'assets.decimals'],
    [stockFlags, 'assets.isStockToken'],
    [runtimeBytecodeHashes, 'assets.runtimeBytecodeHashes'],
    [uiMultipliers, 'assets.uiMultipliers'],
    [referenceRates, 'assets.initialReferenceRates'],
  ];
  const targetCount = tokens.length;
  if (targetCount > MAX_TARGET_ASSETS) throw new Error(`at most ${MAX_TARGET_ASSETS} target assets are supported`);
  for (const [array, label] of arrays) {
    if ((array as unknown[]).length !== targetCount) throw new Error(`${label} length does not match assets.tokens`);
  }

  const canonicalUSDG = getAddress(value.usdG);
  const seen = new Set<string>();
  for (let index = 0; index < targetCount; index += 1) {
    const token = tokens[index];
    const assetId = assetIds[index];
    const symbolHash = symbolHashes[index];
    const decimals = decimalsArray[index];
    const isStockToken = stockFlags[index];
    const runtimeBytecodeHash = runtimeBytecodeHashes[index];
    const uiMultiplier = uiMultipliers[index];
    const rate = referenceRates[index];
    assertAddress(token, `assets.tokens[${index}]`);
    assertBytes32(assetId, `assets.assetIds[${index}]`);
    assertBytes32(symbolHash, `assets.symbolHashes[${index}]`);
    assertBytes32(runtimeBytecodeHash, `assets.runtimeBytecodeHashes[${index}]`);
    if (BigInt(assetId) === 0n || BigInt(symbolHash) === 0n || BigInt(runtimeBytecodeHash) === 0n) {
      throw new Error(`assets identity fields at index ${index} must not be zero`);
    }
    assertInteger(decimals, `assets.decimals[${index}]`, 0, 18);
    if (typeof isStockToken !== 'boolean') throw new Error(`assets.isStockToken[${index}] must be boolean`);
    if (isStockToken) {
      if (decimals !== 18) throw new Error(`stock-token assets.decimals[${index}] must equal 18`);
      parsePositiveIntegerString(uiMultiplier, `assets.uiMultipliers[${index}]`);
    } else if (uiMultiplier !== null) {
      throw new Error(`non-stock assets.uiMultipliers[${index}] must be null`);
    }
    const referenceRate = parsePositiveIntegerString(rate, `assets.initialReferenceRates[${index}]`);
    if (referenceRate > MAX_STRATEGY_REFERENCE_RATE) {
      throw new Error(`assets.initialReferenceRates[${index}] exceeds the strategy reference-rate ceiling`);
    }
    const canonicalToken = getAddress(token);
    if (canonicalToken === canonicalUSDG) throw new Error(`assets.tokens[${index}] duplicates USDG`);
    if (seen.has(canonicalToken)) throw new Error(`assets.tokens[${index}] is duplicated`);
    seen.add(canonicalToken);
  }
  if (stockFlags.some((isStockToken) => isStockToken === true) && value.stockTokenDependency === null) {
    throw new Error('stock-token targets require stockTokenDependency evidence');
  }
  if (canonicalTokenDependencies !== null) {
    const wethIndexes = symbolHashes
      .map((symbolHash, index) => (String(symbolHash).toLowerCase() === id('WETH').toLowerCase() ? index : -1))
      .filter((index) => index >= 0);
    if (wethIndexes.length !== 1) {
      throw new Error('canonicalTokenDependencies requires exactly one WETH target asset');
    }
    const wethIndex = wethIndexes[0]!;
    if (
      stockFlags[wethIndex] !== false ||
      getAddress(String(tokens[wethIndex])) !== getAddress(canonicalTokenDependencies.weth.address) ||
      String(runtimeBytecodeHashes[wethIndex]).toLowerCase() !==
        canonicalTokenDependencies.weth.runtimeBytecodeHash.toLowerCase()
    ) {
      throw new Error('canonicalTokenDependencies.weth must match the WETH target address and runtime bytecode hash');
    }
  }
  const wrappedBtcBridgeDependency = value.wrappedBtcBridgeDependency as WrappedBtcBridgeDependency | null;
  if (wrappedBtcBridgeDependency !== null) {
    const wrappedBtcIndexes = symbolHashes
      .map((symbolHash, index) => (String(symbolHash).toLowerCase() === id('WBTC').toLowerCase() ? index : -1))
      .filter((index) => index >= 0);
    if (wrappedBtcIndexes.length !== 1) {
      throw new Error('wrappedBtcBridgeDependency requires exactly one WBTC target asset');
    }
    const wrappedBtcIndex = wrappedBtcIndexes[0]!;
    if (
      stockFlags[wrappedBtcIndex] !== false ||
      decimalsArray[wrappedBtcIndex] !== 8 ||
      getAddress(String(tokens[wrappedBtcIndex])) !== getAddress(wrappedBtcBridgeDependency.token.address) ||
      String(runtimeBytecodeHashes[wrappedBtcIndex]).toLowerCase() !==
        wrappedBtcBridgeDependency.token.runtimeBytecodeHash.toLowerCase()
    ) {
      throw new Error('wrappedBtcBridgeDependency.token must match the WBTC target identity and runtime bytecode hash');
    }
  }
}

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortForStableJson(nested)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortForStableJson(value));
}

export function deploymentConfigHash(config: DeploymentConfig): string {
  return keccak256(toUtf8Bytes(stableJson(config)));
}

export async function readDeploymentConfig(configPath: string, chainId: bigint): Promise<DeploymentConfig> {
  const parsed: unknown = JSON.parse(await readFile(configPath, 'utf8'));
  validateDeploymentConfig(parsed, chainId);
  return parsed;
}

export async function readDeploymentState(statePath: string): Promise<DeploymentState> {
  const parsed: unknown = JSON.parse(await readFile(statePath, 'utf8'));
  assertObject(parsed, 'deployment state');
  if (parsed.schemaVersion !== 1) throw new Error('unsupported deployment-state schema');
  return parsed as unknown as DeploymentState;
}

/** Atomic state writes keep a killed phase from leaving a partially serialized manifest. */
export async function writeDeploymentState(statePath: string, state: DeploymentState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(state, (_key, nested) => (typeof nested === 'bigint' ? nested.toString() : nested), 2)}\n`,
    'utf8',
  );
  await rename(temporaryPath, statePath);
}

export function hookPermissionBits(address: string): bigint {
  assertAddress(address, 'hook address');
  return BigInt(address) & HOOK_PERMISSION_MASK;
}

export interface HookMiningResult {
  address: string;
  salt: string;
  attempts: number;
}

/** Mines a CREATE2 salt and skips already occupied flag-compatible addresses. */
export async function mineHookSalt(
  deployer: string,
  initCode: string,
  isOccupied: (candidate: string) => Promise<boolean> = async () => false,
  maxAttempts = 500_000,
  expectedPermissionBits = BEFORE_INITIALIZE_FLAG,
): Promise<HookMiningResult> {
  assertAddress(deployer, 'CREATE2 deployer');
  const initCodeHash = keccak256(initCode);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const salt = toBeHex(attempt, 32);
    const candidate = getCreate2Address(deployer, salt, initCodeHash);
    if (hookPermissionBits(candidate) === expectedPermissionBits && !(await isOccupied(candidate))) {
      return { address: candidate, salt, attempts: attempt + 1 };
    }
  }
  throw new Error(
    `unable to mine hook permission bits 0x${expectedPermissionBits.toString(16)} in ${maxAttempts} attempts`,
  );
}

export function operationSalt(chainId: bigint, label: string, target: string, data: string): string {
  assertAddress(target, 'operation target');
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['string', 'uint256', 'string', 'address', 'bytes32'],
      ['GUM_BALL_6900', chainId, label, target, keccak256(data)],
    ),
  );
}

export function registryOperations(
  config: DeploymentConfig,
  addresses: DeploymentAddresses,
  chainId: bigint,
): RegistryOperation[] {
  const operations: RegistryOperation[] = [];
  const add = (label: string, data: string): void => {
    operations.push({
      label,
      target: addresses.assetRegistry,
      data,
      salt: operationSalt(chainId, label, addresses.assetRegistry, data),
    });
  };

  add('CONFIGURE_VAULT', REGISTRY_INTERFACE.encodeFunctionData('configureVault', [addresses.gumBallVault]));
  add(
    'REGISTER_USDG',
    REGISTRY_INTERFACE.encodeFunctionData('registerAsset', [
      {
        token: config.usdG,
        assetId: id('USDG'),
        symbolHash: id('USDG'),
        decimals: config.usdGDecimals,
        strategy: addresses.holdUSDGStrategy,
        rewards: ZeroAddress,
        isStockToken: false,
        acquisitionEnabled: true,
        redemptionEnabled: true,
      },
    ]),
  );
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    const assetConfig = {
      token: config.assets.tokens[index],
      assetId: config.assets.assetIds[index],
      symbolHash: config.assets.symbolHashes[index],
      decimals: config.assets.decimals[index],
      strategy: addresses.acquisitionStrategies[index],
      rewards: addresses.managerRewards[index],
      isStockToken: config.assets.isStockToken[index],
      acquisitionEnabled: true,
      redemptionEnabled: true,
    };
    if (config.assets.isStockToken[index]) {
      if (config.stockTokenDependency === null) {
        throw new Error(`stock-token target at index ${index} has no dependency evidence`);
      }
      const uiMultiplier = config.assets.uiMultipliers[index];
      if (uiMultiplier === null || uiMultiplier === undefined) {
        throw new Error(`stock-token target at index ${index} has no UI multiplier`);
      }
      add(
        'REGISTER_TARGET',
        REGISTRY_INTERFACE.encodeFunctionData('registerStockAsset', [
          assetConfig,
          {
            tokenRuntimeCodeHash: config.assets.runtimeBytecodeHashes[index],
            beacon: config.stockTokenDependency.beaconAddress,
            beaconRuntimeCodeHash: config.stockTokenDependency.beaconRuntimeBytecodeHash,
            implementation: config.stockTokenDependency.implementationAddress,
            implementationRuntimeCodeHash: config.stockTokenDependency.implementationRuntimeBytecodeHash,
            uiMultiplier,
          },
        ]),
      );
      continue;
    }
    add('REGISTER_TARGET', REGISTRY_INTERFACE.encodeFunctionData('registerAsset', [assetConfig]));
  }
  add(
    'REGISTER_BUYBACK',
    REGISTRY_INTERFACE.encodeFunctionData('registerStandaloneStrategy', [addresses.buybackBurnStrategy]),
  );
  return operations;
}

async function requireCode(provider: Provider, address: string, label: string): Promise<string> {
  const code = await provider.getCode(address);
  if (code === '0x') throw new Error(`${label} has no runtime code at ${address}`);
  return code;
}

async function recordTransaction(
  transactions: Record<string, TransactionRecord>,
  label: string,
  transaction: ContractTransactionResponse,
): Promise<TransactionReceipt> {
  const receipt = await transaction.wait();
  if (receipt === null || receipt.status !== 1) throw new Error(`${label} transaction failed`);
  transactions[label] = { hash: receipt.hash, blockNumber: receipt.blockNumber };
  return receipt;
}

async function deployContract(
  context: DeployContext,
  contractName: string,
  constructorArguments: unknown[],
): Promise<Contract> {
  const factory = await context.hre.ethers.getContractFactory(contractName, context.signer);
  const contract = await factory.deploy(...constructorArguments);
  const deploymentTransaction = contract.deploymentTransaction();
  if (deploymentTransaction === null) throw new Error(`${contractName} did not create a deployment transaction`);
  const receipt = await deploymentTransaction.wait();
  if (receipt === null || receipt.status !== 1) throw new Error(`${contractName} deployment failed`);
  const address = await contract.getAddress();
  const code = await requireCode(context.hre.ethers.provider, address, contractName);
  context.records.push({
    contractName,
    address,
    constructorArguments,
    deploymentTransactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    runtimeCodeHash: keccak256(code),
    external: false,
  });
  context.transactions[`deploy:${contractName}:${context.records.length}`] = {
    hash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
  return contract;
}

async function recordExternalContract(
  provider: Provider,
  records: ContractRecord[],
  contractName: string,
  address: string,
): Promise<void> {
  const code = await requireCode(provider, address, contractName);
  records.push({
    contractName,
    address: getAddress(address),
    constructorArguments: [],
    deploymentTransactionHash: null,
    blockNumber: null,
    runtimeCodeHash: keccak256(code),
    external: true,
  });
}

async function wire(
  context: DeployContext,
  label: string,
  contract: Contract,
  functionName: string,
  args: unknown[],
): Promise<TransactionReceipt> {
  const transaction = (await contract.getFunction(functionName)(...args)) as ContractTransactionResponse;
  return recordTransaction(context.transactions, `wire:${label}`, transaction);
}

async function recordTypedDeployment(
  context: DeployContext,
  contractName: string,
  address: string,
  constructorArguments: unknown[],
  receipt: TransactionReceipt,
): Promise<void> {
  const canonicalAddress = getAddress(address);
  const code = await requireCode(context.hre.ethers.provider, canonicalAddress, contractName);
  context.records.push({
    contractName,
    address: canonicalAddress,
    constructorArguments,
    deploymentTransactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    runtimeCodeHash: keccak256(code),
    external: false,
  });
  context.transactions[`deploy:${contractName}:${context.records.length}`] = {
    hash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

async function assertExternalDependencies(
  provider: Provider,
  config: DeploymentConfig,
  chainId: bigint,
): Promise<void> {
  validateDeploymentConfig(config, chainId);
  await requireCode(provider, config.usdG, 'USDG');
  await requireCode(provider, config.uniswapV4.poolManager, 'Uniswap v4 PoolManager');
  await requireCode(provider, config.uniswapV4.positionManager, 'Uniswap v4 PositionManager');
  await requireCode(provider, config.uniswapV4.permit2, 'Permit2');
  await requireCode(provider, CANONICAL_CREATE2_DEPLOYER, 'canonical CREATE2 deployer');
  if (config.liquidity.permissionedDependencies !== null) {
    for (const [key, dependency] of Object.entries(config.liquidity.permissionedDependencies)) {
      const code = await requireCode(provider, dependency.address, `permissioned-pool ${key}`);
      if (keccak256(code).toLowerCase() !== dependency.runtimeBytecodeHash.toLowerCase()) {
        throw new Error(`permissioned-pool ${key} runtime bytecode mismatch`);
      }
    }
  }
  if (config.eligibility.mode === 1) {
    await requireCode(provider, config.eligibility.registry, 'eligibility registry');
  } else if (config.eligibility.mode === 2) {
    await requireCode(provider, config.eligibility.module, 'predeployed eligibility module');
  }
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    await requireCode(provider, config.assets.tokens[index]!, `target token ${index}`);
  }

  const usdG = new Contract(config.usdG, ERC20_ABI, provider);
  const actualDecimals = Number(await usdG.getFunction('decimals')());
  if (actualDecimals !== config.usdGDecimals) {
    throw new Error(`USDG decimals mismatch: config=${config.usdGDecimals}, token=${actualDecimals}`);
  }
  await assertExternalAssetIdentities(provider, config);
}

/** Revalidates the complete signed USDG and WETH proxy/control graphs at every mutating phase boundary. */
export interface CanonicalTokenDependencyVerifiers {
  verifyTransparent: typeof verifyTransparentProxyEvidence;
  verifyUups: typeof verifyUupsProxyEvidence;
}

const canonicalTokenDependencyVerifiers: CanonicalTokenDependencyVerifiers = {
  verifyTransparent: verifyTransparentProxyEvidence,
  verifyUups: verifyUupsProxyEvidence,
};

export async function verifyCanonicalTokenDependencies(
  provider: Provider,
  config: DeploymentConfig,
  verifiers: CanonicalTokenDependencyVerifiers = canonicalTokenDependencyVerifiers,
): Promise<void> {
  const dependencies = config.canonicalTokenDependencies;
  if (dependencies === null) return;
  const [usdGCode, wethCode] = await Promise.all([
    provider.getCode(dependencies.usdG.address),
    provider.getCode(dependencies.weth.address),
  ]);
  if (usdGCode === '0x' || keccak256(usdGCode).toLowerCase() !== dependencies.usdG.runtimeBytecodeHash.toLowerCase()) {
    throw new Error('canonical USDG proxy runtime bytecode mismatch');
  }
  if (wethCode === '0x' || keccak256(wethCode).toLowerCase() !== dependencies.weth.runtimeBytecodeHash.toLowerCase()) {
    throw new Error('canonical WETH proxy runtime bytecode mismatch');
  }
  await Promise.all([
    verifiers.verifyUups(provider, dependencies.usdG.address, dependencies.usdG.proxyEvidence, 'USDG'),
    verifiers.verifyTransparent(provider, dependencies.weth.address, dependencies.weth.proxyEvidence, 'WETH'),
  ]);
}

function wrappedBtcManifestEvidence(dependency: WrappedBtcBridgeDependency): WrappedBtcBridgeDependencyEvidence {
  return {
    gateway: {
      address: dependency.gateway.address,
      implementationAddress: dependency.gateway.implementationAddress,
      implementationRuntimeBytecodeHash: dependency.gateway.implementationRuntimeBytecodeHash,
      proxyAdminAddress: dependency.gateway.proxyAdminAddress,
      runtimeBytecodeHash: dependency.gateway.runtimeBytecodeHash,
    },
    gatewayRouter: {
      address: dependency.gatewayRouter.address,
      implementationAddress: dependency.gatewayRouter.implementationAddress,
      implementationRuntimeBytecodeHash: dependency.gatewayRouter.implementationRuntimeBytecodeHash,
      proxyAdminAddress: dependency.gatewayRouter.proxyAdminAddress,
      runtimeBytecodeHash: dependency.gatewayRouter.runtimeBytecodeHash,
    },
    kind: 'wrapped-btc-canonical-bridge',
    l1Token: dependency.l1Token,
    sharedProxyAdmin: {
      address: dependency.sharedProxyAdmin.address,
      owner: {
        address: dependency.sharedProxyAdmin.owner.address,
        adminRole: dependency.sharedProxyAdmin.owner.adminRole,
        executorRole: dependency.sharedProxyAdmin.owner.executorRole,
        implementationAddress: dependency.sharedProxyAdmin.owner.proxy.implementationAddress,
        implementationRuntimeBytecodeHash: dependency.sharedProxyAdmin.owner.proxy.implementationRuntimeBytecodeHash,
        runtimeBytecodeHash: dependency.sharedProxyAdmin.owner.runtimeBytecodeHash,
      },
      runtimeBytecodeHash: dependency.sharedProxyAdmin.runtimeBytecodeHash,
    },
    tokenBeacon: {
      address: dependency.token.beaconAddress,
      implementationAddress: dependency.token.implementationAddress,
      implementationRuntimeBytecodeHash: dependency.token.implementationRuntimeBytecodeHash,
      runtimeBytecodeHash: dependency.token.beaconRuntimeBytecodeHash,
    },
  };
}

export interface WrappedBtcBridgeDependencyVerifier {
  verify: typeof verifyWrappedBtcBridgeEvidence;
}

const wrappedBtcBridgeDependencyVerifier: WrappedBtcBridgeDependencyVerifier = {
  verify: verifyWrappedBtcBridgeEvidence,
};

/** Revalidates WBTC's token, canonical routing, beacon, and complete bridge upgrade-control graph. */
export async function verifyWrappedBtcBridgeDependency(
  provider: Provider,
  config: DeploymentConfig,
  verifier: WrappedBtcBridgeDependencyVerifier = wrappedBtcBridgeDependencyVerifier,
): Promise<void> {
  const dependency = config.wrappedBtcBridgeDependency;
  if (dependency === null) return;
  const tokenCode = await provider.getCode(dependency.token.address);
  if (tokenCode === '0x' || keccak256(tokenCode).toLowerCase() !== dependency.token.runtimeBytecodeHash.toLowerCase()) {
    throw new Error('canonical WBTC token runtime bytecode mismatch');
  }
  await verifier.verify(provider, dependency.token.address, wrappedBtcManifestEvidence(dependency), 'WBTC');
}

/** Revalidates every configured target token immediately before a deployment phase can mutate protocol state. */
export async function assertExternalAssetIdentities(provider: Provider, config: DeploymentConfig): Promise<void> {
  await verifyCanonicalTokenDependencies(provider, config);
  await verifyWrappedBtcBridgeDependency(provider, config);
  let stockBeacon: Contract | null = null;
  if (config.assets.isStockToken.some((isStockToken) => isStockToken)) {
    const dependency = config.stockTokenDependency;
    if (dependency === null) throw new Error('stock-token targets require dependency evidence');
    const [beaconCode, implementationCode] = await Promise.all([
      provider.getCode(dependency.beaconAddress),
      provider.getCode(dependency.implementationAddress),
    ]);
    if (
      beaconCode === '0x' ||
      keccak256(beaconCode).toLowerCase() !== dependency.beaconRuntimeBytecodeHash.toLowerCase()
    ) {
      throw new Error('stock-token beacon runtime bytecode mismatch');
    }
    if (
      implementationCode === '0x' ||
      keccak256(implementationCode).toLowerCase() !== dependency.implementationRuntimeBytecodeHash.toLowerCase()
    ) {
      throw new Error('stock-token implementation runtime bytecode mismatch');
    }
    stockBeacon = new Contract(
      dependency.beaconAddress,
      ['function implementation() view returns (address)', 'function paused() view returns (bool)'],
      provider,
    );
    const [implementation, paused] = await Promise.all([
      stockBeacon.getFunction('implementation')(),
      stockBeacon.getFunction('paused')(),
    ]);
    if (getAddress(String(implementation)) !== getAddress(dependency.implementationAddress)) {
      throw new Error('stock-token beacon implementation changed');
    }
    if (paused === true) throw new Error('stock-token beacon is paused');
  }
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    const token = new Contract(config.assets.tokens[index]!, ERC20_ABI, provider);
    const [tokenCode, tokenDecimalsValue, tokenSymbolValue] = await Promise.all([
      provider.getCode(config.assets.tokens[index]!),
      token.getFunction('decimals')(),
      token.getFunction('symbol')(),
    ]);
    if (
      tokenCode === '0x' ||
      keccak256(tokenCode).toLowerCase() !== config.assets.runtimeBytecodeHashes[index]!.toLowerCase()
    ) {
      throw new Error(`target token ${index} runtime bytecode mismatch`);
    }
    const tokenDecimals = Number(tokenDecimalsValue);
    if (tokenDecimals !== config.assets.decimals[index]) {
      throw new Error(
        `target token ${index} decimals mismatch: config=${config.assets.decimals[index]}, token=${tokenDecimals}`,
      );
    }
    const tokenSymbol = String(tokenSymbolValue);
    if (id(tokenSymbol).toLowerCase() !== config.assets.symbolHashes[index]!.toLowerCase()) {
      throw new Error(`target token ${index} symbol mismatch: received ${tokenSymbol}`);
    }
    if (config.assets.isStockToken[index] === true) {
      if (config.stockTokenDependency === null || stockBeacon === null) {
        throw new Error(`target stock token ${index} has no live beacon dependency`);
      }
      const [uid, uiMultiplier, registry, paused, tokenPaused, oraclePaused] = await Promise.all([
        token.getFunction('uid')(),
        token.getFunction('uiMultiplier')(),
        token.getFunction('ACCESS_CONTROLLED_REGISTRY')(),
        token.getFunction('paused')(),
        token.getFunction('tokenPaused')(),
        token.getFunction('oraclePaused')(),
      ]);
      if (String(uid).toLowerCase() !== config.assets.assetIds[index]!.toLowerCase()) {
        throw new Error(`target stock token ${index} UID mismatch`);
      }
      if (BigInt(uiMultiplier as bigint) !== BigInt(config.assets.uiMultipliers[index]!)) {
        throw new Error(`target stock token ${index} UI multiplier mismatch`);
      }
      if (getAddress(String(registry)) !== getAddress(config.stockTokenDependency.beaconAddress)) {
        throw new Error(`target stock token ${index} access-control registry mismatch`);
      }
      if (paused === true || tokenPaused === true || oraclePaused === true) {
        throw new Error(`target stock token ${index} is paused`);
      }
    }
  }
}

function newAddresses(): DeploymentAddresses {
  return {
    protocolTimelock: ZeroAddress,
    emergencyGuardian: ZeroAddress,
    eligibilityModule: ZeroAddress,
    gbx: ZeroAddress,
    strategyDeployer: ZeroAddress,
    emissionController: ZeroAddress,
    genesisClaims: ZeroAddress,
    miningClaims: ZeroAddress,
    assetRegistry: ZeroAddress,
    allocationVoter: ZeroAddress,
    gumBallVault: ZeroAddress,
    stakedGBX: ZeroAddress,
    gumBallRouter: ZeroAddress,
    miningPool: ZeroAddress,
    genesisBootstrap: ZeroAddress,
    revenueRouter: ZeroAddress,
    holdUSDGStrategy: ZeroAddress,
    buybackBurnStrategy: ZeroAddress,
    eligibilityAllowlistChecker: ZeroAddress,
    permissionedPoolController: ZeroAddress,
    gbxPermissionsAdapter: ZeroAddress,
    adapterVerificationEscrow: ZeroAddress,
    launchGuardHook: ZeroAddress,
    genesisLiquidityCalculator: ZeroAddress,
    liquidityManager: ZeroAddress,
    lens: ZeroAddress,
    acquisitionStrategies: [],
    managerRewards: [],
  };
}

/** Exact contract accounts that receive or custody GBX in the pinned protocol and v4 position flow. */
export function requiredGBXContractHolders(
  config: DeploymentConfig,
  addresses: DeploymentAddresses,
): GBXContractHolderRecord[] {
  return [
    {
      role: 'GenesisClaims',
      address: addresses.genesisClaims,
      rationale: 'Custodies the fixed genesis claim allocation until claims.',
    },
    {
      role: 'MiningClaims',
      address: addresses.miningClaims,
      rationale: 'Custodies recurring mining emissions until claims.',
    },
    {
      role: 'LiquidityManager',
      address: addresses.liquidityManager,
      rationale: 'Custodies the constrained genesis residual and transient GBX during canonical migrations.',
    },
    {
      role: 'StakedGBX',
      address: addresses.stakedGBX,
      rationale: 'Escrows staked GBX one-for-one while sGBX is outstanding.',
    },
    {
      role: 'BuybackBurnStrategy',
      address: addresses.buybackBurnStrategy,
      rationale: 'Temporarily receives GBX and burns it in the same buyback transaction.',
    },
    {
      role: 'GumBallRouter',
      address: addresses.gumBallRouter,
      rationale: 'Temporarily holds exact caller GBX during a typed stake or redemption.',
    },
    config.liquidity.mode === 'permissioned'
      ? {
          role: 'UniswapV4PermissionsAdapter',
          address: addresses.gbxPermissionsAdapter,
          rationale: 'Custodies underlying GBX one-for-one while PoolManager holds the adapter currency.',
        }
      : {
          role: 'UniswapV4PoolManager',
          address: config.uniswapV4.poolManager,
          rationale: 'Custodies GBX settled into the unrestricted-test Uniswap v4 pool.',
        },
  ];
}

function assertGBXContractHolderManifest(config: DeploymentConfig, state: DeploymentState): void {
  const expected = requiredGBXContractHolders(config, state.addresses);
  if (!Array.isArray(state.gbxContractHolders) || state.gbxContractHolders.length !== expected.length) {
    throw new Error('deployment manifest GBX contract-holder list is incomplete');
  }
  const seen = new Set<string>();
  for (let index = 0; index < expected.length; index += 1) {
    const actual = state.gbxContractHolders[index]!;
    const intended = expected[index]!;
    if (
      actual.role !== intended.role ||
      actual.rationale !== intended.rationale ||
      getAddress(actual.address) !== getAddress(intended.address)
    ) {
      throw new Error(`deployment manifest GBX contract holder ${index} does not match the pinned flow`);
    }
    const canonicalAddress = getAddress(actual.address);
    if (seen.has(canonicalAddress)) throw new Error(`duplicate GBX contract holder ${canonicalAddress}`);
    seen.add(canonicalAddress);
  }
}

/** Live eligibility gate run before funding and by independent deployment verification. */
export async function assertGBXContractHoldersEligible(
  provider: Provider,
  config: DeploymentConfig,
  state: DeploymentState,
): Promise<void> {
  assertGBXContractHolderManifest(config, state);
  const module = new Contract(
    state.addresses.eligibilityModule,
    ['function canHold(address account) view returns (bool)'],
    provider,
  );
  for (const holder of state.gbxContractHolders) {
    await requireCode(provider, holder.address, `GBX contract holder ${holder.role}`);
    let allowed: boolean;
    try {
      allowed = (await module.getFunction('canHold')(holder.address)) as boolean;
    } catch (error) {
      throw new Error(`eligibility check failed for GBX contract holder ${holder.role}`, { cause: error });
    }
    if (!allowed) throw new Error(`GBX contract holder ${holder.role} is not eligible: ${holder.address}`);
  }
}

/** Deploys the entire fixed graph directly. This intentionally exposes no factory. */
export async function deployPhaseOne(
  hre: HardhatRuntimeEnvironment,
  config: DeploymentConfig,
  signer: Signer,
): Promise<DeploymentState> {
  const network = await hre.ethers.provider.getNetwork();
  await assertExternalDependencies(hre.ethers.provider, config, network.chainId);
  const initializer = await signer.getAddress();
  const records: ContractRecord[] = [];
  const transactions: Record<string, TransactionRecord> = {};
  const context: DeployContext = { hre, signer, records, transactions };
  const addresses = newAddresses();

  await recordExternalContract(hre.ethers.provider, records, 'ExternalUSDG', config.usdG);
  await recordExternalContract(
    hre.ethers.provider,
    records,
    'ExternalUniswapV4PoolManager',
    config.uniswapV4.poolManager,
  );
  await recordExternalContract(
    hre.ethers.provider,
    records,
    config.liquidity.mode === 'permissioned'
      ? 'ExternalUniswapPermissionedPositionManager'
      : 'ExternalUniswapV4PositionManager',
    config.uniswapV4.positionManager,
  );
  await recordExternalContract(hre.ethers.provider, records, 'ExternalPermit2', config.uniswapV4.permit2);
  if (config.liquidity.permissionedDependencies !== null) {
    const dependencies = config.liquidity.permissionedDependencies;
    await recordExternalContract(
      hre.ethers.provider,
      records,
      'ExternalUniswapPermissionsAdapterFactory',
      dependencies.permissionsAdapterFactory.address,
    );
    await recordExternalContract(
      hre.ethers.provider,
      records,
      'ExternalUniswapUniversalRouter',
      dependencies.universalRouter.address,
    );
    await recordExternalContract(
      hre.ethers.provider,
      records,
      'ExternalUniswapV4Quoter',
      dependencies.v4Quoter.address,
    );
    await recordExternalContract(
      hre.ethers.provider,
      records,
      'ExternalUniswapMixedRouteQuoterV2',
      dependencies.mixedRouteQuoterV2.address,
    );
  }
  await recordExternalContract(
    hre.ethers.provider,
    records,
    'ExternalCanonicalCreate2Deployer',
    CANONICAL_CREATE2_DEPLOYER,
  );
  if (config.eligibility.mode === 1) {
    await recordExternalContract(
      hre.ethers.provider,
      records,
      'ExternalEligibilityRegistry',
      config.eligibility.registry,
    );
  }
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    await recordExternalContract(
      hre.ethers.provider,
      records,
      `ExternalTargetToken:${index}`,
      config.assets.tokens[index]!,
    );
  }

  const protocolTimelock = await deployContract(context, 'ProtocolTimelock', [
    config.roles.protocolTimelockMultisig,
    initializer,
  ]);
  addresses.protocolTimelock = await protocolTimelock.getAddress();
  const emergencyGuardian = await deployContract(context, 'EmergencyGuardian', [
    addresses.protocolTimelock,
    config.roles.emergencyGuardianOperator,
  ]);
  addresses.emergencyGuardian = await emergencyGuardian.getAddress();

  if (config.eligibility.mode === 0) {
    addresses.eligibilityModule = await (await deployContract(context, 'NoopEligibilityModule', [])).getAddress();
  } else if (config.eligibility.mode === 1) {
    addresses.eligibilityModule = await (
      await deployContract(context, 'RegistryEligibilityModule', [config.eligibility.registry])
    ).getAddress();
  } else {
    addresses.eligibilityModule = getAddress(config.eligibility.module);
    const code = await requireCode(hre.ethers.provider, addresses.eligibilityModule, 'predeployed eligibility module');
    records.push({
      contractName: 'PredeployedEligibilityModule',
      address: addresses.eligibilityModule,
      constructorArguments: [],
      deploymentTransactionHash: null,
      blockNumber: null,
      runtimeCodeHash: keccak256(code),
      external: true,
    });
  }

  const gbx = await deployContract(context, 'GBXToken', [initializer, addresses.eligibilityModule]);
  addresses.gbx = await gbx.getAddress();
  const [acquisitionArtifact, rewardsArtifact, buybackArtifact, holdArtifact] = await Promise.all([
    hre.artifacts.readArtifact('AcquisitionStrategy'),
    hre.artifacts.readArtifact('ManagerRewards'),
    hre.artifacts.readArtifact('BuybackBurnStrategy'),
    hre.artifacts.readArtifact('HoldUSDGStrategy'),
  ]);
  const strategyDeployerArguments = [
    addresses.protocolTimelock,
    addresses.emergencyGuardian,
    addresses.gbx,
    initializer,
    [
      keccak256(acquisitionArtifact.bytecode),
      keccak256(rewardsArtifact.bytecode),
      keccak256(buybackArtifact.bytecode),
      keccak256(holdArtifact.bytecode),
      keccak256(AbiCoder.defaultAbiCoder().encode(['address[]'], [config.assets.tokens])),
    ],
    [
      (acquisitionArtifact.bytecode.length - 2) / 2,
      (rewardsArtifact.bytecode.length - 2) / 2,
      (buybackArtifact.bytecode.length - 2) / 2,
      (holdArtifact.bytecode.length - 2) / 2,
      config.assets.tokens.length,
    ],
  ];
  const strategyDeployer = await deployContract(context, 'StrategyDeployer', strategyDeployerArguments);
  addresses.strategyDeployer = await strategyDeployer.getAddress();
  const emissionController = await deployContract(context, 'EmissionController', [addresses.gbx, initializer]);
  addresses.emissionController = await emissionController.getAddress();
  const genesisClaims = await deployContract(context, 'GenesisClaims', [addresses.gbx, initializer]);
  addresses.genesisClaims = await genesisClaims.getAddress();
  const miningClaims = await deployContract(context, 'MiningClaims', [addresses.gbx, initializer]);
  addresses.miningClaims = await miningClaims.getAddress();

  const assetRegistry = await deployContract(context, 'AssetRegistry', [
    config.usdG,
    addresses.protocolTimelock,
    addresses.emergencyGuardian,
    addresses.strategyDeployer,
  ]);
  addresses.assetRegistry = await assetRegistry.getAddress();
  const allocationVoter = await deployContract(context, 'AllocationVoter', [
    config.usdG,
    addresses.assetRegistry,
    addresses.protocolTimelock,
    addresses.emergencyGuardian,
    initializer,
  ]);
  addresses.allocationVoter = await allocationVoter.getAddress();
  const gumBallVault = await deployContract(context, 'GumBallVault', [
    config.usdG,
    addresses.gbx,
    addresses.assetRegistry,
    addresses.allocationVoter,
    addresses.eligibilityModule,
  ]);
  addresses.gumBallVault = await gumBallVault.getAddress();
  const stakedGBX = await deployContract(context, 'StakedGBX', [addresses.gbx, addresses.allocationVoter]);
  addresses.stakedGBX = await stakedGBX.getAddress();
  const gumBallRouter = await deployContract(context, 'GumBallRouter', [
    addresses.gbx,
    addresses.stakedGBX,
    addresses.gumBallVault,
  ]);
  addresses.gumBallRouter = await gumBallRouter.getAddress();

  const miningPool = await deployContract(context, 'MiningPool', [
    {
      usdG: config.usdG,
      gumBallVault: addresses.gumBallVault,
      allocationVoter: addresses.allocationVoter,
      emissionController: addresses.emissionController,
      miningClaims: addresses.miningClaims,
      emergencyGuardian: addresses.emergencyGuardian,
      protocolTimelock: addresses.protocolTimelock,
      dependencyInitializer: initializer,
    },
  ]);
  addresses.miningPool = await miningPool.getAddress();
  const genesisBootstrap = await deployContract(context, 'GenesisBootstrap', [
    {
      usdG: config.usdG,
      gumBallVault: addresses.gumBallVault,
      allocationVoter: addresses.allocationVoter,
      emissionController: addresses.emissionController,
      genesisClaims: addresses.genesisClaims,
      miningPool: addresses.miningPool,
      genesisLiquidityBacker: config.roles.genesisLiquidityBacker,
      dependencyInitializer: initializer,
    },
    BigInt(config.genesis.minimumBootstrapUSDG),
    BigInt(config.genesis.bootstrapContributionCap),
  ]);
  addresses.genesisBootstrap = await genesisBootstrap.getAddress();

  const revenueRouter = await deployContract(context, 'RevenueRouter', [
    config.usdG,
    addresses.gumBallVault,
    addresses.allocationVoter,
  ]);
  addresses.revenueRouter = await revenueRouter.getAddress();

  const permissionedDependencies = config.liquidity.permissionedDependencies;
  let permissionedPoolController: Contract | null = null;
  if (permissionedDependencies !== null) {
    const checker = await deployContract(context, 'EligibilityAllowlistChecker', [
      addresses.gbx,
      addresses.eligibilityModule,
    ]);
    addresses.eligibilityAllowlistChecker = await checker.getAddress();
    permissionedPoolController = await deployContract(context, 'PermissionedPoolController', [
      {
        protocolTimelock: addresses.protocolTimelock,
        emergencyGuardian: addresses.emergencyGuardian,
        dependencyInitializer: initializer,
        gbx: addresses.gbx,
        usdG: config.usdG,
        permissionsAdapterFactory: permissionedDependencies.permissionsAdapterFactory.address,
        permissionedPositionManager: permissionedDependencies.permissionedPositionManager.address,
        universalRouter: permissionedDependencies.universalRouter.address,
        v4Quoter: permissionedDependencies.v4Quoter.address,
        mixedRouteQuoterV2: permissionedDependencies.mixedRouteQuoterV2.address,
        allowListChecker: addresses.eligibilityAllowlistChecker,
      },
    ]);
    addresses.permissionedPoolController = await permissionedPoolController.getAddress();
    const adapterReceipt = await wire(
      context,
      'permissioned-pool-adapter-create',
      permissionedPoolController,
      'createAdapter',
      [],
    );
    addresses.gbxPermissionsAdapter = getAddress(
      String(await permissionedPoolController.getFunction('PERMISSIONS_ADAPTER')()),
    );
    await recordTypedDeployment(
      context,
      'UniswapPermissionsAdapter',
      addresses.gbxPermissionsAdapter,
      [
        addresses.gbx,
        config.uniswapV4.poolManager,
        addresses.permissionedPoolController,
        addresses.eligibilityAllowlistChecker,
      ],
      adapterReceipt,
    );
  }

  const hookContractName = permissionedDependencies === null ? 'LaunchGuardHook' : 'GumBallPermissionedHook';
  const hookFactory = await hre.ethers.getContractFactory(hookContractName, signer);
  const hookArguments =
    permissionedDependencies === null
      ? [
          config.uniswapV4.poolManager,
          initializer,
          addresses.gbx,
          config.usdG,
          config.liquidity.poolFee,
          config.liquidity.tickSpacing,
        ]
      : [
          config.uniswapV4.poolManager,
          permissionedDependencies.permissionsAdapterFactory.address,
          initializer,
          addresses.gbxPermissionsAdapter,
          config.usdG,
          config.liquidity.poolFee,
          config.liquidity.tickSpacing,
        ];
  const hookRequest = await hookFactory.getDeployTransaction(...hookArguments);
  if (typeof hookRequest.data !== 'string') throw new Error(`${hookContractName} init code unavailable`);
  const expectedHookFlags =
    permissionedDependencies === null ? BEFORE_INITIALIZE_FLAG : GUMBALL_PERMISSIONED_HOOK_FLAGS;
  const mined = await mineHookSalt(
    CANONICAL_CREATE2_DEPLOYER,
    hookRequest.data,
    async (candidate) => (await hre.ethers.provider.getCode(candidate)) !== '0x',
    500_000,
    expectedHookFlags,
  );
  const hookDeployment = await signer.sendTransaction({
    to: CANONICAL_CREATE2_DEPLOYER,
    data: concat([mined.salt, hookRequest.data]),
  });
  const hookReceipt = await hookDeployment.wait();
  if (hookReceipt === null || hookReceipt.status !== 1) {
    throw new Error(`${hookContractName} CREATE2 deployment failed`);
  }
  const hookCode = await requireCode(hre.ethers.provider, mined.address, hookContractName);
  if (hookPermissionBits(mined.address) !== expectedHookFlags) {
    throw new Error(`${hookContractName} permission bits are invalid at ${mined.address}`);
  }
  addresses.launchGuardHook = mined.address;
  records.push({
    contractName: hookContractName,
    address: mined.address,
    constructorArguments: hookArguments,
    deploymentTransactionHash: hookReceipt.hash,
    blockNumber: hookReceipt.blockNumber,
    runtimeCodeHash: keccak256(hookCode),
    external: false,
  });
  transactions[`deploy:${hookContractName}:create2`] = {
    hash: hookReceipt.hash,
    blockNumber: hookReceipt.blockNumber,
  };
  const launchGuardHook = hookFactory.attach(mined.address) as Contract;

  const genesisLiquidityCalculator = await deployContract(context, 'GenesisLiquidityCalculator', []);
  addresses.genesisLiquidityCalculator = await genesisLiquidityCalculator.getAddress();
  if (permissionedDependencies !== null) {
    const escrow = await deployContract(context, 'AdapterVerificationEscrow', [
      config.uniswapV4.poolManager,
      addresses.gbxPermissionsAdapter,
      permissionedDependencies.permissionsAdapterFactory.address,
      config.uniswapV4.positionManager,
      addresses.launchGuardHook,
      initializer,
    ]);
    addresses.adapterVerificationEscrow = await escrow.getAddress();
    await wire(context, 'permissioned-pool-controller-graph', permissionedPoolController!, 'initializeGraph', [
      addresses.launchGuardHook,
      addresses.adapterVerificationEscrow,
    ]);
  }
  const liquidityDependencies = {
    gbx: addresses.gbx,
    usdG: config.usdG,
    gumBallVault: addresses.gumBallVault,
    allocationVoter: addresses.allocationVoter,
    poolManager: config.uniswapV4.poolManager,
    positionManager: config.uniswapV4.positionManager,
    permit2: config.uniswapV4.permit2,
    launchGuardHook: addresses.launchGuardHook,
    genesisBootstrap: addresses.genesisBootstrap,
    genesisLiquidityCalculator: addresses.genesisLiquidityCalculator,
    protocolTimelock: addresses.protocolTimelock,
    emergencyGuardian: addresses.emergencyGuardian,
  };
  const ladder = {
    poolFee: config.liquidity.poolFee,
    tickSpacing: config.liquidity.tickSpacing,
    allocationBps: config.liquidity.allocationBps,
    cumulativeTickDeltas: config.liquidity.cumulativeTickDeltas,
  };
  const liquidityManager = await deployContract(
    context,
    permissionedDependencies === null ? 'LiquidityManager' : 'PermissionedLiquidityManager',
    permissionedDependencies === null
      ? [liquidityDependencies, ladder]
      : [
          liquidityDependencies,
          ladder,
          permissionedDependencies.permissionsAdapterFactory.address,
          addresses.gbxPermissionsAdapter,
          addresses.adapterVerificationEscrow,
        ],
  );
  addresses.liquidityManager = await liquidityManager.getAddress();

  await wire(context, 'hook-liquidity-manager', launchGuardHook, 'initializeLiquidityManager', [
    addresses.liquidityManager,
  ]);
  if (permissionedDependencies !== null) {
    const escrow = await hre.ethers.getContractAt(
      'AdapterVerificationEscrow',
      addresses.adapterVerificationEscrow,
      signer,
    );
    await wire(context, 'verification-escrow-liquidity-manager', escrow, 'initializeLiquidityManager', [
      addresses.liquidityManager,
    ]);
  }
  await wire(context, 'bootstrap-liquidity-manager', genesisBootstrap, 'initializeLiquidityManager', [
    addresses.liquidityManager,
  ]);
  await wire(context, 'genesis-claims-source', genesisClaims, 'initializeSource', [addresses.genesisBootstrap]);
  await wire(context, 'mining-claims-source', miningClaims, 'initializeSource', [addresses.miningPool]);
  await wire(context, 'mining-genesis-bootstrap', miningPool, 'initializeGenesisBootstrap', [
    addresses.genesisBootstrap,
  ]);
  await wire(context, 'emission-callers', emissionController, 'initializeCallers', [
    addresses.genesisBootstrap,
    addresses.miningPool,
  ]);
  await wire(context, 'gbx-emission-controller', gbx, 'initializeEmissionController', [addresses.emissionController]);
  await wire(context, 'allocation-voter-dependencies', allocationVoter, 'initializeDependencies', [
    addresses.gumBallVault,
    addresses.stakedGBX,
    [addresses.genesisBootstrap, addresses.miningPool, addresses.revenueRouter, addresses.liquidityManager],
  ]);
  await wire(context, 'strategy-deployer-dependencies', strategyDeployer, 'initializeDependencies', [
    addresses.assetRegistry,
    addresses.allocationVoter,
    addresses.gumBallVault,
    addresses.eligibilityModule,
  ]);
  await wire(context, 'timelock-targets', protocolTimelock, 'initializeTargets', [
    addresses.assetRegistry,
    addresses.emergencyGuardian,
    addresses.allocationVoter,
    addresses.miningPool,
    addresses.liquidityManager,
    addresses.strategyDeployer,
  ]);
  await wire(
    context,
    'timelock-permissioned-pool-controller-finalize',
    protocolTimelock,
    'finalizePermissionedPoolController',
    [addresses.permissionedPoolController],
  );

  const holdReceipt = await wire(context, 'strategy-bootstrap-hold-usdg', protocolTimelock, 'bootstrapDeployHoldUSDG', [
    holdArtifact.bytecode,
  ]);
  addresses.holdUSDGStrategy = getAddress(String(await strategyDeployer.getFunction('canonicalHoldUSDGStrategy')()));
  await recordTypedDeployment(context, 'HoldUSDGStrategy', addresses.holdUSDGStrategy, [], holdReceipt);

  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    const targetToken = config.assets.tokens[index]!;
    const minimumLotUSDG = BigInt(config.strategies.minimumLotUSDG);
    const maximumLotUSDG = BigInt(config.strategies.maximumLotUSDG);
    const initialReferenceRate = BigInt(config.assets.initialReferenceRates[index]!);
    const receipt = await wire(
      context,
      `strategy-bootstrap-acquisition-${index}`,
      protocolTimelock,
      'bootstrapDeployAcquisition',
      [
        acquisitionArtifact.bytecode,
        rewardsArtifact.bytecode,
        targetToken,
        minimumLotUSDG,
        maximumLotUSDG,
        initialReferenceRate,
      ],
    );
    const strategyAddress = getAddress(
      String(await strategyDeployer.getFunction('acquisitionStrategyForToken')(targetToken)),
    );
    const pair = (await strategyDeployer.getFunction('acquisitionPair')(strategyAddress)) as unknown as {
      managerRewards: string;
    };
    const rewardsAddress = getAddress(pair.managerRewards);
    addresses.acquisitionStrategies.push(strategyAddress);
    addresses.managerRewards.push(rewardsAddress);
    await recordTypedDeployment(
      context,
      'AcquisitionStrategy',
      strategyAddress,
      [
        targetToken,
        addresses.gumBallVault,
        addresses.allocationVoter,
        addresses.assetRegistry,
        addresses.protocolTimelock,
        addresses.emergencyGuardian,
        addresses.strategyDeployer,
        minimumLotUSDG,
        maximumLotUSDG,
        initialReferenceRate,
      ],
      receipt,
    );
    await recordTypedDeployment(
      context,
      'ManagerRewards',
      rewardsAddress,
      [targetToken, strategyAddress, addresses.allocationVoter, addresses.gumBallVault, addresses.eligibilityModule],
      receipt,
    );
  }

  const buybackMinimumLotUSDG = BigInt(config.strategies.minimumLotUSDG);
  const buybackMaximumLotUSDG = BigInt(config.strategies.maximumLotUSDG);
  const buybackInitialReferenceRate = BigInt(config.strategies.buybackInitialReferenceRate);
  const buybackReceipt = await wire(context, 'strategy-bootstrap-buyback', protocolTimelock, 'bootstrapDeployBuyback', [
    buybackArtifact.bytecode,
    buybackMinimumLotUSDG,
    buybackMaximumLotUSDG,
    buybackInitialReferenceRate,
  ]);
  addresses.buybackBurnStrategy = getAddress(
    String(await strategyDeployer.getFunction('canonicalBuybackBurnStrategy')()),
  );
  await recordTypedDeployment(
    context,
    'BuybackBurnStrategy',
    addresses.buybackBurnStrategy,
    [
      addresses.gbx,
      addresses.gumBallVault,
      addresses.allocationVoter,
      addresses.assetRegistry,
      addresses.protocolTimelock,
      addresses.emergencyGuardian,
      buybackMinimumLotUSDG,
      buybackMaximumLotUSDG,
      buybackInitialReferenceRate,
    ],
    buybackReceipt,
  );
  await wire(context, 'strategy-bootstrap-finalize', protocolTimelock, 'finalizeStrategyBootstrap', [
    config.assets.tokens,
  ]);

  const lens = await deployContract(context, 'GumBallLens', [
    addresses.gbx,
    addresses.gumBallVault,
    addresses.assetRegistry,
    addresses.allocationVoter,
    addresses.stakedGBX,
  ]);
  addresses.lens = await lens.getAddress();

  return {
    schemaVersion: 1,
    chainId: network.chainId.toString(),
    networkName: hre.network.name,
    phase: 'DEPLOYED_AND_WIRED',
    configHash: deploymentConfigHash(config),
    dependencyInitializer: initializer,
    hookSalt: mined.salt,
    addresses,
    contracts: records,
    gbxContractHolders: requiredGBXContractHolders(config, addresses),
    transactions,
    timelockOperations: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function scheduleRegistryPhaseLocalEOA(
  provider: Provider,
  signer: Signer,
  config: DeploymentConfig,
  state: DeploymentState,
  statePath: string,
): Promise<void> {
  if (state.phase !== 'DEPLOYED_AND_WIRED' && state.phase !== 'TIMELOCK_SCHEDULING') {
    throw new Error(`cannot schedule registry operations from phase ${state.phase}`);
  }
  const chainId = (await provider.getNetwork()).chainId;
  if (chainId !== 31_337n) {
    throw new Error('direct EOA timelock scheduling is restricted to chain-31337 local rehearsal');
  }
  assertStateMatches(config, state, chainId);
  await assertExternalAssetIdentities(provider, config);
  const timelock = new Contract(state.addresses.protocolTimelock, TIMELOCK_ABI, signer);
  const proposer = getAddress((await timelock.getFunction('PROPOSER_MULTISIG')()) as string);
  if (proposer !== getAddress(await signer.getAddress())) throw new Error(`scheduler must be proposer ${proposer}`);

  const operations = registryOperations(config, state.addresses, chainId);
  state.phase = 'TIMELOCK_SCHEDULING';
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index]!;
    const operationId = (await timelock.getFunction('hashOperation')(
      operation.target,
      operation.data,
      operation.salt,
    )) as string;
    const requiredDelay = (await timelock.getFunction('requiredDelay')(operation.target, operation.data)) as bigint;
    if (requiredDelay !== CRITICAL_CHANGE_DELAY_SECONDS) {
      throw new Error(`${operation.label} has unexpected delay ${requiredDelay}`);
    }
    let readyAt = (await timelock.getFunction('operationReadyAt')(operationId)) as bigint;
    let transactionHash: string | null = null;
    if (readyAt === 0n) {
      const transaction = (await timelock.getFunction('schedule')(
        operation.target,
        operation.data,
        operation.salt,
      )) as ContractTransactionResponse;
      const receipt = await recordTransaction(state.transactions, `timelock:schedule:${index}`, transaction);
      transactionHash = receipt.hash;
      readyAt = (await timelock.getFunction('operationReadyAt')(operationId)) as bigint;
    }
    state.timelockOperations[index] = {
      label: operation.label,
      target: operation.target,
      data: operation.data,
      salt: operation.salt,
      operationId,
      requiredDelaySeconds: requiredDelay.toString(),
      readyAt: readyAt.toString(),
      scheduleTransactionHash: transactionHash ?? state.timelockOperations[index]?.scheduleTransactionHash ?? null,
      executeTransactionHash: state.timelockOperations[index]?.executeTransactionHash ?? null,
      executed: state.timelockOperations[index]?.executed ?? false,
    };
    await writeDeploymentState(statePath, state);
  }
  state.phase = 'TIMELOCK_OPERATIONS_SCHEDULED';
  await writeDeploymentState(statePath, state);
}

export async function executeRegistryPhase(
  provider: Provider,
  signer: Signer,
  config: DeploymentConfig,
  state: DeploymentState,
  statePath: string,
): Promise<void> {
  if (state.phase !== 'TIMELOCK_OPERATIONS_SCHEDULED' && state.phase !== 'TIMELOCK_EXECUTING') {
    throw new Error(`cannot execute registry operations from phase ${state.phase}`);
  }
  const chainId = (await provider.getNetwork()).chainId;
  assertStateMatches(config, state, chainId);
  await assertExternalAssetIdentities(provider, config);
  const timelock = new Contract(state.addresses.protocolTimelock, TIMELOCK_ABI, signer);
  const expectedOperations = registryOperations(config, state.addresses, chainId);
  if (state.timelockOperations.length !== expectedOperations.length) {
    throw new Error('timelock operation manifest is incomplete');
  }
  state.phase = 'TIMELOCK_EXECUTING';

  for (let index = 0; index < expectedOperations.length; index += 1) {
    const expected = expectedOperations[index]!;
    const operation = state.timelockOperations[index]!;
    if (
      operation.label !== expected.label ||
      getAddress(operation.target) !== getAddress(expected.target) ||
      operation.data !== expected.data ||
      operation.salt !== expected.salt
    ) {
      throw new Error(`timelock operation ${index} does not match config and deployment manifest`);
    }
    if (operation.executed) continue;
    if (index >= 2 && index < config.assets.tokens.length + 2) {
      await assertExternalAssetIdentities(provider, config);
    }
    const readyAt = (await timelock.getFunction('operationReadyAt')(operation.operationId)) as bigint;
    if (readyAt === 0n) {
      if (await registryOperationApplied(provider, index, config, state.addresses)) {
        operation.executed = true;
        await writeDeploymentState(statePath, state);
        continue;
      }
      throw new Error(`timelock operation ${index} is not scheduled and its effect is absent`);
    }
    const latestBlock = await provider.getBlock('latest');
    if (latestBlock === null) throw new Error('latest block unavailable');
    if (BigInt(latestBlock.timestamp) < readyAt) {
      throw new Error(`seven-day timelock is not mature; operation ${index} is ready at ${readyAt}`);
    }
    const transaction = (await timelock.getFunction('execute')(
      operation.target,
      operation.data,
      operation.salt,
    )) as ContractTransactionResponse;
    const receipt = await recordTransaction(state.transactions, `timelock:execute:${index}`, transaction);
    operation.executeTransactionHash = receipt.hash;
    operation.executed = true;
    await writeDeploymentState(statePath, state);
  }

  const registry = new Contract(
    state.addresses.assetRegistry,
    [
      'function vault() view returns (address)',
      'function assetCount() view returns (uint256)',
      'function strategyCount() view returns (uint256)',
    ],
    provider,
  );
  if (getAddress((await registry.getFunction('vault')()) as string) !== getAddress(state.addresses.gumBallVault)) {
    throw new Error('registry vault mismatch after timelock execution');
  }
  if ((await registry.getFunction('assetCount')()) !== BigInt(config.assets.tokens.length + 1)) {
    throw new Error('registry asset count mismatch after timelock execution');
  }
  if ((await registry.getFunction('strategyCount')()) !== BigInt(config.assets.tokens.length + 2)) {
    throw new Error('registry strategy count mismatch after timelock execution');
  }
  state.phase = 'REGISTRY_CONFIGURED';
  await writeDeploymentState(statePath, state);
}

async function registryOperationApplied(
  provider: Provider,
  operationIndex: number,
  config: DeploymentConfig,
  addresses: DeploymentAddresses,
): Promise<boolean> {
  const registry = new Contract(
    addresses.assetRegistry,
    [
      'function vault() view returns (address)',
      'function isRegisteredAsset(address token) view returns (bool)',
      'function isLiveStrategy(address strategy) view returns (bool)',
    ],
    provider,
  );
  if (operationIndex === 0) {
    return getAddress((await registry.getFunction('vault')()) as string) === getAddress(addresses.gumBallVault);
  }
  if (operationIndex === 1) {
    return (await registry.getFunction('isRegisteredAsset')(config.usdG)) as boolean;
  }
  const targetIndex = operationIndex - 2;
  if (targetIndex < config.assets.tokens.length) {
    return (await registry.getFunction('isRegisteredAsset')(config.assets.tokens[targetIndex]!)) as boolean;
  }
  return (await registry.getFunction('isLiveStrategy')(addresses.buybackBurnStrategy)) as boolean;
}

export async function fundGenesisPhase(
  provider: Provider,
  signer: Signer,
  config: DeploymentConfig,
  state: DeploymentState,
  statePath: string,
): Promise<void> {
  if (state.phase !== 'REGISTRY_CONFIGURED' && state.phase !== 'GENESIS_OPENED') {
    throw new Error(`cannot fund genesis from phase ${state.phase}`);
  }
  assertStateMatches(config, state, (await provider.getNetwork()).chainId);
  await assertExternalAssetIdentities(provider, config);
  await assertGBXContractHoldersEligible(provider, config, state);
  const bootstrap = new Contract(state.addresses.genesisBootstrap, GENESIS_ABI, signer);
  const expectedBacker = getAddress((await bootstrap.getFunction('GENESIS_LIQUIDITY_BACKER')()) as string);
  if (expectedBacker !== getAddress(await signer.getAddress()))
    throw new Error(`genesis signer must be ${expectedBacker}`);
  let bootstrapState = Number(await bootstrap.getFunction('state')());
  if (bootstrapState === 0 || bootstrapState === 1) {
    const maxSponsor = (await bootstrap.getFunction('maxSponsorUSDG')()) as bigint;
    const escrow = (await bootstrap.getFunction('sponsorEscrow')()) as bigint;
    if (escrow < maxSponsor) {
      const usdG = new Contract(config.usdG, ERC20_ABI, signer);
      const approval = (await usdG.getFunction('approve')(
        state.addresses.genesisBootstrap,
        maxSponsor - escrow,
      )) as ContractTransactionResponse;
      await recordTransaction(state.transactions, 'genesis:sponsor-approval', approval);
      const funding = (await bootstrap.getFunction('fundSponsor')(maxSponsor - escrow)) as ContractTransactionResponse;
      await recordTransaction(state.transactions, 'genesis:sponsor-funding', funding);
    }
    bootstrapState = Number(await bootstrap.getFunction('state')());
    if (bootstrapState === 1) {
      const opening = (await bootstrap.getFunction('openContributions')()) as ContractTransactionResponse;
      await recordTransaction(state.transactions, 'genesis:open', opening);
    }
  }
  if (Number(await bootstrap.getFunction('state')()) !== 2) throw new Error('genesis did not enter CONTRIBUTING state');
  state.phase = 'GENESIS_OPENED';
  await writeDeploymentState(statePath, state);
}

export async function settleGenesisPhase(
  provider: Provider,
  signer: Signer,
  config: DeploymentConfig,
  state: DeploymentState,
  statePath: string,
): Promise<void> {
  if (state.phase !== 'GENESIS_OPENED' && state.phase !== 'GENESIS_SETTLED') {
    throw new Error(`cannot settle genesis from phase ${state.phase}`);
  }
  assertStateMatches(config, state, (await provider.getNetwork()).chainId);
  await assertExternalAssetIdentities(provider, config);
  const bootstrap = new Contract(state.addresses.genesisBootstrap, GENESIS_ABI, signer);
  let bootstrapState = Number(await bootstrap.getFunction('state')());
  if (bootstrapState === 2) {
    const latestBlock = await provider.getBlock('latest');
    if (latestBlock === null) throw new Error('latest block unavailable');
    const contributionEnd = (await bootstrap.getFunction('contributionEnd')()) as bigint;
    if (BigInt(latestBlock.timestamp) < contributionEnd) {
      throw new Error(`genesis contribution window remains open until ${contributionEnd}`);
    }
    const close = (await bootstrap.getFunction('close')()) as ContractTransactionResponse;
    await recordTransaction(state.transactions, 'genesis:close', close);
    bootstrapState = Number(await bootstrap.getFunction('state')());
  }
  if (bootstrapState === 3) {
    const communityUsdG = (await bootstrap.getFunction('communityUSDG')()) as bigint;
    const sqrtPriceX96 = expectedGenesisSqrtPriceX96(poolFacingGBXCurrency(config, state), config.usdG, communityUsdG);
    const settle = (await bootstrap.getFunction('settle')(sqrtPriceX96)) as ContractTransactionResponse;
    await recordTransaction(state.transactions, 'genesis:settle', settle);
    bootstrapState = Number(await bootstrap.getFunction('state')());
  }
  if (bootstrapState === 5) throw new Error('genesis is refundable and cannot be settled');
  if (bootstrapState !== 4) throw new Error(`genesis did not settle; state=${bootstrapState}`);
  if (config.liquidity.mode === 'permissioned') {
    const controller = new Contract(
      state.addresses.permissionedPoolController,
      PERMISSIONED_GENESIS_ACTIVATION_ABI,
      signer,
    );
    const adapter = new Contract(state.addresses.gbxPermissionsAdapter, PERMISSIONS_ADAPTER_SWAP_ABI, signer);
    const consumed = (await controller.getFunction('bootstrapSwapEnableConsumed')()) as boolean;
    const enabled = (await adapter.getFunction('swappingEnabled')()) as boolean;
    if (!consumed && !enabled) {
      const activation = (await controller.getFunction('enableSwappingAfterGenesis')()) as ContractTransactionResponse;
      await recordTransaction(state.transactions, 'genesis:enable-permissioned-swaps', activation);
    }
    if (
      !(await controller.getFunction('bootstrapSwapEnableConsumed')()) ||
      !(await adapter.getFunction('swappingEnabled')())
    ) {
      throw new Error('permissioned genesis did not activate canonical swaps');
    }
  }
  state.phase = 'GENESIS_SETTLED';
  await writeDeploymentState(statePath, state);
}

export function assertStateMatches(config: DeploymentConfig, state: DeploymentState, chainId: bigint): void {
  if (state.chainId !== chainId.toString()) {
    throw new Error(`deployment manifest chain ${state.chainId} does not match provider chain ${chainId}`);
  }
  const expectedHash = deploymentConfigHash(config);
  if (state.configHash !== expectedHash) throw new Error('deployment config changed after phase one');
  if (
    state.addresses.acquisitionStrategies.length !== config.assets.tokens.length ||
    state.addresses.managerRewards.length !== config.assets.tokens.length
  ) {
    throw new Error('deployment manifest strategy arrays do not match the reviewed asset config');
  }
  assertGBXContractHolderManifest(config, state);
}

export function connect(address: string, abi: readonly string[], runner: ContractRunner): Contract {
  return new Contract(address, abi, runner);
}
