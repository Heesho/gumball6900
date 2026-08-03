import { lstat } from 'node:fs/promises';
import path from 'node:path';

import { getAddress, keccak256, stringToHex } from 'viem';

import { deterministicJson } from './deterministic-json.js';
import {
  generatedRobinhoodAssetManifestSchema,
  robinhoodRegistryResponseSchema,
  type GeneratedRobinhoodAssetManifest,
} from './robinhood-asset-manifest.js';
import {
  assertExpectedGitRepositoryRoot,
  assertRepositoryHead,
  readExactTrackedFileAtHead,
} from './tracked-git-file.js';

const reviewedAssetManifestPathPattern =
  /^packages\/config\/deployments\/robinhood-mainnet-assets\.(\d{4}-\d{2}-\d{2})\.candidate\.json$/;

export const reviewedAssetManifestPathTemplate =
  'packages/config/deployments/robinhood-mainnet-assets.YYYY-MM-DD.candidate.json' as const;

export interface ReviewedRobinhoodAssetManifestOptions {
  readonly expectedCommit: string;
  readonly repositoryRelativePath: string;
  readonly repositoryRoot: string;
}

export interface ReviewedAssetDeploymentConfig {
  readonly assets: {
    readonly assetIds: readonly string[];
    readonly decimals: readonly number[];
    readonly isStockToken: readonly boolean[];
    readonly runtimeBytecodeHashes: readonly string[];
    readonly symbolHashes: readonly string[];
    readonly tokens: readonly string[];
    readonly uiMultipliers: readonly (string | null)[];
  };
  readonly stockTokenDependency: {
    readonly beaconAddress: string;
    readonly beaconRuntimeBytecodeHash: string;
    readonly implementationAddress: string;
    readonly implementationRuntimeBytecodeHash: string;
  } | null;
}

function fixed18ToInteger(value: string): string {
  const match = /^(\d+)\.(\d{18})$/.exec(value);
  if (match === null) throw new Error(`Official registry multiplier ${value} is not fixed-18`);
  return (BigInt(match[1]!) * 10n ** 18n + BigInt(match[2]!)).toString();
}

/** Proves that the signed deployment arrays are an exact projection of the reviewed five-stock candidate. */
export function assertReviewedRobinhoodAssetManifestMatchesDeploymentConfig(
  manifest: GeneratedRobinhoodAssetManifest,
  config: ReviewedAssetDeploymentConfig,
): void {
  if (config.stockTokenDependency === null) {
    throw new Error('Deployment config lacks the reviewed stock-token dependency');
  }
  const reviewedDependency = manifest.stockTokenDependency;
  if (
    getAddress(config.stockTokenDependency.beaconAddress) !== getAddress(reviewedDependency.beaconAddress) ||
    config.stockTokenDependency.beaconRuntimeBytecodeHash.toLowerCase() !==
      reviewedDependency.beaconRuntimeBytecodeHash ||
    getAddress(config.stockTokenDependency.implementationAddress) !==
      getAddress(reviewedDependency.implementationAddress) ||
    config.stockTokenDependency.implementationRuntimeBytecodeHash.toLowerCase() !==
      reviewedDependency.implementationRuntimeBytecodeHash
  ) {
    throw new Error('Deployment config stock-token dependency does not match the reviewed candidate');
  }
  const stockIndexes = config.assets.isStockToken.flatMap((isStock, index) => (isStock ? [index] : []));
  if (stockIndexes.length !== manifest.assets.length) {
    throw new Error('Deployment config stock-token set does not match the reviewed candidate');
  }
  const matchedIndexes = new Set<number>();
  for (const asset of manifest.assets) {
    const indexes = stockIndexes.filter(
      (index) => getAddress(config.assets.tokens[index]!) === getAddress(asset.address),
    );
    if (indexes.length !== 1) throw new Error(`Deployment config lacks one exact reviewed ${asset.symbol} address`);
    const index = indexes[0]!;
    if (matchedIndexes.has(index)) throw new Error(`Deployment config duplicates reviewed ${asset.symbol}`);
    matchedIndexes.add(index);
    if (
      config.assets.decimals[index] !== asset.decimals ||
      config.assets.assetIds[index]!.toLowerCase() !== asset.uid ||
      config.assets.runtimeBytecodeHashes[index]!.toLowerCase() !== asset.runtimeBytecodeHash ||
      config.assets.symbolHashes[index]!.toLowerCase() !== keccak256(stringToHex(asset.symbol)) ||
      config.assets.uiMultipliers[index] !== asset.currentMultiplier
    ) {
      throw new Error(`Deployment config identity for reviewed ${asset.symbol} does not match the candidate`);
    }
  }
}

