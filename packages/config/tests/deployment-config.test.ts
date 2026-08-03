import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { robinhoodMainnetAssetManifest, robinhoodTestnetAssetManifest } from '../assets/robinhood.js';
import { robinhoodMainnetUniswapV4Manifest, robinhoodTestnetUniswapV4Manifest } from '../deployments/uniswap-v4.js';
import { assertAuthorizedDeploymentTarget, parseDeploymentConfigEnvelope } from '../schemas/deployment-config.js';
import { wrappedBtcBridgeDependencyFixture } from './fixtures/wrapped-btc-bridge-dependency.js';

const testnetAuthorization = { chainId: 46_630, name: 'Robinhood Chain Testnet' } as const;
const protocolAdminSafe = {
  enabledModules: [],
  fallbackHandler: '0x0000000000000000000000000000000000000000',
  guard: '0x0000000000000000000000000000000000000000',
  owners: ['0x0000000000000000000000000000000000000011', '0x0000000000000000000000000000000000000012'],
  proxyRuntimeBytecodeHash: `0x${'41'.repeat(32)}`,
  safeAddress: '0x0000000000000000000000000000000000000010',
  singletonAddress: '0x0000000000000000000000000000000000000013',
  singletonRuntimeBytecodeHash: `0x${'42'.repeat(32)}`,
  threshold: '2',
};
const emergencyGuardianSafe = {
  ...protocolAdminSafe,
  owners: ['0x0000000000000000000000000000000000000021', '0x0000000000000000000000000000000000000022'],
  safeAddress: '0x0000000000000000000000000000000000000020',
  singletonAddress: '0x0000000000000000000000000000000000000023',
};
const testnetConfig = {
  assetReview: null,
  canonicalTokenDependencies: null,
  emergencyGuardianSafe,
  kind: 'gumball-6900-deployment-config',
  network: testnetAuthorization,
  protocol: 'GUM BALL 6900',
  protocolAdminSafe,
  roles: {
    emergencyGuardianOperator: emergencyGuardianSafe.safeAddress,
    protocolTimelockMultisig: protocolAdminSafe.safeAddress,
  },
  schemaVersion: 1,
  stockTokenDependency: null,
  usdG: '0x0000000000000000000000000000000000000001',
  wrappedBtcBridgeDependency: null,
};

const mainnetStockTokenDependency = {
  beaconAddress: '0x0000000000000000000000000000000000000010',
  beaconRuntimeBytecodeHash: `0x${'11'.repeat(32)}`,
  implementationAddress: '0x0000000000000000000000000000000000000012',
  implementationRuntimeBytecodeHash: `0x${'13'.repeat(32)}`,
};

const mainnetCanonicalTokenDependencies = {
  usdG: {
    address: testnetConfig.usdG,
    proxyEvidence: {
      adminSlotValue: `0x${'00'.repeat(32)}`,
      implementationAddress: '0x0000000000000000000000000000000000000021',
      implementationRuntimeBytecodeHash: `0x${'21'.repeat(32)}`,
      kind: 'eip1967-uups',
      upgradeAuthorityAddress: '0x0000000000000000000000000000000000000022',
      upgradeAuthorityRuntimeBytecodeHash: `0x${'22'.repeat(32)}`,
    },
    runtimeBytecodeHash: `0x${'20'.repeat(32)}`,
  },
  weth: {
    address: '0x0000000000000000000000000000000000000030',
    proxyEvidence: {
      adminAddress: '0x0000000000000000000000000000000000000032',
      adminOwnerAddress: '0x0000000000000000000000000000000000000033',
      adminOwnerProxyEvidence: {
        adminSlotValue: `0x${'00'.repeat(32)}`,
        implementationAddress: '0x0000000000000000000000000000000000000034',
        implementationRuntimeBytecodeHash: `0x${'34'.repeat(32)}`,
      },
      adminOwnerRuntimeBytecodeHash: `0x${'33'.repeat(32)}`,
      adminRuntimeBytecodeHash: `0x${'32'.repeat(32)}`,
      adminSlotValue: `0x${'00'.repeat(12)}${'32'.padStart(40, '0')}`,
      implementationAddress: '0x0000000000000000000000000000000000000031',
      implementationRuntimeBytecodeHash: `0x${'31'.repeat(32)}`,
      kind: 'eip1967-transparent',
      proxyAdminInterface: 'oz-v4',
    },
    runtimeBytecodeHash: `0x${'30'.repeat(32)}`,
  },
} as const;

