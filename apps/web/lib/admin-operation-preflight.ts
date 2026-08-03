import { liquidityManagerAbi } from '@gumball-6900/sdk';
import {
  getAddress,
  isAddressEqual,
  keccak256,
  parseAbi,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';

import {
  encodeKnownTimelockOperation,
  hashKnownTimelockOperation,
  MAX_AUCTION_REFERENCE_RATE,
  protocolTimelockAdminAbi,
  strategyDeployerAdminAbi,
  validateMigrationPlan,
  type TimelockAssetConfig,
  type TimelockOperation,
  type TimelockStockTokenDependency,
} from './admin-transactions';
import { acquisitionStrategyCreationCode, managerRewardsCreationCode } from './generated-strategy-creation-code';
import type { KnownOperationState, LiveAdminSnapshot } from './live-admin-snapshot';
import type { LiveRuntimeDeployment } from './runtime-types';

const erc20MetadataAbi = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);
const acquisitionRegistrationIdentityAbi = parseAbi([
  'function TARGET_TOKEN() view returns (address)',
  'function managerRewards() view returns (address)',
  'function USDG_DECIMALS() view returns (uint8)',
  'function TARGET_DECIMALS() view returns (uint8)',
]);
const managerRewardsRegistrationIdentityAbi = parseAbi([
  'function REWARD_TOKEN() view returns (address)',
  'function STRATEGY() view returns (address)',
]);
const stockTokenIdentityAbi = parseAbi([
  'function ACCESS_CONTROLLED_REGISTRY() view returns (address)',
  'function uid() view returns (bytes32)',
  'function uiMultiplier() view returns (uint256)',
  'function paused() view returns (bool)',
  'function tokenPaused() view returns (bool)',
  'function oraclePaused() view returns (bool)',
]);
const stockBeaconAbi = parseAbi([
  'function implementation() view returns (address)',
  'function paused() view returns (bool)',
  'function isBlocked(address account) view returns (bool)',
]);
const positionManagerIdentityAbi = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)']);
const liquidityIdentityAbi = parseAbi([
  'function genesisSeeded() view returns (bool)',
  'function POSITION_MANAGER() view returns (address)',
]);

function referenceResetBounds(expectedReferenceRate: bigint): { minimum: bigint; maximum: bigint } {
  // Mirrors Math.mulDiv(expected, 5_000, 10_000, Ceil) without an overflowing numerator.
  const minimum = expectedReferenceRate / 2n + (expectedReferenceRate % 2n === 0n ? 0n : 1n);
  // The contracts branch before doubling so the 200% bound cannot overflow and never exceeds their rate cap.
  const maximum =
    expectedReferenceRate > MAX_AUCTION_REFERENCE_RATE / 2n ? MAX_AUCTION_REFERENCE_RATE : expectedReferenceRate * 2n;
  return { maximum, minimum };
}

export interface LiveTimelockOperationSnapshot {
  readonly blockHash: Hex;
  readonly blockNumber: bigint;
  readonly blockTimestamp: bigint;
  readonly delay: bigint;
  readonly expiresAt: bigint | null;
  readonly operationId: Hex;
  readonly readyAt: bigint;
  readonly state: KnownOperationState;
  readonly target: Address;
}

function operationState(readyAt: bigint, timestamp: bigint, gracePeriod: bigint): KnownOperationState {
  if (readyAt === 0n) return 'unscheduled';
  if (timestamp < readyAt) return 'pending';
  if (timestamp <= readyAt + gracePeriod) return 'matured';
  return 'expired';
}

function unsigned(value: unknown, label: string): bigint {
  if (typeof value !== 'bigint' || value < 0n) throw new Error(`${label} must be an unsigned integer.`);
  return value;
}

function address(value: unknown, label: string): Address {
  if (typeof value !== 'string') throw new Error(`${label} must be an address.`);
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${label} must be an address.`);
  }
}

function hash(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !/^0x[\da-f]{64}$/iu.test(value)) {
    throw new Error(`${label} must be exactly 32 bytes.`);
  }
  return value.toLowerCase() as Hex;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`);
  return value;
}

