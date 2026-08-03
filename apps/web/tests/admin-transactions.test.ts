import { decodeFunctionData, isAddressEqual, parseAbi, toFunctionSelector, type Address, type Hex } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  buildGuardianAdminAction,
  buildKnownTimelockCancel,
  buildKnownTimelockTransaction,
  BOUNDED_MAINTENANCE_DELAY_SECONDS,
  CRITICAL_CHANGE_DELAY_SECONDS,
  encodeKnownTimelockOperation,
  guardianAdminAbi,
  hashKnownTimelockOperation,
  MAX_AUCTION_REFERENCE_RATE,
  protocolTimelockAdminAbi,
  runtimeAdminRole,
  type TimelockOperation,
} from '../lib/admin-transactions';
import type { LiveRuntimeDeployment } from '../lib/runtime-types';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const unpauseStrategyAbi = parseAbi(['function unpauseFills()']);
const strategyDeployer = fixtureAddress(60);
const runtime = {
  ...liveRuntimeFixture,
  addresses: { ...liveRuntimeFixture.addresses, strategyDeployer },
} as unknown as LiveRuntimeDeployment;

function config(stock = false) {
  return {
    acquisitionEnabled: true,
    assetId: `0x${'11'.repeat(32)}` as Hex,
    decimals: 18,
    isStockToken: stock,
    redemptionEnabled: true,
    rewards: fixtureAddress(903),
    strategy: fixtureAddress(902),
    symbolHash: `0x${'22'.repeat(32)}` as Hex,
    token: fixtureAddress(901),
  };
}

const poolKey = {
  currency0: fixtureAddress(1),
  currency1: fixtureAddress(20),
  fee: 3_000,
  hooks: fixtureAddress(14),
  tickSpacing: 60,
};

const migrationPlan = {
  deadline: 9_999_999n,
  destinationPoolKey: poolKey,
  removals: [{ amount0Min: 1n, amount1Min: 0n, positionId: 7n }],
  replacements: [{ amount0Max: 1n, amount1Max: 0n, liquidity: 10n, tickLower: -60, tickUpper: 60 }],
};

