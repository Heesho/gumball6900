import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deploymentManifestRequiresTrustedSignaturePolicy,
  deploymentManifestSigningPayload,
  assertFreshReleaseEvidence,
  parseDeploymentManifest,
  parseReleaseManifestSignaturePolicyConfiguration,
  releaseManifestSignaturePolicyConfiguration,
  validateDeploymentManifest,
  type ReleaseManifestSignaturePolicyConfiguration,
} from '../schemas/deployment-manifest.js';
import { deterministicJson } from '../tooling/deterministic-json.js';
import {
  assertExactTrackedWorktreeAtHead,
  assertExpectedGitRepositoryRoot,
  assertRepositoryHead,
  readExactTrackedFileAtHead,
  sanitizedGitOutput,
} from '../tooling/tracked-git-file.js';
import { assertKnownOptions, parseArguments, requireValue, resolveUserPath, writeOutput } from './cli-helpers.js';

const releaseManifestPolicyPath = 'packages/config/deployments/release-manifest-signature-policy.json';

function rawSha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertOnlyAddedEvidencePaths(diff: string, expectedPaths: readonly string[]): void {
  const records = diff.length === 0 ? [] : diff.split('\n');
  const actualPaths = records.map((record) => {
    const match = /^A\t([^\t]+)$/.exec(record);
    if (match === null) throw new Error('Release evidence commit may only add regular declared evidence files');
    return match[1]!;
  });
  const expected = [...expectedPaths].sort();
  const actual = [...actualPaths].sort();
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) {
    throw new Error('Release evidence commit must add only the signed manifest and its two hash-bound JSON snapshots');
  }
}

async function repositoryRelativeRegularJsonPath(repositoryRoot: string, inputPath: string): Promise<string> {
  const lexicalPath = nodePath.resolve(inputPath);
  const stats = await lstat(lexicalPath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error('Signed manifest must be a regular nonsymlink file');
  }
  const resolvedPath = await realpath(lexicalPath);
  if (resolvedPath !== lexicalPath) throw new Error('Signed manifest path must not have symlink ancestry');
  const relativePath = nodePath.relative(repositoryRoot, resolvedPath).split(nodePath.sep).join('/');
  if (
    relativePath.length === 0 ||
    relativePath.startsWith('../') ||
    nodePath.posix.normalize(relativePath) !== relativePath ||
    nodePath.posix.extname(relativePath) !== '.json' ||
    !/^[0-9A-Za-z._/-]+$/.test(relativePath)
  ) {
    throw new Error('Signed manifest must be a normalized repository-confined JSON path');
  }
  return relativePath;
}

