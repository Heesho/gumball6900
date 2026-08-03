import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateCodeqlSarif } from '../audit/check-codeql-sarif.mjs';
import {
  AUDIT_REPORT_FILENAMES,
  archiveCodeqlSarif,
  archiveCoverageReports,
  summarizeCoverage,
} from './archive-audit-reports.mjs';

const FIXTURE_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'audit',
  'fixtures',
  'codeql',
);

async function codeqlFixture(name) {
  return readFile(path.join(FIXTURE_DIRECTORY, name));
}

test('coverage summaries and artifacts use fixed audit-report paths and deterministic shapes', async () => {
  const contractsDirectory = await mkdtemp(path.join(os.tmpdir(), 'gbx-coverage-reports-'));
  try {
    const forge = lcov('src/Zeta.sol', [3, 0], [2, 0], [5, 1]);
    const hardhat = lcov('/workspace/packages/contracts/src/Alpha.sol', [1], [], [4, 0]);
    await mkdir(path.join(contractsDirectory, 'coverage'));
    await writeFile(path.join(contractsDirectory, 'lcov.info'), forge, 'utf8');
    await writeFile(path.join(contractsDirectory, 'coverage', 'lcov.info'), hardhat, 'utf8');

    const result = await archiveCoverageReports(contractsDirectory);
    assert.deepEqual(result.forgeSummary.metrics, {
      branches: { basisPoints: 5_000, covered: 1, total: 2 },
      functions: { basisPoints: 5_000, covered: 1, total: 2 },
      lines: { basisPoints: 10_000, covered: 2, total: 2 },
    });
    assert.equal(result.hardhatSummary.files[0].path, 'src/Alpha.sol');
    assert.deepEqual(
      (await readdir(path.join(contractsDirectory, 'audit', 'reports'))).sort(),
      [
        AUDIT_REPORT_FILENAMES.forgeCoverage,
        AUDIT_REPORT_FILENAMES.forgeCoverageSummary,
        AUDIT_REPORT_FILENAMES.hardhatCoverage,
        AUDIT_REPORT_FILENAMES.hardhatCoverageSummary,
      ].sort(),
    );
    const summaryPath = path.join(contractsDirectory, 'audit', 'reports', AUDIT_REPORT_FILENAMES.forgeCoverageSummary);
    const firstBytes = await readFile(summaryPath, 'utf8');
    await archiveCoverageReports(contractsDirectory);
    assert.equal(await readFile(summaryPath, 'utf8'), firstBytes);
    assert.equal(JSON.parse(firstBytes).kind, 'gumball-6900-contract-coverage-summary');
  } finally {
    await rm(contractsDirectory, { force: true, recursive: true });
  }
});

test('coverage archiving rejects malformed LCOV before writing evidence', async () => {
  const contractsDirectory = await mkdtemp(path.join(os.tmpdir(), 'gbx-invalid-coverage-'));
  try {
    await mkdir(path.join(contractsDirectory, 'coverage'));
    await writeFile(path.join(contractsDirectory, 'lcov.info'), 'not lcov\n', 'utf8');
    await writeFile(
      path.join(contractsDirectory, 'coverage', 'lcov.info'),
      lcov('src/Valid.sol', [1], [], [1]),
      'utf8',
    );
    await assert.rejects(archiveCoverageReports(contractsDirectory), /unterminated|no records/);
  } finally {
    await rm(contractsDirectory, { force: true, recursive: true });
  }
});

test('clean CodeQL post-processed SARIF is validated and preserved byte for byte under one fixed filename', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gbx-codeql-reports-'));
  try {
    const inputDirectory = path.join(root, 'post-processed');
    const contractsDirectory = path.join(root, 'contracts');
    await mkdir(inputDirectory, { recursive: true });
    const fixtureBytes = await codeqlFixture('clean.sarif');
    const sourceBytes = Buffer.from(fixtureBytes.toString('utf8').replaceAll('\n', '\r\n'));
    await writeFile(path.join(inputDirectory, 'javascript-typescript.sarif'), sourceBytes);
    const result = await archiveCodeqlSarif(inputDirectory, contractsDirectory);
    assert.equal(result.document.runs.length, 1);
    assert.equal(path.basename(result.output), AUDIT_REPORT_FILENAMES.codeqlSarif);
    assert.deepEqual(validateCodeqlSarif(JSON.parse(await readFile(result.output, 'utf8'))), result.document);
    assert.deepEqual(await readFile(result.output), sourceBytes);
    assert.deepEqual(
      result.inputFiles.map((file) => path.relative(inputDirectory, file)),
      ['javascript-typescript.sarif'],
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('CodeQL findings fail the archive command after the raw report is preserved for review', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gbx-codeql-finding-'));
  try {
    const inputDirectory = path.join(root, 'post-processed');
    const contractsDirectory = path.join(root, 'contracts');
    const sourceBytes = await codeqlFixture('finding.sarif');
    await mkdir(inputDirectory, { recursive: true });
    await writeFile(path.join(inputDirectory, 'javascript-typescript.sarif'), sourceBytes);

    await assert.rejects(archiveCodeqlSarif(inputDirectory, contractsDirectory), /zero results.*received 1/);
    const output = path.join(contractsDirectory, 'audit', 'reports', AUDIT_REPORT_FILENAMES.codeqlSarif);
    assert.deepEqual(await readFile(output), sourceBytes);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('CodeQL archiving rejects non-CodeQL and malformed reports before writing trusted evidence', async () => {
  for (const [fixtureName, expectedError] of [
    ['non-codeql.sarif', /tool driver must be "CodeQL"/],
    ['malformed-run.sarif', /explicit results array/],
    ['malformed-result.sarif', /nonempty ruleId and message text or markdown/],
  ]) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'gbx-codeql-invalid-'));
    try {
      const inputDirectory = path.join(root, 'post-processed');
      const contractsDirectory = path.join(root, 'contracts');
      const output = path.join(contractsDirectory, 'audit', 'reports', AUDIT_REPORT_FILENAMES.codeqlSarif);
      await mkdir(inputDirectory, { recursive: true });
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, await codeqlFixture('clean.sarif'));
      await writeFile(path.join(inputDirectory, 'javascript-typescript.sarif'), await codeqlFixture(fixtureName));
      await assert.rejects(archiveCodeqlSarif(inputDirectory, contractsDirectory), expectedError);

      await assert.rejects(readFile(output), (error) => error.code === 'ENOENT');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
});

test('CodeQL archiving rejects ambiguous multi-file action output', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gbx-codeql-ambiguous-'));
  try {
    const inputDirectory = path.join(root, 'post-processed');
    const contractsDirectory = path.join(root, 'contracts');
    const output = path.join(contractsDirectory, 'audit', 'reports', AUDIT_REPORT_FILENAMES.codeqlSarif);
    await mkdir(inputDirectory);
    await mkdir(path.dirname(output), { recursive: true });
    const sourceBytes = await codeqlFixture('clean.sarif');
    await writeFile(output, sourceBytes);
    await writeFile(path.join(inputDirectory, 'first.sarif'), sourceBytes);
    await writeFile(path.join(inputDirectory, 'second.sarif'), sourceBytes);
    await assert.rejects(archiveCodeqlSarif(inputDirectory, contractsDirectory), /exactly one/);
    await assert.rejects(readFile(output), (error) => error.code === 'ENOENT');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('coverage summarization rejects unknown tools', () => {
  assert.throws(() => summarizeCoverage('unknown', 'unknown.lcov', lcov('src/A.sol', [1], [], [1])), /Unsupported/);
});

function lcov(source, functionHits, branchHits, lineHits) {
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
