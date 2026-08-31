import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyMutationRun, validateBaselineRun } from './mutation-runner-policy.mjs';

const passedOutput = 'Ran 1 test for test/minimal/SignalGBX.t.sol:SignalGBXTest\nSuite result: ok';
const failedOutput = 'Ran 1 test for test/minimal/SignalGBX.t.sol:SignalGBXTest\nSuite result: FAILED';

test('accepts a successful baseline with executed-test evidence', () => {
  assert.doesNotThrow(() => validateBaselineRun({ status: 0, signal: null }, passedOutput, 'baseline'));
});

test('classifies only an executed failing test as a killed mutant', () => {
  assert.deepEqual(classifyMutationRun({ status: 1, signal: null }, failedOutput, 'mutant'), {
    killed: true,
    classification: 'test-killed',
  });
});

test('classifies an executed passing mutant as a test gap', () => {
  assert.deepEqual(classifyMutationRun({ status: 0, signal: null }, passedOutput, 'mutant'), {
    killed: false,
    classification: 'test-gap',
  });
});

test('rejects a missing executable instead of counting a kill', () => {
  assert.throws(
    () => classifyMutationRun({ status: null, signal: null, error: new Error('spawn forge ENOENT') }, '', 'mutant'),
    /could not start/u,
  );
});

test('rejects null status and process signals instead of counting kills', () => {
  assert.throws(() => classifyMutationRun(null, '', 'mutant'), /no process result/u);
  assert.throws(
    () => classifyMutationRun({ status: null, signal: null, error: null }, '', 'mutant'),
    /no numeric exit status/u,
  );
  assert.throws(
    () => classifyMutationRun({ status: null, signal: 'SIGKILL' }, '', 'mutant'),
    /terminated by signal SIGKILL/u,
  );
});

test('rejects compiler-killed mutants and missing test execution', () => {
  assert.throws(
    () => classifyMutationRun({ status: 1, signal: null }, 'Compiler run failed', 'mutant'),
    /stillborn mutant/u,
  );
  assert.throws(
    () => classifyMutationRun({ status: 1, signal: null }, 'No tests match the provided pattern', 'mutant'),
    /did not resolve/u,
  );
  assert.throws(
    () => classifyMutationRun({ status: 1, signal: null }, 'unexpected empty tool output', 'mutant'),
    /no executed-test evidence/u,
  );
});

test('rejects a failing unmutated baseline', () => {
  assert.throws(
    () => validateBaselineRun({ status: 1, signal: null }, failedOutput, 'baseline'),
    /baseline test failed before mutation/u,
  );
});
