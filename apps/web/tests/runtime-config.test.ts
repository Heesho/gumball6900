import {
  releaseManifestSignaturePolicyConfiguration,
  robinhoodMainnetAssetManifest,
  robinhoodTestnetAssetManifest,
  robinhoodTestnetUniswapV4Manifest,
  type DeploymentManifest,
} from '@gumball-6900/config';
import { describe, expect, it, vi } from 'vitest';

import draftManifest from '../../../packages/config/tests/fixtures/deployment-manifest.draft.json';
import { resolveRuntimeDeployment } from '../lib/runtime-config';
import { liveRuntimeFixture } from './live-runtime-fixture';

function approvedRuntimeManifest(): DeploymentManifest {
  const usdG = robinhoodMainnetAssetManifest.canonicalTokens.find(({ key }) => key === 'USDG')!;
  const weth = robinhoodMainnetAssetManifest.canonicalTokens.find(({ key }) => key === 'WETH')!;
  const assets = [
    { key: 'USDG', address: usdG.address, decimals: usdG.expectedDecimals, uid: null },
    { key: 'WETH', address: weth.address, decimals: weth.expectedDecimals, uid: null },
    { key: 'WRAPPED_BTC', address: liveRuntimeFixture.assets.WBTC, decimals: 8, uid: null },
    ...(['QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL'] as const).map((key, index) => ({
      key,
      address: liveRuntimeFixture.assets[key],
      decimals: 18,
      uid: `0x${(index + 1).toString(16).padStart(64, '0')}`,
    })),
  ].map((asset) => ({
    ...asset,
    acquisitionEnabled: true,
    redemptionEnabled: true,
    registryStatus: asset.uid === null ? ('NOT_APPLICABLE' as const) : ('ASSET_STATUS_ACTIVE' as const),
    runtimeBytecodeHash: `0x${'11'.repeat(32)}`,
  }));
  const fixedDeployments = [
    ['ProtocolTimelock', liveRuntimeFixture.addresses.protocolTimelock],
    ['StrategyDeployer', liveRuntimeFixture.addresses.strategyDeployer],
    ['EmergencyGuardian', liveRuntimeFixture.addresses.emergencyGuardian],
    ['EligibilityModule', liveRuntimeFixture.addresses.eligibilityModule],
    ['GBXToken', liveRuntimeFixture.addresses.gbx],
    ['EmissionController', liveRuntimeFixture.addresses.emissionController],
    ['GenesisClaims', liveRuntimeFixture.addresses.genesisClaims],
    ['MiningClaims', liveRuntimeFixture.addresses.miningClaims],
    ['AssetRegistry', liveRuntimeFixture.addresses.assetRegistry],
    ['AllocationVoter', liveRuntimeFixture.addresses.allocationVoter],
    ['GumBallVault', liveRuntimeFixture.addresses.gumBallVault],
    ['StakedGBX', liveRuntimeFixture.addresses.stakedGBX],
    ['GumBallRouter', liveRuntimeFixture.addresses.gumBallRouter],
    ['MiningPool', liveRuntimeFixture.addresses.miningPool],
    ['GenesisBootstrap', liveRuntimeFixture.addresses.genesisBootstrap],
    ['RevenueRouter', liveRuntimeFixture.addresses.revenueRouter],
    ['HoldUSDGStrategy', liveRuntimeFixture.addresses.holdUSDGStrategy],
    ['BuybackBurnStrategy', liveRuntimeFixture.addresses.buybackBurnStrategy],
    ['LaunchGuardHook', liveRuntimeFixture.addresses.launchGuardHook],
    ['GenesisLiquidityCalculator', liveRuntimeFixture.addresses.genesisLiquidityCalculator],
    ['LiquidityManager', liveRuntimeFixture.addresses.liquidityManager],
    ['GumBallLens', liveRuntimeFixture.addresses.gumBallLens],
  ] as const;
  const assetManifestKeys = {
    WETH: 'WETH',
    WBTC: 'WRAPPED_BTC',
    QQQ: 'QQQ',
    TSLA: 'TSLA',
    SPCX: 'SPCX',
    NVDA: 'NVDA',
    AAPL: 'AAPL',
  } as const;
  const deployedContracts = [
    ...fixedDeployments.map(([name, address]) => ({ name, address })),
    ...Object.entries(assetManifestKeys).flatMap(([symbol, manifestKey]) => [
      {
        name: `AcquisitionStrategy:${manifestKey}`,
        address: liveRuntimeFixture.strategies[symbol as keyof typeof assetManifestKeys],
      },
      {
        name: `ManagerRewards:${manifestKey}`,
        address: liveRuntimeFixture.rewards[symbol as keyof typeof assetManifestKeys],
      },
    ]),
  ].map(({ name, address }, index) => ({
    address,
    blockNumber: (index + 1).toString(),
    name,
    runtimeBytecodeHash: `0x${'22'.repeat(32)}`,
    transactionHash: `0x${'33'.repeat(32)}`,
    verificationStatus: 'verified' as const,
    verificationUrl: 'https://explorer.example/verified',
  }));
  const externalContracts = Object.entries(liveRuntimeFixture.externalContracts).map(([key, contract]) => ({
    ...contract,
    key: `uniswapV4.${key}`,
    runtimeBytecodeHash: `0x${'44'.repeat(32)}`,
  }));
  return {
    assets,
    compliance: { mode: 'permissioned-production' },
    deployedContracts,
    externalContracts,
    network: { chainId: 4663 },
    release: {
      gitCommit: 'a'.repeat(40),
      status: 'release-approved',
      version: 'v1.0.0',
    },
    roles: {
      emergencyGuardianMultisig: liveRuntimeFixture.admin.guardianOperator,
      protocolTimelock: liveRuntimeFixture.admin.protocolTimelock,
      protocolTimelockMultisig: liveRuntimeFixture.admin.protocolTimelockProposer,
    },
    signaturePolicy: { policyId: `0x${'aa'.repeat(32)}`, threshold: 2 },
    signatures: [{}, {}],
  } as unknown as DeploymentManifest;
}

