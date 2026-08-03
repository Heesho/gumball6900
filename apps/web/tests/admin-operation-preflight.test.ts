import { describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  keccak256,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';

import { assertTimelockOperationPreconditions, readTimelockOperationSnapshot } from '../lib/admin-operation-preflight';
import {
  encodeKnownTimelockOperation,
  hashKnownTimelockOperation,
  type TimelockOperation,
} from '../lib/admin-transactions';
import { acquisitionStrategyCreationCode, managerRewardsCreationCode } from '../lib/generated-strategy-creation-code';
import type { LiveAdminSnapshot } from '../lib/live-admin-snapshot';
import { basketAssetSymbols } from '../lib/live-protocol-overview';
import type { LiveRuntimeDeployment } from '../lib/runtime-types';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const BLOCK_NUMBER = 800n;
const BLOCK_TIMESTAMP = 2_000_000n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hex;
const STRATEGY_DEPLOYER = fixtureAddress(60);
const runtime = {
  ...liveRuntimeFixture,
  addresses: { ...liveRuntimeFixture.addresses, strategyDeployer: STRATEGY_DEPLOYER },
} as unknown as LiveRuntimeDeployment;
const BOOTSTRAP_TARGETS = basketAssetSymbols.slice(1).map((symbol) => runtime.assets[symbol]);
const BOOTSTRAP_TARGETS_HASH = keccak256(encodeAbiParameters([{ type: 'address[]' }], [BOOTSTRAP_TARGETS]));

function poolKey() {
  const [currency0, currency1] = [runtime.addresses.gbx, runtime.assets.USDG].sort((left, right) =>
    BigInt(left) < BigInt(right) ? -1 : 1,
  ) as [Address, Address];
  return { currency0, currency1, fee: 3_000, hooks: runtime.addresses.launchGuardHook, tickSpacing: 60 };
}

function snapshot(): LiveAdminSnapshot {
  const hold = {
    activeWeight: 1n,
    genesisSymbol: 'USDG' as const,
    kind: 'hold-usdg' as const,
    live: true,
    registryIndex: 0,
    strategy: runtime.strategies.USDG,
    symbol: 'USDG',
    token: runtime.assets.USDG,
    virtualUSDGBudget: 1n,
    voterDisabled: false,
  };
  const nvda = {
    activeWeight: 1n,
    genesisSymbol: 'NVDA' as const,
    kind: 'acquisition' as const,
    live: true,
    registryIndex: 1,
    strategy: runtime.strategies.NVDA,
    symbol: 'NVDA',
    token: runtime.assets.NVDA,
    virtualUSDGBudget: 1n,
    voterDisabled: false,
  };
  return {
    assets: [
      {
        acquisitionEnabled: true,
        assetId: `0x${'10'.repeat(32)}`,
        decimals: 6,
        genesisSymbol: 'USDG',
        isStockToken: false,
        redemptionEnabled: true,
        registryIndex: 0,
        rewards: zeroAddress,
        strategy: hold.strategy,
        symbol: 'USDG',
        symbolHash: `0x${'11'.repeat(32)}`,
        token: runtime.assets.USDG,
        vaultBalance: 100n,
      },
      {
        acquisitionEnabled: true,
        assetId: `0x${'12'.repeat(32)}`,
        decimals: 18,
        genesisSymbol: 'NVDA',
        isStockToken: true,
        redemptionEnabled: true,
        registryIndex: 1,
        rewards: runtime.rewards.NVDA,
        strategy: nvda.strategy,
        symbol: 'NVDA',
        symbolHash: `0x${'13'.repeat(32)}`,
        token: runtime.assets.NVDA,
        vaultBalance: 10n,
      },
    ],
    blockHash: BLOCK_HASH,
    blockNumber: BLOCK_NUMBER,
    blockTimestamp: BLOCK_TIMESTAMP,
    guardian: {
      allocationVoter: runtime.addresses.allocationVoter,
      assetRegistry: runtime.addresses.assetRegistry,
      operator: runtime.admin.guardianOperator,
      operatorMatchesManifest: true,
      targetsInitialized: true,
    },
    liquidity: { activePositionCount: 4n, migrationsPaused: false, poolKey: poolKey() },
    mining: {
      contributionsPaused: true,
      currentEpochId: 7n,
      currentEpochInvalidated: false,
      currentEpochSettled: false,
    },
    operations: [],
    strategies: [
      {
        auctionDuration: 86_400n,
        auctionId: 9n,
        auctionStartTime: BLOCK_TIMESTAMP - 100_000n,
        currentRate: 4n * 10n ** 18n,
        expired: true,
        fillsPaused: true,
        floorRate: 4n * 10n ** 18n,
        kind: 'acquisition',
        referenceRate: 5n * 10n ** 18n,
        registryIndex: 1,
        registryLive: true,
        startRate: 6n * 10n ** 18n,
        strategy: nvda.strategy,
        symbol: 'NVDA',
        token: nvda.token,
        voterDisabled: false,
      },
    ],
    strategyDeployer: {
      acquisitionStrategyCreationCodeHash: keccak256(acquisitionStrategyCreationCode),
      acquisitionStrategyCreationCodeLength: BigInt((acquisitionStrategyCreationCode.length - 2) / 2),
      address: STRATEGY_DEPLOYER,
      bootstrapAcquisitionTargetCount: BigInt(BOOTSTRAP_TARGETS.length),
      bootstrapAcquisitionTargetsHash: BOOTSTRAP_TARGETS_HASH,
      dependenciesConfigured: true,
      expectedBootstrapAcquisitionTargetCount: BigInt(BOOTSTRAP_TARGETS.length),
      expectedBootstrapAcquisitionTargetsHash: BOOTSTRAP_TARGETS_HASH,
      managerRewardsCreationCodeHash: keccak256(managerRewardsCreationCode),
      managerRewardsCreationCodeLength: BigInt((managerRewardsCreationCode.length - 2) / 2),
      strategyBootstrapFinalized: true,
      usdG: runtime.assets.USDG,
    },
    strategyRegistry: [hold, nvda],
    timelock: {
      boundedMaintenanceDelay: 172_800n,
      criticalChangeDelay: 604_800n,
      executionGracePeriod: 2_592_000n,
      proposer: runtime.admin.protocolTimelockProposer,
      strategyBootstrapFinalized: true,
      strategyDeployer: STRATEGY_DEPLOYER,
      targetsInitialized: true,
    },
    voter: { signalActivationsPaused: true },
  };
}

function confirmationClient(options: { number?: bigint; hash?: Hex } = {}) {
  return {
    getBlock: vi.fn(async () => ({
      hash: options.hash ?? BLOCK_HASH,
      number: options.number ?? BLOCK_NUMBER,
      timestamp: BLOCK_TIMESTAMP,
    })),
    readContract: vi.fn(),
  } as unknown as PublicClient;
}

describe('typed timelock operation preflight', () => {
  it('reconciles requiredDelay, onchain hashOperation, readiness, and the pinned block', async () => {
    const operation: TimelockOperation = { kind: 'unpause-mining' };
    const operationId = hashKnownTimelockOperation(runtime, operation);
    const encoded = encodeKnownTimelockOperation(runtime, operation);
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'requiredDelay') return encoded.expectedDelay;
      if (functionName === 'hashOperation') return operationId;
      if (functionName === 'operationReadyAt') return BLOCK_TIMESTAMP - 1n;
      throw new Error(`Unexpected ${functionName}`);
    });
    const client = {
      getBlock: vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: BLOCK_TIMESTAMP })),
      readContract,
    } as unknown as PublicClient;

    await expect(readTimelockOperationSnapshot(client, runtime, snapshot(), operation)).resolves.toMatchObject({
      delay: 172_800n,
      operationId,
      state: 'matured',
      target: runtime.addresses.miningPool,
    });
    expect(readContract).toHaveBeenCalledTimes(3);
  });

  it('uses the exact inclusive grace-period boundary for non-enumerable operation state', async () => {
    const operation: TimelockOperation = { kind: 'unpause-mining' };
    const operationId = hashKnownTimelockOperation(runtime, operation);
    const encoded = encodeKnownTimelockOperation(runtime, operation);
    const readyAt = 1_000_000n;
    const grace = snapshot().timelock.executionGracePeriod;
    const client = {
      getBlock: vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: readyAt + grace })),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'requiredDelay') return encoded.expectedDelay;
        if (functionName === 'hashOperation') return operationId;
        return readyAt;
      }),
    } as unknown as PublicClient;

    await expect(
      readTimelockOperationSnapshot(client, runtime, { ...snapshot(), blockTimestamp: readyAt + grace }, operation),
    ).resolves.toMatchObject({ expiresAt: readyAt + grace, state: 'matured' });
    await expect(
      readTimelockOperationSnapshot(
        client,
        runtime,
        { ...snapshot(), blockTimestamp: readyAt + grace + 1n },
        operation,
      ),
    ).resolves.toMatchObject({ expiresAt: readyAt + grace, state: 'expired' });
  });

  it('rediscovers a scheduled two-rate reset without rerunning its schedule-only baseline predicate', async () => {
    const operation: TimelockOperation = {
      kind: 'reset-reference-rate',
      strategy: runtime.strategies.NVDA,
      expectedReferenceRate: 4n * 10n ** 18n,
      newReferenceRate: 5n * 10n ** 18n,
    };
    const operationId = hashKnownTimelockOperation(runtime, operation);
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'hashOperation') return operationId;
      if (functionName === 'operationReadyAt') return BLOCK_TIMESTAMP - 1n;
      if (functionName === 'requiredDelay') throw new Error('schedule-only baseline mismatch');
      throw new Error(`Unexpected ${functionName}`);
    });
    const client = {
      getBlock: vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: BLOCK_TIMESTAMP })),
      readContract,
    } as unknown as PublicClient;

    await expect(readTimelockOperationSnapshot(client, runtime, snapshot(), operation)).resolves.toMatchObject({
      delay: 172_800n,
      operationId,
      state: 'matured',
    });
    expect(readContract.mock.calls.map(([request]) => request.functionName)).not.toContain('requiredDelay');
  });

  it('fails closed on delay, operation-ID, hash, or block-number drift', async () => {
    const operation: TimelockOperation = { kind: 'unpause-mining' };
    const operationId = hashKnownTimelockOperation(runtime, operation);
    const client = (delay: bigint, id: Hex, number = BLOCK_NUMBER, blockHash = BLOCK_HASH) =>
      ({
        getBlock: vi.fn(async () => ({ hash: blockHash, number, timestamp: BLOCK_TIMESTAMP })),
        readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
          if (functionName === 'requiredDelay') return delay;
          if (functionName === 'hashOperation') return id;
          return 0n;
        }),
      }) as unknown as PublicClient;

    await expect(
      readTimelockOperationSnapshot(client(1n, operationId), runtime, snapshot(), operation),
    ).rejects.toThrow('required delay');
    await expect(
      readTimelockOperationSnapshot(client(172_800n, `0x${'cd'.repeat(32)}`), runtime, snapshot(), operation),
    ).rejects.toThrow('operation ID');
    await expect(
      readTimelockOperationSnapshot(client(172_800n, operationId, BLOCK_NUMBER + 1n), runtime, snapshot(), operation),
    ).rejects.toThrow('pinned admin block');
    await expect(
      readTimelockOperationSnapshot(
        client(172_800n, operationId, BLOCK_NUMBER, `0x${'ef'.repeat(32)}`),
        runtime,
        snapshot(),
        operation,
      ),
    ).rejects.toThrow('pinned admin block');
  });

  it('enforces inclusive 50%–200% rate-reset bounds without an expiry-only liveness gate', async () => {
    const base = snapshot();
    const client = confirmationClient();
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        base,
        {
          kind: 'reset-reference-rate',
          strategy: runtime.strategies.NVDA,
          expectedReferenceRate: 5n * 10n ** 18n,
          newReferenceRate: 2_500_000_000_000_000_000n,
        },
        'schedule',
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        base,
        {
          kind: 'reset-reference-rate',
          strategy: runtime.strategies.NVDA,
          expectedReferenceRate: 5n * 10n ** 18n,
          newReferenceRate: 10n * 10n ** 18n,
        },
        'schedule',
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        base,
        {
          kind: 'reset-reference-rate',
          strategy: runtime.strategies.NVDA,
          expectedReferenceRate: 5n * 10n ** 18n,
          newReferenceRate: 2_499_999_999_999_999_999n,
        },
        'schedule',
      ),
    ).rejects.toThrow('rounded 50% floor');
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        { ...base, strategies: [{ ...base.strategies[0]!, expired: false }] },
        {
          kind: 'reset-reference-rate',
          strategy: runtime.strategies.NVDA,
          expectedReferenceRate: 5n * 10n ** 18n,
          newReferenceRate: 5n * 10n ** 18n,
        },
        'schedule',
      ),
    ).resolves.toBeUndefined();
    const historicalBaseline = {
      kind: 'reset-reference-rate',
      strategy: runtime.strategies.NVDA,
      expectedReferenceRate: 4n * 10n ** 18n,
      newReferenceRate: 4n * 10n ** 18n,
    } as const;
    await expect(
      assertTimelockOperationPreconditions(client, runtime, base, historicalBaseline, 'schedule'),
    ).rejects.toThrow('baseline');
    await expect(
      assertTimelockOperationPreconditions(client, runtime, base, historicalBaseline, 'execute'),
    ).resolves.toBeUndefined();
  });

  it('matches the contract rounded floor and overflow-safe maximum-rate cap for reset bounds', async () => {
    const base = snapshot();
    const client = confirmationClient();
    const tinyBaseline = { ...base, strategies: [{ ...base.strategies[0]!, referenceRate: 3n }] };
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        tinyBaseline,
        {
          kind: 'reset-reference-rate',
          strategy: runtime.strategies.NVDA,
          expectedReferenceRate: 3n,
          newReferenceRate: 2n,
        },
        'schedule',
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        tinyBaseline,
        {
          kind: 'reset-reference-rate',
          strategy: runtime.strategies.NVDA,
          expectedReferenceRate: 3n,
          newReferenceRate: 1n,
        },
        'schedule',
      ),
    ).rejects.toThrow('rounded 50% floor');

    const maximumReferenceRate = ((1n << 256n) - 1n) / 2n;
    const hugeBaseline = {
      ...base,
      strategies: [{ ...base.strategies[0]!, referenceRate: maximumReferenceRate }],
    };
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        hugeBaseline,
        {
          kind: 'reset-reference-rate',
          strategy: runtime.strategies.NVDA,
          expectedReferenceRate: maximumReferenceRate,
          newReferenceRate: maximumReferenceRate,
        },
        'schedule',
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        hugeBaseline,
        {
          kind: 'reset-reference-rate',
          strategy: runtime.strategies.NVDA,
          expectedReferenceRate: maximumReferenceRate,
          newReferenceRate: maximumReferenceRate + 1n,
        },
        'schedule',
      ),
    ).rejects.toThrow('capped 200% ceiling');
  });

  it('requires registry enable before voter reactivation and includes HoldUSDG recovery', async () => {
    const base = snapshot();
    const hold = base.strategyRegistry[0]!;
    const disabled = {
      ...base,
      assets: [{ ...base.assets[0]!, acquisitionEnabled: false }, base.assets[1]!],
      strategyRegistry: [{ ...hold, live: false, voterDisabled: true }, base.strategyRegistry[1]!],
    };
    const client = confirmationClient();
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        disabled,
        { kind: 'enable-acquisition', token: runtime.assets.USDG },
        'schedule',
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        disabled,
        { kind: 'reactivate-strategy', strategy: runtime.strategies.USDG },
        'schedule',
      ),
    ).rejects.toThrow('registry-live');
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        { ...disabled, strategyRegistry: [{ ...hold, live: true, voterDisabled: true }, base.strategyRegistry[1]!] },
        { kind: 'reactivate-strategy', strategy: runtime.strategies.USDG },
        'schedule',
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects redemption-readiness disable with a nonzero raw vault balance', async () => {
    await expect(
      assertTimelockOperationPreconditions(
        confirmationClient(),
        runtime,
        snapshot(),
        { kind: 'set-redemption-enabled', token: runtime.assets.NVDA, enabled: false },
        'schedule',
      ),
    ).rejects.toThrow('vault holds');
  });

  it('uses only exact bundled creation code and onchain commitments for deployment', async () => {
    const operation: TimelockOperation = {
      initialReferenceRate: 1n,
      kind: 'deploy-acquisition',
      maximumLotUSDG: 2n,
      minimumLotUSDG: 1n,
      rewardsCreationCode: managerRewardsCreationCode,
      strategyCreationCode: acquisitionStrategyCreationCode,
      targetToken: fixtureAddress(900),
    };
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'symbol') return 'LINK';
      if (functionName === 'decimals') return 18;
      if (functionName === 'acquisitionStrategyForToken') return zeroAddress;
      throw new Error(`Unexpected ${functionName}`);
    });
    const client = {
      getBlock: vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: BLOCK_TIMESTAMP })),
      getBytecode: vi.fn(async () => '0x6000'),
      readContract,
    } as unknown as PublicClient;
    await expect(
      assertTimelockOperationPreconditions(client, runtime, snapshot(), operation, 'schedule'),
    ).resolves.toBeUndefined();
    await expect(
      assertTimelockOperationPreconditions(
        client,
        runtime,
        snapshot(),
        { ...operation, strategyCreationCode: '0x6000' },
        'schedule',
      ),
    ).rejects.toThrow('bytecode');
  });

  it('pins migration PoolKey and requires a deadline after seven-day maturity', async () => {
    const base = snapshot();
    const plan = {
      deadline: BLOCK_TIMESTAMP + 604_801n,
      destinationPoolKey: base.liquidity.poolKey,
      removals: [{ amount0Min: 1n, amount1Min: 0n, positionId: 1n }],
      replacements: [{ amount0Max: 1n, amount1Max: 0n, liquidity: 1n, tickLower: -60, tickUpper: 60 }],
    };
    await expect(
      assertTimelockOperationPreconditions(
        confirmationClient(),
        runtime,
        base,
        { kind: 'migrate-liquidity', plan: { ...plan, deadline: BLOCK_TIMESTAMP + 604_800n } },
        'schedule',
      ),
    ).rejects.toThrow('after the seven-day');
    await expect(
      assertTimelockOperationPreconditions(
        confirmationClient(),
        runtime,
        base,
        {
          kind: 'migrate-liquidity',
          plan: { ...plan, destinationPoolKey: { ...plan.destinationPoolKey, fee: 500 } },
        },
        'schedule',
      ),
    ).rejects.toThrow('canonical LiquidityManager PoolKey');
  });

  it('revalidates exact acquisition provenance and every stock-token dependency at the pinned block', async () => {
    const token = fixtureAddress(900);
    const strategy = fixtureAddress(901);
    const rewards = fixtureAddress(902);
    const beacon = fixtureAddress(903);
    const implementation = fixtureAddress(904);
    const codes = new Map<string, Hex>([
      [token.toLowerCase(), '0x6000'],
      [strategy.toLowerCase(), '0x6001'],
      [rewards.toLowerCase(), '0x6002'],
      [beacon.toLowerCase(), '0x6003'],
      [implementation.toLowerCase(), '0x6004'],
    ]);
    const assetId = `0x${'31'.repeat(32)}` as Hex;
    const config = {
      acquisitionEnabled: true,
      assetId,
      decimals: 18,
      isStockToken: true,
      redemptionEnabled: true,
      rewards,
      strategy,
      symbolHash: keccak256(stringToHex('LINK')),
      token,
    } as const;
    const dependency = {
      beacon,
      beaconRuntimeCodeHash: keccak256(codes.get(beacon.toLowerCase())!),
      implementation,
      implementationRuntimeCodeHash: keccak256(codes.get(implementation.toLowerCase())!),
      tokenRuntimeCodeHash: keccak256(codes.get(token.toLowerCase())!),
      uiMultiplier: 10n ** 18n,
    } as const;
    const clientForStock = (
      blockedAccount?: Address,
      identityDrift: Readonly<{
        strategyTarget?: Address;
        strategyUSDGDecimals?: number;
        rewardsStrategy?: Address;
      }> = {},
    ) => {
      const readContract = vi.fn(
        async ({
          address,
          args,
          functionName,
        }: {
          address: Address;
          args?: readonly unknown[];
          functionName: string;
        }) => {
          if (functionName === 'symbol') return 'LINK';
          if (functionName === 'decimals') {
            return address.toLowerCase() === runtime.assets.USDG.toLowerCase()
              ? runtime.assetMetadata.USDG.decimals
              : 18;
          }
          if (functionName === 'acquisitionStrategyForToken') return strategy;
          if (functionName === 'acquisitionPair') {
            return [
              token,
              rewards,
              runtime.addresses.gumBallVault,
              runtime.addresses.allocationVoter,
              runtime.addresses.assetRegistry,
              runtime.admin.protocolTimelock,
              runtime.admin.emergencyGuardian,
              runtime.addresses.eligibilityModule,
              keccak256(codes.get(strategy.toLowerCase())!),
              keccak256(codes.get(rewards.toLowerCase())!),
            ];
          }
          if (functionName === 'TARGET_TOKEN') return identityDrift.strategyTarget ?? token;
          if (functionName === 'managerRewards') return rewards;
          if (functionName === 'USDG_DECIMALS') {
            return identityDrift.strategyUSDGDecimals ?? runtime.assetMetadata.USDG.decimals;
          }
          if (functionName === 'TARGET_DECIMALS') return 18;
          if (functionName === 'REWARD_TOKEN') return token;
          if (functionName === 'STRATEGY') return identityDrift.rewardsStrategy ?? strategy;
          if (functionName === 'implementation') return implementation;
          if (functionName === 'ACCESS_CONTROLLED_REGISTRY') return beacon;
          if (functionName === 'uid') return assetId;
          if (functionName === 'uiMultiplier') return 10n ** 18n;
          if (functionName === 'paused' || functionName === 'tokenPaused' || functionName === 'oraclePaused') {
            return false;
          }
          if (functionName === 'isBlocked') {
            return blockedAccount !== undefined && (args?.[0] as string).toLowerCase() === blockedAccount.toLowerCase();
          }
          throw new Error(`Unexpected ${functionName}`);
        },
      );
      return {
        getBlock: vi.fn(async () => ({ hash: BLOCK_HASH, number: BLOCK_NUMBER, timestamp: BLOCK_TIMESTAMP })),
        getBytecode: vi.fn(async ({ address }: { address: Address }) => codes.get(address.toLowerCase())),
        readContract,
      } as unknown as PublicClient;
    };
    const operation: TimelockOperation = { kind: 'register-stock-asset', config, dependency };
    const registrationSnapshot = snapshot();
    await expect(
      assertTimelockOperationPreconditions(clientForStock(), runtime, registrationSnapshot, operation, 'schedule'),
    ).resolves.toBeUndefined();
    await expect(
      assertTimelockOperationPreconditions(
        clientForStock(rewards),
        runtime,
        registrationSnapshot,
        operation,
        'execute',
      ),
    ).rejects.toThrow('evidence changed');
    await expect(
      assertTimelockOperationPreconditions(
        clientForStock(undefined, { strategyTarget: fixtureAddress(999) }),
        runtime,
        registrationSnapshot,
        operation,
        'schedule',
      ),
    ).rejects.toThrow('identity getters');
    await expect(
      assertTimelockOperationPreconditions(
        clientForStock(undefined, { strategyUSDGDecimals: runtime.assetMetadata.USDG.decimals + 1 }),
        runtime,
        registrationSnapshot,
        operation,
        'schedule',
      ),
    ).rejects.toThrow('decimal commitments');
  });
});
