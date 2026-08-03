import { spawn } from 'node:child_process';
import { access, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDeploymentAuthorization } from '../schemas/deployment-authorization.js';
import { assertAuthorizedDeploymentTarget } from '../schemas/deployment-config.js';
import { parseSafeControlPlaneEvidence } from '../schemas/safe-control-plane.js';
import { deterministicJson, sha256Hex } from '../tooling/deterministic-json.js';
import { assertKeylessEnvironment, keylessHardhatEnvironment } from '../tooling/signer-environment.js';
import { assertKnownOptions, parseArguments, requireValue, resolveUserPath } from './cli-helpers.js';

function requiredCommandChainId(): 4_663 | 46_630 | undefined {
  const value = process.env.DEPLOYMENT_EXPECTED_CHAIN_ID;
  if (value === undefined || value.length === 0) return undefined;
  if (value === '4663') return 4_663;
  if (value === '46630') return 46_630;
  throw new Error(`DEPLOYMENT_EXPECTED_CHAIN_ID must be 4663 or 46630; received ${value}`);
}

async function main(): Promise<void> {
  assertKeylessEnvironment(process.env);
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(
    arguments_,
    [
      'authorization',
      'config',
      'emergency-guardian-safe-evidence',
      'ledger',
      'protocol-admin-safe-evidence',
      'safe-bundle',
      'state',
    ],
    [],
  );
  const authorizationPath = resolveUserPath(requireValue(arguments_, 'authorization'));
  const configPath = resolveUserPath(requireValue(arguments_, 'config'));
  const statePath = resolveUserPath(requireValue(arguments_, 'state'));
  const ledgerPath = resolveUserPath(requireValue(arguments_, 'ledger'));
  const authorization = await validateDeploymentAuthorization(
    JSON.parse(await readFile(authorizationPath, 'utf8')) as unknown,
  );
  const deploymentConfig = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
  assertAuthorizedDeploymentTarget(authorization.network, deploymentConfig, requiredCommandChainId());
  if (authorization.phase !== 'schedule') {
    throw new Error(
      `in-repository ${authorization.phase} broadcast is disabled: production EOA execution requires a separately reviewed isolated signer runner`,
    );
  }
  const safeOptionProvided =
    arguments_.values.has('safe-bundle') ||
    arguments_.values.has('protocol-admin-safe-evidence') ||
    arguments_.values.has('emergency-guardian-safe-evidence');
  let safeEnvironment: Record<string, string> = {};
  if (authorization.phase === 'schedule') {
    if (authorization.safeSchedule === undefined) throw new Error('Schedule authorization lacks Safe proposal binding');
    const protocolAdminSafeEvidencePath = resolveUserPath(requireValue(arguments_, 'protocol-admin-safe-evidence'));
    const emergencyGuardianSafeEvidencePath = resolveUserPath(
      requireValue(arguments_, 'emergency-guardian-safe-evidence'),
    );
    const safeBundlePath = resolveUserPath(requireValue(arguments_, 'safe-bundle'));
    const repositoryRoot = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
    const outputParent = await realpath(path.dirname(safeBundlePath));
    const resolvedOutput = path.join(outputParent, path.basename(safeBundlePath));
    const relativeOutput = path.relative(repositoryRoot, resolvedOutput);
    if (
      relativeOutput === '' ||
      (!relativeOutput.startsWith(`..${path.sep}`) && relativeOutput !== '..' && !path.isAbsolute(relativeOutput))
    ) {
      throw new Error('Safe bundle output path must be outside the git worktree');
    }
    try {
      await access(resolvedOutput);
      throw new Error(`Safe bundle output already exists: ${resolvedOutput}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Safe bundle output already exists:')) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const protocolAdminEvidence = parseSafeControlPlaneEvidence(
      JSON.parse(await readFile(protocolAdminSafeEvidencePath, 'utf8')) as unknown,
    );
    const guardianEvidence = parseSafeControlPlaneEvidence(
      JSON.parse(await readFile(emergencyGuardianSafeEvidencePath, 'utf8')) as unknown,
    );
    const evidenceHash = sha256Hex(deterministicJson(protocolAdminEvidence));
    if (
      deterministicJson(protocolAdminEvidence) !== deterministicJson(authorization.protocolAdminSafe) ||
      evidenceHash !== authorization.safeSchedule.controlPlaneEvidenceHash
    ) {
      throw new Error('Safe control-plane evidence does not match schedule authorization');
    }
    if (
      protocolAdminEvidence.network.chainId !== authorization.network.chainId ||
      protocolAdminEvidence.network.name !== authorization.network.name ||
      protocolAdminEvidence.safeAddress.toLowerCase() !== authorization.safeSchedule.safeAddress.toLowerCase() ||
      protocolAdminEvidence.nonce !== authorization.safeSchedule.safeNonce
    ) {
      throw new Error('Safe control-plane identity does not match schedule authorization');
    }
    if (
      deterministicJson(guardianEvidence) !== deterministicJson(authorization.emergencyGuardianSafe) ||
      guardianEvidence.network.chainId !== authorization.network.chainId ||
      guardianEvidence.network.name !== authorization.network.name
    ) {
      throw new Error('Emergency-guardian Safe evidence does not match schedule authorization');
    }
    safeEnvironment = {
      DEPLOYMENT_SAFE_BUNDLE_PATH: resolvedOutput,
      DEPLOYMENT_EMERGENCY_GUARDIAN_SAFE_EVIDENCE_PATH: emergencyGuardianSafeEvidencePath,
      DEPLOYMENT_PROTOCOL_ADMIN_SAFE_EVIDENCE_PATH: protocolAdminSafeEvidencePath,
    };
  } else if (safeOptionProvided) {
    throw new Error('Safe evidence and bundle options are allowed only for the schedule phase');
  }
  const network = authorization.network.chainId === 4663 ? 'robinhood' : 'robinhoodTestnet';
  const contractsDirectory = fileURLToPath(new URL('../../contracts/', import.meta.url));
  const hardhatBinary = fileURLToPath(new URL('../../../node_modules/.bin/hardhat', import.meta.url));

  const child = spawn(hardhatBinary, ['run', 'script/hardhat/deploy.ts', '--network', network], {
    cwd: contractsDirectory,
    env: keylessHardhatEnvironment(process.env, {
      DEPLOYMENT_AUTHORIZATION_PATH: authorizationPath,
      DEPLOYMENT_AUTHORIZATION_LEDGER_PATH: ledgerPath,
      DEPLOYMENT_CONFIG_PATH: configPath,
      DEPLOYMENT_EXECUTION_MODE: 'authorized-keyless-proposal',
      DEPLOYMENT_PHASE: authorization.phase,
      ...safeEnvironment,
      DEPLOYMENT_STATE_PATH: statePath,
    }),
    stdio: 'inherit',
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal !== null) reject(new Error(`Hardhat deployment terminated by ${signal}`));
      else resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Authorized deployment wrapper failed: ${message}\n`);
  process.exitCode = 1;
});
