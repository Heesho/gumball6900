import { execFile as execFileCallback } from 'node:child_process';
import { access, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { Contract, getAddress } from 'ethers';
import type { Signer } from 'ethers';
import hre from 'hardhat';

import {
  deployPhaseOne,
  executeRegistryPhase,
  fundGenesisPhase,
  readDeploymentConfig,
  readDeploymentState,
  scheduleRegistryPhaseLocalEOA,
  settleGenesisPhase,
  writeDeploymentState,
} from './deployment';
import { prepareSafeScheduleBundle } from './safe-schedule-bundle';
import {
  assertConservativeSafeControlPlaneIdentity,
  assertSafeControlPlaneEvidence,
  observeSafeControlPlane,
} from './safe-control-plane';
import type { SafeControlPlaneEvidence } from './safe-control-plane';

type RequestedPhase = 'deploy' | 'schedule' | 'execute' | 'fund-genesis' | 'settle-genesis';

interface AuthorizedInputReceipt {
  authorizationId: `0x${string}`;
  authorizationPayloadHash: `0x${string}`;
  broadcaster: string | null;
  deploymentConfigHash: `0x${string}`;
  deploymentConfigSnapshotPath: string;
  emergencyGuardianSafe: {
    currentObservation: import('./safe-control-plane').SafeControlPlaneEvidence;
    evidence: import('./safe-control-plane').SafeControlPlaneEvidence;
    evidenceHash: `0x${string}`;
    evidenceSnapshotPath: string;
  } | null;
  expiresAt: string | null;
  nonceWindow: { start: string; transactionCount: number } | null;
  phase: RequestedPhase;
  priorStateSnapshotPath: string | null;
  protocolAdminSafe: {
    currentObservation: import('./safe-control-plane').SafeControlPlaneEvidence;
    evidence: import('./safe-control-plane').SafeControlPlaneEvidence;
    evidenceHash: `0x${string}`;
    evidenceSnapshotPath: string;
  } | null;
  priorStateHash: `0x${string}`;
  reviewedAssetCandidate: {
    path: string;
    rawSha256: string;
    snapshotPath: string;
    sourceBlockNumber: string;
  } | null;
  safeSchedule: {
    blockHash: `0x${string}`;
    blockNumber: string;
    blockTimestamp: string;
    format: 'safe-transaction-builder';
    controlPlaneEvidenceHash: `0x${string}`;
    controlPlaneEvidenceSnapshotPath: string;
    safeAddress: string;
    safeNonce: string;
  } | null;
}

const execFile = promisify(execFileCallback);
const LOCAL_REHEARSAL_HASH = `0x${'00'.repeat(32)}` as const;
const SIGNER_SECRET_ENVIRONMENT = [
  'DEPLOYER_PRIVATE_KEY',
  'GENESIS_LIQUIDITY_BACKER_KEY',
  'GENESIS_SETTLEMENT_EXECUTOR_KEY',
  'LOCAL_TIMELOCK_PROPOSER_KEY',
  'MNEMONIC',
  'PRIVATE_KEY',
  'PROTOCOL_TIMELOCK_PROPOSER_KEY',
  'TIMELOCK_EXECUTOR_KEY',
] as const;

function requestedPhase(): RequestedPhase {
  const phase = process.env.DEPLOYMENT_PHASE ?? 'deploy';
  if (
    phase !== 'deploy' &&
    phase !== 'schedule' &&
    phase !== 'execute' &&
    phase !== 'fund-genesis' &&
    phase !== 'settle-genesis'
  ) {
    throw new Error(`unsupported DEPLOYMENT_PHASE=${phase}`);
  }
  return phase;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function requiredEnvironmentPath(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return path.resolve(value);
}

async function requiredExternalAbsentOutputPath(name: string): Promise<string> {
  const requested = requiredEnvironmentPath(name);
  const repositoryRoot = await realpath(path.resolve(__dirname, '../../../..'));
  const outputParent = await realpath(path.dirname(requested));
  const resolved = path.join(outputParent, path.basename(requested));
  const relative = path.relative(repositoryRoot, resolved);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error(`${name} must be outside the git worktree`);
  }
  if (await fileExists(resolved)) throw new Error(`${name} already exists: ${resolved}`);
  return resolved;
}

function parseReceiptSafeEvidence(value: unknown, label: string): SafeControlPlaneEvidence {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  const evidence = value as Record<string, unknown>;
  const expectedEvidenceKeys = [
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
  ];
  if (Object.keys(evidence).sort().join('\0') !== expectedEvidenceKeys.sort().join('\0')) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
  const block = evidence.block;
  const network = evidence.network;
  if (
    evidence.kind !== 'gumball-6900-safe-control-plane-evidence' ||
    evidence.protocol !== 'GUM BALL 6900' ||
    evidence.schemaVersion !== 1 ||
    typeof evidence.safeAddress !== 'string' ||
    !hre.ethers.isAddress(evidence.safeAddress) ||
    typeof evidence.singletonAddress !== 'string' ||
    !hre.ethers.isAddress(evidence.singletonAddress) ||
    typeof evidence.guard !== 'string' ||
    !hre.ethers.isAddress(evidence.guard) ||
    typeof evidence.fallbackHandler !== 'string' ||
    !hre.ethers.isAddress(evidence.fallbackHandler) ||
    typeof evidence.proxyRuntimeBytecodeHash !== 'string' ||
    !/^0x[0-9a-f]{64}$/.test(evidence.proxyRuntimeBytecodeHash) ||
    typeof evidence.singletonRuntimeBytecodeHash !== 'string' ||
    !/^0x[0-9a-f]{64}$/.test(evidence.singletonRuntimeBytecodeHash) ||
    typeof evidence.threshold !== 'string' ||
    !/^[1-9][0-9]*$/.test(evidence.threshold) ||
    typeof evidence.nonce !== 'string' ||
    !/^(0|[1-9][0-9]*)$/.test(evidence.nonce) ||
    !Array.isArray(evidence.owners) ||
    evidence.owners.length === 0 ||
    !evidence.owners.every((owner) => typeof owner === 'string' && hre.ethers.isAddress(owner)) ||
    !Array.isArray(evidence.enabledModules) ||
    !evidence.enabledModules.every((module) => typeof module === 'string' && hre.ethers.isAddress(module)) ||
    block === null ||
    typeof block !== 'object' ||
    Array.isArray(block) ||
    network === null ||
    typeof network !== 'object' ||
    Array.isArray(network)
  ) {
    throw new Error(`${label} is invalid`);
  }
  const blockRecord = block as Record<string, unknown>;
  const networkRecord = network as Record<string, unknown>;
  if (
    Object.keys(blockRecord).sort().join('\0') !== ['hash', 'number', 'timestamp'].join('\0') ||
    Object.keys(networkRecord).sort().join('\0') !== ['chainId', 'name'].join('\0') ||
    typeof blockRecord.hash !== 'string' ||
    !/^0x[0-9a-f]{64}$/.test(blockRecord.hash) ||
    typeof blockRecord.number !== 'string' ||
    !/^(0|[1-9][0-9]*)$/.test(blockRecord.number) ||
    typeof blockRecord.timestamp !== 'string' ||
    !/^(0|[1-9][0-9]*)$/.test(blockRecord.timestamp) ||
    (networkRecord.chainId !== 4663 && networkRecord.chainId !== 46630) ||
    (networkRecord.name !== 'Robinhood Chain' && networkRecord.name !== 'Robinhood Chain Testnet')
  ) {
    throw new Error(`${label} block or network is invalid`);
  }
  assertConservativeSafeControlPlaneIdentity(value as SafeControlPlaneEvidence, label);
  return value as SafeControlPlaneEvidence;
}

function parseAuthorizedInputReceipt(value: string, phase: RequestedPhase): AuthorizedInputReceipt {
  const parsed = JSON.parse(value) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('deployment authorization preflight returned an invalid receipt');
  }
  const receipt = parsed as Record<string, unknown>;
  if (receipt.phase !== phase) throw new Error('deployment authorization receipt phase mismatch');
  for (const hashField of ['authorizationId', 'authorizationPayloadHash', 'deploymentConfigHash', 'priorStateHash']) {
    if (typeof receipt[hashField] !== 'string' || !/^0x[0-9a-f]{64}$/.test(receipt[hashField])) {
      throw new Error(`deployment authorization receipt has an invalid ${hashField}`);
    }
  }
  if (
    typeof receipt.deploymentConfigSnapshotPath !== 'string' ||
    !path.isAbsolute(receipt.deploymentConfigSnapshotPath)
  ) {
    throw new Error('deployment authorization receipt lacks an absolute config snapshot');
  }
  if (
    receipt.priorStateSnapshotPath !== null &&
    (typeof receipt.priorStateSnapshotPath !== 'string' || !path.isAbsolute(receipt.priorStateSnapshotPath))
  ) {
    throw new Error('deployment authorization receipt has an invalid state snapshot');
  }
  if (phase === 'deploy' && receipt.priorStateSnapshotPath !== null) {
    throw new Error('deploy authorization unexpectedly includes prior state');
  }
  if (phase !== 'deploy' && receipt.priorStateSnapshotPath === null) {
    throw new Error(`${phase} authorization lacks prior state`);
  }
  if (receipt.reviewedAssetCandidate !== null) {
    if (
      typeof receipt.reviewedAssetCandidate !== 'object' ||
      Array.isArray(receipt.reviewedAssetCandidate) ||
      typeof (receipt.reviewedAssetCandidate as Record<string, unknown>).path !== 'string' ||
      typeof (receipt.reviewedAssetCandidate as Record<string, unknown>).rawSha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(String((receipt.reviewedAssetCandidate as Record<string, unknown>).rawSha256)) ||
      typeof (receipt.reviewedAssetCandidate as Record<string, unknown>).snapshotPath !== 'string' ||
      !path.isAbsolute(String((receipt.reviewedAssetCandidate as Record<string, unknown>).snapshotPath)) ||
      typeof (receipt.reviewedAssetCandidate as Record<string, unknown>).sourceBlockNumber !== 'string' ||
      !/^[1-9][0-9]*$/.test(String((receipt.reviewedAssetCandidate as Record<string, unknown>).sourceBlockNumber))
    ) {
      throw new Error('deployment authorization receipt has invalid reviewed asset-candidate evidence');
    }
  }
  if (typeof receipt.broadcaster !== 'string' || !hre.ethers.isAddress(receipt.broadcaster)) {
    throw new Error('deployment authorization receipt has an invalid broadcaster');
  }
  if (typeof receipt.expiresAt !== 'string' || !Number.isFinite(Date.parse(receipt.expiresAt))) {
    throw new Error('deployment authorization receipt has an invalid expiry');
  }
  if (receipt.nonceWindow === null || typeof receipt.nonceWindow !== 'object' || Array.isArray(receipt.nonceWindow)) {
    throw new Error('deployment authorization receipt lacks a nonce window');
  }
  const nonceWindow = receipt.nonceWindow as Record<string, unknown>;
  if (
    typeof nonceWindow.start !== 'string' ||
    !/^(0|[1-9][0-9]*)$/.test(nonceWindow.start) ||
    typeof nonceWindow.transactionCount !== 'number' ||
    !Number.isSafeInteger(nonceWindow.transactionCount) ||
    nonceWindow.transactionCount <= 0
  ) {
    throw new Error('deployment authorization receipt has an invalid nonce window');
  }
  if (
    receipt.protocolAdminSafe === null ||
    typeof receipt.protocolAdminSafe !== 'object' ||
    Array.isArray(receipt.protocolAdminSafe)
  ) {
    throw new Error('deployment authorization receipt lacks protocol-admin Safe evidence');
  }
  const protocolAdminSafe = receipt.protocolAdminSafe as Record<string, unknown>;
  if (
    typeof protocolAdminSafe.evidenceHash !== 'string' ||
    !/^0x[0-9a-f]{64}$/.test(protocolAdminSafe.evidenceHash) ||
    typeof protocolAdminSafe.evidenceSnapshotPath !== 'string' ||
    !path.isAbsolute(protocolAdminSafe.evidenceSnapshotPath)
  ) {
    throw new Error('deployment authorization receipt has invalid protocol-admin Safe evidence binding');
  }
  const safeEvidence = parseReceiptSafeEvidence(protocolAdminSafe.evidence, 'Signed protocol-admin Safe evidence');
  const currentSafeObservation = parseReceiptSafeEvidence(
    protocolAdminSafe.currentObservation,
    'Current protocol-admin Safe observation',
  );
  assertSafeControlPlaneEvidence(currentSafeObservation, safeEvidence, { includeBlock: false });
  if (
    receipt.emergencyGuardianSafe === null ||
    typeof receipt.emergencyGuardianSafe !== 'object' ||
    Array.isArray(receipt.emergencyGuardianSafe)
  ) {
    throw new Error('deployment authorization receipt lacks emergency-guardian Safe evidence');
  }
  const emergencyGuardianSafe = receipt.emergencyGuardianSafe as Record<string, unknown>;
  if (
    typeof emergencyGuardianSafe.evidenceHash !== 'string' ||
    !/^0x[0-9a-f]{64}$/.test(emergencyGuardianSafe.evidenceHash) ||
    typeof emergencyGuardianSafe.evidenceSnapshotPath !== 'string' ||
    !path.isAbsolute(emergencyGuardianSafe.evidenceSnapshotPath)
  ) {
    throw new Error('deployment authorization receipt has invalid emergency-guardian Safe evidence binding');
  }
  const guardianSafeEvidence = parseReceiptSafeEvidence(
    emergencyGuardianSafe.evidence,
    'Signed emergency-guardian Safe evidence',
  );
  const currentGuardianSafeObservation = parseReceiptSafeEvidence(
    emergencyGuardianSafe.currentObservation,
    'Current emergency-guardian Safe observation',
  );
  assertSafeControlPlaneEvidence(currentGuardianSafeObservation, guardianSafeEvidence, { includeBlock: false });
  if (getAddress(guardianSafeEvidence.safeAddress) === getAddress(safeEvidence.safeAddress)) {
    throw new Error('deployment authorization receipt Safe roles are not distinct');
  }
  if (phase === 'schedule') {
    if (
      receipt.safeSchedule === null ||
      typeof receipt.safeSchedule !== 'object' ||
      Array.isArray(receipt.safeSchedule)
    ) {
      throw new Error('schedule authorization receipt lacks Safe proposal binding');
    }
    const safeSchedule = receipt.safeSchedule as Record<string, unknown>;
    if (
      safeSchedule.format !== 'safe-transaction-builder' ||
      typeof safeSchedule.safeAddress !== 'string' ||
      !hre.ethers.isAddress(safeSchedule.safeAddress) ||
      typeof safeSchedule.safeNonce !== 'string' ||
      !/^(0|[1-9][0-9]*)$/.test(safeSchedule.safeNonce) ||
      typeof safeSchedule.controlPlaneEvidenceHash !== 'string' ||
      !/^0x[0-9a-f]{64}$/.test(safeSchedule.controlPlaneEvidenceHash) ||
      typeof safeSchedule.controlPlaneEvidenceSnapshotPath !== 'string' ||
      !path.isAbsolute(safeSchedule.controlPlaneEvidenceSnapshotPath) ||
      typeof safeSchedule.blockHash !== 'string' ||
      !/^0x[0-9a-f]{64}$/.test(safeSchedule.blockHash) ||
      typeof safeSchedule.blockNumber !== 'string' ||
      !/^(0|[1-9][0-9]*)$/.test(safeSchedule.blockNumber) ||
      typeof safeSchedule.blockTimestamp !== 'string' ||
      !/^(0|[1-9][0-9]*)$/.test(safeSchedule.blockTimestamp)
    ) {
      throw new Error('schedule authorization receipt has invalid Safe proposal binding');
    }
    if (
      getAddress(safeSchedule.safeAddress as string) !== getAddress(receipt.broadcaster as string) ||
      getAddress(safeSchedule.safeAddress as string) !== getAddress(safeEvidence.safeAddress) ||
      safeSchedule.safeNonce !== nonceWindow.start ||
      safeSchedule.safeNonce !== safeEvidence.nonce ||
      safeSchedule.controlPlaneEvidenceHash !== protocolAdminSafe.evidenceHash ||
      nonceWindow.transactionCount !== 1
    ) {
      throw new Error('schedule authorization receipt Safe, nonce, or transaction count is inconsistent');
    }
  } else if (receipt.safeSchedule !== null) {
    throw new Error('nonschedule authorization receipt unexpectedly contains Safe proposal binding');
  }
  return receipt as unknown as AuthorizedInputReceipt;
}