function decimalCount(value: unknown, label: string): number {
  const parsed = typeof value === 'bigint' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0 || parsed > 18) {
    throw new Error(`${label} must be an integer from 0 through 18.`);
  }
  return parsed;
}

function sameAddress(left: Address, right: Address): boolean {
  return isAddressEqual(left, right);
}

function requireSameAddress(actual: unknown, expected: Address, label: string): Address {
  const parsed = address(actual, label);
  if (!sameAddress(parsed, expected)) throw new Error(`${label} does not match the pinned protocol graph.`);
  return parsed;
}

async function confirmAdminBlock(client: PublicClient, snapshot: LiveAdminSnapshot): Promise<void> {
  const confirmed = await client.getBlock({ blockNumber: snapshot.blockNumber });
  if (
    confirmed.number !== snapshot.blockNumber ||
    confirmed.hash === null ||
    confirmed.hash.toLowerCase() !== snapshot.blockHash.toLowerCase()
  ) {
    throw new Error('The pinned admin block changed during operation validation.');
  }
}

/** Resolves the exact non-enumerable operation at the already validated admin block. */
export async function readTimelockOperationSnapshot(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  adminSnapshot: LiveAdminSnapshot,
  operation: TimelockOperation,
): Promise<LiveTimelockOperationSnapshot> {
  const encoded = encodeKnownTimelockOperation(runtime, operation);
  const localOperationId = hashKnownTimelockOperation(runtime, operation);
  const [rawOperationId, rawReadyAt] = await Promise.all([
    client.readContract({
      abi: protocolTimelockAdminAbi,
      address: runtime.admin.protocolTimelock,
      args: [encoded.target, encoded.data, encoded.salt],
      blockNumber: adminSnapshot.blockNumber,
      functionName: 'hashOperation',
    }),
    client.readContract({
      abi: protocolTimelockAdminAbi,
      address: runtime.admin.protocolTimelock,
      args: [localOperationId],
      blockNumber: adminSnapshot.blockNumber,
      functionName: 'operationReadyAt',
    }),
  ]);
  const operationId = hash(rawOperationId, 'Onchain operation ID');
  const readyAt = unsigned(rawReadyAt, 'Operation ready time');
  if (operationId !== localOperationId.toLowerCase()) {
    throw new Error('Onchain operation ID does not match the locally committed target, calldata, and salt.');
  }
  let delay = encoded.expectedDelay;
  // The two-rate reset baseline is a schedule-only invariant. Once queued, calling public requiredDelay would
  // deliberately re-run that predicate against current state and could hide the historical operation from cancel or
  // permissionless execute. Its selector/delay was already accepted when operationReadyAt became nonzero.
  if (operation.kind !== 'reset-reference-rate' || readyAt === 0n) {
    delay = unsigned(
      await client.readContract({
        abi: protocolTimelockAdminAbi,
        address: runtime.admin.protocolTimelock,
        args: [encoded.target, encoded.data],
        blockNumber: adminSnapshot.blockNumber,
        functionName: 'requiredDelay',
      }),
      'Operation delay',
    );
    if (delay !== encoded.expectedDelay) {
      throw new Error('Onchain required delay does not match this named operation.');
    }
  }
  await confirmAdminBlock(client, adminSnapshot);
  return {
    blockHash: adminSnapshot.blockHash,
    blockNumber: adminSnapshot.blockNumber,
    blockTimestamp: adminSnapshot.blockTimestamp,
    delay,
    expiresAt: readyAt === 0n ? null : readyAt + adminSnapshot.timelock.executionGracePeriod,
    operationId,
    readyAt,
    state: operationState(readyAt, adminSnapshot.blockTimestamp, adminSnapshot.timelock.executionGracePeriod),
    target: encoded.target,
  };
}

async function bytecodeHash(client: PublicClient, target: Address, snapshot: LiveAdminSnapshot, label: string) {
  const code = await client.getBytecode({ address: target, blockNumber: snapshot.blockNumber });
  if (code === undefined || code === '0x') throw new Error(`${label} has no code at the pinned block.`);
  return keccak256(code);
}

