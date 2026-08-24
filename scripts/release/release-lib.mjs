import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { evaluateLicenseReview, releaseApprovalErrors } from '../../packages/contracts/audit/check-license-review.mjs';

export const releaseManifestSignaturePolicyPath = 'packages/config/deployments/release-manifest-signature-policy.json';
export const safeControlPlanePolicyPath = 'packages/config/deployments/safe-control-plane-policy.json';
export const robinhoodTestnetForkEvidencePath = 'packages/config/deployments/robinhood-testnet-fork-evidence.json';
export const canonicalLogoPath = 'apps/web/public/brand/gum-ball-6900-logo.png';
export const canonicalLogoProvenancePolicyPath = 'packages/config/deployments/canonical-logo-provenance-policy.json';
export const repositoryLicenseNoticePolicyPath = 'packages/config/deployments/repository-license-notice-policy.json';
export const dependencyLicenseInventoryPath = 'packages/contracts/audit/dependency-license-inventory.json';
export const dependencyLicenseReviewPolicyPath = 'packages/contracts/audit/dependency-license-review-policy.json';
export const analyzerEnvironmentPolicyPath = 'packages/contracts/audit/analyzer-environment-policy.json';
export const analyzerEnvironmentLockPaths = Object.freeze([
  'packages/contracts/audit/python-locks/semgrep-linux-x64.txt',
  'packages/contracts/audit/python-locks/slither-linux-x64.txt',
]);
export const releaseEvidenceMaximumValidityMs = 24 * 60 * 60 * 1_000;
export const releaseManifestSignerRoles = Object.freeze([
  'security',
  'economics',
  'legalCompliance',
  'operations',
  'release',
]);

export const currentReleaseToolingBlocker =
  'Current external-governance deployment/release tooling is unavailable: the retained schema-v3 and Safe validators ' +
  'describe the removed AllocationVoter graph, while the external Resonance owner and governance integration remain ' +
  'unselected. A separately reviewed current manifest and evidence schema is required before deployment or subgraph ' +
  'outputs can be derived.';

/** Fails closed until the external-governance graph has a reviewed manifest/evidence format. */
export function assertCurrentReleaseToolingAvailable() {
  throw new Error(currentReleaseToolingBlocker);
}

export const releaseTagPattern =
  /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|(?:[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9]\d*)|(?:[A-Za-z-][0-9A-Za-z-]*)))*)?$/;

/** Historical subgraph graph retained only for inspecting superseded release fixtures. */
export const archivedSubgraphContractNames = [
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
];

export function deterministicJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

export function parseNamedArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith('--')) throw new Error(`Unexpected positional argument: ${argument ?? ''}`);
    const key = argument.slice(2);
    if (key.length === 0 || values.has(key)) throw new Error(`Invalid or duplicate option: ${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    values.set(key, value);
    index += 1;
  }
  return values;
}

export function requiredArgument(arguments_, name) {
  const value = arguments_.get(name);
  if (value === undefined || value.length === 0) throw new Error(`--${name} is required`);
  return value;
}

export function assertOnlyArguments(arguments_, allowed) {
  for (const name of arguments_.keys()) {
    if (!allowed.includes(name)) throw new Error(`Unknown option: --${name}`);
  }
}

export function validateReleaseTag(tag) {
  if (!releaseTagPattern.test(tag)) {
    throw new Error(`Release tag must be strict v-prefixed SemVer without build metadata: ${tag}`);
  }
  return tag;
}

export function validateGitObjectId(value, label = 'Git object ID') {
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(`${label} must be a lowercase 40-character Git object ID`);
  return value;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
  );
}

function sanitizedGitEnvironment() {
  const environment = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.toUpperCase().startsWith('GIT_') && value !== undefined) environment[name] = value;
  }
  return {
    ...environment,
    GIT_ATTR_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_SYSTEM: os.devNull,
    GIT_LITERAL_PATHSPECS: '1',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
}

function gitBuffer(workspace, arguments_) {
  return execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', workspace, ...arguments_], {
    env: sanitizedGitEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitOutput(workspace, arguments_) {
  return gitBuffer(workspace, arguments_).toString('utf8').trim();
}

export function normalizeCanonicalGithubRepositoryUrl(remoteUrl) {
  if (typeof remoteUrl !== 'string' || remoteUrl.length === 0 || remoteUrl !== remoteUrl.trim()) return null;

  const match =
    /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)$/.exec(remoteUrl) ??
    /^git@github\.com:([^/?#]+)\/([^/?#]+)$/.exec(remoteUrl) ??
    /^ssh:\/\/git@github\.com\/([^/?#]+)\/([^/?#]+)$/.exec(remoteUrl);
  if (match === null) return null;

  const owner = match[1];
  const repository = match[2].endsWith('.git') ? match[2].slice(0, -4) : match[2];
  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) ||
    !/^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/.test(repository)
  ) {
    return null;
  }

  return `https://github.com/${owner.toLowerCase()}/${repository.toLowerCase()}`;
}

export async function resolveCanonicalGithubRepositoryUrl(workspace) {
  try {
    const root = await assertExactRepositoryRoot(workspace);
    const rawConfig = gitBuffer(root, [
      'config',
      '--local',
      '--no-includes',
      '-z',
      '--get-all',
      'remote.origin.url',
    ]).toString('utf8');
    const records = rawConfig.split('\0');
    if (records.pop() !== '' || records.length !== 1) return null;
    return normalizeCanonicalGithubRepositoryUrl(records[0]);
  } catch {
    return null;
  }
}

async function assertExactRepositoryRoot(workspace) {
  const workspaceRealPath = await realpath(workspace);
  const reportedRoot = await realpath(gitOutput(workspaceRealPath, ['rev-parse', '--show-toplevel']));
  if (reportedRoot !== workspaceRealPath) {
    throw new Error(`Git repository root ${reportedRoot} does not match release workspace ${workspaceRealPath}`);
  }
  return workspaceRealPath;
}

