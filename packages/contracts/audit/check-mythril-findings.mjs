#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MYTHRIL_ANALYSIS = Object.freeze({
  bytecodeResolution: 'require-constructor-resolved-no-link-or-immutable-references',
  executionTimeoutSeconds: 600,
  inputMode: 'deployed-runtime-bytecode',
  onchainData: 'disabled',
  opcodeCompatibility: 'reject-cancun-opcodes-0x49-0x4a-0x5c-0x5d-0x5e',
  outform: 'jsonv2',
  transactionCount: 3,
});

const MYTHRIL_INCOMPATIBLE_RUNTIME_OPCODES = new Map([
  [0x49, 'BLOBHASH'],
  [0x4a, 'BLOBBASEFEE'],
  [0x5c, 'TLOAD'],
  [0x5d, 'TSTORE'],
  [0x5e, 'MCOPY'],
]);

export const REQUIRED_MYTHRIL_TARGETS = Object.freeze(
  [
    ['GBX', 'out/GBX.sol/GBX.json'],
    ['Mine', 'out/Mine.sol/Mine.json'],
    ['SignalGBX', 'out/SignalGBX.sol/SignalGBX.json'],
    ['ResonanceRouter', 'out/ResonanceRouter.sol/ResonanceRouter.json'],
    ['Resonance', 'out/Resonance.sol/Resonance.json'],
    ['StrategyFactory', 'out/StrategyFactory.sol/StrategyFactory.json'],
    ['Strategy', 'out/Strategy.sol/Strategy.json'],
    ['BribeFactory', 'out/BribeFactory.sol/BribeFactory.json'],
    ['BribeRouter', 'out/BribeRouter.sol/BribeRouter.json'],
    ['Bribe', 'out/Bribe.sol/Bribe.json'],
    ['Fund', 'out/Fund.sol/Fund.json'],
    ['LiquidityPosition', 'out/LiquidityPosition.sol/LiquidityPosition.json'],
  ].map(([contract, artifact]) => Object.freeze({ artifact, contract })),
);

const POLICY_KIND = 'gumball-6900-mythril-policy';
const MANIFEST_KIND = 'gumball-6900-mythril-run-manifest';
const SUMMARY_KIND = 'gumball-6900-mythril-summary';
const SCHEMA_VERSION = 1;
const MAX_ERROR_LENGTH = 4_096;

