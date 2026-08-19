import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { deterministicJson } from './release-lib.mjs';
import { buildArchivedMainnetForkContext, buildMainnetForkContext } from './export-mainnet-fork-context.mjs';
import { buildRobinhoodRegistryRevalidation } from './robinhood-registry-revalidation.mjs';

const nowMs = Date.parse('2026-08-02T12:00:00Z');
const evidenceCommit = '1'.repeat(40);
const sourceCommit = '2'.repeat(40);
const tagObject = '3'.repeat(40);
const releaseTag = 'v1.0.0';
const evidenceCommitCommittedAt = '2026-08-02T10:30:00.000Z';
const registryFetchedAt = '2026-08-02T11:30:00.000Z';
const manifestRepositoryPath = 'packages/config/deployments/robinhood-mainnet.manifest.json';
const assetKeys = ['USDG', 'WETH', 'WRAPPED_BTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL'];
const stockKeys = new Set(['QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL']);
const stockBeaconStorageSlot = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const stockRoles = {
  ADMIN_BURNER_ROLE: '0x25e7ebc863fa4efd16243c82323b71f247c0cf439aca64c51b84a74afb738936',
  BEACON_UPGRADER_ROLE: '0x5ab8bd28475e0dc8d5764e9ce50f85ffe2f14ec40c5b74e45f541485ad510c39',
  BLOCKER_ROLE: '0x8f2e0057cd5e35397007bcc8f5418f73dd64cc6e4073a0276563f247c3079037',
  BURNER_ROLE: '0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848',
  DEFAULT_ADMIN_ROLE: `0x${'00'.repeat(32)}`,
  FACTORY_UPGRADER_ROLE: '0xb4e5de7340a2fee2ff9be79f5ec0e8feae4b633bc8cc663711520e08f24984f8',
  METADATA_UPDATER_ROLE: '0x7f5260842512b02356ff92de24be96e7e1aac2e234d9371b076ac2b4cddda61e',
  MINTER_ROLE: '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
  MULTIPLIER_UPDATER_ROLE: '0x7158cf42e4a4f01c5456c8d75cdbd375748d45e9db7e812f5bcd18844122b615',
  ORACLE_PAUSER_ROLE: '0x155fc2c2b00b801014447f9d3a1522625740f8e592e4c0b0bb7c5867c150aa11',
  PAUSER_ROLE: '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a',
  TOKEN_DEPLOYER_ROLE: '0x5f077d4e72bed5b3b14877559c782788e60c3fbb27bf29d3586097d8fa36bbeb',
  TOKEN_PAUSER_ROLE: '0xe95e22ec6dbf4c911d1fae59680a3e9cb71dd35b3a1c697d232e4b01a8ff30a2',
};
const symbolHashes = {
  AAPL: '0x3a54a9a690616fbc26cfc409bf11f89d51f1d57a4ab2791fb86026cee74ed2f3',
  NVDA: '0xe108948b9667048232851f26a1427d3a908b22da622562906ca50ea536c2ecfb',
  QQQ: '0x3192e549b876a689e8727f4a2e0d4fa13b8456aa0a01f6008ad18fd992e3b532',
  SPCX: '0x958d557610fc21e4bcebb25b1833d83d923ade2e9f912e780ced2144c5abc42c',
  TSLA: '0x0a8f1f385fed9c77a2e0daa363ccc865e971bdbe4458bb570cc0acb068d7c0f2',
  WETH: '0x0f8a193ff464434486c0daf7db2a895884365d2bc84ba47a68fcf89c1b14b5b8',
  WRAPPED_BTC: '0x98da2c5e4c6b1db946694570273b859a6e4083ccc8faa155edfc4c54eb3cfd73',
};
const externalKeys = [
  'USDG',
  'WETH',
  'uniswapV4.poolManager',
  'uniswapV4.positionDescriptor',
  'uniswapV4.positionManager',
  'uniswapV4.quoter',
  'uniswapV4.stateView',
  'uniswapV4.reservesLens',
  'uniswapV4.universalRouter',
  'uniswapV4.permit2',
];

const address = (index) => `0x${index.toString(16).padStart(40, '0')}`;
const bytes32 = (index) => `0x${index.toString(16).padStart(64, '0')}`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function safePolicyBytes(candidate) {
  return Buffer.from(
    deterministicJson({
      approvedSingletons: [candidate.config.protocolAdminSafe, candidate.config.emergencyGuardianSafe].map((safe) => ({
        network: candidate.config.network,
        proxyRuntimeBytecodeHashes: [safe.proxyRuntimeBytecodeHash],
        singletonAddress: safe.singletonAddress,
        singletonRuntimeBytecodeHash: safe.singletonRuntimeBytecodeHash,
      })),
      kind: 'gumball-6900-safe-control-plane-policy',
      protocol: 'GUM BALL 6900',
      schemaVersion: 1,
      status: 'configured',
    }),
  );
}

