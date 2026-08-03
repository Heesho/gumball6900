import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { codeqlResults, requireZeroCodeqlResults, validateCodeqlSarif } from './check-codeql-sarif.mjs';

const AUDIT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CHECKER = path.join(AUDIT_DIRECTORY, 'check-codeql-sarif.mjs');
const FIXTURE_DIRECTORY = path.join(AUDIT_DIRECTORY, 'fixtures', 'codeql');

async function fixture(name) {
  return JSON.parse(await readFile(path.join(FIXTURE_DIRECTORY, name), 'utf8'));
}

function runFixture(name) {
  return spawnSync(process.execPath, [CHECKER, path.join(FIXTURE_DIRECTORY, name)], { encoding: 'utf8' });
}

test('accepts a well-formed CodeQL SARIF report with zero results', async () => {
  const document = await fixture('clean.sarif');
  assert.equal(validateCodeqlSarif(document), document);
  assert.deepEqual(codeqlResults(document), []);
  assert.equal(requireZeroCodeqlResults(document), document);

  const result = runFixture('clean.sarif');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /contains zero results/);
});

test('rejects every well-formed CodeQL result because no findings are accepted', async () => {
  const document = await fixture('finding.sarif');
  assert.equal(codeqlResults(document).length, 1);
  assert.throws(() => requireZeroCodeqlResults(document), /zero results.*received 1 \(js\/example\)/);

  const result = runFixture('finding.sarif');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no CodeQL findings are accepted/);
});

test('rejects SARIF runs that are not identified as CodeQL', async () => {
  const document = await fixture('non-codeql.sarif');
  assert.throws(() => validateCodeqlSarif(document), /tool driver must be "CodeQL"/);
  assert.notEqual(runFixture('non-codeql.sarif').status, 0);
});

test('rejects malformed CodeQL runs and malformed results', async () => {
  const malformedRun = await fixture('malformed-run.sarif');
  const malformedResult = await fixture('malformed-result.sarif');
  assert.throws(() => validateCodeqlSarif(malformedRun), /explicit results array/);
  assert.throws(() => validateCodeqlSarif(malformedResult), /nonempty ruleId and message text or markdown/);
  assert.notEqual(runFixture('malformed-run.sarif').status, 0);
  assert.notEqual(runFixture('malformed-result.sarif').status, 0);
});

test('rejects malformed SARIF roots and unreadable JSON', () => {
  assert.throws(() => validateCodeqlSarif({ runs: [], version: '2.1.0' }), /at least one run/);
  const result = runFixture('missing.sarif');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot parse CodeQL SARIF file/);
});