function fail(message) {
  throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireExactKeys(value, expected, label) {
  if (!isObject(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} must contain exactly these fields: ${wanted.join(', ')}`);
  }
}

function parseJson(label, source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedRelativePath(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    isAbsolute(value) ||
    posix.normalize(value) !== value ||
    value === '.' ||
    value.startsWith('../')
  ) {
    fail(`${label} must be a normalized repository-relative POSIX path`);
  }
  return value;
}

function pathIsWithin(root, candidate) {
  const child = relative(root, candidate);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child));
}

async function requiredRegularFile(root, relativePath, label) {
  const normalized = normalizedRelativePath(relativePath, label);
  const rootPath = await realpath(root);
  const candidate = resolve(rootPath, ...normalized.split('/'));
  if (!pathIsWithin(rootPath, candidate)) fail(`${label} escapes the contracts directory`);

  let stats;
  try {
    stats = await lstat(candidate);
  } catch (error) {
    fail(`${label} is unavailable at ${normalized}: ${error.message}`);
  }
  if (stats.isSymbolicLink() || !stats.isFile()) fail(`${label} must be a nonsymlink regular file: ${normalized}`);
  const canonical = await realpath(candidate);
  if (!pathIsWithin(rootPath, canonical)) fail(`${label} resolves outside the contracts directory`);
  return candidate;
}

function validateAnalysis(value, label) {
  requireExactKeys(
    value,
    [
      'bytecodeResolution',
      'executionTimeoutSeconds',
      'inputMode',
      'onchainData',
      'opcodeCompatibility',
      'outform',
      'transactionCount',
    ],
    label,
  );
  for (const [key, expected] of Object.entries(MYTHRIL_ANALYSIS)) {
    if (value[key] !== expected) fail(`${label}.${key} must equal ${JSON.stringify(expected)}`);
  }
}

export function validateMythrilPolicy(policy) {
  requireExactKeys(
    policy,
    ['acceptedFindings', 'analysis', 'expectedTargets', 'kind', 'schemaVersion', 'state'],
    'Mythril policy',
  );
  if (policy.kind !== POLICY_KIND || policy.schemaVersion !== SCHEMA_VERSION) {
    fail('Mythril policy has the wrong kind or schemaVersion');
  }
  if (policy.state !== 'zero-findings-required') fail('Mythril policy state must be zero-findings-required');
  validateAnalysis(policy.analysis, 'Mythril policy analysis');
  if (!Array.isArray(policy.acceptedFindings) || policy.acceptedFindings.length !== 0) {
    fail('Mythril zero-findings policy acceptedFindings must remain an empty array');
  }
  if (!Array.isArray(policy.expectedTargets) || policy.expectedTargets.length !== REQUIRED_MYTHRIL_TARGETS.length) {
    fail(`Mythril policy must contain exactly ${REQUIRED_MYTHRIL_TARGETS.length} expected targets`);
  }
  for (const [index, expected] of REQUIRED_MYTHRIL_TARGETS.entries()) {
    const target = policy.expectedTargets[index];
    requireExactKeys(target, ['artifact', 'contract'], `Mythril policy target ${index}`);
    if (target.contract !== expected.contract || target.artifact !== expected.artifact) {
      fail(
        `Mythril policy target ${index} must be ${expected.contract} at ${expected.artifact}; received ${String(
          target.contract,
        )} at ${String(target.artifact)}`,
      );
    }
    normalizedRelativePath(target.artifact, `Mythril policy target ${target.contract} artifact`);
  }
  return policy;
}

function expectedReportPath(contract) {
  return `audit/reports/mythril-${contract}.json`;
}

function expectedStderrPath(contract) {
  return `audit/reports/mythril-${contract}.stderr.txt`;
}

function validateManifest(manifest, policy) {
  requireExactKeys(manifest, ['analysis', 'kind', 'schemaVersion', 'targets'], 'Mythril run manifest');
  if (manifest.kind !== MANIFEST_KIND || manifest.schemaVersion !== SCHEMA_VERSION) {
    fail('Mythril run manifest has the wrong kind or schemaVersion');
  }
  validateAnalysis(manifest.analysis, 'Mythril run manifest analysis');
  if (!Array.isArray(manifest.targets) || manifest.targets.length !== policy.expectedTargets.length) {
    fail(`Mythril run manifest must contain exactly ${policy.expectedTargets.length} expected targets`);
  }

  for (const [index, expected] of policy.expectedTargets.entries()) {
    const target = manifest.targets[index];
    requireExactKeys(
      target,
      ['artifact', 'bytecodeSha256', 'contract', 'exitCode', 'launchError', 'report', 'signal', 'stderr'],
      `Mythril run target ${index}`,
    );
    if (target.contract !== expected.contract || target.artifact !== expected.artifact) {
      fail(`Mythril run target ${index} does not match expected target ${expected.contract}`);
    }
    if (target.report !== expectedReportPath(expected.contract)) {
      fail(`Mythril run target ${expected.contract} has an unexpected stdout report path`);
    }
    if (target.stderr !== expectedStderrPath(expected.contract)) {
      fail(`Mythril run target ${expected.contract} has an unexpected stderr report path`);
    }
    normalizedRelativePath(target.artifact, `Mythril target ${expected.contract} artifact`);
    normalizedRelativePath(target.report, `Mythril target ${expected.contract} report`);
    normalizedRelativePath(target.stderr, `Mythril target ${expected.contract} stderr`);
    if (typeof target.bytecodeSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(target.bytecodeSha256)) {
      fail(`Mythril target ${expected.contract} has a malformed bytecodeSha256`);
    }
    if (
      target.exitCode !== null &&
      (!Number.isInteger(target.exitCode) || target.exitCode < 0 || target.exitCode > 255)
    ) {
      fail(`Mythril target ${expected.contract} has a malformed exitCode`);
    }
    if (target.signal !== null && (typeof target.signal !== 'string' || target.signal.length === 0)) {
      fail(`Mythril target ${expected.contract} has a malformed signal`);
    }
    if (target.launchError !== null && (typeof target.launchError !== 'string' || target.launchError.length === 0)) {
      fail(`Mythril target ${expected.contract} has a malformed launchError`);
    }
  }
  return manifest;
}

function bytecodeBytes(value, label) {
  if (typeof value !== 'string' || !/^0x(?:[a-fA-F0-9]{2})+$/.test(value)) {
    fail(`${label} must be nonempty hexadecimal bytecode`);
  }
  return Buffer.from(value.slice(2), 'hex');
}

export function hashDeployedBytecode(value) {
  return sha256(bytecodeBytes(value, 'Deployed bytecode'));
}

export function findMythrilIncompatibleRuntimeOpcodes(value) {
  const bytes = bytecodeBytes(value, 'Deployed bytecode');
  const incompatible = [];
  for (let pc = 0; pc < bytes.length; pc += 1) {
    const opcode = bytes[pc];
    const name = MYTHRIL_INCOMPATIBLE_RUNTIME_OPCODES.get(opcode);
    if (name !== undefined) {
      incompatible.push({ name, opcode: `0x${opcode.toString(16).padStart(2, '0')}`, pc });
    }
    if (opcode >= 0x60 && opcode <= 0x7f) pc += opcode - 0x5f;
  }
  return incompatible;
}

function normalizedReferenceSpans(value, bytecodeLength, label) {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must contain at least one bytecode span`);
  return value
    .map((span, index) => {
      requireExactKeys(span, ['length', 'start'], `${label} span ${index}`);
      if (
        !Number.isSafeInteger(span.start) ||
        !Number.isSafeInteger(span.length) ||
        span.start < 0 ||
        span.length <= 0 ||
        span.start + span.length > bytecodeLength
      ) {
        fail(`${label} span ${index} is outside the deployed-bytecode template`);
      }
      return { length: span.length, start: span.start };
    })
    .toSorted((left, right) => left.start - right.start || left.length - right.length);
}

function immutableReferenceEvidence(value, bytecodeLength, label) {
  // Foundry 1.7.1 serializes an absent immutable-reference map as null for contracts with no immutables.
  if (value === null || value === undefined) return [];
  if (!isObject(value)) fail(`${label} must be an object`);
  return Object.entries(value)
    .map(([id, spans]) => ({
      id,
      spans: normalizedReferenceSpans(spans, bytecodeLength, `${label}.${id}`),
    }))
    .toSorted((left, right) => left.id.localeCompare(right.id));
}

function linkReferenceEvidence(value, bytecodeLength, label) {
  if (value === null || value === undefined) return [];
  if (!isObject(value)) fail(`${label} must be an object`);
  const references = [];
  for (const [source, libraries] of Object.entries(value)) {
    if (!isObject(libraries) || Object.keys(libraries).length === 0) {
      fail(`${label}.${source} must identify at least one linked library`);
    }
    for (const [library, spans] of Object.entries(libraries)) {
      references.push({
        library,
        source,
        spans: normalizedReferenceSpans(spans, bytecodeLength, `${label}.${source}.${library}`),
      });
    }
  }
  return references.toSorted((left, right) =>
    `${left.source}|${left.library}`.localeCompare(`${right.source}|${right.library}`),
  );
}

function compilationTarget(metadata, label) {
  let parsed = metadata;
  if (typeof metadata === 'string') parsed = parseJson(`${label} metadata`, metadata);
  const targets = parsed?.settings?.compilationTarget;
  if (!isObject(targets)) fail(`${label} lacks metadata.settings.compilationTarget`);
  return Object.entries(targets);
}

async function readArtifact(target, contractsDirectory) {
  const artifactPath = await requiredRegularFile(
    contractsDirectory,
    target.artifact,
    `Mythril target ${target.contract} artifact`,
  );
  const artifactBytes = await readFile(artifactPath);
  const artifact = parseJson(`Mythril target ${target.contract} artifact`, artifactBytes.toString('utf8'));
  const targets = compilationTarget(artifact.metadata, `Mythril target ${target.contract} artifact`);
  if (targets.length !== 1 || targets[0][1] !== target.contract) {
    fail(`Mythril artifact ${target.artifact} does not compile exactly target ${target.contract}`);
  }
  if (!isObject(artifact.deployedBytecode)) {
    fail(`Mythril target ${target.contract} artifact lacks deployedBytecode`);
  }
  const bytes = bytecodeBytes(
    artifact.deployedBytecode.object,
    `Mythril target ${target.contract} artifact deployed bytecode`,
  );
  return {
    bytecode: artifact.deployedBytecode.object,
    bytecodeBytes: bytes.length,
    bytecodeSha256: sha256(bytes),
    immutableReferences: immutableReferenceEvidence(
      artifact.deployedBytecode.immutableReferences,
      bytes.length,
      `Mythril target ${target.contract} immutableReferences`,
    ),
    incompatibleOpcodes: findMythrilIncompatibleRuntimeOpcodes(artifact.deployedBytecode.object),
    linkReferences: linkReferenceEvidence(
      artifact.deployedBytecode.linkReferences,
      bytes.length,
      `Mythril target ${target.contract} linkReferences`,
    ),
  };
}

function validateIssue(issue, contract, index) {
  const label = `Mythril target ${contract} issue ${index}`;
  if (!isObject(issue)) fail(`${label} must be an object`);
  if (typeof issue.swcID !== 'string' || !/^SWC-[0-9]+$/.test(issue.swcID)) {
    fail(`${label} has a malformed swcID`);
  }
  if (typeof issue.swcTitle !== 'string' || issue.swcTitle.length === 0) fail(`${label} lacks a swcTitle`);
  if (typeof issue.severity !== 'string' || issue.severity.length === 0) fail(`${label} lacks a severity`);
  if (
    !isObject(issue.description) ||
    typeof issue.description.head !== 'string' ||
    typeof issue.description.tail !== 'string'
  ) {
    fail(`${label} has a malformed description`);
  }
  if (!Array.isArray(issue.locations) || issue.locations.length === 0) fail(`${label} lacks a source location`);
  for (const location of issue.locations) {
    if (
      !isObject(location) ||
      typeof location.sourceMap !== 'string' ||
      !/^-?[0-9]+:[0-9]+:-?[0-9]+$/.test(location.sourceMap)
    ) {
      fail(`${label} has a malformed sourceMap`);
    }
  }
  if (!isObject(issue.extra)) fail(`${label} lacks Mythril issue metadata`);
}

function validateJsonV2(document, contract) {
  if (!Array.isArray(document) || document.length !== 1 || !isObject(document[0])) {
    fail(`Mythril target ${contract} report must be a one-element JSONV2 array`);
  }
  const result = document[0];
  if (!Array.isArray(result.issues)) fail(`Mythril target ${contract} report lacks an issues array`);
  if (!isObject(result.meta)) fail(`Mythril target ${contract} report lacks meta`);

  if (result.meta.logs !== undefined) {
    if (!Array.isArray(result.meta.logs)) fail(`Mythril target ${contract} report has malformed meta.logs`);
    for (const [index, log] of result.meta.logs.entries()) {
      if (!isObject(log) || typeof log.level !== 'string' || typeof log.msg !== 'string') {
        fail(`Mythril target ${contract} report has malformed meta.logs entry ${index}`);
      }
      if (log.level.toLowerCase() === 'error') {
        fail(`Mythril target ${contract} report contains Mythril error log: ${log.msg}`);
      }
    }
  }

  if (result.sourceType !== 'raw-bytecode') {
    fail(`Mythril target ${contract} report sourceType must be raw-bytecode`);
  }
  if (result.sourceFormat !== 'evm-byzantium-bytecode') {
    fail(`Mythril target ${contract} report sourceFormat must be evm-byzantium-bytecode`);
  }
  if (
    !Array.isArray(result.sourceList) ||
    result.sourceList.length === 0 ||
    !result.sourceList.every((entry) => typeof entry === 'string' && entry.length > 0)
  ) {
    fail(`Mythril target ${contract} report has malformed sourceList`);
  }
  const executionInfo = result.meta.mythril_execution_info;
  if (
    !isObject(executionInfo) ||
    !Number.isSafeInteger(executionInfo.analysis_duration) ||
    executionInfo.analysis_duration < 0
  ) {
    fail(`Mythril target ${contract} report lacks successful execution metadata`);
  }
  result.issues.forEach((issue, index) => validateIssue(issue, contract, index));
  return { analysisDurationNanoseconds: executionInfo.analysis_duration, issueCount: result.issues.length };
}

async function validateTarget(target, contractsDirectory) {
  const artifact = await readArtifact(target, contractsDirectory);
  if (artifact.bytecodeSha256 !== target.bytecodeSha256) {
    fail(
      `Mythril target ${target.contract} bytecode hash ${target.bytecodeSha256} does not match artifact hash ${artifact.bytecodeSha256}`,
    );
  }

  const reportPath = await requiredRegularFile(
    contractsDirectory,
    target.report,
    `Mythril target ${target.contract} stdout report`,
  );
  const stderrPath = await requiredRegularFile(
    contractsDirectory,
    target.stderr,
    `Mythril target ${target.contract} stderr report`,
  );
  const [reportBytes, stderrBytes] = await Promise.all([readFile(reportPath), readFile(stderrPath)]);

  if (target.launchError !== null) fail(`Mythril target ${target.contract} failed to launch: ${target.launchError}`);
  if (target.signal !== null) fail(`Mythril target ${target.contract} terminated from signal ${target.signal}`);
  if (target.exitCode === null) fail(`Mythril target ${target.contract} did not record an exit code`);

  const report = parseJson(`Mythril target ${target.contract} stdout report`, reportBytes.toString('utf8'));
  const reportResult = validateJsonV2(report, target.contract);
  if (target.exitCode !== 0 && target.exitCode !== 1) {
    fail(`Mythril target ${target.contract} exited with operational failure code ${target.exitCode}`);
  }
  if (reportResult.issueCount === 0 && target.exitCode !== 0) {
    fail(`Mythril target ${target.contract} exit-code/report mismatch: zero findings exited ${target.exitCode}`);
  }
  if (reportResult.issueCount > 0 && target.exitCode !== 1) {
    fail(
      `Mythril target ${target.contract} exit-code/report mismatch: ${reportResult.issueCount} findings exited ${target.exitCode}`,
    );
  }
  if (reportResult.issueCount > 0) {
    fail(
      `Mythril target ${target.contract} reported ${reportResult.issueCount} finding(s); zero-findings policy accepts none`,
    );
  }

  return {
    analysisDurationNanoseconds: reportResult.analysisDurationNanoseconds,
    artifact: target.artifact,
    bytecodeBytes: artifact.bytecodeBytes,
    bytecodeSha256: artifact.bytecodeSha256,
    contract: target.contract,
    exitCode: target.exitCode,
    issueCount: reportResult.issueCount,
    report: target.report,
    reportSha256: sha256(reportBytes),
    stderr: target.stderr,
    stderrSha256: sha256(stderrBytes),
  };
}

export async function evaluateMythrilRun({ contractsDirectory, manifest, policy }) {
  validateMythrilPolicy(policy);
  validateManifest(manifest, policy);

  const targets = [];
  const errors = [];
  for (const target of manifest.targets) {
    try {
      targets.push(await validateTarget(target, contractsDirectory));
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (errors.length > 0) fail(`Mythril policy check failed:\n- ${errors.join('\n- ')}`);

  return {
    analysis: { ...MYTHRIL_ANALYSIS },
    kind: SUMMARY_KIND,
    policyState: policy.state,
    schemaVersion: SCHEMA_VERSION,
    success: true,
    targetCount: targets.length,
    targets,
  };
}

async function atomicWriteJson(destination, value) {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = resolve(dirname(destination), `.${destination.split(sep).at(-1)}.${process.pid}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
  await rename(temporary, destination);
}

async function spawnToReports(executable, arguments_, options) {
  const stdoutHandle = await open(options.stdoutPath, 'w', 0o644);
  const stderrHandle = await open(options.stderrPath, 'w', 0o644);
  try {
    const result = await new Promise((resolveResult) => {
      let launchError = null;
      let child;
      try {
        child = spawn(executable, arguments_, {
          cwd: options.cwd,
          stdio: ['ignore', stdoutHandle.fd, stderrHandle.fd],
        });
      } catch (error) {
        resolveResult({ exitCode: null, launchError: String(error.message).slice(0, MAX_ERROR_LENGTH), signal: null });
        return;
      }
      child.once('error', (error) => {
        launchError = String(error.message).slice(0, MAX_ERROR_LENGTH);
      });
      child.once('close', (exitCode, signal) =>
        resolveResult({ exitCode: launchError === null ? exitCode : null, launchError, signal }),
      );
    });
    await Promise.all([stdoutHandle.sync(), stderrHandle.sync()]);
    return result;
  } finally {
    await Promise.all([stdoutHandle.close(), stderrHandle.close()]);
  }
}

function toRepositoryPath(contractsDirectory, absolutePath) {
  return relative(contractsDirectory, absolutePath).split(sep).join('/');
}

async function removeIfPresent(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function writeFailureSummary(summaryPath, error, details = {}) {
  await atomicWriteJson(summaryPath, {
    analysis: { ...MYTHRIL_ANALYSIS },
    ...details,
    error: String(error.message).slice(0, MAX_ERROR_LENGTH),
    kind: SUMMARY_KIND,
    schemaVersion: SCHEMA_VERSION,
    success: false,
  });
}

export async function runMythrilCampaign({ contractsDirectory, mythExecutable = 'myth', policy, reportDirectory }) {
  validateMythrilPolicy(policy);
  const contractsPath = resolve(contractsDirectory);
  const reportPath = resolve(reportDirectory);
  const expectedReportPath = resolve(contractsPath, 'audit', 'reports');
  if (reportPath !== expectedReportPath) fail('Mythril report directory must be contracts/audit/reports');
  await mkdir(reportPath, { recursive: true });
  const reportStats = await lstat(reportPath);
  if (reportStats.isSymbolicLink() || !reportStats.isDirectory()) {
    fail('Mythril report directory must be a nonsymlink directory');
  }

  const manifestPath = resolve(reportPath, 'mythril-run-manifest.json');
  const summaryPath = resolve(reportPath, 'mythril-summary.json');
  const generatedPaths = [manifestPath, summaryPath];
  for (const target of policy.expectedTargets) {
    generatedPaths.push(
      resolve(reportPath, `mythril-${target.contract}.json`),
      resolve(reportPath, `mythril-${target.contract}.stderr.txt`),
    );
  }
  await Promise.all(generatedPaths.map(removeIfPresent));

  const preparedTargets = [];
  for (const target of policy.expectedTargets) {
    preparedTargets.push({ artifact: await readArtifact(target, contractsPath), target });
  }
  const incompatibleTargets = preparedTargets
    .filter(({ artifact }) => artifact.incompatibleOpcodes.length !== 0)
    .map(({ artifact, target }) => ({
      artifact: target.artifact,
      bytecodeSha256: artifact.bytecodeSha256,
      contract: target.contract,
      instructions: artifact.incompatibleOpcodes,
    }));
  const unresolvedRuntimeTargets = preparedTargets
    .filter(({ artifact }) => artifact.immutableReferences.length !== 0 || artifact.linkReferences.length !== 0)
    .map(({ artifact, target }) => ({
      artifact: target.artifact,
      immutableReferences: artifact.immutableReferences,
      linkReferences: artifact.linkReferences,
      templateBytecodeSha256: artifact.bytecodeSha256,
      contract: target.contract,
    }));
  if (incompatibleTargets.length !== 0 || unresolvedRuntimeTargets.length !== 0) {
    const opcodeLocations = incompatibleTargets
      .flatMap(({ contract, instructions }) =>
        instructions.map(({ name, opcode, pc }) => `${contract}:${name}(${opcode})@0x${pc.toString(16)}`),
      )
      .join(', ');
    const unresolvedLocations = unresolvedRuntimeTargets
      .map(
        ({ contract, immutableReferences, linkReferences }) =>
          `${contract}:immutable-ids=${immutableReferences.map(({ id }) => id).join('|') || 'none'};linked-libraries=${
            linkReferences.map(({ library, source }) => `${source}:${library}`).join('|') || 'none'
          }`,
      )
      .join(', ');
    const blockers = [
      unresolvedLocations === '' ? null : `constructor-resolved runtime required (${unresolvedLocations})`,
      opcodeLocations === '' ? null : `unsupported runtime opcodes (${opcodeLocations})`,
    ].filter((value) => value !== null);
    const error = new Error(`Mythril deployed-runtime compatibility blocker: ${blockers.join('; ')}`);
    await writeFailureSummary(summaryPath, error, {
      compatibility: {
        bytecodeResolution: MYTHRIL_ANALYSIS.bytecodeResolution,
        compatible: false,
        incompatibleTargets,
        policy: MYTHRIL_ANALYSIS.opcodeCompatibility,
        unresolvedRuntimeTargets,
      },
    });
    throw error;
  }

  const targets = [];
  for (const { artifact, target } of preparedTargets) {
    const stdoutPath = resolve(reportPath, `mythril-${target.contract}.json`);
    const stderrPath = resolve(reportPath, `mythril-${target.contract}.stderr.txt`);
    const processResult = await spawnToReports(
      mythExecutable,
      [
        'analyze',
        '--code',
        artifact.bytecode,
        '--bin-runtime',
        '--no-onchain-data',
        '--execution-timeout',
        String(policy.analysis.executionTimeoutSeconds),
        '--transaction-count',
        String(policy.analysis.transactionCount),
        '--outform',
        policy.analysis.outform,
      ],
      { cwd: contractsPath, stderrPath, stdoutPath },
    );
    targets.push({
      artifact: target.artifact,
      bytecodeSha256: artifact.bytecodeSha256,
      contract: target.contract,
      exitCode: processResult.exitCode,
      launchError: processResult.launchError,
      report: toRepositoryPath(contractsPath, stdoutPath),
      signal: processResult.signal,
      stderr: toRepositoryPath(contractsPath, stderrPath),
    });
  }

  const manifest = {
    analysis: { ...MYTHRIL_ANALYSIS },
    kind: MANIFEST_KIND,
    schemaVersion: SCHEMA_VERSION,
    targets,
  };
  await atomicWriteJson(manifestPath, manifest);

  try {
    const summary = await evaluateMythrilRun({ contractsDirectory: contractsPath, manifest, policy });
    await atomicWriteJson(summaryPath, summary);
    return summary;
  } catch (error) {
    await writeFailureSummary(summaryPath, error);
    throw error;
  }
}

async function checkArchivedRun(policyPath, manifestPath, contractsDirectory, summaryPath) {
  const [policySource, manifestSource] = await Promise.all([
    readFile(policyPath, 'utf8'),
    readFile(manifestPath, 'utf8'),
  ]);
  const policy = parseJson('Mythril policy', policySource);
  const manifest = parseJson('Mythril run manifest', manifestSource);
  const contractsPath = resolve(contractsDirectory);
  const expectedSummaryPath = resolve(contractsPath, 'audit', 'reports', 'mythril-summary.json');
  if (resolve(summaryPath) !== expectedSummaryPath)
    fail('Mythril summary path must be contracts/audit/reports/mythril-summary.json');
  try {
    const summary = await evaluateMythrilRun({ contractsDirectory: contractsPath, manifest, policy });
    await atomicWriteJson(expectedSummaryPath, summary);
    return summary;
  } catch (error) {
    await writeFailureSummary(expectedSummaryPath, error);
    throw error;
  }
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_[0] === '--run' && arguments_.length === 4) {
    const [, policyPath, contractsDirectory, reportDirectory] = arguments_;
    const policy = parseJson('Mythril policy', await readFile(policyPath, 'utf8'));
    const summary = await runMythrilCampaign({ contractsDirectory, policy, reportDirectory });
    process.stdout.write(`Mythril accepted ${summary.targetCount} targets with zero findings.\n`);
    return;
  }
  if (arguments_.length === 4) {
    const [policyPath, manifestPath, contractsDirectory, summaryPath] = arguments_;
    const summary = await checkArchivedRun(policyPath, manifestPath, contractsDirectory, summaryPath);
    process.stdout.write(`Mythril accepted ${summary.targetCount} archived targets with zero findings.\n`);
    return;
  }
  fail(
    'Usage: check-mythril-findings.mjs --run <policy.json> <contracts-directory> <report-directory> OR <policy.json> <manifest.json> <contracts-directory> <summary.json>',
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