function fixture() {
  const assets = assetKeys.map((key, index) => {
    let proxyEvidence;
    if (key === 'USDG') {
      proxyEvidence = {
        adminSlotValue: `0x${'00'.repeat(32)}`,
        implementationAddress: address(0x900),
        implementationRuntimeBytecodeHash: bytes32(0x901),
        kind: 'eip1967-uups',
        upgradeAuthorityAddress: address(0x902),
        upgradeAuthorityRuntimeBytecodeHash: bytes32(0x903),
        verifiedAtBlock: '25030000',
      };
    } else if (key === 'WETH') {
      proxyEvidence = {
        adminAddress: address(0x910),
        adminOwnerAddress: address(0x912),
        adminOwnerProxyEvidence: {
          adminSlotValue: `0x${'00'.repeat(12)}${address(0x910).slice(2)}`,
          implementationAddress: address(0x913),
          implementationRuntimeBytecodeHash: bytes32(0x914),
        },
        adminOwnerRuntimeBytecodeHash: bytes32(0x915),
        adminRuntimeBytecodeHash: bytes32(0x911),
        adminSlotValue: `0x${'00'.repeat(12)}${address(0x910).slice(2)}`,
        implementationAddress: address(0x916),
        implementationRuntimeBytecodeHash: bytes32(0x917),
        kind: 'eip1967-transparent',
        proxyAdminInterface: 'oz-v4',
        verifiedAtBlock: '25030000',
      };
    } else if (key === 'WRAPPED_BTC') {
      const proxyAdminAddress = address(0x930);
      proxyEvidence = {
        gateway: {
          address: address(0x931),
          implementationAddress: address(0x932),
          implementationRuntimeBytecodeHash: bytes32(0x932),
          proxyAdminAddress,
          runtimeBytecodeHash: bytes32(0x931),
        },
        gatewayRouter: {
          address: address(0x933),
          implementationAddress: address(0x934),
          implementationRuntimeBytecodeHash: bytes32(0x934),
          proxyAdminAddress,
          runtimeBytecodeHash: bytes32(0x933),
        },
        kind: 'wrapped-btc-canonical-bridge',
        l1Token: address(0x935),
        sharedProxyAdmin: {
          address: proxyAdminAddress,
          owner: {
            address: address(0x936),
            adminRole: '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
            executorRole: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63',
            implementationAddress: address(0x937),
            implementationRuntimeBytecodeHash: bytes32(0x937),
            runtimeBytecodeHash: bytes32(0x936),
          },
          runtimeBytecodeHash: bytes32(0x930),
        },
        tokenBeacon: {
          address: address(0x938),
          implementationAddress: address(0x939),
          implementationRuntimeBytecodeHash: bytes32(0x939),
          runtimeBytecodeHash: bytes32(0x938),
        },
        verifiedAtBlock: '25030000',
      };
    } else if (stockKeys.has(key)) {
      proxyEvidence = {
        beaconAddress: address(0x920),
        beaconRuntimeBytecodeHash: bytes32(0x921),
        implementationAddress: address(0x922),
        implementationRuntimeBytecodeHash: bytes32(0x923),
        kind: 'eip1967-beacon',
        verifiedAtBlock: '25030000',
      };
    }
    return {
      acquisitionEnabled: true,
      address: address(0x100 + index),
      decimals: key === 'USDG' ? 6 : key === 'WRAPPED_BTC' ? 8 : 18,
      key,
      proxyEvidence,
      redemptionEnabled: true,
      registryStatus: stockKeys.has(key) ? 'ASSET_STATUS_ACTIVE' : 'NOT_APPLICABLE',
      runtimeBytecodeHash: stockKeys.has(key) ? bytes32(0x924) : bytes32(0x200 + index),
      uid: stockKeys.has(key) ? bytes32(0x300 + index) : null,
      uiMultiplier: stockKeys.has(key) ? '1000000000000000000' : null,
    };
  });
  const asset = (key) => assets.find((record) => record.key === key);
  const externals = externalKeys.map((key, index) => ({
    address: key === 'USDG' || key === 'WETH' ? asset(key).address : address(0x500 + index),
    key,
    runtimeBytecodeHash: key === 'USDG' || key === 'WETH' ? asset(key).runtimeBytecodeHash : bytes32(0x600 + index),
    sourceUrl: `https://evidence.example/${index}`,
    verifiedAtBlock: '25030000',
  }));
  const external = (key) => externals.find((record) => record.key === key);
  const targets = assets.filter(({ key }) => key !== 'USDG');
  const config = {
    assetReview: {
      path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-02.candidate.json',
      rawSha256: 'a'.repeat(64),
    },
    assets: {
      assetIds: targets.map((record, index) => record.uid ?? bytes32(0x700 + index)),
      decimals: targets.map(({ decimals }) => decimals),
      initialReferenceRates: targets.map(() => '1000000000000000000'),
      isStockToken: targets.map(({ key }) => stockKeys.has(key)),
      runtimeBytecodeHashes: targets.map(({ runtimeBytecodeHash }) => runtimeBytecodeHash),
      symbolHashes: targets.map(({ key }) => symbolHashes[key]),
      tokens: targets.map(({ address: token }) => token),
      uiMultipliers: targets.map(({ key }) => (stockKeys.has(key) ? '1000000000000000000' : null)),
    },
    canonicalTokenDependencies: {
      usdG: {
        address: asset('USDG').address,
        proxyEvidence: {
          adminSlotValue: asset('USDG').proxyEvidence.adminSlotValue,
          implementationAddress: asset('USDG').proxyEvidence.implementationAddress,
          implementationRuntimeBytecodeHash: asset('USDG').proxyEvidence.implementationRuntimeBytecodeHash,
          kind: 'eip1967-uups',
          upgradeAuthorityAddress: asset('USDG').proxyEvidence.upgradeAuthorityAddress,
          upgradeAuthorityRuntimeBytecodeHash: asset('USDG').proxyEvidence.upgradeAuthorityRuntimeBytecodeHash,
        },
        runtimeBytecodeHash: asset('USDG').runtimeBytecodeHash,
      },
      weth: {
        address: asset('WETH').address,
        proxyEvidence: {
          adminAddress: asset('WETH').proxyEvidence.adminAddress,
          adminOwnerAddress: asset('WETH').proxyEvidence.adminOwnerAddress,
          adminOwnerProxyEvidence: asset('WETH').proxyEvidence.adminOwnerProxyEvidence,
          adminOwnerRuntimeBytecodeHash: asset('WETH').proxyEvidence.adminOwnerRuntimeBytecodeHash,
          adminRuntimeBytecodeHash: asset('WETH').proxyEvidence.adminRuntimeBytecodeHash,
          adminSlotValue: asset('WETH').proxyEvidence.adminSlotValue,
          implementationAddress: asset('WETH').proxyEvidence.implementationAddress,
          implementationRuntimeBytecodeHash: asset('WETH').proxyEvidence.implementationRuntimeBytecodeHash,
          kind: 'eip1967-transparent',
          proxyAdminInterface: asset('WETH').proxyEvidence.proxyAdminInterface,
        },
        runtimeBytecodeHash: asset('WETH').runtimeBytecodeHash,
      },
    },
    eligibility: { mode: 1, module: address(0xa01), registry: address(0xa02) },
    genesis: { bootstrapContributionCap: '80000000000000', minimumBootstrapUSDG: '1000000000000' },
    kind: 'gumball-6900-deployment-config',
    liquidity: {
      allocationBps: [5000, 3000, 1500, 500],
      cumulativeTickDeltas: [4080, 10980, 17940, 24900],
      poolFee: 3000,
      tickSpacing: 60,
    },
    network: { chainId: 4663, name: 'Robinhood Chain' },
    protocol: 'GUM BALL 6900',
    protocolAdminSafe: {
      enabledModules: [],
      fallbackHandler: address(0),
      guard: address(0),
      owners: [address(0xa09), address(0xa0a)],
      proxyRuntimeBytecodeHash: bytes32(0xa0b),
      safeAddress: address(0xa05),
      singletonAddress: address(0xa0c),
      singletonRuntimeBytecodeHash: bytes32(0xa0d),
      threshold: '2',
    },
    emergencyGuardianSafe: {
      enabledModules: [],
      fallbackHandler: address(0),
      guard: address(0),
      owners: [address(0xa19), address(0xa1a)],
      proxyRuntimeBytecodeHash: bytes32(0xa1b),
      safeAddress: address(0xa03),
      singletonAddress: address(0xa1c),
      singletonRuntimeBytecodeHash: bytes32(0xa1d),
      threshold: '2',
    },
    roles: {
      emergencyGuardianOperator: address(0xa03),
      genesisLiquidityBacker: address(0xa04),
      protocolTimelockMultisig: address(0xa05),
    },
    schemaVersion: 1,
    strategies: {
      buybackInitialReferenceRate: '1000000000000000000',
      maximumLotUSDG: '1000000000000',
      minimumLotUSDG: '100000000',
    },
    stockTokenDependency: {
      beaconAddress: address(0x920),
      beaconRuntimeBytecodeHash: bytes32(0x921),
      implementationAddress: address(0x922),
      implementationRuntimeBytecodeHash: bytes32(0x923),
    },
    wrappedBtcBridgeDependency: {
      gateway: {
        ...asset('WRAPPED_BTC').proxyEvidence.gateway,
        kind: 'eip1967-transparent',
      },
      gatewayRouter: {
        ...asset('WRAPPED_BTC').proxyEvidence.gatewayRouter,
        kind: 'eip1967-transparent',
      },
      l1Token: asset('WRAPPED_BTC').proxyEvidence.l1Token,
      sharedProxyAdmin: {
        address: asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.address,
        owner: {
          address: asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.owner.address,
          adminRole: asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.owner.adminRole,
          executorRole: asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.owner.executorRole,
          proxy: {
            implementationAddress: asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.owner.implementationAddress,
            implementationRuntimeBytecodeHash:
              asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.owner.implementationRuntimeBytecodeHash,
            kind: 'eip1967-transparent',
            proxyAdminAddress: asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.address,
          },
          runtimeBytecodeHash: asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.owner.runtimeBytecodeHash,
        },
        runtimeBytecodeHash: asset('WRAPPED_BTC').proxyEvidence.sharedProxyAdmin.runtimeBytecodeHash,
      },
      token: {
        address: asset('WRAPPED_BTC').address,
        beaconAddress: asset('WRAPPED_BTC').proxyEvidence.tokenBeacon.address,
        beaconRuntimeBytecodeHash: asset('WRAPPED_BTC').proxyEvidence.tokenBeacon.runtimeBytecodeHash,
        implementationAddress: asset('WRAPPED_BTC').proxyEvidence.tokenBeacon.implementationAddress,
        implementationRuntimeBytecodeHash:
          asset('WRAPPED_BTC').proxyEvidence.tokenBeacon.implementationRuntimeBytecodeHash,
        kind: 'eip1967-beacon',
        runtimeBytecodeHash: asset('WRAPPED_BTC').runtimeBytecodeHash,
      },
    },
    uniswapV4: {
      permit2: external('uniswapV4.permit2').address,
      poolManager: external('uniswapV4.poolManager').address,
      positionManager: external('uniswapV4.positionManager').address,
    },
    usdG: asset('USDG').address,
    usdGDecimals: 6,
  };
  const manifest = {
    assets,
    externalContracts: externals,
    kind: 'gumball-6900-deployment-manifest',
    network: { chainId: 4663, name: 'Robinhood Chain' },
    protocol: 'GUM BALL 6900',
    release: {
      createdAt: '2026-08-02T11:01:00.000Z',
      gitCommit: sourceCommit,
      status: 'release-approved',
      version: releaseTag,
    },
    releaseEvidence: {
      assetCandidate: config.assetReview,
      deploymentConfig: { path: 'evidence/config.json', rawSha256: '' },
      observation: {
        blockHash: bytes32(0xb00),
        blockNumber: '25030000',
        expiresAt: '2026-08-02T13:00:00Z',
        observedAt: '2026-08-02T11:00:00Z',
      },
      protocolAdminSafe: {
        ...config.protocolAdminSafe,
        block: { hash: bytes32(0xb00), number: '25030000', timestamp: '1785668400' },
        kind: 'gumball-6900-safe-control-plane-evidence',
        network: { chainId: 4663, name: 'Robinhood Chain' },
        nonce: '7',
        protocol: 'GUM BALL 6900',
        schemaVersion: 1,
      },
      emergencyGuardianSafe: {
        ...config.emergencyGuardianSafe,
        block: { hash: bytes32(0xb00), number: '25030000', timestamp: '1785668400' },
        kind: 'gumball-6900-safe-control-plane-evidence',
        network: { chainId: 4663, name: 'Robinhood Chain' },
        nonce: '9',
        protocol: 'GUM BALL 6900',
        schemaVersion: 1,
      },
    },
    roles: {
      emergencyGuardianMultisig: config.roles.emergencyGuardianOperator,
      protocolTimelockMultisig: config.roles.protocolTimelockMultisig,
    },
    schemaVersion: 1,
    signaturePolicy: { policyId: bytes32(0xa0e) },
  };
  const assetCandidate = {
    assets: assets
      .filter(({ key }) => stockKeys.has(key))
      .map((record) => ({
        address: record.address,
        chainId: 4663,
        currentMultiplier: record.uiMultiplier,
        decimals: 18,
        proxy: {
          accessControlledRegistry: address(0x920),
          beaconAddress: address(0x920),
          beaconStorageSlot: stockBeaconStorageSlot,
          kind: 'eip1967-beacon-proxy',
          oraclePaused: false,
          paused: false,
          tokenPaused: false,
          validations: {
            accessControlledRegistryMatchesBeacon: true,
            beaconStorageMatches: true,
            oracleActive: true,
            tokenAndRegistryActive: true,
          },
        },
        registryStatus: 'ASSET_STATUS_ACTIVE',
        runtimeBytecodeHash: record.runtimeBytecodeHash,
        symbol: record.key,
        tokenName: `${record.key} Tokenized Stock`,
        uid: record.uid,
        validations: {
          addressMatchesRecordedCandidate: true,
          balanceOfCallable: true,
          bytecodePresent: true,
          chainIdMatches: true,
          decimalsMatch: true,
          registryActive: true,
          symbolMatches: true,
          transferSimulationSucceeded: true,
          uidMatches: true,
          uiMultiplierMatches: true,
        },
      }))
      .sort((left, right) => left.symbol.localeCompare(right.symbol)),
    chainId: 4663,
    deploymentApproved: false,
    gates: { compliance: 'unresolved', testnetDependencies: 'unresolved', wrappedBtc: 'unresolved' },
    kind: 'robinhood-stock-asset-manifest',
    schemaVersion: 2,
    source: {
      blockHash: bytes32(0xb01),
      blockNumber: '25029900',
      blockTimestamp: '2026-08-02T10:00:00.000Z',
      observedAt: '2026-08-02T10:00:00.000Z',
      registryResponseSha256: bytes32(0xc00),
      registryUrl: 'https://api.robinhood.com/rhj/assets',
    },
    status: 'generated-candidate',
    stockTokenDependency: {
      accessControl: {
        blockedAccounts: [address(0xb01), address(0xb02)],
        controlEventLog: {
          accessControlEventCount: 19,
          blocklistEventCount: 250,
          eventCount: 274,
          fromBlock: '7662',
          pauseEventCount: 3,
          sha256: bytes32(0xb03),
          toBlock: '25029900',
          upgradeEventCount: 2,
        },
        roles: Object.entries(stockRoles)
          .map(([roleName, role], index) => ({
            adminRole: stockRoles.DEFAULT_ADMIN_ROLE,
            members: [
              {
                accountType: 'eoa',
                address: address(0xc00 + index),
                runtimeBytecodeHash: null,
              },
            ],
            role,
            roleName,
          }))
          .sort((left, right) => left.role.localeCompare(right.role)),
      },
      beaconAddress: address(0x920),
      beaconPaused: false,
      beaconRuntimeBytecodeHash: bytes32(0x921),
      implementationAddress: address(0x922),
      implementationRuntimeBytecodeHash: bytes32(0x923),
      proxyRuntimeBytecodeHash: bytes32(0x924),
      validations: {
        accessControlInterfaceSupported: true,
        accessControlStateReconstructed: true,
        beaconActive: true,
        implementationRegistryMatchesBeacon: true,
        sharedProxyRuntime: true,
      },
    },
  };
  return { assetCandidate, config, manifest };
}

