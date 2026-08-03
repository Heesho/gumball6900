#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIGEST_REFERENCE_PATTERN = /^[a-z0-9][a-z0-9._/-]*:v?\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?@sha256:[a-f0-9]{64}$/u;
const IMAGE_ID_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SEVERITIES = ['Unknown', 'Negligible', 'Low', 'Medium', 'High', 'Critical'];

function usage() {
  return [
    'Usage: node scripts/release/check-container-vulnerabilities.mjs',
    '  --policy FILE --sbom FILE --spdx FILE --scan FILE --database-status FILE --smoke FILE',
    '  --image-id sha256:... --output FILE',
    '  or: --policy FILE --policy-only',
  ].join('\n');
}

function parseArguments(argv) {
  const options = { policyOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--policy-only') {
      options.policyOnly = true;
      continue;
    }
    const keys = new Map([
      ['--database-status', 'databaseStatus'],
      ['--image-id', 'imageId'],
      ['--output', 'output'],
      ['--policy', 'policy'],
      ['--sbom', 'sbom'],
      ['--scan', 'scan'],
      ['--smoke', 'smoke'],
      ['--spdx', 'spdx'],
    ]);
    const key = keys.get(argument);
    if (key === undefined) throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
    index += 1;
    options[key] = key === 'imageId' ? value : path.resolve(value);
  }
  if (options.policy === undefined) throw new Error('--policy is required.');
  if (options.policyOnly) {
    if (Object.keys(options).some((key) => !['policy', 'policyOnly'].includes(key))) {
      throw new Error('--policy-only cannot be combined with scan inputs.');
    }
    return options;
  }
  for (const key of ['databaseStatus', 'imageId', 'output', 'sbom', 'scan', 'smoke', 'spdx']) {
    if (options[key] === undefined)
      throw new Error(`--${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)} is required.`);
  }
  if (!IMAGE_ID_PATTERN.test(options.imageId)) throw new Error('--image-id must be a complete lowercase SHA-256 ID.');
  return options;
}

async function readJson(filePath, label) {
  let bytes;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    throw new Error(`${label} could not be read: ${error.message}`);
  }
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  return { bytes, value };
}

function exactKeys(value, expected, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  const observed = Object.keys(value).toSorted();
  if (JSON.stringify(observed) !== JSON.stringify([...expected].toSorted())) {
    throw new Error(`${label} keys do not match the fixed schema.`);
  }
}

function validateToolImage(image, name, repository) {
  exactKeys(image, ['reference', 'releaseSource', 'version'], `policy images.${name}`);
  if (!VERSION_PATTERN.test(image.version)) throw new Error(`policy images.${name}.version must be exact.`);
  if (!DIGEST_REFERENCE_PATTERN.test(image.reference)) {
    throw new Error(`policy images.${name}.reference must contain an exact tag and sha256 digest.`);
  }
  const expectedPrefix = `${repository}:v${image.version}@sha256:`;
  if (!image.reference.startsWith(expectedPrefix)) {
    throw new Error(`policy images.${name}.reference does not match its tool and version.`);
  }
  const expectedSource = `https://github.com/${repository}/releases/tag/v${image.version}`;
  if (image.releaseSource !== expectedSource) throw new Error(`policy images.${name}.releaseSource is not canonical.`);
}