describe('deployment config target binding', () => {
  it('parses the versioned chain-bound envelope while leaving the full shape to the deployment runner', () => {
    expect(parseDeploymentConfigEnvelope(testnetConfig)).toMatchObject({
      kind: 'gumball-6900-deployment-config',
      network: testnetAuthorization,
      protocol: 'GUM BALL 6900',
      schemaVersion: 1,
    });
  });

  it('requires authorization and config to name the same exact network', () => {
    expect(() => assertAuthorizedDeploymentTarget(testnetAuthorization, testnetConfig)).not.toThrow();
    expect(() =>
      assertAuthorizedDeploymentTarget(testnetAuthorization, {
        ...testnetConfig,
        assetReview: {
          path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json',
          rawSha256: '1'.repeat(64),
        },
        canonicalTokenDependencies: mainnetCanonicalTokenDependencies,
        network: { chainId: 4_663, name: 'Robinhood Chain' },
        stockTokenDependency: mainnetStockTokenDependency,
        wrappedBtcBridgeDependency: wrappedBtcBridgeDependencyFixture(),
      }),
    ).toThrow('does not match authorization');
  });

  it('requires distinct role-bound Safe identities for every nonlocal deployment', () => {
    expect(() => parseDeploymentConfigEnvelope({ ...testnetConfig, emergencyGuardianSafe: null })).toThrow(
      'requires guardian Safe evidence',
    );
    expect(() =>
      parseDeploymentConfigEnvelope({
        ...testnetConfig,
        roles: { ...testnetConfig.roles, emergencyGuardianOperator: protocolAdminSafe.safeAddress },
      }),
    ).toThrow('must equal roles.emergencyGuardianOperator');
    expect(() =>
      parseDeploymentConfigEnvelope({
        ...testnetConfig,
        emergencyGuardianSafe: protocolAdminSafe,
        roles: { ...testnetConfig.roles, emergencyGuardianOperator: protocolAdminSafe.safeAddress },
      }),
    ).toThrow('must be distinct');
    expect(() =>
      parseDeploymentConfigEnvelope({
        ...testnetConfig,
        emergencyGuardianSafe,
        network: { chainId: 31_337, name: 'Hardhat Local Rehearsal' },
        protocolAdminSafe: null,
      }),
    ).toThrow('Local rehearsal cannot declare guardian Safe evidence');
  });

  it('makes the fixed testnet target reject both a mainnet authorization and mainnet config', () => {
    const mainnetAuthorization = { chainId: 4_663, name: 'Robinhood Chain' } as const;
    const mainnetConfig = {
      ...testnetConfig,
      assetReview: {
        path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json',
        rawSha256: '1'.repeat(64),
      },
      canonicalTokenDependencies: mainnetCanonicalTokenDependencies,
      network: mainnetAuthorization,
      stockTokenDependency: mainnetStockTokenDependency,
      wrappedBtcBridgeDependency: wrappedBtcBridgeDependencyFixture(),
    };
    expect(() => assertAuthorizedDeploymentTarget(mainnetAuthorization, mainnetConfig, 46_630)).toThrow(
      'requires chain 46630',
    );
    expect(() => assertAuthorizedDeploymentTarget(testnetAuthorization, mainnetConfig, 46_630)).toThrow(
      'does not match authorization',
    );
  });

  it('requires complete canonical-token dependencies only on Robinhood mainnet', () => {
    const mainnet = {
      ...testnetConfig,
      assetReview: {
        path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json',
        rawSha256: '1'.repeat(64),
      },
      network: { chainId: 4_663, name: 'Robinhood Chain' },
      stockTokenDependency: mainnetStockTokenDependency,
      wrappedBtcBridgeDependency: wrappedBtcBridgeDependencyFixture(),
    };
    expect(() => parseDeploymentConfigEnvelope(mainnet)).toThrow('requires canonical-token dependency evidence');
    expect(() =>
      parseDeploymentConfigEnvelope({
        ...testnetConfig,
        canonicalTokenDependencies: mainnetCanonicalTokenDependencies,
      }),
    ).toThrow('mainnet-only');
    expect(() =>
      parseDeploymentConfigEnvelope({
        ...mainnet,
        canonicalTokenDependencies: mainnetCanonicalTokenDependencies,
      }),
    ).not.toThrow();
  });

  it('requires a complete single-admin wrapped-BTC bridge authority graph only on mainnet', () => {
    const mainnet = {
      ...testnetConfig,
      assetReview: {
        path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json',
        rawSha256: '1'.repeat(64),
      },
      canonicalTokenDependencies: mainnetCanonicalTokenDependencies,
      network: { chainId: 4_663, name: 'Robinhood Chain' },
      stockTokenDependency: mainnetStockTokenDependency,
    };
    expect(() => parseDeploymentConfigEnvelope(mainnet)).toThrow('requires wrapped-BTC bridge dependency evidence');
    expect(() =>
      parseDeploymentConfigEnvelope({
        ...mainnet,
        wrappedBtcBridgeDependency: wrappedBtcBridgeDependencyFixture(),
      }),
    ).not.toThrow();
    expect(() =>
      parseDeploymentConfigEnvelope({
        ...mainnet,
        wrappedBtcBridgeDependency: {
          ...wrappedBtcBridgeDependencyFixture(),
          gateway: {
            ...wrappedBtcBridgeDependencyFixture().gateway,
            proxyAdminAddress: '0x00000000000000000000000000000000000000ff',
          },
        },
      }),
    ).toThrow('must be administered by sharedProxyAdmin.address');
    expect(() =>
      parseDeploymentConfigEnvelope({
        ...testnetConfig,
        wrappedBtcBridgeDependency: wrappedBtcBridgeDependencyFixture(),
      }),
    ).toThrow('mainnet-only');
  });
});

