#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { EXPECTED_ECHIDNA_PROPERTIES } from './check-echidna-results.mjs';

export const EXPECTED_MEDUSA_ACTIONS = Object.freeze([
  'signalDefault',
  'withdrawDefault',
  'addSignal',
  'removeSignal',
  'reallocateSignal',
  'addSignalMany',
  'removeSignalMany',
  'mine',
  'donateRevenue',
  'donateRevenueDirectly',
  'recordRevenueIndex',
  'distributeAll',
  'distributeOne',
  'buy',
  'claimRewards',
  'notifySupplementalReward',
  'claimOneReward',
  'routeBribeRewards',
  'setBribeBps',
  'claimMinerPayment',
  'redeem',
  'burnFundGBX',
  'killStrategy',
  'addStrategy',
]);

const CRITICAL_COVERAGE_MARKERS = Object.freeze([
  {
    label: 'positive-price Strategy payment classification',
    source: 'expectedPaymentTotal[strategyAddress] += price;',
  },
  {
    label: 'signal exit execution',
    source: '(bool succeeded,) = actor.tryRun(address(signalGBX), data);',
  },
  {
    label: 'exact signal-principal comparison',
    source: 'if (gbx.balanceOf(address(actor)) != principalBefore + expectedPrincipal) {',
  },
]);

function fail(message) {
  throw new Error(message);
}

function sourceLineForUniqueMarker(source, marker, label) {
  const lines = source.split('\n');
  const matches = [];
  for (let index = 0; index < lines.length; ++index) {
    if (lines[index].includes(marker)) matches.push(index + 1);
  }
  if (matches.length !== 1) {
    fail(`Medusa coverage marker for ${label} must occur exactly once; observed ${matches.length}`);
  }
  return matches[0];
}

function campaignLineCoverage(coverageSource) {
  const records = coverageSource.split(/^end_of_record\s*$/mu);
  const campaignRecords = records.filter((record) =>
    /^SF:.*(?:^|\/)audit\/harness\/ProtocolStateMachineCampaign\.sol\s*$/mu.test(record),
  );
  if (campaignRecords.length !== 1) {
    fail(`Medusa LCOV must contain exactly one campaign source record; observed ${campaignRecords.length}`);
  }

  const covered = new Map();
  for (const match of campaignRecords[0].matchAll(/^DA:(\d+),(\d+)(?:,.*)?$/gmu)) {
    covered.set(Number(match[1]), Number(match[2]));
  }
  if (covered.size === 0) fail('Medusa LCOV campaign record contains no executable-line data');
  return covered;
}

function requireCoveredLine(covered, line, label) {
  const hits = covered.get(line);
  if (!Number.isSafeInteger(hits) || hits <= 0) {
    fail(`Medusa did not cover ${label} at ProtocolStateMachineCampaign.sol:${line}`);
  }
}

export function validateMedusaResult(source, configSource, campaignSource, coverageSource) {
  const config = JSON.parse(configSource);
  const requiredCalls = config?.fuzzing?.testLimit;
  if (!Number.isInteger(requiredCalls) || requiredCalls <= 0) fail('Medusa config has no positive integer testLimit');
  if (config?.fuzzing?.testing?.stopOnFailedContractMatching !== true) {
    fail('Medusa config must stop when deployed bytecode cannot be matched to current compilation artifacts');
  }

  if (/\[FAILED\]|fatal|panic|crash|segmentation fault/iu.test(source)) {
    fail('Medusa output reports a failure or process crash');
  }

  const callCounts = [...source.matchAll(/^⇾ fuzz:.*?calls:\s*(\d+)/gmu)].map((match) => Number(match[1]));
  const observedCalls = callCounts.length === 0 ? 0 : Math.max(...callCounts);
  if (observedCalls < requiredCalls) {
    fail(`Medusa stopped below its configured call limit: observed ${observedCalls}, required ${requiredCalls}`);
  }

  const passedProperties = [
    ...source.matchAll(/^⇾ \[PASSED\] Property Test: ProtocolStateMachineCampaign\.(echidna_[A-Za-z0-9_]+)\(\)$/gmu),
  ].map((match) => match[1]);
  const observedProperties = [...new Set(passedProperties)].sort();
  const expectedProperties = [...EXPECTED_ECHIDNA_PROPERTIES].sort();
  if (
    observedProperties.length !== expectedProperties.length ||
    observedProperties.some((name, index) => name !== expectedProperties[index])
  ) {
    fail(
      `Medusa property manifest mismatch: expected ${expectedProperties.join(', ')}, observed ${observedProperties.join(', ')}`,
    );
  }

  const summary = source.match(/Test summary:\s*(\d+) test\(s\) passed,\s*(\d+) test\(s\) failed/u);
  if (summary === null || Number(summary[2]) !== 0 || Number(summary[1]) < expectedProperties.length) {
    fail('Medusa output has no complete zero-failure summary');
  }

  if (typeof campaignSource !== 'string' || campaignSource.length === 0) {
    fail('Medusa validation requires the exact campaign source');
  }
  if (typeof coverageSource !== 'string' || coverageSource.length === 0) {
    fail('Medusa validation requires the generated LCOV receipt');
  }
  const covered = campaignLineCoverage(coverageSource);
  for (const action of EXPECTED_MEDUSA_ACTIONS) {
    const marker = `_markAction("${action}");`;
    const line = sourceLineForUniqueMarker(campaignSource, marker, `successful ${action} action`);
    requireCoveredLine(covered, line, `a successful ${action} action`);
  }
  for (const marker of CRITICAL_COVERAGE_MARKERS) {
    const line = sourceLineForUniqueMarker(campaignSource, marker.source, marker.label);
    requireCoveredLine(covered, line, marker.label);
  }

  return { observedCalls, propertyCount: observedProperties.length, passedTests: Number(summary[1]) };
}

async function main() {
  const [resultPath, configPath, campaignPath, coveragePath] = process.argv.slice(2);
  if (
    resultPath === undefined ||
    configPath === undefined ||
    campaignPath === undefined ||
    coveragePath === undefined
  ) {
    throw new Error('usage: check-medusa-results.mjs <medusa-output> <medusa-config> <campaign-source> <lcov>');
  }
  const [source, configSource, campaignSource, coverageSource] = await Promise.all([
    readFile(resultPath, 'utf8'),
    readFile(configPath, 'utf8'),
    readFile(campaignPath, 'utf8'),
    readFile(coveragePath, 'utf8'),
  ]);
  const summary = validateMedusaResult(source, configSource, campaignSource, coverageSource);
  console.log(
    `Medusa campaign validated: ${summary.observedCalls} calls, ${summary.propertyCount} properties, ${summary.passedTests} total tests`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Medusa campaign validation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
