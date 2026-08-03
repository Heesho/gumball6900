import { readFileSync } from 'node:fs';

import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';

import {
  assertFreshReleaseEvidence,
  deploymentManifestSigningPayloadHash,
  parseDeploymentManifest,
  parseReleaseManifestSignaturePolicyConfiguration,
  requiredPermissionedGBXContractHolders,
  requiredPermissionedV2GBXContractHolders,
  requiredPermissionedV2ReleaseProtocolContractNames,
  requiredReleaseProtocolContractNames,
  validateDeploymentManifest,
  type DeploymentManifest,
} from '../schemas/deployment-manifest.js';

const draftFixture = JSON.parse(
  readFileSync(new URL('./fixtures/deployment-manifest.draft.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const testSigners = [1, 2, 3, 4, 5].map((value) => privateKeyToAccount(`0x${value.toString(16).padStart(64, '0')}`));
const testSigner = testSigners[0]!;
const zeroAddress = `0x${'00'.repeat(20)}`;
const zeroBytes32 = `0x${'00'.repeat(32)}`;
const hash = (byte: string) => `0x${byte.repeat(64)}`;
const indexedHash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;
const address = (suffix: number) => `0x${suffix.toString(16).padStart(40, '0')}`;
const testPolicyId = hash('a');
const testRoleQuorums = {
  economics: { authorizedSigners: [testSigners[1]!.address], threshold: 1 },
  legalCompliance: { authorizedSigners: [testSigners[2]!.address], threshold: 1 },
  operations: { authorizedSigners: [testSigners[3]!.address], threshold: 1 },
  release: { authorizedSigners: [testSigners[4]!.address], threshold: 1 },
  security: { authorizedSigners: [testSigners[0]!.address], threshold: 1 },
};
const testAuthorizedSigners = [
  testSigners[0]!.address,
  testSigners[1]!.address,
  testSigners[2]!.address,
  testSigners[3]!.address,
  testSigners[4]!.address,
];
const trustedSignaturePolicy = parseReleaseManifestSignaturePolicyConfiguration({
  kind: 'gumball-6900-release-manifest-signature-policy',
  policyId: testPolicyId,
  protocol: 'GUM BALL 6900',
  roleQuorums: testRoleQuorums,
  schemaVersion: 1,
  state: 'configured',
});

function validateWithTrustedPolicy(value: unknown) {
  return validateDeploymentManifest(value, trustedSignaturePolicy);
}

function assetRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    acquisitionEnabled: true,
    address: address(0x101),
    decimals: 18,
    key: 'USDG',
    redemptionEnabled: true,
    registryStatus: 'NOT_APPLICABLE',
    runtimeBytecodeHash: hash('1'),
    uid: null,
    uiMultiplier: null,
    ...overrides,
  };
}

function externalRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    address: address(0x201),
    key: 'USDG',
    runtimeBytecodeHash: hash('2'),
    sourceUrl: 'https://example.com/external',
    verifiedAtBlock: '1',
    ...overrides,
  };
}

function deployedRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    address: address(0x301),
    blockNumber: '1',
    contractName: 'GBXToken',
    constructorParametersKey: 'GBXToken',
    create2SaltKey: null,
    name: 'GBXToken',
    runtimeBytecodeHash: hash('3'),
    transactionKey: 'deploy:GBXToken',
    transactionHash: hash('4'),
    verificationStatus: 'pending',
    verificationUrl: null,
    ...overrides,
  };
}

async function signedCandidate(
  options: {
    algorithm?: 'eip191' | 'eip712';
    policyId?: string;
    signHexText?: boolean;
    signingAccounts?: typeof testSigners;
  } = {},
) {
  const candidate = structuredClone(draftFixture);
  candidate.signaturePolicy = {
    authorizedSigners: testAuthorizedSigners,
    policyId: options.policyId ?? testPolicyId,
    roleQuorums: testRoleQuorums,
    threshold: 5,
  };
  const unsigned = parseDeploymentManifest(candidate);
  const payloadHash = deploymentManifestSigningPayloadHash(unsigned);
  candidate.signatures = await Promise.all(
    (options.signingAccounts ?? testSigners).map(async (account) => ({
      algorithm: options.algorithm ?? 'eip191',
      payloadHash,
      signature: await account.signMessage({
        message: options.signHexText === true ? payloadHash : { raw: payloadHash },
      }),
      signer: account.address,
    })),
  );
  return candidate;
}

const releaseAssetKeys = ['USDG', 'WETH', 'WRAPPED_BTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL'] as const;
const releaseExternalKeys = [
  'USDG',
  'WETH',
  'uniswapV4.permit2',
  'uniswapV4.poolManager',
  'uniswapV4.positionDescriptor',
  'uniswapV4.positionManager',
  'uniswapV4.quoter',
  'uniswapV4.reservesLens',
  'uniswapV4.stateView',
  'uniswapV4.universalRouter',
] as const;

interface MutableReleaseFixture extends Record<string, unknown> {
  assets: Array<Record<string, unknown>>;
  compliance: {
    decisionReference: string | null;
    eligibilityModule: string | null;
    gbxContractHolders: Array<Record<string, unknown>>;
    mode: string;
    permissionedPoolArchitectureReviewed: boolean;
  };
  constructorParameters: Record<string, { arguments: unknown[]; encodedArguments: string }>;
  create2Salts: Record<string, string>;
  deployedContracts: Array<Record<string, unknown>>;
  externalContracts: Array<Record<string, unknown>>;
  gates: Record<string, Record<string, unknown>>;
  network: Record<string, unknown>;
  release: Record<string, unknown>;
  releaseEvidence: {
    assetCandidate: { path: string; rawSha256: string } | null;
    deploymentConfig: { path: string; rawSha256: string };
    deploymentState: { path: string; rawSha256: string };
    emergencyGuardianSafe: Record<string, unknown>;
    observation: { blockHash: string; blockNumber: string; expiresAt: string; observedAt: string };
    permissionedPool?: {
      graph: { path: string; rawSha256: string };
      officialSourceBuild: { path: string; rawSha256: string };
      robinhoodForkRehearsal: { path: string; rawSha256: string };
    };
    protocolAdminSafe: Record<string, unknown>;
  } | null;
  roles: {
    deployer: string;
    deployerPrivilegesRenouncedOrIrrelevant: boolean;
    emergencyGuardianMultisig: string;
    protocolTimelock: string;
    protocolTimelockMultisig: string;
  };
  signaturePolicy: Record<string, unknown>;
  signatures: Array<Record<string, unknown>>;
  schemaVersion: number;
  transactions: Record<string, string>;
}

