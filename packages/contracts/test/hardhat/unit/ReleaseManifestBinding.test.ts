import { createHash } from 'node:crypto';

import { expect } from 'chai';
import { ZeroAddress, id } from 'ethers';

import { requiredGBXContractHolders } from '../../../script/hardhat/deployment';
import type {
  ContractRecord,
  DeploymentAddresses,
  DeploymentConfig,
  DeploymentState,
} from '../../../script/hardhat/deployment';
import {
  assertReleaseManifestMatchesSnapshots,
  type PermissionedPoolReleaseEvidenceBytes,
  type ReleaseManifest,
} from '../../../script/hardhat/release-manifest-binding';
import type { SafeControlPlaneEvidence } from '../../../script/hardhat/safe-control-plane';

const address = (value: number): string => `0x${value.toString(16).padStart(40, '0')}`;
const bytes32 = (value: number): string => `0x${value.toString(16).padStart(64, '0')}`;
const sha256 = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

type MutableSafeControlPlaneEvidence = {
  -readonly [Key in keyof SafeControlPlaneEvidence]: Key extends 'block'
    ? { -readonly [BlockKey in keyof SafeControlPlaneEvidence['block']]: SafeControlPlaneEvidence['block'][BlockKey] }
    : Key extends 'enabledModules' | 'owners'
      ? string[]
      : SafeControlPlaneEvidence[Key];
};

function mutableSafeControlPlane(evidence: SafeControlPlaneEvidence): MutableSafeControlPlaneEvidence {
  return evidence as unknown as MutableSafeControlPlaneEvidence;
}

function wrappedBtcBridgeDependency(
  tokenAddress: string,
  tokenRuntimeBytecodeHash: string,
): NonNullable<DeploymentConfig['wrappedBtcBridgeDependency']> {
  const proxyAdmin = address(540);
  return {
    gateway: {
      address: address(541),
      implementationAddress: address(542),
      implementationRuntimeBytecodeHash: bytes32(3542),
      kind: 'eip1967-transparent',
      proxyAdminAddress: proxyAdmin,
      runtimeBytecodeHash: bytes32(3541),
    },
    gatewayRouter: {
      address: address(543),
      implementationAddress: address(544),
      implementationRuntimeBytecodeHash: bytes32(3544),
      kind: 'eip1967-transparent',
      proxyAdminAddress: proxyAdmin,
      runtimeBytecodeHash: bytes32(3543),
    },
    l1Token: address(545),
    sharedProxyAdmin: {
      address: proxyAdmin,
      owner: {
        address: address(546),
        adminRole: '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
        executorRole: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63',
        proxy: {
          implementationAddress: address(547),
          implementationRuntimeBytecodeHash: bytes32(3547),
          kind: 'eip1967-transparent',
          proxyAdminAddress: proxyAdmin,
        },
        runtimeBytecodeHash: bytes32(3546),
      },
      runtimeBytecodeHash: bytes32(3540),
    },
    token: {
      address: tokenAddress,
      beaconAddress: address(548),
      beaconRuntimeBytecodeHash: bytes32(3548),
      implementationAddress: address(549),
      implementationRuntimeBytecodeHash: bytes32(3549),
      kind: 'eip1967-beacon',
      runtimeBytecodeHash: tokenRuntimeBytecodeHash,
    },
  };
}

function wrappedBtcManifestEvidence(
  dependency: NonNullable<DeploymentConfig['wrappedBtcBridgeDependency']>,
): NonNullable<ReleaseManifest['assets'][number]['proxyEvidence']> {
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
    verifiedAtBlock: '1000',
  };
}

