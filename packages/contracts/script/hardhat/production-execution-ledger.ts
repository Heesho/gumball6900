import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson, type ProductionExecutionArtifact } from './production-execution-format';

async function assertOwnedPrivateDirectory(directory: string, label: string): Promise<void> {
  const stats = await lstat(directory);
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(`${label} must be a non-symlink directory`);
  if ((stats.mode & 0o077) !== 0) throw new Error(`${label} must not grant group or other access`);
  if (process.getuid !== undefined && stats.uid !== process.getuid()) {
    throw new Error(`${label} must be owned by the current operator`);
  }
}

export async function resolveProductionExecutionLedger(ledgerPath: string): Promise<string> {
  const supplied = path.resolve(ledgerPath);
  await assertOwnedPrivateDirectory(supplied, 'production execution ledger');
  const resolved = await realpath(supplied);
  await assertOwnedPrivateDirectory(resolved, 'resolved production execution ledger');
  return resolved;
}

/** Atomically consumes the deployment authorization before any signer key may be opened. */
export async function reserveProductionExecution(
  ledgerPath: string,
  artifact: ProductionExecutionArtifact,
): Promise<string> {
  const ledger = await resolveProductionExecutionLedger(ledgerPath);
  const root = path.join(ledger, 'production-authorizations');
  await mkdir(root, { mode: 0o700, recursive: true });
  await assertOwnedPrivateDirectory(root, 'production authorization ledger');
  const authorizationPath = path.join(root, artifact.deploymentAuthorization.authorizationId.slice(2));
  try {
    await mkdir(authorizationPath, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('production deployment authorization has already been reserved; replay refused');
    }
    throw error;
  }
  await assertOwnedPrivateDirectory(authorizationPath, 'production authorization reservation');
  try {
    await writeFile(
      path.join(authorizationPath, 'reservation.json'),
      canonicalJson({
        artifactHash: artifact.artifactHash,
        deploymentAuthorizationId: artifact.deploymentAuthorization.authorizationId,
        deploymentAuthorizationPayloadHash: artifact.deploymentAuthorization.payloadHash,
        executionAuthorizationId: artifact.executionAuthorization.executionId,
        executionAuthorizationPayloadHash: artifact.executionAuthorization.payloadHash,
        kind: 'gumball-6900-production-execution-reservation',
        planHash: artifact.plan.hash,
        runnerSha256: artifact.build.runner.sha256,
        schemaVersion: 1,
        verifierSha256: artifact.build.verifier.sha256,
      }),
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
  } catch (error) {
    await recordProductionExecutionFailure(authorizationPath, error).catch(() => undefined);
    throw error;
  }
  return authorizationPath;
}

export async function recordProductionExecutionFailure(reservationPath: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await writeFile(
    path.join(reservationPath, 'failure.json'),
    canonicalJson({
      failedAt: new Date().toISOString(),
      kind: 'gumball-6900-production-execution-failure',
      message,
      retryPermitted: false,
      schemaVersion: 1,
    }),
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  );
}