export async function assertRepositoryHead(workspace, commit) {
  const root = await assertExactRepositoryRoot(workspace);
  const headCommit = gitOutput(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (headCommit !== commit) throw new Error(`Worktree HEAD ${headCommit} does not match expected commit ${commit}`);
}

function gitBlobObjectId(objectFormat, bytes) {
  return createHash(objectFormat)
    .update(Buffer.from(`blob ${bytes.byteLength}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function regularBlobObjectIdAtCommit(workspace, commit, repositoryPath, label) {
  const treeOutput = gitBuffer(workspace, ['ls-tree', '-z', commit, '--', repositoryPath]).toString('utf8');
  const treeEntries = treeOutput.split('\0').filter((entry) => entry.length > 0);
  const match = treeEntries.length === 1 ? /^100644 blob ([0-9a-f]+)\t(.+)$/.exec(treeEntries[0]) : null;
  if (match === null || match[2] !== repositoryPath) {
    throw new Error(`${label} must be tracked as exactly one regular nonexecutable 100644 blob at commit ${commit}`);
  }
  return match[1];
}

/** Reads exact bytes from one 100644 JSON blob at a commit without requiring worktree HEAD to equal that commit. */
export async function readRegularJsonBlobAtCommit(workspace, repositoryPath, { commit, label = 'Release JSON' }) {
  validateGitObjectId(commit, 'Requested release commit');
  if (
    repositoryPath.length === 0 ||
    path.isAbsolute(repositoryPath) ||
    repositoryPath.includes('\\') ||
    !/^[0-9A-Za-z._/-]+$/.test(repositoryPath) ||
    path.posix.normalize(repositoryPath) !== repositoryPath ||
    path.extname(repositoryPath) !== '.json' ||
    repositoryPath.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error(`${label} path must be a normalized repository-relative JSON path`);
  }
  const root = await assertExactRepositoryRoot(workspace);
  gitBuffer(root, ['cat-file', '-e', `${commit}^{commit}`]);
  const objectId = regularBlobObjectIdAtCommit(root, commit, repositoryPath, label);
  return gitBuffer(root, ['cat-file', 'blob', objectId]);
}

export async function resolveTrackedRepositoryFile(workspace, repositoryPath, { commit, label = 'Release JSON' }) {
  validateGitObjectId(commit, 'Requested release commit');
  if (
    repositoryPath.length === 0 ||
    path.isAbsolute(repositoryPath) ||
    repositoryPath.includes('\\') ||
    !/^[0-9A-Za-z._/-]+$/.test(repositoryPath)
  ) {
    throw new Error(`${label} path must be a nonempty repository-relative POSIX path`);
  }
  const segments = repositoryPath.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error(`${label} path may not contain empty, dot, or parent-directory segments`);
  }
  if (path.posix.normalize(repositoryPath) !== repositoryPath || path.extname(repositoryPath) !== '.json') {
    throw new Error(`${label} path must be a normalized repository-relative JSON path`);
  }

  const workspaceRealPath = await assertExactRepositoryRoot(workspace);
  gitBuffer(workspaceRealPath, ['cat-file', '-e', `${commit}^{commit}`]);
  const headCommit = gitOutput(workspaceRealPath, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (headCommit !== commit) throw new Error(`Release workspace HEAD ${headCommit} does not match requested ${commit}`);
  const lexicalPath = path.resolve(workspaceRealPath, repositoryPath);
  if (!isInside(workspaceRealPath, lexicalPath)) throw new Error(`${label} path resolves outside the repository`);

  const fileStats = await lstat(lexicalPath);
  if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
    throw new Error(`${label} path must identify a regular nonsymlink file`);
  }
  if ((fileStats.mode & 0o111) !== 0) throw new Error(`${label} worktree file must be nonexecutable`);
  const fileRealPath = await realpath(lexicalPath);
  if (fileRealPath !== lexicalPath) throw new Error(`${label} path must not have symlink ancestry`);

  const objectId = regularBlobObjectIdAtCommit(workspaceRealPath, commit, repositoryPath, label);
  const objectFormat = gitOutput(workspaceRealPath, ['rev-parse', '--show-object-format']);
  if (objectFormat !== 'sha1' && objectFormat !== 'sha256') {
    throw new Error(`Unsupported Git object format: ${objectFormat}`);
  }
  const bytes = await readFile(fileRealPath);
  if (gitBlobObjectId(objectFormat, bytes) !== objectId) {
    throw new Error(`${label} raw worktree bytes do not match the requested release commit blob`);
  }

  return { absolutePath: fileRealPath, blobObjectId: objectId, repositoryPath, workspace: workspaceRealPath };
}

function validateSnapshotDescriptor(descriptor, label) {
  if (
    descriptor === null ||
    typeof descriptor !== 'object' ||
    Array.isArray(descriptor) ||
    !exactObjectKeys(descriptor, ['path', 'rawSha256']) ||
    !validSha256(descriptor.rawSha256) ||
    typeof descriptor.path !== 'string' ||
    descriptor.path.length === 0 ||
    path.isAbsolute(descriptor.path) ||
    descriptor.path.includes('\\') ||
    path.posix.normalize(descriptor.path) !== descriptor.path ||
    path.posix.extname(descriptor.path) !== '.json' ||
    !/^[0-9A-Za-z._/-]+$/.test(descriptor.path) ||
    descriptor.path.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error(`${label} evidence descriptor is invalid`);
  }
  return descriptor;
}

function validateSafeControlPlaneEvidence(evidence, observation, label) {
  const validAddress = (value, allowZero = false) =>
    typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && (allowZero || !/^0x0{40}$/i.test(value));
  const validRuntimeHash = (value) =>
    typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value) && !/^0x0{64}$/.test(value);
  if (
    evidence === null ||
    typeof evidence !== 'object' ||
    Array.isArray(evidence) ||
    !exactObjectKeys(evidence, [
      'block',
      'enabledModules',
      'fallbackHandler',
      'guard',
      'kind',
      'network',
      'nonce',
      'owners',
      'protocol',
      'proxyRuntimeBytecodeHash',
      'safeAddress',
      'schemaVersion',
      'singletonAddress',
      'singletonRuntimeBytecodeHash',
      'threshold',
    ]) ||
    evidence.kind !== 'gumball-6900-safe-control-plane-evidence' ||
    evidence.protocol !== 'GUM BALL 6900' ||
    evidence.schemaVersion !== 1 ||
    !validAddress(evidence.safeAddress) ||
    !validAddress(evidence.singletonAddress) ||
    !validAddress(evidence.guard, true) ||
    !validAddress(evidence.fallbackHandler, true) ||
    !validRuntimeHash(evidence.proxyRuntimeBytecodeHash) ||
    !validRuntimeHash(evidence.singletonRuntimeBytecodeHash) ||
    typeof evidence.threshold !== 'string' ||
    !/^[1-9][0-9]*$/.test(evidence.threshold) ||
    BigInt(evidence.threshold) < 2n ||
    typeof evidence.nonce !== 'string' ||
    !/^(0|[1-9][0-9]*)$/.test(evidence.nonce) ||
    !Array.isArray(evidence.owners) ||
    evidence.owners.length < 2 ||
    evidence.owners.length > 256 ||
    evidence.owners.some((owner) => !validAddress(owner)) ||
    new Set(evidence.owners.map((owner) => owner.toLowerCase())).size !== evidence.owners.length ||
    BigInt(evidence.threshold) > BigInt(evidence.owners.length) ||
    !Array.isArray(evidence.enabledModules) ||
    evidence.enabledModules.length !== 0 ||
    evidence.enabledModules.some((module) => !validAddress(module)) ||
    new Set(evidence.enabledModules.map((module) => module.toLowerCase())).size !== evidence.enabledModules.length ||
    !/^0x0{40}$/i.test(evidence.guard) ||
    !/^0x0{40}$/i.test(evidence.fallbackHandler) ||
    evidence.network?.chainId !== 4663 ||
    evidence.network?.name !== 'Robinhood Chain' ||
    evidence.block?.number !== observation.blockNumber ||
    evidence.block?.hash !== observation.blockHash ||
    typeof evidence.block?.timestamp !== 'string' ||
    !/^(0|[1-9][0-9]*)$/.test(evidence.block.timestamp)
  ) {
    throw new Error(`${label} control-plane evidence is invalid or detached from the release observation`);
  }
  return evidence;
}

export function validateSafeControlPlanePolicyShape(policy) {
  if (
    policy === null ||
    typeof policy !== 'object' ||
    Array.isArray(policy) ||
    !exactObjectKeys(policy, ['approvedSingletons', 'kind', 'protocol', 'schemaVersion', 'status']) ||
    policy.kind !== 'gumball-6900-safe-control-plane-policy' ||
    policy.protocol !== 'GUM BALL 6900' ||
    policy.schemaVersion !== 1 ||
    policy.status !== 'configured' ||
    !Array.isArray(policy.approvedSingletons) ||
    policy.approvedSingletons.length === 0 ||
    policy.approvedSingletons.length > 32
  ) {
    throw new Error('Safe control-plane policy is missing, invalid, or explicitly unconfigured');
  }
  const identities = new Set();
  for (const entry of policy.approvedSingletons) {
    const expectedNetworkName =
      entry?.network?.chainId === 4663
        ? 'Robinhood Chain'
        : entry?.network?.chainId === 46630
          ? 'Robinhood Chain Testnet'
          : null;
    if (
      entry === null ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      !exactObjectKeys(entry, [
        'network',
        'proxyRuntimeBytecodeHashes',
        'singletonAddress',
        'singletonRuntimeBytecodeHash',
      ]) ||
      entry.network === null ||
      typeof entry.network !== 'object' ||
      Array.isArray(entry.network) ||
      !exactObjectKeys(entry.network, ['chainId', 'name']) ||
      expectedNetworkName === null ||
      entry.network.name !== expectedNetworkName ||
      typeof entry.singletonAddress !== 'string' ||
      !/^0x[0-9a-fA-F]{40}$/.test(entry.singletonAddress) ||
      /^0x0{40}$/i.test(entry.singletonAddress) ||
      typeof entry.singletonRuntimeBytecodeHash !== 'string' ||
      !/^0x[0-9a-f]{64}$/.test(entry.singletonRuntimeBytecodeHash) ||
      /^0x0{64}$/.test(entry.singletonRuntimeBytecodeHash) ||
      !Array.isArray(entry.proxyRuntimeBytecodeHashes) ||
      entry.proxyRuntimeBytecodeHashes.length === 0 ||
      entry.proxyRuntimeBytecodeHashes.length > 16 ||
      entry.proxyRuntimeBytecodeHashes.some(
        (hash) => typeof hash !== 'string' || !/^0x[0-9a-f]{64}$/.test(hash) || /^0x0{64}$/.test(hash),
      ) ||
      new Set(entry.proxyRuntimeBytecodeHashes).size !== entry.proxyRuntimeBytecodeHashes.length
    ) {
      throw new Error('Safe control-plane policy contains an invalid approved singleton entry');
    }
    const identity = `${entry.network.chainId}:${entry.singletonAddress.toLowerCase()}:${entry.singletonRuntimeBytecodeHash}`;
    if (identities.has(identity)) {
      throw new Error('Safe control-plane policy contains a duplicate approved singleton identity');
    }
    identities.add(identity);
  }
  return policy;
}

function validateSafeControlPlanePolicy(policy, manifest) {
  validateSafeControlPlanePolicyShape(policy);
  for (const [label, evidence] of [
    ['Protocol-admin', manifest.releaseEvidence.protocolAdminSafe],
    ['Emergency-guardian', manifest.releaseEvidence.emergencyGuardianSafe],
  ]) {
    const matches = policy.approvedSingletons.filter(
      (entry) =>
        entry.network.chainId === evidence.network.chainId &&
        entry.network.name === evidence.network.name &&
        entry.singletonAddress?.toLowerCase() === evidence.singletonAddress.toLowerCase() &&
        entry.singletonRuntimeBytecodeHash === evidence.singletonRuntimeBytecodeHash &&
        Array.isArray(entry.proxyRuntimeBytecodeHashes) &&
        entry.proxyRuntimeBytecodeHashes.includes(evidence.proxyRuntimeBytecodeHash),
    );
    if (matches.length !== 1) {
      throw new Error(`${label} Safe singleton/proxy runtime is not approved by the fixed policy`);
    }
  }
  return policy;
}

/** Validates the signed release-evidence envelope without interpreting the snapshot JSON bodies. */
export function validateReleaseEvidenceEnvelope(manifest) {
  const evidence = manifest?.releaseEvidence;
  const schemaVersion = manifest?.schemaVersion;
  const expectedEvidenceKeys = [
    'assetCandidate',
    'deploymentConfig',
    'deploymentState',
    'emergencyGuardianSafe',
    'observation',
    'protocolAdminSafe',
  ];
  if (
    evidence === null ||
    typeof evidence !== 'object' ||
    Array.isArray(evidence) ||
    schemaVersion !== 1 ||
    !exactObjectKeys(evidence, expectedEvidenceKeys)
  ) {
    throw new Error(
      'Release manifest must bind exact asset candidate, deployment config/state, and observation evidence',
    );
  }
  const assetCandidateDescriptor = validateSnapshotDescriptor(evidence.assetCandidate, 'Reviewed asset candidate');
  const configDescriptor = validateSnapshotDescriptor(evidence.deploymentConfig, 'Deployment config snapshot');
  const stateDescriptor = validateSnapshotDescriptor(evidence.deploymentState, 'Deployment state snapshot');
  const descriptorPaths = [assetCandidateDescriptor.path, configDescriptor.path, stateDescriptor.path];
  if (new Set(descriptorPaths).size !== descriptorPaths.length) {
    throw new Error('Reviewed asset and deployment evidence paths must be distinct');
  }
  const observation = evidence.observation;
  if (
    observation === null ||
    typeof observation !== 'object' ||
    Array.isArray(observation) ||
    !exactObjectKeys(observation, ['blockHash', 'blockNumber', 'expiresAt', 'observedAt']) ||
    typeof observation.blockHash !== 'string' ||
    !/^0x[0-9a-f]{64}$/.test(observation.blockHash) ||
    /^0x0{64}$/.test(observation.blockHash) ||
    typeof observation.blockNumber !== 'string' ||
    !/^[1-9][0-9]*$/.test(observation.blockNumber)
  ) {
    throw new Error('Release observation block evidence is invalid');
  }
  const observedAt = Date.parse(observation.observedAt);
  const expiresAt = Date.parse(observation.expiresAt);
  const createdAt = Date.parse(manifest?.release?.createdAt);
  if (
    !Number.isFinite(observedAt) ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(createdAt) ||
    expiresAt <= observedAt ||
    expiresAt - observedAt > releaseEvidenceMaximumValidityMs ||
    createdAt < observedAt ||
    createdAt > expiresAt
  ) {
    throw new Error('Release observation validity interval is invalid or exceeds 24 hours');
  }
  const protocolAdminSafe = validateSafeControlPlaneEvidence(
    evidence.protocolAdminSafe,
    observation,
    'Protocol-admin Safe',
  );
  const emergencyGuardianSafe = validateSafeControlPlaneEvidence(
    evidence.emergencyGuardianSafe,
    observation,
    'Emergency-guardian Safe',
  );
  if (protocolAdminSafe.block.timestamp !== emergencyGuardianSafe.block.timestamp) {
    throw new Error('Both Safe evidence records must use the same exact observation block timestamp');
  }
  if (protocolAdminSafe.safeAddress.toLowerCase() === emergencyGuardianSafe.safeAddress.toLowerCase()) {
    throw new Error('Protocol-admin and emergency-guardian Safe roles must be distinct');
  }
  return { assetCandidateDescriptor, configDescriptor, stateDescriptor };
}

/** Enforces freshness only at authorization time so expired records remain parseable historical evidence. */
export function validateReleaseEvidenceFreshness(manifest, nowMs = Date.now()) {
  validateReleaseEvidenceEnvelope(manifest);
  const createdAt = Date.parse(manifest.release.createdAt);
  const observedAt = Date.parse(manifest.releaseEvidence.observation.observedAt);
  const expiresAt = Date.parse(manifest.releaseEvidence.observation.expiresAt);
  if (createdAt > nowMs) throw new Error('Release manifest createdAt must not be in the future');
  if (observedAt > nowMs) throw new Error('Release observation observedAt must not be in the future');
  if (expiresAt <= nowMs) throw new Error('Release observation evidence has expired');
  return manifest;
}

export async function validateReleaseEvidenceCommit({
  evidenceCommit,
  manifestRepositoryPath,
  sourceCommit,
  workspace,
}) {
  validateGitObjectId(evidenceCommit, 'Evidence commit');
  validateGitObjectId(sourceCommit, 'Source commit');
  const workspaceRealPath = await assertExactRepositoryRoot(workspace);
  const headCommit = gitOutput(workspaceRealPath, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (headCommit !== evidenceCommit) {
    throw new Error(`Release workspace HEAD ${headCommit} does not match evidence commit ${evidenceCommit}`);
  }
  const ancestry = gitOutput(workspaceRealPath, ['rev-list', '--parents', '-n', '1', evidenceCommit]).split(' ');
  if (ancestry.length !== 2 || ancestry[0] !== evidenceCommit || ancestry[1] !== sourceCommit) {
    throw new Error('Release evidence commit must have exactly the declared source commit as its sole parent');
  }

  const manifestFile = await resolveTrackedRepositoryFile(workspaceRealPath, manifestRepositoryPath, {
    commit: evidenceCommit,
    label: 'Deployment manifest',
  });
  const manifest = await readJson(manifestFile.absolutePath);
  const { assetCandidateDescriptor, configDescriptor, stateDescriptor } = validateReleaseEvidenceEnvelope(manifest);
  const addedEvidencePaths = [configDescriptor.path, stateDescriptor.path];
  if (
    new Set([manifestRepositoryPath, assetCandidateDescriptor.path, ...addedEvidencePaths]).size !==
    addedEvidencePaths.length + 2
  ) {
    throw new Error('Signed manifest and deployment snapshot evidence paths must be distinct');
  }
  const policyFile = await resolveTrackedRepositoryFile(workspaceRealPath, releaseManifestSignaturePolicyPath, {
    commit: evidenceCommit,
    label: 'Release-manifest signature policy',
  });
  const sourcePolicyObjectId = regularBlobObjectIdAtCommit(
    workspaceRealPath,
    sourceCommit,
    releaseManifestSignaturePolicyPath,
    'Source release-manifest signature policy',
  );
  if (sourcePolicyObjectId !== policyFile.blobObjectId) {
    throw new Error('Release-manifest signature policy must be byte-identical in source and evidence commits');
  }
  const safePolicyFile = await resolveTrackedRepositoryFile(workspaceRealPath, safeControlPlanePolicyPath, {
    commit: evidenceCommit,
    label: 'Safe control-plane policy',
  });
  const sourceSafePolicyObjectId = regularBlobObjectIdAtCommit(
    workspaceRealPath,
    sourceCommit,
    safeControlPlanePolicyPath,
    'Source Safe control-plane policy',
  );
  if (sourceSafePolicyObjectId !== safePolicyFile.blobObjectId) {
    throw new Error('Safe control-plane policy must be byte-identical in source and evidence commits');
  }
  validateSafeControlPlanePolicy(await readJson(safePolicyFile.absolutePath), manifest);
  const changedPaths = gitOutput(workspaceRealPath, [
    'diff-tree',
    '--no-commit-id',
    '--name-status',
    '--no-renames',
    '-r',
    sourceCommit,
    evidenceCommit,
    '--',
  ]);
  const changedRecords = changedPaths.length === 0 ? [] : changedPaths.split('\n');
  const changedEvidencePaths = changedRecords.map((record) => {
    const match = /^A\t([^\t]+)$/.exec(record);
    if (match === null) throw new Error('Release evidence commit may only add regular declared evidence files');
    return match[1];
  });
  const expectedEvidencePaths = [manifestRepositoryPath, ...addedEvidencePaths].sort();
  const actualEvidencePaths = changedEvidencePaths.sort();
  if (
    actualEvidencePaths.length !== expectedEvidencePaths.length ||
    actualEvidencePaths.some((repositoryPath, index) => repositoryPath !== expectedEvidencePaths[index])
  ) {
    throw new Error(
      'Release evidence commit must add only the signed manifest and its declared hash-bound JSON evidence',
    );
  }
  const assetCandidateFile = await resolveTrackedRepositoryFile(workspaceRealPath, assetCandidateDescriptor.path, {
    commit: evidenceCommit,
    label: 'Reviewed asset candidate',
  });
  const sourceAssetCandidateObjectId = regularBlobObjectIdAtCommit(
    workspaceRealPath,
    sourceCommit,
    assetCandidateDescriptor.path,
    'Source reviewed asset candidate',
  );
  if (sourceAssetCandidateObjectId !== assetCandidateFile.blobObjectId) {
    throw new Error('Reviewed asset candidate must be byte-identical in source and evidence commits');
  }
  const configFile = await resolveTrackedRepositoryFile(workspaceRealPath, configDescriptor.path, {
    commit: evidenceCommit,
    label: 'Deployment config snapshot',
  });
  const stateFile = await resolveTrackedRepositoryFile(workspaceRealPath, stateDescriptor.path, {
    commit: evidenceCommit,
    label: 'Deployment state snapshot',
  });
  if ((await sha256File(configFile.absolutePath)) !== configDescriptor.rawSha256) {
    throw new Error('Deployment config snapshot raw bytes do not match the SHA-256 signed in the manifest');
  }
  if ((await sha256File(stateFile.absolutePath)) !== stateDescriptor.rawSha256) {
    throw new Error('Deployment state snapshot raw bytes do not match the SHA-256 signed in the manifest');
  }
  if ((await sha256File(assetCandidateFile.absolutePath)) !== assetCandidateDescriptor.rawSha256) {
    throw new Error('Reviewed asset candidate raw bytes do not match the SHA-256 signed in the manifest');
  }
  await readJson(assetCandidateFile.absolutePath);
  await readJson(configFile.absolutePath);
  await readJson(stateFile.absolutePath);
  return {
    assetCandidateFile,
    configFile,
    manifest,
    manifestFile,
    policyFile,
    safePolicyFile,
    stateFile,
    workspace: workspaceRealPath,
  };
}

/** Proves the complete tracked worktree and index still equal one commit; ignored outputs are outside this proof. */
export async function assertExactTrackedWorktree(workspace, commit) {
  validateGitObjectId(commit, 'Expected worktree commit');
  const root = await assertExactRepositoryRoot(workspace);
  const headCommit = gitOutput(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (headCommit !== commit) throw new Error(`Worktree HEAD ${headCommit} does not match expected commit ${commit}`);
  const objectFormat = gitOutput(root, ['rev-parse', '--show-object-format']);
  if (objectFormat !== 'sha1')
    throw new Error(`Release tooling requires a SHA-1 Git repository, found ${objectFormat}`);

  const indexRecords = gitBuffer(root, ['ls-files', '-v', '-z'])
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry.length > 0);
  const unsafeIndexRecord = indexRecords.find((entry) => !entry.startsWith('H '));
  if (unsafeIndexRecord !== undefined) {
    throw new Error(`Tracked index entry has a hidden or nonstandard flag: ${unsafeIndexRecord}`);
  }
  const fsmonitorRecords = gitBuffer(root, ['ls-files', '-f', '-z'])
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry.length > 0);
  const unsafeFsmonitorRecord = fsmonitorRecords.find((entry) => !entry.startsWith('H '));
  if (unsafeFsmonitorRecord !== undefined) {
    throw new Error(`Tracked index entry has a hidden fsmonitor flag: ${unsafeFsmonitorRecord}`);
  }
  try {
    gitBuffer(root, ['diff', '--cached', '--quiet', '--no-ext-diff', commit, '--']);
  } catch (error) {
    throw new Error('Git index does not exactly match the intended commit', { cause: error });
  }

  const treeRecords = gitBuffer(root, ['ls-tree', '-r', '-z', '--full-tree', commit])
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry.length > 0);
  if (treeRecords.length !== indexRecords.length) {
    throw new Error('Tracked index entry count does not match the intended commit tree');
  }
  for (const record of treeRecords) {
    const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(record);
    if (match === null) throw new Error(`Unsupported or malformed tracked tree entry: ${record}`);
    const [, mode, objectId, repositoryPath] = match;
    if (
      path.isAbsolute(repositoryPath) ||
      repositoryPath.split('/').includes('..') ||
      path.posix.normalize(repositoryPath) !== repositoryPath
    ) {
      throw new Error(`Tracked tree path is not confined: ${repositoryPath}`);
    }
    const worktreePath = path.join(root, repositoryPath);
    if ((await realpath(path.dirname(worktreePath))) !== path.dirname(worktreePath)) {
      throw new Error(`Tracked path has a symlinked ancestor: ${repositoryPath}`);
    }
    const stats = await lstat(worktreePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Tracked path type differs from the intended commit: ${repositoryPath}`);
    }
    const executableBits = stats.mode & 0o111;
    if ((mode === '100755' && executableBits !== 0o111) || (mode === '100644' && executableBits !== 0)) {
      throw new Error(`Tracked executable mode differs from the intended commit: ${repositoryPath}`);
    }
    if ((await realpath(worktreePath)) !== worktreePath) {
      throw new Error(`Tracked path resolves away from its lexical path: ${repositoryPath}`);
    }
    const bytes = await readFile(worktreePath);
    if (gitBlobObjectId(objectFormat, bytes) !== objectId) {
      throw new Error(`Tracked raw worktree bytes differ from the intended commit: ${repositoryPath}`);
    }
  }
  const untracked = gitBuffer(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (untracked.byteLength !== 0) throw new Error('Worktree contains nonignored untracked paths');
  await assertRepositoryHead(root, commit);
}

export async function sha256File(filePath) {
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

function exactObjectKeys(value, expectedKeys) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) && !/^0{64}$/.test(value);
}

