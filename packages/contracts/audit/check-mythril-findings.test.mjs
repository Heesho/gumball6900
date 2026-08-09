import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MYTHRIL_ANALYSIS,
  REQUIRED_MYTHRIL_TARGETS,
  evaluateMythrilRun,
  findMythrilIncompatibleRuntimeOpcodes,
  runMythrilCampaign,
  validateMythrilPolicy,
} from './check-mythril-findings.mjs';

const auditDirectory = dirname(fileURLToPath(import.meta.url));

function zeroFindingsPolicy() {
  return {
    acceptedFindings: [],
    analysis: { ...MYTHRIL_ANALYSIS },
    expectedTargets: REQUIRED_MYTHRIL_TARGETS.map((target) => ({ ...target })),
    kind: 'gumball-6900-mythril-policy',
    schemaVersion: 1,
    state: 'zero-findings-required',
  };
}

function cleanReport() {
  return [
    {
      issues: [],
      meta: { mythril_execution_info: { analysis_duration: 123_456 } },
      sourceFormat: 'evm-byzantium-bytecode',
      sourceList: ['fixture-bytecode-hash'],
      sourceType: 'raw-bytecode',
    },
  ];
}

function findingReport() {
  const report = cleanReport();
  report[0].issues.push({
    description: { head: 'Synthetic issue', tail: 'Fixture-only issue details.' },
    extra: { discoveryTime: 1 },
    locations: [{ sourceMap: '12:1:-1' }],
    severity: 'High',
    swcID: 'SWC-999',
    swcTitle: 'Synthetic Security Issue',
  });
  return report;
}

function errorReport() {
  return [
    {
      issues: [],
      meta: { logs: [{ hidden: true, level: 'error', msg: 'synthetic analysis failure' }] },
      sourceFormat: '',
      sourceList: [],
      sourceType: '',
    },
  ];
}

async function makeFakeMyth(root, { exitCode, report, stderr = 'synthetic stderr\n' }) {
  const executable = resolve(root, `fake-myth-${Math.random().toString(16).slice(2)}.mjs`);
  const reportText = JSON.stringify(report);
  const source = `#!/usr/bin/env node
const args = process.argv.slice(2);
const valid = args.length === 11 && args[0] === 'analyze' && args[1] === '--code' && /^0x[0-9a-f]+$/i.test(args[2]) && args[3] === '--bin-runtime' && args[4] === '--no-onchain-data' && args[5] === '--execution-timeout' && args[6] === '600' && args[7] === '--transaction-count' && args[8] === '3' && args[9] === '--outform' && args[10] === 'jsonv2';
if (!valid) {
  process.stderr.write('unexpected Mythril invocation\\n');
  process.exitCode = 2;
} else {
  process.stdout.write(${JSON.stringify(reportText)});
  process.stderr.write(${JSON.stringify(stderr)});
  process.exitCode = ${exitCode};
}
`;
  await writeFile(executable, source, 'utf8');
  await chmod(executable, 0o755);
  return executable;
}

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'gumball-mythril-policy-'));
  t.after(async () => rm(root, { force: true, recursive: true }));
  const contractsDirectory = resolve(root, 'contracts');
  const reportDirectory = resolve(contractsDirectory, 'audit', 'reports');
  await mkdir(reportDirectory, { recursive: true });

  for (const [index, target] of REQUIRED_MYTHRIL_TARGETS.entries()) {
    const artifactPath = resolve(contractsDirectory, ...target.artifact.split('/'));
    await mkdir(dirname(artifactPath), { recursive: true });
    await writeFile(
      artifactPath,
      JSON.stringify({
        deployedBytecode: {
          immutableReferences: {},
          linkReferences: {},
          object: `0x60${index.toString(16).padStart(2, '0')}6000`,
        },
        metadata: { settings: { compilationTarget: { [`src/${target.contract}.sol`]: target.contract } } },
      }),
      'utf8',
    );
  }

  return { contractsDirectory, policy: zeroFindingsPolicy(), reportDirectory, root };
}

