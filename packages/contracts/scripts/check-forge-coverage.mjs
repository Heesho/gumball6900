#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { FORGE_COVERAGE_POLICY } from './forge-coverage-policy.mjs';

const SUMMARY_FIELDS = Object.freeze(['FNF', 'FNH', 'BRF', 'BRH', 'LF', 'LH']);
const METRICS = Object.freeze({
  functions: ['FNH', 'FNF'],
  branches: ['BRH', 'BRF'],
  lines: ['LH', 'LF'],
});

export function parseLcov(contents) {
  if (typeof contents !== 'string' || contents.trim().length === 0) {
    throw new Error('LCOV input is empty');
  }

  const records = [];
  let recordLines = [];
  for (const rawLine of contents.split(/\n/)) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === 'end_of_record') {
      if (!recordLines.some((entry) => entry.length !== 0)) {
        throw new Error('LCOV contains an empty record');
      }
      records.push(parseRecord(recordLines));
      recordLines = [];
    } else {
      recordLines.push(line);
    }
  }

  if (recordLines.some((entry) => entry.length !== 0)) {
    throw new Error('LCOV contains an unterminated record');
  }
  if (records.length === 0) throw new Error('LCOV contains no records');

  const bySource = new Map();
  for (const record of records) {
    const source = normalizeSourcePath(record.source);
    if (bySource.has(source)) throw new Error(`LCOV contains duplicate source record: ${source}`);
    bySource.set(source, { ...record, source });
  }
  return bySource;
}