const APPROVED_SPDX_IDENTIFIERS = new Set([
  'AGPL-3.0-only',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BUSL-1.1',
  'GPL-2.0-only',
  'GPL-3.0-only',
  'ISC',
  'MIT',
  'MPL-2.0',
]);
const REVIEW_PLACEHOLDER_PATTERN =
  /\b(?:AWAITING|DRAFT|FORTHCOMING|N\/?A|NA|NONE|NO ONE|NOT APPLICABLE|NOT APPROVED|NOT REVIEWED|OUTSTANDING|PENDING|PLACEHOLDER|PROVISIONAL|TBD|TODO|UNRESOLVED|UNREVIEWED)\b/i;
const REVIEW_DENIAL_PATTERN =
  /\b(?:no (?:independent |legal |rights |owner )?(?:approval|decision|review)|not independently reviewed|review has not occurred|without (?:approval|review)|(?:requires?|needs?) (?:further )?(?:approval|decision|review)|(?:approval|decision|review) (?:is )?(?:incomplete|not final|outstanding)|subject to (?:counsel |legal |owner |rights )?(?:approval|confirmation|review)|to be determined)\b/i;
const README_LICENSE_DENIAL_PATTERN =
  /\b(?:no license (?:has been |is )?(?:approved|chosen|selected)|not (?:yet )?licensed|without (?:an? )?license|license (?:has not been|is not|remains) (?:approved|chosen|decided|selected))\b/i;

