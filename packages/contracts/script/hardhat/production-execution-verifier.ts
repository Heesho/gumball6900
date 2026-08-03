import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, open, readFile } from 'node:fs/promises';
import path from 'node:path';

import { JsonRpcProvider } from 'ethers';

import {
  deploymentAuthorizationSigningPayloadHash,
  parseDeploymentAuthorizationPolicy,
  validateDeploymentAuthorization,
} from '../../../config/schemas/deployment-authorization.js';
import {
  assertApprovedSafeControlPlane,
  parseSafeControlPlanePolicy,
} from '../../../config/schemas/safe-control-plane-policy.js';
import {
  assertStateMatches,
  validateDeploymentConfig,
  type DeploymentConfig,
  type DeploymentState,
} from './deployment';
import {
  assertProductionExecutionBindings,
  assertLoopbackRootRpcUrl,
  canonicalJson,
  parseProductionExecutionArtifact,
  sha256,
  validateProductionExecutionAuthorization,
  type ProductionExecutionArtifact,
} from './production-execution-format';
import { recordProductionExecutionFailure, reserveProductionExecution } from './production-execution-ledger';
import {
  assertSafeControlPlaneEvidence,
  assertSafeControlPlaneIdentity,
  observeSafeControlPlane,
  type SafeControlPlaneEvidence,
} from './safe-control-plane';

declare const __GUMBALL_TRUSTED_POLICY_SHA256__: string;
declare const __GUMBALL_SAFE_CONTROL_PLANE_POLICY_SHA256__: string;
declare const __GUMBALL_REPOSITORY_COMMIT__: string;
const EMBEDDED_TRUSTED_POLICY_SHA256 = __GUMBALL_TRUSTED_POLICY_SHA256__;
const EMBEDDED_SAFE_CONTROL_PLANE_POLICY_SHA256 = __GUMBALL_SAFE_CONTROL_PLANE_POLICY_SHA256__;
const EMBEDDED_REPOSITORY_COMMIT = __GUMBALL_REPOSITORY_COMMIT__;

interface Arguments {
  artifact: string;
  config: string;
  deploymentAuthorization: string;
  evidence: string;
  executionAuthorization: string;
  keyFile: string;
  ledger: string;
  lockfile: string;
  outputState: string;
  rpcUrl: string;
  runner: string;
  runnerSource: string;
  safeControlPolicy: string;
  state: string;
  trustedPolicy: string;
  verifier: string;
  verifierSource: string;
}