function registeredStrategy(snapshot: LiveAdminSnapshot, strategy: Address) {
  return snapshot.strategyRegistry.find((candidate) => sameAddress(candidate.strategy, strategy));
}

function registeredAsset(snapshot: LiveAdminSnapshot, token: Address) {
  return snapshot.assets.find((candidate) => sameAddress(candidate.token, token));
}

function auctionStrategy(snapshot: LiveAdminSnapshot, strategy: Address) {
  return snapshot.strategies.find((candidate) => sameAddress(candidate.strategy, strategy));
}

function assertCanonicalPoolKey(
  snapshot: LiveAdminSnapshot,
  operation: Extract<TimelockOperation, { kind: 'migrate-liquidity' }>,
) {
  const actual = validateMigrationPlan(operation.plan).destinationPoolKey;
  const expected = snapshot.liquidity.poolKey;
  if (
    !sameAddress(actual.currency0, expected.currency0) ||
    !sameAddress(actual.currency1, expected.currency1) ||
    actual.fee !== expected.fee ||
    actual.tickSpacing !== expected.tickSpacing ||
    !sameAddress(actual.hooks, expected.hooks)
  ) {
    throw new Error('Migration PoolKey does not equal the canonical LiquidityManager PoolKey at the pinned block.');
  }
}

function acquisitionPairRecord(raw: unknown) {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
      ? [
          (raw as Record<string, unknown>).targetToken,
          (raw as Record<string, unknown>).managerRewards,
          (raw as Record<string, unknown>).gumBallVault,
          (raw as Record<string, unknown>).allocationVoter,
          (raw as Record<string, unknown>).assetRegistry,
          (raw as Record<string, unknown>).protocolTimelock,
          (raw as Record<string, unknown>).emergencyGuardian,
          (raw as Record<string, unknown>).eligibilityModule,
          (raw as Record<string, unknown>).strategyRuntimeCodeHash,
          (raw as Record<string, unknown>).rewardsRuntimeCodeHash,
        ]
      : [];
  if (values.length !== 10) throw new Error('StrategyDeployer returned malformed acquisition provenance.');
  return {
    targetToken: address(values[0], 'Provenance target token'),
    managerRewards: address(values[1], 'Provenance ManagerRewards'),
    gumBallVault: address(values[2], 'Provenance vault'),
    allocationVoter: address(values[3], 'Provenance voter'),
    assetRegistry: address(values[4], 'Provenance registry'),
    protocolTimelock: address(values[5], 'Provenance timelock'),
    emergencyGuardian: address(values[6], 'Provenance guardian'),
    eligibilityModule: address(values[7], 'Provenance eligibility module'),
    strategyRuntimeCodeHash: hash(values[8], 'Provenance strategy runtime hash'),
    rewardsRuntimeCodeHash: hash(values[9], 'Provenance rewards runtime hash'),
  };
}

async function readTokenIdentity(
  client: PublicClient,
  snapshot: LiveAdminSnapshot,
  token: Address,
): Promise<{ decimals: number; symbol: string; runtimeCodeHash: Hex }> {
  const [rawSymbol, rawDecimals, runtimeCodeHash] = await Promise.all([
    client.readContract({
      abi: erc20MetadataAbi,
      address: token,
      blockNumber: snapshot.blockNumber,
      functionName: 'symbol',
    }),
    client.readContract({
      abi: erc20MetadataAbi,
      address: token,
      blockNumber: snapshot.blockNumber,
      functionName: 'decimals',
    }),
    bytecodeHash(client, token, snapshot, 'Target token'),
  ]);
  if (typeof rawSymbol !== 'string' || !/^[!-~]{1,32}$/u.test(rawSymbol)) {
    throw new Error('Target token symbol must be 1–32 printable ASCII bytes.');
  }
  const decimals = decimalCount(rawDecimals, 'Target token decimals');
  return { decimals, runtimeCodeHash, symbol: rawSymbol };
}