function unsignedReleaseFixture(): MutableReleaseFixture {
  const candidate = structuredClone(draftFixture) as unknown as MutableReleaseFixture;
  candidate.release = {
    createdAt: '2026-08-01T00:00:00Z',
    gitCommit: '1'.repeat(40),
    status: 'release-approved',
    version: 'v1.0.0',
  };
  candidate.releaseEvidence = {
    assetCandidate: {
      path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json',
      rawSha256: '3'.repeat(64),
    },
    deploymentConfig: {
      path: 'packages/config/deployments/evidence/v1.0.0-config.json',
      rawSha256: '1'.repeat(64),
    },
    deploymentState: {
      path: 'packages/config/deployments/evidence/v1.0.0-state.json',
      rawSha256: '2'.repeat(64),
    },
    emergencyGuardianSafe: {
      block: { hash: indexedHash(0x9000), number: '25030000', timestamp: '1754006400' },
      enabledModules: [],
      fallbackHandler: address(0),
      guard: address(0),
      kind: 'gumball-6900-safe-control-plane-evidence',
      network: { chainId: 4_663, name: 'Robinhood Chain' },
      nonce: '7',
      owners: [address(0x4023), address(0x4024), address(0x4025)],
      protocol: 'GUM BALL 6900',
      proxyRuntimeBytecodeHash: indexedHash(0x9020),
      safeAddress: address(0x4001),
      schemaVersion: 1,
      singletonAddress: address(0x4026),
      singletonRuntimeBytecodeHash: indexedHash(0x9021),
      threshold: '2',
    },
    observation: {
      blockHash: indexedHash(0x9000),
      blockNumber: '25030000',
      expiresAt: '2026-08-01T12:00:00Z',
      observedAt: '2026-08-01T00:00:00Z',
    },
    protocolAdminSafe: {
      block: { hash: indexedHash(0x9000), number: '25030000', timestamp: '1754006400' },
      enabledModules: [],
      fallbackHandler: address(0),
      guard: address(0),
      kind: 'gumball-6900-safe-control-plane-evidence',
      network: { chainId: 4_663, name: 'Robinhood Chain' },
      nonce: '11',
      owners: [address(0x4013), address(0x4014), address(0x4015)],
      protocol: 'GUM BALL 6900',
      proxyRuntimeBytecodeHash: indexedHash(0x9010),
      safeAddress: address(0x4002),
      schemaVersion: 1,
      singletonAddress: address(0x4016),
      singletonRuntimeBytecodeHash: indexedHash(0x9011),
      threshold: '2',
    },
  };
  candidate.network.archiveRpcProviderLabel = 'reviewed-archive-provider';
  const gateEvidenceKinds: Record<string, string> = {
    canonicalTokens: 'manifest',
    compliance: 'legal',
    economicReview: 'audit',
    incidentReadiness: 'operations',
    legalReview: 'legal',
    roleTransfer: 'operations',
    securityAudit: 'audit',
    stockTokens: 'manifest',
    testnetDependencies: 'deployment',
    testnetRehearsal: 'test',
    uniswapV4: 'deployment',
    wrappedBtc: 'manifest',
  };
  for (const [name, gate] of Object.entries(candidate.gates) as Array<[string, Record<string, unknown>]>) {
    gate.state = 'passed';
    gate.evidence = [{ digest: indexedHash(1), kind: gateEvidenceKinds[name], uri: 'ipfs://release-evidence' }];
  }

  candidate.assets = releaseAssetKeys.map((key, index) => {
    const isStock = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'].includes(key);
    const record: Record<string, unknown> = {
      acquisitionEnabled: true,
      address: address(0x1000 + index),
      decimals: key === 'USDG' ? 6 : key === 'WRAPPED_BTC' ? 8 : 18,
      key,
      redemptionEnabled: true,
      registryStatus: isStock ? 'ASSET_STATUS_ACTIVE' : 'NOT_APPLICABLE',
      runtimeBytecodeHash: indexedHash(0x2000 + index),
      uid: isStock ? indexedHash(0x3000 + index) : null,
      uiMultiplier: isStock ? '1000000000000000000' : null,
    };
    if (key === 'USDG') {
      record.proxyEvidence = {
        adminSlotValue: zeroBytes32,
        implementationAddress: address(0x1090),
        implementationRuntimeBytecodeHash: indexedHash(0x2090),
        kind: 'eip1967-uups',
        upgradeAuthorityAddress: address(0x1091),
        upgradeAuthorityRuntimeBytecodeHash: indexedHash(0x2091),
        verifiedAtBlock: '25030000',
      };
    } else if (key === 'WETH') {
      const adminAddress = address(0x1092);
      record.proxyEvidence = {
        adminAddress,
        adminOwnerAddress: address(0x1093),
        adminOwnerProxyEvidence: {
          adminSlotValue: `0x${'00'.repeat(12)}${adminAddress.slice(2)}`,
          implementationAddress: address(0x1094),
          implementationRuntimeBytecodeHash: indexedHash(0x2094),
        },
        adminOwnerRuntimeBytecodeHash: indexedHash(0x2093),
        adminRuntimeBytecodeHash: indexedHash(0x2092),
        adminSlotValue: `0x${'00'.repeat(12)}${adminAddress.slice(2)}`,
        implementationAddress: address(0x1095),
        implementationRuntimeBytecodeHash: indexedHash(0x2095),
        kind: 'eip1967-transparent',
        proxyAdminInterface: 'oz-v4',
        verifiedAtBlock: '25030000',
      };
    } else if (key === 'WRAPPED_BTC') {
      const proxyAdminAddress = address(0x10a0);
      record.proxyEvidence = {
        gateway: {
          address: address(0x10a1),
          implementationAddress: address(0x10a2),
          implementationRuntimeBytecodeHash: indexedHash(0x20a2),
          proxyAdminAddress,
          runtimeBytecodeHash: indexedHash(0x20a1),
        },
        gatewayRouter: {
          address: address(0x10a3),
          implementationAddress: address(0x10a4),
          implementationRuntimeBytecodeHash: indexedHash(0x20a4),
          proxyAdminAddress,
          runtimeBytecodeHash: indexedHash(0x20a3),
        },
        kind: 'wrapped-btc-canonical-bridge',
        l1Token: address(0x10a5),
        sharedProxyAdmin: {
          address: proxyAdminAddress,
          owner: {
            address: address(0x10a6),
            adminRole: '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
            executorRole: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63',
            implementationAddress: address(0x10a7),
            implementationRuntimeBytecodeHash: indexedHash(0x20a7),
            runtimeBytecodeHash: indexedHash(0x20a6),
          },
          runtimeBytecodeHash: indexedHash(0x20a0),
        },
        tokenBeacon: {
          address: address(0x10a8),
          implementationAddress: address(0x10a9),
          implementationRuntimeBytecodeHash: indexedHash(0x20a9),
          runtimeBytecodeHash: indexedHash(0x20a8),
        },
        verifiedAtBlock: '25030000',
      };
    } else if (isStock) {
      record.proxyEvidence = {
        beaconAddress: address(0x1096),
        beaconRuntimeBytecodeHash: indexedHash(0x2096),
        implementationAddress: address(0x1097),
        implementationRuntimeBytecodeHash: indexedHash(0x2097),
        kind: 'eip1967-beacon',
        verifiedAtBlock: '25030000',
      };
    }
    return record;
  });

  candidate.externalContracts = releaseExternalKeys.map((key, index) => {
    const asset = candidate.assets.find((record: Record<string, unknown>) => record.key === key);
    return {
      address: asset?.address ?? address(0x2000 + index),
      key,
      runtimeBytecodeHash: asset?.runtimeBytecodeHash ?? indexedHash(0x4000 + index),
      sourceUrl: `https://example.com/external/${index}`,
      verifiedAtBlock: '25030000',
    };
  });

  candidate.constructorParameters = {};
  candidate.transactions = {};
  candidate.deployedContracts = requiredReleaseProtocolContractNames.map((name, index) => {
    const transactionKey = `deploy:${name}`;
    const transactionHash = indexedHash(0x5000 + index);
    candidate.constructorParameters[name] = { arguments: [], encodedArguments: '0x' };
    candidate.transactions[transactionKey] = transactionHash;
    return {
      address: address(0x3000 + index),
      blockNumber: String(25_020_000 + index),
      contractName: name.startsWith('AcquisitionStrategy:')
        ? 'AcquisitionStrategy'
        : name.startsWith('ManagerRewards:')
          ? 'ManagerRewards'
          : name === 'EligibilityModule'
            ? 'RegistryEligibilityModule'
            : name,
      constructorParametersKey: name,
      create2SaltKey: name === 'LaunchGuardHook' ? 'LaunchGuardHook' : null,
      name,
      runtimeBytecodeHash: indexedHash(0x6000 + index),
      transactionKey,
      transactionHash,
      verificationStatus: 'verified',
      verificationUrl: `https://robinhoodchain.blockscout.com/address/${address(0x3000 + index)}#code`,
    };
  });
  candidate.create2Salts = { LaunchGuardHook: indexedHash(0x7000) };

  const deployedAddress = (name: string) =>
    candidate.deployedContracts.find((record: Record<string, unknown>) => record.name === name)!.address as string;
  const externalAddress = (key: string) =>
    candidate.externalContracts.find((record: Record<string, unknown>) => record.key === key)!.address as string;
  candidate.roles = {
    deployer: address(0x4000),
    deployerPrivilegesRenouncedOrIrrelevant: true,
    emergencyGuardianMultisig: address(0x4001),
    protocolTimelock: deployedAddress('ProtocolTimelock'),
    protocolTimelockMultisig: address(0x4002),
  };
  candidate.compliance = {
    decisionReference: 'ipfs://reviewed-compliance-decision',
    eligibilityModule: deployedAddress('EligibilityModule'),
    gbxContractHolders: requiredPermissionedGBXContractHolders.map((requirement) => ({
      address:
        requirement.source === 'deployedContracts'
          ? deployedAddress(requirement.sourceKey)
          : externalAddress(requirement.sourceKey),
      rationale: requirement.rationale,
      role: requirement.role,
    })),
    mode: 'unrestricted-production-approved',
    permissionedPoolArchitectureReviewed: false,
  };

  candidate.constructorParameters.ProtocolTimelock = {
    arguments: [candidate.roles.protocolTimelockMultisig, candidate.roles.deployer],
    encodedArguments: '0x',
  };
  candidate.constructorParameters.EmergencyGuardian = {
    arguments: [candidate.roles.protocolTimelock, candidate.roles.emergencyGuardianMultisig],
    encodedArguments: '0x',
  };
  candidate.constructorParameters.GBXToken = {
    arguments: [candidate.roles.deployer, candidate.compliance.eligibilityModule],
    encodedArguments: '0x',
  };
  candidate.constructorParameters.StrategyDeployer = {
    arguments: [
      candidate.roles.protocolTimelock,
      deployedAddress('EmergencyGuardian'),
      deployedAddress('GBXToken'),
      candidate.roles.deployer,
      [indexedHash(0x7101), indexedHash(0x7102), indexedHash(0x7103), indexedHash(0x7104), indexedHash(0x7105)],
      ['100', '101', '102', '103', String(releaseAssetKeys.length - 1)],
    ],
    encodedArguments: '0x',
  };
  candidate.constructorParameters.AssetRegistry = {
    arguments: [
      externalAddress('USDG'),
      candidate.roles.protocolTimelock,
      deployedAddress('EmergencyGuardian'),
      deployedAddress('StrategyDeployer'),
    ],
    encodedArguments: '0x',
  };
  for (const key of releaseAssetKeys.filter((assetKey) => assetKey !== 'USDG')) {
    const asset = candidate.assets.find((record: Record<string, unknown>) => record.key === key)!;
    const strategyName = `AcquisitionStrategy:${key}`;
    const rewardsName = `ManagerRewards:${key}`;
    candidate.constructorParameters[strategyName] = {
      arguments: [
        asset.address,
        deployedAddress('GumBallVault'),
        deployedAddress('AllocationVoter'),
        deployedAddress('AssetRegistry'),
        candidate.roles.protocolTimelock,
        deployedAddress('EmergencyGuardian'),
        deployedAddress('StrategyDeployer'),
        '1',
        '1000000',
        '1000000000000000000',
      ],
      encodedArguments: '0x',
    };
    candidate.constructorParameters[rewardsName] = {
      arguments: [asset.address, deployedAddress(strategyName)],
      encodedArguments: '0x',
    };
  }
  candidate.signaturePolicy = {
    authorizedSigners: testAuthorizedSigners,
    policyId: testPolicyId,
    roleQuorums: testRoleQuorums,
    threshold: 5,
  };
  candidate.signatures = [];
  return candidate;
}

