import { constants } from 'node:fs';
import { access, lstat, mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isAddressEqual } from 'viem';
import type { Address } from 'viem';

import {
  deploymentAuthorizationSigningPayloadHash,
  validateDeploymentAuthorization,
  type DeploymentAuthorization,
  type DeploymentAuthorizationPolicy,
  type DeploymentAuthorizationPhase,
} from '../schemas/deployment-authorization.js';
import { assertAuthorizedDeploymentTarget } from '../schemas/deployment-config.js';
import {
  parseSafeControlPlaneEvidence,
  safeControlPlaneIdentity,
  type SafeControlPlaneEvidence,
} from '../schemas/safe-control-plane.js';
import { assertApprovedSafeControlPlane, parseSafeControlPlanePolicy } from '../schemas/safe-control-plane-policy.js';
import { deterministicJson, sha256Hex } from './deterministic-json.js';
import {
  fetchOfficialRobinhoodAssetRegistry,
  type GeneratedRobinhoodAssetManifest,
} from './robinhood-asset-manifest.js';
import {
  assertReviewedRobinhoodAssetManifestMatchesDeploymentConfig,
  assertReviewedRobinhoodAssetManifestMatchesOfficialRegistry,
  parseReviewedRobinhoodAssetManifest,
  type ReviewedAssetDeploymentConfig,
} from './reviewed-robinhood-asset-manifest.js';
import { assertRepositoryHead, readExactTrackedFileAtHead } from './tracked-git-file.js';

export interface DeploymentPreflightRequest {
  readonly authorizationPath: string;
  readonly commandFamily: 'hardhat';
  readonly deploymentConfigPath: string;
  readonly emergencyGuardianSafeCurrentObservation: SafeControlPlaneEvidence;
  readonly emergencyGuardianSafeEvidencePath: string;
  readonly emergencyGuardianSafeHistoricalObservation: SafeControlPlaneEvidence;
  readonly ledgerPath: string;
  readonly now: Date;
  readonly observedBroadcaster: string;
  readonly observedChainId: number;
  readonly observedPendingNonce: string;
  readonly priorStatePath: string;
  readonly repositoryClean: boolean;
  readonly repositoryCommit: string;
  readonly repositoryRoot: string;
  readonly requestedPhase: DeploymentAuthorizationPhase;
  readonly protocolAdminSafeCurrentObservation: SafeControlPlaneEvidence;
  readonly protocolAdminSafeEvidencePath: string;
  readonly protocolAdminSafeHistoricalObservation: SafeControlPlaneEvidence;
  readonly trustedSignaturePolicy: DeploymentAuthorizationPolicy;
}

export interface DeploymentPreflightReceipt {
  readonly authorizationId: `0x${string}`;
  readonly authorizationPayloadHash: `0x${string}`;
  readonly broadcaster: string;
  readonly commandFamily: 'hardhat';
  readonly deploymentConfigHash: `0x${string}`;
  readonly deploymentConfigSnapshotPath: string;
  readonly expiresAt: string;
  readonly emergencyGuardianSafe: {
    readonly currentObservation: SafeControlPlaneEvidence;
    readonly evidence: SafeControlPlaneEvidence;
    readonly evidenceHash: `0x${string}`;
    readonly evidenceSnapshotPath: string;
  };
  readonly ledgerRecordPath: string;
  readonly nonceWindow: { readonly start: string; readonly transactionCount: number };
  readonly phase: DeploymentAuthorizationPhase;
  readonly priorStateHash: `0x${string}`;
  readonly priorStateSnapshotPath: string | null;
  readonly protocolAdminSafe: {
    readonly currentObservation: SafeControlPlaneEvidence;
    readonly evidence: SafeControlPlaneEvidence;
    readonly evidenceHash: `0x${string}`;
    readonly evidenceSnapshotPath: string;
  };
  readonly reviewedAssetCandidate: {
    readonly path: string;
    readonly rawSha256: string;
    readonly snapshotPath: string;
    readonly sourceBlockNumber: string;
  } | null;
  readonly safeSchedule: {
    readonly blockHash: `0x${string}`;
    readonly blockNumber: string;
    readonly blockTimestamp: string;
    readonly format: 'safe-transaction-builder';
    readonly controlPlaneEvidenceHash: `0x${string}`;
    readonly controlPlaneEvidenceSnapshotPath: string;
    readonly safeAddress: string;
    readonly safeNonce: string;
  } | null;
}