export function validatePolicy(policy) {
  exactKeys(
    policy,
    ['database', 'images', 'kind', 'platform', 'protocol', 'reviewedAt', 'schemaVersion', 'severity'],
    'container security policy',
  );
  if (policy.kind !== 'gumball-6900-container-security-policy' || policy.protocol !== 'GUM BALL 6900') {
    throw new Error('Container security policy identity mismatch.');
  }
  if (policy.schemaVersion !== 1 || policy.platform !== 'linux/amd64') {
    throw new Error('Container security policy schema or platform mismatch.');
  }
  if (policy.reviewedAt !== '2026-08-02') throw new Error('Container security policy review date is not current.');

  exactKeys(policy.images, ['grype', 'nodeRuntime', 'syft'], 'policy images');
  validateToolImage(policy.images.grype, 'grype', 'anchore/grype');
  validateToolImage(policy.images.syft, 'syft', 'anchore/syft');
  exactKeys(policy.images.nodeRuntime, ['reference', 'releaseSource', 'version'], 'policy images.nodeRuntime');
  if (
    policy.images.nodeRuntime.version !== '22.23.1' ||
    policy.images.nodeRuntime.reference !==
      'node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3' ||
    policy.images.nodeRuntime.releaseSource !== 'https://nodejs.org/en/blog/release/v22.23.1'
  ) {
    throw new Error('Container security policy must bind the reviewed Node 22.23.1 runtime image.');
  }

  exactKeys(policy.database, ['maximumAgeHours', 'maximumFutureSkewMinutes', 'requireValid'], 'policy database');
  if (
    policy.database.maximumAgeHours !== 72 ||
    policy.database.maximumFutureSkewMinutes !== 15 ||
    policy.database.requireValid !== true
  ) {
    throw new Error('Container vulnerability database freshness policy was weakened.');
  }
  exactKeys(
    policy.severity,
    ['blockedSeverities', 'maximumBlockedMatches', 'maximumIgnoredMatches', 'maximumPackageAlerts'],
    'policy severity',
  );
  if (
    JSON.stringify(policy.severity.blockedSeverities) !== JSON.stringify(['Critical', 'High']) ||
    policy.severity.maximumBlockedMatches !== 0 ||
    policy.severity.maximumIgnoredMatches !== 0 ||
    policy.severity.maximumPackageAlerts !== 0
  ) {
    throw new Error('Container vulnerability severity policy was weakened.');
  }
  return policy;
}

function packagePurlsFromNativeSbom(sbom) {
  return new Set(
    sbom.artifacts
      .map((artifact) => artifact?.purl)
      .filter((purl) => typeof purl === 'string' && purl.startsWith('pkg:')),
  );
}

function packagePurlsFromSpdx(spdx) {
  return new Set(
    spdx.packages.flatMap((spdxPackage) =>
      (spdxPackage?.externalRefs ?? [])
        .filter(
          (reference) =>
            reference?.referenceCategory === 'PACKAGE-MANAGER' &&
            reference?.referenceType === 'purl' &&
            typeof reference?.referenceLocator === 'string' &&
            reference.referenceLocator.startsWith('pkg:'),
        )
        .map((reference) => reference.referenceLocator),
    ),
  );
}

function validateSmoke(smoke, imageId) {
  if (
    smoke?.kind !== 'gumball-6900-web-container-smoke-evidence' ||
    smoke?.protocol !== 'GUM BALL 6900' ||
    smoke?.result !== 'pass' ||
    smoke?.image?.id !== imageId ||
    smoke?.dockerHealthStatus !== 'healthy'
  ) {
    throw new Error('Container smoke evidence is not bound to the scanned release image ID.');
  }
}