async function regularBlobObjectIdAtCommit(
  repositoryRoot: string,
  commit: string,
  repositoryRelativePath: string,
  label: string,
): Promise<string> {
  const treeEntry = await sanitizedGitOutput(repositoryRoot, ['ls-tree', commit, '--', repositoryRelativePath]);
  const match = /^100644 blob ([0-9a-f]{40,64})\t(.+)$/.exec(treeEntry);
  if (match === null || match[2] !== repositoryRelativePath) {
    throw new Error(`${label} must be exactly one regular nonexecutable 100644 blob at commit ${commit}`);
  }
  return match[1]!;
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(
    arguments_,
    ['file', 'output'],
    ['print-canonical', 'print-signing-payload', 'require-release-evidence'],
  );
  if (arguments_.flags.has('print-canonical') && arguments_.flags.has('print-signing-payload')) {
    throw new Error('Choose at most one print mode');
  }
  const manifestArgument = requireValue(arguments_, 'file');
  const manifestPath = resolveUserPath(manifestArgument);
  let value = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  let parsedManifest = parseDeploymentManifest(value);
  const requireReleaseEvidence = arguments_.flags.has('require-release-evidence');
  if (requireReleaseEvidence && parsedManifest.release.status !== 'release-approved') {
    throw new Error('Release-evidence validation requires a release-approved manifest');
  }
  let trustedPolicy: ReleaseManifestSignaturePolicyConfiguration = releaseManifestSignaturePolicyConfiguration;
  let repositoryBoundary: { readonly commit: string; readonly root: string } | null = null;
  if (requireReleaseEvidence || deploymentManifestRequiresTrustedSignaturePolicy(parsedManifest)) {
    const expectedRepositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const repositoryRoot = await assertExpectedGitRepositoryRoot(expectedRepositoryRoot);
    const evidenceCommit = await sanitizedGitOutput(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
    const manifestRelativePath = await repositoryRelativeRegularJsonPath(repositoryRoot, manifestPath);
    const ancestry = (
      await sanitizedGitOutput(repositoryRoot, ['rev-list', '--parents', '-n', '1', evidenceCommit])
    ).split(' ');
    if (ancestry.length !== 2 || ancestry[0] !== evidenceCommit || !/^[0-9a-f]{40,64}$/.test(ancestry[1]!)) {
      throw new Error('Release evidence commit must have exactly one source-commit parent');
    }
    const sourceCommit = ancestry[1]!;
    if (sourceCommit !== parsedManifest.release.gitCommit) {
      throw new Error(
        `Evidence parent ${sourceCommit} does not match manifest source commit ${parsedManifest.release.gitCommit}`,
      );
    }
    const snapshotDescriptors =
      parsedManifest.releaseEvidence === null
        ? []
        : [parsedManifest.releaseEvidence.deploymentConfig, parsedManifest.releaseEvidence.deploymentState];
    const evidencePaths = snapshotDescriptors.map(({ path }) => path);
    if (new Set([manifestRelativePath, ...evidencePaths]).size !== 1 + evidencePaths.length) {
      throw new Error('Signed manifest and deployment snapshot evidence paths must be distinct');
    }
    const evidenceDiff = await sanitizedGitOutput(repositoryRoot, [
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '--no-renames',
      '-r',
      sourceCommit,
      evidenceCommit,
      '--',
    ]);
    assertOnlyAddedEvidencePaths(evidenceDiff, [manifestRelativePath, ...evidencePaths]);
    for (const [index, descriptor] of snapshotDescriptors.entries()) {
      const label = index === 0 ? 'Deployment config snapshot' : 'Deployment state snapshot';
      await regularBlobObjectIdAtCommit(repositoryRoot, evidenceCommit, descriptor.path, label);
      const exactBytes = await readExactTrackedFileAtHead(repositoryRoot, descriptor.path, evidenceCommit);
      if (rawSha256(exactBytes) !== descriptor.rawSha256) {
        throw new Error(`${label} raw bytes do not match the SHA-256 signed in the manifest`);
      }
      try {
        JSON.parse(exactBytes);
      } catch (error) {
        throw new Error(`${label} is not valid JSON`, { cause: error });
      }
    }
    const sourcePolicyObjectId = await regularBlobObjectIdAtCommit(
      repositoryRoot,
      sourceCommit,
      releaseManifestPolicyPath,
      'Source release-manifest signature policy',
    );
    const evidencePolicyObjectId = await regularBlobObjectIdAtCommit(
      repositoryRoot,
      evidenceCommit,
      releaseManifestPolicyPath,
      'Evidence release-manifest signature policy',
    );
    if (sourcePolicyObjectId !== evidencePolicyObjectId) {
      throw new Error('Release-manifest signature policy must be byte-identical in source and evidence commits');
    }
    await assertExactTrackedWorktreeAtHead(repositoryRoot, evidenceCommit);
    const status = await sanitizedGitOutput(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
    if (status.length !== 0) {
      throw new Error('Git worktree must be clean before printing or validating a signed manifest');
    }
    value = JSON.parse(
      await readExactTrackedFileAtHead(repositoryRoot, manifestRelativePath, evidenceCommit),
    ) as unknown;
    parsedManifest = parseDeploymentManifest(value);
    if (!deploymentManifestRequiresTrustedSignaturePolicy(parsedManifest)) {
      throw new Error('Exact evidence manifest must use an active trusted signature policy');
    }
    if (requireReleaseEvidence && parsedManifest.release.status !== 'release-approved') {
      throw new Error('Exact release evidence is not release-approved');
    }
    if (parsedManifest.release.gitCommit !== sourceCommit) {
      throw new Error('Exact evidence manifest no longer matches the source commit');
    }
    trustedPolicy = parseReleaseManifestSignaturePolicyConfiguration(
      JSON.parse(
        await readExactTrackedFileAtHead(repositoryRoot, releaseManifestPolicyPath, evidenceCommit),
      ) as unknown,
    );
    await assertRepositoryHead(repositoryRoot, evidenceCommit);
    repositoryBoundary = { commit: evidenceCommit, root: repositoryRoot };
  }
  const manifest = await validateDeploymentManifest(value, trustedPolicy);
  if (requireReleaseEvidence) assertFreshReleaseEvidence(manifest);
  if (arguments_.flags.has('print-canonical') || arguments_.flags.has('print-signing-payload')) {
    const content = arguments_.flags.has('print-signing-payload')
      ? deploymentManifestSigningPayload(manifest)
      : deterministicJson(manifest);
    if (repositoryBoundary !== null) {
      await assertRepositoryHead(repositoryBoundary.root, repositoryBoundary.commit);
    }
    await writeOutput(content, arguments_.values.get('output'));
    return;
  }
  if (repositoryBoundary !== null) {
    await assertRepositoryHead(repositoryBoundary.root, repositoryBoundary.commit);
  }
  process.stdout.write(`Deployment manifest is valid: ${manifestArgument}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Deployment manifest validation failed: ${message}\n`);
  process.exitCode = 1;
});
