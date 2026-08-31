import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'check-static-findings.mjs');

function slitherFinding(line = 10) {
  return {
    check: 'test-detector',
    impact: 'Medium',
    confidence: 'High',
    description: `reviewed test finding at ${line}`,
    elements: [
      {
        type: 'function',
        name: 'tested',
        source_mapping: {
          filename_relative: 'src/Test.sol',
          is_dependency: false,
          lines: [line, line + 1],
        },
      },
    ],
  };
}

function reports(findings = [slitherFinding()]) {
  return {
    slither: { success: true, results: { detectors: findings } },
    aderyn: {
      high_issues: {
        issues: [
          {
            detector_name: 'test-aderyn',
            description: 'reviewed aderyn test',
            instances: [{ contract_path: 'src/Test.sol', line_no: 20, src: '20:2', hint: 'reviewed hint' }],
          },
        ],
      },
      low_issues: { issues: [] },
    },
  };
}

async function fixture() {
  const directory = await mkdtemp(resolve(tmpdir(), 'gumball-static-policy-'));
  const paths = {
    policy: resolve(directory, 'policy.json'),
    slither: resolve(directory, 'slither.json'),
    aderyn: resolve(directory, 'aderyn.json'),
  };
  const policy = {
    version: 2,
    reviewedAt: '2026-08-01',
    expiresAt: '2099-12-31T23:59:59Z',
    reviewers: {
      'internal-security': {
        name: 'Protocol engineering',
        role: 'Internal security reviewer',
      },
    },
    rationales: {
      'slither:test-detector': 'This synthetic detector rationale is intentionally long enough for policy validation.',
      'aderyn:test-aderyn': 'This synthetic Aderyn rationale is intentionally long enough for policy validation.',
    },
    rationaleProfiles: {
      'slither:test-detector': 'synthetic-review',
      'aderyn:test-aderyn': 'synthetic-review',
    },
    reviewProfiles: {
      'synthetic-review': reviewProfile(),
    },
    entries: [],
  };
  const current = reports();
  await Promise.all([
    writeFile(paths.policy, JSON.stringify(policy)),
    writeFile(paths.slither, JSON.stringify(current.slither)),
    writeFile(paths.aderyn, JSON.stringify(current.aderyn)),
  ]);
  const update = run(paths, ['--update']);
  assert.equal(update.status, 0, update.stderr);
  return paths;
}

function reviewProfile() {
  return {
    reviewerId: 'internal-security',
    impact: 'The synthetic finding has no production impact in this isolated fixture.',
    exploitability: 'The synthetic condition cannot be reached outside this controlled test fixture.',
    affectedAssumptions: ['The analyzer fixture remains isolated from production contracts.'],
    revisitTrigger: 'Re-review if the fixture is promoted into production contract source code.',
    compensatingControls: ['Exact finding identity is pinned and drift causes this checker to fail.'],
  };
}

function run(paths, extra = [], env = {}) {
  return spawnSync(process.execPath, [script, ...extra, paths.policy, paths.slither, paths.aderyn], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('accepts the exact reviewed analyzer findings', async () => {
  const paths = await fixture();
  const result = run(paths);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /accepted 2 exact findings/);
});

test('rejects a new or changed analyzer finding', async () => {
  const paths = await fixture();
  const current = reports([slitherFinding(), slitherFinding(30)]);
  await writeFile(paths.slither, JSON.stringify(current.slither));
  const result = run(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEW slither\|test-detector/);
});

test('accepts Slither description sections emitted in a different order', async () => {
  const paths = await fixture();
  const first = reports();
  first.slither.results.detectors[0].description = 'first reviewed line\nsecond reviewed line\n';
  await writeFile(paths.slither, JSON.stringify(first.slither));
  const update = run(paths, ['--update']);
  assert.equal(update.status, 0, update.stderr);

  const reordered = reports();
  reordered.slither.results.detectors[0].description = 'second reviewed line\nfirst reviewed line\n';
  await writeFile(paths.slither, JSON.stringify(reordered.slither));
  const result = run(paths);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects a stale disposition when a finding disappears', async () => {
  const paths = await fixture();
  const current = reports([]);
  await writeFile(paths.slither, JSON.stringify(current.slither));
  const result = run(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STALE slither\|test-detector/);
});

test('rejects expired dispositions', async () => {
  const paths = await fixture();
  const policy = JSON.parse(await readFile(paths.policy, 'utf8'));
  policy.reviewedAt = '2026-08-01';
  policy.expiresAt = '2026-08-10T00:00:00Z';
  await writeFile(paths.policy, JSON.stringify(policy));
  const result = run(paths, [], { STATIC_FINDINGS_NOW: '2026-08-11T00:00:00Z' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expired/);
});

test('rejects an invalid policy clock override instead of disabling date checks', async () => {
  const paths = await fixture();
  const result = run(paths, [], { STATIC_FINDINGS_NOW: 'not-a-date' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STATIC_FINDINGS_NOW must be an ISO-8601 value/);
});

test('rejects malformed analyzer output', async () => {
  const paths = await fixture();
  await writeFile(paths.slither, '{not-json');
  const result = run(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not valid JSON/);
});

test('rejects Slither JSON that does not explicitly report successful execution', async () => {
  const paths = await fixture();
  const current = reports();
  current.slither.success = false;
  await writeFile(paths.slither, JSON.stringify(current.slither));
  const result = run(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing a successful detector result array/);
});

test('rejects a rationale without complete review metadata', async () => {
  const paths = await fixture();
  const policy = JSON.parse(await readFile(paths.policy, 'utf8'));
  delete policy.reviewProfiles['synthetic-review'].compensatingControls;
  await writeFile(paths.policy, JSON.stringify(policy));
  const result = run(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid compensatingControls/);
});

test('rejects stale per-finding reviewer metadata', async () => {
  const paths = await fixture();
  const policy = JSON.parse(await readFile(paths.policy, 'utf8'));
  policy.entries[0].reviewerId = 'unreviewed';
  await writeFile(paths.policy, JSON.stringify(policy));
  const result = run(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale review metadata/);
});

test('rejects a stale detector rationale with no current finding', async () => {
  const paths = await fixture();
  const policy = JSON.parse(await readFile(paths.policy, 'utf8'));
  policy.rationales['slither:stale-detector'] =
    'This stale synthetic detector rationale must not survive after its last exact finding disappears.';
  policy.rationaleProfiles['slither:stale-detector'] = 'synthetic-review';
  await writeFile(paths.policy, JSON.stringify(policy));
  const result = run(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale detector rationales: slither:stale-detector/);
});