async function authorizationBroadcaster(authorizationPath: string): Promise<string> {
  const value = JSON.parse(await readFile(authorizationPath, 'utf8')) as unknown;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('deployment authorization must be a JSON object');
  }
  const broadcaster = (value as Record<string, unknown>).broadcaster;
  if (typeof broadcaster !== 'string' || !hre.ethers.isAddress(broadcaster)) {
    throw new Error('deployment authorization broadcaster is invalid');
  }
  return hre.ethers.getAddress(broadcaster);
}

interface SafeScheduleObservation {
  readonly arguments: string[];
  readonly currentNonce: string;
}

function evidenceField(object: Record<string, unknown>, key: string): string {
  const value = object[key];
  if (typeof value !== 'string') throw new Error(`Safe control-plane evidence ${key} is invalid`);
  return value;
}

async function observeBoundSafe(
  evidencePath: string,
  expectedSafeAddress: string,
  label: string,
  historicalFlag: string,
  currentFlag: string,
  evidenceFlag: string,
): Promise<SafeScheduleObservation> {
  const evidenceValue = JSON.parse(await readFile(evidencePath, 'utf8')) as unknown;
  if (evidenceValue === null || typeof evidenceValue !== 'object' || Array.isArray(evidenceValue)) {
    throw new Error(`${label} evidence must be a JSON object`);
  }
  const evidence = evidenceValue as Record<string, unknown>;
  const blockValue = evidence.block;
  if (blockValue === null || typeof blockValue !== 'object' || Array.isArray(blockValue)) {
    throw new Error(`${label} evidence block is invalid`);
  }
  const blockEvidence = blockValue as Record<string, unknown>;
  const safeAddress = evidenceField(evidence, 'safeAddress');
  if (!hre.ethers.isAddress(safeAddress) || getAddress(safeAddress) !== getAddress(expectedSafeAddress)) {
    throw new Error(`${label} evidence address does not match its onchain role`);
  }
  const evidenceBlockNumber = evidenceField(blockEvidence, 'number');
  const evidenceBlockHash = evidenceField(blockEvidence, 'hash');
  if (!/^(0|[1-9][0-9]*)$/.test(evidenceBlockNumber) || !/^0x[0-9a-f]{64}$/.test(evidenceBlockHash)) {
    throw new Error(`${label} evidence block identity is invalid`);
  }
  const numericBlockNumber = Number(evidenceBlockNumber);
  if (!Number.isSafeInteger(numericBlockNumber)) throw new Error(`${label} evidence block number is out of range`);
  const historicalObservation = await observeSafeControlPlane(
    hre.ethers.provider,
    expectedSafeAddress,
    numericBlockNumber,
  );
  if (historicalObservation.block.hash !== evidenceBlockHash) throw new Error(`${label} evidence block hash changed`);
  const currentObservation = await observeSafeControlPlane(hre.ethers.provider, expectedSafeAddress);
  return {
    arguments: [
      evidenceFlag,
      evidencePath,
      historicalFlag,
      JSON.stringify(historicalObservation),
      currentFlag,
      JSON.stringify(currentObservation),
    ],
    currentNonce: currentObservation.nonce,
  };
}

