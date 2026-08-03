import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const AUDIT_DIR = path.dirname(fileURLToPath(import.meta.url));
const VERIFIER = path.join(AUDIT_DIR, 'verify-toolchain.mjs');
const ECHIDNA_DIGEST = 'sha256:8546f6705d46aea2cdf8309a251ad0946c7f92b7d3eb0b968fba37e3afbf131c';
const ECHIDNA_REFERENCE = `ghcr.io/crytic/echidna/echidna:v2.3.2@${ECHIDNA_DIGEST}`;
const MYTHRIL_DIGEST = 'sha256:ca947a2a79204667ae2ae93ea6aaaca0cea669f61bc4db6958e7556ea263bd80';
const MYTHRIL_REFERENCE = `mythril/myth:0.24.8@${MYTHRIL_DIGEST}`;

function lockContents(overrides = {}) {
  const values = {
    ANALYZER_LOCK_CUTOFF: '2026-08-02T00:00:00Z',
    ADERYN_DARWIN_ARM64_SHA256: '624c6652bb9478b38ddc255c27819cd5c6cb0448f5deb72036cc9cf5a27d4aac',
    ADERYN_LINUX_X86_64_SHA256: 'ffd6ca658962e211a3ac821c646f69c8e14bf1b1001cbfe091bcd4535a691e46',
    ADERYN_VERSION: '0.6.8',
    ECHIDNA_IMAGE_DIGEST: ECHIDNA_DIGEST,
    ECHIDNA_VERSION: '2.3.2',
    FOUNDRY_VERSION: '1.7.1',
    GITLEAKS_DARWIN_ARM64_SHA256: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
    GITLEAKS_LINUX_X86_64_SHA256: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
    GITLEAKS_VERSION: '8.30.1',
    MEDUSA_VERSION: '1.5.1',
    MYTHRIL_IMAGE_DIGEST: MYTHRIL_DIGEST,
    MYTHRIL_VERSION: '0.24.8',
    PIPX_VERSION: '1.7.1',
    PNPM_VERSION: '10.14.0',
    SEMGREP_VERSION: '1.162.0',
    SLITHER_VERSION: '0.11.5',
    SOLC_LONG_VERSION: '0.8.26+commit.8a97fa7a',
    SOLHINT_VERSION: '6.0.1',
    SOLIDITY_VERSION: '0.8.26',
    UV_DARWIN_ARM64_SHA256: '77d2906988e8074fd43f2f329ec452ebbf9b0c257ba1c66451c71de70a6baf42',
    UV_LINUX_X86_64_SHA256: '90b2f223fb69d19db49e117da601f64978593417988530aa733d456141b4bcbb',
    UV_VERSION: '0.12.1',
    ...overrides,
  };
  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

function executableSource(name, options = {}) {
  const versions = {
    aderyn: 'aderyn 0.6.8',
    gitleaks: '8.30.1',
    medusa: 'medusa version 1.5.1',
    myth: 'Mythril version v0.24.8',
    pnpm: '10.14.0',
    semgrep: '1.162.0',
    slither: '0.11.5',
    solhint: '6.0.1',
  };
  if (name === 'forge') {
    const config = {
      evm_version: 'cancun',
      optimizer: true,
      optimizer_runs: 10_000,
      out: 'out',
      solc: '0.8.26',
      ...options.foundryConfig,
    };
    return `#!/usr/bin/env node
if (process.argv[2] === "config") {
  process.stdout.write(${JSON.stringify(`${JSON.stringify(config)}\n`)});
} else {
  process.stdout.write("forge Version: 1.7.1-stable\\n");
}
`;
  }
  if (name === 'docker') {
    const echidnaRepoDigests = options.echidnaRepoDigests ?? [ECHIDNA_REFERENCE];
    const mythrilRepoDigests = options.mythrilRepoDigests ?? [MYTHRIL_REFERENCE];
    return `#!/usr/bin/env node
if (process.argv[2] === "image" && process.argv[3] === "inspect") {
  const repoDigests = process.argv.some(argument => argument.includes("mythril/myth"))
    ? ${JSON.stringify(mythrilRepoDigests)}
    : ${JSON.stringify(echidnaRepoDigests)};
  process.stdout.write(JSON.stringify(repoDigests) + "\\n");
} else if (process.argv[2] === "run") {
  process.stdout.write(process.argv.some(argument => argument.includes("mythril/myth"))
    ? "Mythril version v0.24.8\\n"
    : "Echidna 2.3.2\\n");
} else {
  process.exitCode = 2;
}
`;
  }
  return `#!/usr/bin/env node
process.stdout.write(${JSON.stringify(`${options.output ?? versions[name]}\n`)});
`;
}

async function writeExecutable(binDir, name, options) {
  const executable = path.join(binDir, name);
  await writeFile(executable, executableSource(name, options), 'utf8');
  await chmod(executable, 0o755);
}

async function createFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'gumball-toolchain-verifier-'));
  t.after(async () => rm(root, { force: true, recursive: true }));
  const contractsDir = path.join(root, 'contracts');
  const binDir = path.join(root, 'bin');
  const lockPath = path.join(root, 'toolchain.lock');
  const reportPath = path.join(root, 'reports', 'tool-versions.json');
  await mkdir(path.join(contractsDir, 'out', 'GBXToken.sol'), { recursive: true });
  await mkdir(path.join(contractsDir, 'out', 'IERC20.sol'), { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(lockPath, lockContents(), 'utf8');
  await writeFile(
    path.join(contractsDir, 'out', 'GBXToken.sol', 'GBXToken.json'),
    `${JSON.stringify({
      metadata: {
        compiler: { version: '0.8.26+commit.8a97fa7a' },
        settings: { compilationTarget: { 'src/token/GBXToken.sol': 'GBXToken' } },
      },
    })}\n`,
    'utf8',
  );
  await writeFile(
    path.join(contractsDir, 'out', 'IERC20.sol', 'IERC20.json'),
    `${JSON.stringify({
      metadata: {
        compiler: { version: '0.8.25+commit.b61c2a91' },
        settings: { compilationTarget: { 'node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol': 'IERC20' } },
      },
    })}\n`,
    'utf8',
  );
  for (const name of ['aderyn', 'docker', 'forge', 'gitleaks', 'medusa', 'pnpm', 'semgrep', 'slither', 'solhint']) {
    await writeExecutable(binDir, name);
  }

  return { binDir, contractsDir, lockPath, reportPath, root };
}

function runVerifier(fixture, profile, extraArguments = []) {
  return spawnSync(
    process.execPath,
    [
      VERIFIER,
      profile,
      '--contracts-dir',
      fixture.contractsDir,
      '--lock',
      fixture.lockPath,
      '--report',
      fixture.reportPath,
      ...extraArguments,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${fixture.binDir}${path.delimiter}${process.env.PATH}` },
    },
  );
}

test('static profile emits deterministic version, config, and artifact evidence', async (t) => {
  const fixture = await createFixture(t);
  const first = runVerifier(fixture, 'static', ['--artifacts']);
  assert.equal(first.status, 0, first.stderr);
  const firstEvidence = await readFile(fixture.reportPath, 'utf8');
  const report = JSON.parse(firstEvidence);

  assert.equal(report.profile, 'static');
  assert.deepEqual(
    report.tools.map(({ name }) => name),
    ['aderyn', 'forge', 'gitleaks', 'pnpm', 'semgrep', 'slither', 'solhint'],
  );
  assert.deepEqual(report.foundry.observed, {
    artifactOutput: 'out',
    evmVersion: 'cancun',
    optimizerEnabled: true,
    optimizerRuns: 10_000,
    solcVersion: '0.8.26',
  });
  assert.equal(report.artifacts.count, 1);
  assert.equal(report.artifacts.productionArtifacts[0].artifact, 'out/GBXToken.sol/GBXToken.json');
  assert.equal(report.echidna.reference, ECHIDNA_REFERENCE);
  assert.equal(report.echidna.runtimeVerified, false);
  assert.equal(report.mythril.reference, MYTHRIL_REFERENCE);
  assert.equal(report.mythril.runtimeVerified, false);

  const second = runVerifier(fixture, 'static', ['--artifacts']);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(await readFile(fixture.reportPath, 'utf8'), firstEvidence);
});

test('version mismatch fails closed and removes stale evidence', async (t) => {
  const fixture = await createFixture(t);
  await mkdir(path.dirname(fixture.reportPath), { recursive: true });
  await writeFile(fixture.reportPath, 'stale evidence\n', 'utf8');
  await writeExecutable(fixture.binDir, 'slither', { output: '0.11.4' });

  const result = runVerifier(fixture, 'static');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /slither version mismatch: expected 0\.11\.5, observed 0\.11\.4/u);
  await assert.rejects(readFile(fixture.reportPath, 'utf8'), { code: 'ENOENT' });
});

test('effective Foundry configuration drift fails verification', async (t) => {
  const fixture = await createFixture(t);
  await writeExecutable(fixture.binDir, 'forge', { foundryConfig: { optimizer_runs: 200 } });

  const result = runVerifier(fixture, 'static');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Foundry config mismatch for optimizerRuns: expected 10000, observed 200/u);
});

test('production artifact compiler drift fails verification', async (t) => {
  const fixture = await createFixture(t);
  const artifactPath = path.join(fixture.contractsDir, 'out', 'GBXToken.sol', 'GBXToken.json');
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  artifact.metadata.compiler.version = '0.8.25+commit.b61c2a91';
  await writeFile(artifactPath, `${JSON.stringify(artifact)}\n`, 'utf8');

  const result = runVerifier(fixture, 'static', ['--artifacts']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Production artifact .* compiler mismatch/u);
});

test('nightly profile verifies Medusa and immutable Mythril and Echidna images', async (t) => {
  const fixture = await createFixture(t);
  const success = runVerifier(fixture, 'nightly');
  assert.equal(success.status, 0, success.stderr);
  const report = JSON.parse(await readFile(fixture.reportPath, 'utf8'));
  assert.deepEqual(
    report.tools.map(({ name }) => name),
    ['aderyn', 'forge', 'gitleaks', 'medusa', 'pnpm', 'semgrep', 'slither', 'solhint'],
  );
  assert.equal(report.echidna.runtimeVerified, true);
  assert.equal(report.echidna.observedVersion, '2.3.2');
  assert.equal(report.mythril.runtimeVerified, true);
  assert.equal(report.mythril.observedVersion, '0.24.8');

  await writeExecutable(fixture.binDir, 'docker', {
    mythrilRepoDigests: ['mythril/myth@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
  });
  const mythrilFailure = runVerifier(fixture, 'nightly');
  assert.equal(mythrilFailure.status, 1);
  assert.match(mythrilFailure.stderr, /local Mythril image does not match the pinned immutable digest/u);

  await writeExecutable(fixture.binDir, 'docker', {
    echidnaRepoDigests: [
      'ghcr.io/crytic/echidna/echidna@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ],
  });
  const failure = runVerifier(fixture, 'nightly');
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /does not match the pinned immutable digest/u);
});

test('static and nightly runners enforce preflight, artifact, and immutable-container verification', async () => {
  const [staticRunner, nightlyRunner, installer] = await Promise.all([
    readFile(path.join(AUDIT_DIR, 'run-static.sh'), 'utf8'),
    readFile(path.join(AUDIT_DIR, 'run-nightly.sh'), 'utf8'),
    readFile(path.join(AUDIT_DIR, 'install-tools.sh'), 'utf8'),
  ]);

  assert.match(staticRunner, /verify-toolchain\.mjs" static\n/u);
  assert.match(staticRunner, /verify-toolchain\.mjs" static --artifacts/u);
  assert.match(nightlyRunner, /verify-toolchain\.mjs" nightly\n/u);
  assert.match(nightlyRunner, /verify-toolchain\.mjs" nightly --artifacts/u);
  assert.match(nightlyRunner, /echidna:v\$ECHIDNA_VERSION@\$ECHIDNA_IMAGE_DIGEST/u);
  assert.match(nightlyRunner, /--platform linux\/amd64/u);
  assert.match(nightlyRunner, /--pull=never/u);
  assert.match(installer, /docker pull --platform linux\/amd64 "\$ECHIDNA_IMAGE"/u);
  assert.match(installer, /docker pull --platform linux\/amd64 "\$MYTHRIL_IMAGE"/u);
  assert.match(installer, /mythril\/myth:\$MYTHRIL_VERSION@\$MYTHRIL_IMAGE_DIGEST/u);
});
