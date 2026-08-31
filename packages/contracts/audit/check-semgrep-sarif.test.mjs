import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { requireExactSemgrepResults, validateSemgrepPolicy, validateSemgrepSarif } from './check-semgrep-sarif.mjs';

const AUDIT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CHECKER = path.join(AUDIT_DIRECTORY, 'check-semgrep-sarif.mjs');
const CONFIG = path.join(AUDIT_DIRECTORY, 'semgrep.yml');
const FIXTURE = path.join(AUDIT_DIRECTORY, 'fixtures', 'semgrep', 'SyntaxCoverage.sol');
const RUNNER = path.join(AUDIT_DIRECTORY, 'run-static.sh');

function finding(line, snippet, pathName = 'src/core/Fund.sol') {
  return {
    ruleId: 'gumball-no-inline-assembly',
    message: { text: 'Inline assembly requires a separately reviewed, documented exception.' },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: pathName, uriBaseId: '%SRCROOT%' },
          region: { endLine: line, startLine: line, snippet: { text: snippet } },
        },
      },
    ],
  };
}

function sarif({ executionSuccessful = true, notifications = [], results = [] } = {}) {
  return {
    version: '2.1.0',
    runs: [
      {
        invocations: [{ executionSuccessful, toolExecutionNotifications: notifications }],
        results,
        tool: { driver: { name: 'Semgrep OSS' } },
      },
    ],
  };
}

function policy(entries) {
  return {
    version: 1,
    entries: entries.map(({ endLine, path: pathName, ruleId, startLine }) => ({
      endLine,
      path: pathName,
      rationale: 'This synthetic assembly location is exact and reviewed only for the isolated regression fixture.',
      ruleId,
      startLine,
    })),
  };
}

function normalized(result) {
  const region = result.locations[0].physicalLocation.region;
  return {
    endLine: region.endLine,
    path: result.locations[0].physicalLocation.artifactLocation.uri,
    ruleId: result.ruleId,
    startLine: region.startLine,
  };
}

test('accepts only the two exact reviewed Fund assembly locations', () => {
  const results = [finding(200, 'assembly ("memory-safe") {'), finding(210, 'assembly ("memory-safe") {')];
  const document = sarif({ results });
  const exactPolicy = policy(results.map(normalized));

  assert.equal(validateSemgrepSarif(document), document);
  assert.equal(validateSemgrepPolicy(exactPolicy), exactPolicy);
  assert.equal(requireExactSemgrepResults(document, exactPolicy), document);
});

test('rejects Solidity parse warnings even when all emitted findings are reviewed', () => {
  const results = [finding(200, 'assembly ("memory-safe") {'), finding(210, 'assembly ("memory-safe") {')];
  const document = sarif({
    notifications: [
      {
        descriptor: { id: 'Syntax error' },
        level: 'warning',
        message: { text: 'Syntax error at line src/core/Bribe.sol:51: `address` was unexpected' },
      },
    ],
    results,
  });

  assert.throws(
    () => requireExactSemgrepResults(document, policy(results.map(normalized))),
    /parse failure[\s\S]*Bribe/u,
  );
});

test('rejects an unsuccessful invocation and any new or moved assembly location', () => {
  assert.throws(() => validateSemgrepSarif(sarif({ executionSuccessful: false })), /was not successful/u);

  const expectedResult = finding(200, 'assembly ("memory-safe") {');
  const movedResult = finding(201, 'assembly ("memory-safe") {');
  assert.throws(
    () => requireExactSemgrepResults(sarif({ results: [movedResult] }), policy([normalized(expectedResult)])),
    /NEW .*Fund\.sol\|201\|201[\s\S]*STALE .*Fund\.sol\|200\|200/u,
  );
});