function validSpdxIdentifier(value) {
  return typeof value === 'string' && APPROVED_SPDX_IDENTIFIERS.has(value);
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validReviewDate(value) {
  if (!validIsoDate(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return parsed.valueOf() <= todayUtc;
}

function validReviewedText(value) {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 3 &&
    value.length <= 2_000 &&
    !REVIEW_PLACEHOLDER_PATTERN.test(value) &&
    !REVIEW_DENIAL_PATTERN.test(value)
  );
}

function validateNoticeReview(review) {
  if (
    review === null ||
    typeof review !== 'object' ||
    Array.isArray(review) ||
    !exactObjectKeys(review, ['reference', 'reviewedAt', 'reviewedBy', 'thirdPartyNoticesReviewed']) ||
    !validReviewDate(review.reviewedAt) ||
    !validReviewedText(review.reviewedBy) ||
    !validReviewedText(review.reference) ||
    review.thirdPartyNoticesReviewed !== true
  ) {
    throw new Error('Repository NOTICE review metadata is invalid or not approved');
  }
}

/** Validates the hash-locked Python analyzer environment required for release evidence. */
export function validateAnalyzerEnvironmentPolicy(policy, { lockfileBytes = null, requireConfigured = true } = {}) {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error('Analyzer environment policy must be a JSON object');
  }
  if (
    policy.kind !== 'gumball-6900-analyzer-environment-policy' ||
    policy.protocol !== 'GUM BALL 6900' ||
    policy.schemaVersion !== 2
  ) {
    throw new Error('Analyzer environment policy identity is invalid');
  }
  if (policy.state === 'transitive-dependencies-unlocked') {
    if (
      !exactObjectKeys(policy, [
        'hermetic',
        'kind',
        'protocol',
        'pythonVersion',
        'releaseEligible',
        'schemaVersion',
        'state',
      ]) ||
      policy.hermetic !== false ||
      policy.releaseEligible !== false ||
      typeof policy.pythonVersion !== 'string' ||
      !/^\d+\.\d+\.\d+$/.test(policy.pythonVersion)
    ) {
      throw new Error('Non-hermetic analyzer environment policy fields are invalid');
    }
    if (requireConfigured) {
      throw new Error('Python analyzer transitive dependencies are not hash-locked for the release platform');
    }
    return policy;
  }
  if (!['configured', 'dependencies-prepared'].includes(policy.state)) {
    throw new Error('Analyzer environment policy state is invalid');
  }
  if (
    !exactObjectKeys(policy, [
      'bindings',
      'hermetic',
      'kind',
      'mythrilImage',
      'platform',
      'protocol',
      'pythonVersion',
      'releaseEligible',
      'review',
      'schemaVersion',
      'state',
    ]) ||
    policy.hermetic !== true ||
    policy.platform !== 'linux-x64' ||
    typeof policy.pythonVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(policy.pythonVersion)
  ) {
    throw new Error('Prepared analyzer environment identity is invalid');
  }
  if (policy.state === 'dependencies-prepared') {
    if (policy.releaseEligible !== false || policy.review !== null) {
      throw new Error('Prepared analyzer environment must remain ineligible pending independent review');
    }
  } else {
    if (
      policy.releaseEligible !== true ||
      policy.review === null ||
      typeof policy.review !== 'object' ||
      Array.isArray(policy.review) ||
      !exactObjectKeys(policy.review, ['reference', 'reviewedAt', 'reviewedBy']) ||
      !validReviewDate(policy.review.reviewedAt) ||
      !validReviewedText(policy.review.reviewedBy) ||
      !validReviewedText(policy.review.reference)
    ) {
      throw new Error('Configured analyzer environment review metadata is invalid');
    }
  }
  if (
    policy.mythrilImage === null ||
    typeof policy.mythrilImage !== 'object' ||
    Array.isArray(policy.mythrilImage) ||
    !exactObjectKeys(policy.mythrilImage, ['digest', 'platform', 'reference', 'version']) ||
    !/^sha256:[a-f0-9]{64}$/.test(policy.mythrilImage.digest) ||
    policy.mythrilImage.platform !== 'linux/amd64' ||
    !/^\d+\.\d+\.\d+$/.test(policy.mythrilImage.version) ||
    policy.mythrilImage.reference !== `mythril/myth:${policy.mythrilImage.version}@${policy.mythrilImage.digest}`
  ) {
    throw new Error('Prepared analyzer environment Mythril image binding is invalid');
  }
  const expectedTools = ['semgrep', 'slither'];
  if (!Array.isArray(policy.bindings) || policy.bindings.length !== expectedTools.length) {
    throw new Error('Prepared analyzer environment must bind exactly two Python analyzers');
  }
  if (
    lockfileBytes === null ||
    typeof lockfileBytes !== 'object' ||
    Array.isArray(lockfileBytes) ||
    !exactObjectKeys(lockfileBytes, analyzerEnvironmentLockPaths)
  ) {
    throw new Error('Prepared analyzer environment requires the exact two analyzer lock files');
  }
  policy.bindings.forEach((binding, index) => {
    const expectedTool = expectedTools[index];
    const expectedPath = analyzerEnvironmentLockPaths[index];
    if (
      binding === null ||
      typeof binding !== 'object' ||
      Array.isArray(binding) ||
      !exactObjectKeys(binding, ['path', 'sha256', 'tool']) ||
      binding.tool !== expectedTool ||
      binding.path !== expectedPath ||
      !validSha256(binding.sha256)
    ) {
      throw new Error(`Prepared analyzer environment ${expectedTool} binding is invalid`);
    }
    const bytes = lockfileBytes[expectedPath];
    if (!(bytes instanceof Uint8Array)) {
      throw new Error(`Prepared analyzer environment lock file is missing or not regular: ${expectedPath}`);
    }
    if (sha256Bytes(bytes) !== binding.sha256) {
      throw new Error(`Prepared analyzer environment lock file SHA-256 mismatch: ${expectedPath}`);
    }
  });
  if (requireConfigured && policy.state !== 'configured') {
    throw new Error('Analyzer dependencies are prepared but independent security review is not configured');
  }
  return policy;
}

/**
 * Validates the owner/counsel-approved metadata that binds the exact LICENSE and NOTICE bytes.
 * This proves identity and review binding only; it deliberately does not infer legal sufficiency.
 */
export function validateRepositoryLicenseNoticePolicy(policy, { requireConfigured = true } = {}) {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error('Repository license/NOTICE policy must be a JSON object');
  }
  if (
    policy.kind !== 'gumball-6900-repository-license-notice-policy' ||
    policy.protocol !== 'GUM BALL 6900' ||
    policy.schemaVersion !== 1
  ) {
    throw new Error('Repository license/NOTICE policy identity is invalid');
  }
  if (policy.state === 'unconfigured') {
    if (!exactObjectKeys(policy, ['kind', 'protocol', 'schemaVersion', 'state'])) {
      throw new Error('Unconfigured repository license/NOTICE policy has unexpected fields');
    }
    if (requireConfigured) throw new Error('Repository license/NOTICE policy is unconfigured');
    return policy;
  }
  if (policy.state !== 'configured') throw new Error('Repository license/NOTICE policy state is invalid');
  if (!exactObjectKeys(policy, ['kind', 'license', 'notice', 'protocol', 'schemaVersion', 'state'])) {
    throw new Error('Configured repository license/NOTICE policy fields are invalid');
  }
  if (
    policy.license === null ||
    typeof policy.license !== 'object' ||
    Array.isArray(policy.license) ||
    !exactObjectKeys(policy.license, [
      'additionalUseGrant',
      'changeDate',
      'changeLicenseSpdxIdentifier',
      'licensedWork',
      'licensor',
      'operativeSpdxIdentifier',
      'path',
      'sha256',
    ])
  ) {
    throw new Error('Configured repository LICENSE metadata fields are invalid');
  }
  if (policy.license.path !== 'LICENSE' || !validSha256(policy.license.sha256)) {
    throw new Error('Repository LICENSE path or SHA-256 is invalid');
  }
  if (
    !validSpdxIdentifier(policy.license.operativeSpdxIdentifier) ||
    !validSpdxIdentifier(policy.license.changeLicenseSpdxIdentifier)
  ) {
    throw new Error('Repository operative or change-license SPDX identifier is invalid');
  }
  if (!validIsoDate(policy.license.changeDate)) {
    throw new Error('Repository license change date must be an exact calendar date');
  }
  for (const [label, value] of [
    ['additional-use grant', policy.license.additionalUseGrant],
    ['licensed work', policy.license.licensedWork],
    ['licensor', policy.license.licensor],
  ]) {
    if (!validReviewedText(value)) throw new Error(`Repository license ${label} metadata is invalid`);
  }
  if (
    policy.notice === null ||
    typeof policy.notice !== 'object' ||
    Array.isArray(policy.notice) ||
    !exactObjectKeys(policy.notice, ['path', 'review', 'sha256']) ||
    policy.notice.path !== 'NOTICE' ||
    !validSha256(policy.notice.sha256)
  ) {
    throw new Error('Configured repository NOTICE metadata fields are invalid');
  }
  validateNoticeReview(policy.notice.review);
  return policy;
}