function selectedRegistryRecords(candidate) {
  return candidate.assetCandidate.assets.map((asset) => ({
    currentMultiplier: `${BigInt(asset.currentMultiplier) / 10n ** 18n}.${(BigInt(asset.currentMultiplier) % 10n ** 18n)
      .toString()
      .padStart(18, '0')}`,
    deployments: [{ chainId: 4663, contractAddress: asset.address }],
    id: asset.uid,
    status: asset.registryStatus,
    tokenName: asset.tokenName,
    tokenSymbol: asset.symbol,
  }));
}

function preparedInputs(candidate = fixture(), { stage = 'preliminary' } = {}) {
  const selectedRecords = selectedRegistryRecords(candidate);
  candidate.assetCandidate.source.registryResponseSha256 = `0x${sha256(
    Buffer.from(deterministicJson(selectedRecords)),
  )}`;
  const assetCandidateBytes = Buffer.from(deterministicJson(candidate.assetCandidate));
  const assetCandidateSha256 = sha256(assetCandidateBytes);
  candidate.config.assetReview.rawSha256 = assetCandidateSha256;
  candidate.manifest.releaseEvidence.assetCandidate = { ...candidate.config.assetReview };
  const configBytes = Buffer.from(deterministicJson(candidate.config));
  candidate.manifest.releaseEvidence.deploymentConfig.rawSha256 = sha256(configBytes);
  const manifestBytes = Buffer.from(deterministicJson(candidate.manifest));
  const registryResponseBytes = Buffer.from(deterministicJson({ assets: selectedRecords }));
  const registryRevalidation = buildRobinhoodRegistryRevalidation({
    assetCandidateBytes,
    configBytes,
    evidenceCommit,
    evidenceCommitCommittedAt,
    fetchedAt: registryFetchedAt,
    manifestBytes,
    manifestRepositoryPath,
    registryResponseBytes,
    sourceCommit,
    stage,
    tag: releaseTag,
    tagObject,
  });
  const registryRevalidationBytes = Buffer.from(deterministicJson(registryRevalidation));
  return {
    assetCandidateBytes,
    configBytes,
    manifestBytes,
    nowMs,
    registryResponseBytes,
    registryRevalidationBytes,
    registryRevalidationExpected: {
      evidenceCommit,
      evidenceCommitCommittedAt,
      expectedStage: stage,
      manifestRepositoryPath,
      sourceCommit,
      tag: releaseTag,
      tagObject,
    },
    safeControlPlanePolicyBytes: safePolicyBytes(candidate),
  };
}

