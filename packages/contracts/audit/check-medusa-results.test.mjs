import assert from 'node:assert/strict';
import test from 'node:test';

import { EXPECTED_ECHIDNA_PROPERTIES } from './check-echidna-results.mjs';
import { EXPECTED_MEDUSA_ACTIONS, validateMedusaResult } from './check-medusa-results.mjs';

const config = JSON.stringify({
  fuzzing: { testLimit: 100_000, testing: { stopOnFailedContractMatching: true } },
});
const passedProperties = EXPECTED_ECHIDNA_PROPERTIES.map(
  (name) => `⇾ [PASSED] Property Test: ProtocolStateMachineCampaign.${name}()`,
).join('\n');
const passed = `⇾ fuzz: elapsed: 1s, calls: 100123 (1/sec)\n${passedProperties}\n⇾ Test summary: 74 test(s) passed, 0 test(s) failed\n`;

function coverageFixture({ uncoveredAction, uncoveredCritical } = {}) {
  const sourceLines = ['contract ProtocolStateMachineCampaign {'];
  const actionLines = new Map();
  for (const action of EXPECTED_MEDUSA_ACTIONS) {
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

test('accepts a complete Medusa campaign with exact properties and successful action coverage', () => {
  const { campaign, lcov } = coverageFixture();
  assert.deepEqual(validateMedusaResult(passed, config, campaign, lcov), {
    observedCalls: 100_123,
    propertyCount: EXPECTED_ECHIDNA_PROPERTIES.length,
    passedTests: 74,
  });
});

test('rejects a campaign below the configured call limit', () => {
  const { campaign, lcov } = coverageFixture();
  assert.throws(() => validateMedusaResult(passed.replace('100123', '99999'), config, campaign, lcov), /call limit/u);
});

test('rejects a config that permits unmatched deployed bytecode', () => {
  const { campaign, lcov } = coverageFixture();
  const unsafeConfig = JSON.stringify({
    fuzzing: { testLimit: 100_000, testing: { stopOnFailedContractMatching: false } },
  });
  assert.throws(() => validateMedusaResult(passed, unsafeConfig, campaign, lcov), /must stop.*matched/u);
});

test('rejects a missing required property even with a green summary', () => {
  const { campaign, lcov } = coverageFixture();
  const incomplete = passed.replace(
    `⇾ [PASSED] Property Test: ProtocolStateMachineCampaign.${EXPECTED_ECHIDNA_PROPERTIES[0]}()\n`,
    '',
  );
  assert.throws(() => validateMedusaResult(incomplete, config, campaign, lcov), /property manifest mismatch/u);
});

test('rejects failed or crashed output', () => {
  const { campaign, lcov } = coverageFixture();
  assert.throws(
    () => validateMedusaResult(`${passed}\n⇾ [FAILED] Property Test: x`, config, campaign, lcov),
    /failure or process crash/u,
  );
  assert.throws(
    () => validateMedusaResult(`${passed}\nworker crashed`, config, campaign, lcov),
    /failure or process crash/u,
  );
});

test('rejects an absent or nonzero-failure summary', () => {
  const { campaign, lcov } = coverageFixture();
  assert.throws(
    () => validateMedusaResult(passed.replace('0 test(s) failed', '1 test(s) failed'), config, campaign, lcov),
    /zero-failure summary/u,
  );
});

test('rejects a green campaign when an action never completes successfully', () => {
  const { campaign, lcov } = coverageFixture({ uncoveredAction: 'burnFundGBX' });
  assert.throws(() => validateMedusaResult(passed, config, campaign, lcov), /successful burnFundGBX action/u);
});

test('rejects a green campaign whose Strategy buys never classify a positive payment', () => {
  const { campaign, lcov } = coverageFixture({ uncoveredCritical: 'positiveBuyLine' });
  assert.throws(() => validateMedusaResult(passed, config, campaign, lcov), /positive-price Strategy payment/u);
});

test('fails closed without exact source and LCOV receipts', () => {
  const { campaign, lcov } = coverageFixture();
  assert.throws(() => validateMedusaResult(passed, config, '', lcov), /exact campaign source/u);
  assert.throws(() => validateMedusaResult(passed, config, campaign, ''), /generated LCOV/u);
});
