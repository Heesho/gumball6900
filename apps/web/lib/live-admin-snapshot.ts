import {
  acquisitionStrategyAbi,
  allocationVoterAbi,
  buybackStrategyAbi,
  emergencyGuardianAbi,
  liquidityManagerAbi,
  miningPoolAbi,
} from '@gumball-6900/sdk';
import {
  encodeAbiParameters,
  getAddress,
  isAddress,
  isAddressEqual,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';

import {
  BOUNDED_MAINTENANCE_DELAY_SECONDS,
  CRITICAL_CHANGE_DELAY_SECONDS,
  encodeKnownTimelockOperation,
  protocolTimelockAdminAbi,
  runtimeStrategyDeployerAddress,
  strategyDeployerAdminAbi,
  type TimelockOperation,
  type TimelockPoolKey,
} from './admin-transactions';
import { acquisitionStrategyCreationCode, managerRewardsCreationCode } from './generated-strategy-creation-code';
import {
  basketAssetSymbols,
  readLiveProtocolOverviewAtBlock,
  type LiveAssetOverview,
  type LiveStrategyOverview,
} from './live-protocol-overview';
import { mapWithConcurrency } from './mining-claim-discovery';
import type { LiveRuntimeDeployment } from './runtime-types';

const protocolTimelockAbi = protocolTimelockAdminAbi;

export const adminStrategySymbols = ['WETH', 'WBTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL', 'BURN'] as const;
export type AdminStrategySymbol = (typeof adminStrategySymbols)[number];
export type KnownOperationState = 'unscheduled' | 'pending' | 'matured' | 'expired';

export interface LiveAdminStrategyStatus {
  readonly auctionDuration: bigint;
  readonly auctionId: bigint;
  readonly auctionStartTime: bigint;
  readonly currentRate: bigint;
  readonly expired: boolean;
  readonly fillsPaused: boolean;
  readonly floorRate: bigint;
  readonly kind: 'acquisition' | 'buyback';
  readonly referenceRate: bigint;
  readonly registryIndex: number;
  readonly registryLive: boolean;
  readonly startRate: bigint;
  readonly strategy: Address;
  readonly symbol: string;
  readonly token: Address;
  readonly voterDisabled: boolean;
}

export interface LiveKnownTimelockOperation {
  readonly delay: bigint;
  readonly expiresAt: bigint | null;
  readonly key: string;
  readonly label: string;
  readonly operation: TimelockOperation;
  readonly operationId: Hex;
  readonly readyAt: bigint;
  readonly state: KnownOperationState;
  readonly target: Address;
}

export interface LiveAdminSnapshot {
  readonly assets: readonly LiveAssetOverview[];
  readonly blockHash: Hex;
  readonly blockNumber: bigint;
  readonly blockTimestamp: bigint;
  readonly guardian: Readonly<{
    allocationVoter: Address;
    assetRegistry: Address;
    operator: Address;
    operatorMatchesManifest: boolean;
    targetsInitialized: true;
  }>;
  readonly mining: Readonly<{
    contributionsPaused: boolean;
    currentEpochId: bigint;
    currentEpochInvalidated: boolean;
    currentEpochSettled: boolean;
  }>;
  readonly liquidity: Readonly<{
    activePositionCount: bigint;
    migrationsPaused: boolean;
    poolKey: TimelockPoolKey;
  }>;
  readonly operations: readonly LiveKnownTimelockOperation[];
  readonly strategyDeployer: Readonly<{
    acquisitionStrategyCreationCodeHash: Hex;
    acquisitionStrategyCreationCodeLength: bigint;
    address: Address;
    bootstrapAcquisitionTargetCount: bigint;
    bootstrapAcquisitionTargetsHash: Hex;
    dependenciesConfigured: true;
    expectedBootstrapAcquisitionTargetCount: bigint;
    expectedBootstrapAcquisitionTargetsHash: Hex;
    managerRewardsCreationCodeHash: Hex;
    managerRewardsCreationCodeLength: bigint;
    strategyBootstrapFinalized: true;
    usdG: Address;
  }>;
  /** Complete bounded strategy registry, including the non-auction HoldUSDG recovery path. */
  readonly strategyRegistry: readonly LiveStrategyOverview[];
  readonly strategies: readonly LiveAdminStrategyStatus[];
  readonly timelock: Readonly<{
    boundedMaintenanceDelay: bigint;
    criticalChangeDelay: bigint;
    executionGracePeriod: bigint;
    proposer: Address;
    strategyBootstrapFinalized: true;
    strategyDeployer: Address;
    targetsInitialized: true;
  }>;
  readonly voter: Readonly<{
    signalActivationsPaused: boolean;
  }>;
}

const MAX_ADMIN_READ_CONCURRENCY = 4;

function address(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false }))
    throw new Error(`${label} must be an address.`);
  return getAddress(value);
}

