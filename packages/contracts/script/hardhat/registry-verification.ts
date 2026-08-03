import { Contract, getAddress, id, ZeroAddress } from 'ethers';
import type { Provider } from 'ethers';

import type { DeploymentConfig, DeploymentState } from './deployment';
import type { ReleaseAssetRecord } from './release-manifest-binding';

export const ASSET_REGISTRY_STATE_ABI = [
  'function USDG() view returns (address)',
  'function PROTOCOL_TIMELOCK() view returns (address)',
  'function EMERGENCY_GUARDIAN() view returns (address)',
  'function vault() view returns (address)',
  'function assetCount() view returns (uint256)',
  'function assetAt(uint256 index) view returns (address)',
  'function configFor(address token) view returns (tuple(address token,bytes32 assetId,bytes32 symbolHash,uint8 decimals,address strategy,address rewards,bool isStockToken,bool acquisitionEnabled,bool redemptionEnabled))',
  'function stockTokenDependencyFor(address token) view returns (tuple(bytes32 tokenRuntimeCodeHash,address beacon,bytes32 beaconRuntimeCodeHash,address implementation,bytes32 implementationRuntimeCodeHash,uint256 uiMultiplier))',
  'function isRegisteredAsset(address token) view returns (bool)',
  'function strategyCount() view returns (uint256)',
  'function strategyAt(uint256 index) view returns (address)',
  'function tokenForStrategy(address strategy) view returns (address)',
  'function isLiveStrategy(address strategy) view returns (bool)',
] as const;

const HOLD_USDG_STATE_ABI = ['function strategyId() view returns (bytes32)'] as const;

const ACQUISITION_STATE_ABI = [
  'function BPS_DENOMINATOR() view returns (uint256)',
  'function VAULT_BPS() view returns (uint256)',
  'function MANAGER_REWARD_BPS() view returns (uint256)',
  'function TARGET_TOKEN() view returns (address)',
  'function managerRewards() view returns (address)',
] as const;

const MANAGER_REWARDS_STATE_ABI = [
  'function REWARD_TOKEN() view returns (address)',
  'function STRATEGY() view returns (address)',
] as const;

const BUYBACK_STATE_ABI = [
  'function BPS_DENOMINATOR() view returns (uint256)',
  'function GBX() view returns (address)',
] as const;

export interface ObservedRegistryAsset {
  acquisitionEnabled: boolean;
  assetId: string;
  decimals: number;
  isRegistered: boolean;
  isStockToken: boolean;
  redemptionEnabled: boolean;
  rewards: string;
  strategy: string;
  stockTokenDependency: ObservedStockTokenDependency | null;
  symbolHash: string;
  token: string;
}

export interface ObservedStockTokenDependency {
  beacon: string;
  beaconRuntimeCodeHash: string;
  implementation: string;
  implementationRuntimeCodeHash: string;
  tokenRuntimeCodeHash: string;
  uiMultiplier: bigint;
}

export type ObservedRegistryStrategyEvidence =
  | { kind: 'hold-usdg'; strategyId: string }
  | {
      bpsDenominator: bigint;
      kind: 'acquisition';
      managerRewardBps: bigint;
      managerRewards: string;
      rewardStrategy: string;
      rewardToken: string;
      targetToken: string;
      vaultBps: bigint;
    }
  | { bpsDenominator: bigint; gbx: string; kind: 'buyback-burn' };

export interface ObservedRegistryStrategy {
  evidence: ObservedRegistryStrategyEvidence;
  isLive: boolean;
  strategy: string;
  token: string;
}

export interface ObservedRegistryState {
  assets: ObservedRegistryAsset[];
  emergencyGuardian: string;
  protocolTimelock: string;
  strategies: ObservedRegistryStrategy[];
  usdG: string;
  vault: string;
}

export type RegistryReleaseManifest = {
  assets: Array<
    Partial<ReleaseAssetRecord> & Pick<ReleaseAssetRecord, 'acquisitionEnabled' | 'address' | 'redemptionEnabled'>
  >;
};

interface AssetConfigResult {
  acquisitionEnabled: boolean;
  assetId: string;
  decimals: bigint;
  isStockToken: boolean;
  redemptionEnabled: boolean;
  rewards: string;
  strategy: string;
  symbolHash: string;
  token: string;
}

