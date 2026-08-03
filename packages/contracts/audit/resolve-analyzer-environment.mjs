#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { appendFile, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzerEnvironmentLockPaths,
  analyzerEnvironmentPolicyPath,
  deterministicJson,
  validateAnalyzerEnvironmentPolicy,
} from '../../../scripts/release/release-lib.mjs';

const AUDIT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKSPACE = path.resolve(AUDIT_DIR, '../../..');

function usage() {
  return [
    'Usage: node audit/resolve-analyzer-environment.mjs [--workspace PATH]',
    '       [--github-output PATH | --shell-output PATH] [--verify-python EXECUTABLE]',
  ].join('\n');
}

function parseArguments(argv) {
  let githubOutput = null;
  let pythonExecutable = null;
  let shellOutput = null;
  let workspace = DEFAULT_WORKSPACE;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!['--github-output', '--shell-output', '--verify-python', '--workspace'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    index += 1;
    if (argument === '--github-output') githubOutput = path.resolve(value);
    if (argument === '--shell-output') shellOutput = path.resolve(value);
    if (argument === '--verify-python') pythonExecutable = value;
    if (argument === '--workspace') workspace = path.resolve(value);
  }

  if (githubOutput !== null && shellOutput !== null) {
    throw new Error('--github-output and --shell-output are mutually exclusive');
  }
  return { githubOutput, pythonExecutable, shellOutput, workspace };
}

async function readRegularRepositoryFile(workspace, repositoryPath) {
  const lexicalPath = path.join(workspace, repositoryPath);
  let stats;
  try {
    stats = await lstat(lexicalPath);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`Required analyzer environment file is missing: ${repositoryPath}`);
    throw error;
  }
  if (!stats.isFile() || stats.isSymbolicLink() || (stats.mode & 0o111) !== 0) {
    throw new Error(`Analyzer environment path must be a regular nonexecutable nonsymlink file: ${repositoryPath}`);
  }
  if ((await realpath(lexicalPath)) !== lexicalPath) {
    throw new Error(`Analyzer environment path has symlink ancestry: ${repositoryPath}`);
  }
  return readFile(lexicalPath);
}

function verifyPythonRuntime(pythonExecutable, policy) {
  const result = spawnSync(
    pythonExecutable,
    [
      '-I',
      '-c',
      'import json, platform; print(json.dumps({"machine": platform.machine().lower(), "system": platform.system(), "version": platform.python_version()}, sort_keys=True))',
    ],
    { encoding: 'utf8', env: { ...process.env, PYTHONHOME: '', PYTHONPATH: '' }, timeout: 30_000 },
  );
  if (result.error !== undefined) {
    throw new Error(`Could not execute configured analyzer Python: ${result.error.message}`);
  }
  if (result.signal !== null || result.status !== 0) {
    throw new Error(
      `Configured analyzer Python failed (status ${String(result.status)}, signal ${String(result.signal)})`,
    );
  }
  let observed;
  try {
    observed = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error('Configured analyzer Python returned malformed runtime identity');
  }
  if (
    observed === null ||
    typeof observed !== 'object' ||
    Array.isArray(observed) ||
    observed.version !== policy.pythonVersion ||
    observed.system !== 'Linux' ||
    observed.machine !== 'x86_64'
  ) {
    throw new Error(
      `Configured analyzer Python runtime mismatch: expected ${policy.pythonVersion} on linux-x64, observed ${String(
        observed?.version,
      )} on ${String(observed?.system)}-${String(observed?.machine)}`,
    );
  }
}

async function resolveEnvironment({ pythonExecutable, workspace }) {
  const workspaceRealPath = await realpath(workspace);
  if (workspaceRealPath !== workspace) throw new Error('Analyzer workspace path must be canonical');
  const policyBytes = await readRegularRepositoryFile(workspace, analyzerEnvironmentPolicyPath);
  let policy;
  try {
    policy = JSON.parse(policyBytes.toString('utf8'));
  } catch {
    throw new Error('Analyzer environment policy is not valid JSON');
  }

  let lockfileBytes = null;
  if (['configured', 'dependencies-prepared'].includes(policy.state)) {
    lockfileBytes = Object.fromEntries(
      await Promise.all(
        analyzerEnvironmentLockPaths.map(async (repositoryPath) => [
          repositoryPath,
          await readRegularRepositoryFile(workspace, repositoryPath),
        ]),
      ),
    );
  }
  validateAnalyzerEnvironmentPolicy(policy, { lockfileBytes, requireConfigured: false });

  const dependenciesPrepared = ['configured', 'dependencies-prepared'].includes(policy.state);
  if (dependenciesPrepared && pythonExecutable !== null) verifyPythonRuntime(pythonExecutable, policy);
  return {
    installationMode: dependenciesPrepared ? 'hash-locked-requirements-and-container' : 'top-level-pipx-engineering',
    lockSha256: dependenciesPrepared
      ? Object.fromEntries(policy.bindings.map((binding) => [binding.path, binding.sha256]))
      : {},
    lockPaths: dependenciesPrepared ? analyzerEnvironmentLockPaths : [],
    mythrilImage: dependenciesPrepared ? policy.mythrilImage.reference : null,
    platform: dependenciesPrepared ? policy.platform : 'unbound-engineering-runtime',
    policyState: policy.state,
    pythonVersion: policy.pythonVersion,
    runtimeVerified: dependenciesPrepared && pythonExecutable !== null,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.shellOutput !== null) await rm(options.shellOutput, { force: true });
  const resolution = await resolveEnvironment(options);
  if (options.githubOutput !== null) {
    await appendFile(
      options.githubOutput,
      `python_version=${resolution.pythonVersion}\npolicy_state=${resolution.policyState}\n`,
      'utf8',
    );
    return;
  }
  if (options.shellOutput !== null) {
    await mkdir(path.dirname(options.shellOutput), { recursive: true });
    await writeFile(
      options.shellOutput,
      [
        `ANALYZER_ENVIRONMENT_STATE=${resolution.policyState}`,
        `ANALYZER_INSTALLATION_MODE=${resolution.installationMode}`,
        `ANALYZER_MYTHRIL_IMAGE=${resolution.mythrilImage ?? ''}`,
        `ANALYZER_PYTHON_VERSION=${resolution.pythonVersion}`,
        `ANALYZER_SEMGREP_LOCK_SHA256=${resolution.lockSha256[analyzerEnvironmentLockPaths[0]] ?? ''}`,
        `ANALYZER_SLITHER_LOCK_SHA256=${resolution.lockSha256[analyzerEnvironmentLockPaths[1]] ?? ''}`,
        '',
      ].join('\n'),
      { encoding: 'utf8', mode: 0o600 },
    );
    return;
  }
  process.stdout.write(deterministicJson(resolution));
}

main().catch((error) => {
  process.stderr.write(
    `Analyzer environment resolution failed: ${error instanceof Error ? error.message : String(error)}\n${usage()}\n`,
  );
  process.exitCode = 1;
});
