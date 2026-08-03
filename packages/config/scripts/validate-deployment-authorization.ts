import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  deploymentAuthorizationSigningPayload,
  parseDeploymentAuthorizationPolicy,
  parseDeploymentAuthorization,
  validateDeploymentAuthorization,
} from '../schemas/deployment-authorization.js';
import { deterministicJson } from '../tooling/deterministic-json.js';
import { assertTrustedDeploymentAuthorizationPolicy } from '../tooling/deployment-authorization.js';
import {
  assertExactTrackedWorktreeAtHead,
  assertExpectedGitRepositoryRoot,
  assertRepositoryHead,
  readExactTrackedFileAtHead,
  sanitizedGitOutput,
} from '../tooling/tracked-git-file.js';
import { assertKnownOptions, parseArguments, requireValue, resolveUserPath, writeOutput } from './cli-helpers.js';

async function gitOutput(repositoryRoot: string, arguments_: string[]): Promise<string> {
  return sanitizedGitOutput(repositoryRoot, arguments_);
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(arguments_, ['file', 'output'], ['print-canonical', 'print-signing-payload']);
  if (arguments_.flags.has('print-canonical') && arguments_.flags.has('print-signing-payload')) {
    throw new Error('Choose at most one print mode');
  }
  const inputPath = requireValue(arguments_, 'file');
  const value = JSON.parse(await readFile(resolveUserPath(inputPath), 'utf8')) as unknown;
  const parsedAuthorization = parseDeploymentAuthorization(value);
  const expectedRepositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const repositoryRoot = await assertExpectedGitRepositoryRoot(expectedRepositoryRoot);
  const repositoryCommit = await gitOutput(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (repositoryCommit !== parsedAuthorization.releaseGitCommit) {
    throw new Error(
      `Repository commit ${repositoryCommit} does not match authorization ${parsedAuthorization.releaseGitCommit}`,
    );
  }
  await assertExactTrackedWorktreeAtHead(repositoryRoot, repositoryCommit);
  const status = await gitOutput(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status.length !== 0) throw new Error('Git worktree must be clean before printing or validating authorization');
  const trustedPolicy = parseDeploymentAuthorizationPolicy(
    JSON.parse(
      await readExactTrackedFileAtHead(
        repositoryRoot,
        'packages/config/deployments/deployment-authorization-policy.json',
        repositoryCommit,
      ),
    ) as unknown,
  );
  assertTrustedDeploymentAuthorizationPolicy(parsedAuthorization, trustedPolicy);
  if (arguments_.flags.has('print-signing-payload')) {
    await assertRepositoryHead(repositoryRoot, repositoryCommit);
    await writeOutput(deploymentAuthorizationSigningPayload(parsedAuthorization), arguments_.values.get('output'));
    return;
  }
  const authorization = await validateDeploymentAuthorization(value);
  if (arguments_.flags.has('print-canonical')) {
    await assertRepositoryHead(repositoryRoot, repositoryCommit);
    await writeOutput(deterministicJson(authorization), arguments_.values.get('output'));
    return;
  }
  await assertRepositoryHead(repositoryRoot, repositoryCommit);
  process.stdout.write(`Deployment authorization is valid: ${inputPath}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Deployment authorization validation failed: ${message}\n`);
  process.exitCode = 1;
});