async function observeSafeSchedule(broadcaster: string, statePath: string): Promise<SafeScheduleObservation> {
  const protocolAdminEvidencePath = requiredEnvironmentPath('DEPLOYMENT_PROTOCOL_ADMIN_SAFE_EVIDENCE_PATH');
  const guardianEvidencePath = requiredEnvironmentPath('DEPLOYMENT_EMERGENCY_GUARDIAN_SAFE_EVIDENCE_PATH');
  const stateValue = JSON.parse(await readFile(statePath, 'utf8')) as unknown;
  if (stateValue === null || typeof stateValue !== 'object' || Array.isArray(stateValue)) {
    throw new Error('deployment state must be a JSON object');
  }
  const addresses = (stateValue as Record<string, unknown>).addresses;
  if (addresses === null || typeof addresses !== 'object' || Array.isArray(addresses)) {
    throw new Error('deployment state addresses are invalid');
  }
  const timelockAddress = (addresses as Record<string, unknown>).protocolTimelock;
  const guardianAddress = (addresses as Record<string, unknown>).emergencyGuardian;
  if (
    typeof timelockAddress !== 'string' ||
    !hre.ethers.isAddress(timelockAddress) ||
    typeof guardianAddress !== 'string' ||
    !hre.ethers.isAddress(guardianAddress)
  ) {
    throw new Error('deployment state control-plane addresses are invalid');
  }
  const timelock = new Contract(
    timelockAddress,
    ['function PROPOSER_MULTISIG() view returns (address)'],
    hre.ethers.provider,
  );
  const proposer = getAddress((await timelock.getFunction('PROPOSER_MULTISIG')()) as string);
  if (proposer !== getAddress(broadcaster)) throw new Error(`ProtocolTimelock proposer is ${proposer}, not the Safe`);
  const guardian = new Contract(guardianAddress, ['function operator() view returns (address)'], hre.ethers.provider);
  const guardianOperator = getAddress((await guardian.getFunction('operator')()) as string);
  if (guardianOperator === proposer)
    throw new Error('Protocol-admin and emergency-guardian Safe roles are not distinct');
  const protocolAdminObservation = await observeBoundSafe(
    protocolAdminEvidencePath,
    proposer,
    'Protocol-admin Safe',
    '--observed-historical-protocol-admin-safe-json',
    '--observed-current-protocol-admin-safe-json',
    '--protocol-admin-safe-evidence',
  );
  const guardianObservation = await observeBoundSafe(
    guardianEvidencePath,
    guardianOperator,
    'Emergency-guardian Safe',
    '--observed-historical-emergency-guardian-safe-json',
    '--observed-current-emergency-guardian-safe-json',
    '--emergency-guardian-safe-evidence',
  );
  return {
    arguments: [...protocolAdminObservation.arguments, ...guardianObservation.arguments],
    currentNonce: protocolAdminObservation.currentNonce,
  };
}

