#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONTRACTS_DIR = path.dirname(AUDIT_DIR);
const DEFAULT_LOCK_PATH = path.join(AUDIT_DIR, 'toolchain.lock');
const DEFAULT_REPORT_PATH = path.join(AUDIT_DIR, 'reports', 'tool-versions.json');
const ECHIDNA_REPOSITORY = 'ghcr.io/crytic/echidna/echidna';
const MYTHRIL_REPOSITORY = 'mythril/myth';

const REQUIRED_LOCK_KEYS = [
  'ANALYZER_LOCK_CUTOFF',
  'ADERYN_DARWIN_ARM64_SHA256',
  'ADERYN_LINUX_X86_64_SHA256',
  'ADERYN_VERSION',
  'ECHIDNA_IMAGE_DIGEST',
  'ECHIDNA_VERSION',
  'FOUNDRY_VERSION',
  'GITLEAKS_DARWIN_ARM64_SHA256',
  'GITLEAKS_LINUX_X86_64_SHA256',
  'GITLEAKS_VERSION',
  'MEDUSA_VERSION',
  'MYTHRIL_IMAGE_DIGEST',
  'MYTHRIL_VERSION',
  'PIPX_VERSION',
  'PNPM_VERSION',
  'SEMGREP_VERSION',
  'SLITHER_VERSION',
  'SOLC_LONG_VERSION',
  'SOLHINT_VERSION',
  'SOLIDITY_VERSION',
  'UV_DARWIN_ARM64_SHA256',
  'UV_LINUX_X86_64_SHA256',
  'UV_VERSION',
];

const VERSION_KEY_PATTERN = /^\d+\.\d+\.\d+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const IMAGE_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

function usage() {
  return [
    'Usage: node audit/verify-toolchain.mjs <static|nightly> [--artifacts]',
    '       [--contracts-dir PATH] [--lock PATH] [--report PATH]',
  ].join('\n');
}

