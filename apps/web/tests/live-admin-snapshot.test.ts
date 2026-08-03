import { MAX_CUMULATIVE_MINT } from '@gumball-6900/sdk';
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

import { encodeKnownTimelockOperation } from '../lib/admin-transactions';
import { acquisitionStrategyCreationCode, managerRewardsCreationCode } from '../lib/generated-strategy-creation-code';
import { adminStrategySymbols, readLiveAdminSnapshot } from '../lib/live-admin-snapshot';
import { basketAssetSymbols } from '../lib/live-protocol-overview';
import { strategySymbols, type LiveRuntimeDeployment } from '../lib/runtime-types';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const BLOCK_NUMBER = 777n;
const BLOCK_TIMESTAMP = 200_000n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as const;
const MINTED = 1_000n * 10n ** 18n;
const BURNED = 100n * 10n ** 18n;
const STRATEGY_DEPLOYER = fixtureAddress(60);
const runtime = {
  ...liveRuntimeFixture,
  addresses: { ...liveRuntimeFixture.addresses, strategyDeployer: STRATEGY_DEPLOYER },
} as unknown as LiveRuntimeDeployment;
const BOOTSTRAP_TARGETS = basketAssetSymbols.slice(1).map((symbol) => liveRuntimeFixture.assets[symbol]);
const BOOTSTRAP_TARGETS_HASH = keccak256(encodeAbiParameters([{ type: 'address[]' }], [BOOTSTRAP_TARGETS]));

function lensAssetRows() {
  return basketAssetSymbols.map((symbol, index) => ({
    acquisitionEnabled: true,
    assetId: keccak256(stringToHex(`asset:${symbol}`)),
    decimals: liveRuntimeFixture.assetMetadata[symbol].decimals,
    isStockToken: liveRuntimeFixture.assetMetadata[symbol].registryStatus === 'ASSET_STATUS_ACTIVE',
    redemptionEnabled: true,
    rewards: symbol === 'USDG' ? zeroAddress : liveRuntimeFixture.rewards[symbol],
    strategy: liveRuntimeFixture.strategies[symbol],
    symbolHash: keccak256(stringToHex(symbol)),
    token: liveRuntimeFixture.assets[symbol],
    vaultBalance: BigInt(index + 1) * 10n ** BigInt(liveRuntimeFixture.assetMetadata[symbol].decimals),
  }));
}

function lensStrategyRows() {
  return strategySymbols.map((symbol, index) => ({
    activeWeight: BigInt(index + 1) * 10n ** 18n,
    live: true,
    strategy: liveRuntimeFixture.strategies[symbol],
    token: symbol === 'BURN' ? zeroAddress : liveRuntimeFixture.assets[symbol],
    virtualUSDGBudget: BigInt(index + 1) * 1_000_000n,
    voterDisabled: false,
  }));
}

function localOperationId(operation: Parameters<typeof encodeKnownTimelockOperation>[1]): Hex {
  const encoded = encodeKnownTimelockOperation(runtime, operation);
  return keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }],
      [BigInt(runtime.chain.id), runtime.admin.protocolTimelock, encoded.target, keccak256(encoded.data), encoded.salt],
    ),
  );
}

