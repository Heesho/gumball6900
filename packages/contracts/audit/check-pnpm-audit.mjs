#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function evaluateAuditReport(report) {
  const errors = [];
  let reviewedHighOrCritical = 0;
  if (
    report === null ||
    typeof report !== 'object' ||
    report.advisories === null ||
    typeof report.advisories !== 'object'
  ) {
    return { errors: ['pnpm did not return the expected advisory report shape'], reviewedHighOrCritical };
  }

  for (const advisory of Object.values(report.advisories)) {
    if (advisory === null || typeof advisory !== 'object') {
      errors.push('encountered a malformed advisory record');
      continue;
    }
    if (advisory.severity !== 'high' && advisory.severity !== 'critical') continue;

    reviewedHighOrCritical += 1;
    errors.push(
      `${String(advisory.severity)} advisory ${String(advisory.github_advisory_id)} ` +
        `in ${String(advisory.module_name)}`,
    );
  }
  return { errors, reviewedHighOrCritical };
}

async function main() {
  const inputPath = resolve(process.argv[2] ?? 'audit/reports/pnpm-audit.json');
  let report;
  try {
    report = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    console.error(
      `Dependency-audit policy failed: could not parse ${inputPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
    return;
  }

  const result = evaluateAuditReport(report);
  for (const error of result.errors) console.error(`Dependency-audit policy failed: ${error}`);
  if (result.errors.length !== 0) {
    process.exitCode = 1;
    return;
  }
  console.log('Dependency-audit policy passed: no high/critical advisory records.');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