function unsigned(value: unknown, label: string): bigint {
  if (typeof value !== 'bigint' || value < 0n) throw new Error(`${label} must be an unsigned bigint.`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function hash(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !/^0x[\da-f]{64}$/iu.test(value)) {
    throw new Error(`${label} must be exactly 32 bytes.`);
  }
  return value.toLowerCase() as Hex;
}

function safeInteger(value: unknown, label: string): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (
    typeof value === 'bigint' &&
    value >= BigInt(Number.MIN_SAFE_INTEGER) &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return Number(value);
  }
  throw new Error(`${label} must be a safe integer.`);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function requireAddress(actual: unknown, expected: Address, label: string): Address {
  const parsed = address(actual, label);
  if (!isAddressEqual(parsed, expected)) throw new Error(`${label} does not match the signed runtime.`);
  return parsed;
}

export function knownOperationKey(operation: TimelockOperation): string {
  return operation.kind === 'unpause-strategy'
    ? `${operation.kind}:${operation.strategy.toLowerCase()}`
    : operation.kind;
}

function knownOperations(
  strategies: readonly LiveStrategyOverview[],
): readonly Readonly<{ label: string; operation: TimelockOperation }>[] {
  return [
    { label: 'Reopen mining contributions', operation: { kind: 'unpause-mining' } },
    { label: 'Resume signal activations', operation: { kind: 'unpause-signals' } },
    ...strategies
      .filter((strategy) => strategy.kind === 'acquisition' || strategy.kind === 'buyback')
      .map((strategy) => ({
        label: `Reopen ${strategy.symbol} strategy fills`,
        operation: { kind: 'unpause-strategy', strategy: strategy.strategy } as const,
      })),
  ];
}

function operationState(readyAt: bigint, timestamp: bigint, gracePeriod: bigint): KnownOperationState {
  if (readyAt === 0n) return 'unscheduled';
  if (timestamp < readyAt) return 'pending';
  if (timestamp <= readyAt + gracePeriod) return 'matured';
  return 'expired';
}

async function readKnownOperations(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  blockNumber: bigint,
  blockTimestamp: bigint,
  boundedMaintenanceDelay: bigint,
  executionGracePeriod: bigint,
  overviewStrategies: readonly LiveStrategyOverview[],
): Promise<readonly LiveKnownTimelockOperation[]> {
  return mapWithConcurrency(
    knownOperations(overviewStrategies),
    MAX_ADMIN_READ_CONCURRENCY,
    async ({ label, operation }) => {
      const encoded = encodeKnownTimelockOperation(runtime, operation);
      const operationId = keccak256(
        encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }],
          [
            BigInt(runtime.chain.id),
            runtime.admin.protocolTimelock,
            encoded.target,
            keccak256(encoded.data),
            encoded.salt,
          ],
        ),
      );
      const delay = boundedMaintenanceDelay;
      const readyAt = unsigned(
        await client.readContract({
          abi: protocolTimelockAbi,
          address: runtime.admin.protocolTimelock,
          args: [operationId],
          blockNumber,
          functionName: 'operationReadyAt',
        }),
        `${label} readyAt`,
      );
      return {
        delay,
        expiresAt: readyAt === 0n ? null : readyAt + executionGracePeriod,
        key: knownOperationKey(operation),
        label,
        operation,
        operationId,
        readyAt,
        state: operationState(readyAt, blockTimestamp, executionGracePeriod),
        target: encoded.target,
      };
    },
  );
}