test('the regression source pins parser-hostile syntax, lexical positives, and comment or identifier near misses', async () => {
  const source = await readFile(FIXTURE, 'utf8');
  const lines = source.split('\n');
  assert.match(lines[4], /mapping\(address account => uint256 amount\)/u);
  assert.match(lines[6], /tx_origin/u);
  assert.match(lines[9], /suicideCounter/u);
  assert.match(lines[14], /^\s*\/\/ Near misses: tx\.origin/u);
  assert.match(lines[16], /Block-comment near misses: tx\.origin/u);
  assert.match(lines[20], /^\s*"tx\.origin target\.delegatecall/u);
  assert.match(lines[23], /tx\.origin/u);
  assert.match(lines[24], /tx\.\/\* lexical trivia \*\/ origin/u);
  assert.match(lines[25], /\.delegatecall\(/u);
  assert.match(lines[26], /\.call\(/u);
  assert.match(lines[27], /\.call\{/u);
  assert.match(lines[28], /selfdestruct\(/u);
  assert.match(lines[29], /suicide\(/u);
  assert.match(lines[30], /^\s*unchecked \{/u);
  assert.match(lines[37], /^\s*assembly \{/u);
  assert.match(lines[43], /^\s*assembly \("memory-safe"\) \{/u);
  assert.match(lines[50], /\.delegatecaller\(/u);
  assert.match(lines[51], /\.callback\(/u);

  const config = await readFile(CONFIG, 'utf8');
  assert.equal(config.match(/languages: \[generic\]/gu)?.length, 6);
  assert.equal(config.match(/pattern-regex:/gu)?.length, 6);
  assert.doesNotMatch(config, /languages: \[solidity\]/u);
  assert.equal(config.match(/\(\*SKIP\)\(\*F\)/gu)?.length, 6);
});

test('the real generic Semgrep config finds exact lexical positives without Solidity parser notifications', async (t) => {
  const semgrep = process.env.SEMGREP_BIN ?? 'semgrep';
  const version = spawnSync(semgrep, ['--version'], { encoding: 'utf8' });
  if (version.error?.code === 'ENOENT') {
    t.skip('Semgrep is not installed in this unit-test environment');
    return;
  }
  assert.equal(version.status, 0, version.stderr);

  const directory = await mkdtemp(path.join(tmpdir(), 'gumball-semgrep-regression-'));
  const report = path.join(directory, 'semgrep.sarif');
  const scan = spawnSync(
    semgrep,
    [
      'scan',
      '--config',
      CONFIG,
      '--strict',
      '--no-rewrite-rule-ids',
      '--no-git-ignore',
      '--sarif',
      '--output',
      report,
      FIXTURE,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(scan.status, 0, scan.stderr);

  const document = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(validateSemgrepSarif(document), document);
  assert.equal(
    document.runs.flatMap((run) => run.invocations.flatMap((invocation) => invocation.toolExecutionNotifications ?? []))
      .length,
    0,
  );
  const locations = document.runs.flatMap((run) =>
    run.results.map((result) => ({
      line: result.locations[0].physicalLocation.region.startLine,
      ruleId: result.ruleId,
    })),
  );
  assert.deepEqual(locations, [
    { line: 24, ruleId: 'gumball-no-tx-origin' },
    { line: 25, ruleId: 'gumball-no-tx-origin' },
    { line: 26, ruleId: 'gumball-no-delegatecall' },
    { line: 27, ruleId: 'gumball-no-generic-low-level-call' },
    { line: 28, ruleId: 'gumball-no-generic-low-level-call' },
    { line: 29, ruleId: 'gumball-no-selfdestruct' },
    { line: 30, ruleId: 'gumball-no-selfdestruct' },
    { line: 31, ruleId: 'gumball-no-unchecked-block' },
    { line: 38, ruleId: 'gumball-no-inline-assembly' },
    { line: 44, ruleId: 'gumball-no-inline-assembly' },
  ]);
});

test('the static runner policy-gates successful Slither and Semgrep finding exits', async () => {
  const runner = await readFile(RUNNER, 'utf8');
  const slitherBlock = runner.slice(runner.indexOf('slither_exit=0'), runner.indexOf('if ! aderyn .'));
  const semgrepBlock = runner.slice(runner.indexOf('semgrep_exit=0'), runner.indexOf('if git -C'));
  assert.match(slitherBlock, /slither \.[\s\S]*\|\| slither_exit=\$\?/u);
  assert.doesNotMatch(slitherBlock, /\|\| true/u);
  assert.doesNotMatch(slitherBlock, /if ! slither/u);
  assert.match(runner, /\.success == true and \(\.results\.detectors \| type == "array"\)/u);
  assert.match(slitherBlock, /if jq[\s\S]*reviewed findings remain policy-gated[\s\S]*else[\s\S]*status=1/u);
  assert.match(semgrepBlock, /semgrep scan[\s\S]*\|\| semgrep_exit=\$\?/u);
  assert.doesNotMatch(semgrepBlock, /if ! semgrep scan/u);
  assert.match(semgrepBlock, /--strict[\s\S]*--no-rewrite-rule-ids/u);
  assert.match(semgrepBlock, /if \(\(semgrep_exit > 1\)\)[\s\S]*status=1/u);
  assert.match(semgrepBlock, /check-semgrep-sarif\.mjs/u);
  assert.doesNotMatch(runner, /\.results \| type == "array" and length == 0/u);
});

test('the Semgrep checker CLI accepts an exact clean register', async () => {
  const results = [finding(200, 'assembly ("memory-safe") {'), finding(210, 'assembly ("memory-safe") {')];
  const directory = await mkdtemp(path.join(tmpdir(), 'gumball-semgrep-checker-'));
  const policyPath = path.join(directory, 'policy.json');
  const sarifPath = path.join(directory, 'semgrep.sarif');
  await Promise.all([
    writeFile(policyPath, JSON.stringify(policy(results.map(normalized))), 'utf8'),
    writeFile(sarifPath, JSON.stringify(sarif({ results })), 'utf8'),
  ]);

  const checked = spawnSync(process.execPath, [CHECKER, policyPath, sarifPath], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /accepted 2 exact reviewed results/u);
});
