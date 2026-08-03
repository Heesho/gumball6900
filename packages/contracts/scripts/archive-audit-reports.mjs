#!/usr/bin/env node

import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { requireZeroCodeqlResults, validateCodeqlSarif } from '../audit/check-codeql-sarif.mjs';
import { parseLcov } from './check-forge-coverage.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONTRACTS_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, '..');
const COVERAGE_FIELDS = Object.freeze({
  branches: ['BRH', 'BRF'],
  functions: ['FNH', 'FNF'],
  lines: ['LH', 'LF'],
});

export const AUDIT_REPORT_FILENAMES = Object.freeze({
  codeqlSarif: 'codeql-javascript-typescript.sarif',
  forgeCoverage: 'forge-coverage.lcov',
  forgeCoverageSummary: 'forge-coverage-summary.json',
  hardhatCoverage: 'hardhat-coverage.lcov',
  hardhatCoverageSummary: 'hardhat-coverage-summary.json',
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value, location = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite JSON number at ${location}`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => canonicalize(entry, `${location}[${index}]`));
  if (isObject(value)) {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      const entry = value[key];
      if (entry === undefined) throw new Error(`Undefined JSON value at ${location}.${key}`);
      output[key] = canonicalize(entry, `${location}.${key}`);
    }
    return output;
  }
  throw new Error(`Unsupported JSON value at ${location}: ${typeof value}`);
}

function deterministicJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function normalizedText(value) {
  return `${value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replace(/\n*$/, '')}\n`;
}

function coverageMetric(covered, total) {
  if (!Number.isSafeInteger(covered) || !Number.isSafeInteger(total) || covered < 0 || total < 0 || covered > total) {
    throw new Error(`Invalid coverage counts: ${covered}/${total}`);
  }
  return {
    basisPoints: total === 0 ? 0 : Number((BigInt(covered) * 10_000n) / BigInt(total)),
    covered,
    total,
  };
}

function coverageMetrics(summary) {
  return Object.fromEntries(
    Object.entries(COVERAGE_FIELDS).map(([metric, [coveredField, totalField]]) => [
      metric,
      coverageMetric(summary[coveredField], summary[totalField]),
    ]),
  );
}

export function summarizeCoverage(tool, artifact, contents) {
  if (tool !== 'forge' && tool !== 'hardhat') throw new Error(`Unsupported coverage tool: ${tool}`);
  const records = [...parseLcov(contents).values()].sort(({ source: left }, { source: right }) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const totals = Object.fromEntries(Object.keys(COVERAGE_FIELDS).map((metric) => [metric, { covered: 0, total: 0 }]));
  const files = records.map(({ source, summary }) => {
    const metrics = coverageMetrics(summary);
    for (const metric of Object.keys(COVERAGE_FIELDS)) {
      totals[metric].covered += metrics[metric].covered;
      totals[metric].total += metrics[metric].total;
    }
    return { metrics, path: source };
  });
  const metrics = Object.fromEntries(
    Object.entries(totals).map(([metric, counts]) => [metric, coverageMetric(counts.covered, counts.total)]),
  );
  return {
    artifact,
    files,
    kind: 'gumball-6900-contract-coverage-summary',
    metrics,
    schemaVersion: 1,
    tool,
  };
}

async function atomicWrite(destination, contents) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${process.pid}.tmp`);
  await writeFile(temporary, contents, { mode: 0o644 });
  await rename(temporary, destination);
}

async function readRequiredText(filePath, label) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${label} at ${filePath}`, { cause: error });
  }
}

export async function archiveCoverageReports(contractsDirectory = DEFAULT_CONTRACTS_DIRECTORY) {
  const reportDirectory = path.join(contractsDirectory, 'audit', 'reports');
  const forgeContents = await readRequiredText(path.join(contractsDirectory, 'lcov.info'), 'Forge LCOV report');
  const hardhatContents = await readRequiredText(
    path.join(contractsDirectory, 'coverage', 'lcov.info'),
    'Hardhat LCOV report',
  );
  const forgeSummary = summarizeCoverage('forge', AUDIT_REPORT_FILENAMES.forgeCoverage, forgeContents);
  const hardhatSummary = summarizeCoverage('hardhat', AUDIT_REPORT_FILENAMES.hardhatCoverage, hardhatContents);
  const outputs = {
    forgeCoverage: path.join(reportDirectory, AUDIT_REPORT_FILENAMES.forgeCoverage),
    forgeCoverageSummary: path.join(reportDirectory, AUDIT_REPORT_FILENAMES.forgeCoverageSummary),
    hardhatCoverage: path.join(reportDirectory, AUDIT_REPORT_FILENAMES.hardhatCoverage),
    hardhatCoverageSummary: path.join(reportDirectory, AUDIT_REPORT_FILENAMES.hardhatCoverageSummary),
  };
  await Promise.all([
    atomicWrite(outputs.forgeCoverage, normalizedText(forgeContents)),
    atomicWrite(outputs.forgeCoverageSummary, deterministicJson(forgeSummary)),
    atomicWrite(outputs.hardhatCoverage, normalizedText(hardhatContents)),
    atomicWrite(outputs.hardhatCoverageSummary, deterministicJson(hardhatSummary)),
  ]);
  return { forgeSummary, hardhatSummary, outputs };
}

async function findSarifFiles(directory, root = directory) {
  const stats = await lstat(directory);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`CodeQL SARIF input must be a nonsymlink directory: ${directory}`);
  }
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`CodeQL SARIF input contains a symlink: ${entryPath}`);
    if (entry.isDirectory()) files.push(...(await findSarifFiles(entryPath, root)));
    else if (entry.isFile() && entry.name.endsWith('.sarif')) files.push(entryPath);
  }
  return files.sort((left, right) => {
    const leftRelative = path.relative(root, left);
    const rightRelative = path.relative(root, right);
    return leftRelative < rightRelative ? -1 : leftRelative > rightRelative ? 1 : 0;
  });
}

export async function archiveCodeqlSarif(inputDirectory, contractsDirectory = DEFAULT_CONTRACTS_DIRECTORY) {
  const output = path.join(contractsDirectory, 'audit', 'reports', AUDIT_REPORT_FILENAMES.codeqlSarif);
  await rm(output, { force: true });
  const files = await findSarifFiles(inputDirectory);
  if (files.length !== 1) {
    throw new Error(`Expected exactly one JavaScript/TypeScript CodeQL SARIF file, received ${files.length}`);
  }
  const filePath = files[0];
  let contents;
  let document;
  try {
    contents = await readFile(filePath);
    document = JSON.parse(contents.toString('utf8'));
  } catch (error) {
    throw new Error(`Cannot parse CodeQL SARIF file ${filePath}`, { cause: error });
  }
  const label = `CodeQL SARIF file ${filePath}`;
  validateCodeqlSarif(document, label);
  await atomicWrite(output, contents);
  requireZeroCodeqlResults(document, label);
  return { document, inputFiles: files, output };
}

async function main() {
  const [mode, ...arguments_] = process.argv.slice(2);
  if (mode === 'coverage' && arguments_.length === 0) {
    await archiveCoverageReports();
    process.stdout.write('Archived Forge and Hardhat coverage evidence under audit/reports.\n');
    return;
  }
  if (mode === 'codeql' && arguments_.length === 1) {
    const result = await archiveCodeqlSarif(path.resolve(arguments_[0]));
    process.stdout.write(`Archived ${result.inputFiles.length} CodeQL SARIF file(s) at ${result.output}.\n`);
    return;
  }
  throw new Error('Usage: archive-audit-reports.mjs coverage | codeql <post-processed-sarif-directory>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