function clientFor(
  options: {
    confirmationHash?: Hex;
    confirmationNumber?: bigint;
    deployerBootstrapCommitmentHash?: Hex;
    deployerBootstrapFinalized?: boolean;
    deployerUSDG?: Address;
    guardianOperator?: Address;
    timelockRegistry?: Address;
  } = {},
) {
  const pendingMining = localOperationId({ kind: 'unpause-mining' });
  const maturedSignals = localOperationId({ kind: 'unpause-signals' });
  const strategyByAddress = new Map(
    adminStrategySymbols.map((symbol) => [liveRuntimeFixture.strategies[symbol].toLowerCase(), symbol] as const),
  );
  const readContract = vi.fn(
    async ({
      address,
      args,
      functionName,
    }: {
      address: Address;
      args?: readonly unknown[];
      blockNumber?: bigint;
      functionName: string;
    }) => {
      if (address.toLowerCase() === liveRuntimeFixture.addresses.gumBallLens.toLowerCase()) {
        if (functionName === 'supplyView') {
          return {
            cumulativeBurned: BURNED,
            cumulativeMinted: MINTED,
            remainingMintCapacity: MAX_CUMULATIVE_MINT - MINTED,
            totalSupply: MINTED - BURNED,
          };
        }
        if (functionName === 'assetViews') return lensAssetRows();
        if (functionName === 'strategyViews') return lensStrategyRows();
      }
      if (address.toLowerCase() === liveRuntimeFixture.admin.emergencyGuardian.toLowerCase()) {
        if (functionName === 'operator') return options.guardianOperator ?? liveRuntimeFixture.admin.guardianOperator;
        if (functionName === 'PROTOCOL_TIMELOCK') return liveRuntimeFixture.admin.protocolTimelock;
        if (functionName === 'assetRegistry') return liveRuntimeFixture.addresses.assetRegistry;
        if (functionName === 'allocationVoter') return liveRuntimeFixture.addresses.allocationVoter;
        if (functionName === 'targetsInitialized') return true;
      }
      if (address.toLowerCase() === liveRuntimeFixture.admin.protocolTimelock.toLowerCase()) {
        if (functionName === 'PROPOSER_MULTISIG') return liveRuntimeFixture.admin.protocolTimelockProposer;
        if (functionName === 'assetRegistry') {
          return options.timelockRegistry ?? liveRuntimeFixture.addresses.assetRegistry;
        }
        if (functionName === 'emergencyGuardian') return liveRuntimeFixture.admin.emergencyGuardian;
        if (functionName === 'allocationVoter') return liveRuntimeFixture.addresses.allocationVoter;
        if (functionName === 'miningPool') return liveRuntimeFixture.addresses.miningPool;
        if (functionName === 'liquidityManager') return liveRuntimeFixture.addresses.liquidityManager;
        if (functionName === 'strategyDeployer') return STRATEGY_DEPLOYER;
        if (functionName === 'targetsInitialized') return true;
        if (functionName === 'strategyBootstrapFinalized') return true;
        if (functionName === 'BOUNDED_MAINTENANCE_DELAY') return 172_800n;
        if (functionName === 'CRITICAL_CHANGE_DELAY') return 604_800n;
        if (functionName === 'EXECUTION_GRACE_PERIOD') return 2_592_000n;
        if (functionName === 'operationReadyAt') {
          const operationId = args?.[0];
          if (operationId === pendingMining) return BLOCK_TIMESTAMP + 100n;
          if (operationId === maturedSignals) return BLOCK_TIMESTAMP - 100n;
          return 0n;
        }
      }
      if (address.toLowerCase() === liveRuntimeFixture.addresses.miningPool.toLowerCase()) {
        if (functionName === 'contributionsPaused') return false;
        if (functionName === 'currentEpochId') return 7n;
        if (functionName === 'getEpoch') return { invalidated: false, settled: false };
      }
      if (address.toLowerCase() === liveRuntimeFixture.addresses.allocationVoter.toLowerCase()) {
        if (functionName === 'signalActivationsPaused') return true;
      }
      if (address.toLowerCase() === liveRuntimeFixture.addresses.liquidityManager.toLowerCase()) {
        if (functionName === 'migrationsPaused') return false;
        if (functionName === 'activePositionCount') return 4n;
        if (functionName === 'poolKey') {
          const currencies = [liveRuntimeFixture.addresses.gbx, liveRuntimeFixture.assets.USDG].sort((left, right) =>
            BigInt(left) < BigInt(right) ? -1 : 1,
          );
          return {
            currency0: currencies[0],
            currency1: currencies[1],
            fee: 3_000,
            hooks: liveRuntimeFixture.addresses.launchGuardHook,
            tickSpacing: 60,
          };
        }
      }
      if (address.toLowerCase() === STRATEGY_DEPLOYER.toLowerCase()) {
        if (functionName === 'dependenciesConfigured') return true;
        if (functionName === 'strategyBootstrapFinalized') return options.deployerBootstrapFinalized ?? true;
        if (functionName === 'EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT') {
          return BigInt(BOOTSTRAP_TARGETS.length);
        }
        if (functionName === 'EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH') {
          return options.deployerBootstrapCommitmentHash ?? BOOTSTRAP_TARGETS_HASH;
        }
        if (functionName === 'bootstrapAcquisitionTargetCount') return BigInt(BOOTSTRAP_TARGETS.length);
        if (functionName === 'bootstrapAcquisitionTargetsHash') return BOOTSTRAP_TARGETS_HASH;
        if (functionName === 'PROTOCOL_TIMELOCK') return liveRuntimeFixture.admin.protocolTimelock;
        if (functionName === 'EMERGENCY_GUARDIAN') return liveRuntimeFixture.admin.emergencyGuardian;
        if (functionName === 'GBX') return liveRuntimeFixture.addresses.gbx;
        if (functionName === 'USDG') return options.deployerUSDG ?? liveRuntimeFixture.assets.USDG;
        if (functionName === 'GUM_BALL_VAULT') return liveRuntimeFixture.addresses.gumBallVault;
        if (functionName === 'ALLOCATION_VOTER') return liveRuntimeFixture.addresses.allocationVoter;
        if (functionName === 'ASSET_REGISTRY') return liveRuntimeFixture.addresses.assetRegistry;
        if (functionName === 'ELIGIBILITY_MODULE') return liveRuntimeFixture.addresses.eligibilityModule;
        if (functionName === 'ACQUISITION_STRATEGY_CREATION_CODE_HASH') {
          return keccak256(acquisitionStrategyCreationCode);
        }
        if (functionName === 'ACQUISITION_STRATEGY_CREATION_CODE_LENGTH') {
          return BigInt((acquisitionStrategyCreationCode.length - 2) / 2);
        }
        if (functionName === 'MANAGER_REWARDS_CREATION_CODE_HASH') return keccak256(managerRewardsCreationCode);
        if (functionName === 'MANAGER_REWARDS_CREATION_CODE_LENGTH') {
          return BigInt((managerRewardsCreationCode.length - 2) / 2);
        }
      }
      const strategySymbol = strategyByAddress.get(address.toLowerCase());
      if (strategySymbol !== undefined) {
        if (functionName === 'fillsPaused') return strategySymbol === 'NVDA';
        if (functionName === 'auctionId') return 9n;
        if (functionName === 'auctionStartTime') return strategySymbol === 'WBTC' ? 100_000n : 190_000n;
        if (functionName === 'AUCTION_DURATION') return 86_400n;
        if (functionName === 'referenceRate') return 5n * 10n ** 18n;
        if (functionName === 'startRate') return 6n * 10n ** 18n;
        if (functionName === 'floorRate') return 4n * 10n ** 18n;
      }
      throw new Error(`Unexpected ${functionName} read at ${address}`);
    },
  );
  const getBlock = vi.fn(async (parameters: { blockNumber?: bigint; blockTag?: string }) => ({
    hash: parameters.blockTag === 'latest' ? BLOCK_HASH : (options.confirmationHash ?? BLOCK_HASH),
    number: parameters.blockTag === 'latest' ? BLOCK_NUMBER : (options.confirmationNumber ?? BLOCK_NUMBER),
    timestamp: BLOCK_TIMESTAMP,
  }));
  return {
    client: { getBlock, readContract } as unknown as PublicClient,
    getBlock,
    readContract,
  };
}