function validateSbom(sbom, spdx, policy, imageId) {
  if (sbom?.descriptor?.name !== 'syft' || sbom.descriptor.version !== policy.images.syft.version) {
    throw new Error('Native SBOM was not generated by the pinned Syft version.');
  }
  if (!Array.isArray(sbom.artifacts) || sbom.artifacts.length === 0) {
    throw new Error('Native SBOM contains no software artifacts.');
  }
  if (
    sbom?.source?.type !== 'image' ||
    sbom?.source?.target?.imageID !== imageId ||
    sbom?.source?.target?.os !== 'linux' ||
    sbom?.source?.target?.architecture !== 'amd64'
  ) {
    throw new Error('Native SBOM is not bound to the scanned linux/amd64 release image ID.');
  }
  if (!VERSION_PATTERN.test(sbom?.schema?.version ?? '') || typeof sbom?.schema?.url !== 'string') {
    throw new Error('Native SBOM omits its schema identity.');
  }

  if (!/^SPDX-2\.[23]$/u.test(spdx?.spdxVersion ?? '') || spdx?.dataLicense !== 'CC0-1.0') {
    throw new Error('SPDX evidence does not identify a supported SPDX 2.x JSON document.');
  }
  if (!Array.isArray(spdx.packages) || spdx.packages.length === 0)
    throw new Error('SPDX evidence contains no packages.');
  const creators = spdx?.creationInfo?.creators;
  if (!Array.isArray(creators) || !creators.includes(`Tool: syft-${policy.images.syft.version}`)) {
    throw new Error('SPDX evidence was not generated by the pinned Syft version.');
  }
  const nativePurls = packagePurlsFromNativeSbom(sbom);
  const spdxPurls = packagePurlsFromSpdx(spdx);
  if (
    nativePurls.size === 0 ||
    nativePurls.size !== spdxPurls.size ||
    [...nativePurls].some((purl) => !spdxPurls.has(purl))
  ) {
    throw new Error('SPDX and native Syft evidence do not describe the same package inventory.');
  }
  return {
    nativeArtifactCount: sbom.artifacts.length,
    packagePurlCount: nativePurls.size,
    schemaVersion: sbom.schema.version,
    spdxPackageCount: spdx.packages.length,
    spdxVersion: spdx.spdxVersion,
  };
}

function validateDatabaseRecord(record, policy, now, label) {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) throw new Error(`${label} is missing.`);
  if (policy.database.requireValid && record.valid !== true) throw new Error(`${label} is not valid.`);
  if (typeof record.schemaVersion !== 'string' || record.schemaVersion.trim() === '') {
    throw new Error(`${label} omits its schema version.`);
  }
  const built = new Date(record.built);
  if (!Number.isFinite(built.getTime())) throw new Error(`${label} has an invalid build time.`);
  const ageMilliseconds = now.getTime() - built.getTime();
  if (ageMilliseconds > policy.database.maximumAgeHours * 60 * 60 * 1_000) {
    throw new Error(`${label} exceeds the ${policy.database.maximumAgeHours}-hour freshness limit.`);
  }
  if (ageMilliseconds < -policy.database.maximumFutureSkewMinutes * 60 * 1_000) {
    throw new Error(`${label} build time is implausibly far in the future.`);
  }
  return { built: built.toISOString(), schemaVersion: record.schemaVersion, valid: record.valid };
}

