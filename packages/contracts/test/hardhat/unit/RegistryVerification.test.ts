import { expect } from 'chai';
import { Interface, ZeroAddress, id } from 'ethers';
import hre from 'hardhat';

import type { DeploymentAddresses, DeploymentConfig, DeploymentState } from '../../../script/hardhat/deployment';
import {
  ASSET_REGISTRY_STATE_ABI,
  assertObservedRegistryState,
  type ObservedRegistryState,
  type ObservedRegistryStrategyEvidence,
  type RegistryReleaseManifest,
} from '../../../script/hardhat/registry-verification';

const address = (value: number): string => `0x${value.toString(16).padStart(40, '0')}`;
const bytes32 = (value: number): string => `0x${value.toString(16).padStart(64, '0')}`;

function config(): DeploymentConfig {
  return {
    assetReview: null,
    canonicalTokenDependencies: null,
    emergencyGuardianSafe: {
      enabledModules: [],
      fallbackHandler: address(0),
      guard: address(0),
      owners: [address(16), address(17)],
      proxyRuntimeBytecodeHash: bytes32(94),
      safeAddress: address(11),
      singletonAddress: address(18),
      singletonRuntimeBytecodeHash: bytes32(95),
      threshold: '2',
    },
    assets: {
      assetIds: [id('WETH'), id('WRAPPED_BTC')],
      decimals: [18, 8],
      initialReferenceRates: ['1000000000000000000', '1000000000000000000'],
      isStockToken: [false, false],
      runtimeBytecodeHashes: [bytes32(90), bytes32(91)],
      symbolHashes: [id('WETH'), id('WBTC')],
      tokens: [address(30), address(31)],
      uiMultipliers: [null, null],
    },
    eligibility: { mode: 1, module: address(20), registry: address(21) },
    genesis: { bootstrapContributionCap: '2000000', minimumBootstrapUSDG: '1000000' },
    kind: 'gumball-6900-deployment-config',
    liquidity: {
      mode: 'unrestricted-test',
      permissionedDependencies: null,
      allocationBps: [5000, 3000, 1500, 500],
      cumulativeTickDeltas: [60, 120, 180, 240],
      poolFee: 3000,
      tickSpacing: 60,
    },
    network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
    protocol: 'GUM BALL 6900',
    protocolAdminSafe: {
      enabledModules: [],
      fallbackHandler: address(0),
      guard: address(0),
      owners: [address(13), address(14)],
      proxyRuntimeBytecodeHash: bytes32(92),
      safeAddress: address(10),
      singletonAddress: address(15),
      singletonRuntimeBytecodeHash: bytes32(93),
      threshold: '2',
    },
    roles: {
      emergencyGuardianOperator: address(11),
      genesisLiquidityBacker: address(12),
      protocolTimelockMultisig: address(10),
    },
    schemaVersion: 1,
    stockTokenDependency: null,
    wrappedBtcBridgeDependency: null,
    strategies: {
      buybackInitialReferenceRate: '1000000000000000000',
      maximumLotUSDG: '1000000',
      minimumLotUSDG: '1',
    },
    uniswapV4: { permit2: address(4), poolManager: address(2), positionManager: address(3) },
    usdG: address(1),
    usdGDecimals: 6,
  };
}

function addresses(): DeploymentAddresses {
  return {
    acquisitionStrategies: [address(201), address(202)],
    allocationVoter: address(109),
    assetRegistry: address(108),
    buybackBurnStrategy: address(204),
    eligibilityAllowlistChecker: address(205),
    permissionedPoolController: address(206),
    gbxPermissionsAdapter: address(207),
    adapterVerificationEscrow: address(208),
    eligibilityModule: address(103),
    emergencyGuardian: address(102),
    emissionController: address(105),
    gbx: address(104),
    strategyDeployer: address(199),
    genesisBootstrap: address(114),
    genesisClaims: address(106),
    genesisLiquidityCalculator: address(119),
    gumBallRouter: address(112),
    gumBallVault: address(110),
    holdUSDGStrategy: address(200),
    launchGuardHook: address(118),
    lens: address(121),
    liquidityManager: address(120),
    managerRewards: [address(211), address(212)],
    miningClaims: address(107),
    miningPool: address(113),
    protocolTimelock: address(101),
    revenueRouter: address(115),
    stakedGBX: address(111),
  };
}

