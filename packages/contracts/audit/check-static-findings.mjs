#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(message);
}

function parseJson(label, value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableAnalyzerDescription(value) {
  return value
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length !== 0)
    .sort()
    .join('\n');
}

function sourceElement(element) {
  const source = element?.source_mapping;
  return (
    source != null &&
    source.is_dependency !== true &&
    typeof source.filename_relative === 'string' &&
    source.filename_relative.startsWith('src/')
  );
}

function normalizeSlither(report) {
  if (report?.success !== true || !Array.isArray(report?.results?.detectors)) {
    fail('Slither report is missing a successful detector result array');
  }

  return report.results.detectors
    .filter((finding) => Array.isArray(finding.elements) && finding.elements.some(sourceElement))
    .map((finding) => {
      if (
        typeof finding.check !== 'string' ||
        typeof finding.impact !== 'string' ||
        typeof finding.confidence !== 'string' ||
        typeof finding.description !== 'string'
      ) {
        fail('Slither report contains a malformed source finding');
      }
      const primary = finding.elements.find(sourceElement);
      const source = primary.source_mapping;
      const lines = Array.isArray(source.lines) ? source.lines : [];
      if (lines.length === 0 || !lines.every(Number.isInteger)) {
        fail(`Slither finding ${finding.check} has no exact source span`);
      }
      return {
        tool: 'slither',
        detector: finding.check,
        severity: finding.impact,
        confidence: finding.confidence,
        path: source.filename_relative,
        symbolType: typeof primary.type === 'string' ? primary.type : 'unknown',
        symbol: typeof primary.name === 'string' ? primary.name : 'unknown',
        startLine: lines[0],
        endLine: lines.at(-1),
        // Slither builds several description sections from sets whose presentation order can vary between identical
        // runs. Preserve every nonempty line but sort the presentation before hashing so the exact register responds
        // to semantic content rather than analyzer iteration order.
        descriptionHash: hash(stableAnalyzerDescription(finding.description)),
      };
    });
}

function aderynBuckets(report) {
  if (report == null || typeof report !== 'object' || Array.isArray(report)) {
    fail('Aderyn report must be an object');
  }
  return [
    ['High', report.high_issues],
    ['Low', report.low_issues],
  ];
}

function normalizeAderyn(report) {
  const findings = [];
  for (const [severity, bucket] of aderynBuckets(report)) {
    if (bucket == null || !Array.isArray(bucket.issues)) {
      fail(`Aderyn report is missing ${severity.toLowerCase()}_issues.issues`);
    }
    for (const issue of bucket.issues) {
      if (typeof issue.detector_name !== 'string' || !Array.isArray(issue.instances)) {
        fail('Aderyn report contains a malformed issue');
      }
      for (const instance of issue.instances) {
        if (
          typeof instance.contract_path !== 'string' ||
          !instance.contract_path.startsWith('src/') ||
          !Number.isInteger(instance.line_no)
        ) {
          fail(`Aderyn finding ${issue.detector_name} has a malformed source location`);
        }
        findings.push({
          tool: 'aderyn',
          detector: issue.detector_name,
          severity,
          confidence: 'Analyzer',
          path: instance.contract_path,
          symbolType: 'source',
          symbol: typeof instance.src === 'string' ? instance.src : 'unknown',
          startLine: instance.line_no,
          endLine: instance.line_no,
          descriptionHash: hash(`${issue.description ?? ''}\n${instance.hint ?? ''}`),
        });
      }
    }
  }
  return findings;
}

function findingKey(finding) {
  return [
    finding.tool,
    finding.detector,
    finding.severity,
    finding.confidence,
    finding.path,
    finding.symbolType,
    finding.symbol,
    finding.startLine,
    finding.endLine,
    finding.descriptionHash,
  ].join('|');
}

function sortedUnique(findings, label) {
  const byKey = new Map();
  for (const finding of findings) {
    const key = findingKey(finding);
    if (byKey.has(key)) fail(`${label} contains duplicate normalized finding ${key}`);
    byKey.set(key, finding);
  }
  return [...byKey.values()].sort((left, right) => findingKey(left).localeCompare(findingKey(right)));
}

