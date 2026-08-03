import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const nodeImage = 'node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3';

async function repositoryFile(repositoryPath) {
  return await readFile(path.join(repositoryRoot, repositoryPath), 'utf8');
}

test('every project, workflow, and runtime Node pin is exact 22.23.1', async () => {
  const [packageJson, nodeVersion, nvmrc, ...workflows] = await Promise.all([
    repositoryFile('package.json'),
    repositoryFile('.node-version'),
    repositoryFile('.nvmrc'),
    ...['pr.yml', 'main.yml', 'nightly.yml', 'release.yml'].map((name) => repositoryFile(`.github/workflows/${name}`)),
  ]);
  assert.equal(JSON.parse(packageJson).engines.node, '22.23.1');
  assert.equal(nodeVersion, '22.23.1\n');
  assert.equal(nvmrc, '22.23.1\n');
  for (const workflow of workflows) {
    const pins = [...workflow.matchAll(/^\s+NODE_VERSION:\s*(\S+)\s*$/gmu)].map((match) => match[1]);
    assert.ok(pins.length > 0, 'Workflow omits its Node version pin');
    assert.deepEqual(new Set(pins), new Set(['22.23.1']));
    assert.doesNotMatch(workflow, /20\.19\.0/u);
  }
});

test('development and release images bind every Node stage to the reviewed immutable base', async () => {
  const [development, release, policy] = await Promise.all([
    repositoryFile('apps/web/Dockerfile'),
    repositoryFile('scripts/release/Dockerfile.web-artifact'),
    repositoryFile('scripts/release/container-security-policy.json'),
  ]);
  for (const dockerfile of [development, release]) {
    const nodeStages = [...dockerfile.matchAll(/^FROM\s+(node:\S+)(?:\s+AS\s+\S+)?$/gmu)].map((match) => match[1]);
    assert.ok(nodeStages.length > 0);
    assert.deepEqual(new Set(nodeStages), new Set([nodeImage]));
    assert.match(dockerfile, /USER node/u);
    assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/healthz/u);
  }
  assert.equal(JSON.parse(policy).images.nodeRuntime.reference, nodeImage);
});

test('release workflow starts, probes, scans, and always archives container evidence', async () => {
  const [workflow, runner, packager] = await Promise.all([
    repositoryFile('.github/workflows/release.yml'),
    repositoryFile('scripts/release/run-container-security.sh'),
    repositoryFile('scripts/release/package-offline-evidence.sh'),
  ]);
  assert.match(workflow, /node scripts\/release\/container-smoke\.mjs \\\n\s+--image gumball-6900-web:local/u);
  assert.match(workflow, /bash scripts\/release\/run-container-security\.sh/u);
  assert.match(workflow, /release-container-security-evidence-\$\{\{ inputs\.releaseTag \}\}/u);
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7\.0\.1/u);
  for (const evidence of [
    'container-security-policy.json',
    'web-container-smoke.json',
    'web-container.sbom.syft.json',
    'web-container.sbom.spdx.json',
    'web-container.grype.json',
    'web-container.grype-db-status.json',
    'web-container-vulnerability-summary.json',
  ]) {
    assert.ok(workflow.includes(evidence), `Release workflow omits ${evidence}`);
  }
  assert.match(runner, /docker pull --platform "\$platform" "\$syft_image"/u);
  assert.match(runner, /docker pull --platform "\$platform" "\$grype_image"/u);
  assert.match(runner, /docker save --output "\$image_archive" "\$image_id"/u);
  assert.doesNotMatch(runner, /docker\.sock/u);
  assert.match(runner, /--network none[\s\S]+docker-archive:\/input\/web-container\.docker\.tar/u);
  const databaseUpdate = runner.indexOf('"$grype_image" db update');
  const databaseStatus = runner.indexOf('"$grype_image" db status --output json');
  const sbomScan = runner.indexOf('"$grype_image" sbom:/evidence/web-container.sbom.syft.json --output json');
  assert.ok(databaseUpdate >= 0 && databaseStatus > databaseUpdate && sbomScan > databaseStatus);
  const updateInvocation = runner.slice(runner.lastIndexOf('docker run', databaseUpdate), databaseUpdate);
  const statusInvocation = runner.slice(runner.lastIndexOf('docker run', databaseStatus), databaseStatus);
  const scanInvocation = runner.slice(runner.lastIndexOf('docker run', sbomScan), sbomScan);
  assert.doesNotMatch(updateInvocation, /--network none/u);
  assert.match(statusInvocation, /--network none/u);
  assert.match(scanInvocation, /--network none/u);
  assert.match(statusInvocation, /GRYPE_DB_AUTO_UPDATE=false/u);
  assert.match(scanInvocation, /GRYPE_DB_AUTO_UPDATE=false/u);
  assert.match(runner, /--output syft-json=/u);
  assert.match(runner, /--output spdx-json=/u);
  assert.match(runner, /sbom:\/evidence\/web-container\.sbom\.syft\.json --output json/u);
  assert.match(runner, /check-container-vulnerabilities\.mjs/u);
  assert.match(runner, /--smoke "\$smoke"/u);
  assert.match(packager, /cp "\$RELEASE_DERIVED_DIR"\/\*\.json "\$RELEASE_OUTPUT_DIR\/"/u);
});
