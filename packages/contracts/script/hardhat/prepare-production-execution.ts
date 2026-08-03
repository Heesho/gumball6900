import { access, lstat, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getAddress } from 'ethers';
import hre from 'hardhat';

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
  assertExactTrackedWorktreeAtHead,
  assertExpectedGitRepositoryRoot,
  readExactTrackedFileAtHead,
  sanitizedGitOutput,
} from '../../../config/tooling/tracked-git-file.js';
import {
  deployPhaseOne,
  executeRegistryPhase,
  fundGenesisPhase,
  readDeploymentConfig,
  readDeploymentState,
  settleGenesisPhase,
  writeDeploymentState,
  type DeploymentConfig,
  type DeploymentState,
} from './deployment';
import {
  assertProductionExecutionBindings,
  canonicalJson,
  parseProductionExecutionArtifact,
  parseProductionExecutionAuthorization,
  sha256,
  validateProductionExecutionAuthorization,
  type ProductionExecutionArtifact,
  type ProductionExecutionAuthorization,
  type ProductionExecutionPhase,
} from './production-execution-format';
import {
  assertLoopbackForkUrl,
  beginProductionForkSession,
  buildProductionExecutionArtifact,
  buildProductionExecutionAuthorizationCandidate,
  buildProductionExecutionBundles,
  endProductionForkSession,
  RecordingProductionPlannerSigner,
  writeExclusiveCanonicalJson,
} from './production-execution-plan';
import {
  assertSafeControlPlaneEvidence,
  assertSafeControlPlaneIdentity,
  observeSafeControlPlane,
  type SafeControlPlaneEvidence,
} from './safe-control-plane';

const TRUSTED_POLICY_RELATIVE_PATH = 'packages/config/deployments/deployment-authorization-policy.json';
const SAFE_POLICY_RELATIVE_PATH = 'packages/config/deployments/safe-control-plane-policy.json';
const FORBIDDEN_ENVIRONMENT = [
  'DEPLOYER_PRIVATE_KEY',
  'GENESIS_LIQUIDITY_BACKER_KEY',
  'GENESIS_SETTLEMENT_EXECUTOR_KEY',
  'LOCAL_TIMELOCK_PROPOSER_KEY',
  'MNEMONIC',
  'NODE_OPTIONS',
  'NODE_PATH',
  'PRIVATE_KEY',
  'PROTOCOL_TIMELOCK_PROPOSER_KEY',
  'TIMELOCK_EXECUTOR_KEY',
] as const;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function requiredPath(name: string): string {
  return path.resolve(requiredEnvironment(name));
}

async function assertExternalAbsentPath(repositoryRoot: string, requested: string, label: string): Promise<string> {
  const parentPath = path.dirname(requested);
  const suppliedParent = await lstat(parentPath);
  if (suppliedParent.isSymbolicLink()) throw new Error(`${label} parent must not be a symlink`);
  const parent = await realpath(parentPath);
  const stats = await lstat(parent);
  if (!stats.isDirectory() || (stats.mode & 0o022) !== 0) {
    throw new Error(`${label} parent must be a non-group/world-writable directory`);
  }
  if (process.getuid !== undefined && stats.uid !== process.getuid()) {
    throw new Error(`${label} parent must be owned by the current operator`);
  }
  const resolved = path.join(parent, path.basename(requested));
  const relative = path.relative(repositoryRoot, resolved);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error(`${label} must be outside the git worktree`);
  }
  try {
    await access(resolved);
    throw new Error(`${label} already exists: ${resolved}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} already exists:`)) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return resolved;
}

