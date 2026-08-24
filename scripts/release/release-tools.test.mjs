import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, readdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzerEnvironmentLockPaths,
  analyzerEnvironmentPolicyPath,
  assertExactTrackedWorktree,
  canonicalLogoPath,
  canonicalLogoProvenancePolicyPath,
  currentReleaseToolingBlocker,
  normalizeCanonicalGithubRepositoryUrl,
  dependencyLicenseInventoryPath,
  dependencyLicenseReviewPolicyPath,
  deriveArchivedSubgraphNetworks,
  deriveSubgraphNetworks,
  deterministicJson,
  evaluateReleaseReadiness,
  resolveCanonicalGithubRepositoryUrl,
  releaseManifestSignaturePolicyPath,
  readRegularJsonBlobAtCommit,
  safeControlPlanePolicyPath,
  repositoryLicenseNoticePolicyPath,
  resolveTrackedRepositoryFile,
  validateCanonicalLogoProvenancePolicy,
  validateAnalyzerEnvironmentPolicy,
  validateManifestBinding,
  validateReleaseEvidenceCommit,
  validateReleaseManifestSignaturePolicy,
  validateReleaseTag,
  validateRepositoryLicenseNoticePolicy,
  validateRobinhoodTestnetForkEvidence,
} from './release-lib.mjs';
import { buildRobinhoodRegistryRevalidation } from './robinhood-registry-revalidation.mjs';

const analyzerEnvironmentLockfiles = Object.fromEntries(
  analyzerEnvironmentLockPaths.map((repositoryPath) => [
    repositoryPath,
    Buffer.from(`${path.basename(repositoryPath)}\nfully hash-locked fixture graph\n`, 'utf8'),
  ]),
);

const configuredAnalyzerEnvironmentPolicy = {
  bindings: ['semgrep', 'slither'].map((tool, index) => ({
    path: analyzerEnvironmentLockPaths[index],
    sha256: sha256(analyzerEnvironmentLockfiles[analyzerEnvironmentLockPaths[index]]),
    tool,
  })),
  hermetic: true,
  kind: 'gumball-6900-analyzer-environment-policy',
  mythrilImage: {
    digest: 'sha256:ca947a2a79204667ae2ae93ea6aaaca0cea669f61bc4db6958e7556ea263bd80',
    platform: 'linux/amd64',
    reference: 'mythril/myth:0.24.8@sha256:ca947a2a79204667ae2ae93ea6aaaca0cea669f61bc4db6958e7556ea263bd80',
    version: '0.24.8',
  },
  platform: 'linux-x64',
  protocol: 'GUM BALL 6900',
  pythonVersion: '3.10.20',
  releaseEligible: true,
  review: {
    reference: 'SECURITY-TOOLCHAIN-REVIEW-001',
    reviewedAt: '2025-08-02',
    reviewedBy: 'Fixture security reviewer',
  },
  schemaVersion: 2,
  state: 'configured',
};

const canonicalLogoPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const approvedLicense = Buffer.from(
  [
    'GUM BALL 6900 monorepo',
    'Licensor: Reviewed fixture licensor',
    'Operative SPDX license: BUSL-1.1',
    'Additional Use Grant: Owner-approved additional-use terms recorded in the exact LICENSE bytes.',
    'Change Date: 2030-08-01',
    'Change License SPDX identifier: Apache-2.0',
    'These fixture terms are intentionally substantive enough to exercise exact release-byte binding.',
  ].join('\n'),
  'utf8',
);
const approvedNotice = Buffer.from(
  'GUM BALL 6900 repository NOTICE. Reviewed repository and third-party notices are recorded in these exact release-bound bytes.\n',
  'utf8',
);

const configuredLicenseNoticePolicy = {
  kind: 'gumball-6900-repository-license-notice-policy',
  license: {
    additionalUseGrant: 'Owner-approved additional-use terms recorded in the exact LICENSE bytes.',
    changeDate: '2030-08-01',
    changeLicenseSpdxIdentifier: 'Apache-2.0',
    licensedWork: 'GUM BALL 6900 monorepo',
    licensor: 'Reviewed fixture licensor',
    operativeSpdxIdentifier: 'BUSL-1.1',
    path: 'LICENSE',
    sha256: sha256(approvedLicense),
  },
  notice: {
    path: 'NOTICE',
    review: {
      reference: 'LEGAL-REVIEW-FIXTURE-001',
      reviewedAt: '2026-08-01',
      reviewedBy: 'Fixture legal reviewer',
      thirdPartyNoticesReviewed: true,
    },
    sha256: sha256(approvedNotice),
  },
  protocol: 'GUM BALL 6900',
  schemaVersion: 1,
  state: 'configured',
};

const unconfiguredLicenseNoticePolicy = {
  kind: 'gumball-6900-repository-license-notice-policy',
  protocol: 'GUM BALL 6900',
  schemaVersion: 1,
  state: 'unconfigured',
};

const configuredLogoProvenancePolicy = {
  asset: {
    originalFileName: 'GUM_BALL_6900_LOGO.png',
    path: canonicalLogoPath,
    preservedOriginal: true,
    sha256: sha256(canonicalLogoPng),
    sourceReference: 'BRAND-SOURCE-FIXTURE-001',
  },
  kind: 'gumball-6900-canonical-logo-provenance-policy',
  protocol: 'GUM BALL 6900',
  rightsReview: {
    approvedScope: 'Repository, application, documentation, and release artifacts.',
    reference: 'BRAND-RIGHTS-FIXTURE-001',
    reviewedAt: '2026-08-01',
    reviewedBy: 'Fixture rights reviewer',
  },
  schemaVersion: 1,
  state: 'configured',
};

const unconfiguredLogoProvenancePolicy = {
  kind: 'gumball-6900-canonical-logo-provenance-policy',
  protocol: 'GUM BALL 6900',
  schemaVersion: 1,
  state: 'unconfigured',
};

const dependencyPnpmWorkspace = Buffer.from('packages:\n  - packages/*\n', 'utf8');
const dependencyEntries = [
  {
    license: 'BUSL-1.1',
    name: 'synthetic-release-dependency',
    versions: ['1.0.0'],
  },
];
const dependencyLicenseInventory = {
  dependencyEntriesSha256: sha256(Buffer.from(deterministicJson(dependencyEntries), 'utf8')),
  entries: dependencyEntries,
  kind: 'gumball-6900-dependency-license-inventory',
  licenseGroups: [{ license: 'BUSL-1.1', packageEntryCount: 1 }],
  packageEntryCount: 1,
  protocol: 'GUM BALL 6900',
  reviewRequiredEntries: [
    {
      classification: 'restricted',
      license: 'BUSL-1.1',
      name: 'synthetic-release-dependency',
      versions: ['1.0.0'],
    },
  ],
  schemaVersion: 1,
  source: {
    command: 'node audit/generate-dependency-license-inventory.mjs --check',
    coverage: 'synthetic complete test inventory',
    platform: 'linux-x64',
    pnpmVersion: '10.14.0',
    pnpmWorkspaceSha256: sha256(dependencyPnpmWorkspace),
  },
};
const dependencyLicenseInventoryBytes = Buffer.from(deterministicJson(dependencyLicenseInventory), 'utf8');
const dependencyPnpmLock = Buffer.from('lockfileVersion: 9.0\n', 'utf8');

const approvedDependencyLicenseReviewPolicy = {
  entries: [
    {
      classification: 'restricted',
      disposition: 'allowed',
      license: 'BUSL-1.1',
      name: 'synthetic-release-dependency',
      rationale: 'Synthetic fixture records an explicit reviewed distribution disposition for release testing.',
      releaseRelevance: 'release',
      versions: ['1.0.0'],
    },
  ],
  kind: 'gumball-6900-dependency-license-review-policy',
  licenseReportSha256: sha256(dependencyLicenseInventoryBytes),
  platform: 'linux-x64',
  pnpmLockSha256: sha256(dependencyPnpmLock),
  protocol: 'GUM BALL 6900',
  reviewedAt: '2026-08-01',
  reviewedBy: 'Fixture dependency-license reviewer',
  schemaVersion: 1,
  state: 'approved',
};

const inventoryBaselinedDependencyLicenseReviewPolicy = {
  ...approvedDependencyLicenseReviewPolicy,
  entries: approvedDependencyLicenseReviewPolicy.entries.map((entry) => ({
    ...entry,
    disposition: 'needs-counsel',
    rationale: 'Synthetic inventory baseline records no distribution decision and remains pending owner review.',
    releaseRelevance: 'undetermined',
  })),
  reviewedAt: null,
  reviewedBy: null,
  state: 'inventory-baselined',
};

const configuredReleasePolicy = {
  kind: 'gumball-6900-release-manifest-signature-policy',
  policyId: `0x${'11'.repeat(32)}`,
  protocol: 'GUM BALL 6900',
  roleQuorums: {
    economics: { authorizedSigners: ['0x0000000000000000000000000000000000000002'], threshold: 1 },
    legalCompliance: { authorizedSigners: ['0x0000000000000000000000000000000000000003'], threshold: 1 },
    operations: { authorizedSigners: ['0x0000000000000000000000000000000000000004'], threshold: 1 },
    release: { authorizedSigners: ['0x0000000000000000000000000000000000000005'], threshold: 1 },
    security: { authorizedSigners: ['0x0000000000000000000000000000000000000001'], threshold: 1 },
  },
  schemaVersion: 1,
  state: 'configured',
};

const configuredSafeControlPlanePolicy = {
  approvedSingletons: [
    {
      network: { chainId: 4663, name: 'Robinhood Chain' },
      proxyRuntimeBytecodeHashes: [`0x${'22'.repeat(32)}`],
      singletonAddress: `0x${'44'.repeat(20)}`,
      singletonRuntimeBytecodeHash: `0x${'55'.repeat(32)}`,
    },
    {
      network: { chainId: 4663, name: 'Robinhood Chain' },
      proxyRuntimeBytecodeHashes: [`0x${'77'.repeat(32)}`],
      singletonAddress: `0x${'99'.repeat(20)}`,
      singletonRuntimeBytecodeHash: `0x${'aa'.repeat(32)}`,
    },
  ],
  kind: 'gumball-6900-safe-control-plane-policy',
  protocol: 'GUM BALL 6900',
  schemaVersion: 1,
  status: 'configured',
};

const configuredReleaseAuthorizedSigners = [
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002',
  '0x0000000000000000000000000000000000000003',
  '0x0000000000000000000000000000000000000004',
  '0x0000000000000000000000000000000000000005',
];

const unconfiguredReleasePolicy = {
  kind: 'gumball-6900-release-manifest-signature-policy',
  protocol: 'GUM BALL 6900',
  schemaVersion: 1,
  state: 'unconfigured',
};