describe('bounded admin transaction builders', () => {
  it('derives authority only from the signed runtime roles', () => {
    expect(runtimeAdminRole(liveRuntimeFixture.admin.guardianOperator, liveRuntimeFixture)).toBe('guardian');
    expect(runtimeAdminRole(liveRuntimeFixture.admin.protocolTimelockProposer, liveRuntimeFixture)).toBe(
      'timelock-proposer',
    );
    expect(runtimeAdminRole(fixtureAddress(999), liveRuntimeFixture)).toBe('none');
    expect(runtimeAdminRole(undefined, liveRuntimeFixture)).toBe('none');
  });

  it('pins guardian calls to the manifest guardian and named protocol targets', () => {
    const transaction = buildGuardianAdminAction(liveRuntimeFixture, {
      kind: 'disable-acquisition',
      token: liveRuntimeFixture.assets.NVDA,
    });
    const decoded = decodeFunctionData({ abi: guardianAdminAbi, data: transaction.data });

    expect(transaction.to).toBe(liveRuntimeFixture.admin.emergencyGuardian);
    expect(transaction.value).toBe(0n);
    expect(decoded.functionName).toBe('disableAssetAcquisition');
    expect(decoded.args).toEqual([liveRuntimeFixture.assets.NVDA]);
  });

  it('encodes only named signal-pause and standalone-disable guardian selectors', () => {
    const signalPause = decodeFunctionData({
      abi: guardianAdminAbi,
      data: buildGuardianAdminAction(liveRuntimeFixture, { kind: 'pause-signals' }).data,
    });
    const standaloneDisable = decodeFunctionData({
      abi: guardianAdminAbi,
      data: buildGuardianAdminAction(liveRuntimeFixture, {
        kind: 'disable-standalone',
        strategy: liveRuntimeFixture.strategies.BURN,
      }).data,
    });
    expect(signalPause.functionName).toBe('pauseSignalActivations');
    if (standaloneDisable.functionName !== 'disableStandaloneStrategy') {
      throw new Error('Expected a standalone-strategy disable call.');
    }
    expect(standaloneDisable.args[0].toLowerCase()).toBe(liveRuntimeFixture.strategies.BURN.toLowerCase());
  });

  it('wraps only a known selector and target in schedule/execute calls', () => {
    for (const mode of ['schedule', 'execute'] as const) {
      const transaction = buildKnownTimelockTransaction(liveRuntimeFixture, mode, {
        kind: 'unpause-strategy',
        strategy: liveRuntimeFixture.strategies.BURN,
      });
      const decoded = decodeFunctionData({ abi: protocolTimelockAdminAbi, data: transaction.data });
      if (decoded.functionName !== mode) throw new Error(`Expected ${mode} calldata.`);
      const [target, nestedData, salt] = decoded.args;
      const nested = decodeFunctionData({ abi: unpauseStrategyAbi, data: nestedData });

      expect(transaction.to).toBe(liveRuntimeFixture.admin.protocolTimelock);
      expect(decoded.functionName).toBe(mode);
      expect(isAddressEqual(target, liveRuntimeFixture.strategies.BURN)).toBe(true);
      expect(nested.functionName).toBe('unpauseFills');
      expect(salt).toBe(`0x${'00'.repeat(32)}`);
    }
  });

  it('cancels only a previously resolved operation ID', () => {
    const operationId = `0x${'ab'.repeat(32)}` as const;
    const transaction = buildKnownTimelockCancel(liveRuntimeFixture, operationId);
    const decoded = decodeFunctionData({ abi: protocolTimelockAdminAbi, data: transaction.data });
    expect(transaction.to).toBe(liveRuntimeFixture.admin.protocolTimelock);
    expect(decoded.functionName).toBe('cancel');
    expect(decoded.args).toEqual([operationId]);
  });

  it('encodes the complete closed post-launch selector matrix with fixed targets and delays', () => {
    const bounded: readonly [TimelockOperation, Address, string][] = [
      [{ kind: 'unpause-mining' }, runtime.addresses.miningPool, 'unpauseContributions()'],
      [{ kind: 'unpause-signals' }, runtime.addresses.allocationVoter, 'unpauseSignalActivations()'],
      [{ kind: 'unpause-strategy', strategy: fixtureAddress(301) }, fixtureAddress(301), 'unpauseFills()'],
      [
        {
          kind: 'reset-reference-rate',
          strategy: fixtureAddress(301),
          expectedReferenceRate: 1n,
          newReferenceRate: 2n,
        },
        fixtureAddress(301),
        'resetReferenceRate(uint256,uint256)',
      ],
      [
        { kind: 'rotate-guardian', newOperator: fixtureAddress(302) },
        runtime.admin.emergencyGuardian,
        'rotateOperator(address)',
      ],
      [
        { kind: 'enable-acquisition', token: fixtureAddress(303) },
        runtime.addresses.assetRegistry,
        'enableAcquisition(address)',
      ],
      [
        { kind: 'enable-standalone', strategy: fixtureAddress(304) },
        runtime.addresses.assetRegistry,
        'enableStandaloneStrategy(address)',
      ],
      [
        { kind: 'reactivate-strategy', strategy: fixtureAddress(305) },
        runtime.addresses.allocationVoter,
        'reactivateStrategy(address)',
      ],
      [
        { kind: 'set-redemption-enabled', token: fixtureAddress(306), enabled: false },
        runtime.addresses.assetRegistry,
        'setRedemptionEnabled(address,bool)',
      ],
      [{ kind: 'unpause-liquidity-migrations' }, runtime.addresses.liquidityManager, 'unpauseMigrations()'],
    ];
    const critical: readonly [TimelockOperation, Address, string][] = [
      [
        {
          kind: 'deploy-acquisition',
          initialReferenceRate: 1n,
          maximumLotUSDG: 2n,
          minimumLotUSDG: 1n,
          rewardsCreationCode: '0x6001',
          strategyCreationCode: '0x6000',
          targetToken: fixtureAddress(901),
        },
        strategyDeployer,
        'deployAcquisition(bytes,bytes,address,uint256,uint256,uint256)',
      ],
      [
        { kind: 'register-asset', config: config() },
        runtime.addresses.assetRegistry,
        'registerAsset((address,bytes32,bytes32,uint8,address,address,bool,bool,bool))',
      ],
      [
        {
          kind: 'register-stock-asset',
          config: config(true),
          dependency: {
            beacon: fixtureAddress(904),
            beaconRuntimeCodeHash: `0x${'33'.repeat(32)}`,
            implementation: fixtureAddress(905),
            implementationRuntimeCodeHash: `0x${'44'.repeat(32)}`,
            tokenRuntimeCodeHash: `0x${'55'.repeat(32)}`,
            uiMultiplier: 10n ** 18n,
          },
        },
        runtime.addresses.assetRegistry,
        'registerStockAsset((address,bytes32,bytes32,uint8,address,address,bool,bool,bool),(bytes32,address,bytes32,address,bytes32,uint256))',
      ],
      [
        { kind: 'migrate-liquidity', plan: migrationPlan },
        runtime.addresses.liquidityManager,
        'migrateLiquidity(((address,address,uint24,int24,address),(uint256,uint128,uint128)[],(int24,int24,uint128,uint128,uint128)[],uint256))',
      ],
    ];
    for (const [operation, target, signature] of bounded) {
      const encoded = encodeKnownTimelockOperation(runtime, operation);
      expect(isAddressEqual(encoded.target, target)).toBe(true);
      expect(encoded.data.slice(0, 10)).toBe(toFunctionSelector(signature));
      expect(encoded.expectedDelay).toBe(BOUNDED_MAINTENANCE_DELAY_SECONDS);
    }
    for (const [operation, target, signature] of critical) {
      const encoded = encodeKnownTimelockOperation(runtime, operation);
      expect(isAddressEqual(encoded.target, target)).toBe(true);
      expect(encoded.data.slice(0, 10)).toBe(toFunctionSelector(signature));
      expect(encoded.expectedDelay).toBe(CRITICAL_CHANGE_DELAY_SECONDS);
    }
  });

  it('binds operation IDs to chain, timelock, target, complete calldata, and zero salt', () => {
    const first = hashKnownTimelockOperation(runtime, {
      kind: 'reset-reference-rate',
      strategy: fixtureAddress(301),
      expectedReferenceRate: 9n,
      newReferenceRate: 10n,
    });
    const second = hashKnownTimelockOperation(runtime, {
      kind: 'reset-reference-rate',
      strategy: fixtureAddress(301),
      expectedReferenceRate: 9n,
      newReferenceRate: 11n,
    });
    expect(first).toMatch(/^0x[\da-f]{64}$/u);
    expect(second).not.toBe(first);
  });

  it('rejects zero identity hashes, noncanonical PoolKeys, duplicate removals, and empty slippage bounds', () => {
    expect(() =>
      encodeKnownTimelockOperation(runtime, {
        kind: 'register-asset',
        config: { ...config(), assetId: `0x${'00'.repeat(32)}` },
      }),
    ).toThrow('must not be zero');
    expect(() =>
      encodeKnownTimelockOperation(runtime, {
        kind: 'migrate-liquidity',
        plan: {
          ...migrationPlan,
          destinationPoolKey: { ...poolKey, currency0: poolKey.currency1, currency1: poolKey.currency0 },
        },
      }),
    ).toThrow('canonically ordered');
    expect(() =>
      encodeKnownTimelockOperation(runtime, {
        kind: 'migrate-liquidity',
        plan: { ...migrationPlan, removals: [...migrationPlan.removals, migrationPlan.removals[0]!] },
      }),
    ).toThrow('duplicated');
    expect(() =>
      encodeKnownTimelockOperation(runtime, {
        kind: 'migrate-liquidity',
        plan: { ...migrationPlan, replacements: [{ ...migrationPlan.replacements[0]!, amount0Max: 0n }] },
      }),
    ).toThrow('nonzero maximum');
    expect(() =>
      encodeKnownTimelockOperation(runtime, {
        initialReferenceRate: MAX_AUCTION_REFERENCE_RATE + 1n,
        kind: 'deploy-acquisition',
        maximumLotUSDG: 2n,
        minimumLotUSDG: 1n,
        rewardsCreationCode: '0x6001',
        strategyCreationCode: '0x6000',
        targetToken: fixtureAddress(901),
      }),
    ).toThrow('strategy maximum');
  });

  it('adds only named epoch invalidation and liquidity-pause guardian calls', () => {
    const invalidation = decodeFunctionData({
      abi: guardianAdminAbi,
      data: buildGuardianAdminAction(runtime, { kind: 'invalidate-mining-epoch' }).data,
    });
    const liquidityPause = decodeFunctionData({
      abi: guardianAdminAbi,
      data: buildGuardianAdminAction(runtime, { kind: 'pause-liquidity-migrations' }).data,
    });
    expect(invalidation.functionName).toBe('invalidateMiningEpoch');
    expect(liquidityPause.functionName).toBe('pauseLiquidityMigrations');
  });
});