test('runs and validates all twelve clean Mythril targets while preserving stdout, stderr, and exit codes', async (t) => {
  const current = await fixture(t);
  const mythExecutable = await makeFakeMyth(current.root, { exitCode: 0, report: cleanReport() });
  const summary = await runMythrilCampaign({ ...current, mythExecutable });

  assert.equal(summary.success, true);
  assert.equal(summary.targetCount, 12);
  assert.deepEqual(
    summary.targets.map((target) => target.contract),
    REQUIRED_MYTHRIL_TARGETS.map((target) => target.contract),
  );
  assert.ok(summary.targets.every((target) => target.exitCode === 0 && target.issueCount === 0));
  assert.ok(summary.targets.every((target) => /^[a-f0-9]{64}$/.test(target.bytecodeSha256)));

  const manifest = JSON.parse(await readFile(resolve(current.reportDirectory, 'mythril-run-manifest.json'), 'utf8'));
  assert.ok(manifest.targets.every((target) => target.exitCode === 0));
  assert.ok(manifest.targets.every((target) => target.launchError === null && target.signal === null));
  for (const target of REQUIRED_MYTHRIL_TARGETS) {
    assert.equal(
      await readFile(resolve(current.reportDirectory, `mythril-${target.contract}.json`), 'utf8'),
      JSON.stringify(cleanReport()),
    );
    assert.equal(
      await readFile(resolve(current.reportDirectory, `mythril-${target.contract}.stderr.txt`), 'utf8'),
      'synthetic stderr\n',
    );
  }
});

test('runtime opcode scan skips PUSH data and blocks Cancun opcodes that Mythril 0.24.8 misinterprets', () => {
  assert.deepEqual(findMythrilIncompatibleRuntimeOpcodes('0x6049604a605c605d605e00'), []);
  assert.deepEqual(findMythrilIncompatibleRuntimeOpcodes('0x495c5d5e4a00'), [
    { name: 'BLOBHASH', opcode: '0x49', pc: 0 },
    { name: 'TLOAD', opcode: '0x5c', pc: 1 },
    { name: 'TSTORE', opcode: '0x5d', pc: 2 },
    { name: 'MCOPY', opcode: '0x5e', pc: 3 },
    { name: 'BLOBBASEFEE', opcode: '0x4a', pc: 4 },
  ]);
});

test('accepts Foundry 1.7 null or omitted reference maps as empty reference sets', async (t) => {
  const current = await fixture(t);
  for (const target of REQUIRED_MYTHRIL_TARGETS) {
    const artifactPath = resolve(current.contractsDirectory, ...target.artifact.split('/'));
    const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
    artifact.deployedBytecode.immutableReferences = null;
    delete artifact.deployedBytecode.linkReferences;
    await writeFile(artifactPath, JSON.stringify(artifact), 'utf8');
  }

  const mythExecutable = await makeFakeMyth(current.root, { exitCode: 0, report: cleanReport() });
  const summary = await runMythrilCampaign({ ...current, mythExecutable });
  assert.equal(summary.success, true);
});

test('records and rejects incompatible deployed runtime bytecode before launching Mythril', async (t) => {
  const current = await fixture(t);
  const target = REQUIRED_MYTHRIL_TARGETS[0];
  const artifactPath = resolve(current.contractsDirectory, ...target.artifact.split('/'));
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  artifact.deployedBytecode.object = '0x5e00';
  await writeFile(artifactPath, JSON.stringify(artifact), 'utf8');

  await assert.rejects(
    runMythrilCampaign({ ...current, mythExecutable: resolve(current.root, 'missing-mythril-executable') }),
    /compatibility blocker.*GBX:MCOPY\(0x5e\)@0x0/,
  );
  const summary = JSON.parse(await readFile(resolve(current.reportDirectory, 'mythril-summary.json'), 'utf8'));
  assert.equal(summary.success, false);
  assert.equal(summary.compatibility.compatible, false);
  assert.deepEqual(summary.compatibility.incompatibleTargets[0].instructions, [
    { name: 'MCOPY', opcode: '0x5e', pc: 0 },
  ]);
  await assert.rejects(readFile(resolve(current.reportDirectory, 'mythril-run-manifest.json')), {
    code: 'ENOENT',
  });
});

