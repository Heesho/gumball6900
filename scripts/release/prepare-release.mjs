#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertCurrentReleaseToolingAvailable,
  assertOnlyArguments,
  assertRepositoryHead,
  deriveSubgraphNetworks,
  deterministicJson,
  parseNamedArguments,
  readJson,
  requiredArgument,
  sha256File,
  sourceDateEpoch,
  validateGitObjectId,
  validateManifestBinding,
  validateReleaseEvidenceCommit,
  validateReleaseManifestSignaturePolicy,
  validateReleaseTag,
} from './release-lib.mjs';
import {
  parseRobinhoodRegistryRevalidationBytes,
  robinhoodRegistryResponseArchiveFileName,
  robinhoodRegistryRevalidationStages,
} from './robinhood-registry-revalidation.mjs';

async function main() {
  assertCurrentReleaseToolingAvailable();
  const arguments_ = parseNamedArguments(process.argv.slice(2));
  assertOnlyArguments(arguments_, [
    'evidence-commit',
    'manifest',
    'output-dir',
    'registry-response-archive',
    'registry-revalidation',
    'registry-revalidation-stage',
    'source-commit',
    'tag',
    'tag-object',
    'workspace',
  ]);
  const workspace = path.resolve(requiredArgument(arguments_, 'workspace'));
  const tag = validateReleaseTag(requiredArgument(arguments_, 'tag'));
  const evidenceCommit = validateGitObjectId(requiredArgument(arguments_, 'evidence-commit'), 'Evidence commit');
  const sourceCommit = validateGitObjectId(requiredArgument(arguments_, 'source-commit'), 'Source commit');
  const tagObject = validateGitObjectId(requiredArgument(arguments_, 'tag-object'), 'Annotated tag object');
  const outputDirectory = path.resolve(requiredArgument(arguments_, 'output-dir'));
  const registryRevalidationPath = path.resolve(requiredArgument(arguments_, 'registry-revalidation'));
  const registryResponseArchivePath = path.resolve(requiredArgument(arguments_, 'registry-response-archive'));
  const registryRevalidationStage = requiredArgument(arguments_, 'registry-revalidation-stage');
  if (!robinhoodRegistryRevalidationStages.includes(registryRevalidationStage)) {
    throw new Error('--registry-revalidation-stage is invalid');
  }
  const {
    assetCandidateFile,
    configFile,
    manifest: manifestValue,
    manifestFile,
    permissionedFiles,
    policyFile,
    safePolicyFile,
    stateFile,
  } = await validateReleaseEvidenceCommit({
    evidenceCommit,
    manifestRepositoryPath: requiredArgument(arguments_, 'manifest'),
    sourceCommit,
    workspace,
  });
  const signaturePolicy = validateReleaseManifestSignaturePolicy(await readJson(policyFile.absolutePath));
  const manifest = validateManifestBinding(manifestValue, {
    signaturePolicy,
    sourceCommit,
    tag,
  });
  // The retained manifest is archival. This assertion deliberately aborts
  // before output-directory creation until the external-governance graph has a
  // reviewed current manifest and subgraph derivation.
  const subgraphNetworks = deriveSubgraphNetworks(manifest);
  const [assetCandidateBytes, configBytes, manifestBytes, registryRevalidationBytes, registryResponseBytes] =
    await Promise.all([
      readFile(assetCandidateFile.absolutePath),
      readFile(configFile.absolutePath),
      readFile(manifestFile.absolutePath),
      readFile(registryRevalidationPath),
      readFile(registryResponseArchivePath),
    ]);
  const evidenceCommitCommittedAt = new Date(Number(sourceDateEpoch(workspace, evidenceCommit)) * 1_000).toISOString();
  const registryRevalidation = parseRobinhoodRegistryRevalidationBytes(registryRevalidationBytes, {
    assetCandidateBytes,
    configBytes,
    evidenceCommit,
    evidenceCommitCommittedAt,
    expectedStage: registryRevalidationStage,
    manifestBytes,
    manifestRepositoryPath: manifestFile.repositoryPath,
    registryResponseBytes,
    sourceCommit,
    tag,
    tagObject,
  });

  const metadata = {
    chainId: manifest.network.chainId,
    assetCandidateRepositoryPath: assetCandidateFile.repositoryPath,
    assetCandidateSha256: await sha256File(assetCandidateFile.absolutePath),
    evidenceCommit,
    manifestRepositoryPath: manifestFile.repositoryPath,
    manifestSha256: await sha256File(manifestFile.absolutePath),
    observation: manifest.releaseEvidence.observation,
    emergencyGuardianSafe: manifest.releaseEvidence.emergencyGuardianSafe,
    protocolAdminSafe: manifest.releaseEvidence.protocolAdminSafe,
    protocol: manifest.protocol,
    deploymentConfigRepositoryPath: configFile.repositoryPath,
    deploymentConfigSha256: await sha256File(configFile.absolutePath),
    deploymentStateRepositoryPath: stateFile.repositoryPath,
    deploymentStateSha256: await sha256File(stateFile.absolutePath),
    releaseManifestSignaturePolicyId: signaturePolicy.policyId,
    releaseManifestSignaturePolicyRepositoryPath: policyFile.repositoryPath,
    releaseManifestSignaturePolicySha256: await sha256File(policyFile.absolutePath),
    permissionedPoolEvidence:
      permissionedFiles === null
        ? null
        : {
            graphRepositoryPath: permissionedFiles.graph.repositoryPath,
            graphSha256: await sha256File(permissionedFiles.graph.absolutePath),
            officialSourceBuildRepositoryPath: permissionedFiles.officialSourceBuild.repositoryPath,
            officialSourceBuildSha256: await sha256File(permissionedFiles.officialSourceBuild.absolutePath),
            robinhoodForkRehearsalRepositoryPath: permissionedFiles.robinhoodForkRehearsal.repositoryPath,
            robinhoodForkRehearsalSha256: await sha256File(permissionedFiles.robinhoodForkRehearsal.absolutePath),
          },
    safeControlPlanePolicyRepositoryPath: safePolicyFile.repositoryPath,
    safeControlPlanePolicySha256: await sha256File(safePolicyFile.absolutePath),
    releaseTag: tag,
    robinhoodRegistryRevalidation: {
      authorizationEligible: registryRevalidation.authorizationEligible,
      fetchedAt: registryRevalidation.evidence.fetchedAt,
      rawSha256: await sha256File(registryRevalidationPath),
      selectedRecordsSha256: registryRevalidation.evidence.selectedRecordsSha256,
      sourceArchiveFileName: robinhoodRegistryResponseArchiveFileName,
      sourceArchiveRawSha256: registryRevalidation.evidence.sourceArchive.rawSha256,
      sourceResponseSha256: registryRevalidation.evidence.sourceResponseSha256,
      stage: registryRevalidation.stage,
    },
    sourceCommit,
    sourceDateEpoch: sourceDateEpoch(workspace, sourceCommit),
    tagObject,
    tagVerification: 'github-api-verified-annotated-tag',
    workflowScope: {
      abiPackagePublished: false,
      blockscoutSubmissionPerformed: false,
      mainnetTransactionBroadcast: false,
      sdkPublished: false,
      subgraphDeployed: false,
      webDeployed: false,
    },
  };

  await assertRepositoryHead(workspace, evidenceCommit);
  await mkdir(outputDirectory, { recursive: true });
  await copyFile(assetCandidateFile.absolutePath, path.join(outputDirectory, 'reviewed-asset-candidate.json'));
  await copyFile(configFile.absolutePath, path.join(outputDirectory, 'deployment-config.json'));
  await copyFile(manifestFile.absolutePath, path.join(outputDirectory, 'deployment-manifest.json'));
  if (permissionedFiles !== null) {
    await copyFile(permissionedFiles.graph.absolutePath, path.join(outputDirectory, 'permissioned-pool-graph.json'));
    await copyFile(
      permissionedFiles.officialSourceBuild.absolutePath,
      path.join(outputDirectory, 'permissioned-pool-official-source-build.json'),
    );
    await copyFile(
      permissionedFiles.robinhoodForkRehearsal.absolutePath,
      path.join(outputDirectory, 'permissioned-pool-robinhood-fork-rehearsal.json'),
    );
  }
  await copyFile(policyFile.absolutePath, path.join(outputDirectory, 'release-manifest-signature-policy.json'));
  await copyFile(safePolicyFile.absolutePath, path.join(outputDirectory, 'safe-control-plane-policy.json'));
  await copyFile(registryRevalidationPath, path.join(outputDirectory, 'robinhood-registry-revalidation.json'));
  await copyFile(registryResponseArchivePath, path.join(outputDirectory, robinhoodRegistryResponseArchiveFileName));
  await copyFile(stateFile.absolutePath, path.join(outputDirectory, 'deployment-state.json'));
  await writeFile(path.join(outputDirectory, 'release-metadata.json'), deterministicJson(metadata));
  await writeFile(path.join(outputDirectory, 'subgraph-networks.json'), deterministicJson(subgraphNetworks));
  process.stdout.write(
    `Prepared ${tag} with ${registryRevalidationStage} late registry evidence; no transaction or external mutation was performed.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Release input preparation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
