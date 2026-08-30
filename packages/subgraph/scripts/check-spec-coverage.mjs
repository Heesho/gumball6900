#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, '..');

export const REQUIRED_ENTITIES = Object.freeze(['ProtocolState', 'Account', 'MiningSlot', 'Strategy', 'ProtocolEvent']);

export const REVIEWED_EXTENSION_ENTITIES = Object.freeze(['SignalPosition']);

export const REQUIRED_MAPPING_ENTITIES = Object.freeze({
  './src/resonance.ts': Object.freeze(['ProtocolState', 'Account', 'Strategy', 'SignalPosition', 'ProtocolEvent']),
});

export const REQUIRED_HANDLERS = Object.freeze([
  'handleBribeBpsSet',
  'handleBribeRewardTokenAdded',
  'handleBurned',
  'handleDelegateChanged',
  'handleDelegateVotesChanged',
  'handleEmissionSettled',
  'handleFundGBXBurned',
  'handleGenesisLiquidityMinted',
  'handleMined',
  'handleMinerPaymentAccrued',
  'handleMinerPaymentClaimed',
  'handleMinterSet',
  'handleMinted',
  'handleMiningRevenueDeposited',
  'handleRedeemed',
  'handleRevenueDistributed',
  'handleRevenueNotified',
  'handleRevenueRouted',
  'handleResonanceRouterUpdated',
  'handleSignalResonanceSet',
  'handleSignaled',
  'handleSignalWithdrawn',
  'handleStrategyAdded',
  'handleStrategyKilled',
  'handleSignalAdded',
  'handleSignalRemoved',
  'handleResonanceRouterSet',
  'handleRewardNotified',
  'handleRewardPaid',
  'handleRouterRewardRouted',
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

function manifestMappingEntities(manifest) {
  const mappings = new Map();
  const mappingExpression = /^ {4}mapping:[ \t]*\n([\s\S]*?)^ {6}file:[ \t]+(\S+)[ \t]*$/gmu;
  for (const match of manifest.matchAll(mappingExpression)) {
    const entitySection = match[1].match(/^ {6}entities:[ \t]*\n([\s\S]*?)^ {6}abis:/mu)?.[1] ?? '';
    mappings.set(match[2], matches(entitySection, /^ {8}-[ \t]+([A-Za-z][A-Za-z0-9]*)[ \t]*$/gmu));
  }
  return mappings;
}

export function evaluateSpecCoverage({ mappings, manifest, schema }) {
  const errors = [];
  const expectedEntities = [...REQUIRED_ENTITIES, ...REVIEWED_EXTENSION_ENTITIES];
  const entities = matches(schema, /^type\s+([A-Za-z][A-Za-z0-9]*)\s+@entity\b/gmu);
  errors.push(...setErrors(entities, expectedEntities, 'Schema entity set'));

  const mappingEntities = manifestMappingEntities(manifest);
  for (const [mapping, expected] of Object.entries(REQUIRED_MAPPING_ENTITIES)) {
    errors.push(...setErrors(mappingEntities.get(mapping) ?? [], expected, `Manifest ${mapping} entity set`));
  }

  const eventCount = matches(manifest, /^\s*-\s+event:/gmu, 0).length;
  const manifestHandlers = matches(manifest, /^\s+handler:\s+(handle[A-Za-z0-9]+)\s*$/gmu);
  if (eventCount !== manifestHandlers.length) {
    errors.push(`Manifest has ${eventCount} events but ${manifestHandlers.length} handlers`);
  }
  errors.push(...setErrors(manifestHandlers, REQUIRED_HANDLERS, 'Manifest handler set'));

  const exportedHandlers = matches(mappings, /^export function\s+(handle[A-Za-z0-9]+)\s*\(/gmu);
  errors.push(...setErrors(exportedHandlers, REQUIRED_HANDLERS, 'Mapping export set'));

  return errors;
}

async function readFiles(directory, suffix) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(suffix)).sort(compare);
  return Promise.all(names.map((name) => readFile(path.join(directory, name), 'utf8')));
}

async function main() {
  const [mappingFiles, manifest, schema] = await Promise.all([
    readFiles(path.join(packageDirectory, 'src'), '.ts'),
    readFile(path.join(packageDirectory, 'subgraph.yaml'), 'utf8'),
    readFile(path.join(packageDirectory, 'schema.graphql'), 'utf8'),
  ]);
  const errors = evaluateSpecCoverage({
    mappings: mappingFiles.join('\n'),
    manifest,
    schema,
  });
  if (errors.length > 0) throw new Error(`Subgraph specification coverage failed:\n- ${errors.join('\n- ')}`);
  process.stdout.write(
    `Subgraph specification coverage passed for ${REQUIRED_ENTITIES.length} required entities, ` +
      `${REVIEWED_EXTENSION_ENTITIES.length} reviewed extensions, and ${REQUIRED_HANDLERS.length} manifest/mapping handlers.\n`,
  );
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
