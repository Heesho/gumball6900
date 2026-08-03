#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertOnlyArguments,
  deterministicJson,
  parseNamedArguments,
  readJson,
  requiredArgument,
  sourceDateEpoch,
  validateGitObjectId,
  validateManifestBinding,
  validateReleaseEvidenceCommit,
  validateReleaseManifestSignaturePolicy,
  validateReleaseTag,
} from './release-lib.mjs';

export const robinhoodRegistryRevalidationUrl = 'https://api.robinhood.com/rhj/assets';
export const robinhoodRegistryResponseArchiveFileName = 'robinhood-registry-response.json';
export const robinhoodRegistryRevalidationMaximumValidityMs = 24 * 60 * 60 * 1_000;
export const robinhoodRegistryRevalidationStages = Object.freeze(['preliminary', 'protected-final']);
const expectedSymbols = Object.freeze(['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA']);
const maximumRegistryResponseBytes = 5 * 1024 * 1024;

function exactObjectKeys(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function assertObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function sha256Prefixed(bytes) {
  return `0x${createHash('sha256').update(bytes).digest('hex')}`;
}

function rawSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be a canonical ISO timestamp`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return timestamp;
}

function assertAddress(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`${label} must be a nonzero EVM address`);
  }
  return value;
}

function equalAddress(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
}

function assertBytes32(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value) || /^0x0{64}$/.test(value)) {
    throw new Error(`${label} must be a nonzero lowercase bytes32`);
  }
  return value;
}

function assertRawSha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value) || /^0{64}$/.test(value)) {
    throw new Error(`${label} must be a nonzero lowercase raw SHA-256`);
  }
  return value;
}

function assertPositiveInteger(value, label) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw new Error(`${label} must be positive decimal`);
  return BigInt(value);
}

function fixed18ToInteger(value, label) {
  const match = typeof value === 'string' ? /^(0|[1-9][0-9]*)\.([0-9]{18})$/.exec(value) : null;
  if (match === null) throw new Error(`${label} must be a canonical nonnegative fixed-18 value`);
  return (BigInt(match[1]) * 10n ** 18n + BigInt(match[2])).toString();
}

function integerToFixed18(value, label) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be a canonical nonnegative integer`);
  }
  const amount = BigInt(value);
  return `${amount / 10n ** 18n}.${(amount % 10n ** 18n).toString().padStart(18, '0')}`;
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8 JSON`, { cause: error });
  }
}

function selectedCandidateContext(candidate, config, manifest, descriptors) {
  assertObject(candidate, 'Reviewed asset candidate');
  assertObject(config, 'Signed deployment config');
  assertObject(manifest, 'Signed deployment manifest');
  if (
    candidate.kind !== 'robinhood-stock-asset-manifest' ||
    candidate.schemaVersion !== 2 ||
    candidate.chainId !== 4663 ||
    candidate.status !== 'generated-candidate' ||
    candidate.deploymentApproved !== false ||
    !Array.isArray(candidate.assets) ||
    candidate.assets.length !== expectedSymbols.length
  ) {
    throw new Error('Reviewed stock candidate identity or v2 shape is invalid');
  }
  const source = assertObject(candidate.source, 'Reviewed asset candidate source');
  if (source.registryUrl !== robinhoodRegistryRevalidationUrl) {
    throw new Error('Reviewed stock candidate registry URL is not canonical');
  }
  const candidateBlockNumber = assertPositiveInteger(source.blockNumber, 'Candidate source blockNumber');
  const candidateBlockHash = assertBytes32(source.blockHash, 'Candidate source blockHash');
  const candidateBlockTimestampMs = canonicalTimestamp(source.blockTimestamp, 'Candidate source blockTimestamp');
  if (canonicalTimestamp(source.observedAt, 'Candidate source observedAt') !== candidateBlockTimestampMs) {
    throw new Error('Candidate observedAt does not equal its pinned block timestamp');
  }
  assertBytes32(source.registryResponseSha256, 'Candidate selected-record digest');

  if (config.kind !== 'gumball-6900-deployment-config' || config.network?.chainId !== 4663) {
    throw new Error('Signed deployment config is not Robinhood mainnet');
  }
  if (
    config.assetReview?.path !== descriptors.assetCandidate.path ||
    config.assetReview?.rawSha256 !== descriptors.assetCandidate.rawSha256
  ) {
    throw new Error('Signed deployment config does not bind the exact reviewed candidate');
  }
  if (manifest.kind !== 'gumball-6900-deployment-manifest' || manifest.network?.chainId !== 4663) {
    throw new Error('Signed deployment manifest is not Robinhood mainnet');
  }
  const observation = assertObject(manifest.releaseEvidence?.observation, 'Signed release observation');
  const observationBlockNumber = assertPositiveInteger(observation.blockNumber, 'Release observation blockNumber');
  const observationBlockHash = assertBytes32(observation.blockHash, 'Release observation blockHash');
  if (candidateBlockNumber > observationBlockNumber) {
    throw new Error('Reviewed candidate pin is later than the signed release observation');
  }

  const arrays = assertObject(config.assets, 'Signed deployment config assets');
  const requiredArrays = ['assetIds', 'decimals', 'isStockToken', 'runtimeBytecodeHashes', 'tokens', 'uiMultipliers'];
  if (requiredArrays.some((key) => !Array.isArray(arrays[key]))) {
    throw new Error('Signed deployment config stock identity arrays are incomplete');
  }
  const arrayLength = arrays.tokens.length;
  if (requiredArrays.some((key) => arrays[key].length !== arrayLength)) {
    throw new Error('Signed deployment config stock identity arrays have different lengths');
  }

  const manifestAssets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const records = candidate.assets.map((asset, index) => {
    const expectedSymbol = expectedSymbols[index];
    if (
      asset?.symbol !== expectedSymbol ||
      asset.chainId !== 4663 ||
      asset.decimals !== 18 ||
      asset.registryStatus !== 'ASSET_STATUS_ACTIVE'
    ) {
      throw new Error(`Reviewed candidate ${expectedSymbol} identity is invalid or unsorted`);
    }
    const address = assertAddress(asset.address, `Candidate ${expectedSymbol} address`);
    const uid = assertBytes32(asset.uid, `Candidate ${expectedSymbol} UID`);
    assertBytes32(asset.runtimeBytecodeHash, `Candidate ${expectedSymbol} runtime hash`);
    const multiplier = integerToFixed18(asset.currentMultiplier, `Candidate ${expectedSymbol} multiplier`);
    if (typeof asset.tokenName !== 'string' || asset.tokenName.length === 0) {
      throw new Error(`Candidate ${expectedSymbol} tokenName is invalid`);
    }
    const stockIndexes = arrays.isStockToken.flatMap((isStock, assetIndex) => (isStock === true ? [assetIndex] : []));
    const configIndexes = stockIndexes.filter((assetIndex) => equalAddress(arrays.tokens[assetIndex], address));
    if (configIndexes.length !== 1) throw new Error(`Signed config lacks one exact ${expectedSymbol} stock target`);
    const configIndex = configIndexes[0];
    if (
      arrays.decimals[configIndex] !== 18 ||
      String(arrays.assetIds[configIndex]).toLowerCase() !== uid ||
      String(arrays.runtimeBytecodeHashes[configIndex]).toLowerCase() !== asset.runtimeBytecodeHash ||
      arrays.uiMultipliers[configIndex] !== asset.currentMultiplier
    ) {
      throw new Error(`Signed config ${expectedSymbol} identity differs from the reviewed candidate`);
    }
    const signedAssetMatches = manifestAssets.filter(
      (manifestAsset) => manifestAsset?.key === expectedSymbol && equalAddress(manifestAsset.address, address),
    );
    if (
      signedAssetMatches.length !== 1 ||
      signedAssetMatches[0].decimals !== 18 ||
      String(signedAssetMatches[0].uid).toLowerCase() !== uid ||
      signedAssetMatches[0].uiMultiplier !== asset.currentMultiplier ||
      signedAssetMatches[0].registryStatus !== 'ASSET_STATUS_ACTIVE'
    ) {
      throw new Error(`Signed manifest ${expectedSymbol} identity differs from the reviewed candidate`);
    }
    return {
      currentMultiplier: multiplier,
      deployments: [{ chainId: 4663, contractAddress: address }],
      id: uid,
      status: 'ASSET_STATUS_ACTIVE',
      tokenName: asset.tokenName,
      tokenSymbol: expectedSymbol,
    };
  });
  const candidateDigest = sha256Prefixed(Buffer.from(deterministicJson(records), 'utf8'));
  if (candidateDigest !== source.registryResponseSha256) {
    throw new Error('Reviewed candidate selected-record digest does not match its identities');
  }
  return {
    candidateBlockHash,
    candidateBlockNumber,
    candidateBlockTimestamp: source.blockTimestamp,
    candidateBlockTimestampMs,
    candidateDigest,
    observationBlockHash,
    observationBlockNumber,
    records,
  };
}

function selectOfficialRecords(registryPayload, candidateRecords) {
  const registry = assertObject(registryPayload, 'Official Robinhood registry response');
  if (!Array.isArray(registry.assets)) throw new Error('Official Robinhood registry response lacks assets');
  return candidateRecords.map((candidateRecord) => {
    const matches = registry.assets.filter((record) => record?.tokenSymbol === candidateRecord.tokenSymbol);
    if (matches.length !== 1) {
      throw new Error(`Official registry does not contain one exact ${candidateRecord.tokenSymbol} record`);
    }
    const record = assertObject(matches[0], `Official ${candidateRecord.tokenSymbol} record`);
    const deployments = Array.isArray(record.deployments)
      ? record.deployments.filter((deployment) => deployment?.chainId === 4663)
      : [];
    if (
      record.status !== 'ASSET_STATUS_ACTIVE' ||
      String(record.id).toLowerCase() !== candidateRecord.id ||
      record.tokenName !== candidateRecord.tokenName ||
      fixed18ToInteger(record.currentMultiplier, `Official ${candidateRecord.tokenSymbol} multiplier`) !==
        fixed18ToInteger(candidateRecord.currentMultiplier, `Candidate ${candidateRecord.tokenSymbol} multiplier`) ||
      deployments.length !== 1 ||
      !equalAddress(deployments[0].contractAddress, candidateRecord.deployments[0].contractAddress)
    ) {
      throw new Error(`Official registry ${candidateRecord.tokenSymbol} identity or active status changed`);
    }
    return candidateRecord;
  });
}

function releaseDescriptors(manifest) {
  const evidence = assertObject(manifest.releaseEvidence, 'Signed release evidence');
  const assetCandidate = assertObject(evidence.assetCandidate, 'Signed asset candidate descriptor');
  const deploymentConfig = assertObject(evidence.deploymentConfig, 'Signed deployment config descriptor');
  assertRawSha256(assetCandidate.rawSha256, 'Signed candidate raw SHA-256');
  assertRawSha256(deploymentConfig.rawSha256, 'Signed config raw SHA-256');
  if (typeof assetCandidate.path !== 'string' || typeof deploymentConfig.path !== 'string') {
    throw new Error('Signed release evidence paths are invalid');
  }
  return { assetCandidate, deploymentConfig };
}

export function buildRobinhoodRegistryRevalidation({
  assetCandidateBytes,
  configBytes,
  evidenceCommit,
  evidenceCommitCommittedAt,
  fetchedAt,
  manifestBytes,
  manifestRepositoryPath,
  registryResponseBytes,
  sourceCommit,
  stage,
  tag,
  tagObject,
}) {
  if (!robinhoodRegistryRevalidationStages.includes(stage)) throw new Error('Registry revalidation stage is invalid');
  validateGitObjectId(evidenceCommit, 'Registry evidence release commit');
  validateGitObjectId(sourceCommit, 'Registry evidence source commit');
  validateGitObjectId(tagObject, 'Registry evidence tag object');
  validateReleaseTag(tag);
  if (
    !(assetCandidateBytes instanceof Uint8Array) ||
    !(configBytes instanceof Uint8Array) ||
    !(manifestBytes instanceof Uint8Array)
  ) {
    throw new Error('Registry revalidation release inputs must be raw bytes');
  }
  if (!(registryResponseBytes instanceof Uint8Array) || registryResponseBytes.byteLength === 0) {
    throw new Error('Official registry response bytes are missing');
  }
  const candidate = parseJsonBytes(assetCandidateBytes, 'Reviewed asset candidate');
  const config = parseJsonBytes(configBytes, 'Signed deployment config');
  const manifest = parseJsonBytes(manifestBytes, 'Signed deployment manifest');
  const registryPayload = parseJsonBytes(registryResponseBytes, 'Official registry response');
  const descriptors = releaseDescriptors(manifest);
  if (rawSha256(assetCandidateBytes) !== descriptors.assetCandidate.rawSha256) {
    throw new Error('Reviewed candidate raw bytes do not match the signed manifest descriptor');
  }
  if (rawSha256(configBytes) !== descriptors.deploymentConfig.rawSha256) {
    throw new Error('Deployment config raw bytes do not match the signed manifest descriptor');
  }
  const context = selectedCandidateContext(candidate, config, manifest, descriptors);
  const selectedRecords = selectOfficialRecords(registryPayload, context.records);
  const selectedRecordsSha256 = sha256Prefixed(Buffer.from(deterministicJson(selectedRecords), 'utf8'));
  if (selectedRecordsSha256 !== context.candidateDigest) {
    throw new Error('Late official selected-record digest differs from the reviewed candidate pin');
  }

  const fetchedAtMs = canonicalTimestamp(fetchedAt, 'Registry fetchedAt');
  const evidenceCommitMs = canonicalTimestamp(evidenceCommitCommittedAt, 'Evidence commit committedAt');
  const manifestCreatedAtMs = canonicalTimestamp(manifest.release?.createdAt, 'Signed manifest createdAt');
  if (
    fetchedAtMs < evidenceCommitMs ||
    fetchedAtMs < manifestCreatedAtMs ||
    fetchedAtMs < context.candidateBlockTimestampMs
  ) {
    throw new Error('Registry fetch predates its candidate, config, manifest, or evidence-commit inputs');
  }
  if (manifest.release?.gitCommit !== sourceCommit || manifest.release?.version !== tag) {
    throw new Error('Registry release linkage differs from the signed manifest');
  }
  const signaturePolicyId = assertBytes32(manifest.signaturePolicy?.policyId, 'Signed manifest policy ID');
  const expiresAt = new Date(fetchedAtMs + robinhoodRegistryRevalidationMaximumValidityMs).toISOString();
  if (typeof manifestRepositoryPath !== 'string' || manifestRepositoryPath.length === 0) {
    throw new Error('Registry release manifest path is invalid');
  }
  return {
    authorizationEligible: stage === 'protected-final',
    evidence: {
      expiresAt,
      fetchedAt,
      registryUrl: robinhoodRegistryRevalidationUrl,
      selectedRecords,
      selectedRecordsSha256,
      sourceArchive: {
        fileName: robinhoodRegistryResponseArchiveFileName,
        rawSha256: rawSha256(registryResponseBytes),
      },
      sourceRecordCount: registryPayload.assets.length,
      sourceResponseSha256: sha256Prefixed(registryResponseBytes),
    },
    kind: 'gumball-6900-robinhood-registry-revalidation',
    protocol: 'GUM BALL 6900',
    releaseLinkage: {
      assetCandidate: { path: descriptors.assetCandidate.path, rawSha256: descriptors.assetCandidate.rawSha256 },
      candidatePin: {
        blockHash: context.candidateBlockHash,
        blockNumber: context.candidateBlockNumber.toString(),
        blockTimestamp: context.candidateBlockTimestamp,
      },
      deploymentConfig: { path: descriptors.deploymentConfig.path, rawSha256: descriptors.deploymentConfig.rawSha256 },
      deploymentManifest: { path: manifestRepositoryPath, rawSha256: rawSha256(manifestBytes) },
      evidenceCommit,
      evidenceCommitCommittedAt,
      releaseObservation: {
        blockHash: context.observationBlockHash,
        blockNumber: context.observationBlockNumber.toString(),
      },
      releaseTag: tag,
      signaturePolicyId,
      sourceCommit,
      tagObject,
    },
    schemaVersion: 1,
    stage,
    status: 'registry-identities-unchanged',
  };
}

export function validateRobinhoodRegistryRevalidation(
  artifact,
  {
    assetCandidateBytes,
    configBytes,
    evidenceCommit,
    evidenceCommitCommittedAt,
    expectedStage,
    manifestBytes,
    manifestRepositoryPath,
    nowMs = Date.now(),
    registryResponseBytes,
    sourceCommit,
    tag,
    tagObject,
  },
) {
  if (!robinhoodRegistryRevalidationStages.includes(expectedStage))
    throw new Error('Expected registry stage is invalid');
  if (
    !exactObjectKeys(artifact, [
      'authorizationEligible',
      'evidence',
      'kind',
      'protocol',
      'releaseLinkage',
      'schemaVersion',
      'stage',
      'status',
    ]) ||
    artifact.kind !== 'gumball-6900-robinhood-registry-revalidation' ||
    artifact.protocol !== 'GUM BALL 6900' ||
    artifact.schemaVersion !== 1 ||
    artifact.stage !== expectedStage ||
    artifact.authorizationEligible !== (expectedStage === 'protected-final') ||
    artifact.status !== 'registry-identities-unchanged'
  ) {
    throw new Error('Robinhood registry revalidation artifact identity, stage, or eligibility is invalid');
  }
  const evidence = artifact.evidence;
  if (
    !exactObjectKeys(evidence, [
      'expiresAt',
      'fetchedAt',
      'registryUrl',
      'selectedRecords',
      'selectedRecordsSha256',
      'sourceArchive',
      'sourceRecordCount',
      'sourceResponseSha256',
    ]) ||
    evidence.registryUrl !== robinhoodRegistryRevalidationUrl ||
    !Number.isSafeInteger(evidence.sourceRecordCount) ||
    evidence.sourceRecordCount < expectedSymbols.length ||
    !Array.isArray(evidence.selectedRecords) ||
    evidence.selectedRecords.length !== expectedSymbols.length
  ) {
    throw new Error('Robinhood registry revalidation evidence fields are invalid');
  }
  assertBytes32(evidence.sourceResponseSha256, 'Registry source response SHA-256');
  assertBytes32(evidence.selectedRecordsSha256, 'Registry selected-record SHA-256');
  if (
    !exactObjectKeys(evidence.sourceArchive, ['fileName', 'rawSha256']) ||
    evidence.sourceArchive.fileName !== robinhoodRegistryResponseArchiveFileName
  ) {
    throw new Error('Robinhood registry source archive descriptor is invalid');
  }
  assertRawSha256(evidence.sourceArchive.rawSha256, 'Registry source archive raw SHA-256');
  const fetchedAtMs = canonicalTimestamp(evidence.fetchedAt, 'Registry evidence fetchedAt');
  const expiresAtMs = canonicalTimestamp(evidence.expiresAt, 'Registry evidence expiresAt');
  if (
    expiresAtMs - fetchedAtMs !== robinhoodRegistryRevalidationMaximumValidityMs ||
    fetchedAtMs > nowMs ||
    expiresAtMs <= nowMs
  ) {
    throw new Error('Robinhood registry revalidation evidence is future-dated, expired, or has invalid validity');
  }
  if (
    sha256Prefixed(Buffer.from(deterministicJson(evidence.selectedRecords), 'utf8')) !== evidence.selectedRecordsSha256
  ) {
    throw new Error('Robinhood registry selected-record archive digest is invalid');
  }

  const manifest = parseJsonBytes(manifestBytes, 'Prepared signed manifest');
  const config = parseJsonBytes(configBytes, 'Prepared signed config');
  const candidate = parseJsonBytes(assetCandidateBytes, 'Prepared reviewed candidate');
  const descriptors = releaseDescriptors(manifest);
  const context = selectedCandidateContext(candidate, config, manifest, descriptors);
  if (deterministicJson(evidence.selectedRecords) !== deterministicJson(context.records)) {
    throw new Error('Robinhood registry selected records differ from the reviewed candidate');
  }
  if (evidence.selectedRecordsSha256 !== context.candidateDigest) {
    throw new Error('Robinhood registry selected-record digest differs from the candidate pin');
  }
  if (!(registryResponseBytes instanceof Uint8Array) || registryResponseBytes.byteLength === 0) {
    throw new Error('Robinhood registry source archive bytes are required');
  }
  if (
    rawSha256(registryResponseBytes) !== evidence.sourceArchive.rawSha256 ||
    sha256Prefixed(registryResponseBytes) !== evidence.sourceResponseSha256
  ) {
    throw new Error('Robinhood registry source archive bytes do not match the evidence digests');
  }
  const archivedRegistryPayload = parseJsonBytes(registryResponseBytes, 'Archived official registry response');
  const archivedSelectedRecords = selectOfficialRecords(archivedRegistryPayload, context.records);
  if (archivedRegistryPayload.assets.length !== evidence.sourceRecordCount) {
    throw new Error('Robinhood registry source record count does not match the archived official response');
  }
  if (deterministicJson(archivedSelectedRecords) !== deterministicJson(evidence.selectedRecords)) {
    throw new Error('Archived official registry response does not reproduce the selected records');
  }
  const linkage = artifact.releaseLinkage;
  if (
    !exactObjectKeys(linkage, [
      'assetCandidate',
      'candidatePin',
      'deploymentConfig',
      'deploymentManifest',
      'evidenceCommit',
      'evidenceCommitCommittedAt',
      'releaseObservation',
      'releaseTag',
      'signaturePolicyId',
      'sourceCommit',
      'tagObject',
    ]) ||
    deterministicJson(linkage.assetCandidate) !== deterministicJson(descriptors.assetCandidate) ||
    deterministicJson(linkage.deploymentConfig) !== deterministicJson(descriptors.deploymentConfig) ||
    linkage.deploymentManifest?.path !== manifestRepositoryPath ||
    linkage.deploymentManifest?.rawSha256 !== rawSha256(manifestBytes) ||
    linkage.evidenceCommit !== evidenceCommit ||
    linkage.evidenceCommitCommittedAt !== evidenceCommitCommittedAt ||
    linkage.releaseTag !== tag ||
    linkage.sourceCommit !== sourceCommit ||
    linkage.tagObject !== tagObject ||
    linkage.signaturePolicyId !== manifest.signaturePolicy?.policyId ||
    linkage.candidatePin?.blockHash !== context.candidateBlockHash ||
    linkage.candidatePin?.blockNumber !== context.candidateBlockNumber.toString() ||
    linkage.candidatePin?.blockTimestamp !== context.candidateBlockTimestamp ||
    linkage.releaseObservation?.blockHash !== context.observationBlockHash ||
    linkage.releaseObservation?.blockNumber !== context.observationBlockNumber.toString()
  ) {
    throw new Error('Robinhood registry revalidation release linkage is invalid');
  }
  const commitMs = canonicalTimestamp(evidenceCommitCommittedAt, 'Expected evidence commit committedAt');
  const manifestCreatedAtMs = canonicalTimestamp(manifest.release?.createdAt, 'Prepared manifest createdAt');
  if (fetchedAtMs < commitMs || fetchedAtMs < manifestCreatedAtMs || fetchedAtMs < context.candidateBlockTimestampMs) {
    throw new Error('Robinhood registry revalidation predates its release inputs');
  }
  return artifact;
}

export function parseRobinhoodRegistryRevalidationBytes(bytes, expected) {
  const artifact = parseJsonBytes(bytes, 'Robinhood registry revalidation artifact');
  if (Buffer.from(bytes).toString('utf8') !== deterministicJson(artifact)) {
    throw new Error('Robinhood registry revalidation artifact must use canonical deterministic JSON bytes');
  }
  return validateRobinhoodRegistryRevalidation(artifact, expected);
}

export async function fetchRobinhoodRegistryResponse(fetchImplementation = fetch, timeoutMilliseconds = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetchImplementation(robinhoodRegistryRevalidationUrl, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok || response.url !== robinhoodRegistryRevalidationUrl) {
      throw new Error(`Official Robinhood registry fetch failed or redirected (${response.status})`);
    }
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'application/json') throw new Error('Official Robinhood registry response is not JSON');

    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null) {
      if (!/^(0|[1-9][0-9]*)$/.test(declaredLength)) {
        throw new Error('Official Robinhood registry response Content-Length is invalid');
      }
      if (BigInt(declaredLength) > BigInt(maximumRegistryResponseBytes)) {
        throw new Error('Official Robinhood registry response size is invalid');
      }
    }
    if (response.body === null || typeof response.body?.getReader !== 'function') {
      throw new Error('Official Robinhood registry response body is missing');
    }

    const chunks = [];
    let byteLength = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) {
          throw new Error('Official Robinhood registry response body chunk is invalid');
        }
        byteLength += value.byteLength;
        if (byteLength > maximumRegistryResponseBytes) {
          try {
            await reader.cancel('Official Robinhood registry response exceeded the size limit');
          } catch {
            // The size violation remains authoritative even if the stream cannot be cancelled cleanly.
          }
          throw new Error('Official Robinhood registry response size is invalid');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    if (byteLength === 0) {
      throw new Error('Official Robinhood registry response size is invalid');
    }
    const bytes = Buffer.concat(chunks, byteLength);
    parseJsonBytes(bytes, 'Official Robinhood registry response');
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

async function atomicWrite(outputPath, bytes) {
  if (!path.isAbsolute(outputPath)) throw new Error('--output must be an absolute path');
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, bytes, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try {
    await link(temporaryPath, outputPath);
  } finally {
    await unlink(temporaryPath);
  }
}

async function main() {
  const arguments_ = parseNamedArguments(process.argv.slice(2));
  assertOnlyArguments(arguments_, [
    'evidence-commit',
    'manifest',
    'output',
    'source-commit',
    'source-archive-output',
    'stage',
    'tag',
    'tag-object',
    'workspace',
  ]);
  const workspace = path.resolve(requiredArgument(arguments_, 'workspace'));
  const manifestRepositoryPath = requiredArgument(arguments_, 'manifest');
  const evidenceCommit = validateGitObjectId(requiredArgument(arguments_, 'evidence-commit'), 'Evidence commit');
  const sourceCommit = validateGitObjectId(requiredArgument(arguments_, 'source-commit'), 'Source commit');
  const tagObject = validateGitObjectId(requiredArgument(arguments_, 'tag-object'), 'Annotated tag object');
  const tag = validateReleaseTag(requiredArgument(arguments_, 'tag'));
  const stage = requiredArgument(arguments_, 'stage');
  if (!robinhoodRegistryRevalidationStages.includes(stage)) throw new Error('--stage is invalid');
  const release = await validateReleaseEvidenceCommit({
    evidenceCommit,
    manifestRepositoryPath,
    sourceCommit,
    workspace,
  });
  const policy = validateReleaseManifestSignaturePolicy(await readJson(release.policyFile.absolutePath));
  validateManifestBinding(release.manifest, { signaturePolicy: policy, sourceCommit, tag });
  const [assetCandidateBytes, configBytes, manifestBytes] = await Promise.all([
    readFile(release.assetCandidateFile.absolutePath),
    readFile(release.configFile.absolutePath),
    readFile(release.manifestFile.absolutePath),
  ]);
  const evidenceCommitCommittedAt = new Date(Number(sourceDateEpoch(workspace, evidenceCommit)) * 1_000).toISOString();
  const registryResponseBytes = await fetchRobinhoodRegistryResponse();
  const fetchedAt = new Date().toISOString();
  const artifact = buildRobinhoodRegistryRevalidation({
    assetCandidateBytes,
    configBytes,
    evidenceCommit,
    evidenceCommitCommittedAt,
    fetchedAt,
    manifestBytes,
    manifestRepositoryPath,
    registryResponseBytes,
    sourceCommit,
    stage,
    tag,
    tagObject,
  });
  const outputArgument = requiredArgument(arguments_, 'output');
  const sourceArchiveOutputArgument = requiredArgument(arguments_, 'source-archive-output');
  if (!path.isAbsolute(outputArgument) || !path.isAbsolute(sourceArchiveOutputArgument)) {
    throw new Error('--output and --source-archive-output must be absolute paths');
  }
  const outputPath = path.resolve(outputArgument);
  const sourceArchiveOutputPath = path.resolve(sourceArchiveOutputArgument);
  if (outputPath === sourceArchiveOutputPath) throw new Error('Artifact and source archive output paths must differ');
  if (path.basename(sourceArchiveOutputPath) !== robinhoodRegistryResponseArchiveFileName) {
    throw new Error(`--source-archive-output must end with ${robinhoodRegistryResponseArchiveFileName}`);
  }
  await atomicWrite(sourceArchiveOutputPath, registryResponseBytes);
  try {
    await atomicWrite(outputPath, deterministicJson(artifact));
  } catch (error) {
    await unlink(sourceArchiveOutputPath);
    throw error;
  }
  process.stdout.write(
    `Archived ${stage} Robinhood registry revalidation for ${tag}; no candidate, transaction, or external state was written.\n`,
  );
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `Robinhood registry revalidation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