const configuredTestnetObservedAt = Date.now() - 60_000;
const configuredTestnetForkEvidence = {
  blockHash: `0x${'cd'.repeat(32)}`,
  blockNumber: '123456',
  chainId: 46630,
  dependencies: {
    usdG: {
      address: '0x0000000000000000000000000000000000000001',
      runtimeBytecodeHash: `0x${'1'.repeat(64)}`,
    },
  },
  expiresAt: new Date(configuredTestnetObservedAt + 60 * 60 * 1_000).toISOString(),
  kind: 'gumball-6900-robinhood-testnet-fork-evidence',
  observedAt: new Date(configuredTestnetObservedAt).toISOString(),
  parentBlockHash: `0x${'ab'.repeat(32)}`,
  protocol: 'GUM BALL 6900',
  schemaVersion: 1,
  sourceUrl: 'https://docs.robinhood.com/chain/contracts/',
  state: 'configured',
};

function configureTestRepository(workspace) {
  execFileSync('git', ['init', '--quiet', workspace]);
  execFileSync('git', ['-C', workspace, 'config', 'user.email', 'release-test@example.com']);
  execFileSync('git', ['-C', workspace, 'config', 'user.name', 'Release Test']);
}

function commitAll(workspace, message) {
  execFileSync('git', ['-C', workspace, 'add', '.']);
  execFileSync('git', ['-C', workspace, 'commit', '--quiet', '-m', message]);
  return execFileSync('git', ['-C', workspace, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

test('canonical GitHub repository identity is strict, normalized, and origin-bound', async () => {
  for (const remoteUrl of [
    'https://github.com/Acme/GumBall-6900.git',
    'git@github.com:Acme/GumBall-6900.git',
    'ssh://git@github.com/Acme/GumBall-6900.git',
  ]) {
    assert.equal(normalizeCanonicalGithubRepositoryUrl(remoteUrl), 'https://github.com/acme/gumball-6900');
  }
  for (const remoteUrl of [
    '',
    ' https://github.com/acme/gumball-6900.git',
    'http://github.com/acme/gumball-6900.git',
    'https://github.com/-/-.git',
    'https://github.com/acme/gumball-6900.git/extra',
    'https://github.com/acme/gumball-6900.git?redirect=evil',
    'https://github.com.evil/acme/gumball-6900.git',
    'git@evil.example:acme/gumball-6900.git',
  ]) {
    assert.equal(normalizeCanonicalGithubRepositoryUrl(remoteUrl), null);
  }

  const workspace = await mkdtemp(path.join(tmpdir(), 'gumball-release-origin-'));
  configureTestRepository(workspace);
  assert.equal(await resolveCanonicalGithubRepositoryUrl(workspace), null);
  execFileSync('git', ['-C', workspace, 'remote', 'add', 'origin', 'git@github.com:Acme/GumBall-6900.git']);
  assert.equal(await resolveCanonicalGithubRepositoryUrl(workspace), 'https://github.com/acme/gumball-6900');
  execFileSync('git', [
    '-C',
    workspace,
    'config',
    '--local',
    'url.https://github.com/unrelated/project.git.insteadOf',
    'git@github.com:Acme/GumBall-6900.git',
  ]);
  assert.equal(
    execFileSync('git', ['-C', workspace, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim(),
    'https://github.com/unrelated/project.git',
  );
  assert.equal(await resolveCanonicalGithubRepositoryUrl(workspace), 'https://github.com/acme/gumball-6900');
  execFileSync('git', [
    '-C',
    workspace,
    'remote',
    'set-url',
    'origin',
    'https://github.com/acme/gumball-6900.git/extra',
  ]);
  assert.equal(await resolveCanonicalGithubRepositoryUrl(workspace), null);
  for (const invalidOrigin of [
    ' https://github.com/acme/gumball-6900.git',
    'https://github.com/acme/gumball-6900.git ',
    'https://github.com/acme/gumball-6900.git\n',
  ]) {
    execFileSync('git', ['-C', workspace, 'config', '--local', '--replace-all', 'remote.origin.url', invalidOrigin]);
    assert.equal(await resolveCanonicalGithubRepositoryUrl(workspace), null);
  }
  execFileSync('git', [
    '-C',
    workspace,
    'config',
    '--local',
    '--replace-all',
    'remote.origin.url',
    'https://github.com/acme/gumball-6900.git',
  ]);
  execFileSync('git', [
    '-C',
    workspace,
    'config',
    '--local',
    '--add',
    'remote.origin.url',
    'https://github.com/acme/duplicate.git',
  ]);
  assert.equal(await resolveCanonicalGithubRepositoryUrl(workspace), null);
  const nestedWorkspace = path.join(workspace, 'nested');
  await mkdir(nestedWorkspace);
  assert.equal(await resolveCanonicalGithubRepositoryUrl(nestedWorkspace), null);
});

const releaseAssetCandidatePath = 'packages/config/deployments/robinhood-mainnet-assets.2026-08-02.candidate.json';
const releaseStockRegistryRecords = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'].map((symbol, index) => ({
  currentMultiplier: `${index + 1}.000000000000000000`,
  deployments: [{ chainId: 4663, contractAddress: `0x${(index + 101).toString(16).padStart(40, '0')}` }],
  id: `0x${(index + 201).toString(16).padStart(64, '0')}`,
  status: 'ASSET_STATUS_ACTIVE',
  tokenName: `${symbol} Stock Token`,
  tokenSymbol: symbol,
}));
const releaseAssetCandidateFixture = {
  assets: releaseStockRegistryRecords.map((record, index) => ({
    address: record.deployments[0].contractAddress,
    chainId: 4663,
    currentMultiplier: (BigInt(index + 1) * 10n ** 18n).toString(),
    decimals: 18,
    registryStatus: 'ASSET_STATUS_ACTIVE',
    runtimeBytecodeHash: `0x${(index + 31).toString(16).padStart(64, '0')}`,
    symbol: record.tokenSymbol,
    tokenName: record.tokenName,
    uid: record.id,
  })),
  chainId: 4663,
  deploymentApproved: false,
  kind: 'robinhood-stock-asset-manifest',
  schemaVersion: 2,
  source: {
    blockHash: `0x${'12'.repeat(32)}`,
    blockNumber: '25029999',
    blockTimestamp: '2026-08-02T00:00:00.000Z',
    observedAt: '2026-08-02T00:00:00.000Z',
    registryResponseSha256: `0x${sha256(Buffer.from(deterministicJson(releaseStockRegistryRecords), 'utf8'))}`,
    registryUrl: 'https://api.robinhood.com/rhj/assets',
  },
  status: 'generated-candidate',
};

async function createReleaseSource(prefix = 'gumball-release-evidence-') {
  const workspace = await mkdtemp(path.join(tmpdir(), prefix));
  configureTestRepository(workspace);
  await mkdir(path.join(workspace, path.dirname(releaseManifestSignaturePolicyPath)), { recursive: true });
  await writeFile(path.join(workspace, '.gitignore'), 'node_modules/\n', 'utf8');
  await writeFile(path.join(workspace, 'README.md'), 'reviewed source\n', 'utf8');
  await writeFile(
    path.join(workspace, releaseManifestSignaturePolicyPath),
    deterministicJson(configuredReleasePolicy),
    'utf8',
  );
  await writeFile(
    path.join(workspace, safeControlPlanePolicyPath),
    deterministicJson(configuredSafeControlPlanePolicy),
    'utf8',
  );
  await mkdir(path.join(workspace, path.dirname(releaseAssetCandidatePath)), { recursive: true });
  await writeFile(
    path.join(workspace, releaseAssetCandidatePath),
    deterministicJson(releaseAssetCandidateFixture),
    'utf8',
  );
  const sourceCommit = commitAll(workspace, 'reviewed source');
  return { manifestRepositoryPath: 'manifests/release.json', sourceCommit, workspace };
}

const releaseDeploymentConfigPath = 'manifests/release-deployment-config.json';
const releaseDeploymentStatePath = 'manifests/release-deployment-state.json';
const releaseDeploymentConfigFixture = {
  assetReview: {
    path: releaseAssetCandidatePath,
    rawSha256: sha256(Buffer.from(deterministicJson(releaseAssetCandidateFixture), 'utf8')),
  },
  assets: {
    assetIds: releaseAssetCandidateFixture.assets.map(({ uid }) => uid),
    decimals: releaseAssetCandidateFixture.assets.map(() => 18),
    isStockToken: releaseAssetCandidateFixture.assets.map(() => true),
    runtimeBytecodeHashes: releaseAssetCandidateFixture.assets.map(({ runtimeBytecodeHash }) => runtimeBytecodeHash),
    tokens: releaseAssetCandidateFixture.assets.map(({ address }) => address),
    uiMultipliers: releaseAssetCandidateFixture.assets.map(({ currentMultiplier }) => currentMultiplier),
  },
  kind: 'gumball-6900-deployment-config',
  network: { chainId: 4663, name: 'Robinhood Chain' },
  reviewed: true,
};
const releaseDeploymentStateFixture = { kind: 'gumball-6900-deployment-state', reviewed: true };

function releaseEvidenceEnvelope() {
  const observedAt = Date.now() - 60_000;
  const observation = {
    blockHash: `0x${'ab'.repeat(32)}`,
    blockNumber: '25030000',
    expiresAt: new Date(observedAt + 60 * 60 * 1_000).toISOString(),
    observedAt: new Date(observedAt).toISOString(),
  };
  return {
    assetCandidate: {
      path: releaseAssetCandidatePath,
      rawSha256: sha256(Buffer.from(deterministicJson(releaseAssetCandidateFixture), 'utf8')),
    },
    deploymentConfig: {
      path: releaseDeploymentConfigPath,
      rawSha256: sha256(Buffer.from(deterministicJson(releaseDeploymentConfigFixture), 'utf8')),
    },
    deploymentState: {
      path: releaseDeploymentStatePath,
      rawSha256: sha256(Buffer.from(deterministicJson(releaseDeploymentStateFixture), 'utf8')),
    },
    observation,
    protocolAdminSafe: {
      block: { hash: observation.blockHash, number: observation.blockNumber, timestamp: '1785639596' },
      enabledModules: [],
      fallbackHandler: `0x${'00'.repeat(20)}`,
      guard: `0x${'00'.repeat(20)}`,
      kind: 'gumball-6900-safe-control-plane-evidence',
      network: { chainId: 4663, name: 'Robinhood Chain' },
      nonce: '0',
      owners: [`0x${'11'.repeat(20)}`, `0x${'12'.repeat(20)}`],
      protocol: 'GUM BALL 6900',
      proxyRuntimeBytecodeHash: `0x${'22'.repeat(32)}`,
      safeAddress: `0x${'33'.repeat(20)}`,
      schemaVersion: 1,
      singletonAddress: `0x${'44'.repeat(20)}`,
      singletonRuntimeBytecodeHash: `0x${'55'.repeat(32)}`,
      threshold: '2',
    },
    emergencyGuardianSafe: {
      block: { hash: observation.blockHash, number: observation.blockNumber, timestamp: '1785639596' },
      enabledModules: [],
      fallbackHandler: `0x${'00'.repeat(20)}`,
      guard: `0x${'00'.repeat(20)}`,
      kind: 'gumball-6900-safe-control-plane-evidence',
      network: { chainId: 4663, name: 'Robinhood Chain' },
      nonce: '0',
      owners: [`0x${'66'.repeat(20)}`, `0x${'67'.repeat(20)}`],
      protocol: 'GUM BALL 6900',
      proxyRuntimeBytecodeHash: `0x${'77'.repeat(32)}`,
      safeAddress: `0x${'88'.repeat(20)}`,
      schemaVersion: 1,
      singletonAddress: `0x${'99'.repeat(20)}`,
      singletonRuntimeBytecodeHash: `0x${'aa'.repeat(32)}`,
      threshold: '2',
    },
  };
}

async function writeEvidenceFiles({ manifestRepositoryPath, sourceCommit, workspace }, manifest) {
  await mkdir(path.join(workspace, path.dirname(manifestRepositoryPath)), { recursive: true });
  await writeFile(
    path.join(workspace, releaseDeploymentConfigPath),
    deterministicJson(releaseDeploymentConfigFixture),
    'utf8',
  );
  await writeFile(
    path.join(workspace, releaseDeploymentStatePath),
    deterministicJson(releaseDeploymentStateFixture),
    'utf8',
  );
  await writeFile(
    path.join(workspace, manifestRepositoryPath),
    deterministicJson(
      manifest ?? {
        release: { createdAt: new Date().toISOString(), gitCommit: sourceCommit },
        releaseEvidence: releaseEvidenceEnvelope(),
        schemaVersion: 1,
      },
    ),
    'utf8',
  );
}

async function addEvidenceManifest({ manifestRepositoryPath, sourceCommit, workspace }) {
  await writeEvidenceFiles({ manifestRepositoryPath, sourceCommit, workspace });
  return commitAll(workspace, 'signed manifest evidence');
}

function releaseManifestFixture(sourceCommit, tag = 'v1.2.3') {
  const releaseEvidence = releaseEvidenceEnvelope();
  const deployedContracts = [
    'GBXToken',
    'GenesisBootstrap',
    'GenesisClaims',
    'MiningPool',
    'MiningClaims',
    'StakedGBX',
    'AllocationVoter',
    'RevenueRouter',
    'BuybackBurnStrategy',
    'GumBallVault',
    'AssetRegistry',
    'LiquidityManager',
  ].map((name, index) => ({
    address: `0x${(index + 1).toString(16).padStart(40, '0')}`,
    blockNumber: String(index + 100),
    name,
  }));
  return {
    assets: releaseAssetCandidateFixture.assets.map((asset) => ({
      address: asset.address,
      decimals: 18,
      key: asset.symbol,
      registryStatus: 'ASSET_STATUS_ACTIVE',
      uid: asset.uid,
      uiMultiplier: asset.currentMultiplier,
    })),
    deployedContracts,
    gates: {
      securityAudit: {
        evidence: [
          { digest: `0x${'ab'.repeat(32)}`, kind: 'audit', uri: 'https://evidence.example/security-audit.json' },
        ],
        state: 'passed',
      },
    },
    kind: 'gumball-6900-deployment-manifest',
    network: { chainId: 4663 },
    protocol: 'GUM BALL 6900',
    release: {
      createdAt: new Date(Date.parse(releaseEvidence.observation.observedAt) + 1_000).toISOString(),
      gitCommit: sourceCommit,
      status: 'release-approved',
      version: tag,
    },
    releaseEvidence,
    schemaVersion: 1,
    signaturePolicy: {
      authorizedSigners: configuredReleaseAuthorizedSigners,
      policyId: configuredReleasePolicy.policyId,
      roleQuorums: configuredReleasePolicy.roleQuorums,
      threshold: 5,
    },
    signatures: [{}],
  };
}

async function writeRegistryRevalidationInputs(release, evidenceCommit, manifest, stage = 'preliminary') {
  const directory = await mkdtemp(path.join(tmpdir(), 'gumball-registry-revalidation-'));
  const registryResponseBytes = Buffer.from(
    deterministicJson({ assets: [...releaseStockRegistryRecords, { tokenSymbol: 'OTHER' }] }),
    'utf8',
  );
  const evidenceCommitSeconds = execFileSync(
    'git',
    ['-C', release.workspace, 'show', '-s', '--format=%ct', evidenceCommit],
    { encoding: 'utf8' },
  ).trim();
  const evidenceCommitCommittedAt = new Date(Number(evidenceCommitSeconds) * 1_000).toISOString();
  const artifact = buildRobinhoodRegistryRevalidation({
    assetCandidateBytes: Buffer.from(deterministicJson(releaseAssetCandidateFixture), 'utf8'),
    configBytes: Buffer.from(deterministicJson(releaseDeploymentConfigFixture), 'utf8'),
    evidenceCommit,
    evidenceCommitCommittedAt,
    fetchedAt: new Date().toISOString(),
    manifestBytes: Buffer.from(deterministicJson(manifest), 'utf8'),
    manifestRepositoryPath: release.manifestRepositoryPath,
    registryResponseBytes,
    sourceCommit: release.sourceCommit,
    stage,
    tag: manifest.release.version,
    tagObject: 'a'.repeat(40),
  });
  const artifactPath = path.join(directory, 'robinhood-registry-revalidation.json');
  const responsePath = path.join(directory, 'robinhood-registry-response.json');
  await writeFile(artifactPath, deterministicJson(artifact), 'utf8');
  await writeFile(responsePath, registryResponseBytes);
  return { artifact, artifactPath, responsePath };
}

test('release tags use strict v-prefixed SemVer without build metadata', () => {
  for (const valid of ['v0.0.0', 'v1.2.3', 'v10.20.30-rc.1', 'v1.0.0-alpha-beta']) {
    assert.equal(validateReleaseTag(valid), valid);
  }
  for (const invalid of ['1.2.3', 'v01.2.3', 'v1.02.3', 'v1.2.03', 'v1.2', 'v1.2.3+build', 'v1.2.3-01']) {
    assert.throws(() => validateReleaseTag(invalid), /strict v-prefixed SemVer/);
  }
});

test('release workflow runs from a protected control branch and treats the evidence commit only as data', async () => {
  const workflow = await readFile(path.resolve(import.meta.dirname, '../..', '.github/workflows/release.yml'), 'utf8');
  const guardIndex = workflow.indexOf('- name: Bind workflow execution to the protected control branch');
  const firstExternalActionIndex = workflow.indexOf('- uses:');
  assert.ok(guardIndex >= 0 && guardIndex < firstExternalActionIndex, 'Dispatch binding must precede every action');
  for (const requiredBinding of [
    'RELEASE_CONTROL_REF: refs/heads/main',
    'expected_workflow_ref="$GITHUB_REPOSITORY/.github/workflows/release.yml@$RELEASE_CONTROL_REF"',
    'test "$GITHUB_EVENT_NAME" = workflow_dispatch',
    'test "$GITHUB_REF_TYPE" = branch',
    'test "$GITHUB_REF_NAME" = "${RELEASE_CONTROL_REF#refs/heads/}"',
    'test "$GITHUB_REF" = "$RELEASE_CONTROL_REF"',
    'test "$GITHUB_REF_PROTECTED" = true',
    '[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]]',
    'test "$GITHUB_SHA" = "$GITHUB_WORKFLOW_SHA"',
    'test "$GITHUB_WORKFLOW_REF" = "$expected_workflow_ref"',
  ]) {
    assert.ok(workflow.includes(requiredBinding), `Release workflow lacks binding: ${requiredBinding}`);
  }
  assert.doesNotMatch(workflow, /GITHUB_WORKFLOW_SHA" = "\$evidence_commit/);
  assert.doesNotMatch(workflow, /release\.yml@\$expected_release_ref/);
  assert.match(workflow, /test "\$source_commit" = "\$GITHUB_WORKFLOW_SHA"/);

  const resolver = workflow.slice(workflow.indexOf('\n  resolve_tag:'), workflow.indexOf('\n  release_readiness:'));
  const authorization = workflow.slice(workflow.indexOf('\n  candidate_authorization:'));
  for (const [section, candidatePath] of [
    [resolver, 'release-evidence'],
    [authorization, 'release-source'],
  ]) {
    assert.match(section, /ref: \$\{\{ github\.workflow_sha \}\}/);
    assert.ok(section.includes(`path: ${candidatePath}`), `${candidatePath} checkout is not isolated from control`);
    assert.match(section, /"\$GITHUB_WORKSPACE\/scripts\/release\/assert-tracked-worktree\.mjs"/);
  }
  assert.match(resolver, /--workspace "\$release_workspace" --commit "\$EVIDENCE_COMMIT"/);
  assert.match(authorization, /--workspace "\$RELEASE_SOURCE_WORKSPACE" --commit "\$EVIDENCE_COMMIT"/);
  assert.match(authorization, /install --frozen-lockfile --ignore-scripts/);
  assert.ok(
    authorization.indexOf('--stage protected-final') <
      authorization.indexOf('install --frozen-lockfile --ignore-scripts'),
    'Protected-final registry validation must precede dependency installation',
  );
  assert.ok(
    authorization.indexOf('install --frozen-lockfile --ignore-scripts') <
      authorization.indexOf('Bind protected-final registry evidence to the signed mainnet fork context'),
    'Control integrity must be re-proved after installation and before context export',
  );
  const authorizationHeader = authorization.slice(0, authorization.indexOf('\n    steps:'));
  assert.doesNotMatch(authorizationHeader, /ROBINHOOD_(?:MAINNET|TESTNET)_RPC_URL/);
  assert.ok(
    authorization.indexOf('ROBINHOOD_MAINNET_ARCHIVE_RPC_URL') > authorization.indexOf('install --frozen-lockfile'),
    'Protected RPC credentials must not enter checkout, proof, or dependency installation steps',
  );
});

test('release workflow pins every action to the reviewed upstream tag commit', async () => {
  const workflow = await readFile(path.resolve(import.meta.dirname, '../..', '.github/workflows/release.yml'), 'utf8');
  const reviewedActions = new Map([
    ['actions/checkout', ['de0fac2e4500dabe0009e67214ff5f5447ce83dd', 'v6.0.2']],
    ['actions/download-artifact', ['634f93cb2916e3fdff6788551b99b062d0335ce0', 'v5.0.0']],
    ['actions/setup-go', ['4dc6199c7b1a012772edbd06daecab0f50c9053c', 'v6.1.0']],
    ['actions/setup-node', ['48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e', 'v6.4.0']],
    ['actions/setup-python', ['83679a892e2d95755f2dac6acb0bfd1e9ac5d548', 'v6.1.0']],
    ['actions/upload-artifact', ['043fb46d1a93c77aae656e7c1c64a875d1fc6a0a', 'v7.0.1']],
    ['foundry-rs/foundry-toolchain', ['908c540300062bd5a7e473851cdb4282204cee09', 'v1']],
    ['github/codeql-action/analyze', ['f205ea1c3313d32999d8d6a48b4f6530d4437b38', 'v4.37.4']],
    ['github/codeql-action/init', ['f205ea1c3313d32999d8d6a48b4f6530d4437b38', 'v4.37.4']],
    ['pnpm/action-setup', ['0e279bb959325dab635dd2c09392533439d90093', 'v6.0.8']],
  ]);
  const actionLines = workflow
    .split('\n')
    .map((line) => /^\s+(?:- )?uses:\s+([^@\s]+)@([0-9a-f]{40})\s+#\s+(\S+)\s*$/.exec(line))
    .filter((match) => match !== null);
  assert.ok(actionLines.length > 0, 'Release workflow must invoke its reviewed actions');
  assert.equal(
    actionLines.length,
    workflow.split('\n').filter((line) => /^\s+(?:- )?uses:/.test(line)).length,
    'Every release action must use a full lowercase commit SHA and retain its reviewed tag comment',
  );
  const observedActions = new Set();
  for (const match of actionLines) {
    const [, action, commit, tag] = match;
    observedActions.add(action);
    assert.deepEqual(reviewedActions.get(action), [commit, tag], `Unexpected action pin for ${action}`);
  }
  assert.deepEqual([...observedActions].sort(), [...reviewedActions.keys()].sort());
});

test('every repository workflow pins external actions to reviewed full commits', async () => {
  const reviewedActions = new Map([
    ['actions/checkout', ['de0fac2e4500dabe0009e67214ff5f5447ce83dd', 'v6.0.2']],
    ['actions/download-artifact', ['634f93cb2916e3fdff6788551b99b062d0335ce0', 'v5.0.0']],
    ['actions/setup-go', ['4dc6199c7b1a012772edbd06daecab0f50c9053c', 'v6.1.0']],
    ['actions/setup-node', ['48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e', 'v6.4.0']],
    ['actions/setup-python', ['83679a892e2d95755f2dac6acb0bfd1e9ac5d548', 'v6.1.0']],
    ['actions/upload-artifact', ['043fb46d1a93c77aae656e7c1c64a875d1fc6a0a', 'v7.0.1']],
    ['foundry-rs/foundry-toolchain', ['908c540300062bd5a7e473851cdb4282204cee09', 'v1']],
    ['github/codeql-action/analyze', ['f205ea1c3313d32999d8d6a48b4f6530d4437b38', 'v4.37.4']],
    ['github/codeql-action/init', ['f205ea1c3313d32999d8d6a48b4f6530d4437b38', 'v4.37.4']],
    ['pnpm/action-setup', ['0e279bb959325dab635dd2c09392533439d90093', 'v6.0.8']],
  ]);
  const workflowDirectory = path.resolve(import.meta.dirname, '../..', '.github/workflows');
  const workflowNames = (await readdir(workflowDirectory)).filter((fileName) => /\.ya?ml$/.test(fileName)).sort();
  assert.ok(workflowNames.length > 0, 'At least one repository workflow is required');
  const workflows = await Promise.all(
    workflowNames.map(async (fileName) => [fileName, await readFile(path.join(workflowDirectory, fileName), 'utf8')]),
  );

  for (const [fileName, workflow] of workflows) {
    for (const line of workflow.split('\n').filter((candidate) => /^\s+(?:- )?uses:/.test(candidate))) {
      const target = line.replace(/^\s+(?:- )?uses:\s+/, '');
      if (target.startsWith('./')) continue;
      const match = /^([^@\s]+)@([0-9a-f]{40})\s+#\s+(\S+)\s*$/.exec(target);
      assert.ok(match, `${fileName} has a mutable or undocumented action reference: ${target}`);
      const [, action, commit, tag] = match;
      assert.deepEqual(reviewedActions.get(action), [commit, tag], `${fileName} has an unreviewed pin for ${action}`);
    }
  }
});

test('nightly mainnet reconnaissance is exact-block, provisional, read-only, and secret-scoped', async () => {
  const workflow = await readFile(path.resolve(import.meta.dirname, '../..', '.github/workflows/nightly.yml'), 'utf8');
  const start = workflow.indexOf('\n  robinhood-mainnet-recon:');
  const end = workflow.indexOf('\n  external-tooling:', start);
  assert.ok(start > 0 && end > start, 'Nightly Robinhood mainnet reconnaissance job is missing');
  const job = workflow.slice(start, end);
  const header = job.slice(0, job.indexOf('\n    steps:'));

  assert.doesNotMatch(header, /ROBINHOOD_MAINNET_(?:ARCHIVE_)?RPC_URL/);
  assert.ok(
    job.indexOf('ROBINHOOD_MAINNET_ARCHIVE_RPC_URL') > job.indexOf('pnpm install --frozen-lockfile'),
    'Archive RPC secret must not be present during dependency installation',
  );
  assert.match(job, /config:nightly:mainnet:pin/);
  assert.match(job, /--confirmation-depth 64/);
  assert.match(job, /config:manifest:assets[\s\S]+--block-number "\$\{\{ steps\.pin\.outputs\.block_number \}\}"/);
  assert.match(job, /config:manifest:wrapped-btc[\s\S]+--block-number "\$\{\{ steps\.pin\.outputs\.block_number \}\}"/);
  assert.match(job, /config:manifest:bytecode[\s\S]+--expected-hashes/);
  assert.doesNotMatch(job, /--collect-unpinned/);
  assert.match(job, /--match-path 'test\/foundry\/fork-nightly\/\*'/);
  assert.match(job, /redact-stream\.mjs" ROBINHOOD_MAINNET_RPC_URL/);
  assert.match(job, /nightly-mainnet-recon-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(job, /release-approval|deployment-manifest|authorization|--broadcast|PRIVATE_KEY/);
});

test('testnet fork export is build-bound and USDG-only', async () => {
  const exporter = await readFile(
    path.resolve(import.meta.dirname, '../../packages/config/scripts/export-testnet-fork-evidence.ts'),
    'utf8',
  );
  assert.match(exporter, /ROBINHOOD_TESTNET_FORK_BLOCK_HASH/);
  assert.match(exporter, /ROBINHOOD_TESTNET_OBSERVED_AT_UNIX/);
  assert.match(exporter, /ROBINHOOD_TESTNET_PARENT_BLOCK_HASH/);
  assert.match(exporter, /ROBINHOOD_TESTNET_USDG_ADDRESS/);
  assert.match(exporter, /ROBINHOOD_TESTNET_USDG_CODE_HASH/);
  assert.doesNotMatch(exporter, /PERMIT2|POOL_MANAGER|POSITION_MANAGER/);
});

test('candidate authorization requires fresh source-commit deep security and economics campaigns', async () => {
  const workflow = await readFile(path.resolve(import.meta.dirname, '../..', '.github/workflows/release.yml'), 'utf8');
  const contractsJob = workflow.slice(
    workflow.indexOf('\n  deep_contracts_economics:'),
    workflow.indexOf('\n  deep_external_security:'),
  );
  const externalJob = workflow.slice(
    workflow.indexOf('\n  deep_external_security:'),
    workflow.indexOf('\n  candidate_authorization:'),
  );
  const authorizationJob = workflow.slice(workflow.indexOf('\n  candidate_authorization:'));
  for (const section of [contractsJob, externalJob]) {
    assert.match(section, /ref: \$\{\{ needs\.resolve_tag\.outputs\.source_commit \}\}/);
    assert.match(section, /assert-tracked-worktree\.mjs/);
    assert.match(section, /sourceCommit=\$SOURCE_COMMIT/);
    assert.match(section, /evidenceCommit=\$EVIDENCE_COMMIT/);
    assert.match(section, /SHA256SUMS/);
    assert.match(section, /retention-days: 365/);
  }
  assert.match(contractsJob, /FOUNDRY_PROFILE: nightly/);
  assert.match(contractsJob, /100-year differential result is absent/);
  assert.match(externalJob, /resolve-analyzer-environment\.mjs/);
  assert.match(externalJob, /audit\/run-nightly\.sh/);
  assert.match(authorizationJob, /deep_contracts_economics/);
  assert.match(authorizationJob, /deep_external_security/);
});

test('protected candidate authorization revalidates exact evidence freshness and live head after approval', async () => {
  const workflow = await readFile(path.resolve(import.meta.dirname, '../..', '.github/workflows/release.yml'), 'utf8');
  const authorizationJob = workflow.slice(workflow.indexOf('\n  candidate_authorization:'));
  const evidenceRevalidation = authorizationJob.indexOf(
    'Revalidate exact evidence E after protected-environment approval',
  );
  const liveRevalidation = authorizationJob.indexOf(
    'Requery signed block and current head immediately before authorization',
  );
  const fullVerifier = authorizationJob.indexOf('contracts:verify:mainnet');
  const testnetForkFreshness = authorizationJob.indexOf('protected-final-testnet-fork-evidence.json');
  const testnetLiveVerification = authorizationJob.indexOf('fork:evidence:live:verify');
  const finalTrackedWorktreeProof = authorizationJob.lastIndexOf('scripts/release/assert-tracked-worktree.mjs');
  const authorizationEcho = authorizationJob.indexOf('Release-candidate evidence is technically authorized.');

  assert.match(authorizationJob, /^ {4}environment: release-approval$/m);
  assert.match(authorizationJob, /ref: \$\{\{ needs\.resolve_tag\.outputs\.evidence_commit \}\}/);
  assert.match(authorizationJob, /ROBINHOOD_MAINNET_ARCHIVE_RPC_URL/);
  assert.match(authorizationJob, /ROBINHOOD_TESTNET_ARCHIVE_RPC_URL/);
  assert.match(authorizationJob, /--workspace "\$RELEASE_SOURCE_WORKSPACE" --commit "\$EVIDENCE_COMMIT"/);
  assert.match(authorizationJob, /prepare-release\.mjs/);
  assert.match(authorizationJob, /--evidence-commit "\$EVIDENCE_COMMIT"/);
  assert.match(authorizationJob, /--source-commit "\$SOURCE_COMMIT"/);
  assert.match(authorizationJob, /--require-release-evidence/);
  assert.match(
    authorizationJob,
    /git -c core\.hooksPath=\/dev\/null -C "\$RELEASE_SOURCE_WORKSPACE" checkout --quiet --detach "\$SOURCE_COMMIT"/,
  );
  assert.match(authorizationJob, /foundry-rs\/foundry-toolchain@[0-9a-f]{40}/);
  assert.match(authorizationJob, /contracts:release-observation:mainnet/);
  assert.match(
    authorizationJob,
    /DEPLOYMENT_CONFIG_PATH="\$RUNNER_TEMP\/release-authorization-inputs\/deployment-config\.json"/,
  );
  assert.match(
    authorizationJob,
    /DEPLOYMENT_STATE_PATH="\$RUNNER_TEMP\/release-authorization-inputs\/deployment-state\.json"/,
  );
  assert.match(
    authorizationJob,
    /RELEASE_MANIFEST_PATH="\$RUNNER_TEMP\/release-authorization-inputs\/deployment-manifest\.json"/,
  );
  assert.match(authorizationJob, /SUBMIT_EXPLORER_VERIFICATION=false/);
  assert.match(authorizationJob, /contracts:verify:mainnet/);
  assert.match(authorizationJob, /release-authorization-inputs\/deployment-manifest\.json/);
  assert.ok(evidenceRevalidation >= 0, 'Post-approval evidence revalidation step is missing');
  assert.ok(liveRevalidation > evidenceRevalidation, 'Live observation revalidation must follow exact-E validation');
  assert.ok(fullVerifier > liveRevalidation, 'Full manifest verification must follow the live observation precheck');
  assert.ok(testnetForkFreshness > fullVerifier, 'Testnet fork freshness must be rechecked after full verification');
  assert.ok(
    testnetLiveVerification > testnetForkFreshness,
    'Live testnet header verification must follow the local signed-evidence freshness check',
  );
  assert.match(authorizationJob, /redact-stream\.mjs" ROBINHOOD_TESTNET_RPC_URL/);
  assert.match(authorizationJob, /gumball-6900-protected-authorization-context/);
  assert.match(authorizationJob, /GITHUB_RUN_ATTEMPT/);
  assert.match(authorizationJob, /GITHUB_RUN_ID/);
  assert.match(authorizationJob, /GITHUB_WORKFLOW_REF/);
  assert.ok(
    finalTrackedWorktreeProof > testnetLiveVerification,
    'Tracked source must be reproved after full manifest and live fork-evidence verification',
  );
  assert.ok(
    authorizationEcho > finalTrackedWorktreeProof,
    'Authorization must follow full verification and source proof',
  );
});

test('release workspace gates enforce checked-in generated documentation', async () => {
  const workflow = await readFile(path.resolve(import.meta.dirname, '../..', '.github/workflows/release.yml'), 'utf8');
  const gateStart = workflow.indexOf('- name: Run complete available workspace gates');
  const nextStep = workflow.indexOf('\n      - name:', gateStart + 1);
  assert.ok(gateStart >= 0 && nextStep > gateStart, 'Offline workspace gate step is missing');
  assert.match(workflow.slice(gateStart, nextStep), /^\s+pnpm docs:check$/m);
});

test('release readiness binds analyzer locks only after exact tracked-worktree proof', async () => {
  const workflow = await readFile(path.resolve(import.meta.dirname, '../..', '.github/workflows/release.yml'), 'utf8');
  const readiness = workflow.slice(workflow.indexOf('\n  release_readiness:'), workflow.indexOf('\n  offline_gates:'));
  const trackedProof = readiness.indexOf('scripts/release/assert-tracked-worktree.mjs');
  const readinessCheck = readiness.indexOf('scripts/release/check-release-readiness.mjs');
  assert.ok(trackedProof >= 0, 'Release readiness omits the exact tracked-worktree proof');
  assert.ok(readinessCheck > trackedProof, 'Release readiness reads analyzer locks before tracked-worktree proof');
});

test('PR, main, and release archive CodeQL and both contract coverage reports', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '../..');
  const [pullRequest, main, release, packager] = await Promise.all([
    readFile(path.join(repositoryRoot, '.github/workflows/pr.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/main.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'scripts/release/package-offline-evidence.sh'), 'utf8'),
  ]);
  const pullRequestCodeql = pullRequest.slice(pullRequest.indexOf('\n  codeql:'));
  const releaseSecurity = release.slice(
    release.indexOf('\n  security_evidence:'),
    release.indexOf('\n  candidate_authorization:'),
  );
  for (const workflowSection of [pullRequestCodeql, releaseSecurity]) {
    assert.match(workflowSection, /github\/codeql-action\/analyze@[0-9a-f]{40}/);
    assert.match(workflowSection, /post-processed-sarif-path:/);
    assert.match(workflowSection, /^\s+upload: always$/m);
    assert.match(workflowSection, /archive-audit-reports\.mjs \\\n\s+codeql /);
  }
  assert.match(pullRequestCodeql, /audit\/reports\/codeql-javascript-typescript\.sarif/);
  assert.match(releaseSecurity, /^\s+security-events: write$/m);
  assert.match(releaseSecurity, /cp -R packages\/contracts\/audit\/reports/);
  assert.match(releaseSecurity, /packages\/contracts\/audit\/analyzer-environment-policy\.json/);
  for (const analyzerLockPath of analyzerEnvironmentLockPaths) {
    assert.ok(releaseSecurity.includes(analyzerLockPath), `Release security evidence omits ${analyzerLockPath}`);
    assert.ok(packager.includes(analyzerLockPath), `Offline release evidence omits ${analyzerLockPath}`);
  }
  assert.match(main, /audit:reports:coverage/);
  assert.match(release, /audit:reports:coverage/);
  for (const filename of [
    'forge-coverage.lcov',
    'forge-coverage-summary.json',
    'hardhat-coverage.lcov',
    'hardhat-coverage-summary.json',
  ]) {
    assert.ok(packager.includes(filename), `Release evidence packager omits ${filename}`);
  }
});

test('manifest path is normalized, repository-confined, and tracked', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'gumball-release-path-'));
  configureTestRepository(workspace);
  await mkdir(path.join(workspace, 'manifests'));
  await writeFile(path.join(workspace, 'manifests/release.json'), '{}\n');
  const commit = commitAll(workspace, 'release manifest');
  const options = { commit, label: 'Deployment manifest' };

  const resolved = await resolveTrackedRepositoryFile(workspace, 'manifests/release.json', options);
  assert.equal(resolved.repositoryPath, 'manifests/release.json');
  await assert.rejects(resolveTrackedRepositoryFile(workspace, '../release.json', options), /parent-directory/);
  await assert.rejects(resolveTrackedRepositoryFile(workspace, 'manifests/release file.json', options), /POSIX path/);
  await writeFile(path.join(workspace, 'manifests/untracked.json'), '{}\n');
  await assert.rejects(resolveTrackedRepositoryFile(workspace, 'manifests/untracked.json', options), /tracked/);

  const outside = await mkdtemp(path.join(tmpdir(), 'gumball-release-outside-'));
  await writeFile(path.join(outside, 'release.json'), '{}\n');
  await symlink(outside, path.join(workspace, 'linked'));
  await assert.rejects(resolveTrackedRepositoryFile(workspace, 'linked/release.json', options), /symlink ancestry/);
});

test('release JSON proof compares raw bytes and exact 100644 mode with the requested commit', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'gumball-release-blob-'));
  configureTestRepository(workspace);
  await mkdir(path.join(workspace, 'manifests'));
  const manifestPath = path.join(workspace, 'manifests/release.json');
  await writeFile(manifestPath, '{"reviewed":true}\n');
  const commit = commitAll(workspace, 'reviewed bytes');
  const options = { commit, label: 'Deployment manifest' };

  await writeFile(manifestPath, '{"reviewed":null}\n');
  execFileSync('git', ['-C', workspace, 'update-index', '--assume-unchanged', 'manifests/release.json']);
  await assert.rejects(
    resolveTrackedRepositoryFile(workspace, 'manifests/release.json', options),
    /raw worktree bytes/,
  );

  await writeFile(manifestPath, '{"reviewed":true}\n');
  await chmod(manifestPath, 0o755);
  await assert.rejects(resolveTrackedRepositoryFile(workspace, 'manifests/release.json', options), /nonexecutable/);

  await chmod(manifestPath, 0o755);
  execFileSync('git', ['-C', workspace, 'update-index', '--no-assume-unchanged', 'manifests/release.json']);
  const executableCommit = commitAll(workspace, 'executable JSON');
  await chmod(manifestPath, 0o644);
  await assert.rejects(
    resolveTrackedRepositoryFile(workspace, 'manifests/release.json', {
      commit: executableCommit,
      label: 'Deployment manifest',
    }),
    /100644 blob/,
  );
});