function build(candidate = fixture(), options = {}) {
  return buildArchivedMainnetForkContext(preparedInputs(candidate, options));
}

function permissionedV2Fixture() {
  const candidate = fixture();
  const dependency = (key, suffix) => {
    const record = {
      address: address(suffix),
      key,
      runtimeBytecodeHash: bytes32(suffix + 0x100),
      sourceUrl: `https://evidence.example/${key}`,
      verifiedAtBlock: '25030000',
    };
    candidate.manifest.externalContracts.push(record);
    return { address: record.address, runtimeBytecodeHash: record.runtimeBytecodeHash };
  };
  const external = (key) => candidate.manifest.externalContracts.find((record) => record.key === key);
  candidate.config.liquidity = {
    ...candidate.config.liquidity,
    mode: 'permissioned',
    permissionedDependencies: {
      mixedRouteQuoterV2: dependency('uniswapV4.mixedRouteQuoterV2', 0x700),
      permissionedPositionManager: {
        address: external('uniswapV4.positionManager').address,
        runtimeBytecodeHash: external('uniswapV4.positionManager').runtimeBytecodeHash,
      },
      permissionsAdapterFactory: dependency('uniswapV4.permissionsAdapterFactory', 0x701),
      universalRouter: {
        address: external('uniswapV4.universalRouter').address,
        runtimeBytecodeHash: external('uniswapV4.universalRouter').runtimeBytecodeHash,
      },
      v4Quoter: {
        address: external('uniswapV4.quoter').address,
        runtimeBytecodeHash: external('uniswapV4.quoter').runtimeBytecodeHash,
      },
    },
  };
  candidate.manifest.schemaVersion = 2;
  candidate.manifest.compliance = { mode: 'permissioned-production' };
  candidate.manifest.releaseEvidence.permissionedPool = {
    graph: { path: 'evidence/graph.json', rawSha256: '1'.repeat(64) },
    officialSourceBuild: { path: 'evidence/source-build.json', rawSha256: '2'.repeat(64) },
    robinhoodForkRehearsal: { path: 'evidence/fork-rehearsal.json', rawSha256: '3'.repeat(64) },
  };
  return candidate;
}

