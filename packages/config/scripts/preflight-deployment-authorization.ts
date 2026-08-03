import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  deploymentAuthorizationPhases,
  parseDeploymentAuthorizationPolicy,
  type DeploymentAuthorizationPhase,
} from '../schemas/deployment-authorization.js';
import { parseSafeControlPlaneEvidence } from '../schemas/safe-control-plane.js';
import { preflightDeploymentAuthorization } from '../tooling/deployment-authorization.js';
import { deterministicJson } from '../tooling/deterministic-json.js';
import {
  assertExactTrackedWorktreeAtHead,
  assertExpectedGitRepositoryRoot,
  assertRepositoryHead,
  readExactTrackedFileAtHead,
  sanitizedGitOutput,
} from '../tooling/tracked-git-file.js';
import { assertKnownOptions, parseArguments, requireValue, resolveUserPath } from './cli-helpers.js';

function parsePhase(value: string): DeploymentAuthorizationPhase {
  if (!(deploymentAuthorizationPhases as readonly string[]).includes(value)) {
    throw new Error(`Unsupported deployment phase: ${value}`);
  }
  return value as DeploymentAuthorizationPhase;
}

async function gitOutput(repositoryRoot: string, arguments_: string[]): Promise<string> {
  return sanitizedGitOutput(repositoryRoot, arguments_);
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(
    arguments_,
    [
      'authorization',
      'command-family',
      'config',
      'ledger',
      'observed-broadcaster',
      'observed-chain-id',
      'observed-pending-nonce',
      'observed-current-emergency-guardian-safe-json',
      'observed-current-protocol-admin-safe-json',
      'observed-historical-emergency-guardian-safe-json',
      'observed-historical-protocol-admin-safe-json',
      'phase',
      'emergency-guardian-safe-evidence',
      'protocol-admin-safe-evidence',
      'state',
    ],
    [],
  );
  const authorizationPath = resolveUserPath(requireValue(arguments_, 'authorization'));
  const deploymentConfigPath = resolveUserPath(requireValue(arguments_, 'config'));
  const priorStatePath = resolveUserPath(requireValue(arguments_, 'state'));
  const ledgerPath = resolveUserPath(requireValue(arguments_, 'ledger'));
  const commandFamily = requireValue(arguments_, 'command-family');
  if (commandFamily !== 'hardhat') throw new Error('Authorization schema v1 permits only the hardhat command family');
  const requestedPhase = parsePhase(requireValue(arguments_, 'phase'));
  const observedChainId = Number(requireValue(arguments_, 'observed-chain-id'));
  if (!Number.isSafeInteger(observedChainId) || observedChainId <= 0) throw new Error('Observed chain ID is invalid');
  const observedBroadcaster = requireValue(arguments_, 'observed-broadcaster');
  const observedPendingNonce = requireValue(arguments_, 'observed-pending-nonce');
  if (!/^(0|[1-9][0-9]*)$/.test(observedPendingNonce)) throw new Error('Observed pending nonce is invalid');
  const safeControlPlaneInputs = {
    emergencyGuardianSafeCurrentObservation: parseSafeControlPlaneEvidence(
      JSON.parse(requireValue(arguments_, 'observed-current-emergency-guardian-safe-json')) as unknown,
    ),
    emergencyGuardianSafeEvidencePath: resolveUserPath(requireValue(arguments_, 'emergency-guardian-safe-evidence')),
    emergencyGuardianSafeHistoricalObservation: parseSafeControlPlaneEvidence(
      JSON.parse(requireValue(arguments_, 'observed-historical-emergency-guardian-safe-json')) as unknown,
    ),
    protocolAdminSafeCurrentObservation: parseSafeControlPlaneEvidence(
      JSON.parse(requireValue(arguments_, 'observed-current-protocol-admin-safe-json')) as unknown,
    ),
    protocolAdminSafeEvidencePath: resolveUserPath(requireValue(arguments_, 'protocol-admin-safe-evidence')),
    protocolAdminSafeHistoricalObservation: parseSafeControlPlaneEvidence(
      JSON.parse(requireValue(arguments_, 'observed-historical-protocol-admin-safe-json')) as unknown,
    ),
  };

  const expectedRepositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const repositoryRoot = await assertExpectedGitRepositoryRoot(expectedRepositoryRoot);
  const repositoryCommit = await gitOutput(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
  await assertExactTrackedWorktreeAtHead(repositoryRoot, repositoryCommit);
  const status = await gitOutput(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  const authorization = JSON.parse(await readFile(authorizationPath, 'utf8')) as unknown;
  const policyRelativePath = 'packages/config/deployments/deployment-authorization-policy.json';
  const trustedSignaturePolicy = parseDeploymentAuthorizationPolicy(
    JSON.parse(await readExactTrackedFileAtHead(repositoryRoot, policyRelativePath, repositoryCommit)) as unknown,
  );
  await assertRepositoryHead(repositoryRoot, repositoryCommit);
  const receipt = await preflightDeploymentAuthorization(authorization, {
    authorizationPath,
    commandFamily,
    deploymentConfigPath,
    ledgerPath,
    now: new Date(),
    observedBroadcaster,
    observedChainId,
    observedPendingNonce,
    priorStatePath,
    repositoryClean: status.length === 0,
    repositoryCommit,
    repositoryRoot,
    requestedPhase,
    ...safeControlPlaneInputs,
    trustedSignaturePolicy,
  });
  process.stdout.write(deterministicJson(receipt));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Deployment authorization preflight failed: ${message}\n`);
  process.exitCode = 1;
});
