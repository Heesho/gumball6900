#!/usr/bin/env node

import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  analyzerEnvironmentLockPaths,
  analyzerEnvironmentPolicyPath,
  assertOnlyArguments,
  canonicalLogoPath,
  canonicalLogoProvenancePolicyPath,
  dependencyLicenseInventoryPath,
  dependencyLicenseReviewPolicyPath,
  deterministicJson,
  evaluateReleaseReadiness,
  parseNamedArguments,
  releaseManifestSignaturePolicyPath,
  safeControlPlanePolicyPath,
  resolveCanonicalGithubRepositoryUrl,
  repositoryLicenseNoticePolicyPath,
  requiredArgument,
  robinhoodTestnetForkEvidencePath,
} from './release-lib.mjs';

async function optionalText(filePath) {
  return readFile(filePath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
}

async function optionalBytes(filePath) {
  return lstat(filePath)
    .then((stats) => {
      if (stats.isSymbolicLink() || !stats.isFile()) return null;
      return readFile(filePath);
    })
    .catch((error) => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    });
}

async function optionalJson(filePath) {
  const text = await optionalText(filePath);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { invalidJson: true };
  }
}

async function main() {
  const arguments_ = parseNamedArguments(process.argv.slice(2));
  assertOnlyArguments(arguments_, ['report', 'workspace']);
  const workspace = path.resolve(requiredArgument(arguments_, 'workspace'));
  const reportPath = path.resolve(requiredArgument(arguments_, 'report'));
  const packageJson = await optionalJson(path.join(workspace, 'package.json'));
  const canonicalRepositoryUrl = await resolveCanonicalGithubRepositoryUrl(workspace);
  const analyzerEnvironmentLockfiles = Object.fromEntries(
    await Promise.all(
      analyzerEnvironmentLockPaths.map(async (repositoryPath) => [
        repositoryPath,
        await optionalBytes(path.join(workspace, repositoryPath)),
      ]),
    ),
  );
  const blockers = evaluateReleaseReadiness({
    analyzerEnvironmentLockfiles,
    analyzerEnvironmentPolicy: await optionalJson(path.join(workspace, analyzerEnvironmentPolicyPath)),
    canonicalLogo: await optionalBytes(path.join(workspace, canonicalLogoPath)),
    canonicalLogoProvenancePolicy: await optionalJson(path.join(workspace, canonicalLogoProvenancePolicyPath)),
    canonicalRepositoryUrl,
    dependencyLicenseInventory: await optionalBytes(path.join(workspace, dependencyLicenseInventoryPath)),
    dependencyLicenseReviewPolicy: await optionalJson(path.join(workspace, dependencyLicenseReviewPolicyPath)),
    license: await optionalBytes(path.join(workspace, 'LICENSE')),
    notice: await optionalBytes(path.join(workspace, 'NOTICE')),
    packageLicense:
      packageJson !== null && typeof packageJson === 'object' && typeof packageJson.license === 'string'
        ? packageJson.license
        : null,
    pnpmLock: await optionalBytes(path.join(workspace, 'pnpm-lock.yaml')),
    pnpmWorkspace: await optionalBytes(path.join(workspace, 'pnpm-workspace.yaml')),
    readme: await optionalText(path.join(workspace, 'README.md')),
    releaseManifestSignaturePolicy: await optionalJson(path.join(workspace, releaseManifestSignaturePolicyPath)),
    safeControlPlanePolicy: await optionalJson(path.join(workspace, safeControlPlanePolicyPath)),
    repositoryLicenseNoticePolicy: await optionalJson(path.join(workspace, repositoryLicenseNoticePolicyPath)),
    robinhoodTestnetForkEvidence: await optionalJson(path.join(workspace, robinhoodTestnetForkEvidencePath)),
    security: await optionalText(path.join(workspace, 'SECURITY.md')),
  });
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    deterministicJson({
      blockers,
      candidateAuthorization: blockers.length === 0 ? 'eligible-for-technical-final-gate' : 'blocked',
      canonicalRepositoryUrl,
      checkedFiles: [
        analyzerEnvironmentPolicyPath,
        ...analyzerEnvironmentLockPaths,
        canonicalLogoPath,
        canonicalLogoProvenancePolicyPath,
        dependencyLicenseInventoryPath,
        dependencyLicenseReviewPolicyPath,
        'LICENSE',
        'NOTICE',
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'README.md',
        safeControlPlanePolicyPath,
        'SECURITY.md',
        releaseManifestSignaturePolicyPath,
        repositoryLicenseNoticePolicyPath,
        robinhoodTestnetForkEvidencePath,
      ],
    }),
  );
  if (blockers.length > 0) {
    for (const blocker of blockers) process.stderr.write(`Release blocker: ${blocker}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    'Hermetic analyzer environment, canonical-origin-bound security contact, hash-bound brand provenance, license/NOTICE and dependency-license review, release signature, and fork evidence checks passed.\n',
  );
}

main().catch((error) => {
  process.stderr.write(`Release readiness check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
