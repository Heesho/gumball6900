import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  classifyLicense,
  evaluateLicenseReview,
  releaseApprovalErrors,
  reviewRequiredEntries,
  validatePolicy,
} from './check-license-review.mjs';
import { generateInventory } from './generate-dependency-license-inventory.mjs';

const auditDirectory = dirname(fileURLToPath(import.meta.url));
const script = resolve(auditDirectory, 'check-license-review.mjs');
const generatorScript = resolve(auditDirectory, 'generate-dependency-license-inventory.mjs');
const workspaceConfigBytes = Buffer.from('packages:\n  - packages/*\n');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function inventory() {
  const entries = [
    { license: 'BUSL-1.1', name: 'restricted-package', versions: ['3.0.0'] },
    { license: 'GPL-3.0-or-later', name: 'copyleft-package', versions: ['2.0.0'] },
    { license: 'MIT', name: 'permissive-package', versions: ['4.0.0'] },
    { license: 'Unknown', name: 'unknown-package', versions: ['1.0.0'] },
  ];
  return {
    kind: 'gumball-6900-dependency-license-inventory',
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    source: {
      command: 'node audit/generate-dependency-license-inventory.mjs --check',
      coverage: 'Synthetic installed dependency graph used by the policy unit tests.',
      platform: 'darwin-arm64',
      pnpmVersion: '10.14.0',
      pnpmWorkspaceSha256: sha256(workspaceConfigBytes),
    },
    packageEntryCount: 4,
    dependencyEntriesSha256: sha256(`${JSON.stringify(entries, null, 2)}\n`),
    entries,
    licenseGroups: [
      { license: 'BUSL-1.1', packageEntryCount: 1 },
      { license: 'GPL-3.0-or-later', packageEntryCount: 1 },
      { license: 'MIT', packageEntryCount: 1 },
      { license: 'Unknown', packageEntryCount: 1 },
    ],
    reviewRequiredEntries: [
      {
        classification: 'restricted',
        license: 'BUSL-1.1',
        name: 'restricted-package',
        versions: ['3.0.0'],
      },
      {
        classification: 'copyleft',
        license: 'GPL-3.0-or-later',
        name: 'copyleft-package',
        versions: ['2.0.0'],
      },
      {
        classification: 'unknown',
        license: 'Unknown',
        name: 'unknown-package',
        versions: ['1.0.0'],
      },
    ],
  };
}

function baselineEntries(inventoryValue) {
  return reviewRequiredEntries(inventoryValue).map((entry) => ({
    ...entry,
    disposition: 'needs-counsel',
    releaseRelevance: 'undetermined',
    rationale: 'This inventory-only disposition makes no release decision; owner and counsel review are required.',
  }));
}

function policyFor(lockfileBytes, reportBytes, inventoryValue = inventory()) {
  return {
    kind: 'gumball-6900-dependency-license-review-policy',
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    state: 'inventory-baselined',
    pnpmLockSha256: sha256(lockfileBytes),
    licenseReportSha256: sha256(reportBytes),
    platform: inventoryValue.source.platform,
    reviewedAt: null,
    reviewedBy: null,
    entries: baselineEntries(inventoryValue),
  };
}

function fixture() {
  const inventoryValue = inventory();
  const lockfileBytes = Buffer.from('lockfileVersion: 9.0\n');
  const reportBytes = Buffer.from(`${JSON.stringify(inventoryValue, null, 2)}\n`);
  const policy = policyFor(lockfileBytes, reportBytes, inventoryValue);
  return { inventoryValue, lockfileBytes, policy, reportBytes, workspaceConfigBytes };
}

function approve(policy) {
  policy.state = 'approved';
  policy.reviewedAt = new Date().toISOString().slice(0, 10);
  policy.reviewedBy = 'release-compliance-reviewer';
  const decisions = [
    ['allowed', 'release'],
    ['dev-only', 'development-only'],
    ['not-distributed', 'not-distributed'],
  ];
  policy.entries.forEach((entry, index) => {
    [entry.disposition, entry.releaseRelevance] = decisions[index];
    entry.rationale = 'This synthetic reviewed disposition is explicit and long enough for strict validation.';
  });
  return policy;
}

async function writeInstalledPackage(workspace, name, version, constraints = {}) {
  const directory = resolve(workspace, 'node_modules', '.pnpm', `${name}@${version}`, 'node_modules', name);
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, 'package.json'),
    `${JSON.stringify({ name, version, license: 'MIT', ...constraints }, null, 2)}\n`,
  );
}

