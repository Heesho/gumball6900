#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const POLICY_KEYS = [
  'entries',
  'kind',
  'licenseReportSha256',
  'platform',
  'pnpmLockSha256',
  'protocol',
  'reviewedAt',
  'reviewedBy',
  'schemaVersion',
  'state',
];
const INVENTORY_KEYS = [
  'dependencyEntriesSha256',
  'entries',
  'kind',
  'licenseGroups',
  'packageEntryCount',
  'protocol',
  'reviewRequiredEntries',
  'schemaVersion',
  'source',
];
const SOURCE_KEYS = ['command', 'coverage', 'platform', 'pnpmVersion', 'pnpmWorkspaceSha256'];
const LICENSE_GROUP_KEYS = ['license', 'packageEntryCount'];
const DEPENDENCY_ENTRY_KEYS = ['license', 'name', 'versions'];
const INVENTORY_ENTRY_KEYS = ['classification', 'license', 'name', 'versions'];
const ENTRY_KEYS = ['classification', 'disposition', 'license', 'name', 'rationale', 'releaseRelevance', 'versions'];
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const REVIEW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REVIEW_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PLACEHOLDER_PATTERN =
  /\b(?:AWAITING|DRAFT|FORTHCOMING|N\/?A|NA|NONE|NO ONE|NOT APPLICABLE|NOT APPROVED|NOT REVIEWED|OUTSTANDING|PENDING|PLACEHOLDER|PROVISIONAL|TBD|TODO|UNRESOLVED|UNREVIEWED)\b/iu;
const REVIEW_DENIAL_PATTERN =
  /\b(?:no (?:independent |legal |rights |owner )?(?:approval|decision|review)|not independently reviewed|review has not occurred|without (?:approval|review)|(?:requires?|needs?) (?:further )?(?:approval|decision|review)|(?:approval|decision|review) (?:is )?(?:incomplete|not final|outstanding)|subject to (?:counsel |legal |owner |rights )?(?:approval|confirmation|review)|to be determined)\b/iu;
const POLICY_KIND = 'gumball-6900-dependency-license-review-policy';
const INVENTORY_KIND = 'gumball-6900-dependency-license-inventory';
const PROTOCOL = 'GUM BALL 6900';