test('release JSON proof ignores inherited Git redirection to a clean decoy', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'gumball-release-real-'));
  configureTestRepository(workspace);
  await mkdir(path.join(workspace, 'manifests'));
  await writeFile(path.join(workspace, 'manifests/release.json'), '{"reviewed":true}\n');
  const commit = commitAll(workspace, 'reviewed release');
  const decoyParent = await mkdtemp(path.join(tmpdir(), 'gumball-release-decoy-'));
  const decoy = path.join(decoyParent, 'repository');
  execFileSync('git', ['clone', '--quiet', workspace, decoy]);
  await writeFile(path.join(workspace, 'manifests/release.json'), '{"reviewed":false}\n');

  const previousGitDirectory = process.env.GIT_DIR;
  const previousGitWorktree = process.env.GIT_WORK_TREE;
  process.env.GIT_DIR = path.join(decoy, '.git');
  process.env.GIT_WORK_TREE = decoy;
  try {
    await assert.rejects(
      resolveTrackedRepositoryFile(workspace, 'manifests/release.json', {
        commit,
        label: 'Deployment manifest',
      }),
      /raw worktree bytes/,
    );
  } finally {
    if (previousGitDirectory === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previousGitDirectory;
    if (previousGitWorktree === undefined) delete process.env.GIT_WORK_TREE;
    else process.env.GIT_WORK_TREE = previousGitWorktree;
  }
});