export function checkForgeCoverage(contents, policy = FORGE_COVERAGE_POLICY) {
  validatePolicy(policy);
  const records = parseLcov(contents);
  const failures = [];
  const results = [];

  for (const expected of policy) {
    const record = records.get(expected.path);
    if (!record) {
      failures.push(`${expected.path}: missing LCOV source record`);
      continue;
    }

    const result = { path: expected.path };
    for (const [metric, [hitField, totalField]] of Object.entries(METRICS)) {
      const covered = record.summary[hitField];
      const total = record.summary[totalField];
      const floor = expected[metric];
      const basisPoints = coverageBasisPoints(covered, total);
      result[metric] = { covered, total, basisPoints };

      if (total < floor.minimumTotal) {
        failures.push(`${expected.path} ${metric}: instrumented total ${total} is below ${floor.minimumTotal}`);
      }
      if (basisPoints < floor.minimumBasisPoints) {
        failures.push(
          `${expected.path} ${metric}: ${formatPercentage(basisPoints)} (${covered}/${total}) is below ${formatPercentage(floor.minimumBasisPoints)}`,
        );
      }
    }
    results.push(result);
  }

  if (failures.length !== 0) {
    throw new Error(`Forge source coverage policy failed:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
  }
  return results;
}

export function formatCoverageTable(results) {
  const rows = results.map((result) => {
    const render = (metric) =>
      `${formatPercentage(result[metric].basisPoints)} (${result[metric].covered}/${result[metric].total})`;
    return `${result.path}\t${render('functions')}\t${render('branches')}\t${render('lines')}`;
  });
  return ['source\tfunctions\tbranches\tlines', ...rows].join('\n');
}

function parseRecord(lines) {
  const sourceLines = lines.filter((line) => line.startsWith('SF:'));
  if (sourceLines.length !== 1 || sourceLines[0].slice(3).length === 0) {
    throw new Error('each LCOV record must contain exactly one non-empty SF field');
  }

  const summary = {};
  for (const field of SUMMARY_FIELDS) {
    const matches = lines.filter((line) => line.startsWith(`${field}:`));
    if (matches.length !== 1) {
      throw new Error(`${sourceLines[0]} must contain exactly one ${field} field`);
    }
    const rawValue = matches[0].slice(field.length + 1);
    if (!/^\d+$/.test(rawValue)) throw new Error(`${sourceLines[0]} has invalid ${field}: ${rawValue}`);
    summary[field] = Number(rawValue);
    if (!Number.isSafeInteger(summary[field])) {
      throw new Error(`${sourceLines[0]} has unsafe integer ${field}: ${rawValue}`);
    }
  }

  for (const [hitField, totalField] of Object.values(METRICS)) {
    if (summary[hitField] > summary[totalField]) {
      throw new Error(`${sourceLines[0]} has ${hitField} greater than ${totalField}`);
    }
  }

  const details = countDetailCoverage(lines, sourceLines[0]);
  for (const field of SUMMARY_FIELDS) {
    if (summary[field] !== details[field]) {
      throw new Error(`${sourceLines[0]} summary/detail mismatch for ${field}: ${summary[field]} != ${details[field]}`);
    }
  }

  return { source: sourceLines[0].slice(3), summary };
}

function countDetailCoverage(lines, sourceLabel) {
  const functionDefinitions = lines.filter((line) => line.startsWith('FN:'));
  const functionData = lines.filter((line) => line.startsWith('FNDA:'));
  const lineData = lines.filter((line) => line.startsWith('DA:'));
  const branchData = lines.filter((line) => line.startsWith('BRDA:'));

  if (functionDefinitions.length !== functionData.length) {
    throw new Error(`${sourceLabel} has mismatched FN and FNDA detail counts`);
  }

  const functionHits = functionData.map((line) => parseCountBeforeComma(line, 'FNDA', sourceLabel));
  const lineHits = lineData.map((line) => parseCountAfterLine(line, 'DA', sourceLabel));
  const branchHits = branchData.map((line) => parseBranchCount(line, sourceLabel));

  return {
    FNF: functionDefinitions.length,
    FNH: functionHits.filter((count) => count > 0).length,
    BRF: branchData.length,
    BRH: branchHits.filter((count) => count > 0).length,
    LF: lineData.length,
    LH: lineHits.filter((count) => count > 0).length,
  };
}

function parseCountBeforeComma(line, field, sourceLabel) {
  const payload = line.slice(field.length + 1);
  const separator = payload.indexOf(',');
  if (separator <= 0 || !/^\d+$/.test(payload.slice(0, separator))) {
    throw new Error(`${sourceLabel} has invalid ${field} detail: ${line}`);
  }
  return Number(payload.slice(0, separator));
}

function parseCountAfterLine(line, field, sourceLabel) {
  const payload = line.slice(field.length + 1);
  const parts = payload.split(',');
  if (parts.length < 2 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) {
    throw new Error(`${sourceLabel} has invalid ${field} detail: ${line}`);
  }
  return Number(parts[1]);
}

function parseBranchCount(line, sourceLabel) {
  const parts = line.slice('BRDA:'.length).split(',');
  if (
    parts.length !== 4 ||
    !/^\d+$/.test(parts[0]) ||
    !/^\d+$/.test(parts[1]) ||
    !/^\d+$/.test(parts[2]) ||
    !(parts[3] === '-' || /^\d+$/.test(parts[3]))
  ) {
    throw new Error(`${sourceLabel} has invalid BRDA detail: ${line}`);
  }
  return parts[3] === '-' ? 0 : Number(parts[3]);
}

function normalizeSourcePath(source) {
  const normalized = source.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (segments.includes('..') || segments.includes('.')) {
    throw new Error(`LCOV source path is not canonical: ${source}`);
  }
  const srcIndex = segments.lastIndexOf('src');
  if (srcIndex === -1) return normalized;
  return segments.slice(srcIndex).join('/');
}

function coverageBasisPoints(covered, total) {
  if (total === 0) return 0;
  return Math.floor((covered * 10_000) / total);
}

function formatPercentage(basisPoints) {
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, '0')}%`;
}

function validatePolicy(policy) {
  if (!Array.isArray(policy) || policy.length === 0) throw new Error('coverage policy is empty');
  const paths = new Set();
  for (const entry of policy) {
    if (typeof entry.path !== 'string' || !entry.path.startsWith('src/') || paths.has(entry.path)) {
      throw new Error(`invalid or duplicate policy path: ${entry.path}`);
    }
    paths.add(entry.path);
    for (const metric of Object.keys(METRICS)) {
      const floor = entry[metric];
      if (
        !floor ||
        !Number.isInteger(floor.minimumBasisPoints) ||
        floor.minimumBasisPoints < 0 ||
        floor.minimumBasisPoints > 10_000 ||
        !Number.isInteger(floor.minimumTotal) ||
        floor.minimumTotal < 0
      ) {
        throw new Error(`invalid ${metric} floor for ${entry.path}`);
      }
    }
  }
}

function runCli() {
  const reportPath = path.resolve(process.argv[2] ?? 'lcov.info');
  let contents;
  try {
    contents = fs.readFileSync(reportPath, 'utf8');
  } catch (error) {
    throw new Error(`cannot read Forge LCOV report ${reportPath}: ${error.message}`);
  }
  const results = checkForgeCoverage(contents);
  process.stdout.write(`${formatCoverageTable(results)}\n`);
  process.stdout.write(`Forge source coverage policy passed for ${results.length} critical files.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