async function installedGraphFixture() {
  const workspace = await mkdtemp(resolve(tmpdir(), 'gumball-license-inventory-'));
  await mkdir(resolve(workspace, 'node_modules'), { recursive: true });
  await Promise.all([
    writeFile(resolve(workspace, 'package.json'), `${JSON.stringify({ packageManager: 'pnpm@10.14.0' })}\n`),
    writeFile(
      resolve(workspace, 'pnpm-workspace.yaml'),
      [
        'packages:',
        '  - packages/*',
        'supportedArchitectures:',
        '  os:',
        '    - darwin',
        '    - linux',
        '  cpu:',
        '    - arm64',
        '    - x64',
        '  libc:',
        '    - glibc',
        '    - musl',
        '',
      ].join('\n'),
    ),
    writeFile(
      resolve(workspace, 'pnpm-lock.yaml'),
      [
        "lockfileVersion: '9.0'",
        '',
        'packages:',
        '',
        '  portable-package@1.0.0:',
        '    resolution: {integrity: fixture}',
        '',
        '  darwin-package@1.0.0:',
        '    resolution: {integrity: fixture}',
        '    cpu: [arm64]',
        '    os: [darwin]',
        '',
        '  linux-package@1.0.0:',
        '    resolution: {integrity: fixture}',
        '    cpu: [x64]',
        '    os: [linux]',
        '',
        'snapshots:',
        '',
      ].join('\n'),
    ),
    writeFile(
      resolve(workspace, 'node_modules', '.modules.yaml'),
      [
        'included:',
        '  dependencies: true',
        '  devDependencies: true',
        '  optionalDependencies: true',
        'packageManager: pnpm@10.14.0',
        'skipped: []',
        '',
      ].join('\n'),
    ),
    writeInstalledPackage(workspace, 'portable-package', '1.0.0'),
    writeInstalledPackage(workspace, 'darwin-package', '1.0.0', { cpu: ['arm64'], os: ['darwin'] }),
  ]);
  return workspace;
}

test('classifies unknown, copyleft, restricted, and narrowly permissive expressions', () => {
  assert.equal(classifyLicense('Unknown'), 'unknown');
  assert.equal(classifyLicense('AGPL-3.0-or-later'), 'copyleft');
  assert.equal(classifyLicense('LGPL'), 'copyleft');
  assert.equal(classifyLicense('MPL-2.0'), 'copyleft');
  assert.equal(classifyLicense('BUSL-1.1'), 'restricted');
  assert.equal(classifyLicense('CC-BY-4.0'), 'restricted');
  assert.equal(classifyLicense('BSD'), 'restricted');
  assert.equal(classifyLicense('PSF'), 'restricted');
  assert.equal(classifyLicense('(Apache-2.0 AND MIT)'), null);
  assert.equal(classifyLicense('Apache-2.0 WITH LLVM-exception'), null);
  assert.equal(classifyLicense('made-up-permissive-license'), 'restricted');
});

test('validates a complete canonical inventory and rejects wrong identity', () => {
  assert.equal(reviewRequiredEntries(inventory()).length, 3);
  const wrongIdentity = inventory();
  wrongIdentity.kind = 'other-inventory';
  assert.throws(() => reviewRequiredEntries(wrongIdentity), /wrong kind, protocol, or schemaVersion/);
});

test('rejects incomplete, misclassified, unsorted, or falsified inventories', () => {
  const incomplete = inventory();
  incomplete.reviewRequiredEntries.pop();
  assert.throws(() => reviewRequiredEntries(incomplete), /does not enumerate every review-required Unknown entry/);

  const misclassified = inventory();
  misclassified.reviewRequiredEntries[0].classification = 'unknown';
  assert.throws(() => reviewRequiredEntries(misclassified), /classification does not match/);

  const unsorted = inventory();
  unsorted.licenseGroups.reverse();
  assert.throws(() => reviewRequiredEntries(unsorted), /must be sorted/);

  const zeroDigest = inventory();
  zeroDigest.dependencyEntriesSha256 = '0'.repeat(64);
  assert.throws(() => reviewRequiredEntries(zeroDigest), /does not match entries/);

  const falsified = inventory();
  falsified.entries.pop();
  assert.throws(() => reviewRequiredEntries(falsified), /packageEntryCount does not match entries/);
});

test('accepts an exact inventory baseline without treating it as release approval', () => {
  const current = fixture();
  const result = evaluateLicenseReview(current);
  assert.deepEqual(result.errors, []);
  assert.equal(result.requiredEntries.length, 3);
  assert.match(releaseApprovalErrors(current.policy).join('\n'), /state is not approved/);
});

test('binds exact lockfile and canonical inventory bytes', () => {
  const current = fixture();
  const changedLock = evaluateLicenseReview({
    ...current,
    lockfileBytes: Buffer.from('changed lockfile'),
  });
  assert.match(changedLock.errors.join('\n'), /pnpm lockfile hash mismatch/);

  const changedReport = evaluateLicenseReview({
    ...current,
    reportBytes: Buffer.from(`${current.reportBytes.toString('utf8')}\n`),
  });
  assert.match(changedReport.errors.join('\n'), /license report hash mismatch/);

  const changedWorkspace = evaluateLicenseReview({
    ...current,
    workspaceConfigBytes: Buffer.from('packages:\n  - changed/*\n'),
  });
  assert.match(changedWorkspace.errors.join('\n'), /workspace configuration hash/);
});