interface StockTokenDependencyResult {
  beacon: string;
  beaconRuntimeCodeHash: string;
  implementation: string;
  implementationRuntimeCodeHash: string;
  tokenRuntimeCodeHash: string;
  uiMultiplier: bigint;
}

function equalAddress(actual: string, expected: string, label: string): void {
  if (getAddress(actual) !== getAddress(expected)) throw new Error(`${label}: ${actual} != ${expected}`);
}

function equalBytes32(actual: string, expected: string, label: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${label}: ${actual} != ${expected}`);
}

function manifestAssetFor(
  manifest: RegistryReleaseManifest,
  address: string,
  label: string,
): RegistryReleaseManifest['assets'][number] {
  const matches = manifest.assets.filter((asset) => getAddress(asset.address) === getAddress(address));
  if (matches.length !== 1) throw new Error(`${label} must have exactly one signed manifest asset record`);
  return matches[0]!;
}

function assertAsset(
  actual: ObservedRegistryAsset,
  expected: {
    acquisitionEnabled: boolean;
    assetId: string;
    decimals: number;
    isStockToken: boolean;
    redemptionEnabled: boolean;
    rewards: string;
    strategy: string;
    symbolHash: string;
    token: string;
  },
  index: number,
): void {
  const label = `registry asset ${index}`;
  equalAddress(actual.token, expected.token, `${label} token/order`);
  if (!actual.isRegistered) throw new Error(`${label} is not registered`);
  equalBytes32(actual.assetId, expected.assetId, `${label} asset ID`);
  equalBytes32(actual.symbolHash, expected.symbolHash, `${label} symbol hash`);
  if (actual.decimals !== expected.decimals) throw new Error(`${label} decimals mismatch`);
  equalAddress(actual.strategy, expected.strategy, `${label} strategy`);
  equalAddress(actual.rewards, expected.rewards, `${label} rewards`);
  if (actual.isStockToken !== expected.isStockToken) throw new Error(`${label} stock-token flag mismatch`);
  if (actual.acquisitionEnabled !== expected.acquisitionEnabled) {
    throw new Error(`${label} acquisition status differs from the signed launch state`);
  }
  if (actual.redemptionEnabled !== expected.redemptionEnabled) {
    throw new Error(`${label} redemption status differs from the signed launch state`);
  }
}

function assertStrategyBase(
  actual: ObservedRegistryStrategy,
  expectedStrategy: string,
  expectedToken: string,
  index: number,
): void {
  const label = `registry strategy ${index}`;
  equalAddress(actual.strategy, expectedStrategy, `${label} address/order`);
  equalAddress(actual.token, expectedToken, `${label} token mapping`);
  if (!actual.isLive) throw new Error(`${label} is disabled`);
}

/**
 * Compares one observation-block registry snapshot with the exact signed launch graph.
 * The signed manifest is intentionally required even though release binding also constrains it:
 * this makes mutable acquisition/redemption state part of online authorization evidence.
 */
export function assertObservedRegistryState(
  actual: ObservedRegistryState,
  config: DeploymentConfig,
  state: DeploymentState,
  manifest: RegistryReleaseManifest,
): void {
  const addresses = state.addresses;
  equalAddress(actual.usdG, config.usdG, 'registry USDG');
  equalAddress(actual.protocolTimelock, addresses.protocolTimelock, 'registry protocol timelock');
  equalAddress(actual.emergencyGuardian, addresses.emergencyGuardian, 'registry emergency guardian');
  equalAddress(actual.vault, addresses.gumBallVault, 'registry vault');

  const expectedAssetCount = config.assets.tokens.length + 1;
  if (actual.assets.length !== expectedAssetCount) {
    throw new Error(`registry asset count ${actual.assets.length} is not canonical ${expectedAssetCount}`);
  }
  if (manifest.assets.length !== expectedAssetCount) {
    throw new Error('signed manifest asset count is not canonical');
  }

  const usdGManifest = manifestAssetFor(manifest, config.usdG, 'USDG');
  if (!usdGManifest.acquisitionEnabled || !usdGManifest.redemptionEnabled) {
    throw new Error('signed USDG registry status is not launch-active');
  }
  assertAsset(
    actual.assets[0]!,
    {
      acquisitionEnabled: usdGManifest.acquisitionEnabled,
      assetId: id('USDG'),
      decimals: config.usdGDecimals,
      isStockToken: false,
      redemptionEnabled: usdGManifest.redemptionEnabled,
      rewards: ZeroAddress,
      strategy: addresses.holdUSDGStrategy,
      symbolHash: id('USDG'),
      token: config.usdG,
    },
    0,
  );

  for (let targetIndex = 0; targetIndex < config.assets.tokens.length; targetIndex += 1) {
    const token = config.assets.tokens[targetIndex]!;
    const manifestAsset = manifestAssetFor(manifest, token, `target asset ${targetIndex}`);
    if (!manifestAsset.acquisitionEnabled || !manifestAsset.redemptionEnabled) {
      throw new Error(`signed target asset ${targetIndex} registry status is not launch-active`);
    }
    assertAsset(
      actual.assets[targetIndex + 1]!,
      {
        acquisitionEnabled: manifestAsset.acquisitionEnabled,
        assetId: config.assets.assetIds[targetIndex]!,
        decimals: config.assets.decimals[targetIndex]!,
        isStockToken: config.assets.isStockToken[targetIndex]!,
        redemptionEnabled: manifestAsset.redemptionEnabled,
        rewards: addresses.managerRewards[targetIndex]!,
        strategy: addresses.acquisitionStrategies[targetIndex]!,
        symbolHash: config.assets.symbolHashes[targetIndex]!,
        token,
      },
      targetIndex + 1,
    );
    const actualDependency = actual.assets[targetIndex + 1]!.stockTokenDependency;
    if (config.assets.isStockToken[targetIndex]) {
      const expectedDependency = config.stockTokenDependency;
      if (expectedDependency === null || actualDependency === null) {
        throw new Error(`registry stock-token dependency ${targetIndex} is absent`);
      }
      equalBytes32(
        actualDependency.tokenRuntimeCodeHash,
        config.assets.runtimeBytecodeHashes[targetIndex]!,
        `registry stock-token dependency ${targetIndex} token runtime bytecode`,
      );
      equalAddress(
        actualDependency.beacon,
        expectedDependency.beaconAddress,
        `registry stock-token dependency ${targetIndex} beacon`,
      );
      equalBytes32(
        actualDependency.beaconRuntimeCodeHash,
        expectedDependency.beaconRuntimeBytecodeHash,
        `registry stock-token dependency ${targetIndex} beacon runtime bytecode`,
      );
      equalAddress(
        actualDependency.implementation,
        expectedDependency.implementationAddress,
        `registry stock-token dependency ${targetIndex} implementation`,
      );
      equalBytes32(
        actualDependency.implementationRuntimeCodeHash,
        expectedDependency.implementationRuntimeBytecodeHash,
        `registry stock-token dependency ${targetIndex} implementation runtime bytecode`,
      );
      if (actualDependency.uiMultiplier !== BigInt(config.assets.uiMultipliers[targetIndex]!)) {
        throw new Error(`registry stock-token dependency ${targetIndex} UI multiplier mismatch`);
      }
    } else if (actualDependency !== null) {
      throw new Error(`registry non-stock asset ${targetIndex} has stock-token dependency evidence`);
    }
  }

  const expectedStrategyCount = config.assets.tokens.length + 2;
  if (actual.strategies.length !== expectedStrategyCount) {
    throw new Error(`registry strategy count ${actual.strategies.length} is not canonical ${expectedStrategyCount}`);
  }

  const hold = actual.strategies[0]!;
  assertStrategyBase(hold, addresses.holdUSDGStrategy, config.usdG, 0);
  if (hold.evidence.kind !== 'hold-usdg' || hold.evidence.strategyId !== id('HOLD_USDG')) {
    throw new Error('registry strategy 0 is not the canonical hold-USDG strategy type');
  }

  for (let targetIndex = 0; targetIndex < config.assets.tokens.length; targetIndex += 1) {
    const strategyIndex = targetIndex + 1;
    const strategy = actual.strategies[strategyIndex]!;
    const expectedStrategy = addresses.acquisitionStrategies[targetIndex]!;
    const expectedToken = config.assets.tokens[targetIndex]!;
    const expectedRewards = addresses.managerRewards[targetIndex]!;
    assertStrategyBase(strategy, expectedStrategy, expectedToken, strategyIndex);
    if (strategy.evidence.kind !== 'acquisition') {
      throw new Error(`registry strategy ${strategyIndex} is not an acquisition strategy type`);
    }
    if (
      strategy.evidence.bpsDenominator !== 10_000n ||
      strategy.evidence.vaultBps !== 9_800n ||
      strategy.evidence.managerRewardBps !== 200n
    ) {
      throw new Error(`registry strategy ${strategyIndex} does not enforce the immutable 98/2 reward split`);
    }
    equalAddress(strategy.evidence.targetToken, expectedToken, `registry strategy ${strategyIndex} target token`);
    equalAddress(strategy.evidence.managerRewards, expectedRewards, `registry strategy ${strategyIndex} rewards`);
    equalAddress(strategy.evidence.rewardToken, expectedToken, `registry strategy ${strategyIndex} reward token`);
    equalAddress(
      strategy.evidence.rewardStrategy,
      expectedStrategy,
      `registry strategy ${strategyIndex} reward strategy`,
    );
  }

  const buybackIndex = expectedStrategyCount - 1;
  const buyback = actual.strategies[buybackIndex]!;
  assertStrategyBase(buyback, addresses.buybackBurnStrategy, ZeroAddress, buybackIndex);
  if (buyback.evidence.kind !== 'buyback-burn') {
    throw new Error(`registry strategy ${buybackIndex} is not the buyback-burn strategy type`);
  }
  if (buyback.evidence.bpsDenominator !== 10_000n) {
    throw new Error('buyback strategy basis-point denominator mismatch');
  }
  equalAddress(buyback.evidence.gbx, addresses.gbx, 'buyback strategy GBX');
}

/**
 * The execute phase always enables acquisition and redemption for every configured launch asset.
 * This wrapper lets the production runner prove that exact graph before a release manifest exists.
 */
export function assertObservedExecutedRegistryState(
  actual: ObservedRegistryState,
  config: DeploymentConfig,
  state: DeploymentState,
): void {
  assertObservedRegistryState(actual, config, state, {
    assets: [config.usdG, ...config.assets.tokens].map((address) => ({
      acquisitionEnabled: true,
      address,
      redemptionEnabled: true,
    })),
  });
}

/** Reads the complete launch-critical registry graph using the caller's provider/block pin. */
export async function observeRegistryState(
  provider: Provider,
  config: DeploymentConfig,
  state: DeploymentState,
  blockTag?: number,
): Promise<ObservedRegistryState> {
  const callOverrides = blockTag === undefined ? {} : { blockTag };
  const registry = new Contract(state.addresses.assetRegistry, ASSET_REGISTRY_STATE_ABI, provider);
  const assetCount = Number((await registry.getFunction('assetCount')(callOverrides)) as bigint);
  const assets: ObservedRegistryAsset[] = [];
  for (let index = 0; index < assetCount; index += 1) {
    const token = (await registry.getFunction('assetAt')(index, callOverrides)) as string;
    const asset = (await registry.getFunction('configFor')(token, callOverrides)) as AssetConfigResult;
    const dependency = asset.isStockToken
      ? ((await registry.getFunction('stockTokenDependencyFor')(token, callOverrides)) as StockTokenDependencyResult)
      : null;
    assets.push({
      acquisitionEnabled: asset.acquisitionEnabled,
      assetId: asset.assetId,
      decimals: Number(asset.decimals),
      isRegistered: (await registry.getFunction('isRegisteredAsset')(token, callOverrides)) as boolean,
      isStockToken: asset.isStockToken,
      redemptionEnabled: asset.redemptionEnabled,
      rewards: asset.rewards,
      strategy: asset.strategy,
      stockTokenDependency:
        dependency === null
          ? null
          : {
              beacon: dependency.beacon,
              beaconRuntimeCodeHash: dependency.beaconRuntimeCodeHash,
              implementation: dependency.implementation,
              implementationRuntimeCodeHash: dependency.implementationRuntimeCodeHash,
              tokenRuntimeCodeHash: dependency.tokenRuntimeCodeHash,
              uiMultiplier: dependency.uiMultiplier,
            },
      symbolHash: asset.symbolHash,
      token: asset.token,
    });
  }

  const strategyCount = Number((await registry.getFunction('strategyCount')(callOverrides)) as bigint);
  const strategies: ObservedRegistryStrategy[] = [];
  for (let index = 0; index < strategyCount; index += 1) {
    const strategy = (await registry.getFunction('strategyAt')(index, callOverrides)) as string;
    const token = (await registry.getFunction('tokenForStrategy')(strategy, callOverrides)) as string;
    const isLive = (await registry.getFunction('isLiveStrategy')(strategy, callOverrides)) as boolean;
    let evidence: ObservedRegistryStrategyEvidence;
    if (index === 0) {
      const hold = new Contract(strategy, HOLD_USDG_STATE_ABI, provider);
      evidence = {
        kind: 'hold-usdg',
        strategyId: (await hold.getFunction('strategyId')(callOverrides)) as string,
      };
    } else if (index <= config.assets.tokens.length) {
      const acquisition = new Contract(strategy, ACQUISITION_STATE_ABI, provider);
      const managerRewards = (await acquisition.getFunction('managerRewards')(callOverrides)) as string;
      const rewards = new Contract(managerRewards, MANAGER_REWARDS_STATE_ABI, provider);
      evidence = {
        bpsDenominator: (await acquisition.getFunction('BPS_DENOMINATOR')(callOverrides)) as bigint,
        kind: 'acquisition',
        managerRewardBps: (await acquisition.getFunction('MANAGER_REWARD_BPS')(callOverrides)) as bigint,
        managerRewards,
        rewardStrategy: (await rewards.getFunction('STRATEGY')(callOverrides)) as string,
        rewardToken: (await rewards.getFunction('REWARD_TOKEN')(callOverrides)) as string,
        targetToken: (await acquisition.getFunction('TARGET_TOKEN')(callOverrides)) as string,
        vaultBps: (await acquisition.getFunction('VAULT_BPS')(callOverrides)) as bigint,
      };
    } else {
      const buyback = new Contract(strategy, BUYBACK_STATE_ABI, provider);
      evidence = {
        bpsDenominator: (await buyback.getFunction('BPS_DENOMINATOR')(callOverrides)) as bigint,
        gbx: (await buyback.getFunction('GBX')(callOverrides)) as string,
        kind: 'buyback-burn',
      };
    }
    strategies.push({ evidence, isLive, strategy, token });
  }

  return {
    assets,
    emergencyGuardian: (await registry.getFunction('EMERGENCY_GUARDIAN')(callOverrides)) as string,
    protocolTimelock: (await registry.getFunction('PROTOCOL_TIMELOCK')(callOverrides)) as string,
    strategies,
    usdG: (await registry.getFunction('USDG')(callOverrides)) as string,
    vault: (await registry.getFunction('vault')(callOverrides)) as string,
  };
}

export async function verifyRegistryState(
  provider: Provider,
  state: DeploymentState,
  config: DeploymentConfig,
  manifest: RegistryReleaseManifest,
): Promise<void> {
  const observation = await observeRegistryState(provider, config, state);
  assertObservedRegistryState(observation, config, state, manifest);
  if (config.assets.isStockToken.some((isStockToken) => isStockToken)) {
    if (config.stockTokenDependency === null) throw new Error('stock-token control-plane dependency is absent');
    const beacon = new Contract(
      config.stockTokenDependency.beaconAddress,
      ['function isBlocked(address account) view returns (bool)', 'function paused() view returns (bool)'],
      provider,
    );
    if ((await beacon.getFunction('paused')()) as boolean) {
      throw new Error('stock-token beacon is paused');
    }
    for (let index = 0; index < config.assets.tokens.length; index += 1) {
      if (!config.assets.isStockToken[index]) continue;
      const accounts = [
        state.addresses.gumBallVault,
        state.addresses.acquisitionStrategies[index]!,
        state.addresses.managerRewards[index]!,
      ];
      for (const account of accounts) {
        if ((await beacon.getFunction('isBlocked')(account)) as boolean) {
          throw new Error(`stock-token issuer blocks protocol transfer account ${account}`);
        }
      }
    }
  }
}
