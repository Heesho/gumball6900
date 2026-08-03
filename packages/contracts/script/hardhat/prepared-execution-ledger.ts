import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson, type PreparedExecutionArtifact } from './prepared-execution-format';

/** Atomically consumes one prepared local execution hash on a protected ledger. */
export async function reservePreparedExecution(
  ledgerPath: string,
  artifact: PreparedExecutionArtifact,
): Promise<string> {
  const supplied = path.resolve(ledgerPath);
  const suppliedStats = await lstat(supplied);
  if (suppliedStats.isSymbolicLink()) throw new Error('execution ledger path must not be a symlink');
  const resolved = await realpath(supplied);
  const stats = await lstat(resolved);
  if (!stats.isDirectory()) throw new Error('execution ledger path must be an existing directory');
  if ((stats.mode & 0o077) !== 0) throw new Error('execution ledger must not grant group or other access');
  const reservation = path.join(resolved, artifact.preparationHash.slice(2));
  try {
    await mkdir(reservation, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('prepared execution has already been reserved; replay refused');
    }
    throw error;
  }
  await writeFile(
    path.join(reservation, 'reservation.json'),
    canonicalJson({
      authorizationHash: artifact.authorization.hash,
      kind: 'gumball-6900-prepared-execution-reservation',
      planHash: artifact.plan.hash,
      preparationHash: artifact.preparationHash,
      runnerSha256: artifact.runner.sha256,
      schemaVersion: 1,
    }),
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  );
  return reservation;
}