test('current fork-context export does not fall back to archived Safe bindings', () => {
  assert.throws(
    () => buildMainnetForkContext(preparedInputs()),
    /Current external-governance deployment\/release tooling is unavailable/,
  );
});

test('exports the complete deterministic signed mainnet dependency context', () => {
  const context = build();
  assert.equal(context.variables.ROBINHOOD_MAINNET_FORK_BLOCK, '25030000');
  assert.equal(context.variables.ROBINHOOD_MAINNET_FORK_BLOCK_HASH, bytes32(0xb00));
  assert.equal(context.variables.ROBINHOOD_MAINNET_WRAPPED_BTC_DECIMALS, '8');
  assert.equal(context.variables.ROBINHOOD_MAINNET_QQQ_UID, bytes32(0x303));
  assert.equal(context.variables.ROBINHOOD_MAINNET_USDG_PROXY_ADMIN_SLOT_VALUE, `0x${'00'.repeat(32)}`);
  assert.equal(context.variables.ROBINHOOD_MAINNET_USDG_IMPLEMENTATION_ADDRESS, address(0x900));
  assert.equal(context.variables.ROBINHOOD_MAINNET_USDG_UPGRADE_AUTHORITY_CODE_HASH, bytes32(0x903));
  assert.equal(context.variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_ADDRESS, address(0x910));
  assert.equal(context.variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_IMPLEMENTATION_ADDRESS, address(0x913));
  assert.equal(context.variables.ROBINHOOD_MAINNET_WETH_IMPLEMENTATION_CODE_HASH, bytes32(0x917));
  assert.equal(context.variables.ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_ADDRESS, address(0x931));
  assert.equal(context.variables.ROBINHOOD_MAINNET_WRAPPED_BTC_SHARED_PROXY_ADMIN_ADDRESS, address(0x930));
  assert.equal(context.variables.ROBINHOOD_MAINNET_WRAPPED_BTC_BEACON_ADDRESS, address(0x938));
  assert.equal(context.variables.ROBINHOOD_MAINNET_STOCK_BEACON_ADDRESS, address(0x920));
  assert.equal(context.variables.ROBINHOOD_MAINNET_STOCK_IMPLEMENTATION_CODE_HASH, bytes32(0x923));
  assert.equal(context.registryRevalidation.stage, 'preliminary');
  assert.equal(context.registryRevalidation.authorizationEligible, false);
  assert.equal(context.registryRevalidation.evidenceCommit, evidenceCommit);
  assert.equal(context.registryRevalidation.sourceCommit, sourceCommit);
  assert.match(context.registryRevalidation.rawSha256, /^[0-9a-f]{64}$/);
  assert.match(context.registryRevalidation.registryResponseRawSha256, /^[0-9a-f]{64}$/);
  assert.equal(Object.keys(context.variables).length, 88);
  assert.deepEqual(build(), context);
});

test('schema v2 exports and config-binds both additional permissioned dependencies', () => {
  const candidate = permissionedV2Fixture();
  const context = build(candidate);
  assert.equal(Object.keys(context.variables).length, 92);
  assert.equal(
    context.variables.ROBINHOOD_MAINNET_MIXED_ROUTE_QUOTER_V2_ADDRESS,
    candidate.config.liquidity.permissionedDependencies.mixedRouteQuoterV2.address,
  );
  assert.equal(
    context.variables.ROBINHOOD_MAINNET_PERMISSIONS_ADAPTER_FACTORY_CODE_HASH,
    candidate.config.liquidity.permissionedDependencies.permissionsAdapterFactory.runtimeBytecodeHash,
  );

  const drift = permissionedV2Fixture();
  drift.config.liquidity.permissionedDependencies.permissionsAdapterFactory.runtimeBytecodeHash = bytes32(0xdead);
  assert.throws(() => build(drift), /permissionsAdapterFactory runtime bytecode hash/);
});