describe('provisional Robinhood testnet dependencies', () => {
  it('records official testnet USDG, WETH, and Permit2 without treating partial discovery as authorization', () => {
    expect(robinhoodMainnetAssetManifest.specificationAsOf).toBe('2026-08-02');
    expect(robinhoodMainnetUniswapV4Manifest.specificationAsOf).toBe('2026-08-01');
    expect(robinhoodTestnetAssetManifest.status).toBe('provisional');
    expect(robinhoodTestnetAssetManifest.specificationAsOf).toBe('2026-08-02');
    expect(robinhoodTestnetAssetManifest.canonicalTokens).toEqual([
      {
        key: 'WETH',
        address: '0x7943e237c7F95DA44E0301572D358911207852Fa',
        expectedSymbol: 'WETH',
        expectedDecimals: 18,
        role: 'wrapped-native',
      },
      {
        key: 'USDG',
        address: '0x7E955252E15c84f5768B83c41a71F9eba181802F',
        expectedSymbol: 'USDG',
        expectedDecimals: 6,
        role: 'quote-token',
      },
    ]);
    expect(robinhoodTestnetUniswapV4Manifest.status).toBe('unresolved');
    expect(robinhoodTestnetUniswapV4Manifest.specificationAsOf).toBe('2026-08-02');
    expect(robinhoodTestnetUniswapV4Manifest.addresses).toEqual({
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    });
  });

  it('keeps the exact-block mainnet wrapped-BTC candidate provisional and never carries it into testnet', () => {
    expect(
      robinhoodTestnetAssetManifest.deploymentResolvedAssets.every(
        (asset) => !('provisionalRegistryCandidate' in asset),
      ),
    ).toBe(true);
    expect(
      robinhoodMainnetAssetManifest.deploymentResolvedAssets
        .filter((asset) => asset.key !== 'WRAPPED_BTC')
        .every((asset) => asset.provisionalRegistryCandidate !== undefined),
    ).toBe(true);
    const mainnetWrappedBtc = robinhoodMainnetAssetManifest.deploymentResolvedAssets.find(
      (asset) => asset.key === 'WRAPPED_BTC',
    );
    expect(mainnetWrappedBtc?.provisionalBridgeCandidate).toMatchObject({
      address: '0x6bac06600D220Ac5Ac281AD1f504D2Cf0F90F6e6',
      expectedDecimals: 8,
      expectedSymbol: 'WBTC',
      l2GatewayImplementation: '0xdf988cF6D83ebd578f6801820d01FEe7280886d6',
      l2GatewayRouterImplementation: '0x030c64a359Be400AF05F9230A6F65F30537cdd12',
      observedBlock: '26198585',
      proxyAdmin: '0xa3Acd31AFb851B4eB9DAD00F5204c01D924267dF',
      proxyAdminOwner: '0x2A153c6A1B66DBc930a8d7017230ab0253005C09',
    });
    const candidateReference = mainnetWrappedBtc?.provisionalBridgeCandidate;
    expect(candidateReference).toBeDefined();
    const candidateBytes = readFileSync(new URL(`../../../${candidateReference!.candidatePath}`, import.meta.url));
    expect(createHash('sha256').update(candidateBytes).digest('hex')).toBe(candidateReference!.rawSha256);
    const candidate = JSON.parse(candidateBytes.toString('utf8')) as {
      bridge: {
        controlPlane: {
          gatewayProxy: { implementationAddress: string; kind: string };
          gatewayRouterProxy: { implementationAddress: string; kind: string };
          sharedProxyAdmin: {
            address: string;
            owner: { address: string; proxy: { implementationAddress: string; kind: string } };
          };
        };
        l1Token: string;
        l2Gateway: string;
        l2GatewayRouter: string;
        l2GatewayRuntimeBytecodeHash: string;
        l2GatewayRouterRuntimeBytecodeHash: string;
      };
      deploymentApproved: boolean;
      observation: { blockNumber: string };
      status: string;
      token: { address: string; decimals: number; symbol: string };
      validations: Record<string, boolean>;
    };
    expect(candidate).toMatchObject({
      bridge: {
        controlPlane: {
          gatewayProxy: {
            implementationAddress: candidateReference!.l2GatewayImplementation,
            kind: 'eip1967-transparent',
          },
          gatewayRouterProxy: {
            implementationAddress: candidateReference!.l2GatewayRouterImplementation,
            kind: 'eip1967-transparent',
          },
          sharedProxyAdmin: {
            address: candidateReference!.proxyAdmin,
            owner: {
              address: candidateReference!.proxyAdminOwner,
              proxy: {
                implementationAddress: candidateReference!.proxyAdminOwnerImplementation,
                kind: 'eip1967-transparent',
              },
            },
          },
        },
        l1Token: candidateReference!.l1Token,
        l2Gateway: candidateReference!.l2Gateway,
        l2GatewayRouter: candidateReference!.l2GatewayRouter,
      },
      deploymentApproved: false,
      observation: { blockNumber: candidateReference!.observedBlock },
      status: 'provisional',
      token: {
        address: candidateReference!.address,
        decimals: candidateReference!.expectedDecimals,
        symbol: candidateReference!.expectedSymbol,
      },
    });
    expect(candidate.bridge.l2GatewayRuntimeBytecodeHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(candidate.bridge.l2GatewayRouterRuntimeBytecodeHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(Object.values(candidate.validations).every(Boolean)).toBe(true);
    const wrappedBtc = robinhoodTestnetAssetManifest.deploymentResolvedAssets.find(
      (asset) => asset.key === 'WRAPPED_BTC',
    );
    expect(wrappedBtc).not.toHaveProperty('expectedDecimals');
    expect(wrappedBtc).not.toHaveProperty('provisionalBridgeCandidate');
  });
});