test('rejects missing, stale, duplicate, and misclassified dispositions', () => {
  const current = fixture();
  current.policy.entries.pop();
  assert.match(evaluateLicenseReview(current).errors.join('\n'), /missing reviewed license disposition/);

  const stale = fixture();
  stale.policy.entries.push({
    classification: 'restricted',
    disposition: 'needs-counsel',
    license: 'BUSL-1.1',
    name: 'removed-package',
    rationale: 'This synthetic stale entry has enough detail for strict policy validation.',
    releaseRelevance: 'undetermined',
    versions: ['9.0.0'],
  });
  assert.match(evaluateLicenseReview(stale).errors.join('\n'), /stale license disposition/);

  const duplicate = fixture();
  duplicate.policy.entries.push(structuredClone(duplicate.policy.entries[0]));
  assert.match(evaluateLicenseReview(duplicate).errors.join('\n'), /duplicate license disposition/);

  const misclassified = fixture();
  misclassified.policy.entries[0].classification = 'unknown';
  assert.match(evaluateLicenseReview(misclassified).errors.join('\n'), /classification does not match/);
});

test('inventory-baselined state permits only honest needs-counsel and undetermined dispositions', () => {
  const current = fixture();
  current.policy.entries[0].disposition = 'allowed';
  current.policy.entries[0].releaseRelevance = 'release';
  assert.match(evaluateLicenseReview(current).errors.join('\n'), /must remain needs-counsel and undetermined/);
});

test('approved state passes only complete, consistent release decisions', () => {
  const current = fixture();
  approve(current.policy);
  assert.deepEqual(evaluateLicenseReview(current).errors, []);
  assert.deepEqual(releaseApprovalErrors(current.policy), []);
});

test('release approval rejects unresolved, blocked, and inconsistent decisions', () => {
  const unresolved = fixture();
  approve(unresolved.policy);
  unresolved.policy.entries[0].disposition = 'needs-counsel';
  unresolved.policy.entries[0].releaseRelevance = 'undetermined';
  assert.match(releaseApprovalErrors(unresolved.policy).join('\n'), /release-blocking.*needs-counsel/);
  assert.match(releaseApprovalErrors(unresolved.policy).join('\n'), /remains undetermined/);

  const blocked = fixture();
  approve(blocked.policy);
  blocked.policy.entries[0].disposition = 'blocked';
  assert.match(releaseApprovalErrors(blocked.policy).join('\n'), /release-blocking.*blocked/);

  const inconsistent = fixture();
  approve(inconsistent.policy);
  inconsistent.policy.entries[0].releaseRelevance = 'development-only';
  assert.match(releaseApprovalErrors(inconsistent.policy).join('\n'), /allowed requires releaseRelevance release/);

  const empty = fixture();
  approve(empty.policy);
  empty.policy.entries = [];
  assert.match(releaseApprovalErrors(empty.policy).join('\n'), /has no reviewed dispositions/);
});

test('approved policy requires exact valid nonfuture UTC/date values', () => {
  for (const reviewedAt of ['2026-02-30', '2026-8-2', '2026-08-02T12:00:00+00:00', '9999-12-31', 'not-a-date']) {
    const current = fixture();
    approve(current.policy);
    current.policy.reviewedAt = reviewedAt;
    assert.throws(() => validatePolicy(current.policy), /exact valid YYYY-MM-DD or RFC3339 UTC/);
  }

  const dateOnly = fixture();
  approve(dateOnly.policy);
  dateOnly.policy.reviewedAt = new Date().toISOString().slice(0, 10);
  assert.doesNotThrow(() => validatePolicy(dateOnly.policy));
});

test('rejects placeholder or whitespace reviewer and rationale values', () => {
  for (const reviewedBy of [
    'TODO reviewer',
    ' reviewer ',
    'UNRESOLVED',
    'N/A',
    'NOT REVIEWED',
    'Awaiting counsel',
    'Counsel assignment forthcoming',
  ]) {
    const current = fixture();
    approve(current.policy);
    current.policy.reviewedBy = reviewedBy;
    assert.throws(() => validatePolicy(current.policy), /trimmed string|placeholder token/);
  }

  for (const rationale of [
    'TODO: this disposition still needs a real explanation before it can pass.',
    ' This otherwise sufficiently long rationale has surrounding whitespace. ',
    'No legal review has occurred; no decision was independently made for this package.',
    'This disposition is awaiting legal review before any release decision is finalized.',
    'Provisional disposition subject to counsel confirmation before release.',
  ]) {
    const current = fixture();
    current.policy.entries[0].rationale = rationale;
    assert.match(evaluateLicenseReview(current).errors.join('\n'), /placeholder|nonapproval|trimmed string/);
  }
});

