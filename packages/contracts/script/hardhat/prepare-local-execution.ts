import { access, lstat, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getAddress } from 'ethers';
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
  type DeploymentConfig,
} from './deployment';
import {
  ABSENT_DEPLOYMENT_STATE_HASH,
  canonicalJson,
  parsePreparedExecutionArtifact,
  preparedExecutionPhases,
  sha256,
  type PreparedExecutionPhase,
} from './prepared-execution-format';
import {
  buildLocalPreparationArtifact,
  buildPreparedRunnerBundle,
  copyPreparedExecutionVerifier,
  RecordingPlannerSigner,
  writeExclusiveJson,
} from './prepared-execution-plan';

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

function requiredEnvironmentPath(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return path.resolve(value);
}

function requestedPhase(): PreparedExecutionPhase {
  const phase = process.env.DEPLOYMENT_PHASE;
  if (!(preparedExecutionPhases as readonly unknown[]).includes(phase)) {
    throw new Error(`unsupported or absent DEPLOYMENT_PHASE=${String(phase)}`);
  }
  return phase as PreparedExecutionPhase;
}

async function assertExternalAbsentPath(repositoryRoot: string, requested: string, label: string): Promise<string> {
  const requestedParent = path.dirname(requested);
  const requestedParentStats = await lstat(requestedParent);
  if (requestedParentStats.isSymbolicLink()) throw new Error(`${label} parent must not be a symlink`);
  const parent = await realpath(requestedParent);
  const parentStats = await lstat(parent);
  if (!parentStats.isDirectory() || (parentStats.mode & 0o022) !== 0) {
    throw new Error(`${label} parent must be a non-group/world-writable directory`);
  }
  if (process.getuid !== undefined && parentStats.uid !== process.getuid()) {
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

async function unlockedSigner(signers: readonly Signer[], expected?: string): Promise<Signer> {
  if (expected === undefined) {
    const first = signers[0];
    if (first === undefined) throw new Error('local rehearsal RPC exposes no unlocked account');
    return first;
  }
  const expectedAddress = getAddress(expected);
  for (const signer of signers) {
    if (getAddress(await signer.getAddress()) === expectedAddress) return signer;
  }
  throw new Error(`local rehearsal RPC does not expose required unlocked account ${expectedAddress}`);
}

async function phaseSigner(
  phase: PreparedExecutionPhase,
  config: DeploymentConfig,
  signers: readonly Signer[],
): Promise<Signer> {
  if (phase === 'schedule') return unlockedSigner(signers, config.roles.protocolTimelockMultisig);
  if (phase === 'fund-genesis') return unlockedSigner(signers, config.roles.genesisLiquidityBacker);
  return unlockedSigner(signers);
}

async function executePhase(
  phase: PreparedExecutionPhase,
  config: DeploymentConfig,
  signer: Signer,
  statePath: string,
): Promise<void> {
  if (phase === 'deploy') {
    const state = await deployPhaseOne(hre, config, signer);
    await writeDeploymentState(statePath, state);
    return;
  }
  const state = await readDeploymentState(statePath);
  if (phase === 'schedule') {
    await scheduleRegistryPhaseLocalEOA(hre.ethers.provider, signer, config, state, statePath);
  } else if (phase === 'execute') {
    await executeRegistryPhase(hre.ethers.provider, signer, config, state, statePath);
  } else if (phase === 'fund-genesis') {
    await fundGenesisPhase(hre.ethers.provider, signer, config, state, statePath);
  } else {
    await settleGenesisPhase(hre.ethers.provider, signer, config, state, statePath);
  }
}

async function main(): Promise<void> {
  if (process.env.DEPLOYMENT_EXECUTION_MODE !== 'local-keyless-prepare') {
    throw new Error('local preparation requires DEPLOYMENT_EXECUTION_MODE=local-keyless-prepare');
  }
  const inherited = FORBIDDEN_ENVIRONMENT.filter((name) => {
    const value = process.env[name];
    return value !== undefined && value.length > 0;
  });
  if (inherited.length > 0) {
    throw new Error(`local keyless preparation refuses secret or loader variables: ${inherited.join(', ')}`);
  }
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 31_337n || hre.network.name !== 'localRehearsal') {
    throw new Error('prepared execution is restricted to the named chain-31337 localRehearsal network');
  }
  const phase = requestedPhase();
  const repositoryRoot = await realpath(path.resolve(__dirname, '../../../..'));
  const configPath = requiredEnvironmentPath('DEPLOYMENT_CONFIG_PATH');
  const sourceStatePath = requiredEnvironmentPath('DEPLOYMENT_STATE_PATH');
  const artifactPath = await assertExternalAbsentPath(
    repositoryRoot,
    requiredEnvironmentPath('DEPLOYMENT_PREPARATION_ARTIFACT_PATH'),
    'preparation artifact output',
  );
  const runnerPath = await assertExternalAbsentPath(
    repositoryRoot,
    requiredEnvironmentPath('DEPLOYMENT_PREPARATION_RUNNER_PATH'),
    'prepared runner output',
  );
  const verifierPath = await assertExternalAbsentPath(
    repositoryRoot,
    requiredEnvironmentPath('DEPLOYMENT_PREPARATION_VERIFIER_PATH'),
    'prepared verifier output',
  );
  if (!runnerPath.endsWith('.mjs')) throw new Error('prepared runner output must end in .mjs');
  if (!verifierPath.endsWith('.mjs')) throw new Error('prepared verifier output must end in .mjs');
  if (new Set([artifactPath, runnerPath, verifierPath]).size !== 3) {
    throw new Error('preparation artifact, runner, and verifier outputs must be distinct paths');
  }

  const configValue = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
  const deploymentConfigHash = sha256(canonicalJson(configValue));
  const config = await readDeploymentConfig(configPath, network.chainId);
  const priorStateAbsent = phase === 'deploy';
  let priorStateHash: `0x${string}` = ABSENT_DEPLOYMENT_STATE_HASH;
  let priorStateValue: unknown;
  if (priorStateAbsent) {
    try {
      await access(sourceStatePath);
      throw new Error('deploy preparation requires an absent predecessor-state path');
    } catch (error) {
      if (error instanceof Error && error.message.includes('requires an absent')) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  } else {
    priorStateValue = JSON.parse(await readFile(sourceStatePath, 'utf8')) as unknown;
    priorStateHash = sha256(canonicalJson(priorStateValue));
    await readDeploymentState(sourceStatePath);
  }

  const anchor = await hre.ethers.provider.getBlock('latest');
  if (anchor === null || anchor.hash === null) throw new Error('local rehearsal anchor block is unavailable');
  const snapshot = (await hre.network.provider.send('evm_snapshot')) as string;
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'gumball-preparation-'));
  const simulationStatePath = path.join(temporaryDirectory, 'state.json');
  if (!priorStateAbsent) {
    await writeFile(simulationStatePath, canonicalJson(priorStateValue), { encoding: 'utf8', mode: 0o600 });
  }
  let artifactCreated = false;
  let prepared = false;
  let runnerCreated = false;
  let verifierCreated = false;
  try {
    const signers = await hre.ethers.getSigners();
    const delegate = await phaseSigner(phase, config, signers);
    const broadcaster = getAddress(await delegate.getAddress());
    const pendingNonce = await hre.ethers.provider.getTransactionCount(broadcaster, 'pending');
    const planner = new RecordingPlannerSigner(delegate);
    await executePhase(phase, config, planner, simulationStatePath);
    if (planner.transactions[0]?.nonce !== pendingNonce.toString()) {
      throw new Error('simulated phase did not begin at the observed pending nonce');
    }
    const runner = await buildPreparedRunnerBundle(repositoryRoot, runnerPath);
    runnerCreated = true;
    const verifier = await copyPreparedExecutionVerifier(repositoryRoot, verifierPath);
    verifierCreated = true;
    const artifact = buildLocalPreparationArtifact({
      anchor: {
        hash: anchor.hash.toLowerCase() as `0x${string}`,
        number: anchor.number.toString(),
        timestamp: anchor.timestamp.toString(),
      },
      broadcaster,
      deploymentConfigHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
      phase,
      priorStateAbsent,
      priorStateHash,
      runner,
      transactions: planner.transactions,
      verifier,
    });
    parsePreparedExecutionArtifact(artifact);
    await writeExclusiveJson(artifactPath, artifact);
    artifactCreated = true;
    prepared = true;
  } finally {
    let reverted = false;
    try {
      reverted = (await hre.network.provider.send('evm_revert', [snapshot])) as boolean;
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
      if (!prepared || !reverted) {
        await Promise.all([
          artifactCreated ? rm(artifactPath, { force: true }) : Promise.resolve(),
          runnerCreated ? rm(runnerPath, { force: true }) : Promise.resolve(),
          verifierCreated ? rm(verifierPath, { force: true }) : Promise.resolve(),
        ]);
      }
    }
    if (!reverted) throw new Error('failed to revert local preparation snapshot');
  }
  process.stdout.write(`Prepared local execution artifact: ${artifactPath}\n`);
  process.stdout.write(`Immutable local runner bundle: ${runnerPath}\n`);
  process.stdout.write(`Dependency-free key-injection verifier: ${verifierPath}\n`);
  process.stdout.write('No signer key was loaded and all simulated local transactions were reverted\n');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Local execution preparation failed: ${message}\n`);
  process.exitCode = 1;
});