function fixture(): {
  assetCandidateBytes: Buffer;
  config: DeploymentConfig;
  configBytes: Buffer;
  manifest: ReleaseManifest;
  state: DeploymentState;
  stateBytes: Buffer;
} {
  const assetCandidateBytes = Buffer.from('{"reviewed":true}\n');
  const usdGImplementation = address(501);
  const usdGUpgradeAuthority = address(502);
  const wethImplementation = address(503);
  const wethAdmin = address(504);
  const wethAdminOwner = address(505);
  const wethAdminOwnerImplementation = address(506);
  const config: DeploymentConfig = {
    assetReview: {
      path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json',
      rawSha256: sha256(assetCandidateBytes),
    },
    assets: {
      assetIds: [bytes32(30), bytes32(31)],
      decimals: [18, 8],
      initialReferenceRates: ['1000000000000000000', '1000000000000000000'],
      isStockToken: [false, false],
      runtimeBytecodeHashes: [bytes32(3030), bytes32(3031)],
      symbolHashes: [id('WETH'), id('WBTC')],
      tokens: [address(30), address(31)],
      uiMultipliers: [null, null],
    },
    canonicalTokenDependencies: {
      usdG: {
        address: address(1),
        proxyEvidence: {
          adminSlotValue: bytes32(0),
          implementationAddress: usdGImplementation,
          implementationRuntimeBytecodeHash: bytes32(3501),
          kind: 'eip1967-uups',
          upgradeAuthorityAddress: usdGUpgradeAuthority,
          upgradeAuthorityRuntimeBytecodeHash: bytes32(3502),
        },
        runtimeBytecodeHash: bytes32(3001),
      },
      weth: {
        address: address(30),
        proxyEvidence: {
          adminAddress: wethAdmin,
          adminOwnerAddress: wethAdminOwner,
          adminOwnerProxyEvidence: {
            adminSlotValue: bytes32(0),
            implementationAddress: wethAdminOwnerImplementation,
            implementationRuntimeBytecodeHash: bytes32(3506),
          },
          adminOwnerRuntimeBytecodeHash: bytes32(3505),
          adminRuntimeBytecodeHash: bytes32(3504),
          adminSlotValue: `0x${'00'.repeat(12)}${wethAdmin.slice(2)}`,
          implementationAddress: wethImplementation,
          implementationRuntimeBytecodeHash: bytes32(3503),
          kind: 'eip1967-transparent',
          proxyAdminInterface: 'oz-v4',
        },
        runtimeBytecodeHash: bytes32(3030),
      },
    },
    emergencyGuardianSafe: {
      enabledModules: [],
      fallbackHandler: ZeroAddress,
      guard: ZeroAddress,
      owners: [address(520), address(521)],
      proxyRuntimeBytecodeHash: bytes32(3520),
      safeAddress: address(11),
      singletonAddress: address(522),
      singletonRuntimeBytecodeHash: bytes32(3522),
      threshold: '2',
    },
    eligibility: { mode: 1, module: address(0), registry: address(20) },
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
    network: { chainId: 4_663, name: 'Robinhood Chain' },
    protocol: 'GUM BALL 6900',
    protocolAdminSafe: {
      enabledModules: [],
      fallbackHandler: ZeroAddress,
      guard: ZeroAddress,
      owners: [address(510), address(511)],
      proxyRuntimeBytecodeHash: bytes32(3510),
      safeAddress: address(10),
      singletonAddress: address(512),
      singletonRuntimeBytecodeHash: bytes32(3512),
      threshold: '2',
    },
    roles: {
      emergencyGuardianOperator: address(11),
      genesisLiquidityBacker: address(12),
      protocolTimelockMultisig: address(10),
    },
    schemaVersion: 1,
    stockTokenDependency: null,
    wrappedBtcBridgeDependency: wrappedBtcBridgeDependency(address(31), bytes32(3031)),
    strategies: {
      buybackInitialReferenceRate: '1000000000000000000',
      maximumLotUSDG: '1000000',
      minimumLotUSDG: '1',
    },
    uniswapV4: { permit2: address(4), poolManager: address(2), positionManager: address(3) },
    usdG: address(1),
    usdGDecimals: 6,
  };
  const addresses: DeploymentAddresses = {
    acquisitionStrategies: [address(122), address(124)],
    allocationVoter: address(109),
    assetRegistry: address(108),
    buybackBurnStrategy: address(117),
    eligibilityAllowlistChecker: address(126),
    permissionedPoolController: address(127),
    gbxPermissionsAdapter: address(128),
    adapterVerificationEscrow: address(129),
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
    holdUSDGStrategy: address(116),
    launchGuardHook: address(118),
    lens: address(121),
    liquidityManager: address(120),
    managerRewards: [address(123), address(125)],
    miningClaims: address(107),
    miningPool: address(113),
    protocolTimelock: address(101),
    revenueRouter: address(115),
    stakedGBX: address(111),
  };
  const logical: Array<[string, string, string]> = [
    ['ProtocolTimelock', addresses.protocolTimelock, 'ProtocolTimelock'],
    ['EmergencyGuardian', addresses.emergencyGuardian, 'EmergencyGuardian'],
    ['EligibilityModule', addresses.eligibilityModule, 'RegistryEligibilityModule'],
    ['GBXToken', addresses.gbx, 'GBXToken'],
    ['StrategyDeployer', addresses.strategyDeployer, 'StrategyDeployer'],
    ['EmissionController', addresses.emissionController, 'EmissionController'],
    ['GenesisClaims', addresses.genesisClaims, 'GenesisClaims'],
    ['MiningClaims', addresses.miningClaims, 'MiningClaims'],
    ['AssetRegistry', addresses.assetRegistry, 'AssetRegistry'],
    ['AllocationVoter', addresses.allocationVoter, 'AllocationVoter'],
    ['GumBallVault', addresses.gumBallVault, 'GumBallVault'],
    ['StakedGBX', addresses.stakedGBX, 'StakedGBX'],
    ['GumBallRouter', addresses.gumBallRouter, 'GumBallRouter'],
    ['MiningPool', addresses.miningPool, 'MiningPool'],
    ['GenesisBootstrap', addresses.genesisBootstrap, 'GenesisBootstrap'],
    ['RevenueRouter', addresses.revenueRouter, 'RevenueRouter'],
    ['HoldUSDGStrategy', addresses.holdUSDGStrategy, 'HoldUSDGStrategy'],
    ['BuybackBurnStrategy', addresses.buybackBurnStrategy, 'BuybackBurnStrategy'],
    ['LaunchGuardHook', addresses.launchGuardHook, 'LaunchGuardHook'],
    ['GenesisLiquidityCalculator', addresses.genesisLiquidityCalculator, 'GenesisLiquidityCalculator'],
    ['LiquidityManager', addresses.liquidityManager, 'LiquidityManager'],
    ['GumBallLens', addresses.lens, 'GumBallLens'],
    ['AcquisitionStrategy:WETH', addresses.acquisitionStrategies[0]!, 'AcquisitionStrategy'],
    ['ManagerRewards:WETH', addresses.managerRewards[0]!, 'ManagerRewards'],
    ['AcquisitionStrategy:WRAPPED_BTC', addresses.acquisitionStrategies[1]!, 'AcquisitionStrategy'],
    ['ManagerRewards:WRAPPED_BTC', addresses.managerRewards[1]!, 'ManagerRewards'],
  ];
  const contracts: ContractRecord[] = logical.map(([, contractAddress, contractName], index) => ({
    address: contractAddress,
    blockNumber: 100 + index,
    constructorArguments: [],
    contractName,
    deploymentTransactionHash: bytes32(1000 + index),
    external: false,
    runtimeCodeHash: bytes32(2000 + index),
  }));
  const external = (contractName: string, contractAddress: string, runtimeCodeHash: string): ContractRecord => ({
    address: contractAddress,
    blockNumber: null,
    constructorArguments: [],
    contractName,
    deploymentTransactionHash: null,
    external: true,
    runtimeCodeHash,
  });
  contracts.push(
    external('ExternalUSDG', config.usdG, bytes32(3001)),
    external('ExternalPoolManager', config.uniswapV4.poolManager, bytes32(3002)),
    external('ExternalPositionManager', config.uniswapV4.positionManager, bytes32(3003)),
    external('ExternalPermit2', config.uniswapV4.permit2, bytes32(3004)),
    external('ExternalTargetToken:0', config.assets.tokens[0]!, bytes32(3030)),
    external('ExternalTargetToken:1', config.assets.tokens[1]!, bytes32(3031)),
  );
  const transactions = Object.fromEntries(
    logical.map(([name], index) => [`deploy:${name}`, { blockNumber: 100 + index, hash: bytes32(1000 + index) }]),
  );
  const state: DeploymentState = {
    addresses,
    chainId: '4663',
    configHash: bytes32(99),
    contracts,
    dependencyInitializer: address(99),
    gbxContractHolders: [],
    hookSalt: bytes32(777),
    networkName: 'robinhood',
    phase: 'GENESIS_SETTLED',
    schemaVersion: 1,
    timelockOperations: [],
    transactions,
    updatedAt: '2026-08-01T00:00:00Z',
  };
  state.gbxContractHolders = requiredGBXContractHolders(config, addresses);
  const configBytes = Buffer.from(`${JSON.stringify(config)}\n`);
  const stateBytes = Buffer.from(`${JSON.stringify(state)}\n`);
  const constructorParameters = Object.fromEntries(
    logical.map(([name]) => [name, { arguments: [], encodedArguments: '0x' }]),
  );
  const deployedContracts = logical.map(([name, contractAddress, contractName], index) => ({
    address: contractAddress,
    blockNumber: String(100 + index),
    constructorParametersKey: name,
    contractName,
    create2SaltKey: name === 'LaunchGuardHook' ? 'LaunchGuardHook' : null,
    name,
    runtimeBytecodeHash: bytes32(2000 + index),
    transactionHash: bytes32(1000 + index),
    transactionKey: `deploy:${name}`,
    verificationStatus: 'verified' as const,
    verificationUrl: `https://robinhoodchain.blockscout.com/address/${contractAddress}#code`,
  }));
  const manifest: ReleaseManifest = {
    assets: [
      {
        acquisitionEnabled: true,
        address: config.usdG,
        decimals: 6,
        key: 'USDG',
        proxyEvidence: {
          ...config.canonicalTokenDependencies!.usdG.proxyEvidence,
          verifiedAtBlock: '1000',
        },
        redemptionEnabled: true,
        registryStatus: 'NOT_APPLICABLE',
        runtimeBytecodeHash: bytes32(3001),
        uid: null,
        uiMultiplier: null,
      },
      {
        acquisitionEnabled: true,
        address: config.assets.tokens[0]!,
        decimals: 18,
        key: 'WETH',
        proxyEvidence: {
          ...config.canonicalTokenDependencies!.weth.proxyEvidence,
          adminOwnerProxyEvidence: {
            ...config.canonicalTokenDependencies!.weth.proxyEvidence.adminOwnerProxyEvidence,
          },
          verifiedAtBlock: '1000',
        },
        redemptionEnabled: true,
        registryStatus: 'NOT_APPLICABLE',
        runtimeBytecodeHash: bytes32(3030),
        uid: null,
        uiMultiplier: null,
      },
      {
        acquisitionEnabled: true,
        address: config.assets.tokens[1]!,
        decimals: 8,
        key: 'WRAPPED_BTC',
        proxyEvidence: wrappedBtcManifestEvidence(config.wrappedBtcBridgeDependency!),
        redemptionEnabled: true,
        registryStatus: 'NOT_APPLICABLE',
        runtimeBytecodeHash: bytes32(3031),
        uid: null,
        uiMultiplier: null,
      },
    ],
    compliance: { eligibilityModule: addresses.eligibilityModule, gbxContractHolders: state.gbxContractHolders },
    constructorParameters,
    create2Salts: { LaunchGuardHook: state.hookSalt },
    deployedContracts,
    externalContracts: [
      { address: config.usdG, key: 'USDG', runtimeBytecodeHash: bytes32(3001), verifiedAtBlock: '1000' },
      {
        address: config.uniswapV4.poolManager,
        key: 'uniswapV4.poolManager',
        runtimeBytecodeHash: bytes32(3002),
        verifiedAtBlock: '1000',
      },
      {
        address: config.uniswapV4.positionManager,
        key: 'uniswapV4.positionManager',
        runtimeBytecodeHash: bytes32(3003),
        verifiedAtBlock: '1000',
      },
      {
        address: config.uniswapV4.permit2,
        key: 'uniswapV4.permit2',
        runtimeBytecodeHash: bytes32(3004),
        verifiedAtBlock: '1000',
      },
    ],
    kind: 'gumball-6900-deployment-manifest',
    network: { chainId: 4_663, explorerUrl: 'https://robinhoodchain.blockscout.com' },
    protocol: 'GUM BALL 6900',
    release: {
      createdAt: '2026-08-01T00:01:00Z',
      gitCommit: 'a'.repeat(40),
      status: 'release-approved',
      version: 'v1.0.0',
    },
    releaseEvidence: {
      assetCandidate: {
        path: config.assetReview!.path,
        rawSha256: config.assetReview!.rawSha256,
      },
      deploymentConfig: { path: 'evidence/config.json', rawSha256: sha256(configBytes) },
      deploymentState: { path: 'evidence/state.json', rawSha256: sha256(stateBytes) },
      emergencyGuardianSafe: {
        ...config.emergencyGuardianSafe!,
        block: { hash: bytes32(5000), number: '1000', timestamp: '1754006400' },
        kind: 'gumball-6900-safe-control-plane-evidence',
        network: { chainId: 4_663, name: 'Robinhood Chain' },
        nonce: '4',
        protocol: 'GUM BALL 6900',
        schemaVersion: 1,
      },
      observation: {
        blockHash: bytes32(5000),
        blockNumber: '1000',
        expiresAt: '2026-08-01T01:00:00Z',
        observedAt: '2026-08-01T00:00:00Z',
      },
      protocolAdminSafe: {
        ...config.protocolAdminSafe!,
        block: { hash: bytes32(5000), number: '1000', timestamp: '1754006400' },
        kind: 'gumball-6900-safe-control-plane-evidence',
        network: { chainId: 4_663, name: 'Robinhood Chain' },
        nonce: '9',
        protocol: 'GUM BALL 6900',
        schemaVersion: 1,
      },
    },
    roles: {
      deployer: state.dependencyInitializer,
      deployerPrivilegesRenouncedOrIrrelevant: true,
      emergencyGuardianMultisig: config.roles.emergencyGuardianOperator,
      protocolTimelock: addresses.protocolTimelock,
      protocolTimelockMultisig: config.roles.protocolTimelockMultisig,
    },
    signaturePolicy: { policyId: bytes32(6000) },
    schemaVersion: 1,
    transactions: Object.fromEntries(Object.entries(transactions).map(([key, record]) => [key, record.hash])),
  };
  return { assetCandidateBytes, config, configBytes, manifest, state, stateBytes };
}