test('rejects all-zero hashes and wrong policy identity', () => {
  const zeroHash = fixture();
  zeroHash.policy.pnpmLockSha256 = '0'.repeat(64);
  assert.throws(() => validatePolicy(zeroHash.policy), /nonzero lowercase SHA-256/);

  const wrongIdentity = fixture();
  wrongIdentity.policy.protocol = 'OTHER PROTOCOL';
  assert.throws(() => validatePolicy(wrongIdentity.policy), /wrong kind, protocol, or schemaVersion/);
});

test('checked-in inventory baseline exactly matches the checked-in lockfile and stays release-blocked', async () => {
  const [policySource, lockfileBytes, reportBytes, checkedWorkspaceConfigBytes] = await Promise.all([
    readFile(resolve(auditDirectory, 'dependency-license-review-policy.json'), 'utf8'),
    readFile(resolve(auditDirectory, '../../../pnpm-lock.yaml')),
    readFile(resolve(auditDirectory, 'dependency-license-inventory.json')),
    readFile(resolve(auditDirectory, '../../../pnpm-workspace.yaml')),
  ]);
  const policy = JSON.parse(policySource);
  const result = evaluateLicenseReview({
    policy,
    lockfileBytes,
    reportBytes,
    workspaceConfigBytes: checkedWorkspaceConfigBytes,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.requiredEntries.length, 30);
  assert.equal(result.requiredEntries.length, policy.entries.length);
  assert.match(releaseApprovalErrors(policy).join('\n'), /state is not approved/);
});

test('checked-in target inventories exactly match the installed frozen supported-architecture union', () => {
  for (const [platform, inventoryName] of [
    ['darwin-arm64', 'dependency-license-inventory.darwin-arm64.json'],
    ['linux-x64', 'dependency-license-inventory.json'],
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        generatorScript,
        '--workspace',
        resolve(auditDirectory, '../../..'),
        '--platform',
        platform,
        '--check',
        resolve(auditDirectory, inventoryName),
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, npm_config_arch: 'ia32', npm_config_platform: 'win32' },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`matches the installed ${platform} graph`));
  }
});

test('cross-host target generation rejects an incomplete installed graph and an incomplete declared union', async () => {
  const workspace = await installedGraphFixture();
  const darwinInventory = await generateInventory(workspace, 'darwin-arm64');
  assert.equal(darwinInventory.source.platform, 'darwin-arm64');
  assert.deepEqual(
    darwinInventory.entries.map((entry) => entry.name),
    ['darwin-package', 'portable-package'],
  );

  await assert.rejects(
    generateInventory(workspace, 'linux-x64'),
    /incomplete for linux-x64; missing 1 locked package\(s\): linux-package@1\.0\.0/,
  );
  await writeInstalledPackage(workspace, 'linux-package', '1.0.0', { cpu: ['x64'], os: ['linux'] });
  const linuxInventory = await generateInventory(workspace, 'linux-x64');
  assert.equal(linuxInventory.source.platform, 'linux-x64');
  assert.deepEqual(
    linuxInventory.entries.map((entry) => entry.name),
    ['linux-package', 'portable-package'],
  );

  const workspaceConfigPath = resolve(workspace, 'pnpm-workspace.yaml');
  const workspaceConfig = await readFile(workspaceConfigPath, 'utf8');
  await writeFile(workspaceConfigPath, workspaceConfig.replace('    - linux\n', ''));
  await assert.rejects(generateInventory(workspace, 'linux-x64'), /supportedArchitectures\.os must be exactly/);
});

test('CLI accepts the exact inventory baseline', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'gumball-license-review-'));
  const paths = {
    policy: resolve(directory, 'policy.json'),
    lockfile: resolve(directory, 'pnpm-lock.yaml'),
    report: resolve(directory, 'licenses.json'),
    workspace: resolve(directory, 'pnpm-workspace.yaml'),
  };
  const current = fixture();
  await Promise.all([
    writeFile(paths.policy, `${JSON.stringify(current.policy, null, 2)}\n`),
    writeFile(paths.lockfile, current.lockfileBytes),
    writeFile(paths.workspace, current.workspaceConfigBytes),
    writeFile(paths.report, current.reportBytes),
  ]);
  const result = spawnSync(process.execPath, [script, paths.policy, paths.lockfile, paths.workspace, paths.report], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /3 review-required entries have exact dispositions/);
  assert.match(result.stdout, /inventory-baselined/);
});