// This allowlist is deliberately narrow. Anything not unambiguously permissive is
// classified as restricted and therefore requires an explicit review disposition.
const PERMISSIVE_IDENTIFIERS = new Set(
  [
    '0BSD',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'BlueOak-1.0.0',
    'CC0-1.0',
    'ISC',
    'LLVM-exception',
    'MIT',
    'MIT-0',
    'Python-2.0',
    'Unlicense',
    'WTFPL',
    'Zlib',
  ].map((identifier) => identifier.toUpperCase()),
);
const COPYLEFT_PREFIXES = ['AGPL', 'CDDL', 'CPL', 'CPAL', 'EPL', 'EUPL', 'GPL', 'LGPL', 'MPL', 'OSL', 'RPL'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly: ${expected.join(', ')}`);
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isNonzeroHash(value) {
  return typeof value === 'string' && HASH_PATTERN.test(value) && !/^0{64}$/.test(value);
}

function canonicalString(value, label, minimumLength = 1) {
  if (typeof value !== 'string' || value.length < minimumLength || value !== value.trim()) {
    throw new Error(`${label} must be a trimmed string containing at least ${minimumLength} characters`);
  }
  return value;
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function licenseIdentifiers(expression) {
  return expression
    .replaceAll('(', ' ')
    .replaceAll(')', ' ')
    .trim()
    .split(/\s+(?:AND|OR|WITH)\s+/iu)
    .map((identifier) => identifier.trim())
    .filter(Boolean);
}

export function classifyLicense(expression) {
  if (typeof expression !== 'string' || expression.trim().length === 0) {
    throw new Error('license expression must be a nonempty string');
  }
  const identifiers = licenseIdentifiers(expression);
  if (identifiers.length === 0) throw new Error(`license expression ${expression} contains no identifiers`);

  const uppercase = identifiers.map((identifier) => identifier.toUpperCase());
  if (
    uppercase.some(
      (identifier) => identifier === 'UNKNOWN' || identifier === 'UNLICENSED' || identifier.startsWith('SEE LICENSE'),
    )
  ) {
    return 'unknown';
  }
  if (
    uppercase.some((identifier) =>
      COPYLEFT_PREFIXES.some((prefix) => identifier === prefix || identifier.startsWith(`${prefix}-`)),
    )
  ) {
    return 'copyleft';
  }
  if (uppercase.every((identifier) => PERMISSIVE_IDENTIFIERS.has(identifier))) return null;
  return 'restricted';
}

function normalizeVersions(value, label) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((version) => typeof version === 'string' && version.length > 0)
  ) {
    throw new Error(`${label}.versions must be a nonempty string array`);
  }
  for (const [index, version] of value.entries()) canonicalString(version, `${label}.versions[${index}]`);
  const versions = [...value].sort();
  if (new Set(versions).size !== versions.length) throw new Error(`${label}.versions contains duplicates`);
  return versions;
}

function entryKey(entry) {
  return JSON.stringify([entry.license, entry.name, entry.versions]);
}

export function reviewRequiredEntries(report) {
  exactKeys(report, INVENTORY_KEYS, 'dependency license inventory');
  if (report.kind !== INVENTORY_KIND || report.protocol !== PROTOCOL || report.schemaVersion !== 1) {
    throw new Error('dependency license inventory has the wrong kind, protocol, or schemaVersion');
  }
  exactKeys(report.source, SOURCE_KEYS, 'dependency license inventory source');
  if (report.source.command !== 'node audit/generate-dependency-license-inventory.mjs --check') {
    throw new Error('dependency license inventory source command is invalid');
  }
  canonicalString(report.source.coverage, 'dependency license inventory source.coverage', 30);
  if (!['darwin-arm64', 'linux-x64'].includes(report.source.platform)) {
    throw new Error('dependency license inventory source.platform is unsupported');
  }
  if (report.source.pnpmVersion !== '10.14.0') {
    throw new Error('dependency license inventory source.pnpmVersion is not the pinned version');
  }
  if (!isNonzeroHash(report.source.pnpmWorkspaceSha256)) {
    throw new Error('dependency license inventory source.pnpmWorkspaceSha256 must be a nonzero SHA-256 value');
  }

  if (!Array.isArray(report.entries) || report.entries.length === 0) {
    throw new Error('dependency license inventory entries must be a nonempty array');
  }
  const canonicalEntries = [];
  const entryKeys = new Set();
  const derivedGroupCounts = new Map();
  for (const [index, value] of report.entries.entries()) {
    const label = `dependency license inventory entries[${index}]`;
    exactKeys(value, DEPENDENCY_ENTRY_KEYS, label);
    canonicalString(value.license, `${label}.license`);
    canonicalString(value.name, `${label}.name`);
    classifyLicense(value.license);
    const versions = normalizeVersions(value.versions, label);
    if (versions.some((version, versionIndex) => version !== value.versions[versionIndex])) {
      throw new Error(`${label}.versions must be sorted`);
    }
    const entry = { license: value.license, name: value.name, versions };
    const key = entryKey(entry);
    if (entryKeys.has(key)) throw new Error(`dependency license inventory contains duplicate entry ${key}`);
    if (index > 0 && compareCodeUnits(entryKey(canonicalEntries[index - 1]), key) >= 0) {
      throw new Error('dependency license inventory entries must be sorted');
    }
    entryKeys.add(key);
    canonicalEntries.push(entry);
    derivedGroupCounts.set(entry.license, (derivedGroupCounts.get(entry.license) ?? 0) + 1);
  }
  if (report.packageEntryCount !== canonicalEntries.length) {
    throw new Error('dependency license inventory packageEntryCount does not match entries');
  }
  const entriesDigest = sha256(`${JSON.stringify(canonicalEntries, null, 2)}\n`);
  if (report.dependencyEntriesSha256 !== entriesDigest) {
    throw new Error('dependency license inventory dependencyEntriesSha256 does not match entries');
  }

  if (!Array.isArray(report.licenseGroups) || report.licenseGroups.length === 0) {
    throw new Error('dependency license inventory licenseGroups must be a nonempty array');
  }
  const groupCounts = new Map();
  let totalEntries = 0;
  for (const [index, group] of report.licenseGroups.entries()) {
    const label = `dependency license inventory licenseGroups[${index}]`;
    exactKeys(group, LICENSE_GROUP_KEYS, label);
    canonicalString(group.license, `${label}.license`);
    classifyLicense(group.license);
    if (!Number.isInteger(group.packageEntryCount) || group.packageEntryCount < 1) {
      throw new Error(`${label}.packageEntryCount must be a positive integer`);
    }
    if (groupCounts.has(group.license)) throw new Error(`duplicate license inventory group ${group.license}`);
    if (index > 0 && compareCodeUnits(report.licenseGroups[index - 1].license, group.license) >= 0) {
      throw new Error('dependency license inventory licenseGroups must be sorted by license');
    }
    groupCounts.set(group.license, group.packageEntryCount);
    totalEntries += group.packageEntryCount;
  }
  if (totalEntries !== report.packageEntryCount) {
    throw new Error('dependency license inventory group counts do not match packageEntryCount');
  }
  if (
    groupCounts.size !== derivedGroupCounts.size ||
    [...derivedGroupCounts].some(([license, count]) => groupCounts.get(license) !== count)
  ) {
    throw new Error('dependency license inventory licenseGroups do not match entries');
  }

  if (!Array.isArray(report.reviewRequiredEntries)) {
    throw new Error('dependency license inventory reviewRequiredEntries must be an array');
  }
  const entries = [];
  const keys = new Set();
  const requiredCounts = new Map();
  for (const [index, value] of report.reviewRequiredEntries.entries()) {
    const label = `dependency license inventory reviewRequiredEntries[${index}]`;
    exactKeys(value, INVENTORY_ENTRY_KEYS, label);
    canonicalString(value.license, `${label}.license`);
    canonicalString(value.name, `${label}.name`);
    const versions = normalizeVersions(value.versions, label);
    if (versions.some((version, versionIndex) => version !== value.versions[versionIndex])) {
      throw new Error(`${label}.versions must be sorted`);
    }
    const classification = classifyLicense(value.license);
    if (classification === null || value.classification !== classification) {
      throw new Error(`${label}.classification does not match the license expression`);
    }
    if (!groupCounts.has(value.license)) throw new Error(`${label}.license is absent from licenseGroups`);
    const entry = { ...value, versions };
    const key = entryKey(entry);
    if (keys.has(key)) throw new Error(`dependency license inventory contains duplicate entry ${key}`);
    if (index > 0 && compareCodeUnits(entryKey(entries[index - 1]), key) >= 0) {
      throw new Error('dependency license inventory reviewRequiredEntries must be sorted');
    }
    keys.add(key);
    entries.push(entry);
    requiredCounts.set(value.license, (requiredCounts.get(value.license) ?? 0) + 1);
  }
  for (const [license, packageEntryCount] of groupCounts) {
    if (classifyLicense(license) !== null && requiredCounts.get(license) !== packageEntryCount) {
      throw new Error(`dependency license inventory does not enumerate every review-required ${license} entry`);
    }
  }
  const derivedRequiredEntries = canonicalEntries
    .map((entry) => {
      const classification = classifyLicense(entry.license);
      return classification === null ? null : { classification, ...entry };
    })
    .filter((entry) => entry !== null);
  if (JSON.stringify(entries) !== JSON.stringify(derivedRequiredEntries)) {
    throw new Error('dependency license inventory reviewRequiredEntries do not exactly match entries');
  }
  return entries;
}

function validReviewDate(value) {
  if (typeof value !== 'string') return false;
  if (REVIEW_DATE_PATTERN.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return parsed.toISOString() === `${value}T00:00:00.000Z` && parsed.valueOf() <= Date.now();
  }
  if (!REVIEW_TIMESTAMP_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  return parsed.toISOString() === value.replace('Z', '.000Z') && parsed.valueOf() <= Date.now();
}

function validateInventoryBaseline(policy) {
  if (policy.reviewedAt !== null || policy.reviewedBy !== null) {
    throw new Error('inventory-baselined policy reviewedAt and reviewedBy must be null');
  }
}

function validateApprovedPolicy(policy) {
  if (!validReviewDate(policy.reviewedAt)) {
    throw new Error('approved license policy reviewedAt must be an exact valid YYYY-MM-DD or RFC3339 UTC timestamp');
  }
  canonicalString(policy.reviewedBy, 'approved license policy reviewedBy', 3);
  if (PLACEHOLDER_PATTERN.test(policy.reviewedBy) || REVIEW_DENIAL_PATTERN.test(policy.reviewedBy)) {
    throw new Error('approved license policy reviewedBy contains a placeholder token');
  }
}

export function validatePolicy(policy) {
  exactKeys(policy, POLICY_KEYS, 'dependency license review policy');
  if (policy.kind !== POLICY_KIND || policy.protocol !== PROTOCOL || policy.schemaVersion !== 1) {
    throw new Error('dependency license review policy has the wrong kind, protocol, or schemaVersion');
  }
  if (!isNonzeroHash(policy.pnpmLockSha256)) {
    throw new Error('dependency license policy pnpmLockSha256 must be a nonzero lowercase SHA-256 value');
  }
  if (!isNonzeroHash(policy.licenseReportSha256)) {
    throw new Error('dependency license policy licenseReportSha256 must be a nonzero lowercase SHA-256 value');
  }
  if (!Array.isArray(policy.entries)) throw new Error('dependency license policy entries must be an array');
  if (!['darwin-arm64', 'linux-x64'].includes(policy.platform)) {
    throw new Error('dependency license review policy platform is unsupported');
  }
  if (policy.state === 'inventory-baselined') validateInventoryBaseline(policy);
  else if (policy.state === 'approved') validateApprovedPolicy(policy);
  else throw new Error('dependency license review policy state must be inventory-baselined or approved');
}

function validateDisposition(value, index) {
  const label = `license policy disposition ${index}`;
  exactKeys(value, ENTRY_KEYS, label);
  if (!['unknown', 'copyleft', 'restricted'].includes(value.classification)) {
    throw new Error(`${label}.classification is invalid`);
  }
  if (value.disposition !== 'allowed' && value.disposition !== 'blocked') {
    if (!['dev-only', 'needs-counsel', 'not-distributed'].includes(value.disposition)) {
      throw new Error(`${label}.disposition is invalid`);
    }
  }
  if (!['development-only', 'not-distributed', 'release', 'undetermined'].includes(value.releaseRelevance)) {
    throw new Error(`${label}.releaseRelevance is invalid`);
  }
  canonicalString(value.license, `${label}.license`);
  canonicalString(value.name, `${label}.name`);
  const expectedClassification = classifyLicense(value.license);
  if (expectedClassification === null || value.classification !== expectedClassification) {
    throw new Error(`${label}.classification does not match the license expression`);
  }
  const versions = normalizeVersions(value.versions, label);
  if (versions.some((version, versionIndex) => version !== value.versions[versionIndex])) {
    throw new Error(`${label}.versions must be sorted`);
  }
  canonicalString(value.rationale, `${label}.rationale`, 30);
  if (PLACEHOLDER_PATTERN.test(value.rationale) || REVIEW_DENIAL_PATTERN.test(value.rationale)) {
    throw new Error(`${label}.rationale contains placeholder or nonapproval language`);
  }
  return { ...value, versions };
}

export function evaluateLicenseReview({ policy, lockfileBytes, reportBytes, workspaceConfigBytes }) {
  const errors = [];
  let requiredEntries = [];
  let report;

  try {
    validatePolicy(policy);
  } catch (error) {
    return { errors: [error.message], requiredEntries };
  }
  try {
    report = JSON.parse(Buffer.from(reportBytes).toString('utf8'));
    requiredEntries = reviewRequiredEntries(report);
  } catch (error) {
    return { errors: [`license report is invalid: ${error.message}`], requiredEntries };
  }

  const lockfileSha256 = sha256(lockfileBytes);
  const licenseReportSha256 = sha256(reportBytes);
  if (policy.pnpmLockSha256 !== lockfileSha256) {
    errors.push(`pnpm lockfile hash mismatch: expected ${policy.pnpmLockSha256}, received ${lockfileSha256}`);
  }
  if (policy.licenseReportSha256 !== licenseReportSha256) {
    errors.push(
      `license report hash mismatch: expected ${policy.licenseReportSha256}, received ${licenseReportSha256}`,
    );
  }
  if (policy.platform !== report.source.platform) {
    errors.push(`license policy platform ${policy.platform} does not match inventory ${report.source.platform}`);
  }
  if (!(workspaceConfigBytes instanceof Uint8Array)) {
    errors.push('pnpm workspace configuration bytes are required');
  } else if (sha256(workspaceConfigBytes) !== report.source.pnpmWorkspaceSha256) {
    errors.push('pnpm workspace configuration hash does not match the inventory');
  }

  const expectedByKey = new Map(requiredEntries.map((entry) => [entryKey(entry), entry]));
  const dispositionsByKey = new Map();
  for (const [index, value] of policy.entries.entries()) {
    let disposition;
    try {
      disposition = validateDisposition(value, index);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    const key = entryKey(disposition);
    if (dispositionsByKey.has(key)) {
      errors.push(`duplicate license disposition for ${key}`);
      continue;
    }
    dispositionsByKey.set(key, disposition);

    const expected = expectedByKey.get(key);
    if (expected === undefined) {
      errors.push(`stale license disposition for ${key}`);
      continue;
    }
    if (disposition.classification !== expected.classification) {
      errors.push(`license disposition classification mismatch for ${key}: expected ${expected.classification}`);
    }
    if (
      policy.state === 'inventory-baselined' &&
      (disposition.disposition !== 'needs-counsel' || disposition.releaseRelevance !== 'undetermined')
    ) {
      errors.push(`inventory baseline disposition must remain needs-counsel and undetermined for ${key}`);
    }
  }

  for (const [key] of expectedByKey) {
    if (!dispositionsByKey.has(key)) errors.push(`missing reviewed license disposition for ${key}`);
  }
  return { errors, requiredEntries };
}

export function releaseApprovalErrors(policy) {
  const errors = [];
  try {
    validatePolicy(policy);
  } catch (error) {
    return [error.message];
  }

  const seen = new Set();
  if (policy.entries.length === 0) errors.push('approved dependency license policy has no reviewed dispositions');
  for (const [index, value] of policy.entries.entries()) {
    let disposition;
    try {
      disposition = validateDisposition(value, index);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    const key = entryKey(disposition);
    if (seen.has(key)) errors.push(`duplicate license disposition for ${key}`);
    seen.add(key);

    if (disposition.releaseRelevance === 'undetermined') {
      errors.push(`release relevance remains undetermined for ${key}`);
    }
    if (disposition.disposition === 'needs-counsel' || disposition.disposition === 'blocked') {
      errors.push(`release-blocking license disposition ${disposition.disposition} for ${key}`);
    }
    const requiredRelevance = {
      allowed: 'release',
      'dev-only': 'development-only',
      'not-distributed': 'not-distributed',
    }[disposition.disposition];
    if (requiredRelevance !== undefined && disposition.releaseRelevance !== requiredRelevance) {
      errors.push(
        `license disposition ${disposition.disposition} requires releaseRelevance ${requiredRelevance} for ${key}`,
      );
    }
  }
  if (policy.state !== 'approved') errors.push('dependency license review policy state is not approved');
  return errors;
}

async function main() {
  if (process.argv.length !== 6) {
    console.error(
      'Usage: check-license-review.mjs <dependency-license-review-policy.json> <pnpm-lock.yaml> <pnpm-workspace.yaml> <licenses.json>',
    );
    process.exitCode = 1;
    return;
  }
  const [policyPath, lockfilePath, workspaceConfigPath, reportPath] = process.argv
    .slice(2)
    .map((filePath) => resolve(filePath));
  let policy;
  let lockfileBytes;
  let reportBytes;
  let workspaceConfigBytes;
  try {
    const [policySource, lockfile, workspaceConfig, report] = await Promise.all([
      readFile(policyPath, 'utf8'),
      readFile(lockfilePath),
      readFile(workspaceConfigPath),
      readFile(reportPath),
    ]);
    policy = JSON.parse(policySource);
    lockfileBytes = lockfile;
    workspaceConfigBytes = workspaceConfig;
    reportBytes = report;
  } catch (error) {
    console.error(`Dependency license review failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const result = evaluateLicenseReview({ policy, lockfileBytes, reportBytes, workspaceConfigBytes });
  for (const error of result.errors) console.error(`Dependency license review failed: ${error}`);
  if (result.errors.length !== 0) {
    process.exitCode = 1;
    return;
  }
  console.log(
    `Dependency license review passed: ${result.requiredEntries.length} review-required entries have exact dispositions; policy state is ${policy.state}.`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