describe('one-block admin snapshot', () => {
  it('validates target wiring and derives current strategy and known-operation state exactly', async () => {
    const { client, getBlock, readContract } = clientFor();
    const snapshot = await readLiveAdminSnapshot(client, runtime);

    expect(snapshot.blockNumber).toBe(BLOCK_NUMBER);
    expect(snapshot.guardian.operatorMatchesManifest).toBe(true);
    expect(snapshot.mining).toEqual({
      contributionsPaused: false,
      currentEpochId: 7n,
      currentEpochInvalidated: false,
      currentEpochSettled: false,
    });
    expect(snapshot.blockHash).toBe(BLOCK_HASH);
    expect(snapshot.liquidity).toMatchObject({ activePositionCount: 4n, migrationsPaused: false });
    expect(snapshot.strategyDeployer).toMatchObject({
      address: STRATEGY_DEPLOYER,
      bootstrapAcquisitionTargetCount: BigInt(BOOTSTRAP_TARGETS.length),
      bootstrapAcquisitionTargetsHash: BOOTSTRAP_TARGETS_HASH,
      dependenciesConfigured: true,
      expectedBootstrapAcquisitionTargetCount: BigInt(BOOTSTRAP_TARGETS.length),
      expectedBootstrapAcquisitionTargetsHash: BOOTSTRAP_TARGETS_HASH,
      strategyBootstrapFinalized: true,
      usdG: liveRuntimeFixture.assets.USDG,
    });
    expect(snapshot.strategyRegistry).toHaveLength(9);
    expect(snapshot.timelock).toMatchObject({
      boundedMaintenanceDelay: 172_800n,
      criticalChangeDelay: 604_800n,
      strategyBootstrapFinalized: true,
      strategyDeployer: STRATEGY_DEPLOYER,
    });
    expect(snapshot.strategies).toHaveLength(8);
    expect(snapshot.strategies.find(({ symbol }) => symbol === 'NVDA')).toMatchObject({ fillsPaused: true });
    expect(snapshot.strategies.find(({ symbol }) => symbol === 'WBTC')).toMatchObject({
      currentRate: 4n * 10n ** 18n,
      expired: true,
    });
    expect(snapshot.operations).toHaveLength(10);
    expect(snapshot.operations.find(({ key }) => key === 'unpause-mining')).toMatchObject({ state: 'pending' });
    expect(snapshot.operations.find(({ key }) => key === 'unpause-signals')).toMatchObject({ state: 'matured' });
    expect(getBlock.mock.calls.map(([request]) => request)).toEqual([
      { blockTag: 'latest' },
      { blockNumber: BLOCK_NUMBER },
      { blockNumber: BLOCK_NUMBER },
      { blockNumber: BLOCK_NUMBER },
    ]);
    for (const [request] of readContract.mock.calls) expect(request.blockNumber).toBe(BLOCK_NUMBER);
  });

  it('exposes operator rotation as manifest drift but rejects immutable target drift', async () => {
    const rotated = await readLiveAdminSnapshot(
      clientFor({ guardianOperator: '0x9999999999999999999999999999999999999999' }).client,
      runtime,
    );
    expect(rotated.guardian.operatorMatchesManifest).toBe(false);

    await expect(
      readLiveAdminSnapshot(
        clientFor({ timelockRegistry: '0x9999999999999999999999999999999999999999' }).client,
        runtime,
      ),
    ).rejects.toThrow('ProtocolTimelock registry does not match');
  });

  it('rejects a block-hash change before exposing mixed admin state', async () => {
    await expect(
      readLiveAdminSnapshot(clientFor({ confirmationHash: `0x${'cd'.repeat(32)}` }).client, runtime),
    ).rejects.toThrow('Chain state changed');
  });

  it('rejects StrategyDeployer canonical USDG or bootstrap drift', async () => {
    await expect(
      readLiveAdminSnapshot(clientFor({ deployerUSDG: fixtureAddress(998) }).client, runtime),
    ).rejects.toThrow('StrategyDeployer USDG does not match');
    await expect(
      readLiveAdminSnapshot(clientFor({ deployerBootstrapFinalized: false }).client, runtime),
    ).rejects.toThrow('StrategyDeployer strategy bootstrap');
    await expect(
      readLiveAdminSnapshot(clientFor({ deployerBootstrapCommitmentHash: `0x${'de'.repeat(32)}` }).client, runtime),
    ).rejects.toThrow('bootstrap target commitments');
  });

  it('rejects an RPC response whose confirmation number differs despite the same hash', async () => {
    await expect(
      readLiveAdminSnapshot(clientFor({ confirmationNumber: BLOCK_NUMBER + 1n }).client, runtime),
    ).rejects.toThrow('different block number');
  });
});