function state(): DeploymentState {
  return {
    addresses: addresses(),
    chainId: '46630',
    configHash: bytes32(1),
    contracts: [],
    dependencyInitializer: address(99),
    gbxContractHolders: [],
    hookSalt: bytes32(2),
    networkName: 'robinhoodTestnet',
    phase: 'GENESIS_SETTLED',
    schemaVersion: 1,
    timelockOperations: [],
    transactions: {},
    updatedAt: '2026-08-01T00:00:00Z',
  };
}

function manifest(deploymentConfig: DeploymentConfig): RegistryReleaseManifest {
  return {
    assets: [
      {
        acquisitionEnabled: true,
        address: deploymentConfig.usdG,
        decimals: deploymentConfig.usdGDecimals,
        key: 'USDG',
        redemptionEnabled: true,
        registryStatus: 'NOT_APPLICABLE',
        runtimeBytecodeHash: bytes32(300),
        uid: null,
        uiMultiplier: null,
      },
      {
        acquisitionEnabled: true,
        address: deploymentConfig.assets.tokens[0]!,
        decimals: deploymentConfig.assets.decimals[0]!,
        key: 'WETH',
        redemptionEnabled: true,
        registryStatus: 'NOT_APPLICABLE',
        runtimeBytecodeHash: bytes32(301),
        uid: null,
        uiMultiplier: null,
      },
      {
        acquisitionEnabled: true,
        address: deploymentConfig.assets.tokens[1]!,
        decimals: deploymentConfig.assets.decimals[1]!,
        key: 'WRAPPED_BTC',
        redemptionEnabled: true,
        registryStatus: 'NOT_APPLICABLE',
        runtimeBytecodeHash: bytes32(302),
        uid: null,
        uiMultiplier: null,
      },
    ],
  };
}

function acquisitionEvidence(index: number, deploymentConfig: DeploymentConfig, deploymentState: DeploymentState) {
  return {
    bpsDenominator: 10_000n,
    kind: 'acquisition' as const,
    managerRewardBps: 200n,
    managerRewards: deploymentState.addresses.managerRewards[index]!,
    rewardStrategy: deploymentState.addresses.acquisitionStrategies[index]!,
    rewardToken: deploymentConfig.assets.tokens[index]!,
    targetToken: deploymentConfig.assets.tokens[index]!,
    vaultBps: 9_800n,
  };
}