test('release JSON proof disables replacement commits', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'gumball-release-replacement-'));
  configureTestRepository(workspace);
  await mkdir(path.join(workspace, 'manifests'));
  const manifestPath = path.join(workspace, 'manifests/release.json');
  await writeFile(manifestPath, '{"reviewed":true}\n');
  const commit = commitAll(workspace, 'reviewed release');
  await writeFile(manifestPath, '{"reviewed":false}\n');
  execFileSync('git', ['-C', workspace, 'add', 'manifests/release.json']);
  const replacementTree = execFileSync('git', ['-C', workspace, 'write-tree'], { encoding: 'utf8' }).trim();
  const replacementCommit = execFileSync(
    'git',
    ['-C', workspace, 'commit-tree', replacementTree, '-p', commit, '-m', 'replacement release'],
    { encoding: 'utf8' },
  ).trim();
  execFileSync('git', ['-C', workspace, 'replace', commit, replacementCommit]);

  await assert.rejects(
    resolveTrackedRepositoryFile(workspace, 'manifests/release.json', {
      commit,
      label: 'Deployment manifest',
    }),
    /raw worktree bytes/,
  );
});

test('release evidence commit has one source parent and adds only the exact signed manifest and snapshots', async () => {
  const release = await createReleaseSource();
  const evidenceCommit = await addEvidenceManifest(release);
  const result = await validateReleaseEvidenceCommit({ ...release, evidenceCommit });
  assert.equal(result.manifestFile.repositoryPath, release.manifestRepositoryPath);
  assert.equal(result.assetCandidateFile.repositoryPath, releaseAssetCandidatePath);
  assert.equal(result.configFile.repositoryPath, releaseDeploymentConfigPath);
  assert.equal(result.stateFile.repositoryPath, releaseDeploymentStatePath);
  assert.equal(result.policyFile.repositoryPath, releaseManifestSignaturePolicyPath);
});