function rehearsalRuntimeManifest(): DeploymentManifest {
  const manifest = structuredClone(approvedRuntimeManifest());
  manifest.network.chainId = 46630;
  manifest.release.status = 'testnet-candidate';
  manifest.compliance.mode = 'noop-testnet';
  manifest.signaturePolicy = { authorizedSigners: [], policyId: `0x${'00'.repeat(32)}`, threshold: 0 };
  manifest.signatures = [];
  return manifest;
}

function testnetCandidateRuntimeManifest(): DeploymentManifest {
  const manifest = structuredClone(approvedRuntimeManifest());
  manifest.network.chainId = 46630;
  manifest.release.status = 'testnet-candidate';
  manifest.compliance.mode = 'noop-testnet';
  for (const token of robinhoodTestnetAssetManifest.canonicalTokens) {
    const asset = manifest.assets.find(({ key }) => key === token.key);
    if (asset === undefined) throw new Error(`Missing test fixture asset ${token.key}`);
    asset.address = token.address;
    asset.decimals = token.expectedDecimals;
  }
  const permit2 = manifest.externalContracts.find(({ key }) => key === 'uniswapV4.permit2');
  const canonicalPermit2 = robinhoodTestnetUniswapV4Manifest.addresses.permit2;
  if (permit2 === undefined || canonicalPermit2 === undefined) throw new Error('Missing test fixture Permit2');
  permit2.address = canonicalPermit2;
  return manifest;
}

function rehearsalEnvironment(overrides: Record<string, string> = {}) {
  return {
    NODE_ENV: 'development',
    GUMBALL_CLIENT_MODE: 'rehearsal',
    GUMBALL_CHAIN_ID: '46630',
    GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
    GUMBALL_PROTOCOL_ADDRESSES_JSON: JSON.stringify(liveRuntimeFixture.addresses),
    GUMBALL_REWARDS_JSON: JSON.stringify(liveRuntimeFixture.rewards),
    GUMBALL_RPC_URL: 'http://127.0.0.1:18546',
    GUMBALL_RPC_FALLBACK_URLS_JSON: '[]',
    GUMBALL_STRATEGIES_JSON: JSON.stringify(liveRuntimeFixture.strategies),
    GUMBALL_SUBGRAPH_URL: 'http://localhost:18547/graphql',
    ...overrides,
  };
}