function parseArguments(argv: readonly string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === undefined || !option.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error('production verifier accepts only --name value pairs');
    }
    const name = option.slice(2);
    if (values.has(name)) throw new Error(`duplicate production verifier option --${name}`);
    values.set(name, value);
  }
  const names = [
    'artifact',
    'config',
    'deployment-authorization',
    'evidence',
    'execution-authorization',
    'key-file',
    'ledger',
    'lockfile',
    'output-state',
    'rpc-url',
    'runner',
    'runner-source',
    'safe-control-policy',
    'state',
    'trusted-policy',
    'verifier',
    'verifier-source',
  ] as const;
  const known = new Set<string>(names);
  for (const name of values.keys())
    if (!known.has(name)) throw new Error(`unknown production verifier option --${name}`);
  const required = (name: (typeof names)[number]): string => {
    const value = values.get(name);
    if (value === undefined || value.length === 0) throw new Error(`missing production verifier option --${name}`);
    return value;
  };
  const result: Arguments = {
    artifact: required('artifact'),
    config: required('config'),
    deploymentAuthorization: required('deployment-authorization'),
    evidence: required('evidence'),
    executionAuthorization: required('execution-authorization'),
    keyFile: required('key-file'),
    ledger: required('ledger'),
    lockfile: required('lockfile'),
    outputState: required('output-state'),
    rpcUrl: required('rpc-url'),
    runner: required('runner'),
    runnerSource: required('runner-source'),
    safeControlPolicy: required('safe-control-policy'),
    state: required('state'),
    trustedPolicy: required('trusted-policy'),
    verifier: required('verifier'),
    verifierSource: required('verifier-source'),
  };
  for (const [name, value] of Object.entries(result)) {
    if (name !== 'rpcUrl' && !path.isAbsolute(value)) throw new Error(`production verifier --${name} must be absolute`);
  }
  const exclusive = [
    result.artifact,
    result.evidence,
    result.keyFile,
    result.outputState,
    result.runner,
    result.verifier,
  ];
  if (new Set(exclusive).size !== exclusive.length) {
    throw new Error('production artifact, bundles, key, state, and evidence paths must be distinct');
  }
  assertLoopbackRootRpcUrl(result.rpcUrl, 'key-bearing production RPC');
  return result;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function verifyBuildInputs(arguments_: Arguments, artifact: ProductionExecutionArtifact): Promise<Uint8Array> {
  if (path.resolve(process.argv[1] ?? '') !== path.resolve(arguments_.verifier)) {
    throw new Error('--verifier must identify the executing production verifier');
  }
  const [verifierBytes, runnerBytes, verifierSource, runnerSource, lockfile, policyBytes, safePolicyBytes] =
    await Promise.all([
      readFile(arguments_.verifier),
      readFile(arguments_.runner),
      readFile(arguments_.verifierSource),
      readFile(arguments_.runnerSource),
      readFile(arguments_.lockfile),
      readFile(arguments_.trustedPolicy),
      readFile(arguments_.safeControlPolicy),
    ]);
  if (artifact.build.repositoryCommit !== EMBEDDED_REPOSITORY_COMMIT) {
    throw new Error('production repository commit does not match the measured verifier trust root');
  }
  if (
    verifierBytes.byteLength !== artifact.build.verifier.byteLength ||
    sha256(verifierBytes) !== artifact.build.verifier.sha256
  ) {
    throw new Error('production verifier bytes do not match the signed build binding');
  }
  if (
    sha256(safePolicyBytes) !== artifact.build.safeControlPlanePolicySha256 ||
    artifact.build.safeControlPlanePolicySha256 !== EMBEDDED_SAFE_CONTROL_PLANE_POLICY_SHA256
  ) {
    throw new Error('production Safe-control policy bytes do not match the measured verifier trust root');
  }
  if (
    runnerBytes.byteLength !== artifact.build.runner.byteLength ||
    sha256(runnerBytes) !== artifact.build.runner.sha256
  ) {
    throw new Error('production runner bytes do not match the signed build binding');
  }
  if (
    sha256(verifierSource) !== artifact.build.verifier.entrypointSha256 ||
    sha256(runnerSource) !== artifact.build.runner.entrypointSha256 ||
    sha256(lockfile) !== artifact.build.lockfileSha256
  ) {
    throw new Error('production source or lockfile does not match the signed build binding');
  }
  if (
    sha256(policyBytes) !== artifact.build.trustedPolicySha256 ||
    artifact.build.trustedPolicySha256 !== EMBEDDED_TRUSTED_POLICY_SHA256
  ) {
    throw new Error('production trusted-policy bytes do not match the measured verifier trust root');
  }
  return runnerBytes;
}

function assertExpectedStatePhase(artifact: ProductionExecutionArtifact): void {
  const phase = artifact.resultStateTemplate.phase;
  const expected = {
    deploy: 'DEPLOYED_AND_WIRED',
    execute: 'REGISTRY_CONFIGURED',
    'fund-genesis': 'GENESIS_OPENED',
    'settle-genesis': 'GENESIS_SETTLED',
  }[artifact.phase];
  if (phase !== expected)
    throw new Error(`production state template phase ${String(phase)} does not match ${expected}`);
}

