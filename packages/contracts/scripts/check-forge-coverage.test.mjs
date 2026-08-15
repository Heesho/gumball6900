import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkForgeCoverage, parseLcov } from './check-forge-coverage.mjs';
import { FORGE_COVERAGE_POLICY } from './forge-coverage-policy.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, '..');

const TEST_POLICY = [
  {
    path: 'src/Critical.sol',
    functions: { minimumBasisPoints: 50_00, minimumTotal: 2 },
    branches: { minimumBasisPoints: 50_00, minimumTotal: 2 },
    lines: { minimumBasisPoints: 50_00, minimumTotal: 2 },
  },
];

test('accepts a source record at every configured floor and ignores non-policy records', () => {
  const report = `${record('test/Noise.t.sol', [1], [], [1])}${record('/workspace/src/Critical.sol', [1, 0], [1, 0], [1, 0])}`;
  const [result] = checkForgeCoverage(report, TEST_POLICY);
  assert.equal(result.path, 'src/Critical.sol');
  assert.deepEqual(result.functions, { covered: 1, total: 2, basisPoints: 5_000 });
});

test('rejects a missing critical source record', () => {
  assert.throws(
    () => checkForgeCoverage(record('src/SomeOtherFile.sol', [1], [], [1]), TEST_POLICY),
    /src\/Critical\.sol: missing LCOV source record/,
  );
});

for (const [name, functionHits, branchHits, lineHits] of [
  ['function', [0, 0], [1, 0], [1, 0]],
  ['branch', [1, 0], [0, 0], [1, 0]],
  ['line', [1, 0], [1, 0], [0, 0]],
]) {
  test(`rejects ${name} coverage below its per-file floor`, () => {
    assert.throws(
      () => checkForgeCoverage(record('src/Critical.sol', functionHits, branchHits, lineHits), TEST_POLICY),
      new RegExp(`src/Critical\\.sol ${name}s?`),
    );
  });
}

test('rejects an instrumented denominator below its floor', () => {
  const report = record('src/Critical.sol', [1], [1], [1]);
  assert.throws(() => checkForgeCoverage(report, TEST_POLICY), /instrumented total 1 is below 2/);
});

test('rejects missing, empty, unterminated, duplicate, and summary-mismatched reports', () => {
  assert.throws(() => parseLcov(''), /empty/);
  assert.throws(() => parseLcov('TN:\nSF:src/Critical.sol\n'), /unterminated/);
  const valid = record('src/Critical.sol', [1], [1], [1]);
  assert.throws(() => parseLcov(`${valid}${valid}`), /duplicate source record/);
  assert.throws(() => parseLcov(valid.replace('FNH:1', 'FNH:0')), /summary\/detail mismatch for FNH/);
});

test('accepts a deliberate zero-branch floor only when the LCOV record has no branches', () => {
  const policy = [
    {
      ...TEST_POLICY[0],
      branches: { minimumBasisPoints: 0, minimumTotal: 0 },
    },
  ];
  const [result] = checkForgeCoverage(record('src/Critical.sol', [1, 0], [], [1, 0]), policy);
  assert.deepEqual(result.branches, { covered: 0, total: 0, basisPoints: 0 });
});

test('production policy exactly covers every direct core and governance contract', () => {
  const policySources = FORGE_COVERAGE_POLICY.map(({ path: source }) => source).sort();
  const productionSources = ['core', 'governance']
    .flatMap((directory) =>
      fs
        .readdirSync(path.join(CONTRACTS_DIRECTORY, `src/${directory}`), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sol'))
        .map((entry) => `src/${directory}/${entry.name}`),
    )
    .sort();

  assert.equal(new Set(policySources).size, FORGE_COVERAGE_POLICY.length);
  assert.deepEqual(policySources, productionSources);
  for (const { path: source } of FORGE_COVERAGE_POLICY) {
    assert.equal(fs.statSync(path.join(CONTRACTS_DIRECTORY, source)).isFile(), true, source);
  }
});

test('CLI fails closed when the requested LCOV report does not exist', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(SCRIPT_DIRECTORY, 'check-forge-coverage.mjs'), 'missing.info'],
    {
      cwd: CONTRACTS_DIRECTORY,
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot read Forge LCOV report/);
});

function record(source, functionHits, branchHits, lineHits) {
  const functions = functionHits.flatMap((hits, index) => [
    `FN:${index + 1},function${index}`,
    `FNDA:${hits},function${index}`,
  ]);
  const branches = branchHits.map((hits, index) => `BRDA:${index + 1},0,${index},${hits === 0 ? '-' : hits}`);
  const lines = lineHits.map((hits, index) => `DA:${index + 1},${hits}`);
  return [
    'TN:',
    `SF:${source}`,
    ...functions,
    ...lines,
    ...branches,
    `FNF:${functionHits.length}`,
    `FNH:${functionHits.filter((hits) => hits > 0).length}`,
    `BRF:${branchHits.length}`,
    `BRH:${branchHits.filter((hits) => hits > 0).length}`,
    `LF:${lineHits.length}`,
    `LH:${lineHits.filter((hits) => hits > 0).length}`,
    'end_of_record',
    '',
  ].join('\n');
}