function observation(deploymentConfig: DeploymentConfig, deploymentState: DeploymentState): ObservedRegistryState {
  const a = deploymentState.addresses;
  return {
    assets: [
      {
        acquisitionEnabled: true,
        assetId: id('USDG'),
        decimals: deploymentConfig.usdGDecimals,
        isRegistered: true,
        isStockToken: false,
        redemptionEnabled: true,
        rewards: ZeroAddress,
        strategy: a.holdUSDGStrategy,
        stockTokenDependency: null,
        symbolHash: id('USDG'),
        token: deploymentConfig.usdG,
      },
      ...deploymentConfig.assets.tokens.map((token, index) => ({
        acquisitionEnabled: true,
        assetId: deploymentConfig.assets.assetIds[index]!,
        decimals: deploymentConfig.assets.decimals[index]!,
        isRegistered: true,
        isStockToken: deploymentConfig.assets.isStockToken[index]!,
        redemptionEnabled: true,
        rewards: a.managerRewards[index]!,
        strategy: a.acquisitionStrategies[index]!,
        stockTokenDependency: null,
        symbolHash: deploymentConfig.assets.symbolHashes[index]!,
        token,
      })),
    ],
    emergencyGuardian: a.emergencyGuardian,
    protocolTimelock: a.protocolTimelock,
    strategies: [
      {
        evidence: { kind: 'hold-usdg', strategyId: id('HOLD_USDG') },
        isLive: true,
        strategy: a.holdUSDGStrategy,
        token: deploymentConfig.usdG,
      },
      ...deploymentConfig.assets.tokens.map((token, index) => ({
        evidence: acquisitionEvidence(index, deploymentConfig, deploymentState),
        isLive: true,
        strategy: a.acquisitionStrategies[index]!,
        token,
      })),
      {
        evidence: { bpsDenominator: 10_000n, gbx: a.gbx, kind: 'buyback-burn' },
        isLive: true,
        strategy: a.buybackBurnStrategy,
        token: ZeroAddress,
      },
    ],
    usdG: deploymentConfig.usdG,
    vault: a.gumBallVault,
  };
}

function asAcquisition(
  evidence: ObservedRegistryStrategyEvidence,
): Extract<ObservedRegistryStrategyEvidence, { kind: 'acquisition' }> {
  if (evidence.kind !== 'acquisition') throw new Error('test fixture is not acquisition evidence');
  return evidence;
}