async function repositoryIdentity(repositoryRoot: string): Promise<string> {
  await assertExpectedGitRepositoryRoot(repositoryRoot);
  const commit = await sanitizedGitOutput(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
  const normalized = commit.trim();
  if (!/^[0-9a-f]{40}$/.test(normalized)) throw new Error('production planner cannot resolve an exact git commit');
  await assertExactTrackedWorktreeAtHead(repositoryRoot, normalized);
  const status = await sanitizedGitOutput(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status.length !== 0) throw new Error('production planner requires an exact clean git worktree');
  return normalized;
}

async function readCommittedFile(
  repositoryRoot: string,
  repositoryCommit: string,
  relativePath: string,
  label: string,
): Promise<Buffer> {
  try {
    return Buffer.from(await readExactTrackedFileAtHead(repositoryRoot, relativePath, repositoryCommit), 'utf8');
  } catch (error) {
    throw new Error(`${label} differs from the authorized commit`, { cause: error });
  }
}

function requestedPhase(value: string): ProductionExecutionPhase {
  if (value !== 'deploy' && value !== 'execute' && value !== 'fund-genesis' && value !== 'settle-genesis') {
    throw new Error('production planner supports only deploy, execute, fund-genesis, and settle-genesis');
  }
  return value;
}

async function executeSimulation(
  phase: ProductionExecutionPhase,
  config: DeploymentConfig,
  signer: RecordingProductionPlannerSigner,
  statePath: string,
): Promise<DeploymentState> {
  if (phase === 'deploy') {
    const state = await deployPhaseOne(hre, config, signer);
    await writeDeploymentState(statePath, state);
    return state;
  }
  const state = await readDeploymentState(statePath);
  if (phase === 'execute') {
    await executeRegistryPhase(hre.ethers.provider, signer, config, state, statePath);
  } else if (phase === 'fund-genesis') {
    await fundGenesisPhase(hre.ethers.provider, signer, config, state, statePath);
  } else {
    await settleGenesisPhase(hre.ethers.provider, signer, config, state, statePath);
  }
  return readDeploymentState(statePath);
}

function normalizeSimulationState(
  state: DeploymentState,
  networkName: 'robinhood' | 'robinhoodTestnet',
  anchorTimestamp: string,
): DeploymentState {
  return {
    ...state,
    networkName,
    updatedAt: new Date(Number(anchorTimestamp) * 1_000).toISOString(),
  };
}

async function main(): Promise<void> {
  if (process.env.DEPLOYMENT_EXECUTION_MODE !== 'production-keyless-plan') {
    throw new Error('production planning requires DEPLOYMENT_EXECUTION_MODE=production-keyless-plan');
  }
  const inherited = FORBIDDEN_ENVIRONMENT.filter((name) => {
    const value = process.env[name];
    return value !== undefined && value.length > 0;
  });
  if (inherited.length > 0) {
    throw new Error(`production keyless planner refuses secret or loader variables: ${inherited.join(', ')}`);
  }
  if (hre.network.name !== 'robinhoodForkPlanner' && hre.network.name !== 'robinhoodTestnetForkPlanner') {
    throw new Error('production planning requires an explicit localhost fork-planner Hardhat network');
  }
  const configuredUrl = 'url' in hre.network.config ? String(hre.network.config.url) : '';
  assertLoopbackForkUrl(configuredUrl);

  const phase = requestedPhase(requiredEnvironment('DEPLOYMENT_PHASE'));
  const repositoryRoot = await realpath(path.resolve(__dirname, '../../../..'));
  const repositoryCommit = await repositoryIdentity(repositoryRoot);
  const deploymentAuthorizationPath = requiredPath('DEPLOYMENT_AUTHORIZATION_PATH');
  const configPath = requiredPath('DEPLOYMENT_CONFIG_PATH');
  const statePath = requiredPath('DEPLOYMENT_STATE_PATH');
  const candidatePath = await assertExternalAbsentPath(
    repositoryRoot,
    requiredPath('PRODUCTION_EXECUTION_CANDIDATE_PATH'),
    'production execution candidate',
  );
  const runnerPath = await assertExternalAbsentPath(
    repositoryRoot,
    requiredPath('PRODUCTION_EXECUTION_RUNNER_PATH'),
    'production runner bundle',
  );
  const verifierPath = await assertExternalAbsentPath(
    repositoryRoot,
    requiredPath('PRODUCTION_EXECUTION_VERIFIER_PATH'),
    'production verifier bundle',
  );
  const signedExecutionPathValue = process.env.PRODUCTION_EXECUTION_AUTHORIZATION_PATH;
  const signedExecutionPath =
    signedExecutionPathValue === undefined || signedExecutionPathValue.length === 0
      ? undefined
      : path.resolve(signedExecutionPathValue);
  const artifactPath =
    signedExecutionPath === undefined
      ? null
      : await assertExternalAbsentPath(
          repositoryRoot,
          requiredPath('PRODUCTION_EXECUTION_ARTIFACT_PATH'),
          'production execution artifact',
        );
  if (!runnerPath.endsWith('.mjs') || !verifierPath.endsWith('.mjs')) {
    throw new Error('production runner and verifier bundles must use .mjs outputs');
  }

  const trustedPolicyBytes = await readCommittedFile(
    repositoryRoot,
    repositoryCommit,
    TRUSTED_POLICY_RELATIVE_PATH,
    'production deployment-authorization trust root',
  );
  const trustedPolicyValue = JSON.parse(trustedPolicyBytes.toString('utf8')) as { kind?: unknown };
  if (trustedPolicyValue.kind === 'gumball-6900-deployment-authorization-policy-unconfigured') {
    throw new Error('production deployment-authorization trust root is explicitly unconfigured');
  }
  const trustedPolicy = parseDeploymentAuthorizationPolicy(JSON.parse(trustedPolicyBytes.toString('utf8')) as unknown);
  const deployment = await validateDeploymentAuthorization(
    JSON.parse(await readFile(deploymentAuthorizationPath, 'utf8')) as unknown,
  );
  const trustedPolicyCore = {
    authorizedSigners: trustedPolicy.authorizedSigners,
    policyId: trustedPolicy.policyId as `0x${string}`,
    threshold: trustedPolicy.threshold,
  };
  if (canonicalJson(deployment.signaturePolicy) !== canonicalJson(trustedPolicyCore)) {
    throw new Error('deployment authorization signer policy does not match the trusted policy');
  }
  if (deployment.phase !== phase) {
    throw new Error('deployment authorization phase does not match the production planner phase');
  }
  if (deployment.releaseGitCommit !== repositoryCommit) {
    throw new Error('clean repository commit does not match the signed deployment authorization');
  }
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== BigInt(deployment.network.chainId)) {
    throw new Error('localhost fork chain does not match the signed deployment authorization');
  }
  const configValue = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
  if (sha256(canonicalJson(configValue)) !== deployment.deploymentConfigHash) {
    throw new Error('deployment config does not match the signed authorization hash');
  }
  const config = await readDeploymentConfig(configPath, network.chainId);
  const safePolicyBytes = await readCommittedFile(
    repositoryRoot,
    repositoryCommit,
    SAFE_POLICY_RELATIVE_PATH,
    'Safe control-plane policy',
  );
  const safePolicy = parseSafeControlPlanePolicy(JSON.parse(safePolicyBytes.toString('utf8')) as unknown);
  if (config.protocolAdminSafe === null || config.emergencyGuardianSafe === null) {
    throw new Error('production config lacks both required Safe control planes');
  }
  assertApprovedSafeControlPlane(safePolicy, config.protocolAdminSafe, deployment.network, 'Protocol-admin');
  assertApprovedSafeControlPlane(safePolicy, config.emergencyGuardianSafe, deployment.network, 'Emergency-guardian');
  if (
    phase === 'fund-genesis' &&
    getAddress(deployment.broadcaster) !== getAddress(config.roles.genesisLiquidityBacker)
  ) {
    throw new Error('fund-genesis broadcaster must equal the configured genesis liquidity backer');
  }
  let priorState: ProductionExecutionAuthorization['priorState'];
  let priorStateValue: unknown;
  if (phase === 'deploy') {
    try {
      await access(statePath);
      throw new Error('deploy production planning requires an absent predecessor-state path');
    } catch (error) {
      if (error instanceof Error && error.message.includes('requires an absent')) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    priorState = { hash: deployment.priorState.hash as `0x${string}`, kind: 'absent' };
  } else {
    priorStateValue = JSON.parse(await readFile(statePath, 'utf8')) as unknown;
    if (sha256(canonicalJson(priorStateValue)) !== deployment.priorState.hash) {
      throw new Error('predecessor state does not match the signed deployment authorization');
    }
    priorState = { hash: deployment.priorState.hash as `0x${string}`, kind: 'canonical-json' };
  }

  const anchor = await hre.ethers.provider.getBlock('latest');
  if (anchor === null || anchor.hash === null) throw new Error('localhost fork anchor block is unavailable');
  const forkAnchor = {
    hash: anchor.hash.toLowerCase() as `0x${string}`,
    number: anchor.number.toString(),
    timestamp: anchor.timestamp.toString(),
  };
  assertSafeControlPlaneIdentity(deployment.protocolAdminSafe, config.protocolAdminSafe, 'Signed protocol-admin Safe');
  assertSafeControlPlaneIdentity(
    deployment.emergencyGuardianSafe,
    config.emergencyGuardianSafe,
    'Signed emergency-guardian Safe',
  );
  for (const [label, evidence] of [
    ['protocol-admin', deployment.protocolAdminSafe],
    ['emergency-guardian', deployment.emergencyGuardianSafe],
  ] as const) {
    if (
      evidence.block.number !== forkAnchor.number ||
      evidence.block.hash.toLowerCase() !== forkAnchor.hash ||
      evidence.block.timestamp !== forkAnchor.timestamp
    ) {
      throw new Error(`signed ${label} Safe evidence must use the exact production fork anchor`);
    }
  }
  const [observedAdminSafe, observedGuardianSafe] = await Promise.all([
    observeSafeControlPlane(hre.ethers.provider, config.protocolAdminSafe.safeAddress, anchor.number),
    observeSafeControlPlane(hre.ethers.provider, config.emergencyGuardianSafe.safeAddress, anchor.number),
  ]);
  assertSafeControlPlaneEvidence(
    observedAdminSafe,
    deployment.protocolAdminSafe as unknown as SafeControlPlaneEvidence,
    {
      label: 'Fork protocol-admin Safe',
    },
  );
  assertSafeControlPlaneEvidence(
    observedGuardianSafe,
    deployment.emergencyGuardianSafe as unknown as SafeControlPlaneEvidence,
    {
      label: 'Fork emergency-guardian Safe',
    },
  );
  const broadcaster = getAddress(deployment.broadcaster);
  const session = await beginProductionForkSession(hre.ethers.provider, broadcaster);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'gumball-production-plan-'));
  const simulationStatePath = path.join(temporaryDirectory, 'state.json');
  if (phase !== 'deploy') {
    await writeFile(simulationStatePath, canonicalJson(priorStateValue), { encoding: 'utf8', mode: 0o600 });
  }
  let bundleCreated = false;
  let candidateCreated = false;
  let artifactCreated = false;
  let completed = false;
  try {
    const setBalanceMethod = session.impersonationMethod === 'hardhat' ? 'hardhat_setBalance' : 'anvil_setBalance';
    await hre.ethers.provider.send(setBalanceMethod, [broadcaster, '0x3635c9adc5dea00000']);
    const delegate = await hre.ethers.provider.getSigner(broadcaster);
    const pendingNonce = await hre.ethers.provider.getTransactionCount(broadcaster, 'pending');
    if (pendingNonce.toString() !== deployment.nonceWindow.start) {
      throw new Error('fork broadcaster nonce does not match the signed deployment nonce window');
    }
    const planner = new RecordingProductionPlannerSigner(delegate, deployment.network.chainId);
    const simulatedState = await executeSimulation(phase, config, planner, simulationStatePath);
    if (planner.transactions.length === 0) throw new Error('production phase simulation produced no transactions');
    if (planner.transactions.length !== deployment.nonceWindow.transactionCount) {
      throw new Error('simulated transaction count does not match the signed deployment nonce window');
    }
    const transactionResults = await Promise.all(
      planner.responses.map(async (response) => {
        const receipt = await response.wait();
        if (receipt === null || receipt.status !== 1) throw new Error('fork simulation transaction failed');
        return {
          blockNumber: receipt.blockNumber.toString(),
          simulationHash: receipt.hash.toLowerCase() as `0x${string}`,
        };
      }),
    );
    const resultStateTemplate = normalizeSimulationState(
      simulatedState,
      deployment.network.chainId === 4_663 ? 'robinhood' : 'robinhoodTestnet',
      forkAnchor.timestamp,
    ) as unknown as Record<string, unknown>;
    const serializedTemplate = canonicalJson(resultStateTemplate);
    for (const result of transactionResults) {
      if (!serializedTemplate.toLowerCase().includes(result.simulationHash.slice(2))) {
        throw new Error(`successor-state template does not bind simulated transaction ${result.simulationHash}`);
      }
    }
    const buildBinding = await buildProductionExecutionBundles(
      repositoryRoot,
      runnerPath,
      verifierPath,
      repositoryCommit,
    );
    if ((await repositoryIdentity(repositoryRoot)) !== repositoryCommit) {
      throw new Error('production repository changed while constructing the measured execution bundles');
    }
    bundleCreated = true;
    const executionNetwork: ProductionExecutionAuthorization['network'] =
      deployment.network.chainId === 4_663
        ? { chainId: 4_663, name: 'Robinhood Chain' }
        : { chainId: 46_630, name: 'Robinhood Chain Testnet' };
    const simulationTranscript: ProductionExecutionArtifact['simulation'] = {
      clientVersion: session.clientVersion,
      forkAnchor,
      reverted: true,
      transactionResults,
    };
    const candidate = buildProductionExecutionAuthorizationCandidate({
      anchor: forkAnchor,
      broadcaster,
      build: buildBinding,
      deploymentAuthorizationId: deployment.authorizationId as `0x${string}`,
      deploymentAuthorizationPayloadHash: deploymentAuthorizationSigningPayloadHash(deployment),
      deploymentConfigHash: deployment.deploymentConfigHash as `0x${string}`,
      executionId: requiredEnvironment('PRODUCTION_EXECUTION_ID') as `0x${string}`,
      expiresAt: requiredEnvironment('PRODUCTION_EXECUTION_EXPIRES_AT'),
      issuedAt: requiredEnvironment('PRODUCTION_EXECUTION_ISSUED_AT'),
      network: executionNetwork,
      nonceWindow: deployment.nonceWindow,
      phase,
      planHash: sha256(canonicalJson(planner.transactions)),
      priorState,
      resultStateTemplateHash: sha256(serializedTemplate),
      simulationTranscriptHash: sha256(canonicalJson(simulationTranscript)),
      signaturePolicy: {
        ...deployment.signaturePolicy,
        policyId: deployment.signaturePolicy.policyId as `0x${string}`,
      },
    });
    parseProductionExecutionAuthorization(candidate);
    await writeExclusiveCanonicalJson(candidatePath, candidate, 0o600);
    candidateCreated = true;
    if (signedExecutionPath !== undefined && artifactPath !== null) {
      const signedExecution = await validateProductionExecutionAuthorization(
        JSON.parse(await readFile(signedExecutionPath, 'utf8')) as unknown,
        trustedPolicyCore,
      );
      if (canonicalJson({ ...signedExecution, signatures: [] }) !== canonicalJson({ ...candidate, signatures: [] })) {
        throw new Error('signed production execution authorization does not match the reproducible fork plan');
      }
      const artifact = buildProductionExecutionArtifact({
        clientVersion: session.clientVersion,
        deploymentAuthorizationId: deployment.authorizationId as `0x${string}`,
        deploymentAuthorizationPayloadHash: deploymentAuthorizationSigningPayloadHash(deployment),
        executionAuthorization: signedExecution,
        resultStateTemplate,
        transactionResults,
        transactions: planner.transactions,
      });
      parseProductionExecutionArtifact(artifact);
      assertProductionExecutionBindings(
        artifact,
        signedExecution,
        deployment,
        deploymentAuthorizationSigningPayloadHash(deployment),
      );
      await writeExclusiveCanonicalJson(artifactPath, artifact, 0o600);
      artifactCreated = true;
    }
    completed = true;
  } finally {
    let reverted = false;
    try {
      await endProductionForkSession(hre.ethers.provider, broadcaster, session);
      reverted = true;
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
      if (!completed || !reverted) {
        await Promise.all([
          bundleCreated ? rm(runnerPath, { force: true }) : Promise.resolve(),
          bundleCreated ? rm(verifierPath, { force: true }) : Promise.resolve(),
          candidateCreated ? rm(candidatePath, { force: true }) : Promise.resolve(),
          artifactCreated && artifactPath !== null ? rm(artifactPath, { force: true }) : Promise.resolve(),
        ]);
      }
    }
  }
  process.stdout.write(`Unsigned production execution candidate: ${candidatePath}\n`);
  process.stdout.write(`Reviewed runner bundle: ${runnerPath}\n`);
  process.stdout.write(`Reviewed verifier bundle: ${verifierPath}\n`);
  if (artifactPath === null) {
    process.stdout.write('No execution artifact was created; threshold-sign the candidate and rerun with its path\n');
  } else {
    process.stdout.write(`Signed production execution artifact: ${artifactPath}\n`);
  }
  process.stdout.write('No key was read and every fork transaction was reverted\n');
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Production execution preparation failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