function validatePolicy(policy) {
  if (policy?.version !== 2 || typeof policy.reviewedAt !== 'string' || typeof policy.expiresAt !== 'string') {
    fail('Static disposition policy has an invalid header');
  }
  if (Number.isNaN(Date.parse(policy.reviewedAt)) || Number.isNaN(Date.parse(policy.expiresAt))) {
    fail('Static disposition policy dates must be ISO-8601 values');
  }
  if (policy.rationales == null || typeof policy.rationales !== 'object' || Array.isArray(policy.rationales)) {
    fail('Static disposition policy must define detector rationales');
  }
  if (policy.reviewers == null || typeof policy.reviewers !== 'object' || Array.isArray(policy.reviewers)) {
    fail('Static disposition policy must define named reviewers');
  }
  if (
    policy.rationaleProfiles == null ||
    typeof policy.rationaleProfiles !== 'object' ||
    Array.isArray(policy.rationaleProfiles)
  ) {
    fail('Static disposition policy must define rationale review profiles');
  }
  if (
    policy.reviewProfiles == null ||
    typeof policy.reviewProfiles !== 'object' ||
    Array.isArray(policy.reviewProfiles)
  ) {
    fail('Static disposition policy must define reusable review profiles');
  }
  if (!Array.isArray(policy.entries)) fail('Static disposition policy must contain an entries array');

  const now = Date.parse(process.env.STATIC_FINDINGS_NOW ?? new Date().toISOString());
  if (Number.isNaN(now)) {
    fail('STATIC_FINDINGS_NOW must be an ISO-8601 value when provided');
  }
  if (Date.parse(policy.reviewedAt) > now) {
    fail(`Static finding dispositions have a future review date ${policy.reviewedAt}`);
  }
  if (Date.parse(policy.expiresAt) <= Date.parse(policy.reviewedAt)) {
    fail('Static finding disposition expiry must be after the review date');
  }
  if (Date.parse(policy.expiresAt) < now) {
    fail(`Static finding dispositions expired at ${policy.expiresAt}`);
  }
  for (const [id, rationale] of Object.entries(policy.rationales)) {
    if (typeof rationale !== 'string' || rationale.trim().length < 30) {
      fail(`Static disposition rationale ${id} is missing or too short`);
    }
    const profileId = policy.rationaleProfiles[id];
    const profile = policy.reviewProfiles[profileId];
    if (typeof profileId !== 'string' || profile == null || typeof profile !== 'object' || Array.isArray(profile)) {
      fail(`Static disposition rationale ${id} is missing a review profile`);
    }
    if (typeof profile.reviewerId !== 'string' || policy.reviewers[profile.reviewerId] == null) {
      fail(`Static disposition rationale ${id} has an unknown reviewer`);
    }
    for (const field of ['impact', 'exploitability', 'revisitTrigger']) {
      if (typeof profile[field] !== 'string' || profile[field].trim().length < 30) {
        fail(`Static disposition rationale ${id} has an invalid ${field}`);
      }
    }
    for (const field of ['affectedAssumptions', 'compensatingControls']) {
      if (
        !Array.isArray(profile[field]) ||
        profile[field].length === 0 ||
        !profile[field].every((value) => typeof value === 'string' && value.trim().length >= 12)
      ) {
        fail(`Static disposition rationale ${id} has invalid ${field}`);
      }
    }
  }
  for (const [id, reviewer] of Object.entries(policy.reviewers)) {
    if (
      reviewer == null ||
      typeof reviewer !== 'object' ||
      Array.isArray(reviewer) ||
      typeof reviewer.name !== 'string' ||
      reviewer.name.trim().length < 3 ||
      typeof reviewer.role !== 'string' ||
      reviewer.role.trim().length < 12
    ) {
      fail(`Static disposition reviewer ${id} is malformed`);
    }
  }
  for (const [id, profileId] of Object.entries(policy.rationaleProfiles)) {
    if (typeof policy.rationales[id] !== 'string') {
      fail(`Static disposition review profile ${id} has no rationale`);
    }
    if (typeof profileId !== 'string' || policy.reviewProfiles[profileId] == null) {
      fail(`Static disposition rationale ${id} refers to an unknown review profile`);
    }
  }
  for (const id of Object.keys(policy.reviewProfiles)) {
    if (!Object.values(policy.rationaleProfiles).includes(id)) {
      fail(`Static disposition review profile ${id} is unused`);
    }
  }
}