async function readStrategyStatuses(
  client: PublicClient,
  blockNumber: bigint,
  blockTimestamp: bigint,
  overviewStrategies: readonly LiveStrategyOverview[],
): Promise<readonly LiveAdminStrategyStatus[]> {
  const auctionStrategies = overviewStrategies.filter(
    (strategy): strategy is LiveStrategyOverview & { kind: 'acquisition' | 'buyback' } =>
      strategy.kind === 'acquisition' || strategy.kind === 'buyback',
  );
  return mapWithConcurrency(auctionStrategies, MAX_ADMIN_READ_CONCURRENCY, async (overview) => {
    const { strategy, symbol } = overview;
    const abi = overview.kind === 'buyback' ? buybackStrategyAbi : acquisitionStrategyAbi;
    const [
      rawFillsPaused,
      rawAuctionId,
      rawAuctionStartTime,
      rawAuctionDuration,
      rawReferenceRate,
      rawStartRate,
      rawFloorRate,
    ] = await Promise.all([
      client.readContract({ abi, address: strategy, blockNumber, functionName: 'fillsPaused' }),
      client.readContract({ abi, address: strategy, blockNumber, functionName: 'auctionId' }),
      client.readContract({ abi, address: strategy, blockNumber, functionName: 'auctionStartTime' }),
      client.readContract({ abi, address: strategy, blockNumber, functionName: 'AUCTION_DURATION' }),
      client.readContract({ abi, address: strategy, blockNumber, functionName: 'referenceRate' }),
      client.readContract({ abi, address: strategy, blockNumber, functionName: 'startRate' }),
      client.readContract({ abi, address: strategy, blockNumber, functionName: 'floorRate' }),
    ]);
    const auctionStartTime = unsigned(rawAuctionStartTime, `${symbol} auction start`);
    const auctionDuration = unsigned(rawAuctionDuration, `${symbol} auction duration`);
    const referenceRate = unsigned(rawReferenceRate, `${symbol} reference rate`);
    const startRate = unsigned(rawStartRate, `${symbol} start rate`);
    const floorRate = unsigned(rawFloorRate, `${symbol} floor rate`);
    if (auctionDuration === 0n || auctionStartTime > blockTimestamp) {
      throw new Error(`${symbol} auction timing is invalid.`);
    }
    if (referenceRate === 0n || floorRate === 0n || startRate < floorRate) {
      throw new Error(`${symbol} auction rates are inconsistent.`);
    }
    const elapsed = blockTimestamp - auctionStartTime;
    const currentRate =
      elapsed >= auctionDuration ? floorRate : startRate - ((startRate - floorRate) * elapsed) / auctionDuration;
    return {
      auctionDuration,
      auctionId: unsigned(rawAuctionId, `${symbol} auction ID`),
      auctionStartTime,
      currentRate,
      expired: blockTimestamp >= auctionStartTime + auctionDuration,
      fillsPaused: boolean(rawFillsPaused, `${symbol} fillsPaused`),
      floorRate,
      kind: overview.kind,
      referenceRate,
      registryIndex: overview.registryIndex,
      registryLive: overview.live,
      startRate,
      strategy,
      symbol,
      token: overview.token,
      voterDisabled: overview.voterDisabled,
    };
  });
}

