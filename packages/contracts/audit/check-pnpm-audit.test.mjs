import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateAuditReport } from './check-pnpm-audit.mjs';

function reportWith(advisory) {
  return { advisories: { [advisory.github_advisory_id]: advisory } };
}

test('accepts reports without high or critical advisories', () => {
  const result = evaluateAuditReport(
    reportWith({ github_advisory_id: 'GHSA-low', module_name: 'low-package', severity: 'low' }),
  );
  assert.deepEqual(result, { errors: [], reviewedHighOrCritical: 0 });
});

test('rejects a new high advisory', () => {
  const advisory = {
    findings: [{ paths: ['workspace>new-package'] }],
    github_advisory_id: 'GHSA-new-advisory',
    module_name: 'new-package',
    severity: 'high',
  };
  assert.match(evaluateAuditReport(reportWith(advisory)).errors[0], /high advisory/);
});

test('rejects a critical advisory without exceptions', () => {
  const advisory = {
    findings: [{ paths: ['workspace>critical-package'] }],
    github_advisory_id: 'GHSA-critical-advisory',
    module_name: 'critical-package',
    severity: 'critical',
  };
  assert.match(evaluateAuditReport(reportWith(advisory)).errors[0], /critical advisory/);
});

test('rejects malformed audit output', () => {
  assert.match(evaluateAuditReport({}).errors[0], /expected advisory report shape/);
});