test('requires the exact fresh late-registry artifact, source archive, stage, and release linkage', () => {
  const protectedContext = build(fixture(), { stage: 'protected-final' });
  assert.equal(protectedContext.registryRevalidation.stage, 'protected-final');
  assert.equal(protectedContext.registryRevalidation.authorizationEligible, true);

  const artifactDrift = preparedInputs();
  const artifact = JSON.parse(artifactDrift.registryRevalidationBytes.toString('utf8'));
  artifact.evidence.selectedRecords[0].tokenName = 'Substituted token';
  artifactDrift.registryRevalidationBytes = Buffer.from(deterministicJson(artifact));
  assert.throws(
    () => buildArchivedMainnetForkContext(artifactDrift),
    /selected-record archive digest|selected records differ/,
  );

  const archiveDrift = preparedInputs();
  const registryResponse = JSON.parse(archiveDrift.registryResponseBytes.toString('utf8'));
  registryResponse.assets[0].status = 'ASSET_STATUS_INACTIVE';
  archiveDrift.registryResponseBytes = Buffer.from(deterministicJson(registryResponse));
  assert.throws(() => buildArchivedMainnetForkContext(archiveDrift), /source archive bytes do not match/);

  const stageDrift = preparedInputs(fixture(), { stage: 'protected-final' });
  stageDrift.registryRevalidationExpected.expectedStage = 'preliminary';
  assert.throws(() => buildArchivedMainnetForkContext(stageDrift), /identity, stage, or eligibility/);

  const linkageDrift = preparedInputs();
  linkageDrift.registryRevalidationExpected.sourceCommit = '4'.repeat(40);
  assert.throws(() => buildArchivedMainnetForkContext(linkageDrift), /release linkage is invalid/);
});

test('rejects drift across every Safe identity surface and observation binding', () => {
  const mutations = [
    ['safeAddress', address(0xd01)],
    ['proxyRuntimeBytecodeHash', bytes32(0xd02)],
    ['singletonAddress', address(0xd03)],
    ['singletonRuntimeBytecodeHash', bytes32(0xd04)],
    ['owners', [address(0xd05), address(0xd06)]],
    ['threshold', '1'],
    ['guard', address(0xd07)],
    ['enabledModules', [address(0xd08)]],
    ['fallbackHandler', address(0xd09)],
  ];
  for (const safeRole of ['protocolAdminSafe', 'emergencyGuardianSafe']) {
    const label = safeRole === 'protocolAdminSafe' ? 'protocol-admin Safe' : 'emergency-guardian Safe';
    for (const [field, replacement] of mutations) {
      const candidate = fixture();
      candidate.manifest.releaseEvidence[safeRole][field] = replacement;
      assert.throws(
        () => build(candidate),
        new RegExp(`manifest ${label} ${field}|not approved by the fixed policy`),
        `${safeRole}.${field}`,
      );
    }
  }

  const detached = fixture();
  detached.manifest.releaseEvidence.protocolAdminSafe.block.hash = bytes32(0xd10);
  assert.throws(() => build(detached), /detached from the signed observation block/);

  const mismatchedTimestamp = fixture();
  mismatchedTimestamp.manifest.releaseEvidence.emergencyGuardianSafe.block.timestamp = '1785639597';
  assert.throws(() => build(mismatchedTimestamp), /same exact observation block timestamp/);

  const wrongRole = fixture();
  wrongRole.manifest.roles.protocolTimelockMultisig = address(0xd11);
  assert.throws(() => build(wrongRole), /protocol-admin Safe role does not match/);

  const wrongGuardianRole = fixture();
  wrongGuardianRole.manifest.roles.emergencyGuardianMultisig = address(0xd12);
  assert.throws(() => build(wrongGuardianRole), /emergency-guardian Safe role does not match/);

  const sharedSafe = fixture();
  sharedSafe.config.emergencyGuardianSafe = structuredClone(sharedSafe.config.protocolAdminSafe);
  sharedSafe.config.roles.emergencyGuardianOperator = sharedSafe.config.protocolAdminSafe.safeAddress;
  sharedSafe.manifest.releaseEvidence.emergencyGuardianSafe = {
    ...structuredClone(sharedSafe.manifest.releaseEvidence.protocolAdminSafe),
  };
  sharedSafe.manifest.roles.emergencyGuardianMultisig = sharedSafe.config.protocolAdminSafe.safeAddress;
  assert.throws(() => build(sharedSafe), /Safe roles must be distinct|duplicate approved singleton identity/);
});

test('rejects malformed, duplicate, and unconfigured Safe trust-root policies', () => {
  const malformed = preparedInputs();
  const malformedPolicy = JSON.parse(malformed.safeControlPlanePolicyBytes.toString('utf8'));
  malformedPolicy.approvedSingletons[0].unexpected = true;
  malformed.safeControlPlanePolicyBytes = Buffer.from(deterministicJson(malformedPolicy));
  assert.throws(() => buildArchivedMainnetForkContext(malformed), /invalid approved singleton entry/);

  const duplicate = preparedInputs();
  const duplicatePolicy = JSON.parse(duplicate.safeControlPlanePolicyBytes.toString('utf8'));
  duplicatePolicy.approvedSingletons.push(structuredClone(duplicatePolicy.approvedSingletons[0]));
  duplicate.safeControlPlanePolicyBytes = Buffer.from(deterministicJson(duplicatePolicy));
  assert.throws(() => buildArchivedMainnetForkContext(duplicate), /duplicate approved singleton identity/);

  const unconfigured = preparedInputs();
  unconfigured.safeControlPlanePolicyBytes = Buffer.from(
    deterministicJson({
      approvedSingletons: [],
      kind: 'gumball-6900-safe-control-plane-policy',
      protocol: 'GUM BALL 6900',
      reason: 'Not reviewed.',
      schemaVersion: 1,
      status: 'unconfigured',
    }),
  );
  assert.throws(() => buildArchivedMainnetForkContext(unconfigured), /explicitly unconfigured/);
});