function unsignedPermissionedV2ReleaseFixture(): MutableReleaseFixture {
  const candidate = unsignedReleaseFixture();
  candidate.schemaVersion = 2;
  candidate.compliance.mode = 'permissioned-production';
  candidate.compliance.permissionedPoolArchitectureReviewed = true;
  candidate.releaseEvidence!.permissionedPool = {
    graph: { path: 'evidence/mainnet-permissioned-pool-graph.json', rawSha256: '4'.repeat(64) },
    officialSourceBuild: { path: 'evidence/official-permissioned-source-build.json', rawSha256: '5'.repeat(64) },
    robinhoodForkRehearsal: {
      path: 'evidence/robinhood-testnet-permissioned-rehearsal.json',
      rawSha256: '6'.repeat(64),
    },
  };

  const renameDeployment = (from: string, to: string) => {
    const deployment = candidate.deployedContracts.find((record) => record.name === from)!;
    const oldTransactionKey = deployment.transactionKey as string;
    const transactionHash = candidate.transactions[oldTransactionKey]!;
    const constructor = candidate.constructorParameters[from]!;
    delete candidate.transactions[oldTransactionKey];
    delete candidate.constructorParameters[from];
    deployment.name = to;
    deployment.contractName = to;
    deployment.constructorParametersKey = to;
    deployment.transactionKey = `deploy:${to}`;
    deployment.create2SaltKey = from === 'LaunchGuardHook' ? to : null;
    candidate.transactions[`deploy:${to}`] = transactionHash;
    candidate.constructorParameters[to] = constructor;
  };
  renameDeployment('LaunchGuardHook', 'GumBallPermissionedHook');
  renameDeployment('LiquidityManager', 'PermissionedLiquidityManager');
  candidate.create2Salts = { GumBallPermissionedHook: indexedHash(0x7000) };

  for (const [index, name] of [
    'EligibilityAllowlistChecker',
    'PermissionedPoolController',
    'UniswapPermissionsAdapter',
    'AdapterVerificationEscrow',
  ].entries()) {
    const transactionKey = `deploy:${name}`;
    const transactionHash = indexedHash(0x8000 + index);
    candidate.constructorParameters[name] = { arguments: [], encodedArguments: '0x' };
    candidate.transactions[transactionKey] = transactionHash;
    candidate.deployedContracts.push({
      address: address(0x8000 + index),
      blockNumber: String(25_020_100 + index),
      contractName: name,
      constructorParametersKey: name,
      create2SaltKey: null,
      name,
      runtimeBytecodeHash: indexedHash(0x8100 + index),
      transactionKey,
      transactionHash,
      verificationStatus: 'verified',
      verificationUrl: `https://robinhoodchain.blockscout.com/address/${address(0x8000 + index)}#code`,
    });
  }

  for (const [index, key] of ['uniswapV4.mixedRouteQuoterV2', 'uniswapV4.permissionsAdapterFactory'].entries()) {
    candidate.externalContracts.push({
      address: address(0x9000 + index),
      key,
      runtimeBytecodeHash: indexedHash(0x9000 + index),
      sourceUrl: `https://github.com/Uniswap/${index === 0 ? 'mixed-quoter' : 'v4-periphery'}`,
      verifiedAtBlock: '25030000',
    });
  }

  const deployedAddress = (name: string) =>
    candidate.deployedContracts.find((record: Record<string, unknown>) => record.name === name)!.address as string;
  candidate.compliance.gbxContractHolders = requiredPermissionedV2GBXContractHolders.map((requirement) => ({
    address: deployedAddress(requirement.sourceKey),
    rationale: requirement.rationale,
    role: requirement.role,
  }));
  return candidate;
}

