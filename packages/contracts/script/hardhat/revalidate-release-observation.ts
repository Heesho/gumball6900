import { readFile } from 'node:fs/promises';
import path from 'node:path';

import hre from 'hardhat';

import { assertReleaseManifestObservation, type ReleaseManifest } from './release-manifest-binding';
import { verifyLiveReleaseObservation } from './release-observation-verifier';
import { assertSafeControlPlaneEvidence, observeSafeControlPlane } from './safe-control-plane';

function requiredManifestPath(): string {
  const value = process.env.RELEASE_MANIFEST_PATH;
  if (value === undefined || value.length === 0) throw new Error('RELEASE_MANIFEST_PATH is required');
  return path.resolve(value);
}

function expectedChainId(networkName: string): bigint {
  if (networkName === 'robinhood') return 4_663n;
  if (networkName === 'robinhoodTestnet') return 46_630n;
  throw new Error(`release observation revalidation does not support network ${networkName}`);
}

async function main(): Promise<void> {
  const manifestPath = requiredManifestPath();
  const manifestValue = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  if (manifestValue === null || typeof manifestValue !== 'object' || Array.isArray(manifestValue)) {
    throw new Error('Release manifest must be a JSON object');
  }
  const manifest = manifestValue as ReleaseManifest;
  const network = await hre.ethers.provider.getNetwork();
  const chainId = expectedChainId(hre.network.name);
  if (network.chainId !== chainId) {
    throw new Error(`Release observation expected chain ${chainId}, received ${network.chainId}`);
  }
  const observation = assertReleaseManifestObservation(manifest, chainId, Date.now());
  const result = await verifyLiveReleaseObservation(hre.ethers.provider, observation);
  const currentProtocolAdminSafe = await observeSafeControlPlane(
    hre.ethers.provider,
    manifest.releaseEvidence.protocolAdminSafe.safeAddress,
    result.headBlock,
  );
  const currentEmergencyGuardianSafe = await observeSafeControlPlane(
    hre.ethers.provider,
    manifest.releaseEvidence.emergencyGuardianSafe.safeAddress,
    result.headBlock,
  );
  if (
    currentProtocolAdminSafe.block.hash !== result.headHash ||
    currentEmergencyGuardianSafe.block.hash !== result.headHash
  ) {
    throw new Error('Current protocol-admin Safe observation head changed during revalidation');
  }
  assertSafeControlPlaneEvidence(currentProtocolAdminSafe, manifest.releaseEvidence.protocolAdminSafe, {
    includeBlock: false,
    label: 'Current protocol-admin Safe',
  });
  assertSafeControlPlaneEvidence(currentEmergencyGuardianSafe, manifest.releaseEvidence.emergencyGuardianSafe, {
    includeBlock: false,
    label: 'Current emergency-guardian Safe',
  });
  // The RPC round trip itself must not carry an observation past its signed expiry.
  assertReleaseManifestObservation(manifest, chainId, Date.now());
  console.log(
    `revalidated signed observation block ${result.observationBlock} at head ${result.headBlock} with ${result.confirmations} confirmations`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