async function verifyAuthorizationsAndInputs(arguments_: Arguments, artifact: ProductionExecutionArtifact) {
  const trustedPolicy = parseDeploymentAuthorizationPolicy(await readJson(arguments_.trustedPolicy));
  const deployment = await validateDeploymentAuthorization(await readJson(arguments_.deploymentAuthorization));
  const policy = {
    authorizedSigners: trustedPolicy.authorizedSigners,
    policyId: trustedPolicy.policyId as `0x${string}`,
    threshold: trustedPolicy.threshold,
  };
  if (canonicalJson(deployment.signaturePolicy) !== canonicalJson(policy)) {
    throw new Error('deployment authorization policy does not match the trusted committed policy');
  }
  const execution = await validateProductionExecutionAuthorization(
    await readJson(arguments_.executionAuthorization),
    policy,
  );
  const deploymentPayloadHash = deploymentAuthorizationSigningPayloadHash(deployment);
  assertProductionExecutionBindings(artifact, execution, deployment, deploymentPayloadHash);
  const now = Date.now();
  if (
    now < Date.parse(deployment.issuedAt) ||
    now >= Date.parse(deployment.expiresAt) ||
    now < Date.parse(execution.issuedAt) ||
    now >= Date.parse(execution.expiresAt)
  ) {
    throw new Error('production deployment or execution authorization is inactive or expired');
  }

  const configValue = await readJson(arguments_.config);
  if (sha256(canonicalJson(configValue)) !== artifact.inputs.deploymentConfigHash) {
    throw new Error('production deployment-config substitution detected');
  }
  validateDeploymentConfig(configValue, BigInt(artifact.network.chainId));
  const config = configValue as DeploymentConfig;
  const safePolicy = parseSafeControlPlanePolicy(await readJson(arguments_.safeControlPolicy));
  if (config.protocolAdminSafe === null || config.emergencyGuardianSafe === null) {
    throw new Error('production config lacks both required Safe control planes');
  }
  assertApprovedSafeControlPlane(safePolicy, config.protocolAdminSafe, artifact.network, 'Protocol-admin');
  assertApprovedSafeControlPlane(safePolicy, config.emergencyGuardianSafe, artifact.network, 'Emergency-guardian');
  assertSafeControlPlaneIdentity(deployment.protocolAdminSafe, config.protocolAdminSafe, 'Signed protocol-admin Safe');
  assertSafeControlPlaneIdentity(
    deployment.emergencyGuardianSafe,
    config.emergencyGuardianSafe,
    'Signed emergency-guardian Safe',
  );
  if (artifact.inputs.priorState.kind === 'absent') {
    if (await exists(arguments_.state)) throw new Error('deploy predecessor state path must remain absent');
  } else {
    const stateValue = await readJson(arguments_.state);
    if (sha256(canonicalJson(stateValue)) !== artifact.inputs.priorState.hash) {
      throw new Error('production predecessor-state substitution detected');
    }
    const state = stateValue as DeploymentState;
    assertStateMatches(config, state, BigInt(artifact.network.chainId));
    if (artifact.phase === 'deploy') throw new Error('deploy cannot consume a predecessor-state snapshot');
    const permitted = {
      execute: ['TIMELOCK_OPERATIONS_SCHEDULED', 'TIMELOCK_EXECUTING'],
      'fund-genesis': ['REGISTRY_CONFIGURED'],
      'settle-genesis': ['GENESIS_OPENED'],
    }[artifact.phase];
    if (permitted === undefined || !permitted.includes(state.phase)) {
      throw new Error(`production predecessor phase ${state.phase} does not match ${artifact.phase}`);
    }
  }
  assertStateMatches(
    config,
    artifact.resultStateTemplate as unknown as DeploymentState,
    BigInt(artifact.network.chainId),
  );
  assertExpectedStatePhase(artifact);
  if (await exists(arguments_.evidence)) throw new Error('production evidence path already exists');
  if (await exists(arguments_.outputState)) throw new Error('production output-state path already exists');
  return { config, deployment, execution };
}

async function verifyChainAndNonce(
  arguments_: Arguments,
  artifact: ProductionExecutionArtifact,
  broadcaster: string,
  deployment: Awaited<ReturnType<typeof validateDeploymentAuthorization>>,
  config: DeploymentConfig,
): Promise<void> {
  const provider = new JsonRpcProvider(arguments_.rpcUrl, artifact.network.chainId, { staticNetwork: true });
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(artifact.network.chainId)) {
    throw new Error(`production verifier observed chain ${network.chainId}, expected ${artifact.network.chainId}`);
  }
  const anchorNumber = Number(artifact.simulation.forkAnchor.number);
  if (!Number.isSafeInteger(anchorNumber)) throw new Error('production anchor block number is outside verifier range');
  const [anchor, latest, nonce] = await Promise.all([
    provider.getBlock(anchorNumber),
    provider.getBlock('latest'),
    provider.getTransactionCount(broadcaster, 'pending'),
  ]);
  if (
    anchor === null ||
    anchor.hash === null ||
    anchor.hash.toLowerCase() !== artifact.simulation.forkAnchor.hash.toLowerCase()
  ) {
    throw new Error('production anchor hash changed or is unavailable');
  }
  if (latest === null || latest.number < anchorNumber || latest.number - anchorNumber > 64) {
    throw new Error('production anchor is not within the latest 64 blocks');
  }
  for (const [label, evidence] of [
    ['protocol-admin', deployment.protocolAdminSafe],
    ['emergency-guardian', deployment.emergencyGuardianSafe],
  ] as const) {
    if (
      evidence.block.number !== artifact.simulation.forkAnchor.number ||
      evidence.block.hash.toLowerCase() !== artifact.simulation.forkAnchor.hash.toLowerCase() ||
      evidence.block.timestamp !== artifact.simulation.forkAnchor.timestamp
    ) {
      throw new Error(`signed ${label} Safe evidence does not match the production anchor`);
    }
  }
  if (latest.hash === null) throw new Error('production latest block lacks a canonical hash');
  const [currentAdminSafe, currentGuardianSafe] = await Promise.all([
    observeSafeControlPlane(provider, config.protocolAdminSafe!.safeAddress, latest.number),
    observeSafeControlPlane(provider, config.emergencyGuardianSafe!.safeAddress, latest.number),
  ]);
  for (const [label, current, signed] of [
    ['Current protocol-admin Safe', currentAdminSafe, deployment.protocolAdminSafe],
    ['Current emergency-guardian Safe', currentGuardianSafe, deployment.emergencyGuardianSafe],
  ] as const) {
    if (
      current.block.number !== latest.number.toString() ||
      current.block.hash.toLowerCase() !== latest.hash.toLowerCase() ||
      current.block.timestamp !== latest.timestamp.toString()
    ) {
      throw new Error(`${label} observation is detached from the exact latest block`);
    }
    assertSafeControlPlaneEvidence(current, signed as unknown as SafeControlPlaneEvidence, {
      includeBlock: false,
      label,
    });
  }
  const nowSeconds = BigInt(Math.floor(Date.now() / 1_000));
  const anchorTimestamp = BigInt(artifact.simulation.forkAnchor.timestamp);
  if (anchorTimestamp > nowSeconds + 30n || nowSeconds - anchorTimestamp > 15n * 60n) {
    throw new Error('production anchor is not recent');
  }
  if (nonce.toString() !== artifact.plan.transactions[0]!.nonce) {
    throw new Error('production pending nonce does not match the exact signed window');
  }
}

