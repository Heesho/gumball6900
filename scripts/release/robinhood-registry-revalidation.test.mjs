import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import { deterministicJson } from './release-lib.mjs';
import {
  buildRobinhoodRegistryRevalidation,
  fetchRobinhoodRegistryResponse,
  parseRobinhoodRegistryRevalidationBytes,
  robinhoodRegistryRevalidationUrl,
  validateRobinhoodRegistryRevalidation,
} from './robinhood-registry-revalidation.mjs';

const symbols = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'];
const evidenceCommit = 'e'.repeat(40);
const sourceCommit = 'c'.repeat(40);
const tagObject = 'a'.repeat(40);
const tag = 'v1.2.3';
const manifestRepositoryPath = 'manifests/release.json';
const candidatePath = 'packages/config/deployments/robinhood-mainnet-assets.2026-08-02.candidate.json';
const configPath = 'manifests/release-deployment-config.json';
const candidateBlockTimestamp = '2026-08-02T02:59:56.000Z';
const evidenceCommitCommittedAt = '2026-08-02T03:30:00.000Z';
const manifestCreatedAt = '2026-08-02T03:20:00.000Z';
const fetchedAt = '2026-08-02T04:00:00.000Z';
const maximumRegistryResponseBytes = 5 * 1024 * 1024;

function streamedResponse(chunks, { contentLength } = {}) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  if (contentLength !== undefined) headers.set('content-length', String(contentLength));
  return {
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    headers,
    ok: true,
    status: 200,
    url: robinhoodRegistryRevalidationUrl,
  };
}

function rawSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function prefixedSha256(value) {
  return `0x${createHash('sha256').update(value).digest('hex')}`;
}

function selectedRecords() {
  return symbols.map((symbol, index) => ({
    currentMultiplier: `${index + 1}.000000000000000000`,
    deployments: [{ chainId: 4663, contractAddress: `0x${(index + 1).toString(16).padStart(40, '0')}` }],
    id: `0x${(index + 11).toString(16).padStart(64, '0')}`,
    status: 'ASSET_STATUS_ACTIVE',
    tokenName: `${symbol} Stock Token`,
    tokenSymbol: symbol,
  }));
}