function dispositionFor(finding, policy) {
  const rationaleId = `${finding.tool}:${finding.detector}`;
  if (typeof policy.rationales[rationaleId] !== 'string') {
    fail(`No reviewed rationale exists for detector ${rationaleId}`);
  }
  const reviewProfileId = policy.rationaleProfiles[rationaleId];
  const profile = policy.reviewProfiles[reviewProfileId];
  if (typeof reviewProfileId !== 'string' || profile == null || typeof profile.reviewerId !== 'string') {
    fail(`No review profile exists for detector ${rationaleId}`);
  }
  return {
    ...finding,
    rationaleId,
    reviewProfileId,
    reviewerId: profile.reviewerId,
    reviewedAt: policy.reviewedAt,
  };
}

function validateRationaleCoverage(entries, policy) {
  const currentIds = new Set(entries.map((entry) => entry.rationaleId));
  const staleIds = Object.keys(policy.rationales).filter((id) => !currentIds.has(id));
  if (staleIds.length !== 0) {
    fail(`Static disposition policy contains stale detector rationales: ${staleIds.join(', ')}`);
  }
}

async function main() {
  const positional = process.argv.slice(2).filter((argument) => argument !== '--update');
  const update = process.argv.includes('--update');
  if (positional.length !== 3) {
    fail('Usage: check-static-findings.mjs [--update] <policy.json> <slither.json> <aderyn.json>');
  }

  const [policyPath, slitherPath, aderynPath] = positional.map((path) => resolve(path));
  const [policySource, slitherSource, aderynSource] = await Promise.all([
    readFile(policyPath, 'utf8'),
    readFile(slitherPath, 'utf8'),
    readFile(aderynPath, 'utf8'),
  ]);
  const policy = parseJson('Static disposition policy', policySource);
  validatePolicy(policy);
  if (update) policy.reviewedAt = new Date().toISOString().slice(0, 10);
  const findings = sortedUnique(
    [
      ...normalizeSlither(parseJson('Slither report', slitherSource)),
      ...normalizeAderyn(parseJson('Aderyn report', aderynSource)),
    ],
    'Analyzer reports',
  );
  const currentEntries = findings.map((finding) => dispositionFor(finding, policy));

  if (update) {
    validateRationaleCoverage(currentEntries, policy);
    policy.entries = currentEntries;
    await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
    process.stdout.write(`Recorded ${currentEntries.length} exact static finding dispositions for review.\n`);
    return;
  }

  const expectedEntries = sortedUnique(policy.entries, 'Static disposition policy');
  const expectedByKey = new Map(expectedEntries.map((entry) => [findingKey(entry), entry]));
  const currentByKey = new Map(currentEntries.map((entry) => [findingKey(entry), entry]));
  const newKeys = [...currentByKey.keys()].filter((key) => !expectedByKey.has(key));
  const staleKeys = [...expectedByKey.keys()].filter((key) => !currentByKey.has(key));
  if (newKeys.length !== 0 || staleKeys.length !== 0) {
    const details = [...newKeys.map((key) => `NEW ${key}`), ...staleKeys.map((key) => `STALE ${key}`)].join('\n');
    fail(`Static findings drifted from the reviewed register:\n${details}`);
  }
  validateRationaleCoverage(currentEntries, policy);

  for (const entry of policy.entries) {
    if (entry.rationaleId !== `${entry.tool}:${entry.detector}`) {
      fail(`Disposition ${findingKey(entry)} has an invalid rationaleId`);
    }
    if (typeof policy.rationales[entry.rationaleId] !== 'string') {
      fail(`Disposition ${findingKey(entry)} refers to an unknown rationale`);
    }
    const reviewProfileId = policy.rationaleProfiles[entry.rationaleId];
    const profile = policy.reviewProfiles[reviewProfileId];
    if (
      entry.reviewProfileId !== reviewProfileId ||
      entry.reviewerId !== profile.reviewerId ||
      entry.reviewedAt !== policy.reviewedAt
    ) {
      fail(`Disposition ${findingKey(entry)} has stale review metadata`);
    }
  }
  process.stdout.write(
    `Static finding policy accepted ${currentEntries.length} exact findings (${new Set(currentEntries.map((entry) => `${entry.tool}:${entry.detector}`)).size} tool-detector classes).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