test('manifest dependency drift changes the exact Forge target and runtime hash', () => {
  const original = build();
  const candidate = fixture();
  const quoter = candidate.manifest.externalContracts.find(({ key }) => key === 'uniswapV4.quoter');
  quoter.address = address(0xdead);
  quoter.runtimeBytecodeHash = bytes32(0xbeef);
  const mutated = build(candidate);
  assert.equal(mutated.variables.ROBINHOOD_MAINNET_QUOTER_ADDRESS, address(0xdead));
  assert.equal(mutated.variables.ROBINHOOD_MAINNET_QUOTER_CODE_HASH, bytes32(0xbeef));
  assert.notEqual(
    mutated.variables.ROBINHOOD_MAINNET_QUOTER_ADDRESS,
    original.variables.ROBINHOOD_MAINNET_QUOTER_ADDRESS,
  );
});

test('requires complete observation-bound WETH transparent-proxy evidence', () => {
  const missing = fixture();
  delete missing.manifest.assets.find(({ key }) => key === 'WETH').proxyEvidence;
  assert.throws(() => build(missing), /WETH proxy evidence/);

  const wrongKind = fixture();
  wrongKind.manifest.assets.find(({ key }) => key === 'WETH').proxyEvidence.kind = 'eip1967-uups';
  assert.throws(() => build(wrongKind), /Canonical WETH kind|WETH transparent-proxy evidence/);

  const stale = fixture();
  stale.manifest.assets.find(({ key }) => key === 'WETH').proxyEvidence.verifiedAtBlock = '25029999';
  assert.throws(() => build(stale), /WETH transparent-proxy evidence/);

  const missingOwnerImplementation = fixture();
  missingOwnerImplementation.manifest.assets.find(({ key }) => key === 'WETH').proxyEvidence.adminOwnerProxyEvidence =
    null;
  assert.throws(() => build(missingOwnerImplementation), /ProxyAdmin-owner proxy evidence/);
});

test('requires complete observation-bound WBTC bridge and authority evidence', () => {
  const missing = fixture();
  delete missing.manifest.assets.find(({ key }) => key === 'WRAPPED_BTC').proxyEvidence;
  assert.throws(() => build(missing), /WBTC bridge evidence/);

  const gatewayAdminDrift = fixture();
  gatewayAdminDrift.manifest.assets.find(({ key }) => key === 'WRAPPED_BTC').proxyEvidence.gateway.proxyAdminAddress =
    address(0xdead);
  assert.throws(() => build(gatewayAdminDrift), /gateway proxyAdminAddress/);

  const ownerImplementationDrift = fixture();
  ownerImplementationDrift.manifest.assets.find(
    ({ key }) => key === 'WRAPPED_BTC',
  ).proxyEvidence.sharedProxyAdmin.owner.implementationRuntimeBytecodeHash = bytes32(0xdead);
  assert.throws(() => build(ownerImplementationDrift), /ProxyAdmin-owner implementationRuntimeBytecodeHash/);

  const tokenBeaconDrift = fixture();
  tokenBeaconDrift.manifest.assets.find(({ key }) => key === 'WRAPPED_BTC').proxyEvidence.tokenBeacon.address =
    address(0xdead);
  assert.throws(() => build(tokenBeaconDrift), /token beacon/);

  const stale = fixture();
  stale.manifest.assets.find(({ key }) => key === 'WRAPPED_BTC').proxyEvidence.verifiedAtBlock = '25029999';
  assert.throws(() => build(stale), /WBTC bridge evidence is not bound/);
});

test('requires the v2 stock candidate control plane and complete deterministic role history', () => {
  const legacy = fixture();
  legacy.assetCandidate.schemaVersion = 1;
  assert.throws(() => build(legacy), /candidate identity or source observation|candidate identity or v2 shape/);

  const roleDrift = fixture();
  roleDrift.assetCandidate.stockTokenDependency.accessControl.roles[0].roleName = 'MINTER_ROLE';
  assert.throws(() => build(roleDrift), /roles must be complete and sorted/);

  const eventCountDrift = fixture();
  eventCountDrift.assetCandidate.stockTokenDependency.accessControl.controlEventLog.eventCount -= 1;
  assert.throws(() => build(eventCountDrift), /control history is incomplete/);

  const pauseDrift = fixture();
  pauseDrift.assetCandidate.assets[0].proxy.tokenPaused = true;
  assert.throws(() => build(pauseDrift), /control plane is unsupported or paused/);

  const canonicalDependencyDrift = fixture();
  canonicalDependencyDrift.config.canonicalTokenDependencies.usdG.proxyEvidence.implementationRuntimeBytecodeHash =
    bytes32(0xdead);
  assert.throws(() => build(canonicalDependencyDrift), /Canonical USDG implementationRuntimeBytecodeHash/);
});

test('config, stock UID, observation-block, and raw-byte drift fail closed', () => {
  const poolDrift = fixture();
  poolDrift.config.uniswapV4.poolManager = address(0xdead);
  assert.throws(() => build(poolDrift), /PoolManager address does not match/);

  const uidDrift = fixture();
  const qqqIndex = uidDrift.manifest.assets.findIndex(({ key }) => key === 'QQQ') - 1;
  uidDrift.config.assets.assetIds[qqqIndex] = bytes32(0xdead);
  assert.throws(() => build(uidDrift), /QQQ UID does not match|config QQQ identity differs/);

  const symbolPermutation = fixture();
  [symbolPermutation.config.assets.symbolHashes[0], symbolPermutation.config.assets.symbolHashes[1]] = [
    symbolPermutation.config.assets.symbolHashes[1],
    symbolPermutation.config.assets.symbolHashes[0],
  ];
  assert.throws(() => build(symbolPermutation), /WETH symbol hash does not match/);

  const blockDrift = fixture();
  blockDrift.manifest.externalContracts[0].verifiedAtBlock = '25029999';
  assert.throws(() => build(blockDrift), /not recorded at the signed observation block/);

  const candidate = fixture();
  const originalConfigBytes = Buffer.from(deterministicJson(candidate.config));
  candidate.manifest.releaseEvidence.deploymentConfig.rawSha256 = sha256(originalConfigBytes);
  candidate.config.usdGDecimals = 7;
  assert.throws(
    () =>
      buildArchivedMainnetForkContext({
        configBytes: Buffer.from(deterministicJson(candidate.config)),
        manifestBytes: Buffer.from(deterministicJson(candidate.manifest)),
        nowMs,
        safeControlPlanePolicyBytes: safePolicyBytes(candidate),
      }),
    /config bytes do not match the signed manifest SHA-256/,
  );
});

