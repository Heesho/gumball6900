import {
  allocationVoterAbi,
  assetRegistryAbi,
  emergencyGuardianAbi,
  liquidityManagerAbi,
  miningPoolAbi,
  type ContractTransaction,
} from '@gumball-6900/sdk';
import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  isAddressEqual,
  keccak256,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';

import type { LiveRuntimeDeployment } from './runtime-types';

export const guardianAdminAbi = emergencyGuardianAbi;
const auctionStrategyTimelockAbi = parseAbi([
  'function unpauseFills()',
  'function resetReferenceRate(uint256 expectedReferenceRate, uint256 newReferenceRate)',
]);
export const protocolTimelockAdminAbi = parseAbi([
  'function schedule(address target, bytes data, bytes32 salt) returns (bytes32 operationId)',
  'function cancel(bytes32 operationId)',
  'function execute(address target, bytes data, bytes32 salt) returns (bytes returnData)',
  'function hashOperation(address target, bytes data, bytes32 salt) view returns (bytes32 operationId)',
  'function requiredDelay(address target, bytes data) view returns (uint256 delay)',
  'function operationReadyAt(bytes32 operationId) view returns (uint64 readyAt)',
  'function PROPOSER_MULTISIG() view returns (address)',
  'function assetRegistry() view returns (address)',
  'function emergencyGuardian() view returns (address)',
  'function allocationVoter() view returns (address)',
  'function miningPool() view returns (address)',
  'function liquidityManager() view returns (address)',
  'function strategyDeployer() view returns (address)',
  'function targetsInitialized() view returns (bool)',
  'function strategyBootstrapFinalized() view returns (bool)',
  'function BOUNDED_MAINTENANCE_DELAY() view returns (uint256)',
  'function CRITICAL_CHANGE_DELAY() view returns (uint256)',
  'function EXECUTION_GRACE_PERIOD() view returns (uint256)',
]);

/** This focused ABI is deliberately local until the generated SDK ABI is refreshed with StrategyDeployer. */
export const strategyDeployerAdminAbi = parseAbi([
  'function deployAcquisition(bytes strategyCreationCode, bytes rewardsCreationCode, address targetToken, uint256 minimumLotUSDG, uint256 maximumLotUSDG, uint256 initialReferenceRate) returns (address strategy, address rewards)',
  'function ACQUISITION_STRATEGY_CREATION_CODE_HASH() view returns (bytes32)',
  'function ACQUISITION_STRATEGY_CREATION_CODE_LENGTH() view returns (uint256)',
  'function MANAGER_REWARDS_CREATION_CODE_HASH() view returns (bytes32)',
  'function MANAGER_REWARDS_CREATION_CODE_LENGTH() view returns (uint256)',
  'function EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT() view returns (uint256)',
  'function EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH() view returns (bytes32)',
  'function PROTOCOL_TIMELOCK() view returns (address)',
  'function EMERGENCY_GUARDIAN() view returns (address)',
  'function GBX() view returns (address)',
  'function USDG() view returns (address)',
  'function GUM_BALL_VAULT() view returns (address)',
  'function ALLOCATION_VOTER() view returns (address)',
  'function ASSET_REGISTRY() view returns (address)',
  'function ELIGIBILITY_MODULE() view returns (address)',
  'function dependenciesConfigured() view returns (bool)',
  'function strategyBootstrapFinalized() view returns (bool)',
  'function bootstrapAcquisitionTargetCount() view returns (uint256)',
  'function bootstrapAcquisitionTargetsHash() view returns (bytes32)',
  'function acquisitionStrategyForToken(address token) view returns (address)',
  'function acquisitionPair(address strategy) view returns (address targetToken, address managerRewards, address gumBallVault, address allocationVoter, address assetRegistry, address protocolTimelock, address emergencyGuardian, address eligibilityModule, bytes32 strategyRuntimeCodeHash, bytes32 rewardsRuntimeCodeHash)',
]);

export const BOUNDED_MAINTENANCE_DELAY_SECONDS = 48n * 60n * 60n;
export const CRITICAL_CHANGE_DELAY_SECONDS = 7n * 24n * 60n * 60n;
export const ZERO_TIMELOCK_SALT = `0x${'00'.repeat(32)}` as Hex;