interface ReviewedSafeControlPlaneEvidence {
  readonly canonical: string;
  readonly currentObservation: SafeControlPlaneEvidence;
  readonly evidence: SafeControlPlaneEvidence;
}

interface ReviewedAssetCandidate {
  readonly canonical: string;
  readonly manifest: GeneratedRobinhoodAssetManifest;
  readonly path: string;
  readonly rawSha256: string;
}

export function assertTrustedDeploymentAuthorizationPolicy(
  authorization: DeploymentAuthorization,
  trustedSignaturePolicy: DeploymentAuthorizationPolicy,
): void {
  const trustedPolicy = {
    authorizedSigners: trustedSignaturePolicy.authorizedSigners,
    policyId: trustedSignaturePolicy.policyId,
    threshold: trustedSignaturePolicy.threshold,
  };
  if (deterministicJson(authorization.signaturePolicy) !== deterministicJson(trustedPolicy)) {
    throw new Error('Authorization signer policy does not match the clean-commit trusted deployment policy');
  }
}

const hardhatPriorPhases: Record<Exclude<DeploymentAuthorizationPhase, 'deploy'>, readonly string[]> = {
  execute: ['TIMELOCK_OPERATIONS_SCHEDULED', 'TIMELOCK_EXECUTING'],
  'fund-genesis': ['REGISTRY_CONFIGURED'],
  schedule: ['DEPLOYED_AND_WIRED', 'TIMELOCK_SCHEDULING'],
  'settle-genesis': ['GENESIS_OPENED'],
};

function isPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertJsonObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must contain a JSON object`);
  }
}

async function resolveExternalFile(inputPath: string, repositoryRoot: string, label: string): Promise<string> {
  if (!path.isAbsolute(inputPath)) throw new Error(`${label} path must be absolute`);
  const stats = await lstat(inputPath);
  if (stats.isSymbolicLink()) throw new Error(`${label} path must not be a symbolic link`);
  if (!stats.isFile()) throw new Error(`${label} path must be a regular file`);
  const resolved = await realpath(inputPath);
  if (isPathWithin(repositoryRoot, resolved)) {
    throw new Error(`${label} path must be outside the git worktree`);
  }
  return resolved;
}

async function resolveAbsentExternalFile(inputPath: string, repositoryRoot: string, label: string): Promise<string> {
  if (!path.isAbsolute(inputPath)) throw new Error(`${label} path must be absolute`);
  try {
    await access(inputPath, constants.F_OK);
    throw new Error(`${label} must not exist before phase one`);
  } catch (error) {
    if (error instanceof Error && error.message === `${label} must not exist before phase one`) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
  }
  const resolvedParent = await realpath(path.dirname(inputPath));
  const resolved = path.join(resolvedParent, path.basename(inputPath));
  if (isPathWithin(repositoryRoot, resolved)) {
    throw new Error(`${label} path must be outside the git worktree`);
  }
  return resolved;
}

async function resolveLedgerDirectory(inputPath: string, repositoryRoot: string): Promise<string> {
  if (!path.isAbsolute(inputPath)) throw new Error('Replay ledger path must be absolute');
  if (isPathWithin(repositoryRoot, path.resolve(inputPath))) {
    throw new Error('Replay ledger path must be outside the git worktree');
  }
  try {
    const stats = await lstat(inputPath);
    if (stats.isSymbolicLink()) throw new Error('Replay ledger path must not be a symbolic link');
    if (!stats.isDirectory()) throw new Error('Replay ledger path must be a directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(inputPath, { mode: 0o700, recursive: true });
  }
  const resolved = await realpath(inputPath);
  if (isPathWithin(repositoryRoot, resolved)) {
    throw new Error('Replay ledger path resolves inside the git worktree');
  }
  return resolved;
}

async function readJsonObject(filePath: string, label: string): Promise<Record<string, unknown>> {
  const value = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  assertJsonObject(value, label);
  return value;
}

async function reserveAuthorization(
  authorization: DeploymentAuthorization,
  request: DeploymentPreflightRequest,
  ledgerPath: string,
  canonicalConfig: string,
  canonicalState: string | null,
  protocolAdminSafe: ReviewedSafeControlPlaneEvidence,
  emergencyGuardianSafe: ReviewedSafeControlPlaneEvidence,
  reviewedAssetCandidate: ReviewedAssetCandidate | null,
): Promise<DeploymentPreflightReceipt> {
  const authorizationKey = authorization.authorizationId.slice(2);
  const runsPath = path.join(ledgerPath, 'authorizations');
  await mkdir(runsPath, { mode: 0o700, recursive: true });
  const runPath = path.join(runsPath, authorizationKey);
  try {
    await mkdir(runPath, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Deployment authorization ${authorization.authorizationId} has already been consumed`);
    }
    throw error;
  }

  const configSnapshotPath = path.join(runPath, 'deployment-config.canonical.json');
  const stateSnapshotPath = canonicalState === null ? null : path.join(runPath, 'prior-state.canonical.json');
  const protocolAdminSafeEvidenceSnapshotPath = path.join(runPath, 'protocol-admin-safe-evidence.canonical.json');
  const emergencyGuardianSafeEvidenceSnapshotPath = path.join(
    runPath,
    'emergency-guardian-safe-evidence.canonical.json',
  );
  const reviewedAssetCandidateSnapshotPath =
    reviewedAssetCandidate === null ? null : path.join(runPath, 'reviewed-asset-candidate.canonical.json');
  const ledgerRecordPath = path.join(runPath, 'reservation.json');
  await writeFile(configSnapshotPath, canonicalConfig, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  if (stateSnapshotPath !== null && canonicalState !== null) {
    await writeFile(stateSnapshotPath, canonicalState, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  }
  await writeFile(protocolAdminSafeEvidenceSnapshotPath, protocolAdminSafe.canonical, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  await writeFile(emergencyGuardianSafeEvidenceSnapshotPath, emergencyGuardianSafe.canonical, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  if (reviewedAssetCandidateSnapshotPath !== null && reviewedAssetCandidate !== null) {
    await writeFile(reviewedAssetCandidateSnapshotPath, reviewedAssetCandidate.canonical, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  }
  const receipt: DeploymentPreflightReceipt = {
    authorizationId: authorization.authorizationId as `0x${string}`,
    authorizationPayloadHash: deploymentAuthorizationSigningPayloadHash(authorization),
    broadcaster: authorization.broadcaster,
    commandFamily: authorization.commandFamily,
    deploymentConfigHash: authorization.deploymentConfigHash as `0x${string}`,
    deploymentConfigSnapshotPath: configSnapshotPath,
    emergencyGuardianSafe: {
      currentObservation: emergencyGuardianSafe.currentObservation,
      evidence: emergencyGuardianSafe.evidence,
      evidenceHash: sha256Hex(emergencyGuardianSafe.canonical),
      evidenceSnapshotPath: emergencyGuardianSafeEvidenceSnapshotPath,
    },
    expiresAt: authorization.expiresAt,
    ledgerRecordPath,
    nonceWindow: authorization.nonceWindow,
    phase: authorization.phase,
    priorStateHash: authorization.priorState.hash as `0x${string}`,
    priorStateSnapshotPath: stateSnapshotPath,
    protocolAdminSafe: {
      currentObservation: protocolAdminSafe.currentObservation,
      evidence: protocolAdminSafe.evidence,
      evidenceHash: sha256Hex(protocolAdminSafe.canonical),
      evidenceSnapshotPath: protocolAdminSafeEvidenceSnapshotPath,
    },
    reviewedAssetCandidate:
      reviewedAssetCandidate === null || reviewedAssetCandidateSnapshotPath === null
        ? null
        : {
            path: reviewedAssetCandidate.path,
            rawSha256: reviewedAssetCandidate.rawSha256,
            snapshotPath: reviewedAssetCandidateSnapshotPath,
            sourceBlockNumber: reviewedAssetCandidate.manifest.source.blockNumber,
          },
    safeSchedule:
      authorization.safeSchedule === undefined
        ? null
        : {
            blockHash: protocolAdminSafe.evidence.block.hash as `0x${string}`,
            blockNumber: protocolAdminSafe.evidence.block.number,
            blockTimestamp: protocolAdminSafe.evidence.block.timestamp,
            controlPlaneEvidenceHash: authorization.safeSchedule.controlPlaneEvidenceHash as `0x${string}`,
            controlPlaneEvidenceSnapshotPath: protocolAdminSafeEvidenceSnapshotPath,
            format: authorization.safeSchedule.format,
            safeAddress: authorization.safeSchedule.safeAddress,
            safeNonce: authorization.safeSchedule.safeNonce,
          },
  };
  const handle = await open(ledgerRecordPath, 'wx', 0o600);
  try {
    await handle.writeFile(
      deterministicJson({
        authorizationId: receipt.authorizationId,
        authorizationPayloadHash: receipt.authorizationPayloadHash,
        broadcaster: receipt.broadcaster,
        commandFamily: receipt.commandFamily,
        consumedAt: request.now.toISOString(),
        deploymentConfigHash: receipt.deploymentConfigHash,
        emergencyGuardianSafe: receipt.emergencyGuardianSafe,
        expiresAt: receipt.expiresAt,
        observedChainId: request.observedChainId,
        nonceWindow: receipt.nonceWindow,
        phase: receipt.phase,
        priorStateHash: receipt.priorStateHash,
        protocolAdminSafe: receipt.protocolAdminSafe,
        reviewedAssetCandidate: receipt.reviewedAssetCandidate,
        repositoryCommit: request.repositoryCommit,
        safeSchedule: receipt.safeSchedule,
      }),
      'utf8',
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
  return receipt;
}

function normalizedSafeIdentity(value: SafeControlPlaneEvidence | ReturnType<typeof safeControlPlaneIdentity>) {
  const identity = safeControlPlaneIdentitySchemaCompat(value);
  return {
    ...identity,
    enabledModules: identity.enabledModules.map((module) => module.toLowerCase()),
    fallbackHandler: identity.fallbackHandler.toLowerCase(),
    guard: identity.guard.toLowerCase(),
    owners: identity.owners.map((owner) => owner.toLowerCase()),
    proxyRuntimeBytecodeHash: identity.proxyRuntimeBytecodeHash.toLowerCase(),
    safeAddress: identity.safeAddress.toLowerCase(),
    singletonAddress: identity.singletonAddress.toLowerCase(),
    singletonRuntimeBytecodeHash: identity.singletonRuntimeBytecodeHash.toLowerCase(),
  };
}

function safeControlPlaneIdentitySchemaCompat(
  value: SafeControlPlaneEvidence | ReturnType<typeof safeControlPlaneIdentity>,
) {
  return 'kind' in value ? safeControlPlaneIdentity(value) : value;
}

function assertSafeIdentityMatches(
  actual: SafeControlPlaneEvidence | ReturnType<typeof safeControlPlaneIdentity>,
  expected: SafeControlPlaneEvidence | ReturnType<typeof safeControlPlaneIdentity>,
  label: string,
): void {
  if (deterministicJson(normalizedSafeIdentity(actual)) !== deterministicJson(normalizedSafeIdentity(expected))) {
    throw new Error(`${label} Safe identity does not match`);
  }
}

function assertSafeObservationMatches(
  actual: SafeControlPlaneEvidence,
  expected: SafeControlPlaneEvidence,
  label: string,
  includeBlock: boolean,
): void {
  assertSafeIdentityMatches(actual, expected, label);
  if (actual.nonce !== expected.nonce) throw new Error(`${label} Safe nonce does not match`);
  if (
    actual.network.chainId !== expected.network.chainId ||
    actual.network.name !== expected.network.name ||
    actual.kind !== expected.kind ||
    actual.protocol !== expected.protocol ||
    actual.schemaVersion !== expected.schemaVersion
  ) {
    throw new Error(`${label} Safe evidence envelope does not match`);
  }
  if (
    includeBlock &&
    (actual.block.number !== expected.block.number ||
      actual.block.timestamp !== expected.block.timestamp ||
      actual.block.hash.toLowerCase() !== expected.block.hash.toLowerCase())
  ) {
    throw new Error(`${label} Safe evidence block does not match`);
  }
}

async function validateSafeControlPlaneEvidence(
  signedEvidence: SafeControlPlaneEvidence,
  evidencePathInput: string,
  historicalObservationInput: SafeControlPlaneEvidence,
  currentObservationInput: SafeControlPlaneEvidence,
  repositoryRoot: string,
  configIdentity: ReturnType<typeof safeControlPlaneIdentity>,
  label: string,
  safeSchedule?: DeploymentAuthorization['safeSchedule'],
): Promise<ReviewedSafeControlPlaneEvidence> {
  const evidencePath = await resolveExternalFile(evidencePathInput, repositoryRoot, `${label} evidence`);
  const evidence = parseSafeControlPlaneEvidence(await readJsonObject(evidencePath, `${label} evidence`));
  const canonical = deterministicJson(evidence);
  const evidenceHash = sha256Hex(canonical);
  const authorizedCanonical = deterministicJson(signedEvidence);
  if (canonical !== authorizedCanonical) {
    throw new Error(`${label} evidence does not match the signed authorization envelope`);
  }
  if (
    evidence.network.chainId !== signedEvidence.network.chainId ||
    evidence.network.name !== signedEvidence.network.name
  ) {
    throw new Error(`${label} evidence network does not match authorization`);
  }
  assertSafeIdentityMatches(evidence, configIdentity, `${label} signed config`);
  const historicalObservation = parseSafeControlPlaneEvidence(historicalObservationInput);
  assertSafeObservationMatches(historicalObservation, evidence, `${label} observed historical`, true);
  const currentObservation = parseSafeControlPlaneEvidence(currentObservationInput);
  assertSafeObservationMatches(currentObservation, evidence, `${label} observed current`, false);
  if (BigInt(currentObservation.block.number) < BigInt(evidence.block.number)) {
    throw new Error(`${label} current observation predates signed evidence`);
  }
  if (safeSchedule !== undefined) {
    if (safeSchedule.controlPlaneEvidenceHash !== evidenceHash) {
      throw new Error('Schedule control-plane evidence hash does not match signed authorization');
    }
    if (
      !isAddressEqual(evidence.safeAddress as Address, safeSchedule.safeAddress as Address) ||
      evidence.nonce !== safeSchedule.safeNonce
    ) {
      throw new Error('Schedule Safe address or nonce does not match control-plane evidence');
    }
  }
  return { canonical, currentObservation, evidence };
}

/**
 * Cryptographically checks and atomically consumes one deployment authorization, then snapshots
 * exactly the canonical JSON values that the runner is allowed to use.
 */
export async function preflightDeploymentAuthorization(
  authorizationValue: unknown,
  request: DeploymentPreflightRequest,
): Promise<DeploymentPreflightReceipt> {
  const authorization = await validateDeploymentAuthorization(authorizationValue);
  const repositoryRoot = await realpath(request.repositoryRoot);
  if (!request.repositoryClean)
    throw new Error('Git worktree is not clean; committed code does not match authorization');
  if (request.repositoryCommit !== authorization.releaseGitCommit) {
    throw new Error(
      `Repository commit ${request.repositoryCommit} does not match authorization ${authorization.releaseGitCommit}`,
    );
  }
  if (request.commandFamily !== authorization.commandFamily) {
    throw new Error(
      `Command family ${request.commandFamily} does not match authorization ${authorization.commandFamily}`,
    );
  }
  if (request.requestedPhase !== authorization.phase) {
    throw new Error(`Requested phase ${request.requestedPhase} does not match authorization ${authorization.phase}`);
  }
  if (request.observedChainId !== authorization.network.chainId) {
    throw new Error(
      `Observed chain ${request.observedChainId} does not match authorization ${authorization.network.chainId}`,
    );
  }
  if (!isAddressEqual(request.observedBroadcaster as Address, authorization.broadcaster as Address)) {
    throw new Error(
      `Observed broadcaster ${request.observedBroadcaster} does not match authorization ${authorization.broadcaster}`,
    );
  }
  if (request.observedPendingNonce !== authorization.nonceWindow.start) {
    throw new Error(
      `Observed pending nonce ${request.observedPendingNonce} does not match authorization ${authorization.nonceWindow.start}`,
    );
  }
  assertTrustedDeploymentAuthorizationPolicy(authorization, request.trustedSignaturePolicy);
  const now = request.now.getTime();
  if (now < Date.parse(authorization.issuedAt)) throw new Error('Deployment authorization is not active yet');
  if (now >= Date.parse(authorization.expiresAt)) throw new Error('Deployment authorization has expired');

  await resolveExternalFile(request.authorizationPath, repositoryRoot, 'Authorization');
  const configPath = await resolveExternalFile(request.deploymentConfigPath, repositoryRoot, 'Deployment config');
  const statePath =
    authorization.phase === 'deploy'
      ? await resolveAbsentExternalFile(request.priorStatePath, repositoryRoot, 'Deployment state')
      : await resolveExternalFile(request.priorStatePath, repositoryRoot, 'Deployment state');

  const config = await readJsonObject(configPath, 'Deployment config');
  const configEnvelope = assertAuthorizedDeploymentTarget(authorization.network, config);
  const canonicalConfig = deterministicJson(config);
  const configHash = sha256Hex(canonicalConfig);
  if (configHash !== authorization.deploymentConfigHash) {
    throw new Error(
      `Deployment config hash ${configHash} does not match authorization ${authorization.deploymentConfigHash}`,
    );
  }
  let reviewedAssetCandidate: ReviewedAssetCandidate | null = null;
  if (configEnvelope.assetReview !== null) {
    const content = await readExactTrackedFileAtHead(
      repositoryRoot,
      configEnvelope.assetReview.path,
      request.repositoryCommit,
    );
    const rawSha256 = sha256Hex(content).slice(2);
    if (rawSha256 !== configEnvelope.assetReview.rawSha256) {
      throw new Error('Reviewed asset candidate raw bytes do not match the deployment config SHA-256');
    }
    const manifest = parseReviewedRobinhoodAssetManifest(configEnvelope.assetReview.path, content);
    assertReviewedRobinhoodAssetManifestMatchesDeploymentConfig(
      manifest,
      config as unknown as ReviewedAssetDeploymentConfig,
    );
    assertReviewedRobinhoodAssetManifestMatchesOfficialRegistry(manifest, await fetchOfficialRobinhoodAssetRegistry());
    reviewedAssetCandidate = {
      canonical: content,
      manifest,
      path: configEnvelope.assetReview.path,
      rawSha256,
    };
  }
  let canonicalState: string | null = null;
  if (authorization.phase !== 'deploy') {
    const state = await readJsonObject(statePath, 'Deployment state');
    canonicalState = deterministicJson(state);
    const stateHash = sha256Hex(canonicalState);
    if (stateHash !== authorization.priorState.hash) {
      throw new Error(`Prior-state hash ${stateHash} does not match authorization ${authorization.priorState.hash}`);
    }
    if (String(state.chainId) !== String(authorization.network.chainId)) {
      throw new Error(`Deployment state chain ${String(state.chainId)} does not match authorization network`);
    }
    const expectedPhases = hardhatPriorPhases[authorization.phase];
    if (!expectedPhases.includes(String(state.phase))) {
      throw new Error(
        `Deployment state phase ${String(state.phase)} does not match required ${expectedPhases.join(' or ')}`,
      );
    }
  }

  if (configEnvelope.protocolAdminSafe === null) {
    throw new Error('Authorized nonlocal deployment config lacks protocol-admin Safe identity');
  }
  if (configEnvelope.emergencyGuardianSafe === null) {
    throw new Error('Authorized nonlocal deployment config lacks guardian Safe identity');
  }
  const safePolicy = parseSafeControlPlanePolicy(
    JSON.parse(
      await readExactTrackedFileAtHead(
        repositoryRoot,
        'packages/config/deployments/safe-control-plane-policy.json',
        request.repositoryCommit,
      ),
    ) as unknown,
  );
  assertApprovedSafeControlPlane(safePolicy, configEnvelope.protocolAdminSafe, authorization.network, 'Protocol-admin');
  assertApprovedSafeControlPlane(
    safePolicy,
    configEnvelope.emergencyGuardianSafe,
    authorization.network,
    'Emergency-guardian',
  );
  const protocolAdminSafe = await validateSafeControlPlaneEvidence(
    authorization.protocolAdminSafe,
    request.protocolAdminSafeEvidencePath,
    request.protocolAdminSafeHistoricalObservation,
    request.protocolAdminSafeCurrentObservation,
    repositoryRoot,
    configEnvelope.protocolAdminSafe,
    'Protocol-admin Safe',
    authorization.safeSchedule,
  );
  const emergencyGuardianSafe = await validateSafeControlPlaneEvidence(
    authorization.emergencyGuardianSafe,
    request.emergencyGuardianSafeEvidencePath,
    request.emergencyGuardianSafeHistoricalObservation,
    request.emergencyGuardianSafeCurrentObservation,
    repositoryRoot,
    configEnvelope.emergencyGuardianSafe,
    'Emergency-guardian Safe',
  );
  if (
    protocolAdminSafe.evidence.block.number !== emergencyGuardianSafe.evidence.block.number ||
    protocolAdminSafe.evidence.block.hash !== emergencyGuardianSafe.evidence.block.hash ||
    protocolAdminSafe.evidence.block.timestamp !== emergencyGuardianSafe.evidence.block.timestamp
  ) {
    throw new Error('Protocol-admin and guardian Safe evidence does not use the same exact observation block');
  }

  const ledgerPath = await resolveLedgerDirectory(request.ledgerPath, repositoryRoot);
  await assertRepositoryHead(repositoryRoot, request.repositoryCommit);
  return reserveAuthorization(
    authorization,
    request,
    ledgerPath,
    canonicalConfig,
    canonicalState,
    protocolAdminSafe,
    emergencyGuardianSafe,
    reviewedAssetCandidate,
  );
}