function parseArguments(argv) {
  let profile;
  let artifacts = false;
  let contractsDir = DEFAULT_CONTRACTS_DIR;
  let lockPath = DEFAULT_LOCK_PATH;
  let reportPath = DEFAULT_REPORT_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === 'static' || argument === 'nightly') {
      if (profile !== undefined) {
        throw new Error('The verification profile may only be provided once.');
      }
      profile = argument;
      continue;
    }
    if (argument === '--artifacts') {
      artifacts = true;
      continue;
    }
    if (['--contracts-dir', '--lock', '--report'].includes(argument)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${argument} requires a path.`);
      }
      index += 1;
      const resolved = path.resolve(value);
      if (argument === '--contracts-dir') contractsDir = resolved;
      if (argument === '--lock') lockPath = resolved;
      if (argument === '--report') reportPath = resolved;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (profile === undefined) {
    throw new Error('A static or nightly verification profile is required.');
  }

  return { artifacts, contractsDir, lockPath, profile, reportPath };
}

function parseLock(contents) {
  const entries = {};
  for (const [index, rawLine] of contents.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const match = /^([A-Z][A-Z0-9_]*)=(\S+)$/u.exec(line);
    if (match === null) {
      throw new Error(`Malformed toolchain lock entry on line ${index + 1}.`);
    }
    const [, key, value] = match;
    if (Object.hasOwn(entries, key)) {
      throw new Error(`Duplicate toolchain lock entry: ${key}.`);
    }
    entries[key] = value;
  }

  for (const key of REQUIRED_LOCK_KEYS) {
    if (!Object.hasOwn(entries, key)) {
      throw new Error(`Missing required toolchain lock entry: ${key}.`);
    }
  }

  for (const key of [
    'ADERYN_VERSION',
    'ECHIDNA_VERSION',
    'FOUNDRY_VERSION',
    'GITLEAKS_VERSION',
    'MEDUSA_VERSION',
    'MYTHRIL_VERSION',
    'PIPX_VERSION',
    'PNPM_VERSION',
    'SEMGREP_VERSION',
    'SLITHER_VERSION',
    'SOLHINT_VERSION',
    'SOLIDITY_VERSION',
    'UV_VERSION',
  ]) {
    if (!VERSION_KEY_PATTERN.test(entries[key])) {
      throw new Error(`Toolchain lock entry ${key} must be an exact semantic version.`);
    }
  }
  for (const key of [
    'ADERYN_DARWIN_ARM64_SHA256',
    'ADERYN_LINUX_X86_64_SHA256',
    'GITLEAKS_DARWIN_ARM64_SHA256',
    'GITLEAKS_LINUX_X86_64_SHA256',
    'UV_DARWIN_ARM64_SHA256',
    'UV_LINUX_X86_64_SHA256',
  ]) {
    if (!SHA256_PATTERN.test(entries[key])) {
      throw new Error(`Toolchain lock entry ${key} must be a lowercase SHA-256 checksum.`);
    }
  }
  for (const key of ['ECHIDNA_IMAGE_DIGEST', 'MYTHRIL_IMAGE_DIGEST']) {
    if (!IMAGE_DIGEST_PATTERN.test(entries[key])) {
      throw new Error(`${key} must be a complete lowercase sha256 digest.`);
    }
  }
  if (entries.SOLC_LONG_VERSION !== `${entries.SOLIDITY_VERSION}+commit.8a97fa7a`) {
    throw new Error('SOLC_LONG_VERSION must identify the pinned Solidity compiler build.');
  }
  if (!/^\d{4}-\d{2}-\d{2}T00:00:00Z$/.test(entries.ANALYZER_LOCK_CUTOFF)) {
    throw new Error('ANALYZER_LOCK_CUTOFF must be a UTC day boundary.');
  }

  return entries;
}

function runCommand(command, args, { cwd, label, stdoutOnly = false, timeout = 30_000 }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
      NO_COLOR: '1',
      SEMGREP_SEND_METRICS: 'off',
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout,
  });

  if (result.error !== undefined) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`Required tool is unavailable: ${label}.`);
    }
    throw new Error(`Could not execute ${label}: ${result.error.message}`);
  }
  if (result.signal !== null) {
    throw new Error(`${label} terminated with signal ${result.signal}.`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} exited with status ${String(result.status)}.`);
  }

  const output = stdoutOnly ? (result.stdout ?? '') : `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const ansiSgrPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'gu');
  return output.replaceAll(ansiSgrPattern, '').trim();
}

function parseObservedVersion(tool, output) {
  const namedPatterns = {
    aderyn: /\baderyn(?:\s+version)?\s*:?[-\s]+v?(\d+\.\d+\.\d+)\b/iu,
    echidna: /\bechidna(?:\s+version)?\s*:?[-\s]+v?(\d+\.\d+\.\d+)\b/iu,
    forge: /\bforge\s+Version:\s*v?(\d+\.\d+\.\d+)\b/iu,
    gitleaks: /\bgitleaks(?:\s+version)?\s*:?[-\s]+v?(\d+\.\d+\.\d+)\b/iu,
    medusa: /\bmedusa(?:\s+version)?\s*:?[-\s]+v?(\d+\.\d+\.\d+)\b/iu,
    mythril: /\bmythril(?:\s+version)?\s*:?[-\s]+v?(\d+\.\d+\.\d+)\b/iu,
  };

  const namedMatch = namedPatterns[tool]?.exec(output);
  if (namedMatch !== undefined && namedMatch !== null) return namedMatch[1];

  for (const line of output.split(/\r?\n/u)) {
    const exactMatch = /^v?(\d+\.\d+\.\d+)(?:[-+][0-9A-Za-z.-]+)?$/u.exec(line.trim());
    if (exactMatch !== null) return exactMatch[1];
  }

  throw new Error(`Could not parse ${tool} version output.`);
}

async function resolveSolhint(contractsDir) {
  const localSolhint = path.join(contractsDir, 'node_modules', '.bin', 'solhint');
  try {
    await access(localSolhint, constants.X_OK);
    return localSolhint;
  } catch {
    return 'solhint';
  }
}

async function verifyToolVersions(profile, lock, contractsDir) {
  const solhint = await resolveSolhint(contractsDir);
  const specifications = [
    { args: ['--version'], command: 'aderyn', key: 'ADERYN_VERSION', name: 'aderyn' },
    { args: ['--version'], command: 'forge', key: 'FOUNDRY_VERSION', name: 'forge' },
    { args: ['version'], command: 'gitleaks', key: 'GITLEAKS_VERSION', name: 'gitleaks' },
    { args: ['--version'], command: 'pnpm', key: 'PNPM_VERSION', name: 'pnpm' },
    { args: ['--version'], command: 'semgrep', key: 'SEMGREP_VERSION', name: 'semgrep' },
    { args: ['--version'], command: 'slither', key: 'SLITHER_VERSION', name: 'slither' },
    { args: ['--version'], command: solhint, key: 'SOLHINT_VERSION', name: 'solhint' },
  ];
  if (profile === 'nightly') {
    specifications.push({ args: ['--version'], command: 'medusa', key: 'MEDUSA_VERSION', name: 'medusa' });
  }

  const evidence = [];
  for (const specification of specifications.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const output = runCommand(specification.command, specification.args, {
      cwd: contractsDir,
      label: specification.name,
    });
    const observedVersion = parseObservedVersion(specification.name, output);
    const expectedVersion = lock[specification.key];
    if (observedVersion !== expectedVersion) {
      throw new Error(
        `${specification.name} version mismatch: expected ${expectedVersion}, observed ${observedVersion}.`,
      );
    }
    evidence.push({ expectedVersion, name: specification.name, observedVersion });
  }

  return evidence;
}

function verifyFoundryConfig(lock, contractsDir) {
  const output = runCommand('forge', ['config', '--json'], {
    cwd: contractsDir,
    label: 'forge config',
    stdoutOnly: true,
  });
  let config;
  try {
    config = JSON.parse(output);
  } catch {
    throw new Error('forge config did not return valid JSON.');
  }

  const observed = {
    artifactOutput: config.out,
    evmVersion: config.evm_version,
    optimizerEnabled: config.optimizer,
    optimizerRuns: config.optimizer_runs,
    solcVersion: config.solc,
  };
  const expected = {
    evmVersion: 'cancun',
    optimizerEnabled: true,
    optimizerRuns: 10_000,
    solcVersion: lock.SOLIDITY_VERSION,
  };

  for (const key of Object.keys(expected)) {
    if (observed[key] !== expected[key]) {
      throw new Error(
        `Foundry config mismatch for ${key}: expected ${String(expected[key])}, observed ${String(observed[key])}.`,
      );
    }
  }

  return { expected, observed };
}

async function listJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }
  return files;
}

function normalizeMetadata(value, relativePath) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Artifact ${relativePath} contains malformed compiler metadata.`);
  }
}