const UINT128_MAX = (1n << 128n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;
export const MAX_AUCTION_REFERENCE_RATE = UINT256_MAX / 2n;
const MIN_TICK = -887_272;
const MAX_TICK = 887_272;

export interface TimelockAssetConfig {
  readonly token: Address;
  readonly assetId: Hex;
  readonly symbolHash: Hex;
  readonly decimals: number;
  readonly strategy: Address;
  readonly rewards: Address;
  readonly isStockToken: boolean;
  readonly acquisitionEnabled: boolean;
  readonly redemptionEnabled: boolean;
}

export interface TimelockStockTokenDependency {
  readonly tokenRuntimeCodeHash: Hex;
  readonly beacon: Address;
  readonly beaconRuntimeCodeHash: Hex;
  readonly implementation: Address;
  readonly implementationRuntimeCodeHash: Hex;
  readonly uiMultiplier: bigint;
}

export interface TimelockPoolKey {
  readonly currency0: Address;
  readonly currency1: Address;
  readonly fee: number;
  readonly tickSpacing: number;
  readonly hooks: Address;
}

export interface TimelockMigrationRemoval {
  readonly positionId: bigint;
  readonly amount0Min: bigint;
  readonly amount1Min: bigint;
}

export interface TimelockMigrationReplacement {
  readonly tickLower: number;
  readonly tickUpper: number;
  readonly liquidity: bigint;
  readonly amount0Max: bigint;
  readonly amount1Max: bigint;
}

export interface TimelockMigrationPlan {
  readonly destinationPoolKey: TimelockPoolKey;
  readonly removals: readonly TimelockMigrationRemoval[];
  readonly replacements: readonly TimelockMigrationReplacement[];
  readonly deadline: bigint;
}

export type GuardianAction =
  | { kind: 'pause-mining' }
  | { kind: 'invalidate-mining-epoch' }
  | { kind: 'pause-signals' }
  | { kind: 'pause-strategy'; strategy: Address }
  | { kind: 'disable-acquisition'; token: Address }
  | { kind: 'disable-standalone'; strategy: Address }
  | { kind: 'pause-liquidity-migrations' };

/**
 * Closed inventory of post-launch ProtocolTimelock operations represented by the production console.
 * Prelaunch-only configureVault/registerStandaloneStrategy bootstrap calls are intentionally absent.
 */
export type TimelockOperation =
  | { kind: 'unpause-mining' }
  | { kind: 'unpause-signals' }
  | { kind: 'unpause-strategy'; strategy: Address }
  | {
      kind: 'reset-reference-rate';
      strategy: Address;
      expectedReferenceRate: bigint;
      newReferenceRate: bigint;
    }
  | { kind: 'rotate-guardian'; newOperator: Address }
  | { kind: 'enable-acquisition'; token: Address }
  | { kind: 'enable-standalone'; strategy: Address }
  | { kind: 'reactivate-strategy'; strategy: Address }
  | { kind: 'set-redemption-enabled'; token: Address; enabled: boolean }
  | { kind: 'unpause-liquidity-migrations' }
  | {
      kind: 'deploy-acquisition';
      strategyCreationCode: Hex;
      rewardsCreationCode: Hex;
      targetToken: Address;
      minimumLotUSDG: bigint;
      maximumLotUSDG: bigint;
      initialReferenceRate: bigint;
    }
  | { kind: 'register-asset'; config: TimelockAssetConfig }
  | {
      kind: 'register-stock-asset';
      config: TimelockAssetConfig;
      dependency: TimelockStockTokenDependency;
    }
  | { kind: 'migrate-liquidity'; plan: TimelockMigrationPlan };

export interface EncodedTimelockOperation {
  readonly target: Address;
  readonly data: Hex;
  readonly salt: Hex;
  readonly expectedDelay: bigint;
}

function transaction(to: Address, data: Hex): ContractTransaction {
  return { to: getAddress(to), data, value: 0n };
}

function requiredAddress(value: Address, label: string): Address {
  if (!isAddress(value, { strict: false }) || isAddressEqual(value, zeroAddress)) {
    throw new TypeError(`${label} must be a nonzero EVM address.`);
  }
  return getAddress(value);
}

function bytes32(value: Hex, label: string): Hex {
  if (!/^0x[\da-f]{64}$/iu.test(value)) throw new TypeError(`${label} must be exactly 32 bytes.`);
  if (/^0x0{64}$/iu.test(value)) throw new TypeError(`${label} must not be zero.`);
  return value.toLowerCase() as Hex;
}

function uint256(value: bigint, label: string, allowZero = false): bigint {
  if (value < 0n || value > UINT256_MAX || (!allowZero && value === 0n)) {
    throw new RangeError(`${label} is outside its supported unsigned integer range.`);
  }
  return value;
}

function uint128(value: bigint, label: string): bigint {
  if (value < 0n || value > UINT128_MAX) throw new RangeError(`${label} must fit uint128.`);
  return value;
}

function validateAssetConfig(config: TimelockAssetConfig, stock: boolean): TimelockAssetConfig {
  const token = requiredAddress(config.token, 'Asset token');
  const strategy = requiredAddress(config.strategy, 'Asset strategy');
  const rewards = requiredAddress(config.rewards, 'ManagerRewards');
  if (!Number.isSafeInteger(config.decimals) || config.decimals < 0 || config.decimals > 18) {
    throw new RangeError('Asset decimals must be an integer from 0 through 18.');
  }
  if (config.isStockToken !== stock) throw new TypeError('Asset stock identity does not match the selected operation.');
  if (!config.acquisitionEnabled || !config.redemptionEnabled) {
    throw new TypeError('Post-launch asset admission starts with acquisition and redemption enabled.');
  }
  return {
    ...config,
    token,
    strategy,
    rewards,
    assetId: bytes32(config.assetId, 'Asset ID'),
    symbolHash: bytes32(config.symbolHash, 'Symbol hash'),
  };
}

function validateStockDependency(dependency: TimelockStockTokenDependency): TimelockStockTokenDependency {
  return {
    tokenRuntimeCodeHash: bytes32(dependency.tokenRuntimeCodeHash, 'Token runtime code hash'),
    beacon: requiredAddress(dependency.beacon, 'Stock-token beacon'),
    beaconRuntimeCodeHash: bytes32(dependency.beaconRuntimeCodeHash, 'Beacon runtime code hash'),
    implementation: requiredAddress(dependency.implementation, 'Stock-token implementation'),
    implementationRuntimeCodeHash: bytes32(
      dependency.implementationRuntimeCodeHash,
      'Implementation runtime code hash',
    ),
    uiMultiplier: uint256(dependency.uiMultiplier, 'UI multiplier'),
  };
}

export function validateMigrationPlan(plan: TimelockMigrationPlan): TimelockMigrationPlan {
  const { destinationPoolKey } = plan;
  const poolKey = {
    currency0: requiredAddress(destinationPoolKey.currency0, 'Pool currency0'),
    currency1: requiredAddress(destinationPoolKey.currency1, 'Pool currency1'),
    fee: destinationPoolKey.fee,
    tickSpacing: destinationPoolKey.tickSpacing,
    hooks: requiredAddress(destinationPoolKey.hooks, 'Pool hook'),
  };
  if (
    isAddressEqual(poolKey.currency0, poolKey.currency1) ||
    BigInt(poolKey.currency0.toLowerCase()) > BigInt(poolKey.currency1.toLowerCase())
  ) {
    throw new TypeError('Migration PoolKey currencies must be unique and canonically ordered.');
  }
  if (!Number.isSafeInteger(poolKey.fee) || poolKey.fee < 0 || poolKey.fee > 0xffffff) {
    throw new RangeError('Migration pool fee must fit uint24.');
  }
  if (!Number.isSafeInteger(poolKey.tickSpacing) || poolKey.tickSpacing <= 0 || poolKey.tickSpacing > 0x7fffff) {
    throw new RangeError('Migration tick spacing must be a positive int24.');
  }
  if (plan.removals.length < 1 || plan.removals.length > 16) {
    throw new RangeError('A migration must remove between one and sixteen positions.');
  }
  if (plan.replacements.length < 1 || plan.replacements.length > 16) {
    throw new RangeError('A migration must add between one and sixteen replacement positions.');
  }
  const seen = new Set<string>();
  const removals = plan.removals.map((removal, index) => {
    const positionId = uint256(removal.positionId, `Removal ${index + 1} position ID`);
    if (seen.has(positionId.toString()))
      throw new TypeError(`Removal position ${positionId.toString()} is duplicated.`);
    seen.add(positionId.toString());
    const amount0Min = uint128(removal.amount0Min, `Removal ${index + 1} amount0 minimum`);
    const amount1Min = uint128(removal.amount1Min, `Removal ${index + 1} amount1 minimum`);
    if (amount0Min === 0n && amount1Min === 0n) {
      throw new RangeError(`Removal ${index + 1} must commit a nonzero minimum output.`);
    }
    return { positionId, amount0Min, amount1Min };
  });
  const replacements = plan.replacements.map((replacement, index) => {
    if (
      !Number.isSafeInteger(replacement.tickLower) ||
      !Number.isSafeInteger(replacement.tickUpper) ||
      replacement.tickLower < MIN_TICK ||
      replacement.tickUpper > MAX_TICK ||
      replacement.tickLower >= replacement.tickUpper ||
      replacement.tickLower % poolKey.tickSpacing !== 0 ||
      replacement.tickUpper % poolKey.tickSpacing !== 0
    ) {
      throw new RangeError(`Replacement ${index + 1} ticks are invalid or not aligned to the canonical spacing.`);
    }
    const liquidity = uint128(replacement.liquidity, `Replacement ${index + 1} liquidity`);
    if (liquidity === 0n) throw new RangeError(`Replacement ${index + 1} liquidity must be positive.`);
    const amount0Max = uint128(replacement.amount0Max, `Replacement ${index + 1} amount0 maximum`);
    const amount1Max = uint128(replacement.amount1Max, `Replacement ${index + 1} amount1 maximum`);
    if (amount0Max === 0n && amount1Max === 0n) {
      throw new RangeError(`Replacement ${index + 1} must commit a nonzero maximum input.`);
    }
    return { ...replacement, liquidity, amount0Max, amount1Max };
  });
  return { destinationPoolKey: poolKey, removals, replacements, deadline: uint256(plan.deadline, 'Deadline') };
}

export function runtimeAdminRole(
  account: Address | undefined,
  runtime: LiveRuntimeDeployment,
): 'guardian' | 'timelock-proposer' | 'both' | 'none' {
  if (account === undefined) return 'none';
  const guardian = isAddressEqual(account, runtime.admin.guardianOperator);
  const proposer = isAddressEqual(account, runtime.admin.protocolTimelockProposer);
  if (guardian && proposer) return 'both';
  if (guardian) return 'guardian';
  if (proposer) return 'timelock-proposer';
  return 'none';
}

export function buildGuardianAdminAction(runtime: LiveRuntimeDeployment, action: GuardianAction): ContractTransaction {
  if (action.kind === 'pause-mining') {
    return transaction(
      runtime.admin.emergencyGuardian,
      encodeFunctionData({
        abi: guardianAdminAbi,
        functionName: 'pauseMiningContributions',
        args: [runtime.addresses.miningPool],
      }),
    );
  }
  if (action.kind === 'invalidate-mining-epoch') {
    return transaction(
      runtime.admin.emergencyGuardian,
      encodeFunctionData({
        abi: guardianAdminAbi,
        functionName: 'invalidateMiningEpoch',
        args: [runtime.addresses.miningPool],
      }),
    );
  }
  if (action.kind === 'pause-signals') {
    return transaction(
      runtime.admin.emergencyGuardian,
      encodeFunctionData({ abi: guardianAdminAbi, functionName: 'pauseSignalActivations' }),
    );
  }
  if (action.kind === 'pause-strategy') {
    return transaction(
      runtime.admin.emergencyGuardian,
      encodeFunctionData({
        abi: guardianAdminAbi,
        functionName: 'pauseStrategyFills',
        args: [requiredAddress(action.strategy, 'Strategy')],
      }),
    );
  }
  if (action.kind === 'disable-standalone') {
    return transaction(
      runtime.admin.emergencyGuardian,
      encodeFunctionData({
        abi: guardianAdminAbi,
        functionName: 'disableStandaloneStrategy',
        args: [requiredAddress(action.strategy, 'Standalone strategy')],
      }),
    );
  }
  if (action.kind === 'pause-liquidity-migrations') {
    return transaction(
      runtime.admin.emergencyGuardian,
      encodeFunctionData({
        abi: guardianAdminAbi,
        functionName: 'pauseLiquidityMigrations',
        args: [runtime.addresses.liquidityManager],
      }),
    );
  }
  return transaction(
    runtime.admin.emergencyGuardian,
    encodeFunctionData({
      abi: guardianAdminAbi,
      functionName: 'disableAssetAcquisition',
      args: [requiredAddress(action.token, 'Asset token')],
    }),
  );
}

export function buildKnownTimelockCancel(runtime: LiveRuntimeDeployment, operationId: Hex): ContractTransaction {
  return transaction(
    runtime.admin.protocolTimelock,
    encodeFunctionData({
      abi: protocolTimelockAdminAbi,
      functionName: 'cancel',
      args: [bytes32(operationId, 'Operation ID')],
    }),
  );
}

export function runtimeStrategyDeployerAddress(runtime: LiveRuntimeDeployment): Address {
  return requiredAddress(runtime.addresses.strategyDeployer, 'StrategyDeployer');
}

export function encodeKnownTimelockOperation(
  runtime: LiveRuntimeDeployment,
  operation: TimelockOperation,
): EncodedTimelockOperation {
  if (operation.kind === 'unpause-mining') {
    return {
      target: runtime.addresses.miningPool,
      data: encodeFunctionData({ abi: miningPoolAbi, functionName: 'unpauseContributions' }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'unpause-signals') {
    return {
      target: runtime.addresses.allocationVoter,
      data: encodeFunctionData({ abi: allocationVoterAbi, functionName: 'unpauseSignalActivations' }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'unpause-strategy') {
    return {
      target: requiredAddress(operation.strategy, 'Strategy'),
      data: encodeFunctionData({ abi: auctionStrategyTimelockAbi, functionName: 'unpauseFills' }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'reset-reference-rate') {
    return {
      target: requiredAddress(operation.strategy, 'Strategy'),
      data: encodeFunctionData({
        abi: auctionStrategyTimelockAbi,
        functionName: 'resetReferenceRate',
        args: [
          uint256(operation.expectedReferenceRate, 'Expected reference rate'),
          uint256(operation.newReferenceRate, 'New reference rate'),
        ],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'rotate-guardian') {
    return {
      target: runtime.admin.emergencyGuardian,
      data: encodeFunctionData({
        abi: guardianAdminAbi,
        functionName: 'rotateOperator',
        args: [requiredAddress(operation.newOperator, 'New guardian operator')],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'enable-acquisition') {
    return {
      target: runtime.addresses.assetRegistry,
      data: encodeFunctionData({
        abi: assetRegistryAbi,
        functionName: 'enableAcquisition',
        args: [requiredAddress(operation.token, 'Asset token')],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'enable-standalone') {
    return {
      target: runtime.addresses.assetRegistry,
      data: encodeFunctionData({
        abi: assetRegistryAbi,
        functionName: 'enableStandaloneStrategy',
        args: [requiredAddress(operation.strategy, 'Standalone strategy')],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'reactivate-strategy') {
    return {
      target: runtime.addresses.allocationVoter,
      data: encodeFunctionData({
        abi: allocationVoterAbi,
        functionName: 'reactivateStrategy',
        args: [requiredAddress(operation.strategy, 'Strategy')],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'set-redemption-enabled') {
    return {
      target: runtime.addresses.assetRegistry,
      data: encodeFunctionData({
        abi: assetRegistryAbi,
        functionName: 'setRedemptionEnabled',
        args: [requiredAddress(operation.token, 'Asset token'), operation.enabled],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'unpause-liquidity-migrations') {
    return {
      target: runtime.addresses.liquidityManager,
      data: encodeFunctionData({ abi: liquidityManagerAbi, functionName: 'unpauseMigrations' }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: BOUNDED_MAINTENANCE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'deploy-acquisition') {
    const minimumLotUSDG = uint256(operation.minimumLotUSDG, 'Minimum USDG lot');
    const maximumLotUSDG = uint256(operation.maximumLotUSDG, 'Maximum USDG lot');
    const initialReferenceRate = uint256(operation.initialReferenceRate, 'Initial reference rate');
    if (maximumLotUSDG < minimumLotUSDG) throw new RangeError('Maximum USDG lot must not be below the minimum.');
    if (initialReferenceRate > MAX_AUCTION_REFERENCE_RATE) {
      throw new RangeError('Initial reference rate exceeds the strategy maximum.');
    }
    if (!/^0x[\da-f]+$/iu.test(operation.strategyCreationCode) || operation.strategyCreationCode.length % 2 !== 0) {
      throw new TypeError('AcquisitionStrategy creation code must be nonempty bytecode.');
    }
    if (!/^0x[\da-f]+$/iu.test(operation.rewardsCreationCode) || operation.rewardsCreationCode.length % 2 !== 0) {
      throw new TypeError('ManagerRewards creation code must be nonempty bytecode.');
    }
    return {
      target: runtimeStrategyDeployerAddress(runtime),
      data: encodeFunctionData({
        abi: strategyDeployerAdminAbi,
        functionName: 'deployAcquisition',
        args: [
          operation.strategyCreationCode,
          operation.rewardsCreationCode,
          requiredAddress(operation.targetToken, 'Target token'),
          minimumLotUSDG,
          maximumLotUSDG,
          initialReferenceRate,
        ],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: CRITICAL_CHANGE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'register-asset') {
    return {
      target: runtime.addresses.assetRegistry,
      data: encodeFunctionData({
        abi: assetRegistryAbi,
        functionName: 'registerAsset',
        args: [validateAssetConfig(operation.config, false)],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: CRITICAL_CHANGE_DELAY_SECONDS,
    };
  }
  if (operation.kind === 'register-stock-asset') {
    return {
      target: runtime.addresses.assetRegistry,
      data: encodeFunctionData({
        abi: assetRegistryAbi,
        functionName: 'registerStockAsset',
        args: [validateAssetConfig(operation.config, true), validateStockDependency(operation.dependency)],
      }),
      salt: ZERO_TIMELOCK_SALT,
      expectedDelay: CRITICAL_CHANGE_DELAY_SECONDS,
    };
  }
  const plan = validateMigrationPlan(operation.plan);
  return {
    target: runtime.addresses.liquidityManager,
    data: encodeFunctionData({ abi: liquidityManagerAbi, functionName: 'migrateLiquidity', args: [plan] }),
    salt: ZERO_TIMELOCK_SALT,
    expectedDelay: CRITICAL_CHANGE_DELAY_SECONDS,
  };
}

export function hashKnownTimelockOperation(runtime: LiveRuntimeDeployment, operation: TimelockOperation): Hex {
  const encoded = encodeKnownTimelockOperation(runtime, operation);
  return keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }],
      [BigInt(runtime.chain.id), runtime.admin.protocolTimelock, encoded.target, keccak256(encoded.data), encoded.salt],
    ),
  );
}

export function buildKnownTimelockTransaction(
  runtime: LiveRuntimeDeployment,
  mode: 'schedule' | 'execute',
  operation: TimelockOperation,
): ContractTransaction {
  const known = encodeKnownTimelockOperation(runtime, operation);
  return transaction(
    runtime.admin.protocolTimelock,
    encodeFunctionData({
      abi: protocolTimelockAdminAbi,
      functionName: mode,
      args: [known.target, known.data, known.salt],
    }),
  );
}