function validateRightsReview(review) {
  if (
    review === null ||
    typeof review !== 'object' ||
    Array.isArray(review) ||
    !exactObjectKeys(review, ['approvedScope', 'reference', 'reviewedAt', 'reviewedBy']) ||
    !validReviewDate(review.reviewedAt) ||
    !validReviewedText(review.reviewedBy) ||
    !validReviewedText(review.reference) ||
    !validReviewedText(review.approvedScope)
  ) {
    throw new Error('Canonical-logo rights-review metadata is invalid or not approved');
  }
}

/** Validates provenance and usage-rights metadata for the exact canonical source PNG. */
export function validateCanonicalLogoProvenancePolicy(policy, { requireConfigured = true } = {}) {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error('Canonical-logo provenance policy must be a JSON object');
  }
  if (
    policy.kind !== 'gumball-6900-canonical-logo-provenance-policy' ||
    policy.protocol !== 'GUM BALL 6900' ||
    policy.schemaVersion !== 1
  ) {
    throw new Error('Canonical-logo provenance policy identity is invalid');
  }
  if (policy.state === 'unconfigured') {
    if (!exactObjectKeys(policy, ['kind', 'protocol', 'schemaVersion', 'state'])) {
      throw new Error('Unconfigured canonical-logo provenance policy has unexpected fields');
    }
    if (requireConfigured) throw new Error('Canonical-logo provenance policy is unconfigured');
    return policy;
  }
  if (policy.state !== 'configured') throw new Error('Canonical-logo provenance policy state is invalid');
  if (!exactObjectKeys(policy, ['asset', 'kind', 'protocol', 'rightsReview', 'schemaVersion', 'state'])) {
    throw new Error('Configured canonical-logo provenance policy fields are invalid');
  }
  if (
    policy.asset === null ||
    typeof policy.asset !== 'object' ||
    Array.isArray(policy.asset) ||
    !exactObjectKeys(policy.asset, ['originalFileName', 'path', 'preservedOriginal', 'sha256', 'sourceReference']) ||
    policy.asset.path !== canonicalLogoPath ||
    policy.asset.originalFileName !== 'GUM_BALL_6900_LOGO.png' ||
    !validSha256(policy.asset.sha256) ||
    !validReviewedText(policy.asset.sourceReference) ||
    policy.asset.preservedOriginal !== true
  ) {
    throw new Error('Canonical-logo source asset metadata is invalid');
  }
  validateRightsReview(policy.rightsReview);
  return policy;
}