async function verifyProductionArtifacts(contractsDir, outSetting, compilerVersion) {
  if (typeof outSetting !== 'string' || outSetting.trim() === '') {
    throw new Error('Foundry config did not provide an artifact output directory.');
  }
  const outputDirectory = path.resolve(contractsDir, outSetting);
  let jsonFiles;
  try {
    jsonFiles = await listJsonFiles(outputDirectory);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Artifact output directory does not exist: ${outSetting}.`);
    }
    throw error;
  }

  const artifacts = [];
  for (const artifactPath of jsonFiles) {
    const relativePath = path.relative(contractsDir, artifactPath).split(path.sep).join('/');
    const outputRelativePath = path.relative(outputDirectory, artifactPath).split(path.sep).join('/');
    if (outputRelativePath.startsWith('build-info/')) continue;
    let artifact;
    try {
      artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
    } catch {
      throw new Error(`Artifact ${relativePath} is not valid JSON.`);
    }
    const metadata = normalizeMetadata(artifact.metadata, relativePath);
    const targets = Object.keys(metadata?.settings?.compilationTarget ?? {});
    const productionTargets = targets.filter((target) => target.startsWith('src/') || target.startsWith('./src/'));
    if (productionTargets.length === 0) continue;

    const observedVersion = metadata?.compiler?.version;
    if (observedVersion !== compilerVersion) {
      throw new Error(
        `Production artifact ${relativePath} compiler mismatch: expected ${compilerVersion}, observed ${String(observedVersion)}.`,
      );
    }
    artifacts.push({
      artifact: relativePath,
      compilerVersion: observedVersion,
      sources: productionTargets.toSorted(),
    });
  }

  if (artifacts.length === 0) {
    throw new Error('No production Solidity artifacts were found under the configured output directory.');
  }

  return { checked: true, count: artifacts.length, productionArtifacts: artifacts };
}

function verifyEchidnaContainer(lock, contractsDir) {
  const reference = `${ECHIDNA_REPOSITORY}:v${lock.ECHIDNA_VERSION}@${lock.ECHIDNA_IMAGE_DIGEST}`;
  const inspectOutput = runCommand('docker', ['image', 'inspect', reference, '--format', '{{json .RepoDigests}}'], {
    cwd: contractsDir,
    label: 'Echidna container image',
    stdoutOnly: true,
    timeout: 60_000,
  });
  let repoDigests;
  try {
    repoDigests = JSON.parse(inspectOutput);
  } catch {
    throw new Error('Docker did not return valid RepoDigests evidence for the Echidna image.');
  }
  if (
    !Array.isArray(repoDigests) ||
    !repoDigests.some(
      (repoDigest) => typeof repoDigest === 'string' && repoDigest.endsWith(`@${lock.ECHIDNA_IMAGE_DIGEST}`),
    )
  ) {
    throw new Error('The local Echidna image does not match the pinned immutable digest.');
  }

  const output = runCommand('docker', ['run', '--rm', '--platform', 'linux/amd64', reference, 'echidna', '--version'], {
    cwd: contractsDir,
    label: 'Echidna container runtime',
    timeout: 120_000,
  });
  const observedVersion = parseObservedVersion('echidna', output);
  if (observedVersion !== lock.ECHIDNA_VERSION) {
    throw new Error(`echidna version mismatch: expected ${lock.ECHIDNA_VERSION}, observed ${observedVersion}.`);
  }

  return {
    digest: lock.ECHIDNA_IMAGE_DIGEST,
    expectedVersion: lock.ECHIDNA_VERSION,
    observedVersion,
    reference,
    runtimeVerified: true,
  };
}

function verifyMythrilContainer(lock, contractsDir) {
  const reference = `${MYTHRIL_REPOSITORY}:${lock.MYTHRIL_VERSION}@${lock.MYTHRIL_IMAGE_DIGEST}`;
  const inspectOutput = runCommand('docker', ['image', 'inspect', reference, '--format', '{{json .RepoDigests}}'], {
    cwd: contractsDir,
    label: 'Mythril container image',
    stdoutOnly: true,
    timeout: 60_000,
  });
  let repoDigests;
  try {
    repoDigests = JSON.parse(inspectOutput);
  } catch {
    throw new Error('Docker did not return valid RepoDigests evidence for the Mythril image.');
  }
  if (
    !Array.isArray(repoDigests) ||
    !repoDigests.some(
      (repoDigest) => typeof repoDigest === 'string' && repoDigest.endsWith(`@${lock.MYTHRIL_IMAGE_DIGEST}`),
    )
  ) {
    throw new Error('The local Mythril image does not match the pinned immutable digest.');
  }

  const output = runCommand('docker', ['run', '--rm', '--platform', 'linux/amd64', reference, 'version'], {
    cwd: contractsDir,
    label: 'Mythril container runtime',
    timeout: 120_000,
  });
  const observedVersion = parseObservedVersion('mythril', output);
  if (observedVersion !== lock.MYTHRIL_VERSION) {
    throw new Error(`mythril version mismatch: expected ${lock.MYTHRIL_VERSION}, observed ${observedVersion}.`);
  }

  return {
    digest: lock.MYTHRIL_IMAGE_DIGEST,
    expectedVersion: lock.MYTHRIL_VERSION,
    observedVersion,
    reference,
    runtimeVerified: true,
  };
}

async function verify(options) {
  await rm(options.reportPath, { force: true });

  const lockContents = await readFile(options.lockPath, 'utf8');
  const lock = parseLock(lockContents);
  const tools = await verifyToolVersions(options.profile, lock, options.contractsDir);
  const foundry = verifyFoundryConfig(lock, options.contractsDir);
  const artifacts = options.artifacts
    ? await verifyProductionArtifacts(options.contractsDir, foundry.observed.artifactOutput, lock.SOLC_LONG_VERSION)
    : { checked: false };
  const echidna =
    options.profile === 'nightly'
      ? verifyEchidnaContainer(lock, options.contractsDir)
      : {
          digest: lock.ECHIDNA_IMAGE_DIGEST,
          expectedVersion: lock.ECHIDNA_VERSION,
          reference: `${ECHIDNA_REPOSITORY}:v${lock.ECHIDNA_VERSION}@${lock.ECHIDNA_IMAGE_DIGEST}`,
          runtimeVerified: false,
        };
  const mythril =
    options.profile === 'nightly'
      ? verifyMythrilContainer(lock, options.contractsDir)
      : {
          digest: lock.MYTHRIL_IMAGE_DIGEST,
          expectedVersion: lock.MYTHRIL_VERSION,
          reference: `${MYTHRIL_REPOSITORY}:${lock.MYTHRIL_VERSION}@${lock.MYTHRIL_IMAGE_DIGEST}`,
          runtimeVerified: false,
        };

  const report = {
    artifacts,
    echidna,
    foundry,
    lockSha256: createHash('sha256').update(lockContents).digest('hex'),
    mythril,
    profile: options.profile,
    schemaVersion: 1,
    tools,
  };
  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
    const report = await verify(options);
    process.stdout.write(
      `Verified ${report.tools.length} pinned tools for the ${report.profile} profile; evidence: ${options.reportPath}\n`,
    );
  } catch (error) {
    process.stderr.write(`Toolchain verification failed: ${error.message}\n`);
    if (options === undefined) process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