test('reads the fixed Safe policy from source C while workspace HEAD remains evidence E', async () => {
  const release = await createReleaseSource();
  const evidenceCommit = await addEvidenceManifest(release);
  assert.equal(
    execFileSync('git', ['-C', release.workspace, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    evidenceCommit,
  );
  const bytes = await readRegularJsonBlobAtCommit(release.workspace, safeControlPlanePolicyPath, {
    commit: release.sourceCommit,
    label: 'Safe control-plane policy',
  });
  assert.deepEqual(JSON.parse(bytes.toString('utf8')), configuredSafeControlPlanePolicy);
});

test('release evidence rejects a snapshot whose raw bytes do not match the signed SHA-256', async () => {
  const release = await createReleaseSource('gumball-release-snapshot-hash-');
  await writeEvidenceFiles(release);
  await writeFile(
    path.join(release.workspace, releaseDeploymentConfigPath),
    deterministicJson({ ...releaseDeploymentConfigFixture, reviewed: false }),
    'utf8',
  );
  const evidenceCommit = commitAll(release.workspace, 'mutated snapshot evidence');
  await assert.rejects(
    validateReleaseEvidenceCommit({ ...release, evidenceCommit }),
    /raw bytes do not match the SHA-256 signed in the manifest/,
  );
});

test('prepare-release rejects archived evidence before writing current release outputs', async () => {
  const release = await createReleaseSource('gumball-release-prepare-');
  const expectedManifest = releaseManifestFixture(release.sourceCommit);
  await writeEvidenceFiles(release, expectedManifest);
  const evidenceCommit = commitAll(release.workspace, 'release evidence');
  const registry = await writeRegistryRevalidationInputs(release, evidenceCommit, expectedManifest);
  const outputDirectory = await mkdtemp(path.join(tmpdir(), 'gumball-release-prepared-'));
  const result = spawnSync(
    process.execPath,
    [
      path.join(import.meta.dirname, 'prepare-release.mjs'),
      '--workspace',
      release.workspace,
      '--manifest',
      release.manifestRepositoryPath,
      '--tag',
      'v1.2.3',
      '--tag-object',
      'a'.repeat(40),
      '--evidence-commit',
      evidenceCommit,
      '--source-commit',
      release.sourceCommit,
      '--output-dir',
      outputDirectory,
      '--registry-revalidation',
      registry.artifactPath,
      '--registry-revalidation-stage',
      'preliminary',
      '--registry-response-archive',
      registry.responsePath,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Current external-governance deployment\/release tooling is unavailable/);
  assert.deepEqual(await readdir(outputDirectory), []);
});

test('release evidence rejects a post-commit manifest mutation', async () => {
  const release = await createReleaseSource('gumball-release-mutation-');
  const evidenceCommit = await addEvidenceManifest(release);
  await writeFile(
    path.join(release.workspace, release.manifestRepositoryPath),
    deterministicJson({ release: { gitCommit: 'f'.repeat(40) } }),
    'utf8',
  );
  await assert.rejects(validateReleaseEvidenceCommit({ ...release, evidenceCommit }), /raw worktree bytes/);
});

test('release evidence rejects a multiple-parent evidence commit', async () => {
  const release = await createReleaseSource('gumball-release-merge-');
  const sourceTree = execFileSync('git', ['-C', release.workspace, 'rev-parse', `${release.sourceCommit}^{tree}`], {
    encoding: 'utf8',
  }).trim();
  const otherParent = execFileSync(
    'git',
    ['-C', release.workspace, 'commit-tree', sourceTree, '-p', release.sourceCommit, '-m', 'other parent'],
    { encoding: 'utf8' },
  ).trim();
  await mkdir(path.join(release.workspace, path.dirname(release.manifestRepositoryPath)), { recursive: true });
  await writeFile(
    path.join(release.workspace, release.manifestRepositoryPath),
    deterministicJson({ release: { gitCommit: release.sourceCommit } }),
    'utf8',
  );
  execFileSync('git', ['-C', release.workspace, 'add', release.manifestRepositoryPath]);
  const evidenceTree = execFileSync('git', ['-C', release.workspace, 'write-tree'], { encoding: 'utf8' }).trim();
  const evidenceCommit = execFileSync(
    'git',
    [
      '-C',
      release.workspace,
      'commit-tree',
      evidenceTree,
      '-p',
      release.sourceCommit,
      '-p',
      otherParent,
      '-m',
      'merge evidence',
    ],
    { encoding: 'utf8' },
  ).trim();
  execFileSync('git', ['-C', release.workspace, 'checkout', '--quiet', '--detach', evidenceCommit]);
  await assert.rejects(
    validateReleaseEvidenceCommit({ ...release, evidenceCommit }),
    /exactly the declared source commit as its sole parent/,
  );
});

test('release evidence rejects every extra source-tree change', async () => {
  const release = await createReleaseSource('gumball-release-extra-');
  await writeEvidenceFiles(release);
  await writeFile(path.join(release.workspace, 'README.md'), 'mutated source\n', 'utf8');
  const evidenceCommit = commitAll(release.workspace, 'manifest plus extra change');
  await assert.rejects(
    validateReleaseEvidenceCommit({ ...release, evidenceCommit }),
    /may only add regular declared evidence files/,
  );
});

test('release evidence rejects a changed trust-root policy', async () => {
  const release = await createReleaseSource('gumball-release-policy-change-');
  await writeEvidenceFiles(release);
  await writeFile(
    path.join(release.workspace, releaseManifestSignaturePolicyPath),
    deterministicJson({ ...configuredReleasePolicy, policyId: `0x${'22'.repeat(32)}` }),
    'utf8',
  );
  const evidenceCommit = commitAll(release.workspace, 'manifest plus changed policy');
  await assert.rejects(
    validateReleaseEvidenceCommit({ ...release, evidenceCommit }),
    /policy must be byte-identical in source and evidence commits/,
  );
});

test('tracked worktree proof allows ignored dependencies but rejects source mutation', async () => {
  const release = await createReleaseSource('gumball-release-install-proof-');
  await assert.doesNotReject(assertExactTrackedWorktree(release.workspace, release.sourceCommit));
  await mkdir(path.join(release.workspace, 'node_modules', 'dependency'), { recursive: true });
  await writeFile(path.join(release.workspace, 'node_modules', 'dependency', 'index.js'), 'ignored output\n', 'utf8');
  await assert.doesNotReject(assertExactTrackedWorktree(release.workspace, release.sourceCommit));
  await writeFile(path.join(release.workspace, 'README.md'), 'mutated after install\n', 'utf8');
  await assert.rejects(assertExactTrackedWorktree(release.workspace, release.sourceCommit), /raw worktree bytes/);
});

test('archived release manifest validation remains inspectable while current subgraph derivation fails closed', () => {
  const commit = '1'.repeat(40);
  const tag = 'v1.2.3';
  const manifest = releaseManifestFixture(commit, tag);
  assert.equal(
    validateManifestBinding(manifest, { signaturePolicy: configuredReleasePolicy, sourceCommit: commit, tag }),
    manifest,
  );
  assert.equal(deriveArchivedSubgraphNetworks(manifest).robinhood.GBXToken.startBlock, 100);
  assert.throws(() => deriveSubgraphNetworks(manifest), /Current external-governance deployment\/release tooling/);
  assert.throws(
    () =>
      validateManifestBinding(
        { ...manifest, release: { ...manifest.release, gitCommit: '2'.repeat(40) } },
        { signaturePolicy: configuredReleasePolicy, sourceCommit: commit, tag },
      ),
    /source commit/,
  );
  const future = structuredClone(manifest);
  future.release.createdAt = new Date(Date.now() + 60_000).toISOString();
  future.releaseEvidence.observation.observedAt = future.release.createdAt;
  future.releaseEvidence.observation.expiresAt = new Date(Date.now() + 120_000).toISOString();
  assert.throws(
    () => validateManifestBinding(future, { signaturePolicy: configuredReleasePolicy, sourceCommit: commit, tag }),
    /createdAt must not be in the future/,
  );
  const expired = structuredClone(manifest);
  expired.release.createdAt = new Date(Date.now() - 120_000).toISOString();
  expired.releaseEvidence.observation.observedAt = expired.release.createdAt;
  expired.releaseEvidence.observation.expiresAt = new Date(Date.now() - 60_000).toISOString();
  assert.throws(
    () => validateManifestBinding(expired, { signaturePolicy: configuredReleasePolicy, sourceCommit: commit, tag }),
    /observation evidence has expired/,
  );
  assert.throws(
    () => deriveArchivedSubgraphNetworks({ ...manifest, deployedContracts: manifest.deployedContracts.slice(1) }),
    /lacks subgraph contract GBXToken/,
  );
  assert.throws(
    () =>
      validateManifestBinding(
        {
          ...manifest,
          signaturePolicy: { ...manifest.signaturePolicy, policyId: `0x${'22'.repeat(32)}` },
        },
        { signaturePolicy: configuredReleasePolicy, sourceCommit: commit, tag },
      ),
    /does not exactly match/,
  );
  assert.throws(
    () =>
      validateManifestBinding(
        {
          ...manifest,
          gates: {
            securityAudit: { evidence: [{ kind: 'audit', uri: 'https://evidence.example/audit' }], state: 'passed' },
          },
        },
        { signaturePolicy: configuredReleasePolicy, sourceCommit: commit, tag },
      ),
    /not hash-bound/,
  );
  assert.throws(
    () =>
      validateManifestBinding(
        {
          ...manifest,
          gates: {
            securityAudit: {
              evidence: [{ digest: `0x${'ab'.repeat(32)}`, kind: 'audit', uri: 'file:///tmp/audit' }],
              state: 'passed',
            },
          },
        },
        { signaturePolicy: configuredReleasePolicy, sourceCommit: commit, tag },
      ),
    /durable URI/,
  );
});

test('release-manifest signer policy is strict and requires distinct role quorums', () => {
  assert.equal(validateReleaseManifestSignaturePolicy(configuredReleasePolicy), configuredReleasePolicy);
  assert.equal(
    validateReleaseManifestSignaturePolicy(unconfiguredReleasePolicy, { requireConfigured: false }),
    unconfiguredReleasePolicy,
  );
  assert.throws(() => validateReleaseManifestSignaturePolicy(unconfiguredReleasePolicy), /unconfigured/);
  assert.throws(
    () => validateReleaseManifestSignaturePolicy({ ...configuredReleasePolicy, extra: true }),
    /fields are invalid/,
  );
  assert.throws(
    () =>
      validateReleaseManifestSignaturePolicy({
        ...configuredReleasePolicy,
        roleQuorums: {
          ...configuredReleasePolicy.roleQuorums,
          economics: configuredReleasePolicy.roleQuorums.security,
        },
      }),
    /globally distinct/,
  );
  assert.throws(
    () =>
      validateReleaseManifestSignaturePolicy({
        ...configuredReleasePolicy,
        roleQuorums: {
          ...configuredReleasePolicy.roleQuorums,
          operations: { ...configuredReleasePolicy.roleQuorums.operations, threshold: 2 },
        },
      }),
    /operations signer-role quorum threshold/,
  );
});

test('repository license and NOTICE policy is exact, hash-bound, and review-complete', () => {
  assert.equal(validateRepositoryLicenseNoticePolicy(configuredLicenseNoticePolicy), configuredLicenseNoticePolicy);
  assert.equal(
    validateRepositoryLicenseNoticePolicy(unconfiguredLicenseNoticePolicy, { requireConfigured: false }),
    unconfiguredLicenseNoticePolicy,
  );
  assert.throws(() => validateRepositoryLicenseNoticePolicy(unconfiguredLicenseNoticePolicy), /unconfigured/);
  assert.throws(
    () => validateRepositoryLicenseNoticePolicy({ ...configuredLicenseNoticePolicy, extra: true }),
    /fields are invalid/,
  );
  assert.throws(
    () =>
      validateRepositoryLicenseNoticePolicy({
        ...configuredLicenseNoticePolicy,
        license: { ...configuredLicenseNoticePolicy.license, sha256: 'f'.repeat(63) },
      }),
    /SHA-256/,
  );
  assert.throws(
    () =>
      validateRepositoryLicenseNoticePolicy({
        ...configuredLicenseNoticePolicy,
        license: { ...configuredLicenseNoticePolicy.license, changeDate: '2030-02-30' },
      }),
    /calendar date/,
  );
  assert.throws(
    () =>
      validateRepositoryLicenseNoticePolicy({
        ...configuredLicenseNoticePolicy,
        license: { ...configuredLicenseNoticePolicy.license, additionalUseGrant: 'TBD' },
      }),
    /additional-use grant/,
  );
  assert.throws(
    () =>
      validateRepositoryLicenseNoticePolicy({
        ...configuredLicenseNoticePolicy,
        license: { ...configuredLicenseNoticePolicy.license, operativeSpdxIdentifier: 'TBD' },
      }),
    /SPDX identifier/,
  );
  assert.throws(
    () =>
      validateRepositoryLicenseNoticePolicy({
        ...configuredLicenseNoticePolicy,
        license: { ...configuredLicenseNoticePolicy.license, licensor: 'N/A' },
      }),
    /licensor/,
  );
  assert.throws(
    () =>
      validateRepositoryLicenseNoticePolicy({
        ...configuredLicenseNoticePolicy,
        notice: {
          ...configuredLicenseNoticePolicy.notice,
          review: { ...configuredLicenseNoticePolicy.notice.review, thirdPartyNoticesReviewed: false },
        },
      }),
    /not approved/,
  );
  assert.throws(
    () =>
      validateRepositoryLicenseNoticePolicy({
        ...configuredLicenseNoticePolicy,
        notice: {
          ...configuredLicenseNoticePolicy.notice,
          review: { ...configuredLicenseNoticePolicy.notice.review, reviewedAt: '9999-12-31' },
        },
      }),
    /not approved/,
  );
});

test('canonical-logo provenance policy binds an approved original and rights review', () => {
  assert.equal(validateCanonicalLogoProvenancePolicy(configuredLogoProvenancePolicy), configuredLogoProvenancePolicy);
  assert.equal(
    validateCanonicalLogoProvenancePolicy(unconfiguredLogoProvenancePolicy, { requireConfigured: false }),
    unconfiguredLogoProvenancePolicy,
  );
  assert.throws(() => validateCanonicalLogoProvenancePolicy(unconfiguredLogoProvenancePolicy), /unconfigured/);
  assert.throws(
    () =>
      validateCanonicalLogoProvenancePolicy({
        ...configuredLogoProvenancePolicy,
        asset: { ...configuredLogoProvenancePolicy.asset, path: 'apps/web/public/brand/other.png' },
      }),
    /source asset metadata/,
  );
  assert.throws(
    () =>
      validateCanonicalLogoProvenancePolicy({
        ...configuredLogoProvenancePolicy,
        asset: { ...configuredLogoProvenancePolicy.asset, preservedOriginal: false },
      }),
    /source asset metadata/,
  );
  assert.throws(
    () =>
      validateCanonicalLogoProvenancePolicy({
        ...configuredLogoProvenancePolicy,
        rightsReview: { ...configuredLogoProvenancePolicy.rightsReview, reference: 'PLACEHOLDER' },
      }),
    /rights-review/,
  );
  assert.throws(
    () =>
      validateCanonicalLogoProvenancePolicy({
        ...configuredLogoProvenancePolicy,
        asset: { ...configuredLogoProvenancePolicy.asset, originalFileName: 'fake.png' },
      }),
    /source asset metadata/,
  );
  assert.throws(
    () =>
      validateCanonicalLogoProvenancePolicy({
        ...configuredLogoProvenancePolicy,
        rightsReview: { ...configuredLogoProvenancePolicy.rightsReview, reviewedAt: '9999-12-31' },
      }),
    /rights-review/,
  );
});

test('readiness requires hash-bound license, notice, logo provenance, and private security contact', () => {
  const blockers = evaluateReleaseReadiness({
    license: null,
    notice: null,
    readme: '',
    releaseManifestSignaturePolicy: null,
    security: null,
  });
  assert.ok(
    blockers.includes(`Canonical logo is missing or is not a CRC-valid, decodable PNG at ${canonicalLogoPath}`),
  );
  assert.ok(blockers.includes(`Canonical-logo provenance policy is missing at ${canonicalLogoProvenancePolicyPath}`));
  assert.ok(blockers.includes('LICENSE is missing or is not substantive canonical UTF-8 text at LICENSE'));
  assert.ok(blockers.includes('NOTICE is missing or is not substantive canonical UTF-8 text at NOTICE'));
  assert.ok(blockers.includes(`Repository license/NOTICE policy is missing at ${repositoryLicenseNoticePolicyPath}`));
  assert.ok(blockers.includes(`Dependency license review policy is missing at ${dependencyLicenseReviewPolicyPath}`));
  assert.ok(blockers.includes(`Analyzer environment policy is missing at ${analyzerEnvironmentPolicyPath}`));
  assert.ok(blockers.includes('Canonical GitHub repository origin is unavailable or invalid'));
  const approvedInputs = {
    analyzerEnvironmentLockfiles,
    analyzerEnvironmentPolicy: configuredAnalyzerEnvironmentPolicy,
    canonicalLogo: canonicalLogoPng,
    canonicalLogoProvenancePolicy: configuredLogoProvenancePolicy,
    canonicalRepositoryUrl: 'https://github.com/acme/gumball-6900',
    dependencyLicenseInventory: dependencyLicenseInventoryBytes,
    dependencyLicenseReviewPolicy: approvedDependencyLicenseReviewPolicy,
    license: approvedLicense,
    notice: approvedNotice,
    packageLicense: 'BUSL-1.1',
    pnpmLock: dependencyPnpmLock,
    pnpmWorkspace: dependencyPnpmWorkspace,
    readme: '# Ready\n\n## License\n\nReleased under BUSL-1.1. See [LICENSE](LICENSE) and [NOTICE](NOTICE).\n',
    releaseManifestSignaturePolicy: configuredReleasePolicy,
    safeControlPlanePolicy: configuredSafeControlPlanePolicy,
    repositoryLicenseNoticePolicy: configuredLicenseNoticePolicy,
    robinhoodTestnetForkEvidence: configuredTestnetForkEvidence,
    security:
      '# Security\n\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n\nDo not file public issues.',
  };
  assert.deepEqual(evaluateReleaseReadiness(approvedInputs), [currentReleaseToolingBlocker]);
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      safeControlPlanePolicy: {
        ...configuredSafeControlPlanePolicy,
        approvedSingletons: [{ ...configuredSafeControlPlanePolicy.approvedSingletons[0], unexpected: true }],
      },
    }).join('\n'),
    /Safe control-plane policy is not release-valid/,
  );
  assert.equal(
    validateAnalyzerEnvironmentPolicy(configuredAnalyzerEnvironmentPolicy, {
      lockfileBytes: analyzerEnvironmentLockfiles,
    }),
    configuredAnalyzerEnvironmentPolicy,
  );
  assert.throws(
    () => validateAnalyzerEnvironmentPolicy(configuredAnalyzerEnvironmentPolicy),
    /requires the exact two analyzer lock files/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      analyzerEnvironmentPolicy: {
        ...configuredAnalyzerEnvironmentPolicy,
        releaseEligible: false,
        review: null,
        state: 'dependencies-prepared',
      },
    }).join('\n'),
    /independent security review is not configured/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      analyzerEnvironmentLockfiles: {
        ...analyzerEnvironmentLockfiles,
        [analyzerEnvironmentLockPaths[0]]: null,
      },
    }).join('\n'),
    /lock file is missing or not regular/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      analyzerEnvironmentLockfiles: {
        ...analyzerEnvironmentLockfiles,
        [analyzerEnvironmentLockPaths[1]]: Buffer.from('tampered lock bytes\n'),
      },
    }).join('\n'),
    /lock file SHA-256 mismatch/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      analyzerEnvironmentPolicy: {
        hermetic: false,
        kind: 'gumball-6900-analyzer-environment-policy',
        protocol: 'GUM BALL 6900',
        pythonVersion: '3.10.20',
        releaseEligible: false,
        schemaVersion: 2,
        state: 'transitive-dependencies-unlocked',
      },
    }).join('\n'),
    /transitive dependencies are not hash-locked/,
  );
  assert.deepEqual(
    evaluateReleaseReadiness({
      ...approvedInputs,
      security:
        'Private reporting endpoint: <https://github.com/acme/gumball-6900/security/advisories/new>\nUse this private channel only.',
    }),
    [currentReleaseToolingBlocker],
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      releaseManifestSignaturePolicy: unconfiguredReleasePolicy,
    }).join('\n'),
    /unconfigured/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      canonicalLogo: Buffer.from('not a png'),
    }).join('\n'),
    /Canonical logo/,
  );
  const corruptPng = Buffer.from(canonicalLogoPng);
  corruptPng[corruptPng.length - 1] ^= 0xff;
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      canonicalLogo: corruptPng,
      canonicalLogoProvenancePolicy: {
        ...configuredLogoProvenancePolicy,
        asset: { ...configuredLogoProvenancePolicy.asset, sha256: sha256(corruptPng) },
      },
    }).join('\n'),
    /CRC-valid, decodable PNG/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      license: Buffer.from('different approved-looking text'),
    }).join('\n'),
    /LICENSE SHA-256/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      notice: Buffer.from('different notice text'),
    }).join('\n'),
    /NOTICE SHA-256/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      canonicalLogo: Buffer.from(canonicalLogoPng).fill(0, canonicalLogoPng.length - 1),
    }).join('\n'),
    /Canonical logo SHA-256/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      packageLicense: 'MIT',
    }).join('\n'),
    /operative SPDX/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      license: Buffer.alloc(0),
      repositoryLicenseNoticePolicy: {
        ...configuredLicenseNoticePolicy,
        license: { ...configuredLicenseNoticePolicy.license, sha256: sha256(Buffer.alloc(0)) },
      },
    }).join('\n'),
    /substantive canonical UTF-8/,
  );
  assert.match(evaluateReleaseReadiness({ ...approvedInputs, readme: '' }).join('\n'), /positive License section/);
  assert.match(
    evaluateReleaseReadiness({ ...approvedInputs, readme: '# Ready\n\n## License\n\nLicense: unresolved.\n' }).join(
      '\n',
    ),
    /not tied to the configured SPDX identifier/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      readme:
        '# Ready\n\n## License\n\nNo license has been selected or approved. BUSL-1.1. See [LICENSE](LICENSE) and [NOTICE](NOTICE).\n',
    }).join('\n'),
    /not tied to the configured SPDX identifier/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      security: 'Report vulnerabilities privately to security@does-not-exist.invalid and never file public issues.',
    }).join('\n'),
    /lacks the exact canonical-repository private vulnerability-reporting endpoint/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      security: 'Report vulnerabilities privately to security@does-not-exist.zzz and never file public issues.',
    }).join('\n'),
    /lacks the exact canonical-repository private vulnerability-reporting endpoint/,
  );
  for (const security of [
    'Private reporting endpoint: [Open a private vulnerability report](https://github.com/no-such-owner/no-such-repo/security/advisories/new)',
    'Private reporting endpoint: [Open a private vulnerability report](https://github.com/-/-/security/advisories/new)',
    'Private reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new.evil)',
    'Private reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new/extra)',
    'Private reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new?redirect=evil)',
    'Private reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new#redirect)',
    'Private reporting endpoint: https://github.com/acme/gumball-6900/security/advisories/new',
    '<!-- Private reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new) -->',
    '```markdown\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n```',
    '`Private reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)`',
    '<div hidden>\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n</div>',
    'Private reporting endpoint: ![Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)',
    '---\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n---\n# Security',
    '\uFEFF---\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n---\n# Security',
    '---   \nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n---\t\n# Security',
    '---\rPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\r---\r# Security',
    '+++\rPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\r+++\r# Security',
    'Intro `\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n` close',
    '<?processing instruction?>\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)',
    '<!DECLARATION>\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)',
    '<![CDATA[hidden]]>\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)',
    '![hidden image alt\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n](https://attacker.invalid/pixel.png)',
    '[hidden link text\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n](https://attacker.invalid/)',
    '$$\nPrivate reporting endpoint: [Open a private vulnerability report](https://github.com/acme/gumball-6900/security/advisories/new)\n$$',
    'Private reporting endpoint: [Open a private vulnerability report\\](https://github.com/acme/gumball-6900/security/advisories/new)',
  ]) {
    assert.match(
      evaluateReleaseReadiness({ ...approvedInputs, security }).join('\n'),
      /lacks the exact canonical-repository private vulnerability-reporting endpoint/,
    );
  }
  assert.match(
    evaluateReleaseReadiness({ ...approvedInputs, canonicalRepositoryUrl: null }).join('\n'),
    /Canonical GitHub repository origin is unavailable or invalid/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      readme:
        '# Ready\n\n## License\n\nReleased under BUSL-1.1, but this selection is provisional and subject to counsel confirmation. See [LICENSE](LICENSE) and [NOTICE](NOTICE).\n',
    }).join('\n'),
    /not tied to the configured SPDX identifier/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      repositoryLicenseNoticePolicy: unconfiguredLicenseNoticePolicy,
    }).join('\n'),
    /license\/NOTICE policy is not configured/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      canonicalLogoProvenancePolicy: unconfiguredLogoProvenancePolicy,
    }).join('\n'),
    /provenance policy is not configured/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      dependencyLicenseReviewPolicy: inventoryBaselinedDependencyLicenseReviewPolicy,
    }).join('\n'),
    /dependency license review policy state is not approved/i,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      dependencyLicenseReviewPolicy: {
        ...approvedDependencyLicenseReviewPolicy,
        entries: approvedDependencyLicenseReviewPolicy.entries.map((entry) => ({
          ...entry,
          disposition: 'needs-counsel',
          releaseRelevance: 'undetermined',
        })),
      },
    }).join('\n'),
    /release relevance remains undetermined/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      pnpmLock: Buffer.from('lockfileVersion: 9.1\n', 'utf8'),
    }).join('\n'),
    /pnpm lockfile hash mismatch/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      dependencyLicenseInventory: Buffer.from(
        deterministicJson({ ...dependencyLicenseInventory, dependencyEntriesSha256: '44'.repeat(32) }),
        'utf8',
      ),
    }).join('\n'),
    /dependencyEntriesSha256 does not match entries|license report hash mismatch/,
  );
  assert.match(
    evaluateReleaseReadiness({
      ...approvedInputs,
      dependencyLicenseInventory: null,
    }).join('\n'),
    new RegExp(dependencyLicenseInventoryPath.replaceAll('.', '\\.')),
  );
});

