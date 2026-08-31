#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(label, message) {
  throw new Error(`${label} ${message}`);
}

function messageText(message) {
  if (!isObject(message)) return '';
  if (typeof message.text === 'string') return message.text;
  if (typeof message.markdown === 'string') return message.markdown;
  return '';
}

function notificationText(notification) {
  const descriptor = isObject(notification?.descriptor) ? notification.descriptor : {};
  const descriptorId = typeof descriptor.id === 'string' ? descriptor.id : '';
  return `${descriptorId}\n${messageText(notification?.message)}`.trim();
}

function isParseFailure(notification) {
  const text = notificationText(notification);
  return /\b(?:syntax error|parse error|parse failure|failed to parse|unable to parse|unparseable)\b/iu.test(text);
}

function resultLocation(result, label) {
  if (!Array.isArray(result.locations) || result.locations.length !== 1) {
    fail(label, 'must contain exactly one physical location');
  }

  const physical = result.locations[0]?.physicalLocation;
  const uri = physical?.artifactLocation?.uri;
  const region = physical?.region;
  if (
    typeof uri !== 'string' ||
    uri.length === 0 ||
    !isObject(region) ||
    !Number.isInteger(region.startLine) ||
    region.startLine < 1
  ) {
    fail(label, 'must contain a relative artifact URI and positive start line');
  }

  const endLine = region.endLine ?? region.startLine;
  if (!Number.isInteger(endLine) || endLine < region.startLine) {
    fail(label, 'has an invalid end line');
  }

  return { endLine, path: uri, startLine: region.startLine };
}

export function validateSemgrepSarif(value, label = 'Semgrep SARIF') {
  if (!isObject(value) || value.version !== '2.1.0' || !Array.isArray(value.runs) || value.runs.length === 0) {
    fail(label, 'must be a SARIF 2.1.0 object with at least one run');
  }

  for (const [runIndex, run] of value.runs.entries()) {
    if (!isObject(run) || !isObject(run.tool) || !isObject(run.tool.driver)) {
      fail(label, `run ${runIndex} must contain a tool driver`);
    }
    if (run.tool.driver.name !== 'Semgrep OSS') {
      fail(label, `run ${runIndex} tool driver must be "Semgrep OSS"`);
    }
    if (!Array.isArray(run.invocations) || run.invocations.length === 0) {
      fail(label, `run ${runIndex} must contain an invocation record`);
    }

    for (const [invocationIndex, invocation] of run.invocations.entries()) {
      if (!isObject(invocation) || invocation.executionSuccessful !== true) {
        fail(label, `run ${runIndex} invocation ${invocationIndex} was not successful`);
      }
      const notifications = invocation.toolExecutionNotifications ?? [];
      if (!Array.isArray(notifications)) {
        fail(label, `run ${runIndex} invocation ${invocationIndex} has malformed notifications`);
      }
      const parseFailure = notifications.find(isParseFailure);
      if (parseFailure !== undefined) {
        fail(label, `contains a Solidity parse failure: ${notificationText(parseFailure)}`);
      }
    }

    if (!Array.isArray(run.results)) {
      fail(label, `run ${runIndex} must contain an explicit results array`);
    }
    for (const [resultIndex, result] of run.results.entries()) {
      if (
        !isObject(result) ||
        typeof result.ruleId !== 'string' ||
        result.ruleId.length === 0 ||
        messageText(result.message).trim().length === 0
      ) {
        fail(label, `run ${runIndex} result ${resultIndex} must contain a ruleId and message`);
      }
      resultLocation(result, `${label} run ${runIndex} result ${resultIndex}`);
    }
  }

  return value;
}

export function semgrepResults(value, label = 'Semgrep SARIF') {
  validateSemgrepSarif(value, label);
  return value.runs.flatMap((run, runIndex) =>
    run.results.map((result, resultIndex) => ({
      ...resultLocation(result, `${label} run ${runIndex} result ${resultIndex}`),
      result,
      resultIndex,
      ruleId: result.ruleId,
      runIndex,
    })),
  );
}

function entryKey(entry) {
  return [entry.ruleId, entry.path, entry.startLine, entry.endLine].join('|');
}

export function validateSemgrepPolicy(value, label = 'Semgrep policy') {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    fail(label, 'must be a version 1 object with an entries array');
  }

  const keys = new Set();
  for (const [entryIndex, entry] of value.entries.entries()) {
    if (
      !isObject(entry) ||
      typeof entry.ruleId !== 'string' ||
      entry.ruleId.length === 0 ||
      typeof entry.path !== 'string' ||
      !entry.path.startsWith('src/') ||
      !Number.isInteger(entry.startLine) ||
      !Number.isInteger(entry.endLine) ||
      entry.startLine < 1 ||
      entry.endLine < entry.startLine ||
      typeof entry.rationale !== 'string' ||
      entry.rationale.trim().length < 30
    ) {
      fail(label, `entry ${entryIndex} is malformed`);
    }
    const key = entryKey(entry);
    if (keys.has(key)) fail(label, `contains duplicate entry ${key}`);
    keys.add(key);
  }

  return value;
}

export function requireExactSemgrepResults(sarif, policy, label = 'Semgrep SARIF') {
  const results = semgrepResults(sarif, label);
  validateSemgrepPolicy(policy);

  const expected = new Map(policy.entries.map((entry) => [entryKey(entry), entry]));
  const current = new Map();
  for (const result of results) {
    const key = entryKey(result);
    if (current.has(key)) fail(label, `contains duplicate result ${key}`);
    current.set(key, result);
  }

  const newKeys = [...current.keys()].filter((key) => !expected.has(key));
  const staleKeys = [...expected.keys()].filter((key) => !current.has(key));
  if (newKeys.length !== 0 || staleKeys.length !== 0) {
    const details = [...newKeys.map((key) => `NEW ${key}`), ...staleKeys.map((key) => `STALE ${key}`)].join('\n');
    fail(label, `drifted from the exact reviewed result register:\n${details}`);
  }

  return sarif;
}

async function readJson(inputPath, label) {
  try {
    return JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${label} file ${inputPath}`, { cause: error });
  }
}

async function main() {
  if (process.argv.length !== 4) {
    throw new Error('Usage: check-semgrep-sarif.mjs <semgrep-policy.json> <semgrep.sarif>');
  }
  const policyPath = path.resolve(process.argv[2]);
  const sarifPath = path.resolve(process.argv[3]);
  const [policy, sarif] = await Promise.all([
    readJson(policyPath, 'Semgrep policy'),
    readJson(sarifPath, 'Semgrep SARIF'),
  ]);
  requireExactSemgrepResults(sarif, policy, `Semgrep SARIF file ${sarifPath}`);
  process.stdout.write(`Semgrep SARIF policy passed: accepted ${policy.entries.length} exact reviewed results.\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