async function assertAcquisitionProvenance(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  snapshot: LiveAdminSnapshot,
  config: TimelockAssetConfig,
): Promise<void> {
  const deployer = snapshot.strategyDeployer.address;
  if (
    !snapshot.strategyDeployer.dependenciesConfigured ||
    !snapshot.strategyDeployer.strategyBootstrapFinalized ||
    !sameAddress(snapshot.strategyDeployer.usdG, runtime.assets.USDG)
  ) {
    throw new Error('StrategyDeployer canonical USDG, dependency, or bootstrap evidence is invalid.');
  }
  const [
    rawStrategy,
    rawPair,
    strategyRuntimeCodeHash,
    rewardsRuntimeCodeHash,
    rawStrategyTarget,
    rawStrategyRewards,
    rawStrategyUSDGDecimals,
    rawStrategyTargetDecimals,
    rawRewardsToken,
    rawRewardsStrategy,
    rawLiveUSDGDecimals,
  ] = await Promise.all([
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: deployer,
      args: [config.token],
      blockNumber: snapshot.blockNumber,
      functionName: 'acquisitionStrategyForToken',
    }),
    client.readContract({
      abi: strategyDeployerAdminAbi,
      address: deployer,
      args: [config.strategy],
      blockNumber: snapshot.blockNumber,
      functionName: 'acquisitionPair',
    }),
    bytecodeHash(client, config.strategy, snapshot, 'AcquisitionStrategy'),
    bytecodeHash(client, config.rewards, snapshot, 'ManagerRewards'),
    client.readContract({
      abi: acquisitionRegistrationIdentityAbi,
      address: config.strategy,
      blockNumber: snapshot.blockNumber,
      functionName: 'TARGET_TOKEN',
    }),
    client.readContract({
      abi: acquisitionRegistrationIdentityAbi,
      address: config.strategy,
      blockNumber: snapshot.blockNumber,
      functionName: 'managerRewards',
    }),
    client.readContract({
      abi: acquisitionRegistrationIdentityAbi,
      address: config.strategy,
      blockNumber: snapshot.blockNumber,
      functionName: 'USDG_DECIMALS',
    }),
    client.readContract({
      abi: acquisitionRegistrationIdentityAbi,
      address: config.strategy,
      blockNumber: snapshot.blockNumber,
      functionName: 'TARGET_DECIMALS',
    }),
    client.readContract({
      abi: managerRewardsRegistrationIdentityAbi,
      address: config.rewards,
      blockNumber: snapshot.blockNumber,
      functionName: 'REWARD_TOKEN',
    }),
    client.readContract({
      abi: managerRewardsRegistrationIdentityAbi,
      address: config.rewards,
      blockNumber: snapshot.blockNumber,
      functionName: 'STRATEGY',
    }),
    client.readContract({
      abi: erc20MetadataAbi,
      address: runtime.assets.USDG,
      blockNumber: snapshot.blockNumber,
      functionName: 'decimals',
    }),
  ]);
  requireSameAddress(rawStrategy, config.strategy, 'StrategyDeployer token strategy');
  const pair = acquisitionPairRecord(rawPair);
  if (
    !sameAddress(pair.targetToken, config.token) ||
    !sameAddress(pair.managerRewards, config.rewards) ||
    !sameAddress(pair.gumBallVault, runtime.addresses.gumBallVault) ||
    !sameAddress(pair.allocationVoter, runtime.addresses.allocationVoter) ||
    !sameAddress(pair.assetRegistry, runtime.addresses.assetRegistry) ||
    !sameAddress(pair.protocolTimelock, runtime.admin.protocolTimelock) ||
    !sameAddress(pair.emergencyGuardian, runtime.admin.emergencyGuardian) ||
    !sameAddress(pair.eligibilityModule, runtime.addresses.eligibilityModule) ||
    pair.strategyRuntimeCodeHash !== strategyRuntimeCodeHash ||
    pair.rewardsRuntimeCodeHash !== rewardsRuntimeCodeHash
  ) {
    throw new Error('Asset registration does not match exact StrategyDeployer provenance and runtime code.');
  }
  if (
    !sameAddress(address(rawStrategyTarget, 'AcquisitionStrategy target token'), config.token) ||
    !sameAddress(address(rawStrategyRewards, 'AcquisitionStrategy ManagerRewards'), config.rewards) ||
    !sameAddress(address(rawRewardsToken, 'ManagerRewards reward token'), config.token) ||
    !sameAddress(address(rawRewardsStrategy, 'ManagerRewards strategy'), config.strategy)
  ) {
    throw new Error('AcquisitionStrategy and ManagerRewards identity getters do not match the registered pair.');
  }
  const liveUSDGDecimals = decimalCount(rawLiveUSDGDecimals, 'Canonical USDG decimals');
  if (
    liveUSDGDecimals !== runtime.assetMetadata.USDG.decimals ||
    decimalCount(rawStrategyUSDGDecimals, 'AcquisitionStrategy USDG decimals') !== liveUSDGDecimals ||
    decimalCount(rawStrategyTargetDecimals, 'AcquisitionStrategy target decimals') !== config.decimals
  ) {
    throw new Error('AcquisitionStrategy decimal commitments do not match the canonical USDG and target tokens.');
  }
}