test('release-readiness CLI reads and hash-binds every analyzer lock from the workspace', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'gumball-analyzer-readiness-'));
  const reportPath = path.join(workspace, 'reports/readiness.json');
  const policyPath = path.join(workspace, analyzerEnvironmentPolicyPath);
  await mkdir(path.dirname(policyPath), { recursive: true });
  await writeFile(policyPath, deterministicJson(configuredAnalyzerEnvironmentPolicy));
  for (const repositoryPath of analyzerEnvironmentLockPaths) {
    await mkdir(path.dirname(path.join(workspace, repositoryPath)), { recursive: true });
    await writeFile(path.join(workspace, repositoryPath), analyzerEnvironmentLockfiles[repositoryPath]);
  }

  const runReadiness = async () => {
    const result = spawnSync(
      process.execPath,
      [
        path.resolve(import.meta.dirname, 'check-release-readiness.mjs'),
        '--workspace',
        workspace,
        '--report',
        reportPath,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1, result.stderr);
    return JSON.parse(await readFile(reportPath, 'utf8'));
  };

  const bound = await runReadiness();
  assert.equal(bound.candidateAuthorization, 'blocked');
  assert.ok(bound.blockers.includes(currentReleaseToolingBlocker));
  assert.deepEqual(
    bound.blockers.filter((blocker) => blocker.startsWith('Analyzer environment policy')),
    [],
  );
  assert.deepEqual(bound.checkedFiles.slice(0, 3), [analyzerEnvironmentPolicyPath, ...analyzerEnvironmentLockPaths]);

  await writeFile(path.join(workspace, analyzerEnvironmentLockPaths[1]), 'tampered lock bytes\n');
  const mismatched = await runReadiness();
  assert.match(mismatched.blockers.join('\n'), /lock file SHA-256 mismatch/);

  await writeFile(
    path.join(workspace, analyzerEnvironmentLockPaths[1]),
    analyzerEnvironmentLockfiles[analyzerEnvironmentLockPaths[1]],
  );
  await unlink(path.join(workspace, analyzerEnvironmentLockPaths[0]));
  const missing = await runReadiness();
  assert.match(missing.blockers.join('\n'), /lock file is missing or not regular/);
});