/** Rechecks the candidate's mutable official-registry status and identity immediately before authorization use. */
export function assertReviewedRobinhoodAssetManifestMatchesOfficialRegistry(
  manifest: GeneratedRobinhoodAssetManifest,
  registryPayload: unknown,
): void {
  const registry = robinhoodRegistryResponseSchema.parse(registryPayload);
  for (const asset of manifest.assets) {
    const matches = registry.assets.filter(({ tokenSymbol }) => tokenSymbol === asset.symbol);
    if (matches.length !== 1) throw new Error(`Official registry does not contain one exact ${asset.symbol} record`);
    const record = matches[0]!;
    const deployments = record.deployments.filter(({ chainId }) => chainId === 4663);
    if (
      record.status !== 'ASSET_STATUS_ACTIVE' ||
      record.id !== asset.uid ||
      fixed18ToInteger(record.currentMultiplier) !== asset.currentMultiplier ||
      deployments.length !== 1 ||
      getAddress(deployments[0]!.contractAddress) !== getAddress(asset.address)
    ) {
      throw new Error(`Official registry identity or active status for ${asset.symbol} changed after review`);
    }
  }
}

function reviewedAssetManifestDate(repositoryRelativePath: string): string {
  const pathMatch = reviewedAssetManifestPathPattern.exec(repositoryRelativePath);
  if (pathMatch === null) {
    throw new Error(`Reviewed asset candidate must use the fixed dated path ${reviewedAssetManifestPathTemplate}`);
  }
  return pathMatch[1]!;
}

export function parseReviewedRobinhoodAssetManifest(
  repositoryRelativePath: string,
  content: string,
): GeneratedRobinhoodAssetManifest {
  const candidateDate = reviewedAssetManifestDate(repositoryRelativePath);

  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error('Reviewed asset candidate is not valid JSON', { cause: error });
  }
  const manifest = generatedRobinhoodAssetManifestSchema.parse(value);
  const observedDate = manifest.source.observedAt.slice(0, 10);
  if (candidateDate !== observedDate) {
    throw new Error(
      `Reviewed asset candidate date ${candidateDate} does not match source.observedAt date ${observedDate}`,
    );
  }
  if (content !== deterministicJson(manifest)) {
    throw new Error('Reviewed asset candidate must use canonical deterministic JSON bytes');
  }
  return manifest;
}

/**
 * Reads a stock-asset candidate only when it occupies the reviewed dated path and its regular-file bytes are exactly
 * those committed at the current authorized HEAD. Raw workstation output under an ignored `generated/` directory can
 * never satisfy this boundary.
 */
export async function validateReviewedRobinhoodAssetManifestAtHead(
  options: ReviewedRobinhoodAssetManifestOptions,
): Promise<GeneratedRobinhoodAssetManifest> {
  reviewedAssetManifestDate(options.repositoryRelativePath);
  const repositoryRoot = await assertExpectedGitRepositoryRoot(options.repositoryRoot);
  await assertRepositoryHead(repositoryRoot, options.expectedCommit);
  const candidate = path.join(repositoryRoot, ...options.repositoryRelativePath.split('/'));
  const stats = await lstat(candidate);
  if ((stats.mode & 0o111) !== 0) {
    throw new Error('Reviewed asset candidate worktree file must be nonexecutable');
  }
  const content = await readExactTrackedFileAtHead(
    repositoryRoot,
    options.repositoryRelativePath,
    options.expectedCommit,
  );
  return parseReviewedRobinhoodAssetManifest(options.repositoryRelativePath, content);
}