test('expired or future-dated mainnet fork observation evidence is rejected', () => {
  const expired = fixture();
  expired.manifest.releaseEvidence.observation.expiresAt = '2026-08-02T12:00:00Z';
  assert.throws(() => build(expired), /future-dated, expired/);

  const future = fixture();
  future.manifest.release.createdAt = '2026-08-02T12:02:00.000Z';
  future.manifest.releaseEvidence.observation.observedAt = '2026-08-02T12:01:00.000Z';
  future.manifest.releaseEvidence.observation.expiresAt = '2026-08-02T13:00:00.000Z';
  assert.throws(() => build(future), /future-dated, expired|fetch predates/);
});

test('release workflow and Foundry suite consume only exporter-bound mainnet fork dependencies', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '../..');
  const [workflow, forkTest] = await Promise.all([
    readFile(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'packages/contracts/test/foundry/fork/RobinhoodMainnetFork.t.sol'), 'utf8'),
  ]);
  const forkJob = workflow.slice(workflow.indexOf('\n  fork_gates:'), workflow.indexOf('\n  security_evidence:'));
  const authorizationJob = workflow.slice(workflow.indexOf('\n  candidate_authorization:'));
  assert.match(forkJob, /export-mainnet-fork-context\.mjs/);
  assert.match(forkJob, /release-mainnet-inputs\/deployment-config\.json/);
  assert.match(forkJob, /release-mainnet-inputs\/deployment-manifest\.json/);
  assert.match(forkJob, /--registry-revalidation-stage preliminary/);
  assert.match(forkJob, /--registry-response-archive/);
  assert.match(forkJob, /\.variables \| length/);
  assert.match(forkJob, /\.variables \| keys\[\]/);
  const protectedExporter = authorizationJob.indexOf('export-mainnet-fork-context.mjs');
  const protectedTransfer = authorizationJob.indexOf('--match-path test/foundry/fork/RobinhoodMainnetFork.t.sol');
  const finalVerifier = authorizationJob.indexOf('contracts:verify:mainnet');
  assert.ok(protectedExporter >= 0, 'protected authorization must independently export the final fork context');
  assert.match(authorizationJob, /--registry-revalidation-stage protected-final/);
  assert.match(authorizationJob, /protected-final-mainnet-fork-context\.json/);
  assert.doesNotMatch(authorizationJob, /--match-test test_SignedStockTokensExecuteNonzeroTransferAndTransferFrom/);
  assert.ok(
    protectedTransfer > protectedExporter,
    'nonzero stock-token transfer replay must follow protected-final context validation',
  );
  assert.ok(
    finalVerifier > protectedTransfer,
    'the final live graph verification must follow the protected fork replay',
  );
  assert.doesNotMatch(forkTest, /VERIFIED_BLOCK/);
  assert.doesNotMatch(forkTest, /address private constant (?:USDG|WETH|POOL_MANAGER|SPCX)/);
  assert.deepEqual(
    forkTest.match(/0x[0-9a-fA-F]{64}/g),
    [
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
      '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
      '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
    ],
    'only protocol-defined EIP-1967 slots may remain as 32-byte literals',
  );
  assert.doesNotMatch(
    forkTest,
    /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/,
    'fork suite must not hardcode a dependency address',
  );
  const exportedVariables = build().variables;
  const consumedVariables = [
    ...new Set([...forkTest.matchAll(/"(ROBINHOOD_MAINNET_[A-Z0-9_]+)"/g)].map((match) => match[1])),
  ].sort();
  assert.deepEqual(
    consumedVariables,
    [...Object.keys(exportedVariables), 'ROBINHOOD_MAINNET_RPC_URL'].sort(),
    'Foundry must consume every exporter value, the RPC URL, and no unsigned mainnet input',
  );
  for (const variable of [
    'ROBINHOOD_MAINNET_USDG_ADDRESS',
    'ROBINHOOD_MAINNET_WRAPPED_BTC_CODE_HASH',
    'ROBINHOOD_MAINNET_QQQ_UID',
    'ROBINHOOD_MAINNET_POSITION_DESCRIPTOR_ADDRESS',
    'ROBINHOOD_MAINNET_USDG_IMPLEMENTATION_CODE_HASH',
    'ROBINHOOD_MAINNET_USDG_UPGRADE_AUTHORITY_ADDRESS',
    'ROBINHOOD_MAINNET_WETH_IMPLEMENTATION_CODE_HASH',
    'ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_IMPLEMENTATION_CODE_HASH',
    'ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_INTERFACE',
    'ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_IMPLEMENTATION_CODE_HASH',
    'ROBINHOOD_MAINNET_WRAPPED_BTC_PROXY_ADMIN_OWNER_IMPLEMENTATION_CODE_HASH',
    'ROBINHOOD_MAINNET_WRAPPED_BTC_BEACON_CODE_HASH',
    'ROBINHOOD_MAINNET_WRAPPED_BTC_EXECUTOR_ROLE',
  ]) {
    assert.ok(Object.hasOwn(exportedVariables, variable), `mainnet context exporter does not emit ${variable}`);
    assert.ok(forkTest.includes(`"${variable}"`), `Foundry fork does not consume ${variable}`);
  }
});