async function assertStockIdentity(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  snapshot: LiveAdminSnapshot,
  config: TimelockAssetConfig,
  dependency: TimelockStockTokenDependency,
  tokenRuntimeCodeHash: Hex,
): Promise<void> {
  const [
    beaconRuntimeCodeHash,
    implementationRuntimeCodeHash,
    rawImplementation,
    rawRegistry,
    rawUid,
    rawMultiplier,
    rawBeaconPaused,
    rawTokenPaused,
    rawIndividualPaused,
    rawOraclePaused,
    rawVaultBlocked,
    rawStrategyBlocked,
    rawRewardsBlocked,
  ] = await Promise.all([
    bytecodeHash(client, dependency.beacon, snapshot, 'Stock-token beacon'),
    bytecodeHash(client, dependency.implementation, snapshot, 'Stock-token implementation'),
    client.readContract({
      abi: stockBeaconAbi,
      address: dependency.beacon,
      blockNumber: snapshot.blockNumber,
      functionName: 'implementation',
    }),
    client.readContract({
      abi: stockTokenIdentityAbi,
      address: config.token,
      blockNumber: snapshot.blockNumber,
      functionName: 'ACCESS_CONTROLLED_REGISTRY',
    }),
    client.readContract({
      abi: stockTokenIdentityAbi,
      address: config.token,
      blockNumber: snapshot.blockNumber,
      functionName: 'uid',
    }),
    client.readContract({
      abi: stockTokenIdentityAbi,
      address: config.token,
      blockNumber: snapshot.blockNumber,
      functionName: 'uiMultiplier',
    }),
    client.readContract({
      abi: stockBeaconAbi,
      address: dependency.beacon,
      blockNumber: snapshot.blockNumber,
      functionName: 'paused',
    }),
    client.readContract({
      abi: stockTokenIdentityAbi,
      address: config.token,
      blockNumber: snapshot.blockNumber,
      functionName: 'paused',
    }),
    client.readContract({
      abi: stockTokenIdentityAbi,
      address: config.token,
      blockNumber: snapshot.blockNumber,
      functionName: 'tokenPaused',
    }),
    client.readContract({
      abi: stockTokenIdentityAbi,
      address: config.token,
      blockNumber: snapshot.blockNumber,
      functionName: 'oraclePaused',
    }),
    ...[runtime.addresses.gumBallVault, config.strategy, config.rewards].map((account) =>
      client.readContract({
        abi: stockBeaconAbi,
        address: dependency.beacon,
        args: [account],
        blockNumber: snapshot.blockNumber,
        functionName: 'isBlocked',
      }),
    ),
  ]);
  if (
    tokenRuntimeCodeHash !== dependency.tokenRuntimeCodeHash.toLowerCase() ||
    beaconRuntimeCodeHash !== dependency.beaconRuntimeCodeHash.toLowerCase() ||
    implementationRuntimeCodeHash !== dependency.implementationRuntimeCodeHash.toLowerCase() ||
    !sameAddress(address(rawImplementation, 'Beacon implementation'), dependency.implementation) ||
    !sameAddress(address(rawRegistry, 'Stock-token access registry'), dependency.beacon) ||
    hash(rawUid, 'Stock-token UID') !== config.assetId.toLowerCase() ||
    unsigned(rawMultiplier, 'Stock-token UI multiplier') !== dependency.uiMultiplier ||
    boolean(rawBeaconPaused, 'Stock beacon pause') ||
    boolean(rawTokenPaused, 'Stock system pause') ||
    boolean(rawIndividualPaused, 'Stock token pause') ||
    boolean(rawOraclePaused, 'Stock oracle pause') ||
    boolean(rawVaultBlocked, 'Vault blocklist status') ||
    boolean(rawStrategyBlocked, 'Strategy blocklist status') ||
    boolean(rawRewardsBlocked, 'Rewards blocklist status')
  ) {
    throw new Error('Stock-token dependency, pause, UID, multiplier, or transfer-account evidence changed.');
  }
}