describe('Release registry state verification', function () {
  it('uses the complete getters and exact configFor tuple from the compiled AssetRegistry ABI', async function () {
    const verifierInterface = new Interface(ASSET_REGISTRY_STATE_ABI);
    const artifactInterface = new Interface((await hre.artifacts.readArtifact('AssetRegistry')).abi);
    for (const name of [
      'USDG',
      'PROTOCOL_TIMELOCK',
      'EMERGENCY_GUARDIAN',
      'vault',
      'assetCount',
      'assetAt',
      'configFor',
      'stockTokenDependencyFor',
      'isRegisteredAsset',
      'strategyCount',
      'strategyAt',
      'tokenForStrategy',
      'isLiveStrategy',
    ]) {
      expect(verifierInterface.getFunction(name)?.selector).to.equal(artifactInterface.getFunction(name)?.selector);
    }
    const verifierOutput = verifierInterface.getFunction('configFor')?.outputs[0]?.format('full');
    const artifactOutput = artifactInterface.getFunction('configFor')?.outputs[0]?.format('full');
    expect(verifierOutput).to.equal(artifactOutput);
  });

  it('accepts the exact ordered, active launch registry graph', function () {
    const deploymentConfig = config();
    const deploymentState = state();
    expect(() =>
      assertObservedRegistryState(
        observation(deploymentConfig, deploymentState),
        deploymentConfig,
        deploymentState,
        manifest(deploymentConfig),
      ),
    ).not.to.throw();
  });

  it('rejects metadata, order, status, mapping, type, and immutable reward-split drift', function () {
    const mutations: Array<[string, (actual: ObservedRegistryState) => void, string]> = [
      [
        'asset order',
        (actual) => ([actual.assets[1], actual.assets[2]] = [actual.assets[2]!, actual.assets[1]!]),
        'token/order',
      ],
      ['asset ID', (actual) => (actual.assets[1]!.assetId = bytes32(999)), 'asset ID'],
      ['symbol hash', (actual) => (actual.assets[1]!.symbolHash = bytes32(999)), 'symbol hash'],
      ['decimals', (actual) => (actual.assets[1]!.decimals = 6), 'decimals mismatch'],
      ['acquisition status', (actual) => (actual.assets[1]!.acquisitionEnabled = false), 'acquisition status'],
      ['redemption status', (actual) => (actual.assets[1]!.redemptionEnabled = false), 'redemption status'],
      [
        'strategy order',
        (actual) => ([actual.strategies[1], actual.strategies[2]] = [actual.strategies[2]!, actual.strategies[1]!]),
        'address/order',
      ],
      ['disabled acquisition', (actual) => (actual.strategies[1]!.isLive = false), 'is disabled'],
      ['disabled buyback', (actual) => (actual.strategies[3]!.isLive = false), 'is disabled'],
      ['token mapping', (actual) => (actual.strategies[1]!.token = ZeroAddress), 'token mapping'],
      [
        'manager reward bps',
        (actual) => (asAcquisition(actual.strategies[1]!.evidence).managerRewardBps = 201n),
        '98/2 reward split',
      ],
      [
        'manager rewards mapping',
        (actual) => (asAcquisition(actual.strategies[1]!.evidence).managerRewards = address(999)),
        'rewards',
      ],
      [
        'reward token mapping',
        (actual) => (asAcquisition(actual.strategies[1]!.evidence).rewardToken = address(999)),
        'reward token',
      ],
      [
        'hold type',
        (actual) => {
          actual.strategies[0]!.evidence = { kind: 'hold-usdg', strategyId: bytes32(999) };
        },
        'hold-USDG strategy type',
      ],
      [
        'buyback type',
        (actual) => {
          actual.strategies[3]!.evidence = { bpsDenominator: 10_000n, gbx: address(999), kind: 'buyback-burn' };
        },
        'buyback strategy GBX',
      ],
    ];

    for (const [label, mutate, message] of mutations) {
      const deploymentConfig = config();
      const deploymentState = state();
      const actual = observation(deploymentConfig, deploymentState);
      mutate(actual);
      expect(
        () => assertObservedRegistryState(actual, deploymentConfig, deploymentState, manifest(deploymentConfig)),
        label,
      ).to.throw(message);
    }
  });

  it('rejects a signed manifest that marks any launch asset disabled', function () {
    const deploymentConfig = config();
    const deploymentState = state();
    const releaseManifest = manifest(deploymentConfig);
    releaseManifest.assets[0]!.acquisitionEnabled = false;
    expect(() =>
      assertObservedRegistryState(
        observation(deploymentConfig, deploymentState),
        deploymentConfig,
        deploymentState,
        releaseManifest,
      ),
    ).to.throw('signed USDG registry status is not launch-active');
  });

  it('binds the stored registration-time stock beacon dependency to the signed config', function () {
    const deploymentConfig = config();
    deploymentConfig.assets.isStockToken[0] = true;
    deploymentConfig.assets.uiMultipliers[0] = '1000000000000000000';
    deploymentConfig.stockTokenDependency = {
      beaconAddress: address(401),
      beaconRuntimeBytecodeHash: bytes32(402),
      implementationAddress: address(403),
      implementationRuntimeBytecodeHash: bytes32(404),
    };
    const deploymentState = state();
    const actual = observation(deploymentConfig, deploymentState);
    actual.assets[1]!.stockTokenDependency = {
      beacon: deploymentConfig.stockTokenDependency.beaconAddress,
      beaconRuntimeCodeHash: deploymentConfig.stockTokenDependency.beaconRuntimeBytecodeHash,
      implementation: deploymentConfig.stockTokenDependency.implementationAddress,
      implementationRuntimeCodeHash: deploymentConfig.stockTokenDependency.implementationRuntimeBytecodeHash,
      tokenRuntimeCodeHash: deploymentConfig.assets.runtimeBytecodeHashes[0]!,
      uiMultiplier: 1_000_000_000_000_000_000n,
    };
    expect(() =>
      assertObservedRegistryState(actual, deploymentConfig, deploymentState, manifest(deploymentConfig)),
    ).not.to.throw();

    actual.assets[1]!.stockTokenDependency!.implementation = address(999);
    expect(() =>
      assertObservedRegistryState(actual, deploymentConfig, deploymentState, manifest(deploymentConfig)),
    ).to.throw('implementation');
  });
});