test('records and rejects unresolved immutable and library references before launching Mythril', async (t) => {
  const current = await fixture(t);
  const target = REQUIRED_MYTHRIL_TARGETS[1];
  const artifactPath = resolve(current.contractsDirectory, ...target.artifact.split('/'));
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  artifact.deployedBytecode.immutableReferences = { 'fixture-immutable': [{ length: 1, start: 1 }] };
  artifact.deployedBytecode.linkReferences = {
    'src/FixtureLibrary.sol': { FixtureLibrary: [{ length: 1, start: 3 }] },
  };
  await writeFile(artifactPath, JSON.stringify(artifact), 'utf8');

  await assert.rejects(
    runMythrilCampaign({ ...current, mythExecutable: resolve(current.root, 'missing-mythril-executable') }),
    /compatibility blocker.*constructor-resolved runtime required.*Fundraiser:immutable-ids=fixture-immutable.*FixtureLibrary/,
  );
  const summary = JSON.parse(await readFile(resolve(current.reportDirectory, 'mythril-summary.json'), 'utf8'));
  const evidence = summary.compatibility.unresolvedRuntimeTargets[0];
  assert.equal(summary.success, false);
  assert.equal(summary.compatibility.bytecodeResolution, MYTHRIL_ANALYSIS.bytecodeResolution);
  assert.equal(evidence.contract, 'Fundraiser');
  assert.match(evidence.templateBytecodeSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(evidence.immutableReferences, [{ id: 'fixture-immutable', spans: [{ length: 1, start: 1 }] }]);
  assert.deepEqual(evidence.linkReferences, [
    {
      library: 'FixtureLibrary',
      source: 'src/FixtureLibrary.sol',
      spans: [{ length: 1, start: 3 }],
    },
  ]);
});

test('rejects Mythril error JSONV2 even when the analyzer exits zero and preserves all evidence', async (t) => {
  const current = await fixture(t);
  const mythExecutable = await makeFakeMyth(current.root, { exitCode: 0, report: errorReport() });
  await assert.rejects(runMythrilCampaign({ ...current, mythExecutable }), /contains Mythril error log/);

  const manifest = JSON.parse(await readFile(resolve(current.reportDirectory, 'mythril-run-manifest.json'), 'utf8'));
  assert.equal(manifest.targets.length, 12);
  assert.ok(manifest.targets.every((target) => target.exitCode === 0));
  const summary = JSON.parse(await readFile(resolve(current.reportDirectory, 'mythril-summary.json'), 'utf8'));
  assert.equal(summary.success, false);
  assert.match(summary.error, /synthetic analysis failure/);
  for (const target of REQUIRED_MYTHRIL_TARGETS) {
    await readFile(resolve(current.reportDirectory, `mythril-${target.contract}.json`));
    await readFile(resolve(current.reportDirectory, `mythril-${target.contract}.stderr.txt`));
  }
});

test('rejects a structurally valid finding report with Mythril finding exit code one', async (t) => {
  const current = await fixture(t);
  const mythExecutable = await makeFakeMyth(current.root, { exitCode: 1, report: findingReport() });
  await assert.rejects(runMythrilCampaign({ ...current, mythExecutable }), /zero-findings policy accepts none/);

  const manifest = JSON.parse(await readFile(resolve(current.reportDirectory, 'mythril-run-manifest.json'), 'utf8'));
  assert.ok(manifest.targets.every((target) => target.exitCode === 1));
});

test('rejects exit-code/report mismatches instead of treating every nonzero status as a finding', async (t) => {
  const current = await fixture(t);
  const mythExecutable = await makeFakeMyth(current.root, { exitCode: 1, report: cleanReport() });
  await assert.rejects(runMythrilCampaign({ ...current, mythExecutable }), /exit-code\/report mismatch/);
});

test('records and rejects a Mythril launch failure without reusing stale reports', async (t) => {
  const current = await fixture(t);
  const mythExecutable = resolve(current.root, 'missing-mythril-executable');
  await assert.rejects(runMythrilCampaign({ ...current, mythExecutable }), /failed to launch/);

  const manifest = JSON.parse(await readFile(resolve(current.reportDirectory, 'mythril-run-manifest.json'), 'utf8'));
  assert.ok(manifest.targets.every((target) => target.exitCode === null));
  assert.ok(manifest.targets.every((target) => /ENOENT/.test(target.launchError)));
});

test('rejects missing targets, stale bytecode hashes, and malformed archived JSON', async (t) => {
  const current = await fixture(t);
  const mythExecutable = await makeFakeMyth(current.root, { exitCode: 0, report: cleanReport() });
  await runMythrilCampaign({ ...current, mythExecutable });
  const manifest = JSON.parse(await readFile(resolve(current.reportDirectory, 'mythril-run-manifest.json'), 'utf8'));

  const missing = structuredClone(manifest);
  missing.targets.pop();
  await assert.rejects(
    evaluateMythrilRun({ ...current, manifest: missing }),
    /must contain exactly 12 expected targets/,
  );

  const staleHash = structuredClone(manifest);
  staleHash.targets[0].bytecodeSha256 = '0'.repeat(64);
  await assert.rejects(evaluateMythrilRun({ ...current, manifest: staleHash }), /does not match artifact hash/);

  await writeFile(resolve(current.reportDirectory, 'mythril-GBX.json'), '[', 'utf8');
  await assert.rejects(evaluateMythrilRun({ ...current, manifest }), /stdout report is not valid JSON/);
});

test('zero-findings policy schema cannot silently add an accepted finding or remove a target', () => {
  const accepted = zeroFindingsPolicy();
  accepted.acceptedFindings.push({ swcID: 'SWC-999' });
  assert.throws(() => validateMythrilPolicy(accepted), /must remain an empty array/);

  const incomplete = zeroFindingsPolicy();
  incomplete.expectedTargets.pop();
  assert.throws(() => validateMythrilPolicy(incomplete), /exactly 12 expected targets/);

  const wrongInputMode = zeroFindingsPolicy();
  wrongInputMode.analysis.inputMode = 'creation-bytecode';
  assert.throws(() => validateMythrilPolicy(wrongInputMode), /inputMode must equal "deployed-runtime-bytecode"/);

  const unresolvedTemplatesAllowed = zeroFindingsPolicy();
  unresolvedTemplatesAllowed.analysis.bytecodeResolution = 'allow-compiler-templates';
  assert.throws(() => validateMythrilPolicy(unresolvedTemplatesAllowed), /bytecodeResolution must equal/);

  const onchainDataEnabled = zeroFindingsPolicy();
  onchainDataEnabled.analysis.onchainData = 'enabled';
  assert.throws(() => validateMythrilPolicy(onchainDataEnabled), /onchainData must equal "disabled"/);

  const weakenedCompatibility = zeroFindingsPolicy();
  weakenedCompatibility.analysis.opcodeCompatibility = 'allow-unsupported-opcodes';
  assert.throws(() => validateMythrilPolicy(weakenedCompatibility), /opcodeCompatibility must equal/);
});

test('checked-in Mythril policy remains the exact twelve-target zero-findings policy', async () => {
  const policy = JSON.parse(await readFile(resolve(auditDirectory, 'mythril-policy.json'), 'utf8'));
  assert.equal(validateMythrilPolicy(policy), policy);
});