async function assertAssetRegistration(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  snapshot: LiveAdminSnapshot,
  config: TimelockAssetConfig,
  dependency?: TimelockStockTokenDependency,
): Promise<void> {
  if (snapshot.assets.length >= 16) throw new Error('The asset registry is already at its sixteen-asset bound.');
  if (snapshot.strategyRegistry.length >= 17) {
    throw new Error('The strategy registry is already at its seventeen-strategy bound.');
  }
  if (registeredAsset(snapshot, config.token) !== undefined) throw new Error('The target token is already registered.');
  if (registeredStrategy(snapshot, config.strategy) !== undefined) {
    throw new Error('The acquisition strategy is already registered to another asset.');
  }
  const identity = await readTokenIdentity(client, snapshot, config.token);
  if (identity.decimals !== config.decimals) throw new Error('Configured decimals do not match the target token.');
  if (keccak256(stringToHex(identity.symbol)) !== config.symbolHash.toLowerCase()) {
    throw new Error('Configured symbol hash does not match the target token symbol.');
  }
  await assertAcquisitionProvenance(client, runtime, snapshot, config);
  if (config.isStockToken) {
    if (dependency === undefined) throw new Error('Stock-token dependency evidence is required.');
    await assertStockIdentity(client, runtime, snapshot, config, dependency, identity.runtimeCodeHash);
  } else if (dependency !== undefined) {
    throw new Error('Non-stock registration cannot include stock-token dependency evidence.');
  }
}

async function assertMigration(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  snapshot: LiveAdminSnapshot,
  operation: Extract<TimelockOperation, { kind: 'migrate-liquidity' }>,
  phase: 'schedule' | 'execute',
): Promise<void> {
  if (snapshot.liquidity.migrationsPaused) throw new Error('Liquidity migrations are paused by the guardian.');
  assertCanonicalPoolKey(snapshot, operation);
  const plan = validateMigrationPlan(operation.plan);
  const earliest = snapshot.blockTimestamp + (phase === 'schedule' ? snapshot.timelock.criticalChangeDelay : 0n);
  if (plan.deadline <= earliest) {
    throw new Error(
      phase === 'schedule'
        ? 'Migration deadline must remain open after the seven-day timelock maturity.'
        : 'Migration deadline has passed at the pinned execution block.',
    );
  }
  if (
    phase === 'schedule' &&
    plan.deadline >
      snapshot.blockTimestamp + snapshot.timelock.criticalChangeDelay + snapshot.timelock.executionGracePeriod
  ) {
    throw new Error('Migration deadline must fall within the timelock execution-grace horizon.');
  }
  if (snapshot.liquidity.activePositionCount < BigInt(plan.removals.length)) {
    throw new Error('Migration removes more positions than the manager reports active.');
  }
  const resulting =
    snapshot.liquidity.activePositionCount - BigInt(plan.removals.length) + BigInt(plan.replacements.length);
  if (resulting > 16n) throw new Error('Migration would exceed the sixteen-active-position bound.');

  const [rawGenesisSeeded, rawPositionManager, ...records] = await Promise.all([
    client.readContract({
      abi: liquidityIdentityAbi,
      address: runtime.addresses.liquidityManager,
      blockNumber: snapshot.blockNumber,
      functionName: 'genesisSeeded',
    }),
    client.readContract({
      abi: liquidityIdentityAbi,
      address: runtime.addresses.liquidityManager,
      blockNumber: snapshot.blockNumber,
      functionName: 'POSITION_MANAGER',
    }),
    ...plan.removals.map((removal) =>
      client.readContract({
        abi: liquidityManagerAbi,
        address: runtime.addresses.liquidityManager,
        args: [removal.positionId],
        blockNumber: snapshot.blockNumber,
        functionName: 'positionRecord',
      }),
    ),
  ]);
  if (!boolean(rawGenesisSeeded, 'Liquidity genesis state')) throw new Error('Canonical liquidity is not seeded.');
  const positionManager = requireSameAddress(
    rawPositionManager,
    runtime.externalContracts.positionManager.address,
    'LiquidityManager PositionManager',
  );
  for (const [index, rawRecord] of records.entries()) {
    const values = rawRecord as readonly unknown[];
    if (values.length !== 5 || !boolean(values[4], `Removal ${index + 1} active record`)) {
      throw new Error(`Removal ${index + 1} is not an active canonical position.`);
    }
    const owner = await client.readContract({
      abi: positionManagerIdentityAbi,
      address: positionManager,
      args: [plan.removals[index]!.positionId],
      blockNumber: snapshot.blockNumber,
      functionName: 'ownerOf',
    });
    requireSameAddress(owner, runtime.addresses.liquidityManager, `Removal ${index + 1} owner`);
  }
}