function testnetEnvironment(overrides: Record<string, string> = {}) {
  return {
    NODE_ENV: 'production',
    GUMBALL_CLIENT_MODE: 'testnet',
    GUMBALL_CHAIN_ID: '46630',
    GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
    GUMBALL_PROTOCOL_ADDRESSES_JSON: JSON.stringify(liveRuntimeFixture.addresses),
    GUMBALL_REWARDS_JSON: JSON.stringify(liveRuntimeFixture.rewards),
    GUMBALL_RPC_URL: 'https://testnet-archive.example/rpc',
    GUMBALL_RPC_FALLBACK_URLS_JSON: '["https://testnet-fallback.example/rpc"]',
    GUMBALL_STRATEGIES_JSON: JSON.stringify(liveRuntimeFixture.strategies),
    GUMBALL_SUBGRAPH_URL: 'https://testnet-subgraph.example/graphql',
    ...overrides,
  };
}

describe('runtime deployment validation', () => {
  it('fails closed into an explicit demo fallback when live environment is absent', async () => {
    const runtime = await resolveRuntimeDeployment({});
    expect(runtime.mode).toBe('demo');
    expect(runtime.fallbackReason).toBe('missing-live-configuration');
    expect(runtime.addresses).toBeNull();
    expect(runtime.issues.join(' ')).toContain('writes are disabled');
  });

  it('honors an explicit demo selection without accepting write addresses', async () => {
    const runtime = await resolveRuntimeDeployment({
      GUMBALL_CLIENT_MODE: 'demo',
      GUMBALL_PROTOCOL_ADDRESSES_JSON: JSON.stringify({ gbx: '0x1111111111111111111111111111111111111111' }),
    });
    expect(runtime.mode).toBe('demo');
    expect(runtime.fallbackReason).toBe('explicit-demo');
    expect(runtime.addresses).toBeNull();
  });

  it('rejects an incomplete live configuration and reports every required boundary', async () => {
    const runtime = await resolveRuntimeDeployment({
      GUMBALL_CLIENT_MODE: 'live',
      GUMBALL_CHAIN_ID: '4663',
      GUMBALL_RPC_URL: 'https://rpc.mainnet.chain.robinhood.com',
      GUMBALL_PROTOCOL_ADDRESSES_JSON: '{}',
      GUMBALL_STRATEGIES_JSON: '{}',
      GUMBALL_REWARDS_JSON: '{}',
      GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
    });
    expect(runtime.mode).toBe('demo');
    expect(runtime.fallbackReason).toBe('invalid-live-configuration');
    expect(runtime.issues).toContain('Live mode requires a production RPC endpoint, not the rate-limited public RPC.');
    expect(runtime.issues).toContain('GUMBALL_PROTOCOL_ADDRESSES_JSON does not match the SDK protocol address schema.');
    expect(runtime.issues).toContain('GUMBALL_DEPLOYMENT_MANIFEST_JSON failed signed-manifest schema validation.');
    expect(runtime.issues).toContain('GUMBALL_RPC_FALLBACK_URLS_JSON requires at least one fallback in live mode.');
  });

  it('cryptographically rejects unauthorized or non-quorum manifests before live mode', async () => {
    const runtime = await resolveRuntimeDeployment(
      {
        GUMBALL_CLIENT_MODE: 'live',
        GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
      },
      async () => {
        throw new Error('Recovered signer is not authorized by policy');
      },
    );
    expect(runtime.mode).toBe('demo');
    expect(runtime.fallbackReason).toBe('invalid-live-configuration');
    expect(runtime.issues.join(' ')).toContain('not authorized by policy');
    expect(runtime.externalContracts).toBeNull();
  });

  it('keeps a structurally valid but unsigned draft manifest out of live mode', async () => {
    const runtime = await resolveRuntimeDeployment({
      GUMBALL_CLIENT_MODE: 'live',
      GUMBALL_CHAIN_ID: '4663',
      GUMBALL_DEPLOYMENT_MANIFEST_JSON: JSON.stringify(draftManifest),
    });

    expect(runtime.mode).toBe('demo');
    expect(runtime.fallbackReason).toBe('invalid-live-configuration');
    expect(runtime.issues).toContain('The deployment manifest must have release-approved status.');
    expect(runtime.manifest).toBeNull();
    expect(runtime.externalContracts).toBeNull();
  });

  it('rejects plaintext remote RPC and subgraph transports', async () => {
    const runtime = await resolveRuntimeDeployment({
      GUMBALL_CLIENT_MODE: 'live',
      GUMBALL_RPC_URL: 'http://rpc.example/rpc',
      GUMBALL_SUBGRAPH_URL: 'http://subgraph.example/graphql',
    });
    expect(runtime.mode).toBe('demo');
    expect(runtime.issues).toContain('GUMBALL_RPC_URL must use HTTPS, except in explicit local rehearsal mode.');
    expect(runtime.issues).toContain('GUMBALL_SUBGRAPH_URL must use HTTPS, except in explicit local rehearsal mode.');
  });

  it('reserves loopback RPC and subgraph endpoints for explicit rehearsal mode', async () => {
    const manifest = approvedRuntimeManifest();
    const runtime = await resolveRuntimeDeployment(
      {
        GUMBALL_CLIENT_MODE: 'live',
        GUMBALL_CHAIN_ID: '4663',
        GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
        GUMBALL_PROTOCOL_ADDRESSES_JSON: JSON.stringify(liveRuntimeFixture.addresses),
        GUMBALL_REWARDS_JSON: JSON.stringify(liveRuntimeFixture.rewards),
        GUMBALL_RPC_URL: 'https://127.0.0.2:18546',
        GUMBALL_STRATEGIES_JSON: JSON.stringify(liveRuntimeFixture.strategies),
        GUMBALL_SUBGRAPH_URL: 'https://[::1]:18547/graphql',
        NODE_ENV: 'production',
      },
      async () => manifest,
    );

    expect(runtime.mode).toBe('demo');
    expect(runtime.issues).toContain(
      'GUMBALL_RPC_URL must be a remote HTTPS endpoint in live mode; localhost is reserved for rehearsal.',
    );
    expect(runtime.issues).toContain(
      'GUMBALL_SUBGRAPH_URL must be a remote HTTPS endpoint in live mode; localhost is reserved for rehearsal.',
    );
  });

  it('awaits signature verification and fails closed when asynchronous validation rejects', async () => {
    let rejectValidation: ((reason: Error) => void) | undefined;
    const validation = new Promise<never>((_resolve, reject) => {
      rejectValidation = reject;
    });
    let settled = false;
    const runtimePromise = resolveRuntimeDeployment(
      {
        GUMBALL_CLIENT_MODE: 'live',
        GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
      },
      () => validation,
    ).then((runtime) => {
      settled = true;
      return runtime;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    rejectValidation!(new Error('signature quorum unavailable'));
    const runtime = await runtimePromise;
    expect(runtime.mode).toBe('demo');
    expect(runtime.issues.join(' ')).toContain('signature quorum unavailable');
    expect(runtime.addresses).toBeNull();
  });

  it('extracts decimal, external-contract, and role metadata only after async approval', async () => {
    const manifest = approvedRuntimeManifest();
    const manifestValidator = vi.fn(async () => manifest);
    const runtime = await resolveRuntimeDeployment(
      {
        GUMBALL_CLIENT_MODE: 'live',
        GUMBALL_CHAIN_ID: '4663',
        GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
        GUMBALL_PROTOCOL_ADDRESSES_JSON: JSON.stringify(liveRuntimeFixture.addresses),
        GUMBALL_REWARDS_JSON: JSON.stringify(liveRuntimeFixture.rewards),
        GUMBALL_RPC_URL: 'https://archive.example/rpc',
        GUMBALL_RPC_FALLBACK_URLS_JSON: '["https://fallback.example/rpc"]',
        GUMBALL_STRATEGIES_JSON: JSON.stringify(liveRuntimeFixture.strategies),
        GUMBALL_SUBGRAPH_URL: 'https://subgraph.example/graphql',
      },
      manifestValidator,
    );

    expect(runtime.mode).toBe('live');
    if (runtime.mode !== 'live') throw new Error(runtime.issues.join(' '));
    expect(runtime.chain.fallbackRpcUrls).toEqual(['https://fallback.example/rpc']);
    expect(runtime.assetMetadata.USDG.decimals).toBe(6);
    expect(runtime.assetMetadata.WBTC.decimals).toBe(8);
    expect(runtime.assetMetadata.NVDA.uid).not.toBeNull();
    expect(runtime.externalContracts.quoter.address).toBe(liveRuntimeFixture.externalContracts.quoter.address);
    expect(runtime.admin.guardianOperator).toBe(liveRuntimeFixture.admin.guardianOperator);
    expect(runtime.manifest.miningPoolDeploymentBlock).toBe(
      manifest.deployedContracts.find(({ name }) => name === 'MiningPool')?.blockNumber,
    );
    expect(runtime.manifest.signatureCount).toBe(2);
    expect(runtime.manifest.signatureThreshold).toBe(2);
    expect(manifestValidator).toHaveBeenCalledWith({}, releaseManifestSignaturePolicyConfiguration);
  });

  it('rejects duplicate, cleartext, local, and unbounded production fallback RPC lists', async () => {
    const manifest = approvedRuntimeManifest();
    const base = {
      GUMBALL_CLIENT_MODE: 'live',
      GUMBALL_CHAIN_ID: '4663',
      GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
      GUMBALL_PROTOCOL_ADDRESSES_JSON: JSON.stringify(liveRuntimeFixture.addresses),
      GUMBALL_REWARDS_JSON: JSON.stringify(liveRuntimeFixture.rewards),
      GUMBALL_RPC_URL: 'https://archive.example/rpc',
      GUMBALL_STRATEGIES_JSON: JSON.stringify(liveRuntimeFixture.strategies),
      GUMBALL_SUBGRAPH_URL: 'https://subgraph.example/graphql',
    };
    const duplicate = await resolveRuntimeDeployment(
      { ...base, GUMBALL_RPC_FALLBACK_URLS_JSON: '["https://archive.example/rpc"]' },
      async () => manifest,
    );
    expect(duplicate.mode).toBe('demo');
    expect(duplicate.issues).toContain('Primary and fallback RPC endpoints must be unique.');

    const invalid = await resolveRuntimeDeployment(
      {
        ...base,
        GUMBALL_RPC_FALLBACK_URLS_JSON:
          '["http://fallback.example/rpc","https://127.0.0.1:8545/rpc","https://a.example","https://b.example","https://c.example"]',
      },
      async () => manifest,
    );
    expect(invalid.mode).toBe('demo');
    expect(invalid.issues).toContain('GUMBALL_RPC_FALLBACK_URLS_JSON supports at most four fallback endpoints.');
  });

  it('enables an explicitly labeled localhost-only testnet-candidate rehearsal outside production', async () => {
    const manifest = rehearsalRuntimeManifest();
    const runtime = await resolveRuntimeDeployment(rehearsalEnvironment(), async () => manifest);

    expect(runtime.mode).toBe('live');
    if (runtime.mode !== 'live') throw new Error(runtime.issues.join(' '));
    expect(runtime.runtimeKind).toBe('local-rehearsal');
    expect(runtime.chain.id).toBe(46630);
    expect(runtime.chain.rpcUrl).toBe('http://127.0.0.1:18546');
    expect(runtime.chain.fallbackRpcUrls).toEqual([]);
    expect(runtime.manifest.status).toBe('testnet-candidate');
  });

  it('enables an explicit remote testnet candidate with canonical token and Permit2 bindings', async () => {
    const manifest = testnetCandidateRuntimeManifest();
    const manifestValidator = vi.fn(async () => manifest);
    const runtime = await resolveRuntimeDeployment(testnetEnvironment(), manifestValidator);

    expect(runtime.mode).toBe('live');
    if (runtime.mode !== 'live') throw new Error(runtime.issues.join(' '));
    expect(runtime.runtimeKind).toBe('testnet-candidate');
    expect(runtime.chain.id).toBe(46630);
    expect(runtime.chain.environment).toBe('testnet');
    expect(runtime.manifest.status).toBe('testnet-candidate');
    expect(runtime.assets.USDG).toBe(
      robinhoodTestnetAssetManifest.canonicalTokens.find(({ key }) => key === 'USDG')?.address,
    );
    expect(runtime.assets.WETH).toBe(
      robinhoodTestnetAssetManifest.canonicalTokens.find(({ key }) => key === 'WETH')?.address,
    );
    expect(runtime.externalContracts.permit2.address).toBe(robinhoodTestnetUniswapV4Manifest.addresses.permit2);
    expect(manifestValidator).toHaveBeenCalledWith({}, releaseManifestSignaturePolicyConfiguration);
  });

  it('rejects testnet candidates with mainnet token substitution or a noncanonical Permit2', async () => {
    const mainnetTokens = testnetCandidateRuntimeManifest();
    for (const token of robinhoodMainnetAssetManifest.canonicalTokens) {
      const asset = mainnetTokens.assets.find(({ key }) => key === token.key)!;
      asset.address = token.address;
    }
    const tokenMismatch = await resolveRuntimeDeployment(testnetEnvironment(), async () => mainnetTokens);
    expect(tokenMismatch.mode).toBe('demo');
    expect(tokenMismatch.fallbackReason).toBe('invalid-testnet-configuration');
    expect(tokenMismatch.issues).toContain('Signed-manifest USDG does not match the canonical config address.');
    expect(tokenMismatch.issues).toContain('Signed-manifest WETH does not match the canonical config address.');

    const wrongPermit2 = testnetCandidateRuntimeManifest();
    wrongPermit2.externalContracts.find(({ key }) => key === 'uniswapV4.permit2')!.address =
      '0x0000000000000000000000000000000000000066';
    const permit2Mismatch = await resolveRuntimeDeployment(testnetEnvironment(), async () => wrongPermit2);
    expect(permit2Mismatch.mode).toBe('demo');
    expect(permit2Mismatch.issues).toContain(
      'Signed external contract uniswapV4.permit2 does not match canonical testnet config.',
    );
  });

  it('keeps remote testnet mode chain-bound, HTTPS-only, nonlocal, and status-specific', async () => {
    const manifest = testnetCandidateRuntimeManifest();
    const wrongChain = await resolveRuntimeDeployment(
      testnetEnvironment({ GUMBALL_CHAIN_ID: '4663' }),
      async () => manifest,
    );
    expect(wrongChain.mode).toBe('demo');
    expect(wrongChain.issues).toContain('Remote testnet mode is restricted to Robinhood Chain testnet chain ID 46630.');

    const localTransport = await resolveRuntimeDeployment(
      testnetEnvironment({
        GUMBALL_RPC_URL: 'https://127.0.0.1:8545/rpc',
        GUMBALL_SUBGRAPH_URL: 'https://localhost:8000/graphql',
      }),
      async () => manifest,
    );
    expect(localTransport.mode).toBe('demo');
    expect(localTransport.issues).toContain(
      'GUMBALL_RPC_URL must be a remote HTTPS endpoint in testnet mode; localhost is reserved for rehearsal.',
    );
    expect(localTransport.issues).toContain(
      'GUMBALL_SUBGRAPH_URL must be a remote HTTPS endpoint in testnet mode; localhost is reserved for rehearsal.',
    );

    const wrongStatus = testnetCandidateRuntimeManifest();
    wrongStatus.release.status = 'release-approved';
    const statusMismatch = await resolveRuntimeDeployment(testnetEnvironment(), async () => wrongStatus);
    expect(statusMismatch.mode).toBe('demo');
    expect(statusMismatch.issues).toContain('Testnet and rehearsal modes require a testnet-candidate manifest.');

    const unsigned = testnetCandidateRuntimeManifest();
    unsigned.signaturePolicy = { authorizedSigners: [], policyId: `0x${'00'.repeat(32)}`, threshold: 0 };
    unsigned.signatures = [];
    const unsignedCandidate = await resolveRuntimeDeployment(testnetEnvironment(), async () => unsigned);
    expect(unsignedCandidate.mode).toBe('demo');
    expect(unsignedCandidate.issues).toContain(
      'Remote testnet mode requires a signed testnet-candidate manifest with a satisfied positive threshold.',
    );
  });

  it('keeps release-approved live mode restricted to mainnet', async () => {
    const runtime = await resolveRuntimeDeployment({
      ...testnetEnvironment(),
      GUMBALL_CLIENT_MODE: 'live',
      GUMBALL_DEPLOYMENT_MANIFEST_JSON: JSON.stringify(draftManifest),
    });
    expect(runtime.mode).toBe('demo');
    expect(runtime.fallbackReason).toBe('invalid-live-configuration');
    expect(runtime.issues).toContain('Live mode is restricted to Robinhood Chain mainnet chain ID 4663.');
  });

  it('keeps rehearsal mode fail-closed in production and on remote endpoints', async () => {
    const manifest = rehearsalRuntimeManifest();
    const production = await resolveRuntimeDeployment(
      rehearsalEnvironment({ NODE_ENV: 'production' }),
      async () => manifest,
    );
    expect(production.mode).toBe('demo');
    expect(production.issues).toContain('Local rehearsal mode is disabled in production.');

    const remote = await resolveRuntimeDeployment(
      rehearsalEnvironment({
        GUMBALL_RPC_URL: 'https://rpc.example/rehearsal',
        GUMBALL_SUBGRAPH_URL: 'https://indexer.example/graphql',
      }),
      async () => manifest,
    );
    expect(remote.mode).toBe('demo');
    expect(remote.issues).toContain('Local rehearsal mode requires a localhost RPC endpoint.');
    expect(remote.issues).toContain('Local rehearsal mode requires a localhost subgraph endpoint.');
  });

  it('rejects a complete address set whose logical names are swapped against the signed manifest', async () => {
    const manifest = approvedRuntimeManifest();
    const swappedAddresses = {
      ...liveRuntimeFixture.addresses,
      gbx: liveRuntimeFixture.addresses.genesisBootstrap,
      genesisBootstrap: liveRuntimeFixture.addresses.gbx,
    };
    const runtime = await resolveRuntimeDeployment(
      {
        GUMBALL_CLIENT_MODE: 'live',
        GUMBALL_CHAIN_ID: '4663',
        GUMBALL_DEPLOYMENT_MANIFEST_JSON: '{}',
        GUMBALL_PROTOCOL_ADDRESSES_JSON: JSON.stringify(swappedAddresses),
        GUMBALL_REWARDS_JSON: JSON.stringify(liveRuntimeFixture.rewards),
        GUMBALL_RPC_URL: 'https://archive.example/rpc',
        GUMBALL_RPC_FALLBACK_URLS_JSON: '["https://fallback.example/rpc"]',
        GUMBALL_STRATEGIES_JSON: JSON.stringify(liveRuntimeFixture.strategies),
        GUMBALL_SUBGRAPH_URL: 'https://subgraph.example/graphql',
      },
      async () => manifest,
    );

    expect(runtime.mode).toBe('demo');
    expect(runtime.issues).toContain(
      'GUMBALL_PROTOCOL_ADDRESSES_JSON.gbx does not match signed-manifest deployment GBXToken.',
    );
    expect(runtime.addresses).toBeNull();
  });
});