function fixture() {
  const records = selectedRecords();
  const candidate = {
    assets: records.map((record, index) => ({
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
      blockNumber: '25560598',
      blockTimestamp: candidateBlockTimestamp,
      observedAt: candidateBlockTimestamp,
      registryResponseSha256: prefixedSha256(Buffer.from(deterministicJson(records), 'utf8')),
      registryUrl: robinhoodRegistryRevalidationUrl,
    },
    status: 'generated-candidate',
  };
  const assetCandidateBytes = Buffer.from(deterministicJson(candidate), 'utf8');
  const config = {
    assetReview: { path: candidatePath, rawSha256: rawSha256(assetCandidateBytes) },
    assets: {
      assetIds: candidate.assets.map(({ uid }) => uid),
      decimals: candidate.assets.map(() => 18),
      isStockToken: candidate.assets.map(() => true),
      runtimeBytecodeHashes: candidate.assets.map(({ runtimeBytecodeHash }) => runtimeBytecodeHash),
      tokens: candidate.assets.map(({ address }) => address),
      uiMultipliers: candidate.assets.map(({ currentMultiplier }) => currentMultiplier),
    },
    kind: 'gumball-6900-deployment-config',
    network: { chainId: 4663, name: 'Robinhood Chain' },
  };
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
    network: { chainId: 4663 },
    protocol: 'GUM BALL 6900',
    release: {
      createdAt: manifestCreatedAt,
      gitCommit: sourceCommit,
      status: 'release-approved',
      version: tag,
    },
    releaseEvidence: {
      assetCandidate: config.assetReview,
      deploymentConfig: { path: configPath, rawSha256: rawSha256(configBytes) },
      observation: { blockHash: `0x${'34'.repeat(32)}`, blockNumber: '25560650' },
    },
    signaturePolicy: { policyId: `0x${'56'.repeat(32)}` },
  };
  const manifestBytes = Buffer.from(deterministicJson(manifest), 'utf8');
  const registryResponseBytes = Buffer.from(
    deterministicJson({ assets: [...records, { status: 'ASSET_STATUS_ACTIVE', tokenSymbol: 'OTHER' }] }),
    'utf8',
  );
  return { assetCandidateBytes, configBytes, manifestBytes, registryResponseBytes };
}

function build(stage = 'preliminary', overrides = {}) {
  return buildRobinhoodRegistryRevalidation({
    ...fixture(),
    evidenceCommit,
    evidenceCommitCommittedAt,
    fetchedAt,
    manifestRepositoryPath,
    sourceCommit,
    stage,
    tag,
    tagObject,
    ...overrides,
  });
}

function expected(stage = 'preliminary', overrides = {}) {
  return {
    ...fixture(),
    evidenceCommit,
    evidenceCommitCommittedAt,
    expectedStage: stage,
    manifestRepositoryPath,
    nowMs: Date.parse(fetchedAt) + 1_000,
    sourceCommit,
    tag,
    tagObject,
    ...overrides,
  };
}

test('builds deterministic preliminary and protected-final registry archives with exact release linkage', () => {
  const preliminary = build();
  const final = build('protected-final');
  assert.equal(preliminary.authorizationEligible, false);
  assert.equal(final.authorizationEligible, true);
  assert.equal(preliminary.evidence.selectedRecordsSha256, fixtureDigest());
  assert.equal(preliminary.evidence.sourceArchive.rawSha256, rawSha256(fixture().registryResponseBytes));
  assert.equal(preliminary.releaseLinkage.candidatePin.blockNumber, '25560598');
  assert.deepEqual(validateRobinhoodRegistryRevalidation(preliminary, expected()), preliminary);
  assert.deepEqual(validateRobinhoodRegistryRevalidation(final, expected('protected-final')), final);
  const bytes = Buffer.from(deterministicJson(final), 'utf8');
  assert.deepEqual(parseRobinhoodRegistryRevalidationBytes(bytes, expected('protected-final')), final);
  assert.throws(
    () =>
      parseRobinhoodRegistryRevalidationBytes(Buffer.from(`${bytes.toString('utf8')} `), expected('protected-final')),
    /canonical deterministic JSON/,
  );
});

function fixtureDigest() {
  return prefixedSha256(Buffer.from(deterministicJson(selectedRecords()), 'utf8'));
}

test('rejects official record identity, active-status, and selected-digest drift', () => {
  for (const mutate of [
    (payload) => (payload.assets[0].status = 'ASSET_STATUS_INACTIVE'),
    (payload) => (payload.assets[0].currentMultiplier = '9.000000000000000000'),
    (payload) => (payload.assets[0].id = `0x${'99'.repeat(32)}`),
    (payload) => (payload.assets[0].deployments[0].contractAddress = `0x${'99'.repeat(20)}`),
  ]) {
    const values = fixture();
    const payload = JSON.parse(values.registryResponseBytes.toString('utf8'));
    mutate(payload);
    assert.throws(
      () => build('preliminary', { registryResponseBytes: Buffer.from(deterministicJson(payload), 'utf8') }),
      /identity or active status changed/,
    );
  }
});

test('rejects stale, wrong-stage, source-archive, and release-linkage substitutions', () => {
  const artifact = build('protected-final');
  assert.throws(
    () => validateRobinhoodRegistryRevalidation(artifact, expected('preliminary')),
    /identity, stage, or eligibility/,
  );
  assert.throws(
    () =>
      validateRobinhoodRegistryRevalidation(artifact, {
        ...expected('protected-final'),
        nowMs: Date.parse(artifact.evidence.expiresAt),
      }),
    /expired/,
  );
  assert.throws(
    () =>
      validateRobinhoodRegistryRevalidation(artifact, {
        ...expected('protected-final'),
        registryResponseBytes: Buffer.from('{}\n'),
      }),
    /source archive bytes/,
  );
  const substituted = structuredClone(artifact);
  substituted.releaseLinkage.sourceCommit = 'f'.repeat(40);
  assert.throws(
    () => validateRobinhoodRegistryRevalidation(substituted, expected('protected-final')),
    /release linkage/,
  );
  assert.throws(() => build('protected-final', { fetchedAt: '2026-08-02T03:00:00.000Z' }), /predates/);
});

test('rejects inflated or deflated source record counts detached from the exact archive', () => {
  const artifact = build('protected-final');
  assert.equal(artifact.evidence.sourceRecordCount, 6);
  for (const sourceRecordCount of [5, 7]) {
    const substituted = structuredClone(artifact);
    substituted.evidence.sourceRecordCount = sourceRecordCount;
    assert.throws(
      () => validateRobinhoodRegistryRevalidation(substituted, expected('protected-final')),
      /source record count does not match/,
    );
  }
});

test('fetches only the exact nonredirected JSON registry response', async () => {
  const bytes = fixture().registryResponseBytes;
  const response = streamedResponse([bytes]);
  await assert.doesNotReject(fetchRobinhoodRegistryResponse(async () => response));
  await assert.rejects(
    fetchRobinhoodRegistryResponse(async () => ({ ...response, url: `${robinhoodRegistryRevalidationUrl}/` })),
    /failed or redirected/,
  );
  await assert.rejects(
    fetchRobinhoodRegistryResponse(async () => ({
      ...response,
      headers: new Headers({ 'content-type': 'text/html' }),
    })),
    /not JSON/,
  );
});

test('rejects an oversized declared Content-Length before reading the response body', async () => {
  const bytes = fixture().registryResponseBytes;
  const response = streamedResponse([bytes], { contentLength: maximumRegistryResponseBytes + 1 });
  let bodyRead = false;
  const body = response.body;
  response.body = {
    getReader() {
      bodyRead = true;
      return body.getReader();
    },
  };
  await assert.rejects(
    fetchRobinhoodRegistryResponse(async () => response),
    /response size is invalid/,
  );
  assert.equal(bodyRead, false);
});

test('preserves exact raw registry bytes while streaming without Content-Length', async () => {
  const bytes = fixture().registryResponseBytes;
  const splitAt = Math.floor(bytes.byteLength / 2);
  const response = streamedResponse([bytes.subarray(0, splitAt), bytes.subarray(splitAt)]);
  const fetched = await fetchRobinhoodRegistryResponse(async () => response);
  assert.deepEqual(fetched, bytes);
});

test('rejects a cumulatively oversized stream despite a misleading small Content-Length', async () => {
  const response = streamedResponse([Buffer.alloc(maximumRegistryResponseBytes, 0x20), Buffer.from('\n')], {
    contentLength: 1,
  });
  await assert.rejects(
    fetchRobinhoodRegistryResponse(async () => response),
    /response size is invalid/,
  );
});
