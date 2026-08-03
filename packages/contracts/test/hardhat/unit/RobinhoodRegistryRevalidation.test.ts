import { createHash } from 'node:crypto';

import { expect } from 'chai';

import type { DeploymentConfig } from '../../../script/hardhat/deployment';
import {
  assertRobinhoodRegistryRevalidationEvidence,
  type ReleaseManifest,
  type RobinhoodRegistryRevalidationStage,
} from '../../../script/hardhat/release-manifest-binding';

const symbols = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'] as const;
const evidenceCommit = 'e'.repeat(40);
const sourceCommit = 'c'.repeat(40);
const tagObject = 'a'.repeat(40);
const manifestRepositoryPath = 'packages/config/deployments/release.json';
const candidatePath = 'packages/config/deployments/robinhood-mainnet-assets.candidate.json';
const configPath = 'packages/config/deployments/mainnet.json';
const fetchedAt = '2026-08-02T00:30:00.000Z';
const evidenceCommitCommittedAt = '2026-08-02T00:20:00.000Z';
const nowMs = Date.parse('2026-08-02T01:00:00.000Z');

const address = (value: number): string => `0x${value.toString(16).padStart(40, '0')}`;
const bytes32 = (value: number): string => `0x${value.toString(16).padStart(64, '0')}`;
const rawSha256 = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const prefixedSha256 = (value: Uint8Array): string => `0x${rawSha256(value)}`;

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

function deterministicJson(value: unknown): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function fixture(stage: RobinhoodRegistryRevalidationStage = 'protected-final') {
  const records = symbols.map((symbol, index) => ({
    currentMultiplier: `${index + 1}.000000000000000000`,
    deployments: [{ chainId: 4_663, contractAddress: address(100 + index) }],
    id: bytes32(200 + index),
    status: 'ASSET_STATUS_ACTIVE',
    tokenName: `${symbol} Stock Token`,
    tokenSymbol: symbol,
  }));
  const candidate = {
    assets: records.map((record, index) => ({
      address: record.deployments[0]!.contractAddress,
      chainId: 4_663,
      currentMultiplier: (BigInt(index + 1) * 10n ** 18n).toString(),
      decimals: 18,
      registryStatus: 'ASSET_STATUS_ACTIVE',
      runtimeBytecodeHash: bytes32(300 + index),
      symbol: record.tokenSymbol,
      tokenName: record.tokenName,
      uid: record.id,
    })),
    chainId: 4_663,
    deploymentApproved: false,
    kind: 'robinhood-stock-asset-manifest',
    schemaVersion: 2,
    source: {
      blockHash: bytes32(400),
      blockNumber: '25029999',
      blockTimestamp: '2026-08-02T00:00:00.000Z',
      observedAt: '2026-08-02T00:00:00.000Z',
      registryResponseSha256: prefixedSha256(Buffer.from(deterministicJson(records), 'utf8')),
      registryUrl: 'https://api.robinhood.com/rhj/assets',
    },
    status: 'generated-candidate',
  };
  const candidateBytes = Buffer.from(deterministicJson(candidate), 'utf8');
  const config = {
    assetReview: { path: candidatePath, rawSha256: rawSha256(candidateBytes) },
    assets: {
      assetIds: candidate.assets.map(({ uid }) => uid),
      decimals: candidate.assets.map(() => 18),
      isStockToken: candidate.assets.map(() => true),
      runtimeBytecodeHashes: candidate.assets.map(({ runtimeBytecodeHash }) => runtimeBytecodeHash),
      tokens: candidate.assets.map(({ address: token }) => token),
      uiMultipliers: candidate.assets.map(({ currentMultiplier }) => currentMultiplier),
    },
    kind: 'gumball-6900-deployment-config',
    network: { chainId: 4_663, name: 'Robinhood Chain' },
  } as unknown as DeploymentConfig;
  const configBytes = Buffer.from(deterministicJson(config), 'utf8');
  const manifest = {
    assets: candidate.assets.map((asset) => ({
      address: asset.address,
      decimals: 18,
      key: asset.symbol,
      registryStatus: 'ASSET_STATUS_ACTIVE',
      uid: asset.uid,
      uiMultiplier: asset.currentMultiplier,
    })),
    kind: 'gumball-6900-deployment-manifest',
    network: { chainId: 4_663 },
    protocol: 'GUM BALL 6900',
    release: {
      createdAt: '2026-08-02T00:15:00.000Z',
      gitCommit: sourceCommit,
      status: 'release-approved',
      version: 'v1.2.3',
    },
    releaseEvidence: {
      assetCandidate: config.assetReview,
      deploymentConfig: { path: configPath, rawSha256: rawSha256(configBytes) },
      observation: { blockHash: bytes32(401), blockNumber: '25030000' },
    },
    signaturePolicy: { policyId: bytes32(500) },
  } as unknown as ReleaseManifest;
  const manifestBytes = Buffer.from(deterministicJson(manifest), 'utf8');
  const registryResponseBytes = Buffer.from(
    deterministicJson({ assets: [...records, { status: 'ASSET_STATUS_ACTIVE', tokenSymbol: 'OTHER' }] }),
    'utf8',
  );
  const artifact = {
    authorizationEligible: stage === 'protected-final',
    evidence: {
      expiresAt: '2026-08-03T00:30:00.000Z',
      fetchedAt,
      registryUrl: 'https://api.robinhood.com/rhj/assets',
      selectedRecords: records,
      selectedRecordsSha256: candidate.source.registryResponseSha256,
      sourceArchive: {
        fileName: 'robinhood-registry-response.json',
        rawSha256: rawSha256(registryResponseBytes),
      },
      sourceRecordCount: 6,
      sourceResponseSha256: prefixedSha256(registryResponseBytes),
    },
    kind: 'gumball-6900-robinhood-registry-revalidation',
    protocol: 'GUM BALL 6900',
    releaseLinkage: {
      assetCandidate: manifest.releaseEvidence.assetCandidate,
      candidatePin: {
        blockHash: candidate.source.blockHash,
        blockNumber: candidate.source.blockNumber,
        blockTimestamp: candidate.source.blockTimestamp,
      },
      deploymentConfig: manifest.releaseEvidence.deploymentConfig,
      deploymentManifest: { path: manifestRepositoryPath, rawSha256: rawSha256(manifestBytes) },
      evidenceCommit,
      evidenceCommitCommittedAt,
      releaseObservation: {
        blockHash: manifest.releaseEvidence.observation.blockHash,
        blockNumber: manifest.releaseEvidence.observation.blockNumber,
      },
      releaseTag: manifest.release.version,
      signaturePolicyId: manifest.signaturePolicy.policyId,
      sourceCommit,
      tagObject,
    },
    schemaVersion: 1,
    stage,
    status: 'registry-identities-unchanged',
  };
  return {
    artifact,
    candidateBytes,
    config,
    configBytes,
    manifest,
    manifestBytes,
    registryResponseBytes,
    verify: (override: Partial<Parameters<typeof assertRobinhoodRegistryRevalidationEvidence>[0]> = {}) =>
      assertRobinhoodRegistryRevalidationEvidence({
        assetCandidateBytes: candidateBytes,
        config,
        configBytes,
        evidenceBytes: Buffer.from(deterministicJson(artifact), 'utf8'),
        evidenceCommit,
        evidenceCommitCommittedAt,
        expectedStage: stage,
        manifest,
        manifestBytes,
        manifestRepositoryPath,
        nowMs,
        registryResponseBytes,
        sourceCommit,
        tagObject,
        ...override,
      }),
  };
}

