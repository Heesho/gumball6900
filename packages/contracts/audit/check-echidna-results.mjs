#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_ECHIDNA_PROPERTIES = Object.freeze([
  'echidna_signalReceiptIsFullyCollateralized',
  'echidna_gbxSupplyReconciles',
  'echidna_mineIsTheOnlyLifetimeIssuer',
  'echidna_miningAuthorityRemainsFinal',
  'echidna_effectiveSupplyIncludesPendingMining',
  'echidna_strategyWeightsSumToTheGlobalTotal',
  'echidna_accountWeightsSumToTheGlobalTotal',
  'echidna_signalWeightNeverExceedsTheReceiptBalance',
  'echidna_everyAccountExitRemainsBounded',
  'echidna_signalExitsReturnExactPrincipal',
  'echidna_rewardTokenLoopsStayBounded',
  'echidna_bribeAccountingMirrorsResonance',
  'echidna_resonanceIsSolventAgainstClaimableRevenue',
  'echidna_resonanceIsSolventIncludingScheduled',
  'echidna_revenueStreamStateIsCoherent',
  'echidna_deadStrategiesAreExcludedFromActiveWeight',
  'echidna_checkpointsNeverLeadTheGlobalIndex',
  'echidna_bribesAreSolventAgainstAccruedRewards',
  'echidna_bribeSchedulesAndLifetimeStayBounded',
  'echidna_bribeRouterBalancesReconcile',
  'echidna_bribeBpsPolicyIsBounded',
  'echidna_atLeastOneStrategyRemainsLive',
  'echidna_auctionPricesStayWithinTheirBounds',
  'echidna_gbxPaymentsLeaveStrategy',
  'echidna_miningAccountingStaysBoundedAndSolvent',
  'echidna_usdgIsConserved',
  'echidna_revenueIndexIsMonotonic',
]);

export const EXPECTED_ECHIDNA_ACTIONS = Object.freeze([
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
    fail(`Echidna coverage marker for ${label} must occur exactly once; observed ${matches.length}`);
  }
  return matches[0];
}

function campaignLineCoverage(coverageSource) {
  const records = coverageSource.split(/^end_of_record\s*$/mu);
  const campaignRecords = records.filter((record) =>
    /^SF:.*(?:^|\/)audit\/harness\/ProtocolStateMachineCampaign\.sol\s*$/mu.test(record),
  );
  if (campaignRecords.length !== 1) {
    fail(`Echidna LCOV must contain exactly one campaign source record; observed ${campaignRecords.length}`);
  }

  const covered = new Map();
  for (const match of campaignRecords[0].matchAll(/^DA:(\d+),(\d+)(?:,.*)?$/gmu)) {
    covered.set(Number(match[1]), Number(match[2]));
  }
  if (covered.size === 0) fail('Echidna LCOV campaign record contains no executable-line data');
  return covered;
}

function requireCoveredLine(covered, line, label) {
  const hits = covered.get(line);
  if (!Number.isSafeInteger(hits) || hits <= 0) {
    fail(`Echidna did not cover ${label} at ProtocolStateMachineCampaign.sol:${line}`);
  }
}