/** Reads every admin surface at one block and rejects target drift or a reorg before exposing state. */
export async function readLiveAdminSnapshot(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
): Promise<LiveAdminSnapshot> {
  const pinnedBlock = await client.getBlock({ blockTag: 'latest' });
  if (pinnedBlock.hash === null) throw new Error('Pinned admin block did not have a hash.');
  const blockNumber = pinnedBlock.number;
  const [
    overview,
    rawGuardianOperator,
    rawGuardianTimelock,
    rawGuardianRegistry,
    rawGuardianVoter,
    rawGuardianInitialized,
    rawProposer,
    rawTimelockRegistry,
    rawTimelockGuardian,
    rawTimelockVoter,
    rawTimelockMining,
    rawTimelockLiquidity,
    rawTimelockStrategyDeployer,
    rawTimelockInitialized,
    rawBoundedDelay,
    rawCriticalDelay,
    rawGracePeriod,
    rawStrategyBootstrapFinalized,
    rawContributionsPaused,
    rawCurrentEpochId,
    rawSignalActivationsPaused,
    rawMigrationsPaused,
    rawActivePositionCount,
    rawPoolKey,
    rawDeployerConfigured,
    rawDeployerTimelock,
    rawDeployerGuardian,
    rawDeployerGBX,
    rawDeployerUSDG,
    rawDeployerVault,
    rawDeployerVoter,
    rawDeployerRegistry,
    rawDeployerEligibility,
    rawDeployerBootstrapFinalized,
    rawExpectedBootstrapAcquisitionTargetCount,
    rawExpectedBootstrapAcquisitionTargetsHash,
    rawBootstrapAcquisitionTargetCount,
    rawBootstrapAcquisitionTargetsHash,
    rawAcquisitionCreationCodeHash,
    rawAcquisitionCreationCodeLength,
    rawManagerRewardsCreationCodeHash,
    rawManagerRewardsCreationCodeLength,
  ] = await Promise.all([
    readLiveProtocolOverviewAtBlock(client, runtime, { hash: pinnedBlock.hash, number: blockNumber }),
    client.readContract({
      abi: emergencyGuardianAbi,
      address: runtime.admin.emergencyGuardian,
      blockNumber,
      functionName: 'operator',
    }),
    client.readContract({
      abi: emergencyGuardianAbi,
      address: runtime.admin.emergencyGuardian,
      blockNumber,
      functionName: 'PROTOCOL_TIMELOCK',
    }),
    client.readContract({
      abi: emergencyGuardianAbi,
      address: runtime.admin.emergencyGuardian,
      blockNumber,
      functionName: 'assetRegistry',
    }),
    client.readContract({
      abi: emergencyGuardianAbi,
      address: runtime.admin.emergencyGuardian,
      blockNumber,
      functionName: 'allocationVoter',
    }),
    client.readContract({
      abi: emergencyGuardianAbi,
      address: runtime.admin.emergencyGuardian,
      blockNumber,
      functionName: 'targetsInitialized',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'PROPOSER_MULTISIG',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'assetRegistry',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'emergencyGuardian',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'allocationVoter',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'miningPool',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'liquidityManager',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'strategyDeployer',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'targetsInitialized',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'BOUNDED_MAINTENANCE_DELAY',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'CRITICAL_CHANGE_DELAY',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'EXECUTION_GRACE_PERIOD',
    }),
    client.readContract({
      abi: protocolTimelockAbi,
      address: runtime.admin.protocolTimelock,
      blockNumber,
      functionName: 'strategyBootstrapFinalized',
    }),
    client.readContract({
      abi: miningPoolAbi,
      address: runtime.addresses.miningPool,
      blockNumber,
      functionName: 'contributionsPaused',
    }),
    client.readContract({
      abi: miningPoolAbi,
      address: runtime.addresses.miningPool,
      blockNumber,
      functionName: 'currentEpochId',
    }),
    client.readContract({
      abi: allocationVoterAbi,
      address: runtime.addresses.allocationVoter,
      blockNumber,
      functionName: 'signalActivationsPaused',
    }),
    client.readContract({
      abi: liquidityManagerAbi,
      address: runtime.addresses.liquidityManager,
      blockNumber,
      functionName: 'migrationsPaused',
    }),
    client.readContract({
      abi: liquidityManagerAbi,
      address: runtime.addresses.liquidityManager,
      blockNumber,
      functionName: 'activePositionCount',
    }),
    client.readContract({
      abi: liquidityManagerAbi,
      address: runtime.addresses.liquidityManager,
      blockNumber,
      functionName: 'poolKey',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'dependenciesConfigured',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'PROTOCOL_TIMELOCK',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'EMERGENCY_GUARDIAN',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'GBX',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'USDG',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'GUM_BALL_VAULT',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'ALLOCATION_VOTER',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'ASSET_REGISTRY',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'ELIGIBILITY_MODULE',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'strategyBootstrapFinalized',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'bootstrapAcquisitionTargetCount',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'bootstrapAcquisitionTargetsHash',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'ACQUISITION_STRATEGY_CREATION_CODE_HASH',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'ACQUISITION_STRATEGY_CREATION_CODE_LENGTH',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'MANAGER_REWARDS_CREATION_CODE_HASH',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: runtimeStrategyDeployerAddress(runtime),
      blockNumber,
      functionName: 'MANAGER_REWARDS_CREATION_CODE_LENGTH',
    }),
  ]);

  requireAddress(rawGuardianTimelock, runtime.admin.protocolTimelock, 'EmergencyGuardian timelock');
  const guardianRegistry = requireAddress(
    rawGuardianRegistry,
    runtime.addresses.assetRegistry,
    'EmergencyGuardian registry',
  );
  const guardianVoter = requireAddress(rawGuardianVoter, runtime.addresses.allocationVoter, 'EmergencyGuardian voter');
  if (!boolean(rawGuardianInitialized, 'EmergencyGuardian targetsInitialized')) {
    throw new Error('EmergencyGuardian targets are not initialized.');
  }
  const proposer = requireAddress(rawProposer, runtime.admin.protocolTimelockProposer, 'ProtocolTimelock proposer');
  requireAddress(rawTimelockRegistry, runtime.addresses.assetRegistry, 'ProtocolTimelock registry');
  requireAddress(rawTimelockGuardian, runtime.admin.emergencyGuardian, 'ProtocolTimelock guardian');
  requireAddress(rawTimelockVoter, runtime.addresses.allocationVoter, 'ProtocolTimelock voter');
  requireAddress(rawTimelockMining, runtime.addresses.miningPool, 'ProtocolTimelock mining pool');
  requireAddress(rawTimelockLiquidity, runtime.addresses.liquidityManager, 'ProtocolTimelock liquidity manager');
  const strategyDeployer = runtimeStrategyDeployerAddress(runtime);
  requireAddress(rawTimelockStrategyDeployer, strategyDeployer, 'ProtocolTimelock strategy deployer');
  if (!boolean(rawTimelockInitialized, 'ProtocolTimelock targetsInitialized')) {
    throw new Error('ProtocolTimelock targets are not initialized.');
  }
  const boundedMaintenanceDelay = unsigned(rawBoundedDelay, 'bounded maintenance delay');
  const criticalChangeDelay = unsigned(rawCriticalDelay, 'critical change delay');
  const executionGracePeriod = unsigned(rawGracePeriod, 'execution grace period');
  if (
    boundedMaintenanceDelay !== BOUNDED_MAINTENANCE_DELAY_SECONDS ||
    criticalChangeDelay !== CRITICAL_CHANGE_DELAY_SECONDS ||
    executionGracePeriod === 0n
  ) {
    throw new Error('ProtocolTimelock timing constants do not match the client policy.');
  }
  if (!boolean(rawStrategyBootstrapFinalized, 'strategyBootstrapFinalized')) {
    throw new Error('ProtocolTimelock strategy bootstrap has not been finalized.');
  }
  if (!boolean(rawDeployerConfigured, 'StrategyDeployer dependenciesConfigured')) {
    throw new Error('StrategyDeployer dependency graph is not configured.');
  }
  requireAddress(rawDeployerTimelock, runtime.admin.protocolTimelock, 'StrategyDeployer timelock');
  requireAddress(rawDeployerGuardian, runtime.admin.emergencyGuardian, 'StrategyDeployer guardian');
  requireAddress(rawDeployerGBX, runtime.addresses.gbx, 'StrategyDeployer GBX');
  const deployerUSDG = requireAddress(rawDeployerUSDG, runtime.assets.USDG, 'StrategyDeployer USDG');
  requireAddress(rawDeployerVault, runtime.addresses.gumBallVault, 'StrategyDeployer vault');
  requireAddress(rawDeployerVoter, runtime.addresses.allocationVoter, 'StrategyDeployer voter');
  requireAddress(rawDeployerRegistry, runtime.addresses.assetRegistry, 'StrategyDeployer registry');
  requireAddress(rawDeployerEligibility, runtime.addresses.eligibilityModule, 'StrategyDeployer eligibility module');
  if (!boolean(rawDeployerBootstrapFinalized, 'StrategyDeployer strategyBootstrapFinalized')) {
    throw new Error('StrategyDeployer strategy bootstrap has not been finalized.');
  }
  const expectedBootstrapAcquisitionTargetCount = unsigned(
    rawExpectedBootstrapAcquisitionTargetCount,
    'StrategyDeployer expected bootstrap acquisition target count',
  );
  const expectedBootstrapAcquisitionTargetsHash = hash(
    rawExpectedBootstrapAcquisitionTargetsHash,
    'StrategyDeployer expected bootstrap acquisition targets hash',
  );
  const bootstrapAcquisitionTargetCount = unsigned(
    rawBootstrapAcquisitionTargetCount,
    'StrategyDeployer finalized bootstrap acquisition target count',
  );
  const bootstrapAcquisitionTargetsHash = hash(
    rawBootstrapAcquisitionTargetsHash,
    'StrategyDeployer finalized bootstrap acquisition targets hash',
  );
  const expectedBootstrapTargets = basketAssetSymbols.slice(1).map((symbol) => runtime.assets[symbol]);
  const expectedBootstrapTargetsHash = keccak256(
    encodeAbiParameters([{ type: 'address[]' }], [expectedBootstrapTargets]),
  );
  if (
    expectedBootstrapAcquisitionTargetCount !== BigInt(expectedBootstrapTargets.length) ||
    bootstrapAcquisitionTargetCount !== expectedBootstrapAcquisitionTargetCount ||
    expectedBootstrapAcquisitionTargetsHash !== expectedBootstrapTargetsHash ||
    bootstrapAcquisitionTargetsHash !== expectedBootstrapTargetsHash
  ) {
    throw new Error('StrategyDeployer bootstrap target commitments do not match the signed genesis asset set.');
  }
  const acquisitionStrategyCreationCodeHash = hash(rawAcquisitionCreationCodeHash, 'acquisition creation-code hash');
  const acquisitionStrategyCreationCodeLength = unsigned(
    rawAcquisitionCreationCodeLength,
    'acquisition creation-code length',
  );
  const managerRewardsCreationCodeHash = hash(rawManagerRewardsCreationCodeHash, 'rewards creation-code hash');
  const managerRewardsCreationCodeLength = unsigned(
    rawManagerRewardsCreationCodeLength,
    'rewards creation-code length',
  );
  if (
    acquisitionStrategyCreationCodeHash !== keccak256(acquisitionStrategyCreationCode) ||
    managerRewardsCreationCodeHash !== keccak256(managerRewardsCreationCode) ||
    acquisitionStrategyCreationCodeLength !== BigInt((acquisitionStrategyCreationCode.length - 2) / 2) ||
    managerRewardsCreationCodeLength !== BigInt((managerRewardsCreationCode.length - 2) / 2)
  ) {
    throw new Error('StrategyDeployer compiler bytecode commitments do not match this client build.');
  }
  const poolKeyObject = object(rawPoolKey, 'canonical PoolKey');
  const poolKey: TimelockPoolKey = {
    currency0: address(poolKeyObject.currency0, 'PoolKey currency0'),
    currency1: address(poolKeyObject.currency1, 'PoolKey currency1'),
    fee: safeInteger(poolKeyObject.fee, 'PoolKey fee'),
    tickSpacing: safeInteger(poolKeyObject.tickSpacing, 'PoolKey tick spacing'),
    hooks: address(poolKeyObject.hooks, 'PoolKey hooks'),
  };
  const expectedCurrencies = [runtime.addresses.gbx.toLowerCase(), runtime.assets.USDG.toLowerCase()].sort();
  if (
    [poolKey.currency0.toLowerCase(), poolKey.currency1.toLowerCase()].join(':') !== expectedCurrencies.join(':') ||
    !isAddressEqual(poolKey.hooks, runtime.addresses.launchGuardHook) ||
    poolKey.tickSpacing <= 0
  ) {
    throw new Error('LiquidityManager PoolKey does not match the signed canonical GBX/USDG pool.');
  }
  const activePositionCount = unsigned(rawActivePositionCount, 'active liquidity position count');
  if (activePositionCount > 16n) throw new Error('LiquidityManager active position count exceeds the policy bound.');
  const currentEpochId = unsigned(rawCurrentEpochId, 'current mining epoch ID');
  const rawEpoch = object(
    await client.readContract({
      abi: miningPoolAbi,
      address: runtime.addresses.miningPool,
      args: [currentEpochId],
      blockNumber,
      functionName: 'getEpoch',
    }),
    'current mining epoch',
  );
  const [strategies, operations] = await Promise.all([
    readStrategyStatuses(client, blockNumber, pinnedBlock.timestamp, overview.strategies),
    readKnownOperations(
      client,
      runtime,
      blockNumber,
      pinnedBlock.timestamp,
      boundedMaintenanceDelay,
      executionGracePeriod,
      overview.strategies,
    ),
  ]);
  const confirmedBlock = await client.getBlock({ blockNumber });
  if (
    confirmedBlock.number !== blockNumber ||
    confirmedBlock.hash === null ||
    confirmedBlock.hash.toLowerCase() !== pinnedBlock.hash.toLowerCase()
  ) {
    throw new Error('Chain state changed during admin reads.');
  }
  const operator = address(rawGuardianOperator, 'EmergencyGuardian operator');
  return {
    assets: overview.assets,
    blockHash: pinnedBlock.hash,
    blockNumber,
    blockTimestamp: pinnedBlock.timestamp,
    guardian: {
      allocationVoter: guardianVoter,
      assetRegistry: guardianRegistry,
      operator,
      operatorMatchesManifest: isAddressEqual(operator, runtime.admin.guardianOperator),
      targetsInitialized: true,
    },
    mining: {
      contributionsPaused: boolean(rawContributionsPaused, 'mining contributionsPaused'),
      currentEpochId,
      currentEpochInvalidated: boolean(rawEpoch.invalidated, 'current mining epoch invalidated'),
      currentEpochSettled: boolean(rawEpoch.settled, 'current mining epoch settled'),
    },
    liquidity: {
      activePositionCount,
      migrationsPaused: boolean(rawMigrationsPaused, 'liquidity migrationsPaused'),
      poolKey,
    },
    operations,
    strategyDeployer: {
      acquisitionStrategyCreationCodeHash,
      acquisitionStrategyCreationCodeLength,
      address: strategyDeployer,
      bootstrapAcquisitionTargetCount,
      bootstrapAcquisitionTargetsHash,
      dependenciesConfigured: true,
      expectedBootstrapAcquisitionTargetCount,
      expectedBootstrapAcquisitionTargetsHash,
      managerRewardsCreationCodeHash,
      managerRewardsCreationCodeLength,
      strategyBootstrapFinalized: true,
      usdG: deployerUSDG,
    },
    strategyRegistry: overview.strategies,
    strategies,
    timelock: {
      boundedMaintenanceDelay,
      criticalChangeDelay,
      executionGracePeriod,
      proposer,
      strategyBootstrapFinalized: true,
      strategyDeployer,
      targetsInitialized: true,
    },
    voter: {
      signalActivationsPaused: boolean(rawSignalActivationsPaused, 'signalActivationsPaused'),
    },
  };
}