describe('late Robinhood registry revalidation binding', function () {
  it('accepts deterministic preliminary and protected-final evidence with exact raw source bytes', function () {
    const preliminary = fixture('preliminary').verify();
    expect(preliminary.authorizationEligible).to.equal(false);
    const final = fixture('protected-final').verify();
    expect(final.authorizationEligible).to.equal(true);
    expect(final.releaseLinkage.candidatePin.blockNumber).to.equal('25029999');
  });

  it('rejects official identity drift, source-byte substitution, and the wrong authorization stage', function () {
    const identityDrift = fixture();
    const changedResponse = JSON.parse(identityDrift.registryResponseBytes.toString('utf8')) as {
      assets: Array<{ tokenSymbol: string; status: string }>;
    };
    changedResponse.assets.find(({ tokenSymbol }) => tokenSymbol === 'NVDA')!.status = 'ASSET_STATUS_INACTIVE';
    expect(() =>
      identityDrift.verify({ registryResponseBytes: Buffer.from(deterministicJson(changedResponse), 'utf8') }),
    ).to.throw(/identity|digests/);

    const wrongStage = fixture('preliminary');
    expect(() => wrongStage.verify({ expectedStage: 'protected-final' })).to.throw(/stage|eligibility/);
  });

  it('rejects stale evidence and candidate-pin or release-linkage substitution', function () {
    const stale = fixture();
    expect(() => stale.verify({ nowMs: Date.parse(stale.artifact.evidence.expiresAt) })).to.throw(/expired/);

    const substituted = fixture();
    substituted.artifact.releaseLinkage.candidatePin.blockHash = bytes32(999);
    expect(() => substituted.verify()).to.throw(/release linkage/);
  });
});