export function validateReleaseManifestSignaturePolicy(policy, { requireConfigured = true } = {}) {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error('Release-manifest signature policy must be a JSON object');
  }
  if (
    policy.kind !== 'gumball-6900-release-manifest-signature-policy' ||
    policy.protocol !== 'GUM BALL 6900' ||
    policy.schemaVersion !== 1
  ) {
    throw new Error('Release-manifest signature policy identity is invalid');
  }
  if (policy.state === 'unconfigured') {
    if (!exactObjectKeys(policy, ['kind', 'protocol', 'schemaVersion', 'state'])) {
      throw new Error('Unconfigured release-manifest signature policy has unexpected fields');
    }
    if (requireConfigured) throw new Error('Release-manifest signature policy is unconfigured');
    return policy;
  }
  if (policy.state !== 'configured') throw new Error('Release-manifest signature policy state is invalid');
  if (!exactObjectKeys(policy, ['kind', 'policyId', 'protocol', 'roleQuorums', 'schemaVersion', 'state'])) {
    throw new Error('Configured release-manifest signature policy fields are invalid');
  }
  if (!/^0x[0-9a-f]{64}$/.test(policy.policyId) || /^0x0{64}$/.test(policy.policyId)) {
    throw new Error('Release-manifest signature policy ID must be a nonzero lowercase bytes32');
  }
  if (
    policy.roleQuorums === null ||
    typeof policy.roleQuorums !== 'object' ||
    Array.isArray(policy.roleQuorums) ||
    !exactObjectKeys(policy.roleQuorums, releaseManifestSignerRoles)
  ) {
    throw new Error('Release-manifest signature policy requires every signer-role quorum');
  }
  const allSigners = [];
  for (const role of releaseManifestSignerRoles) {
    const quorum = policy.roleQuorums[role];
    if (
      quorum === null ||
      typeof quorum !== 'object' ||
      Array.isArray(quorum) ||
      !exactObjectKeys(quorum, ['authorizedSigners', 'threshold']) ||
      !Array.isArray(quorum.authorizedSigners) ||
      quorum.authorizedSigners.length === 0
    ) {
      throw new Error(`Release-manifest ${role} signer-role quorum is invalid`);
    }
    const roleSigners = quorum.authorizedSigners.map((signer) => {
      if (typeof signer !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(signer) || /^0x0{40}$/i.test(signer)) {
        throw new Error(`Release-manifest ${role} signer-role quorum contains an invalid signer`);
      }
      return signer.toLowerCase();
    });
    if (new Set(roleSigners).size !== roleSigners.length) {
      throw new Error(`Release-manifest ${role} signer-role quorum members must be unique`);
    }
    if (!Number.isSafeInteger(quorum.threshold) || quorum.threshold <= 0 || quorum.threshold > roleSigners.length) {
      throw new Error(`Release-manifest ${role} signer-role quorum threshold is invalid`);
    }
    allSigners.push(...roleSigners);
  }
  if (new Set(allSigners).size !== allSigners.length) {
    throw new Error('Release-manifest signer-role memberships must be globally distinct');
  }
  return policy;
}

export function validateRobinhoodTestnetForkEvidence(
  evidence,
  { nowMs = Date.now(), requireConfigured = true, requireFresh = true } = {},
) {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('Robinhood testnet fork evidence must be a JSON object');
  }
  if (
    evidence.kind !== 'gumball-6900-robinhood-testnet-fork-evidence' ||
    evidence.protocol !== 'GUM BALL 6900' ||
    evidence.schemaVersion !== 1
  ) {
    throw new Error('Robinhood testnet fork evidence identity is invalid');
  }
  if (evidence.state === 'unconfigured') {
    if (!exactObjectKeys(evidence, ['kind', 'protocol', 'schemaVersion', 'state'])) {
      throw new Error('Unconfigured Robinhood testnet fork evidence has unexpected fields');
    }
    if (requireConfigured) throw new Error('Robinhood testnet fork evidence is unconfigured');
    return evidence;
  }
  if (evidence.state !== 'configured') throw new Error('Robinhood testnet fork evidence state is invalid');
  if (
    !exactObjectKeys(evidence, [
      'blockHash',
      'blockNumber',
      'chainId',
      'dependencies',
      'expiresAt',
      'kind',
      'observedAt',
      'parentBlockHash',
      'protocol',
      'schemaVersion',
      'sourceUrl',
      'state',
    ])
  ) {
    throw new Error('Configured Robinhood testnet fork evidence fields are invalid');
  }
  if (evidence.chainId !== 46630 || !/^\d+$/.test(evidence.blockNumber) || BigInt(evidence.blockNumber) <= 0n) {
    throw new Error('Robinhood testnet fork evidence chain or block is invalid');
  }
  for (const [label, value] of [
    ['block', evidence.blockHash],
    ['parent block', evidence.parentBlockHash],
  ]) {
    if (!/^0x[0-9a-f]{64}$/.test(value) || /^0x0{64}$/.test(value)) {
      throw new Error(`Robinhood testnet fork ${label} hash is invalid`);
    }
  }
  const observedAt = typeof evidence.observedAt === 'string' ? Date.parse(evidence.observedAt) : Number.NaN;
  const expiresAt = typeof evidence.expiresAt === 'string' ? Date.parse(evidence.expiresAt) : Number.NaN;
  if (
    !Number.isFinite(observedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= observedAt ||
    expiresAt - observedAt > releaseEvidenceMaximumValidityMs
  ) {
    throw new Error('Robinhood testnet fork observation validity is invalid or exceeds 24 hours');
  }
  if (requireFresh && observedAt > nowMs) {
    throw new Error('Robinhood testnet fork evidence is future-dated');
  }
  if (requireFresh && expiresAt <= nowMs) {
    throw new Error('Robinhood testnet fork evidence has expired');
  }
  try {
    const sourceUrl = new URL(evidence.sourceUrl);
    if (sourceUrl.protocol !== 'https:') throw new Error('not HTTPS');
  } catch {
    throw new Error('Robinhood testnet fork source URL is invalid');
  }
  const dependencyKeys = ['usdG'];
  if (
    evidence.dependencies === null ||
    typeof evidence.dependencies !== 'object' ||
    Array.isArray(evidence.dependencies) ||
    !exactObjectKeys(evidence.dependencies, dependencyKeys)
  ) {
    throw new Error('Robinhood testnet fork dependency set is invalid');
  }
  const addresses = [];
  for (const key of dependencyKeys) {
    const dependency = evidence.dependencies[key];
    if (
      dependency === null ||
      typeof dependency !== 'object' ||
      Array.isArray(dependency) ||
      !exactObjectKeys(dependency, ['address', 'runtimeBytecodeHash']) ||
      !/^0x[0-9a-fA-F]{40}$/.test(dependency.address) ||
      /^0x0{40}$/i.test(dependency.address) ||
      !/^0x[0-9a-f]{64}$/.test(dependency.runtimeBytecodeHash) ||
      /^0x0{64}$/.test(dependency.runtimeBytecodeHash)
    ) {
      throw new Error(`Robinhood testnet fork dependency ${key} is invalid`);
    }
    addresses.push(dependency.address.toLowerCase());
  }
  if (new Set(addresses).size !== addresses.length) {
    throw new Error('Robinhood testnet fork dependency addresses must be unique');
  }
  return evidence;
}

export function validateManifestBinding(manifest, { signaturePolicy, sourceCommit, tag }) {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Deployment manifest must be a JSON object');
  }
  if (manifest.kind !== 'gumball-6900-deployment-manifest' || manifest.protocol !== 'GUM BALL 6900') {
    throw new Error('Deployment manifest protocol identity is invalid');
  }
  if (manifest.release?.status !== 'release-approved') {
    throw new Error('Deployment manifest must have release-approved status');
  }
  if (manifest.release.version !== tag) throw new Error('Release tag does not match manifest release.version');
  if (manifest.release.gitCommit !== sourceCommit)
    throw new Error('Release source commit does not match manifest release.gitCommit');
  if (manifest.network?.chainId !== 4663) throw new Error('Release-approved manifest must target Robinhood mainnet');
  if (!Array.isArray(manifest.signatures) || manifest.signatures.length === 0) {
    throw new Error('Release-approved manifest must contain signatures');
  }
  const trustedPolicy = validateReleaseManifestSignaturePolicy(signaturePolicy);
  const authorizedSigners = releaseManifestSignerRoles.flatMap(
    (role) => trustedPolicy.roleQuorums[role].authorizedSigners,
  );
  const expectedManifestPolicy = {
    authorizedSigners,
    policyId: trustedPolicy.policyId,
    roleQuorums: trustedPolicy.roleQuorums,
    threshold: releaseManifestSignerRoles.reduce((sum, role) => sum + trustedPolicy.roleQuorums[role].threshold, 0),
  };
  if (deterministicJson(manifest.signaturePolicy) !== deterministicJson(expectedManifestPolicy)) {
    throw new Error('Deployment manifest signaturePolicy does not exactly match the committed release policy');
  }
  const gates = Object.entries(manifest.gates ?? {});
  if (gates.length === 0 || gates.some(([, gate]) => gate?.state !== 'passed')) {
    throw new Error('Every manifest gate must be passed');
  }
  const evidenceKinds = new Set(['audit', 'deployment', 'legal', 'manifest', 'operations', 'simulation', 'test']);
  for (const [gateName, gate] of gates) {
    if (!Array.isArray(gate.evidence) || gate.evidence.length === 0) {
      throw new Error(`Passed manifest gate ${gateName} requires evidence`);
    }
    for (const [index, evidence] of gate.evidence.entries()) {
      if (
        evidence === null ||
        typeof evidence !== 'object' ||
        Array.isArray(evidence) ||
        !exactObjectKeys(evidence, ['digest', 'kind', 'uri']) ||
        typeof evidence.digest !== 'string' ||
        !/^0x[0-9a-f]{64}$/.test(evidence.digest) ||
        /^0x0{64}$/.test(evidence.digest) ||
        !evidenceKinds.has(evidence.kind)
      ) {
        throw new Error(`Passed manifest gate ${gateName} evidence ${index} is not hash-bound`);
      }
      let evidenceUrl;
      try {
        evidenceUrl = new URL(evidence.uri);
      } catch {
        throw new Error(`Passed manifest gate ${gateName} evidence ${index} lacks a durable URI`);
      }
      if (!['ar:', 'https:', 'ipfs:'].includes(evidenceUrl.protocol)) {
        throw new Error(`Passed manifest gate ${gateName} evidence ${index} lacks a durable URI`);
      }
    }
  }
  validateReleaseEvidenceFreshness(manifest);
  return manifest;
}

