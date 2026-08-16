import assert from 'node:assert/strict';
import test from 'node:test';

import { validateEchidnaResult } from './check-echidna-results.mjs';

const config = 'testLimit: 100000\n';
const passed = {
  error: null,
  seed: 6900,
  success: true,
  tests: [{ error: null, name: 'echidna_supplyReconciles', status: 'passed', type: 'property' }],
};

test('accepts a complete nonzero Echidna campaign', () => {
  const summary = validateEchidnaResult(
    `[status] tests: 0/1, fuzzing: 100123/100000, values: [], cov: 1, corpus: 1\n${JSON.stringify(passed)}\n`,
    config,
  );
  assert.deepEqual(summary, { observedCalls: 100123, propertyCount: 1, seed: 6900 });
});

test("rejects Echidna's exit-zero worker crash", () => {
  assert.throws(
    () =>
      validateEchidnaResult(
        `[Worker 0] Crashed:\nSet.elemAt: index out of range\n[status] tests: 0/1, fuzzing: 0/100000\n${JSON.stringify({ ...passed, tests: [{ ...passed.tests[0], status: 'fuzzing' }] })}`,
        config,
      ),
    /worker crash/u,
  );
});

test('rejects a campaign that stops below its configured call limit', () => {
  assert.throws(
    () => validateEchidnaResult(`[status] tests: 0/1, fuzzing: 99999/100000\n${JSON.stringify(passed)}`, config),
    /at least 100000/u,
  );
});

test('rejects incomplete property status even when Echidna reports success', () => {
  const incomplete = { ...passed, tests: [{ ...passed.tests[0], status: 'fuzzing' }] };
  assert.throws(
    () => validateEchidnaResult(`[status] tests: 0/1, fuzzing: 100000/100000\n${JSON.stringify(incomplete)}`, config),
    /incomplete or failed/u,
  );
});