const permissionedSourcePins = {
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

function permissionedFixture(): ReturnType<typeof fixture> & {
  permissionedEvidence: PermissionedPoolReleaseEvidenceBytes;
} {
  const value = fixture();
  const dependency = (suffix: number) => ({ address: address(suffix), runtimeBytecodeHash: bytes32(3000 + suffix) });
  value.config.liquidity = {
    ...value.config.liquidity,
    mode: 'permissioned',
    permissionedDependencies: {
      mixedRouteQuoterV2: dependency(61),
      permissionedPositionManager: {
        address: value.config.uniswapV4.positionManager,
        runtimeBytecodeHash: bytes32(3003),
      },
      permissionsAdapterFactory: dependency(62),
      universalRouter: dependency(63),
      v4Quoter: dependency(64),
    },
  };

  const hookStateRecord = value.state.contracts.find(
    (record) => !record.external && record.address === value.state.addresses.launchGuardHook,
  )!;
  const oldHookAddress = value.state.addresses.launchGuardHook;
  value.state.addresses.launchGuardHook = address(0x28c0);
  hookStateRecord.address = value.state.addresses.launchGuardHook;
  hookStateRecord.contractName = 'GumBallPermissionedHook';
  value.manifest.deployedContracts.find((record) => record.address === oldHookAddress)!.address =
    value.state.addresses.launchGuardHook;

  const renameDeployment = (from: string, to: string) => {
    const manifestRecord = value.manifest.deployedContracts.find((record) => record.name === from)!;
    const stateRecord = value.state.contracts.find(
      (record) => !record.external && record.address === manifestRecord.address,
    )!;
    const oldManifestTransactionKey = manifestRecord.transactionKey;
    const oldStateTransaction = value.state.transactions[oldManifestTransactionKey]!;
    const oldConstructor = value.manifest.constructorParameters[manifestRecord.constructorParametersKey]!;
    delete value.state.transactions[oldManifestTransactionKey];
    delete value.manifest.transactions[oldManifestTransactionKey];
    delete value.manifest.constructorParameters[manifestRecord.constructorParametersKey];
    manifestRecord.name = to;
    manifestRecord.contractName = to;
    manifestRecord.constructorParametersKey = to;
    manifestRecord.transactionKey = `deploy:${to}`;
    manifestRecord.create2SaltKey = from === 'LaunchGuardHook' ? to : null;
    stateRecord.contractName = to;
    value.state.transactions[`deploy:${to}`] = oldStateTransaction;
    value.manifest.transactions[`deploy:${to}`] = oldStateTransaction.hash;
    value.manifest.constructorParameters[to] = oldConstructor;
  };
  renameDeployment('LaunchGuardHook', 'GumBallPermissionedHook');
  renameDeployment('LiquidityManager', 'PermissionedLiquidityManager');
  value.manifest.create2Salts = { GumBallPermissionedHook: value.state.hookSalt };

  const additions: Array<[string, string]> = [
    ['EligibilityAllowlistChecker', value.state.addresses.eligibilityAllowlistChecker],
    ['PermissionedPoolController', value.state.addresses.permissionedPoolController],
    ['UniswapPermissionsAdapter', value.state.addresses.gbxPermissionsAdapter],
    ['AdapterVerificationEscrow', value.state.addresses.adapterVerificationEscrow],
  ];
  for (const [index, [name, contractAddress]] of additions.entries()) {
    const transactionKey = `deploy:${name}`;
    const transactionHash = bytes32(1200 + index);
    const runtimeCodeHash = bytes32(2200 + index);
    const blockNumber = 130 + index;
    value.state.contracts.push({
      address: contractAddress,
      blockNumber,
      constructorArguments: [],
      contractName: name,
      deploymentTransactionHash: transactionHash,
      external: false,
      runtimeCodeHash,
    });
    value.state.transactions[transactionKey] = { blockNumber, hash: transactionHash };
    value.manifest.constructorParameters[name] = { arguments: [], encodedArguments: '0x' };
    value.manifest.transactions[transactionKey] = transactionHash;
    value.manifest.deployedContracts.push({
      address: contractAddress,
      blockNumber: String(blockNumber),
      constructorParametersKey: name,
      contractName: name,
      create2SaltKey: null,
      name,
      runtimeBytecodeHash: runtimeCodeHash,
      transactionHash,
      transactionKey,
      verificationStatus: 'verified',
      verificationUrl: `https://robinhoodchain.blockscout.com/address/${contractAddress}#code`,
    });
  }

  const externalState = (contractName: string, dependencyRecord: { address: string; runtimeBytecodeHash: string }) => {
    value.state.contracts.push({
      address: dependencyRecord.address,
      blockNumber: null,
      constructorArguments: [],
      contractName,
      deploymentTransactionHash: null,
      external: true,
      runtimeCodeHash: dependencyRecord.runtimeBytecodeHash,
    });
  };
  const permissionedDependencies = value.config.liquidity.permissionedDependencies!;
  for (const [key, contractName, manifestKey] of [
    ['permissionsAdapterFactory', 'ExternalUniswapPermissionsAdapterFactory', 'uniswapV4.permissionsAdapterFactory'],
    ['universalRouter', 'ExternalUniswapUniversalRouter', 'uniswapV4.universalRouter'],
    ['v4Quoter', 'ExternalUniswapV4Quoter', 'uniswapV4.quoter'],
    ['mixedRouteQuoterV2', 'ExternalUniswapMixedRouteQuoterV2', 'uniswapV4.mixedRouteQuoterV2'],
  ] as const) {
    const dependencyRecord = permissionedDependencies[key];
    externalState(contractName, dependencyRecord);
    value.manifest.externalContracts.push({
      address: dependencyRecord.address,
      key: manifestKey,
      runtimeBytecodeHash: dependencyRecord.runtimeBytecodeHash,
      verifiedAtBlock: '1000',
    });
  }

  value.state.gbxContractHolders = requiredGBXContractHolders(value.config, value.state.addresses);
  value.manifest.compliance.gbxContractHolders = value.state.gbxContractHolders;
  value.manifest.schemaVersion = 2;

  const officialDependency = (
    key: keyof NonNullable<DeploymentConfig['liquidity']['permissionedDependencies']>,
    contractName: string,
    sourcePath: string,
    sourceRepository: string,
    sourceCommit: string,
    suffix: number,
  ) => ({
    ...permissionedDependencies[key],
    artifactCreationBytecodeHash: bytes32(4000 + suffix),
    constructorArgumentsHash: bytes32(4100 + suffix),
    contractName,
    reproducedRuntimeBytecodeHash: permissionedDependencies[key].runtimeBytecodeHash,
    sourceCommit,
    sourcePath,
    sourceRepository,
  });
  const sourceBuild = {
    build: {
      command: 'pnpm reproduce:permissioned-pool',
      completedAt: '2026-08-01T00:00:00Z',
      compiler: { settingsSha256: '7'.repeat(64), version: '0.8.26+commit.8a97fa7a' },
      environment: {
        image: 'ghcr.io/gumball-6900/reproducible-solidity-build',
        imageDigest: `sha256:${'8'.repeat(64)}`,
        platform: 'linux/amd64',
      },
      lockfile: { path: 'evidence/permissioned-source-build-lock.json', rawSha256: '9'.repeat(64) },
    },
    dependencies: {
      mixedRouteQuoterV2: officialDependency(
        'mixedRouteQuoterV2',
        'MixedRouteQuoterV2',
        'src/MixedRouteQuoterV2.sol',
        permissionedSourcePins.mixedQuoter.repository,
        permissionedSourcePins.mixedQuoter.commit,
        1,
      ),
      permissionedPositionManager: officialDependency(
        'permissionedPositionManager',
        'PermissionedPositionManager',
        'src/hooks/permissionedPools/PermissionedPositionManager.sol',
        permissionedSourcePins.periphery.repository,
        permissionedSourcePins.periphery.commit,
        2,
      ),
      permissionsAdapterFactory: officialDependency(
        'permissionsAdapterFactory',
        'PermissionsAdapterFactory',
        'src/hooks/permissionedPools/PermissionsAdapterFactory.sol',
        permissionedSourcePins.periphery.repository,
        permissionedSourcePins.periphery.commit,
        3,
      ),
      universalRouter: officialDependency(
        'universalRouter',
        'UniversalRouter',
        'contracts/UniversalRouter.sol',
        permissionedSourcePins.universalRouter.repository,
        permissionedSourcePins.universalRouter.commit,
        4,
      ),
      v4Quoter: officialDependency(
        'v4Quoter',
        'V4Quoter',
        'src/lens/V4Quoter.sol',
        permissionedSourcePins.periphery.repository,
        permissionedSourcePins.periphery.commit,
        5,
      ),
    },
    kind: 'gumball-6900-permissioned-pool-official-source-build',
    network: { chainId: 4_663, name: 'Robinhood Chain' },
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    sourceArchives: Object.fromEntries(
      Object.entries(permissionedSourcePins).map(([key, pin], index) => [
        key,
        { commit: pin.commit, rawSha256: (index + 10).toString(16).padStart(64, '0'), repository: pin.repository },
      ]),
    ),
    sourcePins: permissionedSourcePins,
    status: 'reproduced',
  };
  const officialSourceBuildBytes = Buffer.from(`${JSON.stringify(sourceBuild)}\n`);
  const officialSourceBuildDescriptor = {
    path: 'evidence/permissioned-official-source-build.json',
    rawSha256: sha256(officialSourceBuildBytes),
  };

  const principal = 20_000_000n * 10n ** 18n;
  const fork = {
    adapter: {
      address: address(700),
      admin: address(701),
      allowListChecker: address(702),
      poolManagerBalance: principal.toString(),
      permissionedPoolController: address(701),
      swappingEnabled: true,
      totalSupply: principal.toString(),
      underlyingBalance: principal.toString(),
      underlyingGBX: address(703),
    },
    authorizationEligible: true,
    block: {
      confirmations: '64',
      expiresAt: '2026-08-01T01:00:00Z',
      hash: bytes32(700),
      number: '9000000',
      observedAt: '2026-08-01T00:00:00Z',
      parentHash: bytes32(699),
    },
    evidence: {
      deploymentConfig: { path: 'evidence/testnet-permissioned-config.json', rawSha256: 'a'.repeat(64) },
      deploymentState: { path: 'evidence/testnet-permissioned-state.json', rawSha256: 'b'.repeat(64) },
      officialSourceBuild: officialSourceBuildDescriptor,
      permissionedPoolGraph: { path: 'evidence/testnet-permissioned-graph.json', rawSha256: 'c'.repeat(64) },
    },
    genesis: {
      activePositionCount: 4,
      adapterPrincipal: principal.toString(),
      claimsAllocation: (80_000_000n * 10n ** 18n).toString(),
      cumulativeMinted: (100_000_000n * 10n ** 18n).toString(),
      liquidityAllocation: principal.toString(),
      managerResidual: '0',
      positions: [1, 2, 3, 4].map((tokenId) => ({
        exists: true,
        gbxPrincipal: (5_000_000n * 10n ** 18n).toString(),
        tokenId: String(tokenId),
      })),
      totalSupply: (100_000_000n * 10n ** 18n).toString(),
    },
    kind: 'gumball-6900-permissioned-pool-robinhood-fork-rehearsal',
    network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
    pool: {
      currency0: address(700),
      currency1: address(704),
      fee: 3_000,
      hook: address(0x28c0),
      hookPermissionBits: '0x28c0',
      initialized: true,
      poolId: bytes32(704),
      tickSpacing: 60,
      usdG: address(704),
    },
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    state: { configHash: bytes32(705), phase: 'GENESIS_SETTLED', sourceCommit: value.manifest.release.gitCommit },
    status: 'passed',
    swapActivation: {
      bootstrapEnableConsumed: true,
      permissionlessSwapSucceeded: true,
      permissionlessSwapTransactionHash: bytes32(707),
      swappingEnabled: true,
      transactionHash: bytes32(706),
    },
  };
  const robinhoodForkRehearsalBytes = Buffer.from(`${JSON.stringify(fork)}\n`);
  const robinhoodForkDescriptor = {
    path: 'evidence/permissioned-robinhood-fork-rehearsal.json',
    rawSha256: sha256(robinhoodForkRehearsalBytes),
  };

  const runtimeRecord = (contractAddress: string) => ({
    address: contractAddress,
    runtimeBytecodeHash: value.state.contracts.find((record) => record.address === contractAddress)!.runtimeCodeHash,
  });
  const sortedCurrencies = [value.state.addresses.gbxPermissionsAdapter, value.config.usdG].sort((left, right) =>
    BigInt(left) < BigInt(right) ? -1 : 1,
  );
  const graph = {
    contracts: {
      adapterVerificationEscrow: runtimeRecord(value.state.addresses.adapterVerificationEscrow),
      eligibilityAllowlistChecker: runtimeRecord(value.state.addresses.eligibilityAllowlistChecker),
      emergencyGuardian: runtimeRecord(value.state.addresses.emergencyGuardian),
      gbxPermissionsAdapter: runtimeRecord(value.state.addresses.gbxPermissionsAdapter),
      gumBallPermissionedHook: runtimeRecord(value.state.addresses.launchGuardHook),
      mixedRouteQuoterV2: permissionedDependencies.mixedRouteQuoterV2,
      permissionedLiquidityManager: runtimeRecord(value.state.addresses.liquidityManager),
      permissionedPoolController: runtimeRecord(value.state.addresses.permissionedPoolController),
      permissionedPositionManager: permissionedDependencies.permissionedPositionManager,
      permissionsAdapterFactory: permissionedDependencies.permissionsAdapterFactory,
      protocolTimelock: runtimeRecord(value.state.addresses.protocolTimelock),
      universalRouter: permissionedDependencies.universalRouter,
      v4Quoter: permissionedDependencies.v4Quoter,
    },
    evidence: {
      independentSecurityReview: { path: 'evidence/permissioned-security-review.json', rawSha256: 'd'.repeat(64) },
      legalDecision: { path: 'evidence/permissioned-legal-decision.json', rawSha256: 'e'.repeat(64) },
      robinhoodForkRehearsal: robinhoodForkDescriptor,
    },
    kind: 'gumball-6900-permissioned-pool-graph',
    network: { chainId: 4_663, name: 'Robinhood Chain' },
    pool: {
      currency0: sortedCurrencies[0],
      currency1: sortedCurrencies[1],
      fee: 3_000,
      hook: value.state.addresses.launchGuardHook,
      tickSpacing: 60,
    },
    protocol: 'GUM BALL 6900',
    relationships: {
      adapterAdmin: value.state.addresses.permissionedPoolController,
      adapterFactory: permissionedDependencies.permissionsAdapterFactory.address,
      adapterUnderlyingToken: value.state.addresses.gbx,
      allowListChecker: value.state.addresses.eligibilityAllowlistChecker,
      allowedWrappers: [
        permissionedDependencies.permissionedPositionManager.address,
        permissionedDependencies.universalRouter.address,
        permissionedDependencies.v4Quoter.address,
        permissionedDependencies.mixedRouteQuoterV2.address,
      ],
      controllerAdapter: value.state.addresses.gbxPermissionsAdapter,
      controllerEmergencyGuardian: value.state.addresses.emergencyGuardian,
      controllerHook: value.state.addresses.launchGuardHook,
      controllerProtocolTimelock: value.state.addresses.protocolTimelock,
      controllerVerificationEscrow: value.state.addresses.adapterVerificationEscrow,
      dependencyInitializer: value.state.dependencyInitializer,
      gbx: value.state.addresses.gbx,
      graphInitialized: true,
      hookAdapterFactory: permissionedDependencies.permissionsAdapterFactory.address,
      liquidityPositionOwner: value.state.addresses.liquidityManager,
      permit2: value.config.uniswapV4.permit2,
      poolManager: value.config.uniswapV4.poolManager,
      positionManagerAdapterFactory: permissionedDependencies.permissionsAdapterFactory.address,
      swappingEnabled: true,
      usdG: value.config.usdG,
      verificationWrapper: value.state.addresses.adapterVerificationEscrow,
    },
    releaseEligible: false,
    schemaVersion: 1,
    sourcePins: permissionedSourcePins,
    status: 'review-candidate',
  };
  const graphBytes = Buffer.from(`${JSON.stringify(graph)}\n`);
  value.manifest.releaseEvidence.permissionedPool = {
    graph: { path: 'evidence/permissioned-mainnet-graph.json', rawSha256: sha256(graphBytes) },
    officialSourceBuild: officialSourceBuildDescriptor,
    robinhoodForkRehearsal: robinhoodForkDescriptor,
  };

  value.configBytes = Buffer.from(`${JSON.stringify(value.config)}\n`);
  value.stateBytes = Buffer.from(`${JSON.stringify(value.state)}\n`);
  value.manifest.releaseEvidence.deploymentConfig.rawSha256 = sha256(value.configBytes);
  value.manifest.releaseEvidence.deploymentState.rawSha256 = sha256(value.stateBytes);
  return {
    ...value,
    permissionedEvidence: { graphBytes, officialSourceBuildBytes, robinhoodForkRehearsalBytes },
  };
}

interface MutablePermissionedEvidenceArtifacts {
  fork: {
    adapter: { underlyingBalance: string };
    evidence: { officialSourceBuild: { path: string; rawSha256: string } };
    swapActivation: { permissionlessSwapSucceeded: boolean };
  };
  graph: {
    evidence: {
      independentSecurityReview: { path: string; rawSha256: string } | null;
      robinhoodForkRehearsal: { path: string; rawSha256: string };
    };
    relationships: { adapterAdmin: string };
  };
  sourceBuild: {
    dependencies: {
      permissionsAdapterFactory: { sourceCommit: string };
      universalRouter: { reproducedRuntimeBytecodeHash: string };
    };
  };
}

function rewritePermissionedEvidence(
  value: ReturnType<typeof permissionedFixture>,
  mutate: (artifacts: MutablePermissionedEvidenceArtifacts) => void,
): void {
  const artifacts = {
    fork: JSON.parse(
      Buffer.from(value.permissionedEvidence.robinhoodForkRehearsalBytes).toString('utf8'),
    ) as unknown as MutablePermissionedEvidenceArtifacts['fork'],
    graph: JSON.parse(
      Buffer.from(value.permissionedEvidence.graphBytes).toString('utf8'),
    ) as unknown as MutablePermissionedEvidenceArtifacts['graph'],
    sourceBuild: JSON.parse(
      Buffer.from(value.permissionedEvidence.officialSourceBuildBytes).toString('utf8'),
    ) as unknown as MutablePermissionedEvidenceArtifacts['sourceBuild'],
  };
  mutate(artifacts);

  const officialSourceBuildBytes = Buffer.from(`${JSON.stringify(artifacts.sourceBuild)}\n`);
  const officialSourceBuild = {
    ...value.manifest.releaseEvidence.permissionedPool!.officialSourceBuild,
    rawSha256: sha256(officialSourceBuildBytes),
  };
  artifacts.fork.evidence.officialSourceBuild = officialSourceBuild;
  const robinhoodForkRehearsalBytes = Buffer.from(`${JSON.stringify(artifacts.fork)}\n`);
  const robinhoodForkRehearsal = {
    ...value.manifest.releaseEvidence.permissionedPool!.robinhoodForkRehearsal,
    rawSha256: sha256(robinhoodForkRehearsalBytes),
  };
  artifacts.graph.evidence.robinhoodForkRehearsal = robinhoodForkRehearsal;
  const graphBytes = Buffer.from(`${JSON.stringify(artifacts.graph)}\n`);
  const graph = {
    ...value.manifest.releaseEvidence.permissionedPool!.graph,
    rawSha256: sha256(graphBytes),
  };
  value.permissionedEvidence = { graphBytes, officialSourceBuildBytes, robinhoodForkRehearsalBytes };
  value.manifest.releaseEvidence.permissionedPool = { graph, officialSourceBuild, robinhoodForkRehearsal };
}

describe('Release manifest snapshot binding', function () {
  it('accepts an exact settled graph and returns the signed observation', function () {
    const value = fixture();
    const result = assertReleaseManifestMatchesSnapshots(
      value.manifest,
      value.config,
      value.state,
      value.assetCandidateBytes,
      value.configBytes,
      value.stateBytes,
      4_663n,
      Date.parse('2026-08-01T00:30:00Z'),
    );
    expect(result.observation.blockNumber).to.equal('1000');
    expect(result.manifestByName).to.have.property('size', 26);
  });

  it('fails explicitly before applying schema-v1 unrestricted assumptions to a permissioned graph', function () {
    const value = fixture();
    value.config.liquidity.mode = 'permissioned';
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        value.manifest,
        value.config,
        value.state,
        value.assetCandidateBytes,
        value.configBytes,
        value.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
      ),
    ).to.throw('cannot authorize the permissioned successor graph');
  });

  it('accepts a fully cross-linked schema-v2 permissioned release evidence set', function () {
    const value = permissionedFixture();
    const result = assertReleaseManifestMatchesSnapshots(
      value.manifest,
      value.config,
      value.state,
      value.assetCandidateBytes,
      value.configBytes,
      value.stateBytes,
      4_663n,
      Date.parse('2026-08-01T00:30:00Z'),
      value.permissionedEvidence,
    );
    expect(result.manifest.schemaVersion).to.equal(2);
    expect(result.manifestByName).to.have.property('size', 30);
    expect(result.manifestByName).to.have.property('has').that.is.a('function');
    expect(result.manifestByName.has('UniswapPermissionsAdapter')).to.equal(true);
  });

  it('requires exact raw bytes for every signed permissioned evidence descriptor', function () {
    const missing = permissionedFixture();
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        missing.manifest,
        missing.config,
        missing.state,
        missing.assetCandidateBytes,
        missing.configBytes,
        missing.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
      ),
    ).to.throw(/requires graph, official-source build/);

    const corrupted = permissionedFixture();
    corrupted.permissionedEvidence.graphBytes = Buffer.from('{}\n');
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        corrupted.manifest,
        corrupted.config,
        corrupted.state,
        corrupted.assetCandidateBytes,
        corrupted.configBytes,
        corrupted.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
        corrupted.permissionedEvidence,
      ),
    ).to.throw(/bytes do not match/);
  });

  it('rejects graph, official-source, and fork outcome substitutions even after descriptor hashes are updated', function () {
    const mutations: Array<[string, (artifacts: MutablePermissionedEvidenceArtifacts) => void, RegExp]> = [
      [
        'controller relationship',
        ({ graph }) => void (graph.relationships.adapterAdmin = address(9991)),
        /relationship adapterAdmin/,
      ],
      [
        'official source pin',
        ({ sourceBuild }) => void (sourceBuild.dependencies.permissionsAdapterFactory.sourceCommit = 'b'.repeat(40)),
        /official source pin/,
      ],
      [
        'reproduced runtime',
        ({ sourceBuild }) =>
          void (sourceBuild.dependencies.universalRouter.reproducedRuntimeBytecodeHash = bytes32(9992)),
        /reproduced runtime bytecode/,
      ],
      [
        'adapter backing',
        ({ fork }) => void (fork.adapter.underlyingBalance = (19_000_000n * 10n ** 18n).toString()),
        /underlying backing/,
      ],
      [
        'permissionless swap',
        ({ fork }) => void (fork.swapActivation.permissionlessSwapSucceeded = false),
        /permissionless post-genesis swaps/,
      ],
      [
        'review linkage',
        ({ graph }) => void (graph.evidence.independentSecurityReview = null),
        /independent security review must be an object/,
      ],
    ];
    for (const [label, mutate, expected] of mutations) {
      const value = permissionedFixture();
      rewritePermissionedEvidence(value, mutate);
      expect(
        () =>
          assertReleaseManifestMatchesSnapshots(
            value.manifest,
            value.config,
            value.state,
            value.assetCandidateBytes,
            value.configBytes,
            value.stateBytes,
            4_663n,
            Date.parse('2026-08-01T00:30:00Z'),
            value.permissionedEvidence,
          ),
        label,
      ).to.throw(expected);
    }
  });

  it('rejects stale permissioned fork evidence before applying mainnet release observations', function () {
    const value = permissionedFixture();
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        value.manifest,
        value.config,
        value.state,
        value.assetCandidateBytes,
        value.configBytes,
        value.stateBytes,
        4_663n,
        Date.parse('2026-08-01T01:30:00Z'),
        value.permissionedEvidence,
      ),
    ).to.throw(/fork rehearsal is future-dated, expired/);
  });

  it('rejects raw snapshot, constructor, role, transaction, and phase drift', function () {
    const mutations: Array<[string, (value: ReturnType<typeof fixture>) => void, string]> = [
      ['raw snapshot', (value) => (value.configBytes = Buffer.from('{}\n')), 'Prepared deployment config bytes'],
      [
        'constructor',
        (value) => value.manifest.constructorParameters.GBXToken!.arguments.push(address(1)),
        'constructor arguments',
      ],
      ['role', (value) => (value.manifest.roles.deployer = address(500)), 'manifest deployer'],
      ['transaction', (value) => (value.manifest.transactions['deploy:GBXToken'] = bytes32(9999)), 'transaction map'],
      ['phase', (value) => (value.state.phase = 'REGISTRY_CONFIGURED'), 'must be GENESIS_SETTLED'],
    ];
    for (const [label, mutate, message] of mutations) {
      const value = fixture();
      mutate(value);
      expect(
        () =>
          assertReleaseManifestMatchesSnapshots(
            value.manifest,
            value.config,
            value.state,
            value.assetCandidateBytes,
            value.configBytes,
            value.stateBytes,
            4_663n,
            Date.parse('2026-08-01T00:30:00Z'),
          ),
        label,
      ).to.throw(message);
    }
  });

  it('rejects a manifest asset-key permutation that disagrees with the config symbol hash', function () {
    const value = fixture();
    value.manifest.assets[1]!.key = 'WRAPPED_BTC';
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        value.manifest,
        value.config,
        value.state,
        value.assetCandidateBytes,
        value.configBytes,
        value.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
      ),
    ).to.throw('Manifest lacks the configured canonical WETH asset');
  });

  it('rejects canonical USDG implementation and WETH admin/owner control-plane drift', function () {
    const mutations: Array<[string, (value: ReturnType<typeof fixture>) => void, string]> = [
      [
        'USDG implementation',
        (value) => {
          const evidence = value.manifest.assets[0]!.proxyEvidence;
          if (evidence?.kind !== 'eip1967-uups') throw new Error('invalid test fixture');
          evidence.implementationAddress = address(9001);
        },
        'Manifest USDG implementation',
      ],
      [
        'WETH ProxyAdmin',
        (value) => {
          const evidence = value.manifest.assets[1]!.proxyEvidence;
          if (evidence?.kind !== 'eip1967-transparent') throw new Error('invalid test fixture');
          evidence.adminAddress = address(9002);
        },
        'Manifest WETH ProxyAdmin',
      ],
      [
        'WETH owner implementation',
        (value) => {
          const evidence = value.manifest.assets[1]!.proxyEvidence;
          if (evidence?.kind !== 'eip1967-transparent' || evidence.adminOwnerProxyEvidence === null) {
            throw new Error('invalid test fixture');
          }
          evidence.adminOwnerProxyEvidence.implementationRuntimeBytecodeHash = bytes32(9003);
        },
        'Manifest WETH ProxyAdmin-owner implementation runtime bytecode',
      ],
    ];
    for (const [label, mutate, message] of mutations) {
      const value = fixture();
      mutate(value);
      expect(
        () =>
          assertReleaseManifestMatchesSnapshots(
            value.manifest,
            value.config,
            value.state,
            value.assetCandidateBytes,
            value.configBytes,
            value.stateBytes,
            4_663n,
            Date.parse('2026-08-01T00:30:00Z'),
          ),
        label,
      ).to.throw(message);
    }
  });

  it('rejects WBTC bridge routing, shared-admin owner, and token-beacon drift', function () {
    const mutations: Array<[string, (value: ReturnType<typeof fixture>) => void, string]> = [
      [
        'gateway admin',
        (value) => {
          const evidence = value.manifest.assets[2]!.proxyEvidence;
          if (evidence?.kind !== 'wrapped-btc-canonical-bridge') throw new Error('invalid test fixture');
          evidence.gateway.proxyAdminAddress = address(9201);
        },
        'Manifest WBTC gateway ProxyAdmin',
      ],
      [
        'owner implementation',
        (value) => {
          const evidence = value.manifest.assets[2]!.proxyEvidence;
          if (evidence?.kind !== 'wrapped-btc-canonical-bridge') throw new Error('invalid test fixture');
          evidence.sharedProxyAdmin.owner.implementationRuntimeBytecodeHash = bytes32(9202);
        },
        'Manifest WBTC ProxyAdmin-owner implementation runtime bytecode',
      ],
      [
        'token beacon',
        (value) => {
          const evidence = value.manifest.assets[2]!.proxyEvidence;
          if (evidence?.kind !== 'wrapped-btc-canonical-bridge') throw new Error('invalid test fixture');
          evidence.tokenBeacon.address = address(9203);
        },
        'Manifest WBTC token beacon',
      ],
    ];
    for (const [label, mutate, message] of mutations) {
      const value = fixture();
      mutate(value);
      expect(
        () =>
          assertReleaseManifestMatchesSnapshots(
            value.manifest,
            value.config,
            value.state,
            value.assetCandidateBytes,
            value.configBytes,
            value.stateBytes,
            4_663n,
            Date.parse('2026-08-01T00:30:00Z'),
          ),
        label,
      ).to.throw(message);
    }
  });

  it('rejects release evidence detached from the configured Safe identity or signed observation block', function () {
    const identityMutations: Array<[string, (value: MutableSafeControlPlaneEvidence) => void]> = [
      ['proxy code', (value) => void (value.proxyRuntimeBytecodeHash = bytes32(9101))],
      ['singleton', (value) => void (value.singletonAddress = address(9102))],
      ['singleton code', (value) => void (value.singletonRuntimeBytecodeHash = bytes32(9103))],
      ['owners', (value) => void (value.owners = [address(9104), address(9105)])],
      ['threshold', (value) => void (value.threshold = '1')],
      ['guard', (value) => void (value.guard = address(9106))],
      ['modules', (value) => void (value.enabledModules = [address(9107)])],
      ['fallback', (value) => void (value.fallbackHandler = address(9108))],
    ];
    for (const role of ['protocolAdminSafe', 'emergencyGuardianSafe'] as const) {
      for (const [label, mutate] of identityMutations) {
        const value = fixture();
        mutate(mutableSafeControlPlane(value.manifest.releaseEvidence[role]));
        expect(
          () =>
            assertReleaseManifestMatchesSnapshots(
              value.manifest,
              value.config,
              value.state,
              value.assetCandidateBytes,
              value.configBytes,
              value.stateBytes,
              4_663n,
              Date.parse('2026-08-01T00:30:00Z'),
            ),
          `${role} ${label}`,
        ).to.throw(/changed|must require|fixed reviewed policy/);
      }
    }

    const wrongBlock = fixture();
    mutableSafeControlPlane(wrongBlock.manifest.releaseEvidence.protocolAdminSafe).block.hash = bytes32(9999);
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        wrongBlock.manifest,
        wrongBlock.config,
        wrongBlock.state,
        wrongBlock.assetCandidateBytes,
        wrongBlock.configBytes,
        wrongBlock.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
      ),
    ).to.throw('does not use the signed observation block');

    const wrongGuardianBlock = fixture();
    mutableSafeControlPlane(wrongGuardianBlock.manifest.releaseEvidence.emergencyGuardianSafe).block.hash =
      bytes32(9999);
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        wrongGuardianBlock.manifest,
        wrongGuardianBlock.config,
        wrongGuardianBlock.state,
        wrongGuardianBlock.assetCandidateBytes,
        wrongGuardianBlock.configBytes,
        wrongGuardianBlock.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
      ),
    ).to.throw('does not use the signed observation block');

    const mismatchedTimestamp = fixture();
    mutableSafeControlPlane(mismatchedTimestamp.manifest.releaseEvidence.emergencyGuardianSafe).block.timestamp =
      '1700000001';
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        mismatchedTimestamp.manifest,
        mismatchedTimestamp.config,
        mismatchedTimestamp.state,
        mismatchedTimestamp.assetCandidateBytes,
        mismatchedTimestamp.configBytes,
        mismatchedTimestamp.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
      ),
    ).to.throw('same exact observation block timestamp');

    const wrongGuardianNetwork = fixture();
    mutableSafeControlPlane(wrongGuardianNetwork.manifest.releaseEvidence.emergencyGuardianSafe).network = {
      chainId: 46_630,
      name: 'Robinhood Chain Testnet',
    };
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        wrongGuardianNetwork.manifest,
        wrongGuardianNetwork.config,
        wrongGuardianNetwork.state,
        wrongGuardianNetwork.assetCandidateBytes,
        wrongGuardianNetwork.configBytes,
        wrongGuardianNetwork.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
      ),
    ).to.throw('evidence network does not match config');

    const wrongGuardianRole = fixture();
    wrongGuardianRole.manifest.roles.emergencyGuardianMultisig = address(9998);
    expect(() =>
      assertReleaseManifestMatchesSnapshots(
        wrongGuardianRole.manifest,
        wrongGuardianRole.config,
        wrongGuardianRole.state,
        wrongGuardianRole.assetCandidateBytes,
        wrongGuardianRole.configBytes,
        wrongGuardianRole.stateBytes,
        4_663n,
        Date.parse('2026-08-01T00:30:00Z'),
      ),
    ).to.throw('manifest emergency-guardian Safe');
  });
});