export function validateEchidnaResult(source, configSource, campaignSource, coverageSource) {
  if (/\bCrashed:\s*$/mu.test(source)) fail('Echidna reported a worker crash');
  if (/Set\.elemAt: index out of range/u.test(source)) fail('Echidna reported an empty-call-set crash');
  if (/^echidna_[A-Za-z0-9_]+:\s*(?:failed|falsified|error)/imu.test(source)) {
    fail('Echidna reported a failed property');
  }
  if (/\b(?:fatal|panic|segmentation fault)\b/iu.test(source)) fail('Echidna reported a process failure');

  const limitMatch = /^testLimit:\s*(\d+)\s*$/mu.exec(configSource);
  if (limitMatch === null) fail('Echidna config lacks a numeric testLimit');
  const expectedCalls = Number(limitMatch[1]);
  if (!Number.isSafeInteger(expectedCalls) || expectedCalls <= 0) fail('Echidna testLimit is invalid');

  const progress = [...source.matchAll(/\bfuzzing:\s*(\d+)\/(\d+)/gu)].map((match) => ({
    calls: Number(match[1]),
    limit: Number(match[2]),
  }));
  if (progress.length === 0) fail('Echidna output contains no transaction-count progress evidence');
  if (progress.some(({ limit }) => limit !== expectedCalls)) fail('Echidna output used an unexpected test limit');
  const observedCalls = Math.max(...progress.map(({ calls }) => calls));
  if (observedCalls < expectedCalls) {
    fail(`Echidna stopped after ${observedCalls} calls; at least ${expectedCalls} were required`);
  }

  const totalCallsMatch = /^Total calls:\s*(\d+)\s*$/mu.exec(source);
  if (totalCallsMatch === null) fail('Echidna output contains no final total-call receipt');
  const totalCalls = Number(totalCallsMatch[1]);
  if (!Number.isSafeInteger(totalCalls) || totalCalls < expectedCalls) {
    fail(`Echidna final total was ${totalCalls}; at least ${expectedCalls} calls were required`);
  }

  const propertyLines = [
    ...source.matchAll(/^(echidna_[A-Za-z0-9_]+):\s*passing(?:\s*[!\p{Emoji_Presentation}\uFE0F]*)?\s*$/gmu),
  ];
  const observedProperties = propertyLines.map((match) => match[1]).sort();
  const expectedProperties = [...EXPECTED_ECHIDNA_PROPERTIES].sort();
  if (
    observedProperties.length !== expectedProperties.length ||
    observedProperties.some((name, index) => name !== expectedProperties[index])
  ) {
    fail(
      `Echidna passing-property manifest mismatch: expected ${expectedProperties.join(', ')}, observed ${observedProperties.join(', ')}`,
    );
  }

  const seedMatch = /^Seed:\s*(\d+)\s*$/mu.exec(source);
  if (seedMatch === null) fail('Echidna output contains no final seed receipt');
  const seed = Number(seedMatch[1]);
  if (!Number.isSafeInteger(seed)) fail('Echidna final seed is invalid');

  const configuredSeedMatch = /^seed:\s*(\d+)\s*$/mu.exec(configSource);
  if (configuredSeedMatch === null) fail('Echidna config lacks a numeric seed');
  const configuredSeed = Number(configuredSeedMatch[1]);
  if (!Number.isSafeInteger(configuredSeed) || configuredSeed < 0) fail('Echidna configured seed is invalid');
  if (seed !== configuredSeed) {
    fail(`Echidna receipt seed ${seed} does not match configured seed ${configuredSeed}`);
  }

  if (typeof campaignSource !== 'string' || campaignSource.length === 0) {
    fail('Echidna validation requires the exact campaign source');
  }
  if (typeof coverageSource !== 'string' || coverageSource.length === 0) {
    fail('Echidna validation requires the generated LCOV receipt');
  }
  const covered = campaignLineCoverage(coverageSource);
  for (const action of EXPECTED_ECHIDNA_ACTIONS) {
    const marker = `_markAction("${action}");`;
    const line = sourceLineForUniqueMarker(campaignSource, marker, `successful ${action} action`);
    requireCoveredLine(covered, line, `a successful ${action} action`);
  }
  for (const marker of CRITICAL_COVERAGE_MARKERS) {
    const line = sourceLineForUniqueMarker(campaignSource, marker.source, marker.label);
    requireCoveredLine(covered, line, marker.label);
  }

  return {
    observedCalls: totalCalls,
    propertyCount: observedProperties.length,
    seed,
    coveredActionCount: EXPECTED_ECHIDNA_ACTIONS.length,
  };
}

async function main() {
  if (process.argv.length !== 6) {
    fail(
      'Usage: check-echidna-results.mjs <echidna-output.txt> <echidna-config.yaml> <campaign-source.sol> <coverage.lcov>',
    );
  }
  const [resultPath, configPath, campaignPath, coveragePath] = process.argv
    .slice(2)
    .map((value) => path.resolve(value));
  const [source, configSource, campaignSource, coverageSource] = await Promise.all([
    readFile(resultPath, 'utf8'),
    readFile(configPath, 'utf8'),
    readFile(campaignPath, 'utf8'),
    readFile(coveragePath, 'utf8'),
  ]);
  const summary = validateEchidnaResult(source, configSource, campaignSource, coverageSource);
  process.stdout.write(
    `Echidna campaign accepted ${summary.observedCalls} calls across ${summary.propertyCount} properties and ${summary.coveredActionCount} successful actions (seed ${String(summary.seed)}).\n`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Echidna campaign validation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