async function signReleaseFixture(candidate: MutableReleaseFixture): Promise<MutableReleaseFixture> {
  candidate.signatures = [];
  const payloadHash = deploymentManifestSigningPayloadHash(candidate as DeploymentManifest);
  candidate.signatures = await Promise.all(
    testSigners.map(async (account) => ({
      algorithm: 'eip191',
      payloadHash,
      signature: await account.signMessage({ message: { raw: payloadHash } }),
      signer: account.address,
    })),
  );
  return candidate;
}

describe('deployment manifest schema', () => {
  it('accepts a draft only when unresolved gates remain explicit', () => {
    const manifest = parseDeploymentManifest(draftFixture);
    expect(manifest.release.status).toBe('draft');
    expect(manifest.gates.wrappedBtc.state).toBe('unresolved');
    expect(manifest.gates.testnetDependencies.state).toBe('unresolved');
    expect(manifest.gates.compliance.state).toBe('unresolved');
  });

  it('blocks release approval while gates, compliance, wrapped BTC, roles, and signatures are unresolved', () => {
    const candidate = structuredClone(draftFixture);
    (candidate.release as Record<string, unknown>).status = 'release-approved';
    expect(() => parseDeploymentManifest(candidate)).toThrow();
  });

  it('requires evidence for a passed gate', () => {
    const candidate = structuredClone(draftFixture);
    const gates = candidate.gates as Record<string, Record<string, unknown>>;
    gates.wrappedBtc!.state = 'passed';
    expect(() => parseDeploymentManifest(candidate)).toThrow('passed gate requires evidence');
  });

  it('requires every gate evidence record to have a nonzero digest and durable URI', () => {
    const candidate = structuredClone(draftFixture);
    const gate = (candidate.gates as Record<string, Record<string, unknown>>).securityAudit!;
    gate.evidence = [{ digest: zeroBytes32, kind: 'audit', uri: 'https://evidence.example/audit.json' }];
    expect(() => parseDeploymentManifest(candidate)).toThrow('Bytes32 value must be nonzero');

    gate.evidence = [{ kind: 'audit', uri: 'https://evidence.example/audit.json' }];
    expect(() => parseDeploymentManifest(candidate)).toThrow();

    gate.evidence = [{ digest: hash('1'), kind: 'audit', uri: 'file:///tmp/audit.json' }];
    expect(() => parseDeploymentManifest(candidate)).toThrow('durable HTTPS, IPFS, or Arweave');
  });

  it('forbids noop compliance mode on mainnet', () => {
    const candidate = structuredClone(draftFixture);
    (candidate.compliance as Record<string, unknown>).mode = 'noop-testnet';
    expect(() => parseDeploymentManifest(candidate)).toThrow('Noop compliance mode is forbidden on mainnet');
  });

  it('rejects a signature over a different canonical payload', () => {
    const candidate = structuredClone(draftFixture);
    candidate.signatures = [
      {
        algorithm: 'eip191',
        payloadHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        signature: `0x${'11'.repeat(65)}`,
        signer: '0x0000000000000000000000000000000000000001',
      },
    ];
    expect(() => parseDeploymentManifest(candidate)).toThrow('payload hash does not match');
  });

  it('recovers an EIP-191 signer over the raw 32-byte SHA-256 payload hash', async () => {
    const manifest = await validateWithTrustedPolicy(await signedCandidate());
    expect(manifest.signatures.map(({ signer }) => signer)).toEqual(testAuthorizedSigners);
  });

  it('fails closed on a signed manifest while the committed trust root is unconfigured', async () => {
    await expect(validateDeploymentManifest(await signedCandidate())).rejects.toThrow(
      'signature policy is not configured',
    );
  });

  it('allows the explicitly inactive zero-threshold policy for unsigned local candidates', async () => {
    const candidate = structuredClone(draftFixture);
    candidate.network = {
      archiveRpcProviderLabel: 'local-anvil',
      chainId: 46630,
      explorerUrl: 'http://localhost:4000',
      name: 'Robinhood Chain Testnet',
    };
    candidate.release = {
      createdAt: '2026-08-01T00:00:00Z',
      gitCommit: '0'.repeat(40),
      status: 'testnet-candidate',
      version: 'v0.0.0-local',
    };
    await expect(validateDeploymentManifest(candidate)).resolves.toMatchObject({
      signaturePolicy: { authorizedSigners: [], policyId: zeroBytes32, threshold: 0 },
      signatures: [],
    });
  });

  it('never treats a zero-threshold mainnet candidate as trusted', async () => {
    const candidate = structuredClone(draftFixture);
    (candidate.release as Record<string, unknown>).status = 'mainnet-candidate';
    await expect(validateDeploymentManifest(candidate)).rejects.toThrow('signature policy is not configured');
  });

  it('rejects an arbitrary self-declared signer policy even when its signature is valid', async () => {
    const organizationalPolicy = parseReleaseManifestSignaturePolicyConfiguration({
      kind: 'gumball-6900-release-manifest-signature-policy',
      policyId: hash('b'),
      protocol: 'GUM BALL 6900',
      roleQuorums: testRoleQuorums,
      schemaVersion: 1,
      state: 'configured',
    });
    await expect(validateDeploymentManifest(await signedCandidate(), organizationalPolicy)).rejects.toThrow(
      'does not match the committed release-manifest signature policy',
    );
  });

  it('enforces authorized signer membership and every configured signer-role quorum', async () => {
    const unauthorized = privateKeyToAccount(`0x${'06'.padStart(64, '0')}`);
    await expect(
      validateDeploymentManifest(
        await signedCandidate({
          signingAccounts: [unauthorized, ...testSigners.slice(1)],
        }),
        trustedSignaturePolicy,
      ),
    ).rejects.toThrow('not authorized by policy');

    await expect(
      validateDeploymentManifest(
        await signedCandidate({
          signingAccounts: testSigners.slice(0, 4),
        }),
        trustedSignaturePolicy,
      ),
    ).rejects.toThrow('below threshold 5');
  });

  it('requires distinct security, economics, legal/compliance, operations, and release memberships', () => {
    expect(() =>
      parseReleaseManifestSignaturePolicyConfiguration({
        kind: 'gumball-6900-release-manifest-signature-policy',
        policyId: hash('b'),
        protocol: 'GUM BALL 6900',
        roleQuorums: {
          ...testRoleQuorums,
          economics: { authorizedSigners: [testSigner.address], threshold: 1 },
        },
        schemaVersion: 1,
        state: 'configured',
      }),
    ).toThrow('globally distinct');
  });

  it('does not count duplicate signatures from one recovered signer toward quorum', async () => {
    const candidate = await signedCandidate();
    candidate.signatures = [
      ...(candidate.signatures as Array<Record<string, unknown>>),
      structuredClone((candidate.signatures as Array<Record<string, unknown>>)[0]!),
    ];
    await expect(validateWithTrustedPolicy(candidate)).rejects.toThrow('duplicates recovered signer');
  });

  it('rejects a signature whose declared signer does not match EOA recovery', async () => {
    const candidate = await signedCandidate();
    (candidate.signatures as Array<Record<string, unknown>>)[0]!.signer = '0x0000000000000000000000000000000000000002';
    await expect(validateWithTrustedPolicy(candidate)).rejects.toThrow('not declared signer');
  });

  it('rejects signing the printable payload-hash text instead of its raw 32 bytes', async () => {
    await expect(validateWithTrustedPolicy(await signedCandidate({ signHexText: true }))).rejects.toThrow(
      'not declared signer',
    );
  });

  it('fails closed on EIP-712 until an exact typed-data convention is implemented', async () => {
    await expect(validateWithTrustedPolicy(await signedCandidate({ algorithm: 'eip712' }))).rejects.toThrow(
      'unsupported eip712',
    );
  });

  it('requires every declared GBX contract holder to match a code-record address and canonical rationale', () => {
    const candidate = structuredClone(draftFixture);
    const compliance = candidate.compliance as Record<string, unknown>;
    compliance.gbxContractHolders = [
      {
        address: '0x0000000000000000000000000000000000000001',
        rationale: 'Custodies the fixed genesis claim allocation until claims.',
        role: 'GenesisClaims',
      },
    ];
    expect(() => parseDeploymentManifest(candidate)).toThrow('lacks its GenesisClaims code record');
  });

  it('rejects zero asset addresses, runtime hashes, and stock-token UIDs', () => {
    const candidate = structuredClone(draftFixture);
    candidate.assets = [assetRecord({ address: zeroAddress })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('Address must be nonzero');

    candidate.assets = [assetRecord({ runtimeBytecodeHash: zeroBytes32 })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('Runtime bytecode hash must be nonzero');

    candidate.assets = [
      assetRecord({
        address: address(0x102),
        key: 'QQQ',
        registryStatus: 'ASSET_STATUS_ACTIVE',
        uid: zeroBytes32,
      }),
    ];
    expect(() => parseDeploymentManifest(candidate)).toThrow('Bytes32 value must be nonzero');
  });

  it('requires unique asset addresses and stock-token UIDs', () => {
    const candidate = structuredClone(draftFixture);
    candidate.assets = [assetRecord(), assetRecord({ key: 'WETH' })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('assets addresses must be unique');

    candidate.assets = [
      assetRecord({ key: 'QQQ', registryStatus: 'ASSET_STATUS_ACTIVE', uid: hash('a') }),
      assetRecord({ address: address(0x102), key: 'NVDA', registryStatus: 'ASSET_STATUS_ACTIVE', uid: hash('a') }),
    ];
    expect(() => parseDeploymentManifest(candidate)).toThrow('Asset UIDs must be unique');
  });

  it('requires deployed and external contract addresses to be unique within each collection', () => {
    const candidate = structuredClone(draftFixture);
    candidate.externalContracts = [externalRecord(), externalRecord({ key: 'WETH' })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('externalContracts addresses must be unique');

    candidate.externalContracts = [];
    candidate.deployedContracts = [deployedRecord(), deployedRecord({ name: 'GumBallVault' })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('deployedContracts addresses must be unique');
  });

  it('rejects zero transaction hashes and nonpositive evidence blocks', () => {
    const candidate = structuredClone(draftFixture);
    candidate.transactions = { deploy: zeroBytes32 };
    expect(() => parseDeploymentManifest(candidate)).toThrow('Bytes32 value must be nonzero');

    candidate.transactions = {};
    candidate.deployedContracts = [deployedRecord({ transactionHash: zeroBytes32 })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('Bytes32 value must be nonzero');

    candidate.deployedContracts = [deployedRecord({ blockNumber: '0' })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('Block number must be positive');

    candidate.deployedContracts = [];
    candidate.externalContracts = [externalRecord({ verifiedAtBlock: '0' })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('Block number must be positive');
  });

  it('requires verified deployments to carry a verification URL', () => {
    const candidate = structuredClone(draftFixture);
    candidate.deployedContracts = [deployedRecord({ verificationStatus: 'verified' })];
    expect(() => parseDeploymentManifest(candidate)).toThrow('require a verification URL');
  });

  it('rejects zero role holders, eligibility modules, and authorized signers', () => {
    const candidate = structuredClone(draftFixture);
    (candidate.roles as Record<string, unknown>).deployer = zeroAddress;
    expect(() => parseDeploymentManifest(candidate)).toThrow('Address must be nonzero');

    (candidate.roles as Record<string, unknown>).deployer = address(1);
    (candidate.compliance as Record<string, unknown>).eligibilityModule = zeroAddress;
    expect(() => parseDeploymentManifest(candidate)).toThrow('Address must be nonzero');

    (candidate.compliance as Record<string, unknown>).eligibilityModule = null;
    candidate.signaturePolicy = { authorizedSigners: [zeroAddress], policyId: testPolicyId, threshold: 1 };
    expect(() => parseDeploymentManifest(candidate)).toThrow('Address must be nonzero');
  });

  it('requires release metadata and USDG proxy authority evidence to be resolved', () => {
    const candidate = structuredClone(draftFixture);
    (candidate.release as Record<string, unknown>).status = 'release-approved';
    expect(() => parseDeploymentManifest(candidate)).toThrow('nonzero git commit');
    expect(() => parseDeploymentManifest(candidate)).toThrow('resolved archive RPC provider');
    expect(() => parseDeploymentManifest(candidate)).toThrow('USDG Ownable UUPS implementation');
  });

  it('accepts complete typed USDG UUPS proxy evidence in a draft', () => {
    const candidate = structuredClone(draftFixture);
    candidate.assets = [
      assetRecord({
        proxyEvidence: {
          adminSlotValue: zeroBytes32,
          implementationAddress: address(0x401),
          implementationRuntimeBytecodeHash: hash('5'),
          kind: 'eip1967-uups',
          upgradeAuthorityAddress: address(0x402),
          upgradeAuthorityRuntimeBytecodeHash: hash('6'),
          verifiedAtBlock: '25010482',
        },
      }),
    ];
    expect(parseDeploymentManifest(candidate).assets[0]?.proxyEvidence).toMatchObject({ kind: 'eip1967-uups' });
  });

  it('requires exact WETH transparent-proxy control-plane evidence for release', () => {
    const missing = unsignedReleaseFixture();
    const weth = missing.assets.find(({ key }) => key === 'WETH')!;
    delete weth.proxyEvidence;
    expect(() => parseDeploymentManifest(missing)).toThrow('WETH transparent-proxy implementation');

    const missingOwnerImplementation = unsignedReleaseFixture();
    const wethEvidence = missingOwnerImplementation.assets.find(({ key }) => key === 'WETH')!.proxyEvidence as Record<
      string,
      unknown
    >;
    wethEvidence.adminOwnerProxyEvidence = null;
    expect(() => parseDeploymentManifest(missingOwnerImplementation)).toThrow(
      'WETH ProxyAdmin-owner proxy implementation',
    );
  });

  it('requires exact beacon and implementation evidence for every release stock token', () => {
    const missing = unsignedReleaseFixture();
    delete missing.assets.find(({ key }) => key === 'QQQ')!.proxyEvidence;
    expect(() => parseDeploymentManifest(missing)).toThrow('QQQ beacon/implementation evidence');
  });

  it('cryptographically validates a complete release fixture against an explicit trusted policy', async () => {
    const manifest = await validateWithTrustedPolicy(await signReleaseFixture(unsignedReleaseFixture()));
    expect(manifest.release.status).toBe('release-approved');
    expect(manifest.deployedContracts).toHaveLength(requiredReleaseProtocolContractNames.length);
    expect(manifest.signatures).toHaveLength(5);
  });

  it('cryptographically validates the exact schema-v2 permissioned successor graph and evidence descriptors', async () => {
    const manifest = await validateWithTrustedPolicy(await signReleaseFixture(unsignedPermissionedV2ReleaseFixture()));
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.compliance.mode).toBe('permissioned-production');
    expect(manifest.deployedContracts).toHaveLength(requiredPermissionedV2ReleaseProtocolContractNames.length);
    expect(manifest.releaseEvidence?.permissionedPool).toBeDefined();
  });

  it('keeps schema v2 fail-closed without all three distinct permissioned evidence descriptors', () => {
    const missing = unsignedPermissionedV2ReleaseFixture();
    delete missing.releaseEvidence!.permissionedPool;
    expect(() => parseDeploymentManifest(missing)).toThrow(/requires graph, official-source build/);

    const duplicate = unsignedPermissionedV2ReleaseFixture();
    duplicate.releaseEvidence!.permissionedPool!.officialSourceBuild = {
      ...duplicate.releaseEvidence!.permissionedPool!.graph,
    };
    expect(() => parseDeploymentManifest(duplicate)).toThrow(/paths must be distinct/);
  });

  it('enforces a short signed observation interval and exact observation blocks', () => {
    const tooLong = unsignedReleaseFixture();
    tooLong.releaseEvidence!.observation.expiresAt = '2026-08-02T00:00:01Z';
    expect(() => parseDeploymentManifest(tooLong)).toThrow('no longer than 24 hours');

    const mismatchedBlock = unsignedReleaseFixture();
    mismatchedBlock.externalContracts[0]!.verifiedAtBlock = '25029999';
    expect(() => parseDeploymentManifest(mismatchedBlock)).toThrow('signed observation block');
  });

  it('binds emergency-guardian Safe evidence to the release network, block, role, and distinct address', () => {
    const wrongNetwork = unsignedReleaseFixture();
    wrongNetwork.releaseEvidence!.emergencyGuardianSafe.network = {
      chainId: 46_630,
      name: 'Robinhood Chain Testnet',
    };
    expect(() => parseDeploymentManifest(wrongNetwork)).toThrow('evidence network must match');

    const wrongBlock = unsignedReleaseFixture();
    (wrongBlock.releaseEvidence!.emergencyGuardianSafe.block as Record<string, unknown>).hash = indexedHash(0x9999);
    expect(() => parseDeploymentManifest(wrongBlock)).toThrow('Emergency-guardian Safe evidence must use');

    const wrongRole = unsignedReleaseFixture();
    wrongRole.roles.emergencyGuardianMultisig = address(0x4999);
    expect(() => parseDeploymentManifest(wrongRole)).toThrow('must match the guardian multisig');

    const sharedAddress = unsignedReleaseFixture();
    sharedAddress.releaseEvidence!.emergencyGuardianSafe.safeAddress =
      sharedAddress.releaseEvidence!.protocolAdminSafe.safeAddress;
    sharedAddress.roles.emergencyGuardianMultisig = sharedAddress.roles.protocolTimelockMultisig;
    expect(() => parseDeploymentManifest(sharedAddress)).toThrow('Safe evidence must be distinct');
  });

  it('checks release-evidence future timestamps and expiry only at authorization time', async () => {
    const candidate = parseDeploymentManifest(await signReleaseFixture(unsignedReleaseFixture()));
    expect(() => assertFreshReleaseEvidence(candidate, Date.parse('2026-08-01T01:00:00Z'))).not.toThrow();
    expect(() => assertFreshReleaseEvidence(candidate, Date.parse('2026-08-01T13:00:00Z'))).toThrow('expired');

    const future = unsignedReleaseFixture();
    future.release.createdAt = '2026-08-01T01:00:00Z';
    future.releaseEvidence!.observation.observedAt = '2026-08-01T01:00:00Z';
    future.releaseEvidence!.observation.expiresAt = '2026-08-01T02:00:00Z';
    const futureManifest = parseDeploymentManifest(await signReleaseFixture(future));
    expect(() => assertFreshReleaseEvidence(futureManifest, Date.parse('2026-08-01T00:30:00Z'))).toThrow(
      'createdAt must not be in the future',
    );
  });

  it('rejects a one-field mutation after the positive fixture is signed', async () => {
    const candidate = await signReleaseFixture(unsignedReleaseFixture());
    candidate.release.createdAt = '2026-08-01T00:00:01Z';
    await expect(validateWithTrustedPolicy(candidate)).rejects.toThrow('payload hash does not match');
  });

  it.each<{
    expected: string;
    label: string;
    mutate: (candidate: MutableReleaseFixture) => void;
  }>([
    {
      label: 'missing fixed contract',
      expected: 'exact complete fixed and per-asset protocol contract graph',
      mutate: (candidate) => {
        candidate.deployedContracts = candidate.deployedContracts.filter(
          (record: Record<string, unknown>) => record.name !== 'GumBallLens',
        );
      },
    },
    {
      label: 'orphaned constructor record',
      expected: 'exactly one linked constructor-parameter record',
      mutate: (candidate) => {
        candidate.constructorParameters.unlinked = { arguments: [], encodedArguments: '0x' };
      },
    },
    {
      label: 'logical instance source mismatch',
      expected: 'must identify source contract AcquisitionStrategy',
      mutate: (candidate) => {
        candidate.deployedContracts.find(
          (record: Record<string, unknown>) => record.name === 'AcquisitionStrategy:WETH',
        )!.contractName = 'ManagerRewards';
      },
    },
    {
      label: 'deployment transaction mismatch',
      expected: 'transaction hash does not match its linked transaction',
      mutate: (candidate) => {
        candidate.transactions['deploy:GBXToken'] = indexedHash(0xdead);
      },
    },
    {
      label: 'unlinked CREATE2 salt',
      expected: 'sole deployment linked to the sole CREATE2 salt',
      mutate: (candidate) => {
        candidate.deployedContracts.find(
          (record: Record<string, unknown>) => record.name === 'LaunchGuardHook',
        )!.create2SaltKey = null;
      },
    },
    {
      label: 'timelock role mismatch',
      expected: 'must match the recorded protocol-timelock role',
      mutate: (candidate) => {
        candidate.roles.protocolTimelock = address(0xdead);
      },
    },
    {
      label: 'guardian constructor mismatch',
      expected: 'constructor operator must match the recorded guardian multisig',
      mutate: (candidate) => {
        candidate.constructorParameters.EmergencyGuardian!.arguments[1] = address(0xdead);
      },
    },
    {
      label: 'per-asset strategy target mismatch',
      expected: 'AcquisitionStrategy:WETH constructor target must match its manifest asset',
      mutate: (candidate) => {
        candidate.constructorParameters['AcquisitionStrategy:WETH']!.arguments[0] = address(0xdead);
      },
    },
    {
      label: 'per-asset rewards strategy mismatch',
      expected: 'ManagerRewards:WETH constructor strategy must match its acquisition strategy',
      mutate: (candidate) => {
        candidate.constructorParameters['ManagerRewards:WETH']!.arguments[1] = address(0xdead);
      },
    },
    {
      label: 'incomplete GBX holder set',
      expected: 'complete GBX contract-holder set',
      mutate: (candidate) => {
        candidate.compliance.gbxContractHolders.pop();
      },
    },
    {
      label: 'permissioned mode on the initialization-only v1 hook graph',
      expected: 'cannot authorize permissioned production',
      mutate: (candidate) => {
        candidate.compliance.mode = 'permissioned-production';
        candidate.compliance.permissionedPoolArchitectureReviewed = true;
      },
    },
    {
      label: 'canonical token evidence mismatch',
      expected: 'WETH asset and canonical external-contract evidence must match',
      mutate: (candidate) => {
        candidate.externalContracts.find((record: Record<string, unknown>) => record.key === 'WETH')!.address =
          address(0xdead);
      },
    },
  ])('rejects a re-signed one-field semantic mutation: $label', async ({ expected, mutate }) => {
    const candidate = unsignedReleaseFixture();
    mutate(candidate);
    await expect(validateWithTrustedPolicy(await signReleaseFixture(candidate))).rejects.toThrow(expected);
  });
});