/** Derives the removed pre-rebuild graph for archival fixture validation only. */
export function deriveArchivedSubgraphNetworks(manifest) {
  const contracts = new Map((manifest.deployedContracts ?? []).map((contract) => [contract.name, contract]));
  const network = {};
  for (const name of archivedSubgraphContractNames) {
    const contract = contracts.get(name);
    if (contract === undefined) throw new Error(`Release manifest lacks subgraph contract ${name}`);
    const startBlock = Number(contract.blockNumber);
    if (!Number.isSafeInteger(startBlock) || startBlock <= 0) {
      throw new Error(`Release manifest ${name}.blockNumber is not a positive safe integer`);
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(contract.address) || /^0x0{40}$/i.test(contract.address)) {
      throw new Error(`Release manifest ${name}.address is invalid`);
    }
    network[name] = { address: contract.address, startBlock };
  }
  return { robinhood: network };
}

/**
 * Current subgraph deployment derivation deliberately has no fallback to the
 * archived manifest graph.
 */
export function deriveSubgraphNetworks(_manifest) {
  void _manifest;
  assertCurrentReleaseToolingAvailable();
}

export async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse JSON file ${filePath}`, { cause: error });
  }
}

export function sourceDateEpoch(workspace, commit) {
  const value = gitOutput(workspace, ['show', '-s', '--format=%ct', commit]);
  if (!/^\d+$/.test(value)) throw new Error('Unable to derive SOURCE_DATE_EPOCH from the release commit');
  return value;
}

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isDecodablePng(value) {
  if (!(value instanceof Uint8Array)) return false;
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.byteLength < 45 || !bytes.subarray(0, signature.byteLength).equals(signature)) return false;

  let offset = signature.byteLength;
  let hasHeader = false;
  let hasPalette = false;
  let imageDataEnded = false;
  const imageData = [];
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  while (offset + 12 <= bytes.byteLength) {
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > bytes.byteLength) return false;
    const chunkType = bytes.toString('ascii', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(chunkType)) return false;
    const chunkData = bytes.subarray(offset + 8, offset + 8 + chunkLength);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + chunkLength);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + chunkLength)) !== expectedCrc) return false;
    if (!hasHeader) {
      if (chunkType !== 'IHDR' || chunkLength !== 13) return false;
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      const legalDepths = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        width === 0 ||
        height === 0 ||
        width > 4_096 ||
        height > 4_096 ||
        !legalDepths[colorType]?.includes(bitDepth) ||
        chunkData[10] !== 0 ||
        chunkData[11] !== 0 ||
        chunkData[12] !== 0
      ) {
        return false;
      }
      hasHeader = true;
    } else if (chunkType === 'IHDR') {
      return false;
    }
    if (chunkType === 'PLTE') {
      if (hasPalette || imageData.length > 0 || chunkLength === 0 || chunkLength % 3 !== 0 || chunkLength > 768) {
        return false;
      }
      if (colorType === 0 || colorType === 4) return false;
      hasPalette = true;
    } else if (chunkType === 'IDAT') {
      if (imageDataEnded) return false;
      imageData.push(chunkData);
    } else if (imageData.length > 0 && chunkType !== 'IEND') {
      imageDataEnded = true;
    }
    if (/^[A-Z]/.test(chunkType) && !['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(chunkType)) return false;
    if (chunkType === 'IEND') {
      if (!hasHeader || imageData.length === 0 || chunkLength !== 0 || chunkEnd !== bytes.byteLength) return false;
      if (colorType === 3 && !hasPalette) return false;
      const compressed = Buffer.concat(imageData);
      if (compressed.byteLength === 0) return false;
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
      const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
      const expectedLength = height * (rowBytes + 1);
      if (!Number.isSafeInteger(expectedLength) || expectedLength <= 0 || expectedLength > 64 * 1024 * 1024)
        return false;
      try {
        const decoded = inflateSync(compressed, { maxOutputLength: expectedLength + 1 });
        if (decoded.byteLength !== expectedLength) return false;
        for (let row = 0; row < height; row += 1) {
          if (decoded[row * (rowBytes + 1)] > 4) return false;
        }
      } catch {
        return false;
      }
      return true;
    }
    offset = chunkEnd;
  }
  return false;
}

function substantiveUtf8(value, minimumLength) {
  if (!(value instanceof Uint8Array)) return null;
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(value);
  } catch {
    return null;
  }
  if (
    text.trim().length < minimumLength ||
    [...text].some((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint === 0 ||
        (codePoint >= 1 && codePoint <= 8) ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31)
      );
    }) ||
    REVIEW_PLACEHOLDER_PATTERN.test(text)
  ) {
    return null;
  }
  return text;
}

function licenseSection(readme) {
  if (typeof readme !== 'string' || readme.trim().length === 0) return null;
  const heading = /^#{1,3}[ \t]+License[ \t]*$/im.exec(readme);
  if (heading === null) return null;
  const afterHeading = readme.slice(heading.index + heading[0].length);
  const nextHeading = /^#{1,3}[ \t]+.+$/m.exec(afterHeading);
  return (nextHeading === null ? afterHeading : afterHeading.slice(0, nextHeading.index)).trim();
}

function hasAffirmativeLicenseStatement(section, spdxIdentifier) {
  const escapedIdentifier = spdxIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`\\b(?:available|distributed|licensed|provided|released) under (?:the )?${escapedIdentifier}\\b`, 'i'),
    new RegExp(`\\b(?:operative|project|repository|software|source) license (?:is|:)\\s*${escapedIdentifier}\\b`, 'i'),
    new RegExp(`\\bsubject to (?:the )?${escapedIdentifier}\\b`, 'i'),
  ].some((pattern) => pattern.test(section));
}

function markdownWithoutCommentsOrFencedCode(markdown) {
  const withoutComments = markdown.replace(/^\uFEFF/u, '').replace(/<!--[\s\S]*?(?:-->|$)/gu, '');
  const visibleLines = [];
  let fence = null;
  let frontMatter = null;
  for (const [index, line] of withoutComments.split(/\r\n?|\n/u).entries()) {
    const frontMatterDelimiter = /^(---|\+\+\+)[ \t]*$/u.exec(line)?.[1] ?? null;
    if (index === 0 && frontMatterDelimiter !== null) {
      frontMatter = frontMatterDelimiter;
      visibleLines.push('');
      continue;
    }
    if (frontMatter !== null) {
      if (line.trimEnd() === frontMatter) frontMatter = null;
      visibleLines.push('');
      continue;
    }
    if (fence !== null) {
      const closingFence = new RegExp(`^[ \\t]{0,3}${fence.character}{${fence.length},}[ \\t]*$`, 'u');
      if (closingFence.test(line)) fence = null;
      visibleLines.push('');
      continue;
    }
    const openingFence = /^[ \t]{0,3}(`{3,}|~{3,})/u.exec(line);
    if (openingFence !== null) {
      fence = { character: openingFence[1][0], length: openingFence[1].length };
      visibleLines.push('');
      continue;
    }
    visibleLines.push(line);
  }
  return visibleLines.join('\n');
}

