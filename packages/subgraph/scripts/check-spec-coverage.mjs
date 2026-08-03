#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, '..');

export const REQUIRED_ENTITIES = Object.freeze([
  'Protocol',
  'GBXToken',
  'Account',
  'GenesisBootstrap',
  'GenesisContribution',
  'GenesisClaim',
  'MiningEpoch',
  'MiningContribution',
  'MiningClaim',
  'VaultAsset',
  'VaultSnapshot',
  'Redemption',
  'RedemptionAsset',
  'SignalAccount',
  'SignalAllocation',
  'PendingSignal',
  'Strategy',
  'StrategyBudget',
  'StrategyFill',
  'ManagerRewardNotification',
  'ManagerRewardClaim',
  'Buyback',
  'Burn',
  'RevenueNotification',
  'LiquidityPool',
  'LiquidityPosition',
  'LiquidityEvent',
  'CorporateAction',
  'DailyProtocolSnapshot',
  'DailyAccountSnapshot',
]);

export const ACCOUNTING_EXTENSION_ENTITIES = Object.freeze(['ManagerRewardTerminalDust']);

export const REQUIRED_HANDLERS = Object.freeze([
  'handleAcquisitionAuctionStarted',
  'handleAcquisitionFilled',
  'handleAcquisitionStatusSet',
  'handleAssetRedeemed',
  'handleAssetRegistered',
  'handleBurned',
  'handleBuybackAuctionStarted',
  'handleCanonicalPoolSeeded',
  'handleCommunityContribution',
  'handleCompletedRangeSwept',
  'handleContributionsOpened',
  'handleEpochExtended',
  'handleEpochSettled',
  'handleFeesCollected',
  'handleGBXBoughtAndBurned',
  'handleGenesisClaimed',
  'handleLaunchSettled',
  'handleManagerRewardClaimed',
  'handleManagerRewardNotified',
  'handleManagerRewardRedirectedToVault',
  'handleManagerRewardTerminalDustQueued',
  'handleManagerRewardTerminalDustSettled',
  'handleMigrationCompleted',
  'handleMigrationPauseSet',
  'handleMigrationPositionAfter',
  'handleMigrationPositionBefore',
  'handleMigrationStarted',
  'handleMiningClaimed',
  'handleMiningContribution',
  'handleMinted',
  'handlePendingSignalsCancelled',
  'handlePositionRecorded',
  'handleRedeemed',
  'handleRedemptionStatusSet',
  'handleRevenueNotified',
  'handleRevenueRouted',
  'handleSignalsActivated',
  'handleSignalsPending',
  'handleSignalsReset',
  'handleStandaloneStrategyRegistered',
  'handleStaked',
  'handleStrategyBudgetCheckpointed',
  'handleStrategyBudgetConsumed',
  'handleStrategyBudgetScaled',
  'handleStrategyDisabled',
  'handleStrategyReactivated',
  'handleUIMultiplierUpdated',
  'handleUSDGReleased',
  'handleUnstaked',
  'handleUserWeightUpdated',
]);

function matches(text, expression, captureIndex = 1) {
  return [...text.matchAll(expression)].map((match) => match[captureIndex]);
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function setErrors(actual, expected, label) {
  const errors = [];
  const counts = new Map();
  for (const value of actual) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const [value, count] of [...counts.entries()].sort(([left], [right]) => compare(left, right))) {
    if (count !== 1) errors.push(`${label} contains ${count} copies of ${value}`);
  }
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  for (const value of [...expectedSet].sort(compare)) {
    if (!actualSet.has(value)) errors.push(`${label} is missing ${value}`);
  }
  for (const value of [...actualSet].sort(compare)) {
    if (!expectedSet.has(value)) errors.push(`${label} contains unexpected ${value}`);
  }
  return errors;
}

export function evaluateSpecCoverage({ mappings, manifest, schema, tests }) {
  const errors = [];
  const expectedEntities = [...REQUIRED_ENTITIES, ...ACCOUNTING_EXTENSION_ENTITIES];
  const entities = matches(schema, /^type\s+([A-Za-z][A-Za-z0-9]*)\s+@entity\b/gmu);
  errors.push(...setErrors(entities, expectedEntities, 'Schema entity set'));

  const eventCount = matches(manifest, /^\s*-\s+event:/gmu, 0).length;
  const manifestHandlers = matches(manifest, /^\s+handler:\s+(handle[A-Za-z0-9]+)\s*$/gmu);
  if (eventCount !== manifestHandlers.length) {
    errors.push(`Manifest has ${eventCount} events but ${manifestHandlers.length} handlers`);
  }
  errors.push(...setErrors(manifestHandlers, REQUIRED_HANDLERS, 'Manifest handler set'));

  const exportedHandlers = matches(mappings, /^export function\s+(handle[A-Za-z0-9]+)\s*\(/gmu);
  errors.push(...setErrors(exportedHandlers, REQUIRED_HANDLERS, 'Mapping export set'));

  for (const handler of REQUIRED_HANDLERS) {
    const invocation = new RegExp(`\\b${handler}\\s*\\(`, 'gu');
    if (!invocation.test(tests)) errors.push(`Matchstick tests do not invoke ${handler}`);
  }
  return errors;
}

async function readFiles(directory, suffix) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(suffix)).sort(compare);
  return Promise.all(names.map((name) => readFile(path.join(directory, name), 'utf8')));
}

async function main() {
  const [mappingFiles, testFiles, manifest, schema] = await Promise.all([
    readFiles(path.join(packageDirectory, 'src'), '.ts'),
    readFiles(path.join(packageDirectory, 'tests'), '.test.ts'),
    readFile(path.join(packageDirectory, 'subgraph.yaml'), 'utf8'),
    readFile(path.join(packageDirectory, 'schema.graphql'), 'utf8'),
  ]);
  const errors = evaluateSpecCoverage({
    mappings: mappingFiles.join('\n'),
    manifest,
    schema,
    tests: testFiles.join('\n'),
  });
  if (errors.length > 0) throw new Error(`Subgraph specification coverage failed:\n- ${errors.join('\n- ')}`);
  process.stdout.write(
    `Subgraph specification coverage passed for ${REQUIRED_ENTITIES.length} required entities, ` +
      `${ACCOUNTING_EXTENSION_ENTITIES.length} accounting extension, and ${REQUIRED_HANDLERS.length} tested handlers.\n`,
  );
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
