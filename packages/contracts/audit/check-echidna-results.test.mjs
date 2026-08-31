import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXPECTED_ECHIDNA_ACTIONS,
  EXPECTED_ECHIDNA_PROPERTIES,
  validateEchidnaResult,
} from './check-echidna-results.mjs';

const config = 'testLimit: 100000\nseed: 6900\n';

function passedReceipt({ calls = 100_123, properties = EXPECTED_ECHIDNA_PROPERTIES, seed = 6900 } = {}) {
  const propertyLines = properties.map((name) => `${name}: passing`).join('\n');
  return `[status] tests: 0/27, fuzzing: ${calls}/100000, values: [], cov: 1, corpus: 1\n${propertyLines}\nUnique instructions: 1\nUnique codehashes: 1\nCorpus size: 1\nSeed: ${seed}\nTotal calls: ${calls}\n`;
}

function coverageFixture({ uncoveredAction, uncoveredCritical } = {}) {
  const sourceLines = ['contract ProtocolStateMachineCampaign {'];
  const actionLines = new Map();
  for (const action of EXPECTED_ECHIDNA_ACTIONS) {
    sourceLines.push(`    function action_${action}() external { _markAction("${action}"); }`);
    actionLines.set(action, sourceLines.length);
  }
  sourceLines.push('    function buyCritical() external { expectedPaymentTotal[strategyAddress] += price; }');
  const positiveBuyLine = sourceLines.length;
  sourceLines.push(
    '    function exitCritical() external { (bool succeeded,) = actor.tryRun(address(signalGBX), data); }',
  );
  const exitLine = sourceLines.length;
  sourceLines.push(
    '    function principalCritical() external { if (gbx.balanceOf(address(actor)) != principalBefore + expectedPrincipal) { } }',
  );
  const principalLine = sourceLines.length;
  sourceLines.push('}');

  const criticalLines = { positiveBuyLine, exitLine, principalLine };
  const da = [];
  for (const [action, line] of actionLines) da.push(`DA:${line},${action === uncoveredAction ? 0 : 1}`);
  for (const [label, line] of Object.entries(criticalLines))
    da.push(`DA:${line},${label === uncoveredCritical ? 0 : 1}`);
  return {
    campaign: `${sourceLines.join('\n')}\n`,
    lcov: `SF:/workspace/packages/contracts/audit/harness/ProtocolStateMachineCampaign.sol\n${da.join('\n')}\nend_of_record\n`,
  };
}

function validate(source, fixture = coverageFixture(), configSource = config) {
  return validateEchidnaResult(source, configSource, fixture.campaign, fixture.lcov);
}

test('accepts a complete nonzero Echidna text campaign', () => {
  assert.deepEqual(validate(passedReceipt()), {
    observedCalls: 100_123,
    propertyCount: EXPECTED_ECHIDNA_PROPERTIES.length,
    seed: 6900,
    coveredActionCount: EXPECTED_ECHIDNA_ACTIONS.length,
  });
});

test("rejects Echidna's exit-zero worker crash", () => {
  assert.throws(
    () => validate(`[Worker 0] Crashed:\nSet.elemAt: index out of range\n${passedReceipt()}`),
    /worker crash/u,
  );
});

test('rejects a campaign whose progress stops below its configured call limit', () => {
  assert.throws(() => validate(passedReceipt({ calls: 99_999 })), /at least 100000/u);
});

test('rejects a final total below the configured call limit even after misleading progress', () => {
  const source = passedReceipt().replace('Total calls: 100123', 'Total calls: 99999');
  assert.throws(() => validate(source), /final total/u);
});

test('rejects a passing receipt that silently omits a required property', () => {
  assert.throws(
    () => validate(passedReceipt({ properties: EXPECTED_ECHIDNA_PROPERTIES.slice(1) })),
    /passing-property manifest mismatch/u,
  );
});

test('rejects an explicitly failed property and a missing final seed', () => {
  const failed = passedReceipt().replace(
    `${EXPECTED_ECHIDNA_PROPERTIES[0]}: passing`,
    `${EXPECTED_ECHIDNA_PROPERTIES[0]}: failed!`,
  );
  assert.throws(() => validate(failed), /failed property/u);
  assert.throws(() => validate(passedReceipt().replace('Seed: 6900\n', '')), /seed receipt/u);
  assert.throws(() => validate(passedReceipt({ seed: 6901 })), /does not match configured seed/u);
});

test('rejects Echidna 2.3.2 placeholder JSON despite success true and a full call counter', () => {
  const placeholders = {
    error: null,
    seed: 6900,
    success: true,
    tests: EXPECTED_ECHIDNA_PROPERTIES.map(() => ({
      contract: '',
      error: null,
      name: 'name',
      status: 'fuzzing',
      type: 'property',
    })),
  };
  const source = `[status] tests: 0/27, fuzzing: 100123/100000\n${JSON.stringify(placeholders)}\n`;
  assert.throws(() => validate(source), /final total-call receipt/u);
});

test('rejects a green campaign when an action never completes successfully', () => {
  assert.throws(
    () => validate(passedReceipt(), coverageFixture({ uncoveredAction: 'burnFundGBX' })),
    /successful burnFundGBX action/u,
  );
});

test('rejects a green campaign whose Strategy buys never classify a positive payment', () => {
  assert.throws(
    () => validate(passedReceipt(), coverageFixture({ uncoveredCritical: 'positiveBuyLine' })),
    /positive-price Strategy payment/u,
  );
});

test('fails closed without exact source and LCOV receipts', () => {
  const { campaign, lcov } = coverageFixture();
  assert.throws(() => validateEchidnaResult(passedReceipt(), config, '', lcov), /exact campaign source/u);
  assert.throws(() => validateEchidnaResult(passedReceipt(), config, campaign, ''), /generated LCOV/u);
});
