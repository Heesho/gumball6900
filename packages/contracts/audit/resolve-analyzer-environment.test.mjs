import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const AUDIT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(AUDIT_DIR, '../../..');
const RESOLVER = path.join(AUDIT_DIR, 'resolve-analyzer-environment.mjs');
const POLICY_PATH = 'packages/contracts/audit/analyzer-environment-policy.json';
const LOCK_PATHS = ['semgrep', 'slither'].map((tool) => `packages/contracts/audit/python-locks/${tool}-linux-x64.txt`);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function createConfiguredFixture(t) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'gumball-analyzer-environment-'));
  t.after(async () => rm(temporaryRoot, { force: true, recursive: true }));
  const workspace = await realpath(temporaryRoot);
  const lockfiles = Object.fromEntries(
    LOCK_PATHS.map((repositoryPath) => [repositoryPath, Buffer.from(`locked graph for ${repositoryPath}\n`, 'utf8')]),
  );
  const policy = {
    bindings: ['semgrep', 'slither'].map((tool, index) => ({
      path: LOCK_PATHS[index],
      sha256: sha256(lockfiles[LOCK_PATHS[index]]),
      tool,
    })),
    hermetic: true,
    kind: 'gumball-6900-analyzer-environment-policy',
    mythrilImage: {
      digest: 'sha256:ca947a2a79204667ae2ae93ea6aaaca0cea669f61bc4db6958e7556ea263bd80',
      platform: 'linux/amd64',
      reference: 'mythril/myth:0.24.8@sha256:ca947a2a79204667ae2ae93ea6aaaca0cea669f61bc4db6958e7556ea263bd80',
      version: '0.24.8',
    },
    platform: 'linux-x64',
    protocol: 'GUM BALL 6900',
    pythonVersion: '3.10.20',
    releaseEligible: true,
    review: {
      reference: 'SECURITY-TOOLCHAIN-REVIEW-001',
      reviewedAt: '2025-08-02',
      reviewedBy: 'Fixture security reviewer',
    },
    schemaVersion: 2,
    state: 'configured',
  };
  await mkdir(path.dirname(path.join(workspace, POLICY_PATH)), { recursive: true });
  await writeFile(path.join(workspace, POLICY_PATH), `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
  for (const repositoryPath of LOCK_PATHS) {
    await mkdir(path.dirname(path.join(workspace, repositoryPath)), { recursive: true });
    await writeFile(path.join(workspace, repositoryPath), lockfiles[repositoryPath]);
  }
  return { lockfiles, policy, workspace };
}

function runResolver(workspace, extraArguments = []) {
  return spawnSync(process.execPath, [RESOLVER, '--workspace', workspace, ...extraArguments], { encoding: 'utf8' });
}

test('checked-in prepared policy resolves immutable analyzer dependencies without becoming release eligible', () => {
  const result = runResolver(REPOSITORY_ROOT);
  assert.equal(result.status, 0, result.stderr);
  const resolution = JSON.parse(result.stdout);
  assert.deepEqual(resolution, {
    installationMode: 'hash-locked-requirements-and-container',
    lockSha256: {
      [LOCK_PATHS[0]]: '028fc3fc96cf4d21502e4c909e686a955aebe0c31569b86867766376e1f07619',
      [LOCK_PATHS[1]]: 'e3d8bd5528518ea07737fa99c341704d4a9ff3bd240051ff03435a3550e376ca',
    },
    lockPaths: LOCK_PATHS,
    mythrilImage: 'mythril/myth:0.24.8@sha256:ca947a2a79204667ae2ae93ea6aaaca0cea669f61bc4db6958e7556ea263bd80',
    platform: 'linux-x64',
    policyState: 'dependencies-prepared',
    pythonVersion: '3.10.20',
    runtimeVerified: false,
  });
});

test('configured policy resolves its exact Python and raw lock bytes for CI', async (t) => {
  const fixture = await createConfiguredFixture(t);
  const githubOutput = path.join(fixture.workspace, 'github-output.txt');
  await writeFile(githubOutput, 'prior=value\n', 'utf8');
  const result = runResolver(fixture.workspace, ['--github-output', githubOutput]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(githubOutput, 'utf8'), 'prior=value\npython_version=3.10.20\npolicy_state=configured\n');
});

test('configured policy rejects missing or mismatched installation locks and removes stale shell output', async (t) => {
  const fixture = await createConfiguredFixture(t);
  const shellOutput = path.join(fixture.workspace, 'analyzer-environment.env');
  await writeFile(shellOutput, 'ANALYZER_ENVIRONMENT_STATE=configured\n', 'utf8');
  await writeFile(path.join(fixture.workspace, LOCK_PATHS[0]), 'tampered lock\n', 'utf8');
  const mismatch = runResolver(fixture.workspace, ['--shell-output', shellOutput]);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /lock file SHA-256 mismatch/u);
  await assert.rejects(readFile(shellOutput, 'utf8'), { code: 'ENOENT' });

  await writeFile(path.join(fixture.workspace, LOCK_PATHS[0]), fixture.lockfiles[LOCK_PATHS[0]]);
  await unlink(path.join(fixture.workspace, LOCK_PATHS[1]));
  const missing = runResolver(fixture.workspace);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Required analyzer environment file is missing/u);
});

test('configured policy verifies the exact Linux x64 Python runtime before installation', async (t) => {
  const fixture = await createConfiguredFixture(t);
  const python = path.join(fixture.workspace, 'python-fixture');
  await writeFile(
    python,
    '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({machine: "x86_64", system: "Linux", version: "3.10.20"}) + "\\n");\n',
    'utf8',
  );
  await chmod(python, 0o755);
  const success = runResolver(fixture.workspace, ['--verify-python', python]);
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).runtimeVerified, true);

  await writeFile(
    python,
    '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({machine: "arm64", system: "Linux", version: "3.10.19"}) + "\\n");\n',
    'utf8',
  );
  await chmod(python, 0o755);
  const mismatch = runResolver(fixture.workspace, ['--verify-python', python]);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /expected 3\.10\.20 on linux-x64/u);
});

test('installer consumes configured locks with require-hashes and retains the explicit engineering fallback', async () => {
  const installer = await readFile(path.join(AUDIT_DIR, 'install-tools.sh'), 'utf8');
  const resolverCall = installer.indexOf('resolve-analyzer-environment.mjs');
  const policyBranch = installer.indexOf('configured:hash-locked-requirements-and-container');
  const configuredEnd = installer.indexOf(';;', policyBranch);
  const engineeringBranch = installer.indexOf('transitive-dependencies-unlocked:top-level-pipx-engineering');
  assert.ok(resolverCall >= 0 && policyBranch > resolverCall);
  assert.match(installer, /Linux:x86_64[\s\S]*--verify-python python3/u);
  assert.doesNotMatch(installer, /ANALYZER_RUNTIME_VERIFICATION/u);
  assert.match(installer, /verify_sha256 "\$expected_sha256" "\$lock_path"/u);
  assert.match(installer, /--only-binary=:all:/u);
  assert.match(installer, /--require-hashes/u);
  assert.match(installer, /--requirement "\$lock_path"/u);
  assert.match(installer, /python3 -m venv --clear "\$virtualenv"/u);
  assert.doesNotMatch(installer.slice(policyBranch, configuredEnd), /pipx/u);
  assert.ok(engineeringBranch > configuredEnd);
  assert.match(installer.slice(engineeringBranch), /pipx" install --force "slither-analyzer==\$SLITHER_VERSION"/u);
  assert.match(installer.slice(engineeringBranch), /pipx" install --force "semgrep==\$SEMGREP_VERSION"/u);
  assert.doesNotMatch(installer, /install_hash_locked_analyzer mythril/u);
  assert.match(installer, /docker pull --platform linux\/amd64 "\$MYTHRIL_IMAGE"/u);
  assert.match(installer, /--pull=never/u);
  assert.match(installer, /local-darwin-engineering-fallback:top-level-pipx-engineering/u);
  assert.match(installer, /"\$ANALYZER_DEPENDENCIES_PREPARED" == true/u);
});

test('workflow analyzer installs cannot bypass policy resolution', async () => {
  for (const repositoryPath of ['.github/workflows/pr.yml', '.github/workflows/nightly.yml']) {
    const workflow = await readFile(path.join(REPOSITORY_ROOT, repositoryPath), 'utf8');
    const jobs = workflow.split(/\n(?= {2}[a-zA-Z0-9_-]+:\n)/u);
    for (const job of jobs.filter((section) => section.includes('audit/install-tools.sh'))) {
      const resolver = job.indexOf('resolve-analyzer-environment.mjs');
      const setupPython = job.indexOf('actions/setup-python@');
      const installer = job.indexOf('audit/install-tools.sh');
      assert.ok(resolver >= 0, `${repositoryPath} analyzer job omits policy resolution`);
      assert.ok(setupPython > resolver, `${repositoryPath} sets Python before policy resolution`);
      assert.ok(installer > setupPython, `${repositoryPath} installs analyzers before Python setup`);
      assert.match(job, /architecture: x64/u);
      assert.match(job, /python-version: \$\{\{ steps\.analyzer_environment\.outputs\.python_version \}\}/u);
      assert.doesNotMatch(job, /python-version: ['"]?3\.10(?:['"]|\s*$)/mu);
    }
  }
});