/** Recomputes the named operation's current execution preconditions at a fresh pinned admin snapshot. */
export async function assertTimelockOperationPreconditions(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  snapshot: LiveAdminSnapshot,
  operation: TimelockOperation,
  phase: 'schedule' | 'execute',
): Promise<void> {
  const encoded = encodeKnownTimelockOperation(runtime, operation);
  if (
    encoded.expectedDelay !== snapshot.timelock.boundedMaintenanceDelay &&
    encoded.expectedDelay !== snapshot.timelock.criticalChangeDelay
  ) {
    throw new Error('Named operation delay is not one of the pinned timelock policy delays.');
  }

  if (operation.kind === 'unpause-mining') {
    if (!snapshot.mining.contributionsPaused) throw new Error('Mining contributions are not paused.');
  } else if (operation.kind === 'unpause-signals') {
    if (!snapshot.voter.signalActivationsPaused) throw new Error('Signal activations are not paused.');
  } else if (operation.kind === 'unpause-strategy') {
    const strategy = auctionStrategy(snapshot, operation.strategy);
    if (strategy === undefined || !strategy.fillsPaused) throw new Error('Selected auction strategy is not paused.');
  } else if (operation.kind === 'reset-reference-rate') {
    const strategy = auctionStrategy(snapshot, operation.strategy);
    if (strategy === undefined) throw new Error('Selected target is not a registered auction strategy.');
    if (phase === 'schedule' && operation.expectedReferenceRate !== strategy.referenceRate) {
      throw new Error('Reviewed reference-rate baseline no longer matches the pinned current reference.');
    }
    const { minimum, maximum } = referenceResetBounds(operation.expectedReferenceRate);
    if (operation.newReferenceRate < minimum || operation.newReferenceRate > maximum) {
      throw new Error('New reference rate must stay within the rounded 50% floor and capped 200% ceiling.');
    }
  } else if (operation.kind === 'rotate-guardian') {
    if (sameAddress(operation.newOperator, snapshot.guardian.operator)) {
      throw new Error('New guardian operator must differ from the current operator.');
    }
    await bytecodeHash(client, operation.newOperator, snapshot, 'New guardian operator');
  } else if (operation.kind === 'enable-acquisition') {
    const asset = registeredAsset(snapshot, operation.token);
    if (asset === undefined || sameAddress(asset.strategy, zeroAddress)) {
      throw new Error('Selected token is not a registered strategy-backed asset.');
    }
    if (asset.acquisitionEnabled) throw new Error('Selected asset acquisition is already enabled.');
  } else if (operation.kind === 'enable-standalone') {
    const strategy = registeredStrategy(snapshot, operation.strategy);
    if (strategy === undefined || strategy.kind !== 'buyback' || strategy.live) {
      throw new Error('Selected standalone buyback is not registry-disabled.');
    }
  } else if (operation.kind === 'reactivate-strategy') {
    const strategy = registeredStrategy(snapshot, operation.strategy);
    if (strategy === undefined || !strategy.voterDisabled || !strategy.live) {
      throw new Error('Voter reactivation requires a registry-live, voter-disabled strategy.');
    }
  } else if (operation.kind === 'set-redemption-enabled') {
    const asset = registeredAsset(snapshot, operation.token);
    if (asset === undefined) throw new Error('Selected token is not registered.');
    if (asset.redemptionEnabled === operation.enabled) throw new Error('Redemption readiness already has this value.');
    if (!operation.enabled && asset.vaultBalance !== 0n) {
      throw new Error('Redemption readiness cannot be disabled while the vault holds this asset.');
    }
  } else if (operation.kind === 'unpause-liquidity-migrations') {
    if (!snapshot.liquidity.migrationsPaused) throw new Error('Liquidity migrations are not paused.');
  } else if (operation.kind === 'deploy-acquisition') {
    if (!snapshot.timelock.strategyBootstrapFinalized || !snapshot.strategyDeployer.strategyBootstrapFinalized) {
      throw new Error('Strategy bootstrap is not finalized.');
    }
    if (
      !snapshot.strategyDeployer.dependenciesConfigured ||
      !sameAddress(snapshot.strategyDeployer.usdG, runtime.assets.USDG)
    ) {
      throw new Error('StrategyDeployer canonical USDG or dependency evidence is invalid.');
    }
    if (snapshot.assets.length >= 16 || snapshot.strategyRegistry.length >= 17) {
      throw new Error('No bounded registry capacity remains for another acquisition strategy.');
    }
    if (
      sameAddress(operation.targetToken, runtime.assets.USDG) ||
      sameAddress(operation.targetToken, runtime.addresses.gbx) ||
      registeredAsset(snapshot, operation.targetToken) !== undefined
    ) {
      throw new Error('Acquisition target must be a new non-USDG, non-GBX token.');
    }
    if (
      operation.strategyCreationCode !== acquisitionStrategyCreationCode ||
      operation.rewardsCreationCode !== managerRewardsCreationCode ||
      keccak256(operation.strategyCreationCode) !== snapshot.strategyDeployer.acquisitionStrategyCreationCodeHash ||
      keccak256(operation.rewardsCreationCode) !== snapshot.strategyDeployer.managerRewardsCreationCodeHash ||
      BigInt((operation.strategyCreationCode.length - 2) / 2) !==
        snapshot.strategyDeployer.acquisitionStrategyCreationCodeLength ||
      BigInt((operation.rewardsCreationCode.length - 2) / 2) !==
        snapshot.strategyDeployer.managerRewardsCreationCodeLength
    ) {
      throw new Error('Deployment bytecode does not match the client build and onchain immutable commitments.');
    }
    await readTokenIdentity(client, snapshot, operation.targetToken);
    const deployed = address(
      await client.readContract({
        abi: strategyDeployerAdminAbi,
        address: snapshot.strategyDeployer.address,
        args: [operation.targetToken],
        blockNumber: snapshot.blockNumber,
        functionName: 'acquisitionStrategyForToken',
      }),
      'Existing acquisition strategy',
    );
    if (!sameAddress(deployed, zeroAddress)) throw new Error('StrategyDeployer already has a strategy for this token.');
  } else if (operation.kind === 'register-asset') {
    await assertAssetRegistration(client, runtime, snapshot, operation.config);
  } else if (operation.kind === 'register-stock-asset') {
    await assertAssetRegistration(client, runtime, snapshot, operation.config, operation.dependency);
  } else {
    await assertMigration(client, runtime, snapshot, operation, phase);
  }
  await confirmAdminBlock(client, snapshot);
}

/** Helper used by the UI to explain why a syntactically valid draft is not currently schedulable/executable. */
export async function validateTimelockOperationDraft(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  snapshot: LiveAdminSnapshot,
  operation: TimelockOperation,
  phase: 'schedule' | 'execute',
): Promise<string | null> {
  try {
    await assertTimelockOperationPreconditions(client, runtime, snapshot, operation, phase);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'The named operation failed pinned-block validation.';
  }
}