test('testnet fork evidence is exact and USDG-only', () => {
  assert.equal(validateRobinhoodTestnetForkEvidence(configuredTestnetForkEvidence), configuredTestnetForkEvidence);
  assert.throws(
    () =>
      validateRobinhoodTestnetForkEvidence({
        ...configuredTestnetForkEvidence,
        dependencies: {
          ...configuredTestnetForkEvidence.dependencies,
          unexpectedDependency: configuredTestnetForkEvidence.dependencies.usdG,
        },
      }),
    /dependency set/,
  );
  const expired = {
    ...configuredTestnetForkEvidence,
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    observedAt: new Date(Date.now() - 120_000).toISOString(),
  };
  assert.throws(() => validateRobinhoodTestnetForkEvidence(expired), /expired/);
  assert.equal(
    validateRobinhoodTestnetForkEvidence(expired, { requireFresh: false }),
    expired,
    'historical evidence remains structurally inspectable outside a release boundary',
  );
  const future = {
    ...configuredTestnetForkEvidence,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    observedAt: new Date(Date.now() + 60_000).toISOString(),
  };
  assert.throws(() => validateRobinhoodTestnetForkEvidence(future), /future-dated/);
  assert.throws(
    () =>
      validateRobinhoodTestnetForkEvidence({
        kind: 'gumball-6900-robinhood-testnet-fork-evidence',
        protocol: 'GUM BALL 6900',
        schemaVersion: 1,
        state: 'unconfigured',
      }),
    /unconfigured/,
  );
});

test('deterministic JSON sorts object keys without reordering arrays', () => {
  assert.equal(
    deterministicJson({ z: 1, a: [{ y: 2, x: 1 }] }),
    '{\n  "a": [\n    {\n      "x": 1,\n      "y": 2\n    }\n  ],\n  "z": 1\n}\n',
  );
});

test('release stream redaction removes exact secret values before archival', () => {
  const secret = 'https://rpc.invalid/archive?token=release-secret';
  const output = execFileSync(process.execPath, [path.join(import.meta.dirname, 'redact-stream.mjs'), 'TEST_RPC_URL'], {
    encoding: 'utf8',
    env: { ...process.env, TEST_RPC_URL: secret },
    input: `provider failed at ${secret}\n`,
  });
  assert.equal(output, 'provider failed at [REDACTED:TEST_RPC_URL]\n');
});