export function evaluateContainerScan({ databaseStatus, imageId, now = new Date(), policy, sbom, scan, smoke, spdx }) {
  validatePolicy(policy);
  validateSmoke(smoke, imageId);
  const sbomSummary = validateSbom(sbom, spdx, policy, imageId);
  if (scan?.descriptor?.name !== 'grype' || scan.descriptor.version !== policy.images.grype.version) {
    throw new Error('Vulnerability report was not generated by the pinned Grype version.');
  }
  if (
    scan?.source?.type !== 'sbom-file' ||
    !String(scan?.source?.target ?? '').endsWith('web-container.sbom.syft.json')
  ) {
    throw new Error('Grype report was not produced from the archived native SBOM.');
  }
  if (!Array.isArray(scan.matches)) throw new Error('Grype report omits its matches array.');
  const ignoredMatches = scan.ignoredMatches ?? [];
  const packageAlerts = scan.alertsByPackage ?? [];
  if (!Array.isArray(ignoredMatches) || ignoredMatches.length > policy.severity.maximumIgnoredMatches) {
    throw new Error('Grype report contains ignored vulnerability matches.');
  }
  if (!Array.isArray(packageAlerts) || packageAlerts.length > policy.severity.maximumPackageAlerts) {
    throw new Error('Grype report contains package lifecycle alerts.');
  }

  const counts = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0]));
  const blocked = [];
  for (const [index, match] of scan.matches.entries()) {
    const severity = match?.vulnerability?.severity;
    const id = match?.vulnerability?.id;
    const artifactName = match?.artifact?.name;
    if (!SEVERITIES.includes(severity) || typeof id !== 'string' || id === '' || typeof artifactName !== 'string') {
      throw new Error(`Grype match ${index} is malformed.`);
    }
    counts[severity] += 1;
    if (policy.severity.blockedSeverities.includes(severity)) blocked.push({ artifactName, id, severity });
  }
  if (blocked.length > policy.severity.maximumBlockedMatches) {
    throw new Error(
      `Container vulnerability policy rejected ${blocked.length} high/critical match(es): ${blocked
        .slice(0, 10)
        .map((finding) => `${finding.id} (${finding.severity}) in ${finding.artifactName}`)
        .join(', ')}`,
    );
  }

  const reportDatabase = validateDatabaseRecord(scan.descriptor.db, policy, now, 'Grype report database');
  const statusDatabase = validateDatabaseRecord(databaseStatus, policy, now, 'Grype database status');
  if (
    reportDatabase.built !== statusDatabase.built ||
    reportDatabase.schemaVersion !== statusDatabase.schemaVersion ||
    reportDatabase.valid !== statusDatabase.valid
  ) {
    throw new Error('Grype report and archived database status do not identify the same database.');
  }

  return {
    database: reportDatabase,
    imageId,
    kind: 'gumball-6900-container-vulnerability-gate-evidence',
    policyResult: 'pass',
    protocol: 'GUM BALL 6900',
    scanner: { name: 'grype', version: scan.descriptor.version },
    schemaVersion: 1,
    severityCounts: counts,
    sbom: sbomSummary,
    totalMatches: scan.matches.length,
  };
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
    if (options.output !== undefined) await rm(options.output, { force: true });
    const { value: policy } = await readJson(options.policy, 'Container security policy');
    validatePolicy(policy);
    if (options.policyOnly) {
      process.stdout.write(`${JSON.stringify({ images: policy.images, platform: policy.platform })}\n`);
      return;
    }

    const [sbom, spdx, scan, databaseStatus, smoke] = await Promise.all([
      readJson(options.sbom, 'Native SBOM'),
      readJson(options.spdx, 'SPDX SBOM'),
      readJson(options.scan, 'Grype vulnerability report'),
      readJson(options.databaseStatus, 'Grype database status'),
      readJson(options.smoke, 'Container smoke evidence'),
    ]);
    const evidence = evaluateContainerScan({
      databaseStatus: databaseStatus.value,
      imageId: options.imageId,
      policy,
      sbom: sbom.value,
      scan: scan.value,
      smoke: smoke.value,
      spdx: spdx.value,
    });
    evidence.inputs = {
      databaseStatusSha256: createHash('sha256').update(databaseStatus.bytes).digest('hex'),
      nativeSbomSha256: createHash('sha256').update(sbom.bytes).digest('hex'),
      policySha256: createHash('sha256')
        .update(await readFile(options.policy))
        .digest('hex'),
      scanSha256: createHash('sha256').update(scan.bytes).digest('hex'),
      smokeSha256: createHash('sha256').update(smoke.bytes).digest('hex'),
      spdxSbomSha256: createHash('sha256').update(spdx.bytes).digest('hex'),
    };
    if (Object.values(evidence.inputs).some((digest) => !SHA256_PATTERN.test(digest))) {
      throw new Error('Container security evidence hashing failed.');
    }
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    process.stdout.write(`Container vulnerability gate passed; evidence: ${options.output}\n`);
  } catch (error) {
    if (options?.output !== undefined) await rm(options.output, { force: true });
    process.stderr.write(`Container vulnerability gate failed: ${error.message}\n${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
