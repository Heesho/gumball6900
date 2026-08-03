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

function hasMessageText(message) {
  return (
    (typeof message.text === 'string' && message.text.trim().length !== 0) ||
    (typeof message.markdown === 'string' && message.markdown.trim().length !== 0)
  );
}

export function validateCodeqlSarif(value, label = 'CodeQL SARIF') {
  if (!isObject(value) || value.version !== '2.1.0' || !Array.isArray(value.runs) || value.runs.length === 0) {
    fail(label, 'must be a SARIF 2.1.0 object with at least one run');
  }

  for (const [runIndex, run] of value.runs.entries()) {
    if (!isObject(run) || !isObject(run.tool) || !isObject(run.tool.driver)) {
      fail(label, `run ${runIndex} must contain a tool driver`);
    }
    if (run.tool.driver.name !== 'CodeQL') {
      const received =
        typeof run.tool.driver.name === 'string' && run.tool.driver.name.length !== 0
          ? JSON.stringify(run.tool.driver.name)
          : 'a missing or malformed name';
      fail(label, `run ${runIndex} tool driver must be "CodeQL"; received ${received}`);
    }
    if (!Array.isArray(run.results)) {
      fail(label, `run ${runIndex} must contain an explicit results array`);
    }

    for (const [resultIndex, result] of run.results.entries()) {
      if (
        !isObject(result) ||
        typeof result.ruleId !== 'string' ||
        result.ruleId.trim().length === 0 ||
        !isObject(result.message) ||
        !hasMessageText(result.message)
      ) {
        fail(
          label,
          `run ${runIndex} result ${resultIndex} must contain a nonempty ruleId and message text or markdown`,
        );
      }
    }
  }

  return value;
}

export function codeqlResults(value, label = 'CodeQL SARIF') {
  validateCodeqlSarif(value, label);
  return value.runs.flatMap((run, runIndex) =>
    run.results.map((result, resultIndex) => ({ result, resultIndex, runIndex })),
  );
}

export function requireZeroCodeqlResults(value, label = 'CodeQL SARIF') {
  const results = codeqlResults(value, label);
  if (results.length !== 0) {
    const ruleIds = [...new Set(results.map(({ result }) => result.ruleId))];
    const displayedRuleIds = ruleIds.slice(0, 10).join(', ');
    const omitted = ruleIds.length > 10 ? `, and ${ruleIds.length - 10} more` : '';
    fail(
      label,
      `must contain zero results because no CodeQL findings are accepted; received ${results.length} (${displayedRuleIds}${omitted})`,
    );
  }
  return value;
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error('Usage: check-codeql-sarif.mjs <codeql.sarif>');
  }
  const inputPath = path.resolve(process.argv[2]);
  let document;
  try {
    document = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse CodeQL SARIF file ${inputPath}`, { cause: error });
  }
  requireZeroCodeqlResults(document, `CodeQL SARIF file ${inputPath}`);
  process.stdout.write('CodeQL SARIF policy passed: the report is well formed and contains zero results.\n');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