async function openKeyAfterPublicVerification(filePath: string) {
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK);
  try {
    // Validate the already-open descriptor, closing the lstat/open replacement race.
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error('production key descriptor must identify a regular file');
    if ((stats.mode & 0o077) !== 0) throw new Error('production key file must not grant group or other access');
    if (process.getuid !== undefined && stats.uid !== process.getuid()) {
      throw new Error('production key file must be owned by the current operator');
    }
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function main(): Promise<void> {
  let reservationPath: string | undefined;
  try {
    const forbiddenEnvironment = [
      'DEPLOYER_PRIVATE_KEY',
      'GENESIS_LIQUIDITY_BACKER_KEY',
      'GENESIS_SETTLEMENT_EXECUTOR_KEY',
      'MNEMONIC',
      'NODE_OPTIONS',
      'NODE_PATH',
      'PRIVATE_KEY',
      'TIMELOCK_EXECUTOR_KEY',
    ].filter((name) => typeof process.env[name] === 'string' && process.env[name]!.length > 0);
    if (forbiddenEnvironment.length > 0) {
      throw new Error(`production verifier refuses secret or loader environment: ${forbiddenEnvironment.join(', ')}`);
    }
    const arguments_ = parseArguments(process.argv.slice(2));
    const artifact = parseProductionExecutionArtifact(await readJson(arguments_.artifact));
    const runnerBytes = await verifyBuildInputs(arguments_, artifact);
    const { config, deployment, execution } = await verifyAuthorizationsAndInputs(arguments_, artifact);
    await verifyChainAndNonce(arguments_, artifact, execution.broadcaster, deployment, config);

    // This atomic reservation happens before the key file is opened. It remains consumed on every later failure.
    reservationPath = await reserveProductionExecution(arguments_.ledger, artifact);
    const keyHandle = await openKeyAfterPublicVerification(arguments_.keyFile);
    try {
      const childArguments = [
        '--input-type=module',
        '-',
        '--artifact',
        arguments_.artifact,
        '--config',
        arguments_.config,
        '--evidence',
        arguments_.evidence,
        '--execution-authorization',
        arguments_.executionAuthorization,
        '--key-fd',
        '3',
        '--measured-runner-sha256',
        artifact.build.runner.sha256,
        '--measured-verifier-sha256',
        artifact.build.verifier.sha256,
        '--output-state',
        arguments_.outputState,
        '--reservation',
        reservationPath,
        '--rpc-url',
        arguments_.rpcUrl,
        '--state',
        arguments_.state,
      ];
      const environment: Record<string, string> = {};
      for (const name of ['FORCE_COLOR', 'HOME', 'LANG', 'LC_ALL', 'PATH', 'TMPDIR', 'USER']) {
        const value = process.env[name];
        if (value !== undefined) environment[name] = value;
      }
      const child = spawn(process.execPath, childArguments, {
        env: environment,
        stdio: ['pipe', 'inherit', 'inherit', keyHandle.fd],
      });
      const exitCode = await new Promise<number>((resolve, reject) => {
        child.once('error', reject);
        child.stdin?.once('error', reject);
        child.once('exit', (code, signal) => {
          if (signal !== null) reject(new Error(`production runner terminated by ${signal}`));
          else resolve(code ?? 1);
        });
        if (child.stdin === null) reject(new Error('production runner stdin pipe is unavailable'));
        else child.stdin.end(runnerBytes);
      });
      if (exitCode !== 0) throw new Error(`production runner failed with exit code ${exitCode}; retry is forbidden`);
    } finally {
      await keyHandle.close();
    }
  } catch (error) {
    if (reservationPath !== undefined)
      await recordProductionExecutionFailure(reservationPath, error).catch(() => undefined);
    throw error;
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Production execution verifier failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