function hasConcretePrivateSecurityContact(security, canonicalRepositoryUrl) {
  if (typeof security !== 'string' || canonicalRepositoryUrl === null) return false;
  const expectedUrl = `${canonicalRepositoryUrl}/security/advisories/new`;
  const escapedUrl = expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const visibleMarkdown = markdownWithoutCommentsOrFencedCode(security);
  const renderedLink = `(?:\\[Open a private vulnerability report\\]\\(${escapedUrl}\\)|<${escapedUrl}>)`;
  const field = new RegExp(`^Private reporting endpoint: ${renderedLink}[ \\t]*$`, 'mu').exec(visibleMarkdown);
  if (field === null) return false;
  const surroundingMarkdown = `${visibleMarkdown.slice(0, field.index)}${visibleMarkdown.slice(field.index + field[0].length)}`;
  return !/[<>[\]`]/u.test(surroundingMarkdown) && !/^[ \t]*(?:\$\$|\\\[|\\\])[ \t]*$/mu.test(surroundingMarkdown);
}

function sha256Bytes(value) {
  if (!(value instanceof Uint8Array)) return null;
  return createHash('sha256')
    .update(Buffer.from(value.buffer, value.byteOffset, value.byteLength))
    .digest('hex');
}

export function evaluateReleaseReadiness({
  analyzerEnvironmentLockfiles,
  analyzerEnvironmentPolicy,
  canonicalLogo,
  canonicalLogoProvenancePolicy,
  canonicalRepositoryUrl,
  dependencyLicenseInventory,
  dependencyLicenseReviewPolicy,
  license,
  notice,
  packageLicense,
  pnpmLock,
  pnpmWorkspace,
  readme,
  releaseManifestSignaturePolicy,
  safeControlPlanePolicy,
  repositoryLicenseNoticePolicy,
  robinhoodTestnetForkEvidence,
  security,
}) {
  // The checks below validate retained Safe-era evidence only. They cannot authorize
  // the external-governance graph until that graph has its own reviewed schema.
  const blockers = [currentReleaseToolingBlocker];
  try {
    validateSafeControlPlanePolicyShape(safeControlPlanePolicy);
  } catch (error) {
    blockers.push(`Safe control-plane policy is not release-valid at ${safeControlPlanePolicyPath}: ${error.message}`);
  }
  if (analyzerEnvironmentPolicy === null || analyzerEnvironmentPolicy === undefined) {
    blockers.push(`Analyzer environment policy is missing at ${analyzerEnvironmentPolicyPath}`);
  } else {
    try {
      validateAnalyzerEnvironmentPolicy(analyzerEnvironmentPolicy, { lockfileBytes: analyzerEnvironmentLockfiles });
    } catch (error) {
      blockers.push(`Analyzer environment policy is not release-approved: ${error.message}`);
    }
  }
  const normalizedCanonicalRepositoryUrl = normalizeCanonicalGithubRepositoryUrl(canonicalRepositoryUrl);
  const trustedCanonicalRepositoryUrl =
    normalizedCanonicalRepositoryUrl !== null && normalizedCanonicalRepositoryUrl === canonicalRepositoryUrl
      ? normalizedCanonicalRepositoryUrl
      : null;
  if (trustedCanonicalRepositoryUrl === null) {
    blockers.push('Canonical GitHub repository origin is unavailable or invalid');
  }
  if (!isDecodablePng(canonicalLogo)) {
    blockers.push(`Canonical logo is missing or is not a CRC-valid, decodable PNG at ${canonicalLogoPath}`);
  }
  let validatedLogoPolicy = null;
  if (canonicalLogoProvenancePolicy === null || canonicalLogoProvenancePolicy === undefined) {
    blockers.push(`Canonical-logo provenance policy is missing at ${canonicalLogoProvenancePolicyPath}`);
  } else {
    try {
      validatedLogoPolicy = validateCanonicalLogoProvenancePolicy(canonicalLogoProvenancePolicy);
    } catch (error) {
      blockers.push(`Canonical-logo provenance policy is not configured: ${error.message}`);
    }
  }
  if (validatedLogoPolicy !== null && canonicalLogo instanceof Uint8Array) {
    if (sha256Bytes(canonicalLogo) !== validatedLogoPolicy.asset.sha256) {
      blockers.push('Canonical logo SHA-256 does not match the approved provenance policy');
    }
  }

  const licenseText = substantiveUtf8(license, 120);
  const noticeText = substantiveUtf8(notice, 80);
  if (licenseText === null) blockers.push('LICENSE is missing or is not substantive canonical UTF-8 text at LICENSE');
  if (noticeText === null) blockers.push('NOTICE is missing or is not substantive canonical UTF-8 text at NOTICE');
  let validatedLicensePolicy = null;
  if (repositoryLicenseNoticePolicy === null || repositoryLicenseNoticePolicy === undefined) {
    blockers.push(`Repository license/NOTICE policy is missing at ${repositoryLicenseNoticePolicyPath}`);
  } else {
    try {
      validatedLicensePolicy = validateRepositoryLicenseNoticePolicy(repositoryLicenseNoticePolicy);
    } catch (error) {
      blockers.push(`Repository license/NOTICE policy is not configured: ${error.message}`);
    }
  }
  if (validatedLicensePolicy !== null) {
    if (license instanceof Uint8Array && sha256Bytes(license) !== validatedLicensePolicy.license.sha256) {
      blockers.push('LICENSE SHA-256 does not match the approved repository license/NOTICE policy');
    }
    if (notice instanceof Uint8Array && sha256Bytes(notice) !== validatedLicensePolicy.notice.sha256) {
      blockers.push('NOTICE SHA-256 does not match the approved repository license/NOTICE policy');
    }
    if (packageLicense !== validatedLicensePolicy.license.operativeSpdxIdentifier) {
      blockers.push('Root package license does not match the policy operative SPDX identifier');
    }
    if (licenseText !== null) {
      for (const [label, expected] of [
        ['operative SPDX identifier', validatedLicensePolicy.license.operativeSpdxIdentifier],
        ['change-license SPDX identifier', validatedLicensePolicy.license.changeLicenseSpdxIdentifier],
        ['change date', validatedLicensePolicy.license.changeDate],
        ['licensed work', validatedLicensePolicy.license.licensedWork],
        ['licensor', validatedLicensePolicy.license.licensor],
        ['additional-use grant', validatedLicensePolicy.license.additionalUseGrant],
      ]) {
        if (!licenseText.includes(expected)) blockers.push(`LICENSE text does not contain its approved ${label}`);
      }
    }
  }

  if (dependencyLicenseReviewPolicy === null || dependencyLicenseReviewPolicy === undefined) {
    blockers.push(`Dependency license review policy is missing at ${dependencyLicenseReviewPolicyPath}`);
  } else {
    const dependencyApprovalErrors = releaseApprovalErrors(dependencyLicenseReviewPolicy);
    if (dependencyApprovalErrors.length > 0) {
      const displayedErrors = dependencyApprovalErrors.slice(0, 5);
      const omittedCount = dependencyApprovalErrors.length - displayedErrors.length;
      blockers.push(
        `Dependency license review policy is not release-approved: ${displayedErrors.join('; ')}${
          omittedCount > 0 ? `; plus ${omittedCount} additional blocker(s)` : ''
        }`,
      );
    }
    if (!(pnpmLock instanceof Uint8Array)) {
      blockers.push(
        'Dependency license review cannot be bound because pnpm-lock.yaml is missing or is not a regular file',
      );
    }
    if (!(dependencyLicenseInventory instanceof Uint8Array)) {
      blockers.push(
        `Dependency license review cannot be bound because the inventory is missing or is not a regular file at ${dependencyLicenseInventoryPath}`,
      );
    }
    if (pnpmLock instanceof Uint8Array && dependencyLicenseInventory instanceof Uint8Array) {
      const dependencyBinding = evaluateLicenseReview({
        lockfileBytes: pnpmLock,
        policy: dependencyLicenseReviewPolicy,
        reportBytes: dependencyLicenseInventory,
        workspaceConfigBytes: pnpmWorkspace,
      });
      if (dependencyBinding.errors.length > 0) {
        const displayedErrors = dependencyBinding.errors.slice(0, 5);
        const omittedCount = dependencyBinding.errors.length - displayedErrors.length;
        blockers.push(
          `Dependency license review policy is not bound to the current lockfile and inventory: ${displayedErrors.join(
            '; ',
          )}${omittedCount > 0 ? `; plus ${omittedCount} additional blocker(s)` : ''}`,
        );
      }
    }
  }

  if (security === null || security.trim().length < 40) {
    blockers.push('SECURITY.md is missing or empty');
  } else {
    if (
      !hasConcretePrivateSecurityContact(security, trustedCanonicalRepositoryUrl) ||
      /example\.(?:com|net|org)|\b(?:TODO|TBD|UNRESOLVED|PLACEHOLDER)\b/i.test(security)
    ) {
      blockers.push(
        'SECURITY.md lacks the exact canonical-repository private vulnerability-reporting endpoint or contains a placeholder',
      );
    }
  }

  const readmeLicenseSection = licenseSection(readme);
  if (readmeLicenseSection === null) {
    blockers.push('README lacks a positive License section');
  } else if (
    validatedLicensePolicy === null ||
    !readmeLicenseSection.includes(validatedLicensePolicy.license.operativeSpdxIdentifier) ||
    !hasAffirmativeLicenseStatement(readmeLicenseSection, validatedLicensePolicy.license.operativeSpdxIdentifier) ||
    !/\[[^\]]*LICENSE[^\]]*\]\((?:\.\/)?LICENSE\)/i.test(readmeLicenseSection) ||
    !/\[[^\]]*NOTICE[^\]]*\]\((?:\.\/)?NOTICE\)/i.test(readmeLicenseSection) ||
    REVIEW_PLACEHOLDER_PATTERN.test(readmeLicenseSection) ||
    README_LICENSE_DENIAL_PATTERN.test(readmeLicenseSection) ||
    /\b(?:unresolved|not decided|pending approval|license decision required)\b/i.test(readmeLicenseSection)
  ) {
    blockers.push('README License section is not tied to the configured SPDX identifier, LICENSE, and NOTICE');
  }

  if (releaseManifestSignaturePolicy === null || releaseManifestSignaturePolicy === undefined) {
    blockers.push(`Release-manifest signature policy is missing at ${releaseManifestSignaturePolicyPath}`);
  } else {
    try {
      validateReleaseManifestSignaturePolicy(releaseManifestSignaturePolicy);
    } catch (error) {
      blockers.push(`Release-manifest signature policy is not configured: ${error.message}`);
    }
  }
  if (robinhoodTestnetForkEvidence === null || robinhoodTestnetForkEvidence === undefined) {
    blockers.push(`Robinhood testnet fork evidence is missing at ${robinhoodTestnetForkEvidencePath}`);
  } else {
    try {
      validateRobinhoodTestnetForkEvidence(robinhoodTestnetForkEvidence);
    } catch (error) {
      blockers.push(`Robinhood testnet fork evidence is not configured: ${error.message}`);
    }
  }
  return blockers;
}
