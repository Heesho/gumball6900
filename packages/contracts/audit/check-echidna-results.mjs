#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function fail(message) {
  throw new Error(message);
}

function finalJsonObject(source) {
  const lines = source.trimEnd().split('\n');
  for (let index = lines.length - 1; index >= 0; --index) {
    const candidate = lines[index].trim();
    if (!candidate.startsWith('{')) continue;
    try {
      const value = JSON.parse(candidate);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch {
      // Status and diagnostic lines may also begin with punctuation; keep looking for the final JSON result.
    }
  }
  fail('Echidna output does not contain a final JSON result object');
}

export function validateEchidnaResult(source, configSource) {
  if (/\bCrashed:\s*$/mu.test(source)) fail('Echidna reported a worker crash');
  if (/Set\.elemAt: index out of range/u.test(source)) fail('Echidna reported an empty-call-set crash');

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

  const report = finalJsonObject(source);
  if (report.success !== true || report.error !== null) fail('Echidna final result is not successful');
  if (!Array.isArray(report.tests) || report.tests.length === 0) fail('Echidna final result contains no properties');
  const incomplete = report.tests.filter(
    (entry) =>
      entry === null ||
      typeof entry !== 'object' ||
      entry.type !== 'property' ||
      typeof entry.name !== 'string' ||
      !entry.name.startsWith('echidna_') ||
      entry.status !== 'passed' ||
      entry.error !== null,
  );
  if (incomplete.length !== 0) fail(`Echidna left ${incomplete.length} property result(s) incomplete or failed`);

  return { observedCalls, propertyCount: report.tests.length, seed: report.seed };
}

async function main() {
  if (process.argv.length !== 4) {
    fail('Usage: check-echidna-results.mjs <echidna-output.json> <echidna-config.yaml>');
  }
  const [resultPath, configPath] = process.argv.slice(2).map((value) => path.resolve(value));
  const [source, configSource] = await Promise.all([readFile(resultPath, 'utf8'), readFile(configPath, 'utf8')]);
  const summary = validateEchidnaResult(source, configSource);
  process.stdout.write(
    `Echidna campaign accepted ${summary.observedCalls} calls across ${summary.propertyCount} properties (seed ${String(summary.seed)}).\n`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Echidna campaign validation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