async function authorizedInputs(
  phase: RequestedPhase,
  chainId: bigint,
  configPath: string,
  statePath: string,
): Promise<AuthorizedInputReceipt> {
  const mode = process.env.DEPLOYMENT_EXECUTION_MODE;
  if (chainId === 31_337n) {
    if (mode !== 'rehearsal') {
      throw new Error('local deployment requires explicit DEPLOYMENT_EXECUTION_MODE=rehearsal');
    }
    return {
      authorizationId: LOCAL_REHEARSAL_HASH,
      authorizationPayloadHash: LOCAL_REHEARSAL_HASH,
      broadcaster: null,
      deploymentConfigHash: LOCAL_REHEARSAL_HASH,
      deploymentConfigSnapshotPath: configPath,
      expiresAt: null,
      nonceWindow: null,
      phase,
      priorStateHash: LOCAL_REHEARSAL_HASH,
      priorStateSnapshotPath: phase === 'deploy' ? null : statePath,
      emergencyGuardianSafe: null,
      protocolAdminSafe: null,
      reviewedAssetCandidate: null,
      safeSchedule: null,
    };
  }
  if (phase !== 'schedule') {
    throw new Error(
      `in-repository ${phase} broadcast is disabled: use a separately reviewed isolated production signer runner`,
    );
  }
  if (mode !== 'authorized-keyless-proposal') {
    throw new Error('nonlocal schedule requires DEPLOYMENT_EXECUTION_MODE=authorized-keyless-proposal');
  }
  const authorizationPath = requiredEnvironmentPath('DEPLOYMENT_AUTHORIZATION_PATH');
  const ledgerPath = requiredEnvironmentPath('DEPLOYMENT_AUTHORIZATION_LEDGER_PATH');
  const broadcaster = await authorizationBroadcaster(authorizationPath);
  const safeObservation = phase === 'schedule' ? await observeSafeSchedule(broadcaster, statePath) : null;
  const pendingNonce =
    safeObservation === null
      ? (await hre.ethers.provider.getTransactionCount(broadcaster, 'pending')).toString()
      : safeObservation.currentNonce;
  const preflightScript = path.resolve(__dirname, '../../../config/scripts/preflight-deployment-authorization.ts');
  const tsxBinary = path.resolve(__dirname, '../../../../node_modules/.bin/tsx');
  const { stdout } = await execFile(
    tsxBinary,
    [
      preflightScript,
      '--authorization',
      authorizationPath,
      '--command-family',
      'hardhat',
      '--config',
      configPath,
      '--ledger',
      ledgerPath,
      '--observed-chain-id',
      chainId.toString(),
      '--observed-broadcaster',
      broadcaster,
      '--observed-pending-nonce',
      pendingNonce,
      '--phase',
      phase,
      '--state',
      statePath,
      ...(safeObservation?.arguments ?? []),
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  return parseAuthorizedInputReceipt(stdout, phase);
}

async function selectLocalSigner(signers: readonly Signer[], requiredAddress?: string): Promise<Signer> {
  if (requiredAddress === undefined) {
    const signer = signers[0];
    if (signer === undefined) throw new Error('local rehearsal exposes no unlocked signer');
    return signer;
  }
  const expected = getAddress(requiredAddress);
  for (const signer of signers) {
    if (getAddress(await signer.getAddress()) === expected) return signer;
  }
  throw new Error(`local rehearsal does not expose required unlocked signer ${expected}`);
}

async function main(): Promise<void> {
  const phase = requestedPhase();
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 31_337n) {
    const inheritedSecrets = SIGNER_SECRET_ENVIRONMENT.filter((name) => {
      const value = process.env[name];
      return value !== undefined && value.length > 0;
    });
    if (inheritedSecrets.length > 0) {
      throw new Error(`nonlocal keyless entrypoint refuses signer-secret variables: ${inheritedSecrets.join(', ')}`);
    }
    if (phase !== 'schedule') {
      throw new Error(
        `in-repository ${phase} broadcast is disabled: production execution requires an isolated signer runner`,
      );
    }
  }
  const configPathValue = process.env.DEPLOYMENT_CONFIG_PATH;
  if (configPathValue === undefined || configPathValue.length === 0) {
    throw new Error('DEPLOYMENT_CONFIG_PATH is required');
  }
  const configPath = path.resolve(configPathValue);
  const statePath = path.resolve(
    process.env.DEPLOYMENT_STATE_PATH ?? `deployments/${hre.network.name}-${network.chainId}.json`,
  );
  const authorized = await authorizedInputs(phase, network.chainId, configPath, statePath);
  const config = await readDeploymentConfig(authorized.deploymentConfigSnapshotPath, network.chainId);
  if (config.assetReview === null) {
    if (authorized.reviewedAssetCandidate !== null) {
      throw new Error('deployment authorization unexpectedly includes reviewed mainnet asset evidence');
    }
  } else if (
    authorized.reviewedAssetCandidate === null ||
    authorized.reviewedAssetCandidate.path !== config.assetReview.path ||
    authorized.reviewedAssetCandidate.rawSha256 !== config.assetReview.rawSha256
  ) {
    throw new Error('deployment authorization does not bind the configured reviewed asset candidate');
  }
  const rehearsalSigners = network.chainId === 31_337n ? await hre.ethers.getSigners() : [];

  if (phase === 'deploy') {
    if (await fileExists(statePath)) {
      throw new Error(`refusing to overwrite deployment manifest ${statePath}`);
    }
    const signer = await selectLocalSigner(rehearsalSigners);
    const state = await deployPhaseOne(hre, config, signer);
    await writeDeploymentState(statePath, state);
    console.log(`phase one complete: ${state.addresses.gbx}`);
    console.log(`deployment manifest: ${statePath}`);
    return;
  }

  const state = await readDeploymentState(authorized.priorStateSnapshotPath!);
  if (phase === 'schedule') {
    if (network.chainId === 31_337n) {
      const signer = await selectLocalSigner(rehearsalSigners, config.roles.protocolTimelockMultisig);
      await scheduleRegistryPhaseLocalEOA(hre.ethers.provider, signer, config, state, statePath);
    } else {
      if (authorized.safeSchedule === null) throw new Error('schedule authorization lacks Safe proposal binding');
      if (authorized.protocolAdminSafe === null) {
        throw new Error('schedule authorization lacks protocol-admin Safe control-plane evidence');
      }
      if (authorized.emergencyGuardianSafe === null) {
        throw new Error('schedule authorization lacks emergency-guardian Safe control-plane evidence');
      }
      const bundlePath = await requiredExternalAbsentOutputPath('DEPLOYMENT_SAFE_BUNDLE_PATH');
      const bundle = await prepareSafeScheduleBundle(hre.ethers.provider, config, state, statePath, bundlePath, {
        authorizationId: authorized.authorizationId,
        authorizationPayloadHash: authorized.authorizationPayloadHash,
        deploymentConfigHash: authorized.deploymentConfigHash,
        emergencyGuardianSafe: {
          evidence: authorized.emergencyGuardianSafe.evidence,
          evidenceHash: authorized.emergencyGuardianSafe.evidenceHash,
        },
        priorStateHash: authorized.priorStateHash,
        protocolAdminSafe: {
          evidence: authorized.protocolAdminSafe.evidence,
          evidenceHash: authorized.protocolAdminSafe.evidenceHash,
        },
        safeSchedule: authorized.safeSchedule,
      });
      console.log(`Safe schedule bundle: ${bundlePath}`);
      console.log(`Safe schedule status: ${bundle.meta.gumball6900.status}`);
      console.log('No Safe proposal was signed, submitted, or broadcast');
      return;
    }
  } else if (phase === 'execute') {
    const signer = await selectLocalSigner(rehearsalSigners);
    await executeRegistryPhase(hre.ethers.provider, signer, config, state, statePath);
  } else if (phase === 'fund-genesis') {
    const signer = await selectLocalSigner(rehearsalSigners, config.roles.genesisLiquidityBacker);
    await fundGenesisPhase(hre.ethers.provider, signer, config, state, statePath);
  } else {
    const signer = await selectLocalSigner(rehearsalSigners);
    await settleGenesisPhase(hre.ethers.provider, signer, config, state, statePath);
  }
  console.log(`${phase} complete; manifest phase=${state.phase}`);
  console.log(`deployment manifest: ${statePath}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
